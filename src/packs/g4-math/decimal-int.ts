/**
 * g4.math.decimal-int 小数 × 整数・小数 ÷ 整数（わり進む・あまり・商のがい数）（curriculum-matrix 3.7）。
 *
 * 小数は「0.1（0.01）が 何こ」の整数で持ち、浮動小数点で計算しない（util の dec）。答えは小数で（形式指定）。
 * 同一性キー: 式（かける順は 小数 × 整数 の形に固定）。文章題は 場面 × 式。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { dec, decAns, decFixed, expr, finishUnit, pick, pickObj, REVISED, wrongList } from './util';

type Obj = 'mul1' | 'mul2' | 'div' | 'further' | 'rem' | 'story';

/** 右を そろえた かけ算の筆算の形 */
function mulFig(a: string, b: string): Figure {
  const w = Math.max(a.length, b.length);
  const cells = (s: string) =>
    s
      .padStart(w, ' ')
      .split('')
      .map((c) => (c === ' ' ? '' : c));
  return {
    kind: 'table',
    header: Array.from({ length: w + 1 }, () => ''),
    rows: [
      ['', ...cells(a)],
      ['×', ...cells(b)],
    ],
  };
}

/** わり算の筆算の形（わる数 ）わられる数） */
function divFig(a: string, n: number): Figure {
  return {
    kind: 'table',
    header: ['', ...a.split('').map(() => '')],
    rows: [
      ['商', ...a.split('').map((c) => (c === '.' ? '.' : ''))],
      [`${n} ）`, ...a.split('')],
    ],
  };
}

const zeros = (p: number) => `0.${'0'.repeat(p - 1)}1`;

function decimal(rng: Rng, max: number): number {
  for (;;) {
    const v = rng.int(1, max);
    if (v % 10 !== 0) return v;
  }
}

