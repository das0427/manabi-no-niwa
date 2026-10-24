/**
 * g1.math.numbers-120 100までの かずと 120くらいまでの かず（2けたの かずの あらわしかた）（curriculum-matrix 3.4）。
 *
 * 同一性キー（1.4）: 数と表し方の組。
 *   10の たばと ばら: 21〜100（ブロック）／ことばで、
 *   くらい: 21〜99 の じゅうの くらい・いちの くらい（数字を2つ入れる）／くらいの ひょうから かずを えらぶ、
 *   かずの せん: 20めもりの まど（0〜20 … 80〜100）の よみ／1めもり 10 の せん、
 *   100より おおきい かず: 100〜120（ブロック）・100を またぐ ならび／90〜120 の かずの せん、
 *   おおきさ: 2つの かずの くみ × おおきい・ちいさい／ブロックの え。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { NumberlineItem } from '../../engines/numberline/numberline';
import type { ChoiceItem, ChoiceOption, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { REVISED, countUpHint, expr, pickFrom } from './util';

type Obj = 'tabane' | 'kurai' | 'nl' | 'over100' | 'daishou';

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** 10の ぼうと ばら（100 以上は 100の いた） */
const ONES_KANA = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];

/** 1〜99 の読み（ひらがな）。「ひゃく15」のように数字と かなを混ぜないため（内容レビュー） */
export function kanaOf(n: number): string {
  const t = Math.floor(n / 10);
  const o = n % 10;
  const tens = t === 0 ? '' : `${t === 1 ? '' : ONES_KANA[t]}じゅう`;
  return tens + ONES_KANA[o];
}

function blk(n: number): Figure {
  if (n >= 100)
    return { kind: 'blocks', hundreds: 1, tens: Math.floor((n - 100) / 10), ones: n % 10 };
  return { kind: 'blocks', tens: Math.floor(n / 10), ones: n % 10 };
}

interface NumSpec {
  id: string;
  obj: Obj;
  level: number;
  prompt: string;
  figure?: Figure;
  alt?: boolean;
  answer: number;
  wrongs: [number | string, string][];
  hints: string[];
  explain: string;
  explainFigure?: Figure;
}

function num(s: NumSpec): NumberItem {
  const wrongAnswers: NonNullable<NumberItem['wrongAnswers']> = [];
  for (const [v, m] of s.wrongs) {
    const t = String(v);
    if (t === String(s.answer) || Number(t) < 0 || wrongAnswers.some((w) => w.value === t))
      continue;
    wrongAnswers.push({ value: t, misconception: m });
  }
  return {
    engine: 'number',
    id: s.id,
    objective: s.obj,
    level: s.level,
    prompt: s.prompt,
    figure: s.figure,
    hints: s.hints,
    explain: s.explain,
    explainFigure: s.explainFigure,
    identity: s.id,
    alt: s.alt ?? false,
    fields: [{ answer: { kind: 'int', value: s.answer } }],
    wrongAnswers,
  };
}

/** 2けたの かずの よくある誤り（407・74・11） */
function twoDigitWrongs(t: number, o: number): [number | string, string][] {
  const w: [number | string, string][] = [];
  if (o > 0) w.push([`${t}0${o}`, 'place-concat']);
  if (o > 0 && o !== t) w.push([`${o}${t}`, 'place-swap']);
  if (o === 0) w.push([t, 'zero-place']);
  w.push([t + o, 'ten-as-one']);
  return w;
}

