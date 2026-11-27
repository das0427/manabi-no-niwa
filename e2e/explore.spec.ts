/**
 * ほかの がくねん・きょうか（先取り・さかのぼり X-TG-03）。
 * 幼児のホームからも小学生のホームからも、別の区分の札・教科を開ける。プロフィールの区分は変わらない。
 */
import { expect, test, type Page } from '@playwright/test';
import { activeProfileId, boot, clickUntil, gotoApp, idbGetAll, idbPutMany } from './helpers/app';

test.describe('ほかの がくねん・きょうか', () => {
  test('4歳のホームから 3ねん の算数の地図を開ける（区分は4歳のまま）', async ({ page }) => {
    await boot(page);
    await expect(page.getByTestId('home')).toHaveAttribute('data-stage', 'p4');
    await clickUntil(page, page.getByTestId('home-explore'), page.getByTestId('explore'));
    await expect(page.getByTestId('explore')).toHaveAttribute('data-stage', 'p4');
    await expect(page.getByTestId('explore-tab-p4')).toHaveClass(/is-own/);
    await expect(page.getByTestId('explore-card-shopping')).toBeVisible();

    await clickUntil(
      page,
      page.getByTestId('explore-tab-g3'),
      page.getByTestId('explore-subject-math'),
    );
    // 3年には理科・社会・英語の札もある
    await expect(page.getByTestId('explore-subject-sci')).toBeVisible();
    await clickUntil(
      page,
      page.getByTestId('explore-subject-math'),
      page.getByTestId('subject-map-math'),
    );
    await expect(page.getByTestId('grade-tab-3')).toHaveAttribute('aria-selected', 'true');

    // おうちに戻ると4歳のホームのまま
    await clickUntil(page, page.getByTestId('home-button'), page.getByTestId('home'));
    await expect(page.getByTestId('home')).toHaveAttribute('data-stage', 'p4');
  });

  test('小学2年のホームから 2〜3さい の札と 5ねん の理科を開ける', async ({ page }) => {
    await gotoApp(page);
    const pid = await activeProfileId(page);
    const profile = (await idbGetAll<Record<string, unknown>>(page, 'profiles')).find(
      (p) => p.id === pid,
    )!;
    await idbPutMany(page, 'profiles', [{ ...profile, audience: 'g2', enrolledGrade: 2 }]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('start-button')).toBeEnabled();
    await clickUntil(page, page.getByTestId('start-button'), page.getByTestId('school-home'));

    // 2年のホームには理科の札が無い。「ほかの がくねん」から 5ねん の理科へ
    await expect(page.getByTestId('subject-sci')).toHaveCount(0);
    await clickUntil(page, page.getByTestId('home-explore'), page.getByTestId('explore'));
    await expect(page.getByTestId('explore')).toHaveAttribute('data-stage', 'g2');
    await clickUntil(
      page,
      page.getByTestId('explore-tab-g5'),
      page.getByTestId('explore-subject-sci'),
    );
    await clickUntil(
      page,
      page.getByTestId('explore-subject-sci'),
      page.getByTestId('subject-map-sci'),
    );
    await expect(page.getByTestId('grade-tab-5')).toHaveAttribute('aria-selected', 'true');

    // 幼児の札も開ける（2〜3さい の かたちあわせ）
    await clickUntil(page, page.getByTestId('home-button'), page.getByTestId('school-home'));
    await clickUntil(page, page.getByTestId('home-explore'), page.getByTestId('explore'));
    await clickUntil(
      page,
      page.getByTestId('explore-tab-p23'),
      page.getByTestId('explore-card-shape-match'),
    );
    await clickUntil(
      page,
      page.getByTestId('explore-card-shape-match'),
      page.getByTestId('unit-p23.math.shape-match'),
    );
  });

  /**
   * 幼児の区分（p23・p4・p5）のタブの札は 4 列 × 15.4u × 14u の格子（text-layout-fixes A1）。
   * 10 枚目の「えいご」が舞台の下で切れて押せなかった（舞台の高さ 56.25u に対し、3 列だと 4 行目が下に出た）。
   */
  const STAGE_SIZES: readonly (readonly [number, number])[] = [
    [1280, 620],
    [1920, 1080],
  ];

  /** 札を押して選ぶ画面（単元が複数）か単元が出る。ここでは「えいご」が選ぶ画面を出すこと */
  async function openExploreTab(page: Page, st: string): Promise<void> {
    await clickUntil(page, page.getByTestId('home-explore'), page.getByTestId('explore'));
    await clickUntil(
      page,
      page.getByTestId(`explore-tab-${st}`),
      page.getByTestId(`explore-card-eigo`),
    );
    await expect(page.getByTestId('explore')).toHaveAttribute('data-stage', st);
  }

  for (const [w, h] of STAGE_SIZES) {
    for (const st of ['p23', 'p4', 'p5'] as const) {
      test(`${st} のタブの札 10 枚が舞台の中にあり、えいごで選ぶ画面が出る（${w}x${h}）`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: w, height: h });
        await boot(page);
        await openExploreTab(page, st);

        const stage = (await page.locator('.stage').boundingBox())!;
        const u = stage.width / 100;
        const cards = page.locator('[data-testid^="explore-card-"]');
        await expect(cards).toHaveCount(10);
        const boxes: { id: string; x: number; y: number; r: number; b: number }[] = [];
        for (const c of await cards.all()) {
          const id = (await c.getAttribute('data-testid'))!.replace('explore-card-', '');
          const bb = (await c.boundingBox())!;
          boxes.push({ id, x: bb.x, y: bb.y, r: bb.x + bb.width, b: bb.y + bb.height });
        }
        const eps = 0.5;
        for (const b of boxes) {
          // 舞台の中（右と下に 2u 以上あく。設計の 96.4u・53.2u）
          expect(b.x, `${b.id} の左`).toBeGreaterThanOrEqual(stage.x - eps);
          expect(b.y, `${b.id} の上`).toBeGreaterThanOrEqual(stage.y - eps);
          expect(b.r, `${b.id} の右`).toBeLessThanOrEqual(stage.x + stage.width - 2 * u + eps);
          expect(b.b, `${b.id} の下`).toBeLessThanOrEqual(stage.y + stage.height - 2 * u + eps);
        }
        // 札は 15.4u × 14u（間 1.6u）。「えいご」は右下（4 列目・3 段目）
        const eigo = boxes.find((b) => b.id === 'eigo')!;
        expect(eigo.r - eigo.x).toBeCloseTo(15.4 * u, 0);
        expect(eigo.b - eigo.y).toBeCloseTo(14 * u, 0);
        for (const b of boxes) {
          if (b.id === 'eigo') continue;
          expect(b.r, `${b.id} は「えいご」より左`).toBeLessThanOrEqual(eigo.x + eps);
          expect(b.b).toBeLessThanOrEqual(eigo.b + eps);
        }
        // 札どうしは重ならない
        for (const a of boxes) {
          for (const c of boxes) {
            if (a.id >= c.id) continue;
            const overlap =
              a.x < c.r - eps && c.x < a.r - eps && a.y < c.b - eps && c.y < a.b - eps;
            expect(overlap, `${a.id} と ${c.id} が重なる`).toBe(false);
          }
        }
        // 画面がスクロールにならない（札が舞台からはみ出していない）
        const sc = await page
          .getByTestId('explore')
          .evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));
        expect(sc.sh).toBe(sc.ch);

        // 「えいご」が押せて、選ぶ画面が出る
        await clickUntil(
          page,
          page.getByTestId('explore-card-eigo'),
          page.getByTestId('card-chooser-eigo'),
        );
      });
    }
  }
});
