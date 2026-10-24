/**
 * g6.math.fraction-mult 分数のかけ算（分数×整数・分数×分数）（curriculum-matrix 3.9）。
 *
 * 答えは約分した形が目標（mustReduce。約分していない等価な答えは「もう少し」）。仮分数・帯分数はどちらでも正（2.4）。
 * 同一性キー: 式。交換しただけの式は同じ（交換法則はこの単元の学習内容ではない）。別例（面積図・いくつ分・整数×分数）は
 * 表し方が違うので ':alt' を付けて別に数える。文章題は 場面 × 式。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { Item, NumberItem, UnitSpec } from '../../curriculum/types';
import {
  expr,
  finishUnit,
  fr,
  fracAns,
  fx,
  gcd,
  rawTo,
  pick,
  pickObj,
  q,
  qBoth,
  qmul,
  qText,
  REVISED,
  STROKE,
  svg,
  svgText,
  wrongList,
  type Q,
} from './util';

type Obj = 'fxi' | 'fxf' | 'cancel' | 'mixed' | 'story';

/** 真分数 [分子, 分母]（約分済み） */
function proper(minD: number, maxD: number): [number, number][] {
  const out: [number, number][] = [];
  for (let d = minD; d <= maxD; d++) for (let n = 1; n < d; n++) if (gcd(n, d) === 1) out.push([n, d]);
  return out;
}
const P9 = proper(2, 9);
const P6 = proper(2, 6);

/** 分数×整数（約分なし・ありとも）: [a, b, n] */
const FXI: [number, number, number][] = [];
for (const [a, b] of P9) for (let n = 2; n <= 9; n++) FXI.push([a, b, n]);

/** 分数×分数（たすきの約分が無いもの。交換は同じなので a/b ≦ c/d の順で1つ） */
const FXF: [number, number, number, number][] = [];
/** 約分してから計算するもの（たすきの約分がある） */
const CANCEL: [number, number, number, number][] = [];
{
  const all = proper(2, 15);
  for (let i = 0; i < all.length; i++)
    for (let j = i; j < all.length; j++) {
      const [a, b] = all[i]!;
      const [c, d] = all[j]!;
      const cross = gcd(a, d) > 1 || gcd(c, b) > 1;
      if (cross) CANCEL.push([a, b, c, d]);
      else if (b <= 9 && d <= 9) FXF.push([a, b, c, d]);
    }
}
/** 整数×分数（約分がある）: [n, a, b] */
const IXF: [number, number, number][] = [];
for (const [a, b] of proper(3, 12)) for (let n = 2; n <= 16; n++) if (gcd(n, b) > 1) IXF.push([n, a, b]);

/** 帯分数×真分数: [w, c, d, p, r] */
const MXP: [number, number, number, number, number][] = [];
for (let w = 1; w <= 3; w++)
  for (const [c, d] of P6) for (const [p, r] of proper(2, 8)) MXP.push([w, c, d, p, r]);
/** 帯分数×整数: [w, c, d, n] */
const MXI: [number, number, number, number][] = [];
for (let w = 1; w <= 3; w++) for (const [c, d] of P6) for (let n = 2; n <= 8; n++) MXI.push([w, c, d, n]);

const mixedText = (w: number, c: number, d: number) => `[[${w} ${c}/${d}]]`;
const key2 = (x: string, y: string) => [x, y].sort().join('×');


