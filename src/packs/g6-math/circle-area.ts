/**
 * g6.math.circle-area 円の面積（円周率 3.14）（curriculum-matrix 3.9）。
 * 円を切って並べる → 公式（半径 × 半径 × 3.14）→ 半円・おうぎ形・組み合わせた形。
 *
 * 面積は 100分の1 の整数で計算する（浮動小数点の誤差を避ける）。答えは小数（整数になるときは整数）。
 * 同一性キー: 形 × 長さ。別例は図だけで示す問題（':fig'）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { dec, decAns, finishUnit, opts, pick, pickObj, REVISED, STROKE, svg, svgText, wrongList } from './util';

type Obj = 'formula' | 'radius' | 'diam' | 'part' | 'combo';

/** 半径 r の 円の 面積（100分の1 の単位） */
const area100 = (r: number) => r * r * 314;
const A = (h: number) => dec(h, 2);

// ---- 図 ----
const DASH = 'stroke="var(--ink)" stroke-width="2" stroke-dasharray="5 4"';
function circleFig(label: string, kind: 'r' | 'd'): Figure {
  let body = `<circle cx="110" cy="100" r="80" fill="var(--sky)" ${STROKE}/><circle cx="110" cy="100" r="3.5" fill="var(--ink)"/>`;
  if (kind === 'r') body += `<line x1="110" y1="100" x2="190" y2="100" ${STROKE}/>` + svgText(150, 86, label, 16);
  else body += `<line x1="30" y1="100" x2="190" y2="100" ${STROKE}/>` + svgText(110, 86, label, 16);
  return svg(220, 200, body, kind === 'r' ? `半径が ${label}の 円` : `直径が ${label}の 円`);
}
function halfFig(label: string): Figure {
  const body =
    `<path d="M30 140 A80 80 0 0 1 190 140 Z" fill="var(--sky)" ${STROKE}/>` +
    `<line x1="110" y1="140" x2="190" y2="140" ${STROKE}/>` +
    svgText(150, 156, label, 16);
  return svg(220, 170, body, `半径が ${label}の 半円`);
}
function quarterFig(label: string): Figure {
  const body =
    `<path d="M40 180 L40 30 A150 150 0 0 1 190 180 Z" fill="var(--sky)" ${STROKE}/>` + svgText(115, 196, label, 16);
  return svg(220, 210, body, `半径が ${label}の 円を 4等分した 形`);
}
function ringFig(R: number, r: number): Figure {
  const k = 80 / R;
  const body =
    `<circle cx="110" cy="100" r="80" fill="var(--sky)" ${STROKE}/>` +
    `<circle cx="110" cy="100" r="${(r * k).toFixed(1)}" fill="var(--white)" ${STROKE}/>` +
    `<line x1="110" y1="100" x2="190" y2="100" ${DASH}/>` +
    `<line x1="110" y1="100" x2="110" y2="${(100 - r * k).toFixed(1)}" ${DASH}/>` +
    svgText(160, 112, `${R}cm`, 15) +
    svgText(124, 100 - (r * k) / 2, `${r}cm`, 14, 'start');
  return svg(220, 200, body, `半径 ${R}cmの 円から、同じ 中心の 半径 ${r}cmの 円を 切り取った 形`);
}
function squareCircleFig(r: number): Figure {
  const body =
    `<rect x="30" y="20" width="160" height="160" fill="var(--sky)" ${STROKE}/>` +
    `<circle cx="110" cy="100" r="80" fill="var(--white)" ${STROKE}/>` +
    svgText(110, 196, `${2 * r}cm`, 15);
  return svg(220, 210, body, `1辺 ${2 * r}cmの 正方形から、中に ぴったり 入る 円を 切り取った 形`);
}
function squareQuarterFig(a: number): Figure {
  const body =
    `<rect x="30" y="20" width="160" height="160" fill="var(--sky)" ${STROKE}/>` +
    `<path d="M30 180 L30 20 A160 160 0 0 1 190 180 Z" fill="var(--white)" ${STROKE}/>` +
    svgText(110, 196, `${a}cm`, 15);
  return svg(220, 210, body, `1辺 ${a}cmの 正方形から、半径 ${a}cmの 円を 4等分した 形を 切り取った 残り`);
}
function leafFig(a: number): Figure {
  const body =
    `<rect x="30" y="20" width="160" height="160" fill="var(--white)" ${STROKE}/>` +
    `<path d="M30 180 A160 160 0 0 1 190 20 A160 160 0 0 1 30 180 Z" fill="var(--sky)" ${STROKE}/>` +
    svgText(110, 196, `${a}cm`, 15);
  return svg(220, 210, body, `1辺 ${a}cmの 正方形の 中に、半径 ${a}cmの 円を 4等分した 形を 2つ 重ねて できた 葉の 形`);
}
function rearrangeFig(pieces: number): Figure {
  const n = pieces / 2;
  const w = 200 / n;
  let d = `M20 130`;
  for (let i = 0; i < n; i++) {
    const x = 20 + i * w;
    d += ` L${(x + w / 2).toFixed(1)} 50 L${(x + w).toFixed(1)} 130`;
  }
  const body =
    `<path d="${d} Z" fill="var(--sky)" ${STROKE}/>` +
    `<line x1="20" y1="130" x2="220" y2="130" stroke="var(--ink)" stroke-width="3"/>` +
    `<line x1="232" y1="50" x2="232" y2="130" ${DASH}/>`;
  return svg(250, 150, body, `円を ${pieces}等分して、たがいちがいに 並べた 形`);
}

