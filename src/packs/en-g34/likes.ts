/**
 * g3.en.likes すきな もの（curriculum-matrix 3.6。外活34 聞く・やりとり）。設計書 docs/expansion/p2-design/en-g34.md の 1章。
 *   like: I like 〜. を聞いて絵を選ぶ／not: すき・すきではない／ask: たずねる・こたえる
 * 同一性キー: 形式 × 英文（場面ID）。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import { en, enText, listen, notHint, slugOf } from './lib';
import { NAMES } from './names';

const nm = (id: string): string => NAMES[id]!;
const pic = (id: string): ChoiceOption => ({ figure: { kind: 'illust', id }, label: nm(id) });

/** 「I like 〜.」の 語 → 絵（テストで 絵の取り違えを 確かめる） */
export const LIKE_WORDS: Record<string, string> = {
  apples: 'apple',
  bananas: 'banana',
  strawberries: 'strawberry',
  peaches: 'peach',
  tomatoes: 'tomato',
  carrots: 'carrot',
  cake: 'p5-cake',
  eggs: 'egg',
  dogs: 'dog',
  cats: 'cat',
  rabbits: 'rabbit',
  bears: 'bear',
  elephants: 'elephant',
  frogs: 'frog',
  trains: 'train',
  flowers: 'flower',
};

type Row = [word: string, correct: string, w1: string, m1: string, w2: string, m2: string];
const LIKE_ROWS: Row[] = [
  ['apples', 'apple', 'airplane', 'same-start', 'ant', 'same-start'],
  ['bananas', 'banana', 'bear', 'same-start', 'p5-book', 'same-start'],
  ['strawberries', 'strawberry', 'p23-star', 'same-start', 'p23-spoon', 'same-start'],
  ['peaches', 'peach', 'p23-pig', 'same-start', 'pencil', 'same-start'],
  ['tomatoes', 'tomato', 'train', 'same-start', 'peach', 'same-group'],
  ['carrots', 'carrot', 'cat', 'same-start', 'car-red', 'same-start'],
  ['cake', 'p5-cake', 'cow', 'same-start', 'cat', 'same-start'],
  ['eggs', 'egg', 'elephant', 'same-start', 'bread', 'same-group'],
  ['dogs', 'dog', 'p23-duck', 'same-start', 'cat', 'same-group'],
  ['cats', 'cat', 'carrot', 'same-start', 'cow', 'same-start'],
  ['rabbits', 'rabbit', 'p5-rocket', 'same-start', 'p5-ribbon', 'same-start'],
  ['bears', 'bear', 'banana', 'same-start', 'bird', 'same-start'],
  ['elephants', 'elephant', 'egg', 'same-start', 'monkey', 'same-group'],
  ['frogs', 'frog', 'fox', 'same-start', 'rabbit', 'same-group'],
  ['trains', 'train', 'turtle', 'same-start', 'airplane', 'same-group'],
  ['flowers', 'flower', 'fox', 'same-start', 'frog', 'same-start'],
];

function likeItems(): Item[] {
  return LIKE_ROWS.map(([word, c, w1, m1, w2, m2]) => {
    const text = `I like ${word}.`;
    return listen({
      id: `like:${slugOf(text)}`,
      objective: 'like',
      level: 0,
      prompt: '聞《き》こえた 人《ひと》の すきな ものは どれ？',
      audio: en('like', text),
      options: [
        { ...pic(c), correct: true },
        { ...pic(w1), misconception: m1 },
        { ...pic(w2), misconception: m2 },
      ],
      hints: [
        'さいごの ことばが すきな ものだよ。「もういちど きく」で なんども 聞《き》けるよ。',
        'はじめの 音《おと》が にている ものが あるよ。ことばの うしろの ほうも 聞《き》こう。',
        notHint(nm(w1)),
      ],
      explain: `「${nm(c)}が すき」と いって います。`,
      explainFigure: enText(text),
      identity: `like:${slugOf(text)}`,
    });
  });
}

/** like の別例: やりとりの中で 聞いて、ことばを 選ぶ */
const LIKE_QA: [word: string, ja: string, w1: string, w2: string][] = [
  ['rabbits', 'rabbit', 'p5-rocket', 'p5-ribbon'],
  ['peaches', 'peach', 'p23-pig', 'pencil'],
  ['trains', 'train', 'turtle', 'airplane'],
  ['carrots', 'carrot', 'cat', 'car-red'],
  ['bears', 'bear', 'banana', 'bird'],
];
const LIKE_QA_MIS2: Record<string, string> = { airplane: 'same-group' };

