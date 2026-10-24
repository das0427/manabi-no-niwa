/**
 * 作品の保存・読み込み（IndexedDB の artworks / artworkBlobs。X-SV-01）。
 * 画像の種類: base（焼き付けた層）、`ink:<itemId>`（インクの層）、full（閲覧用の合成）、thumb（縮小）。
 */
import * as db from '../core/storage/index';
import type { ArtworkBlobKind, ArtworkRecord } from '../core/types';
import type { Prepared, QuickPayload } from './autosave';
import { BASE_KEY, DrawingEngine, canvasToPng } from './engine';
import { DOC_H, DOC_W, parseDoc, pruneAssets, type ArtDoc } from './model';

export const THUMB_W = 320;

export interface ArtMeta {
  id: string;
  profileId: string;
  title: string;
  createdAt: number;
}

/** 保存の状態（どの層をどの rev まで保存したか） */
export class SaveBook {
  /** 層 → 保存した rev */
  readonly savedLayerRev = new Map<string, number>();
  /** DB に画像がある層 */
  readonly persisted = new Set<string>();

  markAllPersisted(engine: DrawingEngine): void {
    for (const it of engine.doc.items) {
      if (it.kind === 'ink' && it.raster) {
        this.persisted.add(it.id);
        this.savedLayerRev.set(it.id, 0);
      }
    }
    if (engine.doc.base) {
      this.persisted.add(BASE_KEY);
      this.savedLayerRev.set(BASE_KEY, 0);
    }
  }
}

const inkKind = (id: string): ArtworkBlobKind => `ink:${id}`;

function docForSave(doc: ArtDoc, rasterOf: (id: string) => string | null, base: boolean): ArtDoc {
  return {
    ...doc,
    base: base ? 'base' : null,
    items: doc.items.map((it) => (it.kind === 'ink' ? { ...it, raster: rasterOf(it.id) } : it)),
    assets: pruneAssets(doc),
  };
}

function record(meta: ArtMeta, doc: ArtDoc, updatedAt: number, dirty: boolean): ArtworkRecord {
  const d: ArtDoc = { ...doc };
  if (dirty) d.dirty = true;
  else delete d.dirty;
  return { ...meta, updatedAt, doc: d };
}

/**
 * 保存の材料を作る。画像は呼んだ時点の内容で作る（toBlob はその時点の絵を写す）。
 * 変わった層だけを PNG にし、閲覧用（full）と縮小（thumb）は毎回作る。
 */
export async function prepareSave(
  engine: DrawingEngine,
  meta: ArtMeta,
  book: SaveBook,
): Promise<Prepared & { layerRevs: Map<string, number> }> {
  const rev = engine.rev;
  const doc = engine.doc;
  const layerRevs = new Map<string, number>();
  const jobs: Promise<[ArtworkBlobKind, Blob]>[] = [];
  const inkIds = doc.items.filter((it) => it.kind === 'ink').map((it) => it.id);
  for (const id of inkIds) {
    const r = engine.layerRev.get(id) ?? 0;
    layerRevs.set(id, r);
    if (book.persisted.has(id) && (book.savedLayerRev.get(id) ?? -1) >= r) continue;
    const c = engine.layers.get(id);
    if (c) jobs.push(canvasToPng(c).then((b) => [inkKind(id), b]));
  }
  const baseUsed = engine.baseUsed;
  if (baseUsed) {
    const r = engine.layerRev.get(BASE_KEY) ?? 0;
    layerRevs.set(BASE_KEY, r);
    if (!book.persisted.has(BASE_KEY) || (book.savedLayerRev.get(BASE_KEY) ?? -1) < r) {
      jobs.push(canvasToPng(engine.base).then((b) => ['base', b]));
    }
  }
  const done = await Promise.all(jobs);
  const blobs: Partial<Record<ArtworkBlobKind, Blob>> = {};
  for (const [k, b] of done) blobs[k] = b;
  const saved = docForSave(doc, (id) => inkKind(id), baseUsed);
  const keep: ArtworkBlobKind[] = [
    ...inkIds.map(inkKind),
    ...(baseUsed ? (['base'] as const) : []),
    'full',
    'thumb',
  ];
  return {
    rev,
    blobs,
    keep,
    layerRevs,
    record: (updatedAt, dirty) => record(meta, saved, updatedAt, dirty),
  };
}