/** 面積図（1m×1m の正方形を 縦 b 行・横 d 列に分け、a 行 × c 列 をぬる） */
function areaFig(a: number, b: number, c: number, d: number): Figure {
  const S = 180;
  const x0 = 40;
  const y0 = 20;
  const cw = S / d;
  const rh = S / b;
  let body = `<rect x="${x0}" y="${y0}" width="${S}" height="${S}" fill="var(--white)" ${STROKE}/>`;
  body += `<rect x="${x0}" y="${y0 + S - a * rh}" width="${c * cw}" height="${a * rh}" fill="var(--sky)"/>`;
  for (let i = 1; i < d; i++)
    body += `<line x1="${x0 + i * cw}" y1="${y0}" x2="${x0 + i * cw}" y2="${y0 + S}" stroke="var(--ink)" stroke-width="1.2"/>`;
  for (let i = 1; i < b; i++)
    body += `<line x1="${x0}" y1="${y0 + i * rh}" x2="${x0 + S}" y2="${y0 + i * rh}" stroke="var(--ink)" stroke-width="1.2"/>`;
  body += `<rect x="${x0}" y="${y0}" width="${S}" height="${S}" fill="none" ${STROKE}/>`;
  body += `<rect x="${x0}" y="${y0 + S - a * rh}" width="${c * cw}" height="${a * rh}" fill="none" stroke="var(--ink)" stroke-width="4"/>`;
  body += svgText(x0 + S / 2, y0 + S + 18, '1m', 15);
  body += svgText(x0 - 20, y0 + S / 2, '1m', 15);
  return svg(
    260,
    225,
    body,
    `1mの 正方形を 縦《たて》に ${b}こ、横《よこ》に ${d}こに 分けた 図。ぬった 部分は 縦《たて》 ${a}こ、横《よこ》 ${c}こ`,
  );
}

function calcItem(
  obj: Obj,
  level: number,
  alt: boolean,
  shown: string,
  ans: Q,
  identity: string,
  hints: [string, string, string],
  explain: string,
  cands: [string | null, string][],
  prompt = '計算しよう。答えは できるだけ 約分しよう。',
  figure?: Figure,
): NumberItem {
  const answer = fracAns(ans);
  return {
    engine: 'number',
    id: `${obj}${alt ? '-alt' : ''}:${shown}`,
    objective: obj,
    level,
    prompt,
    figure: figure ?? expr(`${shown} ＝ {{}}`),
    hints,
    explain,
    identity: `${identity}${alt ? ':alt' : ''}`,
    alt,
    fields: [{ answer }],
    keys: ['fraction'],
    wrongAnswers: wrongList([answer], cands),
  };
}

/** 分数×分数の誤答の候補 */
function ffWrongs(a: number, b: number, c: number, d: number): [string | null, string][] {
  const out: [string | null, string][] = [];
  const g1 = gcd(a, d);
  const g2 = gcd(c, b);
  if (g1 > 1) out.push([`${(a / g1) * c}/${b * d}`, 'cancel-one']);
  else if (g2 > 1) out.push([`${a * (c / g2)}/${b * d}`, 'cancel-one']);
  const gn = gcd(a, c);
  const gd = gcd(b, d);
  if (gn > 1 && a !== c) out.push([`${(a / gn) * (c / gn)}/${b * d}`, 'cancel-same']);
  else if (gd > 1 && b !== d) out.push([`${a * c}/${(b / gd) * (d / gd)}`, 'cancel-same']);
  out.push([`${a * d}/${b * c}`, 'flip']);
  out.push([`${a + c}/${b + d}`, 'add-parts']);
  return out;
}

function fxi(level: number, rng: Rng, alt: boolean): NumberItem {
  const [a, b, n] = pick(rng, FXI);
  const ans = q(a * n, b);
  const shown = `${fr(a, b)} × ${n}`;
  const g = gcd(n, b);
  return calcItem(
    'fxi',
    level,
    alt,
    shown,
    ans,
    `${a}/${b}x${n}`,
    [
      alt
        ? `${fr(a, b)}が ${n}こ分。${fr(1, b)}が いくつ分に なるかな。`
        : '分数に 整数を かける ときは、分母は そのままだよ。',
      `${fr(a, b)} × ${n}は、${fx([a, n], [b])}${g > 1 ? `。とちゅうで ${n}と ${b}を ${g}で 約分できるよ` : ''}。`,
      `分子は ${a} × ${n} ＝ ${a * n}。あとは 約分できるか 調べよう。`,
    ],
    `${shown} ＝ ${rawTo(a * n, b)}。分子に 整数を かけて、分母は そのままです。`,
    [
      [`${a}/${b * n}`, 'den-times'],
      [`${a * n}/${b * n}`, 'both-times'],
      [`${a + n}/${b}`, 'add-parts'],
    ],
    alt ? `${fr(a, b)}の ${n}こ分は いくつですか。答えは できるだけ 約分しよう。` : undefined,
    alt
      ? {
          kind: 'tape',
          parts: Array.from({ length: n }, (_, i) => ({ length: 1, label: fr(a, b), tone: i % 2 ? 'b' : 'a' })),
          total: '？',
        }
      : undefined,
  );
}

