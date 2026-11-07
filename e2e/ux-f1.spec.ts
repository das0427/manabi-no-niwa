import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  attemptsOf,
  boot,
  gotoApp,
  idbGetAll,
  idbPutMany,
  openParent,
  prepare,
  start,
} from './helpers/app';

/**
 * 使いやすさの直し（2.1.0 の FX）のうち、単元の枠（F1 組）の操作の流れ。
 *  - FX01: 解説の板が出てから 700ms は「つぎへ」を受け付けない（すばやい2回押しで解説を飛ばさない）
 *  - FX08: 中断（おうち）→ 再開のあと、途中の問題のヒント・誤答の数が残る（正解しても「自力」にならない）
 *  - FX10: 利用時間の目安を超えたあと、単元の完了で「きょうは ここまでに しよう」（もういっかい は出ない）。
 *          新しいプロフィールと「おすすめにする」の区分の既定
 *  - FX12: 教材の無い単元の画面に保護者向けの説明
 * 単体の確かめは src/units/*.test.ts(x)・src/core/session/sessionTime.test.ts。
 */

const UNIT = 'p4.env.seasons';

async function openUnit(page: Page, unitId = UNIT): Promise<void> {
  await page.evaluate((id) => {
    location.hash = `#/unit/${id}`;
  }, unitId);
  // 読み込み中（unit-loading）ではなく、単元の画面・つづきから？・開けない画面のどれかが出るまで
  await expect(
    page
      .locator('[data-testid^="unit-"]:not([data-testid="unit-loading"])')
      .or(page.getByTestId('resume-prompt'))
      .first(),
  ).toBeVisible();
}

/** はじめての回の おてほん（導入）を進める */
async function passIntro(page: Page): Promise<void> {
  const next = page.getByTestId('intro-next');
  for (let i = 0; i < 6 && (await next.isVisible()); i++) await next.click();
  await expect.poll(async () => (await cur(page)).phase).not.toBe('intro');
}

interface Cur {
  index: number;
  phase: string;
  item?: { options?: { correct?: boolean }[] };
}
const cur = (page: Page): Promise<Cur> =>
  page.evaluate(() => (window as unknown as { __mnw: { current: unknown } }).__mnw.current as Cur);

/** 選択肢の問題で、正解・誤りの選択肢の番号 */
async function options(page: Page): Promise<{ correct: number; wrong: number }> {
  const opts = (await cur(page)).item?.options ?? [];
  return {
    correct: opts.findIndex((o) => o.correct),
    wrong: opts.findIndex((o) => !o.correct),
  };
}

/** ヒントを出しきって「つぎへ」（こたえを みる）を出す */
async function showNext(page: Page): Promise<void> {
  const next = page.getByTestId('next-button');
  const hint = page.getByTestId('hint-button');
  for (let i = 0; i < 6 && !(await next.isVisible()); i++) {
    if (await hint.isEnabled()) await hint.click();
  }
  await expect(next).toBeVisible();
}

/** 回の終わりまで、ヒント → つぎへ → 700ms 待って つぎへ で進める */
async function finishRoundBySkip(page: Page): Promise<void> {
  const done = page.getByTestId('unit-done');
  for (let guard = 0; guard < 40 && !(await done.isVisible()); guard++) {
    const c = await cur(page).catch(() => null);
    if (c?.phase === 'explain') {
      await page.waitForTimeout(750);
      await page.getByTestId('next-button').click();
    } else if (c?.phase === 'intro') {
      await passIntro(page);
    } else if (await page.getByTestId('next-button').isVisible()) {
      await page.getByTestId('next-button').click();
    } else if (await page.getByTestId('hint-button').isEnabled()) {
      await page.getByTestId('hint-button').click();
    }
    await page.waitForTimeout(80);
  }
  await expect(done.or(page.getByTestId('unit-done-pending'))).toBeVisible();
}

const PLAYED = { modeId: 'math', variantId: 'add', count: 4 };
/** きょうの 6 分の回（目安 5 分を超える） */
function sixMinutesToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const startedAt = d.getTime() + 1000;
  return [{ ...PLAYED, startedAt, endedAt: startedAt + 6 * 60_000 }];
}

