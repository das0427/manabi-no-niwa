import { describe, expect, it } from 'vitest';
import { pendingWriteCount, trackPending, waitPendingWrites } from './pendingWrites';

describe('終わっていない保存の一覧', () => {
  it('何も登録されていなければ、すぐ終わる', async () => {
    await waitPendingWrites();
    expect(pendingWriteCount()).toBe(0);
  });

  it('登録した保存が終わるまで待ち、終わると一覧から外れる。渡した Promise をそのまま返す', async () => {
    let finish!: () => void;
    const slow = new Promise<number>((resolve) => {
      finish = () => resolve(7);
    });
    expect(trackPending(slow)).toBe(slow);
    expect(pendingWriteCount()).toBe(1);
    let waited = false;
    const waiting = waitPendingWrites().then(() => {
      waited = true;
    });
    await Promise.resolve();
    expect(waited).toBe(false);
    finish();
    await waiting;
    expect(waited).toBe(true);
    expect(pendingWriteCount()).toBe(0);
  });

  it('失敗した保存があっても待ちは終わる（落ちない）', async () => {
    const failing = Promise.reject(new Error('boom'));
    trackPending(failing).catch(() => {});
    await expect(waitPendingWrites()).resolves.toBeUndefined();
    expect(pendingWriteCount()).toBe(0);
  });

  it('待っているあいだに増えた保存も待つ', async () => {
    let finishSecond!: () => void;
    const first = new Promise<void>((resolve) => setTimeout(resolve, 0));
    trackPending(first);
    let waited = false;
    const waiting = waitPendingWrites().then(() => {
      waited = true;
    });
    await first;
    trackPending(
      new Promise<void>((resolve) => {
        finishSecond = resolve;
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(waited).toBe(false);
    finishSecond();
    await waiting;
    expect(waited).toBe(true);
  });
});
