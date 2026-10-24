/**
 * g6.math.symmetry 線対称・点対称（curriculum-matrix 3.9）。
 * 折って重なる形・回して重なる形を見分ける → 対応する点・辺 → 作図・多角形の対称。
 *
 * 形の対称は、問題を作るときに symInfo で計算して確かめる（見本の形の分類の誤りを防ぐ）。
 * 同一性キー: 形の頂点と問いの組。向き・位置は対称の学習内容なので、作図は 形 × 軸（中心）で別に数える。
 */
import type { Rng } from '../../core/util/rng';
import type { ChoiceItem, GeometryItem, Item, UnitSpec } from '../../curriculum/types';
import { finishUnit, opts, pick, pickObj, r1, REVISED, STROKE, svg, svgText } from './util';

type Obj = 'judge' | 'corr' | 'drawL' | 'drawP' | 'poly';
type Pt = [number, number];

// ---- 対称の計算 ----
const EPS = 1e-6;
const samePt = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;
const hasAll = (ps: Pt[], qs: Pt[]) => qs.every((p) => ps.some((x) => samePt(x, p)));

function reflect(p: Pt, a: Pt, b: Pt): Pt {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  const fx = a[0] + t * dx;
  const fy = a[1] + t * dy;
  return [2 * fx - p[0], 2 * fy - p[1]];
}

/** 線対称の軸の数・点対称か（頂点の集合で調べる。軸は重心と頂点・辺の中点を通る） */
export function symInfo(ps: Pt[]): { axes: number; point: boolean } {
  const n = ps.length;
  const c: Pt = [ps.reduce((s, p) => s + p[0], 0) / n, ps.reduce((s, p) => s + p[1], 0) / n];
  const cands: Pt[] = [...ps, ...ps.map((p, i) => [(p[0] + ps[(i + 1) % n]![0]) / 2, (p[1] + ps[(i + 1) % n]![1]) / 2] as Pt)];
  const dirs: number[] = [];
  for (const q of cands) {
    if (samePt(q, c)) continue;
    const ang = (((Math.atan2(q[1] - c[1], q[0] - c[0]) * 180) / Math.PI) % 180 + 180) % 180;
    if (dirs.some((d) => Math.abs(d - ang) < 1e-4 || Math.abs(Math.abs(d - ang) - 180) < 1e-4)) continue;
    const img = ps.map((p) => reflect(p, c, q));
    // 辺のつながりも保つ（頂点の順が逆向きに対応する）
    if (hasAll(ps, img) && edgesKept(ps, img)) dirs.push(ang);
  }
  const rot = ps.map((p) => [2 * c[0] - p[0], 2 * c[1] - p[1]] as Pt);
  return { axes: dirs.length, point: hasAll(ps, rot) && edgesKept(ps, rot) };
}
/** 写した頂点の列が、もとの多角形の辺を辺に写すか */
function edgesKept(ps: Pt[], img: Pt[]): boolean {
  const n = ps.length;
  const idx = img.map((p) => ps.findIndex((x) => samePt(x, p)));
  for (let i = 0; i < n; i++) {
    const a = idx[i]!;
    const b = idx[(i + 1) % n]!;
    if (!((a + 1) % n === b || (b + 1) % n === a)) return false;
  }
  return true;
}

