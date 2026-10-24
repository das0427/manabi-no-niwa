/**
 * g5.en.read-words 音声で なれた ことばを 読《よ》んで 絵《え》と むすぶ（curriculum-matrix 3.8。外56 読む）。
 *   段階0: 聞いてから 読む（音を聞いて、つづりを えらぶ）
 *   段階1: 読むだけ（つづりを見て、いみ・絵を えらぶ。線で むすぶ）
 *   段階2: 似た つづりの ことば
 * 語リストは本アプリが選んだ 150語（他社教材の語順・単元構成は写していない）。
 * 1語に 2問以上（聞いて読む・読むだけ）。綴りの書き取りは求めない（2.3）。
 * 同一性キー: 形式 × 語。
 */
import type { ChoiceOption, Item, MatchItem, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { en, enText, listen } from './lib';

type Cat =
  | 'animal'
  | 'food'
  | 'thing'
  | 'vehicle'
  | 'nature'
  | 'color'
  | 'number'
  | 'day'
  | 'month'
  | 'body'
  | 'family'
  | 'place'
  | 'sport'
  | 'state'
  | 'action';

interface Word {
  w: string;
  ja: string;
  cat: Cat;
  il?: string;
}

const W = (cat: Cat, list: [string, string, string?][]): Word[] =>
  list.map(([w, ja, il]) => ({ w, ja, cat, ...(il ? { il } : {}) }));

export const WORDS: Word[] = [
  ...W('animal', [
    ['dog', 'いぬ', 'dog'],
    ['cat', 'ねこ', 'cat'],
    ['rabbit', 'うさぎ', 'rabbit'],
    ['bear', 'くま', 'bear'],
    ['elephant', 'ぞう', 'elephant'],
    ['monkey', 'さる', 'monkey'],
    ['fox', 'きつね', 'fox'],
    ['frog', 'かえる', 'frog'],
    ['cow', 'うし', 'cow'],
    ['bird', 'とり', 'bird'],
    ['turtle', 'かめ', 'turtle'],
    ['pig', 'ぶた', 'p23-pig'],
    ['sheep', 'ひつじ', 'p23-sheep'],
    ['duck', 'あひる', 'p23-duck'],
    ['ant', 'あり', 'ant'],
    ['octopus', 'たこ', 'octopus'],
    ['chick', 'ひよこ', 'chick'],
  ]),
  ...W('food', [
    ['apple', 'りんご', 'apple'],
    ['banana', 'バナナ', 'banana'],
    ['strawberry', 'いちご', 'strawberry'],
    ['peach', 'もも', 'peach'],
    ['tomato', 'トマト', 'tomato'],
    ['carrot', 'にんじん', 'carrot'],
    ['egg', 'たまご', 'egg'],
    ['bread', 'パン', 'bread'],
    ['lemon', 'レモン', 'lemon'],
    ['watermelon', 'すいか', 'watermelon'],
    ['cake', 'ケーキ', 'p5-cake'],
    ['ice cream', 'アイスクリーム', 'p5-icecream'],
    ['cucumber', 'きゅうり', 'cucumber'],
    ['green pepper', 'ピーマン', 'green-pepper'],
    ['rice ball', 'おにぎり', 'onigiri'],
    ['milk', 'ぎゅうにゅう'],
    ['juice', 'ジュース'],
  ]),
  ...W('thing', [
    ['ball', 'ボール', 'ball'],
    ['book', 'ほん', 'p5-book'],
    ['pencil', 'えんぴつ', 'pencil'],
    ['eraser', 'けしゴム', 'eraser'],
    ['hat', 'ぼうし', 'p23-hat'],
    ['shoe', 'くつ', 'p23-shoe'],
    ['umbrella', 'かさ', 'umbrella'],
    ['clock', 'とけい', 'p5-clock'],
    ['cup', 'コップ', 'p23-cup'],
    ['scissors', 'はさみ', 'scissors'],
    ['notebook', 'ノート', 'notebook'],
    ['spoon', 'スプーン', 'p23-spoon'],
    ['towel', 'タオル', 'p23-towel'],
    ['box', 'はこ', 'p5-box'],
    ['bag', 'かばん'],
    ['desk', 'つくえ'],
    ['chair', 'いす'],
    ['pen', 'ペン'],
  ]),
  ...W('vehicle', [
    ['bus', 'バス', 'bus-yellow'],
    ['car', 'くるま', 'car-red'],
    ['train', 'でんしゃ', 'train'],
    ['ship', 'ふね', 'ship'],
    ['airplane', 'ひこうき', 'airplane'],
    ['bicycle', 'じてんしゃ', 'bicycle'],
    ['truck', 'トラック', 'p5-truck'],
    ['rocket', 'ロケット', 'p5-rocket'],
    ['taxi', 'タクシー'],
  ]),
  ...W('nature', [
    ['sun', 'たいよう', 'p5-sun'],
    ['moon', 'つき', 'p5-moon'],
    ['star', 'ほし', 'p23-star'],
    ['tree', 'き', 'tree'],
    ['flower', 'はな（しょくぶつ）', 'flower'],
    ['leaf', 'はっぱ', 'leaf'],
    ['rock', 'いし', 'rock'],
    ['mountain', 'やま'],
    ['cloud', 'くも（そら）'],
    ['rainbow', 'にじ'],
    ['sea', 'うみ'],
    ['river', 'かわ'],
    ['snow', 'ゆき'],
    ['rain', 'あめ（てんき）'],
  ]),
  ...W('color', [
    ['red', 'あか'],
    ['blue', 'あお'],
    ['yellow', 'きいろ'],
    ['green', 'みどり'],
    ['pink', 'ピンク'],
    ['purple', 'むらさき'],
    ['orange', 'オレンジいろ'],
    ['white', 'しろ'],
    ['black', 'くろ'],
    ['brown', 'ちゃいろ'],
  ]),
  ...W('number', [
    ['one', '1'],
    ['two', '2'],
    ['three', '3'],
    ['four', '4'],
    ['five', '5'],
    ['six', '6'],
    ['seven', '7'],
    ['eight', '8'],
    ['nine', '9'],
    ['ten', '10'],
  ]),
  ...W('day', [
    ['Sunday', 'にちようび'],
    ['Monday', 'げつようび'],
    ['Tuesday', 'かようび'],
    ['Wednesday', 'すいようび'],
    ['Thursday', 'もくようび'],
    ['Friday', 'きんようび'],
    ['Saturday', 'どようび'],
  ]),
  ...W('month', [
    ['January', '1がつ'],
    ['February', '2がつ'],
    ['March', '3がつ'],
    ['April', '4がつ'],
    ['May', '5がつ'],
    ['June', '6がつ'],
    ['July', '7がつ'],
    ['August', '8がつ'],
    ['September', '9がつ'],
    ['October', '10がつ'],
    ['November', '11がつ'],
    ['December', '12がつ'],
  ]),
  ...W('body', [
    ['head', 'あたま'],
    ['hand', 'て'],
    ['foot', 'あし'],
    ['eye', 'め'],
    ['nose', 'はな（かお）'],
    ['mouth', 'くち'],
    ['ear', 'みみ'],
    ['face', 'かお'],
  ]),
  ...W('family', [
    ['mother', 'おかあさん'],
    ['father', 'おとうさん'],
    ['sister', 'あね・いもうと'],
    ['brother', 'あに・おとうと'],
    ['grandmother', 'おばあさん'],
    ['grandfather', 'おじいさん'],
  ]),
  ...W('place', [
    ['school', 'がっこう'],
    ['park', 'こうえん'],
    ['library', 'としょかん', 'life-library'],
    ['station', 'えき', 'life-station'],
    ['hospital', 'びょういん', 'life-hospital'],
    ['zoo', 'どうぶつえん'],
    ['house', 'いえ', 'house'],
    ['shop', 'みせ'],
  ]),
  ...W('sport', [
    ['soccer', 'サッカー'],
    ['baseball', 'やきゅう'],
    ['tennis', 'テニス'],
    ['swimming', 'すいえい'],
    ['music', 'おんがく'],
  ]),
  ...W('state', [
    ['happy', 'うれしい'],
    ['sad', 'かなしい'],
    ['big', 'おおきい'],
    ['small', 'ちいさい'],
    ['hot', 'あつい'],
    ['cold', 'さむい・つめたい'],
  ]),
  ...W('action', [
    ['run', 'はしる'],
    ['swim', 'およぐ'],
    ['cook', 'りょうりを する'],
  ]),
];

const word = (w: Word) => en('word', w.w);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '-');

