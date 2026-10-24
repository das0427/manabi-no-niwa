/**
 * 道具の設定値（色・太さ・はんこの大きさ・図形の既定）と、入力の判定（純粋な関数）。
 * 色数・太さの段数の正本は ux-by-age.md 1章（review-1 #29）:
 *   かんたん 2〜3歳: 色6・太さ2 ／ 4歳以上: 色8・太さ3 ／ くわしく: 色24・太さ5段
 * 作品の色は自由（DESINGN.md 3.1 X-CL-05）。真っ黒は使わない（くろ は こげ茶に近い黒）。
 */
import type { ShapeKind } from './model';

export interface DrawColor {
  id: string;
  /** 色の名前（読み上げ・aria-label） */
  name: string;
  hex: string;
}

const C = (id: string, name: string, hex: string): DrawColor => ({ id, name, hex });

export const COLORS_6: DrawColor[] = [
  C('red', 'あか', '#D9433A'),
  C('yellow', 'きいろ', '#F2C230'),
  C('green', 'みどり', '#4E9A3E'),
  C('blue', 'あお', '#2F6FC0'),
  C('brown', 'ちゃいろ', '#8A5A2E'),
  C('black', 'くろ', '#2E2622'),
];

export const COLORS_8: DrawColor[] = [
  C('red', 'あか', '#D9433A'),
  C('orange', 'だいだい', '#EE8A2A'),
  C('yellow', 'きいろ', '#F2C230'),
  C('green', 'みどり', '#4E9A3E'),
  C('blue', 'あお', '#2F6FC0'),
  C('purple', 'むらさき', '#7B4FA6'),
  C('brown', 'ちゃいろ', '#8A5A2E'),
  C('black', 'くろ', '#2E2622'),
];

export const COLORS_24: DrawColor[] = [
  C('red', 'あか', '#D9433A'),
  C('darkred', 'こいあか', '#A3262A'),
  C('pink', 'ももいろ', '#F28DA8'),
  C('lightpink', 'うすもも', '#F9C9D4'),
  C('orange', 'だいだい', '#EE8A2A'),
  C('skin', 'はだいろ', '#F5CBA0'),
  C('yellow', 'きいろ', '#F2C230'),
  C('lemon', 'れもんいろ', '#F7E569'),
  C('yellowgreen', 'きみどり', '#9CCB4A'),
  C('green', 'みどり', '#4E9A3E'),
  C('darkgreen', 'ふかみどり', '#2C6B33'),
  C('teal', 'あおみどり', '#2A8C88'),
  C('sky', 'みずいろ', '#7CC4EA'),
  C('blue', 'あお', '#2F6FC0'),
  C('navy', 'こん', '#25336B'),
  C('purple', 'むらさき', '#7B4FA6'),
  C('lavender', 'ふじいろ', '#B8A2D9'),
  C('brown', 'ちゃいろ', '#8A5A2E'),
  C('lightbrown', 'うすちゃ', '#C79A6A'),
  C('gold', 'こがね', '#C9A227'),
  C('gray', 'はいいろ', '#9AA3A8'),
  C('darkgray', 'こいはいいろ', '#5E6468'),
  C('white', 'しろ', '#FFFDF8'),
  C('black', 'くろ', '#2E2622'),
];

/** 線の太さ（論理座標の px。1600×1000 の作品に対して） */
export const WIDTHS_2 = [10, 28];
export const WIDTHS_3 = [8, 18, 36];
export const WIDTHS_5 = [4, 8, 16, 28, 48];
export const ERASER_SCALE = 2;

export type ToolMode = 'simple' | 'detailed';

export function palette(mode: ToolMode, toddler: boolean): DrawColor[] {
  if (mode === 'detailed') return COLORS_24;
  return toddler ? COLORS_6 : COLORS_8;
}

export function widths(mode: ToolMode, toddler: boolean): number[] {
  if (mode === 'detailed') return WIDTHS_5;
  return toddler ? WIDTHS_2 : WIDTHS_3;
}

/** はんこの大きさ（小・中・大。一辺の論理 px） */
export const STAMP_SIZES = [120, 200, 320] as const;
export const STAMP_ROTATE_STEP = 45;

/** 図形の既定の大きさ（論理 px） */
export function defaultShapeSize(shape: ShapeKind): { w: number; h: number } {
  switch (shape) {
    case 'ellipse':
      return { w: 320, h: 200 };
    case 'line':
      return { w: 320, h: 40 };
    default:
      return { w: 240, h: 240 };
  }
}
export const SHAPE_STROKES = [6, 14, 26];

/** 大きさの倍率（おおきく／ちいさく）と範囲 */
export const SCALE_STEP = 1.25;
export const MIN_SIZE = 40;
export const MAX_SIZE = 1400;
export function scaled(v: number, up: boolean): number {
  return Math.round(Math.min(MAX_SIZE, Math.max(MIN_SIZE, up ? v * SCALE_STEP : v / SCALE_STEP)));
}

/** 矢印札で動かす量（論理 px。くわしく） */
export const NUDGE = 40;

/** ペンを使っている間（最後のペン入力から 1 秒）は、指の入力を描画に使わない（architecture.md 7.2） */
export const PEN_GUARD_MS = 1000;

export type PointerKind = 'mouse' | 'pen' | 'touch';

/**
 * その押下を無視するか（R#7）:
 * - isPrimary でない（2本目の指など）は無視（描いている線はそのまま続ける）
 * - マウスの左ボタン以外は無視
 * - ペンを使ってから 1 秒以内の指は無視（手のひらの接触）
 */
export function ignorePointerDown(
  e: { isPrimary: boolean; pointerType: string; button: number },
  now: number,
  lastPenAt: number,
): boolean {
  if (!e.isPrimary) return true;
  if (e.pointerType === 'mouse' && e.button !== 0) return true;
  if (e.pointerType === 'touch' && now - lastPenAt < PEN_GUARD_MS) return true;
  return false;
}
