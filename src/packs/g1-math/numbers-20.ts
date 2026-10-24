/**
 * g1.math.numbers-20 20までの かず（10と いくつ・数直線 0〜20）（curriculum-matrix 3.4）。
 *
 * 同一性キー: 絵柄は同じとみなす（1.4）。表し方（10の棒とばら／10のわく2つ／絵）が違えば別。
 *   10と いくつ: 10〜20（棒とばら・わく）／11〜20 の絵、
 *   あわせる・わける: 10と k で □（k 1〜10）・□は 10と □（11〜19）／絵で わける、
 *   数直線を読む: 0〜20 の 1めもり（10・0・20 以外）／2めもりとびの線、
 *   数直線に置く: 1〜19（10以外）／「a より d おおきい・ちいさい」、
 *   ならび: 1とび・2とびの4つの数（空欄の位置）／へる ならび。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { NumberlineItem } from '../../engines/numberline/numberline';
import type { Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { REVISED, countUpHint, expr, pickFrom } from './util';

type Obj = 'juuto' | 'bunkai' | 'nlread' | 'nlplace' | 'narabi';

const THINGS = [
  { id: 'apple', name: 'りんご' },
  { id: 'mikan', name: 'みかん' },
  { id: 'strawberry', name: 'いちご' },
  { id: 'chick', name: 'ひよこ' },
  { id: 'frog', name: 'かえる' },
] as const;

const LINE20 = { min: 0, max: 20, minor: 1, midEvery: 5, majorEvery: 10, labels: [0, 10, 20] };
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const tenAnd = (n: number): Figure =>
  n >= 20 ? { kind: 'blocks', tens: 2, ones: 0 } : { kind: 'blocks', tens: 1, ones: n - 10 };

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
  identity?: string;
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
    identity: s.identity ?? s.id,
    alt: s.alt ?? false,
    fields: [{ answer: { kind: 'int', value: s.answer } }],
    wrongAnswers,
  };
}

// ---- 10と いくつ（かぞえる） ----
function juuto(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const n = rng.int(11, 20);
    const t = pickFrom(rng, THINGS);
    return num({
      id: `juuto-pic:${n}`,
      obj: 'juuto',
      level,
      prompt: `${t.name}は いくつ？`,
      figure: { kind: 'illust', id: t.id, count: n },
      alt: true,
      answer: n,
      wrongs: [
        [n - 1, 'count-slip'],
        [n + 1, 'count-slip'],
        [`10${n - 10}`, 'place-concat'],
      ],
      hints: [
        '5こずつの まとまりが ならんで いるよ。',
        '5の まとまり 2つで 10。10の まとまりを つくろう。',
        n === 20 ? '10の まとまりが いくつ できるかな。' : `10と、のこりは いくつ かな。`,
      ],
      explain: `5の まとまり 2つで 10。10と ${n - 10}で ${n}。`,
      explainFigure: tenAnd(n),
    });
  }
  const n = rng.int(10, 20);
  const k = n - 10;
  const frame = rng.next() < 0.5;
  const fig: Figure = frame
    ? {
        kind: 'row',
        items: [
          { kind: 'blocks', ones: 10, frame: true },
          { kind: 'blocks', ones: k, frame: true },
        ],
        gap: 4,
      }
    : tenAnd(n);
  const wrongs: [number | string, string][] = [
    [n - 1, 'count-slip'],
    [n + 1, 'count-slip'],
  ];
  if (k > 0 && k < 10) wrongs.push([`10${k}`, 'place-concat'], [k + 1, 'bar-as-one']);
  return num({
    id: `juuto${frame ? '-frame' : ''}:${n}`,
    obj: 'juuto',
    level,
    prompt: 'ブロックは いくつ？',
    figure: fig,
    answer: n,
    wrongs,
    hints: [
      // 答えの手前で止める: n=10 のとき「10」と書くと答えそのものになるので、数を出さない言い方にする
      n === 10
        ? frame
          ? 'いっぱいの わくは ブロックを まとめた ものだよ。'
          : 'ながい ぼう 1ぽんは ブロックを まとめた ものだよ。'
        : frame
          ? 'いっぱいの わくは 10こ だよ。'
          : 'ながい ぼうは ブロック 10こ ぶん だよ。',
      n === 20 ? '10が 2つ あるね。' : n === 10 ? 'ばらは ないね。' : `10と、ばらが ${k}こ。`,
      n === 20
        ? '10、… と 10の まとまりを かぞえて いこう。'
        : n === 10
          ? 'ぼう 1ぽんで ブロックは なんこぶん かな。'
          : k === 1
            ? 'ばらは 1こ。10の つぎの かずだね。'
            : '10、11、…と ばらを かぞえて いこう。',
    ],
    explain:
      n === 20
        ? '10と 10で 20。'
        : `10と ${k}で ${n}。「じゅう${['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'][k]}」と よむよ。`,
    explainFigure: tenAnd(n),
  });
}

// ---- あわせる・わける ----
function bunkai(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const k = rng.int(1, 9);
    const n = 10 + k;
    const t = pickFrom(rng, THINGS);
    return num({
      id: `bunkai-pic:${k}`,
      obj: 'bunkai',
      level,
      prompt: `${t.name}が ${n}こ。10こと あと なんこ？`,
      figure: { kind: 'illust', id: t.id, count: n },
      alt: true,
      answer: k,
      wrongs: [
        [k - 1, 'count-slip'],
        [k + 1, 'count-slip'],
        [1, 'tens-ones'],
        [n, 'tens-ones'],
      ],
      hints: [
        '5こずつの まとまりを みよう。',
        '5の まとまり 2つで 10こ。',
        '10こ より あとの ものを かぞえよう。',
      ],
      explain: `${n}は 10と ${k}。10こ と あと ${k}こ だよ。`,
      explainFigure: tenAnd(n),
    });
  }
  if (rng.next() < 0.5) {
    const k = rng.int(1, 10);
    const n = 10 + k;
    return num({
      id: `compose:${k}`,
      obj: 'bunkai',
      level,
      prompt: 'あてはまる かずは いくつ？',
      figure: expr(`10と ${k}で {{}}`),
      answer: n,
      wrongs: [
        [`10${k}`, 'place-concat'],
        [n - 1, 'count-slip'],
        [n + 1, 'count-slip'],
        [k + 1, 'bar-as-one'],
      ],
      hints: [
        '10の まとまりと ばらを おもいうかべよう。',
        k === 10 ? '10の まとまりが 2つ。' : `10の ぼう 1ぽんと、ばらが ${k}こ。`,
        k === 10 ? '10、20 と かぞえよう。' : '10から、ばらの かずだけ かぞえて いこう。',
      ],
      explain: `10と ${k}で ${n}。`,
      explainFigure: tenAnd(n),
    });
  }
  const k = rng.int(1, 9);
  const n = 10 + k;
  return num({
    id: `decompose:${k}`,
    obj: 'bunkai',
    level,
    prompt: 'あてはまる かずは いくつ？',
    figure: expr(`${n}は 10と {{}}`),
    answer: k,
    wrongs: [
      [1, 'tens-ones'],
      [n, 'tens-ones'],
      [k - 1, 'count-slip'],
      [k + 1, 'count-slip'],
    ],
    hints: [
      `${n}を 10の まとまりと ばらに わけよう。`,
      `${n}の ひだりの 1は、10の まとまり 1つの こと。`,
      'みぎの すうじは ばらの かず だよ。',
    ],
    explain: `${n}は 10と ${k}。10の まとまり 1つと、ばらが ${k}こ。`,
    explainFigure: tenAnd(n),
  });
}

// ---- 数直線を読む ----
function nlread(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const n = pickFrom(rng, [2, 4, 6, 8, 12, 14, 16, 18]);
    const it: NumberlineItem = {
      engine: 'numberline',
      id: `nlread-2:${n}`,
      objective: 'nlread',
      level,
      prompt: '1めもりが 2の かずの せん。↓の ところの かずは いくつ？',
      hints: [
        '0と 10の あいだに めもりが いくつ あるか みよう。',
        '1めもり すすむと 2 ふえるよ。2、4、6、…',
        n < 10 ? '0から 2ずつ かぞえて いこう。' : '10から 2ずつ かぞえて いこう。',
      ],
      explain: `1めもりは 2。${n < 10 ? 0 : 10}から ${(n % 10) / 2}めもりで ${n}。`,
      identity: `nlread-2:${n}`,
      alt: true,
      line: { min: 0, max: 20, minor: 2, majorEvery: 5, labels: [0, 10, 20] },
      task: { kind: 'read', at: n },
      misconceptions: { minorAsOne: 'minor-as-one', neighborTick: 'tick-slip' },
    };
    return it;
  }
  const n = pickFrom(rng, [...range(1, 9), ...range(11, 19)]);
  const base = n < 10 ? 0 : 10;
  const it: NumberlineItem = {
    engine: 'numberline',
    id: `nlread:${n}`,
    objective: 'nlread',
    level,
    prompt: '↓の ところの かずは いくつ？',
    hints: [
      '0・10・20 の めもりに すうじが かいて あるよ。',
      n % 10 <= 5
        ? `${base}の めもりから かぞえよう。`
        : `${base + 5}の めもり（まんなかの ながい めもり）から かぞえよう。`,
      countUpHint(n % 10 <= 5 ? base : base + 5, n),
    ],
    explain: `${base}から みぎへ ${n - base}めもりで ${n}。`,
    identity: `nlread:${n}`,
    alt: false,
    line: { ...LINE20 },
    task: { kind: 'read', at: n },
    misconceptions: { neighborTick: 'tick-slip' },
  };
  return it;
}

// ---- 数直線に置く ----
function nlplace(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const up = rng.next() < 0.5;
    const d = rng.int(1, 3);
    const a = up ? rng.int(10, 20 - d) : rng.int(10 + d, 20);
    const target = up ? a + d : a - d;
    const opp = up ? a - d : a + d;
    const it: NumberlineItem = {
      engine: 'numberline',
      id: `place-${up ? 'more' : 'less'}:${a}:${d}`,
      objective: 'nlplace',
      level,
      prompt: `${a}より ${d} ${up ? 'おおきい' : 'ちいさい'} かずの ところを タップしよう。`,
      hints: [
        `まず ${a}の ところを さがそう。▲の しるしが あるよ。`,
        up ? 'おおきい かずは みぎに あるよ。' : 'ちいさい かずは ひだりに あるよ。',
        `${a}から ${up ? 'みぎ' : 'ひだり'}へ ${d}めもり すすもう。`,
      ],
      explain: `${a}より ${d} ${up ? 'おおきい' : 'ちいさい'} かずは ${target}。${a}から ${up ? 'みぎ' : 'ひだり'}へ ${d}めもりの ところ。`,
      identity: `place-${up ? 'more' : 'less'}:${a}:${d}`,
      alt: true,
      line: { ...LINE20 },
      task: { kind: 'place', target },
      marks: [{ at: a }],
      misconceptions: { neighborTick: 'tick-slip' },
      wrongAnswers:
        opp >= 0 && opp <= 20 && opp !== target ? [{ value: opp, misconception: 'more-less' }] : [],
    };
    return it;
  }
  const n = pickFrom(rng, [...range(1, 9), ...range(11, 19)]);
  const base = n < 10 ? 0 : 10;
  const it: NumberlineItem = {
    engine: 'numberline',
    id: `nlplace:${n}`,
    objective: 'nlplace',
    level,
    prompt: `${n}の ところを タップしよう。`,
    hints: [
      n < 10 ? '0と 10の あいだに あるよ。' : '10と 20の あいだに あるよ。',
      n % 10 <= 5
        ? `${base}の めもりから かぞえよう。`
        : `${base + 5}の めもり（まんなかの ながい めもり）から かぞえよう。`,
      n % 10 <= 5
        ? `${base}から みぎへ ${n - base}めもり すすもう。`
        : `${base + 5}から みぎへ ${n - base - 5}めもり すすもう。`,
    ],
    explain: `${n}は ${base}から みぎへ ${n - base}めもりの ところ。`,
    identity: `nlplace:${n}`,
    alt: false,
    line: { ...LINE20 },
    task: { kind: 'place', target: n },
    misconceptions: { neighborTick: 'tick-slip' },
  };
  return it;
}

// ---- ならび ----
function narabi(level: number, rng: Rng, alt: boolean): Item {
  const pos = rng.int(0, 3);
  let step: 1 | 2 | -1;
  let s: number;
  if (alt) {
    step = -1;
    s = rng.int(13, 20);
  } else if (rng.next() < 0.5) {
    step = 1;
    s = rng.int(10, 17);
  } else {
    step = 2;
    s = pickFrom(rng, [0, 2, 4, 6, 8, 10, 12, 14]);
  }
  const arr = [0, 1, 2, 3].map((i) => s + step * i);
  const ans = arr[pos]!;
  const shown = arr.filter((_, i) => i !== pos);
  const text = arr.map((v, i) => (i === pos ? '{{}}' : String(v))).join('、');
  const wrongs: [number, string][] = [ans - 1, ans + 1].map((w) => [
    w,
    step === 2 ? 'step-one' : shown.includes(w) ? 'seq-copy' : 'count-slip',
  ]);
  const key = alt ? `narabi-down:${s}:${pos}` : `narabi:${step}:${s}:${pos}`;
  const neighbor = pos > 0 ? arr[pos - 1]! : arr[1]!;
  const dirWord = step === 2 ? '2ずつ ふえて' : step === 1 ? '1ずつ ふえて' : '1ずつ へって';
  return num({
    id: key,
    obj: 'narabi',
    level,
    prompt: 'あいて いる ところに はいる かずは いくつ？',
    figure: expr(text),
    alt,
    answer: ans,
    wrongs,
    hints: [
      'となりどうしの かずを くらべよう。',
      `${dirWord} いるね。`,
      pos > 0
        ? `${neighbor}${step === -1 ? `から 1 へらすと？` : `に ${step} たすと？`}`
        : `${neighbor}${step === -1 ? 'に 1 たすと？' : `から ${step} へらすと？`}`,
    ],
    explain: `${arr.join('、')}。${dirWord} いく ならびなので ${ans}。`,
    explainFigure: {
      kind: 'numberline',
      min: 0,
      max: 20,
      step: 1,
      labelEvery: 5,
      marks: [{ at: ans, tone: 'focus' }],
    },
  });
}

const GEN: Record<Obj, (level: number, rng: Rng, alt: boolean) => Item> = {
  juuto,
  bunkai,
  nlread,
  nlplace,
  narabi,
};

const LEVELS: Obj[][] = [
  ['juuto', 'bunkai'],
  ['nlread', 'nlplace', 'narabi'],
  ['juuto', 'bunkai', 'nlread', 'nlplace', 'narabi'],
];

export function generateNumbers20(level: number, rng: Rng, index: number): Item {
  const objs = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = objs[(index + rng.int(0, objs.length - 1)) % objs.length]!;
  const alt = rng.next() < 0.25;
  return GEN[obj](level, rng, alt);
}

export const numbers20: UnitSpec = {
  id: 'g1.math.numbers-20',
  title: '20までの かず',
  stage: 'g1',
  subject: 'math',
  domain: 'A-number',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-sansu',
  prereq: ['g1.math.compose-10'],
  objectives: [
    { id: 'juuto', title: '10と いくつ（ブロック・え）' },
    { id: 'bunkai', title: '10と いくつで あらわす・わける' },
    { id: 'nlread', title: 'かずの せんを よむ' },
    { id: 'nlplace', title: 'かずの せんに おく' },
    { id: 'narabi', title: 'かずの ならび（1とび・2とび）' },
  ],
  misconceptions: [
    {
      id: 'place-concat',
      explain:
        '「10と 4」を そのまま ならべて 104と かいたのかな。10と 4で 14。じゅうの くらいに 1、いちの くらいに 4を かくよ。',
      figure: { kind: 'blocks', tens: 1, ones: 4 },
    },
    {
      id: 'bar-as-one',
      explain: '10の ぼうを 1こと かぞえたのかな。ながい ぼうは ブロック 10こ ぶん だよ。',
      figure: { kind: 'blocks', ones: 10, frame: true },
    },
    {
      id: 'tens-ones',
      explain:
        '10の まとまりと ばらを とりちがえたのかな。14の 1は 10の まとまり 1つ、4は ばらの かず だよ。',
    },
    {
      id: 'count-slip',
      explain: '1つ とばしたり、2かい かぞえたり したのかな。1つずつ おさえて かぞえよう。',
    },
    {
      id: 'tick-slip',
      explain: 'めもりを 1つ かぞえまちがえたのかな。すうじの ある めもりから 1つずつ かぞえよう。',
    },
    {
      id: 'minor-as-one',
      explain: '1めもりを 1と かぞえたのかな。この かずの せんは 1めもりで 2 ふえるよ。',
    },
    {
      id: 'more-less',
      explain:
        '「おおきい」と「ちいさい」の むきを とりちがえたのかな。おおきい かずは みぎ、ちいさい かずは ひだり だよ。',
    },
    {
      id: 'step-one',
      explain:
        '1ずつ ふえると かんがえたのかな。となりどうしの かずを くらべると、2ずつ ふえて いるよ。',
    },
    {
      id: 'seq-copy',
      explain: 'となりの かずを そのまま かいたのかな。1ずつ かわる ことを たしかめよう。',
    },
  ],
  levels: [
    { label: '10と いくつ', chance: 0.05 },
    { label: 'かずの せん・ならび', chance: 0.05 },
    { label: 'まとめ', chance: 0.05 },
  ],
  intro: [
    {
      text: 'いちごが 14こ。5こずつ かぞえると、5、10、と 10の まとまりが できます。',
      figure: { kind: 'illust', id: 'strawberry', count: 14 },
    },
    {
      text: 'ブロックで あらわすと、10の ぼう 1ぽんと ばらが 4こ。かずの せんでは 10から 4めもりの ところ。',
      figure: {
        kind: 'column',
        items: [
          { kind: 'blocks', tens: 1, ones: 4 },
          {
            kind: 'numberline',
            min: 0,
            max: 20,
            step: 1,
            labelEvery: 10,
            marks: [{ at: 14, tone: 'focus' }],
          },
        ],
      },
    },
    {
      text: '10と 4で 14。すうじで 14と かき、「じゅうよん」と よみます。',
      figure: expr('10と 4で 14'),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateNumbers20(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第1学年 A(1) 数の構成と表し方（10を単位とした数の見方、数直線）',
  revised: REVISED,
};
