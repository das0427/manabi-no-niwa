/**
 * g3.math.length-km 長い長さ（km）、道のりと距離、まきじゃく（curriculum-matrix 3.6）。
 * まきじゃくの目盛り → km と m → 地図で道のりと距離 → 単位を選ぶ。
 *
 * 地図は map エンジンを使わず、道すじを線でかいた図（svg）と数で出す（地図記号・方位は社会の単元）。
 * 同一性キー: 問う形 × 数（'tape:187'、'km-m:1:300'、'path:420:650:900' など）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { MeasureItem } from '../../engines/measure/measure';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { pickObj, pickOne, wrongList } from './util';

type Obj = 'tape' | 'convert' | 'path' | 'unit';

/** 0〜2m の まきじゃく（基準 cm） */
const TAPE = { unit: 'cm', min: 0, max: 200, minor: 1, mid: 5, major: 10 } as const;

function tape(level: number, rng: Rng, alt: boolean): MeasureItem {
  let v: number;
  do v = rng.int(101, 199);
  while (v % 10 === 0);
  if (alt) {
    // 0の めもりから 始まって いない（左はしが 途中の めもり）
    const from = rng.int(1, 5) * 10;
    let w: number;
    do w = rng.int(60, 200 - from);
    while (w % 10 === 0 || w + from > 200);
    return {
      engine: 'measure',
      id: `tape-alt:${from}:${w}`,
      objective: 'tape',
      level,
      prompt: `テープの 長《なが》さは 何《なん》cmですか。テープの 左《ひだり》はしは ${from}cmの めもりに あります。`,
      hints: [
        'テープの 左《ひだり》はしが 0の めもりでは ないね。',
        `右《みぎ》はしの めもりを 読《よ》んで、${from}cmを ひこう。`,
        '右《みぎ》はしの めもり − 左《ひだり》はしの めもり。',
      ],
      explain: `右《みぎ》はしの めもりは ${from + w}cm。左《ひだり》はしが ${from}cmなので、${from + w} − ${from} ＝ ${w}で ${w}cmです。`,
      identity: `tape-from:${from}:${w}`,
      alt: true,
      instrument: 'ruler',
      scale: { ...TAPE },
      task: 'read',
      value: w,
      from,
      object: 'tape',
      misconceptions: { fromEnd: 'from-end' },
    };
  }
  return {
    engine: 'measure',
    id: `tape:${v}`,
    objective: 'tape',
    level,
    prompt: 'まきじゃくで ロープの 長《なが》さを はかりました。何《なん》m何《なん》cmですか。',
    hints: [
      'まきじゃくの 数字《すうじ》は cmだよ。100cmで 1m。',
      `右《みぎ》はしは ${Math.floor(v / 10) * 10}cmの めもりを すぎた ところ。`,
      `${Math.floor(v / 10) * 10}cmから 小《ちい》さい めもり いくつ分《ぶん》かな。そのあと 100cmを 1mに なおそう。`,
    ],
    explain: `めもりは ${v}cm。100cm ＝ 1mなので、${v}cm ＝ 1m${v - 100}cmです。`,
    identity: `tape:${v}`,
    alt: false,
    instrument: 'ruler',
    scale: { ...TAPE },
    task: 'read',
    value: v,
    object: 'tape',
    fields: [
      { unit: 'm', factor: 100 },
      { unit: 'cm', factor: 1 },
    ],
    misconceptions: { fieldSwap: 'field-swap' },
    wrongAnswers: [{ value: v - 100, misconception: 'meter-forget' }],
  };
}

