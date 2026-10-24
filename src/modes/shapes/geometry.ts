/**
 * かたち・パズルの図形と判定（純粋関数）。仕様: docs/architecture.md 6.4、learning-design.md 4章。
 *
 * - 盤面は 100 × 100 の座標（y は下向き）。長さの単位は「盤面の単位」。
 * - 図形は中心が (0, 0) の局所座標で定義し、rot（度。時計回り）で回して (x, y) に置く。
 *   回転の中心は外接する四角形（バウンディングボックス）の中心。ほしだけは外接円の中心。
 * - size は rot = 0 のときの横幅。縦横の比は図形ごとに決まっている（BASE_RATIO）。
 */

export const SHAPES = [
  'circle',
  'square',
  'rect',
  'triangle',
  'rtriangle',
  'semicircle',
  'star',
  'heart',
] as const;
export type ShapeId = (typeof SHAPES)[number];

/** 子供に見える形の名前（音声 shape.name.* と同じ） */
export const SHAPE_LABEL: Record<ShapeId, string> = {
  circle: 'まる',
  square: 'しかく',
  rect: 'ながしかく',
  triangle: 'さんかく',
  rtriangle: 'しかくい かどの さんかく',
  semicircle: 'はんえん',
  star: 'ほし',
  heart: 'ハート',
};

/**
 * 回転対称の次数（その回転で自分に重なる回数）。まる=∞。
 * さんかく は二等辺（正三角形ではない）なので 1。ほし は 72° ごとに重なるが、
 * 90° 刻みの操作では 0° でしか重ならない。
 */
export const SYMMETRY: Record<ShapeId, number> = {
  circle: Infinity,
  square: 4,
  rect: 2,
  triangle: 1,
  rtriangle: 1,
  semicircle: 1,
  star: 5,
  heart: 1,
};

export const BOARD = 100;
/** 吸着の範囲: 盤面幅の 20% */
export const SNAP_RATIO = 0.2;
/** 距離が同じとみなす差: 盤面幅の 1% */
export const TIE_RATIO = 0.01;

export interface Point {
  x: number;
  y: number;
}
export interface Piece {
  shape: ShapeId;
  size: number;
  /** 度。時計回り。0 のときの向きは shapePath の定義（さんかく=頂点が上、はんえん=まるい方が上） */
  rot: number;
}
export interface Slot extends Piece, Point {}

const EPS = 1e-6;

