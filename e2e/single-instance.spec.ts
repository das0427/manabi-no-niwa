/**
 * 二重起動の防止（画面は1つ）の E2E。設計: docs/expansion/single-instance-design.md 2.3・2.4・5.1。chromium と firefox の両方で流す。
 *
 * - 同じブラウザ（context）で2つ目の画面が開いたら、新しい画面が残り、前の画面は保存を済ませて引き下がる。
 *   前の画面が自分を閉じられるか（window.close() が効くか）は、窓の作られ方と履歴の数で決まる:
 *   ・スクリプトが開いた窓（window.open のポップアップ）は、履歴の数に関わらず閉じられる。
 *   ・ブラウザが作った窓（context.newPage()）は、履歴が1件のときだけ閉じられる。画面を移ると（ホームへ進むと）閉じられない。
 *     本物の --app 窓は、この種類（ブラウザが作る窓）なので、はじめるを押す前だけ自分で閉じる。
 *   ・Playwright の newPage() は、Chromium では about:blank が履歴の1件目になるので、goto すると履歴が2件になり、
 *     はじめから window.close() が効かない（Firefox は goto のあとも1件で、はじめるを押す前は閉じられる）。
 *     そのため「閉じられる道」はどちらのブラウザでも同じに動くポップアップで、「閉じられない道」は
 *     画面を移した newPage（Chromium は移す前から）で調べる。
 * - 「画面は1つ」の守りを止める旗（mnw:test:multiWindow）は、ここでは立てない（旗の試験を除く）。
 * - ポップアップの元のページは about:blank のままにする（アプリを動かさない）。
 * - あわせて、新しい2つの画面（べつの まどで ひらいています・保護者画面「せってい」の全画面の節）の見た目を、
 *   4つの画面の大きさで、要素の箱（getBoundingClientRect）・scrollWidth・行の分かれ方から検査する。
 *   MNW_SHOTS_DIR があれば、同じ画面のスクリーンショットをそこに保存する。
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { defaultSupport } from '../src/audience/audience';
import { allowMultiWindow, boot, idbGetAll, openParent, prepare, start } from './helpers/app';
import { inspectText } from './helpers/text-layout';

const RETIRED_TITLE = 'とじた がめん（まなびのにわ）';
const APP_TITLE = 'まなびのにわ';

type Info = { role: string; takeover: boolean } | undefined;

/** 試験用の公開（window.__mnwInstance）を使えるようにする。旗（mnw:test:multiWindow）は立てない */
async function markTest(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    try {
      localStorage.setItem('mnw:test', '1');
    } catch {
      /* 無視 */
    }
  });
}

const appUrl = (baseURL: string | undefined, query = '?seed=1'): string =>
  new URL(`/${query}`, baseURL).toString();

/** 元のページ（about:blank のまま）から window.open で窓を開く。開いた窓は、スクリプトが開いた窓（閉じられる） */
async function popupApp(opener: Page, url: string): Promise<Page> {
  const [popup] = await Promise.all([
    opener.waitForEvent('popup'),
    opener.evaluate((u) => {
      window.open(u);
    }, url),
  ]);
  return popup;
}

const instanceOf = (page: Page): Promise<Info> =>
  page.evaluate(() => (window as unknown as { __mnwInstance?: Info }).__mnwInstance);

const historyLength = (page: Page): Promise<number> => page.evaluate(() => history.length);

/** context の外へ出る要求（127.0.0.1 以外）を集める（BC-03） */
function watchExternal(context: BrowserContext): string[] {
  const external: string[] = [];
  context.on('request', (req) => {
    const u = new URL(req.url());
    if (['data:', 'blob:', 'about:'].includes(u.protocol)) return;
    if (u.hostname !== '127.0.0.1') external.push(req.url());
  });
  return external;
}

/** ページの IndexedDB への書き込みの数を、ページを置き換えても残る場所（sessionStorage）に数える */
const COUNT_IDB_WRITES = `
(() => {
  const key = 'mnw:idbWrites';
  const bump = () => {
    try {
      sessionStorage.setItem(key, String(Number(sessionStorage.getItem(key) || '0') + 1));
    } catch (e) {}
  };
  for (const m of ['put', 'add', 'delete', 'clear']) {
    const orig = IDBObjectStore.prototype[m];
    IDBObjectStore.prototype[m] = function () {
      bump();
      return orig.apply(this, arguments);
    };
  }
  try {
    window.__idbWrites0 = Number(sessionStorage.getItem(key) || '0');
  } catch (e) {
    window.__idbWrites0 = -1;
  }
})();
`;

/** { 文書の最初に数えていた数, いまの数 }。同じ文書の中で増えた数は、いま - 最初 */
const idbWrites = (page: Page): Promise<{ at0: number; now: number }> =>
  page.evaluate(() => ({
    at0: (window as unknown as { __idbWrites0: number }).__idbWrites0,
    now: Number(sessionStorage.getItem('mnw:idbWrites') ?? '0'),
  }));

/** requestFullscreen を数える見張り（本物は呼ばない。ヘッドレスで窓の大きさを変えないため） */
const SPY_FULLSCREEN = `
(() => {
  window.__fsCalls = 0;
  Element.prototype.requestFullscreen = function () {
    window.__fsCalls += 1;
    return Promise.resolve();
  };
})();
`;
const fullscreenCalls = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __fsCalls?: number }).__fsCalls ?? -1);

