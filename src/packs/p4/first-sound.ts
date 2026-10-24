/**
 * p4.ja.first-sound はじめの おと（curriculum-matrix 3.2・4.1）: 語頭音に気付く。
 * 段階0: 絵の2択（文字なし。「〇〇と おなじ おとで はじまるのは？」）
 * 段階1: はじめの おとの 字を 2択（v1 の H3 に当たる）。段階2: 字の 3択。
 * v1 の ひらがな（kana）スキルから分けた単元なので、進度は新しく始める（統括の判断6）。
 * 同一性キー: 問う語（＋問い方）。誤りの選択肢だけ違うものは同じ（1.4）。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import { ill, listenItem, mix, others } from './lib';

interface Word {
  illust: string;
  name: string;
}
const W = (illust: string, name: string): Word => ({ illust, name });
const head = (w: Word) => [...w.name][0]!;

/** 絵のある語（ひらがなで書く。はじめの字が 清音・濁音・半濁音 のもの） */
const WORDS: Word[] = [
  W('dog', 'いぬ'),
  W('strawberry', 'いちご'),
  W('rock', 'いし'),
  W('rabbit', 'うさぎ'),
  W('cow', 'うし'),
  W('turtle', 'かめ'),
  W('frog', 'かえる'),
  W('umbrella', 'かさ'),
  W('fox', 'きつね'),
  W('tree', 'き'),
  W('bear', 'くま'),
  W('car-red', 'くるま'),
  W('monkey', 'さる'),
  W('watermelon', 'すいか'),
  W('octopus', 'たこ'),
  W('egg', 'たまご'),
  W('bird', 'とり'),
  W('tomato', 'とまと'),
  W('eggplant', 'なす'),
  W('carrot', 'にんじん'),
  W('cat', 'ねこ'),
  W('scissors', 'はさみ'),
  W('flower', 'はな'),
  W('leaf', 'はっぱ'),
  W('chick', 'ひよこ'),
  W('airplane', 'ひこうき'),
  W('ship', 'ふね'),
  W('mikan', 'みかん'),
  W('peach', 'もも'),
  W('apple', 'りんご'),
  W('lemon', 'れもん'),
  W('onigiri', 'おにぎり'),
  W('pencil', 'えんぴつ'),
  W('ant', 'あり'),
  W('elephant', 'ぞう'),
  W('banana', 'ばなな'),
  W('bus-yellow', 'ばす'),
  W('bread', 'ぱん'),
  W('train', 'でんしゃ'),
  W('bicycle', 'じてんしゃ'),
];
const byName = (n: string) => WORDS.find((w) => w.name === n)!;

/** 同じ音で はじまる組（段階0: 絵の2択） */
const SAME: [string, string][] = [
  ['いぬ', 'いちご'],
  ['いちご', 'いし'],
  ['うさぎ', 'うし'],
  ['かめ', 'かえる'],
  ['かえる', 'かさ'],
  ['きつね', 'き'],
  ['くま', 'くるま'],
  ['たこ', 'たまご'],
  ['とり', 'とまと'],
  ['はさみ', 'はな'],
  ['はな', 'はっぱ'],
  ['ひよこ', 'ひこうき'],
  ['ばなな', 'ばす'],
];

function sameItem(a: string, b: string, alt: boolean): Item {
  const t = byName(a);
  const c = byName(b);
  const [wrong] = others(`same:${a}`, WORDS, c, 1, (x) => head(x) !== head(t));
  const id = `${alt ? 'sound' : 'same'}:${a}:${b}`;
  return listenItem({
    id,
    objective: 'same',
    level: 0,
    alt,
    prompt: alt
      ? 'この おとで はじまるのは どっち？'
      : `「${t.name}」と おなじ おとで はじまるのは どっち？`,
    figure: alt ? undefined : ill(t.illust),
    audio: { text: alt ? head(t) : t.name },
    hints: [
      'ことばの いちばん はじめの おとを ゆっくり いって みよう。',
      `はじめの おとは「${head(t)}」だよ。`,
    ],
    explain: `「${t.name}」と「${c.name}」は どちらも「${head(t)}」で はじまるね。`,
    identity: id,
    correct: { label: c.name, figure: ill(c.illust) },
    wrong: [{ label: wrong!.name, figure: ill(wrong!.illust), misconception: 'whole-word' }],
  });
}

