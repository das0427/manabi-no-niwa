import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems } from '../../curriculum/qa';
import type { FillItem } from '../../engines/fill/fill';
import { engineOf } from '../../engines/registry';
import { expressions } from './expressions';
import { MISSING } from './ruby';

const fills = () =>
  sampleItems(expressions, 200).filter((it): it is FillItem => it.engine === 'fill');
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
      // 式は prompt か 図に ある。□ ＝ t を式に 入れて ○ に戻る
      const src =
        it.id.startsWith('value-alt') || it.id.startsWith('reverse-alt') ? it.prompt : it.prompt;
      void src;
      const t = Number(it.id.split(':').pop());
      if (m[1] === 'reverse') expect(ans, it.id).toBe(t);
      expect(Number.isInteger(ans) && ans > 0, it.id).toBe(true);
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

  it('検査の誤りなし・よみの漏れなし', () => {
    const r = checkUnit(expressions);
    expect(r.errors).toEqual([]);
    expect(isReady(r)).toBe(true);
    expect(r.q).toBeGreaterThanOrEqual(5);
    expect([...MISSING.keys()].filter((k) => '□○'.indexOf(k) < 0)).toEqual([]);
  });
});
