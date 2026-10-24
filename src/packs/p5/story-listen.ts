/**
 * p5.ja.story-listen おはなし（curriculum-matrix 3.3）: だれが でたか → おきた じゅん → どんな きもち。
 * おはなしは すべて この アプリの オリジナル（10本）。聞いて答える（listen）、ならべる（order）。
 * 同一性キー: 本文 × 設問（同じ本文の同じ設問の言い換えは同じ: 1.4 読解）。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import type { OrderItem } from '../../engines/order/order';
import { choiceItem, ill, listenItem } from './lib';

type Feel = 'happy' | 'sad' | 'surprised' | 'angry';
const FEEL_NAME: Record<Feel, string> = {
  happy: 'うれしい',
  sad: 'かなしい',
  surprised: 'びっくり',
  angry: 'おこって いる',
};
const face = (f: Feel): Figure => {
  const eyes =
    f === 'surprised'
      ? '<circle cx="36" cy="42" r="6" fill="var(--paper)" stroke="var(--ink)" stroke-width="3"/><circle cx="64" cy="42" r="6" fill="var(--paper)" stroke="var(--ink)" stroke-width="3"/>'
      : f === 'happy'
        ? '<path d="M29 44 Q36 36 43 44 M57 44 Q64 36 71 44" stroke="var(--ink)" stroke-width="3.5" fill="none" stroke-linecap="round"/>'
        : '<circle cx="36" cy="44" r="4" fill="var(--ink)"/><circle cx="64" cy="44" r="4" fill="var(--ink)"/>';
  const brows =
    f === 'angry'
      ? '<path d="M27 30 L44 37 M73 30 L56 37" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round"/>'
      : f === 'sad'
        ? '<path d="M28 36 L43 31 M72 36 L57 31" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/>'
        : '';
  const mouth =
    f === 'happy'
      ? '<path d="M34 62 Q50 78 66 62" stroke="var(--ink)" stroke-width="3.5" fill="none" stroke-linecap="round"/>'
      : f === 'sad'
        ? '<path d="M36 72 Q50 60 64 72" stroke="var(--ink)" stroke-width="3.5" fill="none" stroke-linecap="round"/>'
        : f === 'surprised'
          ? '<ellipse cx="50" cy="68" rx="7" ry="9" fill="var(--ink)"/>'
          : '<path d="M36 70 H64" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round"/>';
  return {
    kind: 'svg',
    label: FEEL_NAME[f],
    markup: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="52" r="42" fill="var(--sun)" stroke="var(--ink)" stroke-width="3.5"/>${brows}${eyes}${mouth}</svg>`,
  };
};

interface Who {
  q: string;
  right: [string, string];
  wrong: [string, string][];
}
interface Story {
  id: string;
  title: string;
  lines: string[];
  who: Who;
  /** 起きた順の 3場面（絵, 文） */
  events: [string, string][];
  feel: { q: string; ans: Feel; wrong: Feel[]; why: string };
  /** 別例 */
  obj?: Who;
  reason?: { q: string; right: string; wrong: string[] };
}

