/**
 * g1.math.add-carry くりあがりの ある たしざん（curriculum-matrix 3.4・1.5 の到達項目の例）。
 *
 * 同一性キー = `a+b`（順序つき）。くり上がりの計算では、どちらの数で10を作るか（加数分解・被加数分解）が
 * 学習内容なので、交換しただけの式（8＋5 と 5＋8）を別の問題とする（1.4 の例外の側）。
 * 定義域 = 1位数＋1位数で和が11〜18の順序つきの組 36 通り ＋ 和がちょうど10の組（10のまとまり）9 通り = 45（全件が基準）。
 * 文章題の場面: 合併4・増加4（数値だけ違うものは同じ場面）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { FillItem } from '../../engines/fill/fill';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { REVISED } from './util';

type Obj = 'matomari' | 'kasuu' | 'hisuu' | 'shiki' | 'zouka' | 'gappei' | 'erabu';

interface Scene {
  id: string;
  type: 'gappei' | 'zouka';
  unit: string;
  text: (a: number, b: number) => string;
}

const SCENES: Scene[] = [
  {
    id: 'kuri-donguri',
    type: 'gappei',
    unit: 'こ',
    text: (a, b) => `くりを ${a}こ、どんぐりを ${b}こ ひろいました。あわせて なんこ ですか。`,
  },
  {
    id: 'origami',
    type: 'gappei',
    unit: 'まい',
    text: (a, b) => `おりがみが ${a}まい、シールが ${b}まい あります。あわせて なんまい ですか。`,
  },
  {
    id: 'kame-kaeru',
    type: 'gappei',
    unit: 'ひき',
    text: (a, b) => `いけに かめが ${a}ひき、かえるが ${b}ひき います。みんなで なんびき ですか。`,
  },
  {
    id: 'cookie',
    type: 'gappei',
    unit: 'まい',
    text: (a, b) =>
      `おさらに クッキーが ${a}まい、せんべいが ${b}まい あります。ぜんぶで なんまい ですか。`,
  },
  {
    id: 'suzume',
    type: 'zouka',
    unit: 'わ',
    text: (a, b) =>
      `でんせんに すずめが ${a}わ います。${b}わ とんで きました。すずめは なんわに なりましたか。`,
  },
  {
    id: 'biidama',
    type: 'zouka',
    unit: 'こ',
    text: (a, b) =>
      `ビーだまを ${a}こ もって います。ともだちから ${b}こ もらいました。ぜんぶで なんこに なりましたか。`,
  },
  {
    id: 'kingyo',
    type: 'zouka',
    unit: 'ひき',
    text: (a, b) =>
      `すいそうに きんぎょが ${a}ひき います。${b}ひき いれました。きんぎょは なんびきに なりましたか。`,
  },
  {
    id: 'ame',
    type: 'zouka',
    unit: 'こ',
    text: (a, b) =>
      `あめを ${a}こ かいました。あとで また ${b}こ かいました。あめは ぜんぶで なんこ ですか。`,
  },
];

const key = (a: number, b: number) => `${a}+${b}`;

/** 和11〜18（くり上がり）の順序つきの組。big: a≥b（加数分解に向く）、small: a<b（被加数分解に向く） */
function carryPairs(which: 'all' | 'big' | 'small'): [number, number][] {
  const out: [number, number][] = [];
  for (let a = 2; a <= 9; a++)
    for (let b = 2; b <= 9; b++) {
      if (a + b < 11) continue;
      if (which === 'big' && a < b) continue;
      if (which === 'small' && a >= b) continue;
      out.push([a, b]);
    }
  return out;
}
const ALL = carryPairs('all'); // 36
const BIG = carryPairs('big'); // 20
const SMALL = carryPairs('small'); // 16

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['matomari', 'kasuu'] },
  { objs: ['kasuu', 'hisuu', 'shiki'] },
  { objs: ['shiki', 'zouka', 'gappei', 'erabu', 'kasuu', 'hisuu'] },
];

const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[rng.int(0, xs.length - 1)]!;

