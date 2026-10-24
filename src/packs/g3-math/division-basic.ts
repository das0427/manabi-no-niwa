/**
 * g3.math.division-basic わり算の意味（等分除・包含除）、九九1回で求める、簡単な2位数の商（curriculum-matrix 3.6）。
 * おはじきを同じ数ずつ分ける → 式と九九 → 包含除の文章題・0や1のわり算・60÷3。
 *
 * 同一性キー: 式 'D÷d'（わり算は入れかえられないので向きは固定）。文章題は「場面 × 式」。
 * 定義域: 九九の逆（わる数 2〜9・商 2〜9）64、0と1のわり算 26、簡単な2位数÷1位数 48、
 *   文章題は 場面8 × 九九の逆 64。数は全件を均等に選ぶ。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { opts, pickObj, pickOne, wrongList } from './util';

type Obj = 'touwake' | 'hougan' | 'kuku' | 'zero-one' | 'big';

/** 九九の逆: [わられる数, わる数]（わる数 2〜9、商 2〜9） */
const KUKU: [number, number][] = [];
for (let d = 2; d <= 9; d++) for (let q = 2; q <= 9; q++) KUKU.push([d * q, d]);

/** 0と1のわり算 */
const ZERO_ONE: [number, number][] = [];
for (let n = 1; n <= 9; n++) ZERO_ONE.push([0, n], [n, 1]);
for (let n = 2; n <= 9; n++) ZERO_ONE.push([n, n]);

/** 簡単な2位数÷1位数（各位が わりきれ、商が2けた） */
const BIG: [number, number][] = [];
for (let d = 2; d <= 9; d++)
  for (let x = d; x <= 9; x += d) for (let y = 0; y <= 9; y += d) BIG.push([x * 10 + y, d]);

/** 九九の段の取り違え: D を別の九九で作ったときの、もう1つの数 */
function wrongRow(D: number, d: number): number | null {
  const q = D / d;
  for (let x = 2; x <= 9; x++) {
    if (x === d || D % x !== 0) continue;
    const y = D / x;
    if (y >= 1 && y <= 9 && y !== q && x !== q) return y;
  }
  return null;
}

function divWrongs(D: number, d: number): [number | null, string][] {
  const q = D / d;
  return [
    [wrongRow(D, d), 'wrong-row'],
    [q + 1, 'neighbor'],
    [q > 1 ? q - 1 : null, 'neighbor'],
    [D - d, 'wrong-op'],
  ];
}

const marbles = (D: number, d: number, grouped: boolean): Figure =>
  grouped
    ? {
        kind: 'row',
        items: Array.from(
          { length: d },
          () => ({ kind: 'illust', id: 'ball', count: D / d }) as Figure,
        ),
        gap: 8,
      }
    : { kind: 'illust', id: 'ball', count: D };

interface Scene {
  id: string;
  type: 'touwake' | 'hougan';
  unit: string;
  text: (D: number, d: number) => string;
}
/** 文章題の場面（等分除4・包含除4） */
const SCENES: Scene[] = [
  {
    id: 'candy',
    type: 'touwake',
    unit: 'こ',
    text: (D, d) =>
      `あめが ${D}こ あります。${d}人《にん》で 同《おな》じ 数《かず》ずつ 分《わ》けると、1人分《ひとりぶん》は 何《なん》こですか。`,
  },
  {
    id: 'pencils',
    type: 'touwake',
    unit: '本《ぽん》',
    text: (D, d) =>
      `えんぴつ ${D}本《ほん》を ${d}つの ふでばこに 同《おな》じ 数《かず》ずつ 入《い》れます。1つの ふでばこは 何《なん》本《ぼん》に なりますか。`,
  },
  {
    id: 'cards',
    type: 'touwake',
    unit: 'まい',
    text: (D, d) =>
      `カード ${D}まいを ${d}人《にん》で 同《おな》じ 数《かず》ずつ 分《わ》けます。1人分《ひとりぶん》は 何《なん》まいですか。`,
  },
  {
    id: 'flowers',
    type: 'touwake',
    unit: '本《ぽん》',
    text: (D, d) =>
      `花《はな》が ${D}本《ほん》 あります。${d}つの 花《か》びんに 同《おな》じ 数《かず》ずつ 分《わ》けて さします。1つの 花《か》びんは 何《なん》本《ぼん》ですか。`,
  },
  {
    id: 'cookies',
    type: 'hougan',
    unit: 'ふくろ',
    text: (D, d) =>
      `クッキーが ${D}まい あります。1ふくろに ${d}まいずつ 入《い》れると、何《なん》ふくろ できますか。`,
  },
  {
    id: 'teams',
    type: 'hougan',
    unit: 'チーム',
    text: (D, d) =>
      `${D}人《にん》が ${d}人《にん》ずつ チームを 作《つく》ります。何《なん》チーム できますか。`,
  },
  {
    id: 'ribbon',
    type: 'hougan',
    unit: '本《ぽん》',
    text: (D, d) =>
      `${D}cmの リボンを ${d}cmずつ 切《き》ります。${d}cmの リボンは 何《なん》本《ぼん》 できますか。`,
  },
  {
    id: 'eggs',
    type: 'hougan',
    unit: 'パック',
    text: (D, d) =>
      `たまごが ${D}こ あります。1パックに ${d}こずつ 入《い》れると、何《なん》パック できますか。`,
  },
];

