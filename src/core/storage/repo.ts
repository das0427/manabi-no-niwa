/**
 * 各ストアの読み書き。通常の保存は失敗しても reject しない。
 * 削除・全消去など保護者操作系は reject する（画面で表示する）。
 */
import {
  defaultSettings,
  profileAudience,
  type AppRecord,
  type AttemptRecord,
  type ChildSettings,
  type DraftRecord,
  type FavoritesRecord,
  type MemoRecord,
  type ModeId,
  type Profile,
  type RoundRecord,
  type SkillId,
  type SkillProgress,
  type WorkRecord,
} from '../types';
import {
  ALL_STORES,
  RECORD_STORES,
  STORE,
  collect,
  deleteProfileRecords,
  deleteViaIndex,
  getDb,
  profileRange,
  r,
  runTx,
  safeRead,
  safeWrite,
  strict,
} from './db';
import { normalizeSettings, withoutId } from './validate';

/** attempts をプロフィールごとに残す最大件数 */
export const MAX_ATTEMPTS_PER_PROFILE = 5000;

// ---- app ----
/** アプリ全体の設定（有効プロフィール・保護者PINハッシュ） */
export async function getAppRecord(): Promise<AppRecord> {
  const def: AppRecord = { activeProfileId: null, parentPinHash: null };
  return safeRead(async () => {
    const v = await runTx([STORE.app], 'readonly', (tx) =>
      r<Partial<AppRecord> | undefined>(tx.objectStore(STORE.app).get('app')),
    );
    return {
      activeProfileId: typeof v?.activeProfileId === 'string' ? v.activeProfileId : null,
      parentPinHash: typeof v?.parentPinHash === 'string' ? v.parentPinHash : null,
    };
  }, def);
}

/** アプリ全体の設定を保存する */
export async function saveAppRecord(rec: AppRecord): Promise<void> {
  await safeWrite(() =>
    runTx([STORE.app], 'readwrite', (tx) => {
      tx.objectStore(STORE.app).put(
        { activeProfileId: rec.activeProfileId, parentPinHash: rec.parentPinHash },
        'app',
      );
    }),
  );
}

// ---- profiles ----
/** プロフィール一覧（作成日時の昇順） */
export async function listProfiles(): Promise<Profile[]> {
  return safeRead(async () => {
    const all = await runTx([STORE.profiles], 'readonly', (tx) =>
      r<Profile[]>(tx.objectStore(STORE.profiles).getAll()),
    );
    return all.sort((a, b) => a.createdAt - b.createdAt);
  }, []);
}

/** プロフィールを作る（既定の設定も同時に作成）。保存に失敗しても作成した値を返す */
export async function createProfile(
  name: string,
  avatar: string,
  opts: Pick<Profile, 'audience' | 'toddlerStage' | 'enrolledGrade' | 'ageGuide'> = {},
): Promise<Profile> {
  const p: Profile = {
    id: crypto.randomUUID(),
    name,
    avatar,
    createdAt: Date.now(),
    audience: opts.audience ?? 'p4',
  };
  if (opts.toddlerStage !== undefined) p.toddlerStage = opts.toddlerStage;
  if (opts.enrolledGrade !== undefined) p.enrolledGrade = opts.enrolledGrade;
  if (opts.ageGuide !== undefined) p.ageGuide = opts.ageGuide;
  await safeWrite(() =>
    runTx([STORE.profiles, STORE.settings], 'readwrite', (tx) => {
      tx.objectStore(STORE.profiles).put(p);
      tx.objectStore(STORE.settings).put(defaultSettings(p.id, profileAudience(p)));
    }),
  );
  return p;
}

/** プロフィールを更新する */
export async function updateProfile(p: Profile): Promise<void> {
  await safeWrite(() =>
    runTx([STORE.profiles], 'readwrite', (tx) => {
      tx.objectStore(STORE.profiles).put(p);
    }),
  );
}

/** プロフィールと関連する全記録を 1 トランザクションで削除する */
export async function deleteProfile(id: string): Promise<void> {
  await strict(() =>
    runTx([...ALL_STORES], 'readwrite', async (tx) => {
      tx.objectStore(STORE.profiles).delete(id);
      for (const s of [STORE.settings, ...RECORD_STORES]) await deleteProfileRecords(tx, s, id);
      const app = tx.objectStore(STORE.app);
      const cur = await r<AppRecord | undefined>(app.get('app'));
      if (cur && cur.activeProfileId === id) app.put({ ...cur, activeProfileId: null }, 'app');
    }),
  );
}

/** プロフィールと設定を残し、学習記録・作品・メモ・中断データ・お気に入りを削除する */
export async function clearProfileRecords(profileId: string): Promise<void> {
  await strict(() =>
    runTx([...RECORD_STORES], 'readwrite', async (tx) => {
      for (const s of RECORD_STORES) await deleteProfileRecords(tx, s, profileId);
    }),
  );
}

