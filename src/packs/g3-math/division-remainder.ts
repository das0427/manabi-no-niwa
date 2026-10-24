/**
 * g3.math.division-remainder あまりのあるわり算（curriculum-matrix 3.6）。
 * 余る絵 → 商とあまりの欄 → たしかめ → あまりの処理の文章題（切り上げ・切り捨て）。
 *
 * 商とあまりは number の2欄（「しょう」「あまり」。2.4）。あまりが わる数以上・欄の入れちがい・
 * あまりの書き忘れ・あまりの処理（1 たす／たさない）の誤りを誤概念に結ぶ。
 * 同一性キー: 'D÷d'。文章題は「場面 × 式」。たしかめは 'check:D÷d'。
 * 定義域: わる数 2〜9・商 1〜9・あまり 1〜(わる数−1) の 324 通り（× 場面）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { opts, pickObj, pickOne, wrongList } from './util';

type Obj = 'calc' | 'check' | 'word' | 'up' | 'down';

/** [わられる数, わる数, 商, あまり] */
const DOMAIN: [number, number, number, number][] = [];
for (let d = 2; d <= 9; d++)
  for (let q = 1; q <= 9; q++) for (let r = 1; r < d; r++) DOMAIN.push([d * q + r, d, q, r]);

const groups = (d: number, q: number, r: number): Figure => ({
  kind: 'row',
  items: [
    ...Array.from({ length: q }, () => ({ kind: 'illust', id: 'ball', count: d }) as Figure),
    { kind: 'illust', id: 'ball', count: r, tone: 'muted' },
  ],
  gap: 10,
});

const steps = (D: number, d: number, q: number, r: number) =>
  `${d}の だんの 九九《くく》で、${D}を こえない いちばん 大《おお》きい 答《こた》えは ${d} × ${q} ＝ ${d * q}。${D} − ${d * q} ＝ ${r}。`;

function remWrongs(d: number, q: number, r: number): [string | null, string][] {
  return [
    [q >= 2 ? `${q - 1}|${r + d}` : null, 'rem-too-big'],
    [`${r}|${q}`, 'swap-fields'],
    [`${q}|0`, 'rem-forget'],
    [`${q + 1}|${r}`, 'kuku-slip'],
  ];
}

function calc(level: number, rng: Rng, alt: boolean): NumberItem {
  const [D, d, q, r] = pickOne(rng, DOMAIN);
  return {
    engine: 'number',
    id: `calc${alt ? '-alt' : ''}:${D}÷${d}`,
    objective: 'calc',
    level,
    prompt: alt
      ? `ボールが ${D}こ あります。${d}こずつ まとめると、何《なん》まとまり できて、何《なん》こ あまりますか。`
      : '計算《けいさん》しよう。しょうと あまりを 書《か》こう。',
    figure: alt
      ? groups(d, q, r)
      : { kind: 'text', text: `${D} ÷ ${d} ＝ {{}} あまり {{}}`, size: 'xl' },
    hints: [
      `わる数《かず》の ${d}の だんの 九九《くく》を つかおう。`,
      `${d} × □ が ${D}を こえない いちばん 大《おお》きい □を さがそう。`,
      `${d} × ${q} ＝ ${d * q}。のこりは いくつかな。`,
    ],
    explain: `${steps(D, d, q, r)}${D} ÷ ${d} ＝ ${q} あまり ${r}。あまりの ${r}は わる数《かず》の ${d}より 小《ちい》さいね。たしかめ: ${d} × ${q} ＋ ${r} ＝ ${D}。`,
    identity: `${D}÷${d}`,
    alt,
    fields: [
      { label: alt ? 'まとまり' : 'しょう', answer: { kind: 'int', value: q } },
      { label: alt ? 'あまり（こ）' : 'あまり', answer: { kind: 'int', value: r } },
    ],
    wrongAnswers: wrongList(`${q}|${r}`, 2, remWrongs(d, q, r)),
  };
}