function likeQaItems(): Item[] {
  return LIKE_QA.map(([word, c, w1, w2]) => {
    const text = `I like ${word}.`;
    return listen({
      id: `like-qa:${slugOf(text)}`,
      objective: 'like',
      level: 0,
      prompt: 'たずねて、こたえて いるよ。こたえた 人《ひと》の すきな ものは？',
      audio: [en('like', 'What do you like?'), en('like', text)],
      gapMs: 800,
      options: [
        { label: nm(c), correct: true },
        { label: nm(w1), misconception: 'same-start' },
        { label: nm(w2), misconception: LIKE_QA_MIS2[w2] ?? 'same-start' },
      ],
      hints: [
        'あとの ほうの こたえを よく 聞《き》こう。',
        'こたえの さいごの ことばが すきな ものだよ。',
        notHint(nm(w1)),
      ],
      explain: `「なにが すき？」と たずねて、「${nm(c)}が すき」と こたえて います。`,
      explainFigure: enText(`What do you like?  →  ${text}`, 'm'),
      identity: `like-qa:${slugOf(text)}`,
      alt: true,
    });
  });
}

/** not 1〜8: 1文を 聞いて、ことばで 選ぶ */
const NOT_ROWS: [word: string, ja: string, neg: boolean, other: string][] = [
  ['carrots', 'にんじん', true, 'ねこ'],
  ['peaches', 'もも', false, 'ぶた'],
  ['frogs', 'かえる', true, 'きつね'],
  ['strawberries', 'いちご', false, 'ほし'],
  ['tomatoes', 'トマト', true, 'でんしゃ'],
  ['cats', 'ねこ', false, 'にんじん'],
  ['bears', 'くま', true, 'バナナ'],
  ['eggs', 'たまご', true, 'ぞう'],
];
const likeLabel = (ja: string, neg: boolean) => `${ja}が ${neg ? 'すきではない' : 'すき'}`;

function notItems(): Item[] {
  const out: Item[] = NOT_ROWS.map(([word, ja, neg, other]) => {
    const text = neg ? `I don't like ${word}.` : `I like ${word}.`;
    return listen({
      id: `not:${slugOf(text)}`,
      objective: 'not',
      level: 1,
      prompt: '聞《き》こえた 文《ぶん》の いみは どれ？',
      audio: en('like', text),
      options: [
        { label: likeLabel(ja, neg), correct: true },
        { label: likeLabel(ja, !neg), misconception: 'dont-mix' },
        { label: likeLabel(other, neg), misconception: 'same-start' },
      ],
      hints: [
        'さいごの ことばで「なにが」、まえの ほうで「すきか どうか」が わかるよ。',
        'すきではない ときは、「すき」の ことばの まえに もう ひとつ ことばが 入《はい》るよ。',
        notHint(likeLabel(other, neg)),
      ],
      explain: neg
        ? `「すき」の まえに ことばが 1つ あるので、「${ja}が すきではない」と いう いみです。`
        : `「${ja}が すき」と いって います。`,
      explainFigure: enText(text),
      identity: `not:${slugOf(text)}`,
    });
  });
  // 9〜10: 2つの 文を 聞いて、すきな ものの 絵を 選ぶ
  const two: [first: string, second: string, c: string, mix: string, other: string][] = [
    ['I like dogs.', "I don't like cats.", 'dog', 'cat', 'p23-duck'],
    ["I don't like tomatoes.", 'I like carrots.', 'carrot', 'tomato', 'cat'],
  ];
  const nameOf = (s: string): string => nm(LIKE_WORDS[/like (\w+)\./.exec(s)![1]!] ?? '');
  for (const [a, b, c, mix, other] of two) {
    const likedFirst = !a.includes("don't");
    const A = nameOf(likedFirst ? a : b);
    const B = nameOf(likedFirst ? b : a);
    out.push(
      listen({
        id: `not-two:${slugOf(a)}`,
        objective: 'not',
        level: 1,
        prompt: '2つの 文《ぶん》を 聞《き》こう。この 人《ひと》が すきな ものは どれ？',
        audio: [en('like', a), en('like', b)],
        gapMs: 800,
        options: [
          { ...pic(c), correct: true },
          { ...pic(mix), misconception: 'dont-mix' },
          { ...pic(other), misconception: 'same-start' },
        ],
        hints: [
          '2つの 文《ぶん》の、どちらが「すき」で どちらが「すきではない」かを 聞《き》こう。',
          '「すき」の まえに ことばが ある 文《ぶん》は、すきではない ものだよ。',
          notHint(nm(other)),
        ],
        explain: `「${A}が すき」「${B}が すきではない」と いって います。すきな ものは ${A}です。`,
        explainFigure: enText(`${a}  ${b}`, 'm'),
        identity: `not-two:${slugOf(a)}`,
      }),
    );
  }
  return out;
}

