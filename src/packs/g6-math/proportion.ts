/**
 * g6.math.proportion 比例（性質・式・グラフ・比例を使った問題解決）（curriculum-matrix 3.9）。
 * 表 → 式 y ＝ 決まった数 × x → グラフ → 活用。
 *
 * 同一性キー: 場面 × 決まった数 × 問う所。グラフは graph エンジン（折れ線）で 0 から始まる直線として描く。
 * 注意: graph には「x の値を横軸に等間隔でとる直線のグラフ（関数のグラフ）」が無いので、折れ線グラフで代用する（要望）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, GraphItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { expr, finishUnit, opts, pick, pickObj, REVISED, wrongList } from './util';

type Obj = 'table' | 'formula' | 'graph' | 'use';

/** x・y の場面（決まった数 k の候補） */
interface Ctx {
  id: string;
  x: string;
  xu: string;
  y: string;
  yu: string;
  ks: number[];
  text: (k: number) => string;
}
const CTXS: Ctx[] = [
  { id: 'ribbon', x: '長さ', xu: 'm', y: '代金', yu: '円', ks: [60, 80, 90, 120, 150], text: (k) => `1mの ねだんが ${k}円の リボンを 買います。` },
  { id: 'tank', x: '時間', xu: '分', y: '水の 量', yu: 'L', ks: [2, 3, 4, 5, 6], text: (k) => `水そうに 1分間に ${k}Lずつ 水を 入れます。` },
  { id: 'ball', x: 'こ数', xu: 'こ', y: '重さ', yu: 'g', ks: [20, 25, 30, 40, 50], text: (k) => `1こ ${k}gの ボールを 箱に 入れます。` },
  { id: 'walk', x: '時間', xu: '分', y: '道のり', yu: 'm', ks: [50, 60, 70, 80], text: (k) => `分速 ${k}mで 歩きます。` },
  { id: 'square', x: '1辺の 長さ', xu: 'cm', y: 'まわりの 長さ', yu: 'cm', ks: [4], text: () => '正方形の 1辺の 長さと まわりの 長さを 調べます。' },
  { id: 'wire', x: '長さ', xu: 'm', y: '重さ', yu: 'g', ks: [6, 8, 12, 15, 18], text: (k) => `1mの 重さが ${k}gの 針金が あります。` },
];
const head = (c: Ctx) => [`x ${c.x}（${c.xu}）`, `y ${c.y}（${c.yu}）`] as const;

function tableFig(c: Ctx, xs: number[], ys: (number | string)[]): Figure {
  const [hx, hy] = head(c);
  return { kind: 'table', header: [hx, ...xs.map(String)], rows: [[hy, ...ys.map(String)]] };
}

