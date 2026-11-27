import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  attemptsOf,
  gotoApp,
  histLen,
  idbGetAll,
  idbPutMany,
  openMode,
  openParent,
  start,
} from './helpers/app';
import { mouseCtl, playRound } from './helpers/solve';

/**
 * 使いやすさの直し・保護者の組（F3。FX09・FX11・FX13・FX14）。
 *  FX09: 保護者画面で記録を見るだけでは、遊ぶ人が替わらない。「こどもの画面へ」で 2人以上なら「だれが あそぶ？」
 *  FX11: 保護者ゲートがキーボード（数字・Enter・Backspace・Esc）を受ける。保護者画面の押す所は 44px 以上
 *  FX13: 起動画面と「このアプリについて」の「オフライン」の文が、開き直す前から食い違わない
 *  FX14: 保護者の「きろく」に、そのホームで遊べない v1 の表・子供のホームと違うおすすめ・問題の ID を出さない
 */

const DB_APP_STORE = 'app';

/**
 * 起動 →「はじめる」→ ホーム。Firefox は初めの1枚の読み込みが遅いことがある（教材の準備と重なる）ので、
 * ホームが出るまで長めに待つ（helpers/app.ts の boot は 15 秒）
 */
async function boot(page: Page): Promise<void> {
  await gotoApp(page);
  await page.getByTestId('start-button').click();
  await expect(page.getByTestId('home')).toBeVisible({ timeout: 60_000 });
}

async function activeId(page: Page): Promise<string | null> {
  const rec = (await idbGetAll<{ activeProfileId: string | null }>(page, DB_APP_STORE))[0];
  return rec?.activeProfileId ?? null;
}

/** 保護者ゲートを長押しで開く（計算問題は解かない） */
async function longPressGate(page: Page): Promise<void> {
  const key = page.getByTestId('parent-key');
  await expect(key).toBeVisible();
  const box = (await key.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.getByTestId('parent-gate')).toBeVisible({ timeout: 6000 });
  await page.mouse.up();
}

/** 計算問題「a ＋ b は？」の答え */
async function gateAnswer(page: Page): Promise<string> {
  const q = page.getByTestId('gate-question');
  await expect(q).toContainText('＋');
  const m = /(\d+)\s*＋\s*(\d+)/.exec((await q.textContent()) ?? '');
  expect(m).not.toBeNull();
  return String(Number(m![1]) + Number(m![2]));
}

/** 1回遊ぶ（ホームから開始 → 完了画面 → ホーム） */
async function playOnce(page: Page, mode: string, variant?: string): Promise<void> {
  const n0 = await histLen(page);
  await openMode(page, mode, variant);
  await playRound(page, { ctl: mouseCtl(page), from: n0 });
  await expect(page.getByTestId('done-screen')).toBeVisible();
  await page.getByTestId('done-home-button').click();
  await expect(page.getByTestId('home')).toBeVisible();
}

// ------------------------------------------------------------------ FX09

