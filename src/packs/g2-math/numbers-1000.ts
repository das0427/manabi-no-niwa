/**
 * g2.math.numbers-1000 1000までの数（3位数）、大小（curriculum-matrix 3.5）。
 * 100の束（ブロック）→ 位の表 → 数直線・大小。
 *
 * 同一性キー: 問う形 × 数（例 'kurai:305'）。比べる問題は2つの数の組（順序は問わない）。
 * 定義域: 100〜999（数直線は 1000 まで）。到達項目ごとに数百通りあり、生成は定義域から均等に選ぶ。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { NumberlineItem } from '../../engines/numberline/numberline';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { kanaNumber, pickObj, wrongList } from './util';

type Obj = 'kurai' | 'bunkai' | 'nanjuu' | 'line' | 'compare';

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['kurai', 'bunkai', 'nanjuu'] },
  { objs: ['kurai', 'bunkai', 'nanjuu', 'line', 'compare'] },
  { objs: ['line', 'compare', 'nanjuu', 'bunkai'] },
];

const digitsOf = (n: number) => [Math.floor(n / 100), Math.floor(n / 10) % 10, n % 10] as const;

const blocks = (n: number): Figure => {
  const [h, t, o] = digitsOf(n);
  return { kind: 'blocks', hundreds: h, tens: t, ones: o };
};

const placeTable = (n: number): Figure => {
  const [h, t, o] = digitsOf(n);
  return {
    kind: 'table',
    header: ['ひゃくの くらい', 'じゅうの くらい', 'いちの くらい'],
    rows: [[String(h), String(t), String(o)]],
  };
};

/** 位の数から数を作る（ゼロの位を含めて定義域から均等） */
function kurai(level: number, rng: Rng, alt: boolean): NumberItem {
  const n = rng.int(100, 999);
  const [h, t, o] = digitsOf(n);
  const noZero = Number(`${h}${t || ''}${o || ''}`);
  return {
    engine: 'number',
    id: `kurai${alt ? '-alt' : ''}:${n}`,
    objective: 'kurai',
    level,
    prompt: alt
      ? 'ブロックの かずを すうじで かこう。'
      : `100が ${h}こ、10が ${t}こ、1が ${o}こ。あわせた かずは？`,
    figure: alt ? blocks(n) : placeTable(n),
    hints: [
      alt
        ? '100の いた、10の ぼう、1の つぶを わけて かぞえよう。'
        : 'ひゃくの くらい、じゅうの くらい、いちの くらいに わけて かこう。',
      `ひゃくの くらいは ${h}だね。`,
      t === 0 || o === 0
        ? `ないところの くらいには 0を かくよ。${h}、${t}、…`
        : `${h}、${t}、と ならべて、いちの くらいは？`,
    ],
    explain: `100が ${h}こで ${h * 100}、10が ${t}こで ${t * 10}、1が ${o}こで ${o}。あわせて ${n}（${kanaNumber(n)}）です。`,
    explainFigure: placeTable(n),
    identity: `kurai:${n}`,
    alt,
    fields: [{ answer: { kind: 'int', value: n } }],
    wrongAnswers: wrongList(String(n), 1, [
      [t === 0 || o === 0 ? noZero : null, 'zero-place'],
      [Number(`${o}${t}${h}`), 'place-swap'],
      [h + t + o, 'digit-sum'],
      [`${h}00${t}0${o}`, 'expanded'],
    ]),
  };
}

