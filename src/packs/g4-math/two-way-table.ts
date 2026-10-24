/**
 * g4.math.two-way-table 二つの観点の表（落ちや重なりなく調べる）（curriculum-matrix 3.7）。
 * 記録を2つの観点で数える → 表を読む → 合計 → 空欄を求める。データは本アプリの「れいの データ」。
 *
 * 2つの観点の表は graph エンジンの表（1列）では表せないので、図（table）＋数の入力・選択で出す。
 * 同一性キー: 問う形 × 場面 × 値の表（× 問う所）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { finishUnit, opts, pick, pickObj, REVISED, wrongList } from './util';

type Obj = 'tally' | 'read' | 'total' | 'fill';

interface Scene {
  id: string;
  title: string;
  rowName: string;
  colName: string;
  rows: string[];
  cols: string[];
  unit: string;
}
const SCENES: Scene[] = [
  { id: 'injury', title: 'けがの 記録（れいの データ）', rowName: '場所', colName: 'けがの 種類', rows: ['教室', 'ろうか', '運動場', '体育館'], cols: ['すりきず', '切りきず', '打ぼく'], unit: '人' },
  { id: 'play', title: 'すきな 遊び（れいの データ）', rowName: '学年', colName: '遊び', rows: ['3年', '4年'], cols: ['おにごっこ', 'なわとび', 'ボール'], unit: '人' },
  { id: 'forget', title: 'わすれ物の 記録（れいの データ）', rowName: '曜日', colName: 'わすれ物', rows: ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日'], cols: ['教科書', 'ノート', 'ハンカチ'], unit: 'こ' },
  { id: 'commute', title: '通学の しかた（れいの データ）', rowName: '組', colName: '通学の しかた', rows: ['1組', '2組', '3組'], cols: ['歩き', '自転車', 'バス'], unit: '人' },
  { id: 'lunch', title: 'きゅう食の のこし（れいの データ）', rowName: '組', colName: 'しゅるい', rows: ['1組', '2組'], cols: ['ごはん', 'おかず', 'しる'], unit: '人' },
];

function grid(rng: Rng, sc: Scene): number[][] {
  return sc.rows.map(() => sc.cols.map(() => rng.int(0, 9)));
}
const rowSum = (g: number[][], i: number) => g[i]!.reduce((s, x) => s + x, 0);
const colSum = (g: number[][], j: number) => g.reduce((s, r) => s + r[j]!, 0);
const all = (g: number[][]) => g.reduce((s, r) => s + r.reduce((t, x) => t + x, 0), 0);
const gkey = (g: number[][]) => g.map((r) => r.join('')).join('/');

/** 合計つきの 表（hide: [行, 列] を ？に。行・列が 長さと 同じなら 合計） */
function tableFig(sc: Scene, g: number[][], hide: [number, number][], totals = true): Figure {
  const R = sc.rows.length;
  const C = sc.cols.length;
  const cell = (i: number, j: number) => {
    if (hide.some(([a, b]) => a === i && b === j)) return '？';
    if (i < R && j < C) return String(g[i]![j]);
    if (i < R) return String(rowSum(g, i));
    if (j < C) return String(colSum(g, j));
    return String(all(g));
  };
  const rows = Array.from({ length: totals ? R + 1 : R }, (_, i) => [
    i < R ? sc.rows[i]! : '合計',
    ...Array.from({ length: totals ? C + 1 : C }, (_, j) => cell(i, j)),
  ]);
  return { kind: 'table', header: [`${sc.rowName}＼${sc.colName}`, ...sc.cols, ...(totals ? ['合計'] : [])], rows };
}

