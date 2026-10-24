import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  answerGate,
  attemptsOf,
  boot,
  gotoApp,
  histLen,
  idbGetAll,
  openMode,
  openParent,
  prepare,
  start,
} from './helpers/app';
import { mouseCtl, playRound } from './helpers/solve';

/** E-07 保護者ゲート、E-08 プロフィール、E-09 書き出し→読み込み、E-18 きろくの表示 */

test('E-07 保護者ゲート: 短い押下では開かない。2秒長押し → 計算問題 → 保護者画面', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await boot(page);
  const key = page.getByTestId('parent-key');
  const box = (await key.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // 短い押下（0.4秒）: 開かない（2秒たっても出ない）
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await page.mouse.up();
  await page.waitForTimeout(2200);
  await expect(page.getByTestId('parent-gate')).toHaveCount(0);

  // 1.5秒で離しても開かない
  await page.mouse.down();
  await page.waitForTimeout(1500);
  await page.mouse.up();
  await page.waitForTimeout(800);
  await expect(page.getByTestId('parent-gate')).toHaveCount(0);

  // 2秒以上の長押し → 計算問題
  await page.mouse.down();
  await expect(page.getByTestId('parent-gate')).toBeVisible({ timeout: 6000 });
  await page.mouse.up();
  await expect(page.getByTestId('gate-question')).toContainText('＋');

  // まちがった答え → エラー。そのあと正しい答え（問題文の足し算）
  await answerGate(page, { wrongFirst: true });
  await expect(page.getByTestId('parent-app')).toBeVisible();
  await expect(page.getByTestId('tab-records')).toBeVisible();

  // こどもの画面へ戻ると、保護者画面は再びゲートの後ろ（直接のアドレスでは開けない）
  await page.getByTestId('parent-to-child').click();
  await expect(page.getByTestId('home')).toBeVisible();
  await page.evaluate(() => {
    location.hash = '#/parent/records';
  });
  await expect(page.getByTestId('start-screen')).toBeVisible();
  await expect(page.getByTestId('parent-app')).toHaveCount(0);
});

/** 1回遊ぶ（ホームから開始 → 完了画面 → ホーム） */
async function playOnce(
  page: import('@playwright/test').Page,
  mode: string,
  variant?: string,
): Promise<void> {
  const n0 = await histLen(page);
  await openMode(page, mode, variant);
  await playRound(page, { ctl: mouseCtl(page), from: n0 });
  await expect(page.getByTestId('done-screen')).toBeVisible();
  await page.getByTestId('done-home-button').click();
  await expect(page.getByTestId('home')).toBeVisible();
}

test('E-08 プロフィール2つ: それぞれで遊び、記録が混ざらない', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page);
  const profiles0 = await idbGetAll<{ id: string; name: string }>(page, 'profiles');
  const a = profiles0[0]!;

  // プロフィール「はな」を追加
  await openParent(page, 'profiles');
  await page.getByTestId('profile-name-new').fill('はな');
  await page.getByTestId('profile-add').click();
  await expect(page.getByTestId('tab-profiles')).toContainText('「はな」を追加しました');
  const b = (await idbGetAll<{ id: string; name: string }>(page, 'profiles')).find(
    (p) => p.name === 'はな',
  )!;
  expect(b.id).not.toBe(a.id);
  await page.getByTestId('parent-to-child').click();
  await expect(page.getByTestId('home')).toBeVisible();

  // A で おかいもの
  await playOnce(page, 'shopping');

  // 保護者画面で B に切り替えて、こどもの画面へ → B で さんすう
  await openParent(page, 'records');
  await page.getByTestId('parent-profile-select').selectOption({ label: 'はな' });
  await expect(page.getByTestId('tab-records')).toBeVisible();
  await expect(page.getByText('まだ記録がありません')).toBeVisible();
  await page.getByTestId('parent-to-child').click();
  await expect(page.getByTestId('home')).toBeVisible();
  await expect(page.locator('.home-profile')).toContainText('はな');
  await playOnce(page, 'math', 'add');

  // 記録は混ざらない（データ）
  const all = await attemptsOf(page);
  const ofA = all.filter((x) => x.profileId === a.id);
  const ofB = all.filter((x) => x.profileId === b.id);
  expect(ofA.length).toBeGreaterThan(0);
  expect(ofB.length).toBeGreaterThan(0);
  expect(new Set(ofA.map((x) => x.modeId))).toEqual(new Set(['shopping']));
  expect(new Set(ofB.map((x) => x.modeId))).toEqual(new Set(['math']));
  const rounds = await idbGetAll<{ profileId: string; modeId: string }>(page, 'rounds');
  expect(rounds.filter((r) => r.profileId === a.id).every((r) => r.modeId === 'shopping')).toBe(
    true,
  );
  expect(rounds.filter((r) => r.profileId === b.id).every((r) => r.modeId === 'math')).toBe(true);
  // 進度（スキル）も別
  const prog = await idbGetAll<{ profileId: string; skillId: string }>(page, 'progress');
  expect(new Set(prog.filter((p) => p.profileId === a.id).map((p) => p.skillId))).toEqual(
    new Set(['shop']),
  );
  expect(new Set(prog.filter((p) => p.profileId === b.id).map((p) => p.skillId))).toEqual(
    new Set(['add']),
  );

  // 記録は混ざらない（保護者画面の表示）
  await openParent(page, 'records');
  const recent = page.getByTestId('recent-table');
  await expect(recent).toContainText('さんすう');
  await expect(recent).not.toContainText('おかいもの');
  await page.getByTestId('parent-profile-select').selectOption({ label: a.name });
  await expect(page.getByTestId('recent-table')).toContainText('おかいもの');
  await expect(page.getByTestId('recent-table')).not.toContainText('さんすう');
});

