/**
 * g5.math.decimal-mult 小数のかけ算（整数 × 小数、小数 × 小数）（curriculum-matrix 3.8）。
 * 整数に直して考える（図）→ 筆算（積の小数点）→ かける数が 1より小さいと 積が かけられる数より 小さくなる。
 *
 * 小数は「0.1・0.01 が何こ」の整数で持つ（浮動小数点で計算しない）。
 * 同一性キー: 式（かけ算の交換は学習内容でないが、かけられる数・かける数の役割が文章題で違うので、式の向きは区別する）。
 *   文章題は 場面 × 式。表し方を変えた問題（筆算・図・積の大きさを選ぶ）は別のキー。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { dec, decAns, expr, finishUnit, pick, pickObj, REVISED, wrongList } from './util';

type Obj = 'intdec' | 'decdec' | 'small' | 'story';

/** 小数（整数 v と けた数 p）。v は 0 で終わらない（p>0 のとき） */
interface D {
  v: number;
  p: number;
}
const S = (d: D) => dec(d.v, d.p);

function randDec(rng: Rng, p: number, min: number, max: number): D {
  for (;;) {
    const v = rng.int(min, max);
    if (p > 0 && v % 10 === 0) continue;
    return { v, p };
  }
}

/** 右を そろえた かけ算の筆算の形（積の欄は 空ける） */
function mulFig(a: string, b: string): Figure {
  const w = Math.max(a.length, b.length) + 1;
  const cells = (s: string) => s.padStart(w, ' ').split('').map((c) => (c === ' ' ? '' : c));
  return {
    kind: 'table',
    header: Array.from({ length: w + 1 }, () => ''),
    rows: [['', ...cells(a)], ['×', ...cells(b)], ['', ...Array.from({ length: w }, () => '')]],
  };
}

/** 積 a × b の 正答と 誤答 */
function product(a: D, b: D) {
  const P = a.v * b.v;
  const q = a.p + b.p;
  const answers = [decAns(P, q)];
  const wrongs = wrongList(answers, [
    [dec(P, Math.max(a.p, b.p)), 'point-align'],
    [q > 0 ? dec(P, q - 1) : null, 'point-place'],
    [dec(P, q + 1), 'point-place'],
    [P, 'point-place'],
  ]);
  return { P, q, ans: dec(P, q), answers, wrongs };
}

const zeros = (p: number) => (p === 0 ? '1' : `0.${'0'.repeat(p - 1)}1`);

function hintsFor(a: D, b: D, P: number, q: number, h1: string): string[] {
  return [
    h1,
    `小数点を 取って 整数で 計算すると ${a.v} × ${b.v} ＝ ${P}。`,
    `かけられる数の 小数部分は ${a.p}けた、かける数は ${b.p}けた。積の 小数部分は あわせて ${q}けた。${P}の 右から ${q}けたの ところに 小数点を 打とう。`,
  ];
}