function check(level: number, rng: Rng, alt: boolean): ChoiceItem {
  let [D, d, q, r] = pickOne(rng, DOMAIN);
  if (alt) {
    while (q < 2) [D, d, q, r] = pickOne(rng, DOMAIN);
    return {
      engine: 'choice',
      id: `check-alt:${D}÷${d}`,
      objective: 'check',
      level,
      prompt: `ゆうきさんは「${D} ÷ ${d} ＝ ${q - 1} あまり ${r + d}」と 答《こた》えました。この 答《こた》えは 正《ただ》しいですか。`,
      hints: [
        'あまりと わる数《かず》を くらべよう。',
        `あまりの ${r + d}は、わる数《かず》の ${d}より 大《おお》きいかな。`,
        `あまりから もう 1つ ${d}の まとまりが 作《つく》れないかな。`,
      ],
      explain: `あまりの ${r + d}は わる数《かず》の ${d}より 大《おお》きいので、まだ わけられます。正《ただ》しくは ${D} ÷ ${d} ＝ ${q} あまり ${r}。あまりは いつも わる数《かず》より 小《ちい》さく します。`,
      identity: `check-err:${D}÷${d}`,
      alt: true,
      options: [
        { label: '正《ただ》しくない。しょうを 1 大《おお》きく できる', correct: true },
        { label: '正《ただ》しい', misconception: 'rem-too-big' },
        {
          label: '正《ただ》しくない。しょうを 1 小《ちい》さく する',
          misconception: 'rem-too-big',
        },
      ],
    };
  }
  return {
    engine: 'choice',
    id: `check:${D}÷${d}`,
    objective: 'check',
    level,
    prompt: `「${D} ÷ ${d} ＝ ${q} あまり ${r}」の 答《こた》えを たしかめる 式《しき》は どれ？`,
    hints: [
      'わる数《かず》 × しょう に、あまりを どう すると わられる数《かず》に なるかな。',
      `${d}こずつ ${q}つ 分《ぶん》と、あまり ${r}こ。`,
      `${d} × ${q} ＝ ${d * q}。${D}に するには…`,
    ],
    explain: `わる数《かず》 × しょう ＋ あまり ＝ わられる数《かず》。${d} × ${q} ＋ ${r} ＝ ${D} なので 答《こた》えは 正《ただ》しいです。`,
    identity: `check:${D}÷${d}`,
    alt: false,
    options: opts(`${d} × ${q} ＋ ${r}`, [
      [`${d} × ${q} − ${r}`, 'check-form'],
      [`${d} × ${r} ＋ ${q}`, 'check-form'],
      [`${D} × ${d} ＋ ${r}`, 'check-form'],
    ]),
  };
}

interface Scene {
  id: string;
  kind: 'word' | 'up' | 'down';
  unit: string;
  unit2?: string;
  text: (D: number, d: number) => string;
}
const SCENES: Scene[] = [
  {
    id: 'cards',
    kind: 'word',
    unit: 'まい',
    unit2: 'まい',
    text: (D, d) =>
      `カードが ${D}まい あります。${d}人《にん》で 同《おな》じ 数《かず》ずつ 分《わ》けると、1人分《ひとりぶん》は 何《なん》まいで、何《なん》まい あまりますか。`,
  },
  {
    id: 'candy',
    kind: 'word',
    unit: 'ふくろ',
    unit2: 'こ',
    text: (D, d) =>
      `あめが ${D}こ あります。1ふくろに ${d}こずつ 入《い》れると、何《なん》ふくろ できて、何《なん》こ あまりますか。`,
  },
  {
    id: 'beads',
    kind: 'word',
    unit: 'こ',
    unit2: 'こ',
    text: (D, d) =>
      `ビーズ ${D}こを ${d}本《ほん》の ひもに 同《おな》じ 数《かず》ずつ とおします。1本《ぽん》に 何《なん》こで、何《なん》こ あまりますか。`,
  },
  {
    id: 'tape',
    kind: 'word',
    unit: '本《ぽん》',
    unit2: 'cm',
    text: (D, d) =>
      `${D}cmの テープを ${d}cmずつ 切《き》ります。${d}cmの テープは 何《なん》本《ぼん》 できて、何《なん》cm あまりますか。`,
  },
  {
    id: 'bench',
    kind: 'up',
    unit: 'きゃく',
    text: (D, d) =>
      `${D}人《にん》が 長《なが》いすに すわります。1きゃくに ${d}人《にん》ずつ すわると、全員《ぜんいん》が すわるには 長《なが》いすは 何《なん》きゃく いりますか。`,
  },
  {
    id: 'boat',
    kind: 'up',
    unit: 'そう',
    text: (D, d) =>
      `1そうに ${d}人《にん》 乗《の》れる ボートが あります。${D}人《にん》 全員《ぜんいん》が 乗《の》るには、ボートは 何《なん》そう いりますか。`,
  },
  {
    id: 'books',
    kind: 'up',
    unit: 'はこ',
    text: (D, d) =>
      `本《ほん》が ${D}さつ あります。1はこに ${d}さつずつ 入《い》れます。全部《ぜんぶ》 入《い》れるには、はこは 何《なん》はこ いりますか。`,
  },
  {
    id: 'car',
    kind: 'up',
    unit: '台《だい》',
    text: (D, d) =>
      `${D}人《にん》が 車《くるま》で 出《で》かけます。1台《だい》に ${d}人《にん》ずつ 乗《の》ると、車《くるま》は 何《なん》台《だい》 いりますか。`,
  },
  {
    id: 'ribbon',
    kind: 'down',
    unit: '本《ぽん》',
    text: (D, d) => `${D}cmの リボンから、${d}cmの リボンは 何《なん》本《ぼん》 とれますか。`,
  },
  {
    id: 'gum',
    kind: 'down',
    unit: 'こ',
    text: (D, d) =>
      `${D}円《えん》 あります。1こ ${d}円《えん》の ガムは 何《なん》こ 買《か》えますか。`,
  },
  {
    id: 'bouquet',
    kind: 'down',
    unit: 'たば',
    text: (D, d) =>
      `花《はな》が ${D}本《ほん》 あります。${d}本《ほん》ずつ たばに すると、${d}本《ほん》の 花《はな》たばは 何《なん》たば できますか。`,
  },
  {
    id: 'pack',
    kind: 'down',
    unit: 'パック',
    text: (D, d) =>
      `いちごが ${D}こ あります。${d}こずつ パックに つめます。${d}こ 入《い》りの パックは 何《なん》パック できますか。`,
  },
];

