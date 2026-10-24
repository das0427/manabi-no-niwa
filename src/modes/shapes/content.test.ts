import { describe, expect, it } from 'vitest';
import { PALETTE_VALUES } from '../../illust/palette';
import {
  K1_CARDS,
  K2_PICTURES,
  K3_PICTURES,
  K4_PICTURES,
  K5_PICTURES,
  type Picture,
} from './content';
import {
  BOARD,
  assign,
  dims,
  overlapArea,
  SHAPES,
  turnsToMatch,
  type Piece,
  type Slot,
} from './geometry';

// ---------------------------------------------------------------- 教材
function boxOf(s: Slot) {
  const d = dims(s.shape, s.size, s.rot);
  return { x0: s.x - d.w / 2, x1: s.x + d.w / 2, y0: s.y - d.h / 2, y1: s.y + d.h / 2 };
}

const ALL_PICTURES: [string, readonly Picture[]][] = [
  ['K2', K2_PICTURES],
  ['K3', K3_PICTURES],
  ['K4', K4_PICTURES],
  ['K5', K5_PICTURES],
];

describe('教材の数', () => {
  it('K1 8形、K2 8絵、K3 6絵、K4 6絵、K5 6絵', () => {
    expect(K1_CARDS).toHaveLength(8);
    expect(K1_CARDS.map((c) => c.shape).sort()).toEqual([...SHAPES].sort());
    expect(K2_PICTURES).toHaveLength(8);
    expect(K3_PICTURES).toHaveLength(6);
    expect(K4_PICTURES).toHaveLength(6);
    expect(K5_PICTURES).toHaveLength(6);
  });
  it('絵の ID と名前は重ならない', () => {
    const all = ALL_PICTURES.flatMap(([, list]) => list);
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
    expect(new Set(all.map((p) => p.name)).size).toBe(all.length);
  });
  it('K2 は 2〜3 ピース＋余り1、K3 は 4＋余り1、K4 は 2〜3、K5 は 3〜4（余りなし）', () => {
    for (const p of K2_PICTURES) {
      expect(p.slots.length, p.id).toBeGreaterThanOrEqual(2);
      expect(p.slots.length, p.id).toBeLessThanOrEqual(3);
      expect(p.spare, p.id).toBeDefined();
    }
    for (const p of K3_PICTURES) {
      expect(p.slots.length, p.id).toBe(4);
      expect(p.spare, p.id).toBeDefined();
    }
    for (const p of K4_PICTURES) {
      expect(p.slots.length, p.id).toBeGreaterThanOrEqual(2);
      expect(p.slots.length, p.id).toBeLessThanOrEqual(3);
      expect(p.spare, p.id).toBeUndefined();
    }
    for (const p of K5_PICTURES) {
      expect(p.slots.length, p.id).toBeGreaterThanOrEqual(3);
      expect(p.slots.length, p.id).toBeLessThanOrEqual(4);
      expect(p.spare, p.id).toBeUndefined();
    }
  });
});

describe.each(ALL_PICTURES)('%s の絵', (name, list) => {
  for (const pic of list) {
    describe(pic.id, () => {
      it('盤面の中に収まり、ピースどうしが重ならない', () => {
        for (const s of pic.slots) {
          const b = boxOf(s);
          expect(b.x0, `${pic.id} x0`).toBeGreaterThanOrEqual(1);
          expect(b.x1, `${pic.id} x1`).toBeLessThanOrEqual(BOARD - 1);
          expect(b.y0, `${pic.id} y0`).toBeGreaterThanOrEqual(1);
          expect(b.y1, `${pic.id} y1`).toBeLessThanOrEqual(BOARD - 1);
        }
        for (let i = 0; i < pic.slots.length; i++) {
          for (let j = i + 1; j < pic.slots.length; j++) {
            expect(overlapArea(pic.slots[i]!, pic.slots[j]!), `${pic.id} ${i}-${j}`).toBeLessThan(
              25,
            );
          }
        }
      });
      it('ピースは押しやすい大きさ（短い辺が 16 以上）で、色はパレットの色', () => {
        const pieces: Piece[] = [...pic.slots, ...(pic.spare ? [pic.spare] : [])];
        for (const p of pieces) {
          const d = dims(p.shape, p.size, p.rot);
          expect(Math.min(d.w, d.h), `${pic.id} ${p.shape}`).toBeGreaterThanOrEqual(16 - 1e-9);
        }
        for (const s of pic.slots) expect(PALETTE_VALUES, pic.id).toContain(s.color.toUpperCase());
      });
      it('ほし・ハートは使わない（K1 のみ）', () => {
        for (const s of pic.slots) expect(['star', 'heart'], pic.id).not.toContain(s.shape);
        if (pic.spare) expect(['star', 'heart']).not.toContain(pic.spare.shape);
      });
      it('余りのピースはどのスロットにも入らない', () => {
        if (!pic.spare) return;
        for (const s of pic.slots) {
          expect(pic.spare.shape === s.shape && pic.spare.size === s.size, pic.id).toBe(false);
        }
      });
      it(name === 'K4' ? '回転が必要なピースがあり、回す回数は 2 回まで' : '回転は要らない', () => {
        const pieces: Piece[] = pic.slots.map((s) => ({
          shape: s.shape,
          size: s.size,
          rot: s.from ?? s.rot,
        }));
        const turns = pic.slots.map((s, i) => turnsToMatch(pieces[i]!, s));
        if (name === 'K4') {
          expect(
            turns.some((t) => t !== null && t > 0),
            pic.id,
          ).toBe(true);
          for (const t of turns) {
            expect(t, pic.id).not.toBeNull();
            expect(t!, pic.id).toBeLessThanOrEqual(2);
          }
        } else {
          expect(
            pic.slots.some((s) => s.from !== undefined),
            pic.id,
          ).toBe(false);
          expect(
            turns.every((t) => t === 0),
            pic.id,
          ).toBe(true);
          expect(assign(pieces, pic.slots, true), pic.id).not.toBeNull();
        }
      });
    });
  }
});

describe('K1 の形', () => {
  for (const card of K1_CARDS) {
    it(`${card.shape}: 候補にできる形は 2 つ以上あり、自分自身と重ならない`, () => {
      expect(card.distractors.length).toBeGreaterThanOrEqual(2);
      expect(card.distractors).not.toContain(card.shape);
      expect(new Set(card.distractors).size).toBe(card.distractors.length);
      expect(PALETTE_VALUES).toContain(card.color.toUpperCase());
    });
  }
  it('まぎらわしい組（さんかく↔ちょっかくさんかく、まる↔はんえん、しかく↔ながしかく）は候補にしない', () => {
    const pairs: [string, string][] = [
      ['triangle', 'rtriangle'],
      ['circle', 'semicircle'],
      ['square', 'rect'],
    ];
    for (const [a, b] of pairs) {
      for (const [x, y] of [
        [a, b],
        [b, a],
      ] as const) {
        const card = K1_CARDS.find((c) => c.shape === x)!;
        expect(card.distractors as readonly string[], `${x}→${y}`).not.toContain(y);
      }
    }
  });
});

// ---------------------------------------------------------------- 生成
