/**
 * g3.math.fractions 分数（等分・単位分数のいくつ分）、同分母で和が1までの加減（curriculum-matrix 3.6）。
 * テープ図 → 数直線（小数との関係）→ 2/5＋1/5。
 *
 * 範囲（本アプリの判断。research の EJM: 3年は真分数のみ・同分母で和が1まで）: 分母 2〜10、分子は分母以下。
 * 答えの形（2.4）: 分数で答える問題は fraction（約分は求めない。和が1のときは 1 でも 5/5 でもよい）。
 *   小数で答える問題は decimal。分数と小数の等価は「形式指定」（3年は形式指定が既定）。
 * 同一性キー: 問う形 × 分数（たし算は交換を同じとみる）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { NumberlineItem } from '../../engines/numberline/numberline';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { opts, pickObj, pickOne, wrongList } from './util';

type Obj = 'unit' | 'figure' | 'line' | 'compare' | 'add' | 'sub' | 'decimal';

const F = (k: number, n: number) => `[[${k}/${n}]]`;

/** 分母 nMin〜10、分子 kMin〜(分母+kMaxAdd) の組を 定義域から 均等に 1つ（分母だけ先に選ぶと 小さい分母に かたよる） */
function pickKN(rng: Rng, nMin: number, kMin: number, kMaxAdd: number): [number, number] {
  const all: [number, number][] = [];
  for (let n = nMin; n <= 10; n++) for (let k = kMin; k <= n + kMaxAdd; k++) all.push([k, n]);
  return pickOne(rng, all);
}
const frac = (num: number, den: number) => ({ kind: 'fraction' as const, num, den });

/** 1を n等分した テープの k こ分に ● の印（色だけで区別しない） */
const tape = (k: number, n: number): Figure => ({
  kind: 'tape',
  parts: Array.from({ length: n }, (_, i) =>
    i < k
      ? { length: 1, label: '●', tone: 'focus' as const }
      : { length: 1, tone: 'muted' as const },
  ),
  total: '1m',
});

function unit(level: number, rng: Rng, alt: boolean): NumberItem {
  const [k, n] = pickKN(rng, 2, 2, 0);
  const reverse = !alt && rng.next() < 0.5;
  if (reverse)
    return {
      engine: 'number',
      id: `unit-r:${k}/${n}`,
      objective: 'unit',
      level,
      prompt: `${F(k, n)}は、${F(1, n)}の 何《なん》こ分《ぶん》ですか。`,
      hints: [
        '分子《ぶんし》は、分母《ぶんぼ》の 数《かず》に 分《わ》けた 1つ分《ぶん》が いくつ あるかを あらわすよ。',
        `${F(1, n)}は 1を ${n}こに 分《わ》けた 1つ分《ぶん》。`,
        `${F(k, n)}の 分子《ぶんし》を 見《み》よう。`,
      ],
      explain: `${F(k, n)}は ${F(1, n)}の ${k}こ分《ぶん》です。`,
      identity: `unit-r:${k}/${n}`,
      alt: false,
      fields: [{ label: 'こ分《ぶん》', answer: { kind: 'int', value: k } }],
      wrongAnswers: wrongList(String(k), 1, [[n, 'den-as-count']]),
    };
  return {
    engine: 'number',
    id: `unit${alt ? '-alt' : ''}:${k}/${n}`,
    objective: 'unit',
    level,
    prompt: alt
      ? `1mの テープを ${n}こに 等分《とうぶん》しました。●の ところの 長《なが》さは 何《なん》mですか。分数《ぶんすう》で 答《こた》えよう。`
      : `${F(1, n)}の ${k}こ分《ぶん》は いくつですか。分数《ぶんすう》で 答《こた》えよう。`,
    figure: alt ? tape(k, n) : undefined,
    hints: [
      `${F(1, n)}は 1を ${n}こに 分《わ》けた 1つ分《ぶん》。`,
      `分母《ぶんぼ》は ${n}の まま。`,
      `${F(1, n)}が ${k}こ。分子《ぶんし》は いくつに なるかな。`,
    ],
    explain: `${F(1, n)}の ${k}こ分《ぶん》は ${F(k, n)}${k === n ? '。これは 1と おなじ 大《おお》きさ' : ''}です。`,
    identity: `unit:${k}/${n}`,
    alt,
    keys: ['fraction'],
    fields: [{ ...(alt ? { label: 'm' } : {}), answer: frac(k, n) }],
    wrongAnswers: wrongList(`${k}/${n}`, 1, [
      [`${k}/${k * n}`, 'mult-den'],
      [`1/${n * k}`, 'mult-den'],
      [`${n}/${k}`, 'num-den-swap'],
    ]),
  };
}

