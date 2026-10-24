/**
 * g2.math.volume かさの単位（mL・dL・L）（curriculum-matrix 3.5）。
 * dL ます → L と dL → mL・単位を選ぶ。
 *
 * 同一性キー: 問う形 × かさ（基準の単位の値）。単位を選ぶ問題は物。
 * 定義域: dL ます 1〜59dL、mL の目盛り、換算・計算で 数百通り。
 */
import type { Rng } from '../../core/util/rng';
import type { MeasureItem } from '../../engines/measure/measure';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { pickObj, wrongList } from './util';

type Obj = 'read' | 'set' | 'convert' | 'unit' | 'calc';

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['read', 'set'] },
  { objs: ['read', 'set', 'convert', 'unit'] },
  { objs: ['convert', 'unit', 'calc', 'read'] },
];

/** 1L ます（基準 dL。1めもり 1dL） */
const DL_MASU = { unit: 'dL', min: 0, max: 10, minor: 1, mid: 5, major: 5 } as const;
/** 1L ます（基準 mL。1めもり 100mL） */
const ML_MASU = { unit: 'mL', min: 0, max: 1000, minor: 100, major: 500 } as const;
/** 1dL ます（基準 mL。1めもり 10mL） */
const DLML_MASU = { unit: 'mL', min: 0, max: 100, minor: 10, major: 50 } as const;

const ldl = (v: number) => {
  const l = Math.floor(v / 10);
  const d = v % 10;
  return d === 0 ? `${l}L` : l === 0 ? `${d}dL` : `${l}L${d}dL`;
};

function read(level: number, rng: Rng, alt: boolean): MeasureItem {
  if (alt) {
    // mL の目盛りの ます（1めもり 100mL か 10mL）
    const big = rng.next() < 0.5;
    const scale = big ? ML_MASU : DLML_MASU;
    const step = big ? 100 : 10;
    const v = rng.int(1, 9) * step;
    return {
      engine: 'measure',
      id: `read-alt:${scale.max}:${v}`,
      objective: 'read',
      level,
      prompt: `みずの かさは なんmL？（この ますは ${big ? '1L' : '1dL'}）`,
      hints: [
        `${big ? '1L' : '1dL'}は ${scale.max}mL だよ。`,
        `${scale.max}mLを 10に わけて いるので、1めもりは ${step}mL。`,
        `${step}mLが いくつ ぶん かな。`,
      ],
      explain: `1めもりは ${step}mL。${v / step}めもりで ${v}mL です。`,
      identity: `read-ml:${scale.max}:${v}`,
      alt: true,
      instrument: 'masu',
      scale: { ...scale },
      task: 'read',
      value: v,
      fields: [{ unit: 'mL', factor: 1 }],
      misconceptions: { minorAsOne: 'count-tick' },
    };
  }
  // dL ます。1L を こえる ときは なんL なんdL
  let v: number;
  do v = rng.int(1, 49);
  while (v % 10 === 0);
  const l = Math.floor(v / 10);
  const d = v % 10;
  const multi = v > 10;
  return {
    engine: 'measure',
    id: `read:${v}`,
    objective: 'read',
    level,
    prompt: multi ? 'みずの かさは なんL なんdL？' : 'みずの かさは なんdL？',
    hints: multi
      ? [
          'いっぱいの ますは 1L だよ。',
          `いっぱいの ますが ${l}こで ${l}L。`,
          'のこりの ますの めもりは なんdL かな。',
        ]
      : [
          '1めもりは 1dL だよ。',
          'みずの いちばん うえの めもりを みよう。',
          '0から めもりを かぞえよう。',
        ],
    explain: multi
      ? `1Lの ますが ${l}こで ${l}L、のこりが ${d}dL。${ldl(v)}です。`
      : `${v}めもりで ${v}dL です。`,
    identity: `read:${v}`,
    alt: false,
    instrument: 'masu',
    scale: { ...DL_MASU },
    task: 'read',
    value: v,
    fields: multi
      ? [
          { unit: 'L', factor: 10 },
          { unit: 'dL', factor: 1 },
        ]
      : [{ unit: 'dL', factor: 1 }],
    misconceptions: { fieldSwap: 'unit-swap' },
    wrongAnswers: multi ? [{ value: l + d, misconception: 'factor' }] : [],
  };
}

