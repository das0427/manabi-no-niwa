/**
 * g2.math.add-sub-3digit 簡単な場合の3位数の加減（curriculum-matrix 3.5）。
 * 「簡単な場合」の範囲（本アプリの案）: 3位数 ± 1〜2位数で、繰り上がり・繰り下がりは1回まで、
 * 答えは 100〜999。何百・何十の計算（100・10 の いくつぶん）も扱う。
 *
 * 筆算は number の複数欄（ひゃく・じゅう・いち の3欄）で代用する。
 * 同一性キー: たし算は交換で同一視（小さい数+大きい数）。ひき算は式のまま。何百・何十の計算も式。
 * 定義域: 数千通り。
 */
import type { Rng } from '../../core/util/rng';
import type { Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { columnFigure, pickObj, placeFields, toFields, wrongList } from './util';

type Obj = 'add3' | 'sub3' | 'nanbyaku';

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['nanbyaku', 'add3'] },
  { objs: ['nanbyaku', 'add3', 'sub3'] },
];

const dg = (n: number) => [Math.floor(n / 100), Math.floor(n / 10) % 10, n % 10] as const;

function pickAdd(rng: Rng): [number, number] {
  for (;;) {
    const a = rng.int(100, 989);
    const b = rng.next() < 0.3 ? rng.int(1, 9) : rng.int(10, 99);
    const s = a + b;
    if (s > 999) continue;
    const c1 = (a % 10) + (b % 10) >= 10 ? 1 : 0;
    const c2 = (Math.floor(a / 10) % 10) + Math.floor(b / 10) + c1 >= 10 ? 1 : 0;
    if (c1 + c2 <= 1) return [a, b];
  }
}

function pickSub(rng: Rng): [number, number] {
  for (;;) {
    const a = rng.int(110, 999);
    const b = rng.next() < 0.3 ? rng.int(1, 9) : rng.int(10, 99);
    const d = a - b;
    if (d < 100) continue;
    const [, at, ao] = dg(a);
    const b1 = b % 10;
    const b10 = Math.floor(b / 10);
    const br1 = ao < b1 ? 1 : 0;
    const br2 = at - br1 < b10 ? 1 : 0;
    // 1回まで。0から かりる（2回つづけて かりる）ものは 3年へ
    if (br1 + br2 <= 1 && !(br1 && at === 0)) return [a, b];
  }
}

function addWrongs(a: number, b: number, n: number): NumberItem['wrongAnswers'] {
  const s = a + b;
  const [ah, at, ao] = dg(a);
  const b1 = b % 10;
  const b10 = Math.floor(b / 10);
  const c1 = ao + b1 >= 10;
  const c2 = at + b10 + (c1 ? 1 : 0) >= 10;
  const f = (v: number) => (n === 1 ? String(v) : toFields(v, n));
  const noCarry = c1
    ? ah * 100 + (at + b10) * 10 + ((ao + b1) % 10)
    : c2
      ? ah * 100 + ((at + b10) % 10) * 10 + ao + b1
      : null;
  // 2位数を ひゃく・じゅう の くらいに ずらして かいた
  const misalign = a + b * 10;
  return wrongList(n === 1 ? String(s) : toFields(s, n)!, n, [
    [noCarry !== null ? f(noCarry) : null, 'no-carry'],
    [misalign <= 999 ? f(misalign) : null, 'misalign'],
    [f(a - b), 'sub-instead'],
  ]);
}

function subWrongs(a: number, b: number, n: number): NumberItem['wrongAnswers'] {
  const d = a - b;
  const [ah, at, ao] = dg(a);
  const b1 = b % 10;
  const b10 = Math.floor(b / 10);
  const br1 = ao < b1;
  const br2 = at - (br1 ? 1 : 0) < b10;
  const f = (v: number) => (n === 1 ? String(v) : toFields(v, n));
  const bigSmall = br1
    ? ah * 100 + (at - b10) * 10 + (b1 - ao)
    : br2
      ? ah * 100 + (b10 - at) * 10 + (ao - b1)
      : null;
  const noDec = br1
    ? ah * 100 + (at - b10) * 10 + (10 + ao - b1)
    : br2
      ? ah * 100 + (10 + at - b10) * 10 + ao - b1
      : null;
  const misalign = a - b * 10;
  return wrongList(n === 1 ? String(d) : toFields(d, n)!, n, [
    [bigSmall !== null ? f(bigSmall) : null, 'bigger-minus-smaller'],
    [noDec !== null && noDec <= 999 ? f(noDec) : null, 'no-decrement'],
    [misalign >= 0 ? f(misalign) : null, 'misalign'],
    [a + b <= 999 ? f(a + b) : null, 'add-instead'],
  ]);
}