/** 記録を 数える（2×2: 犬と ねこ。alt: けがの 記録から 1つの ますを 数える） */
function tally(level: number, rng: Rng, alt: boolean): NumberItem {
  if (alt) {
    const sc = SCENES[0]!;
    const n = rng.int(9, 12);
    const recs = Array.from({ length: n }, () => [rng.int(0, sc.rows.length - 1), rng.int(0, sc.cols.length - 1)] as [number, number]);
    const [ri, cj] = pick(rng, recs);
    const ans = recs.filter(([a, b]) => a === ri && b === cj).length;
    const answers = [{ kind: 'int' as const, value: ans }];
    return {
      engine: 'number',
      id: `tally-alt:${recs.map((r) => r.join('')).join('.')}:${ri}${cj}`,
      objective: 'tally',
      level,
      prompt: `けがの 記録です（れいの データ）。${sc.rows[ri]}で ${sc.cols[cj]}を した 人は 何人ですか。`,
      figure: { kind: 'table', header: ['番号', '場所', 'けがの 種類'], rows: recs.map(([a, b], i) => [String(i + 1), sc.rows[a]!, sc.cols[b]!]) },
      hints: ['場所と けがの 種類の 2つが どちらも 合う 記録を さがそう。', `まず 場所が ${sc.rows[ri]}の 記録に しるしを つけよう。`, `その 中で ${sc.cols[cj]}の ものを 数えよう。`],
      explain: `${sc.rows[ri]}で ${sc.cols[cj]}の 記録は ${ans}こ。${ans}人です。`,
      identity: `tally-rec:${recs.map((r) => r.join('')).join('.')}:${ri}${cj}`,
      alt: true,
      fields: [{ label: '人', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [recs.filter(([a]) => a === ri).length, 'one-aspect'],
        [recs.filter(([, b]) => b === cj).length, 'one-aspect'],
      ]),
    };
  }
  const n = rng.int(8, 12);
  const recs = Array.from({ length: n }, () => [rng.int(0, 1), rng.int(0, 1)] as [number, number]);
  const c = (d: number, k: number) => recs.filter(([a, b]) => a === d && b === k).length;
  const vals = [c(1, 1), c(1, 0), c(0, 1), c(0, 0)];
  const answers = vals.map((v) => ({ kind: 'int' as const, value: v }));
  const mark = (x: number) => (x ? '○' : '×');
  return {
    engine: 'number',
    id: `tally:${recs.map((r) => r.join('')).join('.')}`,
    objective: 'tally',
    level,
    prompt: '犬と ねこを かって いるかを 調べました（○: かって いる、×: かって いない）。落ちや 重なりが ないように 数えよう。',
    figure: { kind: 'table', header: ['番号', '犬', 'ねこ'], rows: recs.map(([a, b], i) => [String(i + 1), mark(a), mark(b)]) },
    hints: [
      '犬と ねこの ○×の 組み合わせは 4通り あるよ。',
      '1人ずつ、どの 組み合わせか 調べて しるしを つけよう。',
      `ぜんぶ たすと ${n}人に なるか たしかめよう。`,
    ],
    explain: `犬○ねこ○が ${vals[0]}人、犬○ねこ×が ${vals[1]}人、犬×ねこ○が ${vals[2]}人、犬×ねこ×が ${vals[3]}人。合計 ${n}人です。`,
    identity: `tally:${recs.map((r) => r.join('')).join('.')}`,
    alt: false,
    fields: [
      { label: '犬○ねこ○', answer: answers[0]! },
      { label: '犬○ねこ×', answer: answers[1]! },
      { label: '犬×ねこ○', answer: answers[2]! },
      { label: '犬×ねこ×', answer: answers[3]! },
    ],
    wrongAnswers: wrongList(answers, [
      [`${vals[0]}|${vals[2]}|${vals[1]}|${vals[3]}`, 'row-col-swap'],
      [`${vals[0]! + vals[1]!}|${vals[1]}|${vals[2]}|${vals[3]}`, 'double-count'],
    ]),
  };
}

