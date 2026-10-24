import { beforeEach, describe, expect, it } from 'vitest';
import { defaultSettings, type AttemptRecord } from '../types';
import {
  addAttempt,
  addRound,
  clearProfileRecords,
  createProfile,
  deleteAllData,
  deleteDraft,
  deleteMemo,
  deleteProfile,
  deleteWork,
  getAppRecord,
  getDraft,
  getFavorites,
  getProgress,
  getSettings,
  getStorageHealth,
  getWork,
  listAttempts,
  listMemos,
  listProfiles,
  listProgress,
  listRounds,
  listWorks,
  openStorage,
  saveAppRecord,
  saveDraft,
  saveFavorites,
  saveMemo,
  saveProgress,
  saveSettings,
  saveWork,
  updateProfile,
  updateRound,
} from './index';

const attempt = (profileId: string, at: number): AttemptRecord => ({
  profileId,
  modeId: 'math',
  variantId: 'v',
  skillId: 'add',
  level: 1,
  itemKey: `k${at}`,
  outcome: 'independent',
  wrongTries: 0,
  hintsUsed: 0,
  reviewsUsed: 0,
  operationIssue: false,
  inputKind: 'touch',
  at,
});

beforeEach(async () => {
  await openStorage();
  await deleteAllData();
});

describe('基本', () => {
  it('openStorage は冪等で health は ok', async () => {
    await openStorage();
    await openStorage();
    expect(getStorageHealth()).toBe('ok');
  });

  it('app の既定値と保存', async () => {
    expect(await getAppRecord()).toEqual({ activeProfileId: null, parentPinHash: null });
    await saveAppRecord({ activeProfileId: 'x', parentPinHash: 'h' });
    expect(await getAppRecord()).toEqual({ activeProfileId: 'x', parentPinHash: 'h' });
  });

  it('プロフィールの作成・更新・昇順一覧、設定も作られる', async () => {
    const a = await createProfile('はな', 'cat');
    await new Promise((r) => setTimeout(r, 3));
    const b = await createProfile('たろう', 'dog');
    expect((await listProfiles()).map((p) => p.id)).toEqual([a.id, b.id]);
    await updateProfile({ ...a, name: 'はなこ' });
    expect((await listProfiles())[0]?.name).toBe('はなこ');
    expect(await getSettings(a.id)).toEqual(defaultSettings(a.id));
  });

  it('settings: 欠けた項目は既定で補う', async () => {
    const p = await createProfile('a', 'x');
    const idb = indexedDB.open('manabi-no-niwa');
    const db = await new Promise<IDBDatabase>((res) => {
      idb.onsuccess = () => res(idb.result);
    });
    await new Promise<void>((res) => {
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put({ profileId: p.id, volume: 0.3 });
      tx.oncomplete = () => res();
    });
    db.close();
    const s = await getSettings(p.id);
    expect(s.volume).toBe(0.3);
    expect(s.memoryAutoHideSec).toBe(0);
    expect(s.roundSize).toBe(4);
    await saveSettings({ ...s, sfx: false });
    expect((await getSettings(p.id)).sfx).toBe(false);
  });

  it('progress の既定値と保存・一覧', async () => {
    const p = await createProfile('a', 'x');
    const def = await getProgress(p.id, 'add');
    expect(def).toMatchObject({ level: 0, window: [], mastered: false, attempted: false });
    await saveProgress({ ...def, level: 2, attempted: true, window: ['independent'] });
    await saveProgress({ ...def, skillId: 'sub', level: 1 });
    expect((await getProgress(p.id, 'add')).level).toBe(2);
    expect(await listProgress(p.id)).toHaveLength(2);
  });

  it('attempts: 新しい順・since・limit', async () => {
    const p = await createProfile('a', 'x');
    for (const t of [10, 30, 20]) await addAttempt(attempt(p.id, t));
    expect((await listAttempts(p.id)).map((a) => a.at)).toEqual([30, 20, 10]);
    expect((await listAttempts(p.id, { since: 20 })).map((a) => a.at)).toEqual([30, 20]);
    expect((await listAttempts(p.id, { limit: 1 })).map((a) => a.at)).toEqual([30]);
  });

  it('attempts: 上限を超えたら古いものから削除（プロフィール単位）', async () => {
    const p = await createProfile('a', 'x');
    const q = await createProfile('b', 'x');
    await addAttempt(attempt(q.id, 1), 3);
    for (let t = 1; t <= 6; t++) await addAttempt(attempt(p.id, t), 3);
    expect((await listAttempts(p.id)).map((a) => a.at)).toEqual([6, 5, 4]);
    expect(await listAttempts(q.id)).toHaveLength(1);
  });

  it('rounds: 追加・更新・新しい順', async () => {
    const p = await createProfile('a', 'x');
    const base = {
      profileId: p.id,
      modeId: 'math' as const,
      variantId: 'v',
      endedAt: 0,
      count: 0,
      completed: false,
    };
    const id1 = await addRound({ ...base, startedAt: 100 });
    await addRound({ ...base, startedAt: 200 });
    expect(id1).toBeGreaterThan(0);
    await updateRound({
      ...base,
      id: id1,
      startedAt: 100,
      endedAt: 150,
      count: 4,
      completed: true,
    });
    const list = await listRounds(p.id);
    expect(list.map((r) => r.startedAt)).toEqual([200, 100]);
    expect(list[1]).toMatchObject({ count: 4, completed: true });
    expect(await listRounds(p.id, { since: 150 })).toHaveLength(1);
  });

  it('works / memos / drafts / favorites', async () => {
    const p = await createProfile('a', 'x');
    await saveWork({
      id: 'w1',
      profileId: p.id,
      modeId: 'trace',
      kind: 'trace',
      title: 'し',
      createdAt: 1,
      data: { s: [1] },
    });
    await saveWork({
      id: 'w2',
      profileId: p.id,
      modeId: 'road',
      kind: 'road',
      title: 'みち',
      createdAt: 2,
      data: null,
    });
    expect((await listWorks(p.id)).map((w) => w.id)).toEqual(['w2', 'w1']);
    expect((await getWork('w1'))?.data).toEqual({ s: [1] });
    await deleteWork('w1');
    expect(await getWork('w1')).toBeUndefined();

    await saveMemo({ id: 'm1', profileId: p.id, date: '2026-10-01', text: 'a', createdAt: 1 });
    await saveMemo({ id: 'm2', profileId: p.id, date: '2026-10-02', text: 'b', createdAt: 2 });
    expect((await listMemos(p.id)).map((m) => m.id)).toEqual(['m2', 'm1']);
    await deleteMemo('m2');
    expect(await listMemos(p.id)).toHaveLength(1);

    await saveDraft({
      profileId: p.id,
      modeId: 'math',
      variantId: 'v',
      savedAt: 5,
      state: { n: 1 },
    });
    expect((await getDraft(p.id, 'math', 'v'))?.state).toEqual({ n: 1 });
    expect(await getDraft(p.id, 'math', 'other')).toBeUndefined();
    await deleteDraft(p.id, 'math', 'v');
    expect(await getDraft(p.id, 'math', 'v')).toBeUndefined();

    expect(await getFavorites(p.id)).toEqual([]);
    await saveFavorites(p.id, ['math', 'trace']);
    expect(await getFavorites(p.id)).toEqual(['math', 'trace']);
  });
});

