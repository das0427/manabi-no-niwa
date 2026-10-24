// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderServiceWorker, transpileServiceWorker } from './vite-plugin-precache.ts';

/**
 * 生成される sw.js を、メモリ上の簡易な CacheStorage と self で実際に動かして、
 * キャッシュの整理（activate）の挙動を確認する。
 */

const SCOPE = 'http://127.0.0.1:1/';
const META_URL = `${SCOPE}__mnw-meta.json`;
const MIN = 60_000;

type Handler = (event: unknown) => void;

function createFakeCaches() {
  const store = new Map<string, Map<string, { text: string; status: number }>>();
  const cacheObject = (name: string) => ({
    async put(url: string, res: Response) {
      store.get(name)?.set(url, { text: await res.text(), status: res.status });
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
      async keys() {
        return [...store.keys()];
      },
      async match(url: string, options?: { cacheName?: string }) {
        const names = options?.cacheName ? [options.cacheName] : [...store.keys()];
        for (const n of names) {
          const hit = store.get(n)?.get(url);
          if (hit) return new Response(hit.text, { status: hit.status });
        }
        return undefined;
      },
    },
  };
}

async function runSw(
  version: string,
  files: string[],
  fake: ReturnType<typeof createFakeCaches>,
  fetchImpl: (req: Request | string) => Promise<Response> = async () => new Response('body'),
) {
  const handlers = new Map<string, Handler>();
  const self = {
    location: { origin: 'http://127.0.0.1:1' },
    registration: { scope: SCOPE },
    clients: { matchAll: async () => [] },
    skipWaiting: async () => undefined,
    addEventListener: (type: string, fn: Handler) => handlers.set(type, fn),
  };
  const code = renderServiceWorker(await transpileServiceWorker(), version, files);
  new Function('self', 'caches', 'fetch', code)(self, fake.api, fetchImpl);
  const fire = async (type: string) => {
    const waits: Promise<unknown>[] = [];
    handlers.get(type)?.({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
  };
  /** fetch イベントを送る。SW が respondWith しなければ null（ブラウザがそのままネットワークへ） */
  const request = async (path: string, headers: Record<string, string> = {}) => {
    let responded: Promise<Response> | null = null;
    handlers.get('fetch')?.({
      request: new Request(`${SCOPE}${path}`, { headers }),
      respondWith: (r: Response | Promise<Response>) => {
        responded = Promise.resolve(r);
      },
    });
    const res = responded === null ? null : await (responded as Promise<Response>);
    return res === null ? null : { status: res.status, text: await res.text() };
  };
  return { fire, request };
}

async function seed(
  fake: ReturnType<typeof createFakeCaches>,
  name: string,
  meta: Record<string, unknown> | null,
) {
  const cache = await fake.api.open(name);
  await cache.put('http://127.0.0.1:1/index.html', new Response('x'));
  if (meta)
    await cache.put(
      META_URL,
      new Response(JSON.stringify({ version: name, fileCount: 1, ...meta })),
    );
}

describe('sw.js の install / activate（キャッシュの整理）', () => {
  it('install 中は作りかけの印（pending）を先に書き、完了すると完成記録に置き換える', async () => {
    const fake = createFakeCaches();
    const sw = await runSw('cur', ['index.html'], fake);
    await sw.fire('install');
    const meta = JSON.parse(fake.store.get('mnw-cur')?.get(META_URL)?.text ?? '{}') as {
      pending?: boolean;
      version?: string;
    };
    expect(meta.version).toBe('cur');
    expect(meta.pending).toBeUndefined();
    expect([...(fake.store.get('mnw-cur')?.keys() ?? [])].sort()).toEqual(
      ['http://127.0.0.1:1/index.html', META_URL].sort(),
    );
  });

  it('install が失敗したら、その版のキャッシュは残らない', async () => {
    const fake = createFakeCaches();
    const handlers = new Map<string, Handler>();
    const self = {
      location: { origin: 'http://127.0.0.1:1' },
      registration: { scope: SCOPE },
      clients: { matchAll: async () => [] },
      skipWaiting: async () => undefined,
      addEventListener: (type: string, fn: Handler) => handlers.set(type, fn),
    };
    const failing = async () => new Response('nope', { status: 404 });
    const code = renderServiceWorker(await transpileServiceWorker(), 'bad', ['index.html']);
    new Function('self', 'caches', 'fetch', code)(self, fake.api, failing);
    const waits: Promise<unknown>[] = [];
    handlers.get('install')?.({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await expect(Promise.all(waits)).rejects.toThrow();
    expect(fake.store.has('mnw-bad')).toBe(false);
  });

  it('activate: 現在と直前の版を残し、古い版を消す。作りかけ（10分以内）と、より新しい完成版は消さない', async () => {
    const fake = createFakeCaches();
    const now = Date.now();
    await seed(fake, 'mnw-oldest', { installedAt: 100 });
    await seed(fake, 'mnw-prev', { installedAt: 500 });
    await seed(fake, 'mnw-installing-fresh', { installedAt: now - 1 * MIN, pending: true });
    await seed(fake, 'mnw-installing-stale', { installedAt: now - 11 * MIN, pending: true });
    await seed(fake, 'mnw-newer-complete', { installedAt: now + 3_600_000 });
    await seed(fake, 'mnw-no-meta', null);
    await fake.api.open('other-cache');

    const sw = await runSw('cur', ['index.html'], fake);
    await sw.fire('install');
    await sw.fire('activate');

    expect([...fake.store.keys()].sort()).toEqual(
      ['mnw-cur', 'mnw-prev', 'mnw-installing-fresh', 'mnw-newer-complete', 'other-cache'].sort(),
    );
  });

  it('教材パックのキャッシュ（mnw-pack/…）は activate で消さず、「直前の版」にも選ばない', async () => {
    const fake = createFakeCaches();
    await seed(fake, 'mnw-prev', { installedAt: 500 });
    await seed(fake, 'mnw-oldest', { installedAt: 100 });
    // 完成記録の無い・古い記録のパックのキャッシュ（コアの規則なら消える形）
    await seed(fake, 'mnw-pack/g3-sansu@aaaa', null);
    await seed(fake, 'mnw-pack/g3-kokugo@bbbb', { installedAt: 900 });
    const sw = await runSw('cur', ['index.html'], fake);
    await sw.fire('install');
    await sw.fire('activate');
    expect([...fake.store.keys()].sort()).toEqual(
      ['mnw-cur', 'mnw-prev', 'mnw-pack/g3-sansu@aaaa', 'mnw-pack/g3-kokugo@bbbb'].sort(),
    );
  });

  it('作りかけの印のキャッシュは「直前の版」にならない', async () => {
    const fake = createFakeCaches();
    await seed(fake, 'mnw-done', { installedAt: 10 });
    // install 中のキャッシュ: installedAt は開始時刻（過去でも直前の版には選ばれない）
    await seed(fake, 'mnw-building', { installedAt: Date.now() - MIN, pending: true });
    const sw = await runSw('cur', ['index.html'], fake);
    await sw.fire('install');
    await sw.fire('activate');
    expect([...fake.store.keys()].sort()).toEqual(['mnw-building', 'mnw-cur', 'mnw-done']);
  });
});

describe('sw.js の fetch（教材パック）', () => {
  const PACK_FILE = 'assets/packs/g3-sansu/g3-sansu-1.js';
  const AUDIO = 'audio/g3-sansu/q1.mp3';

  async function setup() {
    const fake = createFakeCaches();
    const net: string[] = [];
    const sw = await runSw('cur', ['index.html', 'packs.json'], fake, async (req) => {
      const url = typeof req === 'string' ? req : req.url;
      net.push(url);
      if (url.endsWith('packs.json')) {
        return new Response(
          JSON.stringify({ 'g3-sansu': { files: [PACK_FILE, AUDIO], bytes: 2, hash: 'h2' } }),
        );
      }
      return new Response(`net:${url.slice(SCOPE.length)}`);
    });
    await sw.fire('install');
    net.length = 0;
    return { fake, sw, net };
  }

  it('コアの packs.json の hash に合うパックのキャッシュから返す（他の版より優先）', async () => {
    const { fake, sw, net } = await setup();
    await (
      await fake.api.open('mnw-pack/g3-sansu@h1')
    ).put(`${SCOPE}${AUDIO}`, new Response('old'));
    await (
      await fake.api.open('mnw-pack/g3-sansu@h2')
    ).put(`${SCOPE}${AUDIO}`, new Response('new'));
    expect(await sw.request(AUDIO)).toEqual({ status: 200, text: 'new' });
    expect(net).toEqual([]);
  });

  it('合う版が無ければ他の版のパック（旧タブ用）、どこにも無ければネットワーク', async () => {
    const { fake, sw, net } = await setup();
    await (
      await fake.api.open('mnw-pack/g3-sansu@h1')
    ).put(`${SCOPE}${PACK_FILE}`, new Response('old-chunk'));
    expect(await sw.request(PACK_FILE)).toEqual({ status: 200, text: 'old-chunk' });
    expect(await sw.request(AUDIO)).toEqual({ status: 200, text: `net:${AUDIO}` });
    expect(net).toEqual([`${SCOPE}${AUDIO}`]);
  });

  it('X-Mnw-Pack-Download: 1 の要求（パックの取得）はキャッシュを通さない（respondWith しない）', async () => {
    const { fake, sw } = await setup();
    await (
      await fake.api.open('mnw-pack/g3-sansu@h2')
    ).put(`${SCOPE}${AUDIO}`, new Response('new'));
    expect(await sw.request(AUDIO, { 'X-Mnw-Pack-Download': '1' })).toBeNull();
    expect(await sw.request('index.html', { 'X-Mnw-Pack-Download': '1' })).toBeNull();
    expect(await sw.request('index.html')).toMatchObject({ status: 200 });
  });
});
