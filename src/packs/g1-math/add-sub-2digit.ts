/**
 * g1.math.add-sub-2digit かんたんな 2けたの たしざん・ひきざん（curriculum-matrix 3.4）。
 * 何十±何十（和は100まで）と、2けた±1けた（くりあがり・くりさがりなし）。
 *
 * 同一性キー: 交換法則はこの単元の学習内容ではないので、何十＋何十は小さい数+大きい数。
 *   2けた＋1けたは いつも 2けたを前に出す（35＋3 の形だけ）。ひきざんは式そのもの。
 * 定義域:
 *   何十＋何十 25（10i＋10j, 1≤i≤j, i+j≤10）
 *   何十−何十 45（10i−10j, 1≤j<i≤10）
 *   2けた＋1けた 405（10t+u ＋ b, t 1〜9, u 0〜8, 1≤b≤9−u）
 *   2けた−1けた 405（10t+u − b, t 1〜9, 1≤b≤u≤9）
 *   計 880
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { expr, pickFrom, REVISED } from './util';

type Kind = 'tens-add' | 'tens-sub' | 'add-1' | 'sub-1';
type Obj = Kind | 'bunshou';

interface Expr {
  kind: Kind;
  a: number;
  b: number;
}

const DOMAIN: Record<Kind, Expr[]> = { 'tens-add': [], 'tens-sub': [], 'add-1': [], 'sub-1': [] };
for (let i = 1; i <= 10; i++)
  for (let j = i; i + j <= 10; j++)
    DOMAIN['tens-add'].push({ kind: 'tens-add', a: 10 * i, b: 10 * j });
for (let i = 2; i <= 10; i++)
  for (let j = 1; j < i; j++) DOMAIN['tens-sub'].push({ kind: 'tens-sub', a: 10 * i, b: 10 * j });
for (let t = 1; t <= 9; t++)
  for (let u = 0; u <= 8; u++)
    for (let b = 1; b <= 9 - u; b++) DOMAIN['add-1'].push({ kind: 'add-1', a: 10 * t + u, b });
for (let t = 1; t <= 9; t++)
  for (let u = 1; u <= 9; u++)
    for (let b = 1; b <= u; b++) DOMAIN['sub-1'].push({ kind: 'sub-1', a: 10 * t + u, b });

const ALL = [...DOMAIN['tens-add'], ...DOMAIN['tens-sub'], ...DOMAIN['add-1'], ...DOMAIN['sub-1']];
const ADDS = [...DOMAIN['tens-add'], ...DOMAIN['add-1']];
const SUBS = [...DOMAIN['tens-sub'], ...DOMAIN['sub-1']];
const LV0 = [...DOMAIN['tens-add'], ...DOMAIN['tens-sub']];
const LV1 = [...DOMAIN['add-1'], ...DOMAIN['sub-1']];

const isAdd = (e: Expr) => e.kind === 'tens-add' || e.kind === 'add-1';
const ans = (e: Expr) => (isAdd(e) ? e.a + e.b : e.a - e.b);
const sign = (e: Expr) => (isAdd(e) ? '＋' : '−');
const key = (e: Expr) =>
  e.kind === 'tens-add'
    ? `${Math.min(e.a, e.b)}+${Math.max(e.a, e.b)}`
    : `${e.a}${isAdd(e) ? '+' : '-'}${e.b}`;

interface Scene {
  id: string;
  type: 'gappei' | 'zouka' | 'kyuuzan' | 'kyuusa';
  unit: string;
  text: (a: number, b: number) => string;
}

/** 文章題の場面（合併2・増加2・求残2・求差2） */
const SCENES: Scene[] = [
  {
    id: 'paper',
    type: 'gappei',
    unit: 'まい',
    text: (a, b) => `いろがみが ${a}まい、がようしが ${b}まい あります。あわせて なんまい ですか。`,
  },
  {
    id: 'beads',
    type: 'gappei',
    unit: 'こ',
    text: (a, b) => `ビーズが はこに ${a}こ、ふくろに ${b}こ あります。あわせて なんこ ですか。`,
  },
  {
    id: 'sticker',
    type: 'zouka',
    unit: 'まい',
    text: (a, b) =>
      `シールを ${a}まい もって います。${b}まい もらいました。ぜんぶで なんまいに なりましたか。`,
  },
  {
    id: 'chestnut',
    type: 'zouka',
    unit: 'こ',
    text: (a, b) =>
      `くりを ${a}こ ひろいました。あとから ${b}こ ひろいました。ぜんぶで なんこ ですか。`,
  },
  {
    id: 'card',
    type: 'kyuuzan',
    unit: 'まい',
    text: (a, b) =>
      `カードが ${a}まい あります。ともだちに ${b}まい あげました。のこりは なんまい ですか。`,
  },
  {
    id: 'balls',
    type: 'kyuuzan',
    unit: 'こ',
    text: (a, b) =>
      `たまいれの たまが ${a}こ あります。${b}こ なげました。のこりは なんこ ですか。`,
  },
  {
    id: 'mikan',
    type: 'kyuusa',
    unit: 'こ',
    text: (a, b) =>
      `みかんが ${a}こ、りんごが ${b}こ あります。みかんは りんごより なんこ おおいですか。`,
  },
  {
    id: 'jump',
    type: 'kyuusa',
    unit: 'かい',
    text: (a, b) =>
      `なわとびで、あには ${a}かい、おとうとは ${b}かい とびました。ちがいは なんかい ですか。`,
  },
];

