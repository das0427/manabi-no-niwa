/**
 * g3.math.bar-graph 表と棒グラフ（1目盛り 2・5・10・20・50・100）（curriculum-matrix 3.6）。
 * 棒の高さを読む → 目盛りの大きさ → 違いを読む → 棒グラフを作る（多い順・その他は最後）→ 二次元の表。
 *
 * データはすべて「れいの データ」（本アプリが作った例）。
 * 同一性キー: 問う形 × 題材 × 目盛り × 値（'read:sports:5:…:2'）。目盛りの大きさを問う問題は 目盛り × 数字の間隔。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { GraphItem } from '../../engines/graph/graph';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { pickObj, pickOne, wrongList } from './util';

type Obj = 'read' | 'scale' | 'compare' | 'make' | 'table';

interface Theme {
  id: string;
  title: string;
  labels: string[];
  unit: string;
}
const OTHER = 'その他《た》';
const THEMES: Theme[] = [
  {
    id: 'sports',
    title: 'すきな スポーツ',
    labels: ['サッカー', 'ドッジボール', '野球《やきゅう》', 'なわとび'],
    unit: '人《にん》',
  },
  {
    id: 'fruit',
    title: 'すきな くだもの',
    labels: ['りんご', 'みかん', 'いちご', 'バナナ'],
    unit: '人《にん》',
  },
  {
    id: 'pets',
    title: 'かって みたい 動物《どうぶつ》',
    labels: ['犬《いぬ》', 'ねこ', 'うさぎ', 'ハムスター'],
    unit: '人《にん》',
  },
  {
    id: 'play',
    title: 'すきな 遊《あそ》び',
    labels: ['おにごっこ', 'かくれんぼ', 'ブランコ', 'すな場《ば》'],
    unit: '人《にん》',
  },
  {
    id: 'cars',
    title: '学校《がっこう》の 前《まえ》を 通《とお》った 車《くるま》',
    labels: ['乗用車《じょうようしゃ》', 'トラック', 'バス', 'オートバイ'],
    unit: '台《だい》',
  },
  {
    id: 'books',
    title: '図書室《としょしつ》で かりた 本《ほん》',
    labels: ['物語《ものがたり》', 'ずかん', 'でんき', 'まんが'],
    unit: 'さつ',
  },
];
const STEPS = [2, 5, 10, 20, 50, 100] as const;

interface Data {
  theme: Theme;
  step: number;
  labels: string[];
  values: number[];
  key: string;
}

/** 題材と目盛りを えらび、ちがう高さの 棒（その他つき）を作る。sorted: 多い順に ならべる */
function makeData(rng: Rng, sorted: boolean): Data {
  const theme = pickOne(rng, THEMES);
  const step = pickOne(rng, STEPS);
  const ks = rng.sample(
    Array.from({ length: 16 }, (_, i) => i + 2),
    4,
  );
  const other = rng.int(1, Math.min(...ks) - 1);
  const pairs = theme.labels.map((l, i) => [l, ks[i]!] as const);
  const ordered = sorted ? [...pairs].sort((a, b) => b[1] - a[1]) : pairs;
  const labels = [...ordered.map((p) => p[0]), OTHER];
  const values = [...ordered.map((p) => p[1] * step), other * step];
  return { theme, step, labels, values, key: `${theme.id}:${step}:${values.join('-')}` };
}

const LABEL_EVERY = (step: number) =>
  step === 2 || step === 20 ? 5 : step === 5 || step === 50 ? 2 : 5;

function graphData(d: Data, max?: number, every = LABEL_EVERY(d.step)) {
  return {
    kind: 'bar' as const,
    labels: d.labels,
    values: d.values,
    scaleStep: d.step,
    labelEvery: every,
    unit: d.theme.unit,
    title: `${d.theme.title}（れいの データ）`,
    ...(max !== undefined ? { max } : {}),
  };
}

