/**
 * g6-math の共通の部品（このパックの中だけで使う。他のパックは import しない）。
 * 値の比較は分数（整数の分子・分母）で行い、浮動小数点で比べない。
 * 本体の判定（core/answer/number）は値で import できない（pack-imports.test）ので、ここで同じ規則の読み取りを持つ。
 */
import type { Rng } from '../../core/util/rng';
import type { NumberAnswer } from '../../core/answer/number';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceOption, ItemSource, UnitSpec } from '../../curriculum/types';
import { rubyAll } from './ruby';

export const REVISED = '2026-10-24';

export type Wrong = { value: string; misconception: string };

// ---- 分数（有理数） ----
export interface Q {
  n: number;
  d: number;
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}
export const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

/** 約分した分数 */
export function q(n: number, d = 1): Q {
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
export const qmul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
export const qdiv = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);
export const qadd = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
export const qsub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d);
export const qeq = (a: Q, b: Q) => {
  const x = q(a.n, a.d);
  const y = q(b.n, b.d);
  return x.n === y.n && x.d === y.d;
};

/** 入力の文字列（"3/4"・"2と1/3"・"0.25"・"12"）を値に。読めなければ null */
export function parseVal(s: string): Q | null {
  const t = s.trim();
  let m: RegExpExecArray | null;
  if ((m = /^(\d+)(?:と|\s)(\d+)\/(\d+)$/.exec(t)))
    return Number(m[3]) === 0 ? null : q(Number(m[1]) * Number(m[3]) + Number(m[2]), Number(m[3]));
  if ((m = /^(\d+)\/(\d+)$/.exec(t))) return Number(m[2]) === 0 ? null : q(Number(m[1]), Number(m[2]));
  if ((m = /^(\d*)\.(\d+)$/.exec(t)))
    return q(Number(`${m[1] || '0'}${m[2]}`), 10 ** m[2]!.length);
  if (/^\d+$/.test(t)) return q(Number(t), 1);
  return null;
}

/** 答え（NumberAnswer）の値 */
export function ansVal(a: NumberAnswer): Q {
  if (a.kind === 'fraction') return q(a.num, a.den);
  return parseVal(String(a.value)) ?? q(a.value * 1000000, 1000000);
}

/**
 * 誤答の例の一覧。欄の答え answers に対して値が違う（＝確かに誤り）候補だけ残し、値が同じ候補は先のものを残す。
 * 読めない・負・0除算の候補は捨てる。
 */
export function wrongList(
  answers: NumberAnswer[],
  cands: [string | number | null | undefined | false, string][],
): Wrong[] {
  const out: Wrong[] = [];
  const outVals: Q[][] = [];
  const want = answers.map(ansVal);
  for (const [v, m] of cands) {
    if (v === null || v === undefined || v === false) continue;
    const t = String(v);
    const parts = t.split('|');
    if (parts.length !== answers.length) continue;
    const vals = parts.map(parseVal);
    if (vals.some((x) => x === null)) continue;
    const vs = vals as Q[];
    if (vs.every((x, i) => qeq(x, want[i]!))) continue;
    if (outVals.some((o) => o.every((x, i) => qeq(x, vs[i]!)))) continue;
    out.push({ value: t, misconception: m });
    outVals.push(vs);
  }
  return out;
}

/** 分数の表示（RichText）。整数になるときは整数。mixed: 帯分数で */
export function qText(x: Q, mixed = false): string {
  const v = q(x.n, x.d);
  if (v.d === 1) return String(v.n);
  if (mixed && v.n > v.d) return `[[${Math.floor(v.n / v.d)} ${v.n % v.d}/${v.d}]]`;
  return `[[${v.n}/${v.d}]]`;
}
/** 約分しない分数の表示 */
export const fr = (n: number, d: number) => `[[${n}/${d}]]`;
/** 帯分数・仮分数を併記（仮分数のときだけ） */
export function qBoth(x: Q): string {
  const v = q(x.n, x.d);
  if (v.d === 1 || v.n < v.d) return qText(v);
  return `${qText(v)}（${qText(v, true)}）`;
}
/**
 * 約分前の分数から答えまでの式の続き（[[6/12]] ＝ [[1/2]]）。約分できないときは1つだけ。
 * 注意: 分数の記法 [[ ]] の中に式（2 × 3）は書けないので、途中の式は fx で言葉にする。
 */
