/**
 * g2-math の共通の部品（このパックの中だけで使う。他のパックは import しない）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceOption, NumberField } from '../../curriculum/types';

export type Wrong = { value: string; misconception: string };

/** 誤答の例の一覧を作る（正答と同じもの・重複・欄の数が合わないものを除く） */
export function wrongList(
  correct: string,
  fields: number,
  cands: [string | number | null | undefined, string][],
): Wrong[] {
  const out: Wrong[] = [];
  for (const [v, m] of cands) {
    if (v === null || v === undefined) continue;
    const t = String(v);
    if (t === correct || t.split('|').length !== fields) continue;
    if (t.split('|').some((p) => p === '' || p.startsWith('-') || p === 'NaN')) continue;
    if (out.some((w) => w.value === t)) continue;
    out.push({ value: t, misconception: m });
  }
  return out;
}

/** 位の名前（ひらがな） */
export const PLACE = ['いち', 'じゅう', 'ひゃく', 'せん'] as const;

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
    label: `${PLACE[s.length - 1 - i]}の くらい`,
    answer: { kind: 'int', value: Number(d) },
  }));
}

/** 筆算の形の表（位をそろえて書く。答えの行は ？） */
export function columnFigure(a: number, b: number, op: '＋' | '−', ansLen: number): Figure {
  const width = Math.max(String(a).length, String(b).length, ansLen);
  const cells = (n: number) =>
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

/** 選択肢（正解1つ＋誤り）。label が重なるものは除く */
export function opts(correct: string, wrongs: [string, string | undefined][]): ChoiceOption[] {
  const out: ChoiceOption[] = [{ label: correct, correct: true }];
  for (const [label, m] of wrongs) {
    if (out.some((o) => o.label === label)) continue;
    out.push(m ? { label, misconception: m } : { label });
  }
  return out.slice(0, 4);
}

/** 1〜999 の数の読み（ひらがな） */
export function kanaNumber(n: number): string {
  const d = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
  const h = [
    '',
    'ひゃく',
    'にひゃく',
    'さんびゃく',
    'よんひゃく',
    'ごひゃく',
    'ろっぴゃく',
    'ななひゃく',
    'はっぴゃく',
    'きゅうひゃく',
  ];
  const t = [
    '',
    'じゅう',
    'にじゅう',
    'さんじゅう',
    'よんじゅう',
    'ごじゅう',
    'ろくじゅう',
    'ななじゅう',
    'はちじゅう',
    'きゅうじゅう',
  ];
  const th = [
    '',
    'せん',
    'にせん',
    'さんぜん',
    'よんせん',
    'ごせん',
    'ろくせん',
    'ななせん',
    'はっせん',
    'きゅうせん',
  ];
  if (n === 0) return 'ゼロ';
  if (n === 10000) return 'いちまん';
  return (
    th[Math.floor(n / 1000) % 10]! +
    h[Math.floor(n / 100) % 10]! +
    t[Math.floor(n / 10) % 10]! +
    d[n % 10]!
  );
}
