/**
 * g5.math.expressions 数量の関係を表す式（curriculum-matrix 3.8。設計: docs/expansion/p2-design/math-g56.md 1章）。
 * 場面 → □と ○の 式 → □に 数を 入れる → 変わり方（比例か）→ 式の中の数・記号の意味 → ○から □。
 *
 * 作り: fill だけの生成器（書き方は proportion-simple にそろえる）。種別は概念（基準 60）。
 * 同一性キー: 問う形 × 場面（または 式の種類）× 数 × □の値。別例は 表から・文章題・図と式の対応。
 * 数は 場面ごとの 定義域から 均等に 選ぶ（あとで ずらさない）。
 * 注意: fill の wrong.value には 辞書の よみが 付かないので、R() を 通して 入れる。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { FillBlank, FillItem } from '../../engines/fill/fill';
import type { Item, UnitSpec } from '../../curriculum/types';
import { makeRuby } from './ruby';
import { expr, finishUnit, pick, pickObj, REVISED, STROKE, svg, svgText } from './util';

type Kind = 'lin' | 'tri' | 'vol' | 'mul' | 'sum' | 'sub' | 'add';
type Obj = 'make' | 'value' | 'change' | 'meaning' | 'reverse';
type Sym = 'a' | 'b' | 'c' | 'd' | 'x' | 'y';

/** 場面の 数（使わない ものは 0） */
interface P {
  a: number;
  b: number;
  c: number;
  d: number;
}
const p4 = (o: Partial<P>): P => ({ a: 0, b: 0, c: 0, d: 0, ...o });

interface Scene {
  id: string;
  kind: Kind;
  text: (p: P) => string;
  /** 場面の 数（定義域）。ここから 均等に 選ぶ */
  params: P[];
  /** □ の 値（t）の 定義域 */
  ts: (p: P) => number[];
  /** 定数・□・○ の 役わり（9字ぐらいまで） */
  roles: Partial<Record<Sym, string>>;
  word: string;
  yUnit: string;
  askY: (t: number) => string;
  textY: string;
  askX: (y: number) => string;
  textX: string;
  /** 図と式の 対応（4場面だけ） */
  alt?: {
    shapeName: string;
    options: string[];
    /** 図の 記号 → 選択肢の 言葉 */
    roleOf: Partial<Record<Sym, string>>;
    pairs: [Sym, Sym][];
  };
}

const rng1 = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** 数のあとの「分」の 読み（proportion-simple の xn と同じ。1・3・4・6・8・0 で ぷん） */
const bun = (n: number) => `${n}分《${'134680'.includes(String(n).slice(-1)) ? 'ぷん' : 'ふん'}》`;