// ---- 見分ける形（格子の上の多角形） ----
type SymKind = 'line' | 'point' | 'both' | 'none';
interface Shape {
  key: string;
  pts: Pt[];
  kind: SymKind;
}
function shapesOf(kind: SymKind, list: [string, Pt[]][]): Shape[] {
  const out: Shape[] = [];
  for (const [key, pts] of list) {
    const s = symInfo(pts);
    const k: SymKind = s.axes > 0 && s.point ? 'both' : s.axes > 0 ? 'line' : s.point ? 'point' : 'none';
    // 計算で確かめた分類と合うものだけ使う
    if (k === kind) out.push({ key, pts, kind });
  }
  return out;
}
const LINE_SHAPES: Shape[] = shapesOf('line', [
  ...[2, 4, 6].flatMap((w) =>
    [2, 3, 4].map((h) => [`iso${w}x${h}`, [[0, h], [w / 2, 0], [w, h]]] as [string, Pt[]]),
  ),
  ...[1, 2].flatMap((k) =>
    [3, 4, 5].map((h) => [`kite${k}x${h}`, [[k, 0], [2 * k, k], [k, h], [0, k]]] as [string, Pt[]]),
  ),
  ...[4, 5, 6].flatMap((w) =>
    [2, 3].map((h) => [`itrap${w}x${h}`, [[1, 0], [w - 1, 0], [w, h], [0, h]]] as [string, Pt[]]),
  ),
  ...[4, 6].flatMap((w) =>
    [1, 2].map((k) => [`house${w}x${k}`, [[0, k], [w / 2, 0], [w, k], [w, k + 2], [0, k + 2]]] as [string, Pt[]]),
  ),
]);
const POINT_SHAPES: Shape[] = shapesOf('point', [
  ...[1, 2].flatMap((a) =>
    [3, 4].flatMap((w) =>
      [2, 3].map((h) => [`para${a}-${w}x${h}`, [[0, h], [a, 0], [a + w, 0], [w, h]]] as [string, Pt[]]),
    ),
  ),
  ...[
    [3, 2, 2],
    [2, 1, 3],
    [3, 1, 2],
    [2, 2, 3],
    [1, 2, 3],
  ].map(
    ([p, r, t]) =>
      [`shex${p}${r}${t}`, [[0, 0], [p!, 0], [p! + r!, r!], [p! + r!, r! + t!], [r!, r! + t!], [0, t!]]] as [string, Pt[]],
  ),
]);
const BOTH_SHAPES: Shape[] = shapesOf('both', [
  ...[
    [3, 2],
    [4, 2],
    [5, 3],
    [2, 4],
  ].map(([w, h]) => [`rect${w}x${h}`, [[0, 0], [w!, 0], [w!, h!], [0, h!]]] as [string, Pt[]]),
  ...[
    [1, 2],
    [2, 3],
    [2, 1],
    [3, 2],
  ].map(([k, m]) => [`rhom${k}x${m}`, [[k!, 0], [2 * k!, m!], [k!, 2 * m!], [0, m!]]] as [string, Pt[]]),
  ...[2, 3].map((w) => [`sq${w}`, [[0, 0], [w, 0], [w, w], [0, w]]] as [string, Pt[]]),
]);
const NONE_SHAPES: Shape[] = shapesOf('none', [
  ...[
    [3, 2],
    [4, 3],
    [2, 4],
  ].map(([w, h]) => [`rtri${w}x${h}`, [[0, 0], [0, h!], [w!, h!]]] as [string, Pt[]]),
  ...[
    [4, 1, 3],
    [5, 4, 3],
    [5, 1, 2],
  ].map(([w, a, h]) => [`stri${w}-${a}x${h}`, [[0, h!], [w!, h!], [a!, 0]]] as [string, Pt[]]),
  ...[
    [2, 4, 3],
    [3, 5, 2],
  ].map(([a, w, h]) => [`rtrap${a}-${w}x${h}`, [[0, 0], [a!, 0], [w!, h!], [0, h!]]] as [string, Pt[]]),
  ['quad1', [[0, 0], [4, 1], [3, 4], [1, 3]]],
  ['quad2', [[0, 1], [3, 0], [5, 3], [1, 4]]],
]);

