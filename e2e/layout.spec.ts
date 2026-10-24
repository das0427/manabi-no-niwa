import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { boot, clickUntil, histLen, openMode, openParent } from './helpers/app';
import { inspectLayout } from './helpers/layout';
import type { LayoutIssue } from './helpers/layout';
import { mouseCtl, playRound } from './helpers/solve';

/**
 * E-14 画面サイズごとのレイアウト検査（違反は失敗にせず、一覧を docs/screenshots/layout-report/ に出す）
 * と、スクリーンショットの保存（Chromium のみ。docs/screenshots/<size>/<name>.png）。
 */

const SIZES: [number, number][] = [
  [1920, 1080],
  [1536, 864],
  [1280, 720],
  [1920, 950],
  [1280, 620],
];

const MODES: { id: string; variant?: string }[] = [
  { id: 'shopping' },
  { id: 'hiragana' },
  { id: 'sorting' },
  { id: 'shapes' },
  { id: 'memory' },
  { id: 'compare' },
  { id: 'road', variant: 'puzzle' },
  { id: 'trace', variant: 'lines' },
  { id: 'math', variant: 'add' },
];

const PARENT_TABS = ['records', 'settings', 'works', 'memos', 'profiles', 'data', 'about'];

const ROOT = path.resolve(import.meta.dirname, '..');

interface Row {
  screen: string;
  u: number;
  buttons: number;
  issues: LayoutIssue[];
}

interface TourOpts {
  /** 完了画面まで遊ぶモード */
  doneModes: string[];
  /** ヒントを出して撮るモード */
  hintModes?: string[];
  shot?: (name: string) => Promise<void>;
}

/** 起動 → ホーム → 各モードの最初の問題 → 完了画面 → ノート → 保護者画面の各タブ を巡って検査する */
async function tour(page: Page, rows: Row[], opts: TourOpts): Promise<void> {
  const check = async (screen: string, child: boolean) => {
    const r = await inspectLayout(page, child);
    rows.push({ screen, u: r.u, buttons: r.buttons, issues: r.issues });
    await opts.shot?.(screen);
  };

  await page.goto('/?seed=3', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('start-button')).toBeEnabled();
  await check('start', true);
  await page.getByTestId('start-button').click();
  await expect(page.getByTestId('home')).toBeVisible();
  await check('home', true);

  for (const m of MODES) {
    const n0 = await histLen(page);
    await openMode(page, m.id, m.variant);
    await expect.poll(async () => (await histLen(page)) > n0).toBe(true);
    // 画面の描画が落ち着くまで少し待つ（入場アニメーション）
    await page.waitForTimeout(300);
    await check(`mode-${m.id}`, true);
    if (m.id === 'memory') {
      // 覚える画面のあと、答える画面も検査する
      await page.getByTestId('memorized-button').click();
      await expect(page.getByTestId('answer')).toBeVisible();
      await page.waitForTimeout(200);
      await check('mode-memory-answer', true);
    }

    if (opts.hintModes?.includes(m.id)) {
      await page.getByTestId('hint-button').click();
      await expect(page.locator('.bubble').first()).toBeVisible();
      await page.waitForTimeout(200);
      await check(`hint-${m.id}`, true);
    }

    if (opts.doneModes.includes(m.id)) {
      await playRound(page, { ctl: mouseCtl(page), from: n0 });
      await expect(page.getByTestId('done-screen')).toBeVisible();
      await page.waitForTimeout(300);
      await check(`done-${m.id}`, true);
      await clickUntil(page, page.getByTestId('done-home-button'), page.getByTestId('home'));
    } else {
      await clickUntil(page, page.getByTestId('home-button'), page.getByTestId('home'));
    }
  }

  await clickUntil(page, page.getByTestId('home-notebook'), page.getByTestId('notebook'));
  await page.waitForTimeout(300);
  await check('notebook', true);
  await clickUntil(page, page.getByTestId('home-button'), page.getByTestId('home'));

  await openParent(page);
  for (const tab of PARENT_TABS) {
    await page.getByTestId(`parent-tab-${tab}`).click();
    await expect(page.getByTestId(`tab-${tab}`)).toBeVisible();
    await check(`parent-${tab}`, false);
  }
}

async function writeReport(testInfo: TestInfo, name: string, rows: Row[]): Promise<void> {
  const dir = path.join(ROOT, 'docs', 'screenshots', 'layout-report');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${name}.json`), JSON.stringify(rows, null, 1), 'utf8');
  const total = rows.reduce((n, r) => n + r.issues.length, 0);
  await testInfo.attach('layout-issues', {
    body: JSON.stringify(
      rows.filter((r) => r.issues.length > 0),
      null,
      1,
    ),
    contentType: 'application/json',
  });
  console.log(`[layout] ${name}: ${rows.length} 画面, 違反 ${total} 件`);
}

test.describe('E-14 レイアウト検査', () => {
  test.describe.configure({ mode: 'parallel' });
  for (const [w, h] of SIZES) {
    test(`${w}x${h}`, async ({ page, browserName }, testInfo) => {
      test.setTimeout(300_000);
      await page.setViewportSize({ width: w, height: h });
      await page.addInitScript(() => {
        try {
          localStorage.setItem('mnw:test', '1');
        } catch {
          /* 無視 */
        }
      });
      const rows: Row[] = [];
      await tour(page, rows, { doneModes: ['shopping'] });
      await writeReport(testInfo, `${browserName}-${w}x${h}`, rows);
      // 巡った画面の数だけは確かめる（違反の有無では失敗にしない）
      expect(rows.length).toBeGreaterThanOrEqual(2 + 9 + 1 + 1 + PARENT_TABS.length);
      // 画面が実際の大きさで描かれている（--u が算出できている）
      expect(rows[0]!.u).toBeGreaterThan(5);
    });
  }
});

test.describe('スクリーンショット', () => {
  test.describe.configure({ mode: 'parallel' });
  for (const [w, h] of [
    [1280, 720],
    [1920, 1080],
  ] as [number, number][]) {
    test(`${w}x${h}`, async ({ page, browserName }, testInfo) => {
      test.skip(browserName !== 'chromium', 'スクリーンショットは Chromium のみ');
      test.setTimeout(600_000);
      const dir = path.join(ROOT, 'docs', 'screenshots', `${w}x${h}`);
      await mkdir(dir, { recursive: true });
      await page.setViewportSize({ width: w, height: h });
      await page.addInitScript(() => {
        try {
          localStorage.setItem('mnw:test', '1');
        } catch {
          /* 無視 */
        }
      });
      const rows: Row[] = [];
      await tour(page, rows, {
        doneModes: MODES.map((m) => m.id),
        hintModes: ['shopping', 'sorting', 'math', 'compare'],
        shot: async (name) => {
          await page.screenshot({ path: path.join(dir, `${name}.png`) });
        },
      });
      await writeReport(testInfo, `shots-${w}x${h}`, rows);
    });
  }
});

void boot;