test.describe('FX09 見る人と遊ぶ人', () => {
  test('見るだけでは遊ぶ人が替わらない。「こどもの画面へ」で だれが あそぶ？。記録は遊ぶ人に入る', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await boot(page);
    const a = (await idbGetAll<{ id: string; name: string }>(page, 'profiles'))[0]!;
    await openParent(page, 'profiles');
    await page.getByTestId('profile-name-new').fill('はな');
    await page.getByTestId('profile-add').click();
    await expect(page.getByTestId('tab-profiles')).toContainText('「はな」を追加しました');
    const b = (await idbGetAll<{ id: string; name: string }>(page, 'profiles')).find(
      (p) => p.name === 'はな',
    )!;
    await page.getByTestId('parent-tab-records').click();
    expect(await activeId(page)).toBe(a.id);

    // 保護者画面で B を見る。見るだけでは、保存の遊ぶ人（activeProfileId）は A のまま
    const select = page.getByTestId('parent-profile-select');
    await expect(select).toHaveValue(a.id);
    await select.selectOption({ label: 'はな' });
    await expect(select).toHaveValue(b.id);
    await expect(page.getByTestId('tab-records')).toBeVisible();
    await expect(page.getByText('まだ記録がありません')).toBeVisible();
    await page.waitForTimeout(600);
    expect(await activeId(page)).toBe(a.id);

    // 「こどもの画面へ」: 2人以上なので「だれが あそぶ？」。選ぶまで遊ぶ人は A のまま
    await page.getByTestId('parent-to-child').click();
    await expect(page.getByTestId('profile-picker')).toBeVisible();
    await expect(page.getByText('だれが あそぶ？')).toBeVisible();
    await expect(page.getByTestId('start-button')).toHaveCount(0);
    expect(await activeId(page)).toBe(a.id);
    await page.getByRole('button', { name: a.name }).click();
    await expect(page.getByTestId('home')).toBeVisible();
    await expect(page.locator('.home-profile')).toContainText(a.name);
    expect(await activeId(page)).toBe(a.id);

    // A で遊んだ記録は A に入る（B を見たことで B に入らない）
    await playOnce(page, 'shopping');
    const attempts = await attemptsOf(page);
    expect(attempts.length).toBeGreaterThan(0);
    expect(attempts.every((x) => x.profileId === a.id)).toBe(true);

    // 保護者画面を開き直すと、見る人は遊ぶ人（A）から始まる。B を見てから B を選ぶと、B が遊ぶ人になる
    await openParent(page, 'records');
    await expect(page.getByTestId('parent-profile-select')).toHaveValue(a.id);
    await expect(page.getByTestId('recent-table')).toContainText('おかいもの');
    await page.getByTestId('parent-profile-select').selectOption({ label: 'はな' });
    await expect(page.getByText('まだ記録がありません')).toBeVisible();
    await page.getByTestId('parent-to-child').click();
    await page.getByRole('button', { name: 'はな' }).click();
    await expect(page.getByTestId('home')).toBeVisible();
    await expect(page.locator('.home-profile')).toContainText('はな');
    expect(await activeId(page)).toBe(b.id);
  });

  test('せっていを見ている人にだけ入れても、遊ぶ人の設定は変わらない', async ({ page }) => {
    await boot(page);
    const a = (await idbGetAll<{ id: string }>(page, 'profiles'))[0]!;
    await openParent(page, 'profiles');
    await page.getByTestId('profile-name-new').fill('はな');
    await page.getByTestId('profile-add').click();
    await expect(page.getByTestId('tab-profiles')).toContainText('「はな」を追加しました');
    const b = (await idbGetAll<{ id: string; name: string }>(page, 'profiles')).find(
      (p) => p.name === 'はな',
    )!;
    await page.getByTestId('parent-tab-settings').click();
    await page.getByTestId('parent-profile-select').selectOption({ label: 'はな' });
    const sfx = page.getByTestId('setting-sfx');
    await expect(sfx).toBeChecked();
    // 保存してから画面に反映される（押した直後は変わらない）ので、check()/uncheck() ではなく click() で押す
    await sfx.click();
    await expect(sfx).not.toBeChecked();
    // 保存されるのは見ている人（はな）の設定だけ。遊ぶ人（こども）の設定は変わらない
    await expect
      .poll(async () =>
        (await idbGetAll<{ profileId: string; sfx: boolean }>(page, 'settings'))
          .filter((s) => !s.sfx)
          .map((s) => s.profileId),
      )
      .toEqual([b.id]);
    expect(await activeId(page)).toBe(a.id);
  });

  test('1人だけのときは、「こどもの画面へ」でそのままホーム', async ({ page }) => {
    await boot(page);
    await openParent(page, 'records');
    await page.getByTestId('parent-to-child').click();
    await expect(page.getByTestId('home')).toBeVisible();
    await expect(page.getByTestId('profile-picker')).toHaveCount(0);
  });
});

// ------------------------------------------------------------------ FX11

