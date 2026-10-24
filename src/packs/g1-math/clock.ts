/**
 * g1.math.clock とけい（時刻を読む）（curriculum-matrix 3.4）。
 *
 * 時刻の範囲の判断: 調査メモ（research/elementary-japanese-math.md 121行・218行）では、1年の「何時半」「何時何分」の
 * 範囲を確認できていない（解説Cは短針・長針の役割と「何時、何分」に触れる）。そこで段階を分ける:
 *   段階0 なんじ → 段階1 なんじはん（くらしの場面）→ 段階2 なんじなんぷん（5ふんきざみ。発展の段階）。
 *
 * 同一性キー: 問い方（読む・選ぶ・入れる・合わせる）＋時刻。場面の問題は 場面＋問い方（数値は場面で決まる）。
 */
import type { Rng } from '../../core/util/rng';
import type { ClockItem, ClockTime } from '../../engines/clock/clock';
import type { Item, UnitSpec } from '../../curriculum/types';
import { REVISED } from './util';

type Obj = 'nanji' | 'han' | 'awaseru' | 'bamen' | 'nanpun';

const MIS = {
  swapHands: 'mis-swap-hands',
  hourNext: 'mis-hour-next',
  hourPrev: 'mis-hour-prev',
  minuteNumeral: 'mis-minute-numeral',
} as const;

/** 1〜12 に直す */
const h12 = (h: number) => ((((h - 1) % 12) + 12) % 12) + 1;
const fun = (m: number) => ([0, 1, 3, 4, 6, 8].includes(m % 10) ? 'ぷん' : 'ふん');
const say = (t: ClockTime, half = true) =>
  t.m === 0 ? `${t.h}じ` : t.m === 30 && half ? `${t.h}じはん` : `${t.h}じ${t.m}${fun(t.m)}`;
const key = (t: ClockTime) => `${t.h}:${String(t.m).padStart(2, '0')}`;
const dial = (t: ClockTime) => ((t.h % 12) * 60 + t.m) % 720;

interface Scene {
  id: string;
  time: ClockTime;
  /** 読む問題の文 */
  read: string;
  /** 合わせる問題の文 */
  set: string;
}

/** くらしの場面（数値は場面で決まる。何時・何時半だけ） */
const SCENES: Scene[] = [
  {
    id: 'okiru',
    time: { h: 6, m: 30 },
    read: 'あさ おきた じかんです。',
    set: 'あさ おきる じかんは',
  },
  {
    id: 'asagohan',
    time: { h: 7, m: 0 },
    read: 'あさごはんを たべはじめた じかんです。',
    set: 'あさごはんは',
  },
  {
    id: 'gakkou',
    time: { h: 8, m: 0 },
    read: 'がっこうに ついた じかんです。',
    set: 'がっこうに つくのは',
  },
  {
    id: 'kyuushoku',
    time: { h: 12, m: 30 },
    read: 'きゅうしょくの じかんです。',
    set: 'きゅうしょくは',
  },
  {
    id: 'kaeru',
    time: { h: 3, m: 0 },
    read: 'いえに かえった じかんです。',
    set: 'いえに かえるのは',
  },
  { id: 'oyatsu', time: { h: 3, m: 30 }, read: 'おやつを たべた じかんです。', set: 'おやつは' },
  {
    id: 'kouen',
    time: { h: 4, m: 0 },
    read: 'こうえんで あそびはじめた じかんです。',
    set: 'こうえんに いくのは',
  },
  {
    id: 'piano',
    time: { h: 5, m: 30 },
    read: 'ピアノの れんしゅうを はじめた じかんです。',
    set: 'ピアノの れんしゅうは',
  },
  { id: 'furo', time: { h: 6, m: 0 }, read: 'おふろに はいった じかんです。', set: 'おふろは' },
  {
    id: 'yuugohan',
    time: { h: 7, m: 30 },
    read: 'ゆうごはんを たべはじめた じかんです。',
    set: 'ゆうごはんは',
  },
  {
    id: 'ehon',
    time: { h: 8, m: 30 },
    read: 'えほんを よんで もらった じかんです。',
    set: 'えほんを よむのは',
  },
  { id: 'neru', time: { h: 9, m: 0 }, read: 'ねた じかんです。', set: 'ねるのは' },
];

