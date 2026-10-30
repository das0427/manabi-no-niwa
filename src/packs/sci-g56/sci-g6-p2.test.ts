import { describe, expect, it } from 'vitest';
import {
  checkUnit,
  misconceptionIdsOf,
  sampleItems,
  textsOf,
  unsafeSvgsOf,
} from '../../curriculum/qa';
import type { Item, UnitSpec } from '../../curriculum/types';
import pack from './index';

/** 小6 の P2 単元 5つ（設計書 docs/expansion/p2-design/sci-g6.md 6.3） */
const SPEC: Record<
  string,
  {
    domain: string;
    prereq: string[];
    objectives: string[];
    misconceptions: number;
    levels: [number, number, number];
  }
> = {
  'g6.sci.solutions': {
    domain: 'A-matter',
    prereq: [],
    objectives: ['litmus', 'inside', 'metal'],
    misconceptions: 15,
    levels: [9, 10, 8],
  },
  'g6.sci.body': {
    domain: 'B-life',
    prereq: ['g4.sci.body'],
    objectives: ['breath', 'digest', 'blood'],
    misconceptions: 19,
    levels: [10, 11, 6],
  },
  'g6.sci.plant-water': {
    domain: 'B-life',
    prereq: ['g5.sci.germination'],
    objectives: ['starch', 'path', 'transpire'],
    misconceptions: 21,
    levels: [9, 10, 8],
  },
  'g6.sci.ecosystem': {
    domain: 'B-life',
    prereq: [],
    objectives: ['food', 'air', 'water'],
    misconceptions: 19,
    levels: [9, 10, 8],
  },
  'g6.sci.strata': {
    domain: 'B-life',
    prereq: ['g5.sci.flowing-water'],
    objectives: ['layer', 'form', 'change'],
    misconceptions: 15,
    levels: [9, 10, 8],
  },
};
const IDS = Object.keys(SPEC);

const unitOf = (id: string): UnitSpec => {
  const u = pack.units.find((x) => x.id === id);
  if (!u) throw new Error(id);
  return u;
};
const itemsOf = (id: string): Item[] => {
  const u = unitOf(id);
  if (u.source.kind !== 'items') throw new Error(id);
  return u.source.items;
};
const item = (unitId: string, id: string): Item => {
  const it = itemsOf(unitId).find((x) => x.id === id);
  if (!it) throw new Error(`${unitId} ${id}`);
  return it;
};
const plain = (s: unknown) =>
  String(s)
    .replace(/《[^》]*》/g, '')
    .replace(/\s+/g, '');
const misOf = (unitId: string, id: string, label: string) => {
  const it = item(unitId, id);
  const options =
    it.engine === 'choice'
      ? it.options
      : it.engine === 'experiment' && it.task.kind === 'consider'
        ? it.task.options
        : null;
  if (!options) throw new Error(id);
  return options.find((o) => String(o.label).includes(label))?.misconception;
};

interface Row {
  when: Record<string, string>;
  result: string;
  key?: string;
}
/** 単元の experiment 問題から、条件の id の組が合う実験の表の行を取り出す */
function rowsOf(unitId: string, factorIds: string[], outputPart?: string): Row[] {
  for (const it of itemsOf(unitId)) {
    if (it.engine !== 'experiment') continue;
    const s = it.setup as unknown as {
      kind: string;
      factors: { id: string }[];
      output: string;
      rows: Row[];
    };
    if (s.kind !== 'table') continue;
    const ids = s.factors.map((f) => f.id);
    if (ids.length !== factorIds.length || !factorIds.every((f) => ids.includes(f))) continue;
    if (outputPart && !s.output.includes(outputPart)) continue;
    return s.rows;
  }
  throw new Error(`setup が無い: ${unitId} ${factorIds.join(',')}`);
}
const keysWhere = (rows: Row[], key: string) =>
  rows.filter((r) => r.key === key).map((r) => r.when);