// ---- 10の たばと ばら ----
function tabane(level: number, rng: Rng, alt: boolean): Item {
  const n = rng.int(21, 100);
  const t = Math.floor(n / 10);
  const o = n % 10;
  if (alt)
    return num({
      id: `tabane-word:${n}`,
      obj: 'tabane',
      level,
      prompt:
        o > 0
          ? `10の まとまりが ${t}こと、ばらが ${o}こ。あわせて いくつ？`
          : `10の まとまりが ${t}こ。いくつ？`,
      alt: true,
      answer: n,
      wrongs: twoDigitWrongs(t, o),
      hints: [
        '10の まとまりは じゅうの くらい、ばらは いちの くらいに なるよ。',
        `10が ${t}こで ${t * 10}。`,
        o > 0 ? `${t * 10}と ${o}で いくつ かな。` : `10、20、…と ${t}かい かぞえよう。`,
      ],
      explain:
        n === 100
          ? '10が 10こで 100。「ひゃく」と よむよ。'
          : `10が ${t}こで ${t * 10}、${t * 10}と ${o}で ${n}。じゅうの くらいが ${t}、いちの くらいが ${o}。`,
      explainFigure: blk(n),
    });
  return num({
    id: `tabane:${n}`,
    obj: 'tabane',
    level,
    prompt: 'ブロックは いくつ？',
    figure: { kind: 'blocks', tens: t, ones: o },
    answer: n,
    wrongs: twoDigitWrongs(t, o),
    hints: [
      'ながい ぼうは 10の まとまり。ぼうと ばらを わけて かぞえよう。',
      `ぼうを 10、20、…と かぞえよう。ばらは ${o}こ。`,
      o > 0
        ? `ぼうで ${t * 10}。それと ばら ${o}こで いくつ かな。`
        : 'ばらは ないね。ぼうの かずだけで いくつ かな。',
    ],
    explain:
      n === 100
        ? '10の まとまりが 10こで 100。'
        : `10の まとまりが ${t}こで ${t * 10}、ばらが ${o}こ。${n}です。`,
    explainFigure:
      n === 100
        ? blk(n)
        : {
            kind: 'table',
            header: ['じゅうの くらい', 'いちの くらい'],
            rows: [[String(t), String(o)]],
          },
  });
}

// ---- くらい ----
function kurai(level: number, rng: Rng, alt: boolean): Item {
  const n = rng.int(21, 99);
  const t = Math.floor(n / 10);
  const o = n % 10;
  const table: Figure = {
    kind: 'table',
    header: ['じゅうの くらい', 'いちの くらい'],
    rows: [[String(t), String(o)]],
  };
  if (alt) {
    const options: ChoiceOption[] = [{ label: String(n), correct: true }];
    if (o === 0) {
      options.push({ label: String(t), misconception: 'zero-place' });
      options.push({ label: `${t}00`, misconception: 'place-concat' });
    } else {
      options.push({ label: `${t}0${o}`, misconception: 'place-concat' });
      options.push(
        o !== t
          ? { label: `${o}${t}`, misconception: 'place-swap' }
          : { label: String(t + o), misconception: 'ten-as-one' },
      );
    }
    const it: ChoiceItem = {
      engine: 'choice',
      id: `kurai-choice:${n}`,
      objective: 'kurai',
      level,
      prompt: 'ひょうの かずは どれ？',
      figure: table,
      hints: [
        'じゅうの くらいは 10の まとまりの かず、いちの くらいは ばらの かず。',
        `10の まとまりが ${t}こで ${t * 10}。`,
        o > 0
          ? `${t * 10}と ${o}を あわせた かずを さがそう。`
          : 'ばらが 0この ときは、いちの くらいに 0を かくよ。',
      ],
      explain: `じゅうの くらいが ${t}、いちの くらいが ${o}で ${n}。すうじは 2つ ならべて かくよ。`,
      explainFigure: blk(n),
      identity: `kurai-choice:${n}`,
      alt: true,
      options,
    };
    return it;
  }
  const wrongAnswers: NumberItem['wrongAnswers'] =
    o !== t ? [{ value: `${o}|${t}`, misconception: 'place-swap' }] : [];
  return {
    engine: 'number',
    id: `kurai:${n}`,
    objective: 'kurai',
    level,
    prompt: `${n}の じゅうの くらいと いちの くらいの すうじは？`,
    figure: { kind: 'column', items: [expr(String(n)), blk(n)] },
    hints: [
      'ひだりの すうじが じゅうの くらい、みぎの すうじが いちの くらい だよ。',
      `ブロックで みると、10の ぼうが ${t}ほん あるね。`,
      'ばらの ブロックは いくつ かな。',
    ],
    explain: `${n}は 10の まとまりが ${t}こと ばらが ${o}こ。じゅうの くらいは ${t}、いちの くらいは ${o}。`,
    explainFigure: table,
    identity: `kurai:${n}`,
    alt: false,
    fields: [
      { label: 'じゅうの くらい', answer: { kind: 'int', value: t } },
      { label: 'いちの くらい', answer: { kind: 'int', value: o } },
    ],
    wrongAnswers,
  };
}

