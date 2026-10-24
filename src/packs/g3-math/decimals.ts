/**
 * g3.math.decimals 小数（第1位）と小数の加減（curriculum-matrix 3.6）。
 * 1dLを10等分（ます）→ 数直線 → 小数第1位の加減。
 *
 * 数は 10分の1 を単位とする整数（t）で持ち、答えは decimal（小数で答える。分数は「もう一度」: 2.4 の形式指定）。
 * 同一性キー: 問う形 × 数（たし算は交換を同じとみる）。別例（ます・文章題・置く）は同じ形のキーで alt。
 */
import type { Rng } from '../../core/util/rng';
import type { MeasureItem } from '../../engines/measure/measure';
import type { NumberlineItem } from '../../engines/numberline/numberline';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { pickObj, pickOne, tenths, wrongList } from './util';

type Obj = 'meaning' | 'line' | 'compare' | 'add' | 'sub';

const dec = (t: number) => ({ kind: 'decimal' as const, value: t / 10 });

function meaning(level: number, rng: Rng, alt: boolean): NumberItem | MeasureItem {
  if (alt) {
    let k: number;
    do k = rng.int(1, 39);
    while (k % 10 === 0);
    return {
      engine: 'measure',
      id: `meaning-alt:masu:${k}`,
      objective: 'meaning',
      level,
      prompt: '水《みず》の かさは 何《なん》Lですか。小数《しょうすう》で 答《こた》えよう。',
      hints: [
        '1Lますの めもりは、1Lを 10こに 分《わ》けて いるよ。',
        '1めもりは 1dL。1dLは 0.1L だよ。',
        `いっぱいの ますの 数《かず》と、のこりの めもりの 数《かず》を 見《み》よう。`,
      ],
      explain: `1dL ＝ 0.1L。${k}dLは 0.1Lが ${k}こで ${tenths(k)}Lです。`,
      identity: `masu:${k}`,
      alt: true,
      instrument: 'masu',
      scale: {
        unit: 'dL',
        min: 0,
        max: 10,
        minor: 1,
        mid: 5,
        major: 10,
        labelFactor: 10,
        labelUnit: 'L',
      },
      task: 'read',
      value: k,
      fields: [{ unit: 'L', factor: 10 }],
      keys: ['decimal'],
      wrongAnswers: [{ value: k * 10, misconception: 'tenth-count' }],
      misconceptions: { minorAsOne: 'tenth-count' },
    };
  }
  let k: number;
  do k = rng.int(1, 99);
  while (k % 10 === 0);
  const toDec = rng.next() < 0.5;
  return toDec
    ? {
        engine: 'number',
        id: `meaning:to:${k}`,
        objective: 'meaning',
        level,
        prompt: `0.1を ${k}こ あつめた 数《かず》は？`,
        hints: [
          '0.1を 10こ あつめると 1に なるよ。',
          `${k}こは、10こが ${Math.floor(k / 10)}つと ${k % 10}こ。`,
          `1が ${Math.floor(k / 10)}こと、0.1が ${k % 10}こ。`,
        ],
        explain: `0.1が 10こで 1。0.1が ${k}こで ${tenths(k)}です。`,
        identity: `to:${k}`,
        alt: false,
        keys: ['decimal'],
        fields: [{ answer: dec(k) }],
        wrongAnswers: wrongList(tenths(k), 1, [
          [k, 'tenth-count'],
          [k >= 10 ? `0.${k}` : null, 'tenth-count'],
        ]),
      }
    : {
        engine: 'number',
        id: `meaning:from:${k}`,
        objective: 'meaning',
        level,
        prompt: `${tenths(k)}は、0.1を 何《なん》こ あつめた 数《かず》ですか。`,
        hints: [
          '1は 0.1を 10こ あつめた 数《かず》だよ。',
          `${Math.floor(k / 10)}は 0.1が ${Math.floor(k / 10) * 10}こ。`,
          `それと 0.${k % 10}（0.1が ${k % 10}こ）を あわせよう。`,
        ],
        explain: `${Math.floor(k / 10)}は 0.1が ${Math.floor(k / 10) * 10}こ、0.${k % 10}は 0.1が ${k % 10}こ。あわせて ${k}こです。`,
        identity: `from:${k}`,
        alt: false,
        fields: [{ label: 'こ', answer: { kind: 'int', value: k } }],
        wrongAnswers: wrongList(String(k), 1, [
          [k % 10, 'tenth-count'],
          [Math.floor(k / 10) + (k % 10), 'tenth-count'],
        ]),
      };
}

