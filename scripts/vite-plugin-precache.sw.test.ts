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

async function runSw(version: string, files: string[], fake: ReturnType<typeof createFakeCaches>) {
  const handlers = new Map<string, Handler>();
  const self = {
    location: { origin: 'http://127.0.0.1:1' },
    registration: { scope: SCOPE },
    clients: { matchAll: async () => [] },
    skipWaiting: async () => undefined,
    addEventListener: (type: string, fn: Handler) => handlers.set(type, fn),
  };
  const fakeFetch = async () => new Response('body');
  const code = renderServiceWorker(await transpileServiceWorker(), version, files);
  new Function('self', 'caches', 'fetch', code)(self, fake.api, fakeFetch);
  const fire = async (type: string) => {
    const waits: Promise<unknown>[] = [];
    handlers.get(type)?.({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
  };
  return { fire };
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
