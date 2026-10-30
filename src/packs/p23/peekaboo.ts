/**
 * p23.think.peekaboo どこかな（curriculum-matrix 3.1。設計書 docs/expansion/p2-design/p23.md 2章）。
 * すこし みえて いる からだの一部から、かくれた ばしょ・かくれた どうぶつを みつける（2択・段階0のみ）。
 * 同一性キー: 動物 ＋ 問い方（find / whose / find-ear / who-hid）。誤りの相手は同一性に入れない。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import { choiceItem, ill, listenItem } from './lib';

type Place = 'cup' | 'box';
interface Animal {
  key: string;
  name: string;
  full: string;
  part: string;
  feature: string;
  /** whose の誤りの相手 */
  other: string;
  /** whose のヒント2 */
  hint2: string;
  place: Place;
}
const A = (
  key: string,
  name: string,
  full: string,
  part: string,
  feature: string,
  other: string,
  hint2: string,
  place: Place,
): Animal => ({ key, name, full, part, feature, other, hint2, place });

const ANIMALS: Animal[] = [
  A(
    'rabbit',
    'うさぎ',
    'rabbit',
    'みみ',
    'ながい みみ',
    'fox',
    'うさぎさんの みみは ながいね。',
    'cup',
  ),
  A(
    'bear',
    'くま',
    'bear',
    'みみ',
    'まるい みみ',
    'elephant',
    'くまさんの みみは まるいね。',
    'box',
  ),
  A(
    'elephant',
    'ぞう',
    'elephant',
    'はな',
    'ながい はな',
    'cat',
    'ぞうさんの はなは ながいね。',
    'cup',
  ),
  A(
    'fox',
    'きつね',
    'fox',
    'しっぽ',
    'ふさふさの しっぽ',
    'turtle',
    'きつねさんの しっぽは ふさふさだね。',
    'box',
  ),
  A(
    'turtle',
    'かめ',
    'turtle',
    'こうら',
    'まるい こうら',
    'duck',
    'かめさんの こうらは まるいね。',
    'cup',
  ),
  A(
    'duck',
    'あひる',
    'p23-duck',
    'くちばし',
    'とがった くちばし',
    'pig',
    'あひるさんの くちばしは とがって いるね。',
    'box',
  ),
  A(
    'pig',
    'ぶた',
    'p23-pig',
    'しっぽ',
    'くるんとした しっぽ',
    'rabbit',
    'ぶたさんの しっぽは くるんと して いるね。',
    'cup',
  ),
  A(
    'cat',
    'ねこ',
    'cat',
    'みみ',
    'さんかくの みみ',
    'duck',
    'ねこさんの みみは さんかくだね。',
    'box',
  ),
];
const get = (k: string): Animal => ANIMALS.find((a) => a.key === k)!;
const opposite = (p: Place): Place => (p === 'cup' ? 'box' : 'cup');
const PLACE_WORD: Record<Place, string> = { cup: 'カップ', box: 'はこ' };
const peekId = (a: Animal | string, p: Place) =>
  `p23-peek-${typeof a === 'string' ? a : a.key}-${p}`;

/** 隠れた場所を探す問題（find / find-ear）の選択肢 */
const findOptions = (a: Animal, p: Place) => ({
  correct: { figure: ill(peekId(a, p)) },
  wrong: [{ figure: ill(`p23-hide-${p}`), misconception: 'empty' }],
});

function findItem(a: Animal): Item {
  const id = `find:${a.key}`;
  return choiceItem({
    id,
    identity: id,
    objective: 'find',
    level: 0,
    prompt: `${a.name}さんが かくれたよ。どっちかな？`,
    figure: ill(a.full),
    hints: [
      `${PLACE_WORD[a.place]}を よく みてね。なにか みえて いるかな？`,
      `${a.name}さんの ${a.feature}を さがそう。`,
    ],
    explain: `${a.part}が みえて いたね。${a.name}さんは ここに かくれて いたよ。`,
    ...findOptions(a, a.place),
  });
}