/** 表を 読む（alt: いちばん 多い ますを 選ぶ） */
function read(level: number, rng: Rng, alt: boolean): Item {
  const sc = pick(rng, SCENES);
  const g = grid(rng, sc);
  if (alt) {
    const flat = g.flatMap((r, i) => r.map((v, j) => ({ v, i, j })));
    const mx = Math.max(...flat.map((x) => x.v));
    if (flat.filter((x) => x.v === mx).length !== 1) return read(level, rng, false);
    const best = flat.find((x) => x.v === mx)!;
    const name = (x: { i: number; j: number }) => `${sc.rows[x.i]}の ${sc.cols[x.j]}`;
    // 合計が いちばん 多い 行・列の 中の ほかの ます（合計と ますの 混同）
    const rowBest = sc.rows.map((_, i) => rowSum(g, i)).indexOf(Math.max(...sc.rows.map((_, i) => rowSum(g, i))));
    const others = rng.shuffle(flat.filter((x) => x.v !== mx));
    const pref = others.find((x) => x.i === rowBest);
    const ws = [...(pref ? [pref] : []), ...others.filter((x) => x !== pref)].slice(0, 3);
    const item: ChoiceItem = {
      engine: 'choice',
      id: `read-alt:${sc.id}:${gkey(g)}`,
      objective: 'read',
      level,
      prompt: `${sc.title}。${sc.rowName}と ${sc.colName}の 組み合わせで、いちばん 多いのは どれ？`,
      figure: tableFig(sc, g, []),
      hints: ['合計の 列や 行では なく、中の ますを くらべよう。', 'いちばん 大きい 数の ますを さがそう。', 'その ますの 行と 列の 見出しを 読もう。'],
      explain: `${name(best)}が ${mx}${sc.unit}で いちばん 多いです。`,
      identity: `read-max:${sc.id}:${gkey(g)}`,
      alt: true,
      options: opts(name(best), ws.map((x) => [name(x), x.i === rowBest ? 'total-as-cell' : 'row-col-swap'])),
    };
    return item;
  }
  const i = rng.int(0, sc.rows.length - 1);
  const j = rng.int(0, sc.cols.length - 1);
  const ans = g[i]![j]!;
  const answers = [{ kind: 'int' as const, value: ans }];
  return {
    engine: 'number',
    id: `read:${sc.id}:${gkey(g)}:${i}${j}`,
    objective: 'read',
    level,
    prompt: `${sc.title}。${sc.rows[i]}で ${sc.cols[j]}の ${sc.unit === '人' ? '人数' : '数'}は いくつですか。`,
    figure: tableFig(sc, g, []),
    hints: [`${sc.rowName}は 横の 行、${sc.colName}は たての 列で 見るよ。`, `「${sc.rows[i]}」の 行を 横に たどろう。`, `「${sc.cols[j]}」の 列と 交わる ますを 読もう。`],
    explain: `${sc.rows[i]}の 行と ${sc.cols[j]}の 列が 交わる ますは ${ans}${sc.unit}です。`,
    identity: `read:${sc.id}:${gkey(g)}:${i}${j}`,
    alt: false,
    fields: [{ label: sc.unit, answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [rowSum(g, i), 'total-as-cell'],
      [colSum(g, j), 'total-as-cell'],
      [j < sc.rows.length && i < sc.cols.length ? g[j]![i] : null, 'row-col-swap'],
    ]),
  };
}

