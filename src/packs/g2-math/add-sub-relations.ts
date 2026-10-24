/**
 * g2.math.add-sub-relations たし算とひき算の関係、計算のきまり、テープ図（curriculum-matrix 3.5）。
 * テープ図 → 逆の式で確かめる →（ ）でまとめる。
 *
 * エンジン: matrix は fill・build・choice。本単元は number（□の数）と choice（式を選ぶ）で作る
 * （□に入る数を入れる形が数字キーで足りるため）。
 *
 * 同一性キー: 問う形 × 数（例 'tape:x-15=20'、'kakko:28+15+5'）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { opts, pickObj, wrongList } from './util';

type Obj = 'tape' | 'tashikame' | 'koukan' | 'kakko';

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['tape', 'tashikame'] },
  { objs: ['tape', 'tashikame', 'koukan', 'kakko'] },
];

/** □を求める式（3つの形） */
type Form = 'x+a=b' | 'x-a=b' | 'a-x=b';

function tapeFig(form: Form, a: number, b: number): Figure {
  // ぜんたいと ぶぶん
  if (form === 'x+a=b')
    return {
      kind: 'tape',
      parts: [
        { length: b - a, label: '□', tone: 'b' },
        { length: a, label: String(a), tone: 'a' },
      ],
      total: String(b),
    };
  if (form === 'x-a=b')
    return {
      kind: 'tape',
      parts: [
        { length: a, label: String(a), tone: 'a' },
        { length: b, label: String(b), tone: 'a' },
      ],
      total: '□',
    };
  return {
    kind: 'tape',
    parts: [
      { length: a - b, label: '□', tone: 'b' },
      { length: b, label: String(b), tone: 'a' },
    ],
    total: String(a),
  };
}

/** □を求める（テープ図。alt は文章題） */
function tape(level: number, rng: Rng, alt: boolean): NumberItem {
  const form = (['x+a=b', 'x-a=b', 'a-x=b'] as const)[rng.int(0, 2)]!;
  let a: number;
  let b: number;
  let x: number;
  let text: string;
  let story: string;
  let wrongOp: number;
  if (form === 'x+a=b') {
    a = rng.int(5, 40);
    x = rng.int(5, 50);
    b = x + a;
    text = `□ ＋ ${a} ＝ ${b}`;
    story = `シールを なんまいか もって いました。${a}まい もらったので ${b}まいに なりました。はじめに なんまい もって いましたか。`;
    wrongOp = b + a;
  } else if (form === 'x-a=b') {
    a = rng.int(5, 40);
    b = rng.int(5, 50);
    x = a + b;
    text = `□ − ${a} ＝ ${b}`;
    story = `あめが なんこか ありました。${a}こ たべたので、のこりが ${b}こに なりました。はじめに なんこ ありましたか。`;
    wrongOp = Math.abs(b - a);
  } else {
    a = rng.int(20, 90);
    x = rng.int(5, a - 5);
    b = a - x;
    text = `${a} − □ ＝ ${b}`;
    story = `いろがみが ${a}まい ありました。なんまいか つかったので、のこりが ${b}まいに なりました。なんまい つかいましたか。`;
    wrongOp = a + b;
  }
  const eq = form === 'x-a=b' ? `${b} ＋ ${a}` : form === 'x+a=b' ? `${b} − ${a}` : `${a} − ${b}`;
  return {
    engine: 'number',
    id: `tape${alt ? '-alt' : ''}:${text}`,
    objective: 'tape',
    level,
    prompt: alt ? story : `□に あう かずは？ テープの ずで かんがえよう。`,
    figure: alt
      ? tapeFig(form, a, b)
      : { kind: 'column', items: [{ kind: 'text', text, size: 'xl' }, tapeFig(form, a, b)] },
    hints: [
      'テープの ずで、ぜんたいと ぶぶんを みつけよう。',
      form === 'x-a=b'
        ? 'わからないのは ぜんたい。ぜんたいは ぶぶんを あわせた ものだね。'
        : 'わからないのは ぶぶん。ぶぶんは ぜんたいから もう ひとつの ぶぶんを ひくよ。',
      `${eq} を けいさん しよう。`,
    ],
    explain: `□は ${eq} ＝ ${x} で もとめられます。${text.replace('□', String(x))} に なるね。`,
    explainFigure: tapeFig(form, a, b),
    identity: `tape:${form}:${a}:${b}`,
    alt,
    fields: [{ label: alt ? undefined : '□', answer: { kind: 'int', value: x } }],
    wrongAnswers: wrongList(String(x), 1, [[wrongOp, 'wrong-op']]),
  };
}

