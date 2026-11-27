/**
 * 描く問題（draw）の見本の形。解説（revealed）で、子供の図が目標を満たしていないとき（何も描いていないときを含む）に、
 * 格子へ点線（geo-answer）で出す。目標の種類ごとに次の形を作る（DESINGN.md 18章）。
 *  exact / reflect / rotate180 … 目標の頂点そのもの（reflect は軸、rotate180 は中心で移した位置）
 *  congruent … given の形を、格子の空いている所（given と重ならない所）へずらしたもの
 *  similar   … given の形を ratio 倍にして、空いている所に置いたもの
 *  shape     … 種類と辺（sides）から作った形（ましかく 2×2・ながしかく 3×2・さんかく など）を格子の中ほどに
 *  perpendicular / parallel … through（無ければ格子の中ほど）を通る直線
 * 作った形は、判定（judgeDraw）が正解とみなすものだけにする（shape は matchShape で確かめて選ぶ）。
 * どれも作れないとき（格子に入らない・正三角形など）は null（見本を出さない）。
 */
import type { GeoShape, GeoTarget, GeoTask } from './geometry';
import {
  isSimple,
  lineRelation,
  matchShape,
  normalizePolygon,
  onLine,
  reflectPt,
  rotate180,
  type Pt,
} from './shapes';

export type DrawTask = Extract<GeoTask, { kind: 'draw' }>;
type Grid = DrawTask['grid'];
type ShapeTarget = Extract<GeoTarget, { kind: 'shape' }>;
type LineTarget = Extract<GeoTarget, { kind: 'perpendicular' | 'parallel' }>;

/** 見本: 多角形（頂点の列）か、直線（通る格子の点 2 つ。両はしは格子の端までのばして描く） */
export type Example = { kind: 'polygon'; points: Pt[] } | { kind: 'line'; points: [Pt, Pt] };

const EPS = 1e-9;
const round9 = (x: number) => Math.round(x * 1e9) / 1e9;

/** 目標の多角形が頂点そのものとして決まる種類（exact・reflect・rotate180）の頂点 */
export function targetPolygon(t: GeoTarget): Pt[] | null {
  switch (t.kind) {
    case 'exact':
      return t.points;
    case 'reflect':
      return t.points.map((p) => reflectPt(p, t.axis[0], t.axis[1]));
    case 'rotate180':
      return t.points.map((p) => rotate180(p, t.center));
    default:
      return null;
  }
}