function judgeItem(level: number, rng: Rng, alt: boolean): GeometryItem {
  const ask: 'line' | 'point' | 'both' = alt ? 'both' : rng.next() < 0.5 ? 'line' : 'point';
  const correctPool =
    ask === 'line' ? [...LINE_SHAPES, ...BOTH_SHAPES] : ask === 'point' ? [...POINT_SHAPES, ...BOTH_SHAPES] : BOTH_SHAPES;
  const correct = pick(rng, correctPool);
  const wrongs: { s: Shape; m: string }[] =
    ask === 'line'
      ? [
          { s: pick(rng, POINT_SHAPES), m: 'line-vs-point' },
          { s: pick(rng, NONE_SHAPES), m: 'looks-sym' },
          { s: pick(rng, rng.next() < 0.5 ? POINT_SHAPES : NONE_SHAPES), m: 'looks-sym' },
        ]
      : ask === 'point'
        ? [
            { s: pick(rng, LINE_SHAPES), m: 'line-vs-point' },
            { s: pick(rng, NONE_SHAPES), m: 'looks-sym' },
            { s: pick(rng, rng.next() < 0.5 ? LINE_SHAPES : NONE_SHAPES), m: 'looks-sym' },
          ]
        : [
            { s: pick(rng, LINE_SHAPES), m: 'line-vs-point' },
            { s: pick(rng, POINT_SHAPES), m: 'line-vs-point' },
            { s: pick(rng, NONE_SHAPES), m: 'looks-sym' },
          ];
  const uniq = wrongs.filter((w, i) => wrongs.findIndex((x) => x.s.key === w.s.key) === i);
  for (const w of uniq) if (w.s.kind === 'line' || w.s.kind === 'point') w.m = 'line-vs-point';
  const name = ask === 'line' ? '線対称な 形' : ask === 'point' ? '点対称な 形' : '線対称でも あり、点対称でも ある 形';
  return {
    engine: 'geometry',
    id: `judge${alt ? '-alt' : ''}:${ask}:${correct.key}:${uniq.map((w) => w.s.key).join(',')}`,
    objective: 'judge',
    level,
    prompt: `${name}を 1つ 選ぼう。`,
    hints: [
      ask === 'point'
        ? 'ある 点を 中心に 半回転《はんかいてん》（180度）回して、もとの 形に ぴったり 重なるかな。'
        : '1本の 直線で 折って、両側が ぴったり 重なるかな。',
      ask === 'both'
        ? '折って 重なるか、半回転《はんかいてん》して 重なるか、2つとも 調べよう。'
        : ask === 'line'
          ? '真ん中に 折り目の 線を 引いて みよう。縦《たて》・横《よこ》・ななめも 調べよう。'
          : '形の 真ん中の 点を 見つけて、向かい合う 頂点を 結んで みよう。',
      ask === 'point'
        ? '向かい合う 頂点を 結んだ 線が、どれも 1つの 点で 半分に なる 形を 選ぼう。'
        : '辺の 長さや 角の 大きさが、折り目の 両側で 同じに なって いる 形を 選ぼう。',
    ],
    explain:
      ask === 'line'
        ? '選んだ 形は、1本の 直線で 折ると ぴったり 重なります。このような 形を 線対称な 形と いいます。'
        : ask === 'point'
          ? '選んだ 形は、真ん中の 点を 中心に 180度 回すと もとの 形に ぴったり 重なります。このような 形を 点対称な 形と いいます。'
          : '選んだ 形は、折っても 重なり、180度 回しても 重なります。',
    identity: `judge:${ask}:${correct.key}:${uniq
      .map((w) => w.s.key)
      .sort()
      .join(',')}`,
    alt,
    task: {
      kind: 'pick',
      options: [
        { shape: { points: correct.pts }, correct: true },
        ...uniq.map((w) => ({ shape: { points: w.s.pts }, misconception: w.m })),
      ],
    },
  };
}

// ---- 対応する点・辺（名前つきの形の図） ----
const NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
interface Named {
  pts: Pt[];
  kind: 'line' | 'point';
  /** 対応する頂点の番号 */
  partner: (i: number) => number;
  key: string;
  /** 対称の軸（line）・中心（point） */
  axis?: [Pt, Pt];
  center?: Pt;
}

function lineNamed(rng: Rng): Named {
  const c = 4;
  const k = rng.int(2, 3);
  const top = rng.next() < 0.5;
  const bottom = rng.next() < 0.5;
  const ys: number[] = [];
  const pool = [1, 2, 3, 4, 5];
  while (ys.length < k) {
    const y = pick(rng, pool);
    if (!ys.includes(y)) ys.push(y);
  }
  ys.sort((a, b) => a - b);
  const left: Pt[] = ys.map((y) => [rng.int(0, 3), y]);
  // 左の列が 一直線に ならないように（3点が 縦に 並ぶと 辺の 途中の 点に なる）
  if (k === 3 && left[0]![0] === left[1]![0] && left[1]![0] === left[2]![0]) left[1] = [left[1]![0] === 0 ? 1 : 0, left[1]![1]];
  const pts: Pt[] = [];
  if (top) pts.push([c, 0]);
  pts.push(...left);
  if (bottom) pts.push([c, 6]);
  pts.push(...left.slice().reverse().map(([x, y]) => [2 * c - x, y] as Pt));
  const n = pts.length;
  const partner = (i: number) => pts.findIndex((p) => samePt(p, [2 * c - pts[i]![0], pts[i]![1]]));
  void n;
  return { pts, kind: 'line', partner, key: pts.map((p) => p.join(',')).join(' '), axis: [[c, -0.6], [c, 6.6]] };
}

function pointNamed(rng: Rng): Named {
  const s = pick(rng, POINT_SHAPES);
  const n = s.pts.length;
  const xs = s.pts.map((p) => p[0]);
  const ys = s.pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return { pts: s.pts, kind: 'point', partner: (i) => (i + n / 2) % n, key: s.key, center: [cx, cy] };
}

