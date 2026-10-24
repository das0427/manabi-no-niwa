/**
 * なぞり盤の描画（Canvas 2D。座標は 0〜1000 の正方形座標）。
 * 色は CSS のトークン（--leaf 等）を読んで使う（DESINGN.md 3章。直書きしない）。
 * ぼかし・グラデーションは使わない。
 */
import type { TraceItem } from './content';
import { prepareGuide, type Pt, type TraceJudgement } from './judge';

export interface Colors {
  white: string;
  ink: string;
  inkSoft: string;
  leaf: string;
  leafDark: string;
  sun: string;
  sky: string;
  skyDark: string;
  wood: string;
  woodDark: string;
  paper2: string;
  font: string;
}

/** CSS のトークンから色を読む（描画のたびに読まない） */
export function readColors(): Colors {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    white: v('--white', '#fffdf8'),
    ink: v('--ink', '#4a3b32'),
    inkSoft: v('--ink-soft', '#7a6a5e'),
    leaf: v('--leaf', '#5e9e5b'),
    leafDark: v('--leaf-dark', '#3f7440'),
    sun: v('--sun', '#f2c14e'),
    sky: v('--sky', '#8cc3e0'),
    skyDark: v('--sky-dark', '#5a93b3'),
    wood: v('--wood', '#d9a86c'),
    woodDark: v('--wood-dark', '#a8743e'),
    paper2: v('--paper-2', '#f3e8d2'),
    font: v('--font-child', 'sans-serif'),
  };
}

// ---- お手本の動き ---------------------------------------------------------------

/** 1画をたどる時間（約 1.5 秒）と画のあいだの間 */
export const DEMO_STROKE_MS = 1500;
export const DEMO_GAP_MS = 350;

export const demoDuration = (strokeCount: number): number =>
  strokeCount * DEMO_STROKE_MS + Math.max(0, strokeCount - 1) * DEMO_GAP_MS;

export interface DemoFrame {
  /** いま動いている画（まだ始まっていなければ -1） */
  stroke: number;
  /** 動く点の位置 */
  dot: Pt | null;
  /** いま動いている画の、点までの軌跡 */
  trail: Pt[];
  /** 動き終わった画の番号 */
  done: number[];
  finished: boolean;
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function demoFrame(item: TraceItem, elapsed: number): DemoFrame {
  const g = prepareGuide(item.strokes);
  const done: number[] = [];
  for (let i = 0; i < g.length; i++) {
    const t0 = i * (DEMO_STROKE_MS + DEMO_GAP_MS);
    const e = elapsed - t0;
    if (e < 0) return { stroke: -1, dot: null, trail: [], done, finished: false };
    if (e >= DEMO_STROKE_MS) {
      done.push(i);
      continue;
    }
    const s = g[i]!;
    const d = ease(e / DEMO_STROKE_MS) * s.total;
    let j = 1;
    while (j < s.pts.length - 1 && s.arc[j]! < d) j++;
    const seg = s.arc[j]! - s.arc[j - 1]!;
    const u = seg === 0 ? 0 : (d - s.arc[j - 1]!) / seg;
    const a = s.pts[j - 1]!;
    const b = s.pts[j]!;
    const dot: Pt = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    return { stroke: i, dot, trail: [...s.pts.slice(0, j), dot], done, finished: false };
  }
  return { stroke: -1, dot: null, trail: [], done, finished: true };
}

// ---- 描画 -----------------------------------------------------------------------

export interface Scene {
  item: TraceItem;
  /** 判定幅 r（お手本の線の太さ = 2r） */
  r: number;
  judgement: TraceJudgement;
  lines: readonly { p: readonly Pt[] }[];
  live: readonly Pt[] | null;
  /** ヒントで囲む位置 */
  hintAt: Pt | null;
  demo: DemoFrame | null;
  /** お手本の動きを止めた矢印で見せる（動きを減らす設定） */
  arrows: boolean;
  /** 「つぎへ」: お手本を最後まで見せる */
  reveal: boolean;
}

const INK_WIDTH = 30;

/** 始点から弧長 limit までのお手本の点（描画用の進んだ部分） */
function traced(st: { pts: Pt[]; arc: number[] }, limit: number): Pt[] {
  if (limit <= 0) return [];
  let n = 0;
  while (n + 1 < st.pts.length && st.arc[n + 1]! <= limit) n++;
  return st.pts.slice(0, n + 1);
}

function path(ctx: CanvasRenderingContext2D, pts: readonly Pt[]) {
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
}

function band(
  ctx: CanvasRenderingContext2D,
  pts: readonly Pt[],
  width: number,
  color: string,
  alpha = 1,
) {
  if (pts.length === 0) return;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0]![0], pts[0]![1], width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    path(ctx, pts);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, outer: number, c: Colors) {
  const inner = outer * 0.45;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    const rad = i % 2 === 0 ? outer : inner;
    const px = x + rad * Math.cos(a);
    const py = y + rad * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = c.sun;
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = 8;
  ctx.lineJoin = 'round';
  ctx.fill();
  ctx.stroke();
}

