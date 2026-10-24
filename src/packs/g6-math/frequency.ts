/**
 * g6.math.frequency 度数分布表と柱状グラフ（ヒストグラム）（curriculum-matrix 3.9）。
 *
 * データは例示（架空の記録）。階級は「〜以上〜未満」。同一性キー: 問い × データ（度数の並び）。
 * 柱状グラフは graph エンジンの棒グラフで代用する（棒の間にすき間がある。要望: 柱状グラフの表示）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, GraphItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { finishUnit, opts, pick, pickObj, REVISED, wrongList } from './util';

type Obj = 'table' | 'hist' | 'class' | 'ratio';

interface Ctx {
  id: string;
  what: string;
  unit: string;
  lo: number;
  w: number;
  k: number;
  /** 大きいほど よい 記録か */
  higherBetter: boolean;
}
const CTXS: Ctx[] = [
  { id: 'throw', what: 'ソフトボール投げの 記録', unit: 'm', lo: 10, w: 5, k: 6, higherBetter: true },
  { id: 'commute', what: '家から 学校までの 通学時間', unit: '分', lo: 0, w: 5, k: 6, higherBetter: false },
  { id: 'jump', what: '1分間の なわとびの 回数', unit: '回', lo: 40, w: 10, k: 6, higherBetter: true },
  { id: 'reading', what: '1週間の 読書《どくしょ》時間', unit: '分', lo: 0, w: 20, k: 6, higherBetter: true },
];
const lab = (c: Ctx, i: number) => `${c.lo + i * c.w}〜${c.lo + (i + 1) * c.w}`;
const labs = (c: Ctx) => Array.from({ length: c.k }, (_, i) => lab(c, i));
const range = (c: Ctx, i: number) => `${c.lo + i * c.w}${c.unit}以上 ${c.lo + (i + 1) * c.w}${c.unit}未満`;

/** 度数の並び（合計 n、各 0〜max） */
function makeCounts(rng: Rng, k: number, n: number, max = 9): number[] {
  for (let t = 0; t < 200; t++) {
    const xs = Array.from({ length: k }, () => 0);
    for (let i = 0; i < n; i++) xs[Math.min(k - 1, Math.max(0, Math.round((rng.next() + rng.next() + rng.next()) / 3 * k - 0.5)))]!++;
    if (Math.max(...xs) <= max && xs.filter((x) => x > 0).length >= 4) return xs;
  }
  const base = Math.floor(n / k);
  return Array.from({ length: k }, (_, i) => base + (i < n - base * k ? 1 : 0));
}

function freqTable(c: Ctx, cnt: number[]): Figure {
  return {
    kind: 'table',
    header: [`${c.what}（${c.unit}）`, '人数（人）'],
    rows: [...cnt.map((v, i) => [`${lab(c, i)}`, String(v)]), ['合計', String(cnt.reduce((a, b) => a + b, 0))]],
  };
}
const NOTE = (c: Ctx) => `（「${lab(c, 0)}」は ${c.lo}以上 ${c.lo + c.w}未満の 階級です）`;

