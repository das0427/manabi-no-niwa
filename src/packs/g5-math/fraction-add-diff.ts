/**
 * g5.math.fraction-add-diff 分母のちがう分数のたし算・ひき算（帯分数・3つの分数を含む）（curriculum-matrix 3.8）。
 *
 * 答えは約分して答える（mustReduce: 約分しきっていない等しい分数は「もう少し」）。仮分数・帯分数はどちらでも正。
 * 同一性キー: 式（たし算の交換は同じ。交換法則はこの単元の学習内容ではない）。文章題は 場面 × 式。
 */
import type { NumberAnswer } from '../../core/answer/number';
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { expr, finishUnit, gcd, lcm, pick, pickObj, REVISED, wrongList } from './util';

type Obj = 'addP' | 'subP' | 'mixed' | 'story';

const F = (n: number, d: number) => `[[${n}/${d}]]`;
/** 値 n/d（d は分母）の表示。整数・帯分数にできるときは その形 */
function show(n: number, d: number): string {
  const g = gcd(n, d);
  n /= g;
  d /= g;
  if (n % d === 0) return String(n / d);
  if (n > d) return `[[${Math.floor(n / d)} ${n % d}/${d}]]`;
  return `[[${n}/${d}]]`;
}
/** 帯分数の表示（約分しない。w と r/d） */
const mixedText = (w: number, r: number, d: number) => (w === 0 ? F(r, d) : `[[${w} ${r}/${d}]]`);

/** 約分した答え */
function ansOf(n: number, d: number): NumberAnswer {
  const g = gcd(n, d);
  return { kind: 'fraction', num: n / g, den: d / g, mustReduce: true };
}

const reduceNote = (n: number, d: number) => {
  const g = gcd(n, d);
  if (n % d === 0) return `${F(n, d)} ＝ ${n / d}`;
  if (g > 1) return `${F(n, d)}を 約分して ${show(n, d)}`;
  return n > d ? `${F(n, d)} ＝ ${show(n, d)}` : F(n, d);
};

/** 既約の真分数 */
const PROPER: [number, number][] = [];
for (let b = 2; b <= 10; b++) for (let a = 1; a < b; a++) if (gcd(a, b) === 1) PROPER.push([a, b]);

/** 分母のちがう 2つの真分数の組（lcm ≤ 40） */
const ADD: [[number, number], [number, number]][] = [];
const SUB: [[number, number], [number, number]][] = [];
for (const p of PROPER)
  for (const q of PROPER) {
    if (p[1] === q[1] || lcm(p[1], q[1]) > 40) continue;
    if (p[1] < q[1]) ADD.push([p, q]);
    if (p[0] * q[1] > q[0] * p[1]) SUB.push([p, q]);
  }

interface Q {
  a: number;
  b: number;
  c: number;
  d: number;
  op: '+' | '−';
}

function solve(q: Q) {
  const L = lcm(q.b, q.d);
  const A = (q.a * L) / q.b;
  const C = (q.c * L) / q.d;
  const N = q.op === '+' ? A + C : A - C;
  return { L, A, C, N };
}

function pickQ(rng: Rng, op: '+' | '−'): Q {
  if (op === '+') {
    let [[a, b], [c, d]] = pick(rng, ADD);
    if (rng.next() < 0.5) [[a, b], [c, d]] = [[c, d], [a, b]];
    return { a, b, c, d, op };
  }
  const [[a, b], [c, d]] = pick(rng, SUB);
  return { a, b, c, d, op };
}

const keyOf = (q: Q) =>
  q.op === '+' ? [`${q.a}/${q.b}`, `${q.c}/${q.d}`].sort().join('+') : `${q.a}/${q.b}-${q.c}/${q.d}`;

function wrongsOf(q: Q, answers: NumberAnswer[]) {
  const { L, N } = solve(q);
  const add = q.op === '+';
  return wrongList(answers, [
    [add ? `${q.a + q.c}/${q.b + q.d}` : q.a > q.c && q.b > q.d ? `${q.a - q.c}/${q.b - q.d}` : null, 'add-den'],
    [add ? `${q.a + q.c}/${L}` : q.a > q.c ? `${q.a - q.c}/${L}` : null, 'num-only'],
    [add ? `${q.a * q.d + q.c * q.b}/${q.b + q.d}` : null, 'add-den'],
    [!add ? `${solve({ ...q, op: '+' }).N}/${L}` : `${Math.abs(solve({ ...q, op: '−' }).N)}/${L}`, 'op-swap'],
    [N > 0 ? `${N}/${q.b * q.d === L ? L * 2 : q.b * q.d}` : null, 'num-only'],
  ]);
}

