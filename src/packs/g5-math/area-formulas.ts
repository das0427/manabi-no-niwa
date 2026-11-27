/**
 * g5.math.area-formulas 三角形・平行四辺形・ひし形・台形の面積（curriculum-matrix 3.8）。
 * 長方形に形を変える（おてほん）→ 公式 → 高さが図形の外にある場合 → 面積から高さ・底辺を求める。
 *
 * ななめの辺の長さは、高さ・横のずれとピタゴラス数（3・4・5 など）でそろえる（図の長さが正しい）。
 * 種別は「計+概」。量の基準は計算の 100。
 * 同一性キー: 形 × 長さ（× 表し方: 図・ことば・式を選ぶ・高さが外）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import {
  expr,
  finishUnit,
  pick,
  pickObj,
  r1,
  REVISED,
  STROKE,
  svg,
  svgText,
  wrongList,
} from './util';

type Obj = 'para' | 'tri' | 'trap' | 'rhombus' | 'inverse';
type P = [number, number];

/** [横のずれ, 高さ, ななめの辺]（ピタゴラス数。両方の向き） */
const TRIPLES: [number, number, number][] = [];
for (const [a, b, c] of [
  [3, 4, 5],
  [6, 8, 10],
  [9, 12, 15],
  [5, 12, 13],
  [8, 15, 17],
] as const) {
  TRIPLES.push([a, b, c], [b, a, c]);
}

interface Fig {
  poly: P[];
  /** 点線（高さ・対角線） */
  dashed?: [P, P][];
  /** 細い点線（辺の のばした ところ） */
  dotted?: [P, P][];
  /** 直角の しるし（点線の 足） */
  right?: P[];
  /**
   * 長さの 字。seg の上に 置く（字は at の 点から dx・dy の 向きに はなす: dx<0 は 左、dx>0 は 右、dy>0 は 下、dy<0 は 上）。
   * 辺や 点線に かさなるときは、seg の 上で 位置を ずらす。
   */
  labels: { at: P; text: string; dx?: number; dy?: number; seg?: [P, P]; flip?: boolean }[];
}

/**
 * 線分 p→q（字の 置き場所の もとの 点 → 字の 中心）が 辺 a→b を またぐか。
 * もとの 点が 辺の 上に あるとき（ななめの辺の 字）は、その 辺は またがない とみなす。
 */
function crosses(p: P, q: P, a: P, b: P): boolean {
  const rx = q[0] - p[0];
  const ry = q[1] - p[1];
  const sx = b[0] - a[0];
  const sy = b[1] - a[1];
  const d = rx * sy - ry * sx;
  if (Math.abs(d) < 1e-9) return false;
  // もとの 点が この 辺の 上（0.5 より 近い）なら またがない
  const len = Math.hypot(sx, sy) || 1;
  const dist = Math.abs((p[0] - a[0]) * sy - (p[1] - a[1]) * sx) / len;
  const along = ((p[0] - a[0]) * sx + (p[1] - a[1]) * sy) / (len * len);
  if (dist < 0.5 && along >= -0.01 && along <= 1.01) return false;
  const t = ((a[0] - p[0]) * sy - (a[1] - p[1]) * sx) / d; // p→q の 上の 位置（0〜1）
  const u = ((a[0] - p[0]) * ry - (a[1] - p[1]) * rx) / d; // a→b の 上の 位置（0〜1）
  return t > 0 && t <= 1 && u >= 0 && u <= 1;
}

/** 長さの字の大きさ（viewBox の単位）。図は、この字が 画面で 1.8u（最小より 大きい）に なる 幅（widthU）で 描く */
const FS = 17;
/** 図の高さの上限（viewBox の単位）。字 1.8u のとき 12.5u に収まる: 12.5 ÷ 1.8 × 17 */
const MAX_VB_H = 118;
const textW = (t: string) =>
  [...t].reduce(
    (w, ch) => w + (/[0-9]/.test(ch) ? 0.56 : ch === 'c' ? 0.5 : ch === 'm' ? 0.85 : 1) * FS,
    0,
  );

/**
 * 図（座標は 数学の向き: y が上）。文字は 数字と cm だけ。
 * 図形は 150 × 72 の中に収め、長さの字は 図の 外がわ・点線の わきに 置く。
 * 図全体の 高さが MAX_VB_H を こえるときは 図形を 小さくする。幅は 字が 1.8u になる 幅（widthU）。
 */
