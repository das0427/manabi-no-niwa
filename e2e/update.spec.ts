import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { expect as baseExpect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  attemptsOf,
  currentExposed,
  histLen,
  openMode,
  openParent,
  prepare,
  start,
} from './helpers/app';
import { throttleOver } from './helpers/fake-github';
import { listenInRange } from './helpers/ports';
import {
  NEW_VERSION,
  OLD_VERSION,
  SAMPLE_PACK,
  createFixture,
  manifestWithClaims,
} from './helpers/release-fixture';
import type { Fixture, Release } from './helpers/release-fixture';
import { startServe } from './helpers/serve';
import {
  createEnv,
  installedVersion,
  listFiles,
  observeDirectory,
  rawRequest,
  treeDigest,
} from './helpers/updater-env';
import type { EnvOptions, StatusJson, UpdateEnv } from './helpers/updater-env';

/**
 * 自動更新の通し試験（docs/expansion/updater-design.md 11.3 節）。npm run e2e:update（playwright.update.config.ts）で
 * この試験だけを流せる。通常の npm run e2e（chromium の project）にも入る。
 *
 * 偽の GitHub（127.0.0.1 の 4800〜4999 の空きポート。github.com と同じ形の 302 の転送・Range・切断・壊れた中身）と、
 * 古い版 2.1.0 を導入した一時フォルダ（HOME・XDG_* もその中）の中で、本物の serve.py を動かし、Playwright で保護者画面を操作して
 * 「更新する」を 1 回押す。本物の GitHub にはつながない。8765・4299 は使わない。
 *
 *  - 小さな偽のリリース: 本物のビルド（見本パック入り）を、アプリの版だけ変えて 2 回作る（e2e/helpers/release-fixture.ts）。
 *    音声の部品（audio-g1-g2 = 見本パック _sample-a の音声）は、2.1.0 → 2.2.0 で変わらない。
 *  - Windows の試験なので、serve.py の再起動は別プロセスになる（Linux は os.execv で PID が変わらない。設計 5.10 節）。
 *  - 空きが足りない状態は、serve.py の起動時に e2e/helpers/py/sitecustomize.py を読ませ、shutil.disk_usage の free だけを
 *    差し替えて作る（小さなディスクは管理者権限が要るため作れない）。
 */

// 通常の E2E の設定（15 秒）でも、npm run e2e:update の設定でも同じに動くよう、この試験の待ちはここで決める
const expect = baseExpect.configure({ timeout: 20_000 });

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

let fixture: Fixture;

test.beforeAll(async () => {
  test.setTimeout(300_000);
  fixture = await createFixture();
});

test.afterAll(async () => {
  await fixture?.cleanup();
});

const opened: UpdateEnv[] = [];
const closers: (() => Promise<void>)[] = [];

// Playwright は第 1 引数を分割代入で読むため、使わなくても {} を残す
// eslint-disable-next-line no-empty-pattern
test.afterEach(async ({}, testInfo) => {
  for (const close of closers.splice(0).reverse()) await close().catch(() => undefined);
  for (const env of opened.splice(0)) {
    if (testInfo.status !== testInfo.expectedStatus) {
      await testInfo
        .attach('serve.log', { body: env.serve.log(), contentType: 'text/plain' })
        .catch(() => undefined);
    }
    await env.close();
  }
});

/** 2.1.0 を導入した一時フォルダと、本物の serve.py と、偽の GitHub を用意する（served は偽の GitHub が配る版） */
async function makeEnv(
  options: Partial<EnvOptions> & { served?: Release | null } = {},
): Promise<UpdateEnv> {
  const served = options.served === undefined ? fixture.next : options.served;
  const env = await createEnv({ installed: fixture.old, ...options, served });
  opened.push(env);
  return env;
}

function zipOf(release: Release, kind: string): { name: string; bytes: number } {
  const packed = release.parts.get(kind)!.packed;
  return { name: packed.name, bytes: packed.bytes };
}

/** 自動の確認（起動して 15 秒後）で、新しい版が見つかるのを待つ。こちらからは確認を頼まない */
function waitForNewer(env: UpdateEnv): Promise<StatusJson> {
  return env.serve.waitStatus(
    (s) => s.check.state === 'ok' && s.latest?.newer === true,
    90_000,
    '自動の確認で新しい版が見つかりません',
  );
}

// ---------------------------------------------------------------- ページの操作

/** アプリを開く（window.__mnw を使えるテスト用の印を付けて、「はじめる」が押せるまで待つ） */
async function openApp(page: Page, target: { url: string }): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('mnw:test', '1');
    } catch {
      /* 無視 */
    }
  });
  await page.goto(`${target.url}?seed=1`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('start-button')).toBeEnabled();
}

type PackStatus = {
  packId: string;
  state: string;
  hash: string | null;
  downloaded: { hash: string } | null;
};
type PacksWindow = Window & {
  __mnwPacks?: {
    packStatus(id: string): Promise<PackStatus>;
    downloadPack(id: string): Promise<void>;
  };
};

/** Service Worker の準備（コアのプリキャッシュ）が終わるのを待ち、読み込み直して制御下に入れる */
async function prepareOffline(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page
          .evaluate(async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            return reg?.active?.state === 'activated';
          })
          .catch(() => false),
      { timeout: 60_000, intervals: [250, 500, 1000] },
    )
    .toBe(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('start-button')).toBeEnabled();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
  await page.waitForFunction(() => !!(window as PacksWindow).__mnwPacks, null, { timeout: 30_000 });
}

const packStatus = (page: Page, id: string): Promise<PackStatus> =>
  page.evaluate(async (packId) => (window as PacksWindow).__mnwPacks!.packStatus(packId), id);

/** 見本の教材パックを取得する（取得済みの教材パックが、更新のあとに取り直されるのを見るため） */
async function downloadSamplePack(page: Page): Promise<PackStatus> {
  await page.evaluate(
    async (id) => (window as PacksWindow).__mnwPacks!.downloadPack(id),
    SAMPLE_PACK,
  );
  const status = await packStatus(page, SAMPLE_PACK);
  expect(status.state).toBe('ready');
  return status;
}