test.describe('二重起動の防止（画面は1つ）', () => {
  test('起動画面のまま（窓を閉じられる）: 2つ目を開くと 1つ目が閉じ、2つ目は起動画面から始まる', async ({
    context,
    baseURL,
  }) => {
    await markTest(context);
    const external = watchExternal(context);
    const url = appUrl(baseURL);
    const opener = await context.newPage();

    const a = await popupApp(opener, url);
    await expect(a.getByTestId('start-button')).toBeEnabled();
    expect(await instanceOf(a)).toEqual({ role: 'primary', takeover: false });
    expect(await historyLength(a)).toBe(1);

    const closed = a.waitForEvent('close');
    const b = await popupApp(opener, url);
    await closed;

    await expect.poll(() => instanceOf(b)).toEqual({ role: 'primary', takeover: true });
    await expect(b.getByTestId('start-button')).toBeEnabled();
    await expect(b).toHaveTitle(APP_TITLE);
    expect(b.isClosed()).toBe(false);
    expect(external, '外部ドメインへのリクエスト').toEqual([]);
  });

  test('画面を移ったあと（窓を閉じられない）: 前の画面は「べつの まどで ひらいています」になり、記録を書かない', async ({
    context,
    baseURL,
  }) => {
    await markTest(context);
    const url = appUrl(baseURL);
    const opener = await context.newPage();

    // A: ブラウザが作る窓。はじめるを押してホームへ進む（履歴が2件以上になり、自分では閉じられない）
    const a = await context.newPage();
    await a.addInitScript(COUNT_IDB_WRITES);
    await a.goto(url);
    await expect(a.getByTestId('start-button')).toBeEnabled();
    await start(a);
    expect(await historyLength(a)).toBeGreaterThanOrEqual(2);
    const profilesBefore = await idbGetAll<{ id: string }>(a, 'profiles');
    expect(profilesBefore.length).toBeGreaterThan(0);
    // 対照: 数える仕組みが働いている（A はここまでに書いている）
    expect((await idbWrites(a)).now).toBeGreaterThan(0);

    const b = await popupApp(opener, url);
    await expect.poll(() => instanceOf(b)).toEqual({ role: 'primary', takeover: true });
    await expect(b.getByTestId('start-button')).toBeEnabled();

    // A は置き換わって、引き下がった画面になる
    await expect(a.getByTestId('instance-retired')).toBeVisible({ timeout: 15_000 });
    expect(a.isClosed()).toBe(false);
    await expect(a).toHaveTitle(RETIRED_TITLE);
    expect(new URL(a.url()).search).toBe('?retired=1');
    expect(await instanceOf(a)).toEqual({ role: 'retired', takeover: false });
    await expect(a.getByTestId('instance-retired')).toContainText('べつの まどで ひらいています');
    await expect(a.getByTestId('home')).toHaveCount(0);

    // 引き下がった画面は、何も書かない（置き換わったあとの文書の中で、書き込みが増えていない）
    await a.waitForTimeout(1500);
    const w = await idbWrites(a);
    expect(w.at0).toBeGreaterThan(0);
    expect(w.now - w.at0, '引き下がった画面が IndexedDB に書いた数').toBe(0);

    // 記録は新しい画面（B）から読める。A が書いたプロフィールが残っている
    const profilesAfter = await idbGetAll<{ id: string }>(b, 'profiles');
    expect(profilesAfter.map((p) => p.id)).toEqual(profilesBefore.map((p) => p.id));
  });

  test('履歴を2件にした画面（history.pushState）も、同じく引き下がった画面になり、［この まどで ひらく］で引き継ぎ直せる', async ({
    context,
    baseURL,
  }) => {
    await markTest(context);
    const url = appUrl(baseURL);
    const opener = await context.newPage();

    const a = await context.newPage();
    await a.goto(url);
    await expect(a.getByTestId('start-button')).toBeEnabled();
    await a.evaluate(() => history.pushState(null, '', location.pathname + location.search));
    expect(await historyLength(a)).toBeGreaterThanOrEqual(2);

    const b = await popupApp(opener, url);
    await expect(b.getByTestId('start-button')).toBeEnabled();
    await expect(a.getByTestId('instance-retired')).toBeVisible({ timeout: 15_000 });
    await expect(a).toHaveTitle(RETIRED_TITLE);

    // A の［この まどで ひらく］→ A が引き継ぎ、B が（閉じられる窓なので）閉じる
    const bClosed = b.waitForEvent('close');
    await a.getByTestId('instance-reopen').click();
    await bClosed;
    await expect.poll(() => instanceOf(a)).toEqual({ role: 'primary', takeover: true });
    await expect(a.getByTestId('start-button')).toBeEnabled();
    await expect(a).toHaveTitle(APP_TITLE);
    await expect(a.getByTestId('instance-retired')).toHaveCount(0);
  });

  test('おえかきの自動保存の前に2つ目を開いても、描いた絵は保存されている（前の画面の片付けで保存してから始まる）', async ({
    context,
    baseURL,
  }) => {
    await markTest(context);
    const url = appUrl(baseURL);
    const opener = await context.newPage();

    const a = await popupApp(opener, url);
    await expect(a.getByTestId('start-button')).toBeEnabled();
    await prepare(a, {
      settings: { support: { ...defaultSupport('p4'), drawingTools: 'simple' } },
    });
    await start(a);
    await a.evaluate(() => (location.hash = '#/draw'));
    await expect(a.getByTestId('draw-screen')).toBeVisible();
    await expect
      .poll(() => a.evaluate(() => !!(window as unknown as { __mnwDraw?: unknown }).__mnwDraw))
      .toBe(true);
    // 自動保存（1.5 秒後）が試験の途中で働かないよう、その予約だけを遠くへ延ばす。
    // 保存できるのは、前の画面の片付け（flush）だけになる
    await a.evaluate(() => {
      const orig = window.setTimeout.bind(window);
      window.setTimeout = ((fn: TimerHandler, ms?: number, ...rest: unknown[]) =>
        orig(fn, ms === 1500 ? 600_000 : ms, ...rest)) as typeof window.setTimeout;
    });

    // 線を1本描く
    const box = (await a.getByTestId('draw-canvas').boundingBox())!;
    await a.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
    await a.mouse.down();
    await a.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.3, { steps: 8 });
    await a.mouse.up();
    await expect(a.getByTestId('draw-screen')).toHaveAttribute('data-save-state', 'pending');
    // 描いた直後に書かれるのは下書き（dirty の印つき）だけ。保存済み（印なし）の作品はまだ無い
    type Row = { doc: { dirty?: boolean } };
    const saved = async (page: Page): Promise<number> =>
      (await idbGetAll<Row>(page, 'artworks')).filter((r) => !r.doc.dirty).length;
    expect(await saved(a), '開く前に保存が終わっていると、この試験は何も確かめない').toBe(0);

    const closed = a.waitForEvent('close');
    const b = await popupApp(opener, url);
    await closed;
    await expect(b.getByTestId('start-button')).toBeEnabled();
    expect(await instanceOf(b)).toEqual({ role: 'primary', takeover: true });
    // 前の画面の片付けで保存された絵が、新しい画面から読める（保存済みの作品が1つ。画像もある）
    expect(await saved(b)).toBe(1);
    expect(await idbGetAll(b, 'artworkBlobs')).not.toHaveLength(0);
  });

  test('PNG づくりが遅くて保存に時間がかかっても、前の画面の保存が終わるまで待ってから引き継ぐ（絵が丸ごと残る）', async ({
    context,
    baseURL,
  }) => {
    await markTest(context);
    const url = appUrl(baseURL);
    const opener = await context.newPage();

    const a = await popupApp(opener, url);
    await expect(a.getByTestId('start-button')).toBeEnabled();
    await prepare(a, {
      settings: { support: { ...defaultSupport('p4'), drawingTools: 'simple' } },
    });
    await start(a);
    await a.evaluate(() => (location.hash = '#/draw'));
    await expect(a.getByTestId('draw-screen')).toBeVisible();
    await expect
      .poll(() => a.evaluate(() => !!(window as unknown as { __mnwDraw?: unknown }).__mnwDraw))
      .toBe(true);
    // 自動保存の予約を遠くへ延ばし、PNG づくり（toBlob）を 1 回ごとに 0.7 秒遅らせる。
    // 前の画面の片付けの保存は、合わせて 2 秒前後かかる（以前の待ちの上限 1.5 秒では切れる長さ）
    await a.evaluate(() => {
      const orig = window.setTimeout.bind(window);
      window.setTimeout = ((fn: TimerHandler, ms?: number, ...rest: unknown[]) =>
        orig(fn, ms === 1500 ? 600_000 : ms, ...rest)) as typeof window.setTimeout;
      const toBlob = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (
        this: HTMLCanvasElement,
        cb: BlobCallback,
        type?: string,
        quality?: number,
      ) {
        orig(() => toBlob.call(this, cb, type, quality), 700);
      };
    });

    const box = (await a.getByTestId('draw-canvas').boundingBox())!;
    await a.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
    await a.mouse.down();
    await a.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.3, { steps: 8 });
    await a.mouse.up();
    await expect(a.getByTestId('draw-screen')).toHaveAttribute('data-save-state', 'pending');
    type Row = { doc: { dirty?: boolean } };
    const saved = async (page: Page): Promise<number> =>
      (await idbGetAll<Row>(page, 'artworks')).filter((r) => !r.doc.dirty).length;
    expect(await saved(a), '開く前に保存が終わっていると、この試験は何も確かめない').toBe(0);

    const closed = a.waitForEvent('close', { timeout: 15_000 });
    const b = await popupApp(opener, url);
    await closed;
    await expect(b.getByTestId('start-button')).toBeEnabled();
    expect(await instanceOf(b)).toEqual({ role: 'primary', takeover: true });
    // 保存済みの作品（ダーティ印なし）が1つ。画像（層・閲覧用）も残っている
    expect(await saved(b)).toBe(1);
    expect(await idbGetAll(b, 'artworkBlobs')).not.toHaveLength(0);
  });

  test('引き下がった画面は、使っている窓が閉じられたら、自分で起動画面に戻る', async ({
    context,
    baseURL,
  }) => {
    await markTest(context);
    const url = appUrl(baseURL);
    const opener = await context.newPage();

    const a = await context.newPage();
    await a.goto(url);
    await expect(a.getByTestId('start-button')).toBeEnabled();
    await start(a);
    expect(await historyLength(a)).toBeGreaterThanOrEqual(2);

    const b = await popupApp(opener, url);
    await expect.poll(() => instanceOf(b)).toEqual({ role: 'primary', takeover: true });
    await expect(a.getByTestId('instance-retired')).toBeVisible({ timeout: 15_000 });

    // B を閉じる → 鍵が空く → A が始め直す（空きを 2 回続けて見るので、数秒かかる）
    await b.close();
    await expect(a.getByTestId('start-button')).toBeEnabled({ timeout: 20_000 });
    expect(await instanceOf(a)).toEqual({ role: 'primary', takeover: false });
    await expect(a).toHaveTitle(APP_TITLE);
    await expect(a.getByTestId('instance-retired')).toHaveCount(0);
    expect(new URL(a.url()).search).toBe('');
  });

  test('引き下がった画面で「戻る」を押しても、使っている窓を追い出さない', async ({
    context,
    baseURL,
  }) => {
    await markTest(context);
    const url = appUrl(baseURL);
    const opener = await context.newPage();

    const a = await context.newPage();
    await a.goto(url);
    await expect(a.getByTestId('start-button')).toBeEnabled();
    await start(a);

    const b = await popupApp(opener, url);
    await expect.poll(() => instanceOf(b)).toEqual({ role: 'primary', takeover: true });
    await expect(a.getByTestId('instance-retired')).toBeVisible({ timeout: 15_000 });

    // 「戻る」で、A は前の項目を読み込み直す。B が生きているので、A は引き下がったままになる
    await a.goBack();
    await expect(a.getByTestId('instance-retired')).toBeVisible({ timeout: 15_000 });
    expect(await instanceOf(a)).toEqual({ role: 'retired', takeover: false });
    await a.waitForTimeout(1500);
    expect(b.isClosed()).toBe(false);
    await expect(b.getByTestId('start-button')).toBeEnabled();
    expect(await instanceOf(b)).toEqual({ role: 'primary', takeover: true });
  });

  test('3つ続けて開いても、残るのは最後の1つだけ。前の2つは閉じる', async ({
    context,
    baseURL,
  }) => {
    await markTest(context);
    const url = appUrl(baseURL);
    const opener = await context.newPage();

    const a = await popupApp(opener, url);
    await expect(a.getByTestId('start-button')).toBeEnabled();
    // b が始まるのを待たずに、続けて c を開く（b が引き継ぎ待ちのあいだに c が来る）
    const b = await popupApp(opener, url);
    const c = await popupApp(opener, url);

    // 鍵を最後に奪った1つが残る（b と c のどちらが最後になるかは、起動の速さで決まる）。a と、残らなかった方は閉じる
    const pages = [a, b, c];
    await expect.poll(() => pages.filter((p) => !p.isClosed()).length, { timeout: 20_000 }).toBe(1);
    const survivor = pages.find((p) => !p.isClosed())!;
    expect(survivor).not.toBe(a);
    await expect(survivor.getByTestId('start-button')).toBeEnabled();
    expect(await instanceOf(survivor)).toEqual({ role: 'primary', takeover: true });
    await expect(survivor.getByTestId('instance-retired')).toHaveCount(0);
  });
});