// ---- かずの せん ----
function nl(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const n = pickFrom(rng, [10, 20, 30, 40, 60, 70, 80, 90]);
    const it: NumberlineItem = {
      engine: 'numberline',
      id: `nl10:${n}`,
      objective: 'nl',
      level,
      prompt: '1めもりが 10の かずの せん。↓の ところの かずは いくつ？',
      hints: [
        '0と 50の あいだに めもりが いくつ あるか みよう。',
        '1めもり すすむと 10 ふえるよ。10、20、30、…',
        n < 50 ? '0から 10ずつ かぞえて いこう。' : '50から 10ずつ かぞえて いこう。',
      ],
      explain: `1めもりは 10。${n < 50 ? 0 : 50}から ${(n % 50) / 10}めもりで ${n}。`,
      identity: `nl10:${n}`,
      alt: true,
      line: { min: 0, max: 100, minor: 10, majorEvery: 5, labels: [0, 50, 100] },
      task: { kind: 'read', at: n },
      misconceptions: { minorAsOne: 'minor-as-one', neighborTick: 'tick-slip' },
    };
    return it;
  }
  const k = rng.int(0, 8);
  const min = k * 10;
  const j = pickFrom(rng, [...range(1, 9), ...range(11, 19)]);
  const n = min + j;
  const base = n - (n % 10);
  const t = Math.floor(n / 10);
  const o = n % 10;
  const it: NumberlineItem = {
    engine: 'numberline',
    id: `nl:${min}:${n}`,
    objective: 'nl',
    level,
    prompt: '↓の ところの かずは いくつ？',
    hints: [
      'すうじの かいて ある めもりを みよう。1めもりは 1 だよ。',
      o <= 5
        ? `${base}の めもりから かぞえよう。`
        : `${base}と ${base + 10}の まんなかは ${base + 5}。そこから かぞえよう。`,
      countUpHint(o <= 5 ? base : base + 5, n),
    ],
    explain: `${base}から みぎへ ${o}めもりで ${n}。`,
    identity: `nl:${min}:${n}`,
    alt: false,
    line: {
      min,
      max: min + 20,
      minor: 1,
      midEvery: 5,
      majorEvery: 10,
      labels: [min, min + 10, min + 20],
    },
    task: { kind: 'read', at: n },
    misconceptions: { neighborTick: 'tick-slip' },
    wrongAnswers:
      o > 0 && o !== t && t > 0 ? [{ value: o * 10 + t, misconception: 'place-swap' }] : [],
  };
  return it;
}

