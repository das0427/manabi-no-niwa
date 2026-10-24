/**
 * g4.math.fraction-same 同じ分母の分数のたし算・ひき算（帯分数を含む）（curriculum-matrix 3.7）。
 *
 * 答えの形は問題ごとに指定する（「帯分数で」→ allowImproper: false、「仮分数で」→ allowMixed: false、
 * 指定なし → どちらでも正）。約分は5年の内容なので求めない（同じ分母のまま答える。mustReduce なし）。
 * 注意: 「1と6/5」のように分数部分が1以上の帯分数は、値が同じなので誤答にできない（エンジンへの要望）。
 * 同一性キー: 式（たし算の交換は同じ）。文章題は 場面 × 式。
 */
import type { NumberAnswer } from '../../core/answer/number';
import type { Rng } from '../../core/util/rng';
import type { Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { expr, finishUnit, pick, pickObj, REVISED, wrongList } from './util';

type Obj = 'addP' | 'addM' | 'subP' | 'subM' | 'story';
type Form = 'mixed' | 'improper' | 'any';

/** 値 v/d（v は 1/d の いくつ分）の表示 */
function show(v: number, d: number, form: 'mixed' | 'improper' = 'mixed'): string {
  if (v % d === 0) return String(v / d);
  if (form === 'mixed' && v > d) return `[[${Math.floor(v / d)} ${v % d}/${d}]]`;
  return `[[${v}/${d}]]`;
}
/** 入力の形の文字列 */
function inp(v: number, d: number, form: 'mixed' | 'improper'): string {
  if (v % d === 0) return String(v / d);
  if (form === 'mixed' && v > d) return `${Math.floor(v / d)}と${v % d}/${d}`;
  return `${v}/${d}`;
}

function answerOf(v: number, d: number, form: Form): NumberAnswer {
  return {
    kind: 'fraction',
    num: v,
    den: d,
    ...(form === 'mixed' ? { allowImproper: false } : form === 'improper' ? { allowMixed: false } : {}),
  };
}

const formText = (v: number, d: number, form: Form) =>
  v % d === 0 || v < d ? '' : form === 'mixed' ? '答えは 帯分数で 書こう。' : form === 'improper' ? '答えは 仮分数で 書こう。' : '';

interface Q {
  a: number; // 1/d の いくつ分
  b: number;
  d: number;
  op: 'add' | 'sub';
  /** 式の見せ方（a・b を 帯分数で見せるか） */
  ma: boolean;
  mb: boolean;
}

const exprText = (q: Q) =>
  `${show(q.a, q.d, q.ma ? 'mixed' : 'improper')} ${q.op === 'add' ? '＋' : '−'} ${show(q.b, q.d, q.mb ? 'mixed' : 'improper')}`;
const keyOf = (q: Q) => {
  const sa = show(q.a, q.d, q.ma ? 'mixed' : 'improper');
  const sb = show(q.b, q.d, q.mb ? 'mixed' : 'improper');
  return q.op === 'add' ? [sa, sb].sort().join('+') : `${sa}-${sb}`;
};

/** 定義域: [分母, a, b]（1/分母 の いくつ分） */
const ADD_P: [number, number, number][] = [];
const SUB_P: [number, number, number][] = [];
for (let d = 2; d <= 9; d++)
  for (let a = 1; a < d; a++) {
    for (let b = a; b < d; b++) ADD_P.push([d, a, b]);
    for (let w = 1; w <= 3; w++) SUB_P.push([d, w * d, a]);
    SUB_P.push([d, d + a, a + 1 <= d - 1 ? a + 1 : 1]);
    for (let b = 1; b < a; b++) SUB_P.push([d, a, b]);
  }

function makeQ(obj: Obj, rng: Rng): Q {
  const d = rng.int(2, 9);
  switch (obj) {
    case 'addP': {
      // 真分数 ＋ 真分数（定義域から均等に。交換は同じ）
      const [dd, a, b] = pick(rng, ADD_P);
      return rng.next() < 0.5
        ? { a, b, d: dd, op: 'add', ma: false, mb: false }
        : { a: b, b: a, d: dd, op: 'add', ma: false, mb: false };
    }
    case 'addM': {
      const wa = rng.int(1, 3);
      const a = wa * d + rng.int(1, d - 1);
      const mixedB = rng.next() < 0.5;
      const b = (mixedB ? rng.int(1, 2) * d : 0) + rng.int(1, d - 1);
      return { a, b, d, op: 'add', ma: true, mb: mixedB };
    }
    case 'subP': {
      // 整数 − 真分数、仮分数 − 真分数、真分数 − 真分数（定義域から均等に）
      const [dd, a, b] = pick(rng, SUB_P);
      return { a, b, d: dd, op: 'sub', ma: false, mb: false };
    }
    case 'subM':
    case 'story': {
      // 帯分数 − 真分数・帯分数（くり下がりが あることも）
      const wa = rng.int(1, 4);
      const ra = rng.int(1, d - 1);
      const a = wa * d + ra;
      const wb = rng.int(0, wa - 1);
      const rb = rng.int(1, d - 1);
      const b = wb * d + rb;
      return { a, b, d, op: 'sub', ma: true, mb: wb > 0 };
    }
  }
}

function wrongsOf(q: Q, v: number, form: Form) {
  const f: 'mixed' | 'improper' = form === 'improper' ? 'improper' : 'mixed';
  const { a, b, d } = q;
  const ra = a % d;
  const rb = b % d;
  const wa = Math.floor(a / d);
  const wb = Math.floor(b / d);
  const cands: [string | null, string][] = [];
  if (q.op === 'add') {
    // 分母どうしも たした
    cands.push([q.ma || q.mb ? `${wa + wb}と${ra + rb}/${2 * d}` : `${ra + rb}/${2 * d}`, 'add-den']);
    // 帯分数の 整数部分を わすれた
    if (q.ma) cands.push([inp(ra + b, d, f), 'whole-drop']);
  } else {
    if (ra < rb && (q.ma || a % d !== 0)) {
      // くり下がりで 小さい ほうから 大きい ほうを ひいた
      cands.push([`${wa - wb}と${rb - ra}/${d}`, 'reverse-sub']);
    }
    if (a % d === 0) {
      // 整数 − 分数で、整数を 1 へらして 分子を そのまま（3 − 1/4 → 2と1/4）
      cands.push([`${a / d - 1}と${b}/${d}`, 'int-borrow']);
    }
    // 分母どうしも ひいた代わりに、分子だけ ひいて 整数を わすれた
    if (q.ma && wb === 0) cands.push([inp(v % d === 0 ? d : v % d, d, f), 'whole-drop']);
  }
  const ans = [answerOf(v, d, form)];
  return wrongList(ans, cands);
}

function calc(obj: Exclude<Obj, 'story'>, level: number, rng: Rng, alt: boolean): NumberItem {
  const q = makeQ(obj, rng);
  const v = q.op === 'add' ? q.a + q.b : q.a - q.b;
  const form: Form = v <= q.d || v % q.d === 0 ? 'any' : pick(rng, ['mixed', 'improper', 'any'] as const);
  const sym = q.op === 'add' ? '＋' : '−';
  const borrow = q.op === 'sub' && q.a % q.d < q.b % q.d;
  const steps =
    q.op === 'add'
      ? q.ma || q.mb
        ? `整数どうし ${Math.floor(q.a / q.d)} ＋ ${Math.floor(q.b / q.d)}、分数どうし [[${q.a % q.d}/${q.d}]] ＋ [[${q.b % q.d}/${q.d}]]。`
        : `[[1/${q.d}]]が ${q.a} ＋ ${q.b}こ。`
      : borrow
        ? `分数の 部分が ひけないので、整数から 1 くり下げて ${show(q.a, q.d, 'mixed')} ＝ [[${Math.floor(q.a / q.d) - 1} ${(q.a % q.d) + q.d}/${q.d}]]と 考えよう。`
        : `[[1/${q.d}]]が ${q.a} − ${q.b}こ と 考えても よいよ。`;
  return {
    engine: 'number',
    id: `${obj}${alt ? '-alt' : ''}:${exprText(q)}:${form}`,
    objective: obj,
    level,
    prompt: `${alt ? '[[1/' + q.d + ']]の いくつ分かを 考えて、' : ''}計算しよう。${formText(v, q.d, form)}`,
    figure: expr(`${exprText(q)} ＝ {{}}`),
    hints: [
      alt ? `どの 数も [[1/${q.d}]]の いくつ分かで 表せるよ。` : '分母が 同じなので、分母は そのままで 計算するよ。',
      steps,
      q.op === 'add'
        ? `[[1/${q.d}]]が ${q.a + q.b}こ。${form === 'mixed' ? '帯分数に なおそう。' : form === 'improper' ? '仮分数の まま 書こう。' : ''}`
        : `[[1/${q.d}]]が ${q.a} − ${q.b} ＝ ${v}こ。${form === 'mixed' ? '帯分数に なおそう。' : ''}`,
    ],
    explain: `${exprText(q)} ＝ ${show(v, q.d, form === 'improper' ? 'improper' : 'mixed')}${v > q.d && v % q.d !== 0 ? `（${show(v, q.d, form === 'improper' ? 'mixed' : 'improper')}）` : ''}。分母は そのままで、分子どうしを ${sym === '＋' ? 'たします' : 'ひきます'}。`,
    identity: `${keyOf(q)}${alt ? ':unit' : ''}`,
    alt,
    fields: [{ answer: answerOf(v, q.d, form) }],
    keys: ['fraction'],
    wrongAnswers: wrongsOf(q, v, form),
  };
}

interface Scene {
  id: string;
  op: 'add' | 'sub';
  unit: string;
  text: (a: string, b: string) => string;
}
const SCENES: Scene[] = [
  { id: 'juice', op: 'add', unit: 'L', text: (a, b) => `ジュースが ${a}L、牛にゅうが ${b}L あります。あわせて 何Lですか。` },
  { id: 'ribbon', op: 'add', unit: 'm', text: (a, b) => `赤い リボンが ${a}m、白い リボンが ${b}m あります。あわせて 何mですか。` },
  { id: 'walk', op: 'add', unit: 'km', text: (a, b) => `午前に ${a}km、午後に ${b}km 歩きました。あわせて 何km 歩きましたか。` },
  { id: 'flour', op: 'add', unit: 'kg', text: (a, b) => `こなが ${a}kg あります。${b}kg 買い足すと、何kgに なりますか。` },
  { id: 'water', op: 'sub', unit: 'L', text: (a, b) => `水が ${a}L あります。${b}L 使うと、のこりは 何Lですか。` },
  { id: 'rope', op: 'sub', unit: 'm', text: (a, b) => `ロープが ${a}m あります。${b}m 切り取ると、のこりは 何mですか。` },
  { id: 'tape', op: 'sub', unit: 'm', text: (a, b) => `青い テープは ${a}m、黄色い テープは ${b}mです。ちがいは 何mですか。` },
  { id: 'sand', op: 'sub', unit: 'kg', text: (a, b) => `すなが ${a}kg あります。${b}kg 運ぶと、のこりは 何kgですか。` },
];

function story(level: number, rng: Rng, alt: boolean): NumberItem {
  const sc = pick(rng, SCENES);
  const q = makeQ(sc.op === 'add' ? (rng.next() < 0.5 ? 'addP' : 'addM') : 'subM', rng);
  const v = q.op === 'add' ? q.a + q.b : q.a - q.b;
  const form: Form = 'any';
  const sa = show(q.a, q.d, q.ma ? 'mixed' : 'improper');
  const sb = show(q.b, q.d, q.mb ? 'mixed' : 'improper');
  return {
    engine: 'number',
    id: `story${alt ? '-alt' : ''}:${sc.id}:${exprText(q)}`,
    objective: 'story',
    level,
    prompt: sc.text(sa, sb),
    figure: alt
      ? {
          kind: 'tape',
          parts:
            sc.op === 'add'
              ? [
                  { length: 3, label: `${sa}${sc.unit}`, tone: 'a' },
                  { length: 2, label: `${sb}${sc.unit}`, tone: 'b' },
                ]
              : [
                  { length: 2, label: `${sb}${sc.unit}`, tone: 'b' },
                  { length: 3, label: '？', tone: 'muted' },
                ],
          total: sc.op === 'add' ? '？' : `${sa}${sc.unit}`,
        }
      : undefined,
    hints: [
      sc.op === 'add' ? 'あわせた 量を 求めるので たし算だね。' : 'のこりや ちがいを 求めるので ひき算だね。',
      `式は ${exprText(q)}。`,
      `[[1/${q.d}]]が ${q.a} ${sc.op === 'add' ? '＋' : '−'} ${q.b}こ。`,
    ],
    explain: `${exprText(q)} ＝ ${show(v, q.d, 'mixed')}。答えは ${show(v, q.d, 'mixed')}${sc.unit}${v > q.d && v % q.d !== 0 ? `（${show(v, q.d, 'improper')}${sc.unit}）` : ''}です。`,
    identity: `story:${sc.id}:${keyOf(q)}`,
    alt,
    fields: [{ label: sc.unit, answer: answerOf(v, q.d, form) }],
    keys: ['fraction'],
    wrongAnswers: wrongsOf(q, v, form),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['addP', 'subP'] },
  { objs: ['addM', 'addP', 'subP'] },
  { objs: ['subM', 'addM'] },
  { objs: ['story', 'subM', 'addM', 'subP'] },
];

export function generateFractionSame(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  if (obj === 'story') return story(level, rng, alt);
  return calc(obj, level, rng, alt);
}

export const fractionSame: UnitSpec = finishUnit({
  id: 'g4.math.fraction-same',
  title: '分母が 同じ 分数の たし算・ひき算',
  stage: 'g4',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'math-split',
  prereq: ['g4.math.fraction-kinds'],
  objectives: [
    { id: 'addP', title: '真分数・仮分数の たし算' },
    { id: 'addM', title: '帯分数の たし算' },
    { id: 'subP', title: '整数・仮分数から ひく' },
    { id: 'subM', title: '帯分数の ひき算（くり下がり）' },
    { id: 'story', title: '文章題' },
  ],
  misconceptions: [
    {
      id: 'add-den',
      explain:
        '分母どうしも たしたのかな。分母は「1を いくつに 分けたか」なので、同じ 分母の たし算では 分母は そのまま。分子だけ たすよ。',
    },
    {
      id: 'whole-drop',
      explain: '帯分数の 整数の 部分を わすれたのかな。整数の 部分も 計算に 入れよう。',
    },
    {
      id: 'reverse-sub',
      explain:
        '分数の 部分で 小さい ほうから 大きい ほうを ひいたのかな。ひけない ときは 整数から 1 くり下げて、分数の 部分を ふやしてから ひこう。',
    },
    {
      id: 'int-borrow',
      explain: '整数から 1を 分数に したのに、分子に もどして いないのかな。1 ＝ [[4/4]]のように 分母と 同じ 分子の 分数に なおしてから ひこう。',
    },
  ],
  levels: [
    { label: '真分数・仮分数', chance: 0.02 },
    { label: '帯分数の たし算', chance: 0.02 },
    { label: '帯分数の ひき算', chance: 0.02 },
    { label: '文章題・まとめ', chance: 0.02 },
  ],
  intro: [
    {
      text: '[[3/5]] ＋ [[4/5]]は、[[1/5]]が 3 ＋ 4 ＝ 7こ。だから [[7/5]]（[[1 2/5]]）です。分母は そのまま。',
      figure: expr('[[3/5]] ＋ [[4/5]] ＝ [[7/5]]'),
    },
    {
      text: '帯分数の たし算は、整数どうし・分数どうしを たします。分数が 1を こえたら 整数に くり上げます。',
      figure: expr('[[1 2/5]] ＋ [[4/5]] ＝ [[1 6/5]] ＝ [[2 1/5]]'),
    },
    {
      text: '[[2 1/5]] − [[3/5]]は、分数の 部分が ひけないので、整数から 1 くり下げて [[1 6/5]] − [[3/5]] ＝ [[1 3/5]]。',
      figure: expr('[[2 1/5]] − [[3/5]] ＝ [[1 3/5]]'),
    },
    {
      text: '帯分数を 仮分数に なおして 計算しても よいです。[[11/5]] − [[3/5]] ＝ [[8/5]]。',
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateFractionSame(level, rng, index),
  },
  review: 'type',
  basis: '小学校学習指導要領（平成29年告示）算数 第4学年 A(7) 同分母の分数の加法・減法（帯分数を含む）',
  revised: REVISED,
});
