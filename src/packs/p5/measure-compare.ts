/**
 * p5.math.measure-compare ながさくらべ（curriculum-matrix 3.3・4.1）: 3つを並べる → いくつ分 → 間接比較。
 * - order3: 3つを ながい（たかい）じゅんに ならべる（order。左はしは そろえて描く）
 * - units: クリップ なんこぶん（choice）。別例は ものさし型の めもり いくつぶん（measure エンジン。図はエンジンが描く）
 * - indirect: うごかせない ものを テープで はかって くらべる（choice）
 * 同一性キー: order3:長さの組（物の絵柄は同じとみなす）、units:n、ruler:n、indirect:場面。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import type { MeasureItem } from '../../engines/measure/measure';
import type { OrderItem } from '../../engines/order/order';
import { choiceItem, mix } from './lib';

const ST = 'stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"';
const svg = (label: string, w: number, h: number, body: string): Figure => ({
  kind: 'svg',
  label,
  markup: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`,
});

/** 横の物（長さ len。幅 240 の中に左をそろえて描く） */
const THINGS: { id: string; name: string; draw: (len: number) => string }[] = [
  {
    id: 'pencil',
    name: 'えんぴつ',
    draw: (l) =>
      `<rect x="4" y="8" width="${l - 20}" height="18" fill="var(--sun)" ${ST}/><polygon points="${l - 16},8 ${l + 2},17 ${l - 16},26" fill="var(--wood)" ${ST}/>`,
  },
  {
    id: 'ribbon',
    name: 'リボン',
    draw: (l) => `<rect x="4" y="9" width="${l}" height="16" rx="4" fill="var(--berry)" ${ST}/>`,
  },
  {
    id: 'string',
    name: 'ひも',
    draw: (l) =>
      `<path d="M6 17 H${l}" stroke="var(--ink)" stroke-width="6" stroke-linecap="round"/>`,
  },
  {
    id: 'stick',
    name: 'ぼう',
    draw: (l) => `<rect x="4" y="11" width="${l}" height="12" rx="6" fill="var(--wood)" ${ST}/>`,
  },
  {
    id: 'tape',
    name: 'テープ',
    draw: (l) => `<rect x="4" y="8" width="${l}" height="18" fill="var(--sky)" ${ST}/>`,
  },
];
const thingFig = (t: (typeof THINGS)[number], len: number) => svg(t.name, 250, 34, t.draw(len));

// ---- order3 ----
const LEN_SETS: [number, number, number][] = [
  [230, 160, 90],
  [220, 180, 120],
  [200, 140, 70],
  [240, 190, 120],
  [210, 170, 130],
  [190, 150, 110],
  [235, 205, 175],
  [180, 100, 60],
];
function orderItem(set: [number, number, number], i: number): OrderItem {
  const ts = mix(`o3:${i}`, THINGS).slice(0, 3);
  return {
    engine: 'order',
    id: `order3:${set.join('-')}`,
    objective: 'order3',
    level: 0,
    layout: 'column',
    prompt: 'ながい じゅんに ならべよう。ひだりの はしは そろって いるよ。',
    cards: set.map((len, k) => ({ figure: thingFig(ts[k]!, len), name: ts[k]!.name })),
    ends: ['ながい', 'みじかい'],
    reverseMisconception: 'order-reverse',
    wrongOrders: [
      { order: [1, 0, 2], misconception: 'close-lengths' },
      { order: [0, 2, 1], misconception: 'close-lengths' },
    ],
    hints: [
      'いちばん ながい ものから さがそう。',
      'みぎの はしが いちばん とおくまで のびて いるのは どれかな。',
    ],
    explain: `${ts.map((t) => t.name).join('、')}の じゅんに ながいね。`,
    identity: `order3:${set.join('-')}`,
  };
}

/** 別例: たかさ（たての つみき）を たかい じゅんに */
const tower = (n: number) =>
  svg(
    `つみき ${n}こ`,
    40,
    170,
    Array.from(
      { length: n },
      (_, i) =>
        `<rect x="4" y="${164 - (i + 1) * 20}" width="32" height="20" fill="var(--sun)" ${ST}/>`,
    ).join(''),
  );
