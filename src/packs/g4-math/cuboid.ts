/**
 * g4.math.cuboid 直方体と立方体、見取図・展開図、位置の表し方（curriculum-matrix 3.7）。
 * 面・辺・頂点の数 → 面や辺の垂直・平行 → 展開図を組み立てる → 平面・空間の位置（横・たて・高さ）。
 *
 * matrix は「手40」。展開図は 4×5 の ます目の 6まいの形を すべて調べ、組み立てて重ならない形（立方体の展開図）と
 * 重なる形を 自動で分ける（組み立ての計算: 面の向きを3次元のベクトルで追う）。
 * 同一性キー: 問う形 × 立体の大きさ・展開図の形・問う面や辺・点の位置。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { finishUnit, opts, pick, pickObj, REVISED, STROKE, svg, svgText, wrongList } from './util';

type Obj = 'count' | 'relation' | 'net' | 'position';
type V3 = [number, number, number];
type Cell = [number, number];

// ---- 展開図 ----
const neg = (v: V3): V3 => [-v[0], -v[1], -v[2]];
const eq3 = (a: V3, b: V3) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/** 展開図を組み立てた ときの 各面の 外向きの 向き（重なれば null） */
export function foldNet(cells: Cell[]): V3[] | null {
  const n = cells.length;
  const normal: (V3 | null)[] = cells.map(() => null);
  const ex: (V3 | null)[] = cells.map(() => null);
  const ey: (V3 | null)[] = cells.map(() => null);
  normal[0] = [0, 0, -1];
  ex[0] = [1, 0, 0];
  ey[0] = [0, 1, 0];
  const queue = [0];
  while (queue.length) {
    const i = queue.shift()!;
    const [x, y] = cells[i]!;
    for (let j = 0; j < n; j++) {
      if (normal[j]) continue;
      const [x2, y2] = cells[j]!;
      const dx = x2 - x;
      const dy = y2 - y;
      if (Math.abs(dx) + Math.abs(dy) !== 1) continue;
      const N = normal[i]!;
      const X = ex[i]!;
      const Y = ey[i]!;
      if (dx === 1) [normal[j], ex[j], ey[j]] = [X, neg(N), Y];
      else if (dx === -1) [normal[j], ex[j], ey[j]] = [neg(X), N, Y];
      else if (dy === 1) [normal[j], ex[j], ey[j]] = [Y, X, neg(N)];
      else [normal[j], ex[j], ey[j]] = [neg(Y), X, N];
      queue.push(j);
    }
  }
  if (normal.some((v) => !v)) return null;
  const ns = normal as V3[];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (eq3(ns[i]!, ns[j]!)) return null;
  return ns;
}

/** 4×5 の ます目の 6まいの つながった形（平行移動で そろえる） */
function hexominoes(): Cell[][] {
  const W = 5;
  const H = 4;
  const out = new Map<string, Cell[]>();
  const all: Cell[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) all.push([x, y]);
  const choose = (start: number, cur: Cell[]) => {
    if (cur.length === 6) {
      // つながっているか
      const seen = new Set([0]);
      const st = [0];
      while (st.length) {
        const i = st.pop()!;
        cur.forEach((c, j) => {
          if (!seen.has(j) && Math.abs(c[0] - cur[i]![0]) + Math.abs(c[1] - cur[i]![1]) === 1) {
            seen.add(j);
            st.push(j);
          }
        });
      }
      if (seen.size !== 6) return;
      const mx = Math.min(...cur.map((c) => c[0]));
      const my = Math.min(...cur.map((c) => c[1]));
      const norm = cur.map(([x, y]) => [x - mx, y - my] as Cell).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
      const w = Math.max(...norm.map((c) => c[0])) + 1;
      const h = Math.max(...norm.map((c) => c[1])) + 1;
      if (w > 5 || h > 3) return;
      out.set(JSON.stringify(norm), norm);
      return;
    }
    for (let i = start; i < all.length; i++) choose(i + 1, [...cur, all[i]!]);
  };
  choose(0, []);
  return [...out.values()];
}

