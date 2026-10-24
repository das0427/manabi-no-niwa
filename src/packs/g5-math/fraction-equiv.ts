/**
 * g5.math.fraction-equiv 等しい分数・約分・通分・分数の大小（curriculum-matrix 3.8）。
 *
 * 約分の問題は mustReduce（約分しきっていない等しい分数は「もう少し」）。通分は、いちばん小さい共通な分母
 * （分母の最小公倍数）と それぞれの分子を 整数の欄で答える（分数の欄では値しか比べられないため）。
 * 同一性キー: 問う形 × 分数（通分・大小は 2つの分数の組。並べる順は同じ問題）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import {
  expr,
  finishUnit,
  gcd,
  lcm,
  pick,
  pickObj,
  REVISED,
  STROKE,
  svg,
  svgText,
  wrongList,
} from './util';

type Obj = 'equal' | 'reduce' | 'common' | 'compare';

const F = (n: number, d: number) => `[[${n}/${d}]]`;

/** 真分数（既約）a/b、b ≤ maxDen */
const PROPER: [number, number][] = [];
for (let b = 2; b <= 12; b++) for (let a = 1; a < b; a++) if (gcd(a, b) === 1) PROPER.push([a, b]);

/** 分数の形の図（□は 空欄） */
function fracBox(top: string | null, bottom: string | null): Figure {
  const part = (s: string | null, y: number) =>
    s === null
      ? `<rect x="14" y="${y - 18}" width="36" height="36" rx="4" fill="none" ${STROKE}/>`
      : svgText(32, y, s, 26);
  return svg(
    64,
    100,
    `${part(top, 26)}<line x1="6" y1="50" x2="58" y2="50" ${STROKE}/>${part(bottom, 76)}`,
    '分数の くうらん',
  );
}

/** テープ図: 上は b等分の a、下は n等分（色の部分は同じ長さ） */
function tapes(a: number, b: number, n: number): Figure {
  const W = 300;
  const tape = (y: number, parts: number, shade: number) => {
    let s = `<rect x="10" y="${y}" width="${(W * shade) / parts}" height="30" fill="var(--sky)"/>`;
    s += `<rect x="10" y="${y}" width="${W}" height="30" fill="none" ${STROKE}/>`;
    for (let i = 1; i < parts; i++) {
      const x = 10 + (W * i) / parts;
      s += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 30}" stroke="var(--ink)" stroke-width="1.5"/>`;
    }
    return s;
  };
  return svg(W + 20, 90, tape(8, b, a) + tape(52, n, (a * n) / b), '2本の テープ');
}

