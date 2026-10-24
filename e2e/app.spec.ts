import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  attemptsOf,
  boot,
  clickUntil,
  currentExposed,
  gotoApp,
  histLen,
  idbGetAll,
  openMode,
  prepare,
  start,
} from './helpers/app';
import { bootWith } from './helpers/cases';
import { guideToScreen, mouseCtl, placeRoad, playRound, touchCtl } from './helpers/solve';

/** E-01, E-03, E-04, E-12, E-15, E-16, E-17 */

const MODE_IDS = [
  'shopping',
  'hiragana',
  'sorting',
  'shapes',
  'memory',
  'compare',
  'road',
  'trace',
  'math',
];

const noHScroll = (page: Page): Promise<{ sw: number; cw: number }> =>
  page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));

test('E-01 起動 → はじめる → ホーム。9モードの札があり、横スクロールがない', async ({ page }) => {
  await gotoApp(page);
  await expect(page.getByTestId('start-screen')).toBeVisible();
  let s = await noHScroll(page);
  expect(s.sw).toBeLessThanOrEqual(s.cw);

  await start(page);
  for (const id of MODE_IDS) await expect(page.getByTestId(`home-mode-${id}`)).toBeVisible();
  await expect(page.locator('[data-testid^="home-mode-"]')).toHaveCount(9);
  await expect(page.getByTestId('home-notebook')).toBeVisible();
  await expect(page.getByTestId('parent-key')).toBeVisible();
  // きょうの おすすめ は2〜3件
  const recs = await page.locator('[data-testid^="home-rec-"]').count();
  expect(recs).toBeGreaterThanOrEqual(2);
  expect(recs).toBeLessThanOrEqual(3);
  s = await noHScroll(page);
  expect(s.sw).toBeLessThanOrEqual(s.cw);
});

test.describe('E-03 連打', () => {
  test('正解の札を10回連続で押しても、記録は1問1件・遷移は1回', async ({ page }) => {
    test.setTimeout(120_000);
    await bootWith(page, { levels: { add: 0 } });
    await openMode(page, 'math', 'add');
    await expect.poll(async () => (await histLen(page)) > 0).toBe(true);
    const cur = await currentExposed(page);
    const ans = (cur.data as { answerIndex: number }).answerIndex;
    const btn = page.getByTestId(`choice-${ans}`);
    await expect(btn).toBeEnabled();
    const b = (await btn.boundingBox())!;
    for (let i = 0; i < 10; i++) await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);

    // 次の問題へ1回だけ進む
    await expect
      .poll(async () => ((await currentExposed(page)).data as { index: number }).index, {
        timeout: 20_000,
      })
      .toBe(1);
    // さらに少し待っても、問題 2 には進まない（遷移が重複しない）
    await page.waitForTimeout(2500);
    const hist = await page.evaluate(() =>
      (
        window as unknown as { __mnw: { history: { data: { index: number } }[] } }
      ).__mnw.history.map((h) => h.data.index),
    );
    expect(hist).toEqual([0, 1]);

    const a = await attemptsOf(page, 'math');
    expect(a.length).toBe(1);
    expect(a[0]!.outcome).toBe('independent');
    // 確定後の連打は受け付けないので、「とまどい」にも数えない
    expect(a[0]!.operationIssue).toBe(false);
  });

  test('間違いの札を10回連打 → 記録は増えず、そのあと正解で1件になる', async ({ page }) => {
    test.setTimeout(120_000);
    await bootWith(page, { levels: { kana: 0 } });
    await openMode(page, 'hiragana');
    await expect.poll(async () => (await histLen(page)) > 0).toBe(true);
    const d = (await currentExposed(page)).data as { answerIndex: number; choices: string[] };
    const bad = d.choices.findIndex((_, i) => i !== d.answerIndex);
    const btn = page.getByTestId(`choice-${bad}`);
    await expect(btn).toBeEnabled();
    const b = (await btn.boundingBox())!;
    for (let i = 0; i < 10; i++) await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    expect((await attemptsOf(page, 'hiragana')).length).toBe(0);
    await page.getByTestId(`choice-${d.answerIndex}`).click();
    await expect.poll(async () => (await attemptsOf(page, 'hiragana')).length).toBe(1);
    const a = (await attemptsOf(page, 'hiragana'))[0]!;
    expect(a.operationIssue).toBe(true);
    await expect
      .poll(async () => ((await currentExposed(page)).data as { index: number }).index, {
        timeout: 20_000,
      })
      .toBe(1);
    expect((await attemptsOf(page, 'hiragana')).length).toBe(1);
  });
});

