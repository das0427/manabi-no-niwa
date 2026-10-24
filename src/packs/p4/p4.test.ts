import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems } from '../../curriculum/qa';
import type { Item } from '../../curriculum/types';
import { engineOf } from '../../engines/registry';
import { ILLUST } from '../../illust/registry';
import { MODE_BY_ID } from '../../modes/registry';
import { PRESCHOOL_HOMES } from '../../curriculum/preschoolHome';
import pack from './index';

function illustIds(x: unknown, out: string[] = []): string[] {
  if (Array.isArray(x)) for (const v of x) illustIds(v, out);
  else if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    if (o.kind === 'illust' && typeof o.id === 'string') out.push(o.id);
    for (const v of Object.values(o)) illustIds(v, out);
  }
  return out;
}
const correctIdx = (it: Item): number[] =>
  it.engine === 'choice' || it.engine === 'listen'
    ? it.options.flatMap((o, i) => (o.correct ? [i] : []))
    : [];

describe('p4 の教材検査（curriculum-matrix 1.8）', () => {
  for (const unit of pack.units) {
    it(`${unit.id}: 検査の誤りなし・量と網羅`, () => {
      const r = checkUnit(unit);
      expect(r.errors).toEqual([]);
      if (unit.status === 'ready') expect(isReady(r)).toBe(true);
      console.info(
        `${unit.id}: Q ${r.q.toFixed(2)} (${r.distinct}) / C ${r.c[0]}/${r.c[1]} / 汎用誤答 ${(r.genericWrongShare * 100).toFixed(0)}%`,
      );
    });
  }

  it('v1 の参照: 段階の数が v1 のスキルの範囲と合う', () => {
    for (const unit of pack.units) {
      if (unit.source.kind !== 'legacy') continue;
      const lg = unit.source.legacy;
      expect(MODE_BY_ID[lg.modeId], unit.id).toBeDefined();
      if (lg.levelRange)
        expect(unit.levels.length, unit.id).toBe(lg.levelRange[1] - lg.levelRange[0] + 1);
    }
  });

  it('選択肢は4つまで・正解が判定される・絵が登録されている・漢字なし・id が一意', () => {
    for (const unit of pack.units) {
      expect(ILLUST[unit.icon], unit.icon).toBeDefined();
      if (unit.source.kind === 'legacy') continue;
      const items = sampleItems(unit, 60);
      for (const it of items) {
        if (it.engine === 'choice' || it.engine === 'listen') {
          expect(it.options.length, it.id).toBeLessThanOrEqual(4);
          expect(engineOf(it).judge(it, correctIdx(it)).result, it.id).toBe('correct');
        }
      }
      for (const id of illustIds(items)) expect(ILLUST[id], `${unit.id}: ${id}`).toBeDefined();
      expect(JSON.stringify(items)).not.toMatch(/[一-鿿]/);
      if (unit.source.kind === 'items') {
        const ids = unit.source.items.map((i) => i.id);
        expect(new Set(ids).size, unit.id).toBe(ids.length);
      }
    }
  });

  it('ホームの札: 単元が このパックに ある・9枚まで・札の絵が登録されている', () => {
    const def = PRESCHOOL_HOMES['p4']!;
    expect(def.cards.length).toBeLessThanOrEqual(9);
    const ids = new Set(pack.units.map((u) => u.id));
    for (const c of def.cards) {
      expect(ILLUST[c.icon], c.icon).toBeDefined();
      for (const u of c.units) expect(ids.has(u), u).toBe(true);
    }
    for (const u of pack.units)
      expect(
        def.cards.some((c) => c.units.includes(u.id)),
        u.id,
      ).toBe(true);
    for (const id of def.stage2Cards ?? []) expect(def.cards.some((c) => c.id === id)).toBe(true);
  });
});