const TOWERS: [number, number, number][] = [
  [8, 5, 3],
  [7, 6, 2],
  [6, 4, 1],
];
function towerItem(set: [number, number, number]): OrderItem {
  return {
    engine: 'order',
    id: `tower:${set.join('-')}`,
    objective: 'order3',
    level: 0,
    alt: true,
    prompt: 'つみきを たかい じゅんに ならべよう。',
    cards: set.map((n) => ({ figure: tower(n), name: `つみき ${n}こ` })),
    ends: ['たかい', 'ひくい'],
    reverseMisconception: 'order-reverse',
    hints: [
      'いちばん たかい ものから さがそう。',
      'したは そろって いるよ。うえの はしを くらべよう。',
    ],
    explain: `つみき ${set.join('こ、')}この じゅんに たかいね。`,
    identity: `tower:${set.join('-')}`,
  };
}

// ---- units（クリップ なんこぶん） ----
const CLIP = 30;
const clips = (n: number, y: number) =>
  Array.from(
    { length: n },
    (_, i) =>
      `<rect x="${4 + i * CLIP}" y="${y}" width="${CLIP - 2}" height="12" rx="6" fill="var(--paper)" ${ST}/><rect x="${10 + i * CLIP}" y="${y + 4}" width="${CLIP - 14}" height="4" rx="2" fill="none" stroke="var(--ink)" stroke-width="2"/>`,
  ).join('');
function unitsItem(n: number): Item {
  const t = THINGS[n % THINGS.length]!;
  const id = `units:${n}`;
  const wrongs = [n + 1, n - 1, n + 2].filter((v) => v >= 1 && v <= 9);
  return choiceItem({
    id,
    objective: 'units',
    level: 1,
    prompt: `${t.name}の ながさは、クリップ なんこぶん？`,
    figure: svg(`${t.name}と クリップ`, 4 + 9 * CLIP, 60, t.draw(n * CLIP - 2) + clips(n, 40)),
    hints: [
      'クリップに ひとつずつ ゆびを おいて かぞえよう。',
      `${t.name}の みぎの はしまで かぞえよう。`,
    ],
    explain: `クリップ ${n}こぶん の ながさ だね。`,
    identity: id,
    correct: { label: String(n) },
    wrong: wrongs
      .slice(0, 3)
      .map((v) => ({ label: String(v), misconception: v === n + 1 ? 'gap-count' : 'skip-unit' })),
  });
}

/** 別例: めもり いくつぶん（measure。ものさしは 1めもりずつ） */
function rulerItem(n: number): MeasureItem {
  return {
    engine: 'measure',
    id: `ruler:${n}`,
    objective: 'units',
    level: 1,
    alt: true,
    prompt: 'テープの ながさは、めもり いくつぶん？ すうじで こたえよう。',
    hints: [
      'テープの ひだりの はしは 0に そろって いるよ。',
      'みぎの はしまで、めもりの あいだを かぞえよう。',
    ],
    explain: `めもり ${n}つぶん だね。`,
    identity: `ruler:${n}`,
    instrument: 'ruler',
    scale: { unit: 'こ', min: 0, max: 10, minor: 1, major: 1 },
    task: 'read',
    value: n,
    object: 'tape',
    fields: [{ unit: 'こ', factor: 1 }],
    wrongAnswers: [{ value: n + 1, misconception: 'gap-count' }],
  };
}

// ---- indirect（テープで くらべる） ----
const SCENES: { id: string; a: string; b: string; la: number; lb: number }[] = [
  { id: 'desk-door', a: 'つくえの よこ', b: 'ドアの はば', la: 200, lb: 140 },
  { id: 'bed-sofa', a: 'ベッドの ながさ', b: 'ソファの ながさ', la: 230, lb: 170 },
  { id: 'window-shelf', a: 'まどの はば', b: 'たなの はば', la: 120, lb: 190 },
  { id: 'box-table', a: 'はこの たかさ', b: 'いすの たかさ', la: 110, lb: 150 },
  { id: 'tree-pole', a: 'きの まわり', b: 'はしらの まわり', la: 210, lb: 130 },
  { id: 'rug-mat', a: 'じゅうたんの よこ', b: 'マットの よこ', la: 180, lb: 230 },
];
function indirectItem(s: (typeof SCENES)[number]): Item {
  const longA = s.la > s.lb;
  return choiceItem({
    id: `indirect:${s.id}`,
    objective: 'indirect',
    level: 2,
    prompt: `${s.a}と ${s.b}を テープで はかって、テープを ならべたよ。ながいのは どっち？`,
    figure: svg(
      '2ほんの テープ',
      250,
      70,
      `<rect x="4" y="6" width="${s.la}" height="20" fill="var(--sun)" ${ST}/><rect x="4" y="42" width="${s.lb}" height="20" fill="var(--sky)" ${ST}/>`,
    ),
    hints: [
      'テープの ひだりの はしは そろって いるね。',
      'うえの テープが ' + s.a + '、したの テープが ' + s.b + 'だよ。',
    ],
    explain: `テープが ながい ほうが ながい。${longA ? s.a : s.b}の ほうが ながいね。`,
    identity: `indirect:${s.id}`,
    correct: { label: longA ? s.a : s.b },
    wrong: [{ label: longA ? s.b : s.a, misconception: 'tape-mixup' }],
  });
}

