import { describe, expect, it } from 'vitest';
import { dilate, floodMask, paintMask } from './fill';

const W = 40;
const H = 30;

/** 白い紙（不透明） */
function paper(): Uint8ClampedArray {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) d.set([255, 253, 248, 255], i * 4);
  return d;
}
function setPx(d: Uint8ClampedArray, x: number, y: number, rgba: number[]): void {
  d.set(rgba, (y * W + x) * 4);
}
/** 輪郭の四角（x0..x1, y0..y1）。閉じた形 */
function rectOutline(
  d: Uint8ClampedArray,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  c = [74, 59, 50, 255],
) {
  for (let x = x0; x <= x1; x++) {
    setPx(d, x, y0, c);
    setPx(d, x, y1, c);
  }
  for (let y = y0; y <= y1; y++) {
    setPx(d, x0, y, c);
    setPx(d, x1, y, c);
  }
}

describe('塗りつぶしの境界（review-1 #2）', () => {
  it('閉じた形の中だけを塗る（外へ流れない）', () => {
    const d = paper();
    rectOutline(d, 5, 5, 20, 15);
    const m = floodMask(d, W, H, 10, 10)!;
    expect(m.count).toBe(14 * 9); // 内側 6..19 × 6..14
    expect(m.mask[2 * W + 2]).toBe(0); // 外側
    expect([m.x0, m.y0, m.x1, m.y1]).toEqual([6, 6, 19, 14]);
  });

  it('輪郭（はんこ・図形の線を含む合成画像）は境界になり、外側を塗ると内側に入らない', () => {
    const d = paper();
    rectOutline(d, 5, 5, 20, 15);
    const m = floodMask(d, W, H, 1, 1)!;
    expect(m.mask[10 * W + 10]).toBe(0);
    expect(m.count).toBe(W * H - 16 * 11);
  });

  it('アンチエイリアスの淡いふちは許容値で境界として残る', () => {
    const d = paper();
    rectOutline(d, 5, 5, 20, 15);
    // 線の内側に淡い（紙に近い）ふち
    for (let x = 6; x <= 19; x++) setPx(d, x, 6, [230, 225, 220, 255]);
    const m = floodMask(d, W, H, 10, 10, 40)!;
    expect(m.mask[6 * W + 10]).toBe(1); // 紙に近いふちは塗る
    const strict = floodMask(d, W, H, 10, 10, 0)!;
    expect(strict.mask[6 * W + 10]).toBe(0);
  });

  it('1画素広げて、線との間にすき間を残さない', () => {
    const d = paper();
    rectOutline(d, 5, 5, 20, 15);
    const m = dilate(floodMask(d, W, H, 10, 10)!, 1);
    expect(m.mask[5 * W + 10]).toBe(1); // 輪郭の画素まで（下に重ねる）
    expect(m.mask[4 * W + 10]).toBe(0); // 外へは出ない
    expect([m.x0, m.y0, m.x1, m.y1]).toEqual([5, 5, 20, 15]);
  });

  it('切れ目のある形は外へつながる（見たまま）', () => {
    const d = paper();
    rectOutline(d, 5, 5, 20, 15);
    setPx(d, 12, 5, [255, 253, 248, 255]);
    const m = floodMask(d, W, H, 10, 10)!;
    expect(m.mask[0]).toBe(1);
  });

  it('範囲外の点は null', () => {
    expect(floodMask(paper(), W, H, -1, 3)).toBeNull();
    expect(floodMask(paper(), W, H, W, 3)).toBeNull();
  });

  it('印の範囲に色を書く', () => {
    const d = paper();
    rectOutline(d, 5, 5, 20, 15);
    const m = floodMask(d, W, H, 10, 10)!;
    const region = new Uint8ClampedArray((m.x1 - m.x0 + 1) * (m.y1 - m.y0 + 1) * 4);
    paintMask(region, m, '#2F6FC0');
    expect([...region.slice(0, 4)]).toEqual([0x2f, 0x6f, 0xc0, 255]);
  });
});
