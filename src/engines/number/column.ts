/**
 * 筆算のレイアウト（curriculum-matrix B7）。純粋関数。
 * 問題の column（式）から、ますの並び（行と列）と、各欄（fields）の正しい値を作る。
 * 欄の値は「ますの数字を左から並べた文字列」。判定は今までの number と同じ（各欄の値で比べる）。
 *
 * 寸法（u）: ますの幅 6・答えのますの高さ 5.6（数字キーと同じ）・式の数字の行 3.6・メモの行 5.5、
 * 答えの行の前後に 0.7 のすき間。作業領域（高さ 26.25u・数字キーの左 62u）に収まるかを check で確かめる。
 */
import type { NumberColumn } from '../../curriculum/types';

export const COL_CELL_W = 6;
/** 答えの行の前後（縦）のすき間 */
export const COL_GAP = 0.7;
/** 列のすき間（横。数字キーと同じ） */
export const COL_COLUMN_GAP = 0.8;
export const COL_FIELD_H = 5.6;
export const COL_NUM_H = 3.6;
export const COL_MEMO_H = 5.5;
/**
 * 作業領域の高さ: 問題文が1行のとき 上 16u（問題文の下 15u ＋ 1u）〜 下 14u で 26.25u。
 * 少し余裕をみた値
 */
export const COL_MAX_H = 26.2;
/** 数字キー（4列 26.4u）とすき間 3u を除いた幅 */
export const COL_MAX_W = 62.6;
/** メモのますに入る字数（繰り下がりの「12」など） */
export const MEMO_MAX = 2;

export type ColRow =
  | { kind: 'memo'; cols: number[] }
  | {
      kind: 'num';
      /** [列, 字]（数字・記号） */
      chars: [number, string][];
      /** わり算の ）を置く列 */
      bracket?: number;
    }
  | {
      kind: 'field';
      /** fields の番号 */
      field: number;
      /** ますの列（左から。いちばん右が その欄の いちばん下の位） */
      cols: number[];
    };

export interface ColLayout {
  /** 列の数 */
  width: number;
  rows: ColRow[];
  /** 横線: [行の番号（その行の上に引く）, 始めの列, 終わりの列] */
  lines: [number, number, number][];
  /** fields の正しい値（並びは fields と同じ） */
  expected: number[];
  /** 入れる向き（たし算・ひき算・かけ算は一の位から左へ、わり算は左から右へ） */
  direction: 'rtl' | 'ltr';
  /** 細い列（わり算の ）の列。幅 2u） */
  narrow?: number[];
}

const digitsOf = (n: number) => String(n).split('');

/** わり算の筆算の段（0 の商の段は書かない）。r は その段の いちばん右の、わられる数の位置（左から） */
export function divisionSteps(dividend: number, divisor: number): {
  quotient: number;
  remainder: number;
  /** 先頭が商の いちばん上の位がたつ位置（左から） */
  start: number;
  rows: { value: number; right: number; kind: 'product' | 'diff' }[];
} {
  const ds = digitsOf(dividend).map(Number);
  const rows: { value: number; right: number; kind: 'product' | 'diff' }[] = [];
  let cur = 0;
  let start = -1;
  for (let i = 0; i < ds.length; i++) {
    cur = cur * 10 + ds[i]!;
    if (start < 0 && cur < divisor && i < ds.length - 1) continue;
    if (start < 0) start = i;
    const q = Math.floor(cur / divisor);
    const last = i === ds.length - 1;
    if (q > 0) {
      rows.push({ value: q * divisor, right: i, kind: 'product' });
      cur -= q * divisor;
      rows.push(
        last
          ? { value: cur, right: i, kind: 'diff' }
          : { value: cur * 10 + ds[i + 1]!, right: i + 1, kind: 'diff' },
      );
    } else if (!last) {
      // 商が 0 の位: かけ算・ひき算の段を書かず、つぎの位をおろす（前の段に書き足す）
      const prev = rows[rows.length - 1];
      if (prev && prev.kind === 'diff') {
        prev.value = cur * 10 + ds[i + 1]!;
        prev.right = i + 1;
      }
    }
  }
  return {
    quotient: Math.floor(dividend / divisor),
    remainder: dividend % divisor,
    start,
    rows,
  };
}

