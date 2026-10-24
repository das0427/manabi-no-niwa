/**
 * g5.math.proportion-simple 簡単な比例（表で）（curriculum-matrix 3.8）。
 * 表で □ が 2倍・3倍に なると ○ も 2倍・3倍 → 表の空欄 → 比例かどうかを見分ける → 式（○ ＝ □ × きまった数）。
 *
 * 種別は概念（基準 60）。表は figure の table（graph の表は値を空けられないため number・choice で出す）。
 * 同一性キー: 問う形 × 場面 × きまった数 × 問う位置。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { expr, finishUnit, pick, pickObj, REVISED, wrongList } from './util';

type Obj = 'times' | 'fill' | 'judge' | 'formula' | 'inverse';

interface Scene {
  id: string;
  /** 表の 見出し（□ と ○ の 量） */
  x: string;
  y: string;
  /** 答えの 単位 */
  yu: string;
  xu: string;
  ks: number[];
  /** 1つ分の 説明（ヒント用） */
  per: (k: number) => string;
}

const SCENES: Scene[] = [
  { id: 'tape', x: 'テープの 長さ □（m）', y: '代金 ○（円）', xu: 'm', yu: '円', ks: [20, 30, 40, 50, 60, 70, 80, 90], per: (k) => `1mの 代金は ${k}円` },
  { id: 'water', x: '水を 入れる 時間 □（分《ふん》）', y: '水の 深さ ○（cm）', xu: '分《ふん》', yu: 'cm', ks: [2, 3, 4, 5, 6], per: (k) => `1分《ぷん》で ${k}cm ふかく なる` },
  { id: 'square', x: '正方形の 1辺の 長さ □（cm）', y: 'まわりの 長さ ○（cm）', xu: 'cm', yu: 'cm', ks: [4], per: () => '正方形の まわりは 1辺の 4つ分' },
  { id: 'note', x: 'ノートの さっ数 □（さつ）', y: '代金 ○（円）', xu: 'さつ', yu: '円', ks: [80, 90, 100, 110, 120, 130, 150], per: (k) => `1さつ ${k}円` },
  { id: 'wire', x: 'はり金の 長さ □（m）', y: '重さ ○（g）', xu: 'm', yu: 'g', ks: [15, 20, 25, 30, 35, 40], per: (k) => `1mの 重さは ${k}g` },
  { id: 'stairs', x: 'だんの 数 □（だん）', y: '高さ ○（cm）', xu: 'だん', yu: 'cm', ks: [12, 14, 15, 16, 18, 20], per: (k) => `1だんの 高さは ${k}cm` },
  { id: 'bike', x: '走る 時間 □（分《ふん》）', y: '道のり ○（m）', xu: '分《ふん》', yu: 'm', ks: [150, 200, 250, 300], per: (k) => `1分《ぷん》で ${k}m 進む` },
  { id: 'tri', x: '正三角形の 1辺の 長さ □（cm）', y: 'まわりの 長さ ○（cm）', xu: 'cm', yu: 'cm', ks: [3], per: () => '正三角形の まわりは 1辺の 3つ分' },
];

/** 表（見出しの 行と ○ の 行）。null の ところは 空ける、'？' は 問う ところ */
function table(sc: Scene, xs: (number | string)[], ys: (number | string | null)[]): Figure {
  return {
    kind: 'table',
    header: [sc.x, ...xs.map(String)],
    rows: [[sc.y, ...ys.map((v) => (v === null ? '' : String(v)))]],
  };
}

/** 場面と きまった数（場面の 中から 均等に） */
function pickSK(rng: Rng): [Scene, number] {
  const all = SCENES.flatMap((s) => s.ks.map((k) => [s, k] as [Scene, number]));
  return pick(rng, all);
}

