/**
 * g5.math.angle-sum 三角形・四角形の角の和、多角形の角の和（curriculum-matrix 3.8）。
 * 切って並べる（導入）→ 三角形の のこりの角 → 二等辺三角形・直角三角形・外の角 → 四角形 → 多角形（三角形に分ける）。
 *
 * 角は 5° きざみの整数。図（svg）は、問題の角の大きさどおりに かく（polyFromAngles）。
 * 同一性キー: 問う形 × 角の組（三角形・四角形の角の組は順不同）。図つきの問題は別のキー。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import {
  expr,
  finishUnit,
  opts,
  pick,
  pickObj,
  r1,
  REVISED,
  STROKE,
  svg,
  svgText,
  wrongList,
} from './util';

type Obj = 'tri' | 'special' | 'quad' | 'poly';
type P = [number, number];

/**
 * 内角 angles（度、凸）の多角形の頂点（数学の座標。y は上向き）。
 * 辺0 は右向き。辺の長さは はじめの n−2 本を lens で決め、のこり2本は閉じるように解く。
 */
function polyFromAngles(angles: number[], lens: number[]): P[] | null {
  const n = angles.length;
  const dirs: number[] = [0];
  for (let i = 1; i < n; i++) dirs.push(dirs[i - 1]! + (180 - angles[i]!));
  const u = dirs.map((d) => [Math.cos((d * Math.PI) / 180), Math.sin((d * Math.PI) / 180)] as P);
  const pts: P[] = [[0, 0]];
  let x = 0;
  let y = 0;
  for (let i = 0; i < n - 2; i++) {
    x += lens[i]! * u[i]![0];
    y += lens[i]! * u[i]![1];
    pts.push([x, y]);
  }
  // L1 * a + L2 * b = −(x, y)
  const a = u[n - 2]!;
  const b = u[n - 1]!;
  const det = a[0] * b[1] - a[1] * b[0];
  if (Math.abs(det) < 1e-9) return null;
  const L1 = (-x * b[1] + y * b[0]) / det;
  const L2 = (-y * a[0] + x * a[1]) / det;
  if (!(L1 > 0.25) || !(L2 > 0.25)) return null;
  pts.push([x + L1 * a[0], y + L1 * a[1]]);
  return pts;
}

/** 角の しるし（文字）を 入れた 多角形の 図。labels[i] は 頂点 i の 角に 書く文字（'' なら 書かない） */
function polyFig(angles: number[], labels: string[], title: string): Figure {
  const n = angles.length;
  // 辺の 長さの 組を いくつも ためし、閉じる もののうち 辺の 長さの ばらつきが いちばん 小さい 形を 使う
  // （決まった 組だけだと 閉じない 四角形が 多く、角の 大きさの ちがう 正方形に なって いた）
  // 大きさは 自由なので 辺0 は 1。ほかは 0.2〜5 を 細かく（四角形で 閉じる 範囲が せまい 角の 組が ある）
  const steps = n > 4 ? 8 : 120;
  const VALS = Array.from({ length: steps + 1 }, (_, k) => 0.2 * 25 ** (k / steps));
  let cands: number[][] = [[1]];
  for (let i = 1; i < n - 2; i++) cands = cands.flatMap((c) => VALS.map((v) => [...c, v]));
  let pts: P[] | null = null;
  let best = 0;
  for (const lens of cands) {
    const q = polyFromAngles(angles, lens);
    if (!q) continue;
    const sides = q.map((p, i) => Math.hypot(q[(i + 1) % n]![0] - p[0], q[(i + 1) % n]![1] - p[1]));
    const score = Math.min(...sides) / Math.max(...sides);
    if (score > best) {
      best = score;
      pts = q;
    }
  }
  if (!pts)
    pts = Array.from(
      { length: n },
      (_, i) => [Math.cos((2 * Math.PI * i) / n), Math.sin((2 * Math.PI * i) / n)] as P,
    );
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxY = Math.max(...ys);
  const w = Math.max(...xs) - minX;
  const h = maxY - Math.min(...ys);
  const k = Math.min(220 / w, 150 / h);
  const sp = pts.map(([x, y]) => [r1(40 + (x - minX) * k), r1(30 + (maxY - y) * k)] as P);
  const cx = sp.reduce((s, p) => s + p[0], 0) / n;
  const cy = sp.reduce((s, p) => s + p[1], 0) / n;
  let body = `<polygon points="${sp.map((p) => p.join(',')).join(' ')}" fill="var(--sky)" fill-opacity="0.35" ${STROKE}/>`;
  sp.forEach(([x, y], i) => {
    const lab = labels[i];
    if (!lab) return;
    const dx = cx - x;
    const dy = cy - y;
    const d = Math.hypot(dx, dy) || 1;
    const off = lab.length > 2 ? 34 : 26;
    body += svgText(r1(x + (dx / d) * off), r1(y + (dy / d) * off), lab, 14);
  });
  return svg(r1(w * k + 80), r1(h * k + 60), body, title);
}

