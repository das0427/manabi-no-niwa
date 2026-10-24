import { useCallback, useRef, useState } from 'react';
import * as Q from './questionFlow';

/**
 * 1問の状態を React で扱うフック。判定はモードが行い、結果をここに伝える。
 * 状態は ref にも持ち、同じ瞬間の二重タップでも二重に確定しない（OP-05）。
 */
export function useQuestion() {
  const ref = useRef<Q.QuestionState>(Q.initialQuestion());
  const [state, setState] = useState<Q.QuestionState>(ref.current);
  const set = useCallback((next: Q.QuestionState) => {
    ref.current = next;
    setState(next);
    return next;
  }, []);

  return {
    state,
    /** いまの状態（同期的に読む） */
    get current() {
      return ref.current;
    },
    /** 選択の受け付け。false ならその操作は無視する */
    tap: useCallback(() => {
      const r = Q.tap(ref.current, Date.now());
      set(r.state);
      return r.accepted;
    }, [set]),
    wrong: useCallback(() => set(Q.wrong(ref.current)), [set]),
    correct: useCallback(() => set(Q.correct(ref.current)), [set]),
    hint: useCallback(() => set(Q.hintButton(ref.current)), [set]),
    review: useCallback(() => set(Q.review(ref.current)), [set]),
    skip: useCallback(() => set(Q.skip(ref.current)), [set]),
    reset: useCallback(() => set(Q.initialQuestion()), [set]),
    /**
     * 中断データから戻す。誤答・ヒント・見直しの回数は引き継ぐ（再開で自力扱いに戻らない）。
     * 確定（done/outcome）は捨てる: 確定後に保存された下書きで、再開した問題が操作できなくなるのを防ぐ。
     */
    restore: useCallback(
      (s: Q.QuestionState) => set({ ...s, tapTimes: [], done: false, outcome: null }),
      [set],
    ),
  };
}

export type QuestionApi = ReturnType<typeof useQuestion>;
