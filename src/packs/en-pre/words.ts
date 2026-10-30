/**
 * p23.en.words・p4.en.words えいごで タッチ（設計書 5.1・5.3）:
 * 英語を2回聞く → 聞いた語の絵を1つ触る → 触った物の英語の名前が返ってくる（随伴的なタッチ＋名前を返す）。
 * 同一性キー: `<形式>:<目当ての語>`（hear:dog・it:dog・where:dog）。誤りの選択肢の組は同じとみなす（curriculum-matrix 1.4）。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import { ill, intro, preUnit } from './lib';
import {
  ANIMALS,
  BODY,
  FOODS,
  P23_ANIMAL_FOOD,
  P23_MORE,
  RIDE_THING,
  ALL_WORDS,
  type Word,
} from './vocab';
import { MIS_BODY_NEAR, MIS_OTHER_GROUP, MIS_SAME_GROUP, MIS_SAME_START, wordItem } from './wordq';

/** 別例（It's a dog. の形）にする語: なかまの中で1つおき */
const altOf = (xs: readonly Word[]): Word[] => xs.filter((_, i) => i % 2 === 0);

// ---- p23.en.words ----
function p23Items(): Item[] {
  const items: Item[] = [];
  // 段階0（L2・2択）: どうぶつ・たべもの。誤りは同じなかまから1つ
  for (const w of P23_ANIMAL_FOOD)
    items.push(
      wordItem({
        w,
        level: 0,
        form: 'hear',
        objective: 'animal-food',
        pool: P23_ANIMAL_FOOD,
        n: 2,
      }),
    );
  for (const w of altOf(P23_ANIMAL_FOOD))
    items.push(
      wordItem({
        w,
        level: 0,
        form: 'it',
        objective: 'animal-food',
        pool: P23_ANIMAL_FOOD,
        n: 2,
        alt: true,
      }),
    );
  // 段階1（L3・3択）: のりもの・ものを足す。誤りは同じなかまから2つ
  const all = [...P23_ANIMAL_FOOD, ...P23_MORE];
  for (const w of all)
    items.push(
      wordItem({
        w,
        level: 1,
        form: 'hear',
        objective: P23_MORE.includes(w) ? 'more' : 'animal-food',
        pool: all,
        n: 3,
        sameStart: true,
      }),
    );
  for (const w of altOf(P23_MORE))
    items.push(
      wordItem({
        w,
        level: 1,
        form: 'it',
        objective: 'more',
        pool: all,
        n: 3,
        sameStart: true,
        alt: true,
      }),
    );
  return items;
}

export const p23Words: UnitSpec = preUnit({
  id: 'p23.en.words',
  title: 'えいごで タッチ',
  stage: 'p23',
  icon: 'dog',
  objectives: [
    { id: 'animal-food', title: 'どうぶつ・たべものの えいごを きく' },
    { id: 'more', title: 'のりもの・ものの えいごを きく' },
  ],
  misconceptions: [MIS_SAME_GROUP, MIS_SAME_START],
  levels: [
    { label: 'どうぶつ・たべもの（2たく）', chance: 0.5 },
    { label: 'のりもの・ものも（3たく）', chance: 1 / 3 },
  ],
  intro: intro(ill('dog')),
  source: { kind: 'items', items: p23Items() },
  parentNote:
    '英語を聞いて絵を選ぶ遊びです。お子さんが絵を指さしたら、いっしょに英語で言ってみてください（正しく言えたかは気にしなくて大丈夫です）。',
});

// ---- p4.en.words ----
const BODY_WORDS = BODY;

function p4Items(): Item[] {
  const items: Item[] = [];
  const objOf = (w: Word) =>
    w.group === 'animal'
      ? 'animal'
      : w.group === 'food'
        ? 'food'
        : w.group === 'body'
          ? 'body'
          : 'ride-thing';
  for (const w of ALL_WORDS) {
    const objective = objOf(w);
    // 段階0: 1語を2回・3択（同じなかまから）
    items.push(
      wordItem({ w, level: 0, form: 'hear', objective, pool: ALL_WORDS, n: 3, sameStart: true }),
    );
    // 段階1: 「Where is the 〜?」3択
    items.push(
      wordItem({ w, level: 1, form: 'where', objective, pool: ALL_WORDS, n: 3, sameStart: true }),
    );
    // 段階2: 1語を2回・4択（ちがうなかまを混ぜる）
    items.push(
      wordItem({ w, level: 2, form: 'hear', objective, pool: ALL_WORDS, n: 4, mixGroups: true }),
    );
  }
  // 別例（It's a dog. / This is my nose.）: なかまの中で1つおき（各到達項目 3 以上）
  for (const group of [ANIMALS, FOODS, RIDE_THING, BODY_WORDS])
    for (const w of altOf(group))
      items.push(
        wordItem({
          w,
          level: 0,
          form: 'it',
          objective: objOf(w),
          pool: ALL_WORDS,
          n: 3,
          sameStart: true,
          alt: true,
        }),
      );
  return items;
}

export const p4Words: UnitSpec = preUnit({
  id: 'p4.en.words',
  title: 'えいごで タッチ',
  stage: 'p4',
  icon: 'dog',
  objectives: [
    { id: 'animal', title: 'どうぶつの えいごを きく' },
    { id: 'food', title: 'たべものの えいごを きく' },
    { id: 'ride-thing', title: 'のりもの・ものの えいごを きく' },
    { id: 'body', title: 'からだの えいごを きく' },
  ],
  misconceptions: [MIS_SAME_GROUP, MIS_SAME_START, MIS_OTHER_GROUP, MIS_BODY_NEAR],
  levels: [
    { label: '1ごを 2かい（3たく）', chance: 1 / 3 },
    { label: 'みじかい ぶん（3たく）', chance: 1 / 3 },
    { label: 'いろいろな なかま（4たく）', chance: 0.25 },
  ],
  intro: intro(ill('dog')),
  source: { kind: 'items', items: p4Items() },
  parentNote:
    '『Where is the dog?（いぬはどこ？）』のような短い文も出てきます。絵本や散歩のときに、同じ言葉を英語で言ってみるのもおすすめです。',
});