/** 学習の記録を 1 件作る（算数「たす」を 1 問解く）。終わったら、起動画面に戻る */
async function recordOneAttempt(page: Page): Promise<void> {
  await prepare(page, { levels: { add: 0 } });
  await start(page);
  await openMode(page, 'math', 'add');
  await expect.poll(async () => (await histLen(page)) > 0).toBe(true);
  const answer = ((await currentExposed(page)).data as { answerIndex: number }).answerIndex;
  const button = page.getByTestId(`choice-${answer}`);
  await expect(button).toBeEnabled();
  await button.click();
  await expect.poll(async () => (await attemptsOf(page, 'math')).length).toBe(1);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('start-button')).toBeEnabled();
}

/** 起動画面 → ホーム → 保護者ゲート → 「このアプリについて」 */
async function openAbout(page: Page): Promise<void> {
  await start(page);
  await openParent(page, 'about');
  await expect(page.getByTestId('tab-about')).toBeVisible();
}

type Marked = Window & { __e2eMark?: number };

async function markPage(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as Marked).__e2eMark = 1;
  });
}

const isMarked = (page: Page): Promise<boolean> =>
  page.evaluate(() => (window as Marked).__e2eMark === 1);

/** ページが読み込み直されるのを待つ（読み込み直されると markPage の印が消える）。起動画面が出るまで */
async function expectReloaded(page: Page, timeout = 180_000): Promise<void> {
  await expect
    .poll(
      () =>
        isMarked(page)
          .then((marked) => !marked)
          .catch(() => false),
      {
        timeout,
        intervals: [250, 500, 1000],
      },
    )
    .toBe(true);
  await expect(page.getByTestId('start-button')).toBeEnabled({ timeout: 60_000 });
}

/** アプリ（ブラウザ）が、配信（127.0.0.1:<port>）以外へ要求していないことを見張る（BC-03） */
function watchRequests(page: Page, env: UpdateEnv): { foreign(): string[] } {
  const foreign: string[] = [];
  page.context().on('request', (req) => {
    const url = req.url();
    if (/^(data|blob|about):/.test(url)) return;
    if (new URL(url).origin !== env.origin) foreign.push(url);
  });
  return { foreign: () => foreign };
}

/** 置き場の外・決めた名前以外に何も書いていない */
function expectOnlyAllowedWrites(env: UpdateEnv): void {
  const sb = env.sandbox;
  const outsideApp = listFiles(sb.data).filter((p) => !p.startsWith('manabi-no-niwa/app/'));
  expect(
    outsideApp.every((p) =>
      ['manabi-no-niwa/update/state.json', 'manabi-no-niwa/update/lock'].includes(p),
    ),
    `置き場の外に書いたもの: ${outsideApp.join(', ')}`,
  ).toBe(true);
  expect(listFiles(sb.config).every((p) => p === 'manabi-no-niwa/updater.json')).toBe(true);
  expect(listFiles(sb.home)).toEqual([]);
  expect(listFiles(sb.state)).toEqual([]);
  expect(listFiles(sb.base).filter((p) => p.includes('__pycache__') || p.endsWith('.pyc'))).toEqual(
    [],
  );
}

/** 更新が終わった（版が release で、控え・作業用のフォルダが片付いた）あとの、置き場の中身 */
async function expectUpdatedLayout(env: UpdateEnv, release: Release): Promise<void> {
  await expect
    .poll(() => !existsSync(env.sandbox.appPrev) && !existsSync(env.sandbox.appNext))
    .toBe(true);
  await expect.poll(() => listFiles(env.sandbox.downloads)).toEqual([]);
  const appDir = env.sandbox.app;
  expect(installedVersion(appDir)).toBe(release.version);
  for (const [kind, part] of release.parts) {
    const marker = JSON.parse(readFileSync(path.join(appDir, 'parts', `${kind}.json`), 'utf8')) as {
      contentId: string;
    };
    expect(marker.contentId, kind).toBe(part.packed.contentId);
  }
  expect(JSON.parse(readFileSync(path.join(appDir, 'dist', 'version.json'), 'utf8'))).toMatchObject(
    {
      version: release.swVersion,
      appVersion: release.version,
    },
  );
}

// ---------------------------------------------------------------- 通し