const HEXES = hexominoes();
export const NETS = HEXES.filter((c) => foldNet(c));
const NOT_NETS = HEXES.filter((c) => !foldNet(c));

const netKey = (c: Cell[]) => c.map((p) => p.join(',')).join(' ');

function netFig(cells: Cell[], numbers: boolean, mark?: number): Figure {
  const s = 34;
  const w = Math.max(...cells.map((c) => c[0])) + 1;
  const h = Math.max(...cells.map((c) => c[1])) + 1;
  let body = '';
  cells.forEach(([x, y], i) => {
    body += `<rect x="${4 + x * s}" y="${4 + y * s}" width="${s}" height="${s}" fill="${i === mark ? 'var(--sun)' : 'var(--white)'}" ${STROKE}/>`;
    if (numbers) body += svgText(4 + x * s + s / 2, 4 + y * s + s / 2, String(i + 1), 16);
  });
  return svg(w * s + 8, h * s + 8, body, '展開図');
}

/** 展開図: 向かい合う 面（alt: 立方体の 展開図を 選ぶ） */
function net(level: number, rng: Rng, alt: boolean): ChoiceItem {
  if (alt) {
    const right = pick(rng, NETS);
    const wrongs = rng.sample(NOT_NETS, 3);
    return {
      engine: 'choice',
      id: `net-alt:${netKey(right)}:${wrongs.map(netKey).join('|')}`,
      objective: 'net',
      level,
      prompt: '立方体の 展開図に なって いるのは どれ？',
      hints: [
        '頭の 中で 組み立てて みよう。面が 重なったら 展開図では ないよ。',
        '4つ ならんだ 面は、まいて 横の 4つの 面に なるよ。',
        '1つの 頂点に 4つの 面が 集まる 形（田の 字）は 組み立てられないね。',
      ],
      explain: '組み立てた ときに 6つの 面が 重ならずに 立方体に なる ものが 展開図です。',
      identity: `net-pick:${netKey(right)}:${wrongs.map(netKey).sort().join('|')}`,
      alt: true,
      layout: 'grid',
      options: [
        { figure: netFig(right, false), correct: true },
        ...wrongs.map((c) => ({ figure: netFig(c, false), misconception: 'net-overlap' })),
      ],
    };
  }
  const cells = pick(rng, NETS);
  const ns = foldNet(cells)!;
  const k = rng.int(0, 5);
  const opp = ns.findIndex((v) => eq3(v, neg(ns[k]!)));
  const adj = ns.map((_, i) => i).filter((i) => i !== k && i !== opp);
  const ws = rng.sample(adj, 3);
  return {
    engine: 'choice',
    id: `net:${netKey(cells)}:${k}`,
    objective: 'net',
    level,
    prompt: `この 展開図を 組み立てて 立方体を 作ります。${k + 1}の 面と 向かい合う 面は どれ？`,
    figure: netFig(cells, true, k),
    hints: [
      '向かい合う 面は、となり合わない 面だよ。',
      `${k + 1}の 面と 辺で くっついて いる 面は、向かい合わないね。`,
      '1つ とばした となりの 面が 向かい合う ことが 多いよ。頭の 中で おって みよう。',
    ],
    explain: `組み立てると、${k + 1}の 面と ${opp + 1}の 面が 向かい合います。ほかの 面は ${k + 1}の 面と となり合います。`,
    identity: `net:${netKey(cells)}:${k}`,
    alt: false,
    options: opts(`${opp + 1}の 面`, ws.map((i) => [`${i + 1}の 面`, 'adjacent-face'])),
  };
}

// ---- 見取図 ----
type Dims = [number, number, number];
const K = ['ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク'];
/** 頂点の 位置（ア〜エ: 前の面 左上から時計回り、オ〜ク: 後ろの面） */
const VERT: V3[] = [
  [0, 0, 1],
  [1, 0, 1],
  [1, 0, 0],
  [0, 0, 0],
  [0, 1, 1],
  [1, 1, 1],
  [1, 1, 0],
  [0, 1, 0],
];
const EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];
const FACES: number[][] = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [0, 1, 5, 4],
  [3, 2, 6, 7],
  [0, 3, 7, 4],
  [1, 2, 6, 5],
];

