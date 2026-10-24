/**
 * g5.math.multiples-divisors 偶数・奇数、倍数・約数、公倍数・公約数（curriculum-matrix 3.8）。
 * 指導要領の取扱い「形式的に求めることに偏らない」に合わせ、数直線・場面（バスの出発・分け方・しきつめ）も使う。
 *
 * 同一性キー: 問う形 × 数（公倍数・公約数は 2つの数の組。入れかえは同じ）。場面の問題は 場面 × 数。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, ChoiceOption, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { expr, finishUnit, gcd, lcm, pick, pickObj, REVISED, wrongList } from './util';

type Obj = 'evenodd' | 'multiple' | 'divisor' | 'lcm' | 'gcd';

const divisorsOf = (n: number) => Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** 数直線（0〜max）に、ある数の倍数の印 */
function multLine(n: number, max: number, upto: number): Figure {
  return {
    kind: 'numberline',
    min: 0,
    max,
    step: 1,
    labelEvery: max > 40 ? 10 : 5,
    marks: range(1, Math.floor(upto / n)).map((k) => ({ at: k * n, tone: 'focus' as const })),
  };
}

// ---- 偶数・奇数 ----
const EO_NUMS = range(11, 199);

function evenodd(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    // 6つの数から 奇数（または偶数）を すべて選ぶ
    const wantOdd = rng.next() < 0.5;
    const nums = rng.sample(range(10, 99), 6).sort((a, b) => a - b);
    if (!nums.some((x) => (x % 2 === 1) === wantOdd)) nums[0] = wantOdd ? 11 : 12;
    if (nums.every((x) => (x % 2 === 1) === wantOdd)) nums[5] = wantOdd ? 98 : 99;
    const uniq = [...new Set(nums)].sort((a, b) => a - b);
    const word = wantOdd ? '奇数' : '偶数';
    const item: ChoiceItem = {
      engine: 'choice',
      id: `evenodd-alt:${wantOdd ? 'odd' : 'even'}:${uniq.join(',')}`,
      objective: 'evenodd',
      level,
      prompt: `${word}を すべて 選ぼう。`,
      hints: [
        '2で わりきれる 整数が 偶数、わりきれない 整数が 奇数だよ。',
        '一の位の 数字を 見よう。0・2・4・6・8なら 偶数。',
        `一の位が ${wantOdd ? '1・3・5・7・9' : '0・2・4・6・8'}の 数を さがそう。`,
      ],
      explain: `一の位が ${wantOdd ? '1・3・5・7・9' : '0・2・4・6・8'}の 数が ${word}です。${word}は ${uniq.filter((x) => (x % 2 === 1) === wantOdd).join('、')}。`,
      identity: `evenodd-pick:${wantOdd ? 'odd' : 'even'}:${uniq.join(',')}`,
      alt: true,
      multi: true,
      fixedOrder: true,
      layout: 'grid',
      options: uniq.map((x) =>
        (x % 2 === 1) === wantOdd ? { label: String(x), correct: true } : { label: String(x), misconception: 'tens-digit' },
      ),
    };
    return item;
  }
  const n = pick(rng, EO_NUMS);
  const odd = n % 2 === 1;
  // 十の位で 決めると 逆に なる数を 選ぶと 誤概念が はっきりする（どちらも出る）
  const tensOdd = Math.floor(n / 10) % 2 === 1;
  const item: ChoiceItem = {
    engine: 'choice',
    id: `evenodd:${n}`,
    objective: 'evenodd',
    level,
    prompt: `${n}は 偶数ですか、奇数ですか。`,
    figure: expr(String(n)),
    hints: [
      '2で わりきれるかどうかで 分けるよ。',
      '一の位の 数字だけ 見れば 分かるよ。',
      `${n}の 一の位は ${n % 10}。${n % 10}は 2で わりきれるかな。`,
    ],
    explain: `${n}の 一の位は ${n % 10}なので、2で ${odd ? 'わりきれません' : 'わりきれます'}。${n}は ${odd ? '奇数' : '偶数'}です。`,
    identity: `evenodd:${n}`,
    alt: false,
    fixedOrder: true,
    options: [
      odd
        ? { label: '偶数', misconception: tensOdd !== odd ? 'tens-digit' : 'even-odd-def' }
        : { label: '偶数', correct: true },
      odd
        ? { label: '奇数', correct: true }
        : { label: '奇数', misconception: tensOdd !== odd ? 'tens-digit' : 'even-odd-def' },
    ],
  };
  return item;
}

