/**
 * p23.ja.word-listen なまえあて: ことばを きいて えを えらぶ（curriculum-matrix 3.1）。
 * L2（段階0）: たべもの・どうぶつの 2択。L3（段階1）: のりもの・もの も入れた 3択。
 * 別例: ことばを 文の中で きく（「〇〇は どこかな」）。
 * 同一性キー: 聞く語（＋文の中かどうか）。誤りの絵の組は同じとみなす（1.4 知識）。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import { ill, listenItem, others } from './lib';

interface Word {
  illust: string;
  name: string;
  cat: 'food' | 'animal' | 'thing';
}
const W = (illust: string, name: string, cat: Word['cat']): Word => ({ illust, name, cat });

export const WORDS: Word[] = [
  W('apple', 'りんご', 'food'),
  W('banana', 'バナナ', 'food'),
  W('mikan', 'みかん', 'food'),
  W('strawberry', 'いちご', 'food'),
  W('carrot', 'にんじん', 'food'),
  W('tomato', 'トマト', 'food'),
  W('bread', 'パン', 'food'),
  W('egg', 'たまご', 'food'),
  W('onigiri', 'おにぎり', 'food'),
  W('watermelon', 'すいか', 'food'),
  W('peach', 'もも', 'food'),
  W('lemon', 'レモン', 'food'),
  W('cucumber', 'きゅうり', 'food'),
  W('dog', 'いぬ', 'animal'),
  W('cat', 'ねこ', 'animal'),
  W('rabbit', 'うさぎ', 'animal'),
  W('elephant', 'ぞう', 'animal'),
  W('bear', 'くま', 'animal'),
  W('monkey', 'さる', 'animal'),
  W('cow', 'うし', 'animal'),
  W('turtle', 'かめ', 'animal'),
  W('bird', 'とり', 'animal'),
  W('fox', 'きつね', 'animal'),
  W('chick', 'ひよこ', 'animal'),
  W('frog', 'かえる', 'animal'),
  W('octopus', 'たこ', 'animal'),
  W('p23-pig', 'ぶた', 'animal'),
  W('car-red', 'くるま', 'thing'),
  W('bus-yellow', 'バス', 'thing'),
  W('train', 'でんしゃ', 'thing'),
  W('airplane', 'ひこうき', 'thing'),
  W('ship', 'ふね', 'thing'),
  W('bicycle', 'じてんしゃ', 'thing'),
  W('ball', 'ボール', 'thing'),
  W('umbrella', 'かさ', 'thing'),
  W('pencil', 'えんぴつ', 'thing'),
  W('scissors', 'はさみ', 'thing'),
  W('flower', 'はな', 'thing'),
  W('tree', 'き', 'thing'),
  W('p23-shoe', 'くつ', 'thing'),
  W('p23-hat', 'ぼうし', 'thing'),
  W('p23-cup', 'コップ', 'thing'),
];

const OBJ: Record<Word['cat'], string> = { food: 'food', animal: 'animal', thing: 'thing' };

function item(w: Word, level: number, alt: boolean): Item {
  const n = level === 0 ? 1 : 2;
  // 誤りの絵: L2 は同じ仲間から（たべもの同士・どうぶつ同士）、L3 はいろいろな仲間から
  const wrong = others(`${w.illust}:${level}`, WORDS, w, n, (x) =>
    level === 0 ? x.cat === w.cat : true,
  );
  const id = `${alt ? 'sentence' : 'word'}:${w.illust}`;
  const sentence = w.cat === 'animal' ? `${w.name}さんは どこかな？` : `${w.name}は どこかな？`;
  return listenItem({
    id: `${id}:${level}`,
    objective: OBJ[w.cat],
    level,
    alt,
    prompt: alt ? 'きいてね。どれかな？' : 'きいてね。どっちかな？',
    audio: { text: alt ? sentence : w.name },
    hints: ['もういちど よく きいてね。', `はじめの おとは「${[...w.name][0]}」だよ。`],
    explain: `${w.name}だね。`,
    identity: id,
    correct: { label: w.name, figure: ill(w.illust) },
    wrong: wrong.map((x) => ({
      label: x.name,
      figure: ill(x.illust),
      misconception: 'other-word',
    })),
  });
}

function build(): Item[] {
  const items: Item[] = [];
  WORDS.forEach((w, i) => {
    // たべもの・どうぶつは L2（段階0）、もの・のりものは L3（段階1）
    const level = w.cat === 'thing' ? 1 : 0;
    // 各なかまの 4つおきに、文の中で聞く別例を足す
    items.push(item(w, level, false));
    if (i % 4 === 0) items.push(item(w, 1, true));
  });
  return items;
}

export const wordListen: UnitSpec = {
  id: 'p23.ja.word-listen',
  title: 'なまえあて',
  stage: 'p23',
  subject: 'ja',
  domain: 'play',
  kind: 'play',
  priority: 'P1',
  status: 'ready',
  icon: 'listen',
  prereq: [],
  objectives: [
    { id: 'food', title: 'たべものの なまえ' },
    { id: 'animal', title: 'どうぶつの なまえ' },
    { id: 'thing', title: 'のりもの・ものの なまえ' },
  ],
  misconceptions: [
    {
      id: 'other-word',
      explain: 'それも すてきだね。きこえたのは どれだったかな。もういちど きこう。',
    },
    { id: 'similar-sound', explain: 'にている おとだね。さいごまで よく きいて みよう。' },
  ],
  levels: [
    { label: '2さいの だんかい: たべもの・どうぶつ（2つから）', chance: 0.5 },
    { label: '3さいの だんかい: いろいろな もの（3つから）', chance: 1 / 3 },
  ],
  intro: [{ text: 'ことばを きいて、おなじ えを さがそう。「いぬ」', figure: ill('dog') }],
  source: { kind: 'items', items: build() },
  review: 'none',
  basis: '保育所保育指針 1歳以上3歳未満児 言葉（簡単な言葉を聞き分ける）、curriculum-matrix 3.1',
  revised: '2026-10-24',
};
