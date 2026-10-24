/**
 * g3.math.large-numbers 万の単位、10倍・100倍・1000倍、10でわった数（curriculum-matrix 3.6）。
 * 位の表を万へ → 10倍で位が上がる → 数直線（1目盛り1000など）。数は1億未満（千万の位まで）。
 *
 * 同一性キー: 問う形 × 数（'compose:30504000'、'times:350x100' など）。
 * 定義域: どの形も数百通り以上。
 */
import type { Rng } from '../../core/util/rng';
import type { NumberlineItem } from '../../engines/numberline/numberline';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { numberReading } from '../../text/rich';
import { pickObj, pickOne, wrongList } from './util';

type Obj = 'compose' | 'place' | 'compare' | 'times' | 'div10' | 'line';

const KD = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** 1〜9999 の漢数字（千・百・十の前の 一 は書かない） */
function kanjiGroup(n: number): string {
  const units: [number, string][] = [
    [1000, '千'],
    [100, '百'],
    [10, '十'],
  ];
  let s = '';
  let rest = n;
  for (const [u, k] of units) {
    const d = Math.floor(rest / u);
    if (d > 0) s += (d === 1 ? '' : KD[d]) + k;
    rest %= u;
  }
  return s + KD[rest];
}
/** 1億未満の漢数字（よみ付き）。例 30504000 → 三千五十万四千《さんぜんごじゅうまんよんせん》 */
export function kanjiNumber(n: number): string {
  const hi = Math.floor(n / 10000);
  const lo = n % 10000;
  const k = (hi ? `${kanjiGroup(hi)}万` : '') + (lo ? kanjiGroup(lo) : '');
  const y = (hi ? `${numberReading(hi)}まん` : '') + (lo ? numberReading(lo) : '');
  return `${k}《${y}》`;
}

/** 位の名前（右から 0: 一の位 … 7: 千万の位） */
const PLACE8 = ['一《いち》', '十《じゅう》', '百《ひゃく》', '千《せん》', '一万《いちまん》', '十万《じゅうまん》', '百万《ひゃくまん》', '千万《せんまん》'];
const UNIT8 = ['1', '10', '100', '1000', '1万《まん》', '10万《まん》', '100万《まん》', '1000万《まん》'];

/** 5〜8けたの数（0の位を ふくむことが多い） */
function pickBig(rng: Rng): number {
  const len = rng.int(5, 8);
  const ds: number[] = [rng.int(1, 9)];
  for (let i = 1; i < len; i++) ds.push(rng.next() < 0.35 ? 0 : rng.int(1, 9));
  return Number(ds.join(''));
}

function compose(level: number, rng: Rng, alt: boolean): NumberItem {
  const n = pickBig(rng);
  const ds = String(n).split('').reverse().map(Number);
  const parts = ds.map((d, i) => [d, i] as const).filter(([d]) => d > 0).reverse();
  const counts = parts.map(([d, i]) => `${UNIT8[i]}を ${d}こ`).join('、');
  const squeezed = Number(parts.map(([d]) => d).join(''));
  return {
    engine: 'number',
    id: `compose${alt ? '-alt' : ''}:${n}`,
    objective: 'compose',
    level,
    prompt: alt ? '漢字《かんじ》で 書《か》いた 数《かず》を、数字《すうじ》で 書《か》こう。' : `${counts} あわせた 数《かず》は？`,
    figure: alt ? { kind: 'text', text: kanjiNumber(n), size: 'xl' } : undefined,
    hints: [
      `くらいの 表《ひょう》（${[...PLACE8].reverse().join('・')}）に 数字《すうじ》を 入《い》れて みよう。`,
      `いちばん 上《うえ》は ${PLACE8[ds.length - 1]}のくらい。${ds.length}けたの 数《かず》に なるよ。`,
      '何《なに》も ない くらいには 0を 書《か》こう。',
    ],
    explain: `${parts.map(([d, i]) => `${PLACE8[i]}のくらいが ${d}`).join('、')}。ない くらいは 0なので、${n}です。`,
    identity: `compose:${n}`,
    alt,
    fields: [{ answer: { kind: 'int', value: n } }],
    wrongAnswers: wrongList(String(n), 1, [
      [squeezed, 'zero-missing'],
      [n * 10, 'place-shift'],
      [n % 10 === 0 ? n / 10 : null, 'place-shift'],
    ]),
  };
}

