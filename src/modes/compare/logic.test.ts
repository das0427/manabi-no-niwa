import { describe, expect, it } from 'vitest';
import { vocab, type VocabId } from '../../content/vocab';
import { getIllust } from '../../illust/registry';
import { VOICE_CATALOG } from '../../voice/catalog/index';
import {
  cardBoxes,
  doneVoice,
  generateRound,
  hintVoice,
  itemBoxes,
  judgeOrder,
  judgePair,
  PAD,
  questionKey,
  questionVoice,
  slotBoxes,
  SIZE_THINGS,
  COUNT_THINGS,
  type CompareQuestion,
  type OrderQuestion,
  type PairQuestion,
} from './logic';

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
const LEVELS = [0, 1, 2, 3, 4];
const SIZES = [3, 4, 5];

function each(fn: (qs: CompareQuestion[], ctx: string, level: number, size: number) => void) {
  for (const level of LEVELS) {
    for (const size of SIZES) {
      it(`P${level + 1} size=${size}`, () => {
        for (const seed of SEEDS) {
          const qs = generateRound(level, seed, size);
          fn(qs, `level=${level} size=${size} seed=${seed}`, level, size);
        }
      });
    }
  }
}

describe('generateRound（seed 1..200 × 全段階 × 3/4/5問）', () => {
  each((qs, ctx, level, size) => {
    expect(qs, ctx).toHaveLength(size);
    // 1回の中で同じ問題を出さない
    expect(new Set(qs.map(questionKey)).size, ctx).toBe(size);
    // 問いの向きは半々（偏りは 1 以内）
    const more = qs.filter((q) => q.ask === 'more').length;
    expect(Math.abs(more - (size - more)), ctx).toBeLessThanOrEqual(1);
    for (const q of qs) expect(q.level, ctx).toBe(level);
  });
});

describe('2択（P1〜P3）', () => {
  for (const level of [0, 1, 2]) {
    it(`P${level + 1} の差の下限と正解`, () => {
      for (const seed of SEEDS) {
        for (const size of SIZES) {
          const qs = generateRound(level, seed, size) as PairQuestion[];
          const ctx = `level=${level} seed=${seed} size=${size}`;
          const kind = (['size', 'length', 'count'] as const)[level];
          const ans: number[] = [];
          for (const q of qs) {
            expect(q.type, ctx).toBe('pair');
            expect(q.kind, ctx).toBe(kind);
            expect(q.withSame, ctx).toBe(false);
            const [a, b] = q.values;
            const hi = Math.max(a, b);
            const lo = Math.min(a, b);
            if (kind === 'count') {
              expect(hi - lo, ctx).toBeGreaterThanOrEqual(2);
              expect(lo, ctx).toBeGreaterThanOrEqual(1);
              expect(hi, ctx).toBeLessThanOrEqual(6);
            } else {
              expect(hi / lo, ctx).toBeGreaterThanOrEqual(1.6);
            }
            // 正解は問いの向きの側
            const want = q.ask === 'more' ? hi : lo;
            expect(q.values[q.answer as 0 | 1], ctx).toBe(want);
            expect(judgePair(q, q.answer), ctx).toBe(true);
            expect(judgePair(q, 1 - q.answer), ctx).toBe(false);
            ans.push(q.answer);
          }
          // 正解位置が偏らない
          const left = ans.filter((x) => x === 0).length;
          expect(Math.abs(left - (ans.length - left)), ctx).toBeLessThanOrEqual(1);
          for (let i = 2; i < ans.length; i++)
            expect(ans[i] === ans[i - 1] && ans[i] === ans[i - 2], ctx).toBe(false);
        }
      }
    });
  }

  it('物は vocab の絵（final）。大きさ・数の物が10種', () => {
    for (const id of [...SIZE_THINGS, ...COUNT_THINGS]) {
      expect(vocab(id as VocabId).label).toBeTruthy();
      expect(getIllust(id)?.status, id).toBe('final');
    }
    expect(SIZE_THINGS).toHaveLength(10);
    expect(COUNT_THINGS).toHaveLength(10);
  });
});