// ---- 度数分布表に 整理する ----
function tableItem(level: number, rng: Rng, alt: boolean): Item {
  const c = pick(rng, CTXS);
  if (alt) {
    const n = rng.int(20, 30);
    const cnt = makeCounts(rng, c.k, n);
    const i = rng.int(2, c.k - 2);
    const up = c.higherBetter;
    const ans = up ? cnt.slice(i).reduce((a, b) => a + b, 0) : cnt.slice(0, i).reduce((a, b) => a + b, 0);
    const answer = { kind: 'int' as const, value: ans };
    const edge = c.lo + i * c.w;
    return {
      engine: 'number',
      id: `table-alt:${c.id}:${cnt.join(',')}:${i}`,
      objective: 'table',
      level,
      prompt: `度数分布表は、${n}人の ${c.what}を まとめた ものです。${up ? `${edge}${c.unit}以上` : `${edge}${c.unit}未満`}の 人は 何人ですか。${NOTE(c)}`,
      figure: freqTable(c, cnt),
      hints: [
        `${up ? `${edge}${c.unit}以上` : `${edge}${c.unit}未満`}に 入る 階級を 全部 さがそう。`,
        up ? `${lab(c, i)}の 階級から 下の 階級 全部だね。` : `${lab(c, i - 1)}の 階級から 上の 階級 全部だね。`,
        'それらの 階級の 人数を たそう。',
      ],
      explain: `${up ? `${lab(c, i)}から ${lab(c, c.k - 1)}` : `${lab(c, 0)}から ${lab(c, i - 1)}`}の 階級の 人数を たして ${ans}人です。`,
      identity: `table:cum:${c.id}:${cnt.join(',')}:${i}`,
      alt: true,
      fields: [{ label: '人', answer }],
      wrongAnswers: wrongList(
        [answer],
        [
          [up ? cnt[i]! : cnt[i - 1]!, 'cumulative'],
          [up ? ans - cnt[i]! : ans + cnt[i]!, 'boundary'],
        ],
      ),
    };
  }
  // 生の データを 数える（境目の 値を ふくむ）
  const n = rng.int(14, 18);
  const i = rng.int(1, c.k - 2);
  const a = c.lo + i * c.w;
  const b = a + c.w;
  const top = c.lo + c.k * c.w;
  const xs: number[] = [a, b];
  while (xs.length < n) xs.push(rng.int(c.lo, top - 1));
  const shuffled = rng.shuffle(xs);
  const ans = shuffled.filter((x) => x >= a && x < b).length;
  const answer = { kind: 'int' as const, value: ans };
  const withB = shuffled.filter((x) => x >= a && x <= b).length;
  const withoutA = shuffled.filter((x) => x > a && x < b).length;
  return {
    engine: 'number',
    id: `table:${c.id}:${shuffled.join(',')}`,
    objective: 'table',
    level,
    prompt: `${n}人の ${c.what}（${c.unit}）です。${range(c, i)}の 人は 何人ですか。`,
    figure: { kind: 'text', text: shuffled.join('、 '), size: 'm' },
    hints: [
      `${a}${c.unit}以上は ${a}を ふくむ、${b}${c.unit}未満は ${b}を ふくまないよ。`,
      `${a}、${a + 1}、…、${b - 1}の 記録を さがして 印を つけよう。`,
      `${b}${c.unit}の 人は 次の 階級に 入るよ。数えた 印の 数を たしかめよう。`,
    ],
    explain: `${a}以上 ${b}未満の 記録は ${shuffled.filter((x) => x >= a && x < b).sort((p, q) => p - q).join('、')}の ${ans}人です。${b}${c.unit}は 入りません。`,
    identity: `table:${c.id}:${[...shuffled].sort((p, q) => p - q).join(',')}:${i}`,
    alt: false,
    fields: [{ label: '人', answer }],
    wrongAnswers: wrongList(
      [answer],
      [
        [withB, 'boundary'],
        [withoutA, 'boundary'],
      ],
    ),
  };
}

