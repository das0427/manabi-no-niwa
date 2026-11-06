import { describe, expect, it } from 'vitest';
import { GRID_CELL_MIN_U, sizePackSvg } from './gridFloor';

const cells = (n: number, size = 36) =>
  `<rect x="4" y="4" width="${size}" height="${size}" fill="none"/>`.repeat(n);
const svg = (vb: string, hU: number, body: string) =>
  `<svg viewBox="${vb}" style="height:calc(var(--u) * ${hU})" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

describe('sizePackSvg（W8: プログラムの図の大きさの下限）', () => {
  it('1 ますが 2.4u に届かない盤は、幅と高さを広げる（g3.prog.decompose/30 の盤は 9u 前後）', () => {
    const r = sizePackSvg(svg('0 0 224 188', 7.8, cells(30)));
    // 1 ます 36 を 2.4u × 1.02 にする: 幅 224 × 2.448 ÷ 36 = 15.2u、高さ 188 × 2.448 ÷ 36 = 12.8u
    expect(r.markup).toContain('calc(var(--u) * 15.2)');
    expect(r.markup).toContain('calc(var(--u) * 12.8)');
    expect(r.markup).toContain('max(calc(var(--u) * 7.8)');
    expect(r.wide).toBe(false);
    expect(GRID_CELL_MIN_U).toBe(2.4);
  });
  it('1 ますが十分大きい盤・盤でない図はそのまま', () => {
    const big = svg('0 0 80 80', 10, cells(4));
    expect(sizePackSvg(big).markup).toBe(big);
    const few = svg('0 0 224 188', 7.8, cells(3));
    expect(sizePackSvg(few).markup).toBe(few);
  });
  it('縦横比が 4:1 を超え、字を含む図は wide', () => {
    const txt = '<text x="10" y="30">1</text>';
    expect(sizePackSvg(svg('0 0 244 42', 6.5, txt)).wide).toBe(true);
    expect(sizePackSvg(svg('0 0 152 42', 4.5, txt)).wide).toBe(false);
    // 字の無い横長の図（分数の帯など）は 1 列にしない
    expect(sizePackSvg(svg('0 0 244 42', 6.5, '<g/>')).wide).toBe(false);
  });
});
