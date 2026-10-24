/**
 * g2.math.mult-beyond 簡単な2位数×1位数（10×3、12×3）（curriculum-matrix 3.5, P2）。
 * 10の いくつぶん → かける数が 10・11・12（九九の きまりを のばす）→ 12×3 を 10×3 と 2×3 に分ける。
 *
 * 判定: 答えの数だけ（式の順序は問わない: 統括の判断8）。
 * 同一性キー: 式（'12x3'）。定義域 = 10×1〜9（9）＋ 2〜9×10〜12（24）＋ 11〜19×2〜9（72）= 105 式。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { pickObj, wrongList } from './util';

type Obj = 'ten' | 'extend' | 'split';

const LEVELS: { objs: Obj[] }[] = [
  // ten は9式だけなので、偏りの検査のため extend を多めに
  { objs: ['ten', 'extend', 'extend'] },
  { objs: ['extend', 'split', 'split'] },
];

const arrayFig = (a: number, b: number): Figure => ({
  kind: 'column',
  gap: 1,
  items: Array.from({ length: b }, () => ({
    kind: 'blocks' as const,
    tens: Math.floor(a / 10),
    ones: a % 10,
  })),
});

function ten(level: number, rng: Rng, alt: boolean): NumberItem {
  const n = rng.int(1, 9);
  const p = 10 * n;
  return {
    engine: 'number',
    id: `ten${alt ? '-alt' : ''}:${n}`,
    objective: 'ten',
    level,
    prompt: alt ? `10この たばが ${n}つ。ぜんぶで いくつ？` : 'けいさん しよう。',
    figure: alt
      ? { kind: 'blocks', tens: n, ones: 0 }
      : { kind: 'text', text: `10 × ${n} ＝ {{}}`, size: 'xl' },
    hints: [
      '10 × □ は 10の □つぶん。',
      `10が ${n}こ あつまると…`,
      `10、20、30、…と ${n}かい かぞえよう。`,
    ],
    explain: `10の ${n}つぶんで ${p}。10 × ${n} ＝ ${p} です。`,
    identity: `10x${n}`,
    alt,
    fields: [{ answer: { kind: 'int', value: p } }],
    wrongAnswers: wrongList(String(p), 1, [
      [10 + n, 'add-instead'],
      [n, 'drop-zero'],
    ]),
  };
}

/** かける数を 10・11・12 に のばす */
function extend(level: number, rng: Rng, alt: boolean): NumberItem {
  const a = rng.int(2, 9);
  const b = rng.int(10, 12);
  const p = a * b;
  return {
    engine: 'number',
    id: `extend${alt ? '-alt' : ''}:${a}x${b}`,
    objective: 'extend',
    level,
    prompt: alt
      ? `${a}の だんの こたえは ${a}ずつ ふえます。${a} × ${b} の こたえは？`
      : 'けいさん しよう。',
    figure: alt
      ? {
          kind: 'numberline',
          min: 0,
          max: a * 12,
          step: a,
          labelEvery: a * 3,
          jump: { from: a * 9, to: a * 10 },
        }
      : { kind: 'text', text: `${a} × ${b} ＝ {{}}`, size: 'xl' },
    hints: [
      'かける かずが 1 ふえると、こたえは かけられる かずだけ ふえるよ。',
      `${a} × 9 ＝ ${a * 9}。`,
      `${a * 9}から ${a}ずつ ${b - 9}かい たそう。`,
    ],
    explain: `${a} × 9 ＝ ${a * 9}。そこから ${a}ずつ ${b - 9}かい ふえて ${a} × ${b} ＝ ${p} です。`,
    identity: `${a}x${b}`,
    alt,
    fields: [{ answer: { kind: 'int', value: p } }],
    wrongAnswers: wrongList(String(p), 1, [
      [a * (b - 1), 'neighbor'],
      [a * 9 + (b - 9), 'add-one'],
      [a + b, 'add-instead'],
    ]),
  };
}