// ---- 柱状グラフ ----
function histItem(level: number, rng: Rng, alt: boolean): GraphItem {
  const c = pick(rng, CTXS);
  const n = rng.int(20, 32);
  const cnt = makeCounts(rng, c.k, n, 10);
  const step = rng.next() < 0.5 ? 1 : 2;
  if (alt) {
    const c2 = cnt.map((v) => (step === 2 && v % 2 ? v + 1 : v));
    return {
      engine: 'graph',
      id: `hist-alt:${c.id}:${c2.join(',')}`,
      objective: 'hist',
      level,
      prompt: `度数分布表を 見て、柱状グラフを かこう。${NOTE(c)}`,
      hints: ['横の じくは 階級、縦《たて》の じくは 人数だよ。', `縦《たて》の じくの 1めもりは ${step}人。`, '階級ごとに、人数の 高さまで 柱を のばそう。'],
      explain: '階級ごとの 人数を 柱の 高さで 表します。柱状グラフでは、どの 階級に 人数が 多いか ひと目で 分かります。',
      identity: `hist:make:${c.id}:${c2.join(',')}`,
      alt: true,
      data: { kind: 'bar', labels: labs(c), values: c2, scaleStep: step, max: Math.max(...c2) + 2 + (step === 2 ? 0 : 1), unit: '人', header: [`${c.what}（${c.unit}）`, '人数（人）'], title: c.what },
      task: { kind: 'make', showTable: true },
      misconceptions: { scaleAsOne: 'scale-as-one' },
    };
  }
  const i = pick(rng, cnt.map((v, k) => (v > 0 ? k : -1)).filter((k) => k >= 0));
  const answer = { kind: 'int' as const, value: cnt[i]! };
  return {
    engine: 'graph',
    id: `hist:${c.id}:${cnt.join(',')}:${i}:${step}`,
    objective: 'hist',
    level,
    prompt: `柱状グラフは、${n}人の ${c.what}を 表して います。${range(c, i)}の 人は 何人ですか。`,
    hints: [`${range(c, i)}は「${lab(c, i)}」の 柱だよ。`, `縦《たて》の じくの 1めもりは ${step}人。`, '柱の 上の はしから 左へ 進んで めもりを 読もう。'],
    explain: `「${lab(c, i)}」の 柱の 高さを 読むと ${cnt[i]}人です。`,
    identity: `hist:${c.id}:${cnt.join(',')}:${i}:${step}`,
    alt: false,
    data: { kind: 'bar', labels: labs(c), values: cnt, scaleStep: step, max: Math.max(...cnt) + (step === 2 ? 2 : 1), labelEvery: step === 1 ? 2 : 1, unit: '人', title: c.what },
    task: {
      kind: 'number',
      fields: [{ label: '人', answer }],
      wrongAnswers: wrongList(
        [answer],
        [
          [step === 2 && cnt[i]! % 2 === 0 ? cnt[i]! / 2 : null, 'scale-as-one'],
          [i > 0 ? cnt[i - 1]! : null, 'boundary'],
          [i < c.k - 1 ? cnt[i + 1]! : null, 'boundary'],
        ],
      ),
    },
  };
}

