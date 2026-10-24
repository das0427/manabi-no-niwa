/**
 * g2.math.time 時刻と時間（日・時・分、午前・午後）（curriculum-matrix 3.5）。
 * 何時何分を読む →「30分後は」→ 1日＝24時間。
 *
 * エンジン: clock（read・set・elapsed）と number（時間の単位の換算・何分前）。
 * 同一性キー: 問う形 × 時刻（× 時間）。例 'read:8:40'、'after:8:40+30'。
 * 定義域: 時刻 12×60、経過は 5分きざみ × 5〜55分 など、数百通り。
 */
import type { Rng } from '../../core/util/rng';
import type { ClockItem, ClockTime } from '../../engines/clock/clock';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { pickObj, wrongList } from './util';

type Obj = 'read' | 'after' | 'duration' | 'units' | 'ampm';

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['read', 'after'] },
  { objs: ['read', 'after', 'duration', 'units'] },
  { objs: ['after', 'duration', 'units', 'ampm'] },
];

const fun = (m: number) => ([0, 1, 3, 4, 6, 8].includes(m % 10) ? 'ぷん' : 'ふん');
const tt = (t: ClockTime) => (t.m === 0 ? `${t.h}じ` : `${t.h}じ${t.m}${fun(t.m)}`);
const addMin = (t: ClockTime, d: number): ClockTime => {
  const v = (((t.h * 60 + t.m + d) % 1440) + 1440) % 1440;
  return { h: Math.floor(v / 60), m: v % 60 };
};

/** 何時何分を読む（1分きざみ。alt は針を合わせる） */
function read(level: number, rng: Rng, alt: boolean): ClockItem {
  const h = rng.int(1, 12);
  let m: number;
  do m = rng.int(1, 59);
  while (m % 5 === 0 && rng.next() < 0.5);
  const t = { h, m };
  const near = Math.floor(m / 5) * 5;
  // 0ふん の めもりは「すうじ 12の めもり」と いう
  const nearMark = near === 0 ? 'すうじ 12の めもり' : `${near}${fun(near)}の めもり`;
  if (alt)
    return {
      engine: 'clock',
      id: `read-alt:${h}:${m}`,
      objective: 'read',
      level,
      prompt: `${tt(t)}に はりを あわせよう。`,
      hints: [
        'ながい はりは「ふん」、みじかい はりは「じ」だよ。',
        m === near
          ? `ながい はりを すうじ ${m / 5 === 0 ? 12 : m / 5}の ところへ。`
          : `ながい はりを ${nearMark}から ${m - near}めもり すすめよう。`,
        `みじかい はりは ${h}と ${h === 12 ? 1 : h + 1}の あいだ。`,
      ],
      explain: `ながい はりが ${m}${fun(m)}、みじかい はりが ${h}と ${h === 12 ? 1 : h + 1}の あいだで ${tt(t)}です。`,
      identity: `set:${h}:${m}`,
      alt: true,
      task: { kind: 'set', target: t, start: { h: 12, m: 0 }, step: 1 },
      minuteNumbers: true,
      misconceptions: { swapHands: 'swap-hands', hourNext: 'hour-next', hourPrev: 'hour-next' },
    };
  return {
    engine: 'clock',
    id: `read:${h}:${m}`,
    objective: 'read',
    level,
    prompt: 'なんじ なんぷん？',
    hints: [
      'みじかい はりで「なんじ」、ながい はりで「なんぷん」を よもう。',
      // 5ふん きざみ ちょうどの ときに「すこし すすんで いる」と 言わない
      m === near
        ? `ながい はりは すうじの ところに あるよ。すうじ 1つで 5ふん。`
        : `ながい はりは ${nearMark}から すこし すすんで いるよ。`,
      m === near
        ? '12から すうじを 1つ すすむごとに 5ふんずつ ふやして かぞえよう。'
        : `${nearMark}から ちいさい めもりを 1つずつ かぞえよう。`,
    ],
    explain: `みじかい はりは ${h}を すぎた ところ、ながい はりは ${m}${fun(m)}。${tt(t)}です。`,
    identity: `read:${h}:${m}`,
    alt: false,
    task: { kind: 'read', time: t, answerBy: 'input' },
    minuteNumbers: level === 0,
    misconceptions: {
      swapHands: 'swap-hands',
      hourNext: 'hour-next',
      minuteNumeral: 'minute-numeral',
    },
  };
}

