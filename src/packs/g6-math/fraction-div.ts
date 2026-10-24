/**
 * g6.math.fraction-div 分数のわり算（分数÷整数・分数÷分数・逆数、小数・分数のまじった乗除）（curriculum-matrix 3.9）。
 *
 * 答えは約分した形が目標（mustReduce）。仮分数・帯分数はどちらでも正。小数と分数のまじった計算は、
 * 答えが小数で表せるときは小数でも正（allowDecimal: 2.4「等価なら正」）。
 * 同一性キー: 式（わり算は順序が意味をもつので入れかえは別の問題）。別例は ':alt'。文章題は 場面 × 式。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { Item, NumberItem, UnitSpec } from '../../curriculum/types';
import {
  dec,
  expr,
  finishUnit,
  fr,
  fracAns,
  fx,
  gcd,
  rawTo,
  pick,
  pickObj,
  q,
  qBoth,
  qdiv,
  qmul,
  qText,
  REVISED,
  wrongList,
  type Q,
} from './util';

type Obj = 'fdi' | 'recip' | 'fdf' | 'mixdec' | 'story';

function proper(minD: number, maxD: number): [number, number][] {
  const out: [number, number][] = [];
  for (let d = minD; d <= maxD; d++)
    for (let n = 1; n < d; n++) if (gcd(n, d) === 1) out.push([n, d]);
  return out;
}
const P9 = proper(2, 9);
const P6 = proper(2, 6);

/** 分数÷整数: [a, b, n] */
const FDI: [number, number, number][] = [];
for (const [a, b] of P9) for (let n = 2; n <= 9; n++) FDI.push([a, b, n]);
/** 分数÷分数: [a, b, c, d]（同じ分数どうしは除く） */
const FDF: [number, number, number, number][] = [];
for (const [a, b] of proper(2, 12))
  for (const [c, d] of P9) if (a !== c || b !== d) FDF.push([a, b, c, d]);

/** 逆数の問題: 分数（真分数・仮分数）・整数・小数 */
type RecipQ = { shown: string; val: Q; kind: 'frac' | 'int' | 'dec' | 'mixed' };
const RECIP: RecipQ[] = [];
for (const [a, b] of proper(2, 12)) {
  RECIP.push({ shown: fr(a, b), val: q(a, b), kind: 'frac' });
  if (a > 1) RECIP.push({ shown: fr(b, a), val: q(b, a), kind: 'frac' });
}
for (let n = 2; n <= 12; n++) RECIP.push({ shown: String(n), val: q(n), kind: 'int' });
const RECIP_ALT: RecipQ[] = [];
for (const t of [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 15, 25])
  RECIP_ALT.push({ shown: dec(t, 1), val: q(t, 10), kind: 'dec' });
for (let w = 1; w <= 3; w++)
  for (const [c, d] of P6)
    RECIP_ALT.push({ shown: `[[${w} ${c}/${d}]]`, val: q(w * d + c, d), kind: 'mixed' });

/** 小数・整数・分数のまじった式 */
interface MixQ {
  shown: string;
  val: Q;
  key: string;
  /** 逆数にしなかった値 */
  noRecip: Q;
  steps: string;
  /** 小数を分数に直す一言 */
  conv?: string;
}
/** 小数 t/10（0.1〜1.5）を分数に */
const decQ = (t: number) => q(t, 10);
const decFr = (t: number) => {
  const v = decQ(t);
  return v.d === 1 ? String(v.n) : fr(v.n, v.d);
};
const MIX: MixQ[] = [];
const DECS = [2, 3, 4, 5, 6, 8, 12, 15];
// 小数 ÷ 分数・分数 ÷ 小数
for (const t of DECS)
  for (const [c, d] of P6) {
    const x = decQ(t);
    const f = q(c, d);
    MIX.push({
      shown: `${dec(t, 1)} ÷ ${fr(c, d)}`,
      val: qdiv(x, f),
      key: `${dec(t, 1)}/${c}/${d}`,
      noRecip: qmul(x, f),
      conv: `${dec(t, 1)} ＝ ${decFr(t)}`,
      steps: `${decFr(t)} × ${fr(d, c)}`,
    });
    MIX.push({
      shown: `${fr(c, d)} ÷ ${dec(t, 1)}`,
      val: qdiv(f, x),
      key: `${c}/${d}/${dec(t, 1)}`,
      noRecip: qmul(f, x),
      conv: `${dec(t, 1)} ＝ ${decFr(t)}`,
      steps: `${fr(c, d)} × ${qText(qdiv(q(1), x))}`,
    });
  }