// ---- 等しい分数 ----
function equal(level: number, rng: Rng, alt: boolean): NumberItem {
  const [a, b] = pick(
    rng,
    PROPER.filter(([, d]) => d <= 9),
  );
  const m = rng.int(2, alt ? Math.max(2, Math.floor(24 / b)) : 6);
  const B = b * m;
  const A = a * m;
  if (alt) {
    const answers = [{ kind: 'int' as const, value: A }];
    return {
      engine: 'number',
      id: `equal-tape:${a}/${b}:${B}`,
      objective: 'equal',
      level,
      prompt: `上の テープの 色の 部分は ${F(a, b)}。下の テープは ${B}等分して あります。色の 部分は ${F(1, B)}の 何こ分ですか。`,
      figure: tapes(a, b, B),
      hints: [
        '2本の テープの 色の 部分は 同じ 長さだよ。',
        `上の 1目もりの 中に、下の 目もりが ${m}こ 入って いるね。`,
        `上の 目もり ${a}こ分に、下の 目もりは ${m}こずつ 入るよ。`,
      ],
      explain: `上の 1目もりに 下の 目もりが ${m}こ 入るので、${a} × ${m} ＝ ${A}こ分。${F(a, b)} ＝ ${F(A, B)}です。`,
      identity: `equal-tape:${a}/${b}:${B}`,
      alt: true,
      fields: [{ label: 'こ分', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [a + (B - b), 'add-instead'],
        [a, 'one-side'],
        [B - A, 'one-side'],
      ]),
    };
  }
  const down = rng.next() < 0.4;
  const askNum = rng.next() < 0.6;
  // up: a/b = ?/B（または A/?）、down: A/B = ?/b（または a/?）
  const [given, ansV, fig] = down
    ? askNum
      ? [F(A, B), a, fracBox(null, String(b))]
      : [F(A, B), b, fracBox(String(a), null)]
    : askNum
      ? [F(a, b), A, fracBox(null, String(B))]
      : [F(a, b), B, fracBox(String(A), null)];
  const answers = [{ kind: 'int' as const, value: ansV }];
  const known = askNum
    ? down
      ? `分母を ${B}から ${b}に`
      : `分母を ${b}から ${B}に`
    : down
      ? `分子を ${A}から ${a}に`
      : `分子を ${a}から ${A}に`;
  const addWrong = down ? (askNum ? A - (B - b) : B - (A - a)) : askNum ? a + (B - b) : b + (A - a);
  return {
    engine: 'number',
    id: `equal:${down ? 'down' : 'up'}:${askNum ? 'n' : 'd'}:${a}/${b}:${m}`,
    objective: 'equal',
    level,
    prompt: `${given}と 等しい 分数に なるように、□に 入る 数を 答えましょう。`,
    figure: { kind: 'row', items: [expr(`${given} ＝`), fig], gap: 8 },
    hints: [
      '分母と 分子に 同じ 数を かけても、同じ 数で わっても、分数の 大きさは 変わらないよ。',
      `${known} するには、${down ? `${m}で わる` : `${m}を かける`}ね。`,
      `${askNum ? '分子' : '分母'}にも 同じように ${down ? `${m}で わろう` : `${m}を かけよう`}。`,
    ],
    explain: `分母と 分子に 同じ 数を ${down ? 'わって' : 'かけて'}、${down ? `${F(A, B)} ＝ ${F(a, b)}` : `${F(a, b)} ＝ ${F(A, B)}`}。□は ${ansV}です。`,
    identity: `equal:${down ? 'down' : 'up'}:${askNum ? 'n' : 'd'}:${a}/${b}:${m}`,
    alt: false,
    fields: [{ label: '□', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [addWrong > 0 ? addWrong : null, 'add-instead'],
      [down ? (askNum ? A : B) : askNum ? a : b, 'one-side'],
    ]),
  };
}

// ---- 約分 ----
function reduce(level: number, rng: Rng, alt: boolean): Item {
  const [a, b] = pick(rng, PROPER);
  const g = rng.int(2, b <= 6 ? 9 : 6);
  const A = a * g;
  const B = b * g;
  // とちゅうまでの 約分（g が 合成数のとき）
  let part: number | null = null;
  for (let p = 2; p < g; p++) if (g % p === 0) part = p;
  if (alt) {
    const cands: [string, string][] = [
      [part ? F(A / part, B / part) : '', 'not-lowest'],
      [F(a, B), 'one-side'],
      [F(A, b), 'one-side'],
      [F(A - (g - 1), B - (g - 1)), 'sub-instead'],
    ];
    const options: ChoiceItem['options'] = [{ label: F(a, b), correct: true }];
    for (const [l, mm] of cands)
      if (l && options.length < 4 && !options.some((o) => o.label === l))
        options.push({ label: l, misconception: mm });
    const item: ChoiceItem = {
      engine: 'choice',
      id: `reduce-alt:${A}/${B}`,
      objective: 'reduce',
      level,
      prompt: `${F(A, B)}を 約分して、いちばん かんたんな 分数に した ものは どれ？`,
      hints: [
        '約分は、分母と 分子を 同じ 数で わって、かんたんな 分数に する ことだよ。',
        `${A}と ${B}の 公約数を さがそう。いちばん 大きい 公約数で わると 1回で すむよ。`,
        `${A}と ${B}を 両方 ${g}で わると…`,
      ],
      explain: `${A}と ${B}の 最大公約数は ${g}。分母と 分子を ${g}で わって ${F(a, b)}です。`,
      identity: `reduce-pick:${A}/${B}`,
      alt: true,
      options,
    };
    return item;
  }
  const answers = [{ kind: 'fraction' as const, num: a, den: b, mustReduce: true }];
  return {
    engine: 'number',
    id: `reduce:${A}/${B}`,
    objective: 'reduce',
    level,
    prompt: '約分しましょう。',
    figure: expr(`${F(A, B)} ＝ {{}}`),
    hints: [
      '分母と 分子を、同じ 数（公約数）で わろう。',
      `${A}と ${B}の 公約数を さがそう。最大公約数で わると 1回で すむよ。`,
      `${A}と ${B}の 最大公約数は ${g}。両方を ${g}で わろう。`,
    ],
    explain: `${A}と ${B}の 最大公約数は ${g}。${A} ÷ ${g} ＝ ${a}、${B} ÷ ${g} ＝ ${b}なので ${F(a, b)}です。`,
    identity: `reduce:${A}/${B}`,
    alt: false,
    fields: [{ answer: answers[0]! }],
    keys: ['fraction'],
    wrongAnswers: wrongList(answers, [
      [`${a}/${B}`, 'one-side'],
      [`${A}/${b}`, 'one-side'],
      [`${A - (g - 1)}/${B - (g - 1)}`, 'sub-instead'],
    ]),
  };
}