function fxf(level: number, rng: Rng, alt: boolean): NumberItem {
  const [a0, b0, c0, d0] = pick(rng, FXF);
  const [a, b, c, d] = rng.next() < 0.5 ? [a0, b0, c0, d0] : [c0, d0, a0, b0];
  const ans = q(a * c, b * d);
  const shown = `${fr(a, b)} × ${fr(c, d)}`;
  return calcItem(
    'fxf',
    level,
    alt,
    shown,
    ans,
    key2(`${a}/${b}`, `${c}/${d}`),
    [
      alt
        ? `ぬった 部分は、1m²を ${b * d}こに 分けた うちの いくつ分かな。`
        : '分数どうしの かけ算は、分子どうし・分母どうしを かけるよ。',
      `${shown}は、${fx([a, c], [b, d])}。`,
      `分母は ${b} × ${d} ＝ ${b * d}。分子を 計算して、約分できるか 調べよう。`,
    ],
    `${shown} ＝ ${rawTo(a * c, b * d)}。分子どうし（${a} × ${c}）、分母どうし（${b} × ${d}）を かけます。`,
    ffWrongs(a, b, c, d),
    alt
      ? `縦《たて》 ${fr(a, b)}m、横《よこ》 ${fr(c, d)}mの 長方形の 面積は 何m²ですか。図を 見て 考えよう。`
      : undefined,
    alt ? areaFig(a, b, c, d) : undefined,
  );
}

function cancel(level: number, rng: Rng, alt: boolean): NumberItem {
  if (alt) {
    const [n, a, b] = pick(rng, IXF);
    const g = gcd(n, b);
    const ans = q(n * a, b);
    const shown = `${n} × ${fr(a, b)}`;
    return calcItem(
      'cancel',
      level,
      true,
      shown,
      ans,
      `${a}/${b}x${n}:int-first`,
      [
        '整数は 分母が 1の 分数と 考えられるよ。',
        `${shown}は、${fx([n, a], [b])}。${n}と ${b}は ${g}で 約分できるよ。`,
        `約分すると、${fx([n / g, a], [b / g])}。`,
      ],
      `${shown}は ${fx([n, a], [b])}。${n}と ${b}を ${g}で 約分して ${fx([n / g, a], [b / g])}に すると ${qBoth(ans)}。とちゅうで 約分すると 計算が かんたんに なります。`,
      [
        [`${(n / g) * a}/${b}`, 'cancel-one'],
        [`${a}/${b * n}`, 'den-times'],
        [`${n * a}/${b * n}`, 'both-times'],
      ],
    );
  }
  const [a0, b0, c0, d0] = pick(rng, CANCEL);
  const [a, b, c, d] = rng.next() < 0.5 ? [a0, b0, c0, d0] : [c0, d0, a0, b0];
  const ans = q(a * c, b * d);
  const shown = `${fr(a, b)} × ${fr(c, d)}`;
  const g1 = gcd(a, d);
  const g2 = gcd(c, b);
  const steps = [
    g1 > 1 ? `${a}と ${d}を ${g1}で` : '',
    g2 > 1 ? `${c}と ${b}を ${g2}で` : '',
  ]
    .filter(Boolean)
    .join('、');
  return calcItem(
    'cancel',
    level,
    false,
    shown,
    ans,
    key2(`${a}/${b}`, `${c}/${d}`),
    [
      'かける 前に、分子と 分母で 約分できる 数が ないか 見よう。',
      `${fx([a, c], [b, d])}の まま、${steps} 約分しよう。`,
      `約分すると、${fx([a / g1, c / g2], [b / g2, d / g1])}。`,
    ],
    `${shown}は ${fx([a, c], [b, d])}。${steps} 約分すると ${fx([a / g1, c / g2], [b / g2, d / g1])}に なり、${qBoth(ans)}。かける 前に 約分すると、数が 小さく なって 計算しやすいです。`,
    ffWrongs(a, b, c, d),
  );
}