// ---- 表 ----
function tableItem(level: number, rng: Rng, alt: boolean): Item {
  const c = pick(rng, CTXS);
  const k = pick(rng, c.ks);
  if (alt) {
    const m = rng.int(2, 5);
    const it: ChoiceItem = {
      engine: 'choice',
      id: `table-alt:${c.id}:${k}:${m}`,
      objective: 'table',
      level,
      prompt: `${c.text(k)}${c.x}を x${c.xu}、${c.y}を y${c.yu}と します。x の 値が ${m}倍に なると、y の 値は どう なりますか。`,
      figure: tableFig(c, [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6].map((x) => x * k)),
      hints: ['表で、x が 1から 2、3に なる ときの y の 変わり方を 見よう。', `x が 1の とき y は ${k}、x が ${m}の とき y は ${k * m}。`, `${k * m}は ${k}の 何倍かな。`],
      explain: `y は x に 比例して いるので、x が ${m}倍に なると、y も ${m}倍に なります。`,
      identity: `table:times:${c.id}:${k}:${m}`,
      alt: true,
      options: opts(`${m}倍に なる`, [
        [`${m} 増える`, 'add-pattern'],
        [`[[1/${m}]]に なる`, 'inverse-confuse'],
        [`${m * k} 増える`, 'add-pattern'],
      ]),
    };
    return it;
  }
  const shown = pick(rng, [
    [1, 2],
    [2, 3],
    [2, 4],
    [3, 5],
  ]);
  const asks = [4, 5, 6, 8, 9, 10, 12].filter((x) => !shown.includes(x));
  const ax = pick(rng, asks);
  const xs = [...shown, ax];
  const ys: (number | string)[] = [...shown.map((x) => x * k), '？'];
  const ans = ax * k;
  const answer = { kind: 'int' as const, value: ans };
  const last = shown[shown.length - 1]!;
  return {
    engine: 'number',
    id: `table:${c.id}:${k}:${shown.join(',')}:${ax}`,
    objective: 'table',
    level,
    prompt: `${c.text(k)}y は x に 比例します。表の ？に あてはまる 数を 求めよう。`,
    figure: tableFig(c, xs, ys),
    hints: [
      '比例では、x が 2倍、3倍…に なると、y も 2倍、3倍…に なるよ。',
      `x が ${last}から ${ax}に なると、何倍かな。または y ÷ x の 決まった 数を 使おう。`,
      `y ÷ x ＝ ${last * k} ÷ ${last} ＝ ${k}。${ax} × ${k}を 計算しよう。`,
    ],
    explain: `y ÷ x は いつも ${k}なので、x が ${ax}の とき y ＝ ${k} × ${ax} ＝ ${ans}です。`,
    identity: `table:${c.id}:${k}:${shown.join(',')}:${ax}`,
    alt: false,
    fields: [{ label: c.yu, answer }],
    wrongAnswers: wrongList(
      [answer],
      [
        [last * k + (ax - last), 'add-pattern'],
        [(last * k * last) % ax === 0 ? (last * k * last) / ax : null, 'inverse-confuse'],
      ],
    ),
  };
}

// ---- 式 ----
function formulaItem(level: number, rng: Rng, alt: boolean): Item {
  const c = pick(rng, CTXS.filter((x) => x.ks.length > 1));
  const k = pick(rng, c.ks);
  if (alt) {
    const xs = pick(rng, [
      [2, 4, 6],
      [3, 6, 9],
      [2, 5, 8],
      [4, 6, 10],
    ]);
    const answer = { kind: 'int' as const, value: k };
    const it: NumberItem = {
      engine: 'number',
      id: `formula-alt:${c.id}:${k}:${xs.join(',')}`,
      objective: 'formula',
      level,
      prompt: `表の y は x に 比例して います。y ＝ 決まった数 × x の 式に 表す とき、決まった数は いくつですか。`,
      figure: tableFig(c, xs, xs.map((x) => x * k)),
      hints: ['決まった数は、y ÷ x で 求められるよ。', `x が ${xs[0]}の とき y は ${xs[0]! * k}。`, `${xs[0]! * k} ÷ ${xs[0]}を 計算しよう。ほかの 組でも たしかめよう。`],
      explain: `y ÷ x ＝ ${xs[0]! * k} ÷ ${xs[0]} ＝ ${k}。式は y ＝ ${k} × x です。`,
      identity: `formula:k:${c.id}:${k}:${xs.join(',')}`,
      alt: true,
      fields: [{ answer }],
      keys: ['fraction'],
      wrongAnswers: wrongList(
        [answer],
        [
          [`${xs[0]}/${xs[0]! * k}`, 'const-reverse'],
          [xs[1]! * k - xs[0]! * k, 'add-pattern'],
        ],
      ),
    };
    return it;
  }
  const it: ChoiceItem = {
    engine: 'choice',
    id: `formula:${c.id}:${k}`,
    objective: 'formula',
    level,
    prompt: `${c.text(k)}${c.x}を x${c.xu}、${c.y}を y${c.yu}と して、x と yの 関係を 式に 表すと どれですか。`,
    figure: tableFig(c, [1, 2, 3, 4], [1, 2, 3, 4].map((x) => x * k)),
    hints: ['比例の 式は、y ＝ 決まった数 × x の 形だよ。', '決まった数は y ÷ x で 求められるね。', `${k * 2} ÷ 2 ＝ ${k}。`],
    explain: `y ÷ x は いつも ${k}なので、y ＝ ${k} × x です。`,
    identity: `formula:${c.id}:${k}`,
    alt: false,
    options: opts(`y ＝ ${k} × x`, [
      [`y ＝ x ÷ ${k}`, 'const-reverse'],
      [`y ＝ x ＋ ${k}`, 'add-pattern'],
      [`y ＝ ${k} ÷ x`, 'inverse-confuse'],
    ]),
  };
  return it;
}

