/**
 * g3.math.mult-1digit 2・3位数×1位数の筆算（curriculum-matrix 3.6）。
 * 何十・何百×1位数 → 筆算（繰り上がりなし→あり）→ 3位数 → 文章題。
 *
 * 筆算は number の複数欄（答えの位ごと。大きい位から）。位ごとの入力から
 * 繰り上がりの足し忘れ・繰り上がりの数にもかける・位ごとの積を並べる・0の付け忘れ を誤概念に結ぶ。
 * 同一性キー: 'a x b'（かけられる数が多位数、かける数が1位数。向きは固定）。文章題は「場面 × 式」。
 * 定義域: 何十・何百 128、繰り上がりなし 約70、2位数 約500、3位数 約6000。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { columnFigure, digits, pickObj, placeFields, placeName, toFields, wrongList } from './util';

type Obj = 'tens' | 'nocarry' | 'carry' | 'three' | 'bunshou';

const hasCarry = (a: number, b: number) => {
  let c = 0;
  for (const d of digits(a)) {
    const p = d * b + c;
    c = Math.floor(p / 10);
    if (c > 0) return true;
  }
  return false;
};

/** 繰り上がりを足し忘れた答え（一番上の位は積をそのまま書く） */
function carryForget(a: number, b: number): number {
  const ds = digits(a);
  let s = String(ds[ds.length - 1]! * b);
  for (let i = ds.length - 2; i >= 0; i--) s += String((ds[i]! * b) % 10);
  return Number(s);
}
/** 繰り上がった数を足してから かけた答え */
function carryMult(a: number, b: number): number {
  const ds = digits(a);
  let c = 0;
  const out: string[] = [];
  ds.forEach((d, i) => {
    const p = (d + c) * b;
    out.unshift(i === ds.length - 1 ? String(p) : String(p % 10));
    c = Math.floor(p / 10);
  });
  return Number(out.join(''));
}
/** 位ごとの積を並べた答え */
function concat(a: number, b: number): number {
  return Number(
    digits(a)
      .map((d) => String(d * b))
      .reverse()
      .join(''),
  );
}
/** 一の位だけ かけて、ほかの位は そのまま書いた答え */
function onesOnly(a: number, b: number): number {
  return Math.floor(a / 10) * 10 + (a % 10) * b;
}

function steps(a: number, b: number): string[] {
  const ds = digits(a);
  let c = 0;
  return ds.map((d, i) => {
    const p = d * b + c;
    const line = `${placeName(i)}: ${d} × ${b}${c ? ` ＝ ${d * b}、くり上《あ》がりの ${c}を たして ${p}` : ` ＝ ${p}`}${p >= 10 && i < ds.length - 1 ? `（${p % 10}を 書《か》いて ${Math.floor(p / 10)} くり上《あ》げる）` : ''}`;
    c = Math.floor(p / 10);
    return line;
  });
}

function wrongs(a: number, b: number, n: number): NumberItem['wrongAnswers'] {
  const ans = a * b;
  const f = (v: number) => (n === 1 ? String(v) : toFields(v, n));
  return wrongList(n === 1 ? String(ans) : toFields(ans, n)!, n, [
    [f(carryForget(a, b)), 'carry-forget'],
    [f(carryMult(a, b)), 'carry-mult'],
    [f(concat(a, b)), 'concat'],
    [f(onesOnly(a, b)), 'ones-only'],
    [f(a + b), 'wrong-op'],
  ]);
}

function pick(rng: Rng, kind: 'nocarry' | 'carry' | 'three'): [number, number] {
  for (;;) {
    const b = rng.int(2, 9);
    if (kind === 'nocarry') {
      const a = rng.next() < 0.6 ? rng.int(11, 99) : rng.int(111, 999);
      if (!hasCarry(a, b) && a % 10 !== 0) return [a, b];
    } else if (kind === 'carry') {
      const a = rng.int(12, 99);
      if (hasCarry(a, b) && a % 10 !== 0) return [a, b];
    } else {
      const a = rng.int(101, 999);
      if (hasCarry(a, b) && a % 10 !== 0) return [a, b];
    }
  }
}