/** ひき算の答えを たし算で たしかめる */
function tashikame(level: number, rng: Rng, alt: boolean): Item {
  const a = rng.int(30, 99);
  const b = rng.int(10, a - 10);
  const d = a - b;
  if (alt) {
    // 答えの たしかめを 計算させる
    return {
      engine: 'number',
      id: `tashikame-alt:${a}-${b}`,
      objective: 'tashikame',
      level,
      prompt: `${a} − ${b} ＝ ${d}。こたえを たしざんで たしかめよう。${d} ＋ ${b} は いくつ？`,
      figure: { kind: 'text', text: `${d} ＋ ${b} ＝ {{}}`, size: 'xl' },
      hints: [
        'ひきざんの こたえと ひいた かずを たすと、ひかれる かずに もどるよ。',
        `${d} ＋ ${b} を けいさん しよう。`,
        `いちの くらいは ${d % 10} ＋ ${b % 10}。`,
      ],
      explain: `${d} ＋ ${b} ＝ ${a}。ひかれる かず ${a}に もどったので、こたえは あって います。`,
      identity: `tashikame:${a}-${b}`,
      alt: true,
      fields: [{ answer: { kind: 'int', value: a } }],
      wrongAnswers: wrongList(String(a), 1, [
        [(d % 10) + (b % 10) >= 10 ? a - 10 : null, 'no-carry'],
        [d - b > 0 ? d - b : null, 'wrong-check'],
      ]),
    } satisfies NumberItem;
  }
  const add = rng.next() < 0.5;
  if (add) {
    // たし算の答えを ひき算で たしかめる
    const s = a;
    const x = b;
    const y = d;
    return {
      engine: 'choice',
      id: `tashikame-add:${x}+${y}`,
      objective: 'tashikame',
      level,
      prompt: `${x} ＋ ${y} ＝ ${s}。この こたえを たしかめる しきは どれ？`,
      hints: [
        'たしざんの こたえから、たした かずを ひくと、もとに もどるよ。',
        `${s}から ${y}を ひくと…`,
        `たしかめの しきの こたえが ${x}に なれば あって いるね。`,
      ],
      explain: `${s} − ${y} ＝ ${x}。もとの かず ${x}に もどるので、たしかめの しきは ${s} − ${y} です。`,
      identity: `tashikame-add:${Math.min(x, y)}+${Math.max(x, y)}`,
      alt: false,
      options: opts(`${s} − ${y}`, [
        [`${s} ＋ ${y}`, 'wrong-check'],
        [`${Math.max(x, y)} − ${Math.min(x, y)}`, 'wrong-check'],
        [`${s} ＋ ${x}`, 'wrong-check'],
      ]),
    } satisfies ChoiceItem;
  }
  return {
    engine: 'choice',
    id: `tashikame-sub:${a}-${b}`,
    objective: 'tashikame',
    level,
    prompt: `${a} − ${b} ＝ ${d}。この こたえを たしかめる しきは どれ？`,
    hints: [
      'ひきざんの こたえに、ひいた かずを たすと、もとに もどるよ。',
      `こたえの ${d}に ${b}を たすと…`,
      `たしかめの しきの こたえが ひかれる かずの ${a}に なれば あって いるね。`,
    ],
    explain: `${d} ＋ ${b} ＝ ${a}。ひかれる かず ${a}に もどるので、たしかめの しきは ${d} ＋ ${b} です。`,
    identity: `tashikame:${a}-${b}`,
    alt: false,
    options: opts(`${d} ＋ ${b}`, [
      [`${a} ＋ ${b}`, 'wrong-check'],
      [`${d} − ${b}`, 'wrong-check'],
      [`${a} ＋ ${d}`, 'wrong-check'],
    ]),
  } satisfies ChoiceItem;
}

