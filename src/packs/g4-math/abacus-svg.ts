/**
 * そろばんの図（SVG）と、数字の列の操作。図は「けたごとの数字の列」から作る
 * （図・式・読み上げを同じデータから導く: curriculum-matrix 1.8-4）。
 * 同じ中身を g3-math と g4-math に置く（パックは他のパックを import しない）。
 * 文字（漢字）は SVG に描かない。色は CSS 変数だけ。
 * 設計: docs/expansion/p2-design/math-g34.md 1章。
 */
import type { Figure } from '../../engines/figure/types';

/** 1本のけたの珠: 五だまが はりに ついているか、はりに ついた 一だまの数（0〜4） */
export function beadsOf(d: number): { five: boolean; ones: number } {
  if (!Number.isInteger(d) || d < 0 || d > 9) throw new Error(`そろばんの数字は 0〜9: ${d}`);
  return { five: d >= 5, ones: d % 5 };
}
export function digitOf(b: { five: boolean; ones: number }): number {
  return (b.five ? 5 : 0) + b.ones;
}

/** rods: けたの数。unitRod: 一の位のけたの番号（左から0始まり）。小数のけた数は rods - 1 - unitRod */
export interface AbacusLayout {
  rods: number;
  unitRod: number;
}
/** 整数7けた＋小数2けた（読む・計算。▲は左から7本め） */
export const G4_READ: AbacusLayout = { rods: 9, unitRod: 6 };
/** 選択肢用。整数4けた＋小数2けた */
export const G4_SET: AbacusLayout = { rods: 6, unitRod: 3 };
/** 4けたまでの計算・導入・選択肢 */
export const G4_SMALL: AbacusLayout = { rods: 4, unitRod: 3 };

/**
 * 値を、けたの数字の列にする。units は「最小のけたの単位」の整数（小数1けたなら 23.5 → 235）。
 * 戻り値: 左から rods 個の数字（0〜9）。入りきらないときは throw（生成器の誤り）
 */
export function rodDigits(layout: AbacusLayout, units: number): number[] {
  if (!Number.isInteger(units) || units < 0 || units >= 10 ** layout.rods)
    throw new Error(`そろばんに入らない数: ${units}`);
  return String(units).padStart(layout.rods, '0').split('').map(Number);
}
/** 入らない数（負・大きすぎ）は null */
export function rodDigitsOrNull(layout: AbacusLayout, units: number): number[] | null {
  return Number.isInteger(units) && units >= 0 && units < 10 ** layout.rods
    ? rodDigits(layout, units)
    : null;
}
/** 数字の列を、最小のけたの単位の整数に戻す */
export function valueOf(digits: number[]): number {
  return Number(digits.join(''));
}

/** そろばんの図（Figure の kind 'svg'） */
export function abacusFig(
  layout: AbacusLayout,
  digits: number[],
  opt: { lit?: boolean; mark?: number[] } = {},
): Figure {
  const { rods, unitRod } = layout;
  if (digits.length !== rods) throw new Error('けたの数が合わない');
  const W = 22 * 2 + rods * 44;
  const cx = (i: number) => 22 + 44 * i + 22;
  const bead = (x: number, y: number, lit: boolean) =>
    `<polygon points="${x - 18},${y} ${x},${y - 11} ${x + 18},${y} ${x},${y + 11}" fill="${lit ? 'var(--sun)' : 'var(--wood)'}" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/>`;
  let body = `<rect x="6" y="6" width="${W - 12}" height="206" rx="8" fill="var(--paper)" stroke="var(--ink)" stroke-width="3.5"/>`;
  for (const i of opt.mark ?? [])
    body += `<rect x="${cx(i) - 21}" y="12" width="42" height="194" rx="6" fill="var(--sun)" fill-opacity="0.35"/>`;
  for (let i = 0; i < rods; i++)
    body += `<line x1="${cx(i)}" y1="12" x2="${cx(i)}" y2="206" stroke="var(--ink-soft)" stroke-width="2"/>`;
  body += `<rect x="6" y="66" width="${W - 12}" height="10" fill="var(--ink)"/>`;
  for (let i = 0; i < rods; i++)
    if ((unitRod - i) % 3 === 0)
      body += `<circle cx="${cx(i)}" cy="71" r="3.5" fill="var(--paper)"/>`;
  for (let i = 0; i < rods; i++) {
    const b = beadsOf(digits[i]!);
    const lit = opt.lit === true;
    body += bead(cx(i), b.five ? 55 : 25, lit && b.five);
    for (let k = 0; k < 4; k++) {
      const on = k < b.ones;
      body += bead(cx(i), on ? 87 + 22 * k : 195 - 22 * (3 - k), lit && on);
    }
  }
  body += `<polygon points="${cx(unitRod) - 9},234 ${cx(unitRod) + 9},234 ${cx(unitRod)},220" fill="var(--ink)"/>`;
  return {
    kind: 'svg',
    label: 'そろばん',
    markup: `<svg viewBox="0 0 ${W} 240" xmlns="http://www.w3.org/2000/svg">${body}</svg>`,
  };
}

