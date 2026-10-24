import { describe, expect, it } from 'vitest';
import type { Outcome, SkillProgress } from '../types';
import { createRng } from '../util/rng';
import { addOutcome, emptyProgress, evaluate, explainProgress, looksHard, RULES } from './rules';

const base = () => emptyProgress('p1', 'shop');
const feed = (p: SkillProgress, list: Outcome[]) => list.reduce((acc, o) => addOutcome(acc, o), p);
const ev = (
  p: SkillProgress,
  levelCount = 4,
  extra: Partial<Parameters<typeof evaluate>[1]> = {},
) => evaluate(p, { levelCount, now: 1000, ...extra });

describe('addOutcome', () => {
  it('abandoned と operationIssue は窓に入れない', () => {
    let p = addOutcome(base(), 'abandoned');
    p = addOutcome(p, 'independent', true);
    expect(p.window).toEqual([]);
    expect(p.attempted).toBe(true);
  });
  it('窓は最大10件', () => {
    const p = feed(base(), Array(15).fill('independent'));
    expect(p.window).toHaveLength(RULES.windowSize);
  });
});

describe('evaluate: 進む', () => {
  it('1問の正解では進まない', () => {
    expect(ev(feed(base(), ['independent'])).change).toBeNull();
  });
  it('9件では8件独立でも進まない（最低10件）', () => {
    expect(ev(feed(base(), Array(9).fill('independent'))).change).toBeNull();
  });
  it('10件中8件独立で進み、窓は空になる', () => {
    const list: Outcome[] = [...Array(8).fill('independent'), 'self_corrected', 'after_hint'];
    const r = ev(feed(base(), list));
    expect(r.change).toBe('up');
    expect(r.next.level).toBe(1);
    expect(r.next.window).toEqual([]);
    expect(r.next.lastChange?.reason).toBe('promote');
  });
  it('10件中7件独立では進まない', () => {
    const list: Outcome[] = [...Array(7).fill('independent'), ...Array(3).fill('self_corrected')];
    expect(ev(feed(base(), list)).change).toBeNull();
  });
  it('最上段では mastered になり段階は変わらない', () => {
    const p = { ...feed(base(), Array(10).fill('independent')), level: 3 };
    const r = ev(p, 4);
    expect(r.change).toBe('mastered');
    expect(r.next.level).toBe(3);
    expect(r.next.mastered).toBe(true);
  });
  it('探索の段階は件数で進む', () => {
    const r = ev(feed(base(), Array(10).fill('self_corrected')), 2, { autoPromoteAfter: 10 });
    expect(r.change).toBe('up');
  });
});

describe('evaluate: 戻る', () => {
  const struggling: Outcome[] = [
    'after_hint',
    'skipped',
    'after_hint',
    'independent',
    'after_hint',
    'skipped',
  ];
  it('第1段階より下には戻らない', () => {
    expect(ev(feed(base(), [...struggling, ...struggling])).change).toBeNull();
  });
  it('段階が変わってから8件未満では戻らない', () => {
    const p = { ...feed(base(), struggling), level: 2 };
    expect(ev(p).change).toBeNull();
  });
  it('直近6件で独立1以下・ヒント後+スキップ4以上なら戻る', () => {
    const p = { ...feed(base(), ['independent', 'independent', ...struggling]), level: 2 };
    const r = ev(p);
    expect(r.change).toBe('down');
    expect(r.next.level).toBe(1);
  });
  it('見直し後・もういちどやって正解は戻る判定に数えない', () => {
    const list: Outcome[] = [
      'after_review',
      'after_review',
      'self_corrected',
      'after_review',
      'self_corrected',
      'after_review',
      'self_corrected',
      'after_review',
    ];
    const p = { ...feed(base(), list), level: 2 };
    expect(ev(p).change).toBeNull();
  });
});

describe('evaluate: 保護者の固定', () => {
  it('固定中は成績に関係なく変化しない', () => {
    const p = feed(base(), Array(10).fill('independent'));
    expect(ev(p, 4, { locked: 0 }).change).toBeNull();
    expect(ev(p, 4, { locked: 0 }).next.level).toBe(0);
  });
  it('固定の段階が違えばその段階にして窓を空にする', () => {
    const p = feed(base(), Array(5).fill('independent'));
    const r = ev(p, 4, { locked: 2 });
    expect(r.next.level).toBe(2);
    expect(r.next.window).toEqual([]);
  });
});

describe('でたらめに押した場合の誤って進む確率（AD-07 / docs/test-plan.md に記録）', () => {
  /**
   * 2択・1回4問・10回（40問）を、毎回ランダムに押すシミュレーション。
   * 1問目のタップが正解なら independent、そうでなければ self_corrected（2択では残りが正解）。
   * 連打（operationIssue）による除外は考えない（＝実際より厳しい条件）。
   */
  function simulate(choices: number, rounds: number, perRound: number, trials: number): number {
    const rng = createRng(12345);
    let promoted = 0;
    for (let t = 0; t < trials; t++) {
      let p = base();
      let up = false;
      for (let r = 0; r < rounds && !up; r++) {
        for (let q = 0; q < perRound; q++) {
          p = addOutcome(p, rng.int(1, choices) === 1 ? 'independent' : 'self_corrected');
        }
        if (evaluate(p, { levelCount: 4, now: 0, chance: 1 / choices }).change === 'up') up = true;
      }
      if (up) promoted++;
    }
    return promoted / trials;
  }

  it('2択・4問×10回で誤って進む確率は1割未満（実測 7.3%）', () => {
    const rate = simulate(2, 10, 4, 20000);
    // 実測 0.073（seed 12345, 20000試行）。2択の段階は 10件中9件で進む（chance=0.5）。
    // 8件のままだと 0.285 だったため、偶然の確率で条件を変える設計にした。
    expect(rate).toBeGreaterThan(0.04);
    expect(rate).toBeLessThan(0.1);
  });

  it('3択では3%未満（実測 2.4%）', () => {
    // 実測 0.0237
    expect(simulate(3, 10, 4, 20000)).toBeLessThan(0.03);
  });
});

describe('説明文', () => {
  it('未実施', () => {
    expect(explainProgress(base(), 4, 'S1')).toContain('まだ取り組んでいません');
  });
  it('あと何問', () => {
    const p = feed(base(), [...Array(6).fill('independent'), ...Array(4).fill('after_hint')]);
    expect(explainProgress(p, 4, 'S1')).toContain('あと 2 問');
  });
  it('むずかしそう', () => {
    expect(looksHard(feed(base(), Array(6).fill('after_hint')))).toBe(true);
    expect(looksHard(feed(base(), Array(5).fill('after_hint')))).toBe(false);
  });
});