const SCENES: Scene[] = [
  {
    id: 'cookie',
    kind: 'lin',
    text: (p) =>
      `1まい ${p.a}円の クッキーを □まい 買って、${p.b}円の 箱に 入れます。代金の 合計を ○円と します。`,
    params: [40, 50, 60, 70, 80, 90].flatMap((a) => [100, 120, 150, 200].map((b) => p4({ a, b }))),
    ts: () => rng1(2, 9),
    roles: { a: '1まいの ねだん', b: '箱の ねだん', x: 'クッキーの まい数', y: '代金の 合計' },
    word: '代金の 合計 ＝ 1まいの ねだん × まい数 ＋ 箱の ねだん',
    yUnit: '円',
    askY: (t) => `クッキーを ${t}まい 買うと、代金の 合計は 何円ですか。`,
    textY: '代金の 合計は {{}}円',
    askX: (y) => `代金の 合計が ${y}円の とき、クッキーは 何まいですか。`,
    textX: 'クッキーは {{}}まい',
  },
  {
    id: 'tank',
    kind: 'lin',
    text: (p) =>
      `水そうに 深さ ${p.b}cmまで 水が 入って います。水を 入れると 1分間《ぷんかん》に ${p.a}cmずつ 深く なります。入れ始めてから □分《ふん》後《ご》の 深さを ○cmと します。`,
    params: [2, 3, 4, 5].flatMap((a) => [6, 8, 10, 12].map((b) => p4({ a, b }))),
    ts: () => rng1(2, 10),
    roles: { a: '1分《ぷん》で ふえる 深さ', b: 'はじめの 深さ', x: '時間', y: '深さ' },
    word: '深さ ＝ 1分《ぷん》で ふえる 深さ × 時間 ＋ はじめの 深さ',
    yUnit: 'cm',
    askY: (t) => `入れ始めてから ${bun(t)}後《ご》の 深さは 何cmですか。`,
    textY: '深さは {{}}cm',
    askX: (y) => `深さが ${y}cmに なるのは、入れ始めてから 何分《ぷん》後《ご》ですか。`,
    textX: '{{}}分《ふん》後《ご》',
  },
  {
    id: 'tri',
    kind: 'tri',
    text: (p) => `底辺が ${p.a}cmの 三角形が あります。高さを □cm、面積を ○cm²と します。`,
    params: [4, 6, 8, 10, 12, 14].map((a) => p4({ a })),
    ts: () => rng1(3, 12),
    roles: { a: '底辺', x: '高さ', y: '面積' },
    word: '三角形の 面積 ＝ 底辺 × 高さ ÷ 2',
    yUnit: 'cm²',
    askY: (t) => `高さが ${t}cmの とき、面積は 何cm²ですか。`,
    textY: '面積は {{}}cm²',
    askX: (y) => `面積が ${y}cm²の とき、高さは 何cmですか。`,
    textX: '高さは {{}}cm',
    alt: {
      shapeName: '三角形の 面積',
      options: ['底辺', '高さ', '面積'],
      roleOf: { a: '底辺', x: '高さ', y: '面積' },
      pairs: [
        ['a', 'x'],
        ['x', 'y'],
        ['a', 'y'],
      ],
    },
  },
  {
    id: 'box',
    kind: 'vol',
    text: (p) =>
      `たて ${p.a}cm、横 ${p.b}cmの 直方体が あります。高さを □cm、体積を ○cm³と します。`,
    params: (
      [
        [2, 3],
        [2, 5],
        [3, 4],
        [3, 5],
        [4, 5],
        [4, 6],
        [5, 6],
        [2, 7],
      ] as [number, number][]
    ).map(([a, b]) => p4({ a, b })),
    ts: () => rng1(2, 9),
    roles: { a: 'たての 長さ', b: '横の 長さ', x: '高さ', y: '体積' },
    word: '体積 ＝ たて × 横 × 高さ',
    yUnit: 'cm³',
    askY: (t) => `高さが ${t}cmの とき、体積は 何cm³ですか。`,
    textY: '体積は {{}}cm³',
    askX: (y) => `体積が ${y}cm³の とき、高さは 何cmですか。`,
    textX: '高さは {{}}cm',
    alt: {
      shapeName: '直方体の 体積',
      options: ['たて', '横', '高さ', '体積'],
      roleOf: { a: 'たて', b: '横', x: '高さ', y: '体積' },
      pairs: [
        ['a', 'x'],
        ['b', 'y'],
        ['x', 'y'],
      ],
    },
  },
  {
    id: 'garden',
    kind: 'mul',
    text: (p) =>
      `たてが ${p.a}mの 長方形の 花だんが あります。横の 長さを □m、面積を ○m²と します。`,
    params: rng1(3, 9).map((a) => p4({ a })),
    ts: () => rng1(4, 15),
    roles: { a: 'たての 長さ', x: '横の 長さ', y: '面積' },
    word: '長方形の 面積 ＝ たて × 横',
    yUnit: 'm²',
    askY: (t) => `横の 長さが ${t}mの とき、面積は 何m²ですか。`,
    textY: '面積は {{}}m²',
    askX: (y) => `面積が ${y}m²の とき、横の 長さは 何mですか。`,
    textX: '横は {{}}m',
    alt: {
      shapeName: '花だんの 面積',
      options: ['たて', '横', '面積'],
      roleOf: { a: 'たて', x: '横', y: '面積' },
      pairs: [
        ['a', 'x'],
        ['x', 'y'],
        ['a', 'y'],
      ],
    },
  },
  {
    id: 'cards',
    kind: 'sum',
    text: (p) =>
      `カードが ${p.c}まい あります。姉と 妹で 全部 分けます。姉の まい数を □まい、妹の まい数を ○まいと します。`,
    params: [12, 16, 18, 20, 24, 30].map((c) => p4({ c })),
    ts: (p) => rng1(1, p.c - 1),
    roles: { c: '全部の まい数', x: '姉の まい数', y: '妹の まい数' },
    word: '姉の まい数 ＋ 妹の まい数 ＝ 全部の まい数',
    yUnit: 'まい',
    askY: (t) => `姉が ${t}まいの とき、妹は 何まいですか。`,
    textY: '妹は {{}}まい',
    askX: (y) => `妹が ${y}まいの とき、姉は 何まいですか。`,
    textX: '姉は {{}}まい',
  },
  {
    id: 'ribbon',
    kind: 'sub',
    text: (p) => `長さ ${p.c}cmの リボンから □cm 切り取ります。残りの 長さを ○cmと します。`,
    params: [50, 60, 80, 90, 100, 120].map((c) => p4({ c })),
    ts: (p) => Array.from({ length: p.c / 5 - 1 }, (_, i) => (i + 1) * 5),
    roles: { c: 'はじめの 長さ', x: '切り取った 長さ', y: '残りの 長さ' },
    word: '残りの 長さ ＝ はじめの 長さ − 切り取った 長さ',
    yUnit: 'cm',
    askY: (t) => `${t}cm 切り取ると、残りは 何cmですか。`,
    textY: '残りは {{}}cm',
    askX: (y) => `残りが ${y}cmの とき、切り取った 長さは 何cmですか。`,
    textX: '切り取った 長さは {{}}cm',
    alt: {
      shapeName: 'リボンの 長さの 関係',
      options: ['はじめの 長さ', '切り取った 長さ', '残りの 長さ'],
      roleOf: { c: 'はじめの 長さ', x: '切り取った 長さ', y: '残りの 長さ' },
      pairs: [
        ['c', 'x'],
        ['x', 'y'],
        ['c', 'y'],
      ],
    },
  },
  {
    id: 'sticker',
    kind: 'add',
    text: (p) =>
      `シールを ${p.d}まい 持って います。きょう □まい もらうと、全部で ○まいに なります。`,
    params: [5, 8, 12, 15, 20].map((d) => p4({ d })),
    ts: () => rng1(1, 20),
    roles: { d: 'はじめの まい数', x: 'もらった まい数', y: '全部の まい数' },
    word: '全部の まい数 ＝ もらった まい数 ＋ はじめの まい数',
    yUnit: 'まい',
    askY: (t) => `${t}まい もらうと、全部で 何まいですか。`,
    textY: '全部で {{}}まい',
    askX: (y) => `全部で ${y}まいに なりました。何まい もらいましたか。`,
    textX: '{{}}まい もらった',
  },
];

/** 式 */
function formula(kind: Kind, p: P): string {
  switch (kind) {
    case 'lin':
      return `○ ＝ ${p.a} × □ ＋ ${p.b}`;
    case 'tri':
      return `○ ＝ ${p.a} × □ ÷ 2`;
    case 'vol':
      return `○ ＝ ${p.a} × ${p.b} × □`;
    case 'mul':
      return `○ ＝ ${p.a} × □`;
    case 'sum':
      return `□ ＋ ○ ＝ ${p.c}`;
    case 'sub':
      return `○ ＝ ${p.c} − □`;
    case 'add':
      return `○ ＝ □ ＋ ${p.d}`;
  }
}

/** □ = t の ときの ○ */
function f(kind: Kind, p: P, t: number): number {
  switch (kind) {
    case 'lin':
      return p.a * t + p.b;
    case 'tri':
      return (p.a * t) / 2;
    case 'vol':
      return p.a * p.b * t;
    case 'mul':
      return p.a * t;
    case 'sum':
    case 'sub':
      return p.c - t;
    case 'add':
      return t + p.d;
  }
}

/** 同一性キーに 使う 数（式の 種類ごと） */
function pkey(kind: Kind, p: P): string {
  switch (kind) {
    case 'lin':
    case 'vol':
      return `${p.a}:${p.b}`;
    case 'tri':
    case 'mul':
      return `${p.a}`;
    case 'sum':
    case 'sub':
      return `${p.c}`;
    case 'add':
      return `${p.d}`;
  }
}

