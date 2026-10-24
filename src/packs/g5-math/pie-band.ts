/**
 * g5.math.pie-band 円グラフ・帯グラフ（curriculum-matrix 3.8）。
 *
 * データは本アプリが作った「れいの データ」（調べた 結果の 割合。%の 合計は 100）。
 * 帯グラフ・円グラフは graph エンジン（読むだけ）。2本の 帯グラフを くらべる問題は、graph が 1本しか 描けないので
 * svg の図と choice で代用する（エンジンへの要望: 複数の帯グラフの 並び）。
 * 同一性キー: 到達項目 × 題材 × 割合の 並び × 問う 部分。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, GraphItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { finishUnit, pick, pickObj, REVISED, STROKE, svg, svgText, wrongList } from './util';

type Obj = 'read' | 'times' | 'amount' | 'missing' | 'two';

interface Theme {
  id: string;
  title: string;
  who: string; // 全体の 数え方（「人」「さつ」「kg」）
  items: string[];
}
const THEMES: Theme[] = [
  {
    id: 'fruit',
    title: 'すきな くだもの（れいの データ）',
    who: '人',
    items: ['りんご', 'みかん', 'いちご', 'バナナ', 'ぶどう', 'もも'],
  },
  {
    id: 'book',
    title: '図書室で かりた 本の 種類（れいの データ）',
    who: 'さつ',
    items: ['物語', '図かん', 'まんが', '伝記', '絵本', '詩'],
  },
  {
    id: 'trash',
    title: '学校の ごみの 種類（れいの データ）',
    who: 'kg',
    items: ['紙', 'プラスチック', '生ごみ', 'かん', 'びん', '木'],
  },
  {
    id: 'sport',
    title: 'すきな スポーツ（れいの データ）',
    who: '人',
    items: ['サッカー', '野球', '水泳', 'バスケットボール', 'テニス', 'ダンス'],
  },
  {
    id: 'come',
    title: '学校までの 来かた（れいの データ）',
    who: '人',
    items: ['歩き', '自転車', 'バス', '電車', '車'],
  },
];

interface Data {
  theme: Theme;
  labels: string[];
  values: number[];
}

/** 割合の 並び（step の倍数・ちがう値・大きい順・合計 100）。must の値を 必ず ふくむ */
function makeData(rng: Rng, step: number, must: number[] = []): Data {
  const theme = pick(rng, THEMES);
  for (;;) {
    const n = rng.int(Math.max(3, must.length + 1), Math.min(5, theme.items.length));
    const vals = [...must];
    while (vals.length < n - 1) vals.push(rng.int(1, 40 / step) * step);
    const last = 100 - vals.reduce((s, v) => s + v, 0);
    if (last < step || last % step !== 0) continue;
    vals.push(last);
    if (new Set(vals).size !== vals.length) continue;
    vals.sort((a, b) => b - a);
    const labels = rng.sample(theme.items, n);
    return { theme, labels, values: vals };
  }
}

const keyOf = (d: Data) => `${d.theme.id}:${d.labels.join('-')}:${d.values.join('-')}`;

function graphData(d: Data, kind: 'band' | 'pie'): GraphItem['data'] {
  return { kind, labels: d.labels, values: d.values, title: d.theme.title };
}

/** 帯・円グラフで、i 番目の 部分の はしの 目盛り（左から 累積） */
const cumEnd = (d: Data, i: number) => d.values.slice(0, i + 1).reduce((s, v) => s + v, 0);

