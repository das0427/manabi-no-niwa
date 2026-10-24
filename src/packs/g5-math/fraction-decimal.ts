/**
 * g5.math.fraction-decimal 分数と小数・整数の関係、わり算の商を分数で（curriculum-matrix 3.8）。
 *
 * 種別は「概」（生成。量の基準 60）。答えの形: 「小数で」の問題は decimal（分数で答えると「もう一度」）、
 * 「分数で」の問題は fraction（allowDecimal なし。小数で答えると「もう一度」）。約分は求めない（等しい分数なら正）。
 * 同一性キー: 問う形 × 数（わり算は わられる数・わる数、文章題は 場面 × 数）。
 */
import type { Rng } from '../../core/util/rng';
import type {
  ChoiceItem,
  Item,
  NumberItem,
  NumberlineItem,
  UnitSpec,
} from '../../curriculum/types';
import { dec, expr, finishUnit, gcd, pick, pickObj, REVISED, wrongList } from './util';

type Obj = 'quotient' | 'toDecimal' | 'toFraction' | 'compare';

const F = (n: number, d: number) => `[[${n}/${d}]]`;

/** n/d を 有限小数に（v ÷ 10^k）。3けたまでで わりきれなければ null */
function fracToDec(n: number, d: number): { v: number; k: number } | null {
  for (let k = 0; k <= 3; k++) if ((n * 10 ** k) % d === 0) return { v: (n * 10 ** k) / d, k };
  return null;
}

// ---- わり算の商を分数で ----
const QPAIRS: [number, number][] = [];
for (let a = 1; a <= 12; a++)
  for (let b = 2; b <= 12; b++) if (a % b !== 0 && gcd(a, b) === 1) QPAIRS.push([a, b]);

interface QScene {
  id: string;
  unit: string;
  text: (a: number, b: number) => string;
}
const QSCENES: QScene[] = [
  { id: 'juice', unit: 'L', text: (a, b) => `${a}Lの ジュースを ${b}人で 同じ量ずつ 分けます。1人分は 何Lですか。分数で 答えましょう。` },
  { id: 'ribbon', unit: 'm', text: (a, b) => `${a}mの リボンを ${b}人で 同じ長さずつ 分けます。1人分は 何mですか。分数で 答えましょう。` },
  { id: 'sand', unit: 'kg', text: (a, b) => `${a}kgの すなを ${b}つの ふくろに 同じ重さずつ 入れます。1ふくろ 何kgですか。分数で 答えましょう。` },
  { id: 'water', unit: 'dL', text: (a, b) => `${a}dLの 水を ${b}この コップに 同じ量ずつ 入れます。コップ 1こ 何dLですか。分数で 答えましょう。` },
  { id: 'times', unit: '倍', text: (a, b) => `赤い テープは ${a}m、白い テープは ${b}mです。赤い テープの 長さは、白い テープの 何倍ですか。分数で 答えましょう。` },
];

function quotient(level: number, rng: Rng, alt: boolean): NumberItem {
  const [a, b] = pick(rng, QPAIRS);
  const sc = alt ? pick(rng, QSCENES) : null;
  const answers = [{ kind: 'fraction' as const, num: a, den: b }];
  const times = sc?.id === 'times';
  return {
    engine: 'number',
    id: `quotient${sc ? `-alt:${sc.id}` : ''}:${a}÷${b}`,
    objective: 'quotient',
    level,
    prompt: sc ? sc.text(a, b) : 'わり算の 商を 分数で 表しましょう。',
    figure: sc ? undefined : expr(`${a} ÷ ${b} ＝ {{}}`),
    hints: [
      times ? '何倍かを 求める ときは、くらべる 長さ ÷ もとの 長さ だよ。' : 'わりきれない わり算の 商も、分数で 表せるよ。',
      times
        ? `式は ${a} ÷ ${b}。`
        : `${a} ÷ ${b}の 商は、${a}を ${b}等分した 1つ分。`,
      `□ ÷ ○ の 商は、分母が わる数の ○に なるよ。分子は どちらかな。`,
    ],
    explain: `${a} ÷ ${b} ＝ ${F(a, b)}。わり算の 商は、わられる数を 分子、わる数を 分母に した 分数で 表せます。${sc ? `答えは ${F(a, b)}${sc.unit}です。` : ''}`,
    identity: sc ? `quotient:${sc.id}:${a}÷${b}` : `quotient:${a}÷${b}`,
    alt,
    fields: [{ ...(sc ? { label: sc.unit } : {}), answer: answers[0]! }],
    keys: ['fraction'],
    wrongAnswers: wrongList(answers, [
      [`${b}/${a}`, 'div-swap'],
      [`${a}.${b}`, 'frac-as-digits'],
    ]),
  };
}