describe('sci-g56 小6 P2 単元（設計書 sci-g6.md）', () => {
  it('5単元が 設計どおり パックに ある', () => {
    for (const id of IDS) {
      const u = unitOf(id);
      const s = SPEC[id]!;
      expect(u.priority, id).toBe('P2');
      expect(u.stage, id).toBe('g6');
      expect(u.kind, id).toBe('inquiry');
      expect(u.status, id).toBe('ready');
      expect(u.domain, id).toBe(s.domain);
      expect(u.prereq, id).toEqual(s.prereq);
      expect(
        u.objectives.map((o) => o.id),
        id,
      ).toEqual(s.objectives);
      expect(u.misconceptions.length, id).toBe(s.misconceptions);
      for (let l = 0; l < 3; l++)
        expect(itemsOf(id).filter((it) => it.level === l).length, `${id} 段階${l}`).toBe(
          s.levels[l]!,
        );
    }
  });

  it('各到達項目: 練習 6以上・別の表し方 3以上・27問', () => {
    for (const id of IDS) {
      const r = checkUnit(unitOf(id));
      expect(r.errors, id).toEqual([]);
      expect(itemsOf(id).length, id).toBe(27);
      for (const o of r.objectives) {
        expect(o.distinct, `${id} ${o.id}`).toBeGreaterThanOrEqual(6);
        expect(o.alt, `${id} ${o.id}`).toBeGreaterThanOrEqual(3);
      }
      console.info(
        `${id}: Q ${r.q.toFixed(2)} / C ${r.c[0]}/${r.c[1]} / 問 ${itemsOf(id).length} / 汎用誤答 ${(r.genericWrongShare * 100).toFixed(0)}% / 誤概念 ${unitOf(id).misconceptions.length} / ${r.objectives.map((o) => `${o.id}:${o.distinct}+${o.alt}`).join(' ')}`,
      );
    }
  });

  it('定義した 誤概念は 全部 どこかの 問題で 使われ、使った 誤概念は 全部 定義されている', () => {
    for (const id of IDS) {
      const defined = new Set(unitOf(id).misconceptions.map((m) => m.id));
      const used = new Set(misconceptionIdsOf(itemsOf(id)));
      // 変数のそろえ方の実験（control）の誤概念は misconceptions の値に入っている
      for (const it of itemsOf(id))
        if (it.engine === 'experiment' && it.misconceptions)
          for (const m of Object.values(it.misconceptions)) used.add(m as string);
      expect(
        [...defined].filter((m) => !used.has(m)),
        `${id} 未使用`,
      ).toEqual([]);
      expect(
        [...used].filter((m) => !defined.has(m)),
        `${id} 未定義`,
      ).toEqual([]);
    }
  });

  it('multi の 正解の 文が ③ヒントに 入っていない（6字以上）', () => {
    for (const id of IDS)
      for (const it of itemsOf(id)) {
        if (it.engine !== 'choice' || !it.multi) continue;
        const h3 = plain(it.hints[2]);
        for (const o of it.options)
          if (o.correct && plain(o.label).length >= 6)
            expect(h3, `${id} ${it.id}`).not.toContain(plain(o.label));
      }
  });

  it('エンジン: body・ecosystem の match、ecosystem の order', () => {
    for (const [u, ids] of [
      ['g6.sci.body', ['dg-alt-match', 'bl-alt-match']],
      ['g6.sci.ecosystem', ['fd-alt-match', 'wt-alt-match']],
    ] as const)
      for (const i of ids) expect(item(u, i).engine, i).toBe('match');
    for (const i of ['fd-order-land', 'fd-pond', 'wt-cycle-order'])
      expect(item('g6.sci.ecosystem', i).engine, i).toBe('order');
  });

  it('実験の 表の れい: 結果が 理科の 事実と 合っている', () => {
    // LITMUS: 酸性 × 青 → 赤、アルカリ性 × 赤 → 青、食塩水は どちらも かわらない
    const litmus = rowsOf('g6.sci.solutions', ['liquid', 'paper'], 'リトマス');
    expect(keysWhere(litmus, 'red')).toEqual([
      { liquid: 'hcl', paper: 'blue' },
      { liquid: 'soda', paper: 'blue' },
    ]);
    expect(keysWhere(litmus, 'blue')).toEqual([
      { liquid: 'lime', paper: 'red' },
      { liquid: 'ammonia', paper: 'red' },
    ]);
    expect(litmus.filter((r) => r.when.liquid === 'salt').map((r) => r.key)).toEqual([
      'none',
      'none',
    ]);
    for (const r of litmus) {
      expect(
        r.result.includes('赤色《あかいろ》に') && r.result.includes('青色《あおいろ》に'),
      ).toBe(false);
    }
    // EVAP
    const evap = rowsOf('g6.sci.solutions', ['liquid'], '蒸発');
    expect(keysWhere(evap, 'solid')).toEqual([{ liquid: 'salt' }, { liquid: 'lime' }]);
    // METAL
    const metal = rowsOf('g6.sci.solutions', ['liquid', 'metal']);
    expect(keysWhere(metal, 'melt')).toEqual([
      { liquid: 'hcl', metal: 'al' },
      { liquid: 'hcl', metal: 'fe' },
    ]);
    // LEAF
    const leaf = rowsOf('g6.sci.plant-water', ['cover', 'wait']);
    expect(keysWhere(leaf, 'starch')).toEqual([{ cover: 'off', wait: 'later' }]);
    // BAG
    const bag = rowsOf('g6.sci.plant-water', ['leaf', 'place']);
    expect(keysWhere(bag, 'few')).toEqual([
      { leaf: 'no', place: 'sun' },
      { leaf: 'no', place: 'shade' },
    ]);
    expect(keysWhere(bag, 'many')).toEqual([{ leaf: 'yes', place: 'sun' }]);
    // PLANT_AIR
    const air = rowsOf('g6.sci.ecosystem', ['plant', 'sun']);
    expect(keysWhere(air, 'same').every((w) => w.plant === 'no')).toBe(true);
    expect(keysWhere(air, 'o2up')).toEqual([{ plant: 'yes', sun: 'yes' }]);
    expect(keysWhere(air, 'resp')).toEqual([{ plant: 'yes', sun: 'no' }]);
    // SALIVA
    const saliva = rowsOf('g6.sci.body', ['liquid', 'temp']);
    expect(keysWhere(saliva, 'none')).toEqual([{ liquid: 'saliva', temp: 'body' }]);
  });

  it('内容レビュー: 誤概念の 付け方（再発防止）', () => {
    expect(misOf('g6.sci.solutions', 'lt-one-paper', '中性《ちゅうせい》だと きまる')).toBe(
      'sol-one-paper',
    );
    expect(misOf('g6.sci.solutions', 'in-ammonia', '何《なに》も とけて いなかった')).toBe(
      'sol-nothing',
    );
    expect(misOf('g6.sci.solutions', 'mt-where', '消《き》えて なくなった')).toBe(
      'sol-metal-vanish',
    );
    expect(misOf('g6.sci.body', 'br-o2-left', '0%')).toBe('bd-o2-zero');
    expect(misOf('g6.sci.body', 'dg-absorb', '大腸《だいちょう》')).toBe('bd-large-small');
    expect(misOf('g6.sci.body', 'bl-kidney', 'かん臓《ぞう》')).toBe('bd-liver-kidney');
    expect(misOf('g6.sci.plant-water', 'st-why-cover', '寒《さむ》さ')).toBe('pw-cover-why');
    expect(misOf('g6.sci.ecosystem', 'ai-dark', 'しない')).toBe('ec-plant-no-breath');
    expect(misOf('g6.sci.strata', 'ly-old', '上《うえ》')).toBe('st-old-top');
    expect(misOf('g6.sci.strata', 'ch-quake', '火山灰《かざんばい》')).toBe('st-quake-volcano');
  });

  it('安全・表現: 薬品・火の 手順を 書かない／赤と緑を 並べない／図は 文字を 描かない', () => {
    for (const id of IDS) {
      const u = unitOf(id);
      const all = [
        ...textsOf([u.intro, u.misconceptions]),
        ...itemsOf(id).flatMap((it) => textsOf(it)),
        ...sampleItems(u, 5).flatMap((it) => textsOf(it)),
      ];
      for (const t of all) {
        expect(t, id).not.toMatch(
          /においを かぐ|なめる|さわって|熱《ねっ》して|火《ひ》を|緑《みどり》/,
        );
      }
      expect(unsafeSvgsOf(itemsOf(id)), id).toEqual([]);
      const svgs = JSON.stringify(itemsOf(id)).match(/<svg[^]*?<\/svg>/g) ?? [];
      for (const s of svgs) {
        expect(s, id).not.toContain('<text');
        expect(s, id).not.toMatch(/(fill|stroke)="#/);
      }
    }
    const intro = (id: string) =>
      unitOf(id)
        .intro.map((s) => s.text)
        .join(' ');
    expect(intro('g6.sci.solutions')).toContain('目《め》や 手《て》に つくと あぶない');
    expect(intro('g6.sci.solutions')).toContain('先生《せんせい》と いっしょに');
    expect(intro('g6.sci.strata')).toContain('がけには 近《ちか》づきすぎないでね');
    expect(intro('g6.sci.ecosystem')).toContain('おとなと いっしょに');
    const pw = JSON.stringify(itemsOf('g6.sci.plant-water'));
    expect(pw).not.toContain('var(--leaf)');
  });
});
