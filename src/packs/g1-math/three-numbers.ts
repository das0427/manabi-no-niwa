/**
 * g1.math.three-numbers 3つの かずの けいさん（P2。curriculum-matrix 3.4）。
 * まえから じゅんに けいさん する。途中の かず・こたえは 0〜20。
 *
 * 同一性キー: 式そのもの（3つの数の順で途中の式が変わるので、並べ替えた式は別）。
 * 定義域（すべて 1〜9 の数を使い、はじめの数だけ ひく式で 18まで）:
 *   a＋b＋c（a+b+c≤20）／ a−b−c（a 3〜18、a−b≥1、a−b−c≥0）／
 *   a＋b−c（c≤a+b）／ a−b＋c（a 1〜18、b≤a、a−b+c≤20）
 */
import type { Rng } from '../../core/util/rng';
import type { Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { expr, pickFrom, REVISED } from './util';

type Form = 'add3' | 'sub3' | 'addsub' | 'subadd';
type Obj = 'add3' | 'sub3' | 'mixed';

interface Expr {
  form: Form;
  a: number;
  b: number;
  c: number;
}

const OPS: Record<Form, ['+' | '-', '+' | '-']> = {
  add3: ['+', '+'],
  sub3: ['-', '-'],
  addsub: ['+', '-'],
  subadd: ['-', '+'],
};
const calc = (x: number, op: '+' | '-', y: number) => (op === '+' ? x + y : x - y);
const mid = (e: Expr) => calc(e.a, OPS[e.form][0], e.b);
const ans = (e: Expr) => calc(mid(e), OPS[e.form][1], e.c);
const sym = (op: '+' | '-') => (op === '+' ? '＋' : '−');
const text = (e: Expr) => `${e.a} ${sym(OPS[e.form][0])} ${e.b} ${sym(OPS[e.form][1])} ${e.c}`;
const key = (e: Expr) => `${e.a}${OPS[e.form][0]}${e.b}${OPS[e.form][1]}${e.c}`;

const DOMAIN: Record<Form, Expr[]> = { add3: [], sub3: [], addsub: [], subadd: [] };
for (let a = 1; a <= 18; a++)
  for (let b = 1; b <= 9; b++)
    for (let c = 1; c <= 9; c++) {
      if (a <= 9 && a + b + c <= 20) DOMAIN.add3.push({ form: 'add3', a, b, c });
      if (a >= 3 && a - b >= 1 && a - b - c >= 0) DOMAIN.sub3.push({ form: 'sub3', a, b, c });
      if (a <= 9 && c <= a + b) DOMAIN.addsub.push({ form: 'addsub', a, b, c });
      if (b <= a && a - b + c <= 20) DOMAIN.subadd.push({ form: 'subadd', a, b, c });
    }
const MIXED = [...DOMAIN.addsub, ...DOMAIN.subadd];
const LV1 = [...DOMAIN.sub3, ...MIXED];
const ALL = [...DOMAIN.add3, ...LV1];

const objOf = (f: Form): Obj => (f === 'add3' ? 'add3' : f === 'sub3' ? 'sub3' : 'mixed');

interface Scene {
  id: string;
  form: Form;
  unit: string;
  text: (a: number, b: number, c: number) => string;
}

/** 文章題の場面（ふえる・へるの組み合わせ。数値だけ違うものは同じ場面） */
const SCENES: Scene[] = [
  {
    id: 'bus-on',
    form: 'add3',
    unit: 'にん',
    text: (a, b, c) =>
      `バスに ${a}にん のって います。${b}にん のって きました。また ${c}にん のって きました。みんなで なんにんに なりましたか。`,
  },
  {
    id: 'kaki',
    form: 'add3',
    unit: 'こ',
    text: (a, b, c) =>
      `かきが ${a}こ あります。おばあさんから ${b}こ、おじいさんから ${c}こ もらいました。ぜんぶで なんこに なりましたか。`,
  },
  {
    id: 'birds',
    form: 'add3',
    unit: 'わ',
    text: (a, b, c) =>
      `とりが ${a}わ います。${b}わ とんで きて、また ${c}わ とんで きました。みんなで なんわに なりましたか。`,
  },
  {
    id: 'bus-off',
    form: 'sub3',
    unit: 'にん',
    text: (a, b, c) =>
      `バスに ${a}にん のって います。${b}にん おりました。つぎに ${c}にん おりました。なんにんに なりましたか。`,
  },
  {
    id: 'cookie',
    form: 'sub3',
    unit: 'まい',
    text: (a, b, c) =>
      `クッキーが ${a}まい あります。わたしが ${b}まい、いもうとが ${c}まい たべました。のこりは なんまい ですか。`,
  },
  {
    id: 'balloon',
    form: 'sub3',
    unit: 'こ',
    text: (a, b, c) =>
      `ふうせんが ${a}こ あります。${b}こ とんで いき、${c}こ われました。のこりは なんこ ですか。`,
  },
  {
    id: 'bus-mix',
    form: 'addsub',
    unit: 'にん',
    text: (a, b, c) =>
      `バスに ${a}にん のって います。${b}にん のって きて、${c}にん おりました。なんにんに なりましたか。`,
  },
  {
    id: 'pond',
    form: 'addsub',
    unit: 'ひき',
    text: (a, b, c) =>
      `いけに かえるが ${a}ひき います。${b}ひき きて、${c}ひき でて いきました。いま なんびき いますか。`,
  },
  {
    id: 'park',
    form: 'subadd',
    unit: 'にん',
    text: (a, b, c) =>
      `こうえんで こどもが ${a}にん あそんで います。${b}にん かえって、${c}にん きました。いま なんにん ですか。`,
  },
  {
    id: 'sticker',
    form: 'subadd',
    unit: 'まい',
    text: (a, b, c) =>
      `シールが ${a}まい あります。${b}まい つかって、${c}まい もらいました。なんまいに なりましたか。`,
  },
];

function wrongs(e: Expr): NonNullable<NumberItem['wrongAnswers']> {
  const r = ans(e);
  const { a, b, c } = e;
  const out: NonNullable<NumberItem['wrongAnswers']> = [];
  const add = (v: number, m: string) => {
    const t = String(v);
    if (v !== r && v >= 0 && !out.some((w) => w.value === t))
      out.push({ value: t, misconception: m });
  };
  add(mid(e), 'stop-early');
  switch (e.form) {
    case 'add3':
      add(a + c, 'drop-number');
      add(b + c, 'drop-number');
      break;
    case 'sub3':
      add(a - b + c, 'sign-mix');
      add(a - c, 'drop-number');
      break;
    case 'addsub':
      add(a + b + c, 'sign-mix');
      add(a - c, 'drop-number');
      break;
    case 'subadd':
      add(a - b - c, 'sign-mix');
      add(a + b + c, 'sign-mix');
      add(a + c, 'drop-number');
      break;
  }
  add(r + 1, 'off-by-one');
  add(r - 1, 'off-by-one');
  return out;
}

function item(level: number, e: Expr, sc: Scene | null): NumberItem {
  const [o1, o2] = OPS[e.form];
  const m = mid(e);
  const r = ans(e);
  const alt = sc !== null;
  return {
    engine: 'number',
    id: `${objOf(e.form)}${alt ? '-alt' : ''}:${sc ? `${sc.id}:` : ''}${key(e)}`,
    objective: objOf(e.form),
    level,
    prompt: sc ? sc.text(e.a, e.b, e.c) : 'まえから じゅんに けいさん しよう。',
    figure: sc ? undefined : expr(`${text(e)} ＝ {{}}`),
    hints: [
      sc
        ? 'ふえる ときは ＋、へる ときは −。おはなしの じゅんに しきに しよう。'
        : 'はじめに、まえの 2つの かずを けいさん しよう。',
      `まず ${e.a} ${sym(o1)} ${e.b} ＝ ${m}。`,
      `つぎに ${m} ${sym(o2)} ${e.c} を けいさん すると…`,
    ],
    explain: `${text(e)} は、まず ${e.a} ${sym(o1)} ${e.b} ＝ ${m}、つぎに ${m} ${sym(o2)} ${e.c} ＝ ${r}。こたえは ${r}${sc ? sc.unit : ''} です。`,
    identity: key(e),
    alt,
    fields: [{ answer: { kind: 'int', value: r }, label: sc?.unit }],
    wrongAnswers: wrongs(e),
  };
}

export function generateThreeNumbers(level: number, rng: Rng): Item {
  const e = pickFrom(rng, level === 0 ? DOMAIN.add3 : level === 1 ? LV1 : ALL);
  const alt = rng.next() < 0.25;
  const sc = alt
    ? pickFrom(
        rng,
        SCENES.filter((s) => s.form === e.form),
      )
    : null;
  return item(level, e, sc);
}

export const threeNumbers: UnitSpec = {
  id: 'g1.math.three-numbers',
  title: '3つの かずの けいさん',
  stage: 'g1',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P2',
  status: 'ready',
  icon: 'math-add',
  prereq: ['g1.math.add-carry'],
  objectives: [
    { id: 'add3', title: '3つの かずの たしざん' },
    { id: 'sub3', title: '3つの かずの ひきざん' },
    { id: 'mixed', title: 'たしざんと ひきざんの まじった しき' },
  ],
  misconceptions: [
    {
      id: 'stop-early',
      explain:
        'はじめの 2つだけ けいさん したのかな。でた かずに、3つめの かずも けいさん しよう。',
    },
    {
      id: 'drop-number',
      explain: 'とちゅうの かずを 1つ わすれたのかな。まえから じゅんに 1つずつ けいさん しよう。',
    },
    {
      id: 'sign-mix',
      explain: '＋と −を まちがえたのかな。しるしを 1つずつ ゆびで おさえながら けいさん しよう。',
    },
    {
      id: 'off-by-one',
      explain: 'かぞえる ときに 1つ ずれたのかも。とちゅうの かずを たしかめよう。',
    },
  ],
  levels: [
    { label: '3つの たしざん', chance: 0.05 },
    { label: 'ひきざん・まじった しき', chance: 0.05 },
    { label: 'まぜて', chance: 0.05 },
  ],
  intro: [
    {
      text: 'バスに 6にん のって います。4にん のって きて、また 3にん のって きました。',
      figure: {
        kind: 'row',
        items: [
          { kind: 'blocks', ones: 6 },
          { kind: 'text', text: '＋', size: 'l' },
          { kind: 'blocks', ones: 4, tone: 'b' },
          { kind: 'text', text: '＋', size: 'l' },
          { kind: 'blocks', ones: 3 },
        ],
      },
    },
    {
      text: 'まえから じゅんに けいさん します。まず 6 ＋ 4 ＝ 10。',
      figure: expr('6 ＋ 4 ＝ 10'),
    },
    { text: 'つぎに 10 ＋ 3 ＝ 13。6 ＋ 4 ＋ 3 ＝ 13。', figure: expr('6 ＋ 4 ＋ 3 ＝ 13') },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng }) => generateThreeNumbers(level, rng),
    domainSize: ALL.length,
  },
  review: 'type',
  basis:
    '調査メモに記載なし。要確認（curriculum-matrix 10章 #3）。小学校学習指導要領（平成29年告示）算数 第1学年 A(2) の加法・減法の発展として扱う',
  revised: REVISED,
};
