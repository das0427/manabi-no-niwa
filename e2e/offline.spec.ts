import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium, expect, firefox, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { CSP } from '../scripts/vite-plugin-precache.ts';
import type { OfflineState } from '../src/core/offline/index';
import { prepareDist } from './helpers/dist';
import type { PreparedDist } from './helpers/dist';
import { getFreePort, startServe } from './helpers/serve';
import type { ServeHandle } from './helpers/serve';

/**
 * オフライン・更新の E2E（E-10, E-11, E-13, E-19、OF-03〜06）。
 * serve.py で dist のコピーを配信し、Service Worker の準備完了後に **serve.py を停止**して検証する
 * （setOffline だけに頼らない: design-review #32）。
 * アプリ本体の main.tsx に依存しないよう、src/core/offline を差し込んだハーネス（window.__mnwOffline）で登録する。
 */

type Harness = {
  getOfflineState(): OfflineState;
  applyUpdate(): Promise<void>;
  isPageControlled(): boolean;
};
type HarnessWindow = Window & { __mnwOffline: Harness };

const APP_TITLE = 'まなびのにわ';

/** アプリが開いた: index.html（タイトル）が読み込まれ、React の画面が #root に描かれている（画面の文言には依存しない） */
async function expectAppOpens(page: Page): Promise<void> {
  await expect(page).toHaveTitle(APP_TITLE);
  await expect(page.locator('#root > *').first()).toBeAttached();
}

const getState = (page: Page): Promise<OfflineState> =>
  page.evaluate(() => (window as unknown as HarnessWindow).__mnwOffline.getOfflineState());

/** ページ遷移の最中は null を返す（expect.poll 用） */
const safeState = async (page: Page): Promise<OfflineState | null> => {
  try {
    return await getState(page);
  } catch {
    return null;
  }
};

const waitReady = async (page: Page): Promise<void> => {
  await page.waitForFunction(
    () => (window as unknown as HarnessWindow).__mnwOffline?.getOfflineState().status === 'ready',
    null,
    { timeout: 30_000 },
  );
};

const isControlled = (page: Page): Promise<boolean> =>
  page.evaluate(() => navigator.serviceWorker.controller !== null);

const cacheNames = (page: Page): Promise<string[]> =>
  page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('mnw-')).sort());

/** 内容付きで取得（ステータスと本文） */
const fetchText = (page: Page, url: string): Promise<{ status: number; text: string }> =>
  page.evaluate(async (u) => {
    const res = await fetch(u, { cache: 'no-store' });
    return { status: res.status, text: await res.text() };
  }, url);

