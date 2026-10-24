/**
 * おえかきの描画基盤（React に依存しない）。文書・インクの層のキャンバス・取り消し履歴を持つ。
 * かんたん／くわしく は同じ基盤を使い、画面（DrawingScreen）が道具の出し方を変える（X-DR-05）。
 *
 * - 線・消しゴム・塗り: 画素はタイル単位の差分で undo（tiles.ts）
 * - はんこ・図形・移動・変形・削除・重なり順: items の配列（不変）を前後で持って undo
 * - 焼き付け（インクの層が6枚を超えるとき）も1手（統括の判断3）
 */
import { dilate, floodMask, paintMask } from './fill';
import { History, type Command } from './history';
import { hitsItem, itemBounds, pickItem, type Pt } from './geometry';
import {
  DOC_H,
  DOC_W,
  bringInside,
  isObj,
  moveZ,
  newId,
  planInkTarget,
  withoutIds,
  type ArtDoc,
  type ArtItem,
  type BakePlan,
  type InkItem,
  type ObjItem,
  type ZMove,
} from './model';
import { compose, drawItem, type RenderSources } from './render';
import { StampImages } from './stampImages';
import { TileRecorder, applyTiles, tilesBytes, type PixelCtx, type TileDiff } from './tiles';

export type StrokeTool = 'pen' | 'eraser';
export const BASE_KEY = 'base';
const ITEMS_BYTES = 2048;

export function createLayerCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = DOC_W;
  c.height = DOC_H;
  // 差分の読み取り（getImageData）が多いので CPU 側に置く
  c.getContext('2d', { willReadFrequently: true });
  return c;
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas 2d is not available');
  return ctx;
}

interface LiveStroke {
  tool: StrokeTool;
  target: string | null;
  rec: TileRecorder;
  last: Pt;
  color: string;
  width: number;
  prevItems: readonly ArtItem[];
  touched: boolean;
  objectsChanged: boolean;
}

/** 動かしている途中・描いている途中の「止まっている部分」の目印（表示のキャッシュ用） */
export interface Focus {
  token: number;
  /** items のこの位置より下は変わらない */
  index: number;
  /** この位置の物だけが変わる（上も変わらない）。false なら index 以上すべて描き直す */
  single: boolean;
}

export class DrawingEngine {
  doc: ArtDoc;
  readonly layers = new Map<string, HTMLCanvasElement>();
  readonly base: HTMLCanvasElement;
  readonly stamps: StampImages;
  readonly history = new History();
  /** 変更の通し番号（自動保存・表示の判定） */
  rev = 0;
  /** 層ごとの最後の変更の rev（'base' か インクの層の ID） */
  readonly layerRev = new Map<string, number>();
  /** 焼き付けたことがある（または保存済みの base を読んだ） */
  baseUsed = false;
  /** 消しゴムがオブジェクトに触れたとき: かんたん=消す、くわしく=選ぶ（review-1 #3） */
  eraserObjects: 'delete' | 'select' = 'delete';
  onErased: ((it: ObjItem) => void) | null = null;
  onEraserTouch: ((it: ObjItem) => void) | null = null;
  focus: Focus | null = null;

  private live: LiveStroke | null = null;
  private changeListeners = new Set<() => void>();
  private paintListeners = new Set<() => void>();
  private readCanvas: HTMLCanvasElement | null = null;
  private focusSeq = 0;

  constructor(doc: ArtDoc) {
    this.doc = doc;
    this.base = createLayerCanvas();
    this.baseUsed = doc.base !== null;
    this.stamps = new StampImages(() => this.emitPaint());
    for (const it of doc.items) if (it.kind === 'ink') this.layers.set(it.id, createLayerCanvas());
  }

  // ---------------------------------------------------------------- 購読
  /** 構造（items・履歴）の変化。React の再描画に使う */
  subscribe(cb: () => void): () => void {
    this.changeListeners.add(cb);
    return () => this.changeListeners.delete(cb);
  }
  /** 画素だけの変化（キャンバスの描き直し） */
  onPaint(cb: () => void): () => void {
    this.paintListeners.add(cb);
    return () => this.paintListeners.delete(cb);
  }
  private emitPaint(): void {
    for (const cb of [...this.paintListeners]) cb();
  }
  private emitChange(): void {
    for (const cb of [...this.changeListeners]) cb();
    this.emitPaint();
  }
  private bump(layers: Iterable<string> = []): void {
    this.rev++;
    for (const l of layers) this.layerRev.set(l, this.rev);
  }