function hintsOf(q: Q, verb: string): string[] {
  const { L, A, C } = solve(q);
  return [
    '分母が ちがうので、まず 通分して 分母を そろえよう。',
    `${q.b}と ${q.d}の 最小公倍数 ${L}で 通分すると、${F(A, L)} ${q.op} ${F(C, L)}。`,
    `分子どうしを ${verb}（${A} ${q.op} ${C}）。答えが 約分できるか たしかめよう。`,
  ];
}

function explainOf(q: Q): string {
  const { L, A, C, N } = solve(q);
  return `${F(q.a, q.b)} ${q.op} ${F(q.c, q.d)} ＝ ${F(A, L)} ${q.op} ${F(C, L)} ＝ ${reduceNote(N, L)}。通分してから 分子どうしを 計算し、さいごに 約分します。`;
}

function basic(obj: 'addP' | 'subP', level: number, rng: Rng, alt: boolean): NumberItem {
  const q = pickQ(rng, obj === 'addP' ? '+' : '−');
  const { L, N } = solve(q);
  const answers = [ansOf(N, L)];
  const key = keyOf(q);
  return {
    engine: 'number',
    id: `${obj}${alt ? '-alt' : ''}:${q.a}/${q.b}${q.op}${q.c}/${q.d}`,
    objective: obj,
    level,
    prompt: alt
      ? obj === 'addP'
        ? `${F(q.a, q.b)}より ${F(q.c, q.d)} 大きい 数は いくつですか。約分できる ときは 約分して 答えましょう。`
        : `${F(q.a, q.b)}と ${F(q.c, q.d)}の 差は いくつですか。約分できる ときは 約分して 答えましょう。`
      : '計算しましょう。約分できる ときは 約分して 答えましょう。',
    figure: alt ? undefined : expr(`${F(q.a, q.b)} ${q.op} ${F(q.c, q.d)} ＝ {{}}`),
    hints: alt
      ? [
          obj === 'addP' ? '「より 〜 大きい 数」は たし算で 求めるよ。' : '「差」は 大きい 数から 小さい 数を ひいて 求めるよ。',
          ...hintsOf(q, obj === 'addP' ? 'たそう' : 'ひこう').slice(1),
        ]
      : hintsOf(q, obj === 'addP' ? 'たそう' : 'ひこう'),
    explain: explainOf(q),
    identity: alt ? `${key}:words` : key,
    alt,
    fields: [{ answer: answers[0]! }],
    keys: ['fraction'],
    wrongAnswers: wrongsOf(q, answers),
  };
}