describe('P4（3択）', () => {
  it('回ごとに量の種類は1つ。「おなじ」は回の 1/3 前後で完全に同じ', () => {
    const kindsSeen = new Set<string>();
    for (const seed of SEEDS) {
      for (const size of SIZES) {
        const qs = generateRound(3, seed, size) as PairQuestion[];
        const ctx = `seed=${seed} size=${size}`;
        expect(new Set(qs.map((q) => q.kind)).size, ctx).toBe(1);
        kindsSeen.add(qs[0]!.kind);
        const same = qs.filter((q) => q.answer === 2);
        expect(same.length, ctx).toBe(Math.max(1, Math.round(size / 3)));
        for (const q of qs) {
          expect(q.withSame, ctx).toBe(true);
          expect(q.labels, ctx).toBe(true);
          if (q.answer === 2) {
            expect(q.values[0], ctx).toBe(q.values[1]);
            // 描画寸法も完全に同じ
            const [ca, cb] = cardBoxes(q);
            const a = itemBoxes(q.kind, q.values[0], ca!, false);
            const b = itemBoxes(q.kind, q.values[1], cb!, false);
            expect(
              a.map((x) => [x.w, x.h]),
              ctx,
            ).toEqual(b.map((x) => [x.w, x.h]));
            expect(judgePair(q, 2), ctx).toBe(true);
            expect(judgePair(q, 0), ctx).toBe(false);
          } else {
            const hi = Math.max(...q.values);
            const lo = Math.min(...q.values);
            if (q.kind === 'count') expect(hi - lo, ctx).toBeGreaterThanOrEqual(2);
            else expect(hi / lo, ctx).toBeGreaterThanOrEqual(1.6);
            expect(q.values[q.answer as 0 | 1], ctx).toBe(q.ask === 'more' ? hi : lo);
          }
        }
        // 「おなじ」でない問題の正解位置が偏らない
        const pos = qs.filter((q) => q.answer !== 2).map((q) => q.answer);
        const left = pos.filter((x) => x === 0).length;
        expect(Math.abs(left - (pos.length - left)), ctx).toBeLessThanOrEqual(1);
      }
    }
    expect([...kindsSeen].sort()).toEqual(['count', 'length', 'size']);
  });
});

describe('P5（3つを並べる）', () => {
  it('隣どうしの差、正解の順が一意、並びが最初から正解ではない', () => {
    const kinds = new Set<string>();
    for (const seed of SEEDS) {
      for (const size of SIZES) {
        const qs = generateRound(4, seed, size) as OrderQuestion[];
        const ctx = `seed=${seed} size=${size}`;
        // 1回の中は1種類の量
        expect(new Set(qs.map((q) => q.kind)).size, ctx).toBe(1);
        for (const q of qs) {
          kinds.add(q.kind);
          expect(q.type, ctx).toBe('order');
          const sorted = [...q.values].sort((a, b) => a - b);
          expect(new Set(q.values).size, ctx).toBe(3);
          for (let i = 1; i < 3; i++) {
            if (q.kind === 'length') {
              expect(sorted[i]! / sorted[i - 1]!, ctx).toBeGreaterThanOrEqual(1.4);
            } else {
              expect(sorted[i]! - sorted[i - 1]!, ctx).toBeGreaterThanOrEqual(1);
              expect(sorted[2], ctx).toBeLessThanOrEqual(6);
            }
          }
          // 量の順に並べた正解
          const want = q.order.map((d) => q.values[d]!);
          const expected = q.ask === 'more' ? [...sorted].reverse() : sorted;
          expect(want, ctx).toEqual(expected);
          expect([...q.order].sort(), ctx).toEqual([0, 1, 2]);
          // 正解の順は一意（ほかの5通りは不正解）
          const perms = [
            [0, 1, 2],
            [0, 2, 1],
            [1, 0, 2],
            [1, 2, 0],
            [2, 0, 1],
            [2, 1, 0],
          ];
          expect(
            perms.filter((p) => judgeOrder(q, p)),
            ctx,
          ).toEqual([q.order]);
          expect(judgeOrder(q, [q.order[0], q.order[1]]), ctx).toBe(false);
          expect(
            q.order.every((d, s) => d === s),
            ctx,
          ).toBe(false);
        }
        // 長さ・数が混ざる
      }
    }
    expect([...kinds].sort()).toEqual(['count', 'length']);
  });
});