function read(level: number, rng: Rng, alt: boolean): GraphItem | NumberItem {
  const d = makeData(rng, true);
  const i = rng.int(0, d.labels.length - 1);
  const v = d.values[i]!;
  if (alt) {
    // 表で 読む（グラフと 同じ データ）
    return {
      engine: 'number',
      id: `read-alt:${d.key}:${i}`,
      objective: 'read',
      level,
      prompt: `表《ひょう》を 見《み》て 答《こた》えよう。${d.labels[i]}は 何《なん》${d.theme.unit}ですか。`,
      figure: {
        kind: 'table',
        header: [d.theme.title, `数《かず》（${d.theme.unit}）`],
        rows: d.labels
          .map((l, j) => [l, j === i ? '？' : String(d.values[j])])
          .concat([['合計《ごうけい》', String(d.values.reduce((s, x) => s + x, 0))]]),
      },
      hints: [
        '合計《ごうけい》から ほかの 数《かず》を ひいて もとめよう。',
        '合計《ごうけい》 − ほかの 数《かず》 ぜんぶ。',
        `ほかの 数《かず》の 合計《ごうけい》は ${d.values.reduce((s, x, j) => (j === i ? s : s + x), 0)}。`,
      ],
      explain: `合計《ごうけい》 ${d.values.reduce((s, x) => s + x, 0)}から ほかの 数《かず》の 合計《ごうけい》を ひいて ${v}です。`,
      identity: `table1:${d.key}:${i}`,
      alt: true,
      fields: [{ label: d.theme.unit, answer: { kind: 'int', value: v } }],
      wrongAnswers: wrongList(String(v), 1, [[d.values.reduce((s, x) => s + x, 0), 'table-total']]),
    };
  }
  return {
    engine: 'graph',
    id: `read:${d.key}:${i}`,
    objective: 'read',
    level,
    prompt: `${d.labels[i]}は 何《なん》${d.theme.unit}ですか。`,
    hints: [
      'まず 1めもりの 大《おお》きさを しらべよう。',
      `数字《すうじ》の ある めもりの あいだは いくつに 分《わ》かれて いるかな。1めもりは ${d.step}${d.theme.unit}。`,
      `${d.labels[i]}の ぼうは ${v / d.step}めもり。${d.step}が ${v / d.step}こで…`,
    ],
    explain: `1めもりは ${d.step}${d.theme.unit}。${d.labels[i]}の ぼうは ${v / d.step}めもりなので ${v}${d.theme.unit}です。`,
    identity: `read:${d.key}:${i}`,
    alt: false,
    data: graphData(d),
    task: {
      kind: 'number',
      fields: [{ label: d.theme.unit, answer: { kind: 'int', value: v } }],
      wrongAnswers: wrongList(String(v), 1, [
        [v / d.step, 'scale-as-one'],
        [v + d.step, 'neighbor-tick'],
        [v - d.step, 'neighbor-tick'],
      ]),
    },
  };
}