/** この単元だけで使う語（g5 の辞書に無い・読みが違う語） */
const EXTRA =
  '水《すい》そう 花《か》だん まい数《すう》 入《い》れ始《はじ》めて 入《い》れ始《はじ》めてから 持《も》って 深《ふか》く 深《ふか》さ 切《き》り取《と》 切《き》り取《と》った 残《のこ》りの 役《やく》わり 順序《じゅんじょ》 取《と》りちがえ 一方《いっぽう》 結果《けっか》 記号《きごう》 言葉《ことば》 関係《かんけい》 箱《はこ》 姉《あね》 妹《いもうと》 確《たし》かめ 確《たし》かめよう 決《き》まった 決《き》まる 入《はい》った 文字《もじ》 結《むす》びつけ 結《むす》びつけよう 出《で》て 意味《いみ》';

const { R } = makeRuby(EXTRA);

// ---- 部品 ----
type W = { value: string; misconception: string };
/** 誤りの 選択肢（値には よみが 付かないので R を 通す） */
const wr = (value: string | number, misconception: string): W => ({
  value: R(String(value)),
  misconception,
});

/**
 * 数の 選択肢: 正答を 先頭に、候補のうち「正の整数・正答と ちがう・重ならない」ものを 4つまで。
 * 残った 候補だけ 誤概念つきの 誤りに なる。
 */
function numOpts(correct: number, cands: [number | null | undefined, string][]) {
  const options = [String(correct)];
  const wrong: W[] = [];
  for (const [v, m] of cands) {
    if (v === null || v === undefined || !Number.isInteger(v) || v <= 0 || v === correct) continue;
    const s = String(v);
    if (options.includes(s) || options.length >= 4) continue;
    options.push(s);
    wrong.push({ value: s, misconception: m });
  }
  return { options, wrong };
}

function tableFig(xs: number[], ys: number[]): Figure {
  return {
    kind: 'table',
    header: ['□', ...xs.map(String)],
    rows: [['○', ...ys.map(String)]],
  };
}

interface FillArgs {
  id: string;
  obj: Obj;
  level: number;
  alt: boolean;
  prompt: string;
  figure?: Figure;
  text: string;
  options: string[];
  blanks: FillBlank[];
  hints: [string, string, string];
  explain: string;
}
function fillItem(a: FillArgs): FillItem {
  return {
    engine: 'fill',
    id: a.id,
    objective: a.obj,
    level: a.level,
    prompt: a.prompt,
    ...(a.figure ? { figure: a.figure } : {}),
    hints: a.hints,
    explain: a.explain,
    identity: a.id,
    alt: a.alt,
    text: a.text,
    options: a.options,
    blanks: a.blanks,
  };
}

const ONE = (answer: string, wrong: W[], options?: string[]): FillBlank => ({
  answers: [answer],
  ...(options ? { options } : {}),
  wrong,
});

// ---- make: 場面（または 表）を 式に ----
function makeBlanks(kind: Kind, p: P): { text: string; options: string[]; blanks: FillBlank[] } {
  switch (kind) {
    case 'lin': {
      const o = [String(p.a), String(p.b), String(p.a + p.b)];
      return {
        text: '○ ＝ {{}} × □ ＋ {{}}',
        options: o,
        blanks: [
          ONE(String(p.a), [wr(p.b, 'swap-const'), wr(p.a + p.b, 'add-all')]),
          ONE(String(p.b), [wr(p.a, 'swap-const'), wr(p.a + p.b, 'add-all')]),
        ],
      };
    }
    case 'tri':
      return {
        text: `○ ＝ ${p.a} {{}} □ {{}} 2`,
        options: ['×', '＋', '÷'],
        blanks: [
          ONE('×', [wr('＋', 'add-mult')], ['×', '＋']),
          ONE('÷', [wr('×', 'tri-half')], ['÷', '×']),
        ],
      };
    case 'vol':
      return {
        text: `○ ＝ ${p.a} {{}} ${p.b} {{}} □`,
        options: ['×', '＋'],
        blanks: [ONE('×', [wr('＋', 'add-mult')]), ONE('×', [wr('＋', 'add-mult')])],
      };
    case 'mul':
      return {
        text: `○ ＝ ${p.a} {{}} □`,
        options: ['×', '＋', '÷'],
        blanks: [ONE('×', [wr('＋', 'add-mult'), wr('÷', 'reverse-op')])],
      };
    case 'sum':
      return {
        text: '□ {{}} ○ ＝ {{}}',
        options: [String(p.c), String(p.c / 2)],
        blanks: [
          ONE('＋', [wr('×', 'add-mult'), wr('−', 'sum-diff')], ['＋', '×', '−']),
          ONE(String(p.c), [wr(p.c / 2, 'equal-split')]),
        ],
      };
    case 'sub':
      return {
        text: `○ ＝ ${p.c} {{}} □`,
        options: ['−', '＋', '×'],
        blanks: [ONE('−', [wr('＋', 'sum-diff'), wr('×', 'add-mult')])],
      };
    case 'add':
      return {
        text: `○ ＝ □ {{}} ${p.d}`,
        options: ['＋', '−', '×'],
        blanks: [ONE('＋', [wr('−', 'sum-diff'), wr('×', 'add-mult')])],
      };
  }
}

function makeHint3(kind: Kind, p: P): string {
  switch (kind) {
    case 'lin':
      return `○ ＝ ${p.a} × □ ＋ … あとから たすのは 何《なに》かな。`;
    case 'tri':
      return `${p.a} と □ を かけて、それを …`;
    case 'vol':
      return 'たて、横、高さを どう 計算すると 体積に なるかな。';
    case 'mul':
      return 'たて と 横を どう 計算すると 面積に なるかな。';
    case 'sum':
      return '姉と 妹を 合わせると いつも 同じ 数に なるね。';
    case 'sub':
      return '切り取ると 残りは ふえるかな、へるかな。';
    case 'add':
      return 'もらうと 全部の まい数は ふえるかな、へるかな。';
  }
}

