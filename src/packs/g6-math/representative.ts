/**
 * g6.math.representative 代表値（平均値・中央値・最頻値）とドットプロット（curriculum-matrix 3.9）。
 * ドットプロット → 3つの代表値 → どれで比べるか。
 *
 * データは例示（架空の記録）。同一性キー: 問い × データ（値の並び）。
 * ドットプロットは graph エンジンの絵グラフ（○を積む）で代用する（要望: 数直線の上に点を打つドットプロット）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, GraphItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import {
  dec,
  decAns,
  finishUnit,
  opts,
  pick,
  pickObj,
  range,
  REVISED,
  STROKE,
  svg,
  svgText,
  wrongList,
} from './util';

type Obj = 'mean' | 'median' | 'mode' | 'dot' | 'choose';

interface Ctx {
  id: string;
  what: string;
  unit: string;
  min: number;
  max: number;
}
const CTXS: Ctx[] = [
  {
    id: 'quiz',
    what: '10点《てん》満点《まんてん》の 小テストの 点数《てんすう》',
    unit: '点',
    min: 2,
    max: 10,
  },
  { id: 'books', what: '1か月に 読んだ 本の 数', unit: '冊', min: 0, max: 8 },
  { id: 'shoes', what: 'くつの サイズ', unit: 'cm', min: 19, max: 25 },
  { id: 'goals', what: 'シュートが 入った 回数（10回 中）', unit: '回', min: 1, max: 9 },
];

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
/** 中央値（10倍した 整数） */
function median10(xs: number[]): number {
  const s = sorted(xs);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2]! * 10 : (s[n / 2 - 1]! + s[n / 2]!) * 5;
}
function counts(xs: number[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
}
/** 最頻値（1つに 決まらなければ null） */
function modeOf(xs: number[]): { v: number; c: number } | null {
  const m = [...counts(xs).entries()].sort((a, b) => b[1] - a[1]);
  if (m.length > 1 && m[0]![1] === m[1]![1]) return null;
  return { v: m[0]![0], c: m[0]![1] };
}

/** データを作る（条件を満たすまで 作り直す） */
function makeData(rng: Rng, c: Ctx, n: number, ok: (xs: number[]) => boolean): number[] {
  for (let t = 0; t < 300; t++) {
    const xs = Array.from({ length: n }, () => rng.int(c.min, c.max));
    if (ok(xs)) return xs;
  }
  // 条件を 満たす 例（ここには 来ない 想定）
  return Array.from({ length: n }, (_, i) => c.min + (i % 3));
}

const listFig = (xs: number[], c: Ctx): Figure => ({
  kind: 'text',
  text: xs.map((x) => `${x}`).join('、 ') + ` （${c.unit}）`,
  size: 'm',
});

function dotData(xs: number[], c: Ctx, title: string): GraphItem['data'] {
  const labels = range(c.min, c.max);
  const cnt = counts(xs);
  const vals = labels.map((v) => cnt.get(v) ?? 0);
  return {
    kind: 'picture',
    labels: labels.map(String),
    values: vals,
    max: Math.max(...vals) + 1,
    unit: '人',
    title,
  };
}

const dataKey = (xs: number[]) => xs.join(',');

/** 導入の ドットプロット（数直線の 上に ○を 積む） */
function dotSvg(labels: number[], cnt: number[]): Figure {
  let body = `<line x1="20" y1="150" x2="${40 + labels.length * 40}" y2="150" ${STROKE}/>`;
  labels.forEach((v, i) => {
    const x = 40 + i * 40;
    body += `<line x1="${x}" y1="144" x2="${x}" y2="156" ${STROKE}/>` + svgText(x, 172, v, 15);
    for (let k = 0; k < cnt[i]!; k++)
      body += `<circle cx="${x}" cy="${132 - k * 24}" r="10" fill="var(--sky)" ${STROKE}/>`;
  });
  return svg(60 + labels.length * 40, 190, body, 'ドットプロットの 例');
}

// ---- 平均値 ----
function meanItem(level: number, rng: Rng, alt: boolean): Item {
  const c = pick(rng, CTXS);
  const n = pick(rng, [5, 6, 8, 10]);
  const xs = makeData(rng, c, n, (v) => (sum(v) * 10) % n === 0);
  const s = sum(xs);
  const ans10 = (s * 10) / n;
  const answer = decAns(ans10, 1);
  const kinds = counts(xs).size;
  const cands: [string | null, string][] = [
    [(s * 10) % kinds === 0 ? dec((s * 10) / kinds, 1) : null, 'mean-kinds'],
    [median10(xs) !== ans10 ? dec(median10(xs), 1) : null, 'mean-median'],
    [String(s), 'mean-kinds'],
  ];
  const base = {
    objective: 'mean',
    level,
    hints: [
      '平均値は、データの 合計 ÷ データの 個数 だよ。',
      `合計は ${xs.join(' ＋ ')} ＝ ${s}。`,
      `データの 個数は ${n}。${s} ÷ ${n}を 計算しよう。`,
    ] as [string, string, string],
    explain: `合計 ${s} ÷ 個数 ${n} ＝ ${dec(ans10, 1)}。平均値は ${dec(ans10, 1)}${c.unit}です。`,
    identity: `mean:${c.id}:${dataKey(sorted(xs))}${alt ? ':dot' : ''}`,
    alt,
  };
  if (alt) {
    const it: GraphItem = {
      ...base,
      engine: 'graph',
      id: `mean-alt:${c.id}:${dataKey(xs)}`,
      prompt: `ドットプロットは、${n}人の ${c.what}を 表して います。平均値を 求めよう。`,
      data: dotData(xs, c, c.what),
      task: {
        kind: 'number',
        fields: [{ label: c.unit, answer }],
        keys: ['decimal'],
        wrongAnswers: wrongList([answer], cands),
      },
    };
    return it;
  }
  const it: NumberItem = {
    ...base,
    engine: 'number',
    id: `mean:${c.id}:${dataKey(xs)}`,
    prompt: `${n}人の ${c.what}を 調べました。平均値を 求めよう。`,
    figure: listFig(xs, c),
    fields: [{ label: c.unit, answer }],
    keys: ['decimal'],
    wrongAnswers: wrongList([answer], cands),
  };
  return it;
}

// ---- 中央値 ----
function medianItem(level: number, rng: Rng, alt: boolean): Item {
  const c = pick(rng, CTXS);
  const n = pick(rng, [7, 8, 9, 10, 11]);
  // 並べる前の 真ん中と 並べた 真ん中が ちがう データ
  const xs = makeData(rng, c, n, (v) => {
    const raw = n % 2 ? v[(n - 1) / 2]! * 10 : (v[n / 2 - 1]! + v[n / 2]!) * 5;
    return raw !== median10(v);
  });
  const m10 = median10(xs);
  const answer = decAns(m10, 1);
  const s = sorted(xs);
  const raw10 = n % 2 ? xs[(n - 1) / 2]! * 10 : (xs[n / 2 - 1]! + xs[n / 2]!) * 5;
  const cands: [string | null, string][] = [
    [dec(raw10, 1), 'no-sort'],
    [n % 2 ? null : String(s[n / 2 - 1]), 'median-even'],
    [n % 2 ? null : String(s[n / 2]), 'median-even'],
    [String(n % 2 ? (n + 1) / 2 : n / 2), 'median-count'],
  ];
  const hints: [string, string, string] = [
    '中央値は、データを 小さい 順に 並べた ときの 真ん中の 値だよ。',
    `小さい 順に 並べると ${s.join('、 ')}。`,
    n % 2
      ? `${n}個の 真ん中は、小さい 方から ${(n + 1) / 2}番目。`
      : `${n}個なので 真ん中は 2つ（${n / 2}番目と ${n / 2 + 1}番目）。その 2つの 平均を 求めよう。`,
  ];
  const explain =
    n % 2
      ? `小さい 順に 並べて ${(n + 1) / 2}番目の 値 ${dec(m10, 1)}が 中央値です。`
      : `小さい 順に 並べて ${n / 2}番目の ${s[n / 2 - 1]}と ${n / 2 + 1}番目の ${s[n / 2]}の 平均 ${dec(m10, 1)}が 中央値です。`;
  if (alt) {
    const it: GraphItem = {
      engine: 'graph',
      id: `median-alt:${c.id}:${dataKey(xs)}`,
      objective: 'median',
      level,
      prompt: `ドットプロットは、${n}人の ${c.what}を 表して います。中央値を 求めよう。`,
      hints: [
        '中央値は、データを 小さい 順に 並べた ときの 真ん中の 値だよ。',
        'ドットプロットは もう 小さい 順に 並んで いるね。左から ○を 数えよう。',
        hints[2],
      ],
      explain,
      identity: `median:${c.id}:${dataKey(s)}:dot`,
      alt: true,
      data: dotData(xs, c, c.what),
      task: {
        kind: 'number',
        fields: [{ label: c.unit, answer }],
        keys: ['decimal'],
        wrongAnswers: wrongList(
          [answer],
          cands.filter((x) => x[1] !== 'no-sort'),
        ),
      },
    };
    return it;
  }
  const it: NumberItem = {
    engine: 'number',
    id: `median:${c.id}:${dataKey(xs)}`,
    objective: 'median',
    level,
    prompt: `${n}人の ${c.what}を 調べました。中央値を 求めよう。`,
    figure: listFig(xs, c),
    hints,
    explain,
    identity: `median:${c.id}:${dataKey(xs)}`,
    alt: false,
    fields: [{ label: c.unit, answer }],
    keys: ['decimal'],
    wrongAnswers: wrongList([answer], cands),
  };
  return it;
}

// ---- 最頻値 ----
function modeItem(level: number, rng: Rng, alt: boolean): Item {
  const c = pick(rng, CTXS);
  const n = pick(rng, [8, 9, 10, 12]);
  const xs = makeData(rng, c, n, (v) => {
    const m = modeOf(v);
    return m !== null && m.c >= 3 && m.v !== Math.max(...v) && m.c !== m.v;
  });
  const m = modeOf(xs)!;
  const answer = { kind: 'int' as const, value: m.v };
  const cands: [string | null, string][] = [
    [String(m.c), 'mode-freq'],
    [String(Math.max(...xs)), 'mode-max'],
  ];
  const hints: [string, string, string] = [
    '最頻値は、データの 中で いちばん 多く 出て くる 値だよ。',
    alt
      ? 'ドットプロットで、○が いちばん 高く 積まれて いる ところを さがそう。'
      : '同じ 値が いくつ あるか、値ごとに 数えよう。',
    `${m.c}回 出て くる 値が あるよ。`,
  ];
  const explain = `${m.v}${c.unit}が ${m.c}人で いちばん 多いので、最頻値は ${m.v}${c.unit}です（人数の ${m.c}では ありません）。`;
  if (alt) {
    const it: GraphItem = {
      engine: 'graph',
      id: `mode-alt:${c.id}:${dataKey(xs)}`,
      objective: 'mode',
      level,
      prompt: `ドットプロットは、${n}人の ${c.what}を 表して います。最頻値を 求めよう。`,
      hints,
      explain,
      identity: `mode:${c.id}:${dataKey(sorted(xs))}:dot`,
      alt: true,
      data: dotData(xs, c, c.what),
      task: {
        kind: 'number',
        fields: [{ label: c.unit, answer }],
        wrongAnswers: wrongList([answer], cands),
      },
    };
    return it;
  }
  const it: NumberItem = {
    engine: 'number',
    id: `mode:${c.id}:${dataKey(xs)}`,
    objective: 'mode',
    level,
    prompt: `${n}人の ${c.what}を 調べました。最頻値を 求めよう。`,
    figure: listFig(xs, c),
    hints,
    explain,
    identity: `mode:${c.id}:${dataKey(sorted(xs))}`,
    alt: false,
    fields: [{ label: c.unit, answer }],
    wrongAnswers: wrongList([answer], cands),
  };
  return it;
}

// ---- ドットプロット ----
function dotItem(level: number, rng: Rng, alt: boolean): GraphItem {
  const c = pick(rng, CTXS);
  const n = pick(rng, [8, 9, 10, 12]);
  const xs = makeData(rng, c, n, (v) => Math.max(...counts(v).values()) <= 4);
  const data = dotData(xs, c, c.what);
  if (alt) {
    const v = pick(rng, [...counts(xs).keys()]);
    const cnt = counts(xs).get(v)!;
    const answer = { kind: 'int' as const, value: cnt };
    return {
      engine: 'graph',
      id: `dot-alt:${c.id}:${dataKey(xs)}:${v}`,
      objective: 'dot',
      level,
      prompt: `ドットプロットは、${n}人の ${c.what}を 表して います。${v}${c.unit}の 人は 何人ですか。`,
      hints: [
        'ドットプロットの ○1つが 1人だよ。',
        `横の じくの ${v}の 上を 見よう。`,
        `${v}の 上の ○を 数えよう。`,
      ],
      explain: `${v}の 上に ○が ${cnt}こ あるので、${cnt}人です。`,
      identity: `dot:read:${c.id}:${dataKey(sorted(xs))}:${v}`,
      alt: true,
      data,
      task: {
        kind: 'number',
        fields: [{ label: '人', answer }],
        wrongAnswers: wrongList([answer], [[v, 'dot-read']]),
      },
    };
  }
  return {
    engine: 'graph',
    id: `dot:${c.id}:${dataKey(xs)}`,
    objective: 'dot',
    level,
    prompt: `${n}人の ${c.what}です。ドットプロットに 表そう（1人を ○1つで 表します）。\n${xs.join('、 ')}（${c.unit}）`,
    hints: [
      'データを 1つずつ 見て、その 値の 上に ○を 1つ 積もう。',
      '使った データに 印を つけると、数え落としが ないよ。',
      '同じ 値が いくつ あるか 数えて、その 数だけ ○を 積もう。',
    ],
    explain: `値ごとに 人数を 数えて ○を 積みます。${[...counts(xs).entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([v, k]) => `${v}${c.unit}が ${k}人`)
      .join('、')}。`,
    identity: `dot:make:${c.id}:${dataKey(sorted(xs))}`,
    alt: false,
    data: { ...data, max: 6 },
    task: { kind: 'make', showTable: false },
  };
}

// ---- どれで 比べるか（外れた 値が ある データ） ----
const CHOOSE_SCENES: {
  id: string;
  text: string;
  correct: string;
  wrongs: [string, string][];
  why: string;
}[] = [
  {
    id: 'shoes',
    text: 'くつ屋さんが、いちばん 多く 仕入れる くつの サイズを 決める とき',
    correct: '最頻値',
    wrongs: [
      ['平均値', 'mean-median'],
      ['中央値', 'mean-median'],
    ],
    why: 'いちばん 多く 売れる サイズが 知りたいので、最も 多い 値（最頻値）を 使います。',
  },
  {
    id: 'outlier',
    text: '1人だけ とても 大きい 記録が ある とき、データの 真ん中の 様子を 表す 値',
    correct: '中央値',
    wrongs: [
      ['平均値', 'mean-median'],
      ['いちばん 大きい 値', 'mode-max'],
    ],
    why: '平均値は とても 大きい 値に 引っぱられるので、真ん中の 順位の 値（中央値）が よいです。',
  },
  {
    id: 'total',
    text: '何回かの 記録の 合計を もとに、1回あたりの 量を 表す 値',
    correct: '平均値',
    wrongs: [
      ['最頻値', 'mode-freq'],
      ['中央値', 'mean-median'],
    ],
    why: '合計を 個数で 等しく ならした 値が 平均値です。',
  },
  {
    id: 'tshirt',
    text: '学年で そろえる Tシャツの サイズを、1つだけ 決める とき',
    correct: '最頻値',
    wrongs: [
      ['平均値', 'mean-median'],
      ['いちばん 大きい 値', 'mode-max'],
    ],
    why: 'いちばん 多くの 人に 合う サイズが よいので、最頻値を 使います。',
  },
  {
    id: 'allowance',
    text: '1人だけ とても 多い 人が いる おこづかいの 金がくで、ふつうの 人の 様子を 表す 値',
    correct: '中央値',
    wrongs: [
      ['平均値', 'mean-median'],
      ['いちばん 大きい 値', 'mode-max'],
    ],
    why: '平均値は とても 多い 1人に 引っぱられて 大きく なるので、中央値の ほうが ふつうの 様子を 表します。',
  },
  {
    id: 'half',
    text: '自分の 記録が、全体の 上の 半分に 入って いるかを 知りたい とき',
    correct: '中央値',
    wrongs: [
      ['平均値', 'mean-median'],
      ['最頻値', 'mode-freq'],
    ],
    why: '中央値より 上なら、上の 半分に 入って います。',
  },
  {
    id: 'even',
    text: 'みんなが 持って いる あめを、同じ 数ずつに ならすと 何こずつに なるかを 知りたい とき',
    correct: '平均値',
    wrongs: [
      ['中央値', 'mean-median'],
      ['最頻値', 'mode-freq'],
    ],
    why: '同じ 数ずつに ならした 値が 平均値です。',
  },
  {
    id: 'play',
    text: 'クラスで いちばん 人気の ある 遊びを、アンケートで 決める とき',
    correct: '最頻値',
    wrongs: [
      ['平均値', 'mean-median'],
      ['中央値', 'mean-median'],
    ],
    why: 'いちばん 多く 選ばれた もの（最頻値）が いちばん 人気です。',
  },
  {
    id: 'lunch',
    text: '給食《きゅうしょく》で いちばん 人気の ある メニューの 番号を 調べる とき',
    correct: '最頻値',
    wrongs: [
      ['平均値', 'mean-median'],
      ['中央値', 'mean-median'],
    ],
    why: '番号の 平均や 真ん中には 意味が ないので、いちばん 多い 値（最頻値）を 使います。',
  },
];

const MEAN_MEDIAN = new Set(['平均値', '中央値']);

function chooseItem(level: number, rng: Rng, alt: boolean): ChoiceItem {
  if (alt) {
    const s = pick(rng, CHOOSE_SCENES);
    return {
      engine: 'choice',
      id: `choose-alt:${s.id}`,
      objective: 'choose',
      level,
      prompt: `次の ときに 使う 代表値として、いちばん よいのは どれですか。\n${s.text}`,
      hints: [
        '平均値は 合計を ならした 値、中央値は 真ん中の 順位の 値、最頻値は いちばん 多い 値だよ。',
        '何を 知りたいのかを 考えよう。',
        'とても 大きい 値や、数の 大きさに 意味が ない データに 気を つけよう。',
      ],
      explain: s.why,
      identity: `choose:${s.id}`,
      alt: true,
      // 平均値 ⇔ 中央値 の 取りちがえ・いちばん 大きい 値 以外は「何を 知りたいか」の 誤り
      options: opts(
        s.correct,
        s.wrongs.map(([w, m]): [string, string] => [
          w,
          m === 'mode-max' ||
          (m === 'mean-median' && MEAN_MEDIAN.has(w) && MEAN_MEDIAN.has(s.correct))
            ? m
            : 'choose-purpose',
        ]),
      ),
    };
  }
  // 外れた 値が ある データ: 平均値と 中央値の どちらが 大きいか
  const c = pick(
    rng,
    CTXS.filter((x) => x.id !== 'shoes'),
  );
  const n = pick(rng, [5, 7]);
  const xs = makeData(rng, c, n, (v) => {
    const s = sorted(v);
    return (
      s[n - 1]! - s[n - 2]! >= 3 && (sum(v) * 10) % n === 0 && (sum(v) * 10) / n !== median10(v)
    );
  });
  const m10 = (sum(xs) * 10) / n;
  const md = median10(xs);
  const bigger = m10 > md ? '平均値' : '中央値';
  return {
    engine: 'choice',
    id: `choose:${c.id}:${dataKey(xs)}`,
    objective: 'choose',
    level,
    prompt: `${n}人の ${c.what}です。平均値と 中央値では、どちらが 大きいですか。`,
    figure: listFig(xs, c),
    hints: [
      '平均値と 中央値を それぞれ 求めて くらべよう。',
      `合計は ${sum(xs)}、個数は ${n}。小さい 順に 並べると ${sorted(xs).join('、 ')}。`,
      `平均値は ${sum(xs)} ÷ ${n}、中央値は ${(n + 1) / 2}番目の 値。`,
    ],
    explain: `平均値は ${dec(m10, 1)}、中央値は ${dec(md, 1)}なので、${bigger}の ほうが 大きいです。${m10 > md ? 'とても 大きい 値が あると、平均値は その 値に 引っぱられて 大きく なります。' : ''}`,
    identity: `choose:${c.id}:${dataKey(sorted(xs))}`,
    alt: false,
    options: [
      bigger === '平均値'
        ? { label: '平均値', correct: true }
        : { label: '平均値', misconception: 'mean-median' },
      bigger === '中央値'
        ? { label: '中央値', correct: true }
        : { label: '中央値', misconception: 'mean-median' },
      { label: '同じ', misconception: 'mean-median' },
    ],
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['dot', 'mean'] },
  { objs: ['median', 'mode', 'dot'] },
  { objs: ['median', 'mode', 'mean'] },
  { objs: ['choose', 'median', 'mode', 'mean'] },
];

export function generateRepresentative(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'mean':
      return meanItem(level, rng, alt);
    case 'median':
      return medianItem(level, rng, alt);
    case 'mode':
      return modeItem(level, rng, alt);
    case 'dot':
      return dotItem(level, rng, alt);
    case 'choose':
      return chooseItem(level, rng, alt);
  }
}