function wrongs(a: number, b: number): NonNullable<NumberItem['wrongAnswers']> {
  const s = a + b;
  const out: NonNullable<NumberItem['wrongAnswers']> = [];
  const add = (v: number, m: string) => {
    if (v !== s && v >= 0 && !out.some((w) => w.value === String(v)))
      out.push({ value: String(v), misconception: m });
  };
  if (s > 10) add(s - 10, 'no-carry');
  add(s - 1, 'off-by-one');
  add(s + 1, 'off-by-one');
  if (a !== b) add(Math.abs(a - b), 'sub-instead');
  add(Number(`${a}${b}`), 'concat');
  return out;
}

const pairFig = (a: number, b: number): Figure => ({
  kind: 'row',
  items: [
    { kind: 'blocks', ones: a, frame: true },
    { kind: 'text', text: '＋', size: 'l' },
    { kind: 'blocks', ones: b, tone: 'b' },
  ],
});

/** 10を作る手順の解説（大きい方 big に、小さい方 small から need を移す） */
function stepsText(a: number, b: number): string {
  const s = a + b;
  if (a >= b) {
    const need = 10 - a;
    return `${a}は あと ${need}で 10。${b}を ${need}と ${b - need}に わけて、${a}＋${need}＝10、10＋${b - need}＝${s}。`;
  }
  const need = 10 - b;
  return `${b}は あと ${need}で 10。${a}を ${a - need}と ${need}に わけて、${b}＋${need}＝10、10＋${a - need}＝${s}。`;
}

function carryHints(a: number, b: number, hint1: string): string[] {
  const big = Math.max(a, b);
  const need = 10 - big;
  const small = Math.min(a, b);
  return [
    hint1,
    `${big}は あと ${need}で 10。${small}を ${need}と いくつに わけよう。`,
    `${big}＋${need}＝10。10と のこりの ${small - need}で…`,
  ];
}

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
    id: `${obj}${alt ? '-alt' : ''}:${key(a, b)}`,
    objective: obj,
    level,
    prompt,
    figure,
    hints:
      s === 10
        ? [hint1, `${a}は あと いくつで 10かな。`, `${a}と ${b}を あわせると、10の わくが…`]
        : carryHints(a, b, hint1),
    explain:
      s === 10
        ? `${a}と ${b}で 10。${a} ＋ ${b} ＝ 10 です。`
        : `${stepsText(a, b)} ${a} ＋ ${b} ＝ ${s} です。`,
    explainFigure: { kind: 'blocks', tens: Math.floor(s / 10), ones: s % 10 },
    identity: key(a, b),
    alt,
    fields: [{ answer: { kind: 'int', value: s } }],
    wrongAnswers: wrongs(a, b),
  };
}

/** さくらんぼ図の手順を□で埋める（加数分解: 後ろの数を分ける ／ 被加数分解: 前の数を分ける） */
function splitFill(obj: 'kasuu' | 'hisuu', level: number, a: number, b: number): FillItem {
  const s = a + b;
  const big = obj === 'kasuu' ? a : b;
  const small = obj === 'kasuu' ? b : a;
  const need = 10 - big;
  const rest = small - need;
  const values = [...new Set([rest, s, need, s + 1, s - 1, rest + 1])].filter((v) => v >= 0);
  const options = values
    .slice(0, 6)
    .sort((x, y) => x - y)
    .map(String);
  const has = (v: number) => options.includes(String(v)) && v !== rest;
  const restWrong = [
    ...(has(need) ? [{ value: String(need), misconception: 'split-miss' }] : []),
    ...(has(rest + 1) ? [{ value: String(rest + 1), misconception: 'off-by-one' }] : []),
  ];
  const sumWrong = [
    ...(options.includes(String(rest)) && rest !== s
      ? [{ value: String(rest), misconception: 'no-carry' }]
      : []),
    ...[s + 1, s - 1]
      .filter((v) => options.includes(String(v)) && v !== rest)
      .map((v) => ({ value: String(v), misconception: 'off-by-one' })),
  ];
  const splitLine =
    obj === 'kasuu'
      ? `${small}を ${need}と {{}}に わける。`
      : `${small}を {{}}と ${need}に わける。`;
  return {
    engine: 'fill',
    id: `${obj}:${key(a, b)}`,
    objective: obj,
    level,
    prompt: `${a} ＋ ${b} を 10の まとまりを つくって けいさん しよう。`,
    text: `${splitLine}\n${big} ＋ ${need} ＝ 10\n10 ＋ {{}} ＝ {{}}`,
    options,
    blanks: [
      { answers: [String(rest)], wrong: restWrong },
      { answers: [String(rest)], wrong: restWrong },
      { answers: [String(s)], wrong: sumWrong },
    ],
    hints: [
      obj === 'kasuu'
        ? `まえの ${big}を 10に しよう。あと いくつで 10かな。`
        : `うしろの ${big}を 10に しよう。あと いくつで 10かな。`,
      `${big}は あと ${need}で 10。${small}から ${need}を もらうよ。`,
      `${small}から ${need}を とると のこりは…。10と その かずを あわせよう。`,
    ],
    explain: `${stepsText(a, b)} ${a} ＋ ${b} ＝ ${s} です。`,
    explainFigure: { kind: 'blocks', tens: 1, ones: s - 10 },
    identity: key(a, b),
  };
}