test('2.1.0 で開く → 自動の確認 → 「更新する」を 1 回 → 2.2.0 に切り替わり、記録・教材パックが残る', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const { next, old } = fixture;
  const main = zipOf(next, 'main');
  const audio = zipOf(next, 'audio-g1-g2');
  const env = await makeEnv({
    configureFake: (fake) => {
      fake.throttle = throttleOver(main.bytes, 3000); // 進み具合の表示を見られるように、ゆっくり配る
    },
  });
  const requests = watchRequests(page, env);

  // 古い版を開いて、記録を作り、見本の教材パックを取得する
  await openApp(page, env);
  await prepareOffline(page);
  const oldHash = old.packs[SAMPLE_PACK]!.hash;
  const newHash = next.packs[SAMPLE_PACK]!.hash;
  expect(newHash).not.toBe(oldHash);
  const downloaded = await downloadSamplePack(page);
  expect(downloaded.downloaded?.hash).toBe(oldHash);
  await recordOneAttempt(page);
  const attemptsBefore = await attemptsOf(page, 'math');
  expect(attemptsBefore).toHaveLength(1);

  // 起動して 15 秒後の自動の確認で、新しい版が見つかる（こちらからは確認を頼まない）
  const found = await waitForNewer(env);
  expect(found.latest).toMatchObject({
    version: NEW_VERSION,
    installable: true,
    downloadBytes: main.bytes,
  });
  expect(found.latest!.parts.map((p) => [p.kind, p.changed])).toEqual([
    ['main', true],
    ['audio-g1-g2', false],
  ]);

  // 保護者画面「このアプリについて」: 表示
  await openAbout(page);
  await expect(page.getByTestId('app-version')).toHaveText(`バージョン: ${OLD_VERSION}`);
  await expect(page.getByTestId('update-current')).toHaveText(`いまのバージョン: ${OLD_VERSION}`);
  await expect(page.getByTestId('update-check-status')).toContainText('に確かめました');
  await expect(page.getByTestId('update-available')).toContainText(
    `新しいバージョン ${NEW_VERSION} があります（公開日 2026-11-20）`,
  );
  await expect(page.getByTestId('update-notes')).toContainText(
    '小学4年の算数に「がい数」を足しました',
  );
  await expect(page.getByTestId('update-size')).toContainText('変わった部分だけ');
  await expect(page.getByTestId('parent-update-notice')).toContainText(
    `新しいバージョン ${NEW_VERSION} があります`,
  );
  await expect(page.getByTestId('update-disk-warning')).toHaveCount(0);
  await expect(page.getByTestId('update-autocheck')).toBeChecked();

  // 「更新する」を 1 回だけ押す。そのあとは何も押さない
  await markPage(page);
  const before = await env.serve.status();
  const prevWatch = observeDirectory(env.sandbox.appPrev, 'parts/main.json');
  await page.getByTestId('update-apply').click();
  await expect(page.getByTestId('update-apply')).toHaveCount(0);
  await expect(page.getByTestId('update-progress-text')).toContainText('ダウンロードしています');
  await expect(page.getByTestId('parent-update-notice')).toContainText('アプリを更新しています');

  // 配信が新しい版になり、アプリが新しい版を準備して、読み込み直される
  await expectReloaded(page);
  const prev = prevWatch.stop();

  // 新しい版に切り替わっている
  await openAbout(page);
  await expect(page.getByTestId('app-version')).toHaveText(`バージョン: ${NEW_VERSION}`);
  await expect(page.getByTestId('update-current')).toHaveText(`いまのバージョン: ${NEW_VERSION}`);
  await expect(page.getByTestId('update-done')).toContainText(`${NEW_VERSION} に更新しました`);
  await expect(page.getByTestId('update-available')).toHaveCount(0);
  await expect(page.getByTestId('update-error')).toHaveCount(0);
  await expect(page.getByTestId('parent-update-notice')).toHaveCount(0);
  // アプリ（Service Worker）の新しい版に切り替わっている（Service Worker は直前の版のキャッシュも残す）
  await expect(page.getByText(`キャッシュのバージョン: ${next.swVersion}`)).toBeVisible();
  const coreCaches = await page.evaluate(async () =>
    (await caches.keys()).filter((k) => k.startsWith('mnw-') && !k.startsWith('mnw-pack/')).sort(),
  );
  expect(coreCaches).toEqual([`mnw-${old.swVersion}`, `mnw-${next.swVersion}`].sort());
  expect(old.swVersion).not.toBe(next.swVersion);
  const after = await env.serve.status();
  expect(after.current.version).toBe(NEW_VERSION);
  expect(after.update).toMatchObject({ phase: 'done', targetVersion: NEW_VERSION });
  expect(after.lastApplied).toMatchObject({ version: NEW_VERSION, from: OLD_VERSION });
  expect(after.server.startedAt).not.toBe(before.server.startedAt); // 配信は起動し直された
  expect(after.token).not.toBe(before.token);

  // 記録（IndexedDB）が残っている
  expect(await attemptsOf(page, 'math')).toEqual(attemptsBefore);

  // 取得済みの教材パックが、自動で取り直された（押していない）
  await expect
    .poll(async () => (await packStatus(page, SAMPLE_PACK)).downloaded?.hash, { timeout: 60_000 })
    .toBe(newHash);
  expect((await packStatus(page, SAMPLE_PACK)).state).toBe('ready');

  // 控え: 入れ替えの直後は前の版が app.prev に残り（2.1.0）、新しい serve.py が確かめたあとで消える
  expect(prev.seen, '入れ替えの直後に app.prev が見えませんでした').toBe(true);
  expect(prev.version).toBe(OLD_VERSION);
  await expectUpdatedLayout(env, next);
  expectOnlyAllowedWrites(env);
  // 変わっていない音声の部品は、今の版から写してあり、中身が同じ
  const hello = old.parts
    .get('audio-g1-g2')!
    .entries.find((e) => e.name.endsWith(`/audio/${SAMPLE_PACK}/hello.mp3`))!;
  expect(
    readFileSync(path.join(env.sandbox.app, 'dist', 'audio', SAMPLE_PACK, 'hello.mp3')).equals(
      hello.data,
    ),
  ).toBe(true);

  // 変わっていない zip（音声）は、取り直していない。変わった本体の zip は 1 回だけ、全部
  expect(env.fake.requestsFor(audio.name)).toEqual([]);
  expect(env.fake.blobRequestsFor(main.name)).toHaveLength(1);
  expect(env.fake.bytesSentFor(main.name)).toBe(main.bytes);
  expect(env.fake.manifestRequests().length).toBeGreaterThanOrEqual(2); // 自動の確認と、押したあとの取り直し
  // 外へ出る通信は更新の確認と取得だけ。送るのは User-Agent だけ（Cookie・問い合わせの文字列なし）
  expect(new Set(env.fake.log.map((r) => r.ua))).toEqual(new Set(['manabi-no-niwa-updater']));
  expect(env.fake.log.every((r) => r.cookie === null && r.authorization === null)).toBe(true);
  expect(env.fake.log.every((r) => !r.path.includes('?'))).toBe(true);
  // アプリ（ブラウザ）は、配信以外へ通信していない（BC-03）
  expect(requests.foreign()).toEqual([]);
});