/** 数を位に分ける（3つの欄） */
function bunkai(level: number, rng: Rng, alt: boolean): NumberItem {
  const n = rng.int(100, 999);
  const [h, t, o] = digitsOf(n);
  return {
    engine: 'number',
    id: `bunkai${alt ? '-alt' : ''}:${n}`,
    objective: 'bunkai',
    level,
    prompt: alt
      ? `${kanaNumber(n)} を ブロックで あらわすと、100の いた・10の ぼう・1の つぶは なんこずつ？`
      : `${n}は 100が なんこ、10が なんこ、1が なんこ？`,
    figure: alt ? undefined : { kind: 'text', text: String(n), size: 'xl' },
    fields: [
      { label: '100が', answer: { kind: 'int', value: h } },
      { label: '10が', answer: { kind: 'int', value: t } },
      { label: '1が', answer: { kind: 'int', value: o } },
    ],
    hints: [
      'ひだりから ひゃくの くらい、じゅうの くらい、いちの くらい だよ。',
      `ひゃくの くらいの すうじは ${h}。`,
      `じゅうの くらいの すうじは ${t}。いちの くらいは？`,
    ],
    explain: `${n}は 100が ${h}こ、10が ${t}こ、1が ${o}こ です。`,
    explainFigure: blocks(n),
    identity: `bunkai:${n}`,
    alt,
    wrongAnswers: wrongList(`${h}|${t}|${o}`, 3, [
      [`${o}|${t}|${h}`, 'place-swap'],
      [`${h}|${h * 10 + t}|${n}`, 'ten-count'],
    ]),
  };
}

/** 10が いくつ（相対的な大きさ） */
function nanjuu(level: number, rng: Rng, alt: boolean): NumberItem {
  // 10を k こ（k = 10〜99）。alt は逆向き（k*10 は 10を なんこ）
  const k = rng.int(10, 99);
  const n = k * 10;
  const tens = Math.floor(k / 10);
  const ones = k % 10;
  return {
    engine: 'number',
    id: `nanjuu${alt ? '-alt' : ''}:${k}`,
    objective: 'nanjuu',
    level,
    prompt: alt ? `${n}は 10を なんこ あつめた かず？` : `10を ${k}こ あつめた かずは？`,
    figure: { kind: 'text', text: alt ? `${n} ＝ 10 × □` : `10が ${k}こ`, size: 'l' },
    explainFigure: { kind: 'blocks', hundreds: tens, tens: ones, ones: 0 },
    hints: [
      '10が 10こで 100 だね。',
      alt
        ? `${n}は 100が ${Math.floor(n / 100)}こと、10が ${(n / 10) % 10}こ。`
        : `${k}こは 10こが ${tens}つと ${ones}こ。100が ${tens}こと 10が ${ones}こ。`,
      alt
        ? `100の なかには 10が 10こ。${Math.floor(n / 100)}こぶんで 10が ${Math.floor(n / 100) * 10}こ。あと…`
        : `100が ${tens}こで ${tens * 100}。そこに 10が ${ones}こ…`,
    ],
    explain: alt
      ? `${n}は 10を ${k}こ あつめた かずです。`
      : `10を ${k}こ あつめると ${n}です。（10が 10こで 100）`,
    identity: `nanjuu:${k}`,
    alt,
    fields: [{ answer: { kind: 'int', value: alt ? k : n } }],
    wrongAnswers: alt
      ? wrongList(String(k), 1, [
          [n, 'ten-count'],
          [(n / 10) % 10, 'ten-count'],
        ])
      : wrongList(String(n), 1, [
          [k, 'ten-count'],
          [k * 100, 'extra-zero'],
        ]),
  };
}

