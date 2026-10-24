import { rmSync } from 'node:fs';
import { appendFile, cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { build } from 'vite';
import { finalizeDist } from '../scripts/vite-plugin-precache.ts';
import type { PackIndex } from '../scripts/vite-plugin-precache.ts';
import { openParent, start } from './helpers/app';
import { getFreePort, startServe } from './helpers/serve';
import type { ServeHandle } from './helpers/serve';

/**
 * 教材パックの分離・取得・版の整合の E2E（docs/expansion/architecture.md 6章、design-review-1 #4 #5 #20 #26）。
 *
 * 見本パック入りのビルド（VITE_MNW_SAMPLE_PACKS=1）をワーカーごとに 1 回作り、そのコピーを serve.py で配信する。
 *  - _sample-a: 小学生扱い。音声 audio/_sample-a/*.mp3、共有データ _data/strokes/kanji-g1.json
 *  - _sample-b: 小学生扱い。共有データ（A と同じ）
 *  - _sample-core: コア同梱（幼児のパックと同じ扱い）
 * 見本パック入りのビルドだけが window.__mnwPacks（src/packs/loader.ts の公開 API）を出す。
 * オフラインは serve.py を止めて再現する（setOffline だけに頼らない）。
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const A = '_sample-a';
const B = '_sample-b';
const CORE = '_sample-core';

type Failure = { name: string; reason?: string; message: string };
type Loaded =
  { ok: true; unitIds: string[]; units: Record<string, unknown> } | { ok: false; error: Failure };
type Status = {
  packId: string;
  state: string;
  hash: string | null;
  downloaded: { hash: string } | null;
};
type PacksApi = {
  loadPack(id: string): Promise<{ units: Record<string, unknown> }>;
  packStatus(id: string): Promise<Status>;
  listPackStatus(): Promise<Status[]>;
  downloadPack(id: string, onProgress?: (p: Record<string, number>) => void): Promise<void>;
  redownloadOutdated(): Promise<{ packId: string; reason: string }[]>;
  deletePack(id: string): Promise<void>;
};
type PacksWindow = Window & { __mnwPacks?: PacksApi };

// ---------------------------------------------------------------- ビルドと配信

let builtPromise: Promise<string> | null = null;

/** 見本パック入りのビルド（ワーカーごとに 1 回） */
function buildSampleDist(): Promise<string> {
  builtPromise ??= (async () => {
    const outDir = await mkdtemp(path.join(os.tmpdir(), 'mnw-packs-build-'));
    const prev = process.env.VITE_MNW_SAMPLE_PACKS;
    process.env.VITE_MNW_SAMPLE_PACKS = '1';
    try {
      await build({
        root: ROOT,
        configFile: path.join(ROOT, 'vite.config.ts'),
        logLevel: 'silent',
        build: { outDir, emptyOutDir: true },
      });
    } finally {
      if (prev === undefined) delete process.env.VITE_MNW_SAMPLE_PACKS;
      else process.env.VITE_MNW_SAMPLE_PACKS = prev;
    }
    process.once('exit', () => rmSync(outDir, { recursive: true, force: true }));
    return outDir;
  })();
  return builtPromise;
}

interface Dist {
  dir: string;
  version: string;
  index: PackIndex;
}

const cleanups: (() => Promise<void>)[] = [];
test.afterEach(async () => {
  for (const fn of cleanups.splice(0).reverse()) await fn().catch(() => undefined);
});

/**
 * ビルドのコピーを作る。tag で index.html を変え（コアの版を変える）、changeA で見本パック A の
 * チャンクの内容を変える（パックの版を変える）。breakA は sw.js などを作った後に A の音声を消す（取得の失敗の再現）。
 */
async function makeDist(
  opts: { tag?: string; changeA?: boolean; breakA?: boolean } = {},
): Promise<Dist> {
  const src = await buildSampleDist();
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mnw-packs-dist-'));
  cleanups.push(() => rm(dir, { recursive: true, force: true }));
  await cp(src, dir, { recursive: true });
  if (opts.tag) await appendFile(path.join(dir, 'index.html'), `<!-- ${opts.tag} -->\n`);
  const before = JSON.parse(await readFile(path.join(src, 'packs.json'), 'utf8')) as PackIndex;
  if (opts.changeA) {
    const chunk = before[A]!.files.find((f) => f.startsWith(`assets/packs/${A}/`))!;
    await appendFile(path.join(dir, chunk), '\n/* mnw-e2e-v2 */\n');
  }
  const info = await finalizeDist(dir);
  if (opts.breakA) await rm(path.join(dir, 'audio', A, 'hello.mp3'), { force: true });
  const index = JSON.parse(await readFile(path.join(dir, 'packs.json'), 'utf8')) as PackIndex;
  return { dir, version: info.version, index };
}

async function serve(d: Dist, port?: number): Promise<ServeHandle> {
  const s = await startServe(d.dir, { port });
  cleanups.push(() => s.stop());
  return s;
}

// ---------------------------------------------------------------- ページの操作

const isControlled = (page: Page): Promise<boolean> =>
  page.evaluate(() => navigator.serviceWorker.controller !== null);

/** 初回: SW の install（コアの準備）を待ち、再読み込みで制御下に入れる */
async function openPrepared(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect
    .poll(
      () =>
        page
          .evaluate(async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            return reg?.active?.state === 'activated';
          })
          .catch(() => false),
      { timeout: 60_000 },
    )
    .toBe(true);
  await page.reload();
  await expect.poll(() => isControlled(page)).toBe(true);
  await waitApi(page);
}