test('音声の部品も変わった版では、その zip も取得して入れる', async () => {
  test.setTimeout(180_000);
  const release = await fixture.nextAudio();
  const main = zipOf(release, 'main');
  const audio = zipOf(release, 'audio-g1-g2');
  const env = await makeEnv({ served: release });

  expect((await env.serve.post('check')).status).toBe(202);
  const found = await waitForNewer(env);
  expect(found.latest!.parts.map((p) => [p.kind, p.changed])).toEqual([
    ['main', true],
    ['audio-g1-g2', true],
  ]);
  expect(found.latest!.downloadBytes).toBe(main.bytes + audio.bytes);

  expect((await env.serve.post('apply', { version: NEW_VERSION })).status).toBe(202);
  const done = await env.serve.waitStatus(
    (s) => s.current.version === NEW_VERSION && s.update.phase === 'done',
    120_000,
    '新しい版に切り替わりません',
  );
  expect(done.lastApplied).toMatchObject({ version: NEW_VERSION, from: OLD_VERSION });
  await expectUpdatedLayout(env, release);
  expect(env.fake.blobRequestsFor(main.name)).toHaveLength(1);
  expect(env.fake.blobRequestsFor(audio.name)).toHaveLength(1);
  // 新しい音声が配られている
  const hello = release.parts
    .get('audio-g1-g2')!
    .entries.find((e) => e.name.endsWith(`/audio/${SAMPLE_PACK}/hello.mp3`))!;
  const served = await rawRequest(env.serve.port, 'GET', `/audio/${SAMPLE_PACK}/hello.mp3`);
  expect(served.status).toBe(200);
  expect(served.body.equals(hello.data)).toBe(true);
  expectOnlyAllowedWrites(env);
});

// ---------------------------------------------------------------- 途中で切れた取得

test('取得の途中で接続が切れても、続きから取得して入れる（最初から取り直さない）', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const { next } = fixture;
  const main = zipOf(next, 'main');
  const cutAt = Math.floor(main.bytes / 3);
  const env = await makeEnv({
    configureFake: (fake) => {
      fake.cut.set(main.name, { after: cutAt, times: 1 });
    },
  });

  await openApp(page, env);
  await prepareOffline(page);
  await waitForNewer(env);
  await openAbout(page);
  await markPage(page);
  await page.getByTestId('update-apply').click();

  // 切れたところ（本文を cutAt バイトまで配った）で、取得の失敗にはならずに待つ
  await expect
    .poll(() => env.fake.blobRequestsFor(main.name).map((r) => [r.range, r.sent]))
    .toEqual([[null, cutAt]]);
  const waiting = await env.serve.status();
  expect(waiting.update.phase).toBe('downloading');
  expect(waiting.update.error).toBeNull();
  await expect(page.getByTestId('update-progress-text')).toContainText('ダウンロードしています');
  await expect(page.getByTestId('update-error')).toHaveCount(0);

  // 続きから（Range）取得して、最後まで進む
  await expectReloaded(page);
  const requests = env.fake.blobRequestsFor(main.name);
  expect(requests.map((r) => r.range)).toEqual([null, `bytes=${cutAt}-`]);
  expect(env.fake.bytesSentFor(main.name)).toBe(main.bytes); // 切れるまでの分を、もう一度は配っていない
  await openAbout(page);
  await expect(page.getByTestId('update-current')).toHaveText(`いまのバージョン: ${NEW_VERSION}`);
  await expectUpdatedLayout(env, next);
});

// ---------------------------------------------------------------- sha256 が合わない

test('sha256 が合わない zip は入れずに、元の版のまま残る（直したあとの「もう一度ためす」で入る）', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const { next } = fixture;
  const main = zipOf(next, 'main');
  const env = await makeEnv({
    configureFake: (fake) => {
      fake.corrupt.set(main.name, Infinity); // 先頭 1 バイトを変えた中身を返し続ける
    },
  });

  await openApp(page, env);
  await prepareOffline(page);
  await waitForNewer(env);
  const digest = treeDigest(env.sandbox.app);
  await openAbout(page);
  await markPage(page);
  await page.getByTestId('update-apply').click();

  // 失敗を案内する: 入れずに中止した・いまの版はそのまま使える・もう一度ためせる
  const error = page.getByTestId('update-error');
  await expect(error).toBeVisible({ timeout: 120_000 });
  await expect(error).toContainText(
    'ダウンロードした内容が正しくなかったため、入れずに中止しました',
  );
  await expect(error).toContainText('いまのバージョンはそのまま使えます');
  await expect(page.getByTestId('update-error-detail')).toContainText(main.name);
  await expect(page.getByTestId('update-retry')).toBeVisible();
  await expect(page.getByTestId('update-apply')).toHaveCount(0);
  await expect(page.getByTestId('update-current')).toHaveText(`いまのバージョン: ${OLD_VERSION}`);
  expect(await isMarked(page)).toBe(true); // 読み込み直されていない

  // 元のまま: 置き場の中身は 1 バイトも変わらない。作りかけ・控え・壊れた zip は残らない
  const failed = await env.serve.status();
  expect(failed.update).toMatchObject({ phase: 'failed', targetVersion: NEW_VERSION });
  expect(failed.update.error?.code).toBe('sha256-mismatch');
  expect(failed.current.version).toBe(OLD_VERSION);
  expect(failed.lastApplied).toBeNull();
  expect(installedVersion(env.sandbox.app)).toBe(OLD_VERSION);
  expect(treeDigest(env.sandbox.app)).toBe(digest);
  expect(existsSync(env.sandbox.appNext)).toBe(false);
  expect(existsSync(env.sandbox.appPrev)).toBe(false);
  expect(listFiles(env.sandbox.downloads)).toEqual([]);
  // 最初に取得して合わず、1 回だけ最初から取り直して、やはり合わなかった（2 回とも全部）
  expect(env.fake.blobRequestsFor(main.name).map((r) => [r.range, r.sent])).toEqual([
    [null, main.bytes],
    [null, main.bytes],
  ]);
  const served = await rawRequest(env.serve.port, 'GET', '/index.html');
  expect(served.status).toBe(200); // 配信は元の版のまま動いている
  expectOnlyAllowedWrites(env);

  // 直して（配る側が正しい zip を返すようにして）、「もう一度ためす」を 1 回押すと入る
  env.fake.corrupt.delete(main.name);
  await page.getByTestId('update-retry').click();
  await expectReloaded(page);
  await openAbout(page);
  await expect(page.getByTestId('update-current')).toHaveText(`いまのバージョン: ${NEW_VERSION}`);
  await expect(page.getByTestId('update-done')).toContainText(`${NEW_VERSION} に更新しました`);
  await expectUpdatedLayout(env, next);
});