test.describe('FX11 保護者ゲートのキーボードと押す所の大きさ', () => {
  test('数字・Backspace・Enter・Esc で操作できる', async ({ page }) => {
    await boot(page);
    await longPressGate(page);
    const input = page.locator('.gate-input');
    const answer = await gateAnswer(page);

    // 数字キーで入る。Backspace は1字消す
    await page.keyboard.press('1');
    await page.keyboard.press('2');
    await expect(input).toHaveText('12');
    await page.keyboard.press('Backspace');
    await expect(input).toHaveText('1');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await expect(input).toHaveText('');

    // まちがった答えで Enter: 開かない
    const wrong = String(Number(answer) + 1);
    await page.keyboard.type(wrong);
    await page.keyboard.press('Enter');
    await expect(page.locator('.gate-error')).toBeVisible();
    await expect(page.getByTestId('parent-app')).toHaveCount(0);

    // まちがえると問題が替わる（公開の前の点検 R3）。前の答えとは違う、新しい問題の答えを読み直す
    const next = await gateAnswer(page);
    expect(next).not.toBe(answer);

    // ボタンにフォーカスがあるとき（マウスでキーを押したあと）も、Enter は OK として働く（数字が1つ増えない）
    await page.getByTestId('gate-key-1').click();
    await page.keyboard.press('Backspace');
    await page.keyboard.type(next);
    await expect(input).toHaveText(next);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('parent-app')).toBeVisible();
  });

  test('Esc で閉じて、鍵のボタンにフォーカスが戻る。Tab は板の中だけを回る', async ({ page }) => {
    await boot(page);
    await longPressGate(page);
    await expect(page.getByTestId('parent-gate')).toBeVisible();
    // 開いた直後（板そのものにフォーカス）の Shift+Tab も、板の外（後ろの鍵のボタン）へ出ない。最後の「もどる」へ
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe(
      'gate-cancel',
    );
    // フォーカスは板の中に移っている。Tab を何度押しても板の外へ出ない
    for (let i = 0; i < 16; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('.gate-panel'))).toBe(
        true,
      );
    }
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('.gate-panel'))).toBe(
        true,
      );
    }
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('parent-gate')).toHaveCount(0);
    await expect(page.getByTestId('home')).toBeVisible();
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe(
      'parent-key',
    );

    // 「もどる」にフォーカスして Enter: 答えを送らずに閉じる
    await longPressGate(page);
    await page.keyboard.type(await gateAnswer(page));
    await page.getByTestId('gate-cancel').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('parent-gate')).toHaveCount(0);
    await expect(page.getByTestId('parent-app')).toHaveCount(0);
    await expect(page.getByTestId('home')).toBeVisible();
  });

  /** 押す所・入れる所の高さ（px）が 44 未満のものを集める（checkbox・radio・range は押せるラベル全体で見る） */
  const small = (page: Page): Promise<string[]> =>
    page.evaluate(() => {
      const root = document.querySelector('.parent-root')!;
      const out: string[] = [];
      for (const e of root.querySelectorAll<HTMLElement>(
        'button, select, summary, textarea, input, a[href]',
      )) {
        if (e.getClientRects().length === 0) continue;
        const type = (e as HTMLInputElement).type;
        if (type === 'hidden') continue;
        const wide = type === 'checkbox' || type === 'radio' || type === 'range';
        const box = wide ? (e.closest('label') ?? e) : e;
        const h = box.getBoundingClientRect().height;
        if (h < 44)
          out.push(
            `${e.tagName.toLowerCase()}[${type ?? ''}] ${e.textContent?.trim().slice(0, 16)} ${h}`,
          );
      }
      return out;
    });

  for (const [w, h] of [
    [1280, 620],
    [1920, 1080],
  ] as const) {
    test(`保護者画面の8タブとプロフィールの編集・確認の板で、44px 未満の押す所が 0（${w}×${h}）`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: w, height: h });
      await boot(page);
      await openParent(page, 'records');
      const tabs = ['records', 'settings', 'works', 'memos', 'profiles', 'data', 'packs', 'about'];
      for (const t of tabs) {
        await page.getByTestId(`parent-tab-${t}`).click();
        await expect(page.getByTestId(`tab-${t}`)).toBeVisible();
        expect(await small(page), `タブ ${t}`).toEqual([]);
      }
      // せってい: 音量のスライダー（range）は押せる高さが 44px
      await page.getByTestId('parent-tab-settings').click();
      const volume = page.getByTestId('setting-volume');
      const slider = await volume.boundingBox();
      expect(slider!.height).toBeGreaterThanOrEqual(44);
      // 棒（高さ 16px ほど）の真ん中から 18px 上を押しても値が変わる（押せる範囲が棒の外まで広がっている）
      const v0 = await volume.inputValue();
      await page.mouse.click(
        slider!.x + slider!.width * (v0 === '20' ? 0.6 : 0.2),
        slider!.y + slider!.height / 2 - 18,
      );
      await expect(volume).not.toHaveValue(v0);
      // プロフィール: 編集を開いた状態・記録の削除の確認の板
      await page.getByTestId('parent-tab-profiles').click();
      const pid = (await idbGetAll<{ id: string }>(page, 'profiles'))[0]!.id;
      await page.getByTestId(`profile-edit-${pid}`).click();
      expect(await small(page), 'プロフィールの編集').toEqual([]);
      await page.getByRole('button', { name: 'やめる' }).click();
      await page.getByTestId(`profile-clear-${pid}`).click();
      expect(await small(page), '確認の板').toEqual([]);
    });
  }
});