/** 見取図（横 a、おくゆき b、高さ c） */
function boxFig(d: Dims, labels: boolean, dimText: boolean, dot?: number): Figure {
  const k = 22;
  const [a, b, c] = d;
  const ox = b * k * 0.6;
  const oy = b * k * 0.45;
  const P = (v: V3) => [44 + v[0] * a * k + v[1] * ox, 14 + oy + (1 - v[2]) * c * k - v[1] * oy] as [number, number];
  let body = '';
  for (const [i, j] of EDGES) {
    const hidden = (i === 7 || j === 7) && !(VERT[i]![1] === 0 && VERT[j]![1] === 0);
    const p = P(VERT[i]!);
    const q = P(VERT[j]!);
    body += `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" ${STROKE}${hidden ? ' stroke-dasharray="5 5"' : ''}/>`;
  }
  if (labels)
    VERT.forEach((v, i) => {
      const p = P(v);
      body += svgText(p[0] + (v[0] ? 10 : -10), p[1] + (v[2] ? -8 : 12), K[i]!, 14);
    });
  if (dimText) {
    const p3 = P(VERT[3]!);
    const p2 = P(VERT[2]!);
    body += svgText((p3[0] + p2[0]) / 2, p3[1] + 16, `${a}cm`, 13);
    const p6 = P(VERT[6]!);
    // おくゆき: 右下の ななめの 辺の 右がわ
    body += svgText((p2[0] + p6[0]) / 2 + 26, (p2[1] + p6[1]) / 2 + 4, `${b}cm`, 13);
    // 高さ: 前の 面の 左の 辺の 左がわ
    const p0 = P(VERT[0]!);
    body += svgText(p0[0] - 6, (p0[1] + p3[1]) / 2, `${c}cm`, 13, 'end');
  }  if (dot !== undefined) {
    const p = P(VERT[dot]!);
    body += `<circle cx="${p[0]}" cy="${p[1]}" r="6" fill="var(--ink)"/>`;
    const o = P(VERT[3]!);
    body += `<circle cx="${o[0]}" cy="${o[1]}" r="5" fill="var(--white)" ${STROKE}/>`;
  }
  const W = 44 + a * k + ox + 50;
  const H = 14 + oy + c * k + 26;
  return svg(W, H, body, '直方体の 見取図');
}

