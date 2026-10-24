/**
 * g4.math.change-relations 伴って変わる二つの数量（表・式・グラフ）（curriculum-matrix 3.7）。
 * 表に整理 → きまりを見つける → □と△の式 → 式を使って求める。
 *
 * 場面 8（和が一定・差が一定・何倍・1次式・減っていく）。数値の範囲（□の始まり・表の長さ）を変えて生成する。
 * 同一性キー: 問う形 × 場面 × 数値（× 問う所）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { GraphItem } from '../../engines/graph/graph';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { finishUnit, opts, pick, pickObj, REVISED, wrongList } from './util';

type Obj = 'table' | 'rule' | 'formula' | 'apply';

interface Scene {
  id: string;
  /** 場面の文（k: 場面の数値） */
  text: (k: number) => string;
  x: string; // □の名前（単位つき）
  y: string; // △の名前
  ux: string;
  uy: string;
  ks: number[];
  f: (x: number, k: number) => number;
  /** 式（□・△） */
  formula: (k: number) => string;
  /** よくある まちがいの 式 [式, 誤概念] */
  wrongF: (k: number) => [string, string][];
  /** きまりの 言葉 */
  rule: (k: number) => string;
  wrongRule: (k: number) => [string, string][];
  /** □の 定義域 */
  xmax: number;
}

