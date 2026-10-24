/**
 * g3.math.weight 重さ（g・kg・t）、はかりの目盛り（curriculum-matrix 3.6）。
 * はかり（最小目盛り 5g・10g・20g）→ 単位の換算 → 重さの計算 → 単位を選ぶ（t に触れる）。
 *
 * 同一性キー: 問う形 × はかりの種類 × 数（'scale:1000:345'、'kg-g:1:300' など）。
 */
import type { Rng } from '../../core/util/rng';
import type { MeasureItem, MeasureScale } from '../../engines/measure/measure';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { pickObj, pickOne, wrongList } from './util';

type Obj = 'scale' | 'convert' | 'calc' | 'unit';

const SCALES: MeasureScale[] = [
  { unit: 'g', min: 0, max: 1000, minor: 5, mid: 50, major: 100 },
  { unit: 'g', min: 0, max: 2000, minor: 10, mid: 50, major: 100 },
  { unit: 'g', min: 0, max: 4000, minor: 20, mid: 100, major: 500 },
];

function scaleItem(level: number, rng: Rng, alt: boolean): MeasureItem {
  const sc = pickOne(rng, SCALES);
  const n = sc.max / sc.minor;
  let k: number;
  do k = rng.int(1, n - 1);
  while ((k * sc.minor) % sc.major === 0);
  const v = k * sc.minor;
  const kgField = v >= 1000;
  const majorText = `${Math.floor(v / sc.major) * sc.major}g`;
  if (alt)
    return {
      engine: 'measure',
      id: `scale-alt:${sc.max}:${v}`,
      objective: 'scale',
      level,
      prompt: `はかりの はりを ${v >= 1000 ? `${Math.floor(v / 1000)}kg${v % 1000 === 0 ? '' : `${v % 1000}g`}` : `${v}g`}に あわせよう。`,
      hints: [
        `いちばん 小《ちい》さい 1めもりは ${sc.minor}g だよ。`,
        `${majorText}の めもりを さがそう。`,
        `${majorText}から ${sc.minor}gずつ すすめよう。`,
      ],
      explain: `1めもりは ${sc.minor}g。${majorText}から ${(v % sc.major) / sc.minor}めもりで ${v}gです。`,
      identity: `set:${sc.max}:${v}`,
      alt: true,
      instrument: 'scale',
      scale: { ...sc },
      task: 'set',
      value: v,
      misconceptions: { minorAsOne: 'minor-as-one' },
    };
  return {
    engine: 'measure',
    id: `scale:${sc.max}:${v}`,
    objective: 'scale',
    level,
    prompt: kgField
      ? 'はりは 何《なん》kg何《なん》gを さして いますか。'
      : 'はりは 何《なん》gを さして いますか。',
    hints: [
      `この はかりは ${sc.max >= 1000 ? `${sc.max / 1000}kg` : `${sc.max}g`}まで はかれるよ。いちばん 小《ちい》さい 1めもりは いくつかな。`,
      `1めもりは ${sc.minor}g。`,
      `${majorText}から 小《ちい》さい めもり いくつ分《ぶん》かな。`,
    ],
    explain: `1めもりは ${sc.minor}g。${majorText}から ${(v % sc.major) / sc.minor}めもりで ${v}g${kgField ? ` ＝ ${Math.floor(v / 1000)}kg${v % 1000}g` : ''}です。`,
    identity: `scale:${sc.max}:${v}`,
    alt: false,
    instrument: 'scale',
    scale: { ...sc },
    task: 'read',
    value: v,
    fields: kgField
      ? [
          { unit: 'kg', factor: 1000 },
          { unit: 'g', factor: 1 },
        ]
      : [{ unit: 'g', factor: 1 }],
    misconceptions: { minorAsOne: 'minor-as-one', fieldSwap: 'field-swap' },
    wrongAnswers:
      Math.floor(v / sc.major) * sc.major + (v % sc.major) / sc.minor !== v
        ? [
            {
              value: Math.floor(v / sc.major) * sc.major + (v % sc.major) / sc.minor,
              misconception: 'minor-as-one',
            },
          ]
        : [],
  };
}

