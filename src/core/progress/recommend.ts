/**
 * ホームの「きょうの おすすめ」（2〜3件）。純粋関数。
 * 仕様: docs/architecture.md 4.5, docs/learning-design.md 12章。
 * 同じ日・同じ記録なら同じ結果になる（日付から作る seed で同点を決める）。
 */
import type { ModeId, RoundRecord } from '../types';
import { MODE_IDS } from '../types';
import { hashSeed } from '../util/rng';

export type Domain = 'number' | 'letter' | 'shape' | 'think';

export const MODE_DOMAIN: Record<ModeId, Domain> = {
  shopping: 'number',
  math: 'number',
  compare: 'number',
  hiragana: 'letter',
  trace: 'letter',
  shapes: 'shape',
  road: 'shape',
  sorting: 'think',
  memory: 'think',
};

export interface RecommendInput {
  /** YYYY-MM-DD（端末の日付） */
  today: string;
  /** 今日0時の時刻（ms） */
  todayStart: number;
  favorites: ModeId[];
  rounds: RoundRecord[];
  /** 進みかけ（今の段階で5問以上、まだ進んでいない）のモード */
  inProgress: ModeId[];
  /** ホームに表示しているモード（保護者設定） */
  visible: ModeId[];
}

export interface Recommendation {
  modeId: ModeId;
  /** 保護者画面に出す理由 */
  reason: string;
}

const DAY = 24 * 60 * 60 * 1000;

export function recommend(input: RecommendInput): Recommendation[] {
  const visible = MODE_IDS.filter((m) => input.visible.includes(m));
  const hasHistory = input.rounds.length > 0;
  if (!hasHistory) {
    const first: Recommendation[] = (['shopping', 'sorting', 'trace'] as ModeId[])
      .filter((m) => visible.includes(m))
      .map((modeId) => ({ modeId, reason: 'はじめての方への おすすめです' }));
    if (first.length >= 2) return first;
  }

  const lastPlayed = new Map<ModeId, number>();
  const todayCount = new Map<ModeId, number>();
  for (const r of input.rounds) {
    lastPlayed.set(r.modeId, Math.max(lastPlayed.get(r.modeId) ?? 0, r.startedAt));
    if (r.startedAt >= input.todayStart) {
      todayCount.set(r.modeId, (todayCount.get(r.modeId) ?? 0) + 1);
    }
  }
  const tie = (m: ModeId) => hashSeed(input.today, m) / 2 ** 32;
  const candidates = visible.filter((m) => (todayCount.get(m) ?? 0) < 2);

  const picked: Recommendation[] = [];
  const usedDomains = new Set<Domain>();
  const take = (m: ModeId, reason: string) => {
    if (picked.length >= 3) return;
    if (picked.some((p) => p.modeId === m)) return;
    if (usedDomains.has(MODE_DOMAIN[m])) return;
    picked.push({ modeId: m, reason });
    usedDomains.add(MODE_DOMAIN[m]);
  };

  // 1. すきなもの（今日まだ遊んでいないもの優先）
  const fav = candidates
    .filter((m) => input.favorites.includes(m))
    .sort((a, b) => (todayCount.get(a) ?? 0) - (todayCount.get(b) ?? 0) || tie(a) - tie(b));
  if (fav[0]) take(fav[0], 'すきな あそびです');

  // 2. 3日以上遊んでいない（一度も遊んでいないものを含む）
  const stale = candidates
    .filter((m) => input.todayStart - (lastPlayed.get(m) ?? 0) >= 3 * DAY)
    .sort((a, b) => (lastPlayed.get(a) ?? 0) - (lastPlayed.get(b) ?? 0) || tie(a) - tie(b));
  for (const m of stale) {
    take(m, lastPlayed.has(m) ? '3日以上 あそんでいません' : 'まだ あそんでいません');
    if (picked.length >= 2) break;
  }

  // 3. 進みかけ
  for (const m of candidates
    .filter((m) => input.inProgress.includes(m))
    .sort((a, b) => tie(a) - tie(b))) {
    take(m, 'もう少しで つぎの だんかいです');
    if (picked.length >= 3) break;
  }

  // 足りなければ、領域が重ならないものを日付の順で
  for (const m of [...candidates].sort((a, b) => tie(a) - tie(b))) {
    if (picked.length >= 2) break;
    take(m, 'いろいろな あそびを ためせるように えらびました');
  }
  return picked;
}