function place(level: number, rng: Rng, alt: boolean): NumberItem {
  let n: number;
  do n = rng.int(10000000, 99999999);
  while (new Set(String(n)).size < 7);
  const i = rng.int(4, 7);
  const ds = String(n).split('').reverse().map(Number);
  const ans = ds[i]!;
  return {
    engine: 'number',
    id: `place${alt ? '-alt' : ''}:${n}:${i}`,
    objective: 'place',
    level,
    prompt: alt
      ? `漢字《かんじ》で 書《か》いた この 数《かず》の、${PLACE8[i]}のくらいの 数字《すうじ》は？`
      : `${n} の ${PLACE8[i]}のくらいの 数字《すうじ》は？`,
    figure: { kind: 'text', text: alt ? kanjiNumber(n) : String(n), size: 'xl' },
    hints: alt
      ? [
          '「万《まん》」の 字《じ》より 前《まえ》が、一万《いちまん》より 上《うえ》の くらいだよ。',
          '万《まん》の 前《まえ》の「千《せん》」が 千万《せんまん》、「百《ひゃく》」が 百万《ひゃくまん》、「十《じゅう》」が 十万《じゅうまん》の くらい。',
          `数字《すうじ》で 書《か》き直《なお》すと ${n}。ここから さがそう。`,
        ]
      : [
          '右《みぎ》から 4けたずつ 区切《くぎ》ると 読《よ》みやすいよ。',
          '右《みぎ》から 5けためが 一万《いちまん》のくらい。',
          `一万《いちまん》のくらいから 左《ひだり》へ、十万《じゅうまん》・百万《ひゃくまん》・千万《せんまん》と すすもう。`,
        ],
    explain: `${alt ? `数字《すうじ》で 書《か》くと ${n}。` : ''}右《みぎ》から ${i + 1}けためが ${PLACE8[i]}のくらいで、数字《すうじ》は ${ans}です。`,
    identity: `place:${n}:${i}`,
    alt,
    fields: [{ answer: { kind: 'int', value: ans } }],
    wrongAnswers: wrongList(String(ans), 1, [
      [ds[i - 1], 'place-shift'],
      [i < 7 ? ds[i + 1] : null, 'place-shift'],
      [ds[ds.length - 1 - i], 'place-left'],
    ]),
  };
}

function compare(level: number, rng: Rng, alt: boolean): ChoiceItem {
  // 正解: けたの 多い 大きい数。誤り: けたが 少ないが 上の数字が 大きい数・同じけたで 下の くらいだけ 大きい数
  const len = rng.int(5, 7);
  const lead = rng.int(1, 5);
  const big = lead * 10 ** (len - 1) + rng.int(0, 10 ** (len - 1) - 1);
  const short = rng.int(lead + 1, 9) * 10 ** (len - 2) + rng.int(0, 10 ** (len - 2) - 1);
  const s = String(big);
  // 同じけたで、2けためが 小さく、一の位が 大きい数
  const d2 = Number(s[1]);
  const lower = d2 > 0 ? Number(s[0] + String(d2 - 1) + '9'.repeat(len - 2)) : null;
  if (alt) {
    const a = rng.next() < 0.5;
    const left = a ? big : short;
    const right = a ? short : big;
    return {
      engine: 'choice',
      id: `compare-alt:${left}:${right}`,
      objective: 'compare',
      level,
      prompt: `□に あてはまる しるしは どれ？\n${left} □ ${right}`,
      hints: ['まず けたの 数《かず》を くらべよう。', `${left}は ${String(left).length}けた、${right}は ${String(right).length}けた。`, 'けたの 多《おお》い ほうが 大《おお》きい。ひらいて いる ほうが 大《おお》きい 数《かず》だよ。'],
      explain: `${big}の ほうが けたが 多《おお》いので 大《おお》きい。${left} ${a ? '＞' : '＜'} ${right} です。`,
      identity: `compare:${big}:${short}`,
      alt: true,
      fixedOrder: true,
      options: [
        { label: '＞', ...(a ? { correct: true } : { misconception: 'first-digit' }) },
        { label: '＜', ...(a ? { misconception: 'first-digit' } : { correct: true }) },
        { label: '＝', misconception: 'sign-meaning' },
      ],
    };
  }
  return {
    engine: 'choice',
    id: `compare:${big}:${short}`,
    objective: 'compare',
    level,
    prompt: 'いちばん 大《おお》きい 数《かず》は どれ？',
    hints: ['まず けたの 数《かず》を くらべよう。', 'けたの 数《かず》が おなじ ときは、上《うえ》の くらいから くらべよう。', 'いちばん 上《うえ》の くらいの 数字《すうじ》だけで きめないでね。'],
    explain: `${big}は ${len}けたで、いちばん けたが 多《おお》い（${lower !== null ? `おなじ けたの ${lower}より 上《うえ》から 2けためが 大《おお》きい` : 'ほかより 大《おお》きい'}）。いちばん 大《おお》きいのは ${big}です。`,
    identity: `compare:${big}:${short}`,
    alt: false,
    options: [
      { label: String(big), correct: true },
      { label: String(short), misconception: 'first-digit' },
      ...(lower !== null && lower !== big ? [{ label: String(lower), misconception: 'lower-place' }] : []),
      { label: String(Math.floor(short / 10) + 1), misconception: 'first-digit' },
    ],
  };
}