// ---- グラフ ----
/** 縦の じくの 1めもり（k の 約数で、めもりが 20 以下に なる いちばん 小さい もの） */
const STEP_OF = (k: number) =>
  [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150].find((s) => k % s === 0 && (6 * k) / s <= 20) ?? k;
function graphItem(level: number, rng: Rng, alt: boolean): Item {
  const c = pick(rng, CTXS.filter((x) => x.id !== 'square'));
  const k = pick(rng, c.ks);
  if (alt) {
    // 比例の グラフを 選ぶ
    const d = rng.int(1, 3);
    const lab = ['0', '1', '2', '3', '4', '5'];
    const lineFig = (vals: number[]): Figure => ({ kind: 'line', labels: lab, values: vals, scaleStep: 2 });
    const kk = pick(rng, [1, 2, 3]);
    const it: ChoiceItem = {
      engine: 'choice',
      id: `graph-alt:${kk}:${d}`,
      objective: 'graph',
      level,
      prompt: 'y が x に 比例する ことを 表す グラフは どれですか。横の じくが x、縦《たて》の じくが y です。',
      hints: ['比例の グラフは、どんな 形の 線に なるかな。', '比例では x が 0の とき、y も 0。', '0の 点を 通る まっすぐな 線を さがそう。'],
      explain: '比例する 2つの 量の グラフは、0の 点（横の じくと 縦《たて》の じくが 交わる 点）を 通る 直線に なります。',
      identity: `graph:pick:${kk}:${d}`,
      alt: true,
      layout: 'grid',
      options: [
        { figure: lineFig(lab.map((_, i) => i * kk)), correct: true },
        { figure: lineFig(lab.map((_, i) => i * kk + d)), misconception: 'through-origin' },
        { figure: lineFig(lab.map((_, i) => 10 - i * 2)), misconception: 'inverse-confuse' },
        { figure: lineFig([0, 0.5, 1.5, 3, 5, 7.5].map((v) => v + (d - 1) * 0.5 * (v > 0 ? 1 : 0))), misconception: 'not-straight' },
      ],
    };
    return it;
  }
  const step = STEP_OF(k);
  const ax = rng.int(1, 6);
  const ans = ax * k;
  const answer = { kind: 'int' as const, value: ans };
  const it: GraphItem = {
    engine: 'graph',
    id: `graph:${c.id}:${k}:${ax}`,
    objective: 'graph',
    level,
    prompt: `${c.text(k)}グラフは、${c.x} x${c.xu}と ${c.y} y${c.yu}の 関係を 表して います。x が ${ax}の とき、y は いくつですか。`,
    hints: [
      `縦《たて》の じくの 1めもりが いくつか 調べよう。1めもりは ${step}${c.yu}。`,
      `横の じくの ${ax}の ところから 上に 進んで、グラフと 交わる 点を 見つけよう。`,
      `その 点から 左に 進んで、縦《たて》の じくの めもりを 読もう。`,
    ],
    explain: `x が ${ax}の とき、y は ${ans}です。式 y ＝ ${k} × x でも たしかめられます（${k} × ${ax} ＝ ${ans}）。`,
    identity: `graph:${c.id}:${k}:${ax}`,
    alt: false,
    data: {
      kind: 'line',
      labels: ['0', '1', '2', '3', '4', '5', '6'],
      values: [0, 1, 2, 3, 4, 5, 6].map((x) => x * k),
      scaleStep: step,
      labelEvery: (6 * k) / step > 10 ? 2 : 1,
      unit: c.yu,
      title: `${c.x}と ${c.y}`,
    },
    task: {
      kind: 'number',
      fields: [{ label: c.yu, answer }],
      wrongAnswers: wrongList(
        [answer],
        [
          [step !== 1 ? ans / step : null, 'scale-read'],
          [ax, 'scale-read'],
        ],
      ),
    },
  };
  return it;
}

