/**
 * 利用時間の目安の判定（CX-04: 区切りでだけ知らせる）。v1 のモード（ModeRunner）と単元（UnitRunner）の完了で共通に使う。
 *
 * 判定: きょう（端末の時刻の 0 時から）の回の長さ（終わり − 始まり）の合計が、目安（分）以上か。
 * 目安が 0（なし）のときは常に false。回の途中では判定せず、回の終わりで1回だけ使う。
 */
import * as db from '../storage/index';
import type { RoundRecord } from '../types';

/** きょうの始まり（端末の時刻の 0 時）。ms */
export function dayStartOf(now: number = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 回の長さの合計（ms）。終わりが始まりより前の記録は 0 として数える */
export function playedMsOf(rounds: readonly Pick<RoundRecord, 'startedAt' | 'endedAt'>[]): number {
  return rounds.reduce((sum, r) => sum + Math.max(0, r.endedAt - r.startedAt), 0);
}

/** 回の長さの合計が目安（分）に達したか。目安が 0 以下（なし）のときは false */
export function reachedSessionLimit(playedMs: number, sessionMinutes: number): boolean {
  return sessionMinutes > 0 && playedMs >= sessionMinutes * 60_000;
}

/**
 * きょうの回を読んで、目安に達したかを返す（回の終わりの記録を書いたあとで呼ぶ）。
 * 読めなかったとき（保存が使えない端末など）は false（合図を出さない側に倒す。listRounds は reject しない）。
 */
export async function isSessionTimeUp(
  profileId: string,
  sessionMinutes: number,
  now: number = Date.now(),
): Promise<boolean> {
  if (!(sessionMinutes > 0)) return false;
  const rounds = await db.listRounds(profileId, { since: dayStartOf(now) });
  return reachedSessionLimit(playedMsOf(rounds), sessionMinutes);
}
