/**
 * なぞりの判定「順序つき追跡」（純粋関数）。仕様: docs/architecture.md 6.3、設計レビュー1 の #1 #2。
 *
 * 座標はすべて 0〜1000 の正方形座標。お手本は画ごとの点列、入力は線（指を置いてから離すまで）ごとの点列。
 *
 * - 各画に進み位置 k（お手本の点の番号）を持つ。最初は 0。
 * - 線の始まりが「今の進み位置のお手本の点」から 1.5r 以内のときだけ、その線を追跡に使う。
 * - 線の点を（5単位ごとに補間して）順にたどり、各点で、お手本の k+1〜（弧長で 1.2r 先まで）のうち
 *   入力点から r 以内にある最も先の点まで k を進める。先読みを弧長 1.2r に限るので、
 *   曲線の内側を横切る近道や、ループの中心を通る線では、反対側の点が範囲外になって進まない。
 * - 完成は k が終点から弧長 r/2 以内に達したとき。完成した時点で、その線の残りは見ない。
 * - 1.5r より外にある点が 40% を超える線は使わない（塗りつぶし）。
 * - 使った部分の長さが、残りのお手本の長さの 5 倍を超える線も使わない（管の中での往復の塗りつぶし）。
 * - 長さ r/2 未満の線は無視する（点を打つだけ）。
 * - 複数の画は番号順。今の画だけを判定し、完成したら次の画へ進む。
 * - 線の列から何度でも再計算できる（「ひとつ もどす」は最後の線を除いて呼び直すだけ）。
 */

export type Pt = readonly [number, number];

/** 判定幅 r（正方形座標）。設定「ひろい・ふつう・せまい」 */
export const TOLERANCE_R = { wide: 90, normal: 65, narrow: 45 } as const;

/** 先読みの弧長（r の倍数） */
export const LOOKAHEAD_FACTOR = 1.2;
/** 線の始まりを許す距離（r の倍数） */
export const START_FACTOR = 1.5;
/** 「外」とみなす距離（r の倍数） */
export const OUTSIDE_FACTOR = 1.5;
/** 外の点の割合がこれを超える線は使わない */
export const OUTSIDE_LIMIT = 0.4;
/** この長さ（r の倍数）より短い線は無視する */
export const SHORT_FACTOR = 0.5;
/** 終点からこの弧長（r の倍数）以内に k が達したら完成 */
export const END_FACTOR = 0.5;
/** 使った部分の長さが、残りのお手本の長さのこの倍数を超える線は、なぐり書きとして使わない */
export const SCRIBBLE_RATIO = 5;
/** 入力の補間間隔 */
export const INPUT_STEP = 5;
/** お手本の点の間隔 */
export const GUIDE_STEP = 10;

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function polylineLength(pts: readonly Pt[]): number {
  let sum = 0;
  for (let i = 1; i < pts.length; i++) sum += dist(pts[i - 1]!, pts[i]!);
  return sum;
}

/** 隣り合う点の間隔が step 以下になるよう線分を補間する（元の点は残す） */
export function densify(pts: readonly Pt[], step: number): Pt[] {
  if (pts.length === 0) return [];
  const out: Pt[] = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const n = Math.max(1, Math.ceil(dist(a, b) / step));
    for (let j = 1; j <= n; j++) {
      out.push(j === n ? b : [a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n]);
    }
  }
  return out;
}

/** 弧長がほぼ等間隔（約 step）になるよう並べ直す。始点と終点は保つ */
export function resample(pts: readonly Pt[], step: number): Pt[] {
  const clean: Pt[] = [];
  for (const p of pts) {
    const last = clean[clean.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) clean.push(p);
  }
  if (clean.length <= 1) return clean.map((p) => [p[0], p[1]] as Pt);
  const cum = [0];
  for (let i = 1; i < clean.length; i++) cum.push(cum[i - 1]! + dist(clean[i - 1]!, clean[i]!));
  const total = cum[cum.length - 1]!;
  const n = Math.max(1, Math.round(total / step));
  const out: Pt[] = [];
  let j = 1;
  for (let i = 0; i <= n; i++) {
    const t = (total * i) / n;
    while (j < cum.length - 1 && cum[j]! < t) j++;
    const seg = cum[j]! - cum[j - 1]!;
    const u = seg === 0 ? 0 : (t - cum[j - 1]!) / seg;
    const a = clean[j - 1]!;
    const b = clean[j]!;
    out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
  }
  out[0] = [clean[0]![0], clean[0]![1]];
  out[out.length - 1] = [clean[clean.length - 1]![0], clean[clean.length - 1]![1]];
  return out;
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t =
    len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function distToPolyline(p: Pt, pts: readonly Pt[]): number {
  if (pts.length === 1) return dist(p, pts[0]!);
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const d = distToSegment(p, pts[i - 1]!, pts[i]!);
    if (d < best) best = d;
  }
  return best;
}

/** 判定に使う形に整えたお手本の1画 */
export interface PreparedStroke {
  /** 約 GUIDE_STEP ごとの点列 */
  pts: Pt[];
  /** 始点からの弧長（pts と同じ長さ） */
  arc: number[];
  total: number;
}

const prepared = new WeakMap<object, PreparedStroke[]>();