/** 部分の 割合を 読む（alt: 円グラフ） */
function readItem(level: number, rng: Rng, alt: boolean): GraphItem {
  const d = makeData(rng, level === 0 ? 5 : 1);
  const i = rng.int(1, d.values.length - 1); // 2番め以降（はしの 目盛りと 区別できる）
  const v = d.values[i]!;
  const start = cumEnd(d, i - 1);
  const end = cumEnd(d, i);
  const kind = alt ? 'pie' : 'band';
  return {
    engine: 'graph',
    id: `read${alt ? '-alt' : ''}:${keyOf(d)}:${i}`,
    objective: 'read',
    level,
    prompt: `${kind === 'band' ? '帯グラフ' : '円グラフ'}を 見よう。「${d.labels[i]}」は 全体の 何%ですか。`,
    hints: [
      `「${d.labels[i]}」の 部分の はじめと おわりの 目もりを 見よう。`,
      `はじめの 区切りは ${start}%の ところ。`,
      `おわりの 区切りの 目もりから ${start}を ひこう。`,
    ],
    explain: `「${d.labels[i]}」は ${start}%から ${end}%までなので、${end} − ${start} ＝ ${v}%です。`,
    identity: `read:${keyOf(d)}:${i}${alt ? ':pie' : ''}`,
    alt,
    data: graphData(d, kind),
    task: {
      kind: 'number',
      fields: [{ label: '%', answer: { kind: 'int', value: v } }],
      wrongAnswers: wrongList(
        [{ kind: 'int', value: v }],
        [
          [end, 'scale-read'],
          [start, 'scale-read'],
        ],
      ),
    },
  };
}

/** 何倍か（alt: 円グラフ） */
function timesItem(level: number, rng: Rng, alt: boolean): GraphItem {
  const small = pick(rng, [5, 6, 8, 10, 12, 15]);
  const k = small * 4 <= 60 ? rng.int(2, 4) : rng.int(2, 3);
  const d = makeData(rng, 1, [small * k, small]);
  const ib = d.values.indexOf(small * k);
  const is = d.values.indexOf(small);
  const kind = alt ? 'pie' : 'band';
  return {
    engine: 'graph',
    id: `times${alt ? '-alt' : ''}:${keyOf(d)}`,
    objective: 'times',
    level,
    prompt: `${kind === 'band' ? '帯グラフ' : '円グラフ'}を 見よう。「${d.labels[ib]}」の 割合は、「${d.labels[is]}」の 割合の 何倍ですか。`,
    hints: [
      'まず 2つの 部分が それぞれ 何%か 読もう。',
      `「${d.labels[is]}」は ${small}%。`,
      `「${d.labels[ib]}」の %を ${small}で わろう。`,
    ],
    explain: `「${d.labels[ib]}」は ${small * k}%、「${d.labels[is]}」は ${small}%。${small * k} ÷ ${small} ＝ ${k}で、${k}倍です。`,
    identity: `times:${keyOf(d)}${alt ? ':pie' : ''}`,
    alt,
    data: graphData(d, kind),
    task: {
      kind: 'number',
      fields: [{ label: '倍', answer: { kind: 'int', value: k } }],
      wrongAnswers: wrongList(
        [{ kind: 'int', value: k }],
        [
          [small * k - small, 'diff-times'],
          [
            cumEnd(d, ib) / small === k
              ? null
              : Number.isInteger(cumEnd(d, ib) / small)
                ? cumEnd(d, ib) / small
                : null,
            'scale-read',
          ],
        ],
      ),
    },
  };
}