/** 選ぶ問題の誤りの時刻（エンジンが誤概念を推定できるものを選ぶ） */
function wrongTimes(t: ClockTime): ClockTime[] {
  const out: ClockTime[] = [];
  const add = (c: ClockTime) => {
    if (dial(c) !== dial(t) && !out.some((o) => dial(o) === dial(c))) out.push(c);
  };
  if (t.m === 0) {
    add({ h: h12(t.h + 1), m: 0 });
    add({ h: h12(t.h - 1), m: 0 });
    add({ h: 12, m: (t.h % 12) * 5 }); // 長い針と短い針の取り違え
  } else if (t.m === 30) {
    add({ h: h12(t.h + 1), m: 30 }); // 短い針の近い数字（次の数字）を読む
    add({ h: t.h, m: 0 }); // 長い針を見ない
    add({ h: h12(t.h - 1), m: 30 });
  } else {
    if (t.m >= 10) add({ h: t.h, m: t.m / 5 }); // 長い針の数字をそのまま分
    add({ h: h12(t.m >= 30 ? t.h + 1 : t.h - 1), m: t.m });
    add({ h: h12(t.m / 5), m: (t.h % 12) * 5 }); // 取り違え
    add({ h: h12(t.m >= 30 ? t.h - 1 : t.h + 1), m: t.m });
  }
  return out.slice(0, 3);
}

function hints(t: ClockTime): string[] {
  if (t.m === 0)
    return [
      'みじかい はりと ながい はりを みよう。',
      'ながい はりが 12を さして いる ときは 「なんじ ちょうど」だよ。',
      'みじかい はりは どの すうじを さして いるかな。',
    ];
  if (t.m === 30)
    return [
      'ながい はりを みよう。6を さして いるね。',
      'ながい はりが 6の ときは 「はん」だよ。みじかい はりは すうじと すうじの あいだに あるよ。',
      `みじかい はりは ${t.h}と ${h12(t.h + 1)}の あいだ。とおりすぎた ほうの すうじが 「なんじ」だよ。`,
    ];
  return [
    'みじかい はりで 「なんじ」、ながい はりで 「なんぷん」を よもう。',
    'ながい はりが すうじ 1つ すすむと 5ふん だよ。',
    `ながい はりは ${t.m / 5}の ところ。5、10、15、… と かぞえよう。`,
  ];
}

function explain(t: ClockTime): string {
  if (t.m === 0) return `みじかい はりが ${t.h}、ながい はりが 12で ${t.h}じ だよ。`;
  if (t.m === 30)
    return `みじかい はりが ${t.h}と ${h12(t.h + 1)}の あいだ、ながい はりが 6で ${t.h}じはん だよ。`;
  return `みじかい はりは ${t.h}を すぎた ところ、ながい はりは ${t.m / 5}で ${t.m}${fun(t.m)}。${say(t)} だよ。`;
}

function base(
  obj: Obj,
  level: number,
  id: string,
  t: ClockTime,
  alt: boolean,
): Omit<ClockItem, 'prompt' | 'task'> {
  return {
    engine: 'clock',
    id,
    objective: obj,
    level,
    hints: hints(t),
    explain: explain(t),
    identity: id,
    alt,
    misconceptions: { ...MIS },
    wrongAnswers:
      t.m === 30 ? [{ time: { h: t.h, m: 0 }, misconception: 'mis-ignore-minute' }] : undefined,
    minuteNumbers: t.m % 30 !== 0 ? true : undefined,
  };
}

function readChoice(obj: Obj, level: number, t: ClockTime, prompt: string, id: string): ClockItem {
  return {
    ...base(obj, level, id, t, false),
    prompt,
    task: {
      kind: 'read',
      time: t,
      answerBy: 'choice',
      options: [t, ...wrongTimes(t)],
      halfWord: true,
    },
  };
}

