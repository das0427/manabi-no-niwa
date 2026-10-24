/**
 * g2.math.mult-meaning かけ算の意味（1つ分の数 × いくつ分）（curriculum-matrix 3.5）。
 * 同じ数ずつの絵 →「3この4つぶん」と式 → 文章題。ばい（何倍）も扱う。
 *
 * 式の順序（統括の判断8・curriculum-matrix 2.4）: 答えは数だけを判定する。式を問う問題は「場面に合う式」を
 * 選択肢で問い、入れかえただけの式（4 × 3）は選択肢に入れない（判定の基準を解説に書く）。
 * 「1つぶんの かず」と「いくつぶん」を見分ける問題は、かけ算の意味そのものなので欄を分けて問う。
 *
 * 同一性キー: 問う形 × 1つ分 × いくつ分（a×b と b×a は意味が違うので別）。文章題は場面 × 数。
 * 絵の種類は同一性に入れない（1.4）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { opts, pickObj, wrongList } from './util';

type Obj = 'ikutsubun' | 'shiki' | 'ruika' | 'bai' | 'bunshou';

const LEVELS: { objs: Obj[]; maxA: number; maxB: number }[] = [
  { objs: ['ikutsubun', 'shiki', 'ruika'], maxA: 6, maxB: 6 },
  { objs: ['ikutsubun', 'shiki', 'ruika', 'bai', 'bunshou'], maxA: 9, maxB: 6 },
];

const THINGS = ['apple', 'mikan', 'strawberry', 'egg', 'onigiri', 'tomato'];

/** 同じ数ずつの まとまり（絵） */
function groupsFig(id: string, a: number, b: number): Figure {
  return {
    kind: 'row',
    gap: 4,
    items: Array.from({ length: b }, () => ({ kind: 'illust' as const, id, count: a })),
  };
}

/** アレイ（●を a こずつ b れつ） */
function arrayFig(a: number, b: number): Figure {
  return {
    kind: 'column',
    gap: 1,
    items: Array.from({ length: b }, () => ({
      kind: 'text' as const,
      text: '●'.repeat(a),
      size: 'l' as const,
    })),
  };
}

interface Scene {
  id: string;
  unit: string;
  text: (a: number, b: number) => string;
}

/** 文章題の場面（8） */
const SCENES: Scene[] = [
  {
    id: 'plates',
    unit: 'こ',
    text: (a, b) =>
      `1さらに みかんが ${a}こずつ のって います。${b}さら では、みかんは ぜんぶで なんこ ですか。`,
  },
  {
    id: 'pencils',
    unit: 'ほん',
    text: (a, b) =>
      `1はこに えんぴつが ${a}ほんずつ はいって います。${b}はこ では ぜんぶで なんほん ですか。`,
  },
  {
    id: 'cars',
    unit: '人《にん》',
    text: (a, b) =>
      `1だいの くるまに ${a}人《にん》ずつ のります。${b}だい では なん人《にん》 のれますか。`,
  },
  {
    id: 'candy',
    unit: 'こ',
    text: (a, b) =>
      `あめを 1ふくろに ${a}こずつ いれます。${b}ふくろ つくると、あめは なんこ いりますか。`,
  },
  {
    id: 'vases',
    unit: 'ほん',
    text: (a, b) =>
      `かびん 1つに 花《はな》を ${a}ほんずつ さします。かびんが ${b}つ あると、花《はな》は なんほん いりますか。`,
  },
  {
    id: 'cards',
    unit: 'まい',
    text: (a, b) =>
      `カードを ひとりに ${a}まいずつ くばります。${b}人《にん》に くばると なんまい いりますか。`,
  },
  {
    id: 'benches',
    unit: '人《にん》',
    text: (a, b) =>
      `ながいす 1きゃくに ${a}人《にん》ずつ すわります。${b}きゃく では なん人《にん》 すわれますか。`,
  },
  {
    id: 'eggs',
    unit: 'こ',
    text: (a, b) =>
      `1パックに たまごが ${a}こずつ はいって います。${b}パック では なんこ ですか。`,
  },
];