function set(level: number, rng: Rng, alt: boolean): MeasureItem {
  if (alt) {
    const v = rng.int(1, 9) * 100;
    return {
      engine: 'measure',
      id: `set-alt:${v}`,
      objective: 'set',
      level,
      prompt: `${v}mLまで みずを いれよう。めもりを タップしてね。（この ますは 1L）`,
      hints: ['1Lは 1000mL だよ。', '1めもりは 100mL。', `100mLが ${v / 100}こ ぶん…`],
      explain: `1めもり 100mL。${v / 100}めもりで ${v}mL です。`,
      identity: `set-ml:${v}`,
      alt: true,
      instrument: 'masu',
      scale: { ...ML_MASU },
      task: 'set',
      value: v,
      misconceptions: { minorAsOne: 'count-tick' },
    };
  }
  // 1L ます（dL）か 1dL ます（mL）
  if (rng.next() < 0.5) {
    const v = rng.int(1, 9) * 10;
    return {
      engine: 'measure',
      id: `set:ml:${v}`,
      objective: 'set',
      level,
      prompt: `${v}mLまで みずを いれよう。めもりを タップしてね。（この ますは 1dL）`,
      hints: ['1dLは 100mL だよ。', '1めもりは 10mL。', `10mLが ${v / 10}こ ぶん…`],
      explain: `1めもり 10mL。${v / 10}めもりで ${v}mL です。`,
      identity: `set-dlml:${v}`,
      alt: false,
      instrument: 'masu',
      scale: { ...DLML_MASU },
      task: 'set',
      value: v,
      misconceptions: { minorAsOne: 'count-tick' },
    };
  }
  const v = rng.int(1, 9);
  return {
    engine: 'measure',
    id: `set:${v}`,
    objective: 'set',
    level,
    prompt: `${v}dLまで みずを いれよう。めもりを タップしてね。`,
    hints: ['1めもりは 1dL だよ。', '0から めもりを かぞえよう。', `${v}つめの めもり…`],
    explain: `${v}めもりで ${v}dL です。`,
    identity: `set:${v}`,
    alt: false,
    instrument: 'masu',
    scale: { ...DL_MASU },
    task: 'set',
    value: v,
  };
}

