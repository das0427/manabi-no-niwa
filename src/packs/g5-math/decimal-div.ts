/**
 * g5.math.decimal-div 小数のわり算（整数・小数 ÷ 小数、わり進む、あまり、商のがい数）（curriculum-matrix 3.8）。
 * 図（1あたり）→ 筆算（わる数を整数にするため、わる数と わられる数の小数点を同じけただけ移す）→ あまりの小数点。
 *
 * 小数は「0.1・0.01 が何こ」の整数で持つ（浮動小数点で計算しない）。問題は 商 と わる数 から作る（わりきれることを保証）。
 * 同一性キー: 式。あまりの問題・がい数の問題・文章題（場面 × 式）・商の大きさを選ぶ問題は別のキー。
 */
import type { NumberAnswer } from '../../core/answer/number';
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { dec, decAns, expr, finishUnit, pick, pickObj, REVISED, wrongList } from './util';

type Obj = 'exact' | 'further' | 'rem' | 'bigger' | 'story';

interface D {
  v: number;
  p: number;
}
/** 末尾の0をのぞく */
function norm(d: D): D {
  let { v, p } = d;
  while (p > 0 && v % 10 === 0) {
    v /= 10;
    p--;
  }
  while (p < 0) {
    v *= 10;
    p++;
  }
  return { v, p };
}
const S = (d: D) => dec(d.v, d.p);
const mul = (a: D, b: D): D => norm({ v: a.v * b.v, p: a.p + b.p });
/** 10^k 倍（小数点を右へ k けた） */
const shift = (a: D, k: number): D => norm({ v: a.v, p: a.p - k });

function randDec(rng: Rng, p: number, min: number, max: number): D {
  for (;;) {
    const v = rng.int(min, max);
    if (p > 0 && v % 10 === 0) continue;
    return { v, p };
  }
}

/** わり算の筆算の形（わる数 ）わられる数）。小数点を移したあとの形を 下の行に */
function divFig(a: D, b: D): Figure {
  const as = S(a);
  const a2 = S(shift(a, b.p));
  const b2 = String(b.v);
  return {
    kind: 'table',
    header: ['', 'わる数', 'わられる数'],
    rows: [
      ['もとの 式', S(b), as],
      [`どちらも ${10 ** b.p}倍`, b2, a2],
    ],
  };
}

/** a ÷ b（1/1000 の位までで わりきれるとき）の 表示。わりきれなければ null */
function quot(a: D, b: D): string | null {
  const N = a.v * 10 ** (b.p + 4);
  const Dn = b.v * 10 ** a.p;
  return N % Dn === 0 ? dec(N / Dn, 4) : null;
}

const hintShift = (b: D) =>
  `わる数 ${S(b)}を 整数に するには ${10 ** b.p}倍。わられる数も 同じく ${10 ** b.p}倍して（小数点を 右へ ${b.p}けた うつして）計算しよう。`;

/** 共通の 誤答: わる数だけ 整数に した（わられる数の 小数点を 移さなかった）、商の 小数点の ずれ */
function commonWrongs(a: D, b: D, q: D, answers: NumberAnswer[]) {
  return wrongList(answers, [
    [quot(a, { v: b.v, p: 0 }), 'shift-one'],
    [S(shift(q, 1)), 'point-q'],
    [S(shift(q, -1)), 'point-q'],
    [quot(b, a), 'div-swap'],
  ]);
}

