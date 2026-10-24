/**
 * g5.prog.polygon 正多角形の作図: くりかえしと回る角度（curriculum-matrix 3.7、手引A・算数5年 正多角形）。
 *
 * 命令「すすむ a」「みぎに d ど」でかいた線を図（SVG）にして、choice・number・match・sort で出題する
 * （program エンジンは格子の上を動くだけで、90ど以外に回れないため）。答えと図は命令から計算して決める。
 *
 * 到達項目:
 *   repeat-turn … 正多角形をかく命令で、くりかえす回数と図形を結びつける。別例 = 図形と命令を線でむすぶ
 *   turn-angle  … 回る角度は 360 ÷ 辺の数（内角ではない）。別例 = 図を見て回る角度を選ぶ
 *   rule        … 角度 × 回数 ＝ 360ど。1しゅうで もとの向きにもどる角度を見つける。別例 = 角度を分ける
 * 同一性キー: 問題の id。
 */
import type { ChoiceItem, Item, SortItem, UnitSpec } from '../../curriculum/types';
import { baseUnit, choiceItem } from './kit';
import { FW, repText, repeatSteps, TR, turtleFigure, type TStep } from './turtle';
import { cmdChoice, figChoice, matchItem, num } from './turtle-items';

/** 正 n 角形（1辺 a） */
const P = (n: number, a: number): TStep[] => repeatSteps(n, FW(a), TR(360 / n));
const PN: Record<number, string> = {
  3: '正三角形《せいさんかくけい》',
  4: '正方形《せいほうけい》',
  5: '正五角形《せいごかくけい》',
  6: '正六角形《せいろっかくけい》',
  8: '正八角形《せいはっかくけい》',
  9: '正九角形《せいきゅうかくけい》',
  10: '正十角形《せいじゅっかくけい》',
  12: '正十二角形《せいじゅうにかくけい》',
  15: '正十五角形《せいじゅうごかくけい》',
  20: '正二十角形《せいにじゅっかくけい》',
};
const inner = (n: number) => 180 - 360 / n;
const ANG = '角度《かくど》';

const H_REP: [string, string, string] = [
  '図《ず》の かどを 数《かぞ》えよう。かどの 数《かず》は、辺《へん》の 数《かず》と おなじだよ。',
  '「すすむ、みぎに まがる」を 1かい くりかえすと、辺《へん》が ひとつ かけるよ。',
  'くりかえす 数《かず》は、辺《へん》の 数《かず》と おなじだよ。図《ず》の 辺《へん》を ゆびで たどって 数《かぞ》えよう。',
];

