/**
 * g1-math の単元で共有する小さな部品（パックの中だけで使う。他のパックは import しない）。
 * add-basic.ts は見本なので、ここを使わずに単独で書いてある（変えない）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceOption } from '../../curriculum/types';

export const REVISED = '2026-10-24';

/** 誤りの選択肢: [文, 誤概念ID] */
export type Wrong = readonly [label: string, misconception?: string];

/**
 * 正解1つと誤りから選択肢を作る（正解を先頭に書く。画面では並べ替える）。小1は4つまで（ux-by-age）。
 * 同じ文の誤りは1つにまとめ、正解と同じ文の誤りは捨てる。
 */
export function opts(correct: string, wrongs: readonly Wrong[], max = 4): ChoiceOption[] {
  const out: ChoiceOption[] = [{ label: correct, correct: true }];
  for (const [label, m] of wrongs) {
    if (out.length >= max) break;
    if (out.some((o) => o.label === label)) continue;
    out.push(m ? { label, misconception: m } : { label });
  }
  return out;
}

/**
 * 数の選択肢: 正解の数と、誤概念つきの誤りの数（範囲外・重複・正解と同じは捨てる）。
 * 足りなければ近い数（誤概念なし）で埋める。
 */
export function numberOpts(
  answer: number,
  wrongs: readonly (readonly [number, string])[],
  opt: { min?: number; max?: number; count?: number } = {},
): ChoiceOption[] {
  const min = opt.min ?? 0;
  const max = opt.max ?? Infinity;
  const count = opt.count ?? 4;
  const out: ChoiceOption[] = [{ label: String(answer), correct: true }];
  const used = new Set([answer]);
  for (const [v, m] of wrongs) {
    if (out.length >= count) break;
    if (used.has(v) || v < min || v > max || !Number.isInteger(v)) continue;
    used.add(v);
    out.push({ label: String(v), misconception: m });
  }
  for (let d = 2; out.length < Math.min(count, 3) && d < 50; d++) {
    for (const v of [answer + d, answer - d]) {
      if (out.length >= Math.min(count, 3)) break;
      if (used.has(v) || v < min || v > max) continue;
      used.add(v);
      out.push({ label: String(v) });
    }
  }
  return out;
}

/**
 * 「from から かぞえて いこう」のヒント③。答えの手前で止める（答えの数を書かない: curriculum-matrix 1.2-5）。
 * answer が from の 2つ以上先のときは「from、from+1、…」と 途中までしか見せない。
 * 1つ先のときは数を書かず「1めもり（1つ）すすむ」とだけ言う。
 */
export function countUpHint(from: number, answer: number): string {
  const d = answer - from;
  if (d >= 2) return `${from}、${from + 1}、…と かぞえて いこう。`;
  if (d === 1) return `${from}の めもりから 1めもり すすんだ ところだよ。`;
  return `${from}の めもりを よく みよう。`;
}

/** 定義域（配列）から均等に1つ（生成のあとで数をずらさない: add-basic の pickPair と同じ考え） */
export function pickFrom<T>(rng: Rng, domain: readonly T[]): T {
  return domain[rng.int(0, domain.length - 1)]!;
}

/** 「けいさん しよう」の大きな式（{{}} が答えの欄の位置） */
export const expr = (text: string): Figure => ({ kind: 'text', text, size: 'xl' });

/** 10の棒と ばらの ブロック */
export const blocks = (n: number, frame = false): Figure =>
  n >= 10 && !frame
    ? { kind: 'blocks', tens: Math.floor(n / 10), ones: n % 10 }
    : { kind: 'blocks', ones: n, frame };
