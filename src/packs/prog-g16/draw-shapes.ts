/**
 * g4.prog.draw-shapes 進む・回るの命令で図形をかく（正方形・長方形）（curriculum-matrix 3.6、手引・EOS 7.2）。
 *
 * program エンジンは格子の上を動くだけで線をかけないので、「すすむ n」「みぎに ◯ど」の命令でかいた線を図（SVG）にして、
 * choice・number・match で出題する（図は turtle.ts が命令から計算する。答えも命令から計算して決める）。
 *
 * 到達項目:
 *   square … 命令で正方形をかく（かどの角度・くりかえす回数・辺の長さ）。別例 = 図形と命令を線でむすぶ
 *   rect   … 命令で長方形をかく（長い辺・短い辺・かどの角度）。別例 = 図形と命令を線でむすぶ
 *   short  … くりかえしを使って命令を短くする（札の数）。別例 = 長い命令と短い命令を線でむすぶ
 * 同一性キー: 問題の id。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import { baseUnit, choiceItem } from './kit';
import { FW, repText, repeatSteps, TR, turtleFigure, type TStep } from './turtle';
import { cmdChoice, figChoice, matchItem, num } from './turtle-items';

const SQ = (side: number): TStep[] => repeatSteps(4, FW(side), TR(90));
const RC = (a: number, b: number): TStep[] => repeatSteps(2, FW(a), TR(90), FW(b), TR(90));

const SQN = '正方形《せいほうけい》';
const RCN = '長方形《ちょうほうけい》';
const ANGLE = '角度《かくど》';

const H_FIG: [string, string, string] = [
  '図《ず》を みて、すすむ ながさと、まがる ところを かぞえよう。',
  'みどりの てんから 右《みぎ》へ すすんで、かどで みぎに まがるよ。',
  'かどは いくつ あるかな。かどの かずと、くりかえす かいすうを くらべよう。',
];

// ---- square ----
const squareItems: Item[] = [
  cmdChoice({
    id: 'sq-1',
    obj: 'square',
    level: 0,
    target: SQ(3),
    right: SQ(3),
    wrongs: [
      [repeatSteps(3, FW(3), TR(90)), 'count-wrong'],
      [repeatSteps(4, FW(3), TR(60)), 'angle-wrong'],
    ],
    texts: (ss) => {
      const n = ss.filter((s) => 'f' in s).length;
      const first = ss.find((s) => 't' in s) as { t: number };
      return repText(n, FW((ss[0] as { f: number }).f), TR(first.t));
    },
    hints: H_FIG,
    explain: `${SQN}は 4つの へんの ながさが おなじで、かどは ぜんぶ 90ど。「すすむ 3、みぎに 90ど」を 4かい くりかえすと かけるよ。`,
  }),
  num({
    id: 'sq-2',
    obj: 'square',
    level: 0,
    prompt: `「すすむ 4、みぎに 90ど」を くりかえして ${SQN}を ちょうど 1しゅう かくよ。なんかい くりかえすかな。`,
    figure: turtleFigure(SQ(4).slice(0, 4), '2つの へんまで かいた 図《ず》', { grid: true }),
    answer: 4,
    label: 'かい',
    wrongs: [
      [3, 'count-wrong'],
      [2, 'count-wrong'],
      [8, 'count-wrong'],
    ],
    hints: [
      `${SQN}には へんが いくつ あるかな。`,
      '1かい くりかえすと、へんが ひとつ かけるよ。ずは 2かい ぶん かいた ところだよ。',
      'へんの かずと、くりかえす かいすうは おなじだよ。',
    ],
    explain: `${SQN}の へんは 4つ。「すすむ、まがる」を 1かい くりかえすごとに へんが ひとつ かけるから、4かい くりかえすよ。`,
  }),
  num({
    id: 'sq-3',
    obj: 'square',
    level: 0,
    prompt: `${SQN}の かどは、ぜんぶ なんどの ${ANGLE}かな。「みぎに ◯ど」の ◯に はいる 数《かず》を いれよう。`,
    figure: turtleFigure(SQ(3).slice(0, 3), 'かどで みぎに まがる ところ', { grid: true }),
    answer: 90,
    label: 'ど',
    wrongs: [
      [45, 'angle-wrong'],
      [180, 'angle-wrong'],
      [4, 'angle-wrong'],
      [60, 'angle-wrong'],
    ],
    hints: [
      `${SQN}の かどを おもいだそう。たて と よこが まじわって いるよ。`,
      'さんかくじょうぎの ひとつの かどと おなじ 角《かど》だよ。',
      'たてと よこが まじわる かどは「直角《ちょっかく》」。直角《ちょっかく》は なんど だったかな。',
    ],
    explain: `${SQN}の 4つの かどは ぜんぶ 90ど（ちょくかく）。だから「みぎに 90ど」と まがるよ。`,
  }),
  num({
    id: 'sq-4',
    obj: 'square',
    level: 1,
    prompt: `「すすむ 3、みぎに 90ど」を 3かい くりかえしたよ。\n${SQN}にするには、あと なんかい？`,
    figure: turtleFigure(repeatSteps(3, FW(3), TR(90)), '3つの へんまで かいた 図形《ずけい》', {
      grid: true,
    }),
    answer: 1,
    label: 'かい',
    wrongs: [
      [4, 'count-wrong'],
      [2, 'count-wrong'],
      [0, 'open-shape'],
    ],
    hints: [
      'ずに へんが いくつ かけて いるか かぞえよう。',
      `${SQN}の へんは 4つだよ。`,
      '4つ の うち、かけて いない へんは いくつ のこって いるかな。',
    ],
    explain: `${SQN}の へんは 4つで、いまは 3つ かけているよ。あと 1かい くりかえすと、もとの ばしょに もどって ${SQN}が とじるよ。`,
  }),
  num({
    id: 'sq-5',
    obj: 'square',
    level: 1,
    prompt: `「すすむ 5、みぎに 90ど」を 4かい くりかえしたよ。\nすすんだ ながさの ごうけいは？`,
    answer: 20,
    wrongs: [
      [5, 'side-wrong'],
      [9, 'side-wrong'],
      [4, 'side-wrong'],
    ],
    hints: [
      'すすむ ふだは ぜんぶで なんこ あるかな。',
      '1かいで 5すすむよ。それを くりかえした かいすうぶん あつめよう。',
      '5が 4つ あるよ。かけざんを つかおう。',
    ],
    explain: `${SQN}の へんは 4つで、ひとつの へんの ながさが 5。5 × 4 ＝ 20。一周《いっしゅう》で 20 すすむよ。`,
  }),
  figChoice({
    id: 'sq-6',
    obj: 'square',
    level: 1,
    prompt: `つぎの 命令《めいれい》で かける 図形《ずけい》は どれかな。\n${repText(4, FW(2), TR(90))}`,
    right: SQ(2),
    wrongs: [
      [repeatSteps(3, FW(2), TR(90)), 'count-wrong'],
      [repeatSteps(4, FW(3), TR(90)).slice(0, 4), 'count-wrong'],
    ],
    rot: 1,
    grid: true,
    hints: [
      'ひとつの へんの ながさと、まがる 角度《かくど》を よもう。',
      'かどが 4つ できて、もとの ばしょに もどる 図形《ずけい》を さがそう。',
      'へんの ながさは 2だよ。ずの めもりを かぞえて たしかめよう。',
    ],
    explain: `「すすむ 2、みぎに 90ど」を 4かい くりかえすと、ながさ 2の へんが 4つの ${SQN}が かけるよ。`,
  }),
  num({
    id: 'sq-7',
    obj: 'square',
    level: 2,
    prompt: `${SQN}を かくとき、「みぎに 90ど」を 4かい まわるね。ぜんぶで なんど まわったことに なるかな。`,
    figure: turtleFigure(SQ(3), 'かどで 4かい まがった 図形《ずけい》', { grid: true }),
    answer: 360,
    label: 'ど',
    wrongs: [
      [90, 'angle-wrong'],
      [180, 'angle-wrong'],
      [270, 'angle-wrong'],
      [4, 'angle-wrong'],
    ],
    hints: [
      '1かいで なんど まわるかな。それを 何《なん》かい するかな。',
      '90ど が 4つ あるよ。',
      '90 × 4 を けいさんしよう。ぐるっと ひとまわりすると もとの むきに もどるね。',
    ],
    explain: `90ど × 4かい ＝ 360ど。360ど まわると、ぐるっと ひとまわりして もとの むきに もどるよ。`,
  }),
  cmdChoice({
    id: 'sq-8',
    obj: 'square',
    level: 2,
    target: SQ(2),
    right: SQ(2),
    prompt: `この ${SQN}を かく 命令《めいれい》は どれ？`,
    wrongs: [
      [repeatSteps(4, FW(2), TR(120)), 'angle-wrong'],
      [repeatSteps(2, FW(2), TR(90), FW(3), TR(90)), 'side-wrong'],
    ],
    texts: (ss) => {
      if (
        ss.length === 8 &&
        'f' in ss[0]! &&
        ss[0].f === 2 &&
        't' in ss[1]! &&
        ss[1].t === 90 &&
        'f' in ss[2]! &&
        ss[2].f === 2
      )
        return repText(4, FW(2), TR(90));
      if (ss.length === 8 && 't' in ss[1]! && ss[1].t === 120) return repText(4, FW(2), TR(120));
      return repText(2, FW(2), TR(90), FW(3), TR(90));
    },
    hints: [
      `${SQN}の へんの ながさと かどの 角度《かくど》を ひとつずつ たしかめよう。`,
      'へんは ぜんぶ おなじ ながさで、かどは 90ど だよ。',
      `「へんの ながさが ちがうもの」と「角度《かくど》が 90ど でないもの」は ${SQN}に ならないよ。`,
    ],
    explain: `${SQN}は へんが ぜんぶ 2、かどが ぜんぶ 90ど。「すすむ 2、みぎに 90ど」を 4かい くりかえすと かけるよ。`,
  }),
];

// 別例: 図形と命令をむすぶ（正方形）
const squareMatches: Item[] = [
  matchItem({
    id: 'sq-alt-1',
    obj: 'square',
    level: 0,
    pairs: [
      { steps: SQ(2), text: repText(4, FW(2), TR(90)) },
      { steps: SQ(4), text: repText(4, FW(4), TR(90)) },
      { steps: repeatSteps(3, FW(2), TR(90)), text: repText(3, FW(2), TR(90)) },
    ],
    hints: [
      '図形《ずけい》を ひとつ えらんで、ひとつの へんの ながさと、へんの かずを かぞえよう。',
      '命令《めいれい》の「すすむ ◯」が へんの ながさ、「◯かい」が へんの かずだよ。',
      '3つしか へんが かけて いない 図形《ずけい》は、3かい くりかえした 命令《めいれい》だよ。',
    ],
    explain: `ながさ 2の ${SQN}、ながさ 4の ${SQN}、3かいだけ くりかえした とじていない 図形《ずけい》。へんの ながさと くりかえす かいすうで 見《み》わけられるよ。`,
  }),
  matchItem({
    id: 'sq-alt-2',
    obj: 'square',
    level: 1,
    pairs: [
      { steps: SQ(3), text: repText(4, FW(3), TR(90)) },
      { steps: repeatSteps(4, FW(3), TR(60)), text: repText(4, FW(3), TR(60)) },
      { steps: repeatSteps(2, FW(3), TR(90)), text: repText(2, FW(3), TR(90)) },
    ],
    hints: [
      '図形《ずけい》ごとに、かどの 形《かたち》を みよう。90ど かな、それとも もっと ひろい 角《かく》かな。',
      '「みぎに 60ど」だと、まがり方《かた》が 小《ちい》さくて かどが ひろく なり、とじないよ。',
      '2かいだけ くりかえした 図形《ずけい》は 2つの へんで おわるよ。',
    ],
    explain: `90ど なら ${SQN}。60ど だと とじない ずけいに なるよ。かいすうが 2かいなら、へんは 2つだけだね。`,
  }),
  matchItem({
    id: 'sq-alt-3',
    obj: 'square',
    level: 2,
    pairs: [
      { steps: SQ(1), text: repText(4, FW(1), TR(90)) },
      { steps: SQ(3), text: repText(4, FW(3), TR(90)) },
      { steps: SQ(5).slice(0, 6), text: repText(3, FW(5), TR(90)) },
    ],
    extra: [repText(4, FW(5), TR(90))],
    hints: [
      '図形《ずけい》の へんの ながさを、めもりを かぞえて しらべよう。',
      `いちばん 小《ちい》さい ${SQN}は ながさ 1 だよ。`,
      'ながさ 1の 図形《ずけい》が いちばん 小《ちい》さいよ。つぎに ながさを くらべよう。',
    ],
    explain: `ながさ 1、ながさ 3の ${SQN}と、3つの へんで とじていない 図形《ずけい》。へんの ながさと くりかえす かいすうで 見《み》わけられるよ。`,
  }),
];

// ---- rect ----
const rectItems: Item[] = [
  num({
    id: 'rc-1',
    obj: 'rect',
    level: 0,
    prompt: `2かい くりかえして ${RCN}を かくよ。\n「すすむ □、みぎに 90ど、すすむ 2、みぎに 90ど」`,
    figure: turtleFigure(RC(4, 2), '長方形《ちょうほうけい》', { grid: true, hU: 7 }),
    answer: 4,
    wrongs: [
      [2, 'side-wrong'],
      [6, 'side-wrong'],
      [8, 'side-wrong'],
    ],
    hints: [
      `${RCN}は、ながい へんと みじかい へんが 2つずつ あるよ。`,
      'ずで、よこの へんと たての へんの ながさを かぞえよう。',
      'はじめに 右《みぎ》へ すすむ よこの へんの めもりを かぞえよう。それが □に はいるよ。',
    ],
    explain: `${RCN}は、ながい へん（4）と みじかい へん（2）が 2つずつ。「すすむ 4、みぎに 90ど、すすむ 2、みぎに 90ど」を 2かい くりかえすよ。`,
  }),
  num({
    id: 'rc-2',
    obj: 'rect',
    level: 0,
    prompt: `「すすむ 4、みぎに 90ど、すすむ 2、みぎに 90ど」を くりかえして ${RCN}を 1しゅう かく。なんかい？`,
    figure: turtleFigure(RC(4, 2).slice(0, 4), '2つの へんまで かいた 図《ず》', { grid: true }),
    answer: 2,
    label: 'かい',
    wrongs: [
      [4, 'count-wrong'],
      [1, 'count-wrong'],
      [3, 'count-wrong'],
    ],
    hints: [
      '1かいで へんが いくつ かけるか、ずで たしかめよう。',
      '1かいで ながい へんと みじかい へんが 1つずつ かけるよ。',
      `${RCN}の へんは ぜんぶで 4つ。1かいで ふたつ かけるね。`,
    ],
    explain: `1かいで 2つの へんが かけて、${RCN}の へんは 4つ。だから 2かい くりかえすよ。`,
  }),
  num({
    id: 'rc-3',
    obj: 'rect',
    level: 0,
    prompt: `${RCN}の かどは、それぞれ なんどの ${ANGLE}かな。`,
    answer: 90,
    label: 'ど',
    wrongs: [
      [45, 'angle-wrong'],
      [180, 'angle-wrong'],
      [4, 'angle-wrong'],
    ],
    hints: [
      `${RCN}を ノートに かくところを おもいうかべよう。`,
      '4つの かどは ぜんぶ おなじ かたちだよ。',
      `${SQN}の かどと おなじ かたちだよ。`,
    ],
    explain: `${RCN}の かどは ぜんぶ 90ど（ちょくかく）。だから「みぎに 90ど」と まがるよ。`,
  }),
  choiceItem({
    id: 'rc-4',
    obj: 'rect',
    level: 1,
    // 正方形も 4つの かどが 直角なので「長方形に ならない もの」とは きかない（正方形に なる ものを きく）
    prompt: `${SQN}に なる ものは どれ？`,
    right: repText(2, FW(3), TR(90), FW(3), TR(90)),
    wrongs: [
      [repText(2, FW(5), TR(90), FW(2), TR(90)), 'side-wrong'],
      [repText(2, FW(4), TR(90), FW(1), TR(90)), 'side-wrong'],
    ],
    layout: 'column',
    hints: [
      `${SQN}は、4つの へんの ながさが ぜんぶ おなじだよ。`,
      '「すすむ ◯」の 数《かず》が 2つ ならんでいるね。ふたつを くらべよう。',
      '1つめの「すすむ」が よこ、2つめの「すすむ」が たての へんの ながさだよ。',
    ],
    explain: `すすむ 数《かず》が おなじ（3と 3）だと、4つの へんが ぜんぶ 3になって ${SQN}に なるよ。すすむ 数《かず》が ちがうと、ながい へんと みじかい へんが ある ${RCN}に なるね。`,
  }),
  num({
    id: 'rc-5',
    obj: 'rect',
    level: 1,
    prompt: `「すすむ 4、みぎに 90ど、すすむ 2、みぎに 90ど」を\n2かい くりかえしたよ。すすんだ ながさの ごうけいは？`,
    figure: turtleFigure(RC(4, 2), '長方形《ちょうほうけい》', { grid: true }),
    answer: 12,
    wrongs: [
      [6, 'side-wrong'],
      [8, 'side-wrong'],
      [24, 'count-wrong'],
    ],
    hints: [
      '4つの へんの ながさを ぜんぶ たそう。',
      'ながい へんが 2つ、みじかい へんが 2つ あるよ。',
      '4 ＋ 2 ＋ 4 ＋ 2 を けいさんしよう。',
    ],
    explain: `4 ＋ 2 ＋ 4 ＋ 2 ＝ 12。一周《いっしゅう》で 12 すすむよ。（1かい ぶんの 6 を 2かい くりかえしたと かんがえても 12 だね）`,
  }),
  figChoice({
    id: 'rc-6',
    obj: 'rect',
    level: 1,
    prompt: `つぎの 命令《めいれい》で かける 図形《ずけい》は どれかな。\n${repText(2, FW(3), TR(90), FW(1), TR(90))}`,
    right: RC(3, 1),
    wrongs: [
      [RC(1, 3), 'side-wrong'],
      [SQ(3), 'side-wrong'],
    ],
    rot: 2,
    grid: true,
    hints: [
      '1つめの「すすむ」が よこの ながさ、2つめが たての ながさだよ。',
      'はじめは 右《みぎ》へ すすむから、よこが ながい 図形《ずけい》を さがそう。',
      'よこが 3、たてが 1の 図形《ずけい》だよ。ずの めもりを かぞえよう。',
    ],
    explain: `はじめに 右《みぎ》へ 3 すすみ、まがって 1 すすむから、よこが 3、たてが 1の ${RCN}に なるよ。`,
  }),
  num({
    id: 'rc-7',
    obj: 'rect',
    level: 2,
    prompt: `${RCN}を かくとき、「みぎに 90ど」と まがるのは ぜんぶで なんかいかな。`,
    figure: turtleFigure(RC(4, 2), '長方形《ちょうほうけい》', { grid: true }),
    answer: 4,
    label: 'かい',
    wrongs: [
      [2, 'count-wrong'],
      [8, 'count-wrong'],
    ],
    hints: [
      'かどは いくつ あるかな。',
      '4つの かどで 1かいずつ まがるよ。',
      '「くりかえす」の かいすうと ふだの 数《かず》を かけて かぞえても いいよ。',
    ],
    explain: `かどが 4つ あるから、まがるのも 4かい。「2つの まがる ふだ」を 2かい くりかえすと、2 × 2 ＝ 4かい まがるよ。`,
  }),
  num({
    id: 'rc-8',
    obj: 'rect',
    level: 2,
    prompt: `2かい くりかえして ${RCN}を かくよ。\n「すすむ 5、みぎに 90ど、すすむ □、みぎに 90ど」`,
    figure: turtleFigure(RC(5, 3), '長方形《ちょうほうけい》', { grid: true, hU: 7 }),
    answer: 3,
    wrongs: [
      [5, 'side-wrong'],
      [2, 'side-wrong'],
      [8, 'side-wrong'],
    ],
    hints: [
      `${RCN}は、よこの へんと たての へんが 2つずつ あるよ。`,
      'はじめの「すすむ 5」は よこの へん。□は まがった あとに すすむ たての へんだよ。',
      'ずの たての へんの めもりを かぞえよう。',
    ],
    explain: `はじめに 右《みぎ》へ 5 すすむから、よこが ながい ${RCN}。よこ 5、たて 3 だから「すすむ 5、みぎに 90ど、すすむ 3、みぎに 90ど」を 2かい くりかえすよ。`,
  }),
];
const rectMatches: Item[] = [
  matchItem({
    id: 'rc-alt-1',
    obj: 'rect',
    level: 0,
    pairs: [
      { steps: RC(4, 2), text: repText(2, FW(4), TR(90), FW(2), TR(90)) },
      { steps: RC(2, 4), text: repText(2, FW(2), TR(90), FW(4), TR(90)) },
      { steps: SQ(3), text: repText(4, FW(3), TR(90)) },
    ],
    hints: [
      '図形《ずけい》ごとに、よこと たての ながさを しらべよう。',
      'はじめに 右《みぎ》へ すすむ ながさが「よこ」の ながさだよ。',
      `よこと たてが おなじ 図形《ずけい》は、${SQN}だよ。`,
    ],
    explain: `よこ 4・たて 2の ${RCN}、よこ 2・たて 4の ${RCN}、そして ${SQN}。はじめに すすむ ながさで、よこの ながさが きまるよ。`,
  }),
  matchItem({
    id: 'rc-alt-2',
    obj: 'rect',
    level: 1,
    pairs: [
      { steps: RC(3, 1), text: repText(2, FW(3), TR(90), FW(1), TR(90)) },
      { steps: RC(5, 2), text: repText(2, FW(5), TR(90), FW(2), TR(90)) },
      { steps: RC(2, 3), text: repText(2, FW(2), TR(90), FW(3), TR(90)) },
    ],
    hints: [
      '1つの 図形《ずけい》を えらんで、よこの ながさを 数《かぞ》えよう。',
      'つぎに たての ながさを 数《かぞ》えよう。',
      'よこと たての ながさが 2つとも あう 命令《めいれい》を さがそう。',
    ],
    explain: `よこ 3・たて 1、よこ 5・たて 2、よこ 2・たて 3。よこと たての ながさを じゅんに よむと、命令《めいれい》が みつかるよ。`,
  }),
  matchItem({
    id: 'rc-alt-3',
    obj: 'rect',
    level: 2,
    pairs: [
      { steps: RC(4, 1), text: repText(2, FW(4), TR(90), FW(1), TR(90)) },
      {
        steps: repeatSteps(2, FW(4), TR(90), FW(1), TR(60)),
        text: repText(2, FW(4), TR(90), FW(1), TR(60)),
      },
    ],
    extra: [repText(2, FW(1), TR(90), FW(4), TR(90))],
    hints: [
      '2つの 図形《ずけい》を くらべて、かどが 90ど か どうか みよう。',
      'かどが 90ど でない 図形《ずけい》は、とじていないよ。',
      '右《みぎ》がわの 3つめの 命令《めいれい》は、はじめに 1 すすむから、どちらの 図形《ずけい》にも あわないよ。',
    ],
    explain: `ひとつは よこ 4・たて 1の ${RCN}。もうひとつは かどが 60ど で とじない 図形《ずけい》だよ。`,
  }),
];

// ---- short ----

const shortItems: Item[] = [
  cmdChoice({
    id: 'sh-1',
    obj: 'short',
    level: 0,
    target: SQ(3),
    right: SQ(3),
    prompt: `${SQN}を かく、みじかい 命令《めいれい》は どれ？`,
    wrongs: [
      [repeatSteps(3, FW(3), TR(90)), 'count-wrong'],
      [repeatSteps(4, FW(3), TR(60)), 'repeat-body'],
    ],
    texts: (ss) => {
      const n = ss.filter((s) => 'f' in s).length;
      const first = ss.find((s) => 't' in s) as { t: number };
      return repText(n, FW(3), TR(first.t));
    },
    hints: [
      'おなじ ならびが なんかい でてくるか 数《かぞ》えよう。',
      '「すすむ 3、みぎに 90ど」の ならびが くりかえされて いるよ。',
      `${SQN}の かどの 数《かず》と、ならびが でてくる かいすうを くらべよう。`,
    ],
    explain: `「すすむ 3、みぎに 90ど」が 4かい ならんでいるから「${repText(4, FW(3), TR(90))}」と みじかく かけるよ。`,
  }),
  num({
    id: 'sh-2',
    obj: 'short',
    level: 0,
    prompt: `${RCN}の 命令《めいれい》は、ふだが 8まい ならぶよ。\n「すすむ、まがる、すすむ、まがる」は なんかい？`,
    figure: turtleFigure(RC(4, 2), '長方形《ちょうほうけい》', { grid: true, hU: 7 }),
    answer: 2,
    label: 'かい',
    wrongs: [
      [4, 'count-wrong'],
      [8, 'count-wrong'],
      [1, 'count-wrong'],
    ],
    hints: [
      'ならびの はじめから、おなじ ならびが もういちど でてくる ところを さがそう。',
      '4つの ふだの ならびが くりかえされて いるよ。',
      '8まい ÷ 4まい を けいさんしよう。',
    ],
    explain: `4つの ふだの ならびが 2かい ならんでいるから、2かい くりかえす 命令《めいれい》に できるよ。`,
  }),
  num({
    id: 'sh-3',
    obj: 'short',
    level: 1,
    prompt: `${repText(4, FW(3), TR(90))}は\nふだ なんまい？（くりかえすも 1まい）`,
    answer: 3,
    label: 'まい',
    wrongs: [
      [2, 'count-card'],
      [4, 'count-card'],
      [8, 'count-card'],
    ],
    hints: [
      '「くりかえす」の ふだは 1まいだよ。',
      'なかに「すすむ」と「みぎに まがる」が あるね。',
      '1まい ＋ なかの ふだの 数《かず》 だよ。',
    ],
    explain: `「くりかえす」が 1まい、「すすむ」が 1まい、「みぎに まがる」が 1まいで、3まい。くりかえさずに ならべると 8まい いるね。`,
  }),
  num({
    id: 'sh-4',
    obj: 'short',
    level: 1,
    prompt: `${repText(4, FW(3), TR(90))}\nくりかえしを つかわずに ならべると、ふだは なんまい？`,
    answer: 8,
    label: 'まい',
    wrongs: [
      [4, 'count-card'],
      [3, 'count-card'],
      [2, 'count-card'],
    ],
    hints: [
      'くりかえす なかの ふだは なんまい あるかな。',
      'それを 4かい ぶん ならべるよ。',
      '2まい × 4かい を けいさんしよう。',
    ],
    explain: `なかの ふだが 2まいで、4かい くりかえすから、2 × 4 ＝ 8まい。くりかえしを つかうと 3まいで すむね。`,
  }),
  num({
    id: 'sh-5',
    obj: 'short',
    level: 1,
    prompt: `${SQN}を くりかえし なしで 8まい、\nくりかえしで 3まい。なんまい へるかな。`,
    answer: 5,
    label: 'まい',
    wrongs: [
      [3, 'count-card'],
      [8, 'count-card'],
      [11, 'count-card'],
    ],
    hints: [
      'くりかえし なしの ふだの 数《かず》から、くりかえしを つかった ふだの 数《かず》を ひこう。',
      '8まい から 3まい を ひくよ。',
      '8 － 3 を けいさんしよう。',
    ],
    explain: `8 － 3 ＝ 5。くりかえしを つかうと、ふだが 5まい へるね。そのぶん、まちがいも へらせるよ。`,
  }),
  num({
    id: 'sh-6',
    obj: 'short',
    level: 2,
    prompt: `${repText(4, FW(2), TR(90))}\nくりかえし なしで 書《か》くと「すすむ 2」は なんこ？`,
    answer: 4,
    label: 'こ',
    wrongs: [
      [2, 'count-wrong'],
      [8, 'count-wrong'],
      [1, 'repeat-body'],
    ],
    hints: [
      '「くりかえす」の なかの ならびを、くりかえす かいすう ぶん ならべよう。',
      '「すすむ 2、みぎに 90ど」を 4つ ならべるよ。',
      '「すすむ 2」は、1かいごとに 1こ でてくるよ。',
    ],
    explain: `「すすむ 2、みぎに 90ど」を 4つ ならべるから、「すすむ 2」も 4こ でてくるよ。`,
  }),
  choiceItem({
    id: 'sh-7',
    obj: 'short',
    level: 2,
    prompt: `${SQN}（へんの ながさ 5）を かく みじかい 命令《めいれい》は？`,
    right: repText(4, FW(5), TR(90)),
    wrongs: [
      [repText(2, FW(5), TR(90)), 'count-wrong'],
      [repText(4, FW(5)), 'repeat-body'],
    ],
    layout: 'column',
    hints: [
      `${SQN}の へんは いくつ あるかな。`,
      `ふだが すくなく、しかも ${SQN}を かける ものを さがそう。`,
      'くりかえす 数《かず》が へんの 数《かず》と あっているか たしかめよう。',
    ],
    explain: `${SQN}は へんが 4つ。「4かい くりかえす」で ふだが 3まいで かけるよ。2かいだと とじない 図形《ずけい》に なるよ。`,
  }),
  num({
    id: 'sh-8',
    obj: 'short',
    level: 2,
    prompt: `くりかえし なしだと ふだは 8まい。\n「2かい くりかえす」だと なんまい？`,
    figure: turtleFigure(RC(4, 2), '長方形《ちょうほうけい》', { grid: true, hU: 6 }),
    answer: 5,
    label: 'まい',
    wrongs: [
      [4, 'count-card'],
      [3, 'count-card'],
      [8, 'count-card'],
    ],
    hints: [
      'くりかえす なかには、どの ふだが はいるかな。',
      'ながい へんと みじかい へんを かく ふだが 4まい はいるよ。',
      '「くりかえす」の ふだ 1まいを たすのを わすれないでね。',
    ],
    explain: `なかに 4まい（すすむ、まがる、すすむ、まがる）と、「くりかえす」の ふだ 1まいで、5まい。8まいより 3まい へったね。`,
  }),
];
const shortMatches: Item[] = [
  matchItem({
    id: 'sh-alt-1',
    obj: 'short',
    level: 0,
    pairs: [
      { steps: SQ(3), text: repText(4, FW(3), TR(90)) },
      { steps: RC(4, 2), text: repText(2, FW(4), TR(90), FW(2), TR(90)) },
      { steps: SQ(2), text: repText(4, FW(2), TR(90)) },
    ],
    hints: [
      '図形《ずけい》ごとに、おなじ ならびが なんかい くりかえされるか 数《かぞ》えよう。',
      '正方形《せいほうけい》は へんが 4つ、長方形《ちょうほうけい》は 2つずつの くみが 2つ だよ。',
      'へんの ながさも あわせて みよう。',
    ],
    explain: `${SQN}は「すすむ、まがる」を 4かい、${RCN}は「ながい へん、みじかい へん」の ひとくみを 2かい くりかえすよ。`,
  }),
  matchItem({
    id: 'sh-alt-2',
    obj: 'short',
    level: 1,
    pairs: [
      { steps: SQ(4), text: repText(4, FW(4), TR(90)) },
      { steps: RC(5, 3), text: repText(2, FW(5), TR(90), FW(3), TR(90)) },
      { steps: RC(3, 5), text: repText(2, FW(3), TR(90), FW(5), TR(90)) },
    ],
    hints: [
      '図形《ずけい》の よこの ながさを、はじめに すすむ ながさと くらべよう。',
      'よこと たての ながさが ちがう 図形《ずけい》が 2つ あるよ。',
      '正方形《せいほうけい》は 4かい、長方形《ちょうほうけい》は 2かい くりかえすよ。',
    ],
    explain: `${SQN}は 4かい、${RCN}は 2かい くりかえすよ。はじめに すすむ ながさが よこの ながさだね。`,
  }),
  matchItem({
    id: 'sh-alt-3',
    obj: 'short',
    level: 2,
    pairs: [
      { steps: SQ(1), text: repText(4, FW(1), TR(90)) },
      { steps: RC(2, 1), text: repText(2, FW(2), TR(90), FW(1), TR(90)) },
      { steps: SQ(5), text: repText(4, FW(5), TR(90)) },
    ],
    extra: [repText(2, FW(1), TR(90), FW(2), TR(90))],
    hints: [
      '小《ちい》さい 図形《ずけい》から じゅんに 見《み》よう。',
      '4つの へんが おなじ ながさなら、正方形《せいほうけい》だよ。',
      'へんの ながさが ちがう 図形《ずけい》は、すすむ 数《かず》で 見《み》わけよう。',
    ],
    explain: `ながさ 1と 5の ${SQN}、よこ 2・たて 1の ${RCN}。はじめに すすむ ながさが よこの ながさだよ。`,
  }),
];

const items: Item[] = [
  ...squareItems,
  ...squareMatches,
  ...rectItems,
  ...rectMatches,
  ...shortItems,
  ...shortMatches,
];

export const drawShapes: UnitSpec = {
  ...baseUnit('g4.prog.draw-shapes', 'g4'),
  title: '命令《めいれい》で 図形《ずけい》を かこう',
  prereq: ['g3.prog.condition-combo'],
  objectives: [
    { id: 'square', title: `命令《めいれい》で ${SQN}を かく` },
    { id: 'rect', title: `命令《めいれい》で ${RCN}を かく` },
    { id: 'short', title: 'くりかえしで 命令《めいれい》を みじかく する' },
  ],
  misconceptions: [
    {
      id: 'angle-wrong',
      explain: `かどの ${ANGLE}を まちがえたのかな。${SQN}や ${RCN}の かどは ぜんぶ 90ど だよ。`,
    },
    {
      id: 'count-wrong',
      explain:
        'くりかえす かいすうを まちがえたのかな。図形《ずけい》の へんの 数《かず》や、ひとくみで かける へんの 数《かず》を 数《かぞ》えて たしかめよう。',
    },
    {
      id: 'side-wrong',
      explain:
        'へんの ながさを まちがえたのかな。「すすむ ◯」の 数《かず》が、へんの ながさだよ。よこと たてを わけて 見《み》よう。',
    },
    {
      id: 'open-shape',
      explain:
        'さいごまで かいていないのかな。もとの ばしょに もどって、図形《ずけい》が とじるまで くりかえそう。',
    },
    {
      id: 'repeat-body',
      explain:
        '「くりかえす」の なかの ふだが たりないのかな。すすむ ふだと まがる ふだを セットで くりかえそう。',
    },
    {
      id: 'count-card',
      explain:
        'ふだの 数《かず》の 数《かぞ》え方《かた》を まちがえたのかな。「くりかえす」の ふだも 1まいと 数《かぞ》えて、なかの ふだを たそう。',
    },
    {
      id: 'not-shortest',
      explain:
        'もっと みじかく できるのかも。おなじ ならびが つづく ところは「くりかえす」で まとめよう。',
    },
    {
      id: 'shape-changed',
      explain:
        '短《みじか》くは なったけれど、かける 図形《ずけい》が かわって いるよ。おなじ 図形《ずけい》を かける ことが 大《たい》せつだよ。',
    },
  ],
  levels: [
    { label: 'ずけいと めいれい', chance: 0.1 },
    { label: 'ながさと かくど', chance: 0.1 },
    { label: 'みじかい めいれい', chance: 0.1 },
  ],
  intro: [
    {
      text: '「すすむ 3」で 3だけ すすみ、「みぎに 90ど」で みぎを むくよ。この 命令《めいれい》を くりかえすと、図形《ずけい》が かけるよ。',
      figure: turtleFigure(SQ(3).slice(0, 4), 'すすむ 3、みぎに 90ど を 2かい', { grid: true }),
    },
    {
      text: `4かい くりかえすと、もとの ばしょに もどって ${SQN}が とじるよ。`,
      figure: turtleFigure(SQ(3), '正方形《せいほうけい》', { grid: true }),
    },
    {
      text: `${RCN}は、ながい へんと みじかい へんを ひとくみに して、2かい くりかえすよ。`,
      figure: turtleFigure(RC(4, 2), '長方形《ちょうほうけい》', { grid: true }),
    },
  ],
  source: { kind: 'items', items },
  basis:
    '小学校学習指導要領（平成29年告示）総則 第3の1(3)イ、算数 第4学年 B（正方形《せいほうけい》・長方形《ちょうほうけい》の性質）、小学校プログラミング教育の手引（第三版）。program エンジンは格子の上を動くだけなので、線《せん》の図《ず》は命令から計算した図《ず》で出題。学年の割当は本アプリの案',
  gradeIsAppProposal: true,
};
