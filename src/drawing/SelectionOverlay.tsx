/**
 * 選択枠・ハンドル（DESINGN.md 19章: ink の実線＋surface の外側、ハンドルは直径 5.5u の丸）。
 * DOM のオーバーレイなので PNG 書き出しには入らない（X-SV-07）。
 * ハンドルのドラッグは任意（同じ操作は札でもできる。ux-by-age 3章）。
 */
import { useRef } from 'react';
import type { DrawingEngine } from './engine';
import { itemSize, type Pt } from './geometry';
import { DOC_H, DOC_W, type ArtItem, type ObjItem } from './model';
import type { ViewRect } from './CanvasView';
import { MAX_SIZE, MIN_SIZE } from './tools';

interface Props {
  engine: DrawingEngine;
  item: ObjItem;
  view: ViewRect;
  /** 1u の CSS px */
  uPx: number;
  onChanged(): void;
}

type Drag = {
  kind: 'scale' | 'rotate';
  id: number;
  orig: ObjItem;
  prevItems: readonly ArtItem[];
  start: Pt;
};

export function SelectionOverlay({ engine, item, view, uPx, onChanged }: Props) {
  const s = view.width / DOC_W;
  const { w, h } = itemSize(item);
  const drag = useRef<Drag | null>(null);
  const cx = view.left + item.x * s;
  const cy = view.top + item.y * s;
  // 枠は絵より 1.5u 外側に（ハンドルが絵を隠しにくいように）
  const pad = uPx * 1.5;
  const fw = Math.max(w * s, uPx * 3) + pad * 2;
  const fh = Math.max(h * s, uPx * 3) + pad * 2;

  const toLogical = (e: { clientX: number; clientY: number }, el: Element): Pt => {
    const root = el.closest('[data-draw-root]')!.getBoundingClientRect();
    return {
      x: ((e.clientX - root.left - view.left) / view.width) * DOC_W,
      y: ((e.clientY - root.top - view.top) / view.height) * DOC_H,
    };
  };

  const down = (kind: Drag['kind']) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || drag.current) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 無視 */
    }
    drag.current = {
      kind,
      id: e.pointerId,
      orig: item,
      prevItems: engine.items,
      start: toLogical(e, e.currentTarget),
    };
    engine.beginFocus(item.id);
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const p = toLogical(e, e.currentTarget);
    const o = d.orig;
    if (d.kind === 'scale') {
      const d0 = Math.max(1, Math.hypot(d.start.x - o.x, d.start.y - o.y));
      const f = Math.hypot(p.x - o.x, p.y - o.y) / d0;
      const clamp = (v: number) => Math.min(MAX_SIZE, Math.max(MIN_SIZE, v));
      engine.preview(
        o.kind === 'stamp'
          ? { ...o, size: clamp(o.size * f) }
          : { ...o, w: clamp(o.w * f), h: o.shape === 'line' ? o.h : clamp(o.h * f) },
      );
    } else {
      const deg = (Math.atan2(p.y - o.y, p.x - o.x) * 180) / Math.PI + 90;
      engine.preview({ ...o, rotation: (((Math.round(deg / 15) * 15) % 360) + 360) % 360 });
    }
  };
  const up = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    engine.endFocus();
    engine.commitItems(d.kind === 'scale' ? 'resize' : 'rotate', d.prevItems, engine.items);
    onChanged();
  };

  const handle = (x: number, y: number, kind: Drag['kind'], test: string) => (
    <div
      className={`draw-handle draw-handle--${kind}`}
      style={{ left: x, top: y }}
      data-testid={test}
      onPointerDown={down(kind)}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    />
  );

  return (
    <div
      className="draw-frame"
      data-testid="draw-selection"
      data-item={item.id}
      style={{
        left: cx - fw / 2,
        top: cy - fh / 2,
        width: fw,
        height: fh,
        transform: `rotate(${item.rotation}deg)`,
      }}
    >
      {handle(0, 0, 'scale', 'draw-handle-nw')}
      {handle(fw, 0, 'scale', 'draw-handle-ne')}
      {handle(0, fh, 'scale', 'draw-handle-sw')}
      {handle(fw, fh, 'scale', 'draw-handle-se')}
      {handle(fw / 2, -uPx * 5, 'rotate', 'draw-handle-rotate')}
    </div>
  );
}