/** 字を選ぶ（段階1: 2択、段階2: 3択）。似た形の字は同時に出さない */
const SIMILAR = [
  'ねれわ',
  'さきち',
  'ぬめ',
  'るろ',
  'はほ',
  'いり',
  'こに',
  'うつ',
  'あお',
  'くへ',
  'たな',
  'ばぱ',
];
const similar = (a: string, b: string) => SIMILAR.some((g) => g.includes(a) && g.includes(b));

function letterItem(w: Word, level: number): Item {
  const h = head(w);
  const heads = [...new Set(WORDS.map(head))];
  const wrong = mix(
    `letter:${w.name}:${level}`,
    heads.filter((x) => x !== h && !similar(x, h)),
  ).slice(0, level === 1 ? 1 : 2);
  // 濁音の語は、点を取った字を誤りに入れる（「ば」→「は」）
  const plain = h.normalize('NFD')[0]!;
  const opts =
    plain !== h && level === 2
      ? [
          { label: plain, misconception: 'dakuten' },
          ...wrong.slice(0, 1).map((x) => ({ label: x, misconception: 'other-letter' })),
        ]
      : wrong.map((x) => ({ label: x, misconception: 'other-letter' }));
  const id = `letter:${w.name}`;
  return listenItem({
    id: `${id}:${level}`,
    objective: 'letter',
    level,
    prompt: 'この ことばの はじめの おとの じは どれ？',
    figure: ill(w.illust),
    audio: { text: w.name },
    hints: ['ことばの はじめの おとを ゆっくり いって みよう。', `「${h}…」と いって みよう。`],
    explain: `「${w.name}」は「${h}」で はじまるよ。`,
    identity: id,
    correct: { label: h },
    wrong: opts,
  });
}

/** 別例: 字を見て、その字で はじまる絵を選ぶ */
function pictureItem(w: Word): Item {
  const h = head(w);
  const [wrong] = others(`pic:${w.name}`, WORDS, w, 1, (x) => head(x) !== h);
  const id = `picture:${w.name}`;
  return listenItem({
    id,
    objective: 'letter',
    level: 2,
    alt: true,
    prompt: `「${h}」で はじまるのは どっち？`,
    audio: { text: h },
    hints: ['えの なまえを ゆっくり いって みよう。', `はじめが「${h}」の ことばだよ。`],
    explain: `「${w.name}」は「${h}」で はじまるね。`,
    identity: id,
    correct: { label: w.name, figure: ill(w.illust) },
    wrong: [{ label: wrong!.name, figure: ill(wrong!.illust), misconception: 'other-letter' }],
  });
}

function build(): Item[] {
  const items: Item[] = [];
  for (const [a, b] of SAME) items.push(sameItem(a, b, false));
  for (const [a, b] of SAME.filter((_, i) => i % 3 === 0)) items.push(sameItem(a, b, true));
  WORDS.forEach((w, i) => {
    items.push(letterItem(w, i % 2 === 0 ? 1 : 2));
    if (i % 6 === 0) items.push(pictureItem(w));
  });
  return items;
}

export const firstSound: UnitSpec = {
  id: 'p4.ja.first-sound',
  title: 'はじめの おと',
  stage: 'p4',
  subject: 'ja',
  domain: 'play',
  kind: 'play',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-hiragana',
  prereq: [],
  objectives: [
    { id: 'same', title: 'おなじ おとで はじまる ことば（もじなし）' },
    { id: 'letter', title: 'はじめの おとの じ' },
  ],
  misconceptions: [
    {
      id: 'whole-word',
      explain: 'ことば ぜんたいで くらべたのかな。いちばん はじめの おとだけ きいて みよう。',
    },
    {
      id: 'other-letter',
      explain: 'ちがう おとの じだったね。ことばの はじめの おとを ゆっくり いって みよう。',
    },
    {
      id: 'dakuten',
      explain: '「てんてん」や「まる」が あるか ないかで おとが かわるよ。よく きいて みよう。',
    },
  ],
  levels: [
    { label: 'おなじ おとの え（もじなし・2たく）', chance: 0.5 },
    { label: 'はじめの じ（2たく）', chance: 0.5 },
    { label: 'はじめの じ（3たく）', chance: 1 / 3 },
  ],
  intro: [
    { text: '「いぬ」の はじめの おとは「い」。', figure: ill('dog') },
    { text: '「いちご」も「い」で はじまるね。', figure: ill('strawberry') },
  ],
  source: { kind: 'items', items: build() },
  review: 'view',
  basis: '幼稚園教育要領 言葉、研R10（読字の二極化）、curriculum-matrix 3.2・4.1',
  revised: '2026-10-24',
};