const sumText = (a: number, b: number) => Array.from({ length: b }, () => String(a)).join(' ＋ ');

/** 1つぶんの かずと いくつぶんを 見つける */
function ikutsubun(level: number, rng: Rng, a: number, b: number, alt: boolean): NumberItem {
  const id = THINGS[rng.int(0, THINGS.length - 1)]!;
  return {
    engine: 'number',
    id: `ikutsubun${alt ? '-alt' : ''}:${a}x${b}`,
    objective: 'ikutsubun',
    level,
    prompt: alt
      ? '●は なんこずつ、なんれつ ありますか。'
      : 'おなじ かずずつの まとまりが あります。1つぶんの かずと、いくつぶんを かこう。',
    figure: alt ? arrayFig(a, b) : groupsFig(id, a, b),
    fields: alt
      ? [
          { label: 'こずつ', answer: { kind: 'int', value: a } },
          { label: 'れつ', answer: { kind: 'int', value: b } },
        ]
      : [
          { label: '1つぶんの かず', answer: { kind: 'int', value: a } },
          { label: 'いくつぶん', answer: { kind: 'int', value: b } },
        ],
    hints: [
      alt ? 'よこの 1れつに ●が いくつ あるか みよう。' : '1つの まとまりに いくつ あるか みよう。',
      alt ? `1れつは ${a}こ。` : `1つの まとまりは ${a}こ。`,
      alt ? 'れつの かずを かぞえよう。' : 'まとまりが いくつ あるか かぞえよう。',
    ],
    explain: `${a}こずつ ${b}つぶん です。かけざんの しきでは ${a} × ${b}（1つぶんの かず × いくつぶん）と かきます。`,
    identity: `ikutsubun:${a}x${b}`,
    alt,
    wrongAnswers: wrongList(`${a}|${b}`, 2, [
      [`${b}|${a}`, 'swap-meaning'],
      [`${a * b}|${b}`, 'total-as-unit'],
    ]),
  };
}

/** 場面に合う式を選ぶ */
function shiki(level: number, rng: Rng, a: number, b: number, alt: boolean): ChoiceItem {
  const sc = SCENES[rng.int(0, SCENES.length - 1)]!;
  const id = THINGS[rng.int(0, THINGS.length - 1)]!;
  return {
    engine: 'choice',
    id: `shiki${alt ? '-alt' : ''}:${alt ? `${sc.id}:` : ''}${a}x${b}`,
    objective: 'shiki',
    level,
    prompt: alt
      ? `${sc.text(a, b)}\nこの おはなしに あう しきは どれ？`
      : 'え に あう かけざんの しきは どれ？',
    figure: alt ? undefined : groupsFig(id, a, b),
    hints: [
      '1つぶんの かずと、いくつぶんを みつけよう。',
      `1つぶんは ${a}。いくつぶんは ${b}。`,
      'かけざんは「1つぶんの かず × いくつぶん」の じゅんに かくよ。',
    ],
    explain: `${a}の ${b}つぶんなので ${a} × ${b}。かけざんの しきは「1つぶんの かず × いくつぶん」と かきます。`,
    identity: alt ? `shiki:${sc.id}:${a}x${b}` : `shiki:${a}x${b}`,
    alt,
    options: opts(`${a} × ${b}`, [
      [`${a} ＋ ${b}`, 'add-instead'],
      [`${a} × ${b + 1}`, 'count-groups'],
      [`${a + 1} × ${b}`, 'count-groups'],
    ]),
  };
}

