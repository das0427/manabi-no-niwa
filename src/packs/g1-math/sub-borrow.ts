/**
 * g1.math.sub-borrow くりさがりの ある ひきざん（11〜18 − 1けた。こたえは 1けた）（curriculum-matrix 3.4）。
 *
 * 同一性キー: ひきざんは交換できないので、式 a−b そのもの。
 *   定義域 = a=10+u（u 1〜8）、b は u+1〜9（ばらから ひけない）、の 36 通り（全件が基準）。
 * 誤概念: 位ごとの逆引き（13−8→15）、10から ひいた のこりを たし忘れる（13−8→2）、
 *   減減法の途中で止まる（→10）、数えひきで1ずれる、たしてしまう、ひく順を逆にする。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { FillItem } from '../../engines/fill/fill';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { blocks, expr, pickFrom, REVISED } from './util';

type Obj = 'genka' | 'gengen' | 'shiki' | 'kyuuzan' | 'kyuusa' | 'erabu';

interface Scene {
  id: string;
  type: 'kyuuzan' | 'kyuusa';
  unit: string;
  text: (a: number, b: number) => string;
  /** ヒント①: この場面の「きいて いる ところ」（場面ごとに言葉が違うので場面が持つ） */
  look: string;
}

const LOOK_NOKORI = '「のこりは」は へった あとの かずを きいて いるね。';
const LOOK_CHIGAI = '「なんびき おおい」は ふたつを くらべて いるね。';

/** 文章題の場面（求残5・求差4。数値だけ違うものは同じ場面: 1.4） */
const SCENES: Scene[] = [
  {
    id: 'mikan',
    type: 'kyuuzan',
    unit: 'こ',
    text: (a, b) => `みかんが ${a}こ あります。${b}こ たべました。のこりは なんこ ですか。`,
    look: LOOK_NOKORI,
  },
  {
    id: 'birds',
    type: 'kyuuzan',
    unit: 'わ',
    text: (a, b) => `とりが ${a}わ います。${b}わ とんで いきました。のこりは なんわ ですか。`,
    look: LOOK_NOKORI,
  },
  {
    id: 'origami',
    type: 'kyuuzan',
    unit: 'まい',
    text: (a, b) =>
      `いろがみが ${a}まい あります。${b}まい つかいました。のこりは なんまい ですか。`,
    look: LOOK_NOKORI,
  },
  {
    id: 'sticker',
    type: 'kyuuzan',
    unit: 'まい',
    text: (a, b) =>
      `シールが ${a}まい あります。ともだちに ${b}まい あげました。のこりは なんまい ですか。`,
    look: LOOK_NOKORI,
  },
  {
    id: 'bus',
    type: 'kyuuzan',
    unit: 'にん',
    text: (a, b) => `バスに ${a}にん のって います。${b}にん おりました。なんにんに なりましたか。`,
    look: '「おりました」で ひとが へったね。あとの にんずうを きいて いるよ。',
  },
  {
    id: 'dogcat',
    type: 'kyuusa',
    unit: 'ひき',
    text: (a, b) =>
      `いぬが ${a}ひき、ねこが ${b}ひき います。いぬは ねこより なんびき おおいですか。`,
    look: LOOK_CHIGAI,
  },
  {
    id: 'fruit',
    type: 'kyuusa',
    unit: 'こ',
    text: (a, b) => `りんごが ${a}こ、ももが ${b}こ あります。ちがいは なんこ ですか。`,
    look: '「ちがいは」は ふたつの かずを くらべて いるね。',
  },
  {
    id: 'chairs',
    type: 'kyuusa',
    unit: 'にん',
    text: (a, b) =>
      `こどもが ${a}にん、いすが ${b}こ あります。いすに すわれない こどもは なんにん ですか。`,
    look: 'こどもの かずと いすの かずを くらべて、たりない ぶんを きいて いるね。',
  },
  {
    id: 'frogs',
    type: 'kyuusa',
    unit: 'ひき',
    text: (a, b) =>
      `かえるが ${a}ひき、かめが ${b}ひき います。かえるは かめより なんびき おおいですか。`,
    look: LOOK_CHIGAI,
  },
];

