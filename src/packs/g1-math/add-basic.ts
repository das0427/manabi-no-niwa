/**
 * g1.math.add-basic たしざん（和10以内）: 合併・増加（curriculum-matrix 3.4）。
 * 見本の単元: 各パックの担当はこの書き方（到達項目・同一性キー・誤概念・3段のヒント・解説・別例）を手本にする。
 *
 * 同一性キー: 交換法則はこの単元の学習内容ではないので、交換しただけの式は同じ問題（1.4）。
 *   キー = 小さい数+大きい数。定義域 = a,b≥0, 1≤a+b≤10 の組を交換で同一視した 35 通り（全件が基準）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';

type Obj = 'gappei' | 'zouka' | 'shiki' | 'bunshou' | 'erabu';

interface Scene {
  id: string;
  type: 'gappei' | 'zouka';
  a: string; // 絵
  b: string;
  unit: string; // こ・ひき・わ
  text: (a: number, b: number) => string;
}

/** 文章題の場面（合併4・増加4。数値だけ違うものは同じ場面: 1.4） */
const SCENES: Scene[] = [
  {
    id: 'fruit',
    type: 'gappei',
    a: 'apple',
    b: 'mikan',
    unit: 'こ',
    text: (a, b) => `りんごが ${a}こ、みかんが ${b}こ あります。あわせて なんこ ですか。`,
  },
  {
    id: 'pets',
    type: 'gappei',
    a: 'dog',
    b: 'cat',
    unit: 'ひき',
    text: (a, b) => `いぬが ${a}ひき、ねこが ${b}ひき います。あわせて なんびき ですか。`,
  },
  {
    id: 'berry',
    type: 'gappei',
    a: 'strawberry',
    b: 'peach',
    unit: 'こ',
    text: (a, b) => `いちごが ${a}こ、ももが ${b}こ。ぜんぶで なんこ ですか。`,
  },
  {
    id: 'garden',
    type: 'gappei',
    a: 'rabbit',
    b: 'frog',
    unit: 'ひき',
    text: (a, b) => `うさぎが ${a}ひき、かえるが ${b}ひき います。みんなで なんびき ですか。`,
  },
  {
    id: 'birds',
    type: 'zouka',
    a: 'bird',
    b: 'bird',
    unit: 'わ',
    text: (a, b) => `とりが ${a}わ います。${b}わ とんで きました。みんなで なんわ ですか。`,
  },
  {
    id: 'chicks',
    type: 'zouka',
    a: 'chick',
    b: 'chick',
    unit: 'わ',
    text: (a, b) => `ひよこが ${a}わ います。${b}わ やって きました。ぜんぶで なんわ ですか。`,
  },
  {
    id: 'turtles',
    type: 'zouka',
    a: 'turtle',
    b: 'turtle',
    unit: 'ひき',
    text: (a, b) => `かめが ${a}ひき います。あとから ${b}ひき きました。なんびきに なりましたか。`,
  },
  {
    id: 'apples',
    type: 'zouka',
    a: 'apple',
    b: 'apple',
    unit: 'こ',
    text: (a, b) => `りんごが ${a}こ あります。${b}こ もらいました。なんこに なりましたか。`,
  },
];

const key = (a: number, b: number) => `${Math.min(a, b)}+${Math.max(a, b)}`;

/** 段階ごとの和の上限と、出す到達項目 */
const LEVELS: { max: number; objs: Obj[] }[] = [
  { max: 5, objs: ['gappei', 'zouka'] },
  { max: 10, objs: ['gappei', 'zouka', 'shiki', 'erabu'] },
  { max: 10, objs: ['shiki', 'bunshou', 'erabu', 'gappei', 'zouka'] },
];

/**
 * 定義域（交換で同一視した組）から均等に1つ選び、左右の順はランダムにする。
 * 生成のあとで数をずらすと、特定の式に偏る（qa の偏りの検査で見つかった）。
 */
export function pickPair(
  rng: Rng,
  max: number,
  opt: { zero?: boolean; distinct?: boolean } = {},
): [number, number] {
  const pairs: [number, number][] = [];
  for (let a = opt.zero ? 0 : 1; a <= max; a++)
    for (let b = a; a + b <= max; b++) {
      if (a + b === 0) continue;
      if (opt.distinct && a === b) continue;
      pairs.push([a, b]);
    }
  const [x, y] = pairs[rng.int(0, pairs.length - 1)]!;
  return rng.next() < 0.5 ? [x, y] : [y, x];
}