/** 〜分後の時刻（alt は「〜分前」を number で） */
function after(level: number, rng: Rng, alt: boolean): ClockItem | NumberItem {
  const h = rng.int(1, 11);
  const m = rng.int(0, 11) * 5;
  const d = rng.int(1, 11) * 5;
  const t = { h, m };
  if (alt) {
    // d 分前（number の2欄）
    const e = addMin(t, -d);
    const borrow = m < d;
    return {
      engine: 'number',
      id: `before:${h}:${m}-${d}`,
      objective: 'after',
      level,
      prompt: `${tt(t)}の ${d}${fun(d)}まえは なんじ なんぷん？`,
      figure: { kind: 'clock', h, m, minuteNumbers: true },
      fields: [
        { label: 'じ', answer: { kind: 'int', value: e.h === 0 ? 12 : e.h } },
        { label: 'ふん', answer: { kind: 'int', value: e.m } },
      ],
      hints: [
        'ながい はりを ぎゃくに まわして かんがえよう。',
        borrow
          ? m === 0
            ? `${h}じ ちょうどから もどると、じは ${h}じより まえに なるよ。`
            : `${tt(t)}から ${m}${fun(m)} もどると ${h}じ ちょうど。`
          : `${m}${fun(m)}から ${d}${fun(d)} もどすと…`,
        borrow ? `${h}じから あと ${d - m}${fun(d - m)} もどると？` : `じは ${h}じの まま。`,
      ],
      explain: `${tt(t)}の ${d}${fun(d)}まえは ${tt({ h: e.h === 0 ? 12 : e.h, m: e.m })}です。`,
      identity: `before:${h}:${m}-${d}`,
      alt: true,
      wrongAnswers: wrongList(`${e.h === 0 ? 12 : e.h}|${e.m}`, 2, [
        [borrow ? `${h}|${60 + m - d}` : null, 'no-borrow-hour'],
        [`${addMin(t, d).h}|${addMin(t, d).m}`, 'direction'],
      ]),
    };
  }
  const e = addMin(t, d);
  return {
    engine: 'clock',
    id: `after:${h}:${m}+${d}`,
    objective: 'after',
    level,
    prompt: `${tt(t)}の ${d}${fun(d)}ごは なんじ なんぷん？`,
    hints: [
      'おびの したの とけいで、ながい はりを すすめて かんがえよう。',
      // m ＋ d が ちょうど 60 の ときは「h+1じ ちょうど」が 答えなので 2段目で 言わない
      m + d > 60
        ? `${tt(t)}から ${60 - m}${fun(60 - m)}で ${h + 1}じ ちょうど。`
        : `${m === 0 ? `${h}じ ちょうど` : `${m}${fun(m)}`}から ${d}${fun(d)} すすむと…`,
      m + d > 60
        ? `${h + 1}じから あと ${m + d - 60}${fun(m + d - 60)} すすむと？`
        : m + d === 60
          ? 'ながい はりが 12に きたら、じが 1 ふえるよ。'
          : `じは ${h}じの まま。`,
    ],
    explain:
      m + d > 60
        ? `${tt(t)}から ${60 - m}${fun(60 - m)}で ${h + 1}じ。あと ${m + d - 60}${fun(m + d - 60)}で ${tt(e)}です。60ぷんで 1じかん すすむよ。`
        : `${tt(t)}から ${d}${fun(d)} すすんで ${tt(e)}です。`,
    identity: `after:${h}:${m}+${d}`,
    alt: false,
    task: { kind: 'elapsed', start: t, end: e, ask: 'end', answerBy: 'input' },
    minuteNumbers: true,
    misconceptions: { noCarry: 'no-carry-hour' },
    wrongAnswers:
      m + d >= 60 ? [{ time: { h, m: m + d - 60 }, misconception: 'no-carry-hour' }] : [],
  };
}