/** 帯分数を含む計算（alt: 3つの真分数） */
function mixed(level: number, rng: Rng, alt: boolean): NumberItem {
  if (alt) {
    for (;;) {
      const f = [pick(rng, PROPER), pick(rng, PROPER), pick(rng, PROPER)];
      const L = f.reduce((s, [, d]) => lcm(s, d), 1);
      if (L > 24 || new Set(f.map(([, d]) => d)).size < 2) continue;
      const ops: ('+' | '−')[] = [rng.next() < 0.5 ? '+' : '−', rng.next() < 0.5 ? '+' : '−'];
      const nums = f.map(([a, d]) => (a * L) / d);
      let N = nums[0]!;
      let ok = true;
      for (let i = 0; i < 2; i++) {
        N = ops[i] === '+' ? N + nums[i + 1]! : N - nums[i + 1]!;
        if (N <= 0) ok = false;
      }
      if (!ok) continue;
      const text = `${F(...f[0]!)} ${ops[0]} ${F(...f[1]!)} ${ops[1]} ${F(...f[2]!)}`;
      const answers = [ansOf(N, L)];
      const sumNum = f.reduce((s, [a]) => s + a, 0);
      const sumDen = f.reduce((s, [, d]) => s + d, 0);
      return {
        engine: 'number',
        id: `mixed-3:${f.map(([a, d]) => `${a}/${d}`).join(ops.join(''))}`,
        objective: 'mixed',
        level,
        prompt: '3つの 分数の 計算を しましょう。約分できる ときは 約分して 答えましょう。',
        figure: expr(`${text} ＝ {{}}`),
        hints: [
          '3つの 分母を いっしょに 通分すると、まとめて 計算できるよ。',
          `3つの 分母の 最小公倍数 ${L}で 通分すると、${nums.map((n, i) => `${i ? `${ops[i - 1]} ` : ''}${F(n, L)}`).join(' ')}。`,
          `分子を 左から 順に 計算しよう（${nums[0]} ${ops[0]} ${nums[1]} ${ops[1]} ${nums[2]}）。約分も わすれずに。`,
        ],
        explain: `${text} ＝ ${nums.map((n, i) => `${i ? `${ops[i - 1]} ` : ''}${F(n, L)}`).join(' ')} ＝ ${reduceNote(N, L)}です。`,
        identity: `three:${f.map(([a, d]) => `${a}/${d}`).join(ops.join(''))}`,
        alt: true,
        fields: [{ answer: answers[0]! }],
        keys: ['fraction'],
        wrongAnswers: wrongList(answers, [
          [ops.every((o) => o === '+') ? `${sumNum}/${sumDen}` : null, 'add-den'],
        ]),
      };
    }
  }
  for (;;) {
    const b = rng.int(2, 9);
    const d = rng.int(2, 9);
    if (b === d || lcm(b, d) > 36) continue;
    const ra = rng.int(1, b - 1);
    const rb = rng.int(1, d - 1);
    if (gcd(ra, b) !== 1 || gcd(rb, d) !== 1) continue;
    const add = rng.next() < 0.5;
    const wa = add ? rng.int(1, 3) : rng.int(1, 4);
    const wb = add ? rng.int(0, 2) : rng.int(0, wa - 1);
    const L = lcm(b, d);
    const RA = (ra * L) / b;
    const RB = (rb * L) / d;
    const VA = wa * L + RA;
    const VB = wb * L + RB;
    const N = add ? VA + VB : VA - VB;
    if (N <= 0) continue;
    const op = add ? '＋' : '−';
    const text = `${mixedText(wa, ra, b)} ${op} ${mixedText(wb, rb, d)}`;
    const answers = [ansOf(N, L)];
    const borrow = !add && RA < RB;
    const cands: [string | null, string][] = [];
    // 整数の部分を わすれた
    cands.push([add ? `${RA + RB}/${L}` : null, 'whole-drop']);
    if (add) cands.push([`${wa + wb}と${ra + rb}/${b + d}`, 'add-den']);
    // くり下がりで、分数部分を 大きい ほうから ひいた
    if (borrow) cands.push([`${wa - wb}と${RB - RA}/${L}`, 'no-borrow']);
    // くり下げたのに 整数を へらさなかった
    if (borrow) cands.push([`${wa - wb}と${L + RA - RB}/${L}`, 'no-borrow']);
    if (!add && !borrow) cands.push([`${RA - RB}/${L}`, 'whole-drop']);
    return {
      engine: 'number',
      id: `mixed:${text}`,
      objective: 'mixed',
      level,
      prompt: '帯分数の 計算を しましょう。約分できる ときは 約分して 答えましょう。',
      figure: expr(`${text} ＝ {{}}`),
      hints: [
        '整数の 部分と 分数の 部分に 分けて 計算できるよ。分数の 部分は 通分しよう。',
        `${b}と ${d}の 最小公倍数 ${L}で 通分すると、${mixedText(wa, RA, L)} ${op} ${mixedText(wb, RB, L)}。`,
        borrow
          ? `分数の 部分が ひけないので、整数から 1 くり下げて ${mixedText(wa - 1, L + RA, L)} ${op} ${mixedText(wb, RB, L)}と 考えよう。`
          : add
            ? `整数どうし（${wa} ＋ ${wb}）と 分子どうし（${RA} ＋ ${RB}）を たそう。分数の 部分が 1を こえたら 整数に くり上げよう。`
            : `整数どうし（${wa} − ${wb}）と 分子どうし（${RA} − ${RB}）を ひこう。約分も わすれずに。`,
      ],
      explain: `${text} ＝ ${mixedText(wa, RA, L)} ${op} ${mixedText(wb, RB, L)}${borrow ? ` ＝ ${mixedText(wa - 1, L + RA, L)} − ${mixedText(wb, RB, L)}` : ''} ＝ ${show(N, L)}です。${gcd(N, L) > 1 ? '（さいごに 約分しました）' : ''}`,
      identity: `mixed:${add ? [mixedText(wa, ra, b), mixedText(wb, rb, d)].sort().join('+') : text}`,
      alt: false,
      fields: [{ answer: answers[0]! }],
      keys: ['fraction'],
      wrongAnswers: wrongList(answers, cands),
    };
  }
}