function tapeFig(a: number, b: number): Figure {
  return {
    kind: 'tape',
    parts: [
      { length: a, label: String(a), tone: 'a' },
      { length: b, label: String(b), tone: 'b' },
    ],
    total: '？',
  };
}

function erabuItem(level: number, a: number, b: number, alt: boolean, rng: Rng): ChoiceItem {
  const s = a + b;
  const big = Math.max(a, b);
  const small = Math.min(a, b);
  if (!alt) {
    const sc = pick(rng, SCENES);
    return {
      engine: 'choice',
      id: `erabu:${sc.id}:${key(a, b)}`,
      objective: 'erabu',
      level,
      prompt: `${sc.text(a, b)}\nこの おはなしに あう しきは どれ？`,
      hints: [
        sc.type === 'gappei'
          ? '「あわせて」「ぜんぶで」は 2つを いっしょに する ことだね。'
          : 'あとから ふえると かずは おおきく なるね。',
        'ふえる・あわせる ときは ＋ の しるしだよ。',
        `おはなしに でて くる かずは ${a}と ${b}だね。`,
      ],
      explain: `あわせる（ふえる）ので たしざん。しきは ${a} ＋ ${b} ＝ ${s} です。`,
      identity: key(a, b),
      options: [
        { label: `${a} ＋ ${b}`, correct: true },
        { label: `${big} − ${small}`, misconception: 'sub-instead' },
        { label: `${a} ＋ ${b === 9 ? b - 1 : b + 1}`, misconception: 'misread' },
      ],
    };
  }
  // 別例: しきから おはなしを えらぶ
  const sc = pick(rng, SCENES);
  const wrongB = b === 9 ? b - 1 : b + 1;
  return {
    engine: 'choice',
    id: `erabu-alt:${sc.id}:${key(a, b)}`,
    objective: 'erabu',
    level,
    prompt: `${a} ＋ ${b} の しきに あう おはなしは どれ？`,
    figure: tapeFig(a, b),
    layout: 'column',
    hints: [
      '＋ は 「あわせる」「ふえる」 おはなしだよ。',
      `${a}と ${b}が でて くる おはなしを さがそう。`,
      '「のこりは」は へる おはなしだね。',
    ],
    explain: `${a} ＋ ${b} は ${a}と ${b}を あわせる（${a}に ${b} ふえる）おはなし。`,
    identity: key(a, b),
    alt: true,
    options: [
      { label: sc.text(a, b), correct: true },
      {
        label: `${s}こ ありました。${b}こ たべました。のこりは なんこ ですか。`,
        misconception: 'sub-instead',
      },
      { label: sc.text(a, wrongB), misconception: 'misread' },
    ],
  };
}

