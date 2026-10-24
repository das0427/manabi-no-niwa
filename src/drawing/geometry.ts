/**
 * 図形の形・座標変換・当たり判定（review-1 #11、X-ED-02）。純粋な関数。
 * 図形はすべて「中心が原点の多角形（点列）」で表し、描画・SVG・当たり判定で同じ形を使う。
 */
import type { ArtItem, ObjItem, ShapeItem, ShapeKind, StampItem } from './model';

export type Pt = { x: number; y: number };

/** 図形の点列（中心が原点、幅 w・高さ h）。line は2点の開いた線 */
export function shapePoints(shape: ShapeKind, w: number, h: number): Pt[] {
  const hw = w / 2;
  const hh = h / 2;
  switch (shape) {
    case 'circle':
    case 'ellipse': {
      const n = 72;
      return Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        return { x: Math.cos(a) * hw, y: Math.sin(a) * hh };
      });
    }
    case 'rect':
      return [
        { x: -hw, y: -hh },
        { x: hw, y: -hh },
        { x: hw, y: hh },
        { x: -hw, y: hh },
      ];
    case 'triangle':
      return [
        { x: 0, y: -hh },
        { x: hw, y: hh },
        { x: -hw, y: hh },
      ];
    case 'star': {
      const raw: Pt[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? 1 : 0.45;
        raw.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
      }
      return fitBox(raw, w, h);
    }
    case 'heart': {
      const n = 80;
      const raw: Pt[] = Array.from({ length: n }, (_, i) => {
        const t = (i / n) * Math.PI * 2;
        return {
          x: 16 * Math.sin(t) ** 3,
          y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
        };
      });
      return fitBox(raw, w, h);
    }
    case 'line':
      return [
        { x: -hw, y: 0 },
        { x: hw, y: 0 },
      ];
  }
}

/** 点列を箱（-w/2..w/2, -h/2..h/2）にぴったり合わせる */
function fitBox(raw: Pt[], w: number, h: number): Pt[] {
  const xs = raw.map((p) => p.x);
  const ys = raw.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return raw.map((p) => ({
    x: ((p.x - minX) / (maxX - minX) - 0.5) * w,
    y: ((p.y - minY) / (maxY - minY) - 0.5) * h,
  }));
}

export const isClosed = (shape: ShapeKind): boolean => shape !== 'line';

/** SVG の path（オーバーレイ・縮む演出に使う） */
export function shapePathD(shape: ShapeKind, w: number, h: number): string {
  const pts = shapePoints(shape, w, h);
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
  return d.join(' ') + (isClosed(shape) ? ' Z' : '');
}

/** ワールド座標 → オブジェクトの局所座標（中心が原点、回転・反転を戻す） */
export function toLocal(it: ObjItem, p: Pt): Pt {
  const dx = p.x - it.x;
  const dy = p.y - it.y;
  const a = (-it.rotation * Math.PI) / 180;
  let x = dx * Math.cos(a) - dy * Math.sin(a);
  const y = dx * Math.sin(a) + dy * Math.cos(a);
  if (it.kind === 'stamp' && it.flipX) x = -x;
  return { x, y };
}

/** オブジェクトの局所の大きさ（幅・高さ） */
export function itemSize(it: ObjItem): { w: number; h: number } {
  return it.kind === 'stamp' ? { w: it.size, h: it.size } : { w: it.w, h: it.h };
}

/** 回転を含めた外接矩形（ワールド座標） */
export function itemBounds(it: ObjItem): { x0: number; y0: number; x1: number; y1: number } {
  const { w, h } = itemSize(it);
  const pad = it.kind === 'shape' ? it.strokeWidth / 2 + 2 : 2;
  const a = (it.rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  const hw = (w * c + h * s) / 2 + pad;
  const hh = (w * s + h * c) / 2 + pad;
  return { x0: it.x - hw, y0: it.y - hh, x1: it.x + hw, y1: it.y + hh };
}

export function pointInPolygon(p: Pt, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distToOutline(p: Pt, pts: readonly Pt[], closed: boolean): number {
  let d = Infinity;
  const n = pts.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    d = Math.min(d, distToSegment(p, pts[i]!, pts[(i + 1) % n]!));
  }
  return d;
}

// ---------------------------------------------------------------- 当たり判定

export interface HitOptions {
  /** 表示上の 1u を論理座標に直した長さ */
  u: number;
  /** はんこの局所座標（0〜100 の正方形）の不透明度（0〜255）。分からなければ 0 */
  stampAlpha: (it: StampItem, lx: number, ly: number) => number;
  /** 循環選択（くわしく だけ）: 直前に選んだ物と位置 */
  cycle?: { id: string; at: Pt } | null;
}

/** 図形の「描いた結果」にその点が乗っているか（塗りの中、または線の上） */
function shapeOpaqueAt(it: ShapeItem, local: Pt): boolean {
  const pts = shapePoints(it.shape, it.w, it.h);
  const closed = isClosed(it.shape);
  if (closed && it.fill && pointInPolygon(local, pts)) return true;
  return it.strokeWidth > 0 && distToOutline(local, pts, closed) <= it.strokeWidth / 2;
}

/**
 * その点で「当たる」か（review-1 #11）:
 * 描いた結果の不透明な画素 または 中心から 2.75u 以内 または 図形の線から 2u 以内。
 * 図形の線の距離は線の太さの半分を除いた「線のふち」から測る。
 */
export function hitsItem(it: ObjItem, p: Pt, opt: Pick<HitOptions, 'u' | 'stampAlpha'>): boolean {
  if (Math.hypot(p.x - it.x, p.y - it.y) <= 2.75 * opt.u) return true;
  const local = toLocal(it, p);
  if (it.kind === 'stamp') {
    const lx = (local.x / it.size) * 100 + 50;
    const ly = (local.y / it.size) * 100 + 50;
    if (lx < 0 || ly < 0 || lx >= 100 || ly >= 100) return false;
    return opt.stampAlpha(it, lx, ly) > 32;
  }
  if (shapeOpaqueAt(it, local)) return true;
  const pts = shapePoints(it.shape, it.w, it.h);
  return distToOutline(local, pts, isClosed(it.shape)) <= it.strokeWidth / 2 + 2 * opt.u;
}

/** その点に当たるオブジェクト（手前から順） */
export function hitCandidates(items: readonly ArtItem[], p: Pt, opt: HitOptions): ObjItem[] {
  const out: ObjItem[] = [];
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i]!;
    if (it.kind !== 'ink' && hitsItem(it, p, opt)) out.push(it);
  }
  return out;
}

/**
 * 選ぶ対象（X-ED-02）。かんたん は常に最前面。くわしく（cycle を渡す）は、
 * 直前に選んだ物の近く（2u 以内）を続けてタップしたら、次に奥の物へ（最後まで行ったら手前に戻る）。
 */
export function pickItem(items: readonly ArtItem[], p: Pt, opt: HitOptions): ObjItem | null {
  const c = hitCandidates(items, p, opt);
  if (c.length === 0) return null;
  const prev = opt.cycle;
  if (prev && Math.hypot(p.x - prev.at.x, p.y - prev.at.y) <= 2 * opt.u) {
    const i = c.findIndex((it) => it.id === prev.id);
    if (i >= 0) return c[(i + 1) % c.length]!;
  }
  return c[0]!;
}