// ---- settings ----
/** 設定を取得する。無い・欠けている項目は既定で補う */
export async function getSettings(profileId: string): Promise<ChildSettings> {
  return safeRead(async () => {
    const raw = await runTx([STORE.settings], 'readonly', (tx) =>
      r<unknown>(tx.objectStore(STORE.settings).get(profileId)),
    );
    return normalizeSettings(raw, profileId, false) ?? defaultSettings(profileId);
  }, defaultSettings(profileId));
}

/** 設定を保存する */
export async function saveSettings(s: ChildSettings): Promise<void> {
  await safeWrite(() =>
    runTx([STORE.settings], 'readwrite', (tx) => {
      tx.objectStore(STORE.settings).put(s);
    }),
  );
}

// ---- progress ----
function emptyProgress(profileId: string, skillId: SkillId): SkillProgress {
  return {
    profileId,
    skillId,
    level: 0,
    window: [],
    mastered: false,
    attempted: false,
    changedAt: 0,
    lastChange: null,
  };
}

/** スキルの進度を取得する（無ければ初期値） */
export async function getProgress(profileId: string, skillId: SkillId): Promise<SkillProgress> {
  return safeRead(
    async () => {
      const v = await runTx([STORE.progress], 'readonly', (tx) =>
        r<SkillProgress | undefined>(tx.objectStore(STORE.progress).get([profileId, skillId])),
      );
      return v ?? emptyProgress(profileId, skillId);
    },
    emptyProgress(profileId, skillId),
  );
}

/** プロフィールの全スキル進度 */
export async function listProgress(profileId: string): Promise<SkillProgress[]> {
  return safeRead(
    () =>
      runTx([STORE.progress], 'readonly', (tx) =>
        r<SkillProgress[]>(
          tx.objectStore(STORE.progress).getAll(IDBKeyRange.bound([profileId], [profileId, []])),
        ),
      ),
    [],
  );
}

/** スキル進度を保存する */
export async function saveProgress(p: SkillProgress): Promise<void> {
  await safeWrite(() =>
    runTx([STORE.progress], 'readwrite', (tx) => {
      tx.objectStore(STORE.progress).put(p);
    }),
  );
}

// ---- attempts ----
/** 1問の記録を追加し、上限（既定 5000 件）を超えた分を古いものから削除する */
export async function addAttempt(
  a: AttemptRecord,
  cap: number = MAX_ATTEMPTS_PER_PROFILE,
): Promise<void> {
  const rest = withoutId(a);
  await safeWrite(() =>
    runTx([STORE.attempts], 'readwrite', async (tx) => {
      const store = tx.objectStore(STORE.attempts);
      store.add(rest);
      const idx = store.index('profileId_at');
      const range = profileRange(a.profileId);
      const count = await r(idx.count(range));
      if (count > cap) await deleteViaIndex(idx, range, count - cap);
    }),
  );
}

/** 記録を新しい順に取得する */
export async function listAttempts(
  profileId: string,
  opts: { since?: number; limit?: number } = {},
): Promise<AttemptRecord[]> {
  return safeRead(
    () =>
      runTx([STORE.attempts], 'readonly', (tx) => {
        const range = IDBKeyRange.bound(
          [profileId, opts.since ?? -Infinity],
          [profileId, Infinity],
        );
        return collect<AttemptRecord>(
          tx.objectStore(STORE.attempts).index('profileId_at'),
          range,
          'prev',
          opts.limit,
        );
      }),
    [],
  );
}

// ---- rounds ----
/** 1回分の記録を追加し、採番した id を返す（失敗時 0） */
export async function addRound(rec: RoundRecord): Promise<number> {
  const rest = withoutId(rec);
  let id = 0;
  await safeWrite(async () => {
    id = Number(
      await runTx([STORE.rounds], 'readwrite', (tx) => r(tx.objectStore(STORE.rounds).add(rest))),
    );
  });
  return id;
}

/** 1回分の記録を更新する（id 必須） */
export async function updateRound(rec: RoundRecord): Promise<void> {
  if (rec.id === undefined) return;
  await safeWrite(() =>
    runTx([STORE.rounds], 'readwrite', (tx) => {
      tx.objectStore(STORE.rounds).put(rec);
    }),
  );
}

/** 1回分の記録を新しい順に取得する */
export async function listRounds(
  profileId: string,
  opts: { since?: number } = {},
): Promise<RoundRecord[]> {
  return safeRead(
    () =>
      runTx([STORE.rounds], 'readonly', (tx) =>
        collect<RoundRecord>(
          tx.objectStore(STORE.rounds).index('profileId_at'),
          IDBKeyRange.bound([profileId, opts.since ?? -Infinity], [profileId, Infinity]),
          'prev',
        ),
      ),
    [],
  );
}

// ---- works / memos ----
async function listByProfile<T extends { createdAt: number }>(
  storeName: string,
  profileId: string,
): Promise<T[]> {
  return safeRead(async () => {
    const all = await runTx([storeName], 'readonly', (tx) =>
      collect<T>(tx.objectStore(storeName).index('profileId'), profileId),
    );
    return all.sort((a, b) => b.createdAt - a.createdAt);
  }, []);
}

