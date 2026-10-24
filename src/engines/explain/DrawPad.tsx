/**
 * 指で描く小さな盤（Canvas）。explain（かいてみよう）と trace の自由書きで使う。
 * 座標は横 0〜1000、縦 0〜1000/aspect。入力は Pointer Events（pointer capture）。描画領域だけ touch-action: none。
 * 色は CSS のトークンを読んで使う（直書きしない）。採点はしない。
 */
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import './drawpad.css';

export type InkColor = 'ink' | 'berry' | 'sky' | 'leaf';
export const INK_COLORS: readonly InkColor[] = ['ink', 'berry', 'sky', 'leaf'];
export const INK_NAMES: Record<InkColor, string> = {
  ink: 'くろ',
  berry: 'あか',
  sky: 'あお',
  leaf: 'みどり',
};

export interface DrawLine {
  c: InkColor;
  /** 整数の点列 */
  p: [number, number][];
}

/** 下に敷く補助線: なし／十字（字の練習）／横線（文） */
export type PadGuide = 'none' | 'cross' | 'lines';

export interface PadColors {
  white: string;
  paper2: string;
  ink: string;
  inkSoft: string;
  berry: string;
  sky: string;
  leaf: string;
  skyDark: string;
  font: string;
  letterFont: string;
}

export function readPadColors(): PadColors {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    white: v('--white', '#fffdf8'),
    paper2: v('--paper-2', '#f3e8d2'),
    ink: v('--ink', '#4a3b32'),
    inkSoft: v('--ink-soft', '#665649'),
    berry: v('--berry', '#d9634f'),
    sky: v('--sky-dark', '#5a93b3'),
    leaf: v('--leaf-dark', '#3f7440'),
    skyDark: v('--sky-dark', '#5a93b3'),
    font: v('--font-child', 'sans-serif'),
    letterFont: v('--font-letter', 'serif'),
  };
}

const INK_WIDTH = 26;

function strokeLine(
  g: CanvasRenderingContext2D,
  pts: readonly (readonly [number, number])[],
  color: string,
  width: number,
  alpha = 1,
) {
  if (pts.length === 0) return;
  g.globalAlpha = alpha;
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  if (pts.length === 1) {
    g.arc(pts[0]![0], pts[0]![1], width / 2, 0, Math.PI * 2);
    g.fill();
  } else {
    pts.forEach((p, i) => (i === 0 ? g.moveTo(p[0], p[1]) : g.lineTo(p[0], p[1])));
    g.stroke();
  }
  g.globalAlpha = 1;
}

export interface PaintOpts {
  aspect: number;
  guide: PadGuide;
  lines: readonly DrawLine[];
  live?: DrawLine | null;
  /** インクの下（お手本を薄く敷く等）か上（見比べで重ねる）に描く */
  under?: (g: CanvasRenderingContext2D, c: PadColors) => void;
  over?: (g: CanvasRenderingContext2D, c: PadColors) => void;
}

/** 盤を描く。g は横 0〜1000 の座標系（呼び出し側で拡大済み） */
export function paintPad(g: CanvasRenderingContext2D, c: PadColors, o: PaintOpts): void {
  const h = 1000 / o.aspect;
  g.globalAlpha = 1;
  g.fillStyle = c.white;
  g.fillRect(0, 0, 1000, h);
  g.setLineDash([18, 16]);
  g.strokeStyle = c.inkSoft;
  g.lineWidth = 4;
  g.globalAlpha = 0.5;
  if (o.guide === 'cross') {
    g.beginPath();
    g.moveTo(500, 0);
    g.lineTo(500, h);
    g.moveTo(0, h / 2);
    g.lineTo(1000, h / 2);
    g.stroke();
  } else if (o.guide === 'lines') {
    g.beginPath();
    for (let y = 200; y < h; y += 200) {
      g.moveTo(40, y);
      g.lineTo(960, y);
    }
    g.stroke();
  }
  g.setLineDash([]);
  g.globalAlpha = 1;
  o.under?.(g, c);
  for (const l of o.lines) strokeLine(g, l.p, c[l.c], INK_WIDTH);
  if (o.live) strokeLine(g, o.live.p, c[o.live.c], INK_WIDTH);
  o.over?.(g, c);
}

