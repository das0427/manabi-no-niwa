import { describe, expect, it } from 'vitest';
import { balancedPositions, createRng, hashSeed, placeAt } from './rng';

describe('createRng', () => {
  it('同じ seed なら同じ列', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 20; i++) expect(a.next()).toBe(b.next());
  });

  it('int は範囲内で全値が出る', () => {
    const r = createRng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = r.int(1, 5);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    expect(seen.size).toBe(5);
  });

  it('shuffle は要素を保つ', () => {
    const r = createRng(7);
    expect(r.shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });

  it('sample は重複しない', () => {
    const r = createRng(3);
    const s = r.sample([1, 2, 3, 4, 5, 6], 4);
    expect(new Set(s).size).toBe(4);
  });

  it('hashSeed は決定的', () => {
    expect(hashSeed('shopping', 1)).toBe(hashSeed('shopping', 1));
    expect(hashSeed('shopping', 1)).not.toBe(hashSeed('shopping', 2));
  });
});

describe('balancedPositions', () => {
  for (const choices of [2, 3, 4]) {
    for (const count of [3, 4, 5, 10]) {
      it(`choices=${choices} count=${count}: 偏りなし・3連続なし（seed 1..200）`, () => {
        for (let seed = 1; seed <= 200; seed++) {
          const pos = balancedPositions(count, choices, createRng(seed));
          expect(pos).toHaveLength(count);
          const counts = Array.from(
            { length: choices },
            (_, i) => pos.filter((p) => p === i).length,
          );
          expect(Math.max(...counts) - Math.min(...counts), `seed=${seed}`).toBeLessThanOrEqual(1);
          for (let i = 2; i < pos.length; i++) {
            expect(pos[i] === pos[i - 1] && pos[i] === pos[i - 2], `seed=${seed}`).toBe(false);
          }
        }
      });
    }
  }
});

describe('placeAt', () => {
  it('答えを指定位置に置く', () => {
    const r = createRng(5);
    for (let i = 0; i < 3; i++) {
      const out = placeAt('A', ['B', 'C'], i, r);
      expect(out[i]).toBe('A');
      expect(out).toHaveLength(3);
    }
  });
});
