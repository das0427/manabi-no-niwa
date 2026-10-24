/**
 * うさぎが経路に沿ってマスごとに進む動き（1マス 300ms）。
 * 動きを減らす設定のときは、歩かずに経路を一度に表示してから結果を出す。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Pos } from './board';

export const STEP_MS = 300;
/** 動きを減らす設定のとき、経路を見せてから結果を出すまでの時間 */
export const STILL_MS = 500;

export interface WalkState {
  path: readonly Pos[];
  /** うさぎがいま path の何番目にいるか */
  step: number;
}

export function useWalker(reduceMotion: boolean) {
  const [walk, setWalk] = useState<WalkState | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const clear = useCallback(() => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  useEffect(() => clear, [clear]);

  /** path を歩き終えたら done を呼ぶ */
  const start = useCallback(
    (path: readonly Pos[], done: () => void) => {
      clear();
      if (reduceMotion || path.length <= 1) {
        setWalk({ path, step: path.length - 1 });
        timer.current = window.setTimeout(done, path.length <= 1 ? 200 : STILL_MS);
        return;
      }
      setWalk({ path, step: 0 });
      let i = 0;
      const tick = () => {
        i += 1;
        setWalk({ path, step: i });
        timer.current = window.setTimeout(i >= path.length - 1 ? done : tick, STEP_MS);
      };
      timer.current = window.setTimeout(tick, STEP_MS);
    },
    [clear, reduceMotion],
  );

  const reset = useCallback(() => {
    clear();
    setWalk(null);
  }, [clear]);

  return { walk, start, reset };
}