function draw(f: Fig, label: string): Figure {
  const xs = f.poly.map((p) => p[0]).concat((f.dotted ?? []).flatMap((s) => [s[0][0], s[1][0]]));
  const minX = Math.min(...xs);
  const W = Math.max(...xs) - minX;
  const H = Math.max(...f.poly.map((p) => p[1]));
  let boxW = 150;
  let boxH = 72;
  for (let tries = 0; ; tries++) {
    const k = Math.min(boxW / W, boxH / H);
    const X = (x: number) => (x - minX) * k;
    const Y = (y: number) => (H - y) * k;
    // 図形の辺（字との重なりを調べる点列）
    const edges: [number, number][][] = [];
    const lines: [P, P][] = [
      ...f.poly.map((p, i) => [p, f.poly[(i + 1) % f.poly.length]!] as [P, P]),
      ...(f.dashed ?? []),
      ...(f.dotted ?? []),
    ];
    // 直角の しるし（点線の 足の 右上 8 × 8）
    for (const p of f.right ?? []) {
      const [x, y] = [X(p[0]), Y(p[1])];
      edges.push(Array.from({ length: 9 }, (_, i) => [x + 8, y - i] as [number, number]));
      edges.push(Array.from({ length: 9 }, (_, i) => [x + i, y - 8] as [number, number]));
    }
    const polyEdges: [P, P][] = f.poly.map((p, i) => {
      const q = f.poly[(i + 1) % f.poly.length]!;
      return [
        [X(p[0]), Y(p[1])],
        [X(q[0]), Y(q[1])],
      ];
    });
    for (const [a, b] of lines)
      edges.push(
        Array.from({ length: 41 }, (_, i) => [
          X(a[0] + ((b[0] - a[0]) * i) / 40),
          Y(a[1] + ((b[1] - a[1]) * i) / 40),
        ]),
      );
    const placed: {
      x: number;
      y: number;
      anchor: string;
      text: string;
      box: [number, number, number, number];
    }[] = [];
    for (const l of f.labels) {
      const seg = l.seg ?? [l.at, l.at];
      const w = textW(l.text);
      let best: (typeof placed)[number] | null = null;
      let bestScore = Infinity;
      // 辺から はなす 距離を 近い順に、seg の 上の 位置を ずらしながら、辺・点線・ほかの字に かさならない 所を さがす。
      // 高さ（flip）は 点線の 右・左の どちらにも 置ける。図形の 辺を またいだ 所（例: 高さの 字が ななめの 辺の 外）は、
      // その 辺の 長さに 見えるので 使わない（大きな 減点）
      const sides: number[] = l.dx
        ? l.flip
          ? [Math.sign(l.dx), -Math.sign(l.dx)]
          : [Math.sign(l.dx)]
        : [0];
      const tries2: [number, number, number][] = [];
      for (const gap of [0, 5, 10, 16, 24, 34])
        for (const side of sides)
          for (const t of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) tries2.push([gap, side, t]);
      for (const [gap, side, t] of tries2) {
        const px = X(seg[0][0] + (seg[1][0] - seg[0][0]) * t);
        const py = Y(seg[0][1] + (seg[1][1] - seg[0][1]) * t);
        let x = px;
        let y = py;
        let anchor = 'middle';
        if (side) {
          anchor = side < 0 ? 'end' : 'start';
          x = px + (side < 0 ? -(7 + gap) : 7 + gap);
        } else y = py + (l.dy! < 0 ? -(FS / 2 + 6 + gap) : FS / 2 + 6 + gap);
        const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
        const box: [number, number, number, number] = [x0, y - FS / 2, x0 + w, y + FS / 2];
        let score = 0;
        for (const pts of edges)
          for (const [ex, ey] of pts)
            if (ex > box[0] - 1 && ex < box[2] + 1 && ey > box[1] - 1 && ey < box[3] + 1) score++;
        if (polyEdges.some(([a, b]) => crosses([px, py], [(box[0] + box[2]) / 2, y], a, b)))
          score += 1000;
        // 決めた 向きを 先に（反対がわは、決めた 向きより はっきり よいときだけ）
        if (side && side !== Math.sign(l.dx ?? 0)) score += 3;
        for (const o of placed)
          if (
            box[0] < o.box[2] + 2 &&
            o.box[0] < box[2] + 2 &&
            box[1] < o.box[3] &&
            o.box[1] < box[3]
          )
            score += 100;
        if (score < bestScore) {
          bestScore = score;
          best = { x, y, anchor, text: l.text, box };
        }
        if (score === 0) break;
      }
      placed.push(best!);
    }
    const all: [number, number, number, number][] = [
      [0, 0, W * k, H * k],
      ...placed.map((p) => p.box),
    ];
    const x0 = Math.min(...all.map((q) => q[0])) - 4;
    const y0 = Math.min(...all.map((q) => q[1])) - 4;
    const x1 = Math.max(...all.map((q) => q[2])) + 4;
    const y1 = Math.max(...all.map((q) => q[3])) + 4;
    if (y1 - y0 > MAX_VB_H && tries < 12) {
      boxW *= 0.92;
      boxH *= 0.92;
      continue;
    }
    const sh = (x: number, y: number) => [r1(x - x0), r1(y - y0)] as P;
    const pt = (p: P) => sh(X(p[0]), Y(p[1])).join(',');
    let body = `<polygon points="${f.poly.map(pt).join(' ')}" fill="var(--sky)" fill-opacity="0.4" ${STROKE}/>`;
    const line = (a: P, b: P, attrs: string) => {
      const [ax, ay] = sh(X(a[0]), Y(a[1]));
      const [bx, by] = sh(X(b[0]), Y(b[1]));
      return `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" ${attrs}/>`;
    };
    for (const [a, b] of f.dotted ?? [])
      body += line(a, b, 'stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="2 4"');
    for (const [a, b] of f.dashed ?? [])
      body += line(a, b, 'stroke="var(--ink)" stroke-width="2" stroke-dasharray="6 4"');
    for (const p of f.right ?? []) {
      const [x, y] = sh(X(p[0]), Y(p[1]));
      body += `<polyline points="${x + 8},${y} ${x + 8},${y - 8} ${x},${y - 8}" fill="none" stroke="var(--ink)" stroke-width="1.5"/>`;
    }
    for (const p of placed) {
      const [x, y] = sh(p.x, p.y);
      body += svgText(x, y, p.text, FS, p.anchor);
    }
    const vbW = r1(x1 - x0);
    return svg(vbW, r1(y1 - y0), body, label, Math.ceil(((1.8 * vbW) / FS) * 2) / 2);
  }
}