// ---- repeat-turn ----
const repeatItems: Item[] = [
  cmdChoice({
    id: 'rt-1',
    obj: 'repeat-turn',
    level: 0,
    target: P(3, 3),
    right: P(3, 3),
    wrongs: [
      [repeatSteps(3, FW(3), TR(60)), 'turn-interior'],
      [repeatSteps(2, FW(3), TR(120)), 'repeat-count'],
    ],
    grid: false,
    texts: (ss) => {
      const n = ss.filter((s) => 'f' in s).length;
      const t = (ss[1] as { t: number }).t;
      return repText(n, FW(3), TR(t));
    },
    hints: H_REP,
    explain: `${PN[3]}は 辺《へん》が 3つ。「すすむ 3、みぎに 120ど」を 3かい くりかえすと かけるよ。60ど だと とじないし、2かいだと 辺《へん》が たりないね。`,
  }),
  num({
    id: 'rt-2',
    obj: 'repeat-turn',
    level: 0,
    prompt: `「すすむ 3、みぎに 120ど」を くりかえして ${PN[3]}を ちょうど 1しゅう かくよ。なんかい くりかえすかな。`,
    figure: turtleFigure(P(3, 3), PN[3]!, {}),
    answer: 3,
    label: 'かい',
    wrongs: [
      [4, 'repeat-count'],
      [2, 'repeat-count'],
      [120, 'turn-as-count'],
    ],
    hints: H_REP,
    explain: `${PN[3]}の 辺《へん》は 3つで、1かいで 辺《へん》が ひとつ かけるから、3かい くりかえすよ。`,
  }),
  num({
    id: 'rt-3',
    obj: 'repeat-turn',
    level: 0,
    prompt: `「すすむ 2、みぎに 60ど」を くりかえして ${PN[6]}を かくよ。なんかい くりかえすかな。`,
    figure: turtleFigure(P(6, 2), PN[6]!, {}),
    answer: 6,
    label: 'かい',
    wrongs: [
      [5, 'repeat-count'],
      [4, 'repeat-count'],
      [60, 'turn-as-count'],
    ],
    hints: H_REP,
    explain: `${PN[6]}は 辺《へん》が 6つ。だから 6かい くりかえすよ。`,
  }),
  figChoice({
    id: 'rt-4',
    obj: 'repeat-turn',
    level: 1,
    prompt: `つぎの 命令《めいれい》で かける 図形《ずけい》は どれかな。\n${repText(5, FW(2), TR(72))}`,
    right: P(5, 2),
    wrongs: [
      [repeatSteps(5, FW(2), TR(108)), 'turn-interior'],
      [repeatSteps(4, FW(2), TR(72)), 'repeat-count'],
    ],
    rot: 0,
    grid: false,
    hints: [
      '「5かい くりかえす」ので、辺《へん》は いくつ かけるかな。',
      'まがる 角度《かくど》が 大《おお》きいほど、かどが するどく まがるよ。',
      '辺《へん》が 5つ あって、さいごに もとの ばしょに もどって とじている 図形《ずけい》を えらぼう。',
    ],
    explain: `${PN[5]}は 辺《へん》が 5つで、かどで 72ど ずつ まがるよ。5かい くりかえすと もとの ばしょに もどって とじるね。`,
  }),
  cmdChoice({
    id: 'rt-5',
    obj: 'repeat-turn',
    level: 1,
    target: P(6, 2),
    right: P(6, 2),
    wrongs: [
      [repeatSteps(6, FW(2), TR(120)), 'turn-interior'],
      [repeatSteps(5, FW(2), TR(60)), 'repeat-count'],
    ],
    grid: false,
    texts: (ss) => {
      const n = ss.filter((s) => 'f' in s).length;
      const t = (ss[1] as { t: number }).t;
      return repText(n, FW(2), TR(t));
    },
    hints: H_REP,
    explain: `${PN[6]}は 辺《へん》が 6つで、かどで 60ど ずつ まがるよ。「みぎに 120ど」だと、まがりすぎて ${PN[3]}を 2かい かくことに なるよ。`,
  }),
  num({
    id: 'rt-6',
    obj: 'repeat-turn',
    level: 1,
    prompt: `「すすむ 2、みぎに 45ど」を くりかえして ${PN[8]}を かくよ。なんかい くりかえすかな。`,
    figure: turtleFigure(P(8, 2), PN[8]!, {}),
    answer: 8,
    label: 'かい',
    wrongs: [
      [7, 'repeat-count'],
      [6, 'repeat-count'],
      [45, 'turn-as-count'],
    ],
    hints: H_REP,
    explain: `${PN[8]}は 辺《へん》が 8つ。だから 8かい くりかえすよ。`,
  }),
  choiceItem({
    id: 'rt-7',
    obj: 'repeat-turn',
    level: 2,
    prompt: `${PN[5]}を かく 命令《めいれい》は どれかな。（1辺《ぺん》の ながさは 2）`,
    right: repText(5, FW(2), TR(72)),
    wrongs: [
      [repText(5, FW(2), TR(108)), 'turn-interior'],
      // 6かい だと 1つめの 辺を もう一度 なぞるだけで 同じ 正五角形に なるので、たりない 4かいを 誤りにする
      [repText(4, FW(2), TR(72)), 'repeat-count'],
    ],
    layout: 'column',
    hints: [
      '正五角形《せいごかくけい》の 辺《へん》の 数《かず》を 思《おも》い出《だ》そう。',
      'くりかえす 数《かず》は 辺《へん》の 数《かず》。まがる 角度《かくど》は 360ど を その 数《かず》で わった 大《おお》きさだよ。',
      '5かい くりかえすのは まちがいないね。まがる 角度《かくど》を 360 ÷ 5 で もとめよう。',
    ],
    explain: `辺《へん》が 5つだから 5かい くりかえす。まがる 角度《かくど》は 360 ÷ 5 ＝ 72ど。108ど は ${PN[5]}の かどの 内側《うちがわ》の 角《かく》だよ。`,
  }),
  num({
    id: 'rt-8',
    obj: 'repeat-turn',
    level: 2,
    prompt: `「すすむ 1、みぎに 36ど」を くりかえして ${PN[10]}を かくよ。なんかい くりかえすかな。`,
    answer: 10,
    label: 'かい',
    wrongs: [
      [9, 'repeat-count'],
      [36, 'turn-as-count'],
      [8, 'repeat-count'],
    ],
    hints: H_REP,
    explain: `${PN[10]}は 辺《へん》が 10こ。だから 10かい くりかえすよ。`,
  }),
];
const repeatMatches: Item[] = [
  matchItem({
    id: 'rt-alt-1',
    obj: 'repeat-turn',
    level: 0,
    grid: false,
    wrongMis: 'repeat-count',
    pairs: [
      { steps: P(3, 3), text: repText(3, FW(3), TR(120)) },
      { steps: P(6, 2), text: repText(6, FW(2), TR(60)) },
      { steps: P(5, 2), text: repText(5, FW(2), TR(72)) },
    ],
    hints: [
      '図形《ずけい》ごとに 辺《へん》の 数《かず》を 数《かぞ》えよう。',
      '辺《へん》の 数《かず》と、くりかえす 数《かず》が おなじ 命令《めいれい》を さがそう。',
      '辺《へん》が 3つ、5つ、6つの 図形《ずけい》だよ。',
    ],
    explain: `辺《へん》の 数《かず》と くりかえす 数《かず》が 同《おな》じ。${PN[3]}は 3かい、${PN[6]}は 6かい、${PN[5]}は 5かい だよ。`,
  }),
  matchItem({
    id: 'rt-alt-2',
    obj: 'repeat-turn',
    level: 0,
    grid: false,
    wrongMis: 'repeat-count',
    pairs: [
      { steps: P(4, 2), text: repText(4, FW(2), TR(90)) },
      { steps: P(8, 1), text: repText(8, FW(1), TR(45)) },
      { steps: P(6, 2), text: repText(6, FW(2), TR(60)) },
    ],
    hints: [
      'いちばん 辺《へん》が 少《すく》ない 図形《ずけい》から じゅんに 見《み》よう。',
      '辺《へん》の 数《かず》と くりかえす 数《かず》を くらべよう。',
      '角《かど》が まるく 見《み》える 図形《ずけい》は、辺《へん》が おおいよ。',
    ],
    explain: `${PN[4]}は 4かい、${PN[8]}は 8かい、${PN[6]}は 6かい。辺《へん》の 数《かず》だけ くりかえすよ。`,
  }),
  matchItem({
    id: 'rt-alt-3',
    obj: 'repeat-turn',
    level: 2,
    grid: false,
    wrongMis: 'repeat-count',
    pairs: [
      { steps: P(3, 3), text: repText(3, FW(3), TR(120)) },
      { steps: P(5, 2), text: repText(5, FW(2), TR(72)) },
      { steps: P(10, 1), text: repText(10, FW(1), TR(36)) },
    ],
    extra: [repText(9, FW(1), TR(40))],
    hints: [
      '図形《ずけい》ごとに 辺《へん》の 数《かず》を 数《かぞ》えよう。',
      '辺《へん》が 10こ ある 図形《ずけい》は、ほとんど 円《えん》に 見《み》えるね。',
      '辺《へん》が いちばん 多《おお》い 図形《ずけい》は、くりかえす 数《かず》も いちばん 多《おお》いよ。',
    ],
    explain: `辺《へん》が 3つ・5つ・10この 図形《ずけい》。くりかえす 数《かず》が 辺《へん》の 数《かず》と 同《おな》じ 命令《めいれい》を えらぶよ。`,
  }),
];

