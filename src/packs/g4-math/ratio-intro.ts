/**
 * g4.math.ratio-intro 簡単な場合の割合（何倍かで比べる）（curriculum-matrix 3.7）。
 * 何倍か → 倍で比べる（差では比べない場面）→ もとにする量・比べられる量を求める。
 *
 * 4年は「簡単な場合」（整数倍）に限る。場面 8（ゴム・植物・ねだん・リボン・水・本・紙テープ・歩数）。
 * 同一性キー: 問う形 × 場面 × 数値。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { finishUnit, pick, pickObj, REVISED, wrongList } from './util';

type Obj = 'times' | 'compare' | 'amount' | 'base';

interface Scene {
  id: string;
  a: string; // もとにする もの
  b: string; // くらべる もの
  u: string;
  step: number;
}
const SCENES: Scene[] = [
  { id: 'ribbon', a: '青い リボン', b: '赤い リボン', u: 'cm', step: 5 },
  { id: 'plant', a: 'ひまわりの 先週の 高さ', b: 'ひまわりの 今週の 高さ', u: 'cm', step: 2 },
  { id: 'price', a: 'えんぴつの ねだん', b: 'ノートの ねだん', u: '円', step: 10 },
  { id: 'water', a: '小さい 水とうに 入る 水', b: '大きい 水そうに 入る 水', u: 'dL', step: 1 },
  { id: 'book', a: 'きのう 読んだ ページ', b: 'きょう 読んだ ページ', u: 'ページ', step: 3 },
  { id: 'tape', a: '白い テープ', b: '黄色い テープ', u: 'm', step: 1 },
  { id: 'steps', a: '弟の 歩いた 歩数', b: '兄の 歩いた 歩数', u: 'ほ', step: 50 },
  { id: 'jump', a: '1年生の なわとびの 回数', b: '4年生の なわとびの 回数', u: '回', step: 4 },
];

function tapeFig(base: string, n: number, total: string): Figure {
  return {
    kind: 'column',
    gap: 1,
    items: [
      { kind: 'tape', parts: [{ length: 1, label: base, tone: 'a' }] },
      { kind: 'tape', parts: Array.from({ length: n }, (_, i) => ({ length: 1, label: i === 0 ? base : '', tone: 'b' as const })), total },
    ],
  };
}

/** 何倍か（alt: テープ図） */
function times(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, SCENES);
  const A = rng.int(2, 12) * sc.step;
  const n = rng.int(2, 9);
  const B = A * n;
  const answers = [{ kind: 'int' as const, value: n }];
  return {
    engine: 'number',
    id: `times${alt ? '-alt' : ''}:${sc.id}:${A}x${n}`,
    objective: 'times',
    level,
    prompt: `${sc.a}は ${A}${sc.u}、${sc.b}は ${B}${sc.u}です。${sc.b}は ${sc.a}の 何倍ですか。`,
    figure: alt ? tapeFig(`${A}${sc.u}`, n, `${B}${sc.u}`) : undefined,
    hints: [
      `もとに する 量は ${sc.a}（${A}${sc.u}）。`,
      `${B}は ${A}の いくつ分かを 考えよう。`,
      `${B} ÷ ${A}を 計算しよう。`,
    ],
    explain: `${B} ÷ ${A} ＝ ${n}。${sc.b}は ${sc.a}の ${n}倍です。`,
    identity: `times:${sc.id}:${A}x${n}${alt ? ':tape' : ''}`,
    alt,
    fields: [{ label: '倍', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [[B - A, 'diff-compare'], [B * A, 'mult-instead']]),
  };
}

const C_SCENES = [
  { id: 'rubber', what: 'ゴム', before: 'のばす 前', after: 'のばした あと', q: 'よく のびる', u: 'cm' },
  { id: 'plant', what: 'なえ', before: '1か月前', after: 'いま', q: 'よく そだった', u: 'cm' },
  { id: 'price', what: '品物', before: '前の ねだん', after: 'いまの ねだん', q: 'ねだんの 上がり方が 大きい', u: '円' },
  { id: 'bird', what: '池', before: '先月の 鳥の 数', after: '今月の 鳥の 数', q: '鳥の 数の ふえ方が 大きい', u: 'わ' },
];