function convert(level: number, rng: Rng, alt: boolean): NumberItem {
  if (alt) {
    // t と kg
    const t = rng.int(1, 9);
    const toKg = rng.next() < 0.5;
    return toKg
      ? {
          engine: 'number',
          id: `convert-alt:t-kg:${t}`,
          objective: 'convert',
          level,
          prompt: `トラックに ${t}tの 荷物《にもつ》を のせます。これは 何《なん》kgですか。`,
          hints: [
            'とても 重《おも》い ものは t（トン）で あらわすよ。',
            '1t ＝ 1000kg。',
            `${t}tは 1000kgの ${t}こ分《ぶん》。`,
          ],
          explain: `1t ＝ 1000kg なので ${t}t ＝ ${t * 1000}kgです。`,
          identity: `t-kg:${t}`,
          alt: true,
          fields: [{ label: 'kg', answer: { kind: 'int', value: t * 1000 } }],
          wrongAnswers: wrongList(String(t * 1000), 1, [[t * 100, 'kg-as-100']]),
        }
      : {
          engine: 'number',
          id: `convert-alt:kg-t:${t}`,
          objective: 'convert',
          level,
          prompt: `${t * 1000}kgは 何《なん》tですか。`,
          hints: [
            '1t ＝ 1000kg。',
            `${t * 1000}kgの 中《なか》に 1000kgは いくつ？`,
            `1000kgが ${t}こ。`,
          ],
          explain: `1000kg ＝ 1t なので ${t * 1000}kg ＝ ${t}tです。`,
          identity: `kg-t:${t}`,
          alt: true,
          fields: [{ label: 't', answer: { kind: 'int', value: t } }],
          wrongAnswers: wrongList(String(t), 1, [[t * 10, 'kg-as-100']]),
        };
  }
  const k = rng.int(1, 9);
  const g = pickOne(rng, [rng.int(1, 9) * 100, rng.int(1, 9) * 10, rng.int(1, 999)]);
  const total = k * 1000 + g;
  return rng.next() < 0.5
    ? {
        engine: 'number',
        id: `convert:kg-g:${k}:${g}`,
        objective: 'convert',
        level,
        prompt: '□に あてはまる 数《かず》は？',
        figure: { kind: 'text', text: `${k}kg${g}g ＝ {{}}g`, size: 'xl' },
        hints: [
          '1kgは 1000g だよ。',
          `${k}kgは ${k * 1000}g。`,
          `${k * 1000}gと ${g}gを あわせよう。`,
        ],
        explain: `1kg ＝ 1000g なので ${k}kg ＝ ${k * 1000}g。${k * 1000} ＋ ${g} ＝ ${total}で ${total}gです。`,
        identity: `kg-g:${k}:${g}`,
        alt: false,
        fields: [{ label: 'g', answer: { kind: 'int', value: total } }],
        wrongAnswers: wrongList(String(total), 1, [
          [`${k}${g}`, 'unit-place'],
          [k * 100 + g, 'kg-as-100'],
        ]),
      }
    : {
        engine: 'number',
        id: `convert:g-kg:${total}`,
        objective: 'convert',
        level,
        prompt: '□に あてはまる 数《かず》は？',
        figure: { kind: 'text', text: `${total}g ＝ {{}}kg{{}}g`, size: 'xl' },
        hints: [
          '1000gで 1kg だよ。',
          `${total}gの 中《なか》に 1000gは いくつ あるかな。`,
          `${k * 1000}gで ${k}kg。のこりは？`,
        ],
        explain: `${total}g ＝ ${k * 1000}g ＋ ${g}g ＝ ${k}kg${g}gです。`,
        identity: `g-kg:${total}`,
        alt: false,
        fields: [
          { label: 'kg', answer: { kind: 'int', value: k } },
          { label: 'g', answer: { kind: 'int', value: g } },
        ],
        wrongAnswers: wrongList(`${k}|${g}`, 2, [
          [`${Math.floor(total / 100)}|${total % 100}`, 'kg-as-100'],
          [`${g}|${k}`, 'field-swap'],
        ]),
      };
}