const STORIES: Story[] = [
  {
    id: 'carrot',
    title: 'おおきな にんじん',
    lines: [
      'うさぎが はたけで、おおきな にんじんを みつけました。',
      'ひっぱっても、ひっぱっても ぬけません。',
      'そこへ くまが きて、いっしょに ひっぱって くれました。',
      'すぽん！ にんじんが ぬけて、ふたりで わけて たべました。',
    ],
    who: {
      q: 'いっしょに ひっぱって くれたのは だれ？',
      right: ['bear', 'くま'],
      wrong: [
        ['fox', 'きつね'],
        ['monkey', 'さる'],
      ],
    },
    events: [
      ['carrot', 'にんじんを みつけた'],
      ['bear', 'くまが きた'],
      ['rabbit', 'ふたりで たべた'],
    ],
    feel: {
      q: 'さいごに、うさぎは どんな きもち？',
      ans: 'happy',
      wrong: ['sad', 'angry'],
      why: 'にんじんが ぬけて、いっしょに たべたからね。',
    },
    obj: {
      q: 'うさぎが みつけた ものは なに？',
      right: ['carrot', 'にんじん'],
      wrong: [
        ['apple', 'りんご'],
        ['banana', 'バナナ'],
      ],
    },
    reason: {
      q: 'うさぎは どうして うれしかったのかな？',
      right: 'にんじんが ぬけたから',
      wrong: ['あめが ふったから', 'ひとりで たべたから'],
    },
  },
  {
    id: 'umbrella',
    title: 'はっぱの かさ',
    lines: [
      'ひよこが さんぽを して いると、あめが ふって きました。',
      'ひよこは かさを もって いません。',
      'かえるが、おおきな はっぱを かして くれました。',
      'ひよこは「ありがとう」と いいました。',
    ],
    who: {
      q: 'はっぱを かして くれたのは だれ？',
      right: ['frog', 'かえる'],
      wrong: [
        ['cat', 'ねこ'],
        ['turtle', 'かめ'],
      ],
    },
    events: [
      ['umbrella', 'あめが ふって きた'],
      ['frog', 'かえるが きた'],
      ['leaf', 'はっぱを かりた'],
    ],
    feel: {
      q: 'かさが なくて、ひよこは どんな きもち だったかな？',
      ans: 'sad',
      wrong: ['happy', 'angry'],
      why: 'ぬれて こまって いたからね。',
    },
    obj: {
      q: 'かえるが かして くれた ものは なに？',
      right: ['leaf', 'はっぱ'],
      wrong: [
        ['umbrella', 'かさ'],
        ['flower', 'はな'],
      ],
    },
  },
  {
    id: 'banana',
    title: 'おちた バナナ',
    lines: [
      'さるが きに のぼって、バナナを とりました。',
      'ところが、バナナが ぽとんと おちて しまいました。',
      'したに いた ぞうが、はなで ひろって くれました。',
      'ぞうと さるは、いっしょに バナナを たべました。',
    ],
    who: {
      q: 'バナナを ひろって くれたのは だれ？',
      right: ['elephant', 'ぞう'],
      wrong: [
        ['bear', 'くま'],
        ['dog', 'いぬ'],
      ],
    },
    events: [
      ['monkey', 'きに のぼった'],
      ['banana', 'バナナが おちた'],
      ['elephant', 'ぞうが ひろった'],
    ],
    feel: {
      q: 'バナナが おちた とき、さるは どんな きもち？',
      ans: 'surprised',
      wrong: ['happy', 'angry'],
      why: 'きゅうに おちたからね。',
    },
    reason: {
      q: 'さるは どうして びっくり したのかな？',
      right: 'バナナが おちたから',
      wrong: ['ぞうが ねて いたから', 'あめが ふったから'],
    },
  },
  {
    id: 'cake',
    title: 'たんじょうびの ケーキ',
    lines: [
      'きつねと うさぎが、ケーキを つくりました。',
      'ふたりは、ケーキを くまの いえに もって いきました。',
      '「おたんじょうび おめでとう！」',
      'くまは にっこり わらいました。',
    ],
    who: {
      q: 'ケーキを もらったのは だれ？',
      right: ['bear', 'くま'],
      wrong: [
        ['fox', 'きつね'],
        ['monkey', 'さる'],
      ],
    },
    events: [
      ['p5-cake', 'ケーキを つくった'],
      ['fox', 'くまの いえへ いった'],
      ['bear', 'くまが わらった'],
    ],
    feel: {
      q: 'さいごに、くまは どんな きもち？',
      ans: 'happy',
      wrong: ['sad', 'surprised'],
      why: 'にっこり わらったからね。',
    },
  },
  {
    id: 'ball',
    title: 'いけの ボール',
    lines: [
      'ねこが ボールで あそんで いました。',
      'ボールが ころころ ころがって、いけに おちて しまいました。',
      'かめが すいすい およいで、せなかに のせて はこんで くれました。',
    ],
    who: {
      q: 'ボールを はこんで くれたのは だれ？',
      right: ['turtle', 'かめ'],
      wrong: [
        ['frog', 'かえる'],
        ['bird', 'とり'],
      ],
    },
    events: [
      ['cat', 'ボールで あそんだ'],
      ['ball', 'いけに おちた'],
      ['turtle', 'かめが はこんだ'],
    ],
    feel: {
      q: 'ボールが いけに おちた とき、ねこは どんな きもち？',
      ans: 'sad',
      wrong: ['happy', 'angry'],
      why: 'だいじな ボールが おちたからね。',
    },
    obj: {
      q: 'ねこが あそんで いた ものは なに？',
      right: ['ball', 'ボール'],
      wrong: [
        ['pencil', 'えんぴつ'],
        ['flower', 'はな'],
      ],
    },
  },
  {
    id: 'onigiri',
    title: 'はんぶんこ',
    lines: [
      'いぬが こうえんで、おにぎりを たべようと しました。',
      'すると、とりが とんで きて、おにぎりを つつきました。',
      'いぬは「こらっ」と おこりました。',
      'でも、とりは おなかが ぺこぺこ。いぬは はんぶん わけて あげました。',
    ],
    who: {
      q: 'おにぎりを つついたのは だれ？',
      right: ['bird', 'とり'],
      wrong: [
        ['cat', 'ねこ'],
        ['chick', 'ひよこ'],
      ],
    },
    events: [
      ['onigiri', 'おにぎりを たべようと した'],
      ['bird', 'とりが つついた'],
      ['dog', 'はんぶん あげた'],
    ],
    feel: {
      q: 'おにぎりを つつかれた とき、いぬは どんな きもち？',
      ans: 'angry',
      wrong: ['happy', 'sad'],
      why: '「こらっ」と おこったからね。',
    },
  },
  {
    id: 'jump',
    title: 'かえるの ジャンプ',
    lines: [
      'かえるが、いけの そばで ジャンプの れんしゅうを して いました。',
      'いしを とびこえようと して、ころんで しまいました。',
      'もういちど とんでみると、こんどは とびこえられました。',
    ],
    who: {
      q: 'ジャンプの れんしゅうを して いたのは だれ？',
      right: ['frog', 'かえる'],
      wrong: [
        ['rabbit', 'うさぎ'],
        ['chick', 'ひよこ'],
      ],
    },
    events: [
      ['frog', 'れんしゅうを はじめた'],
      ['rock', 'いしで ころんだ'],
      ['frog', 'とびこえられた'],
    ],
    feel: {
      q: 'さいごに、かえるは どんな きもち？',
      ans: 'happy',
      wrong: ['sad', 'angry'],
      why: 'とびこえられたからね。',
    },
    reason: {
      q: 'かえるは どうして うれしかったのかな？',
      right: 'いしを とびこえられたから',
      wrong: ['ころんだから', 'あめが ふったから'],
    },
  },
  {
    id: 'apple',
    title: 'りんごの おみやげ',
    lines: [
      'きつねが やまで、りんごを みっつ ひろいました。',
      'かえりみちで、ひよこに あいました。',
      'きつねは、ひよこに りんごを ひとつ あげました。',
    ],
    who: {
      q: 'りんごを もらったのは だれ？',
      right: ['chick', 'ひよこ'],
      wrong: [
        ['rabbit', 'うさぎ'],
        ['dog', 'いぬ'],
      ],
    },
    events: [
      ['apple', 'りんごを ひろった'],
      ['chick', 'ひよこに あった'],
      ['fox', 'りんごを あげた'],
    ],
    feel: {
      q: 'りんごを もらって、ひよこは どんな きもち？',
      ans: 'happy',
      wrong: ['angry', 'sad'],
      why: 'おいしい りんごを もらったからね。',
    },
  },
  {
    id: 'water',
    title: 'ぞうの みずあそび',
    lines: [
      'あつい ひ でした。',
      'ぞうが はなで、みずを ぴゅーっと かけました。',
      'さるは、つめたくて びっくり！',
      'それから みんなで、みずあそびを しました。',
    ],
    who: {
      q: 'みずを かけたのは だれ？',
      right: ['elephant', 'ぞう'],
      wrong: [
        ['cow', 'うし'],
        ['bear', 'くま'],
      ],
    },
    events: [
      ['p5-sun', 'あつい ひ だった'],
      ['elephant', 'みずを かけた'],
      ['monkey', 'みんなで あそんだ'],
    ],
    feel: {
      q: 'みずを かけられた とき、さるは どんな きもち？',
      ans: 'surprised',
      wrong: ['sad', 'angry'],
      why: 'きゅうに つめたい みずが かかったからね。',
    },
  },
  {
    id: 'bread',
    title: 'いい におい',
    lines: [
      'うしが パンを やきました。',
      'いい においが して、いぬと ねこが やって きました。',
      'みんなで、ほかほかの パンを たべました。',
    ],
    who: {
      q: 'パンを やいたのは だれ？',
      right: ['cow', 'うし'],
      wrong: [
        ['dog', 'いぬ'],
        ['cat', 'ねこ'],
      ],
    },
    events: [
      ['bread', 'パンを やいた'],
      ['dog', 'いぬと ねこが きた'],
      ['cow', 'みんなで たべた'],
    ],
    feel: {
      q: 'パンを たべて、みんなは どんな きもち？',
      ans: 'happy',
      wrong: ['sad', 'angry'],
      why: 'ほかほかの パンを いっしょに たべたからね。',
    },
    obj: {
      q: 'うしが やいた ものは なに？',
      right: ['bread', 'パン'],
      wrong: [
        ['onigiri', 'おにぎり'],
        ['egg', 'たまご'],
      ],
    },
  },
];