function addHints(a: number, b: number): string[] {
  const [ah, at, ao] = dg(a);
  const b1 = b % 10;
  const b10 = Math.floor(b / 10);
  const c1 = ao + b1 >= 10;
  return [
    'くらいを たてに そろえて、いちの くらいから けいさん しよう。',
    `いちの くらいは ${ao} ＋ ${b1} ＝ ${ao + b1}${c1 ? '。1 くりあげよう' : ''}。`,
    `じゅうの くらいは ${c1 ? '1 ＋ ' : ''}${at} ＋ ${b10}。${at + b10 + (c1 ? 1 : 0) >= 10 ? '10を こえたら ひゃくの くらいへ 1 くりあげる。' : ''}ひゃくの くらいは ${ah}${at + b10 + (c1 ? 1 : 0) >= 10 ? ' ＋ 1' : ' の まま'}。`,
  ];
}

function subHints(a: number, b: number): string[] {
  const [ah, at, ao] = dg(a);
  const b1 = b % 10;
  const b10 = Math.floor(b / 10);
  const br1 = ao < b1;
  const at2 = at - (br1 ? 1 : 0);
  const br2 = at2 < b10;
  return [
    'くらいを たてに そろえて、いちの くらいから けいさん しよう。',
    br1
      ? `いちの くらいは ${ao} − ${b1} が できないので、じゅうの くらいから 10 かりて ${10 + ao} − ${b1}。`
      : `いちの くらいは ${ao} − ${b1}。`,
    br2
      ? `じゅうの くらいは ${at2} − ${b10} が できないので、ひゃくの くらいから 10 かりて ${10 + at2} − ${b10}。ひゃくの くらいは ${ah - 1}。`
      : `じゅうの くらいは ${at2} − ${b10}。ひゃくの くらいは ${ah} の まま。`,
  ];
}

function calcItem(
  obj: 'add3' | 'sub3',
  level: number,
  a: number,
  b: number,
  alt: boolean,
): NumberItem {
  const add = obj === 'add3';
  const ans = add ? a + b : a - b;
  const op = add ? '＋' : '−';
  const hints = add ? addHints(a, b) : subHints(a, b);
  const identity = add ? `${a}+${b}` : `${a}-${b}`;
  const explain = `${hints[1]!} ${hints[2]!} こたえは ${ans} です。`;
  if (alt)
    return {
      engine: 'number',
      id: `${obj}-alt:${identity}`,
      objective: obj,
      level,
      prompt: 'けいさん しよう。',
      figure: { kind: 'text', text: `${a} ${op} ${b} ＝ {{}}`, size: 'xl' },
      hints,
      explain,
      explainFigure: columnFigure(a, b, op, 3),
      identity,
      alt: true,
      fields: [{ answer: { kind: 'int', value: ans } }],
      wrongAnswers: add ? addWrongs(a, b, 1) : subWrongs(a, b, 1),
    };
  const fields = placeFields(ans);
  return {
    engine: 'number',
    id: `${obj}:${identity}`,
    objective: obj,
    level,
    prompt: 'ひっさんで けいさん しよう。こたえを くらいごとに かこう。',
    figure: columnFigure(a, b, op, fields.length),
    hints,
    explain,
    identity,
    alt: false,
    fields,
    wrongAnswers: add ? addWrongs(a, b, fields.length) : subWrongs(a, b, fields.length),
  };
}

