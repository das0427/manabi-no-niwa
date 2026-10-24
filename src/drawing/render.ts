/**
 * 合成（背景 → base → items）。表示・塗りの境界判定・焼き付け・PNG 書き出しで同じ関数を使う。
 * ctx の変換は「論理座標 × scale」。選択枠などは描かない（オーバーレイは DOM。X-SV-07）。
 */
import { isClosed, shapePoints } from './geometry';
import type { ArtDoc, ArtItem, ObjItem, ShapeItem, StampItem } from './model';
import { DOC_H, DOC_W } from './model';
import type { StampImages } from './stampImages';

export interface RenderSources {
  layers: ReadonlyMap<string, CanvasImageSource>;
  base: CanvasImageSource | null;
  stamps: StampImages;
  /** テンプレートの背景（読み込み済みなら） */
  template?: CanvasImageSource | null;
}

function shapePath(ctx: CanvasRenderingContext2D, it: ShapeItem): void {
  const pts = shapePoints(it.shape, it.w, it.h);
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  if (isClosed(it.shape)) ctx.closePath();
}

export function drawShape(ctx: CanvasRenderingContext2D, it: ShapeItem): void {
  ctx.save();
  ctx.translate(it.x, it.y);
  ctx.rotate((it.rotation * Math.PI) / 180);
  shapePath(ctx, it);
  if (it.fill && isClosed(it.shape)) {
    ctx.fillStyle = it.fill;
    ctx.fill();
  }
  if (it.strokeWidth > 0) {
    ctx.lineWidth = it.strokeWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = it.stroke;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawStamp(
  ctx: CanvasRenderingContext2D,
  it: StampItem,
  svg: string | undefined,
  stamps: StampImages,
  scale: number,
): void {
  if (!svg) return;
  const img = stamps.get(it.asset, svg, it.size * scale);
  if (!img) return;
  ctx.save();
  ctx.translate(it.x, it.y);
  ctx.rotate((it.rotation * Math.PI) / 180);
  if (it.flipX) ctx.scale(-1, 1);
  ctx.drawImage(img, -it.size / 2, -it.size / 2, it.size, it.size);
  ctx.restore();
}

export function drawObject(
  ctx: CanvasRenderingContext2D,
  it: ObjItem,
  doc: Pick<ArtDoc, 'assets'>,
  src: Pick<RenderSources, 'stamps'>,
  scale: number,
): void {
  if (it.kind === 'stamp') drawStamp(ctx, it, doc.assets[it.asset], src.stamps, scale);
  else drawShape(ctx, it);
}

export function drawItem(
  ctx: CanvasRenderingContext2D,
  it: ArtItem,
  doc: Pick<ArtDoc, 'assets'>,
  src: RenderSources,
  scale: number,
): void {
  if (it.kind === 'ink') {
    const layer = src.layers.get(it.id);
    if (layer) ctx.drawImage(layer, 0, 0, DOC_W, DOC_H);
  } else drawObject(ctx, it, doc, src, scale);
}

export interface ComposeOptions {
  /** 出力の 1 論理単位あたりの画素数 */
  scale: number;
  /** items のこの範囲だけを描く（[from, to)）。背景・base は from=0 のときだけ */
  from?: number;
  to?: number;
  /** 描かない項目（動かしている途中の物など） */
  skip?: ReadonlySet<string>;
  /** 背景を塗らない（透明のまま） */
  transparent?: boolean;
  /** 背景も base も描かない（items の範囲だけ） */
  itemsOnly?: boolean;
}

export function compose(
  ctx: CanvasRenderingContext2D,
  doc: Pick<ArtDoc, 'background' | 'items' | 'assets'>,
  src: RenderSources,
  opt: ComposeOptions,
): void {
  const from = opt.from ?? 0;
  const to = opt.to ?? doc.items.length;
  ctx.save();
  ctx.setTransform(opt.scale, 0, 0, opt.scale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  if (from === 0 && !opt.itemsOnly) {
    if (!opt.transparent) {
      ctx.fillStyle = doc.background.kind === 'color' ? doc.background.color : '#FFFDF8';
      ctx.fillRect(0, 0, DOC_W, DOC_H);
      if (doc.background.kind === 'template' && src.template) {
        ctx.drawImage(src.template, 0, 0, DOC_W, DOC_H);
      }
    }
    if (src.base) ctx.drawImage(src.base, 0, 0, DOC_W, DOC_H);
  }
  for (let i = from; i < to; i++) {
    const it = doc.items[i]!;
    if (opt.skip?.has(it.id)) continue;
    drawItem(ctx, it, doc, src, opt.scale);
  }
  ctx.restore();
}