const SCENES: Scene[] = [
  {
    id: 'price',
    text: (k) => `1さつ ${k}円の ノートを 買います。`,
    x: 'ノートの 数',
    y: '代金',
    ux: 'さつ',
    uy: '円',
    ks: [60, 80, 90, 120, 150],
    f: (x, k) => k * x,
    formula: (k) => `${k} × □ ＝ △`,
    wrongF: (k) => [
      [`${k} ＋ □ ＝ △`, 'add-vs-mult'],
      [`${k} × △ ＝ □`, 'swap-vars'],
      [`□ ÷ ${k} ＝ △`, 'add-vs-mult'],
    ],
    rule: (k) => `△は □の ${k}倍`,
    wrongRule: (k) => [
      [`△は □より ${k} 大きい`, 'add-vs-mult'],
      [`□と △を たすと ${k}`, 'sum-vs-diff'],
    ],
    xmax: 12,
  },
  {
    id: 'age',
    text: (k) => `兄は 弟より ${k}才 年上です。`,
    x: '弟の 年れい',
    y: '兄の 年れい',
    ux: '才',
    uy: '才',
    ks: [2, 3, 4, 5, 6],
    f: (x, k) => x + k,
    formula: (k) => `□ ＋ ${k} ＝ △`,
    wrongF: (k) => [
      [`□ × ${k} ＝ △`, 'add-vs-mult'],
      [`□ − ${k} ＝ △`, 'swap-vars'],
      [`□ ＋ △ ＝ ${k}`, 'sum-vs-diff'],
    ],
    rule: (k) => `△は いつも □より ${k} 大きい`,
    wrongRule: (k) => [
      [`△は □の ${k}倍`, 'add-vs-mult'],
      [`□と △を たすと いつも ${k}`, 'sum-vs-diff'],
    ],
    xmax: 12,
  },
  {
    id: 'rope',
    text: (k) => `まわりの 長さが ${2 * k}cmの 長方形を つくります。`,
    x: 'たての 長さ',
    y: '横の 長さ',
    ux: 'cm',
    uy: 'cm',
    ks: [10, 12, 14, 16, 18],
    f: (x, k) => k - x,
    formula: (k) => `□ ＋ △ ＝ ${k}`,
    wrongF: (k) => [
      [`□ ＋ △ ＝ ${2 * k}`, 'half-perimeter'],
      [`□ × △ ＝ ${k}`, 'add-vs-mult'],
      [`△ − □ ＝ ${k}`, 'sum-vs-diff'],
    ],
    rule: (k) => `□と △を たすと いつも ${k}`,
    wrongRule: (k) => [
      [`□と △を たすと いつも ${2 * k}`, 'half-perimeter'],
      [`△は いつも □より ${k} 大きい`, 'sum-vs-diff'],
    ],
    xmax: 9,
  },
  {
    id: 'stairs',
    text: () => '1辺 1cmの 正方形を ならべて、だんの 形を つくります。',
    x: 'だんの 数',
    y: 'まわりの 長さ',
    ux: 'だん',
    uy: 'cm',
    ks: [4],
    f: (x) => 4 * x,
    formula: () => '□ × 4 ＝ △',
    wrongF: () => [
      ['□ ＋ 4 ＝ △', 'add-vs-mult'],
      ['△ × 4 ＝ □', 'swap-vars'],
      ['□ × 3 ＝ △', 'first-pair'],
    ],
    rule: () => '△は □の 4倍',
    wrongRule: () => [
      ['△は □より 4 大きい', 'add-vs-mult'],
      ['□と △を たすと 4', 'sum-vs-diff'],
    ],
    xmax: 12,
  },
  {
    id: 'water',
    text: (k) => `からの 水そうに 水を 入れると、1分間に ${k}cmずつ 水の 深さが ふえます。`,
    x: '入れた 時間',
    y: '水の 深さ',
    ux: '分',
    uy: 'cm',
    ks: [2, 3, 4, 5],
    f: (x, k) => k * x,
    formula: (k) => `${k} × □ ＝ △`,
    wrongF: (k) => [
      [`${k} ＋ □ ＝ △`, 'add-vs-mult'],
      [`${k} × △ ＝ □`, 'swap-vars'],
      [`□ − ${k} ＝ △`, 'add-vs-mult'],
    ],
    rule: (k) => `△は □の ${k}倍`,
    wrongRule: (k) => [
      [`△は □より ${k} 大きい`, 'add-vs-mult'],
      [`□と △の ちがいは いつも ${k}`, 'sum-vs-diff'],
    ],
    xmax: 10,
  },
  {
    id: 'candle',
    text: (k) => `長さ ${k}cmの ろうそくが、火を つけると 1分間に 1cmずつ 短く なります。`,
    x: 'もやした 時間',
    y: 'のこりの 長さ',
    ux: '分',
    uy: 'cm',
    ks: [15, 18, 20, 24],
    f: (x, k) => k - x,
    formula: (k) => `${k} − □ ＝ △`,
    wrongF: (k) => [
      [`${k} ＋ □ ＝ △`, 'sum-vs-diff'],
      [`□ − ${k} ＝ △`, 'swap-vars'],
      [`${k} × □ ＝ △`, 'add-vs-mult'],
    ],
    rule: (k) => `□と △を たすと いつも ${k}`,
    wrongRule: (k) => [
      [`△は □より ${k} 大きい`, 'sum-vs-diff'],
      [`△は □の ${k}倍`, 'add-vs-mult'],
    ],
    xmax: 12,
  },
  {
    id: 'matchSq',
    text: () => 'ぼうを 使って、正方形を 横に 1列に つなげて ならべます。',
    x: '正方形の 数',
    y: 'ぼうの 数',
    ux: 'こ',
    uy: '本',
    ks: [3],
    f: (x) => 3 * x + 1,
    formula: () => '1 ＋ 3 × □ ＝ △',
    wrongF: () => [
      ['4 × □ ＝ △', 'first-pair'],
      ['3 ＋ □ ＝ △', 'add-vs-mult'],
      ['1 ＋ 3 × △ ＝ □', 'swap-vars'],
    ],
    rule: () => '□が 1 ふえると、△は 3 ふえる',
    wrongRule: () => [
      ['□が 1 ふえると、△は 4 ふえる', 'first-pair'],
      ['△は いつも □より 3 大きい', 'add-vs-mult'],
    ],
    xmax: 12,
  },
  {
    id: 'matchTri',
    text: () => 'ぼうを 使って、正三角形を 横に 1列に つなげて ならべます。',
    x: '三角形の 数',
    y: 'ぼうの 数',
    ux: 'こ',
    uy: '本',
    ks: [2],
    f: (x) => 2 * x + 1,
    formula: () => '1 ＋ 2 × □ ＝ △',
    wrongF: () => [
      ['3 × □ ＝ △', 'first-pair'],
      ['2 ＋ □ ＝ △', 'add-vs-mult'],
      ['1 ＋ 2 × △ ＝ □', 'swap-vars'],
    ],
    rule: () => '□が 1 ふえると、△は 2 ふえる',
    wrongRule: () => [
      ['□が 1 ふえると、△は 3 ふえる', 'first-pair'],
      ['△は いつも □より 1 大きい', 'add-vs-mult'],
    ],
    xmax: 12,
  },
];