/** プロフィールの区分を変える（IndexedDB。テスト専用） */
async function setAudience(
  page: Page,
  v: { audience: string; enrolledGrade?: number; toddlerStage?: number },
): Promise<void> {
  const profiles = await idbGetAll<Record<string, unknown>>(page, 'profiles');
  await idbPutMany(
    page,
    'profiles',
    profiles.map((p) => {
      const next: Record<string, unknown> = { ...p, audience: v.audience };
      delete next.enrolledGrade;
      delete next.toddlerStage;
      if (v.enrolledGrade) next.enrolledGrade = v.enrolledGrade;
      if (v.toddlerStage) next.toddlerStage = v.toddlerStage;
      return next;
    }),
  );
}

test.describe('FX01 解説の直後の「つぎへ」', () => {
  test('こたえを みる → 100・150・250・400ms で2回押しても、解説の板が残る。700ms たてば進める', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await boot(page);
    await openUnit(page);
    await passIntro(page);
    const gaps = [100, 150, 250, 400];
    for (const [i, gap] of gaps.entries()) {
      await expect.poll(async () => (await cur(page)).index).toBe(i);
      await showNext(page);
      // 2回押す。間（gap）はページの中で測る（押す操作の往復が遅い環境でも、間が 700ms を超えないように）
      await page.getByTestId('next-button').evaluate(
        (el, ms) =>
          new Promise<void>((resolve) => {
            const button = el as HTMLButtonElement;
            button.click();
            setTimeout(() => {
              button.click();
              resolve();
            }, ms);
          }),
        gap,
      );
      // 解説の板のまま（次の問題へ飛んでいない）
      await expect(page.getByTestId('explain')).toBeVisible();
      expect((await cur(page)).index).toBe(i);
      expect((await cur(page)).phase).toBe('explain');
      // 見た目は変わらない: 同じ位置に「つぎへ」があり、押せない状態の印（disabled）は付かない
      await expect(page.getByTestId('next-button')).toBeEnabled();
      // 解説の板が出てから 700ms たったら進める
      await page.waitForTimeout(750);
      await page.getByTestId('next-button').click();
      if (i < gaps.length - 1) {
        await expect.poll(async () => (await cur(page)).index).toBe(i + 1);
      } else {
        await expect(page.getByTestId('unit-done')).toBeVisible();
      }
    }
    // 解説を飛ばした問題は無い: 4問とも「つぎへ」で終えた記録（skipped）が1件ずつ
    expect((await attemptsOf(page, 'unit')).map((a) => a.outcome)).toEqual([
      'skipped',
      'skipped',
      'skipped',
      'skipped',
    ]);
  });
});