/** 定義域 36 通り */
export const SUB_BORROW_DOMAIN: [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let u = 1; u <= 8; u++) for (let b = u + 1; b <= 9; b++) out.push([10 + u, b]);
  return out;
})();

const key = (a: number, b: number) => `${a}-${b}`;

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['genka', 'gengen'] },
  { objs: ['genka', 'gengen', 'shiki', 'erabu'] },
  { objs: ['shiki', 'kyuuzan', 'kyuusa', 'erabu'] },
];

/** 誤答の値（正答・重複は除く） */
function wrongs(a: number, b: number): NonNullable<NumberItem['wrongAnswers']> {
  const u = a - 10;
  const c = a - b;
  const out: NonNullable<NumberItem['wrongAnswers']> = [];
  const add = (v: number, m: string) => {
    const t = String(v);
    if (v !== c && v >= 0 && !out.some((w) => w.value === t))
      out.push({ value: t, misconception: m });
  };
  add(10 + b - u, 'reverse-sub');
  add(10 - b, 'genka-forget');
  add(10, 'gengen-stop');
  add(c + 1, 'off-by-one');
  add(c - 1, 'off-by-one');
  add(a + b, 'add-instead');
  return out;
}

function explainOf(a: number, b: number): string {
  const u = a - 10;
  return `${a} − ${b} ＝ ${a - b}。10から ${b}を ひいて ${10 - b}、${10 - b}と ばらの ${u}で ${a - b} です。`;
}

function numberItem(
  obj: Obj,
  level: number,
  a: number,
  b: number,
  prompt: string,
  figure: Figure | undefined,
  alt: boolean,
  hints: string[],
  unit?: string,
  sceneId?: string,
): NumberItem {
  const c = a - b;
  return {
    engine: 'number',
    id: `${obj}${alt ? '-alt' : ''}:${sceneId ? `${sceneId}:` : ''}${a}-${b}`,
    objective: obj,
    level,
    prompt,
    figure,
    hints,
    explain: unit ? `しきは ${a} − ${b} ＝ ${c}。こたえは ${c}${unit} です。` : explainOf(a, b),
    explainFigure: { kind: 'blocks', ones: c, frame: true },
    identity: key(a, b),
    alt,
    fields: [{ answer: { kind: 'int', value: c }, label: unit }],
    wrongAnswers: wrongs(a, b),
  };
}

/** 途中の式の空欄を埋める（別例: さくらんぼ計算を式で） */
function fillItem(obj: 'genka' | 'gengen', level: number, a: number, b: number): FillItem {
  const u = a - 10;
  const c = a - b;
  const mid = obj === 'genka' ? 10 - b : 10;
  const rev = 10 + b - u;
  const pool = new Set([mid, c, rev]);
  const off = pool.has(c + 1) ? c - 1 : c + 1;
  const options = [mid, c, rev, off].map(String);
  const last: { value: string; misconception: string }[] = [
    { value: String(rev), misconception: 'reverse-sub' },
    { value: String(off), misconception: 'off-by-one' },
    { value: String(mid), misconception: obj === 'genka' ? 'genka-forget' : 'gengen-stop' },
  ];
  return {
    engine: 'fill',
    id: `${obj}-alt:${a}-${b}`,
    objective: obj,
    level,
    prompt:
      obj === 'genka'
        ? `${a} − ${b} を、10から ひいて けいさん しよう。{{}}に はいる かずを えらぼう。`
        : `${a} − ${b} を、さきに ばらを ひいて けいさん しよう。{{}}に はいる かずを えらぼう。`,
    text:
      obj === 'genka'
        ? `10 − ${b} ＝ {{}}\n{{}} ＋ ${u} ＝ {{}}`
        : `${a} − ${u} ＝ {{}}\n{{}} − ${b - u} ＝ {{}}`,
    options,
    blanks: [
      { answers: [String(mid)] },
      { answers: [String(mid)] },
      { answers: [String(c)], wrong: last },
    ],
    hints:
      obj === 'genka'
        ? [
            `${a}を 10と ${u}に わけて かんがえよう。`,
            `10から ${b}を ひくと いくつ かな。`,
            `10から ひいた のこりと、ばらの ${u}を あわせると…`,
          ]
        : [
            `ひく かず ${b}を ${u}と ${b - u}に わけて かんがえよう。`,
            `${a}から ばらの ${u}を ひくと 10。`,
            `10から あと ${b - u} ひくと…`,
          ],
    explain:
      obj === 'genka'
        ? `10 − ${b} ＝ ${10 - b}、${10 - b} ＋ ${u} ＝ ${c}。こたえは ${c} です。`
        : `${a} − ${u} ＝ 10、10 − ${b - u} ＝ ${c}。こたえは ${c} です。`,
    identity: key(a, b),
    alt: true,
  };
}

