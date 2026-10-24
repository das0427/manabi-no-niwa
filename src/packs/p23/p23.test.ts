import { describe, expect, it } from 'vitest';
import { checkUnit, isReady } from '../../curriculum/qa';
import type { Item } from '../../curriculum/types';
import { engineOf } from '../../engines/registry';
import { ILLUST } from '../../illust/registry';
import { PRESCHOOL_HOMES } from '../../curriculum/preschoolHome';
import pack from './index';

/** 絵の id（図・選択肢・カードの中の illust）を全部 */
function illustIds(x: unknown, out: string[] = []): string[] {
  if (Array.isArray(x)) for (const v of x) illustIds(v, out);
  else if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    if (o.kind === 'illust' && typeof o.id === 'string') out.push(o.id);
    for (const v of Object.values(o)) illustIds(v, out);
  }
  return out;
}

const itemsOf = (u: (typeof pack.units)[number]): Item[] =>
  u.source.kind === 'items' ? u.source.items : [];

/** 正解の選択肢の番号（choice・listen） */
const correctIdx = (it: Item): number[] =>
  it.engine === 'choice' || it.engine === 'listen'
    ? it.options.flatMap((o, i) => (o.correct ? [i] : []))
    : [];

describe('p23 の教材検査（curriculum-matrix 1.8）', () => {
  for (const unit of pack.units) {
    it(`${unit.id}: 検査の誤りなし・量と網羅`, () => {
      const r = checkUnit(unit);
      expect(r.errors).toEqual([]);
      if (unit.status === 'ready') expect(isReady(r)).toBe(true);
      console.info(
        `${unit.id}: Q ${r.q.toFixed(2)} (${r.distinct}) / C ${r.c[0]}/${r.c[1]} / 汎用誤答 ${(r.genericWrongShare * 100).toFixed(0)}% / 問題 ${itemsOf(unit).length}`,
      );
    });
  }

  it('2歳段階（段階0）: 選択肢は2つ、問題は8以上、なぞりなし', () => {
    for (const unit of pack.units) {
      if (unit.source.kind !== 'items') continue;
      const l2 = itemsOf(unit).filter((it) => it.level === 0);
      expect(l2.length, unit.id).toBeGreaterThanOrEqual(8);
      for (const it of l2) {
        expect(it.engine, it.id).not.toBe('trace');
        if (it.engine === 'choice' || it.engine === 'listen')
          expect(it.options.length, it.id).toBe(2);
        if (it.engine === 'sort') expect(it.cards.length, it.id).toBeLessThanOrEqual(2);
        if (it.engine === 'order') expect(it.cards.length, it.id).toBe(2);
      }
    }
  });

  it('3歳段階: 選択肢は3つまで・正解が判定される', () => {
    for (const unit of pack.units)
      for (const it of itemsOf(unit)) {
        if (!('options' in it)) continue;
        expect(it.options.length, it.id).toBeLessThanOrEqual(3);
        expect(engineOf(it).judge(it, correctIdx(it)).result, it.id).toBe('correct');
      }
  });

  it('絵の id がすべて登録されている・文に漢字が無い', () => {
    for (const unit of pack.units) {
      for (const id of illustIds(itemsOf(unit)))
        expect(ILLUST[id], `${unit.id}: ${id}`).toBeDefined();
      expect(ILLUST[unit.icon], unit.icon).toBeDefined();
      expect(JSON.stringify(itemsOf(unit))).not.toMatch(/[一-鿿]/);
      const ids = itemsOf(unit).map((i) => i.id);
      expect(new Set(ids).size, unit.id).toBe(ids.length);
    }
  });

  it('ホームの札: 単元が このパックに ある・9枚まで・札の絵が登録されている', () => {
    const def = PRESCHOOL_HOMES['p23']!;
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
