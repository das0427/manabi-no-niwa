/**
 * なぞり盤（Canvas）。入力は Pointer Events（pointer capture・coalesced events）、描画は
 * requestAnimationFrame。描画領域だけ touch-action: none（ページのスクロール・拡大は止めない）。
 * 線の点は 0〜1000 の正方形座標で上位へ渡す（判定は judge.ts）。
 */
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { TraceItem } from './content';
import {
  demoDuration,
  demoFrame,
  paintBoard,
  readColors,
  type Colors,
  type DemoFrame,
} from './draw';
import type { Pt, TraceJudgement } from './judge';
import { pointerKind, type PointerKind } from './logic';

export interface TraceCanvasProps {
  item: TraceItem;
  r: number;
  judgement: TraceJudgement;
  lines: readonly { p: readonly Pt[] }[];
  hintAt: Pt | null;
  /** 値が変わるたびに、お手本の動きを最初から再生する（0 は再生しない） */
  demoToken: number;
  reduceMotion: boolean;
  /** 完成・「つぎへ」のあとなど、入力を受けない */
  locked: boolean;
  reveal: boolean;
  onLine: (pts: Pt[], kind: PointerKind) => void;
  /** 指・ペン・マウスのどれで触ったか（判定幅の選択に使う） */
  onKind: (kind: PointerKind) => void;
}

interface Live {
  id: number;
  kind: PointerKind;
  pts: Pt[];
}

export function TraceCanvas(props: TraceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  const live = useRef<Live | null>(null);
  const demo = useRef<{ start: number; item: TraceItem } | null>(null);
  const frame = useRef<DemoFrame | null>(null);
  const arrowsUntil = useRef(0);
  const raf = useRef(0);
  const colors = useRef<Colors | null>(null);

  const paint = useCallback((now: number) => {
    const canvas = canvasRef.current;
    const p = propsRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    colors.current ??= readColors();
    const d = demo.current;
    if (d) {
      const f = demoFrame(d.item, now - d.start);
      frame.current = f.finished ? null : f;
      if (f.finished) demo.current = null;
    } else {
      frame.current = null;
    }
    const w = canvas.width;
    ctx.setTransform(w / 1000, 0, 0, w / 1000, 0, 0);
    paintBoard(ctx, colors.current, {
      item: p.item,
      r: p.r,
      judgement: p.judgement,
      lines: p.lines,
      live: live.current?.pts ?? null,
      hintAt: p.hintAt,
      demo: frame.current,
      arrows: p.reduceMotion && now < arrowsUntil.current,
      reveal: p.reveal,
    });
    // お手本の動きの間と、矢印を見せている間は描き続ける
    if (demo.current || (p.reduceMotion && now < arrowsUntil.current)) {
      raf.current = requestAnimationFrame(tick);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tick = useCallback(
    (now: number) => {
      raf.current = 0;
      paint(now);
    },
    [paint],
  );

  const schedule = useCallback(() => {
    if (!raf.current) raf.current = requestAnimationFrame(tick);
  }, [tick]);

  // 最新の props を描画から読めるようにして、変わったら描き直す
  useLayoutEffect(() => {
    propsRef.current = props;
    schedule();
  });

  // 大きさ（高 DPI）。表示サイズ × devicePixelRatio の解像度にする
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      const px = Math.max(1, Math.round(rect.width * (window.devicePixelRatio || 1)));
      if (canvas.width !== px || canvas.height !== px) {
        canvas.width = px;
        canvas.height = px;
      }
      schedule();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [schedule]);

  const { demoToken, item, reduceMotion } = props;
  useEffect(() => {
    // 題が変わったら前の動きを止める（下の再生の effect より先に実行される）
    demo.current = null;
    arrowsUntil.current = 0;
    live.current = null;
    schedule();
  }, [item, schedule]);

  // お手本の動き（各題の最初と「みる」「ヒント2」）。動きを減らす設定では止まった矢印を数秒見せる
  useEffect(() => {
    if (demoToken === 0) return;
    if (reduceMotion) {
      arrowsUntil.current = performance.now() + 3200;
      demo.current = null;
    } else {
      demo.current = { start: performance.now(), item };
    }
    schedule();
    // item が変わった直後の最初の再生は demoToken の変化で起きる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoToken]);

  const toPoint = (e: { clientX: number; clientY: number }): Pt => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const clamp = (v: number) => Math.max(0, Math.min(1000, v));
    return [
      clamp(((e.clientX - rect.left) / rect.width) * 1000),
      clamp(((e.clientY - rect.top) / rect.height) * 1000),
    ];
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (propsRef.current.locked || !e.isPrimary) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    const kind = pointerKind(e.pointerType);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 取れなくても描ける */
    }
    // pointerup を取りこぼして残った古い線は捨てる（以後の入力を受け付けなくならないように）
    live.current = null;
    // お手本の動きの途中で触ったら、動きを止めて書き始める
    demo.current = null;
    arrowsUntil.current = 0;
    live.current = { id: e.pointerId, kind, pts: [toPoint(e)] };
    propsRef.current.onKind(kind);
    schedule();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const l = live.current;
    if (!l || l.id !== e.pointerId) return;
    const events =
      typeof e.nativeEvent.getCoalescedEvents === 'function'
        ? e.nativeEvent.getCoalescedEvents()
        : [];
    for (const ev of events.length > 0 ? events : [e.nativeEvent]) {
      const p = toPoint(ev);
      const last = l.pts[l.pts.length - 1]!;
      if (p[0] !== last[0] || p[1] !== last[1]) l.pts.push(p);
    }
    schedule();
  };

  const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const l = live.current;
    if (!l || l.id !== e.pointerId) return;
    live.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* 既に解放されている */
    }
    schedule();
    propsRef.current.onLine(l.pts, l.kind);
  };

  return (
    <canvas
      ref={canvasRef}
      className="trace-canvas"
      data-testid="trace-canvas"
      data-demo-ms={demoDuration(props.item.strokes.length)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      role="img"
      aria-label={props.item.title}
    />
  );
}