function figureItem(level: number, rng: Rng, alt: boolean): NumberItem | ChoiceItem {
  const [k, n] = pickKN(rng, 3, 1, -1);
  if (alt) {
    // 等分でない図を まちがいに ふくめて、k/n を あらわす図を えらぶ
    const uneven: Figure = {
      kind: 'tape',
      parts: [
        ...Array.from({ length: k }, () => ({ length: 1, label: '●', tone: 'focus' as const })),
        { length: Math.max(1, n - k - 1) * 2, tone: 'muted' as const },
      ],
      total: '1m',
    };
    return {
      engine: 'choice',
      id: `figure-alt:${k}/${n}`,
      objective: 'figure',
      level,
      prompt: `${F(k, n)}mを あらわして いる 図《ず》は どれ？（●の ところ）`,
      hints: [
        '1mを いくつに 分《わ》けて いるかな。',
        '同《おな》じ 長《なが》さに 分《わ》けて いるかも たしかめよう。',
        `${n}こに 等分《とうぶん》した ${k}こ分《ぶん》を さがそう。`,
      ],
      explain: `1mを ${n}こに 等分《とうぶん》した ${k}こ分《ぶん》が ${F(k, n)}mです。`,
      identity: `figure:${k}/${n}`,
      alt: true,
      layout: 'column',
      options: [
        { figure: tape(k, n), correct: true },
        ...(n - k !== k ? [{ figure: tape(n - k, n), misconception: 'part-to-part' }] : []),
        { figure: uneven, misconception: 'not-equal' },
        ...(k + 1 < n ? [{ figure: tape(k, n + 1), misconception: 'den-as-count' }] : []),
      ],
    };
  }
  return {
    engine: 'number',
    id: `figure:${k}/${n}`,
    objective: 'figure',
    level,
    prompt:
      '1mの テープを 等分《とうぶん》しました。●の ところは 何《なん》mですか。分数《ぶんすう》で 答《こた》えよう。',
    figure: tape(k, n),
    hints: [
      '1mを いくつに 等分《とうぶん》して いるかな。それが 分母《ぶんぼ》。',
      `${n}こに 分《わ》けて いるね。`,
      '●は いくつ あるかな。それが 分子《ぶんし》。',
    ],
    explain: `1mを ${n}こに 等分《とうぶん》した ${k}こ分《ぶん》なので ${F(k, n)}mです。`,
    identity: `figure:${k}/${n}`,
    alt: false,
    keys: ['fraction'],
    fields: [{ label: 'm', answer: frac(k, n) }],
    wrongAnswers: wrongList(`${k}/${n}`, 1, [
      [`${k}/${n - k}`, 'part-to-part'],
      [`${n - k}/${n}`, 'part-to-part'],
      [`${n}/${k}`, 'num-den-swap'],
    ]),
  };
}

function line(level: number, rng: Rng, alt: boolean): NumberlineItem {
  const [k, n] = pickKN(rng, 2, 1, -1);
  const base = {
    engine: 'numberline' as const,
    objective: 'line',
    level,
    line: { min: 0, max: 1, minor: `1/${n}`, majorEvery: n },
    misconceptions: { minorAsOne: 'minor-as-one', neighborTick: 'neighbor-tick' },
  };
  const hints = [
    '0と 1の あいだを いくつに 分《わ》けて いるかな。',
    `${n}こに 分《わ》けて いるので、1めもりは ${F(1, n)}。`,
    `0から ${F(1, n)}が いくつ分《ぶん》 すすんだかな。`,
  ];
  const explain = `1めもりは ${F(1, n)}。0から ${k}めもりで ${F(k, n)}です。`;
  if (alt)
    return {
      ...base,
      id: `line-alt:${k}/${n}`,
      prompt: `${F(k, n)}の ところを タップしよう。`,
      hints,
      explain,
      identity: `line-place:${k}/${n}`,
      alt: true,
      task: { kind: 'place', target: `${k}/${n}` },
    };
  return {
    ...base,
    id: `line:${k}/${n}`,
    prompt: '↓の ところの 数《かず》を 分数《ぶんすう》で 答《こた》えよう。',
    hints,
    explain,
    identity: `line:${k}/${n}`,
    alt: false,
    task: { kind: 'read', at: `${k}/${n}`, keys: ['fraction'] },
    wrongAnswers: [{ value: k, misconception: 'minor-as-one' }],
  };
}