function make(level: number, rng: Rng, alt: boolean): FillItem {
  if (alt) {
    // 表から 式に（box は 表から a と b を 分けられないので 除く）
    const sc = pick(
      rng,
      SCENES.filter((s) => s.id !== 'box'),
    );
    const p = pick(rng, sc.params);
    const xs = sc.kind === 'tri' ? [2, 4, 6, 8, 10] : [1, 2, 3, 4, 5];
    const ys = xs.map((x) => f(sc.kind, p, x));
    const b = makeBlanks(sc.kind, p);
    const hint3: Record<Kind, string> = {
      lin: `□が 1 ふえると ○は ${p.a} ふえるね。□が 1の とき、${p.a} × 1 ＝ ${p.a}。${ys[0]}との ちがいは …`,
      tri: `${p.a} × ${xs[0]} ＝ ${p.a * xs[0]!}。○は その 何分《なんぶん》の いくつかな。`,
      vol: 'たて × 横 を 先に 計算してみよう。',
      mul: '○ ÷ □ は いつも 同じ 数だね。',
      sum: '□と ○を たすと、いつも 同じ 数に なるね。',
      sub: '□が ふえると ○は へって いるね。',
      add: '○ − □ は いつも 同じ 数だね。',
    };
    return fillItem({
      id: `make-alt:${sc.kind}:${pkey(sc.kind, p)}`,
      obj: 'make',
      level,
      alt: true,
      prompt: '表は、□と ○の 関係を 調べた ものです。□と ○の 関係を 式に 表そう。',
      figure: tableFig(xs, ys),
      ...b,
      hints: [
        '□が ふえると ○は どう 変わるかな。',
        `□が ${xs[0]}の とき ○は ${ys[0]}、□が ${xs[1]}の とき ○は ${ys[1]}。`,
        hint3[sc.kind],
      ],
      explain: `表から、${formula(sc.kind, p)} の 関係に なって います。`,
    });
  }
  const sc = pick(rng, SCENES);
  const p = pick(rng, sc.params);
  const b = makeBlanks(sc.kind, p);
  return fillItem({
    id: `make:${sc.id}:${pkey(sc.kind, p)}`,
    obj: 'make',
    level,
    alt: false,
    prompt: `${sc.text(p)}\n□と ○の 関係を 式に 表そう。`,
    ...b,
    hints: [
      '□と ○が 何を 表して いるかを 確かめよう。',
      `言葉の 式に すると「${sc.word}」だね。`,
      makeHint3(sc.kind, p),
    ],
    explain: `「${sc.word}」なので、式は ${formula(sc.kind, p)} です。`,
  });
}

// ---- value / reverse の 共通 ----
function valueCands(kind: Kind, p: P, t: number): [number, string][] {
  const { a, b, c, d } = p;
  switch (kind) {
    case 'lin':
      return [
        [a * t, 'stop-midway'],
        [a * (t + b), 'order-ops'],
        [(a + b) * t, 'add-all'],
      ];
    case 'tri':
      return [
        [a * t, 'tri-half'],
        [a + t, 'add-mult'],
      ];
    case 'vol':
      return [
        [(a + b) * t, 'add-mult'],
        [a * b, 'stop-midway'],
        [a * b + t, 'add-mult'],
      ];
    case 'mul':
      return [
        [a + t, 'add-mult'],
        [2 * (a + t), 'perimeter'],
      ];
    case 'sum':
      return [
        [c + t, 'sum-diff'],
        [c / 2, 'equal-split'],
      ];
    case 'sub':
      return [
        [c + t, 'sum-diff'],
        [t, 'swap-var'],
      ];
    case 'add':
      return [
        [t * d, 'add-mult'],
        [Math.abs(t - d), 'sum-diff'],
      ];
  }
}

function valueHint3(kind: Kind, p: P, t: number): string {
  switch (kind) {
    case 'lin':
      return `${p.a} × ${t} ＝ ${p.a * t}。これに ${p.b}を …`;
    case 'tri':
      return `${p.a} × ${t} ＝ ${p.a * t}。これを …`;
    case 'vol':
      return `${p.a} × ${p.b} ＝ ${p.a * p.b}。これに ${t}を …`;
    case 'mul':
      return `${p.a} × ${t}を 計算しよう。`;
    case 'sum':
      return `○は ${p.c} − ${t}で 求められるよ。`;
    case 'sub':
      return `${p.c} − ${t}を 計算しよう。`;
    case 'add':
      return `${t} ＋ ${p.d}を 計算しよう。`;
  }
}

/** □ に t を 入れた 式（答えの 欄の 前まで） */
function substText(kind: Kind, p: P, t: number): string {
  switch (kind) {
    case 'lin':
      return `○ ＝ ${p.a} × ${t} ＋ ${p.b}`;
    case 'tri':
      return `○ ＝ ${p.a} × ${t} ÷ 2`;
    case 'vol':
      return `○ ＝ ${p.a} × ${p.b} × ${t}`;
    case 'mul':
      return `○ ＝ ${p.a} × ${t}`;
    case 'sum':
      return `${t} ＋ ○ ＝ ${p.c}`;
    case 'sub':
      return `○ ＝ ${p.c} − ${t}`;
    case 'add':
      return `○ ＝ ${t} ＋ ${p.d}`;
  }
}

function value(level: number, rng: Rng, alt: boolean): FillItem {
  const sc = pick(rng, SCENES);
  const p = pick(rng, sc.params);
  const t = pick(rng, sc.ts(p));
  const y = f(sc.kind, p, t);
  const { options, wrong } = numOpts(y, valueCands(sc.kind, p, t));
  const sub = substText(sc.kind, p, t);
  const blanks = [ONE(String(y), wrong)];
  const exp =
    sc.kind === 'sum'
      ? `${t} ＋ ○ ＝ ${p.c} なので、○ ＝ ${p.c} − ${t} ＝ ${y}。`
      : `□に ${t}を 入れると、${sub} ＝ ${y}。○は ${y}です。`;
  if (alt) {
    return fillItem({
      id: `value-alt:${sc.id}:${pkey(sc.kind, p)}:${t}`,
      obj: 'value',
      level,
      alt: true,
      prompt: `${sc.text(p)}\n${sc.askY(t)}`,
      text: sc.textY,
      options,
      blanks,
      hints: [
        `□と ○の 関係を 式に して みよう。言葉の 式は「${sc.word}」。`,
        `式は ${formula(sc.kind, p)}。□に ${t}を 入れよう。`,
        valueHint3(sc.kind, p, t),
      ],
      explain: `式は ${formula(sc.kind, p)}。□に ${t}を 入れて、○ ＝ ${y}。答えは ${y}${sc.yUnit}です。`,
    });
  }
  return fillItem({
    id: `value:${sc.id}:${pkey(sc.kind, p)}:${t}`,
    obj: 'value',
    level,
    alt: false,
    prompt: `式 ${formula(sc.kind, p)} で、□が ${t}の とき ○は いくつですか。`,
    text: sc.kind === 'sum' ? `${t} ＋ ○ ＝ ${p.c}\n○ ＝ {{}}` : `${sub} ＝ {{}}`,
    options,
    blanks,
    hints: [
      `式の □に ${t}を 入れよう。`,
      sc.kind === 'sum' ? `${t} ＋ ○ ＝ ${p.c}` : sub,
      valueHint3(sc.kind, p, t),
    ],
    explain: exp,
  });
}

