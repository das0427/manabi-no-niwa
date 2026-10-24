/**
 * g1.math.compose-10 いくつと いくつ（10までの数の合成・分解）と 10の補数（curriculum-matrix 3.4）。
 *
 * 同一性キー:
 *   合成・分解 = `n=a+b`（a・b≥1。「7は 3と □」と「7は 4と □」は問う数が違うので別。順序つき）。
 *     n=2〜10 の順序つきの組 1+2+…+9 = 45 通り。
 *   10の補数（あと いくつで 10）= `ato10:a`（a=1〜9）の 9 通り。ブロックのわくで考える別の型として数える。
 *   定義域 = 45 + 9 = 54（全件が基準）。
 * 0 を含む分解（5は 5と 0）は扱わない（具体物を2つに分ける学習のため。1年の教科書の扱いは未確認）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { FillItem } from '../../engines/fill/fill';
import type { Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { REVISED } from './util';

type Obj = 'bunkai' | 'gousei' | 'sakuranbo' | 'ato10';

const LEVELS: { max: number; objs: Obj[] }[] = [
  { max: 5, objs: ['bunkai', 'gousei'] },
  { max: 10, objs: ['bunkai', 'gousei', 'sakuranbo'] },
  { max: 10, objs: ['ato10', 'sakuranbo', 'bunkai', 'gousei'] },
];

const key = (n: number, a: number) => `${n}=${a}+${n - a}`;

/** 2≤n≤max、a・b≥1 の順序つきの組から均等に1つ */
function pickSplit(rng: Rng, max: number): [number, number] {
  const all: [number, number][] = [];
  for (let n = 2; n <= max; n++) for (let a = 1; a < n; a++) all.push([n, a]);
  return all[rng.int(0, all.length - 1)]!;
}

/** さくらんぼの図（上が全体、下の2つが部分）。'?' は問う所 */
export function cherry(top: string, left: string, right: string, label: string): Figure {
  const ball = (x: number, y: number, t: string) =>
    `<circle cx="${x}" cy="${y}" r="27" fill="var(--surface)" stroke="var(--ink)" stroke-width="3"/>` +
    `<text x="${x}" y="${y + 11}" text-anchor="middle" font-size="32" font-weight="700" fill="var(--ink)">${t}</text>`;
  return {
    kind: 'svg',
    label,
    markup:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" width="220" height="176">` +
      `<line x1="100" y1="40" x2="52" y2="120" stroke="var(--ink)" stroke-width="3"/>` +
      `<line x1="100" y1="40" x2="148" y2="120" stroke="var(--ink)" stroke-width="3"/>` +
      ball(100, 32, top) +
      ball(50, 126, left) +
      ball(150, 126, right) +
      `</svg>`,
  };
}

/** 選択肢の数（正解と誤り。重複を除き、小さい順に並べる: fill は書いた順に出すため） */
function numOptions(values: number[]): string[] {
  return [...new Set(values.filter((v) => v >= 0))]
    .slice(0, 6)
    .sort((x, y) => x - y)
    .map(String);
}

/** 分解の誤答（n は a と □。答え b） */
function splitWrongs(n: number, a: number): { value: number; misconception: string }[] {
  const b = n - a;
  const out: { value: number; misconception: string }[] = [];
  const add = (v: number, m: string) => {
    if (v !== b && v >= 0 && !out.some((w) => w.value === v))
      out.push({ value: v, misconception: m });
  };
  add(n + a, 'add-instead');
  add(a, 'copy-part');
  add(n, 'whole');
  add(b + 1, 'off-by-one');
  add(b - 1, 'off-by-one');
  return out;
}

function hintsSplit(n: number, a: number): string[] {
  return [
    `ぜんぶで ${n}。そのうち ${a}は わかって いるね。`,
    `ブロックを ${n}こ ならべて、${a}こを かくして みよう。`,
    a + 1 < n
      ? `${a}の つぎから かぞえよう。${Array.from({ length: Math.min(n - a - 1, 3) }, (_, i) => a + i + 1).join('、')}、… ${n}まで いくつ かぞえたかな。`
      : `${a}の つぎの かずが ${n}だね。いくつ かぞえたかな。`,
  ];
}

