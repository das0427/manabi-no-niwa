/**
 * 教材パックの取得・削除・版の照合（docs/expansion/architecture.md 6.3、design-review-1 #4 #20 #26）。
 *
 * - コアの dist/packs.json（`{ [packId]: { files, bytes, hash } }`）が「このコアに合うパックの版」の正本。
 *   ページの寿命の間は最初に読んだものを使う（途中で別の版の packs.json に変わらない）。
 * - 取得したパックはキャッシュ `mnw-pack/<packId>@<hash>` に入れ、IndexedDB の packsMeta に記録する。
 *   このキャッシュは Service Worker の cleanupCaches の対象外（src/sw/sw.ts）。
 * - 取得はページから Cache API で行う。要求に X-Mnw-Pack-Download を付け、SW のキャッシュを通さず配信元から取る。
 *   取得後に内容の sha256 から packs.json と同じ計算でハッシュを作って照合する（配信元の版が違えば失敗）。
 * - 失敗しても旧パックのキャッシュは消さない。成功したら packsMeta を更新してから旧キャッシュを消す。
 * - 起動時（reconcilePacks）: packs.json に無いパックのキャッシュと記録を消す。記録と合わない残骸も消す。
 *
 * 記録（学習の記録）は消さない。packsMeta は「教材の取得記録」で、バックアップや「すべて消す」の対象外。
 */
import { runTx, r, STORE } from '../storage/db';

export const PACK_CACHE_PREFIX = 'mnw-pack/';
export const PACKS_INDEX_PATH = 'packs.json';
/** SW に「キャッシュを通さず配信元から取る」ことを伝える要求ヘッダー（src/sw/sw.ts と同じ名前） */
export const PACK_DOWNLOAD_HEADER = 'X-Mnw-Pack-Download';

const CONCURRENCY = 4;
const FETCH_ATTEMPTS = 2;

export interface PackIndexEntry {
  files: string[];
  bytes: number;
  hash: string;
}
export type PackIndex = Record<string, PackIndexEntry>;

/** IndexedDB の packsMeta の1件（keyPath 'packId'） */
export interface PackMetaRecord {
  packId: string;
  /** 取得した版（packs.json の hash） */
  hash: string;
  bytes: number;
  fileCount: number;
  /** 取得を終えた時刻（ms） */
  downloadedAt: number;
}

/**
 * パックの状態:
 *  - 'core'           : コアに同梱（幼児のパック。packs.json に載らない）。取得不要
 *  - 'ready'          : 取得済みで、版がコアと合っている
 *  - 'outdated'       : 取得済みだが版が違う（コアの更新後）。単元は開かない。再取得が必要
 *  - 'not-downloaded' : 未取得
 *  - 'unavailable'    : packs.json を読めない（開発サーバー、またはオフラインの準備前）
 */
export type PackState = 'core' | 'ready' | 'outdated' | 'not-downloaded' | 'unavailable';

export interface PackStatus {
  packId: string;
  state: PackState;
  /** packs.json の大きさ（コア同梱は 0） */
  bytes: number;
  fileCount: number;
  /** コアに合う版（packs.json の hash） */
  hash: string | null;
  /** 取得の記録（取得済みのとき） */
  downloaded: PackMetaRecord | null;
}

export interface PackProgress {
  packId: string;
  doneFiles: number;
  totalFiles: number;
  doneBytes: number;
  totalBytes: number;
}

export type PackDownloadFailure =
  'offline' | 'not-found' | 'mismatch' | 'quota' | 'unknown-pack' | 'unsupported' | 'error';

export class PackDownloadError extends Error {
  readonly reason: PackDownloadFailure;
  readonly packId: string;
  constructor(packId: string, reason: PackDownloadFailure, detail?: string) {
    super(`教材パック ${packId} を取得できませんでした（${reason}${detail ? `: ${detail}` : ''}）`);
    this.name = 'PackDownloadError';
    this.packId = packId;
    this.reason = reason;
  }
}