// ---- 倍数 ----
function multiple(level: number, rng: Rng, alt: boolean): Item {
  const n = rng.int(2, 12);
  if (alt) {
    // 数直線を見て、倍数を すべて選ぶ
    const max = n * 6 <= 40 ? 40 : 80;
    const cands = range(Math.max(2, n - 2), max);
    const correctSet = cands.filter((x) => x % n === 0 && x <= max);
    const right = rng.sample(correctSet, Math.min(3, correctSet.length));
    const wrongPool = cands.filter((x) => x % n !== 0);
    // 約数（n の約数）は「倍数と約数の取り違え」、ほかは「たし算の数え方」
    const divs = divisorsOf(n).filter((d) => d > 1 && d < n);
    const wrongs = [...(divs.length ? [pick(rng, divs)] : []), ...rng.sample(wrongPool, 3)];
    const all = [...new Set([...right, ...wrongs])].sort((a, b) => a - b).slice(0, 7);
    if (!all.some((x) => x % n === 0)) all[0] = n;
    const item: ChoiceItem = {
      engine: 'choice',
      id: `multiple-alt:${n}:${all.join(',')}`,
      objective: 'multiple',
      level,
      prompt: `数直線の 印は ${n}の 倍数です。${n}の 倍数を すべて 選ぼう。`,
      figure: multLine(n, max, n * 3),
      hints: [
        `${n}の 倍数は、${n}に 整数を かけた 数だよ。`,
        `${n} × 1、${n} × 2、${n} × 3、… と 数直線を のばして 考えよう。`,
        `それぞれの 数が ${n}で わりきれるかを 調べよう。`,
      ],
      explain: `${n}で わりきれる 数が ${n}の 倍数です。${all.filter((x) => x % n === 0).join('、')}が ${n}の 倍数です。`,
      identity: `multiple-pick:${n}:${all.join(',')}`,
      alt: true,
      multi: true,
      fixedOrder: true,
      layout: 'grid',
      options: all.map((x): ChoiceOption =>
        x % n === 0
          ? { label: String(x), correct: true }
          : { label: String(x), misconception: n % x === 0 ? 'mult-div-swap' : 'not-multiple' },
      ),
    };
    return item;
  }
  // □番めの 倍数（小さいほうから k 番め）
  const k = rng.int(level === 0 ? 3 : 5, level === 0 ? 9 : 15);
  const answers = [{ kind: 'int' as const, value: n * k }];
  const item: NumberItem = {
    engine: 'number',
    id: `multiple:${n}:${k}`,
    objective: 'multiple',
    level,
    prompt: `${n}の 倍数を 小さい じゅんに ならべます。${k}番目の 数は いくつ？（0は 入れません）`,
    figure: expr(`${n}、${n * 2}、${n * 3}、…`),
    hints: [
      `${n}の 倍数は ${n} × 1、${n} × 2、${n} × 3、…`,
      `${k}番目は ${n} × ${k}だよ。`,
      `${n} × ${k}を 計算しよう。`,
    ],
    explain: `${n}の 倍数の ${k}番目は ${n} × ${k} ＝ ${n * k}です。`,
    identity: `multiple:${n}:${k}`,
    alt: false,
    fields: [{ answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [n + k, 'add-instead'],
      [n * (k - 1), 'count-zero'],
      [n * (k + 1), 'count-zero'],
    ]),
  };
  return item;
}

// ---- 約数 ----
/** 約数が 8こ以下の 数（選択肢が 多くなりすぎないように） */
const DIV_NUMS = range(6, 60).filter((n) => divisorsOf(n).length >= 3 && divisorsOf(n).length <= 8);