function findEarItem(a: Animal): Item {
  const p = opposite(a.place);
  const id = `find-ear:${a.key}`;
  return listenItem({
    id,
    identity: id,
    objective: 'find',
    level: 0,
    alt: true,
    prompt: 'きいてね。どっちに いるかな？',
    audio: { text: `${a.name}さん、どーこだ？` },
    hints: ['もういちど きいてね。', 'すこし みえて いる ところが ある ほうを さがそう。'],
    explain: `${a.part}が みえて いたね。${a.name}さんは ここに かくれて いたよ。`,
    ...findOptions(a, p),
  });
}

function whoseItem(a: Animal): Item {
  const o = get(a.other);
  const id = `whose:${a.key}`;
  return choiceItem({
    id,
    identity: id,
    objective: 'whose',
    level: 0,
    prompt: `${a.name}さんは どっちに かくれた？`,
    figure: ill(a.full),
    hints: ['みえて いる ところを くらべて みよう。', a.hint2],
    explain: `${a.part}が みえて いたね。${a.name}さんは ここに かくれて いたよ。`,
    correct: { figure: ill(peekId(a, a.place)) },
    wrong: [{ figure: ill(peekId(o, a.place)), misconception: 'other-animal' }],
  });
}

function whoHidItem(a: Animal): Item {
  const o = get(a.other);
  const p = opposite(a.place);
  const id = `who-hid:${a.key}`;
  return choiceItem({
    id,
    identity: id,
    objective: 'whose',
    level: 0,
    alt: true,
    prompt: 'かくれて いるのは だれ？',
    figure: ill(peekId(a, p)),
    hints: [
      'みえて いる ところを よく みてね。',
      'その かたちは ながい？ まるい？ にて いる どうぶつを さがそう。',
    ],
    explain: `${a.feature}が みえて いたね。かくれて いたのは ${a.name}さん。`,
    correct: { label: a.name, figure: ill(a.full) },
    wrong: [{ label: o.name, figure: ill(o.full), misconception: 'other-animal' }],
  });
}

function build(): Item[] {
  return [
    ...ANIMALS.map(findItem),
    ...ANIMALS.map(whoseItem),
    ...['bear', 'fox', 'duck', 'cat'].map((k) => findEarItem(get(k))),
    ...['rabbit', 'elephant', 'turtle', 'pig'].map((k) => whoHidItem(get(k))),
  ];
}

export const peekaboo: UnitSpec = {
  id: 'p23.think.peekaboo',
  title: 'どこかな',
  stage: 'p23',
  subject: 'think',
  domain: 'play',
  kind: 'play',
  priority: 'P2',
  status: 'ready',
  icon: 'p23-peek-rabbit-cup',
  prereq: [],
  objectives: [
    { id: 'find', title: 'すこし みえて いる ところから、かくれた ばしょを みつける' },
    { id: 'whose', title: 'みえて いる ところが だれの からだか わかる' },
  ],
  misconceptions: [
    {
      id: 'empty',
      explain:
        'かくれたら なにも みえないと かんがえたのかな。すこし みえて いる ところを さがして みよう。',
    },
    {
      id: 'other-animal',
      explain:
        'ほかの どうぶつの からだだと かんがえたのかな。みみや しっぽの かたちを くらべて みよう。',
    },
  ],
  levels: [{ label: '3さいの だんかい: かくれた どうぶつ（2つから）', chance: 0.5 }],
  intro: [
    {
      text: 'うさぎさんが カップに かくれたよ。ながい みみが みえて いるね。',
      figure: ill('p23-peek-rabbit-cup'),
    },
  ],
  source: { kind: 'items', items: build() },
  review: 'none',
  basis:
    '本アプリ独自（記憶力・知能の向上はうたわない）、curriculum-matrix 3.1・4.1（memory の B4 を2〜3歳向けに縮小。かくれる動きの代わりに、みえて いる からだの一部で さがす: 設計書 p23.md 0.5）',
  revised: '2026-10-30',
};
