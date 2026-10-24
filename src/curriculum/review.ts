/**
 * 習熟の段階と、間隔をあけた復習（docs/expansion/architecture.md 3章）。純粋関数。
 * 段階の上下（v1 の core/progress/rules.ts）とは独立に持つ。復習に失敗しても段階は下げない。
 *
 *   none ──取り組む──▶ learning ──最上段で進む条件──▶ learned
 *   learned ──復習1・2回通過──▶ learned（間隔が伸びる）──復習3回目通過──▶ secured
 *   learned / secured ──復習で支援が多い──▶ learning（翌日にもう一度復習を出す）
 */
import type { Outcome } from '../core/types';

export type Stage = 'none' | 'learning' | 'learned' | 'secured';

export interface ReviewState {
  stage: Stage;
  /** 次の復習の時刻（ms）。null は復習なし */
  reviewDue: number | null;
  /** 通過した復習の回数（0〜3） */
  reviewStep: number;
  lastReviewAt: number | null;
}

const DAY = 24 * 60 * 60 * 1000;
/** reviewStep ごとの次の復習までの日数（0回通過→1日後, 1→3日, 2→7日, 3以上→21日） */
export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 21] as const;
export const REVIEW_SECURE_AFTER = 3;
/** 1回の復習の問題数（目安） */
export const REVIEW_SIZE = 3;

export const initialReview: ReviewState = {
  stage: 'none',
  reviewDue: null,
  reviewStep: 0,
  lastReviewAt: null,
};

function dueAfter(step: number, now: number): number {
  const i = Math.min(step, REVIEW_INTERVAL_DAYS.length - 1);
  return now + REVIEW_INTERVAL_DAYS[i]! * DAY;
}

/** 取り組んだ（abandoned 以外の結果が出た） */
export function onAttempt(s: ReviewState): ReviewState {
  return s.stage === 'none' ? { ...s, stage: 'learning' } : s;
}

/** 最上段で進む条件を満たした（v1 の change === 'mastered'） */
export function onMastered(s: ReviewState, now: number): ReviewState {
  if (s.stage === 'learned' || s.stage === 'secured') return s;
  return { ...s, stage: 'learned', reviewStep: 0, reviewDue: dueAfter(0, now) };
}

/** 復習の合格: 数えた問題のうち自力（independent）が 2/3 以上 */
export function reviewPassed(outcomes: Outcome[]): boolean {
  const counted = outcomes.filter((o) => o !== 'abandoned');
  if (counted.length === 0) return false;
  const ok = counted.filter((o) => o === 'independent').length;
  return ok * 3 >= counted.length * 2;
}

/**
 * 復習の結果を反映する。数えられる結果が無い（途中でやめた）ときは何も変えない。
 * learning からの復習（失敗の翌日の復習）に通れば learned に戻る。
 */
export function onReview(s: ReviewState, outcomes: Outcome[], now: number): ReviewState {
  if (outcomes.every((o) => o === 'abandoned')) return s;
  if (s.stage === 'none') return s;
  if (!reviewPassed(outcomes)) {
    return { stage: 'learning', reviewStep: 0, reviewDue: dueAfter(0, now), lastReviewAt: now };
  }
  if (s.stage === 'learning') {
    // 失敗のあとの復習。learned に戻し、間隔は最初から
    return { stage: 'learned', reviewStep: 0, reviewDue: dueAfter(0, now), lastReviewAt: now };
  }
  const step = Math.min(s.reviewStep + 1, REVIEW_SECURE_AFTER);
  return {
    stage: step >= REVIEW_SECURE_AFTER ? 'secured' : 'learned',
    reviewStep: step,
    reviewDue: dueAfter(step, now),
    lastReviewAt: now,
  };
}

export function isReviewDue(s: ReviewState, now: number): boolean {
  return s.reviewDue !== null && s.reviewDue <= now;
}

/** 子供画面の状態の印（ux-by-age.md 2.3。色だけに頼らず形で区別） */
export type UnitMark = 'not-started' | 'in-progress' | 'done' | 'secured' | 'review-due';

export function unitMark(s: ReviewState, now: number): UnitMark {
  if (s.stage === 'none') return 'not-started';
  if (isReviewDue(s, now)) return 'review-due';
  if (s.stage === 'learning') return 'in-progress';
  return s.stage === 'secured' ? 'secured' : 'done';
}
