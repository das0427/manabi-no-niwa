/**
 * まなびのにわ Service Worker（ソース）。
 *
 * ビルド時に scripts/vite-plugin-precache.ts が次の 2 つの定数を先頭に付けて dist/sw.js を作る:
 *   __MNW_VERSION__ : 版ID（dist の全ファイルの内容ハッシュ + このソースのハッシュ）
 *   __MNW_FILES__   : プリキャッシュするファイルの一覧（sw.js 自身と .map を除く。scope からの相対パス）
 * このファイルは import を持たない 1 ファイルとして変換される（型の import は除去される）。
 *
 * 方針（docs/architecture.md 7章）:
 *  - install: 版ごとのキャッシュ `mnw-<版ID>` に全件を取得。1 件でも失敗したら install 失敗（半端な版を使わない）
 *  - activate: 現在と「直前の版」以外の `mnw-*` を削除。clients.claim() は使わない
 *  - fetch: 同一オリジンの GET のみ。現在の版 → 直前の版 → ネットワーク。ナビゲーションは index.html
 *  - message: SKIP_WAITING / GET_VERSION
 */
import type { ClientToSwMessage, PrecacheProgressMessage, VersionReplyMessage } from './protocol';

declare const __MNW_VERSION__: string;
declare const __MNW_FILES__: readonly string[];

// DOM ライブラリと WebWorker ライブラリは同時に使えないため、必要な分だけの型をここで定義する。
interface SwExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}
interface SwFetchEvent extends SwExtendableEvent {
  readonly request: Request;
  respondWith(response: Response | Promise<Response>): void;
}
interface SwMessageEvent extends SwExtendableEvent {
  readonly data: unknown;
  readonly ports: readonly MessagePort[];
  readonly source: { postMessage(message: unknown): void } | null;
}
interface SwClientLike {
  postMessage(message: unknown): void;
}
interface SwScope {
  readonly location: { readonly origin: string };
  readonly registration: { readonly scope: string };
  readonly clients: {
    matchAll(options: {
      includeUncontrolled: boolean;
      type: 'window';
    }): Promise<readonly SwClientLike[]>;
  };
  skipWaiting(): Promise<void>;
  addEventListener(
    type: 'install' | 'activate',
    listener: (event: SwExtendableEvent) => void,
  ): void;
  addEventListener(type: 'fetch', listener: (event: SwFetchEvent) => void): void;
  addEventListener(type: 'message', listener: (event: SwMessageEvent) => void): void;
}

const sw = self as unknown as SwScope;

const VERSION: string = __MNW_VERSION__;
const FILES: readonly string[] = __MNW_FILES__;
const CACHE_PREFIX = 'mnw-';
const CACHE_NAME = CACHE_PREFIX + VERSION;
/** 版のキャッシュが完成したことを示す記録（最後に書く）。「直前の版」の判定にも使う */
const META_PATH = '__mnw-meta.json';
const CONCURRENCY = 6;
const FETCH_ATTEMPTS = 2;
const PROGRESS_INTERVAL_MS = 80;

interface CacheMeta {
  version: string;
  installedAt: number;
  fileCount: number;
}

function scopeUrl(path: string): string {
  return new URL(path, sw.registration.scope).href;
}

async function broadcast(message: PrecacheProgressMessage): Promise<void> {
  try {
    const clients = await sw.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    for (const client of clients) client.postMessage(message);
  } catch {
    // 画面への通知は失敗しても準備そのものには影響しない
  }
}

