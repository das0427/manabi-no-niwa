/**
 * g2.math.tables-graphs 分類整理、簡単な表とグラフ（curriculum-matrix 3.5）。
 * 種類ごとに数えて表 → ○のグラフ → 何こ多い。
 *
 * エンジン: graph（表・○のグラフを読む・作る）と number（絵を数えて表にする）。
 * データは本アプリの例（実在の調査ではない）。
 * 同一性キー: 問う形 × 項目の組 × 値の組（× 問う項目）。項目の絵柄は同じとみる。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { GraphItem } from '../../engines/graph/graph';
import type { Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { pickObj, wrongList } from './util';

type Obj = 'count' | 'read' | 'compare' | 'make';

interface Topic {
  id: string;
  title: string;
  head: string;
  unit: string;
  labels: string[];
  illust?: string[];
}

const TOPICS: Topic[] = [
  {
    id: 'fruit',
    title: 'すきな くだもの',
    head: 'くだもの',
    unit: '人《にん》',
    labels: ['りんご', 'みかん', 'いちご', 'もも'],
    illust: ['apple', 'mikan', 'strawberry', 'peach'],
  },
  {
    id: 'pet',
    title: 'かいたい どうぶつ',
    head: 'どうぶつ',
    unit: '人《にん》',
    labels: ['いぬ', 'ねこ', 'うさぎ', 'かめ'],
    illust: ['dog', 'cat', 'rabbit', 'turtle'],
  },
  {
    id: 'veg',
    title: 'はたけで とれた やさい',
    head: 'やさい',
    unit: 'こ',
    labels: ['トマト', 'なす', 'きゅうり', 'にんじん'],
    illust: ['tomato', 'eggplant', 'cucumber', 'carrot'],
  },
  {
    id: 'ride',
    title: 'のって みたい のりもの',
    head: 'のりもの',
    unit: '人《にん》',
    labels: ['でんしゃ', 'バス', 'ふね', 'ひこうき'],
    illust: ['train', 'bus-yellow', 'ship', 'airplane'],
  },
  {
    id: 'play',
    title: 'すきな あそび',
    head: 'あそび',
    unit: '人《にん》',
    labels: ['おにごっこ', 'なわとび', 'ボール', 'すなば'],
  },
  {
    id: 'weather',
    // 「6月の てんき」だと 合計が 30にちに ならず おかしいので、期間を 言わない
    title: 'てんきしらべ（れいの データ）',
    head: 'てんき',
    unit: 'にち',
    labels: ['はれ', 'くもり', 'あめ'],
  },
];

/** 数える しるし（形が ちがう） */
const SHAPE_SETS: { mark: string; name: string }[][] = [
  [
    { mark: '●', name: 'まる' },
    { mark: '▲', name: 'さんかく' },
    { mark: '■', name: 'しかく' },
  ],
  [
    { mark: '★', name: 'ほし' },
    { mark: '●', name: 'まる' },
    { mark: '◆', name: 'ひしがた' },
  ],
];

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['count', 'read', 'make'] },
  { objs: ['count', 'read', 'compare', 'make'] },
];

/** 値（1〜8。いちばん大きい項目が1つに決まるように） */
function values(rng: Rng, n: number): number[] {
  for (;;) {
    const v = Array.from({ length: n }, () => rng.int(1, 8));
    const mx = Math.max(...v);
    const mn = Math.min(...v);
    if (v.filter((x) => x === mx).length === 1 && v.filter((x) => x === mn).length === 1) return v;
  }
}

const vkey = (t: Topic, v: number[]) => `${t.id}:${v.join('-')}`;