// ---- 空いている所に置く ----
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function boxOf(ps: Pt[]): Box {
  const xs = ps.map((p) => p[0]);
  const ys = ps.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** 2つの枠のすき間（0 以上: 重ならない、1 以上: 間に 1 ます以上あく。負: 重なる） */
const gapOf = (a: Box, b: Box) => Math.max(b.x0 - a.x1, a.x0 - b.x1, b.y0 - a.y1, a.y0 - b.y1);

/**
 * 形 ps（座標は自由）を、格子の中で避ける枠 avoid と重ならない所に置く。
 * 間があく置き方 → 接する置き方 → 重なりが少ない置き方の順に、anchor（置きたい枠の左上）に近い所を選ぶ。
 * anchor が 'center' なら格子の中ほど。置く位置は格子の点（整数）。入らなければ null。
 */
function place(
  ps: Pt[],
  grid: Grid,
  avoid: Box[],
  anchor: 'center' | [number, number],
): Pt[] | null {
  const b = boxOf(ps);
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  if (w > grid.w + EPS || h > grid.h + EPS) return null;
  const [ax, ay] = anchor === 'center' ? [(grid.w - w) / 2, (grid.h - h) / 2] : anchor;
  let best: { x: number; y: number; key: [number, number, number] } | null = null;
  for (let y = 0; y <= Math.floor(grid.h - h + EPS); y++)
    for (let x = 0; x <= Math.floor(grid.w - w + EPS); x++) {
      const at: Box = { x0: x, y0: y, x1: x + w, y1: y + h };
      const gap = avoid.reduce((m, o) => Math.min(m, gapOf(at, o)), Infinity);
      const tier = gap >= 1 ? 0 : gap >= 0 ? 1 : 2;
      const dx = x - ax;
      const dy = y - ay;
      // 同じ近さなら右・下を選ぶ（読む向き）
      const dist = dx * dx + dy * dy + (dx < 0 ? 0.01 : 0) + (dy < 0 ? 0.005 : 0);
      const key: [number, number, number] = [tier, tier === 2 ? -gap : 0, dist];
      const better =
        !best ||
        key[0] < best.key[0] ||
        (key[0] === best.key[0] &&
          (key[1] < best.key[1] || (key[1] === best.key[1] && key[2] < best.key[2] - 1e-12)));
      if (better) best = { x, y, key };
    }
  if (!best) return null;
  return ps.map((p): Pt => [round9(p[0] - b.x0 + best!.x), round9(p[1] - b.y0 + best!.y)]);
}

const givenBoxes = (t: DrawTask): Box[] =>
  (t.given ?? [])
    .filter((s: GeoShape) => s.points.length > 0)
    .map((s: GeoShape) => boxOf(s.points));

// ---- shape: 種類と辺から作る ----
const rect = (w: number, h: number): Pt[] => [
  [0, 0],
  [w, 0],
  [w, h],
  [0, h],
];
/** 二等辺三角形（底 b・高さ h。頂点は底の真ん中の上。b が奇数なら格子の点にならない） */
const isoTri = (b: number, h: number): Pt[] => [
  [0, h],
  [b, h],
  [b / 2, 0],
];
/** 直角三角形（直角をはさむ辺が a・b。軸にそろえる） */
const rightTri = (a: number, b: number): Pt[] => [
  [0, 0],
  [a, 0],
  [0, b],
];
/** 台形（下の底 a・上の底 c・高さ h。左右対称。a − c は偶数） */
const trapezoid = (a: number, c: number, h: number): Pt[] => [
  [0, h],
  [a, h],
  [(a + c) / 2, 0],
  [(a - c) / 2, 0],
];
/** 直角台形（下の底 a・上の底 c・高さ h。左の辺が垂直） */
const rightTrapezoid = (a: number, c: number, h: number): Pt[] => [
  [0, 0],
  [c, 0],
  [a, h],
  [0, h],
];
/** 平行四辺形（底 a・上の辺が s ずれる・高さ t） */
const parallelogram = (a: number, s: number, t: number): Pt[] => [
  [0, t],
  [a, t],
  [a + s, 0],
  [s, 0],
];
/** ひし形（対角線が軸にそろう。対角線の長さは 2p と 2q） */
const diamond = (p: number, q: number): Pt[] => [
  [p, 0],
  [2 * p, q],
  [p, 2 * q],
  [0, q],
];

const range = (from: number, to: number) =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

/** 格子の点を 3 つ選ぶ全部（辺の長さから探すとき）。広さは 8×6 まで */
function* anyTriangles(grid: Grid): Generator<Pt[]> {
  const all: Pt[] = [];
  for (const y of range(0, Math.min(grid.h, 6)))
    for (const x of range(0, Math.min(grid.w, 8))) all.push([x, y]);
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++)
      for (let k = j + 1; k < all.length; k++) yield [all[i]!, all[j]!, all[k]!];
}

/** 平行四辺形・ひし形を、辺 a（sides のどれか）で探す */
function* parallelograms(sides: number[]): Generator<Pt[]> {
  for (const a of new Set(sides))
    if (Number.isInteger(a))
      for (const t of range(1, 6)) for (const s of range(0, 6)) yield parallelogram(a, s, t);
}

/** 見本の形の候補（好ましい順。座標の原点はどこでもよい） */
function* shapeCandidates(sg: ShapeTarget, grid: Grid): Generator<Pt[]> {
  const sides = sg.sides ? [...sg.sides].sort((a, b) => a - b) : undefined;
  switch (sg.shape) {
    case 'square':
      for (const n of sides ? [sides[0]!] : [2, 3, 1, 4, 5, 6]) yield rect(n, n);
      return;
    case 'rectangle':
      if (sides) {
        yield rect(sides[sides.length - 1]!, sides[0]!);
        yield rect(sides[0]!, sides[sides.length - 1]!);
        return;
      }
      for (const w of [3, 2, 4, 5, 6, 7, 8])
        for (const h of [2, 1, 3, 4, 5]) if (h < w) yield rect(w, h);
      return;
    case 'right-triangle':
      if (sides) {
        yield rightTri(sides[0]!, sides[1]!);
        yield rightTri(sides[1]!, sides[0]!);
        yield* anyTriangles(grid);
        return;
      }
      for (const [a, b] of [
        [3, 2],
        [2, 2],
        [2, 1],
        [4, 3],
        [3, 3],
        [1, 1],
      ] as const)
        yield rightTri(a, b);
      return;
    case 'isosceles-triangle':
    case 'triangle':
      if (sides) {
        yield rightTri(sides[0]!, sides[1]!);
        yield* anyTriangles(grid);
        return;
      }
      for (const [b, h] of [
        [4, 3],
        [4, 2],
        [2, 2],
        [2, 1],
        [6, 3],
        [6, 2],
      ] as const)
        yield isoTri(b, h);
      return;
    case 'trapezoid':
      yield trapezoid(4, 2, 2);
      yield trapezoid(4, 2, 1);
      yield rightTrapezoid(3, 1, 2);
      yield rightTrapezoid(2, 1, 2);
      yield rightTrapezoid(2, 1, 1);
      return;
    case 'parallelogram':
      if (sides) yield* parallelograms(sides);
      for (const [a, s, t] of [
        [3, 1, 2],
        [2, 1, 2],
        [3, 1, 1],
        [2, 1, 1],
        [4, 2, 2],
      ] as const)
        yield parallelogram(a, s, t);
      return;
    case 'rhombus':
      for (const p of range(1, 6)) for (const q of range(1, 6)) if (p !== q) yield diamond(p, q);
      if (sides) yield* parallelograms(sides);
      return;
    case 'quadrilateral':
      yield [
        [0, 1],
        [2, 0],
        [4, 2],
        [1, 3],
      ];
      for (const [w, h] of [
        [3, 2],
        [2, 2],
        [2, 1],
      ] as const)
        yield rect(w, h);
      if (sides) {
        yield* parallelograms(sides);
        yield rect(sides[sides.length - 1]!, sides[0]!);
      }
      return;
    default:
      // 正三角形は格子の点では描けない
      return;
  }
}

