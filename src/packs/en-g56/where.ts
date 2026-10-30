/**
 * g5.en.where どこに あるかを 聞《き》こう（curriculum-matrix 3.8。外56）。設計: docs/expansion/p2-design/en-g56.md 1章。
 *   段階0: ばしょの ようすの ことば（in / on / under）
 *   段階1: なにが どこに あるか（絵と 文）
 *   段階2: 「どこ？」と たずねる 文と こたえ（It's not ~. It's ~. も）
 * 同一性キー: 形式 × 英文。絵は src/illust/content/en-g56.tsx（en56-<もの>-<ようす>-<ばしょ>）。
 * 不自然な 組（ball/cap/book in the bed、cat in the desk）は 問わず、誤答の 絵にだけ 使う。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { en, enText, listen, ordinalOptions, slugOf } from './lib';

type Obj = 'ball' | 'cat' | 'cap' | 'book';
type Prep = 'in' | 'on' | 'under';
type Cont = 'desk' | 'bed';

const OBJ_JA: Record<Obj, string> = {
  ball: 'ボール',
  cat: 'ねこ',
  cap: 'ぼうし',
  book: '本《ほん》',
};
const PREP_JA: Record<Prep, string> = { in: '中《なか》', on: '上《うえ》', under: '下《した》' };
const CONT_JA: Record<Cont, string> = { desk: 'つくえ', bed: 'ベッド' };
const PREP_ORDER: Prep[] = ['in', 'on', 'under'];

const il = (o: Obj, p: Prep, c: Cont) => `en56-${o}-${p}-${c}`;
const posJa = (p: Prep, c: Cont) => `${CONT_JA[c]}の ${PREP_JA[p]}`;
const thingJa = (o: Obj, p: Prep, c: Cont) => `${posJa(p, c)}の ${OBJ_JA[o]}`;
const sent = (o: Obj, p: Prep, c: Cont) => `The ${o} is ${p} the ${c}.`;
/** 生き物（ねこ）は「います」、ものは「あります」 */
const aru = (o: Obj) => (o === 'cat' ? 'います' : 'あります');
/** 「ない」の ばしょ: 生き物は「いなくて」 */
const nakute = (o: Obj) => (o === 'cat' ? 'いなくて' : 'なくて');
const illFig = (o: Obj, p: Prep, c: Cont): Figure => ({ kind: 'illust', id: il(o, p, c) });

/** ようすの とりちがえの 誤概念ID（正答と 選んだ ようすの 組。順不同） */
function pairMis(a: Prep, b: Prep): string {
  const [x, y] = [a, b].sort((m, n) => PREP_ORDER.indexOf(m) - PREP_ORDER.indexOf(n));
  return `${x}-${y}`;
}

const col = (id: string, w: string): Figure => ({
  kind: 'column',
  items: [{ kind: 'illust', id }, enText(w, 'm')],
});

const sceneFig = (o: Obj, p: Prep, c: Cont, lines: string[]): Figure => ({
  kind: 'column',
  items: [illFig(o, p, c), ...lines.map((l) => enText(l, 'm'))],
});

// ---- prep 練習（12問） ----
const POS: [Obj, Prep, Cont][] = [
  ['ball', 'under', 'desk'],
  ['ball', 'on', 'bed'],
  ['cat', 'on', 'desk'],
  ['cat', 'in', 'bed'],
  ['cap', 'in', 'desk'],
  ['cap', 'under', 'bed'],
  ['book', 'in', 'desk'],
  ['book', 'under', 'bed'],
  ['ball', 'in', 'desk'],
  ['cat', 'under', 'bed'],
  ['cap', 'on', 'bed'],
  ['book', 'on', 'bed'],
];

function posItems(): Item[] {
  return POS.map(([o, p, c]) => {
    const s = sent(o, p, c);
    return listen({
      id: `pos:${slugOf(s)}`,
      objective: 'prep',
      level: 0,
      prompt: 'どこに ある？ 聞《き》こえた 文《ぶん》に あう 絵《え》を えらぼう。',
      audio: en('where', s),
      options: PREP_ORDER.map((q): ChoiceOption => {
        const fig = illFig(o, q, c);
        return q === p
          ? { figure: fig, label: posJa(q, c), correct: true }
          : { figure: fig, label: posJa(q, c), misconception: pairMis(p, q) };
      }),
      hints: [
        '文《ぶん》の まんなかに、ばしょの ようすを あらわす ことばが あるよ。',
        'その ことばは「中《なか》」「上《うえ》」「下《した》」の どれかだよ。',
        'その ことばが みじかいか、すこし ながいかを 聞《き》きくらべよう。',
      ],
      explain: `${OBJ_JA[o]}は ${posJa(p, c)}に ${aru(o)}。`,
      explainFigure: sceneFig(o, p, c, [s]),
      identity: `pos:${slugOf(s)}`,
    });
  });
}

