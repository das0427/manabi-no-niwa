/**
 * 数直線の目もりの数を間引く（text-layout-fixes.md 第6回 W8）。
 * 数のラベルの幅の合計が線の長さを超えるときは、両端・印（▼）のある目もり・5 本ごと（それでも足りなければ
 * 10 本ごと）にだけ数を書く。間引いた目もりは線だけ残る。g4.math.rounding/7 では 6 けたの数が 11 個つながって読めなかった。
 */

/** 数直線の線の長さ（viewBox の単位。Figure.tsx の W − pad × 2） */
export const NUMBER_LINE_LENGTH = 920;

/** 数の 1 字の幅（字の大きさの倍率）と、となりとの間（字の大きさの倍率） */
const CHAR_W = 0.62;
const GAP = 0.4;

/**
 * labeled: 数を書く目もりの値。all: すべての目もり（5 本ごとの数え方の基準）。marks: 印。
 * fontSize: 数の字の大きさ（viewBox の単位。下限は 30 または --svg-floor）
 */
export function thinNumberLabels(
  labeled: number[],
  all: number[],
  marks: { at: number }[],
  fontSize: number,
  length = NUMBER_LINE_LENGTH,
): number[] {
  const fs = Math.max(30, fontSize);
  const width = (r: number) => String(r).length * fs * CHAR_W + fs * GAP;
  const fits = (list: number[]) => list.reduce((sum, r) => sum + width(r), 0) <= length;
  const marked = (r: number) => marks.some((m) => Math.abs(m.at - r) < 1e-6);
  let shown = labeled;
  for (const stride of [5, 10]) {
    if (fits(shown)) break;
    shown = labeled.filter((r) => {
      const i = all.indexOf(r);
      return i === 0 || i === all.length - 1 || marked(r) || i % stride === 0;
    });
  }
  return shown;
}