/** 整数 × 小数（80 × 2.3） */
function intdec(level: number, rng: Rng, alt: boolean): Item {
  const a: D = { v: rng.int(2, 9) * (rng.next() < 0.5 ? 10 : 1), p: 0 };
  const b = randDec(rng, 1, 11, 99);
  const { P, q, ans, answers, wrongs } = product(a, b);
  const as = S(a);
  const bs = S(b);
  if (alt) {
    // 図: 1mの ねだんと 長さの 数直線（2本）。0.1m分を 考えて 整数に 直す
    const fig: Figure = {
      kind: 'table',
      header: ['長さ（m）', '0.1', '1', bs],
      rows: [['代金（円）', `${as} ÷ 10`, as, '？']],
    };
    return {
      engine: 'number',
      id: `intdec-alt:${as}x${bs}`,
      objective: 'intdec',
      level,
      prompt: `1mの ねだんが ${as}円の リボンを ${bs}m 買います。代金は 何円ですか。`,
      figure: fig,
      hints: [
        `${bs}mは 0.1mの ${b.v}こ分だね。`,
        `0.1mの ねだんは ${as} ÷ 10。それが ${b.v}こ分。`,
        `${as} × ${b.v} ÷ 10 を 計算しよう。`,
      ],
      explain: `${as} × ${bs} ＝ ${as} × ${b.v} ÷ 10 ＝ ${ans}。代金は ${ans}円です。`,
      identity: `intdec-ribbon:${as}x${bs}`,
      alt: true,
      fields: [{ label: '円', answer: answers[0]! }],
      keys: ['decimal'],
      wrongAnswers: wrongs,
    };
  }
  return {
    engine: 'number',
    id: `intdec:${as}x${bs}`,
    objective: 'intdec',
    level,
    prompt: '計算しよう。',
    figure: expr(`${as} × ${bs} ＝ {{}}`),
    hints: hintsFor(a, b, P, q, `${bs}を 10倍して 整数に すると 計算できるよ。あとで 積を [[1/10]]に しよう。`),
    explain: `${as} × ${bs}は、${as} × ${b.v} ＝ ${P}を [[1/10]]に して ${ans}です。`,
    identity: `${as}x${bs}`,
    alt: false,
    fields: [{ answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongs,
  };
}

/** 小数 × 小数（かける数は 1より 大きい）。alt: 筆算 */
function decdec(level: number, rng: Rng, alt: boolean): NumberItem {
  const pa = level === 0 ? 1 : rng.int(1, 2);
  const pb = level === 0 ? 1 : pa === 2 ? 1 : rng.int(1, 2);
  const a = randDec(rng, pa, pa === 1 ? 11 : 101, pa === 1 ? 99 : 999);
  const b = randDec(rng, pb, pb === 1 ? 11 : 101, pb === 1 ? 99 : 499);
  const { P, q, ans, answers, wrongs } = product(a, b);
  const as = S(a);
  const bs = S(b);
  return {
    engine: 'number',
    id: `decdec${alt ? '-alt' : ''}:${as}x${bs}`,
    objective: 'decdec',
    level,
    prompt: alt ? '筆算で 計算しよう。' : '計算しよう。',
    figure: alt ? mulFig(as, bs) : expr(`${as} × ${bs} ＝ {{}}`),
    hints: hintsFor(
      a,
      b,
      P,
      q,
      alt ? '筆算は 右に そろえて 書き、小数点が ない ものとして 計算するよ。' : `${as}は ${zeros(a.p)}の ${a.v}こ分、${bs}は ${zeros(b.p)}の ${b.v}こ分だよ。`,
    ),
    explain: `${a.v} × ${b.v} ＝ ${P}。積の 小数部分の けた数は ${a.p} ＋ ${b.p} ＝ ${q}けたなので、${as} × ${bs} ＝ ${ans}です。`,
    explainFigure: alt ? undefined : mulFig(as, bs),
    identity: `${as}x${bs}${alt ? ':col' : ''}`,
    alt,
    fields: [{ answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongs,
  };
}

/** かける数が 1より 小さい（積が かけられる数より 小さい）。alt: 積が 小さく なる 式を 選ぶ */
function small(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const a = randDec(rng, 1, 21, 99);
    const as = S(a);
    const lt = randDec(rng, 1, 1, 9);
    const gt = randDec(rng, 1, 11, 29);
    const big = randDec(rng, 1, 31, 59);
    const item: ChoiceItem = {
      engine: 'choice',
      id: `small-alt:${as}:${S(lt)}:${S(gt)}:${S(big)}`,
      objective: 'small',
      level,
      prompt: `計算を しないで 考えよう。積が ${as}より 小さく なる 式は どれ？`,
      hints: [
        'かける数と 1を くらべて みよう。',
        '1を かけると 積は かけられる数と 同じ。1より 大きい 数を かけると…？',
        '1より 小さい 数を かけると、積は かけられる数より どう なるかな。',
      ],
      explain: `かける数が 1より 小さい とき、積は かけられる数より 小さく なります。${as} × ${S(lt)}の 積が ${as}より 小さいです。`,
      identity: `small-pick:${as}:${S(lt)}:${S(gt)}`,
      alt: true,
      options: [
        { label: `${as} × ${S(lt)}`, correct: true },
        { label: `${as} × ${S(gt)}`, misconception: 'mult-bigger' },
        { label: `${as} × ${S(big)}`, misconception: 'mult-bigger' },
        { label: `${as} × 1`, misconception: 'times-one' },
      ],
    };
    return item;
  }
  const pa = rng.int(0, 1);
  const a = pa === 0 ? { v: rng.int(2, 90), p: 0 } : randDec(rng, 1, 11, 99);
  const pb = rng.int(1, level >= 2 ? 2 : 1);
  const b = randDec(rng, pb, 1, pb === 1 ? 9 : 99);
  const { P, q, ans, answers, wrongs } = product(a, b);
  const as = S(a);
  const bs = S(b);
  return {
    engine: 'number',
    id: `small:${as}x${bs}`,
    objective: 'small',
    level,
    prompt: `計算しよう。積は ${as}より 大きい？ 小さい？ 考えてから 答えよう。`,
    figure: expr(`${as} × ${bs} ＝ {{}}`),
    hints: hintsFor(a, b, P, q, `かける数 ${bs}は 1より 小さいので、積は ${as}より 小さく なるよ。`),
    explain: `${a.v} × ${b.v} ＝ ${P}。小数部分は ${q}けたなので ${ans}。1より 小さい 数を かけたので、積は ${as}より 小さく なりました。`,
    identity: `${as}x${bs}`,
    alt: false,
    fields: [{ answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongs,
  };
}

interface Scene {
  id: string;
  unit: string;
  /** a: 1あたり（小数・整数）、b: いくつ分（小数） */
  text: (a: string, b: string) => string;
  aInt?: boolean;
}
const SCENES: Scene[] = [
  { id: 'wire', unit: 'g', text: (a, b) => `1mの 重さが ${a}gの はり金が あります。この はり金 ${b}mの 重さは 何gですか。` },
  { id: 'paint', unit: 'm²', text: (a, b) => `1dLで ${a}m² ぬれる ペンキが あります。${b}dLでは 何m² ぬれますか。` },
  { id: 'field', unit: 'kg', text: (a, b) => `1m²あたり ${a}kgの じゃがいもが とれる 畑が あります。${b}m²では 何kg とれますか。` },
  { id: 'tap', unit: 'L', text: (a, b) => `1分間《ふんかん》に ${a}Lの 水が 出る じゃ口が あります。${b}分間《ふんかん》では 何Lの 水が 出ますか。` },
  { id: 'car', unit: 'km', text: (a, b) => `ガソリン 1Lで ${a}km 走る 車が あります。${b}Lでは 何km 走りますか。` },
  { id: 'tape', unit: 'm', text: (a, b) => `赤い テープの 長さは ${a}mです。青い テープの 長さは、赤い テープの ${b}倍です。青い テープは 何mですか。` },
  { id: 'flour', unit: 'g', text: (a, b) => `1カップ ${a}gの 小麦粉を ${b}カップ 使います。小麦粉は 何g ですか。` },
  { id: 'cloth', unit: '円', aInt: true, text: (a, b) => `1mの ねだんが ${a}円の 布を ${b}m 買います。代金は 何円ですか。` },
];

/** a ÷ b（1/1000 の位までで わりきれるときだけ。わり算と 取りちがえた 誤答） */
function divided(a: D, b: D): string | null {
  const N = a.v * 10 ** (b.p + 3);
  const Dn = b.v * 10 ** a.p;
  return N % Dn === 0 ? dec(N / Dn, 3) : null;
}

function story(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, SCENES);
  const a: D = sc.aInt ? { v: rng.int(12, 48) * 10, p: 0 } : rng.next() < 0.5 ? randDec(rng, 1, 11, 99) : { v: rng.int(2, 30), p: 0 };
  const b = randDec(rng, 1, 2, 49);
  const { P, ans, answers, wrongs } = product(a, b);
  const as = S(a);
  const bs = S(b);
  const fig: Figure | undefined = alt
    ? {
        kind: 'table',
        header: [sc.id === 'tape' ? '倍' : 'いくつ分', '1', bs],
        rows: [[sc.unit, as, '？']],
      }
    : undefined;
  return {
    engine: 'number',
    id: `story${alt ? '-alt' : ''}:${sc.id}:${as}x${bs}`,
    objective: 'story',
    level,
    prompt: sc.text(as, bs),
    figure: fig,
    hints: [
      sc.id === 'tape'
        ? '「何倍」の 長さは、もとの 長さ × 倍で 求めるよ。'
        : '「1あたりの 量 × いくつ分」で 求めるよ。いくつ分が 小数でも かけ算だよ。',
      `式は ${as} × ${bs}。`,
      `${a.v} × ${b.v} ＝ ${P}。小数部分の けた数を たしかめて 小数点を 打とう。`,
    ],
    explain: `${as} × ${bs} ＝ ${ans}。答えは ${ans}${sc.unit}です。`,
    identity: `story:${sc.id}:${as}x${bs}${alt ? ':tbl' : ''}`,
    alt,
    fields: [{ label: sc.unit, answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongList(answers, [
      ...wrongs.map((w): [string, string] => [w.value, w.misconception]),
      [divided(a, b), 'op-div'],
    ]),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['intdec', 'decdec'] },
  { objs: ['decdec', 'small', 'intdec'] },
  { objs: ['story', 'small', 'decdec'] },
];

export function generateDecimalMult(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'intdec':
      return intdec(level, rng, alt);
    case 'decdec':
      return decdec(level, rng, alt);
    case 'small':
      return small(level, rng, alt);
    case 'story':
      return story(level, rng, alt);
  }
}

export const decimalMult: UnitSpec = finishUnit(
  {
    id: 'g5.math.decimal-mult',
    title: '小数の かけ算',
    stage: 'g5',
    subject: 'math',
    domain: 'A-number',
    kind: 'calc',
    priority: 'P1',
    status: 'ready',
    icon: 'math-formula-add',
    prereq: ['g5.math.decimal-shift', 'g4.math.decimal-int'],
    objectives: [
      { id: 'intdec', title: '整数 × 小数（整数に 直して 考える）' },
      { id: 'decdec', title: '小数 × 小数（積の 小数点）' },
      { id: 'small', title: '1より 小さい 数を かける' },
      { id: 'story', title: '文章題（いくつ分・何倍が 小数）' },
    ],
    misconceptions: [
      {
        id: 'point-place',
        explain:
          '積の 小数点の 位置が ずれたのかな（打ちわすれも）。積の 小数部分の けた数は、かけられる数と かける数の 小数部分の けた数の 和だよ。',
      },
      {
        id: 'point-align',
        explain:
          'たし算の 筆算のように 小数点を そろえたのかな。かけ算では 小数点を そろえずに 右に そろえて 計算し、最後に けた数を たして 小数点を 打つよ。',
      },
      {
        id: 'mult-bigger',
        explain:
          'かけ算を すると いつも 大きく なると 考えたのかな。1より 大きい 数を かけると 大きく なるけれど、1より 小さい 数を かけると 小さく なるよ。',
      },
      {
        id: 'times-one',
        explain: '1を かけると、積は かけられる数と 同じだよ。「小さく なる」では ないね。',
      },
      {
        id: 'op-div',
        explain: 'わり算を したのかな。1あたりの 量の いくつ分を 求めるので、かけ算だよ。',
      },
    ],
    levels: [
      { label: '整数 × 小数・小数 × 小数（1けた）', chance: 0.02 },
      { label: '小数 × 小数（2けた）・1より 小さい 数を かける', chance: 0.02 },
      { label: '文章題・まとめ', chance: 0.02 },
    ],
    intro: [
      {
        text: '1mが 80円の リボンを 2.3m 買うと？ 2.3mは 0.1mの 23こ分。0.1mは 80 ÷ 10 ＝ 8円なので、8 × 23 ＝ 184円。',
        figure: { kind: 'table', header: ['長さ（m）', '0.1', '1', '2.3'], rows: [['代金（円）', '8', '80', '？']] },
      },
      {
        text: '2.4 × 0.3は、24 × 3 ＝ 72を 計算してから 小数点を 打ちます。小数部分の けた数は 1 ＋ 1 ＝ 2けたなので 0.72。',
        figure: mulFig('2.4', '0.3'),
      },
      {
        text: '1より 小さい 数を かけると、積は かけられる数より 小さく なります。2.4 × 0.3 ＝ 0.72は 2.4より 小さいね。',
        figure: expr('2.4 × 0.3 ＝ 0.72 ＜ 2.4'),
      },
    ],
    source: {
      kind: 'generator',
      generate: ({ level, rng, index }) => generateDecimalMult(level, rng, index),
    },
    review: 'type',
    basis: '小学校学習指導要領（平成29年告示）算数 第5学年 A(3) 小数の乗法（乗数が小数の場合）',
    revised: REVISED,
  },
  '打《う》 畑《はたけ》 はり金《がね》 じゃ口《ぐち》 重《おも》さ 出《で》る 出《で》ますか 出《で》 布《ぬの》 車《くるま》 赤《あか》い 青《あお》い 小麦粉《こむぎこ》 打《う》とう 打《う》つ 取《と》って 最後《さいご》 和《わ》',
);