/** 全体の 量 × 割合（alt: 円グラフ） */
function amountItem(level: number, rng: Rng, alt: boolean): GraphItem {
  for (;;) {
    const d = makeData(rng, 1);
    const i = rng.int(0, d.values.length - 1);
    const v = d.values[i]!;
    const total = pick(rng, [50, 80, 120, 150, 200, 250, 300, 400, 500, 600]);
    if ((total * v) % 100 !== 0) continue;
    const ans = (total * v) / 100;
    const kind = alt ? 'pie' : 'band';
    const u = d.theme.who;
    return {
      engine: 'graph',
      id: `amount${alt ? '-alt' : ''}:${keyOf(d)}:${i}:${total}`,
      objective: 'amount',
      level,
      prompt: `${kind === 'band' ? '帯グラフ' : '円グラフ'}は、全体が ${total}${u}の ときの 割合です。「${d.labels[i]}」は 何${u}ですか。`,
      hints: [
        `「${d.labels[i]}」の 割合を グラフから 読もう。`,
        `${v}%は 小数で ${v / 100}。全体 × 割合で 求めるよ。`,
        `${total} × ${v / 100}を 計算しよう。`,
      ],
      explain: `「${d.labels[i]}」は ${v}%。${total} × ${v / 100} ＝ ${ans}。答えは ${ans}${u}です。`,
      identity: `amount:${keyOf(d)}:${i}:${total}${alt ? ':pie' : ''}`,
      alt,
      data: graphData(d, kind),
      task: {
        kind: 'number',
        fields: [{ label: u, answer: { kind: 'int', value: ans } }],
        keys: ['decimal'],
        wrongAnswers: wrongList(
          [{ kind: 'int', value: ans }],
          [
            [v, 'ratio-amount'],
            [total * v, 'ratio-amount'],
            [
              i > 0 && (total * cumEnd(d, i)) % 100 === 0 ? (total * cumEnd(d, i)) / 100 : null,
              'scale-read',
            ],
          ],
        ),
      },
    };
  }
}

/** 合計 100% から のこりを 求める（表。alt: 文で） */
function missingItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const d = makeData(rng, level === 0 ? 5 : 1);
  const i = rng.int(0, d.values.length - 1);
  const v = d.values[i]!;
  const others = d.values.filter((_, j) => j !== i);
  const sum = others.reduce((s, x) => s + x, 0);
  const answers = [{ kind: 'int' as const, value: v }];
  const figure: Figure | undefined = alt
    ? undefined
    : {
        kind: 'table',
        header: ['種類', '割合（%）'],
        rows: [
          ...d.labels.map((l, j) => [l, j === i ? '？' : String(d.values[j])]),
          ['合計', '100'],
        ],
      };
  const listText = d.labels
    .map((l, j) => (j === i ? null : `${l} ${d.values[j]}%`))
    .filter((x) => x)
    .join('、');
  return {
    engine: 'number',
    id: `missing${alt ? '-alt' : ''}:${keyOf(d)}:${i}`,
    objective: 'missing',
    level,
    prompt: alt
      ? `${d.theme.title.replace('（れいの データ）', '')}を 調べたら（れいの データ）、${listText}で、のこりは「${d.labels[i]}」でした。「${d.labels[i]}」は 何%ですか。`
      : `${d.theme.title}の 割合の 表です。「${d.labels[i]}」は 何%ですか。`,
    figure,
    hints: [
      '全体は 100%だよ。',
      `「${d.labels[i]}」いがいを たすと ${sum}%。`,
      `100から ${sum}を ひこう。`,
    ],
    explain: `全体は 100%なので、100 − ${sum} ＝ ${v}。「${d.labels[i]}」は ${v}%です。`,
    identity: `missing:${keyOf(d)}:${i}${alt ? ':text' : ''}`,
    alt,
    fields: [{ label: '%', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [sum, 'ignore-total'],
      [100 + sum, 'ignore-total'],
    ]),
  };
}

/** 帯グラフ（1〜2本。tag は 左に 書く 年など）の 図 */
function bands(rows: { vals: number[]; tag: string }[], letters: string[], label: string): Figure {
  const X = (p: number) => 70 + p * 3;
  let body = '';
  rows.forEach(({ vals, tag }, r) => {
    const y = 10 + r * 60;
    let acc = 0;
    if (tag) body += svgText(34, y + 20, tag, 14);
    vals.forEach((v, i) => {
      const fill = i % 2 === 0 ? 'var(--sky)' : 'var(--white)';
      body += `<rect x="${X(acc)}" y="${y}" width="${v * 3}" height="40" fill="${fill}" ${STROKE}/>`;
      if (v >= 8) body += svgText(X(acc + v / 2), y + 20, `${letters[i]}${v}`, 13);
      acc += v;
    });
  });
  const ty = 10 + rows.length * 60 - 2;
  for (let p = 0; p <= 100; p += 10) {
    body += `<line x1="${X(p)}" y1="${ty}" x2="${X(p)}" y2="${ty + 8}" ${STROKE}/>`;
    body += svgText(X(p), ty + 20, String(p), 11);
  }
  return svg(400, ty + 30, body, label);
}

