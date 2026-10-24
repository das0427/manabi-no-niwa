/**
 * g2.math.length 長さの単位（mm・cm・m）、ものさし、見当（curriculum-matrix 3.5）。
 * cm の目盛り → mm → m と cm・単位を選ぶ。
 *
 * 同一性キー: 問う形 × 長さ（mm または cm の値）。単位を選ぶ問題は物 × 長さ。
 * 定義域: ものさし 1〜11cm9mm、1mものさし 1m〜1m99cm、単位の換算・計算は数百通り。
 */
import type { Rng } from '../../core/util/rng';
import type { MeasureItem } from '../../engines/measure/measure';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { pickObj, wrongList } from './util';

type Obj = 'read' | 'draw' | 'convert' | 'unit' | 'calc';

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['read', 'draw'] },
  { objs: ['read', 'draw', 'convert', 'unit'] },
  { objs: ['convert', 'unit', 'calc', 'read'] },
];

/** 0〜12cm のものさし（基準 mm、cm の数字） */
const RULER = {
  unit: 'mm',
  min: 0,
  max: 120,
  minor: 1,
  mid: 5,
  major: 10,
  labelFactor: 10,
  labelUnit: 'cm',
} as const;

/** 1m のものさし（基準 cm、0〜2m。数字は 10cm ごと） */
const METER = { unit: 'cm', min: 0, max: 200, minor: 1, mid: 5, major: 10 } as const;

const cmmm = (v: number) => {
  const c = Math.floor(v / 10);
  const m = v % 10;
  return m === 0 ? `${c}cm` : c === 0 ? `${m}mm` : `${c}cm${m}mm`;
};
const mcm = (v: number) => {
  const m = Math.floor(v / 100);
  const c = v % 100;
  return c === 0 ? `${m}m` : m === 0 ? `${c}cm` : `${m}m${c}cm`;
};

/** ものさしを よむ（alt: 0 から はじまらない／1m ものさし） */
function read(level: number, rng: Rng, alt: boolean): MeasureItem {
  if (alt && rng.next() < 0.5) {
    // 1m ものさし（m と cm）
    const v = rng.int(101, 199);
    return {
      engine: 'measure',
      id: `read-alt:m:${v}`,
      objective: 'read',
      level,
      prompt: 'ひもの ながさは なんm なんcm？（1めもりは 1cm）',
      hints: [
        '100cmで 1m だよ。',
        'ひもは 1mより ながいね。1mの ところから さきを よもう。',
        `1mと、のこりは なんcm かな。`,
      ],
      explain: `100cmが 1m。のこりが ${v - 100}cmで、${mcm(v)}（${v}cm）です。`,
      identity: `read-m:${v}`,
      alt: true,
      instrument: 'ruler',
      scale: { ...METER },
      task: 'read',
      value: v,
      object: 'tape',
      fields: [
        { unit: 'm', factor: 100 },
        { unit: 'cm', factor: 1 },
      ],
      misconceptions: { fieldSwap: 'unit-swap' },
      wrongAnswers: [{ value: 10 + (v - 100), misconception: 'factor' }],
    };
  }
  let v: number;
  // 0から はじまらない ときは、ものさしに おさまる ながさ（〜10cm9mm）
  do v = rng.int(11, alt ? 109 : 119);
  while (v % 10 === 0);
  const from = alt ? rng.int(1, Math.floor((120 - v) / 10)) * 10 : 0;
  const c = Math.floor(v / 10);
  const m = v % 10;
  return {
    engine: 'measure',
    id: `read${alt ? '-alt' : ''}:${from}:${v}`,
    objective: 'read',
    level,
    prompt: alt
      ? 'えんぴつの ながさは なんcm なんmm？ はしが 0では ないよ。'
      : 'テープの ながさは なんcm なんmm？',
    hints: alt
      ? [
          `ひだりの はしは ${from / 10}cmの めもりに あるよ。`,
          `${from / 10}cmから 1cm、2cm、…と かぞえよう。`,
          `${c}cmと、ちいさい めもりが いくつ かな。`,
        ]
      : [
          'ひだりの はしは 0に そろって いるよ。',
          `みぎの はしの ちかくの ${c}cmの めもりを みよう。`,
          `${c}cmから ちいさい めもり（1mm）が いくつ ぶん かな。`,
        ],
    explain: alt
      ? `${from / 10}cmから かぞえて ${c}cmと ${m}mm。${cmmm(v)}です。`
      : `${c}cmと、ちいさい めもり ${m}つで ${m}mm。${cmmm(v)}です。`,
    identity: alt ? `read-from:${v}` : `read:${v}`,
    alt,
    instrument: 'ruler',
    scale: { ...RULER },
    task: 'read',
    value: v,
    from: alt ? from : undefined,
    object: alt ? 'pencil' : 'tape',
    fields: [
      { unit: 'cm', factor: 10 },
      { unit: 'mm', factor: 1 },
    ],
    misconceptions: { fieldSwap: 'unit-swap', fromEnd: 'from-end' },
  };
}