function wordItem(
  obj: 'touwake' | 'hougan',
  level: number,
  rng: Rng,
  alt: boolean,
): NumberItem | ChoiceItem {
  const sc = pickOne(
    rng,
    SCENES.filter((s) => s.type === obj),
  );
  const [D, d] = pickOne(rng, KUKU);
  const q = D / d;
  const hints =
    obj === 'touwake'
      ? [
          '同《おな》じ 数《かず》ずつ 分《わ》けて、1つ分《ぶん》の 数《かず》を もとめる わり算《ざん》だね。',
          `式《しき》は ${D} ÷ ${d}。`,
          `${d} × □ ＝ ${D} の □を 九九《くく》で さがそう（${d}の だん）。`,
        ]
      : [
          'いくつずつ 分《わ》けると、いくつ分《ぶん》 できるかを もとめる わり算《ざん》だね。',
          `式《しき》は ${D} ÷ ${d}。`,
          `□ × ${d} ＝ ${D} の □を 九九《くく》で さがそう（${d}の だん）。`,
        ];
  const explain = `式《しき》は ${D} ÷ ${d} ＝ ${q}。${obj === 'touwake' ? `${d} × ${q} ＝ ${D}` : `${q} × ${d} ＝ ${D}`} だから、答《こた》えは ${q}${sc.unit}です。`;
  if (alt)
    return {
      engine: 'choice',
      id: `${obj}-alt:${sc.id}:${D}/${d}`,
      objective: obj,
      level,
      prompt: `${sc.text(D, d)}\nこの もんだいに あう 式《しき》は どれ？`,
      figure: marbles(D, d, obj === 'touwake'),
      hints: [
        hints[0]!,
        '同《おな》じ 数《かず》ずつ 分《わ》ける ときは わり算《ざん》。',
        `わられる数《かず》は 全部《ぜんぶ》の 数《かず》の ${D}。`,
      ],
      explain,
      identity: `${sc.id}:${D}÷${d}`,
      alt: true,
      options: opts(`${D} ÷ ${d}`, [
        [`${D} − ${d}`, 'wrong-op'],
        [`${D} × ${d}`, 'wrong-op'],
        [`${D} ＋ ${d}`, 'wrong-op'],
      ]),
    };
  return {
    engine: 'number',
    id: `${obj}:${sc.id}:${D}/${d}`,
    objective: obj,
    level,
    prompt: sc.text(D, d),
    hints,
    explain,
    identity: `${sc.id}:${D}÷${d}`,
    alt: false,
    fields: [{ label: sc.unit, answer: { kind: 'int', value: q } }],
    wrongAnswers: wrongList(String(q), 1, divWrongs(D, d)),
  };
}

function kuku(level: number, rng: Rng, alt: boolean): NumberItem {
  const [D, d] = pickOne(rng, KUKU);
  const q = D / d;
  return {
    engine: 'number',
    id: `kuku${alt ? '-alt' : ''}:${D}/${d}`,
    objective: 'kuku',
    level,
    prompt: alt
      ? '□に あてはまる 数《かず》は？ わり算《ざん》の 答《こた》えを 九九《くく》で 見《み》つけよう。'
      : '計算《けいさん》しよう。',
    figure: {
      kind: 'text',
      text: alt ? `${d} × {{}} ＝ ${D}  →  ${D} ÷ ${d} ＝ □` : `${D} ÷ ${d} ＝ {{}}`,
      size: 'xl',
    },
    hints: [
      `わる数《かず》の ${d}の だんの 九九《くく》を つかおう。`,
      `${d} × □ ＝ ${D}。`,
      `${d}の だんを じゅんに: ${d}、${d * 2}、${d * 3}、…`,
    ],
    explain: `${d} × ${q} ＝ ${D} だから、${D} ÷ ${d} ＝ ${q}です。`,
    identity: `${D}÷${d}`,
    alt,
    fields: [{ answer: { kind: 'int', value: q } }],
    wrongAnswers: wrongList(String(q), 1, divWrongs(D, d)),
  };
}