/** 割合と 量: 全体が ちがう 2つの 帯グラフ（alt: 表で） */
function twoItem(level: number, rng: Rng, alt: boolean): ChoiceItem {
  const theme = pick(
    rng,
    THEMES.filter((t) => t.who === '人'),
  );
  for (;;) {
    const n1 = pick(rng, [200, 250, 300, 400, 500]);
    const n2 = pick(rng, [200, 250, 300, 400, 500]);
    if (n1 === n2) continue;
    const p1 = rng.int(3, 9) * 5;
    const p2 = rng.int(3, 9) * 5;
    if (p1 === p2) continue;
    const c1 = (n1 * p1) / 100;
    const c2 = (n2 * p2) / 100;
    if (!Number.isInteger(c1) || !Number.isInteger(c2) || c1 === c2) continue;
    // 割合が 大きい ほうが 人数は 少ない 組だけ（割合と 量の ちがいを 見る）
    if (p1 > p2 === c1 > c2) continue;
    const label = pick(rng, theme.items);
    const years: [number, number] = [2020, 2025];
    const rest1 = 100 - p1;
    const rest2 = 100 - p2;
    const opt1 = `${years[0]}年`;
    const opt2 = `${years[1]}年`;
    const firstMore = c1 > c2;
    const figure: Figure = alt
      ? {
          kind: 'table',
          header: ['', `${years[0]}年`, `${years[1]}年`],
          rows: [
            ['調べた 人数', `${n1}人`, `${n2}人`],
            [`「${label}」の 割合`, `${p1}%`, `${p2}%`],
          ],
        }
      : {
          kind: 'column',
          items: [
            bands(
              [
                { vals: [p1, rest1], tag: String(years[0]) },
                { vals: [p2, rest2], tag: String(years[1]) },
              ],
              ['A', 'B'],
              '2つの 年の 帯グラフ（数字は %）',
            ),
            {
              kind: 'text',
              text: `A は ${label}、B は その他。調べた 人数は ${years[0]}年 ${n1}人、${years[1]}年 ${n2}人。`,
              size: 'm',
            },
          ],
        };
    return {
      engine: 'choice',
      id: `two${alt ? '-alt' : ''}:${theme.id}:${label}:${n1}/${p1}|${n2}/${p2}`,
      objective: 'two',
      level,
      prompt: `${theme.title}を ${years[0]}年と ${years[1]}年に 調べました。「${label}」と 答えた 人数が 多いのは どちらの 年？`,
      figure,
      hints: [
        '割合が 大きくても、全体の 人数が ちがうと 人数が 多いとは かぎらないよ。',
        `人数 ＝ 全体の 人数 × 割合。${years[0]}年は ${n1} × ${p1 / 100}。`,
        `${years[0]}年は ${c1}人。${years[1]}年も 計算して くらべよう。`,
      ],
      explain: `${years[0]}年は ${n1} × ${p1 / 100} ＝ ${c1}人、${years[1]}年は ${n2} × ${p2 / 100} ＝ ${c2}人。人数が 多いのは ${firstMore ? years[0] : years[1]}年です。割合が 大きい ほうが 人数も 多いとは かぎりません。`,
      identity: `two:${theme.id}:${label}:${n1}/${p1}|${n2}/${p2}${alt ? ':table' : ''}`,
      alt,
      fixedOrder: true,
      options: [
        firstMore ? { label: opt1, correct: true } : { label: opt1, misconception: 'ratio-amount' },
        firstMore ? { label: opt2, misconception: 'ratio-amount' } : { label: opt2, correct: true },
        { label: '同じ', misconception: 'ratio-amount' },
      ],
    };
  }
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['read', 'missing'] },
  { objs: ['read', 'times', 'amount'] },
  { objs: ['two', 'amount', 'times', 'missing'] },
];