/** せんを ひく（目盛りに合わせる） */
function draw(level: number, rng: Rng, alt: boolean): MeasureItem {
  let v: number;
  do v = rng.int(11, 119);
  while (v % 10 === 0);
  const c = Math.floor(v / 10);
  const m = v % 10;
  return {
    engine: 'measure',
    id: `draw${alt ? '-alt' : ''}:${v}`,
    objective: 'draw',
    level,
    prompt: alt
      ? `${v}mmの せんを ひこう。おわりの めもりを タップしてね。`
      : `${cmmm(v)}の せんを ひこう。おわりの めもりを タップしてね。`,
    hints: alt
      ? [
          '10mmで 1cm だよ。',
          `${v}mmは ${c}cmと ${m}mm。`,
          `${c}cmの めもりから ちいさい めもり ${m}つ…`,
        ]
      : [
          'せんは 0から はじまるよ。',
          `${c}cmの ながい めもりを さがそう。`,
          `${c}cmから ちいさい めもり ${m}つ ぶん すすもう。`,
        ],
    explain: `0から ${c}cmと ${m}mmの ところまでで ${cmmm(v)}（${v}mm）です。`,
    identity: alt ? `draw-mm:${v}` : `draw:${v}`,
    alt,
    instrument: 'ruler',
    scale: { ...RULER },
    task: 'set',
    value: v,
    object: 'line',
    wrongAnswers: [
      ...(m * 10 + c !== v && m * 10 + c <= 120 && m !== 0
        ? [{ value: m * 10 + c, misconception: 'unit-swap' }]
        : []),
      ...(alt ? [] : [{ value: c * 10, misconception: 'ignore-mm' }]),
    ],
  };
}

