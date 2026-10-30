import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems } from '../../curriculum/qa';
import type { FillItem } from '../../engines/fill/fill';
import { engineOf } from '../../engines/registry';
import { expressions } from './expressions';
import { MISSING } from './ruby';

const fills = () =>
  sampleItems(expressions, 200).filter((it): it is FillItem => it.engine === 'fill');
/** 場面ごとの □ ＝ t の ときの ○（設計書 1.4。id の 数の 並び: cookie・tank a:b、box a:b、ほかは 1つ） */
const F: Record<string, (n: number[], t: number) => number> = {
  cookie: ([a, b], t) => a! * t + b!,
  tank: ([a, b], t) => a! * t + b!,
  tri: ([a], t) => (a! * t) / 2,
  box: ([a, b], t) => a! * b! * t,
  garden: ([a], t) => a! * t,
  cards: ([c], t) => c! - t,
  ribbon: ([c], t) => c! - t,
  sticker: ([d], t) => t + d!,
};
const plain = (s: string) => s.replace(/《[^》]*》/g, '');

describe('g5.math.expressions', () => {
  it('fill だけで、正答は正解・誤りは誤概念どおりに誤り', () => {
    const items = fills();
    expect(items.length).toBeGreaterThan(100);
    expect(sampleItems(expressions, 200).every((it) => it.engine === 'fill')).toBe(true);
    for (const it of items) {
      const eng = engineOf(it);
      const ok = it.blanks.map((b) => b.answers[0]!);
      expect(eng.judge(it, ok).result, it.id).toBe('correct');
      it.blanks.forEach((b, i) => {
        for (const w of b.wrong ?? []) {
          const res = [...ok];
          res[i] = w.value;
          const j = eng.judge(it, res);
          expect(j.result, `${it.id} ${w.value}`).toBe('wrong');
          expect('misconception' in j ? j.misconception : undefined, `${it.id} ${w.value}`).toBe(
            w.misconception,
          );
        }
      });
    }
  });

  it('選択肢は 2〜4 で重複なく、正答が入っている', () => {
    for (const it of fills()) {
      const sets = [it.options, ...it.blanks.flatMap((b) => (b.options ? [b.options] : []))];
      for (const o of sets) {
        expect(o.length, it.id).toBeGreaterThanOrEqual(2);
        expect(o.length, it.id).toBeLessThanOrEqual(4);
        expect(new Set(o.map(plain)).size, it.id).toBe(o.length);
      }
      it.blanks.forEach((b, i) => {
        const o = (b.options ?? it.options).map(plain);
        expect(o, it.id).toContain(plain(b.answers[0]!));
        if (/^(value|reverse|make)/.test(it.id) && /^\d+$/.test(plain(b.answers[0]!)))
          expect((b.wrong ?? []).length, `${it.id} 空欄${i + 1}`).toBeGreaterThanOrEqual(1);
      });
    }
  });

  it('value・reverse の答えが式どおり', () => {
    let n = 0;
    for (const it of fills()) {
      const m = /^(value|reverse)(?:-alt)?:/.exec(it.id);
      if (!m) continue;
      const ans = Number(plain(it.blanks[0]!.answers[0]!));
      // id = 形:場面:数…:t。場面の 式で ○ を 計算し直す
      const parts = it.id.split(':');
      const scene = parts[1]!;
      const nums = parts.slice(2, -1).map(Number);
      const t = Number(parts[parts.length - 1]);
      const y = F[scene]!(nums, t);
      expect(Number.isInteger(y) && y > 0, it.id).toBe(true);
      if (m[1] === 'reverse') {
        // ○ の 値が 問題に 出て いて、答えは t
        expect(ans, it.id).toBe(t);
        expect(plain(it.prompt), it.id).toContain(String(y));
      } else {
        expect(ans, it.id).toBe(y);
      }
      n++;
    }
    expect(n).toBeGreaterThan(20);
  });

  it('比例の答え', () => {
    const yes = ['tri', 'box', 'garden'];
    for (const it of fills()) {
      const m = /^change:prop:(\w+)$/.exec(it.id);
      if (!m) continue;
      expect(plain(it.blanks[0]!.answers[0]!), it.id).toBe(yes.includes(m[1]!) ? 'する' : 'しない');
    }
  });

  it('表の 別例（change-alt:step）の 解説は 見せて いない 式を 使わない', () => {
    let n = 0;
    for (const it of fills()) {
      if (!it.id.startsWith('change-alt:step')) continue;
      expect(plain(it.explain ?? ''), it.id).not.toContain('式');
      n++;
    }
    expect(n).toBeGreaterThan(0);
  });

  it('検査の誤りなし・よみの漏れなし', () => {
    const r = checkUnit(expressions);
    expect(r.errors).toEqual([]);
    expect(isReady(r)).toBe(true);
    expect(r.q).toBeGreaterThanOrEqual(5);
    expect([...MISSING.keys()].filter((k) => '□○'.indexOf(k) < 0)).toEqual([]);
  });
});