const blocks = (a: number, b: number): Figure => {
  const hundreds = a >= 100;
  const t = hundreds ? a / 100 : a / 10;
  return {
    kind: 'row',
    items: Array.from({ length: b }, () =>
      hundreds
        ? ({ kind: 'blocks', hundreds: t, ones: 0 } as Figure)
        : ({ kind: 'blocks', tens: t, ones: 0 } as Figure),
    ),
    gap: 6,
  };
};

function tens(level: number, rng: Rng, alt: boolean): NumberItem {
  const hundreds = rng.next() < 0.5;
  const t = rng.int(2, 9);
  const b = rng.int(2, 9);
  const a = t * (hundreds ? 100 : 10);
  const unit = hundreds ? 100 : 10;
  return {
    engine: 'number',
    id: `tens${alt ? '-alt' : ''}:${a}x${b}`,
    objective: 'tens',
    level,
    prompt: alt
      ? `${unit}の まとまりが ${t}こずつ、${b}つ あります。全部《ぜんぶ》で いくつですか。`
      : '計算《けいさん》しよう。',
    figure: alt ? blocks(a, b) : { kind: 'text', text: `${a} × ${b} ＝ {{}}`, size: 'xl' },
    hints: [
      `${a}は ${unit}が ${t}こ だね。`,
      `${unit}の まとまりが ${t} × ${b} こ に なるよ。`,
      `${t} × ${b} ＝ ${t * b}。${unit}が ${t * b}こで…`,
    ],
    explain: `${a} × ${b} は ${unit}が ${t} × ${b} ＝ ${t * b}こ。だから ${a * b}です。`,
    identity: `${a}x${b}`,
    alt,
    fields: [{ answer: { kind: 'int', value: a * b } }],
    wrongAnswers: wrongList(String(a * b), 1, [
      [t * b, 'zero-drop'],
      [hundreds ? t * b * 10 : t * b * 100, 'zero-drop'],
      [a + b, 'wrong-op'],
    ]),
  };
}

function calc(obj: Obj, level: number, a: number, b: number, alt: boolean): NumberItem {
  const ans = a * b;
  const st = steps(a, b);
  const hints = [
    '一《いち》のくらいから じゅんに かけて いこう。',
    `${st[0]!.replace(/（.*$/, '')}。`,
    'くり上《あ》がった 数《かず》は、つぎの くらいの かけ算《ざん》の 答《こた》えに たそう（かける 前《まえ》に たさない）。',
  ];
  const explain = `${st.join('。')}。答《こた》えは ${ans}です。`;
  if (alt)
    return {
      engine: 'number',
      id: `${obj}-alt:${a}x${b}`,
      objective: obj,
      level,
      prompt:
        '横《よこ》書《が》きの 式《しき》を 筆算《ひっさん》に なおして 計算《けいさん》しよう。',
      figure: { kind: 'text', text: `${a} × ${b} ＝ {{}}`, size: 'xl' },
      hints,
      explain,
      explainFigure: columnFigure(a, b, '×', String(ans).length),
      identity: `${a}x${b}`,
      alt: true,
      fields: [{ answer: { kind: 'int', value: ans } }],
      wrongAnswers: wrongs(a, b, 1),
    };
  const fields = placeFields(ans);
  return {
    engine: 'number',
    id: `${obj}:${a}x${b}`,
    objective: obj,
    level,
    prompt: '筆算《ひっさん》で 計算《けいさん》しよう。答《こた》えを くらいごとに 書《か》こう。',
    figure: columnFigure(a, b, '×', fields.length),
    hints,
    explain,
    identity: `${a}x${b}`,
    alt: false,
    fields,
    wrongAnswers: wrongs(a, b, fields.length),
  };
}

