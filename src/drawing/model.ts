/**
 * おえかきの文書モデル（docs/expansion/architecture.md 7.1、review-1 #1）。純粋なデータと関数。
 *
 * - 重なり順: 背景 → base（焼き付けた絵）→ items を先頭から順に（先頭＝いちばん奥、末尾＝いちばん手前）
 * - 手描きの線と塗りは「インクの層」（kind 'ink'）として、はんこ・図形と同じ列に入る
 * - 線・塗りを始めるとき: 列の一番上がインクの層ならそこへ、違えば新しいインクの層を一番上に作る
 * - インクの層は最大 MAX_INK 枚。超えるときは一番下のインクの層とその下のオブジェクトを base に焼き付ける
 */

export const DOC_W = 1600;
export const DOC_H = 1000;
export const MAX_INK = 6;
export const DOC_VERSION = 2;

export const SHAPE_KINDS = [
  'circle',
  'ellipse',
  'triangle',
  'rect',
  'star',
  'heart',
  'line',
] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

export interface InkItem {
  id: string;
  kind: 'ink';
  /** 保存した画像の種類（ArtworkBlobKind `ink:<id>`）。まだ画像が無ければ null（空の層） */
  raster: string | null;
}
export interface StampItem {
  id: string;
  kind: 'stamp';
  /** "<stampId>@<version>"。SVG は doc.assets に1つだけ持つ */
  asset: string;
  /** 中心（論理座標） */
  x: number;
  y: number;
  /** 一辺（論理座標。絵は 100×100 の正方形） */
  size: number;
  /** 度（時計回り） */
  rotation: number;
  flipX: boolean;
}
export interface ShapeItem {
  id: string;
  kind: 'shape';
  shape: ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  stroke: string;
  strokeWidth: number;
  fill: string | null;
}
export type ObjItem = StampItem | ShapeItem;
export type ArtItem = InkItem | ObjItem;

export type ArtBackground =
  { kind: 'color'; color: string } | { kind: 'template'; templateId: string; svg: string };

export type ArtOrigin = { kind: 'free' } | { kind: 'lesson'; unitId: string; itemId: string };

/** 作品の文書（ArtworkRecord.doc に入れる JSON） */
export interface ArtDoc {
  version: 2;
  width: number;
  height: number;
  background: ArtBackground;
  /** 焼き付けた背景の層の画像（ArtworkBlobKind 'base'）。無ければ null */
  base: string | null;
  items: ArtItem[];
  assets: Record<string, string>;
  /** 学習連携（X-DL）。自由なおえかきは { kind: 'free' } */
  origin: ArtOrigin;
  /** ページを閉じるときに書いた（画像が最新でないかもしれない）。再開時に「つくりかけ」として開く */
  dirty?: boolean;
}

/** 作品の紙の色（surface）。PNG にも含める（R#30） */
export const PAPER_COLOR = '#FFFDF8';

export function emptyDoc(origin: ArtOrigin = { kind: 'free' }): ArtDoc {
  return {
    version: DOC_VERSION,
    width: DOC_W,
    height: DOC_H,
    background: { kind: 'color', color: PAPER_COLOR },
    base: null,
    items: [],
    assets: {},
    origin,
  };
}

let seq = 0;
/** 項目の ID（ArtworkBlobKind に入るので [A-Za-z0-9_-]） */
export function newId(prefix = 'i'): string {
  seq = (seq + 1) % 1_000_000;
  const rnd = Math.floor(Math.random() * 36 ** 6).toString(36);
  return `${prefix}${Date.now().toString(36)}${seq.toString(36)}${rnd}`;
}

export const isInk = (it: ArtItem): it is InkItem => it.kind === 'ink';
export const isObj = (it: ArtItem): it is ObjItem => it.kind !== 'ink';

export function inkCount(items: readonly ArtItem[]): number {
  return items.reduce((n, it) => n + (it.kind === 'ink' ? 1 : 0), 0);
}