function zeroOne(level: number, rng: Rng, alt: boolean): NumberItem {
  const [D, d] = pickOne(rng, ZERO_ONE);
  const q = D / d;
  const kind = D === 0 ? 'zero' : d === 1 ? 'one' : 'same';
  const why =
    kind === 'zero'
      ? `0こを ${d}人《にん》で 分《わ》けても、1人分《ひとりぶん》は 0こ。0を 0で ない 数《かず》で わると 答《こた》えは 0です。`
      : kind === 'one'
        ? `${D}こを 1人《り》で 分《わ》けると、1人分《ひとりぶん》は ${D}こ。1で わると 答《こた》えは わられる数《かず》と おなじです。`
        : `${D}こを ${D}人《にん》で 分《わ》けると、1人分《ひとりぶん》は 1こ。おなじ 数《かず》どうしで わると 答《こた》えは 1です。`;
  return {
    engine: 'number',
    id: `zero-one${alt ? '-alt' : ''}:${D}/${d}`,
    objective: 'zero-one',
    level,
    prompt: alt
      ? `あめが ${D}こ あります。${d}人《にん》で 同《おな》じ 数《かず》ずつ 分《わ》けると、1人分《ひとりぶん》は 何《なん》こですか。`
      : '計算《けいさん》しよう。',
    figure: alt ? undefined : { kind: 'text', text: `${D} ÷ ${d} ＝ {{}}`, size: 'xl' },
    hints: [
      kind === 'zero'
        ? '0こを 分《わ》けると…'
        : kind === 'one'
          ? '1人《り》で 分《わ》けると…'
          : 'おなじ 数《かず》で 分《わ》けると…',
      `${d} × □ ＝ ${D} を 考《かんが》えよう。`,
      kind === 'zero'
        ? `${d} × 0 は いくつかな。`
        : kind === 'one'
          ? `1 × ${D} は いくつかな。`
          : `${d} × 1 は いくつかな。`,
    ],
    explain: why,
    identity: `${D}÷${d}`,
    alt,
    fields: [{ ...(alt ? { label: 'こ' } : {}), answer: { kind: 'int', value: q } }],
    wrongAnswers: wrongList(String(q), 1, [
      [kind === 'zero' ? d : null, 'zero-div'],
      [kind === 'one' ? 1 : null, 'one-div'],
      [kind === 'one' ? 0 : null, 'one-div'],
      [kind === 'same' ? 0 : null, 'one-div'],
      [kind === 'same' ? D : null, 'one-div'],
    ]),
  };
}

function big(level: number, rng: Rng, alt: boolean): NumberItem {
  const [D, d] = pickOne(rng, BIG);
  const q = D / d;
  const x = Math.floor(D / 10);
  const y = D % 10;
  return {
    engine: 'number',
    id: `big${alt ? '-alt' : ''}:${D}/${d}`,
    objective: 'big',
    level,
    prompt: alt
      ? `10の たばと ばらで 考《かんが》えよう。${D}本《ぽん》を ${d}人《にん》で 同《おな》じ 数《かず》ずつ 分《わ》けると、1人分《ひとりぶん》は 何《なん》本《ぼん》？`
      : '計算《けいさん》しよう。',
    figure: alt
      ? { kind: 'blocks', tens: x, ones: y }
      : { kind: 'text', text: `${D} ÷ ${d} ＝ {{}}`, size: 'xl' },
    hints: [
      y === 0 ? `${D}は 10の たばが ${x}たば。` : `${D}を ${x * 10}と ${y}に 分《わ》けよう。`,
      `${x * 10} ÷ ${d} は、10の たばが ${x} ÷ ${d} ＝ ${x / d}たば。`,
      y === 0
        ? `10の たばが ${x / d}たばで いくつかな。`
        : `${y} ÷ ${d} ＝ ${y / d}。2つを あわせよう。`,
    ],
    explain:
      y === 0
        ? `10の たば ${x}たばを ${d}つに 分《わ》けると ${x / d}たば。${D} ÷ ${d} ＝ ${q}です。`
        : `${x * 10} ÷ ${d} ＝ ${(x / d) * 10}、${y} ÷ ${d} ＝ ${y / d}。あわせて ${q}。${D} ÷ ${d} ＝ ${q}です。`,
    identity: `${D}÷${d}`,
    alt,
    fields: [{ ...(alt ? { label: '本《ぽん》' } : {}), answer: { kind: 'int', value: q } }],
    wrongAnswers: wrongList(String(q), 1, [
      [x / d + y / d, 'tens-drop'],
      [y ? (x / d) * 10 : null, 'ones-forget'],
      [D - d, 'wrong-op'],
    ]),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['touwake', 'hougan'] },
  { objs: ['touwake', 'hougan', 'kuku'] },
  { objs: ['kuku', 'zero-one', 'hougan'] },
  { objs: ['kuku', 'zero-one', 'big', 'touwake'] },
];