function namedFig(nm: Named, label: string) {
  const U = 34;
  const xs = nm.pts.map((p) => p[0]);
  const ys = nm.pts.map((p) => p[1]);
  const minX = Math.min(...xs, nm.axis ? nm.axis[0][0] : Infinity);
  const minY = Math.min(...ys, nm.axis ? nm.axis[0][1] : Infinity);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys, nm.axis ? nm.axis[1][1] : -Infinity);
  const ox = 30 - minX * U;
  const oy = 30 - minY * U;
  const P = (p: Pt) => [r1(ox + p[0] * U), r1(oy + p[1] * U)] as const;
  const n = nm.pts.length;
  const cx = xs.reduce((a, b) => a + b, 0) / n;
  const cy = ys.reduce((a, b) => a + b, 0) / n;
  let body = `<polygon points="${nm.pts.map((p) => P(p).join(',')).join(' ')}" fill="var(--sky)" ${STROKE}/>`;
  if (nm.axis) {
    const [a, b] = nm.axis;
    body += `<line x1="${P(a)[0]}" y1="${P(a)[1]}" x2="${P(b)[0]}" y2="${P(b)[1]}" stroke="var(--ink)" stroke-width="2" stroke-dasharray="6 5"/>`;
  }
  if (nm.center) {
    const [x, y] = P(nm.center);
    body += `<circle cx="${x}" cy="${y}" r="4.5" fill="var(--ink)"/>` + svgText(x + 12, y - 10, 'O', 15);
  }
  nm.pts.forEach((p, i) => {
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    const len = Math.hypot(dx, dy) || 1;
    const [x, y] = P(p);
    body += svgText(x + (dx / len) * 16, y + (dy / len) * 16, NAMES[i]!, 17);
  });
  return svg(r1((maxX - minX) * U + 60), r1((maxY - minY) * U + 60), body, label);
}

function corrItem(level: number, rng: Rng, alt: boolean): ChoiceItem {
  const nm = rng.next() < 0.6 ? lineNamed(rng) : pointNamed(rng);
  const n = nm.pts.length;
  // 対応する点が自分でない頂点（軸の上の点は問わない）
  const askable = nm.pts
    .map((_, i) => i)
    .filter((i) => {
      if (nm.partner(i) === i) return false;
      if (!alt) return true;
      // 辺を問うときは、自分自身に対応する辺（軸をまたぐ辺）を除く
      const k = (i + 1) % n;
      return !(nm.partner(i) === k && nm.partner(k) === i);
    });
  const i = pick(rng, askable);
  const j = nm.partner(i);
  const nameOf = (k: number) => NAMES[k]!;
  const which = nm.kind === 'line' ? '線対称' : '点対称';
  const setup =
    nm.kind === 'line'
      ? `この 形は ${which}で、点線が 対称の 軸です。`
      : `この 形は ${which}で、点Oが 対称の 中心です。`;
  let correct: string;
  let wrongs: [string, string][];
  let asked: string;
  // ほかの 対称（線対称なら 点対称の 向かい側、点対称なら 折った 側）の 頂点
  const otherSym =
    nm.kind === 'line'
      ? (k: number) => (k + Math.floor(n / 2)) % n
      : (k: number) => {
          // 点対称の 形を 横に 折ったと 考えた 頂点（y が 同じで いちばん 遠い 点）
          const p = nm.pts[k]!;
          let best = -1;
          let bd = -1;
          nm.pts.forEach((q, t) => {
            if (t !== k && Math.abs(q[1] - p[1]) < EPS && Math.abs(q[0] - p[0]) > bd) {
              bd = Math.abs(q[0] - p[0]);
              best = t;
            }
          });
          return best >= 0 ? best : (k + 1) % n;
        };
  if (!alt) {
    asked = `点${nameOf(i)}`;
    correct = `点${nameOf(j)}`;
    const o = otherSym(i);
    wrongs = [
      [o !== j && o !== i ? `点${nameOf(o)}` : null, 'line-vs-point'],
      [`点${nameOf((j + 1) % n)}`, 'corr-adjacent'],
      [`点${nameOf((j + n - 1) % n)}`, 'corr-adjacent'],
    ].filter((w): w is [string, string] => w[0] !== null && w[0] !== `点${nameOf(i)}`);
  } else {
    // 辺 i(i+1) に 対応する 辺
    const i2 = (i + 1) % n;
    const j2 = nm.partner(i2);
    asked = `辺${nameOf(i)}${nameOf(i2)}`;
    correct = `辺${nameOf(j)}${nameOf(j2)}`;
    const side = (a: number) => `辺${nameOf(a)}${nameOf((a + 1) % n)}`;
    const same = (s: string) => {
      const t = s.slice(1);
      const mine = [nameOf(j) + nameOf(j2), nameOf(j2) + nameOf(j), nameOf(i) + nameOf(i2), nameOf(i2) + nameOf(i)];
      return mine.includes(t);
    };
    const lo = Math.min(j, j2);
    const hi = Math.max(j, j2);
    const start = hi - lo === 1 ? lo : hi; // 辺 j-j2 の 始まり（n-1 → 0 の 辺）
    wrongs = [
      [side((start + 1) % n), 'corr-adjacent'],
      [side((start + n - 1) % n), 'corr-adjacent'],
      [side((i + 2) % n), 'corr-adjacent'],
      [side((start + 2) % n), 'corr-adjacent'],
    ].filter((w): w is [string, string] => !same(w[0]!));
  }
  return {
    engine: 'choice',
    id: `corr${alt ? '-alt' : ''}:${nm.kind}:${nm.key}:${asked}`,
    objective: 'corr',
    level,
    prompt: `${setup}${asked}に 対応する ${alt ? '辺' : '点'}は どれですか。`,
    figure: namedFig(nm, `頂点に Aから ${nameOf(n - 1)}の 名前が ついた ${which}な 形`),
    hints: [
      nm.kind === 'line'
        ? '対称の 軸で 折ると、ぴったり 重なる ところが 対応する ところだよ。'
        : '点Oを 中心に 180度 回すと、ぴったり 重なる ところが 対応する ところだよ。',
      nm.kind === 'line'
        ? `${asked}から 軸に 垂直な 線を 引いて、軸の 反対側へ 同じ 長さ 進もう。`
        : `${alt ? `辺の はしの 点${nameOf(i)}` : asked}と 点Oを 結んだ 直線を、点Oの 反対側へ 同じ 長さ のばそう。`,
      alt
        ? `点${nameOf(i)}に 対応する 点は 点${nameOf(j)}。もう 1つの はしの 点${nameOf(i2Of(i, n))}に 対応する 点は どれかな。`
        : nm.kind === 'line'
          ? '軸を はさんで 向かい合う 点を さがそう。'
          : '点Oを はさんで 向かい合う 点を さがそう。',
    ],
    explain: `${asked}に 対応する ${alt ? '辺' : '点'}は ${correct}です。${nm.kind === 'line' ? '対応する 2つの 点を 結ぶ 直線は 対称の 軸と 垂直に 交わり、軸から 2つの 点までの 長さは 等しく なって います。' : '対応する 2つの 点を 結ぶ 直線は 対称の 中心 Oを 通り、Oから 2つの 点までの 長さは 等しく なって います。'}`,
    identity: `corr:${nm.kind}:${nm.key}:${asked}`,
    alt,
    options: opts(correct, wrongs),
  };
}
const i2Of = (i: number, n: number) => (i + 1) % n;

