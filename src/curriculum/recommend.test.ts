import { describe, expect, it } from 'vitest';
import type { UnitProgress } from '../core/types';
import { recommendUnits } from './recommend';
import { initialReview } from './review';
import type { UnitMeta } from './types';

const meta = (id: string, prereq: string[] = [], subject = 'math'): UnitMeta => ({
  id,
  pack: 'x',
  title: id,
  stage: id.split('.')[0] as UnitMeta['stage'],
  subject: subject as UnitMeta['subject'],
  domain: 'd',
  icon: 'i',
  prereq,
  priority: 'P1',
  status: 'ready',
  engine: 'choice',
});
const prog = (unitId: string, over: Partial<UnitProgress>): UnitProgress => ({
  profileId: 'p',
  unitId,
  level: 0,
  window: [],
  mastered: false,
  attempted: true,
  changedAt: 0,
  lastChange: null,
  review: { ...initialReview },
  ...over,
});

describe('きょうの おすすめ（小学生）', () => {
  const index = [
    meta('g1.math.a'),
    meta('g1.math.b', ['g1.math.a']),
    meta('g1.ja.c', [], 'ja'),
    meta('g2.math.d'),
  ];
  it('はじめては、前提のない まだの単元から', () => {
    expect(recommendUnits({ index, progress: [], stage: 'g1', now: 0 })).toEqual([
      { unitId: 'g1.math.a', kind: 'next' },
      { unitId: 'g1.ja.c', kind: 'next' },
    ]);
  });
  it('復習の期限 → とりくみちゅう → 前提がそろった次', () => {
    const progress = [
      prog('g1.math.a', {
        review: { stage: 'learned', reviewDue: 5, reviewStep: 0, lastReviewAt: null },
      }),
      prog('g1.ja.c', { review: { ...initialReview, stage: 'learning' }, changedAt: 3 }),
    ];
    expect(recommendUnits({ index, progress, stage: 'g1', now: 10 })).toEqual([
      { unitId: 'g1.math.a', kind: 'review' },
      { unitId: 'g1.ja.c', kind: 'continue' },
      { unitId: 'g1.math.b', kind: 'next' },
    ]);
  });
  it('前提が「できた」になっていない単元は次に出さない', () => {
    const progress = [prog('g1.math.a', { review: { ...initialReview, stage: 'learning' } })];
    const r = recommendUnits({ index, progress, stage: 'g1', now: 0 });
    expect(r.map((x) => x.unitId)).not.toContain('g1.math.b');
  });
});