/** 同じ なかまから i の まわりの 語を n こ（はじめの 字が 同じ語を 先に） */
function neighbors(w: Word, n: number, sameStartFirst: boolean): Word[] {
  const pool = WORDS.filter((x) => x.cat === w.cat && x !== w);
  const i = WORDS.indexOf(w);
  const sorted = [...pool].sort((a, b) => {
    const sa = sameStartFirst && a.w[0]!.toLowerCase() === w.w[0]!.toLowerCase() ? 0 : 1;
    const sb = sameStartFirst && b.w[0]!.toLowerCase() === w.w[0]!.toLowerCase() ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return ((WORDS.indexOf(a) - i + 1000) % 97) - ((WORDS.indexOf(b) - i + 1000) % 97);
  });
  return sorted.slice(0, n);
}

const meaningOpt = (x: Word): ChoiceOption => ({
  ...(x.il ? { figure: { kind: 'illust', id: x.il } as Figure } : {}),
  label: x.ja,
});

const CAT_JA: Record<Cat, string> = {
  animal: 'どうぶつ',
  food: 'たべもの・のみもの',
  thing: 'みのまわりの もの',
  vehicle: 'のりもの',
  nature: 'しぜん',
  color: '色《いろ》',
  number: 'かず',
  day: '曜日《ようび》',
  month: '月《つき》',
  body: 'からだ',
  family: 'かぞく',
  place: 'ばしょ',
  sport: 'スポーツ・すきな こと',
  state: 'ようす',
  action: 'うごき',
};