/** かかった時間 */
function duration(level: number, rng: Rng, alt: boolean): ClockItem {
  const h = rng.int(1, 10);
  const m = rng.int(0, 11) * 5;
  const d = alt ? rng.int(13, 23) * 5 : rng.int(1, 11) * 5;
  const t = { h, m };
  const e = addMin(t, d);
  const raw = e.h * 100 + e.m - (h * 100 + m);
  return {
    engine: 'clock',
    id: `duration${alt ? '-alt' : ''}:${h}:${m}+${d}`,
    objective: 'duration',
    level,
    prompt: alt
      ? `${tt(t)}から ${tt(e)}まで こうえんで あそびました。あそんだ じかんは なんじかん なんぷん？`
      : `${tt(t)}から ${tt(e)}までの じかんは なんぷん？`,
    hints: [
      'はじめの とけいから おわりの とけいまで、ながい はりが どれだけ うごいたかな。',
      // おわりが ちょうど h+1じ（m ＋ d ＝ 60）の ときは、2段目が 答えに なるので わけない
      m + d > 60 && m !== 0
        ? `${tt(t)}から ${h + 1}じまでで ${60 - m}${fun(60 - m)}。`
        : '5ふんずつ かぞえよう。',
      alt
        ? '60ぷんで 1じかん。60ぷんより おおい ぶんが のこりの ふん。'
        : m + d > 60 && m !== 0
          ? `${h + 1}じから ${tt(e)}までは？`
          : 'ながい はりの めもりの すうじを くらべよう。',
    ],
    explain: alt
      ? `${d}${fun(d)} ＝ ${Math.floor(d / 60)}じかん${d % 60 === 0 ? '' : `${d % 60}${fun(d % 60)}`}。60ぷんで 1じかん です。`
      : `${tt(t)}から ${tt(e)}までは ${d}${fun(d)}です。`,
    identity: `duration:${h}:${m}+${d}`,
    alt,
    task: { kind: 'elapsed', start: t, end: e, ask: 'duration', unit: alt ? 'hm' : 'min' },
    minuteNumbers: true,
    misconceptions: { base100: 'base100' },
    wrongAnswers: raw !== d && raw > 0 ? [{ minutes: raw, misconception: 'base100' }] : [],
  };
}

