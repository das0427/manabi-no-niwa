/**
 * 書き出し・読み込み・形式の移行。parseBackup / migrateBackup は純粋関数。
 */
import type {
  AppRecord,
  ArtworkBlobRecord,
  ArtworkRecord,
  AttemptRecord,
  ChildSettings,
  FavoritesRecord,
  MemoRecord,
  Profile,
  RoundRecord,
  SkillProgress,
  UnitProgress,
  WorkRecord,
} from '../types';
import { ALL_STORES, SCHEMA_VERSION, STORE, r, runTx, strict } from './db';
import {
  type ArtworkBlobFile,
  LIMITS,
  isObj,
  normalizeSettings,
  validateArtwork,
  validateArtworkBlobFile,
  validateUnitProgress,
  validateAttempt,
  validateFavorites,
  validateMemo,
  validateProfile,
  validateProgress,
  validateRound,
  validateWork,
  withoutId,
} from './validate';

export const BACKUP_FORMAT = 'manabi-no-niwa-backup';
/** 読み込みを受け付けるファイルサイズの上限 */
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

export interface BackupData {
  profiles: Profile[];
  settings: ChildSettings[];
  progress: SkillProgress[];
  attempts: AttemptRecord[];
  rounds: RoundRecord[];
  works: WorkRecord[];
  memos: MemoRecord[];
  favorites: FavoritesRecord[];
  // ---- スキーマ2〜（古いファイルには無い → 空） ----
  unitProgress: UnitProgress[];
  artworks: ArtworkRecord[];
  /** 画像は PNG の data URL にして入れる */
  artworkBlobs: ArtworkBlobFile[];
}

/** 置き換え・消去の対象にしないストア（端末ごとの情報） */
const DEVICE_STORES: string[] = [STORE.meta, STORE.app, STORE.packsMeta];

export interface BackupFile {
  format: 'manabi-no-niwa-backup';
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  scope: 'all' | 'profile';
  data: BackupData;
}

export interface ImportPreview {
  profiles: { name: string; attempts: number; works: number }[];
  schemaVersion: number;
  exportedAt: string;
}

export type ParseResult =
  { ok: true; file: BackupFile; summary: ImportPreview } | { ok: false; reason: string };

export interface ImportSummary {
  addedProfiles: string[];
  replaced: boolean;
}

const DATA_KEYS = [
  'profiles',
  'settings',
  'progress',
  'attempts',
  'rounds',
  'works',
  'memos',
  'favorites',
  'unitProgress',
  'artworks',
  'artworkBlobs',
] as const;

/**
 * 版ごとの移行。migrations[n] は「版 n のファイル → 版 n+1」。
 * 0→1: 版 0 の設定には memoryAutoHideSec が無いので 0（子供が押すまで）を補う。
 */
export const migrations: Record<number, (f: BackupFile) => BackupFile> = {
  0: (f) => ({
    ...f,
    schemaVersion: 1,
    data: {
      ...f.data,
      settings: (f.data.settings as unknown[]).map((s) =>
        isObj(s) && s.memoryAutoHideSec === undefined ? { ...s, memoryAutoHideSec: 0 } : s,
      ) as ChildSettings[],
    },
  }),
  // 1→2: v1 のプロフィールは4歳向け。支援設定は normalizeSettings が4歳の既定で補う。
  // 進度（progress）は変換しない（旧記録。新しい単元の習得済みにしない）
  1: (f) => ({
    ...f,
    schemaVersion: 2,
    data: {
      ...f.data,
      profiles: (f.data.profiles as unknown[]).map((p) =>
        isObj(p) && p.audience === undefined ? { ...p, audience: 'p4' } : p,
      ) as Profile[],
    },
  }),
};

/** 古い版のファイルを現行の版へ移行する（純粋関数） */
export function migrateBackup(file: BackupFile): BackupFile {
  let cur = file;
  for (let v = file.schemaVersion; v < SCHEMA_VERSION; v++) {
    const m = migrations[v];
    cur = m ? m(cur) : { ...cur, schemaVersion: v + 1 };
  }
  return cur;
}

function mapAll<T>(list: unknown[], fn: (x: unknown) => T | null): T[] | null {
  const out: T[] = [];
  for (const x of list) {
    const v = fn(x);
    if (v === null) return null;
    out.push(v);
  }
  return out;
}

const bad = (reason: string): ParseResult => ({ ok: false, reason });

