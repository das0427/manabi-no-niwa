/**
 * g4.en.time-days 曜日《ようび》・じこくを 聞《き》きとる（curriculum-matrix 3.7。外活34 聞く）。
 *   段階0: 曜日
 *   段階1: 時刻（〜時ちょうど・〜時30分）。時計の絵を えらぶ
 *   段階2: 1日の よてい（I get up at six. など）
 * 同一性キー: 形式 × 英語の語・文。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { en, enText, listen, pickOthers, rangeKeepsTwo, SAY_HINT, slugOf } from './lib';

const DAYS: { word: string; ja: string; kanji: string }[] = [
  { word: 'Sunday', ja: 'にちようび', kanji: '日《にち》' },
  { word: 'Monday', ja: 'げつようび', kanji: '月《げつ》' },
  { word: 'Tuesday', ja: 'かようび', kanji: '火《か》' },
  { word: 'Wednesday', ja: 'すいようび', kanji: '水《すい》' },
  { word: 'Thursday', ja: 'もくようび', kanji: '木《もく》' },
  { word: 'Friday', ja: 'きんようび', kanji: '金《きん》' },
  { word: 'Saturday', ja: 'どようび', kanji: '土《ど》' },
];

/** 聞きまちがえやすい 曜日の組 */
const DAY_CONFUSE: Record<string, [string, string]> = {
  Sunday: ['Saturday', 'Monday'],
  Monday: ['Sunday', 'Friday'],
  Tuesday: ['Thursday', 'Wednesday'],
  Wednesday: ['Tuesday', 'Monday'],
  Thursday: ['Tuesday', 'Saturday'],
  Friday: ['Monday', 'Thursday'],
  Saturday: ['Sunday', 'Thursday'],
};
const dayMis = (a: string, b: string) =>
  (a[0] === 'T' && b[0] === 'T') || (a[0] === 'S' && b[0] === 'S') ? 'day-start' : 'day-ending';

function dayItems(): Item[] {
  const out: Item[] = [];
  for (const d of DAYS) {
    const wrong = DAY_CONFUSE[d.word]!.map((w) => DAYS.find((x) => x.word === w)!);
    out.push(
      listen({
        id: `day:${d.word}`,
        objective: 'day',
        level: 0,
        prompt: '聞《き》こえた 曜日《ようび》は どれ？',
        audio: en('day', d.word),
        options: [
          { label: d.ja, correct: true },
          ...wrong.map((w) => ({ label: w.ja, misconception: dayMis(d.word, w.word) })),
        ],
        hints: [
          '曜日《ようび》は どれも おわりの 音《おと》が おなじ。はじめの ほうを よく 聞《き》こう。',
          'はじめの 音《おと》が にている 曜日《ようび》が 2つずつ あるよ。',
          `しゅうまつ（土《ど》・日《にち》）か、へいじつかを かんがえよう。${d.word === 'Sunday' || d.word === 'Saturday' ? 'しゅうまつの 曜日《ようび》だよ。' : 'へいじつの 曜日《ようび》だよ。'}`,
        ],
        explain: `${d.ja}の ことです。`,
        explainFigure: enText(d.word),
        identity: `day:${d.word}`,
      }),
    );
  }
  // 別例: こよみの 1文字（月・火 …）で えらぶ
  for (const d of DAYS) {
    const wrong = DAY_CONFUSE[d.word]!.map((w) => DAYS.find((x) => x.word === w)!);
    out.push(
      listen({
        id: `day-cal:${d.word}`,
        objective: 'day',
        level: 1,
        prompt:
          'カレンダーには 曜日《ようび》が 1文字《もじ》で かいて あるよ。聞《き》こえた 曜日《ようび》は どれ？',
        audio: en('day', d.word),
        options: [
          { label: d.kanji, correct: true },
          ...wrong.map((w) => ({ label: w.kanji, misconception: dayMis(d.word, w.word) })),
        ],
        hints: [
          'まず 曜日《ようび》を 聞《き》きとろう。',
          'カレンダーの 1文字《もじ》は、曜日《ようび》の なまえの はじめの 字《じ》だよ。',
          `しゅうまつか、へいじつかを かんがえよう。`,
        ],
        explain: `${d.ja}なので「${d.kanji}」です。`,
        explainFigure: enText(d.word),
        identity: `day-cal:${d.word}`,
        alt: true,
      }),
    );
  }
  return out;
}

const NUM = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
];
/** 聞きまちがえやすい 時 */
const HOUR_CONFUSE: Record<number, [number, number]> = {
  1: [9, 11],
  2: [10, 12],
  3: [2, 10],
  4: [5, 1],
  5: [4, 9],
  6: [7, 8],
  7: [6, 11],
  8: [6, 4],
  9: [5, 1],
  10: [2, 12],
  11: [7, 12],
  12: [2, 11],
};

