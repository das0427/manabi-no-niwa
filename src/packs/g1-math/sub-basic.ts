/**
 * g1.math.sub-basic ひきざん（10まで）: 求残・求差（curriculum-matrix 3.4）。
 *
 * 同一性キー = `a-b`（ひく順は意味があるので交換しない）。
 * 定義域 = 1≤a≤10、0≤b≤a の 65 通り（全件が基準）。b=0・b=a（こたえ 0）は「しきだけ」で扱う
 * （ものが 0こ の ブロック・絵は出さない）。
 * 文章題の場面: 求残5・求差4（数値だけ違うものは同じ場面: 1.4）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { REVISED } from './util';

type Obj = 'nokori' | 'chigai' | 'shiki' | 'bunshou' | 'erabu';

interface Scene {
  id: string;
  type: 'nokori' | 'chigai';
  /** 絵（別例の図） */
  a: string;
  b: string;
  unit: string;
  text: (a: number, b: number) => string;
}

const SCENES: Scene[] = [
  {
    id: 'birds-fly',
    type: 'nokori',
    a: 'bird',
    b: 'bird',
    unit: 'わ',
    text: (a, b) =>
      `でんせんに とりが ${a}わ います。${b}わ とんで いきました。のこりは なんわ ですか。`,
  },
  {
    id: 'apples-eat',
    type: 'nokori',
    a: 'apple',
    b: 'apple',
    unit: 'こ',
    text: (a, b) => `りんごが ${a}こ あります。${b}こ たべました。のこりは なんこ ですか。`,
  },
  {
    id: 'frogs-pond',
    type: 'nokori',
    a: 'frog',
    b: 'frog',
    unit: 'ひき',
    text: (a, b) =>
      `かえるが ${a}ひき います。${b}ひき いけに とびこみました。のこりは なんびき ですか。`,
  },
  {
    id: 'strawberry-give',
    type: 'nokori',
    a: 'strawberry',
    b: 'strawberry',
    unit: 'こ',
    text: (a, b) =>
      `いちごが ${a}こ あります。いもうとに ${b}こ あげました。のこりは なんこ ですか。`,
  },
  {
    id: 'chicks-home',
    type: 'nokori',
    a: 'chick',
    b: 'chick',
    unit: 'わ',
    text: (a, b) =>
      `ひよこが ${a}わ あそんで います。${b}わ かえりました。なんわ のこって いますか。`,
  },
  {
    id: 'dog-cat',
    type: 'chigai',
    a: 'dog',
    b: 'cat',
    unit: 'ひき',
    text: (a, b) =>
      `いぬが ${a}ひき、ねこが ${b}ひき います。いぬは ねこより なんびき おおい ですか。`,
  },
  {
    id: 'mikan-peach',
    type: 'chigai',
    a: 'mikan',
    b: 'peach',
    unit: 'こ',
    text: (a, b) => `みかんが ${a}こ、ももが ${b}こ あります。ちがいは なんこ ですか。`,
  },
  {
    id: 'rabbit-turtle',
    type: 'chigai',
    a: 'rabbit',
    b: 'turtle',
    unit: 'ひき',
    text: (a, b) =>
      `うさぎが ${a}ひき、かめが ${b}ひき います。かめは うさぎより なんびき すくない ですか。`,
  },
  {
    id: 'tomato-carrot',
    type: 'chigai',
    a: 'tomato',
    b: 'carrot',
    unit: 'こ',
    text: (a, b) =>
      `はたけで トマトを ${a}こ、にんじんを ${b}こ とりました。トマトは にんじんより なんこ おおい ですか。`,
  },
];

const key = (a: number, b: number) => `${a}-${b}`;

const LEVELS: { max: number; objs: Obj[] }[] = [
  { max: 5, objs: ['nokori', 'chigai'] },
  { max: 10, objs: ['nokori', 'chigai', 'shiki', 'erabu'] },
  { max: 10, objs: ['shiki', 'bunshou', 'erabu', 'nokori', 'chigai'] },
];

/**
 * 定義域から均等に1つ（生成のあとで数をずらさない）。
 * zero: b=0・b=a を含める（しきだけ）。strict: b<a（ちがいを くらべる問題）
 */
function pickPair(
  rng: Rng,
  max: number,
  opt: { zero?: boolean; strict?: boolean },
): [number, number] {
  const pairs: [number, number][] = [];
  for (let a = 1; a <= max; a++)
    for (let b = opt.zero ? 0 : 1; b <= (opt.zero ? a : a - 1); b++) pairs.push([a, b]);
  return pairs[rng.int(0, pairs.length - 1)]!;
}

/** 数えひきのヒント③: 最後の一手を残す（例 7−3 →「6、5、…」） */
function countBackHint(a: number, b: number): string {
  if (b === 0) return '0こ とる ときは、なにも へらないね。';
  if (b === a) return `${a}こ ぜんぶ とると…`;
  const steps = Array.from({ length: b - 1 }, (_, i) => a - i - 1);
  return steps.length
    ? `${a}から ${b}こ もどろう。${steps.join('、')}、…`
    : `${a}の ひとつ まえの かずは…`;
}

