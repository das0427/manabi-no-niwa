/**
 * g5.en.listen-self じこしょうかい・たんじょう日・できることを 聞《き》きとる（curriculum-matrix 3.8。外56 聞く）。
 *   段階0: すきな もの（I like 〜.）・できる こと（I can 〜.）
 *   段階1: たんじょう日（月の なまえ）
 *   段階2: 2人の しょうかいを 聞きくらべる・can't の 聞きとり
 * 人名は 架空の 一般的な 名前。同一性キー: 形式 × 英文。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { en, enText, listen, pickOthers, slugOf } from './lib';

interface Thing {
  word: string;
  ja: string;
  illust?: string;
  kind: 'animal' | 'food' | 'other';
}
const LIKES: Thing[] = [
  { word: 'dogs', ja: 'いぬ', illust: 'dog', kind: 'animal' },
  { word: 'cats', ja: 'ねこ', illust: 'cat', kind: 'animal' },
  { word: 'rabbits', ja: 'うさぎ', illust: 'rabbit', kind: 'animal' },
  { word: 'bears', ja: 'くま', illust: 'bear', kind: 'animal' },
  { word: 'apples', ja: 'りんご', illust: 'apple', kind: 'food' },
  { word: 'bananas', ja: 'バナナ', illust: 'banana', kind: 'food' },
  { word: 'strawberries', ja: 'いちご', illust: 'strawberry', kind: 'food' },
  { word: 'peaches', ja: 'もも', illust: 'peach', kind: 'food' },
  { word: 'trains', ja: 'でんしゃ', illust: 'train', kind: 'other' },
  { word: 'books', ja: 'ほん', illust: 'p5-book', kind: 'other' },
  { word: 'music', ja: 'おんがく', kind: 'other' },
  { word: 'flowers', ja: 'はな', illust: 'flower', kind: 'other' },
];

const thingOpt = (t: Thing): ChoiceOption => ({
  ...(t.illust ? { figure: { kind: 'illust', id: t.illust } as Figure } : {}),
  label: t.ja,
});

function likeItems(): Item[] {
  const out: Item[] = [];
  LIKES.forEach((t, i) => {
    const others = pickOthers(LIKES, i, 2, (u) => u !== t && u.kind === t.kind);
    const text = `I like ${t.word}.`;
    out.push(
      listen({
        id: `like:${t.word}`,
        objective: 'like',
        level: 0,
        prompt: 'この 人《ひと》の すきな ものは どれ？',
        audio: en('self', text),
        options: [
          { ...thingOpt(t), correct: true },
          ...others.map((u) => ({ ...thingOpt(u), misconception: 'word-mix' })),
        ],
        hints: [
          '文《ぶん》の さいごの ことばが、すきな ものだよ。',
          t.kind === 'animal'
            ? 'どうぶつの なかまだよ。'
            : t.kind === 'food'
              ? 'たべものの なかまだよ。'
              : 'どうぶつでも たべものでも ないよ。',
          'まえの ことばは「〜が すきです」と いう いみ。さいごの ことばを もういちど 聞《き》こう。',
        ],
        explain: `「${t.ja}が すきです」と いって います。`,
        explainFigure: enText(text),
        identity: `like:${t.word}`,
      }),
    );
  });
  // 別例: すきではない ものと すきな ものを 聞きわける
  const PAIRS: [number, number, number][] = [
    [0, 1, 2],
    [4, 6, 5],
    [8, 10, 9],
    [3, 2, 0],
    [7, 5, 4],
    [11, 9, 10],
  ];
  for (const [no, yes, other] of PAIRS) {
    const a = LIKES[no]!;
    const b = LIKES[yes]!;
    const text = `I don't like ${a.word}. I like ${b.word}.`;
    out.push(
      listen({
        id: `like-not:${a.word}-${b.word}`,
        objective: 'like',
        level: 2,
        prompt: 'この 人《ひと》が すきな ものは どれ？ さいごまで 聞《き》こう。',
        audio: en('self', text),
        options: [
          { ...thingOpt(b), correct: true },
          { ...thingOpt(a), misconception: 'not-heard' },
          { ...thingOpt(LIKES[other]!), misconception: 'word-mix' },
        ],
        hints: [
          '2つの 文《ぶん》が あるよ。1つめと 2つめで いみが ちがうよ。',
          '1つめの 文《ぶん》は「すきではない」と いって いるよ。',
          '2つめの 文《ぶん》の さいごの ことばを 聞《き》こう。',
        ],
        explain: `${a.ja}は すきではなく、${b.ja}が すきです。`,
        explainFigure: enText(text, 'm'),
        identity: `like-not:${a.word}-${b.word}`,
        alt: true,
      }),
    );
  }
  return out;
}

interface Act {
  verb: string;
  ja: string;
  illust?: string;
}
const ACTS: Act[] = [
  { verb: 'swim', ja: 'およぐ' },
  { verb: 'run fast', ja: 'はやく はしる' },
  { verb: 'sing well', ja: 'じょうずに うたう' },
  { verb: 'dance', ja: 'おどる' },
  { verb: 'cook', ja: 'りょうりを する' },
  { verb: 'play the piano', ja: 'ピアノを ひく' },
  { verb: 'ride a bicycle', ja: 'じてんしゃに のる', illust: 'bicycle' },
  { verb: 'play soccer', ja: 'サッカーを する', illust: 'ball' },
  { verb: 'jump rope', ja: 'なわとびを する' },
  { verb: 'draw pictures', ja: 'えを かく', illust: 'pencil' },
  { verb: 'ski', ja: 'スキーを する' },
  { verb: 'read English', ja: 'えいごを よむ', illust: 'p5-book' },
];
const actOpt = (a: Act): ChoiceOption => ({
  ...(a.illust ? { figure: { kind: 'illust', id: a.illust } as Figure } : {}),
  label: a.ja,
});

function canItems(): Item[] {
  const out: Item[] = [];
  ACTS.forEach((a, i) => {
    const others = pickOthers(ACTS, i, 2, (b) => b !== a);
    const text = `I can ${a.verb}.`;
    out.push(
      listen({
        id: `can:${slugOf(a.verb)}`,
        objective: 'can',
        level: 0,
        prompt: 'この 人《ひと》が できる ことは どれ？',
        audio: en('self', text),
        options: [
          { ...actOpt(a), correct: true },
          ...others.map((b) => ({ ...actOpt(b), misconception: 'word-mix' })),
        ],
        hints: [
          'まえの ほうは「〜が できます」と いう いみだよ。',
          'そのあとの ことばが、できる ことだよ。',
          'からだを うごかす ことか、なにかを つくる ことか、かんがえながら もういちど 聞《き》こう。',
        ],
        explain: `「${a.ja}ことが できます」と いって います。`,
        explainFigure: enText(text),
        identity: `can:${slugOf(a.verb)}`,
      }),
    );
  });
  // 別例: できない こと（can't）と できる ことを 聞きわける
  const CANT: [number, number, number][] = [
    [0, 1, 4],
    [5, 3, 2],
    [10, 8, 6],
    [4, 9, 11],
    [6, 0, 7],
  ];
  for (const [no, yes, other] of CANT) {
    const a = ACTS[no]!;
    const b = ACTS[yes]!;
    const text = `I can't ${a.verb}. But I can ${b.verb}.`;
    out.push(
      listen({
        id: `cant:${slugOf(a.verb)}-${slugOf(b.verb)}`,
        objective: 'can',
        level: 2,
        prompt: 'この 人《ひと》が できる ことは どれ？ できない ことも いって いるよ。',
        audio: en('self', text),
        options: [
          { ...actOpt(b), correct: true },
          { ...actOpt(a), misconception: 'can-cant' },
          { ...actOpt(ACTS[other]!), misconception: 'word-mix' },
        ],
        hints: [
          '2つの 文《ぶん》が あるよ。1つは「できない」、もう1つは「できる」。',
          '1つめの 文《ぶん》の はじめの ほうは「できない」の いみだよ。',
          '2つめの 文《ぶん》の さいごを 聞《き》こう。',
        ],
        explain: `${a.ja}ことは できないけれど、${b.ja}ことは できます。`,
        explainFigure: enText(text, 'm'),
        identity: `cant:${slugOf(a.verb)}-${slugOf(b.verb)}`,
        alt: true,
      }),
    );
  }
  return out;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const ORD = [
  'first',
  'third',
  'fifth',
  'eighth',
  'tenth',
  'twelfth',
  'fifteenth',
  'twentieth',
  'second',
  'fourth',
  'ninth',
  'thirtieth',
];
/** 聞きまちがえやすい 月（月の番号 1〜12） */
const MONTH_CONFUSE: Record<number, [number, number]> = {
  1: [2, 6],
  2: [1, 11],
  3: [5, 4],
  4: [8, 3],
  5: [3, 7],
  6: [7, 1],
  7: [6, 5],
  8: [4, 10],
  9: [11, 12],
  10: [8, 12],
  11: [9, 12],
  12: [11, 9],
};

