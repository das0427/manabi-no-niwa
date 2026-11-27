/**
 * 三角形の 角の 大きさの 字（「45°」）の 置き場（g5.math.congruence の 図）。
 *
 * 図の 字は、画面で 最小（1.8u）まで 引き上げられる（Figure の liftSvgText）。この 図は 1 単位が 0.9px ほどで 描かれるので、
 * 宣言の 12 は 24〜26 単位に なる（実測 24.4）。細い 三角形（6 × 2 ますなど）では 角の 字どうしが 重なった
 * （45°と108°、63°と90°、90°と53°。text-layout-fixes.md 第6回）。
 * 引き上げられた 大きさで 字の 箱を 見積もり、頂点の 名前と ほかの 角の 字に ぶつからない 置き場を、
 * 3 つ いっしょに さがす（頂点に 近く、内角の 二等分線の 近く、三角形の 中に 入り、辺を またがない ほど よい）。
 */
type P = [number, number];

/** 画面で 引き上げられた 字の 大きさの 見込み（viewBox の 単位）。実測は 24.4（図の 拡大が 0.91 のとき）。26 まで 見ておく */
export const LIFTED_SIZE = 26;

interface Box {
  l: number;
  r: number;
  t: number;
  b: number;
}

/**
 * 字の 箱。高さは 字の 大きさ。検査は 字の 外接の 箱（高さ 約 1.44 倍）が 縦に 3 割より 多く 重なると 出すので、
 * 縦に 離すなら 中心の 間を 字の 大きさ ＋ すき間 以上に する。幅は 字の 種類ごとの 見積もり（数字 0.52・° 0.68・英字 0.68・ほか 1）
 */
function boxOf([x, y]: P, text: string, size: number): Box {
  let w = 0;
  for (const c of text) w += /\d/.test(c) ? 0.52 : c === '°' ? 0.68 : /[A-Za-z]/.test(c) ? 0.68 : 1;
  return { l: x - (w * size) / 2, r: x + (w * size) / 2, t: y - size / 2, b: y + size / 2 };
}

/** 2 つの 箱の すき間（重なっていれば 負） */
function gapOf(a: Box, b: Box): number {
  return Math.max(Math.max(a.l, b.l) - Math.min(a.r, b.r), Math.max(a.t, b.t) - Math.min(a.b, b.b));
}

/** 線分 pq が 箱と まじわるか */
function segmentHits(p: P, q: P, b: Box): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const sides: [number, number][] = [
    [-dx, p[0] - b.l],
    [dx, b.r - p[0]],
    [-dy, p[1] - b.t],
    [dy, b.b - p[1]],
  ];
  for (const [k, v] of sides) {
    if (k === 0) {
      if (v < 0) return false;
      continue;
    }
    const r = v / k;
    if (k < 0) {
      if (r > t1) return false;
      t0 = Math.max(t0, r);
    } else {
      if (r < t0) return false;
      t1 = Math.min(t1, r);
    }
  }
  return true;
}

function insideTriangle([px, py]: P, tri: P[]): boolean {
  const side = (a: P, b: P) => (px - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (py - b[1]);
  const [a, b, c] = tri as [P, P, P];
  const s = [side(a, b), side(b, c), side(c, a)];
  return !(s.some((v) => v < 0) && s.some((v) => v > 0));
}

interface Cand {
  at: P;
  box: Box;
  cost: number;
}

/** 箱どうしの すき間の 下限（画面で 字が くっつかない） */
const MIN_GAP = 1;
/** 図の 高さ（viewBox の 縦）。これを 出ると viewBox が 広がり、図が 縮んで 字が 大きく なる */
const FIG_H = 190;
/** 左の 三角形（角の 字を 置く ほう）の 右の はし。右の 三角形は x = 210 から かく（congruence.ts の pairFig） */
const LEFT_MAX_X = 204;

/**
 * tri: 三角形の 頂点（図の 座標）、nameAt: 頂点の 名前の 位置、names: 名前、labels: 角の 字（空なら 置かない）。
 * 戻り値: 角の 字の 中心（text-anchor: middle・dominant-baseline: middle の 位置）。
 */
export function placeAngleLabels(
  tri: P[],
  nameAt: P[],
  names: string[],
  labels: string[],
  size = LIFTED_SIZE,
): (P | null)[] {
  const taken = nameAt.map((p, i) => boxOf(p, names[i] ?? '', size));
  const lists: Cand[][] = tri.map((v, i) => {
    const text = labels[i];
    if (!text) return [];
    const p = tri[(i + 1) % 3]!;
    const q = tri[(i + 2) % 3]!;
    const n1 = Math.hypot(p[0] - v[0], p[1] - v[1]);
    const n2 = Math.hypot(q[0] - v[0], q[1] - v[1]);
    // 内角の 二等分線の 向き
    const base = Math.atan2(
      (p[1] - v[1]) / n1 + (q[1] - v[1]) / n2,
      (p[0] - v[0]) / n1 + (q[0] - v[0]) / n2,
    );
    const out: Cand[] = [];
    for (let d = 14; d <= 60; d += 2) {
      for (let off = -80; off <= 80; off += 10) {
        const a = base + (off * Math.PI) / 180;
        const at: P = [v[0] + Math.cos(a) * d, v[1] + Math.sin(a) * d];
        const box = boxOf(at, text, size);
        if (box.t < 0 || box.b > FIG_H || box.l < 0 || box.r > LEFT_MAX_X) continue;
        if (!taken.every((o) => gapOf(box, o) >= MIN_GAP)) continue;
        const hits = [0, 1, 2].filter((k) => segmentHits(tri[k]!, tri[(k + 1) % 3]!, box)).length;
        const cost = d + Math.abs(off) * 0.25 + (insideTriangle(at, tri) ? 0 : 25) + hits * 8;
        out.push({ at, box, cost });
      }
    }
    return out.sort((x, y) => x.cost - y.cost).slice(0, 80);
  });
  // 3 つ いっしょに 費用が 最小の 組を さがす（置く 字が 無い 頂点は 飛ばす）
  const pick: (Cand | null)[] = [null, null, null];
  let best = Infinity;
  const walk = (i: number, chosen: (Cand | null)[], cost: number) => {
    if (cost >= best) return;
    if (i === 3) {
      best = cost;
      pick.splice(0, 3, ...chosen);
      return;
    }
    if (!labels[i]) return walk(i + 1, [...chosen, null], cost);
    for (const c of lists[i]!) {
      if (chosen.some((o) => o && gapOf(o.box, c.box) < MIN_GAP)) continue;
      walk(i + 1, [...chosen, c], cost + c.cost);
    }
  };
  walk(0, [], 0);
  if (best < Infinity) return pick.map((c) => c?.at ?? null);
  // 見つからないとき（図の 形が 想定外）: 重心の 反対側へ 24（これまでの 置き方）
  const cx = (tri[0]![0] + tri[1]![0] + tri[2]![0]) / 3;
  const cy = (tri[0]![1] + tri[1]![1] + tri[2]![1]) / 3;
  return tri.map((v, i) => {
    if (!labels[i]) return null;
    const d = Math.hypot(v[0] - cx, v[1] - cy) || 1;
    return [v[0] - ((v[0] - cx) / d) * 24, v[1] - ((v[1] - cy) / d) * 24];
  });
}