const MIX3: MixQ[] = [];
// 分数 × 分数 ÷ 分数・整数 × 分数 ÷ 小数
for (const [a, b] of P6)
  for (const [c, d] of P6)
    for (const [e, f] of [
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
    ] as const) {
      if ((a === c && b === d) || (c === e && d === f)) continue;
      const v = qdiv(qmul(q(a, b), q(c, d)), q(e, f));
      MIX3.push({
        shown: `${fr(a, b)} × ${fr(c, d)} ÷ ${fr(e, f)}`,
        val: v,
        key: `${a}/${b}*${c}/${d}:${e}/${f}`,
        noRecip: qmul(qmul(q(a, b), q(c, d)), q(e, f)),
        steps: `${fr(a, b)} × ${fr(c, d)} × ${fr(f, e)}`,
      });
    }

function numItem(
  obj: Obj,
  level: number,
  alt: boolean,
  shown: string,
  ans: Q,
  identity: string,
  hints: [string, string, string],
  explain: string,
  cands: [string | null, string][],
  opt: { prompt?: string; figure?: Figure; allowDecimal?: boolean } = {},
): NumberItem {
  const answer = fracAns(ans, { allowDecimal: opt.allowDecimal });
  return {
    engine: 'number',
    id: `${obj}${alt ? '-alt' : ''}:${shown}`,
    objective: obj,
    level,
    prompt: opt.prompt ?? '計算しよう。答えは できるだけ 約分しよう。',
    figure: opt.figure ?? expr(`${shown} ＝ {{}}`),
    hints,
    explain,
    identity: `${identity}${alt ? ':alt' : ''}`,
    alt,
    fields: [{ answer }],
    keys: ['fraction'],
    wrongAnswers: wrongList([answer], cands),
  };
}

const inQ = (x: Q) => `${x.n}/${x.d}`;

function fdi(level: number, rng: Rng, alt: boolean): NumberItem {
  const [a, b, n] = pick(rng, FDI);
  const ans = q(a, b * n);
  const shown = `${fr(a, b)} ÷ ${n}`;
  const exact = a % n === 0;
  return numItem(
    'fdi',
    level,
    alt,
    shown,
    ans,
    `${a}/${b}:${n}`,
    [
      alt
        ? `${fr(a, b)}Lを ${n}つに 等しく 分けると、1つ分は 小さく なるね。`
        : '分数を 整数で わる ときは、分子は そのままで 分母に 整数を かけるよ。',
      `${shown}は、${fx([a], [b, n])}${exact ? `（分子が ${n}で わり切れるので、分子を わって [[${a / n}/${b}]]と 考えても よい）` : ''}。`,
      `分母は ${b} × ${n} ＝ ${b * n}。約分できるか 調べよう。`,
    ],
    `${shown} ＝ ${rawTo(a, b * n)}。分母に 整数を かけます（${n}の 逆数 [[1/${n}]]を かけるのと 同じ）。`,
    [
      [`${a * n}/${b}`, 'mult-instead'],
      [`${a}/${b}`, 'div-both'],
      [`${n * b}/${a}`, 'flip-first'],
    ],
    alt
      ? {
          prompt: `${fr(a, b)}Lの ジュースを ${n}人で 等しく 分けます。1人分は 何Lですか。答えは できるだけ 約分しよう。`,
          figure: {
            kind: 'tape',
            parts: Array.from({ length: n }, (_, i) => ({
              length: 1,
              label: i === 0 ? '？' : '',
              tone: i === 0 ? 'focus' : 'muted',
            })),
            total: `${fr(a, b)}L`,
          },
        }
      : {},
  );
}