/** 読み込んだ文字列を検証して BackupFile にする。何も変更しない */
export function parseBackup(text: string, sizeBytes: number): ParseResult {
  if (sizeBytes > MAX_IMPORT_BYTES) {
    return bad('ファイルが大きすぎます（50MBまで）。プロフィールごとの書き出しをお試しください。');
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return bad(
      'ファイルを読み取れませんでした。「まなびのにわ」の書き出しファイルを選んでください。',
    );
  }
  if (!isObj(json) || json.format !== BACKUP_FORMAT) {
    return bad('「まなびのにわ」の書き出しファイルではありません。');
  }
  const ver = json.schemaVersion;
  if (typeof ver !== 'number' || !Number.isInteger(ver) || ver < 0) {
    return bad('ファイルの版が正しくありません。');
  }
  if (ver > SCHEMA_VERSION) {
    return bad('新しい版のデータです。アプリを更新してから読み込んでください。');
  }
  if (
    (json.scope !== 'all' && json.scope !== 'profile') ||
    typeof json.appVersion !== 'string' ||
    typeof json.exportedAt !== 'string' ||
    !isObj(json.data)
  ) {
    return bad('ファイルの内容が正しくありません。');
  }
  const raw: Record<string, unknown[]> = {};
  for (const k of DATA_KEYS) {
    const v = (json.data as Record<string, unknown>)[k];
    if (v === undefined) raw[k] = [];
    else if (Array.isArray(v)) raw[k] = v;
    else return bad(`ファイルの内容が正しくありません（${k}）。`);
  }
  const base = {
    format: BACKUP_FORMAT,
    schemaVersion: ver,
    appVersion: json.appVersion.slice(0, 40),
    exportedAt: json.exportedAt.slice(0, 40),
    scope: json.scope,
    data: raw as unknown as BackupData,
  } satisfies BackupFile;

  let migrated: BackupFile;
  try {
    migrated = migrateBackup(base);
  } catch {
    return bad('古い版のデータを変換できませんでした。');
  }
  const d = migrated.data as unknown as Record<string, unknown[]>;
  const profiles = mapAll(d.profiles ?? [], validateProfile);
  if (!profiles) return bad('プロフィールの情報が正しくありません。名前は40文字までです。');
  if (profiles.length === 0) return bad('プロフィールが1つも入っていないファイルです。');
  const ids = new Set(profiles.map((p) => p.id));
  if (ids.size !== profiles.length) return bad('プロフィールのIDが重複しています。');
  const settings = mapAll(d.settings ?? [], (s) =>
    isObj(s) && typeof s.profileId === 'string'
      ? normalizeSettings(s, s.profileId.slice(0, LIMITS.id), true)
      : null,
  );
  if (!settings) return bad('設定の情報が正しくありません。');
  const progress = mapAll(d.progress ?? [], validateProgress);
  if (!progress) return bad('進み具合の情報が正しくありません。');
  const attempts = mapAll(d.attempts ?? [], validateAttempt);
  if (!attempts) return bad('学習記録の情報が正しくありません。');
  const rounds = mapAll(d.rounds ?? [], validateRound);
  if (!rounds) return bad('実施記録の情報が正しくありません。');
  const works = mapAll(d.works ?? [], validateWork);
  if (!works) return bad('作品の情報が正しくありません。');
  const memos = mapAll(d.memos ?? [], validateMemo);
  if (!memos) return bad('メモの情報が正しくありません。メモは2000文字までです。');
  const favorites = mapAll(d.favorites ?? [], validateFavorites);
  if (!favorites) return bad('お気に入りの情報が正しくありません。');
  const unitProgress = mapAll(d.unitProgress ?? [], validateUnitProgress);
  if (!unitProgress) return bad('単元の進み具合の情報が正しくありません。');
  const artworks = mapAll(d.artworks ?? [], validateArtwork);
  if (!artworks) return bad('おえかきの作品の情報が正しくありません。');
  const artworkBlobs = mapAll(d.artworkBlobs ?? [], validateArtworkBlobFile);
  if (!artworkBlobs) return bad('おえかきの画像が正しくありません。');

  const orphan = [
    settings,
    progress,
    attempts,
    rounds,
    works,
    memos,
    favorites,
    unitProgress,
    artworks,
    artworkBlobs,
  ].some((l) => l.some((x) => !ids.has(x.profileId)));
  if (orphan) return bad('プロフィールに属さない記録が含まれています。');
  const artIds = new Set(artworks.map((a) => a.id));
  if (
    new Set(works.map((w) => w.id)).size !== works.length ||
    new Set(memos.map((m) => m.id)).size !== memos.length ||
    artIds.size !== artworks.length ||
    new Set(artworkBlobs.map((b) => b.key)).size !== artworkBlobs.length
  ) {
    return bad('作品またはメモのIDが重複しています。');
  }
  const artOwner = new Map(artworks.map((a) => [a.id, a.profileId]));
  if (artworkBlobs.some((b) => artOwner.get(b.artId) !== b.profileId)) {
    return bad('作品に属さない画像が含まれています。');
  }

  const file: BackupFile = {
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    appVersion: base.appVersion,
    exportedAt: base.exportedAt,
    scope: base.scope,
    data: {
      profiles,
      settings,
      progress,
      attempts,
      rounds,
      works,
      memos,
      favorites,
      unitProgress,
      artworks,
      artworkBlobs,
    },
  };
  const summary: ImportPreview = {
    profiles: profiles.map((p) => ({
      name: p.name,
      attempts: attempts.filter((a) => a.profileId === p.id).length,
      works:
        works.filter((w) => w.profileId === p.id).length +
        artworks.filter((a) => a.profileId === p.id).length,
    })),
    schemaVersion: ver,
    exportedAt: base.exportedAt,
  };
  return { ok: true, file, summary };
}