/** わりきれる（商は 整数 か 小数1けた）。alt: 筆算の 図で */
function exact(level: number, rng: Rng, alt: boolean): NumberItem {
  const b = randDec(rng, level === 0 ? 1 : rng.int(1, 2), 11, 99);
  const q =
    level === 0
      ? { v: rng.int(2, 30), p: 0 }
      : rng.next() < 0.5
        ? { v: rng.int(2, 60), p: 0 }
        : randDec(rng, 1, 11, 99);
  const a = mul(q, b);
  const answers = [decAns(q.v, q.p)];
  const as = S(a);
  const bs = S(b);
  const a2 = S(shift(a, b.p));
  return {
    engine: 'number',
    id: `exact${alt ? '-alt' : ''}:${as}÷${bs}`,
    objective: 'exact',
    level,
    prompt: alt ? '筆算で 計算しよう。小数点を うつした 形を 見て 考えよう。' : '計算しよう。',
    figure: alt ? divFig(a, b) : expr(`${as} ÷ ${bs} ＝ {{}}`),
    hints: [
      'わる数が 整数に なるように 考えよう。',
      hintShift(b),
      `${as} ÷ ${bs}は ${a2} ÷ ${b.v}と 同じ 商に なるよ。${a2} ÷ ${b.v}を 計算しよう。`,
    ],
    explain: `わる数と わられる数を どちらも ${10 ** b.p}倍して、${a2} ÷ ${b.v} ＝ ${S(q)}。${as} ÷ ${bs} ＝ ${S(q)}です。商の 小数点は、うつした あとの わられる数の 小数点に そろえます。`,
    explainFigure: divFig(a, b),
    identity: `${as}÷${bs}${alt ? ':col' : ''}`,
    alt,
    fields: [{ answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: commonWrongs(a, b, q, answers),
  };
}

/** わり進む（0を つけたして わりきれるまで）。alt: 筆算の 図で */
function further(level: number, rng: Rng, alt: boolean): NumberItem {
  for (;;) {
    const b = randDec(rng, 1, 2, 49);
    const q = randDec(rng, rng.int(1, 2), 11, 999);
    const a = mul(q, b);
    if (a.p > 2) continue;
    const a1 = shift(a, b.p);
    // わり進む（0を つけたす）ことが 必要: 商の けた数が わられる数の けた数より 多い
    if (q.p <= a1.p) continue;
    const answers = [decAns(q.v, q.p)];
    const as = S(a);
    const bs = S(b);
    const a2 = S(a1);
    const stopAt = Math.max(a1.p, 0);
    const stop = norm({ v: Math.floor(q.v / 10 ** (q.p - stopAt)), p: stopAt });
    return {
      engine: 'number',
      id: `further${alt ? '-alt' : ''}:${as}÷${bs}`,
      objective: 'further',
      level,
      prompt: alt ? 'わりきれるまで 筆算で 計算しよう。' : 'わりきれるまで 計算しよう。',
      figure: alt ? divFig(a, b) : expr(`${as} ÷ ${bs} ＝ {{}}`),
      hints: [
        hintShift(b),
        `${a2} ÷ ${b.v}を 計算すると あまりが 出るね。0を つけたして わり進もう。`,
        `${a2}を ${dec(a1.v * 10 ** (q.p - a1.p), 0)}の [[1/${10 ** q.p}]]と 考えると、${a1.v * 10 ** (q.p - a1.p)} ÷ ${b.v}。`,
      ],
      explain: `${as} ÷ ${bs}は ${a2} ÷ ${b.v}と 同じ。0を つけたして わり進むと ${S(q)}です。`,
      explainFigure: divFig(a, b),
      identity: `${as}÷${bs}${alt ? ':col' : ''}`,
      alt,
      fields: [{ answer: answers[0]! }],
      keys: ['decimal'],
      wrongAnswers: wrongList(answers, [
        [S(stop) !== '0' ? S(stop) : null, 'stop-early'],
        ...commonWrongs(a, b, q, answers).map((w): [string, string] => [w.value, w.misconception]),
      ]),
    };
  }
}

/** 商を 一の位まで 求めて あまりを 出す。alt: 商を 四捨五入して [[1/10]]の位まで */
function rem(level: number, rng: Rng, alt: boolean): NumberItem {
  for (;;) {
    const b = randDec(rng, 1, 11, 59);
    const pa = rng.int(1, 2);
    const a = randDec(rng, pa, pa === 1 ? b.v + 1 : b.v * 10 + 1, pa === 1 ? 999 : 999);
    // 単位 10^-pa で そろえる
    const A = a.v;
    const B = b.v * 10 ** (pa - 1);
    const q = Math.floor(A / B);
    const R = A - q * B;
    if (q < 1 || q > 99 || R === 0) continue;
    const as = S(a);
    const bs = S(b);
    const a2 = S(shift(a, 1));
    if (alt) {
      // 1/100 の位まで 計算して 四捨五入（1/10 の位の がい数）
      const q100 = Math.floor((A * 100) / B);
      if ((A * 100) % B === 0 && q100 % 10 === 0) continue;
      const q10 = Math.floor((q100 + 5) / 10);
      const cut = Math.floor(q100 / 10);
      const answers: NumberAnswer[] = [{ kind: 'decimal', value: Number(dec(q10, 1)), places: 1 }];
      return {
        engine: 'number',
        id: `rem-alt:${as}÷${bs}`,
        objective: 'rem',
        level,
        prompt: `${as} ÷ ${bs}の 商を、四捨五入して [[1/10]]の位までの がい数で 求めよう。`,
        figure: expr(`${as} ÷ ${bs}`),
        hints: [
          '[[1/10]]の位までの がい数に するので、[[1/100]]の位まで 計算しよう。',
          `${as} ÷ ${bs}は ${a2} ÷ ${b.v}と 同じ。[[1/100]]の位まで 計算すると ${dec(q100, 2)}。`,
          `[[1/100]]の位の ${q100 % 10}を 四捨五入しよう。`,
        ],
        explain: `${as} ÷ ${bs} ＝ ${dec(q100, 2)}…。[[1/100]]の位を 四捨五入して ${dec(q10, 1).includes('.') ? dec(q10, 1) : `${dec(q10, 1)}.0`}です。`,
        identity: `round:${as}÷${bs}`,
        alt: true,
        fields: [{ label: '約', answer: answers[0]! }],
        keys: ['decimal'],
        wrongAnswers: wrongList(answers, [
          [q10 !== cut ? dec(cut, 1) : null, 'round-cut'],
          [dec(q100, 2), 'round-cut'],
          [dec(q10, 0), 'point-q'],
        ]),
      };
    }
    const r = dec(R, pa);
    const rShift = dec(R, pa - 1);
    const answers: NumberAnswer[] = [{ kind: 'int', value: q }, decAns(R, pa)];
    return {
      engine: 'number',
      id: `rem:${as}÷${bs}`,
      objective: 'rem',
      level,
      prompt: `${as} ÷ ${bs}の 商を 一の位まで 求めて、あまりも 出そう。`,
      figure: expr(`${as} ÷ ${bs}`),
      hints: [
        hintShift(b),
        `${a2} ÷ ${b.v}を 一の位まで 計算すると、商は ${q}。`,
        `あまりの 小数点は、もとの わられる数 ${as}の 小数点に そろえるよ。${as} − ${bs} × ${q}で たしかめよう。`,
      ],
      explain: `${as} ÷ ${bs} ＝ ${q} あまり ${r}。たしかめ: ${bs} × ${q} ＋ ${r} ＝ ${as}。あまりの 小数点は もとの わられる数の 小数点に そろえます（うつした 小数点では ありません）。`,
      explainFigure: divFig(a, b),
      identity: `rem:${as}÷${bs}`,
      alt: false,
      fields: [
        { label: '商', answer: answers[0]! },
        { label: 'あまり', answer: answers[1]! },
      ],
      keys: ['decimal'],
      wrongAnswers: wrongList(answers, [[`${q}|${rShift}`, 'rem-point']]),
    };
  }
}

/** わる数が 1より 小さい（商が わられる数より 大きい）。alt: 商が 大きく なる 式を 選ぶ */
function bigger(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const a = randDec(rng, 1, 21, 99);
    const as = S(a);
    const lt = randDec(rng, 1, 1, 9);
    const gt = randDec(rng, 1, 11, 29);
    const big = randDec(rng, 1, 31, 59);
    const item: ChoiceItem = {
      engine: 'choice',
      id: `bigger-alt:${as}:${S(lt)}:${S(gt)}:${S(big)}`,
      objective: 'bigger',
      level,
      prompt: `計算を しないで 考えよう。商が ${as}より 大きく なる 式は どれ？`,
      hints: [
        'わる数と 1を くらべて みよう。',
        '1で わると 商は わられる数と 同じ。1より 大きい 数で わると…？',
        '1より 小さい 数で わると、商は わられる数より どう なるかな。',
      ],
      explain: `わる数が 1より 小さい とき、商は わられる数より 大きく なります。${as} ÷ ${S(lt)}の 商が ${as}より 大きいです。`,
      identity: `bigger-pick:${as}:${S(lt)}:${S(gt)}`,
      alt: true,
      options: [
        { label: `${as} ÷ ${S(lt)}`, correct: true },
        { label: `${as} ÷ ${S(gt)}`, misconception: 'div-smaller' },
        { label: `${as} ÷ ${S(big)}`, misconception: 'div-smaller' },
        { label: `${as} ÷ 1`, misconception: 'div-one' },
      ],
    };
    return item;
  }
  const bb: D =
    rng.next() < 0.7 ? randDec(rng, 1, 2, 9) : { v: pick(rng, [25, 75, 5, 15, 35, 45]), p: 2 };
  const q = rng.next() < 0.5 ? { v: rng.int(2, 60), p: 0 } : randDec(rng, 1, 11, 99);
  const a = mul(q, bb);
  const answers = [decAns(q.v, q.p)];
  const as = S(a);
  const bs = S(bb);
  return {
    engine: 'number',
    id: `bigger:${as}÷${bs}`,
    objective: 'bigger',
    level,
    prompt: `計算しよう。商は ${as}より 大きい？ 小さい？ 考えてから 答えよう。`,
    figure: expr(`${as} ÷ ${bs} ＝ {{}}`),
    hints: [
      `わる数 ${bs}は 1より 小さいので、商は ${as}より 大きく なるよ。`,
      hintShift(bb),
      `${S(shift(a, bb.p))} ÷ ${bb.v}を 計算しよう。`,
    ],
    explain: `${as} ÷ ${bs} ＝ ${S(shift(a, bb.p))} ÷ ${bb.v} ＝ ${S(q)}。1より 小さい 数で わったので、商は ${as}より 大きく なりました。`,
    identity: `${as}÷${bs}`,
    alt: false,
    fields: [{ answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: commonWrongs(a, bb, q, answers),
  };
}

interface Scene {
  id: string;
  unit: string;
  /** 'part' 1あたりを 求める（等分除）、'count' いくつ分を 求める（包含除） */
  kind: 'part' | 'count';
  /** a: 全体、b: いくつ分（part）・1つ分（count） */
  text: (a: string, b: string) => string;
  /** 答えが 整数（本数など） */
  intAns?: boolean;
  /** count の 図で、全体と 1つ分の 量の 単位 */
  qty?: string;
}
const SCENES: Scene[] = [
  {
    id: 'wire',
    kind: 'part',
    unit: 'g',
    text: (a, b) => `${b}mで ${a}gの はり金が あります。この はり金 1mの 重さは 何gですか。`,
  },
  {
    id: 'paint',
    kind: 'part',
    unit: 'm²',
    text: (a, b) => `${b}dLの ペンキで ${a}m²の かべを ぬれました。1dLでは 何m² ぬれますか。`,
  },
  {
    id: 'cloth',
    kind: 'part',
    unit: '円',
    text: (a, b) => `${b}mで ${a}円の 布が あります。この 布 1mの ねだんは 何円ですか。`,
  },
  {
    id: 'field',
    kind: 'part',
    unit: 'kg',
    text: (a, b) => `${b}m²の 畑から ${a}kgの じゃがいもが とれました。1m²あたり 何kgですか。`,
  },
  {
    id: 'juice',
    kind: 'count',
    unit: '本',
    qty: 'L',
    intAns: true,
    text: (a, b) => `${a}Lの ジュースを ${b}Lずつ びんに 入れます。びんは 何本 いりますか。`,
  },
  {
    id: 'ribbon',
    kind: 'count',
    unit: '本',
    qty: 'm',
    intAns: true,
    text: (a, b) => `${a}mの リボンを ${b}mずつ 切ります。何本 できますか。`,
  },
  {
    id: 'times',
    kind: 'count',
    unit: '倍',
    qty: 'm',
    text: (a, b) =>
      `赤い テープは ${a}m、青い テープは ${b}mです。赤い テープの 長さは 青い テープの 何倍ですか。`,
  },
  {
    id: 'base',
    kind: 'part',
    unit: 'm',
    text: (a, b) =>
      `青い テープの 長さは ${a}mで、これは 赤い テープの ${b}倍に あたります。赤い テープは 何mですか。`,
  },
];

function story(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, SCENES);
  // 答え q と わる数 b から 作る
  const b = randDec(rng, 1, sc.id === 'base' ? 11 : 2, sc.id === 'base' ? 39 : 49);
  const q: D = sc.intAns
    ? { v: rng.int(3, 40), p: 0 }
    : sc.id === 'cloth'
      ? { v: rng.int(12, 98) * 10, p: 0 }
      : rng.next() < 0.5
        ? { v: rng.int(2, 40), p: 0 }
        : randDec(rng, 1, 11, 99);
  const a = mul(q, b);
  const answers = [decAns(q.v, q.p)];
  const as = S(a);
  const bs = S(b);
  const fig: Figure | undefined = alt
    ? sc.kind === 'part'
      ? {
          kind: 'table',
          header: [sc.id === 'base' ? '倍' : 'いくつ分', '1', bs],
          rows: [[sc.id === 'base' ? 'm' : sc.unit, '？', as]],
        }
      : // 上の 行: 量（1つ分 bs と 全体 as）、下の 行: いくつ分（1 と ？）
        {
          kind: 'table',
          header: [`量（${sc.qty ?? ''}）`, bs, as],
          rows: [[sc.id === 'times' ? '倍' : 'いくつ分', '1', '？']],
        }
    : undefined;
  return {
    engine: 'number',
    id: `story${alt ? '-alt' : ''}:${sc.id}:${as}÷${bs}`,
    objective: 'story',
    level,
    prompt: sc.text(as, bs),
    figure: fig,
    hints: [
      sc.id === 'base'
        ? 'もとに する 量（1倍に あたる 量）を 求めるので、くらべる 量 ÷ 何倍 だよ。何倍が 小数でも わり算。'
        : sc.kind === 'part'
          ? '1あたりの 量を 求めるので、全体 ÷ いくつ分 だよ。いくつ分が 小数でも わり算。'
          : sc.id === 'times'
            ? '何倍かを 求めるときは、くらべる 量 ÷ もとに する 量 だよ。'
            : '1つ分が いくつ 入るかを 求めるので、全体 ÷ 1つ分 だよ。',
      `式は ${as} ÷ ${bs}。`,
      hintShift(b),
    ],
    explain: `${as} ÷ ${bs} ＝ ${S(q)}。答えは ${S(q)}${sc.unit}です。`,
    identity: `story:${sc.id}:${as}÷${bs}${alt ? ':tbl' : ''}`,
    alt,
    fields: [{ label: sc.unit, answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongList(answers, [
      [quot(b, a), 'div-swap'],
      [S(mul(a, b)), 'op-mult'],
      ...commonWrongs(a, b, q, answers).map((w): [string, string] => [w.value, w.misconception]),
    ]),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['exact', 'bigger'] },
  { objs: ['exact', 'further', 'rem'] },
  { objs: ['story', 'rem', 'further', 'bigger'] },
];

export function generateDecimalDiv(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'exact':
      return exact(level, rng, alt);
    case 'further':
      return further(level, rng, alt);
    case 'rem':
      return rem(level, rng, alt);
    case 'bigger':
      return bigger(level, rng, alt);
    case 'story':
      return story(level, rng, alt);
  }
}

export const decimalDiv: UnitSpec = finishUnit(
  {
    id: 'g5.math.decimal-div',
    title: '小数の わり算',
    stage: 'g5',
    subject: 'math',
    domain: 'A-number',
    kind: 'calc',
    priority: 'P1',
    status: 'ready',
    icon: 'math-split',
    prereq: ['g5.math.decimal-mult'],
    objectives: [
      { id: 'exact', title: '小数で わる（わりきれる）' },
      { id: 'further', title: 'わりきれるまで わり進む' },
      { id: 'rem', title: 'あまりの 大きさ・商の がい数' },
      { id: 'bigger', title: '1より 小さい 数で わる' },
      { id: 'story', title: '文章題（1あたり・いくつ分・何倍）' },
    ],
    misconceptions: [
      {
        id: 'shift-one',
        explain:
          'わる数だけ 整数に して、わられる数の 小数点を うつさなかったのかな。わる数と わられる数は、同じ けただけ 小数点を うつすよ（どちらも 10倍なら 商は 変わらない）。',
      },
      {
        id: 'point-q',
        explain:
          '商の 小数点の 位置が ずれたのかな。商の 小数点は、うつした あとの わられる数の 小数点に そろえて 打つよ。',
      },
      {
        id: 'rem-point',
        explain:
          'あまりの 小数点を、うつした あとの 位置に 打ったのかな。あまりの 小数点は、もとの わられる数の 小数点に そろえるよ。わる数 × 商 ＋ あまり ＝ わられる数 で たしかめよう。',
      },
      {
        id: 'stop-early',
        explain:
          'とちゅうで わるのを 止めたのかな。「わりきれるまで」の ときは、0を つけたして あまりが 0に なるまで わり進むよ。',
      },
      {
        id: 'round-cut',
        explain:
          '四捨五入を わすれたのかな。[[1/10]]の位までの がい数に するときは、[[1/100]]の位まで 計算して 四捨五入するよ。',
      },
      {
        id: 'div-smaller',
        explain:
          'わり算を すると いつも 小さく なると 考えたのかな。1より 小さい 数で わると、商は わられる数より 大きく なるよ。',
      },
      {
        id: 'div-one',
        explain: '1で わると、商は わられる数と 同じだよ。「大きく なる」では ないね。',
      },
      {
        id: 'div-swap',
        explain:
          'わる数と わられる数を 反対に したのかな。全体 ÷ いくつ分、くらべる 量 ÷ もとに する 量の じゅんに 式を 立てよう。',
      },
      {
        id: 'op-mult',
        explain: 'かけ算を したのかな。1あたりの 量や いくつ分を 求めるときは わり算だよ。',
      },
    ],
    levels: [
      { label: '小数で わる（わりきれる）', chance: 0.02 },
      { label: 'わり進む・あまり', chance: 0.02 },
      { label: '文章題・まとめ', chance: 0.02 },
    ],
    intro: [
      {
        text: '2.5mで 350円の 布。1mの ねだんは 350 ÷ 2.5。0.1mの ねだんを 考えると 350 ÷ 25 ＝ 14円、1mは その 10倍で 140円。',
        figure: {
          kind: 'table',
          header: ['長さ（m）', '0.1', '1', '2.5'],
          rows: [['代金（円）', '14', '？', '350']],
        },
      },
      {
        text: 'わる数と わられる数を 同じ 数だけ 倍しても 商は 変わりません。7.2 ÷ 0.9は、どちらも 10倍して 72 ÷ 9 ＝ 8。',
        figure: divFig({ v: 72, p: 1 }, { v: 9, p: 1 }),
      },
      {
        text: 'あまりを 出す ときは、あまりの 小数点を もとの わられる数の 小数点に そろえます。7.4 ÷ 2.3 ＝ 3 あまり 0.5（5では ない）。',
        figure: expr('2.3 × 3 ＋ 0.5 ＝ 7.4'),
      },
      {
        text: '1より 小さい 数で わると、商は わられる数より 大きく なります。6 ÷ 0.5 ＝ 12。',
        figure: expr('6 ÷ 0.5 ＝ 12 ＞ 6'),
      },
    ],
    source: {
      kind: 'generator',
      generate: ({ level, rng, index }) => generateDecimalDiv(level, rng, index),
    },
    review: 'type',
    basis:
      '小学校学習指導要領（平成29年告示）算数 第5学年 A(3) 小数の除法（除数が小数の場合、あまりの大きさ）',
    revised: REVISED,
  },
  '出《だ》そう 出《だ》す 出《で》る 出《で》た 打《う》 畑《はたけ》 はり金《がね》 重《おも》さ 布《ぬの》 赤《あか》い 青《あお》い 立《た》てよう 止《と》めた 倍《ばい》し',
);