test.describe('全画面（single-instance-design.md 2.4.3）', () => {
  test('最初の起動と読み込み直しでは「はじめる」で全画面にしない。引き継いだ画面は1回だけ全画面にする', async ({
    context,
    baseURL,
  }) => {
    await markTest(context);
    await context.addInitScript(SPY_FULLSCREEN);
    const url = appUrl(baseURL);

    // ふつうの起動: 呼ばない
    const first = await context.newPage();
    await first.goto(url);
    await expect(first.getByTestId('start-button')).toBeEnabled();
    expect(await instanceOf(first)).toEqual({ role: 'primary', takeover: false });
    await start(first);
    expect(await fullscreenCalls(first)).toBe(0);

    // 読み込み直し: 呼ばない
    await first.reload({ waitUntil: 'domcontentloaded' });
    await expect(first.getByTestId('start-button')).toBeEnabled();
    expect(await instanceOf(first)).toEqual({ role: 'primary', takeover: false });
    await start(first);
    expect(await fullscreenCalls(first)).toBe(0);
    await first.close();

    // 引き継いだ画面: 「はじめる」を押したときに1回だけ呼ぶ
    const opener = await context.newPage();
    const a = await popupApp(opener, url);
    await expect(a.getByTestId('start-button')).toBeEnabled();
    const b = await popupApp(opener, url);
    await expect.poll(() => instanceOf(b)).toEqual({ role: 'primary', takeover: true });
    await expect(b.getByTestId('start-button')).toBeEnabled();
    expect(await fullscreenCalls(b), '押す前').toBe(0);
    await b.getByTestId('start-button').click();
    await expect(b.getByTestId('home')).toBeVisible();
    expect(await fullscreenCalls(b)).toBe(1);
  });
});