function convert(level: number, rng: Rng, alt: boolean): NumberItem {
  const form = rng.int(0, 3);
  if (form === 0) {
    // □L□dL → dL
    let v: number;
    do v = rng.int(11, 99);
    while (v % 10 === 0);
    const l = Math.floor(v / 10);
    const d = v % 10;
    return {
      engine: 'number',
      id: `convert:ldl-dl:${v}`,
      objective: 'convert',
      level,
      prompt: '□に あう かずは？',
      figure: { kind: 'text', text: `${l}L${d}dL ＝ □dL`, size: 'xl' },
      fields: [{ label: 'dL', answer: { kind: 'int', value: v } }],
      hints: ['1Lは 10dL だよ。', `${l}Lは ${l * 10}dL。`, `${l * 10}dLと ${d}dLを あわせよう。`],
      explain: `1L ＝ 10dL なので ${l}L ＝ ${l * 10}dL。${l * 10} ＋ ${d} ＝ ${v}で ${v}dL です。`,
      identity: `ldl-dl:${v}`,
      alt,
      wrongAnswers: wrongList(String(v), 1, [
        [l + d, 'factor'],
        [l * 100 + d, 'factor'],
      ]),
    };
  }
  if (form === 1) {
    // dL → □L□dL
    let v: number;
    do v = rng.int(11, 99);
    while (v % 10 === 0);
    const l = Math.floor(v / 10);
    const d = v % 10;
    return {
      engine: 'number',
      id: `convert:dl-ldl:${v}`,
      objective: 'convert',
      level,
      prompt: '□に あう かずは？',
      figure: { kind: 'text', text: `${v}dL ＝ □L□dL`, size: 'xl' },
      fields: [
        { label: 'L', answer: { kind: 'int', value: l } },
        { label: 'dL', answer: { kind: 'int', value: d } },
      ],
      hints: [
        '10dLで 1L だよ。',
        `${v}dLの なかに 10dLは いくつ あるかな。`,
        `${l * 10}dLで ${l}L。のこりは？`,
      ],
      explain: `${v}dL ＝ ${l * 10}dL ＋ ${d}dL ＝ ${l}L${d}dL です。`,
      identity: `dl-ldl:${v}`,
      alt,
      wrongAnswers: wrongList(`${l}|${d}`, 2, [
        [`${d}|${l}`, 'unit-swap'],
        [`${v}|0`, 'factor'],
      ]),
    };
  }
  if (form === 2) {
    // □dL → mL
    const d = rng.int(1, 9);
    return {
      engine: 'number',
      id: `convert:dl-ml:${d}`,
      objective: 'convert',
      level,
      prompt: '□に あう かずは？',
      figure: { kind: 'text', text: `${d}dL ＝ □mL`, size: 'xl' },
      fields: [{ label: 'mL', answer: { kind: 'int', value: d * 100 } }],
      hints: ['1dLは 100mL だよ。', `${d}dLは 100mLの ${d}つぶん。`, `100mLが ${d}こで…`],
      explain: `1dL ＝ 100mL なので、${d}dL ＝ ${d * 100}mL です。`,
      identity: `dl-ml:${d}`,
      alt,
      wrongAnswers: wrongList(String(d * 100), 1, [
        [d * 10, 'factor'],
        [d * 1000, 'factor'],
      ]),
    };
  }
  // □L → dL・mL
  const l = rng.int(1, 9);
  const toMl = rng.next() < 0.5;
  const ans = toMl ? l * 1000 : l * 10;
  const u = toMl ? 'mL' : 'dL';
  return {
    engine: 'number',
    id: `convert:l-${u}:${l}`,
    objective: 'convert',
    level,
    prompt: '□に あう かずは？',
    figure: { kind: 'text', text: `${l}L ＝ □${u}`, size: 'xl' },
    fields: [{ label: u, answer: { kind: 'int', value: ans } }],
    hints: [
      toMl ? '1Lは 1000mL だよ。' : '1Lは 10dL だよ。',
      `${l}Lは 1Lの ${l}つぶん。`,
      toMl ? `1000mLが ${l}こで…` : `10dLが ${l}こで…`,
    ],
    explain: toMl
      ? `1L ＝ 1000mL なので ${l}L ＝ ${ans}mL です。`
      : `1L ＝ 10dL なので ${l}L ＝ ${ans}dL です。`,
    identity: `l-${u}:${l}`,
    alt,
    wrongAnswers: wrongList(String(ans), 1, [
      [toMl ? l * 100 : l * 100, 'factor'],
      [toMl ? l * 10 : l, 'factor'],
    ]),
  };
}

const THINGS: { name: string; amount: number; unit: 'mL' | 'dL' | 'L' }[] = [
  { name: 'コップ 1ぱいの みず', amount: 2, unit: 'dL' },
  { name: 'バケツ 1ぱいの みず', amount: 8, unit: 'L' },
  { name: 'スプーン 1ぱいの しょうゆ', amount: 5, unit: 'mL' },
  { name: 'ぎゅうにゅうの パック', amount: 1, unit: 'L' },
  { name: 'ペットボトルの おちゃ', amount: 500, unit: 'mL' },
  { name: 'すいそうの みず', amount: 30, unit: 'L' },
  { name: 'やかんの おゆ', amount: 2, unit: 'L' },
  { name: 'きゅうしょくの ぎゅうにゅう', amount: 2, unit: 'dL' },
  { name: 'ジュースの かんの なかみ', amount: 350, unit: 'mL' },
  { name: 'めぐすりの なかみ', amount: 10, unit: 'mL' },
  { name: 'なべの スープ', amount: 3, unit: 'L' },
  { name: 'ゆのみの おちゃ', amount: 1, unit: 'dL' },
];