function line(level: number, rng: Rng, alt: boolean): NumberlineItem {
  const max = pickOne(rng, [2, 3, 5] as const);
  let t: number;
  do t = rng.int(1, max * 10 - 1);
  while (t % 10 === 0);
  const v = t / 10;
  const base = {
    engine: 'numberline' as const,
    objective: 'line',
    level,
    line: { min: 0, max, minor: 0.1, midEvery: 5, majorEvery: 10 },
    misconceptions: { minorAsOne: 'minor-as-one', neighborTick: 'neighbor-tick' },
  };
  const hints = [
    '0と 1の あいだは いくつに 分《わ》けて あるかな。',
    '10こに 分《わ》けて いるので、1めもりは 0.1。',
    `${Math.floor(t / 10)}から 0.1が いくつ分《ぶん》 すすんだかな。`,
  ];
  const explain = `1めもりは 0.1。${Math.floor(t / 10)}から ${t % 10}めもりで ${tenths(t)}です。`;
  if (alt)
    return {
      ...base,
      id: `line-alt:${max}:${t}`,
      prompt: `${tenths(t)}の ところを タップしよう。`,
      hints,
      explain,
      identity: `line-place:${max}:${t}`,
      alt: true,
      task: { kind: 'place', target: v },
    };
  return {
    ...base,
    id: `line:${max}:${t}`,
    prompt: '↓の ところの 数《かず》を 小数《しょうすう》で 答《こた》えよう。',
    hints,
    explain,
    identity: `line:${max}:${t}`,
    alt: false,
    task: { kind: 'read', at: v, keys: ['decimal'] },
    wrongAnswers: [{ value: t, misconception: 'minor-as-one' }],
  };
}

function compare(level: number, rng: Rng, alt: boolean): ChoiceItem {
  if (alt) {
    let x: number;
    let y: number;
    do {
      x = rng.int(1, 59);
      y = rng.int(1, 59);
    } while (x === y || (x % 10 === 0 && y % 10 === 0));
    const big = x > y;
    // 小数第1位だけ見ると逆になるか
    const tenthBig = x % 10 > y % 10;
    const wrongMis = tenthBig !== big ? 'ignore-whole' : 'decimal-compare';
    return {
      engine: 'choice',
      id: `compare-alt:${x}:${y}`,
      objective: 'compare',
      level,
      prompt: `□に あてはまる しるしは どれ？\n${tenths(x)} □ ${tenths(y)}`,
      hints: [
        'まず 整数《せいすう》の ぶん（小数点《しょうすうてん》より 左《ひだり》）を くらべよう。',
        '整数《せいすう》の ぶんが おなじ ときは、小数点《しょうすうてん》の 右《みぎ》の 数字《すうじ》を くらべよう。',
        `0.1が いくつ分《ぶん》かで くらべると、${x}こと ${y}こ。`,
      ],
      explain: `0.1が ${x}こと ${y}こ なので、${tenths(x)} ${big ? '＞' : '＜'} ${tenths(y)} です。`,
      identity: `cmp:${Math.min(x, y)}:${Math.max(x, y)}`,
      alt: true,
      fixedOrder: true,
      options: [
        { label: '＞', ...(big ? { correct: true } : { misconception: wrongMis }) },
        { label: '＜', ...(big ? { misconception: wrongMis } : { correct: true }) },
        { label: '＝', misconception: 'decimal-compare' },
      ],
    };
  }
  const w = rng.int(1, 4);
  const t = rng.int(1, 8);
  const X = w * 10 + t;
  const Y = (w - 1) * 10 + 9;
  const V = t >= 2 ? w * 10 + t - 1 : w * 10;
  const U = rng.next() < 0.5 ? w * 10 - 10 + rng.int(1, 8) : rng.int(1, 9);
  const options = [
    { label: tenths(X), correct: true as const },
    { label: tenths(Y), misconception: 'ignore-whole' },
    { label: tenths(V), misconception: 'decimal-compare' },
    ...(U !== X && U !== Y && U !== V
      ? [{ label: tenths(U), misconception: 'decimal-compare' }]
      : []),
  ];
  return {
    engine: 'choice',
    id: `compare:${X}:${U}`,
    objective: 'compare',
    level,
    prompt: 'いちばん 大《おお》きい 数《かず》は どれ？',
    hints: [
      'まず 整数《せいすう》の ぶん（小数点《しょうすうてん》より 左《ひだり》）を くらべよう。',
      '整数《せいすう》の ぶんが おなじ ときは、小数点《しょうすうてん》の 右《みぎ》の 数字《すうじ》を くらべよう。',
      '数直線《すうちょくせん》で いちばん 右《みぎ》に ある 数《かず》は どれかな。',
    ],
    explain: `${tenths(X)}は 0.1が ${X}こ。いちばん 大《おお》きいのは ${tenths(X)}です。`,
    identity: `max:${X}:${U}`,
    alt: false,
    options,
  };
}

