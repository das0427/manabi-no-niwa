/**
 * g3.math.box-expression □を用いた式（curriculum-matrix 3.6）。
 * 分からない数を□に → □を求める → 逆算の文章題。
 *
 * 同一性キー: 式の形 × 数（'add:?+7=15'、'mult:6x?=42' など）。文章題・式を選ぶ問題は「場面 × 数」。
 * 定義域: たし算・ひき算は数百通り、かけ算・わり算は九九の範囲（各64〜128通り）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { opts, pickObj, pickOne, wrongList } from './util';

type Obj = 'make' | 'add' | 'sub' | 'mult' | 'bunshou';
type Kind = 'add' | 'sub' | 'mult' | 'div';

interface Scene {
  id: string;
  kind: Kind;
  unit: string;
  /** a: 分かっている数、c: 結果 */
  text: (a: number, c: number) => string;
}
/** 場面（はじめの数が分からない） */
const SCENES: Scene[] = [
  {
    id: 'marbles',
    kind: 'add',
    unit: 'こ',
    text: (a, c) =>
      `おはじきを 何《なん》こか 持《も》って いました。${a}こ もらったので、${c}こに なりました。`,
  },
  {
    id: 'bus',
    kind: 'add',
    unit: '人《にん》',
    text: (a, c) =>
      `バスに 何《なん》人《にん》か 乗《の》って いました。${a}人《にん》 乗《の》って きたので、${c}人《にん》に なりました。`,
  },
  {
    id: 'cookies',
    kind: 'sub',
    unit: 'まい',
    text: (a, c) =>
      `クッキーが 何《なん》まいか ありました。${a}まい 食《た》べたので、のこりは ${c}まいに なりました。`,
  },
  {
    id: 'money',
    kind: 'sub',
    unit: '円《えん》',
    text: (a, c) =>
      `お金《かね》を 何《なん》円《えん》か 持《も》って いました。${a}円《えん》の ノートを 買《か》ったので、のこりは ${c}円《えん》に なりました。`,
  },
  {
    id: 'bags',
    kind: 'mult',
    unit: 'こ',
    text: (a, c) =>
      `1ふくろに 同《おな》じ 数《かず》ずつ みかんが 入《はい》って います。${a}ふくろで ${c}こ ありました。`,
  },
  {
    id: 'rows',
    kind: 'mult',
    unit: 'きゃく',
    text: (a, c) =>
      `いすを 1れつに 同《おな》じ 数《かず》ずつ、${a}れつ ならべたら ${c}きゃく に なりました。`,
  },
  {
    id: 'share',
    kind: 'div',
    unit: 'まい',
    text: (a, c) =>
      `シールを 何《なん》まいか ${a}人《にん》で 同《おな》じ 数《かず》ずつ 分《わ》けたら、1人分《ひとりぶん》は ${c}まいに なりました。`,
  },
  {
    id: 'cut',
    kind: 'div',
    unit: 'cm',
    text: (a, c) =>
      `何《なん》cmかの テープを ${a}本《ほん》に 等分《とうぶん》したら、1本《ぽん》は ${c}cmに なりました。`,
  },
];

const SIGN: Record<Kind, string> = { add: '＋', sub: '−', mult: '×', div: '÷' };

/** はじめの数 x と 分かっている数 a・結果 c */
function pickNums(rng: Rng, kind: Kind): { x: number; a: number; c: number } {
  if (kind === 'add') {
    const x = rng.int(3, 60);
    const a = rng.int(2, 39);
    return { x, a, c: x + a };
  }
  if (kind === 'sub') {
    const a = rng.int(2, 39);
    const c = rng.int(2, 60);
    return { x: a + c, a, c };
  }
  const a = rng.int(2, 9);
  const q = rng.int(2, 9);
  return kind === 'mult' ? { x: q, a, c: a * q } : { x: a * q, a, c: q };
}