const clock = (h: number, m = 0): Figure => ({ kind: 'clock', h, m });

function timeItems(): Item[] {
  const out: Item[] = [];
  for (let h = 1; h <= 12; h++) {
    const text = `It's ${NUM[h]} o'clock.`;
    const hours = [h, ...HOUR_CONFUSE[h]!];
    out.push(
      listen({
        id: `oclock:${h}`,
        objective: 'time',
        level: 1,
        prompt: '聞《き》こえた じこくの 時計《とけい》は どれ？',
        audio: en('time', text),
        options: [
          { figure: clock(h), label: `${h}じ`, correct: true },
          ...HOUR_CONFUSE[h]!.map((x) => ({
            figure: clock(x),
            label: `${x}じ`,
            misconception: 'same-start',
          })),
        ],
        hints: [
          'かずの ことばを よく 聞《き》こう。',
          'さいごの ことばは「ちょうど」の いみだよ。みじかい はりは どこかな。',
          rangeKeepsTwo(hours, (x) => x <= 6 === h <= 6)
            ? h <= 6
              ? '1から 6の どれかだよ。'
              : '7から 12の どれかだよ。'
            : SAY_HINT,
        ],
        explain: `${h}じ ちょうど です。`,
        explainFigure: enText(text),
        identity: `oclock:${h}`,
      }),
    );
  }
  // 別例: 30分の 時刻。デジタルの 書き方で えらぶ
  const HALF = [3, 5, 6, 7, 8, 10, 11];
  for (const h of HALF) {
    const text = `It's ${NUM[h]} thirty.`;
    const wrongH = HOUR_CONFUSE[h]![0];
    out.push(
      listen({
        id: `half:${h}`,
        objective: 'time',
        level: 1,
        prompt: '聞《き》こえた じこくは どれ？',
        audio: en('time', text),
        options: [
          { label: `${h}:30`, correct: true },
          { label: `${h}:00`, misconception: 'thirty-oclock' },
          { label: `${wrongH}:30`, misconception: 'same-start' },
        ],
        hints: [
          'はじめの かずが「なんじ」、あとの かずが「なんぷん」だよ。',
          'あとの かずは 30の ことだよ。',
          // ②で h:00 が きえるので、範囲で wrongH も きえる ときは ③で しぼらない
          wrongH <= 6 !== h <= 6
            ? SAY_HINT
            : h <= 6
              ? 'はじめの かずは 1から 6の どれかだよ。'
              : 'はじめの かずは 7から 12の どれかだよ。',
        ],
        explain: `${h}じ 30ぷん です。`,
        explainFigure: enText(text),
        identity: `half:${h}`,
        alt: true,
      }),
    );
  }
  return out;
}

interface Plan {
  text: string;
  h: number;
  ja: string;
  q: string;
}
/** 1日の よてい（9） */
const PLANS: Plan[] = [
  { text: 'I get up at six.', h: 6, ja: 'おきる', q: 'What time do you get up?' },
  {
    text: 'I eat breakfast at seven.',
    h: 7,
    ja: 'あさごはんを たべる',
    q: 'What time do you eat breakfast?',
  },
  {
    text: 'I go to school at eight.',
    h: 8,
    ja: 'がっこうへ いく',
    q: 'What time do you go to school?',
  },
  {
    text: 'I eat lunch at twelve.',
    h: 12,
    ja: 'ひるごはんを たべる',
    q: 'What time do you eat lunch?',
  },
  { text: 'I go home at three.', h: 3, ja: 'いえに かえる', q: 'What time do you go home?' },
  {
    text: 'I do my homework at four.',
    h: 4,
    ja: 'しゅくだいを する',
    q: 'What time do you do your homework?',
  },
  {
    text: 'I eat dinner at six.',
    h: 6,
    ja: 'ばんごはんを たべる',
    q: 'What time do you eat dinner?',
  },
  {
    text: 'I take a bath at eight.',
    h: 8,
    ja: 'おふろに はいる',
    q: 'What time do you take a bath?',
  },
  { text: 'I go to bed at nine.', h: 9, ja: 'ねる', q: 'What time do you go to bed?' },
];