test('E-04 途中でおうち → 同じモード → つづきから で同じ問題番号から', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await openMode(page, 'shopping');
  const n0 = 0;
  await expect.poll(async () => (await histLen(page)) > n0).toBe(true);
  const q0 = (await currentExposed(page)).data as {
    index: number;
    lines: { item: string; count: number }[];
  };
  expect(q0.index).toBe(0);
  // 1問目を解く
  for (const l of q0.lines) {
    for (let i = 0; i < l.count; i++) await page.getByTestId(`shelf-${l.item}`).click();
  }
  await page.getByTestId('register-button').click();
  await expect
    .poll(async () => ((await currentExposed(page)).data as { index: number }).index, {
      timeout: 15_000,
    })
    .toBe(1);
  const q1 = (await currentExposed(page)).data as {
    lines: { item: string; count: number }[];
    shelf: string[];
  };
  // 2問目で1つだけ かごに入れて、おうちへ
  const first = q1.lines[0]!.item;
  await page.getByTestId(`shelf-${first}`).click();
  await expect(page.getByTestId(`basket-${first}`)).toHaveCount(1);
  await clickUntil(page, page.getByTestId('home-button'), page.getByTestId('home'));

  // 同じモード → つづきから？
  await openMode(page, 'shopping');
  await expect(page.getByTestId('resume-prompt')).toBeVisible();
  await page.getByTestId('resume-yes').click();
  await expect(page.getByTestId('mode-shopping')).toBeVisible();
  await expect
    .poll(async () => ((await currentExposed(page)).data as { index: number }).index)
    .toBe(1);
  const again = (await currentExposed(page)).data as { lines: unknown };
  expect(again.lines).toEqual(q1.lines);
  await expect(page.getByTestId(`basket-${first}`)).toHaveCount(1);

  // もう一度おうち → 「はじめから」で最初の問題から
  await clickUntil(page, page.getByTestId('home-button'), page.getByTestId('home'));
  await openMode(page, 'shopping');
  await expect(page.getByTestId('resume-prompt')).toBeVisible();
  await page.getByTestId('resume-no').click();
  await expect(page.getByTestId('mode-shopping')).toBeVisible();
  await expect
    .poll(async () => ((await currentExposed(page)).data as { index: number }).index)
    .toBe(0);
});

test('E-12 画面遷移で前の音声が止まる', async ({ page, browserName }) => {
  test.setTimeout(90_000);
  await boot(page);
  await openMode(page, 'shopping');
  const listen = page.getByTestId('listen-button');
  // 問題文の読み上げが始まるまで待つ（音が出ない環境では始まらない）
  const started = await expect
    .poll(async () => listen.getAttribute('data-speaking'), { timeout: 12_000 })
    .toBe('1')
    .then(
      () => true,
      () => false,
    );
  test.skip(
    !started,
    `${browserName}: ヘッドレス環境で音声の再生が始まらなかった（speaking が一度も 1 にならない）`,
  );
  // 読み上げ中にハッシュ遷移（router の hashchange で audio.stop）→ ノートの listen-button が停止状態
  await page.evaluate(() => {
    location.hash = '#/notebook';
  });
  await expect(page.getByTestId('notebook')).toBeVisible();
  await expect(page.getByTestId('listen-button')).toHaveAttribute('data-speaking', '0');
  // しばらく待っても再開しない
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('listen-button')).toHaveAttribute('data-speaking', '0');

  // おうちボタンでも止まる: 別モードを開いて読み上げ中に おうち → すぐ別画面
  await clickUntil(page, page.getByTestId('home-button'), page.getByTestId('home'));
  await openMode(page, 'hiragana');
  await expect(page.getByTestId('listen-button')).toHaveAttribute('data-speaking', '1', {
    timeout: 12_000,
  });
  await clickUntil(page, page.getByTestId('home-button'), page.getByTestId('home'));
  await clickUntil(page, page.getByTestId('home-notebook'), page.getByTestId('notebook'));
  await expect(page.getByTestId('listen-button')).toHaveAttribute('data-speaking', '0');
});

test.describe('E-15 タッチ相当（hasTouch の tap。実機の指操作の確認ではない）', () => {
  test.use({ hasTouch: true });
  test.beforeEach(({ browserName }) => {
    test.skip(
      browserName !== 'chromium',
      'Firefox は hasTouch / CDP タッチを使えない（Playwright の制約）。実機チェックリストで確認する',
    );
  });

  const taps: { name: string; mode: string; variant?: string; levels: Record<string, number> }[] = [
    { name: 'おかいもの', mode: 'shopping', levels: { shop: 1 } },
    { name: 'なかまわけ', mode: 'sorting', levels: { sort: 1 } },
    { name: 'さんすう', mode: 'math', variant: 'add', levels: { add: 1 } },
    { name: 'かたち', mode: 'shapes', levels: { shape: 1 } },
  ];
  for (const t of taps) {
    test(`${t.name}を tap で完了`, async ({ page }) => {
      test.setTimeout(180_000);
      await gotoApp(page);
      await prepare(page, { levels: t.levels });
      await page.getByTestId('start-button').tap();
      await expect(page.getByTestId('home')).toBeVisible();
      const n0 = await histLen(page);
      await openMode(page, t.mode, t.variant, true);
      const cdp = await page.context().newCDPSession(page);
      const r = await playRound(page, { ctl: touchCtl(page, cdp), wrongFirst: true, from: n0 });
      await expect(page.getByTestId('done-screen')).toBeVisible();
      expect(r.indexes.length).toBeGreaterThan(0);
      await page.getByTestId('done-home-button').tap();
      await expect(page.getByTestId('home')).toBeVisible();
    });
  }

  test('なぞり: CDP の Input.dispatchTouchEvent で1題を完成', async ({ page }) => {
    test.setTimeout(120_000);
    await gotoApp(page);
    await prepare(page, { levels: { trace: 0 } });
    await page.getByTestId('start-button').tap();
    await openMode(page, 'trace', 'lines', true);
    const cdp = await page.context().newCDPSession(page);
    const ctl = touchCtl(page, cdp);
    await expect.poll(async () => (await histLen(page)) > 0).toBe(true);
    const d = (await currentExposed(page)).data as { strokes: [number, number][][] };
    for (const s of await guideToScreen(page, d.strokes, 2)) await ctl.stroke(s);
    await expect(page.getByTestId('trace-board')).toHaveAttribute('data-phase', 'solved');
    const a = await attemptsOf(page, 'trace');
    expect(a.length).toBe(1);
    expect(a[0]!.inputKind).toBe('touch');
  });
});