function numItem(
  obj: Obj,
  level: number,
  alt: boolean,
  key: string,
  prompt: string,
  figure: Figure | undefined,
  ans100: number,
  hints: [string, string, string],
  explain: string,
  wrongs: [number | null, string][],
  label = 'cm²',
): NumberItem {
  const answer = decAns(ans100, 2);
  return {
    engine: 'number',
    id: `${obj}${alt ? '-alt' : ''}:${key}`,
    objective: obj,
    level,
    prompt,
    figure,
    hints,
    explain,
    identity: `${obj}:${key}${alt ? ':fig' : ''}`,
    alt,
    fields: [{ label, answer }],
    keys: ['decimal'],
    wrongAnswers: wrongList(
      [answer],
      wrongs.map(([v, m]) => [v === null ? null : A(v), m] as [string | null, string]),
    ),
  };
}

const RS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 20, 30];

function radiusItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const r = pick(rng, RS);
  return numItem(
    'radius',
    level,
    alt,
    `${r}`,
    alt ? 'この 円の 面積は 何cm²ですか。円周率は 3.14と します。' : `半径 ${r}cmの 円の 面積は 何cm²ですか。円周率は 3.14と します。`,
    alt ? circleFig(`${r}cm`, 'r') : undefined,
    area100(r),
    ['円の 面積 ＝ 半径 × 半径 × 円周率 だね。', `${r} × ${r} × 3.14`, `${r} × ${r} ＝ ${r * r}。${r * r} × 3.14を 計算しよう。`],
    `${r} × ${r} × 3.14 ＝ ${A(area100(r))}（cm²）。`,
    [
      [r * 2 * 314, 'circumference'],
      [r * 314, 'no-square'],
      [4 * area100(r), 'diam-sq'],
    ],
  );
}

const DS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 30, 40];
function diamItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const d = pick(rng, DS);
  const r = d / 2;
  return numItem(
    'diam',
    level,
    alt,
    `${d}`,
    alt ? 'この 円の 面積は 何cm²ですか。円周率は 3.14と します。' : `直径 ${d}cmの 円の 面積は 何cm²ですか。円周率は 3.14と します。`,
    alt ? circleFig(`${d}cm`, 'd') : undefined,
    area100(r),
    ['公式で 使うのは 直径かな、半径かな。', `半径は ${d} ÷ 2 ＝ ${r}cm。`, `${r} × ${r} × 3.14を 計算しよう。`],
    `半径は ${d} ÷ 2 ＝ ${r}cm。${r} × ${r} × 3.14 ＝ ${A(area100(r))}（cm²）。`,
    [
      [d * d * 314, 'diam-sq'],
      [d * 314, 'circumference'],
      [r * 314, 'no-square'],
    ],
  );
}

function partItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const half = rng.next() < 0.5;
  const r = half ? pick(rng, RS) : pick(rng, [2, 4, 6, 8, 10, 20]);
  const div = half ? 2 : 4;
  const ans = area100(r) / div;
  const name = half ? '半円' : '円を 4等分した 形（おうぎ形）';
  return numItem(
    'part',
    level,
    alt,
    `${half ? 'half' : 'quarter'}:${r}`,
    alt
      ? `この 形の 面積は 何cm²ですか。円周率は 3.14と します。`
      : `半径 ${r}cmの ${half ? '円の 半分の 形（半円）' : '円を 4等分した 形'}の 面積は 何cm²ですか。円周率は 3.14と します。`,
    alt ? (half ? halfFig(`${r}cm`) : quarterFig(`${r}cm`)) : undefined,
    ans,
    [
      `${name}は、円の 面積の 何分の1かな。`,
      `もとの 円の 面積は ${r} × ${r} × 3.14 ＝ ${A(area100(r))}cm²。`,
      `${A(area100(r))}を ${div}で わろう。`,
    ],
    `${r} × ${r} × 3.14 ÷ ${div} ＝ ${A(ans)}（cm²）。${half ? '半円は 円の 半分' : '円の [[1/4]]'}です。`,
    [
      [area100(r), 'forget-part'],
      [(r * 2 * 314) / div, 'circumference'],
      [half ? area100(r) / 4 : area100(r) / 2, 'forget-part'],
    ],
  );
}

function comboItem(level: number, rng: Rng, alt: boolean): NumberItem {
  if (!alt) {
    if (rng.next() < 0.5) {
      const R = rng.int(3, 10);
      const r = rng.int(1, R - 1);
      const ans = area100(R) - area100(r);
      return numItem(
        'combo',
        level,
        false,
        `ring:${R}:${r}`,
        `図のように、半径 ${R}cmの 円から、同じ 中心の 半径 ${r}cmの 円を 切り取りました。色の ついた 部分の 面積は 何cm²ですか。円周率は 3.14と します。`,
        ringFig(R, r),
        ans,
        ['大きい 円の 面積から、小さい 円の 面積を ひこう。', `大きい 円は ${R} × ${R} × 3.14、小さい 円は ${r} × ${r} × 3.14。`, `(${R} × ${R} − ${r} × ${r}) × 3.14 と まとめて 計算しても よいよ。`],
        `${R} × ${R} × 3.14 − ${r} × ${r} × 3.14 ＝ (${R * R} − ${r * r}) × 3.14 ＝ ${A(ans)}（cm²）。`,
        [
          [(R - r) * (R - r) * 314, 'ring-sub'],
          [area100(R), 'forget-part'],
        ],
      );
    }
    const r = rng.int(1, 10);
    const ans = 4 * r * r * 100 - area100(r);
    return numItem(
      'combo',
      level,
      false,
      `sqcircle:${r}`,
      `図のように、1辺 ${2 * r}cmの 正方形から、中に ぴったり 入る 円を 切り取りました。色の ついた 部分の 面積は 何cm²ですか。円周率は 3.14と します。`,
      squareCircleFig(r),
      ans,
      ['正方形の 面積から、円の 面積を ひこう。', `円の 直径は 正方形の 1辺と 同じ ${2 * r}cm。半径は ${r}cm。`, `${2 * r} × ${2 * r} − ${r} × ${r} × 3.14`],
      `${2 * r} × ${2 * r} − ${r} × ${r} × 3.14 ＝ ${4 * r * r} − ${A(area100(r))} ＝ ${A(ans)}（cm²）。`,
      [
        [4 * r * r * 100, 'forget-part'],
        [area100(r), 'forget-part'],
      ],
    );
  }
  const a = pick(rng, [2, 4, 6, 8, 10, 12, 20]);
  const quarter = area100(a) / 4;
  if (rng.next() < 0.5) {
    const ans = a * a * 100 - quarter;
    return numItem(
      'combo',
      level,
      true,
      `sqquarter:${a}`,
      '色の ついた 部分の 面積は 何cm²ですか。円周率は 3.14と します。',
      squareQuarterFig(a),
      ans,
      ['正方形から、円を 4等分した 形を ひいた 残りだね。', `円を 4等分した 形は ${a} × ${a} × 3.14 ÷ 4。`, `${a} × ${a} − ${A(quarter)}を 計算しよう。`],
      `${a} × ${a} − ${a} × ${a} × 3.14 ÷ 4 ＝ ${a * a} − ${A(quarter)} ＝ ${A(ans)}（cm²）。`,
      [
        [quarter, 'forget-part'],
        [a * a * 100 - area100(a), 'forget-part'],
      ],
    );
  }
  const ans = (quarter - (a * a * 100) / 2) * 2;
  return numItem(
    'combo',
    level,
    true,
    `leaf:${a}`,
    '色の ついた 葉の 形の 部分の 面積は 何cm²ですか。円周率は 3.14と します。',
    leafFig(a),
    ans,
    [
      '葉の 形を 対角線で 2つに 分けて 考えよう。',
      `半分は「円を 4等分した 形 − 直角二等辺三角形」。${A(quarter)} − ${a} × ${a} ÷ 2`,
      `半分の 面積を 2倍に しよう。`,
    ],
    `(${a} × ${a} × 3.14 ÷ 4 − ${a} × ${a} ÷ 2) × 2 ＝ (${A(quarter)} − ${(a * a) / 2}) × 2 ＝ ${A(ans)}（cm²）。`,
    [
      [quarter, 'forget-part'],
      [quarter - (a * a * 100) / 2, 'forget-part'],
    ],
  );
}