/** 5° きざみの 2つの 角（のこりの 角が min 以上）。定義域から 均等に（はずれは 引き直す） */
function twoAngles(rng: Rng, lo: number, hi: number, min: number): [number, number] {
  for (;;) {
    const a = rng.int(lo, hi) * 5;
    const b = rng.int(lo, hi) * 5;
    if (180 - a - b >= min) return [a, b];
  }
}

const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b).join('-');

/** 三角形の のこりの角（alt: 図で） */
function tri(level: number, rng: Rng, alt: boolean): NumberItem {
  const [a, b] = twoAngles(rng, 4, 26, 15);
  const c = 180 - a - b;
  const answers = [{ kind: 'int' as const, value: c }];
  return {
    engine: 'number',
    id: `tri${alt ? '-alt' : ''}:${a}-${b}`,
    objective: 'tri',
    level,
    prompt: alt
      ? '図の 三角形で、アの 角は 何度ですか。'
      : `三角形の 2つの 角が ${a}°と ${b}°です。のこりの 角は 何度ですか。`,
    figure: alt ? polyFig([a, b, c], [`${a}°`, `${b}°`, 'ア'], '三角形') : undefined,
    hints: [
      '三角形の 3つの 角の 大きさの 和は 何度だったかな。',
      '三角形の 3つの 角の 和は 180°。わかって いる 2つの 角を たそう。',
      `${a} ＋ ${b} ＝ ${a + b}。180から ひこう。`,
    ],
    explain: `三角形の 3つの 角の 和は 180°なので、180 − （${a} ＋ ${b}） ＝ ${c}。のこりの 角は ${c}°です。`,
    explainFigure: polyFig([a, b, c], [`${a}°`, `${b}°`, `${c}°`], '三角形'),
    identity: `tri${alt ? '-fig' : ''}:${sorted([a, b])}`,
    alt,
    fields: [{ label: '度', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [360 - a - b, 'use-360'],
      [180 - a, 'one-angle'],
      [180 - b, 'one-angle'],
      [a + b, 'add-only'],
    ]),
  };
}

