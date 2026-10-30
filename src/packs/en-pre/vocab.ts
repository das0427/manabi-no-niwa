/**
 * en-pre の語彙（設計書 6章）。語・絵・日本語の名前・英語の台本の英文を1か所に集める。
 * 「日本語」は解説・選択肢の label に出す名前（絵の label と同じ。カタカナは物の名前だけ）。
 */
import type { ChoiceOption } from '../../curriculum/types';
import { en, ill, opt, type EnSound } from './lib';

export type Group = 'animal' | 'food' | 'ride' | 'thing' | 'body';

export interface Word {
  /** 英語（スラッグ。台本の英文は `Dog.`） */
  id: string;
  /** 台本の英文（先頭を大文字にして句点。単語1語が苦手な合成音声への対策: 7.2） */
  text: string;
  ja: string;
  illust: string;
  group: Group;
  /** 語頭の音（◆ = 同じ音で始まる組に使う語。b: bear bird bus banana bike ball book bread、k: car cat cake carrot cow） */
  start?: 'b' | 'k';
  /** 「It's a dog.」の形（別例）の英文 */
  it: string;
  /** 「Where is the dog?」の形の英文 */
  where: string;
}

const art = (id: string): string => (/^[aeiou]/.test(id) ? 'an' : 'a');

function W(
  id: string,
  ja: string,
  illust: string,
  group: Group,
  start?: 'b' | 'k',
  over: Partial<Pick<Word, 'it' | 'where'>> = {},
): Word {
  const cap = id[0]!.toUpperCase() + id.slice(1);
  return {
    id,
    text: `${cap}.`,
    ja,
    illust,
    group,
    ...(start ? { start } : {}),
    it: over.it ?? (id === 'bread' ? "It's bread." : `It's ${art(id)} ${id}.`),
    where: over.where ?? `Where is the ${id}?`,
  };
}

/** どうぶつ 12 */
export const ANIMALS: Word[] = [
  W('dog', 'いぬ', 'dog', 'animal'),
  W('cat', 'ねこ', 'cat', 'animal', 'k'),
  W('rabbit', 'うさぎ', 'rabbit', 'animal'),
  W('bear', 'くま', 'bear', 'animal', 'b'),
  W('elephant', 'ぞう', 'elephant', 'animal'),
  W('monkey', 'さる', 'monkey', 'animal'),
  W('bird', 'とり', 'bird', 'animal', 'b'),
  W('frog', 'かえる', 'frog', 'animal'),
  W('pig', 'ぶた', 'p23-pig', 'animal'),
  W('cow', 'うし', 'cow', 'animal', 'k'),
  W('duck', 'あひる', 'p23-duck', 'animal'),
  W('turtle', 'かめ', 'turtle', 'animal'),
];

/** たべもの 10 */
export const FOODS: Word[] = [
  W('apple', 'りんご', 'apple', 'food'),
  W('banana', 'バナナ', 'banana', 'food', 'b'),
  W('strawberry', 'いちご', 'strawberry', 'food'),
  W('bread', 'パン', 'bread', 'food', 'b'),
  W('egg', 'たまご', 'egg', 'food'),
  W('carrot', 'にんじん', 'carrot', 'food', 'k'),
  W('tomato', 'トマト', 'tomato', 'food'),
  W('peach', 'もも', 'peach', 'food'),
  W('lemon', 'レモン', 'lemon', 'food'),
  W('cake', 'ケーキ', 'p5-cake', 'food', 'k'),
];

/** のりもの 6 */
export const RIDES: Word[] = [
  W('car', 'くるま', 'car-red', 'ride', 'k'),
  W('bus', 'バス', 'bus-yellow', 'ride', 'b'),
  W('train', 'でんしゃ', 'train', 'ride'),
  W('airplane', 'ひこうき', 'airplane', 'ride'),
  W('ship', 'ふね', 'ship', 'ride'),
  W('bike', 'じてんしゃ', 'bicycle', 'ride', 'b'),
];

/** もの 8 */
export const THINGS: Word[] = [
  W('ball', 'ボール', 'ball', 'thing', 'b'),
  W('flower', 'はな（くさばな）', 'flower', 'thing'),
  W('hat', 'ぼうし', 'p23-hat', 'thing'),
  W('shoe', 'くつ', 'p23-shoe', 'thing'),
  W('book', 'ほん', 'p23-book', 'thing', 'b'),
  W('cup', 'コップ', 'p23-cup', 'thing'),
  W('umbrella', 'かさ', 'umbrella', 'thing'),
  W('star', 'ほし', 'p23-star', 'thing'),
];

/** からだ 6（はなは「はな（かお）」と書き、花と区別する） */
export const BODY: Word[] = [
  W('nose', 'はな（かお）', 'enpre-touch-nose', 'body', undefined, {
    it: 'This is my nose.',
  }),
  W('head', 'あたま', 'enpre-touch-head', 'body', undefined, { it: 'This is my head.' }),
  W('ears', 'みみ', 'enpre-touch-ears', 'body', undefined, {
    it: 'These are my ears.',
    where: 'Where are the ears?',
  }),
  W('mouth', 'くち', 'enpre-touch-mouth', 'body', undefined, { it: 'This is my mouth.' }),
  W('toes', 'あしの ゆび', 'enpre-touch-toes', 'body', undefined, {
    it: 'These are my toes.',
    where: 'Where are the toes?',
  }),
  W('hands', 'て', 'enpre-touch-hands', 'body', undefined, {
    it: 'These are my hands.',
    where: 'Where are the hands?',
  }),
];

export const RIDE_THING: Word[] = [...RIDES, ...THINGS];
export const ALL_WORDS: Word[] = [...ANIMALS, ...FOODS, ...RIDE_THING, ...BODY];