interface Scene {
  id: string;
  unit: string;
  times: boolean;
  text: (a: number, b: number) => string;
}
/** 文章題の場面（1つ分×いくつ分 5、何倍 3） */
const SCENES: Scene[] = [
  {
    id: 'notebook',
    unit: '円《えん》',
    times: false,
    text: (a, b) =>
      `1さつ ${a}円《えん》の ノートを ${b}さつ 買《か》います。代金《だいきん》は 何《なん》円《えん》ですか。`,
  },
  {
    id: 'boxes',
    unit: 'こ',
    times: false,
    text: (a, b) =>
      `1はこに ${a}こ 入《はい》った あめが ${b}はこ あります。あめは 全部《ぜんぶ》で 何《なん》こですか。`,
  },
  {
    id: 'seats',
    unit: '人《にん》',
    times: false,
    text: (a, b) =>
      `1台《だい》の バスに ${a}人《にん》ずつ 乗《の》ります。${b}台《だい》では 何《なん》人《にん》 乗《の》れますか。`,
  },
  {
    id: 'pages',
    unit: 'ページ',
    times: false,
    text: (a, b) =>
      `毎日《まいにち》 ${a}ページずつ 本《ほん》を 読《よ》みます。${b}日《にち》で 何《なん》ページ 読《よ》めますか。`,
  },
  {
    id: 'ribbon',
    unit: 'cm',
    times: false,
    text: (a, b) =>
      `1本《ぽん》 ${a}cmの リボンを ${b}本《ほん》 つなぎます（つなぎめの 長《なが》さは 考《かんが》えない）。全部《ぜんぶ》で 何《なん》cmですか。`,
  },
  {
    id: 'tape',
    unit: 'cm',
    times: true,
    text: (a, b) =>
      `赤《あか》い テープの 長《なが》さは ${a}cmです。青《あお》い テープの 長《なが》さは、赤《あか》い テープの ${b}倍《ばい》です。青《あお》い テープは 何《なん》cmですか。`,
  },
  {
    id: 'weight',
    unit: 'g',
    times: true,
    text: (a, b) =>
      `子《こ》ねこの 体重《たいじゅう》は ${a}gです。親《おや》ねこの 体重《たいじゅう》は その ${b}倍《ばい》です。親《おや》ねこは 何《なん》gですか。`,
  },
  {
    id: 'savings',
    unit: '円《えん》',
    times: true,
    text: (a, b) =>
      `妹《いもうと》の ちょ金《きん》は ${a}円《えん》です。姉《あね》の ちょ金《きん》は 妹《いもうと》の ${b}倍《ばい》です。姉《あね》は 何《なん》円《えん》ですか。`,
  },
];

function word(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = SCENES[rng.int(0, SCENES.length - 1)]!;
  const [a, b] = pick(rng, rng.next() < 0.5 ? 'carry' : 'three');
  const ans = a * b;
  return {
    engine: 'number',
    id: `bunshou${alt ? '-alt' : ''}:${sc.id}:${a}x${b}`,
    objective: 'bunshou',
    level,
    prompt: sc.text(a, b),
    figure: alt
      ? {
          kind: 'tape',
          parts: Array.from({ length: b }, (_, i) => ({
            length: a,
            label: i === 0 ? String(a) : '',
            tone: i === 0 ? ('a' as const) : ('plain' as const),
          })),
          total: '？',
        }
      : undefined,
    hints: [
      sc.times
        ? '「〜の □倍《ばい》」は、もとの 長《なが》さを □こ あつめた 大《おお》きさ だね。'
        : '1つ分《ぶん》の 数《かず》と、いくつ分《ぶん》かを 見《み》つけよう。',
      `式《しき》は ${a} × ${b}。`,
      `${steps(a, b)[0]!.replace(/（.*$/, '')}。つづきも 筆算《ひっさん》で。`,
    ],
    explain: `式《しき》は ${a} × ${b} ＝ ${ans}。答《こた》えは ${ans}${sc.unit}です。`,
    explainFigure: columnFigure(a, b, '×', String(ans).length),
    identity: `${sc.id}:${a}x${b}`,
    alt,
    fields: [{ label: sc.unit, answer: { kind: 'int', value: ans } }],
    wrongAnswers: wrongs(a, b, 1),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['tens', 'nocarry'] },
  { objs: ['nocarry', 'carry', 'tens'] },
  { objs: ['carry', 'three'] },
  { objs: ['carry', 'three', 'bunshou'] },
];