/** □ が m倍に なると ○ は 何倍？（alt: 文を 選ぶ） */
function times(level: number, rng: Rng, alt: boolean): Item {
  const [sc, k] = pickSK(rng);
  if (alt) {
    const m = rng.int(2, 5);
    const item: ChoiceItem = {
      engine: 'choice',
      id: `times-alt:${sc.id}:${m}`,
      objective: 'times',
      level,
      prompt: `${sc.x.replace(/ □.*$/, '')}が ${m}倍に なると、${sc.y.replace(/ ○.*$/, '')}は どう なりますか。（${sc.per(k)}）`,
      figure: table(sc, [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6].map((x) => k * x)),
      hints: [
        '表を 横に 見て、□が 2倍の ところを さがそう。',
        `□が 1から 2に なると、○は ${k}から ${2 * k}に なるね。`,
        `□が 1から ${m}に なると、○は ${k}から 何に なるかな。`,
      ],
      explain: `□が 2倍、3倍、…に なると、○も 2倍、3倍、…に なります（比例）。だから □が ${m}倍に なると ○も ${m}倍に なります。`,
      identity: `times-alt:${sc.id}:${m}`,
      alt: true,
      options: [
        { label: `${m}倍に なる`, correct: true },
        { label: `${m}だけ ふえる`, misconception: 'add-not-mult' },
        { label: `[[1/${m}]]に なる`, misconception: 'k-swap' },
        { label: '変わらない', misconception: 'not-proportional' },
      ],
    };
    return item;
  }
  const a = rng.int(1, 3);
  const m = rng.int(2, 4);
  const b = a * m;
  const xs = [a, b];
  const answers = [{ kind: 'int' as const, value: m }];
  const item: NumberItem = {
    engine: 'number',
    id: `times:${sc.id}:${k}:${a}:${b}`,
    objective: 'times',
    level,
    prompt: `${sc.x.replace(/ □.*$/, '')} □が ${a}から ${b}に なると、${sc.y.replace(/ ○.*$/, '')} ○は 何倍に なりますか。`,
    figure: table(sc, xs, xs.map((x) => k * x)),
    hints: [
      '○の 数どうしを くらべよう。ひき算ではなく、何倍かを 考えるよ。',
      `○は ${k * a}から ${k * b}に なったね。`,
      `${k * b} ÷ ${k * a}を 計算しよう。`,
    ],
    explain: `${k * b} ÷ ${k * a} ＝ ${m}。□が ${m}倍に なると ○も ${m}倍に なります。○は □に 比例しています。`,
    identity: `times:${sc.id}:${k}:${a}:${b}`,
    alt: false,
    fields: [{ label: '倍', answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [k * b - k * a, 'add-not-mult'],
      [b - a, 'add-not-mult'],
    ]),
  };
  return item;
}

/** 表の 空欄（alt: 表なしの 文で） */
function fill(level: number, rng: Rng, alt: boolean): NumberItem {
  const [sc, k] = pickSK(rng);
  if (alt) {
    const a = rng.int(2, 4);
    const t = rng.int(5, 12);
    const answers = [{ kind: 'int' as const, value: k * t }];
    return {
      engine: 'number',
      id: `fill-alt:${sc.id}:${k}:${a}:${t}`,
      objective: 'fill',
      level,
      prompt: `${sc.y.replace(/ ○.*$/, '')}は ${sc.x.replace(/ □.*$/, '')}に 比例します。□が ${a}${sc.xu}の とき、○は ${k * a}${sc.yu}です。□が ${t}${sc.xu}の とき、○は 何${sc.yu}ですか。`,
      hints: [
        '比例する ときは、□が 何倍に なると ○も 同じ 何倍に なるよ。',
        `□が 1の ときの ○を 先に 求めよう。${k * a} ÷ ${a}。`,
        `□が 1の とき ○は ${k}。□が ${t}なら、${k} × ${t}を 計算しよう。`,
      ],
      explain: `□が 1の とき ○は ${k * a} ÷ ${a} ＝ ${k}。□が ${t}の ときは ${k} × ${t} ＝ ${k * t}。答えは ${k * t}${sc.yu}です。`,
      identity: `fill-alt:${sc.id}:${k}:${a}:${t}`,
      alt: true,
      fields: [{ label: sc.yu, answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [k * a + (t - a), 'add-not-mult'],
        [k * a * t, 'k-swap'],
      ]),
    };
  }
  const t = rng.int(4, 6);
  const xs = [1, 2, 3, 4, 5, 6];
  const ys = xs.map((x) => (x <= 2 ? k * x : x === t ? '？' : null));
  const answers = [{ kind: 'int' as const, value: k * t }];
  return {
    engine: 'number',
    id: `fill:${sc.id}:${k}:${t}`,
    objective: 'fill',
    level,
    prompt: `表の ？に あてはまる 数を 求めよう。○は □に 比例します。`,
    figure: table(sc, xs, ys),
    hints: [
      '□が 2倍、3倍に なると、○も 2倍、3倍に なるよ。',
      `□が 1の とき ○は ${k}。□が ${t}の ときは、□が 1の ときの ${t}倍だね。`,
      `${k} × ${t}を 計算しよう。`,
    ],
    explain: `□が ${t}倍に なると ○も ${t}倍。${k} × ${t} ＝ ${k * t}です。`,
    identity: `fill:${sc.id}:${k}:${t}`,
    alt: false,
    fields: [{ label: sc.yu, answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [2 * k + (t - 2), 'add-not-mult'],
      [k + t, 'add-not-mult'],
    ]),
  };
}

