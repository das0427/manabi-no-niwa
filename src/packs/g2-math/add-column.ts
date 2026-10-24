/**
 * g2.math.add-column 2位数のたし算の筆算（curriculum-matrix 3.5）。
 * 位をそろえる（ブロック）→ 筆算 → 百の位へ繰り上がる・文章題。
 *
 * 筆算は number の複数欄（答えの位ごとに1欄。大きい位から）で代用する（2.6 の筆算レイアウトの代わり）。
 * 位ごとの入力から、繰り上がりの忘れ・位ごとの和を並べる・位のずれ を誤概念に結ぶ。
 * 繰り上がりのメモ欄は無い（エンジンの限界。報告に記載）。
 *
 * 同一性キー: 交換法則はこの単元の学習内容ではないので、交換しただけの式は同じ（小さい数+大きい数）。
 *   文章題は「場面 × 式」。別例（横書き・テープ図）は同じキーで alt。
 * 定義域: a は 10〜99、b は 1〜99（2位数＋1位数を含む）。数千通り。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { columnFigure, pickObj, placeFields, toFields, wrongList } from './util';

type Obj = 'nocarry' | 'carry' | 'hundred' | 'bunshou';

interface Scene {
  id: string;
  type: 'gappei' | 'zouka';
  unit: string;
  text: (a: number, b: number) => string;
}

/** 文章題の場面（合併4・増加4） */
const SCENES: Scene[] = [
  {
    id: 'cards',
    type: 'gappei',
    unit: 'まい',
    text: (a, b) =>
      `あかい カードが ${a}まい、あおい カードが ${b}まい あります。あわせて なんまい ですか。`,
  },
  {
    id: 'class',
    type: 'gappei',
    unit: '人《にん》',
    text: (a, b) =>
      `こうていで あそんで いる 子《こ》どもは、2年《ねん》生《せい》が ${a}人《にん》、1年《ねん》生《せい》が ${b}人《にん》 です。みんなで なん人《にん》 ですか。`,
  },
  {
    id: 'flowers',
    type: 'gappei',
    unit: 'ほん',
    text: (a, b) =>
      `にわに チューリップが ${a}ほん、ひまわりが ${b}ほん さいて います。ぜんぶで なんほん ですか。`,
  },
  {
    id: 'shells',
    type: 'gappei',
    unit: 'こ',
    text: (a, b) =>
      `かいがらを、あには ${a}こ、いもうとは ${b}こ ひろいました。あわせて なんこ ですか。`,
  },
  {
    id: 'stickers',
    type: 'zouka',
    unit: 'まい',
    text: (a, b) => `シールを ${a}まい もって います。${b}まい もらうと、なんまいに なりますか。`,
  },
  {
    id: 'bus',
    type: 'zouka',
    unit: '人《にん》',
    text: (a, b) =>
      `バスに ${a}人《にん》 のって います。${b}人《にん》 のって くると、なん人《にん》に なりますか。`,
  },
  {
    id: 'pages',
    type: 'zouka',
    unit: 'ページ',
    text: (a, b) =>
      `本《ほん》を きのうまでに ${a}ページ よみました。きょう ${b}ページ よみました。ぜんぶで なんページ よみましたか。`,
  },
  {
    id: 'savings',
    type: 'zouka',
    unit: '円《えん》',
    text: (a, b) =>
      `ちょきんばこに ${a}円《えん》 あります。${b}円《えん》 いれると なん円《えん》に なりますか。`,
  },
];

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['nocarry'] },
  { objs: ['nocarry', 'carry'] },
  { objs: ['carry', 'hundred'] },
  { objs: ['carry', 'hundred', 'bunshou'] },
];

const key = (a: number, b: number) => `${Math.min(a, b)}+${Math.max(a, b)}`;

/** 条件に合う式（a は2位数、b は1〜2位数）を定義域から均等に1つ */
function pickExpr(rng: Rng, kind: 'nocarry' | 'carry' | 'hundred'): [number, number] {
  const ok = (a: number, b: number) => {
    const s = a + b;
    const carry = (a % 10) + (b % 10) >= 10;
    if (kind === 'nocarry') return !carry && s < 100;
    if (kind === 'carry') return carry && s < 100;
    return s >= 100;
  };
  for (;;) {
    const a = rng.int(10, 99);
    // 1位数を たす式は4こに1こ
    const b = rng.next() < 0.25 ? rng.int(1, 9) : rng.int(10, 99);
    // 2位数どうしは左右の順もランダム（キーは交換で同一視）。1位数は必ず下に書く
    if (ok(a, b)) return rng.next() < 0.5 || b < 10 ? [a, b] : [b, a];
  }
}