/** 何百・何十の計算（100・10 の いくつぶん） */
function nanbyaku(level: number, rng: Rng, alt: boolean): NumberItem {
  const unit = rng.next() < 0.5 ? 100 : 10;
  const add = rng.next() < 0.5;
  let x: number;
  let y: number;
  if (unit === 100) {
    do {
      x = rng.int(1, 9);
      y = rng.int(1, 9);
    } while (add ? x + y > 10 : x <= y);
  } else {
    // 何十 ± 何十（答えが 100 を こえる・100 から ひく）
    do {
      x = rng.int(1, 19);
      y = rng.int(1, 9);
    } while (add ? x + y < 10 || x > 9 || x + y > 18 : x < 10 || x - y >= 10);
  }
  const a = x * unit;
  const b = y * unit;
  const ans = add ? a + b : a - b;
  const k = add ? x + y : x - y;
  const op = add ? '＋' : '−';
  const word = unit === 100 ? '100' : '10';
  return {
    engine: 'number',
    id: `nanbyaku${alt ? '-alt' : ''}:${a}${add ? '+' : '-'}${b}`,
    objective: 'nanbyaku',
    level,
    prompt: alt
      ? `${word}の まとまりで かんがえよう。${word}が ${x}こと ${y}こ。${add ? 'あわせると' : `${x}こから ${y}こ とると`} いくつ？`
      : 'けいさん しよう。',
    figure: alt
      ? {
          kind: 'blocks',
          hundreds: unit === 100 ? Math.min(x, 9) : 0,
          tens: unit === 10 ? x : 0,
          ones: 0,
        }
      : { kind: 'text', text: `${a} ${op} ${b} ＝ {{}}`, size: 'xl' },
    hints: [
      `${word}の まとまりが いくつ あるか かんがえよう。`,
      `${a}は ${word}が ${x}こ、${b}は ${word}が ${y}こ。`,
      `${word}が ${x} ${op} ${y} ＝ ${k}こ。${word}が ${k}こ だと…`,
    ],
    explain: `${word}が ${x} ${op} ${y} ＝ ${k}こで ${ans}。${a} ${op} ${b} ＝ ${ans} です。`,
    identity: `${a}${add ? '+' : '-'}${b}`,
    alt,
    fields: [{ answer: { kind: 'int', value: ans } }],
    wrongAnswers: wrongList(String(ans), 1, [
      [k, 'drop-zeros'],
      [ans * 10, 'extra-zero'],
    ]),
  };
}

export function generateAddSub3(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.25;
  if (obj === 'nanbyaku') return nanbyaku(level, rng, alt);
  const [a, b] = obj === 'add3' ? pickAdd(rng) : pickSub(rng);
  return calcItem(obj, level, a, b, alt);
}

export const addSub3digit: UnitSpec = {
  id: 'g2.math.add-sub-3digit',
  title: '3けたの たしざんと ひきざん',
  stage: 'g2',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'math-add',
  prereq: ['g2.math.sub-column'],
  objectives: [
    { id: 'nanbyaku', title: '100や 10の まとまりで けいさん' },
    { id: 'add3', title: '3けた ＋ 2けた の ひっさん' },
    { id: 'sub3', title: '3けた − 2けた の ひっさん' },
  ],
  misconceptions: [
    {
      id: 'no-carry',
      explain: 'くりあげた 1を たすのを わすれたのかな。10が できたら となりの くらいに 1 たすよ。',
    },
    {
      id: 'bigger-minus-smaller',
      explain:
        'おおきい ほうから ちいさい ほうを ひいたのかな。うえの かずから ひけない ときは、となりの くらいから 10 かりるよ。',
    },
    {
      id: 'no-decrement',
      explain: '10 かりたのに、かした くらいを 1 へらすのを わすれたのかな。',
    },
    {
      id: 'misalign',
      explain:
        'くらいが ずれたのかな。2けたの かずは、じゅうの くらいと いちの くらいの したに そろえて かこう。',
      figure: columnFigure(356, 27, '＋', 3),
    },
    {
      id: 'drop-zeros',
      explain:
        '100（10）の まとまりの かずだけ かいたのかな。100が 8こは 800。0を わすれずに かこう。',
    },
    {
      id: 'extra-zero',
      explain: '0を おおく つけたのかな。100が 8こは 800 だよ。',
    },
    {
      id: 'sub-instead',
      explain: 'ひきざんを したのかな。しるしを よく みよう。',
    },
    {
      id: 'add-instead',
      explain: 'たしざんを したのかな。しるしを よく みよう。',
    },
  ],
  levels: [
    { label: 'なんびゃく・たしざん', chance: 0.02 },
    { label: 'たしざん・ひきざん', chance: 0.02 },
  ],
  intro: [
    {
      text: '300 ＋ 500 は、100が 3こと 5こで 8こ。だから 800。',
      figure: { kind: 'blocks', hundreds: 3, ones: 0 },
    },
    {
      text: '356 ＋ 27 も ひっさんで できます。くらいを たてに そろえて かきます。',
      figure: columnFigure(356, 27, '＋', 3),
    },
    {
      text: 'いちの くらい 6 ＋ 7 ＝ 13。3を かいて 1 くりあげ。じゅうの くらい 1 ＋ 5 ＋ 2 ＝ 8。ひゃくの くらいは 3。こたえは 383。',
      figure: { kind: 'text', text: '356 ＋ 27 ＝ 383', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateAddSub3(level, rng, index),
  },
  review: 'type',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第2学年 A(2) 加法・減法（簡単な場合の3位数の加法・減法）。「簡単な場合」の範囲（繰り上がり・繰り下がり1回まで）は本アプリの案',
  revised: '2026-10-24',
};
