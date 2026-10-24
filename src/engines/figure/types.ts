/**
 * 図の記述（データ）。教材パックは図をこの形で書き、描画は src/engines/figure/Figure.tsx が受け持つ。
 * 図・式・読み上げを同じ問題データから導く（curriculum-matrix 1.8-4）。
 * 色は DESINGN.md のトークンだけを使う（描画側で決める。データに色の値を書かない）。
 */
type RichText = string;

/** 強調の種類（描画側で色・模様に変換。色だけで区別しない） */
export type Tone = 'plain' | 'focus' | 'muted' | 'a' | 'b';

export type Figure =
  /** 大きな文字・式（例 "3 ＋ 5 ＝ {{}}"）。RichText */
  | { kind: 'text'; text: RichText; size?: 'm' | 'l' | 'xl' }
  /** 絵（IllustId）を count 個。並びは自動（10を超えると5ずつのまとまり） */
  | { kind: 'illust'; id: string; count?: number; tone?: Tone }
  /** ブロック（10の棒・1の粒）。frame: 10のわく */
  | { kind: 'blocks'; hundreds?: number; tens?: number; ones: number; frame?: boolean; tone?: Tone }
  /** テープ図 */
  | {
      kind: 'tape';
      parts: { length: number; label?: RichText; tone?: Tone }[];
      total?: RichText;
    }
  /** 数直線。marks の at は目盛りの値 */
  | {
      kind: 'numberline';
      min: number;
      max: number;
      step: number;
      minorStep?: number;
      labelEvery?: number;
      marks?: { at: number; label?: RichText; tone?: Tone }[];
      jump?: { from: number; to: number; label?: RichText };
    }
  /** アナログ時計 */
  | { kind: 'clock'; h: number; m: number; minuteNumbers?: boolean }
  /** 表 */
  | { kind: 'table'; header: RichText[]; rows: RichText[][] }
  /** 棒グラフ（scaleStep は目盛りの間隔） */
  | {
      kind: 'bar';
      labels: RichText[];
      values: number[];
      scaleStep: number;
      unit?: RichText;
    }
  /** 折れ線グラフ */
  | {
      kind: 'line';
      labels: RichText[];
      values: number[];
      scaleStep: number;
      min?: number;
      unit?: RichText;
    }
  /** 基本の図形（大きさは相対。辺の長さの文字や角の印を付けられる） */
  | {
      kind: 'shape';
      shape: 'circle' | 'triangle' | 'square' | 'rect' | 'polygon';
      /** polygon の頂点（0〜100 の座標） */
      points?: [number, number][];
      w?: number;
      h?: number;
      labels?: RichText[];
      tone?: Tone;
    }
  /** 横に並べる */
  | { kind: 'row'; items: Figure[]; gap?: number }
  /** 縦に並べる */
  | { kind: 'column'; items: Figure[]; gap?: number }
  /** パックが用意した SVG（viewBox 必須。色はトークン名の CSS 変数だけ: var(--ink) 等） */
  | { kind: 'svg'; markup: string; label: RichText };

export type FigureKind = Figure['kind'];