function recip(level: number, rng: Rng, alt: boolean): NumberItem {
  const r = pick(rng, alt ? RECIP_ALT : RECIP);
  const ans = qdiv(q(1), r.val);
  const shownVal = qText(r.val);
  const hint2 =
    r.kind === 'int'
      ? `${r.shown} ＝ [[${r.shown}/1]]と 考えよう。`
      : r.kind === 'dec'
        ? `${r.shown} ＝ ${shownVal}と 分数に なおそう。`
        : r.kind === 'mixed'
          ? `${r.shown} ＝ ${fr(r.val.n, r.val.d)}と 仮分数に なおそう。`
          : `${r.shown}の 分子と 分母を 入れかえよう。`;
  return {
    engine: 'number',
    id: `recip${alt ? '-alt' : ''}:${r.shown}`,
    objective: 'recip',
    level,
    prompt: `${r.shown}の 逆数を 書こう。`,
    figure: expr(`${r.shown} × {{}} ＝ 1`),
    hints: [
      'かけて 1に なる 数が 逆数だよ。',
      hint2,
      r.kind === 'frac'
        ? `分母と 分子を 入れかえると、分母は ${r.val.n}。`
        : `${fr(r.val.n, r.val.d)}の 分子と 分母を 入れかえよう。`,
    ],
    explain: `${r.shown}${r.kind === 'frac' ? '' : `（${fr(r.val.n, r.val.d)}）`} × ${qText(ans)} ＝ 1 なので、逆数は ${qBoth(ans)}です。分子と 分母を 入れかえた 分数が 逆数です。`,
    identity: `recip:${r.shown}`,
    alt,
    fields: [{ answer: fracAns(ans) }],
    keys: ['fraction'],
    wrongAnswers: wrongList(
      [fracAns(ans)],
      [
        [inQ(r.val), 'recip-same'],
        r.kind === 'mixed'
          ? [`${r.val.n % r.val.d === 0 ? 1 : r.val.d}/${r.val.n % r.val.d}`, 'whole-drop']
          : null,
      ].filter((x): x is [string, string] => x !== null),
    ),
  };
}

function fdf(level: number, rng: Rng, alt: boolean): NumberItem {
  const [a, b, c, d] = pick(rng, FDF);
  const ans = qdiv(q(a, b), q(c, d));
  const shown = `${fr(a, b)} ÷ ${fr(c, d)}`;
  const cands: [string | null, string][] = [
    [`${a * c}/${b * d}`, 'no-recip'],
    [`${b * c}/${a * d}`, 'flip-first'],
  ];
  const g1 = gcd(a, c);
  if (g1 > 1) cands.push([`${(a / g1) * d}/${b * c}`, 'cancel-one']);
  else if (gcd(b, d) > 1) cands.push([`${a * d}/${(b / gcd(b, d)) * c}`, 'cancel-one']);
  return numItem(
    'fdf',
    level,
    alt,
    shown,
    ans,
    `${a}/${b}:${c}/${d}`,
    [
      alt
        ? `□ × ${fr(c, d)} ＝ ${fr(a, b)}の □は、${fr(a, b)} ÷ ${fr(c, d)}で 求められるね。`
        : 'わる 数の 逆数を かけるよ。',
      `${fr(c, d)}の 逆数は ${fr(d, c)}。${fr(a, b)} × ${fr(d, c)}`,
      `${fx([a, d], [b, c])}。約分できるか 調べよう。`,
    ],
    `${shown} ＝ ${fr(a, b)} × ${fr(d, c)} ＝ ${qBoth(ans)}。わる 数を 逆数に して かけます。`,
    cands,
    alt
      ? {
          prompt: `□に あてはまる 数を 求めよう。答えは できるだけ 約分しよう。`,
          figure: expr(`{{}} × ${fr(c, d)} ＝ ${fr(a, b)}`),
        }
      : {},
  );
}

function mixdec(level: number, rng: Rng, alt: boolean): NumberItem {
  const m = pick(rng, alt ? MIX3 : MIX);
  return numItem(
    'mixdec',
    level,
    alt,
    m.shown,
    m.val,
    m.key,
    [
      alt
        ? 'かけ算と わり算の まじった 式は、わる 数を 逆数に して かけ算だけの 式に しよう。'
        : '小数は 分数に なおしてから 計算しよう。',
      m.conv ? `${m.conv} なので、${m.shown} ＝ ${m.steps}` : `${m.shown} ＝ ${m.steps}`,
      'まとめて 1つの 分数に して、約分できるか 調べよう。',
    ],
    `${m.conv ? `${m.conv} なので、` : ''}${m.shown} ＝ ${m.steps} ＝ ${qBoth(m.val)}。小数は 分数に なおし、わり算は 逆数の かけ算に して 計算します。`,
    [[inQ(m.noRecip), 'no-recip']],
    { allowDecimal: true },
  );
}