/** お手本（画ごとの点列）を判定用に整える。同じ配列なら結果を使い回す */
export function prepareGuide(guide: readonly (readonly Pt[])[]): PreparedStroke[] {
  const hit = prepared.get(guide);
  if (hit) return hit;
  const out = guide.map((s) => {
    const pts = resample(s, GUIDE_STEP);
    const arc = [0];
    for (let i = 1; i < pts.length; i++) arc.push(arc[i - 1]! + dist(pts[i - 1]!, pts[i]!));
    return { pts, arc, total: arc[arc.length - 1]! };
  });
  prepared.set(guide, out);
  return out;
}

/** 追跡に使われなかった理由。short は無視（誤答に数えない）、finished は完成後の線 */
export type UnusedReason = 'short' | 'far-start' | 'off-track' | 'finished';

export interface LineJudgement {
  used: boolean;
  reason: UnusedReason | null;
  /** この線を判定した画の番号（使われなかった線は、そのとき見ていた画） */
  stroke: number;
  /** 線の長さ（正方形座標） */
  length: number;
  /** 使われた線が、その画の始点（r 以内）から始まっていた */
  startedAtStart: boolean;
  /** この線で画が完成した */
  completedStroke: boolean;
}

export interface StrokeJudgement {
  /** 進み位置（お手本の点の番号） */
  k: number;
  /** k までの弧長 */
  arc: number;
  /** arc / 全長（0〜1） */
  progress: number;
  complete: boolean;
}

export interface TraceJudgement {
  strokes: StrokeJudgement[];
  lines: LineJudgement[];
  /** いま判定している画（全部完成なら strokes.length） */
  current: number;
  complete: boolean;
}

export function judge(
  lines: readonly (readonly Pt[])[],
  guide: readonly (readonly Pt[])[],
  r: number,
): TraceJudgement {
  const g = prepareGuide(guide);
  const strokes: StrokeJudgement[] = g.map(() => ({
    k: 0,
    arc: 0,
    progress: 0,
    complete: false,
  }));
  const results: LineJudgement[] = [];
  let s = 0;

  for (const line of lines) {
    const length = polylineLength(line);
    const none = (reason: UnusedReason): LineJudgement => ({
      used: false,
      reason,
      stroke: Math.min(s, g.length - 1),
      length,
      startedAtStart: false,
      completedStroke: false,
    });
    if (length < r * SHORT_FACTOR || line.length === 0) {
      results.push(none('short'));
      continue;
    }
    if (s >= g.length) {
      results.push(none('finished'));
      continue;
    }
    const gs = g[s]!;
    const st = strokes[s]!;
    const pts = densify(line, INPUT_STEP);
    // 「止まった所」= 進み位置 k。k は指の先 r ほど先を指すので、k の手前（弧長 r まで）の点も含める
    let startsNear = false;
    for (let j = st.k; j >= 0 && gs.arc[st.k]! - gs.arc[j]! <= r; j--) {
      if (dist(pts[0]!, gs.pts[j]!) <= START_FACTOR * r) {
        startsNear = true;
        break;
      }
    }
    if (!startsNear) {
      results.push(none('far-start'));
      continue;
    }

    // 順序つき追跡
    let k = st.k;
    let last = pts.length - 1;
    let done = false;
    const reach = LOOKAHEAD_FACTOR * r;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!;
      let best = k;
      for (let j = k + 1; j < gs.pts.length && gs.arc[j]! - gs.arc[k]! <= reach; j++) {
        if (dist(p, gs.pts[j]!) <= r) best = j;
      }
      k = best;
      if (gs.total - gs.arc[k]! <= END_FACTOR * r) {
        done = true;
        last = i;
        break;
      }
    }

    // 塗りつぶし: 1.5r より外の点が多い線は使わない（完成した場合は完成までの部分で数える）
    let outside = 0;
    for (let i = 0; i <= last; i++) {
      if (distToPolyline(pts[i]!, gs.pts) > OUTSIDE_FACTOR * r) outside++;
    }
    if (outside / (last + 1) > OUTSIDE_LIMIT) {
      results.push(none('off-track'));
      continue;
    }
    // なぐり書き: 使った部分の長さが、残りのお手本の長さの SCRIBBLE_RATIO 倍を超える線は使わない
    // （管の中を左右に往復しながら進む塗りつぶし。ふつうになぞった線は 1〜2 倍）
    const traveled = polylineLength(pts.slice(0, last + 1));
    if (traveled > SCRIBBLE_RATIO * Math.max(gs.total - gs.arc[st.k]!, 2 * r)) {
      results.push(none('off-track'));
      continue;
    }

    const startedAtStart = st.k === 0 && dist(pts[0]!, gs.pts[0]!) <= r;
    st.k = k;
    st.arc = gs.arc[k]!;
    st.progress = gs.total === 0 ? 1 : st.arc / gs.total;
    results.push({
      used: true,
      reason: null,
      stroke: s,
      length,
      startedAtStart,
      completedStroke: done,
    });
    if (done) {
      st.complete = true;
      st.progress = 1;
      s++;
    }
  }

  return { strokes, lines: results, current: s, complete: s >= g.length };
}

/** 追跡に使えなかった線の本数（誤答の数え方: 3本で1回。short と完成後は数えない） */
export function countUnused(j: TraceJudgement): number {
  return j.lines.filter((l) => l.reason === 'far-start' || l.reason === 'off-track').length;
}

/** 極端に短い線が続いた最大の本数（5本以上で operationIssue） */
export function maxShortRun(j: TraceJudgement): number {
  let best = 0;
  let run = 0;
  for (const l of j.lines) {
    run = l.reason === 'short' ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}