function scale(level: number, rng: Rng, alt: boolean): GraphItem {
  const d = makeData(rng, true);
  const every = pickOne(rng, [2, 5, 10]);
  if (alt) {
    // ぎゃく: 数を 何めもりの ぼうに するか
    const i = rng.int(0, 3);
    const v = d.values[i]!;
    return {
      engine: 'graph',
      id: `scale-alt:${d.key}:${i}`,
      objective: 'scale',
      level,
      prompt: `この グラフに ${d.labels[i]}の ${v}${d.theme.unit}を かくとき、ぼうは 何《なん》めもりの 高《たか》さに なりますか。`,
      hints: [
        'まず 1めもりの 大《おお》きさを しらべよう。',
        `1めもりは ${d.step}${d.theme.unit}。`,
        `${v}は ${d.step}の いくつ分《ぶん》かな。`,
      ],
      explain: `1めもりは ${d.step}${d.theme.unit}なので、${v} ÷ ${d.step} ＝ ${v / d.step}で ${v / d.step}めもりです。`,
      identity: `ticks:${d.step}:${v}`,
      alt: true,
      data: graphData(d, undefined, every),
      task: {
        kind: 'number',
        fields: [{ label: 'めもり', answer: { kind: 'int', value: v / d.step } }],
        wrongAnswers: wrongList(String(v / d.step), 1, [[v, 'scale-as-one']]),
      },
    };
  }
  return {
    engine: 'graph',
    id: `scale:${d.step}:${every}:${d.key}`,
    objective: 'scale',
    level,
    prompt: `この ぼうグラフの 1めもりは 何《なん》${d.theme.unit}ですか。`,
    hints: [
      '数字《すうじ》の ある めもりを 2つ 見《み》よう。',
      `数字《すうじ》は ${d.step * every}ずつ ふえて いるね。`,
      `その あいだは ${every}めもり。${d.step * every}を ${every}こに 分《わ》けると？`,
    ],
    explain: `数字《すうじ》の ある めもりの あいだ（${d.step * every}${d.theme.unit}）が ${every}めもりに 分《わ》かれて いるので、1めもりは ${d.step}${d.theme.unit}です。`,
    identity: `scale:${d.step}:${every}`,
    alt: false,
    data: graphData(d, undefined, every),
    task: {
      kind: 'number',
      fields: [{ label: d.theme.unit, answer: { kind: 'int', value: d.step } }],
      wrongAnswers: wrongList(String(d.step), 1, [
        [1, 'scale-as-one'],
        [d.step * every, 'label-as-step'],
      ]),
    },
  };
}

function compare(level: number, rng: Rng, alt: boolean): GraphItem {
  const d = makeData(rng, !alt);
  if (alt) {
    // ならべかえて いない グラフで いちばん 多いものと 少ないものの ちがい
    const four = d.values.slice(0, 4);
    const hi = four.indexOf(Math.max(...four));
    const lo = four.indexOf(Math.min(...four));
    const diff = four[hi]! - four[lo]!;
    return {
      engine: 'graph',
      id: `compare-alt:${d.key}`,
      objective: 'compare',
      level,
      prompt: `いちばん 多《おお》い ものと いちばん 少《すく》ない もの（その他《た》を のぞく）の ちがいは 何《なん》${d.theme.unit}ですか。`,
      hints: [
        'いちばん 高《たか》い ぼうと いちばん ひくい ぼうを さがそう。',
        `${d.labels[hi]}と ${d.labels[lo]}。めもりの ちがいは ${diff / d.step}めもり。`,
        `1めもりは ${d.step}${d.theme.unit}。`,
      ],
      explain: `いちばん 多《おお》いのは ${d.labels[hi]}（${four[hi]}${d.theme.unit}）、いちばん 少《すく》ないのは ${d.labels[lo]}（${four[lo]}${d.theme.unit}）。ちがいは ${diff}${d.theme.unit}です。`,
      identity: `range:${d.key}`,
      alt: true,
      data: graphData(d),
      task: {
        kind: 'number',
        fields: [{ label: d.theme.unit, answer: { kind: 'int', value: diff } }],
        wrongAnswers: wrongList(String(diff), 1, [
          [diff / d.step, 'scale-as-one'],
          [four[hi], 'diff-wrong'],
        ]),
      },
    };
  }
  const [i, j] = rng.sample([0, 1, 2, 3], 2).sort((a, b) => a - b) as [number, number];
  const diff = d.values[i]! - d.values[j]!;
  return {
    engine: 'graph',
    id: `compare:${d.key}:${i}-${j}`,
    objective: 'compare',
    level,
    prompt: `${d.labels[i]}は ${d.labels[j]}より 何《なん》${d.theme.unit} 多《おお》いですか。`,
    hints: [
      '1めもりの 大《おお》きさを たしかめよう。',
      `2つの ぼうの 高《たか》さの ちがいは ${diff / d.step}めもり。`,
      `${d.step}${d.theme.unit}が ${diff / d.step}こ分《ぶん》。`,
    ],
    explain: `${d.labels[i]}は ${d.values[i]}${d.theme.unit}、${d.labels[j]}は ${d.values[j]}${d.theme.unit}。${d.values[i]} − ${d.values[j]} ＝ ${diff}で ${diff}${d.theme.unit} 多《おお》いです。`,
    identity: `diff:${d.key}:${i}-${j}`,
    alt: false,
    data: graphData(d),
    task: {
      kind: 'number',
      fields: [{ label: d.theme.unit, answer: { kind: 'int', value: diff } }],
      wrongAnswers: wrongList(String(diff), 1, [
        [diff / d.step, 'scale-as-one'],
        [d.values[i]!, 'diff-wrong'],
        [d.values[i]! + d.values[j]!, 'diff-wrong'],
      ]),
    },
  };
}