function convert(level: number, rng: Rng, alt: boolean): NumberItem {
  const k = rng.int(1, 9);
  const m = pickOne(rng, [
    rng.int(1, 9) * 100,
    rng.int(1, 9) * 10 + rng.int(0, 1) * 100 * rng.int(1, 9),
    rng.int(1, 999),
  ]);
  const total = k * 1000 + m;
  const toM = alt ? false : rng.next() < 0.5;
  if (alt) {
    // 道のりの 文で
    return {
      engine: 'number',
      id: `convert-alt:${total}`,
      objective: 'convert',
      level,
      prompt: `おじいさんの 家《いえ》まで ${total}m あります。これは 何《なん》km何《なん》mですか。`,
      hints: [
        '1kmは 1000m だよ。',
        `${total}mの 中《なか》に 1000mは いくつ あるかな。`,
        `${k * 1000}mで ${k}km。のこりは 何《なん》m？`,
      ],
      explain: `1km ＝ 1000m。${total}m ＝ ${k * 1000}m ＋ ${m}m ＝ ${k}km${m}mです。`,
      identity: `m-km:${total}`,
      alt: true,
      fields: [
        { label: 'km', answer: { kind: 'int', value: k } },
        { label: 'm', answer: { kind: 'int', value: m } },
      ],
      wrongAnswers: wrongList(`${k}|${m}`, 2, [
        [`${Math.floor(total / 100)}|${total % 100}`, 'km-as-100'],
        [`${m}|${k}`, 'field-swap'],
      ]),
    };
  }
  return toM
    ? {
        engine: 'number',
        id: `convert:km-m:${k}:${m}`,
        objective: 'convert',
        level,
        prompt: '□に あてはまる 数《かず》は？',
        figure: { kind: 'text', text: `${k}km${m}m ＝ {{}}m`, size: 'xl' },
        hints: [
          '1kmは 1000m だよ。',
          `${k}kmは ${k * 1000}m。`,
          `${k * 1000}mと ${m}mを あわせよう。`,
        ],
        explain: `1km ＝ 1000m なので ${k}km ＝ ${k * 1000}m。${k * 1000} ＋ ${m} ＝ ${total}で ${total}mです。`,
        identity: `km-m:${k}:${m}`,
        alt: false,
        fields: [{ label: 'm', answer: { kind: 'int', value: total } }],
        wrongAnswers: wrongList(String(total), 1, [
          [`${k}${m}`, 'km-place'],
          [k * 100 + m, 'km-as-100'],
        ]),
      }
    : {
        engine: 'number',
        id: `convert:m-km:${total}`,
        objective: 'convert',
        level,
        prompt: '□に あてはまる 数《かず》は？',
        figure: { kind: 'text', text: `${total}m ＝ {{}}km{{}}m`, size: 'xl' },
        hints: [
          '1000mで 1km だよ。',
          `${total}mの 中《なか》に 1000mは いくつ あるかな。`,
          `${k * 1000}mで ${k}km。のこりは？`,
        ],
        explain: `${total}m ＝ ${k * 1000}m ＋ ${m}m ＝ ${k}km${m}mです。`,
        identity: `m-km:${total}`,
        alt: false,
        fields: [
          { label: 'km', answer: { kind: 'int', value: k } },
          { label: 'm', answer: { kind: 'int', value: m } },
        ],
        wrongAnswers: wrongList(`${k}|${m}`, 2, [
          [`${Math.floor(total / 100)}|${total % 100}`, 'km-as-100'],
          [`${m}|${k}`, 'field-swap'],
        ]),
      };
}

/** 道すじ（家 → 曲がり角 → 学校）と まっすぐの線の図 */
function routeFig(bend: number): Figure {
  const by = 20 + bend * 10;
  return {
    kind: 'svg',
    label: '道《みち》の 図《ず》',
    markup: `<svg viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg"><polyline points="20,100 120,${by} 220,100" fill="none" stroke="var(--wood)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><line x1="20" y1="100" x2="220" y2="100" stroke="var(--ink)" stroke-width="3" stroke-dasharray="8 6"/><circle cx="20" cy="100" r="9" fill="var(--sun)" stroke="var(--ink)" stroke-width="3"/><circle cx="120" cy="${by}" r="7" fill="var(--paper)" stroke="var(--ink)" stroke-width="3"/><rect x="208" y="88" width="24" height="24" fill="var(--sky)" stroke="var(--ink)" stroke-width="3"/></svg>`,
  };
}

function kmText(m: number): string {
  return m >= 1000 ? `${Math.floor(m / 1000)}km${m % 1000 === 0 ? '' : `${m % 1000}m`}` : `${m}m`;
}

