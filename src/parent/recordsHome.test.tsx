import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppStateProvider } from '../app/AppState';
import { Home } from '../app/Home';
import {
  defaultSettings,
  type AttemptRecord,
  type Profile,
  type UnitProgress,
} from '../core/types';
import * as db from '../core/storage/index';
import { UNIT_INDEX } from '../curriculum/unitIndex';
import { homeLegacyModes, homeRecommendations, preschoolHomeCards } from './homeView';
import ParentApp from './index';

/**
 * 保護者の「きろく」が、そのプロフィールの子供のホームと食い違わない（FX14）。
 * - 遊べない v1 のあそびの行（小3で13行すべて「まだ」）を出さない。
 * - 「きょうの おすすめ」は子供のホームと同じ。
 * - 単元の問題の key（内部の ID）を出さない。
 */

const DAY = 86_400_000;
const NOW = Date.now();

function attempt(over: Partial<AttemptRecord>): Omit<AttemptRecord, 'id'> {
  return {
    profileId: 'x',
    modeId: 'shopping',
    variantId: 'main',
    skillId: 'shop',
    level: 0,
    itemKey: 'りんご×1',
    outcome: 'independent',
    wrongTries: 0,
    hintsUsed: 0,
    reviewsUsed: 0,
    operationIssue: false,
    inputKind: 'mouse',
    at: NOW - 60_000,
    ...over,
  };
}

/** 単元の記録（問題の key は内部の ID の形） */
function unitAttempt(profileId: string, unitId: string, itemKey: string, over = {}) {
  return attempt({
    profileId,
    modeId: 'unit',
    unitId,
    variantId: 'main',
    skillId: null,
    itemKey,
    inputKind: 'unknown',
    ...over,
  });
}

async function makeProfile(
  opts: Pick<Profile, 'audience' | 'enrolledGrade' | 'toddlerStage'>,
): Promise<Profile> {
  const p = await db.createProfile('はな', 'cat', opts);
  await db.saveAppRecord({ ...(await db.getAppRecord()), activeProfileId: p.id });
  return p;
}

async function showRecords() {
  const view = render(
    <AppStateProvider>
      <ParentApp tab="records" />
    </AppStateProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('tab-records')).toBeTruthy());
  // 読み込み中（「読み込み中…」）が終わるまで
  await waitFor(() => expect(screen.queryByText('読み込み中…')).toBeNull());
  return view;
}

const skillRows = () =>
  [...document.querySelectorAll('tr[data-testid^="skill-"]')].map((r) =>
    r.getAttribute('data-testid')!.replace('skill-', ''),
  );

beforeEach(async () => {
  await db.openStorage();
  await db.deleteAllData();
});
afterEach(cleanup);

describe('そのホームで遊べる v1 のあそび', () => {
  it('4歳: 9つのあそびの札から、9モードすべて遊べる', async () => {
    const p = await makeProfile({ audience: 'p4' });
    expect([...homeLegacyModes(p, defaultSettings(p.id))].sort()).toEqual([
      'compare',
      'hiragana',
      'math',
      'memory',
      'road',
      'shapes',
      'shopping',
      'sorting',
      'trace',
    ]);
  });

  it('2〜3歳（3歳段階）は なぞりだけ。2歳段階・5歳・小学生は v1 のあそびの札が無い', async () => {
    const toddler3 = await makeProfile({ audience: 'toddler', toddlerStage: 3 });
    expect([...homeLegacyModes(toddler3, defaultSettings(toddler3.id))]).toEqual(['trace']);
    for (const opts of [
      { audience: 'toddler' as const, toddlerStage: 2 as const },
      { audience: 'p5' as const },
      { audience: 'g3' as const, enrolledGrade: 3 as const },
    ]) {
      const p = await makeProfile(opts);
      expect(homeLegacyModes(p, defaultSettings(p.id)).size, JSON.stringify(opts)).toBe(0);
    }
  });

  it('幼児の札: 2歳段階は4枚、それ以外は9枚まで。小学生は札なし', async () => {
    const toddler2 = await makeProfile({ audience: 'toddler', toddlerStage: 2 });
    expect(preschoolHomeCards(toddler2)).toHaveLength(4);
    const p4 = await makeProfile({ audience: 'p4' });
    expect(preschoolHomeCards(p4)).toHaveLength(9);
    const g1 = await makeProfile({ audience: 'g1', enrolledGrade: 1 });
    expect(preschoolHomeCards(g1)).toEqual([]);
  });
});

