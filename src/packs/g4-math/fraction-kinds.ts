/**
 * g4.math.fraction-kinds 真分数・仮分数・帯分数、大きさの等しい分数（curriculum-matrix 3.7）。
 * 数直線 → 仮分数と帯分数の変換 → 等しい分数を見つける。
 *
 * 答えの形は問題ごとに指定する（NumberAnswer の allowImproper / allowMixed。2.4・engines.md）。
 *   「帯分数で」→ allowImproper: false、「仮分数で」→ allowMixed: false。値が同じで形だけ違う答えは「もう一度」。
 * 注意: 「1と4/3」のように分数部分が1以上の帯分数は、値が同じなので number では誤答にできない（エンジンへの要望）。
 *   この誤りは「帯分数の正しい書き方」を選ぶ問題（kind の到達項目）で扱う。
 * 同一性キー: 問う形 × 分数（× 答えの形）。
 */
import type { NumberAnswer } from '../../core/answer/number';
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { NumberlineItem } from '../../engines/numberline/numberline';
import type { ChoiceItem, Item, NumberItem, SortItem, UnitSpec } from '../../curriculum/types';
import { expr, finishUnit, gcd, opts, pick, pickObj, REVISED, svg, wrongList } from './util';

type Obj = 'kind' | 'nl' | 'toMixed' | 'toImproper' | 'equiv' | 'compare';

const F = (n: number, d: number) => `[[${n}/${d}]]`;
const M = (w: number, n: number, d: number) => `[[${w} ${n}/${d}]]`;
const frac = (
  num: number,
  den: number,
  o: Partial<Extract<NumberAnswer, { kind: 'fraction' }>> = {},
): NumberAnswer => ({
  kind: 'fraction',
  num,
  den,
  ...o,
});

/** 仮分数（1以上、整数でない）num/den を作る */
function improper(rng: Rng, maxDen = 9, maxWhole = 4): [number, number] {
  const den = rng.int(2, maxDen);
  const w = rng.int(1, maxWhole);
  const r = rng.int(1, den - 1);
  return [w * den + r, den];
}

/** 1を den に分けた テープを w 本と r こ分 ぬった 図 */
function barsFig(w: number, r: number, den: number): Figure {
  const cell = Math.max(14, Math.floor(200 / den));
  const W = cell * den + 8;
  const rows = w + (r > 0 ? 1 : 0);
  let body = '';
  for (let i = 0; i < rows; i++) {
    const y = 4 + i * 30;
    const filled = i < w ? den : r;
    for (let j = 0; j < den; j++)
      body += `<rect x="${4 + j * cell}" y="${y}" width="${cell}" height="22" fill="${j < filled ? 'var(--sky)' : 'var(--white)'}" stroke="var(--ink)" stroke-width="2"/>`;
  }
  return svg(W, rows * 30 + 4, body, `1を ${den}こに 分けた テープ`);
}

