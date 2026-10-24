/**
 * g2.math.sub-column 2位数のひき算の筆算（curriculum-matrix 3.5）。
 * 繰り下がりなし → あり → 文章題（求残・求差）。
 *
 * 筆算は number の複数欄（答えの位ごとに1欄）で代用。位ごとの入力から、
 * 大きい方から小さい方をひく・繰り下げた後に十の位を減らし忘れる・位のずれ を誤概念に結ぶ。
 *
 * 同一性キー: 式（ひき算は順序が意味を持つので a−b のまま）。文章題は「場面 × 式」。
 * 定義域: a は 10〜99、b は 1〜(a−1)。数千通り。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { columnFigure, pickObj, placeFields, toFields, wrongList } from './util';

type Obj = 'noborrow' | 'borrow' | 'onedigit' | 'bunshou';

interface Scene {
  id: string;
  type: 'nokori' | 'chigai';
  unit: string;
  text: (a: number, b: number) => string;
}

/** 文章題の場面（求残4・求差4） */
const SCENES: Scene[] = [
  {
    id: 'origami',
    type: 'nokori',
    unit: 'まい',
    text: (a, b) => `おりがみが ${a}まい あります。${b}まい つかうと、のこりは なんまい ですか。`,
  },
  {
    id: 'park',
    type: 'nokori',
    unit: '人《にん》',
    text: (a, b) =>
      `こうえんに ${a}人《にん》 いました。${b}人《にん》 かえりました。のこりは なん人《にん》 ですか。`,
  },
  {
    id: 'beads',
    type: 'nokori',
    unit: 'こ',
    text: (a, b) =>
      `ビーズが ${a}こ あります。${b}こ つかって ブレスレットを つくりました。のこりは なんこ ですか。`,
  },
  {
    id: 'money',
    type: 'nokori',
    unit: '円《えん》',
    text: (a, b) =>
      `${a}円《えん》 もって います。${b}円《えん》の えんぴつを かうと、のこりは なん円《えん》 ですか。`,
  },
  {
    id: 'jump',
    type: 'chigai',
    unit: 'かい',
    text: (a, b) =>
      `なわとびを、あねは ${a}かい、わたしは ${b}かい とびました。ちがいは なんかい ですか。`,
  },
  {
    id: 'books',
    type: 'chigai',
    unit: 'さつ',
    text: (a, b) =>
      `としょしつの えほんは ${a}さつ、ずかんは ${b}さつ です。えほんは ずかんより なんさつ おおい ですか。`,
  },
  {
    id: 'acorns',
    type: 'chigai',
    unit: 'こ',
    text: (a, b) =>
      `どんぐりを、ゆうたさんは ${a}こ、はなさんは ${b}こ ひろいました。どちらが なんこ おおい ですか。こたえは かずだけ かこう。`,
  },
  {
    id: 'seats',
    type: 'chigai',
    unit: 'こ',
    text: (a, b) =>
      `いすが ${a}こ、つくえが ${b}こ あります。いすは つくえより なんこ おおい ですか。`,
  },
];

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['noborrow'] },
  { objs: ['noborrow', 'borrow'] },
  { objs: ['borrow', 'onedigit'] },
  { objs: ['borrow', 'onedigit', 'bunshou'] },
];

const key = (a: number, b: number) => `${a}-${b}`;

function pickExpr(rng: Rng, kind: 'noborrow' | 'borrow' | 'onedigit'): [number, number] {
  for (;;) {
    const a = rng.int(10, 99);
    if (kind === 'onedigit') {
      // 2位数 − 1位数（繰り下がり あり・なし）か、答えが1けたになる 2位数 − 2位数
      if (rng.next() < 0.6) {
        const b = rng.int(1, 9);
        if (a - b >= 10) return [a, b];
      } else {
        const b = rng.int(10, 99);
        if (a - b >= 1 && a - b <= 9) return [a, b];
      }
      continue;
    }
    const b = rng.int(10, 99);
    if (a - b < 10) continue;
    const borrow = a % 10 < b % 10;
    if (borrow === (kind === 'borrow')) return [a, b];
  }
}