function badge(
  ctx: CanvasRenderingContext2D,
  p: Pt,
  radius: number,
  fill: string,
  line: string,
  label: string | null,
  labelColor: string,
  c: Colors,
) {
  ctx.beginPath();
  ctx.arc(p[0], p[1], radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.strokeStyle = line;
  ctx.lineWidth = 8;
  ctx.fill();
  ctx.stroke();
  if (label) {
    ctx.fillStyle = labelColor;
    ctx.font = `700 ${Math.round(radius * 1.2)}px ${c.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, p[0], p[1] + radius * 0.06);
  }
}

/** 止まった矢印（動きを減らす設定のお手本）。各画の 25%・50%・75% の位置に進行方向の三角を置く */
function arrowsOn(ctx: CanvasRenderingContext2D, item: TraceItem, c: Colors) {
  const g = prepareGuide(item.strokes);
  for (const s of g) {
    for (const f of [0.25, 0.5, 0.75]) {
      const d = s.total * f;
      let j = 1;
      while (j < s.pts.length - 1 && s.arc[j]! < d) j++;
      const a = s.pts[j - 1]!;
      const b = s.pts[Math.min(s.pts.length - 1, j + 1)]!;
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const p = s.pts[j]!;
      ctx.save();
      ctx.translate(p[0], p[1]);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(34, 0);
      ctx.lineTo(-22, -28);
      ctx.lineTo(-22, 28);
      ctx.closePath();
      ctx.fillStyle = c.sun;
      ctx.strokeStyle = c.ink;
      ctx.lineWidth = 8;
      ctx.lineJoin = 'round';
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}

/** 盤全体を描く。ctx は 0〜1000 の座標系（呼び出し側で拡大済み） */
export function paintBoard(ctx: CanvasRenderingContext2D, c: Colors, s: Scene): void {
  const { item, r, judgement } = s;
  const g = prepareGuide(item.strokes);
  const isMaze = item.kind === 'maze';
  const isLetter = item.kind === 'letter';

  // 背景
  ctx.globalAlpha = 1;
  ctx.fillStyle = isMaze ? c.wood : c.white;
  ctx.fillRect(0, 0, 1000, 1000);

  // 迷路は通路（行き止まりも含む）を白く抜く。壁は描くだけで判定には使わない
  if (isMaze) {
    for (const cor of item.corridors ?? []) band(ctx, cor, 2 * r, c.white);
  }

  // お手本の線（判定幅に合わせた太さの薄い色）と、進んだ部分
  g.forEach((st, i) => {
    const sj = judgement.strokes[i]!;
    const complete = sj.complete || s.reveal;
    if (!isMaze) band(ctx, st.pts, 2 * r, c.sky, 0.4);
    // 進み位置 k は指の先 r ほど先を指すので、表示は r だけ手前までにする（インクより先に色がつかないように）
    const shown = complete ? st.pts : traced(st, sj.arc - r);
    if (shown.length > 1) band(ctx, shown, 2 * r, c.leaf, 0.45);
    // 細い中心線（形が分かるように。迷路は答えになるので、見せるのは進んだ部分だけ）
    if (!isMaze) band(ctx, st.pts, 7, c.skyDark, 0.85);
    else if (shown.length > 1) band(ctx, shown, 7, c.leafDark, 0.8);
  });

  // 子供のインク（外れても常に描く。使われた線は濃く、使われなかった線は薄く）
  s.lines.forEach((ln, i) => {
    const used = judgement.lines[i]?.used ?? true;
    band(ctx, ln.p, INK_WIDTH, c.ink, used ? 1 : 0.28);
  });
  if (s.live) band(ctx, s.live, INK_WIDTH, c.ink, 1);

  // 動きを減らす設定では、お手本の動きの代わりに止まった矢印
  if (s.arrows) arrowsOn(ctx, item, c);

  // ヒント: 対象を囲む（破線＋薄い黄色の面。点滅しない）
  if (s.hintAt) {
    ctx.beginPath();
    ctx.arc(s.hintAt[0], s.hintAt[1], 88, 0, Math.PI * 2);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = c.sun;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.setLineDash([26, 20]);
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 始点（みどりの丸・画の番号）と終点（ほし）
  const cur = judgement.current;
  g.forEach((st, i) => {
    const sj = judgement.strokes[i]!;
    if (sj.complete || s.reveal) return;
    const start = st.pts[0]!;
    const end = st.pts[st.pts.length - 1]!;
    const label = isLetter ? String(i + 1) : null;
    if (i === cur) {
      const closed = Math.hypot(start[0] - end[0], start[1] - end[1]) < 2 * r;
      if (!closed) star(ctx, end[0], end[1], 50, c);
      badge(ctx, start, 46, c.leaf, c.ink, label, c.white, c);
    } else {
      badge(ctx, start, 36, c.white, c.inkSoft, label, c.inkSoft, c);
    }
  });

  // お手本の動き（点が線をたどる）
  const d = s.demo;
  if (d) {
    for (const i of d.done) band(ctx, g[i]!.pts, 16, c.leafDark, 0.9);
    if (d.trail.length > 1) band(ctx, d.trail, 16, c.leafDark, 0.9);
    if (d.dot) {
      ctx.beginPath();
      ctx.arc(d.dot[0], d.dot[1], 34, 0, Math.PI * 2);
      ctx.fillStyle = c.sun;
      ctx.strokeStyle = c.ink;
      ctx.lineWidth = 9;
      ctx.fill();
      ctx.stroke();
    }
  }
}