interface Scene {
  id: string;
  op: '＋' | '−';
  text: (a: string, b: string) => string;
}
const SCENES: Scene[] = [
  {
    id: 'basket',
    op: '＋',
    text: (a, b) =>
      `${a}の かごに ${b}の みかんを 入《い》れました。全体《ぜんたい》の 重《おも》さは 何《なん》kg何《なん》gですか。`,
  },
  {
    id: 'bag',
    op: '＋',
    text: (a, b) =>
      `${a}の ランドセルに ${b}の 本《ほん》を 入《い》れました。重《おも》さは 何《なん》kg何《なん》gに なりますか。`,
  },
  {
    id: 'cat',
    op: '−',
    text: (a, b) =>
      `ねこを だいて 体重計《たいじゅうけい》に のると ${a}、ひとりで のると ${b}でした。ねこの 重《おも》さは 何《なん》kg何《なん》gですか。`,
  },
  {
    id: 'flour',
    op: '−',
    text: (a, b) =>
      `${a}の こむぎこから ${b} 使《つか》いました。のこりは 何《なん》kg何《なん》gですか。`,
  },
];
const kgg = (v: number) =>
  v >= 1000 ? `${Math.floor(v / 1000)}kg${v % 1000 === 0 ? '' : `${v % 1000}g`}` : `${v}g`;

function calc(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pickOne(rng, SCENES);
  let a: number;
  let b: number;
  let ans: number;
  for (;;) {
    a = rng.int(2, 60) * 50;
    b = rng.int(2, 60) * 50;
    if (sc.op === '＋') {
      ans = a + b;
      if (ans >= 1000 && ans < 10000 && ans % 1000 !== 0) break;
    } else {
      if (sc.id === 'cat') {
        a = rng.int(20, 40) * 1000 + rng.int(0, 19) * 50;
        b = a - rng.int(4, 12) * 500 - rng.int(1, 9) * 10;
      }
      ans = a - b;
      if (ans >= 1000 && ans % 1000 !== 0 && b > 0) break;
    }
  }
  // 体重は kg と g（大きい数）なので、文では kg・g で書く
  const text = sc.text(kgg(a), kgg(b));
  const K = Math.floor(ans / 1000);
  const G = ans % 1000;
  const noCarry =
    sc.op === '＋'
      ? Math.floor(a / 1000) + Math.floor(b / 1000)
      : Math.floor(a / 1000) - Math.floor(b / 1000);
  return {
    engine: 'number',
    id: `calc${alt ? '-alt' : ''}:${sc.id}:${a}${sc.op}${b}`,
    objective: 'calc',
    level,
    prompt: alt ? `${text}\n（gに なおして 計算《けいさん》して みよう）` : text,
    figure: alt ? { kind: 'text', text: `${a}g ${sc.op} ${b}g ＝ □g`, size: 'l' } : undefined,
    hints: [
      'kgと gを べつべつに 計算《けいさん》するか、全部《ぜんぶ》 gに なおそう。',
      `${kgg(a)} ＝ ${a}g、${kgg(b)} ＝ ${b}g。`,
      `${a} ${sc.op} ${b} を 計算《けいさん》して、1000gを 1kgに なおそう。`,
    ],
    explain: `${a}g ${sc.op} ${b}g ＝ ${ans}g ＝ ${K}kg${G}gです。`,
    identity: `${sc.id}:${a}${sc.op}${b}`,
    alt,
    fields: [
      { label: 'kg', answer: { kind: 'int', value: K } },
      { label: 'g', answer: { kind: 'int', value: G } },
    ],
    wrongAnswers: wrongList(`${K}|${G}`, 2, [
      [`${Math.floor(ans / 100)}|${ans % 100}`, 'kg-as-100'],
      [
        noCarry !== K && noCarry >= 0
          ? `${noCarry}|${sc.op === '＋' ? (a % 1000) + (b % 1000) : Math.abs((a % 1000) - (b % 1000))}`
          : null,
        'g-carry',
      ],
    ]),
  };
}