/** not の別例: ○と×の 絵で 選ぶ */
const MARK_ROWS: [word: string, c: string, neg: boolean, other: string][] = [
  ['rabbits', 'rabbit', true, 'p5-rocket'],
  ['bananas', 'banana', false, 'bear'],
  ['dogs', 'dog', true, 'p23-duck'],
  ['apples', 'apple', false, 'airplane'],
];
const mark = (id: string, neg: boolean): ChoiceOption => ({
  figure: { kind: 'illust', id },
  label: `${nm(id)} ${neg ? '×' : '○'}`,
});

function markItems(): Item[] {
  return MARK_ROWS.map(([word, c, neg, other]) => {
    const text = neg ? `I don't like ${word}.` : `I like ${word}.`;
    return listen({
      id: `not-mark:${slugOf(text)}`,
      objective: 'not',
      level: 1,
      prompt: '○は すき、×は すきではない。聞《き》こえた 文《ぶん》に あうのは どれ？',
      audio: en('like', text),
      options: [
        { ...mark(c, neg), correct: true },
        { ...mark(c, !neg), misconception: 'dont-mix' },
        { ...mark(other, neg), misconception: 'same-start' },
      ],
      hints: [
        'さいごの ことばで「なにが」が わかるよ。',
        '「すき」の ことばの まえに、もう ひとつ 音《おと》が あったかな。',
        notHint(`${nm(other)} ${neg ? '×' : '○'}`),
      ],
      explain: neg
        ? `「${nm(c)}が すきではない」なので × です。`
        : `「${nm(c)}が すき」なので ○ です。`,
      explainFigure: enText(text),
      identity: `not-mark:${slugOf(text)}`,
      alt: true,
    });
  });
}

/** ask: 8場面（問い・こたえ・場面） */
const ASK_ROWS: {
  scene: string;
  prompt: string;
  word: string;
  ja: string;
  yes: boolean;
  other: string;
}[] = [
  {
    scene: 'zoo',
    prompt: 'どうぶつえん',
    word: 'elephants',
    ja: 'ぞう',
    yes: true,
    other: 'たまご',
  },
  {
    scene: 'fruit-shop',
    prompt: 'くだものやさん',
    word: 'peaches',
    ja: 'もも',
    yes: false,
    other: 'ぶた',
  },
  {
    scene: 'lunch',
    prompt: 'きゅうしょくの 時間《じかん》',
    word: 'carrots',
    ja: 'にんじん',
    yes: false,
    other: 'ねこ',
  },
  { scene: 'park', prompt: 'こうえん', word: 'dogs', ja: 'いぬ', yes: true, other: 'あひる' },
  { scene: 'station', prompt: 'えき', word: 'trains', ja: 'でんしゃ', yes: true, other: 'かめ' },
  {
    scene: 'birthday',
    prompt: 'たんじょう日《び》の パーティー',
    word: 'cake',
    ja: 'ケーキ',
    yes: true,
    other: 'うし',
  },
  {
    scene: 'flower-field',
    prompt: 'はなばたけ',
    word: 'flowers',
    ja: 'はな',
    yes: false,
    other: 'きつね',
  },
  {
    scene: 'pond',
    prompt: 'いけの そば',
    word: 'frogs',
    ja: 'かえる',
    yes: false,
    other: 'きつね',
  },
];

function askItems(): Item[] {
  return ASK_ROWS.map((r) => {
    const q = `Do you like ${r.word}?`;
    const a = r.yes ? 'Yes, I do.' : "No, I don't.";
    return listen({
      id: `ask:${r.scene}`,
      objective: 'ask',
      level: 2,
      prompt: `${r.prompt}で 話《はな》して いるよ。こたえた 人《ひと》の きもちは？`,
      audio: [en('likeq', q), en('reply', a)],
      gapMs: 800,
      options: [
        { label: likeLabel(r.ja, !r.yes), correct: true },
        { label: likeLabel(r.ja, r.yes), misconception: 'yes-no' },
        { label: likeLabel(r.other, !r.yes), misconception: 'same-start' },
      ],
      hints: [
        'さいしょは たずねる 文《ぶん》、あとが こたえだよ。',
        'たずねる 文《ぶん》の さいごの ことばが「なにが」だよ。こたえの さいしょの ことばが「はい」か「いいえ」だよ。',
        notHint(likeLabel(r.other, !r.yes)),
      ],
      explain: r.yes
        ? `「${r.ja}が すきですか」と たずねて、「はい、すきです」と こたえて います。`
        : `「${r.ja}が すきですか」と たずねて、「いいえ、すきではありません」と こたえて います。`,
      explainFigure: enText(`${q}  →  ${a}`, 'm'),
      identity: `ask:${r.scene}`,
    });
  });
}