/** 場面の式（□を使う）: add □＋a＝c、sub □−a＝c、mult □×a＝c、div □÷a＝c */
const expr = (k: Kind, a: number, c: number) => `□ ${SIGN[k]} ${a} ＝ ${c}`;
const inverse = (k: Kind, a: number, c: number) =>
  k === 'add'
    ? `${c} − ${a}`
    : k === 'sub'
      ? `${c} ＋ ${a}`
      : k === 'mult'
        ? `${c} ÷ ${a}`
        : `${c} × ${a}`;

function wrongsFor(k: Kind, a: number, c: number): [number | null, string][] {
  switch (k) {
    case 'add':
      return [[c + a, 'add-all']];
    case 'sub':
      return [[c - a > 0 ? c - a : null, 'wrong-inverse']];
    case 'mult':
      return [
        [c * a, 'mult-inverse'],
        [c - a, 'wrong-inverse'],
      ];
    case 'div':
      return [
        [c % a === 0 ? c / a : null, 'mult-inverse'],
        [c + a, 'wrong-inverse'],
      ];
  }
}

const tapeFig = (k: Kind, a: number, c: number): Figure | undefined =>
  k === 'add'
    ? {
        kind: 'tape',
        parts: [
          { length: Math.max(c - a, 1), label: '□', tone: 'a' },
          { length: a, label: String(a), tone: 'b' },
        ],
        total: String(c),
      }
    : k === 'sub'
      ? {
          kind: 'tape',
          parts: [
            { length: a, label: String(a), tone: 'b' },
            { length: c, label: String(c), tone: 'a' },
          ],
          total: '□',
        }
      : undefined;

function make(level: number, rng: Rng, alt: boolean): ChoiceItem {
  const sc = pickOne(rng, SCENES);
  const { a, c } = pickNums(rng, sc.kind);
  const other: Record<Kind, Kind> = { add: 'sub', sub: 'add', mult: 'div', div: 'mult' };
  return {
    engine: 'choice',
    id: `make${alt ? '-alt' : ''}:${sc.id}:${a}:${c}`,
    objective: 'make',
    level,
    prompt: `${sc.text(a, c)}\n分《わ》からない 数《かず》を □として、お話《はなし》の とおりに 式《しき》に 書《か》くと どれ？`,
    figure: alt
      ? (tapeFig(sc.kind, a, c) ?? {
          kind: 'text',
          text: `□ → ${SIGN[sc.kind]} ${a} → ${c}`,
          size: 'l',
        })
      : undefined,
    hints: [
      'お話《はなし》の じゅんに、はじめ → どう なった → おわり と 考《かんが》えよう。',
      `分《わ》からない 数《かず》が □。そこから「${sc.kind === 'add' ? 'ふえた' : sc.kind === 'sub' ? 'へった' : sc.kind === 'mult' ? 'いくつ分《ぶん》' : '分《わ》けた'}」ね。`,
      `□は はじめの 数《かず》なので 式《しき》の いちばん 左《ひだり》。${a}と ${c}は どこに 来《く》るかな。`,
    ],
    explain: `はじめの □に ${a}を「${SIGN[sc.kind]}」して ${c}に なったので、${expr(sc.kind, a, c)}。□は ${inverse(sc.kind, a, c)} で もとめられます。`,
    identity: `make:${sc.id}:${a}:${c}`,
    alt,
    options: opts(expr(sc.kind, a, c), [
      [expr(other[sc.kind], a, c), 'op-swap'],
      [`${c} ${SIGN[sc.kind]} ${a} ＝ □`, 'order-expr'],
      [`${a} ${SIGN[other[sc.kind]]} ${c} ＝ □`, 'order-expr'],
    ]),
  };
}