test.describe('止める道（守りなしで今までどおり動く）', () => {
  test('navigator.locks が無い（Web Locks の無いブラウザ）: 2つ開いても、どちらも引き下がらない', async ({
    context,
    baseURL,
  }) => {
    await markTest(context);
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
    });
    const url = appUrl(baseURL);
    const a = await context.newPage();
    await a.goto(url);
    await expect(a.getByTestId('start-button')).toBeEnabled();
    const b = await context.newPage();
    await b.goto(url);
    await expect(b.getByTestId('start-button')).toBeEnabled();

    expect(await instanceOf(a)).toEqual({ role: 'unsupported', takeover: false });
    expect(await instanceOf(b)).toEqual({ role: 'unsupported', takeover: false });
    await a.waitForTimeout(2500);
    expect(a.isClosed() || b.isClosed()).toBe(false);
    await expect(a.getByTestId('start-button')).toBeVisible();
    await expect(b.getByTestId('start-button')).toBeVisible();
    await expect(a.getByTestId('instance-retired')).toHaveCount(0);
  });

  test('試験の旗 mnw:test:multiWindow を立てると、2つ開いても引き下がらない', async ({
    context,
    baseURL,
  }) => {
    await markTest(context);
    await allowMultiWindow(context);
    const url = appUrl(baseURL);
    const a = await context.newPage();
    await a.goto(url);
    await expect(a.getByTestId('start-button')).toBeEnabled();
    const b = await context.newPage();
    await b.goto(url);
    await expect(b.getByTestId('start-button')).toBeEnabled();

    expect(await instanceOf(a)).toEqual({ role: 'unsupported', takeover: false });
    expect(await instanceOf(b)).toEqual({ role: 'unsupported', takeover: false });
    await a.waitForTimeout(2500);
    expect(a.isClosed()).toBe(false);
    await expect(a.getByTestId('start-button')).toBeVisible();
    await expect(a.getByTestId('instance-retired')).toHaveCount(0);
  });

  test('page.reload() を5回続けても、毎回ふつうに始まる（引き継ぎにならない）', async ({
    context,
    baseURL,
  }) => {
    await markTest(context);
    const external = watchExternal(context);
    const page = await context.newPage();
    await page.goto(appUrl(baseURL));
    await expect(page.getByTestId('start-button')).toBeEnabled();
    for (let i = 0; i < 5; i++) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('start-button')).toBeEnabled();
      expect(await instanceOf(page), `${i + 1} 回目の読み込み直し`).toEqual({
        role: 'primary',
        takeover: false,
      });
    }
    await expect(page.getByTestId('instance-retired')).toHaveCount(0);
    expect(external, '外部ドメインへのリクエスト').toEqual([]);
  });
});