function wrongs(a: number, b: number, nFields: number): NumberItem['wrongAnswers'] {
  const s = a + b;
  const a1 = a % 10;
  const b1 = b % 10;
  const a10 = Math.floor(a / 10);
  const b10 = Math.floor(b / 10);
  const carry = a1 + b1 >= 10;
  const f = (v: number) => (nFields === 1 ? String(v) : toFields(v, nFields));
  const noCarry = (a10 + b10) * 10 + ((a1 + b1) % 10);
  // 1位数を2位数の じゅうの くらいの したに かいた（b は1位数のとき）
  const misalign = b < 10 ? (a10 + b) * 10 + a1 : null;
  const concat =
    nFields === 1 ? `${a10 + b10}${a1 + b1}` : nFields === 2 ? `${a10 + b10}|${a1 + b1}` : null;
  return wrongList(nFields === 1 ? String(s) : toFields(s, nFields)!, nFields, [
    [carry ? f(noCarry) : null, 'no-carry'],
    [carry ? concat : null, 'concat-sums'],
    [!carry ? f(s + 10) : null, 'extra-carry'],
    [misalign !== null ? f(misalign) : null, 'misalign'],
    [misalign !== null && nFields === 2 ? `${a10 + b}|${a1}` : null, 'misalign'],
    [f(Math.abs(a - b)), 'sub-instead'],
  ]);
}

function hints(a: number, b: number): string[] {
  const a1 = a % 10;
  const b1 = b % 10;
  const a10 = Math.floor(a / 10);
  const b10 = Math.floor(b / 10);
  const carry = a1 + b1 >= 10;
  return [
    'くらいを たてに そろえて、いちの くらいから けいさん しよう。',
    `いちの くらいは ${a1} ＋ ${b1} ＝ ${a1 + b1}${carry ? '。10の まとまりが できたね' : ''}。`,
    carry
      ? `${(a1 + b1) % 10}を かいて、1を じゅうの くらいへ くりあげる。じゅうの くらいは 1 ＋ ${a10} ＋ ${b10} を けいさん。`
      : `じゅうの くらいは ${a10} ＋ ${b10} を けいさん。`,
  ];
}

function explain(a: number, b: number): string {
  const a1 = a % 10;
  const b1 = b % 10;
  const a10 = Math.floor(a / 10);
  const b10 = Math.floor(b / 10);
  const s = a + b;
  const carry = a1 + b1 >= 10;
  const tens = a10 + b10 + (carry ? 1 : 0);
  return carry
    ? `いちの くらい: ${a1} ＋ ${b1} ＝ ${a1 + b1}。${(a1 + b1) % 10}を かいて 1を くりあげる。じゅうの くらい: 1 ＋ ${a10} ＋ ${b10} ＝ ${tens}${tens >= 10 ? '。ひゃくの くらいに 1が たつ' : ''}。こたえは ${s} です。`
    : `いちの くらい: ${a1} ＋ ${b1} ＝ ${a1 + b1}。じゅうの くらい: ${a10} ＋ ${b10} ＝ ${tens}${tens >= 10 ? '。ひゃくの くらいに 1が たつ' : ''}。こたえは ${s} です。`;
}

const blocksFig = (a: number, b: number): Figure => ({
  kind: 'row',
  items: [
    { kind: 'blocks', tens: Math.floor(a / 10), ones: a % 10, tone: 'a' },
    { kind: 'text', text: '＋', size: 'l' },
    { kind: 'blocks', tens: Math.floor(b / 10), ones: b % 10, tone: 'b' },
  ],
});

function calcItem(
  obj: Obj,
  level: number,
  a: number,
  b: number,
  alt: boolean,
  rng: Rng,
): NumberItem {
  const s = a + b;
  if (alt) {
    // 別例: 横書きの式（答えは1欄）か、ブロックの図
    const blocks = rng.next() < 0.5;
    return {
      engine: 'number',
      id: `${obj}-alt:${a}+${b}`,
      objective: obj,
      level,
      prompt: blocks ? 'ブロックを あわせると いくつ？' : 'けいさん しよう。',
      figure: blocks ? blocksFig(a, b) : { kind: 'text', text: `${a} ＋ ${b} ＝ {{}}`, size: 'xl' },
      hints: hints(a, b),
      explain: explain(a, b),
      explainFigure: columnFigure(a, b, '＋', String(s).length),
      identity: key(a, b),
      alt: true,
      fields: [{ answer: { kind: 'int', value: s } }],
      wrongAnswers: wrongs(a, b, 1),
    };
  }
  const fields = placeFields(s);
  return {
    engine: 'number',
    id: `${obj}:${a}+${b}`,
    objective: obj,
    level,
    prompt: 'ひっさんで けいさん しよう。こたえを くらいごとに かこう。',
    figure: columnFigure(a, b, '＋', fields.length),
    hints: hints(a, b),
    explain: explain(a, b),
    identity: key(a, b),
    alt: false,
    fields,
    wrongAnswers: wrongs(a, b, fields.length),
  };
}