// ---- 作図 ----
/** 格子の点の多角形（3〜4点。ねじれ・一直線なし） */
export function randomPoly(rng: Rng, xr: [number, number], yr: [number, number], fixed?: Pt): Pt[] {
  for (let t = 0; t < 200; t++) {
    const n = rng.int(3, 4);
    const ps: Pt[] = fixed ? [fixed] : [];
    while (ps.length < n) {
      const p: Pt = [rng.int(xr[0], xr[1]), rng.int(yr[0], yr[1])];
      if (!ps.some((x) => samePt(x, p))) ps.push(p);
    }
    const cx = ps.reduce((s, p) => s + p[0], 0) / n;
    const cy = ps.reduce((s, p) => s + p[1], 0) / n;
    ps.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
    // 面積と 一直線の 検査
    let area = 0;
    let ok = true;
    for (let i = 0; i < n; i++) {
      const a = ps[i]!;
      const b = ps[(i + 1) % n]!;
      const c = ps[(i + 2) % n]!;
      area += a[0] * b[1] - b[0] * a[1];
      if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) === 0) ok = false;
    }
    if (n === 4 && !convexOrSimple(ps)) ok = false;
    if (ok && Math.abs(area) / 2 >= 3) return ps;
  }
  return [
    [xr[0], yr[0]],
    [xr[1], yr[0] + 1],
    [xr[0] + 1, yr[1]],
  ];
}
/** 4点の多角形が ねじれていないか（向かい合う辺が 交わらない） */
function convexOrSimple(ps: Pt[]): boolean {
  const cross = (a: Pt, b: Pt, c: Pt, d: Pt) => {
    const o = (p: Pt, q: Pt, r: Pt) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
  };
  return !cross(ps[0]!, ps[1]!, ps[2]!, ps[3]!) && !cross(ps[1]!, ps[2]!, ps[3]!, ps[0]!);
}

export const ptsKey = (ps: Pt[]) => ps.map((p) => p.join(',')).join(' ');

