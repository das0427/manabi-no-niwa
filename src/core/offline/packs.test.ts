import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runTx, r, STORE } from '../storage/db';
import { deleteAllData, openStorage } from '../storage/index';
import {
  __testing,
  computePackHash,
  computePackStatuses,
  deletePackFiles,
  downloadPackFiles,
  downloadPackList,
  getPackError,
  packCacheName,
  packFileUrl,
  parsePackCacheName,
  readAllPackMeta,
  reconcilePacks,
  PackDownloadError,
  type PackIndex,
  type PackProgress,
} from './packs';

/** 'a' = "A", 'b' = "B" のパックのハッシュ（scripts/vite-plugin-precache.ts の packHash と同じ値） */
const HASH_AB = 'cdc907f4882337ec';

// ---------------------------------------------------------------- 簡易な CacheStorage と fetch

type Stored = { body: ArrayBuffer; headers: Headers; status: number };

function createCaches() {
  const store = new Map<string, Map<string, Stored>>();
  const cacheObject = (name: string) => ({
    async put(url: string, res: Response) {
      const body = await res.arrayBuffer();
      store.get(name)?.set(url, { body, headers: res.headers, status: res.status });
    },
    async match(url: string) {
      const hit = store.get(name)?.get(url);
      return hit ? new Response(hit.body.slice(0), { status: hit.status }) : undefined;
    },
    async keys() {
      return [...(store.get(name)?.keys() ?? [])].map((u) => new Request(u));
    },
  });
  return {
    store,
    api: {
      async open(name: string) {
        if (!store.has(name)) store.set(name, new Map());
        return cacheObject(name);
      },
      async delete(name: string) {
        return store.delete(name);
      },
      async has(name: string) {
        return store.has(name);
      },
      async keys() {
        return [...store.keys()];
      },
    },
  };
}

let fakeCaches: ReturnType<typeof createCaches>;
/** 配信元のファイル（パス → 内容）。null は 404 */
let server: Map<string, string | null>;
let online = true;
const requests: { url: string; header: string | null; cache: string }[] = [];

function serve(index: PackIndex, files: Record<string, string | null>): void {
  server = new Map(Object.entries(files));
  server.set('packs.json', JSON.stringify(index));
}

function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const req = input instanceof Request ? input : new Request(String(input), init);
  requests.push({
    url: req.url,
    header: req.headers.get('X-Mnw-Pack-Download'),
    cache: req.cache,
  });
  if (!online) return Promise.reject(new TypeError('Failed to fetch'));
  const path = new URL(req.url).pathname.replace(/^\//, '');
  const body = server.get(path);
  if (body === undefined || body === null)
    return Promise.resolve(new Response('not found', { status: 404 }));
  return Promise.resolve(
    new Response(body, { status: 200, headers: { 'Content-Type': 'text/plain' } }),
  );
}

async function cachedText(name: string, path: string): Promise<string | null> {
  const hit = fakeCaches.store.get(name)?.get(packFileUrl(path));
  return hit ? new TextDecoder().decode(hit.body) : null;
}

const INDEX_V1: PackIndex = {
  'g1-math': { files: ['a', 'b'], bytes: 2, hash: HASH_AB },
};

