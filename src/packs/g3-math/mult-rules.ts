/**
 * g3.math.mult-rules かけ算のきまり（0・10のかけ算、分けて計算）（curriculum-matrix 3.6）。
 * 0のかけ算 → 10のかけ算 → かける数が1増えると → 交換 → 分けて計算（分配のきまり）。
 *
 * 交換のきまりは この単元の学習内容なので、交換した式は別の問題（a×0 と 0×a は別）。
 * 同一性キー: 問う形 × 式（'next+:6x8'、'split:13x4' など）。別例は同じキーで alt。
 * 定義域: 0のかけ算 21、10のかけ算 19、乗数と積 128、交換 56、分けて計算 72（計 296）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { opts, pickObj, wrongList } from './util';

type Obj = 'zero' | 'ten' | 'next' | 'swap' | 'split';

/** ●を たて rows・よこ cols に ならべた図 */
function dots(rows: number, cols: number, split?: number): Figure {
  const s = 20;
  const gap = split !== undefined ? 10 : 0;
  const w = cols * s + gap + 4;
  const h = rows * s + 4;
  let body = '';
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = c * s + 12 + (split !== undefined && c >= split ? gap : 0);
      const y = r * s + 12;
      body += `<circle cx="${x}" cy="${y}" r="7" fill="${split !== undefined && c >= split ? 'var(--sky)' : 'var(--sun)'}" stroke="var(--ink)" stroke-width="2"/>`;
    }
  return {
    kind: 'svg',
    label: `●が たて ${rows}こ、よこ ${cols}こ`,
    markup: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`,
  };
}

function numItem(
  p: Omit<NumberItem, 'engine' | 'fields' | 'wrongAnswers'> & {
    value: number;
    wrong: [number, string][];
  },
): NumberItem {
  const { value, wrong, ...rest } = p;
  return {
    engine: 'number',
    ...rest,
    fields: [{ answer: { kind: 'int', value } }],
    wrongAnswers: wrongList(String(value), 1, wrong),
  };
}

function zero(level: number, rng: Rng, alt: boolean): NumberItem {
  const a = rng.int(0, 10);
  const first = alt || rng.next() < 0.5; // 0 × a
  const expr = first ? `0 × ${a}` : `${a} × 0`;
  const key = first ? `0x${a}` : `${a}x0`;
  const common = {
    objective: 'zero',
    level,
    identity: key,
    explain: `${expr} ＝ 0。どんな 数《かず》に 0を かけても、0に どんな 数《かず》を かけても、答《こた》えは 0です。`,
    value: 0,
    wrong: [[a, 'zero-same'] as [number, string]],
  };
  if (alt)
    return numItem({
      ...common,
      id: `zero-alt:${a}`,
      prompt: `玉入《たまい》れで、0点《てん》の ところに 玉《たま》が ${a}こ 入《はい》りました。とく点《てん》は 何《なん》点《てん》ですか。`,
      hints: [
        '1こ 入《はい》ると 何《なん》点《てん》かな。',
        `式《しき》は 0 × ${a}。`,
        '0点《てん》が いくつ あっても…',
      ],
      alt: true,
    });
  return numItem({
    ...common,
    id: `zero:${key}`,
    prompt: '計算《けいさん》しよう。',
    figure: { kind: 'text', text: `${expr} ＝ {{}}`, size: 'xl' },
    hints: [
      '0の かけ算《ざん》だね。',
      first ? `0が ${a}こ あると 考《かんが》えよう。` : `${a}が 0こ あると 考《かんが》えよう。`,
      first ? '0 ＋ 0 ＋ … を たしても…' : '1つも ないと…',
    ],
    alt: false,
  });
}

function ten(level: number, rng: Rng, alt: boolean): NumberItem {
  const a = rng.int(1, 10);
  const first = alt || rng.next() < 0.5; // 10 × a
  const expr = first ? `10 × ${a}` : `${a} × 10`;
  const key = a === 10 ? '10x10' : first ? `10x${a}` : `${a}x10`;
  const common = {
    objective: 'ten',
    level,
    identity: key,
    explain: `${expr} ＝ ${a * 10}。10の かけ算《ざん》の 答《こた》えは、${a}の 右《みぎ》に 0を 1こ つけた 数《かず》に なります。${a} × 9 ＝ ${a * 9} より ${a} 大《おお》きい とも 考《かんが》えられます。`,
    value: a * 10,
    wrong: [[a + 10, 'ten-add'] as [number, string], [a * 100, 'ten-zeros'] as [number, string]],
  };
  if (alt)
    return numItem({
      ...common,
      id: `ten-alt:${a}`,
      prompt: `1たばが 10本《ぽん》の 花《はな》たばを ${a}たば 作《つく》りました。花《はな》は 全部《ぜんぶ》で 何《なん》本《ぼん》ですか。`,
      hints: ['1たば 何《なん》本《ぼん》かな。', `式《しき》は 10 × ${a}。`, `10が ${a}こで…`],
      alt: true,
    });
  return numItem({
    ...common,
    id: `ten:${key}`,
    prompt: '計算《けいさん》しよう。',
    figure: { kind: 'text', text: `${expr} ＝ {{}}`, size: 'xl' },
    hints: [
      '10の かけ算《ざん》だね。',
      `${a} × 9 の 答《こた》えを 思《おも》い出《だ》そう。`,
      `${a} × 9 ＝ ${a * 9}。かける数《かず》が 1 ふえると、答《こた》えは ${a} ふえるよ。`,
    ],
    alt: false,
  });
}

function next(level: number, rng: Rng, alt: boolean): NumberItem | ChoiceItem {
  const a = rng.int(2, 9);
  const b = rng.int(2, 9);
  const plus = rng.next() < 0.5;
  const key = `next${plus ? '+' : '-'}:${a}x${b}`;
  const other = plus ? b - 1 : b + 1;
  const expl = plus
    ? `かける数《かず》が 1 ふえると、答《こた》えは かけられる数《かず》の ${a}だけ ふえます。${a} × ${b} ＝ ${a} × ${other} ＋ ${a}。`
    : `かける数《かず》が 1 へると、答《こた》えは かけられる数《かず》の ${a}だけ へります。${a} × ${b} ＝ ${a} × ${other} − ${a}。`;
  if (alt) {
    const sign = plus ? '＋' : '−';
    return {
      engine: 'choice',
      id: `next-alt:${key}`,
      objective: 'next',
      level,
      prompt: `●の 数《かず》は ${a} × ${b}。${a} × ${other} を つかって あらわす 式《しき》は どれ？`,
      figure: dots(a, b),
      hints: [
        `たてに ${a}こずつ ならんで いるよ。`,
        `${a} × ${other} は、よこに ${other}れつ ぶん。`,
        plus ? `のこりの 1れつには ●が いくつ？` : '1れつ ふやすと ●は いくつ ふえる？',
      ],
      explain: expl,
      identity: key,
      alt: true,
      options: opts(`${a} × ${other} ${sign} ${a}`, [
        [`${a} × ${other} ${sign} ${other}`, 'add-multiplier'],
        [`${a} × ${other} ${sign} 1`, 'add-one'],
        [`${a} × ${other} ${plus ? '−' : '＋'} ${a}`, 'next-direction'],
      ]),
    };
  }
  return numItem({
    id: `next:${key}`,
    objective: 'next',
    level,
    prompt: '□に あてはまる 数《かず》は？',
    figure: {
      kind: 'text',
      text: `${a} × ${b} ＝ ${a} × ${other} ${plus ? '＋' : '−'} {{}}`,
      size: 'xl',
    },
    hints: [
      'かける数《かず》が いくつ ちがうかな。',
      `${a} × ${other} と ${a} × ${b} は、かける数《かず》が 1 ちがうね。`,
      `${a}の だんの 九九《くく》は、答《こた》えが いくつずつ ふえるかな。`,
    ],
    explain: expl,
    identity: key,
    alt: false,
    value: a,
    wrong: [
      [b, 'add-multiplier'],
      [other, 'add-multiplier'],
      [1, 'add-one'],
    ],
  });
}

function swap(level: number, rng: Rng, alt: boolean): NumberItem {
  const a = rng.int(2, 9);
  let b = rng.int(2, 8);
  if (b >= a) b++;
  const key = `swap:${a}x${b}`;
  return numItem({
    id: `swap${alt ? '-alt' : ''}:${a}x${b}`,
    objective: 'swap',
    level,
    prompt: alt
      ? `●の 数《かず》を 2つの 式《しき》で あらわしました。□に あてはまる 数《かず》は？\n${a} × ${b} ＝ ${b} × □`
      : '□に あてはまる 数《かず》は？',
    figure: alt ? dots(b, a) : { kind: 'text', text: `${a} × ${b} ＝ ${b} × {{}}`, size: 'xl' },
    hints: [
      'かける数《かず》と かけられる数《かず》を 入《い》れかえて みよう。',
      alt
        ? 'たてに 見《み》ても、よこに 見《み》ても、●の 数《かず》は おなじ。'
        : `${a} × ${b} の 答《こた》えは ${a * b}。`,
      `${b} × □ ＝ ${a * b} に なる 数《かず》を さがそう。`,
    ],
    explain: `かけ算《ざん》では、かける数《かず》と かけられる数《かず》を 入《い》れかえても 答《こた》えは おなじです。${a} × ${b} ＝ ${b} × ${a} ＝ ${a * b}。`,
    identity: key,
    alt,
    value: a,
    wrong: [
      [b, 'swap-copy'],
      [a * b, 'whole-product'],
    ],
  });
}

function split(level: number, rng: Rng, alt: boolean): NumberItem {
  const n = rng.int(11, 19);
  const b = rng.int(2, 9);
  const key = `split:${n}x${b}`;
  const r = n - 10;
  const expl = `${n}を 10と ${r}に 分《わ》けます。10 × ${b} ＝ ${10 * b}、${r} × ${b} ＝ ${r * b}。あわせて ${n * b}。`;
  if (alt)
    return numItem({
      id: `split-alt:${n}x${b}`,
      objective: 'split',
      level,
      prompt: `${n} × ${b} を、${n}を 10と ${r}に 分《わ》けて 計算《けいさん》しよう。答《こた》えは？`,
      figure: {
        kind: 'tape',
        parts: [
          { length: 10, label: '10', tone: 'a' },
          { length: Math.max(r, 2), label: String(r), tone: 'b' },
        ],
        total: String(n),
      },
      hints: [
        '10の ところと のこりの ところに 分《わ》けよう。',
        `10 × ${b} と ${r} × ${b} を それぞれ 計算《けいさん》。`,
        `${10 * b} と ${r} × ${b} を たそう。`,
      ],
      explain: expl,
      identity: key,
      alt: true,
      value: n * b,
      wrong: [
        [10 * b + r, 'split-forget'],
        [10 * b + r * b + b, 'add-one'],
        [10 * b, 'split-whole'],
      ],
    });
  return numItem({
    id: `split:${n}x${b}`,
    objective: 'split',
    level,
    prompt: '□に あてはまる 数《かず》は？',
    figure: { kind: 'text', text: `${n} × ${b} ＝ 10 × ${b} ＋ {{}} × ${b}`, size: 'xl' },
    hints: [
      `${n}を 2つに 分《わ》けて います。`,
      `${n} ＝ 10 ＋ □ だね。`,
      `10と あと いくつで ${n}に なるかな。`,
    ],
    explain: expl,
    identity: key,
    alt: false,
    value: r,
    wrong: [
      [n, 'split-whole'],
      [b, 'split-whole'],
      [10, 'split-whole'],
    ],
  });
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['zero', 'ten'] },
  { objs: ['zero', 'ten', 'next', 'swap'] },
  { objs: ['next', 'swap', 'split'] },
  { objs: ['split', 'next', 'swap', 'zero', 'ten'] },
];

export function generateMultRules(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.25;
  switch (obj) {
    case 'zero':
      return zero(level, rng, alt);
    case 'ten':
      return ten(level, rng, alt);
    case 'next':
      return next(level, rng, alt);
    case 'swap':
      return swap(level, rng, alt);
    case 'split':
      return split(level, rng, alt);
  }
}

export const multRules: UnitSpec = {
  id: 'g3.math.mult-rules',
  title: 'かけ算《ざん》の きまり',
  stage: 'g3',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'math-split',
  prereq: ['g2.math.times-tables'],
  objectives: [
    { id: 'zero', title: '0の かけ算《ざん》' },
    { id: 'ten', title: '10の かけ算《ざん》' },
    { id: 'next', title: 'かける数《かず》が 1 ふえると・へると' },
    { id: 'swap', title: 'かける数《かず》と かけられる数《かず》を 入《い》れかえる' },
    { id: 'split', title: '分《わ》けて 計算《けいさん》する' },
  ],
  misconceptions: [
    {
      id: 'zero-same',
      explain:
        '0を かけても 数《かず》が かわらないと 考《かんが》えたのかな。0こが いくつ あっても、いくつが 0こ あっても、答《こた》えは 0だよ。',
    },
    {
      id: 'add-one',
      explain:
        '答《こた》えが 1つ ずれたのかな。九九《くく》の 答《こた》えから、いくつ ふえるかを たしかめよう。',
    },
    {
      id: 'ten-add',
      explain:
        '10を たしたのかな。× 10 は 10を たすのでは なく、おなじ 数《かず》を 10こ あつめる ことだよ。',
    },
    {
      id: 'ten-zeros',
      explain: '0を 2こ つけたのかな。10を かけると、0は 1こ つくよ。',
    },
    {
      id: 'add-multiplier',
      explain:
        'かける数《かず》の ぶん ふえると 考《かんが》えたのかな。かける数《かず》が 1 ふえると、答《こた》えは かけられる数《かず》だけ ふえるよ。',
      figure: { kind: 'text', text: '6 × 8 ＝ 6 × 7 ＋ 6', size: 'l' },
    },
    {
      id: 'next-direction',
      explain:
        'ふえるか へるかを 反対《はんたい》に したのかな。かける数《かず》が 大《おお》きく なると 答《こた》えも 大《おお》きく なるよ。',
    },
    {
      id: 'swap-copy',
      explain:
        'おなじ 数《かず》を 書《か》いたのかな。入《い》れかえると、かけられる数《かず》が かける数《かず》の ところへ うつるよ。',
    },
    {
      id: 'whole-product',
      explain:
        'かけ算《ざん》の 答《こた》えを 書《か》いたのかな。□は かける数《かず》の ところに ある 数《かず》だよ。',
    },
    {
      id: 'split-whole',
      explain:
        '分《わ》けた かたほうを まちがえたのかな。10と □を あわせると もとの 数《かず》に なるよ。',
    },
    {
      id: 'split-forget',
      explain:
        '分《わ》けた 数《かず》の 1つに かけるのを わすれたのかな。分《わ》けた 2つとも おなじ 数《かず》を かけよう。',
      figure: { kind: 'text', text: '13 × 4 ＝ 10 × 4 ＋ 3 × 4', size: 'l' },
    },
  ],
  levels: [
    { label: '0と 10の かけ算', chance: 0.02 },
    { label: 'かける数と 答え・入れかえ', chance: 0.02 },
    { label: '分けて 計算', chance: 0.02 },
    { label: 'まとめ', chance: 0.02 },
  ],
  intro: [
    {
      text: '●が たて 4こ、よこ 6こ。4 × 6 ＝ 24。よこに 見《み》ると 6 × 4 ＝ 24。入《い》れかえても 答《こた》えは おなじです。',
      figure: dots(4, 6),
    },
    {
      text: '4 × 7 は 4 × 6 より 4 大《おお》きい。かける数《かず》が 1 ふえると、答《こた》えは かけられる数《かず》だけ ふえます。',
      figure: { kind: 'text', text: '4 × 7 ＝ 4 × 6 ＋ 4', size: 'xl' },
    },
    {
      text: '5 × 0 ＝ 0、0 × 5 ＝ 0。3 × 10 ＝ 30。13 × 4 は 10 × 4 と 3 × 4 に 分《わ》けて 40 ＋ 12 ＝ 52。',
      figure: dots(4, 13, 10),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateMultRules(level, rng, index),
  },
  review: 'type',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第3学年 A(3) 乗法（乗法に関して成り立つ性質、0の乗法、10の乗法）',
  revised: '2026-10-24',
};