/** 見分ける（alt: なかま分け） */
function kind(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    // 6まいの カードを 真・仮・帯に 分ける
    const den = rng.int(3, 8);
    const p1 = rng.int(1, den - 1);
    let p2 = rng.int(1, den - 1);
    if (p2 === p1) p2 = p1 === 1 ? 2 : 1;
    const i1 = den + rng.int(1, den - 1);
    const w = rng.int(1, 3);
    const r = rng.int(1, den - 1);
    const cards = [
      { label: F(p1, den), box: 0 },
      { label: F(p2, den), box: 0 },
      { label: F(den, den), box: 1, wrongBoxes: [{ box: 0, misconception: 'equal-one' }] },
      { label: F(i1, den), box: 1, wrongBoxes: [{ box: 2, misconception: 'kind-name' }] },
      { label: M(w, r, den), box: 2, wrongBoxes: [{ box: 1, misconception: 'kind-name' }] },
      { label: M(w + 1, den - r, den), box: 2 },
    ];
    const item: SortItem = {
      engine: 'sort',
      id: `kind-alt:${den}:${p1}-${p2}-${i1}-${w}-${r}`,
      objective: 'kind',
      level,
      prompt: '分数を 真分数・仮分数・帯分数に 分けよう。',
      boxes: [{ label: '真分数' }, { label: '仮分数' }, { label: '帯分数' }],
      cards,
      hints: [
        '分子と 分母の 大きさを くらべよう。',
        '分子が 分母より 小さいのが 真分数、分子が 分母と 同じか 大きいのが 仮分数。',
        `整数と 真分数を あわせた 形が 帯分数。${F(den, den)}は 分子と 分母が 同じだね。`,
      ],
      explain: `${F(p1, den)}・${F(p2, den)}は 真分数、${F(den, den)}・${F(i1, den)}は 仮分数、${M(w, r, den)}・${M(w + 1, den - r, den)}は 帯分数です。`,
      identity: `kind-sort:${den}:${[p1, p2].sort().join('-')}:${i1}:${w}-${r}`,
      alt: true,
    };
    return item;
  }
  const target = pick(rng, ['proper', 'improper', 'mixed'] as const);
  const den = rng.int(3, 9);
  const pn = rng.int(1, den - 1);
  const imp = den * rng.int(1, 2) + rng.int(1, den - 1);
  const w = rng.int(1, 3);
  const r = rng.int(1, den - 1);
  const name = { proper: '真分数', improper: '仮分数', mixed: '帯分数' }[target];
  let options: ChoiceItem['options'];
  if (target === 'proper')
    options = opts(F(pn, den), [
      [F(den, den), 'equal-one'],
      [F(imp, den), 'kind-name'],
      [M(w, r, den), 'kind-name'],
    ]);
  else if (target === 'improper')
    options = opts(rng.next() < 0.3 ? F(den, den) : F(imp, den), [
      [F(pn, den), 'kind-name'],
      [M(w, r, den), 'kind-name'],
      [F(den - 1 > pn ? den - 1 : pn === 1 ? 2 : 1, den), 'kind-name'],
    ]);
  else
    options = opts(M(w, r, den), [
      [M(w, r + den, den), 'mixed-frac-big'],
      [F(imp, den), 'kind-name'],
      [F(pn, den), 'kind-name'],
    ]);
  const ans = options[0]!.label!;
  const item: ChoiceItem = {
    engine: 'choice',
    id: `kind:${target}:${options.map((o) => o.label).join(',')}`,
    objective: 'kind',
    level,
    prompt: `${name}は どれ？`,
    hints: [
      '分子と 分母の 大きさを くらべよう。',
      target === 'mixed'
        ? '帯分数は、整数と 真分数を あわせた 形だよ。'
        : '分子が 分母より 小さいのが 真分数、分子が 分母と 同じか 大きいのが 仮分数。',
      target === 'mixed'
        ? '分数の 部分が 1より 小さいかも 見よう。'
        : `分母は どれも ${den}。分子が ${den}より 小さいか 考えよう。`,
    ],
    explain: `${ans}が ${name}です。真分数は 1より 小さい 分数、仮分数は 1と 等しいか 1より 大きい 分数、帯分数は 整数と 真分数を あわせた 分数です。`,
    identity: `kind:${target}:${ans}:${options
      .slice(1)
      .map((o) => o.label)
      .sort()
      .join(',')}`,
    alt: false,
    options,
  };
  return item;
}