const barFig = (labels: string[], values: number[], step: number, unit: string): Figure => ({
  kind: 'bar',
  labels,
  values,
  scaleStep: step,
  unit,
});

function make(level: number, rng: Rng, alt: boolean): GraphItem | ChoiceItem {
  if (alt) {
    // 正しい ならべ方の グラフを えらぶ
    const d = makeData(rng, true);
    const badOther = [...d.labels.slice(0, 4), OTHER];
    const badVals = [...d.values];
    // その他を 多い順の 中に 入れた（その他が いちばん少ないので 最後と同じになる → 2番目に置く）
    badOther.splice(4, 1);
    badOther.splice(1, 0, OTHER);
    badVals.splice(4, 1);
    badVals.splice(1, 0, d.values[4]!);
    const unsortedOrder = [3, 1, 0, 2, 4];
    return {
      engine: 'choice',
      id: `make-alt:${d.key}`,
      objective: 'make',
      level,
      prompt: `${d.theme.title}を ぼうグラフに しました。ならべ方《かた》が 正《ただ》しい グラフは どれ？`,
      hints: [
        'ぼうグラフは、ふつう 多《おお》い じゅんに ならべるよ。',
        '「その他《た》」は 数《かず》が 多《おお》くても さいごに かくよ。',
        '多《おお》い じゅん、その他《た》は さいご、に なって いるのは どれかな。',
      ],
      explain: `ぼうグラフは 多《おお》い じゅんに ならべ、「その他《た》」は さいごに かきます。`,
      identity: `order:${d.key}`,
      alt: true,
      layout: 'column',
      options: [
        { figure: barFig(d.labels, d.values, d.step, d.theme.unit), correct: true },
        { figure: barFig(badOther, badVals, d.step, d.theme.unit), misconception: 'other-last' },
        {
          figure: barFig(
            unsortedOrder.map((k) => d.labels[k]!),
            unsortedOrder.map((k) => d.values[k]!),
            d.step,
            d.theme.unit,
          ),
          misconception: 'order-sort',
        },
      ],
    };
  }
  const d = makeData(rng, true);
  const maxV = Math.max(...d.values);
  const max = (Math.floor(maxV / d.step / 5) + 2) * 5 * d.step;
  return {
    engine: 'graph',
    id: `make:${d.key}`,
    objective: 'make',
    level,
    prompt: `表《ひょう》の 数《かず》を ぼうグラフに あらわそう。1めもりは ${d.step}${d.theme.unit}です。`,
    hints: [
      `1めもりは ${d.step}${d.theme.unit}。`,
      `${d.labels[0]}の ${d.values[0]}は ${d.values[0]! / d.step}めもり。`,
      `ほかの 数《かず》も ${d.step}で わって、何《なん》めもりか 考《かんが》えよう。`,
    ],
    explain: `1めもり ${d.step}${d.theme.unit}なので、${d.labels.map((l, k) => `${l}は ${d.values[k]! / d.step}めもり`).join('、')}です。`,
    identity: `make:${d.key}`,
    alt: false,
    data: graphData(d, max),
    task: { kind: 'make', showTable: true },
    misconceptions: { scaleAsOne: 'scale-as-one' },
  };
}