function wrongs(a: number, b: number) {
  const d = a - b;
  const out: NonNullable<NumberItem['wrongAnswers']> = [];
  const add = (v: number, m: string) => {
    if (v !== d && v >= 0 && !out.some((w) => w.value === String(v)))
      out.push({ value: String(v), misconception: m });
  };
  add(a + b, 'add-instead');
  add(d + 1, 'off-by-one');
  add(d - 1, 'off-by-one');
  add(b, 'take-part');
  add(a, 'take-part');
  return out;
}

const takeAwayFig = (a: number, b: number): Figure => ({
  kind: 'row',
  items: [
    { kind: 'blocks', ones: a - b, tone: 'a' },
    { kind: 'blocks', ones: b, tone: 'muted' },
  ],
  gap: 4,
});

const compareFig = (a: number, b: number): Figure => ({
  kind: 'column',
  items: [
    { kind: 'blocks', ones: a, tone: 'a' },
    { kind: 'blocks', ones: b, tone: 'b' },
  ],
  gap: 2,
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
  hint2: string,
): NumberItem {
  const d = a - b;
  return {
    engine: 'number',
    id: `${obj}${alt ? '-alt' : ''}:${key(a, b)}`,
    objective: obj,
    level,
    prompt,
    figure,
    hints: [hint1, hint2, countBackHint(a, b)],
    explain: `${a}から ${b}を ひくと ${d}。しきは ${a} − ${b} ＝ ${d} です。`,
    explainFigure:
      d > 0 && b > 0
        ? takeAwayFig(a, b)
        : { kind: 'text', text: `${a} − ${b} ＝ ${d}`, size: 'xl' },
    identity: key(a, b),
    alt,
    fields: [{ answer: { kind: 'int', value: d } }],
    wrongAnswers: wrongs(a, b),
  };
}

function tape(a: number, b: number, type: 'nokori' | 'chigai'): Figure {
  return type === 'nokori'
    ? {
        kind: 'tape',
        parts: [
          { length: b, label: String(b), tone: 'muted' },
          { length: a - b, label: '？', tone: 'a' },
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
              { length: a - b, label: '？', tone: 'plain' },
            ],
          },
        ],
      };
}

function choiceItem(level: number, a: number, b: number, sc: Scene, alt: boolean): ChoiceItem {
  return {
    engine: 'choice',
    id: `erabu${alt ? '-alt' : ''}:${sc.id}:${key(a, b)}`,
    objective: 'erabu',
    level,
    prompt: `${sc.text(a, b)}\nこの おはなしに あう しきは どれ？`,
    figure: alt ? tape(a, b, sc.type) : undefined,
    hints: [
      sc.type === 'nokori'
        ? '「のこりは」は へった あとの かずを きいて いるね。'
        : '「ちがいは」「なんこ おおい」は 2つを くらべて いるね。',
      'たしざんは ＋、ひきざんは − の しるしを つかうよ。',
      `おおきい ${a}から ちいさい ${b}を どうする しきかな。`,
    ],
    explain:
      sc.type === 'nokori'
        ? `へった のこりを もとめるので ひきざん。しきは ${a} − ${b} です。`
        : `ちがいを もとめるので ひきざん。しきは ${a} − ${b} です。`,
    identity: key(a, b),
    alt,
    options: [
      { label: `${a} − ${b}`, correct: true },
      { label: `${a} ＋ ${b}`, misconception: 'add-instead' },
      { label: `${b} − ${a}`, misconception: 'reverse-order' },
    ],
  };
}

