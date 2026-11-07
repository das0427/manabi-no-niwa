import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * 共有の数字キー（numpad.css）の寸法の約束（FX05。DESINGN.md 5.1・18章）。
 * キーは主操作の寸法（6u 以上）で、問題・ヒントのあいだは作業領域の --fit で縮めない。
 * 実際の大きさ（4 つの画面サイズ）と、作業領域に収まること（重なり・スクロールの枠が出ない）は
 * 描画が要るので e2e/ux-f2.spec.ts と、手元の測り（check:text-layout 相当）で見る。ここでは CSS の作りの約束だけを見る。
 */
const css = readFileSync('src/engines/numberline/numpad.css', 'utf8').replace(/\r\n/g, '\n');

/** セレクタの規則の本体を返す（コメントは除く） */
function rule(selector: string): string {
  const esc = selector.replace(/[.[\]'()]/g, '\\$&');
  const m = new RegExp(`(^|\\n)${esc}\\s*\\{([^}]*)\\}`).exec(css);
  expect(m, `${selector} の規則が無い`).toBeTruthy();
  return m![2]!.replace(/\/\*[\s\S]*?\*\//g, '');
}
const flat = (s: string) => s.replace(/\s+/g, ' ');

describe('numpad.css: 数字キー（.mnp-pad）は 6u 以上で、fit で縮めない', () => {
  it('キーの単位 --k は縮める前の --u0 が上限（fit では縮めない）。キーの中の --u も --k', () => {
    const r = flat(rule('.mnp-pad'));
    const k = /--k: ([^;]+);/.exec(r)?.[1] ?? '';
    // --k = max(--u0 × 0.8, min(--u0, 作業領域の高さ ÷ 24.62))
    expect(k).toContain('max( calc(var(--u0) * 0.8)');
    expect(k).toContain('min(var(--u0),');
    expect(k).toContain('--work-h');
    // 下限 0.8（今までの fit の下限と同じ）。作業領域がこれより狭いときだけ、スクロールの枠になる
    // 割る数: 4 段 × 6u ＋ 3 つの間（最小 0.2u）= 24.6u。作業領域が 24.62u 以上なら --k = --u0（キーは 6u）
    const div = Number(/\/ ([\d.]+)\)/.exec(k)?.[1]);
    expect(div).toBeGreaterThanOrEqual(24.6);
    expect(div).toBeLessThanOrEqual(24.66);
    expect(r).toContain('--u: var(--k)');
  });

  it('列の幅・段の高さは --k の 6 倍（fit で縮む --u の 6 倍にしない）', () => {
    const r = flat(rule('.mnp-pad'));
    expect(r).toContain('grid-template-columns: repeat(4, calc(var(--k) * 6))');
    expect(r).toContain('grid-auto-rows: calc(var(--k) * 6)');
    expect(r).not.toMatch(/calc\(var\(--u\) \* 6\)/);
  });

  it('段の間は作業領域（--work-h）の余りを分け、0.2u〜0.8u。4 段 × 6u ＋ 3 × 0.2u = 24.6u が作業領域の最小（24.7u）に収まる', () => {
    const r = flat(rule('.mnp-pad'));
    const m =
      /row-gap: clamp\( ?calc\(var\(--k\) \* ([\d.]+)\), ?calc\(\(var\(--work-h,[^)]*\)[^/]*\) \/ 3\), ?calc\(var\(--k\) \* ([\d.]+)\) ?\)/.exec(
        r,
      );
    expect(m, 'row-gap の clamp').toBeTruthy();
    const [min, max] = [Number(m![1]), Number(m![2])];
    expect(max).toBe(0.8);
    expect(min).toBeLessThanOrEqual(0.25);
    // 4 段 × 6u ＋ 3 つの間（最小）。測った作業領域の最小は 24.66u（ふりがな付きで 2 行になる問題文の g4.math.angle/5。4 つの画面サイズで同じ）
    expect(4 * 6 + 3 * min).toBeLessThanOrEqual(24.66);
    expect(r).toContain('--work-h');
  });

  it('解説（キーは使えない）のあいだは、今までどおり --fit で縮める（作業領域が解説の板の上までに狭まる）', () => {
    const r = flat(rule(".unit[data-phase='explain'] .mnp-pad"));
    expect(r).toContain('--k: calc(var(--u0) * var(--fit, 1))');
  });
});
