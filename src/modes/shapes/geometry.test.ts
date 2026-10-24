import { describe, expect, it } from 'vitest';
import {
  dims,
  matches,
  nearSlot,
  outline,
  pointInPolygon,
  slotAt,
  snapTarget,
  SHAPES,
  SYMMETRY,
  turnsToMatch,
  type Piece,
  type Slot,
} from './geometry';

const none = new Set<number>();
const sq = (rot = 0, size = 20): Piece => ({ shape: 'square', size, rot });
const at = (shape: Piece['shape'], x: number, y: number, rot = 0, size = 20): Slot => ({
  shape,
  size,
  rot,
  x,
  y,
});
describe('回転対称の次数', () => {
  it('しかく=4、ながしかく=2、まる=∞、直角三角形=1、はんえん=1', () => {
    expect(SYMMETRY.square).toBe(4);
    expect(SYMMETRY.rect).toBe(2);
    expect(SYMMETRY.circle).toBe(Infinity);
    expect(SYMMETRY.rtriangle).toBe(1);
    expect(SYMMETRY.semicircle).toBe(1);
    expect(SYMMETRY.triangle).toBe(1);
    expect(SYMMETRY.heart).toBe(1);
  });
  it('全部の形に次数がある', () => {
    for (const s of SHAPES) expect(SYMMETRY[s], s).toBeGreaterThanOrEqual(1);
  });
});

describe('matches（形・大きさが同じで、回転差が対称角の倍数）', () => {
  it('しかく: 90° ごとにすべて一致', () => {
    for (const rot of [0, 90, 180, 270, 360, -90, 450]) {
      expect(matches(sq(rot), sq(0)), `rot=${rot}`).toBe(true);
    }
  });
  it('しかく: 45° は一致しない', () => {
    expect(matches(sq(45), sq(0))).toBe(false);
  });
  it('ながしかく: 180° は一致、90° と 270° は不一致', () => {
    const r = (rot: number): Piece => ({ shape: 'rect', size: 40, rot });
    expect(matches(r(180), r(0))).toBe(true);
    expect(matches(r(360), r(0))).toBe(true);
    expect(matches(r(90), r(0))).toBe(false);
    expect(matches(r(270), r(0))).toBe(false);
    expect(matches(r(0), r(90))).toBe(false);
    expect(matches(r(270), r(90))).toBe(true);
  });
  it('まる: どの向きでも一致（37° でも）', () => {
    const c = (rot: number): Piece => ({ shape: 'circle', size: 30, rot });
    expect(matches(c(37), c(0))).toBe(true);
    expect(matches(c(0), c(211))).toBe(true);
  });
  it('さんかく・ちょっかくさんかく・はんえん: 向きが同じときだけ一致', () => {
    for (const shape of ['triangle', 'rtriangle', 'semicircle', 'heart'] as const) {
      const p = (rot: number): Piece => ({ shape, size: 30, rot });
      expect(matches(p(0), p(0)), shape).toBe(true);
      expect(matches(p(360), p(0)), shape).toBe(true);
      for (const rot of [90, 180, 270])
        expect(matches(p(rot), p(0)), `${shape} ${rot}`).toBe(false);
    }
  });
  it('ほし: 90° 刻みでは 0° だけ（72° は一致）', () => {
    const s = (rot: number): Piece => ({ shape: 'star', size: 40, rot });
    expect(matches(s(0), s(0))).toBe(true);
    expect(matches(s(90), s(0))).toBe(false);
    expect(matches(s(72), s(0))).toBe(true);
  });
  it('形が違う・大きさが違うと不一致', () => {
    expect(
      matches({ shape: 'square', size: 20, rot: 0 }, { shape: 'rect', size: 20, rot: 0 }),
    ).toBe(false);
    expect(matches(sq(0, 20), sq(0, 21))).toBe(false);
    expect(matches(sq(0, 20), sq(90, 20))).toBe(true);
  });
  it('turnsToMatch: 時計回りに 90° ずつ回す回数', () => {
    const tri = (rot: number): Piece => ({ shape: 'triangle', size: 30, rot });
    expect(turnsToMatch(tri(0), tri(0))).toBe(0);
    expect(turnsToMatch(tri(270), tri(0))).toBe(1);
    expect(turnsToMatch(tri(180), tri(0))).toBe(2);
    expect(turnsToMatch(tri(90), tri(0))).toBe(3);
    expect(turnsToMatch(sq(0), sq(90))).toBe(0);
    expect(
      turnsToMatch({ shape: 'rect', size: 30, rot: 0 }, { shape: 'rect', size: 30, rot: 90 }),
    ).toBe(1);
    expect(turnsToMatch(sq(0, 20), sq(0, 30))).toBeNull();
  });
});

