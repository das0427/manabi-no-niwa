/**
 * p5.ja.small-kana ちいさい じ・のばす おと（curriculum-matrix 3.3・docs/expansion/p2-design/p5.md 1章）。
 * ちいさい「っ」→ ちいさい「ゃ ゅ ょ」→ のばす おと。聞いて読む（listen）、絵を見て読む別例（choice）。
 * 問題の文・選択肢・解説は設計書のとおり。誤りの選択肢には全部 誤概念を付ける。
 * 同一性キー: hear:語（練習）、pic:語（別例）。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import { choiceItem, ill, listenItem } from './lib';

type Obj = 'sokuon' | 'youon' | 'chouon';
const LEVEL: Record<Obj, number> = { sokuon: 0, youon: 1, chouon: 2 };

/** [正解, 誤り1, 誤概念1, 誤り2, 誤概念2, h2, 解説] */
type Row = [string, string, string, string, string, string, string];
/** 別例は先頭に絵の id */
type PicRow = [string, ...Row];

const H1_HEAR: Record<Obj, string> = {
  sokuon: 'もういちど きいて、てを たたきながら いって みよう。',
  youon: 'もういちど きいて、ゆっくり いって みよう。',
  chouon: 'もういちど きいて、のばす ところを さがそう。',
};
const H1_PIC = 'えの なまえを ゆっくり いって みよう。';

const STOP2 = (c: string) =>
  `「${c}」の あとで いちど とまるね。とまる ところの じを よく みよう。`;
const STOP_EXP = (w: string) => `「${w}」。とまる ところに ちいさい「っ」を かくよ。`;
const SOKU_HEAR: Row[] = [
  ['きって', 'きて', 'sokuon-drop', 'きつて', 'sokuon-big', STOP2('き'), STOP_EXP('きって')],
  ['らっぱ', 'らぱ', 'sokuon-drop', 'らつぱ', 'sokuon-big', STOP2('ら'), STOP_EXP('らっぱ')],
  ['しっぽ', 'しぽ', 'sokuon-drop', 'しつぽ', 'sokuon-big', STOP2('し'), STOP_EXP('しっぽ')],
  [
    'ねっこ',
    'ねこ',
    'sokuon-drop',
    'ねつこ',
    'sokuon-big',
    STOP2('ね'),
    '「ねっこ」。とまる ところに ちいさい「っ」。「ねこ」とは ちがう ことばだね。',
  ],
  ['きっぷ', 'きぷ', 'sokuon-drop', 'きつぷ', 'sokuon-big', STOP2('き'), STOP_EXP('きっぷ')],
  [
    'まっすぐ',
    'ますぐ',
    'sokuon-drop',
    'まつすぐ',
    'sokuon-big',
    STOP2('ま'),
    STOP_EXP('まっすぐ'),
  ],
  ['ばった', 'ばた', 'sokuon-drop', 'ばつた', 'sokuon-big', STOP2('ば'), STOP_EXP('ばった')],
  ['らっこ', 'らこ', 'sokuon-drop', 'らつこ', 'sokuon-big', STOP2('ら'), STOP_EXP('らっこ')],
];
const NO_STOP2 = 'とまる ところは あるかな。てを たたいて たしかめよう。';
const NO_STOP_EXP = (w: string, a: string, b: string, c: string) =>
  `「${w}」。「${a}」「${b}」「${c}」と 3つの おと。「${b}」は おおきく かくよ。`;
const SOKU_PIC: PicRow[] = [
  [
    'leaf',
    'はっぱ',
    'はぱ',
    'sokuon-drop',
    'はつぱ',
    'sokuon-big',
    STOP2('は'),
    STOP_EXP('はっぱ'),
  ],
  [
    'p23-soap',
    'せっけん',
    'せけん',
    'sokuon-drop',
    'せつけん',
    'sokuon-big',
    STOP2('せ'),
    STOP_EXP('せっけん'),
  ],
  [
    'p5-stamp',
    'きって',
    'きて',
    'sokuon-drop',
    'きつて',
    'sokuon-big',
    STOP2('き'),
    STOP_EXP('きって'),
  ],
  [
    'fox',
    'きつね',
    'きっね',
    'small-wrong',
    'きうね',
    'one-char',
    NO_STOP2,
    NO_STOP_EXP('きつね', 'き', 'つ', 'ね'),
  ],
  [
    'p23-sheep',
    'ひつじ',
    'ひっじ',
    'small-wrong',
    'ひつし',
    'one-char',
    NO_STOP2,
    NO_STOP_EXP('ひつじ', 'ひ', 'つ', 'じ'),
  ],
];