function setItem(
  obj: Obj,
  level: number,
  t: ClockTime,
  prompt: string,
  id: string,
  alt: boolean,
): ClockItem {
  const step = t.m === 0 ? 60 : t.m === 30 ? 30 : 5;
  const start = dial(t) === 0 ? { h: 6, m: 0 } : { h: 12, m: 0 };
  return {
    ...base(obj, level, id, t, alt),
    prompt,
    hints:
      t.m === 0
        ? [
            'ながい はりと みじかい はりの どちらを うごかすか かんがえよう。',
            'ちょうどの ときは ながい はりを 12に するよ。',
            `ながい はりを 12に したら、みじかい はりは どの すうじに すれば よいかな。`,
          ]
        : t.m === 30
          ? [
              'さきに ながい はりの ばしょを きめよう。',
              '「はん」は ながい はりが 6の ところだよ。',
              `ながい はりを 6に すると、みじかい はりは ${t.h}と ${h12(t.h + 1)}の あいだに うごくよ。`,
            ]
          : [
              'さきに ながい はりで 「なんぷん」を あわせよう。',
              'ながい はりは すうじ 1つで 5ふん すすむよ。',
              `${t.m}${fun(t.m)}は 5が ${t.m / 5}つ ぶん。ながい はりを すうじ いくつに すれば よいかな。`,
            ],
    task: { kind: 'set', target: t, start, step },
  };
}

function handsText(t: ClockTime): string {
  if (t.m === 0) return `ながい はりを 12に、みじかい はりを ${t.h}に しよう。`;
  return `ながい はりを ${t.m / 5}に、みじかい はりを ${t.h}と ${h12(t.h + 1)}の あいだに しよう。`;
}

function randomTime(rng: Rng, kind: 'hour' | 'half' | 'five'): ClockTime {
  const h = rng.int(1, 12);
  if (kind === 'hour') return { h, m: 0 };
  if (kind === 'half') return { h, m: 30 };
  // 5ふんきざみ（ちょうど・はん を除く 10通り）
  const ms = [5, 10, 15, 20, 25, 35, 40, 45, 50, 55];
  return { h, m: ms[rng.int(0, ms.length - 1)]! };
}

const LEVELS: { objs: Obj[]; kind: 'hour' | 'half' | 'five' }[] = [
  { objs: ['nanji', 'awaseru'], kind: 'hour' },
  { objs: ['han', 'awaseru', 'bamen', 'nanji'], kind: 'half' },
  { objs: ['nanpun', 'nanpun', 'awaseru', 'bamen'], kind: 'five' },
];

export function generateClock(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = lv.objs[(index + rng.int(0, lv.objs.length - 1)) % lv.objs.length]!;
  // 段階0は定義域が小さい（48通り）ので、別例を半分にして偏りを抑える
  const alt = rng.next() < (level === 0 ? 0.5 : 0.3);
  switch (obj) {
    case 'nanji': {
      const t = randomTime(rng, 'hour');
      if (!alt) return readChoice('nanji', level, t, 'この とけいは なんじ？', `read:${key(t)}`);
      return {
        ...base('nanji', level, `input:${key(t)}`, t, true),
        prompt: 'なんじ ですか。すうじで こたえよう。',
        task: { kind: 'read', time: t, answerBy: 'input', hourOnly: true },
      };
    }
    case 'han': {
      const t = randomTime(rng, 'half');
      if (!alt) return readChoice('han', level, t, 'この とけいは なんじはん？', `read:${key(t)}`);
      return {
        ...base('han', level, `pick:${key(t)}`, t, true),
        prompt: `${say(t)}の とけいは どれ？`,
        task: { kind: 'pick', time: t, options: [t, ...wrongTimes(t)] },
      };
    }
    case 'awaseru': {
      const t = randomTime(rng, lv.kind === 'five' && rng.next() < 0.3 ? 'half' : lv.kind);
      return alt
        ? setItem('awaseru', level, t, handsText(t), `set-hands:${key(t)}`, true)
        : setItem('awaseru', level, t, `${say(t)}に はりを あわせよう。`, `set:${key(t)}`, false);
    }
    case 'bamen': {
      const sc = SCENES[rng.int(0, SCENES.length - 1)]!;
      if (!alt)
        return readChoice(
          'bamen',
          level,
          sc.time,
          `${sc.read}なんじ ですか。`,
          `bamen-read:${sc.id}`,
        );
      return setItem(
        'bamen',
        level,
        sc.time,
        `${sc.set} ${say(sc.time)}。とけいの はりを あわせよう。`,
        `bamen-set:${sc.id}`,
        true,
      );
    }
    case 'nanpun': {
      const t = randomTime(rng, 'five');
      if (!alt)
        return readChoice('nanpun', level, t, 'この とけいは なんじ なんぷん？', `read:${key(t)}`);
      return {
        ...base('nanpun', level, `input:${key(t)}`, t, true),
        prompt: 'なんじ なんぷん ですか。すうじで こたえよう。',
        task: { kind: 'read', time: t, answerBy: 'input' },
      };
    }
  }
}