/** 時間の単位（1日＝24時間、1時間＝60分、午前・午後は12時間） */
function units(level: number, rng: Rng, alt: boolean): NumberItem | ChoiceItem {
  const form = rng.int(0, 2);
  if (alt) {
    // ごぜん・ごごの 時刻の あいだの 時間（何時間）
    const s = rng.int(7, 11);
    const e = rng.int(1, 6);
    const dur = 12 - s + e;
    return {
      engine: 'number',
      id: `units-alt:${s}-${e}`,
      objective: 'units',
      level,
      prompt: `ごぜん${s}じから ごご${e}じまでは なんじかん？`,
      figure: {
        kind: 'numberline',
        min: 0,
        max: 24,
        step: 6,
        minorStep: 1,
        labelEvery: 6,
        marks: [
          { at: s, tone: 'focus' },
          { at: 12 + e, tone: 'focus' },
        ],
      },
      fields: [{ label: 'じかん', answer: { kind: 'int', value: dur } }],
      hints: [
        'しょうご（ひるの 12じ）を はさんで かんがえよう。',
        `ごぜん${s}じから しょうごまで ${12 - s}じかん。`,
        `しょうごから ごご${e}じまでは ${e}じかん。あわせると？`,
      ],
      explain: `${12 - s}じかんと ${e}じかんで ${dur}じかん です。`,
      identity: `ampm-span:${s}-${e}`,
      alt: true,
      wrongAnswers: wrongList(String(dur), 1, [
        [Math.abs(s - e), 'ampm-ignore'],
        [s + e, 'ampm-ignore'],
      ]),
    };
  }
  if (form === 0) {
    // □じかん□ふん → ふん
    const H = rng.int(1, 2);
    const M = rng.int(1, 11) * 5;
    const v = H * 60 + M;
    return {
      engine: 'number',
      id: `units:hm-m:${H}:${M}`,
      objective: 'units',
      level,
      prompt: '□に あう かずは？',
      figure: { kind: 'text', text: `${H}じかん${M}${fun(M)} ＝ □ふん`, size: 'l' },
      fields: [{ label: 'ふん', answer: { kind: 'int', value: v } }],
      hints: [
        '1じかんは 60ぷん だよ。',
        `${H}じかんは ${H * 60}ぷん。`,
        `${H * 60}ぷんと ${M}${fun(M)}を あわせよう。`,
      ],
      explain: `1じかん ＝ 60ぷん なので ${H}じかん ＝ ${H * 60}ぷん。${H * 60} ＋ ${M} ＝ ${v}${fun(v)}です。`,
      identity: `hm-m:${H}:${M}`,
      alt: false,
      wrongAnswers: wrongList(String(v), 1, [
        [H * 100 + M, 'base100'],
        [H + M, 'base100'],
      ]),
    };
  }
  if (form === 1) {
    // ふん → □じかん□ふん
    const v = rng.int(13, 35) * 5;
    const H = Math.floor(v / 60);
    const M = v % 60;
    return {
      engine: 'number',
      id: `units:m-hm:${v}`,
      objective: 'units',
      level,
      prompt: '□に あう かずは？',
      figure: { kind: 'text', text: `${v}${fun(v)} ＝ □じかん□ふん`, size: 'l' },
      fields: [
        { label: 'じかん', answer: { kind: 'int', value: H } },
        { label: 'ふん', answer: { kind: 'int', value: M } },
      ],
      hints: [
        '60ぷんで 1じかん だよ。',
        `${v}${fun(v)}の なかに 60ぷんは いくつ あるかな。`,
        `${H * 60}ぷんで ${H}じかん。のこりは？`,
      ],
      explain: `${v}${fun(v)} ＝ ${H * 60}ぷん ＋ ${M}${fun(M)} ＝ ${H}じかん${M}${fun(M)}です。`,
      identity: `m-hm:${v}`,
      alt: false,
      wrongAnswers: wrongList(`${H}|${M}`, 2, [
        [v >= 100 ? `${Math.floor(v / 100)}|${v % 100}` : null, 'base100'],
        [`${Math.floor(v / 10)}|${v % 10}`, 'base100'],
      ]),
    };
  }
  // 1日・ごぜん・ごごの じかん
  const qs = [
    { id: 'day', q: '1にちは なんじかん？', a: 24, w: [[12, 'ampm-ignore']] },
    { id: 'am', q: 'ごぜんは なんじかん？', a: 12, w: [[24, 'ampm-ignore']] },
    { id: 'pm', q: 'ごごは なんじかん？', a: 12, w: [[24, 'ampm-ignore']] },
    { id: 'hour', q: '1じかんは なんぷん？', a: 60, w: [[100, 'base100']] },
    { id: 'hour2', q: '2じかんは なんぷん？', a: 120, w: [[200, 'base100']] },
    { id: 'day2', q: '2にちは なんじかん？', a: 48, w: [[24, 'ampm-ignore']] },
    { id: 'hour3', q: '3じかんは なんぷん？', a: 180, w: [[300, 'base100']] },
  ] as const;
  const q = qs[rng.int(0, qs.length - 1)]!;
  return {
    engine: 'number',
    id: `units:${q.id}`,
    objective: 'units',
    level,
    prompt: q.q,
    figure: { kind: 'clock', h: 12, m: 0 },
    fields: [{ answer: { kind: 'int', value: q.a } }],
    // 問いに あう ヒントに する（かけ算は まだ 習って いないので「たして」）
    hints: q.id.startsWith('hour')
      ? [
          'ながい はりが 1しゅう すると 1じかん。',
          '1じかんは 60ぷん だよ。',
          q.id === 'hour'
            ? 'ながい はりは 1しゅうで なんぷん すすむかな。'
            : '60ぷんを じかんの かずだけ たそう。',
        ]
      : [
          'とけいの みじかい はりは、1にちに 2かい まわるよ。',
          'ごぜんも ごごも、みじかい はりが 1しゅう する あいだ。',
          q.id === 'day2'
            ? '1にちの じかんを 2かい たそう。'
            : 'みじかい はりが 1しゅうで なんじかん かな。',
        ],
    explain: `1にち ＝ 24じかん（ごぜん 12じかん・ごご 12じかん）、1じかん ＝ 60ぷん。こたえは ${q.a}です。`,
    identity: `units:${q.id}`,
    alt: false,
    wrongAnswers: wrongList(
      String(q.a),
      1,
      q.w.map(([v, m]) => [v, m] as [number, string]),
    ),
  };
}