/** 面・辺・頂点の 数（alt: 辺の 長さの 合計） */
function count(level: number, rng: Rng, alt: boolean): NumberItem {
  const cube = rng.next() < 0.3;
  const a = rng.int(2, 6);
  const d: Dims = cube ? [a, a, a] : [a, rng.int(2, 6), rng.int(2, 6)];
  if (!cube && d[0] === d[1] && d[1] === d[2]) d[2] = d[2] === 6 ? 5 : d[2] + 1;
  const name = cube ? '立方体' : '直方体';
  if (alt) {
    const sum = 4 * (d[0] + d[1] + d[2]);
    const answers = [{ kind: 'int' as const, value: sum }];
    return {
      engine: 'number',
      id: `count-alt:${d.join('x')}`,
      objective: 'count',
      level,
      prompt: `この ${name}の 辺の 長さを ぜんぶ たすと 何cmですか。`,
      figure: boxFig(d, false, true),
      hints: [
        `${name}の 辺は 12本。同じ 長さの 辺が 4本ずつ あるよ。`,
        `${d[0]}cm、${d[1]}cm、${d[2]}cmの 辺が 4本ずつ。`,
        `（${d[0]} ＋ ${d[1]} ＋ ${d[2]}）× 4 を 計算しよう。`,
      ],
      explain: `同じ 長さの 辺が 4本ずつ あるので、（${d[0]} ＋ ${d[1]} ＋ ${d[2]}）× 4 ＝ ${sum}cmです。`,
      identity: `count-sum:${[...d].sort().join('x')}`,
      alt: true,
      fields: [{ label: 'cm', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [d[0] + d[1] + d[2], 'edge-count'],
        [2 * (d[0] + d[1] + d[2]), 'edge-count'],
        [3 * (d[0] + d[1] + d[2]), 'edge-count'],
      ]),
    };
  }
  // 面・辺・頂点の 数は 6問しか ないので ときどき（偏りの 検査）。ふだんは 辺の 長さの 問題
  const ask = rng.next() < 0.15 ? rng.int(0, 2) : 3;
  if (ask < 3) {
    const what = ['面', '辺', '頂点'][ask]!;
    const ans = [6, 12, 8][ask]!;
    const answers = [{ kind: 'int' as const, value: ans }];
    return {
      engine: 'number',
      id: `count:${name}:${what}`,
      objective: 'count',
      level,
      prompt: `${name}の ${what}は いくつ ありますか。`,
      figure: boxFig(d, false, false),
      hints: [
        '見えない ところ（点線）も わすれずに 数えよう。',
        ask === 0 ? '前と 後ろ、上と 下、右と 左…' : ask === 1 ? '同じ 向きの 辺が 4本ずつ、3つの 向きが あるよ。' : '上の 面に いくつ、下の 面に いくつ？',
        ask === 0 ? '2まいずつ 3組だね。' : ask === 1 ? '4本ずつ 3組だね。' : '上に 4つ、下に 4つ。',
      ],
      explain: `${name}には 面が 6つ、辺が 12、頂点が 8つ あります。`,
      identity: `count:${name}:${what}`,
      alt: false,
      fields: [{ answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [ask === 0 ? 3 : ask === 1 ? 9 : 7, 'hidden-miss'],
        [ask === 0 ? 4 : ask === 1 ? 8 : 6, 'hidden-miss'],
        [ask === 1 ? 8 : ask === 2 ? 12 : 8, 'face-edge-vertex'],
      ]),
    };
  }
  // 長さが ○cm の 辺は 何本
  const len = d[rng.int(0, 2)]!;
  const ans = d.filter((x) => x === len).length * 4;
  const answers = [{ kind: 'int' as const, value: ans }];
  return {
    engine: 'number',
    id: `count:len:${d.join('x')}:${len}`,
    objective: 'count',
    level,
    prompt: `この ${name}で、長さが ${len}cmの 辺は 何本 ありますか。`,
    figure: boxFig(d, false, true),
    hints: ['同じ 向きの 辺は、長さが 同じだよ。', '1つの 向きに 辺は 4本ずつ あるね。', `長さが ${len}cmの 向きは いくつ あるかな。`],
    explain: `${name}では 同じ 向きの 辺 4本の 長さが 等しいので、${len}cmの 辺は ${ans}本です。`,
    identity: `count:len:${[...d].sort().join('x')}:${len}`,
    alt: false,
    fields: [{ label: '本', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [ans === 4 ? 1 : 2, 'hidden-miss'],
      [ans === 4 ? 2 : 4, 'hidden-miss'],
      [ans === 4 ? 3 : 6, 'hidden-miss'],
    ]),
  };
}

const faceName = (f: number[]) => `面${f.map((i) => K[i]).join('')}`;
const edgeName = (e: [number, number]) => `辺${K[e[0]]}${K[e[1]]}`;
const dirOf = (e: [number, number]) => {
  const a = VERT[e[0]]!;
  const b = VERT[e[1]]!;
  return [0, 1, 2].findIndex((k) => a[k] !== b[k]);
};