// ---- 100より おおきい かず ----
function over100(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const n = pickFrom(
      rng,
      range(91, 119).filter((x) => x % 10 !== 0),
    );
    const base = n - (n % 10);
    const it: NumberlineItem = {
      engine: 'numberline',
      id: `over-nl:${n}`,
      objective: 'over100',
      level,
      prompt: '↓の ところの かずは いくつ？',
      hints: [
        '90・100・110・120 の めもりに すうじが かいて あるよ。',
        `${base}の めもりを さがそう。`,
        countUpHint(n % 10 <= 5 ? base : base + 5, n),
      ],
      explain: `${base}から みぎへ ${n % 10}めもりで ${n}。${n > 100 ? `${n}は 100と ${n - 100}。` : ''}`,
      identity: `over-nl:${n}`,
      alt: true,
      line: {
        min: 90,
        max: 120,
        minor: 1,
        midEvery: 5,
        majorEvery: 10,
        labels: [90, 100, 110, 120],
      },
      task: { kind: 'read', at: n },
      misconceptions: { neighborTick: 'tick-slip' },
      wrongAnswers:
        n > 100 ? [{ value: Number(`100${n - 100}`), misconception: 'place-concat' }] : [],
    };
    return it;
  }
  if (rng.next() < 0.5) {
    const n = rng.int(100, 120);
    const r = n - 100;
    return num({
      id: `over:${n}`,
      obj: 'over100',
      level,
      prompt: 'ブロックは いくつ？',
      figure: blk(n),
      answer: n,
      wrongs: [
        [`100${r}`, 'place-concat'],
        [r, 'ignore-hundred'],
        [n - 1, 'count-slip'],
        [n + 1, 'count-slip'],
      ],
      hints: [
        'おおきな いたは 10の まとまりが 10こで 100 だよ。',
        r >= 10 ? `100と、10の ぼうが 1ぽん、ばらが ${r - 10}こ。` : `100と、ばらが ${r}こ。`,
        r > 0 ? `100から のこりの ぶんを かぞえて いこう。` : 'いたの ほかに ブロックは あるかな。',
      ],
      explain:
        r === 0
          ? '10の まとまりが 10こで 100。「ひゃく」と よむよ。'
          : `100と ${r}で ${n}。「ひゃく${kanaOf(r)}」と よむよ。`,
      explainFigure: blk(n),
    });
  }
  const s = rng.int(96, 117);
  const pos = rng.int(0, 3);
  const arr = [0, 1, 2, 3].map((i) => s + i);
  const ans = arr[pos]!;
  const shown = arr.filter((_, i) => i !== pos);
  const wrongs: [number | string, string][] = [ans - 1, ans + 1].map((w) => [
    w,
    shown.includes(w) ? 'seq-copy' : 'count-slip',
  ]);
  if (ans > 100) wrongs.push([`100${ans - 100}`, 'place-concat']);
  if (ans === 100) wrongs.push(['910', 'place-concat']);
  return num({
    id: `over-seq:${s}:${pos}`,
    obj: 'over100',
    level,
    prompt: 'あいて いる ところに はいる かずは いくつ？',
    figure: expr(arr.map((v, i) => (i === pos ? '{{}}' : String(v))).join('、')),
    answer: ans,
    wrongs,
    hints: [
      'となりどうしの かずを くらべよう。',
      // 答えが 100 のとき「99の つぎは 100」と書くと答えになるので、数を出さずに くりあがりの ことだけ言う
      s <= 99 && s + 3 >= 100
        ? '1ずつ ふえて いるね。9の つぎは 10 で、くらいが ひとつ あがる ことを おもいだそう。'
        : '1ずつ ふえて いるね。',
      pos > 0 ? `${arr[pos - 1]}に 1 たすと？` : `${arr[1]}から 1 へらすと？`,
    ],
    explain: `${arr.join('、')}。1ずつ ふえる ならびなので ${ans}。`,
    explainFigure: blk(ans),
  });
}