/** 筆算のレイアウトを作る。式が書けないとき（負の数・0でわる 等）は null（理由は check が出す） */
export function columnLayout(c: NumberColumn): ColLayout | null {
  const [a, b] = c.operands;
  if (![a, b].every((x) => Number.isSafeInteger(x) && x >= 0)) return null;
  if (c.op === 'div') return divisionLayout(a, b);
  if (c.op === 'sub' && a < b) return null;
  const A = digitsOf(a);
  const B = digitsOf(b);
  const n =
    c.op === 'add'
      ? Math.max(A.length, B.length) + 1
      : c.op === 'sub'
        ? A.length
        : A.length + B.length;
  const width = n + 1; // 0列目は記号（＋ − ×）
  const colOf = (place: number) => width - 1 - place;
  const placeCols = (lo: number, hi: number) => {
    const cols: number[] = [];
    for (let p = Math.min(hi, n - 1); p >= lo; p--) cols.push(colOf(p));
    return cols;
  };
  const numRow = (ds: string[], sign?: string): ColRow => ({
    kind: 'num',
    chars: [
      ...(sign ? ([[0, sign]] as [number, string][]) : []),
      ...ds.map((d, i) => [colOf(ds.length - 1 - i), d] as [number, string]),
    ],
  });
  const rows: ColRow[] = [];
  const lines: [number, number, number][] = [];
  if (c.memo) {
    // 繰り上がり: 一の位より上の位（かけ算は かけられる数の上）。繰り下がり: ひかれる数の各位の上
    rows.push({
      kind: 'memo',
      cols:
        c.op === 'sub'
          ? placeCols(0, A.length - 1)
          : c.op === 'mul'
            ? placeCols(1, A.length)
            : placeCols(1, n - 1),
    });
  }
  rows.push(numRow(A));
  rows.push(numRow(B, c.op === 'add' ? '＋' : c.op === 'sub' ? '−' : '×'));
  const expected: number[] = [];
  const usePartials = c.op === 'mul' && B.length >= 2 && c.partials !== false;
  if (usePartials) {
    lines.push([rows.length, 0, width - 1]);
    for (let j = 0; j < B.length; j++) {
      const v = a * Number(B[B.length - 1 - j]);
      rows.push({ kind: 'field', field: j, cols: placeCols(j, j + A.length) });
      expected.push(v);
    }
  }
  lines.push([rows.length, 0, width - 1]);
  rows.push({ kind: 'field', field: expected.length, cols: placeCols(0, n - 1) });
  expected.push(c.op === 'add' ? a + b : c.op === 'sub' ? a - b : a * b);
  return { width, rows, lines, expected, direction: 'rtl' };
}

function divisionLayout(dividend: number, divisor: number): ColLayout | null {
  if (divisor <= 0 || dividend < divisor) return null;
  const D = digitsOf(dividend);
  const K = digitsOf(divisor);
  const k = K.length;
  const width = k + 1 + D.length;
  const colOfDigit = (i: number) => k + 1 + i;
  const span = (right: number) => Array.from({ length: right + 1 }, (_, i) => colOfDigit(i));
  const st = divisionSteps(dividend, divisor);
  const rows: ColRow[] = [];
  const lines: [number, number, number][] = [];
  const expected: number[] = [st.quotient];
  rows.push({ kind: 'field', field: 0, cols: span(D.length - 1) });
  lines.push([rows.length, k, width - 1]);
  rows.push({
    kind: 'num',
    chars: [
      ...K.map((d, i) => [i, d] as [number, string]),
      ...D.map((d, i) => [colOfDigit(i), d] as [number, string]),
    ],
    bracket: k,
  });
  for (const s of st.rows) {
    if (s.kind === 'diff') {
      const prev = rows[rows.length - 1];
      const right = prev && prev.kind === 'field' ? prev.cols[prev.cols.length - 1]! : width - 1;
      lines.push([rows.length, colOfDigit(0), right]);
    }
    rows.push({ kind: 'field', field: expected.length, cols: span(s.right) });
    expected.push(s.value);
  }
  return { width, rows, lines, expected, direction: 'ltr', narrow: [k] };
}

/** レイアウトの高さと幅（u） */
export function columnSize(l: ColLayout): { w: number; h: number } {
  let h = 0;
  l.rows.forEach((r, i) => {
    const prev = l.rows[i - 1];
    if (prev && (r.kind === 'field' || prev.kind === 'field')) h += COL_GAP;
    h += r.kind === 'field' ? COL_FIELD_H : r.kind === 'memo' ? COL_MEMO_H : COL_NUM_H;
  });
  const narrow = l.narrow?.length ?? 0;
  return { w: (l.width - narrow) * COL_CELL_W + narrow * 2 + (l.width - 1) * COL_COLUMN_GAP, h };
}

/**
 * ますの数字（左から）を欄の値にする。上の位の空きは書かないのと同じ。
 * 数字の間や下の位に空きがあれば '?' を入れる（読めない入力 → 「もう一度」）。
 */
export function cellsToValue(cells: readonly string[]): string {
  const first = cells.findIndex((s) => s !== '');
  if (first < 0) return '';
  return cells
    .slice(first)
    .map((s) => (s === '' ? '?' : s))
    .join('');
}

/** 正しい値を ますに右づめで置く（正答の表示用） */
export function valueToCells(value: number, count: number): string[] {
  const ds = digitsOf(value);
  return Array.from({ length: count }, (_, i) => ds[ds.length - count + i] ?? '');
}
