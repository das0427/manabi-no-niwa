/**
 * p23.ja.sound-play おとあそび: なきごえ・オノマトペ（curriculum-matrix 3.1）。
 * L2（段階0）: なきごえを きいて どうぶつ（2択）。L3（段階1）: ものの おと（オノマトペ）を きいて えらぶ。
 * なきごえは ことば（「もーもー」）で鳴らす。実際の録音は使わない。
 * 同一性キー: 聞く音のことば（＋別例の言い方）。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import { ill, listenItem, others } from './lib';

interface Snd {
  illust: string;
  name: string;
  sound: string;
}
const ANIMALS: Snd[] = [
  { illust: 'dog', name: 'いぬ', sound: 'わんわん' },
  { illust: 'cat', name: 'ねこ', sound: 'にゃーにゃー' },
  { illust: 'cow', name: 'うし', sound: 'もーもー' },
  { illust: 'chick', name: 'ひよこ', sound: 'ぴよぴよ' },
  { illust: 'frog', name: 'かえる', sound: 'けろけろ' },
  { illust: 'monkey', name: 'さる', sound: 'うっきっきー' },
  { illust: 'elephant', name: 'ぞう', sound: 'ぱおーん' },
  { illust: 'fox', name: 'きつね', sound: 'こんこん' },
  { illust: 'bird', name: 'とり', sound: 'ちゅんちゅん' },
  { illust: 'p23-pig', name: 'ぶた', sound: 'ぶーぶー' },
  { illust: 'p23-sheep', name: 'ひつじ', sound: 'めーめー' },
  { illust: 'p23-duck', name: 'あひる', sound: 'があがあ' },
];
const THINGS: Snd[] = [
  { illust: 'car-red', name: 'くるま', sound: 'ぶるるーん' },
  { illust: 'train', name: 'でんしゃ', sound: 'がたんごとん' },
  { illust: 'airplane', name: 'ひこうき', sound: 'びゅーん' },
  { illust: 'bicycle', name: 'じてんしゃ', sound: 'ちりんちりん' },
  { illust: 'ball', name: 'ボール', sound: 'ころころ' },
  { illust: 'scissors', name: 'はさみ', sound: 'ちょきちょき' },
  { illust: 'umbrella', name: 'かさ', sound: 'ぱっ、ひらいた' },
  { illust: 'p23-clock', name: 'とけい', sound: 'ちくたく' },
  { illust: 'ship', name: 'ふね', sound: 'ぼー' },
  { illust: 'p23-toothbrush', name: 'はぶらし', sound: 'しゃかしゃか' },
];

function animalItem(s: Snd, level: number, alt: boolean): Item {
  const wrong = others(`a:${s.illust}:${level}`, ANIMALS, s, level === 0 ? 1 : 2);
  const id = `${alt ? 'animal-say' : 'animal'}:${s.sound}`;
  return listenItem({
    id: `${id}:${level}`,
    objective: 'animal',
    level,
    alt,
    prompt: alt ? 'だれが いって いるのかな？' : 'だれの こえかな？',
    audio: { text: alt ? `${s.sound}って なくのは だれ？` : `${s.sound}` },
    hints: [
      'もういちど きいて、まねして いって みよう。',
      `「${s.sound}」って なく どうぶつだよ。`,
    ],
    explain: `${s.name}は「${s.sound}」。`,
    identity: id,
    correct: { label: s.name, figure: ill(s.illust) },
    wrong: wrong.map((w) => ({
      label: w.name,
      figure: ill(w.illust),
      misconception: 'other-animal',
    })),
  });
}

function thingItem(s: Snd, alt: boolean): Item {
  const wrong = others(`t:${s.illust}`, THINGS, s, 2);
  const id = `${alt ? 'thing-say' : 'thing'}:${s.sound}`;
  return listenItem({
    id,
    objective: 'thing',
    level: 1,
    alt,
    prompt: alt ? 'この おとが するのは どれ？' : 'なんの おとかな？',
    audio: { text: alt ? `${s.sound}。この おとが するのは なあに？` : s.sound },
    hints: ['もういちど きいて、まねして いって みよう。', `${s.name}は どんな おとが するかな。`],
    explain: `${s.name}は「${s.sound}」。`,
    identity: id,
    correct: { label: s.name, figure: ill(s.illust) },
    wrong: wrong.map((w) => ({
      label: w.name,
      figure: ill(w.illust),
      misconception: 'other-thing',
    })),
  });
}

function build(): Item[] {
  const items: Item[] = [];
  ANIMALS.forEach((a, i) => {
    items.push(animalItem(a, 0, false));
    if (i % 4 === 1) items.push(animalItem(a, 1, true));
  });
  THINGS.forEach((t, i) => {
    items.push(thingItem(t, false));
    if (i % 3 === 0) items.push(thingItem(t, true));
  });
  return items;
}

export const soundPlay: UnitSpec = {
  id: 'p23.ja.sound-play',
  title: 'おとあそび',
  stage: 'p23',
  subject: 'ja',
  domain: 'play',
  kind: 'play',
  priority: 'P1',
  status: 'ready',
  icon: 'p23-duck',
  prereq: [],
  objectives: [
    { id: 'animal', title: 'なきごえを きいて どうぶつを えらぶ' },
    { id: 'thing', title: 'ものの おと（オノマトペ）' },
  ],
  misconceptions: [
    {
      id: 'other-animal',
      explain: 'その どうぶつは ちがう こえで なくよ。もういちど きいて みよう。',
    },
    { id: 'other-thing', explain: 'それは ちがう おとが するね。もういちど きいて みよう。' },
  ],
  levels: [
    { label: '2さいの だんかい: なきごえ（2つから）', chance: 0.5 },
    { label: '3さいの だんかい: いろいろな おと（3つから）', chance: 1 / 3 },
  ],
  intro: [{ text: '「わんわん」と なくのは いぬ。', figure: ill('dog') }],
  source: { kind: 'items', items: build() },
  review: 'none',
  basis: '幼稚園教育要領 言葉（言葉の響きやリズム）、curriculum-matrix 3.1',
  revised: '2026-10-24',
};
