import { describe, expect, it } from 'vitest';
import type { Item } from '../curriculum/types';
import {
  NEXT_LOCK_MS,
  draftOf,
  flowReducer,
  initialFlow,
  nextLocked,
  restoreFlow,
  type FlowDraft,
  type FlowState,
} from './unitFlow';

/**
 * 使いやすさの直し（FX01・FX08）の単体テスト。
 * FX01: 解説の板が出てから 700ms は「つぎへ」を受け付けない（判定は nextLocked。画面の動きは e2e/ux-f1.spec.ts）。
 * FX08: 中断データに途中の問題のヒント・誤答の数も入れ、再開して正解しても「自力」にならない。
 */

const item = (id: string, hints = 3): Item => ({
  engine: 'number',
  id,
  objective: 'o',
  level: 0,
  prompt: 'p',
  hints: Array.from({ length: hints }, (_, i) => `h${i + 1}`),
  explain: 'e',
  identity: id,
  fields: [{ answer: { kind: 'int', value: 1 } }],
});

const items = () => [item('a'), item('b'), item('c')];

/** 1問目を自力で正解して2問目に進んだ状態 */
function atSecond(): FlowState {
  let s = initialFlow(items(), false);
  s = flowReducer(s, { type: 'judged', j: { result: 'correct' } });
  return flowReducer(s, { type: 'next' });
}

/** 保存して読み直す（IndexedDB を通ったときと同じ、値だけの形） */
const roundTrip = (s: FlowState): FlowDraft => JSON.parse(JSON.stringify(draftOf(s))) as FlowDraft;

describe('FX01: 解説の直後の「つぎへ」の受け付け', () => {
  it('解説の板が出てから 700ms 未満は受け付けない。700ms 以上は受け付ける', () => {
    expect(NEXT_LOCK_MS).toBe(700);
    const at = 10_000;
    expect(nextLocked(at, at)).toBe(true);
    // 二重の遷移の間（100 / 150 / 250 / 400ms）は、どれも受け付けない
    for (const gap of [100, 150, 250, 400]) expect(nextLocked(at, at + gap)).toBe(true);
    expect(nextLocked(at, at + NEXT_LOCK_MS - 1)).toBe(true);
    expect(nextLocked(at, at + NEXT_LOCK_MS)).toBe(false);
    expect(nextLocked(at, at + 5_000)).toBe(false);
  });

  it('解説の板がまだ出ていない（時刻 0）ときと、時計が戻ったときは、閉じ込めない', () => {
    expect(nextLocked(0, Date.now())).toBe(false);
    expect(nextLocked(10_000, 4_000)).toBe(false);
  });
});

