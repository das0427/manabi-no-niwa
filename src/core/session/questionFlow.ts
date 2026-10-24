/**
 * 1問の進み方（誤答・ヒント・見直し・つぎへ）と、結果の種類の決め方。純粋関数。
 * 仕様: docs/architecture.md 4.3 の状態表、docs/learning-design.md 0.1〜0.2。
 *
 * 使い方（モード側）:
 *   - 選択肢を押したら tap(now) で受け付け可否を確認（ロック中・連打を判定）
 *   - 判定して wrong() か correct()
 *   - 「ヒント」ボタン → hintButton()、「もういちど みる」→ review()、「つぎへ」→ skip()
 *   - 確定した outcome を session.record() に渡す
 */
import type { Outcome } from '../types';

export interface QuestionState {
  wrongTries: number;
  /** 0: なし / 1: 注目させるヒント / 2: 具体的なヒント */
  hintLevel: 0 | 1 | 2;
  /** ヒントボタンを押した回数 */
  hintsUsed: number;
  reviewsUsed: number;
  /** 直近の選択の時刻（連打の判定用） */
  tapTimes: number[];
  operationIssue: boolean;
  /** 正解・つぎへ で確定した */
  done: boolean;
  outcome: Outcome | null;
  /** 「つぎへ」を出してよいか（ヒント2の後） */
  canSkip: boolean;
  /** 誤答にしない「もう一度」（値は合っているが形が違う 等）の回数。古い中断データには無い */
  nudges?: number;
}

/** nudge は同じ問題でこの回数まで。超えたら誤答として扱う */
export const MAX_NUDGES = 2;

export const RAPID_TAPS = 3;
export const RAPID_WINDOW_MS = 1500;
/** 誤答がこの回数に達したら「つぎへ」も出す（ヒント2と同時） */
export const SKIP_AFTER_WRONG = 2;

export function initialQuestion(): QuestionState {
  return {
    wrongTries: 0,
    hintLevel: 0,
    hintsUsed: 0,
    reviewsUsed: 0,
    tapTimes: [],
    operationIssue: false,
    done: false,
    outcome: null,
    canSkip: false,
  };
}

/** 選択の操作を記録する。確定済みなら受け付けない（false） */
export function tap(s: QuestionState, now: number): { state: QuestionState; accepted: boolean } {
  if (s.done) return { state: s, accepted: false };
  const tapTimes = [...s.tapTimes, now].filter((t) => now - t <= RAPID_WINDOW_MS);
  const operationIssue = s.operationIssue || tapTimes.length >= RAPID_TAPS;
  return { state: { ...s, tapTimes, operationIssue }, accepted: true };
}

/** 誤答。ヒントの段階を上げる（1回目→1、2回目以降→2 と「つぎへ」） */
export function wrong(s: QuestionState): QuestionState {
  if (s.done) return s;
  const wrongTries = s.wrongTries + 1;
  const hintLevel = (wrongTries >= SKIP_AFTER_WRONG ? 2 : Math.max(s.hintLevel, 1)) as 1 | 2;
  return { ...s, wrongTries, hintLevel, canSkip: s.canSkip || hintLevel === 2 };
}

/** 「ヒント」ボタン。1回目→ヒント1、2回目以降→ヒント2 */
export function hintButton(s: QuestionState): QuestionState {
  if (s.done) return s;
  const hintLevel = (s.hintLevel >= 1 ? 2 : 1) as 1 | 2;
  return { ...s, hintLevel, hintsUsed: s.hintsUsed + 1, canSkip: s.canSkip || hintLevel === 2 };
}

/**
 * 誤答にしない「もう一度」（例: 約分できる、訓令式のローマ字、単位の書き忘れ）。
 * 誤答の回数もヒントも増やさず、結果の種類にも影響しない。MAX_NUDGES を超えたら wrong() と同じ。
 * escalated が true のとき、モード側は誤答として扱う（説明とヒントを出す）。
 */
export function nudge(s: QuestionState): { state: QuestionState; escalated: boolean } {
  if (s.done) return { state: s, escalated: false };
  const n = (s.nudges ?? 0) + 1;
  if (n > MAX_NUDGES) return { state: wrong({ ...s, nudges: n }), escalated: true };
  return { state: { ...s, nudges: n }, escalated: false };
}

export function review(s: QuestionState): QuestionState {
  if (s.done) return s;
  return { ...s, reviewsUsed: s.reviewsUsed + 1 };
}

/** 結果の種類（状態表の優先順） */
export function outcomeOf(s: QuestionState, skipped: boolean): Outcome {
  if (skipped) return 'skipped';
  if (s.hintLevel >= 2) return 'after_hint';
  if (s.reviewsUsed > 0) return 'after_review';
  if (s.wrongTries > 0 || s.hintLevel === 1) return 'self_corrected';
  return 'independent';
}

export function correct(s: QuestionState): QuestionState {
  if (s.done) return s;
  return { ...s, done: true, outcome: outcomeOf(s, false) };
}

export function skip(s: QuestionState): QuestionState {
  if (s.done) return s;
  return { ...s, done: true, outcome: 'skipped' };
}

/** 行動に基づく声かけのキー（正解時）。条件に当たらなければ null */
export function praiseFor(s: QuestionState, extra: { counted?: boolean } = {}): string | null {
  if (s.outcome === 'after_review') return 'praise.reviewed';
  if (s.outcome === 'self_corrected' && s.wrongTries > 0) return 'praise.self-fixed';
  if (extra.counted && (s.outcome === 'independent' || s.outcome === 'self_corrected')) {
    return 'praise.counted';
  }
  return null;
}