// ------------------------------------------------------------------ FX13

test.describe('FX13 起動画面と「このアプリについて」の「オフライン」の文', () => {
  test('開き直す前は、どちらも「いちど開き直すと使えます」。開き直したあとは、どちらも使えると言う', async ({
    page,
    browserName,
  }) => {
    // Firefox は、この配信（vite preview）では本体の準備（数千ファイルの取得）が終わらない・失敗することがある
    // （基準のビルドでも起きる。環境）。Firefox の文の確かめは単体テスト（src/app/offlineNote.test.tsx）で行う
    test.skip(
      browserName === 'firefox',
      'Firefox の Service Worker の準備が、この配信では安定しない',
    );
    test.setTimeout(180_000);
    await gotoApp(page);
    const startNote = page.locator('.start-notes [data-testid="offline-status"]');
    // 初めて開いた画面: Service Worker の準備が終わっても、まだこのページを制御していない
    await expect(startNote).toBeVisible({ timeout: 90_000 });
    await expect(startNote).not.toContainText('準備中', { timeout: 90_000 });
    expect(await page.evaluate(() => navigator.serviceWorker.controller === null)).toBe(true);
    const first = (await startNote.textContent())!;
    expect(first).toBe('オフラインの準備ができました。いちど開き直すと使えます。');
    expect(first).not.toContain('つかえます');
    await start(page);
    await openParent(page, 'about');
    await expect(page.getByTestId('offline-status')).toHaveText(first);

    // 開き直す: どちらも使えると言う
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('start-button')).toBeEnabled();
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    await expect(startNote).toHaveText('オフラインで使えます', { timeout: 90_000 });
    await start(page);
    await openParent(page, 'about');
    await expect(page.getByTestId('offline-status')).toHaveText('オフラインで使えます');
  });
});

// ------------------------------------------------------------------ FX14