  get items(): readonly ArtItem[] {
    return this.doc.items;
  }
  private setItems(items: readonly ArtItem[]): void {
    this.doc = { ...this.doc, items: items as ArtItem[] };
  }

  sources(): RenderSources {
    return { layers: this.layers, base: this.baseUsed ? this.base : null, stamps: this.stamps };
  }

  private pixelCtx = (layer: string): PixelCtx | null => {
    const c = layer === BASE_KEY ? this.base : this.layers.get(layer);
    return c ? ctx2d(c) : null;
  };

  /** 中身があるか（新しい作品を保存するかどうか） */
  get isEmpty(): boolean {
    return this.doc.items.length === 0 && !this.baseUsed;
  }

  get drawing(): boolean {
    return this.live !== null;
  }

  // ---------------------------------------------------------------- 履歴
  private push(c: Command): void {
    this.history.push(c);
  }

  undo(): boolean {
    if (this.live) this.endStroke();
    const c = this.history.undo();
    if (c) this.emitChange();
    return !!c;
  }

  redo(): boolean {
    if (this.live) this.endStroke();
    const c = this.history.redo();
    if (c) this.emitChange();
    return !!c;
  }

  /** items の前後と画素の差分から1手を作る */
  private makeCommand(
    label: string,
    prev: readonly ArtItem[],
    next: readonly ArtItem[],
    tiles: TileDiff[] = [],
    extraBytes = 0,
    dispose?: () => void,
  ): Command {
    const layersOf = () => new Set(tiles.map((t) => t.layer));
    return {
      label,
      bytes: tilesBytes(tiles) + ITEMS_BYTES + extraBytes,
      undo: () => {
        applyTiles(tiles, 'before', this.pixelCtx);
        this.setItems(prev);
        this.bump(layersOf());
      },
      redo: () => {
        applyTiles(tiles, 'after', this.pixelCtx);
        this.setItems(next);
        this.bump(layersOf());
      },
      dispose,
    };
  }

  /** items だけが変わる操作を1手として記録する */
  commitItems(label: string, prev: readonly ArtItem[], next: readonly ArtItem[]): void {
    if (prev === next) return;
    this.setItems(next);
    this.push(this.makeCommand(label, prev, next));
    this.bump();
    this.emitChange();
  }

  // ---------------------------------------------------------------- インクの層・焼き付け
  /** 線・塗りの書き込み先を用意する（必要なら焼き付け→新しい層） */
  private prepareInkTarget(): { id: string; prevItems: readonly ArtItem[] } {
    const plan = planInkTarget(this.doc.items);
    if (plan.kind === 'existing') return { id: plan.id, prevItems: this.doc.items };
    if (plan.bake) this.bake(plan.bake);
    const prevItems = this.doc.items;
    const layer: InkItem = { id: newId('L'), kind: 'ink', raster: null };
    this.layers.set(layer.id, createLayerCanvas());
    this.setItems([...prevItems, layer]);
    return { id: layer.id, prevItems };
  }

