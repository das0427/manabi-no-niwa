/**
 * g4.math.decimal-add-sub 小数のしくみ（1/100・1/1000 の位）とたし算・ひき算（curriculum-matrix 3.7）。
 * 0.01 の意味 → 位をそろえる → 文章題。
 *
 * 小数は浮動小数点で計算しない（「0.01 が 何こ」の整数で持つ: util の dec）。答えは小数で（形式指定。2.4）。
 * 同一性キー: 式（a ＋ b と b ＋ a は同じ。交換はこの単元の学習内容ではない）。しくみは 形 × 数、文章題は 場面 × 式。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { NumberlineItem } from '../../engines/numberline/numberline';
import type { Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { dec, decAns, expr, finishUnit, pick, pickObj, REVISED, wrongList } from './util';

type Obj = 'units' | 'add' | 'sub' | 'align' | 'story';

/** 小数（値 v は 1/10^p が v こ） */
interface D {
  v: number;
  p: number;
}
const S = (x: D) => dec(x.v, x.p);
/** 2つを同じ位（1/10^P）に そろえた値 */
const at = (x: D, P: number) => x.v * 10 ** (P - x.p);

/** 筆算の形の表（小数点を そろえる） */
function columnFig(a: D, b: D, op: '＋' | '−'): Figure {
  const P = Math.max(a.p, b.p);
  const sa = S(a).split('.');
  const sb = S(b).split('.');
  const I = Math.max(sa[0]!.length, sb[0]!.length);
  const row = (s: string[]) => [
    ...s[0]!
      .padStart(I, ' ')
      .split('')
      .map((c) => (c === ' ' ? '' : c)),
    s[1] !== undefined ? '.' : '',
    ...(s[1] ?? '')
      .padEnd(P, ' ')
      .split('')
      .map((c) => (c === ' ' ? '' : c)),
  ];
  const fracNames = ['[[1/10]]の位', '[[1/100]]の位', '[[1/1000]]の位'];
  const intNames = ['一の位', '十の位', '百の位'];
  return {
    kind: 'table',
    header: [
      '',
      ...Array.from({ length: I }, (_, i) => intNames[I - 1 - i]!),
      '',
      ...fracNames.slice(0, P),
    ],
    rows: [
      ['', ...row(sa)],
      [op, ...row(sb)],
    ],
  };
}

/** a, b（a ≥ b のとき ひき算）の答えと誤りの例 */
function calcWrongs(a: D, b: D, op: 'add' | 'sub') {
  const P = Math.max(a.p, b.p);
  const A = at(a, P);
  const B = at(b, P);
  const ans = op === 'add' ? A + B : A - B;
  const answers = [decAns(ans, P)];
  // 右に そろえた（小数点を無視して 末尾を そろえた）
  const ra = Number(S(a).replace('.', ''));
  const rb = Number(S(b).replace('.', ''));
  const right = op === 'add' ? ra + rb : Math.abs(ra - rb);
  // 整数の部分だけ ひいて、小数の部分を そのまま おろした（5 − 2.36 → 3.36）
  const intOnly =
    op === 'sub' && a.p === 0
      ? dec(
          (A / 10 ** P - Math.floor(b.v / 10 ** b.p)) * 10 ** P +
            (b.v % 10 ** b.p) * 10 ** (P - b.p),
          P,
        )
      : null;
  return {
    ans,
    P,
    answers,
    wrongs: wrongList(answers, [
      [a.p !== b.p ? dec(right, P) : null, 'align-right'],
      [intOnly, 'int-only'],
      [String(ans), 'point-drop'],
      [dec(ans, P + 1), 'point-drop'],
      // くり上がり・くり下がりを わすれた（1/10 の位で）
      [
        op === 'add' && (A % 10 ** P) + (B % 10 ** P) >= 10 ** P ? dec(ans - 10 ** P, P) : null,
        'carry',
      ],
      [op === 'sub' && A % 10 ** P < B % 10 ** P ? dec(ans + 10 ** P, P) : null, 'carry'],
    ]),
  };
}