function path(level: number, rng: Rng, alt: boolean): NumberItem {
  const a = rng.int(20, 90) * 10;
  const b = rng.int(20, 90) * 10;
  const c = Math.max(Math.abs(a - b) + 50, Math.round((Math.sqrt(a * a + b * b) * 1.05) / 10) * 10);
  const dist = Math.min(c, a + b - 50);
  const total = a + b;
  const fields =
    total >= 1000
      ? [
          { label: 'km', answer: { kind: 'int' as const, value: Math.floor(total / 1000) } },
          { label: 'm', answer: { kind: 'int' as const, value: total % 1000 } },
        ]
      : [{ label: 'm', answer: { kind: 'int' as const, value: total } }];
  const asFields = (v: number) =>
    total >= 1000 ? `${Math.floor(v / 1000)}|${v % 1000}` : String(v);
  const story = `家《いえ》（●）から 曲《ま》がり角《かど》まで ${a}m、曲《ま》がり角《かど》から 学校《がっこう》（■）まで ${b}mの 道《みち》を 歩《ある》きます。家《いえ》から 学校《がっこう》まで まっすぐに はかった 長《なが》さ（点線《てんせん》）は ${dist}mです。`;
  if (alt)
    return {
      engine: 'number',
      id: `path-alt:${a}:${b}:${dist}`,
      objective: 'path',
      level,
      prompt: `${story}\n道《みち》のりと きょりの ちがいは 何《なん》mですか。`,
      figure: routeFig(rng.int(0, 3)),
      hints: [
        '道《みち》に そって はかった 長《なが》さが 道《みち》のり、まっすぐ はかった 長《なが》さが きょり。',
        `道《みち》のりは ${a} ＋ ${b}。`,
        `道《みち》のりから きょりの ${dist}mを ひこう。`,
      ],
      explain: `道《みち》のりは ${a} ＋ ${b} ＝ ${total}m、きょりは ${dist}m。ちがいは ${total} − ${dist} ＝ ${total - dist}mです。`,
      identity: `path-diff:${a}:${b}:${dist}`,
      alt: true,
      fields: [{ label: 'm', answer: { kind: 'int', value: total - dist } }],
      wrongAnswers: wrongList(String(total - dist), 1, [
        [total, 'path-vs-distance'],
        [Math.abs(a - b), 'path-vs-distance'],
      ]),
    };
  return {
    engine: 'number',
    id: `path:${a}:${b}:${dist}`,
    objective: 'path',
    level,
    prompt: `${story}\n家《いえ》から 学校《がっこう》までの 道《みち》のりは ${total >= 1000 ? '何《なん》km何《なん》m' : '何《なん》m'}ですか。`,
    figure: routeFig(rng.int(0, 3)),
    hints: [
      '道《みち》のりは、道《みち》に そって はかった 長《なが》さ。',
      `${a}mと ${b}mを あわせよう。`,
      total >= 1000 ? '1000mで 1km。' : `${a} ＋ ${b} を 計算《けいさん》しよう。`,
    ],
    explain: `道《みち》のりは ${a} ＋ ${b} ＝ ${total}m${total >= 1000 ? `、${kmText(total)}` : ''}です。まっすぐの ${dist}mは きょりです。`,
    identity: `path:${a}:${b}:${dist}`,
    alt: false,
    fields,
    wrongAnswers: wrongList(asFields(total), fields.length, [
      [asFields(dist), 'path-vs-distance'],
      [total >= 1000 ? `${Math.floor(total / 100)}|${total % 100}` : null, 'km-as-100'],
    ]),
  };
}