function drawLItem(level: number, rng: Rng, alt: boolean): GeometryItem {
  // 縦の軸（x ＝ 5）、別例は 横の軸（y ＝ 4）
  const grid = alt ? { w: 8, h: 8 } : { w: 10, h: 8 };
  const axis: [Pt, Pt] = alt ? [[0, 4], [8, 4]] : [[5, 0], [5, 8]];
  const pts = alt ? randomPoly(rng, [0, 8], [0, 3]) : randomPoly(rng, [0, 4], [0, 8]);
  return {
    engine: 'geometry',
    id: `drawL${alt ? '-alt' : ''}:${ptsKey(pts)}`,
    objective: 'drawL',
    level,
    prompt: '点線を 対称の 軸に して、線対称な 形に なるように、反対側の 形を かこう。',
    hints: [
      '頂点ごとに、軸の 反対側の 対応する 点を さがそう。',
      `対応する 点は、軸までの ます目の 数が 同じで、軸に 垂直な 線の 上に あるよ。`,
      '対応する 点を 全部 打ったら、もとの 形と 同じ 順に 結んで とじよう。',
    ],
    explain:
      '線対称な 形では、対応する 点を 結ぶ 直線は 対称の 軸と 垂直に 交わり、軸から 対応する 点までの 長さは 等しく なります。',
    identity: `drawL:${alt ? 'h' : 'v'}:${ptsKey(pts)}`,
    alt,
    task: { kind: 'draw', grid, given: [{ points: pts }], target: { kind: 'reflect', points: pts, axis } },
    misconceptions: { translated: 'translated' },
  };
}

function drawPItem(level: number, rng: Rng, alt: boolean): GeometryItem {
  const center: Pt = [5, 4];
  const pts = alt ? randomPoly(rng, [1, 4], [0, 8], center) : randomPoly(rng, [1, 4], [1, 7]);
  return {
    engine: 'geometry',
    id: `drawP${alt ? '-alt' : ''}:${ptsKey(pts)}`,
    objective: 'drawP',
    level,
    prompt: alt
      ? '点Oを 対称の 中心に して、点対称な 形に なるように、のこりの 形を かこう。（点Oは 形の 頂点でも あります）'
      : '点Oを 対称の 中心に して、点対称な 形に なるように、反対側の 形を かこう。',
    hints: [
      '頂点ごとに、点Oを はさんだ 反対側の 対応する 点を さがそう。',
      '頂点から 点Oまでと 同じ ます目の 数だけ、点Oから 同じ 向きに 進んだ ところが 対応する 点だよ。',
      '対応する 点を 全部 打ったら、もとの 形と 同じ 順に 結んで とじよう。',
    ],
    explain:
      '点対称な 形では、対応する 点を 結ぶ 直線は 対称の 中心 Oを 通り、Oから 対応する 点までの 長さは 等しく なります。',
    identity: `drawP:${alt ? 'vertex' : 'apart'}:${ptsKey(pts)}`,
    alt,
    task: {
      kind: 'draw',
      grid: { w: 10, h: 8 },
      given: [{ points: pts }, { points: [center], closed: false, names: ['O'] }],
      target: { kind: 'rotate180', points: pts, center },
    },
    misconceptions: { translated: 'translated' },
  };
}

// ---- 多角形の対称 ----
interface PolyFact {
  id: string;
  name: string;
  axes: number | 'many';
  point: boolean;
  /** 正多角形の頂点の数（図を描く） */
  regular?: number;
  /** 図の形（正多角形以外） */
  pts?: Pt[];
  /** 軸の数の誤り（対角線も軸と考えた など） */
  wrongAxes: [string, string][];
}
const POLYS: PolyFact[] = [
  { id: 'tri', name: '正三角形', axes: 3, point: false, regular: 3, wrongAxes: [['1本', 'axis-count'], ['6本', 'axis-count']] },
  { id: 'sq', name: '正方形', axes: 4, point: true, regular: 4, wrongAxes: [['2本', 'axis-diagonal'], ['8本', 'axis-count']] },
  { id: 'pent', name: '正五角形', axes: 5, point: false, regular: 5, wrongAxes: [['10本', 'axis-count'], ['1本', 'axis-count']] },
  { id: 'hex', name: '正六角形', axes: 6, point: true, regular: 6, wrongAxes: [['3本', 'axis-diagonal'], ['12本', 'axis-count']] },
  { id: 'oct', name: '正八角形', axes: 8, point: true, regular: 8, wrongAxes: [['4本', 'axis-diagonal'], ['16本', 'axis-count']] },
  {
    id: 'rect',
    name: '長方形',
    axes: 2,
    point: true,
    pts: [[0, 0], [5, 0], [5, 3], [0, 3]],
    wrongAxes: [['4本', 'axis-diagonal'], ['1本', 'axis-count']],
  },
  {
    id: 'rhom',
    name: 'ひし形',
    axes: 2,
    point: true,
    pts: [[2, 0], [4, 3], [2, 6], [0, 3]],
    wrongAxes: [['4本', 'axis-diagonal'], ['0本', 'axis-count']],
  },
  {
    id: 'para',
    name: '平行四辺形',
    axes: 0,
    point: true,
    pts: [[0, 3], [2, 0], [6, 0], [4, 3]],
    wrongAxes: [['2本', 'axis-diagonal'], ['1本', 'looks-sym']],
  },
  {
    id: 'iso',
    name: '二等辺三角形',
    axes: 1,
    point: false,
    pts: [[0, 4], [2, 0], [4, 4]],
    wrongAxes: [['3本', 'axis-count'], ['0本', 'axis-count']],
  },
  { id: 'circle', name: '円', axes: 'many', point: true, wrongAxes: [['1本', 'axis-count'], ['4本', 'axis-count']] },
];