/** 面や 辺の 垂直・平行（alt: 平行な 辺を すべて 選ぶ） */
function relation(level: number, rng: Rng, alt: boolean): Item {
  const d: Dims = [5, 3, 3];
  const fig = boxFig(d, true, false);
  if (alt) {
    const e = pick(rng, EDGES);
    const dir = dirOf(e);
    const par = EDGES.filter((x) => x !== e && dirOf(x) === dir);
    const notPar = EDGES.filter((x) => dirOf(x) !== dir);
    const opt = [...par.map((x) => ({ label: edgeName(x), correct: true as const })), { label: edgeName(pick(rng, notPar)), misconception: 'perp-par-swap' }];
    const item: ChoiceItem = {
      engine: 'choice',
      id: `relation-alt:${edgeName(e)}:${opt[3]!.label}`,
      objective: 'relation',
      level,
      prompt: `${edgeName(e)}に 平行な 辺を ぜんぶ えらぼう。`,
      figure: fig,
      multi: true,
      hints: ['平行な 辺は、同じ 向きの 辺だよ。', `直方体では、1本の 辺に 平行な 辺は 3本 あるよ。`, '見えない 辺（点線）も わすれずに。'],
      explain: `${edgeName(e)}に 平行な 辺は ${par.map(edgeName).join('、')}の 3本です。`,
      identity: `relation-par:${edgeName(e)}:${opt[3]!.label}`,
      alt: true,
      options: opt,
    };
    return item;
  }
  const kind = rng.int(0, 2);
  if (kind === 0) {
    const fi = rng.int(0, 5);
    const f = FACES[fi]!;
    const oppI = fi % 2 === 0 ? fi + 1 : fi - 1;
    const others = FACES.filter((_, i) => i !== fi && i !== oppI);
    const item: ChoiceItem = {
      engine: 'choice',
      id: `relation:face:${fi}`,
      objective: 'relation',
      level,
      prompt: `${faceName(f)}に 平行な 面は どれ？`,
      figure: fig,
      hints: ['平行な 面は、向かい合って いる 面だよ。', `${faceName(f)}と 辺で くっついて いる 面は、垂直に 交わるよ。`, '見取図の 点線の 辺も 使って、反対がわの 面を さがそう。'],
      explain: `${faceName(f)}に 平行な 面は、向かい合う ${faceName(FACES[oppI]!)}です。ほかの 面は ${faceName(f)}に 垂直です。`,
      identity: `relation:face:${fi}`,
      alt: false,
      options: opts(faceName(FACES[oppI]!), rng.sample(others, 3).map((x) => [faceName(x), 'adjacent-face'])),
    };
    return item;
  }
  const e = pick(rng, EDGES);
  const ans = kind === 1 ? 3 : 4;
  const answers = [{ kind: 'int' as const, value: ans }];
  const item: NumberItem = {
    engine: 'number',
    id: `relation:edge:${edgeName(e)}:${kind}`,
    objective: 'relation',
    level,
    prompt: `${edgeName(e)}に ${kind === 1 ? '平行' : '垂直'}な 辺は 何本 ありますか。`,
    figure: fig,
    hints: [
      kind === 1 ? '平行な 辺は、同じ 向きの 辺だよ。' : `垂直な 辺は、${edgeName(e)}の 両はしで 直角に 交わる 辺だよ。`,
      '見えない 辺（点線）も 数えよう。',
      kind === 1 ? '同じ 向きの 辺は ぜんぶで 4本。その うち 1本は 自分だね。' : '両はしの 頂点で、それぞれ 2本ずつ。',
    ],
    explain: `${edgeName(e)}に ${kind === 1 ? '平行な 辺は 3本' : '垂直な 辺は 4本'}です。`,
    identity: `relation:edge:${edgeName(e)}:${kind}`,
    alt: false,
    fields: [{ label: '本', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [kind === 1 ? 4 : 3, 'perp-par-swap'],
      [kind === 1 ? 1 : 2, 'hidden-miss'],
      [kind === 1 ? 2 : 8, 'hidden-miss'],
    ]),
  };
  return item;
}