export function generateAddCarry(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  let obj = lv.objs[(index + rng.int(0, lv.objs.length - 1)) % lv.objs.length]!;
  const alt = rng.next() < 0.25;
  // 段階0: 和10の9通りと 加数分解の20通りを合わせた定義域から均等に選ぶ（キーの偏りを防ぐ）
  let pre: [number, number] | null = null;
  if (obj === 'matomari' || (obj === 'kasuu' && lv.objs.includes('matomari'))) {
    const k = rng.int(0, 9 + BIG.length - 1);
    if (k < 9) obj = 'matomari';
    else {
      obj = 'kasuu';
      pre = BIG[k - 9]!;
    }
    if (obj === 'matomari') pre = [k + 1, 9 - k];
  }
  switch (obj) {
    case 'matomari': {
      const a = pre![0];
      const b = 10 - a;
      if (!alt)
        return numberItem(
          'matomari',
          level,
          a,
          b,
          `${a} ＋ ${b} は いくつ？ 10の わくに いれて かんがえよう。`,
          pairFig(a, b),
          false,
          '10の わくの あいて いる ところを みよう。',
        );
      const options = [...new Set([b, a, b + 1, b - 1])]
        .filter((v) => v >= 0)
        .sort((x, y) => x - y)
        .map(String);
      const mw: { value: string; misconception: string }[] = [];
      for (const [v, m] of [
        [a, 'misread'],
        [b + 1, 'off-by-one'],
        [b - 1, 'off-by-one'],
      ] as const)
        if (v !== b && v >= 0 && !mw.some((w) => w.value === String(v)))
          mw.push({ value: String(v), misconception: m });
      return {
        engine: 'fill',
        id: `matomari-alt:${key(a, b)}`,
        objective: 'matomari',
        level,
        prompt: '10の まとまりを つくろう。{{}}に はいる かずは？',
        figure: { kind: 'blocks', ones: a, frame: true },
        text: `${a} ＋ {{}} ＝ 10`,
        options,
        blanks: [
          {
            answers: [String(b)],
            wrong: mw,
          },
        ],
        hints: [
          '10の わくの あいて いる ところを かぞえよう。',
          `わくは 10こ。${a}こ うまって いるね。`,
          `${a}の つぎから 10まで かぞえよう。${a + 1}、…`,
        ],
        explain: `${a}と ${b}で 10。${a} ＋ ${b} ＝ 10 です。`,
        explainFigure: { kind: 'blocks', ones: 10, frame: true },
        identity: key(a, b),
        alt: true,
      };
    }
    case 'kasuu':
    case 'hisuu': {
      const [a, b] = pre ?? pick(rng, obj === 'kasuu' ? BIG : SMALL);
      if (!alt) return splitFill(obj, level, a, b);
      return numberItem(
        obj,
        level,
        a,
        b,
        obj === 'kasuu'
          ? `${a}に ${b}の いくつかを うつして 10を つくろう。${a} ＋ ${b} は？`
          : `${b}に ${a}の いくつかを うつして 10を つくろう。${a} ＋ ${b} は？`,
        obj === 'kasuu'
          ? pairFig(a, b)
          : {
              kind: 'row',
              items: [
                { kind: 'blocks', ones: a, tone: 'b' },
                { kind: 'text', text: '＋', size: 'l' },
                { kind: 'blocks', ones: b, frame: true },
              ],
            },
        true,
        obj === 'kasuu'
          ? `${a}の わくを 10で いっぱいに しよう。`
          : `${b}の わくを 10で いっぱいに しよう。`,
      );
    }
    case 'shiki': {
      const [a, b] = pick(rng, ALL);
      return alt
        ? numberItem(
            'shiki',
            level,
            a,
            b,
            `すうちょくせんで かんがえよう。${a} ＋ ${b} は いくつ？`,
            {
              kind: 'numberline',
              min: 0,
              max: 20,
              step: 1,
              labelEvery: 5,
              marks: [{ at: a, tone: 'focus' }],
            },
            true,
            `${a}から みぎへ すすもう。10で ひとやすみ。`,
          )
        : numberItem(
            'shiki',
            level,
            a,
            b,
            'けいさん しよう。',
            { kind: 'text', text: `${a} ＋ ${b} ＝ {{}}`, size: 'xl' },
            false,
            'どちらの かずで 10を つくるか きめよう。',
          );
    }
    case 'zouka':
    case 'gappei': {
      const [a, b] = pick(rng, ALL);
      const scs = SCENES.filter((s) => s.type === obj);
      const sc = pick(rng, scs);
      return {
        ...numberItem(
          obj,
          level,
          a,
          b,
          sc.text(a, b),
          alt ? tapeFig(a, b) : undefined,
          alt,
          obj === 'gappei'
            ? '「あわせて」「ぜんぶで」は たしざんだよ。'
            : 'ふえると かずは おおきく なるね。たしざんだよ。',
        ),
        id: `${obj}${alt ? '-alt' : ''}:${sc.id}:${key(a, b)}`,
        fields: [{ answer: { kind: 'int', value: a + b }, label: sc.unit }],
        explain: `しきは ${a} ＋ ${b} ＝ ${a + b}。${stepsText(a, b)} こたえは ${a + b}${sc.unit} です。`,
      };
    }
    case 'erabu': {
      const [a, b] = pick(rng, ALL);
      return erabuItem(level, a, b, alt, rng);
    }
  }
}