/** 焼き付けの計画: 一番下のインクの層と、それより下（奥）のすべての項目 */
export interface BakePlan {
  /** 焼き付ける項目の ID（重なり順） */
  ids: string[];
}

export type InkTarget = { kind: 'existing'; id: string } | { kind: 'new'; bake: BakePlan | null };

/**
 * 線・塗りの書き込み先（R#1、統括の判断2: 塗りもペンと同じ規則）。
 * 一番上がインクの層ならそこ。違えば新しい層を一番上に作る。6枚を超えるなら先に焼き付ける。
 */
export function planInkTarget(items: readonly ArtItem[]): InkTarget {
  const top = items[items.length - 1];
  if (top && top.kind === 'ink') return { kind: 'existing', id: top.id };
  if (inkCount(items) < MAX_INK) return { kind: 'new', bake: null };
  const lowest = items.findIndex((it) => it.kind === 'ink');
  return { kind: 'new', bake: { ids: items.slice(0, lowest + 1).map((it) => it.id) } };
}

/** 焼き付けた項目を列から外す */
export function withoutIds(items: readonly ArtItem[], ids: readonly string[]): ArtItem[] {
  const s = new Set(ids);
  return items.filter((it) => !s.has(it.id));
}

export type ZMove = 'forward' | 'backward' | 'front' | 'back';

/** 重なり順を変える（てまえへ／おくへ）。動かせない・変わらないときは同じ配列を返す */
export function moveZ(items: readonly ArtItem[], id: string, how: ZMove): readonly ArtItem[] {
  const i = items.findIndex((it) => it.id === id);
  if (i < 0) return items;
  const out = [...items];
  const [it] = out.splice(i, 1);
  const j =
    how === 'forward'
      ? Math.min(items.length - 1, i + 1)
      : how === 'backward'
        ? Math.max(0, i - 1)
        : how === 'front'
          ? items.length - 1
          : 0;
  if (j === i) return items;
  out.splice(j, 0, it!);
  return out;
}

export function replaceItem(items: readonly ArtItem[], next: ArtItem): ArtItem[] {
  return items.map((it) => (it.id === next.id ? next : it));
}

/** オブジェクトの中心はキャンバスの中に制限する（X-ED-04） */
export function clampCenter(x: number, y: number): { x: number; y: number } {
  return { x: Math.min(DOC_W, Math.max(0, x)), y: Math.min(DOC_H, Math.max(0, y)) };
}

/** 「みつける」: 中心が外にあるオブジェクトを内側（余白 80）へ寄せる */
export function bringInside(items: readonly ArtItem[], margin = 80): ArtItem[] {
  return items.map((it) => {
    if (it.kind === 'ink') return it;
    const x = Math.min(DOC_W - margin, Math.max(margin, it.x));
    const y = Math.min(DOC_H - margin, Math.max(margin, it.y));
    return x === it.x && y === it.y ? it : { ...it, x, y };
  });
}

/** 使われていない素材を除く（保存時） */
export function pruneAssets(doc: ArtDoc): Record<string, string> {
  const used = new Set(doc.items.flatMap((it) => (it.kind === 'stamp' ? [it.asset] : [])));
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(doc.assets)) if (used.has(k)) out[k] = v;
  return out;
}

// ---------------------------------------------------------------- 検証（保存データ・読み込み）

const isRec = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const fin = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const COLOR = /^#[0-9A-Fa-f]{6}$/;
const ASSET = /^[a-z0-9-]{1,40}@\d{1,4}$/;