export const WORD_BY_ID: Record<string, Word> = Object.fromEntries(ALL_WORDS.map((w) => [w.id, w]));

/** p23 の語（L2: どうぶつ6・たべもの6。L3: のりもの6・もの6 を足す） */
const take = (xs: Word[], ids: string[]) => ids.map((id) => xs.find((w) => w.id === id)!);
export const P23_ANIMAL_FOOD: Word[] = [
  ...take(ANIMALS, ['dog', 'cat', 'rabbit', 'bear', 'elephant', 'monkey']),
  ...take(FOODS, ['apple', 'banana', 'strawberry', 'bread', 'egg', 'carrot']),
];
export const P23_MORE: Word[] = [
  ...take(RIDES, ['car', 'bus', 'train', 'airplane', 'ship', 'bike']),
  ...take(THINGS, ['ball', 'flower', 'hat', 'shoe', 'book', 'cup']),
];

// ---- 音声（キー） ----
export const wordSound = (w: Word): EnSound => en('word', w.text);
export const itSound = (w: Word): EnSound => en('it', w.it);
export const whereSound = (w: Word): EnSound => en('where', w.where);

/** 語の選択肢（絵・日本語の名前・名前を返す英語） */
export function wordOption(
  w: Word,
  extra: { correct?: true; misconception?: string },
): ChoiceOption {
  return opt({ label: w.ja, figure: ill(w.illust), sound: wordSound(w) }, extra);
}

/** 語が同じ「はな」の読みでまぎれる組（日本語の名前が同じ読みで始まる）。同じ問題に並べない */
export const sameJaHead = (a: Word, b: Word): boolean => a.ja.slice(0, 2) === b.ja.slice(0, 2);

// ---- いろ ----
export interface ColorDef {
  id: string;
  text: string;
  ja: string;
  /** 「あかい ボール」のように ボール につなぐ形 */
  jaBall: string;
  ball: string;
  /** 代表の物の絵 */
  thing: string;
  start?: 'p';
}
const C = (id: string, ja: string, jaBall: string, thing: string, start?: 'p'): ColorDef => ({
  id,
  text: `${id[0]!.toUpperCase()}${id.slice(1)}.`,
  ja,
  jaBall,
  ball: `enpre-ball-${id}`,
  thing,
  ...(start ? { start } : {}),
});
export const COLORS: ColorDef[] = [
  C('red', 'あか', 'あかい ボール', 'tomato'),
  C('blue', 'あお', 'あおい ボール', 'bird'),
  C('yellow', 'きいろ', 'きいろい ボール', 'banana'),
  C('green', 'みどり', 'みどりの ボール', 'frog'),
  C('pink', 'ピンク', 'ピンクの ボール', 'peach', 'p'),
  C('orange', 'オレンジ', 'オレンジの ボール', 'mikan'),
  C('purple', 'むらさき', 'むらさきの ボール', 'eggplant', 'p'),
  C('white', 'しろ', 'しろい ボール', 'egg'),
];
export const colorSound = (c: ColorDef): EnSound => en('color', c.text);
/** 赤と緑は同じ問題に並べない（DESINGN 3.1） */
export const redGreen = (a: ColorDef, b: ColorDef): boolean =>
  (a.id === 'red' && b.id === 'green') || (a.id === 'green' && b.id === 'red');

// ---- かず ----
export const NUMBER_WORDS = [
  'zero',
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
export const numberText = (n: number): string => {
  const w = NUMBER_WORDS[n]!;
  return `${w[0]!.toUpperCase()}${w.slice(1)}.`;
};
export const numberSound = (n: number): EnSound => en('num', numberText(n));
/** 数の日本語（ものの数え方: ひとつ・ふたつ…） */
export const COUNT_JA = [
  '',
  'ひとつ',
  'ふたつ',
  'みっつ',
  'よっつ',
  'いつつ',
  'むっつ',
  'ななつ',
  'やっつ',
  'ここのつ',
  'とお',
];

/** かぞえる物（絵・複数形・日本語） */
export interface Countable {
  id: string;
  illust: string;
  one: string;
  many: string;
  ja: string;
}
export const COUNTABLES: Countable[] = [
  { id: 'apple', illust: 'apple', one: 'apple', many: 'apples', ja: 'りんご' },
  { id: 'ball', illust: 'ball', one: 'ball', many: 'balls', ja: 'ボール' },
  { id: 'flower', illust: 'flower', one: 'flower', many: 'flowers', ja: 'おはな' },
  { id: 'star', illust: 'p23-star', one: 'star', many: 'stars', ja: 'ほし' },
  { id: 'car', illust: 'car-red', one: 'car', many: 'cars', ja: 'くるま' },
  { id: 'dog', illust: 'dog', one: 'dog', many: 'dogs', ja: 'いぬ' },
];

/** 「Three apples.」「One apple.」 */
export function nounPhrase(n: number, c: Countable): string {
  const w = NUMBER_WORDS[n]!;
  return `${w[0]!.toUpperCase()}${w.slice(1)} ${n === 1 ? c.one : c.many}.`;
}
export const nounSound = (n: number, c: Countable): EnSound => en('np', nounPhrase(n, c));

/** 「Two blue balls.」「One red ball.」 */
export function colorPhrase(n: number, c: ColorDef): string {
  const w = NUMBER_WORDS[n]!;
  return `${w[0]!.toUpperCase()}${w.slice(1)} ${c.id} ${n === 1 ? 'ball' : 'balls'}.`;
}
export const colorPhraseSound = (n: number, c: ColorDef): EnSound => en('np', colorPhrase(n, c));
