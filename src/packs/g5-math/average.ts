/**
 * g5.math.average 平均（curriculum-matrix 3.8）。
 * ならす（図）→ 平均を求める（0 の日も数に入れる）→ 平均から合計・のこりの1つを求める → 平均を使って見積もる。
 *
 * 種別は「計+概」。生成で 100 以上の異なる問題が作れるので計算（基準 100）で数える。文章題の場面は 8。
 * 平均は 小数第1位まで わりきれる数だけを出す（答えは小数でも整数でもよい）。
 * 同一性キー: 問う形 × 数の組（並べかえは同じ）× 場面。
 */
import type { NumberAnswer } from '../../core/answer/number';
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { GraphItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { dec, decAns, expr, finishUnit, pick, pickObj, REVISED, wrongList } from './util';

type Obj = 'mean' | 'zero' | 'total' | 'missing' | 'story';

interface Scene {
  id: string;
  /** 何の 記録か（〜の 平均） */
  what: string;
  unit: string;
  /** 1つ分の 呼び方（1日め・1回め・1人め） */
  each: string;
  lo: number;
  hi: number;
  /** 0 が ありうる 場面 */
  zero: boolean;
}

const SCENES: Scene[] = [
  {
    id: 'egg',
    what: 'にわとりが うんだ たまごの 数',
    unit: 'こ',
    each: '日め',
    lo: 0,
    hi: 8,
    zero: true,
  },
  {
    id: 'page',
    what: '1日に 読んだ 本の ページ数',
    unit: 'ページ',
    each: '日め',
    lo: 0,
    hi: 30,
    zero: true,
  },
  {
    id: 'jump',
    what: '走りはばとびの 記録',
    unit: 'cm',
    each: '回め',
    lo: 250,
    hi: 320,
    zero: false,
  },
  {
    id: 'orange',
    what: 'みかん 1こ 1この 重さ',
    unit: 'g',
    each: 'こめ',
    lo: 80,
    hi: 120,
    zero: false,
  },
  {
    id: 'ball',
    what: 'ソフトボール投げの 記録',
    unit: 'm',
    each: '回め',
    lo: 15,
    hi: 35,
    zero: false,
  },
  {
    id: 'test',
    what: '10点 まんてんの 計算テストの 点数',
    unit: '点',
    each: '回め',
    lo: 4,
    hi: 10,
    zero: false,
  },
  { id: 'rain', what: '1日に ふった 雨の 量', unit: 'mm', each: '日め', lo: 0, hi: 20, zero: true },
  {
    id: 'lend',
    what: '図書室で 1日に かりられた 本の 数',
    unit: 'さつ',
    each: '日め',
    lo: 0,
    hi: 12,
    zero: true,
  },
];

const sum = (v: number[]) => v.reduce((s, x) => s + x, 0);
/** 平均が 小数第1位で わりきれるか */
const clean = (v: number[]) => (sum(v) * 10) % v.length === 0;
/** 平均（0.1 の いくつ分） */
const mean10 = (v: number[]) => (sum(v) * 10) / v.length;
const meanAns = (v: number[]): NumberAnswer => decAns(mean10(v), 1);
const meanText = (v: number[]) => dec(mean10(v), 1);
const keyOf = (v: number[]) => [...v].sort((a, b) => a - b).join(',');
const listText = (v: number[], u: string) => v.map((x) => `${x}${u}`).join('、');

/** n こ の 値（lo〜hi、平均が わりきれる） */
function values(rng: Rng, n: number, lo: number, hi: number, needZero = false): number[] {
  for (;;) {
    const v = Array.from({ length: n }, () => rng.int(lo, hi));
    if (needZero && !v.includes(0)) {
      v[rng.int(0, n - 1)] = 0;
    }
    if (needZero && v.every((x) => x === 0)) continue;
    if (!needZero && lo === 0 && v.includes(0)) continue;
    if (new Set(v).size === 1) continue;
    if (clean(v)) return v;
  }
}

function meanWrongs(v: number[]): [string | number | null, string][] {
  const s = sum(v);
  const n = v.length;
  const nz = v.filter((x) => x !== 0).length;
  return [
    [nz < n && nz > 0 && (s * 10) % nz === 0 ? dec((s * 10) / nz, 1) : null, 'zero-skip'],
    [s, 'no-divide'],
    [(s * 10) % (n - 1) === 0 ? dec((s * 10) / (n - 1), 1) : null, 'count-wrong'],
    [(s * 10) % (n + 1) === 0 ? dec((s * 10) / (n + 1), 1) : null, 'count-wrong'],
  ];
}

const meanHints = (v: number[], u: string): string[] => [
  '平均 ＝ 合計 ÷ 個数',
  `合計は ${v.join(' ＋ ')} ＝ ${sum(v)}${u}。個数は ${v.length}こ${v.includes(0) ? '（0も 数に 入れる）' : ''}。`,
  `${sum(v)} ÷ ${v.length}を 計算しよう。`,
];
const meanExplain = (v: number[], u: string) =>
  `合計は ${sum(v)}${u}、個数は ${v.length}。${sum(v)} ÷ ${v.length} ＝ ${meanText(v)}で、平均は ${meanText(v)}${u}です。`;

/** ぼうグラフ（graph エンジン。figure は 付けない） */
function barItem(
  obj: Obj,
  level: number,
  sc: Scene,
  v: number[],
  prompt: string,
  id: string,
): GraphItem {
  const max = Math.max(...v);
  const step = max <= 20 ? 1 : max <= 40 ? 2 : 5;
  const answer = meanAns(v);
  return {
    engine: 'graph',
    id,
    objective: obj,
    level,
    prompt,
    hints: meanHints(v, sc.unit),
    explain: meanExplain(v, sc.unit),
    identity: id,
    alt: true,
    data: {
      kind: 'bar',
      labels: v.map((_, i) => `${i + 1}${sc.each}`),
      values: v,
      scaleStep: step,
      labelEvery: 5,
      max: Math.ceil((max + 1) / (step * 5)) * step * 5,
      unit: sc.unit,
    },
    task: {
      kind: 'number',
      fields: [{ label: sc.unit, answer }],
      keys: ['decimal'],
      wrongAnswers: wrongList([answer], meanWrongs(v)),
    },
  };
}

const tableFig = (sc: Scene, v: (number | string)[]): Figure => ({
  kind: 'table',
  header: ['', ...v.map((_, i) => `${i + 1}${sc.each}`)],
  rows: [[sc.unit, ...v.map(String)]],
});

/** 平均を 求める（数だけ。alt: ぼうグラフで ならす） */
function mean(level: number, rng: Rng, alt: boolean): Item {
  const n = rng.int(3, 6);
  if (alt) {
    const sc = SCENES[0]!; // たまご（少ない数で ならす）
    const v = values(rng, n, 1, 8);
    return barItem(
      'mean',
      level,
      sc,
      v,
      `${n}日間に にわとりが うんだ たまごの 数を ぼうグラフに しました。でこぼこを ならすと、1日 平均 何こですか。`,
      `mean-bar:${keyOf(v)}`,
    );
  }
  const v = values(rng, n, 1, 20);
  const answers = [meanAns(v)];
  const item: NumberItem = {
    engine: 'number',
    id: `mean:${keyOf(v)}`,
    objective: 'mean',
    level,
    prompt: `${n}この 数 ${v.join('、')} の 平均を 求めよう。`,
    figure: expr(`（${v.join(' ＋ ')}）÷ ${n} ＝ {{}}`),
    hints: meanHints(v, ''),
    explain: meanExplain(v, ''),
    identity: `mean:${keyOf(v)}`,
    alt: false,
    fields: [{ answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongList(answers, meanWrongs(v)),
  };
  return item;
}

/** 0 の ある 平均（表。alt: ぼうグラフ） */
function zero(level: number, rng: Rng, alt: boolean): Item {
  const sc = pick(
    rng,
    SCENES.filter((s) => s.zero),
  );
  const n = rng.int(4, 6);
  const v = values(rng, n, 0, sc.hi, true);
  const days = `${n}日間`;
  if (alt)
    return barItem(
      'zero',
      level,
      sc,
      v,
      `${days}の ${sc.what}を ぼうグラフに しました。1日 平均 何${sc.unit}ですか。（0の 日も あるよ）`,
      `zero-bar:${sc.id}:${keyOf(v)}`,
    );
  const answers = [meanAns(v)];
  const item: NumberItem = {
    engine: 'number',
    id: `zero:${sc.id}:${keyOf(v)}`,
    objective: 'zero',
    level,
    prompt: `表は ${days}の ${sc.what}です。1日 平均 何${sc.unit}ですか。`,
    figure: tableFig(sc, v),
    hints: meanHints(v, sc.unit),
    explain: `0の 日も 1日と 数えます。${meanExplain(v, sc.unit)}`,
    identity: `zero:${sc.id}:${keyOf(v)}`,
    alt: false,
    fields: [{ label: sc.unit, answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongList(answers, meanWrongs(v)),
  };
  return item;
}

/** 平均から 合計（alt: 歩はばを 使って 見積もる） */
function total(level: number, rng: Rng, alt: boolean): NumberItem {
  if (alt) {
    // 歩はば 0.5〜0.7m、歩数 10〜90（10 とび）
    const w = rng.int(50, 70); // 0.01m の いくつ分
    const steps = rng.int(1, 9) * 10;
    const t100 = w * steps;
    const answers = [decAns(t100, 2)];
    const ws = dec(w, 2);
    return {
      engine: 'number',
      id: `total-step:${w}:${steps}`,
      objective: 'total',
      level,
      prompt: `10歩 歩いた きょりを 何回か はかって、1歩の 平均（歩はば）が ${ws}mと わかりました。家から 公園まで ${steps}歩 でした。家から 公園までは およそ 何mですか。`,
      hints: [
        '平均 × 個数 ＝ 合計 を 使おう。',
        `1歩 ${ws}mの ${steps}歩 分だね。`,
        `${ws} × ${steps}を 計算しよう。`,
      ],
      explain: `${ws} × ${steps} ＝ ${dec(t100, 2)}。およそ ${dec(t100, 2)}mです。平均を 使うと、全体の 量を 見積もる ことが できます。`,
      identity: `total-step:${w}:${steps}`,
      alt: true,
      fields: [{ label: 'm', answer: answers[0]! }],
      keys: ['decimal'],
      wrongAnswers: wrongList(answers, [[dec(w + steps * 100, 2), 'add-instead']]),
    };
  }
  const sc = pick(rng, SCENES);
  for (;;) {
    const n = rng.int(3, 8);
    const m10 = rng.int(sc.lo === 0 ? 10 : sc.lo * 10, sc.hi * 10);
    if ((m10 * n) % 10 !== 0) continue;
    const T = (m10 * n) / 10;
    const m = dec(m10, 1);
    const answers = [{ kind: 'int' as const, value: T }];
    const item: NumberItem = {
      engine: 'number',
      id: `total:${sc.id}:${m}:${n}`,
      objective: 'total',
      level,
      prompt: `${n}${sc.each === '日め' ? '日間' : sc.each === '回め' ? '回' : 'こ'}の ${sc.what}の 平均は ${m}${sc.unit}でした。合計は 何${sc.unit}ですか。`,
      hints: [
        '平均 ＝ 合計 ÷ 個数 だから、合計 ＝ 平均 × 個数。',
        `平均が ${m}、個数が ${n}だね。`,
        `${m} × ${n}を 計算しよう。`,
      ],
      explain: `合計 ＝ 平均 × 個数 ＝ ${m} × ${n} ＝ ${T}。合計は ${T}${sc.unit}です。`,
      identity: `total:${sc.id}:${m}:${n}`,
      alt: false,
      fields: [{ label: sc.unit, answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [m10 % n === 0 ? dec(m10 / n, 1) : null, 'op-swap'],
        [dec(m10 + n * 10, 1), 'add-instead'],
      ]),
    };
    return item;
  }
}

/** 平均から のこりの 1つ（alt: 表の ？） */
function missing(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = SCENES[5]!; // 計算テスト（10点まんてん）
  for (;;) {
    const n = rng.int(3, 5);
    const m = rng.int(6, 9);
    const prev = Array.from({ length: n - 1 }, () => rng.int(4, 10));
    const last = m * n - sum(prev);
    if (last < 0 || last > 10 || last === m) continue;
    const answers = [{ kind: 'int' as const, value: last }];
    const key = `${n}:${m}:${keyOf(prev)}`;
    const item: NumberItem = {
      engine: 'number',
      id: `missing${alt ? '-alt' : ''}:${key}`,
      objective: 'missing',
      level,
      prompt: alt
        ? `表は ${sc.what}です。${n}回の 平均は ${m}点でした。表の ？に 入る 点数は 何点ですか。`
        : `${sc.what}は、${n - 1}回めまで ${listText(prev, '点')}でした。${n}回の 平均を ${m}点に するには、${n}回めに 何点 とれば よいですか。`,
      figure: alt ? tableFig(sc, [...prev, '？']) : undefined,
      hints: [
        `まず ${n}回の 合計を 求めよう。合計 ＝ 平均 × 個数。`,
        `${n}回の 合計は ${m} × ${n} ＝ ${m * n}点。${n - 1}回めまでの 合計は ${sum(prev)}点。`,
        `${m * n} − ${sum(prev)}を 計算しよう。`,
      ],
      explain: `${n}回の 合計は ${m} × ${n} ＝ ${m * n}点。${n - 1}回めまでの 合計が ${sum(prev)}点なので、${m * n} − ${sum(prev)} ＝ ${last}点です。`,
      identity: `missing${alt ? '-alt' : ''}:${key}`,
      alt,
      fields: [{ label: '点', answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [m, 'mean-as-value'],
        [m * n, 'total-only'],
        [m * (n - 1) - sum(prev) >= 0 ? m * (n - 1) - sum(prev) : null, 'count-wrong'],
      ]),
    };
    return item;
  }
}

/** 文章題（8場面。alt: 表で） */
function story(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, SCENES);
  const n = rng.int(3, 5);
  const v = values(rng, n, sc.lo, sc.hi, false);
  const answers = [meanAns(v)];
  const span = sc.each === '日め' ? `${n}日間` : sc.each === '回め' ? `${n}回` : `${n}こ`;
  return {
    engine: 'number',
    id: `story${alt ? '-alt' : ''}:${sc.id}:${keyOf(v)}`,
    objective: 'story',
    level,
    prompt: alt
      ? `表は ${span}の ${sc.what}です。平均は 何${sc.unit}ですか。`
      : `${span}の ${sc.what}は ${listText(v, sc.unit)}でした。平均は 何${sc.unit}ですか。`,
    figure: alt ? tableFig(sc, v) : undefined,
    hints: meanHints(v, sc.unit),
    explain: meanExplain(v, sc.unit),
    identity: `story${alt ? '-alt' : ''}:${sc.id}:${keyOf(v)}`,
    alt,
    fields: [{ label: sc.unit, answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongList(answers, meanWrongs(v)),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['mean', 'story'] },
  { objs: ['zero', 'mean', 'story'] },
  { objs: ['total', 'missing', 'zero'] },
  { objs: ['mean', 'zero', 'total', 'missing', 'story'] },
];

export function generateAverage(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'mean':
      return mean(level, rng, alt);
    case 'zero':
      return zero(level, rng, alt);
    case 'total':
      return total(level, rng, alt);
    case 'missing':
      return missing(level, rng, alt);
    case 'story':
      return story(level, rng, alt);
  }
}

/** おてほんの ならす図（コップの 水の かさ） */
function levelFig(v: number[], m: number): Figure {
  const k = 16;
  let body = '';
  v.forEach((x, i) => {
    const X = 20 + i * 50;
    body += `<rect x="${X}" y="${20}" width="34" height="${10 * k}" fill="none" stroke="var(--ink)" stroke-width="2"/>`;
    body += `<rect x="${X}" y="${20 + (10 - x) * k}" width="34" height="${x * k}" fill="var(--sky)"/>`;
  });
  body += `<line x1="12" y1="${20 + (10 - m) * k}" x2="${20 + v.length * 50}" y2="${20 + (10 - m) * k}" stroke="var(--ink)" stroke-width="2" stroke-dasharray="6 4"/>`;
  return {
    kind: 'svg',
    label: 'コップの 水を ならした 図',
    markup: `<svg viewBox="0 0 ${40 + v.length * 50} ${200}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`,
  };
}

export const average: UnitSpec = finishUnit(
  {
    id: 'g5.math.average',
    title: '平均',
    stage: 'g5',
    subject: 'math',
    domain: 'D-data',
    kind: 'calc',
    priority: 'P1',
    status: 'ready',
    icon: 'mode-compare',
    prereq: ['g5.math.decimal-div'],
    objectives: [
      { id: 'mean', title: '平均を 求める（ならす）' },
      { id: 'zero', title: '0の ある ときの 平均' },
      { id: 'total', title: '平均から 合計を 求める・見積もる' },
      { id: 'missing', title: '平均から のこりの 1つを 求める' },
      { id: 'story', title: '平均の 文章題' },
    ],
    misconceptions: [
      {
        id: 'no-divide',
        explain: '合計を 求めた ところで 止まったのかな。平均は 合計を 個数で わって 求めるよ。',
      },
      {
        id: 'zero-skip',
        explain: '0の 日を 数に 入れなかったのかな。0も 1日の 記録なので、個数に 入れて わるよ。',
      },
      {
        id: 'count-wrong',
        explain: '個数を 数えまちがえたのかな。いくつの 数を たしたかを もう一度 数えよう。',
      },
      {
        id: 'op-swap',
        explain: 'わり算を したのかな。合計 ＝ 平均 × 個数 だよ。合計は 平均より 大きく なるね。',
      },
      {
        id: 'add-instead',
        explain: '平均と 個数を たしたのかな。合計は 平均 × 個数の かけ算で 求めるよ。',
      },
      {
        id: 'mean-as-value',
        explain:
          '平均と 同じ 点数を 答えたのかな。前の 回の 点が 平均より 低いと、のこりの 回で おぎなう 分が いるよ。合計から 考えよう。',
      },
      {
        id: 'total-only',
        explain:
          '全部の 回の 合計を 答えたのかな。そこから これまでの 合計を ひくと、のこりの 1回の 点数に なるよ。',
      },
    ],
    levels: [
      { label: '平均を 求める', chance: 0.02 },
      { label: '0の ある 平均', chance: 0.02 },
      { label: '平均から 合計・のこり', chance: 0.02 },
      { label: 'まとめ', chance: 0.02 },
    ],
    intro: [
      {
        text: '4この コップに 水が 6dL、3dL、5dL、2dL 入って います。同じ 量に なるように ならします。',
        figure: levelFig([6, 3, 5, 2], 4),
      },
      {
        text: 'ならした 大きさを 平均と いいます。平均 ＝ 合計 ÷ 個数。（6 ＋ 3 ＋ 5 ＋ 2）÷ 4 ＝ 4で、平均は 4dLです。',
        figure: expr('（6 ＋ 3 ＋ 5 ＋ 2）÷ 4 ＝ 4'),
      },
      {
        text: '0の 日も 1日と 数えて、個数に 入れます。また、合計 ＝ 平均 × 個数 で 合計を 求める ことも できます。',
      },
    ],
    source: {
      kind: 'generator',
      generate: ({ level, rng, index }) => generateAverage(level, rng, index),
    },
    review: 'type',
    basis:
      '小学校学習指導要領（平成29年告示）算数 第5学年 D(2) 測定値の平均（平均の意味・求め方、平均を用いた見積もり）',
    revised: REVISED,
  },
  '走《はし》りはばとび 投《な》げ 点数《てんすう》 点《てん》 雨《あめ》 図書室《としょしつ》 歩《ほ》 歩《ある》いた 家《いえ》 公園《こうえん》 低《ひく》い 前《まえ》 回《かい》め 日《にち》め',
);