// ---- 階級を 答える ----
function classItem(level: number, rng: Rng, alt: boolean): ChoiceItem {
  const c = pick(rng, CTXS);
  const n = rng.int(20, 30);
  const cnt = makeCounts(rng, c.k, n);
  let i: number;
  let prompt: string;
  let hints: [string, string, string];
  let explain: string;
  let wrongs: [string, string][];
  let tag: string;
  if (!alt) {
    // 上位（よい 方）から r番目の 人の 階級
    const r = rng.int(2, Math.min(12, n - 1));
    tag = String(r);
    const order = c.higherBetter ? [...cnt.keys()].reverse() : [...cnt.keys()];
    let acc = 0;
    i = order[0]!;
    for (const k of order) {
      acc += cnt[k]!;
      if (acc >= r) {
        i = k;
        break;
      }
    }
    // 反対から 数えた 階級
    let acc2 = 0;
    let rev = order[order.length - 1]!;
    for (const k of [...order].reverse()) {
      acc2 += cnt[k]!;
      if (acc2 >= r) {
        rev = k;
        break;
      }
    }
    prompt = `度数分布表は、${n}人の ${c.what}です。${c.higherBetter ? '記録が よい（大きい）' : '時間が 短い'} ほうから ${r}番目の 人は、どの 階級に 入りますか。${NOTE(c)}`;
    hints = [
      c.higherBetter ? 'いちばん 大きい 階級から 順に 人数を たして いこう。' : 'いちばん 小さい 階級から 順に 人数を たして いこう。',
      `人数を たして いって、はじめて ${r}人 以上に なる 階級を さがそう。`,
      `${order.slice(0, 2).map((k) => `${lab(c, k)}は ${cnt[k]}人`).join('、')}…`,
    ];
    explain = `${c.higherBetter ? '大きい' : '小さい'} 階級から 人数を たして いくと、「${lab(c, i)}」で はじめて ${r}人 以上に なるので、${r}番目の 人は この 階級に 入ります。`;
    wrongs = [
      [rev !== i ? lab(c, rev) : '', 'rank-reverse'],
      [i > 0 ? lab(c, i - 1) : '', 'boundary'],
      [i < c.k - 1 ? lab(c, i + 1) : '', 'boundary'],
    ];
  } else {
    // ある 記録が 入る 階級（境目の 値）
    i = rng.int(1, c.k - 1);
    tag = String(i);
    const v = c.lo + i * c.w;
    prompt = `${c.what}が ${v}${c.unit}の 人は、どの 階級に 入りますか。${NOTE(c)}`;
    hints = ['「〜以上」は その 数を ふくみ、「〜未満」は ふくまないよ。', `「${lab(c, i - 1)}」は ${c.lo + (i - 1) * c.w}以上 ${v}未満。${v}は 入るかな。`, `${v}以上の 階級は どれかな。`];
    explain = `${v}${c.unit}は「${v}以上」なので「${lab(c, i)}」の 階級に 入ります。「${lab(c, i - 1)}」は ${v}未満までです。`;
    wrongs = [
      [lab(c, i - 1), 'boundary'],
      [i < c.k - 1 ? lab(c, i + 1) : '', 'boundary'],
      [i > 1 ? lab(c, i - 2) : '', 'boundary'],
    ];
  }
  return {
    engine: 'choice',
    id: `class${alt ? '-alt' : ''}:${c.id}:${alt ? '' : cnt.join(',')}:${tag}`,
    objective: 'class',
    level,
    prompt,
    figure: alt ? undefined : freqTable(c, cnt),
    hints,
    explain,
    identity: alt ? `class:edge:${c.id}:${i}` : `class:rank:${c.id}:${cnt.join(',')}:${tag}`,
    alt,
    options: opts(
      lab(c, i),
      wrongs.filter((w) => w[0] !== ''),
    ),
  };
}

// ---- 割合 ----
function ratioItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const c = pick(rng, CTXS);
  const n = pick(rng, [20, 25, 50]);
  const cnt = makeCounts(rng, c.k, n, n === 50 ? 16 : 9);
  const i = rng.int(2, c.k - 2);
  const up = c.higherBetter;
  const part = up ? cnt.slice(i).reduce((a, b) => a + b, 0) : cnt.slice(0, i).reduce((a, b) => a + b, 0);
  const pct = (part * 100) / n;
  const answer = { kind: 'int' as const, value: pct };
  const edge = c.lo + i * c.w;
  const cond = up ? `${edge}${c.unit}以上` : `${edge}${c.unit}未満`;
  return {
    engine: 'number',
    id: `ratio${alt ? '-alt' : ''}:${c.id}:${cnt.join(',')}:${i}`,
    objective: 'ratio',
    level,
    prompt: `${n}人の ${c.what}を 調べました。${cond}の 人は、全体の 何%ですか。${NOTE(c)}`,
    figure: alt ? undefined : freqTable(c, cnt),
    hints: [`まず ${cond}の 人数を 求めよう。`, `${cond}の 人は ${part}人。`, `${part} ÷ ${n} × 100を 計算しよう。`],
    explain: `${cond}の 人は ${part}人。${part} ÷ ${n} ＝ ${part / n}、× 100で ${pct}%です。`,
    identity: `ratio:${c.id}:${cnt.join(',')}:${i}${alt ? ':graph' : ''}`,
    alt,
    fields: [{ label: '%', answer }],
    wrongAnswers: wrongList(
      [answer],
      [
        [part, 'ratio-count'],
        [((up ? cnt[i]! : cnt[i - 1]!) * 100) % n === 0 ? ((up ? cnt[i]! : cnt[i - 1]!) * 100) / n : null, 'cumulative'],
      ],
    ),
  };
}