// ---- change: 変わり方 ----
/** step: □が 増えると ○は どう 変わるか */
function stepSpec(kind: Kind, p: P) {
  const { a, b, c, d } = p;
  // 増える ステップ（tri は 2、ほかは 1）、変化量、増減、選択肢
  switch (kind) {
    case 'lin':
      return {
        step: 1,
        delta: a,
        up: true,
        text: '□が 1 ふえると、○は {{}} ふえる',
        wrong: [
          [b, 'swap-const'],
          [a + b, 'add-all'],
        ] as [number, string][],
        why: `式の「${a} × □」の ${a}が 1つ分の ふえ方だよ。`,
      };
    case 'tri':
      return {
        step: 2,
        delta: a,
        up: true,
        text: '□が 2 ふえると、○は {{}} ふえる',
        wrong: [
          [2 * a, 'tri-half'],
          [2, 'add-mult'],
        ] as [number, string][],
        why: `${a} × 2 ÷ 2 ＝ ${a}。`,
      };
    case 'vol':
      return {
        step: 1,
        delta: a * b,
        up: true,
        text: '□が 1 ふえると、○は {{}} ふえる',
        wrong: [
          [a + b, 'add-mult'],
          [1, 'add-mult'],
        ] as [number, string][],
        why: `${a} × ${b} ＝ ${a * b} ずつ ふえるよ。`,
      };
    case 'mul':
      return {
        step: 1,
        delta: a,
        up: true,
        text: '□が 1 ふえると、○は {{}} ふえる',
        wrong: [
          [1, 'add-mult'],
          [a + 1, 'add-all'],
        ] as [number, string][],
        why: `式の ${a}が 1つ分の ふえ方だよ。`,
      };
    case 'add':
      return {
        step: 1,
        delta: 1,
        up: true,
        text: '□が 1 ふえると、○は {{}} ふえる',
        wrong: [
          [d, 'swap-const'],
          [d + 1, 'add-all'],
        ] as [number, string][],
        why: 'たした 結果も 1 ふえるよ。',
      };
    case 'sum':
      return {
        step: 1,
        delta: 1,
        up: false,
        text: '□が 1 ふえると、○は 1 {{}}',
        wrong: [],
        why: `合わせた 数が いつも ${c}なので、一方が ふえると もう一方は へるよ。`,
      };
    case 'sub':
      return {
        step: 1,
        delta: 1,
        up: false,
        text: '□が 1 ふえると、○は 1 {{}}',
        wrong: [],
        why: `${c}から ひく 数が ふえるので、残りは へるよ。`,
      };
  }
}

const IS_PROP: Record<Kind, boolean> = {
  lin: false,
  tri: true,
  vol: true,
  mul: true,
  sum: false,
  sub: false,
  add: false,
};

function changeItem(
  level: number,
  idHead: string,
  alt: boolean,
  kind: Kind,
  p: P,
  form: 'step' | 'prop',
  sceneId: string | null,
): FillItem {
  const prompt = alt
    ? '表は、□と ○の 関係を 調べた ものです。'
    : form === 'step'
      ? `${formula(kind, p)} の 式で、□が ふえると ○は どう 変わりますか。`
      : `${formula(kind, p)} の 式で 表される □と ○の 関係を 考えよう。`;
  const xs = kind === 'tri' ? [2, 4, 6, 8, 10] : [1, 2, 3, 4, 5];
  const figure = alt
    ? tableFig(
        xs,
        xs.map((x) => f(kind, p, x)),
      )
    : expr(formula(kind, p));
  const sp = stepSpec(kind, p);
  if (form === 'step') {
    const x1 = kind === 'tri' ? 2 : 1;
    const x2 = kind === 'tri' ? 4 : 2;
    const key = alt
      ? `${idHead}:step:${kind}:${pkey(kind, p)}`
      : `${idHead}:step:${sceneId}:${stepKey(kind, p)}`;
    const dir = sp.up ? 'ふえ' : 'へり';
    // 別例（表）は 式を 見せないので、表の 読み方だけで 説明する
    const exp = alt
      ? `表で、□が ${sp.step} ふえる ごとに、○は ${sp.delta}ずつ ${sp.up ? 'ふえて' : 'へって'} います。`
      : `□が ${sp.step} ふえると、○は ${sp.delta} ${dir}ます。${sp.why}`;
    let options: string[];
    let blanks: FillBlank[];
    if (kind === 'sum' || kind === 'sub') {
      options = ['へる', 'ふえる'];
      blanks = [ONE('へる', [wr('ふえる', 'sum-diff')])];
    } else {
      const wrongs: W[] = [];
      const opts2 = [String(sp.delta)];
      for (const [v, m] of sp.wrong) {
        const s = String(v);
        if (v === sp.delta || opts2.includes(s)) continue;
        opts2.push(s);
        wrongs.push({ value: s, misconception: m });
      }
      options = opts2;
      blanks = [ONE(String(sp.delta), wrongs)];
    }
    return fillItem({
      id: key,
      obj: 'change',
      level,
      alt,
      prompt,
      figure,
      text: sp.text,
      options,
      blanks,
      hints: [
        alt
          ? '表を 横に 見て、○の 変わり方を 調べよう。'
          : '□が ふえる 前と あとの ○を くらべよう。',
        `□が ${x1}の とき ○は ${f(kind, p, x1)}、□が ${x2}の とき ○は ${f(kind, p, x2)}。`,
        `${f(kind, p, x2)}と ${f(kind, p, x1)}の ちがいを 考えよう。`,
      ],
      explain: exp,
    });
  }
  // prop: 比例か どうか
  const yes = IS_PROP[kind];
  const key = alt ? `${idHead}:prop:${kind}:${pkey(kind, p)}` : `${idHead}:prop:${sceneId}`;
  const [u, v] = kind === 'tri' ? [2, 4] : [1, 2];
  const h3 =
    kind === 'tri'
      ? `${f(kind, p, 2)}の 2倍は ${2 * f(kind, p, 2)}。${f(kind, p, 4)}と くらべよう。`
      : `${f(kind, p, 1)}の 2倍は ${2 * f(kind, p, 1)}。${f(kind, p, 2)}と くらべよう。`;
  return fillItem({
    id: key,
    obj: 'change',
    level,
    alt,
    prompt,
    figure,
    text: '○は □に 比例 {{}}',
    options: ['する', 'しない'],
    blanks: [ONE(yes ? 'する' : 'しない', [wr(yes ? 'しない' : 'する', 'prop-judge')])],
    hints: [
      '□が 2倍に なると、○も 2倍に なるかを 調べよう。',
      `□が ${u}の とき ○は ${f(kind, p, u)}、□が ${v}の とき ○は ${f(kind, p, v)}。`,
      h3,
    ],
    explain: yes
      ? '□が 2倍、3倍に なると ○も 2倍、3倍に なるので、比例します。○ ＝ 決まった 数 × □ の 形の 式は 比例です。'
      : `□が 1の とき ○は ${f(kind, p, 1)}、2の とき ${f(kind, p, 2)}で、2倍に なって いないので、比例しません。`,
  });
}