function wrongs(a: number, b: number, nFields: number): NumberItem['wrongAnswers'] {
  const d = a - b;
  const a1 = a % 10;
  const b1 = b % 10;
  const a10 = Math.floor(a / 10);
  const b10 = Math.floor(b / 10);
  const borrow = a1 < b1;
  const f = (v: number) => (nFields === 1 ? String(v) : toFields(v, nFields));
  // 大きい方から小さい方をひいた（いちの くらいで b1 − a1）
  const bigSmall = (a10 - b10) * 10 + Math.abs(a1 - b1);
  // 繰り下げたのに じゅうの くらいを へらさなかった
  const noDec = (a10 - b10) * 10 + (10 + a1 - b1);
  const misalign = b < 10 && a10 >= b ? (a10 - b) * 10 + a1 : null;
  return wrongList(nFields === 1 ? String(d) : toFields(d, nFields)!, nFields, [
    [borrow ? f(bigSmall) : null, 'bigger-minus-smaller'],
    [borrow ? f(noDec) : null, 'no-decrement'],
    [!borrow ? f(d - 10) : null, 'extra-borrow'],
    [misalign !== null ? f(misalign) : null, 'misalign'],
    [f(a + b), 'add-instead'],
  ]);
}

function hints(a: number, b: number): string[] {
  const a1 = a % 10;
  const b1 = b % 10;
  const a10 = Math.floor(a / 10);
  const b10 = Math.floor(b / 10);
  const borrow = a1 < b1;
  return [
    'くらいを たてに そろえて、いちの くらいから けいさん しよう。',
    borrow
      ? `いちの くらいは ${a1} − ${b1} が できないね。じゅうの くらいから 10 かりて ${10 + a1} − ${b1}。`
      : `いちの くらいは ${a1} − ${b1}。`,
    borrow
      ? `じゅうの くらいは 1 かしたので ${a10 - 1}。${a10 - 1} − ${b10} を けいさん。`
      : `じゅうの くらいは ${a10} − ${b10} を けいさん。`,
  ];
}

function explain(a: number, b: number): string {
  const a1 = a % 10;
  const b1 = b % 10;
  const a10 = Math.floor(a / 10);
  const b10 = Math.floor(b / 10);
  const borrow = a1 < b1;
  const d = a - b;
  return borrow
    ? `いちの くらい: ${a1}から ${b1}は ひけないので、じゅうの くらいから 10 かりて ${10 + a1} − ${b1} ＝ ${10 + a1 - b1}。じゅうの くらい: ${a10 - 1} − ${b10} ＝ ${a10 - 1 - b10}。こたえは ${d} です。`
    : `いちの くらい: ${a1} − ${b1} ＝ ${a1 - b1}。じゅうの くらい: ${a10} − ${b10} ＝ ${a10 - b10}。こたえは ${d} です。`;
}

const blocksFig = (a: number, b: number): Figure => ({
  kind: 'column',
  items: [
    { kind: 'blocks', tens: Math.floor(a / 10), ones: a % 10 },
    { kind: 'text', text: `ここから ${b} とる`, size: 'm' },
  ],
});

function calcItem(
  obj: Obj,
  level: number,
  a: number,
  b: number,
  alt: boolean,
  rng: Rng,
): NumberItem {
  const d = a - b;
  if (alt) {
    const blocks = rng.next() < 0.5;
    return {
      engine: 'number',
      id: `${obj}-alt:${a}-${b}`,
      objective: obj,
      level,
      prompt: blocks
        ? `ブロックが ${a}こ あります。${b}こ とると のこりは いくつ？`
        : 'けいさん しよう。',
      figure: blocks ? blocksFig(a, b) : { kind: 'text', text: `${a} − ${b} ＝ {{}}`, size: 'xl' },
      hints: hints(a, b),
      explain: explain(a, b),
      explainFigure: columnFigure(a, b, '−', String(d).length),
      identity: key(a, b),
      alt: true,
      fields: [{ answer: { kind: 'int', value: d } }],
      wrongAnswers: wrongs(a, b, 1),
    };
  }
  const fields = placeFields(d);
  return {
    engine: 'number',
    id: `${obj}:${a}-${b}`,
    objective: obj,
    level,
    prompt: 'ひっさんで けいさん しよう。こたえを くらいごとに かこう。',
    figure: columnFigure(a, b, '−', fields.length),
    hints: hints(a, b),
    explain: explain(a, b),
    identity: key(a, b),
    alt: false,
    fields,
    wrongAnswers: wrongs(a, b, fields.length),
  };
}