// ---- 数字の列の操作（誤答の値・選択肢の図に使う） ----

/** 「数のけた」の範囲 [左, 右]: 0 でない数字のある いちばん左のけた（または一の位）〜 一の位（小数があれば いちばん右の 0 でないけた） */
export function spanOf(layout: AbacusLayout, digits: number[]): [number, number] {
  let lo = layout.unitRod;
  let hi = layout.unitRod;
  digits.forEach((d, i) => {
    if (d === 0) return;
    if (i < lo) lo = i;
    if (i > hi) hi = i;
  });
  return [lo, hi];
}
const mapSpan = (layout: AbacusLayout, digits: number[], f: (d: number) => number): number[] => {
  const [lo, hi] = spanOf(layout, digits);
  return digits.map((d, i) => (i >= lo && i <= hi ? f(d) : d));
};
/** 範囲のけたの d≥5 を d−4 にした列（五だまを 1 と数えた読み） */
export const fiveAsOne = (layout: AbacusLayout, digits: number[]) =>
  mapSpan(layout, digits, (d) => (d >= 5 ? d - 4 : d));
/** 範囲のけたの d を (d>=5?5:0) + (4 − d%5) にした列（はりから はなれた 一だまを 数えた） */
export const lowerAway = (layout: AbacusLayout, digits: number[]) =>
  mapSpan(layout, digits, (d) => (d >= 5 ? 5 : 0) + (4 - (d % 5)));
/** d≥5 を d−5 にした列（五だまを 入れわすれた おき方） */
export const fiveMissing = (digits: number[]) => digits.map((d) => (d >= 5 ? d - 5 : d));
/** 全体を 1けた左へ（値×10）。左端からはみ出すなら null */
export function shiftLeft(digits: number[]): number[] | null {
  return digits[0] === 0 ? [...digits.slice(1), 0] : null;
}
/** 範囲の中の 0 を詰め、0 でない数字を左から並べ直した列（2.07 → 2.7、305 → 350）。変わらなければ null */
export function zeroSkip(layout: AbacusLayout, digits: number[]): number[] | null {
  const [lo, hi] = spanOf(layout, digits);
  const inside = digits.slice(lo, hi + 1);
  const packed = inside.filter((d) => d !== 0);
  while (packed.length < inside.length) packed.push(0);
  const out = [...digits.slice(0, lo), ...packed, ...digits.slice(hi + 1)];
  return out.join('') === digits.join('') ? null : out;
}

/** そのけたの数字 d に、数字 e を そのまま足せるか（5や10の あわせが いらない） */
export function directAdd(d: number, e: number): boolean {
  return e < 5 ? (d % 5) + e <= 4 : d < 5 && (d % 5) + (e - 5) <= 4;
}
/** そのけたの数字 d から、数字 e を そのまま ひけるか */
export function directSub(d: number, e: number): boolean {
  return e < 5 ? d % 5 >= e : d >= 5 && d % 5 >= e - 5;
}