/** 数直線（read: 読む。alt: 置く） */
function nl(level: number, rng: Rng, alt: boolean): NumberlineItem {
  const den = rng.int(2, 6);
  const max = den <= 3 ? 3 : 2;
  let num: number;
  do num = rng.int(den + 1, max * den - 1);
  while (num % den === 0);
  const w = Math.floor(num / den);
  const r = num % den;
  const line = {
    min: 0,
    max,
    minor: `1/${den}`,
    majorEvery: den,
    labels: Array.from({ length: max + 1 }, (_, i) => i),
  };
  if (alt) {
    const asMixed = rng.next() < 0.5;
    return {
      engine: 'numberline',
      id: `nl-alt:${num}/${den}:${asMixed ? 'm' : 'i'}`,
      objective: 'nl',
      level,
      prompt: `${asMixed ? M(w, r, den) : F(num, den)}を 数直線の 上に おこう。`,
      hints: [
        `0から 1までが ${den}こに 分けて あるよ。1めもりは ${F(1, den)}。`,
        asMixed
          ? `${M(w, r, den)}は ${w}と ${F(r, den)}。`
          : `${F(num, den)}は ${F(1, den)}が ${num}こ。`,
        `${w}から ${r}めもり 進んだ ところだよ。`,
      ],
      explain: `${F(num, den)}（${M(w, r, den)}）は ${w}より ${F(r, den)} 大きい ところです。`,
      identity: `nl-place:${num}/${den}:${asMixed ? 'm' : 'i'}`,
      alt: true,
      line,
      task: { kind: 'place', target: `${num}/${den}` },
      misconceptions: { minorAsOne: 'scale-one', neighborTick: 'count-tick' },
    };
  }
  const want = rng.next() < 0.5 ? 'mixed' : 'improper';
  return {
    engine: 'numberline',
    id: `nl:${num}/${den}:${want}`,
    objective: 'nl',
    level,
    prompt: `↓の めもりが あらわす 数を ${want === 'mixed' ? '帯分数' : '仮分数'}で 答えよう。`,
    hints: [
      `0から 1までが ${den}こに 分けて あるよ。1めもりは ${F(1, den)}。`,
      want === 'mixed' ? `${w}より 何めもり 右かな。` : `0から 何めもり 進んだかな。`,
      want === 'mixed'
        ? `${w}と、${r}めもり分の 分数だね。`
        : `${F(1, den)}が いくつ分かを 数えよう。`,
    ],
    explain: `${F(1, den)}が ${num}こで ${F(num, den)}。帯分数で 表すと ${M(w, r, den)}です。`,
    identity: `nl-read:${num}/${den}:${want}`,
    alt: false,
    line,
    task: {
      kind: 'read',
      at: `${num}/${den}`,
      answer: frac(num, den, want === 'mixed' ? { allowImproper: false } : { allowMixed: false }),
      keys: ['fraction'],
    },
    misconceptions: { neighborTick: 'count-tick' },
    wrongAnswers: [
      { value: `${num}/${den * max}`, misconception: 'whole-as-unit' },
      { value: `${r}/${den}`, misconception: 'drop-whole' },
    ],
  };
}

/** 仮分数 → 帯分数（alt: 図から 帯分数） */
function toMixed(level: number, rng: Rng, alt: boolean): NumberItem {
  const [num, den] = improper(rng, level === 0 ? 6 : 9, level === 0 ? 2 : 4);
  const w = Math.floor(num / den);
  const r = num % den;
  const answers = [frac(num, den, { allowImproper: false })];
  return {
    engine: 'number',
    id: `toMixed${alt ? '-alt' : ''}:${num}/${den}`,
    objective: 'toMixed',
    level,
    prompt: alt
      ? '色を ぬった 部分の 長さを 帯分数で 表そう（テープ 1本が 1）。'
      : `${F(num, den)}を 帯分数に しよう。`,
    figure: alt ? barsFig(w, r, den) : expr(F(num, den)),
    hints: alt
      ? [
          `テープ 1本は ${den}こに 分けて あるよ。`,
          'ぜんぶ ぬった テープが 何本 あるか 数えよう。それが 整数の 部分。',
          `のこりの テープは、${den}こに 分けた うちの いくつ分を ぬって あるかな。それが 分子だよ。`,
        ]
      : [
          `${F(den, den)}で 1に なるよ。`,
          `${num} ÷ ${den} を 考えよう。`,
          `わり算の 商が 整数の 部分、あまりが 分子に なるよ。分母は ${den}の まま。`,
        ],
    explain: `${num} ÷ ${den} ＝ ${w} あまり ${r}なので、${F(num, den)} ＝ ${M(w, r, den)}です。`,
    explainFigure: barsFig(w, r, den),
    identity: `toMixed${alt ? ':bar' : ''}:${num}/${den}`,
    alt,
    fields: [{ answer: answers[0]! }],
    keys: ['fraction'],
    wrongAnswers: wrongList(answers, [
      [`${w}と${num - w}/${den}`, 'sub-whole'],
      [`${w + 1}と${r}/${den}`, 'div-miss'],
      [w > 1 ? `${w - 1}と${r}/${den}` : null, 'div-miss'],
      [r !== w && w < den ? `${r}と${w}/${den}` : null, 'swap-parts'],
    ]),
  };
}