function splitNumber(level: number, n: number, a: number, alt: boolean): NumberItem {
  const b = n - a;
  return {
    engine: 'number',
    id: `bunkai${alt ? '-alt' : ''}:${key(n, a)}`,
    objective: 'bunkai',
    level,
    prompt: alt ? `${n}は ${a}と いくつ？` : `${n}こを ${a}こと いくつに わけられる？`,
    figure: alt
      ? cherry(String(n), String(a), '?', `${n}は ${a}と いくつ`)
      : { kind: 'blocks', ones: n, frame: n <= 10 },
    hints: hintsSplit(n, a),
    explain: `${n}は ${a}と ${b}。${a}と ${b}を あわせると ${n}に なるね。`,
    explainFigure: {
      kind: 'row',
      items: [
        { kind: 'blocks', ones: a, tone: 'a' },
        { kind: 'blocks', ones: b, tone: 'b' },
      ],
    },
    identity: key(n, a),
    alt,
    fields: [{ answer: { kind: 'int', value: b } }],
    wrongAnswers: splitWrongs(n, a).map((w) => ({
      value: String(w.value),
      misconception: w.misconception,
    })),
  };
}

function composeNumber(level: number, n: number, a: number, alt: boolean): NumberItem {
  const b = n - a;
  const wrongs: { value: string; misconception: string }[] = [];
  const add = (v: number, m: string) => {
    if (v !== n && v >= 0 && !wrongs.some((w) => w.value === String(v)))
      wrongs.push({ value: String(v), misconception: m });
  };
  add(n - 1, 'off-by-one');
  add(n + 1, 'off-by-one');
  if (a !== b) add(Math.abs(a - b), 'sub-instead');
  add(Number(`${a}${b}`), 'concat');
  return {
    engine: 'number',
    id: `gousei${alt ? '-alt' : ''}:${key(n, a)}`,
    objective: 'gousei',
    level,
    prompt: alt ? `${a}と ${b}で いくつ？` : `${a}こと ${b}こを あわせると いくつ？`,
    figure: alt
      ? cherry('?', String(a), String(b), `${a}と ${b}で いくつ`)
      : {
          kind: 'row',
          items: [
            { kind: 'blocks', ones: a, tone: 'a' },
            { kind: 'blocks', ones: b, tone: 'b' },
          ],
          gap: 4,
        },
    hints: [
      'ふたつの かずを あわせた かずを かんがえよう。',
      `${a}の ブロックと ${b}の ブロックを くっつけて みよう。`,
      b > 1 ? `${a}から ${b}こ かぞえよう。${a + 1}、…` : `${a}の つぎの かずは…`,
    ],
    explain: `${a}と ${b}で ${n}。${n}は ${a}と ${b}に わけられるね。`,
    explainFigure: { kind: 'blocks', ones: n, frame: true },
    identity: key(n, a),
    alt,
    fields: [{ answer: { kind: 'int', value: n } }],
    wrongAnswers: wrongs,
  };
}

function cherryFill(level: number, n: number, a: number, alt: boolean): FillItem {
  const b = n - a;
  // 別例: 「n は □ と b」（前の数を問う）。キーは同じ事実 n=a+b
  const wrongs = splitWrongs(n, alt ? b : a);
  const answer = alt ? a : b;
  const options = numOptions([answer, ...wrongs.slice(0, 4).map((w) => w.value)]);
  return {
    engine: 'fill',
    id: `sakuranbo${alt ? '-alt' : ''}:${key(n, a)}`,
    objective: 'sakuranbo',
    level,
    prompt: '{{}}に はいる かずを えらぼう。',
    figure: alt ? cherry(String(n), '?', String(b), `${n}は いくつと ${b}`) : undefined,
    text: alt ? `${n}は {{}}と ${b}` : `${n}は ${a}と {{}}`,
    options,
    blanks: [
      {
        answers: [String(answer)],
        wrong: wrongs
          .filter((w) => options.includes(String(w.value)))
          .map((w) => ({
            value: String(w.value),
            misconception: w.misconception,
          })),
      },
    ],
    hints: alt ? hintsSplit(n, b) : hintsSplit(n, a),
    explain: `${n}は ${a}と ${b}。さくらんぼの したの 2つを あわせると うえの ${n}に なるよ。`,
    explainFigure: cherry(String(n), String(a), String(b), `${n}は ${a}と ${b}`),
    identity: key(n, a),
    alt,
  };
}