test.describe('E-16 利用時間の目安', () => {
  test('目安に達していると、回の終わりに「きょうは ここまで」と おうち だけが出る', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await gotoApp(page);
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const startedAt = dayStart.getTime() + 1000;
    await prepare(page, {
      levels: { shop: 0 },
      settings: { sessionMinutes: 5 },
      rounds: [
        { modeId: 'math', variantId: 'add', startedAt, endedAt: startedAt + 6 * 60_000, count: 4 },
      ],
    });
    await start(page);
    const n0 = await histLen(page);
    await openMode(page, 'shopping');
    await playRound(page, { ctl: mouseCtl(page), from: n0 });
    await expect(page.getByTestId('done-screen')).toBeVisible();
    await expect(page.getByTestId('done-screen')).toContainText('きょうは ここまで');
    await expect(page.getByTestId('again-button')).toHaveCount(0);
    await expect(page.getByTestId('done-home-button')).toBeVisible();
  });

  test('目安に達していないときは出ない（もういっかい が残る）。なぞりの途中でも出ない', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await gotoApp(page);
    await prepare(page, { levels: { trace: 0 }, settings: { sessionMinutes: 5 } });
    await start(page);
    const n0 = await histLen(page);
    await openMode(page, 'trace', 'lines');
    // なぞりの途中（1題目を完成させた直後）には出ない
    await expect.poll(async () => (await histLen(page)) > n0).toBe(true);
    await expect(page.getByTestId('trace-board')).toBeVisible();
    await expect(page.getByText('きょうは ここまで')).toHaveCount(0);
    await playRound(page, { ctl: mouseCtl(page), from: n0 });
    await expect(page.getByTestId('done-screen')).toBeVisible();
    await expect(page.getByTestId('done-screen')).not.toContainText('きょうは ここまで');
    await expect(page.getByTestId('again-button')).toBeVisible();
  });
});

test.describe('E-17 動きを減らす', () => {
  const prep = async (page: Page, reduce: boolean) => {
    await page.emulateMedia({ reducedMotion: reduce ? 'reduce' : 'no-preference' });
    await gotoApp(page);
    await prepare(page, { levels: { road: 0 } });
    await start(page);
    await openMode(page, 'road', 'puzzle');
    await expect.poll(async () => (await histLen(page)) > 0).toBe(true);
    const d = (await currentExposed(page)).data as {
      board: { cells: { t: string }[][] };
      solutions: { r: number; c: number; kind: 'straight' | 'corner'; rot: number }[][];
    };
    let goal = { r: -1, c: -1 };
    d.board.cells.forEach((row, r) =>
      row.forEach((c, k) => c.t === 'goal' && (goal = { r, c: k })),
    );
    await placeRoad(page, mouseCtl(page), d.solutions[0]!);
    return goal;
  };
  const rabbitPos = async (page: Page) => {
    const rb = page.getByTestId('rabbit');
    return {
      r: Number(await rb.getAttribute('data-rabbit-r')),
      c: Number(await rb.getAttribute('data-rabbit-c')),
    };
  };

  test('reduce: しゅっぱつ → うさぎは歩かず、すぐ ゴールに表示される', async ({ page }) => {
    test.setTimeout(90_000);
    const goal = await prep(page, true);
    expect(
      await page.evaluate(() => document.documentElement.classList.contains('reduce-motion')),
    ).toBe(true);
    await page.getByTestId('go-button').click();
    await expect(page.getByTestId('road-puzzle')).toHaveAttribute('data-phase', 'walking');
    expect(await rabbitPos(page)).toEqual(goal);
    await expect(page.getByTestId('arrived-ring')).toBeVisible({ timeout: 10_000 });
  });

  test('対照: 通常は うさぎが歩く（クリック直後はゴールにいない）', async ({ page }) => {
    test.setTimeout(90_000);
    const goal = await prep(page, false);
    await page.getByTestId('go-button').click();
    await expect(page.getByTestId('road-puzzle')).toHaveAttribute('data-phase', 'walking');
    expect(await rabbitPos(page)).not.toEqual(goal);
    await expect(page.getByTestId('arrived-ring')).toBeVisible({ timeout: 15_000 });
  });
});

// 型の未使用警告を避ける
void idbGetAll;
