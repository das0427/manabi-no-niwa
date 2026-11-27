/**
 * p23.ja.first-sound はじめの おと（curriculum-matrix 3.1。設計書 docs/expansion/p2-design/p23.md 1章）。
 * L3 のみの単元だが、段階は1つ（段階0）にして 2択だけで作る。2歳段階の子には ホームの札で出さない。
 * 文字を出さない: 語頭の音は audio だけで聞かせ、問題文・選択肢・ヒントに1字を書かない。
 * 同一性キー: 問う語（＋ 練習・となえ歌・耳だけ の別）。誤りの語の組は同じとみなす。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import { ill, listenItem, others } from './lib';

type Row = 'あ' | 'か' | 'た' | 'は' | 'さ' | 'ば';
type Cat = 'animal' | 'food' | 'thing';
interface Word {
  name: string;
  illust: string;
  head: string;
  row: Row;
  cat: Cat;
}
const W = (name: string, illust: string, head: string, row: Row, cat: Cat): Word => ({
  name,
  illust,
  head,
  row,
  cat,
});

/** 語頭が同じ2語が相方（mate） */
const WORDS: Word[] = [
  W('いぬ', 'dog', 'い', 'あ', 'animal'),
  W('いちご', 'strawberry', 'い', 'あ', 'food'),
  W('うさぎ', 'rabbit', 'う', 'あ', 'animal'),
  W('うし', 'cow', 'う', 'あ', 'animal'),
  W('かめ', 'turtle', 'か', 'か', 'animal'),
  W('かさ', 'umbrella', 'か', 'か', 'thing'),
  W('くま', 'bear', 'く', 'か', 'animal'),
  W('くるま', 'car-red', 'く', 'か', 'thing'),
  W('たこ', 'octopus', 'た', 'た', 'animal'),
  W('たまご', 'egg', 'た', 'た', 'food'),
  W('とり', 'bird', 'と', 'た', 'animal'),
  W('とけい', 'p23-clock', 'と', 'た', 'thing'),
  W('はさみ', 'scissors', 'は', 'は', 'thing'),
  W('はぶらし', 'p23-toothbrush', 'は', 'は', 'thing'),
  W('ひよこ', 'chick', 'ひ', 'は', 'animal'),
  W('ひこうき', 'airplane', 'ひ', 'は', 'thing'),
  W('すいか', 'watermelon', 'す', 'さ', 'food'),
  W('スプーン', 'p23-spoon', 'す', 'さ', 'thing'),
  W('バナナ', 'banana', 'ば', 'ば', 'food'),
  W('バス', 'bus-yellow', 'ば', 'ば', 'thing'),
];

const byName = (n: string): Word => WORDS.find((w) => w.name === n)!;
const mateOf = (w: Word): Word => WORDS.find((x) => x !== w && x.head === w.head)!;

/** 誤りの語は 行が違う語。は行 と ば行 は組にしない（点の有無だけの違いは3歳に難しい） */
const farRow = (w: Word) => (x: Word) =>
  x.row !== w.row && !((x.row === 'は' && w.row === 'ば') || (x.row === 'ば' && w.row === 'は'));

const wrongOf = (key: string, w: Word): Word => others(key, WORDS, w, 1, farRow(w))[0]!;

const opt = (w: Word) => ({ label: w.name, figure: ill(w.illust) });

function soundItem(w: Word, alt: boolean): Item {
  const c = wrongOf(`sound:${w.name}`, w);
  const id = `${alt ? 'chant' : 'sound'}:${w.name}`;
  return {
    ...listenItem({
      id,
      identity: id,
      objective: 'sound',
      level: 0,
      alt,
      prompt: alt ? 'きいてね。どれかな？' : 'この おとで はじまるのは どっち？',
      audio: {
        text: alt
          ? `${w.head}、${w.head}、${w.head}。この おとで はじまるのは、どーれだ？`
          : w.head,
      },
      hints: [
        'もういちど おとを きいて、まねして いって みよう。',
        'えの なまえを ゆっくり いって、はじめの おとを くらべよう。',
      ],
      explain: `${w.name}は「${w.head}」で はじまるね。`,
      correct: opt(w),
      wrong: [{ ...opt(c), misconception: 'other-sound' }],
    }),
    hideTranscript: true,
  };
}

function sameItem(a: Word, alt: boolean): Item {
  const b = mateOf(a);
  const c = wrongOf(`same:${a.name}`, a);
  const id = `${alt ? 'ear' : 'same'}:${a.name}`;
  return listenItem({
    id,
    identity: id,
    objective: 'same',
    level: 0,
    alt,
    prompt: alt ? 'おなじ おとで はじまるのは どっち？' : 'この えと おなじ おとで はじまるのは？',
    audio: { text: a.name },
    ...(alt ? {} : { figure: ill(a.illust) }),
    hints: alt
      ? [
          'もういちど きいて、まねして いって みよう。',
          'きいた ことばを ゆっくり いって、はじめの おとで とめて みよう。',
        ]
      : [
          'えの なまえを ゆっくり いって みよう。',
          `${a.name}を ゆっくり いって、はじめの おとで とめて みよう。`,
        ],
    explain: `${a.name}と ${b.name}は、どちらも「${a.head}」で はじまるね。`,
    correct: opt(b),
    wrong: [{ ...opt(c), misconception: c.cat === a.cat ? 'same-group' : 'other-sound' }],
  });
}

function build(): Item[] {
  const items: Item[] = [];
  for (const w of WORDS) items.push(soundItem(w, false));
  for (const w of WORDS) items.push(sameItem(w, false));
  for (const n of ['いちご', 'くるま', 'ひよこ', 'バナナ']) items.push(soundItem(byName(n), true));
  for (const n of ['うし', 'かさ', 'たまご', 'とけい']) items.push(sameItem(byName(n), true));
  return items;
}

export const firstSound: UnitSpec = {
  id: 'p23.ja.first-sound',
  title: 'はじめの おと',
  stage: 'p23',
  subject: 'ja',
  domain: 'play',
  kind: 'play',
  priority: 'P2',
  status: 'ready',
  icon: 'strawberry',
  prereq: ['p23.ja.word-listen'],
  objectives: [
    { id: 'sound', title: 'おとを きいて、その おとで はじまる えを えらぶ' },
    { id: 'same', title: 'おなじ おとで はじまる ことばを みつける' },
  ],
  misconceptions: [
    {
      id: 'other-sound',
      explain:
        'まんなかや おわりの おとを きいたのかな。いちばん はじめの おとを くらべて みよう。',
    },
    {
      id: 'same-group',
      explain:
        'おなじ なかまだから えらんだのかな。なかまでは なく、はじめの おとを きいて みよう。',
    },
  ],
  levels: [{ label: '3さいの だんかい: はじめの おと（2つから）', chance: 0.5 }],
  intro: [
    {
      text: '「いちご」と「いぬ」。はじめの おとが おなじだね。',
      figure: { kind: 'row', items: [ill('strawberry'), ill('dog')] },
    },
  ],
  source: { kind: 'items', items: build() },
  review: 'none',
  basis:
    '保育所保育指針 1歳以上3歳未満児 言葉、幼稚園教育要領 言葉（言葉の響きやリズム）、研究メモ EC2.2（絵と音は文字より先）、curriculum-matrix 3.1',
  revised: '2026-10-30',
};