function word(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pickOne(
    rng,
    SCENES.filter((s) => s.kind === 'word'),
  );
  const [D, d, q, r] = pickOne(rng, DOMAIN);
  return {
    engine: 'number',
    id: `word${alt ? '-alt' : ''}:${sc.id}:${D}÷${d}`,
    objective: 'word',
    level,
    prompt: sc.text(D, d),
    figure: alt ? groups(d, q, r) : undefined,
    hints: [
      'わり算《ざん》の 式《しき》に しよう。',
      `式《しき》は ${D} ÷ ${d}。`,
      `${d} × ${q} ＝ ${d * q}。のこりは？`,
    ],
    explain: `${D} ÷ ${d} ＝ ${q} あまり ${r}。答《こた》えは ${q}${sc.unit}で、${r}${sc.unit2} あまります。`,
    identity: `${sc.id}:${D}÷${d}`,
    alt,
    fields: [
      { label: sc.unit, answer: { kind: 'int', value: q } },
      { label: `あまり（${sc.unit2}）`, answer: { kind: 'int', value: r } },
    ],
    wrongAnswers: wrongList(`${q}|${r}`, 2, remWrongs(d, q, r)),
  };
}

function rounding(obj: 'up' | 'down', level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pickOne(
    rng,
    SCENES.filter((s) => s.kind === obj),
  );
  const [D, d, q, r] = pickOne(rng, DOMAIN);
  const ans = obj === 'up' ? q + 1 : q;
  return {
    engine: 'number',
    id: `${obj}${alt ? '-alt' : ''}:${sc.id}:${D}÷${d}`,
    objective: obj,
    level,
    prompt: sc.text(D, d),
    figure: alt ? groups(d, q, r) : undefined,
    hints: [
      'まず わり算《ざん》を して、あまりを どう するか 考《かんが》えよう。',
      `${D} ÷ ${d} ＝ ${q} あまり ${r}。`,
      obj === 'up'
        ? `あまりの ${r}${sc.id === 'books' ? 'さつ' : '人《にん》'}も わすれずに。もう 1つ いるかな。`
        : `あまりの ${r}では、${d}の まとまりは 作《つく》れないね。`,
    ],
    explain:
      obj === 'up'
        ? `${D} ÷ ${d} ＝ ${q} あまり ${r}。${q}${sc.unit}では あまりの ${r}が のこるので、もう 1つ いります。${q} ＋ 1 ＝ ${ans}。答《こた》えは ${ans}${sc.unit}です。`
        : `${D} ÷ ${d} ＝ ${q} あまり ${r}。あまりの ${r}では ${d}に たりないので、答《こた》えは ${q}${sc.unit}です。`,
    identity: `${sc.id}:${D}÷${d}`,
    alt,
    fields: [{ label: sc.unit, answer: { kind: 'int', value: ans } }],
    wrongAnswers: wrongList(String(ans), 1, [
      [obj === 'up' ? q : q + 1, obj === 'up' ? 'round-up-miss' : 'round-down-miss'],
      [r, 'swap-fields'],
    ]),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['calc', 'word'] },
  { objs: ['calc', 'check', 'word'] },
  { objs: ['calc', 'up', 'down'] },
  { objs: ['check', 'word', 'up', 'down'] },
];

