/**
 * p23.math.puzzle2 えあわせ（curriculum-matrix 3.1。設計書 docs/expansion/p2-design/p23.md 3章）。
 * 絵を左右に半分に切った札で、あう はんぶんを えらぶ（2択・段階0のみ）。
 * 同一性キー: 絵 ＋ 問い方（右を選ぶ / 左を選ぶ / 部分から全体）。誤りの絵は同一性に入れない。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import { choiceItem, ill } from './lib';

interface Pic {
  p: string;
  name: string;
  full: string;
}
const PICS: Pic[] = [
  { p: 'apple', name: 'りんご', full: 'apple' },
  { p: 'tomato', name: 'トマト', full: 'tomato' },
  { p: 'car', name: 'くるま', full: 'car-red' },
  { p: 'bus', name: 'バス', full: 'bus-yellow' },
  { p: 'elephant', name: 'ぞう', full: 'elephant' },
  { p: 'turtle', name: 'かめ', full: 'turtle' },
  { p: 'umbrella', name: 'かさ', full: 'umbrella' },
  { p: 'ship', name: 'ふね', full: 'ship' },
];
const pic = (p: string): Pic => PICS.find((x) => x.p === p)!;
const puz = (p: string, side: string) => `p23-puz-${p}-${side}`;

type Mis = 'similar-look' | 'other-picture' | 'same-side';
/** [絵, 誤りの絵 id, 誤概念] */
const RIGHT: [string, string, Mis][] = [
  ['apple', 'p23-puz-tomato-r', 'similar-look'],
  ['tomato', 'p23-puz-car-r', 'other-picture'],
  ['car', 'p23-puz-bus-r', 'similar-look'],
  ['bus', 'p23-puz-bus-l', 'same-side'],
  ['elephant', 'p23-puz-turtle-r', 'similar-look'],
  ['turtle', 'p23-puz-umbrella-r', 'other-picture'],
  ['umbrella', 'p23-puz-ship-r', 'other-picture'],
  ['ship', 'p23-puz-ship-l', 'same-side'],
];
const LEFT: [string, string, Mis][] = [
  ['apple', 'p23-puz-elephant-l', 'other-picture'],
  ['tomato', 'p23-puz-apple-l', 'similar-look'],
  ['car', 'p23-puz-car-r', 'same-side'],
  ['bus', 'p23-puz-car-l', 'similar-look'],
  ['elephant', 'p23-puz-ship-l', 'other-picture'],
  ['turtle', 'p23-puz-elephant-l', 'similar-look'],
  ['umbrella', 'p23-puz-bus-l', 'other-picture'],
  ['ship', 'p23-puz-ship-r', 'same-side'],
];

function halfItem(side: 'right' | 'left', p: string, wrongId: string, mis: Mis): Item {
  const x = pic(p);
  const id = `half:${side}:${p}`;
  return choiceItem({
    id,
    identity: id,
    objective: side === 'right' ? 'right' : 'left',
    level: 0,
    prompt: `${x.name}を つくろう。どっちかな？`,
    figure: ill(puz(p, side === 'right' ? 'lslot' : 'rslot')),
    hints: [
      'きれて いる ところを よく みてね。',
      `${x.name}の かたちを おもいだそう。いろと かたちが つながるかな。`,
    ],
    explain: `きれめが ぴったり あったね。${x.name}の できあがり。`,
    explainFigure: ill(x.full),
    correct: { figure: ill(puz(p, side === 'right' ? 'r' : 'l')) },
    wrong: [{ figure: ill(wrongId), misconception: mis }],
  });
}

/** 別例: 部分から全体を言い当てる。[絵, 誤りの絵(全身), 誤概念] */
function wholeItem(side: 'right' | 'left', p: string, wrongFull: string, mis: Mis): Item {
  const x = pic(p);
  const w = PICS.find((y) => y.full === wrongFull)!;
  const id = `whole:${side}:${p}`;
  return choiceItem({
    id,
    identity: id,
    objective: side === 'right' ? 'right' : 'left',
    level: 0,
    alt: true,
    prompt: 'これは なんの えかな？',
    figure: ill(puz(p, side === 'right' ? 'l' : 'r')),
    hints: [
      'みえて いる ところの いろと かたちを みてね。',
      'のこりの はんぶんを あたまの なかで つなげて みよう。',
    ],
    explain: `はんぶんでも わかったね。${x.name}の えだよ。`,
    explainFigure: ill(x.full),
    correct: { label: x.name, figure: ill(x.full) },
    wrong: [{ label: w.name, figure: ill(w.full), misconception: mis }],
  });
}

function build(): Item[] {
  return [
    ...RIGHT.map(([p, w, m]) => halfItem('right', p, w, m)),
    ...LEFT.map(([p, w, m]) => halfItem('left', p, w, m)),
    wholeItem('right', 'apple', 'tomato', 'similar-look'),
    wholeItem('right', 'car', 'bus-yellow', 'similar-look'),
    wholeItem('right', 'elephant', 'turtle', 'similar-look'),
    wholeItem('right', 'umbrella', 'ship', 'other-picture'),
    wholeItem('left', 'tomato', 'apple', 'similar-look'),
    wholeItem('left', 'bus', 'car-red', 'similar-look'),
    wholeItem('left', 'turtle', 'elephant', 'similar-look'),
    wholeItem('left', 'ship', 'umbrella', 'other-picture'),
  ];
}

export const puzzle2: UnitSpec = {
  id: 'p23.math.puzzle2',
  title: 'えあわせ',
  stage: 'p23',
  subject: 'math',
  domain: 'play',
  kind: 'play',
  priority: 'P2',
  status: 'ready',
  icon: 'p23-puz-apple-lslot',
  prereq: ['p23.math.shape-match'],
  objectives: [
    { id: 'right', title: 'ひだりの はんぶんに あう みぎの はんぶんを えらぶ' },
    { id: 'left', title: 'みぎの はんぶんに あう ひだりの はんぶんを えらぶ' },
  ],
  misconceptions: [
    {
      id: 'similar-look',
      explain:
        'いろや なかまが にて いるから おなじだと かんがえたのかな。きれた ところが ぴったり つながるか みて みよう。',
    },
    {
      id: 'other-picture',
      explain: 'どれでも くっつくと かんがえたのかな。いろと かたちが つながるか みて みよう。',
    },
    {
      id: 'same-side',
      explain: 'おなじ えだから いいと かんがえたのかな。きれて いる ほうが はんたいだよ。',
    },
  ],
  levels: [{ label: '3さいの だんかい: 2まいの えあわせ（2つから）', chance: 0.5 }],
  intro: [
    {
      text: 'はんぶんの りんご。もう はんぶんを くっつけると、りんごの できあがり。',
      figure: { kind: 'row', items: [ill('p23-puz-apple-lslot'), ill('apple')] },
    },
  ],
  source: { kind: 'items', items: build() },
  review: 'none',
  basis:
    '保育所保育指針 1歳以上3歳未満児 環境（物の形）、研究メモ EC2.1（簡単なパズル）、curriculum-matrix 3.1・4.1（shapes の K2 を2ピース・置き場所の線ありに縮小）',
  revised: '2026-10-30',
};
