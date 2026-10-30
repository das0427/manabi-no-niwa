/**
 * p5.en.shop おみせやさん（設計書 5.10）: お客さんの注文を聞いて、品物を選んで渡す。
 * 答えの後に「Here you are.」「Thank you!」を聞き、親子でやりとりする（画面の外でも）。
 * 段階0: 「An apple, please.」（品物4択）。段階1: 「Two bananas, please.」（数 1〜5 × 品物9。パンは数えない）。
 * 段階2: まぜて。別例は「Can I have an apple, please?」。
 * 同一性キー: shop:<品物>・num:<数>-<品物>（別例は can:<品物>・cann:<数>-<品物>）。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import { en, enKey, HINTS, ill, intro, listen, mix, opt, preUnit, type EnSound } from './lib';
import { FOODS, NUMBER_WORDS, type Word } from './vocab';

interface Food {
  w: Word;
  /** 注文の英文: 「An apple, please.」 */
  single: string;
  /** 数えられるか（パンは数えない） */
  countable: boolean;
  plural: string;
}

const PLURAL: Record<string, string> = {
  strawberry: 'strawberries',
  tomato: 'tomatoes',
  peach: 'peaches',
};
const FOOD_ITEMS: Food[] = FOODS.map((w): Food => {
  const vowel = /^[aeiou]/.test(w.id);
  return w.id === 'bread'
    ? { w, single: 'Some bread, please.', countable: false, plural: 'bread' }
    : {
        w,
        single: `${vowel ? 'An' : 'A'} ${w.id}, please.`,
        countable: true,
        plural: PLURAL[w.id] ?? `${w.id}s`,
      };
});
const COUNTABLE = FOOD_ITEMS.filter((f) => f.countable);

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const numPhrase = (n: number, f: Food) =>
  `${cap(NUMBER_WORDS[n]!)} ${n === 1 ? f.w.id : f.plural}, please.`;
const canSingle = (f: Food) =>
  f.w.id === 'bread'
    ? 'Can I have some bread, please?'
    : `Can I have ${/^[aeiou]/.test(f.w.id) ? 'an' : 'a'} ${f.w.id}, please?`;
const canNum = (n: number, f: Food) =>
  `Can I have ${NUMBER_WORDS[n]} ${n === 1 ? f.w.id : f.plural}, please?`;

const singleSound = (f: Food): EnSound => en('shop', f.single);
const numSound = (n: number, f: Food): EnSound => en('shop', numPhrase(n, f));

const REPLY: EnSound[] = [
  enKey('reply', 'here-you-are', 'Here you are.'),
  enKey('hello', 'thank-you', 'Thank you!'),
];
const EXPLAIN_END = '「はい どうぞ」「ありがとう」。おうちの ひとと やりとり して みよう。';

const MIS_NEAR_NUMBER = {
  id: 'near-number',
  explain: 'ひとつ ちがいだね。いっしょに かぞえて みよう。',
};
const MIS_OTHER_ITEM = {
  id: 'other-item',
  explain: 'かずは あって いたね。しなものを きいて みよう。',
};
const MIS_BOTH = { id: 'both', explain: 'もういちど さいごまで きいて みよう。' };
const MIS_OTHER_FOOD = {
  id: 'other-food',
  explain: 'ちがう しなものだったね。もういちど きいて みよう。',
};

const itemOpt = (f: Food, extra: { correct?: true; misconception?: string }): ChoiceOption =>
  opt({ label: f.w.ja, figure: ill(f.w.illust), sound: singleSound(f) }, extra);
const countOpt = (
  k: number,
  f: Food,
  extra: { correct?: true; misconception?: string },
): ChoiceOption => ({ figure: ill(f.w.illust, k), sound: numSound(k, f), ...extra });