describe('FX08: 中断データに途中の問題のヒント・誤答の数を入れる', () => {
  it('ヒントを2回見て中断し、再開して正解すると after_hint（自力にならない）', () => {
    let s = atSecond();
    s = flowReducer(s, { type: 'hint' });
    s = flowReducer(s, { type: 'hint' });
    expect(s).toMatchObject({ index: 1, phase: 'question', hintsShown: 2 });
    const d = roundTrip(s);
    expect(d.current).toMatchObject({ index: 1, hintsShown: 2, q: { hintsUsed: 2, hintLevel: 2 } });

    let r = restoreFlow(items(), d);
    expect(r).toMatchObject({ index: 1, phase: 'question', hintsShown: 2 });
    expect(r.q).toMatchObject({ hintsUsed: 2, hintLevel: 2, done: false, outcome: null });
    r = flowReducer(r, { type: 'judged', j: { result: 'correct' } });
    expect(r.results[1]!.outcome).toBe('after_hint');
    expect(r.results[1]!.q.hintsUsed).toBe(2);
  });

  it('直す前の形（途中の状態なし）で再開すると、同じ問題が自力扱いになる（直した所の対照）', () => {
    let s = atSecond();
    s = flowReducer(s, { type: 'hint' });
    s = flowReducer(s, { type: 'hint' });
    const old: FlowDraft = { done: roundTrip(s).done };
    let r = restoreFlow(items(), old);
    expect(r).toMatchObject({ index: 1, phase: 'question', hintsShown: 0 });
    r = flowReducer(r, { type: 'judged', j: { result: 'correct' } });
    expect(r.results[1]!.outcome).toBe('independent');
  });

  it('誤答1回で中断し、再開して正解すると self_corrected。誤概念も引き継ぐ', () => {
    let s = atSecond();
    s = flowReducer(s, {
      type: 'judged',
      j: { result: 'wrong', misconception: 'm1' },
      misconceptionText: 'せつめい',
    });
    expect(s).toMatchObject({ hintsShown: 1, lastMisconception: 'm1' });
    const d = roundTrip(s);
    expect(d.current).toMatchObject({ q: { wrongTries: 1 }, lastMisconception: 'm1' });

    let r = restoreFlow(items(), d);
    expect(r).toMatchObject({ hintsShown: 1, lastMisconception: 'm1' });
    r = flowReducer(r, { type: 'judged', j: { result: 'correct' } });
    expect(r.results[1]).toMatchObject({ outcome: 'self_corrected', misconception: 'm1' });
    expect(r.results[1]!.q.wrongTries).toBe(1);
  });

  it('「つぎへ」が出る状態（誤答2回）も戻る。誤答の数は増えも減りもしない', () => {
    let s = atSecond();
    s = flowReducer(s, { type: 'judged', j: { result: 'wrong' } });
    s = flowReducer(s, { type: 'judged', j: { result: 'wrong' } });
    const r = restoreFlow(items(), roundTrip(s));
    expect(r.q).toMatchObject({ wrongTries: 2, canSkip: true });
    const skipped = flowReducer(r, { type: 'skip' });
    expect(skipped.results[1]).toMatchObject({ outcome: 'skipped' });
    expect(skipped.results[1]!.q.wrongTries).toBe(2);
  });

  it('何も起きていない問題・解説の間・導入は、途中の状態を持たない（今までの中断データと同じ形）', () => {
    expect(draftOf(atSecond())).not.toHaveProperty('current');
    let s = flowReducer(initialFlow(items(), false), { type: 'hint' });
    s = flowReducer(s, { type: 'judged', j: { result: 'correct' } });
    expect(s.phase).toBe('explain');
    // 解説の間は、その問題はもう結果に入っている。次の問題の状態として混ぜない
    expect(draftOf(s)).not.toHaveProperty('current');
    expect(draftOf(s).done).toHaveLength(1);
    expect(draftOf(initialFlow(items(), true))).not.toHaveProperty('current');
  });

  it('2.0 までの中断データ（途中の状態なし）はそのまま再開できる', () => {
    const d = roundTrip(atSecond());
    expect(d).toEqual({ done: [expect.objectContaining({ outcome: 'independent' })] });
    expect(restoreFlow(items(), d)).toMatchObject({ index: 1, phase: 'question', hintsShown: 0 });
  });

  it('終えた問題の数と合わない途中の状態・壊れた値は使わない', () => {
    let s = atSecond();
    s = flowReducer(s, { type: 'hint' });
    const d = roundTrip(s);
    // 別の問題の途中だった（index が合わない）
    expect(restoreFlow(items(), { ...d, current: { ...d.current!, index: 2 } })).toMatchObject({
      hintsShown: 0,
    });
    // 全部終えた中断データ（done）には混ぜない
    const all = restoreFlow(items(), {
      done: [d.done[0]!, d.done[0]!, d.done[0]!],
      current: { ...d.current!, index: 3 },
    });
    expect(all.phase).toBe('done');
    // 壊れた値は 0 や初期値に直す。確定の印は引き継がない
    const broken = restoreFlow(items(), {
      ...d,
      current: {
        index: 1,
        hintsShown: -5,
        q: { wrongTries: 'x', hintLevel: 7, done: true, outcome: 'independent' },
      } as never,
    });
    expect(broken).toMatchObject({ index: 1, phase: 'question', hintsShown: 0 });
    expect(broken.q).toMatchObject({ wrongTries: 0, hintLevel: 0, done: false, outcome: null });
    // current が object でない
    expect(restoreFlow(items(), { ...d, current: 'x' as never })).toMatchObject({ hintsShown: 0 });
  });

  it('見せたヒントの数は、その問題のヒントの数を超えない（教材が変わっても壊れない）', () => {
    let s = atSecond();
    for (let i = 0; i < 3; i++) s = flowReducer(s, { type: 'hint' });
    const d = roundTrip(s);
    const fewer = [item('a'), item('b', 1), item('c')];
    expect(restoreFlow(fewer, d).hintsShown).toBe(1);
  });

  it('保存する形に連打の時刻（tapTimes）を入れない', () => {
    let s = atSecond();
    s = flowReducer(s, { type: 'hint' });
    s = { ...s, q: { ...s.q, tapTimes: [1, 2, 3] } };
    expect(roundTrip(s).current!.q.tapTimes).toEqual([]);
  });
});