const audioOf = (s: Story) => s.lines.map((text) => ({ text }));
const HEAR = ['おはなしを よく きこう。', 'もういちど きいて、その ばめんを おもいだそう。'];

function whoItem(s: Story, w: Who, alt: boolean): Item {
  return listenItem({
    id: `${alt ? 'what' : 'who'}:${s.id}`,
    objective: 'who',
    level: 0,
    alt,
    prompt: `おはなし「${s.title}」を きいて こたえよう。${w.q}`,
    audio: audioOf(s),
    gapMs: 700,
    hints: HEAR as [string, string],
    explain: `${w.right[1]}だね。`,
    identity: `${alt ? 'what' : 'who'}:${s.id}`,
    correct: { label: w.right[1], figure: ill(w.right[0]) },
    wrong: w.wrong.map(([il, name]) => ({
      label: name,
      figure: ill(il),
      misconception: 'not-in-story',
    })),
  });
}

function orderItem(s: Story): OrderItem {
  return {
    engine: 'order',
    id: `order:${s.id}`,
    objective: 'order',
    level: 1,
    prompt: `おはなし「${s.title}」。${s.lines.join('')} おきた じゅんに ならべよう。`,
    cards: s.events.map(([il, text]) => ({ figure: ill(il), label: text })),
    ends: ['はじめ', 'おわり'],
    reverseMisconception: 'order-reverse',
    wrongOrders: [
      { order: [1, 0, 2], misconception: 'order-middle' },
      { order: [0, 2, 1], misconception: 'order-middle' },
    ],
    hints: ['いちばん はじめに おきた ことは なにかな。', 'おはなしの さいごは どう なったかな。'],
    explain: `${s.events.map((e) => e[1]).join(' → ')}。`,
    identity: `order:${s.id}`,
  };
}

