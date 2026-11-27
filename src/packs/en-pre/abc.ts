/**
 * p5.en.abc えいごの もじ（設計書 5.13。P2・既定で隠す・知識）。幼児の画面に英字を出す唯一の単元。
 * 保護者が「はじめは かくれている単元」で開いたときだけ子供に見える。
 * ねらい: 大文字を見て、文字の名前（エー・ビー…の英語の言い方）を聞いて分かる。文字が表す音（フォニックス）・小文字・書く練習はしない。
 * 選択肢は `{ figure: { kind: 'text', text: '<大文字>', size: 'xl' }, sound: 文字の名前 }`。label は付けない
 * （英字もカタカナの読み（エー・ビー）も書かない。カタカナの読みは英語の名前とずれる字がある）。
 * 同一性キー: abc:<x>（段階0・1。段階1の id は :1）・find:<x>（別例「Find the letter B.」）。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { enKey, HINTS, ill, listen, mix, preUnit, twice, type EnSound } from './lib';

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** 文字の名前の音素（強勢つきの IPA。設計書 5.13。試聴で崩れる字は misaki 風に直す） */
export const LETTER_IPA: Record<string, string> = {
  A: 'ˈeɪ',
  B: 'bˈiː',
  C: 'sˈiː',
  D: 'dˈiː',
  E: 'ˈiː',
  F: 'ˈɛf',
  G: 'dʒˈiː',
  H: 'ˈeɪtʃ',
  I: 'ˈaɪ',
  J: 'dʒˈeɪ',
  K: 'kˈeɪ',
  L: 'ˈɛl',
  M: 'ˈɛm',
  N: 'ˈɛn',
  O: 'ˈoʊ',
  P: 'pˈiː',
  Q: 'kjˈuː',
  R: 'ˈɑːɹ',
  S: 'ˈɛs',
  T: 'tˈiː',
  U: 'jˈuː',
  V: 'vˈiː',
  W: 'dˈʌbəljˌuː',
  X: 'ˈɛks',
  Y: 'wˈaɪ',
  Z: 'zˈiː',
};

/** 別例の文の音素（文全体を phonemes で固定する。A が冠詞 /ə/ と読まれないように） */
export const findPhonemes = (L: string): string => `fˈaɪnd ðə lˈɛɾɚ ${LETTER_IPA[L]}.`;

export const letterSound = (L: string): EnSound => enKey('abc', L.toLowerCase(), `${L}.`);
export const findSound = (L: string): EnSound =>
  enKey('find', `find-the-letter-${L.toLowerCase()}`, `Find the letter ${L}.`);

/** 音のなかま（文字の名前の母音） */
export const SOUND_GROUPS: string[][] = [
  ['B', 'C', 'D', 'E', 'G', 'P', 'T', 'V', 'Z'], // いー
  ['A', 'H', 'J', 'K'], // えい
  ['F', 'L', 'M', 'N', 'S', 'X'], // えー
  ['I', 'Y'], // あい
  ['Q', 'U', 'W'], // ゆー
  ['O'], // おう
  ['R'], // あー
];
const soundGroupOf = (L: string): number => SOUND_GROUPS.findIndex((g) => g.includes(L));

/** 形の組（形が似ている字） */
export const SHAPE_PAIRS: [string, string][] = [
  ['B', 'P'],
  ['B', 'R'],
  ['B', 'D'],
  ['P', 'R'],
  ['C', 'G'],
  ['C', 'O'],
  ['D', 'O'],
  ['O', 'Q'],
  ['G', 'Q'],
  ['E', 'F'],
  ['E', 'B'],
  ['I', 'L'],
  ['I', 'T'],
  ['I', 'J'],
  ['J', 'L'],
  ['K', 'X'],
  ['K', 'R'],
  ['M', 'N'],
  ['M', 'W'],
  ['N', 'H'],
  ['N', 'Z'],
  ['U', 'V'],
  ['V', 'W'],
  ['V', 'Y'],
  ['X', 'Y'],
  ['S', 'Z'],
  ['A', 'H'],
];
export const isShapePair = (a: string, b: string): boolean =>
  SHAPE_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/** 段階0の遠い字: 音のなかまが同じでなく、形の組にも入らない字 */
export const isFar = (a: string, b: string): boolean =>
  a !== b && soundGroupOf(a) !== soundGroupOf(b) && !isShapePair(a, b);