/** 絵を数えて 表に（alt: 表から ぜんぶの数） */
function count(level: number, rng: Rng, alt: boolean): NumberItem | GraphItem {
  if (alt) {
    const t = TOPICS[rng.int(0, TOPICS.length - 1)]!;
    const v = values(rng, t.labels.length);
    const total = v.reduce((s, x) => s + x, 0);
    return {
      engine: 'graph',
      id: `count-alt:${vkey(t, v)}`,
      objective: 'count',
      level,
      prompt: `${t.title}を ひょうに しました。ぜんぶで なん${t.unit === 'こ' ? 'こ' : t.unit === 'にち' ? 'にち' : '人《にん》'}？`,
      hints: [
        'ひょうの かずを ぜんぶ たそう。',
        `${v.slice(0, 2).join(' ＋ ')} から じゅんに たそう。`,
        `${v.slice(0, -1).reduce((s, x) => s + x, 0)}に のこりの ${v[v.length - 1]}を たすと？`,
      ],
      explain: `${v.join(' ＋ ')} ＝ ${total}。ぜんぶで ${total}${t.unit}です。`,
      identity: `count-total:${vkey(t, v)}`,
      alt: true,
      data: {
        kind: 'table',
        labels: t.labels,
        values: v,
        header: [t.head, 'かず'],
        title: t.title,
      },
      task: {
        kind: 'number',
        fields: [{ label: 'ぜんぶで', answer: { kind: 'int', value: total } }],
        wrongAnswers: wrongList(String(total), 1, [
          [total - 1, 'count-miss'],
          [total + 1, 'count-miss'],
          [Math.max(...v), 'one-value'],
        ]),
      },
    };
  }
  // 3しゅるいの しるし（形で区別する。色だけに頼らない）を まぜて ならべる
  const shapes = SHAPE_SETS[rng.int(0, SHAPE_SETS.length - 1)]!;
  const t = { labels: shapes.map((s) => s.name), id: shapes.map((s) => s.mark).join('') };
  const v = Array.from({ length: 3 }, () => rng.int(1, 6));
  const seq: number[] = rng.shuffle(v.flatMap((x, i) => Array.from({ length: x }, () => i)));
  const rows: string[] = [];
  for (let k = 0; k < seq.length; k += 6)
    rows.push(
      seq
        .slice(k, k + 6)
        .map((i) => shapes[i]!.mark)
        .join(' '),
    );
  const fig: Figure = {
    kind: 'column',
    gap: 1,
    items: rows.map((r) => ({ kind: 'text', text: r, size: 'xl' })),
  };
  return {
    engine: 'number',
    id: `count:${t.id}:${v.join('-')}`,
    objective: 'count',
    level,
    prompt: `しるしを しゅるいごとに かぞえて、ひょうに かこう。`,
    figure: fig,
    fields: v.map((x, i) => ({ label: t.labels[i]!, answer: { kind: 'int', value: x } })),
    hints: [
      '1しゅるいずつ かぞえよう。かぞえた しるしは ゆびで おさえよう。',
      `${t.labels[0]}だけを さがして かぞえよう。`,
      `ぜんぶ たすと しるしの かず ${seq.length}に なるか たしかめよう。`,
    ],
    explain: `${t.labels.map((l, i) => `${l} ${v[i]}`).join('、')}。しゅるいごとに かぞえると ひょうに できます。`,
    identity: `count:${t.id}:${v.join('-')}`,
    alt: false,
    wrongAnswers: wrongList(v.join('|'), 3, [
      [v.map((x, i) => (i === 0 ? x + 1 : x)).join('|'), 'count-miss'],
      [v.map((x, i) => (i === 0 ? x - 1 : x)).join('|'), 'count-miss'],
      [v.map((x, i) => (i === 1 ? x + 1 : x)).join('|'), 'count-miss'],
      [v.map((x, i) => (i === 1 ? x - 1 : x)).join('|'), 'count-miss'],
    ]),
  };
}

/** ○の グラフを 読む（alt: 表から） */
function read(level: number, rng: Rng, alt: boolean): GraphItem {
  const t = TOPICS[rng.int(0, TOPICS.length - 1)]!;
  const v = values(rng, t.labels.length);
  const i = rng.int(0, v.length - 1);
  const unitWord = t.unit === 'こ' ? 'こ' : t.unit === 'にち' ? 'にち' : '人《にん》';
  return {
    engine: 'graph',
    id: `read${alt ? '-alt' : ''}:${vkey(t, v)}:${i}`,
    objective: 'read',
    level,
    prompt: `${t.labels[i]}は なん${unitWord}？`,
    hints: alt
      ? [
          'ひょうの なかから その なまえを さがそう。',
          `${t.labels[i]}の よこの かずを みよう。`,
          'みつけた かずを かこう。',
        ]
      : [
          '○の グラフは ○ 1こが 1を あらわすよ。',
          `${t.labels[i]}の ○を したから かぞえよう。`,
          '1、2、3、…と ゆびで おさえて かぞえよう。',
        ],
    explain: `${t.labels[i]}は ${v[i]}${t.unit}です。`,
    identity: `read:${vkey(t, v)}:${i}${alt ? ':table' : ''}`,
    alt,
    data: alt
      ? { kind: 'table', labels: t.labels, values: v, header: [t.head, 'かず'], title: t.title }
      : { kind: 'picture', labels: t.labels, values: v, max: 8, unit: t.unit, title: t.title },
    task: {
      kind: 'number',
      fields: [{ label: t.labels[i], answer: { kind: 'int', value: v[i]! } }],
      wrongAnswers: wrongList(String(v[i]), 1, [
        [v[i]! + 1, 'count-miss'],
        [v[i]! - 1 > 0 ? v[i]! - 1 : null, 'count-miss'],
        ...v.filter((_, j) => j !== i).map((x) => [x, 'wrong-column'] as [number, string]),
      ]),
    },
  };
}