/** 比例して いない 表の 作り方 */
const NOT_PROP: { id: string; f: (x: number, c: number) => number }[] = [
  { id: 'plus', f: (x, c) => x + c },
  { id: 'minus', f: (x, c) => c - x },
  { id: 'sq', f: (x) => x * x },
  { id: 'plus2', f: (x, c) => 2 * x + c },
];

/** 比例する 表を 選ぶ（alt: ことばの 場面を 選ぶ） */
function judge(level: number, rng: Rng, alt: boolean): ChoiceItem {
  if (alt) {
    const PROP = [
      '1本 60円の えんぴつの 本数と 代金',
      '1さつ 3cmの あつさの 本を 重ねた ときの さっ数と 高さ',
      '正方形の 1辺の 長さと まわりの 長さ',
      '同じ 速さで 歩く ときの 時間と 道のり',
      '1mの 重さが 20gの はり金の 長さと 重さ',
      '1分《ぷん》に 2Lずつ 水を 入れる ときの 時間と 水の 量',
    ];
    const NOT = [
      ['姉と 妹の 年れい（姉は 3才 上）', 'not-proportional'],
      ['正方形の 1辺の 長さと 面積', 'not-proportional'],
      ['まわりの 長さが 20cmの 長方形の たてと 横の 長さ', 'not-proportional'],
      ['30まいの 色紙から 使った まい数と のこりの まい数', 'not-proportional'],
      ['1日の 昼の 時間と 夜の 時間', 'not-proportional'],
    ] as const;
    const p = pick(rng, PROP);
    const ns = rng.sample(NOT, 3);
    return {
      engine: 'choice',
      id: `judge-alt:${p}:${ns.map((n) => n[0]).join('|')}`,
      objective: 'judge',
      level,
      prompt: '一方が 2倍、3倍に なると、もう一方も 2倍、3倍に なる（比例する）のは どれ？',
      hints: [
        '「ふえる」だけでは 比例とは かぎらないよ。2倍に したら どう なるか 考えよう。',
        '頭の 中で 小さい 表を 作って、1の ときと 2の ときを くらべよう。',
        '一方を 2倍に すると、もう一方が ちょうど 2倍に なるのは どれかな。',
      ],
      explain: `「${p}」は、一方が 2倍、3倍に なると もう一方も 2倍、3倍に なるので 比例します。ほかは 2倍に しても 2倍に ならないよ。`,
      identity: `judge-alt:${p}:${ns.map((n) => n[0]).sort().join('|')}`,
      alt: true,
      layout: 'column',
      options: [{ label: p, correct: true }, ...ns.map(([l, m]) => ({ label: l, misconception: m }))],
    };
  }
  const k = rng.int(2, 9);
  const xs = [1, 2, 3, 4, 5];
  const wrong = rng.sample(NOT_PROP, 3).map((w) => {
    const c = w.id === 'minus' ? rng.int(8, 15) : rng.int(1, 6);
    return { key: `${w.id}${c}`, ys: xs.map((x) => w.f(x, c)), id: w.id };
  });
  const tbl = (ys: number[]): Figure => ({ kind: 'table', header: ['□', ...xs.map(String)], rows: [['○', ...ys.map(String)]] });
  return {
    engine: 'choice',
    id: `judge:${k}:${wrong.map((w) => w.key).join('|')}`,
    objective: 'judge',
    level,
    prompt: '○が □に 比例して いる 表は どれ？',
    hints: [
      '□が 1から 2に なった とき、○が 2倍に なって いるかを 見よう。',
      '□が 1から 3に なった とき、○は 3倍に なって いるかな。',
      'どの 列でも ○ ÷ □が 同じ 数に なる 表を さがそう。',
    ],
    explain: `比例する 表は、□が 2倍、3倍に なると ○も 2倍、3倍に なります。○ ÷ □が いつも ${k}に なる 表が 比例です。`,
    identity: `judge:${k}:${wrong.map((w) => w.key).sort().join('|')}`,
    alt: false,
    layout: 'grid',
    options: [
      { figure: tbl(xs.map((x) => k * x)), correct: true },
      ...wrong.map((w) => ({
        figure: tbl(w.ys),
        misconception: 'not-proportional',
      })),
    ],
  };
}

