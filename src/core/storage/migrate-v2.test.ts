// @vitest-environment node
// （jsdom の Blob は fake-indexeddb の複製で中身を失うため、Node 本来の Blob で検査する）
/**
 * スキーマ1 → 2 の移行（docs/expansion/acceptance.md 4章, architecture.md 9章）。
 * v1 の形のデータベースを作り、v2 のアプリで開いて、記録が残り・変換されないことを確かめる。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DB_NAME, UPGRADES } from './db';

const wipe = (name: string) =>
  new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase(name);
    r.onsuccess = r.onerror = r.onblocked = () => res();
  });

/** v1.0.0 と同じ形のデータベースを作る（UPGRADES[1] だけを適用） */
async function makeV1(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      UPGRADES[1]!(req.result, req.transaction!);
      const tx = req.transaction!;
      tx.objectStore('meta').put(
        { schemaVersion: 1, createdAt: 1, lastAppVersion: '1.0.0' },
        'meta',
      );
      tx.objectStore('profiles').put({ id: 'p1', name: 'はな', avatar: 'cat', createdAt: 10 });
      tx.objectStore('profiles').put({ id: 'p2', name: 'そら', avatar: 'dog', createdAt: 20 });
      tx.objectStore('settings').put({
        profileId: 'p1',
        volume: 0.3,
        sfx: false,
        reduceMotion: true,
        sessionMinutes: 15,
        roundSize: 3,
        homeDisplay: 'all',
        visibleModes: ['shopping'],
        traceTolerance: { touch: 'wide', pen: 'normal', mouse: 'wide' },
        memoryAutoHideSec: 5,
        levelLocks: { kana: 1 },
      });
      tx.objectStore('progress').put({
        profileId: 'p1',
        skillId: 'kana',
        level: 2,
        window: ['independent', 'after_hint'],
        mastered: true,
        attempted: true,
        changedAt: 100,
        lastChange: null,
      });
      tx.objectStore('works').put({
        id: 'w1',
        profileId: 'p1',
        modeId: 'trace',
        kind: 'trace',
        title: 'し',
        createdAt: 50,
        data: { strokes: [[1, 2]] },
      });
      tx.objectStore('memos').put({
        id: 'm1',
        profileId: 'p2',
        date: '2026-10-01',
        text: 'メモ',
        createdAt: 60,
      });
    };
    req.onsuccess = () => {
      req.result.close();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

async function freshStorage() {
  vi.resetModules();
  return import('./index');
}

afterEach(async () => {
  await wipe(DB_NAME);
});

describe('スキーマ1 → 2', () => {
  it('プロフィール・設定・作品・メモが残り、4歳向けとして扱われる', async () => {
    await wipe(DB_NAME);
    await makeV1();
    const s = await freshStorage();
    await s.openStorage();
    expect(s.getStorageHealth()).toBe('ok');

    const profiles = await s.listProfiles();
    expect(profiles.map((p) => [p.name, p.audience])).toEqual([
      ['はな', 'p4'],
      ['そら', 'p4'],
    ]);
    const set = await s.getSettings('p1');
    expect(set).toMatchObject({
      volume: 0.3,
      sfx: false,
      sessionMinutes: 15,
      levelLocks: { kana: 1 },
    });
    expect(set.support).toMatchObject({
      furigana: 'unlearned',
      readAloud: 'always',
      style: 'gentle',
    });
    expect((await s.listWorks('p1')).map((w) => w.id)).toEqual(['w1']);
    expect((await s.listMemos('p2')).map((m) => m.text)).toEqual(['メモ']);
  });

  it('v1 の進度は変換しない（旧記録のまま。新しい単元の習得済みにしない）', async () => {
    await wipe(DB_NAME);
    await makeV1();
    const s = await freshStorage();
    await s.openStorage();
    const old = await s.getProgress('p1', 'kana');
    expect(old).toMatchObject({ level: 2, mastered: true, window: ['independent', 'after_hint'] });
    expect(await s.listUnitProgress('p1')).toEqual([]);
  });

  it('移行の途中で失敗すると、元のデータが v1 のまま残る', async () => {
    await wipe(DB_NAME);
    await makeV1();
    const s = await freshStorage();
    const db = await import('./db');
    const orig = db.UPGRADES[2]!;
    db.UPGRADES[2] = (d, tx) => {
      orig(d, tx);
      throw new Error('boom');
    };
    try {
      await expect(async () => {
        // versionchange 内の例外で open は失敗する
        await new Promise<void>((resolve, reject) => {
          const req = indexedDB.open(DB_NAME, 2);
          req.onupgradeneeded = (ev) => {
            try {
              db.runUpgrades(req.result, req.transaction!, ev.oldVersion, 2);
            } catch (e) {
              req.transaction!.abort();
              reject(e);
            }
          };
          req.onsuccess = () => {
            req.result.close();
            resolve();
          };
          req.onerror = () => reject(req.error);
        });
      }).rejects.toThrow();
    } finally {
      db.UPGRADES[2] = orig;
    }
    void s;
    const v = await new Promise<{ version: number; stores: string[]; profile: unknown }>(
      (resolve, reject) => {
        const req = indexedDB.open(DB_NAME);
        req.onsuccess = () => {
          const d = req.result;
          const g = d.transaction('profiles').objectStore('profiles').get('p1');
          g.onsuccess = () => {
            resolve({ version: d.version, stores: [...d.objectStoreNames], profile: g.result });
            d.close();
          };
        };
        req.onerror = () => reject(req.error);
      },
    );
    expect(v.version).toBe(1);
    expect(v.stores).not.toContain('artworks');
    expect(v.profile).toEqual({ id: 'p1', name: 'はな', avatar: 'cat', createdAt: 10 });
  });
});

describe('スキーマ2 の作品・単元の進度', () => {
  const png = () => new Blob([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], { type: 'image/png' });
  const art = (profileId: string, id = 'a1') => ({
    id,
    profileId,
    title: 'くま',
    createdAt: 1,
    updatedAt: 2,
    doc: { version: 2, objects: [{ kind: 'stamp', stampId: 'bear' }] },
  });

  it('書き出し → すべて置き換え で作品の画像も戻る', async () => {
    await wipe(DB_NAME);
    const s = await freshStorage();
    const p = await s.createProfile('はな', 'cat', { audience: 'g3', enrolledGrade: 3 });
    expect((await s.getSettings(p.id)).support.readAloud).toBe('button');
    expect(await s.saveArtwork(art(p.id), { under: png(), thumb: png() })).toBe(true);
    await s.saveUnitProgress({ ...s.emptyUnitProgress(p.id, 'g3.math.division'), attempted: true });

    const file = await s.exportBackup({ kind: 'all' }, 'test');
    expect(file.data.artworkBlobs).toHaveLength(2);
    expect(file.data.artworkBlobs[0]!.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    const text = JSON.stringify(file);
    const parsed = s.parseBackup(text, text.length);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    await s.deleteArtwork('a1');
    expect(await s.getArtworkBlob('a1', 'under')).toBeUndefined();
    await s.importBackup(parsed.file, 'replace');

    const back = await s.getArtworkBlob('a1', 'under');
    expect(back).toBeDefined();
    expect([...new Uint8Array(await back!.arrayBuffer())]).toEqual([137, 80, 78, 71, 1, 2, 3]);
    expect((await s.listArtworks(p.id)).map((a) => a.title)).toEqual(['くま']);
    expect((await s.listUnitProgress(p.id)).map((u) => u.unitId)).toEqual(['g3.math.division']);
    const [prof] = await s.listProfiles();
    expect(prof).toMatchObject({ audience: 'g3', enrolledGrade: 3 });
  });

  it('追加の読み込みでは作品と画像に新しいIDを振り、対応を保つ', async () => {
    await wipe(DB_NAME);
    const s = await freshStorage();
    const p = await s.createProfile('はな', 'cat');
    await s.saveArtwork(art(p.id), { under: png() });
    const file = await s.exportBackup({ kind: 'all' }, 'test');
    await s.importBackup(file, 'add');
    const profiles = await s.listProfiles();
    expect(profiles).toHaveLength(2);
    const added = (await s.listArtworks(profiles[1]!.id))[0]!;
    expect(added.id).not.toBe('a1');
    expect(await s.getArtworkBlob(added.id, 'under')).toBeDefined();
  });

  it('プロフィールを消すと作品の画像も消える（孤児を残さない）', async () => {
    await wipe(DB_NAME);
    const s = await freshStorage();
    const p = await s.createProfile('はな', 'cat');
    await s.saveArtwork(art(p.id), { under: png(), full: png() });
    await s.deleteProfile(p.id);
    expect(await s.getArtwork('a1')).toBeUndefined();
    expect(await s.getArtworkBlob('a1', 'under')).toBeUndefined();
    expect(await s.getArtworkBlob('a1', 'full')).toBeUndefined();
  });

  it('作品に属さない画像・他人の作品の画像を含むファイルは拒否する', async () => {
    await wipe(DB_NAME);
    const s = await freshStorage();
    const p = await s.createProfile('はな', 'cat');
    await s.saveArtwork(art(p.id), { under: png() });
    const file = await s.exportBackup({ kind: 'all' }, 'test');
    const broken = {
      ...file,
      data: {
        ...file.data,
        artworkBlobs: [{ ...file.data.artworkBlobs[0]!, artId: 'zz', key: 'zz:under' }],
      },
    };
    const t = JSON.stringify(broken);
    expect(s.parseBackup(t, t.length).ok).toBe(false);
  });
});