/** 表の 図（hide: ？に する 列） */
function tableFig(sc: Scene, k: number, xs: number[], hide: number[]): Figure {
  return {
    kind: 'table',
    header: [`□ ${sc.x}（${sc.ux}）`, ...xs.map(String)],
    rows: [
      [
        `△ ${sc.y}（${sc.uy}）`,
        ...xs.map((x, i) => (hide.includes(i) ? '？' : String(sc.f(x, k)))),
      ],
    ],
  };
}

function setup(rng: Rng) {
  const sc = pick(rng, SCENES);
  const k = pick(rng, sc.ks);
  const start = sc.id === 'rope' ? 1 : rng.int(1, 2);
  const xs = Array.from({ length: 5 }, (_, i) => start + i).filter((x) => sc.f(x, k) > 0);
  return { sc, k, xs };
}

/** 表を 完成させる（alt: 折れ線グラフから 読む） */
function table(level: number, rng: Rng, alt: boolean): Item {
  const { sc, k, xs } = setup(rng);
  if (alt) {
    const ys = xs.map((x) => sc.f(x, k));
    const maxY = Math.max(...ys);
    const step = maxY > 200 ? 50 : maxY > 80 ? 20 : maxY > 30 ? 5 : maxY > 15 ? 2 : 1;
    const i = rng.int(0, xs.length - 1);
    const item: GraphItem = {
      engine: 'graph',
      id: `table-alt:${sc.id}:${k}:${xs[0]}:${i}`,
      objective: 'table',
      level,
      prompt: `${sc.text(k)} ${sc.x}（□）と ${sc.y}（△）の 関係を 折れ線グラフに しました。□が ${xs[i]}の とき、△は いくつですか。`,
      hints: [
        '横の じくで □の 数を さがそう。',
        `□が ${xs[i]}の ところの 点の 高さを 読もう。`,
        `たての じくの 1めもりは ${step}だよ。`,
      ],
      explain: `□が ${xs[i]}の とき、△は ${ys[i]}です。`,
      identity: `table-graph:${sc.id}:${k}:${xs[0]}:${i}`,
      alt: true,
      data: {
        kind: 'line',
        labels: xs.map(String),
        values: ys,
        scaleStep: step,
        labelEvery: step === 1 ? 2 : 2,
        max: Math.ceil((maxY + step) / step) * step,
        unit: sc.uy,
        title: `${sc.x}と ${sc.y}`,
      },
      task: {
        kind: 'number',
        fields: [{ label: sc.uy, answer: { kind: 'int', value: ys[i]! } }],
        wrongAnswers: wrongList(
          [{ kind: 'int', value: ys[i]! }],
          [
            [ys[i]! / step !== ys[i] ? ys[i]! / step : null, 'scale-one'],
            [i + 1 < ys.length ? ys[i + 1] : null, 'next-point'],
          ],
        ).map((w) => ({ ...w, value: String(Number(w.value)) })),
      },
    };
    return item;
  }
  const hide = [3, 4].filter((i) => i < xs.length);
  const answers = hide.map((i) => ({ kind: 'int' as const, value: sc.f(xs[i]!, k) }));
  const d = sc.f(xs[1]!, k) - sc.f(xs[0]!, k);
  const item: NumberItem = {
    engine: 'number',
    id: `table:${sc.id}:${k}:${xs[0]}`,
    objective: 'table',
    level,
    prompt: `${sc.text(k)} 表の ？に あてはまる 数を 書こう。`,
    figure: tableFig(sc, k, xs, hide),
    hints: [
      '表を 横に 見て、△の 数の 変わり方を 調べよう。',
      `□が 1 ふえると、△は ${Math.abs(d)} ${d >= 0 ? 'ふえる' : 'へる'}ね。`,
      `□が ${xs[hide[0]!]}の とき、${sc.f(xs[hide[0]! - 1]!, k)}${d >= 0 ? ' ＋ ' : ' − '}${Math.abs(d)}。`,
    ],
    explain: `□が 1 ふえると △は ${Math.abs(d)}ずつ ${d >= 0 ? 'ふえる' : 'へる'}ので、${hide.map((i) => sc.f(xs[i]!, k)).join('、')}です。`,
    identity: `table:${sc.id}:${k}:${xs[0]}`,
    alt: false,
    fields: hide.map((i, j) => ({ label: `□が ${xs[i]}`, answer: answers[j]! })),
    wrongAnswers: wrongList(answers, [
      [hide.map((i) => sc.f(xs[i]!, k) + (d >= 0 ? 1 : -1)).join('|'), 'step-miss'],
      [hide.map((i) => xs[i]! * (sc.f(xs[0]!, k) / xs[0]!)).join('|'), 'first-pair'],
    ]),
  };
  return item;
}

