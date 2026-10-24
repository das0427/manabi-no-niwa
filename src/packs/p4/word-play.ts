/**
 * p4.ja.word-play ことばあそび（curriculum-matrix 3.2・4.2）: 音の数・しりとり・さかさことば。
 * 音の数は「てを たたきながら」数える（たたく操作は画面ではなく親子で。答えは数を選ぶ）。
 * 同一性キー: 問う語（しりとりは 前の語、さかさは 語）＋問い方。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { choiceItem, ill, listenItem, others } from './lib';

interface Word {
  illust: string;
  name: string;
}
const W = (illust: string, name: string): Word => ({ illust, name });
const WORDS: Word[] = [
  W('dog', 'いぬ'),
  W('cat', 'ねこ'),
  W('bear', 'くま'),
  W('monkey', 'さる'),
  W('turtle', 'かめ'),
  W('octopus', 'たこ'),
  W('peach', 'もも'),
  W('eggplant', 'なす'),
  W('umbrella', 'かさ'),
  W('bird', 'とり'),
  W('apple', 'りんご'),
  W('strawberry', 'いちご'),
  W('rabbit', 'うさぎ'),
  W('fox', 'きつね'),
  W('mikan', 'みかん'),
  W('watermelon', 'すいか'),
  W('chick', 'ひよこ'),
  W('egg', 'たまご'),
  W('tomato', 'トマト'),
  W('banana', 'バナナ'),
  W('scissors', 'はさみ'),
  W('lemon', 'レモン'),
  W('carrot', 'にんじん'),
  W('onigiri', 'おにぎり'),
  W('pencil', 'えんぴつ'),
  W('airplane', 'ひこうき'),
  W('frog', 'かえる'),
  W('elephant', 'ぞう'),
  W('cow', 'うし'),
  W('ship', 'ふね'),
  W('flower', 'はな'),
  W('rock', 'いし'),
  W('car-red', 'くるま'),
  W('ant', 'あり'),
  W('tree', 'き'),
];
const w = (n: string) => WORDS.find((x) => x.name === n)!;
const COUNT_WORD = ['', 'ひとつ', 'ふたつ', 'みっつ', 'よっつ'];
/** 音の数（この単元の語は 小さい字・のばす音を含まないので 字の数＝音の数） */
const morae = (x: Word) => [...x.name].length;

/** 音の数を ●で 表す図 */
const dots = (n: number): Figure => ({
  kind: 'svg',
  label: `${COUNT_WORD[n]}`,
  markup: `<svg viewBox="0 0 ${n * 30 + 10} 40" xmlns="http://www.w3.org/2000/svg">${Array.from(
    { length: n },
    (_, i) =>
      `<circle cx="${20 + i * 30}" cy="20" r="11" fill="var(--sun)" stroke="var(--ink)" stroke-width="3.5"/>`,
  ).join('')}</svg>`,
});

function countItem(x: Word): Item {
  const n = morae(x);
  const choices = [2, 3, 4];
  const id = `count:${x.name}`;
  return listenItem({
    id,
    objective: 'count',
    level: 0,
    prompt: 'てを たたきながら いって みよう。おとは いくつ？',
    figure: ill(x.illust),
    audio: { text: [...x.name].join('、') },
    gapMs: 400,
    hints: [
      'ひとつの おとで、てを ひとつ たたこう。',
      `「${[...x.name][0]}」で ひとつ。つづけて たたこう。`,
    ],
    explain: `「${[...x.name].join('・')}」で ${COUNT_WORD[n]}。`,
    identity: id,
    correct: { label: COUNT_WORD[n]!, figure: dots(n) },
    wrong: choices
      .filter((k) => k !== n)
      .map((k) => ({
        label: COUNT_WORD[k]!,
        figure: dots(k),
        misconception: k > n ? 'count-extra' : 'count-whole',
      })),
  });
}

/** 別例: 音の数から 絵を選ぶ */
function countPickItem(n: number, x: Word): Item {
  const [wrong] = others(`cp:${x.name}`, WORDS, x, 1, (y) => morae(y) !== n);
  const id = `count-pick:${n}:${x.name}`;
  return choiceItem({
    id,
    objective: 'count',
    level: 0,
    alt: true,
    prompt: `おとが ${COUNT_WORD[n]}の ことばは どっち？`,
    figure: dots(n),
    hints: [
      'えの なまえを、てを たたきながら いって みよう。',
      `${COUNT_WORD[n]} たたく ことばを さがそう。`,
    ],
    explain: `「${[...x.name].join('・')}」で ${COUNT_WORD[n]}だね。`,
    identity: id,
    correct: { label: x.name, figure: ill(x.illust) },
    wrong: [
      {
        label: wrong!.name,
        figure: ill(wrong!.illust),
        misconception: morae(wrong!) > n ? 'count-extra' : 'count-whole',
      },
    ],
  });
}