/** 二等辺三角形・直角三角形・外の角（alt: 外の角） */
function special(level: number, rng: Rng, alt: boolean): NumberItem {
  if (alt) {
    const [a, b] = twoAngles(rng, 5, 22, 20);
    const c = 180 - a - b;
    const answers = [{ kind: 'int' as const, value: a + b }];
    return {
      engine: 'number',
      id: `ext:${a}-${b}`,
      objective: 'special',
      level,
      prompt: `三角形の 2つの 角が ${a}°と ${b}°です。のこりの 角の となりに できる 外がわの 角（辺を のばして できる 角）は 何度ですか。`,
      figure: extFig(a, b),
      hints: [
        '一直線の 角は 180°だよ。',
        `三角形の のこりの 角は 180 − （${a} ＋ ${b}）で 求められるね。`,
        '外がわの 角は、180°から 三角形の のこりの 角を ひいた 大きさだよ。',
      ],
      explain: `三角形の のこりの 角は ${c}°。外がわの 角は 180 − ${c} ＝ ${a + b}°です。（${a} ＋ ${b}と 同じに なります）`,
      identity: `ext:${sorted([a, b])}`,
      alt: true,
      fields: [{ label: '度', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [c, 'ext-inner'],
        [360 - a - b, 'use-360'],
      ]),
    };
  }
  const t = pick(rng, ['apex', 'base', 'right'] as const);
  if (t === 'apex') {
    const x = rng.int(2, 16) * 10;
    const ans = (180 - x) / 2;
    const answers = [{ kind: 'int' as const, value: ans }];
    return {
      engine: 'number',
      id: `special:apex:${x}`,
      objective: 'special',
      level,
      prompt: `二等辺三角形で、等しい 2つの 辺の 間の 角が ${x}°です。のこりの 1つの 角は 何度ですか。`,
      hints: [
        '二等辺三角形は、2つの 角の 大きさが 等しいよ。',
        `のこりの 2つの 角を あわせると 180 − ${x}。`,
        `${180 - x}°を 等しい 2つの 角に 分けよう。`,
      ],
      explain: `のこりの 2つの 角の 和は 180 − ${x} ＝ ${180 - x}°。2つは 等しいので ${180 - x} ÷ 2 ＝ ${ans}°です。`,
      identity: `special:apex:${x}`,
      alt: false,
      fields: [{ label: '度', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [180 - x, 'isos-half'],
        [x, 'isos-pair'],
        [(360 - x) / 2, 'use-360'],
      ]),
    };
  }
  if (t === 'base') {
    const y = rng.int(5, 17) * 5;
    const ans = 180 - 2 * y;
    const answers = [{ kind: 'int' as const, value: ans }];
    return {
      engine: 'number',
      id: `special:base:${y}`,
      objective: 'special',
      level,
      prompt: `二等辺三角形で、底辺の 両はしの 角の 1つが ${y}°です。のこりの 角（等しい 2つの 辺の 間の 角）は 何度ですか。`,
      hints: [
        '二等辺三角形は、底辺の 両はしの 角が 等しいよ。',
        `もう1つの 底辺の 角も ${y}°。`,
        `180から ${y}°を 2つ分 ひこう。`,
      ],
      explain: `底辺の 両はしの 角は どちらも ${y}°。180 − ${y} × 2 ＝ ${ans}°です。`,
      identity: `special:base:${y}`,
      alt: false,
      fields: [{ label: '度', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        // 底辺の 角を 1つだけ ひいた（180 − y）／ 与えられた 角を 等しい 2辺の 間の 角と 取りちがえた（(180 − y) ÷ 2）
        [180 - y, 'one-angle'],
        [(180 - y) / 2, 'isos-pair'],
        [360 - 2 * y, 'use-360'],
      ]),
    };
  }
  const a = rng.int(3, 16) * 5;
  const ans = 90 - a;
  const answers = [{ kind: 'int' as const, value: ans }];
  return {
    engine: 'number',
    id: `special:right:${a}`,
    objective: 'special',
    level,
    prompt: `直角三角形で、直角では ない 角の 1つが ${a}°です。もう1つの 直角では ない 角は 何度ですか。`,
    hints: [
      '直角は 何度だったかな。',
      `三角形の 角の 和は 180°。そのうち 1つは 90°、1つは ${a}°。`,
      `180 − （90 ＋ ${a}）を 計算しよう。`,
    ],
    explain: `180 − （90 ＋ ${a}） ＝ ${ans}。もう1つの 角は ${ans}°です。`,
    identity: `special:right:${a}`,
    alt: false,
    fields: [{ label: '度', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [180 - a, 'right-90'],
      [270 - a, 'use-360'],
    ]),
  };
}

/** 外の角の図（三角形の 底辺を 右へ のばす） */
function extFig(a: number, b: number): Figure {
  const c = 180 - a - b;
  // 頂点0（左下）の角 a、頂点1（右下）の角 c、頂点2（上）の角 b。外の角は 頂点1 の 右
  const pts = polyFromAngles([a, c, b], [1]) ?? [
    [0, 0],
    [1, 0],
    [0.5, 0.8],
  ];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxY = Math.max(...ys);
  const w = Math.max(...xs, pts[1]![0] + 0.5) - minX;
  const h = maxY - Math.min(...ys);
  const k = Math.min(220 / w, 140 / h);
  const sp = pts.map(([x, y]) => [r1(30 + (x - minX) * k), r1(30 + (maxY - y) * k)] as P);
  const ext: P = [r1(sp[1]![0] + 0.5 * k), sp[1]![1]];
  let body = `<polygon points="${sp.map((p) => p.join(',')).join(' ')}" fill="var(--sky)" fill-opacity="0.35" ${STROKE}/>`;
  body += `<line x1="${sp[1]![0]}" y1="${sp[1]![1]}" x2="${ext[0]}" y2="${ext[1]}" ${STROKE} stroke-dasharray="6 5"/>`;
  body += svgText(sp[0]![0] + 28, sp[0]![1] - 12, `${a}°`, 14);
  body += svgText(sp[2]![0], sp[2]![1] + 26, `${b}°`, 14);
  body += svgText(sp[1]![0] + 22, sp[1]![1] - 14, 'ア', 15);
  return svg(r1(ext[0] + 30), r1(h * k + 60), body, '三角形と 外がわの 角');
}

