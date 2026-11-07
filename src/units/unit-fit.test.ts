import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * 作業領域の --fit の測り（UnitRunner の fitNow）に、数字キーの区画のはみ出しを入れない（第8回 Y2）。
 * jsdom には配置が無いので、規則そのもの（測る間だけ区画の高さが 0 になる）と、それが number.css の
 * `max-height: 100%` に勝つこと、UnitRunner が測る間 data-measure を付けることを見る。実際の寸法は
 * npm run check:text-layout（g2.prog.repeat/28 の盤 10.6u・--fit 1）で確かめる。
 */
const unitCss = readFileSync('src/units/unit.css', 'utf8');
const numberCss = readFileSync('src/engines/number/number.css', 'utf8');
const runner = readFileSync('src/units/UnitRunner.tsx', 'utf8');

/** 規則の本体（`{` から `}` まで）。コメントは除いて探す */
function rule(css: string, selector: string): string {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const i = plain.indexOf(`${selector} {`);
  expect(i, selector).toBeGreaterThanOrEqual(0);
  return plain.slice(i, plain.indexOf('}', i));
}

/** セレクタの詳しさ（class・属性・疑似クラスの数）。この規則で比べるのに足りる簡易版 */
function specificity(selector: string): number {
  return (selector.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g) ?? []).length;
}

describe('数字キーの区画と --fit の測り（第8回 Y2）', () => {
  const measureSel = '.unit__work[data-measure]:not([data-measure-pad]) .eng-number__pad';
  const padSel = '.unit__work--number .eng-number__pad';

  it('測る間（data-measure）だけ、区画の高さを 0 にして中身を切る', () => {
    const body = rule(unitCss, measureSel);
    expect(body).toMatch(/max-height:\s*0\s*;/);
    expect(body).toMatch(/overflow:\s*hidden\s*;/);
  });

  it('区画の幅は残す（width・display・visibility を書き換えない）', () => {
    const body = rule(unitCss, measureSel);
    expect(body).not.toMatch(/\bwidth\s*:/);
    expect(body).not.toMatch(/\bdisplay\s*:/);
    expect(body).not.toMatch(/\bgrid-template-columns\s*:/);
  });

  it('区画の通常の高さの規則（max-height: 100%）より詳しい', () => {
    expect(rule(numberCss, padSel)).toMatch(/max-height:\s*100%/);
    expect(specificity(measureSel)).toBeGreaterThan(specificity(padSel));
  });

  it('区画の通常の寸法（--u0 で 1 つ 6u 以上）は変えていない', () => {
    const body = rule(numberCss, '.eng-number__pad');
    expect(body).toContain('--u: var(--u0)');
    expect(body).toMatch(/--key-h:\s*max\(calc\(var\(--u0\) \* 6\)/);
    expect(body).toMatch(/grid-template-columns:\s*repeat\(4, calc\(var\(--u0\) \* 6\)\)/);
  });

  it('10の棒の図だけは、測る間も区画のはみ出しを数える（data-measure-pad）', () => {
    // 棒には縮みの下限（1 本 1.2u）があり、図の段が足りない分は --fit でほかの中身を縮めて空ける。区画のはみ出しを外すと、
    // g2.math.mult-beyond/2 は図の段が 2u 足りずに枠（スクロール）になった
    expect(runner).toContain("work.querySelector(':scope > .unit__figure .blk--t')");
    expect(runner).toContain("work.setAttribute('data-measure-pad', '')");
    expect(runner).toContain("work.removeAttribute('data-measure-pad')");
    expect(unitCss).toContain(':not([data-measure-pad])');
  });

  it('UnitRunner は fit の測りの間 data-measure を付け、scrollHeight を読んでから外す', () => {
    const start = runner.indexOf('const fitNow = () => {');
    expect(start).toBeGreaterThanOrEqual(0);
    // 作業ツリーの改行が CRLF でも LF でも、fitNow の定義の終わり（最初の呼び出しの直前）までを取る
    const end = runner.slice(start).search(/work\.scrollTop = 0;\r?\n\s*fitNow\(\);/);
    expect(end).toBeGreaterThan(0);
    const body = runner.slice(start, start + end);
    const set = body.indexOf("work.setAttribute('data-measure', '')");
    const read = body.indexOf('const need = work.scrollHeight');
    const unset = body.lastIndexOf("work.removeAttribute('data-measure')");
    expect(set).toBeGreaterThanOrEqual(0);
    expect(read).toBeGreaterThan(set);
    expect(unset).toBeGreaterThan(read);
  });

  it('区画のはみ出しを数えない代わりに、数の入力では図の段のはみ出しを問題・ヒントでも数える', () => {
    // 図の段は 1fr で、図がはみ出しても work.scrollHeight に入らない。区画のはみ出しが（たまたま）--fit を縮めて入れていた
    // 図（g3.math.circle-sphere/3 の 6 この円）は、図そのもののはみ出しで縮む
    const start = runner.indexOf('let extra = 0;');
    expect(start).toBeGreaterThanOrEqual(0);
    const body = runner.slice(
      start,
      runner.indexOf('const need = work.scrollHeight + extra', start),
    );
    expect(body).toContain("engineId === 'number'");
    // 解説は今までどおり（枠のときは数えない）。問題・ヒントは、表・10の棒・文の図（useFigureScroll が自分で縮める）は数えない
    expect(body).toContain("s.phase === 'explain'");
    expect(body).toContain("'.fig-table, .blk--t, .fig-text'");
    expect(body).toContain('nf.scrollHeight - nf.clientHeight');
    // 差が 0.5u 以下のときも数えない
    expect(body).toContain('(work.clientWidth / 92) * 0.5');
  });
});