/** ごぜん・ごごを つけて 時刻を いう */
function ampm(level: number, rng: Rng, alt: boolean): ClockItem | ChoiceItem {
  const pm = rng.next() < 0.5;
  // 場面と 時刻が 合うように、場面ごとに ありそうな 時（1〜11）の はんいを きめる
  const scenes: [string, number, number][] = pm
    ? [
        ['おやつを たべた', 2, 4],
        ['こうえんで あそんだ', 1, 5],
        ['ゆうごはんを たべた', 6, 8],
        ['おふろに はいった', 6, 9],
      ]
    : [
        ['おきた', 5, 8],
        ['がっこうに ついた', 7, 8],
        ['あさごはんを たべた', 6, 8],
        ['じゅぎょうが はじまった', 8, 11],
      ];
  const [sc, lo, hi] = scenes[rng.int(0, 3)]!;
  const h = rng.int(lo, hi);
  const m = rng.int(0, 11) * 5;
  const H = pm ? h + 12 : h;
  if (alt) {
    // 時刻の言い方を 選ぶ
    return {
      engine: 'choice',
      id: `ampm-alt:${H}:${m}`,
      objective: 'ampm',
      level,
      prompt: `${pm ? 'ひるから あと' : 'あさ'}、この とけいの じこくに ${sc}。ただしい いいかたは どれ？`,
      figure: { kind: 'clock', h, m },
      hints: [
        'よるの 12じから ひるの 12じまでが ごぜん、ひるの 12じから よるの 12じまでが ごご。',
        pm ? 'ひるより あとの じこく だね。' : 'ひるより まえの じこく だね。',
        `${tt({ h, m })}の まえに、ごぜんか ごごを つけよう。`,
      ],
      explain: `${pm ? 'ひるより あと' : 'ひるより まえ'}なので ${pm ? 'ごご' : 'ごぜん'}${tt({ h, m })}です。`,
      identity: `ampm-say:${H}:${m}`,
      alt: true,
      options: [
        {
          label: `ごぜん${tt({ h, m })}`,
          ...(pm ? { misconception: 'ampm-ignore' } : { correct: true }),
        },
        {
          label: `ごご${tt({ h, m })}`,
          ...(pm ? { correct: true } : { misconception: 'ampm-ignore' }),
        },
        {
          label: `${pm ? 'ごご' : 'ごぜん'}${tt({ h: h === 11 ? 10 : h + 1, m })}`,
          misconception: 'hour-next',
        },
      ],
    };
  }
  return {
    engine: 'clock',
    id: `ampm:${H}:${m}`,
    objective: 'ampm',
    level,
    prompt: `${pm ? 'ごご' : 'ごぜん'}${tt({ h, m })}に はりを あわせよう。`,
    hints: [
      'ごぜんも ごごも、とけいの はりの いちは おなじ だよ。',
      `みじかい はりは ${h}の ちかく。`,
      m === 0 ? 'ながい はりは 12に。' : `ながい はりは ${m}${fun(m)}の ところ。`,
    ],
    explain: `${pm ? 'ごご' : 'ごぜん'}${tt({ h, m })}は、ながい はりが ${m}${fun(m)}、みじかい はりが ${h}${m === 0 ? '' : 'を すぎた ところ'}です。`,
    identity: `ampm:${H}:${m}`,
    alt: false,
    dayHalf: true,
    task: { kind: 'set', target: { h: H, m }, start: { h: 12, m: 0 }, step: 5 },
    minuteNumbers: true,
    misconceptions: { swapHands: 'swap-hands', hourNext: 'hour-next', hourPrev: 'hour-next' },
  };
}