export function rawTo(rn: number, rd: number): string {
  const v = q(rn, rd);
  if (rd === 1) return String(rn);
  if (v.n === rn && v.d === rd) return qBoth(v);
  return `${fr(rn, rd)} ＝ ${qBoth(v)}`;
}
/** 分子・分母が式の分数を言葉で（「分子が 2 × 3、分母が 5の 分数」） */
export const fx = (nums: number[], dens: number[]) =>
  `分子が ${nums.join(' × ')}、分母が ${dens.join(' × ')}の 分数`;

/** 入力の形の文字列（"7/3"。整数は整数） */
export function qIn(x: Q): string {
  const v = q(x.n, x.d);
  return v.d === 1 ? String(v.n) : `${v.n}/${v.d}`;
}

/** 分数の答え（約分が目標: mustReduce。仮分数・帯分数どちらでも正） */
export function fracAns(x: Q, opt: { allowDecimal?: boolean } = {}): NumberAnswer {
  const v = q(x.n, x.d);
  if (v.d === 1) return { kind: 'int', value: v.n };
  return {
    kind: 'fraction',
    num: v.n,
    den: v.d,
    mustReduce: true,
    ...(opt.allowDecimal ? { allowDecimal: true } : {}),
  };
}

// ---- 小数（10^places 分の1 の整数で持つ） ----
/** 整数 v を 10^places でわった数の表示（末尾の0は消す）。dec(2826, 2) = '28.26' */
export function dec(v: number, places: number): string {
  const s = String(Math.abs(v)).padStart(places + 1, '0');
  let int = s.slice(0, s.length - places);
  const frac = places > 0 ? s.slice(s.length - places).replace(/0+$/, '') : '';
  if (int === '') int = '0';
  return `${v < 0 ? '-' : ''}${int}${frac ? `.${frac}` : ''}`;
}
/** 小数の答え（値は dec と同じ持ち方） */
export function decAns(v: number, places: number): NumberAnswer {
  const s = dec(v, places);
  return s.includes('.') ? { kind: 'decimal', value: Number(s) } : { kind: 'int', value: Number(s) };
}

// ---- 選ぶ・選択肢 ----
/** 定義域の配列から均等に1つ */
export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[rng.int(0, arr.length - 1)]!;
}
/** 段階の到達項目を均等に選ぶ（回の中の番号でずらす） */
export function pickObj<T>(rng: Rng, objs: readonly T[], index: number): T {
  return objs[(index + rng.int(0, objs.length - 1)) % objs.length]!;
}

/** 選択肢（正解1つ＋誤り）。同じ文は1つにまとめ、max（小5・小6: 4）まで */
export function opts(
  correct: string,
  wrongs: [string | null | undefined | false, string | undefined][],
  max = 4,
): ChoiceOption[] {
  const out: ChoiceOption[] = [{ label: correct, correct: true }];
  for (const [label, m] of wrongs) {
    if (label === null || label === undefined || label === false) continue;
    if (out.length >= max) break;
    if (out.some((o) => o.label === label)) continue;
    out.push(m ? { label, misconception: m } : { label });
  }
  return out;
}

// ---- 図 ----
/** 大きな式（{{}} が答えの欄の位置） */
export const expr = (text: string): Figure => ({ kind: 'text', text, size: 'xl' });

/** SVG の線の共通の属性 */
export const STROKE =
  'stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"';

/** SVG の文字（英字・数字だけ。漢字・かなは書かない） */
export const svgText = (x: number, y: number, s: string | number, size = 16, anchor = 'middle') =>
  `<text x="${r1(x)}" y="${r1(y)}" font-size="${size}" text-anchor="${anchor}" dominant-baseline="middle" fill="var(--ink)">${s}</text>`;

export const svg = (w: number, h: number, body: string, label: string): Figure => ({
  kind: 'svg',
  label,
  markup: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`,
});

/** 座標の丸め（SVG の文字列を短く） */
export const r1 = (x: number) => Math.round(x * 10) / 10;

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

/** 範囲の整数の配列 */
export const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
