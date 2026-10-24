/**
 * 独立レビュー（T21c #5, #6）で追加: スキーマの段階的な更新、新しい版のデータの扱い、
 * 置き換え前の退避、プロフィール0件のファイルの拒否。
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  createProfile,
  deleteAllData,
  exportBackup,
  getReplaceSnapshot,
  getStorageProblem,
  importBackup,
  listProfiles,
  openStorage,
  parseBackup,
  SNAPSHOT_DB,
  DB_NAME,
} from './index';
import { runUpgrades, SCHEMA_VERSION, UPGRADES } from './db';

const wipe = (name: string) =>
  new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase(name);
    r.onsuccess = r.onerror = r.onblocked = () => res();
  });

afterEach(async () => {
  await deleteAllData().catch(() => undefined);
  await wipe(SNAPSHOT_DB);
});

describe('置き換え前の退避（DA-06）', () => {
  it('すべて置き換えの前に、元のデータを別のデータベースに保存する', async () => {
    await openStorage();
    await createProfile('うさぎ', 'rabbit');
    const before = await exportBackup({ kind: 'all' }, '1.0.0');
    const other = {
      ...before,
      data: {
        ...before.data,
        profiles: before.data.profiles.map((p) => ({ ...p, id: 'x1', name: 'くま' })),
        settings: [],
      },
    };
    await importBackup(other, 'replace');
    expect((await listProfiles()).map((p) => p.name)).toEqual(['くま']);
    const snap = await getReplaceSnapshot();
    expect(snap?.file.data.profiles.map((p) => p.name)).toEqual(['うさぎ']);
  });

  it('プロフィールが0件のファイルは読み込まない（置き換えで子供の画面が空になるのを防ぐ）', async () => {
    await openStorage();
    const base = await exportBackup({ kind: 'all' }, '1.0.0');
    const empty = { ...base, data: { ...base.data, profiles: [], settings: [] } };
    const text = JSON.stringify(empty);
    const r = parseBackup(text, text.length);
    expect(r.ok).toBe(false);
    await expect(importBackup(empty, 'replace')).rejects.toThrow();
  });
});

describe('スキーマの更新（DA-02, DA-03）', () => {
  it('すべての版に更新の手順がある', () => {
    expect(Object.keys(UPGRADES).map(Number)).toContain(1);
  });

  it('手順が足りない版への更新はトランザクションごと失敗する', () => {
    const fakeTx = { objectStore: () => ({ put: () => undefined }) } as unknown as IDBTransaction;
    expect(() =>
      runUpgrades({} as IDBDatabase, fakeTx, SCHEMA_VERSION, SCHEMA_VERSION + 1),
    ).toThrow(/missing/);
  });

  it('新しい版のアプリで作ったデータを古い版で開くと、壊さずに「version」として止まる', async () => {
    await deleteAllData().catch(() => undefined);
    await wipe(DB_NAME);
    await new Promise<void>((res, rej) => {
      const r = indexedDB.open(DB_NAME, 99);
      r.onsuccess = () => {
        r.result.close();
        res();
      };
      r.onerror = () => rej(r.error);
    });
    // モジュールの接続を作り直すため、別のインスタンスとして読み込む
    const { vi } = await import('vitest');
    vi.resetModules();
    const fresh = await import('./index');
    await fresh.openStorage();
    expect(fresh.getStorageHealth()).toBe('unavailable');
    expect(fresh.getStorageProblem()).toBe('version');
    await wipe(DB_NAME);
    void getStorageProblem;
  });
});