/** 四角形の のこりの角（alt: 図で） */
function quad(level: number, rng: Rng, alt: boolean): NumberItem {
  const [a, b, c] = ((): [number, number, number] => {
    for (;;) {
      const t: [number, number, number] = [
        rng.int(8, 30) * 5,
        rng.int(8, 30) * 5,
        rng.int(8, 30) * 5,
      ];
      const rest = 360 - t[0] - t[1] - t[2];
      if (rest >= 40 && rest <= 170) return t;
    }
  })();
  const d = 360 - a - b - c;
  const answers = [{ kind: 'int' as const, value: d }];
  return {
    engine: 'number',
    id: `quad${alt ? '-alt' : ''}:${a}-${b}-${c}`,
    objective: 'quad',
    level,
    prompt: alt
      ? '図の 四角形で、アの 角は 何度ですか。'
      : `四角形の 3つの 角が ${a}°、${b}°、${c}°です。のこりの 角は 何度ですか。`,
    figure: alt ? polyFig([a, b, c, d], [`${a}°`, `${b}°`, `${c}°`, 'ア'], '四角形') : undefined,
    hints: [
      '四角形は、対角線で 2つの 三角形に 分けられるよ。',
      '三角形 2つ分なので、四角形の 4つの 角の 和は 180 × 2 ＝ 360°。',
      `${a} ＋ ${b} ＋ ${c} ＝ ${a + b + c}。360から ひこう。`,
    ],
    explain: `四角形の 4つの 角の 和は 360°なので、360 − ${a + b + c} ＝ ${d}。のこりの 角は ${d}°です。`,
    explainFigure: polyFig([a, b, c, d], [`${a}°`, `${b}°`, `${c}°`, `${d}°`], '四角形'),
    identity: `quad${alt ? '-fig' : ''}:${sorted([a, b, c])}`,
    alt,
    fields: [{ label: '度', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [180 - a - b - c > 0 ? 180 - a - b - c : null, 'use-180'],
      [a + b + c, 'add-only'],
      [360 - a, 'one-angle'],
    ]),
  };
}

const NAME: Record<number, string> = {
  5: '五角形',
  6: '六角形',
  7: '七角形',
  8: '八角形',
  9: '九角形',
  10: '十角形',
  12: '十二角形',
};