// ---- 分数を小数に ----
const TD: [number, number][] = [];
for (const d of [2, 4, 5, 8, 10, 20, 25])
  for (let n = 1; n < 2 * d; n++) if (n % d !== 0 && gcd(n, d) === 1) TD.push([n, d]);
/** 数直線に置ける分数（分母 2・4・5・10） */
const TD_LINE = TD.filter(([, d]) => d === 2 || d === 4 || d === 5 || d === 10);

function toDecimal(level: number, rng: Rng, alt: boolean): Item {
  const form = alt ? rng.int(1, 2) : 0;
  const [n, d] = pick(rng, form === 2 ? TD_LINE : TD);
  const { v, k } = fracToDec(n, d)!;
  const ds = dec(v, k);
  if (form === 2) {
    const fine = d === 4;
    const item: NumberlineItem = {
      engine: 'numberline',
      id: `toDecimal-line:${n}/${d}`,
      objective: 'toDecimal',
      level,
      prompt: `${F(n, d)}を 小数に なおして、その 場所を タップしよう。`,
      hints: [
        `${F(n, d)}は ${n} ÷ ${d}。まず 小数に なおそう。`,
        fine ? '0と 1の 間は 20に 分けて あるので、1目もりは 0.05。' : '0と 1の 間は 10に 分けて あるので、1目もりは 0.1。',
        `${n} ÷ ${d}の 商の 場所を さがそう。`,
      ],
      explain: `${F(n, d)} ＝ ${n} ÷ ${d} ＝ ${ds}。数直線で ${ds}の 場所です。`,
      identity: `toDecimal-line:${n}/${d}`,
      alt: true,
      line: fine
        ? { min: 0, max: 2, minor: 0.05, midEvery: 10, majorEvery: 20 }
        : { min: 0, max: 2, minor: 0.1, midEvery: 5, majorEvery: 10 },
      task: { kind: 'place', target: Number(ds) },
      misconceptions: { neighborTick: 'tick-read' },
    };
    return item;
  }
  const swap = fracToDec(d, n);
  if (form === 1) {
    const cands: [string, string][] = [
      [`${n}.${d}`, 'frac-as-digits'],
      [`${d}.${n}`, 'frac-as-digits'],
      [swap ? dec(swap.v, swap.k) : `0.${n}${d}`, swap ? 'div-swap' : 'frac-as-digits'],
      [dec(v, k + 1), 'frac-as-digits'],
    ];
    const options: ChoiceItem['options'] = [{ label: ds, correct: true }];
    for (const [l, m] of cands)
      if (options.length < 4 && !options.some((o) => o.label === l) && Number(l) !== Number(ds))
        options.push({ label: l, misconception: m });
    const item: ChoiceItem = {
      engine: 'choice',
      id: `toDecimal-alt:${n}/${d}`,
      objective: 'toDecimal',
      level,
      prompt: `${F(n, d)}と 等しい 小数は どれ？`,
      hints: [
        '分数は、分子 ÷ 分母の わり算の 商と 同じ 大きさだよ。',
        `${F(n, d)} ＝ ${n} ÷ ${d}`,
        `${n} ÷ ${d}を わりきれるまで 計算して、同じ 数を さがそう。`,
      ],
      explain: `${F(n, d)} ＝ ${n} ÷ ${d} ＝ ${ds}です。`,
      identity: `toDecimal-pick:${n}/${d}`,
      alt: true,
      options,
    };
    return item;
  }
  const answers = [{ kind: 'decimal' as const, value: Number(ds) }];
  return {
    engine: 'number',
    id: `toDecimal:${n}/${d}`,
    objective: 'toDecimal',
    level,
    prompt: '分数を 小数で 表しましょう。',
    figure: expr(`${F(n, d)} ＝ {{}}`),
    hints: [
      '分数は、分子 ÷ 分母の わり算で 小数に できるよ。',
      `${F(n, d)} ＝ ${n} ÷ ${d}`,
      `${n} ÷ ${d}を、0を つけたして わりきれるまで 計算しよう。`,
    ],
    explain: `${F(n, d)} ＝ ${n} ÷ ${d} ＝ ${ds}です。`,
    identity: `toDecimal:${n}/${d}`,
    alt: false,
    fields: [{ answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongList(answers, [
      [`${n}.${d}`, 'frac-as-digits'],
      [`${d}.${n}`, 'frac-as-digits'],
      [swap ? dec(swap.v, swap.k) : null, 'div-swap'],
    ]),
  };
}

// ---- 小数・整数を分数に ----
const TF: [number, number][] = [];
for (let v = 1; v <= 29; v++) if (v % 10 !== 0) TF.push([v, 1]);
for (let v = 1; v <= 199; v++) if (v % 10 !== 0) TF.push([v, 2]);

function toFraction(level: number, rng: Rng, alt: boolean): Item {
  const form = alt ? rng.int(1, 2) : 0;
  if (form === 1) {
    // 整数を 分数で
    const n = rng.int(2, 5);
    const d = rng.int(3, 9);
    const item: ChoiceItem = {
      engine: 'choice',
      id: `toFraction-int:${n}:${d}`,
      objective: 'toFraction',
      level,
      prompt: `整数の ${n}と 等しい 分数は どれ？`,
      hints: [
        '1は、分母と 分子が 同じ 分数で 表せるよ。',
        `1 ＝ ${F(d, d)}。${n}は 1の ${n}こ分。`,
        `分母が ${d}なら、分子は ${d} × ${n}。`,
      ],
      explain: `1 ＝ ${F(d, d)}なので、${n} ＝ ${F(d * n, d)}です（${d * n} ÷ ${d} ＝ ${n}）。`,
      identity: `toFraction-int:${n}:${d}`,
      alt: true,
      options: [
        { label: F(d * n, d), correct: true },
        { label: F(n, d), misconception: 'int-frac' },
        { label: F(d, d * n), misconception: 'div-swap' },
        { label: F(n + d, d), misconception: 'int-frac' },
      ],
    };
    return item;
  }
  if (form === 2) {
    // 数直線（1目もり 1/10）を 分数で 読む
    let k = rng.int(1, 19);
    while (k === 10) k = rng.int(1, 19);
    const item: NumberlineItem = {
      engine: 'numberline',
      id: `toFraction-line:${k}/10`,
      objective: 'toFraction',
      level,
      prompt: '↓の 場所の 数は 小数で いくつかな。その 数を 分数で 答えよう。',
      hints: [
        '0と 1の 間が 10に 分けて あるよ。1目もりは 0.1、分数では [[1/10]]。',
        `0から ${k}目もり すすんだ 場所だね。`,
        '[[1/10]]が いくつ分かを 分数で 書こう。',
      ],
      explain: `1目もりは 0.1 ＝ [[1/10]]。${k}目もりで ${dec(k, 1)} ＝ ${F(k, 10)}です。`,
      identity: `toFraction-line:${k}/10`,
      alt: true,
      line: { min: 0, max: 2, minor: '1/10', midEvery: 5, majorEvery: 10 },
      task: { kind: 'read', at: `${k}/10`, answer: { kind: 'fraction', num: k, den: 10 }, keys: ['fraction'] },
      misconceptions: { neighborTick: 'tick-read', minorAsOne: 'minor-as-one' },
      wrongAnswers: [{ value: k, misconception: 'minor-as-one' }],
    };
    return item;
  }
  const [v, k] = pick(rng, TF);
  const ds = dec(v, k);
  const den = 10 ** k;
  const g = gcd(v, den);
  const answers = [{ kind: 'fraction' as const, num: v, den }];
  return {
    engine: 'number',
    id: `toFraction:${ds}`,
    objective: 'toFraction',
    level,
    prompt: '小数を 分数で 表しましょう。',
    figure: expr(`${ds} ＝ {{}}`),
    hints: [
      '0.1 ＝ [[1/10]]、0.01 ＝ [[1/100]] だよ。',
      `${ds}は ${k === 1 ? '0.1' : '0.01'}が ${v}こ分。`,
      `${k === 1 ? '[[1/10]]' : '[[1/100]]'}が ${v}こ分を 分数で 書こう。`,
    ],
    explain: `${ds}は ${k === 1 ? '0.1' : '0.01'}が ${v}こ分なので ${F(v, den)}${g > 1 ? `（約分すると ${F(v / g, den / g)}）` : ''}です。`,
    identity: `toFraction:${ds}`,
    alt: false,
    fields: [{ answer: answers[0]! }],
    keys: ['fraction'],
    wrongAnswers: wrongList(answers, [
      [`1/${v}`, 'frac-as-digits'],
      [`${v}/${den * 10}`, 'place-den'],
      [k === 2 ? `${v}/10` : null, 'place-den'],
    ]),
  };
}

// ---- 大小 ----
const CF = TD.filter(([n, d]) => n < d || d <= 5);

function compare(level: number, rng: Rng, alt: boolean): ChoiceItem {
  const [n, d] = pick(rng, CF);
  const { v, k } = fracToDec(n, d)!;
  const fv = n / d;
  if (alt) {
    // 3つの 数で いちばん 大きいもの
    let other: [number, number];
    do other = pick(rng, CF);
    while (other[0] * d === n * other[1]);
    let dv: number;
    do dv = rng.int(1, 19);
    while (dv % 10 === 0 || Math.abs(dv / 10 - fv) < 1e-9 || Math.abs(dv / 10 - other[0] / other[1]) < 1e-9);
    const vals: [string, number][] = [
      [F(n, d), fv],
      [F(other[0], other[1]), other[0] / other[1]],
      [dec(dv, 1), dv / 10],
    ];
    const max = Math.max(...vals.map((x) => x[1]));
    const { v: ov, k: ok } = fracToDec(other[0], other[1])!;
    const item: ChoiceItem = {
      engine: 'choice',
      id: `compare-alt:${n}/${d}:${other[0]}/${other[1]}:${dv}`,
      objective: 'compare',
      level,
      prompt: 'いちばん 大きい 数は どれ？',
      hints: [
        '分数と 小数は、どちらかに そろえると くらべられるよ。',
        `分数を 小数に なおそう。${F(n, d)} ＝ ${n} ÷ ${d}。`,
        `${F(other[0], other[1])}も 小数に なおして、3つを くらべよう。`,
      ],
      explain: `${F(n, d)} ＝ ${dec(v, k)}、${F(other[0], other[1])} ＝ ${dec(ov, ok)}。小数に そろえて くらべると、いちばん 大きいのは ${vals.find((x) => x[1] === max)![0]}です。`,
      identity: `compare3:${[`${n}/${d}`, `${other[0]}/${other[1]}`].sort().join(',')}:${dv}`,
      alt: true,
      options: vals.map(([l, x]) => (x === max ? { label: l, correct: true } : { label: l, misconception: 'compare-look' })),
    };
    return item;
  }
  // 2つの 数（ときどき 等しい）
  let dv: number;
  let dk: number;
  if (k <= 2 && rng.next() < 0.2) {
    dv = v;
    dk = k;
  } else {
    dk = rng.int(1, 2);
    do dv = rng.int(1, dk === 1 ? 19 : 199);
    while (dv % 10 === 0 || dv * d === n * 10 ** dk);
  }
  const dvv = dv / 10 ** dk;
  const ds = dec(dv, dk);
  const eq = Math.abs(dvv - fv) < 1e-9;
  const big = eq ? 'eq' : fv > dvv ? 'f' : 'd';
  const item: ChoiceItem = {
    engine: 'choice',
    id: `compare:${n}/${d}:${ds}`,
    objective: 'compare',
    level,
    prompt: `${F(n, d)}と ${ds}、大きいのは どちら？`,
    hints: [
      '分数を 小数に なおすと くらべやすいよ。',
      `${F(n, d)} ＝ ${n} ÷ ${d}`,
      `${n} ÷ ${d}を 計算して、${ds}と くらべよう。`,
    ],
    explain: `${F(n, d)} ＝ ${dec(v, k)}。${eq ? `${ds}と 等しいです。` : `${ds}と くらべると、${big === 'f' ? F(n, d) : ds}の ほうが 大きいです。`}`,
    identity: `compare:${n}/${d}:${ds}`,
    alt: false,
    fixedOrder: true,
    options: [
      big === 'f' ? { label: F(n, d), correct: true } : { label: F(n, d), misconception: 'compare-look' },
      big === 'd' ? { label: ds, correct: true } : { label: ds, misconception: 'compare-look' },
      big === 'eq' ? { label: '同じ', correct: true } : { label: '同じ', misconception: 'compare-look' },
    ],
  };
  return item;
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['quotient', 'toDecimal'] },
  { objs: ['toFraction', 'compare', 'toDecimal'] },
  { objs: ['quotient', 'toDecimal', 'toFraction', 'compare'] },
];

export function generateFractionDecimal(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'quotient':
      return quotient(level, rng, alt);
    case 'toDecimal':
      return toDecimal(level, rng, alt);
    case 'toFraction':
      return toFraction(level, rng, alt);
    case 'compare':
      return compare(level, rng, alt);
  }
}