/** きまった数を 求める（○ ＝ □ × きまった数）。alt: 式を 使って 大きな □ の ○ */
function formula(level: number, rng: Rng, alt: boolean): NumberItem {
  const [sc, k] = pickSK(rng);
  if (alt) {
    const t = rng.int(10, 30);
    const answers = [{ kind: 'int' as const, value: k * t }];
    return {
      engine: 'number',
      id: `formula-alt:${sc.id}:${k}:${t}`,
      objective: 'formula',
      level,
      prompt: `${sc.x.replace(/ □.*$/, '')}を □、${sc.y.replace(/ ○.*$/, '')}を ○と すると、○ ＝ □ × ${k}と 表せます。□が ${t}の とき、○は いくつですか。`,
      figure: expr(`○ ＝ ${t} × ${k}`),
      hints: ['式の □に 数を 入れよう。', `○ ＝ ${t} × ${k}`, `${t} × ${k}を 計算しよう。`],
      explain: `○ ＝ ${t} × ${k} ＝ ${k * t}。答えは ${k * t}${sc.yu}です。`,
      identity: `formula-alt:${sc.id}:${k}:${t}`,
      alt: true,
      fields: [{ label: sc.yu, answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [[t + k, 'add-not-mult']]),
    };
  }
  const xs = [1, 2, 3, 4, 5];
  const answers = [{ kind: 'int' as const, value: k }];
  return {
    engine: 'number',
    id: `formula:${sc.id}:${k}`,
    objective: 'formula',
    level,
    prompt: '表を 見て、○ ＝ □ × きまった数 の 式に 表そう。きまった数は いくつですか。',
    figure: { kind: 'column', items: [table(sc, xs, xs.map((x) => k * x)), expr('○ ＝ □ × {{}}')] },
    hints: [
      '○を □で わると、どの 列でも 同じ 数に なるよ。',
      `□が 2の とき ○は ${2 * k}。${2 * k} ÷ 2を 計算しよう。`,
      `□が 1の とき ○は いくつかな。`,
    ],
    explain: `○ ÷ □は いつも ${k}（${sc.per(k)}）。だから ○ ＝ □ × ${k}です。`,
    identity: `formula:${sc.id}:${k}`,
    alt: false,
    fields: [{ answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [k - 1, 'add-not-mult'],
      [k * 2 - 2, 'add-not-mult'],
    ]),
  };
}

/** ○ から □ を 求める（alt: 表なしの 文で） */
function inverse(level: number, rng: Rng, alt: boolean): NumberItem {
  const [sc, k] = pickSK(rng);
  const t = rng.int(alt ? 7 : 4, alt ? 20 : 9);
  const y = k * t;
  const answers = [{ kind: 'int' as const, value: t }];
  const xs = [1, 2, 3, '…', '？'];
  return {
    engine: 'number',
    id: `inverse${alt ? '-alt' : ''}:${sc.id}:${k}:${t}`,
    objective: 'inverse',
    level,
    prompt: alt
      ? `${sc.y.replace(/ ○.*$/, '')} ○は ${sc.x.replace(/ □.*$/, '')} □に 比例し、○ ＝ □ × ${k}です。○が ${y}${sc.yu}の とき、□は いくつですか。`
      : `表の ？に あてはまる 数を 求めよう。○は □に 比例します。`,
    figure: alt ? undefined : table(sc, xs, [k, 2 * k, 3 * k, '…', y]),
    hints: [
      `○ ＝ □ × ${k}の □を 求めるよ。`,
      `□ × ${k} ＝ ${y}`,
      `${y} ÷ ${k}を 計算しよう。`,
    ],
    explain: `□ × ${k} ＝ ${y}なので、□ ＝ ${y} ÷ ${k} ＝ ${t}。答えは ${t}${sc.xu}です。`,
    identity: `inverse${alt ? '-alt' : ''}:${sc.id}:${k}:${t}`,
    alt,
    fields: [{ label: sc.xu, answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [y * k, 'k-swap'],
      [y - k, 'add-not-mult'],
    ]),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['times', 'fill'] },
  { objs: ['judge', 'fill', 'times'] },
  { objs: ['formula', 'inverse', 'judge'] },
  { objs: ['times', 'fill', 'judge', 'formula', 'inverse'] },
];

export function generateProportionSimple(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'times':
      return times(level, rng, alt);
    case 'fill':
      return fill(level, rng, alt);
    case 'judge':
      return judge(level, rng, alt);
    case 'formula':
      return formula(level, rng, alt);
    case 'inverse':
      return inverse(level, rng, alt);
  }
}

