/**
 * 保護者画面「きろく」: 1.0 の記録（まえの きろく）と、2歳段階の見せ方（review-1 #8）。
 * 記録はすべて架空のデータ。
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppStateProvider } from '../app/AppState';
import { DB_NAME, UPGRADES, closeStorageForTest } from '../core/storage/db';
import * as db from '../core/storage/index';
import type { AttemptRecord } from '../core/types';
import ParentApp from './index';
import { isLegacyRecord, summarizePlay } from './RecordsTab';

const wipe = (name: string) =>
  new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase(name);
    r.onsuccess = r.onerror = r.onblocked = () => res();
  });

const T0 = new Date(2026, 3, 1, 10, 0).getTime();

function attempt(over: Partial<AttemptRecord>): Omit<AttemptRecord, 'id'> {
  return {
    profileId: 'p1',
    modeId: 'hiragana',
    variantId: 'read',
    skillId: 'kana',
    level: 0,
    itemKey: 'あ',
    outcome: 'independent',
    wrongTries: 0,
    hintsUsed: 0,
    reviewsUsed: 0,
    operationIssue: false,
    inputKind: 'touch',
    at: T0,
    ...over,
  };
}

/** v1.0.0 と同じ形のデータベース（スキーマ1）に、1.0 で遊んだ記録を入れる */
async function makeV1(extra: Omit<AttemptRecord, 'id'>[] = []): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const tx = req.transaction!;
      UPGRADES[1]!(req.result, tx);
      tx.objectStore('meta').put(
        { schemaVersion: 1, createdAt: 1, lastAppVersion: '1.0.0' },
        'meta',
      );
      tx.objectStore('profiles').put({ id: 'p1', name: 'はな', avatar: 'cat', createdAt: 10 });
      tx.objectStore('progress').put({
        profileId: 'p1',
        skillId: 'kana',
        level: 1,
        window: ['independent', 'after_hint'],
        mastered: false,
        attempted: true,
        changedAt: T0,
        lastChange: null,
      });
      const at = tx.objectStore('attempts');
      at.put(attempt({ itemKey: 'あ', at: T0 }));
      at.put(attempt({ itemKey: 'い', outcome: 'after_hint', hintsUsed: 2, at: T0 + 1000 }));
      at.put(
        attempt({
          modeId: 'shopping',
          variantId: 'buy',
          skillId: 'shop',
          itemKey: 'りんご×2',
          at: T0 + 2000,
        }),
      );
      for (const a of extra) at.put(a);
      tx.objectStore('rounds').put({
        profileId: 'p1',
        modeId: 'hiragana',
        variantId: 'read',
        startedAt: T0,
        endedAt: T0 + 60_000,
      });
    };
    req.onsuccess = () => {
      req.result.close();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

async function showRecords(timeout = 1000) {
  render(
    <AppStateProvider>
      <ParentApp tab="records" />
    </AppStateProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('tab-records')).toBeTruthy(), { timeout });
}

beforeEach(async () => {
  await closeStorageForTest();
  await wipe(DB_NAME);
});

afterEach(() => {
  cleanup();
});

describe('まえの きろく（1.0 の記録）', () => {
  it('v1 のデータベースを v2 で開くと、旧モードIDのまま閲覧でき、記録は変わらない', async () => {
    await makeV1();
    await db.openStorage();
    const before = await db.listAttempts('p1');
    expect(before).toHaveLength(3);

    await showRecords();
    const sec = await screen.findByTestId('legacy-records');
    // あそびごとのまとめ（旧モードの名前で出る）
    const rows = within(sec).getAllByTestId('legacy-summary-row');
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('おかいものごっこ'),
      expect.stringContaining('ひらがな'),
    ]);
    // 列: あそび・取り組んだ数・はじめて・さいごに
    const cells = (tr: HTMLElement) => [...tr.querySelectorAll('td')].map((td) => td.textContent);
    expect(cells(rows[0]!)).toEqual(['おかいものごっこ', '1', '2026/4/1', '2026/4/1']);
    expect(cells(rows[1]!)).toEqual(['ひらがな', '2', '2026/4/1', '2026/4/1']);
    // 1問ごとの記録（正誤・ヒント数つき）
    const table = within(sec).getByTestId('legacy-table');
    expect(table.textContent).toContain('りんご×2');
    expect(table.textContent).toContain('ヒント後');
    expect(within(sec).getByTestId('legacy-progress-count').textContent).toContain('1');
    // 段階の記録は「スキルごとの様子」にそのまま（変換しない）
    expect(screen.getByTestId('skill-kana').getAttribute('data-state')).not.toBe('not-started');
    // 閲覧のみ: 押して変えられるボタンを置かない・記録が変わらない
    expect(within(sec).queryAllByRole('button')).toHaveLength(0);
    expect(await db.listAttempts('p1')).toEqual(before);
    expect(await db.listUnitProgress('p1')).toEqual([]);
  });

  it('新しい記録が 2000 件を超えても、1.0 の記録のまとめは全件から作る', async () => {
    const later = T0 + 30 * 86_400_000;
    const units = Array.from({ length: 2100 }, (_, i) =>
      attempt({
        modeId: 'unit',
        unitId: 'p4.think.sort',
        variantId: '',
        skillId: null,
        itemKey: `u${i}`,
        at: later + i,
      }),
    );
    await makeV1(units);
    await db.openStorage();
    // 2000 件を超える記録の読み込みは fake-indexeddb では時間がかかる
    await showRecords(15_000);
    const sec = await screen.findByTestId('legacy-records');
    const rows = within(sec).getAllByTestId('legacy-summary-row');
    expect(rows).toHaveLength(2);
    expect(rows[1]!.querySelectorAll('td')[1]!.textContent).toBe('2');
    // 1問ごとの表（最近の記録）は新しい単元の記録で埋まっていても、まえの きろくの表には旧モードだけ
    expect(within(sec).getByTestId('legacy-table').textContent).toContain('りんご×2');
    expect(within(sec).getByTestId('legacy-table').textContent).not.toContain('u2099');
  }, 30_000);

  it('1.0 の記録が無いときは「ありません」', async () => {
    await db.openStorage();
    await db.createProfile('そら', 'dog');
    await showRecords();
    expect(await screen.findByTestId('legacy-empty')).toBeTruthy();
  });
});