const last = (x: Word) => [...x.name].at(-1)!;
const first = (x: Word) => [...x.name][0]!;
/** カタカナの語は ひらがなに直して 比べる（「トマト」の さいごは「と」） */
const hira = (s: string) =>
  s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** しりとり（前の語, つぎの語, 誤り） */
const SHIRI: [string, string, string][] = [
  ['とり', 'りんご', 'ねこ'],
  ['あり', 'りんご', 'くま'],
  ['すいか', 'かめ', 'いぬ'],
  ['なす', 'すいか', 'たこ'],
  ['かさ', 'さる', 'くま'],
  ['きつね', 'ねこ', 'うし'],
  ['ふね', 'ねこ', 'もも'],
  ['はな', 'なす', 'もも'],
  ['バナナ', 'なす', 'きつね'],
  ['はさみ', 'みかん', 'ぞう'],
  ['ひこうき', 'きつね', 'かさ'],
  ['トマト', 'とり', 'はな'],
  ['ぞう', 'うさぎ', 'いちご'],
];

function shiriItem(prev: string, next: string, wrong: string): Item {
  const p = w(prev);
  const id = `shiri:${prev}`;
  return listenItem({
    id,
    objective: 'shiri',
    level: 1,
    prompt: `しりとり。「${p.name}」の つぎは どっち？`,
    figure: ill(p.illust),
    audio: { text: `${p.name}。つぎは、なにかな？` },
    hints: [`「${p.name}」の さいごの おとを きこう。`, `さいごの おとは「${hira(last(p))}」。`],
    explain: `「${p.name}」の さいごは「${hira(last(p))}」。「${w(next).name}」は「${hira(first(w(next)))}」で はじまるね。`,
    identity: id,
    correct: { label: w(next).name, figure: ill(w(next).illust) },
    wrong: [{ label: w(wrong).name, figure: ill(w(wrong).illust), misconception: 'shiri-first' }],
  });
}

/** 別例: つぎの語から 前の語を選ぶ */
const SHIRI_BACK: [string, string, string][] = [
  ['りんご', 'とり', 'ねこ'],
  ['ねこ', 'きつね', 'かさ'],
  ['なす', 'はな', 'いぬ'],
  ['みかん', 'はさみ', 'くま'],
];
function shiriBackItem(next: string, prev: string, wrong: string): Item {
  const id = `shiri-back:${next}`;
  return listenItem({
    id,
    objective: 'shiri',
    level: 1,
    alt: true,
    prompt: `しりとり。「${next}」の まえに くるのは どっち？`,
    figure: ill(w(next).illust),
    audio: { text: `${next}の まえは、なにかな？` },
    hints: [
      `「${next}」の はじめの おとを きこう。`,
      `さいごが「${first(w(next))}」で おわる ことばだよ。`,
    ],
    explain: `「${prev}」の さいごは「${last(w(prev))}」。「${next}」に つながるね。`,
    identity: id,
    correct: { label: prev, figure: ill(w(prev).illust) },
    wrong: [{ label: wrong, figure: ill(w(wrong).illust), misconception: 'shiri-first' }],
  });
}

/** さかさことば（さかさに した音を きいて、もとの絵を選ぶ） */
const SAKASA: [string, string][] = [
  ['ねこ', 'いぬ'],
  ['くま', 'さる'],
  ['さる', 'かめ'],
  ['かめ', 'たこ'],
  ['たこ', 'ねこ'],
  ['なす', 'もも'],
  ['かさ', 'とり'],
  ['とり', 'なす'],
  ['いぬ', 'うし'],
  ['うし', 'くま'],
  ['りんご', 'みかん'],
  ['きつね', 'うさぎ'],
  ['すいか', 'いちご'],
  ['いちご', 'すいか'],
  ['うさぎ', 'きつね'],
];
const rev = (s: string) => [...s].reverse().join('');