function times(level: number, rng: Rng, alt: boolean): NumberItem {
  const k = pickOne(rng, [10, 100, 1000] as const);
  const n = rng.int(2, 999) * (rng.next() < 0.3 ? 10 : 1);
  const z = String(k).length - 1;
  const ans = n * k;
  return {
    engine: 'number',
    id: `times${alt ? '-alt' : ''}:${n}x${k}`,
    objective: 'times',
    level,
    prompt: alt ? `1こ ${n}円《えん》の ものを ${k}こ 買《か》うと、何《なん》円《えん》ですか。` : `${n}を ${k}倍《ばい》した 数《かず》は？`,
    figure: alt ? undefined : { kind: 'text', text: `${n} × ${k} ＝ {{}}`, size: 'xl' },
    hints: [
      `${k}倍《ばい》すると、くらいが ${z}つ 上《あ》がるよ。`,
      `数字《すうじ》の ならびは かわらず、右《みぎ》に 0を ${z}こ つけるよ。`,
      `${n}の 右《みぎ》に 0を つけて みよう。`,
    ],
    explain: `${k}倍《ばい》すると くらいが ${z}つ 上《あ》がり、右《みぎ》に 0を ${z}こ つけた 数《かず》に なります。${n} × ${k} ＝ ${ans}。`,
    identity: `times:${n}x${k}`,
    alt,
    fields: [{ ...(alt ? { label: '円《えん》' } : {}), answer: { kind: 'int', value: ans } }],
    wrongAnswers: wrongList(String(ans), 1, [
      [n * k * 10, 'zeros-count'],
      [k > 10 ? (n * k) / 10 : null, 'zeros-count'],
      [n + k, 'times-add'],
    ]),
  };
}

function div10(level: number, rng: Rng, alt: boolean): NumberItem {
  const n = rng.int(2, 9999) * 10;
  const ans = n / 10;
  return {
    engine: 'number',
    id: `div10${alt ? '-alt' : ''}:${n}`,
    objective: 'div10',
    level,
    prompt: alt ? `${n}円《えん》を 10人《にん》で 同《おな》じ 金《きん》がくずつ 分《わ》けると、1人分《ひとりぶん》は 何《なん》円《えん》ですか。` : `${n}を 10で わった 数《かず》は？`,
    figure: alt ? undefined : { kind: 'text', text: `${n} ÷ 10 ＝ {{}}`, size: 'xl' },
    hints: ['10で わると、くらいが 1つ 下《さ》がるよ。', '一《いち》のくらいの 0を とった 数《かず》に なるよ。', `${n}の 右《みぎ》の 0を 1こ とると…`],
    explain: `10で わると くらいが 1つ 下《さ》がり、一《いち》のくらいの 0を とった 数《かず》に なります。${n} ÷ 10 ＝ ${ans}。`,
    identity: `div10:${n}`,
    alt,
    fields: [{ ...(alt ? { label: '円《えん》' } : {}), answer: { kind: 'int', value: ans } }],
    wrongAnswers: wrongList(String(ans), 1, [
      [n % 100 === 0 ? n / 100 : null, 'zeros-count'],
      [n * 10, 'zeros-count'],
      [n - 10, 'times-add'],
    ]),
  };
}