function polyFig(p: PolyFact) {
  if (p.id === 'circle')
    return svg(200, 180, `<circle cx="100" cy="90" r="70" fill="var(--sky)" ${STROKE}/>`, '円の 図');
  let pts: [number, number][];
  if (p.regular) {
    const n = p.regular;
    pts = Array.from({ length: n }, (_, k) => {
      const a = -Math.PI / 2 + (2 * Math.PI * k) / n + (n % 2 === 0 ? Math.PI / n : 0);
      return [r1(100 + 75 * Math.cos(a)), r1(92 + 75 * Math.sin(a))];
    });
  } else {
    const xs = p.pts!.map((q) => q[0]);
    const ys = p.pts!.map((q) => q[1]);
    const s = Math.min(150 / (Math.max(...xs) - Math.min(...xs)), 140 / (Math.max(...ys) - Math.min(...ys)));
    pts = p.pts!.map((q) => [r1(25 + (q[0] - Math.min(...xs)) * s), r1(20 + (q[1] - Math.min(...ys)) * s)]);
  }
  return svg(200, 180, `<polygon points="${pts.map((q) => q.join(',')).join(' ')}" fill="var(--sky)" ${STROKE}/>`, `${p.name}の 図`);
}

function polyItem(level: number, rng: Rng, alt: boolean): ChoiceItem {
  const p = pick(rng, POLYS);
  const q = rng.next() < 0.6 ? 'axes' : 'point';
  const what = alt ? 'この 形' : p.name;
  if (q === 'axes') {
    const correct = p.axes === 'many' ? '数えきれないほど ある' : `${p.axes}本`;
    const wrongs: [string, string][] = [...p.wrongAxes];
    if (p.axes !== 'many') wrongs.push(['数えきれないほど ある', 'axis-count']);
    return {
      engine: 'choice',
      id: `poly${alt ? '-alt' : ''}:${p.id}:axes`,
      objective: 'poly',
      level,
      prompt: `${what}の 対称の 軸は 何本 ありますか。`,
      figure: alt ? polyFig(p) : undefined,
      hints: [
        '折って ぴったり 重なる 折り目の 線を、全部 さがそう。',
        p.regular
          ? `正多角形では、頂点と 中心を 通る 線や、辺の 真ん中と 中心を 通る 線が 軸に なるよ。`
          : '対角線で 折っても 重なるか、たしかめよう。',
        p.regular ? `正${p.regular === 3 ? '三' : p.regular === 4 ? '四' : p.regular === 5 ? '五' : p.regular === 6 ? '六' : '八'}角形の 頂点の 数と くらべて みよう。` : '縦《たて》・横《よこ》・ななめの 折り目を 1つずつ 調べよう。',
      ],
      explain: `${p.name}の 対称の 軸は ${correct}${p.axes === 'many' ? '（中心を 通る 直線は すべて 対称の 軸）' : ''}。${p.regular ? '正多角形の 対称の 軸の 数は、頂点の 数と 同じです。' : ''}`,
      identity: `poly:${p.id}:axes${alt ? ':fig' : ''}`,
      alt,
      options: opts(correct, wrongs),
    };
  }
  const correct = p.point ? '点対称で ある' : '点対称では ない';
  return {
    engine: 'choice',
    id: `poly${alt ? '-alt' : ''}:${p.id}:point`,
    objective: 'poly',
    level,
    prompt: `${what}は 点対称な 形ですか。`,
    figure: alt ? polyFig(p) : undefined,
    hints: [
      '真ん中の 点を 中心に 180度 回して、ぴったり 重なるかな。',
      '向かい合う 頂点が あるか 見よう。',
      p.regular ? '頂点の 数が 偶数《ぐうすう》か 奇数《きすう》かで 考えよう。' : '向かい合う 辺が 平行で 同じ 長さかな。',
    ],
    explain: p.point
      ? `${p.name}は 中心の まわりに 180度 回すと もとの 形に 重なるので、点対称な 形です。`
      : `${p.name}は 180度 回すと 頂点が 下（上）を 向いて しまい、もとの 形に 重ならないので、点対称な 形では ありません。`,
    identity: `poly:${p.id}:point${alt ? ':fig' : ''}`,
    alt,
    options: [
      { label: correct, correct: true },
      { label: p.point ? '点対称では ない' : '点対称で ある', misconception: 'line-vs-point' },
    ],
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['judge', 'corr'] },
  { objs: ['drawL', 'corr', 'judge'] },
  { objs: ['drawP', 'corr', 'drawL'] },
  { objs: ['poly', 'drawP', 'drawL', 'judge'] },
];