export const representative: UnitSpec = finishUnit({
  id: 'g6.math.representative',
  title: 'データの 代表値',
  stage: 'g6',
  subject: 'math',
  domain: 'D-data',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-sorting',
  prereq: ['g5.math.average'],
  objectives: [
    { id: 'dot', title: 'ドットプロットに 表す・読む' },
    { id: 'mean', title: '平均値' },
    { id: 'median', title: '中央値' },
    { id: 'mode', title: '最頻値' },
    { id: 'choose', title: '代表値を 使って くらべる' },
  ],
  misconceptions: [
    {
      id: 'no-sort',
      explain:
        '並べかえないで 真ん中の 値を 選んだのかな。中央値は、小さい 順に 並べてから 真ん中を 見るよ。',
    },
    {
      id: 'median-even',
      explain:
        'データの 個数が 偶数《ぐうすう》の ときは、真ん中に 2つの 値が あるよ。その 2つの 平均が 中央値だね。',
    },
    {
      id: 'median-count',
      explain: '真ん中の「順番」を 答えたのかな。その 順番に ある データの 値が 中央値だよ。',
    },
    {
      id: 'mode-freq',
      explain:
        '人数（出て きた 回数）を 答えたのかな。最頻値は、いちばん 多く 出て くる「値」の ほうだよ。',
    },
    {
      id: 'mode-max',
      explain: 'いちばん 大きい 値を 選んだのかな。最頻値は、いちばん 多く 出て くる 値だよ。',
    },
    {
      id: 'mean-kinds',
      explain:
        '合計を わり忘れたか、わる 数を まちがえたのかな。平均値は、合計 ÷ データの 個数（人数）。値の 種類の 数では わらないよ。',
    },
    {
      id: 'mean-median',
      explain:
        '平均値と 中央値を 取りちがえたのかな。平均値は 合計 ÷ 個数、中央値は 小さい 順に 並べた 真ん中の 値だよ。',
    },
    {
      id: 'dot-read',
      explain: '横の じくの 値を 答えたのかな。人数は、その 値の 上に 積まれた ○の 数だよ。',
    },
    {
      id: 'choose-purpose',
      explain:
        '何を 知りたいのかを もう一度 考えよう。平均値は 合計を ならした 値、中央値は 真ん中の 順位の 値、最頻値は いちばん 多く 出て くる 値だよ。',
    },
  ],
  levels: [
    { label: 'ドットプロット・平均値', chance: 0.05 },
    { label: '中央値・最頻値', chance: 0.05 },
    { label: '3つの 代表値', chance: 0.05 },
    { label: 'くらべる', chance: 0.1 },
  ],
  intro: [
    {
      text: 'データを 数直線の 上に ○で 積んで 表した 図を ドットプロットと いいます。どこに データが 集まって いるか 分かります。',
      figure: dotSvg([4, 5, 6, 7, 8], [1, 2, 4, 2, 1]),
    },
    {
      text: 'データの 特ちょうを 1つの 数で 表した 値を 代表値と いいます。平均値・中央値・最頻値が あります。',
    },
    {
      text: '平均値 ＝ 合計 ÷ 個数。中央値 ＝ 小さい 順に 並べた 真ん中の 値（偶数《ぐうすう》個なら 真ん中 2つの 平均）。最頻値 ＝ いちばん 多く 出て くる 値。',
      figure: {
        kind: 'text',
        text: '3、 5、 5、 6、 9 → 平均値 5.6、 中央値 5、 最頻値 5',
        size: 'm',
      },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateRepresentative(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第6学年 D(1) 代表値（平均値・中央値・最頻値）、ドットプロット',
  revised: REVISED,
});