async function waitApi(page: Page): Promise<void> {
  await page.waitForFunction(() => !!(window as PacksWindow).__mnwPacks, null, { timeout: 30_000 });
}

function load(page: Page, id: string): Promise<Loaded> {
  return page.evaluate(async (packId) => {
    try {
      const c = await (window as PacksWindow).__mnwPacks!.loadPack(packId);
      return { ok: true as const, unitIds: Object.keys(c.units).sort(), units: c.units };
    } catch (e) {
      const err = e as { name?: string; reason?: string; message?: string };
      return {
        ok: false as const,
        error: { name: String(err.name), reason: err.reason, message: String(err.message) },
      };
    }
  }, id);
}

function stateOf(page: Page, id: string): Promise<string> {
  return page.evaluate(
    async (packId) => (await (window as PacksWindow).__mnwPacks!.packStatus(packId)).state,
    id,
  );
}

function download(
  page: Page,
  id: string,
): Promise<{ ok: boolean; reason?: string; last?: Record<string, number> }> {
  return page.evaluate(async (packId) => {
    let last: Record<string, number> | undefined;
    try {
      await (window as PacksWindow).__mnwPacks!.downloadPack(packId, (p) => (last = { ...p }));
      return { ok: true, last };
    } catch (e) {
      return { ok: false, reason: (e as { reason?: string }).reason };
    }
  }, id);
}

const allCaches = (page: Page): Promise<string[]> =>
  page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('mnw-')).sort());

const packCaches = async (page: Page): Promise<string[]> =>
  (await allCaches(page)).filter((k) => k.startsWith('mnw-pack/'));

const coreCaches = async (page: Page): Promise<string[]> =>
  (await allCaches(page)).filter((k) => !k.startsWith('mnw-pack/'));

const fetchStatus = (page: Page, url: string): Promise<number> =>
  page.evaluate(async (u) => {
    try {
      return (await fetch(u)).status;
    } catch {
      return -1;
    }
  }, url);

function idb<T>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(
    (s) =>
      new Promise<T[]>((resolve, reject) => {
        const open = indexedDB.open('manabi-no-niwa');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction(s, 'readonly').objectStore(s).getAll();
          req.onsuccess = () => {
            db.close();
            resolve(req.result as T[]);
          };
          req.onerror = () => reject(req.error);
        };
      }),
    store,
  );
}