function divisor(level: number, rng: Rng, alt: boolean): Item {
  const n = pick(rng, DIV_NUMS);
  const ds = divisorsOf(n);
  if (alt) {
    // 約数の 数を 答える（1と その数を 落とす 誤りを 見る）
    const answers = [{ kind: 'int' as const, value: ds.length }];
    const item: NumberItem = {
      engine: 'number',
      id: `divisor-alt:${n}`,
      objective: 'divisor',
      level,
      prompt: `${n}の 約数は 全部で 何こ ありますか。`,
      figure: expr(`${n} ÷ □ が わりきれる □`),
      hints: [
        `${n}を わりきる 整数が ${n}の 約数だよ。1と ${n}も 入るよ。`,
        `かけて ${n}に なる 組を 見つけよう。1 × ${n}、…`,
        `組の 両方を 数えよう。（${ds.filter((d) => d * d <= n).map((d) => `${d} × ${n / d}`).join('、')}）`,
      ],
      explain: `${n}の 約数は ${ds.join('、')}の ${ds.length}こです。`,
      identity: `divisor-count:${n}`,
      alt: true,
      fields: [{ label: 'こ', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [ds.length - 2, 'miss-ends'],
        [ds.length - 1, 'miss-ends'],
        [ds.filter((d) => d * d <= n).length, 'half-pairs'],
      ]),
    };
    return item;
  }
  // 約数を すべて選ぶ（1〜n の中から 約数＋ まぎらわしい数）
  const non = range(2, n - 1).filter((x) => n % x !== 0);
  const extra = rng.sample(non, Math.min(non.length, Math.max(2, 10 - ds.length - 1)));
  const multipleOpt = level >= 1 && n * 2 <= 120 ? [n * 2] : [];
  const all = [...new Set([...ds, ...extra, ...multipleOpt])].sort((a, b) => a - b);
  const item: ChoiceItem = {
    engine: 'choice',
    id: `divisor:${n}:${all.join(',')}`,
    objective: 'divisor',
    level,
    prompt: `${n}の 約数を すべて 選ぼう。`,
    hints: [
      `${n}を わりきる 整数を さがそう。1と ${n}も 約数だよ。`,
      `かけて ${n}に なる 2つの 数の 組を 考えよう。1 × ${n}、…`,
      `${ds.filter((d) => d * d <= n).slice(0, 2).map((d) => `${d} × ${n / d}`).join('、')}、… と 組を 見つけて、両方とも 選ぼう。`,
    ],
    explain: `${n}の 約数は ${ds.join('、')}です。${ds.filter((d) => d * d <= n).map((d) => `${d} × ${n / d}`).join('、')}の 組で 見つけると 落としにくいよ。`,
    identity: `divisor:${n}`,
    alt: false,
    multi: true,
    fixedOrder: true,
    layout: 'grid',
    options: all.map((x): ChoiceOption =>
      n % x === 0
        ? { label: String(x), correct: true }
        : { label: String(x), misconception: x > n ? 'mult-div-swap' : 'not-divisor' },
    ),
  };
  return item;
}

// ---- 公倍数・最小公倍数 ----
/** 2つの数の組（a<b ≤ 15、どちらかが もう一方の 倍数でない組も 含む） */
const LCM_PAIRS: [number, number][] = [];
for (let a = 2; a <= 12; a++) for (let b = a + 1; b <= 15; b++) if (lcm(a, b) <= 120) LCM_PAIRS.push([a, b]);

const LCM_SCENES = [
  {
    id: 'bus',
    text: (a: number, b: number) =>
      `駅から 東行きの バスは ${a}分《ふん》ごと、西行きの バスは ${b}分《ふん》ごとに 出ます。午前8時に 同時に 出ました。次に 同時に 出るのは 何分《なんぷん》後ですか。`,
    unit: '分《ふん》後',
  },
  {
    id: 'tile',
    text: (a: number, b: number) =>
      `たて ${a}cm、横 ${b}cmの 長方形の 紙を 同じ 向きに すきまなく ならべて、できるだけ 小さい 正方形を 作ります。正方形の 1辺は 何cmですか。`,
    unit: 'cm',
  },
  {
    id: 'blocks',
    text: (a: number, b: number) =>
      `高さ ${a}cmの 箱と 高さ ${b}cmの 箱を、それぞれ 積み上げます。2つの 高さが はじめて 同じに なるのは 何cmの ときですか。`,
    unit: 'cm',
  },
  {
    id: 'lights',
    text: (a: number, b: number) =>
      `赤い ランプは ${a}秒ごと、青い ランプは ${b}秒ごとに 光ります。今 同時に 光りました。次に 同時に 光るのは 何秒後ですか。`,
    unit: '秒後',
  },
];

function lcmItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const [a0, b0] = pick(rng, LCM_PAIRS);
  const [a, b] = rng.next() < 0.5 ? [a0, b0] : [b0, a0];
  const L = lcm(a, b);
  const answers = [{ kind: 'int' as const, value: L }];
  const wr = wrongList(answers, [
    [a * b, 'lcm-product'],
    [Math.max(a, b), 'pick-larger'],
    [gcd(a, b) > 1 ? gcd(a, b) : null, 'lcm-gcd-swap'],
    [L * 2, 'not-least'],
  ]);
  const key = `${Math.min(a, b)},${Math.max(a, b)}`;
  const hintPairs = `${Math.max(a, b)}の 倍数（${[1, 2, 3].map((k) => Math.max(a, b) * k).join('、')}、…）の 中から、${Math.min(a, b)}で わりきれる 数を さがそう。`;
  if (alt) {
    const sc = pick(rng, LCM_SCENES);
    return {
      engine: 'number',
      id: `lcm-alt:${sc.id}:${a},${b}`,
      objective: 'lcm',
      level,
      prompt: sc.text(a, b),
      hints: [
        '同時に なるのは、どちらの 数の 倍数にも なって いる ときだね。',
        `${a}と ${b}の 公倍数の うち、いちばん 小さい 数を 求めよう。`,
        hintPairs,
      ],
      explain: `${a}と ${b}の 最小公倍数は ${L}。答えは ${L}${sc.unit}です。`,
      identity: `lcm-scene:${sc.id}:${key}`,
      alt: true,
      fields: [{ label: sc.unit, answer: answers[0]! }],
      wrongAnswers: wr,
    };
  }
  const ask = level >= 2 && rng.next() < 0.3 ? 'second' : 'least';
  if (ask === 'second') {
    const answers2 = [{ kind: 'int' as const, value: L * 2 }];
    return {
      engine: 'number',
      id: `lcm2:${a},${b}`,
      objective: 'lcm',
      level,
      prompt: `${a}と ${b}の 公倍数を 小さい じゅんに ならべます。2番目の 数は いくつ？`,
      figure: expr(`${a}と ${b}の 公倍数`),
      hints: [
        '公倍数は、最小公倍数の 倍数に なって いるよ。',
        `まず 最小公倍数を 求めよう。${hintPairs}`,
        '最小公倍数の 2倍を 考えよう。',
      ],
      explain: `${a}と ${b}の 最小公倍数は ${L}。公倍数は ${L}、${L * 2}、${L * 3}、… なので、2番目は ${L * 2}です。`,
      identity: `lcm2:${key}`,
      alt: false,
      fields: [{ answer: answers2[0]! }],
      wrongAnswers: wrongList(answers2, [
        [L, 'not-least'],
        [a * b * 2 !== L * 2 ? a * b * 2 : null, 'lcm-product'],
        [a * b !== L * 2 ? a * b : null, 'lcm-product'],
      ]),
    };
  }
  return {
    engine: 'number',
    id: `lcm:${a},${b}`,
    objective: 'lcm',
    level,
    prompt: `${a}と ${b}の 最小公倍数を 求めよう。`,
    figure: expr(`${a}と ${b}の 最小公倍数`),
    hints: [
      `${a}の 倍数にも ${b}の 倍数にも なって いる 数が 公倍数だよ。`,
      hintPairs,
      `見つかった 数の うち いちばん 小さい 数が 最小公倍数だよ。`,
    ],
    explain: `${a}の 倍数と ${b}の 倍数に 共通な いちばん 小さい 数は ${L}。最小公倍数は ${L}です。`,
    identity: `lcm:${key}`,
    alt: false,
    fields: [{ answer: answers[0]! }],
    wrongAnswers: wr,
  };
}

