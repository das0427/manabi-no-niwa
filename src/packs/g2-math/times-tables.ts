/**
 * g2.math.times-tables 九九（1〜9の段）と九九のきまり（curriculum-matrix 3.5）。
 * アレイ図で段を作る → 順に → ばらばら（時間の制限なし）→ 乗数が1増えると。
 *
 * 判定（統括の判断8）: 答えの数だけを判定する。式の順序は問わない。
 * 同一性キー: 九九の式（'7x8'）。九九は式ごとに覚える内容なので 7×8 と 8×7 は別（SR項: 式ごと）。
 *   定義域 = 1〜9 × 1〜9 の 81式（全件が基準）。きまり・文章題は別のキー（'kimari-up:7x8' など）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { opts, pickObj, wrongList } from './util';

type Obj = 'low' | 'high' | 'kimari' | 'bunshou';

/** 段階ごとの段と到達項目（2・5の段 → 3・4 → 6〜9・1 → ばらばら） */
const LEVELS: { objs: Obj[]; dans: number[] }[] = [
  { objs: ['low'], dans: [2, 5] },
  { objs: ['low'], dans: [2, 3, 4, 5] },
  // 1の段（9式）は low。偏りの検査のため high を多めに選ぶ
  { objs: ['high', 'high', 'high', 'low'], dans: [1, 6, 7, 8, 9] },
  { objs: ['low', 'high', 'kimari', 'bunshou'], dans: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
];

const SCENES: { id: string; unit: string; text: (a: number, b: number) => string }[] = [
  {
    id: 'chairs',
    unit: '人《にん》',
    text: (a, b) =>
      `1れつに ${a}人《にん》ずつ ${b}れつ ならんで います。ぜんぶで なん人《にん》 ですか。`,
  },
  {
    id: 'boxes',
    unit: 'こ',
    text: (a, b) => `1はこに ケーキが ${a}こずつ はいって います。${b}はこ では なんこ ですか。`,
  },
  {
    id: 'cups',
    unit: 'こ',
    text: (a, b) =>
      `1つの コップに いちごを ${a}こずつ いれます。コップ ${b}つ では、いちごは なんこ いりますか。`,
  },
  {
    id: 'stamps',
    unit: 'こ',
    text: (a, b) => `1まいの カードに ハンコを ${a}こずつ おします。${b}まい では なんこ ですか。`,
  },
  {
    id: 'cm',
    unit: 'cm',
    text: (a, b) =>
      `${a}cmの テープを ${b}本《ほん》 つなぎます。ぜんぶで なんcm ですか（のりしろは かんがえません）。`,
  },
  {
    id: 'packs',
    unit: 'まい',
    text: (a, b) =>
      `おりがみを ひとりに ${a}まいずつ、${b}人《にん》に くばります。なんまい いりますか。`,
  },
  {
    id: 'baskets',
    unit: 'こ',
    text: (a, b) => `かご 1つに くりを ${a}こずつ いれました。かご ${b}つ では なんこ ですか。`,
  },
  {
    id: 'flowers',
    unit: 'ほん',
    text: (a, b) =>
      `1つの はなたばに 花《はな》が ${a}ほんずつ あります。はなたば ${b}つ では、花《はな》は なんほん ですか。`,
  },
];

/** アレイ図（●が a こずつ b れつ） */
function arrayFig(a: number, b: number): Figure {
  return {
    kind: 'column',
    gap: 1,
    items: Array.from({ length: b }, () => ({
      kind: 'text' as const,
      text: '●'.repeat(a),
      size: 'm' as const,
    })),
  };
}

function wrongs(a: number, b: number): NumberItem['wrongAnswers'] {
  const p = a * b;
  return wrongList(String(p), 1, [
    [b > 1 ? a * (b - 1) : null, 'neighbor'],
    [b < 9 ? a * (b + 1) : null, 'neighbor'],
    [a > 1 ? (a - 1) * b : null, 'other-dan'],
    [a < 9 ? (a + 1) * b : null, 'other-dan'],
    [a + b, 'add-instead'],
  ]);
}

function hints(a: number, b: number): string[] {
  return [
    `${a}の だんの くく だよ。${a} × ${b} は ${a}の ${b}つぶん。`,
    b > 1
      ? `${a} × ${b - 1} ＝ ${a * (b - 1)}。かける かずが 1 ふえると、こたえは ${a} ふえるよ。`
      : `${a}が 1つ ぶん だね。`,
    b > 1 ? `${a * (b - 1)} ＋ ${a} を けいさん しよう。` : `${a}の 1つぶんは…`,
  ];
}

function tableItem(
  obj: 'low' | 'high',
  level: number,
  a: number,
  b: number,
  alt: boolean,
): NumberItem {
  const p = a * b;
  return {
    engine: 'number',
    id: `${obj}${alt ? '-alt' : ''}:${a}x${b}`,
    objective: obj,
    level,
    prompt: alt ? `●は ${a}こずつ ${b}れつ。ぜんぶで なんこ？` : 'けいさん しよう。',
    figure: alt ? arrayFig(a, b) : { kind: 'text', text: `${a} × ${b} ＝ {{}}`, size: 'xl' },
    hints: hints(a, b),
    explain: `${a} × ${b} ＝ ${p}。${a}の だんは こたえが ${a}ずつ ふえるよ。`,
    explainFigure: arrayFig(a, b),
    identity: `${a}x${b}`,
    alt,
    fields: [{ answer: { kind: 'int', value: p } }],
    wrongAnswers: wrongs(a, b),
  };
}

/** 九九のきまり */
function kimari(level: number, rng: Rng, alt: boolean): Item {
  const a = rng.int(2, 9);
  let b = rng.int(2, 9);
  if (alt) {
    // a ＝ b だと 正解が 問いと 同じ しきに なり、2 × 2 では「2 ＋ 2」も 答えが 同じ（正解が2つ）
    while (b === a) b = rng.int(2, 9);
    return {
      engine: 'choice',
      id: `kimari-alt:${a}x${b}`,
      objective: 'kimari',
      level,
      prompt: `${a} × ${b} と こたえが おなじ しきは どれ？`,
      hints: [
        'かけられる かずと かける かずを いれかえても、こたえは おなじ だよ。',
        `${a}と ${b}を いれかえて みよう。`,
        `${b} × □ の かたちを さがそう。`,
      ],
      explain: `${b} × ${a} ＝ ${a * b}。かけざんは いれかえても こたえが おなじです。`,
      identity: `kimari-swap:${a}x${b}`,
      alt: true,
      options: opts(`${b} × ${a}`, [
        [`${a} ＋ ${b}`, 'add-instead'],
        [`${a} × ${b === 9 ? b - 1 : b + 1}`, 'neighbor'],
        [`${a === 9 ? a - 1 : a + 1} × ${b}`, 'other-dan'],
      ]),
    } satisfies ChoiceItem;
  }
  const form = rng.int(0, 2);
  if (form === 0)
    return {
      engine: 'number',
      id: `kimari-up:${a}x${b}`,
      objective: 'kimari',
      level,
      prompt: `${a} × ${b} の こたえは、${a} × ${b - 1} の こたえより いくつ おおきい？`,
      figure: arrayFig(a, b),
      hints: [
        'かける かずが 1 ふえると、こたえは どう かわるかな。',
        `${a} × ${b - 1} は ${a}の ${b - 1}つぶん、${a} × ${b} は ${a}の ${b}つぶん。`,
        `${a}が 1つぶん ふえるね。`,
      ],
      explain: `かける かずが 1 ふえると、こたえは かけられる かずの ${a}だけ ふえます。`,
      identity: `kimari-up:${a}x${b}`,
      alt: false,
      fields: [{ answer: { kind: 'int', value: a } }],
      wrongAnswers: wrongList(String(a), 1, [
        [1, 'kimari-one'],
        [b, 'kimari-one'],
        [a * b, 'answer-in-box'],
      ]),
    } satisfies NumberItem;
  if (form === 1)
    return {
      engine: 'number',
      id: `kimari-plus:${a}x${b}`,
      objective: 'kimari',
      level,
      prompt: '□に あう かずは？',
      figure: { kind: 'text', text: `${a} × ${b} ＝ ${a} × ${b - 1} ＋ □`, size: 'xl' },
      hints: [
        'かける かずが 1 ちがう しきを くらべよう。',
        `${a} × ${b - 1} に ${a}を 1つぶん たすと ${a} × ${b}。`,
        `□は かけられる かずと おなじ…`,
      ],
      explain: `${a} × ${b} は ${a} × ${b - 1} より ${a} おおきいので、□は ${a} です。`,
      identity: `kimari-plus:${a}x${b}`,
      alt: false,
      fields: [{ label: '□', answer: { kind: 'int', value: a } }],
      wrongAnswers: wrongList(String(a), 1, [
        [1, 'kimari-one'],
        [b, 'kimari-one'],
        [a * b, 'answer-in-box'],
      ]),
    } satisfies NumberItem;
  return {
    engine: 'number',
    id: `kimari-swap:${a}x${b}`,
    objective: 'kimari',
    level,
    prompt: '□に あう かずは？',
    figure: { kind: 'text', text: `${a} × ${b} ＝ ${b} × □`, size: 'xl' },
    hints: [
      'かけられる かずと かける かずを いれかえても、こたえは おなじ だよ。',
      `ひだりの しきは ${a}と ${b}。`,
      `みぎの しきには ${b}が ある。のこりの かずは？`,
    ],
    explain: `${a} × ${b} ＝ ${b} × ${a} ＝ ${a * b}。いれかえても こたえは おなじです。`,
    identity: `kimari-eq:${a}x${b}`,
    alt: false,
    fields: [{ label: '□', answer: { kind: 'int', value: a } }],
    wrongAnswers: wrongList(String(a), 1, [
      [a * b, 'answer-in-box'],
      [b, 'kimari-one'],
    ]),
  } satisfies NumberItem;
}

function bunshou(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = SCENES[rng.int(0, SCENES.length - 1)]!;
  const a = rng.int(2, 9);
  const b = rng.int(2, 9);
  const p = a * b;
  return {
    engine: 'number',
    id: `bunshou${alt ? '-alt' : ''}:${sc.id}:${a}x${b}`,
    objective: 'bunshou',
    level,
    prompt: sc.text(a, b),
    figure: alt ? arrayFig(a, b) : undefined,
    hints: ['1つぶんの かずと いくつぶんを さがそう。', `しきは ${a} × ${b}。`, hints(a, b)[2]!],
    explain: `${a}の ${b}つぶんなので ${a} × ${b} ＝ ${p}。こたえは ${p}${sc.unit} です。`,
    identity: `${sc.id}:${a}x${b}`,
    alt,
    fields: [{ label: sc.unit, answer: { kind: 'int', value: p } }],
    wrongAnswers: wrongs(a, b),
  };
}

export function generateTimesTables(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.25;
  if (obj === 'kimari') return kimari(level, rng, alt);
  if (obj === 'bunshou') return bunshou(level, rng, alt);
  // 段は定義域から均等（low = 1〜5の段、high = 6〜9の段 に分ける）
  const dans = lv.dans.filter((d) => (obj === 'low' ? d <= 5 : d >= 6));
  const a = dans[rng.int(0, dans.length - 1)]!;
  const b = rng.int(1, 9);
  return tableItem(obj, level, a, b, alt);
}

export const timesTables: UnitSpec = {
  id: 'g2.math.times-tables',
  title: 'かけざんの くく',
  stage: 'g2',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'math-formula-add',
  prereq: ['g2.math.mult-meaning'],
  objectives: [
    { id: 'low', title: '1〜5の だん' },
    { id: 'high', title: '6〜9の だん' },
    { id: 'kimari', title: 'くくの きまり' },
    { id: 'bunshou', title: 'ぶんしょうだい' },
  ],
  misconceptions: [
    {
      id: 'neighbor',
      explain:
        'となりの くくと まちがえたのかな。ひとつ まえの こたえに、かけられる かずを たして たしかめよう。',
    },
    {
      id: 'other-dan',
      explain: 'ちがう だんの くくを いったのかな。はじめの かずが なんの だんかを たしかめよう。',
    },
    {
      id: 'add-instead',
      explain: 'たしざんを したのかな。× は「いくつぶん」の しるし だよ。',
    },
    {
      id: 'kimari-one',
      explain:
        'かける かずが 1 ふえると、こたえは かけられる かずの ぶんだけ ふえるよ。3の だんなら 3ずつ。',
    },
    {
      id: 'answer-in-box',
      explain: 'しきの こたえを かいたのかな。□に はいる かずを かんがえよう。',
    },
  ],
  levels: [
    { label: '2・5の だん', chance: 0.02 },
    { label: '3・4の だん', chance: 0.02 },
    { label: '6〜9・1の だん', chance: 0.02 },
    { label: 'ばらばら・きまり', chance: 0.02 },
  ],
  intro: [
    {
      text: '●が 2こずつ 3れつ。2の 3つぶんで 2 × 3。',
      figure: arrayFig(2, 3),
    },
    {
      text: '2の だんは、こたえが 2ずつ ふえます。2、4、6、8、…',
      figure: {
        kind: 'numberline',
        min: 0,
        max: 20,
        step: 2,
        minorStep: 1,
        labelEvery: 2,
        jump: { from: 4, to: 6 },
      },
    },
    {
      text: '2 × 3 ＝ 6（に さん が ろく）。くくを となえて おぼえよう。じかんは きにしなくて だいじょうぶ。',
      figure: { kind: 'text', text: '2 × 3 ＝ 6', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateTimesTables(level, rng, index),
    domainSize: 81,
  },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第2学年 A(3) 乗法（乗法九九、1位数と1位数との乗法が確実にできる、乗法のきまり）',
  revised: '2026-10-24',
};