const mid = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** 平行四辺形（底辺 b、高さ h、左の ななめの辺 s・ずれ o）。o > b なら 高さは外 */
function paraFig(b: number, o: number, h: number, s: number, showH = true): Figure {
  const A: P = [0, 0];
  const B: P = [b, 0];
  const C: P = [b + o, h];
  const D: P = [o, h];
  const outside = o > b;
  return draw(
    {
      poly: [A, B, C, D],
      dashed: showH ? [[D, [o, 0]]] : [],
      dotted: outside ? [[B, [o, 0]]] : [],
      right: showH ? [[o, 0]] : [],
      labels: [
        { at: mid(A, B), text: `${b}cm`, dy: 16 },
        { at: mid(A, D), text: `${s}cm`, dx: -24, seg: [A, D] },
        ...(showH
          ? [
              {
                at: [o, h / 2] as P,
                text: `${h}cm`,
                dx: 24,
                seg: [D, [o, 0]] as [P, P],
                flip: true,
              },
            ]
          : []),
      ],
    },
    outside ? '平行四辺形（高さが 外に ある）' : '平行四辺形',
  );
}

/** 三角形（底辺 b。頂点の 横の位置 x、ななめの辺 s は 左の辺（x ≤ b）か 右の辺（x > b）） */
function triFig(b: number, x: number, h: number, s: number): Figure {
  const A: P = [0, 0];
  const B: P = [b, 0];
  const C: P = [x, h];
  const outside = x > b;
  return draw(
    {
      poly: [A, B, C],
      dashed: [[C, [x, 0]]],
      dotted: outside ? [[B, [x, 0]]] : [],
      right: [[x, 0]],
      labels: [
        { at: mid(A, B), text: `${b}cm`, dy: 16 },
        outside
          ? { at: mid(B, C), text: `${s}cm`, dx: -26, seg: [B, C] }
          : { at: mid(A, C), text: `${s}cm`, dx: -24, seg: [A, C] },
        { at: [x, h / 2], text: `${h}cm`, dx: 24, seg: [C, [x, 0]], flip: true },
      ],
    },
    outside ? '三角形（高さが 外に ある）' : '三角形',
  );
}