// ---- 通分 ----
const PAIRS: [[number, number], [number, number]][] = [];
for (const p of PROPER)
  for (const q of PROPER)
    if (p[1] < q[1] && lcm(p[1], q[1]) <= 60 && q[1] <= 10) PAIRS.push([p, q]);

function common(level: number, rng: Rng, alt: boolean): Item {
  let [[a, b], [c, d]] = pick(rng, PAIRS);
  if (rng.next() < 0.5)
    [[a, b], [c, d]] = [
      [c, d],
      [a, b],
    ];
  const L = lcm(b, d);
  const A = (a * L) / b;
  const C = (c * L) / d;
  const key = [`${a}/${b}`, `${c}/${d}`].sort().join(',');
  const prod = b * d;
  if (alt) {
    const cands: [string, string][] = [
      [prod !== L ? `${F(a * d, prod)}と ${F(c * b, prod)}` : '', 'not-lcm'],
      [`${F(a, L)}と ${F(c, L)}`, 'num-only'],
      [`${F(a + (L - b), L)}と ${F(c + (L - d), L)}`, 'add-instead'],
    ];
    const options: ChoiceItem['options'] = [{ label: `${F(A, L)}と ${F(C, L)}`, correct: true }];
    for (const [l, mm] of cands)
      if (l && !options.some((o) => o.label === l)) options.push({ label: l, misconception: mm });
    const item: ChoiceItem = {
      engine: 'choice',
      id: `common-alt:${key}`,
      objective: 'common',
      level,
      prompt: `${F(a, b)}と ${F(c, d)}を、いちばん 小さい 分母で 通分した ものは どれ？`,
      layout: 'column',
      hints: [
        '通分は、分母が 同じ 分数に なおす ことだよ。',
        `${b}と ${d}の 最小公倍数を 分母に しよう。`,
        `分母を ${L}に するとき、分子にも 分母に かけた 数と 同じ 数を かけよう。`,
      ],
      explain: `${b}と ${d}の 最小公倍数は ${L}。${F(a, b)} ＝ ${F(A, L)}、${F(c, d)} ＝ ${F(C, L)}です。`,
      identity: `common-pick:${key}`,
      alt: true,
      options,
    };
    return item;
  }
  const answers = [
    { kind: 'int' as const, value: L },
    { kind: 'int' as const, value: A },
    { kind: 'int' as const, value: C },
  ];
  const item: NumberItem = {
    engine: 'number',
    id: `common:${key}:${a}/${b}`,
    objective: 'common',
    level,
    prompt: `${F(a, b)}と ${F(c, d)}を 通分します。いちばん 小さい 分母と、それぞれの 分子を 答えましょう。`,
    figure: expr(`${F(a, b)}、${F(c, d)}`),
    hints: [
      '通分では、2つの 分母の 公倍数を 分母に するよ。いちばん 小さい ものは 最小公倍数。',
      `${b}の 倍数と ${d}の 倍数を ならべて、はじめて 同じに なる 数を さがそう。`,
      `分母を ${L}に すると、${F(a, b)}の 分母と 分子には ${L / b}を、${F(c, d)}には ${L / d}を かけるよ。`,
    ],
    explain: `${b}と ${d}の 最小公倍数は ${L}。${F(a, b)} ＝ ${F(A, L)}、${F(c, d)} ＝ ${F(C, L)}です。`,
    identity: `common:${key}`,
    alt: false,
    fields: [
      { label: '分母', answer: answers[0]! },
      { label: `${F(a, b)}の 分子`, answer: answers[1]! },
      { label: `${F(c, d)}の 分子`, answer: answers[2]! },
    ],
    wrongAnswers: wrongList(answers, [
      [prod !== L ? `${prod}|${a * d}|${c * b}` : null, 'not-lcm'],
      [`${L}|${a}|${c}`, 'num-only'],
      [`${L}|${a + (L - b)}|${c + (L - d)}`, 'add-instead'],
    ]),
  };
  return item;
}