test.describe('?retired=1 の画面', () => {
  test('直接開いても、音・記録・Service Worker・教材の取得に触れない', async ({
    context,
    baseURL,
  }) => {
    await markTest(context);
    const page = await context.newPage();
    const requested: string[] = [];
    page.on('request', (r) => requested.push(new URL(r.url()).pathname));
    await page.goto(appUrl(baseURL, '?retired=1'));
    await expect(page.getByTestId('instance-retired')).toBeVisible();
    await expect(page).toHaveTitle(RETIRED_TITLE);
    expect(await instanceOf(page)).toEqual({ role: 'retired', takeover: false });
    // 画面を出したあと、動き出す仕事（登録・取得・保存）が無いことを待ってから確かめる
    await page.waitForTimeout(1500);
    const touched = await page.evaluate(async () => ({
      workers: (await navigator.serviceWorker.getRegistrations()).length,
      dbs: indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : null,
    }));
    expect(touched.workers).toBe(0);
    expect(touched.dbs ?? []).toEqual([]);
    expect(requested.filter((p) => /\/(packs|audio|__manabi)\//.test(p))).toEqual([]);
    // ［この まどで ひらく］は 44px 以上
    const reopen = page.getByTestId('instance-reopen');
    await expect(reopen).toHaveText('この まどで ひらく');
    expect((await reopen.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });
});

// ---------------------------------------------------------------- 見た目の検査

const SHOTS_DIR = process.env.MNW_SHOTS_DIR;
const SIZES: [number, number][] = [
  [1024, 600],
  [1280, 800],
  [1366, 768],
  [1920, 1080],
];

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS_DIR) return;
  await mkdir(SHOTS_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS_DIR, name) });
}

interface BoxOptions {
  /** 空白で区切った語（分かち書き）の途中で改行していないか。子供向けの文だけ */
  wakachi: boolean;
  /** 縦も画面の中に収まるか。false なら横だけ見る（スクロールする画面） */
  fitVertically: boolean;
}
interface BoxIssue {
  kind: string;
  where: string;
  detail: string;
}
interface BoxReport {
  issues: BoxIssue[];
  /** 行の分かれ方（確認用）。「要素: 行1 | 行2」 */
  lines: string[];
  /** 語の途中に見える改行（参考。失敗にはしない。漢字かな交じりの文は、語の切れ目を決めきれない） */
  softSplits: string[];
}

