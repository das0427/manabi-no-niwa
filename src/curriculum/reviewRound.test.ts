import { describe, expect, it } from 'vitest';
import { buildReviewRound, emptyHistory, representationOf, reviewHistoryOf } from './reviewRound';
import type { ChoiceItem, Item, UnitSpec } from './types';
import { addBasic } from '../packs/g1-math/add-basic';

/** 架空の問題（choice）。id の「:」より前が表現の種類 */
function q(
  id: string,
  opts: { alt?: boolean; level?: number; identity?: string } = {},
): ChoiceItem {
  return {
    engine: 'choice',
    id,
    objective: 'o1',
    level: opts.level ?? 0,
    prompt: 'どれ？',
    hints: ['ひんと1', 'ひんと2', 'ひんと3'],
    explain: 'かいせつ',
    identity: opts.identity ?? id,
    ...(opts.alt ? { alt: true } : {}),
    options: [{ label: 'あ', correct: true }, { label: 'い' }],
  };
}

function unitOf(items: Item[]): UnitSpec {
  return {
    id: 'g1.test.dummy',
    title: 'ためし',
    stage: 'g1',
    subject: 'math',
    domain: 'A',
    kind: 'calc',
    priority: 'P1',
    status: 'ready',
    icon: 'apple',
    prereq: [],
    objectives: [{ id: 'o1', title: 'もくひょう' }],
    misconceptions: [],
    levels: [{ label: 'ひとつ', chance: 0.5 }],
    intro: [],
    source: { kind: 'items', items },
    review: 'type',
    basis: 'テスト',
    revised: '2026-10-30',
  };
}

const ITEMS: Item[] = [
  q('base:1'),
  q('base:2'),
  q('base:3'),
  q('base:4'),
  q('story:1', { alt: true }),
  q('story:2', { alt: true }),
  q('pic:1', { alt: true }),
  q('pic:2', { alt: true }),
];

describe('表現のキー', () => {
  it('エンジン・別例の印・id の「:」より前で区別する', () => {
    expect(representationOf(q('story:1', { alt: true }))).toBe('choice|alt|story');
    expect(representationOf(q('base:9'))).toBe('choice|base|base');
    // 「:」の無い手作りの問題はエンジンと別例の印だけ
    expect(representationOf(q('danger-koe'))).toBe('choice|base|');
    expect(representationOf(q('danger-alt-s2', { alt: true }))).toBe('choice|alt|');
  });
});

describe('復習の記録の読み取り', () => {
  it('同じ単元の、時刻より前の記録だけを集める', () => {
    const h = reviewHistoryOf(
      [
        { unitId: 'u1', itemKey: 'a:1', at: 100, detail: { identity: 'ia', rep: 'choice|alt|a' } },
        { unitId: 'u1', itemKey: 'b:1', at: 300, detail: { identity: 'ib', rep: 'choice|alt|b' } },
        { unitId: 'u2', itemKey: 'c:1', at: 100, detail: { identity: 'ic', rep: 'choice|alt|c' } },
        { unitId: 'u1', itemKey: 'd:1', at: 50 },
      ],
      'u1',
      200,
    );
    expect([...h.itemIds].sort()).toEqual(['a:1', 'd:1']);
    expect([...h.identities]).toEqual(['ia']);
    expect([...h.reps]).toEqual(['choice|alt|a']);
  });
});

describe('復習の回の問題', () => {
  it('別例の問題を優先し、同じ回で同じ表現を続けない', () => {
    for (let seed = 0; seed < 30; seed++) {
      const out = buildReviewRound(unitOf(ITEMS), {
        level: 0,
        seed,
        count: 3,
        history: emptyHistory,
      });
      expect(out).toHaveLength(3);
      expect(out.every((it) => it.alt)).toBe(true);
      // 別例の表現は2種。1問目と2問目は違う表現
      expect(representationOf(out[0]!)).not.toBe(representationOf(out[1]!));
      expect(new Set(out.map((it) => it.identity)).size).toBe(3);
    }
  });

  it('前に見た表現より、まだ見ていない表現を先に出す（記録の表現のキーから）', () => {
    const history = reviewHistoryOf(
      [{ unitId: 'g1.test.dummy', itemKey: 'x', at: 1, detail: { rep: 'choice|alt|story' } }],
      'g1.test.dummy',
      10,
    );
    for (let seed = 0; seed < 30; seed++) {
      const out = buildReviewRound(unitOf(ITEMS), { level: 0, seed, count: 3, history });
      expect(out[0]!.id.startsWith('pic:')).toBe(true);
    }
  });

  it('表現のキーの無い前の記録（2.0 まで）からも、見た問題の表現を見たことにする', () => {
    const history = reviewHistoryOf(
      [{ unitId: 'g1.test.dummy', itemKey: 'pic:2', at: 1, detail: { identity: 'pic:2' } }],
      'g1.test.dummy',
      10,
    );
    for (let seed = 0; seed < 30; seed++) {
      const out = buildReviewRound(unitOf(ITEMS), { level: 0, seed, count: 3, history });
      expect(out[0]!.id.startsWith('story:')).toBe(true);
      // 同じ表現の中では、まだ見ていない問題を先に出す
      expect(out[1]!.id).toBe('pic:1');
    }
  });

  it('別例の無い単元でも問題数だけ出す', () => {
    const items = [q('a:1'), q('a:2'), q('b:1'), q('b:2')];
    const out = buildReviewRound(unitOf(items), {
      level: 0,
      seed: 5,
      count: 3,
      history: emptyHistory,
    });
    expect(out).toHaveLength(3);
    expect(new Set(out.map((it) => it.identity)).size).toBe(3);
  });

  it('同じ seed と記録からは同じ回を作る（中断・再開）', () => {
    const opt = { level: 0, seed: 42, count: 3, history: emptyHistory };
    const a = buildReviewRound(unitOf(ITEMS), opt).map((it) => it.id);
    const b = buildReviewRound(unitOf(ITEMS), opt).map((it) => it.id);
    expect(a).toEqual(b);
  });

  it('生成器の単元（小1 たしざん）でも、最上段の別例の問題を出す', () => {
    const unit = addBasic;
    const top = unit.levels.length - 1;
    for (let seed = 0; seed < 20; seed++) {
      const out = buildReviewRound(unit, { level: top, seed, count: 3, history: emptyHistory });
      expect(out).toHaveLength(3);
      expect(out.every((it) => it.alt === true)).toBe(true);
      expect(out.every((it) => it.level === top)).toBe(true);
      expect(new Set(out.map(representationOf)).size).toBeGreaterThanOrEqual(2);
    }
  });
});