describe('スキルごとの様子の行', () => {
  it('4歳: 13行（9つのあそびの全スキル）', async () => {
    await makeProfile({ audience: 'p4' });
    await showRecords();
    expect(skillRows()).toHaveLength(13);
    expect(skillRows()).toContain('shop');
  });

  it('小3: 遊べないので表を出さない（13行 → 0）。「まだ取り組んでいません」の行も出ない', async () => {
    await makeProfile({ audience: 'g3', enrolledGrade: 3 });
    await showRecords();
    expect(skillRows()).toHaveLength(0);
    expect(screen.queryByTestId('skill-table')).toBeNull();
    expect(screen.queryByText('スキルごとの様子')).toBeNull();
    expect(screen.queryByText('まだ取り組んでいません')).toBeNull();
  });

  it('小3でも、v1 のあそびの記録（取り組んだ印）がある行は出す', async () => {
    const p = await makeProfile({ audience: 'g3', enrolledGrade: 3 });
    await db.saveProgress({
      profileId: p.id,
      skillId: 'shop',
      level: 0,
      window: ['independent'],
      mastered: false,
      attempted: true,
      changedAt: NOW,
      lastChange: null,
    });
    await showRecords();
    expect(skillRows()).toEqual(['shop']);
  });

  it('5歳: 遊べる v1 のあそびが無いので表を出さない', async () => {
    await makeProfile({ audience: 'p5' });
    await showRecords();
    expect(screen.queryByTestId('skill-table')).toBeNull();
  });

  it('2〜3歳（3歳段階）: 遊べる なぞり の行だけ', async () => {
    await makeProfile({ audience: 'toddler', toddlerStage: 3 });
    await showRecords();
    expect(skillRows()).toEqual(['trace']);
  });
});