// ---- 大小 ----
const CMP: [[number, number], [number, number]][] = [];
for (const p of PROPER)
  for (const q of PROPER) if (p[1] < q[1] && q[1] <= 10 && lcm(p[1], q[1]) <= 60) CMP.push([p, q]);

function compare(level: number, rng: Rng, alt: boolean): ChoiceItem {
  if (alt) {
    // 3つの 分母の 最小公倍数が 60まで（通分して くらべられる 大きさ）
    const fr: [number, number][] = [];
    let L = 1;
    while (fr.length < 3) {
      const f = pick(
        rng,
        PROPER.filter(([, d]) => d <= 9),
      );
      if (fr.some(([x, y]) => x * f[1] === y * f[0]) || lcm(L, f[1]) > 60) continue;
      fr.push(f);
      L = lcm(L, f[1]);
    }
    const vals = fr.map(([x, y]) => x / y);
    const max = Math.max(...vals);
    const sorted = fr.map(([x, y]) => `${x}/${y}`).sort();
    const item: ChoiceItem = {
      engine: 'choice',
      id: `compare-alt:${sorted.join(',')}`,
      objective: 'compare',
      level,
      prompt: 'いちばん 大きい 分数は どれ？',
      hints: [
        '分母が ちがう 分数は、通分すると くらべられるよ。',
        `3つの 分母の 公倍数を 分母に しよう。たとえば ${L}。`,
        `分母を ${L}に そろえて、分子の 大きさを くらべよう。`,
      ],
      explain: `分母を ${L}に そろえると ${fr.map(([x, y]) => `${F(x, y)} ＝ ${F((x * L) / y, L)}`).join('、')}。いちばん 大きいのは ${F(...fr[vals.indexOf(max)]!)}です。`,
      identity: `compare3:${sorted.join(',')}`,
      alt: true,
      options: fr.map(([x, y], i) =>
        vals[i] === max
          ? { label: F(x, y), correct: true }
          : { label: F(x, y), misconception: 'compare-look' },
      ),
    };
    return item;
  }
  let [[a, b], [c, d]] = pick(rng, CMP);
  // 分子を そろえた 組（[[1/3]] と [[1/4]] など）も ときどき
  if (rng.next() < 0.2) {
    a = 1;
    c = 1;
  }
  if (rng.next() < 0.5)
    [[a, b], [c, d]] = [
      [c, d],
      [a, b],
    ];
  const L = lcm(b, d);
  const A = (a * L) / b;
  const C = (c * L) / d;
  const big = A === C ? 'eq' : A > C ? 'p' : 'q';
  const misOf = (den: number, other: number) => (den > other ? 'compare-den' : 'compare-look');
  const item: ChoiceItem = {
    engine: 'choice',
    id: `compare:${a}/${b}:${c}/${d}`,
    objective: 'compare',
    level,
    prompt: `${F(a, b)}と ${F(c, d)}、大きいのは どちら？`,
    hints: [
      '分母が ちがうので、通分して くらべよう。',
      `${b}と ${d}の 最小公倍数 ${L}を 分母に しよう。`,
      `${F(a, b)}と ${F(c, d)}を、分母が ${L}の 分数に なおして 分子を くらべよう。`,
    ],
    explain: `通分すると ${F(a, b)} ＝ ${F(A, L)}、${F(c, d)} ＝ ${F(C, L)}。${big === 'eq' ? '同じ 大きさです。' : `${big === 'p' ? F(a, b) : F(c, d)}の ほうが 大きいです。`}`,
    identity: `compare:${[`${a}/${b}`, `${c}/${d}`].sort().join(',')}`,
    alt: false,
    fixedOrder: true,
    options: [
      big === 'p'
        ? { label: F(a, b), correct: true }
        : { label: F(a, b), misconception: misOf(b, d) },
      big === 'q'
        ? { label: F(c, d), correct: true }
        : { label: F(c, d), misconception: misOf(d, b) },
      big === 'eq'
        ? { label: '同じ', correct: true }
        : { label: '同じ', misconception: 'compare-look' },
    ],
  };
  return item;
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['equal', 'reduce'] },
  { objs: ['common', 'compare', 'reduce'] },
  { objs: ['equal', 'reduce', 'common', 'compare'] },
];