describe('描画寸法は問題データと一致（同じ座標系）', () => {
  it('2択・3択: 大きさ・長さの比、数の個数、左端、物の大きさ', () => {
    for (const level of [0, 1, 2, 3]) {
      for (const seed of SEEDS) {
        const qs = generateRound(level, seed, 5) as PairQuestion[];
        for (const q of qs) {
          const ctx = `level=${level} seed=${seed} ${questionKey(q)}`;
          const [ca, cb] = cardBoxes(q);
          expect(ca!.w, ctx).toBe(cb!.w);
          expect(ca!.h, ctx).toBe(cb!.h);
          expect(ca!.y, ctx).toBe(cb!.y);
          const a = itemBoxes(q.kind, q.values[0], ca!, false);
          const b = itemBoxes(q.kind, q.values[1], cb!, false);
          if (q.kind === 'size') {
            expect(a[0]!.w / b[0]!.w, ctx).toBeCloseTo(q.values[0] / q.values[1], 9);
            expect(a[0]!.h / b[0]!.h, ctx).toBeCloseTo(q.values[0] / q.values[1], 9);
            expect(a[0]!.w, ctx).toBe(a[0]!.h);
            // 物がカードに収まる
            for (const [bx, c] of [
              [a[0]!, ca!],
              [b[0]!, cb!],
            ] as const) {
              expect(bx.x, ctx).toBeGreaterThanOrEqual(c.x);
              expect(bx.x + bx.w, ctx).toBeLessThanOrEqual(c.x + c.w);
              expect(bx.y, ctx).toBeGreaterThanOrEqual(c.y);
              expect(bx.y + bx.h, ctx).toBeLessThanOrEqual(c.y + c.h);
            }
          } else if (q.kind === 'length') {
            expect(a[0]!.w / b[0]!.w, ctx).toBeCloseTo(q.values[0] / q.values[1], 9);
            // 同じ幅（太さ）で、左端をそろえる
            expect(a[0]!.h, ctx).toBe(b[0]!.h);
            expect(a[0]!.x - ca!.x, ctx).toBe(b[0]!.x - cb!.x);
            expect(a[0]!.x - ca!.x, ctx).toBe(PAD);
            expect(a[0]!.x + a[0]!.w, ctx).toBeLessThanOrEqual(ca!.x + ca!.w);
          } else {
            expect(a.length, ctx).toBe(q.values[0]);
            expect(b.length, ctx).toBe(q.values[1]);
            // 物の大きさが同じ・同じ間隔（同じ格子の先頭から並べる）
            const all = [...a, ...b];
            expect(new Set(all.map((x) => `${x.w}x${x.h}`)).size, ctx).toBe(1);
            const n = Math.min(a.length, b.length);
            for (let i = 0; i < n; i++) {
              expect(a[i]!.x - ca!.x, ctx).toBe(b[i]!.x - cb!.x);
              expect(a[i]!.y - ca!.y, ctx).toBe(b[i]!.y - cb!.y);
            }
            for (const [list, c] of [
              [a, ca!],
              [b, cb!],
            ] as const)
              for (const bx of list) {
                expect(bx.x, ctx).toBeGreaterThanOrEqual(c.x);
                expect(bx.x + bx.w, ctx).toBeLessThanOrEqual(c.x + c.w);
                expect(bx.y + bx.h, ctx).toBeLessThanOrEqual(c.y + c.h);
              }
          }
        }
      }
    }
  });

  it('P5: 3つが同じ倍率で、カードにもマスにも収まる', () => {
    const slots = slotBoxes();
    for (const seed of SEEDS) {
      for (const q of generateRound(4, seed, 5) as OrderQuestion[]) {
        const ctx = `seed=${seed} ${questionKey(q)}`;
        const cards = cardBoxes(q);
        const sorted = [0, 1, 2].map((d) => q.values[d]!);
        const boxes = cards.map((c, d) => itemBoxes(q.kind, sorted[d]!, c, true));
        const inSlots = slots.map((s, d) => itemBoxes(q.kind, sorted[d]!, s, true));
        for (let d = 0; d < 3; d++) {
          for (const [list, c] of [
            [boxes[d]!, cards[d]!],
            [inSlots[d]!, slots[d]!],
          ] as const)
            for (const bx of list) {
              expect(bx.x, ctx).toBeGreaterThanOrEqual(c.x);
              expect(bx.x + bx.w, ctx).toBeLessThanOrEqual(c.x + c.w);
              expect(bx.y, ctx).toBeGreaterThanOrEqual(c.y);
              expect(bx.y + bx.h, ctx).toBeLessThanOrEqual(c.y + c.h);
            }
        }
        if (q.kind === 'length') {
          expect(boxes[1]![0]!.w / boxes[0]![0]!.w, ctx).toBeCloseTo(sorted[1]! / sorted[0]!, 9);
          expect(boxes[2]![0]!.w / boxes[1]![0]!.w, ctx).toBeCloseTo(sorted[2]! / sorted[1]!, 9);
          for (const b of boxes) expect(b[0]!.h, ctx).toBe(boxes[0]![0]!.h);
          for (let d = 0; d < 3; d++) expect(boxes[d]![0]!.x - cards[d]!.x, ctx).toBe(PAD);
        } else {
          expect(
            boxes.map((b) => b.length),
            ctx,
          ).toEqual(sorted);
          expect(new Set(boxes.flat().map((x) => x.w)).size, ctx).toBe(1);
        }
      }
    }
  });
});

describe('音声キー', () => {
  it('問題文・ヒント・完了の音声が台本にある', () => {
    for (const level of LEVELS) {
      for (const seed of SEEDS.slice(0, 40)) {
        const qs = generateRound(level, seed, 5);
        for (const q of qs) {
          for (const k of [...questionVoice(q), hintVoice(q, 1), hintVoice(q, 2)])
            expect(VOICE_CATALOG[k], k).toBeTruthy();
        }
        expect(VOICE_CATALOG[doneVoice(qs)], doneVoice(qs)).toBeTruthy();
      }
    }
  });
});