function mixed(level: number, rng: Rng, alt: boolean): NumberItem {
  if (alt) {
    const [w, c, d, n] = pick(rng, MXI);
    const m = q(w * d + c, d);
    const ans = qmul(m, q(n));
    const shown = `${mixedText(w, c, d)} × ${n}`;
    return calcItem(
      'mixed',
      level,
      true,
      shown,
      ans,
      `${w}_${c}/${d}x${n}`,
      [
        '帯分数は 仮分数に なおしてから かけよう。',
        `${mixedText(w, c, d)} ＝ ${fr(w * d + c, d)}`,
        `${fr(w * d + c, d)} × ${n}は、${fx([w * d + c, n], [d])}。`,
      ],
      `${shown} ＝ ${fr(w * d + c, d)} × ${n} ＝ ${rawTo((w * d + c) * n, d)}。帯分数は 仮分数に なおしてから かけます。`,
      [
        [`${w * n}と${c}/${d}`, 'mixed-split'],
        [`${c * n}/${d}`, 'whole-drop'],
        [`${w * d + c}/${d * n}`, 'den-times'],
      ],
    );
  }
  const [w, c, d, p, r] = pick(rng, MXP);
  const m = q(w * d + c, d);
  const ans = qmul(m, q(p, r));
  const mt = mixedText(w, c, d);
  const left = rng.next() < 0.5;
  const shown = left ? `${mt} × ${fr(p, r)}` : `${fr(p, r)} × ${mt}`;
  const split = qmul(q(c, d), q(p, r));
  return calcItem(
    'mixed',
    level,
    false,
    shown,
    ans,
    key2(`${w}_${c}/${d}`, `${p}/${r}`),
    [
      '帯分数は 仮分数に なおしてから かけよう。',
      `${mt} ＝ ${fr(w * d + c, d)}`,
      left
        ? `${fr(w * d + c, d)} × ${fr(p, r)}は、${fx([w * d + c, p], [d, r])}。約分できるか 調べよう。`
        : `${fr(p, r)} × ${fr(w * d + c, d)}は、${fx([p, w * d + c], [r, d])}。約分できるか 調べよう。`,
    ],
    `${mt} ＝ ${fr(w * d + c, d)} なので、${shown} ＝ ${qBoth(ans)}。帯分数は 仮分数に なおしてから かけます。`,
    [
      [`${w * split.d + split.n}/${split.d}`, 'mixed-split'],
      [`${split.n}/${split.d}`, 'whole-drop'],
      [`${(w * d + c) * r}/${d * p}`, 'flip'],
    ],
  );
}

// ---- 文章題（場面 8。分数×整数・分数×分数、いくつ分・面積・倍） ----
interface Scene {
  id: string;
  unit: string;
  /** y が整数（分数×整数） */
  intY?: boolean;
  /** x が整数（整数×分数） */
  intX?: boolean;
  text: (x: string, y: string) => string;
}
const SCENES: Scene[] = [
  {
    id: 'paint',
    unit: 'm²',
    text: (x, y) => `1dLで ${x}m² ぬれる ペンキが あります。このペンキ ${y}dLでは 何m² ぬれますか。`,
  },
  {
    id: 'bar',
    unit: 'kg',
    text: (x, y) => `1mの 重さが ${x}kgの 鉄の 棒が あります。この 棒 ${y}mの 重さは 何kgですか。`,
  },
  {
    id: 'field',
    unit: 'm²',
    text: (x, y) => `縦《たて》 ${x}m、横《よこ》 ${y}mの 長方形の 花だんが あります。面積は 何m²ですか。`,
  },
  {
    id: 'milk',
    unit: 'L',
    intY: true,
    text: (x, y) => `毎日 ${x}Lずつ 牛にゅうを 飲みます。${y}日間《にちかん》では 何L 飲みますか。`,
  },
  {
    id: 'fert',
    unit: 'kg',
    text: (x, y) => `1m²あたり ${x}kgの 肥料を まきます。${y}m²の 畑では 何kg いりますか。`,
  },
  {
    id: 'times',
    unit: 'm',
    text: (x, y) => `赤い テープは ${x}mです。青い テープの 長さは 赤い テープの ${y}倍です。青い テープは 何mですか。`,
  },
  {
    id: 'walk',
    unit: 'km',
    intX: true,
    text: (x, y) => `1時間に ${x}km 歩く 人が、同じ 速さで ${y}時間 歩きます。何km 進みますか。`,
  },
  {
    id: 'juice',
    unit: 'L',
    intY: true,
    text: (x, y) => `1本 ${x}Lの ジュースが ${y}本 あります。全部で 何Lですか。`,
  },
];

