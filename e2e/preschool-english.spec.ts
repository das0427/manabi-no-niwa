import { expect, test } from '@playwright/test';
import { boot, clickUntil } from './helpers/app';
import { inspectLayout } from './helpers/layout';

/**
 * 幼児の英語（docs/expansion/p2-design/preschool-english.md 11.2-6）:
 * 4歳のホーム（「えいご」の札・上の帯の「ほかの がくねん」）と、えいごの選ぶ画面、
 * 絵本の問題画面（絵の帯＋きくの札＋選択肢）が、画面の拡大（100%・125%・150% 相当）ではみ出し・重なり・横スクロールを起こさない。
 */
const SIZES: [number, number][] = [
  [1920, 1080],
  [1536, 864],
  [1280, 720],
];

for (const [w, h] of SIZES) {
  test(`${w}x${h}: 4歳のホームのえいごの札と、絵本の問題画面`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await boot(page);
    await expect(page.getByTestId('home')).toHaveAttribute('data-stage', 'p4');
    await expect(page.getByTestId('home-eigo')).toBeVisible();
    // 「ほかの がくねん」は上の帯にある
    const top = await page.locator('.home-top').boundingBox();
    const explore = await page.getByTestId('home-explore').boundingBox();
    expect(explore!.y + explore!.height).toBeLessThanOrEqual(top!.y + top!.height + 1);
    // 「えいご」はおすすめに出ない
    await expect(page.getByTestId('home-rec-eigo')).toHaveCount(0);
    const home = await inspectLayout(page, true);
    expect(home.issues.filter((i) => i.kind !== 'small-button')).toEqual([]);

    await clickUntil(page, page.getByTestId('home-eigo'), page.getByTestId('card-chooser-eigo'));
    const chooser = await inspectLayout(page, true);
    expect(chooser.issues.filter((i) => i.kind === 'hscroll' || i.kind === 'clipped')).toEqual([]);

    await clickUntil(
      page,
      page.getByTestId('card-unit-p4.en.picture-book'),
      page.getByTestId('unit-p4.en.picture-book').or(page.getByTestId('resume-prompt')),
    );
    // はじめの回の おてほん（導入）を進める
    for (let i = 0; i < 3; i++) {
      const next = page.getByTestId('intro-next');
      if (await next.isVisible()) await next.click();
    }
    await expect(page.locator('.eng-listen').getByTestId('listen-button')).toBeVisible();
    await page.waitForTimeout(300);
    const q = await inspectLayout(page, true);
    expect(q.issues.filter((i) => i.kind === 'hscroll' || i.kind === 'clipped')).toEqual([]);
    expect(q.issues.filter((i) => i.kind === 'overlap')).toEqual([]);
  });
}
