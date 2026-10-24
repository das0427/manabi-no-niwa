import type { QuestionState } from '../../core/session/questionFlow';
import type { MathItem } from './logic';

/** 1問が終わったときに親（index.tsx）へ渡す結果。完了画面の式と声かけに使う */
export interface QResult {
  /** 取り組んだ式（完了画面に並べる）。D1 は見つけた分け方の数だけ */
  texts: string[];
  item: MathItem;
  /** 正解した（「つぎへ」で進んだ場合は false） */
  ok: boolean;
  /** 絵を1つずつタップして数えてから正解した */
  counted: boolean;
  /** E で「えで みる」を使ってから正解した */
  reviewed: boolean;
  /** D1 で2通り目以降の分け方をした */
  otherSplit: boolean;
}

export interface ChoiceDraft {
  q: QuestionState;
  numbers: number[];
  numBy: 'child' | 'demo';
  pic: boolean;
  wrong: number[];
}

export interface SplitDraft {
  q: QuestionState;
  place: number[];
  /** 見つけた分け方「x-y」 */
  splits: string[];
  phase: 'play' | 'done' | 'retry';
  recorded: boolean;
}

/** saveDraft に保存する形 */
export interface Draft {
  index: number;
  results: QResult[];
  sub: ChoiceDraft | SplitDraft | null;
}

/** 完了画面の声かけ: 行動に基づくものだけ（learning-design.md 0.5）。当たらなければ省略（＝さいごまで できたね） */
export function praiseOf(results: readonly QResult[]): string | undefined {
  // 自分で解いた問題が0（全部「つぎへ」）の回は、できたと言わず、いっしょに見たことを言う（L6）
  if (results.length > 0 && results.every((r) => !r.ok)) return 'praise.watched';
  if (results.some((r) => r.otherSplit)) return 'praise.other-split';
  if (results.some((r) => r.reviewed)) return 'praise.picture-checked';
  if (results.some((r) => r.counted)) return 'praise.counted';
  return undefined;
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

/**
 * 正解の演出の長さ: 約1.5秒。ただし声が続いている間は待つ（最大3.5秒。声の途中で次の問題に切り替えない）。
 */
export async function settleAfter(voice: Promise<unknown>): Promise<void> {
  const t0 = Date.now();
  await Promise.race([voice, sleep(3500)]);
  const rest = 1500 - (Date.now() - t0);
  if (rest > 0) await sleep(rest);
}

export const u = (n: number): string => `calc(var(--u) * ${n})`;