function birthdayItems(): Item[] {
  const out: Item[] = [];
  MONTHS.forEach((m, i) => {
    const n = i + 1;
    const text = `My birthday is ${m} ${ORD[i]}.`;
    out.push(
      listen({
        id: `bday:${m}`,
        objective: 'birthday',
        level: 1,
        prompt: 'この 人《ひと》の たんじょう日《び》は なんがつ？',
        audio: en('self', text),
        options: [
          { label: `${n}がつ`, correct: true },
          ...MONTH_CONFUSE[n]!.map((x) => ({ label: `${x}がつ`, misconception: 'month-mix' })),
        ],
        hints: [
          '「わたしの たんじょう日《び》は」の あとに、月《つき》の なまえが くるよ。',
          '月《つき》の なまえの はじめの 音《おと》を よく 聞《き》こう。',
          n <= 6 ? '1がつから 6がつの どれかだよ。' : '7がつから 12がつの どれかだよ。',
        ],
        explain: `${n}がつ です。月《つき》の なまえの あとの ことばは「なん日《にち》」を あらわして います。`,
        explainFigure: enText(text),
        identity: `bday:${m}`,
      }),
    );
  });
  // 別例: 月の なまえだけを 聞く
  for (const n of [1, 3, 6, 7, 9, 11]) {
    const m = MONTHS[n - 1]!;
    out.push(
      listen({
        id: `month:${m}`,
        objective: 'birthday',
        level: 1,
        prompt: '聞《き》こえた 月《つき》は どれ？',
        audio: en('word', m),
        options: [
          { label: `${n}がつ`, correct: true },
          ...MONTH_CONFUSE[n]!.map((x) => ({ label: `${x}がつ`, misconception: 'month-mix' })),
        ],
        hints: [
          'はじめの 音《おと》を よく 聞《き》こう。',
          'おわりの 音《おと》が にている 月《つき》が あるよ。',
          n <= 6 ? '1がつから 6がつの どれかだよ。' : '7がつから 12がつの どれかだよ。',
        ],
        explain: `${n}がつ の ことです。`,
        explainFigure: enText(m),
        identity: `month:${m}`,
        alt: true,
      }),
    );
  }
  return out;
}