// ---- 公約数・最大公約数 ----
const GCD_PAIRS: [number, number][] = [];
for (let a = 6; a <= 48; a++)
  for (let b = a + 1; b <= 60; b++) {
    const g = gcd(a, b);
    if (g >= 2 && g < a && b % a !== 0) GCD_PAIRS.push([a, b]);
  }

const GCD_SCENES = [
  {
    id: 'share',
    text: (a: number, b: number) =>
      `えんぴつ ${a}本と ノート ${b}さつを、あまりが 出ないように、できるだけ 多くの 人に 同じ 数ずつ 分けます。何人に 分けられますか。`,
    unit: '人',
  },
  {
    id: 'square',
    text: (a: number, b: number) =>
      `たて ${a}cm、横 ${b}cmの 長方形の 紙を、あまりが 出ないように 同じ 大きさの 正方形に 切り分けます。いちばん 大きい 正方形の 1辺は 何cmですか。`,
    unit: 'cm',
  },
  {
    id: 'flowers',
    text: (a: number, b: number) =>
      `赤い 花 ${a}本と 白い 花 ${b}本で、同じ 組み合わせの 花たばを、あまりなく できるだけ 多く 作ります。花たばは 何こ できますか。`,
    unit: 'こ',
  },
  {
    id: 'teams',
    text: (a: number, b: number) =>
      `5年生 ${a}人と 6年生 ${b}人で、どの はんにも 5年生と 6年生が それぞれ 同じ 人数ずつ 入るように はんを 作ります。はんは いちばん 多くて 何はん できますか。`,
    unit: 'はん',
  },
];

function gcdItem(level: number, rng: Rng, alt: boolean): Item {
  const [a0, b0] = pick(rng, GCD_PAIRS);
  const [a, b] = rng.next() < 0.5 ? [a0, b0] : [b0, a0];
  const G = gcd(a, b);
  const key = `${Math.min(a, b)},${Math.max(a, b)}`;
  const smallDivs = divisorsOf(Math.min(a, b));
  const commonSmall = smallDivs.filter((d) => Math.max(a, b) % d === 0 && d < G);
  const wrongCands: [number | null, string][] = [
    [Math.min(a, b), 'pick-smaller'],
    [commonSmall.length > 1 ? commonSmall[commonSmall.length - 1]! : null, 'not-greatest'],
    [smallDivs.find((d) => d > G && Math.max(a, b) % d !== 0) ?? null, 'not-common'],
    [lcm(a, b) <= 999 ? lcm(a, b) : null, 'lcm-gcd-swap'],
  ];
  const answers = [{ kind: 'int' as const, value: G }];
  const hint2 = `${Math.min(a, b)}の 約数（${smallDivs.join('、')}）の 中から、${Math.max(a, b)}も わりきれる 数を さがそう。`;
  if (alt) {
    const sc = pick(rng, GCD_SCENES);
    return {
      engine: 'number',
      id: `gcd-alt:${sc.id}:${a},${b}`,
      objective: 'gcd',
      level,
      prompt: sc.text(a, b),
      hints: [
        'あまりなく 分けるには、どちらの 数も わりきれる 数で 分けるね。',
        `${a}と ${b}の 公約数の うち、いちばん 大きい 数を 求めよう。`,
        hint2,
      ],
      explain: `${a}と ${b}の 最大公約数は ${G}。答えは ${G}${sc.unit}です。`,
      identity: `gcd-scene:${sc.id}:${key}`,
      alt: true,
      fields: [{ label: sc.unit, answer: answers[0]! }],
      wrongAnswers: wrongList(answers, wrongCands),
    };
  }
  if (level >= 1 && rng.next() < 0.35) {
    // 公約数を すべて 選ぶ
    const commons = divisorsOf(G);
    const onlyA = divisorsOf(a).filter((d) => b % d !== 0);
    const onlyB = divisorsOf(b).filter((d) => a % d !== 0);
    const distract = rng.sample([...onlyA, ...onlyB], Math.min(3, onlyA.length + onlyB.length));
    const all = [...new Set([...commons, ...distract])].sort((x, y) => x - y);
    const item: ChoiceItem = {
      engine: 'choice',
      id: `gcd-common:${a},${b}:${all.join(',')}`,
      objective: 'gcd',
      level,
      prompt: `${a}と ${b}の 公約数を すべて 選ぼう。`,
      hints: [
        `${a}も ${b}も わりきれる 数が 公約数だよ。1も 入るよ。`,
        hint2,
        `公約数は、最大公約数の 約数に なって いるよ。`,
      ],
      explain: `${a}と ${b}の 公約数は ${commons.join('、')}。最大公約数は ${G}です。`,
      identity: `gcd-common:${key}`,
      alt: false,
      multi: true,
      fixedOrder: true,
      layout: 'grid',
      options: all.map((x): ChoiceOption =>
        commons.includes(x) ? { label: String(x), correct: true } : { label: String(x), misconception: 'not-common' },
      ),
    };
    return item;
  }
  return {
    engine: 'number',
    id: `gcd:${a},${b}`,
    objective: 'gcd',
    level,
    prompt: `${a}と ${b}の 最大公約数を 求めよう。`,
    figure: expr(`${a}と ${b}の 最大公約数`),
    hints: [
      `${a}の 約数にも ${b}の 約数にも なって いる 数が 公約数だよ。`,
      hint2,
      '見つかった 公約数の うち、いちばん 大きい 数を 答えよう。',
    ],
    explain: `${a}と ${b}の 公約数の うち いちばん 大きい 数は ${G}。最大公約数は ${G}です。`,
    identity: `gcd:${key}`,
    alt: false,
    fields: [{ answer: answers[0]! }],
    wrongAnswers: wrongList(answers, wrongCands),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['evenodd', 'multiple', 'divisor'] },
  { objs: ['multiple', 'divisor', 'lcm', 'gcd'] },
  { objs: ['lcm', 'gcd', 'divisor', 'evenodd'] },
];