describe('問題の ID を出さない', () => {
  it('単元の記録だけのとき、最近の記録・とまどった記録に「問題」の列を出さず、ID も出ない', async () => {
    const p = await makeProfile({ audience: 'g3', enrolledGrade: 3 });
    const unit = UNIT_INDEX.find((u) => u.stage === 'g3' && u.subject === 'math')!;
    await db.addAttempt(unitAttempt(p.id, unit.id, 'direct:3:5:0'));
    await db.addAttempt(unitAttempt(p.id, unit.id, 'read-table:12', { operationIssue: true }));
    await showRecords();
    const recent = screen.getByTestId('recent-table');
    expect(within(recent).queryByText('問題')).toBeNull();
    expect(recent.textContent).not.toMatch(/direct:|read-table:/);
    const issues = screen.getByTestId('issues-table');
    expect(within(issues).queryByText('問題')).toBeNull();
    expect(screen.getByTestId('tab-records').textContent).not.toMatch(/direct:|read-table:/);
  });

  it('1.0 の記録といっしょのとき、1.0 の問題は出し、単元の問題は「-」', async () => {
    const p = await makeProfile({ audience: 'g3', enrolledGrade: 3 });
    const unit = UNIT_INDEX.find((u) => u.stage === 'g3' && u.subject === 'math')!;
    await db.addAttempt(attempt({ profileId: p.id, itemKey: 'りんご×3', at: NOW - 5000 }));
    await db.addAttempt(unitAttempt(p.id, unit.id, 'direct:3:5:0', { at: NOW - 1000 }));
    await showRecords();
    const recent = screen.getByTestId('recent-table');
    expect(within(recent).getByText('問題')).toBeTruthy();
    expect(recent.textContent).toContain('りんご×3');
    expect(recent.textContent).not.toContain('direct:');
    const unitRow = [...recent.querySelectorAll('tbody tr')].find(
      (r) =>
        r.textContent?.includes('direct') === false && r.textContent?.includes('りんご') === false,
    )!;
    expect([...unitRow.querySelectorAll('td')].map((td) => td.textContent)).toContain('-');
  });

  it('むずかしそうな問題: 単元は問題の ID でなく、単元ごとに「何問」「合わせて何回」', async () => {
    const p = await makeProfile({ audience: 'g3', enrolledGrade: 3 });
    const unit = UNIT_INDEX.find((u) => u.stage === 'g3' && u.subject === 'math')!;
    // 同じ問題に3回（自力0）、別の問題にも3回（自力0）
    for (let i = 0; i < 3; i++) {
      await db.addAttempt(unitAttempt(p.id, unit.id, 'direct:3:5:0', { outcome: 'skipped' }));
      await db.addAttempt(unitAttempt(p.id, unit.id, 'direct:3:6:1', { outcome: 'after_hint' }));
    }
    // 1.0 の問題は、これまでどおり問題の文
    for (let i = 0; i < 3; i++)
      await db.addAttempt(attempt({ profileId: p.id, itemKey: 'みかん×2', outcome: 'skipped' }));
    await showRecords();
    const hard = screen.getByTestId('hard-items');
    const rows = [...hard.querySelectorAll('tbody tr')].map((r) =>
      [...r.querySelectorAll('td')].map((td) => td.textContent),
    );
    expect(rows).toHaveLength(2);
    expect(rows).toContainEqual(['おかいものごっこ', 'みかん×2', '3']);
    expect(rows.find((r) => r[1] === '2問')?.[2]).toBe('6');
    expect(hard.textContent).not.toContain('direct:');
  });

  it('2歳段階: 単元の記録の「内容」に ID を出さない（1.0 の記録があるときは、その文だけ）', async () => {
    const p = await makeProfile({ audience: 'toddler', toddlerStage: 2 });
    await db.addAttempt(unitAttempt(p.id, 'p23.think.sort', 'animal-food-1'));
    await showRecords();
    const recent = screen.getByTestId('play-recent-table');
    expect(within(recent).queryByText('内容')).toBeNull();
    expect(recent.textContent).not.toContain('animal-food-1');
    cleanup();
    await db.addAttempt(attempt({ profileId: p.id, modeId: 'hiragana', itemKey: 'あ' }));
    await showRecords();
    const mixed = screen.getByTestId('play-recent-table');
    expect(within(mixed).getByText('内容')).toBeTruthy();
    expect(mixed.textContent).toContain('あ');
    expect(mixed.textContent).not.toContain('animal-food-1');
  });
});