// ---------------------------------------------------------------- 電源断（配信が途中で落ちる）

test('取得の途中で配信が落ちても（電源断）、起動し直すと取得した分の続きから自動で入れる', async () => {
  test.setTimeout(240_000);
  const { next } = fixture;
  const main = zipOf(next, 'main');
  // 1MiB ずつ書き出すので、この位置で止まると .part には 2MiB が残る
  const stallAt = Math.floor((main.bytes * 3) / 4);
  const env = await makeEnv({
    configureFake: (fake) => {
      fake.stall.set(main.name, { after: stallAt, times: 1 });
    },
  });
  const part = path.join(env.sandbox.downloads, `${main.name}.part`);

  expect((await env.serve.post('check')).status).toBe(202);
  await waitForNewer(env);
  expect((await env.serve.post('apply', { version: NEW_VERSION })).status).toBe(202);
  await expect
    .poll(() => env.fake.blobRequestsFor(main.name).map((r) => r.sent))
    .toEqual([stallAt]);
  await expect.poll(() => (existsSync(part) ? statSync(part).size : 0)).toBeGreaterThanOrEqual(MIB);
  const digest = treeDigest(env.sandbox.app);

  // 電源が切れた形: 配信（serve.py）を強制終了する
  await env.serve.kill();
  const partSize = statSync(part).size;
  expect(partSize).toBeGreaterThanOrEqual(MIB);
  expect(partSize).toBeLessThanOrEqual(stallAt);

  // 起動し直すと、途中で止まったことが分かる。今の版のまま・作りかけは無い
  await env.serve.launch();
  const restarted = await env.serve.status();
  expect(restarted.current.version).toBe(OLD_VERSION);
  expect(restarted.update.phase).toBe('failed');
  expect(restarted.update.error?.code).toBe('interrupted');
  expect(treeDigest(env.sandbox.app)).toBe(digest);
  expect(existsSync(env.sandbox.appNext)).toBe(false);
  expect(statSync(part).size).toBe(partSize); // 取得した分は残っている

  // 最初の自動の確認が成功すると、押さなくても、取得した分の続きから始めて入れる
  const done = await env.serve.waitStatus(
    (s) => s.current.version === NEW_VERSION && s.update.phase === 'done',
    150_000,
    '起動し直したあと、自動で続きから入りません',
  );
  expect(done.lastApplied).toMatchObject({ version: NEW_VERSION, from: OLD_VERSION });
  expect(env.serve.log()).toContain('途中で止まった更新を続きから始めます');
  const requests = env.fake.blobRequestsFor(main.name);
  expect(requests.map((r) => r.range)).toEqual([null, `bytes=${partSize}-`]);
  expect(env.fake.bytesSentFor(main.name)).toBe(stallAt + (main.bytes - partSize)); // 取得した分は配り直していない
  await expectUpdatedLayout(env, next);
  expectOnlyAllowedWrites(env);
});

// ---------------------------------------------------------------- 新しい版が動かない

test('新しい版の serve.py が動かないときは、入れ替えずに元の版のまま残る（確かめ済みの zip は取り直さない）', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const broken = await fixture.brokenServe();
  const main = zipOf(broken, 'main');
  const env = await makeEnv({ served: broken });

  await openApp(page, env);
  await waitForNewer(env);
  const digest = treeDigest(env.sandbox.app);
  await openAbout(page);
  await markPage(page);
  await page.getByTestId('update-apply').click();

  // 取得・展開・中身の確かめは通るが、新しい serve.py の自己検査で見つかり、入れ替える前に止まる
  const error = page.getByTestId('update-error');
  await expect(error).toBeVisible({ timeout: 120_000 });
  await expect(error).toContainText(
    '新しいバージョンを動かす準備で問題が見つかったため、元のバージョンのままにしました',
  );
  await expect(error).toContainText('いまのバージョンはそのまま使えます');
  const failed = await env.serve.status();
  expect(failed.update.error?.code).toBe('self-test');
  expect(failed.current.version).toBe(OLD_VERSION);
  expect(installedVersion(env.sandbox.app)).toBe(OLD_VERSION);
  expect(treeDigest(env.sandbox.app)).toBe(digest);
  expect(existsSync(env.sandbox.appNext)).toBe(false);
  expect(existsSync(env.sandbox.appPrev)).toBe(false);
  expect(await isMarked(page)).toBe(true); // 読み込み直されていない
  expect((await rawRequest(env.serve.port, 'GET', '/index.html')).status).toBe(200); // 配信は元のまま
  // 確かめ済みの zip は残る（もう一度押したとき取り直さない）
  expect(listFiles(env.sandbox.downloads)).toEqual([main.name]);
  expect(env.fake.blobRequestsFor(main.name)).toHaveLength(1);

  // もう一度ためしても、zip は取り直さずに、同じ理由で止まる
  await page.getByTestId('update-retry').click();
  await env.serve.waitStatus(
    (s) => s.update.phase === 'failed' && s.update.startedAt !== failed.update.startedAt,
    60_000,
    'もう一度ためした結果が出ません',
  );
  await expect(error).toContainText(
    '新しいバージョンを動かす準備で問題が見つかったため、元のバージョンのままにしました',
  );
  expect(env.fake.blobRequestsFor(main.name)).toHaveLength(1);
  expect(treeDigest(env.sandbox.app)).toBe(digest);
  expect(existsSync(env.sandbox.appNext)).toBe(false);
});

