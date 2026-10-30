/**
 * p4.en.where かくれんぼ（設計書 5.8。P2）: in / on / under を聞いて、どうぶつが ベッドの どこに いるかを選ぶ。
 * どうぶつ3（cat・dog・rabbit。p4.en.words の既習語）× ばしょ3（in・on・under）＝ 9場面。
 * 段階0は同じ どうぶつの3つの ばしょ（3択）、段階1は どうぶつも ばしょも ちがう選択肢（4択）。
 * 別例は「Where is the cat?」（p4.en.words の where の音声）→ 答えだけ「In the bed.」。
 * 同一性キー: pos:<animal>-<pos>・posqa:・whopos:・whoposqa:（id も同じ）。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import { en, HINTS, ill, intro, listen, mix, opt, preUnit, twice, type EnSound } from './lib';
import { WORD_BY_ID, whereSound } from './vocab';

export type Pos = 'in' | 'on' | 'under';
export const POSITIONS: Pos[] = ['in', 'on', 'under'];
export const WHERE_ANIMALS = ['cat', 'dog', 'rabbit'] as const;
type Animal = (typeof WHERE_ANIMALS)[number];

/** ばしょの日本語（label・解説） */
export const POS_JA: Record<Pos, string> = { in: 'なか', on: 'うえ', under: 'した' };

export const posSentence = (a: Animal, p: Pos): string => `The ${a} is ${p} the bed.`;
export const posSound = (a: Animal, p: Pos): EnSound => en('pos', posSentence(a, p));
export const posAnswerSound = (p: Pos): EnSound =>
  en('pos', `${p[0]!.toUpperCase()}${p.slice(1)} the bed.`);
export const whereIllust = (a: Animal, p: Pos): string => `enpre-where-${a}-${p}`;

const animalJa = (a: Animal): string => WORD_BY_ID[a]!.ja;
const label = (a: Animal, p: Pos): string => `ベッドの ${POS_JA[p]}の ${animalJa(a)}`;

const whereOpt = (
  a: Animal,
  p: Pos,
  extra: { correct?: true; misconception?: string },
): ChoiceOption =>
  opt({ label: label(a, p), figure: ill(whereIllust(a, p)), sound: posSound(a, p) }, extra);

/** in と on は短く似た音（in-on）。under が絡めば other-place */
const placeMis = (right: Pos, x: Pos): string =>
  (right === 'in' && x === 'on') || (right === 'on' && x === 'in') ? 'in-on' : 'other-place';

function whereItem(a: Animal, p: Pos, level: number, qa: boolean): Item {
  const identity = `${level === 0 ? 'pos' : 'whopos'}${qa ? 'qa' : ''}:${a}-${p}`;
  const id = identity;
  let wrong: ChoiceOption[];
  if (level === 0) {
    // 同じ どうぶつの、ほかの2つの ばしょ
    wrong = POSITIONS.filter((x) => x !== p).map((x) =>
      whereOpt(a, x, { misconception: placeMis(p, x) }),
    );
  } else {
    const others = mix(
      `${id}:a`,
      WHERE_ANIMALS.filter((x) => x !== a),
    );
    const otherPlaces = POSITIONS.filter((x) => x !== p);
    // 同じ どうぶつの別の ばしょ: in・on が正解ならもう一方、under が正解なら in か on
    const samePlace: Pos =
      p === 'under' ? mix(`${id}:p`, ['in', 'on'] as Pos[])[0]! : p === 'in' ? 'on' : 'in';
    // 別の どうぶつの別の ばしょ（同じ どうぶつの別の ばしょと ちがうものを選べるなら そちら）
    const bothPlace = mix(`${id}:q`, otherPlaces).find((x) => x !== samePlace) ?? otherPlaces[0]!;
    wrong = [
      whereOpt(a, samePlace, { misconception: placeMis(p, samePlace) }),
      whereOpt(others[0]!, p, { misconception: 'other-animal' }),
      whereOpt(others[1]!, bothPlace, { misconception: 'both' }),
    ];
  }
  return listen({
    id,
    objective: level === 0 ? 'pos' : 'who-pos',
    level,
    prompt: 'えいごを きいてね。どこに いるかな？',
    audio: qa ? [whereSound(WORD_BY_ID[a]!), posAnswerSound(p)] : twice(posSound(a, p)),
    options: [whereOpt(a, p, { correct: true }), ...wrong],
    hints: HINTS,
    explain: `${animalJa(a)}が ベッドの ${POS_JA[p]}に いるね。`,
    identity,
    alt: qa,
    revealAudio: [posSound(a, p)],
  });
}

function items(): Item[] {
  const out: Item[] = [];
  for (const level of [0, 1])
    for (const qa of [false, true])
      for (const a of WHERE_ANIMALS)
        for (const p of POSITIONS) out.push(whereItem(a, p, level, qa));
  return out;
}

export const p4Where: UnitSpec = preUnit({
  id: 'p4.en.where',
  title: 'かくれんぼ',
  stage: 'p4',
  icon: 'enpre-where-cat-under',
  priority: 'P2',
  prereq: ['p4.en.words'],
  objectives: [
    { id: 'pos', title: 'どこに いるかの えいごを きく' },
    { id: 'who-pos', title: 'だれが どこに いるかを きく' },
  ],
  misconceptions: [
    { id: 'in-on', explain: 'にて いる おとだね。さいごまで よく きいて みよう。' },
    { id: 'other-place', explain: 'ばしょの ことばを よく きいて みよう。' },
    { id: 'other-animal', explain: 'ばしょは あって いたね。どうぶつの なまえも きいて みよう。' },
    {
      id: 'both',
      explain: 'どうぶつも ばしょも ちがったね。もういちど さいごまで きいて みよう。',
    },
  ],
  levels: [
    { label: 'どこかな（3たく）', chance: 1 / 3 },
    { label: 'だれが どこ（4たく）', chance: 0.25 },
  ],
  intro: intro(
    ill('enpre-where-cat-in'),
    'えいごを きいて、どうぶつが どこに いるか えらぶ あそびだよ。',
  ),
  source: { kind: 'items', items: items() },
  parentNote:
    '『in（なか）』『on（うえ）』『under（した）』を聞き分ける遊びです。おもちゃを箱やいすの上・下に置いて、英語で言い合ってみてください。',
});