const TWO = (before: string) => `${before}の つぎの おとは、2つの じで 1つの おとだよ。`;
const FIRST = 'はじめの おとは、2つの じで 1つの おとだよ。';
const YOU_EXP = (w: string, s: string, k: string) =>
  `「${w}」。「${s}」は ちいさい「${k}」で 1つの おと。`;
const YOUON_HEAR: Row[] = [
  [
    'きんぎょ',
    'きんぎよ',
    'youon-big',
    'きんぎゃ',
    'youon-vowel',
    TWO('「きん」'),
    YOU_EXP('きんぎょ', 'ぎょ', 'ょ'),
  ],
  [
    'ちょき',
    'ちよき',
    'youon-big',
    'ちゃき',
    'youon-vowel',
    FIRST,
    YOU_EXP('ちょき', 'ちょ', 'ょ'),
  ],
  [
    'おもちゃ',
    'おもちや',
    'youon-big',
    'おもちょ',
    'youon-vowel',
    TWO('「おも」'),
    YOU_EXP('おもちゃ', 'ちゃ', 'ゃ'),
  ],
  [
    'かぼちゃ',
    'かぼちや',
    'youon-big',
    'かぼちゅ',
    'youon-vowel',
    TWO('「かぼ」'),
    YOU_EXP('かぼちゃ', 'ちゃ', 'ゃ'),
  ],
  [
    'しゃしん',
    'しやしん',
    'youon-big',
    'しゅしん',
    'youon-vowel',
    FIRST,
    YOU_EXP('しゃしん', 'しゃ', 'ゃ'),
  ],
  [
    'じゃんけん',
    'じやんけん',
    'youon-big',
    'じょんけん',
    'youon-vowel',
    FIRST,
    YOU_EXP('じゃんけん', 'じゃ', 'ゃ'),
  ],
  [
    'じゅんばん',
    'じゆんばん',
    'youon-big',
    'じょんばん',
    'youon-vowel',
    FIRST,
    YOU_EXP('じゅんばん', 'じゅ', 'ゅ'),
  ],
  [
    'ひゃく',
    'ひやく',
    'youon-big',
    'ひょく',
    'youon-vowel',
    FIRST,
    YOU_EXP('ひゃく', 'ひゃ', 'ゃ'),
  ],
];
const YOUON_PIC: PicRow[] = [
  [
    'train',
    'でんしゃ',
    'でんしや',
    'youon-big',
    'でんしょ',
    'youon-vowel',
    TWO('「でん」'),
    YOU_EXP('でんしゃ', 'しゃ', 'ゃ'),
  ],
  [
    'bicycle',
    'じてんしゃ',
    'じてんしや',
    'youon-big',
    'じてんしゅ',
    'youon-vowel',
    TWO('「じてん」'),
    YOU_EXP('じてんしゃ', 'しゃ', 'ゃ'),
  ],
  [
    'life-library',
    'としょかん',
    'としよかん',
    'youon-big',
    'としゃかん',
    'youon-vowel',
    TWO('「と」'),
    YOU_EXP('としょかん', 'しょ', 'ょ'),
  ],
  [
    'life-hospital',
    'びょういん',
    'びよういん',
    'youon-big',
    'びょおいん',
    'ou-spelling',
    FIRST,
    '「びょういん」。「びょ」は ちいさい「ょ」。「びよういん」は ちがう ことばだよ。',
  ],
  [
    'chick',
    'ひよこ',
    'ひょこ',
    'small-wrong',
    'ひよご',
    'one-char',
    'いくつの おとか、てを たたいて かぞえよう。',
    NO_STOP_EXP('ひよこ', 'ひ', 'よ', 'こ'),
  ],
];

const LONG2 = (before: string) =>
  `${before}の あとを のばすね。のばす ところに かく じを くらべよう。`;
const LONG_EXP = (w: string, c: string, v: string) =>
  `「${w}」。「${c}」を のばす ところに「${v}」を かくよ。`;
const LONG_RULE = (w: string, c: string, v: string) =>
  `「${w}」。「${c}」を のばす ところは「${v}」と かくよ。`;