function compare(level: number, rng: Rng, alt: boolean): ChoiceItem {
  if (alt) {
    const n = rng.int(2, 10);
    const k = rng.int(1, n);
    const rel = k < n ? '＜' : '＝';
    return {
      engine: 'choice',
      id: `compare-alt:${k}/${n}`,
      objective: 'compare',
      level,
      prompt: `□に あてはまる しるしは どれ？\n${F(k, n)} □ 1`,
      hints: [
        '1は、分母《ぶんぼ》と 分子《ぶんし》が おなじ 分数《ぶんすう》で あらわせるよ。',
        `1 ＝ ${F(n, n)}。`,
        `${F(k, n)} と ${F(n, n)} の 分子《ぶんし》を くらべよう。`,
      ],
      explain: `1 ＝ ${F(n, n)}。${F(k, n)} ${rel} 1 です。`,
      identity: `vs1:${k}/${n}`,
      alt: true,
      fixedOrder: true,
      options: [
        { label: '＞', misconception: 'frac-vs-one' },
        { label: '＜', ...(rel === '＜' ? { correct: true } : { misconception: 'frac-vs-one' }) },
        { label: '＝', ...(rel === '＝' ? { correct: true } : { misconception: 'frac-vs-one' }) },
      ],
    };
  }
  if (rng.next() < 0.5) {
    // 単位分数
    const ds = rng.sample([2, 3, 4, 5, 6, 8, 10], 3).sort((a, b) => a - b);
    return {
      engine: 'choice',
      id: `compare:unit:${ds.join('-')}`,
      objective: 'compare',
      level,
      prompt: 'いちばん 大《おお》きい 分数《ぶんすう》は どれ？',
      hints: [
        '1を いくつに 分《わ》けた 1つ分《ぶん》かを 考《かんが》えよう。',
        'たくさんに 分《わ》けるほど、1つ分《ぶん》は 小《ちい》さく なるよ。',
        '分母《ぶんぼ》が いちばん 小《ちい》さいのは どれかな。',
      ],
      explain: `分子《ぶんし》が 1の 分数《ぶんすう》は、分母《ぶんぼ》が 小《ちい》さいほど 大《おお》きい。いちばん 大《おお》きいのは ${F(1, ds[0]!)}です。`,
      identity: `cmp-unit:${ds.join('-')}`,
      alt: false,
      options: [
        { label: F(1, ds[0]!), correct: true },
        { label: F(1, ds[2]!), misconception: 'bigger-den-bigger' },
        { label: F(1, ds[1]!), misconception: 'bigger-den-bigger' },
      ],
    };
  }
  const n = rng.int(4, 10);
  const ks = rng
    .sample(
      Array.from({ length: n - 1 }, (_, i) => i + 1),
      3,
    )
    .sort((a, b) => a - b);
  return {
    engine: 'choice',
    id: `compare:same:${n}:${ks.join('-')}`,
    objective: 'compare',
    level,
    prompt: 'いちばん 大《おお》きい 分数《ぶんすう》は どれ？',
    hints: [
      '分母《ぶんぼ》が おなじ だね。',
      `どれも ${F(1, n)}の いくつ分《ぶん》かで くらべよう。`,
      '分子《ぶんし》が いちばん 大《おお》きいのは どれかな。',
    ],
    explain: `分母《ぶんぼ》が おなじ ときは、分子《ぶんし》が 大《おお》きいほど 大《おお》きい。いちばん 大《おお》きいのは ${F(ks[2]!, n)}です。`,
    identity: `cmp-same:${n}:${ks.join('-')}`,
    alt: false,
    options: opts(F(ks[2]!, n), [
      [F(ks[0]!, n), 'frac-compare'],
      [F(ks[1]!, n), 'frac-compare'],
    ]),
  };
}

