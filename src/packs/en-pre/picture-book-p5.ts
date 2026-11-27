/**
 * p5.en.picture-book ながい えいごの えほん（設計書 5.11。P2）。
 * 本はすべて本アプリのオリジナル（4冊 × 6ページ。1ページに絵1つと英文1つ。くり返し → 少しの変化 → おしまい）。
 * 6ページの順に意味の流れ（あさの順・きせつの順・そだつ順・かずの順）があり、「さいしょ」「さいご」を考える手がかりになる。
 * 新しい絵は無い（既存の絵だけ）。問題はすべて4択で、ページの帯の図（figure）は出さない
 * （6枚の帯は 1枚 9u ほどに縮み、4択の札と合わせると作業領域が窮屈になるため。選択肢の4枚の絵がページの手がかり）。
 * 同一性キー: page:<本>-<n>（別例）・last:<本>-<n>・first:<本>・end:<本>・second:<本>（別例。id も同じ）。
 */
import type { Item, Misconception, UnitSpec } from '../../curriculum/types';
import { HINTS, ill, intro, listen, mix, preUnit } from './lib';
import { pageOpt, pageSound, type Book, type Page } from './picture-book';

const PG = (text: string, illust: string, ja: string, count?: number): Page => ({
  text,
  figure: ill(illust, count),
  ja,
});

/** 4冊（key は `en/en-pre.book.<本>-<ページ>`。p4 の本の id（hello・yummy・jump・sky・beep・clap）と重ならない） */
export const BOOKS5: Book[] = [
  {
    id: 'morning',
    ja: 'あさの じゅんび',
    pages: [
      PG('Good morning, sun!', 'p23-sun', 'おひさま'),
      PG('Brush, brush, brush!', 'p23-toothbrush', 'はみがき'),
      PG('Wash, wash, wash!', 'p23-soap', 'てを あらう'),
      PG('Yum, yum, yum!', 'bread', 'あさごはん'),
      PG('Shoes on!', 'p23-shoe', 'くつ'),
      PG("Hat on! Let's go!", 'p23-hat', 'ぼうし'),
    ],
  },
  {
    id: 'seasons',
    ja: 'きせつ',
    pages: [
      PG('Hello, spring!', 'p4-spring', 'はる'),
      PG('Hello, summer!', 'p4-summer', 'なつ'),
      PG('Hello, fall!', 'p4-autumn', 'あき'),
      PG('Hello, winter!', 'p4-winter', 'ふゆ'),
      PG('A big snowman!', 'life-snowman', 'ゆきだるま'),
      PG('Hello again, spring!', 'life-cherry', 'また はる'),
    ],
  },
  {
    id: 'garden',
    ja: 'たね',
    pages: [
      PG('Here is a little seed.', 'life-seed', 'たね'),
      PG('Water, please!', 'life-watering-can', 'みずを あげる'),
      PG('Sunshine, please!', 'p23-sun', 'おひさま'),
      PG('Look! A sprout!', 'life-sprout', 'めが でた'),
      PG('Look! A bud!', 'life-bud', 'つぼみ'),
      PG('Look! A flower!', 'flower', 'おはな'),
    ],
  },
  {
    id: 'animals',
    ja: 'なんびき いるかな',
    pages: [
      PG('One frog. Ribbit, ribbit!', 'frog', 'かえる', 1),
      PG('Two ducks. Quack, quack!', 'p23-duck', 'あひる', 2),
      PG('Three birds. Tweet, tweet!', 'bird', 'とり', 3),
      PG('Four cats. Meow, meow!', 'cat', 'ねこ', 4),
      PG('Five dogs. Woof, woof!', 'dog', 'いぬ', 5),
      PG('Hello, friends!', 'enpre-meet', 'みんな'),
    ],
  },
];

export const MIS5: Misconception[] = [
  {
    id: 'other-page',
    explain: 'おなじ えほんの ちがう ページだね。もういちど きいて みよう。',
  },
  {
    id: 'story-end',
    explain: 'おはなしの さいごの ページだね。その あとに もういちど きこえたのは どれかな。',
  },
  { id: 'first-page', explain: 'さいしょの ページだね。もういちど きいて みよう。' },
  { id: 'last-page', explain: 'さいごの ページだね。さいしょは どれかな。' },
  { id: 'middle-page', explain: 'まんなかの ページだね。もういちど きいて みよう。' },
  { id: 'next-page', explain: 'ひとつ あとの ページだね。もういちど きいて みよう。' },
];

const LAST = 5;
const ST = 'えいごの えほんを きこう。';

interface Q {
  id: string;
  b: Book;
  level: number;
  objective: 'heard' | 'order';
  prompt: string;
  /** 音声の並び（ページの番号。0始まり） */
  seq: number[];
  target: number;
  /** 誤りの選択肢 [ページの番号, 誤概念] */
  wrong: [number, string][];
  explain: string;
  alt?: boolean;
}