/** change:step の キーに 使う 数（答えに 関わる ものだけ） */
function stepKey(kind: Kind, p: P): string {
  switch (kind) {
    case 'lin':
    case 'vol':
      return `${p.a}:${p.b}`;
    case 'tri':
    case 'mul':
      return `${p.a}`;
    case 'add':
      return `${p.d}`;
    default:
      return 'none';
  }
}

function change(level: number, rng: Rng, alt: boolean): FillItem {
  const sc = pick(rng, SCENES);
  const p = pick(rng, sc.params);
  const form = rng.next() < 0.5 ? 'step' : 'prop';
  return changeItem(level, alt ? 'change-alt' : 'change', alt, sc.kind, p, form, sc.id);
}

// ---- meaning: 式の 中の 数や 記号の 意味 ----
function symText(sym: Sym, p: P): string {
  switch (sym) {
    case 'x':
      return '□';
    case 'y':
      return '○';
    default:
      return String(p[sym]);
  }
}

function meaning(level: number, rng: Rng, alt: boolean): FillItem {
  if (alt) return meaningAlt(level, rng);
  const sc = pick(rng, SCENES);
  const p = pick(rng, sc.params);
  const syms = (Object.keys(sc.roles) as Sym[]).sort(
    (s, t) => 'abcdxy'.indexOf(s) - 'abcdxy'.indexOf(t),
  );
  const target = pick(rng, syms);
  const roleOpts = syms.map((s) => sc.roles[s]!);
  const right = sc.roles[target]!;
  const wrong = syms
    .filter((s) => s !== target)
    .map((s) =>
      wr(sc.roles[s]!, 'abcd'.includes(target) && 'abcd'.includes(s) ? 'swap-const' : 'swap-var'),
    );
  const tt = symText(target, p);
  return fillItem({
    id: `meaning:${sc.id}:${target}`,
    obj: 'meaning',
    level,
    alt: false,
    prompt: `${sc.text(p)}\nこの 関係を ${formula(sc.kind, p)} と 表しました。`,
    figure: expr(formula(sc.kind, p)),
    text: `${tt} は {{}}`,
    options: roleOpts,
    blanks: [ONE(right, wrong)],
    hints: [
      '式の 中で、その 数や 記号が どこに あるかを 見よう。',
      `言葉の 式は「${sc.word}」。`,
      '言葉の 式と 数の 式を 上下に ならべて、同じ 場所に ある ものを さがそう。',
    ],
    explain: `${formula(sc.kind, p)} は「${sc.word}」を 表して いるので、${tt}は「${right}」です。`,
  });
}

// ---- meaning-alt: 図と 式を 結びつける ----
function shapeSvg(id: string, p: P): Figure {
  const DASH = 'stroke="var(--ink)" stroke-width="2" stroke-dasharray="6 4"';
  switch (id) {
    case 'tri':
      return svg(
        260,
        180,
        `<polygon points="30,150 230,150 90,30" fill="var(--sky)" ${STROKE}/>` +
          `<line x1="90" y1="30" x2="90" y2="150" ${DASH}/>` +
          `<polyline points="90,140 100,140 100,150" fill="none" stroke="var(--ink)" stroke-width="1.5"/>` +
          svgText(130, 168, `${p.a}cm`) +
          svgText(98, 95, '□cm', 16, 'start') +
          svgText(135, 122, '○cm²'),
        '三角形の 底辺と 高さの 図',
      );
    case 'box':
      return svg(
        260,
        200,
        `<rect x="40" y="70" width="140" height="100" fill="var(--sky)" ${STROKE}/>` +
          `<polygon points="40,70 80,40 220,40 180,70" fill="var(--sky)" fill-opacity="0.6" ${STROKE}/>` +
          `<polygon points="180,70 220,40 220,140 180,170" fill="var(--sky)" fill-opacity="0.35" ${STROKE}/>` +
          svgText(110, 186, `${p.b}cm`) +
          svgText(206, 166, `${p.a}cm`, 16, 'start') +
          svgText(226, 92, '□cm', 16, 'start') +
          svgText(110, 120, '○cm³'),
        '直方体の 図',
      );
    case 'garden':
      return svg(
        260,
        180,
        `<rect x="40" y="30" width="180" height="110" fill="var(--sky)" ${STROKE}/>` +
          svgText(34, 85, `${p.a}m`, 16, 'end') +
          svgText(130, 158, '□m') +
          svgText(130, 85, '○m²'),
        '長方形の 花だんの 図',
      );
    default:
      return svg(
        300,
        110,
        `<rect x="20" y="40" width="130" height="30" fill="var(--sun)" ${STROKE}/>` +
          `<rect x="150" y="40" width="130" height="30" fill="var(--sky)" ${STROKE}/>` +
          `<line x1="150" y1="36" x2="150" y2="74" ${DASH}/>` +
          `<line x1="20" y1="24" x2="280" y2="24" ${STROKE}/>` +
          `<line x1="20" y1="18" x2="20" y2="30" ${STROKE}/>` +
          `<line x1="280" y1="18" x2="280" y2="30" ${STROKE}/>` +
          svgText(150, 10, `${p.c}cm`) +
          svgText(85, 90, '□cm') +
          svgText(215, 90, '○cm'),
        'リボンを 切り取る 図',
      );
  }
}