function ato10(level: number, a: number, alt: boolean): Item {
  const b = 10 - a;
  const wrongs = splitWrongs(10, a);
  const hints = [
    '10の わくの あいて いる ところを みよう。',
    `わくは 10こ。${a}こ うまって いるね。`,
    `${a}から 10まで かぞえよう。${a + 1}、…、10`,
  ];
  const explain = `${a}と ${b}で 10。あと ${b}で 10に なるよ。`;
  if (!alt)
    return {
      engine: 'number',
      id: `ato10:${a}`,
      objective: 'ato10',
      level,
      prompt: `${a}は あと いくつで 10？`,
      figure: { kind: 'blocks', ones: a, frame: true },
      hints,
      explain,
      explainFigure: cherry('10', String(a), String(b), `10は ${a}と ${b}`),
      identity: `ato10:${a}`,
      fields: [{ answer: { kind: 'int', value: b } }],
      wrongAnswers: wrongs.map((w) => ({ value: String(w.value), misconception: w.misconception })),
    };
  const options = numOptions([b, ...wrongs.slice(0, 4).map((w) => w.value)]);
  return {
    engine: 'fill',
    id: `ato10-alt:${a}`,
    objective: 'ato10',
    level,
    prompt: 'すうちょくせんで かんがえよう。{{}}に はいる かずは？',
    figure: {
      kind: 'numberline',
      min: 0,
      max: 10,
      step: 1,
      marks: [{ at: a, tone: 'focus' }],
    },
    text: `${a}と {{}}で 10`,
    options,
    blanks: [
      {
        answers: [String(b)],
        wrong: wrongs
          .filter((w) => options.includes(String(w.value)))
          .map((w) => ({
            value: String(w.value),
            misconception: w.misconception,
          })),
      },
    ],
    hints: [
      `すうちょくせんの ${a}の ところを みよう。`,
      `${a}から 10まで、めもりは いくつ あるかな。`,
      `${a + 1}、${a + 2 <= 10 ? `${a + 2}、` : ''}… と 10まで かぞえよう。`,
    ],
    explain,
    explainFigure: { kind: 'numberline', min: 0, max: 10, step: 1, jump: { from: a, to: 10 } },
    identity: `ato10:${a}`,
    alt: true,
  };
}

export function generateCompose10(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = lv.objs[(index + rng.int(0, lv.objs.length - 1)) % lv.objs.length]!;
  const alt = rng.next() < 0.25;
  if (obj === 'ato10') return ato10(level, rng.int(1, 9), alt);
  const [n, a] = pickSplit(rng, lv.max);
  switch (obj) {
    case 'bunkai':
      return splitNumber(level, n, a, alt);
    case 'gousei':
      return composeNumber(level, n, a, alt);
    case 'sakuranbo':
      return cherryFill(level, n, a, alt);
  }
}

export const composeTen: UnitSpec = {
  id: 'g1.math.compose-10',
  title: 'いくつと いくつ',
  stage: 'g1',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'math-split',
  prereq: ['g1.math.numbers-10'],
  objectives: [
    { id: 'bunkai', title: 'ひとつの かずを 2つに わける' },
    { id: 'gousei', title: '2つの かずを あわせる' },
    { id: 'sakuranbo', title: 'さくらんぼの ずで かんがえる' },
    { id: 'ato10', title: 'あと いくつで 10' },
  ],
  misconceptions: [
    {
      id: 'add-instead',
      explain:
        '2つの かずを たしたのかな。ぜんぶの かずから、わかって いる ぶんを のぞいた のこりを かんがえよう。',
    },
    {
      id: 'copy-part',
      explain: 'わかって いる ほうの かずを かいたのかな。もう かたほうの かずを さがそう。',
    },
    { id: 'whole', explain: 'ぜんぶの かずを かいたのかな。ぜんぶを 2つに わけた かたほうだよ。' },
    {
      id: 'off-by-one',
      explain: 'かぞえる ときに 1つ ずれたのかも。つぎの かずから ゆっくり かぞえよう。',
    },
    { id: 'sub-instead', explain: 'ちがいを かんがえたのかな。「あわせる」と かずは ふえるよ。' },
    { id: 'concat', explain: 'すうじを ならべて かいたのかな。2つを あわせた かずを かこう。' },
  ],
  levels: [
    { label: '5までの かず', chance: 0.05 },
    { label: '10までの かず（さくらんぼ）', chance: 0.05 },
    { label: 'あと いくつで 10', chance: 0.05 },
  ],
  intro: [
    {
      text: 'ブロックが 7こ あります。2つに わけて みよう。',
      figure: { kind: 'blocks', ones: 7, frame: true },
    },
    {
      text: '3こと 4こに わけられたね。「7は 3と 4」と いいます。',
      figure: {
        kind: 'row',
        items: [
          { kind: 'blocks', ones: 3, tone: 'a' },
          { kind: 'blocks', ones: 4, tone: 'b' },
        ],
        gap: 4,
      },
    },
    {
      text: 'さくらんぼの ずで かくと、うえが 7、したが 3と 4。',
      figure: cherry('7', '3', '4', '7は 3と 4'),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateCompose10(level, rng, index),
    domainSize: 54,
  },
  review: 'type',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第1学年 A(1) 数の構成（一つの数を他の数の和や差としてみる）',
  revised: REVISED,
};