/** きまり（言葉）を 選ぶ（alt: □が 1 ふえると △は いくつ 変わる） */
function rule(level: number, rng: Rng, alt: boolean): Item {
  const { sc, k, xs } = setup(rng);
  const fig = tableFig(sc, k, xs, []);
  if (alt) {
    const d = sc.f(xs[1]!, k) - sc.f(xs[0]!, k);
    const answers = [{ kind: 'int' as const, value: Math.abs(d) }];
    const item: NumberItem = {
      engine: 'number',
      id: `rule-alt:${sc.id}:${k}:${xs[0]}`,
      objective: 'rule',
      level,
      prompt: `${sc.text(k)} □が 1 ふえると、△は いくつ ${d >= 0 ? 'ふえ' : 'へり'}ますか。`,
      figure: fig,
      hints: [
        '表を 横に 見よう。',
        `□が ${xs[0]}から ${xs[1]}に なると、△は ${sc.f(xs[0]!, k)}から ${sc.f(xs[1]!, k)}。`,
        'その ちがいを 計算しよう。',
      ],
      explain: `□が 1 ふえると、△は ${Math.abs(d)} ${d >= 0 ? 'ふえます' : 'へります'}。`,
      identity: `rule-step:${sc.id}:${k}:${xs[0]}`,
      alt: true,
      fields: [{ answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [sc.f(xs[0]!, k), 'first-pair'],
        [Math.abs(d) + 1, 'step-miss'],
      ]),
    };
    return item;
  }
  const item: ChoiceItem = {
    engine: 'choice',
    id: `rule:${sc.id}:${k}:${xs[0]}`,
    objective: 'rule',
    level,
    prompt: `${sc.text(k)} □と △の 関係で 正しい ものは どれ？`,
    figure: fig,
    hints: [
      '表を たてに 見て、□と △を くらべよう。',
      'たしたり、ひいたり、わったり して、いつも 同じに なる ものを さがそう。',
      `□が ${xs[0]}、△が ${sc.f(xs[0]!, k)}の とき、どれが 合うかな。ほかの 列でも たしかめよう。`,
    ],
    explain: `${sc.rule(k)}。どの 列でも なりたちます。`,
    identity: `rule:${sc.id}:${k}:${xs[0]}`,
    alt: false,
    options: opts(
      sc.rule(k),
      sc.wrongRule(k).map(([l, m]) => [l, m]),
    ),
  };
  return item;
}