const UNIT_ITEMS: { id: string; text: string; n: number; u: 'g' | 'kg' | 't' }[] = [
  { id: 'apple', text: 'りんご 1この 重《おも》さ', n: 300, u: 'g' },
  { id: 'randoseru', text: 'からの ランドセルの 重《おも》さ', n: 1, u: 'kg' },
  { id: 'truck', text: '大《おお》きな トラックの 重《おも》さ', n: 8, u: 't' },
  { id: 'coin', text: '1円玉《いちえんだま》 1まいの 重《おも》さ', n: 1, u: 'g' },
  { id: 'child', text: '3年生《ねんせい》の 子《こ》どもの 体重《たいじゅう》', n: 28, u: 'kg' },
  { id: 'elephant', text: 'ぞうの 体重《たいじゅう》', n: 5, u: 't' },
  { id: 'egg', text: 'たまご 1この 重《おも》さ', n: 60, u: 'g' },
  { id: 'rice', text: 'お米《こめ》 1ふくろの 重《おも》さ', n: 5, u: 'kg' },
  { id: 'pencil', text: 'えんぴつ 1本《ぽん》の 重《おも》さ', n: 5, u: 'g' },
  { id: 'watermelon', text: 'すいか 1この 重《おも》さ', n: 4, u: 'kg' },
  { id: 'bus', text: 'バスの 重《おも》さ', n: 10, u: 't' },
  { id: 'book', text: '教科書《きょうかしょ》 1さつの 重《おも》さ', n: 400, u: 'g' },
  { id: 'dog', text: '大《おお》きな 犬《いぬ》の 体重《たいじゅう》', n: 30, u: 'kg' },
  { id: 'whale', text: 'くじらの 体重《たいじゅう》', n: 50, u: 't' },
  { id: 'eraser', text: 'けしゴム 1この 重《おも》さ', n: 15, u: 'g' },
  { id: 'chair', text: '教室《きょうしつ》の いす 1きゃくの 重《おも》さ', n: 5, u: 'kg' },
];
const FACTS = [
  { id: 'kg', q: '1kgは 何《なん》gですか。', a: 1000, w: 100 },
  { id: 't', q: '1tは 何《なん》kgですか。', a: 1000, w: 100 },
  { id: '2kg', q: '2kgは 何《なん》gですか。', a: 2000, w: 200 },
  { id: '3t', q: '3tは 何《なん》kgですか。', a: 3000, w: 300 },
  { id: 'half', q: '1kgの 半分《はんぶん》は 何《なん》gですか。', a: 500, w: 50 },
] as const;

function unitItem(level: number, rng: Rng, alt: boolean): ChoiceItem | NumberItem {
  if (alt) {
    const f = pickOne(rng, FACTS);
    return {
      engine: 'number',
      id: `unit-alt:${f.id}`,
      objective: 'unit',
      level,
      prompt: f.q,
      hints: [
        '重《おも》さの たんいの かんけいを 思《おも》い出《だ》そう。',
        '1kg ＝ 1000g、1t ＝ 1000kg。',
        'kg の k は「1000」の いみだよ。',
      ],
      explain: `1kg ＝ 1000g、1t ＝ 1000kg。答《こた》えは ${f.a}です。`,
      identity: `fact:${f.id}`,
      alt: true,
      fields: [{ answer: { kind: 'int', value: f.a } }],
      wrongAnswers: wrongList(String(f.a), 1, [[f.w, 'kg-as-100']]),
    };
  }
  const it = pickOne(rng, UNIT_ITEMS);
  return {
    engine: 'choice',
    id: `unit:${it.id}`,
    objective: 'unit',
    level,
    prompt: `${it.text}は およそ ${it.n} □です。□に あてはまる たんいは どれ？`,
    hints: [
      '1g・1kg・1tの 重《おも》さを 思《おも》いうかべよう。',
      '1円玉《いちえんだま》 1まいが 1g、1Lの 水《みず》が 1kg、1tは 1000kg。',
      `${it.n}を それぞれの たんいで 思《おも》いうかべて みよう。`,
    ],
    explain: `${it.text}は およそ ${it.n}${it.u}です。`,
    identity: `unit:${it.id}`,
    alt: false,
    fixedOrder: true,
    options: (['g', 'kg', 't'] as const).map((u) =>
      u === it.u ? { label: u, correct: true } : { label: u, misconception: 'unit-sense' },
    ),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['scale', 'unit', 'convert'] },
  { objs: ['scale', 'convert', 'unit'] },
  { objs: ['convert', 'calc', 'scale'] },
  { objs: ['scale', 'convert', 'calc', 'unit'] },
];