function wordItem(level: number, a: number, b: number, alt: boolean, rng: Rng): NumberItem {
  const sc = SCENES[rng.int(0, SCENES.length - 1)]!;
  const s = a + b;
  return {
    engine: 'number',
    id: `bunshou${alt ? '-alt' : ''}:${sc.id}:${a}+${b}`,
    objective: 'bunshou',
    level,
    prompt: sc.text(a, b),
    figure: alt
      ? {
          kind: 'tape',
          parts: [
            { length: a, label: String(a), tone: 'a' },
            { length: b, label: String(b), tone: 'b' },
          ],
          total: '？',
        }
      : undefined,
    hints: [
      sc.type === 'gappei'
        ? '「あわせて」「ぜんぶで」は たしざん だね。'
        : 'ふえると かずは おおきく なるね。たしざん だよ。',
      `しきは ${a} ＋ ${b}。ひっさんで けいさん しよう。`,
      hints(a, b)[2]!,
    ],
    explain: `しきは ${a} ＋ ${b} ＝ ${s}。こたえは ${s}${sc.unit} です。`,
    explainFigure: columnFigure(a, b, '＋', String(s).length),
    identity: `${sc.id}:${key(a, b)}`,
    alt,
    fields: [{ label: sc.unit, answer: { kind: 'int', value: s } }],
    wrongAnswers: wrongs(a, b, 1),
  };
}

export function generateAddColumn(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.25;
  if (obj === 'bunshou') {
    const [a, b] = pickExpr(rng, rng.next() < 0.5 ? 'carry' : 'hundred');
    return wordItem(level, a, b, alt, rng);
  }
  const [a, b] = pickExpr(rng, obj === 'hundred' ? 'hundred' : obj);
  return calcItem(obj, level, a, b, alt, rng);
}

export const addColumn: UnitSpec = {
  id: 'g2.math.add-column',
  title: 'たしざんの ひっさん',
  stage: 'g2',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'math-formula-add',
  prereq: ['g1.math.add-sub-2digit'],
  objectives: [
    { id: 'nocarry', title: 'くりあがりの ない ひっさん' },
    { id: 'carry', title: 'じゅうの くらいへ くりあがる ひっさん' },
    { id: 'hundred', title: 'ひゃくの くらいへ くりあがる ひっさん' },
    { id: 'bunshou', title: 'ぶんしょうだい' },
  ],
  misconceptions: [
    {
      id: 'no-carry',
      explain:
        'くりあげた 1を たすのを わすれたのかな。いちの くらいで 10が できたら、じゅうの くらいに 1 たすよ。',
      figure: { kind: 'text', text: '47 ＋ 38 → いち: 15（5を かいて 1 くりあげ）', size: 'm' },
    },
    {
      id: 'concat-sums',
      explain:
        'くらいごとの こたえを そのまま ならべたのかな。いちの くらいが 10いじょうに なったら、1を くりあげるよ。',
    },
    {
      id: 'extra-carry',
      explain:
        'くりあがりが ないのに 1を たしたのかな。いちの くらいが 10より ちいさい ときは くりあげないよ。',
    },
    {
      id: 'misalign',
      explain:
        'くらいが ずれたのかな。1けたの かずは いちの くらいの したに かいて、くらいを たてに そろえよう。',
    },
    {
      id: 'sub-instead',
      explain: 'ひきざんを したのかな。「あわせて」「ふえると」は たしざん だよ。',
    },
  ],
  levels: [
    { label: 'くりあがり なし', chance: 0.02 },
    { label: 'じゅうの くらいへ くりあがる', chance: 0.02 },
    { label: 'ひゃくの くらいへ くりあがる', chance: 0.02 },
    { label: 'ぶんしょうだい', chance: 0.02 },
  ],
  intro: [
    {
      text: '47 ＋ 38 を ブロックで かんがえます。10の ぼうと 1の つぶに わけます。',
      figure: blocksFig(47, 38),
    },
    {
      text: 'ひっさんでは くらいを たてに そろえて かきます。いちの くらいから けいさん します。',
      figure: columnFigure(47, 38, '＋', 2),
    },
    {
      text: 'いちの くらい 7 ＋ 8 ＝ 15。5を かいて、1を じゅうの くらいへ くりあげます。じゅうの くらいは 1 ＋ 4 ＋ 3 ＝ 8。こたえは 85。',
      figure: { kind: 'text', text: '47 ＋ 38 ＝ 85', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateAddColumn(level, rng, index),
  },
  review: 'type',
  basis: '小学校学習指導要領（平成29年告示）算数 第2学年 A(2) 加法・減法（2位数の加法の筆算）',
  revised: '2026-10-24',
};
