import { describe, expect, it } from 'vitest';
import {
  correct,
  hintButton,
  initialQuestion,
  outcomeOf,
  praiseFor,
  review,
  skip,
  tap,
  wrong,
} from './questionFlow';

describe('questionFlow: 状態表（architecture.md 4.3）', () => {
  it('最初の選択で正解 → independent', () => {
    expect(correct(initialQuestion()).outcome).toBe('independent');
  });
  it('誤答 → ヒント1 → 正解 → self_corrected', () => {
    const s = wrong(initialQuestion());
    expect(s.hintLevel).toBe(1);
    expect(s.canSkip).toBe(false);
    expect(correct(s).outcome).toBe('self_corrected');
  });
  it('ヒントボタン1回の後に正解 → self_corrected', () => {
    expect(correct(hintButton(initialQuestion())).outcome).toBe('self_corrected');
  });
  it('誤答2回 → ヒント2と「つぎへ」→ 正解は after_hint', () => {
    const s = wrong(wrong(initialQuestion()));
    expect(s.hintLevel).toBe(2);
    expect(s.canSkip).toBe(true);
    expect(correct(s).outcome).toBe('after_hint');
  });
  it('ヒントボタン2回 → after_hint', () => {
    expect(correct(hintButton(hintButton(initialQuestion()))).outcome).toBe('after_hint');
  });
  it('見直しの後に正解 → after_review（ヒント2がなければ）', () => {
    expect(correct(review(initialQuestion())).outcome).toBe('after_review');
    expect(correct(review(wrong(initialQuestion()))).outcome).toBe('after_review');
  });
  it('ヒント2は見直しより優先', () => {
    expect(correct(review(wrong(wrong(initialQuestion())))).outcome).toBe('after_hint');
  });
  it('つぎへ → skipped', () => {
    expect(skip(wrong(wrong(initialQuestion()))).outcome).toBe('skipped');
    expect(outcomeOf(initialQuestion(), true)).toBe('skipped');
  });
  it('確定後は操作を受け付けない', () => {
    const s = correct(initialQuestion());
    expect(tap(s, 0).accepted).toBe(false);
    expect(wrong(s)).toBe(s);
  });
});

describe('questionFlow: 連打', () => {
  it('1.5秒以内に3回の選択で operationIssue', () => {
    let s = initialQuestion();
    s = tap(s, 0).state;
    s = tap(s, 500).state;
    expect(s.operationIssue).toBe(false);
    s = tap(s, 1400).state;
    expect(s.operationIssue).toBe(true);
  });
  it('ゆっくりなら operationIssue にならない', () => {
    let s = initialQuestion();
    for (const t of [0, 1600, 3200, 4800]) s = tap(s, t).state;
    expect(s.operationIssue).toBe(false);
  });
});

describe('praiseFor', () => {
  it('行動に基づく声かけだけを返す', () => {
    expect(praiseFor(correct(initialQuestion()))).toBeNull();
    expect(praiseFor(correct(initialQuestion()), { counted: true })).toBe('praise.counted');
    expect(praiseFor(correct(wrong(initialQuestion())))).toBe('praise.self-fixed');
    expect(praiseFor(correct(review(initialQuestion())))).toBe('praise.reviewed');
    expect(praiseFor(correct(wrong(wrong(initialQuestion()))), { counted: true })).toBeNull();
  });
});