function planItems(): Item[] {
  const out: Item[] = [];
  PLANS.forEach((p, i) => {
    const other = pickOthers(PLANS, i, 1, (q) => q.ja !== p.ja && q.h !== p.h)[0]!;
    const wrongH = HOUR_CONFUSE[p.h]![0];
    const opts: ChoiceOption[] = [
      { label: `${p.h}じに ${p.ja}`, correct: true },
      { label: `${p.h}じに ${other.ja}`, misconception: 'action-mix' },
      { label: `${wrongH}じに ${p.ja}`, misconception: 'same-start' },
    ];
    out.push(
      listen({
        id: `plan:${slugOf(p.text)}`,
        objective: 'plan',
        level: 2,
        prompt: '聞《き》こえた よていは どれ？ なにを するかと、なんじかを 聞《き》こう。',
        audio: en('plan', p.text),
        options: opts,
        layout: 'column',
        hints: [
          'まんなかの ことばが「なにを するか」、さいごの かずが「なんじ」だよ。',
          `なんじかは ${p.h <= 6 ? '1から 6' : '7から 12'}の どれかだよ。`,
          'する ことの ことばを もういちど 聞《き》こう。',
        ],
        explain: `「${p.h}じに ${p.ja}」と いって います。`,
        explainFigure: enText(p.text),
        identity: `plan:${slugOf(p.text)}`,
      }),
    );
  });
  // 別例: たずねる 文と こたえを 聞いて、時計を えらぶ
  PLANS.forEach((p, i) => {
    if (i % 2 === 1) return;
    const [w1, w2] = HOUR_CONFUSE[p.h]!;
    out.push(
      listen({
        id: `plan-qa:${slugOf(p.text)}`,
        objective: 'plan',
        level: 2,
        prompt:
          'たずねる 文《ぶん》と こたえを 聞《き》こう。こたえの じこくの 時計《とけい》は どれ？',
        audio: [en('ask', p.q), en('plan', p.text)],
        gapMs: 800,
        options: [
          { figure: clock(p.h), label: `${p.h}じ`, correct: true },
          { figure: clock(w1), label: `${w1}じ`, misconception: 'same-start' },
          { figure: clock(w2), label: `${w2}じ`, misconception: 'same-start' },
        ],
        hints: [
          'さいしょは「なんじに しますか」と たずねて いるよ。',
          'こたえの 文《ぶん》の さいごの かずを 聞《き》こう。',
          `こたえの 人《ひと》は「${p.ja}」じこくを いって いるよ。`,
        ],
        explain: `${p.ja}のは ${p.h}じ です。`,
        explainFigure: enText(`${p.q}  →  ${p.text}`, 'm'),
        identity: `plan-qa:${slugOf(p.text)}`,
        alt: true,
      }),
    );
  });
  return out;
}

export const timeDays: UnitSpec = {
  id: 'g4.en.time-days',
  title: '曜日《ようび》と じこく',
  stage: 'g4',
  subject: 'en',
  domain: 'en',
  kind: 'knowledge',
  priority: 'P1',
  status: 'ready',
  icon: 'p5-clock',
  prereq: ['g3.en.numbers-colors'],
  objectives: [
    { id: 'day', title: '曜日《ようび》の なまえが わかる' },
    { id: 'time', title: 'じこくを 聞《き》きとる' },
    { id: 'plan', title: '1日《にち》の よていを 聞《き》きとる' },
  ],
  misconceptions: [
    {
      id: 'day-start',
      explain:
        'はじめの 音《おと》が にている 曜日《ようび》と まちがえたのかな。かよう日《び》と もくよう日《び》、どよう日《び》と にちよう日《び》は とくに にているよ。',
    },
    {
      id: 'day-ending',
      explain:
        '曜日《ようび》は おわりの 音《おと》が みんな おなじ。はじめの 音《おと》で 聞《き》きわけよう。',
    },
    {
      id: 'same-start',
      explain: '音《おと》が にている かずと まちがえたのかな。もういちど 聞《き》こう。',
    },
    {
      id: 'thirty-oclock',
      explain:
        '「ちょうど」と「30ぷん」を とりちがえたのかな。さいごの ことばを よく 聞《き》こう。',
    },
    {
      id: 'action-mix',
      explain: 'する ことを とりちがえたのかな。まんなかの ことばを もういちど 聞《き》こう。',
    },
  ],
  levels: [
    { label: '曜日《ようび》', chance: 0.05 },
    { label: 'じこく', chance: 0.05 },
    { label: '1日《にち》の よてい', chance: 0.05 },
  ],
  intro: [
    {
      text: '曜日《ようび》の ことばを 聞《き》いて えらぶよ。これは「げつようび」。',
      figure: enText('Monday', 'xl'),
    },
    {
      text: 'じこくは こう いうよ。かずの あとの ことばは「ちょうど」の いみ。',
      figure: {
        kind: 'row',
        items: [{ kind: 'clock', h: 7, m: 0 }, enText("It's seven o'clock.", 'l')],
      },
    },
  ],
  source: { kind: 'items', items: [...dayItems(), ...timeItems(), ...planItems()] },
  review: 'item',
  basis:
    '小学校学習指導要領（平成29年告示）外国語活動 第3・4学年 聞くこと（曜日・時刻など身近で簡単な事柄）',
  gradeIsAppProposal: true,
  revised: '2026-10-24',
};