// ---- turn-angle ----
interface Ta {
  id: string;
  level: number;
  n: number;
  a: number;
}
const TA: Ta[] = [
  { id: 'ta-1', level: 1, n: 3, a: 3 },
  { id: 'ta-2', level: 1, n: 6, a: 2 },
  { id: 'ta-3', level: 1, n: 5, a: 2 },
  { id: 'ta-4', level: 2, n: 8, a: 2 },
  { id: 'ta-5', level: 2, n: 9, a: 1 },
  { id: 'ta-6', level: 2, n: 12, a: 1 },
  { id: 'ta-7', level: 2, n: 20, a: 1 },
  { id: 'ta-8', level: 2, n: 15, a: 1 },
];
const angleItems: Item[] = TA.map((t) =>
  num({
    id: t.id,
    obj: 'turn-angle',
    level: t.level,
    prompt: `${PN[t.n]}を かくよ。かどで「みぎに ◯ど」と まがる。◯に はいる ${ANG}を いれよう。`,
    figure: t.n <= 10 ? turtleFigure(P(t.n, t.a), PN[t.n]!, {}) : undefined,
    answer: 360 / t.n,
    label: 'ど',
    wrongs: [
      [inner(t.n), 'turn-interior'],
      [t.n, 'turn-as-count'],
      [180, 'turn-interior'],
    ],
    hints: [
      '1しゅう まわると、もとの むきに もどるよ。ぜんぶで なんど まわるかな。',
      `辺《へん》は ${t.n}つ あるから、かどで ${t.n}かい まがるよ。`,
      `${t.n}かいの まがる 角度《かくど》を ぜんぶ たすと、360ど に なるよ。360 を ${t.n}で わろう。`,
    ],
    explain: `${PN[t.n]}は かどで ${t.n}かい まがって 1しゅう（360ど）する。だから 360 ÷ ${t.n} ＝ ${360 / t.n}ど。${inner(t.n)}ど は 図形《ずけい》の 内側《うちがわ》の かどの 角《かく》で、まがる 角度《かくど》とは ちがうよ。`,
  }),
);
// 別例: 図を見て回る角度を選ぶ
const angleAlts: ChoiceItem[] = [
  { id: 'ta-alt-1', level: 1, n: 5, a: 2 },
  { id: 'ta-alt-2', level: 2, n: 6, a: 2 },
  { id: 'ta-alt-3', level: 2, n: 8, a: 2 },
].map((t) => {
  const right = 360 / t.n;
  const wrongs: [string, string][] = [
    [`${inner(t.n)}ど`, 'turn-interior'],
    [`${t.n}ど`, 'turn-as-count'],
  ].filter(([s]) => s !== `${right}ど`) as [string, string][];
  return choiceItem({
    id: t.id,
    obj: 'turn-angle',
    level: t.level,
    alt: true,
    prompt: `この ${PN[t.n]}を かくとき、かどで「みぎに ◯ど」と まがるよ。◯は いくつかな。`,
    figure: turtleFigure(P(t.n, t.a), PN[t.n]!, {}),
    right: `${right}ど`,
    wrongs,
    hints: [
      'かどの かずを 数《かぞ》えよう。かどで 1かいずつ まがるよ。',
      'ぜんぶの かどで まがった 角度《かくど》を たすと 1しゅう（360ど）だよ。',
      `360 を かどの 数《かず》 ${t.n}で わろう。`,
    ],
    explain: `360 ÷ ${t.n} ＝ ${right}。かどで ${right}ど ずつ まがるよ。${inner(t.n)}ど は 内側《うちがわ》の 角《かく》の 大《おお》きさだね。`,
  });
});