const idbPut = (page: Page, key: string, value: string): Promise<void> =>
  page.evaluate(
    ([k, v]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('mnw-e2e', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('s');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('s', 'readwrite');
          tx.objectStore('s').put(v, k);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    [key, value] as const,
  );

const idbGet = (page: Page, key: string): Promise<string | null> =>
  page.evaluate(
    (k) =>
      new Promise<string | null>((resolve, reject) => {
        const open = indexedDB.open('mnw-e2e', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction('s').objectStore('s').get(k);
          req.onsuccess = () => {
            open.result.close();
            resolve((req.result as string | undefined) ?? null);
          };
          req.onerror = () => reject(req.error);
        };
      }),
    key,
  );

/**
 * 更新の確認を促し、条件が満たされるまで繰り返す。
 * ブラウザが読み込み直後に行う更新確認と重なると、reg.update() が先の確認にまとめられて新しい sw.js を見ないことがあるため、
 * 何度か呼ぶ（実運用でも更新確認は繰り返し行われる）。
 */
async function updateUntil<T>(
  page: Page,
  read: (s: OfflineState) => T,
  expected: T,
  timeout = 30_000,
): Promise<void> {
  await expect
    .poll(
      async () => {
        await page
          .evaluate(async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            await reg?.update();
          })
          .catch(() => undefined);
        const s = await safeState(page);
        return s === null ? null : read(s);
      },
      { timeout, intervals: [300, 500, 1000] },
    )
    .toEqual(expected);
}

/** 更新を適用し（SKIP_WAITING → controllerchange → 再読み込み）、新しいページが読み込まれるまで待つ */
async function applyAndWaitReload(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __beforeReload: number }).__beforeReload = 1;
    void (window as unknown as HarnessWindow).__mnwOffline.applyUpdate();
  });
  await expect
    .poll(
      async () => {
        try {
          return await page.evaluate(
            () => (window as unknown as { __beforeReload?: number }).__beforeReload === undefined,
          );
        } catch {
          return false;
        }
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  await waitReady(page);
}

/** 127.0.0.1 以外へのリクエストを集める（E-13 / BC-03） */
function watchExternal(context: BrowserContext): string[] {
  const external: string[] = [];
  context.on('request', (req) => {
    const u = new URL(req.url());
    if (u.protocol === 'data:' || u.protocol === 'blob:' || u.protocol === 'about:') return;
    if (u.hostname !== '127.0.0.1') external.push(req.url());
  });
  return external;
}

const cleanups: (() => Promise<void>)[] = [];
test.afterEach(async () => {
  for (const fn of cleanups.splice(0).reverse()) await fn().catch(() => undefined);
});

async function dist(options: Parameters<typeof prepareDist>[0] = {}): Promise<PreparedDist> {
  const d = await prepareDist(options);
  cleanups.push(() => d.cleanup());
  return d;
}

async function serve(d: PreparedDist, port?: number): Promise<ServeHandle> {
  const s = await startServe(d.dir, { port });
  cleanups.push(() => s.stop());
  return s;
}

test.describe('オフライン再起動（E-10 / E-13 / OF-03）', () => {
  test('準備完了 → 配信を停止 → 再読み込み・新しいタブで開ける。外部通信なし', async ({
    context,
    page,
  }) => {
    const external = watchExternal(context);
    const d = await dist();
    const server = await serve(d);

    await page.goto(server.url);
    await expectAppOpens(page);
    await waitReady(page);

    // 準備の内容: この版のキャッシュに全ファイルと完成の記録が入っている
    const state = await getState(page);
    expect(state).toMatchObject({
      supported: true,
      status: 'ready',
      updateReady: false,
      error: null,
      version: d.version,
    });
    expect(await cacheNames(page)).toEqual([`mnw-${d.version}`]);
    const entries = await page.evaluate(
      async (name) => (await (await caches.open(name)).keys()).length,
      `mnw-${d.version}`,
    );
    expect(entries).toBe(d.fileCount + 1);

    // 初回訪問では、SW はまだこのページを制御していない（clients.claim を使わない）
    expect(await isControlled(page)).toBe(false);
    expect(
      await page.evaluate(() =>
        (window as unknown as HarnessWindow).__mnwOffline.isPageControlled(),
      ),
    ).toBe(false);

    await page.reload();
    await expect.poll(() => isControlled(page)).toBe(true);
    await waitReady(page);
    expect((await getState(page)).version).toBe(d.version);

    // ---- 配信サーバーを止める ----
    await server.stop();
    await expect(fetchText(page, '/__manabi/health')).rejects.toThrow();

    await page.reload();
    await expectAppOpens(page);
    expect(await isControlled(page)).toBe(true);

    // フォント・アイコン・manifest などもオフラインで取得できる
    for (const u of [
      'fonts/klee-one-400.woff2',
      'icons/icon-192.png',
      'manifest.webmanifest',
      'icons/icon.svg',
    ]) {
      const r = await page.evaluate(async (p) => (await fetch(p)).status, u);
      expect(r, u).toBe(200);
    }

    // 新しいタブ（= 起動し直し）でも開ける。ハッシュ付きのルートでも index.html が返る
    const tab2 = await context.newPage();
    await tab2.goto(`${server.url}#/home`);
    await expectAppOpens(tab2);
    await tab2.goto(`${server.url}?seed=1#/play/shopping`);
    await expectAppOpens(tab2);

    expect(external, '外部ドメインへのリクエスト').toEqual([]);
  });

  test('ブラウザを閉じて開き直しても（プロファイルが同じなら）オフラインで開ける', async ({
    browserName,
  }) => {
    const d = await dist();
    const server = await serve(d);
    const userDir = await mkdtemp(path.join(os.tmpdir(), 'mnw-profile-'));
    cleanups.push(() => rm(userDir, { recursive: true, force: true }));
    const type = browserName === 'firefox' ? firefox : chromium;

    // 1回目の起動: 準備して閉じる
    const launchOptions =
      browserName === 'firefox'
        ? { executablePath: process.env.MNW_FIREFOX_PATH || undefined }
        : {};
    let ctx = await type.launchPersistentContext(userDir, launchOptions);
    let page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto(server.url);
    await waitReady(page);
    await page.reload();
    await expect.poll(() => isControlled(page)).toBe(true);
    await idbPut(page, 'child', 'さくひん');
    await ctx.close();

    // 配信を止めてから、同じプロファイルで起動し直す
    await server.stop();
    ctx = await type.launchPersistentContext(userDir, launchOptions);
    try {
      page = ctx.pages()[0] ?? (await ctx.newPage());
      await page.goto(server.url);
      await expectAppOpens(page);
      expect(await isControlled(page)).toBe(true);
      expect(await idbGet(page, 'child')).toBe('さくひん');
    } finally {
      await ctx.close();
    }
  });
});

test.describe('更新（E-11 / E-19 / OF-04〜06）', () => {
  test('旧版は動いたまま新版を準備 → 適用で切り替え。データは残り、旧タブは直前の版の部品を使える', async ({
    context,
  }) => {
    const external = watchExternal(context);
    const port = await getFreePort();
    // v1 にだけある部品（旧タブが後から遅延読み込みするもの）、v2 / v3 にだけある部品
    const v1 = await dist({ addFiles: { 'lazy-v1-only.js': 'window.__lazy = "v1";' }, tag: 'v1' });
    const v2 = await dist({ addFiles: { 'only-v2.js': 'window.__only = "v2";' }, tag: 'v2' });
    const v3 = await dist({ addFiles: { 'only-v3.js': 'window.__only = "v3";' }, tag: 'v3' });
    expect(new Set([v1.version, v2.version, v3.version]).size).toBe(3);

    let server = await serve(v1, port);

    // ---- 旧タブ A（v1）----
    const tabA = await context.newPage();
    await tabA.goto(server.url);
    await waitReady(tabA);
    await tabA.reload();
    await expect.poll(() => isControlled(tabA)).toBe(true);
    await waitReady(tabA);
    expect((await getState(tabA)).version).toBe(v1.version);
    await tabA.evaluate(() => ((window as unknown as { __marker: number }).__marker = 1));
    await idbPut(tabA, 'record', 'v1で書いた記録');

    // ---- 新版 v2 を配信 → 裏で準備される（学習中の画面は動いたまま）----
    await server.stop();
    server = await serve(v2, port);
    await updateUntil(tabA, (s) => s.updateReady, true);

    const prepared = await getState(tabA);
    expect(prepared).toMatchObject({
      status: 'ready',
      version: v1.version,
      error: null,
      progress: null,
    });
    expect(await cacheNames(tabA)).toEqual([`mnw-${v1.version}`, `mnw-${v2.version}`].sort());
    // 画面は切り替わっていない（再読み込みされていない）
    expect(await tabA.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(
      1,
    );
    expect(await isControlled(tabA)).toBe(true);

    // ---- 別タブ B で適用する ----
    const tabB = await context.newPage();
    await tabB.goto(server.url);
    await expect.poll(async () => (await safeState(tabB))?.updateReady).toBe(true);
    await applyAndWaitReload(tabB);

    await expect
      .poll(async () => (await safeState(tabB))?.version, { timeout: 30_000 })
      .toBe(v2.version);
    await expectAppOpens(tabB);
    expect(await safeState(tabB)).toMatchObject({ status: 'ready', updateReady: false });

    // 学習データ（IndexedDB）は残っている（OF-06）
    expect(await idbGet(tabB, 'record')).toBe('v1で書いた記録');

    // E-19: 旧タブ A（v1 の画面）が、v2 に無い v1 の部品を後から読み込める（直前の版のキャッシュ）
    const lazy = await fetchText(tabA, './lazy-v1-only.js');
    expect(lazy.status).toBe(200);
    expect(lazy.text).toContain('v1');
    // v2 の部品も取れる。どちらにも無いものはネットワーク（404）
    expect(await fetchText(tabA, './only-v2.js')).toMatchObject({ status: 200 });
    expect((await fetchText(tabA, './nothing-here.js')).status).toBe(404);
    // 旧タブは再読み込みされていない
    expect(await tabA.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(
      1,
    );
    // 現在と直前の版の 2 つが残る
    expect(await cacheNames(tabB)).toEqual([`mnw-${v1.version}`, `mnw-${v2.version}`].sort());

    // ---- さらに v3 へ: v1 は消え、v2 と v3 が残る ----
    await server.stop();
    server = await serve(v3, port);
    await updateUntil(tabB, (s) => s.updateReady, true);
    await applyAndWaitReload(tabB);

    await expect
      .poll(async () => (await safeState(tabB))?.version, { timeout: 30_000 })
      .toBe(v3.version);
    await expect
      .poll(() => cacheNames(tabB))
      .toEqual([`mnw-${v2.version}`, `mnw-${v3.version}`].sort());
    expect(await idbGet(tabB, 'record')).toBe('v1で書いた記録');
    // v2 の画面だった旧タブにとって、v2 の部品は直前の版にある。v1 の部品はもう無い
    expect((await fetchText(tabA, './only-v2.js')).status).toBe(200);
    expect((await fetchText(tabA, './lazy-v1-only.js')).status).toBe(404);

    // 配信を止めても、新版（v3）でオフライン起動できる
    await server.stop();
    await tabB.reload();
    await expectAppOpens(tabB);
    expect((await getState(tabB)).version).toBe(v3.version);

    expect(external, '外部ドメインへのリクエスト').toEqual([]);
  });

  test('新版の準備に失敗しても（1ファイル取得不可）、現在の版のまま使え、中途半端な版が残らない', async ({
    context,
  }) => {
    const port = await getFreePort();
    const v1 = await dist({ tag: 'v1' });
    // 一覧には fonts/klee-one-400.woff2 があるのに配信できない版
    const broken = await dist({ tag: 'broken', breakFiles: ['fonts/klee-one-400.woff2'] });
    expect(broken.version).not.toBe(v1.version);

    let server = await serve(v1, port);
    const page = await context.newPage();
    await page.goto(server.url);
    await waitReady(page);
    await page.reload();
    await expect.poll(() => isControlled(page)).toBe(true);

    await server.stop();
    server = await serve(broken, port);
    await updateUntil(page, (s) => s.error !== null, true);

    const state = await getState(page);
    expect(state).toMatchObject({ status: 'ready', updateReady: false, version: v1.version });
    await expect.poll(() => cacheNames(page)).toEqual([`mnw-${v1.version}`]);

    // 現在の版でオフライン起動できる
    await server.stop();
    await page.reload();
    await expectAppOpens(page);
    expect((await getState(page)).version).toBe(v1.version);
  });
});

test.describe('manifest・CSP・アイコン（OF-01 / BC-03 / 実装メモ）', () => {
  test('本番ビルドの index.html に CSP があり、違反なく表示できる。manifest とアイコンが取得できる', async ({
    page,
    request,
  }) => {
    const violations: string[] = [];
    const external: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (!['data:', 'blob:', 'about:'].includes(u.protocol) && u.hostname !== '127.0.0.1')
        external.push(r.url());
    });
    page.on('console', (m) => {
      if (/content security policy/i.test(m.text())) violations.push(m.text());
    });
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => {
        console.error(`Content Security Policy violation: ${e.violatedDirective} ${e.blockedURI}`);
      });
    });
    await page.goto('/');
    await expectAppOpens(page);

    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    expect(csp).toBe(CSP);
    expect(csp).toContain("default-src 'self'");
    expect(violations).toEqual([]);
    expect(external).toEqual([]);

    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifestUrl = new URL(href ?? '', page.url()).href;
    const manifest = (await (await request.get(manifestUrl)).json()) as {
      name: string;
      short_name: string;
      lang: string;
      start_url: string;
      scope: string;
      display: string;
      background_color: string;
      theme_color: string;
      icons: { src: string; sizes: string; type: string; purpose?: string }[];
    };
    expect(manifest).toMatchObject({
      name: 'まなびのにわ',
      short_name: 'まなび',
      lang: 'ja',
      start_url: './',
      scope: './',
      display: 'standalone',
      background_color: '#fbf5e9',
      theme_color: '#fbf5e9',
    });
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
    for (const icon of manifest.icons) {
      const res = await request.get(new URL(icon.src, manifestUrl).href);
      expect(res.status(), icon.src).toBe(200);
      if (icon.type === 'image/png') {
        const buf = await res.body();
        const [w, h] = icon.sizes.split('x').map(Number);
        expect(buf.readUInt32BE(16), `${icon.src} width`).toBe(w);
        expect(buf.readUInt32BE(20), `${icon.src} height`).toBe(h);
      }
    }
  });
});