/** 位置の 表し方（平面。alt: 空間） */
function position(level: number, rng: Rng, alt: boolean): NumberItem {
  if (alt) {
    const d: Dims = [rng.int(2, 6), rng.int(2, 5), rng.int(2, 5)];
    let vi = rng.int(0, 7);
    if (vi === 3) vi = 5;
    const v = VERT[vi]!;
    const ans = [v[0] * d[0], v[1] * d[1], v[2] * d[2]];
    const answers = ans.map((x) => ({ kind: 'int' as const, value: x }));
    return {
      engine: 'number',
      id: `position-alt:${d.join('x')}:${vi}`,
      objective: 'position',
      level,
      prompt: '○の 頂点を もとに すると、●の 頂点の 位置は（横 何cm、たて 何cm、高さ 何cm）と 表せますか。',
      figure: boxFig(d, false, true, vi),
      hints: [
        '空間の 位置は、横・たて・高さの 3つの 長さで 表せるよ。',
        '○から 横に どれだけ、おくに（たてに）どれだけ、上に どれだけ 進むかな。',
        `横は 0か ${d[0]}、たては 0か ${d[1]}、高さは 0か ${d[2]}の どれかだよ。`,
      ],
      explain: `●の 頂点は（横 ${ans[0]}cm、たて ${ans[1]}cm、高さ ${ans[2]}cm）です。`,
      identity: `position:space:${d.join('x')}:${vi}`,
      alt: true,
      fields: [
        { label: '横', answer: answers[0]! },
        { label: 'たて', answer: answers[1]! },
        { label: '高さ', answer: answers[2]! },
      ],
      wrongAnswers: wrongList(answers, [
        [`${ans[1]}|${ans[0]}|${ans[2]}`, 'xy-swap'],
        [`${ans[0]}|${ans[2]}|${ans[1]}`, 'xy-swap'],
      ]),
    };
  }
  const W = 8;
  const H = 6;
  const pts: [number, number][] = [];
  while (pts.length < 3) {
    const p: [number, number] = [rng.int(1, W), rng.int(1, H)];
    if (!pts.some((q) => q[0] === p[0] && q[1] === p[1]) && p[0] !== p[1]) pts.push(p);
  }
  const k = rng.int(0, 2);
  const C = 30;
  let body = '';
  for (let x = 0; x <= W; x++) body += `<line x1="${20 + x * C}" y1="10" x2="${20 + x * C}" y2="${10 + H * C}" stroke="var(--ink)" stroke-opacity="0.2" stroke-width="1"/>`;
  for (let y = 0; y <= H; y++) body += `<line x1="20" y1="${10 + y * C}" x2="${20 + W * C}" y2="${10 + y * C}" stroke="var(--ink)" stroke-opacity="0.2" stroke-width="1"/>`;
  body += `<circle cx="20" cy="${10 + H * C}" r="6" fill="var(--white)" ${STROKE}/>`;
  const names = ['ア', 'イ', 'ウ'];
  pts.forEach((p, i) => {
    const cx = 20 + p[0] * C;
    const cy = 10 + (H - p[1]) * C;
    body += `<circle cx="${cx}" cy="${cy}" r="6" fill="var(--ink)"/>${svgText(cx + 12, cy - 12, names[i]!, 16)}`;
  });
  for (let x = 1; x <= W; x++) body += svgText(20 + x * C, 26 + H * C, String(x), 12);
  for (let y = 1; y <= H; y++) body += svgText(8, 10 + (H - y) * C, String(y), 12);
  const p = pts[k]!;
  const answers = [
    { kind: 'int' as const, value: p[0] },
    { kind: 'int' as const, value: p[1] },
  ];
  return {
    engine: 'number',
    id: `position:${pts.map((q) => q.join(',')).join(' ')}:${k}`,
    objective: 'position',
    level,
    prompt: `○の 点を もとに すると、点${names[k]}の 位置は（横 何ます、たて 何ます）と 表せますか。`,
    figure: svg(20 + W * C + 20, 10 + H * C + 30, body, '方がんの 上の 点'),
    hints: [
      '平面の 位置は、横と たての 2つの 数で 表せるよ。',
      '○から 横に 何ます 進むか、まず 数えよう。',
      `つぎに 上へ 何ます 進むか 数えよう。`,
    ],
    explain: `点${names[k]}の 位置は（横 ${p[0]}、たて ${p[1]}）です。横を 先に、たてを あとに 書きます。`,
    identity: `position:${p.join(',')}`,
    alt: false,
    fields: [
      { label: '横', answer: answers[0]! },
      { label: 'たて', answer: answers[1]! },
    ],
    wrongAnswers: wrongList(answers, [
      [`${p[1]}|${p[0]}`, 'xy-swap'],
      [`${p[0] + 1}|${p[1] + 1}`, 'count-from-one'],
    ]),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['count', 'relation'] },
  { objs: ['net', 'relation', 'count'] },
  { objs: ['position', 'net', 'relation'] },
];