function shapeExample(sg: ShapeTarget, t: DrawTask): Pt[] | null {
  const avoid = givenBoxes(t);
  for (const c of shapeCandidates(sg, t.grid)) {
    const poly = normalizePolygon(c);
    if (poly.length < 3 || !isSimple(poly)) continue;
    const m = matchShape(poly, sg.shape, sg.sides, sg.exclusive);
    if (!m.classOk || !m.sidesOk) continue;
    const placed = place(poly, t.grid, avoid, 'center');
    if (placed) return placed;
  }
  return null;
}

// ---- 垂直・平行な直線 ----
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

function lineExample(tg: LineTarget, grid: Grid): [Pt, Pt] | null {
  const dx = tg.to[1][0] - tg.to[0][0];
  const dy = tg.to[1][1] - tg.to[0][1];
  const k = gcd(Math.abs(dx), Math.abs(dy));
  if (k === 0) return null;
  // 向きは格子の点をたどれる最小の歩み
  const d: Pt = tg.kind === 'parallel' ? [dx / k, dy / k] : [0 - dy / k, dx / k];
  const inside = (p: Pt) => p[0] >= 0 && p[1] >= 0 && p[0] <= grid.w && p[1] <= grid.h;
  const second = (p: Pt): Pt | null => {
    for (let m = 1; m <= Math.max(grid.w, grid.h); m++)
      for (const s of [1, -1]) {
        const q: Pt = [p[0] + s * m * d[0], p[1] + s * m * d[1]];
        if (inside(q)) return q;
      }
    return null;
  };
  const ok = (a: Pt, b: Pt) =>
    lineRelation(tg.to, [a, b]) === tg.kind && (!tg.through || onLine(tg.through, [a, b]));
  if (tg.through) {
    const q = second(tg.through);
    return q && ok(tg.through, q) ? [tg.through, q] : null;
  }
  // 格子の中ほどに近い点から探す（平行は基準の直線の上を避ける）
  const cx = grid.w / 2;
  const cy = grid.h / 2;
  const anchors: Pt[] = [];
  for (const y of range(0, grid.h)) for (const x of range(0, grid.w)) anchors.push([x, y]);
  anchors.sort(
    (a, b) => (a[0] - cx) ** 2 + (a[1] - cy) ** 2 - ((b[0] - cx) ** 2 + (b[1] - cy) ** 2),
  );
  for (const p of anchors) {
    const q = second(p);
    if (q && ok(p, q)) return [p, q];
  }
  return null;
}

/** 描く問題 t の見本。作れないときは null */
export function exampleFor(t: DrawTask): Example | null {
  const tg = t.target;
  if (tg.kind === 'perpendicular' || tg.kind === 'parallel') {
    const l = lineExample(tg, t.grid);
    return l ? { kind: 'line', points: l } : null;
  }
  const want = targetPolygon(tg);
  if (want) return { kind: 'polygon', points: want };
  if (tg.kind === 'shape') {
    const ps = shapeExample(tg, t);
    return ps ? { kind: 'polygon', points: ps } : null;
  }
  if (tg.kind === 'congruent' || tg.kind === 'similar') {
    const src = boxOf(tg.points);
    const k = tg.kind === 'similar' ? tg.ratio : 1;
    // 元の形（左上を原点に）を k 倍して、元の位置の近くの空いている所へ
    const scaled = tg.points.map((p): Pt => [
      round9((p[0] - src.x0) * k),
      round9((p[1] - src.y0) * k),
    ]);
    const ps = place(scaled, t.grid, givenBoxes(t), [src.x0, src.y0]);
    return ps ? { kind: 'polygon', points: ps } : null;
  }
  return null;
}