// ---------------------------------------------------------------- 空き容量

test('空き容量が足りないときは、取得を始めずに案内する（空きが戻ると入る）', async ({ page }) => {
  test.setTimeout(300_000);
  const { next } = fixture;
  // 版の情報の「大きさ」だけを大きく申告する（zip は取得されないので、実物と食い違ってよい）
  const claimed = manifestWithClaims(next, { main: { bytes: GIB, unpackedBytes: 2 * GIB } });
  const env = await makeEnv({
    fakeDisk: true,
    configureFake: (fake) => {
      fake.manifest = claimed;
    },
  });
  await env.setFreeBytes(256 * MIB);

  await openApp(page, env);
  await prepareOffline(page);
  const found = await waitForNewer(env);
  const need = found.latest!.needBytes;
  const free = found.disk.freeBytes;
  expect(free).toBe(256 * MIB);
  expect(need).toBeGreaterThanOrEqual(3 * GIB + 256 * MIB); // 取得 1GiB + 展開 2GiB + 余裕 256MiB
  expect(need).toBeLessThan(3 * GIB + 257 * MIB);
  const shortGb = (Math.ceil(((need - free) / GIB) * 10) / 10).toFixed(1);
  const digest = treeDigest(env.sandbox.app);

  // 押す前から、足りないかもしれないことを知らせる
  await openAbout(page);
  await expect(page.getByTestId('update-available')).toBeVisible();
  await expect(page.getByTestId('update-disk-warning')).toContainText(
    `空き容量が足りないかもしれません（あと約 ${shortGb} GB 必要です）`,
  );

  // 押すと、取得を始めずに断る。理由とあといくら必要かを案内する
  await markPage(page);
  await page.getByTestId('update-apply').click();
  const error = page.getByTestId('update-error');
  await expect(error).toBeVisible({ timeout: 60_000 });
  await expect(error).toContainText(`空き容量が足りません（あと約 ${shortGb} GB 必要です）`);
  await expect(error).toContainText('いまのバージョンはそのまま使えます');
  await expect(page.getByTestId('update-retry')).toBeVisible();
  const failed = await env.serve.status();
  expect(failed.update.phase).toBe('failed');
  expect(failed.update.error).toMatchObject({ code: 'disk-full', needBytes: need });
  expect(env.fake.log.filter((r) => r.path.endsWith('.zip'))).toEqual([]); // 何も取得していない
  expect(env.fake.manifestRequests().length).toBeGreaterThanOrEqual(2);
  expect(installedVersion(env.sandbox.app)).toBe(OLD_VERSION);
  expect(treeDigest(env.sandbox.app)).toBe(digest);
  expect(existsSync(env.sandbox.appNext)).toBe(false);
  expect(listFiles(env.sandbox.downloads)).toEqual([]);
  expect(await isMarked(page)).toBe(true);

  // 空きが戻って（本物の空きに）、版の情報も実物の大きさに戻ると、「もう一度ためす」で入る
  await env.setFreeBytes(null);
  env.fake.manifest = next.manifestBytes;
  await page.getByTestId('update-retry').click();
  await expectReloaded(page);
  await openAbout(page);
  await expect(page.getByTestId('update-current')).toHaveText(`いまのバージョン: ${NEW_VERSION}`);
  await expectUpdatedLayout(env, next);
});

// ---------------------------------------------------------------- ほかのオリジンから

interface Foreign {
  origin: string;
  url: string;
  /** この場所に来た要求のパス */
  hits: string[];
  html: string;
}

