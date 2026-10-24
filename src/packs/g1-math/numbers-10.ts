/**
 * g1.math.numbers-10 10までの かず（数える・数字・大小・順序・0）（curriculum-matrix 3.4）。
 *
 * 同一性キー: 絵柄は学習内容でないので、数が同じなら同じ問題（1.4）。表し方が違う問題（絵・ブロック・数直線）は別。
 *   かぞえる 1〜10（絵／10のわく）、すうじ 1〜10（絵を選ぶ／数直線を読む）、
 *   おおきさ 0〜10 の3つの数の組 × 最大・最小（数字）／2つの絵の組（絵）、
 *   じゅんばん 4つの数の並び（ふえる・へる × 空欄の位置）・つぎ・まえ／数直線に置く、
 *   0 わく・まえ・のこり／数直線・最小。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { NumberlineItem } from '../../engines/numberline/numberline';
import type { ChoiceItem, ChoiceOption, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { REVISED, expr, pickFrom } from './util';

type Obj = 'kazoeru' | 'suuji' | 'daishou' | 'junban' | 'zero';

const THINGS = [
  { id: 'apple', name: 'りんご' },
  { id: 'mikan', name: 'みかん' },
  { id: 'strawberry', name: 'いちご' },
  { id: 'peach', name: 'もも' },
  { id: 'banana', name: 'バナナ' },
  { id: 'dog', name: 'いぬ' },
  { id: 'cat', name: 'ねこ' },
  { id: 'rabbit', name: 'うさぎ' },
  { id: 'chick', name: 'ひよこ' },
  { id: 'frog', name: 'かえる' },
  { id: 'turtle', name: 'かめ' },
] as const;
const FRUITS = THINGS.slice(0, 5);

const LINE10 = { min: 0, max: 10, minor: 1, majorEvery: 5 } as const;

interface NumSpec {
  id: string;
  obj: Obj;
  level: number;
  prompt: string;
  figure?: Figure;
  alt?: boolean;
  answer: number;
  wrongs: [number, string][];
  hints: string[];
  explain: string;
  explainFigure?: Figure;
  identity: string;
}

function num(s: NumSpec): NumberItem {
  const wrongAnswers: NonNullable<NumberItem['wrongAnswers']> = [];
  for (const [v, m] of s.wrongs) {
    if (v === s.answer || v < 0 || wrongAnswers.some((w) => w.value === String(v))) continue;
    wrongAnswers.push({ value: String(v), misconception: m });
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
    identity: s.identity,
    alt: s.alt ?? false,
    fields: [{ answer: { kind: 'int', value: s.answer } }],
    wrongAnswers,
  };
}

function nlRead(
  id: string,
  obj: Obj,
  level: number,
  at: number,
  labels: number[],
  hints: string[],
  explain: string,
): NumberlineItem {
  return {
    engine: 'numberline',
    id,
    objective: obj,
    level,
    prompt: '↓の ところの かずは いくつ？',
    hints,
    explain,
    identity: id,
    alt: true,
    line: { ...LINE10, labels },
    task: { kind: 'read', at },
    misconceptions: { neighborTick: 'count-slip' },
  };
}

function nlPlace(
  id: string,
  obj: Obj,
  level: number,
  target: number,
  labels: number[],
  hints: string[],
  explain: string,
): NumberlineItem {
  return {
    engine: 'numberline',
    id,
    objective: obj,
    level,
    prompt: `${target}の ところを タップしよう。`,
    hints,
    explain,
    identity: id,
    alt: true,
    line: { ...LINE10, labels },
    task: { kind: 'place', target },
    misconceptions: { neighborTick: 'count-slip' },
  };
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// ---- かぞえる ----
function kazoeru(level: number, rng: Rng, alt: boolean): Item {
  const n = rng.int(1, 10);
  const t = pickFrom(rng, THINGS);
  const lastHint =
    n >= 2 ? `1、2、…と かぞえて、${n - 1}の つぎは…` : 'ひとつ だけ かな、ふたつ かな。';
  if (alt)
    return num({
      id: `kazoeru-frame:${n}`,
      obj: 'kazoeru',
      level,
      prompt: 'ブロックは いくつ？',
      figure: { kind: 'blocks', ones: n, frame: true },
      alt: true,
      answer: n,
      wrongs: [
        [n - 1, 'count-slip'],
        [n + 1, 'count-slip'],
      ],
      hints: [
        'わくの なかの ブロックを かぞえよう。',
        'うえの だんは 5こ はいるよ。5と いくつ かな。',
        lastHint,
      ],
      explain: `ブロックは ${n}こ。すうじで ${n}と かきます。`,
      identity: `kazoeru-frame:${n}`,
    });
  return num({
    id: `kazoeru:${t.id}:${n}`,
    obj: 'kazoeru',
    level,
    prompt: `${t.name}は いくつ？`,
    figure: { kind: 'illust', id: t.id, count: n },
    answer: n,
    wrongs: [
      [n - 1, 'count-slip'],
      [n + 1, 'count-slip'],
    ],
    hints: [
      '1つずつ ゆびで おさえて かぞえよう。',
      n > 5
        ? 'まず 5つ かぞえて、そこから つづけよう。'
        : 'かぞえた ものは もう かぞえないように しよう。',
      lastHint,
    ],
    explain: `1つずつ かぞえると ${n}。${t.name}は ${n} です。`,
    explainFigure: { kind: 'blocks', ones: n, frame: true },
    identity: `kazoeru:${n}`,
  });
}

// ---- すうじ ----
function suuji(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const n = pickFrom(rng, [1, 2, 3, 4, 6, 7, 8, 9]);
    return nlRead(
      `suuji-nl:${n}`,
      'suuji',
      level,
      n,
      [0, 5, 10],
      [
        '0と 5と 10の めもりに すうじが かいて あるよ。',
        n < 5 ? '0から みぎへ 1めもりずつ かぞえよう。' : '5から みぎへ 1めもりずつ かぞえよう。',
        n < 5 ? '0、1、…と めもりを かぞえて いこう。' : '5、6、…と めもりを かぞえて いこう。',
      ],
      `↓は ${n}の めもり。かずの せんでは、みぎへ いくほど かずが おおきく なるよ。`,
    );
  }
  const n = rng.int(1, 10);
  const t = pickFrom(rng, THINGS);
  const others = n === 1 ? [2, 3] : n === 10 ? [9, 8] : [n - 1, n + 1];
  if (rng.next() < 0.5)
    return {
      engine: 'choice',
      id: `suuji-num:${t.id}:${n}`,
      objective: 'suuji',
      level,
      prompt: `${t.name}の かずを あらわす すうじは どれ？`,
      figure: { kind: 'illust', id: t.id, count: n },
      hints: [
        '1つずつ ゆびで おさえて かぞえよう。',
        n > 5
          ? '5の まとまりを みつけて、そこから かぞえよう。'
          : 'かぞえた ものに しるしを つける つもりで かぞえよう。',
        `かぞえた かずと おなじ すうじを さがそう。${n > 1 ? `${n - 1}の つぎは？` : ''}`,
      ],
      explain: `かぞえると ${n}。すうじで ${n}と かくよ。`,
      explainFigure: { kind: 'blocks', ones: n, frame: true },
      identity: `suuji-num:${n}`,
      alt: false,
      options: [
        { label: String(n), correct: true },
        ...others.map((k) => ({ label: String(k), misconception: 'count-slip' })),
      ],
    };
  const options: ChoiceOption[] = [
    { figure: { kind: 'illust', id: t.id, count: n }, correct: true },
    ...others.map((k) => ({
      figure: { kind: 'illust', id: t.id, count: k } as Figure,
      misconception: 'count-slip',
    })),
  ];
  const item: ChoiceItem = {
    engine: 'choice',
    id: `suuji:${t.id}:${n}`,
    objective: 'suuji',
    level,
    prompt: `${n}の ${t.name}は どれ？`,
    hints: [
      'それぞれ 1つずつ かぞえて みよう。',
      n > 5
        ? `${n}は 5と ${n - 5}。5の まとまりを さがそう。`
        : `ゆびを ${n}ほん たてて、おなじ かずを さがそう。`,
      `${n}より 1 おおい ものや 1 すくない ものも あるよ。`,
    ],
    explain: `かぞえて ${n}に なるのが こたえ。すうじの ${n}は、${n}この ものを あらわすよ。`,
    explainFigure: { kind: 'blocks', ones: n, frame: true },
    identity: `suuji:${n}`,
    alt: false,
    options,
    layout: 'column',
  };
  return item;
}

// ---- おおきさ ----
function daishou(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const [x, y] = rng.sample(range(1, 10), 2) as [number, number];
    const lo = Math.min(x, y);
    const hi = Math.max(x, y);
    const t = pickFrom(rng, THINGS);
    return {
      engine: 'choice',
      id: `daishou-pic:${t.id}:${lo}-${hi}`,
      objective: 'daishou',
      level,
      prompt: `${t.name}が おおい ほうは どっち？`,
      hints: [
        'どちらも 1つずつ かぞえよう。',
        'えの おおきさでは なく、かずで くらべるよ。',
        `かたほうは ${x}。もう かたほうは いくつ かな。`,
      ],
      explain: `${hi}は ${lo}より おおきい。だから ${hi}の ほうが おおいね。`,
      explainFigure: {
        kind: 'numberline',
        min: 0,
        max: 10,
        step: 1,
        marks: [
          { at: lo, tone: 'muted' },
          { at: hi, tone: 'focus' },
        ],
      },
      identity: `daishou-pic:${lo}-${hi}`,
      alt: true,
      options: [
        { figure: { kind: 'illust', id: t.id, count: hi }, correct: true },
        { figure: { kind: 'illust', id: t.id, count: lo }, misconception: 'look-size' },
      ],
      layout: 'column',
    };
  }
  const [a, b, c] = (rng.sample(range(0, 10), 3) as number[]).sort((p, q) => p - q) as [
    number,
    number,
    number,
  ];
  const big = rng.next() < 0.5;
  const ans = big ? c : a;
  return {
    engine: 'choice',
    id: `daishou:${big ? 'max' : 'min'}:${a}-${b}-${c}`,
    objective: 'daishou',
    level,
    prompt: big ? 'いちばん おおきい かずは どれ？' : 'いちばん ちいさい かずは どれ？',
    hints: [
      'かずの ならび 0、1、2、3、… で うしろに でて くる ほうが おおきいよ。',
      'まず 2つを くらべて、のこった 1つとも くらべよう。',
      big
        ? `${b}と ${c}では、どちらが おおきい かな。`
        : `${a}と ${b}では、どちらが ちいさい かな。`,
    ],
    explain: `ちいさい じゅんに ${a}、${b}、${c}。いちばん ${big ? 'おおきい' : 'ちいさい'}のは ${ans}。`,
    explainFigure: {
      kind: 'numberline',
      min: 0,
      max: 10,
      step: 1,
      marks: [{ at: ans, tone: 'focus' }],
    },
    identity: `daishou:${big ? 'max' : 'min'}:${a}-${b}-${c}`,
    alt: false,
    options: [
      { label: String(ans), correct: true },
      { label: String(big ? a : c), misconception: 'bigger-smaller' },
      { label: String(b), misconception: 'compare-two' },
    ],
  };
}

// ---- じゅんばん ----
function junban(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const n = pickFrom(rng, [1, 2, 3, 4, 6, 7, 8, 9]);
    return nlPlace(
      `junban-place:${n}`,
      'junban',
      level,
      n,
      [0, 5, 10],
      [
        'かずの せんは、みぎへ いくほど おおきく なるよ。',
        n < 5 ? '0から 1めもりずつ かぞえよう。' : '5の めもりから かぞえよう。',
        n < 5 ? `0から ${n}めもり すすもう。` : `5から ${n - 5}めもり すすもう。`,
      ],
      `${n}は ${n < 5 ? `0から ${n}めもり` : `5から ${n - 5}めもり`} すすんだ ところ だよ。`,
    );
  }
  if (rng.next() < 0.6) {
    const up = rng.next() < 0.5;
    const s = up ? rng.int(0, 7) : rng.int(3, 10);
    const pos = rng.int(0, 3);
    const arr = [0, 1, 2, 3].map((i) => (up ? s + i : s - i));
    const ans = arr[pos]!;
    const shown = arr.filter((_, i) => i !== pos);
    const text = arr.map((v, i) => (i === pos ? '{{}}' : String(v))).join('、');
    const last =
      pos > 0
        ? up
          ? `${arr[pos - 1]}の つぎに いう かずは？`
          : `${arr[pos - 1]}から 1 へらすと？`
        : up
          ? `${arr[1]}の まえの かずは？`
          : `${arr[1]}より 1 おおきい かずは？`;
    return num({
      id: `junban:${up ? 'up' : 'down'}:${s}:${pos}`,
      obj: 'junban',
      level,
      prompt: 'あいて いる ところに はいる かずは いくつ？',
      figure: expr(text),
      answer: ans,
      wrongs: [ans - 1, ans + 1].map(
        (w) => [w, shown.includes(w) ? 'seq-copy' : 'count-slip'] as [number, string],
      ),
      hints: [
        'となりの かずを よく みよう。',
        up ? '1ずつ ふえて いるね。' : '1ずつ へって いるね。',
        last,
      ],
      explain: `${arr.join('、')}。1ずつ ${up ? 'ふえる' : 'へる'} ならびなので ${ans} です。`,
      explainFigure: {
        kind: 'numberline',
        min: 0,
        max: 10,
        step: 1,
        marks: [{ at: ans, tone: 'focus' }],
      },
      identity: `junban:${up ? 'up' : 'down'}:${s}:${pos}`,
    });
  }
  const next = rng.next() < 0.5;
  const n = next ? rng.int(0, 9) : rng.int(2, 10);
  const ans = next ? n + 1 : n - 1;
  return num({
    id: `${next ? 'next' : 'prev'}:${n}`,
    obj: 'junban',
    level,
    prompt: next ? `${n}の つぎの かずは？` : `${n}の まえの かずは？`,
    figure: { kind: 'numberline', min: 0, max: 10, step: 1, marks: [{ at: n, tone: 'focus' }] },
    answer: ans,
    wrongs: next
      ? [
          [n - 1, 'seq-back'],
          [n + 2, 'count-slip'],
        ]
      : [
          [n + 1, 'seq-back'],
          [n - 2, 'count-slip'],
        ],
    hints: [
      'かずの せんの ▼の ところを みよう。',
      next
        ? '「つぎ」は 1 おおきい かず。みぎどなり だよ。'
        : '「まえ」は 1 ちいさい かず。ひだりどなり だよ。',
      next ? `${n}から みぎへ 1めもり すすむと？` : `${n}から ひだりへ 1めもり もどると？`,
    ],
    explain: `${n}の ${next ? 'つぎ' : 'まえ'}は ${ans}。かずの せんで ${next ? 'みぎ' : 'ひだり'}どなり だよ。`,
    identity: `${next ? 'next' : 'prev'}:${n}`,
  });
}

// ---- 0 ----
const ZERO_PRACTICE = ['frame', 'before1', 'pick', ...range(1, 8).map((n) => `gone${n}`)];

function zero(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const k = rng.int(0, 2);
    if (k === 0)
      return nlRead(
        'zero-nl',
        'zero',
        level,
        0,
        [5, 10],
        [
          '5の めもりを みつけよう。',
          '5から ひだりへ 1めもりずつ もどろう。4、3、…',
          'いちばん ひだりの めもりは、1より 1 ちいさい かずだよ。',
        ],
        'いちばん ひだりの めもりは 0。かずの せんは 0から はじまるよ。',
      );
    if (k === 1)
      return nlPlace(
        'zero-place',
        'zero',
        level,
        0,
        [5, 10],
        [
          '0は 1より 1 ちいさい かずだよ。',
          '5の めもりから ひだりへ もどろう。',
          '1の めもりの ひだりどなりは？',
        ],
        '0は かずの せんの いちばん ひだり。1の ひだりどなり だよ。',
      );
    const [a, b] = (rng.sample(range(1, 10), 2) as number[]).sort((p, q) => p - q) as [
      number,
      number,
    ];
    return {
      engine: 'choice',
      id: `zero-min:${a}-${b}`,
      objective: 'zero',
      level,
      prompt: 'いちばん ちいさい かずは どれ？',
      hints: [
        '0も かずの なかまだよ。',
        '0は なにも ない ことを あらわす かず。1より ちいさいよ。',
        `${a}と 0では、どちらが ちいさい かな。`,
      ],
      explain: `0は 1より ちいさい かず。0、${a}、${b}の なかで いちばん ちいさいのは 0。`,
      explainFigure: {
        kind: 'numberline',
        min: 0,
        max: 10,
        step: 1,
        marks: [{ at: 0, tone: 'focus' }],
      },
      identity: `zero-min:${a}-${b}`,
      alt: true,
      options: [
        { label: '0', correct: true },
        { label: String(a), misconception: 'zero-none' },
        { label: String(b), misconception: 'bigger-smaller' },
      ],
    };
  }
  const kind = pickFrom(rng, ZERO_PRACTICE);
  const zeroHints = (first: string): string[] => [
    first,
    'なにも ない ときにも かずが あるよ。',
    '1つも ない ときの かずは、1より 1 ちいさい かず。',
  ];
  if (kind === 'frame')
    return num({
      id: 'zero:frame',
      obj: 'zero',
      level,
      prompt: 'ブロックは いくつ？',
      figure: { kind: 'blocks', ones: 0, frame: true },
      answer: 0,
      wrongs: [[1, 'zero-none']],
      hints: zeroHints('わくの なかを よく みよう。'),
      explain: 'わくの なかに ブロックは ありません。なにも ない ときは 0と かくよ。',
      identity: 'zero:frame',
    });
  if (kind === 'before1')
    return num({
      id: 'zero:before1',
      obj: 'zero',
      level,
      prompt: '1の まえの かずは？',
      figure: { kind: 'numberline', min: 0, max: 10, step: 1, marks: [{ at: 1, tone: 'focus' }] },
      answer: 0,
      wrongs: [[2, 'seq-back']],
      hints: [
        'かずの せんの ▼の ところを みよう。',
        '「まえ」は 1 ちいさい かず。ひだりどなり だよ。',
        '1から ひだりへ 1めもり もどると？',
      ],
      explain: '1の まえは 0。かずの せんは 0から はじまるよ。',
      identity: 'zero:before1',
    });
  if (kind === 'pick')
    return {
      engine: 'choice',
      id: 'zero:pick',
      objective: 'zero',
      level,
      prompt: 'ブロックが 0この わくは どれ？',
      hints: zeroHints('わくの なかの ブロックを かぞえよう。'),
      explain: '0こ は ブロックが 1つも ない こと。からっぽの わくが こたえ。',
      identity: 'zero:pick',
      alt: false,
      options: [
        { figure: { kind: 'blocks', ones: 0, frame: true }, correct: true },
        { figure: { kind: 'blocks', ones: 1, frame: true }, misconception: 'zero-none' },
        { figure: { kind: 'blocks', ones: 2, frame: true }, misconception: 'zero-none' },
      ],
      layout: 'column',
    };
  const n = Number(kind.slice(4));
  const f = pickFrom(rng, FRUITS);
  return num({
    id: `zero:gone:${f.id}:${n}`,
    obj: 'zero',
    level,
    prompt: `${f.name}が ${n}こ あります。ぜんぶ たべると、のこりは いくつ？`,
    figure: { kind: 'illust', id: f.id, count: n },
    answer: 0,
    wrongs: [
      [1, 'zero-none'],
      [n, 'zero-none'],
    ],
    hints: zeroHints('「ぜんぶ たべる」と、いくつ のこるかな。'),
    explain: `${n}こ ぜんぶ たべると、1つも のこりません。のこりは 0こ。`,
    explainFigure: { kind: 'blocks', ones: 0, frame: true },
    identity: `zero:gone:${n}`,
  });
}

const GEN: Record<Obj, (level: number, rng: Rng, alt: boolean) => Item> = {
  kazoeru,
  suuji,
  daishou,
  junban,
  zero,
};

const LEVELS: Obj[][] = [
  ['kazoeru', 'suuji', 'junban', 'zero'],
  ['daishou', 'junban'],
  ['kazoeru', 'suuji', 'daishou', 'junban', 'zero'],
];

export function generateNumbers10(level: number, rng: Rng, index: number): Item {
  const objs = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = objs[(index + rng.int(0, objs.length - 1)) % objs.length]!;
  const alt = rng.next() < 0.25;
  return GEN[obj](level, rng, alt);
}

export const numbers10: UnitSpec = {
  id: 'g1.math.numbers-10',
  title: '10までの かず',
  stage: 'g1',
  subject: 'math',
  domain: 'A-number',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-sansu',
  prereq: ['p5.math.numbers-10'],
  objectives: [
    { id: 'kazoeru', title: 'かぞえる（え・ブロック）' },
    { id: 'suuji', title: 'かずと すうじ（え・かずの せん）' },
    { id: 'daishou', title: 'かずの おおきさ' },
    { id: 'junban', title: 'かずの ならび（つぎ・まえ）' },
    { id: 'zero', title: '0（なにも ない）' },
  ],
  misconceptions: [
    {
      id: 'count-slip',
      explain:
        'おなじ ものを 2かい かぞえたり、1つ とばしたり したのかな。1つずつ ゆびで おさえて かぞえよう。',
    },
    {
      id: 'bigger-smaller',
      explain:
        '「おおきい」と「ちいさい」を とりちがえたのかな。かずの ならびで うしろの ほうが おおきいよ。',
    },
    {
      id: 'compare-two',
      explain: '2つだけ くらべたのかな。のこりの かずとも くらべて みよう。',
    },
    {
      id: 'look-size',
      explain:
        'えの おおきさや ならびの ながさで くらべたのかな。1つずつ かぞえて かずで くらべよう。',
    },
    {
      id: 'seq-copy',
      explain: 'となりの かずを そのまま かいたのかな。1ずつ かわる ことを たしかめよう。',
    },
    {
      id: 'seq-back',
      explain:
        '「つぎ」と「まえ」を とりちがえたのかな。つぎは 1 おおきい かず、まえは 1 ちいさい かずだよ。',
    },
    {
      id: 'zero-none',
      explain: 'なにも ない ときにも かずが あるよ。1つも ない ことを 0と いうよ。',
      figure: { kind: 'blocks', ones: 0, frame: true },
    },
  ],
  levels: [
    { label: 'かぞえる・すうじ・ならび・0', chance: 0.05 },
    { label: 'おおきさ・ならび', chance: 0.1 },
    { label: 'まとめ', chance: 0.1 },
  ],
  intro: [
    {
      text: 'りんごを 1つずつ ゆびで おさえて かぞえます。1、2、3、4、5。',
      figure: { kind: 'illust', id: 'apple', count: 5 },
    },
    {
      text: 'ブロックに おきかえても 5こ。かずの せんでは 5の ところ。',
      figure: {
        kind: 'column',
        items: [
          { kind: 'blocks', ones: 5, frame: true },
          { kind: 'numberline', min: 0, max: 10, step: 1, marks: [{ at: 5, tone: 'focus' }] },
        ],
      },
    },
    {
      text: 'すうじで かくと 5。なにも ない ときは 0と かきます。',
      figure: expr('5　　0'),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateNumbers10(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第1学年 A(1) 数の構成と表し方（個数を数える、数の大小・順序、0）',
  revised: REVISED,
};