const DEMO = SCENES[1]!;

export const proportionSimple: UnitSpec = finishUnit(
  {
    id: 'g5.math.proportion-simple',
    title: '比例（表で 調べよう）',
    stage: 'g5',
    subject: 'math',
    domain: 'C-measure',
    kind: 'concept',
    priority: 'P1',
    status: 'ready',
    icon: 'mode-sorting',
    prereq: ['g4.math.change-relations'],
    objectives: [
      { id: 'times', title: '□が 2倍、3倍に なると ○も 2倍、3倍' },
      { id: 'fill', title: '比例の 表の 空らんを うめる' },
      { id: 'judge', title: '比例して いるかを 見分ける' },
      { id: 'formula', title: '○ ＝ □ × きまった数 の 式' },
      { id: 'inverse', title: '○から □を 求める' },
    ],
    misconceptions: [
      {
        id: 'add-not-mult',
        explain:
          'ふえた 分を たし算や ひき算で 考えたのかな。比例は「□が 2倍に なると ○も 2倍」。いくつ ふえたかでは なく、何倍に なったかを 見よう。',
      },
      {
        id: 'not-proportional',
        explain:
          '一方が ふえると もう一方も ふえる（へる）だけでは、比例とは かぎらないよ。□を 2倍に した とき、○が ちょうど 2倍に なるかを たしかめよう。',
      },
      {
        id: 'k-swap',
        explain:
          'かけ算と わり算を 反対に したのかな。○ ＝ □ × きまった数。○から □を 求める ときは ○ ÷ きまった数 だよ。',
      },
    ],
    levels: [
      { label: '何倍に なるか・表の 空らん', chance: 0.05 },
      { label: '比例を 見分ける', chance: 0.03 },
      { label: '式・○から □', chance: 0.02 },
      { label: 'まとめ', chance: 0.02 },
    ],
    intro: [
      {
        text: '水そうに 水を 入れます。1分《ぷん》で 3cm ずつ 深く なります。時間 □と 深さ ○を 表に しました。',
        figure: table(DEMO, [1, 2, 3, 4, 5, 6], [3, 6, 9, 12, 15, 18]),
      },
      {
        text: '□が 2倍、3倍に なると、○も 2倍、3倍に なります。このとき「○は □に 比例する」と いいます。',
        figure: expr('□ × 2 → ○ × 2'),
      },
      {
        text: '○ ÷ □は いつも 3。だから ○ ＝ □ × 3 と 表せます。',
        figure: expr('○ ＝ □ × 3'),
      },
    ],
    source: {
      kind: 'generator',
      generate: ({ level, rng, index }) => generateProportionSimple(level, rng, index),
    },
    review: 'objective',
    basis: '小学校学習指導要領（平成29年告示）算数 第5学年 C(1) 伴って変わる二つの数量の関係（簡単な場合についての比例の関係）',
    revised: REVISED,
  },
  'はり金《がね》 頭《あたま》 深《ふか》さ 深《ふか》く 深《ふか》 水《すい》そう 才《さい》 年《ねん》れい 色紙《いろがみ》 夜《よる》 昼《ひる》 姉《あね》 妹《いもうと》 重《かさ》ねた 走《はし》る 歩《ある》く 空《くう》らん 空《あ》いた 数《かず》 一方《いっぽう》 進《すす》む 本数《ほんすう》 列《れつ》',
);
