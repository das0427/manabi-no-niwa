/**
 * g4.en.want ほしい もの（かいもの）（curriculum-matrix 3.7。外活34 聞く）。設計書 docs/expansion/p2-design/en-g34.md の 2章。
 *   want: I want a 〜. を聞いて絵を選ぶ／count: かずと もの／shop: かいものの やりとり
 * 同一性キー: 形式 × 英文（場面ID）。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { en, enText, listen, notHint, slugOf } from './lib';
import { NAMES } from './names';

const nm = (id: string): string => NAMES[id]!;
const pic = (id: string): ChoiceOption => ({ figure: { kind: 'illust', id }, label: nm(id) });
const many = (id: string, count: number): Figure => ({ kind: 'illust', id, count });
const manyOpt = (id: string, count: number): ChoiceOption => ({ figure: many(id, count) });

// ---- want: I want a 〜. ----
type WantRow = [text: string, c: string, w1: string, m1: string, w2: string, m2: string];
const WANT_ROWS: WantRow[] = [
  ['I want a banana.', 'banana', 'bread', 'same-start', 'lemon', 'same-group'],
  ['I want an apple.', 'apple', 'peach', 'same-group', 'banana', 'same-group'],
  // 設計書の ピーマン（英語は green pepper で、はじめの 音が peach と にていない）を えんぴつに かえた（レビュー）
  ['I want a peach.', 'peach', 'pencil', 'same-start', 'apple', 'same-group'],
  ['I want a lemon.', 'lemon', 'peach', 'same-group', 'banana', 'same-group'],
  ['I want a tomato.', 'tomato', 'eggplant', 'same-group', 'carrot', 'same-group'],
  ['I want a carrot.', 'carrot', 'cucumber', 'same-start', 'p5-cake', 'same-start'],
  ['I want a cucumber.', 'cucumber', 'carrot', 'same-start', 'eggplant', 'same-group'],
  ['I want an egg.', 'egg', 'eggplant', 'same-start', 'onigiri', 'same-group'],
];

function wantItems(): Item[] {
  return WANT_ROWS.map(([text, c, w1, m1, w2, m2]) =>
    listen({
      id: `want:${slugOf(text)}`,
      objective: 'want',
      level: 0,
      prompt: '聞《き》こえた 人《ひと》が ほしい ものは どれ？',
      audio: en('want', text),
      options: [
        { ...pic(c), correct: true },
        { ...pic(w1), misconception: m1 },
        { ...pic(w2), misconception: m2 },
      ],
      hints: [
        'さいごの ことばが「ほしい もの」だよ。',
        'はじめの 音《おと》が にている もの、おなじ なかまの ものが あるよ。',
        notHint(nm(w1)),
      ],
      explain: `「${nm(c)}が 1つ ほしい」と いって います。`,
      explainFigure: enText(text),
      identity: `want:${slugOf(text)}`,
    }),
  );
}

const WORD_ROWS: [text: string, ja: string, other: string][] = [
  ['I want a banana.', 'バナナ', 'パン'],
  ['I want a carrot.', 'にんじん', 'きゅうり'],
  ['I want an egg.', 'たまご', 'なす'],
  ['I want a peach.', 'もも', 'えんぴつ'],
];

function wantWordItems(): Item[] {
  return WORD_ROWS.map(([text, ja, other]) =>
    listen({
      id: `want-word:${slugOf(text)}`,
      objective: 'want',
      level: 0,
      prompt: '聞《き》こえた 文《ぶん》の いみは どれ？',
      audio: en('want', text),
      options: [
        { label: `${ja}が ほしい`, correct: true },
        { label: `${ja}が すき`, misconception: 'like-want' },
        { label: `${other}が ほしい`, misconception: 'same-start' },
      ],
      hints: [
        'まんなかの ことばが「すき」か「ほしい」かを 聞《き》こう。',
        'さいごの ことばが「なにが」だよ。',
        notHint(`${other}が ほしい`),
      ],
      explain: `「${ja}が ほしい」と いって います。「すき」と いう ときの ことばとは ちがうね。`,
      explainFigure: enText(text),
      identity: `want-word:${slugOf(text)}`,
      alt: true,
    }),
  );
}

// ---- count: かずと もの ----
export const NUMBER_WORDS = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
];

type CountRow = [n: number, plural: string, c: string, numWrong: number, mixId: string];
const COUNT_ROWS: CountRow[] = [
  [2, 'bananas', 'banana', 3, 'lemon'],
  [3, 'apples', 'apple', 2, 'peach'],
  [4, 'tomatoes', 'tomato', 5, 'eggplant'],
  [5, 'lemons', 'lemon', 4, 'banana'],
  [6, 'carrots', 'carrot', 7, 'cucumber'],
  [7, 'strawberries', 'strawberry', 6, 'peach'],
  [8, 'eggs', 'egg', 6, 'lemon'],
  [9, 'peaches', 'peach', 5, 'apple'],
  [10, 'cucumbers', 'cucumber', 2, 'carrot'],
  [2, 'eggplants', 'eggplant', 3, 'tomato'],
];

function countItems(): Item[] {
  return COUNT_ROWS.map(([n, plural, c, nw, mix]) => {
    const text = `I want ${NUMBER_WORDS[n]} ${plural}.`;
    return listen({
      id: `count:${slugOf(text)}`,
      objective: 'count',
      level: 1,
      prompt: '聞《き》こえた 人《ひと》が ほしい ものは どれ？ かずも 聞《き》こう。',
      audio: en('want', text),
      options: [
        { ...manyOpt(c, n), correct: true },
        { ...manyOpt(c, nw), misconception: 'num-sound' },
        { ...manyOpt(mix, n), misconception: 'item-mix' },
      ],
      layout: 'column',
      hints: [
        'まんなかの かずの ことばを よく 聞《き》こう。',
        'かずの ことばの あとに、ものの ことばが あるよ。',
        `「${nm(mix)}」の 絵《え》では ないよ。かずを もういちど 聞《き》こう。`,
      ],
      explain: `「${nm(c)}が ${n}こ ほしい」と いって います。`,
      explainFigure: enText(text),
      identity: `count:${slugOf(text)}`,
    });
  });
}

const COUNTW_ROWS: [text: string, ja: string, n: number, nw: number, mixJa: string][] = [
  ['I want four tomatoes.', 'トマト', 4, 5, 'なす'],
  ['I want six carrots.', 'にんじん', 6, 7, 'きゅうり'],
  ['I want eight eggs.', 'たまご', 8, 6, 'レモン'],
  ['I want three peaches.', 'もも', 3, 2, 'りんご'],
];

function countWordItems(): Item[] {
  return COUNTW_ROWS.map(([text, ja, n, nw, mixJa]) =>
    listen({
      id: `count-word:${slugOf(text)}`,
      objective: 'count',
      level: 1,
      prompt: '聞《き》こえた 文《ぶん》に あうのは どれ？',
      audio: en('want', text),
      options: [
        { label: `${ja} ${n}こ`, correct: true },
        { label: `${ja} ${nw}こ`, misconception: 'num-sound' },
        { label: `${mixJa} ${n}こ`, misconception: 'item-mix' },
      ],
      hints: [
        'かずの ことばと、ものの ことばを 聞《き》こう。',
        'かずの すぐ あとの ことばが、ほしい ものだよ。',
        notHint(`${mixJa} ${n}こ`),
      ],
      explain: `「${ja}が ${n}こ ほしい」と いって います。`,
      explainFigure: enText(text),
      identity: `count-word:${slugOf(text)}`,
      alt: true,
    }),
  );
}

// ---- shop: かいものの やりとり ----
interface ShopRow {
  scene: string;
  prompt: string;
  say: string[];
  c: string;
  n: number;
  nw: number;
  mix: string;
}
const SHOP_ROWS: ShopRow[] = [
  {
    scene: 'fruit-shop',
    prompt: 'くだものやさん',
    say: ['What do you want?', 'Apples, please.', 'How many?', 'Six, please.'],
    c: 'apple',
    n: 6,
    nw: 7,
    mix: 'peach',
  },
  {
    scene: 'vegetable-shop',
    prompt: 'やおやさん',
    say: ['What do you want?', 'Carrots, please.', 'How many?', 'Three, please.'],
    c: 'carrot',
    n: 3,
    nw: 2,
    mix: 'cucumber',
  },
  {
    scene: 'supermarket',
    prompt: 'スーパー',
    say: ['How many tomatoes do you want?', 'Two, please.'],
    c: 'tomato',
    n: 2,
    nw: 3,
    mix: 'eggplant',
  },
  {
    scene: 'morning-market',
    prompt: 'あさいち',
    say: ['What do you want?', 'I want seven bananas.'],
    c: 'banana',
    n: 7,
    nw: 6,
    mix: 'lemon',
  },
  {
    scene: 'pretend-shop',
    prompt: 'おみせやさんごっこ',
    say: ['What do you want?', 'I want ten eggs.'],
    c: 'egg',
    n: 10,
    nw: 2,
    mix: 'eggplant',
  },
  {
    scene: 'fruit-stand',
    prompt: 'くだものの やたい',
    say: ['How many lemons do you want?', 'Nine, please.'],
    c: 'lemon',
    n: 9,
    nw: 5,
    mix: 'banana',
  },
  {
    scene: 'station-shop',
    prompt: 'えきまえの おみせ',
    say: ['What do you want?', 'Peaches, please.', 'How many?', 'Five, please.'],
    c: 'peach',
    n: 5,
    nw: 4,
    mix: 'apple',
  },
  {
    scene: 'farm-stand',
    prompt: 'はたけの そばの おみせ',
    say: ['How many cucumbers do you want?', 'Four, please.'],
    c: 'cucumber',
    n: 4,
    nw: 5,
    mix: 'carrot',
  },
];

function shopItems(): Item[] {
  return SHOP_ROWS.map((r) =>
    listen({
      id: `shop:${r.scene}`,
      objective: 'shop',
      level: 2,
      prompt: `${r.prompt}の かいもの。おきゃくさんが かう ものは どれ？`,
      audio: r.say.map((s) => en(s.startsWith('I want') ? 'want' : 'shop', s)),
      gapMs: 800,
      options: [
        { ...manyOpt(r.c, r.n), correct: true },
        { ...manyOpt(r.c, r.nw), misconception: 'num-sound' },
        { ...manyOpt(r.mix, r.n), misconception: 'item-mix' },
      ],
      layout: 'column',
      hints: [
        'おみせの 人《ひと》の しつもんと、おきゃくさんの こたえを 聞《き》こう。',
        'なにが ほしいかと、いくつ ほしいかの 2つを 聞《き》きとろう。',
        `「${nm(r.mix)}」の 絵《え》では ないよ。かずを もういちど 聞《き》こう。`,
      ],
      // おきゃくさんの こたえが I want 〜. の ときは「ほしい」、〜, please. の ときは「ください」
      explain: r.say.some((s) => s.startsWith('I want'))
        ? `おきゃくさんは「${nm(r.c)}が ${r.n}こ ほしい」と いって います。`
        : `おきゃくさんは「${nm(r.c)}を ${r.n}こ ください」と いって います。`,
      explainFigure: enText(r.say.join('  →  '), 'm'),
      identity: `shop:${r.scene}`,
    }),
  );
}

type Pair = [id: string, n: number];
const TWO_ROWS: [text: string, a: Pair, b: Pair, mixB: string][] = [
  ['I want two apples and three bananas.', ['apple', 2], ['banana', 3], 'lemon'],
  ['I want four tomatoes and two carrots.', ['tomato', 4], ['carrot', 2], 'eggplant'],
  ['I want five eggs and one lemon.', ['egg', 5], ['lemon', 1], 'banana'],
  ['I want three peaches and six strawberries.', ['peach', 3], ['strawberry', 6], 'apple'],
];
const pairFig = (a: Pair, b: Pair): ChoiceOption => ({
  figure: { kind: 'row', items: [many(a[0], a[1]), many(b[0], b[1])] },
});

function shopTwoItems(): Item[] {
  return TWO_ROWS.map(([text, a, b, mixB]) =>
    listen({
      id: `shop-two:${slugOf(text)}`,
      objective: 'shop',
      level: 2,
      prompt: '2しゅるいの ものを たのんで いるよ。かう ものは どれ？',
      audio: en('want', text),
      options: [
        { ...pairFig(a, b), correct: true },
        { ...pairFig([a[0], b[1]], [b[0], a[1]]), misconception: 'swap-count' },
        { ...pairFig(a, [mixB, b[1]]), misconception: 'item-mix' },
      ],
      layout: 'column',
      hints: [
        '「と」に あたる ことばの まえと あとで、2つの ものを いって いるよ。',
        'かずの すぐ あとの ことばが、その かずの ものだよ。',
        `${nm(a[0])}は ${a[1]}こ だよ。もう 1つの ものを 聞《き》こう。`,
      ],
      explain: `「${nm(a[0])}を ${a[1]}こと、${nm(b[0])}を ${b[1]}こ ほしい」と いって います。`,
      explainFigure: enText(text, 'm'),
      identity: `shop-two:${slugOf(text)}`,
      alt: true,
    }),
  );
}

export const want: UnitSpec = {
  id: 'g4.en.want',
  title: 'ほしい もの（かいもの）',
  stage: 'g4',
  subject: 'en',
  domain: 'en',
  kind: 'knowledge',
  priority: 'P2',
  status: 'ready',
  icon: 'mode-shopping',
  prereq: ['g3.en.likes'],
  objectives: [
    { id: 'want', title: 'ほしい ものを 聞《き》きとる' },
    { id: 'count', title: 'ほしい かずと ものを 聞《き》きとる' },
    { id: 'shop', title: 'かいものの やりとりが わかる' },
  ],
  misconceptions: [
    {
      id: 'same-start',
      explain:
        'はじめの 音《おと》が にている ことばと おなじだと かんがえたのかな。ことばの さいごまで 聞《き》こう。',
    },
    {
      id: 'same-group',
      explain:
        'おなじ なかまの たべものなら おなじだと かんがえたのかな。聞《き》こえた ことばの 音《おと》を たしかめよう。',
    },
    {
      id: 'like-want',
      explain: '「すき」と「ほしい」を おなじだと かんがえたのかな。まんなかの ことばが ちがうよ。',
    },
    {
      id: 'num-sound',
      explain:
        '音《おと》が にている かずと おなじだと かんがえたのかな。かずの ことばを もういちど 聞《き》こう。',
    },
    {
      id: 'item-mix',
      explain:
        'かずは あって いるね。ものの ことばも おなじだと かんがえたのかな。ほしい ものの ことばを 聞《き》こう。',
    },
    {
      id: 'swap-count',
      explain:
        'かずと ものの くみあわせを 入《い》れかえて かんがえたのかな。かずの すぐ あとの ことばが、その かずの ものだよ。',
    },
  ],
  levels: [
    { label: 'ほしい もの', chance: 0.05 },
    { label: 'かずと もの', chance: 0.05 },
    { label: 'かいものの やりとり', chance: 0.05 },
  ],
  intro: [
    {
      text: 'ほしい ものを いう 文《ぶん》を 聞《き》いて えらぶよ。',
      figure: enText('I want two apples.', 'xl'),
    },
    {
      text: 'かずの ことばの あとに、ほしい ものが くるよ。これは「りんごが 2こ ほしい」。',
      figure: { kind: 'illust', id: 'apple', count: 2 },
    },
    {
      text: 'おみせでは、ほしい ものと かずを たずねられるよ。聞《き》いたら まねして いって みよう（こたえあわせは しないよ）。',
      figure: enText('What do you want?  →  Apples, please.', 'm'),
    },
  ],
  source: {
    kind: 'items',
    items: [
      ...wantItems(),
      ...wantWordItems(),
      ...countItems(),
      ...countWordItems(),
      ...shopItems(),
      ...shopTwoItems(),
    ],
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）外国語活動 第3・4学年 聞くこと（身近で簡単な事柄に関する基本的な表現の意味が分かる）。言語の使用場面の例「買物」。数（1〜10）は g3.en.numbers-colors で学んだ範囲',
  gradeIsAppProposal: true,
  revised: '2026-10-30',
};