function unit(level: number, rng: Rng, alt: boolean): ChoiceItem {
  if (alt) {
    // 3つの かさ（dL で 2〜25）を L・dL・mL の かきかたで くらべる
    let x: number;
    let y: number;
    let z: number;
    do {
      x = rng.int(2, 9);
      y = rng.int(11, 25);
      z = rng.int(2, 15);
    } while (new Set([x, y, z]).size < 3 || y % 10 === 0);
    const vals = [
      { label: `${x * 100}mL`, v: x },
      { label: ldl(y), v: y },
      { label: `${z}dL`, v: z },
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
      prompt: 'いちばん おおい かさは どれ？',
      hints: [
        'たんいを そろえて くらべよう。dLに そろえると くらべやすいよ。',
        '1L ＝ 10dL、1dL ＝ 100mL だよ。',
        `${x * 100}mLは ${x}dL、${ldl(y)}は ${y}dL。`,
      ],
      explain: `dLに そろえると ${x}dL、${y}dL、${z}dL。いちばん おおいのは ${top.label}です。`,
      identity: `unit-compare:${x}:${y}:${z}`,
      alt: true,
      options: vals.map((o) =>
        o === top
          ? { label: o.label, correct: true }
          : { label: o.label, misconception: o === bigNum ? 'compare-number-only' : 'unit-size' },
      ),
    };
  }
  const t = THINGS[rng.int(0, THINGS.length - 1)]!;
  return {
    engine: 'choice',
    id: `unit:${t.name}`,
    objective: 'unit',
    level,
    prompt: `${t.name}は ${t.amount}□。□に あう たんいは どれ？`,
    hints: [
      '1mL・1dL・1Lの かさを おもいうかべよう。',
      '1dLは ちいさな コップ 1ぱいくらい、1Lは ぎゅうにゅうの パック 1ぽん。',
      `${t.amount}こ ぶんだと どの くらいかな。`,
    ],
    explain: `${t.name}は ${t.amount}${t.unit}くらい です。`,
    identity: `unit:${t.name}`,
    alt: false,
    fixedOrder: true,
    options: (['mL', 'dL', 'L'] as const).map((u) =>
      u === t.unit ? { label: u, correct: true } : { label: u, misconception: 'unit-size' },
    ),
  };
}

function calc(level: number, rng: Rng, alt: boolean): NumberItem {
  const add = rng.next() < 0.6;
  const whole = rng.next() < 0.5;
  let a: number;
  let b: number;
  do {
    a = rng.int(11, 89);
    b = whole ? rng.int(1, 4) * 10 : rng.int(1, 49);
  } while (
    a % 10 === 0 ||
    (add ? a + b >= 100 : a - b < 10) ||
    (add ? (a % 10) + (b % 10) >= 10 : a % 10 < b % 10)
  );
  const r = add ? a + b : a - b;
  const op = add ? '＋' : '−';
  const ra = Math.floor(r / 10);
  const rb = r % 10;
  const A = Math.floor(a / 10);
  const B = Math.floor(b / 10);
  const low = b % 10 === 0 ? (add ? (a % 10) + B : (a % 10) - B) : null;
  const mixed = low !== null && low >= 0 && low < 10 ? `${A}|${low}` : null;
  return {
    engine: 'number',
    id: `calc${alt ? '-alt' : ''}:${a}${add ? '+' : '-'}${b}`,
    objective: 'calc',
    level,
    prompt: alt
      ? add
        ? `やかんに ${ldl(a)}、ポットに ${ldl(b)} の みずが あります。あわせると どれだけ？`
        : `${ldl(a)}の ジュースから ${ldl(b)} のみました。のこりは どれだけ？`
      : '□に あう かずは？',
    figure: alt
      ? {
          kind: 'tape',
          parts: add
            ? [
                { length: a, label: ldl(a), tone: 'a' },
                { length: b, label: ldl(b), tone: 'b' },
              ]
            : [
                { length: b, label: ldl(b), tone: 'a' },
                { length: r, label: '？', tone: 'b' },
              ],
          total: add ? '？' : ldl(a),
        }
      : { kind: 'text', text: `${ldl(a)} ${op} ${ldl(b)} ＝ □L□dL`, size: 'l' },
    fields: [
      { label: 'L', answer: { kind: 'int', value: ra } },
      { label: 'dL', answer: { kind: 'int', value: rb } },
    ],
    hints: [
      'おなじ たんいどうしを けいさん しよう。',
      `Lどうし: ${A} ${op} ${B}。`,
      `dLどうし: ${a % 10} ${op} ${b % 10} を けいさん しよう。`,
    ],
    explain: `Lどうし ${A} ${op} ${B} ＝ ${ra}、dLどうし ${a % 10} ${op} ${b % 10} ＝ ${rb}。こたえは ${ra}L${rb}dL です。`,
    identity: `calc:${a}${add ? '+' : '-'}${b}`,
    alt,
    wrongAnswers: wrongList(`${ra}|${rb}`, 2, [
      [mixed, 'mix-units'],
      [`${rb}|${ra}`, 'unit-swap'],
    ]),
  };
}

