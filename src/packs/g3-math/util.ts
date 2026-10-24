/**
 * g3-math の共通の部品（このパックの中だけで使う。他のパックは import しない）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceOption, NumberField } from '../../curriculum/types';

export type Wrong = { value: string; misconception: string };

/** 誤答の例の一覧を作る（正答と同じもの・重複・欄の数が合わないもの・負の数を除く） */
export function wrongList(
  correct: string,
  fields: number,
  cands: [string | number | null | undefined | false, string][],
): Wrong[] {
  const out: Wrong[] = [];
  for (const [v, m] of cands) {
    if (v === null || v === undefined || v === false) continue;
    const t = String(v);
    if (t === correct || t.split('|').length !== fields) continue;
    if (t.split('|').some((p) => p === '' || p.startsWith('-') || p === 'NaN' || p === 'Infinity'))
      continue;
    if (out.some((w) => w.value === t)) continue;
    out.push({ value: t, misconception: m });
  }
  return out;
}

/** 位の名前（右から。一の位・十の位…） */
export const PLACE = [
  '一《いち》',
  '十《じゅう》',
  '百《ひゃく》',
  '千《せん》',
  '一万《いちまん》',
  '十万《じゅうまん》',
] as const;
export const placeName = (i: number) => `${PLACE[i]}のくらい`;

/** 数 n を位ごとの欄（大きい位から）に分けた文字列（'1|2|5'）。欄が足りなければ null */
export function toFields(n: number, count: number): string | null {
  if (!Number.isInteger(n) || n < 0) return null;
  const s = String(n);
  if (s.length > count) return null;
  return s.padStart(count, '0').split('').join('|');
}

/** 筆算の答えの欄（大きい位から） */
export function placeFields(answer: number): NumberField[] {
  const s = String(answer);
  return s.split('').map((d, i) => ({
    label: placeName(s.length - 1 - i),
    answer: { kind: 'int', value: Number(d) },
  }));
}

/** 位ごとの数字（一の位から） */
export const digits = (n: number): number[] => String(n).split('').reverse().map(Number);
export const fromDigits = (ds: number[]): number =>
  Number(
    ds
      .slice()
      .reverse()
      .join('')
      .replace(/^0+(?=\d)/, ''),
  );

/** 筆算の形の表（位をそろえて書く。答えの行は ？）。rows: 上から書く数（2つ目以降の先頭に記号） */
export function columnFigure(
  a: number,
  b: number,
  op: '＋' | '−' | '×',
  ansLen: number,
  extra: (number | string)[] = [],
): Figure {
  const width = Math.max(
    String(a).length,
    String(b).length,
    ansLen,
    ...extra.map((x) => String(x).length),
  );
  const cells = (n: number | string) =>
    String(n)
      .padStart(width, ' ')
      .split('')
      .map((c) => (c === ' ' ? '' : c));
  return {
    kind: 'table',
    header: ['', ...Array.from({ length: width }, (_, i) => PLACE[width - 1 - i]!)],
    rows: [
      ['', ...cells(a)],
      [op, ...cells(b)],
      ...extra.map((x) => ['', ...cells(x)]),
      ['', ...Array.from({ length: width }, (_, i) => (i >= width - ansLen ? '？' : ''))],
    ],
  };
}

/** 定義域の配列から均等に1つ */
export function pickOne<T>(rng: Rng, arr: readonly T[]): T {
  return arr[rng.int(0, arr.length - 1)]!;
}

/** 段階の到達項目を均等に選ぶ（回の中の番号でずらす） */
export function pickObj<T>(rng: Rng, objs: readonly T[], index: number): T {
  return objs[(index + rng.int(0, objs.length - 1)) % objs.length]!;
}

/** 選択肢（正解1つ＋誤り）。label が重なるものは除く。4つまで */
export function opts(correct: string, wrongs: [string, string][]): ChoiceOption[] {
  const out: ChoiceOption[] = [{ label: correct, correct: true }];
  for (const [label, m] of wrongs) {
    if (out.some((o) => o.label === label)) continue;
    out.push({ label, misconception: m });
  }
  return out.slice(0, 4);
}

/** 小数（10分の1の整数 t）を文字列に。13 → '1.3'、10 → '1' */
export function tenths(t: number): string {
  const s = (t / 10).toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

/** 3けたごとの区切りなしの数を、万で区切った読みやすい文字（12345678 → '1234万5678'） */
export function manText(n: number): string {
  if (n < 10000) return String(n);
  const hi = Math.floor(n / 10000);
  const lo = n % 10000;
  return `${hi}万《まん》${lo === 0 ? '' : String(lo)}`;
}