/** 同じ数を たして 答えを 求める */
function ruika(level: number, a: number, b: number, alt: boolean): NumberItem {
  const p = a * b;
  if (alt)
    return {
      engine: 'number',
      id: `ruika-alt:${a}x${b}`,
      objective: 'ruika',
      level,
      prompt: 'この たしざんを かけざんの しきに します。□に あう かずは？',
      figure: { kind: 'text', text: `${sumText(a, b)} ＝ □ × □`, size: 'l' },
      fields: [
        { label: '1つぶん', answer: { kind: 'int', value: a } },
        { label: 'いくつぶん', answer: { kind: 'int', value: b } },
      ],
      hints: [
        'おなじ かずを なんかい たして いるかな。',
        `たして いる かずは ${a}。`,
        `${a}を なんかい たして いるか かぞえよう。`,
      ],
      explain: `${a}を ${b}かい たして いるので、${a} × ${b} です。`,
      identity: `ruika-shiki:${a}x${b}`,
      alt: true,
      wrongAnswers: wrongList(`${a}|${b}`, 2, [
        [`${b}|${a}`, 'swap-meaning'],
        [`${a}|${b - 1}`, 'count-groups'],
      ]),
    };
  return {
    engine: 'number',
    id: `ruika:${a}x${b}`,
    objective: 'ruika',
    level,
    prompt: `${a} × ${b} の こたえを、たしざんで もとめよう。`,
    figure: { kind: 'text', text: `${a} × ${b} ＝ ${sumText(a, b)} ＝ {{}}`, size: 'l' },
    hints: [
      `${a} × ${b} は ${a}の ${b}つぶん。`,
      `${a}を ${b}かい たそう。`,
      `${Array.from({ length: b - 1 }, (_, i) => a * (i + 1)).join('、')}、…`,
    ],
    explain: `${sumText(a, b)} ＝ ${p}。${a} × ${b} ＝ ${p} です。`,
    identity: `ruika:${a}x${b}`,
    alt: false,
    fields: [{ answer: { kind: 'int', value: p } }],
    wrongAnswers: wrongList(String(p), 1, [
      [a + b, 'add-instead'],
      [a * (b - 1), 'count-groups'],
      [a * (b + 1), 'count-groups'],
    ]),
  };
}

/** ばい（何倍） */
function bai(level: number, a: number, b: number, alt: boolean): NumberItem {
  const p = a * b;
  const tape: Figure = {
    kind: 'column',
    items: [
      {
        kind: 'tape',
        parts: [
          { length: a, label: `${a}cm`, tone: 'a' },
          { length: a * (b - 1), tone: 'muted' },
        ],
      },
      {
        kind: 'tape',
        parts: Array.from({ length: b }, () => ({
          length: a,
          label: `${a}cm`,
          tone: 'a' as const,
        })),
        total: alt ? `${p}cm` : '？cm',
      },
    ],
  };
  return {
    engine: 'number',
    id: `bai${alt ? '-alt' : ''}:${a}x${b}`,
    objective: 'bai',
    level,
    prompt: alt
      ? `${p}cmの テープは、${a}cmの テープの なんばい ですか。`
      : `${a}cmの テープの ${b}ばいの ながさは なんcm ですか。`,
    figure: tape,
    fields: [
      alt
        ? { label: 'ばい', answer: { kind: 'int', value: b } }
        : { label: 'cm', answer: { kind: 'int', value: p } },
    ],
    hints: [
      `${b === 2 ? '2ばいは 2つぶん' : 'なんばいは いくつぶん'} と おなじ いみ だよ。`,
      alt
        ? `${a}cmが いくつ ならぶと ${p}cmに なるかな。`
        : `${a}cmの ${b}つぶん。しきは ${a} × ${b}。`,
      alt
        ? `${Array.from({ length: Math.max(1, b - 1) }, (_, i) => a * (i + 1)).join('、')}、…`
        : `${sumText(a, b)} を けいさん しよう。`,
    ],
    explain: alt
      ? `${a}cmの ${b}つぶんで ${p}cm。${p}cmは ${a}cmの ${b}ばい です。`
      : `${a}cmの ${b}ばいは ${a} × ${b} ＝ ${p}で ${p}cm です。`,
    identity: alt ? `bai-how:${a}x${b}` : `bai:${a}x${b}`,
    alt,
    wrongAnswers: alt
      ? wrongList(String(b), 1, [
          [a, 'swap-meaning'],
          [p, 'total-as-unit'],
        ])
      : wrongList(String(p), 1, [
          [a + b, 'add-instead'],
          [a * (b + 1), 'count-groups'],
        ]),
  };
}