export const clock: UnitSpec = {
  id: 'g1.math.clock',
  title: 'とけい（なんじ・なんじはん）',
  stage: 'g1',
  subject: 'math',
  domain: 'C-measure',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'g1m-clock',
  prereq: ['p5.math.clock'],
  objectives: [
    { id: 'nanji', title: 'なんじを よむ' },
    { id: 'han', title: 'なんじはんを よむ' },
    { id: 'awaseru', title: 'はりを あわせる' },
    { id: 'bamen', title: 'くらしの なかの じこく' },
    { id: 'nanpun', title: 'なんじ なんぷん（5ふんきざみ）' },
  ],
  misconceptions: [
    {
      id: 'mis-swap-hands',
      explain:
        'ながい はりと みじかい はりを とりちがえたのかな。みじかい はりで 「なんじ」、ながい はりで 「なんぷん」を よむよ。',
      figure: { kind: 'clock', h: 3, m: 0 },
    },
    {
      id: 'mis-hour-next',
      explain:
        'みじかい はりが つぎの すうじに ちかいので、つぎの じかんと かんがえたのかな。みじかい はりが まだ とどいて いない すうじは よまないよ。とおりすぎた ほうの すうじを よもう。',
      figure: { kind: 'clock', h: 7, m: 30 },
    },
    {
      id: 'mis-hour-prev',
      explain:
        'ひとつ まえの すうじを よんだのかな。みじかい はりが さして いる すうじ（または とおりすぎた すうじ）を よもう。',
    },
    {
      id: 'mis-minute-numeral',
      explain:
        'ながい はりの すうじを そのまま 「ふん」に したのかな。ながい はりは すうじ 1つで 5ふん。4なら 20ぷん だよ。',
      figure: { kind: 'clock', h: 3, m: 20, minuteNumbers: true },
    },
    {
      id: 'mis-ignore-minute',
      explain: 'ながい はりを みなかったのかな。ながい はりが 6の ときは 「はん」だよ。',
      figure: { kind: 'clock', h: 7, m: 30 },
    },
  ],
  levels: [
    { label: 'なんじ', chance: 0.05 },
    { label: 'なんじはん・くらしの じこく', chance: 0.05 },
    { label: 'なんじ なんぷん（5ふんきざみ。はってん）', chance: 0.05 },
  ],
  intro: [
    {
      text: 'とけいには みじかい はりと ながい はりが あります。みじかい はりは 「なんじ」を、ながい はりは 「なんぷん」を おしえて くれます。',
      figure: { kind: 'clock', h: 3, m: 0 },
    },
    {
      text: 'ながい はりが 12、みじかい はりが 3を さして いると 3じ です。',
      figure: { kind: 'clock', h: 3, m: 0 },
    },
    {
      text: 'ながい はりが 6を さすと 「はん」。みじかい はりは 7と 8の あいだで、7じはん です。',
      figure: { kind: 'clock', h: 7, m: 30 },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateClock(level, rng, index),
  },
  review: 'type',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第1学年 C 時刻の読み（何時・何時半。何時何分は範囲が未確認のため発展の段階に分けた）',
  revised: REVISED,
};