/** 閲覧用（full: 論理 1600×1000、背景色つき）と縮小（thumb）の画像 */
export async function renderPreview(
  engine: DrawingEngine,
): Promise<Partial<Record<ArtworkBlobKind, Blob>>> {
  const full = engine.composeCanvas(DOC_W);
  const thumb = document.createElement('canvas');
  thumb.width = THUMB_W;
  thumb.height = Math.round((THUMB_W * DOC_H) / DOC_W);
  thumb.getContext('2d')!.drawImage(full, 0, 0, thumb.width, thumb.height);
  const [f, t] = await Promise.all([canvasToPng(full), canvasToPng(thumb)]);
  return { full: f, thumb: t };
}

/** 保存できたあとに、保存済みの層を記録する */
export function markSaved(book: SaveBook, p: Prepared & { layerRevs?: Map<string, number> }): void {
  for (const [id, r] of p.layerRevs ?? []) {
    book.savedLayerRev.set(id, r);
    book.persisted.add(id);
  }
}

/** ページを閉じるとき: アイテムの JSON とダーティ印（画像は作り終えたものだけ） */
export function quickSave(
  engine: DrawingEngine,
  meta: ArtMeta,
  book: SaveBook,
  prepared: Prepared | null,
): QuickPayload {
  if (prepared) return { record: prepared.record, blobs: prepared.blobs };
  const doc = docForSave(
    engine.doc,
    (id) => (book.persisted.has(id) ? inkKind(id) : null),
    book.persisted.has(BASE_KEY),
  );
  return { record: (u, dirty) => record(meta, doc, u, dirty), blobs: {} };
}

export interface OpenedArt {
  engine: DrawingEngine;
  meta: ArtMeta;
  updatedAt: number;
  dirty: boolean;
}

/** 作品を開く（画像を層に描く）。開けなければ null */
export async function openArtwork(id: string): Promise<OpenedArt | null> {
  const rec = await db.getArtwork(id);
  if (!rec) return null;
  const doc = parseDoc(rec.doc);
  if (!doc) return null;
  const engine = new DrawingEngine(doc);
  await engine.loadRasters((kind) => db.getArtworkBlob(id, kind as ArtworkBlobKind));
  return {
    engine,
    meta: { id: rec.id, profileId: rec.profileId, title: rec.title, createdAt: rec.createdAt },
    updatedAt: rec.updatedAt,
    dirty: doc.dirty === true,
  };
}

/** 作品を複製する（「うつして かく」）。新しい ID を返す */
export async function duplicateArtwork(id: string): Promise<string | null> {
  const rec = await db.getArtwork(id);
  if (!rec) return null;
  const kinds = await db.listArtworkBlobKinds(id);
  const blobs: Partial<Record<ArtworkBlobKind, Blob>> = {};
  for (const k of kinds) {
    const b = await db.getArtworkBlob(id, k);
    if (b) blobs[k] = b;
  }
  const now = Date.now();
  const copy: ArtworkRecord = { ...rec, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  const res = await db.saveArtworkChecked(copy, blobs, { expectUpdatedAt: null });
  return res === 'ok' ? copy.id : null;
}

/** 一番新しい「つくりかけ」の作品（再開時に開く） */
export async function findUnfinished(profileId: string): Promise<string | null> {
  const list = await db.listArtworks(profileId);
  const hit = list.find((a) => (a.doc as { dirty?: boolean } | null)?.dirty === true);
  return hit?.id ?? null;
}