export function generateMult1digit(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.25;
  if (obj === 'tens') return tens(level, rng, alt);
  if (obj === 'bunshou') return word(level, rng, alt);
  const [a, b] = pick(rng, obj);
  return calc(obj, level, a, b, alt);
}

export const mult1digit: UnitSpec = {
  id: 'g3.math.mult-1digit',
  title: '×1けたの 筆算《ひっさん》',
  stage: 'g3',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'math-formula-add',
  prereq: ['g3.math.mult-rules'],
  objectives: [
    { id: 'tens', title: '何十《なんじゅう》・何百《なんびゃく》 × 1けた' },
    { id: 'nocarry', title: 'くり上《あ》がりの ない 筆算《ひっさん》' },
    { id: 'carry', title: '2けた × 1けた（くり上《あ》がり あり）' },
    { id: 'three', title: '3けた × 1けた' },
    { id: 'bunshou', title: '文章題《ぶんしょうだい》（いくつ分《ぶん》・何倍《なんばい》）' },
  ],
  misconceptions: [
    {
      id: 'carry-forget',
      explain:
        'くり上《あ》がった 数《かず》を たすのを わすれたのかな。くり上《あ》がりは 小《ちい》さく メモして、つぎの くらいの 答《こた》えに たそう。',
      figure: {
        kind: 'text',
        text: '36 × 4: 6×4＝24（2 くり上げ）、3×4＝12、12＋2＝14 → 144',
        size: 'm',
      },
    },
    {
      id: 'carry-mult',
      explain:
        'くり上《あ》がった 数《かず》を 先《さき》に たしてから かけたのかな。かけ算《ざん》を してから、くり上《あ》がりを たすよ。',
    },
    {
      id: 'concat',
      explain:
        'くらいごとの かけ算《ざん》の 答《こた》えを そのまま ならべたのかな。10を こえたら、1つ 上《うえ》の くらいに くり上《あ》げよう。',
    },
    {
      id: 'ones-only',
      explain:
        '一《いち》のくらいだけ かけたのかな。かける数《かず》は、かけられる数《かず》の どの くらいにも かけるよ。',
    },
    {
      id: 'zero-drop',
      explain:
        '0の 数《かず》が あって いないのかな。40 × 3 は 10が 4 × 3 ＝ 12こ で 120。10の まとまりで 考《かんが》えよう。',
    },
    {
      id: 'wrong-op',
      explain:
        'たし算《ざん》を したのかな。おなじ 数《かず》が いくつ分《ぶん》 あるときは かけ算《ざん》だよ。',
    },
  ],
  levels: [
    { label: '何十×1けた・くり上がりなし', chance: 0.01 },
    { label: 'くり上がり あり', chance: 0.01 },
    { label: '3けた×1けた', chance: 0.01 },
    { label: '文章題', chance: 0.01 },
  ],
  intro: [
    {
      text: '40 × 3 は、10の まとまりが 4 × 3 ＝ 12こ。だから 120です。',
      figure: blocks(40, 3),
    },
    {
      text: '36 × 4 を 筆算《ひっさん》で します。くらいを そろえて 書《か》き、一《いち》のくらいから かけます。',
      figure: columnFigure(36, 4, '×', 3),
    },
    {
      text: '6 × 4 ＝ 24。4を 書《か》いて 2 くり上《あ》げ。3 × 4 ＝ 12、くり上《あ》がりの 2を たして 14。答《こた》えは 144。',
      figure: { kind: 'text', text: '36 × 4 ＝ 144', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateMult1digit(level, rng, index),
  },
  review: 'type',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第3学年 A(3) 乗法（2位数や3位数に1位数をかける乗法の計算と筆算）',
  revised: '2026-10-24',
};