function formulaItem(level: number, rng: Rng, alt: boolean): Item {
  const pieces = pick(rng, [8, 12, 16, 24]);
  if (!alt) {
    const r = pick(rng, RS);
    const ans = r * 314;
    return numItem(
      'formula',
      level,
      false,
      `${r}:${pieces}`,
      `半径 ${r}cmの 円を ${pieces}等分して、図のように 並べかえると 長方形に 近い 形に なります。この 形の 横の 長さ（太い 線）は 何cmですか。円周率は 3.14と します。`,
      rearrangeFig(pieces),
      ans,
      ['太い 線は、円周の どれだけに あたるかな。', `円周の 半分だね。円周は ${r * 2} × 3.14。`, `${r * 2} × 3.14 ÷ 2 ＝ ${r} × 3.14`],
      `横の 長さは 円周の 半分で、${r * 2} × 3.14 ÷ 2 ＝ ${A(ans)}（cm）。縦《たて》は 半径なので、面積は 半径 × 円周の 半分 ＝ 半径 × 半径 × 3.14 に なります。`,
      [
        [r * 2 * 314, 'half-circ'],
        [r * r * 314, 'half-circ'],
      ],
      'cm',
    );
  }
  const ask = pick(rng, ['tate', 'yoko', 'formula'] as const);
  const base = `円を ${pieces}等分して、図のように 並べかえると 長方形に 近い 形に なります。`;
  const qs = {
    tate: {
      prompt: `${base}この 形の 縦《たて》の 長さ（点線）は、もとの 円の 何に あたりますか。`,
      correct: '半径',
      wrongs: [
        ['直径', 'diam-sq'],
        ['円周の 半分', 'half-circ'],
        ['円周', 'half-circ'],
      ] as [string, string][],
      explain: '縦《たて》の 長さは、おうぎ形の 半径です。',
    },
    yoko: {
      prompt: `${base}この 形の 横の 長さ（太い 線）は、もとの 円の 何に あたりますか。`,
      correct: '円周の 半分',
      wrongs: [
        ['円周', 'half-circ'],
        ['直径', 'diam-sq'],
        ['半径', 'no-square'],
      ] as [string, string][],
      explain: '上と 下に 円周が 半分ずつ 分かれるので、横の 長さは 円周の 半分です。',
    },
    formula: {
      prompt: `${base}このことから 分かる 円の 面積の 求め方は どれですか。`,
      correct: '半径 × 半径 × 3.14',
      wrongs: [
        ['直径 × 直径 × 3.14', 'diam-sq'],
        ['半径 × 2 × 3.14', 'circumference'],
        ['円周 × 半径', 'half-circ'],
      ] as [string, string][],
      explain: '長方形の 面積 ＝ 縦《たて》 × 横《よこ》 ＝ 半径 × 円周の 半分 ＝ 半径 × (直径 × 3.14 ÷ 2) ＝ 半径 × 半径 × 3.14 です。',
    },
  }[ask];
  const it: ChoiceItem = {
    engine: 'choice',
    id: `formula-alt:${ask}:${pieces}`,
    objective: 'formula',
    level,
    prompt: qs.prompt,
    figure: rearrangeFig(pieces),
    hints: [
      '細かく 切った 1つ1つは、半径を 2つの 辺に もつ おうぎ形だね。',
      '円周は 上と 下に 半分ずつ 分かれて いるよ。',
      '長方形の 面積は 縦《たて》 × 横《よこ》。縦《たて》と 横を 円の 言葉で 言いかえよう。',
    ],
    explain: qs.explain,
    identity: `formula:${ask}:${pieces}:fig`,
    alt: true,
    options: opts(qs.correct, qs.wrongs),
  };
  return it;
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['formula', 'radius'] },
  { objs: ['radius', 'diam', 'formula'] },
  { objs: ['part', 'diam', 'radius'] },
  { objs: ['combo', 'part', 'diam'] },
];