/** 別のオリジン（別のポート）の「悪意のあるページ」と、転送先の見本を配る小さなサーバー */
async function startForeign(): Promise<Foreign> {
  const foreign: Foreign = {
    origin: '',
    url: '',
    hits: [],
    html: '<!doctype html><title>x</title>',
  };
  const server = http.createServer((req, res) => {
    foreign.hits.push(req.url ?? '');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(foreign.html);
  });
  const port = await listenInRange(server);
  foreign.origin = `http://127.0.0.1:${port}`;
  foreign.url = `${foreign.origin}/`;
  closers.push(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  return foreign;
}

/** 別のオリジンのページが、配信の窓口へ送ってみる。合言葉が漏れている最悪の場合も試す */
function attackPage(target: string, token: string): string {
  return `<!doctype html><meta charset="utf-8"><title>other origin</title><script>
const target = ${JSON.stringify(target)};
const token = ${JSON.stringify(token)};
async function attempt(fn) {
  try {
    const r = await fn();
    return { sent: true, type: r.type, status: r.status };
  } catch (e) {
    return { sent: false, error: String(e) };
  }
}
const json = { 'Content-Type': 'application/json', 'X-Manabi-Token': token };
window.results = (async () => ({
  readStatus: await attempt(() => fetch(target + '/__manabi/update/status')),
  applyJson: await attempt(() => fetch(target + '/__manabi/update/apply', { method: 'POST', headers: json, body: JSON.stringify({ version: '${NEW_VERSION}' }) })),
  settingsJson: await attempt(() => fetch(target + '/__manabi/update/settings', { method: 'POST', headers: json, body: JSON.stringify({ autoCheck: false }) })),
  applyPlain: await attempt(() => fetch(target + '/__manabi/update/apply', { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ version: '${NEW_VERSION}' }) })),
  applyForm: await attempt(() => fetch(target + '/__manabi/update/apply', { method: 'POST', mode: 'no-cors', body: new URLSearchParams({ version: '${NEW_VERSION}' }) })),
}))();
</script>`;
}

test('ほかのオリジンのページからは、更新を始めさせられない（POST は拒まれ、合言葉も読めない）', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const env = await makeEnv();
  expect((await env.serve.post('check')).status).toBe(202);
  const found = await waitForNewer(env);
  const token = found.token;
  const foreign = await startForeign();
  foreign.html = attackPage(env.origin, token);

  // 本物のブラウザで、別のオリジンのページから試す
  const seen: string[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/__manabi/update/'))
      seen.push(`${r.request().method()} ${new URL(r.url()).pathname} ${r.status()}`);
  });
  page.on('requestfailed', (r) => {
    if (r.url().includes('/__manabi/update/'))
      seen.push(`${r.method()} ${new URL(r.url()).pathname} FAILED ${r.failure()?.errorText}`);
  });
  await page.goto(foreign.url);
  const results = await page.evaluate(
    () =>
      (window as unknown as { results: Promise<Record<string, Record<string, unknown>>> }).results,
  );
  for (const [name, result] of Object.entries(results)) {
    // どれも、ページは応答を読めない（fetch が失敗する）
    expect(result, name).toMatchObject({ sent: false });
  }
  // 窓口は応答に CORS の許可を付けない: 状態（合言葉）の読み取りと、JSON の POST（プリフライト）は止まる
  expect(seen).toContain('GET /__manabi/update/status FAILED net::ERR_FAILED');
  expect(seen).toContain('POST /__manabi/update/apply FAILED net::ERR_FAILED');
  expect(seen).toContain('POST /__manabi/update/settings FAILED net::ERR_FAILED');
  // プリフライトなしで送れる形（text/plain・フォームの形）は、要求は配信に届くが、窓口が断る。
  // 応答は Cross-Origin-Resource-Policy: same-origin でページには渡らない（成功の応答は 1 つも無い）
  expect(seen.filter((x) => x.includes('ERR_BLOCKED_BY_RESPONSE'))).toHaveLength(2);
  expect(seen.every((x) => x.includes(' FAILED '))).toBe(true);

  // 何も起きていない
  const status = await env.serve.status();
  expect(status.update.phase).toBe('idle');
  expect(status.settings.autoCheck).toBe(true);
  expect(env.fake.log.filter((r) => r.path.endsWith('.zip'))).toEqual([]);

  // 合言葉を持っていても、ブラウザがプリフライトを飛ばして送ったとしても、窓口は断る（応答の中身まで）
  const apply = JSON.stringify({ version: NEW_VERSION });
  const base: Record<string, string> = {
    'Sec-Fetch-Site': 'same-origin',
    Origin: env.origin,
    'Content-Type': 'application/json',
    'X-Manabi-Token': token,
    'Content-Length': String(Buffer.byteLength(apply)),
  };
  const refuse = async (
    name: string,
    changes: Record<string, string | null>,
    expected: { status: number; code: string },
  ): Promise<void> => {
    const headers = { ...base };
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) delete headers[key];
      else headers[key] = value;
    }
    const res = await rawRequest(env.serve.port, 'POST', '/__manabi/update/apply', {
      headers,
      body: apply,
    });
    const body = JSON.parse(res.body.toString('utf8')) as { ok: boolean; error?: { code: string } };
    expect({ name, status: res.status, ok: body.ok, code: body.error?.code }).toEqual({
      name,
      status: expected.status,
      ok: false,
      code: expected.code,
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  };
  const forbidden = { status: 403, code: 'forbidden' };
  await refuse('Origin が別のポート', { Origin: foreign.origin }, forbidden);
  await refuse(
    'Origin が別のポート・Sec-Fetch-Site: same-site',
    { Origin: foreign.origin, 'Sec-Fetch-Site': 'same-site' },
    forbidden,
  );
  await refuse('Sec-Fetch-Site: cross-site', { 'Sec-Fetch-Site': 'cross-site' }, forbidden);
  await refuse('Origin が無い', { Origin: null }, forbidden);
  await refuse(
    'Origin が localhost と食い違う',
    { Origin: `http://localhost:${env.serve.port}` },
    forbidden,
  );
  await refuse('合言葉が違う', { 'X-Manabi-Token': 'x'.repeat(32) }, forbidden);
  await refuse('合言葉が無い', { 'X-Manabi-Token': null }, forbidden);
  await refuse(
    'Content-Type が text/plain',
    { 'Content-Type': 'text/plain' },
    { status: 415, code: 'unsupported-media-type' },
  );
  await refuse(
    'Host が別の名前（DNS rebinding）',
    { Host: `evil.example:${env.serve.port}`, Origin: `http://evil.example:${env.serve.port}` },
    forbidden,
  );
  const options = await rawRequest(env.serve.port, 'OPTIONS', '/__manabi/update/apply', {
    headers: {
      Origin: foreign.origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-manabi-token',
    },
  });
  expect(options.status).toBe(405);
  expect(options.headers['access-control-allow-origin']).toBeUndefined();

  // 断ったあとも何も起きていない。同じ合言葉で正しい見出しなら、窓口は使える（試験の道具が正しい確かめ）
  const still = await env.serve.status();
  expect(still.update.phase).toBe('idle');
  expect(still.settings.autoCheck).toBe(true);
  expect(env.fake.log.filter((r) => r.path.endsWith('.zip'))).toEqual([]);
  expect((await env.serve.post('check', {}, { token })).status).toBe(202);
});