/** たし算の交換のきまり（たされる数と たす数を入れかえても答えは同じ） */
function koukan(level: number, rng: Rng, alt: boolean): Item {
  const a = rng.int(10, 89);
  const b = rng.int(2, 9);
  if (alt) {
    return {
      engine: 'choice',
      id: `koukan-alt:${a}+${b}`,
      objective: 'koukan',
      level,
      prompt: `${a} ＋ ${b} と こたえが おなじに なる しきは どれ？`,
      hints: [
        'たしざんは、たされる かずと たす かずを いれかえても こたえは おなじ。',
        'ひきざんは いれかえると こたえが かわるよ。',
        'おなじ 2つの かずを つかった たしざんを さがそう。',
      ],
      explain: `${b} ＋ ${a} ＝ ${a + b}。たしざんは いれかえても こたえが おなじです。`,
      identity: `koukan-choose:${a}+${b}`,
      alt: true,
      options: opts(`${b} ＋ ${a}`, [
        [`${a} − ${b}`, 'swap-sub'],
        [`${b} ＋ ${a + 1}`, 'koukan-change'],
        [`${a} ＋ ${b + 10}`, 'koukan-change'],
      ]),
    } satisfies ChoiceItem;
  }
  return {
    engine: 'number',
    id: `koukan:${a}+${b}`,
    objective: 'koukan',
    level,
    prompt: '□に あう かずは？',
    figure: { kind: 'text', text: `${b} ＋ ${a} ＝ ${a} ＋ □`, size: 'xl' },
    hints: [
      'たしざんは、たされる かずと たす かずを いれかえても こたえは おなじ だよ。',
      `ひだりの しきは ${b}と ${a}。みぎの しきにも おなじ かずが つかわれるね。`,
      `みぎの しきに ${a}は ある。のこりの かずは？`,
    ],
    explain: `${b} ＋ ${a} ＝ ${a} ＋ ${b}。いれかえても こたえは ${a + b}で おなじです。`,
    identity: `koukan:${a}+${b}`,
    alt: false,
    fields: [{ label: '□', answer: { kind: 'int', value: b } }],
    wrongAnswers: wrongList(String(b), 1, [
      [a + b, 'answer-in-box'],
      [a, 'copy-number'],
    ]),
  } satisfies NumberItem;
}

/** （ ）を使って まとめて たす（たし算の結合のきまり） */
function kakko(level: number, rng: Rng, alt: boolean): Item {
  // b + c が 10・20・30 になる組
  const a = rng.int(11, 69);
  const target = rng.int(1, 3) * 10;
  // a ＋ b も ちょうど 何十に なると、どちらを さきに たしても らく（正答が2つ）になるので除く
  let b: number;
  do b = rng.int(1, target - 1);
  while ((a + b) % 10 === 0);
  const c = target - b;
  const s = a + b + c;
  if (alt) {
    return {
      engine: 'choice',
      id: `kakko-alt:${a}+${b}+${c}`,
      objective: 'kakko',
      level,
      prompt: `${a} ＋ ${b} ＋ ${c} を くふうして けいさん します。どこを さきに たすと らく？`,
      hints: [
        '（ ）の なかは さきに けいさん するよ。',
        'たすと ちょうど 10や 20に なる ところを さがそう。',
        `${b} ＋ ${c} は いくつに なるかな。`,
      ],
      explain: `${b} ＋ ${c} ＝ ${target}。${a} ＋ （${b} ＋ ${c}） ＝ ${a} ＋ ${target} ＝ ${s} と らくに けいさん できます。`,
      identity: `kakko-choose:${a}+${b}+${c}`,
      alt: true,
      fixedOrder: true,
      options: [
        { label: `（${a} ＋ ${b}） ＋ ${c}`, misconception: 'kakko-order' },
        { label: `${a} ＋ （${b} ＋ ${c}）`, correct: true },
      ],
    } satisfies ChoiceItem;
  }
  return {
    engine: 'number',
    id: `kakko:${a}+${b}+${c}`,
    objective: 'kakko',
    level,
    prompt: '（ ）の なかを さきに けいさん しよう。',
    figure: { kind: 'text', text: `${a} ＋ （${b} ＋ ${c}） ＝ {{}}`, size: 'xl' },
    hints: [
      '（ ）の なかを さきに けいさん するよ。',
      `${b} ＋ ${c} ＝ ${target}。`,
      `${a} ＋ ${target} を けいさん しよう。`,
    ],
    explain: `${b} ＋ ${c} ＝ ${target}。${a} ＋ ${target} ＝ ${s} です。`,
    identity: `kakko:${a}+${b}+${c}`,
    alt: false,
    fields: [{ answer: { kind: 'int', value: s } }],
    wrongAnswers: wrongList(String(s), 1, [
      [a + b, 'kakko-skip'],
      [a + c, 'kakko-skip'],
      [target, 'kakko-skip'],
    ]),
  } satisfies NumberItem;
}

