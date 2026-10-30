/**
 * p4.en.hello あいさつ（設計書 5.6）: あいさつ・きもちを聞いて、その場面の絵を選ぶ。
 * あいさつは毎日の決まった場面で親子で言い合うと続けやすい（保護者画面の一言）。
 * 同一性キー: greet:<あいさつ>・feel:<きもち>（別例は greetx:・feelx:）。
 * 版 0.2: あいさつ 7（I'm sorry.・Happy birthday! を足す）・きもち 8（angry・thirsty・hot・cold を足す）。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import { enKey, HINTS, ill, intro, listen, mix, opt, preUnit, twice, type EnSound } from './lib';

interface Phrase {
  id: string;
  kind: 'greet' | 'feel';
  ja: string;
  illust: string;
  /** 場面の名前を付けた解説 */
  explain: string;
  /** 台本 */
  sound: EnSound;
  /** 別例の台本（名前を付けた形・感嘆の形） */
  altSound: EnSound;
}

function slugOfAlt(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const G = (
  id: string,
  slug: string,
  text: string,
  ja: string,
  illust: string,
  altText: string,
  over: { explain?: string; altSlug?: string } = {},
): Phrase => ({
  id,
  kind: 'greet',
  ja,
  illust,
  explain: over.explain ?? `「${ja}」の ばめんだよ。`,
  sound: enKey('hello', slug, text),
  altSound: enKey('hello', over.altSlug ?? slugOfAlt(altText), altText),
});
const F = (id: string, text: string, ja: string, illust: string, explain?: string): Phrase => ({
  id,
  kind: 'feel',
  ja,
  illust,
  explain: explain ?? `「${ja}」の きもちだよ。`,
  sound: enKey('feel', `im-${id}`, text),
  altSound: enKey('feelx', `im-${id}`, text.replace(/\.$/, '!')),
});

/** あいさつ 7 */
export const GREETS: Phrase[] = [
  G('hello', 'hello', 'Hello!', 'こんにちは', 'enpre-meet', 'Hello, rabbit!'),
  G('morning', 'good-morning', 'Good morning!', 'おはよう', 'p23-sun', 'Good morning, bear!'),
  G('night', 'good-night', 'Good night!', 'おやすみ', 'p5-moon', 'Good night, dog!'),
  G('thanks', 'thank-you', 'Thank you!', 'ありがとう', 'enpre-gift', 'Thank you, cat!'),
  G('bye', 'bye-bye', 'Bye-bye!', 'ばいばい', 'enpre-bye', 'Bye-bye, monkey!'),
  G('sorry', 'im-sorry', "I'm sorry.", 'ごめんね', 'enpre-sorry', "I'm sorry, bear.", {
    altSlug: 'im-sorry-bear',
  }),
  G(
    'birthday',
    'happy-birthday',
    'Happy birthday!',
    'おめでとう',
    'enpre-birthday',
    'Happy birthday, rabbit!',
    { explain: '「おたんじょうび おめでとう」の ばめんだよ。' },
  ),
];
/** きもち・からだの ようす 8 */
export const FEELS: Phrase[] = [
  F('happy', "I'm happy.", 'うれしい', 'eng34-face-happy'),
  F('sad', "I'm sad.", 'かなしい', 'eng34-face-sad'),
  F('angry', "I'm angry.", 'おこった', 'eng34-face-angry'),
  F('sleepy', "I'm sleepy.", 'ねむい', 'eng34-face-sleepy'),
  F('hungry', "I'm hungry.", 'おなかが すいた', 'eng34-face-hungry'),
  F(
    'thirsty',
    "I'm thirsty.",
    'のどが かわいた',
    'eng34-face-thirsty',
    '「のどが かわいた」の ようすだよ。',
  ),
  F('hot', "I'm hot.", 'あつい', 'eng34-face-hot', '「あつい」の ようすだよ。'),
  F('cold', "I'm cold.", 'さむい', 'eng34-face-cold', '「さむい」の ようすだよ。'),
];
const ALL = [...GREETS, ...FEELS];

const PAIRS = (a: Phrase, b: Phrase, pairs: readonly (readonly [string, string])[]): boolean =>
  pairs.some(([x, y]) => (a.id === x && b.id === y) || (a.id === y && b.id === x));

/**
 * 同じ問題に並べない組（clash）:
 *   hello と bye（どちらも手をふる場面）、birthday と happy（どちらにも happy の音）、
 *   sorry と sad（I'm s… で始まり、最後の語の頭の音も同じ）、morning と hot（どちらの絵にも おひさま がある）
 */
export const CLASH_PAIRS = [
  ['hello', 'bye'],
  ['birthday', 'happy'],
  ['sorry', 'sad'],
  ['morning', 'hot'],
] as const;
const clash = (a: Phrase, b: Phrase) => PAIRS(a, b, CLASH_PAIRS);
/** はじめが同じ言葉（Good morning / Good night。誤りに必ず入れる） */
const goodPair = (a: Phrase, b: Phrase) => PAIRS(a, b, [['morning', 'night']]);
/** はじめが同じ言葉（上の組に加え、greet の I'm sorry と feel の I'm 〜。段階2で同じ問題に出たとき） */
const sameStart = (a: Phrase, b: Phrase) =>
  goodPair(a, b) ||
  (a.id === 'sorry' && b.kind === 'feel') ||
  (b.id === 'sorry' && a.kind === 'feel');
/** よく にた ようす（hungry と thirsty、hot と cold。段階1では先に入れる） */
export const PAIR_FEEL_PAIRS = [
  ['hungry', 'thirsty'],
  ['hot', 'cold'],
] as const;
const pairFeel = (a: Phrase, b: Phrase) => PAIRS(a, b, PAIR_FEEL_PAIRS);

const phraseOpt = (p: Phrase, extra: { correct?: true; misconception?: string }): ChoiceOption =>
  opt({ label: p.ja, figure: ill(p.illust), sound: p.sound }, extra);

/** misOf は sameStart → pair-feel → other-feel／other-scene の順 */
const misOf = (p: Phrase, x: Phrase): string =>
  sameStart(p, x)
    ? 'same-start'
    : pairFeel(p, x)
      ? 'pair-feel'
      : p.kind === 'feel' && x.kind === 'feel'
        ? 'other-feel'
        : 'other-scene';

function helloItem(p: Phrase, level: number, n: number, pool: Phrase[], alt: boolean): Item {
  const base = `${p.kind}${alt ? 'x' : ''}:${p.id}`;
  const id = level === (p.kind === 'greet' ? 0 : 1) ? base : `${base}:${level}`;
  const cand = pool.filter((x) => x.id !== p.id && !clash(x, p));
  // 先に入れる: Good morning ↔ Good night。段階1（きもち）では よく にた ようす（hungry↔thirsty・hot↔cold）
  const wrong: Phrase[] = cand.filter((x) => goodPair(p, x) || (level === 1 && pairFeel(p, x)));
  for (const x of mix(`${id}:w`, cand)) {
    if (wrong.length >= n - 1) break;
    // 衝突する組（hello・bye など）は1問に1つまで
    if (wrong.includes(x) || wrong.some((y) => clash(x, y))) continue;
    wrong.push(x);
  }
  return listen({
    id,
    objective: p.kind === 'greet' ? 'greet' : 'feel',
    level,
    prompt: 'えいごを きいてね。どの ばめんかな？',
    audio: alt ? [p.altSound] : twice(p.sound),
    options: [
      phraseOpt(p, { correct: true }),
      ...wrong.slice(0, n - 1).map((x) => phraseOpt(x, { misconception: misOf(p, x) })),
    ],
    hints: HINTS,
    explain: p.explain,
    identity: base,
    alt,
    revealAudio: [{ text: 'おうちの ひとと いって みよう。' }, p.sound],
  });
}

function items(): Item[] {
  const out: Item[] = [];
  for (const p of GREETS) out.push(helloItem(p, 0, 3, GREETS, false));
  for (const p of GREETS) out.push(helloItem(p, 0, 3, GREETS, true));
  for (const p of FEELS) out.push(helloItem(p, 1, 3, FEELS, false));
  for (const p of FEELS) out.push(helloItem(p, 1, 3, FEELS, true));
  for (const p of ALL) out.push(helloItem(p, 2, 4, ALL, false));
  return out;
}

export const p4Hello: UnitSpec = preUnit({
  id: 'p4.en.hello',
  title: 'あいさつ',
  stage: 'p4',
  icon: 'enpre-meet',
  objectives: [
    { id: 'greet', title: 'あいさつの えいごを きく' },
    { id: 'feel', title: 'きもちや からだの ようすの えいごを きく' },
  ],
  misconceptions: [
    { id: 'other-scene', explain: 'ちがう ばめんの ことばだね。もういちど きいて みよう。' },
    { id: 'same-start', explain: 'はじめが おなじ ことばだね。さいごまで きいて みよう。' },
    { id: 'other-feel', explain: 'ちがう きもちだったね。もういちど きいて みよう。' },
    { id: 'pair-feel', explain: 'よく にた ようすだね。さいごまで きいて みよう。' },
  ],
  levels: [
    { label: 'あいさつ（3たく）', chance: 1 / 3 },
    { label: 'きもち（3たく）', chance: 1 / 3 },
    { label: 'まぜて（4たく）', chance: 0.25 },
  ],
  intro: intro(ill('enpre-meet')),
  source: { kind: 'items', items: items() },
  parentNote:
    '朝の『Good morning』、寝る前の『Good night』など、毎日の決まった場面で英語のあいさつを言い合うと、楽しく続けられます。',
});
