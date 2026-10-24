import { describe, expect, it } from 'vitest';
import { VOICE_CATALOG } from '../../voice/catalog/index';
import {
  generateRound,
  groupOf,
  isFinishedPick,
  orderLength,
  PLACE_COUNT,
  POOL,
  CHOICE_COUNTS,
  type MemQuestion,
} from './logic';

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
const LEVELS = [0, 1, 2, 3, 4, 5];

describe('generateRound（seed 1..200 × 全段階 × 3/4/5問）', () => {
  for (const level of LEVELS) {
    for (const size of [3, 4, 5]) {
      it(`B${level + 1} size=${size}`, () => {
        for (const seed of SEEDS) {
          const ctx = `level=${level} size=${size} seed=${seed}`;
          const qs = generateRound(level, seed, size);
          expect(qs, ctx).toHaveLength(size);
          const answers = qs.flatMap((q) => q.answer);
          expect(new Set(answers).size, `${ctx} 答えの重複`).toBe(answers.length);
          for (const q of qs) check(level, q, ctx);
        }
      });
    }
  }
});

function check(level: number, q: MemQuestion, ctx: string) {
  if (level <= 2) {
    const n = CHOICE_COUNTS[level]!;
    const need = level === 2 ? 2 : 1;
    expect(q.kind, ctx).toBe('pick');
    expect(q.choices, ctx).toHaveLength(n);
    expect(new Set(q.choices).size, ctx).toBe(n);
    expect(q.answer, ctx).toHaveLength(need);
    expect(
      q.choices.filter((c) => q.answer.includes(c)),
      ctx,
    ).toHaveLength(need);
    const ag = new Set(q.answer.map(groupOf));
    for (const c of q.choices) {
      if (!q.answer.includes(c))
        expect(ag.has(groupOf(c)), `${ctx} 誤りが同じグループ`).toBe(false);
    }
    expect(isFinishedPick(q, q.answer), ctx).toBe(true);
    expect(isFinishedPick(q, [q.answer[0]!]), ctx).toBe(need === 1);
    expect([...q.shown].sort(), ctx).toEqual([...q.answer].sort());
  } else if (level === 3) {
    expect(q.kind, ctx).toBe('place');
    expect(q.shown).toHaveLength(1);
    expect(q.pos, ctx).toBeGreaterThanOrEqual(0);
    expect(q.pos, ctx).toBeLessThan(PLACE_COUNT);
    expect(q.choices, ctx).toHaveLength(0);
  } else {
    expect(q.kind, ctx).toBe('order');
    expect(q.answer, ctx).toHaveLength(orderLength(level));
    expect(q.shown, ctx).toEqual(q.answer);
    expect([...q.choices].sort(), ctx).toEqual([...q.answer].sort());
    expect(q.choices, ctx).not.toEqual(q.answer);
  }
}

describe('偏り', () => {
  it('B1〜B3 の正解位置（最初の答え）の出現回数の差は 1 以下', () => {
    for (const level of [0, 1, 2]) {
      const n = CHOICE_COUNTS[level]!;
      for (const seed of SEEDS) {
        const qs = generateRound(level, seed, 5);
        const cnt = Array<number>(n).fill(0);
        qs.forEach((q) => (cnt[q.choices.indexOf(q.answer[0]!)]! += 1));
        expect(
          Math.max(...cnt) - Math.min(...cnt),
          `level=${level} seed=${seed}`,
        ).toBeLessThanOrEqual(1);
      }
    }
  });
  it('B4 の場所は均等で、同じ場所が3回続かない', () => {
    const total = [0, 0, 0];
    for (const seed of SEEDS) {
      const ps = generateRound(3, seed, 4).map((q) => q.pos!);
      ps.forEach((p) => (total[p]! += 1));
      for (let i = 2; i < ps.length; i++) {
        expect(ps[i] === ps[i - 1] && ps[i] === ps[i - 2], `seed=${seed}`).toBe(false);
      }
    }
    expect(Math.max(...total) - Math.min(...total)).toBeLessThan(80);
  });
  it('全段階で 40 点すべての絵が答えとして出る', () => {
    const seen = new Set<string>();
    for (const level of LEVELS)
      for (const seed of SEEDS)
        for (const q of generateRound(level, seed, 5)) q.answer.forEach((a) => seen.add(a));
    expect(seen.size).toBe(POOL.length);
    expect(POOL.length).toBeGreaterThanOrEqual(40);
  });
});

describe('音声', () => {
  it('絵ごとの「いちばん」の台本がある', () => {
    for (const id of POOL) expect(VOICE_CATALOG[`mem.first.${id}`], id).toBeDefined();
    for (const g of ['food', 'animal', 'vehicle', 'thing']) {
      expect(VOICE_CATALOG[`mem.group.${g}`], g).toBeDefined();
    }
  });
});