/** 小数の たし算・ひき算の 誤答 */
function addWrongs(a: number, b: number): [string | null, string][] {
  const s = a + b;
  const tsum = (a % 10) + (b % 10);
  const wsum = Math.floor(a / 10) + Math.floor(b / 10);
  return [
    [tsum >= 10 ? `${wsum}.${tsum}` : null, 'decimal-concat'],
    [tsum >= 10 ? tenths(s - 10) : null, 'carry-forget'],
    [a % 10 === 0 ? tenths(a / 10 + b) : b % 10 === 0 ? tenths(b / 10 + a) : null, 'align-right'],
  ];
}
function subWrongs(a: number, b: number): [string | null, string][] {
  const wd = Math.floor(a / 10) - Math.floor(b / 10);
  const td = Math.abs((a % 10) - (b % 10));
  return [
    [a % 10 < b % 10 ? tenths(wd * 10 + td) : null, 'small-from-big'],
    [a % 10 === 0 && a / 10 > b ? tenths(a / 10 - b) : null, 'align-right'],
    [tenths(a + b), 'wrong-op'],
  ];
}

function addSub(obj: 'add' | 'sub', level: number, rng: Rng, alt: boolean): NumberItem {
  let a: number;
  let b: number;
  for (;;) {
    a = rng.int(1, 99);
    b = rng.int(1, 99);
    if (a % 10 === 0 && b % 10 === 0) continue;
    if (obj === 'sub' && a <= b) continue;
    if (obj === 'add' && a + b > 150) continue;
    break;
  }
  if (obj === 'add' && rng.next() < 0.5) [a, b] = [b, a];
  const op = obj === 'add' ? '＋' : '−';
  const ans = obj === 'add' ? a + b : a - b;
  const key = obj === 'add' ? `${Math.min(a, b)}+${Math.max(a, b)}` : `${a}-${b}`;
  const scene =
    obj === 'add'
      ? `ジュースが ${tenths(a)}L、お茶《ちゃ》が ${tenths(b)}L あります。あわせて 何《なん》Lですか。`
      : `テープが ${tenths(a)}m あります。${tenths(b)}m 使《つか》うと、のこりは 何《なん》mですか。`;
  return {
    engine: 'number',
    id: `${obj}${alt ? '-alt' : ''}:${tenths(a)}${op}${tenths(b)}`,
    objective: obj,
    level,
    prompt: alt ? scene : '計算《けいさん》しよう。',
    figure: alt
      ? undefined
      : { kind: 'text', text: `${tenths(a)} ${op} ${tenths(b)} ＝ {{}}`, size: 'xl' },
    hints: [
      '0.1が いくつ分《ぶん》かで 考《かんが》えよう。',
      `${tenths(a)}は 0.1が ${a}こ、${tenths(b)}は 0.1が ${b}こ。`,
      `0.1が ${a} ${op} ${b} こ分《ぶん》。筆算《ひっさん》なら 小数点《しょうすうてん》を たてに そろえよう。`,
    ],
    explain: `0.1が ${a} ${op} ${b} ＝ ${ans}こで ${tenths(ans)}。${tenths(a)} ${op} ${tenths(b)} ＝ ${tenths(ans)}${alt ? (obj === 'add' ? 'L' : 'm') : ''}です。`,
    identity: key,
    alt,
    keys: ['decimal'],
    fields: [{ ...(alt ? { label: obj === 'add' ? 'L' : 'm' } : {}), answer: dec(ans) }],
    wrongAnswers: wrongList(tenths(ans), 1, obj === 'add' ? addWrongs(a, b) : subWrongs(a, b)),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['meaning', 'line'] },
  { objs: ['meaning', 'line', 'compare'] },
  { objs: ['add', 'sub', 'compare'] },
  { objs: ['add', 'sub', 'line', 'meaning'] },
];

export function generateDecimals(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.25;
  switch (obj) {
    case 'meaning':
      return meaning(level, rng, alt);
    case 'line':
      return line(level, rng, alt);
    case 'compare':
      return compare(level, rng, alt);
    case 'add':
    case 'sub':
      return addSub(obj, level, rng, alt);
  }
}