/** 別例: さいしょに あった ことを 選ぶ */
function firstItem(s: Story): Item {
  return listenItem({
    id: `first:${s.id}`,
    objective: 'order',
    level: 1,
    alt: true,
    prompt: `おはなし「${s.title}」で、いちばん はじめに あった ことは どれ？`,
    audio: audioOf(s),
    gapMs: 700,
    hints: HEAR as [string, string],
    explain: `はじめは「${s.events[0]![1]}」。`,
    identity: `first:${s.id}`,
    correct: { label: s.events[0]![1], figure: ill(s.events[0]![0]) },
    wrong: s.events
      .slice(1)
      .map(([il, t]) => ({ label: t, figure: ill(il), misconception: 'order-middle' })),
  });
}

function feelItem(s: Story): Item {
  return listenItem({
    id: `feel:${s.id}`,
    objective: 'feeling',
    level: 2,
    prompt: `おはなし「${s.title}」。${s.feel.q}`,
    audio: audioOf(s),
    gapMs: 700,
    hints: ['その ときの ようすを おもいだそう。', 'じぶんだったら どんな きもちかな。'],
    explain: `${FEEL_NAME[s.feel.ans]} きもち。${s.feel.why}`,
    identity: `feel:${s.id}`,
    correct: { label: FEEL_NAME[s.feel.ans], figure: face(s.feel.ans) },
    wrong: s.feel.wrong.map((f) => ({
      label: FEEL_NAME[f],
      figure: face(f),
      misconception: 'feeling-other',
    })),
  });
}

