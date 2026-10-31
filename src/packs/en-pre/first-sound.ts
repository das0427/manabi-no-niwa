/**
 * p5.en.first-sound おなじ おと（設計書 5.12。P2）: 英語の語の「はじめの音」が同じ・ちがうに気づく（頭韻）。
 * 音素に分ける・文字と結ぶ（フォニックス）はしない。語はすべて p4.en.words の既習語で、新しい英語の音声・絵は無い。
 * 日本語の名前の はじめの音（くま・くるま）と英語の はじめの音（bear・car）がちがうことに気づく問題を入れる。
 * 選択肢は3（音を比べる負担が大きいため、5歳の上限4より少ない。設計書 13章 #10）。
 * 同一性キー: same:<目当て>（段階0・1。段階1の id は :1 を付ける）・odd:<同じ音の2語>-<ちがう語>（別例）。
 */
import type { ChoiceOption, Item, RichText, UnitSpec } from '../../curriculum/types';
import { ill, intro, listen, mix, preUnit, twice, type EnSound } from './lib';
import { WORD_BY_ID, wordOption, wordSound } from './vocab';

type Obj = 'b-sound' | 'k-sound' | 'other-sound';

/** 語のはじめの音（遠い語・ちがう語の検査にも使う。表の記号は /b/ /k/ /h/ /t/ /ʃ/ /d/ /p/ /m/ など） */
export const START_OF: Record<string, string> = {
  bear: 'b',
  bird: 'b',
  banana: 'b',
  bread: 'b',
  bus: 'b',
  bike: 'b',
  ball: 'b',
  book: 'b',
  cat: 'k',
  cow: 'k',
  carrot: 'k',
  cake: 'k',
  car: 'k',
  cup: 'k',
  hat: 'h',
  head: 'h',
  hands: 'h',
  tomato: 't',
  turtle: 't',
  toes: 't',
  ship: 'sh',
  shoe: 'sh',
  dog: 'd',
  duck: 'd',
  pig: 'p',
  peach: 'p',
  monkey: 'm',
  mouth: 'm',
  // 遠い語・ちがう語
  apple: 'a',
  egg: 'e',
  elephant: 'e',
  umbrella: 'u',
  airplane: 'e',
  lemon: 'l',
  rabbit: 'r',
  frog: 'f',
  train: 'tr',
  nose: 'n',
  star: 's',
  strawberry: 'str',
};

/** 目当てと同じ到達項目の語（目当て 28） */
const GROUPS: Record<Obj, string[]> = {
  'b-sound': ['bear', 'bird', 'banana', 'bread', 'bus', 'bike', 'ball', 'book'],
  'k-sound': ['cat', 'cow', 'carrot', 'cake', 'car', 'cup'],
  'other-sound': [
    'hat',
    'head',
    'hands',
    'tomato',
    'turtle',
    'toes',
    'ship',
    'shoe',
    'dog',
    'duck',
    'pig',
    'peach',
    'monkey',
    'mouth',
  ],
};
const objOf = (t: string): Obj =>
  (Object.keys(GROUPS) as Obj[]).find((o) => GROUPS[o].includes(t))!;

/** 正解（同じ音の相手）と段階1のわな（設計書 5.12 の表。全件） */
export const FIRST_SOUND_TABLE: Record<string, { right: string; trap: string; mis: string }> = {
  bear: { right: 'bus', trap: 'car', mis: 'ja-start' },
  bird: { right: 'book', trap: 'tomato', mis: 'ja-start' },
  banana: { right: 'ball', trap: 'peach', mis: 'near-sound' },
  bread: { right: 'bike', trap: 'head', mis: 'same-end' },
  bus: { right: 'bear', trap: 'pig', mis: 'near-sound' },
  bike: { right: 'banana', trap: 'train', mis: 'same-group' },
  ball: { right: 'bird', trap: 'hat', mis: 'ja-start' },
  book: { right: 'bread', trap: 'star', mis: 'ja-start' },
  cat: { right: 'cup', trap: 'hat', mis: 'same-end' },
  cow: { right: 'cake', trap: 'rabbit', mis: 'ja-start' },
  carrot: { right: 'car', trap: 'tomato', mis: 'same-group' },
  cake: { right: 'cow', trap: 'strawberry', mis: 'same-group' },
  car: { right: 'cat', trap: 'star', mis: 'same-end' },
  cup: { right: 'carrot', trap: 'book', mis: 'same-group' },
  hat: { right: 'hands', trap: 'ball', mis: 'ja-start' },
  head: { right: 'hat', trap: 'duck', mis: 'ja-start' },
  hands: { right: 'head', trap: 'nose', mis: 'same-group' },
  tomato: { right: 'turtle', trap: 'bird', mis: 'ja-start' },
  turtle: { right: 'toes', trap: 'umbrella', mis: 'ja-start' },
  toes: { right: 'tomato', trap: 'nose', mis: 'same-end' },
  ship: { right: 'shoe', trap: 'star', mis: 'near-sound' },
  shoe: { right: 'ship', trap: 'car', mis: 'ja-start' },
  dog: { right: 'duck', trap: 'strawberry', mis: 'ja-start' },
  duck: { right: 'dog', trap: 'head', mis: 'ja-start' },
  pig: { right: 'peach', trap: 'bus', mis: 'near-sound' },
  peach: { right: 'pig', trap: 'banana', mis: 'near-sound' },
  monkey: { right: 'mouth', trap: 'nose', mis: 'near-sound' },
  mouth: { right: 'monkey', trap: 'bear', mis: 'ja-start' },
};