async function fetchToCache(cache: Cache, path: string): Promise<void> {
  const url = scopeUrl(path);
  let lastError: unknown = null;
  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt++) {
    try {
      // HTTP キャッシュに古いものが残っていても使わない
      const response = await fetch(new Request(url, { cache: 'reload' }));
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`);
      await cache.put(url, response);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`取得に失敗: ${path}`);
}

async function precacheAll(): Promise<void> {
  await caches.delete(CACHE_NAME);
  const cache = await caches.open(CACHE_NAME);
  const total = FILES.length;
  let done = 0;
  let next = 0;
  let failure: unknown = null;
  let lastPost = 0;

  await broadcast({ type: 'precache-progress', done: 0, total });

  const worker = async (): Promise<void> => {
    while (failure === null) {
      const index = next++;
      const path = FILES[index];
      if (path === undefined) return;
      try {
        await fetchToCache(cache, path);
      } catch (error) {
        failure = error ?? new Error('unknown');
        return;
      }
      done++;
      const now = Date.now();
      if (now - lastPost >= PROGRESS_INTERVAL_MS) {
        lastPost = now;
        void broadcast({ type: 'precache-progress', done, total });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));
  if (failure !== null) throw failure;

  const meta: CacheMeta = { version: VERSION, installedAt: Date.now(), fileCount: total };
  await cache.put(
    scopeUrl(META_PATH),
    new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }),
  );
  await broadcast({ type: 'precache-progress', done: total, total });
}

async function readMeta(cacheName: string): Promise<CacheMeta | null> {
  try {
    const response = await caches.match(scopeUrl(META_PATH), { cacheName });
    if (!response) return null;
    const meta = (await response.json()) as Partial<CacheMeta>;
    if (typeof meta.version !== 'string' || typeof meta.installedAt !== 'number') return null;
    return {
      version: meta.version,
      installedAt: meta.installedAt,
      fileCount: Number(meta.fileCount ?? 0),
    };
  } catch {
    return null;
  }
}

/** 「直前の版」= 自分より前に完成した版のうち、最も新しいもの */
async function findPreviousName(): Promise<string | null> {
  const mine = await readMeta(CACHE_NAME);
  if (!mine) return null;
  const names = (await caches.keys()).filter((n) => n.startsWith(CACHE_PREFIX) && n !== CACHE_NAME);
  let best: { name: string; at: number } | null = null;
  for (const name of names) {
    const meta = await readMeta(name);
    if (
      meta &&
      meta.installedAt < mine.installedAt &&
      (best === null || meta.installedAt > best.at)
    ) {
      best = { name, at: meta.installedAt };
    }
  }
  return best ? best.name : null;
}

let previousNamePromise: Promise<string | null> | null = null;
function getPreviousName(): Promise<string | null> {
  previousNamePromise ??= findPreviousName().catch(() => null);
  return previousNamePromise;
}

/** 現在の版と直前の版だけを残す。未完成（記録なし）のキャッシュや、より新しい版・古い版は消す */
async function cleanupCaches(): Promise<void> {
  const previous = await findPreviousName();
  const names = (await caches.keys()).filter((n) => n.startsWith(CACHE_PREFIX));
  await Promise.all(
    names.filter((n) => n !== CACHE_NAME && n !== previous).map((n) => caches.delete(n)),
  );
  previousNamePromise = Promise.resolve(previous);
}

const MATCH_OPTIONS = { ignoreSearch: true, ignoreVary: true } as const;

async function lookup(url: string): Promise<Response | undefined> {
  try {
    // caches.match + cacheName は、消えたキャッシュを空で作り直さない
    const current = await caches.match(url, { ...MATCH_OPTIONS, cacheName: CACHE_NAME });
    if (current) return current;
    const previous = await getPreviousName();
    if (previous) return await caches.match(url, { ...MATCH_OPTIONS, cacheName: previous });
  } catch {
    // キャッシュが読めないときはネットワークへ
  }
  return undefined;
}

/** 音声などの Range 要求に、キャッシュした全体から 206 で答える */
async function applyRange(request: Request, response: Response): Promise<Response> {
  const header = request.headers.get('range');
  if (!header || response.status !== 200) return response;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return response;
  const body = await response.arrayBuffer();
  const size = body.byteLength;
  let start: number;
  let end: number;
  if (m[1] === '') {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (!(start <= end) || start >= size) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  const headers = new Headers(response.headers);
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  headers.set('Accept-Ranges', 'bytes');
  return new Response(body.slice(start, end + 1), { status: 206, headers });
}

/** index.html を返してよいナビゲーションか（ファイルを直接開く操作や /__manabi/ は除く） */
function isAppRoute(url: URL): boolean {
  const scopePath = new URL(sw.registration.scope).pathname;
  const rel = url.pathname.startsWith(scopePath)
    ? url.pathname.slice(scopePath.length)
    : url.pathname;
  return rel === '' || rel === 'index.html' || (!rel.includes('.') && !rel.startsWith('__'));
}

async function respond(request: Request, url: URL): Promise<Response> {
  const cached = await lookup(url.href);
  if (cached) return applyRange(request, cached);
  if (request.mode === 'navigate' && isAppRoute(url)) {
    const index = await lookup(scopeUrl('index.html'));
    if (index) return index;
  }
  return fetch(request);
}

sw.addEventListener('install', (event) => {
  event.waitUntil(
    precacheAll().catch(async (error: unknown) => {
      // 中途半端な版を残さない（install 失敗にする）
      await caches.delete(CACHE_NAME);
      throw error;
    }),
  );
});

sw.addEventListener('activate', (event) => {
  // 開いている画面を途中で新版に切り替えないため、clients の claim は呼ばない
  event.waitUntil(cleanupCaches());
});

sw.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== sw.location.origin) return;
  if (!url.href.startsWith(sw.registration.scope)) return;
  event.respondWith(respond(request, url));
});

function isClientMessage(data: unknown): data is ClientToSwMessage {
  if (typeof data !== 'object' || data === null) return false;
  const type = (data as { type?: unknown }).type;
  return type === 'SKIP_WAITING' || type === 'GET_VERSION';
}

sw.addEventListener('message', (event) => {
  const data = event.data;
  if (!isClientMessage(data)) return;
  if (data.type === 'SKIP_WAITING') {
    event.waitUntil(sw.skipWaiting());
    return;
  }
  const reply: VersionReplyMessage = { type: 'version', version: VERSION };
  const port = event.ports[0];
  if (port) port.postMessage(reply);
  else event.source?.postMessage(reply);
});