/** 割合の 別例: 柱状グラフから */
function ratioAlt(level: number, rng: Rng): GraphItem {
  const it = ratioItem(level, rng, true);
  const m = /^ratio-alt:([a-z]+):([\d,]+):(\d+)$/.exec(it.id)!;
  const c = CTXS.find((x) => x.id === m[1])!;
  const cnt = m[2]!.split(',').map(Number);
  return {
    engine: 'graph',
    id: it.id,
    objective: 'ratio',
    level,
    prompt: it.prompt.replace('調べました。', '調べて 柱状グラフに 表しました。'),
    hints: it.hints,
    explain: it.explain,
    identity: it.identity,
    alt: true,
    data: { kind: 'bar', labels: labs(c), values: cnt, scaleStep: 1, max: Math.max(...cnt) + 1, labelEvery: 2, unit: '人', title: c.what },
    task: { kind: 'number', fields: it.fields, wrongAnswers: it.wrongAnswers },
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['table', 'hist'] },
  { objs: ['class', 'hist', 'table'] },
  { objs: ['ratio', 'class'] },
  { objs: ['ratio', 'class', 'hist', 'table'] },
];

export function generateFrequency(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'table':
      return tableItem(level, rng, alt);
    case 'hist':
      return histItem(level, rng, alt);
    case 'class':
      return classItem(level, rng, alt);
    case 'ratio':
      return alt ? ratioAlt(level, rng) : ratioItem(level, rng, false);
  }
}

export const frequency: UnitSpec = finishUnit({
  id: 'g6.math.frequency',
  title: '度数分布表と 柱状グラフ',
  stage: 'g6',
  subject: 'math',
  domain: 'D-data',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'notebook',
  prereq: ['g6.math.representative'],
  objectives: [
    { id: 'table', title: '度数分布表に 整理する・読む' },
    { id: 'hist', title: '柱状グラフを 読む・かく' },
    { id: 'class', title: '階級を 答える' },
    { id: 'ratio', title: '全体に 対する 割合' },
  ],
  misconceptions: [
    {
      id: 'boundary',
      explain:
        '階級の 境目を まちがえたのかな。「10以上 15未満」は 10を ふくみ、15を ふくまないよ。15は 次の 階級に 入るね。',
    },
    { id: 'cumulative', explain: '1つの 階級だけを 見たのかな。「〜以上」「〜未満」は、あてはまる 階級を 全部 合わせるよ。' },
    { id: 'scale-as-one', explain: '1めもりを 1人と 読んだのかな。縦《たて》の じくの 1めもりが 何人かを 先に 調べよう。' },
    { id: 'ratio-count', explain: '人数を そのまま 答えたのかな。割合（%）は、人数 ÷ 全体の 人数 × 100で 求めるよ。' },
    { id: 'rank-reverse', explain: '反対の はしから 数えたのかな。「よい ほう から」は、どちらの はしから 数えるか たしかめよう。' },
  ],
  levels: [
    { label: '度数分布表・柱状グラフ', chance: 0.05 },
    { label: '階級', chance: 0.1 },
    { label: '割合', chance: 0.05 },
    { label: 'まとめ', chance: 0.1 },
  ],
  intro: [
    {
      text: 'データを「10m以上 15m未満」のような 区間に 分けて 人数を 数えた 表を 度数分布表、区間を 階級、人数を 度数と いいます。',
      figure: freqTable(CTXS[0]!, [1, 3, 6, 5, 3, 2]),
    },
    {
      text: '度数分布表を 柱の グラフに した ものを 柱状グラフ（ヒストグラム）と いいます。どの 階級に 多く 集まって いるか、ちらばりの 様子が 分かります。',
      figure: { kind: 'bar', labels: labs(CTXS[0]!), values: [1, 3, 6, 5, 3, 2], scaleStep: 1, unit: '人' },
    },
    { text: '「以上」は その 数を ふくみ、「未満」は ふくみません。15mの 記録は「15〜20」の 階級に 入ります。' },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateFrequency(level, rng, index),
  },
  review: 'objective',
  basis: '小学校学習指導要領（平成29年告示）算数 第6学年 D(1) 度数分布を表す表やグラフ（柱状グラフ）',
  revised: REVISED,
});