function wrongs(e: Expr): NonNullable<NumberItem['wrongAnswers']> {
  const c = ans(e);
  const out: NonNullable<NumberItem['wrongAnswers']> = [];
  const add = (v: number, m: string) => {
    const t = String(v);
    if (v !== c && v >= 0 && Number.isInteger(v) && !out.some((w) => w.value === t))
      out.push({ value: t, misconception: m });
  };
  const { a, b } = e;
  switch (e.kind) {
    case 'tens-add':
      add(c / 10, 'drop-zero');
      add(c + 10, 'off-by-ten');
      add(c - 10, 'off-by-ten');
      add(Math.abs(a - b), 'sub-instead');
      break;
    case 'tens-sub':
      add(c / 10, 'drop-zero');
      add(c + 10, 'off-by-ten');
      add(c - 10, 'off-by-ten');
      add(a + b, 'add-instead');
      break;
    case 'add-1':
      add(a + 10 * b, 'place-misalign');
      add((a % 10) + b, 'drop-tens');
      add(c + 1, 'off-by-one');
      add(c - 1, 'off-by-one');
      add(a - b, 'sub-instead');
      break;
    case 'sub-1':
      add(a - 10 * b, 'place-misalign');
      add((a % 10) - b, 'drop-tens');
      add(c + 1, 'off-by-one');
      add(c - 1, 'off-by-one');
      add(a + b, 'add-instead');
      break;
  }
  return out;
}

function hintsOf(e: Expr): string[] {
  const { a, b } = e;
  if (e.kind === 'tens-add' || e.kind === 'tens-sub') {
    const i = a / 10;
    const j = b / 10;
    return [
      '10の たばが いくつ あるかで かんがえよう。',
      `${a}は 10が ${i}こ、${b}は 10が ${j}こ。`,
      e.kind === 'tens-add'
        ? `10が ${i} ＋ ${j} ＝ ${i + j}こ。10が ${i + j}こで…`
        : `10が ${i} − ${j} ＝ ${i - j}こ。10が ${i - j}こで…`,
    ];
  }
  const t = Math.floor(a / 10);
  const u = a % 10;
  return [
    'いちの くらいどうしを けいさん しよう。じゅうの くらいは そのまま。',
    `${a}は 10が ${t}こと ばらが ${u}こ。`,
    e.kind === 'add-1'
      ? `ばらは ${u} ＋ ${b} ＝ ${u + b}。${t * 10}と ${u + b}で…`
      : `ばらは ${u} − ${b} ＝ ${u - b}。${t * 10}と ${u - b}で…`,
  ];
}