/** 文章題（答えの数を書く） */
function bunshou(level: number, rng: Rng, a: number, b: number, alt: boolean): NumberItem {
  const sc = SCENES[rng.int(0, SCENES.length - 1)]!;
  const p = a * b;
  return {
    engine: 'number',
    id: `bunshou${alt ? '-alt' : ''}:${sc.id}:${a}x${b}`,
    objective: 'bunshou',
    level,
    prompt: sc.text(a, b),
    figure: alt ? arrayFig(a, b) : undefined,
    fields: [{ label: sc.unit, answer: { kind: 'int', value: p } }],
    hints: [
      '1つぶんの かずと いくつぶんを さがそう。',
      `${a}の ${b}つぶん。しきは ${a} × ${b}。`,
      `${sumText(a, b)} を けいさん しよう。`,
    ],
    explain: `${a}の ${b}つぶんなので、しきは ${a} × ${b} ＝ ${p}。こたえは ${p}${sc.unit} です。`,
    identity: `${sc.id}:${a}x${b}`,
    alt,
    wrongAnswers: wrongList(String(p), 1, [
      [a + b, 'add-instead'],
      [a * (b - 1), 'count-groups'],
      [a * (b + 1), 'count-groups'],
    ]),
  };
}

export function generateMultMeaning(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  const a = rng.int(2, lv.maxA);
  const b = rng.int(2, lv.maxB);
  switch (obj) {
    case 'ikutsubun':
      return ikutsubun(level, rng, a, b, alt);
    case 'shiki':
      return shiki(level, rng, a, b, alt);
    case 'ruika':
      return ruika(level, a, b, alt);
    case 'bai':
      return bai(level, a, b, alt);
    case 'bunshou':
      return bunshou(level, rng, a, b, alt);
  }
}

export const multMeaning: UnitSpec = {
  id: 'g2.math.mult-meaning',
  title: 'かけざんの いみ',
  stage: 'g2',
  subject: 'math',
  domain: 'A-number',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-math',
  prereq: ['g2.math.add-sub-relations'],
  objectives: [
    { id: 'ikutsubun', title: '1つぶんの かずと いくつぶん' },
    { id: 'shiki', title: 'え・おはなしに あう しき' },
    { id: 'ruika', title: 'おなじ かずを たす' },
    { id: 'bai', title: 'なんばい' },
    { id: 'bunshou', title: 'ぶんしょうだい' },
  ],
  misconceptions: [
    {
      id: 'swap-meaning',
      explain:
        '1つぶんの かずと いくつぶんが いれかわったのかな。1つの まとまりに いくつ あるかが「1つぶんの かず」だよ。',
      figure: groupsFig('apple', 3, 4),
    },
    {
      id: 'total-as-unit',
      explain: 'ぜんぶの かずを かいたのかな。1つの まとまりの なかの かずを かぞえよう。',
    },
    {
      id: 'add-instead',
      explain: '2つの かずを たしたのかな。「3こずつ 4つぶん」は 3を 4かい たす ことだよ。',
    },
    {
      id: 'count-groups',
      explain: 'まとまりの かずを かぞえまちがえたのかな。1つずつ ゆびで おさえて かぞえよう。',
    },
  ],
  levels: [
    { label: 'まとまりと しき（6まで）', chance: 0.05 },
    { label: 'ばい・ぶんしょうだい', chance: 0.05 },
  ],
  intro: [
    {
      text: 'りんごが 3こずつ、4つの まとまりに なって います。',
      figure: groupsFig('apple', 3, 4),
    },
    {
      text: '「3この 4つぶん」を、かけざんの しきで 3 × 4 と かきます。「さん かける よん」と よみます。',
      figure: { kind: 'text', text: '3 × 4', size: 'xl' },
    },
    {
      text: 'こたえは 3 ＋ 3 ＋ 3 ＋ 3 で 12。3 × 4 ＝ 12 です。',
      figure: { kind: 'text', text: '3 × 4 ＝ 12', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateMultMeaning(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第2学年 A(3) 乗法（乗法の意味、乗法が用いられる場面、何倍）',
  revised: '2026-10-24',
};