function choiceItem(level: number, a: number, b: number, sc: Scene, alt: boolean): ChoiceItem {
  return {
    engine: 'choice',
    id: `erabu${alt ? '-alt' : ''}:${sc.id}:${a}-${b}`,
    objective: 'erabu',
    level,
    prompt: `${sc.text(a, b)}\nこの おはなしに あう しきは どれ？`,
    figure: alt
      ? {
          kind: 'tape',
          parts: [
            { length: b, label: String(b), tone: 'b' },
            { length: a - b, label: '？', tone: 'muted' },
          ],
          total: String(a),
        }
      : undefined,
    hints: [
      sc.look,
      'へる・くらべる ときは ひきざん（−）を つかうよ。',
      // 答えの手前で止める: 「おおきい かずを さきに かく」ことだけを言い、どの式かは言わない
      'ひきざんの しきは、おおきい かずを さきに かくよ。この おはなしで おおきい かずは どっちかな。',
    ],
    explain: `ひきざんの しきは ${a} − ${b} です。おおきい かずから ちいさい かずを ひきます。`,
    identity: key(a, b),
    alt,
    options: [
      { label: `${a} − ${b}`, correct: true },
      { label: `${a} ＋ ${b}`, misconception: 'add-instead' },
      { label: `${b} − ${a}`, misconception: 'swap-order' },
    ],
  };
}

export function generateSubBorrow(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = lv.objs[(index + rng.int(0, lv.objs.length - 1)) % lv.objs.length]!;
  const alt = rng.next() < 0.25;
  const [a, b] = pickFrom(rng, SUB_BORROW_DOMAIN);
  const u = a - 10;
  switch (obj) {
    case 'genka':
      if (alt) return fillItem('genka', level, a, b);
      return numberItem(
        'genka',
        level,
        a,
        b,
        `${a} − ${b} を、10から ひいて かんがえよう。`,
        { kind: 'column', items: [expr(`${a} − ${b} ＝ {{}}`), blocks(a)], gap: 2 },
        false,
        [
          `ばらの ${u}から ${b}は ひけないね。10の まとまりから ひこう。`,
          `10 − ${b} ＝ ${10 - b} だね。`,
          `${10 - b}と ばらの ${u}を あわせると…`,
        ],
      );
    case 'gengen':
      if (alt) return fillItem('gengen', level, a, b);
      return numberItem(
        'gengen',
        level,
        a,
        b,
        `${a} − ${b} を、さきに ばらの ${u}を ひいて かんがえよう。`,
        { kind: 'column', items: [expr(`${a} − ${b} ＝ {{}}`), blocks(a)], gap: 2 },
        false,
        [
          `ひく かず ${b}を ${u}と ${b - u}に わけよう。`,
          `${a} − ${u} ＝ 10 だね。`,
          `10から あと ${b - u} ひくと…`,
        ],
      );
    case 'shiki':
      return alt
        ? numberItem(
            'shiki',
            level,
            a,
            b,
            `すうちょくせんで かんがえよう。${a} − ${b} は いくつ？`,
            {
              kind: 'numberline',
              min: 0,
              max: 20,
              step: 1,
              labelEvery: 5,
              marks: [{ at: a, tone: 'focus' }],
            },
            true,
            [
              `${a}の ところから ひだりへ もどろう。`,
              `まず ${u} もどると 10。`,
              `10から あと ${b - u} もどると…`,
            ],
          )
        : numberItem(
            'shiki',
            level,
            a,
            b,
            'けいさん しよう。',
            expr(`${a} − ${b} ＝ {{}}`),
            false,
            [
              `${a}は 10と ${u}。ばらから ${b}は ひけないね。`,
              `10 − ${b} ＝ ${10 - b}。`,
              `${10 - b} ＋ ${u} を けいさん すると…`,
            ],
          );
    case 'kyuuzan':
    case 'kyuusa': {
      const list = SCENES.filter((s) => s.type === obj);
      const sc = pickFrom(rng, list);
      const fig: Figure | undefined = alt
        ? obj === 'kyuuzan'
          ? {
              kind: 'tape',
              parts: [
                { length: b, label: String(b), tone: 'b' },
                { length: a - b, label: '？', tone: 'muted' },
              ],
              total: String(a),
            }
          : {
              kind: 'column',
              items: [
                { kind: 'tape', parts: [{ length: a, label: String(a), tone: 'a' }] },
                {
                  kind: 'tape',
                  parts: [
                    { length: b, label: String(b), tone: 'b' },
                    { length: a - b, label: '？', tone: 'muted' },
                  ],
                },
              ],
              gap: 1,
            }
        : undefined;
      return numberItem(
        obj,
        level,
        a,
        b,
        sc.text(a, b),
        fig,
        alt,
        [
          `${sc.look}ひきざんで もとめるよ。`,
          `しきは ${a} − ${b} だね。`,
          `10から ${b}を ひくと ${10 - b}。${10 - b}と ${u}で…`,
        ],
        sc.unit,
        sc.id,
      );
    }
    case 'erabu':
      return choiceItem(level, a, b, pickFrom(rng, SCENES), alt);
  }
}