/** 数えたしのヒント③: 最後の一手を残す（例 4+3 → 「4、5、6、…」） */
function countOnHint(a: number, b: number): string {
  if (b === 0) return `${b}こ たすと、かずは かわらないよ。`;
  if (a === 0) return `0に ${b}を たすと…`;
  const steps = Array.from({ length: b - 1 }, (_, i) => a + i + 1);
  return steps.length
    ? `${a}から ${b}こ かぞえよう。${steps.join('、')}、…`
    : `${a}の つぎの かずは…`;
}

function wrongs(a: number, b: number) {
  const s = a + b;
  const out: NumberItem['wrongAnswers'] = [];
  const add = (v: number | string, m: string) => {
    const t = String(v);
    if (t !== String(s) && !out.some((w) => w.value === t))
      out.push({ value: t, misconception: m });
  };
  if (s > 1) add(s - 1, 'off-by-one');
  add(s + 1, 'off-by-one');
  if (a !== b) add(Math.abs(a - b), 'sub-instead');
  if (a > 0 && b > 0) add(`${a}${b}`, 'concat');
  add(a, 'one-addend');
  add(b, 'one-addend');
  return out;
}

const blocksFig = (a: number, b: number): Figure => ({
  kind: 'row',
  items: [
    { kind: 'blocks', ones: a, tone: 'a' },
    { kind: 'text', text: '＋', size: 'l' },
    { kind: 'blocks', ones: b, tone: 'b' },
  ],
});

function numberItem(
  obj: Obj,
  level: number,
  a: number,
  b: number,
  prompt: string,
  figure: Figure | undefined,
  alt: boolean,
  hint1: string,
): NumberItem {
  const s = a + b;
  return {
    engine: 'number',
    id: `${obj}${alt ? '-alt' : ''}:${a}+${b}`,
    objective: obj,
    level,
    prompt,
    figure,
    hints: [hint1, `しきは ${a} ＋ ${b} だね。ブロックを ならべて かぞえよう。`, countOnHint(a, b)],
    explain: `${a}と ${b}を あわせると ${s}。しきは ${a} ＋ ${b} ＝ ${s} です。`,
    explainFigure: { kind: 'blocks', ones: s, frame: s <= 10 },
    identity: key(a, b),
    alt,
    fields: [{ answer: { kind: 'int', value: s } }],
    wrongAnswers: wrongs(a, b),
  };
}

function choiceItem(level: number, a: number, b: number, scene: Scene, alt: boolean): ChoiceItem {
  const opts: ChoiceItem['options'] = [
    { label: `${a} ＋ ${b}`, correct: true },
    { label: `${Math.max(a, b)} − ${Math.min(a, b)}`, misconception: 'sub-instead' },
    { label: `${a} ＋ ${b + 1}`, misconception: 'off-by-one' },
  ];
  return {
    engine: 'choice',
    id: `erabu${alt ? '-alt' : ''}:${scene.id}:${a}+${b}`,
    objective: 'erabu',
    level,
    prompt: `${scene.text(a, b)}\nこの おはなしに あう しきは どれ？`,
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
      scene.type === 'gappei'
        ? '「あわせて」は ふたつを いっしょに する ことだね。'
        : '「ふえる」と かずは おおきく なるね。',
      'たしざんは ＋、ひきざんは − の しるしを つかうよ。',
      `${a}と ${b}を あわせる しきは どれかな。`,
    ],
    explain: `あわせる（ふえる）ときは たしざん。しきは ${a} ＋ ${b} です。`,
    identity: key(a, b),
    alt,
    options: opts,
  };
}