function wordItem(level: number, a: number, b: number, alt: boolean, rng: Rng): NumberItem {
  const sc = SCENES[rng.int(0, SCENES.length - 1)]!;
  const d = a - b;
  return {
    engine: 'number',
    id: `bunshou${alt ? '-alt' : ''}:${sc.id}:${a}-${b}`,
    objective: 'bunshou',
    level,
    prompt: sc.text(a, b),
    // テープ図: ぜんたい a のうち b と のこり（ちがい）？
    figure: alt
      ? {
          kind: 'tape',
          parts: [
            { length: b, label: String(b), tone: 'a' },
            { length: d, label: '？', tone: 'b' },
          ],
          total: String(a),
        }
      : undefined,
    hints: [
      sc.type === 'nokori'
        ? '「のこりは」は ひきざん だね。'
        : '「ちがいは」「なんこ おおい」は、おおきい ほうから ちいさい ほうを ひくよ。',
      `しきは ${a} − ${b}。ひっさんで けいさん しよう。`,
      hints(a, b)[2]!,
    ],
    explain: `しきは ${a} − ${b} ＝ ${d}。こたえは ${d}${sc.unit} です。`,
    explainFigure: columnFigure(a, b, '−', String(d).length),
    identity: `${sc.id}:${key(a, b)}`,
    alt,
    fields: [{ label: sc.unit, answer: { kind: 'int', value: d } }],
    wrongAnswers: wrongs(a, b, 1),
  };
}

export function generateSubColumn(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.25;
  if (obj === 'bunshou') {
    const [a, b] = pickExpr(rng, rng.next() < 0.7 ? 'borrow' : 'noborrow');
    return wordItem(level, a, b, alt, rng);
  }
  const [a, b] = pickExpr(rng, obj);
  return calcItem(obj, level, a, b, alt, rng);
}

export const subColumn: UnitSpec = {
  id: 'g2.math.sub-column',
  title: 'ひきざんの ひっさん',
  stage: 'g2',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'math-formula-sub',
  prereq: ['g2.math.add-column'],
  objectives: [
    { id: 'noborrow', title: 'くりさがりの ない ひっさん' },
    { id: 'borrow', title: 'くりさがりの ある ひっさん' },
    { id: 'onedigit', title: '1けたを ひく・こたえが 1けた' },
    { id: 'bunshou', title: 'ぶんしょうだい（のこり・ちがい）' },
  ],
  misconceptions: [
    {
      id: 'bigger-minus-smaller',
      explain:
        'いちの くらいで、おおきい ほうから ちいさい ほうを ひいたのかな。うえの かずから したの かずを ひくよ。ひけない ときは じゅうの くらいから 10 かりよう。',
      figure: { kind: 'text', text: '62 − 27：2 − 7 は ひけない → 12 − 7', size: 'm' },
    },
    {
      id: 'no-decrement',
      explain:
        '10 かりたのに、じゅうの くらいを 1 へらすのを わすれたのかな。かした じゅうの くらいは 1 へるよ。',
    },
    {
      id: 'extra-borrow',
      explain:
        'くりさがりが ないのに じゅうの くらいを へらしたのかな。いちの くらいが ひける ときは かりないよ。',
    },
    {
      id: 'misalign',
      explain: 'くらいが ずれたのかな。1けたの かずは いちの くらいの したに かこう。',
    },
    {
      id: 'add-instead',
      explain: 'たしざんを したのかな。「のこり」「ちがい」は ひきざん だよ。',
    },
  ],
  levels: [
    { label: 'くりさがり なし', chance: 0.02 },
    { label: 'くりさがり あり', chance: 0.02 },
    { label: '1けた・こたえが 1けた', chance: 0.02 },
    { label: 'ぶんしょうだい', chance: 0.02 },
  ],
  intro: [
    {
      text: '62 − 27 を かんがえます。ひっさんでは くらいを たてに そろえて かきます。',
      figure: columnFigure(62, 27, '−', 2),
    },
    {
      text: 'いちの くらい 2 − 7 は ひけないので、じゅうの くらいから 10 かりて 12 − 7 ＝ 5。',
      figure: { kind: 'blocks', tens: 5, ones: 12 },
    },
    {
      text: 'じゅうの くらいは 1 かしたので 5。5 − 2 ＝ 3。こたえは 35。',
      figure: { kind: 'text', text: '62 − 27 ＝ 35', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateSubColumn(level, rng, index),
  },
  review: 'type',
  basis: '小学校学習指導要領（平成29年告示）算数 第2学年 A(2) 加法・減法（2位数の減法の筆算）',
  revised: '2026-10-24',
};