/** 遠い語（どの目当てとも はじめの音がちがう） */
export const FAR_WORDS = [
  'apple',
  'egg',
  'elephant',
  'umbrella',
  'airplane',
  'lemon',
  'rabbit',
  'frog',
  'train',
];

/** 別例「ひとつ ちがう」の全件（12。同じ音の2語・ちがう語） */
export const ODD_TABLE: { pair: [string, string]; odd: string }[] = [
  { pair: ['bear', 'ball'], odd: 'cat' },
  { pair: ['bus', 'book'], odd: 'egg' },
  { pair: ['banana', 'bird'], odd: 'lemon' },
  { pair: ['bike', 'bread'], odd: 'frog' },
  { pair: ['cat', 'cake'], odd: 'dog' },
  { pair: ['car', 'cup'], odd: 'ship' },
  { pair: ['cow', 'carrot'], odd: 'train' },
  { pair: ['hat', 'head'], odd: 'apple' },
  { pair: ['toes', 'turtle'], odd: 'monkey' },
  { pair: ['pig', 'peach'], odd: 'duck' },
  { pair: ['ship', 'shoe'], odd: 'cake' },
  { pair: ['dog', 'duck'], odd: 'umbrella' },
];

const HINTS_SOUND: [RichText, RichText] = [
  'もういちど よく きいてね。',
  'おうちの ひとと いっしょに、はじめの おとを ゆっくり いって みよう。',
];

const wd = (id: string) => WORD_BY_ID[id]!;

/** 遠い語の候補（目当てと同じなかま・わな・特定の組・赤と緑を除く） */
function farCandidates(t: string, used: string[]): string[] {
  const g = wd(t).group;
  const tomatoShown = [t, ...used].includes('tomato');
  return FAR_WORDS.filter((x) => {
    if (used.includes(x)) return false;
    if (wd(x).group === g) return false;
    if (t === 'cow' && x === 'rabbit') return false; // うし／うさぎ
    if (t === 'turtle' && (x === 'umbrella' || x === 'frog')) return false; // かめ／かさ・かえる
    if (['tomato', 'turtle', 'toes', 'dog', 'duck'].includes(t) && x === 'train') return false; // /tɹ/ が近い
    if (tomatoShown && x === 'frog') return false; // 赤と緑を同じ問題に並べない
    return true;
  });
}

const asSound = (o: ChoiceOption): EnSound => o.sound as EnSound;