/** 別例: クリップの かずで くらべる */
const BYUNITS: [number, number][] = [
  [5, 7],
  [8, 6],
  [4, 9],
];
function byUnitsItem([a, b]: [number, number]): Item {
  return choiceItem({
    id: `byunits:${a}-${b}`,
    objective: 'indirect',
    level: 2,
    alt: true,
    prompt: `あかい テープは クリップ ${a}こぶん、あおい テープは クリップ ${b}こぶん。ながいのは どっち？`,
    hints: [
      'クリップの かずが おおい ほうが ながいよ。',
      `${a}と ${b}、どっちが おおきい かずかな。`,
    ],
    explain: `${Math.max(a, b)}こぶんの ほうが ながいね。`,
    identity: `byunits:${a}-${b}`,
    correct: { label: a > b ? 'あかい テープ' : 'あおい テープ' },
    wrong: [{ label: a > b ? 'あおい テープ' : 'あかい テープ', misconception: 'fewer-longer' }],
  });
}

function build(): Item[] {
  return [
    ...LEN_SETS.map(orderItem),
    ...TOWERS.map(towerItem),
    ...[2, 3, 4, 5, 6, 7, 8, 9].map(unitsItem),
    ...[3, 5, 7].map(rulerItem),
    ...SCENES.map(indirectItem),
    ...BYUNITS.map(byUnitsItem),
  ];
}

export const measureCompare: UnitSpec = {
  id: 'p5.math.measure-compare',
  title: 'ながさくらべ',
  stage: 'p5',
  subject: 'math',
  domain: 'play',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-compare',
  prereq: ['p4.math.compare'],
  objectives: [
    { id: 'order3', title: '3つを ながい じゅんに ならべる' },
    { id: 'units', title: 'クリップ なんこぶん' },
    { id: 'indirect', title: 'テープで はかって くらべる' },
  ],
  misconceptions: [
    { id: 'order-reverse', explain: 'じゅんばんが はんたいかな。「ながい」から ならべよう。' },
    {
      id: 'close-lengths',
      explain: 'ちかい ながさを とりちがえたかな。みぎの はしを よく くらべよう。',
    },
    {
      id: 'gap-count',
      explain: 'すきまや めもりの せんを かぞえたのかな。クリップ（あいだ）の かずを かぞえよう。',
    },
    { id: 'skip-unit', explain: 'かぞえ わすれが あったかな。はしから じゅんに ゆびを おこう。' },
    {
      id: 'tape-mixup',
      explain: 'どの テープが どれを はかったか たしかめよう。テープが ながい ほうが ながいよ。',
    },
    { id: 'fewer-longer', explain: 'クリップが おおい ほうが ながいよ。' },
  ],
  levels: [
    { label: '3つを ならべる', chance: 1 / 6 },
    { label: 'いくつぶん', chance: 1 / 4 },
    { label: 'テープで くらべる', chance: 0.5 },
  ],
  intro: [
    {
      text: 'ながさを くらべる ときは、ひだりの はしを そろえるよ。',
      figure: svg(
        '2ほんの テープ',
        250,
        70,
        `<rect x="4" y="6" width="200" height="20" fill="var(--sun)" ${ST}/><rect x="4" y="42" width="130" height="20" fill="var(--sky)" ${ST}/>`,
      ),
    },
    {
      text: 'クリップを ならべて、いくつぶんかを かぞえても くらべられるね。',
      figure: svg('クリップ', 4 + 9 * CLIP, 30, clips(5, 8)),
    },
  ],
  source: { kind: 'items', items: build() },
  review: 'view',
  basis:
    '幼稚園教育要領解説（長さを比べる）、小学校学習指導要領 算数 第1学年 C（長さの比較）へ接続、curriculum-matrix 3.3・4.1',
  gradeIsAppProposal: true,
  revised: '2026-10-24',
};