/** 作品を保存する */
export async function saveWork(w: WorkRecord): Promise<void> {
  await safeWrite(() =>
    runTx([STORE.works], 'readwrite', (tx) => {
      tx.objectStore(STORE.works).put(w);
    }),
  );
}

/** 作品を 1 件取得する */
export async function getWork(id: string): Promise<WorkRecord | undefined> {
  return safeRead(
    () =>
      runTx([STORE.works], 'readonly', (tx) =>
        r<WorkRecord | undefined>(tx.objectStore(STORE.works).get(id)),
      ),
    undefined,
  );
}

/** 作品一覧（新しい順） */
export function listWorks(profileId: string): Promise<WorkRecord[]> {
  return listByProfile<WorkRecord>(STORE.works, profileId);
}

/** 作品を削除する */
export async function deleteWork(id: string): Promise<void> {
  await safeWrite(() =>
    runTx([STORE.works], 'readwrite', (tx) => {
      tx.objectStore(STORE.works).delete(id);
    }),
  );
}

/** メモ一覧（新しい順） */
export function listMemos(profileId: string): Promise<MemoRecord[]> {
  return listByProfile<MemoRecord>(STORE.memos, profileId);
}

/** メモを保存する */
export async function saveMemo(m: MemoRecord): Promise<void> {
  await safeWrite(() =>
    runTx([STORE.memos], 'readwrite', (tx) => {
      tx.objectStore(STORE.memos).put(m);
    }),
  );
}

/** メモを削除する */
export async function deleteMemo(id: string): Promise<void> {
  await safeWrite(() =>
    runTx([STORE.memos], 'readwrite', (tx) => {
      tx.objectStore(STORE.memos).delete(id);
    }),
  );
}

// ---- drafts / favorites ----
/** 中断データを取得する */
export async function getDraft(
  profileId: string,
  modeId: ModeId | 'unit',
  variantId: string,
): Promise<DraftRecord | undefined> {
  return safeRead(
    () =>
      runTx([STORE.drafts], 'readonly', (tx) =>
        r<DraftRecord | undefined>(
          tx.objectStore(STORE.drafts).get([profileId, modeId, variantId]),
        ),
      ),
    undefined,
  );
}

/** 中断データを保存する */
export async function saveDraft(d: DraftRecord): Promise<void> {
  await safeWrite(() =>
    runTx([STORE.drafts], 'readwrite', (tx) => {
      tx.objectStore(STORE.drafts).put(d);
    }),
  );
}

/** 中断データを削除する */
export async function deleteDraft(
  profileId: string,
  modeId: ModeId | 'unit',
  variantId: string,
): Promise<void> {
  await safeWrite(() =>
    runTx([STORE.drafts], 'readwrite', (tx) => {
      tx.objectStore(STORE.drafts).delete([profileId, modeId, variantId]);
    }),
  );
}

/** お気に入りのモード */
export async function getFavorites(profileId: string): Promise<ModeId[]> {
  return safeRead(async () => {
    const v = await runTx([STORE.favorites], 'readonly', (tx) =>
      r<FavoritesRecord | undefined>(tx.objectStore(STORE.favorites).get(profileId)),
    );
    return v ? [...v.modeIds] : [];
  }, []);
}

/** お気に入りのモードを保存する */
export async function saveFavorites(profileId: string, modeIds: ModeId[]): Promise<void> {
  await safeWrite(() =>
    runTx([STORE.favorites], 'readwrite', (tx) => {
      tx.objectStore(STORE.favorites).put({ profileId, modeIds: [...modeIds] });
    }),
  );
}

// ---- 容量・全削除 ----
/** 保存容量の見積もり */
export async function estimateStorage(): Promise<{
  usage?: number;
  quota?: number;
  persisted?: boolean;
}> {
  const out: { usage?: number; quota?: number; persisted?: boolean } = {};
  try {
    const s = navigator.storage;
    if (!s) return out;
    if (s.estimate) {
      const e = await s.estimate();
      out.usage = e.usage;
      out.quota = e.quota;
    }
    if (s.persisted) out.persisted = await s.persisted();
  } catch {
    /* 取得できない環境 */
  }
  return out;
}

/** 保存領域の永続化を要求する（保護者画面の操作からのみ呼ぶ） */
export async function requestPersist(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/** すべてのデータを削除する（meta は作り直す） */
export async function deleteAllData(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await strict(() =>
    runTx([...ALL_STORES], 'readwrite', (tx) => {
      // 教材パックの取得記録（packsMeta）は記録ではないので残す（教材の削除は別操作）
      for (const s of ALL_STORES) if (s !== STORE.packsMeta) tx.objectStore(s).clear();
      tx.objectStore(STORE.meta).put(
        { schemaVersion: db.version, createdAt: Date.now(), lastAppVersion: '' },
        'meta',
      );
    }),
  );
}