function build(q: Q): Item {
  const { b } = q;
  return listen({
    id: q.id,
    objective: q.objective,
    level: q.level,
    prompt: q.prompt,
    audio: q.seq.map((i) => pageSound(b, i)),
    gapMs: 900,
    options: [
      pageOpt(b, q.target, { correct: true }),
      ...q.wrong.map(([i, m]) => pageOpt(b, i, { misconception: m })),
    ],
    hints: HINTS,
    explain: q.explain,
    identity: q.id,
    alt: q.alt,
    revealAudio: [pageSound(b, q.target)],
  });
}

const ja = (b: Book, i: number) => b.pages[i]!.ja;
const range = (n: number) => [...Array(n).keys()];

function items(): Item[] {
  const out: Item[] = [];
  for (const b of BOOKS5) {
    // 段階0 別例: 1ページを2回聞いて、そのページを選ぶ（誤りは同じ本のほかのページ3）
    for (const t of range(6)) {
      const id = `page:${b.id}-${t + 1}`;
      out.push(
        build({
          id,
          b,
          level: 0,
          objective: 'heard',
          prompt: 'えいごを きいてね。どの ページかな？',
          seq: [t, t],
          target: t,
          wrong: mix(
            `${id}:w`,
            range(6).filter((i) => i !== t),
          )
            .slice(0, 3)
            .map((i): [number, string] => [i, 'other-page']),
          explain: `「${ja(b, t)}」の ページだよ。`,
          alt: true,
        }),
      );
    }
    // 段階1: 6ページを聞いた後に もう一度 聞こえた1ページ（1〜5ページ）。6ページ目を必ず誤りに入れる
    for (const t of range(5)) {
      const id = `last:${b.id}-${t + 1}`;
      const others = mix(
        `${id}:w`,
        range(5).filter((i) => i !== t),
      ).slice(0, 2);
      out.push(
        build({
          id,
          b,
          level: 1,
          objective: 'heard',
          prompt: `${ST}さいごに きこえた ページは どれ？`,
          seq: [...range(6), t],
          target: t,
          wrong: [[LAST, 'story-end'], ...others.map((i): [number, string] => [i, 'other-page'])],
          explain: `「${ja(b, t)}」の ページだよ。`,
        }),
      );
    }
    // 段階2: さいしょ・さいご・にばんめ（別例）。6ページを順に聞く
    const mids = (id: string, from: number, to: number, n: number) =>
      mix(
        `${id}:w`,
        range(to - from + 1).map((i) => i + from),
      )
        .slice(0, n)
        .map((i): [number, string] => [i, 'middle-page']);
    const fid = `first:${b.id}`;
    out.push(
      build({
        id: fid,
        b,
        level: 2,
        objective: 'order',
        prompt: `${ST}さいしょの ページは どれ？`,
        seq: range(6),
        target: 0,
        wrong: [[LAST, 'last-page'], ...mids(fid, 1, 4, 2)],
        explain: `さいしょは 「${ja(b, 0)}」の ページだよ。`,
      }),
    );
    const eid = `end:${b.id}`;
    out.push(
      build({
        id: eid,
        b,
        level: 2,
        objective: 'order',
        prompt: `${ST}さいごの ページは どれ？`,
        seq: range(6),
        target: LAST,
        wrong: [[0, 'first-page'], ...mids(eid, 1, 4, 2)],
        explain: `さいごは 「${ja(b, LAST)}」の ページだよ。`,
      }),
    );
    // にばんめ（別例）: 1ページ目（first-page）・3ページ目（next-page）・4〜6ページから1（6ページ目なら last-page）
    const sid = `second:${b.id}`;
    const far = mix(`${sid}:w`, [3, 4, 5])[0]!;
    out.push(
      build({
        id: sid,
        b,
        level: 2,
        objective: 'order',
        prompt: `${ST}にばんめの ページは どれ？`,
        seq: range(6),
        target: 1,
        wrong: [
          [0, 'first-page'],
          [2, 'next-page'],
          [far, far === LAST ? 'last-page' : 'middle-page'],
        ],
        explain: `にばんめは 「${ja(b, 1)}」の ページだよ。`,
        alt: true,
      }),
    );
  }
  return out;
}

export const p5PictureBook: UnitSpec = preUnit({
  id: 'p5.en.picture-book',
  title: 'ながい えいごの えほん',
  stage: 'p5',
  icon: 'p5-book',
  priority: 'P2',
  prereq: ['p4.en.picture-book'],
  objectives: [
    { id: 'heard', title: 'きこえた ページを えらぶ' },
    { id: 'order', title: 'さいしょと さいごの ページを えらぶ' },
  ],
  misconceptions: MIS5,
  levels: [
    { label: 'ページを きく（4たく）', chance: 0.25 },
    { label: 'おはなしの あとで（4たく）', chance: 0.25 },
    { label: 'さいしょ・さいご（4たく）', chance: 0.25 },
  ],
  intro: intro(ill('p5-book'), 'えいごの おはなしを きいて、ページの えを えらぶ あそびだよ。'),
  source: { kind: 'items', items: items() },
  parentNote:
    '6ページの短いお話です。同じお話を何度も聞くうちに、言葉や順番を覚えていきます。動物の鳴き声が日本語とちがうことなど、気づいたことを話してみてください。',
});