// ---- 文章題（場面 8。等分除・包含除・倍） ----
interface Scene {
  id: string;
  unit: string;
  /** 'part': x ÷ y（1あたり）。'count': x ÷ y が整数（いくつ分）。'times': 何倍 */
  type: 'part' | 'count' | 'times';
  intY?: boolean;
  text: (x: string, y: string) => string;
}
const SCENES: Scene[] = [
  {
    id: 'paint',
    unit: 'm²',
    type: 'part',
    text: (x, y) => `${y}dLで ${x}m² ぬれる ペンキが あります。1dLでは 何m² ぬれますか。`,
  },
  {
    id: 'bar',
    unit: 'kg',
    type: 'part',
    text: (x, y) => `${y}mの 重さが ${x}kgの 鉄の 棒が あります。この 棒 1mの 重さは 何kgですか。`,
  },
  {
    id: 'share',
    unit: 'L',
    type: 'part',
    intY: true,
    text: (x, y) => `${x}Lの ジュースを ${y}人で 等しく 分けます。1人分は 何Lですか。`,
  },
  {
    id: 'ribbon',
    unit: '本',
    type: 'count',
    text: (x, y) => `${x}mの リボンから ${y}mずつ 切り取ります。何本 取れますか。`,
  },
  {
    id: 'speed',
    unit: 'km',
    type: 'part',
    text: (x, y) =>
      `${x}kmの 道のりを ${y}時間で 歩きました。1時間あたり 何km 歩いたことに なりますか。`,
  },
  {
    id: 'field',
    unit: 'm',
    type: 'part',
    text: (x, y) =>
      `面積が ${x}m²で、横《よこ》の 長さが ${y}mの 長方形の 花だんが あります。縦《たて》の 長さは 何mですか。`,
  },
  {
    id: 'times',
    unit: '倍',
    type: 'times',
    text: (x, y) =>
      `赤い テープは ${x}m、青い テープは ${y}mです。赤い テープの 長さは 青い テープの 何倍ですか。`,
  },
  {
    id: 'bags',
    unit: 'ふくろ',
    type: 'count',
    text: (x, y) => `${x}kgの 小麦粉を、${y}kgずつ ふくろに 分けます。何ふくろ できますか。`,
  },
];

function story(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, SCENES);
  let X: Q;
  let Y: Q;
  if (sc.type === 'count') {
    const [c, d] = pick(rng, P6);
    const k = rng.int(2, 8);
    Y = q(c, d);
    X = qmul(Y, q(k));
  } else if (sc.intY) {
    X = q(...pick(rng, P9));
    Y = q(rng.int(2, 6));
  } else {
    X = q(...pick(rng, P9));
    Y = q(...pick(rng, P6));
    if (X.n === Y.n && X.d === Y.d) Y = q(Y.n === 1 && Y.d === 2 ? 2 : 1, 3);
  }
  const ans = qdiv(X, Y);
  const xs = qText(X);
  const ys = qText(Y);
  const shown = `${xs} ÷ ${ys}`;
  const answer = fracAns(ans);
  const fig: Figure | undefined = alt
    ? sc.type === 'times'
      ? {
          kind: 'table',
          header: ['', '青', '赤'],
          rows: [
            ['長《なが》さ（m）', ys, xs],
            ['倍', '1', '？'],
          ],
        }
      : sc.type === 'count'
        ? {
            kind: 'table',
            header: ['', '1つ分', '全部'],
            rows: [
              [`量《りょう》（${sc.id === 'ribbon' ? 'm' : 'kg'}）`, ys, xs],
              ['いくつ分', '1', '？'],
            ],
          }
        : {
            kind: 'table',
            header: ['', `${ys}`, '1'],
            rows: [[`量《りょう》（${sc.unit}）`, xs, '？']],
          }
    : undefined;
  return {
    engine: 'number',
    id: `story${alt ? '-alt' : ''}:${sc.id}:${shown}`,
    objective: 'story',
    level,
    prompt: `${sc.text(xs, ys)}${alt ? '表を 見て 式を 考えよう。' : ''}`,
    figure: fig,
    hints: [
      sc.type === 'part'
        ? '1あたりの 量を 求めるので、わり算だね。'
        : sc.type === 'count'
          ? '全部の 中に 1つ分が いくつ 入るかを 求めるので、わり算だね。'
          : '「何倍」は、くらべる 量 ÷ もとに する 量 だね。',
      `式は ${shown}。`,
      `${shown} ＝ ${xs} × ${qText(qdiv(q(1), Y))}。約分できるか 調べよう。`,
    ],
    explain: `式は ${shown} ＝ ${qBoth(ans)}。答えは ${qText(ans)}${sc.unit}です。`,
    identity: `story:${sc.id}:${shown}${alt ? ':alt' : ''}`,
    alt,
    fields: [{ label: sc.unit, answer }],
    keys: ['fraction'],
    wrongAnswers: wrongList(
      [answer],
      [
        [inQ(qdiv(Y, X)), 'op-reverse'],
        [inQ(qmul(X, Y)), 'no-recip'],
      ],
    ),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['fdi', 'recip'] },
  { objs: ['fdf', 'recip', 'fdi'] },
  { objs: ['mixdec', 'fdf'] },
  { objs: ['story', 'mixdec', 'fdf', 'fdi'] },
];