// ---- prep 別例（ことば 3・句 3） ----
function wordItems(): Item[] {
  return PREP_ORDER.map((w) =>
    listen({
      id: `word:${w}`,
      objective: 'prep',
      level: 0,
      prompt: '聞《き》こえた ことばの いみは どれ？',
      audio: en('where', w),
      options: PREP_ORDER.map((q): ChoiceOption =>
        q === w
          ? { label: PREP_JA[q], correct: true }
          : { label: PREP_JA[q], misconception: pairMis(w, q) },
      ),
      fixedOrder: true,
      hints: [
        'ばしょの ようすを あらわす ことばだよ。',
        '「中《なか》」「上《うえ》」「下《した》」の どれかだよ。',
        'みじかい ことばか、すこし ながい ことばかを 聞《き》きわけよう。',
      ],
      explain: `「${PREP_JA[w]}」と いう いみです。`,
      explainFigure: enText(w, 'xl'),
      identity: `word:${w}`,
      alt: true,
    }),
  );
}

const PHRASES: { text: string; ok: string; w1: [string, string]; w2: [string, string] }[] = [
  {
    text: 'under the desk',
    ok: 'つくえの 下《した》',
    w1: ['つくえの 上《うえ》', 'on-under'],
    w2: ['ベッドの 下《した》', 'place-mix'],
  },
  {
    text: 'in the bed',
    ok: 'ベッドの 中《なか》',
    w1: ['ベッドの 上《うえ》', 'in-on'],
    w2: ['ベッドの 下《した》', 'in-under'],
  },
  {
    text: 'on the desk',
    ok: 'つくえの 上《うえ》',
    w1: ['つくえの 中《なか》', 'in-on'],
    w2: ['ベッドの 上《うえ》', 'place-mix'],
  },
];

function phraseItems(): Item[] {
  return PHRASES.map((p) =>
    listen({
      id: `phrase:${slugOf(p.text)}`,
      objective: 'prep',
      level: 0,
      prompt: '聞《き》こえた ことばの いみは どれ？',
      audio: en('where', p.text),
      options: [
        { label: p.ok, correct: true },
        { label: p.w1[0], misconception: p.w1[1] },
        { label: p.w2[0], misconception: p.w2[1] },
      ],
      hints: [
        'はじめに ようすの ことば、さいごに ものの なまえが くるよ。',
        'さいごの ことばは、つくえか ベッドだよ。',
        'はじめの ことばが みじかいか、すこし ながいかを 聞《き》こう。',
      ],
      explain: `「${p.ok}」と いう いみです。`,
      explainFigure: enText(p.text, 'xl'),
      identity: `phrase:${slugOf(p.text)}`,
      alt: true,
    }),
  );
}

// ---- thing 練習（8問） ----
const THING: { o: Obj; p: Prep; c: Cont; mix: Obj }[] = [
  { o: 'ball', p: 'on', c: 'desk', mix: 'book' },
  { o: 'ball', p: 'under', c: 'bed', mix: 'cat' },
  { o: 'cat', p: 'under', c: 'desk', mix: 'cap' },
  { o: 'cat', p: 'on', c: 'bed', mix: 'cap' },
  { o: 'cap', p: 'on', c: 'desk', mix: 'book' },
  { o: 'cap', p: 'under', c: 'desk', mix: 'ball' },
  { o: 'book', p: 'on', c: 'desk', mix: 'cap' },
  { o: 'book', p: 'under', c: 'desk', mix: 'cat' },
];
const otherCont = (c: Cont): Cont => (c === 'desk' ? 'bed' : 'desk');

