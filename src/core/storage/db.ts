/**
 * IndexedDB の接続・トランザクション補助・保存状態（health）。
 * 通常の保存は失敗しても例外にせず、health を更新して続行する（子供の操作を止めない）。
 */
import type { StorageHealth } from '../types';

/** IndexedDB のバージョン（スキーマ版と同一） */
export const SCHEMA_VERSION = 1;
export const DB_NAME = 'manabi-no-niwa';

export const STORE = {
  meta: 'meta',
  app: 'app',
  profiles: 'profiles',
  settings: 'settings',
  progress: 'progress',
  attempts: 'attempts',
  rounds: 'rounds',
  works: 'works',
  memos: 'memos',
  drafts: 'drafts',
  favorites: 'favorites',
} as const;

export const ALL_STORES: string[] = Object.values(STORE);
/** profileId で関連付けられた記録のストア（プロフィール本体と settings を除く） */
export const RECORD_STORES = [
  STORE.progress,
  STORE.attempts,
  STORE.rounds,
  STORE.works,
  STORE.memos,
  STORE.drafts,
  STORE.favorites,
] as const;

export class StorageUnavailableError extends Error {
  constructor() {
    super('保存領域を利用できません');
    this.name = 'StorageUnavailableError';
  }
}

// ---- health ----
let health: StorageHealth = 'ok';
const listeners = new Set<(h: StorageHealth) => void>();

/** 現在の保存状態 */
export function getStorageHealth(): StorageHealth {
  return health;
}

/** 保存状態の変化を購読する。戻り値で解除 */
export function onStorageHealth(cb: (h: StorageHealth) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function setHealth(next: StorageHealth): void {
  if (next === health) return;
  health = next;
  for (const cb of [...listeners]) {
    try {
      cb(next);
    } catch {
      /* 購読側の失敗は無視 */
    }
  }
}

export function reportError(e: unknown): void {
  if (e instanceof StorageUnavailableError) return;
  const name = (e as { name?: string } | null)?.name;
  console.warn('[storage]', e);
  setHealth(name === 'QuotaExceededError' ? 'full' : 'error');
}

// ---- 接続 ----
let dbPromise: Promise<IDBDatabase | null> | null = null;

function createStores(db: IDBDatabase, upgrade: IDBTransaction): void {
  db.createObjectStore(STORE.meta);
  db.createObjectStore(STORE.app);
  db.createObjectStore(STORE.profiles, { keyPath: 'id' });
  db.createObjectStore(STORE.settings, { keyPath: 'profileId' });
  db.createObjectStore(STORE.progress, { keyPath: ['profileId', 'skillId'] });
  const attempts = db.createObjectStore(STORE.attempts, { keyPath: 'id', autoIncrement: true });
  attempts.createIndex('profileId_at', ['profileId', 'at']);
  const rounds = db.createObjectStore(STORE.rounds, { keyPath: 'id', autoIncrement: true });
  rounds.createIndex('profileId_at', ['profileId', 'startedAt']);
  const works = db.createObjectStore(STORE.works, { keyPath: 'id' });
  works.createIndex('profileId', 'profileId');
  const memos = db.createObjectStore(STORE.memos, { keyPath: 'id' });
  memos.createIndex('profileId', 'profileId');
  db.createObjectStore(STORE.drafts, { keyPath: ['profileId', 'modeId', 'variantId'] });
  db.createObjectStore(STORE.favorites, { keyPath: 'profileId' });
  upgrade
    .objectStore(STORE.meta)
    .put({ schemaVersion: SCHEMA_VERSION, createdAt: Date.now(), lastAppVersion: '' }, 'meta');
}

function doOpen(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      setHealth('unavailable');
      resolve(null);
      return;
    }
    let settled = false;
    const fail = (): void => {
      setHealth('unavailable');
      if (!settled) {
        settled = true;
        resolve(null);
      }
    };
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, SCHEMA_VERSION);
    } catch (e) {
      console.warn('[storage] open failed', e);
      fail();
      return;
    }
    req.onupgradeneeded = () => {
      const tx = req.transaction;
      if (tx) createStores(req.result, tx);
    };
    req.onblocked = fail;
    req.onerror = (ev) => {
      ev.preventDefault();
      console.warn('[storage] open error', req.error);
      fail();
    };
    req.onsuccess = () => {
      const db = req.result;
      if (settled) {
        db.close(); // blocked 後に遅れて開いた接続は使わない
        return;
      }
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
        setHealth('unavailable');
      };
      settled = true;
      resolve(db);
    };
  });
}

