/**
 * g2.math.numbers-10000 1万までの数（4位数）、数の相対的な大きさ（curriculum-matrix 3.5）。
 * 1000の束 →「100が24こで□」→ 数直線（1目盛り 10・100）。
 *
 * 同一性キー: 問う形 × 数（例 'kurai4:3045'）。比べる問題は2つの数の組（順序は問わない）。
 * 定義域: 1000〜9999（と 10000）。到達項目ごとに数百通りあり、定義域から均等に選ぶ。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { NumberlineItem } from '../../engines/numberline/numberline';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { kanaNumber, pickObj, wrongList } from './util';

type Obj = 'kurai4' | 'hyaku' | 'line4' | 'compare4' | 'around';

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['kurai4', 'hyaku', 'around'] },
  { objs: ['kurai4', 'hyaku', 'line4', 'compare4', 'around'] },
  { objs: ['line4', 'compare4', 'hyaku', 'around'] },
];

const d4 = (n: number) =>
  [Math.floor(n / 1000), Math.floor(n / 100) % 10, Math.floor(n / 10) % 10, n % 10] as const;

const table4 = (n: number): Figure => {
  const [a, b, c, d] = d4(n);
  return {
    kind: 'table',
    header: ['せんの くらい', 'ひゃくの くらい', 'じゅうの くらい', 'いちの くらい'],
    rows: [[String(a), String(b), String(c), String(d)]],
  };
};

/** 位の数から4けたの数を作る */
function kurai4(level: number, rng: Rng, alt: boolean): NumberItem {
  // 0 を含む数を半分（0の位の書き方が学習内容）
  let n: number;
  if (rng.next() < 0.5) n = rng.int(1000, 9999);
  else {
    do n = rng.int(1000, 9999);
    while (!String(n).includes('0'));
  }
  const [a, b, c, d] = d4(n);
  const noZero = Number(`${a}${b || ''}${c || ''}${d || ''}`);
  return {
    engine: 'number',
    id: `kurai4${alt ? '-alt' : ''}:${n}`,
    objective: 'kurai4',
    level,
    prompt: alt
      ? 'くらいの ひょうの かずを すうじで かこう。'
      : `1000を ${a}こ、100を ${b}こ、10を ${c}こ、1を ${d}こ あわせた かずは？`,
    figure: alt ? table4(n) : undefined,
    hints: [
      'せん・ひゃく・じゅう・いち の くらいに わけて かんがえよう。',
      `せんの くらいは ${a}、ひゃくの くらいは ${b}。`,
      b === 0 || c === 0 || d === 0
        ? `0この くらいにも 0を かくよ。${a}、${b}、${c}、…`
        : `${a}、${b}、${c} と ならべて、いちの くらいは？`,
    ],
    explain: `${a * 1000}と ${b * 100}と ${c * 10}と ${d}で ${n}（${kanaNumber(n)}）です。`,
    explainFigure: table4(n),
    identity: `kurai4:${n}`,
    alt,
    fields: [{ answer: { kind: 'int', value: n } }],
    wrongAnswers: wrongList(String(n), 1, [
      [b === 0 || c === 0 || d === 0 ? noZero : null, 'zero-place'],
      [`${a}000${b}00${c}0${d}`, 'expanded'],
      [Number(`${d}${c}${b}${a}`), 'place-swap'],
    ]),
  };
}

