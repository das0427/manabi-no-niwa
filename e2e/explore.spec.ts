/**
 * ほかの がくねん・きょうか（先取り・さかのぼり X-TG-03）。
 * 幼児のホームからも小学生のホームからも、別の区分の札・教科を開ける。プロフィールの区分は変わらない。
 */
import { expect, test } from '@playwright/test';
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
});