function explainOf(e: Expr): string {
  const { a, b } = e;
  const c = ans(e);
  if (e.kind === 'tens-add' || e.kind === 'tens-sub')
    return `10の たばで かんがえると、10が ${c / 10}こ。${a} ${sign(e)} ${b} ＝ ${c} です。`;
  return `いちの くらいどうしを けいさん して、${a} ${sign(e)} ${b} ＝ ${c} です。`;
}

/** 10の たば（棒）と ばらの ブロック */
const blk = (n: number): Figure => ({ kind: 'blocks', tens: Math.floor(n / 10), ones: n % 10 });

function figureAlt(e: Expr): Figure {
  if (isAdd(e))
    return {
      kind: 'row',
      items: [blk(e.a), { kind: 'text', text: '＋', size: 'l' }, blk(e.b)],
    };
  return {
    kind: 'column',
    items: [blk(e.a), { kind: 'text', text: `${e.b}こ とる`, size: 'm' }],
  };
}

function promptAlt(e: Expr): string {
  if (isAdd(e)) return 'ブロックを あわせると いくつ？';
  return `${e.a}この ブロックから ${e.b}こ とると、のこりは いくつ？`;
}

function item(obj: Obj, level: number, e: Expr, alt: boolean, sc?: Scene): NumberItem {
  const c = ans(e);
  let prompt: string;
  let figure: Figure | undefined;
  let hints = hintsOf(e);
  let explain = explainOf(e);
  if (sc) {
    prompt = sc.text(e.a, e.b);
    figure = alt
      ? sc.type === 'kyuusa'
        ? {
            kind: 'column',
            items: [
              { kind: 'tape', parts: [{ length: e.a, label: String(e.a), tone: 'a' }] },
              {
                kind: 'tape',
                parts: [
                  { length: e.b, label: String(e.b), tone: 'b' },
                  { length: c, label: '？', tone: 'muted' },
                ],
              },
            ],
            gap: 1,
          }
        : isAdd(e)
          ? {
              kind: 'tape',
              parts: [
                { length: e.a, label: String(e.a), tone: 'a' },
                { length: e.b, label: String(e.b), tone: 'b' },
              ],
              total: '？',
            }
          : {
              kind: 'tape',
              parts: [
                { length: e.b, label: String(e.b), tone: 'b' },
                { length: c, label: '？', tone: 'muted' },
              ],
              total: String(e.a),
            }
      : undefined;
    hints = [
      isAdd(e)
        ? '「あわせて」「ぜんぶで」は たしざんだよ。'
        : '「のこりは」「ちがいは」は ひきざんだよ。',
      `しきは ${e.a} ${sign(e)} ${e.b} だね。`,
      hintsOf(e)[2]!,
    ];
    explain = `しきは ${e.a} ${sign(e)} ${e.b} ＝ ${c}。こたえは ${c}${sc.unit} です。`;
  } else if (alt) {
    prompt = promptAlt(e);
    figure = figureAlt(e);
  } else {
    prompt = 'けいさん しよう。';
    figure = expr(`${e.a} ${sign(e)} ${e.b} ＝ {{}}`);
  }
  return {
    engine: 'number',
    id: `${obj}${alt ? '-alt' : ''}:${sc ? `${sc.id}:` : ''}${e.a}${isAdd(e) ? '+' : '-'}${e.b}`,
    objective: obj,
    level,
    prompt,
    figure,
    hints,
    explain,
    explainFigure: blk(c),
    identity: key(e),
    alt,
    fields: [{ answer: { kind: 'int', value: c }, label: sc?.unit }],
    wrongAnswers: wrongs(e),
  };
}