/** 数直線（1目盛り 10 か 1 か 100） */
function line(level: number, rng: Rng, alt: boolean): NumberlineItem {
  // 3種の目盛り: 0〜1000（1目盛り10）、百の区間（1目盛り1）、0〜1000（1目盛り100: 数を置く）
  const kind = rng.int(0, 1);
  let min: number;
  let max: number;
  let minor: number;
  let at: number;
  if (kind === 0) {
    min = 0;
    max = 1000;
    minor = 10;
    do at = rng.int(1, 99) * 10;
    while (at % 100 === 0);
  } else {
    min = rng.int(1, 8) * 100;
    max = min + 100;
    minor = 1;
    do at = min + rng.int(1, 99);
    while (at % 10 === 0);
  }
  const key = `line:${minor}:${at}`;
  const base = {
    engine: 'numberline' as const,
    objective: 'line',
    level,
    line: { min, max, minor, midEvery: 5, majorEvery: 10 },
    identity: key,
    alt,
    misconceptions: { minorAsOne: 'count-tick', neighborTick: 'count-tick' },
  };
  const near = Math.floor(at / (minor * 10)) * minor * 10;
  const hints = [
    `いちばん ちいさい 1めもりは ${minor} だよ。`,
    `${near}の ながい めもりを みつけよう。`,
    `${near}から ${minor}ずつ かぞえよう。${near + minor}、${near + 2 * minor}、…`,
  ];
  if (alt)
    return {
      ...base,
      id: `line-alt:${minor}:${at}`,
      prompt: `${at}の めもりを タップしよう。`,
      hints,
      explain: `1めもりは ${minor}。${near}から ${(at - near) / minor}めもりで ${at} です。`,
      task: { kind: 'place', target: at },
    };
  return {
    ...base,
    id: `line:${minor}:${at}`,
    prompt: '↓の ところの かずは いくつ？',
    hints,
    explain: `1めもりは ${minor}。${near}から ${(at - near) / minor}めもりで ${at} です。`,
    task: { kind: 'read', at },
  };
}

/** 大小（＞＜） */
function compare(level: number, rng: Rng, alt: boolean): ChoiceItem {
  // 同じ ひゃくの くらいで、じゅう・いちの くらいで決まる組を多めに（どの位で比べるかが学習内容）
  const a = rng.int(100, 999);
  let b: number;
  const mode = rng.int(0, 2);
  do {
    if (mode === 0) b = rng.int(100, 999);
    else if (mode === 1) b = Math.floor(a / 100) * 100 + rng.int(0, 99);
    else b = Math.floor(a / 10) * 10 + rng.int(0, 9);
  } while (b === a || b < 100);
  const [ah, at, ao] = digitsOf(a);
  const [bh, bt, bo] = digitsOf(b);
  const big = a > b;
  const diffPlace = ah !== bh ? 'ひゃく' : at !== bt ? 'じゅう' : 'いち';
  const key = `compare:${Math.min(a, b)}-${Math.max(a, b)}`;
  // 一の位で比べると逆になる組には誤概念を付ける
  const onesFirst = ao !== bo && ao > bo !== big;
  const hints = [
    'ひゃくの くらいから じゅんに くらべよう。',
    ah !== bh
      ? `ひゃくの くらいは ${ah}と ${bh}。`
      : at !== bt
        ? `ひゃくの くらいは どちらも ${ah}。じゅうの くらいは ${at}と ${bt}。`
        : `ひゃく・じゅうの くらいは おなじ。いちの くらいは ${ao}と ${bo}。`,
    `${diffPlace}の くらいの すうじが おおきい ほうが おおきい かず。`,
  ];
  if (alt) {
    // 3つの数から いちばん おおきい数を選ぶ
    let c: number;
    do c = Math.floor(a / 100) * 100 + rng.int(0, 99);
    while (c === a || c === b);
    const arr = [a, b, c];
    const mx = Math.max(...arr);
    return {
      engine: 'choice',
      id: `compare-alt:${[...arr].sort().join('-')}`,
      objective: 'compare',
      level,
      prompt: 'いちばん おおきい かずは どれ？',
      hints: [
        hints[0]!,
        'ひゃくの くらいが おなじなら、じゅうの くらいを くらべよう。',
        'じゅうの くらいも おなじなら、いちの くらいを くらべるよ。',
      ],
      explain: `${mx}が いちばん おおきい かずです。ひゃくの くらいから じゅんに くらべます。`,
      identity: `compare3:${[...arr].sort().join('-')}`,
      alt: true,
      options: arr.map((v) =>
        v === mx
          ? { label: String(v), correct: true }
          : { label: String(v), misconception: 'compare-ones' },
      ),
    };
  }
  return {
    engine: 'choice',
    id: `compare:${a}-${b}`,
    objective: 'compare',
    level,
    prompt: `□に あう しるしは どっち？`,
    figure: { kind: 'text', text: `${a} □ ${b}`, size: 'xl' },
    hints,
    explain: `${diffPlace}の くらいで くらべると ${big ? a : b}の ほうが おおきいので、${a} ${big ? '＞' : '＜'} ${b} です。`,
    identity: key,
    alt: false,
    fixedOrder: true,
    options: [
      big
        ? { label: '＞', correct: true }
        : { label: '＞', misconception: onesFirst ? 'compare-ones' : 'compare-sign' },
      big
        ? { label: '＜', misconception: onesFirst ? 'compare-ones' : 'compare-sign' }
        : { label: '＜', correct: true },
    ],
  };
}