export function generateRelations(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'tape':
      return tape(level, rng, alt);
    case 'tashikame':
      return tashikame(level, rng, alt);
    case 'koukan':
      return koukan(level, rng, alt);
    case 'kakko':
      return kakko(level, rng, alt);
  }
}

export const addSubRelations: UnitSpec = {
  id: 'g2.math.add-sub-relations',
  title: 'たしざんと ひきざんの かんけい',
  stage: 'g2',
  subject: 'math',
  domain: 'A-number',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'math-split',
  prereq: ['g2.math.add-sub-3digit'],
  objectives: [
    { id: 'tape', title: 'テープの ずで □を もとめる' },
    { id: 'tashikame', title: 'ぎゃくの しきで たしかめる' },
    { id: 'koukan', title: 'いれかえても おなじ（たしざん）' },
    { id: 'kakko', title: '（ ）で まとめて たす' },
  ],
  misconceptions: [
    {
      id: 'wrong-op',
      explain:
        'もんだいの しるしの まま けいさん したのかな。テープの ずで、わからないのが ぜんたいか ぶぶんかを みよう。ぜんたいは たして、ぶぶんは ひいて もとめるよ。',
      figure: tapeFig('x-a=b', 15, 20),
    },
    {
      id: 'wrong-check',
      explain:
        'たしかめの しきが ぎゃくに なって いないのかな。ひきざんは たしざんで、たしざんは ひきざんで たしかめるよ。',
    },
    {
      id: 'swap-sub',
      explain:
        'いれかえて よいのは たしざん だけ だよ。ひきざんを いれかえると こたえが かわるね。',
    },
    {
      id: 'copy-number',
      explain:
        '□の となりの かずを そのまま かいたのかな。ひだりの しきの 2つの かずの うち、みぎの しきに まだ ない ほうが □に はいるよ。',
    },
    {
      id: 'koukan-change',
      explain:
        'かずが かわって いるのに きづいたかな。いれかえる だけなら こたえは おなじ。かずを かえると こたえも かわるよ。',
    },
    {
      id: 'answer-in-box',
      explain: '□に こたえを かいたのかな。□には しきの なかの かずが はいるよ。',
    },
    {
      id: 'kakko-order',
      explain: 'たして ちょうど 10や 20に なる ところを まとめると らくだよ。',
    },
    {
      id: 'kakko-skip',
      explain: 'さいごまで たしたかな。（ ）の なかを けいさん したら、のこりの かずも たそう。',
    },
    {
      id: 'no-carry',
      explain:
        'くりあがりを わすれたのかな。いちの くらいで 10が できたら じゅうの くらいに 1 たすよ。',
    },
  ],
  levels: [
    { label: 'テープの ず・たしかめ', chance: 0.05 },
    { label: 'けいさんの きまり', chance: 0.05 },
  ],
  intro: [
    {
      text: '□ − 15 ＝ 20 を テープの ずに すると、ぜんたいが □、ぶぶんが 15と 20 です。',
      figure: tapeFig('x-a=b', 15, 20),
    },
    {
      text: 'ぜんたいは ぶぶんを たして もとめます。□ ＝ 20 ＋ 15 ＝ 35。',
      figure: { kind: 'text', text: '35 − 15 ＝ 20', size: 'xl' },
    },
    {
      text: 'ひきざんの こたえは、たしざんで たしかめられます。（ ）が ある ときは、なかを さきに けいさん します。',
      figure: { kind: 'text', text: '28 ＋ （15 ＋ 5） ＝ 28 ＋ 20', size: 'l' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateRelations(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第2学年 A(2) 加法・減法（加法・減法の相互関係、加法の交換法則・結合法則、（ ）を用いた式）',
  revised: '2026-10-24',
};