// ---- 比例を 使って（場面 8） ----
interface UseScene {
  id: string;
  /** n 単位で w、N 単位では？ */
  make: (rng: Rng) => [number, number, number];
  unitW: string;
  unitN: string;
  /** 表の見出し（x・y の量の名前） */
  xn: string;
  yn: string;
  text: (n: number, w: number, N: number) => string;
  rev: (n: number, w: number, W: number) => string;
}
const USES: UseScene[] = [
  {
    id: 'nail',
    xn: '本数《ほんすう》',
    yn: '重さ',
    make: (rng) => [10, pick(rng, [15, 20, 25, 30, 35]), pick(rng, [100, 150, 200, 300, 500])],
    unitW: 'g',
    unitN: '本',
    text: (n, w, N) => `くぎ ${n}本の 重さは ${w}gでした。同じ くぎ ${N}本の 重さは 何gですか。`,
    rev: (n, w, W) => `くぎ ${n}本の 重さは ${w}gでした。同じ くぎを 全部 はかると ${W}gでした。くぎは 全部で 何本ですか。`,
  },
  {
    id: 'paper',
    xn: '枚数《まいすう》',
    yn: '重さ',
    make: (rng) => [10, pick(rng, [40, 50, 60, 80]), pick(rng, [50, 100, 150, 200, 300])],
    unitW: 'g',
    unitN: '枚',
    text: (n, w, N) => `画用紙 ${n}枚の 重さは ${w}gです。同じ 画用紙 ${N}枚の 重さは 何gですか。`,
    rev: (n, w, W) => `画用紙 ${n}枚の 重さは ${w}gです。同じ 画用紙の たばの 重さは ${W}gでした。画用紙は 何枚ですか。`,
  },
  {
    id: 'tank',
    xn: '時間',
    yn: '水の 量',
    make: (rng) => [pick(rng, [2, 3, 4, 5]), 0, 0],
    unitW: 'L',
    unitN: '分',
    text: (n, w, N) => `水そうに 水を 入れると、${n}分間で ${w}L 入りました。同じ ように 入れると、${N}分間では 何L 入りますか。`,
    rev: (n, w, W) => `水そうに 水を 入れると、${n}分間で ${w}L 入りました。同じ ように 入れて ${W}L に するには 何分 かかりますか。`,
  },
  {
    id: 'walk',
    xn: '時間',
    yn: '道のり',
    make: (rng) => [pick(rng, [3, 4, 5]), 0, 0],
    unitW: 'm',
    unitN: '分',
    text: (n, w, N) => `同じ 速さで 歩くと、${n}分間で ${w}m 進みました。${N}分間では 何m 進みますか。`,
    rev: (n, w, W) => `同じ 速さで 歩くと、${n}分間で ${w}m 進みました。${W}m 進むには 何分 かかりますか。`,
  },
  {
    id: 'wire',
    xn: '長さ',
    yn: '重さ',
    make: (rng) => [pick(rng, [2, 3, 4]), 0, 0],
    unitW: 'g',
    unitN: 'm',
    text: (n, w, N) => `針金 ${n}mの 重さは ${w}gです。同じ 針金 ${N}mの 重さは 何gですか。`,
    rev: (n, w, W) => `針金 ${n}mの 重さは ${w}gです。同じ 針金の 重さが ${W}gの とき、長さは 何mですか。`,
  },
  {
    id: 'print',
    xn: '時間',
    yn: '枚数《まいすう》',
    make: (rng) => [pick(rng, [2, 3, 4]), 0, 0],
    unitW: '枚',
    unitN: '分',
    text: (n, w, N) => `印刷機《いんさつき》で ${n}分間に ${w}枚 印刷《いんさつ》できます。${N}分間では 何枚 印刷《いんさつ》できますか。`,
    rev: (n, w, W) => `印刷機《いんさつき》で ${n}分間に ${w}枚 印刷《いんさつ》できます。${W}枚 印刷《いんさつ》するには 何分 かかりますか。`,
  },
  {
    id: 'stack',
    xn: '枚数《まいすう》',
    yn: '厚《あつ》さ',
    make: (rng) => [10, pick(rng, [2, 3, 4, 5]), pick(rng, [50, 100, 150, 200])],
    unitW: 'mm',
    unitN: '枚',
    text: (n, w, N) => `同じ 紙を ${n}枚 重ねると、厚《あつ》さが ${w}mmでした。${N}枚 重ねると 何mmですか。`,
    rev: (n, w, W) => `同じ 紙を ${n}枚 重ねると、厚《あつ》さが ${w}mmでした。厚《あつ》さが ${W}mmの とき、紙は 何枚ですか。`,
  },
  {
    id: 'rice',
    xn: 'お米の 量',
    yn: '重さ',
    make: (rng) => [pick(rng, [2, 3]), 0, 0],
    unitW: 'g',
    unitN: '合',
    text: (n, w, N) => `お米 ${n}合《ごう》の 重さは ${w}gです。お米 ${N}合《ごう》の 重さは 何gですか。`,
    rev: (n, w, W) => `お米 ${n}合《ごう》の 重さは ${w}gです。${W}gの お米は 何合《ごう》ですか。`,
  },
];
const UNIT_RATE: Record<string, number[]> = {
  tank: [6, 8, 10, 12],
  walk: [60, 70, 80],
  wire: [15, 20, 25],
  print: [30, 40, 50],
  rice: [150],
};

function applyItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, USES);
  const made = sc.make(rng);
  const n = made[0];
  let w = made[1];
  let N = made[2];
  if (UNIT_RATE[sc.id]) {
    const r = pick(rng, UNIT_RATE[sc.id]!);
    w = n * r;
    N = n * rng.int(2, 6) + (rng.next() < 0.5 ? 0 : n);
  }
  const W = (w * N) / n;
  const ans = alt ? N : W;
  const answer = { kind: 'int' as const, value: ans };
  const unit = alt ? sc.unitN : sc.unitW;
  const prompt = alt ? sc.rev(n, w, W) : sc.text(n, w, N);
  return {
    engine: 'number',
    id: `use${alt ? '-alt' : ''}:${sc.id}:${n}:${w}:${alt ? W : N}`,
    objective: 'use',
    level,
    prompt,
    figure: {
      kind: 'table',
      header: [`${sc.xn}（${sc.unitN}）`, String(n), alt ? '？' : String(N)],
      rows: [[`${sc.yn}（${sc.unitW}）`, String(w), alt ? String(W) : '？']],
    },
    hints: alt
      ? [
          `${sc.yn}が 何倍に なったかを 考えよう。`,
          `${W} ÷ ${w} ＝ ${W / w}倍。`,
          `${n}を ${W / w}倍 しよう。`,
        ]
      : [
          `${sc.xn}が 何倍に なったかを 考えよう。`,
          `${N} ÷ ${n} ＝ ${N / n}倍。`,
          `${w}を ${N / n}倍 しよう。`,
        ],
    explain: alt
      ? `${W} ÷ ${w} ＝ ${W / w}（倍）。${n} × ${W / w} ＝ ${N}（${sc.unitN}）。${sc.yn}は ${sc.xn}に 比例します。`
      : `${N} ÷ ${n} ＝ ${N / n}（倍）。${w} × ${N / n} ＝ ${W}（${sc.unitW}）。${sc.yn}は ${sc.xn}に 比例します。`,
    identity: `use:${sc.id}:${n}:${w}:${N}${alt ? ':rev' : ''}`,
    alt,
    fields: [{ label: unit, answer }],
    wrongAnswers: wrongList(
      [answer],
      alt
        ? [
            [W / w, 'const-reverse'],
            [W - w + n, 'add-pattern'],
          ]
        : [
            [w + (N - n), 'add-pattern'],
            [N / n, 'const-reverse'],
          ],
    ),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['table', 'formula'] },
  { objs: ['graph', 'formula', 'table'] },
  { objs: ['use', 'graph'] },
  { objs: ['use', 'graph', 'formula', 'table'] },
];

