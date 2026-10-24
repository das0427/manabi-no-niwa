/**
 * 日本地図のデータと計算（純粋関数）。
 * 形は Natural Earth（パブリックドメイン）の admin-1 を scripts/map/build_japan_map.py で簡略化したもの（data/japan.json）。
 * 座標は 1度 = 縦60・横48 の単位（y は下向き）。沖縄県と奄美群島などは左上の囲み（inset）に移してある。
 */
import raw from './data/japan.json';

export type RegionId =
  'hokkaido' | 'tohoku' | 'kanto' | 'chubu' | 'kinki' | 'chugoku' | 'shikoku' | 'kyushu';

/** 八方位（北から時計回り） */
export type Dir8 = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
export const DIRS: readonly Dir8[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
export const DIR4: readonly Dir8[] = ['n', 'e', 's', 'w'];
export const DIR_NAME: Record<Dir8, string> = {
  n: '北《きた》',
  ne: '北東《ほくとう》',
  e: '東《ひがし》',
  se: '南東《なんとう》',
  s: '南《みなみ》',
  sw: '南西《なんせい》',
  w: '西《にし》',
  nw: '北西《ほくせい》',
};
/** 方位の角度（度。北が 0、時計回り） */
export const dirAngle = (d: Dir8) => DIRS.indexOf(d) * 45;
export const opposite = (d: Dir8): Dir8 => DIRS[(DIRS.indexOf(d) + 4) % 8]!;
/** 東西を入れ替えた方位（北東 ↔ 北西） */
export const mirrorEW = (d: Dir8): Dir8 => DIRS[(8 - DIRS.indexOf(d)) % 8]!;
export const isDir = (x: unknown): x is Dir8 => DIRS.includes(x as Dir8);

export interface RegionDef {
  id: RegionId;
  /** 地図の番号（色だけで区別しないための番号。1〜8） */
  no: number;
  name: string;
  /** 番号の札を置く都道府県（そのピンの位置） */
  anchor: number;
}
export const REGIONS: readonly RegionDef[] = [
  { id: 'hokkaido', no: 1, name: '北海道《ほっかいどう》地方《ちほう》', anchor: 1 },
  { id: 'tohoku', no: 2, name: '東北《とうほく》地方《ちほう》', anchor: 3 },
  { id: 'kanto', no: 3, name: '関東《かんとう》地方《ちほう》', anchor: 9 },
  { id: 'chubu', no: 4, name: '中部《ちゅうぶ》地方《ちほう》', anchor: 20 },
  { id: 'kinki', no: 5, name: '近畿《きんき》地方《ちほう》', anchor: 29 },
  { id: 'chugoku', no: 6, name: '中国《ちゅうごく》地方《ちほう》', anchor: 34 },
  { id: 'shikoku', no: 7, name: '四国《しこく》地方《ちほう》', anchor: 39 },
  { id: 'kyushu', no: 8, name: '九州《きゅうしゅう》地方《ちほう》', anchor: 43 },
];
export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<
  RegionId,
  RegionDef
>;
export const isRegion = (x: unknown): x is RegionId => typeof x === 'string' && x in REGION_BY_ID;

export type Pt = [number, number];
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Pref {
  code: number;
  /** 漢字の名前（例 静岡県） */
  name: string;
  /** 「県」などを除いた部分（例 静岡） */
  base: string;
  yomi: string;
  /** 都・道・府・県（北海道は ''） */
  suffix: string;
  suffixYomi: string;
  region: RegionId;
  /** ピンの位置（いちばん大きい島の内側） */
  label: Pt;
  rings: Pt[][];
  /** 囲み（沖縄など）の中の環か（rings と同じ順） */
  inInset: boolean[];
  /** いちばん大きい環の外接長方形（小ささの目安） */
  mainBox: Box;
  /** 囲みの外の環の外接長方形（地方の図の範囲に使う。囲みだけの県は囲みの範囲） */
  box: Box;
}

interface RawPref {
  code: number;
  name: string;
  base: string;
  yomi: string;
  suffix: string;
  suffixYomi: string;
  region: string;
  label: number[];
  rings: number[][];
}
const data = raw as { source: string; viewBox: number[]; inset: number[]; prefs: RawPref[] };

export const MAP_SOURCE = data.source;
export const JAPAN_BOX: Box = {
  x: data.viewBox[0]!,
  y: data.viewBox[1]!,
  w: data.viewBox[2]!,
  h: data.viewBox[3]!,
};
export const INSET_BOX: Box = {
  x: data.inset[0]!,
  y: data.inset[1]!,
  w: data.inset[2]!,
  h: data.inset[3]!,
};

function boxOf(pts: Pt[]): Box {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
const inBox = (p: Pt, b: Box) =>
  p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h;

function ringArea(r: Pt[]): number {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i]!;
    const q = r[(i + 1) % r.length]!;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}

export const PREFS: readonly Pref[] = data.prefs.map((p) => {
  const rings = p.rings.map((r) => {
    const out: Pt[] = [];
    for (let i = 0; i + 1 < r.length; i += 2) out.push([r[i]!, r[i + 1]!]);
    return out;
  });
  const inInset = rings.map((r) => r.every((q) => inBox(q, INSET_BOX)));
  const main = rings.reduce((a, b) => (ringArea(b) > ringArea(a) ? b : a));
  const outside = rings.filter((_, i) => !inInset[i]);
  return {
    code: p.code,
    name: p.name,
    base: p.base,
    yomi: p.yomi,
    suffix: p.suffix,
    suffixYomi: p.suffixYomi,
    region: p.region as RegionId,
    label: [p.label[0]!, p.label[1]!],
    rings,
    inInset,
    mainBox: boxOf(main),
    box: boxOf((outside.length ? outside : rings).flat()),
  };
});
export const PREF_BY_CODE = new Map(PREFS.map((p) => [p.code, p]));
export const isPrefCode = (x: unknown): x is number => typeof x === 'number' && PREF_BY_CODE.has(x);
export const prefsOfRegion = (r: RegionId): number[] =>
  PREFS.filter((p) => p.region === r).map((p) => p.code);

/** 名前の書き方: ruby = 漢字にふりがな、kana = ひらがなだけ、kanji = 漢字（よみは音声だけ。漢字を学ぶ問題） */
export type NameStyle = 'ruby' | 'kana' | 'kanji';

/** 都道府県の名前（RichText） */
export function prefName(code: number, style: NameStyle = 'ruby'): string {
  const p = PREF_BY_CODE.get(code);
  if (!p) return '';
  if (style === 'kana') return p.yomi + p.suffixYomi;
  const bang = style === 'kanji' ? '!' : '';
  const suffix = p.suffix ? `${p.suffix}《${bang}${p.suffixYomi}》` : '';
  return `${p.base}《${bang}${p.yomi}》${suffix}`;
}

/** 都道府県の SVG の path（偶奇規則で塗る） */
export function prefPath(p: Pref): string {
  return p.rings.map((r) => `M${r.map((q) => `${q[0]} ${q[1]}`).join('L')}Z`).join('');
}

/** 点が都道府県の内側か（偶奇規則） */
export function insidePref(p: Pref, x: number, y: number): boolean {
  let inside = false;
  for (const r of p.rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i]!;
      const [xj, yj] = r[j]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

function segDist(px: number, py: number, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

/** 都道府県の輪郭までの距離（内側なら 0） */
export function distToPref(p: Pref, x: number, y: number): number {
  if (insidePref(p, x, y)) return 0;
  let d = Infinity;
  for (const r of p.rings)
    for (let i = 0; i < r.length; i++)
      d = Math.min(d, segDist(x, y, r[i]!, r[(i + 1) % r.length]!));
  return d;
}

/** 図の範囲（全国、または地方。地方は囲みの外の形の範囲に少し余白） */
export type MapView = 'japan' | RegionId;
export function viewBoxOf(view: MapView = 'japan'): Box {
  if (view === 'japan') return JAPAN_BOX;
  const ps = PREFS.filter((p) => p.region === view && !p.inInset.every(Boolean));
  const x0 = Math.min(...ps.map((p) => p.box.x));
  const y0 = Math.min(...ps.map((p) => p.box.y));
  const x1 = Math.max(...ps.map((p) => p.box.x + p.box.w));
  const y1 = Math.max(...ps.map((p) => p.box.y + p.box.h));
  // 小さい地方は広めに（となりの地方も少し見える）。正方形に近づける
  const size = Math.max(x1 - x0, y1 - y0, 160) * 1.15;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return { x: cx - size / 2, y: cy - size / 2, w: size, h: size };
}

/** 都道府県が図の範囲で見えるか（いちばん大きい島が範囲に入る） */
export function visibleIn(code: number, view: MapView = 'japan'): boolean {
  const p = PREF_BY_CODE.get(code);
  if (!p) return false;
  if (view === 'japan') return true;
  const vb = viewBoxOf(view);
  const b = p.mainBox;
  return b.x >= vb.x && b.y >= vb.y && b.x + b.w <= vb.x + vb.w && b.y + b.h <= vb.y + vb.h;
}

/** 図の大きさに比べて小さい（細い）都道府県（当たり判定に余裕を持たせる）: 短い辺が図の幅の 3.6% 未満 */
export function isSmallIn(p: Pref, vb: Box): boolean {
  return Math.min(p.mainBox.w, p.mainBox.h) < vb.w * 0.036;
}

/**
 * タップした点の都道府県。形の内側を優先するが、小さい都道府県は図の幅の 0.4〜1.2% までの近くも当たりにする
 * （となりの大きい県の内側でも、小さい県のすぐそばなら小さい県）。海の上は、図の幅の 2% までの近くの県。
 * 全国の図では東京・大阪・香川などは画面で 1u ほどしかないので、見つける問題は地方の図（view）を勧める。
 */
export function hitPref(x: number, y: number, view: MapView = 'japan'): number | null {
  const vb = viewBoxOf(view);
  // 余裕は小さいほど大きい（短い辺が基準に足りない分。図の幅の 0.4〜1.2%）
  const marginOf = (p: Pref) =>
    Math.max(
      vb.w * 0.004,
      Math.min(vb.w * 0.012, vb.w * 0.036 - Math.min(p.mainBox.w, p.mainBox.h)),
    );
  let small: { code: number; d: number } | null = null;
  let inside: number | null = null;
  let near: { code: number; d: number } | null = null;
  for (const p of PREFS) {
    const d = distToPref(p, x, y);
    if (d === 0 && inside === null) inside = p.code;
    if (isSmallIn(p, vb) && d <= marginOf(p) && (!small || d < small.d))
      small = { code: p.code, d };
    if (!near || d < near.d) near = { code: p.code, d };
  }
  if (small && (inside === null || !isSmallIn(PREF_BY_CODE.get(inside)!, vb) || small.d === 0))
    return small.code;
  if (inside !== null) return inside;
  if (near && near.d <= vb.w * 0.02) return near.code;
  return null;
}

/** となりの都道府県（陸の境界を共有する。簡略化で隣どうしの境界の頂点は同じ） */
const NEIGHBORS: Map<number, Set<number>> = (() => {
  const at = new Map<string, Set<number>>();
  for (const p of PREFS)
    for (const r of p.rings)
      for (const q of r) {
        const k = `${q[0]},${q[1]}`;
        const s = at.get(k) ?? new Set<number>();
        s.add(p.code);
        at.set(k, s);
      }
  const count = new Map<string, number>();
  for (const s of at.values()) {
    if (s.size < 2) continue;
    const cs = [...s];
    for (const a of cs)
      for (const b of cs) if (a < b) count.set(`${a}-${b}`, (count.get(`${a}-${b}`) ?? 0) + 1);
  }
  const out = new Map<number, Set<number>>(PREFS.map((p) => [p.code, new Set<number>()]));
  for (const [k, n] of count) {
    if (n < 2) continue;
    const [a, b] = k.split('-').map(Number) as [number, number];
    out.get(a)!.add(b);
    out.get(b)!.add(a);
  }
  return out;
})();
export const areNeighbors = (a: number, b: number) => NEIGHBORS.get(a)?.has(b) ?? false;
export const neighborsOf = (a: number) => [...(NEIGHBORS.get(a) ?? [])].sort((x, y) => x - y);

/** 点 a から見た点 b の向き（度。北が 0、時計回り。y は下向き） */
export function bearingDeg(a: Pt, b: Pt): number {
  const deg = (Math.atan2(b[0] - a[0], a[1] - b[1]) * 180) / Math.PI;
  return (deg + 360) % 360;
}
/** 角度に一番近い方位（points = 4 なら四方位）と、方位の境目までの角度 */
export function dirOf(deg: number, points: 4 | 8 = 8): { dir: Dir8; margin: number } {
  const step = 360 / points;
  const k = Math.round(deg / step) % points;
  const center = k * step;
  let off = Math.abs(deg - center);
  if (off > 180) off = 360 - off;
  const list = points === 8 ? DIRS : DIR4;
  return { dir: list[k]!, margin: step / 2 - off };
}

/** 都道府県 from から見た to の方位（ピンの位置で測る） */
export function prefBearing(from: number, to: number, points: 4 | 8 = 8) {
  const a = PREF_BY_CODE.get(from);
  const b = PREF_BY_CODE.get(to);
  if (!a || !b) return null;
  return dirOf(bearingDeg(a.label, b.label), points);
}
