/**
 * 表示用のキャンバス（architecture.md 7.2）。作品は論理 1600×1000 のまま、表示だけ拡大縮小する。
 * - 入力: Pointer Events・getCoalescedEvents・描画領域だけ touch-action: none
 * - isPrimary 以外のポインタは無視（描いている線はそのまま続ける）。pointercancel でも確定（R#7）
 * - ペンを使ってから 1 秒は指を描画に使わない
 * - 描画は requestAnimationFrame でまとめる。描いている・動かしている間は、変わらない部分を画像にしておく
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { DrawingEngine } from './engine';
import type { Pt } from './geometry';
import { DOC_H, DOC_W } from './model';
import { compose } from './render';
import { ignorePointerDown, type PointerKind } from './tools';

export interface Gesture {
  move(pts: Pt[]): void;
  end(cancelled: boolean): void;
}

export interface ViewRect {
  /** 画面（おえかき画面のいちばん外側）からの位置と大きさ（CSS px） */
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Props {
  engine: DrawingEngine;
  onPointerDown(p: Pt, kind: PointerKind): Gesture | null;
  onLayout(r: ViewRect): void;
  /** 位置の基準にする要素（おえかき画面のいちばん外側） */
  rootRef: React.RefObject<HTMLElement | null>;
  label: string;
}

const kindOf = (t: string): PointerKind =>
  t === 'pen' ? 'pen' : t === 'touch' ? 'touch' : 'mouse';

export function CanvasView({ engine, onPointerDown, onLayout, rootRef, label }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);
  const active = useRef<{ id: number; g: Gesture } | null>(null);
  const lastPenAt = useRef(-Infinity);
  const cache = useRef<{
    token: number;
    w: number;
    below: HTMLCanvasElement;
    above: HTMLCanvasElement;
  } | null>(null);
  const handlers = useRef({ onPointerDown, onLayout });
  useLayoutEffect(() => {
    handlers.current = { onPointerDown, onLayout };
  });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const paint = () => {
      raf.current = 0;
      const ctx = canvas.getContext('2d');
      if (!ctx || canvas.width === 0) return;
      const scale = canvas.width / DOC_W;
      const f = engine.focus;
      const doc = engine.doc;
      const src = engine.sources();
      if (f && f.index >= 0 && f.index < doc.items.length) {
        let c = cache.current;
        if (!c || c.token !== f.token || c.w !== canvas.width) {
          const mk = () => {
            const x = document.createElement('canvas');
            x.width = canvas.width;
            x.height = canvas.height;
            return x;
          };
          const below = c && c.w === canvas.width ? c.below : mk();
          const above = c && c.w === canvas.width ? c.above : mk();
          const bctx = below.getContext('2d')!;
          bctx.setTransform(1, 0, 0, 1, 0, 0);
          bctx.clearRect(0, 0, below.width, below.height);
          compose(bctx, doc, src, { scale, to: f.index });
          const actx = above.getContext('2d')!;
          actx.setTransform(1, 0, 0, 1, 0, 0);
          actx.clearRect(0, 0, above.width, above.height);
          compose(actx, doc, src, { scale, from: f.index + 1, itemsOnly: true });
          c = { token: f.token, w: canvas.width, below, above };
          cache.current = c;
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(c.below, 0, 0);
        compose(ctx, doc, src, { scale, from: f.index, to: f.index + 1, itemsOnly: true });
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(c.above, 0, 0);
      } else {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        compose(ctx, doc, src, { scale });
      }
    };
    const schedule = () => {
      if (!raf.current) raf.current = requestAnimationFrame(paint);
    };
    const off = engine.onPaint(schedule);

    // 大きさ: 置ける範囲に 16:10 で最大に。バッキングは表示 × devicePixelRatio
    const wrap = wrapRef.current!;
    const fit = () => {
      const r = wrap.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const w = Math.min(r.width, (r.height * DOC_W) / DOC_H);
      const h = (w * DOC_H) / DOC_W;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const dpr = window.devicePixelRatio || 1;
      const pw = Math.max(1, Math.round(w * dpr));
      const ph = Math.max(1, Math.round(h * dpr));
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
        cache.current = null;
      }
      const root = rootRef.current?.getBoundingClientRect();
      const cr = canvas.getBoundingClientRect();
      handlers.current.onLayout({
        left: cr.left - (root?.left ?? 0),
        top: cr.top - (root?.top ?? 0),
        width: cr.width,
        height: cr.height,
      });
      schedule();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    window.addEventListener('resize', fit);
    return () => {
      off();
      ro.disconnect();
      window.removeEventListener('resize', fit);
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [engine, rootRef]);

  const toLogical = (e: { clientX: number; clientY: number }): Pt => {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * DOC_W,
      y: ((e.clientY - r.top) / r.height) * DOC_H,
    };
  };

  const finish = (pointerId: number, cancelled: boolean, el: HTMLCanvasElement) => {
    const a = active.current;
    if (!a || a.id !== pointerId) return;
    active.current = null;
    try {
      el.releasePointerCapture(pointerId);
    } catch {
      /* 既に解放されている */
    }
    a.g.end(cancelled);
  };

  return (
    <div ref={wrapRef} className="draw-canvas-wrap">
      <canvas
        ref={canvasRef}
        className="draw-canvas"
        data-testid="draw-canvas"
        role="img"
        aria-label={label}
        onPointerDown={(e) => {
          const now = performance.now();
          if (e.pointerType === 'pen') lastPenAt.current = now;
          // 描いている最中の別のポインタ（2本目の指・手のひら）は無視する
          if (active.current) return;
          if (ignorePointerDown(e, now, lastPenAt.current)) return;
          e.preventDefault();
          const g = handlers.current.onPointerDown(toLogical(e), kindOf(e.pointerType));
          if (!g) return;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* 取れなくても描ける */
          }
          active.current = { id: e.pointerId, g };
        }}
        onPointerMove={(e) => {
          if (e.pointerType === 'pen') lastPenAt.current = performance.now();
          const a = active.current;
          if (!a || a.id !== e.pointerId) return;
          const ne = e.nativeEvent;
          const list = typeof ne.getCoalescedEvents === 'function' ? ne.getCoalescedEvents() : [];
          a.g.move((list.length > 0 ? list : [ne]).map(toLogical));
        }}
        onPointerUp={(e) => finish(e.pointerId, false, e.currentTarget)}
        onPointerCancel={(e) => finish(e.pointerId, true, e.currentTarget)}
        onLostPointerCapture={(e) => finish(e.pointerId, true, e.currentTarget)}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      />
    </div>
  );
}