export function generateFractionDiv(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'fdi':
      return fdi(level, rng, alt);
    case 'recip':
      return recip(level, rng, alt);
    case 'fdf':
      return fdf(level, rng, alt);
    case 'mixdec':
      return mixdec(level, rng, alt);
    case 'story':
      return story(level, rng, alt);
  }
}

export const fractionDiv: UnitSpec = finishUnit({
  id: 'g6.math.fraction-div',
  title: '分数の わり算',
  stage: 'g6',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'math-split',
  prereq: ['g6.math.fraction-mult'],
  objectives: [
    { id: 'fdi', title: '分数 ÷ 整数' },
    { id: 'recip', title: '逆数' },
    { id: 'fdf', title: '分数 ÷ 分数（逆数を かける）' },
    { id: 'mixdec', title: '小数・分数の まじった かけ算・わり算' },
    { id: 'story', title: '文章題' },
  ],
  misconceptions: [
    {
      id: 'no-recip',
      explain:
        'わる 数を 逆数に しないで かけたのかな。分数で わる ときは、わる 数の 分子と 分母を 入れかえて（逆数に して）かけるよ。',
    },
    {
      id: 'flip-first',
      explain:
        'わられる 数の ほうを 逆数に したのかな。逆数に するのは「÷ の 後ろの 数」（わる 数）だけだよ。',
    },
    {
      id: 'mult-instead',
      explain:
        '分子に 整数を かけたのかな。それは かけ算だね。わると 1つ分は 小さく なるので、分母に 整数を かけよう。',
    },
    {
      id: 'div-both',
      explain:
        '分子と 分母の 両方を わったのかな。両方を 同じ 数で わると 大きさは 変わらないよ。分数 ÷ 整数は、分母に 整数を かけよう。',
    },
    {
      id: 'recip-same',
      explain:
        'もとの 数を そのまま 書いたのかな。逆数は 分子と 分母を 入れかえた 数だよ。かけて 1に なるか たしかめよう。',
    },
    {
      id: 'whole-drop',
      explain:
        '帯分数の 整数の 部分を 忘れたのかな。帯分数は 仮分数に なおしてから 分子と 分母を 入れかえよう。',
    },
    {
      id: 'cancel-one',
      explain:
        '約分で、分子と 分母の どちらか 片方だけを わったのかな。約分は 分子の 数と 分母の 数を 同じ 数で 両方 わるよ。',
    },
    {
      id: 'op-reverse',
      explain:
        'わる 数と わられる 数を 反対に したのかな。「1あたり」や「何倍」を 考えて、何を 何で わるか たしかめよう。',
    },
  ],
  levels: [
    { label: '分数÷整数・逆数', chance: 0.02 },
    { label: '分数÷分数', chance: 0.02 },
    { label: '小数・分数の まじった 計算', chance: 0.02 },
    { label: '文章題・まとめ', chance: 0.02 },
  ],
  intro: [
    {
      text: '[[4/5]]Lを 2人で 等しく 分けると、1人分は [[4/5]] ÷ 2。[[1/5]]が 4こを 2つに 分けて、[[1/5]]が 2こで [[2/5]]L。分母に 2を かけて [[4/10]] ＝ [[2/5]]と 計算しても 同じです。',
      figure: expr('[[4/5]] ÷ 2 ＝ [[4/10]] ＝ [[2/5]]'),
    },
    {
      text: 'かけて 1に なる 2つの 数の 一方を、他方の 逆数と いいます。[[3/4]]の 逆数は [[4/3]]、5の 逆数は [[1/5]]。',
      figure: expr('[[3/4]] × [[4/3]] ＝ 1'),
    },
    {
      text: '分数で わる ときは、わる 数の 逆数を かけます。[[2/3]] ÷ [[4/5]] ＝ [[2/3]] × [[5/4]] ＝ [[5/6]]。',
      figure: expr('[[2/3]] ÷ [[4/5]] ＝ [[2/3]] × [[5/4]] ＝ [[5/6]]'),
    },
    {
      text: '小数は 分数に なおすと、かけ算・わり算を まとめて 計算できます。0.6 ÷ [[3/4]] ＝ [[3/5]] × [[4/3]] ＝ [[4/5]]。',
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateFractionDiv(level, rng, index),
  },
  review: 'type',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第6学年 A(1) 分数の除法（逆数）、小数・分数の混じった乗除',
  revised: REVISED,
});