async function fill(pid: string): Promise<void> {
  await saveProgress({ ...(await getProgress(pid, 'add')), attempted: true });
  await addAttempt(attempt(pid, 1));
  await addRound({
    profileId: pid,
    modeId: 'math',
    variantId: 'v',
    startedAt: 1,
    endedAt: 2,
    count: 1,
    completed: true,
  });
  await saveWork({
    id: `w-${pid}`,
    profileId: pid,
    modeId: 'trace',
    kind: 'trace',
    title: 't',
    createdAt: 1,
    data: 1,
  });
  await saveMemo({ id: `m-${pid}`, profileId: pid, date: '2026-01-01', text: 't', createdAt: 1 });
  await saveDraft({ profileId: pid, modeId: 'math', variantId: 'v', savedAt: 1, state: 1 });
  await saveFavorites(pid, ['math']);
}

async function counts(pid: string): Promise<number[]> {
  return [
    (await listProgress(pid)).length,
    (await listAttempts(pid)).length,
    (await listRounds(pid)).length,
    (await listWorks(pid)).length,
    (await listMemos(pid)).length,
    (await getDraft(pid, 'math', 'v')) ? 1 : 0,
    (await getFavorites(pid)).length,
  ];
}

describe('プロフィール分離と削除', () => {
  it('deleteProfile は関連レコードを全て消し、他のプロフィールは残す', async () => {
    const a = await createProfile('a', 'x');
    const b = await createProfile('b', 'x');
    await fill(a.id);
    await fill(b.id);
    await saveAppRecord({ activeProfileId: a.id, parentPinHash: 'h' });
    expect(await counts(a.id)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    await deleteProfile(a.id);
    expect(await counts(a.id)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(await counts(b.id)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect((await listProfiles()).map((p) => p.id)).toEqual([b.id]);
    expect(await getAppRecord()).toEqual({ activeProfileId: null, parentPinHash: 'h' });
  });

  it('clearProfileRecords は profile と settings を残す', async () => {
    const a = await createProfile('a', 'x');
    const b = await createProfile('b', 'x');
    await fill(a.id);
    await fill(b.id);
    await saveSettings({ ...defaultSettings(a.id), volume: 0.1 });
    await clearProfileRecords(a.id);
    expect(await counts(a.id)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(await counts(b.id)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(await listProfiles()).toHaveLength(2);
    expect((await getSettings(a.id)).volume).toBe(0.1);
  });
});
