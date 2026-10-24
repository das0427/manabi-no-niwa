/**
 * 作品だけの zip 書き出し・読み込み（review-1 #16）。記録全体のバックアップとの統合は統括が行うので、
 * ここは独立した関数として公開する（src/drawing/index.ts）。
 *
 * 形式（無圧縮 zip）:
 *   artworks.json            { format, version, exportedAt, artworks: ArtworkRecord[], files: [{ path, artId, kind }] }
 *   artworks/<artId>-<kind>.png  画像（kind の ':' は '-' にする。対応は files の表が正）
 */
import * as db from '../core/storage/index';
import { validateArtwork } from '../core/storage/validate';
import { isArtworkBlobKind, type ArtworkBlobKind, type ArtworkRecord } from '../core/types';
import { parseDoc } from './model';
import { readZip, writeZip, ZipError, type ZipEntry } from './zip';

export const ART_ZIP_FORMAT = 'manabi-no-niwa-artworks';
export const ART_ZIP_VERSION = 1;
/** 読み込む zip の上限（review-1 #16） */
export const MAX_ZIP_BYTES = 500 * 1024 * 1024;

interface FileRef {
  path: string;
  artId: string;
  kind: ArtworkBlobKind;
}

export interface ArtBundle {
  artworks: ArtworkRecord[];
  blobs: { artId: string; kind: ArtworkBlobKind; data: Uint8Array }[];
}

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
const isPng = (b: Uint8Array) => PNG_SIG.every((x, i) => b[i] === x);

/** 作品と画像の束 → zip のバイト列（純粋な関数） */
export function bundleToZip(bundle: ArtBundle, at = new Date()): Uint8Array<ArrayBuffer> {
  const files: FileRef[] = [];
  const entries: ZipEntry[] = [];
  for (const b of bundle.blobs) {
    const safeKind = b.kind.replace(':', '-');
    const path = `artworks/${b.artId}-${safeKind}.png`;
    files.push({ path, artId: b.artId, kind: b.kind });
    entries.push({ path, data: b.data });
  }
  const manifest = {
    format: ART_ZIP_FORMAT,
    version: ART_ZIP_VERSION,
    exportedAt: at.toISOString(),
    artworks: bundle.artworks,
    files,
  };
  return writeZip(
    [
      { path: 'artworks.json', data: new TextEncoder().encode(JSON.stringify(manifest)) },
      ...entries,
    ],
    at,
  );
}

export type ParseZipResult = { ok: true; bundle: ArtBundle } | { ok: false; reason: string };

/** zip のバイト列 → 検証した作品と画像の束（純粋な関数。何も保存しない） */
export function zipToBundle(bytes: Uint8Array): ParseZipResult {
  if (bytes.length > MAX_ZIP_BYTES)
    return { ok: false, reason: 'ファイルが大きすぎます（500MBまで）。' };
  let entries: ZipEntry[];
  try {
    entries = readZip(bytes);
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof ZipError ? e.message : 'zip を読み取れませんでした。',
    };
  }
  const byPath = new Map(entries.map((e) => [e.path, e.data]));
  const mf = byPath.get('artworks.json');
  if (!mf) return { ok: false, reason: '作品の zip ではありません（artworks.json がない）。' };
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(mf));
  } catch {
    return { ok: false, reason: 'artworks.json を読み取れませんでした。' };
  }
  const j = json as { format?: unknown; version?: unknown; artworks?: unknown; files?: unknown };
  if (j.format !== ART_ZIP_FORMAT || j.version !== ART_ZIP_VERSION) {
    return { ok: false, reason: '作品の zip の形式が違います。' };
  }
  if (!Array.isArray(j.artworks) || !Array.isArray(j.files)) {
    return { ok: false, reason: 'artworks.json の内容が正しくありません。' };
  }
  const artworks: ArtworkRecord[] = [];
  for (const raw of j.artworks) {
    const a = validateArtwork(raw);
    if (!a || !parseDoc(a.doc)) return { ok: false, reason: '作品の情報が正しくありません。' };
    artworks.push(a);
  }
  const ids = new Set(artworks.map((a) => a.id));
  if (ids.size !== artworks.length) return { ok: false, reason: '作品の ID が重複しています。' };
  const blobs: ArtBundle['blobs'] = [];
  const seen = new Set<string>();
  for (const f of j.files as FileRef[]) {
    if (typeof f?.path !== 'string' || !ids.has(f.artId) || !isArtworkBlobKind(f.kind)) {
      return { ok: false, reason: '作品に属さない画像が含まれています。' };
    }
    const key = `${f.artId}:${f.kind}`;
    if (seen.has(key)) return { ok: false, reason: '画像が重複しています。' };
    seen.add(key);
    const data = byPath.get(f.path);
    if (!data || !isPng(data))
      return { ok: false, reason: `画像が見つからないか PNG ではありません: ${f.path}` };
    blobs.push({ artId: f.artId, kind: f.kind, data });
  }
  return { ok: true, bundle: { artworks, blobs } };
}

/** プロフィールの作品を zip にする（保護者の書き出し） */
export async function exportArtworksZip(profileId: string): Promise<Blob> {
  const artworks = await db.listArtworks(profileId);
  const blobs: ArtBundle['blobs'] = [];
  for (const a of artworks) {
    for (const kind of await db.listArtworkBlobKinds(a.id)) {
      const b = await db.getArtworkBlob(a.id, kind);
      if (b) blobs.push({ artId: a.id, kind, data: new Uint8Array(await b.arrayBuffer()) });
    }
  }
  return new Blob([bundleToZip({ artworks, blobs })], { type: 'application/zip' });
}

/**
 * zip の作品をプロフィールに追加する（既存の作品は変えない。新しい ID を振る）。
 * 追加した作品の数を返す。
 */
export async function importArtworksZip(
  file: Blob,
  profileId: string,
): Promise<{ ok: true; added: number } | { ok: false; reason: string }> {
  if (file.size > MAX_ZIP_BYTES)
    return { ok: false, reason: 'ファイルが大きすぎます（500MBまで）。' };
  const parsed = zipToBundle(new Uint8Array(await file.arrayBuffer()));
  if (!parsed.ok) return parsed;
  let added = 0;
  for (const a of parsed.bundle.artworks) {
    const id = crypto.randomUUID();
    const blobs: Partial<Record<ArtworkBlobKind, Blob>> = {};
    for (const b of parsed.bundle.blobs) {
      if (b.artId === a.id) blobs[b.kind] = new Blob([b.data.slice()], { type: 'image/png' });
    }
    const res = await db.saveArtworkChecked({ ...a, id, profileId }, blobs, {
      expectUpdatedAt: null,
    });
    if (res !== 'ok') return { ok: false, reason: `保存できませんでした（${added} 件まで追加）。` };
    added++;
  }
  return { ok: true, added };
}