/** 台形（下底 b、上底 a、左の ななめの辺 s・ずれ o1、右の ずれ o2） */
function trapFig(a: number, b: number, o1: number, o2: number, h: number, s: number): Figure {
  const A: P = [0, 0];
  const B: P = [b, 0];
  const C: P = [b - o2, h];
  const D: P = [o1, h];
  return draw(
    {
      poly: [A, B, C, D],
      dashed: [[D, [o1, 0]]],
      right: [[o1, 0]],
      labels: [
        { at: mid(A, B), text: `${b}cm`, dy: 16 },
        { at: mid(D, C), text: `${a}cm`, dy: -12 },
        { at: mid(A, D), text: `${s}cm`, dx: -24, seg: [A, D] },
        { at: [o1, h / 2], text: `${h}cm`, dx: 24, seg: [D, [o1, 0]], flip: true },
      ],
    },
    '台形',
  );
}

/** ひし形（対角線 d1 横、d2 たて） */
function rhombusFig(d1: number, d2: number): Figure {
  const L: P = [0, d2 / 2];
  const Bt: P = [d1 / 2, 0];
  const R: P = [d1, d2 / 2];
  const T: P = [d1 / 2, d2];
  return draw(
    {
      poly: [L, Bt, R, T],
      dashed: [
        [L, R],
        [Bt, T],
      ],
      labels: [
        // 対角線の はしに 置く（ひし形の 中に 置くと、平たい ひし形で 辺や 点線に かさなる）
        { at: R, text: `${d1}cm`, dx: 4 },
        { at: T, text: `${d2}cm`, dy: -4 },
      ],
    },
    'ひし形',
  );
}

/** 整数なら 数、そうでなければ null（誤答の例に使う） */
const intOr = (v: number) => (Number.isInteger(v) ? v : null);

/** 式を選ぶ（別例）。opts: [式, 誤概念]。正解が先頭 */
function formulaChoice(
  obj: Obj,
  level: number,
  key: string,
  shapeName: string,
  figure: Figure,
  right: string,
  wrongs: [string, string][],
  hints: string[],
  explain: string,
): ChoiceItem {
  return {
    engine: 'choice',
    id: `${obj}-shiki:${key}`,
    objective: obj,
    level,
    prompt: `この ${shapeName}の 面積を 求める 式は どれ？（点線は 高さや 対角線）`,
    figure,
    hints,
    explain,
    identity: `${obj}-shiki:${key}`,
    alt: true,
    options: [
      { label: right, correct: true },
      ...wrongs.slice(0, 3).map(([l, m]) => ({ label: l, misconception: m })),
    ],
  };
}

function para(level: number, rng: Rng, alt: boolean): Item {
  const form = alt ? rng.int(1, 2) : 0; // 1 = 高さが外, 2 = 式を選ぶ
  for (;;) {
    const [o, h, s] = pick(rng, TRIPLES);
    const b = form === 1 ? rng.int(2, o - 1) : rng.int(Math.max(2, o), 16);
    if (b < 2 || b === s) continue;
    const S = b * h;
    const key = `${b}:${o}:${h}`;
    const fig = paraFig(b, o, h, s);
    const hints = [
      '平行四辺形の 面積 ＝ 底辺 × 高さ',
      `底辺は ${b}cm。高さは 底辺に 垂直な 点線の 長さだよ。ななめの 辺の ${s}cmは 使わないよ。`,
      `${b} × ${h}を 計算しよう。`,
    ];
    const explain = `平行四辺形は 切って うつすと 長方形に なるので、面積 ＝ 底辺 × 高さ。${b} × ${h} ＝ ${S}で、${S}cm²です。`;
    if (form === 2)
      return formulaChoice(
        'para',
        level,
        key,
        '平行四辺形',
        fig,
        `${b} × ${h}`,
        [
          [`${b} × ${s}`, 'slant-height'],
          [`${b} × ${h} ÷ 2`, 'half-extra'],
          [`(${b} ＋ ${s}) × 2`, 'perimeter'],
        ],
        hints,
        explain,
      );
    const answers = [{ kind: 'int' as const, value: S }];
    const item: NumberItem = {
      engine: 'number',
      id: `para${form ? '-out' : ''}:${key}`,
      objective: 'para',
      level,
      prompt:
        form === 1
          ? 'この 平行四辺形の 面積は 何cm²ですか。高さが 図形の 外に あるよ。'
          : 'この 平行四辺形の 面積は 何cm²ですか。',
      figure: fig,
      hints:
        form === 1
          ? [
              '平行四辺形の 面積 ＝ 底辺 × 高さ',
              `底辺 ${b}cmを のばした 線までの 垂直な 長さが 高さだよ。高さは ${h}cm。`,
              `${b} × ${h}を 計算しよう。`,
            ]
          : hints,
      explain:
        form === 1
          ? `高さが 外に あっても、底辺 × 高さで 求められます。${b} × ${h} ＝ ${S}で、${S}cm²です。`
          : explain,
      identity: `para${form ? '-out' : ''}:${key}`,
      alt: form !== 0,
      fields: [{ unit: 'cm²', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [b * s, 'slant-height'],
        [intOr(S / 2), 'half-extra'],
        [2 * (b + s), 'perimeter'],
        [b + h, 'add-sides'],
      ]),
    };
    return item;
  }
}