function sakasaItem(word: string, wrong: string): Item {
  const x = w(word);
  const id = `sakasa:${word}`;
  return listenItem({
    id,
    objective: 'sakasa',
    level: [...word].length === 2 ? 1 : 2,
    prompt: 'さかさに いうと、なにかな？',
    audio: { text: rev(word) },
    hints: ['うしろから じゅんに いって みよう。', `さいごの おとは「${[...word][0]}」だよ。`],
    explain: `「${rev(word)}」を さかさに すると「${word}」。`,
    identity: id,
    correct: { label: word, figure: ill(x.illust) },
    wrong: [{ label: wrong, figure: ill(w(wrong).illust), misconception: 'sakasa-same' }],
  });
}

/** 別例: 絵を見て、さかさに 言った方を 番号で選ぶ（音を2つ聞く） */
const SAKASA_ALT: [string, string][] = [
  ['ねこ', 'ねね'],
  ['くま', 'くく'],
  ['かさ', 'さか'],
];
function sakasaAltItem(word: string, other: string, idx: number): Item {
  // かさ ⇄ さか は さかさにすると「さか」。誤りは もとの まま「かさ」
  const right = rev(word);
  const wrong = other === right ? word : other;
  const correctFirst = idx % 2 === 0;
  const sounds = correctFirst ? [right, wrong] : [wrong, right];
  const opt = (i: number): ChoiceOption => ({ label: i === 0 ? 'いちばん' : 'にばん' });
  return {
    engine: 'listen',
    id: `sakasa-pick:${word}`,
    objective: 'sakasa',
    level: 2,
    alt: true,
    prompt: `「${word}」を さかさに いったのは なんばん？`,
    figure: ill(w(word).illust),
    audio: [{ text: `いちばん、${sounds[0]}` }, { text: `にばん、${sounds[1]}` }],
    gapMs: 800,
    fixedOrder: true,
    hints: [
      `「${word}」を うしろから いって みよう。`,
      `はじめの おとは「${[...right][0]}」だよ。`,
    ],
    explain: `「${word}」を さかさに すると「${right}」。`,
    identity: `sakasa-pick:${word}`,
    options: [0, 1].map((i) =>
      sounds[i] === right
        ? { ...opt(i), correct: true }
        : { ...opt(i), misconception: 'sakasa-same' },
    ),
  };
}

function build(): Item[] {
  const items: Item[] = [];
  for (const x of WORDS.filter((y) => morae(y) <= 4).slice(0, 26)) items.push(countItem(x));
  items.push(
    countPickItem(2, w('いぬ')),
    countPickItem(3, w('りんご')),
    countPickItem(4, w('にんじん')),
  );
  for (const s of SHIRI) items.push(shiriItem(...s));
  for (const s of SHIRI_BACK) items.push(shiriBackItem(...s));
  for (const s of SAKASA) items.push(sakasaItem(...s));
  SAKASA_ALT.forEach(([a, b], i) => items.push(sakasaAltItem(a, b, i)));
  return items;
}

export const wordPlay: UnitSpec = {
  id: 'p4.ja.word-play',
  title: 'ことばあそび',
  stage: 'p4',
  subject: 'ja',
  domain: 'play',
  kind: 'play',
  priority: 'P1',
  status: 'ready',
  icon: 'listen',
  prereq: ['p4.ja.first-sound'],
  objectives: [
    { id: 'count', title: 'ことばの おとの かず' },
    { id: 'shiri', title: 'しりとり' },
    { id: 'sakasa', title: 'さかさことば' },
  ],
  misconceptions: [
    {
      id: 'count-whole',
      explain: 'ことばを まとめて かぞえたのかな。ひとつの おとで ひとつ たたこう。',
    },
    { id: 'count-extra', explain: 'すこし おおく たたいたかな。ゆっくり いいながら たたこう。' },
    { id: 'shiri-first', explain: 'しりとりは、まえの ことばの さいごの おとから はじまるよ。' },
    { id: 'sakasa-same', explain: 'さかさは、うしろの おとから じゅんに いう ことだよ。' },
  ],
  levels: [
    { label: 'おとの かず', chance: 1 / 3 },
    { label: 'しりとり・2おんの さかさことば', chance: 0.5 },
    { label: '3おんの さかさことば', chance: 0.5 },
  ],
  intro: [
    { text: '「り・ん・ご」。てを たたくと みっつ。', figure: ill('apple') },
    {
      text: 'しりとりは、さいごの おとで つなぐよ。「りんご」の つぎは「ご」。',
      figure: ill('apple'),
    },
  ],
  source: { kind: 'items', items: build() },
  review: 'none',
  basis: '幼稚園教育要領 言葉（言葉の響きやリズム、言葉遊び）、curriculum-matrix 3.2・4.2',
  revised: '2026-10-24',
};