/** いくつ 多い（alt: いちばん 多い・少ない を選ぶ） */
function compare(level: number, rng: Rng, alt: boolean): GraphItem {
  const t = TOPICS[rng.int(0, TOPICS.length - 1)]!;
  const v = values(rng, t.labels.length);
  if (alt) {
    const most = rng.next() < 0.5;
    const target = most ? Math.max(...v) : Math.min(...v);
    const opposite = most ? Math.min(...v) : Math.max(...v);
    const opts = t.labels
      .slice(0, 4)
      .map((l, j) =>
        v[j] === target
          ? { label: l, correct: true }
          : { label: l, misconception: v[j] === opposite ? 'most-least' : 'not-tallest' },
      );
    return {
      engine: 'graph',
      id: `compare-alt:${vkey(t, v)}:${most ? 'most' : 'least'}`,
      objective: 'compare',
      level,
      prompt: `いちばん ${most ? 'おおい' : 'すくない'}のは どれ？`,
      hints: [
        'ひょうの かずを くらべよう。',
        most ? 'いちばん おおきい かずを さがそう。' : 'いちばん ちいさい かずを さがそう。',
        `${v.join('、')} の なかで ${most ? 'いちばん おおきい' : 'いちばん ちいさい'} かずは？`,
      ],
      explain: `${t.labels[v.indexOf(target)]}が ${target}${t.unit}で いちばん ${most ? 'おおい' : 'すくない'}です。`,
      identity: `compare-most:${vkey(t, v)}:${most ? 'most' : 'least'}`,
      alt: true,
      data: {
        kind: 'table',
        labels: t.labels,
        values: v,
        header: [t.head, 'かず'],
        title: t.title,
      },
      task: { kind: 'choice', options: opts },
    };
  }
  let i: number;
  let j: number;
  do {
    i = rng.int(0, v.length - 1);
    j = rng.int(0, v.length - 1);
  } while (i === j || v[i] === v[j]);
  if (v[i]! < v[j]!) [i, j] = [j, i];
  const d = v[i]! - v[j]!;
  return {
    engine: 'graph',
    id: `compare:${vkey(t, v)}:${i}-${j}`,
    objective: 'compare',
    level,
    prompt: `${t.labels[i]}は ${t.labels[j]}より いくつ おおい？`,
    hints: [
      '2つの ○の たかさを くらべよう。',
      `${t.labels[i]}は ${v[i]}、${t.labels[j]}は ${v[j]}。`,
      `たかさの ちがいの ○を かぞえよう（${v[i]} − ${v[j]}）。`,
    ],
    explain: `${v[i]} − ${v[j]} ＝ ${d}。${t.labels[i]}の ほうが ${d}${t.unit} おおいです。`,
    identity: `compare:${vkey(t, v)}:${i}-${j}`,
    alt: false,
    data: { kind: 'picture', labels: t.labels, values: v, max: 8, unit: t.unit, title: t.title },
    task: {
      kind: 'number',
      fields: [{ answer: { kind: 'int', value: d } }],
      wrongAnswers: wrongList(String(d), 1, [
        [v[i]! + v[j]!, 'add-instead'],
        [v[i]!, 'one-value'],
        [v[j]!, 'one-value'],
      ]),
    },
  };
}