describe('きょうの おすすめは子供のホームと同じ', () => {
  /** 子供のホームに出ている「おすすめ」の名前（aria-label「おすすめ ○○」。小学生のふくしゅうは末尾の「ふくしゅう」を除く） */
  async function homeTitles(): Promise<string[]> {
    render(
      <AppStateProvider>
        <Home />
      </AppStateProvider>,
    );
    await waitFor(() => expect(document.querySelector('.home-side')).not.toBeNull());
    // おすすめは非同期に（1回で全部）出る
    await waitFor(() =>
      expect(
        document.querySelectorAll('.home-side [aria-label^="おすすめ "]').length,
      ).toBeGreaterThan(0),
    );
    const titles = [...document.querySelectorAll('.home-side [aria-label^="おすすめ "]')].map((b) =>
      b
        .getAttribute('aria-label')!
        .replace(/^おすすめ /, '')
        .replace(/ ふくしゅう$/, ''),
    );
    cleanup();
    return titles;
  }

  async function parentTitles(): Promise<string[]> {
    await showRecords();
    const list = screen.getByTestId('recommendations');
    return [...list.querySelectorAll('li')].map((li) => li.firstChild?.textContent?.trim() ?? '');
  }

  it('4歳: 回の記録と「すき」があっても、ホームと同じ札・同じ順', async () => {
    const p = await makeProfile({ audience: 'p4' });
    await db.saveFavorites(p.id, ['trace']);
    await db.addRound({
      profileId: p.id,
      modeId: 'shopping',
      variantId: 'main',
      startedAt: NOW - 3 * DAY,
      endedAt: NOW - 3 * DAY + 60_000,
      count: 4,
      completed: true,
    });
    const home = await homeTitles();
    expect(home.length).toBeGreaterThan(0);
    expect(await parentTitles()).toEqual(home);
    // 子供のホームに無い v1 の順（おかいもの・なかまわけ・なぞって あそぼう の固定の3つ）にはなっていない
    expect(home).toContain('なぞってあそぼう');
  });

  it('5歳: ホームと同じ', async () => {
    await makeProfile({ audience: 'p5' });
    const home = await homeTitles();
    expect(await parentTitles()).toEqual(home);
  });

  it('小3: 復習の時期が来た単元・取り組み中の単元も、ホームと同じ順', async () => {
    const p = await makeProfile({ audience: 'g3', enrolledGrade: 3 });
    const g3 = UNIT_INDEX.filter((u) => u.stage === 'g3' && u.status !== 'planned');
    const row = (unitId: string, review: UnitProgress['review']): UnitProgress => ({
      profileId: p.id,
      unitId,
      level: 0,
      window: [],
      mastered: false,
      attempted: true,
      changedAt: NOW,
      lastChange: null,
      review,
    });
    await db.saveUnitProgress(
      row(g3[0]!.id, {
        stage: 'learned',
        reviewStep: 0,
        reviewDue: NOW - DAY,
        lastReviewAt: NOW - 2 * DAY,
      }),
    );
    await db.saveUnitProgress(
      row(g3[1]!.id, { stage: 'learning', reviewStep: 0, reviewDue: null, lastReviewAt: null }),
    );
    const home = await homeTitles();
    expect(home).toHaveLength(3);
    expect(await parentTitles()).toEqual(home);
  });

  it('2歳段階: ホームに おすすめが無いので、保護者の画面にも出さない', async () => {
    const p = await makeProfile({ audience: 'toddler', toddlerStage: 2 });
    expect(
      homeRecommendations({
        profile: p,
        settings: defaultSettings(p.id),
        favorites: [],
        rounds: [],
        unitProgress: [],
        today: '2026-11-07',
        todayStart: NOW,
        now: NOW,
      }),
    ).toEqual([]);
    await showRecords();
    expect(screen.queryByTestId('recommendations')).toBeNull();
  });

  it('おすすめの理由は保護者に読める文（復習・取り組み中・次の単元）', async () => {
    const p = await makeProfile({ audience: 'g3', enrolledGrade: 3 });
    const g3 = UNIT_INDEX.filter((u) => u.stage === 'g3' && u.status !== 'planned');
    const mk = (unitId: string, review: UnitProgress['review']): UnitProgress => ({
      profileId: p.id,
      unitId,
      level: 0,
      window: [],
      mastered: false,
      attempted: true,
      changedAt: NOW,
      lastChange: null,
      review,
    });
    const recs = homeRecommendations({
      profile: p,
      settings: defaultSettings(p.id),
      favorites: [],
      rounds: [],
      unitProgress: [
        mk(g3[0]!.id, {
          stage: 'learned',
          reviewStep: 0,
          reviewDue: NOW - DAY,
          lastReviewAt: NOW - 2 * DAY,
        }),
        mk(g3[1]!.id, { stage: 'learning', reviewStep: 0, reviewDue: null, lastReviewAt: null }),
      ],
      today: '2026-11-07',
      todayStart: NOW,
      now: NOW,
    });
    expect(recs.map((r) => r.reason)).toEqual([
      '復習の時期です',
      '取り組み中の単元です',
      '次に取り組める単元です',
    ]);
    // 題はふりがなの記号を除いた文（《》が出ない）
    for (const r of recs) expect(r.title).not.toMatch(/[《》]/);
  });
});