export function generatePieBand(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'read':
      return readItem(level, rng, alt);
    case 'times':
      return timesItem(level, rng, alt);
    case 'amount':
      return amountItem(level, rng, alt);
    case 'missing':
      return missingItem(level, rng, alt);
    case 'two':
      return twoItem(level, rng, alt);
  }
}

export const pieBand: UnitSpec = finishUnit(
  {
    id: 'g5.math.pie-band',
    title: '帯グラフと 円グラフ',
    stage: 'g5',
    subject: 'math',
    domain: 'D-data',
    kind: 'concept',
    priority: 'P1',
    status: 'ready',
    icon: 'mode-sorting',
    prereq: ['g5.math.percent'],
    objectives: [
      { id: 'read', title: '部分の 割合を 読む' },
      { id: 'missing', title: '合計が 100%に なる ことを 使う' },
      { id: 'times', title: '割合を くらべる（何倍）' },
      { id: 'amount', title: '割合から 量を 求める' },
      { id: 'two', title: '全体が ちがう 2つの グラフを くらべる' },
    ],
    misconceptions: [
      {
        id: 'scale-read',
        explain:
          '区切りの 目もり（はしの 数）を そのまま 読んだのかな。帯グラフ・円グラフの 目もりは 左（上）から たした 割合だよ。部分の 割合は「おわりの 目もり − はじめの 目もり」で 読もう。',
      },
      {
        id: 'ratio-amount',
        explain:
          '割合と 量（人数）を 同じに 考えたのかな。量 ＝ 全体の 量 × 割合。全体が ちがうと、割合が 大きくても 量が 多いとは かぎらないよ。',
      },
      {
        id: 'ignore-total',
        explain:
          '全体が 100%で ある ことを 使わなかったのかな。全部の 部分を たすと 100%に なるよ。のこりは 100から ひいて 求めよう。',
      },
      {
        id: 'diff-times',
        explain: 'ちがい（ひき算）を 求めたのかな。「何倍」は わり算で 求めるよ。',
      },
    ],
    levels: [
      { label: '割合を 読む', chance: 0.02 },
      { label: '何倍・量を 求める', chance: 0.02 },
      { label: '2つの グラフ・まとめ', chance: 0.05 },
    ],
    intro: [
      {
        text: '全体を 長方形で 表し、部分の 割合を 区切って 表した グラフを 帯グラフ、円で 表した グラフを 円グラフと いいます。ふつう 割合の 大きい 順に 左（円グラフは 真上から 右回り）に かき、「その他」は 最後に します。',
      },
      {
        text: '目もりは 左から たした 割合です。A（りんご）40%、B（みかん）25%なら、みかんは 40の 目もりから 65の 目もりまで。65 − 40 ＝ 25%と 読みます。',
        figure: bands(
          [{ vals: [40, 25, 20, 15], tag: '' }],
          ['A', 'B', 'C', 'D'],
          '帯グラフ（数字は %）',
        ),
      },
      {
        text: '全体の 量が 分かれば、部分の 量は 全体 × 割合で 求められます。200人の 25%は 200 × 0.25 ＝ 50人。',
      },
    ],
    source: {
      kind: 'generator',
      generate: ({ level, rng, index }) => generatePieBand(level, rng, index),
    },
    review: 'objective',
    basis:
      '小学校学習指導要領（平成29年告示）算数 第5学年 D(1) 円グラフや帯グラフ、統計的な問題解決の方法',
    revised: REVISED,
  },
  '物語《ものがたり》 図《ず》かん 伝記《でんき》 絵本《えほん》 詩《し》 生《なま》ごみ 野球《やきゅう》 水泳《すいえい》 来《き》かた 歩《ある》き 自転車《じてんしゃ》 電車《でんしゃ》 車《くるま》 図書室《としょしつ》 区切《くぎ》り 区切《くぎ》って 真上《まうえ》 右回《みぎまわ》り 最後《さいご》 その他《た》 年《ねん》 答《こた》えた',
);