/** 二次元の表（クラス × すきな もの） */
function table(level: number, rng: Rng, alt: boolean): NumberItem | ChoiceItem {
  const theme = pickOne(
    rng,
    THEMES.filter((t) => t.unit === '人《にん》'),
  );
  const items = theme.labels.slice(0, 3);
  let a: number[];
  let b: number[];
  do {
    a = items.map(() => rng.int(2, 15));
    b = items.map(() => rng.int(2, 15));
  } while (new Set(a).size < 3 || new Set(b).size < 3);
  const colSum = items.map((_, k) => a[k]! + b[k]!);
  const rowA = a.reduce((s, x) => s + x, 0);
  const rowB = b.reduce((s, x) => s + x, 0);
  const grand = rowA + rowB;
  const key = `${theme.id}:${a.join('-')}:${b.join('-')}`;
  const header = ['', ...items, '合計《ごうけい》'];
  if (alt) {
    const maxB = items[b.indexOf(Math.max(...b))]!;
    const maxA = items[a.indexOf(Math.max(...a))]!;
    const maxT = items[colSum.indexOf(Math.max(...colSum))]!;
    const options: ChoiceItem['options'] = [{ label: maxB, correct: true }];
    if (maxA !== maxB) options.push({ label: maxA, misconception: 'table-row' });
    if (maxT !== maxB && maxT !== maxA) options.push({ label: maxT, misconception: 'table-total' });
    for (const it of items)
      if (!options.some((o) => o.label === it))
        options.push({ label: it, misconception: 'table-row' });
    return {
      engine: 'choice',
      id: `table-alt:${key}`,
      objective: 'table',
      level,
      prompt: `${theme.title}を クラスごとに しらべました（れいの データ）。2組《くみ》で いちばん 多《おお》いのは どれですか。`,
      figure: {
        kind: 'table',
        header,
        rows: [
          ['1組《くみ》', ...a.map(String), String(rowA)],
          ['2組《くみ》', ...b.map(String), String(rowB)],
          ['合計《ごうけい》', ...colSum.map(String), String(grand)],
        ],
      },
      hints: [
        '2組《くみ》の 行《ぎょう》を よこに 見《み》よう。',
        '1組《くみ》や 合計《ごうけい》の 行《ぎょう》と まちがえないように。',
        `2組《くみ》の 数《かず》は ${b.join('、')}。いちばん 大《おお》きいのは？`,
      ],
      explain: `2組《くみ》の 行《ぎょう》を 見《み》ると、いちばん 多《おお》いのは ${maxB}（${Math.max(...b)}人《にん》）です。`,
      identity: `table-max:${key}`,
      alt: true,
      options: options.slice(0, 3),
    };
  }
  const ask = pickOne(rng, ['col', 'row', 'grand'] as const);
  const k = rng.int(0, 2);
  const ans = ask === 'col' ? colSum[k]! : ask === 'row' ? rowB : grand;
  const q = (r: number, c: number) => {
    // 問う ところだけ ？。合計の ほかの らんも 空ける（答えが 見えないように）
    if (ask === 'grand' && r === 2 && c === 3) return '？';
    if (ask === 'col' && r === 2 && c === k) return '？';
    if (ask === 'row' && r === 1 && c === 3) return '？';
    if (r === 2 || c === 3) return '';
    return String(r === 0 ? a[c] : b[c]);
  };
  return {
    engine: 'number',
    id: `table:${ask}:${k}:${key}`,
    objective: 'table',
    level,
    prompt:
      ask === 'col'
        ? `${theme.title}を クラスごとに しらべました（れいの データ）。${items[k]}を えらんだ 人《ひと》は、2つの クラスで あわせて 何《なん》人《にん》ですか。`
        : ask === 'row'
          ? `${theme.title}を クラスごとに しらべました（れいの データ）。2組《くみ》で しらべた 人《ひと》は、あわせて 何《なん》人《にん》ですか。`
          : `${theme.title}を クラスごとに しらべました（れいの データ）。しらべた 人《ひと》は、全部《ぜんぶ》で 何《なん》人《にん》ですか。`,
    figure: {
      kind: 'table',
      header,
      rows: [0, 1, 2].map((r) => [
        ['1組《くみ》', '2組《くみ》', '合計《ごうけい》'][r]!,
        ...[0, 1, 2, 3].map((c) => q(r, c)),
      ]),
    },
    hints: [
      ask === 'col'
        ? `${items[k]}の 列《れつ》を たてに 見《み》よう。`
        : ask === 'row'
          ? '2組《くみ》の 行《ぎょう》を よこに 見《み》よう。'
          : '1組《くみ》と 2組《くみ》の 全部《ぜんぶ》を あわせよう。',
      ask === 'col'
        ? `1組《くみ》 ${a[k]}人《にん》、2組《くみ》 ${b[k]}人《にん》。`
        : ask === 'row'
          ? `2組《くみ》は ${b.join('、')}。`
          : `1組《くみ》は ${a.join('、')}、2組《くみ》は ${b.join('、')}。`,
      'たし算《ざん》で あわせよう。',
    ],
    explain:
      ask === 'col'
        ? `${a[k]} ＋ ${b[k]} ＝ ${ans}で ${ans}人《にん》です。`
        : ask === 'row'
          ? `${b.join(' ＋ ')} ＝ ${ans}で ${ans}人《にん》です。`
          : `1組《くみ》 ${rowA}人《にん》、2組《くみ》 ${rowB}人《にん》で、${rowA} ＋ ${rowB} ＝ ${ans}人《にん》です。`,
    identity: ask === 'col' ? `table:col:${k}:${key}` : `table:${ask}:${key}`,
    alt: false,
    fields: [{ label: '人《にん》', answer: { kind: 'int', value: ans } }],
    wrongAnswers: wrongList(String(ans), 1, [
      [ask === 'col' ? b[k] : ask === 'row' ? b[0] : rowB, 'table-total'],
      [ask === 'grand' ? rowA : ask === 'col' ? a[k] : rowA, 'table-total'],
    ]),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['read', 'scale'] },
  { objs: ['read', 'scale', 'compare'] },
  { objs: ['make', 'compare', 'read'] },
  { objs: ['make', 'table', 'compare', 'scale'] },
];