/** ask の別例: 問いだけを 聞いて、文の 種類を 選ぶ */
const ASKQ_ROWS: [word: string, ja: string, other: string][] = [
  ['apples', 'りんご', 'ひこうき'],
  ['cats', 'ねこ', 'にんじん'],
  ['bananas', 'バナナ', 'くま'],
  ['rabbits', 'うさぎ', 'ロケット'],
];

function askQItems(): Item[] {
  return ASKQ_ROWS.map(([word, ja, other]) => {
    const q = `Do you like ${word}?`;
    return listen({
      id: `ask-q:${slugOf(q)}`,
      objective: 'ask',
      level: 2,
      prompt: '聞《き》こえた 文《ぶん》は どんな 文《ぶん》？',
      audio: en('likeq', q),
      options: [
        { label: `${ja}が すき？と きいた`, correct: true },
        { label: `${ja}が すきと いった`, misconception: 'ask-tell' },
        { label: `${other}が すき？と きいた`, misconception: 'same-start' },
      ],
      hints: [
        'はじめの ことばを よく 聞《き》こう。',
        'たずねる 文《ぶん》は、はじめの ことばと、さいごの 音《おと》の 上《あ》がりかたで わかるよ。',
        notHint(`${other}が すき？と きいた`),
      ],
      explain: `「${ja}が すきですか」と たずねる 文《ぶん》です。こたえる ときは「はい」か「いいえ」で いうよ。`,
      explainFigure: enText(q),
      identity: `ask-q:${slugOf(q)}`,
      alt: true,
    });
  });
}

export const likes: UnitSpec = {
  id: 'g3.en.likes',
  title: 'すきな もの',
  stage: 'g3',
  subject: 'en',
  domain: 'en',
  kind: 'knowledge',
  priority: 'P2',
  status: 'ready',
  icon: 'strawberry',
  prereq: ['g3.en.greetings'],
  objectives: [
    { id: 'like', title: 'すきな ものを 聞《き》きとる' },
    { id: 'not', title: 'すき・すきではないを 聞《き》きわける' },
    { id: 'ask', title: 'すきか たずねる・こたえる やりとりが わかる' },
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
        'おなじ なかま（たべもの・どうぶつ・のりもの）なら おなじだと かんがえたのかな。聞《き》こえた ことばの 音《おと》を たしかめよう。',
    },
    {
      id: 'dont-mix',
      explain:
        '「すき」と「すきではない」を おなじだと かんがえたのかな。「すき」の ことばの まえに、もう ひとつ 音《おと》が あったか 聞《き》こう。',
    },
    {
      id: 'yes-no',
      explain:
        '「はい」と「いいえ」の こたえを 反対《はんたい》に かんがえたのかな。こたえの さいしょの ことばを よく 聞《き》こう。',
    },
    {
      id: 'ask-tell',
      explain:
        'たずねて いる 文《ぶん》を、「すきだ」と いって いる 文《ぶん》だと かんがえたのかな。はじめの ことばと、さいごの 音《おと》の 上《あ》がりかたを 聞《き》こう。',
    },
  ],
  levels: [
    { label: 'すきな もの', chance: 0.05 },
    { label: 'すき・すきではない', chance: 0.05 },
    { label: 'たずねる・こたえる', chance: 0.05 },
  ],
  intro: [
    {
      text: 'すきな ものを いう 文《ぶん》を 聞《き》いて、えらぶよ。',
      figure: enText('I like bananas.', 'xl'),
    },
    {
      text: 'さいごの ことばが すきな もの。これは「バナナが すき」と いう いみだよ。',
      figure: { kind: 'illust', id: 'banana' },
    },
    {
      text: 'すきではない ときは、すきの まえに ことばが 1つ ふえるよ。聞《き》いたら まねして いって みよう（こたえあわせは しないよ）。',
      figure: enText("I don't like bananas.", 'l'),
    },
  ],
  source: {
    kind: 'items',
    items: [
      ...likeItems(),
      ...likeQaItems(),
      ...notItems(),
      ...markItems(),
      ...askItems(),
      ...askQItems(),
    ],
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）外国語活動 第3・4学年 聞くこと（身近で簡単な事柄に関する基本的な表現の意味が分かる）・話すこと［やり取り］（質問をしたり質問に答えたりする。本アプリは聞き取りだけを扱い、話すことは評価しない）。好みを伝え合う表現',
  gradeIsAppProposal: true,
  revised: '2026-10-30',
};