function singleItem(f: Food, level: number, alt: boolean): Item {
  const identity = alt ? `can:${f.w.id}` : `shop:${f.w.id}`;
  const id = level === 0 && !alt ? identity : alt ? identity : `${identity}:${level}`;
  const wrong = mix(
    `${id}:w`,
    FOOD_ITEMS.filter((x) => x !== f),
  ).slice(0, 3);
  return listen({
    id,
    objective: 'item',
    level,
    prompt: 'おきゃくさんの えいごを きいてね。どれを わたす？',
    audio: [alt ? en('shop', canSingle(f)) : singleSound(f)],
    options: [
      itemOpt(f, { correct: true }),
      ...wrong.map((x) => itemOpt(x, { misconception: MIS_OTHER_FOOD.id })),
    ],
    hints: HINTS,
    explain: EXPLAIN_END,
    identity,
    alt,
    revealAudio: REPLY,
  });
}

/** 数ちがい（±1） */
const nearOf = (n: number, key: string): number => {
  if (n === 1) return 2;
  if (n === 5) return 4;
  return mix(key, [n - 1, n + 1])[0]!;
};

function numItem(n: number, f: Food, level: number, alt: boolean): Item {
  const identity = alt ? `cann:${n}-${f.w.id}` : `num:${n}-${f.w.id}`;
  const id = alt || level === 1 ? identity : `${identity}:${level}`;
  const near = nearOf(n, `${id}:n`);
  const other = mix(
    `${id}:o`,
    COUNTABLE.filter((x) => x !== f),
  );
  const f2 = other[0]!;
  const f3 = other[1]!;
  const far = mix(
    `${id}:f`,
    [1, 2, 3, 4, 5].filter((k) => k !== n && k !== near),
  )[0]!;
  return listen({
    id,
    objective: 'number',
    level,
    prompt: 'おきゃくさんの えいごを きいてね。どれを わたす？',
    audio: [alt ? en('shop', canNum(n, f)) : numSound(n, f)],
    options: [
      countOpt(n, f, { correct: true }),
      countOpt(near, f, { misconception: MIS_NEAR_NUMBER.id }),
      countOpt(n, f2, { misconception: MIS_OTHER_ITEM.id }),
      countOpt(far, f3, { misconception: MIS_BOTH.id }),
    ],
    hints: HINTS,
    explain: EXPLAIN_END,
    identity,
    alt,
    revealAudio: REPLY,
  });
}

function items(): Item[] {
  const out: Item[] = [];
  // 段階0: 品物（4択）。別例は段階2に置く
  for (const f of FOOD_ITEMS) out.push(singleItem(f, 0, false));
  // 段階1: 数 1〜5 × 品物9
  for (const f of COUNTABLE) for (let n = 1; n <= 5; n++) out.push(numItem(n, f, 1, false));
  // 段階2: まぜて（品物10＋数 27）。別例は「Can I have 〜?」
  for (const f of FOOD_ITEMS) out.push(singleItem(f, 2, false));
  COUNTABLE.forEach((f, i) => {
    for (let k = 0; k < 3; k++) out.push(numItem(((i + k * 2) % 5) + 1, f, 2, false));
  });
  for (const f of FOOD_ITEMS) out.push(singleItem(f, 2, true));
  COUNTABLE.slice(0, 6).forEach((f, i) => out.push(numItem((i % 5) + 1, f, 2, true)));
  return out;
}

export const p5Shop: UnitSpec = preUnit({
  id: 'p5.en.shop',
  title: 'おみせやさん',
  stage: 'p5',
  icon: 'apple',
  objectives: [
    { id: 'item', title: 'ちゅうもんの しなものを きく' },
    { id: 'number', title: 'ちゅうもんの かずと しなものを きく' },
  ],
  misconceptions: [MIS_OTHER_FOOD, MIS_NEAR_NUMBER, MIS_OTHER_ITEM, MIS_BOTH],
  levels: [
    { label: 'しなもの（4たく）', chance: 0.25 },
    { label: 'かずと しなもの（4たく）', chance: 0.25 },
    { label: 'まぜて（4たく）', chance: 0.25 },
  ],
  intro: intro(ill('apple'), 'おきゃくさんの えいごを きいて、しなものを わたす あそびだよ。'),
  source: { kind: 'items', items: items() },
  parentNote:
    'お店屋さんごっこの英語です。大人がお客さん（『An apple, please.』）、お子さんがお店の人（『Here you are.』）になって、画面の外でもやりとりしてみてください。',
});