/** 帯分数 → 仮分数（alt: 図から 仮分数） */
function toImproper(level: number, rng: Rng, alt: boolean): NumberItem {
  const [num, den] = improper(rng, level === 0 ? 6 : 9, level === 0 ? 2 : 4);
  const w = Math.floor(num / den);
  const r = num % den;
  const answers = [frac(num, den, { allowMixed: false })];
  return {
    engine: 'number',
    id: `toImproper${alt ? '-alt' : ''}:${num}/${den}`,
    objective: 'toImproper',
    level,
    prompt: alt
      ? '色を ぬった 部分の 長さを 仮分数で 表そう（テープ 1本が 1）。'
      : `${M(w, r, den)}を 仮分数に しよう。`,
    figure: alt ? barsFig(w, r, den) : expr(M(w, r, den)),
    hints: alt
      ? [
          `1めもりは ${F(1, den)}。`,
          `ぬった めもりを ぜんぶ 数えよう。テープ 1本で ${den}こ。`,
          `${den} × ${w} ＋ ${r}を 計算しよう。`,
        ]
      : [
          `1は ${F(den, den)}だよ。`,
          `${w}は ${F(1, den)}が ${den} × ${w}こ。`,
          `${den} × ${w} ＝ ${den * w}。これに ${r}を たすと…`,
        ],
    explain: `${den} × ${w} ＋ ${r} ＝ ${num}なので、${M(w, r, den)} ＝ ${F(num, den)}です。`,
    explainFigure: barsFig(w, r, den),
    identity: `toImproper${alt ? ':bar' : ''}:${num}/${den}`,
    alt,
    fields: [{ answer: answers[0]! }],
    keys: ['fraction'],
    wrongAnswers: wrongList(answers, [
      [`${w + r}/${den}`, 'add-whole'],
      [`${w * r + den}/${den}`, 'mult-wrong'],
      [`${w * den}/${den}`, 'forget-num'],
      [`${w * den + r}/${den * w}`, 'mult-wrong'],
    ]),
  };
}