/** 100を いくつ あつめた数（相対的な大きさ） */
function hyaku(level: number, rng: Rng, alt: boolean): NumberItem {
  const unit = rng.next() < 0.75 ? 100 : 1000;
  const k = unit === 100 ? rng.int(11, 99) : rng.int(2, 10);
  const n = k * unit;
  const hint2 =
    unit === 100
      ? `100が 10こで 1000。${k}こは 10こが ${Math.floor(k / 10)}つと ${k % 10}こ。`
      : `1000が 10こで 10000（いちまん）。`;
  return {
    engine: 'number',
    id: `hyaku${alt ? '-alt' : ''}:${unit}:${k}`,
    objective: 'hyaku',
    level,
    prompt: alt ? `${n}は ${unit}を なんこ あつめた かず？` : `${unit}を ${k}こ あつめた かずは？`,
    figure: { kind: 'text', text: alt ? `${n} ＝ ${unit}が □こ` : `${unit}が ${k}こ`, size: 'l' },
    hints: [
      unit === 100 ? '100が 10こで 1000 だね。' : '1000が いくつ あるか かんがえよう。',
      hint2,
      unit === 100
        ? `1000が ${Math.floor(k / 10)}こで ${Math.floor(k / 10) * 1000}。そこに 100が ${k % 10}こ…`
        : `1000が ${k}こ…`,
    ],
    explain: alt
      ? `${n}は ${unit}を ${k}こ あつめた かずです。`
      : `${unit}を ${k}こ あつめると ${n}${n === 10000 ? '（いちまん）' : ''}です。`,
    identity: `hyaku:${unit}:${k}`,
    alt,
    fields: [{ answer: { kind: 'int', value: alt ? k : n } }],
    wrongAnswers: alt
      ? wrongList(String(k), 1, [
          [n, 'ten-count'],
          [unit === 100 ? k % 10 : null, 'ten-count'],
          [n / 10, 'extra-zero'],
        ])
      : wrongList(String(n), 1, [
          [k, 'ten-count'],
          [n * 10, 'extra-zero'],
          [n / 10, 'extra-zero'],
        ]),
  };
}

/** 1000より 1 ちいさい・ある数より 10・100 おおきい など */
function around(level: number, rng: Rng, alt: boolean): NumberItem {
  const step = pickStep(rng);
  const up = rng.next() < 0.5;
  let n: number;
  do n = rng.int(1000, 9990);
  while (n - step < 1000 || n + step > 10000);
  const ans = up ? n + step : n - step;
  const word = up ? 'おおきい' : 'ちいさい';
  return {
    engine: 'number',
    id: `around${alt ? '-alt' : ''}:${n}${up ? '+' : '-'}${step}`,
    objective: 'around',
    level,
    prompt: alt
      ? `すうちょくせんで かんがえよう。${n}から ${up ? 'みぎ' : 'ひだり'}へ ${step} すすんだ かずは？`
      : `${n}より ${step} ${word} かずは？`,
    figure: alt
      ? {
          kind: 'numberline',
          min: Math.floor(Math.min(n, ans) / 1000) * 1000,
          max: Math.floor(Math.min(n, ans) / 1000) * 1000 + 2000,
          step: 1000,
          minorStep: 100,
          marks: [{ at: n, tone: 'focus' }],
        }
      : undefined,
    hints: [
      `${step === 1 ? 'いち' : step === 10 ? 'じゅう' : step === 100 ? 'ひゃく' : 'せん'}の くらいに ちゅうもく しよう。`,
      up
        ? `${step}を たすと、くらいが くりあがる ことも あるよ。`
        : `${step}を ひくと、となりの くらいから かりる ことも あるよ。`,
      `${n} ${up ? '＋' : '−'} ${step} を かんがえよう。`,
    ],
    explain: `${n}より ${step} ${word} かずは ${ans}です。`,
    identity: `around:${n}${up ? '+' : '-'}${step}`,
    alt,
    fields: [{ answer: { kind: 'int', value: ans } }],
    wrongAnswers: wrongList(String(ans), 1, [
      [up ? n - step : n + step, 'direction'],
      [step === 1 && up && n % 10 === 9 ? n - 9 : null, 'no-carry-place'],
      [step === 1 && !up && n % 10 === 0 ? n + 9 : null, 'no-carry-place'],
      [step === 10 && up && Math.floor(n / 10) % 10 === 9 ? n - 90 : null, 'no-carry-place'],
      [step === 10 && !up && Math.floor(n / 10) % 10 === 0 ? n + 90 : null, 'no-carry-place'],
      [step === 100 && up && Math.floor(n / 100) % 10 === 9 ? n - 900 : null, 'no-carry-place'],
      [step === 100 && !up && Math.floor(n / 100) % 10 === 0 ? n + 900 : null, 'no-carry-place'],
    ]),
  };
}