function thingItems(): Item[] {
  return THING.map(({ o, p, c, mix }) => {
    const s = sent(o, p, c);
    const c2 = otherCont(c);
    return listen({
      id: `thing:${slugOf(s)}`,
      objective: 'thing',
      level: 1,
      prompt: 'なにが どこに ある？ 聞《き》こえた 文《ぶん》に あう 絵《え》を えらぼう。',
      audio: en('where', s),
      options: [
        { figure: illFig(o, p, c), label: thingJa(o, p, c), correct: true },
        { figure: illFig(mix, p, c), label: thingJa(mix, p, c), misconception: 'thing-mix' },
        { figure: illFig(o, p, c2), label: thingJa(o, p, c2), misconception: 'place-mix' },
      ],
      hints: [
        'はじめの ほうに「なにが」、さいごに「どこ」が あるよ。',
        'えらぶ 絵《え》は、ものか、つくえ・ベッドかが ちがうよ。',
        'ものの なまえと さいごの ことばを 聞《き》いて、2つに あう 絵《え》を えらぼう。',
      ],
      explain: `${OBJ_JA[o]}は ${posJa(p, c)}に ${aru(o)}。もの・ばしょ・ようすの 3つが あう 絵《え》です。`,
      explainFigure: sceneFig(o, p, c, [s]),
      identity: `thing:${slugOf(s)}`,
    });
  });
}

// ---- thing 別例（絵を見て 3文から） ----
const PIC: { o: Obj; p: Prep; c: Cont; at: number; lines: [string, string][] }[] = [
  {
    o: 'cat',
    p: 'under',
    c: 'bed',
    at: 1,
    lines: [
      ['The cat is on the bed.', 'on-under'],
      ['The cat is under the bed.', ''],
      ['The ball is under the bed.', 'thing-mix'],
    ],
  },
  {
    o: 'ball',
    p: 'in',
    c: 'desk',
    at: 0,
    lines: [
      ['The ball is in the desk.', ''],
      ['The ball is under the desk.', 'in-under'],
      ['The book is in the desk.', 'thing-mix'],
    ],
  },
  {
    o: 'cap',
    p: 'on',
    c: 'bed',
    at: 1,
    lines: [
      ['The cap is on the desk.', 'place-mix'],
      ['The cap is on the bed.', ''],
      ['The cap is under the bed.', 'on-under'],
    ],
  },
  {
    o: 'book',
    p: 'on',
    c: 'desk',
    at: 2,
    lines: [
      ['The cat is on the desk.', 'thing-mix'],
      ['The book is in the desk.', 'in-on'],
      ['The book is on the desk.', ''],
    ],
  },
];

function picItems(): Item[] {
  return PIC.map(({ o, p, c, at, lines }) =>
    listen({
      id: `pic:${il(o, p, c)}`,
      objective: 'thing',
      level: 1,
      prompt:
        '絵《え》を 見《み》てから、3つの 文《ぶん》を 聞《き》こう。絵《え》に あう 文《ぶん》は なんばんめ？',
      figure: illFig(o, p, c),
      audio: lines.map(([t]) => en('where', t)),
      gapMs: 900,
      options: ordinalOptions(3, at, (i) => lines[i]![1]),
      fixedOrder: true,
      hints: [
        '絵《え》を 見《み》て、なにが どこに あるか たしかめよう。',
        '3つの 文《ぶん》は、ものの なまえか ばしょの ことばが すこしずつ ちがうよ。',
        '絵《え》に あう ことばが ぜんぶ そろって いる 文《ぶん》を さがそう。',
      ],
      explain: `${at + 1}ばんめの 文《ぶん》が 絵《え》と あいます。`,
      explainFigure: { kind: 'column', items: lines.map(([t]) => enText(t, 'm')) },
      identity: `pic:${il(o, p, c)}`,
      alt: true,
    }),
  );
}

// ---- ask 練習（8問） ----
interface Ask {
  q: string;
  a: string;
  o: Obj;
  p: Prep;
  c: Cont;
  /** ようすだけ 違う 誤答 */
  p2: Prep;
  /** ものだけ 違う 誤答 */
  o2: Obj;
}
const ASK: Ask[] = [
  {
    q: 'Where is my cap?',
    a: "It's under the desk.",
    o: 'cap',
    p: 'under',
    c: 'desk',
    p2: 'on',
    o2: 'ball',
  },
  {
    q: 'Where is the cat?',
    a: "It's on the desk.",
    o: 'cat',
    p: 'on',
    c: 'desk',
    p2: 'under',
    o2: 'book',
  },
  {
    q: 'Where is my ball?',
    a: "It's in the desk.",
    o: 'ball',
    p: 'in',
    c: 'desk',
    p2: 'on',
    o2: 'cap',
  },
  {
    q: 'Where is my book?',
    a: "It's on the bed.",
    o: 'book',
    p: 'on',
    c: 'bed',
    p2: 'under',
    o2: 'cap',
  },
  {
    q: 'Where is the cat?',
    a: "It's in the bed.",
    o: 'cat',
    p: 'in',
    c: 'bed',
    p2: 'under',
    o2: 'ball',
  },
  {
    q: 'Where is my ball?',
    a: "It's under the bed.",
    o: 'ball',
    p: 'under',
    c: 'bed',
    p2: 'on',
    o2: 'cat',
  },
  {
    q: 'Where is my cap?',
    a: "It's in the desk.",
    o: 'cap',
    p: 'in',
    c: 'desk',
    p2: 'under',
    o2: 'book',
  },
  {
    q: 'Where is my book?',
    a: "It's under the desk.",
    o: 'book',
    p: 'under',
    c: 'desk',
    p2: 'in',
    o2: 'ball',
  },
];