export function generateCircleArea(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.35;
  switch (obj) {
    case 'formula':
      return formulaItem(level, rng, alt);
    case 'radius':
      return radiusItem(level, rng, alt);
    case 'diam':
      return diamItem(level, rng, alt);
    case 'part':
      return partItem(level, rng, alt);
    case 'combo':
      return comboItem(level, rng, alt);
  }
}

export const circleArea: UnitSpec = finishUnit({
  id: 'g6.math.circle-area',
  title: '円の 面積',
  stage: 'g6',
  subject: 'math',
  domain: 'B-shape',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-shapes',
  prereq: ['g5.math.polygon-circle', 'g5.math.area-formulas'],
  objectives: [
    { id: 'formula', title: '円を 切って 並べる（公式の わけ）' },
    { id: 'radius', title: '半径から 面積を 求める' },
    { id: 'diam', title: '直径から 面積を 求める' },
    { id: 'part', title: '半円・円を 4等分した 形' },
    { id: 'combo', title: '組み合わせた 形' },
  ],
  misconceptions: [
    { id: 'diam-sq', explain: '直径 × 直径で 計算したのかな。円の 面積は 半径 × 半径 × 3.14。直径の ときは まず 2で わって 半径に しよう。' },
    { id: 'circumference', explain: '円周の 長さ（直径 × 3.14）を 求めたのかな。面積は 半径 × 半径 × 3.14 だよ。' },
    { id: 'no-square', explain: '半径を 1回しか かけて いないのかな。半径 × 半径 × 3.14と、半径を 2回 かけるよ。' },
    { id: 'forget-part', explain: '円全体（または 一部）の 面積の ままに したのかな。半円は ÷ 2、4等分した 形は ÷ 4。図の どこを 求めるか たしかめよう。' },
    { id: 'ring-sub', explain: '半径どうしを ひいてから 面積を 求めたのかな。大きい 円の 面積 − 小さい 円の 面積 で 求めよう。' },
    { id: 'half-circ', explain: '並べかえた 形の 横は 円周の 半分、縦《たて》は 半径だよ。円周は 上と 下に 半分ずつ 分かれて いるね。' },
  ],
  levels: [
    { label: '公式の わけ・半径', chance: 0.05 },
    { label: '直径', chance: 0.05 },
    { label: '半円・4等分', chance: 0.05 },
    { label: '組み合わせた 形', chance: 0.05 },
  ],
  intro: [
    {
      text: '円を 細かく 等分して たがいちがいに 並べかえると、長方形に 近い 形に なります。',
      figure: rearrangeFig(16),
    },
    {
      text: 'この 長方形の 縦《たて》は 半径、横は 円周の 半分（直径 × 3.14 ÷ 2 ＝ 半径 × 3.14）です。',
    },
    {
      text: 'だから、円の 面積 ＝ 半径 × 半径 × 円周率（3.14）。半径 3cmの 円は 3 × 3 × 3.14 ＝ 28.26cm²です。',
      figure: circleFig('3cm', 'r'),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateCircleArea(level, rng, index),
  },
  review: 'type',
  basis: '小学校学習指導要領（平成29年告示）算数 第6学年 B(3) 円の面積（円周率は3.14を用いる）',
  revised: REVISED,
});