function solve(obj: 'add' | 'sub' | 'mult', level: number, rng: Rng, alt: boolean): NumberItem {
  // sub は「□−a＝c」と「□÷a＝c」（もとの数を もとめる 逆算）を あわせて 扱う
  const k: Kind = obj === 'sub' ? (rng.next() < 0.7 ? 'sub' : 'div') : obj;
  const { x, a, c } = pickNums(rng, k);
  // たし算・かけ算は □ の位置を 左右 どちらにも
  const front = k === 'sub' || k === 'div' || rng.next() < 0.5;
  const text = front ? `{{}} ${SIGN[k]} ${a} ＝ ${c}` : `${a} ${SIGN[k]} {{}} ＝ ${c}`;
  const key = `${k}:${front ? `?${SIGN[k]}${a}` : `${a}${SIGN[k]}?`}=${c}`;
  return {
    engine: 'number',
    id: `${obj}${alt ? '-alt' : ''}:${key}`,
    objective: obj,
    level,
    prompt: alt
      ? '図《ず》を 見《み》て、□に あてはまる 数《かず》を もとめよう。'
      : '□に あてはまる 数《かず》は？',
    figure: alt
      ? {
          kind: 'column',
          items: [
            tapeFig(k, a, c) ?? { kind: 'text', text: `${a}こずつ □ → ${c}`, size: 'm' },
            { kind: 'text', text: text.replace('{{}}', '□'), size: 'l' },
          ],
        }
      : { kind: 'text', text, size: 'xl' },
    hints: [
      k === 'add'
        ? '□は、ぜんたいから 分《わ》かって いる ぶんを ひいた 数《かず》。'
        : k === 'sub'
          ? '□は、のこりと へった ぶんを あわせた 数《かず》。'
          : k === 'mult'
            ? '九九《くく》で 考《かんが》えよう。'
            : '□を 同《おな》じ 数《かず》ずつ 分《わ》けたら 1つ分《ぶん》が わかって いるね。',
      `□は ${inverse(k, a, c)} で もとめられるよ。`,
      k === 'mult'
        ? `${a}の だんで、答《こた》えが ${c}に なるのは？`
        : `${inverse(k, a, c)} を 計算《けいさん》しよう。`,
    ],
    explain: `□ ＝ ${inverse(k, a, c)} ＝ ${x}。たしかめ: ${text.replace('{{}}', String(x))}。`,
    identity: key,
    alt,
    fields: [{ answer: { kind: 'int', value: x } }],
    wrongAnswers: wrongList(String(x), 1, wrongsFor(k, a, c)),
  };
}

function word(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pickOne(rng, SCENES);
  const { x, a, c } = pickNums(rng, sc.kind);
  return {
    engine: 'number',
    id: `bunshou${alt ? '-alt' : ''}:${sc.id}:${a}:${c}`,
    objective: 'bunshou',
    level,
    prompt: `${sc.text(a, c)}\n${sc.kind === 'mult' ? '1つ分《ぶん》は いくつですか。' : 'はじめは いくつ でしたか。'}`,
    figure: alt ? { kind: 'text', text: expr(sc.kind, a, c), size: 'l' } : undefined,
    hints: [
      '分《わ》からない 数《かず》を □に して、お話《はなし》の とおりに 式《しき》に しよう。',
      `${expr(sc.kind, a, c)}。`,
      `□は ${inverse(sc.kind, a, c)} で もとめられるよ。`,
    ],
    explain: `${expr(sc.kind, a, c)}。□ ＝ ${inverse(sc.kind, a, c)} ＝ ${x}。答《こた》えは ${x}${sc.unit}です。`,
    identity: `word:${sc.id}:${a}:${c}`,
    alt,
    fields: [{ label: sc.unit, answer: { kind: 'int', value: x } }],
    wrongAnswers: wrongList(String(x), 1, wrongsFor(sc.kind, a, c)),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['make', 'add'] },
  { objs: ['add', 'sub', 'make'] },
  { objs: ['sub', 'mult', 'bunshou'] },
  { objs: ['make', 'add', 'sub', 'mult', 'bunshou'] },
];