export const addCarry: UnitSpec = {
  id: 'g1.math.add-carry',
  title: 'くりあがりの ある たしざん',
  stage: 'g1',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'math-formula-add',
  prereq: ['g1.math.numbers-20', 'g1.math.compose-10'],
  objectives: [
    { id: 'matomari', title: '10の まとまりを つくる' },
    { id: 'kasuu', title: 'うしろの かずを わけて 10を つくる' },
    { id: 'hisuu', title: 'まえの かずを わけて 10を つくる' },
    { id: 'shiki', title: 'しきだけで けいさん' },
    { id: 'zouka', title: 'ふえる ぶんしょうだい' },
    { id: 'gappei', title: 'あわせる ぶんしょうだい' },
    { id: 'erabu', title: 'しきと おはなしを むすぶ' },
  ],
  misconceptions: [
    {
      id: 'no-carry',
      explain:
        '10の まとまりを わすれたのかな。10と のこりを あわせると、10より おおきい かずに なるよ。',
    },
    {
      id: 'off-by-one',
      explain:
        'かぞえる ときに 1つ ずれたのかも。10の まとまりを つくると かぞえまちがいが へるよ。',
    },
    {
      id: 'sub-instead',
      explain: 'ひきざんを したのかな。「あわせて」「ふえる」は たしざんだよ。',
    },
    { id: 'concat', explain: 'すうじを ならべて かいたのかな。2つを あわせた かずを かこう。' },
    {
      id: 'split-miss',
      explain:
        '10に する ための かずを そのまま かいたのかな。わけた のこりの かずを かんがえよう。',
    },
    {
      id: 'misread',
      explain: 'かずを よみまちがえたのかな。おはなしや しきの かずを もう いちど みよう。',
    },
  ],
  levels: [
    { label: '10の まとまり・うしろを わける', chance: 0.05 },
    { label: 'まえを わける・しき', chance: 0.05 },
    { label: 'しき・ぶんしょうだい', chance: 0.05 },
  ],
  intro: [
    { text: '8 ＋ 5 を かんがえよう。', figure: pairFig(8, 5) },
    {
      text: '8は あと 2で 10。5を 2と 3に わけて、2を 8の わくに うつすよ。',
      figure: {
        kind: 'row',
        items: [
          { kind: 'blocks', ones: 10, frame: true },
          { kind: 'blocks', ones: 3, tone: 'b' },
        ],
        gap: 4,
      },
    },
    {
      text: '10と 3で 13。8 ＋ 5 ＝ 13。',
      figure: { kind: 'text', text: '8 ＋ 5 ＝ 13', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateAddCarry(level, rng, index),
    domainSize: 45,
  },
  review: 'type',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第1学年 A(2) 加法・減法（1位数の加法。解説: 和が10を超える加法）',
  revised: REVISED,
};