// ---- rule ----
interface Ru {
  id: string;
  level: number;
  d: number;
}
const RU: Ru[] = [
  { id: 'ru-1', level: 2, d: 90 },
  { id: 'ru-2', level: 2, d: 72 },
  { id: 'ru-3', level: 2, d: 40 },
  { id: 'ru-4', level: 2, d: 20 },
];
const ruleNums: Item[] = RU.map((r) =>
  num({
    id: r.id,
    obj: 'rule',
    level: r.level,
    prompt: `「みぎに ${r.d}ど」を くりかえして 1しゅう（360ど）。\nなんかい くりかえす？`,
    answer: 360 / r.d,
    label: 'かい',
    wrongs: [
      [r.d, 'turn-as-count'],
      [Math.round(360 / r.d) + 1, 'repeat-count'],
      [Math.round(360 / r.d) - 1, 'repeat-count'],
    ],
    hints: [
      '1かいで 何《なん》ど まわるかな。ぜんぶで 360ど まわりたいね。',
      `${r.d}ど を いくつ あつめると 360ど に なるかな。`,
      `360 ÷ ${r.d} を けいさんしよう。`,
    ],
    explain: `360 ÷ ${r.d} ＝ ${360 / r.d}。${r.d}ど を ${360 / r.d}かい くりかえすと 360ど（1しゅう）に なるよ。`,
  }),
);
const ruleExtra: Item[] = [
  num({
    id: 'ru-5',
    obj: 'rule',
    level: 2,
    prompt: `${PN[6]}を かくときに まがった 角度《かくど》を、ぜんぶ たすと 何《なん》どに なるかな。（「みぎに 60ど」を 6かい）`,
    answer: 360,
    label: 'ど',
    wrongs: [
      [60, 'turn-as-count'],
      [120, 'turn-interior'],
      [720, 'turn-interior'],
    ],
    hints: [
      '1かいで 60ど、それを 6かい くりかえすよ。',
      'かけ算《ざん》を つかおう。',
      '60 × 6 を けいさんしよう。',
    ],
    explain: `60 × 6 ＝ 360。どんな 正多角形《せいたかくけい》でも、まがった 角度《かくど》を ぜんぶ たすと 360ど（1しゅう）に なるよ。`,
  }),
  choiceItem({
    id: 'ru-6',
    obj: 'rule',
    level: 2,
    prompt: `「すすむ 2、みぎに 50ど」を 6かいで ${PN[6]}を\nかいたら とじない。どう なおす？`,
    right: 'みぎに 60ど に する',
    wrongs: [
      ['みぎに 40ど に する', 'turn-sum'],
      ['くりかえす 数《かず》を 7かいに する', 'repeat-count'],
    ],
    layout: 'column',
    hints: [
      '正六角形《せいろっかくけい》は かどが 6つ あるね。',
      'まがった 角度《かくど》を 6かい たすと 360ど に なるはずだよ。',
      '50 × 6 ＝ 300 では 足《た》りないね。360 ÷ 6 を けいさんしよう。',
    ],
    explain: `360 ÷ 6 ＝ 60 だから、かどで 60ど ずつ まがるよ。50 × 6 ＝ 300 では 1しゅうに たりなくて、とじないね。`,
  }),
];
const ruleItems: Item[] = [...ruleNums, ...ruleExtra];