/** 倍で くらべる（alt: 2つの 何倍を 計算して 大きい ほうの 倍を 答える） */
function compare(level: number, rng: Rng, alt: boolean): Item {
  const sc = pick(rng, C_SCENES);
  for (;;) {
    const a1 = rng.int(1, 6) * 10;
    const n1 = rng.int(2, 5);
    const a2 = rng.int(1, 9) * 10;
    const n2 = rng.int(2, 5);
    if (n1 === n2 || a1 === a2) continue;
    const d1 = a1 * (n1 - 1);
    const d2 = a2 * (n2 - 1);
    // 差で くらべると 反対の 答えに なる 組
    if ((n1 > n2) === (d1 > d2) || d1 === d2) continue;
    const win = n1 > n2 ? 'ア' : 'イ';
    const tbl: Figure = {
      kind: 'table',
      header: [sc.what, sc.before, sc.after],
      rows: [
        ['ア', `${a1}${sc.u}`, `${a1 * n1}${sc.u}`],
        ['イ', `${a2}${sc.u}`, `${a2 * n2}${sc.u}`],
      ],
    };
    if (alt) {
      const answers = [{ kind: 'int' as const, value: Math.max(n1, n2) }];
      const item: NumberItem = {
        engine: 'number',
        id: `compare-alt:${sc.id}:${a1}x${n1}:${a2}x${n2}`,
        objective: 'compare',
        level,
        prompt: `${sc.q}と いえるのは、何倍に なった ほうです。ア・イの うち、大きい ほうは 何倍に なりましたか。`,
        figure: tbl,
        hints: ['それぞれ、あとの 数が 前の 数の 何倍かを 計算しよう。', `アは ${a1 * n1} ÷ ${a1}、イは ${a2 * n2} ÷ ${a2}。`, 'くらべて 大きい ほうの 倍を 答えよう。'],
        explain: `アは ${n1}倍、イは ${n2}倍。${win}の ${Math.max(n1, n2)}倍の ほうが 大きいです。`,
        identity: `compare-calc:${sc.id}:${a1}x${n1}:${a2}x${n2}`,
        alt: true,
        fields: [{ label: '倍', answer: answers[0]! }],
        wrongAnswers: wrongList(answers, [[Math.min(n1, n2), 'diff-compare'], [Math.max(d1, d2), 'diff-compare']]),
      };
      return item;
    }
    const item: ChoiceItem = {
      engine: 'choice',
      id: `compare:${sc.id}:${a1}x${n1}:${a2}x${n2}`,
      objective: 'compare',
      level,
      prompt: `${sc.what}アと イの ${sc.before}と ${sc.after}を 表に しました。もとの 大きさが ちがうので、何倍に なったかで くらべます。${sc.q}のは どちら？`,
      figure: tbl,
      fixedOrder: true,
      hints: [
        'ふえた 長さ（ちがい）では なく、何倍に なったかで くらべよう。',
        `アは ${a1 * n1} ÷ ${a1}、イは ${a2 * n2} ÷ ${a2}。`,
        `アは ${n1}倍。イは 何倍かな。`,
      ],
      explain: `アは ${n1}倍、イは ${n2}倍。何倍かで くらべると ${win}です。（ちがいで くらべると アは ${d1}、イは ${d2}で、反対に なります）`,
      identity: `compare:${sc.id}:${a1}x${n1}:${a2}x${n2}`,
      alt: false,
      options: [
        win === 'ア' ? { label: 'ア', correct: true } : { label: 'ア', misconception: 'diff-compare' },
        win === 'イ' ? { label: 'イ', correct: true } : { label: 'イ', misconception: 'diff-compare' },
        { label: '同じ', misconception: 'diff-compare' },
      ],
    };
    return item;
  }
}

/** くらべられる 量（alt: テープ図） */
function amount(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, SCENES);
  const A = rng.int(2, 15) * sc.step;
  const n = rng.int(2, 9);
  const answers = [{ kind: 'int' as const, value: A * n }];
  return {
    engine: 'number',
    id: `amount${alt ? '-alt' : ''}:${sc.id}:${A}x${n}`,
    objective: 'amount',
    level,
    prompt: `${sc.a}は ${A}${sc.u}です。${sc.b}は、${sc.a}の ${n}倍です。${sc.b}は 何${sc.u === '円' ? '円' : sc.u}ですか。`,
    figure: alt ? tapeFig(`${A}${sc.u}`, n, '？') : undefined,
    hints: [`もとに する 量は ${A}${sc.u}。`, `その ${n}倍を 求めるよ。`, `${A} × ${n}を 計算しよう。`],
    explain: `${A} × ${n} ＝ ${A * n}。${sc.b}は ${A * n}${sc.u}です。`,
    identity: `amount:${sc.id}:${A}x${n}${alt ? ':tape' : ''}`,
    alt,
    fields: [{ label: sc.u, answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [[A + n, 'add-instead'], [A % n === 0 ? A / n : null, 'base-swap']]),
  };
}