// ---- おおきさ ----
function daishou(level: number, rng: Rng, alt: boolean): Item {
  // くらべかた: A じゅうの くらいが ちがい、いちの くらいは ぎゃく ／ B じゅうの くらいが おなじ ／ C 100より おおきい かずと 90だい
  const kind = alt ? pickFrom(rng, ['A', 'B'] as const) : pickFrom(rng, ['A', 'B', 'C'] as const);
  let lo: number;
  let hi: number;
  if (kind === 'A') {
    const [t1, t2] = (rng.sample(range(1, 9), 2) as number[]).sort((a, b) => a - b) as [
      number,
      number,
    ];
    const [o2, o1] = (rng.sample(range(0, 9), 2) as number[]).sort((a, b) => a - b) as [
      number,
      number,
    ];
    lo = t1 * 10 + o1;
    hi = t2 * 10 + o2;
  } else if (kind === 'B') {
    const t = rng.int(1, 9);
    const [o1, o2] = (rng.sample(range(0, 9), 2) as number[]).sort((a, b) => a - b) as [
      number,
      number,
    ];
    lo = t * 10 + o1;
    hi = t * 10 + o2;
  } else {
    lo = rng.int(90, 99);
    hi = rng.int(100, 120);
  }
  const big = rng.next() < 0.5;
  const ans = big ? hi : lo;
  const other = big ? lo : hi;
  const mis = kind === 'A' ? 'compare-ones' : kind === 'C' ? 'digits-count' : 'bigger-smaller';
  const hints = [
    kind === 'C'
      ? '100より おおきい かずか どうかを みよう。'
      : 'さきに じゅうの くらいを くらべよう。',
    kind === 'B'
      ? 'じゅうの くらいが おなじ ときは、いちの くらいを くらべよう。'
      : kind === 'A'
        ? `じゅうの くらいは ${Math.floor(lo / 10)}と ${Math.floor(hi / 10)}。`
        : `${lo}は 100より ちいさい かず だね。`,
    big
      ? 'じゅうの くらいが おおきい ほうが おおきい かずだよ。どっちかな。'
      : 'じゅうの くらいが ちいさい ほうが ちいさい かずだよ。どっちかな。',
  ];
  if (kind === 'B')
    hints[2] = big
      ? 'いちの くらいが おおきい ほうは どっちかな。'
      : 'いちの くらいが ちいさい ほうは どっちかな。';
  if (kind === 'C') hints[2] = 'かずの せんで 100より みぎに ある ほうが おおきいよ。';
  const prompt = big ? 'おおきい ほうは どっち？' : 'ちいさい ほうは どっち？';
  const why =
    kind === 'A'
      ? 'じゅうの くらいで くらべるよ。'
      : kind === 'B'
        ? 'じゅうの くらいが おなじなので いちの くらいで くらべるよ。'
        : '100より おおきい かずは 99より おおきいよ。';
  // 問いが「ちいさい ほう」のときは、大きい側の説明に もう一手（だから ちいさい ほうは lo）を足す
  const explain = `${hi}の ほうが ${lo}より おおきい。${why}${big ? '' : `だから ちいさい ほうは ${lo} です。`}`;
  const key = `${big ? 'max' : 'min'}:${lo}-${hi}`;
  if (alt)
    return {
      engine: 'choice',
      id: `cmp-blk:${key}`,
      objective: 'daishou',
      level,
      prompt: big ? 'おおきい かずの ほうは どっち？' : 'ちいさい かずの ほうは どっち？',
      hints: [
        '10の ぼうの かずを さきに くらべよう。',
        hints[1]!,
        kind === 'B'
          ? 'ぼうが おなじ ときは ばらを くらべよう。'
          : 'ばらの かずより ぼうの かずが だいじ だよ。',
      ],
      explain,
      explainFigure: {
        kind: 'numberline',
        min: Math.floor(lo / 10) * 10,
        max: Math.ceil((hi + 1) / 10) * 10,
        step: 1,
        labelEvery: 10,
        marks: [
          { at: lo, tone: 'muted' },
          { at: hi, tone: 'focus' },
        ],
      },
      identity: `cmp-blk:${key}`,
      alt: true,
      options: [
        { figure: blk(ans), correct: true },
        { figure: blk(other), misconception: mis },
      ],
      layout: 'column',
    };
  return {
    engine: 'choice',
    id: `cmp:${key}`,
    objective: 'daishou',
    level,
    prompt,
    hints,
    explain,
    identity: `cmp:${key}`,
    alt: false,
    options: [
      { label: String(ans), correct: true },
      { label: String(other), misconception: mis },
    ],
  };
}

const GEN: Record<Obj, (level: number, rng: Rng, alt: boolean) => Item> = {
  tabane,
  kurai,
  nl,
  over100,
  daishou,
};

const LEVELS: Obj[][] = [
  ['tabane', 'kurai'],
  ['nl', 'daishou'],
  ['over100', 'tabane', 'kurai', 'nl', 'daishou'],
];

export function generateNumbers120(level: number, rng: Rng, index: number): Item {
  const objs = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = objs[(index + rng.int(0, objs.length - 1)) % objs.length]!;
  const alt = rng.next() < 0.25;
  return GEN[obj](level, rng, alt);
}