function askItems(): Item[] {
  return ASK.map(({ q, a, o, p, c, p2, o2 }) =>
    listen({
      id: `ask:${slugOf(q)}:${slugOf(a)}`,
      objective: 'ask',
      level: 2,
      prompt: '「どこ？」と たずねて、こたえて いるよ。たずねた ものは どこに ある？',
      audio: [en('where', q), en('where', a)],
      gapMs: 800,
      options: [
        { figure: illFig(o, p, c), label: thingJa(o, p, c), correct: true },
        { figure: illFig(o, p2, c), label: thingJa(o, p2, c), misconception: pairMis(p, p2) },
        { figure: illFig(o2, p, c), label: thingJa(o2, p, c), misconception: 'it-mix' },
      ],
      hints: [
        '1つめは「〜は どこ？」と たずねる 文《ぶん》だよ。なにを さがして いるかな。',
        'こたえの 文《ぶん》の はじめの ことばは、たずねた ものの ことだよ。',
        'こたえの まんなかと さいごの ことばで、ばしょが わかるよ。',
      ],
      explain: `たずねた ${OBJ_JA[o]}は、${posJa(p, c)}に ${aru(o)}。`,
      explainFigure: sceneFig(o, p, c, [q, a]),
      identity: `ask:${slugOf(q)}:${slugOf(a)}`,
    }),
  );
}

// ---- ask 別例（ない ばしょ → ある ばしょ） ----
interface Not {
  q: string;
  a: string;
  o: Obj;
  /** 「ない」と いった ばしょ（not-heard の 絵） */
  np: Prep;
  nc: Cont;
  p: Prep;
  c: Cont;
  /** もう1つの 誤答 */
  xp: Prep;
  xc: Cont;
  xm: string;
}
const NOT: Not[] = [
  {
    q: 'Where is my ball?',
    a: "It's not on the bed. It's under the bed.",
    o: 'ball',
    np: 'on',
    nc: 'bed',
    p: 'under',
    c: 'bed',
    xp: 'under',
    xc: 'desk',
    xm: 'place-mix',
  },
  {
    q: 'Where is the cat?',
    a: "It's not under the desk. It's on the desk.",
    o: 'cat',
    np: 'under',
    nc: 'desk',
    p: 'on',
    c: 'desk',
    xp: 'on',
    xc: 'bed',
    xm: 'place-mix',
  },
  {
    q: 'Where is my book?',
    a: "It's not in the desk. It's on the desk.",
    o: 'book',
    np: 'in',
    nc: 'desk',
    p: 'on',
    c: 'desk',
    xp: 'on',
    xc: 'bed',
    xm: 'place-mix',
  },
  {
    q: 'Where is my cap?',
    a: "It's not on the bed. It's on the desk.",
    o: 'cap',
    np: 'on',
    nc: 'bed',
    p: 'on',
    c: 'desk',
    xp: 'under',
    xc: 'desk',
    xm: 'on-under',
  },
];