// 別例: 1しゅうでもどる角度に分ける
interface Rs {
  id: string;
  level: number;
  cards: number[];
}
const RS: Rs[] = [
  { id: 'ru-alt-1', level: 2, cards: [120, 90, 72, 100, 45, 50] },
  { id: 'ru-alt-2', level: 2, cards: [60, 40, 36, 70, 80, 25] },
  { id: 'ru-alt-3', level: 2, cards: [30, 20, 15, 35, 55, 65] },
];
const ruleSorts: SortItem[] = RS.map((r) => ({
  engine: 'sort',
  id: r.id,
  objective: 'rule',
  level: r.level,
  alt: true,
  prompt:
    '「みぎに ◯ど」を くりかえして、ちょうど 1しゅう（360ど）で もとの むきに もどる 角度《かくど》と、もどらない 角度《かくど》に わけよう。',
  boxes: [{ label: 'ちょうど もどる' }, { label: 'もどらない' }],
  cards: r.cards.map((d) => {
    const ok = 360 % d === 0;
    return {
      label: `${d}ど`,
      box: ok ? 0 : 1,
      wrongBoxes: [{ box: ok ? 1 : 0, misconception: 'not-divisible' }],
    };
  }),
  hints: [
    '360 を その 角度《かくど》で わって みよう。',
    'わりきれる とき、くりかえす 数《かず》が ちょうど 整数《せいすう》に なるよ。',
    'わりきれない 角度《かくど》は、1しゅう したところで もとの むきに ぴったりは もどらないよ。',
  ],
  explain: `360 を わりきれる 角度《かくど》は ${r.cards
    .filter((d) => 360 % d === 0)
    .map((d) => `${d}ど（${360 / d}かい）`)
    .join('、')}。ほかは わりきれなくて、ちょうど 1しゅうで もどらないよ。`,
  identity: r.id,
}));