const LINES = [
  { max: 100000, minor: 1000, unit: '1000' },
  { max: 1000000, minor: 10000, unit: '1万《まん》' },
  { max: 10000000, minor: 100000, unit: '10万《まん》' },
  { max: 100000000, minor: 1000000, unit: '100万《まん》' },
] as const;

function line(level: number, rng: Rng, alt: boolean): NumberlineItem {
  const L = pickOne(rng, LINES);
  let k: number;
  do k = rng.int(1, 99);
  while (k % 10 === 0);
  const v = k * L.minor;
  const base = {
    engine: 'numberline' as const,
    objective: 'line',
    level,
    line: { min: 0, max: L.max, minor: L.minor, midEvery: 5, majorEvery: 10 },
    misconceptions: { minorAsOne: 'minor-as-one', neighborTick: 'neighbor-tick' },
  };
  const hints = [
    `いちばん 小《ちい》さい 1めもりは いくつかな。`,
    `10めもりで ${L.max / 10}。1めもりは ${L.unit}。`,
    `${Math.floor(k / 10) * L.minor * 10}から ${k % 10}めもり すすんだ ところ。`,
  ];
  const explain = `1めもりは ${L.unit}。${Math.floor(k / 10) * L.minor * 10}から ${k % 10}めもりで ${v}です。`;
  if (alt)
    return {
      ...base,
      id: `line-alt:${L.max}:${v}`,
      prompt: `${v}を あらわす めもりを タップしよう。`,
      hints,
      explain,
      identity: `line-place:${L.max}:${v}`,
      alt: true,
      task: { kind: 'place', target: v },
    };
  return {
    ...base,
    id: `line:${L.max}:${v}`,
    prompt: '↓の めもりが あらわす 数《かず》は？',
    hints,
    explain,
    identity: `line:${L.max}:${v}`,
    alt: false,
    task: { kind: 'read', at: v },
    wrongAnswers: [{ value: k, misconception: 'minor-as-one' }],
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['compose', 'place'] },
  { objs: ['compose', 'place', 'compare', 'line'] },
  { objs: ['times', 'div10', 'compare'] },
  { objs: ['compose', 'times', 'div10', 'line'] },
];

export function generateLargeNumbers(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.25;
  switch (obj) {
    case 'compose':
      return compose(level, rng, alt);
    case 'place':
      return place(level, rng, alt);
    case 'compare':
      return compare(level, rng, alt);
    case 'times':
      return times(level, rng, alt);
    case 'div10':
      return div10(level, rng, alt);
    case 'line':
      return line(level, rng, alt);
  }
}

