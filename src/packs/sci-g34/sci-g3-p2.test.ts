/**
 * 小3 P2 の 3単元（g3.sci.weight・g3.sci.wind-rubber・g3.sci.light-sound）の追加の検査。
 * 設計: docs/expansion/p2-design/sci-g3.md 8.4。共通の検査は sci-g34.test.ts。
 */
import { describe, expect, it } from 'vitest';
import { checkUnit, textsOf } from '../../curriculum/qa';
import type { ChoiceItem, Item, UnitSpec } from '../../curriculum/types';
import pack from './index';

const unitOf = (id: string): UnitSpec => {
  const u = pack.units.find((x) => x.id === id);
  if (!u) throw new Error(id);
  return u;
};
const itemsOf = (u: UnitSpec): Item[] => (u.source.kind === 'items' ? u.source.items : []);
const plain = (t: unknown): string =>
  typeof t === 'string' ? t.replace(/《[^》]*》/g, '').replace(/[\s「」、。（）]/g, '') : '';

const SPECS = [
  { id: 'g3.sci.weight', objs: ['shape', 'kind', 'measure'], misc: 15 },
  { id: 'g3.sci.wind-rubber', objs: ['wind', 'rubber', 'record'], misc: 15 },
  { id: 'g3.sci.light-sound', objs: ['straight', 'warm', 'sound'], misc: 13 },
] as const;

/** 項目から使われている誤概念IDをすべて集める */
function misconceptionIdsOf(items: Item[]): Set<string> {
  const out = new Set<string>();
  const walk = (x: unknown) => {
    if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') {
      for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
        if (k === 'misconception' && typeof v === 'string') out.add(v);
        else if (k === 'reverseMisconception' && typeof v === 'string') out.add(v);
        else if (k === 'misconceptions' && v && typeof v === 'object' && !Array.isArray(v)) {
          for (const m of Object.values(v as Record<string, unknown>))
            if (typeof m === 'string') out.add(m);
        } else walk(v);
      }
    }
  };
  items.forEach(walk);
  return out;
}