export function generateAddBasic(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = lv.objs[(index + rng.int(0, lv.objs.length - 1)) % lv.objs.length]!;
  // 4問に1問は表し方を変えた問題（別例）
  const alt = rng.next() < 0.25;
  // 0 を含む式は「しきだけ」で扱う（ものが0このブロック・絵は出さない）。選ぶ問題は2つの数を違える
  const [a, b] = pickPair(rng, lv.max, { zero: obj === 'shiki', distinct: obj === 'erabu' });
  switch (obj) {
    case 'gappei': {
      const sc = SCENES.filter((s) => s.type === 'gappei')[rng.int(0, 3)]!;
      const fig: Figure = alt
        ? {
            kind: 'row',
            items: [
              { kind: 'illust', id: sc.a, count: a },
              { kind: 'illust', id: sc.b, count: b },
            ],
            gap: 4,
          }
        : blocksFig(a, b);
      return numberItem(
        'gappei',
        level,
        a,
        b,
        alt ? `${sc.text(a, b)}` : 'あわせて いくつ？',
        fig,
        alt,
        alt
          ? 'ふたつの なかまを いっしょに かぞえよう。'
          : 'ふたつの ブロックを ひとつに あわせよう。',
      );
    }
    case 'zouka': {
      const fig: Figure = alt
        ? {
            kind: 'numberline',
            min: 0,
            max: 10,
            step: 1,
            jump: { from: a, to: a + b },
            marks: [{ at: a, tone: 'focus' }],
          }
        : blocksFig(a, b);
      return numberItem(
        'zouka',
        level,
        a,
        b,
        alt ? `${a}から ${b} すすむと いくつ？` : `${a}こ あります。${b}こ ふえると いくつ？`,
        fig,
        alt,
        'はじめの かずに、ふえた かずを たそう。',
      );
    }
    case 'shiki':
      return alt
        ? numberItem(
            'shiki',
            level,
            a,
            b,
            `すうちょくせんで かんがえよう。${a} ＋ ${b} は いくつ？`,
            { kind: 'numberline', min: 0, max: 10, step: 1, marks: [{ at: a, tone: 'focus' }] },
            true,
            `${a}の ところから みぎへ すすもう。`,
          )
        : numberItem(
            'shiki',
            level,
            a,
            b,
            'けいさん しよう。',
            { kind: 'text', text: `${a} ＋ ${b} ＝ {{}}`, size: 'xl' },
            false,
            'ブロックを おもいうかべて みよう。',
          );
    case 'bunshou': {
      const sc = SCENES[rng.int(0, SCENES.length - 1)]!;
      const fig: Figure | undefined = alt
        ? {
            kind: 'tape',
            parts: [
              { length: a, label: String(a), tone: 'a' },
              { length: b, label: String(b), tone: 'b' },
            ],
            total: '？',
          }
        : undefined;
      return {
        ...numberItem(
          'bunshou',
          level,
          a,
          b,
          sc.text(a, b),
          fig,
          alt,
          sc.type === 'gappei'
            ? '「あわせて」「ぜんぶで」は たしざんだよ。'
            : 'ふえると かずは おおきく なるね。',
        ),
        id: `bunshou${alt ? '-alt' : ''}:${sc.id}:${a}+${b}`,
        fields: [{ answer: { kind: 'int', value: a + b }, label: sc.unit }],
        explain: `しきは ${a} ＋ ${b} ＝ ${a + b}。こたえは ${a + b}${sc.unit} です。`,
      };
    }
    case 'erabu': {
      const sc = SCENES[rng.int(0, SCENES.length - 1)]!;
      return choiceItem(level, a, b, sc, alt);
    }
  }
}

export const addBasic: UnitSpec = {
  id: 'g1.math.add-basic',
  title: 'たしざん（10まで）',
  stage: 'g1',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'partial',
  icon: 'math-add',
  prereq: ['g1.math.compose-10'],
  objectives: [
    { id: 'gappei', title: 'あわせる（ブロック・え）' },
    { id: 'zouka', title: 'ふえる（ブロック・すうちょくせん）' },
    { id: 'shiki', title: 'しきだけで けいさん' },
    { id: 'bunshou', title: 'ぶんしょうだい' },
    { id: 'erabu', title: 'おはなしに あう しきを えらぶ' },
  ],
  misconceptions: [
    {
      id: 'off-by-one',
      explain: 'かぞえる ときに、はじめの かずも かぞえたのかも。つぎの かずから かぞえよう。',
    },
    {
      id: 'sub-instead',
      explain: 'ひきざんを したのかな。「あわせて」「ふえる」は たしざんだよ。',
    },
    { id: 'concat', explain: 'すうじを ならべて かいたのかな。ふたつを あわせた かずを かこう。' },
    { id: 'one-addend', explain: 'かたほうの かずだけ かいたのかな。ふたつとも あわせよう。' },
  ],
  levels: [
    { label: 'あわせて5まで（ずつき）', chance: 0.05 },
    { label: 'あわせて10まで（ずつき）', chance: 0.05 },
    { label: 'しき・ぶんしょうだい', chance: 0.05 },
  ],
  intro: [
    {
      text: 'まるい ブロックが 3こ、しかくい ブロックが 2こ あります。',
      figure: blocksFig(3, 2),
    },
    {
      text: 'ひとつに あわせると、ぜんぶで 5こ。',
      figure: { kind: 'blocks', ones: 5, frame: true },
    },
    {
      text: 'これを しきで かくと、3 ＋ 2 ＝ 5。「たす」と よみます。',
      figure: { kind: 'text', text: '3 ＋ 2 ＝ 5', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateAddBasic(level, rng, index),
    domainSize: 35,
  },
  review: 'type',
  basis: '小学校学習指導要領（平成29年告示）算数 第1学年 A(2) 加法・減法（1位数同士の加法）',
  revised: '2026-10-24',
};