test('ほかのオリジンのページの枠（iframe）には入らない（見えない枠で保護者の操作を押させない）', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const env = await makeEnv();
  const foreign = await startForeign();
  foreign.html = `<!doctype html><meta charset="utf-8"><title>frame</title><iframe src="${env.origin}/" width="900" height="700"></iframe>`;

  const framed = page.waitForResponse((r) => r.url() === `${env.origin}/`);
  await page.goto(foreign.url);
  const res = await framed;
  // 配信はどの応答にも、枠に入れさせない見出しを付ける（index.html の CSP は meta なので frame-ancestors が効かない）
  expect(res.headers()['x-frame-options']).toBe('DENY');
  expect(res.headers()['content-security-policy']).toBe("frame-ancestors 'none'");
  await page.waitForTimeout(3000);
  const frame = page.frames().find((f) => f !== page.mainFrame());
  expect(frame, '枠が作られていません').toBeDefined();
  // 枠の中にアプリは出ない（ブラウザが読み込みを止める）
  expect(
    await frame!
      .locator('[data-testid="start-button"]')
      .count()
      .catch(() => 0),
  ).toBe(0);
  expect(
    await frame!
      .locator('[data-testid="parent-key"]')
      .count()
      .catch(() => 0),
  ).toBe(0);
  const status = await env.serve.status();
  expect(status.update.phase).toBe('idle');

  // 同じアドレスを直接開けば、アプリが出る（試験の道具が正しい確かめ）
  await page.goto(`${env.origin}/`);
  await expect(page.getByTestId('start-button')).toBeVisible({ timeout: 60_000 });
});

// ---------------------------------------------------------------- 許可されていないホストへの転送

test('許可されていないホストへ転送されたら、つながずに失敗する（確認も、zip の取得も）', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const foreign = await startForeign();
  const env = await makeEnv({
    configureFake: (fake) => {
      fake.redirectManifestTo = `${foreign.origin}/manifest`;
    },
  });

  await openApp(page, env);
  await openAbout(page);
  // 版の情報の転送先が許可されていない: 確認が失敗する（今の版のまま・新しい版は出ない）
  await page.getByTestId('update-check-now').click();
  await expect(page.getByTestId('update-check-status')).toContainText(
    '確かめられませんでした（配布元への接続を安全に確かめられませんでした）',
    { timeout: 30_000 },
  );
  await expect(page.getByTestId('update-available')).toHaveCount(0);
  const checked = await env.serve.status();
  expect(checked.check).toMatchObject({ state: 'error', error: { code: 'redirect-host' } });
  expect(checked.latest).toBeNull();

  // 版の情報は正しいが、zip の転送先が許可されていない: 取得せずに失敗し、元のまま
  env.fake.redirectManifestTo = null;
  env.fake.redirectDownloadsTo = `${foreign.origin}/zip`;
  const digest = treeDigest(env.sandbox.app);
  // 直前の確認から 10 秒以内の「今すぐ確かめる」は新しく確認しない（配信の決まり）ので、見つかるまで押し直す
  await expect
    .poll(
      async () => {
        await env.serve.post('check');
        return (await env.serve.status()).latest?.newer ?? false;
      },
      { timeout: 60_000, intervals: [1000] },
    )
    .toBe(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openAbout(page);
  await markPage(page);
  await page.getByTestId('update-apply').click();
  const error = page.getByTestId('update-error');
  await expect(error).toBeVisible({ timeout: 60_000 });
  await expect(error).toContainText('配布元への接続を安全に確かめられなかったため、中止しました');
  await expect(error).toContainText('いまのバージョンはそのまま使えます');
  const failed = await env.serve.status();
  expect(failed.update.error?.code).toBe('redirect-host');
  expect(installedVersion(env.sandbox.app)).toBe(OLD_VERSION);
  expect(treeDigest(env.sandbox.app)).toBe(digest);
  expect(existsSync(env.sandbox.appNext)).toBe(false);
  // 許可されていないホストへは、1 回もつないでいない
  expect(foreign.hits).toEqual([]);
  expect(await isMarked(page)).toBe(true);
});

// ---------------------------------------------------------------- 自動の確認のオン・オフ

test('自動の確認をオフにすると、起動し直しても確認の要求は来ない（押したときだけつながる）', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const env = await makeEnv();

  await openApp(page, env);
  await openAbout(page);
  const checkbox = page.getByTestId('update-autocheck');
  await expect(checkbox).toBeChecked();
  await checkbox.uncheck();
  await expect.poll(async () => (await env.serve.status()).settings.autoCheck).toBe(false);
  expect(JSON.parse(readFileSync(env.sandbox.configFile, 'utf8'))).toEqual({
    schema: 1,
    autoCheck: false,
  });

  // 起動し直しても、設定は残る。最初の確認の時刻（起動して 15 秒後）を過ぎても、確認の要求は来ない
  const requested = env.fake.manifestRequests().length;
  await env.serve.restart();
  expect((await env.serve.status()).settings.autoCheck).toBe(false);
  await page.waitForTimeout(20_000);
  expect(env.fake.manifestRequests().length).toBe(requested);

  // 押したときだけつながる
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openAbout(page);
  await expect(page.getByTestId('update-autocheck')).not.toBeChecked();
  await page.getByTestId('update-check-now').click();
  await expect.poll(() => env.fake.manifestRequests().length).toBe(requested + 1);
  await expect(page.getByTestId('update-available')).toContainText(
    `新しいバージョン ${NEW_VERSION}`,
  );

  // オンに戻すと、少しあとに自動で確かめる
  await page.getByTestId('update-autocheck').check();
  await expect.poll(async () => (await env.serve.status()).settings.autoCheck).toBe(true);
  await expect
    .poll(() => env.fake.manifestRequests().length, { timeout: 30_000 })
    .toBeGreaterThan(requested + 1);
});

// ---------------------------------------------------------------- 窓口の無い配信

test('窓口の無い配信（--dir で配る serve.py）では、更新の表示を出さず今までどおり', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const server = await startServe(fixture.old.distDir);
  closers.push(() => server.stop());

  const status = await rawRequest(server.port, 'GET', '/__manabi/update/status');
  expect(status.status).toBe(200);
  expect(JSON.parse(status.body.toString('utf8'))).toMatchObject({ supported: false });

  await openApp(page, { url: server.url });
  await openAbout(page);
  await expect(page.locator('#update-section')).toHaveCount(0);
  await expect(page.getByTestId('update-current')).toHaveCount(0);
  await expect(page.getByTestId('parent-update-notice')).toHaveCount(0);
  await expect(page.getByTestId('about-privacy')).toContainText(
    '広告・外部への通信・アカウント登録はありません',
  );
});