export function generateSymmetry(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'judge':
      return judgeItem(level, rng, alt);
    case 'corr':
      return corrItem(level, rng, alt);
    case 'drawL':
      return drawLItem(level, rng, alt);
    case 'drawP':
      return drawPItem(level, rng, alt);
    case 'poly':
      return polyItem(level, rng, alt);
  }
}

export const SYM_SHAPES = { LINE_SHAPES, POINT_SHAPES, BOTH_SHAPES, NONE_SHAPES };

export const symmetry: UnitSpec = finishUnit({
  id: 'g6.math.symmetry',
  title: '線対称・点対称',
  stage: 'g6',
  subject: 'math',
  domain: 'B-shape',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-shapes',
  prereq: ['g5.math.congruence'],
  objectives: [
    { id: 'judge', title: '線対称・点対称な 形を 見分ける' },
    { id: 'corr', title: '対応する 点・辺' },
    { id: 'drawL', title: '線対称な 形を かく' },
    { id: 'drawP', title: '点対称な 形を かく' },
    { id: 'poly', title: '多角形と 対称' },
  ],
  misconceptions: [
    {
      id: 'line-vs-point',
      explain:
        '線対称と 点対称を 取りちがえたのかな。線対称は「1本の 直線で 折ると 重なる」、点対称は「1つの 点を 中心に 180度 回すと 重なる」形だよ。',
    },
    {
      id: 'looks-sym',
      explain: 'ぱっと 見て 整って いるように 見えたのかな。実際に 折ったり 回したり して、ぴったり 重なるか たしかめよう。',
    },
    {
      id: 'corr-adjacent',
      explain: 'となりの 頂点（辺）を 選んだのかな。軸で 折ったり 中心で 回したり した とき、ぴったり 重なる 点（辺）が 対応する 点（辺）だよ。',
    },
    {
      id: 'translated',
      explain:
        '形を ずらしただけで かいたのかな。線対称では 軸の 反対側に 裏返し、点対称では 中心の まわりに 180度 回した 向きに なるよ。頂点を 1つずつ 写そう。',
    },
    {
      id: 'axis-count',
      explain: '対称の 軸の 数を 数えまちがえたのかな。折り目の 線を 1本ずつ ていねいに さがそう。',
    },
    {
      id: 'axis-diagonal',
      explain:
        '対角線の 折り目を 入れ忘れた（または 入れすぎた）のかな。長方形や 平行四辺形は 対角線で 折っても 重ならないけれど、正方形は 重なるよ。',
    },
  ],
  levels: [
    { label: '見分ける・対応', chance: 0.25 },
    { label: '線対称な 形を かく', chance: 0.05 },
    { label: '点対称な 形を かく', chance: 0.05 },
    { label: '多角形の 対称・まとめ', chance: 0.1 },
  ],
  intro: [
    {
      text: '1本の 直線で 折ると、両側が ぴったり 重なる 形を 線対称な 形と いい、その 直線を 対称の 軸と いいます。',
      figure: namedFig(
        {
          pts: [[4, 0], [1, 2], [2, 5], [6, 5], [7, 2]],
          kind: 'line',
          partner: (i) => [0, 4, 3, 2, 1][i]!,
          key: 'intro',
          axis: [[4, -0.6], [4, 5.6]],
        },
        '線対称な 五角形と 対称の 軸',
      ),
    },
    {
      text: '1つの 点を 中心に 180度 回すと、もとの 形に ぴったり 重なる 形を 点対称な 形と いい、その 点を 対称の 中心と いいます。',
      figure: namedFig(
        {
          pts: [[0, 3], [1, 0], [5, 0], [4, 3]],
          kind: 'point',
          partner: (i) => (i + 2) % 4,
          key: 'intro2',
          center: [2.5, 1.5],
        },
        '点対称な 平行四辺形と 対称の 中心',
      ),
    },
    {
      text: '重なり合う 点・辺・角を、対応する 点・辺・角と いいます。対応する 辺の 長さ、対応する 角の 大きさは 等しく なります。',
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateSymmetry(level, rng, index),
  },
  review: 'objective',
  basis: '小学校学習指導要領（平成29年告示）算数 第6学年 B(1) 縮図や拡大図、対称な図形（線対称・点対称）',
  revised: REVISED,
});