/** ○の グラフを 作る（alt: まちがいを なおす） */
function make(level: number, rng: Rng, alt: boolean): GraphItem {
  const t = TOPICS[rng.int(0, TOPICS.length - 1)]!;
  const v = values(rng, t.labels.length);
  let initial: number[] | undefined;
  if (alt) {
    // 1つの ○の かずが ちがう グラフを なおす
    const k = rng.int(0, v.length - 1);
    initial = v.map((x, j) => (j === k ? (x === 8 ? x - 1 : x + 1) : x));
  }
  return {
    engine: 'graph',
    id: `make${alt ? '-alt' : ''}:${vkey(t, v)}`,
    objective: 'make',
    level,
    prompt: alt
      ? `ひょうを みて かいた ○の グラフに、1つ まちがいが あります。なおそう。`
      : `ひょうを みて、○の グラフを かこう。`,
    hints: [
      '○ 1こが 1 だよ。したから じゅんに つもう。',
      alt
        ? 'ひょうの かずと グラフの ○の かずを 1つずつ くらべよう。'
        : `${t.labels[0]}は ${v[0]}。${v[0]}この たかさまで。`,
      alt
        ? 'かずが ちがう ところの ○を ふやすか へらそう。'
        : 'のこりも ひょうの かずの たかさまで かこう。',
    ],
    explain: `${t.labels.map((l, j) => `${l} ${v[j]}`).join('、')}。ひょうの かずだけ ○を つみます。`,
    identity: `make:${vkey(t, v)}${alt ? ':fix' : ''}`,
    alt,
    data: {
      kind: 'picture',
      labels: t.labels,
      values: v,
      max: 8,
      unit: t.unit,
      header: [t.head, 'かず'],
      title: t.title,
    },
    task: { kind: 'make', showTable: true, ...(initial ? { initial } : {}) },
  };
}

export function generateTablesGraphs(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'count':
      return count(level, rng, alt);
    case 'read':
      return read(level, rng, alt);
    case 'compare':
      return compare(level, rng, alt);
    case 'make':
      return make(level, rng, alt);
  }
}

export const tablesGraphs: UnitSpec = {
  id: 'g2.math.tables-graphs',
  title: 'ひょうと グラフ',
  stage: 'g2',
  subject: 'math',
  domain: 'D-data',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-sorting',
  prereq: ['g1.math.picture-graph'],
  objectives: [
    { id: 'count', title: 'しゅるいごとに かぞえて ひょうに する' },
    { id: 'read', title: 'グラフ・ひょうを よむ' },
    { id: 'compare', title: 'いくつ おおい・いちばん おおい' },
    { id: 'make', title: '○の グラフを かく' },
  ],
  misconceptions: [
    {
      id: 'count-miss',
      explain: 'かぞえまちがいかな。かぞえた ものに しるしを つけて、1つずつ かぞえよう。',
    },
    {
      id: 'wrong-column',
      explain:
        'となりの なまえの かずを よんだのかな。なまえと ○（かず）を ゆびで たどって みよう。',
    },
    {
      id: 'add-instead',
      explain: '2つの かずを たしたのかな。「いくつ おおい」は ちがいなので、ひきざん だよ。',
    },
    {
      id: 'one-value',
      explain: '1つの かずだけ みたのかな。2つの かずの ちがいを もとめよう。',
    },
    {
      id: 'most-least',
      explain:
        '「おおい」と「すくない」を はんたいに したのかな。○が いちばん たかい ところが いちばん おおいよ。',
    },
    {
      id: 'not-tallest',
      explain: 'もう いちど くらべよう。ほかに もっと ○が たかい（ひくい）ものが あるよ。',
    },
  ],
  levels: [
    { label: 'かぞえる・よむ・かく', chance: 0.05 },
    { label: 'くらべる', chance: 0.05 },
  ],
  intro: [
    {
      text: 'くだものの えが まざって います。しゅるいごとに かぞえると わかりやすく なります。',
      figure: {
        kind: 'row',
        gap: 1,
        items: ['apple', 'mikan', 'apple', 'strawberry', 'mikan', 'apple'].map((id) => ({
          kind: 'illust',
          id,
          count: 1,
        })),
      },
    },
    {
      text: 'かぞえた かずを ひょうに します。りんご 3、みかん 2、いちご 1。',
      figure: {
        kind: 'table',
        header: ['くだもの', 'かず'],
        rows: [
          ['りんご', '3'],
          ['みかん', '2'],
          ['いちご', '1'],
        ],
      },
    },
    {
      text: '○を かずだけ つむと ○の グラフ。たかさで おおい・すくないが すぐ わかります。',
      figure: {
        kind: 'bar',
        labels: ['りんご', 'みかん', 'いちご'],
        values: [3, 2, 1],
        scaleStep: 1,
      },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateTablesGraphs(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第2学年 D(1) 簡単な表やグラフ（分類整理、表・グラフに表す・読む）',
  revised: '2026-10-24',
};