export const largeNumbers: UnitSpec = {
  id: 'g3.math.large-numbers',
  title: '大《おお》きい 数《かず》（万《まん》の くらい）',
  stage: 'g3',
  subject: 'math',
  domain: 'A-number',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-sansu',
  prereq: ['g2.math.numbers-10000'],
  objectives: [
    { id: 'compose', title: '数《かず》の しくみ（万《まん》の くらい・漢字《かんじ》で 書《か》いた 数《かず》）' },
    { id: 'place', title: 'くらいの 数字《すうじ》' },
    { id: 'compare', title: '大《おお》きさくらべ' },
    { id: 'times', title: '10倍《ばい》・100倍《ばい》・1000倍《ばい》' },
    { id: 'div10', title: '10で わった 数《かず》' },
    { id: 'line', title: '数直線《すうちょくせん》' },
  ],
  misconceptions: [
    {
      id: 'zero-missing',
      explain: '何《なに》も ない くらいの 0を 書《か》きわすれたのかな。くらいの 表《ひょう》に 入《い》れて、空《あ》いた くらいに 0を 書《か》こう。',
      figure: { kind: 'text', text: '3005万 → 30050000', size: 'l' },
    },
    {
      id: 'place-shift',
      explain: 'くらいが 1つ ずれたのかな。右《みぎ》から 一《いち》・十《じゅう》・百《ひゃく》・千《せん》・一万《いちまん》…と 数《かぞ》えよう。',
    },
    {
      id: 'place-left',
      explain: '左《ひだり》から 数《かぞ》えたのかな。くらいは 右《みぎ》の 一《いち》のくらいから 数《かぞ》えるよ。',
    },
    {
      id: 'first-digit',
      explain: 'いちばん 上《うえ》の 数字《すうじ》だけで くらべたのかな。まず けたの 数《かず》を くらべよう。けたが 多《おお》い ほうが 大《おお》きいよ。',
    },
    {
      id: 'lower-place',
      explain: '下《した》の くらいから くらべたのかな。けたが おなじ ときは、上《うえ》の くらいから じゅんに くらべよう。',
    },
    {
      id: 'sign-meaning',
      explain: '＝ は おなじ 大《おお》きさの ときに つかうよ。大《おお》きい ほうに ひらいた ＞ ＜ を つかおう。',
    },
    {
      id: 'zeros-count',
      explain: '0の 数《かず》が あって いないのかな。10倍《ばい》で 0が 1こ、100倍《ばい》で 2こ、1000倍《ばい》で 3こ ふえるよ。10で わると 0が 1こ へるよ。',
    },
    {
      id: 'times-add',
      explain: 'たし算《ざん》や ひき算《ざん》を したのかな。10倍《ばい》は おなじ 数《かず》を 10こ あつめる ことだよ。',
    },
    {
      id: 'minor-as-one',
      explain: '1めもりを 1と 数《かぞ》えたのかな。10めもりで いくつに なるかを 見《み》て、1めもりの 大《おお》きさを 先《さき》に きめよう。',
    },
    {
      id: 'neighbor-tick',
      explain: 'めもりを 1つ 数《かぞ》えまちがえたのかな。数字《すうじ》の ある めもりから 1つずつ 数《かぞ》えよう。',
    },
  ],
  levels: [
    { label: '数の しくみ', chance: 0.05 },
    { label: '大きさくらべ・数直線', chance: 0.05 },
    { label: '10倍・10でわる', chance: 0.05 },
    { label: 'まとめ', chance: 0.05 },
  ],
  intro: [
    {
      text: '1000を 10こ あつめた 数《かず》を 一万《いちまん》（10000）と いいます。一万《いちまん》が 10こで 十万《じゅうまん》、100こで 百万《ひゃくまん》、1000こで 千万《せんまん》。',
      figure: { kind: 'table', header: ['千万《せんまん》', '百万《ひゃくまん》', '十万《じゅうまん》', '一万《いちまん》', '千《せん》', '百《ひゃく》', '十《じゅう》', '一《いち》'], rows: [['3', '0', '5', '0', '4', '0', '0', '0']] },
    },
    {
      text: 'この 数《かず》は 三千五十万四千《さんぜんごじゅうまんよんせん》。何《なに》も ない くらいには 0を 書《か》きます。',
      figure: { kind: 'text', text: '30504000', size: 'xl' },
    },
    {
      text: '10倍《ばい》すると くらいが 1つ 上《あ》がり、右《みぎ》に 0が 1こ つきます。10で わると くらいが 1つ 下《さ》がります。',
      figure: { kind: 'text', text: '350 × 10 ＝ 3500　3500 ÷ 10 ＝ 350', size: 'l' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateLargeNumbers(level, rng, index),
  },
  review: 'objective',
  basis: '小学校学習指導要領（平成29年告示）算数 第3学年 A(1) 数の表し方（万の単位、10倍・100倍・1000倍、10でわった大きさ。1億に触れる）',
  revised: '2026-10-24',
};