/** 12 × 3 を 10 × 3 と 2 × 3 に 分ける */
function split(level: number, rng: Rng, alt: boolean): NumberItem {
  const a = rng.int(11, 19);
  const b = rng.int(2, 9);
  const o = a - 10;
  const p = a * b;
  if (alt)
    return {
      engine: 'number',
      id: `split-alt:${a}x${b}`,
      objective: 'split',
      level,
      prompt: `あめが 1ふくろに ${a}こずつ はいって います。${b}ふくろでは ぜんぶで なんこ？`,
      figure: arrayFig(a, b),
      fields: [{ label: 'こ', answer: { kind: 'int', value: p } }],
      hints: [
        `${a}は 10と ${o}。`,
        `10の ${b}つぶんと、${o}の ${b}つぶんに わけよう。`,
        `10 × ${b} ＝ ${10 * b}、${o} × ${b} ＝ ${o * b}。あわせると？`,
      ],
      explain: `10 × ${b} ＝ ${10 * b}、${o} × ${b} ＝ ${o * b}。あわせて ${p}こ です。`,
      identity: `${a}x${b}`,
      alt: true,
      wrongAnswers: wrongList(String(p), 1, [
        [10 * b + o, 'split-forget'],
        [10 + o * b, 'split-forget'],
        [a + b, 'add-instead'],
      ]),
    };
  return {
    engine: 'number',
    id: `split:${a}x${b}`,
    objective: 'split',
    level,
    prompt: `${a} × ${b} を、10 × ${b} と ${o} × ${b} に わけて けいさん しよう。`,
    figure: arrayFig(a, b),
    fields: [
      { label: `10 × ${b}`, answer: { kind: 'int', value: 10 * b } },
      { label: `${o} × ${b}`, answer: { kind: 'int', value: o * b } },
      { label: 'あわせて', answer: { kind: 'int', value: p } },
    ],
    hints: [
      `${a}を 10と ${o}に わけよう。`,
      `10 × ${b} は 10の ${b}つぶん。${o} × ${b} は くくで。`,
      `10 × ${b} の こたえと ${o} × ${b} の こたえを たそう。`,
    ],
    explain: `10 × ${b} ＝ ${10 * b}、${o} × ${b} ＝ ${o * b}。あわせて ${a} × ${b} ＝ ${p} です。`,
    identity: `${a}x${b}`,
    alt: false,
    wrongAnswers: wrongList(`${10 * b}|${o * b}|${p}`, 3, [
      [`${10 * b}|${o * b}|${10 * b + o}`, 'split-forget'],
      [`${10 + b}|${o * b}|${10 + b + o * b}`, 'add-instead'],
    ]),
  };
}

export function generateMultBeyond(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  if (obj === 'ten') return ten(level, rng, alt);
  if (obj === 'extend') return extend(level, rng, alt);
  return split(level, rng, alt);
}

export const multBeyond: UnitSpec = {
  id: 'g2.math.mult-beyond',
  title: 'くくを こえる かけざん',
  stage: 'g2',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P2',
  status: 'ready',
  icon: 'math-formula-add',
  prereq: ['g2.math.times-tables'],
  objectives: [
    { id: 'ten', title: '10の いくつぶん（10 × 3）' },
    { id: 'extend', title: 'かける かずが 10・11・12' },
    { id: 'split', title: '12 × 3 を わけて けいさん' },
  ],
  misconceptions: [
    { id: 'add-instead', explain: 'たしざんを したのかな。× は「いくつぶん」の しるし だよ。' },
    {
      id: 'drop-zero',
      explain: '10の たばの かずだけ かいたのかな。10が 3こで 30。0を わすれずに。',
    },
    {
      id: 'neighbor',
      explain:
        'ひとつ まえの こたえかな。かける かずが 1 ふえると、こたえは かけられる かずだけ ふえるよ。',
    },
    { id: 'add-one', explain: 'こたえを 1ずつ ふやしたのかな。3の だんなら 3ずつ ふえるよ。' },
    {
      id: 'split-forget',
      explain:
        'わけた かたほうを かけるのを わすれたのかな。10 × 3 も 2 × 3 も、どちらも 3つぶん だよ。',
    },
  ],
  levels: [
    { label: '10の いくつぶん・くくの つづき', chance: 0.02 },
    { label: 'わけて けいさん', chance: 0.02 },
  ],
  intro: [
    { text: '10の たばが 3つで 30。10 × 3 ＝ 30。', figure: { kind: 'blocks', tens: 3, ones: 0 } },
    {
      text: '3の だんは 3ずつ ふえるので、3 × 10 ＝ 30、3 × 11 ＝ 33、3 × 12 ＝ 36。',
      figure: {
        kind: 'numberline',
        min: 0,
        max: 36,
        step: 3,
        labelEvery: 9,
        jump: { from: 27, to: 30 },
      },
    },
    {
      text: '12 × 3 は、12を 10と 2に わけて、10 × 3 ＝ 30 と 2 × 3 ＝ 6。あわせて 36。',
      figure: arrayFig(12, 3),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateMultBeyond(level, rng, index),
    domainSize: 105,
  },
  review: 'type',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第2学年 A(3) 乗法（簡単な場合の2位数と1位数との乗法）',
  revised: '2026-10-24',
};