function notItems(): Item[] {
  return NOT.map((n) =>
    listen({
      id: `not:${slugOf(n.q)}:${slugOf(n.a)}`,
      objective: 'ask',
      level: 2,
      prompt: 'たずねた ものは どこに ある？ 「ない」ばしょも いって いるよ。',
      audio: [en('where', n.q), en('where', n.a)],
      gapMs: 800,
      options: [
        { figure: illFig(n.o, n.p, n.c), label: thingJa(n.o, n.p, n.c), correct: true },
        {
          figure: illFig(n.o, n.np, n.nc),
          label: thingJa(n.o, n.np, n.nc),
          misconception: 'not-heard',
        },
        {
          figure: illFig(n.o, n.xp, n.xc),
          label: thingJa(n.o, n.xp, n.xc),
          misconception: n.xm,
        },
      ],
      hints: [
        'こたえには 2つの 文《ぶん》が あるよ。',
        '1つめの こたえは「そこには ない」と いう いみだよ。',
        '2つめの こたえの ばしょを 聞《き》こう。',
      ],
      explain: `${posJa(n.np, n.nc)}には ${nakute(n.o)}、${posJa(n.p, n.c)}に ${aru(n.o)}。`,
      explainFigure: sceneFig(n.o, n.p, n.c, [n.q, n.a]),
      identity: `not:${slugOf(n.q)}:${slugOf(n.a)}`,
      alt: true,
    }),
  );
}

export const where: UnitSpec = {
  id: 'g5.en.where',
  title: 'どこに あるかを 聞《き》こう',
  stage: 'g5',
  subject: 'en',
  domain: 'en',
  kind: 'knowledge',
  priority: 'P2',
  status: 'ready',
  icon: 'subj-eigo',
  prereq: ['g5.en.listen-self'],
  objectives: [
    {
      id: 'prep',
      title: 'ばしょの ようすの ことば（中《なか》・上《うえ》・下《した》）を 聞《き》きわける',
    },
    { id: 'thing', title: 'なにが どこに あるかを 聞《き》きとる' },
    { id: 'ask', title: '「どこ？」と たずねる 文《ぶん》と こたえを 聞《き》きとる' },
  ],
  misconceptions: [
    {
      id: 'in-on',
      explain:
        '「中《なか》」と「上《うえ》」を とりちがえたのかな。どちらも みじかい ことばだよ。はじめの 音《おと》が、「中《なか》」は イに にた 音《おと》、「上《うえ》」は アや オに にた 音《おと》だよ。',
    },
    {
      id: 'in-under',
      explain:
        '「中《なか》」と「下《した》」を とりちがえたのかな。「下《した》」を あらわす ことばは、2つの 音《おと》が つづく すこし ながい ことばだよ。',
    },
    {
      id: 'on-under',
      explain:
        '「上《うえ》」と「下《した》」を とりちがえたのかな。「上《うえ》」の ことばは みじかく、「下《した》」の ことばは すこし ながいよ。',
    },
    {
      id: 'thing-mix',
      explain:
        'ものの なまえを とりちがえたのかな。はじめの ほうの ことばを もういちど 聞《き》こう。',
    },
    {
      id: 'place-mix',
      explain:
        'つくえと ベッドを とりちがえたのかな。文《ぶん》の さいごの ことばを もういちど 聞《き》こう。',
    },
    {
      id: 'it-mix',
      explain:
        'たずねた ものと ちがう ものを えらんだのかな。こたえの はじめの ことばは、たずねた ものの ことだよ。',
    },
    {
      id: 'not-heard',
      explain:
        '「そこには ない」の ぶぶんを 聞《き》きのがしたのかな。こたえの 1つめの 文《ぶん》は「ない」ばしょ、2つめの 文《ぶん》が「ある」ばしょだよ。',
    },
  ],
  levels: [
    { label: 'ばしょの ことば', chance: 0.05 },
    { label: 'なにが どこに', chance: 0.05 },
    { label: 'たずねて こたえる', chance: 0.05 },
  ],
  intro: [
    {
      text: 'ものの ばしょは、「中《なか》」「上《うえ》」「下《した》」を あらわす ことばで つたえるよ。',
      figure: {
        kind: 'row',
        items: [
          col('en56-ball-in-desk', 'in'),
          col('en56-ball-on-desk', 'on'),
          col('en56-ball-under-desk', 'under'),
        ],
      },
    },
    {
      text: '「〜は どこ？」と たずねられたら、ばしょを こたえるよ。',
      figure: {
        kind: 'column',
        items: [enText('Where is the ball?', 'l'), enText("It's under the desk.", 'l')],
      },
    },
  ],
  source: {
    kind: 'items',
    items: [
      ...posItems(),
      ...wordItems(),
      ...phraseItems(),
      ...thingItems(),
      ...picItems(),
      ...askItems(),
      ...notItems(),
    ],
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）外国語 第5・6学年 聞くこと（日常生活に関する身近で簡単な事柄について、具体的な情報を聞き取る）。物の位置を表す語（in / on / under）と、場所をたずねる・答えるやり取り',
  gradeIsAppProposal: true,
  revised: '2026-10-30',
};
