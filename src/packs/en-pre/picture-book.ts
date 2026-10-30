/**
 * p4.en.picture-book えいごの えほん（設計書 5.7・6.10）。
 * 本はすべて本アプリのオリジナル（1冊4ページ。ページごとに絵1つと短い英文1つ。くり返しの形）。
 * 段階0・1: 4ページの文を順に聞き、最後にもう一度聞こえたページを選ぶ（4ページの絵の帯つき）。
 * 段階2: 4ページの文を聞いて、さいしょ（別例はさいご）のページを選ぶ（絵の帯なし）。
 * 4ページの文は1つの音声列（間 900ms）。1200ms の間は作れないので、ページの間と同じ 900ms にする。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { enKey, HINTS, ill, intro, listen, mix, opt, preUnit, type EnSound } from './lib';

interface Page {
  text: string;
  /** 絵 */
  figure: Figure;
  /** ページの日本語の名前（選択肢の label・解説） */
  ja: string;
}
interface Book {
  id: string;
  ja: string;
  pages: [Page, Page, Page, Page];
}

const P = (text: string, illust: string, ja: string): Page => ({
  text,
  figure: ill(illust),
  ja,
});

export const BOOKS: Book[] = [
  {
    id: 'hello',
    ja: 'こんにちは',
    pages: [
      P('Hello, dog!', 'dog', 'いぬ'),
      P('Hello, cat!', 'cat', 'ねこ'),
      P('Hello, bird!', 'bird', 'とり'),
      P('Hello, everyone!', 'enpre-meet', 'みんな'),
    ],
  },
  {
    id: 'yummy',
    ja: 'おいしい',
    pages: [
      P('An apple. Yummy!', 'apple', 'りんご'),
      P('A banana. Yummy!', 'banana', 'バナナ'),
      P('A strawberry. Yummy!', 'strawberry', 'いちご'),
      P("I'm full!", 'eng34-face-happy', 'おなかいっぱい'),
    ],
  },
  {
    id: 'jump',
    ja: 'ぴょん',
    pages: [
      P('Jump, frog!', 'frog', 'かえる'),
      P('Jump, rabbit!', 'rabbit', 'うさぎ'),
      P('Jump, monkey!', 'monkey', 'さる'),
      P('Jump, jump, jump!', 'enpre-act-jump', 'ジャンプ'),
    ],
  },
  {
    id: 'sky',
    ja: 'おそら',
    pages: [
      P('A little star.', 'p23-star', 'ほし'),
      P('A big moon.', 'p5-moon', 'おつきさま'),
      P('A warm sun.', 'p23-sun', 'おひさま'),
      P('Good night!', 'eng34-face-sleepy', 'ねむい'),
    ],
  },
  {
    id: 'beep',
    ja: 'ぶっぶー',
    pages: [
      P('A red car. Beep, beep!', 'car-red', 'あかい くるま'),
      P('A yellow bus. Beep, beep!', 'bus-yellow', 'きいろい バス'),
      P('A big ship. Toot, toot!', 'ship', 'おおきな ふね'),
      P('Bye-bye!', 'enpre-bye', 'ばいばい'),
    ],
  },
  {
    id: 'clap',
    ja: 'てを たたこう',
    pages: [
      P('Clap your hands!', 'enpre-act-clap', 'はくしゅ'),
      P('Stomp your feet!', 'enpre-act-stomp', 'あしぶみ'),
      P('Turn around!', 'enpre-act-turn', 'まわる'),
      P('Sit down!', 'enpre-act-sit', 'すわる'),
    ],
  },
];

const pageSound = (b: Book, i: number): EnSound =>
  enKey('book', `${b.id}-${i + 1}`, b.pages[i]!.text);
const pageOpt = (
  b: Book,
  i: number,
  extra: { correct?: true; misconception?: string },
): ChoiceOption =>
  opt({ label: b.pages[i]!.ja, figure: b.pages[i]!.figure, sound: pageSound(b, i) }, extra);

const strip = (b: Book): Figure => ({
  kind: 'row',
  items: b.pages.map((p) => p.figure),
  gap: 1.6,
});

const allPages = (b: Book): EnSound[] => b.pages.map((_, i) => pageSound(b, i));

const MIS_OTHER_PAGE = {
  id: 'other-page',
  explain: 'おなじ えほんの ちがう ページだね。もういちど きいて みよう。',
};
const MIS_LAST_PAGE = {
  id: 'last-page',
  explain: 'さいごの ページだね。さいしょは どれかな。',
};
const MIS_MIDDLE_PAGE = {
  id: 'middle-page',
  explain: 'まんなかの ページだね。もういちど きいて みよう。',
};
const MIS_FIRST_PAGE = {
  id: 'first-page',
  explain: 'さいしょの ページだね。さいごは どれかな。',
};