function meaningAlt(level: number, rng: Rng): FillItem {
  const sc = pick(
    rng,
    SCENES.filter((s) => s.alt),
  );
  const alt = sc.alt!;
  const p = pick(rng, sc.params);
  const [s1, s2] = pick(rng, alt.pairs);
  const mk = (s: Sym): FillBlank => {
    const right = alt.roleOf[s]!;
    return ONE(
      right,
      alt.options
        .filter((o) => o !== right)
        .map((o) =>
          wr(
            o,
            'abc'.includes(s) && o === alt.roleOf[s === 'a' ? 'b' : 'a'] && sc.id === 'box'
              ? 'swap-const'
              : 'swap-var',
          ),
        ),
    );
  };
  const t1 = symText(s1, p);
  const t2 = symText(s2, p);
  return fillItem({
    id: `meaning-alt:${sc.id}:${s1}${s2}`,
    obj: 'meaning',
    level,
    alt: true,
    prompt: `図の ${alt.shapeName}を、式 ${formula(sc.kind, p)} で 表しました。`,
    figure: { kind: 'column', items: [shapeSvg(sc.id, p), expr(formula(sc.kind, p))] },
    text: `${t1} は {{}}、${t2} は {{}}`,
    options: alt.options,
    blanks: [mk(s1), mk(s2)],
    hints: [
      '図の 中で、その 数や 記号が 書いて ある 場所を さがそう。',
      `言葉の 式は「${sc.word}」。`,
      '図の 文字と 式の 数を 1つずつ 結びつけよう。',
    ],
    explain: `図で ${t1}は ${alt.roleOf[s1]}、${t2}は ${alt.roleOf[s2]}の ところに あります。式は「${sc.word}」を 表して います。`,
  });
}

// ---- reverse: ○から □ ----
function reverseCands(kind: Kind, p: P, y: number): [number | null, string][] {
  const { a, b, c, d } = p;
  const div = (n: number, m: number) => (n % m === 0 ? n / m : null);
  switch (kind) {
    case 'lin':
      return [
        [y - b, 'stop-midway'],
        [div(y + b, a), 'reverse-op'],
        [div(y, a), 'stop-midway'],
      ];
    case 'tri':
      return [
        [div(y, a), 'tri-half'],
        [y - a, 'add-mult'],
        [y * 2, 'stop-midway'],
      ];
    case 'vol':
      return [
        [div(y, a + b), 'add-mult'],
        [y - a * b, 'add-mult'],
      ];
    case 'mul':
      return [
        [y * a, 'reverse-op'],
        [y - a, 'add-mult'],
      ];
    case 'sum':
    case 'sub':
      return [
        [c + y, 'sum-diff'],
        [y, 'swap-var'],
      ];
    case 'add':
      return [
        [y + d, 'reverse-op'],
        [y, 'swap-var'],
      ];
  }
}

function reverseSteps(kind: Kind, p: P, y: number): { h2: string; h3: string } {
  const { a, b, c, d } = p;
  switch (kind) {
    case 'lin':
      return { h2: `${a} × □ ＝ ${y} − ${b}`, h3: `□ ＝ (${y} − ${b}) ÷ ${a}` };
    case 'tri':
      return { h2: `${a} × □ ＝ ${y} × 2`, h3: `□ ＝ ${y} × 2 ÷ ${a}` };
    case 'vol':
      return { h2: `${a * b} × □ ＝ ${y}`, h3: `□ ＝ ${y} ÷ ${a * b}` };
    case 'mul':
      return { h2: `${a} × □ ＝ ${y}`, h3: `□ ＝ ${y} ÷ ${a}` };
    case 'sum':
      return { h2: '□は、全部から ○を ひいた 数だね。', h3: `□ ＝ ${c} − ${y}` };
    case 'sub':
      return { h2: '□は、はじめの 長さから 残りを ひいた 数だね。', h3: `□ ＝ ${c} − ${y}` };
    case 'add':
      return { h2: `□ ＋ ${d} ＝ ${y}`, h3: `□ ＝ ${y} − ${d}` };
  }
}

function reverseLine(kind: Kind, p: P, y: number): string {
  switch (kind) {
    case 'lin':
      return `${y} ＝ ${p.a} × □ ＋ ${p.b}`;
    case 'tri':
      return `${y} ＝ ${p.a} × □ ÷ 2`;
    case 'vol':
      return `${y} ＝ ${p.a} × ${p.b} × □`;
    case 'mul':
      return `${y} ＝ ${p.a} × □`;
    case 'sum':
      return `□ ＋ ${y} ＝ ${p.c}`;
    case 'sub':
      return `${y} ＝ ${p.c} − □`;
    case 'add':
      return `${y} ＝ □ ＋ ${p.d}`;
  }
}

function reverse(level: number, rng: Rng, alt: boolean): FillItem {
  const sc = pick(rng, SCENES);
  const p = pick(rng, sc.params);
  const t = pick(rng, sc.ts(p));
  const y = f(sc.kind, p, t);
  const { options, wrong } = numOpts(t, reverseCands(sc.kind, p, y));
  const st = reverseSteps(sc.kind, p, y);
  const exp = `${st.h3} ＝ ${t}。たしかめ: □に ${t}を 入れると ○は ${y}に なります。`;
  if (alt) {
    return fillItem({
      id: `reverse-alt:${sc.id}:${pkey(sc.kind, p)}:${t}`,
      obj: 'reverse',
      level,
      alt: true,
      prompt: `${sc.text(p)}\n${sc.askX(y)}`,
      text: sc.textX,
      options,
      blanks: [ONE(String(t), wrong)],
      hints: [
        `言葉の 式は「${sc.word}」。`,
        `式は ${formula(sc.kind, p)}。○に ${y}を 入れよう。`,
        st.h3,
      ],
      explain: `${exp}答えは ${sc.id === 'tank' ? `${bun(t)}後《ご》` : `${t}${unitOfX(sc.id)}`}です。`,
    });
  }
  return fillItem({
    id: `reverse:${sc.id}:${pkey(sc.kind, p)}:${t}`,
    obj: 'reverse',
    level,
    alt: false,
    prompt: `式 ${formula(sc.kind, p)} で、○が ${y}の とき、□は いくつですか。`,
    text: `${reverseLine(sc.kind, p, y)}\n□ ＝ {{}}`,
    options,
    blanks: [ONE(String(t), wrong)],
    hints: ['○に 数が 入った 式から、□を 求めるよ。', st.h2, st.h3],
    explain: exp,
  });
}