function story(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, SCENES);
  const [a, b] = sc.intX ? [rng.int(2, 6), 1] : pick(rng, P6);
  const [c, d] = sc.intY ? [rng.int(2, 9), 1] : pick(rng, P6);
  const X = q(a, b);
  const Y = q(c, d);
  const ans = qmul(X, Y);
  const xs = qText(X);
  const ys = qText(Y);
  const shown = `${xs} × ${ys}`;
  const answer = fracAns(ans);
  const fig: Figure | undefined = alt
    ? sc.id === 'field'
      ? areaFig(a, b, c, d)
      : {
          kind: 'table',
          header: ['いくつ分', '1', ys],
          rows: [['量《りょう》', `${xs}${sc.unit}`, '？']],
        }
    : undefined;
  const mulText = b === 1 ? fx([a, c], [d]) : d === 1 ? fx([a, c], [b]) : fx([a, c], [b, d]);
  const cands: [string | null, string][] =
    b > 1 && d > 1
      ? ffWrongs(a, b, c, d)
      : [
          [`${b === 1 ? c : a}/${b === 1 ? d * a : b * c}`, 'den-times'],
          [`${a * d}/${b * c}`, 'flip'],
        ];
  return {
    engine: 'number',
    id: `story${alt ? '-alt' : ''}:${sc.id}:${shown}`,
    objective: 'story',
    level,
    prompt: `${sc.text(xs, ys)}${alt ? '図を 見て 式を 考えよう。' : ''}`,
    figure: fig,
    hints: [
      sc.id === 'field'
        ? '長方形の 面積は 縦《たて》 × 横《よこ》 だね。'
        : `「1あたりの 量 × いくつ分」で 求められるよ。`,
      `式は ${shown}。`,
      `${shown}は、${mulText}。約分できるか 調べよう。`,
    ],
    explain: `式は ${shown} ＝ ${qBoth(ans)}。答えは ${qText(ans)}${sc.unit}です。`,
    identity: `story:${sc.id}:${shown}${alt ? ':alt' : ''}`,
    alt,
    fields: [{ label: sc.unit, answer }],
    keys: ['fraction'],
    wrongAnswers: wrongList([answer], cands),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['fxi', 'fxf'] },
  { objs: ['cancel', 'fxf', 'fxi'] },
  { objs: ['mixed', 'cancel'] },
  { objs: ['story', 'mixed', 'cancel', 'fxf'] },
];

export function generateFractionMult(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'fxi':
      return fxi(level, rng, alt);
    case 'fxf':
      return fxf(level, rng, alt);
    case 'cancel':
      return cancel(level, rng, alt);
    case 'mixed':
      return mixed(level, rng, alt);
    case 'story':
      return story(level, rng, alt);
  }
}