export function generateAddSub2digit(level: number, rng: Rng): Item {
  const alt = rng.next() < 0.25;
  if (level >= 2 && rng.next() < 0.3) {
    const sc = pickFrom(rng, SCENES);
    const e = pickFrom(rng, sc.type === 'gappei' || sc.type === 'zouka' ? ADDS : SUBS);
    const e2 = e.kind === 'tens-add' && rng.next() < 0.5 ? { ...e, a: e.b, b: e.a } : e;
    return item('bunshou', level, e2, alt, sc);
  }
  // 段階の定義域（式の種類を合わせた全体）から均等に選ぶ（キーの偏りを防ぐ）
  const e = pickFrom(rng, level === 0 ? LV0 : level === 1 ? LV1 : ALL);
  const e2 = e.kind === 'tens-add' && rng.next() < 0.5 ? { ...e, a: e.b, b: e.a } : e;
  return item(e.kind, level, e2, alt);
}

export const addSub2digit: UnitSpec = {
  id: 'g1.math.add-sub-2digit',
  title: '2けたの たしざん・ひきざん（かんたんな けいさん）',
  stage: 'g1',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-math',
  prereq: ['g1.math.numbers-120'],
  objectives: [
    { id: 'tens-add', title: 'なんじゅう ＋ なんじゅう' },
    { id: 'tens-sub', title: 'なんじゅう − なんじゅう' },
    { id: 'add-1', title: '2けた ＋ 1けた' },
    { id: 'sub-1', title: '2けた − 1けた' },
    { id: 'bunshou', title: 'ぶんしょうだい' },
  ],
  misconceptions: [
    {
      id: 'place-misalign',
      explain:
        'じゅうの くらいに たしたり ひいたり したのかな。1けたの かずは、いちの くらい（ばら）と けいさん するよ。',
    },
    {
      id: 'drop-zero',
      explain: '10の たばの かずだけ かいたのかな。10が 7こで 70。さいごの 0を わすれずに。',
    },
    {
      id: 'drop-tens',
      explain: 'いちの くらいだけ かいたのかな。じゅうの くらいの かずも そのまま おろそう。',
    },
    {
      id: 'off-by-one',
      explain: 'かぞえる ときに 1つ ずれたのかも。ばらの かずを もう いちど たしかめよう。',
    },
    {
      id: 'off-by-ten',
      explain: '10の たばを 1つ おおく（すくなく） かぞえたのかも。たばの かずを たしかめよう。',
    },
    {
      id: 'sub-instead',
      explain: 'ひきざんを したのかな。「あわせて」「ぜんぶで」は たしざんだよ。',
    },
    { id: 'add-instead', explain: 'たしざんを したのかな。「のこり」「ちがい」は ひきざんだよ。' },
  ],
  levels: [
    { label: 'なんじゅうの けいさん', chance: 0.05 },
    { label: '2けたと 1けた', chance: 0.05 },
    { label: 'まぜて・ぶんしょうだい', chance: 0.05 },
  ],
  intro: [
    {
      text: '40 ＋ 30 は、10の たばで かんがえます。10が 4こと 3こで、10が 7こ。',
      figure: {
        kind: 'row',
        items: [blk(40), { kind: 'text', text: '＋', size: 'l' }, blk(30)],
      },
    },
    { text: '10が 7こで 70。40 ＋ 30 ＝ 70。', figure: blk(70) },
    {
      text: '35 ＋ 3 は、ばらの 5と 3を たして 8。じゅうの くらいは そのまま 3で、38。',
      figure: expr('35 ＋ 3 ＝ 38'),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng }) => generateAddSub2digit(level, rng),
    domainSize: ALL.length,
  },
  review: 'type',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第1学年 A(2) 加法・減法（簡単な場合について2位数などの加法・減法。解説）',
  revised: REVISED,
};