beforeEach(async () => {
  __testing.reset();
  fakeCaches = createCaches();
  online = true;
  requests.length = 0;
  vi.stubGlobal('caches', fakeCaches.api);
  vi.stubGlobal('fetch', fakeFetch);
  serve(INDEX_V1, { a: 'A', b: 'B' });
  await openStorage();
  await deleteAllData();
  await runTx([STORE.packsMeta], 'readwrite', (tx) => {
    tx.objectStore(STORE.packsMeta).clear();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('キャッシュ名', () => {
  it('mnw-pack/<packId>@<hash> を作り、@ で分解する', () => {
    expect(packCacheName('g3-sansu', 'abc')).toBe('mnw-pack/g3-sansu@abc');
    expect(parsePackCacheName('mnw-pack/g3-sansu@abc')).toEqual({
      packId: 'g3-sansu',
      hash: 'abc',
    });
    expect(parsePackCacheName('mnw-abc')).toBeNull();
    expect(parsePackCacheName('mnw-pack/x@')).toBeNull();
  });
});

describe('computePackHash', () => {
  it('ビルド側の packHash と同じ値（パス順・sha256）', async () => {
    const sha = async (s: string) =>
      [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    expect(
      await computePackHash([
        { path: 'b', hash: await sha('B') },
        { path: 'a', hash: await sha('A') },
      ]),
    ).toBe(HASH_AB);
  });
});

describe('取得・状態・削除', () => {
  it('取得 → キャッシュ mnw-pack/<id>@<hash> と packsMeta に記録 → ready。要求は SW を通さない印付き', async () => {
    expect((await computePackStatuses([]))[0]).toMatchObject({
      packId: 'g1-math',
      state: 'not-downloaded',
      bytes: 2,
    });
    const seen: PackProgress[] = [];
    await downloadPackFiles('g1-math', (p) => seen.push(p));
    const name = packCacheName('g1-math', HASH_AB);
    expect(await cachedText(name, 'a')).toBe('A');
    expect(await cachedText(name, 'b')).toBe('B');
    const meta = (await readAllPackMeta())?.get('g1-math');
    expect(meta).toMatchObject({ packId: 'g1-math', hash: HASH_AB, bytes: 2, fileCount: 2 });
    expect((await computePackStatuses([]))[0]?.state).toBe('ready');
    expect(seen.at(-1)).toMatchObject({ doneFiles: 2, totalFiles: 2, doneBytes: 2, totalBytes: 2 });
    const fileReqs = requests.filter((q) => !q.url.endsWith('packs.json'));
    expect(fileReqs.every((q) => q.header === '1' && q.cache === 'reload')).toBe(true);
  });

  it('取得済みなら取り直さない', async () => {
    await downloadPackFiles('g1-math');
    requests.length = 0;
    await downloadPackFiles('g1-math');
    expect(requests.filter((q) => !q.url.endsWith('packs.json'))).toEqual([]);
  });

  it('内容が packs.json の hash と合わなければ mismatch で失敗し、作りかけを残さない', async () => {
    serve(INDEX_V1, { a: 'A', b: 'X' });
    await expect(downloadPackFiles('g1-math')).rejects.toMatchObject({ reason: 'mismatch' });
    expect(getPackError('g1-math')).toBe('mismatch');
    expect([...fakeCaches.store.keys()]).toEqual([]);
    expect((await readAllPackMeta())?.size).toBe(0);
  });

  it('配信元に無い（404）は not-found、つながらないのは offline', async () => {
    serve(INDEX_V1, { a: 'A', b: null });
    await expect(downloadPackFiles('g1-math')).rejects.toMatchObject({ reason: 'not-found' });
    __testing.reset();
    serve(INDEX_V1, { a: 'A', b: 'B' });
    await computePackStatuses([]); // packs.json を先に読んでおく
    online = false;
    const err = await downloadPackFiles('g1-math').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PackDownloadError);
    expect((err as PackDownloadError).reason).toBe('offline');
    expect([...fakeCaches.store.keys()]).toEqual([]);
  });

  it('packs.json の hash が変わると outdated。再取得に失敗しても旧パックは残り、成功すると入れ替わる', async () => {
    await downloadPackFiles('g1-math');
    const oldName = packCacheName('g1-math', HASH_AB);

    // コアの更新（新しいページ）: パックの内容が変わった
    __testing.reset();
    const v2Files = { a: 'A2', b: 'B' };
    const sha = async (s: string) =>
      [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    const h2 = (await computePackHash([
      { path: 'a', hash: await sha('A2') },
      { path: 'b', hash: await sha('B') },
    ]))!;
    const v2: PackIndex = { 'g1-math': { files: ['a', 'b'], bytes: 3, hash: h2 } };
    serve(v2, { a: null, b: 'B' }); // 1回目は失敗する配信
    expect((await computePackStatuses([]))[0]?.state).toBe('outdated');

    await expect(downloadPackFiles('g1-math')).rejects.toBeInstanceOf(PackDownloadError);
    expect([...fakeCaches.store.keys()]).toEqual([oldName]);
    expect(await cachedText(oldName, 'a')).toBe('A');
    expect((await computePackStatuses([]))[0]?.state).toBe('outdated');

    serve(v2, v2Files);
    __testing.reset();
    await downloadPackFiles('g1-math');
    expect([...fakeCaches.store.keys()]).toEqual([packCacheName('g1-math', h2)]);
    expect((await computePackStatuses([]))[0]?.state).toBe('ready');
    expect((await readAllPackMeta())?.get('g1-math')?.hash).toBe(h2);
  });

  it('削除: パックのキャッシュと取得記録だけを消し、学習の記録は残す', async () => {
    await downloadPackFiles('g1-math');
    await runTx([STORE.unitProgress], 'readwrite', (tx) => {
      tx.objectStore(STORE.unitProgress).put({ profileId: 'p1', unitId: 'g1.math.add', step: 2 });
    });
    await fakeCaches.api.open('mnw-core1');
    await deletePackFiles('g1-math');
    expect([...fakeCaches.store.keys()]).toEqual(['mnw-core1']);
    expect((await readAllPackMeta())?.size).toBe(0);
    expect((await computePackStatuses([]))[0]?.state).toBe('not-downloaded');
    const rows = await runTx([STORE.unitProgress], 'readonly', (tx) =>
      r(tx.objectStore(STORE.unitProgress).getAll()),
    );
    expect(rows).toHaveLength(1);
  });

  it('記録があってもキャッシュが無ければ未取得', async () => {
    await downloadPackFiles('g1-math');
    await fakeCaches.api.delete(packCacheName('g1-math', HASH_AB));
    expect((await computePackStatuses([]))[0]?.state).toBe('not-downloaded');
  });

  it('downloadPackList は失敗しても次へ進み、失敗をまとめて返す', async () => {
    serve(
      {
        'g1-math': INDEX_V1['g1-math']!,
        'g2-math': { files: ['c'], bytes: 1, hash: 'ffff' },
      },
      { a: 'A', b: 'B', c: 'C' },
    );
    const failed = await downloadPackList(['g2-math', 'g1-math', 'nope']);
    expect(failed).toEqual([
      { packId: 'g2-math', reason: 'mismatch' },
      { packId: 'nope', reason: 'unknown-pack' },
    ]);
    expect((await computePackStatuses([])).find((s) => s.packId === 'g1-math')?.state).toBe(
      'ready',
    );
  });

  it('packs.json に載らないパック（コア同梱）は core。packs.json が読めなければ unavailable', async () => {
    expect((await computePackStatuses(['p4'])).find((s) => s.packId === 'p4')?.state).toBe('core');
    __testing.reset();
    server.delete('packs.json');
    expect((await computePackStatuses(['p4'])).every((s) => s.state === 'unavailable')).toBe(true);
  });
});

describe('reconcilePacks（起動時の整理）', () => {
  it('packs.json に無いパックのキャッシュと記録を消し、記録と合わない残骸も消す。コアのキャッシュには触れない', async () => {
    await downloadPackFiles('g1-math');
    // 消えたパック（記録あり）、記録と合わない残骸、コアのキャッシュ
    await fakeCaches.api.open('mnw-pack/old-pack@1234');
    await runTx([STORE.packsMeta], 'readwrite', (tx) => {
      tx.objectStore(STORE.packsMeta).put({
        packId: 'old-pack',
        hash: '1234',
        bytes: 1,
        fileCount: 1,
        downloadedAt: 1,
      });
    });
    await fakeCaches.api.open('mnw-pack/g1-math@stale');
    await fakeCaches.api.open('mnw-abcdef');
    await reconcilePacks();
    expect([...fakeCaches.store.keys()].sort()).toEqual(
      ['mnw-abcdef', packCacheName('g1-math', HASH_AB)].sort(),
    );
    expect([...((await readAllPackMeta())?.keys() ?? [])]).toEqual(['g1-math']);
  });

  it('記録だけ消えた（キャッシュはコアに合う版）ときは記録を作り直す', async () => {
    await downloadPackFiles('g1-math');
    await runTx([STORE.packsMeta], 'readwrite', (tx) => {
      tx.objectStore(STORE.packsMeta).clear();
    });
    await reconcilePacks();
    expect((await readAllPackMeta())?.get('g1-math')?.hash).toBe(HASH_AB);
    expect((await computePackStatuses([]))[0]?.state).toBe('ready');
  });

  it('版の古いパック（記録と同じ版）は残す（再取得まで消さない）', async () => {
    await downloadPackFiles('g1-math');
    __testing.reset();
    serve({ 'g1-math': { files: ['a', 'b'], bytes: 2, hash: 'newer' } }, { a: 'A', b: 'B' });
    await reconcilePacks();
    expect([...fakeCaches.store.keys()]).toEqual([packCacheName('g1-math', HASH_AB)]);
    expect((await computePackStatuses([]))[0]?.state).toBe('outdated');
  });
});
