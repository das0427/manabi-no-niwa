import { beforeEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '../types';
import {
  SCHEMA_VERSION,
  addAttempt,
  addRound,
  createProfile,
  deleteAllData,
  exportBackup,
  getFavorites,
  getSettings,
  importBackup,
  listAttempts,
  listMemos,
  listProfiles,
  listRounds,
  listWorks,
  migrateBackup,
  openStorage,
  parseBackup,
  saveFavorites,
  saveMemo,
  saveProgress,
  saveSettings,
  saveWork,
  getProgress,
  type BackupFile,
} from './index';

beforeEach(async () => {
  await openStorage();
  await deleteAllData();
});

async function seed(name: string) {
  const p = await createProfile(name, 'cat');
  await saveSettings({ ...defaultSettings(p.id), volume: 0.5, memoryAutoHideSec: 5 });
  await saveProgress({ ...(await getProgress(p.id, 'add')), level: 2, attempted: true });
  await addAttempt({
    profileId: p.id,
    modeId: 'math',
    variantId: 'v',
    skillId: 'add',
    level: 2,
    itemKey: 'k',
    outcome: 'after_hint',
    wrongTries: 1,
    hintsUsed: 1,
    reviewsUsed: 0,
    operationIssue: false,
    inputKind: 'pen',
    at: 1000,
    detail: { a: 1, b: 'x', c: true },
  });
  await addRound({
    profileId: p.id,
    modeId: 'math',
    variantId: 'v',
    startedAt: 1,
    endedAt: 2,
    count: 3,
    completed: true,
  });
  await saveWork({
    id: 'w-' + name,
    profileId: p.id,
    modeId: 'trace',
    kind: 'trace',
    title: 'し',
    createdAt: 5,
    data: { pts: [[1, 2]] },
  });
  await saveMemo({
    id: 'm-' + name,
    profileId: p.id,
    date: '2026-10-24',
    text: 'めも',
    createdAt: 6,
  });
  await saveFavorites(p.id, ['math']);
  return p;
}

/** ID 系を除いた比較用の形 */
async function snapshot() {
  const out = [];
  for (const p of await listProfiles()) {
    out.push({
      name: p.name,
      avatar: p.avatar,
      settings: { ...(await getSettings(p.id)), profileId: '' },
      progress: (await getProgress(p.id, 'add')).level,
      attempts: (await listAttempts(p.id)).map(({ id: _i, profileId: _p, ...r }) => r),
      rounds: (await listRounds(p.id)).map(({ id: _i, profileId: _p, ...r }) => r),
      works: (await listWorks(p.id)).map(({ id: _i, profileId: _p, ...r }) => r),
      memos: (await listMemos(p.id)).map(({ id: _i, profileId: _p, ...r }) => r),
      favorites: await getFavorites(p.id),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function parseOk(file: BackupFile): BackupFile {
  const text = JSON.stringify(file);
  const res = parseBackup(text, text.length);
  if (!res.ok) throw new Error(res.reason);
  return res.file;
}

describe('書き出しと読み込み', () => {
  it('書き出し → 全削除 → 追加で内容が一致（ID以外）', async () => {
    await seed('はな');
    await seed('たろう');
    const before = await snapshot();
    const file = await exportBackup({ kind: 'all' }, '1.0.0');
    expect(file).toMatchObject({
      format: 'manabi-no-niwa-backup',
      schemaVersion: SCHEMA_VERSION,
      scope: 'all',
    });
    await deleteAllData();
    expect(await listProfiles()).toHaveLength(0);
    const res = await importBackup(parseOk(file), 'add');
    expect(res.addedProfiles.slice().sort()).toEqual(['たろう', 'はな'].sort());
    expect(res.replaced).toBe(false);
    expect(await snapshot()).toEqual(before);
  });

  it('add を2回行っても重複せず、名前に（2）が付き、IDは別になる', async () => {
    await seed('はな');
    const file = parseOk(await exportBackup({ kind: 'all' }, '1.0.0'));
    const r1 = await importBackup(file, 'add');
    const r2 = await importBackup(file, 'add');
    expect(r1.addedProfiles).toEqual(['はな（2）']);
    expect(r2.addedProfiles).toEqual(['はな（3）']);
    const ps = await listProfiles();
    expect(ps.map((p) => p.name)).toEqual(['はな', 'はな（2）', 'はな（3）']);
    expect(new Set(ps.map((p) => p.id)).size).toBe(3);
    const works = await Promise.all(ps.map((p) => listWorks(p.id)));
    expect(new Set(works.flat().map((w) => w.id)).size).toBe(3);
    for (const p of ps) expect(await listAttempts(p.id)).toHaveLength(1);
  });

  it('プロフィール単位の書き出し', async () => {
    const a = await seed('a');
    await seed('b');
    const f = await exportBackup({ kind: 'profile', profileId: a.id }, '1.0.0');
    expect(f.scope).toBe('profile');
    expect(f.data.profiles.map((p) => p.name)).toEqual(['a']);
    expect(f.data.attempts).toHaveLength(1);
    expect(f.data.works).toHaveLength(1);
  });

  it('replace は既存を消して入れ、PINは残す', async () => {
    await seed('はな');
    const file = parseOk(await exportBackup({ kind: 'all' }, '1.0.0'));
    const other = await createProfile('消える', 'x');
    expect(other.name).toBe('消える');
    const res = await importBackup(file, 'replace');
    expect(res.replaced).toBe(true);
    const ps = await listProfiles();
    expect(ps.map((p) => p.name)).toEqual(['はな']);
    expect(ps[0]?.id).toBe(file.data.profiles[0]?.id);
    expect(await listAttempts(ps[0]!.id)).toHaveLength(1);
  });
});

describe('parseBackup', () => {
  const valid = async () =>
    JSON.stringify(
      await (async () => {
        await seed('a');
        return exportBackup({ kind: 'all' }, '1');
      })(),
    );

  it('正常なファイルは ok と概要を返す', async () => {
    const t = await valid();
    const res = parseBackup(t, t.length);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.summary.profiles).toEqual([{ name: 'a', attempts: 1, works: 1 }]);
  });

  it('サイズ超過・不正JSON・format違い・新しすぎる版を拒否', async () => {
    const t = await valid();
    expect(parseBackup(t, 50 * 1024 * 1024 + 1).ok).toBe(false);
    expect(parseBackup('{oops', 5).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ format: 'other' }), 20).ok).toBe(false);
    const j = JSON.parse(t);
    const newer = JSON.stringify({ ...j, schemaVersion: SCHEMA_VERSION + 1 });
    const res = parseBackup(newer, newer.length);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain('新しい版');
  });

  it('型不正（名前が長すぎ・outcome 不正・孤立レコード・メモ長すぎ）を拒否', async () => {
    const j = JSON.parse(await valid());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const run = (mut: (d: any) => void) => {
      const c = structuredClone(j);
      mut(c.data);
      const t = JSON.stringify(c);
      return parseBackup(t, t.length);
    };
    expect(run((d) => (d.profiles[0].name = 'あ'.repeat(41))).ok).toBe(false);
    expect(run((d) => (d.profiles[0].name = '')).ok).toBe(false);
    expect(run((d) => (d.attempts[0].outcome = 'bogus')).ok).toBe(false);
    expect(run((d) => (d.attempts[0].modeId = 'nope')).ok).toBe(false);
    expect(run((d) => (d.attempts[0].profileId = 'ghost')).ok).toBe(false);
    expect(run((d) => (d.memos[0].text = 'x'.repeat(2001))).ok).toBe(false);
    expect(run((d) => (d.settings[0].roundSize = 9)).ok).toBe(false);
    expect(run((d) => (d.progress[0].level = 'x')).ok).toBe(false);
    expect(run((d) => (d.works[0].kind = 'zzz')).ok).toBe(false);
    expect(run((d) => (d.profiles = 'x')).ok).toBe(false);
  });

  it('拒否したファイルはデータを変更しない', async () => {
    await seed('a');
    const before = await snapshot();
    parseBackup('{oops', 5);
    expect(await snapshot()).toEqual(before);
  });
});

describe('migrateBackup', () => {
  const v0 = (): BackupFile => ({
    format: 'manabi-no-niwa-backup',
    schemaVersion: 0,
    appVersion: '0.1',
    exportedAt: '2026-01-01T00:00:00.000Z',
    scope: 'all',
    data: {
      profiles: [{ id: 'p1', name: '旧', avatar: 'cat', createdAt: 1 }],
      settings: [{ profileId: 'p1', volume: 0.2 } as never],
      progress: [],
      attempts: [],
      rounds: [],
      works: [],
      memos: [],
      favorites: [],
    },
  });

  it('v0 は memoryAutoHideSec=0 を補って v1 になる（入力は変更しない）', () => {
    const input = v0();
    const out = migrateBackup(input);
    expect(out.schemaVersion).toBe(1);
    expect(out.data.settings[0]).toMatchObject({ volume: 0.2, memoryAutoHideSec: 0 });
    expect(input.schemaVersion).toBe(0);
    expect('memoryAutoHideSec' in (input.data.settings[0] as object)).toBe(false);
  });

  it('現行版はそのまま', () => {
    const f = { ...v0(), schemaVersion: SCHEMA_VERSION };
    expect(migrateBackup(f)).toEqual(f);
  });

  it('旧版ファイルを読み込み → 追加できる（設定は既定で補完）', async () => {
    const t = JSON.stringify(v0());
    const res = parseBackup(t, t.length);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.file.schemaVersion).toBe(SCHEMA_VERSION);
    await importBackup(res.file, 'add');
    const [p] = await listProfiles();
    expect(p?.name).toBe('旧');
    const s = await getSettings(p!.id);
    expect(s.volume).toBe(0.2);
    expect(s.memoryAutoHideSec).toBe(0);
    expect(s.roundSize).toBe(4);
  });
});
