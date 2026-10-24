import { describe, expect, it } from 'vitest';
import {
  initialReview,
  isReviewDue,
  onAttempt,
  onMastered,
  onReview,
  reviewPassed,
  unitMark,
} from './review';

const DAY = 86_400_000;
const I = 'independent' as const;
const H = 'after_hint' as const;
const A = 'abandoned' as const;

describe('復習の合格', () => {
  it('自力 2/3 以上', () => {
    expect(reviewPassed([I, I, H])).toBe(true);
    expect(reviewPassed([I, H, H])).toBe(false);
    expect(reviewPassed([I, I, A])).toBe(true); // やめた問題は数えない
    expect(reviewPassed([A])).toBe(false);
  });
});

describe('段階と間隔', () => {
  it('1日→3日→7日→21日、3回目の通過で secured', () => {
    let s = onAttempt(initialReview);
    expect(s.stage).toBe('learning');
    s = onMastered(s, 0);
    expect(s).toMatchObject({ stage: 'learned', reviewDue: DAY });
    expect(isReviewDue(s, DAY - 1)).toBe(false);
    expect(isReviewDue(s, DAY)).toBe(true);
    s = onReview(s, [I, I, I], DAY);
    expect(s).toMatchObject({ stage: 'learned', reviewStep: 1, reviewDue: 4 * DAY });
    s = onReview(s, [I, I, H], 4 * DAY);
    expect(s).toMatchObject({ stage: 'learned', reviewStep: 2, reviewDue: 11 * DAY });
    s = onReview(s, [I, I, I], 11 * DAY);
    expect(s).toMatchObject({ stage: 'secured', reviewStep: 3, reviewDue: 32 * DAY });
    s = onReview(s, [I, I, I], 32 * DAY);
    expect(s).toMatchObject({ stage: 'secured', reviewDue: 53 * DAY });
  });
  it('復習で支援が多いと learning に戻り、翌日にもう一度。通れば learned', () => {
    let s = onMastered(onAttempt(initialReview), 0);
    s = onReview(s, [H, H, I], DAY);
    expect(s).toMatchObject({ stage: 'learning', reviewStep: 0, reviewDue: 2 * DAY });
    expect(unitMark(s, DAY + 1)).toBe('in-progress');
    expect(unitMark(s, 2 * DAY)).toBe('review-due');
    s = onReview(s, [I, I, I], 2 * DAY);
    expect(s).toMatchObject({ stage: 'learned', reviewStep: 0, reviewDue: 3 * DAY });
  });
  it('途中でやめた復習は何も変えない／未着手は復習しない', () => {
    const s = onMastered(onAttempt(initialReview), 0);
    expect(onReview(s, [A, A], DAY)).toBe(s);
    expect(onReview(initialReview, [I, I, I], DAY)).toBe(initialReview);
  });
  it('既に learned なら onMastered で間隔を戻さない', () => {
    const s = onReview(onMastered(onAttempt(initialReview), 0), [I, I, I], DAY);
    expect(onMastered(s, 2 * DAY)).toBe(s);
  });
  it('印', () => {
    expect(unitMark(initialReview, 0)).toBe('not-started');
    const s = onMastered(onAttempt(initialReview), 0);
    expect(unitMark(s, 0)).toBe('done');
    expect(unitMark(s, DAY)).toBe('review-due');
  });
});