function addSub(obj: 'add' | 'sub', level: number, rng: Rng, alt: boolean): NumberItem {
  // 定義域（[a, b, n]）から均等に選ぶ。ひき算の a＝n は「1 − b/n」
  const dom: [number, number, number][] = [];
  for (let n = 2; n <= 10; n++)
    for (let a = 1; a <= n; a++)
      for (let b = 1; b <= n; b++) {
        if (obj === 'add' ? a <= b && a + b <= n : b < a) dom.push([a, b, n]);
      }
  const [a0, b0, n] = pickOne(rng, dom);
  const [a, b] = obj === 'add' && rng.next() < 0.5 ? [b0, a0] : [a0, b0];
  const fromOne = obj === 'sub' && a === n;
  const ans = obj === 'add' ? a + b : a - b;
  const op = obj === 'add' ? '＋' : '−';
  const left = fromOne ? '1' : F(a, n);
  const key = obj === 'add' ? `${Math.min(a, b)}+${Math.max(a, b)}/${n}` : `${a}-${b}/${n}`;
  const scene =
    obj === 'add'
      ? `ジュースを、きのう ${F(a, n)}L、きょう ${F(b, n)}L のみました。あわせて 何《なん》L のみましたか。`
      : `${fromOne ? '1' : F(a, n)}mの リボンが あります。${F(b, n)}m 使《つか》うと、のこりは 何《なん》mですか。`;
  return {
    engine: 'number',
    id: `${obj}${alt ? '-alt' : ''}:${key}`,
    objective: obj,
    level,
    prompt: alt ? scene : '計算《けいさん》しよう。分数《ぶんすう》で 答《こた》えよう。',
    figure: alt
      ? undefined
      : { kind: 'text', text: `${left} ${op} ${F(b, n)} ＝ {{}}`, size: 'xl' },
    hints: [
      `${F(1, n)}の いくつ分《ぶん》かで 考《かんが》えよう。`,
      fromOne
        ? `1は ${F(n, n)}。${F(1, n)}が ${n}こ。`
        : `${F(a, n)}は ${F(1, n)}が ${a}こ、${F(b, n)}は ${b}こ。`,
      `${F(1, n)}が ${a} ${op} ${b} こ分《ぶん》。分母《ぶんぼ》は ${n}の まま。`,
    ],
    explain: `${F(1, n)}が ${a} ${op} ${b} ＝ ${ans}こ分《ぶん》で ${F(ans, n)}${ans === n ? '（＝1）' : ''}。${left} ${op} ${F(b, n)} ＝ ${ans === n ? '1' : F(ans, n)}です。`,
    identity: key,
    alt,
    keys: ['fraction'],
    fields: [{ ...(alt ? { label: obj === 'add' ? 'L' : 'm' } : {}), answer: frac(ans, n) }],
    wrongAnswers: wrongList(`${ans}/${n}`, 1, [
      [obj === 'add' ? `${a + b}/${n + n}` : null, 'add-dens'],
      [obj === 'sub' ? `${a + b}/${n}` : null, 'wrong-op'],
      [obj === 'sub' && fromOne ? `${b}/${n}` : null, 'sub-reverse'],
      [obj === 'sub' && fromOne ? `${n - b}/1` : null, 'one-as-whole'],
    ]),
  };
}