test.describe('FX08 中断して再開しても、ヒント・誤答の数が残る', () => {
  /** 1問目を自力で正解して2問目へ進む */
  async function toSecond(page: Page): Promise<void> {
    await boot(page);
    await openUnit(page);
    await passIntro(page);
    await page.getByTestId(`opt-${(await options(page)).correct}`).click();
    await expect(page.getByTestId('explain')).toBeVisible();
    await page.waitForTimeout(750);
    await page.getByTestId('next-button').click();
    await expect.poll(async () => (await cur(page)).index).toBe(1);
  }

  async function leaveAndResume(page: Page): Promise<void> {
    await page.getByTestId('home-button').click();
    await expect(page.getByTestId('home')).toBeVisible();
    await openUnit(page);
    await expect(page.getByTestId('resume-prompt')).toBeVisible();
    await page.getByTestId('resume-yes').click();
    await expect.poll(async () => (await cur(page)).index).toBe(1);
  }

  test('ヒントを2回見る → おうち → つづきから → 正解: after_hint（自力にならない）', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await toSecond(page);
    await page.getByTestId('hint-button').click();
    await page.getByTestId('hint-button').click();
    // 中断データに、途中の問題のヒントの数が入った
    await expect
      .poll(async () => {
        const d = (
          await idbGetAll<{ state: { flow: { current?: { hintsShown: number } } } }>(page, 'drafts')
        )[0];
        return d?.state.flow.current?.hintsShown ?? 0;
      })
      .toBe(2);
    await leaveAndResume(page);
    // 再開した画面に、見たヒントが出ている
    await expect(page.getByTestId('hint-text')).toBeVisible();
    await page.getByTestId(`opt-${(await options(page)).correct}`).click();
    await expect(page.getByTestId('explain')).toBeVisible();
    const a = await attemptsOf(page, 'unit');
    expect(a).toHaveLength(2);
    expect(a[0]).toMatchObject({ outcome: 'independent' });
    expect(a[1]).toMatchObject({ outcome: 'after_hint', hintsUsed: 2, wrongTries: 0 });
  });

  test('誤答を1回 → おうち → つづきから → 正解: self_corrected（誤答の数が残る）', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await toSecond(page);
    await page.getByTestId(`opt-${(await options(page)).wrong}`).click();
    await expect(page.getByTestId('unit-message')).toBeVisible();
    await expect
      .poll(async () => {
        const d = (
          await idbGetAll<{ state: { flow: { current?: { q: { wrongTries: number } } } } }>(
            page,
            'drafts',
          )
        )[0];
        return d?.state.flow.current?.q.wrongTries ?? 0;
      })
      .toBe(1);
    await leaveAndResume(page);
    await page.getByTestId(`opt-${(await options(page)).correct}`).click();
    await expect(page.getByTestId('explain')).toBeVisible();
    const a = await attemptsOf(page, 'unit');
    expect(a[1]).toMatchObject({ outcome: 'self_corrected', wrongTries: 1 });
  });

  test('何もせずに中断して再開した問題は、これまでどおり自力（independent）', async ({ page }) => {
    test.setTimeout(90_000);
    await toSecond(page);
    await leaveAndResume(page);
    await page.getByTestId(`opt-${(await options(page)).correct}`).click();
    await expect(page.getByTestId('explain')).toBeVisible();
    expect((await attemptsOf(page, 'unit'))[1]).toMatchObject({
      outcome: 'independent',
      hintsUsed: 0,
      wrongTries: 0,
    });
  });
});

test.describe('FX10 利用時間の目安', () => {
  const CASES: { name: string; unit: string; audience: string; grade?: number; stage?: number }[] =
    [
      { name: '4歳', unit: 'p4.env.seasons', audience: 'p4' },
      { name: '2〜3歳（2歳の段階）', unit: 'p23.env.daily-life', audience: 'toddler', stage: 2 },
      { name: '小学3年', unit: 'g3.ja.kanji-read-g3', audience: 'g3', grade: 3 },
    ];

  for (const c of CASES) {
    test(`${c.name}: 目安を超えたあとの単元の完了で合図が出て、もういっかい は出ない`, async ({
      page,
    }) => {
      test.setTimeout(180_000);
      await gotoApp(page);
      await setAudience(page, {
        audience: c.audience,
        enrolledGrade: c.grade,
        toddlerStage: c.stage,
      });
      await prepare(page, { settings: { sessionMinutes: 5 }, rounds: sixMinutesToday() });
      // 小学生のホームは school-home（start() は幼児ホームの home を待つ）
      await page.getByTestId('start-button').click();
      await expect(page.getByTestId('home').or(page.getByTestId('school-home'))).toBeVisible();
      await openUnit(page, c.unit);
      if (await page.getByTestId('resume-prompt').isVisible()) {
        await page.getByTestId('resume-no').click();
      }
      await finishRoundBySkip(page);
      await expect(page.getByTestId('unit-done')).toBeVisible();
      await expect(page.getByTestId('unit-done-timeup')).toHaveText('きょうは ここまでに しよう');
      await expect(page.getByTestId('again-button')).toHaveCount(0);
      await expect(page.getByTestId('done-home-button')).toBeVisible();
    });
  }

  test('目安に届いていなければ出ない（もういっかい が残る）', async ({ page }) => {
    test.setTimeout(120_000);
    await gotoApp(page);
    await prepare(page, { settings: { sessionMinutes: 5 } });
    await start(page);
    await openUnit(page);
    await finishRoundBySkip(page);
    await expect(page.getByTestId('unit-done')).toBeVisible();
    await expect(page.getByTestId('unit-done-timeup')).toHaveCount(0);
    await expect(page.getByTestId('again-button')).toBeVisible();
  });

  test('保護者画面: 新しいプロフィールは区分の既定の目安。区分を変えて「おすすめにする」を選んだときだけ入れる', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await boot(page);
    const minutesOf = async (name: string): Promise<number | undefined> => {
      const profile = (await idbGetAll<{ id: string; name: string }>(page, 'profiles')).find(
        (p) => p.name === name,
      );
      const s = (
        await idbGetAll<{ profileId: string; sessionMinutes: number }>(page, 'settings')
      ).find((x) => x.profileId === profile?.id);
      return s?.sessionMinutes;
    };
    // 初回に作られる「こども」（4歳）は 10 分のまま
    expect(await minutesOf('こども')).toBe(10);
    await openParent(page, 'profiles');
    // 新しいプロフィール（小学1年は 15 分、2歳の段階は 5 分）
    await page.getByTestId('profile-name-new').fill('ひまり');
    await page.getByTestId('profile-new-audience').selectOption('g1');
    await page.getByTestId('profile-add').click();
    await expect.poll(() => minutesOf('ひまり')).toBe(15);
    await page.getByTestId('profile-name-new').fill('ちび');
    await page.getByTestId('profile-new-audience').selectOption('toddler');
    await page.getByTestId('profile-new-stage-2').check();
    await page.getByTestId('profile-add').click();
    await expect.poll(() => minutesOf('ちび')).toBe(5);
    // 「こども」を小学6年に変えて「おすすめにする」（初期は選んだ状態）→ 20 分
    const kodomo = (await idbGetAll<{ id: string; name: string }>(page, 'profiles')).find(
      (p) => p.name === 'こども',
    )!;
    await page.getByTestId(`profile-edit-${kodomo.id}`).click();
    await page.getByTestId(`profile-${kodomo.id}-audience`).selectOption('g6');
    await page.getByTestId(`profile-save-${kodomo.id}`).click();
    await expect.poll(() => minutesOf('こども')).toBe(20);
    // 「ひまり」を小学3年に変えて、おすすめを外して保存 → 15 分のまま
    const himari = (await idbGetAll<{ id: string; name: string }>(page, 'profiles')).find(
      (p) => p.name === 'ひまり',
    )!;
    await page.getByTestId(`profile-edit-${himari.id}`).click();
    await page.getByTestId(`profile-${himari.id}-audience`).selectOption('g3');
    await page.getByTestId(`profile-apply-support-${himari.id}`).uncheck();
    await page.getByTestId(`profile-save-${himari.id}`).click();
    await expect(page.getByTestId(`profile-audience-${himari.id}`)).toContainText('小学3年');
    expect(await minutesOf('ひまり')).toBe(15);
  });
});