/** 単位を えらぶ（ふだんの 生活の 長さ） */
const UNIT_ITEMS: { id: string; text: string; n: number; u: 'mm' | 'cm' | 'm' | 'km' }[] = [
  { id: 'hike', text: '遠足《えんそく》で 歩《ある》いた 道《みち》のり', n: 4, u: 'km' },
  { id: 'pool', text: 'プールの たての 長《なが》さ', n: 25, u: 'm' },
  { id: 'pencil', text: 'えんぴつの 長《なが》さ', n: 17, u: 'cm' },
  { id: 'note', text: 'ノートの あつさ', n: 4, u: 'mm' },
  { id: 'hall', text: '学校《がっこう》の ろうかの 長《なが》さ', n: 60, u: 'm' },
  { id: 'marathon', text: 'マラソンの コースの 長《なが》さ', n: 42, u: 'km' },
  { id: 'desk', text: 'つくえの よこの 長《なが》さ', n: 65, u: 'cm' },
  { id: 'ant', text: 'ありの 体《からだ》の 長《なが》さ', n: 5, u: 'mm' },
  {
    id: 'train',
    text: '電車《でんしゃ》で となりの 町《まち》まで 行《い》く 道《みち》のり',
    n: 12,
    u: 'km',
  },
  { id: 'tree', text: '校庭《こうてい》の 木《き》の 高《たか》さ', n: 8, u: 'm' },
  { id: 'eraser', text: 'けしゴムの あつさ', n: 12, u: 'mm' },
  { id: 'book', text: '教科書《きょうかしょ》の たての 長《なが》さ', n: 26, u: 'cm' },
  { id: 'bridge', text: '大《おお》きな 川《かわ》に かかる はしの 長《なが》さ', n: 300, u: 'm' },
  {
    id: 'river',
    text: '川《かわ》の 上流《じょうりゅう》から 海《うみ》までの 長《なが》さ',
    n: 90,
    u: 'km',
  },
  { id: 'shoe', text: 'くつの 長《なが》さ', n: 20, u: 'cm' },
  { id: 'coin', text: '1円玉《いちえんだま》の 直径《ちょっけい》', n: 20, u: 'mm' },
];
const UNIT_FACTS = [
  { id: 'km', q: '1kmは 何《なん》mですか。', a: 1000, w: [[100, 'km-as-100']] },
  { id: 'm', q: '1mは 何《なん》cmですか。', a: 100, w: [[1000, 'unit-sense']] },
  { id: 'cm', q: '1cmは 何《なん》mmですか。', a: 10, w: [[100, 'unit-sense']] },
  { id: '2km', q: '2kmは 何《なん》mですか。', a: 2000, w: [[200, 'km-as-100']] },
  { id: '5km', q: '5kmは 何《なん》mですか。', a: 5000, w: [[500, 'km-as-100']] },
] as const;

function unitItem(level: number, rng: Rng, alt: boolean): ChoiceItem | NumberItem {
  if (alt) {
    const f = pickOne(rng, UNIT_FACTS);
    return {
      engine: 'number',
      id: `unit-alt:${f.id}`,
      objective: 'unit',
      level,
      prompt: f.q,
      hints: [
        '長《なが》さの たんいの かんけいを 思《おも》い出《だ》そう。',
        '1km ＝ 1000m、1m ＝ 100cm、1cm ＝ 10mm。',
        'km の k は「1000」の いみだよ。',
      ],
      explain: `1km ＝ 1000m、1m ＝ 100cm、1cm ＝ 10mm。答《こた》えは ${f.a}です。`,
      identity: `fact:${f.id}`,
      alt: true,
      fields: [{ answer: { kind: 'int', value: f.a } }],
      wrongAnswers: wrongList(
        String(f.a),
        1,
        f.w.map(([v, m]) => [v, m] as [number, string]),
      ),
    };
  }
  const it = pickOne(rng, UNIT_ITEMS);
  const order = ['mm', 'cm', 'm', 'km'] as const;
  return {
    engine: 'choice',
    id: `unit:${it.id}`,
    objective: 'unit',
    level,
    prompt: `${it.text}は ${it.n} □です。□に あてはまる たんいは どれ？`,
    hints: [
      '1mm・1cm・1m・1kmの 長《なが》さを 思《おも》いうかべよう。',
      '1mは 両手《りょうて》を 広《ひろ》げた くらい、1kmは 歩《ある》いて 15分《ふん》くらい。',
      `${it.n}を それぞれの たんいで 思《おも》いうかべて みよう。`,
    ],
    explain: `${it.text}は ${it.n}${it.u}くらいです。`,
    identity: `unit:${it.id}`,
    alt: false,
    fixedOrder: true,
    options: order.map((u) =>
      u === it.u ? { label: u, correct: true } : { label: u, misconception: 'unit-sense' },
    ),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['tape', 'convert', 'unit'] },
  { objs: ['convert', 'path', 'unit'] },
  { objs: ['tape', 'path', 'convert'] },
  { objs: ['tape', 'convert', 'path', 'unit'] },
];

