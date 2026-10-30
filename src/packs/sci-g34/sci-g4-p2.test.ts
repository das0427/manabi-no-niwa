/**
 * sci-g34 の 4年 P2 単元（temperature・body・seasons-life・rainwater）だけの追加の検査。
 * 設計: docs/expansion/p2-design/sci-g4.md 6章。パック全体の検査は sci-g34.test.ts（index.ts に足せば自動で入る）。
 */
import { describe, expect, it } from 'vitest';
import { checkUnit, textsOf } from '../../curriculum/qa';
import type { ChoiceItem, Item, UnitSpec } from '../../curriculum/types';
import pack from './index';

const IDS = [
  'g4.sci.temperature',
  'g4.sci.body',
  'g4.sci.seasons-life',
  'g4.sci.rainwater',
] as const;

const DOMAIN: Record<string, string> = {
  'g4.sci.temperature': 'A-matter',
  'g4.sci.body': 'B-life',
  'g4.sci.seasons-life': 'B-life',
  'g4.sci.rainwater': 'B-life',
};
const PREREQ: Record<string, string[]> = {
  'g4.sci.temperature': ['g4.sci.air-water'],
  'g4.sci.body': [],
  'g4.sci.seasons-life': ['g3.sci.living-things'],
  'g4.sci.rainwater': [],
};

const unitOf = (id: string): UnitSpec => {
  const u = pack.units.find((x) => x.id === id);
  if (!u) throw new Error(id);
  return u;
};
const itemsOf = (u: UnitSpec): Item[] => (u.source.kind === 'items' ? u.source.items : []);
const allItems = (): Item[] => IDS.flatMap((id) => itemsOf(unitOf(id)));
const plain = (t: unknown): string =>
  typeof t === 'string' ? t.replace(/《[^》]*》/g, '').replace(/[\s「」、。（）]/g, '') : '';
const find = (id: string): Item => {
  const it = allItems().find((x) => x.id === id);
  if (!it) throw new Error(id);
  return it;
};
/** 選択肢（choice と experiment の consider） */
const optionsOf = (id: string) => {
  const it = find(id);
  if (it.engine === 'choice') return it.options;
  if (it.engine === 'experiment' && it.task.kind === 'consider') return it.task.options;
  if (it.engine === 'graph' && it.task.kind === 'choice') return it.task.options;
  throw new Error(`${id} に選択肢が無い`);
};
const misOf = (id: string, wrong: string) => {
  const o = optionsOf(id).find((x) => plain(x.label).includes(plain(wrong)));
  expect(o, `${id} ${wrong}`).toBeDefined();
  return o!.misconception;
};
const rightOf = (id: string) => plain(optionsOf(id).find((o) => o.correct)?.label);