function decimal(level: number, rng: Rng, alt: boolean): NumberItem | NumberlineItem {
  const k = rng.int(1, 9);
  if (alt)
    return {
      engine: 'numberline',
      id: `decimal-alt:${k}`,
      objective: 'decimal',
      level,
      prompt: `数直線《すうちょくせん》の 上《うえ》には 0.1、0.2、…が あります。↓の ところの 数《かず》を 分数《ぶんすう》で 答《こた》えよう。`,
      hints: [
        '0と 1の あいだを 10こに 分《わ》けて いるよ。',
        `1めもりは 0.1、分数《ぶんすう》で ${F(1, 10)}。`,
        '0から いくつ めもり すすんだかな。',
      ],
      explain: `1めもりは ${F(1, 10)}（＝0.1）。${k}めもりで ${F(k, 10)}（＝0.${k}）です。`,
      identity: `dec-line:${k}`,
      alt: true,
      line: { min: 0, max: 1, minor: 0.1, midEvery: 5, majorEvery: 10 },
      task: { kind: 'read', at: k / 10, answer: frac(k, 10), keys: ['fraction'] },
      misconceptions: { minorAsOne: 'minor-as-one', neighborTick: 'neighbor-tick' },
      wrongAnswers: [{ value: k, misconception: 'minor-as-one' }],
    };
  const toDec = rng.next() < 0.5;
  return toDec
    ? {
        engine: 'number',
        id: `decimal:to:${k}`,
        objective: 'decimal',
        level,
        prompt: `${F(k, 10)}を 小数《しょうすう》で あらわそう。`,
        hints: [
          `${F(1, 10)}は 1を 10こに 分《わ》けた 1つ分《ぶん》。`,
          `${F(1, 10)} ＝ 0.1 だよ。`,
          `${F(k, 10)}は 0.1が ${k}こ分《ぶん》。`,
        ],
        explain: `${F(1, 10)} ＝ 0.1。${F(k, 10)}は 0.1が ${k}こで 0.${k}です。`,
        identity: `to-dec:${k}`,
        alt: false,
        keys: ['decimal'],
        fields: [{ answer: { kind: 'decimal', value: k / 10 } }],
        wrongAnswers: wrongList(`0.${k}`, 1, [
          [k, 'tenth-count'],
          [`0.0${k}`, 'tenth-count'],
        ]),
      }
    : {
        engine: 'number',
        id: `decimal:from:${k}`,
        objective: 'decimal',
        level,
        prompt: `0.${k}を 分数《ぶんすう》で あらわそう。`,
        hints: [
          '0.1は 1を 10こに 分《わ》けた 1つ分《ぶん》。',
          `0.1 ＝ ${F(1, 10)}。`,
          `0.${k}は 0.1が ${k}こ分《ぶん》。`,
        ],
        explain: `0.1 ＝ ${F(1, 10)}。0.${k}は ${F(1, 10)}が ${k}こで ${F(k, 10)}です。`,
        identity: `from-dec:${k}`,
        alt: false,
        keys: ['fraction'],
        fields: [{ answer: frac(k, 10) }],
        wrongAnswers: wrongList(`${k}/10`, 1, [
          [`1/${k}`, 'num-den-swap'],
          [`${k}/100`, 'tenth-count'],
        ]),
      };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['figure', 'unit'] },
  { objs: ['figure', 'unit', 'line', 'compare'] },
  { objs: ['add', 'sub', 'line', 'decimal'] },
  { objs: ['add', 'sub', 'compare', 'decimal', 'unit'] },
];

export function generateFractions(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.25;
  switch (obj) {
    case 'unit':
      return unit(level, rng, alt);
    case 'figure':
      return figureItem(level, rng, alt);
    case 'line':
      return line(level, rng, alt);
    case 'compare':
      return compare(level, rng, alt);
    case 'add':
    case 'sub':
      return addSub(obj, level, rng, alt);
    case 'decimal':
      return decimal(level, rng, alt);
  }
}