type Mis = 'shape' | 'sound' | 'other-letter';
/** 段階1の誤り（全件。shape＝形が似る、sound＝名前の音が似る、other-letter） */
export const WRONG_TABLE: Record<string, [string, Mis][]> = {
  A: [
    ['H', 'sound'],
    ['K', 'sound'],
    ['R', 'other-letter'],
  ],
  B: [
    ['P', 'shape'],
    ['D', 'sound'],
    ['V', 'sound'],
  ],
  C: [
    ['G', 'shape'],
    ['O', 'shape'],
    ['Z', 'sound'],
  ],
  D: [
    ['B', 'sound'],
    ['O', 'shape'],
    ['T', 'sound'],
  ],
  E: [
    ['F', 'shape'],
    ['B', 'sound'],
    ['T', 'sound'],
  ],
  F: [
    ['E', 'shape'],
    ['S', 'sound'],
    ['X', 'sound'],
  ],
  G: [
    ['C', 'shape'],
    ['Z', 'sound'],
    ['J', 'sound'],
  ],
  H: [
    ['N', 'shape'],
    ['A', 'sound'],
    ['K', 'sound'],
  ],
  I: [
    ['L', 'shape'],
    ['T', 'shape'],
    ['Y', 'sound'],
  ],
  J: [
    ['L', 'shape'],
    ['G', 'sound'],
    ['K', 'sound'],
  ],
  K: [
    ['X', 'shape'],
    ['A', 'sound'],
    ['Q', 'sound'],
  ],
  L: [
    ['J', 'shape'],
    ['M', 'sound'],
    ['N', 'sound'],
  ],
  M: [
    ['N', 'sound'],
    ['W', 'shape'],
    ['L', 'sound'],
  ],
  N: [
    ['M', 'sound'],
    ['H', 'shape'],
    ['Z', 'shape'],
  ],
  O: [
    ['Q', 'shape'],
    ['C', 'shape'],
    ['D', 'shape'],
  ],
  P: [
    ['R', 'shape'],
    ['B', 'sound'],
    ['T', 'sound'],
  ],
  Q: [
    ['O', 'shape'],
    ['G', 'shape'],
    ['U', 'sound'],
  ],
  R: [
    ['P', 'shape'],
    ['K', 'shape'],
    ['L', 'other-letter'],
  ],
  S: [
    ['F', 'sound'],
    ['X', 'sound'],
    ['Z', 'shape'],
  ],
  T: [
    ['I', 'shape'],
    ['D', 'sound'],
    ['P', 'sound'],
  ],
  U: [
    ['V', 'shape'],
    ['Q', 'sound'],
    ['W', 'sound'],
  ],
  V: [
    ['B', 'sound'],
    ['U', 'shape'],
    ['Y', 'shape'],
  ],
  W: [
    ['M', 'shape'],
    ['V', 'shape'],
    ['U', 'sound'],
  ],
  X: [
    ['K', 'shape'],
    ['Y', 'shape'],
    ['S', 'sound'],
  ],
  Y: [
    ['V', 'shape'],
    ['X', 'shape'],
    ['I', 'sound'],
  ],
  Z: [
    ['N', 'shape'],
    ['G', 'sound'],
    ['C', 'sound'],
  ],
};

export const letterFigure = (L: string): Figure => ({ kind: 'text', text: L, size: 'xl' });

/** label を付けない選択肢（英字もカタカナの読みも書かない。読み上げの名前は「1ばん」…） */
const letterOpt = (L: string, extra: { correct?: true; misconception?: string }): ChoiceOption => ({
  figure: letterFigure(L),
  sound: letterSound(L),
  ...extra,
});

const objOf = (L: string): 'first' | 'middle' | 'last' =>
  L <= 'I' ? 'first' : L <= 'R' ? 'middle' : 'last';

function abcItem(L: string, level: 0 | 1, find: boolean): Item {
  const identity = `${find ? 'find' : 'abc'}:${L.toLowerCase()}`;
  const id = level === 1 ? `${identity}:1` : identity;
  const wrong: ChoiceOption[] =
    level === 0
      ? mix(
          `${id}:w`,
          LETTERS.filter((x) => isFar(L, x)),
        )
          .slice(0, 2)
          .map((x) => letterOpt(x, { misconception: 'other-letter' }))
      : WRONG_TABLE[L]!.map(([x, m]) => letterOpt(x, { misconception: m }));
  return listen({
    id,
    objective: objOf(L),
    level,
    prompt: 'えいごを きいてね。どの もじかな？',
    audio: find ? [findSound(L)] : twice(letterSound(L)),
    options: [letterOpt(L, { correct: true }), ...wrong],
    hints: HINTS,
    explain: 'この もじの なまえだよ。いっしょに いって みよう。',
    explainFigure: letterFigure(L),
    identity,
    alt: find,
    revealAudio: [{ text: 'いっしょに いって みよう。' }, letterSound(L), letterSound(L)],
  });
}

function items(): Item[] {
  const out: Item[] = [];
  for (const L of LETTERS) out.push(abcItem(L, 0, false));
  for (const L of LETTERS) out.push(abcItem(L, 0, true));
  for (const L of LETTERS) out.push(abcItem(L, 1, false));
  return out;
}

export const p5Abc: UnitSpec = preUnit({
  id: 'p5.en.abc',
  title: 'えいごの もじ',
  stage: 'p5',
  icon: 'enpre-blocks',
  priority: 'P2',
  kind: 'knowledge',
  hiddenByDefault: true,
  objectives: [
    { id: 'first', title: 'はじめの ほうの もじの なまえを きく' },
    { id: 'middle', title: 'まんなかの もじの なまえを きく' },
    { id: 'last', title: 'おわりの ほうの もじの なまえを きく' },
  ],
  misconceptions: [
    { id: 'shape', explain: 'かたちが にて いる もじだね。もういちど きいて みよう。' },
    {
      id: 'sound',
      explain: 'なまえの おとが にて いる もじだね。さいごまで よく きいて みよう。',
    },
    { id: 'other-letter', explain: 'ちがう もじだったね。もういちど きいて みよう。' },
  ],
  levels: [
    { label: 'もじ（3たく）', chance: 1 / 3 },
    { label: 'にた もじも（4たく）', chance: 0.25 },
  ],
  intro: [
    {
      text: 'えいごの もじの なまえを きいて、もじを えらぶ あそびだよ。',
      figure: letterFigure('A'),
    },
    {
      text: 'おうちの ひとと いっしょに、まねして いって みよう。',
      figure: ill('enpre-icon'),
    },
  ],
  source: { kind: 'items', items: items() },
  parentNote:
    '英語の大文字と、その名前（エー、ビー…）を聞いて選ぶ遊びです。小学3年の英語で、文字の名前を聞いて分かることを学びます。その前の親しみとして、興味があるときだけ開いてください。文字の音（フォニックス）や書く練習はしません。',
});