/** 小数 1つ（p けた。値は 0.1〜99.99 くらい） */
function decimalOf(rng: Rng, p: number, maxInt: number): D {
  for (;;) {
    const v = rng.int(1, (maxInt + 1) * 10 ** p - 1);
    if (p === 0 || v % 10 !== 0) return { v, p };
  }
}

/** 式の キー（交換は同じ） */
const key = (a: D, b: D, op: 'add' | 'sub') =>
  op === 'add' ? [S(a), S(b)].sort().join('+') : `${S(a)}-${S(b)}`;

function calc(obj: 'add' | 'sub' | 'align', level: number, rng: Rng, alt: boolean): NumberItem {
  const op: 'add' | 'sub' = obj === 'align' ? (rng.next() < 0.5 ? 'add' : 'sub') : obj;
  let a: D;
  let b: D;
  if (obj === 'align') {
    const pa = rng.int(0, 2);
    let pb = rng.int(1, 2);
    if (pb === pa) pb = pa === 1 ? 2 : 1;
    a = decimalOf(rng, pa, 9);
    b = decimalOf(rng, pb, 9);
  } else {
    const p = level === 0 ? 1 : rng.int(1, 2);
    a = decimalOf(rng, p, 9);
    b = decimalOf(rng, p, 9);
  }
  // ひき算は 大きい ほうから
  const P0 = Math.max(a.p, b.p);
  if (op === 'sub' && at(a, P0) <= at(b, P0)) {
    if (at(a, P0) === at(b, P0)) a = { v: a.v + 10 ** a.p, p: a.p };
    else [a, b] = [b, a];
  }
  const w = calcWrongs(a, b, op);
  const sym = op === 'add' ? '＋' : '−';
  const P = w.P;
  return {
    engine: 'number',
    id: `${obj}${alt ? '-alt' : ''}:${S(a)}${op === 'add' ? '+' : '-'}${S(b)}`,
    objective: obj,
    level,
    prompt: alt ? '筆算で 計算しよう。' : '計算しよう。',
    figure: alt ? columnFig(a, b, sym) : expr(`${S(a)} ${sym} ${S(b)} ＝ {{}}`),
    hints: [
      a.p !== b.p
        ? '小数点の 位置を たてに そろえて 書こう。'
        : '小数点を そろえて、整数と 同じように 計算しよう。',
      `${S(a)}は 0.${'0'.repeat(P - 1)}1が ${at(a, P)}こ、${S(b)}は ${at(b, P)}こ。`,
      `${at(a, P)} ${sym} ${at(b, P)}を 計算して、0.${'0'.repeat(P - 1)}1が いくつ分か 考えよう。`,
    ],
    explain: `0.${'0'.repeat(P - 1)}1が ${at(a, P)} ${sym} ${at(b, P)} ＝ ${w.ans}こ。${S(a)} ${sym} ${S(b)} ＝ ${dec(w.ans, P)}です。小数点を そろえて 計算します。`,
    explainFigure: columnFig(a, b, sym),
    identity: key(a, b, op),
    alt,
    fields: [{ answer: w.answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: w.wrongs,
  };
}

/** しくみ: 0.01 が いくつ・位の 数（alt: 数直線を 読む） */
function units(level: number, rng: Rng, alt: boolean): Item {
  if (alt) {
    const p = rng.int(2, 3);
    // 0.1（p=2）や 0.01（p=3）の はばを 10等分した 数直線
    const base = rng.int(1, 49) * 10; // 1/unit の 単位で、はしの値
    let k = rng.int(1, 9);
    if (k === 5) k = 4;
    const item: NumberlineItem = {
      engine: 'numberline',
      id: `units-alt:${dec(base, p)}:${k}`,
      objective: 'units',
      level,
      prompt: '↓の めもりが あらわす 小数は いくつ？',
      hints: [
        `${dec(base, p)}から ${dec(base + 10, p)}までを 10こに 分けて いるよ。`,
        `1めもりは ${dec(1, p)}。`,
        `${dec(base, p)}から ${k}めもり 進んだ ところだよ。`,
      ],
      explain: `1めもりは ${dec(1, p)}なので、${dec(base, p)}より ${dec(k, p)} 大きい ${dec(base + k, p)}です。`,
      identity: `units-line:${dec(base, p)}:${k}`,
      alt: true,
      line: {
        min: dec(base, p),
        max: dec(base + 10, p),
        minor: dec(1, p),
        majorEvery: 5,
        labels: [],
      },
      marks: [
        { at: dec(base, p), label: dec(base, p) },
        { at: dec(base + 10, p), label: dec(base + 10, p) },
      ],
      task: { kind: 'read', at: dec(base + k, p), keys: ['decimal'] },
      misconceptions: { minorAsOne: 'scale-one' },
    };
    return item;
  }
  const form = rng.int(0, 2);
  const p = level === 0 ? 2 : rng.int(2, 3);
  const v = decimalOf(rng, p, 9).v;
  const s = dec(v, p);
  const small = dec(1, p);
  if (form === 0) {
    // s は small が 何こ
    const answers = [{ kind: 'int' as const, value: v }];
    return {
      engine: 'number',
      id: `units:count:${s}`,
      objective: 'units',
      level,
      prompt: `${s}は ${small}を 何こ 集めた数ですか。`,
      hints: [
        `1は ${small}が ${10 ** p}こ だよ。`,
        `${s}の 小数点を とって 考えると…`,
        `${Math.floor(v / 10 ** p)}は ${small}が ${Math.floor(v / 10 ** p) * 10 ** p}こ。のこりの 分も たそう。`,
      ],
      explain: `1は ${small}が ${10 ** p}こ。${s}は ${small}が ${v}こ 集まった数です。`,
      identity: `units:count:${s}`,
      alt: false,
      fields: [{ answer: answers[0]! }],
      wrongAnswers: wrongList(answers, [
        [Math.floor(v / 10), 'unit-tenth'],
        [v % 10 ** p, 'unit-tenth'],
        [v * 10, 'unit-tenth'],
      ]),
    };
  }
  if (form === 1) {
    // small が v こで いくつ
    const answers = [decAns(v, p)];
    return {
      engine: 'number',
      id: `units:make:${s}`,
      objective: 'units',
      level,
      prompt: `${small}を ${v}こ 集めた数は いくつですか。`,
      hints: [
        `${small}が 10こで ${dec(10, p)}、100こで ${dec(100, p)}。`,
        `${v}こを 位ごとに 分けて 考えよう。`,
        `${v}の 数字を、いちばん右が ${small}の 位に なるように ならべよう。`,
      ],
      explain: `${small}が ${v}こで ${s}です。`,
      identity: `units:make:${s}`,
      alt: false,
      fields: [{ answer: answers[0]! }],
      keys: ['decimal'],
      wrongAnswers: wrongList(answers, [
        [dec(v, p - 1), 'unit-tenth'],
        [dec(v, p + 1), 'unit-tenth'],
        [v, 'point-drop'],
      ]),
    };
  }
  // 1 が □こ、0.1 が □こ、0.01 が □こ
  const digits = String(v)
    .padStart(p + 1, '0')
    .split('')
    .map(Number);
  const names = ['1', '0.1', '0.01', '0.001'];
  const intPart = Math.floor(v / 10 ** p);
  const parts = [
    `1を ${intPart}こ`,
    ...digits.slice(-p).map((dgt, i) => `${names[i + 1]}を ${dgt}こ`),
  ].filter((t) => !/を 0こ$/.test(t));
  const answers = [decAns(v, p)];
  return {
    engine: 'number',
    id: `units:compose:${s}`,
    objective: 'units',
    level,
    prompt: `${parts.join('、')} あわせた数は いくつですか。`,
    hints: [
      '1、0.1、0.01、0.001の 位に 数字を 書いて いこう。',
      'こが 0の 位には 0を 書くよ。',
      `一の位は ${intPart}。小数点の 右に つづけて 書こう。`,
    ],
    explain: `${parts.join('、')}で ${s}です。`,
    identity: `units:compose:${s}`,
    alt: false,
    fields: [{ answer: answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: wrongList(answers, [
      [s.includes('.') && s.split('.')[1]!.replace(/0/g, '') ? `.` : null, 'unit-zero'],
      [dec(v, p + 1), 'unit-tenth'],
    ]),
  };
}

interface Scene {
  id: string;
  op: 'add' | 'sub';
  unit: string;
  text: (a: string, b: string) => string;
}
const SCENES: Scene[] = [
  {
    id: 'juice',
    op: 'add',
    unit: 'L',
    text: (a, b) => `ジュースが ${a}L、お茶が ${b}L あります。あわせて 何Lですか。`,
  },
  {
    id: 'water',
    op: 'add',
    unit: 'L',
    text: (a, b) => `水そうに 水が ${a}L 入って います。そこへ ${b}L 入れると、何Lに なりますか。`,
  },
  {
    id: 'bag',
    op: 'add',
    unit: 'kg',
    text: (a, b) => `${a}kgの かばんに、${b}kgの 本を 入れました。全体の 重さは 何kgですか。`,
  },
  {
    id: 'road',
    op: 'add',
    unit: 'km',
    text: (a, b) =>
      `家から 学校まで ${a}km、学校から 公園まで ${b}kmです。家から 学校を 通って 公園まで 何kmですか。`,
  },
  {
    id: 'ribbon',
    op: 'sub',
    unit: 'm',
    text: (a, b) => `リボンが ${a}m あります。${b}m 使うと、のこりは 何mですか。`,
  },
  {
    id: 'sugar',
    op: 'sub',
    unit: 'kg',
    text: (a, b) => `さとうが ${a}kg あります。${b}kg 使うと、のこりは 何kgですか。`,
  },
  {
    id: 'tape',
    op: 'sub',
    unit: 'm',
    text: (a, b) => `赤い テープは ${a}m、青い テープは ${b}mです。ちがいは 何mですか。`,
  },
  {
    id: 'jump',
    op: 'sub',
    unit: 'm',
    text: (a, b) =>
      `はばとびで、はるさんは ${a}m、そうたさんは ${b}m とびました。はるさんの ほうが 何m 長く とびましたか。`,
  },
];

function story(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, SCENES);
  const pa = rng.int(1, 2);
  const pb = rng.int(1, 2);
  let a = decimalOf(rng, pa, 5);
  let b = decimalOf(rng, pb, 5);
  const P0 = Math.max(a.p, b.p);
  if (sc.op === 'sub' && at(a, P0) <= at(b, P0)) {
    if (at(a, P0) === at(b, P0)) a = { v: a.v + 10 ** a.p, p: a.p };
    else [a, b] = [b, a];
  }
  const w = calcWrongs(a, b, sc.op);
  const sym = sc.op === 'add' ? '＋' : '−';
  return {
    engine: 'number',
    id: `story${alt ? '-alt' : ''}:${sc.id}:${S(a)}${sym}${S(b)}`,
    objective: 'story',
    level,
    prompt: sc.text(S(a), S(b)),
    figure: alt
      ? {
          kind: 'tape',
          parts:
            sc.op === 'add'
              ? [
                  { length: 3, label: `${S(a)}${sc.unit}`, tone: 'a' },
                  { length: 2, label: `${S(b)}${sc.unit}`, tone: 'b' },
                ]
              : [
                  { length: 2, label: `${S(b)}${sc.unit}`, tone: 'b' },
                  { length: 3, label: '？', tone: 'muted' },
                ],
          total: sc.op === 'add' ? '？' : `${S(a)}${sc.unit}`,
        }
      : undefined,
    hints: [
      sc.op === 'add'
        ? 'あわせた 量を 求めるので たし算だね。'
        : 'のこりや ちがいを 求めるので ひき算だね。',
      `式は ${S(a)} ${sym} ${S(b)}。小数点を そろえよう。`,
      `0.${'0'.repeat(w.P - 1)}1の いくつ分で 考えると ${at(a, w.P)} ${sym} ${at(b, w.P)}。`,
    ],
    explain: `${S(a)} ${sym} ${S(b)} ＝ ${dec(w.ans, w.P)}。答えは ${dec(w.ans, w.P)}${sc.unit}です。`,
    explainFigure: columnFig(a, b, sym),
    identity: `story:${sc.id}:${key(a, b, sc.op)}`,
    alt,
    fields: [{ label: sc.unit, answer: w.answers[0]! }],
    keys: ['decimal'],
    wrongAnswers: w.wrongs,
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['units', 'add', 'sub'] },
  { objs: ['add', 'sub', 'align'] },
  { objs: ['align', 'story', 'units'] },
  { objs: ['story', 'align', 'add', 'sub'] },
];

export function generateDecimalAddSub(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'units':
      return units(level, rng, alt);
    case 'add':
    case 'sub':
    case 'align':
      return calc(obj, level, rng, alt);
    case 'story':
      return story(level, rng, alt);
  }
}

export const decimalAddSub: UnitSpec = finishUnit({
  id: 'g4.math.decimal-add-sub',
  title: '小数の しくみと たし算・ひき算',
  stage: 'g4',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'math-formula-add',
  prereq: ['g3.math.decimals'],
  objectives: [
    { id: 'units', title: '0.01・0.001の しくみ' },
    { id: 'add', title: '小数の たし算' },
    { id: 'sub', title: '小数の ひき算' },
    { id: 'align', title: '位の 数が ちがう 小数の 計算' },
    { id: 'story', title: '文章題' },
  ],
  misconceptions: [
    {
      id: 'align-right',
      explain:
        '数の 右はしを そろえて 計算したのかな。小数の たし算・ひき算は、小数点の 位置を そろえて、同じ 位どうしを 計算するよ。',
    },
    {
      id: 'int-only',
      explain:
        '整数の 部分だけ ひいて、小数の 部分を そのまま 書いたのかな。5は 5.00と 考えて、小数の 位も ひこう。',
    },
    {
      id: 'point-drop',
      explain:
        '小数点を 打つ 場所が ずれたのかな（または わすれたのかな）。上の 数の 小数点に そろえて 答えにも 小数点を 打とう。',
    },
    {
      id: 'carry',
      explain:
        'くり上がり・くり下がりを わすれたのかな。0.1が 10こで 1、0.01が 10こで 0.1に なるよ。',
    },
    {
      id: 'unit-tenth',
      explain:
        '0.1と 0.01（0.001）の 大きさを とりちがえたのかな。0.01が 10こで 0.1、100こで 1だよ。',
    },
    {
      id: 'unit-zero',
      explain: 'こが 0の 位を とばしたのかな。数字が ない 位にも 0を 書こう。',
    },
    {
      id: 'scale-one',
      explain:
        '1めもりの 大きさを たしかめよう。はしから はしまでを いくつに 分けて いるかを 見るよ。',
    },
  ],
  levels: [
    { label: 'しくみ・同じ 位の 計算', chance: 0.02 },
    { label: '位の ちがう 計算', chance: 0.02 },
    { label: '文章題', chance: 0.02 },
    { label: 'まとめ', chance: 0.02 },
  ],
  intro: [
    {
      text: '0.1を 10に 分けた 1つ分を 0.01と 書き、「れい点 れい一」と 読みます。0.01の 位を [[1/100]]の位と いいます。',
      figure: {
        kind: 'numberline',
        min: 0,
        max: 0.1,
        step: 0.01,
        labelEvery: 10,
        marks: [{ at: 0.01, label: '0.01', tone: 'focus' }],
      },
    },
    {
      text: '2.35は 1が 2こ、0.1が 3こ、0.01が 5こ。0.01が 235こ 集まった数とも いえます。',
      figure: expr('2.35'),
    },
    {
      text: '小数の たし算・ひき算は、小数点を たてに そろえて、整数と 同じように 計算します。',
      figure: columnFig({ v: 24, p: 1 }, { v: 135, p: 2 }, '＋'),
    },
    {
      text: '2.4 ＋ 1.35 ＝ 3.75。2.4を 2.40と 考えると わかりやすいです。',
      figure: expr('2.40 ＋ 1.35 ＝ 3.75'),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateDecimalAddSub(level, rng, index),
  },
  review: 'type',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第4学年 A(5) 小数の仕組みとその計算（1/100の位以下、加法・減法）',
  revised: REVISED,
});