export function generateLengthKm(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.25;
  switch (obj) {
    case 'tape':
      return tape(level, rng, alt);
    case 'convert':
      return convert(level, rng, alt);
    case 'path':
      return path(level, rng, alt);
    case 'unit':
      return unitItem(level, rng, alt);
  }
}

export const lengthKm: UnitSpec = {
  id: 'g3.math.length-km',
  title: '長《なが》い 長《なが》さ（km）',
  stage: 'g3',
  subject: 'math',
  domain: 'C-measure',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'pencil',
  prereq: ['g2.math.length'],
  objectives: [
    { id: 'tape', title: 'まきじゃくの めもりを 読《よ》む' },
    { id: 'convert', title: 'kmと m' },
    { id: 'path', title: '道《みち》のりと きょり' },
    { id: 'unit', title: '長《なが》さの たんいを えらぶ' },
  ],
  misconceptions: [
    {
      id: 'field-swap',
      explain:
        '大《おお》きい たんいと 小《ちい》さい たんいの 数《かず》を 入《い》れかえたのかな。左《ひだり》の ところが 大《おお》きい たんいだよ。',
    },
    {
      id: 'meter-forget',
      explain:
        '100cmを こえた ことを わすれたのかな。100cmで 1m。まきじゃくの めもりが 100を こえたら 1mと 何《なん》cmと 読《よ》もう。',
    },
    {
      id: 'from-end',
      explain:
        '右《みぎ》はしの めもりを そのまま 読《よ》んだのかな。左《ひだり》はしが 0で ない ときは、右《みぎ》はしの めもりから 左《ひだり》はしの めもりを ひこう。',
    },
    {
      id: 'km-place',
      explain:
        'kmと mの 数《かず》を ならべて 書《か》いたのかな。1km ＝ 1000m。1km30m は 1000m と 30m で 1030m だよ。',
      figure: { kind: 'text', text: '1km30m ＝ 1030m', size: 'l' },
    },
    {
      id: 'km-as-100',
      explain: '1kmを 100mと 考《かんが》えたのかな。1km ＝ 1000m だよ。',
    },
    {
      id: 'path-vs-distance',
      explain:
        '道《みち》のりと きょりを とりちがえたのかな。道《みち》に そって はかった 長《なが》さが 道《みち》のり、まっすぐに はかった 長《なが》さが きょりだよ。',
    },
    {
      id: 'unit-sense',
      explain:
        'その たんいだと 長《なが》すぎるか 短《みじか》すぎるかな。1mm・1cm・1m・1kmの 長《なが》さを 思《おも》いうかべて、くらべよう。',
    },
  ],
  levels: [
    { label: 'まきじゃく・kmと m', chance: 0.05 },
    { label: '道のりと きょり', chance: 0.05 },
    { label: 'まきじゃく（はしが 0で ない）', chance: 0.05 },
    { label: 'まとめ', chance: 0.05 },
  ],
  intro: [
    {
      text: '長《なが》い ものや まるい ものは、まきじゃくで はかります。めもりは cmで、100cmで 1mです。',
      figure: {
        kind: 'numberline',
        min: 100,
        max: 200,
        step: 10,
        minorStep: 1,
        labelEvery: 1,
        marks: [{ at: 137, label: '1m37cm', tone: 'focus' }],
      },
    },
    {
      text: '1000mを 1キロメートルと いい、1kmと 書《か》きます。1km ＝ 1000m。',
      figure: { kind: 'text', text: '1km ＝ 1000m　1km300m ＝ 1300m', size: 'l' },
    },
    {
      text: '道《みち》に そって はかった 長《なが》さを 道《みち》のり、まっすぐに はかった 長《なが》さを きょりと いいます。',
      figure: routeFig(1),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateLengthKm(level, rng, index),
  },
  review: 'objective',
  basis: '小学校学習指導要領（平成29年告示）算数 第3学年 C(1) 長さ（km、道のりと距離、巻尺）',
  revised: '2026-10-24',
};