describe('snapTarget（盤面幅 20% 以内の一致する空きスロットで最も近いもの）', () => {
  const piece = sq();
  it('20 以内（19.9）は吸着、20.1 は吸着しない', () => {
    const slots = [at('square', 50, 50)];
    expect(snapTarget({ x: 69.9, y: 50 }, piece, slots, none)).toBe(0);
    expect(snapTarget({ x: 50, y: 29.9 }, piece, slots, none)).toBeNull();
    expect(snapTarget({ x: 70, y: 50 }, piece, slots, none)).toBe(0);
  });
  it('盤面の大きさに比例する（boardSize 50 なら 10）', () => {
    const slots = [at('square', 25, 25)];
    expect(snapTarget({ x: 34, y: 25 }, piece, slots, none, 50)).toBe(0);
    expect(snapTarget({ x: 36, y: 25 }, piece, slots, none, 50)).toBeNull();
  });
  it('一致しないスロットには吸着しない', () => {
    const slots = [at('circle', 50, 50), at('square', 80, 50)];
    expect(snapTarget({ x: 65, y: 50 }, piece, slots, none)).toBe(1);
    expect(
      snapTarget({ x: 52, y: 50 }, { shape: 'triangle', size: 20, rot: 0 }, slots, none),
    ).toBeNull();
  });
  it('向きが違うと吸着しない（かたちが合っても）', () => {
    const slots = [at('triangle', 50, 50)];
    expect(
      snapTarget({ x: 50, y: 50 }, { shape: 'triangle', size: 20, rot: 90 }, slots, none),
    ).toBeNull();
    expect(snapTarget({ x: 50, y: 50 }, { shape: 'triangle', size: 20, rot: 0 }, slots, none)).toBe(
      0,
    );
  });
  it('一致する空きスロットのうち最も近いもの', () => {
    const slots = [at('square', 30, 50), at('square', 60, 50)];
    expect(snapTarget({ x: 50, y: 50 }, piece, slots, none)).toBe(1);
    expect(snapTarget({ x: 40, y: 50 }, piece, slots, none)).toBe(0);
  });
  it('距離の差が 1% 未満なら番号の小さい方、1% 以上なら近い方', () => {
    const slots = [at('square', 40, 50), at('square', 60, 50)];
    // 中点: 同じ距離 → 0 番
    expect(snapTarget({ x: 50, y: 50 }, piece, slots, none)).toBe(0);
    // 差 0.8（1 未満）→ 0 番。1 番の方が近いが差が小さい
    expect(snapTarget({ x: 50.4, y: 50 }, piece, slots, none)).toBe(0);
    // 差 1.2（1 以上）→ 近い 1 番
    expect(snapTarget({ x: 50.6, y: 50 }, piece, slots, none)).toBe(1);
    // 逆順に並べても、小さい番号が選ばれる
    expect(snapTarget({ x: 50, y: 50 }, piece, [slots[1]!, slots[0]!], none)).toBe(0);
  });
  it('埋まったスロットは対象外', () => {
    const slots = [at('square', 40, 50), at('square', 60, 50)];
    expect(snapTarget({ x: 41, y: 50 }, piece, slots, new Set([0]))).toBe(1);
    expect(snapTarget({ x: 41, y: 50 }, piece, slots, new Set([0, 1]))).toBeNull();
  });
  it('同形同大のピースは、どのスロットにも入る（交換できる）', () => {
    const slots = [at('square', 30, 50), at('square', 70, 50)];
    const a = sq();
    const b = sq(180);
    expect(snapTarget({ x: 30, y: 50 }, a, slots, none)).toBe(0);
    expect(snapTarget({ x: 30, y: 50 }, b, slots, none)).toBe(0);
    expect(snapTarget({ x: 70, y: 50 }, a, slots, none)).toBe(1);
    expect(snapTarget({ x: 70, y: 50 }, b, slots, none)).toBe(1);
  });
});

describe('nearSlot / slotAt', () => {
  it('nearSlot は形を問わず 20% 以内の最も近い空きスロット', () => {
    const slots = [at('circle', 20, 20), at('triangle', 70, 70)];
    expect(nearSlot({ x: 30, y: 25 }, slots, none)).toBe(0);
    expect(nearSlot({ x: 50, y: 50 }, slots, none)).toBeNull();
    expect(nearSlot({ x: 30, y: 25 }, slots, new Set([0]))).toBeNull();
  });
  it('slotAt は輪郭の内側のスロット（中心から遠い角でも）', () => {
    const slots = [at('square', 50, 50, 0, 40)];
    expect(slotAt({ x: 69, y: 69 }, slots, none)).toBe(0);
    expect(slotAt({ x: 71, y: 50 }, slots, none)).toBeNull();
    expect(slotAt({ x: 60, y: 50 }, slots, new Set([0]))).toBeNull();
  });
  it('輪郭: 回転した ちょくかくさんかく の点の内外', () => {
    // rot=0: 直角は左下。右上は外
    const o0 = outline('rtriangle', 20, 0, 50, 50);
    expect(pointInPolygon({ x: 43, y: 57 }, o0)).toBe(true);
    expect(pointInPolygon({ x: 57, y: 43 }, o0)).toBe(false);
    // rot=180: 直角は右上
    const o180 = outline('rtriangle', 20, 180, 50, 50);
    expect(pointInPolygon({ x: 57, y: 43 }, o180)).toBe(true);
    expect(pointInPolygon({ x: 43, y: 57 }, o180)).toBe(false);
  });
});

describe('図形の寸法', () => {
  it('rect は縦横が入れ替わる', () => {
    expect(dims('rect', 40, 0)).toEqual({ w: 40, h: 20 });
    expect(dims('rect', 40, 90)).toEqual({ w: 20, h: 40 });
    expect(dims('triangle', 40, 0).h).toBeCloseTo(36);
  });
});

// ---------------------------------------------------------------- 教材