function idbPut(page: Page, store: string, value: Record<string, unknown>): Promise<void> {
  return page.evaluate(
    ([s, v]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('manabi-no-niwa');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(s as string, 'readwrite');
          tx.objectStore(s as string).put(v);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    [store, value] as const,
  );
}

/** 新しい版の SW を待って適用し、再読み込みする（AboutTab の「更新する」と同じ手順） */
async function updateAndReload(page: Page, version: string): Promise<void> {
  await expect
    .poll(
      async () =>
        page
          .evaluate(async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            await reg?.update().catch(() => undefined);
            return reg?.waiting?.state === 'installed';
          })
          .catch(() => false),
      { timeout: 60_000, intervals: [500, 1000] },
    )
    .toBe(true);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        void navigator.serviceWorker.getRegistration().then((reg) => {
          const waiting = reg?.waiting;
          if (!waiting) return resolve();
          navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
            once: true,
          });
          waiting.postMessage({ type: 'SKIP_WAITING' });
        });
      }),
  );
  await page.reload();
  await waitApi(page);
  await expect.poll(() => coreCaches(page)).toContain(`mnw-${version}`);
}

// ---------------------------------------------------------------- テスト

test.describe('教材パック（見本パック）', () => {
  test.describe.configure({ timeout: 180_000 });

  test('(1)(2)(6) 取得したパックはオフラインで読める。未取得は not-downloaded、コア同梱はそのまま読める', async ({
    page,
  }) => {
    const d = await makeDist();
    expect(Object.keys(d.index)).toEqual(expect.arrayContaining([A, B]));
    // コア同梱のパックは packs.json に載らない
    expect(d.index[CORE]).toBeUndefined();
    // 共有データ（kanji-g1）: なぞりのエンジン（本体）が漢字の書き順を全学年分読み込むため、
    // 本体から辿れる共有データはコアに入り、パックの files には入らない（両方に入らない）。
    // コアから辿れない共有データだけが、それを使うすべてのパックに入る
    const shared = d.index[A]!.files.find((f) => f.startsWith('assets/packs/_data/'));
    if (shared) expect(d.index[B]!.files).toContain(shared);
    else expect(d.index[B]!.files.some((f) => f.startsWith('assets/packs/_data/'))).toBe(false);
    expect(d.index[A]!.files).toEqual(
      expect.arrayContaining([`audio/${A}/hello.mp3`, `audio/${A}/done.mp3`]),
    );

    const server = await serve(d);
    await openPrepared(page, server.url);
    expect(await packCaches(page)).toEqual([]);
    expect(await stateOf(page, A)).toBe('not-downloaded');
    expect(await stateOf(page, CORE)).toBe('core');

    // A を取得（進み具合が最後まで届く）
    const got = await download(page, A);
    expect(got).toMatchObject({ ok: true });
    const nFiles = d.index[A]!.files.length;
    expect(got.last).toMatchObject({ doneFiles: nFiles, totalFiles: nFiles });
    expect(got.last?.doneBytes).toBe(d.index[A]!.bytes);
    expect(await packCaches(page)).toEqual([`mnw-pack/${A}@${d.index[A]!.hash}`]);
    expect(await stateOf(page, A)).toBe('ready');
    const meta = await idb<{ packId: string; hash: string }>(page, 'packsMeta');
    expect(meta).toEqual([expect.objectContaining({ packId: A, hash: d.index[A]!.hash })]);

    // ---- 配信を止める（オフライン）----
    await server.stop();
    await page.reload();
    await waitApi(page);
    expect(await isControlled(page)).toBe(true);

    // (1) 取得済みのパック: 単元のモジュール（共有データを含む）が読める。音声もキャッシュから
    const a = await load(page, A);
    expect(a.ok).toBe(true);
    if (a.ok) {
      expect(a.unitIds).toEqual(['sample-a.count', 'sample-a.done', 'sample-a.kanji']);
      expect((a.units['sample-a.kanji'] as { chars: number }).chars).toBeGreaterThan(50);
    }
    expect(await fetchStatus(page, `audio/${A}/hello.mp3`)).toBe(200);

    // (2) 未取得のパック（共有データは A のキャッシュにあっても）: not-downloaded
    const b = await load(page, B);
    expect(b).toMatchObject({
      ok: false,
      error: { name: 'PackUnavailableError', reason: 'not-downloaded' },
    });
    expect(await stateOf(page, B)).toBe('not-downloaded');

    // (6) コア同梱のパック: 取得の操作なしで読める
    const c = await load(page, CORE);
    expect(c).toMatchObject({ ok: true, unitIds: ['sample-core.hello'] });

    // オフラインでの取得は失敗し、何も残さない
    expect(await download(page, B)).toMatchObject({ ok: false, reason: 'offline' });
    expect(await packCaches(page)).toEqual([`mnw-pack/${A}@${d.index[A]!.hash}`]);
  });

  test('(3)(5) コアの更新で hash が変わったパックは outdated。再取得に失敗しても旧パックは残り、一括再取得で直る。cleanupCaches でパックは消えない', async ({
    page,
  }) => {
    const port = await getFreePort();
    const v1 = await makeDist({ tag: 'v1' });
    const v2 = await makeDist({ tag: 'v2', changeA: true });
    const v2broken = await makeDist({ tag: 'v2', changeA: true, breakA: true });
    const v3 = await makeDist({ tag: 'v3', changeA: true });
    expect(v2.version).toBe(v2broken.version);
    expect(new Set([v1.version, v2.version, v3.version]).size).toBe(3);
    // パックの内容: A だけ変わる。B は同じ
    expect(v2.index[A]!.hash).not.toBe(v1.index[A]!.hash);
    expect(v2.index[B]!.hash).toBe(v1.index[B]!.hash);
    expect(v3.index).toEqual(v2.index);

    let server = await serve(v1, port);
    await openPrepared(page, server.url);
    expect((await download(page, A)).ok).toBe(true);
    expect((await download(page, B)).ok).toBe(true);
    const aV1 = `mnw-pack/${A}@${v1.index[A]!.hash}`;
    const bCache = `mnw-pack/${B}@${v1.index[B]!.hash}`;
    expect(await packCaches(page)).toEqual([aV1, bCache].sort());

    // ---- コアの更新（v2: A の内容が変わった）。まずは A の音声が取れない配信 ----
    await server.stop();
    server = await serve(v2broken, port);
    await updateAndReload(page, v2.version);
    // (5) 新しいコアの activate（cleanupCaches）でパックのキャッシュは消えない
    expect(await packCaches(page)).toEqual([aV1, bCache].sort());
    expect(await coreCaches(page)).toEqual([`mnw-${v1.version}`, `mnw-${v2.version}`].sort());

    // (3) hash が変わった A は outdated（配信につながっていても開かない）。B はそのまま使える
    expect(await stateOf(page, A)).toBe('outdated');
    expect(await stateOf(page, B)).toBe('ready');
    expect(await load(page, A)).toMatchObject({ ok: false, error: { reason: 'outdated' } });
    expect((await load(page, B)).ok).toBe(true);

    // 再取得の失敗: 旧パックは残り、まだ outdated（版の違うパックは開かない）
    const failed = await page.evaluate(() =>
      (window as PacksWindow).__mnwPacks!.redownloadOutdated(),
    );
    expect(failed).toEqual([{ packId: A, reason: 'not-found' }]);
    expect(await packCaches(page)).toEqual([aV1, bCache].sort());
    expect(await stateOf(page, A)).toBe('outdated');

    // ---- 正しい v2 の配信で一括再取得 → 直る。旧版の A のキャッシュは消える ----
    await server.stop();
    server = await serve(v2, port);
    expect(
      await page.evaluate(() => (window as PacksWindow).__mnwPacks!.redownloadOutdated()),
    ).toEqual([]);
    const aV2 = `mnw-pack/${A}@${v2.index[A]!.hash}`;
    expect(await packCaches(page)).toEqual([aV2, bCache].sort());
    expect(await stateOf(page, A)).toBe('ready');
    const meta = await idb<{ packId: string; hash: string }>(page, 'packsMeta');
    expect(meta.find((m) => m.packId === A)?.hash).toBe(v2.index[A]!.hash);
    const chunk = v2.index[A]!.files.find((f) => f.startsWith(`assets/packs/${A}/`))!;
    expect(await page.evaluate(async (u) => (await fetch(u)).text(), chunk)).toContain(
      'mnw-e2e-v2',
    );

    // ---- さらに v3（パックは同じ）へ: コアの v1 は消え、パックは残る（5）----
    await server.stop();
    server = await serve(v3, port);
    await updateAndReload(page, v3.version);
    await expect
      .poll(() => coreCaches(page))
      .toEqual([`mnw-${v2.version}`, `mnw-${v3.version}`].sort());
    expect(await packCaches(page)).toEqual([aV2, bCache].sort());
    expect(await stateOf(page, A)).toBe('ready');
    expect(await stateOf(page, B)).toBe('ready');

    // オフラインでも読める
    await server.stop();
    await page.reload();
    await waitApi(page);
    expect((await load(page, A)).ok).toBe(true);
    expect((await load(page, B)).ok).toBe(true);
  });

  test('packs.json に無いパックのキャッシュは起動時に消し、記録も消す', async ({ page }) => {
    const port = await getFreePort();
    const v1 = await makeDist({ tag: 'v1' });
    const server = await serve(v1, port);
    await openPrepared(page, server.url);
    expect((await download(page, B)).ok).toBe(true);
    // packs.json から B を除いた版（コアの更新で B が無くなった）
    const v2 = await makeDist({ tag: 'v2-no-b' });
    const index = JSON.parse(await readFile(path.join(v2.dir, 'packs.json'), 'utf8')) as PackIndex;
    delete index[B];
    await writeFile(path.join(v2.dir, 'packs.json'), JSON.stringify(index));
    // packs.json を書き換えたので sw.js を作り直す（manifest はそのままなので finalizeDist では戻ってしまう）
    await rm(path.join(v2.dir, '.vite'), { recursive: true });
    const info = await finalizeDist(v2.dir);
    await server.stop();
    await serve({ ...v2, version: info.version }, port);
    await updateAndReload(page, info.version);
    await expect.poll(() => packCaches(page)).toEqual([]);
    expect(await idb(page, 'packsMeta')).toEqual([]);
  });

  test('(4) 保護者画面「きょうざい」: 取得 → 削除で教材だけ消え、記録は残る', async ({ page }) => {
    const d = await makeDist();
    const server = await serve(d);
    await openPrepared(page, server.url);
    await expect(page.getByTestId('start-button')).toBeEnabled();
    await start(page);
    // 学習の記録（単元の進度）を入れておく
    const profiles = await idb<{ id: string }>(page, 'profiles');
    const profileId = profiles[0]!.id;
    await idbPut(page, 'unitProgress', { profileId, unitId: 'sample-a.count', stage: 'practice' });

    await openParent(page, 'packs');
    await expect(page.getByTestId('tab-packs')).toBeVisible();
    await expect(page.getByTestId(`pack-state-${A}`)).toHaveText('未取得');
    await expect(page.getByTestId('packs-core')).toContainText('見本 CORE');

    await page.getByTestId(`pack-download-${A}`).click();
    await expect(page.getByTestId(`pack-state-${A}`)).toContainText('取得済み', {
      timeout: 30_000,
    });
    await expect(page.getByTestId('packs-message')).toContainText('取得しました');
    expect(await packCaches(page)).toEqual([`mnw-pack/${A}@${d.index[A]!.hash}`]);

    await page.getByTestId(`pack-delete-${A}`).click();
    await expect(page.getByTestId('confirm-dialog')).toContainText('学習の記録は消えません');
    await page.getByTestId('confirm-ok').click();
    await expect(page.getByTestId(`pack-state-${A}`)).toHaveText('未取得');
    await expect(page.getByTestId('packs-message')).toContainText('学習の記録は残っています');

    expect(await packCaches(page)).toEqual([]);
    expect(await idb(page, 'packsMeta')).toEqual([]);
    expect(await idb(page, 'unitProgress')).toEqual([
      expect.objectContaining({ profileId, unitId: 'sample-a.count' }),
    ]);
    expect(await idb(page, 'profiles')).toHaveLength(1);
  });
});