const items: Item[] = [
  ...repeatItems,
  ...repeatMatches,
  ...angleItems,
  ...angleAlts,
  ...ruleItems,
  ...ruleSorts,
];

export const polygon: UnitSpec = {
  ...baseUnit('g5.prog.polygon', 'g5'),
  title: '正多角形《せいたかくけい》を かく 命令《めいれい》',
  prereq: ['g4.prog.draw-shapes'],
  objectives: [
    {
      id: 'repeat-turn',
      title: '正多角形《せいたかくけい》の 辺《へん》の 数《かず》と くりかえす 数《かず》',
    },
    { id: 'turn-angle', title: '回《まわ》る 角度《かくど》は 360 ÷ 辺《へん》の 数《かず》' },
    { id: 'rule', title: '角度《かくど》 × 回数《かいすう》 ＝ 360ど' },
  ],
  misconceptions: [
    {
      id: 'turn-interior',
      explain:
        '図形《ずけい》の 内側《うちがわ》の かどの 角《かく》を 入《い》れたのかな。命令《めいれい》の「みぎに ◯ど」は、すすむ むきを かえる 角度《かくど》で、内側《うちがわ》の 角《かく》とは ちがうよ。',
    },
    {
      id: 'turn-as-count',
      explain:
        '角度《かくど》と くりかえす 数《かず》を とりちがえたのかな。「◯ど」は まがる 大《おお》きさ、「◯かい」は くりかえす 数《かず》だよ。',
    },
    {
      id: 'repeat-count',
      explain:
        'くりかえす 数《かず》が ちがったのかな。正多角形《せいたかくけい》では、辺《へん》の 数《かず》と くりかえす 数《かず》は おなじだよ。',
    },
    {
      id: 'turn-sum',
      explain:
        'まがる 角度《かくど》を くりかえす 数《かず》だけ たすと、360ど に なるかな。かけ算《ざん》で たしかめよう。',
    },
    {
      id: 'not-divisible',
      explain:
        '360 を その 角度《かくど》で わって みたかな。わりきれないと、ちょうど 1しゅうで もとの むきに もどれないよ。',
    },
  ],
  levels: [
    { label: '辺《へん》の 数《かず》と かいすう', chance: 0.05 },
    { label: 'まがる 角度《かくど》', chance: 0.05 },
    { label: '360ど の きまり', chance: 0.05 },
  ],
  intro: [
    {
      text: `「すすむ 3、みぎに 120ど」を 3かい くりかえすと、${PN[3]}が かけるよ。`,
      figure: turtleFigure(P(3, 3), PN[3]!, {}),
    },
    {
      text: '「みぎに ◯ど」は、すすむ むきを かえる 角度《かくど》だよ。図形《ずけい》の 内側《うちがわ》の 角《かく》とは ちがうよ。',
      figure: turtleFigure(P(6, 2), PN[6]!, {}),
    },
    {
      text: 'かどで まがった 角度《かくど》を ぜんぶ たすと 360ど（1しゅう）。だから まがる 角度《かくど》は 360 ÷ 辺《へん》の 数《かず》だよ。',
      figure: { kind: 'text', text: '120 × 3 ＝ 360　　60 × 6 ＝ 360', size: 'l' },
    },
  ],
  source: { kind: 'items', items },
  basis:
    '小学校学習指導要領（平成29年告示）算数 第5学年 B（正多角形）、同 内容の取扱い（プログラミングを体験する学習の例: 正多角形の作図）、小学校プログラミング教育の手引（第三版）A。program エンジンは格子の上を動くだけなので、線の図は命令から計算した図で出題',
  gradeIsAppProposal: false,
};