export function generateProportion(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'table':
      return tableItem(level, rng, alt);
    case 'formula':
      return formulaItem(level, rng, alt);
    case 'graph':
      return graphItem(level, rng, alt);
    case 'use':
      return applyItem(level, rng, alt);
  }
}

export const proportion: UnitSpec = finishUnit({
  id: 'g6.math.proportion',
  title: '比例',
  stage: 'g6',
  subject: 'math',
  domain: 'C-measure',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'picture',
  prereq: ['g5.math.proportion-simple'],
  objectives: [
    { id: 'table', title: '表で 比例の 性質を 使う' },
    { id: 'formula', title: '比例の 式 y ＝ 決まった数 × x' },
    { id: 'graph', title: '比例の グラフ' },
    { id: 'use', title: '比例を 使った 問題' },
  ],
  misconceptions: [
    {
      id: 'add-pattern',
      explain:
        '「x が 増えた 分だけ y も 増える」と 考えたのかな。比例では、x が 2倍、3倍に なると y も 2倍、3倍に なるよ。たし算では なく かけ算で 考えよう。',
    },
    { id: 'const-reverse', explain: 'わる 順番が 反対かな。決まった数は y ÷ x。何倍に なったかを 求める ときは、大きい 方 ÷ もとの 方 だよ。' },
    { id: 'inverse-confuse', explain: '反比例と 取りちがえたのかな。比例では、x が 増えると y も 同じ 倍だけ 増えるよ。' },
    { id: 'through-origin', explain: 'まっすぐな 線でも、0の 点を 通らないと 比例の グラフでは ないよ。x が 0の とき y も 0に なるか 見よう。' },
    { id: 'not-straight', explain: '曲がった 線を 選んだのかな。比例の グラフは まっすぐな 線（直線）に なるよ。' },
    { id: 'scale-read', explain: 'めもりの 数を そのまま 答えたのかな。縦《たて》の じくの 1めもりが いくつかを 先に 調べよう。' },
  ],
  levels: [
    { label: '表・式', chance: 0.05 },
    { label: 'グラフ', chance: 0.05 },
    { label: '比例を 使う', chance: 0.05 },
    { label: 'まとめ', chance: 0.05 },
  ],
  intro: [
    {
      text: '水そうに 1分間に 3Lずつ 水を 入れます。時間 x分が 2倍、3倍…に なると、水の 量 yLも 2倍、3倍…に なります。このとき、y は x に 比例すると いいます。',
      figure: tableFig(CTXS[1]!, [1, 2, 3, 4, 5], [3, 6, 9, 12, 15]),
    },
    { text: 'y ÷ x は いつも 3（決まった数）。だから 式は y ＝ 3 × x と 表せます。', figure: expr('y ＝ 3 × x') },
    {
      text: '比例する 2つの 量の グラフは、0の 点を 通る まっすぐな 線（直線）に なります。',
      figure: { kind: 'line', labels: ['0', '1', '2', '3', '4', '5'], values: [0, 3, 6, 9, 12, 15], scaleStep: 3, unit: 'L' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateProportion(level, rng, index),
  },
  review: 'objective',
  basis: '小学校学習指導要領（平成29年告示）算数 第6学年 C(1) 比例（表・式・グラフ、比例の関係を用いた問題解決）',
  revised: REVISED,
});