/** 合計（alt: 行の 合計と 列の 合計の どちらからも 同じに なる ことを 使う） */
function total(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, SCENES);
  const g = grid(rng, sc);
  const R = sc.rows.length;
  const C = sc.cols.length;
  if (alt) {
    // 合計の 列だけ 見せて、全体の 合計を 求める
    const answers = [{ kind: 'int' as const, value: all(g) }];
    return {
      engine: 'number',
      id: `total-alt:${sc.id}:${gkey(g)}`,
      objective: 'total',
      level,
      prompt: `${sc.title}。表の 右下の ？（全体の 合計）は いくつですか。`,
      figure: tableFig(sc, g, [[R, C]]),
      hints: ['全体の 合計は、合計の 列を たても 横の 合計の 行を たしても 同じに なるよ。', `合計の 列（${sc.rows.map((_, i) => rowSum(g, i)).join('、')}）を たそう。`, '合計の 行を たして、同じに なるか たしかめよう。'],
      explain: `${sc.rows.map((_, i) => rowSum(g, i)).join(' ＋ ')} ＝ ${all(g)}。合計の 行（${sc.cols.map((_, j) => colSum(g, j)).join(' ＋ ')}）でも ${all(g)}です。`,
      identity: `total-all:${sc.id}:${gkey(g)}`,
      alt: true,
      fields: [{ label: sc.unit, answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [[2 * all(g), 'double-count']]),
    };
  }
  const byRow = rng.next() < 0.5;
  const k = rng.int(0, (byRow ? R : C) - 1);
  const ans = byRow ? rowSum(g, k) : colSum(g, k);
  const answers = [{ kind: 'int' as const, value: ans }];
  const hide: [number, number][] = byRow ? [[k, C]] : [[R, k]];
  const parts = byRow ? g[k]! : g.map((r) => r[k]!);
  return {
    engine: 'number',
    id: `total:${sc.id}:${gkey(g)}:${byRow ? 'r' : 'c'}${k}`,
    objective: 'total',
    level,
    prompt: `${sc.title}。表の ？に 入る 数は いくつですか。`,
    figure: tableFig(sc, g, hide),
    hints: [byRow ? '横の 行の 数を ぜんぶ たすと 合計に なるよ。' : 'たての 列の 数を ぜんぶ たすと 合計に なるよ。', `たす 数は ${parts.join('、')}。`, `${parts.join(' ＋ ')}を 計算しよう。`],
    explain: `${parts.join(' ＋ ')} ＝ ${ans}です。`,
    identity: `total:${sc.id}:${gkey(g)}:${byRow ? 'r' : 'c'}${k}`,
    alt: false,
    fields: [{ label: sc.unit, answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [ans - parts[parts.length - 1]!, 'drop-row'],
      [byRow ? colSum(g, Math.min(k, C - 1)) : rowSum(g, Math.min(k, R - 1)), 'row-col-swap'],
    ]),
  };
}

/** 空欄を 求める（合計から ひく。alt: 2×2 の 表） */
function fill(level: number, rng: Rng, alt: boolean): NumberItem {
  if (alt) {
    const sc: Scene = { id: 'pet', title: '犬と ねこを かって いるか（れいの データ）', rowName: '犬', colName: 'ねこ', rows: ['かって いる', 'かって いない'], cols: ['かって いる', 'かって いない'], unit: '人' };
    const g = [
      [rng.int(1, 6), rng.int(1, 9)],
      [rng.int(1, 9), rng.int(1, 9)],
    ];
    // 内側の ます1つと、その 行の 合計以外の ますを かくす: 列の 合計から 求める
    const i = rng.int(0, 1);
    const j = rng.int(0, 1);
    const ans = g[i]![j]!;
    const answers = [{ kind: 'int' as const, value: ans }];
    const other = g[1 - i]![j]!;
    return {
      engine: 'number',
      id: `fill-alt:${gkey(g)}:${i}${j}`,
      objective: 'fill',
      level,
      prompt: `${sc.title}。表の ？に 入る 数は いくつですか。`,
      figure: tableFig(sc, g, [[i, j], [i, 2]]),
      hints: ['？の ますの たての 列を 見よう。列の 合計が わかって いるね。', `列の 合計は ${colSum(g, j)}、もう1つの ますは ${other}。`, `${colSum(g, j)} − ${other}を 計算しよう。`],
      explain: `${colSum(g, j)} − ${other} ＝ ${ans}。？は ${ans}です。`,
      identity: `fill-2x2:${gkey(g)}:${i}${j}`,
      alt: true,
      fields: [{ label: '人', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [colSum(g, j), 'total-as-cell'],
        [colSum(g, j) + other, 'sum-others'],
      ]),
    };
  }
  const sc = pick(rng, SCENES);
  const g = grid(rng, sc);
  const C = sc.cols.length;
  const i = rng.int(0, sc.rows.length - 1);
  const j = rng.int(0, C - 1);
  const ans = g[i]![j]!;
  const others = g[i]!.filter((_, k) => k !== j);
  const answers = [{ kind: 'int' as const, value: ans }];
  return {
    engine: 'number',
    id: `fill:${sc.id}:${gkey(g)}:${i}${j}`,
    objective: 'fill',
    level,
    prompt: `${sc.title}。表の ？に 入る 数は いくつですか。`,
    figure: tableFig(sc, g, [[i, j]]),
    hints: ['？の ますの 行の 合計を 見よう。', `${sc.rows[i]}の 合計は ${rowSum(g, i)}。ほかの ますは ${others.join('、')}。`, `${rowSum(g, i)} − （${others.join(' ＋ ')}）を 計算しよう。`],
    explain: `${rowSum(g, i)} − （${others.join(' ＋ ')}）＝ ${ans}。？は ${ans}です。`,
    identity: `fill:${sc.id}:${gkey(g)}:${i}${j}`,
    alt: false,
    fields: [{ label: sc.unit, answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [rowSum(g, i), 'total-as-cell'],
      [others.reduce((s, x) => s + x, 0), 'sum-others'],
      [rowSum(g, i) - others[0]!, 'drop-row'],
    ]),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['tally', 'read'] },
  { objs: ['read', 'total', 'tally'] },
  { objs: ['fill', 'total', 'read', 'tally'] },
];