function hearItems(): Item[] {
  return WORDS.map((w) => {
    const others = neighbors(w, 2, true);
    return listen({
      id: `hear:${slug(w.w)}`,
      objective: 'hear',
      level: 0,
      prompt: '聞《き》こえた ことばの つづりは どれ？',
      audio: word(w),
      options: [
        { label: w.w, correct: true },
        ...others.map((x) => ({
          label: x.w,
          misconception:
            x.w[0]!.toLowerCase() === w.w[0]!.toLowerCase() ? 'first-letter' : 'same-category',
        })),
      ],
      hints: [
        'はじめの 音《おと》と、はじめの 文字《もじ》を むすびつけよう。',
        'おわりの 音《おと》と、おわりの 文字《もじ》も 見《み》よう。',
        `${CAT_JA[w.cat]}の なかまの ことばだよ。いみは「${w.ja}」。`,
      ],
      explain: `「${w.ja}」の ことばです。つづりを 見《み》ながら もういちど 聞《き》こう。`,
      explainFigure: enText(w.w, 'xl'),
      identity: `hear:${w.w}`,
    });
  });
}

function readItems(): Item[] {
  return WORDS.map((w) => {
    const others = neighbors(w, 2, false);
    return {
      engine: 'choice',
      id: `read:${slug(w.w)}`,
      objective: 'read',
      level: 1,
      prompt: 'この ことばの いみは どれ？',
      figure: enText(w.w, 'xl'),
      options: [
        { ...meaningOpt(w), correct: true },
        ...others.map((x) => ({ ...meaningOpt(x), misconception: 'same-category' })),
      ],
      hints: [
        'はじめの 文字《もじ》から、音《おと》を おもいだそう。',
        'こえに だして 読《よ》んで みよう。聞《き》いた ことの ある ことばかな。',
        `${CAT_JA[w.cat]}の なかまの ことばだよ。`,
      ],
      explain: `「${w.ja}」と いう いみです。`,
      explainFigure: enText(w.w, 'xl'),
      identity: `read:${w.w}`,
    } satisfies Item;
  });
}

/** 線で むすぶ（読むだけ・別例）: 同じ なかまの 語を 4つずつ */
function matchItems(): Item[] {
  const out: Item[] = [];
  const cats = [...new Set(WORDS.map((w) => w.cat))];
  for (const c of cats) {
    const list = WORDS.filter((w) => w.cat === c);
    for (let s = 0; s + 4 <= list.length; s += 4) {
      const set = list.slice(s, s + 4);
      const extra = list[(s + 4) % list.length]!;
      const right = [...set, ...(set.includes(extra) ? [] : [extra])];
      const m: MatchItem = {
        engine: 'match',
        id: `match:${set.map((x) => slug(x.w)).join('-')}`,
        objective: 'read',
        level: 1,
        prompt: 'ことばと いみを 線《せん》で むすぼう。',
        left: set.map((x) => ({ label: x.w })),
        right: right.map((x) =>
          x.il ? { figure: { kind: 'illust', id: x.il }, label: x.ja } : { label: x.ja },
        ),
        pairs: set.map((_, i) => [i, i] as [number, number]),
        hints: [
          '読《よ》める ことばから むすぼう。',
          'はじめの 文字《もじ》の 音《おと》を おもいだそう。',
          'つかわない いみが 1つ あるよ。',
        ],
        explain: 'はじめの 文字《もじ》の 音《おと》を 手《て》がかりに すると、いみが わかるね。',
        explainFigure: {
          kind: 'table',
          header: ['ことば', 'いみ'],
          rows: set.map((x) => [x.w, x.ja]),
        },
        identity: `match:${set.map((x) => x.w).join('+')}`,
        alt: true,
      };
      out.push(m);
    }
  }
  return out;
}