export function generateMultiplesDivisors(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'evenodd':
      return evenodd(level, rng, alt);
    case 'multiple':
      return multiple(level, rng, alt);
    case 'divisor':
      return divisor(level, rng, alt);
    case 'lcm':
      return lcmItem(level, rng, alt);
    case 'gcd':
      return gcdItem(level, rng, alt);
  }
}

export const multiplesDivisors: UnitSpec = finishUnit(
  {
    id: 'g5.math.multiples-divisors',
    title: '偶数と 奇数、倍数と 約数',
    stage: 'g5',
    subject: 'math',
    domain: 'A-number',
    kind: 'calc',
    priority: 'P1',
    status: 'ready',
    icon: 'math-split',
    prereq: ['g3.math.division-remainder'],
    objectives: [
      { id: 'evenodd', title: '偶数・奇数' },
      { id: 'multiple', title: '倍数' },
      { id: 'divisor', title: '約数' },
      { id: 'lcm', title: '公倍数・最小公倍数' },
      { id: 'gcd', title: '公約数・最大公約数' },
    ],
    misconceptions: [
      {
        id: 'even-odd-def',
        explain: '偶数と 奇数を 反対に 覚えて いたのかな。2で わりきれる 整数が 偶数、わりきれない 整数が 奇数だよ。',
      },
      {
        id: 'tens-digit',
        explain: '一の位 いがいの 数字を 見て 決めたのかな。偶数か 奇数かは、一の位の 数字だけで 決まるよ。',
      },
      {
        id: 'add-instead',
        explain: 'たし算を したのかな。倍数は かけ算で 作るよ。3の 倍数は 3 × 1、3 × 2、3 × 3、…',
      },
      {
        id: 'count-zero',
        explain: '何番目かが 1つ ずれたのかな。1番目は その数 × 1だよ（0は 倍数に 入れない）。',
      },
      {
        id: 'mult-div-swap',
        explain:
          '倍数と 約数を 取りちがえたのかな。倍数は その数に 整数を かけた 数（大きく なる）、約数は その数を わりきる 数（その数 いか）だよ。',
      },
      {
        id: 'not-multiple',
        explain: 'その数で わりきれるか たしかめよう。わりきれない 数は 倍数では ないよ。',
      },
      {
        id: 'not-divisor',
        explain: 'その数で わりきれるか たしかめよう。あまりが 出る 数は 約数では ないよ。',
      },
      {
        id: 'miss-ends',
        explain: '1や その数 自身を 数えわすれたのかな。どの 整数も、1と その数 自身は かならず 約数だよ。',
      },
      {
        id: 'half-pairs',
        explain: 'かけ算の 組の かたほうだけ 数えたのかな。2 × 6 なら、2も 6も 約数だよ。',
      },
      {
        id: 'lcm-product',
        explain:
          '2つの 数を かけたのかな。かけた 数は 公倍数だけど、いちばん 小さいとは かぎらないよ。大きい ほうの 数の 倍数を じゅんに 調べよう。',
      },
      {
        id: 'pick-larger',
        explain: '大きい ほうの 数を そのまま 答えたのかな。小さい ほうの 数でも わりきれるか たしかめよう。',
      },
      {
        id: 'pick-smaller',
        explain: '小さい ほうの 数を そのまま 答えたのかな。大きい ほうの 数も わりきれるか たしかめよう。',
      },
      {
        id: 'not-greatest',
        explain: '公約数では あるけれど、もっと 大きい 公約数が あるよ。いちばん 大きい ものを さがそう。',
      },
      {
        id: 'not-common',
        explain: 'かたほうの 数しか わりきれない 数だよ。2つの 数の 両方を わりきれるか たしかめよう。',
      },
      {
        id: 'not-least',
        explain: 'もっと 小さい 公倍数が あるよ。最小公倍数は 公倍数の 中で いちばん 小さい 数だよ。',
      },
      {
        id: 'lcm-gcd-swap',
        explain:
          '最小公倍数と 最大公約数を 取りちがえたのかな。「同時に そろう・まとめて 作る」は 公倍数、「あまりなく 分ける」は 公約数で 考えるよ。',
      },
    ],
    levels: [
      { label: '偶数・奇数、倍数・約数', chance: 0.02 },
      { label: '公倍数・公約数', chance: 0.02 },
      { label: '場面で つかう・まとめ', chance: 0.02 },
    ],
    intro: [
      {
        text: '2で わりきれる 整数を 偶数、わりきれない 整数を 奇数と いいます。0も 偶数です。一の位を 見れば 分かります。',
        figure: expr('0、2、4、6、8 … 偶数　　1、3、5、7、9 … 奇数'),
      },
      {
        text: '3に 整数を かけて できる 数を 3の 倍数と いいます。数直線に 印を つけると、3つおきに ならびます。',
        figure: multLine(3, 20, 18),
      },
      {
        text: '12を わりきる 整数を 12の 約数と いいます。かけて 12に なる 組（1 × 12、2 × 6、3 × 4）で さがすと、1、2、3、4、6、12。',
        figure: expr('1 × 12、2 × 6、3 × 4'),
      },
      {
        text: '4と 6の 両方の 倍数を 公倍数（12、24、…）、いちばん 小さい ものを 最小公倍数と いいます。12と 18の 両方の 約数を 公約数（1、2、3、6）、いちばん 大きい ものを 最大公約数と いいます。',
      },
    ],
    source: {
      kind: 'generator',
      generate: ({ level, rng, index }) => generateMultiplesDivisors(level, rng, index),
    },
    review: 'type',
    basis:
      '小学校学習指導要領（平成29年告示）算数 第5学年 A(1) 整数の性質（偶数・奇数、約数・倍数。内容の取扱い: 形式的に求めることに偏らない）',
    revised: REVISED,
  },
  '決《き》め 落《お》と 出《で》ます 出《で》ない 出《で》ました 今《いま》 駅《えき》 東行《ひがしゆ》き 西行《にしゆ》き 同時《どうじ》 午前《ごぜん》 赤《あか》い 青《あお》い 光《ひか》る 光《ひか》り 光《ひか》るのは 白《しろ》い 積《つ》み上《あ》げ 共通《きょうつう》 自身《じしん》 生《せい》 次《つぎ》 印《しるし》 覚《おぼ》えて 切《き》り分《わ》け 作《つく》る 作《つく》ります 作《つく》 後《ご》',
);