/** 接続を取得する（失敗時 null） */
export function getDb(): Promise<IDBDatabase | null> {
  if (!dbPromise) dbPromise = doOpen();
  return dbPromise;
}

/** 保存領域を開く。冪等。失敗しても resolve し health を 'unavailable' にする */
export async function openStorage(): Promise<void> {
  await getDb();
}

/** テスト用: 接続を閉じて次回開き直す */
export async function closeStorageForTest(): Promise<void> {
  const p = dbPromise;
  dbPromise = null;
  const db = p ? await p : null;
  db?.close();
  setHealth('ok');
}

// ---- トランザクション ----
export function r<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** トランザクションを実行し、完了(commit)後に fn の結果を返す。失敗時は reject */
export async function runTx<T>(
  names: string[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const db = await getDb();
  if (!db) throw new StorageUnavailableError();
  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(names, mode);
    } catch (e) {
      reject(e);
      return;
    }
    let result: T;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
    tx.onerror = () => {
      /* abort 側で処理 */
    };
    (async () => {
      try {
        result = await fn(tx);
      } catch (e) {
        try {
          tx.abort();
        } catch {
          /* すでに終了 */
        }
        reject(e);
      }
    })();
  });
}

/** 保存系（通常）: 失敗しても reject せず health を更新する */
export async function safeWrite(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    if (health === 'full' || health === 'error') setHealth('ok');
  } catch (e) {
    reportError(e);
  }
}

/** 読み込み系: 失敗時は既定値を返し health を更新する */
export async function safeRead<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    reportError(e);
    return fallback;
  }
}

/** 保護者操作系: health を更新したうえで reject する */
export async function strict<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    reportError(e);
    throw e;
  }
}

/** プロフィールの記録範囲（[profileId, 任意] 形式のキー用） */
export function profileRange(profileId: string): IDBKeyRange {
  return IDBKeyRange.bound([profileId, -Infinity], [profileId, Infinity]);
}

/** カーソルで全件取得 */
export function collect<T>(
  src: IDBObjectStore | IDBIndex,
  range: IDBKeyRange | IDBValidKey | undefined,
  dir: IDBCursorDirection = 'next',
  limit = Infinity,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const out: T[] = [];
    const req = src.openCursor(range, dir);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const c = req.result;
      if (!c || out.length >= limit) {
        resolve(out);
        return;
      }
      out.push(c.value as T);
      c.continue();
    };
  });
}

/** インデックスの範囲を最大 limit 件（Infinity で全件）削除する。昇順で先頭から */
export function deleteViaIndex(
  idx: IDBIndex,
  range: IDBKeyRange | IDBValidKey,
  limit = Infinity,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let n = 0;
    const req = idx.openKeyCursor(range);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const c = req.result;
      if (!c || n >= limit) {
        resolve();
        return;
      }
      n += 1;
      idx.objectStore.delete(c.primaryKey);
      c.continue();
    };
  });
}

/** profileId に紐づく記録を 1 ストア分削除する（tx 内で呼ぶ） */
export async function deleteProfileRecords(
  tx: IDBTransaction,
  storeName: string,
  profileId: string,
): Promise<void> {
  const store = tx.objectStore(storeName);
  switch (storeName) {
    case STORE.settings:
    case STORE.favorites:
      store.delete(profileId);
      break;
    case STORE.progress:
    case STORE.drafts:
      store.delete(IDBKeyRange.bound([profileId], [profileId, []]));
      break;
    case STORE.attempts:
    case STORE.rounds:
      await deleteViaIndex(store.index('profileId_at'), profileRange(profileId));
      break;
    default:
      await deleteViaIndex(store.index('profileId'), profileId);
  }
}
