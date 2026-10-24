/**
 * g3.math.time 秒、時刻や時間を求める（curriculum-matrix 3.6）。
 * 秒 → 時間の経過（ちょうどの時刻をまたぐ）→ 正午をまたぐ。
 *
 * エンジン: clock（elapsed の ask 'end'・'duration'）と number（秒の換算・〜分前）、choice（時間の単位を選ぶ）。
 * 同一性キー: 問う形 × 時刻 × 時間（'end:9:50+35'、'dur:9:50-10:25' など）。
 */
import type { Rng } from '../../core/util/rng';
import type { ClockItem, ClockTime } from '../../engines/clock/clock';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { pickObj, pickOne, wrongList } from './util';

type Obj = 'seconds' | 'end' | 'duration' | 'noon';

const pun = (m: number) => ([0, 1, 3, 4, 6, 8].includes(m % 10) ? 'ぷん' : 'ふん');
const FUN = (m: number) => `${m}分《${pun(m)}》`;
/** 時刻の文（12時間制。ampm で 午前・午後 を付ける） */
function tt(t: ClockTime, ampm = false): string {
  const pre = ampm ? (t.h < 12 ? '午前《ごぜん》' : '午後《ごご》') : '';
  const h = ampm ? t.h % 12 : t.h % 12 === 0 ? 12 : t.h % 12;
  return `${pre}${h}時《じ》${t.m === 0 ? '' : FUN(t.m)}`;
}
const dur = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}時間《じかん》${min % 60 ? FUN(min % 60) : ''}` : FUN(min));
const addMin = (t: ClockTime, d: number): ClockTime => {
  const v = (((t.h * 60 + t.m + d) % 1440) + 1440) % 1440;
  return { h: Math.floor(v / 60), m: v % 60 };
};

const SEC_UNITS = [
  { id: 'run50', text: '50mを 走《はし》るのに かかる 時間《じかん》', n: 10, u: '秒《びょう》' },
  { id: 'school', text: '学校《がっこう》で すごす 時間《じかん》', n: 6, u: '時間《じかん》' },
  { id: 'teeth', text: '歯《は》を みがく 時間《じかん》', n: 3, u: '分《ふん》' },
  { id: 'jump', text: 'なわとびで 10回《かい》 とぶ 時間《じかん》', n: 8, u: '秒《びょう》' },
  { id: 'lesson', text: '1回《かい》の じゅぎょうの 時間《じかん》', n: 45, u: '分《ふん》' },
  { id: 'sleep', text: 'よる ねて いる 時間《じかん》', n: 9, u: '時間《じかん》' },
  { id: 'blink', text: '目《め》を 10回《かい》 ぱちぱち する 時間《じかん》', n: 5, u: '秒《びょう》' },
  { id: 'walk', text: '家《いえ》から 学校《がっこう》まで 歩《ある》く 時間《じかん》', n: 15, u: '分《ふん》' },
  { id: 'cup', text: 'コップの 水《みず》を のむ 時間《じかん》', n: 10, u: '秒《びょう》' },
  { id: 'trip', text: 'バスで 遠《とお》くの 町《まち》まで 行《い》く 時間《じかん》', n: 2, u: '時間《じかん》' },
] as const;

function seconds(level: number, rng: Rng, alt: boolean): NumberItem | ChoiceItem {
  if (alt) {
    const it = pickOne(rng, SEC_UNITS);
    const order = ['秒《びょう》', '分《ふん》', '時間《じかん》'] as const;
    return {
      engine: 'choice',
      id: `seconds-alt:${it.id}`,
      objective: 'seconds',
      level,
      prompt: `${it.text}は およそ ${it.n} □です。□に あてはまる たんいは どれ？`,
      hints: ['1秒《びょう》・1分《ぷん》・1時間《じかん》の 長《なが》さを 思《おも》いうかべよう。', '「いち、に、さん」と ゆっくり 言《い》う 1つ分《ぶん》が 1秒《びょう》くらい。60秒《びょう》で 1分《ぷん》。', `${it.n}を それぞれの たんいで 思《おも》いうかべて みよう。`],
      explain: `${it.text}は およそ ${it.n}${it.u}です。`,
      identity: `unit:${it.id}`,
      alt: true,
      fixedOrder: true,
      options: order.map((u) => (u === it.u ? { label: u, correct: true } : { label: u, misconception: 'unit-sense' })),
    };
  }
  const toSec = rng.next() < 0.5;
  const m = rng.int(1, 4);
  const s = rng.int(1, 59);
  const v = m * 60 + s;
  return toSec
    ? {
        engine: 'number',
        id: `seconds:ms-s:${m}:${s}`,
        objective: 'seconds',
        level,
        prompt: '□に あてはまる 数《かず》は？',
        figure: { kind: 'text', text: `${m}分《ぷん》${s}秒《びょう》 ＝ {{}}秒《びょう》`, size: 'xl' },
        hints: ['1分《ぷん》は 60秒《びょう》 だよ。', `${m}分《ぷん》は ${m * 60}秒《びょう》。`, `${m * 60}秒《びょう》と ${s}秒《びょう》を あわせよう。`],
        explain: `1分《ぷん》 ＝ 60秒《びょう》なので ${m}分《ぷん》 ＝ ${m * 60}秒《びょう》。${m * 60} ＋ ${s} ＝ ${v}で ${v}秒《びょう》です。`,
        identity: `ms-s:${m}:${s}`,
        alt: false,
        fields: [{ label: '秒《びょう》', answer: { kind: 'int', value: v } }],
        wrongAnswers: wrongList(String(v), 1, [
          [m * 100 + s, 'base100'],
          [m + s, 'base100'],
        ]),
      }
    : {
        engine: 'number',
        id: `seconds:s-ms:${v}`,
        objective: 'seconds',
        level,
        prompt: '□に あてはまる 数《かず》は？',
        figure: { kind: 'text', text: `${v}秒《びょう》 ＝ {{}}分《ふん》{{}}秒《びょう》`, size: 'xl' },
        hints: ['60秒《びょう》で 1分《ぷん》 だよ。', `${v}秒《びょう》の 中《なか》に 60秒《びょう》は いくつ あるかな。`, `${m * 60}秒《びょう》で ${m}分《ふん》。のこりは？`],
        explain: `${v}秒《びょう》 ＝ ${m * 60}秒《びょう》 ＋ ${s}秒《びょう》 ＝ ${m}分《ふん》${s}秒《びょう》です。`,
        identity: `s-ms:${v}`,
        alt: false,
        fields: [
          { label: '分《ふん》', answer: { kind: 'int', value: m } },
          { label: '秒《びょう》', answer: { kind: 'int', value: s } },
        ],
        wrongAnswers: wrongList(`${m}|${s}`, 2, [
          [v >= 100 ? `${Math.floor(v / 100)}|${v % 100}` : null, 'base100'],
          [`${Math.floor(v / 10)}|${v % 10}`, 'base100'],
        ]),
      };
}

/** ちょうどの時刻を またぐ 〜分後 */
function endItem(level: number, rng: Rng, alt: boolean): ClockItem | NumberItem {
  const h = rng.int(1, 10);
  const m = rng.int(4, 11) * 5;
  const d = rng.int(Math.max(1, (60 - m) / 5 + 1), 18) * 5;
  const t = { h, m };
  if (alt) {
    // 〜分前（ちょうどの時刻を またいで もどる）
    const back = rng.int(Math.floor(m / 5) + 1, 15) * 5;
    const e = addMin(t, -back);
    const eh = e.h % 12 === 0 ? 12 : e.h % 12;
    return {
      engine: 'number',
      id: `end-alt:${h}:${m}-${back}`,
      objective: 'end',
      level,
      prompt: `${tt(t)}に 駅《えき》に つきました。家《いえ》を 出《で》たのは その ${FUN(back)}前《まえ》です。家《いえ》を 出《で》た じこくは？`,
      figure: { kind: 'clock', h, m, minuteNumbers: true },
      hints: ['ながい はりを ぎゃくに まわして 考《かんが》えよう。', `${tt(t)}から ${FUN(m)} もどると ${h}時《じ》ちょうど。`, `${h}時《じ》から あと ${FUN(back - m)} もどると？`],
      explain: `${tt(t)}から ${FUN(m)} もどって ${h}時《じ》。あと ${FUN(back - m)} もどって ${tt({ h: eh, m: e.m })}です。`,
      identity: `before:${h}:${m}-${back}`,
      alt: true,
      fields: [
        { label: '時《じ》', answer: { kind: 'int', value: eh } },
        { label: '分《ふん》', answer: { kind: 'int', value: e.m } },
      ],
      wrongAnswers: wrongList(`${eh}|${e.m}`, 2, [
        [back - m < 60 ? `${h}|${60 + m - back}` : null, 'no-borrow-hour'],
        [`${addMin(t, back).h % 12 || 12}|${addMin(t, back).m}`, 'direction'],
      ]),
    };
  }
  const e = addMin(t, d);
  const rest = d - (60 - m);
  return {
    engine: 'clock',
    id: `end:${h}:${m}+${d}`,
    objective: 'end',
    level,
    prompt: `${tt(t)}から ${dur(d)}たった じこくは 何時《なんじ》何分《なんぷん》ですか。`,
    hints: [
      'ちょうどの じこくで 区切《くぎ》って 考《かんが》えよう。',
      `${tt(t)}から ${FUN(60 - m)}で ${h + 1}時《じ》ちょうど。`,
      `${h + 1}時《じ》から あと ${dur(rest)}たつと？`,
    ],
    explain: `${tt(t)}から ${FUN(60 - m)}で ${h + 1}時《じ》。あと ${dur(rest)}で ${tt(e)}です。60分《ぷん》で 1時間《じかん》 すすむよ。`,
    identity: `end:${h}:${m}+${d}`,
    alt: false,
    task: { kind: 'elapsed', start: t, end: e, ask: 'end', answerBy: 'input' },
    minuteNumbers: true,
    misconceptions: { noCarry: 'no-carry-hour' },
    wrongAnswers: rest < 60 ? [{ time: { h, m: rest }, misconception: 'no-carry-hour' }] : [],
  };
}

/** かかった時間（ちょうどの時刻を またぐ） */
function durationItem(level: number, rng: Rng, alt: boolean): ClockItem {
  const h = rng.int(1, 10);
  const m = rng.int(2, 11) * 5;
  const d = alt ? rng.int(13, 30) * 5 : rng.int(Math.max(1, (60 - m) / 5 + 1), 11) * 5;
  const t = { h, m };
  const e = addMin(t, d);
  const raw = e.h * 100 + e.m - (h * 100 + m);
  return {
    engine: 'clock',
    id: `duration${alt ? '-alt' : ''}:${h}:${m}+${d}`,
    objective: 'duration',
    level,
    prompt: alt
      ? `${tt(t)}から ${tt(e)}まで 公園《こうえん》で 遊《あそ》びました。遊《あそ》んだ 時間《じかん》は 何時間《なんじかん》何分《なんぷん》ですか。`
      : `${tt(t)}から ${tt(e)}までの 時間《じかん》は 何分《なんぷん》ですか。`,
    hints: [
      'ちょうどの じこくで 区切《くぎ》って 考《かんが》えよう。',
      `${tt(t)}から ${(h % 12) + 1}時《じ》までは ${FUN(60 - m)}。`,
      `${(h % 12) + 1}時《じ》から ${tt(e)}までは？ 2つを あわせよう。`,
    ],
    explain: `${tt(t)}から ${(h % 12) + 1}時《じ》まで ${FUN(60 - m)}、${(h % 12) + 1}時《じ》から ${tt(e)}まで ${dur(d - 60 + m)}。あわせて ${dur(d)}です。`,
    identity: `dur:${h}:${m}+${d}`,
    alt,
    task: { kind: 'elapsed', start: t, end: e, ask: 'duration', unit: alt ? 'hm' : 'min' },
    minuteNumbers: true,
    misconceptions: { base100: 'base100' },
    wrongAnswers: raw !== d && raw > 0 ? [{ minutes: raw, misconception: 'base100' }] : [],
  };
}

/** 正午を またぐ */
function noon(level: number, rng: Rng, alt: boolean): ClockItem | NumberItem {
  if (alt) {
    const s = rng.int(7, 11);
    const e = rng.int(1, 6);
    const hours = 12 - s + e;
    return {
      engine: 'number',
      id: `noon-alt:${s}-${e}`,
      objective: 'noon',
      level,
      prompt: `午前《ごぜん》${s}時《じ》から 午後《ごご》${e}時《じ》まで 図書館《としょかん》に いました。何時間《なんじかん》 いましたか。`,
      figure: { kind: 'numberline', min: 0, max: 24, step: 6, minorStep: 1, labelEvery: 6, marks: [{ at: s, tone: 'focus' }, { at: 12 + e, tone: 'focus' }] },
      hints: ['正午《しょうご》（ひるの 12時《じ》）で 区切《くぎ》ろう。', `午前《ごぜん》${s}時《じ》から 正午《しょうご》まで ${12 - s}時間《じかん》。`, `正午《しょうご》から 午後《ごご》${e}時《じ》までは ${e}時間《じかん》。あわせると？`],
      explain: `${12 - s}時間《じかん》と ${e}時間《じかん》で ${hours}時間《じかん》です。`,
      identity: `noon-h:${s}-${e}`,
      alt: true,
      fields: [{ label: '時間《じかん》', answer: { kind: 'int', value: hours } }],
      wrongAnswers: wrongList(String(hours), 1, [
        [Math.abs(s - e), 'ampm-ignore'],
        [s + e, 'ampm-ignore'],
      ]),
    };
  }
  const sh = rng.int(9, 11);
  const sm = rng.int(1, 11) * 5;
  const eh = rng.int(12, 15);
  const em = rng.int(0, 11) * 5;
  const start = { h: sh, m: sm };
  const end = { h: eh, m: em };
  const d = eh * 60 + em - (sh * 60 + sm);
  const ignore = Math.abs((eh % 12) * 60 + em - (sh * 60 + sm));
  return {
    engine: 'clock',
    id: `noon:${sh}:${sm}-${eh}:${em}`,
    objective: 'noon',
    level,
    prompt: `${tt(start, true)}から ${tt(end, true)}までの 時間《じかん》は 何時間《なんじかん》何分《なんぷん》ですか。`,
    hints: [
      '正午《しょうご》（ひるの 12時《じ》）で 区切《くぎ》って 考《かんが》えよう。',
      `${tt(start, true)}から 正午《しょうご》までは ${dur(12 * 60 - sh * 60 - sm)}。`,
      `正午《しょうご》から ${tt(end, true)}までは ${dur((eh - 12) * 60 + em) || '0分《ぷん》'}。あわせると？`,
    ],
    explain: `正午《しょうご》まで ${dur(12 * 60 - sh * 60 - sm)}、正午《しょうご》から ${(eh - 12) * 60 + em === 0 ? '0分《ぷん》' : dur((eh - 12) * 60 + em)}。あわせて ${dur(d)}です。`,
    identity: `noon:${sh}:${sm}-${eh}:${em}`,
    alt: false,
    dayHalf: true,
    task: { kind: 'elapsed', start, end, ask: 'duration', unit: 'hm' },
    minuteNumbers: true,
    misconceptions: { base100: 'base100' },
    wrongAnswers: ignore !== d && ignore > 0 ? [{ minutes: ignore, misconception: 'ampm-ignore' }] : [],
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['seconds', 'end'] },
  { objs: ['end', 'duration', 'seconds'] },
  { objs: ['duration', 'noon', 'end'] },
  { objs: ['seconds', 'end', 'duration', 'noon'] },
];

export function generateTime(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.25;
  switch (obj) {
    case 'seconds':
      return seconds(level, rng, alt);
    case 'end':
      return endItem(level, rng, alt);
    case 'duration':
      return durationItem(level, rng, alt);
    case 'noon':
      return noon(level, rng, alt);
  }
}

export const time: UnitSpec = {
  id: 'g3.math.time',
  title: '時《じ》こくと 時間《じかん》',
  stage: 'g3',
  subject: 'math',
  domain: 'C-measure',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'g1m-clock',
  prereq: ['g2.math.time'],
  objectives: [
    { id: 'seconds', title: '秒《びょう》' },
    { id: 'end', title: '〜分後《ふんご》・〜分前《ふんまえ》の じこく' },
    { id: 'duration', title: 'かかった 時間《じかん》' },
    { id: 'noon', title: '正午《しょうご》を またぐ 時間《じかん》' },
  ],
  misconceptions: [
    {
      id: 'base100',
      explain: '1時間《じかん》を 100分《ぷん》、1分《ぷん》を 100秒《びょう》と 考《かんが》えたのかな。1時間《じかん》 ＝ 60分《ぷん》、1分《ぷん》 ＝ 60秒《びょう》だよ。',
      figure: { kind: 'text', text: '9時50分 → 10時25分 は 35分（75分 では ない）', size: 'm' },
    },
    {
      id: 'no-carry-hour',
      explain: '60分《ぷん》で 1時間《じかん》 すすむのを わすれたのかな。ちょうどの じこくで 区切《くぎ》ると わかりやすいよ。',
    },
    {
      id: 'no-borrow-hour',
      explain: 'もどる ときに「時《じ》」が 1 へるのを わすれたのかな。ちょうどの じこくを こえて もどると、時《じ》が へるよ。',
    },
    {
      id: 'direction',
      explain: '「前《まえ》」と「後《あと》」を 反対《はんたい》に したのかな。前《まえ》は はりを ぎゃくに まわすよ。',
    },
    {
      id: 'ampm-ignore',
      explain: '午前《ごぜん》と 午後《ごご》の ちがいを わすれたのかな。正午《しょうご》で 区切《くぎ》って、午前《ごぜん》の ぶんと 午後《ごご》の ぶんを あわせよう。',
    },
    {
      id: 'unit-sense',
      explain: 'その たんいだと 長《なが》すぎるか 短《みじか》すぎるかな。1秒《びょう》・1分《ぷん》・1時間《じかん》の 長《なが》さを 思《おも》いうかべよう。',
    },
  ],
  levels: [
    { label: '秒・〜分後', chance: 0.05 },
    { label: 'かかった 時間', chance: 0.05 },
    { label: '正午を またぐ', chance: 0.05 },
    { label: 'まとめ', chance: 0.05 },
  ],
  intro: [
    {
      text: '1分《ぷん》より 短《みじか》い 時間《じかん》は 秒《びょう》で あらわします。1分《ぷん》 ＝ 60秒《びょう》。',
      figure: { kind: 'text', text: '1分《ぷん》 ＝ 60秒《びょう》', size: 'xl' },
    },
    {
      text: '9時《じ》50分《ぷん》から 10時《じ》25分《ふん》までは、9時《じ》50分《ぷん》から 10時《じ》まで 10分《ぷん》、10時《じ》から 10時《じ》25分《ふん》まで 25分《ふん》。あわせて 35分《ふん》。',
      figure: { kind: 'clock', h: 10, m: 25, minuteNumbers: true },
    },
    {
      text: '午前《ごぜん》と 午後《ごご》を またぐ ときは、正午《しょうご》（ひるの 12時《じ》）で 区切《くぎ》って 考《かんが》えます。',
      figure: { kind: 'numberline', min: 0, max: 24, step: 6, minorStep: 1, labelEvery: 6, marks: [{ at: 12, tone: 'focus' }] },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateTime(level, rng, index),
  },
  review: 'type',
  basis: '小学校学習指導要領（平成29年告示）算数 第3学年 C(2) 時間の単位（秒）、日常生活に必要な時刻や時間を求める',
  revised: '2026-10-24',
};