/**
 * root の中の文字・ボタン・図の箱を調べる（ページの中で動く。外の変数は使えない）。
 *  - 横スクロール: 文書・要素の scrollWidth が clientWidth を超える
 *  - 画面の外: 文字の行・ボタン・図が画面の左右（fitVertically なら上下も）の外に出る
 *  - 重なり: 文字の行・ボタン・図の箱どうしが重なる（ボタンの中の文字は、ボタンの箱の中に収まるかを見る）
 *  - 変な改行: 最後の行が1字だけ／行頭禁則・行末禁則／分かち書きの語の途中／英数字・カタカナ・「」の中の途中
 */
function inspectBoxes(root: Element, opt: BoxOptions): BoxReport {
  const issues: BoxIssue[] = [];
  const lineReport: string[] = [];
  const softSplits: string[] = [];
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const describe = (el: Element): string => {
    const id = el.getAttribute('data-testid');
    const cls =
      typeof (el as HTMLElement).className === 'string'
        ? (el as HTMLElement).className.split(/\s+/).filter(Boolean).slice(0, 2).join('.')
        : '';
    return `${el.tagName.toLowerCase()}${id ? `[${id}]` : cls ? `.${cls}` : ''}`;
  };
  const add = (kind: string, el: Element, detail: string): void => {
    issues.push({ kind, where: describe(el), detail });
  };
  const visible = (el: Element): boolean => {
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) !== 0;
  };

  // ---- (1) 横スクロール
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth)
    add('page-hscroll', de, `${de.scrollWidth} > ${de.clientWidth}`);
  if (document.body.scrollWidth > document.body.clientWidth)
    add(
      'page-hscroll',
      document.body,
      `${document.body.scrollWidth} > ${document.body.clientWidth}`,
    );
  for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
    if (!visible(el)) continue;
    const display = getComputedStyle(el).display;
    if (display === 'inline' || display === 'contents') continue;
    const h = el as HTMLElement;
    if (h.clientWidth > 0 && h.scrollWidth > h.clientWidth + 1)
      add('overflow-x', el, `scrollWidth ${h.scrollWidth} > clientWidth ${h.clientWidth}`);
  }

  // ---- (2) 文字の行
  const START_NG = new Set(Array.from('、。，．）」』】〕！？…'));
  const END_NG = new Set(Array.from('（「『【〔'));
  interface Line {
    text: string;
    left: number;
    right: number;
    top: number;
    bottom: number;
  }
  const blocks = new Map<Element, Text[]>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text;
    if (!t.data.trim()) continue;
    const parent = t.parentElement;
    if (!parent || !visible(parent)) continue;
    // 見えない読み上げ用の文字は見ない
    if (parent.closest('.visually-hidden, [aria-hidden="true"]')) continue;
    let block: Element = parent;
    while (block !== root && getComputedStyle(block).display === 'inline' && block.parentElement)
      block = block.parentElement;
    blocks.set(block, [...(blocks.get(block) ?? []), t]);
  }
  const boxes: {
    owner: Element;
    kind: 'line' | 'button' | 'media';
    rect: DOMRect | Line;
    label: string;
  }[] = [];
  const range = document.createRange();
  const segmenter =
    typeof Intl !== 'undefined' && 'Segmenter' in Intl
      ? new Intl.Segmenter('ja', { granularity: 'word' })
      : null;

  for (const [block, texts] of blocks) {
    const chars: { ch: string; rect: DOMRect | null; token: number }[] = [];
    let token = 0;
    for (const t of texts) {
      for (let i = 0; i < t.data.length; i++) {
        const ch = t.data[i]!;
        if (/\s/.test(ch)) {
          token++;
          chars.push({ ch, rect: null, token });
          continue;
        }
        range.setStart(t, i);
        range.setEnd(t, i + 1);
        const rs = range.getClientRects();
        chars.push({ ch, rect: rs.length > 0 ? rs[0]! : null, token });
      }
    }
    const lines: Line[] = [];
    const lineOf: number[] = [];
    chars.forEach((c, i) => {
      lineOf[i] = -1;
      const r = c.rect;
      if (!r || r.width === 0) return;
      const last = lines[lines.length - 1];
      if (last && Math.abs(r.top - last.top) < r.height * 0.5) {
        last.text += c.ch;
        last.left = Math.min(last.left, r.left);
        last.right = Math.max(last.right, r.right);
        last.bottom = Math.max(last.bottom, r.bottom);
      } else {
        lines.push({ text: c.ch, left: r.left, right: r.right, top: r.top, bottom: r.bottom });
      }
      lineOf[i] = lines.length - 1;
    });
    if (lines.length === 0) continue;
    lineReport.push(`${describe(block)}: ${lines.map((l) => l.text).join(' | ')}`);

    // 画面の外
    for (const l of lines) {
      const out =
        l.left < -0.5 ||
        l.right > vw + 0.5 ||
        (opt.fitVertically && (l.top < -0.5 || l.bottom > vh + 0.5));
      if (out)
        add(
          'out-of-view',
          block,
          `「${l.text}」 (${Math.round(l.left)},${Math.round(l.top)})-(${Math.round(l.right)},${Math.round(l.bottom)}) viewport ${vw}x${vh}`,
        );
    }
    // 最後の行が1字だけ
    // （句読点・閉じ括弧を除いて数える。「す。」のような行も1字として扱う）
    if (
      lines.length >= 2 &&
      lines[lines.length - 1]!.text.replace(/[、。，．）」』】〕！？…]/g, '').length <= 1
    )
      add(
        'orphan',
        block,
        `最後の行が1字: 「${lines[lines.length - 2]!.text}」→「${lines[lines.length - 1]!.text}」`,
      );
    // 行頭禁則・行末禁則
    lines.forEach((l, i) => {
      if (i > 0 && START_NG.has(l.text[0]!))
        add('kinsoku-start', block, `行頭に「${l.text[0]}」: 「${l.text}」`);
      if (i < lines.length - 1 && END_NG.has(l.text[l.text.length - 1]!))
        add('kinsoku-end', block, `行末に「${l.text[l.text.length - 1]}」: 「${l.text}」`);
    });
    // 分かち書き（空白で区切った語）の途中の改行
    if (opt.wakachi) {
      const spans = new Map<number, Set<number>>();
      chars.forEach((c, i) => {
        if (lineOf[i]! < 0) return;
        const set = spans.get(c.token) ?? new Set<number>();
        set.add(lineOf[i]!);
        spans.set(c.token, set);
      });
      for (const [tk, set] of spans) {
        if (set.size > 1) {
          const word = chars
            .filter((c) => c.token === tk)
            .map((c) => c.ch)
            .join('');
          add('wakachi-split', block, `語の途中で改行: 「${word}」`);
        }
      }
    }
    // 英数字・カタカナ・「」の途中の改行
    const all = chars.map((c) => c.ch).join('');
    const hard = [/[A-Za-z0-9]+/g, /[ァ-ヶー]{2,}/g, /「[^」]*」/g];
    for (const re of hard) {
      for (const m of all.matchAll(re)) {
        const s = m.index!;
        const e = s + m[0].length;
        const set = new Set<number>();
        for (let i = s; i < e; i++) if (lineOf[i]! >= 0) set.add(lineOf[i]!);
        if (set.size > 1) add('token-split', block, `途中で改行: 「${m[0]}」`);
      }
    }
    // 参考: 日本語の語（Intl.Segmenter）の途中の改行
    if (segmenter) {
      for (const seg of segmenter.segment(all)) {
        const s = seg.index;
        const e = s + seg.segment.length;
        if (!seg.isWordLike || seg.segment.length < 2) continue;
        const set = new Set<number>();
        for (let i = s; i < e; i++) if (lineOf[i]! >= 0) set.add(lineOf[i]!);
        if (set.size > 1) softSplits.push(`${describe(block)}: 「${seg.segment}」`);
      }
    }
    // 箱に足す（ボタンの中の文字は、ボタンの箱で見る）
    const inButton = block.closest('button, [role="button"]');
    if (inButton) {
      const br = inButton.getBoundingClientRect();
      for (const l of lines) {
        if (
          l.left < br.left - 1 ||
          l.right > br.right + 1 ||
          l.top < br.top - 1 ||
          l.bottom > br.bottom + 1
        )
          add(
            'text-outside-button',
            inButton,
            `「${l.text}」が箱の外: 文字 (${Math.round(l.left)},${Math.round(l.top)})-(${Math.round(l.right)},${Math.round(l.bottom)}) 箱 (${Math.round(br.left)},${Math.round(br.top)})-(${Math.round(br.right)},${Math.round(br.bottom)})`,
          );
      }
    } else {
      for (const l of lines)
        boxes.push({ owner: block, kind: 'line', rect: l, label: `「${l.text.slice(0, 12)}」` });
    }
  }

  // ---- (3) ボタン・図の箱
  for (const el of Array.from(root.querySelectorAll('button, [role="button"], svg, img'))) {
    if (!visible(el)) continue;
    if (el.tagName.toLowerCase() === 'svg' && el.closest('button, [role="button"]')) continue;
    if (el.parentElement?.closest('svg')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const isButton = el.matches('button, [role="button"]');
    boxes.push({ owner: el, kind: isButton ? 'button' : 'media', rect: r, label: describe(el) });
    const out =
      r.left < -0.5 ||
      r.right > vw + 0.5 ||
      (opt.fitVertically && (r.top < -0.5 || r.bottom > vh + 0.5));
    if (out)
      add(
        'out-of-view',
        el,
        `${isButton ? 'ボタン' : '図'} (${Math.round(r.left)},${Math.round(r.top)})-(${Math.round(r.right)},${Math.round(r.bottom)}) viewport ${vw}x${vh}`,
      );
  }
  // 重なり
  const edges = (b: { rect: DOMRect | Line }) => {
    const r = b.rect;
    return { l: r.left, t: r.top, r: r.right, b: r.bottom };
  };
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const p = boxes[i]!;
      const q = boxes[j]!;
      if (p.owner === q.owner || p.owner.contains(q.owner) || q.owner.contains(p.owner)) continue;
      const a = edges(p);
      const c = edges(q);
      const w = Math.min(a.r, c.r) - Math.max(a.l, c.l);
      const h = Math.min(a.b, c.b) - Math.max(a.t, c.t);
      if (w > 1 && h > 1)
        add(
          'overlap',
          p.owner,
          `${p.label} と ${q.label} が重なる (${Math.round(w)}x${Math.round(h)}px)`,
        );
    }
  }
  return { issues, lines: lineReport, softSplits };
}

