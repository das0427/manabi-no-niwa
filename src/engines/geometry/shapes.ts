/**
 * 図形の判定に使う純粋関数（格子の点の整数座標で計算する）。
 * 多角形は頂点の列。同じ形かどうかは「頂点の集合（始点・回る向きの違いを同一視）」や辺の関係で決める。
 */
export type Pt = [number, number];

const EPS = 1e-9;
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const cross = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0];
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
export const d2 = (a: Pt, b: Pt) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
const near = (a: number, b: number) => Math.abs(a - b) < EPS;
export const samePt = (a: Pt, b: Pt) => near(a[0], b[0]) && near(a[1], b[1]);

/** 重なった点と、まっすぐ並んだ途中の点を取り除く（辺の途中をタップしても同じ形） */
export function normalizePolygon(ps: Pt[]): Pt[] {
  let pts = ps.filter((p, i) => !samePt(p, ps[(i + 1) % ps.length]!));
  let changed = true;
  while (changed && pts.length >= 3) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length]!;
      const b = pts[i]!;
      const c = pts[(i + 1) % pts.length]!;
      if (near(cross(sub(b, a), sub(c, b)), 0)) {
        pts = pts.filter((_, k) => k !== i);
        changed = true;
        break;
      }
    }
  }
  return pts;
}

/** 頂点の列が同じ多角形か（始点・向きの違いを同一視） */
export function sameCycle(a: Pt[], b: Pt[]): boolean {
  if (a.length !== b.length) return false;
  const n = a.length;
  for (const dir of [1, -1]) {
    for (let s = 0; s < n; s++) {
      let ok = true;
      for (let i = 0; i < n && ok; i++) ok = samePt(a[i]!, b[(((s + dir * i) % n) + n) % n]!);
      if (ok) return true;
    }
  }
  return false;
}

/** 頂点の対応（始点・向き）を探して、すべての2点間の距離² が k 倍になるか（合同 k=1、拡大 k=比²） */
export function similarCycle(a: Pt[], b: Pt[], k: number, allowFlip = true): boolean {
  if (a.length !== b.length || a.length < 3) return false;
  const n = a.length;
  const orientA = Math.sign(signedArea(a));
  for (const dir of [1, -1]) {
    for (let s = 0; s < n; s++) {
      const m = (i: number) => b[(((s + dir * i) % n) + n) % n]!;
      let ok = true;
      for (let i = 0; i < n && ok; i++)
        for (let j = i + 1; j < n && ok; j++) ok = near(d2(a[i]!, a[j]!), k * d2(m(i), m(j)));
      if (!ok) continue;
      if (!allowFlip) {
        const mapped = Array.from({ length: n }, (_, i) => m(i));
        if (Math.sign(signedArea(mapped)) !== orientA) continue;
      }
      return true;
    }
  }
  return false;
}

export function signedArea(ps: Pt[]): number {
  let s = 0;
  for (let i = 0; i < ps.length; i++) s += cross(ps[i]!, ps[(i + 1) % ps.length]!);
  return s / 2;
}

function segCross(p1: Pt, p2: Pt, q1: Pt, q2: Pt): boolean {
  const o = (a: Pt, b: Pt, c: Pt) => Math.sign(cross(sub(b, a), sub(c, a)));
  const o1 = o(p1, p2, q1);
  const o2 = o(p1, p2, q2);
  const o3 = o(q1, q2, p1);
  const o4 = o(q1, q2, p2);
  if (o1 !== o2 && o3 !== o4) return true;
  const on = (a: Pt, b: Pt, c: Pt) =>
    Math.min(a[0], b[0]) - EPS <= c[0] &&
    c[0] <= Math.max(a[0], b[0]) + EPS &&
    Math.min(a[1], b[1]) - EPS <= c[1] &&
    c[1] <= Math.max(a[1], b[1]) + EPS;
  return (
    (o1 === 0 && on(p1, p2, q1)) ||
    (o2 === 0 && on(p1, p2, q2)) ||
    (o3 === 0 && on(q1, q2, p1)) ||
    (o4 === 0 && on(q1, q2, p2))
  );
}

/** 辺どうしが交わらない（ねじれていない）多角形か */
export function isSimple(ps: Pt[]): boolean {
  const n = ps.length;
  if (n < 3 || near(signedArea(ps), 0)) return false;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segCross(ps[i]!, ps[(i + 1) % n]!, ps[j]!, ps[(j + 1) % n]!)) return false;
    }
  return true;
}

export type ShapeClass =
  | 'triangle'
  | 'right-triangle'
  | 'isosceles-triangle'
  | 'equilateral-triangle'
  | 'quadrilateral'
  | 'trapezoid'
  | 'parallelogram'
  | 'rhombus'
  | 'rectangle'
  | 'square';