export function generateDivisionBasic(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.25;
  switch (obj) {
    case 'touwake':
    case 'hougan':
      return wordItem(obj, level, rng, alt);
    case 'kuku':
      return kuku(level, rng, alt);
    case 'zero-one':
      return zeroOne(level, rng, alt);
    case 'big':
      return big(level, rng, alt);
  }
}

export const divisionBasic: UnitSpec = {
  id: 'g3.math.division-basic',
  title: 'わり算《ざん》',
  stage: 'g3',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'math-split',
  prereq: ['g2.math.times-tables'],
  objectives: [
    {
      id: 'touwake',
      title: '同《おな》じ 数《かず》ずつ 分《わ》ける（1人分《ひとりぶん》を もとめる）',
    },
    { id: 'hougan', title: 'いくつずつ 分《わ》ける（いくつ分《ぶん》を もとめる）' },
    { id: 'kuku', title: '九九《くく》で わり算《ざん》の 答《こた》えを 見《み》つける' },
    { id: 'zero-one', title: '0や 1の わり算《ざん》' },
    { id: 'big', title: '60 ÷ 3、48 ÷ 4 のような わり算《ざん》' },
  ],
  misconceptions: [
    {
      id: 'wrong-row',
      explain:
        'ちがう だんの 九九《くく》を つかったのかな。わる数《かず》の だんの 九九《くく》で さがそう。24 ÷ 4 なら 4の だん（4 × 6 ＝ 24）。',
      figure: { kind: 'text', text: '24 ÷ 4 → 4 × □ ＝ 24', size: 'l' },
    },
    {
      id: 'neighbor',
      explain:
        '九九《くく》を 1つ ずれて 思《おも》い出《だ》したのかな。わる数《かず》 × 答《こた》え が わられる数《かず》に なるか たしかめよう。',
    },
    {
      id: 'zero-div',
      explain:
        '0を わると わる数《かず》に なると 考《かんが》えたのかな。0こを 分《わ》けても 1人分《ひとりぶん》は 0こだよ。',
    },
    {
      id: 'one-div',
      explain:
        '1で わる・おなじ 数《かず》で わる ところで まちがえたのかな。1人《り》で 分《わ》けると 全部《ぜんぶ》もらえる。おなじ 数《かず》で 分《わ》けると 1こずつ。',
    },
    {
      id: 'tens-drop',
      explain:
        '10の たばの 数《かず》だけ 答《こた》えたのかな。60 ÷ 3 は 10の たば 6本《ぽん》を 3つに 分《わ》けて 2たば ＝ 20だよ。',
    },
    {
      id: 'ones-forget',
      explain:
        'ばらの ぶんを わすれたのかな。10の たばと ばらを べつべつに 分《わ》けて、あわせよう。',
    },
    {
      id: 'wrong-op',
      explain:
        'ひき算《ざん》や かけ算《ざん》を したのかな。同《おな》じ 数《かず》ずつ 分《わ》ける ときは わり算《ざん》だよ。',
    },
  ],
  levels: [
    { label: '分ける 文章題', chance: 0.02 },
    { label: '九九で わり算', chance: 0.02 },
    { label: '0と 1の わり算', chance: 0.02 },
    { label: '2けた ÷ 1けた', chance: 0.02 },
  ],
  intro: [
    {
      text: 'ボールが 12こ。3人《にん》で 同《おな》じ 数《かず》ずつ 分《わ》けると、1人分《ひとりぶん》は 4こ。',
      figure: marbles(12, 3, true),
    },
    {
      text: 'これを 式《しき》で 12 ÷ 3 ＝ 4 と 書《か》き、「12 わる 3 は 4」と 読《よ》みます。答《こた》えは 3の だんの 九九《くく》（3 × 4 ＝ 12）で 見《み》つかります。',
      figure: { kind: 'text', text: '12 ÷ 3 ＝ 4', size: 'xl' },
    },
    {
      text: '12こを 1人《り》に 3こずつ 分《わ》けると、4人《にん》に 分《わ》けられます。これも 12 ÷ 3 ＝ 4 です。',
      figure: marbles(12, 4, true),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateDivisionBasic(level, rng, index),
  },
  review: 'type',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第3学年 A(4) 除法（除法の意味、除数と商が共に1位数の除法、除数が1位数で商が2位数の簡単な場合）',
  revised: '2026-10-24',
};