export const fractionMult: UnitSpec = finishUnit({
  id: 'g6.math.fraction-mult',
  title: '分数の かけ算',
  stage: 'g6',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'math-split',
  prereq: ['g5.math.fraction-add-diff'],
  objectives: [
    { id: 'fxi', title: '分数 × 整数' },
    { id: 'fxf', title: '分数 × 分数' },
    { id: 'cancel', title: 'とちゅうで 約分して かける' },
    { id: 'mixed', title: '帯分数の かけ算' },
    { id: 'story', title: '文章題' },
  ],
  misconceptions: [
    {
      id: 'den-times',
      explain:
        '整数を 分母に かけたのかな。分母に かけると 1つ分が 小さく なって しまうよ。分数 × 整数は、分子に 整数を かけて、分母は そのまま。',
    },
    {
      id: 'both-times',
      explain:
        '分子にも 分母にも 同じ 数を かけたのかな。それは 約分の 反対で、大きさは 変わらないよ。整数は 分子だけに かけよう。',
    },
    {
      id: 'add-parts',
      explain: 'たし算を したのかな。かけ算では、分子どうし・分母どうしを かけるよ。',
    },
    {
      id: 'flip',
      explain:
        'かける 分数を ひっくり返したのかな。ひっくり返す（逆数に する）のは わり算の ときだよ。かけ算は そのまま 分子どうし・分母どうしを かけよう。',
    },
    {
      id: 'cancel-one',
      explain:
        '約分で、分子と 分母の どちらか 片方だけを わったのかな。約分は、分子の 数と 分母の 数を 同じ 数で 両方 わるよ。',
    },
    {
      id: 'cancel-same',
      explain:
        '分子どうし（分母どうし）で 約分したのかな。約分できるのは 分子の 数と 分母の 数の 組だけだよ。[[2/3]] × [[4/5]]の 2と 4では 約分できないね。',
    },
    {
      id: 'mixed-split',
      explain:
        '帯分数の 整数の 部分と 分数の 部分を 別べつに 考えて、片方に かけ忘れたのかな。帯分数は 仮分数に なおしてから かけよう。',
    },
    {
      id: 'whole-drop',
      explain: '帯分数の 整数の 部分を 忘れたのかな。[[1 2/3]]は [[5/3]]だよ。仮分数に なおしてから かけよう。',
    },
  ],
  levels: [
    { label: '分数×整数・分数×分数', chance: 0.02 },
    { label: 'とちゅうで 約分', chance: 0.02 },
    { label: '帯分数', chance: 0.02 },
    { label: '文章題・まとめ', chance: 0.02 },
  ],
  intro: [
    {
      text: '1dLで [[2/5]]m² ぬれる ペンキ 3dLでは、[[2/5]]が 3こ分。[[2/5]] × 3は 分子が 2 × 3、分母が 5の 分数で [[6/5]]m²。分母は そのまま、分子に 整数を かけます。',
      figure: {
        kind: 'tape',
        parts: [
          { length: 1, label: '[[2/5]]', tone: 'a' },
          { length: 1, label: '[[2/5]]', tone: 'b' },
          { length: 1, label: '[[2/5]]', tone: 'a' },
        ],
        total: '？',
      },
    },
    {
      text: '縦《たて》 [[2/3]]m、横《よこ》 [[3/4]]mの 長方形の 面積。1m²を 3 × 4 ＝ 12こに 分けた うちの 2 × 3 ＝ 6こ分なので [[6/12]]m²。',
      figure: areaFig(2, 3, 3, 4),
    },
    {
      text: '分数 × 分数は、分子どうし・分母どうしを かけます。[[2/3]] × [[3/4]]は 分子が 2 × 3、分母が 3 × 4で [[6/12]] ＝ [[1/2]]。かける 前に 約分すると かんたんです。',
      figure: expr('[[2/3]] × [[3/4]] ＝ [[1/2]]'),
    },
    {
      text: '帯分数は 仮分数に なおしてから かけます。[[1 1/2]] × [[2/5]] ＝ [[3/2]] × [[2/5]] ＝ [[3/5]]。',
      figure: expr('[[1 1/2]] × [[2/5]] ＝ [[3/2]] × [[2/5]] ＝ [[3/5]]'),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateFractionMult(level, rng, index),
  },
  review: 'type',
  basis: '小学校学習指導要領（平成29年告示）算数 第6学年 A(1) 分数の乗法（分数×整数・分数×分数）',
  revised: REVISED,
});