/** 似た つづりの ことば（どれも ほんとうに ある ことば） */
const SPELL: [string, string, string, string?][] = [
  ['cat', 'ねこ', 'cut', 'cat'],
  ['dog', 'いぬ', 'dig', 'dog'],
  ['hat', 'ぼうし', 'hot', 'p23-hat'],
  ['bag', 'かばん', 'big'],
  ['pen', 'ペン', 'pan'],
  ['sun', 'たいよう', 'son', 'p5-sun'],
  ['bus', 'バス', 'bun', 'bus-yellow'],
  ['box', 'はこ', 'fox', 'p5-box'],
  ['car', 'くるま', 'cat', 'car-red'],
  ['cup', 'コップ', 'cap', 'p23-cup'],
  ['pig', 'ぶた', 'big', 'p23-pig'],
  ['cow', 'うし', 'how', 'cow'],
  ['ten', '10', 'tan'],
  ['red', 'あか', 'bed'],
  ['milk', 'ぎゅうにゅう', 'mild'],
  ['moon', 'つき', 'noon', 'p5-moon'],
  ['tree', 'き', 'three', 'tree'],
  ['star', 'ほし', 'stair', 'p23-star'],
  ['book', 'ほん', 'look', 'p5-book'],
  ['bear', 'くま', 'hear', 'bear'],
  ['ship', 'ふね', 'shop', 'ship'],
  ['hand', 'て', 'band'],
  ['frog', 'かえる', 'from', 'frog'],
];
/** 同じ形の 3つめの 選択肢（はじめの文字を変えた語） */
const SPELL3: Record<string, string> = {
  cat: 'cap',
  dog: 'dot',
  hat: 'hit',
  bag: 'bug',
  pen: 'pin',
  sun: 'run',
  bus: 'but',
  box: 'six',
  car: 'far',
  cup: 'cut',
  pig: 'dig',
  cow: 'now',
  ten: 'hen',
  red: 'rod',
  milk: 'mile',
  moon: 'soon',
  tree: 'free',
  star: 'stay',
  book: 'cook',
  bear: 'year',
  ship: 'sheep',
  hand: 'sand',
  frog: 'flag',
};

function spellItems(): Item[] {
  const out: Item[] = [];
  SPELL.forEach(([w, ja, d1, il], i) => {
    const d2 = SPELL3[w]!;
    out.push({
      engine: 'choice',
      id: `spell:${slug(w)}`,
      objective: 'spell',
      level: 2,
      prompt: `「${ja}」を あらわす ことばは どれ？ つづりが にて いるので よく 見《み》よう。`,
      ...(il ? { figure: { kind: 'illust', id: il } as Figure } : {}),
      options: [
        { label: w, correct: true },
        { label: d1, misconception: 'similar-spelling' },
        { label: d2, misconception: 'similar-spelling' },
      ],
      hints: [
        '1文字《もじ》ずつ くらべよう。',
        'ちがうのは 1つか 2つの 文字《もじ》だけだよ。',
        'いみを おもいうかべながら、こえに だして 読《よ》んで みよう。',
      ],
      explain: `「${ja}」を あらわす つづりは こたえの とおり。ほかの 2つは 1〜2文字《もじ》だけ ちがう、べつの ことばです。`,
      explainFigure: enText(w, 'xl'),
      identity: `spell:${w}`,
    });
    // 別例: 聞いて、似た つづりから えらぶ
    if (i % 3 === 0) {
      const ww = WORDS.find((x) => x.w === w)!;
      out.push(
        listen({
          id: `spell-hear:${slug(w)}`,
          objective: 'spell',
          level: 2,
          prompt: '聞《き》こえた ことばは どれ？ つづりが にて いるので よく 見《み》よう。',
          audio: word(ww),
          options: [
            { label: w, correct: true },
            { label: d1, misconception: 'similar-spelling' },
            { label: d2, misconception: 'similar-spelling' },
          ],
          hints: [
            'まんなかの 音《おと》を よく 聞《き》こう。',
            '1文字《もじ》ずつ くらべよう。',
            `いみは「${ja}」だよ。`,
          ],
          explain: `「${ja}」を あらわす ことばです。にた つづりと 1文字《もじ》ずつ くらべよう。`,
          explainFigure: enText(w, 'xl'),
          identity: `spell-hear:${w}`,
          alt: true,
        }),
      );
    }
  });
  return out;
}