/** 等しい分数（□に入る数。alt: 選ぶ） */
function equiv(level: number, rng: Rng, alt: boolean): Item {
  const d = rng.int(2, 6);
  let n = rng.int(1, d - 1);
  while (gcd(n, d) !== 1) n = rng.int(1, d - 1);
  const k = rng.int(2, Math.max(2, Math.floor(12 / d)));
  const N = n * k;
  const D = d * k;
  const lineFig: Figure = {
    kind: 'column',
    gap: 1,
    items: [
      {
        kind: 'numberline',
        min: 0,
        max: 1,
        step: 1 / d,
        marks: [{ at: n / d, label: F(n, d), tone: 'focus' }],
      },
      {
        kind: 'numberline',
        min: 0,
        max: 1,
        step: 1 / D,
        marks: [{ at: N / D, label: '？', tone: 'focus' }],
      },
    ],
  };
  if (alt) {
    const item: ChoiceItem = {
      engine: 'choice',
      id: `equiv-alt:${n}/${d}:${D}`,
      objective: 'equiv',
      level,
      prompt: `数直線を 見て、${F(n, d)}と 大きさの 等しい 分数を えらぼう。`,
      figure: lineFig,
      hints: [
        '2本の 数直線で、同じ 位置に ある めもりを 見よう。',
        `下の 数直線は 1を ${D}こに 分けて いるよ。`,
        `分母が ${k}倍なら、分子も ${k}倍。`,
      ],
      explain: `${F(n, d)}と ${F(N, D)}は 数直線の 同じ 位置に あるので、大きさが 等しい 分数です。`,
      identity: `equiv-pick:${n}/${d}:${D}`,
      alt: true,
      options: opts(F(N, D), [
        [F(n + (D - d), D), 'add-same'],
        [F(n, D), 'same-num'],
        [F(D, N), 'swap-nd'],
      ]),
    };
    return item;
  }
  const askNum = rng.next() < 0.6;
  const answers = [{ kind: 'int' as const, value: askNum ? N : D }];
  const item: NumberItem = {
    engine: 'number',
    id: `equiv:${n}/${d}:${N}/${D}:${askNum ? 'n' : 'd'}`,
    objective: 'equiv',
    level,
    prompt: '□に あてはまる 数を 求めよう。',
    figure: expr(askNum ? `${F(n, d)} ＝ [[□/${D}]]` : `${F(n, d)} ＝ [[${N}/□]]`),
    hints: [
      '数直線を ならべると、大きさの 等しい 分数が 見つかるよ。',
      askNum
        ? `分母は ${d}から ${D}に なったね。${D} ÷ ${d} ＝ ${k}。`
        : `分子は ${n}から ${N}に なったね。${N} ÷ ${n} ＝ ${k}。`,
      askNum
        ? `分子にも 同じ数を かけよう。${n} × ${k}。`
        : `分母にも 同じ数を かけよう。${d} × ${k}。`,
    ],
    explain: `分母と 分子に 同じ数 ${k}を かけると、大きさの 等しい 分数に なります。${F(n, d)} ＝ ${F(N, D)}。`,
    explainFigure: lineFig,
    identity: `equiv:${n}/${d}:${N}/${D}:${askNum ? 'n' : 'd'}`,
    alt: false,
    fields: [{ answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [askNum ? n + (D - d) : d + (N - n), 'add-same'],
      [askNum ? n : d, 'same-num'],
    ]),
  };
  return item;
}

/** 大小（仮分数と帯分数） */
function compare(level: number, rng: Rng, alt: boolean): ChoiceItem {
  const den = rng.int(2, 9);
  const w = rng.int(1, 3);
  const r = rng.int(1, den - 1);
  const mixedVal = w * den + r;
  const delta = pick(rng, [-2, -1, 0, 1, 2]);
  const num = Math.max(den + 1, mixedVal + delta);
  const cmp = num === mixedVal ? 0 : num > mixedVal ? 1 : -1;
  const a = F(num, den);
  const b = M(w, r, den);
  const options = [
    cmp > 0
      ? { label: a, correct: true }
      : { label: a, misconception: num > r + w ? 'compare-num' : 'compare-form' },
    cmp < 0 ? { label: b, correct: true } : { label: b, misconception: 'compare-form' },
    cmp === 0 ? { label: '同じ', correct: true } : { label: '同じ', misconception: 'compare-form' },
  ];
  return {
    engine: 'choice',
    id: `compare${alt ? '-alt' : ''}:${num}/${den}:${w}-${r}`,
    objective: 'compare',
    level,
    prompt: alt
      ? `${a}と ${b}を 数直線で くらべます。大きいのは どっち？`
      : `${a}と ${b}、大きいのは どっち？`,
    figure: alt
      ? {
          kind: 'numberline',
          min: 0,
          max:
            Math.ceil(Math.max(num, mixedVal) / den) +
            (Math.max(num, mixedVal) % den === 0 ? 1 : 0),
          step: 1 / den,
          labelEvery: den,
        }
      : undefined,
    fixedOrder: true,
    hints: [
      '同じ 形に そろえて くらべよう。',
      `${b}を 仮分数に なおそう。整数の ${w}は ${F(1, den)}が いくつ分かな。`,
      `${den} × ${w} ＋ ${r}を 計算して、${a}の 分子の ${num}と くらべよう。`,
    ],
    explain: `${b} ＝ ${F(mixedVal, den)}。${cmp === 0 ? '同じ 大きさです。' : `${cmp > 0 ? a : b}の ほうが 大きいです。`}`,
    identity: `compare:${num}/${den}:${w}-${r}${alt ? ':line' : ''}`,
    alt,
    options,
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['kind', 'nl'] },
  { objs: ['toMixed', 'toImproper', 'nl'] },
  { objs: ['equiv', 'compare', 'toMixed', 'toImproper'] },
  { objs: ['kind', 'nl', 'toMixed', 'toImproper', 'equiv', 'compare'] },
];