export function generateBarGraph(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.25;
  switch (obj) {
    case 'read':
      return read(level, rng, alt);
    case 'scale':
      return scale(level, rng, alt);
    case 'compare':
      return compare(level, rng, alt);
    case 'make':
      return make(level, rng, alt);
    case 'table':
      return table(level, rng, alt);
  }
}

export const barGraph: UnitSpec = {
  id: 'g3.math.bar-graph',
  title: '表《ひょう》と ぼうグラフ',
  stage: 'g3',
  subject: 'math',
  domain: 'D-data',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-sorting',
  prereq: ['g2.math.tables-graphs'],
  objectives: [
    { id: 'read', title: 'ぼうグラフを 読《よ》む' },
    { id: 'scale', title: '1めもりの 大《おお》きさ' },
    { id: 'compare', title: 'ちがいを 読《よ》む' },
    { id: 'make', title: 'ぼうグラフを かく（ならべ方《かた》）' },
    { id: 'table', title: '2つの ことを まとめた 表《ひょう》' },
  ],
  misconceptions: [
    {
      id: 'scale-as-one',
      explain:
        '1めもりを 1と 数《かぞ》えたのかな。数字《すうじ》の ある めもりを 見《み》て、1めもりの 大《おお》きさを 先《さき》に たしかめよう。',
      figure: { kind: 'text', text: '0 → 10 が 2めもり → 1めもり 5', size: 'l' },
    },
    {
      id: 'neighbor-tick',
      explain:
        'めもりを 1つ 読《よ》みまちがえたのかな。ぼうの 先《さき》から よこに 線《せん》を のばして 読《よ》もう。',
    },
    {
      id: 'label-as-step',
      explain:
        '数字《すうじ》の 書《か》いて ある めもりの 間《あいだ》を 1めもりと 考《かんが》えたのかな。小《ちい》さい めもりも 数《かぞ》えよう。',
    },
    {
      id: 'diff-wrong',
      explain:
        '「何《なん》人《にん》 多《おお》い」は ちがいを もとめるよ。大《おお》きい 数《かず》から 小《ちい》さい 数《かず》を ひこう。',
    },
    {
      id: 'scale-choice',
      explain:
        'めもりが 小《ちい》さすぎると グラフに 入《はい》らないし、大《おお》きすぎると ちがいが 見《み》えにくいよ。いちばん 大《おお》きい 数《かず》が 入《はい》る めもりを えらぼう。',
    },
    {
      id: 'order-sort',
      explain:
        'ならべ方《かた》を 見《み》まちがえたのかな。ぼうグラフは ふつう 多《おお》い じゅんに ならべ、「その他《た》」は さいごに かくよ。',
    },
    {
      id: 'other-last',
      explain:
        '「その他《た》」は いくつかの ものを まとめた ものなので、数《かず》に かかわらず さいごに かくよ。',
    },
    {
      id: 'table-total',
      explain:
        '表《ひょう》の 見《み》る ところを まちがえたのかな。たての 列《れつ》と よこの 行《ぎょう》を 指《ゆび》で たどって、あわせる 数《かず》を たしかめよう。',
    },
    {
      id: 'table-row',
      explain:
        'ちがう 行《ぎょう》を 見《み》たのかな。「2組《くみ》」の 行《ぎょう》を よこに たどろう。',
    },
  ],
  levels: [
    { label: 'ぼうグラフを 読む', chance: 0.05 },
    { label: 'ちがいを 読む', chance: 0.05 },
    { label: 'ぼうグラフを かく', chance: 0.05 },
    { label: '2つの ことの 表', chance: 0.05 },
  ],
  intro: [
    {
      text: '数《かず》の 大《おお》きさを ぼうの 長《なが》さで あらわした グラフを ぼうグラフと いいます。ふつう 多《おお》い じゅんに ならべ、「その他《た》」は さいごに かきます。（れいの データ）',
      figure: barFig(
        ['サッカー', 'ドッジボール', 'なわとび', OTHER],
        [12, 8, 6, 3],
        1,
        '人《にん》',
      ),
    },
    {
      text: 'まず 1めもりの 大《おお》きさを しらべます。0と 10の あいだが 5めもりなら、1めもりは 2です。',
      figure: barFig(['A', 'B', 'C'], [14, 8, 20], 2, '人《にん》'),
    },
    {
      text: '2つの こと（クラスと すきな もの）を 1つの 表《ひょう》に まとめると、くらべやすく、合計《ごうけい》も わかります。',
      figure: {
        kind: 'table',
        header: ['', 'りんご', 'みかん', '合計《ごうけい》'],
        rows: [
          ['1組《くみ》', '8', '5', '13'],
          ['2組《くみ》', '6', '9', '15'],
          ['合計《ごうけい》', '14', '14', '28'],
        ],
      },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateBarGraph(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第3学年 D(1) 表と棒グラフ（日時・場所などの観点から分類整理、簡単な二次元の表、棒グラフの読み方・かき方。目盛りは2・5・20・50など）',
  revised: '2026-10-24',
};