export function generateTwoWayTable(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'tally':
      return tally(level, rng, alt);
    case 'read':
      return read(level, rng, alt);
    case 'total':
      return total(level, rng, alt);
    case 'fill':
      return fill(level, rng, alt);
  }
}

export const twoWayTable: UnitSpec = finishUnit({
  id: 'g4.math.two-way-table',
  title: '2つの ことがらの 表',
  stage: 'g4',
  subject: 'math',
  domain: 'D-data',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-sorting',
  prereq: ['g4.math.line-graph'],
  objectives: [
    { id: 'tally', title: '落ちや 重なりなく 数える' },
    { id: 'read', title: '表を 読む' },
    { id: 'total', title: '合計を 求める' },
    { id: 'fill', title: '表の あいた ところを 求める' },
  ],
  misconceptions: [
    {
      id: 'one-aspect',
      explain: '1つの ことがらだけで 数えたのかな。2つの ことがらが どちらも 合う ものだけを 数えよう。',
    },
    {
      id: 'row-col-swap',
      explain: '行と 列を 入れかえて 読んだのかな。横の 行の 見出しと たての 列の 見出しを 指で たどって たしかめよう。',
    },
    {
      id: 'double-count',
      explain: '同じ ものを 2回 数えたのかな。数えた 記録に しるしを つけて、落ちや 重なりが ないように しよう。',
    },
    {
      id: 'total-as-cell',
      explain: '合計の ますを 読んだのかな。合計は いちばん 右の 列と いちばん 下の 行だよ。中の ますと 区別しよう。',
    },
    {
      id: 'drop-row',
      explain: 'たす 数を 1つ わすれたのかな。行（列）の 数を ぜんぶ たそう。',
    },
    {
      id: 'sum-others',
      explain: 'ほかの ますを たしたのかな。？は 合計から ほかの ますを ひいて 求めるよ。',
    },
  ],
  levels: [
    { label: '数える・読む', chance: 0.05 },
    { label: '合計', chance: 0.05 },
    { label: 'あいた ところを 求める', chance: 0.05 },
  ],
  intro: [
    {
      text: 'けがの 記録を、場所と けがの 種類の 2つの ことがらで 整理すると、どこで どんな けがが 多いか わかります。',
      figure: tableFig(SCENES[0]!, [[2, 1, 0], [1, 0, 2], [5, 2, 3], [1, 0, 4]], []),
    },
    {
      text: '1つずつ しるしを つけながら 数えると、落ちや 重なりが なく 数えられます。',
    },
    {
      text: '合計の 列を たした 数と、合計の 行を たした 数は 同じに なります。',
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateTwoWayTable(level, rng, index),
  },
  review: 'objective',
  basis: '小学校学習指導要領（平成29年告示）算数 第4学年 D(1) データの分類整理（二つの観点から分類整理する表）',
  revised: REVISED,
});