/** 保存用の PNG（dataURL）。描けない環境（テスト等）では null */
export function renderPng(o: PaintOpts, width = 480): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = Math.round(width / o.aspect);
    const g = canvas.getContext('2d');
    if (!g) return null;
    g.setTransform(width / 1000, 0, 0, width / 1000, 0, 0);
    paintPad(g, readPadColors(), o);
    const url = canvas.toDataURL('image/png');
    return url.startsWith('data:image/png') ? url : null;
  } catch {
    return null;
  }
}

/** 線を整数にし、近すぎる点を間引く（保存の容量を抑える） */
export function simplify(pts: readonly (readonly [number, number])[], maxY: number, minGap = 3) {
  const out: [number, number][] = [];
  const cx = (v: number) => Math.max(0, Math.min(1000, Math.round(v)));
  const cy = (v: number) => Math.max(0, Math.min(Math.round(maxY), Math.round(v)));
  for (const p of pts) {
    const q: [number, number] = [cx(p[0]), cy(p[1])];
    const last = out[out.length - 1];
    if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) >= minGap) out.push(q);
  }
  return out;
}

export interface DrawPadProps {
  /** 横 ÷ 縦（既定 1 = 正方形） */
  aspect?: number;
  guide?: PadGuide;
  lines: readonly DrawLine[];
  color: InkColor;
  locked: boolean;
  onLine(line: DrawLine): void;
  under?: PaintOpts['under'];
  over?: PaintOpts['over'];
  label: string;
  className?: string;
  testId?: string;
}

export function DrawPad(props: DrawPadProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  const live = useRef<{ id: number; line: DrawLine } | null>(null);
  const raf = useRef(0);
  const colors = useRef<PadColors | null>(null);
  const aspect = props.aspect ?? 1;

  const paint = useCallback(() => {
    raf.current = 0;
    const canvas = ref.current;
    const g = canvas?.getContext('2d');
    if (!canvas || !g) return;
    const p = propsRef.current;
    colors.current ??= readPadColors();
    g.setTransform(canvas.width / 1000, 0, 0, canvas.width / 1000, 0, 0);
    paintPad(g, colors.current, {
      aspect: p.aspect ?? 1,
      guide: p.guide ?? 'none',
      lines: p.lines,
      live: live.current?.line ?? null,
      under: p.under,
      over: p.over,
    });
  }, []);
  const schedule = useCallback(() => {
    if (!raf.current && typeof requestAnimationFrame === 'function')
      raf.current = requestAnimationFrame(paint);
  }, [paint]);

  useLayoutEffect(() => {
    propsRef.current = props;
    schedule();
  });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      const px = Math.max(1, Math.round(rect.width * (window.devicePixelRatio || 1)));
      const py = Math.max(1, Math.round(px / (propsRef.current.aspect ?? 1)));
      if (canvas.width !== px || canvas.height !== py) {
        canvas.width = px;
        canvas.height = py;
      }
      schedule();
    };
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    ro?.observe(canvas);
    return () => {
      ro?.disconnect();
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [schedule]);

  const toPoint = (e: { clientX: number; clientY: number }): [number, number] => {
    const rect = ref.current!.getBoundingClientRect();
    const s = 1000 / Math.max(1, rect.width);
    return [(e.clientX - rect.left) * s, (e.clientY - rect.top) * s];
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (propsRef.current.locked || !e.isPrimary) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 取れなくても描ける */
    }
    live.current = { id: e.pointerId, line: { c: propsRef.current.color, p: [toPoint(e)] } };
    schedule();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const l = live.current;
    if (!l || l.id !== e.pointerId) return;
    const evs =
      typeof e.nativeEvent.getCoalescedEvents === 'function'
        ? e.nativeEvent.getCoalescedEvents()
        : [];
    for (const ev of evs.length > 0 ? evs : [e.nativeEvent]) l.line.p.push(toPoint(ev));
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
    const p = simplify(l.line.p, 1000 / aspect);
    if (p.length > 0) propsRef.current.onLine({ c: l.line.c, p });
    schedule();
  };

  return (
    <canvas
      ref={ref}
      className={['drawpad', props.className ?? ''].join(' ')}
      style={{ aspectRatio: String(aspect) }}
      data-testid={props.testId ?? 'drawpad'}
      data-lines={props.lines.length}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      role="img"
      aria-label={props.label}
    />
  );
}
