import { describe, expect, it } from 'vitest';
import { PRESCHOOL_HOMES, recommendCards, type CardRecInput } from './preschoolHome';

const DAY = 86400000;
const todayStart = Date.UTC(2026, 9, 24);
const base = (over: Partial<CardRecInput> = {}): CardRecInput => ({
  cards: PRESCHOOL_HOMES.p4!.cards,
  today: '2026-10-24',
  todayStart,
  rounds: [],
  favorites: [],
  legacyModeOf: (u) => (u === 'p4.math.shop' ? 'shopping' : undefined),
  domainOf: (c) => c.id,
  ...over,
});

describe('幼児ホームの きょうの おすすめ', () => {
  it('はじめては2件・同じ日は同じ結果', () => {
    const a = recommendCards(base());
    expect(a.length).toBeGreaterThanOrEqual(2);
    expect(a.length).toBeLessThanOrEqual(3);
    expect(recommendCards(base())).toEqual(a);
  });
  it('すきな札を先に・今日2回遊んだ札は出さない', () => {
    const r = recommendCards(base({ favorites: ['memory'] }));
    expect(r[0]!.cardId).toBe('memory');
    const rounds = [0, 1].map((k) => ({
      modeId: 'shopping',
      variantId: 'main',
      startedAt: todayStart + k * 1000,
    }));
    const r2 = recommendCards(base({ favorites: ['shopping'], rounds }));
    expect(r2.map((x) => x.cardId)).not.toContain('shopping');
  });
  it('単元の回は札に数える（最近遊んだ札より、遊んでいない札が先）', () => {
    const cards = PRESCHOOL_HOMES.p4!.cards;
    const rounds = cards
      .filter((c) => c.id !== 'road')
      .map((c) => ({ modeId: 'unit', variantId: c.units[0]!, startedAt: todayStart - DAY }));
    const r = recommendCards(base({ rounds }));
    expect(r[0]!.cardId).toBe('road');
  });
  it('領域が重ならない（足りないときだけ重ねて2件）', () => {
    const r = recommendCards(base({ domainOf: () => 'same' }));
    expect(r.length).toBe(2);
  });
});