function tri(level: number, rng: Rng, alt: boolean): Item {
  const form = alt ? rng.int(1, 2) : 0;
  for (;;) {
    const [o, h, s] = pick(rng, TRIPLES);
    const b = form === 1 ? rng.int(2, 12) : rng.int(o + 1, 18);
    if ((b * h) % 2 !== 0) continue;
    const x = form === 1 ? b + o : o;
    const S = (b * h) / 2;
    const key = `${b}:${x}:${h}`;
    const fig = triFig(b, x, h, s);
    const hints = [
      '三角形の 面積 ＝ 底辺 × 高さ ÷ 2',
      `底辺は ${b}cm、高さは ${h}cm。ななめの 辺の ${s}cmは 使わないよ。`,
      `${b} × ${h}を 計算して、2で わろう。`,
    ];
    const explain = `三角形は 同じ 形を 2つ 合わせると 平行四辺形に なるので、面積 ＝ 底辺 × 高さ ÷ 2。${b} × ${h} ÷ 2 ＝ ${S}で、${S}cm²です。`;
    if (form === 2)
      return formulaChoice(
        'tri',
        level,
        key,
        '三角形',
        fig,
        `${b} × ${h} ÷ 2`,
        [
          [`${b} × ${h}`, 'no-half'],
          [`${b} × ${s} ÷ 2`, 'slant-height'],
          [`${b} ＋ ${h} ÷ 2`, 'add-sides'],
        ],
        hints,
        explain,
      );
    const answers = [{ kind: 'int' as const, value: S }];
    const item: NumberItem = {
      engine: 'number',
      id: `tri${form ? '-out' : ''}:${key}`,
      objective: 'tri',
      level,
      prompt:
        form === 1
          ? 'この 三角形の 面積は 何cm²ですか。高さが 図形の 外に あるよ。'
          : 'この 三角形の 面積は 何cm²ですか。',
      figure: fig,
      hints:
        form === 1
          ? [
              '三角形の 面積 ＝ 底辺 × 高さ ÷ 2',
              `底辺 ${b}cmを のばした 線と、上の 頂点との 垂直な 長さが 高さ（${h}cm）だよ。`,
              `${b} × ${h}を 計算して、2で わろう。`,
            ]
          : hints,
      explain:
        form === 1
          ? `高さが 外に あっても、底辺 × 高さ ÷ 2で 求められます。${b} × ${h} ÷ 2 ＝ ${S}で、${S}cm²です。`
          : explain,
      identity: `tri${form ? '-out' : ''}:${key}`,
      alt: form !== 0,
      fields: [{ unit: 'cm²', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [b * h, 'no-half'],
        [intOr((b * s) / 2), 'slant-height'],
        [b * s, 'slant-height'],
        [b + h, 'add-sides'],
      ]),
    };
    return item;
  }
}