/** 段階0・1: さいごに聞こえたページ（1〜3ページのどれか）。誤りは同じ本のほかのページ */
function heardItem(b: Book, target: number, level: number): Item {
  const identity = `last:${b.id}-${target + 1}`;
  const id = level === 0 ? identity : `${identity}:${level}`;
  const others = [0, 1, 2, 3].filter((i) => i !== target);
  const wrong = mix(`${id}:w`, others).slice(0, level === 0 ? 1 : 2);
  return listen({
    id,
    objective: 'heard',
    level,
    prompt: 'えいごの えほんを きこう。さいごに きこえた ページは どれ？',
    figure: strip(b),
    // 4ページの文を順に → もう一度、1ページだけ
    audio: [...allPages(b), pageSound(b, target)],
    gapMs: 900,
    options: [
      pageOpt(b, target, { correct: true }),
      ...wrong.map((i) => pageOpt(b, i, { misconception: 'other-page' })),
    ],
    hints: HINTS,
    explain: `「${b.pages[target]!.ja}」の ページだよ。`,
    identity,
    revealAudio: [pageSound(b, target)],
  });
}

/** 段階2: さいしょ（別例はさいご）のページ。絵の帯は出さない */
function orderItem(b: Book, level: number, last: boolean): Item {
  const target = last ? 3 : 0;
  const identity = last ? `end:${b.id}` : `first:${b.id}`;
  const id =
    last && level === 1 ? identity : level === 2 && !last ? identity : `${identity}:${level}`;
  const others = [0, 1, 2, 3].filter((i) => i !== target);
  const wrong = mix(`${id}:w`, others).slice(0, 2);
  const mis = (i: number) =>
    last
      ? i === 0
        ? MIS_FIRST_PAGE.id
        : MIS_MIDDLE_PAGE.id
      : i === 3
        ? MIS_LAST_PAGE.id
        : MIS_MIDDLE_PAGE.id;
  return listen({
    id,
    objective: last && level === 1 ? 'heard' : 'first',
    level,
    prompt: last
      ? 'えいごの えほんを きこう。さいごの ページは どれ？'
      : 'えいごの えほんを きこう。さいしょの ページは どれ？',
    audio: allPages(b),
    gapMs: 900,
    ...(level === 1 ? { figure: strip(b) } : {}),
    options: [
      pageOpt(b, target, { correct: true }),
      ...wrong.map((i) => pageOpt(b, i, { misconception: mis(i) })),
    ],
    hints: HINTS,
    explain: `「${b.pages[target]!.ja}」の ページだよ。`,
    identity,
    alt: last,
    revealAudio: [pageSound(b, target)],
  });
}

function items(): Item[] {
  const out: Item[] = [];
  for (const b of BOOKS)
    for (const t of [0, 1, 2]) {
      out.push(heardItem(b, t, 0));
      out.push(heardItem(b, t, 1));
    }
  // 段階1の別例: さいごの ページ（帯つき）。段階2: さいしょの ページ・別例 さいごの ページ（帯なし）
  for (const b of BOOKS) out.push(orderItem(b, 1, true));
  for (const b of BOOKS) out.push(orderItem(b, 2, false));
  for (const b of BOOKS) out.push(orderItem(b, 2, true));
  return out;
}

export const p4PictureBook: UnitSpec = preUnit({
  id: 'p4.en.picture-book',
  title: 'えいごの えほん',
  stage: 'p4',
  icon: 'p5-book',
  objectives: [
    { id: 'heard', title: 'さいごに きこえた ページを えらぶ' },
    { id: 'first', title: 'さいしょの ページを えらぶ' },
  ],
  misconceptions: [MIS_OTHER_PAGE, MIS_LAST_PAGE, MIS_MIDDLE_PAGE, MIS_FIRST_PAGE],
  levels: [
    { label: 'きこえた ページ（2たく）', chance: 0.5 },
    { label: 'きこえた ページ（3たく）', chance: 1 / 3 },
    { label: 'さいしょの ページ（3たく・えの おびなし）', chance: 1 / 3 },
  ],
  intro: intro(ill('p5-book')),
  source: { kind: 'items', items: items() },
  parentNote:
    '同じお話を何度もくり返し聞くことで、言葉に親しめます。お子さんが気に入ったお話は、ページの絵を指さしながら、いっしょに英語を言ってみてください。',
});