function pickStep(rng: Rng): number {
  return [1, 10, 100, 1000][rng.int(0, 3)]!;
}

/** 数直線（1目盛り 10・100） */
function line4(level: number, rng: Rng, alt: boolean): NumberlineItem {
  const minor = rng.next() < 0.5 ? 100 : 10;
  let min: number;
  let at: number;
  if (minor === 100) {
    min = 0;
    do at = rng.int(1, 99) * 100;
    while (at % 1000 === 0);
  } else {
    min = rng.int(1, 9) * 1000;
    do at = min + rng.int(1, 99) * 10;
    while (at % 100 === 0);
  }
  const max = min + minor * 100;
  const near = Math.floor(at / (minor * 10)) * minor * 10;
  const hints = [
    `いちばん ちいさい 1めもりは ${minor} だよ。`,
    `${near}の ながい めもりを みつけよう。`,
    `${near}から ${minor}ずつ かぞえよう。${near + minor}、${near + 2 * minor}、…`,
  ];
  const base = {
    engine: 'numberline' as const,
    objective: 'line4',
    level,
    line: { min, max, minor, midEvery: 5, majorEvery: 10 },
    identity: `line4:${minor}:${at}`,
    alt,
    hints,
    explain: `1めもりは ${minor}。${near}から ${(at - near) / minor}めもりで ${at} です。`,
    misconceptions: { minorAsOne: 'count-tick', neighborTick: 'count-tick' },
  };
  if (alt)
    return {
      ...base,
      id: `line4-alt:${minor}:${at}`,
      prompt: `${at}の めもりを タップしよう。`,
      task: { kind: 'place', target: at },
    };
  return {
    ...base,
    id: `line4:${minor}:${at}`,
    prompt: '↓の ところの かずは いくつ？',
    task: { kind: 'read', at },
  };
}