function mul(obj: 'mul1' | 'mul2', level: number, rng: Rng, alt: boolean): NumberItem {
  const p = obj === 'mul1' ? (level === 0 ? 1 : rng.int(1, 2)) : rng.int(1, 2);
  const v = decimal(rng, p === 1 ? 99 : 999);
  const b = obj === 'mul1' ? rng.int(2, 9) : rng.int(11, 99);
  const a = dec(v, p);
  const prod = v * b;
  const answers = [decAns(prod, p)];
  return {
    engine: 'number',
    id: `${obj}${alt ? '-alt' : ''}:${a}x${b}`,
    objective: obj,
    level,
    prompt: alt ? '筆算で 計算しよう。' : '計算しよう。',
    figure: alt ? mulFig(a, String(b)) : expr(`${a} × ${b} ＝ {{}}`),
    hints: [
      `${a}は ${zeros(p)}が ${v}こ。整数の かけ算で 考えよう。`,
      `${v} × ${b} ＝ ${prod}。`,
      `${zeros(p)}が ${prod}こで いくつかな。小数点は かけられる数と 同じ けたに 打つよ。`,
    ],
    explain: `${zeros(p)}が ${v} × ${b} ＝ ${prod}こなので、${a} × ${b} ＝ ${dec(prod, p)}。筆算は 右に そろえて 書き、かけられる数の 小数点に そろえて 小数点を 打ちます。`,
    explainFigure: mulFig(a, String(b)),
    identity: `${a}x${b}`,
    alt,
    fields: [{ answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongList(answers, [
      [prod, 'point-place'],
      [dec(prod, p + 1), 'point-place'],
      [p === 2 ? dec(prod, 1) : null, 'point-place'],
    ]),
  };
}

/** わりきれる 小数 ÷ 整数 */
function div(level: number, rng: Rng, alt: boolean): NumberItem {
  const n = level <= 1 ? rng.int(2, 9) : rng.int(2, 19);
  const p = rng.int(1, 2);
  const qv = decimal(rng, p === 1 ? 99 : 300);
  const av = qv * n;
  const a = dec(av, p);
  const q = dec(qv, p);
  const answers = [decAns(qv, p)];
  return {
    engine: 'number',
    id: `div${alt ? '-alt' : ''}:${a}÷${n}`,
    objective: 'div',
    level,
    prompt: alt ? '筆算で 計算しよう。' : '計算しよう。',
    figure: alt ? divFig(a, n) : expr(`${a} ÷ ${n} ＝ {{}}`),
    hints: [
      `${a}は ${zeros(p)}が ${av}こ。`,
      qv < 10 ** p
        ? `一の位は ${n}で われないので、商の 一の位に 0を 書いて、小数点を 打とう。`
        : '整数と 同じように わって、わられる数の 小数点に そろえて 商の 小数点を 打とう。',
      `${av} ÷ ${n} ＝ ${qv}。${zeros(p)}が ${qv}こで…`,
    ],
    explain: `${zeros(p)}が ${av} ÷ ${n} ＝ ${qv}こなので、${a} ÷ ${n} ＝ ${q}。商の 小数点は わられる数の 小数点に そろえます。`,
    explainFigure: divFig(a, n),
    identity: `${a}÷${n}`,
    alt,
    fields: [{ answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongList(answers, [
      [qv < 10 ** p ? qv : null, 'zero-head'],
      [qv, 'point-place'],
      [dec(qv, p + 1), 'point-place'],
      [dec(qv, p - 1), 'point-place'],
    ]),
  };
}

/** わりきれるまで わり進む（5 ÷ 4 ＝ 1.25） */
function further(level: number, rng: Rng, alt: boolean): NumberItem {
  for (;;) {
    const n = pick(rng, [2, 4, 5, 8, 6, 12, 15, 25]);
    const pa = rng.int(0, 1);
    const av = rng.int(n + 1, pa === 0 ? 99 : 999);
    if (pa === 1 && av % 10 === 0) continue;
    // 商が 何けたで わりきれるか（1/1000 まで）
    let k = 0;
    while (k <= 3 && (av * 10 ** k) % n !== 0) k++;
    if (k === 0 || k > 3) continue;
    const P = pa + k; // 商の小数のけた数
    const qv = (av * 10 ** k) / n;
    if (qv % 10 === 0) continue;
    const a = dec(av, pa);
    const q = dec(qv, P);
    // わり進まずに 止めた 商（わられる数と同じけたまで）
    const stop = dec(Math.floor(av / n), pa);
    const answers = [decAns(qv, P)];
    return {
      engine: 'number',
      id: `further${alt ? '-alt' : ''}:${a}÷${n}`,
      objective: 'further',
      level,
      prompt: alt ? 'わりきれるまで 筆算で 計算しよう。' : 'わりきれるまで 計算しよう。',
      figure: alt ? divFig(a, n) : expr(`${a} ÷ ${n} ＝ {{}}`),
      hints: [
        'あまりが 出たら、0を つけたして わり進もう。',
        `${a}を ${decFixed(av * 10 ** k, P)}と 考えると、${zeros(P)}が ${av * 10 ** k}こ。`,
        `${av * 10 ** k} ÷ ${n} ＝ ${qv}。${zeros(P)}が ${qv}こで…`,
      ],
      explain: `${a}を ${decFixed(av * 10 ** k, P)}と 考えて わり進むと、${a} ÷ ${n} ＝ ${q}。わりきれるまで 0を つけたして 計算します。`,
      explainFigure: divFig(decFixed(av * 10 ** k, P), n),
      identity: `${a}÷${n}`,
      alt,
      fields: [{ answer: answers[0]! }],
      keys: ['decimal'],
      wrongAnswers: wrongList(answers, [
        [stop, 'stop-early'],
        [P - 1 > pa ? dec(Math.floor(qv / 10), P - 1) : null, 'stop-early'],
        [qv, 'point-place'],
        [dec(qv, P + 1), 'point-place'],
      ]),
    };
  }
}

/** 商は 一の位まで、あまりも 出す（alt: 商を 四捨五入で 1/10 の位まで） */
function rem(level: number, rng: Rng, alt: boolean): NumberItem {
  const n = rng.int(2, 9);
  if (alt) {
    for (;;) {
      const av = rng.int(n * 10 + 1, 99 * n);
      if (av % 10 === 0) continue;
      // 1/100 の位まで 計算して 四捨五入
      const q100 = Math.floor((av * 10) / n); // 1/100 の 単位
      if ((av * 10) % n === 0 && q100 % 10 === 0) continue;
      const q10 = Math.floor((q100 + 5) / 10);
      const cut = Math.floor(q100 / 10);
      const a = dec(av, 1);
      const answers = [decAns(q10, 1)];
      return {
        engine: 'number',
        id: `rem-alt:${a}÷${n}`,
        objective: 'rem',
        level,
        prompt: `${a} ÷ ${n}の 商を、四捨五入して [[1/10]]の位までの がい数で 求めよう。`,
        figure: expr(`${a} ÷ ${n}`),
        hints: [
          '[[1/10]]の位までの がい数に するので、[[1/100]]の位まで 計算しよう。',
          `[[1/100]]の位まで 計算すると ${dec(q100, 2)}。`,
          `[[1/100]]の位の ${q100 % 10}を 四捨五入しよう。`,
        ],
        explain: `${a} ÷ ${n} ＝ ${dec(q100, 2)}…。[[1/100]]の位を 四捨五入して ${dec(q10, 1)}です。`,
        identity: `round:${a}÷${n}`,
        alt: true,
        fields: [{ label: '約', answer: answers[0]! }],
        keys: ['decimal'],
        wrongAnswers: wrongList(answers, [
          [q10 !== cut ? dec(cut, 1) : dec(cut + 1, 1), 'round-cut'],
          [dec(q100, 2), 'round-cut'],
          [q10, 'point-place'],
        ]),
      };
    }
  }
  for (;;) {
    const av = rng.int(n * 10 + 1, 99 * n);
    if (av % 10 === 0) continue;
    const q = Math.floor(av / 10 / n);
    const rv = av - q * n * 10; // 0.1 の単位
    if (q < 1 || rv === 0) continue;
    const a = dec(av, 1);
    const r = dec(rv, 1);
    const answers = [{ kind: 'int' as const, value: q }, decAns(rv, 1)];
    const fullQ = (av * 100) % n === 0 ? dec((av * 100) / n, 3) : null;
    return {
      engine: 'number',
      id: `rem:${a}÷${n}`,
      objective: 'rem',
      level,
      prompt: `${a} ÷ ${n}の 商を 一の位まで 求めて、あまりも 出そう。`,
      figure: expr(`${a} ÷ ${n}`),
      hints: [
        '商は 一の位で 止めるよ。',
        `${Math.floor(av / 10)} ÷ ${n} ＝ ${q} あまり ${Math.floor(av / 10) - q * n}。`,
        `あまりの 小数点は、わられる数の 小数点に そろえるよ。${a} − ${n} × ${q}を 計算しよう。`,
      ],
      explain: `${a} ÷ ${n} ＝ ${q} あまり ${r}。たしかめ: ${n} × ${q} ＋ ${r} ＝ ${a}。あまりの 小数点は わられる数の 小数点に そろえます。`,
      identity: `rem:${a}÷${n}`,
      alt: false,
      fields: [
        { label: '商', answer: answers[0]! },
        { label: 'あまり', answer: answers[1]! },
      ],
      keys: ['decimal'],
      wrongAnswers: wrongList(answers, [
        [`${q}|${rv}`, 'rem-point'],
        [`${q}|${dec(rv, 2)}`, 'rem-point'],
        [fullQ ? `${fullQ}|0` : null, 'rem-continue'],
      ]),
    };
  }
}

interface Scene {
  id: string;
  op: 'mul' | 'div';
  unit: string;
  text: (a: string, n: number) => string;
}
const SCENES: Scene[] = [
  {
    id: 'bottle',
    op: 'mul',
    unit: 'L',
    text: (a, n) => `1本 ${a}Lの ジュースが ${n}本 あります。全部で 何Lですか。`,
  },
  {
    id: 'tape',
    op: 'mul',
    unit: 'm',
    text: (a, n) => `1人 ${a}mずつ テープを 使います。${n}人では 何m いりますか。`,
  },
  {
    id: 'box',
    op: 'mul',
    unit: 'kg',
    text: (a, n) => `1こ ${a}kgの 荷物が ${n}こ あります。全部で 何kgですか。`,
  },
  {
    id: 'walk',
    op: 'mul',
    unit: 'km',
    text: (a, n) => `毎日 ${a}km 歩きます。${n}日間では 何km 歩きますか。`,
  },
  {
    id: 'rope',
    op: 'div',
    unit: 'm',
    text: (a, n) => `${a}mの ロープを ${n}人で 同じ長さずつ 分けます。1人 何mに なりますか。`,
  },
  {
    id: 'water',
    op: 'div',
    unit: 'L',
    text: (a, n) => `${a}Lの 水を ${n}このコップに 同じ量ずつ 分けます。1こ 何Lに なりますか。`,
  },
  {
    id: 'rice',
    op: 'div',
    unit: 'kg',
    text: (a, n) =>
      `${a}kgの お米を ${n}つの ふくろに 同じ重さずつ 分けます。1ふくろ 何kgに なりますか。`,
  },
  {
    id: 'run',
    op: 'div',
    unit: 'km',
    text: (a, n) =>
      `${n}日間で ${a}km 走りました。1日に 同じ道のりずつ 走ったとすると、1日 何kmですか。`,
  },
];

function story(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, SCENES);
  const n = rng.int(3, 15);
  const p = rng.int(1, 2);
  const v = decimal(rng, p === 1 ? 50 : 300);
  const av = sc.op === 'mul' ? v : v * n;
  const a = dec(av, p);
  const ans = sc.op === 'mul' ? v * n : v;
  const answers = [decAns(ans, p)];
  const sym = sc.op === 'mul' ? '×' : '÷';
  return {
    engine: 'number',
    id: `story${alt ? '-alt' : ''}:${sc.id}:${a}${sym}${n}`,
    objective: 'story',
    level,
    prompt: sc.text(a, n),
    figure: alt
      ? {
          kind: 'tape',
          parts: [
            { length: 2, label: sc.op === 'mul' ? `${a}${sc.unit}` : '？', tone: 'a' },
            { length: 2, label: sc.op === 'mul' ? `${a}${sc.unit}` : '？', tone: 'a' },
            { length: 3, label: `…（${n}つ分）` },
          ],
          total: sc.op === 'mul' ? '？' : `${a}${sc.unit}`,
        }
      : undefined,
    hints: [
      sc.op === 'mul'
        ? '1つ分の 量の いくつ分を 求めるので かけ算だね。'
        : '同じ量ずつ 分けた 1つ分を 求めるので わり算だね。',
      `式は ${a} ${sym} ${n}。`,
      `${zeros(p)}の いくつ分で 考えると、${av} ${sym} ${n}。`,
    ],
    explain: `${a} ${sym} ${n} ＝ ${dec(ans, p)}。答えは ${dec(ans, p)}${sc.unit}です。`,
    identity: `story:${sc.id}:${a}${sym}${n}`,
    alt,
    fields: [{ label: sc.unit, answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongList(answers, [
      [ans, 'point-place'],
      [dec(ans, p + 1), 'point-place'],
      [sc.op === 'mul' ? (av % n === 0 ? dec(av / n, p) : null) : dec(av * n, p), 'op-swap'],
    ]),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['mul1', 'mul2'] },
  { objs: ['div', 'mul1', 'mul2'] },
  { objs: ['further', 'rem', 'div'] },
  { objs: ['story', 'further', 'rem', 'mul2'] },
];

export function generateDecimalInt(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'mul1':
    case 'mul2':
      return mul(obj, level, rng, alt);
    case 'div':
      return div(level, rng, alt);
    case 'further':
      return further(level, rng, alt);
    case 'rem':
      return rem(level, rng, alt);
    case 'story':
      return story(level, rng, alt);
  }
}

export const decimalInt: UnitSpec = finishUnit({
  id: 'g4.math.decimal-int',
  title: '小数 × 整数、小数 ÷ 整数',
  stage: 'g4',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'math-formula-add',
  prereq: ['g4.math.div-1digit', 'g4.math.decimal-add-sub'],
  objectives: [
    { id: 'mul1', title: '小数 × 1けた' },
    { id: 'mul2', title: '小数 × 2けた' },
    { id: 'div', title: '小数 ÷ 整数（わりきれる）' },
    { id: 'further', title: 'わりきれるまで わり進む' },
    { id: 'rem', title: 'あまりを 出す・商を がい数で' },
    { id: 'story', title: '文章題' },
  ],
  misconceptions: [
    {
      id: 'point-place',
      explain:
        '小数点の 位置が ずれたのかな（または 打ちわすれたのかな）。小数 × 整数は、かけられる数と 同じ けたに 小数点を 打つよ。わり算は、わられる数の 小数点に そろえて 商の 小数点を 打とう。',
    },
    {
      id: 'zero-head',
      explain:
        '商の 一の位に 0を 書きわすれたのかな。一の位で われない ときは 0を 書いて、小数点を 打ってから つづけよう。',
    },
    {
      id: 'stop-early',
      explain:
        'とちゅうで わるのを 止めたのかな。「わりきれるまで」の ときは、0を つけたして あまりが 0に なるまで わり進むよ。',
    },
    {
      id: 'rem-point',
      explain:
        'あまりの 小数点を わすれたのかな。あまりの 小数点は、わられる数の 小数点の 位置に そろえるよ。たしかめの 式で 見直そう。',
    },
    {
      id: 'rem-continue',
      explain: '商を 一の位で 止める 問題だよ。わり進まずに、一の位まで 求めて あまりを 出そう。',
    },
    {
      id: 'round-cut',
      explain:
        '四捨五入を わすれたのかな。[[1/10]]の位までの がい数に するときは、[[1/100]]の位まで 計算して 四捨五入するよ。',
    },
    {
      id: 'op-swap',
      explain:
        'かけ算と わり算を 反対に したのかな。いくつ分を 求めるときは かけ算、1つ分を 求めるときは わり算だよ。',
    },
  ],
  levels: [
    { label: '小数 × 整数', chance: 0.02 },
    { label: '小数 ÷ 整数', chance: 0.02 },
    { label: 'わり進む・あまり・がい数', chance: 0.02 },
    { label: '文章題・まとめ', chance: 0.02 },
  ],
  intro: [
    {
      text: '1.8 × 4は、0.1が 18 × 4 ＝ 72こ。だから 7.2です。',
      figure: expr('1.8 × 4 ＝ 7.2'),
    },
    {
      text: '筆算では 右に そろえて 書き、整数と 同じように 計算してから、かけられる数と 同じ けたに 小数点を 打ちます。',
      figure: mulFig('1.8', '4'),
    },
    {
      text: '7.2 ÷ 3は、0.1が 72 ÷ 3 ＝ 24こ。商の 小数点は わられる数の 小数点に そろえて 2.4。',
      figure: divFig('7.2', 3),
    },
    {
      text: '5 ÷ 4のように あまりが 出る ときは、5を 5.00と 考えて 0を つけたし、わり進みます。5 ÷ 4 ＝ 1.25。',
      figure: expr('5 ÷ 4 ＝ 1.25'),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateDecimalInt(level, rng, index),
  },
  review: 'type',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第4学年 A(6) 小数の乗法・除法（乗数・除数が整数の場合、わり進む、商の概数）',
  revised: REVISED,
});
