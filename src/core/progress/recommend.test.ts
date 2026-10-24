import { describe, expect, it } from 'vitest';
import { MODE_IDS, type ModeId, type RoundRecord } from '../types';
import { MODE_DOMAIN, recommend, type RecommendInput } from './recommend';

const DAY = 86400000;
const todayStart = 100 * DAY;
const round = (modeId: ModeId, startedAt: number): RoundRecord => ({
  profileId: 'p',
  modeId,
  variantId: 'main',
  startedAt,
  endedAt: startedAt + 1000,
  count: 4,
  completed: true,
});
const input = (over: Partial<RecommendInput> = {}): RecommendInput => ({
  today: '2026-10-24',
  todayStart,
  favorites: [],
  rounds: [],
  inProgress: [],
  visible: [...MODE_IDS],
  ...over,
});

describe('recommend', () => {
  it('初回は既定の3つ', () => {
    expect(recommend(input()).map((r) => r.modeId)).toEqual(['shopping', 'sorting', 'trace']);
  });

  it('2〜3件で、領域が重ならない', () => {
    for (let d = 0; d < 30; d++) {
      const rounds = MODE_IDS.map((m, i) => round(m, todayStart - (i % 5) * DAY - d * 1000));
      const r = recommend(input({ today: `2026-11-${d}`, rounds }));
      expect(r.length).toBeGreaterThanOrEqual(2);
      expect(r.length).toBeLessThanOrEqual(3);
      const domains = r.map((x) => MODE_DOMAIN[x.modeId]);
      expect(new Set(domains).size).toBe(domains.length);
    }
  });

  it('同じ日・同じ記録なら同じ結果', () => {
    const rounds = [round('math', todayStart - DAY)];
    expect(recommend(input({ rounds }))).toEqual(recommend(input({ rounds })));
  });

  it('今日2回以上遊んだモードは出さない', () => {
    const rounds = [round('shopping', todayStart + 10), round('shopping', todayStart + 20)];
    const r = recommend(input({ rounds, favorites: ['shopping'] }));
    expect(r.map((x) => x.modeId)).not.toContain('shopping');
  });

  it('すきなモードを優先し、理由を返す', () => {
    const rounds = MODE_IDS.map((m) => round(m, todayStart - DAY));
    const r = recommend(input({ rounds, favorites: ['road'] }));
    expect(r[0]).toEqual({ modeId: 'road', reason: 'すきな あそびです' });
  });

  it('表示していないモードは出さない', () => {
    const rounds = [round('math', todayStart - DAY)];
    const r = recommend(input({ rounds, visible: ['math', 'hiragana', 'shapes'] }));
    for (const x of r) expect(['math', 'hiragana', 'shapes']).toContain(x.modeId);
  });
});