/** 2人の しょうかいを 聞いて、だれの ことかを えらぶ */
const PEOPLE: { a: [string, string]; b: [string, string]; ask: 'a' | 'b'; askJa: string }[] = [
  {
    a: ['Ken', 'I like trains.'],
    b: ['Emi', 'I like cats.'],
    ask: 'a',
    askJa: 'でんしゃが すきなのは だれ？',
  },
  {
    a: ['Tom', 'I can swim.'],
    b: ['Lily', 'I can cook.'],
    ask: 'b',
    askJa: 'りょうりが できるのは だれ？',
  },
  {
    a: ['Mai', 'My birthday is May fifth.'],
    b: ['Sam', 'My birthday is March third.'],
    ask: 'b',
    askJa: 'たんじょう日《び》が 3がつなのは だれ？',
  },
  {
    a: ['Yuki', 'I like music.'],
    b: ['Ben', 'I like soccer.'],
    ask: 'a',
    askJa: 'おんがくが すきなのは だれ？',
  },
  {
    a: ['Nina', 'I can play the piano.'],
    b: ['Ken', 'I can ski.'],
    ask: 'b',
    askJa: 'スキーが できるのは だれ？',
  },
  {
    a: ['Emi', 'My birthday is July tenth.'],
    b: ['Tom', 'My birthday is June tenth.'],
    ask: 'a',
    askJa: 'たんじょう日《び》が 7がつなのは だれ？',
  },
  {
    a: ['Lily', 'I like rabbits.'],
    b: ['Sam', 'I like bears.'],
    ask: 'b',
    askJa: 'くまが すきなのは だれ？',
  },
  {
    a: ['Ben', 'I can run fast.'],
    b: ['Mai', 'I can dance.'],
    ask: 'b',
    askJa: 'おどる ことが できるのは だれ？',
  },
];