describe('2歳段階の記録の見せ方（review-1 #8）', () => {
  it('あそんだ内容だけを出し、正誤・ヒント数・むずかしそう・おすすめを出さない', async () => {
    await db.openStorage();
    const p = await db.createProfile('ちび', 'chick', { audience: 'toddler', toddlerStage: 2 });
    for (let i = 0; i < 3; i++) {
      await db.addAttempt(
        attempt({
          profileId: p.id,
          modeId: 'unit',
          unitId: 'p23.think.sort',
          variantId: '',
          skillId: null,
          itemKey: 'いぬ',
          outcome: 'after_hint',
          hintsUsed: 2,
          at: T0 + i,
        }),
      );
    }
    // 2歳段階でも、1.0 のあそびの記録は回数と日付だけ
    await db.addAttempt(attempt({ profileId: p.id, outcome: 'skipped', at: T0 + 10 }));
    await db.addAttempt(
      attempt({ profileId: p.id, modeId: 'unit', unitId: 'p23.think.sort', operationIssue: true }),
    );

    await showRecords();
    const table = await screen.findByTestId('play-table');
    const rows = within(table).getAllByTestId('play-table-row');
    expect(rows).toHaveLength(2);
    const counts = rows.map((r) => r.querySelectorAll('td')[1]!.textContent);
    expect(counts.sort()).toEqual(['1', '3']);
    // 1.0 のあそびの記録の文（あ）は出し、単元の記録の key（内部の ID の形。ここでは「いぬ」）は出さない（FX14）
    expect(screen.getByTestId('play-recent-table').textContent).toContain('あ');
    expect(screen.getByTestId('play-recent-table').textContent).not.toContain('いぬ');

    // 正誤・ヒント数・むずかしそう・とまどい・おすすめの表は出さない
    for (const id of [
      'skill-table',
      'hard-items',
      'hard-items-empty',
      'recent-table',
      'issues-table',
      'issues-empty',
      'recommendations',
      'legacy-table',
      'legacy-progress-count',
    ]) {
      expect(screen.queryByTestId(id), id).toBeNull();
    }
    const text = screen.getByTestId('tab-records').textContent ?? '';
    for (const word of ['自力', 'ヒント後', 'スキップ', 'もういちど']) {
      expect(text, word).not.toContain(word);
    }
    expect(within(screen.getByTestId('legacy-records')).getByTestId('legacy-summary')).toBeTruthy();
  });

  it('3歳段階では正誤の表を出す（進度の判定をする区分）', async () => {
    await db.openStorage();
    await db.createProfile('ちび', 'chick', { audience: 'toddler', toddlerStage: 3 });
    await showRecords();
    expect(await screen.findByTestId('skill-table')).toBeTruthy();
    expect(screen.queryByTestId('play-table')).toBeNull();
  });
});

describe('まとめの関数', () => {
  it('単元は unitId ごと、旧モードはモードごとに、最後に遊んだ順でまとめる', () => {
    const list = [
      attempt({ at: 5 }),
      attempt({ modeId: 'unit', unitId: 'a', at: 9 }),
      attempt({ modeId: 'unit', unitId: 'b', at: 7 }),
      attempt({ at: 1 }),
    ] as AttemptRecord[];
    expect(
      summarizePlay(list).map((s) => [s.modeId, s.unitId ?? '', s.n, s.first, s.last]),
    ).toEqual([
      ['unit', 'a', 1, 9, 9],
      ['unit', 'b', 1, 7, 7],
      ['hiragana', '', 2, 1, 5],
    ]);
    expect(list.map(isLegacyRecord)).toEqual([true, false, false, true]);
  });
});