export const decimals: UnitSpec = {
  id: 'g3.math.decimals',
  title: '小数《しょうすう》',
  stage: 'g3',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-sansu',
  prereq: ['g2.math.volume'],
  objectives: [
    { id: 'meaning', title: '0.1の いくつ分《ぶん》（ます・はしたの 大《おお》きさ）' },
    { id: 'line', title: '数直線《すうちょくせん》の 小数《しょうすう》' },
    { id: 'compare', title: '小数《しょうすう》の 大《おお》きさくらべ' },
    { id: 'add', title: '小数《しょうすう》の たし算《ざん》' },
    { id: 'sub', title: '小数《しょうすう》の ひき算《ざん》' },
  ],
  misconceptions: [
    {
      id: 'tenth-count',
      explain:
        '0.1の 数《かず》と 小数《しょうすう》を とりちがえたのかな。0.1が 10こで 1。0.1が 13こなら 1.3だよ。',
      figure: { kind: 'text', text: '0.1 × 13こ ＝ 1.3', size: 'l' },
    },
    {
      id: 'minor-as-one',
      explain:
        '1めもりを 1と 数《かぞ》えたのかな。0と 1の あいだを 10に 分《わ》けて いるので、1めもりは 0.1だよ。',
    },
    {
      id: 'neighbor-tick',
      explain:
        'めもりを 1つ 数《かぞ》えまちがえたのかな。数字《すうじ》の ある めもりから 1つずつ 数《かぞ》えよう。',
    },
    {
      id: 'ignore-whole',
      explain:
        '小数点《しょうすうてん》の 右《みぎ》の 数字《すうじ》だけで くらべたのかな。まず 小数点《しょうすうてん》の 左《ひだり》（整数《せいすう》の ぶん）を くらべよう。',
    },
    {
      id: 'decimal-compare',
      explain:
        'くらべ方《かた》を まちがえたのかな。0.1が いくつ分《ぶん》かに なおすと、くらべやすいよ。',
    },
    {
      id: 'decimal-concat',
      explain:
        '小数点《しょうすうてん》の 右《みぎ》の 数字《すうじ》を たした 答《こた》えを そのまま 書《か》いたのかな。0.1が 10こで 1に なるので、1 くり上《あ》がるよ。',
      figure: { kind: 'text', text: '0.7 ＋ 0.5 ＝ 1.2（0.12 では ない）', size: 'l' },
    },
    {
      id: 'carry-forget',
      explain:
        'くり上《あ》がりを わすれたのかな。0.1が 10こ できたら、1に して 整数《せいすう》の ぶんに たそう。',
    },
    {
      id: 'align-right',
      explain:
        '整数《せいすう》を 小数《しょうすう》のように あつかったのかな。3は 3.0。小数点《しょうすうてん》を たてに そろえて 計算《けいさん》しよう。',
    },
    {
      id: 'small-from-big',
      explain:
        '小数《しょうすう》の ぶんで 大《おお》きい 数《かず》から 小《ちい》さい 数《かず》を ひいたのかな。ひけない ときは 1を 0.1が 10こに なおして かりよう。',
    },
    {
      id: 'wrong-op',
      explain: 'たし算《ざん》を したのかな。「のこり」は ひき算《ざん》だよ。',
    },
  ],
  levels: [
    { label: '0.1の いくつ分・数直線', chance: 0.05 },
    { label: '大きさくらべ', chance: 0.05 },
    { label: 'たし算・ひき算', chance: 0.02 },
    { label: 'まとめ', chance: 0.02 },
  ],
  intro: [
    {
      text: '1Lを 10こに 分《わ》けた 1つ分《ぶん》（1dL）を 0.1Lと 書《か》き、「れい点《てん》一《いち》リットル」と 読《よ》みます。',
      figure: {
        kind: 'numberline',
        min: 0,
        max: 1,
        step: 0.1,
        labelEvery: 10,
        marks: [{ at: 0.1, label: '0.1', tone: 'focus' }],
      },
    },
    {
      text: '0.1を 13こ あつめると 1.3。「.」を 小数点《しょうすうてん》、1.3のような 数《かず》を 小数《しょうすう》と いいます。',
      figure: {
        kind: 'numberline',
        min: 0,
        max: 2,
        step: 0.1,
        labelEvery: 10,
        marks: [{ at: 1.3, label: '1.3', tone: 'focus' }],
      },
    },
    {
      text: '0.7 ＋ 0.5 は、0.1が 7 ＋ 5 ＝ 12こで 1.2。',
      figure: { kind: 'text', text: '0.7 ＋ 0.5 ＝ 1.2', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateDecimals(level, rng, index),
  },
  review: 'type',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第3学年 A(5) 小数の意味と表し方（小数第1位、小数第1位までの加法・減法）',
  revised: '2026-10-24',
};