/** 聞く → 読むの 別例: 聞いて 絵を えらぶ（絵の ある 語） */
function hearPicItems(): Item[] {
  const withPic = WORDS.filter((w) => w.il);
  return withPic
    .filter((_, i) => i % 3 === 0)
    .map((w) => {
      const others = neighbors(w, 2, true).filter((x) => x.il);
      const fill = WORDS.filter((x) => x.il && x !== w && !others.includes(x) && x.cat === w.cat);
      while (others.length < 2)
        others.push(fill.shift() ?? withPic.find((x) => x !== w && !others.includes(x))!);
      return listen({
        id: `hear-pic:${slug(w.w)}`,
        objective: 'hear',
        level: 0,
        prompt: '聞《き》こえた ものは どれ？',
        audio: word(w),
        options: [
          { figure: { kind: 'illust', id: w.il! }, label: w.ja, correct: true },
          ...others.map((x) => ({
            figure: { kind: 'illust' as const, id: x.il! },
            label: x.ja,
            misconception: 'same-category',
          })),
        ],
        hints: [
          'はじめの 音《おと》を よく 聞《き》こう。',
          'おわりの 音《おと》も 聞《き》こう。',
          `${CAT_JA[w.cat]}の なかまだよ。`,
        ],
        explain: `「${w.ja}」です。つづりは この とおり。`,
        explainFigure: enText(w.w, 'xl'),
        identity: `hear-pic:${w.w}`,
        alt: true,
      });
    });
}

export const readWords: UnitSpec = {
  id: 'g5.en.read-words',
  title: 'ことばを 読《よ》もう',
  stage: 'g5',
  subject: 'en',
  domain: 'en',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'p5-book',
  prereq: ['g5.en.listen-self'],
  objectives: [
    { id: 'hear', title: '聞《き》いた ことばの つづりが わかる' },
    { id: 'read', title: 'ことばを 読《よ》んで いみが わかる' },
    { id: 'spell', title: 'にた つづりの ことばを 見《み》わける' },
  ],
  misconceptions: [
    {
      id: 'first-letter',
      explain:
        'はじめの 文字《もじ》だけ 見《み》て えらんだのかな。おわりの 文字《もじ》まで くらべよう。',
    },
    {
      id: 'same-category',
      explain:
        'おなじ なかまの べつの ことばと とりちがえたのかな。はじめの 文字《もじ》の 音《おと》を おもいだそう。',
    },
    {
      id: 'similar-spelling',
      explain: 'つづりが にている べつの ことばと まちがえたのかな。1文字《もじ》ずつ くらべよう。',
    },
  ],
  levels: [
    { label: '聞《き》いてから 読《よ》む', chance: 0.05 },
    { label: '読《よ》むだけ', chance: 0.05 },
    { label: 'にた つづり', chance: 0.05 },
  ],
  intro: [
    {
      text: '聞《き》いた ことの ある ことばを、文字《もじ》で 読《よ》んで みよう。はじめの 文字《もじ》の 音《おと》が ヒントに なるよ。',
      figure: { kind: 'row', items: [enText('dog', 'xl'), { kind: 'illust', id: 'dog' }] },
    },
    {
      text: 'つづりが にて いても、いみが ちがう ことばが あるよ。1文字《もじ》ずつ よく 見《み》よう。',
      figure: enText('cat   cut', 'xl'),
    },
  ],
  source: {
    kind: 'items',
    items: [...hearItems(), ...hearPicItems(), ...readItems(), ...matchItems(), ...spellItems()],
  },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）外国語 第5・6学年 読むこと（活字体で書かれた文字を識別し、その読み方を発音する。音声で十分慣れ親しんだ簡単な語句の意味が分かる）',
  gradeIsAppProposal: true,
  revised: '2026-10-24',
};
