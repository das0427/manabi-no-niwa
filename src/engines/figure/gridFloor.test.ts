import { describe, expect, it } from 'vitest';
import { GRID_CELL_MIN_U, cardRowSide, sizePackSvg } from './gridFloor';

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

/** 手順の札（prog-g16）: 24×28 の札が 27 おきに並ぶ */
const card = (x: number, y = 2, w = 24, h = 28) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="var(--white)"/>`;
const cardRow = (n: number) => Array.from({ length: n }, (_, i) => card(2 + i * 27)).join('');

describe('cardRowSide / sizePackSvg（X4: 札の列）', () => {
  it('同じ大きさの札が 3 つ以上、すき間が辺の半分以下で並ぶ図は札の列。短い辺を返す', () => {
    expect(cardRowSide(cardRow(12))).toBe(24);
    expect(cardRowSide(cardRow(3))).toBe(24);
    expect(cardRowSide(cardRow(2))).toBe(0);
  });
  it('くり返しの枠の中の札（y が数 u ずれる）も、x の順に並んでいれば札の列', () => {
    // g6.prog.efficient/9 の選択肢: 札 6・37・64・98（y は 6・10・10・6）。すき間 7・3・10 ≦ 12
    const nested = card(6, 6) + card(37, 10) + card(64, 10) + card(98, 6);
    expect(cardRowSide(nested)).toBe(24);
  });
  it('間をあけて置いた図形・細長い帯・縦に大きくずれたものは数えない', () => {
    // すき間 30 > 12（p5.think.pattern の「ちいさい しかく」のように間をあけて置く）
    const apart = [2, 56, 110].map((x) => card(x)).join('');
    expect(cardRowSide(apart)).toBe(0);
    // 辺の比が 1:2 を超える（枠・帯）
    const bars = [2, 40, 78].map((x) => card(x, 2, 36, 10)).join('');
    expect(cardRowSide(bars)).toBe(0);
    // 縦に高さの半分を超えてずれる（別の段）
    const stairs = card(2, 2) + card(29, 22) + card(56, 42);
    expect(cardRowSide(stairs)).toBe(0);
  });
  it('札の列の svg は width: auto と aspect-ratio（viewBox の縦横比）を書く（既定 23u の箱にしない）', () => {
    // g6.prog.efficient/11 の問題: viewBox 330×34・高さ 5u。23u の箱に描くと札が 1.49u、高さ × 縦横比（48.5u）なら 3.5u
    const r = sizePackSvg(svg('0 0 330 34', 5, cardRow(12)));
    expect(r.markup).toContain('width:auto;aspect-ratio:330 / 34;');
    expect(r.markup).toContain('height:calc(var(--u) * 5)');
  });
  it('高さの指定が無い・width を書いた札の列はそのまま', () => {
    const noH = `<svg viewBox="0 0 330 34" xmlns="http://www.w3.org/2000/svg">${cardRow(12)}</svg>`;
    expect(sizePackSvg(noH).markup).toBe(noH);
    const withW = `<svg viewBox="0 0 330 34" width="200" style="height:calc(var(--u) * 5)" xmlns="http://www.w3.org/2000/svg">${cardRow(12)}</svg>`;
    expect(sizePackSvg(withW).markup).toBe(withW);
  });
  it('選択肢の中（幅 11u）で札が 2.4u を下回り、1 列にしたほうが大きくなる札の列は wide（1.94u → 2.63u）', () => {
    // g6.prog.efficient/9: 136×42・高さ 6.5u。11u の幅なら札 24 × 11/136 = 1.94u、1 列（高さ 4.6u）なら 24 × 4.6/42 = 2.63u
    const nested = card(6, 6) + card(37, 10) + card(64, 10) + card(98, 6);
    const r = sizePackSvg(svg('0 0 136 42', 6.5, nested));
    expect(r.wide).toBe(true);
    expect(r.markup).toContain('aspect-ratio:136 / 42;');
  });
  it('選択肢の中でも札が 2.4u 以上なら wide にしない（幅 98 の札 3 枚は 2.69u。g5.prog.debug-plan/8 の C）', () => {
    const three = card(6, 6) + card(33, 6) + card(60, 6);
    expect(sizePackSvg(svg('0 0 98 42', 6.5, three)).wide).toBe(false);
  });
  it('盤（同じ正方形が 4 つ以上）は、札の列でなく盤の下限（W8）で幅を決める', () => {
    const board = Array.from({ length: 6 }, (_, i) => card(2 + i * 40, 2, 36, 36)).join('');
    const r = sizePackSvg(svg('0 0 244 42', 6.5, board));
    expect(r.markup).not.toContain('aspect-ratio');
  });
});