/** 全体またはプロフィール 1 人分を書き出し用データにする */
export async function exportBackup(
  scope: { kind: 'all' } | { kind: 'profile'; profileId: string },
  appVersion: string,
): Promise<BackupFile> {
  return strict(async () => {
    const names = DATA_KEYS.map((k) => STORE[k]);
    const raw = await runTx([...names], 'readonly', async (tx) => {
      const out: Record<string, unknown[]> = {};
      for (const k of DATA_KEYS) out[k] = await r<unknown[]>(tx.objectStore(STORE[k]).getAll());
      return out;
    });
    // 画像は transaction の外で data URL にする（transaction 内で IndexedDB 以外を待つと自動で閉じる）
    const blobs: ArtworkBlobFile[] = [];
    for (const b of raw.artworkBlobs as ArtworkBlobRecord[]) {
      blobs.push({
        key: b.key,
        artId: b.artId,
        profileId: b.profileId,
        kind: b.kind,
        dataUrl: await blobToDataUrl(b.blob),
      });
    }
    const all = { ...raw, artworkBlobs: blobs } as unknown as BackupData;
    let data = all;
    if (scope.kind === 'profile') {
      const pid = scope.profileId;
      const keep = <T extends { profileId: string }>(l: T[]): T[] =>
        l.filter((x) => x.profileId === pid);
      data = {
        profiles: all.profiles.filter((p) => p.id === pid),
        settings: keep(all.settings),
        progress: keep(all.progress),
        attempts: keep(all.attempts),
        rounds: keep(all.rounds),
        works: keep(all.works),
        memos: keep(all.memos),
        favorites: keep(all.favorites),
        unitProgress: keep(all.unitProgress),
        artworks: keep(all.artworks),
        artworkBlobs: keep(all.artworkBlobs),
      };
    }
    return {
      format: BACKUP_FORMAT,
      schemaVersion: SCHEMA_VERSION,
      appVersion,
      exportedAt: new Date().toISOString(),
      scope: scope.kind === 'all' ? 'all' : 'profile',
      data,
    };
  });
}

// ---- 置き換え前の退避（別データベース。本体の削除・置き換えの影響を受けない）
export const SNAPSHOT_DB = 'manabi-no-niwa-snapshot';

function openSnapshotDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SNAPSHOT_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('snapshots');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveSnapshot(file: BackupFile): Promise<void> {
  const db = await openSnapshotDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('snapshots', 'readwrite');
      tx.objectStore('snapshots').put({ savedAt: Date.now(), file }, 'before-replace');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** 「すべて置き換え」の直前に退避したデータ（なければ null）。保護者画面から元に戻すのに使う */
export async function getReplaceSnapshot(): Promise<{ savedAt: number; file: BackupFile } | null> {
  const db = await openSnapshotDb();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction('snapshots').objectStore('snapshots').get('before-replace');
      req.onsuccess = () => resolve((req.result as { savedAt: number; file: BackupFile }) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

const PNG_PREFIX = 'data:image/png;base64,';

async function blobToDataUrl(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return PNG_PREFIX + btoa(bin);
}

function blobFromFile(f: ArtworkBlobFile): ArtworkBlobRecord {
  const bin = atob(f.dataUrl.slice(PNG_PREFIX.length));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return {
    key: f.key,
    artId: f.artId,
    profileId: f.profileId,
    kind: f.kind,
    blob: new Blob([bytes], { type: 'image/png' }),
  };
}

function uniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) return name;
  for (let n = 2; ; n++) {
    const suffix = `（${n}）`;
    const cand = name.slice(0, LIMITS.name - suffix.length) + suffix;
    if (!taken.has(cand)) return cand;
  }
}

/** 読み込み。add: 新しいIDで追加（既存は変更しない）／replace: すべて置き換え */
export async function importBackup(
  file: BackupFile,
  mode: 'add' | 'replace',
): Promise<ImportSummary> {
  const d = file.data;
  if (d.profiles.length === 0) throw new Error('プロフィールが1つも入っていないため読み込めません');
  return strict(async () => {
    if (mode === 'replace') {
      // 置き換える前の全データを、端末内の別のデータベースに1世代だけ退避する（DA-06）。
      // 退避に失敗したら置き換えない（ダウンロードの成否に頼らない）。
      await saveSnapshot(await exportBackup({ kind: 'all' }, file.appVersion));
      const blobs = d.artworkBlobs.map(blobFromFile);
      await runTx([...ALL_STORES], 'readwrite', async (tx) => {
        for (const s of ALL_STORES) if (!DEVICE_STORES.includes(s)) tx.objectStore(s).clear();
        const app = tx.objectStore(STORE.app);
        const cur = await r<AppRecord | undefined>(app.get('app'));
        app.put({ activeProfileId: null, parentPinHash: cur?.parentPinHash ?? null }, 'app');
        const put = (name: string, list: unknown[]): void => {
          const st = tx.objectStore(name);
          for (const x of list) st.put(x);
        };
        put(STORE.profiles, d.profiles);
        put(STORE.settings, d.settings);
        put(STORE.progress, d.progress);
        put(STORE.attempts, d.attempts.map(withoutId));
        put(STORE.rounds, d.rounds.map(withoutId));
        put(STORE.works, d.works);
        put(STORE.memos, d.memos);
        put(STORE.favorites, d.favorites);
        put(STORE.unitProgress, d.unitProgress);
        put(STORE.artworks, d.artworks);
        put(STORE.artworkBlobs, blobs);
      });
      return { addedProfiles: d.profiles.map((p) => p.name), replaced: true };
    }

    const added: string[] = [];
    const artIdMap = new Map(d.artworks.map((a) => [a.id, crypto.randomUUID()]));
    const addBlobs = d.artworkBlobs.map(blobFromFile);
    await runTx([...ALL_STORES], 'readwrite', async (tx) => {
      const existing = await r<Profile[]>(tx.objectStore(STORE.profiles).getAll());
      const taken = new Set(existing.map((p) => p.name));
      const idMap = new Map<string, string>();
      // 追加分は既存より後ろに並べる（同時刻でも順序が安定するよう最大値+1以降）
      const now = Math.max(Date.now(), ...existing.map((p) => p.createdAt + 1));
      d.profiles.forEach((p, i) => {
        const id = crypto.randomUUID();
        const name = uniqueName(p.name, taken);
        taken.add(name);
        idMap.set(p.id, id);
        added.push(name);
        tx.objectStore(STORE.profiles).put({ ...p, id, name, createdAt: now + i });
        const s = d.settings.find((x) => x.profileId === p.id);
        tx.objectStore(STORE.settings).put({
          ...normalizeSettings(s ?? {}, id, false),
          profileId: id,
        });
      });
      const pid = (old: string): string => idMap.get(old) ?? old;
      for (const x of d.progress)
        tx.objectStore(STORE.progress).put({ ...x, profileId: pid(x.profileId) });
      for (const x of d.attempts)
        tx.objectStore(STORE.attempts).add({ ...withoutId(x), profileId: pid(x.profileId) });
      for (const x of d.rounds)
        tx.objectStore(STORE.rounds).add({ ...withoutId(x), profileId: pid(x.profileId) });
      for (const x of d.works)
        tx.objectStore(STORE.works).put({
          ...x,
          id: crypto.randomUUID(),
          profileId: pid(x.profileId),
        });
      for (const x of d.memos)
        tx.objectStore(STORE.memos).put({
          ...x,
          id: crypto.randomUUID(),
          profileId: pid(x.profileId),
        });
      for (const x of d.favorites)
        tx.objectStore(STORE.favorites).put({ ...x, profileId: pid(x.profileId) });
      for (const x of d.unitProgress)
        tx.objectStore(STORE.unitProgress).put({ ...x, profileId: pid(x.profileId) });
      for (const x of d.artworks)
        tx.objectStore(STORE.artworks).put({
          ...x,
          id: artIdMap.get(x.id)!,
          profileId: pid(x.profileId),
        });
      for (const x of addBlobs) {
        const artId = artIdMap.get(x.artId)!;
        tx.objectStore(STORE.artworkBlobs).put({
          ...x,
          key: `${artId}:${x.kind}`,
          artId,
          profileId: pid(x.profileId),
        });
      }
    });
    return { addedProfiles: added, replaced: false };
  });
}