export function generateDivisionRemainder(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.25;
  switch (obj) {
    case 'calc':
      return calc(level, rng, alt);
    case 'check':
      return check(level, rng, alt);
    case 'word':
      return word(level, rng, alt);
    case 'up':
    case 'down':
      return rounding(obj, level, rng, alt);
  }
}

export const divisionRemainder: UnitSpec = {
  id: 'g3.math.division-remainder',
  title: 'あまりの ある わり算《ざん》',
  stage: 'g3',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'math-split',
  prereq: ['g3.math.division-basic'],
  objectives: [
    { id: 'calc', title: 'しょうと あまりを もとめる' },
    { id: 'check', title: '答《こた》えの たしかめ' },
    { id: 'word', title: 'あまりも 答《こた》える 文章題《ぶんしょうだい》' },
    { id: 'up', title: 'あまりの ぶんも 入《い》れる（1 たす）' },
    { id: 'down', title: 'あまりは 入《い》れない' },
  ],
  misconceptions: [
    {
      id: 'rem-too-big',
      explain:
        'あまりが わる数《かず》より 大《おお》きく なって いないかな。あまりは いつも わる数《かず》より 小《ちい》さく なるよ。',
      figure: { kind: 'text', text: '23 ÷ 4 ＝ 5 あまり 3（4 あまり 7 では ない）', size: 'm' },
    },
    {
      id: 'swap-fields',
      explain:
        'しょうと あまりを 入《い》れかえたのかな。しょうは まとまりの 数《かず》、あまりは のこった 数《かず》だよ。',
    },
    {
      id: 'rem-forget',
      explain:
        'あまりを 書《か》きわすれたのかな。わる数《かず》 × しょう を ひいた のこりが あまりだよ。',
    },
    {
      id: 'kuku-slip',
      explain:
        'しょうが 大《おお》きすぎるのかな。わる数《かず》 × しょう が わられる数《かず》を こえて いないか たしかめよう。',
    },
    {
      id: 'check-form',
      explain:
        'たしかめの 式《しき》は「わる数《かず》 × しょう ＋ あまり ＝ わられる数《かず》」だよ。あまりは たすよ。',
    },
    {
      id: 'round-up-miss',
      explain:
        'あまりの ぶんを わすれたのかな。あまった 人《ひと》や ものも 入《い》れるには、もう 1つ いるよ。',
    },
    {
      id: 'round-down-miss',
      explain:
        'あまりの ぶんも 1つと 数《かぞ》えたのかな。あまりでは 1まとまりに たりないので、数《かぞ》えないよ。',
    },
  ],
  levels: [
    { label: 'しょうと あまり', chance: 0.01 },
    { label: 'たしかめ', chance: 0.01 },
    { label: 'あまりの しょり', chance: 0.01 },
    { label: 'まとめ', chance: 0.01 },
  ],
  intro: [
    {
      text: 'ボール 14こを 4こずつ まとめると、3つ できて 2こ あまります。',
      figure: groups(4, 3, 2),
    },
    {
      text: '式《しき》は 14 ÷ 4 ＝ 3 あまり 2。4の だんの 九九《くく》で 14を こえない いちばん 大《おお》きい 答《こた》え（4 × 3 ＝ 12）を さがします。',
      figure: { kind: 'text', text: '14 ÷ 4 ＝ 3 あまり 2', size: 'xl' },
    },
    {
      text: 'あまりは わる数《かず》より 小《ちい》さく します。たしかめ: 4 × 3 ＋ 2 ＝ 14。',
      figure: { kind: 'text', text: '4 × 3 ＋ 2 ＝ 14', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateDivisionRemainder(level, rng, index),
  },
  review: 'type',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第3学年 A(4) 除法（余りのある除法、除法と乗法の関係）',
  revised: '2026-10-24',
};