export const fractions: UnitSpec = {
  id: 'g3.math.fractions',
  title: '分数《ぶんすう》',
  stage: 'g3',
  subject: 'math',
  domain: 'A-number',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'math-split',
  prereq: ['g2.math.fraction-simple'],
  objectives: [
    { id: 'figure', title: '等分《とうぶん》した 大《おお》きさを 分数《ぶんすう》で' },
    { id: 'unit', title: '分子《ぶんし》が 1の 分数《ぶんすう》の いくつ分《ぶん》' },
    { id: 'line', title: '数直線《すうちょくせん》の 分数《ぶんすう》' },
    { id: 'compare', title: '分数《ぶんすう》の 大《おお》きさくらべ' },
    { id: 'add', title: '分数《ぶんすう》の たし算《ざん》' },
    { id: 'sub', title: '分数《ぶんすう》の ひき算《ざん》' },
    { id: 'decimal', title: '分数《ぶんすう》と 小数《しょうすう》' },
  ],
  misconceptions: [
    {
      id: 'mult-den',
      explain: `分母《ぶんぼ》も かけたのかな。${F(1, 5)}の 3こ分《ぶん》は、${F(1, 5)}が 3こ。分母《ぶんぼ》は 5の まま、分子《ぶんし》が 3に なるよ。`,
      figure: { kind: 'text', text: `${F(1, 5)} の 3こ分 ＝ ${F(3, 5)}`, size: 'l' },
    },
    {
      id: 'den-as-count',
      explain:
        '分母《ぶんぼ》の 数《かず》を 答《こた》えたのかな。分母《ぶんぼ》は 何《なん》こに 分《わ》けたか、分子《ぶんし》は その いくつ分《ぶん》かを あらわすよ。',
    },
    {
      id: 'num-den-swap',
      explain:
        '分母《ぶんぼ》と 分子《ぶんし》を 入《い》れかえたのかな。分《わ》けた 数《かず》が 下《した》（分母《ぶんぼ》）、いくつ分《ぶん》が 上《うえ》（分子《ぶんし》）だよ。',
    },
    {
      id: 'part-to-part',
      explain:
        'ぬって いない ところと くらべたのかな。分母《ぶんぼ》は 全部《ぜんぶ》で いくつに 分《わ》けたかの 数《かず》だよ。',
    },
    {
      id: 'not-equal',
      explain:
        '同《おな》じ 大《おお》きさに 分《わ》けて いない 図《ず》を えらんだのかな。分数《ぶんすう》は 等分《とうぶん》した 大《おお》きさで あらわすよ。',
    },
    {
      id: 'minor-as-one',
      explain:
        '1めもりを 1と 数《かぞ》えたのかな。0と 1の あいだを いくつに 分《わ》けて いるかを 見《み》よう。',
    },
    {
      id: 'neighbor-tick',
      explain: 'めもりを 1つ 数《かぞ》えまちがえたのかな。0から 1つずつ 数《かぞ》えよう。',
    },
    {
      id: 'bigger-den-bigger',
      explain: `分母《ぶんぼ》が 大《おお》きい ほうが 大《おお》きいと 考《かんが》えたのかな。たくさんに 分《わ》けるほど 1つ分《ぶん》は 小《ちい》さく なるよ。${F(1, 3)} ＞ ${F(1, 5)}。`,
    },
    {
      id: 'frac-compare',
      explain:
        '分母《ぶんぼ》が おなじ ときは、分子《ぶんし》が 大《おお》きい ほうが 大《おお》きいよ。',
    },
    {
      id: 'frac-vs-one',
      explain: `1を 分数《ぶんすう》に なおして くらべよう。1 ＝ ${F(5, 5)}。分子《ぶんし》が 分母《ぶんぼ》より 小《ちい》さい 分数《ぶんすう》は 1より 小《ちい》さいよ。`,
    },
    {
      id: 'add-dens',
      explain: `分母《ぶんぼ》どうしも たしたのかな。${F(1, 5)}の いくつ分《ぶん》かを たすので、分母《ぶんぼ》は そのままだよ。`,
      figure: { kind: 'text', text: `${F(2, 5)} ＋ ${F(1, 5)} ＝ ${F(3, 5)}`, size: 'l' },
    },
    {
      id: 'wrong-op',
      explain: 'たし算《ざん》を したのかな。「のこり」は ひき算《ざん》だよ。',
    },
    {
      id: 'sub-reverse',
      explain: 'ひく数《かず》を そのまま 答《こた》えたのかな。1から ひいた のこりを もとめよう。',
    },
    {
      id: 'one-as-whole',
      explain: `1の ままでは ひけないね。1を ${F(5, 5)}のように 分母《ぶんぼ》の おなじ 分数《ぶんすう》に なおそう。`,
    },
    {
      id: 'tenth-count',
      explain: `0.1と ${F(1, 10)}は おなじ 大《おお》きさ。0.1が 3こで 0.3、${F(1, 10)}が 3こで ${F(3, 10)}だよ。`,
    },
  ],
  levels: [
    { label: '等分と 分数', chance: 0.05 },
    { label: '数直線・くらべる', chance: 0.05 },
    { label: 'たし算・ひき算・小数', chance: 0.02 },
    { label: 'まとめ', chance: 0.02 },
  ],
  intro: [
    {
      text: `1mを 3こに 等分《とうぶん》した 1つ分《ぶん》の 長《なが》さを ${F(1, 3)}mと 書《か》き、「3分《ぶん》の 1メートル」と 読《よ》みます。`,
      figure: tape(1, 3),
    },
    {
      text: `${F(1, 5)}の 3こ分《ぶん》は ${F(3, 5)}。下《した》の 5を 分母《ぶんぼ》、上《うえ》の 3を 分子《ぶんし》と いいます。`,
      figure: tape(3, 5),
    },
    {
      text: `${F(2, 5)} ＋ ${F(1, 5)} は、${F(1, 5)}が 2 ＋ 1 ＝ 3こで ${F(3, 5)}。${F(1, 10)}は 0.1と おなじ 大《おお》きさです。`,
      figure: { kind: 'text', text: `${F(2, 5)} ＋ ${F(1, 5)} ＝ ${F(3, 5)}`, size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateFractions(level, rng, index),
  },
  review: 'type',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第3学年 A(6) 分数の意味と表し方（等分した大きさ、単位分数のいくつ分、簡単な場合の分数の加法・減法＝同分母・和が1まで）',
  revised: '2026-10-24',
};
