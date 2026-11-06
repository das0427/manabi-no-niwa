/**
 * 終わっていない保存の一覧。
 * 画面が引き下がるとき（二重起動の防止。src/core/instance）に、書き込みの途中で窓を閉じて
 * 記録を切ってしまわないよう、ここに登録された保存が全部終わるのを待つ。
 * 登録するのは、時間のかかる保存（おえかきの自動保存など）だけでよい。
 */
const pending = new Set<Promise<unknown>>();

/** 保存の Promise を登録する（終わったら自分で外れる）。渡した Promise をそのまま返す */
export function trackPending<T>(p: Promise<T>): Promise<T> {
  pending.add(p);
  const done = (): void => {
    pending.delete(p);
  };
  p.then(done, done);
  return p;
}

/** 登録された保存がすべて終わる（失敗も含む）まで待つ。待っているあいだに増えた保存も待つ */
export async function waitPendingWrites(): Promise<void> {
  while (pending.size > 0) {
    await Promise.allSettled([...pending]);
  }
}

/** 登録されている保存の数（試験用） */
export function pendingWriteCount(): number {
  return pending.size;
}