export function generateFractionEquiv(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'equal':
      return equal(level, rng, alt);
    case 'reduce':
      return reduce(level, rng, alt);
    case 'common':
      return common(level, rng, alt);
    case 'compare':
      return compare(level, rng, alt);
  }
}

export const fractionEquiv: UnitSpec = finishUnit(
  {
    id: 'g5.math.fraction-equiv',
    title: '等しい 分数・約分と 通分',
    stage: 'g5',
    subject: 'math',
    domain: 'A-number',
    kind: 'calc',
    priority: 'P1',
    status: 'ready',
    icon: 'math-split',
    prereq: ['g5.math.fraction-decimal', 'g5.math.multiples-divisors'],
    objectives: [
      { id: 'equal', title: '等しい 分数を つくる' },
      { id: 'reduce', title: '約分する' },
      { id: 'common', title: '通分する' },
      { id: 'compare', title: '分母の ちがう 分数の 大きさくらべ' },
    ],
    misconceptions: [
      {
        id: 'add-instead',
        explain:
          '分母と 分子に 同じ 数を たしたのかな。たしても 大きさは 等しく ならないよ。分母と 分子に 同じ 数を かけるか、同じ 数で わろう。',
      },
      {
        id: 'one-side',
        explain:
          '分母か 分子の かたほうだけを 変えたのかな。分母と 分子の 両方に 同じ 数を かける（わる）と、大きさが 変わらないよ。',
      },
      {
        id: 'sub-instead',
        explain:
          '分母と 分子から 同じ 数を ひいたのかな。約分は、分母と 分子を 同じ 数で わる ことだよ。',
      },
      {
        id: 'not-lowest',
        explain:
          'まだ 約分できるよ。分母と 分子の 最大公約数で わると、いちばん かんたんな 分数に なるよ。',
      },
      {
        id: 'not-lcm',
        explain:
          '分母どうしを かけた 数を 分母に したのかな。それでも 通分は できるけれど、この 問題は いちばん 小さい 分母（最小公倍数）で 通分するよ。',
      },
      {
        id: 'num-only',
        explain:
          '分母だけ そろえて、分子を そのままに したのかな。分母に かけた 数を、分子にも かけよう。',
      },
      {
        id: 'compare-den',
        explain:
          '分母が 大きい ほうが 大きいと 考えたのかな。分母が 大きいほど、1つ分は 小さく なるよ。通分して 分子で くらべよう。',
      },
      {
        id: 'compare-look',
        explain:
          '数字の 見た目で くらべたのかな。分母が ちがう ときは、通分して 分母を そろえてから 分子で くらべよう。',
      },
    ],
    levels: [
      { label: '等しい 分数・約分', chance: 0.02 },
      { label: '通分・大きさくらべ', chance: 0.05 },
      { label: 'まとめ', chance: 0.02 },
    ],
    intro: [
      {
        text: '[[1/2]]と [[2/4]]と [[3/6]]は、テープの 長さが 同じ。大きさの 等しい 分数です。',
        figure: tapes(1, 2, 6),
      },
      {
        text: '分母と 分子に 同じ 数を かけても、同じ 数で わっても、分数の 大きさは 変わりません。[[2/3]] ＝ [[8/12]]（4を かける）。',
        figure: expr('[[2/3]] ＝ [[8/12]]'),
      },
      {
        text: '分母と 分子を 公約数で わって、かんたんな 分数に することを 約分と いいます。[[12/18]]は 最大公約数 6で わって [[2/3]]。',
        figure: expr('[[12/18]] ＝ [[2/3]]'),
      },
      {
        text: '分母が ちがう 分数を、分母が 同じ 分数に なおす ことを 通分と いいます。[[1/4]]と [[1/6]]は、4と 6の 最小公倍数 12を 分母に して [[3/12]]と [[2/12]]。',
        figure: expr('[[1/4]] ＝ [[3/12]]　[[1/6]] ＝ [[2/12]]'),
      },
    ],
    source: {
      kind: 'generator',
      generate: ({ level, rng, index }) => generateFractionEquiv(level, rng, index),
    },
    review: 'type',
    basis: '小学校学習指導要領（平成29年告示）算数 第5学年 A(4) 分数の相等と大小（約分・通分）',
    revised: REVISED,
  },
  '等分《とうぶん》 共通《きょうつう》 色《いろ》',
);