export function generateWeight(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.25;
  switch (obj) {
    case 'scale':
      return scaleItem(level, rng, alt);
    case 'convert':
      return convert(level, rng, alt);
    case 'calc':
      return calc(level, rng, alt);
    case 'unit':
      return unitItem(level, rng, alt);
  }
}

export const weight: UnitSpec = {
  id: 'g3.math.weight',
  title: '重《おも》さ',
  stage: 'g3',
  subject: 'math',
  domain: 'C-measure',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-compare',
  prereq: ['g3.math.length-km'],
  objectives: [
    { id: 'scale', title: 'はかりの めもり' },
    { id: 'convert', title: 'kgと g、tと kg' },
    { id: 'calc', title: '重《おも》さの 計算《けいさん》' },
    { id: 'unit', title: '重《おも》さの たんいを えらぶ' },
  ],
  misconceptions: [
    {
      id: 'minor-as-one',
      explain:
        '1めもりを 1gと 数《かぞ》えたのかな。はかりに よって 1めもりは 5g・10g・20gなど ちがうよ。数字《すうじ》の ある めもりの あいだを いくつに 分《わ》けて いるか 見《み》よう。',
      figure: { kind: 'text', text: '100gを 20めもり → 1めもり 5g', size: 'l' },
    },
    {
      id: 'field-swap',
      explain:
        'kgと gの 数《かず》を 入《い》れかえたのかな。左《ひだり》が kg、右《みぎ》が gだよ。',
    },
    {
      id: 'unit-place',
      explain:
        'kgと gの 数《かず》を ならべて 書《か》いたのかな。1kg ＝ 1000g。1kg30g は 1030g だよ。',
    },
    {
      id: 'kg-as-100',
      explain: '1kgを 100gと 考《かんが》えたのかな。1kg ＝ 1000g、1t ＝ 1000kg だよ。',
    },
    {
      id: 'g-carry',
      explain:
        'gが 1000を こえたのに kgに くり上《あ》げなかったのかな（ひき算《ざん》なら kgから かりなかったのかな）。1000g ＝ 1kg だよ。',
    },
    {
      id: 'unit-sense',
      explain:
        'その たんいだと 重《おも》すぎるか 軽《かる》すぎるかな。1円玉《いちえんだま》が 1g、1Lの 水《みず》が 1kg、1tは 1000kgだよ。',
    },
  ],
  levels: [
    { label: 'はかり・たんい', chance: 0.05 },
    { label: 'kgと g', chance: 0.05 },
    { label: '重さの 計算', chance: 0.05 },
    { label: 'まとめ', chance: 0.05 },
  ],
  intro: [
    {
      text: '重《おも》さは グラム（g）や キログラム（kg）で あらわします。1kg ＝ 1000g。1円玉《いちえんだま》 1まいが 1gです。',
      figure: { kind: 'text', text: '1kg ＝ 1000g', size: 'xl' },
    },
    {
      text: 'はかりは、はじめに いちばん 小《ちい》さい 1めもりの 重《おも》さを たしかめてから 読《よ》みます。',
      figure: { kind: 'text', text: '100gを 20に 分《わ》けて いれば 1めもり 5g', size: 'l' },
    },
    {
      text: 'トラックのように とても 重《おも》い ものは トン（t）で あらわします。1t ＝ 1000kg。',
      figure: { kind: 'text', text: '1t ＝ 1000kg', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateWeight(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第3学年 C(1) 重さの単位（g、kg）と測定。内容の取扱いで t に触れる',
  revised: '2026-10-24',
};