describe('sci-g34 4年 P2（temperature・body・seasons-life・rainwater）', () => {
  it('4単元が パックに あり、形が 設計どおり', () => {
    for (const id of IDS) {
      const u = unitOf(id);
      expect(u.priority, id).toBe('P2');
      expect(u.status, id).toBe('ready');
      expect(u.stage, id).toBe('g4');
      expect(u.subject, id).toBe('sci');
      expect(u.domain, id).toBe(DOMAIN[id]);
      expect(u.prereq, id).toEqual(PREREQ[id]);
      expect(u.review, id).toBe(id === 'g4.sci.seasons-life' ? 'view' : 'objective');
    }
  });

  it('量: Q 1 以上・到達項目 3/3・各到達項目に 練習6と別例3・各段階に 9問・汎用誤答 0%', () => {
    for (const id of IDS) {
      const u = unitOf(id);
      const r = checkUnit(u);
      expect(r.errors, id).toEqual([]);
      expect(r.q, id).toBeGreaterThanOrEqual(1);
      expect(r.c, id).toEqual([3, 3]);
      expect(r.genericWrongShare, id).toBe(0);
      expect(r.objectives.length, id).toBe(3);
      for (const o of r.objectives) {
        expect(o.distinct, `${id} ${o.id}`).toBe(6);
        expect(o.alt, `${id} ${o.id}`).toBe(3);
      }
      for (let level = 0; level < 3; level++)
        expect(itemsOf(u).filter((it) => it.level === level).length, `${id} 段階${level}`).toBe(9);
      expect(itemsOf(u).length, id).toBe(27);
    }
  });

  it('誤概念の 数は 設計どおり（temperature 10・body 12・seasons-life 7・rainwater 7）', () => {
    expect(unitOf('g4.sci.temperature').misconceptions.length).toBe(10);
    expect(unitOf('g4.sci.body').misconceptions.length).toBe(12);
    expect(unitOf('g4.sci.seasons-life').misconceptions.length).toBe(7);
    expect(unitOf('g4.sci.rainwater').misconceptions.length).toBe(7);
  });

  it('誤りの 選択肢の 誤概念が 中身と 合って いる', () => {
    expect(misOf('tv-dent-ball', '空気が ふえた')).toBe('tm-amount');
    expect(misOf('mt-slant', '上の ほうへだけ')).toBe('tm-metal-up');
    expect(misOf('fl-room', 'ゆかの 近く')).toBe('tm-updown');
    expect(misOf('mu-bend-inner', '外がわの きん肉')).toBe('bd-swap');
    expect(misOf('mu-stretch', '内がわの きん肉')).toBe('bd-swap');
    expect(misOf('mu-knee', 'ももの 前がわの きん肉')).toBe('bd-swap');
    expect(misOf('sa-frog', 'みんな しんで いなくなる')).toBe('ss-die');
    expect(misOf('rs-exp-soil', 'つぶが 小さいほど はやく しみこむ')).toBe('rw-small-fast');
    expect(misOf('rw-tray', '右が 高く なって いる')).toBe('rw-uphill');
    const ins = find('sa-insect-sort');
    if (ins.engine !== 'sort') throw new Error('sa-insect-sort');
    for (const c of ins.cards)
      for (const w of c.wrongBoxes ?? [])
        expect(w.misconception, plain(c.label)).toBe('ss-one-way');
  });

  it('事実の 向き（取り違えの 防止）', () => {
    expect(rightOf('mu-bend-inner')).toBe('内がわの きん肉'.replace(/\s/g, ''));
    expect(rightOf('mu-stretch')).toBe('外がわの きん肉'.replace(/\s/g, ''));
    expect(rightOf('tv-exp-degree')).toBe('空気');
    expect(rightOf('mt-mid')).toContain('まん中から');
    expect(rightOf('fl-first-warm')).toBe('上の ほう'.replace(/\s/g, ''));
    expect(rightOf('fl-cool-air')).toBe('下の ほう'.replace(/\s/g, ''));
    expect(rightOf('rw-tray')).toBe('右が 低く なって いる'.replace(/\s/g, ''));
    expect(rightOf('rw-puddle')).toBe('まわりより 低い 所'.replace(/\s/g, ''));
    expect(rightOf('st-graph-high')).toBe('8月');
    expect(rightOf('st-rise')).toBe('4月から 8月'.replace(/\s/g, ''));

    const reach = find('rs-reach-fast');
    if (reach.engine !== 'experiment' || reach.setup.kind !== 'table')
      throw new Error('rs-reach-fast');
    expect(reach.task).toEqual({ kind: 'reach', target: 'fast' });
    const rows = reach.setup.rows;
    expect(rows.filter((r) => r.key === 'fast').map((r) => r.when)).toEqual([{ soil: 'gravel' }]);
    const secs = (soil: string) =>
      Number(rows.find((r) => r.when.soil === soil)!.result.match(/（(\d+)秒/)?.[1]);
    expect(secs('gravel')).toBeLessThan(secs('sand'));
    expect(secs('sand')).toBeLessThan(secs('clay'));

    // 気温のちがい（8月28℃ − 12月8℃ ＝ 20）
    const diff = find('st-diff');
    if (diff.engine !== 'graph' || diff.task.kind !== 'number') throw new Error('st-diff');
    const v = diff.data.values;
    expect(diff.task.fields[0]!.answer).toEqual({ kind: 'int', value: v[2]! - v[4]! });
  });

  it('記号だけの 選択肢（sa-card・rs-svg-grains）は あいう順で、正解が 先頭に ならない', () => {
    for (const id of ['sa-card', 'rs-svg-grains']) {
      const it = find(id) as ChoiceItem;
      const labels = it.options.map((o) => (typeof o.label === 'string' ? o.label : ''));
      expect(labels, id).toEqual([...labels].sort((a, b) => a.localeCompare(b, 'ja')));
      expect(it.options[0]?.correct, id).toBeFalsy();
      expect(rightOf(id), id).toBe('い');
    }
  });

  it('記録の 問いかけ（explain）は 採点しない（いつも 正解）', () => {
    for (const id of ['sa-record', 'st-explain-compare']) expect(find(id).engine).toBe('explain');
  });

  it('文に「火」「骨」「筋」「卵」「砂」を 使っていない', () => {
    for (const id of IDS) {
      const u = unitOf(id);
      const all = textsOf([u.title, u.intro, u.misconceptions, u.objectives, itemsOf(u)]);
      for (const t of all) expect(t, id).not.toMatch(/[火骨筋卵砂]/);
    }
  });
});
