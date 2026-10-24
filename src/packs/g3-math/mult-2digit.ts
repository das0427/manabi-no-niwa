/**
 * g3.math.mult-2digit 2・3位数×2位数の筆算（curriculum-matrix 3.6）。
 * 何十をかける → 部分積 → 2位数×2位数 → 3位数×2位数 → 文章題。
 *
 * 筆算は number の複数欄。「部分積」の到達項目は 1つ目の部分積・2つ目の部分積（十の位の数をかけた積を
 * 1けた ずらして書く数）・答え の3欄。部分積の位をずらさない・一の位だけかける・同じ位どうしだけかける・
 * 0の付け忘れ を誤概念に結ぶ。
 * 同一性キー: 'a x b'（かけられる数が上、かける数が2位数。向きは固定）。文章題は「場面 × 式」。
 */
import type { Rng } from '../../core/util/rng';
import type { Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { columnFigure, pickObj, placeFields, toFields, wrongList } from './util';

type Obj = 'tens' | 'partial' | 'two' | 'three' | 'bunshou';

function wrongVals(a: number, b: number): [number | null, string][] {
  const b1 = b % 10;
  const b10 = Math.floor(b / 10);
  const p1 = a * b1;
  const p2 = a * b10;
  return [
    [p1 + p2, 'no-shift'],
    [p1, 'ones-only'],
    [a < 100 && b1 > 0 ? Math.floor(a / 10) * b10 * 100 + (a % 10) * b1 : null, 'same-place'],
    [a + b, 'wrong-op'],
  ];
}

function wrongs(a: number, b: number, n: number): NumberItem['wrongAnswers'] {
  const ans = a * b;
  return wrongList(
    n === 1 ? String(ans) : toFields(ans, n)!,
    n,
    wrongVals(a, b).map(([v, m]) => [v === null ? null : n === 1 ? String(v) : toFields(v, n), m]),
  );
}

function pick(rng: Rng, kind: 'two' | 'three'): [number, number] {
  for (;;) {
    const a = kind === 'two' ? rng.int(12, 99) : rng.int(102, 999);
    const b = rng.int(12, 99);
    if (a % 10 !== 0 && b % 10 !== 0) return [a, b];
  }
}

function explainOf(a: number, b: number): string {
  const b1 = b % 10;
  const b10 = Math.floor(b / 10);
  return `${a} × ${b1} ＝ ${a * b1}（一《いち》のくらいの ${b1}を かける）。${a} × ${b10} ＝ ${a * b10}（十《じゅう》のくらいの ${b10}を かける。じっさいは ${a} × ${b10 * 10} ＝ ${a * b10 * 10}なので、1けた 左《ひだり》に ずらして 書《か》く）。${a * b1} ＋ ${a * b10 * 10} ＝ ${a * b}。答《こた》えは ${a * b}です。`;
}

function hintsOf(a: number, b: number): string[] {
  const b1 = b % 10;
  const b10 = Math.floor(b / 10);
  return [
    `まず ${a} × ${b1}、つぎに ${a} × ${b10} を 計算《けいさん》しよう。`,
    `${a} × ${b1} ＝ ${a * b1}。${a} × ${b10} は 十《じゅう》のくらいから 書《か》くよ。`,
    `${a * b1} と ${a * b10 * 10} を たそう。`,
  ];
}

function tens(level: number, rng: Rng, alt: boolean): NumberItem {
  const a = rng.int(11, 99);
  const t = rng.int(2, 9);
  const b = t * 10;
  return {
    engine: 'number',
    id: `tens${alt ? '-alt' : ''}:${a}x${b}`,
    objective: 'tens',
    level,
    prompt: alt
      ? `1こ ${a}円《えん》の パンを ${b}こ 買《か》います。代金《だいきん》は 何《なん》円《えん》ですか。`
      : '計算《けいさん》しよう。',
    figure: alt ? undefined : { kind: 'text', text: `${a} × ${b} ＝ {{}}`, size: 'xl' },
    hints: [
      `${b}は 10の ${t}こ分《ぶん》 だね。`,
      `まず ${a} × ${t} を 計算《けいさん》しよう。`,
      `${a} × ${t} ＝ ${a * t}。それを 10倍《ばい》すると…`,
    ],
    explain: `${a} × ${b} は ${a} × ${t} の 10倍《ばい》。${a} × ${t} ＝ ${a * t} なので、${a * b}です。`,
    identity: alt ? `pan:${a}x${b}` : `${a}x${b}`,
    alt,
    fields: [
      alt
        ? { label: '円《えん》', answer: { kind: 'int', value: a * b } }
        : { answer: { kind: 'int', value: a * b } },
    ],
    wrongAnswers: wrongList(String(a * b), 1, [
      [a * t, 'zero-drop'],
      [a * t * 100, 'zero-drop'],
      [a + b, 'wrong-op'],
    ]),
  };
}

function partial(level: number, rng: Rng, alt: boolean): NumberItem {
  const [a, b] = pick(rng, 'two');
  const b1 = b % 10;
  const b10 = Math.floor(b / 10);
  const p1 = a * b1;
  const p2 = a * b10;
  const ans = a * b;
  if (alt)
    return {
      engine: 'number',
      id: `partial-alt:${a}x${b}`,
      objective: 'partial',
      level,
      prompt: `${a} × ${b} を、${b}を ${b10 * 10}と ${b1}に 分《わ》けて 計算《けいさん》します。□に あう 数《かず》は？`,
      figure: {
        kind: 'text',
        text: `${a} × ${b1} ＝ {{}}\u3000${a} × ${b10 * 10} ＝ {{}}\u3000あわせて {{}}`,
        size: 'l',
      },
      hints: hintsOf(a, b),
      explain: explainOf(a, b),
      identity: `${a}x${b}`,
      alt: true,
      fields: [
        { label: `${a} × ${b1}`, answer: { kind: 'int', value: p1 } },
        { label: `${a} × ${b10 * 10}`, answer: { kind: 'int', value: p2 * 10 } },
        { label: 'あわせて', answer: { kind: 'int', value: ans } },
      ],
      wrongAnswers: wrongList(`${p1}|${p2 * 10}|${ans}`, 3, [
        [`${p1}|${p2}|${p1 + p2}`, 'no-shift'],
        [`${p1}|${p2 * 10}|${p1}`, 'ones-only'],
      ]),
    };
  return {
    engine: 'number',
    id: `partial:${a}x${b}`,
    objective: 'partial',
    level,
    prompt: '筆算《ひっさん》の とちゅうの 数《かず》と 答《こた》えを 書《か》こう。',
    figure: columnFigure(a, b, '×', String(ans).length, [String(p1), `${p2}\u3000`]),
    hints: hintsOf(a, b),
    explain: explainOf(a, b),
    identity: `${a}x${b}`,
    alt: false,
    fields: [
      { label: `1だんめ ${a} × ${b1}`, answer: { kind: 'int', value: p1 } },
      { label: `2だんめ ${a} × ${b10}`, answer: { kind: 'int', value: p2 } },
      { label: '答《こた》え', answer: { kind: 'int', value: ans } },
    ],
    wrongAnswers: wrongList(`${p1}|${p2}|${ans}`, 3, [
      [`${p1}|${p2}|${p1 + p2}`, 'no-shift'],
      [`${p1}|${p2 * 10}|${ans}`, 'shift-zero'],
      [`${p1}|${p2}|${p1}`, 'ones-only'],
    ]),
  };
}

function calc(obj: Obj, level: number, a: number, b: number, alt: boolean): NumberItem {
  const ans = a * b;
  if (alt)
    return {
      engine: 'number',
      id: `${obj}-alt:${a}x${b}`,
      objective: obj,
      level,
      prompt:
        '横《よこ》書《が》きの 式《しき》を 筆算《ひっさん》に なおして 計算《けいさん》しよう。',
      figure: { kind: 'text', text: `${a} × ${b} ＝ {{}}`, size: 'xl' },
      hints: hintsOf(a, b),
      explain: explainOf(a, b),
      explainFigure: columnFigure(a, b, '×', String(ans).length),
      identity: `${a}x${b}`,
      alt: true,
      fields: [{ answer: { kind: 'int', value: ans } }],
      wrongAnswers: wrongs(a, b, 1),
    };
  const fields = placeFields(ans);
  return {
    engine: 'number',
    id: `${obj}:${a}x${b}`,
    objective: obj,
    level,
    prompt: '筆算《ひっさん》で 計算《けいさん》しよう。答《こた》えを くらいごとに 書《か》こう。',
    figure: columnFigure(a, b, '×', fields.length),
    hints: hintsOf(a, b),
    explain: explainOf(a, b),
    identity: `${a}x${b}`,
    alt: false,
    fields,
    wrongAnswers: wrongs(a, b, fields.length),
  };
}

interface Scene {
  id: string;
  unit: string;
  text: (a: number, b: number) => string;
}
const SCENES: Scene[] = [
  {
    id: 'tickets',
    unit: '円《えん》',
    text: (a, b) =>
      `1まい ${a}円《えん》の 入場《にゅうじょう》けんを ${b}まい 買《か》います。代金《だいきん》は 何《なん》円《えん》ですか。`,
  },
  {
    id: 'chairs',
    unit: 'きゃく',
    text: (a, b) =>
      `1れつに ${a}きゃくずつ いすを ならべます。${b}れつ では、いすは 何《なん》きゃく ですか。`,
  },
  {
    id: 'eggs',
    unit: 'こ',
    text: (a, b) =>
      `1はこに ${a}こ 入《はい》った たまごが ${b}はこ あります。たまごは 全部《ぜんぶ》で 何《なん》こですか。`,
  },
  {
    id: 'walk',
    unit: 'm',
    text: (a, b) =>
      `1日《にち》に ${a}m ずつ 走《はし》ります。${b}日《にち》で 何《なん》m 走《はし》りますか。`,
  },
  {
    id: 'paper',
    unit: 'まい',
    text: (a, b) =>
      `1人《り》に ${a}まいずつ 画用紙《がようし》を くばります。${b}人《にん》に くばるには、何《なん》まい いりますか。`,
  },
  {
    id: 'rope',
    unit: 'cm',
    text: (a, b) => `${a}cmの ロープの ${b}倍《ばい》の 長《なが》さは 何《なん》cmですか。`,
  },
  {
    id: 'bus',
    unit: '人《にん》',
    text: (a, b) =>
      `1台《だい》に ${a}人《にん》 乗《の》れる バスが ${b}台《だい》 あります。全部《ぜんぶ》で 何《なん》人《にん》 乗《の》れますか。`,
  },
  {
    id: 'stamps',
    unit: '円《えん》',
    text: (a, b) =>
      `1まい ${a}円《えん》の シールを ${b}まい 買《か》うと、何《なん》円《えん》に なりますか。`,
  },
];

function word(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = SCENES[rng.int(0, SCENES.length - 1)]!;
  const [a, b] = pick(rng, rng.next() < 0.6 ? 'two' : 'three');
  const ans = a * b;
  return {
    engine: 'number',
    id: `bunshou${alt ? '-alt' : ''}:${sc.id}:${a}x${b}`,
    objective: 'bunshou',
    level,
    prompt: sc.text(a, b),
    figure: alt
      ? { kind: 'text', text: `1つ分《ぶん》 ${a} ／ いくつ分《ぶん》 ${b}`, size: 'l' }
      : undefined,
    hints: [
      '1つ分《ぶん》の 数《かず》と、いくつ分《ぶん》かを 見《み》つけよう。',
      `式《しき》は ${a} × ${b}。`,
      hintsOf(a, b)[1]!,
    ],
    explain: `式《しき》は ${a} × ${b} ＝ ${ans}。答《こた》えは ${ans}${sc.unit}です。`,
    explainFigure: columnFigure(a, b, '×', String(ans).length),
    identity: `${sc.id}:${a}x${b}`,
    alt,
    fields: [{ label: sc.unit, answer: { kind: 'int', value: ans } }],
    wrongAnswers: wrongs(a, b, 1),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['tens', 'partial'] },
  { objs: ['partial', 'two'] },
  { objs: ['two', 'three'] },
  { objs: ['two', 'three', 'bunshou'] },
];

export function generateMult2digit(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.25;
  switch (obj) {
    case 'tens':
      return tens(level, rng, alt);
    case 'partial':
      return partial(level, rng, alt);
    case 'bunshou':
      return word(level, rng, alt);
    default: {
      const [a, b] = pick(rng, obj);
      return calc(obj, level, a, b, alt);
    }
  }
}

export const mult2digit: UnitSpec = {
  id: 'g3.math.mult-2digit',
  title: '×2けたの 筆算《ひっさん》',
  stage: 'g3',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'math-formula-add',
  prereq: ['g3.math.mult-1digit'],
  objectives: [
    { id: 'tens', title: '何十《なんじゅう》を かける' },
    { id: 'partial', title: '筆算《ひっさん》の とちゅうの 数《かず》' },
    { id: 'two', title: '2けた × 2けた' },
    { id: 'three', title: '3けた × 2けた' },
    { id: 'bunshou', title: '文章題《ぶんしょうだい》' },
  ],
  misconceptions: [
    {
      id: 'no-shift',
      explain:
        '2つめの だんを 1けた ずらさずに たしたのかな。十《じゅう》のくらいの 数《かず》を かけた 答《こた》えは、十《じゅう》のくらいから 書《か》こう。',
      figure: { kind: 'text', text: '36 × 24: 144 ＋ 720 ＝ 864（72 を 1けた 左へ）', size: 'm' },
    },
    {
      id: 'ones-only',
      explain:
        '一《いち》のくらいの 数《かず》だけ かけたのかな。かける数《かず》の 十《じゅう》のくらいの 数《かず》も かけて、たそう。',
    },
    {
      id: 'same-place',
      explain:
        'おなじ くらいどうしだけ かけたのかな。かける数《かず》の 一《いち》のくらいも 十《じゅう》のくらいも、かけられる数《かず》 ぜんぶに かけるよ。',
    },
    {
      id: 'shift-zero',
      explain:
        '2だんめに 0を つけたのかな。2だんめは かける数《かず》の 十《じゅう》のくらいの 数《かず》を かけた 答《こた》え（36 × 2 なら 72）。0は 書《か》かずに、1けた 左《ひだり》に ずらして 書《か》くよ。',
    },
    {
      id: 'zero-drop',
      explain:
        '0の 数《かず》が あって いないのかな。× 30 は × 3 の 10倍《ばい》。答《こた》えの 右《みぎ》に 0を 1こ つけるよ。',
    },
    {
      id: 'wrong-op',
      explain:
        'たし算《ざん》を したのかな。おなじ 数《かず》が いくつ分《ぶん》 あるときは かけ算《ざん》だよ。',
    },
  ],
  levels: [
    { label: '何十を かける・とちゅうの 数', chance: 0.01 },
    { label: '2けた×2けた', chance: 0.01 },
    { label: '3けた×2けた', chance: 0.01 },
    { label: '文章題', chance: 0.01 },
  ],
  intro: [
    {
      text: '23 × 30 は 23 × 3 の 10倍《ばい》。23 × 3 ＝ 69 なので 690です。',
      figure: { kind: 'text', text: '23 × 30 ＝ 690', size: 'xl' },
    },
    {
      text: '36 × 24 の 筆算《ひっさん》。まず 36 × 4 ＝ 144。つぎに 36 × 2 ＝ 72 を、十《じゅう》のくらいから 書《か》きます（720の いみ）。',
      figure: columnFigure(36, 24, '×', 3, ['144', '72\u3000']),
    },
    {
      text: '144 ＋ 720 ＝ 864。答《こた》えは 864です。',
      figure: { kind: 'text', text: '36 × 24 ＝ 864', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateMult2digit(level, rng, index),
  },
  review: 'type',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第3学年 A(3) 乗法（2位数や3位数に2位数をかける乗法の計算と筆算）',
  revised: '2026-10-24',
};