const CHOUON_HEAR: Row[] = [
  [
    'おかあさん',
    'おかさん',
    'chouon-drop',
    'おかーさん',
    'chouon-bar',
    LONG2('「おか」'),
    LONG_EXP('おかあさん', 'か', 'あ'),
  ],
  [
    'おにいさん',
    'おにさん',
    'chouon-drop',
    'おにーさん',
    'chouon-bar',
    LONG2('「おに」'),
    LONG_EXP('おにいさん', 'に', 'い'),
  ],
  [
    'おねえさん',
    'おねさん',
    'chouon-drop',
    'おねーさん',
    'chouon-bar',
    LONG2('「おね」'),
    LONG_EXP('おねえさん', 'ね', 'え'),
  ],
  [
    'おとうさん',
    'おとさん',
    'chouon-drop',
    'おとおさん',
    'ou-spelling',
    LONG2('「おと」'),
    LONG_RULE('おとうさん', 'と', 'う'),
  ],
  [
    'くうき',
    'くき',
    'chouon-drop',
    'くーき',
    'chouon-bar',
    LONG2('「く」'),
    LONG_EXP('くうき', 'く', 'う'),
  ],
  [
    'せんせい',
    'せんせ',
    'chouon-drop',
    'せんせえ',
    'ei-spelling',
    LONG2('「せんせ」'),
    LONG_RULE('せんせい', 'せ', 'い'),
  ],
  [
    'ゆうびん',
    'ゆびん',
    'chouon-drop',
    'ゆーびん',
    'chouon-bar',
    LONG2('「ゆ」'),
    LONG_EXP('ゆうびん', 'ゆ', 'う'),
  ],
  [
    'こおり',
    'こり',
    'chouon-drop',
    'こうり',
    'oo-word',
    LONG2('「こ」'),
    '「こおり」。「こおり」は「お」と かく とくべつな ことばだよ。',
  ],
];
const CHOUON_PIC: PicRow[] = [
  [
    'elephant',
    'ぞう',
    'ぞお',
    'ou-spelling',
    'ぞー',
    'chouon-bar',
    LONG2('「ぞ」'),
    LONG_RULE('ぞう', 'ぞ', 'う'),
  ],
  [
    'p5-clock',
    'とけい',
    'とけえ',
    'ei-spelling',
    'とけー',
    'chouon-bar',
    LONG2('「とけ」'),
    LONG_RULE('とけい', 'け', 'い'),
  ],
  [
    'p5-hat',
    'ぼうし',
    'ぼおし',
    'ou-spelling',
    'ぼし',
    'chouon-drop',
    LONG2('「ぼ」'),
    LONG_RULE('ぼうし', 'ぼ', 'う'),
  ],
  [
    'airplane',
    'ひこうき',
    'ひこおき',
    'ou-spelling',
    'ひこき',
    'chouon-drop',
    LONG2('「ひこ」'),
    LONG_RULE('ひこうき', 'こ', 'う'),
  ],
  [
    'p5-balloon',
    'ふうせん',
    'ふーせん',
    'chouon-bar',
    'ふせん',
    'chouon-drop',
    LONG2('「ふ」'),
    LONG_EXP('ふうせん', 'ふ', 'う'),
  ],
  [
    'cucumber',
    'きゅうり',
    'きゅり',
    'chouon-drop',
    'きゆうり',
    'youon-big',
    LONG2('「きゅ」'),
    '「きゅうり」。ちいさい「ゅ」の あと、のばす ところに「う」を かくよ。',
  ],
  [
    'life-police',
    'こうばん',
    'こおばん',
    'ou-spelling',
    'こばん',
    'chouon-drop',
    LONG2('「こ」'),
    LONG_RULE('こうばん', 'こ', 'う'),
  ],
];

function hear(obj: Obj, [w, w1, m1, w2, m2, h2, explain]: Row): Item {
  const id = `hear:${w}`;
  return listenItem({
    id,
    objective: obj,
    level: LEVEL[obj],
    prompt: 'きこえた ことばは どれ？ よんで えらぼう。',
    audio: { text: w },
    hints: [H1_HEAR[obj], h2],
    explain,
    identity: id,
    correct: { label: w },
    wrong: [
      { label: w1, misconception: m1 },
      { label: w2, misconception: m2 },
    ],
  });
}

function pic(obj: Obj, [illust, w, w1, m1, w2, m2, h2, explain]: PicRow): Item {
  const id = `pic:${w}`;
  return choiceItem({
    id,
    objective: obj,
    level: LEVEL[obj],
    alt: true,
    prompt: 'この えの なまえは どれ？ よんで えらぼう。',
    figure: ill(illust),
    hints: [H1_PIC, h2],
    explain,
    identity: id,
    correct: { label: w },
    wrong: [
      { label: w1, misconception: m1 },
      { label: w2, misconception: m2 },
    ],
  });
}