function reasonItem(s: Story): Item {
  const r = s.reason!;
  return choiceItem({
    id: `reason:${s.id}`,
    objective: 'feeling',
    level: 2,
    alt: true,
    prompt: `おはなし「${s.title}」。${r.q}`,
    hints: ['おはなしで なにが あったか おもいだそう。', 'きもちが かわった ときの できごとだよ。'],
    explain: `${r.right}。`,
    identity: `reason:${s.id}`,
    layout: 'column',
    correct: { label: r.right },
    wrong: r.wrong.map((w) => ({ label: w, misconception: 'not-in-story' })),
  });
}

function build(): Item[] {
  const items: Item[] = [];
  for (const s of STORIES) {
    items.push(whoItem(s, s.who, false), orderItem(s));
    if (s.obj) items.push(whoItem(s, s.obj, true));
  }
  for (const s of STORIES.slice(0, 3)) items.push(firstItem(s));
  for (const s of STORIES) if (s.id !== 'cake' && s.id !== 'bread') items.push(feelItem(s));
  for (const s of STORIES) if (s.reason) items.push(reasonItem(s));
  return items;
}

export const storyListen: UnitSpec = {
  id: 'p5.ja.story-listen',
  title: 'おはなし',
  stage: 'p5',
  subject: 'ja',
  domain: 'play',
  kind: 'reading',
  priority: 'P1',
  status: 'ready',
  icon: 'p5-book',
  prereq: [],
  objectives: [
    { id: 'who', title: 'だれが でて きたか・なにが あったか' },
    { id: 'order', title: 'おきた じゅんばん' },
    { id: 'feeling', title: 'どんな きもち' },
  ],
  misconceptions: [
    { id: 'not-in-story', explain: 'おはなしに なかった ことかな。もういちど きいて みよう。' },
    {
      id: 'order-reverse',
      explain: 'じゅんばんが はんたいかな。いちばん はじめから おもいだそう。',
    },
    {
      id: 'order-middle',
      explain:
        'まんなかの じゅんばんが いれかわったかな。「それから」の あとに なにが あったか きこう。',
    },
    {
      id: 'feeling-other',
      explain: 'その ときの ようすを おもいだそう。わらって いたかな、ないて いたかな。',
    },
  ],
  levels: [
    { label: 'だれが でたか', chance: 1 / 3 },
    { label: 'おきた じゅん', chance: 1 / 6 },
    { label: 'どんな きもち', chance: 1 / 3 },
  ],
  intro: [
    { text: 'おはなしを きいて、だれが なにを したか おもいだそう。', figure: ill('p5-book') },
  ],
  source: { kind: 'items', items: build() },
  review: 'view',
  basis:
    '幼稚園教育要領 言葉（絵本や物語に親しむ）、小学校学習指導要領 国語 第1・2学年 C 読むこと へ接続、curriculum-matrix 3.3',
  gradeIsAppProposal: true,
  revised: '2026-10-24',
};