export function normRot(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** rot = 0 のときの 幅 : 高さ（size に掛ける比） */
const BASE_RATIO: Record<ShapeId, readonly [number, number]> = {
  circle: [1, 1],
  square: [1, 1],
  rect: [1, 0.5],
  triangle: [1, 0.9],
  rtriangle: [1, 1],
  semicircle: [1, 0.5],
  star: [1, 0.951],
  heart: [1, 0.9],
};

/** 向きを考えた外接四角形の大きさ */
export function dims(shape: ShapeId, size: number, rot = 0): { w: number; h: number } {
  const [a, b] = BASE_RATIO[shape];
  const w = a * size;
  const h = b * size;
  const t = (normRot(rot) * Math.PI) / 180;
  const c = Math.abs(Math.cos(t));
  const s = Math.abs(Math.sin(t));
  return { w: Math.round((w * c + h * s) * 1e6) / 1e6, h: Math.round((w * s + h * c) * 1e6) / 1e6 };
}

// ---------------------------------------------------------------- 形の輪郭

const pt = (x: number, y: number): Point => ({ x, y });

/** ハートの外形（size = 1 のときの 3 次ベジェ。始点, [制御点1, 制御点2, 終点] ...） */
const HEART_START = pt(0, 0.45);
const HEART_CURVES: readonly (readonly [Point, Point, Point])[] = [
  [pt(-0.2, 0.28), pt(-0.5, 0.08), pt(-0.5, -0.17)],
  [pt(-0.5, -0.36), pt(-0.36, -0.45), pt(-0.24, -0.45)],
  [pt(-0.12, -0.45), pt(-0.03, -0.38), pt(0, -0.27)],
  [pt(0.03, -0.38), pt(0.12, -0.45), pt(0.24, -0.45)],
  [pt(0.36, -0.45), pt(0.5, -0.36), pt(0.5, -0.17)],
  [pt(0.5, 0.08), pt(0.2, 0.28), pt(0, 0.45)],
];

function starPoints(size: number): Point[] {
  const R = size / (2 * Math.sin((72 * Math.PI) / 180));
  const r = R * 0.42;
  const out: Point[] = [];
  for (let k = 0; k < 10; k++) {
    const a = (-90 + k * 36) * (Math.PI / 180);
    const rad = k % 2 === 0 ? R : r;
    out.push(pt(rad * Math.cos(a), rad * Math.sin(a)));
  }
  return out;
}

/** 局所座標（rot = 0）の輪郭を折れ線で近似する（判定・重なりの検査用） */
function localPolygon(shape: ShapeId, size: number): Point[] {
  const s = size;
  switch (shape) {
    case 'circle': {
      const out: Point[] = [];
      for (let k = 0; k < 64; k++) {
        const a = (k / 64) * Math.PI * 2;
        out.push(pt((s / 2) * Math.cos(a), (s / 2) * Math.sin(a)));
      }
      return out;
    }
    case 'square':
      return [pt(-s / 2, -s / 2), pt(s / 2, -s / 2), pt(s / 2, s / 2), pt(-s / 2, s / 2)];
    case 'rect':
      return [pt(-s / 2, -s / 4), pt(s / 2, -s / 4), pt(s / 2, s / 4), pt(-s / 2, s / 4)];
    case 'triangle':
      return [pt(0, -0.45 * s), pt(s / 2, 0.45 * s), pt(-s / 2, 0.45 * s)];
    case 'rtriangle':
      return [pt(-s / 2, -s / 2), pt(s / 2, s / 2), pt(-s / 2, s / 2)];
    case 'semicircle': {
      const r = s / 2;
      const out: Point[] = [];
      for (let k = 0; k <= 32; k++) {
        const a = Math.PI + (k / 32) * Math.PI;
        out.push(pt(r * Math.cos(a), s / 4 + r * Math.sin(a)));
      }
      return out;
    }
    case 'star':
      return starPoints(s);
    case 'heart': {
      const out: Point[] = [pt(HEART_START.x * s, HEART_START.y * s)];
      let p0 = HEART_START;
      for (const [c1, c2, p1] of HEART_CURVES) {
        for (let k = 1; k <= 12; k++) {
          const t = k / 12;
          const u = 1 - t;
          const x =
            u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x;
          const y =
            u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y;
          out.push(pt(x * s, y * s));
        }
        p0 = p1;
      }
      return out;
    }
  }
}

const f = (n: number) => Math.round(n * 1000) / 1000;
const poly = (pts: readonly Point[]) => `M${pts.map((p) => `${f(p.x)} ${f(p.y)}`).join(' L')} Z`;

/** SVG の path（局所座標・rot = 0）。表示では transform="translate(x y) rotate(rot)" を付ける */
export function shapePath(shape: ShapeId, size: number): string {
  const s = size;
  switch (shape) {
    case 'circle': {
      const r = s / 2;
      return `M${f(-r)} 0 A${f(r)} ${f(r)} 0 1 0 ${f(r)} 0 A${f(r)} ${f(r)} 0 1 0 ${f(-r)} 0 Z`;
    }
    case 'semicircle': {
      const r = s / 2;
      return `M${f(-r)} ${f(s / 4)} A${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(s / 4)} Z`;
    }
    case 'heart': {
      const sc = (p: Point) => `${f(p.x * s)} ${f(p.y * s)}`;
      const parts = HEART_CURVES.map(([c1, c2, p1]) => `C${sc(c1)} ${sc(c2)} ${sc(p1)}`);
      return `M${sc(HEART_START)} ${parts.join(' ')} Z`;
    }
    default:
      return poly(localPolygon(shape, size));
  }
}

/** 盤面座標での輪郭（折れ線） */
export function outline(shape: ShapeId, size: number, rot: number, x: number, y: number): Point[] {
  const t = (normRot(rot) * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return localPolygon(shape, size).map((p) => pt(x + p.x * c - p.y * s, y + p.x * s + p.y * c));
}

export function pointInPolygon(p: Point, poly_: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly_.length - 1; i < poly_.length; j = i++) {
    const a = poly_[i]!;
    const b = poly_[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** 2つの置き場所が重なる面積の目安（0.5 刻みの格子で数える）。接しているだけなら 0 付近 */
export function overlapArea(a: Slot, b: Slot): number {
  const pa = outline(a.shape, a.size, a.rot, a.x, a.y);
  const pb = outline(b.shape, b.size, b.rot, b.x, b.y);
  const da = dims(a.shape, a.size, a.rot);
  const db = dims(b.shape, b.size, b.rot);
  const x0 = Math.max(a.x - da.w / 2, b.x - db.w / 2);
  const x1 = Math.min(a.x + da.w / 2, b.x + db.w / 2);
  const y0 = Math.max(a.y - da.h / 2, b.y - db.h / 2);
  const y1 = Math.min(a.y + da.h / 2, b.y + db.h / 2);
  if (x1 <= x0 || y1 <= y0) return 0;
  const step = 0.5;
  let n = 0;
  for (let x = x0 + step / 2; x < x1; x += step) {
    for (let y = y0 + step / 2; y < y1; y += step) {
      const p = pt(x, y);
      if (pointInPolygon(p, pa) && pointInPolygon(p, pb)) n++;
    }
  }
  return n * step * step;
}

// ---------------------------------------------------------------- 一致の判定

export function symmetryOrder(shape: ShapeId): number {
  return SYMMETRY[shape];
}

/** 形と大きさが同じ（向きは問わない） */
export function sameKind(
  a: Pick<Piece, 'shape' | 'size'>,
  b: Pick<Piece, 'shape' | 'size'>,
): boolean {
  return a.shape === b.shape && Math.abs(a.size - b.size) < EPS;
}

/**
 * ピースが置き場所に入るか: 形と大きさが同じで、(piece.rot - slot.rot) mod 360 が
 * 回転対称の角度（360 / 次数）の倍数（M4-05）。まる は向きを問わない。
 */
export function matches(piece: Piece, slot: Piece): boolean {
  if (!sameKind(piece, slot)) return false;
  const order = SYMMETRY[piece.shape];
  if (!Number.isFinite(order)) return true;
  const step = 360 / order;
  const diff = normRot(piece.rot - slot.rot);
  const k = Math.round(diff / step);
  return Math.abs(diff - k * step) < 1e-4;
}

/**
 * 時計回りに 90° ずつ回して置き場所に入るまでの回数（0〜3）。入らない（形が違う・90° 刻みでは届かない）なら null。
 */
export function turnsToMatch(piece: Piece, slot: Piece): number | null {
  if (!sameKind(piece, slot)) return null;
  for (let t = 0; t < 4; t++) {
    if (matches({ ...piece, rot: piece.rot + 90 * t }, slot)) return t;
  }
  return null;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** 条件に合う空きスロットのうち最も近いもの。差が tie 未満なら番号の小さい方 */
function nearest(
  tap: Point,
  slots: readonly Slot[],
  filled: ReadonlySet<number>,
  boardSize: number,
  accept: (slot: Slot) => boolean,
): number | null {
  const radius = boardSize * SNAP_RATIO;
  const tie = boardSize * TIE_RATIO;
  const cands: { i: number; d: number }[] = [];
  slots.forEach((slot, i) => {
    if (filled.has(i) || !accept(slot)) return;
    const d = dist(tap, slot);
    if (d <= radius + EPS) cands.push({ i, d });
  });
  if (cands.length === 0) return null;
  const best = Math.min(...cands.map((c) => c.d));
  return Math.min(...cands.filter((c) => c.d - best < tie - EPS).map((c) => c.i));
}

/**
 * 吸着: タップ位置から中心までの距離が盤面幅の 20% 以内の空きスロットのうち、
 * ピースと一致するもの（matches）で最も近いもの。距離の差が 1% 未満なら番号の小さい方。
 * 同じ形・大きさ・向きのピースはどのスロットにも入れられる（スロット側だけで決まる）。
 */
export function snapTarget(
  tap: Point,
  piece: Piece,
  slots: readonly Slot[],
  filled: ReadonlySet<number>,
  boardSize = BOARD,
): number | null {
  return nearest(tap, slots, filled, boardSize, (slot) => matches(piece, slot));
}

/** 形に関係なく、盤面幅の 20% 以内にある最も近い空きスロット（「合わない場所に置こうとした」の判定用） */
export function nearSlot(
  tap: Point,
  slots: readonly Slot[],
  filled: ReadonlySet<number>,
  boardSize = BOARD,
): number | null {
  return nearest(tap, slots, filled, boardSize, () => true);
}

/** タップ位置を輪郭の内側に含む空きスロット（重なるときは中心が近い方） */
export function slotAt(
  tap: Point,
  slots: readonly Slot[],
  filled: ReadonlySet<number>,
): number | null {
  let best: { i: number; d: number } | null = null;
  slots.forEach((slot, i) => {
    if (filled.has(i)) return;
    if (!pointInPolygon(tap, outline(slot.shape, slot.size, slot.rot, slot.x, slot.y))) return;
    const d = dist(tap, slot);
    if (best === null || d < best.d) best = { i, d };
  });
  return best === null ? null : (best as { i: number; d: number }).i;
}

/**
 * ピースの集まりをスロットに割り当てる（向きは回して合わせてよいとき strict = false）。
 * 戻り値は スロット番号 → ピース番号。割り当てられなければ null。
 * strict = true は「いまの向きのまま入る」割り当て。
 */
export function assign(
  pieces: readonly Piece[],
  slots: readonly Slot[],
  strict: boolean,
): number[] | null {
  const used = new Set<number>();
  const result: number[] = [];
  const ok = (p: Piece, s: Slot) => (strict ? matches(p, s) : turnsToMatch(p, s) !== null);
  const go = (i: number): boolean => {
    if (i === slots.length) return true;
    for (let j = 0; j < pieces.length; j++) {
      if (used.has(j) || !ok(pieces[j]!, slots[i]!)) continue;
      used.add(j);
      result[i] = j;
      if (go(i + 1)) return true;
      used.delete(j);
    }
    return false;
  };
  return go(0) ? result : null;
}