/** たんいの かんけい（換算） */
function convert(level: number, rng: Rng, alt: boolean): NumberItem {
  const form = rng.int(0, 3);
  if (form === 0) {
    // □cm□mm → mm
    let v: number;
    do v = rng.int(11, 199);
    while (v % 10 === 0);
    const c = Math.floor(v / 10);
    const m = v % 10;
    return {
      engine: 'number',
      id: `convert:cmmm-mm:${v}`,
      objective: 'convert',
      level,
      prompt: '□に あう かずは？',
      figure: { kind: 'text', text: `${c}cm${m}mm ＝ □mm`, size: 'xl' },
      hints: ['1cmは 10mm だよ。', `${c}cmは ${c * 10}mm。`, `${c * 10}mmと ${m}mmを あわせよう。`],
      explain: `1cm ＝ 10mm なので ${c}cm ＝ ${c * 10}mm。${c * 10} ＋ ${m} ＝ ${v}で ${v}mmです。`,
      identity: `cmmm-mm:${v}`,
      alt,
      fields: [{ label: 'mm', answer: { kind: 'int', value: v } }],
      wrongAnswers: wrongList(String(v), 1, [
        [c + m, 'digit-sum'],
        [c * 100 + m, 'factor'],
      ]),
    };
  }
  if (form === 1) {
    // mm → □cm□mm
    let v: number;
    do v = rng.int(11, 199);
    while (v % 10 === 0);
    const c = Math.floor(v / 10);
    const m = v % 10;
    return {
      engine: 'number',
      id: `convert:mm-cmmm:${v}`,
      objective: 'convert',
      level,
      prompt: '□に あう かずは？',
      figure: { kind: 'text', text: `${v}mm ＝ □cm□mm`, size: 'xl' },
      fields: [
        { label: 'cm', answer: { kind: 'int', value: c } },
        { label: 'mm', answer: { kind: 'int', value: m } },
      ],
      hints: [
        '10mmで 1cm だよ。',
        `${v}mmの なかに 10mmは いくつ あるかな。`,
        `${c * 10}mmで ${c}cm。のこりは？`,
      ],
      explain: `${v}mm ＝ ${c * 10}mm ＋ ${m}mm ＝ ${c}cm${m}mm です。`,
      identity: `mm-cmmm:${v}`,
      alt,
      wrongAnswers: wrongList(`${c}|${m}`, 2, [
        [`${m}|${c}`, 'unit-swap'],
        [`${v}|0`, 'factor'],
      ]),
    };
  }
  if (form === 2) {
    // □m□cm → cm
    let v: number;
    do v = rng.int(101, 299);
    while (v % 100 === 0);
    const mm = Math.floor(v / 100);
    const c = v % 100;
    return {
      engine: 'number',
      id: `convert:mcm-cm:${v}`,
      objective: 'convert',
      level,
      prompt: '□に あう かずは？',
      figure: { kind: 'text', text: `${mm}m${c}cm ＝ □cm`, size: 'xl' },
      hints: [
        '1mは 100cm だよ。',
        `${mm}mは ${mm * 100}cm。`,
        `${mm * 100}cmと ${c}cmを あわせよう。`,
      ],
      explain: `1m ＝ 100cm なので ${mm}m ＝ ${mm * 100}cm。${mm * 100} ＋ ${c} ＝ ${v}で ${v}cmです。`,
      identity: `mcm-cm:${v}`,
      alt,
      fields: [{ label: 'cm', answer: { kind: 'int', value: v } }],
      wrongAnswers: wrongList(String(v), 1, [
        [mm * 10 + c, 'factor'],
        [Number(`${mm}${c}`), c < 10 ? 'factor' : 'concat'],
        [Number(`${mm}0${c}`) !== v ? Number(`${mm}0${c}`) : null, 'concat'],
      ]),
    };
  }
  // cm → □m□cm
  let v: number;
  do v = rng.int(101, 299);
  while (v % 100 === 0);
  const mm = Math.floor(v / 100);
  const c = v % 100;
  return {
    engine: 'number',
    id: `convert:cm-mcm:${v}`,
    objective: 'convert',
    level,
    prompt: '□に あう かずは？',
    figure: { kind: 'text', text: `${v}cm ＝ □m□cm`, size: 'xl' },
    fields: [
      { label: 'm', answer: { kind: 'int', value: mm } },
      { label: 'cm', answer: { kind: 'int', value: c } },
    ],
    hints: [
      '100cmで 1m だよ。',
      `${v}cmの なかに 100cmは いくつ あるかな。`,
      `${mm * 100}cmで ${mm}m。のこりは？`,
    ],
    explain: `${v}cm ＝ ${mm * 100}cm ＋ ${c}cm ＝ ${mm}m${c}cm です。`,
    identity: `cm-mcm:${v}`,
    alt,
    wrongAnswers: wrongList(`${mm}|${c}`, 2, [
      [`${Math.floor(v / 10)}|${v % 10}`, 'factor'],
      [`${c}|${mm}`, 'unit-swap'],
    ]),
  };
}

/** ものの長さに合う単位 */
const THINGS: { name: string; len: number; unit: 'mm' | 'cm' | 'm' }[] = [
  { name: 'ノートの よこの ながさ', len: 18, unit: 'cm' },
  { name: 'えんぴつの ながさ', len: 17, unit: 'cm' },
  { name: 'けしゴムの あつさ', len: 9, unit: 'mm' },
  { name: 'ありの ながさ', len: 5, unit: 'mm' },
  { name: 'きょうしつの よこの ながさ', len: 9, unit: 'm' },
  { name: 'プールの ながさ', len: 25, unit: 'm' },
  { name: 'つくえの たかさ', len: 64, unit: 'cm' },
  { name: '1円《えん》玉《だま》の さしわたし', len: 20, unit: 'mm' },
  { name: 'はがきの たての ながさ', len: 15, unit: 'cm' },
  { name: 'バスの ながさ', len: 11, unit: 'm' },
  { name: 'ボタンの さしわたし', len: 12, unit: 'mm' },
  { name: 'ノートの あつさ', len: 5, unit: 'mm' },
  { name: 'こうしゃの たかさ', len: 15, unit: 'm' },
  { name: 'スプーンの ながさ', len: 14, unit: 'cm' },
];