function trap(level: number, rng: Rng, alt: boolean): Item {
  const form = alt ? rng.int(1, 2) : 0; // 1 = ことばだけ, 2 = 式を選ぶ
  for (;;) {
    const [o1, h, s] = pick(rng, TRIPLES);
    const o2 = rng.int(0, 4);
    const b = rng.int(o1 + o2 + 2, Math.max(o1 + o2 + 2, 22));
    const a = b - o1 - o2;
    if (((a + b) * h) % 2 !== 0 || a === h || b === h) continue;
    const S = ((a + b) * h) / 2;
    const key = form === 1 ? `${a}:${b}:${h}` : `${a}:${b}:${o1}:${h}`;
    const fig = trapFig(a, b, o1, o2, h, s);
    const hints = [
      '台形の 面積 ＝ （上底 ＋ 下底）× 高さ ÷ 2',
      `上底は ${a}cm、下底は ${b}cm、高さは ${h}cm。（${a} ＋ ${b}）を 先に 計算するよ。`,
      `（${a} ＋ ${b}）× ${h}を 計算して、2で わろう。`,
    ];
    const explain = `台形は 同じ 形を さかさに 2つ 合わせると 平行四辺形（底辺は 上底 ＋ 下底）に なるので、面積 ＝ （上底 ＋ 下底）× 高さ ÷ 2。（${a} ＋ ${b}）× ${h} ÷ 2 ＝ ${S}で、${S}cm²です。`;
    if (form === 2)
      return formulaChoice(
        'trap',
        level,
        key,
        '台形',
        fig,
        `（${a} ＋ ${b}）× ${h} ÷ 2`,
        [
          [`（${a} ＋ ${b}）× ${h}`, 'no-half'],
          [`${b} × ${h} ÷ 2`, 'trap-one-base'],
          [`（${a} ＋ ${b}）× ${s} ÷ 2`, 'slant-height'],
        ],
        hints,
        explain,
      );
    const answers = [{ kind: 'int' as const, value: S }];
    const item: NumberItem = {
      engine: 'number',
      id: `trap${form ? '-word' : ''}:${key}`,
      objective: 'trap',
      level,
      prompt:
        form === 1
          ? `上底が ${a}cm、下底が ${b}cm、高さが ${h}cmの 台形の 面積は 何cm²ですか。`
          : 'この 台形の 面積は 何cm²ですか。',
      figure: form === 1 ? undefined : fig,
      hints,
      explain,
      identity: `trap${form ? '-word' : ''}:${key}`,
      alt: form !== 0,
      fields: [{ unit: 'cm²', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [(a + b) * h, 'no-half'],
        [intOr((b * h) / 2), 'trap-one-base'],
        [b * h, 'trap-one-base'],
        [form === 1 ? null : intOr(((a + b) * s) / 2), 'slant-height'],
        [a + b + h, 'add-sides'],
      ]),
    };
    return item;
  }
}

function rhombus(level: number, rng: Rng, alt: boolean): Item {
  const form = alt ? rng.int(1, 2) : 0;
  for (;;) {
    const d1 = rng.int(4, 16);
    const d2 = rng.int(4, 16);
    if (d1 === d2 || (d1 * d2) % 2 !== 0) continue;
    const S = (d1 * d2) / 2;
    const key = `${d1}:${d2}`;
    const fig = rhombusFig(d1, d2);
    const hints = [
      'ひし形の 面積 ＝ 対角線 × 対角線 ÷ 2',
      `対角線は ${d1}cmと ${d2}cm。ひし形は、対角線を 辺と する 長方形の 半分だよ。`,
      `${d1} × ${d2}を 計算して、2で わろう。`,
    ];
    const explain = `ひし形は、対角線の 長さを たて・横と する 長方形の ちょうど 半分なので、面積 ＝ 対角線 × 対角線 ÷ 2。${d1} × ${d2} ÷ 2 ＝ ${S}で、${S}cm²です。`;
    if (form === 2)
      return formulaChoice(
        'rhombus',
        level,
        key,
        'ひし形',
        fig,
        `${d1} × ${d2} ÷ 2`,
        [
          [`${d1} × ${d2}`, 'no-half'],
          [`${d1} ＋ ${d2}`, 'add-sides'],
          [`${d1} × ${d2} ÷ 4`, 'half-twice'],
        ],
        hints,
        explain,
      );
    const answers = [{ kind: 'int' as const, value: S }];
    const item: NumberItem = {
      engine: 'number',
      id: `rhombus${form ? '-word' : ''}:${key}`,
      objective: 'rhombus',
      level,
      prompt:
        form === 1
          ? `対角線の 長さが ${d1}cmと ${d2}cmの ひし形の 面積は 何cm²ですか。`
          : 'この ひし形の 面積は 何cm²ですか。（点線は 対角線）',
      figure: form === 1 ? undefined : fig,
      hints,
      explain,
      identity: `rhombus${form ? '-word' : ''}:${key}`,
      alt: form !== 0,
      fields: [{ unit: 'cm²', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [d1 * d2, 'no-half'],
        [d1 + d2, 'add-sides'],
        [intOr(S / 2), 'half-twice'],
      ]),
    };
    return item;
  }
}