test.describe('FX12 教材の無い単元の画面', () => {
  // 取得していない教材の単元（小3 算数）を、配信につながらない状態で開く（サービスワーカーを使わず、通信を止める）
  test.use({ serviceWorkers: 'block' });

  test('子供向けの1文のほかに、保護者向けの説明（「きょうざい」タブへの案内）が出る', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.route('**/assets/packs/g3-math/**', (route) => route.abort());
    await boot(page);
    await openUnit(page, 'g3.math.mult-1digit');
    await expect(page.getByTestId('unit-error')).toBeVisible();
    // 子供向けの1文（ひらがな）
    await expect(page.getByTestId('unit-error')).toContainText('おうちの ひとに');
    // 保護者向けの説明（漢字かな交じり。保護者画面の「きょうざい」タブへの案内）
    const parent = page.getByTestId('unit-error-parent');
    await expect(parent).toBeVisible();
    // 理由（取得していない・版が古い・読み込めない）で文が分かれる（packs/loader.ts の PACK_UNAVAILABLE_PARENT_TEXT。
    // どれになるかは配信の確かめ方しだいなので、どれでもよい。理由ごとの文は src/units/UnitRunner.test.tsx）
    await expect(parent).toHaveText(
      /^（保護者の方へ）(この教材はまだ取得していません|アプリが更新され|教材を読み込めませんでした)/,
    );
    await expect(parent).toContainText('「きょうざい」タブ');
    // 小さな字（12px 以上。DESINGN.md 10章・24章）で、舞台の中にある
    const px = await parent.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(px).toBeGreaterThanOrEqual(12);
    const box = (await parent.boundingBox())!;
    const stage = (await page.locator('.stage').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(stage.x);
    expect(box.x + box.width).toBeLessThanOrEqual(stage.x + stage.width + 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(stage.y + stage.height + 0.5);
  });
});