function parseItem(x: unknown): ArtItem | null {
  if (!isRec(x) || typeof x.id !== 'string' || !ID.test(x.id)) return null;
  if (x.kind === 'ink') {
    const raster = x.raster === null || x.raster === undefined ? null : x.raster;
    if (raster !== null && raster !== `ink:${x.id}`) return null;
    return { id: x.id, kind: 'ink', raster };
  }
  if (!fin(x.x) || !fin(x.y) || !fin(x.rotation)) return null;
  if (x.kind === 'stamp') {
    if (typeof x.asset !== 'string' || !ASSET.test(x.asset)) return null;
    if (!fin(x.size) || x.size <= 0 || x.size > 4000 || typeof x.flipX !== 'boolean') return null;
    return {
      id: x.id,
      kind: 'stamp',
      asset: x.asset,
      x: x.x,
      y: x.y,
      size: x.size,
      rotation: x.rotation,
      flipX: x.flipX,
    };
  }
  if (x.kind === 'shape') {
    if (!(SHAPE_KINDS as readonly unknown[]).includes(x.shape)) return null;
    if (!fin(x.w) || !fin(x.h) || x.w <= 0 || x.h <= 0 || x.w > 4000 || x.h > 4000) return null;
    if (typeof x.stroke !== 'string' || !COLOR.test(x.stroke)) return null;
    if (!fin(x.strokeWidth) || x.strokeWidth < 0 || x.strokeWidth > 200) return null;
    if (!(x.fill === null || (typeof x.fill === 'string' && COLOR.test(x.fill)))) return null;
    return {
      id: x.id,
      kind: 'shape',
      shape: x.shape as ShapeKind,
      x: x.x,
      y: x.y,
      w: x.w,
      h: x.h,
      rotation: x.rotation,
      stroke: x.stroke,
      strokeWidth: x.strokeWidth,
      fill: x.fill,
    };
  }
  return null;
}

/** 保存された文書を検証する（不正なら null）。v2.0-draft の旧形は受け付けない */
export function parseDoc(x: unknown): ArtDoc | null {
  if (!isRec(x) || x.version !== DOC_VERSION) return null;
  if (x.width !== DOC_W || x.height !== DOC_H) return null;
  const bg = x.background;
  let background: ArtBackground;
  if (isRec(bg) && bg.kind === 'color' && typeof bg.color === 'string' && COLOR.test(bg.color)) {
    background = { kind: 'color', color: bg.color };
  } else if (
    isRec(bg) &&
    bg.kind === 'template' &&
    typeof bg.templateId === 'string' &&
    typeof bg.svg === 'string' &&
    bg.svg.startsWith('<svg')
  ) {
    background = { kind: 'template', templateId: bg.templateId, svg: bg.svg };
  } else return null;
  if (!(x.base === null || x.base === undefined || x.base === 'base')) return null;
  if (!Array.isArray(x.items) || x.items.length > 5000) return null;
  const items: ArtItem[] = [];
  for (const raw of x.items) {
    const it = parseItem(raw);
    if (!it) return null;
    items.push(it);
  }
  if (new Set(items.map((i) => i.id)).size !== items.length) return null;
  if (inkCount(items) > MAX_INK) return null;
  if (!isRec(x.assets)) return null;
  const assets: Record<string, string> = {};
  for (const [k, v] of Object.entries(x.assets)) {
    if (!ASSET.test(k) || typeof v !== 'string' || !v.startsWith('<svg')) return null;
    assets[k] = v;
  }
  for (const it of items) if (it.kind === 'stamp' && !(it.asset in assets)) return null;
  let origin: ArtOrigin = { kind: 'free' };
  const o = x.origin;
  if (
    isRec(o) &&
    o.kind === 'lesson' &&
    typeof o.unitId === 'string' &&
    typeof o.itemId === 'string'
  ) {
    origin = { kind: 'lesson', unitId: o.unitId, itemId: o.itemId };
  }
  const doc: ArtDoc = {
    version: DOC_VERSION,
    width: DOC_W,
    height: DOC_H,
    background,
    base: x.base === 'base' ? 'base' : null,
    items,
    assets,
    origin,
  };
  if (x.dirty === true) doc.dirty = true;
  return doc;
}