/** 大小 */
function compare4(level: number, rng: Rng, alt: boolean): ChoiceItem {
  const a = rng.int(1000, 9999);
  let b: number;
  const mode = rng.int(0, 2);
  do {
    if (mode === 0) b = rng.int(1000, 9999);
    else if (mode === 1) b = Math.floor(a / 1000) * 1000 + rng.int(0, 999);
    else b = Math.floor(a / 100) * 100 + rng.int(0, 99);
  } while (b === a || b < 1000);
  const big = a > b;
  const da = d4(a);
  const db = d4(b);
  const pi = da.findIndex((x, i) => x !== db[i]);
  const placeName = ['せん', 'ひゃく', 'じゅう', 'いち'][pi]!;
  const onesFirst = da[3] !== db[3] && da[3] > db[3] !== big;
  if (alt) {
    // 数直線の上の2つの数: どちらが右（大きい）か
    return {
      engine: 'choice',
      id: `compare4-alt:${a}-${b}`,
      objective: 'compare4',
      level,
      prompt: `すうちょくせんで ${a}と ${b}を くらべると、みぎに あるのは どっち？`,
      hints: [
        'すうちょくせんは みぎに いくほど おおきく なるよ。',
        'せんの くらいから じゅんに くらべよう。',
        `${placeName}の くらいの すうじを くらべよう。`,
      ],
      explain: `${Math.max(a, b)}の ほうが おおきいので、みぎに あります。`,
      identity: `compare4-nl:${Math.min(a, b)}-${Math.max(a, b)}`,
      alt: true,
      options: [
        { label: String(Math.max(a, b)), correct: true },
        {
          label: String(Math.min(a, b)),
          misconception: onesFirst ? 'compare-ones' : 'compare-sign',
        },
      ],
    };
  }
  return {
    engine: 'choice',
    id: `compare4:${a}-${b}`,
    objective: 'compare4',
    level,
    prompt: '□に あう しるしは どっち？',
    figure: { kind: 'text', text: `${a} □ ${b}`, size: 'xl' },
    hints: [
      'せんの くらいから じゅんに くらべよう。',
      pi === 0
        ? `せんの くらいは ${da[0]}と ${db[0]}。`
        : `${['せん', 'ひゃく', 'じゅう'].slice(0, pi).join('・')}の くらいは おなじ。`,
      `${placeName}の くらいの すうじが おおきい ほうが おおきい かず。`,
    ],
    explain: `${placeName}の くらいで くらべて、${a} ${big ? '＞' : '＜'} ${b} です。`,
    identity: `compare4:${Math.min(a, b)}-${Math.max(a, b)}`,
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

export function generateNumbers10000(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'kurai4':
      return kurai4(level, rng, alt);
    case 'hyaku':
      return hyaku(level, rng, alt);
    case 'around':
      return around(level, rng, alt);
    case 'line4':
      return line4(level, rng, alt);
    case 'compare4':
      return compare4(level, rng, alt);
  }
}

export const numbers10000: UnitSpec = {
  id: 'g2.math.numbers-10000',
  title: '1万《まん》までの かず',
  stage: 'g2',
  subject: 'math',
  domain: 'A-number',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-math',
  prereq: ['g2.math.numbers-1000'],
  objectives: [
    { id: 'kurai4', title: '4けたの かずを かく' },
    { id: 'hyaku', title: '100や 1000の いくつぶん' },
    { id: 'around', title: '10・100・1000 おおきい・ちいさい かず' },
    { id: 'line4', title: 'すうちょくせん（1めもり 10・100）' },
    { id: 'compare4', title: 'おおきさを くらべる' },
  ],
  misconceptions: [
    {
      id: 'zero-place',
      explain: 'ない くらいを とばしたのかな。100が 0この ときも、ひゃくの くらいに 0を かくよ。',
    },
    {
      id: 'expanded',
      explain:
        '3000と 400と…を そのまま ならべたのかな。くらいの ところに すうじを 1つずつ かこう。',
    },
    {
      id: 'place-swap',
      explain:
        'くらいの じゅんが ぎゃくに なったのかな。ひだりから せん・ひゃく・じゅう・いち だよ。',
    },
    {
      id: 'ten-count',
      explain: '100の かずと ほんとうの おおきさを まぜたのかな。100が 10こで 1000 だよ。',
    },
    {
      id: 'extra-zero',
      explain: '0の かずが ちがったのかな。100が 24こは 2400。0は 2つ つくよ。',
    },
    {
      id: 'direction',
      explain:
        '「おおきい」と「ちいさい」を はんたいに したのかな。おおきい かずは たして もとめるよ。',
    },
    {
      id: 'no-carry-place',
      explain:
        'くりあがり（くりさがり）を わすれたのかな。9の つぎは となりの くらいが 1 ふえるよ。',
    },
    {
      id: 'count-tick',
      explain: 'めもりを 1ずつ かぞえたのかな。さいしょに 1めもりが いくつかを しらべよう。',
    },
    {
      id: 'compare-ones',
      explain: 'いちの くらいから くらべたのかな。いちばん おおきい くらいから くらべるよ。',
    },
    {
      id: 'compare-sign',
      explain: 'ちいさい ほうを えらんだのかな。せんの くらいから じゅんに くらべて みよう。',
    },
  ],
  levels: [
    { label: '4けたの かず', chance: 0.05 },
    { label: 'すうちょくせん・おおきさくらべ', chance: 0.05 },
    { label: 'まとめ', chance: 0.05 },
  ],
  intro: [
    {
      text: '1000の たばが 2つ、100の いたが 4まい、10の ぼうが 0、1の つぶが 5こ。',
      figure: table4(2405),
    },
    {
      text: 'くらいの ひょうに かいて ならべると 2405（にせんよんひゃくご）。',
      figure: { kind: 'text', text: '2405', size: 'xl' },
    },
    {
      text: '1000を 10こ あつめた かずを 10000（いちまん）と いいます。',
      figure: {
        kind: 'numberline',
        min: 0,
        max: 10000,
        step: 1000,
        labelEvery: 5000,
        marks: [{ at: 10000, tone: 'focus' }],
      },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateNumbers10000(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第2学年 A(1) 数の構成と表し方（4位数・1万まで、数の相対的な大きさ）',
  revised: '2026-10-24',
};
