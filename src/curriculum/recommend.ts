/**
 * 小学生の「きょうの おすすめ」（純粋関数）。順に: 期限が来た復習（同じ教科は1件: review.ts pickReviews）→
 * とりくみちゅうの単元（最近さわった順）→ まだの単元で前提がそろっているもの（索引の順）。
 * 強制しない（ux-by-age 2.2）。
 */
import type { UnitProgress } from '../core/types';
import { isReviewDue, pickReviews, type ReviewCandidate } from './review';
import type { StageId, UnitMeta } from './types';

export interface UnitRec {
  unitId: string;
  kind: 'review' | 'continue' | 'next';
}

export function recommendUnits(input: {
  index: readonly UnitMeta[];
  progress: readonly UnitProgress[];
  stage: StageId;
  now: number;
  limit?: number;
}): UnitRec[] {
  const limit = input.limit ?? 3;
  const visible = input.index.filter((u) => u.status !== 'planned');
  const byId = new Map(visible.map((u) => [u.id, u]));
  const prog = new Map(input.progress.map((p) => [p.unitId, p]));
  const dependents = (id: string) => visible.filter((u) => u.prereq.includes(id)).length;
  const out: UnitRec[] = [];
  const add = (unitId: string, kind: UnitRec['kind']) => {
    if (out.length < limit && !out.some((r) => r.unitId === unitId)) out.push({ unitId, kind });
  };

  const cands: ReviewCandidate[] = input.progress
    .filter((p) => byId.has(p.unitId) && isReviewDue(p.review, input.now))
    .map((p) => ({
      unitId: p.unitId,
      subject: byId.get(p.unitId)!.subject,
      state: p.review,
      dependents: dependents(p.unitId),
    }));
  for (const id of pickReviews(cands, input.now, Math.min(2, limit))) add(id, 'review');

  for (const p of [...input.progress]
    .filter((p) => byId.has(p.unitId) && p.review.stage === 'learning')
    .sort((a, b) => b.changedAt - a.changedAt))
    add(p.unitId, 'continue');

  const learned = (id: string) => {
    const st = prog.get(id)?.review.stage;
    return st === 'learned' || st === 'secured';
  };
  for (const u of visible) {
    if (u.stage !== input.stage || prog.get(u.id)?.attempted) continue;
    // 前提が索引に無い（未実装）ときは、そろっているとみなす（先へ進めなくならないように）
    if (u.prereq.every((p) => !byId.has(p) || learned(p))) add(u.id, 'next');
  }
  return out;
}
