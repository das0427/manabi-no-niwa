/**
 * 算数の図のエンジン（clock・measure・numberline・graph・geometry）で共有する小さな道具。純粋関数。
 * - 有理数の計算（浮動小数点で比べない。src/core/answer/number.ts の Rational を使う）
 * - タップした位置 → SVG の座標（viewBox は preserveAspectRatio の既定 xMidYMid meet）
 * 統括への提案: src/engines/shared/ などの共有の場所へ移す（engine-brief 9 の範囲のため、ここに置いた）。
 */
import type { ReactNode } from 'react';
import { fromNumber, parseNumberInput, rational, type Rational } from '../../core/answer/number';
import type { ItemBase, RichText } from '../../curriculum/types';
import type { EngineProps, Judgement } from '../types';

/**
 * EngineDef と同じ形（Item の和に入る前でも型を付けられるよう、Item の制約だけを外したもの）。
 * 統括が Item の和に加えた後は、そのまま EngineDef<…> に代入できる。
 */
export type KitProps<I, R> = Omit<EngineProps<never, R>, 'item'> & { item: I };
export interface KitEngineDef<I extends ItemBase & { engine: string }, R> {
  id: I['engine'];
  Component: (props: KitProps<I, R>) => ReactNode;
  judge(item: I, response: R): Judgement;
  check(item: I): string[];
  answerText(item: I): RichText;
}

/** 問題データの数（3、0.4、'2/5'、'1 1/3' のどれでも書ける） */
export type Num = number | string;

/** 数を有理数に。読めなければ null */
export function toRational(x: Num): Rational | null {
  if (typeof x === 'number') return Number.isFinite(x) ? fromNumber(x) : null;
  const p = parseNumberInput(x);
  return p ? p.value : null;
}

export function ratAdd(a: Rational, b: Rational): Rational {
  return rational(a.n * b.d + b.n * a.d, a.d * b.d);
}
export function ratSub(a: Rational, b: Rational): Rational {
  return rational(a.n * b.d - b.n * a.d, a.d * b.d);
}
export function ratMul(a: Rational, b: Rational): Rational {
  return rational(a.n * b.n, a.d * b.d);
}
export function ratDiv(a: Rational, b: Rational): Rational {
  return rational(a.n * b.d, a.d * b.n);
}
export function ratToNumber(a: Rational): number {
  return a.n / a.d;
}
export function ratIsInt(a: Rational): boolean {
  return a.d === 1;
}

/** 有理数を RichText に（整数・小数・分数 [[n/d]]・帯分数 [[w n/d]]） */
export function ratText(
  a: Rational,
  as: 'auto' | 'fraction' | 'mixed' | 'decimal' = 'auto',
): string {
  if (a.d === 1) return String(a.n);
  const neg = a.n < 0 ? '-' : '';
  const n = Math.abs(a.n);
  if (as === 'decimal' || (as === 'auto' && isFiniteDecimal(a))) {
    return String(Math.round((a.n / a.d) * 1e9) / 1e9);
  }
  if (as === 'mixed' && n > a.d) return `${neg}[[${Math.floor(n / a.d)} ${n % a.d}/${a.d}]]`;
  return `${neg}[[${n}/${a.d}]]`;
}

function isFiniteDecimal(a: Rational): boolean {
  let d = a.d;
  while (d % 2 === 0) d /= 2;
  while (d % 5 === 0) d /= 5;
  return d === 1;
}

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** タップした位置を SVG の座標に（xMidYMid meet の拡大縮小と余白を考える） */
export function svgPoint(
  e: { clientX: number; clientY: number; currentTarget: Element },
  vb: ViewBox,
): { x: number; y: number } {
  const svg =
    e.currentTarget instanceof SVGSVGElement
      ? e.currentTarget
      : ((e.currentTarget as SVGElement).ownerSVGElement ?? e.currentTarget);
  const r = svg.getBoundingClientRect();
  const s = Math.min(r.width / vb.w, r.height / vb.h) || 1;
  const ox = r.left + (r.width - vb.w * s) / 2;
  const oy = r.top + (r.height - vb.h * s) / 2;
  return { x: vb.x + (e.clientX - ox) / s, y: vb.y + (e.clientY - oy) / s };
}

/** 0 から n-1 の範囲に収める */
export function clampInt(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}