interface Scene {
  id: string;
  op: '+' | '−';
  unit: string;
  text: (x: string, y: string) => string;
}
const SCENES: Scene[] = [
  { id: 'juice', op: '+', unit: 'L', text: (x, y) => `ジュースを きのう ${x}L、きょう ${y}L 飲みました。合わせて 何L 飲みましたか。` },
  { id: 'ribbon', op: '+', unit: 'm', text: (x, y) => `赤い リボンが ${x}m、青い リボンが ${y}m あります。合わせて 何mですか。` },
  { id: 'walk', op: '+', unit: 'km', text: (x, y) => `家から 公園まで ${x}km、公園から 図書館まで ${y}kmです。家から 公園を 通って 図書館まで 何kmですか。` },
  { id: 'sand', op: '+', unit: 'kg', text: (x, y) => `すなが ${x}kg 入った バケツに、${y}kgの すなを 入れました。すなは 全部で 何kgに なりましたか。` },
  { id: 'water', op: '−', unit: 'L', text: (x, y) => `水が ${x}L あります。そのうち ${y}L 使いました。残りは 何Lですか。` },
  { id: 'rope', op: '−', unit: 'm', text: (x, y) => `${x}mの ロープから ${y}m 切り取りました。残りは 何mですか。` },
  { id: 'tape', op: '−', unit: 'm', text: (x, y) => `赤い テープは ${x}m、白い テープは ${y}mです。赤い テープは 白い テープより 何m 長いですか。` },
  { id: 'study', op: '−', unit: '時間', text: (x, y) => `きのうは ${x}時間、きょうは ${y}時間 本を 読みました。きのうは きょうより 何時間 長く 読みましたか。` },
];

function story(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, SCENES);
  const q = pickQ(rng, sc.op);
  const { L, N } = solve(q);
  const answers = [ansOf(N, L)];
  const fig: Figure | undefined = alt
    ? sc.op === '+'
      ? {
          kind: 'tape',
          parts: [
            { length: q.a * q.d * 4, label: `${F(q.a, q.b)}${sc.unit}`, tone: 'a' },
            { length: q.c * q.b * 4, label: `${F(q.c, q.d)}${sc.unit}`, tone: 'b' },
          ],
          total: '？',
        }
      : {
          kind: 'tape',
          parts: [
            { length: q.c * q.b * 4, label: `${F(q.c, q.d)}${sc.unit}`, tone: 'b' },
            { length: (q.a * q.d - q.c * q.b) * 4, label: '？', tone: 'focus' },
          ],
          total: `${F(q.a, q.b)}${sc.unit}`,
        }
    : undefined;
  return {
    engine: 'number',
    id: `story${alt ? '-alt' : ''}:${sc.id}:${q.a}/${q.b}${q.op}${q.c}/${q.d}`,
    objective: 'story',
    level,
    prompt: `${sc.text(F(q.a, q.b), F(q.c, q.d))}約分できる ときは 約分して 答えましょう。`,
    figure: fig,
    hints: [
      sc.op === '+'
        ? '「合わせて」「全部で」は たし算だね。'
        : '「残り」「ちがい（何m 長い）」は ひき算だね。',
      `式は ${F(q.a, q.b)} ${q.op} ${F(q.c, q.d)}。分母が ちがうので 通分しよう。`,
      `分母を ${L}に そろえて、分子どうしを ${sc.op === '+' ? 'たそう' : 'ひこう'}。約分も わすれずに。`,
    ],
    explain: `${explainOf(q)}答えは ${show(N, L)}${sc.unit}です。`,
    identity: `story:${sc.id}:${keyOf(q)}${alt ? ':tape' : ''}`,
    alt,
    fields: [{ label: sc.unit, answer: answers[0]! }],
    keys: ['fraction'],
    wrongAnswers: wrongsOf(q, answers),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['addP', 'subP'] },
  { objs: ['mixed', 'story', 'addP', 'subP'] },
  { objs: ['addP', 'subP', 'mixed', 'story'] },
];