  /** インクの層の描かれている範囲（透明でない画素の外接矩形） */
  private contentBounds(
    c: HTMLCanvasElement,
  ): { x0: number; y0: number; x1: number; y1: number } | null {
    const d = ctx2d(c).getImageData(0, 0, DOC_W, DOC_H).data;
    let x0 = DOC_W;
    let y0 = DOC_H;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < DOC_H; y++) {
      const row = y * DOC_W * 4;
      for (let x = 0; x < DOC_W; x++) {
        if (d[row + x * 4 + 3] !== 0) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          y1 = y;
        }
      }
    }
    return x1 < 0 ? null : { x0, y0, x1, y1 };
  }

  /**
   * 焼き付け（review-1 #1、統括の判断3）: 一番下のインクの層とその下の項目を base に描き込み、列から外す。
   * base の変化した範囲の差分を持つ1手として記録する。
   */
  bake(plan: BakePlan): void {
    const prev = this.doc.items;
    const ids = new Set(plan.ids);
    const baked = prev.filter((it) => ids.has(it.id));
    let box: { x0: number; y0: number; x1: number; y1: number } | null = null;
    const grow = (b: { x0: number; y0: number; x1: number; y1: number } | null) => {
      if (!b) return;
      box = box
        ? {
            x0: Math.min(box.x0, b.x0),
            y0: Math.min(box.y0, b.y0),
            x1: Math.max(box.x1, b.x1),
            y1: Math.max(box.y1, b.y1),
          }
        : b;
    };
    for (const it of baked) {
      if (it.kind === 'ink') {
        const c = this.layers.get(it.id);
        if (c) grow(this.contentBounds(c));
      } else grow(itemBounds(it));
    }
    const rec = new TileRecorder(this.pixelCtx, DOC_W, DOC_H);
    if (box) {
      const b = box as { x0: number; y0: number; x1: number; y1: number };
      rec.touch(BASE_KEY, b.x0, b.y0, b.x1, b.y1);
      const ctx = ctx2d(this.base);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (const it of baked) drawItem(ctx, it, this.doc, this.sources(), 1);
      ctx.restore();
    }
    const tiles = rec.finish();
    const next = withoutIds(prev, plan.ids);
    const inkIds = baked.filter((it) => it.kind === 'ink').map((it) => it.id);
    this.baseUsed = true;
    this.setItems(next);
    this.push(
      this.makeCommand('bake', prev, next, tiles, inkIds.length * DOC_W * DOC_H * 4, () => {
        // 履歴から消えたら、今の列に無い（焼き付け済みの）層のキャンバスを放す
        const live = new Set(this.doc.items.map((i) => i.id));
        for (const id of inkIds) if (!live.has(id)) this.layers.delete(id);
      }),
    );
    this.bump([BASE_KEY]);
  }

  // ---------------------------------------------------------------- 線・消しゴム
  beginStroke(tool: StrokeTool, p: Pt, style: { color: string; width: number }): void {
    if (this.live) this.endStroke();
    let target: string | null = null;
    let prevItems: readonly ArtItem[] = this.doc.items;
    if (tool === 'pen') {
      const t = this.prepareInkTarget();
      target = t.id;
      prevItems = t.prevItems;
    }
    this.live = {
      tool,
      target,
      rec: new TileRecorder(this.pixelCtx, DOC_W, DOC_H),
      last: p,
      color: style.color,
      width: style.width,
      prevItems,
      touched: false,
      objectsChanged: false,
    };
    this.focus =
      tool === 'pen'
        ? {
            token: ++this.focusSeq,
            index: this.doc.items.findIndex((it) => it.id === target),
            single: true,
          }
        : null;
    this.segment(p, p);
    this.emitPaint();
  }

  extendStroke(pts: readonly Pt[]): void {
    const l = this.live;
    if (!l) return;
    for (const p of pts) {
      if (p.x === l.last.x && p.y === l.last.y) continue;
      this.segment(l.last, p);
      l.last = p;
    }
    this.emitPaint();
  }

  private segment(a: Pt, b: Pt): void {
    const l = this.live!;
    const r = l.width / 2 + 2;
    const x0 = Math.min(a.x, b.x) - r;
    const y0 = Math.min(a.y, b.y) - r;
    const x1 = Math.max(a.x, b.x) + r;
    const y1 = Math.max(a.y, b.y) + r;
    const targets =
      l.tool === 'pen'
        ? [l.target!]
        : [
            ...(this.baseUsed ? [BASE_KEY] : []),
            ...this.doc.items.filter((it) => it.kind === 'ink').map((it) => it.id),
          ];
    for (const layer of targets) {
      const c = layer === BASE_KEY ? this.base : this.layers.get(layer);
      if (!c) continue;
      l.rec.touch(layer, x0, y0, x1, y1);
      const ctx = ctx2d(c);
      ctx.save();
      ctx.globalCompositeOperation = l.tool === 'pen' ? 'source-over' : 'destination-out';
      ctx.strokeStyle = l.color;
      ctx.fillStyle = l.color;
      ctx.lineWidth = l.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (a.x === b.x && a.y === b.y) {
        ctx.arc(a.x, a.y, l.width / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
      l.touched = true;
    }
    if (l.tool === 'eraser') this.eraseObjectsAt(b, l.width / 2);
  }

  /** 消しゴムがはんこ・図形に触れた（review-1 #3） */
  private eraseObjectsAt(p: Pt, radius: number): void {
    const opt = { u: Math.max(1, radius / 2.75), stampAlpha: this.stampAlpha };
    for (let i = this.doc.items.length - 1; i >= 0; i--) {
      const it = this.doc.items[i]!;
      if (!isObj(it) || !hitsItem(it, p, opt)) continue;
      if (this.eraserObjects === 'delete') {
        this.setItems(this.doc.items.filter((x) => x.id !== it.id));
        this.live!.objectsChanged = true;
        this.onErased?.(it);
        this.emitChange();
      } else {
        this.onEraserTouch?.(it);
        return;
      }
    }
  }

  /** 線を確定する（pointerup・pointercancel のどちらでも。R#7） */
  endStroke(): void {
    const l = this.live;
    if (!l) return;
    this.live = null;
    this.focus = null;
    const tiles = l.rec.finish();
    const next = this.doc.items;
    if (tiles.length === 0 && next === l.prevItems) {
      this.emitPaint();
      return;
    }
    this.push(this.makeCommand(l.tool === 'pen' ? 'line' : 'erase', l.prevItems, next, tiles));
    this.bump(tiles.map((t) => t.layer));
    this.emitChange();
  }

  // ---------------------------------------------------------------- 塗りつぶし
  /** 境界の判定用の合成（背景＋base＋全アイテム）を論理の大きさで作る */
  private composeForRead(): ImageData {
    if (!this.readCanvas) {
      this.readCanvas = document.createElement('canvas');
      this.readCanvas.width = DOC_W;
      this.readCanvas.height = DOC_H;
    }
    const ctx = this.readCanvas.getContext('2d', { willReadFrequently: true })!;
    compose(ctx, this.doc, this.sources(), { scale: 1 });
    return ctx.getImageData(0, 0, DOC_W, DOC_H);
  }

  /** 塗りつぶし（review-1 #2、統括の判断2）。塗れたら true */
  fill(p: Pt, color: string): boolean {
    if (this.live) this.endStroke();
    const img = this.composeForRead();
    const m0 = floodMask(img.data, DOC_W, DOC_H, p.x, p.y);
    if (!m0 || m0.count === 0) return false;
    const m = dilate(m0, 1);
    const t = this.prepareInkTarget();
    const rec = new TileRecorder(this.pixelCtx, DOC_W, DOC_H);
    rec.touch(t.id, m.x0, m.y0, m.x1, m.y1);
    const ctx = ctx2d(this.layers.get(t.id)!);
    const w = m.x1 - m.x0 + 1;
    const h = m.y1 - m.y0 + 1;
    const region = ctx.getImageData(m.x0, m.y0, w, h);
    paintMask(region.data, m, color);
    ctx.putImageData(region, m.x0, m.y0);
    const tiles = rec.finish();
    this.push(this.makeCommand('fill', t.prevItems, this.doc.items, tiles));
    this.bump([t.id]);
    this.emitChange();
    return true;
  }

  // ---------------------------------------------------------------- オブジェクト
  stampAlpha = (it: { asset: string }, lx: number, ly: number): number => {
    const svg = this.doc.assets[it.asset];
    return svg ? this.stamps.alphaAt(it.asset, svg, lx, ly) : 0;
  };

  /** はんこ・図形を一番上に置く。はんこは SVG を assets に1回だけ持つ（X-SV-08） */
  addObject(it: ObjItem, asset?: { key: string; svg: string }): void {
    if (this.live) this.endStroke();
    if (asset && !(asset.key in this.doc.assets)) {
      this.doc = { ...this.doc, assets: { ...this.doc.assets, [asset.key]: asset.svg } };
    }
    const prev = this.doc.items;
    this.commitItems(it.kind === 'stamp' ? 'stamp' : 'shape', prev, [...prev, it]);
  }

  getObject(id: string | null): ObjItem | null {
    if (!id) return null;
    const it = this.doc.items.find((x) => x.id === id);
    return it && isObj(it) ? it : null;
  }

  /** 途中の変更（ドラッグ中）。履歴に入れない。終わったら commitItems(label, 始めの items, items) */
  preview(next: ObjItem): void {
    this.setItems(this.doc.items.map((it) => (it.id === next.id ? next : it)));
    this.bump();
    this.emitPaint();
  }

  /** 1回で終わる変更（移動・変形）を記録する */
  updateObject(label: string, next: ObjItem): void {
    const prev = this.doc.items;
    this.commitItems(
      label,
      prev,
      prev.map((it) => (it.id === next.id ? next : it)),
    );
  }

  removeObject(id: string): ObjItem | null {
    const it = this.getObject(id);
    if (!it) return null;
    const prev = this.doc.items;
    this.commitItems(
      'delete',
      prev,
      prev.filter((x) => x.id !== id),
    );
    return it;
  }

  zMove(id: string, how: ZMove): void {
    const prev = this.doc.items;
    this.commitItems('order', prev, moveZ(prev, id, how));
  }

  /** 「みつける」: 外に出たオブジェクトを内側へ寄せる（X-ED-04） */
  bringInside(): void {
    const prev = this.doc.items;
    const next = bringInside(prev);
    if (next.some((it, i) => it !== prev[i])) this.commitItems('move', prev, next);
  }

  /** ドラッグ・変形の間の表示用キャッシュの目印 */
  beginFocus(id: string): void {
    const i = this.doc.items.findIndex((it) => it.id === id);
    this.focus = i < 0 ? null : { token: ++this.focusSeq, index: i, single: true };
  }
  endFocus(): void {
    this.focus = null;
    this.emitPaint();
  }

  pick(p: Pt, u: number, cycle?: { id: string; at: Pt } | null): ObjItem | null {
    return pickItem(this.doc.items, p, { u, stampAlpha: this.stampAlpha, cycle });
  }

  // ---------------------------------------------------------------- 読み込み・書き出し
  /** 保存した画像を層に描く（作品を開くとき） */
  async loadRasters(get: (kind: string) => Promise<Blob | undefined>): Promise<void> {
    const draw = async (kind: string, c: HTMLCanvasElement) => {
      const blob = await get(kind);
      if (!blob) return false;
      try {
        const bmp = await createImageBitmap(blob);
        const ctx = ctx2d(c);
        ctx.clearRect(0, 0, DOC_W, DOC_H);
        ctx.drawImage(bmp, 0, 0, DOC_W, DOC_H);
        bmp.close?.();
        return true;
      } catch {
        return false;
      }
    };
    if (this.doc.base) this.baseUsed = (await draw('base', this.base)) || this.baseUsed;
    for (const it of this.doc.items) {
      if (it.kind !== 'ink' || !it.raster) continue;
      const c = this.layers.get(it.id);
      if (c) await draw(it.raster, c);
    }
    await this.stamps.ensure(this.doc.assets, 256);
    this.emitChange();
  }

  /** 合成した画像（PNG 書き出し・閲覧用・縮小）。背景色を含む（R#30）。選択枠は入らない */
  composeCanvas(width = DOC_W): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = Math.round((width * DOC_H) / DOC_W);
    const ctx = c.getContext('2d')!;
    compose(ctx, this.doc, this.sources(), { scale: width / DOC_W });
    return c;
  }

  async exportPng(): Promise<Blob> {
    await this.stamps.ensure(this.doc.assets, 1024);
    return canvasToPng(this.composeCanvas(DOC_W));
  }

  /** テスト・計測用: 合成の1画素（論理座標） */
  sample(x: number, y: number): [number, number, number, number] {
    const d = this.composeForRead().data;
    const o = (Math.floor(y) * DOC_W + Math.floor(x)) * 4;
    return [d[o]!, d[o + 1]!, d[o + 2]!, d[o + 3]!];
  }

  /** 新しいはんこ（既定の値） */
  static stampItem(asset: string, p: Pt, size: number, rotation: number, flipX: boolean): ObjItem {
    return { id: newId('S'), kind: 'stamp', asset, x: p.x, y: p.y, size, rotation, flipX };
  }
}

export function canvasToPng(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
}
