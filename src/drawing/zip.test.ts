// @vitest-environment node
// （jsdom の Blob は fake-indexeddb の複製で中身を失うため、Node 本来の Blob で検査する）
import { describe, expect, it } from 'vitest';
import * as db from '../core/storage/index';
import { closeStorageForTest, DB_NAME } from '../core/storage/db';
import type { ArtworkRecord } from '../core/types';
import { bundleToZip, importArtworksZip, exportArtworksZip, zipToBundle } from './artZip';
import { emptyDoc } from './model';
import { crc32, readZip, writeZip } from './zip';

const bytes = (...xs: number[]) => new Uint8Array(xs);
const PNG = bytes(137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3);

describe('無圧縮 zip', () => {
  it('CRC32 の既知の値', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it('書いて読める（日本語の名前・空のファイル）', () => {
    const z = writeZip([
      { path: 'a.txt', data: new TextEncoder().encode('こんにちは') },
      { path: 'さくひん/空.bin', data: new Uint8Array(0) },
      { path: 'b.png', data: PNG },
    ]);
    // 先頭はローカルヘッダの署名
    expect([...z.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const back = readZip(z);
    expect(back.map((e) => e.path)).toEqual(['a.txt', 'さくひん/空.bin', 'b.png']);
    expect(new TextDecoder().decode(back[0]!.data)).toBe('こんにちは');
    expect([...back[2]!.data]).toEqual([...PNG]);
  });

  it('壊れた中身は CRC で見つける', () => {
    const z = writeZip([{ path: 'x', data: bytes(1, 2, 3, 4) }]);
    z[30 + 1] = 99; // データの1バイト目（ローカルヘッダ 30 + 名前 1）
    expect(() => readZip(z)).toThrow(/CRC/);
  });

  it('zip でないものは読めない', () => {
    expect(() => readZip(bytes(1, 2, 3))).toThrow();
  });

  it('同じ名前は書かない', () => {
    expect(() =>
      writeZip([
        { path: 'a', data: PNG },
        { path: 'a', data: PNG },
      ]),
    ).toThrow();
  });
});

function art(id: string, profileId: string): ArtworkRecord {
  const doc = emptyDoc();
  doc.items = [{ id: 'L1', kind: 'ink', raster: 'ink:L1' }];
  return { id, profileId, title: 'おえかき', createdAt: 1, updatedAt: 2, doc };
}

describe('作品の zip（artworks.json ＋ artworks/*.png）', () => {
  it('束 → zip → 束', () => {
    const z = bundleToZip({
      artworks: [art('a1', 'p1')],
      blobs: [
        { artId: 'a1', kind: 'ink:L1', data: PNG },
        { artId: 'a1', kind: 'thumb', data: PNG },
      ],
    });
    const names = readZip(z).map((e) => e.path);
    expect(names).toEqual(['artworks.json', 'artworks/a1-ink-L1.png', 'artworks/a1-thumb.png']);
    const r = zipToBundle(z);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bundle.artworks[0]!.id).toBe('a1');
    expect(r.bundle.blobs.map((b) => b.kind)).toEqual(['ink:L1', 'thumb']);
  });

  it('作品に属さない画像・PNG でない画像・不正な文書は拒否する', () => {
    const bad1 = bundleToZip({
      artworks: [art('a1', 'p1')],
      blobs: [{ artId: 'zz', kind: 'thumb', data: PNG }],
    });
    expect(zipToBundle(bad1).ok).toBe(false);
    const bad2 = bundleToZip({
      artworks: [art('a1', 'p1')],
      blobs: [{ artId: 'a1', kind: 'thumb', data: bytes(1, 2) }],
    });
    expect(zipToBundle(bad2).ok).toBe(false);
    const broken = { ...art('a1', 'p1'), doc: { version: 2 } };
    expect(zipToBundle(bundleToZip({ artworks: [broken], blobs: [] })).ok).toBe(false);
    expect(zipToBundle(writeZip([{ path: 'x.txt', data: PNG }])).ok).toBe(false);
  });

  it('書き出し → 別のプロフィールへ読み込み（新しい ID、画像も対応する）', async () => {
    await closeStorageForTest();
    await new Promise<void>((res) => {
      const r = indexedDB.deleteDatabase(DB_NAME);
      r.onsuccess = r.onerror = r.onblocked = () => res();
    });
    await db.openStorage();
    const p1 = await db.createProfile('はな', 'cat');
    const p2 = await db.createProfile('そら', 'dog');
    const png = new Blob([PNG], { type: 'image/png' });
    expect(
      await db.saveArtworkChecked(
        art('a1', p1.id),
        { 'ink:L1': png, thumb: png },
        { expectUpdatedAt: null },
      ),
    ).toBe('ok');
    const zip = await exportArtworksZip(p1.id);
    const res = await importArtworksZip(zip, p2.id);
    expect(res).toEqual({ ok: true, added: 1 });
    const list = await db.listArtworks(p2.id);
    expect(list).toHaveLength(1);
    expect(list[0]!.id).not.toBe('a1');
    const b = await db.getArtworkBlob(list[0]!.id, 'ink:L1');
    expect([...new Uint8Array(await b!.arrayBuffer())]).toEqual([...PNG]);
    expect(await db.listArtworks(p1.id)).toHaveLength(1);
  });
});