/** 面積から 高さ（または底辺）。alt: □を 使った 式で */
function inverse(level: number, rng: Rng, alt: boolean): NumberItem {
  const shape = rng.next() < 0.5 ? 'tri' : 'para';
  const askH = rng.next() < 0.6;
  for (;;) {
    const b = rng.int(3, 16);
    const h = rng.int(3, 16);
    if (shape === 'tri' && (b * h) % 2 !== 0) continue;
    const S = shape === 'tri' ? (b * h) / 2 : b * h;
    const known = askH ? b : h;
    const ans = askH ? h : b;
    const name = shape === 'tri' ? '三角形' : '平行四辺形';
    const kn = askH ? '底辺' : '高さ';
    const un = askH ? '高さ' : '底辺';
    const half = shape === 'tri' ? ' ÷ 2' : '';
    const eq = askH ? `${b} × □${half} ＝ ${S}` : `□ × ${h}${half} ＝ ${S}`;
    const answers = [{ kind: 'int' as const, value: ans }];
    const key = `${shape}:${askH ? 'h' : 'b'}:${S}:${known}`;
    return {
      engine: 'number',
      id: `inverse${alt ? '-alt' : ''}:${key}`,
      objective: 'inverse',
      level,
      prompt: alt
        ? `${name}の 面積の 式です。□に あてはまる 数は いくつ？`
        : `面積が ${S}cm²で、${kn}が ${known}cmの ${name}が あります。${un}は 何cmですか。`,
      figure: alt ? expr(eq.replace('□', '{{}}')) : undefined,
      hints: [
        shape === 'tri' ? '三角形の 面積 ＝ 底辺 × 高さ ÷ 2' : '平行四辺形の 面積 ＝ 底辺 × 高さ',
        `わからない ${un}を □に して 式に すると、${eq}。`,
        shape === 'tri'
          ? `${kn} × □ ＝ ${S} × 2 ＝ ${S * 2}。${S * 2} ÷ ${known}を 計算しよう。`
          : `${S} ÷ ${known}を 計算しよう。`,
      ],
      explain:
        shape === 'tri'
          ? `${eq}。÷ 2の 前は ${S} × 2 ＝ ${S * 2}なので、□ ＝ ${S * 2} ÷ ${known} ＝ ${ans}。${un}は ${ans}cmです。`
          : `${eq}なので、□ ＝ ${S} ÷ ${known} ＝ ${ans}。${un}は ${ans}cmです。`,
      identity: `inverse${alt ? '-alt' : ''}:${key}`,
      alt,
      fields: [alt ? { answer: answers[0]! } : { unit: 'cm', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [
          shape === 'tri' ? intOr(S / known) : intOr(S / known / 2),
          shape === 'tri' ? 'inverse-half' : 'half-extra',
        ],
        [S * known, 'inverse-op'],
        [S - known, 'inverse-op'],
      ]),
    };
  }
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['para', 'tri'] },
  { objs: ['trap', 'rhombus', 'tri'] },
  { objs: ['inverse', 'para', 'trap'] },
  { objs: ['para', 'tri', 'trap', 'rhombus', 'inverse'] },
];

export function generateAreaFormulas(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'para':
      return para(level, rng, alt);
    case 'tri':
      return tri(level, rng, alt);
    case 'trap':
      return trap(level, rng, alt);
    case 'rhombus':
      return rhombus(level, rng, alt);
    case 'inverse':
      return inverse(level, rng, alt);
  }
}