/** 式に 表す（alt: 式を 文で 選ぶ のでなく、式の 中の 数を 入れる） */
function formula(level: number, rng: Rng, alt: boolean): Item {
  const { sc, k, xs } = setup(rng);
  const fig = tableFig(sc, k, xs, []);
  if (alt) {
    // 式の □ 以外の 数を 1つ かくして 入れる
    const f = sc.formula(k);
    const nums = [...f.matchAll(/\d+/g)].map((m) => Number(m[0]));
    const target = nums[nums.length - 1]!;
    const shown = f.replace(new RegExp(`${target}(?!.*${target})`), '{{}}');
    const answers = [{ kind: 'int' as const, value: target }];
    const item: NumberItem = {
      engine: 'number',
      id: `formula-alt:${sc.id}:${k}:${xs[0]}`,
      objective: 'formula',
      level,
      prompt: `${sc.text(k)} □と △の 関係を 式に 表します。あいて いる ところに 入る 数を 書こう。`,
      figure: { kind: 'column', gap: 1, items: [fig, { kind: 'text', text: shown, size: 'xl' }] },
      hints: [
        '表の 1つの 列の 数を、式に あてはめて みよう。',
        `□が ${xs[0]}、△が ${sc.f(xs[0]!, k)}。`,
        'ほかの 列でも 同じ 数に なるか たしかめよう。',
      ],
      explain: `式は ${f}です。`,
      identity: `formula-blank:${sc.id}:${k}:${xs[0]}`,
      alt: true,
      fields: [{ answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [sc.f(xs[0]!, k), 'first-pair'],
        [target * 2, 'half-perimeter'],
      ]),
    };
    return item;
  }
  const item: ChoiceItem = {
    engine: 'choice',
    id: `formula:${sc.id}:${k}:${xs[0]}`,
    objective: 'formula',
    level,
    prompt: `${sc.text(k)} □を ${sc.x}、△を ${sc.y}と します。□と △の 関係を 表す 式は どれ？`,
    figure: fig,
    hints: [
      '表の 数を 式に あてはめて、正しく なるか たしかめよう。',
      `□が ${xs[0]}、△が ${sc.f(xs[0]!, k)}で なりたつか。`,
      `□が ${xs[1]}、△が ${sc.f(xs[1]!, k)}でも なりたつか 見よう。`,
    ],
    explain: `${sc.formula(k)}。表の どの 列を あてはめても なりたちます。`,
    identity: `formula:${sc.id}:${k}:${xs[0]}`,
    alt: false,
    options: opts(
      sc.formula(k),
      sc.wrongF(k).map(([l, m]) => [l, m]),
    ),
  };
  return item;
}

/** 式を 使って 求める（alt: △から □を 求める） */
function apply(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, SCENES);
  const k = pick(rng, sc.ks);
  let x = rng.int(6, sc.xmax + 8);
  while (sc.f(x, k) <= 0) x--;
  const y = sc.f(x, k);
  const answers = [{ kind: 'int' as const, value: alt ? x : y }];
  return {
    engine: 'number',
    id: `apply${alt ? '-alt' : ''}:${sc.id}:${k}:${x}`,
    objective: 'apply',
    level,
    prompt: alt
      ? `${sc.text(k)} 式は ${sc.formula(k)}（□: ${sc.x}、△: ${sc.y}）です。△が ${y}${sc.uy}の とき、□は いくつですか。`
      : `${sc.text(k)} 式は ${sc.formula(k)}（□: ${sc.x}、△: ${sc.y}）です。□が ${x}${sc.ux}の とき、△は いくつですか。`,
    hints: [
      '式の □や △に 数を あてはめよう。',
      alt ? `${sc.formula(k).replace('△', String(y))}` : `${sc.formula(k).replace('□', String(x))}`,
      alt ? '□に 入る 数を、反対の 計算で 求めよう。' : 'のこりの 計算を しよう。',
    ],
    explain: alt
      ? `${sc.formula(k).replace('□', String(x)).replace('△', String(y))}。□は ${x}${sc.ux}です。`
      : `${sc.formula(k).replace('□', String(x)).replace('△', String(y))}。△は ${y}${sc.uy}です。`,
    identity: `apply${alt ? '-inv' : ''}:${sc.id}:${k}:${x}`,
    alt,
    fields: [{ label: alt ? sc.ux : sc.uy, answer: answers[0]! }],
    wrongAnswers: wrongList(
      answers,
      alt
        ? [[y, 'swap-vars']]
        : [
            [x, 'swap-vars'],
            [x + k, 'add-vs-mult'],
            [x * k, 'add-vs-mult'],
          ],
    ),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['table', 'rule'] },
  { objs: ['rule', 'formula', 'table'] },
  { objs: ['formula', 'apply', 'rule', 'table'] },
];