function unit(level: number, rng: Rng, alt: boolean): ChoiceItem {
  if (alt) {
    // 単位の ちがう ながさを くらべる（いちばん ながい もの）
    // 3つの ながさ（cm で 30〜190）を、cm・mm・m と cm の 3つの かきかたで
    let x: number;
    let y: number;
    let z: number;
    do {
      x = rng.int(30, 190);
      y = rng.int(30, 99);
      z = rng.int(101, 190);
    } while (new Set([x, y, z]).size < 3);
    const vals = [
      { label: `${x}cm`, v: x },
      { label: `${y * 10}mm`, v: y },
      { label: mcm(z), v: z },
    ];
    const top = vals.reduce((p, q) => (q.v > p.v ? q : p));
    const bigNum = vals.reduce((p, q) =>
      Number.parseInt(q.label) > Number.parseInt(p.label) ? q : p,
    );
    return {
      engine: 'choice',
      id: `unit-alt:${x}:${y}:${z}`,
      objective: 'unit',
      level,
      prompt: 'いちばん ながいのは どれ？',
      hints: [
        'たんいを そろえて くらべよう。cmに そろえると くらべやすいよ。',
        '1mは 100cm、10mmは 1cm だよ。',
        `${y * 10}mmは ${y}cm、${mcm(z)}は ${z}cm。`,
      ],
      explain: `cmに そろえると ${x}cm、${y}cm、${z}cm。いちばん ながいのは ${top.label}です。`,
      identity: `unit-compare:${x}:${y}:${z}`,
      alt: true,
      options: vals.map((x) =>
        x === top
          ? { label: x.label, correct: true }
          : { label: x.label, misconception: x === bigNum ? 'compare-number-only' : 'unit-size' },
      ),
    };
  }
  const t = THINGS[rng.int(0, THINGS.length - 1)]!;
  return {
    engine: 'choice',
    id: `unit:${t.name}`,
    objective: 'unit',
    level,
    prompt: `${t.name}は ${t.len}□。□に あう たんいは どれ？`,
    hints: [
      '1mm・1cm・1mの ながさを おもいうかべよう。',
      '1cmは ゆびの はばくらい、1mは りょうてを ひろげた くらい。',
      `${t.len}こ ぶん ならべると どの くらいかな。`,
    ],
    explain: `${t.name}は ${t.len}${t.unit}くらい です。`,
    identity: `unit:${t.name}`,
    alt: false,
    fixedOrder: true,
    options: (['mm', 'cm', 'm'] as const).map((u) =>
      u === t.unit ? { label: u, correct: true } : { label: u, misconception: 'unit-size' },
    ),
  };
}

/** ながさの けいさん（同じ たんいどうしで） */
function calc(level: number, rng: Rng, alt: boolean): NumberItem {
  const add = rng.next() < 0.6;
  const big = rng.next() < 0.3; // m と cm
  const base = big ? 100 : 10;
  const [U, u] = big ? ['m', 'cm'] : ['cm', 'mm'];
  // b は半分を「何cm（何m）ちょうど」にする（単位を そろえない誤りが 見える）
  const whole = rng.next() < 0.5;
  let a: number;
  let b: number;
  do {
    a = rng.int(base + 1, base * 9 - 1);
    b = whole ? rng.int(1, 4) * base : rng.int(1, base * 5);
  } while (
    a % base === 0 ||
    (add ? a + b >= base * 10 : a - b < base) ||
    // くりあがり・くりさがりの ない 簡単な場合
    (add ? (a % base) + (b % base) >= base : a % base < b % base)
  );
  const r = add ? a + b : a - b;
  const fmt = big ? mcm : cmmm;
  const op = add ? '＋' : '−';
  const A = Math.floor(a / base);
  const B = Math.floor(b / base);
  const ra = Math.floor(r / base);
  const rb = r % base;
  // 単位を そろえずに 計算した（3cm5mm ＋ 4cm を 3cm9mm）
  const lowMixed = b % base === 0 ? (add ? (a % base) + B : (a % base) - B) : null;
  const mixed = lowMixed !== null && lowMixed >= 0 && lowMixed < base ? `${A}|${lowMixed}` : null;
  return {
    engine: 'number',
    id: `calc${alt ? '-alt' : ''}:${a}${add ? '+' : '-'}${b}:${U}`,
    objective: 'calc',
    level,
    prompt: alt
      ? add
        ? `${fmt(a)}の テープと ${fmt(b)}の テープを つなぎます（のりしろなし）。ぜんぶで どれだけの ながさ？`
        : `${fmt(a)}の リボンから ${fmt(b)} きりとりました。のこりの ながさは？`
      : '□に あう かずは？',
    figure: alt
      ? {
          kind: 'tape',
          parts: add
            ? [
                { length: a, label: fmt(a), tone: 'a' },
                { length: b, label: fmt(b), tone: 'b' },
              ]
            : [
                { length: b, label: fmt(b), tone: 'a' },
                { length: r, label: '？', tone: 'b' },
              ],
          total: add ? '？' : fmt(a),
        }
      : { kind: 'text', text: `${fmt(a)} ${op} ${fmt(b)} ＝ □${U}□${u}`, size: 'l' },
    fields: [
      { label: U, answer: { kind: 'int', value: ra } },
      { label: u, answer: { kind: 'int', value: rb } },
    ],
    hints: [
      'おなじ たんいどうしを けいさん しよう。',
      `${U}どうし: ${A} ${op} ${B}。`,
      `${u}どうし: ${a % base} ${op} ${b % base} を けいさん しよう。`,
    ],
    explain: `${U}どうし ${A} ${op} ${B} ＝ ${ra}、${u}どうし ${a % base} ${op} ${b % base} ＝ ${rb}。こたえは ${ra}${U}${rb}${u} です。`,
    identity: `calc:${a}${add ? '+' : '-'}${b}:${U}`,
    alt,
    wrongAnswers: wrongList(`${ra}|${rb}`, 2, [
      [mixed, 'mix-units'],
      [`${rb}|${ra}`, 'unit-swap'],
    ]),
  };
}