/** 多角形の角の和・正多角形の1つの角（alt: 三角形に 分けた 数・図） */
function poly(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const n = pick(rng, [5, 6, 7, 8]);
    // 1つの 頂点から 対角線を ひいた 図
    const R = 70;
    const pts = Array.from({ length: n }, (_, i) => {
      const t = -Math.PI / 2 + (2 * Math.PI * i) / n;
      return [r1(110 + R * Math.cos(t)), r1(95 + R * Math.sin(t))] as P;
    });
    let body = `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="var(--sky)" fill-opacity="0.35" ${STROKE}/>`;
    for (let i = 2; i < n - 1; i++)
      body += `<line x1="${pts[0]![0]}" y1="${pts[0]![1]}" x2="${pts[i]![0]}" y2="${pts[i]![1]}" ${STROKE} stroke-dasharray="6 5"/>`;
    const item: ChoiceItem = {
      engine: 'choice',
      id: `poly-alt:${n}`,
      objective: 'poly',
      level,
      prompt: `${NAME[n]}の 1つの 頂点から 対角線を ひいて、三角形に 分けました。${NAME[n]}の 角の 大きさの 和を 求める 式は どれ？`,
      figure: svg(220, 190, body, `${NAME[n]}を 三角形に 分けた 図`),
      hints: [
        'いくつの 三角形に 分かれたかを 数えよう。',
        `三角形の 数は、頂点の 数 ${n}より 2 少ないよ。`,
        '三角形 1つの 角の 和は 180°。それが いくつ分かな。',
      ],
      explain: `${NAME[n]}は 三角形 ${n - 2}こに 分けられるので、角の 和は 180 × ${n - 2} ＝ ${(n - 2) * 180}°です。`,
      identity: `poly-split:${n}`,
      alt: true,
      options: opts(`180 × ${n - 2}`, [
        [`180 × ${n}`, 'n-times-180'],
        [`180 × ${n - 1}`, 'tri-count'],
        [`360 × ${n - 2}`, 'use-360'],
      ]),
    };
    return item;
  }
  if (rng.next() < 0.5) {
    const n = pick(rng, [5, 6, 7, 8, 9, 10, 12]);
    const ans = (n - 2) * 180;
    const answers = [{ kind: 'int' as const, value: ans }];
    const item: NumberItem = {
      engine: 'number',
      id: `poly:sum:${n}`,
      objective: 'poly',
      level,
      prompt: `${NAME[n]}の 角の 大きさの 和は 何度ですか。`,
      hints: [
        '1つの 頂点から 対角線を ひいて、三角形に 分けて 考えよう。',
        `${NAME[n]}は 三角形 何こに 分けられるかな。頂点の 数より 2 少ないよ。`,
        `180 × ${n - 2}を 計算しよう。`,
      ],
      explain: `${NAME[n]}は 三角形 ${n - 2}こに 分けられるので、180 × ${n - 2} ＝ ${ans}°です。`,
      identity: `poly:sum:${n}`,
      alt: false,
      fields: [{ label: '度', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [n * 180, 'n-times-180'],
        [(n - 1) * 180, 'tri-count'],
        [360, 'use-360'],
      ]),
    };
    return item;
  }
  const n = pick(rng, [5, 6, 8, 9, 10, 12]);
  const ans = ((n - 2) * 180) / n;
  const answers = [{ kind: 'int' as const, value: ans }];
  const item: NumberItem = {
    engine: 'number',
    id: `poly:regular:${n}`,
    objective: 'poly',
    level,
    prompt: `正${NAME[n]}の 1つの 角の 大きさは 何度ですか。`,
    figure: expr(`180 × ${n - 2} ÷ ${n} ＝ {{}}`),
    hints: [
      '正多角形は、角の 大きさが みんな 等しいよ。',
      `まず ${NAME[n]}の 角の 和を 求めよう。180 × ${n - 2} ＝ ${(n - 2) * 180}。`,
      `${(n - 2) * 180}°を ${n}つの 等しい 角に 分けよう。`,
    ],
    explain: `${NAME[n]}の 角の 和は ${(n - 2) * 180}°。正${NAME[n]}は ${n}つの 角が 等しいので、${(n - 2) * 180} ÷ ${n} ＝ ${ans}°です。`,
    identity: `poly:regular:${n}`,
    alt: false,
    fields: [{ label: '度', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [360 / n, 'center-angle'],
      [(n - 2) * 180, 'sum-no-divide'],
      // 180 × n ÷ n（三角形を 頂点の 数だけ 数えた）
      [180, 'n-times-180'],
    ]),
  };
  return item;
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['tri', 'special'] },
  { objs: ['quad', 'tri', 'special'] },
  { objs: ['poly', 'quad', 'special', 'tri'] },
];

export function generateAngleSum(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'tri':
      return tri(level, rng, alt);
    case 'special':
      return special(level, rng, alt);
    case 'quad':
      return quad(level, rng, alt);
    case 'poly':
      return poly(level, rng, alt);
  }
}