export function generateVolume(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'read':
      return read(level, rng, alt);
    case 'set':
      return set(level, rng, alt);
    case 'convert':
      return convert(level, rng, alt);
    case 'unit':
      return unit(level, rng, alt);
    case 'calc':
      return calc(level, rng, alt);
  }
}

export const volume: UnitSpec = {
  id: 'g2.math.volume',
  title: 'かさの たんい',
  stage: 'g2',
  subject: 'math',
  domain: 'C-measure',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-compare',
  prereq: ['g2.math.length'],
  objectives: [
    { id: 'read', title: 'ますの めもりを よむ（dL・L・mL）' },
    { id: 'set', title: 'めもりまで みずを いれる' },
    { id: 'convert', title: 'たんいの かんけい（1L＝10dL、1dL＝100mL）' },
    { id: 'unit', title: 'あう たんいを えらぶ・くらべる' },
    { id: 'calc', title: 'かさの けいさん' },
  ],
  misconceptions: [
    {
      id: 'unit-swap',
      explain:
        'Lと dLの かずが いれかわったのかな。いっぱいの ますの かずが L、のこりの めもりが dL だよ。',
    },
    {
      id: 'factor',
      explain:
        'たんいの かんけいを まちがえたのかな。1L ＝ 10dL、1dL ＝ 100mL、1L ＝ 1000mL だよ。',
    },
    {
      id: 'count-tick',
      explain: 'めもりの かずを そのまま かいたのかな。1めもりが なんmLかを さきに しらべよう。',
    },
    {
      id: 'unit-size',
      explain:
        'たんいの おおきさを くらべよう。1mLは スプーンの ほんの すこし、1Lは ぎゅうにゅうの パック 1ぽん。',
    },
    {
      id: 'compare-number-only',
      explain: 'すうじの おおきさだけで くらべたのかな。たんいを そろえてから くらべよう。',
    },
    {
      id: 'mix-units',
      explain:
        'ちがう たんいの かずを たしたのかな。Lは Lどうし、dLは dLどうしで けいさん するよ。',
    },
  ],
  levels: [
    { label: 'dL ます', chance: 0.05 },
    { label: 'L・dL・mL', chance: 0.05 },
    { label: 'かさの けいさん', chance: 0.05 },
  ],
  intro: [
    {
      text: '1dL ますで はかると、みずは 1dLが 3つ ぶん。3dL（3デシリットル）です。',
      figure: {
        kind: 'tape',
        parts: [
          { length: 3, label: '3dL', tone: 'a' },
          { length: 7, tone: 'muted' },
        ],
        total: '1L ＝ 10dL',
      },
    },
    {
      text: '10dLで 1L（1リットル）。1Lの ますが いっぱいと 3dLで 1L3dL です。',
      figure: { kind: 'text', text: '1L ＝ 10dL', size: 'xl' },
    },
    {
      text: 'すこしの かさは mL（ミリリットル）で あらわします。1dL ＝ 100mL、1L ＝ 1000mL。',
      figure: { kind: 'text', text: '1dL ＝ 100mL　1L ＝ 1000mL', size: 'l' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateVolume(level, rng, index),
  },
  review: 'objective',
  basis: '小学校学習指導要領（平成29年告示）算数 第2学年 C(1) かさの単位（mL・dL・L）と測定',
  revised: '2026-10-24',
};