export function generateLength(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'read':
      return read(level, rng, alt);
    case 'draw':
      return draw(level, rng, alt);
    case 'convert':
      return convert(level, rng, alt);
    case 'unit':
      return unit(level, rng, alt);
    case 'calc':
      return calc(level, rng, alt);
  }
}

export const length: UnitSpec = {
  id: 'g2.math.length',
  title: '長《なが》さの たんい',
  stage: 'g2',
  subject: 'math',
  domain: 'C-measure',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'pencil',
  prereq: ['g1.math.compare-quantity'],
  objectives: [
    { id: 'read', title: 'ものさしで はかる（cm・mm・m）' },
    { id: 'draw', title: 'きまった ながさの せんを ひく' },
    { id: 'convert', title: 'たんいの かんけい（1cm＝10mm、1m＝100cm）' },
    { id: 'unit', title: 'あう たんいを えらぶ・くらべる' },
    { id: 'calc', title: 'ながさの けいさん' },
  ],
  misconceptions: [
    {
      id: 'unit-swap',
      explain:
        'cmと mmの かずが いれかわったのかな。ながい めもりの かずが cm、ちいさい めもりの かずが mm だよ。',
    },
    {
      id: 'from-end',
      explain:
        'はしの めもりを そのまま よんだのかな。はじまりが 0で ない ときは、はじまりから いくつ ぶんかを かぞえよう。',
    },
    {
      id: 'ignore-mm',
      explain: 'mmの ぶんを わすれたのかな。cmの めもりから、ちいさい めもりも すすめよう。',
    },
    {
      id: 'digit-sum',
      explain:
        'cmと mmの かずを そのまま たしたのかな。1cmは 10mm だから、cmの かずを 10ばいに しよう。',
    },
    {
      id: 'factor',
      explain: 'たんいの かんけいを まちがえたのかな。1cm＝10mm、1m＝100cm だよ。',
    },
    {
      id: 'concat',
      explain: 'すうじを ならべて かいたのかな。1m ＝ 100cm。1m5cmは 100cmと 5cmで 105cm。',
    },
    {
      id: 'unit-size',
      explain:
        'たんいの おおきさを くらべよう。1mmは とても みじかく、1mは りょうてを ひろげた くらい だよ。',
    },
    {
      id: 'compare-number-only',
      explain: 'すうじの おおきさだけで くらべたのかな。たんいを そろえてから くらべよう。',
    },
    {
      id: 'mix-units',
      explain:
        'ちがう たんいの かずを たしたのかな。cmは cmどうし、mmは mmどうしで けいさん するよ。',
    },
  ],
  levels: [
    { label: 'ものさし（cm・mm）', chance: 0.05 },
    { label: 'たんいの かんけい', chance: 0.05 },
    { label: 'm・けいさん', chance: 0.05 },
  ],
  intro: [
    {
      text: 'ものさしの ながい めもりは 1cm、ちいさい めもりは 1mm です。1cmを 10に わけた 1つが 1mm。',
      figure: {
        kind: 'tape',
        parts: Array.from({ length: 10 }, () => ({ length: 1 })),
        total: '1cm ＝ 10mm',
      },
    },
    {
      text: 'テープの ながさは 3cmと 5mmで 3cm5mm。35mmとも いえます。',
      figure: {
        kind: 'tape',
        parts: [
          { length: 35, label: '3cm5mm', tone: 'a' },
          { length: 85, tone: 'muted' },
        ],
      },
    },
    {
      text: '100cmを 1m（1メートル）と いいます。1m ＝ 100cm。',
      figure: { kind: 'text', text: '1m ＝ 100cm　1cm ＝ 10mm', size: 'l' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateLength(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第2学年 C(1) 長さの単位（mm・cm・m）と測定、長さの加減',
  revised: '2026-10-24',
};