/** もとに する 量（alt: テープ図） */
function base(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, SCENES);
  const A = rng.int(2, 15) * sc.step;
  const n = rng.int(2, 9);
  const B = A * n;
  const answers = [{ kind: 'int' as const, value: A }];
  return {
    engine: 'number',
    id: `base${alt ? '-alt' : ''}:${sc.id}:${A}x${n}`,
    objective: 'base',
    level,
    prompt: `${sc.b}は ${B}${sc.u}で、${sc.a}の ${n}倍です。${sc.a}は 何${sc.u === '円' ? '円' : sc.u}ですか。`,
    figure: alt ? tapeFig('？', n, `${B}${sc.u}`) : undefined,
    hints: [`${sc.a}を □${sc.u}と すると、□ × ${n} ＝ ${B}。`, '□を 求めるには、わり算を 使うよ。', `${B} ÷ ${n}を 計算しよう。`],
    explain: `□ × ${n} ＝ ${B} なので、□ ＝ ${B} ÷ ${n} ＝ ${A}。${sc.a}は ${A}${sc.u}です。`,
    identity: `base:${sc.id}:${A}x${n}${alt ? ':tape' : ''}`,
    alt,
    fields: [{ label: sc.u, answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [[B * n, 'mult-instead'], [B - n, 'add-instead']]),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['times', 'amount'] },
  { objs: ['compare', 'base', 'times'] },
  { objs: ['times', 'compare', 'amount', 'base'] },
];

export function generateRatioIntro(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'times':
      return times(level, rng, alt);
    case 'compare':
      return compare(level, rng, alt);
    case 'amount':
      return amount(level, rng, alt);
    case 'base':
      return base(level, rng, alt);
  }
}

export const ratioIntro: UnitSpec = finishUnit({
  id: 'g4.math.ratio-intro',
  title: '何倍かで くらべる（かんたんな 割合）',
  stage: 'g4',
  subject: 'math',
  domain: 'C-measure',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-compare',
  prereq: ['g4.math.decimal-int'],
  objectives: [
    { id: 'times', title: '何倍かを 求める' },
    { id: 'compare', title: '何倍かで くらべる' },
    { id: 'amount', title: '〇倍の 量を 求める' },
    { id: 'base', title: 'もとに する 量を 求める' },
  ],
  misconceptions: [
    {
      id: 'diff-compare',
      explain:
        'ちがい（ふえた 分）で くらべたのかな。もとの 大きさが ちがう ときは、何倍に なったかで くらべると くらべやすいよ。',
    },
    {
      id: 'mult-instead',
      explain: 'かけ算と わり算を まちがえたのかな。何倍かや もとに する 量を 求める ときは わり算だよ。',
    },
    {
      id: 'add-instead',
      explain: '〇倍は「〇こ分」の ことだよ。たし算や ひき算では なく、かけ算・わり算で 考えよう。',
    },
    {
      id: 'base-swap',
      explain: 'もとに する 量と くらべる 量を 入れかえたのかな。「〇の △倍」の 〇が もとに する 量だよ。',
    },
  ],
  levels: [
    { label: '何倍・〇倍の 量', chance: 0.05 },
    { label: '倍で くらべる・もとに する 量', chance: 0.05 },
    { label: 'まとめ', chance: 0.05 },
  ],
  intro: [
    {
      text: 'ゴムアは 20cmが 60cmに、ゴムイは 50cmが 100cmに のびました。のびた 長さは アが 40cm、イが 50cm。',
      figure: {
        kind: 'table',
        header: ['ゴム', 'のばす 前', 'のばした あと'],
        rows: [
          ['ア', '20cm', '60cm'],
          ['イ', '50cm', '100cm'],
        ],
      },
    },
    {
      text: 'もとの 長さが ちがうので、何倍に のびたかで くらべます。アは 60 ÷ 20 ＝ 3倍、イは 100 ÷ 50 ＝ 2倍。アの ほうが よく のびると いえます。',
      figure: tapeFig('20cm', 3, '60cm'),
    },
    {
      text: 'もとに する 量を 1と みたとき、くらべる 量が いくつに あたるかを 表した 数を 割合と いいます。',
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateRatioIntro(level, rng, index),
  },
  review: 'objective',
  basis: '小学校学習指導要領（平成29年告示）算数 第4学年 C(2) 簡単な場合についての割合（二つの数量の関係を割合で比べる）',
  revised: REVISED,
});