function introItems(): Item[] {
  const out: Item[] = [];
  PEOPLE.forEach((p) => {
    const sa = `I'm ${p.a[0]}. ${p.a[1]}`;
    const sb = `I'm ${p.b[0]}. ${p.b[1]}`;
    const right = p.ask === 'a' ? p.a[0] : p.b[0];
    const wrong = p.ask === 'a' ? p.b[0] : p.a[0];
    const third = ['Tom', 'Emi', 'Ken', 'Lily'].find((x) => x !== right && x !== wrong)!;
    out.push(
      listen({
        id: `intro:${slugOf(sa)}:${p.ask}`,
        objective: 'intro',
        level: 2,
        prompt: `2人《ふたり》が じこしょうかいを するよ。${p.askJa}`,
        audio: [en('intro', sa), en('intro', sb)],
        gapMs: 900,
        options: [
          { label: right, correct: true },
          { label: wrong, misconception: 'who-mix' },
          { label: third, misconception: 'not-said' },
        ],
        hints: [
          'それぞれ、はじめに なまえ、つぎに じぶんの ことを いって いるよ。',
          '1人《ひとり》めと 2人《ふたり》めを わけて 聞《き》こう。',
          `${p.ask === 'a' ? '1人《ひとり》め' : '2人《ふたり》め'}の 人《ひと》の 文《ぶん》を もういちど 聞《き》こう。`,
        ],
        explain: `${p.ask === 'a' ? '1人《ひとり》め' : '2人《ふたり》め'}の ${right}さんの ことです。`,
        explainFigure: { kind: 'column', items: [enText(sa, 'm'), enText(sb, 'm')] },
        identity: `intro:${slugOf(sa)}:${p.ask}`,
      }),
    );
  });
  // 別例: たずねる 文と こたえ
  const QA: {
    q: string;
    a: string;
    right: string;
    wrong: [string, string];
    mis: [string, string];
  }[] = [
    {
      q: 'What do you like?',
      a: 'I like apples.',
      right: 'りんごが すき',
      wrong: ['りんごが きらい', 'バナナが すき'],
      mis: ['not-heard', 'word-mix'],
    },
    {
      q: 'Can you swim?',
      a: "No, I can't.",
      right: 'およげない',
      wrong: ['およげる', 'はしれない'],
      mis: ['can-cant', 'word-mix'],
    },
    {
      q: 'When is your birthday?',
      a: 'My birthday is October first.',
      right: '10がつ',
      wrong: ['8がつ', '12がつ'],
      mis: ['month-mix', 'month-mix'],
    },
    {
      q: 'Can you cook?',
      a: 'Yes, I can.',
      right: 'りょうりが できる',
      wrong: ['りょうりが できない', 'ピアノが ひける'],
      mis: ['can-cant', 'word-mix'],
    },
  ];
  for (const x of QA) {
    out.push(
      listen({
        id: `qa:${slugOf(x.q)}`,
        objective: 'intro',
        level: 2,
        prompt:
          'たずねる 文《ぶん》と、こたえを 聞《き》こう。こたえた 人《ひと》に あうのは どれ？',
        audio: [en('ask', x.q), en('intro', x.a)],
        gapMs: 800,
        options: [
          { label: x.right, correct: true },
          { label: x.wrong[0], misconception: x.mis[0] },
          { label: x.wrong[1], misconception: x.mis[1] },
        ],
        hints: [
          'さいしょの 文《ぶん》は なにを たずねて いるかな。',
          'こたえの 文《ぶん》の はじめの ことばを 聞《き》こう。',
          'こたえの さいごの ことばも 聞《き》こう。',
        ],
        explain: `こたえは「${x.right}」と いう いみです。`,
        explainFigure: enText(`${x.q}  →  ${x.a}`, 'm'),
        identity: `qa:${slugOf(x.q)}`,
        alt: true,
      }),
    );
  }
  return out;
}