export const areaFormulas: UnitSpec = finishUnit(
  {
    id: 'g5.math.area-formulas',
    title: '三角形・四角形の 面積',
    stage: 'g5',
    subject: 'math',
    domain: 'B-shape',
    kind: 'calc',
    priority: 'P1',
    status: 'ready',
    icon: 'mode-shapes',
    prereq: ['g4.math.area'],
    objectives: [
      { id: 'para', title: '平行四辺形の 面積（底辺 × 高さ）' },
      { id: 'tri', title: '三角形の 面積（底辺 × 高さ ÷ 2）' },
      { id: 'trap', title: '台形の 面積' },
      { id: 'rhombus', title: 'ひし形の 面積' },
      { id: 'inverse', title: '面積から 高さ・底辺を 求める' },
    ],
    misconceptions: [
      {
        id: 'slant-height',
        explain:
          'ななめの 辺を 高さと 考えたのかな。高さは、底辺に 垂直な 長さ（点線）だよ。ななめの 辺は 高さより 長く なるね。',
      },
      {
        id: 'no-half',
        explain:
          '÷ 2を わすれたのかな。三角形・台形・ひし形は、同じ 形を 2つ 合わせた 平行四辺形や 長方形の 半分だよ。',
      },
      {
        id: 'half-extra',
        explain:
          '平行四辺形は ÷ 2を しないよ。切って うつすと 長方形に なるので、底辺 × 高さ だけで 求められるよ。',
      },
      {
        id: 'trap-one-base',
        explain:
          '上底か 下底の かたほうだけを 使ったのかな。台形は （上底 ＋ 下底）× 高さ ÷ 2。2つの 辺を 合わせて 使うよ。',
      },
      {
        id: 'add-sides',
        explain:
          '長さを たしたのかな。面積は 広さなので、長さと 長さを かけて 求めるよ。公式を 思い出そう。',
      },
      {
        id: 'half-twice',
        explain: '2で 2回 わったのかな。ひし形の 面積は 対角線 × 対角線 ÷ 2。÷ 2は 1回だけだよ。',
      },
      {
        id: 'perimeter',
        explain: 'まわりの 長さを 求めたのかな。面積は 広さ（1cm²の いくつ分）だよ。',
      },
      {
        id: 'inverse-half',
        explain:
          '三角形は 底辺 × 高さ ÷ 2 ＝ 面積。だから 底辺 × 高さは 面積の 2倍だよ。面積 × 2を してから わろう。',
      },
      {
        id: 'inverse-op',
        explain: 'かけ算や ひき算を したのかな。底辺 × □ ＝ 面積 の □は、面積 ÷ 底辺で 求めるよ。',
      },
    ],
    levels: [
      { label: '平行四辺形・三角形', chance: 0.02 },
      { label: '台形・ひし形', chance: 0.02 },
      { label: '面積から 長さ', chance: 0.02 },
      { label: 'まとめ', chance: 0.02 },
    ],
    intro: [
      {
        text: '平行四辺形の 左の 三角形を 切って 右に うつすと、長方形に なります。たては 高さ、横は 底辺です。だから 平行四辺形の 面積 ＝ 底辺 × 高さ。',
        figure: paraFig(6, 3, 4, 5),
      },
      {
        text: '高さは、底辺に 垂直な 長さです。ななめの 辺の 長さでは ありません。',
        figure: paraFig(6, 3, 4, 5),
      },
      {
        text: '同じ 三角形を 2つ 合わせると 平行四辺形に なります。だから 三角形の 面積 ＝ 底辺 × 高さ ÷ 2。',
        figure: triFig(8, 3, 4, 5),
      },
      {
        text: '台形は 2つ 合わせると 底辺が （上底 ＋ 下底）の 平行四辺形。ひし形は 対角線を たて・横と する 長方形の 半分です。',
        figure: rhombusFig(8, 6),
      },
      {
        text: '高さが 図形の 外に ある ときも、底辺を のばした 線までの 垂直な 長さが 高さです。',
        figure: triFig(4, 7, 4, 5),
      },
    ],
    source: {
      kind: 'generator',
      generate: ({ level, rng, index }) => generateAreaFormulas(level, rng, index),
    },
    review: 'type',
    basis:
      '小学校学習指導要領（平成29年告示）算数 第5学年 B(3) 平面図形の面積（三角形・平行四辺形・ひし形・台形の求積）',
    revised: REVISED,
  },
  '思《おも》い出《だ》そう',
);