export const angleSum: UnitSpec = finishUnit(
  {
    id: 'g5.math.angle-sum',
    title: '三角形・四角形の 角の 大きさの 和',
    stage: 'g5',
    subject: 'math',
    domain: 'B-shape',
    kind: 'concept',
    priority: 'P1',
    status: 'ready',
    icon: 'mode-shapes',
    prereq: ['g4.math.angle'],
    objectives: [
      { id: 'tri', title: '三角形の 角の 和（180°）' },
      { id: 'special', title: '二等辺三角形・直角三角形・外がわの 角' },
      { id: 'quad', title: '四角形の 角の 和（360°）' },
      { id: 'poly', title: '多角形の 角の 和' },
    ],
    misconceptions: [
      {
        id: 'use-360',
        explain: '四角形の 360°を 使ったのかな。三角形の 3つの 角の 和は 180°だよ。',
      },
      {
        id: 'use-180',
        explain:
          '三角形の 180°を 使ったのかな。四角形は 三角形 2つ分なので、4つの 角の 和は 360°だよ。',
      },
      {
        id: 'one-angle',
        explain:
          'わかって いる 角の 1つしか ひかなかったのかな。わかって いる 角を ぜんぶ たしてから、和から ひこう。',
      },
      {
        id: 'add-only',
        explain:
          'わかって いる 角を たしただけで 止まったのかな。その 和を、角の 和（180°や 360°）から ひこう。',
      },
      {
        id: 'isos-half',
        explain:
          '2つの 等しい 角の 和を 出したところで 止まったのかな。2つの 角は 等しいので、2で わろう。',
      },
      {
        id: 'isos-pair',
        explain:
          '等しい 角が どれかを 取りちがえたのかな。二等辺三角形で 等しいのは、底辺の 両はしの 2つの 角だよ。',
      },
      {
        id: 'right-90',
        explain: '直角の 90°を 入れわすれたのかな。直角三角形には 90°の 角が 1つ あるよ。',
      },
      {
        id: 'ext-inner',
        explain:
          '三角形の 中の 角を 答えたのかな。外がわの 角は、一直線の 180°から 中の 角を ひいた 大きさだよ。',
      },
      {
        id: 'n-times-180',
        explain:
          '頂点の 数だけ 180°を かけたのかな。1つの 頂点から 対角線を ひくと、三角形の 数は 頂点の 数より 2 少ないよ。',
      },
      {
        id: 'tri-count',
        explain:
          '三角形の 数を 1つ 多く 数えたのかな。図に かいて、三角形が いくつ できるか 数えよう。',
      },
      {
        id: 'sum-no-divide',
        explain:
          '角の 和を 求めた ところで 止まったのかな。正多角形は 角が みんな 等しいので、角の 和を 頂点の 数で わろう。',
      },
      {
        id: 'center-angle',
        explain:
          '円の 中心の まわりの 角（360° ÷ 頂点の 数）を 求めたのかな。正多角形の 1つの 角は、角の 和 ÷ 頂点の 数 だよ。',
      },
    ],
    levels: [
      { label: '三角形', chance: 0.02 },
      { label: '四角形', chance: 0.02 },
      { label: '多角形・まとめ', chance: 0.02 },
    ],
    intro: [
      {
        text: '三角形の 3つの 角を 切り取って ならべると、一直線に なります。一直線の 角は 180°なので、三角形の 3つの 角の 和は 180°です。',
        figure: polyFig([50, 60, 70], ['50°', '60°', '70°'], '三角形'),
      },
      {
        text: '四角形は、対角線で 三角形 2つに 分けられます。だから 4つの 角の 和は 180 × 2 ＝ 360°です。',
        figure: polyFig([80, 100, 70, 110], ['80°', '100°', '70°', '110°'], '四角形'),
      },
      {
        text: '五角形は 三角形 3つに 分けられるので、角の 和は 180 × 3 ＝ 540°。多角形の 角の 和は、180 × （頂点の 数 − 2）で 求められます。',
        figure: expr('180 × （5 − 2） ＝ 540'),
      },
    ],
    source: {
      kind: 'generator',
      generate: ({ level, rng, index }) => generateAngleSum(level, rng, index),
    },
    review: 'objective',
    basis:
      '小学校学習指導要領（平成29年告示）算数 第5学年 B(1) 平面図形の性質（三角形・四角形の内角の和、多角形）',
    revised: REVISED,
  },
  '出《だ》 間《あいだ》 度《ど》 十二角形《じゅうにかくけい》 一直線《いっちょくせん》 外《そと》がわ 両《りょう》はし 等《ひと》しい 中《なか》 切《き》り取《と》って 正《せい》 頂点《ちょうてん》',
);