function unitOfX(id: string): string {
  switch (id) {
    case 'cookie':
    case 'cards':
    case 'sticker':
      return 'まい';
    case 'garden':
      return 'm';
    default:
      return 'cm';
  }
}

// ---- 段階 ----
const LEVELS: { objs: Obj[] }[] = [
  { objs: ['make', 'value'] },
  { objs: ['change', 'make', 'value'] },
  { objs: ['meaning', 'reverse', 'change'] },
  { objs: ['make', 'value', 'change', 'meaning', 'reverse'] },
];

export function generateExpressions(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'make':
      return make(level, rng, alt);
    case 'value':
      return value(level, rng, alt);
    case 'change':
      return change(level, rng, alt);
    case 'meaning':
      return meaning(level, rng, alt);
    case 'reverse':
      return reverse(level, rng, alt);
  }
}

export const expressions: UnitSpec = finishUnit(
  {
    id: 'g5.math.expressions',
    title: '□と ○の 式（数量の 関係）',
    stage: 'g5',
    subject: 'math',
    domain: 'A-number',
    kind: 'concept',
    priority: 'P2',
    status: 'ready',
    icon: 'math-formula-add',
    prereq: ['g4.math.change-relations'],
    objectives: [
      { id: 'make', title: '場面を □と ○の 式に 表す' },
      { id: 'value', title: '□に 数を 入れて ○を 求める' },
      { id: 'change', title: '式から 変わり方を 読む（比例か どうか）' },
      { id: 'meaning', title: '式の 中の 数や 記号の 意味を 読む' },
      { id: 'reverse', title: '○から □を 求める' },
    ],
    misconceptions: [
      {
        id: 'add-mult',
        explain:
          'たし算と かけ算を 取りちがえたのかな。「1つ分が ○ずつ」ふえる ときは かけ算、「はじめから ある 分」を 合わせる ときは たし算で 表すよ。',
      },
      {
        id: 'swap-const',
        explain:
          '式の 中の 2つの 数を 入れかえたのかな。□に かける 数は「1つ分の 大きさ」、あとから たす 数は「はじめから ある 分」だよ。',
      },
      {
        id: 'add-all',
        explain:
          '出て きた 数を 全部 たしたのかな。それぞれの 数が 何を 表して いるかを 考えよう。',
      },
      {
        id: 'order-ops',
        explain:
          '計算の 順序《じゅんじょ》を まちがえたのかな。× を 先に 計算してから ＋ を するよ。',
      },
      {
        id: 'stop-midway',
        explain: '計算の とちゅうで 止まったのかな。式に ある 計算を 全部 したか 見直そう。',
      },
      {
        id: 'tri-half',
        explain: '三角形の 面積の「÷ 2」を わすれたのかな。三角形の 面積は 底辺 × 高さ ÷ 2 だよ。',
      },
      {
        id: 'sum-diff',
        explain:
          'ふえる 関係と へる 関係を 取りちがえたのかな。□が ふえた とき ○が ふえるか へるかを、場面で 確かめよう。',
      },
      {
        id: 'equal-split',
        explain: '同じ 数ずつ 分けると 考えたのかな。□が 決まると、○は「全部 − □」で 決まるよ。',
      },
      {
        id: 'swap-var',
        explain:
          '□と ○（や 決まった 数）の 役わりを 取りちがえたのかな。□が 何を、○が 何を 表すかを 確かめよう。',
      },
      {
        id: 'reverse-op',
        explain:
          '○から □を 求める ときは、式と 反対の 計算を するよ。× の 反対は ÷、＋ の 反対は − だよ。',
      },
      {
        id: 'prop-judge',
        explain:
          '比例かどうかは、□が 2倍、3倍に なると ○も 2倍、3倍に なるかで 決めるよ。ふえるだけでは 比例とは かぎらないよ。',
      },
      {
        id: 'perimeter',
        explain:
          '面積を 求めるのに、まわりの 長さの ように たしたのかな。長方形の 面積は たて × 横 だよ。',
      },
    ],
    levels: [
      { label: '式に 表す・あてはめる', chance: 0.05 },
      { label: '変わり方', chance: 0.05 },
      { label: '式を 読む・○から □', chance: 0.03 },
      { label: 'まとめ', chance: 0.03 },
    ],
    intro: [
      {
        text: '1まい 60円の クッキーを 何まいか 買って、100円の 箱に 入れます。まい数と 代金の 合計を 表に しました。',
        figure: {
          kind: 'table',
          header: ['まい数 □', '1', '2', '3', '4'],
          rows: [['代金 ○（円）', '160', '220', '280', '340']],
        },
      },
      {
        text: 'まい数を □、代金の 合計を ○と すると、○ ＝ 60 × □ ＋ 100 と 表せます。',
        figure: expr('○ ＝ 60 × □ ＋ 100'),
      },
      {
        text: '□が 1 ふえると、○は 60 ふえます。式の 60は「1まいの ねだん」、100は「箱の ねだん」を 表して います。',
        figure: expr('□ ＋ 1 → ○ ＋ 60'),
      },
    ],
    source: {
      kind: 'generator',
      generate: ({ level, rng, index }) => generateExpressions(level, rng, index),
    },
    review: 'objective',
    basis:
      '小学校学習指導要領（平成29年告示）算数 第5学年 A(6) 数量の関係を表す式（二つの数量の対応や変わり方に着目し、簡単な式で表されている関係について考察する）',
    revised: REVISED,
  },
  EXTRA,
);