export function generateSubBasic(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  let obj = lv.objs[(index + rng.int(0, lv.objs.length - 1)) % lv.objs.length]!;
  const alt = rng.next() < 0.25;
  // しきを出す段階では、定義域全体から均等に選び、0を含む式（b=0・b=a）は しきにする（キーの偏りを防ぐ）
  const pre = lv.objs.includes('shiki') ? pickPair(rng, lv.max, { zero: true }) : null;
  if (pre && (pre[1] === 0 || pre[1] === pre[0])) obj = 'shiki';
  const pair = (o: { zero?: boolean; strict?: boolean }) => pre ?? pickPair(rng, lv.max, o);
  switch (obj) {
    case 'nokori': {
      const [a, b] = pair({});
      const sc = SCENES.filter((s) => s.type === 'nokori')[rng.int(0, 4)]!;
      return numberItem(
        'nokori',
        level,
        a,
        b,
        alt ? sc.text(a, b) : `${a}こ あります。${b}こ とると、のこりは いくつ？`,
        alt
          ? {
              kind: 'row',
              items: [
                { kind: 'illust', id: sc.a, count: a - b },
                { kind: 'illust', id: sc.b, count: b, tone: 'muted' },
              ],
              gap: 4,
            }
          : { kind: 'blocks', ones: a },
        alt,
        alt ? 'うすい えは いなく なった ぶんだよ。' : 'とった ぶんを ゆびで かくして みよう。',
        `しきは ${a} − ${b} だね。`,
      );
    }
    case 'chigai': {
      const [a, b] = pair({ strict: true });
      return numberItem(
        'chigai',
        level,
        a,
        b,
        alt
          ? `すうちょくせんで かんがえよう。${b}から ${a}までは いくつ？`
          : `うえの ブロックは したより いくつ おおい？`,
        alt
          ? {
              kind: 'numberline',
              min: 0,
              max: 10,
              step: 1,
              marks: [
                { at: b, tone: 'b' },
                { at: a, tone: 'a' },
              ],
            }
          : compareFig(a, b),
        alt,
        alt ? '2つの しるしの あいだを みよう。' : 'うえと したを 1こずつ せんで むすんで みよう。',
        alt
          ? `しきは ${a} − ${b} だね。`
          : `むすべなかった ブロックが ちがいだよ。しきは ${a} − ${b} だね。`,
      );
    }
    case 'shiki': {
      const [a, b] = pair({ zero: true });
      return alt
        ? numberItem(
            'shiki',
            level,
            a,
            b,
            `すうちょくせんで かんがえよう。${a} − ${b} は いくつ？`,
            { kind: 'numberline', min: 0, max: 10, step: 1, marks: [{ at: a, tone: 'focus' }] },
            true,
            `${a}の ところから ひだりへ もどろう。`,
            `${b}めもり もどるよ。`,
          )
        : numberItem(
            'shiki',
            level,
            a,
            b,
            'けいさん しよう。',
            { kind: 'text', text: `${a} − ${b} ＝ {{}}`, size: 'xl' },
            false,
            'ブロックを おもいうかべて みよう。',
            `${a}こから ${b}こ とるよ。`,
          );
    }
    case 'bunshou': {
      const sc = SCENES[rng.int(0, SCENES.length - 1)]!;
      const [a, b] = pair({ strict: true });
      return {
        ...numberItem(
          'bunshou',
          level,
          a,
          b,
          sc.text(a, b),
          alt ? tape(a, b, sc.type) : undefined,
          alt,
          sc.type === 'nokori'
            ? '「のこりは」は ひきざんで もとめるよ。'
            : '「ちがいは」「なんこ おおい」も ひきざんで もとめるよ。',
          `しきは ${a} − ${b} だね。`,
        ),
        id: `bunshou${alt ? '-alt' : ''}:${sc.id}:${key(a, b)}`,
        fields: [{ answer: { kind: 'int', value: a - b }, label: sc.unit }],
        explain: `しきは ${a} − ${b} ＝ ${a - b}。こたえは ${a - b}${sc.unit} です。`,
      };
    }
    case 'erabu': {
      const sc = SCENES[rng.int(0, SCENES.length - 1)]!;
      const [a, b] = pair({ strict: true });
      return choiceItem(level, a, b, sc, alt);
    }
  }
}

export const subBasic: UnitSpec = {
  id: 'g1.math.sub-basic',
  title: 'ひきざん（10まで）',
  stage: 'g1',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'math-sub',
  prereq: ['g1.math.add-basic'],
  objectives: [
    { id: 'nokori', title: 'のこりは いくつ（ブロック・え）' },
    { id: 'chigai', title: 'ちがいは いくつ（ブロック・すうちょくせん）' },
    { id: 'shiki', title: 'しきだけで けいさん' },
    { id: 'bunshou', title: 'ぶんしょうだい' },
    { id: 'erabu', title: 'おはなしに あう しきを えらぶ' },
  ],
  misconceptions: [
    {
      id: 'add-instead',
      explain: 'たしざんを したのかな。「のこりは」「ちがいは」は ひきざんだよ。',
    },
    {
      id: 'off-by-one',
      explain: 'もどる ときに、はじめの かずも かぞえたのかも。ひとつ まえの かずから かぞえよう。',
    },
    {
      id: 'take-part',
      explain: 'しきの なかの かずを そのまま かいたのかな。のこりや ちがいを かんがえよう。',
    },
    {
      id: 'reverse-order',
      explain:
        'ちいさい かずから おおきい かずを ひく しきに したのかな。おおきい ほうから ひくよ。',
    },
  ],
  levels: [
    { label: '5までの ひきざん（ずつき）', chance: 0.05 },
    { label: '10までの ひきざん（ずつき）', chance: 0.05 },
    { label: 'しき・ぶんしょうだい', chance: 0.05 },
  ],
  intro: [
    { text: 'ブロックが 5こ あります。', figure: { kind: 'blocks', ones: 5 } },
    { text: '2こ とると、のこりは 3こ。', figure: takeAwayFig(5, 2) },
    {
      text: 'これを しきで かくと、5 − 2 ＝ 3。「ひく」と よみます。くらべて ちがいを みる ときも ひきざんだよ。',
      figure: { kind: 'text', text: '5 − 2 ＝ 3', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateSubBasic(level, rng, index),
    domainSize: 65,
  },
  review: 'type',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第1学年 A(2) 加法・減法（1位数の減法: 求残・求差）',
  revised: REVISED,
};