describe('小3 P2 単元（物と重さ・風とゴムの力・光と音）', () => {
  for (const s of SPECS) {
    const u = unitOf(s.id);
    it(`${s.id}: 単元の形・到達項目・量`, () => {
      expect(u.priority).toBe('P2');
      expect(u.stage).toBe('g3');
      expect(u.domain).toBe('A-matter');
      expect(u.kind).toBe('inquiry');
      expect(u.objectives.map((o) => o.id)).toEqual(s.objs);
      const r = checkUnit(u);
      expect(r.errors).toEqual([]);
      for (const o of r.objectives) {
        expect(o.distinct, `${s.id} ${o.id} 練習`).toBeGreaterThanOrEqual(6);
        expect(o.alt, `${s.id} ${o.id} 別例`).toBeGreaterThanOrEqual(3);
      }
      expect(r.genericWrongShare).toBe(0);
      console.info(
        `${s.id}: ${r.objectives.map((o) => `${o.id}:${o.distinct}+${o.alt}`).join(' ')} / 誤概念 ${u.misconceptions.length}`,
      );
    });
    it(`${s.id}: 誤概念が設計の数で、定義した誤概念がすべて使われている`, () => {
      expect(u.misconceptions.length).toBe(s.misc);
      const used = misconceptionIdsOf(itemsOf(u));
      const unused = u.misconceptions.map((m) => m.id).filter((id) => !used.has(id));
      expect(unused).toEqual([]);
      const undefinedIds = [...used].filter((id) => !u.misconceptions.some((m) => m.id === id));
      expect(undefinedIds).toEqual([]);
    });
    it(`${s.id}: 紙をこがす手順を書いていない`, () => {
      for (const t of textsOf([u.intro, itemsOf(u)])) expect(t).not.toMatch(/こげ|こがす|燃/);
    });
  }

  it('graph の問題がある（風とゴムは3つ、光と音は1つ）', () => {
    const g = (id: string) =>
      itemsOf(unitOf(id))
        .filter((x) => x.engine === 'graph')
        .map((x) => x.id);
    expect(g('g3.sci.wind-rubber')).toEqual(['wd-graph-make', 'rb-graph-read', 'rc-graph-make']);
    expect(g('g3.sci.light-sound')).toEqual(['wm-graph-read']);
  });

  it('実験の表の例示が正しい向き', () => {
    const exps = (id: string) =>
      itemsOf(unitOf(id)).flatMap((x) => (x.engine === 'experiment' ? [x] : []));
    const rows = (id: string, itemId: string) => {
      const it = exps(id).find((x) => x.id === itemId);
      if (!it || it.setup.kind !== 'table') throw new Error(itemId);
      return it.setup.rows;
    };
    const num = (r: unknown) => Number(String(r).match(/\d+/)?.[0]);
    // ねんどは どの形でも 100g
    for (const r of rows('g3.sci.weight', 'wt-exp-clay')) expect(r.result).toBe('100g');
    // ゴム: 同じ本数で 5cm < 10cm < 15cm、本数が多いほど遠い
    const rub = rows('g3.sci.wind-rubber', 'rb-exp-stretch');
    const at = (s: string, c: string) =>
      num(rub.find((r) => r.when.stretch === s && r.when.count === c)?.result);
    for (const c of ['c1', 'c2']) {
      expect(at('s5', c)).toBeLessThan(at('s10', c));
      expect(at('s10', c)).toBeLessThan(at('s15', c));
    }
    for (const s of ['s5', 's10', 's15']) expect(at(s, 'c1')).toBeLessThan(at(s, 'c2'));
    // 風: なし < 弱い < 強い
    const w = rows('g3.sci.wind-rubber', 'wd-exp-wind').map((r) => num(r.result));
    expect(w[0]).toBeLessThan(w[1]!);
    expect(w[1]).toBeLessThan(w[2]!);
    // かがみ: 0 < 1 < 2 < 3 まいで 温度が上がる
    const t = rows('g3.sci.light-sound', 'wm-exp-mirrors').map((r) => num(r.result));
    for (let i = 1; i < t.length; i++) expect(t[i - 1]!).toBeLessThan(t[i]!);
  });

  it('安全の注意が おてほんに ある', () => {
    const intro = (id: string) =>
      unitOf(id)
        .intro.map((s) => s.text)
        .join(' ');
    expect(intro('g3.sci.light-sound')).toContain('直《ちょく》せつ 見《み》ない');
    expect(intro('g3.sci.light-sound')).toContain('顔《かお》や 服《ふく》に 当《あ》てない');
    expect(intro('g3.sci.wind-rubber')).toContain('切《き》れて あぶない');
  });

  it('誤概念の当てはめ（内容レビュー）', () => {
    const misOf = (id: string, wrong: string) => {
      const it = pack.units
        .flatMap(itemsOf)
        .find((x): x is ChoiceItem => x.id === id && x.engine === 'choice');
      if (!it) throw new Error(id);
      const o = it.options.find((x) => plain(x.label).includes(plain(wrong)));
      expect(o, `${id} ${wrong}`).toBeDefined();
      return o!.misconception;
    };
    expect(misOf('wt-split', '25g')).toBe('wt-thin-light');
    expect(misOf('wt-split', '400g')).toBe('wt-long-heavy');
    expect(misOf('wt-container', '120g')).toBe('wt-container');
    expect(misOf('wd-sail', '車の前から当てる')).toBe('wr-direction');
    expect(misOf('rb-feel', '小さくなる')).toBe('wr-short-far');
    expect(misOf('wm-why-mirrors', 'かがみじしんがあたたかいから')).toBe('ls-mirror-heat');
    expect(misOf('sd-travel', '空気の中しかつたわらない')).toBe('ls-air-only');
  });
});