const SHOW = (r: BoxReport): string => JSON.stringify(r, null, 1);

test.describe('新しい画面の見た目（4つの大きさ）', () => {
  test('「べつの まどで ひらいています」の画面: 重なり・はみ出し・変な改行・横スクロールが無い', async ({
    page,
    browserName,
    baseURL,
  }, testInfo) => {
    await markTest(page.context());
    await page.goto(appUrl(baseURL, '?retired=1'));
    const screen = page.getByTestId('instance-retired');
    await expect(screen).toBeVisible();
    const softAll: string[] = [];
    for (const [w, h] of SIZES) {
      await page.setViewportSize({ width: w, height: h });
      await expect(screen).toBeVisible();
      const label = `${w}x${h}`;

      // 箱・横スクロール・行の分かれ方
      const report = await screen.evaluate(inspectBoxes, { wakachi: true, fitVertically: true });
      expect(report.issues, `${label}\n${SHOW(report)}`).toEqual([]);
      // 文字が表示されている（行が取れている）
      expect(report.lines.length, label).toBeGreaterThanOrEqual(3);
      softAll.push(...report.softSplits.map((s) => `${label} ${s}`));
      // ［この まどで ひらく］は 44px 以上
      expect(
        (await page.getByTestId('instance-reopen').boundingBox())!.height,
        label,
      ).toBeGreaterThanOrEqual(44);

      // このプロジェクトの文字の配置の検査（子供画面。分かち書きの語の途中・最後の行が1字・禁則・舞台の外・重なり）。
      // 保護者向けの小さな字（案内・ボタン）が補助の文字の最小より小さいのは、DESINGN.md 10章の意図どおりなので数えない
      const text = await inspectText(page, { stage: 'p4' });
      const issues = text.issues.filter(
        (i) => !(i.kind === 'small-text' && /retired__(note|reopen)/.test(i.where)),
      );
      expect(issues, `${label} inspectText\n${JSON.stringify(issues, null, 1)}`).toEqual([]);
      await shot(page, `retired-${browserName}-${label}.png`);
    }
    if (softAll.length > 0)
      testInfo.annotations.push({
        type: '参考（語の途中の改行）',
        description: softAll.join('\n'),
      });
  });

  test('保護者画面「せってい」の全画面の節（3つの状態）: 重なり・はみ出し・変な改行・横スクロールが無い', async ({
    page,
    browserName,
  }, testInfo) => {
    // 窓の大きさで 'window'（ブラウザの全画面）になる判定を確かめやすいよう、画面の大きさは状態ごとに作り直す
    await boot(page);
    await openParent(page, 'settings');
    const section = page.locator('section.p-section', {
      has: page.locator('[data-testid="fullscreen-toggle"], [data-testid="fullscreen-window"]'),
    });
    await expect(section).toHaveCount(1);
    await expect(section.locator('h2')).toHaveText('画面');

    const setState = (state: 'none' | 'window' | 'page') =>
      page.evaluate((s) => {
        const define = (o: object, k: string, get: () => unknown) =>
          Object.defineProperty(o, k, { configurable: true, get });
        define(document, 'fullscreenElement', () =>
          s === 'page' ? document.documentElement : null,
        );
        // 'window': 窓の大きさが画面と同じ（F11 の全画面）／ 'none': 画面のほうが大きい
        define(screen, 'width', () =>
          s === 'window' ? window.innerWidth : window.innerWidth + 300,
        );
        define(screen, 'height', () =>
          s === 'window' ? window.innerHeight : window.innerHeight + 300,
        );
        document.dispatchEvent(new Event('fullscreenchange'));
        window.dispatchEvent(new Event('resize'));
      }, state);

    const softAll: string[] = [];
    for (const [w, h] of SIZES) {
      await page.setViewportSize({ width: w, height: h });
      for (const state of ['none', 'window', 'page'] as const) {
        const label = `${state} ${w}x${h}`;
        await setState(state);
        if (state === 'window') {
          await expect(page.getByTestId('fullscreen-window'), label).toBeVisible();
          await expect(page.getByTestId('fullscreen-toggle'), label).toHaveCount(0);
        } else {
          await expect(page.getByTestId('fullscreen-toggle'), label).toHaveText(
            state === 'page' ? '全画面をやめる' : '全画面にする',
          );
        }
        await section.scrollIntoViewIfNeeded();
        const report = await section.evaluate(inspectBoxes, {
          wakachi: false,
          fitVertically: false,
        });
        expect.soft(report.issues, `${label}\n${SHOW(report)}`).toEqual([]);
        expect(report.lines.length, label).toBeGreaterThanOrEqual(2);
        softAll.push(...report.softSplits.map((s) => `${label} ${s}`));
        await shot(page, `settings-fullscreen-${state}-${browserName}-${w}x${h}.png`);
      }
    }
    if (softAll.length > 0)
      testInfo.annotations.push({
        type: '参考（語の途中の改行）',
        description: softAll.join('\n'),
      });
  });
});
