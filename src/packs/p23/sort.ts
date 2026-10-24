/**
 * p23.think.sort わけてみよう（curriculum-matrix 3.1）。
 * L2（段階0）: 2まいを いろの はこへ（1まいずつ）。L3（段階1）: 4まい 2はこ（いろ）。L3（段階2）: しゅるい。
 * 色の組は あか×きいろ、きいろ×みどり だけ（あか×みどりは出さない: DESINGN 3.1）。
 * 色の箱は 色名・代表の絵の色・模様（あか＝てん、きいろ＝しま、みどり＝なみ）を併記する。
 * 同一性キー: 箱の組とカードの組（並びは問わない）。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import type { SortCard, SortItem } from '../../engines/sort/sort';
import { ill, mix } from './lib';

type Color = 'red' | 'yellow' | 'green';
const COLOR_NAME: Record<Color, string> = { red: 'あか', yellow: 'きいろ', green: 'みどり' };

/** 色見本（色＋模様）。色は教材色のトークン */
function swatch(c: Color): Figure {
  const fill = { red: 'var(--mat-red)', yellow: 'var(--mat-yellow)', green: 'var(--mat-green)' }[c];
  const pattern =
    c === 'red'
      ? '<circle cx="35" cy="38" r="6" fill="var(--paper)"/><circle cx="62" cy="34" r="6" fill="var(--paper)"/><circle cx="50" cy="62" r="6" fill="var(--paper)"/>'
      : c === 'yellow'
        ? '<path d="M14 40 H86 M10 56 H90 M18 72 H82" stroke="var(--paper)" stroke-width="6" fill="none"/>'
        : '<path d="M12 42 Q24 32 36 42 T60 42 T84 42 M12 64 Q24 54 36 64 T60 64 T84 64" stroke="var(--paper)" stroke-width="6" fill="none"/>';
  return {
    kind: 'svg',
    label: COLOR_NAME[c],
    markup: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="44" fill="${fill}" stroke="var(--ink)" stroke-width="3.5"/>${pattern}</svg>`,
  };
}

interface Thing {
  illust: string;
  name: string;
  color: Color;
  kind: 'food' | 'animal' | 'vehicle' | 'thing';
}
const T = (illust: string, name: string, color: Color, kind: Thing['kind']): Thing => ({
  illust,
  name,
  color,
  kind,
});

const FOOD_COLOR: Thing[] = [
  T('apple', 'りんご', 'red', 'food'),
  T('strawberry', 'いちご', 'red', 'food'),
  T('tomato', 'トマト', 'red', 'food'),
  T('banana', 'バナナ', 'yellow', 'food'),
  T('lemon', 'レモン', 'yellow', 'food'),
  T('cucumber', 'きゅうり', 'green', 'food'),
  T('green-pepper', 'ピーマン', 'green', 'food'),
];
/** 別例: たべもの以外の色の仲間 */
const OTHER_COLOR: Thing[] = [
  T('car-red', 'くるま', 'red', 'vehicle'),
  T('bus-yellow', 'バス', 'yellow', 'vehicle'),
  T('chick', 'ひよこ', 'yellow', 'animal'),
  T('frog', 'かえる', 'green', 'animal'),
  T('leaf', 'はっぱ', 'green', 'thing'),
];

const card = (t: Thing, box: number, mis: string): SortCard => ({
  figure: ill(t.illust),
  name: t.name,
  box,
  wrongBoxes: [{ box: 1 - box, misconception: mis }],
});

function colorItem(level: number, a: Color, b: Color, things: Thing[], alt = false): SortItem {
  const key = things
    .map((t) => t.illust)
    .sort()
    .join('+');
  const id = `color:${a}-${b}:${key}`;
  return {
    engine: 'sort',
    id,
    objective: 'color',
    level,
    alt,
    prompt:
      things.length <= 2 ? 'おなじ いろの はこへ いれよう。' : 'いろで わけて はこへ いれよう。',
    boxes: [
      { figure: swatch(a), name: COLOR_NAME[a] },
      { figure: swatch(b), name: COLOR_NAME[b] },
    ],
    cards: mix(id, things).map((t) => card(t, t.color === a ? 0 : 1, 'color-mix')),
    hints: ['えの いろを よく みよう。', 'はこの いろと おなじ いろは どれかな。'],
    explain: things.map((t) => `${t.name}は ${COLOR_NAME[t.color]}`).join('、') + '。',
    identity: id,
  };
}

interface KindSet {
  id: string;
  boxes: [string, string];
  boxIllust: [string, string];
  a: { illust: string; name: string }[];
  b: { illust: string; name: string }[];
  alt?: boolean;
  prompt: string;
  hint: string;
}

const KINDS: KindSet[] = [
  {
    id: 'animal-food-1',
    boxes: ['どうぶつ', 'たべもの'],
    boxIllust: ['dog', 'apple'],
    a: [
      { illust: 'cat', name: 'ねこ' },
      { illust: 'rabbit', name: 'うさぎ' },
    ],
    b: [
      { illust: 'banana', name: 'バナナ' },
      { illust: 'onigiri', name: 'おにぎり' },
    ],
    prompt: 'どうぶつと たべものに わけよう。',
    hint: 'うごく いきものは どうぶつの はこへ。',
  },
  {
    id: 'animal-food-2',
    boxes: ['どうぶつ', 'たべもの'],
    boxIllust: ['dog', 'apple'],
    a: [
      { illust: 'bear', name: 'くま' },
      { illust: 'elephant', name: 'ぞう' },
    ],
    b: [
      { illust: 'bread', name: 'パン' },
      { illust: 'peach', name: 'もも' },
    ],
    prompt: 'どうぶつと たべものに わけよう。',
    hint: 'うごく いきものは どうぶつの はこへ。',
  },
  {
    id: 'animal-food-3',
    boxes: ['どうぶつ', 'たべもの'],
    boxIllust: ['dog', 'apple'],
    a: [
      { illust: 'monkey', name: 'さる' },
      { illust: 'turtle', name: 'かめ' },
    ],
    b: [
      { illust: 'carrot', name: 'にんじん' },
      { illust: 'egg', name: 'たまご' },
    ],
    prompt: 'どうぶつと たべものに わけよう。',
    hint: 'うごく いきものは どうぶつの はこへ。',
  },
  {
    id: 'vehicle-food-1',
    boxes: ['のりもの', 'たべもの'],
    boxIllust: ['car-red', 'apple'],
    a: [
      { illust: 'train', name: 'でんしゃ' },
      { illust: 'airplane', name: 'ひこうき' },
    ],
    b: [
      { illust: 'mikan', name: 'みかん' },
      { illust: 'watermelon', name: 'すいか' },
    ],
    prompt: 'のりものと たべものに わけよう。',
    hint: 'ひとが のって うごく ものは のりもの。',
  },
  {
    id: 'vehicle-food-2',
    boxes: ['のりもの', 'たべもの'],
    boxIllust: ['car-red', 'apple'],
    a: [
      { illust: 'ship', name: 'ふね' },
      { illust: 'bicycle', name: 'じてんしゃ' },
    ],
    b: [
      { illust: 'strawberry', name: 'いちご' },
      { illust: 'eggplant', name: 'なす' },
    ],
    prompt: 'のりものと たべものに わけよう。',
    hint: 'ひとが のって うごく ものは のりもの。',
  },
  {
    id: 'animal-vehicle-1',
    boxes: ['どうぶつ', 'のりもの'],
    boxIllust: ['dog', 'car-red'],
    a: [
      { illust: 'fox', name: 'きつね' },
      { illust: 'cow', name: 'うし' },
    ],
    b: [
      { illust: 'bus-yellow', name: 'バス' },
      { illust: 'train', name: 'でんしゃ' },
    ],
    prompt: 'どうぶつと のりものに わけよう。',
    hint: 'いきものは どうぶつの はこへ。',
  },
  {
    id: 'animal-vehicle-2',
    boxes: ['どうぶつ', 'のりもの'],
    boxIllust: ['dog', 'car-red'],
    a: [
      { illust: 'frog', name: 'かえる' },
      { illust: 'bird', name: 'とり' },
    ],
    b: [
      { illust: 'airplane', name: 'ひこうき' },
      { illust: 'ship', name: 'ふね' },
    ],
    prompt: 'どうぶつと のりものに わけよう。',
    hint: 'いきものは どうぶつの はこへ。',
  },
  // 別例: 「たべられる／たべられない」（分け方の言い方を変える）
  {
    id: 'eat-1',
    alt: true,
    boxes: ['たべられる', 'たべられない'],
    boxIllust: ['p23-spoon', 'ball'],
    a: [
      { illust: 'apple', name: 'りんご' },
      { illust: 'bread', name: 'パン' },
    ],
    b: [
      { illust: 'ball', name: 'ボール' },
      { illust: 'pencil', name: 'えんぴつ' },
    ],
    prompt: 'たべられる ものと たべられない ものに わけよう。',
    hint: 'くちに いれて いい ものは どれかな。',
  },
  {
    id: 'eat-2',
    alt: true,
    boxes: ['たべられる', 'たべられない'],
    boxIllust: ['p23-spoon', 'ball'],
    a: [
      { illust: 'banana', name: 'バナナ' },
      { illust: 'onigiri', name: 'おにぎり' },
    ],
    b: [
      { illust: 'umbrella', name: 'かさ' },
      { illust: 'scissors', name: 'はさみ' },
    ],
    prompt: 'たべられる ものと たべられない ものに わけよう。',
    hint: 'くちに いれて いい ものは どれかな。',
  },
  {
    id: 'eat-3',
    alt: true,
    boxes: ['たべられる', 'たべられない'],
    boxIllust: ['p23-spoon', 'ball'],
    a: [
      { illust: 'tomato', name: 'トマト' },
      { illust: 'egg', name: 'たまご' },
    ],
    b: [
      { illust: 'rock', name: 'いし' },
      { illust: 'p23-shoe', name: 'くつ' },
    ],
    prompt: 'たべられる ものと たべられない ものに わけよう。',
    hint: 'くちに いれて いい ものは どれかな。',
  },
];

function kindItem(k: KindSet): SortItem {
  const id = `kind:${k.id}`;
  const all = [...k.a.map((x) => ({ ...x, box: 0 })), ...k.b.map((x) => ({ ...x, box: 1 }))];
  return {
    engine: 'sort',
    id,
    objective: 'kind',
    level: 2,
    alt: k.alt,
    prompt: k.prompt,
    boxes: [
      { figure: ill(k.boxIllust[0]), name: k.boxes[0], label: k.boxes[0] },
      { figure: ill(k.boxIllust[1]), name: k.boxes[1], label: k.boxes[1] },
    ],
    cards: mix(id, all).map((x) => ({
      figure: ill(x.illust),
      name: x.name,
      box: x.box,
      wrongBoxes: [{ box: 1 - x.box, misconception: 'kind-mix' }],
    })),
    hints: [k.hint, 'はこの えと おなじ なかまは どれかな。'],
    explain: `${k.a.map((x) => x.name).join('と ')}は ${k.boxes[0]}、${k.b.map((x) => x.name).join('と ')}は ${k.boxes[1]}。`,
    identity: id,
  };
}

function build(): Item[] {
  const items: Item[] = [];
  const of = (c: Color) => FOOD_COLOR.filter((t) => t.color === c);
  // 段階0（L2）: 1色1まいずつ 2まい
  for (const r of of('red'))
    for (const y of of('yellow')) items.push(colorItem(0, 'red', 'yellow', [r, y]));
  for (const y of of('yellow'))
    for (const g of of('green')) items.push(colorItem(0, 'yellow', 'green', [y, g]));
  // 段階1（L3）: 4まい 2はこ
  const reds = of('red');
  const yel = of('yellow');
  const grn = of('green');
  items.push(
    colorItem(1, 'red', 'yellow', [reds[0]!, reds[1]!, yel[0]!, yel[1]!]),
    colorItem(1, 'red', 'yellow', [reds[1]!, reds[2]!, yel[0]!, yel[1]!]),
    colorItem(1, 'red', 'yellow', [reds[0]!, reds[2]!, yel[0]!, yel[1]!]),
    colorItem(1, 'yellow', 'green', [yel[0]!, yel[1]!, grn[0]!, grn[1]!]),
    colorItem(1, 'red', 'yellow', [reds[0]!, reds[1]!, reds[2]!, yel[0]!]),
    colorItem(1, 'yellow', 'green', [yel[0]!, grn[0]!, grn[1]!, yel[1]!].slice(0, 3)),
  );
  // 別例: たべもの以外の物を色で
  const o = (n: string) => OTHER_COLOR.find((t) => t.illust === n)!;
  items.push(
    colorItem(0, 'red', 'yellow', [o('car-red'), o('bus-yellow')], true),
    colorItem(1, 'yellow', 'green', [o('chick'), o('frog'), o('bus-yellow'), o('leaf')], true),
    colorItem(1, 'red', 'yellow', [o('car-red'), o('chick'), reds[0]!, o('bus-yellow')], true),
  );
  for (const k of KINDS) items.push(kindItem(k));
  return items;
}

export const sortUnit: UnitSpec = {
  id: 'p23.think.sort',
  title: 'わけてみよう',
  stage: 'p23',
  subject: 'think',
  domain: 'play',
  kind: 'play',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-sorting',
  prereq: [],
  objectives: [
    { id: 'color', title: 'いろで わける' },
    { id: 'kind', title: 'なかま（しゅるい）で わける' },
  ],
  misconceptions: [
    {
      id: 'color-mix',
      explain: 'いろが ちがったかな。はこの いろと えの いろを くらべて みよう。',
    },
    {
      id: 'kind-mix',
      explain: 'なかまが ちがったかな。たべものかな、どうぶつかな、のりものかな。',
    },
  ],
  levels: [
    { label: '2さいの だんかい: いろで 1まいずつ', chance: 0.25 },
    { label: '3さいの だんかい: いろで 4まい', chance: 1 / 16 },
    { label: '3さいの だんかい: なかまで わける', chance: 1 / 16 },
  ],
  intro: [
    { text: 'あかい りんごは、あかの はこへ。', figure: ill('apple') },
    { text: 'きいろい バナナは、きいろの はこへ。', figure: ill('banana') },
  ],
  source: { kind: 'items', items: build() },
  review: 'none',
  basis: '保育所保育指針 1歳以上3歳未満児 環境、curriculum-matrix 3.1（簡単な仕分け）',
  revised: '2026-10-24',
};