test('E-09 書き出し → 記録を削除 → 読み込み（追加）で記録が戻る', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await boot(page);
  await playOnce(page, 'shopping');
  const before = await attemptsOf(page);
  expect(before.length).toBeGreaterThan(0);
  const profileId = before[0]!.profileId;

  // 書き出し（ダウンロード）
  await openParent(page, 'data');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-all').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^manabi-backup-.*\.json$/);
  const file = testInfo.outputPath('backup.json');
  await download.saveAs(file);
  const json = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
  expect(JSON.stringify(json)).toContain('shopping');
  await expect(page.getByTestId('data-message')).toContainText('書き出しました');

  // 記録の全削除（プロフィールの記録）
  await page.getByTestId('parent-tab-profiles').click();
  await page.getByTestId(`profile-clear-${profileId}`).click();
  await page.getByTestId('confirm-ok').click();
  await expect.poll(async () => (await attemptsOf(page)).length).toBe(0);
  await page.getByTestId('parent-tab-records').click();
  await expect(page.getByText('まだ記録がありません')).toBeVisible();

  // 読み込み（追加）
  await page.getByTestId('parent-tab-data').click();
  await page.getByTestId('import-file').setInputFiles(file);
  await expect(page.getByTestId('import-preview')).toBeVisible();
  await page.getByTestId('import-add').click();
  await expect(page.getByTestId('data-message')).toContainText('追加しました');

  // 記録が戻る（新しいプロフィールとして追加される）
  await expect.poll(async () => (await attemptsOf(page)).length).toBe(before.length);
  const after = await attemptsOf(page);
  expect(after.map((x) => x.itemKey).sort()).toEqual(before.map((x) => x.itemKey).sort());
  const profiles = await idbGetAll<{ id: string }>(page, 'profiles');
  expect(profiles.length).toBe(2);
  expect(after[0]!.profileId).not.toBe(profileId);
  // 保護者画面でも見える
  await page.getByTestId('parent-tab-records').click();
  const sel = page.getByTestId('parent-profile-select');
  await expect(sel.locator('option')).toHaveCount(2);
});

test.describe('E-18 きろく: 未実施・取り組んだ・むずかしそう・そうさにとまどった', () => {
  test('書き込んだ記録で、行の表示が分かれる', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoApp(page);
    const now = Date.now();
    const att = (itemKey: string, outcome: string, extra: Record<string, unknown> = {}) => ({
      modeId: 'shopping',
      variantId: 'main',
      skillId: 'shop',
      level: 0,
      itemKey,
      outcome,
      wrongTries: 0,
      hintsUsed: 0,
      reviewsUsed: 0,
      operationIssue: false,
      at: now - 1000,
      ...extra,
    });
    await prepare(page, {
      progress: [
        {
          skillId: 'shop',
          level: 0,
          window: ['skipped', 'skipped', 'after_hint', 'skipped', 'skipped', 'skipped'],
          mastered: false,
          attempted: true,
          changedAt: now,
          lastChange: null,
        },
        {
          skillId: 'kana',
          level: 0,
          window: ['independent', 'independent', 'independent', 'independent'],
          mastered: false,
          attempted: true,
          changedAt: now,
          lastChange: null,
        },
      ],
      attempts: [
        att('トマト×2', 'skipped', { at: now - 5000 }),
        att('トマト×2', 'skipped', { at: now - 4000 }),
        att('トマト×2', 'skipped', { at: now - 3000 }),
        att('りんご×1', 'independent', {
          at: now - 2000,
          operationIssue: true,
          inputKind: 'touch',
        }),
      ],
    });
    await start(page);
    await openParent(page, 'records');

    // 取り組んだ行 / 未実施の行 が区別される
    await expect(page.getByTestId('skill-kana')).toHaveAttribute('data-state', 'active');
    await expect(page.getByTestId('skill-shop')).toHaveAttribute('data-state', 'hard');
    await expect(page.getByTestId('hard-shop')).toContainText('むずかしそう');
    for (const id of [
      'sort',
      'shape',
      'memory',
      'compare',
      'road',
      'trace',
      'add',
      'sub',
      'split',
    ]) {
      const row = page.getByTestId(`skill-${id}`);
      await expect(row).toHaveAttribute('data-state', 'not-started');
      await expect(row).toContainText('まだ取り組んでいません');
    }
    await expect(page.getByTestId('skill-kana')).not.toContainText('まだ取り組んでいません');
    // 未実施は「むずかしそう」にならない
    await expect(page.getByTestId('hard-sort')).toHaveCount(0);

    // むずかしそうな問題（3回以上・自力0回）と、そうさにとまどった記録は別の表
    await expect(page.getByTestId('hard-items')).toContainText('トマト×2');
    await expect(page.getByTestId('issues-table')).toContainText('りんご×1');
    await expect(page.getByTestId('issues-table')).not.toContainText('トマト×2');
  });

  test('実際に遊ぶと、そのスキルだけが「取り組んだ」になる', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    await playOnce(page, 'shopping');
    await openParent(page, 'records');
    await expect(page.getByTestId('skill-shop')).not.toHaveAttribute('data-state', 'not-started');
    await expect(page.getByTestId('skill-kana')).toHaveAttribute('data-state', 'not-started');
    await expect(page.getByTestId('issues-empty')).toBeVisible();
  });
});