test.describe('FX14 きろく: そのホームで遊べない表・違うおすすめ・問題の ID', () => {
  const NOW = Date.now();

  /** 先頭のプロフィールの区分を変え、1.0 のあそびの記録と、単元の記録（問題の key は内部の ID の形）を入れる */
  async function seed(page: Page, audience: 'p4' | 'g3'): Promise<string> {
    await gotoApp(page);
    const prof = (await idbGetAll<Record<string, unknown> & { id: string }>(page, 'profiles'))[0]!;
    if (audience === 'g3') {
      await idbPutMany(page, 'profiles', [{ ...prof, audience: 'g3', enrolledGrade: 3 }]);
    }
    const unit = audience === 'g3' ? 'g3.math.abacus' : 'p4.en.hello';
    const base = {
      profileId: prof.id,
      variantId: 'main',
      level: 0,
      wrongTries: 0,
      hintsUsed: 0,
      reviewsUsed: 0,
      operationIssue: false,
    };
    const unitRow = (over: Record<string, unknown>) => ({
      ...base,
      modeId: 'unit',
      unitId: unit,
      skillId: null,
      inputKind: 'unknown',
      ...over,
    });
    const rows: Record<string, unknown>[] = [
      {
        ...base,
        modeId: 'shopping',
        skillId: 'shop',
        itemKey: 'りんご×1',
        outcome: 'independent',
        inputKind: 'mouse',
        at: NOW - 1000,
      },
      // 同じ問題に3回（自力0）。問題の key は内部の ID の形
      ...[0, 1, 2].map((i) =>
        unitRow({ itemKey: 'direct:3:5:0', outcome: 'skipped', at: NOW - (10 + i) * 60_000 }),
      ),
      unitRow({
        itemKey: 'read-table:12',
        outcome: 'independent',
        operationIssue: true,
        at: NOW - 30 * 60_000,
      }),
    ];
    await idbPutMany(page, 'attempts', rows);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('start-button')).toBeEnabled();
    return prof.id;
  }

  /** 子供のホームの「おすすめ」の名前 */
  async function homeRecs(page: Page): Promise<string[]> {
    await page.getByTestId('start-button').click();
    const rec = page.locator('.home-side [aria-label^="おすすめ "]');
    await expect(rec.first()).toBeVisible();
    return (await rec.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!))).map(
      (l) => l.replace(/^おすすめ /, '').replace(/ ふくしゅう$/, ''),
    );
  }

  async function parentRecs(page: Page): Promise<string[]> {
    await openParent(page, 'records');
    // 記録の読み込みが終わると「きょうの おすすめ」の一覧が出る
    const items = page.getByTestId('recommendations').locator('li');
    await expect(items.first()).toBeVisible();
    return items.evaluateAll((els) => els.map((e) => e.firstChild?.textContent?.trim() ?? ''));
  }

  test('小3: v1 の13行を出さず、おすすめはホームと同じで、問題の ID が出ない', async ({ page }) => {
    await seed(page, 'g3');
    const home = await homeRecs(page);
    expect(home).toHaveLength(3);
    const parent = await parentRecs(page);
    expect(parent).toEqual(home);

    await expect(page.getByTestId('tab-records')).toBeVisible();
    await expect(page.locator('tr[data-testid^="skill-"]')).toHaveCount(0);
    await expect(page.getByTestId('skill-table')).toHaveCount(0);
    const text = (await page.getByTestId('tab-records').innerText()).replace(/\s+/g, ' ');
    expect(text).not.toMatch(/direct:|read-table:/);
    // 1.0 のあそびの問題の文は、これまでどおり出る
    await expect(page.getByTestId('recent-table')).toContainText('りんご×1');
    // 単元の「むずかしそうな問題」は、問題の ID でなく単元の題と問題の数
    await expect(page.getByTestId('hard-items')).toContainText('そろばん');
    await expect(page.getByTestId('hard-items')).toContainText('1問');
  });

  test('4歳: v1 の13行は出る。おすすめはホームと同じで、問題の ID は出ない', async ({ page }) => {
    await seed(page, 'p4');
    const home = await homeRecs(page);
    expect(home.length).toBeGreaterThan(0);
    expect(await parentRecs(page)).toEqual(home);
    await expect(page.locator('tr[data-testid^="skill-"]')).toHaveCount(13);
    const text = (await page.getByTestId('tab-records').innerText()).replace(/\s+/g, ' ');
    expect(text).not.toMatch(/direct:|read-table:/);
  });
});