export function generateTime(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'read':
      return read(level, rng, alt);
    case 'after':
      return after(level, rng, alt);
    case 'duration':
      return duration(level, rng, alt);
    case 'units':
      return units(level, rng, alt);
    case 'ampm':
      return ampm(level, rng, alt);
  }
}

export const time: UnitSpec = {
  id: 'g2.math.time',
  title: 'じこくと 時間《じかん》',
  stage: 'g2',
  subject: 'math',
  domain: 'C-measure',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-math',
  prereq: ['g1.math.clock'],
  objectives: [
    { id: 'read', title: 'なんじ なんぷん（1ぷんまで）' },
    { id: 'after', title: '〜ふんご・〜ふんまえの じこく' },
    { id: 'duration', title: 'かかった じかん' },
    { id: 'units', title: '1にち＝24じかん、1じかん＝60ぷん' },
    { id: 'ampm', title: 'ごぜんと ごご' },
  ],
  misconceptions: [
    {
      id: 'swap-hands',
      explain:
        'ながい はりと みじかい はりを とりちがえたのかな。みじかい はりが「じ」、ながい はりが「ふん」だよ。',
    },
    {
      id: 'hour-next',
      explain:
        'みじかい はりの よみかたを まちがえたのかな。みじかい はりが 2つの すうじの あいだの ときは、すぎた ほう（ちいさい ほう）を よむよ。',
    },
    {
      id: 'minute-numeral',
      explain:
        'ながい はりが さす すうじを そのまま ふんに したのかな。4の ところは 20ぷん。すうじ 1つで 5ふん だよ。',
    },
    {
      id: 'no-carry-hour',
      explain: '60ぷんで 1じかん すすむのを わすれたのかな。60ぷんに なったら「じ」が 1 ふえるよ。',
    },
    {
      id: 'no-borrow-hour',
      explain:
        'もどる ときに「じ」が 1 へるのを わすれたのかな。ちょうどの じこくを こえて もどると、じが へるよ。',
    },
    {
      id: 'direction',
      explain:
        '「まえ」と「ご（あと）」を はんたいに したのかな。まえは はりを ぎゃくに まわすよ。',
    },
    {
      id: 'base100',
      explain: '1じかんを 100ぷんと かんがえたのかな。1じかん ＝ 60ぷん だよ。',
    },
    {
      id: 'ampm-ignore',
      explain:
        'ごぜんと ごごの ちがいを わすれたのかな。ひるの 12じ（しょうご）で ごぜんと ごごが かわるよ。',
    },
  ],
  levels: [
    { label: 'じこくを よむ・〜ふんご', chance: 0.05 },
    { label: 'じかんと たんい', chance: 0.05 },
    { label: 'ごぜん・ごご', chance: 0.05 },
  ],
  intro: [
    {
      text: 'ながい はりが 1めもり すすむと 1ぷん。すうじ 1つ ぶんで 5ふん です。',
      figure: { kind: 'clock', h: 8, m: 40, minuteNumbers: true },
    },
    {
      text: '8じ40ぷんの 30ぷんごは、20ぷんで 9じ、あと 10ぷんで 9じ10ぷん。60ぷん ＝ 1じかん です。',
      figure: { kind: 'clock', h: 9, m: 10, minuteNumbers: true },
    },
    {
      text: 'ひるの 12じまでを ごぜん、ひるの 12じからを ごご と いいます。1にちは 24じかん です。',
      figure: {
        kind: 'numberline',
        min: 0,
        max: 24,
        step: 6,
        minorStep: 1,
        labelEvery: 6,
        marks: [{ at: 12, tone: 'focus' }],
      },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateTime(level, rng, index),
  },
  review: 'type',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第2学年 C(2) 時間の単位（日・時・分）とそれらの関係、時刻と時間',
  revised: '2026-10-24',
};