export const SHAPE_NAME: Record<ShapeClass, string> = {
  triangle: 'さんかくけい',
  'right-triangle': 'ちょっかくさんかくけい',
  'isosceles-triangle': 'にとうへんさんかくけい',
  'equilateral-triangle': 'せいさんかくけい',
  quadrilateral: 'しかくけい',
  trapezoid: 'だいけい',
  parallelogram: 'へいこうしへんけい',
  rhombus: 'ひしがた',
  rectangle: 'ちょうほうけい',
  square: 'せいほうけい',
};

/** 形があてはまる仲間（性質で。正方形は長方形・ひし形・平行四辺形・台形にもあてはまる） */
export function shapeClasses(ps: Pt[]): Set<ShapeClass> {
  const out = new Set<ShapeClass>();
  const n = ps.length;
  const side = (i: number) => d2(ps[i]!, ps[(i + 1) % n]!);
  const vec = (i: number) => sub(ps[(i + 1) % n]!, ps[i]!);
  const rightAt = (i: number) => near(dot(vec((i - 1 + n) % n), vec(i)), 0);
  const par = (i: number, j: number) => near(cross(vec(i), vec(j)), 0);
  if (n === 3) {
    out.add('triangle');
    if ([0, 1, 2].some(rightAt)) out.add('right-triangle');
    const s = [side(0), side(1), side(2)];
    if (near(s[0]!, s[1]!) || near(s[1]!, s[2]!) || near(s[0]!, s[2]!))
      out.add('isosceles-triangle');
    if (near(s[0]!, s[1]!) && near(s[1]!, s[2]!)) out.add('equilateral-triangle');
  }
  if (n === 4) {
    out.add('quadrilateral');
    const p02 = par(0, 2);
    const p13 = par(1, 3);
    if (p02 || p13) out.add('trapezoid');
    if (p02 && p13) out.add('parallelogram');
    const eqSides = [1, 2, 3].every((i) => near(side(i), side(0)));
    const right = [0, 1, 2, 3].every(rightAt);
    if (p02 && p13 && eqSides) out.add('rhombus');
    if (right) out.add('rectangle');
    if (right && eqSides) out.add('square');
  }
  return out;
}

/** 「いちばん くわしい」仲間（exclusive の判定に使う） */
const SPECIFIC: ShapeClass[] = [
  'square',
  'rectangle',
  'rhombus',
  'parallelogram',
  'trapezoid',
  'quadrilateral',
  'equilateral-triangle',
  'right-triangle',
  'isosceles-triangle',
  'triangle',
];
export function mostSpecific(ps: Pt[]): ShapeClass | null {
  const c = shapeClasses(ps);
  return SPECIFIC.find((k) => c.has(k)) ?? null;
}

/** 辺の長さ（の2乗）の組が同じか（順不同） */
export function sameSides(ps: Pt[], lengths: number[]): boolean {
  if (ps.length !== lengths.length) return false;
  const a = ps.map((p, i) => d2(p, ps[(i + 1) % ps.length]!)).sort((x, y) => x - y);
  const b = lengths.map((l) => l * l).sort((x, y) => x - y);
  return a.every((v, i) => near(v, b[i]!));
}

/** 直線 a-b について線対称の位置 */
export function reflectPt(p: Pt, a: Pt, b: Pt): Pt {
  const v = sub(b, a);
  const t = dot(sub(p, a), v) / dot(v, v);
  const foot: Pt = [a[0] + v[0] * t, a[1] + v[1] * t];
  return [round9(2 * foot[0] - p[0]), round9(2 * foot[1] - p[1])];
}
/** 点 c について点対称の位置 */
export function rotate180(p: Pt, c: Pt): Pt {
  return [2 * c[0] - p[0], 2 * c[1] - p[1]];
}
function round9(x: number): number {
  return Math.round(x * 1e9) / 1e9;
}

/** 多角形をずらしただけの形か */
export function isTranslation(a: Pt[], b: Pt[]): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  for (let s = 0; s < b.length; s++) {
    const off = sub(b[s]!, a[0]!);
    const moved = a.map((p) => [p[0] + off[0], p[1] + off[1]] as Pt);
    if (sameCycle(moved, b)) return true;
  }
  return false;
}

/** 2つの直線（2点で表す）の関係 */
export function lineRelation(
  a: [Pt, Pt],
  b: [Pt, Pt],
): 'perpendicular' | 'parallel' | 'same' | 'other' {
  const u = sub(a[1], a[0]);
  const v = sub(b[1], b[0]);
  if (near(dot(u, v), 0)) return 'perpendicular';
  if (near(cross(u, v), 0)) return near(cross(u, sub(b[0], a[0])), 0) ? 'same' : 'parallel';
  return 'other';
}
export function onLine(p: Pt, l: [Pt, Pt]): boolean {
  return near(cross(sub(l[1], l[0]), sub(p, l[0])), 0);
}