export const numbers120: UnitSpec = {
  id: 'g1.math.numbers-120',
  title: '100までの かず・120くらいまでの かず',
  stage: 'g1',
  subject: 'math',
  domain: 'A-number',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-sansu',
  prereq: ['g1.math.numbers-20'],
  objectives: [
    { id: 'tabane', title: '10の まとまりと ばら' },
    { id: 'kurai', title: 'じゅうの くらい・いちの くらい' },
    { id: 'nl', title: 'かずの せんを よむ' },
    { id: 'over100', title: '100より おおきい かず（120くらいまで）' },
    { id: 'daishou', title: 'かずの おおきさ' },
  ],
  misconceptions: [
    {
      id: 'place-concat',
      explain:
        '「40と 7」を そのまま ならべて 407と かいたのかな。じゅうの くらいに 4、いちの くらいに 7を かいて 47 だよ。',
      figure: { kind: 'table', header: ['じゅうの くらい', 'いちの くらい'], rows: [['4', '7']] },
    },
    {
      id: 'place-swap',
      explain:
        'じゅうの くらいと いちの くらいを ぎゃくに したのかな。10の まとまりの かずを ひだりに かくよ。',
    },
    {
      id: 'ten-as-one',
      explain:
        '10の まとまりを 1こと かぞえたのかな。ぼう 1ぽんは 10 だよ。10、20、30 と かぞえよう。',
      figure: { kind: 'blocks', tens: 1, ones: 0 },
    },
    {
      id: 'zero-place',
      explain: 'ばらが ない ときも、いちの くらいに 0を かくよ。10の まとまり 3こは 30。',
    },
    {
      id: 'tick-slip',
      explain: 'めもりを 1つ かぞえまちがえたのかな。すうじの ある めもりから 1つずつ かぞえよう。',
    },
    {
      id: 'minor-as-one',
      explain: '1めもりを 1と かぞえたのかな。この かずの せんは 1めもりで 10 ふえるよ。',
    },
    {
      id: 'ignore-hundred',
      explain: '100の まとまりを わすれたのかな。おおきな いたは 100 だよ。',
    },
    {
      id: 'count-slip',
      explain: '1つ とばしたり、2かい かぞえたり したのかな。1つずつ たしかめよう。',
    },
    {
      id: 'seq-copy',
      explain: 'となりの かずを そのまま かいたのかな。1ずつ ふえる ことを たしかめよう。',
    },
    {
      id: 'compare-ones',
      explain: 'いちの くらいで くらべたのかな。さきに じゅうの くらいを くらべよう。',
    },
    {
      id: 'bigger-smaller',
      explain: '「おおきい」と「ちいさい」を とりちがえたのかな。もう いちど もんだいを よもう。',
    },
    {
      id: 'digits-count',
      explain:
        'すうじの おおきさだけで くらべたのかな。100より おおきい かずは、99より おおきいよ。',
    },
  ],
  levels: [
    { label: '10の まとまりと くらい', chance: 0.05 },
    { label: 'かずの せん・おおきさ', chance: 0.1 },
    { label: '120くらいまで・まとめ', chance: 0.05 },
  ],
  intro: [
    {
      text: 'えんぴつを 10ぽん あつめて 1つの たばに します。たばが 4つと ばらが 7ほん あると…',
      figure: { kind: 'illust', id: 'pencil', count: 10 },
    },
    {
      text: 'ブロックで あらわすと、10の ぼうが 4ほんと ばらが 7こ。ひょうに かくと じゅうの くらいが 4、いちの くらいが 7。',
      figure: {
        kind: 'column',
        items: [
          { kind: 'blocks', tens: 4, ones: 7 },
          { kind: 'table', header: ['じゅうの くらい', 'いちの くらい'], rows: [['4', '7']] },
        ],
      },
    },
    {
      text: 'すうじで 47と かき、「よんじゅうなな」と よみます。10が 10こで 100。100と 5で 105。',
      figure: expr('47　　100　　105'),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateNumbers120(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第1学年 A(1) 数の構成と表し方（2位数の表し方、簡単な場合の3位数の表し方。解説: 120程度まで）',
  revised: REVISED,
};