export function generateNumbers1000(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'kurai':
      return kurai(level, rng, alt);
    case 'bunkai':
      return bunkai(level, rng, alt);
    case 'nanjuu':
      return nanjuu(level, rng, alt);
    case 'line':
      return line(level, rng, alt);
    case 'compare':
      return compare(level, rng, alt);
  }
}

export const numbers1000: UnitSpec = {
  id: 'g2.math.numbers-1000',
  title: '1000までの かず',
  stage: 'g2',
  subject: 'math',
  domain: 'A-number',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-math',
  prereq: ['g1.math.numbers-120'],
  objectives: [
    { id: 'kurai', title: 'くらいの かずから かずを つくる' },
    { id: 'bunkai', title: 'かずを くらいに わける' },
    { id: 'nanjuu', title: '10の いくつぶん' },
    { id: 'line', title: 'すうちょくせん' },
    { id: 'compare', title: 'おおきさを くらべる（＞・＜）' },
  ],
  misconceptions: [
    {
      id: 'zero-place',
      explain:
        'ない くらいを とばして かいたのかな。10が 0この ときも、じゅうの くらいに 0を かくよ。',
      figure: { kind: 'text', text: '305', size: 'xl' },
    },
    {
      id: 'place-swap',
      explain:
        'くらいの じゅんばんが いれかわったのかな。ひだりから ひゃく・じゅう・いち の じゅんだよ。',
    },
    {
      id: 'digit-sum',
      explain: 'すうじを たしあわせたのかな。100が 3こは 300。くらいごとに ならべて かこう。',
    },
    {
      id: 'expanded',
      explain:
        '300と 20と 5を そのまま ならべたのかな。くらいの ところに 1つずつ すうじを かくよ。',
    },
    {
      id: 'ten-count',
      explain: '10の かずと、ほんとうの おおきさを まぜたのかな。10が 10こで 100 だよ。',
    },
    {
      id: 'extra-zero',
      explain: '0を おおく つけたのかな。10が 23こは 230。10を 23かい たした おおきさ だよ。',
    },
    {
      id: 'count-tick',
      explain: 'めもりを 1ずつ かぞえたのかな。さいしょに、1めもりが いくつかを しらべよう。',
    },
    {
      id: 'compare-ones',
      explain:
        'いちの くらいから くらべたのかな。おおきい くらい（ひゃくの くらい）から くらべるよ。',
    },
    {
      id: 'compare-sign',
      explain: '＞と ＜の むきを まちがえたのかな。ひらいた ほうに おおきい かずが くるよ。',
    },
  ],
  levels: [
    { label: 'くらいと かず', chance: 0.05 },
    { label: 'すうちょくせん・おおきさくらべ', chance: 0.05 },
    { label: 'まとめ', chance: 0.05 },
  ],
  intro: [
    {
      text: '100の いたが 2まい、10の ぼうが 4ほん、1の つぶが 3こ あります。',
      figure: blocks(243),
    },
    {
      text: 'くらいの ひょうに かくと、ひゃくの くらいが 2、じゅうの くらいが 4、いちの くらいが 3。',
      figure: placeTable(243),
    },
    {
      text: 'ならべて 243（にひゃくよんじゅうさん）と よみます。10の ぼうが ない ときは 0を かきます（305）。',
      figure: { kind: 'text', text: '243　305', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateNumbers1000(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第2学年 A(1) 数の構成と表し方（1000までの数、十進位取り記数法、数の大小）',
  revised: '2026-10-24',
};