export function generateChangeRelations(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'table':
      return table(level, rng, alt);
    case 'rule':
      return rule(level, rng, alt);
    case 'formula':
      return formula(level, rng, alt);
    case 'apply':
      return apply(level, rng, alt);
  }
}

export const changeRelations: UnitSpec = finishUnit({
  id: 'g4.math.change-relations',
  title: '変わり方（ともなって 変わる 2つの 数）',
  stage: 'g4',
  subject: 'math',
  domain: 'C-measure',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-sorting',
  prereq: ['g4.math.order-ops'],
  objectives: [
    { id: 'table', title: '表や グラフで 調べる' },
    { id: 'rule', title: 'きまりを 見つける' },
    { id: 'formula', title: '□と △の 式に 表す' },
    { id: 'apply', title: '式を 使って 求める' },
  ],
  misconceptions: [
    {
      id: 'add-vs-mult',
      explain:
        '「何倍」と「いくつ 大きい」を まちがえたのかな。表の ほかの 列でも なりたつか たしかめよう。',
    },
    {
      id: 'swap-vars',
      explain: '□と △を 入れかえたのかな。□が どちらの 数か、もう一度 たしかめよう。',
    },
    {
      id: 'sum-vs-diff',
      explain:
        'たすと 同じに なるのか、ひくと 同じに なるのかを まちがえたのかな。表の 数で 計算して たしかめよう。',
    },
    {
      id: 'first-pair',
      explain:
        '最初の 1列だけで きめたのかな。きまりは 表の どの 列でも なりたつ ものだよ。2列目・3列目でも たしかめよう。',
    },
    {
      id: 'half-perimeter',
      explain:
        'まわりの 長さは たて 2本と 横 2本。たてと 横を 1本ずつ たすと、まわりの 長さの 半分だね。',
    },
    {
      id: 'step-miss',
      explain:
        '1 ふえる ごとに いくつ 変わるかを たしかめよう。となりの 列との ちがいを 計算すると わかるよ。',
    },
    {
      id: 'scale-one',
      explain: 'たての じくの 1めもりの 大きさを たしかめよう。1めもりが 1とは かぎらないよ。',
    },
    {
      id: 'next-point',
      explain: 'となりの 点を 読んだのかな。横の じくの 数を 指で たどってから、上の 点を 読もう。',
    },
  ],
  levels: [
    { label: '表・きまり', chance: 0.1 },
    { label: '式に 表す', chance: 0.1 },
    { label: '式を 使う', chance: 0.05 },
  ],
  intro: [
    {
      text: '1さつ 80円の ノートの 数と 代金のように、一方が 変わると もう一方も 変わる 2つの 数が あります。',
    },
    {
      text: '表に 整理すると、変わり方の きまりが 見つけやすく なります。',
      figure: {
        kind: 'table',
        header: ['□ ノートの 数（さつ）', '1', '2', '3', '4'],
        rows: [['△ 代金（円）', '80', '160', '240', '320']],
      },
    },
    {
      text: '△は いつも □の 80倍。式に 表すと 80 × □ ＝ △。',
      figure: { kind: 'text', text: '80 × □ ＝ △', size: 'xl' },
    },
    {
      text: '式が あれば、□が 15の ときの △も すぐに 求められます。80 × 15 ＝ 1200。',
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateChangeRelations(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第4学年 C(1) 伴って変わる二つの数量（表・式・折れ線グラフ）',
  revised: REVISED,
});
