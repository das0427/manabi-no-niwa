import { describe, expect, it } from 'vitest';
import { checkUnit, isReady } from '../../curriculum/qa';
import { buildRound } from '../../curriculum/round';
import { engineOf } from '../../engines/registry';
import pack from './index';

describe('g1-math の教材検査（curriculum-matrix 1.8）', () => {
  for (const unit of pack.units) {
    it(`${unit.id}: 検査の誤りなし・量と網羅`, () => {
      const r = checkUnit(unit);
      expect(r.errors).toEqual([]);
      // 状態を ready と書くなら、条件を満たしていること（partial は満たさなくてよい）
      if (unit.status === 'ready') expect(isReady(r)).toBe(true);
      // 報告用に出力
      console.info(
        `${unit.id}: Q ${r.q.toFixed(2)} (${r.distinct}) / C ${r.c[0]}/${r.c[1]} / 汎用誤答 ${(r.genericWrongShare * 100).toFixed(0)}%`,
      );
    });
  }

  it('全単元: number の問題は正答で正解・誤答例で誤り（各段階）', () => {
    for (const unit of pack.units) {
      for (let level = 0; level < unit.levels.length; level++) {
        for (const it of buildRound(unit, { level, seed: 11, count: 12 })) {
          if (it.engine !== 'number') continue;
          const eng = engineOf(it);
          const ans = it.fields.map((f) => String((f.answer as { value: number }).value));
          expect(eng.judge(it, ans).result, `${unit.id} ${it.id}`).toBe('correct');
          for (const w of it.wrongAnswers ?? []) {
            const j = eng.judge(it, w.value.split('|'));
            expect(j, `${unit.id} ${it.id} ${w.value}`).toMatchObject({
              result: 'wrong',
              misconception: w.misconception,
            });
          }
        }
      }
    }
  });

  it('add-basic: 定義域35通りがすべて出る・正答で正解・誤答例で誤り', () => {
    const unit = pack.units.find((u) => u.id === 'g1.math.add-basic')!;
    const r = checkUnit(unit);
    expect(r.distinct).toBe(35);
    expect(isReady(r)).toBe(true);
    const items = buildRound(unit, { level: 2, seed: 7, count: 6 });
    expect(new Set(items.map((i) => i.identity)).size).toBe(items.length);
    for (const it of items) {
      if (it.engine !== 'number') continue;
      const eng = engineOf(it);
      const ans = it.fields.map((f) => String((f.answer as { value: number }).value));
      expect(eng.judge(it, ans).result).toBe('correct');
      for (const w of it.wrongAnswers ?? []) {
        const j = eng.judge(it, w.value.split('|'));
        expect(j).toMatchObject({ result: 'wrong', misconception: w.misconception });
      }
    }
  });
});
