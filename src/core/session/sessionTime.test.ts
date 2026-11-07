import { beforeEach, describe, expect, it } from 'vitest';
import { addRound, createProfile, deleteAllData, openStorage } from '../storage/index';
import type { RoundRecord } from '../types';
import { dayStartOf, isSessionTimeUp, playedMsOf, reachedSessionLimit } from './sessionTime';

/**
 * 利用時間の目安の判定（FX10。v1 のモードと単元の完了で共通）。
 * v1 の ModeRunner にあった判定（きょうの回の長さの合計 ≧ 目安）を、そのまま関数にしたもの。
 */

const MIN = 60_000;

describe('きょうの始まり・回の長さの合計・目安に達したか', () => {
  it('dayStartOf は端末の時刻の 0 時', () => {
    const now = new Date(2026, 10, 7, 15, 30, 45).getTime();
    expect(dayStartOf(now)).toBe(new Date(2026, 10, 7, 0, 0, 0, 0).getTime());
  });

  it('回の長さの合計。終わりが始まりより前の記録は 0 として数える', () => {
    expect(playedMsOf([])).toBe(0);
    expect(
      playedMsOf([
        { startedAt: 1000, endedAt: 61_000 },
        { startedAt: 5000, endedAt: 2000 },
        { startedAt: 0, endedAt: 30_000 },
      ]),
    ).toBe(90_000);
  });

  it('目安（分）以上で true。目安が 0 以下（なし）は常に false', () => {
    expect(reachedSessionLimit(5 * MIN - 1, 5)).toBe(false);
    expect(reachedSessionLimit(5 * MIN, 5)).toBe(true);
    expect(reachedSessionLimit(99 * MIN, 5)).toBe(true);
    expect(reachedSessionLimit(99 * MIN, 0)).toBe(false);
    expect(reachedSessionLimit(99 * MIN, -1)).toBe(false);
  });
});

describe('isSessionTimeUp（きょうの回を読んで判定する）', () => {
  beforeEach(async () => {
    await openStorage();
    await deleteAllData();
  });

  const round = (profileId: string, startedAt: number, minutes: number): RoundRecord => ({
    profileId,
    modeId: 'unit',
    unitId: 'p4.env.seasons',
    variantId: 'main',
    startedAt,
    endedAt: startedAt + minutes * MIN,
    count: 4,
    completed: true,
  });

  it('きょうの回の合計が目安に届けば true、届かなければ false', async () => {
    const p = await createProfile('はな', 'cat');
    const now = new Date(2026, 10, 7, 15, 0, 0).getTime();
    const morning = new Date(2026, 10, 7, 9, 0, 0).getTime();
    await addRound(round(p.id, morning, 3));
    expect(await isSessionTimeUp(p.id, 5, now)).toBe(false);
    await addRound(round(p.id, morning + 10 * MIN, 2));
    expect(await isSessionTimeUp(p.id, 5, now)).toBe(true);
    expect(await isSessionTimeUp(p.id, 6, now)).toBe(false);
  });

  it('きのうの回と、ほかのプロフィールの回は数えない', async () => {
    const a = await createProfile('はな', 'cat');
    const b = await createProfile('たろう', 'dog');
    const now = new Date(2026, 10, 7, 15, 0, 0).getTime();
    await addRound(round(a.id, new Date(2026, 10, 6, 20, 0, 0).getTime(), 30));
    await addRound(round(b.id, new Date(2026, 10, 7, 9, 0, 0).getTime(), 30));
    expect(await isSessionTimeUp(a.id, 5, now)).toBe(false);
    expect(await isSessionTimeUp(b.id, 5, now)).toBe(true);
  });

  it('目安が 0（なし）のときは、回があっても false', async () => {
    const p = await createProfile('はな', 'cat');
    const now = new Date(2026, 10, 7, 15, 0, 0).getTime();
    await addRound(round(p.id, new Date(2026, 10, 7, 9, 0, 0).getTime(), 60));
    expect(await isSessionTimeUp(p.id, 0, now)).toBe(false);
  });
});