export const listenSelf: UnitSpec = {
  id: 'g5.en.listen-self',
  title: 'じこしょうかいを 聞《き》こう',
  stage: 'g5',
  subject: 'en',
  domain: 'en',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-eigo',
  prereq: ['g4.en.time-days'],
  objectives: [
    { id: 'like', title: 'すきな ものを 聞《き》きとる' },
    { id: 'can', title: 'できる こと・できない ことを 聞《き》きとる' },
    { id: 'birthday', title: 'たんじょう日《び》（月《つき》の なまえ）を 聞《き》きとる' },
    { id: 'intro', title: '2人《ふたり》の しょうかいや やりとりから 聞《き》きとる' },
  ],
  misconceptions: [
    {
      id: 'word-mix',
      explain:
        'ほかの ことばと とりちがえたのかな。文《ぶん》の さいごの ことばを もういちど 聞《き》こう。',
    },
    {
      id: 'not-heard',
      explain:
        '「すきではない」の ぶぶんを 聞《き》きのがしたのかな。ことばの まえに みじかい 音《おと》が 入《はい》ると、いみが はんたいに なるよ。',
    },
    {
      id: 'can-cant',
      explain:
        '「できる」と「できない」を とりちがえたのかな。できない ときは ことばの おわりに 音《おと》が つくよ。もういちど 聞《き》こう。',
    },
    {
      id: 'month-mix',
      explain:
        '音《おと》の にている 月《つき》と まちがえたのかな。はじめの 音《おと》を よく 聞《き》こう。',
    },
    {
      id: 'who-mix',
      explain:
        'もう1人《ひとり》の 人《ひと》の ことと とりちがえたのかな。なまえの あとに いった ことを むすびつけよう。',
    },
    {
      id: 'not-said',
      explain:
        'この なまえは 聞《き》こえなかったね。2人《ふたり》の なまえを 聞《き》きなおそう。',
    },
  ],
  levels: [
    { label: 'すきな もの・できる こと', chance: 0.05 },
    { label: 'たんじょう日《び》', chance: 0.05 },
    { label: '2人《ふたり》の しょうかい・やりとり', chance: 0.05 },
  ],
  intro: [
    {
      text: 'じこしょうかいでは、なまえ・すきな もの・できる ことを つたえるよ。',
      figure: {
        kind: 'column',
        items: [enText("I'm Ken.", 'l'), enText('I like trains.', 'l'), enText('I can swim.', 'l')],
      },
    },
    {
      text: 'たんじょう日《び》は 月《つき》の なまえで いうよ。これは「4がつ」。',
      figure: enText('April', 'xl'),
    },
  ],
  source: {
    kind: 'items',
    items: [...likeItems(), ...canItems(), ...birthdayItems(), ...introItems()],
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）外国語 第5・6学年 聞くこと（自分のことや身近で簡単な事柄について、具体的な情報を聞き取る）',
  gradeIsAppProposal: true,
  revised: '2026-10-24',
};