export function packCacheName(packId: string, hash: string): string {
  return `${PACK_CACHE_PREFIX}${packId}@${hash}`;
}

/** `mnw-pack/<packId>@<hash>` を分解する（'@' は packId に使わない: R#26） */
export function parsePackCacheName(name: string): { packId: string; hash: string } | null {
  if (!name.startsWith(PACK_CACHE_PREFIX)) return null;
  const rest = name.slice(PACK_CACHE_PREFIX.length);
  const at = rest.lastIndexOf('@');
  if (at <= 0 || at === rest.length - 1) return null;
  return { packId: rest.slice(0, at), hash: rest.slice(at + 1) };
}

function hasCaches(): boolean {
  return typeof caches !== 'undefined';
}

function baseUrl(): string {
  return typeof document !== 'undefined' ? document.baseURI : 'http://localhost/';
}

export function packFileUrl(path: string): string {
  return new URL(path, baseUrl()).href;
}

// ---------------------------------------------------------------- 変化の通知（保護者画面の表示用）

const listeners = new Set<() => void>();
let seq = 0;

function emit(): void {
  seq++;
  for (const cb of [...listeners]) {
    try {
      cb();
    } catch {
      /* 購読側の失敗は無視 */
    }
  }
}

/** パックの状態・取得の進み具合が変わったら呼ばれる。戻り値で解除 */
export function subscribePacks(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** 変化のたびに増える番号（useSyncExternalStore 用） */
export function getPacksSeq(): number {
  return seq;
}

// ---------------------------------------------------------------- packs.json

let indexPromise: Promise<PackIndex | null> | null = null;

function isPackIndex(v: unknown): v is PackIndex {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  return Object.values(v as Record<string, unknown>).every((e) => {
    const x = e as Partial<PackIndexEntry> | null;
    return (
      typeof x === 'object' &&
      x !== null &&
      Array.isArray(x.files) &&
      x.files.every((f) => typeof f === 'string') &&
      typeof x.bytes === 'number' &&
      typeof x.hash === 'string'
    );
  });
}

async function fetchIndex(): Promise<PackIndex | null> {
  try {
    const res = await fetch(packFileUrl(PACKS_INDEX_PATH), { cache: 'no-store' });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return isPackIndex(data) ? data : null;
  } catch {
    return null;
  }
}

/**
 * このコアの packs.json。読めたものはページの寿命の間そのまま使う（読めなかったときは次回また試す）。
 * 開発サーバーやテストでは null。
 */
export function getPackIndex(): Promise<PackIndex | null> {
  if (!indexPromise) {
    const p = fetchIndex();
    indexPromise = p;
    void p.then((v) => {
      if (v === null && indexPromise === p) indexPromise = null;
    });
  }
  return indexPromise;
}

// ---------------------------------------------------------------- packsMeta（IndexedDB）

/** すべての取得記録。保存が使えないときは null */
export async function readAllPackMeta(): Promise<Map<string, PackMetaRecord> | null> {
  try {
    const all = await runTx([STORE.packsMeta], 'readonly', (tx) =>
      r(tx.objectStore(STORE.packsMeta).getAll() as IDBRequest<PackMetaRecord[]>),
    );
    return new Map(all.map((m) => [m.packId, m]));
  } catch {
    return null;
  }
}

async function writePackMeta(meta: PackMetaRecord): Promise<boolean> {
  try {
    await runTx([STORE.packsMeta], 'readwrite', (tx) => {
      tx.objectStore(STORE.packsMeta).put(meta);
    });
    return true;
  } catch {
    return false;
  }
}

async function deletePackMeta(packId: string): Promise<void> {
  try {
    await runTx([STORE.packsMeta], 'readwrite', (tx) => {
      tx.objectStore(STORE.packsMeta).delete(packId);
    });
  } catch {
    /* 保存が使えないときは記録が無いのと同じ */
  }
}

async function packCacheNames(): Promise<{ name: string; packId: string; hash: string }[]> {
  if (!hasCaches()) return [];
  try {
    return (await caches.keys())
      .map((name) => ({ name, parsed: parsePackCacheName(name) }))
      .filter((x): x is { name: string; parsed: { packId: string; hash: string } } => !!x.parsed)
      .map((x) => ({ name: x.name, ...x.parsed }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------- 状態

/**
 * 取得済みの版。packsMeta の記録があり、そのキャッシュが残っていれば記録を返す。
 * 保存（IndexedDB）が使えないときは、キャッシュの名前から推定する。
 */
async function downloadedOf(
  packId: string,
  metas: Map<string, PackMetaRecord> | null,
  names: { packId: string; hash: string }[],
): Promise<PackMetaRecord | null> {
  if (metas) {
    const meta = metas.get(packId) ?? null;
    if (!meta) return null;
    return names.some((n) => n.packId === packId && n.hash === meta.hash) ? meta : null;
  }
  const found = names.find((n) => n.packId === packId);
  return found ? { packId, hash: found.hash, bytes: 0, fileCount: 0, downloadedAt: 0 } : null;
}

function stateOf(entry: PackIndexEntry | undefined, downloaded: PackMetaRecord | null): PackState {
  if (!entry) return 'core';
  if (!downloaded) return 'not-downloaded';
  return downloaded.hash === entry.hash ? 'ready' : 'outdated';
}

/**
 * パックの状態をまとめて求める。packIds に packs.json のパックを加えた全部を返す（packs.json の順、残りは名前順）。
 * packs.json が読めないときは、すべて 'unavailable'（ただし取得記録は返す）。
 */
export async function computePackStatuses(packIds: readonly string[]): Promise<PackStatus[]> {
  const index = await getPackIndex();
  const metas = await readAllPackMeta();
  const names = await packCacheNames();
  const ids = [...new Set([...Object.keys(index ?? {}), ...packIds])].sort();
  const out: PackStatus[] = [];
  for (const packId of ids) {
    const entry = index?.[packId];
    const downloaded = await downloadedOf(packId, metas, names);
    out.push({
      packId,
      state: index ? stateOf(entry, downloaded) : 'unavailable',
      bytes: entry?.bytes ?? 0,
      fileCount: entry?.files.length ?? 0,
      hash: entry?.hash ?? null,
      downloaded,
    });
  }
  return out;
}

// ---------------------------------------------------------------- 取得

async function sha256Hex(data: BufferSource | string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const digest = await subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** packs.json の hash と同じ計算（scripts/vite-plugin-precache.ts の packHash）。計算できなければ null */
export async function computePackHash(
  files: readonly { path: string; hash: string | null }[],
): Promise<string | null> {
  if (files.some((f) => f.hash === null)) return null;
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const full = await sha256Hex(sorted.map((f) => `${f.path}\0${f.hash ?? ''}\n`).join(''));
  return full ? full.slice(0, 16) : null;
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function classify(error: unknown): PackDownloadFailure {
  const name = (error as { name?: unknown } | null)?.name;
  if (name === 'QuotaExceededError') return 'quota';
  if (isOffline() || error instanceof TypeError) return 'offline';
  return 'error';
}

async function fetchFile(
  packId: string,
  path: string,
): Promise<{ body: ArrayBuffer; headers: Headers }> {
  let last: unknown = null;
  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(
        new Request(packFileUrl(path), {
          cache: 'reload',
          headers: { [PACK_DOWNLOAD_HEADER]: '1' },
        }),
      );
    } catch (e) {
      last = e;
      continue;
    }
    if (res.status === 404) throw new PackDownloadError(packId, 'not-found', path);
    if (!res.ok) {
      last = new PackDownloadError(packId, 'error', `HTTP ${res.status}: ${path}`);
      continue;
    }
    return { body: await res.arrayBuffer(), headers: res.headers };
  }
  if (last instanceof PackDownloadError) throw last;
  throw new PackDownloadError(packId, classify(last), path);
}

interface DownloadEntry {
  progress: PackProgress;
  promise: Promise<void>;
}
const inflight = new Map<string, DownloadEntry>();
const lastErrors = new Map<string, PackDownloadFailure>();

/** 取得中のパックの進み具合（取得中でなければ null） */
export function getPackProgress(packId: string): PackProgress | null {
  return inflight.get(packId)?.progress ?? null;
}

/** 直前の取得の失敗（成功・削除で消える） */
export function getPackError(packId: string): PackDownloadFailure | null {
  return lastErrors.get(packId) ?? null;
}

async function doDownload(
  packId: string,
  entry: PackIndexEntry,
  progress: PackProgress,
  onProgress: (p: PackProgress) => void,
): Promise<void> {
  const name = packCacheName(packId, entry.hash);
  await caches.delete(name);
  let cache: Cache;
  try {
    cache = await caches.open(name);
  } catch (e) {
    throw new PackDownloadError(packId, classify(e));
  }
  const hashes = new Map<string, string | null>();
  let next = 0;
  let failure: unknown = null;
  const report = () => {
    onProgress({ ...progress });
    emit();
  };
  const worker = async (): Promise<void> => {
    while (failure === null) {
      const path = entry.files[next++];
      if (path === undefined) return;
      try {
        const { body, headers } = await fetchFile(packId, path);
        hashes.set(path, await sha256Hex(body));
        await cache.put(
          packFileUrl(path),
          // 写すのは content-type だけ（圧縮配信の content-encoding / content-length を写すと、
          // 復号済みの本文と食い違う: コードレビュー #11）
          new Response(body, {
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': headers.get('content-type') ?? 'application/octet-stream' },
          }),
        );
        progress.doneFiles++;
        progress.doneBytes += body.byteLength;
        report();
      } catch (e) {
        failure = e ?? new Error('unknown');
      }
    }
  };
  try {
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, Math.max(1, entry.files.length)) }, worker),
    );
    if (failure !== null) {
      throw failure instanceof PackDownloadError
        ? failure
        : new PackDownloadError(packId, classify(failure));
    }
    const got = await computePackHash(
      entry.files.map((path) => ({ path, hash: hashes.get(path) ?? null })),
    );
    // 計算できない環境（crypto.subtle が無い）では照合を省く
    if (got !== null && got !== entry.hash) throw new PackDownloadError(packId, 'mismatch');
  } catch (e) {
    // 作りかけの新しいキャッシュだけを消す（旧パックのキャッシュは残す）
    await caches.delete(name).catch(() => undefined);
    throw e;
  }
  await writePackMeta({
    packId,
    hash: entry.hash,
    bytes: entry.bytes,
    fileCount: entry.files.length,
    downloadedAt: Date.now(),
  });
  // 新しい版がそろってから、同じパックの他の版を消す
  for (const old of await packCacheNames()) {
    if (old.packId === packId && old.name !== name)
      await caches.delete(old.name).catch(() => false);
  }
}

/**
 * パックを取得する（バックグラウンドで進めてよい。同じパックの取得が進行中ならそれを待つ）。
 * 既にコアに合う版を取得済みなら何もしない。失敗は PackDownloadError（reason 付き）。
 */
export function downloadPackFiles(
  packId: string,
  onProgress: (p: PackProgress) => void = () => undefined,
): Promise<void> {
  const running = inflight.get(packId);
  if (running) return running.promise;
  const progress: PackProgress = {
    packId,
    doneFiles: 0,
    totalFiles: 0,
    doneBytes: 0,
    totalBytes: 0,
  };
  const promise = (async () => {
    if (!hasCaches()) throw new PackDownloadError(packId, 'unsupported');
    const index = await getPackIndex();
    if (!index) throw new PackDownloadError(packId, isOffline() ? 'offline' : 'unsupported');
    const entry = index[packId];
    if (!entry) throw new PackDownloadError(packId, 'unknown-pack');
    const [status] = await computePackStatuses([packId]).then((all) =>
      all.filter((s) => s.packId === packId),
    );
    if (status?.state === 'ready') return;
    progress.totalFiles = entry.files.length;
    progress.totalBytes = entry.bytes;
    onProgress({ ...progress });
    emit();
    await doDownload(packId, entry, progress, onProgress);
  })();
  const tracked = promise.then(
    () => {
      lastErrors.delete(packId);
    },
    (e: unknown) => {
      lastErrors.set(packId, e instanceof PackDownloadError ? e.reason : 'error');
      throw e;
    },
  );
  const settled = tracked.finally(() => {
    inflight.delete(packId);
    emit();
  });
  inflight.set(packId, { progress, promise: settled });
  emit();
  return settled;
}

/**
 * 複数のパックを順に取得する（一括再取得・初回準備の2段目）。失敗したものは続けて次へ進み、最後にまとめて返す。
 */
export async function downloadPackList(
  packIds: readonly string[],
  onProgress: (p: PackProgress, index: number, count: number) => void = () => undefined,
): Promise<{ packId: string; reason: PackDownloadFailure }[]> {
  const failed: { packId: string; reason: PackDownloadFailure }[] = [];
  for (const [i, id] of packIds.entries()) {
    try {
      await downloadPackFiles(id, (p) => onProgress(p, i, packIds.length));
    } catch (e) {
      failed.push({ packId: id, reason: e instanceof PackDownloadError ? e.reason : 'error' });
    }
  }
  return failed;
}

/**
 * パックの教材（キャッシュ）と取得記録を消す。学習の記録（attempts・unitProgress など）は消さない。
 * 取得中なら、終わるのを待ってから消す。
 */
export async function deletePackFiles(packId: string): Promise<void> {
  await inflight.get(packId)?.promise.catch(() => undefined);
  for (const c of await packCacheNames()) {
    if (c.packId === packId) await caches.delete(c.name).catch(() => false);
  }
  await deletePackMeta(packId);
  lastErrors.delete(packId);
  emit();
}

/**
 * 起動時の整理（R#4）:
 *  - packs.json に無いパックのキャッシュと記録を消す
 *  - 記録の版と合わないキャッシュ（取得の途中で閉じた残骸など）を消す
 *  - 記録が無いが、コアに合う版のキャッシュがある（記録だけ消えた）ときは記録を作り直す
 * packs.json が読めないとき（オフラインの準備前など）は何もしない。
 */
export async function reconcilePacks(): Promise<void> {
  if (!hasCaches()) return;
  const index = await getPackIndex();
  if (!index) return;
  const metas = await readAllPackMeta();
  for (const c of await packCacheNames()) {
    if (inflight.has(c.packId)) continue;
    const entry = index[c.packId];
    if (!entry) {
      await caches.delete(c.name).catch(() => false);
      continue;
    }
    if (!metas) continue; // 保存が使えないときは、キャッシュの名前を正とする
    const meta = metas.get(c.packId);
    if (meta?.hash === c.hash) continue;
    if (!meta && c.hash === entry.hash) {
      await writePackMeta({
        packId: c.packId,
        hash: c.hash,
        bytes: entry.bytes,
        fileCount: entry.files.length,
        downloadedAt: Date.now(),
      });
      continue;
    }
    await caches.delete(c.name).catch(() => false);
  }
  if (metas) {
    for (const id of metas.keys()) if (!index[id]) await deletePackMeta(id);
  }
  emit();
}

/** テスト専用 */
export const __testing = {
  reset(): void {
    indexPromise = null;
    inflight.clear();
    lastErrors.clear();
    listeners.clear();
    seq = 0;
  },
};