function sameItem(t: string, level: 0 | 1): Item {
  const row = FIRST_SOUND_TABLE[t]!;
  const identity = `same:${t}`;
  const id = level === 0 ? identity : `${identity}:1`;
  const used = [row.right, row.trap];
  const far = mix(`${id}:f`, farCandidates(t, used)).slice(0, level === 0 ? 2 : 1);
  const common = {
    id,
    objective: objOf(t),
    level,
    figure: ill(wd(t).illust),
    hints: HINTS_SOUND,
    explain: `「${wd(t).ja}」と 「${wd(row.right).ja}」は、えいごでは おなじ おとで はじまるよ。`,
    identity,
    revealAudio: [wordSound(wd(t)), wordSound(wd(row.right))],
  };
  if (level === 0) {
    // 目当てを聞いた後、選択肢を画面の並び順に1つずつ聞く
    const options = mix(id, [
      wordOption(wd(row.right), { correct: true }),
      ...far.map((x) => wordOption(wd(x), { misconception: 'other-sound' })),
    ]);
    return listen({
      ...common,
      prompt: 'えいごを きいてね。さいしょの ことばと おなじ おとで はじまるのは どれ？',
      audio: [wordSound(wd(t)), ...options.map(asSound)],
      gapMs: 900,
      options,
      keepOrder: true,
    });
  }
  return listen({
    ...common,
    prompt: 'えいごを きいてね。おなじ おとで はじまるのは どれ？',
    audio: twice(wordSound(wd(t))),
    gapMs: 700,
    options: [
      wordOption(wd(row.right), { correct: true }),
      wordOption(wd(row.trap), { misconception: row.mis }),
      ...far.map((x) => wordOption(wd(x), { misconception: 'other-sound' })),
    ],
  });
}

function oddItem(pair: [string, string], odd: string): Item {
  const identity = `odd:${pair[0]}-${pair[1]}-${odd}`;
  const options = mix(identity, [
    wordOption(wd(odd), { correct: true }),
    ...pair.map((x) => wordOption(wd(x), { misconception: 'same-pair' })),
  ]);
  return listen({
    id: identity,
    objective: objOf(pair[0]),
    level: 0,
    prompt: 'えいごを きいてね。ひとつだけ ちがう おとで はじまるのは どれ？',
    audio: options.map(asSound),
    gapMs: 900,
    options,
    keepOrder: true,
    hints: HINTS_SOUND,
    explain: `「${wd(odd).ja}」だけ、えいごでは はじまりの おとが ちがうよ。`,
    identity,
    alt: true,
    revealAudio: [...pair.map((x) => wordSound(wd(x))), wordSound(wd(odd))],
  });
}

function items(): Item[] {
  const out: Item[] = [];
  for (const o of Object.keys(GROUPS) as Obj[]) for (const t of GROUPS[o]) out.push(sameItem(t, 0));
  for (const { pair, odd } of ODD_TABLE) out.push(oddItem(pair, odd));
  for (const o of Object.keys(GROUPS) as Obj[]) for (const t of GROUPS[o]) out.push(sameItem(t, 1));
  return out;
}

export const p5FirstSound: UnitSpec = preUnit({
  id: 'p5.en.first-sound',
  title: 'おなじ おと',
  stage: 'p5',
  icon: 'ball',
  priority: 'P2',
  prereq: ['p4.en.words'],
  objectives: [
    { id: 'b-sound', title: 'ボールと おなじ おとで はじまる ことばを きく' },
    { id: 'k-sound', title: 'くるまと おなじ おとで はじまる ことばを きく' },
    { id: 'other-sound', title: 'いろいろな おとで はじまる ことばを きく' },
  ],
  misconceptions: [
    { id: 'other-sound', explain: 'ちがう おとで はじまる ことばだね。もういちど きいて みよう。' },
    {
      id: 'ja-start',
      explain:
        'にほんごの なまえは にて いるけど、えいごでは はじまりの おとが ちがうね。もういちど きいて みよう。',
    },
    {
      id: 'same-end',
      explain: 'おわりの おとが おなじ ことばだね。はじめの おとを きいて みよう。',
    },
    { id: 'near-sound', explain: 'にて いる おとだね。くちの かたちを まねして みよう。' },
    { id: 'same-group', explain: 'おなじ なかまの ことばだね。はじめの おとを くらべて みよう。' },
    {
      id: 'same-pair',
      explain:
        'この ことばは、ほかの ひとつと おなじ おとで はじまるね。のこりの ひとつは どれかな。',
    },
  ],
  levels: [
    { label: 'なまえを きいて くらべる（3たく）', chance: 1 / 3 },
    { label: 'なまえを おもいだして（3たく）', chance: 1 / 3 },
  ],
  intro: intro(ill('ball'), 'えいごの ことばの はじめの おとを くらべる あそびだよ。'),
  source: { kind: 'items', items: items() },
  parentNote:
    '英語の言葉の『はじめの音』をくらべる遊びです。『bear（くま）』と『car（くるま）』のように、日本語では似ていても英語ではちがう音で始まることがあります。文字は使いません。',
});