export function generateBoxExpression(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.25;
  switch (obj) {
    case 'make':
      return make(level, rng, alt);
    case 'bunshou':
      return word(level, rng, alt);
    default:
      return solve(obj, level, rng, alt);
  }
}

export const boxExpression: UnitSpec = {
  id: 'g3.math.box-expression',
  title: '□を つかった 式《しき》',
  stage: 'g3',
  subject: 'math',
  domain: 'A-number',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'math-formula-add',
  prereq: ['g3.math.division-basic'],
  objectives: [
    { id: 'make', title: 'お話《はなし》を □を つかった 式《しき》に する' },
    { id: 'add', title: '□ ＋ 7 ＝ 15 の □を もとめる' },
    { id: 'sub', title: '□ − 8 ＝ 5、□ ÷ 3 ＝ 4 の □を もとめる' },
    { id: 'mult', title: '□ × 4 ＝ 28 の □を もとめる' },
    { id: 'bunshou', title: 'はじめの 数《かず》を もとめる 文章題《ぶんしょうだい》' },
  ],
  misconceptions: [
    {
      id: 'add-all',
      explain:
        '出《で》て きた 数《かず》を たしたのかな。□ ＋ 7 ＝ 15 なら、□は 15から 7を ひいた 数《かず》だよ。',
      figure: { kind: 'text', text: '□ ＋ 7 ＝ 15 → □ ＝ 15 − 7', size: 'l' },
    },
    {
      id: 'wrong-inverse',
      explain:
        'もとめ方《かた》が 反対《はんたい》かな。□ − 8 ＝ 5 は、□から 8 へって 5。□は 5に 8を たした 数《かず》だよ。テープ図《ず》で たしかめよう。',
    },
    {
      id: 'mult-inverse',
      explain:
        'かけ算《ざん》と わり算《ざん》を とりちがえたのかな。□ × 4 ＝ 28 の □は 28 ÷ 4。□ ÷ 3 ＝ 4 の □は 4 × 3。',
    },
    {
      id: 'op-swap',
      explain:
        'ふえたのか へったのか、お話《はなし》を もう一度《いちど》 読《よ》もう。ふえたら ＋、へったら − を つかうよ。',
    },
    {
      id: 'order-expr',
      explain:
        '□の ところを まちがえたのかな。分《わ》からない はじめの 数《かず》を □に して、お話《はなし》の じゅんに 式《しき》を 書《か》こう。',
    },
  ],
  levels: [
    { label: '□を つかった 式・たし算', chance: 0.05 },
    { label: 'ひき算・わり算', chance: 0.05 },
    { label: 'かけ算・文章題', chance: 0.05 },
    { label: 'まとめ', chance: 0.05 },
  ],
  intro: [
    {
      text: 'あめを 何《なん》こか 持《も》って いて、7こ もらったら 15こに なりました。分《わ》からない はじめの 数《かず》を □に して、□ ＋ 7 ＝ 15 と 書《か》けます。',
      figure: {
        kind: 'tape',
        parts: [
          { length: 8, label: '□', tone: 'a' },
          { length: 7, label: '7', tone: 'b' },
        ],
        total: '15',
      },
    },
    {
      text: '□は、ぜんたいの 15から 7を ひいて もとめます。15 − 7 ＝ 8。',
      figure: { kind: 'text', text: '□ ＝ 15 − 7 ＝ 8', size: 'xl' },
    },
    {
      text: 'たしかめ: 8 ＋ 7 ＝ 15。□に 数《かず》を 入《い》れて、式《しき》が 正《ただ》しく なるか 見《み》ます。',
      figure: { kind: 'text', text: '8 ＋ 7 ＝ 15', size: 'xl' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateBoxExpression(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第3学年 A(7) 数量の関係を表す式（未知の数量を□などを用いて表し、その数量を求める）',
  revised: '2026-10-24',
};