export function generateFractionAddDiff(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'addP':
    case 'subP':
      return basic(obj, level, rng, alt);
    case 'mixed':
      return mixed(level, rng, alt);
    case 'story':
      return story(level, rng, alt);
  }
}

export const fractionAddDiff: UnitSpec = finishUnit(
  {
    id: 'g5.math.fraction-add-diff',
    title: '分母の ちがう 分数の たし算・ひき算',
    stage: 'g5',
    subject: 'math',
    domain: 'A-number',
    kind: 'calc',
    priority: 'P1',
    status: 'ready',
    icon: 'math-split',
    prereq: ['g5.math.fraction-equiv'],
    objectives: [
      { id: 'addP', title: '分母の ちがう 分数の たし算' },
      { id: 'subP', title: '分母の ちがう 分数の ひき算' },
      { id: 'mixed', title: '帯分数や 3つの 分数の 計算' },
      { id: 'story', title: '文章題' },
    ],
    misconceptions: [
      {
        id: 'add-den',
        explain:
          '分母どうし・分子どうしを そのまま 計算したのかな。[[1/2]] ＋ [[1/3]]は [[2/5]]には ならないよ（[[2/5]]は [[1/2]]より 小さいね）。通分して 分母を そろえてから、分子どうしを 計算しよう。',
      },
      {
        id: 'num-only',
        explain:
          '分母を そろえたけれど、分子を 直さなかったのかな。通分するときは、分母に かけた 数を 分子にも かけるよ。',
      },
      {
        id: 'op-swap',
        explain: 'たし算と ひき算を 反対に したのかな。式の 記号（＋・−）を もう一度 見よう。',
      },
      {
        id: 'whole-drop',
        explain: '帯分数の 整数の 部分を わすれたのかな。整数どうしも 計算しよう。',
      },
      {
        id: 'no-borrow',
        explain:
          '分数の 部分が ひけない ときの くり下がりかな。整数から 1を くり下げて 分数に たしてから ひこう。くり下げたら 整数は 1 へるよ。',
      },
    ],
    levels: [
      { label: '真分数の たし算・ひき算', chance: 0.02 },
      { label: '帯分数・文章題', chance: 0.02 },
      { label: 'まとめ', chance: 0.02 },
    ],
    intro: [
      {
        text: '[[1/2]] ＋ [[1/3]]は、分母が ちがうので そのままでは たせません。2と 3の 最小公倍数 6で 通分します。',
        figure: expr('[[1/2]] ＋ [[1/3]] ＝ [[3/6]] ＋ [[2/6]]'),
      },
      {
        text: '分母が そろったら、分子どうしを たします。[[3/6]] ＋ [[2/6]] ＝ [[5/6]]。',
        figure: {
          kind: 'tape',
          parts: [
            { length: 3, label: '[[3/6]]', tone: 'a' },
            { length: 2, label: '[[2/6]]', tone: 'b' },
            { length: 1 },
          ],
          total: '1',
        },
      },
      {
        text: '答えが 約分できる ときは 約分します。[[1/6]] ＋ [[1/2]] ＝ [[1/6]] ＋ [[3/6]] ＝ [[4/6]] ＝ [[2/3]]。',
        figure: expr('[[4/6]] ＝ [[2/3]]'),
      },
      {
        text: '帯分数は、整数の 部分と 分数の 部分に 分けて 計算します。分数の 部分が ひけない ときは、整数から 1 くり下げます。',
        figure: expr('[[2 1/4]] − [[1/2]] ＝ [[1 5/4]] − [[2/4]] ＝ [[1 3/4]]'),
      },
    ],
    source: {
      kind: 'generator',
      generate: ({ level, rng, index }) => generateFractionAddDiff(level, rng, index),
    },
    review: 'type',
    basis: '小学校学習指導要領（平成29年告示）算数 第5学年 A(5) 分数の加法・減法（異分母の分数の加法及び減法）',
    revised: REVISED,
  },
  '入《はい》った 飲《の》みました 飲《の》 青《あお》い 赤《あか》い 白《しろ》い 図書館《としょかん》 記号《きごう》 切《き》り取《と》りました',
);