export function generateCuboid(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'count':
      return count(level, rng, alt);
    case 'relation':
      return relation(level, rng, alt);
    case 'net':
      return net(level, rng, alt);
    case 'position':
      return position(level, rng, alt);
  }
}

export const cuboid: UnitSpec = finishUnit({
  id: 'g4.math.cuboid',
  title: '直方体と 立方体',
  stage: 'g4',
  subject: 'math',
  domain: 'B-shape',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'g1m-box',
  prereq: ['g2.math.box'],
  objectives: [
    { id: 'count', title: '面・辺・頂点の 数' },
    { id: 'relation', title: '面や 辺の 垂直・平行' },
    { id: 'net', title: '展開図' },
    { id: 'position', title: '位置の 表し方（平面・空間）' },
  ],
  misconceptions: [
    {
      id: 'hidden-miss',
      explain: '見えない ところ（点線）を 数えわすれたのかな。うらがわの 面や 辺も 数えよう。',
    },
    {
      id: 'face-edge-vertex',
      explain: '面・辺・頂点を とりちがえたのかな。平らな ところが 面、面と 面の さかいの 線が 辺、かどの 点が 頂点だよ。',
    },
    {
      id: 'edge-count',
      explain: '同じ 長さの 辺の 本数を たしかめよう。直方体には 同じ 長さの 辺が 4本ずつ あるよ。',
    },
    {
      id: 'adjacent-face',
      explain: 'となり合う 面を えらんだのかな。となり合う 面どうしは 垂直。平行なのは 向かい合う 面だよ。',
    },
    {
      id: 'perp-par-swap',
      explain: '垂直と 平行を とりちがえたのかな。同じ 向きの 辺が 平行、直角に 交わる 辺が 垂直だよ。',
    },
    {
      id: 'net-overlap',
      explain: '組み立てると 面が 重なって しまう 形だよ。頭の 中で 1まいずつ おって、6つの 面が みんな ちがう 向きに なるか たしかめよう。',
    },
    {
      id: 'xy-swap',
      explain: '数の じゅん番が 入れかわったのかな。横、たて（、高さ）の じゅんに 書くよ。',
    },
    {
      id: 'count-from-one',
      explain: 'ますの 数ではなく 点の 数を 数えたのかな。○の 点は 0。そこから 何ます 進むかを 数えよう。',
    },
  ],
  levels: [
    { label: '面・辺・頂点・平行と 垂直', chance: 0.05 },
    { label: '展開図', chance: 0.05 },
    { label: '位置の 表し方', chance: 0.02 },
  ],
  intro: [
    {
      text: '長方形だけで かこまれた 形を 直方体、正方形だけで かこまれた 形を 立方体と いいます。面は 6つ、辺は 12、頂点は 8つ です。',
      figure: boxFig([5, 3, 3], false, true),
    },
    {
      text: '全体の 形が わかるように かいた 図を 見取図と いいます。見えない 辺は 点線で かきます。',
      figure: boxFig([5, 3, 3], true, false),
    },
    {
      text: '辺に そって 切り開いて、平面の 上に 広げた 図を 展開図と いいます。',
      figure: netFig(
        [
          [1, 0],
          [0, 1],
          [1, 1],
          [2, 1],
          [3, 1],
          [1, 2],
        ],
        true,
      ),
    },
    {
      text: '平面の 点の 位置は（横、たて）、空間の 点の 位置は（横、たて、高さ）の 長さで 表せます。',
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateCuboid(level, rng, index),
  },
  review: 'objective',
  basis: '小学校学習指導要領（平成29年告示）算数 第4学年 B(2) 立体図形（直方体・立方体、見取図・展開図、面や辺の平行・垂直）、B(3) ものの位置の表し方',
  revised: REVISED,
});