export const subBorrow: UnitSpec = {
  id: 'g1.math.sub-borrow',
  title: 'くりさがりの ある ひきざん',
  stage: 'g1',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'math-formula-sub',
  prereq: ['g1.math.add-carry'],
  objectives: [
    { id: 'genka', title: '10から ひく（げんかほう）' },
    { id: 'gengen', title: 'ばらから ひいて、10から ひく（げんげんほう）' },
    { id: 'shiki', title: 'しきだけで けいさん' },
    { id: 'kyuuzan', title: 'のこりは いくつ（ぶんしょうだい）' },
    { id: 'kyuusa', title: 'ちがいは いくつ（ぶんしょうだい）' },
    { id: 'erabu', title: 'おはなしに あう しきを えらぶ' },
  ],
  misconceptions: [
    {
      id: 'reverse-sub',
      explain:
        'ばらの かずから ひけないので、ぎゃくに ひいたのかな。ばらから ひけない ときは、10の まとまりから ひこう。',
    },
    {
      id: 'genka-forget',
      explain:
        '10から ひいた のこりだけを かいたのかな。のこりと ばらの かずを あわせるのを わすれずに。',
    },
    {
      id: 'gengen-stop',
      explain:
        'ばらを ひいて 10に なった ところで とまったのかな。10から あと いくつ ひくか かんがえよう。',
    },
    {
      id: 'off-by-one',
      explain:
        'もどりながら かぞえる ときに、はじめの かずも かぞえたのかも。ひとつ もどった ところから かぞえよう。',
    },
    { id: 'add-instead', explain: 'たしざんを したのかな。「のこり」「ちがい」は ひきざんだよ。' },
    {
      id: 'swap-order',
      explain:
        'ひく かずと ひかれる かずが ぎゃくに なったのかな。おおきい かずから ちいさい かずを ひくよ。',
    },
  ],
  levels: [
    { label: 'ブロックで（10から ひく・ばらから ひく）', chance: 0.05 },
    { label: 'しき', chance: 0.05 },
    { label: 'しき・ぶんしょうだい', chance: 0.05 },
  ],
  intro: [
    {
      text: '13この ブロックから 8こ とります。ばらの 3こからは 8こ とれません。',
      figure: blocks(13),
    },
    {
      text: '10の まとまりから 8こ とると、のこりは 2こ。',
      figure: { kind: 'blocks', ones: 2, frame: true },
    },
    {
      text: 'のこりの 2こと ばらの 3こを あわせて 5こ。13 − 8 ＝ 5。',
      figure: expr('13 − 8 ＝ 5'),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateSubBorrow(level, rng, index),
    domainSize: SUB_BORROW_DOMAIN.length,
  },
  review: 'type',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第1学年 A(2) 加法・減法（1位数と1位数との加法及びその逆の減法）',
  revised: REVISED,
};
