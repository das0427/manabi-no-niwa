/**
 * g4-math の共通の部品（このパックの中だけで使う。他のパックは import しない）。
 */
import { judgeNumber, parseNumberInput, type NumberAnswer } from '../../core/answer/number';
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceOption, ItemSource, UnitSpec } from '../../curriculum/types';
import { rubyAll } from './ruby';

export const REVISED = '2026-10-24';

export type Wrong = { value: string; misconception: string };

/** 2つの入力が同じ値か（"0.50" と "0.5"、"6/10" と "3/5" は同じ） */
function sameVal(a: string, b: string): boolean {
  const pa = parseNumberInput(a);
  const pb = parseNumberInput(b);
  if (pa && pb) return pa.value.n === pb.value.n && pa.value.d === pb.value.d;
  return a.trim() === b.trim();
}

/**
 * 誤答の例の一覧（欄の答え answers に対して、確かに「誤り」と判定されるものだけ残す）。
 * 値が同じ候補は先に書いたほうを残す（判定は値で比べて最初に一致したものを使うため）。
 */
export function wrongList(
  answers: NumberAnswer[],
  cands: [string | number | null | undefined | false, string][],
): Wrong[] {
  const out: Wrong[] = [];
  for (const [v, m] of cands) {
    if (v === null || v === undefined || v === false) continue;
    const t = String(v);
    const parts = t.split('|');
    if (parts.length !== answers.length) continue;
    if (parts.some((p) => p === '' || p.startsWith('-') || p.includes('NaN') || !parseNumberInput(p)))
      continue;
    // どれかの欄が誤り（値の違い）であること
    if (!parts.some((p, i) => judgeNumber(answers[i]!, p).result === 'wrong')) continue;
    if (out.some((w) => w.value.split('|').every((p, i) => sameVal(p, parts[i]!)))) continue;
    out.push({ value: t, misconception: m });
  }
  return out;
}

/** 選択肢（正解1つ＋誤り）。同じ文は1つにまとめ、4つまで（小3・小4: ux-by-age） */
export function opts(
  correct: string,
  wrongs: [string | null | undefined, string | undefined][],
  max = 4,
): ChoiceOption[] {
  const out: ChoiceOption[] = [{ label: correct, correct: true }];
  for (const [label, m] of wrongs) {
    if (label === null || label === undefined) continue;
    if (out.length >= max) break;
    if (out.some((o) => o.label === label)) continue;
    out.push(m ? { label, misconception: m } : { label });
  }
  return out;
}

/** 定義域の配列から均等に1つ */
export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[rng.int(0, arr.length - 1)]!;
}

/** 段階の到達項目を均等に選ぶ（回の中の番号でずらす） */
export function pickObj<T>(rng: Rng, objs: readonly T[], index: number): T {
  return objs[(index + rng.int(0, objs.length - 1)) % objs.length]!;
}

/** 大きな式（{{}} が答えの欄の位置） */
export const expr = (text: string): Figure => ({ kind: 'text', text, size: 'xl' });

/** 整数を表す（桁区切りなし） */
export const n2s = (n: number) => String(n);

/**
 * 小数の表示: 整数 v を 10^places でわった数（末尾の0は消す）。例 dec(235, 2) = '2.35'
 * 浮動小数点で計算しないため、小数は「何百分の1が何こ」の整数で持つ。
 */
export function dec(v: number, places: number): string {
  const neg = v < 0;
  const a = Math.abs(v);
  const s = String(a).padStart(places + 1, '0');
  let int = s.slice(0, s.length - places);
  let frac = places > 0 ? s.slice(s.length - places) : '';
  frac = frac.replace(/0+$/, '');
  if (int === '') int = '0';
  return `${neg ? '-' : ''}${int}${frac ? `.${frac}` : ''}`;
}

/** 末尾の0を残す小数の表示（5 → '5.00'）。わり進むときの「0をつけたす」に使う */
export function decFixed(v: number, places: number): string {
  const s = String(Math.abs(v)).padStart(places + 1, '0');
  return places > 0 ? `${s.slice(0, s.length - places)}.${s.slice(s.length - places)}` : s;
}

/** 小数の答え（値は dec と同じ持ち方） */
export const decAns = (v: number, places: number): NumberAnswer => ({
  kind: 'decimal',
  value: Number(dec(v, places)),
});

/** 小数の桁数（'2.35' → 2） */
export const placesOf = (s: string) => (s.includes('.') ? s.length - s.indexOf('.') - 1 : 0);

/** 最大公約数 */
export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

/** 分数の表示（RichText）。帯分数にできるときは mixed で帯分数に */
export function fracText(num: number, den: number, form: 'improper' | 'mixed' = 'improper'): string {
  if (num % den === 0) return String(num / den);
  if (form === 'mixed' && num > den) return `[[${Math.floor(num / den)} ${num % den}/${den}]]`;
  return `[[${num}/${den}]]`;
}

/** 分数の入力の形（"2と1/3"・"7/3"） */
export function fracInput(num: number, den: number, form: 'improper' | 'mixed'): string {
  if (num % den === 0) return String(num / den);
  if (form === 'mixed' && num > den) return `${Math.floor(num / den)}と${num % den}/${den}`;
  return `${num}/${den}`;
}

/** SVG の線の共通の属性 */
export const STROKE = 'stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"';

/** SVG の文字（カタカナ・数字だけ。漢字は書かない） */
export const svgText = (x: number, y: number, s: string, size = 16, anchor = 'middle') =>
  `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" dominant-baseline="middle" fill="var(--ink)">${s}</text>`;

export const svg = (w: number, h: number, body: string, label: string): Figure => ({
  kind: 'svg',
  label,
  markup: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`,
});

/** 位の名前（p: 0 = 一の位）。「〇〇の 位」 */
const PLACE_NAMES = [
  '一《いち》',
  '十《じゅう》',
  '百《ひゃく》',
  '千《せん》',
  '一万《いちまん》',
  '十万《じゅうまん》',
  '百万《ひゃくまん》',
  '千万《せんまん》',
  '一億《いちおく》',
];
export const placeLabel = (p: number) => `${PLACE_NAMES[p]}の 位《くらい》`;

export const KATA =['ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク'] as const;

/** 単元の文と、生成する問題の文に《よみ》を付ける */
export function finishUnit(u: UnitSpec): UnitSpec {
  const src = u.source;
  const source: ItemSource =
    src.kind === 'generator'
      ? {
          ...src,
          generate: (ctx) => rubyAll(src.generate(ctx)),
          ...(src.items ? { items: rubyAll(src.items) } : {}),
        }
      : src.kind === 'items'
        ? { kind: 'items', items: rubyAll(src.items) }
        : src;
  return { ...rubyAll({ ...u, source: undefined }), source };
}
