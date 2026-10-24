import type { ReactElement } from 'react';

/**
 * イラスト1点の定義。
 * draw() は viewBox "0 0 100 100" の中身（<g> など）を返す。外側の <svg> は Illust 部品が付ける。
 * 画風は DESINGN.md 6章に従う（輪郭 #4A3B32 / 太さ 3.5 / 平塗り / グラデーションと影なし）。
 */
export interface IllustDef {
  id: string;
  /** 日本語の名前（aria-label と一覧表示に使う） */
  label: string;
  /** 'final' だけをアプリで使う。'draft' は一覧画面にだけ出る */
  status: 'final' | 'draft';
  draw: () => ReactElement;
}

export type IllustGroup = Record<string, IllustDef>;

/** 共通の色（DESINGN.md のトークンと同じ値。SVG 内では CSS 変数を使わず直接書く） */
export const INK = '#4A3B32';
export const STROKE = 3.5;
export const CHEEK = '#F2A99A';
export const HIGHLIGHT = '#FFFDF8';

/** 輪郭線の共通属性 */
export const line = {
  stroke: INK,
  strokeWidth: STROKE,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;