function build(): Item[] {
  return [
    ...SOKU_HEAR.map((r) => hear('sokuon', r)),
    ...SOKU_PIC.map((r) => pic('sokuon', r)),
    ...YOUON_HEAR.map((r) => hear('youon', r)),
    ...YOUON_PIC.map((r) => pic('youon', r)),
    ...CHOUON_HEAR.map((r) => hear('chouon', r)),
    ...CHOUON_PIC.map((r) => pic('chouon', r)),
  ];
}

export const smallKana: UnitSpec = {
  id: 'p5.ja.small-kana',
  title: 'ちいさい じ・のばす おと',
  stage: 'p5',
  subject: 'ja',
  domain: 'play',
  kind: 'knowledge',
  priority: 'P2',
  status: 'ready',
  icon: 'p5-stamp',
  prereq: ['p5.ja.kana-read-all'],
  objectives: [
    { id: 'sokuon', title: 'ちいさい「っ」の ことばを よむ' },
    { id: 'youon', title: 'ちいさい「ゃ ゅ ょ」の ことばを よむ' },
    { id: 'chouon', title: 'のばす おとの ことばを よむ' },
  ],
  misconceptions: [
    {
      id: 'sokuon-drop',
      explain:
        'とまる おとは じに しないと かんがえたのかな。いちど とまる ところには ちいさい「っ」を かくよ。',
    },
    {
      id: 'sokuon-big',
      explain:
        'おおきい「つ」で いいと かんがえたのかな。おおきい「つ」は「つ」と よむよ。とまる おとは ちいさい「っ」だね。',
    },
    {
      id: 'small-wrong',
      explain:
        'おおきく かく じも ちいさく すると かんがえたのかな。てを たたいて、おとの かずを かぞえて みよう。',
    },
    {
      id: 'youon-big',
      explain:
        'おおきい「や ゆ よ」で いいと かんがえたのかな。「しや」は「し」「や」で 2つの おと。ちいさい「ゃ」なら「しゃ」で 1つの おとだよ。',
    },
    {
      id: 'youon-vowel',
      explain:
        '「ゃ」と「ゅ」と「ょ」を とりかえても いいと かんがえたのかな。「しゃ」「しゅ」「しょ」と いって、おとを くらべよう。',
    },
    {
      id: 'chouon-drop',
      explain: 'のばす おとは かかなくて いいと かんがえたのかな。のばす ところにも じを かくよ。',
    },
    {
      id: 'chouon-bar',
      explain:
        'ひらがなでも「ー」で のばすと かんがえたのかな。「ー」は カタカナの ことばで つかうよ。',
    },
    {
      id: 'ou-spelling',
      explain:
        'きこえる とおりに「お」と かくと かんがえたのかな。「ぞう」「ぼうし」の ように、「お」の なかまを のばす ときは「う」と かく ことが おおいよ。',
    },
    {
      id: 'ei-spelling',
      explain:
        'きこえる とおりに「え」と かくと かんがえたのかな。「とけい」「せんせい」の ように、「い」と かく ことが おおいよ。',
    },
    {
      id: 'oo-word',
      explain:
        'いつも「う」と かくと かんがえたのかな。「こおり」は「お」と かく とくべつな ことばだよ。',
    },
    {
      id: 'one-char',
      explain: 'にて いる じでも いいと かんがえたのかな。1つずつ よんで くらべよう。',
    },
  ],
  levels: [
    { label: 'ちいさい「っ」', chance: 1 / 3 },
    { label: 'ちいさい「ゃ ゅ ょ」', chance: 1 / 3 },
    { label: 'のばす おと', chance: 1 / 3 },
  ],
  intro: [
    {
      text: 'ちいさい「っ」は、いちど とまる おと。「き」「っ」「て」で「きって」。',
      figure: { kind: 'text', text: 'きって', size: 'xl' },
    },
    {
      text: 'ちいさい「ゃ ゅ ょ」は、まえの じと あわせて 1つの おと。',
      figure: { kind: 'text', text: 'しや → しゃ', size: 'xl' },
    },
    {
      text: 'のばす おとも じで かくよ。「おかあさん」の「かあ」。',
      figure: { kind: 'text', text: 'おかあさん', size: 'xl' },
    },
  ],
  source: { kind: 'items', items: build() },
  review: 'view',
  basis:
    '教材会社の目安（教C3: 年長で促音・拗音。公的資料に記述なし）、小学校学習指導要領 国語 第1学年及び第2学年〔知識及び技能〕(1)ウ（長音・拗音・促音の表記）へ接続、curriculum-matrix 3.3',
  gradeIsAppProposal: true,
  revised: '2026-10-30',
};
