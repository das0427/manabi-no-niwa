import { describe, expect, it } from 'vitest';
import { VOICE_CATALOG } from '../../voice/catalog/index';
import {
  generateRound,
  judge,
  orderKey,
  orderVoice,
  SHELF_SIZE,
  SHOP_ITEMS,
  totalOf,
} from './logic';

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

describe('generateRound（seed 1..200 × 全段階）', () => {
  for (const level of [0, 1, 2, 3]) {
    for (const size of [3, 4, 5]) {
      it(`S${level + 1} size=${size}`, () => {
        for (const seed of SEEDS) {
          const qs = generateRound(level, seed, size);
          const ctx = `level=${level} size=${size} seed=${seed}`;
          expect(qs, ctx).toHaveLength(size);
          expect(new Set(qs.map((q) => orderKey(q.lines))).size, ctx).toBe(size);
          for (const q of qs) {
            expect(q.shelf, ctx).toHaveLength(SHELF_SIZE);
            expect(new Set(q.shelf).size, ctx).toBe(SHELF_SIZE);
            for (const l of q.lines) expect(q.shelf, ctx).toContain(l.item);
            const total = totalOf(q.lines);
            if (level === 0) {
              expect(q.lines).toEqual([{ item: q.lines[0]!.item, count: 1 }]);
            } else if (level === 1) {
              expect(q.lines).toHaveLength(1);
              expect(total).toBeGreaterThanOrEqual(1);
              expect(total).toBeLessThanOrEqual(3);
            } else if (level === 2) {
              expect(q.lines).toHaveLength(1);
              expect(total).toBeLessThanOrEqual(5);
            } else {
              expect(q.lines).toHaveLength(2);
              expect(q.lines[0]!.item).not.toBe(q.lines[1]!.item);
              expect(total).toBeGreaterThanOrEqual(2);
              expect(total).toBeLessThanOrEqual(5);
              for (const l of q.lines) expect(l.count).toBeLessThanOrEqual(3);
            }
          }
        }
      });
    }
  }

  it('S3 では 1〜5 のすべての個数が出る（範囲を満たす）', () => {
    const seen = new Set<number>();
    for (const seed of SEEDS)
      for (const q of generateRound(2, seed, 4)) seen.add(q.lines[0]!.count);
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('棚の中の注文の位置が偏らない', () => {
    const pos = [0, 0, 0, 0];
    for (const seed of SEEDS) {
      for (const q of generateRound(1, seed, 4)) pos[q.shelf.indexOf(q.lines[0]!.item)]! += 1;
    }
    for (const p of pos) expect(p).toBe(200);
  });
});

describe('judge', () => {
  const order = [
    { item: 'apple' as const, count: 2 },
    { item: 'banana' as const, count: 1 },
  ];
  it('一致（順不同）', () => {
    expect(judge({ banana: 1, apple: 2 }, order).ok).toBe(true);
  });
  it('足りない', () => {
    expect(judge({ apple: 1, banana: 1 }, order).issues).toEqual([
      { kind: 'missing', item: 'apple', diff: 1 },
    ]);
  });
  it('多い', () => {
    expect(judge({ apple: 3, banana: 1 }, order).issues).toEqual([
      { kind: 'extra', item: 'apple', diff: 1 },
    ]);
  });
  it('違う品物を最初に知らせる', () => {
    const r = judge({ apple: 2, mikan: 1 }, order);
    expect(r.issues[0]).toEqual({ kind: 'wrong-item', item: 'mikan' });
    expect(r.issues[1]).toEqual({ kind: 'missing', item: 'banana', diff: 1 });
  });
  it('空のかご', () => {
    expect(judge({}, order).ok).toBe(false);
  });
});

describe('音声と表示の一致', () => {
  it('注文の読み上げキーがすべて台本にある', () => {
    for (const level of [0, 1, 2, 3]) {
      for (const seed of SEEDS.slice(0, 50)) {
        for (const q of generateRound(level, seed, 5)) {
          for (const k of orderVoice(q.lines)) expect(VOICE_CATALOG[k], k).toBeDefined();
        }
      }
    }
  });
  it('読み上げの個数が注文の個数と一致する', () => {
    const seq = orderVoice([
      { item: 'apple', count: 2 },
      { item: 'banana', count: 3 },
    ]);
    expect(seq).toEqual([
      'shop.item-wo.apple',
      'shop.count-to.2',
      'shop.item-wo.banana',
      'count.ko.3',
      'shop.kudasai',
    ]);
  });
  it('品物ごとの台本がある', () => {
    for (const i of SHOP_ITEMS) {
      expect(VOICE_CATALOG[`shop.item-wo.${i}`]).toBeDefined();
      expect(VOICE_CATALOG[`shop.item-ga.${i}`]).toBeDefined();
    }
  });
});