export function generateFractionKinds(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'kind':
      return kind(level, rng, alt);
    case 'nl':
      return nl(level, rng, alt);
    case 'toMixed':
      return toMixed(level, rng, alt);
    case 'toImproper':
      return toImproper(level, rng, alt);
    case 'equiv':
      return equiv(level, rng, alt);
    case 'compare':
      return compare(level, rng, alt);
  }
}

export const fractionKinds: UnitSpec = finishUnit({
  id: 'g4.math.fraction-kinds',
  title: '分数の しゅるい（真分数・仮分数・帯分数）',
  stage: 'g4',
  subject: 'math',
  domain: 'A-number',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'math-split',
  prereq: ['g3.math.fractions'],
  objectives: [
    { id: 'kind', title: '真分数・仮分数・帯分数を 見分ける' },
    { id: 'nl', title: '数直線で 分数を 読む・おく' },
    { id: 'toMixed', title: '仮分数を 帯分数に' },
    { id: 'toImproper', title: '帯分数を 仮分数に' },
    { id: 'equiv', title: '大きさの 等しい 分数' },
    { id: 'compare', title: '分数の 大きさくらべ' },
  ],
  misconceptions: [
    {
      id: 'kind-name',
      explain:
        '名前を とりちがえたのかな。分子が 分母より 小さいのが 真分数、分子が 分母と 同じか 大きいのが 仮分数、整数と 真分数を あわせたのが 帯分数だよ。',
    },
    {
      id: 'equal-one',
      explain:
        '分子と 分母が 同じ 分数は 1と 同じ 大きさ。1より 小さくないので 仮分数の なかまだよ。',
    },
    {
      id: 'mixed-frac-big',
      explain:
        '帯分数の 分数の 部分は、1より 小さい 真分数に するよ。1以上 あったら、整数の 部分に くり上げよう。',
    },
    {
      id: 'sub-whole',
      explain:
        '分子から 整数の 数を ひいたのかな。1は 分母と 同じ数の 分子だよ。分子 ÷ 分母の 商が 整数、あまりが 分子に なるよ。',
    },
    {
      id: 'div-miss',
      explain:
        '分子 ÷ 分母の 商を まちがえたのかな。分母 × 整数の 部分 ＋ 分子で、もとの 分子に もどるか たしかめよう。',
    },
    {
      id: 'swap-parts',
      explain:
        '整数の 部分と 分子を 入れかえたのかな。分子 ÷ 分母の 商が 整数の 部分、あまりが 分子だよ。',
    },
    {
      id: 'add-whole',
      explain:
        '整数を そのまま 分子に たしたのかな。整数 1は 分母と 同じ数の 分子に なるので、分母 × 整数を たそう。',
    },
    {
      id: 'mult-wrong',
      explain:
        'かけ算と たし算の 組み合わせを まちがえたのかな。分母 × 整数の 部分 ＋ 分子 が 仮分数の 分子だよ。',
    },
    {
      id: 'forget-num',
      explain: '分子を たしわすれたのかな。整数の 部分を 分数に した あと、もとの 分子も たそう。',
    },
    {
      id: 'add-same',
      explain:
        '分母と 分子に 同じ数を たしたのかな。大きさの 等しい 分数は、分母と 分子に 同じ数を かけて 作るよ。',
    },
    {
      id: 'same-num',
      explain: '分子は そのままに したのかな。分母を 何倍かしたら、分子も 同じだけ 何倍かしよう。',
    },
    {
      id: 'swap-nd',
      explain: '分子と 分母を 入れかえたのかな。分数の 上が 分子、下が 分母だよ。',
    },
    {
      id: 'compare-num',
      explain: '分子の 数だけ 見て くらべたのかな。形を そろえてから くらべよう。',
    },
    {
      id: 'compare-form',
      explain:
        '仮分数か 帯分数の どちらかに そろえて くらべよう。そろえると 分子で くらべられるよ。',
    },
    {
      id: 'scale-one',
      explain: '1めもりを 1と みたのかな。0から 1までを いくつに 分けて いるかを 見よう。',
    },
    {
      id: 'count-tick',
      explain: 'めもりを 1つ 数えちがえたのかな。0から 指で 1つずつ 数えて みよう。',
    },
    {
      id: 'whole-as-unit',
      explain: '数直線 ぜんたいを 1と 考えたのかな。1は 0から 1までの 長さだよ。',
    },
    {
      id: 'drop-whole',
      explain: '整数の 部分を わすれたのかな。1より 右に ある めもりは 1より 大きい 数だよ。',
    },
  ],
  levels: [
    { label: '分数の しゅるい・数直線', chance: 0.05 },
    { label: '仮分数 ⇔ 帯分数', chance: 0.05 },
    { label: '等しい 分数・大きさくらべ', chance: 0.05 },
    { label: 'まとめ', chance: 0.05 },
  ],
  intro: [
    {
      text: '[[2/3]]のように 1より 小さい 分数を 真分数、[[3/3]]や [[5/3]]のように 1と 等しいか 1より 大きい 分数を 仮分数と いいます。',
      figure: {
        kind: 'numberline',
        min: 0,
        max: 2,
        step: 1 / 3,
        labelEvery: 3,
        marks: [
          { at: 2 / 3, label: '[[2/3]]' },
          { at: 5 / 3, label: '[[5/3]]', tone: 'focus' },
        ],
      },
    },
    {
      text: '[[5/3]]は 1と [[2/3]]を あわせた 数。これを [[1 2/3]]と 書き、帯分数と いいます。',
      figure: barsFig(1, 2, 3),
    },
    {
      text: '仮分数 → 帯分数は わり算で。5 ÷ 3 ＝ 1 あまり 2 → [[1 2/3]]。帯分数 → 仮分数は 3 × 1 ＋ 2 ＝ 5 → [[5/3]]。',
      figure: expr('[[5/3]] ＝ [[1 2/3]]'),
    },
    {
      text: '[[1/2]]と [[2/4]]と [[3/6]]は、数直線の 同じ 位置に あります。大きさの 等しい 分数です。',
      figure: {
        kind: 'column',
        gap: 1,
        items: [
          {
            kind: 'numberline',
            min: 0,
            max: 1,
            step: 1 / 2,
            marks: [{ at: 0.5, label: '[[1/2]]' }],
          },
          {
            kind: 'numberline',
            min: 0,
            max: 1,
            step: 1 / 4,
            marks: [{ at: 0.5, label: '[[2/4]]' }],
          },
          {
            kind: 'numberline',
            min: 0,
            max: 1,
            step: 1 / 6,
            marks: [{ at: 0.5, label: '[[3/6]]' }],
          },
        ],
      },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateFractionKinds(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第4学年 A(7) 分数（真分数・仮分数・帯分数、大きさの等しい分数）',
  revised: REVISED,
});