export const fractionDecimal: UnitSpec = finishUnit(
  {
    id: 'g5.math.fraction-decimal',
    title: '分数と 小数・整数',
    stage: 'g5',
    subject: 'math',
    domain: 'A-number',
    kind: 'concept',
    priority: 'P1',
    status: 'ready',
    icon: 'math-split',
    prereq: ['g4.math.fraction-kinds'],
    objectives: [
      { id: 'quotient', title: 'わり算の 商を 分数で 表す' },
      { id: 'toDecimal', title: '分数を 小数に なおす' },
      { id: 'toFraction', title: '小数・整数を 分数で 表す' },
      { id: 'compare', title: '分数と 小数の 大きさくらべ' },
    ],
    misconceptions: [
      {
        id: 'div-swap',
        explain:
          '分母と 分子が 反対に なったのかな。□ ÷ ○ の 商は、わられる数 □が 分子、わる数 ○が 分母の 分数 [[□/○]] だよ。',
      },
      {
        id: 'frac-as-digits',
        explain:
          '分数の 数字を そのまま 小数の 数字に したのかな。分数は 分子 ÷ 分母の わり算で 小数に なおすよ。小数を 分数に するときは、0.1 ＝ [[1/10]]、0.01 ＝ [[1/100]] を 使おう。',
      },
      {
        id: 'place-den',
        explain:
          '分母が ちがったのかな。小数第一位までなら 分母は 10、小数第二位までなら 分母は 100に なるよ。',
      },
      {
        id: 'int-frac',
        explain:
          '整数の 数を 分子に そのまま 書いたのかな。1 ＝ [[3/3]]のように、整数は 分子 ÷ 分母が その 数に なる 分数で 表すよ。',
      },
      {
        id: 'compare-look',
        explain:
          '数字の 見た目で くらべたのかな。分数を 小数に なおして（分子 ÷ 分母）、同じ 形に そろえてから くらべよう。',
      },
      {
        id: 'tick-read',
        explain: '目もりが 1つ ずれたのかな。1目もりの 大きさを たしかめて、0から 数えて みよう。',
      },
      {
        id: 'minor-as-one',
        explain: '1目もりを 1と 数えたのかな。この 数直線の 1目もりは [[1/10]]だよ。',
      },
    ],
    levels: [
      { label: 'わり算の 商と 分数・分数を 小数に', chance: 0.02 },
      { label: '小数を 分数に・大きさくらべ', chance: 0.05 },
      { label: 'まとめ', chance: 0.02 },
    ],
    intro: [
      {
        text: '2Lの ジュースを 3人で 同じ量ずつ 分けると、1人分は 2 ÷ 3 ＝ [[2/3]]L。わり算の 商は、わられる数を 分子、わる数を 分母に した 分数で 表せます。',
        figure: expr('2 ÷ 3 ＝ [[2/3]]'),
      },
      {
        text: '分数は、分子 ÷ 分母で 小数に なおせます。[[3/4]] ＝ 3 ÷ 4 ＝ 0.75。',
        figure: expr('[[3/4]] ＝ 3 ÷ 4 ＝ 0.75'),
      },
      {
        text: '小数は、0.1 ＝ [[1/10]]、0.01 ＝ [[1/100]] を 使って 分数に なおせます。0.7 ＝ [[7/10]]、0.23 ＝ [[23/100]]。',
        figure: expr('0.23 ＝ [[23/100]]'),
      },
      {
        text: '整数も 分数で 表せます。2 ＝ [[6/3]]（6 ÷ 3 ＝ 2）。分数と 小数を くらべる ときは、どちらかに そろえます。',
      },
    ],
    source: {
      kind: 'generator',
      generate: ({ level, rng, index }) => generateFractionDecimal(level, rng, index),
    },
    review: 'objective',
    basis: '小学校学習指導要領（平成29年告示）算数 第5学年 A(4) 分数と小数・整数の関係（除法の結果の分数表示、分数と小数の相互の表し方）',
    revised: REVISED,
  },
  '小数第一位《しょうすうだいいちい》 小数第二位《しょうすうだいにい》 等分《とうぶん》 赤《あか》い 白《しろ》い 場所《ばしょ》 間《あいだ》',
);
