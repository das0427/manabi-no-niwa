/**
 * g4.math.order-ops 計算の順序（四則混合・（ ））と計算のきまり（curriculum-matrix 3.7）。
 * 1つの式に表す → 計算の順序 → きまりで工夫する。
 *
 * 式は型（テンプレート）に数を入れ、①答えが 0 以上の整数 ②わり算が わりきれる ③左から順に計算した答えが正答と違う
 * を満たす組を、定義域から均等に（棄却法で）選ぶ。同一性キー: 式（交換だけの違いは型が違うので別）。
 */
import type { Rng } from '../../core/util/rng';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { expr, finishUnit, opts, pick, pickObj, REVISED, wrongList } from './util';

type Obj = 'muldiv' | 'paren' | 'mixed' | 'rules' | 'oneexpr';
type Tok = number | '+' | '-' | '×' | '÷' | '(' | ')';

const SYM: Record<string, string> = {
  '+': '＋',
  '-': '−',
  '×': '×',
  '÷': '÷',
  '(': '（',
  ')': '）',
};

function tokens(tpl: string, vals: Record<string, number>): Tok[] {
  return tpl
    .split(' ')
    .flatMap((t) =>
      t.startsWith('(') ? ['(', t.slice(1)] : t.endsWith(')') ? [t.slice(0, -1), ')'] : [t],
    )
    .map((t) => (t in vals ? vals[t]! : (t as Tok)));
}

const showExpr = (ts: Tok[]) =>
  ts
    .map((t) => (typeof t === 'number' ? String(t) : SYM[t]!))
    .join(' ')
    .replace(/（ /g, '（')
    .replace(/ ）/g, '）');

/** 計算（mode: 'std' 正しい順序、'ltr' かっこ以外は左から、'nop' かっこを無視）。わりきれない・負は null */
function evalTok(ts: Tok[], mode: 'std' | 'ltr' | 'nop'): number | null {
  const list = mode === 'nop' ? ts.filter((t) => t !== '(' && t !== ')') : ts;
  let i = 0;
  const bad = { v: false };
  const ap = (a: number, op: Tok, b: number): number => {
    let r: number;
    if (op === '+') r = a + b;
    else if (op === '-') r = a - b;
    else if (op === '×') r = a * b;
    else {
      if (b === 0 || a % b !== 0) bad.v = true;
      r = b === 0 ? 0 : a / b;
    }
    if (r < 0) bad.v = true;
    return r;
  };
  const atom = (): number => {
    const t = list[i++];
    if (t === '(') {
      const v = mode === 'ltr' ? flat() : sum();
      i++; // ')'
      return v;
    }
    return t as number;
  };
  const prod = (): number => {
    let v = atom();
    while (list[i] === '×' || list[i] === '÷') {
      const op = list[i++]!;
      v = ap(v, op, atom());
    }
    return v;
  };
  const sum = (): number => {
    let v = prod();
    while (list[i] === '+' || list[i] === '-') {
      const op = list[i++]!;
      v = ap(v, op, prod());
    }
    return v;
  };
  const flat = (): number => {
    let v = atom();
    while (i < list.length && list[i] !== ')') {
      const op = list[i++]!;
      v = ap(v, op, atom());
    }
    return v;
  };
  const v = mode === 'ltr' ? flat() : sum();
  return bad.v ? null : v;
}

const TPL: Record<'muldiv' | 'paren' | 'mixed', string[]> = {
  muldiv: [
    'a + b × c',
    'a - b × c',
    'a × b + c',
    'a × b - c',
    'a + b ÷ c',
    'a - b ÷ c',
    'a ÷ b + c',
    'a ÷ b - c',
  ],
  paren: [
    '(a + b) × c',
    '(a - b) × c',
    'a × (b + c)',
    'a × (b - c)',
    '(a + b) ÷ c',
    '(a - b) ÷ c',
    'a ÷ (b + c)',
    'a - (b + c)',
    'a - (b - c)',
  ],
  mixed: [
    'a + b × c - d',
    'a × b - c ÷ d',
    '(a + b) × c - d',
    'a - (b + c) ÷ d',
    'a × (b - c) + d',
    'a + b ÷ c × d',
    'a - b × c + d',
  ],
};

function makeExpr(
  obj: 'muldiv' | 'paren' | 'mixed',
  rng: Rng,
): { ts: Tok[]; v: number; tpl: string } {
  for (;;) {
    const tpl = pick(rng, TPL[obj]);
    const vals = { a: rng.int(2, 60), b: rng.int(2, 20), c: rng.int(2, 12), d: rng.int(2, 12) };
    const ts = tokens(tpl, vals);
    const v = evalTok(ts, 'std');
    if (v === null) continue;
    const n = obj === 'muldiv' ? null : evalTok(ts, 'nop');
    // （ ）の 問題だけ「（ ）を 無視しても 同じ答え」を外す。muldiv・mixed は 左から 計算しても 同じに なる
    // 型（a × b ＋ c など）も 出す（「×÷は いつも 後ろに ある」と 覚えないように。レビュー 中-C）
    if (obj === 'paren' && n === v) continue;
    // ヒント②（まず ○ ＝ □）の 数が 答えと 同じに ならない
    if (solveSteps(ts)[0]!.v === v) continue;
    return { ts, v, tpl };
  }
}

/** 正しい順序で 1つずつ 計算した 手順（式の 部分・その 答え） */
function solveSteps(ts0: Tok[]): { part: Tok[]; v: number }[] {
  const steps: { part: Tok[]; v: number }[] = [];
  let ts = [...ts0];
  for (let guard = 0; guard < 10 && ts.length > 1; guard++) {
    const open = ts.indexOf('(');
    if (open >= 0) {
      const close = ts.indexOf(')', open);
      const inner = ts.slice(open + 1, close);
      if (inner.length <= 3) {
        const v = evalTok(inner, 'std')!;
        steps.push({ part: inner, v });
        ts = [...ts.slice(0, open), v, ...ts.slice(close + 1)];
        continue;
      }
      // （ ）の 中に 計算が 2つ 以上: 中だけ 1つ 進める
      const sub = solveSteps(inner)[0]!;
      const k = indexOfPart(inner, sub.part);
      ts = [
        ...ts.slice(0, open + 1),
        ...inner.slice(0, k),
        sub.v,
        ...inner.slice(k + 3),
        ...ts.slice(close),
      ];
      steps.push(sub);
      continue;
    }
    let k = ts.findIndex((t) => t === '×' || t === '÷');
    if (k < 0) k = ts.findIndex((t) => t === '+' || t === '-');
    const part = ts.slice(k - 1, k + 2);
    const v = evalTok(part, 'std')!;
    steps.push({ part, v });
    ts = [...ts.slice(0, k - 1), v, ...ts.slice(k + 2)];
  }
  return steps;
}

function indexOfPart(ts: Tok[], part: Tok[]): number {
  for (let i = 0; i + part.length <= ts.length; i++)
    if (part.every((p, j) => ts[i + j] === p)) return i;
  return 0;
}

/** ヒント③: 2つめの 計算を（答えは 言わずに）示す */
function nextStepHint(ts: Tok[]): string {
  const st = solveSteps(ts);
  if (st.length < 2) return 'のこりを 計算しよう。';
  const second = st[1]!;
  return st.length === 2
    ? `つぎに ${showExpr(second.part)} を 計算しよう。`
    : `つぎに ${showExpr(second.part)} を 計算しよう。かけ算・わり算が のこって いたら 先に、さいごに たし算・ひき算だよ。`;
}

/** 解説: ぜんぶの 手順 */
function allSteps(ts: Tok[]): string {
  return solveSteps(ts)
    .map((s, i) => `${['①', '②', '③', '④'][i] ?? ''} ${showExpr(s.part)} ＝ ${s.v}`)
    .join('、');
}

/** 計算の順序の文 */
const ORDER_HINT = '（ ）の 中 → かけ算・わり算 → たし算・ひき算 の 順に 計算するよ。';

/** 最初に 計算する 部分を 文で */
function firstStep(ts: Tok[]): string {
  const open = ts.indexOf('(');
  if (open >= 0) {
    const close = ts.indexOf(')');
    const inner = ts.slice(open + 1, close);
    return `まず （ ）の 中の ${showExpr(inner)} ＝ ${evalTok(inner, 'std')}。`;
  }
  const k = ts.findIndex((t) => t === '×' || t === '÷');
  const part = ts.slice(k - 1, k + 2);
  return `まず ${showExpr(part)} ＝ ${evalTok(part, 'std')}。`;
}

function calc(
  obj: 'muldiv' | 'paren' | 'mixed',
  level: number,
  rng: Rng,
  alt: boolean,
): NumberItem {
  const { ts, v } = makeExpr(obj, rng);
  const e = showExpr(ts);
  const answers = [{ kind: 'int' as const, value: v }];
  return {
    engine: 'number',
    id: `${obj}${alt ? '-alt' : ''}:${e}`,
    objective: obj,
    level,
    prompt: alt
      ? 'どこから 計算するか 考えて、答えを 求めよう。（計算する 順に 番号を つけると わかりやすいよ）'
      : '計算しよう。',
    figure: expr(`${e} ＝ {{}}`),
    hints: [ORDER_HINT, firstStep(ts), nextStepHint(ts)],
    explain: `${ORDER_HINT} ${allSteps(ts)}。${e} ＝ ${v}`,
    identity: alt ? `${e}:order` : e,
    alt,
    fields: [{ answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [evalTok(ts, 'ltr'), 'left-to-right'],
      [obj !== 'muldiv' ? evalTok(ts, 'nop') : null, 'paren-ignore'],
    ]),
  };
}

/** 計算のきまりで くふう（alt: きまりの □） */
function rules(level: number, rng: Rng, alt: boolean): NumberItem {
  if (alt) {
    const kind = rng.int(0, 2);
    const a = rng.int(11, 49);
    const b = rng.int(2, 9);
    const c = rng.int(2, 9);
    const forms = [
      {
        e: `（${a} ＋ ${b}）× ${c} ＝ ${a} × ${c} ＋ □ × ${c}`,
        ans: b,
        w: [[c, 'distrib-partial']],
      },
      {
        e: `${a} × ${c} − ${b} × ${c} ＝ （${a} − ${b}）× □`,
        ans: c,
        w: [[a - b, 'distrib-partial']],
      },
      { e: `${a} × ${b} × ${c} ＝ ${a} × （${b} × □）`, ans: c, w: [[b * c, 'blank-product']] },
    ] as const;
    const f = forms[kind]!;
    const answers = [{ kind: 'int' as const, value: f.ans }];
    return {
      engine: 'number',
      id: `rules-alt:${f.e}`,
      objective: 'rules',
      level,
      prompt: '計算の きまりを 使います。□に あてはまる 数を 書こう。',
      figure: expr(f.e),
      hints: [
        kind === 2
          ? 'かけ算だけの 式は、どこから 計算しても 答えは 同じだよ。'
          : '（○ ＋ △）× □ ＝ ○ × □ ＋ △ × □ の きまりだよ。',
        '左と 右で、同じ 数が どこに あるか くらべよう。',
        kind === 0
          ? `（ ）の 中の ${b}にも ${c}を かけるよ。`
          : kind === 1
            ? `どちらにも かけて いる 数は？`
            : `${b}と かけて いた 数は？`,
      ],
      explain: `□は ${f.ans}。${kind === 2 ? 'かけ算では、計算する 順を かえても 答えは 同じです。' : '（○ ＋ △）× □ ＝ ○ × □ ＋ △ × □、（○ − △）× □ ＝ ○ × □ − △ × □ です。'}`,
      identity: `rules-blank:${f.e}`,
      alt: true,
      fields: [{ answer: answers[0]! }],
      wrongAnswers: wrongList(
        answers,
        f.w.map(([v, m]) => [v, m] as [number, string]),
      ),
    };
  }
  const kind = rng.int(0, 5);
  const a = rng.int(3, 99);
  const b = rng.int(2, 9);
  const forms = [
    {
      e: `25 × ${a} × 4`,
      v: 100 * a,
      how: `25 × 4 ＝ 100を 先に 計算して、100 × ${a}`,
      w: [[100 + a, 'assoc-add']],
    },
    {
      e: `${a} × 8 × 125`,
      v: 1000 * a,
      how: `8 × 125 ＝ 1000を 先に 計算して、${a} × 1000`,
      w: [[1000 + a, 'assoc-add']],
    },
    {
      e: `${a} × 99`,
      v: 99 * a,
      how: `${a} × 99 ＝ ${a} × 100 − ${a} × 1`,
      w: [
        [100 * a - 1, 'distrib-partial'],
        [100 * a - 99, 'distrib-partial'],
      ],
    },
    {
      e: `${a} × 102`,
      v: 102 * a,
      how: `${a} × 102 ＝ ${a} × 100 ＋ ${a} × 2`,
      w: [[100 * a + 2, 'distrib-partial']],
    },
    {
      e: `${a} × ${b} ＋ ${a} × ${10 - b}`,
      v: 10 * a,
      how: `${a} × （${b} ＋ ${10 - b}）＝ ${a} × 10`,
      w: [[(a * b + a) * (10 - b), 'left-to-right']],
    },
    {
      e: `${a} × ${10 + b} − ${a} × ${b}`,
      v: 10 * a,
      how: `${a} × （${10 + b} − ${b}）＝ ${a} × 10`,
      w: [[a * (10 + b) - a, 'left-to-right']],
    },
  ];
  const f = forms[kind]!;
  const answers = [{ kind: 'int' as const, value: f.v }];
  return {
    engine: 'number',
    id: `rules:${f.e}`,
    objective: 'rules',
    level,
    prompt: '計算の きまりを 使って、くふうして 計算しよう。',
    figure: expr(`${f.e} ＝ {{}}`),
    hints: [
      kind <= 1
        ? 'かけ算だけの 式は、かける 順を かえても よいよ。100や 1000に なる 組を さがそう。'
        : '（○ ＋ △）× □ ＝ ○ × □ ＋ △ × □ の きまりを 使おう。',
      [
        f.how.split('、')[0]!,
        f.how.split('、')[0]!,
        '99 ＝ 100 − 1 と 考えよう。',
        '102 ＝ 100 ＋ 2 と 考えよう。',
        `どちらも ${a}を かけて いるね。かける 数を まとめよう。`,
        `どちらも ${a}を かけて いるね。かける 数を まとめよう。`,
      ][kind]!,
      f.how,
    ],
    explain: `${f.how} ＝ ${f.v}。`,
    identity: `rules:${f.e}`,
    alt: false,
    fields: [{ answer: answers[0]! }],
    wrongAnswers: wrongList(
      answers,
      f.w.map(([v, m]) => [v, m] as [number, string]),
    ),
  };
}

interface Scene {
  id: string;
  make: (rng: Rng) => {
    text: string;
    right: string;
    wrong: [string, string][];
    v: number;
    wv: (number | null)[];
  };
}
const SCENES: Scene[] = [
  {
    id: 'bread',
    make: (rng) => {
      const p = rng.int(6, 15) * 10;
      const n = rng.int(2, 5);
      const q = rng.int(8, 20) * 10;
      return {
        text: `1こ ${p}円の パンを ${n}こと、${q}円の ジュースを 1本 買いました。代金は 何円ですか。`,
        right: `${p} × ${n} ＋ ${q}`,
        wrong: [
          [`（${p} ＋ ${q}）× ${n}`, 'paren-needed'],
          [`${p} ＋ ${n} × ${q}`, 'scene-order'],
          [`${p} × （${n} ＋ ${q}）`, 'paren-needed'],
        ],
        v: p * n + q,
        wv: [(p + q) * n, p + n * q],
      };
    },
  },
  {
    id: 'change',
    make: (rng) => {
      const p = rng.int(5, 12) * 10;
      const n = rng.int(2, 4);
      const pay = 500;
      return {
        text: `${pay}円 出して、1さつ ${p}円の ノートを ${n}さつ 買いました。おつりは 何円ですか。`,
        right: `${pay} − ${p} × ${n}`,
        wrong: [
          [`（${pay} − ${p}）× ${n}`, 'paren-needed'],
          [`${p} × ${n} − ${pay}`, 'scene-order'],
          [`${pay} − ${p} ＋ ${n}`, 'scene-order'],
        ],
        v: pay - p * n,
        wv: [(pay - p) * n],
      };
    },
  },
  {
    id: 'share',
    make: (rng) => {
      const n = rng.int(3, 6);
      const total = n * rng.int(5, 12);
      const a = rng.int(5, total - 5);
      const b = total - a;
      return {
        text: `あめが 赤い ふくろに ${a}こ、青い ふくろに ${b}こ あります。ぜんぶを ${n}人で 同じ数ずつ 分けると、1人 何こですか。`,
        right: `（${a} ＋ ${b}）÷ ${n}`,
        wrong: [
          [`${a} ＋ ${b} ÷ ${n}`, 'paren-needed'],
          [`${n} ÷ （${a} ＋ ${b}）`, 'scene-order'],
          [`${a} × ${b} ÷ ${n}`, 'scene-order'],
        ],
        v: total / n,
        wv: [],
      };
    },
  },
  {
    id: 'set',
    make: (rng) => {
      const p = rng.int(5, 15) * 10;
      const q = rng.int(3, 9) * 10;
      const n = rng.int(2, 6);
      return {
        text: `${p}円の おにぎりと ${q}円の お茶を 1組に して、${n}組 買いました。代金は 何円ですか。`,
        right: `（${p} ＋ ${q}）× ${n}`,
        wrong: [
          [`${p} ＋ ${q} × ${n}`, 'paren-needed'],
          [`${p} × ${n} ＋ ${q}`, 'scene-order'],
          [`${p} ＋ ${q} ＋ ${n}`, 'scene-order'],
        ],
        v: (p + q) * n,
        wv: [p + q * n, p * n + q],
      };
    },
  },
  {
    id: 'left',
    make: (rng) => {
      const a = rng.int(2, 8) * 10;
      const b = rng.int(2, 8) * 10;
      const t = a + b + rng.int(1, 15) * 10;
      return {
        text: `色紙が ${t}まい あります。きのう ${a}まい、きょう ${b}まい 使いました。のこりは 何まいですか。（1つの 式で）`,
        right: `${t} − （${a} ＋ ${b}）`,
        wrong: [
          [`${t} − ${a} ＋ ${b}`, 'paren-sign'],
          [`（${t} − ${a}）＋ ${b}`, 'paren-sign'],
          [`${a} ＋ ${b} − ${t}`, 'scene-order'],
        ],
        v: t - a - b,
        wv: [t - a + b],
      };
    },
  },
  {
    id: 'bags',
    make: (rng) => {
      const n = rng.int(3, 8);
      const each = rng.int(4, 12);
      const a = rng.int(3, 20);
      const t = a + n * each;
      return {
        text: `くりが ${t}こ あります。${a}こ 食べて、のこりを ${n}人で 同じ数ずつ 分けました。1人 何こですか。`,
        right: `（${t} − ${a}）÷ ${n}`,
        wrong: [
          [`${t} − ${a} ÷ ${n}`, 'paren-needed'],
          [`${t} ÷ ${n} − ${a}`, 'scene-order'],
          [`（${t} ＋ ${a}）÷ ${n}`, 'scene-order'],
        ],
        v: each,
        wv: [],
      };
    },
  },
  {
    id: 'two',
    make: (rng) => {
      const p = rng.int(3, 9) * 10;
      const n = rng.int(2, 5);
      const q = rng.int(5, 15) * 10;
      const m = rng.int(2, 4);
      return {
        text: `1本 ${p}円の えんぴつを ${n}本と、1さつ ${q}円の ノートを ${m}さつ 買いました。代金は 何円ですか。`,
        right: `${p} × ${n} ＋ ${q} × ${m}`,
        wrong: [
          [`（${p} ＋ ${q}）× （${n} ＋ ${m}）`, 'scene-order'],
          [`${p} × （${n} ＋ ${q}）× ${m}`, 'paren-needed'],
          [`（${p} × ${n} ＋ ${q}）× ${m}`, 'paren-needed'],
        ],
        v: p * n + q * m,
        wv: [(p + q) * (n + m), (p * n + q) * m],
      };
    },
  },
  {
    id: 'discount',
    make: (rng) => {
      const p = rng.int(10, 30) * 10;
      const d = rng.int(2, 5) * 10;
      const n = rng.int(2, 5);
      return {
        text: `1こ ${p}円の ケーキが、1こに つき ${d}円 安く なって います。${n}こ 買うと 代金は 何円ですか。`,
        right: `（${p} − ${d}）× ${n}`,
        wrong: [
          [`${p} − ${d} × ${n}`, 'paren-needed'],
          [`${p} × ${n} − ${d}`, 'scene-order'],
          [`（${p} ＋ ${d}）× ${n}`, 'scene-order'],
        ],
        v: (p - d) * n,
        wv: [p - d * n, p * n - d],
      };
    },
  },
];

function oneexpr(level: number, rng: Rng, alt: boolean): Item {
  const sc = pick(rng, SCENES);
  const m = sc.make(rng);
  if (alt) {
    const answers = [{ kind: 'int' as const, value: m.v }];
    const item: NumberItem = {
      engine: 'number',
      id: `oneexpr-alt:${sc.id}:${m.right}`,
      objective: 'oneexpr',
      level,
      prompt: `${m.text} 1つの 式に 表して 答えを 求めよう。`,
      hints: [
        'さきに まとめて 考える ところは （ ）を 使って 表そう。',
        `式は ${m.right} の 形に なるよ。`,
        firstStep(tokensFromText(m.right)),
      ],
      explain: `${m.right} ＝ ${m.v}。答えは ${m.v}です。`,
      identity: `oneexpr-calc:${sc.id}:${m.right}`,
      alt: true,
      fields: [{ answer: answers[0]! }],
      wrongAnswers: wrongList(
        answers,
        m.wv.map((v) => [v, 'paren-needed'] as [number | null, string]),
      ),
    };
    return item;
  }
  const item: ChoiceItem = {
    engine: 'choice',
    id: `oneexpr:${sc.id}:${m.right}`,
    objective: 'oneexpr',
    level,
    prompt: `${m.text}\nこの 場面を 1つの 式に 表した ものは どれ？`,
    hints: [
      '何を 先に まとめて 考えるかを 場面から 読み取ろう。',
      'まとめて 先に 計算する ところは （ ）を 使うよ。かけ算・わり算は （ ）が なくても 先に 計算するよ。',
      `答えは ${m.v}に なるよ。どの 式が ${m.v}に なるかな。`,
    ],
    explain: `${m.right} ＝ ${m.v}。${m.right.includes('（') ? '先に まとめる 部分を （ ）で 表します。' : 'かけ算は たし算・ひき算より 先に 計算するので （ ）は いりません。'}`,
    identity: `oneexpr:${sc.id}:${m.right}`,
    alt: false,
    options: opts(
      m.right,
      m.wrong.map(([l, mm]) => [l, mm]),
    ),
  };
  return item;
}

/** 表示用の式の文字列から トークンに（ヒントで最初の計算を示すため） */
function tokensFromText(s: string): Tok[] {
  const out: Tok[] = [];
  for (const m of s.matchAll(/\d+|[＋−×÷（）]/g)) {
    const t = m[0];
    if (/\d/.test(t)) out.push(Number(t));
    else
      out.push(
        ({ '＋': '+', '−': '-', '×': '×', '÷': '÷', '（': '(', '）': ')' } as const)[t as '＋'],
      );
  }
  return out;
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['muldiv', 'paren'] },
  { objs: ['muldiv', 'paren', 'oneexpr'] },
  { objs: ['mixed', 'rules', 'oneexpr'] },
  { objs: ['mixed', 'rules', 'paren', 'oneexpr'] },
];

export function generateOrderOps(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'muldiv':
    case 'paren':
    case 'mixed':
      return calc(obj, level, rng, alt);
    case 'rules':
      return rules(level, rng, alt);
    case 'oneexpr':
      return oneexpr(level, rng, alt);
  }
}

export const orderOps: UnitSpec = finishUnit({
  id: 'g4.math.order-ops',
  title: '計算の 順じょと きまり',
  stage: 'g4',
  subject: 'math',
  domain: 'A-number',
  kind: 'calc',
  priority: 'P1',
  status: 'ready',
  icon: 'math-formula-sub',
  prereq: ['g3.math.mult-2digit'],
  objectives: [
    { id: 'muldiv', title: 'かけ算・わり算を 先に' },
    { id: 'paren', title: '（ ）の 中を 先に' },
    { id: 'mixed', title: '3つ 以上の 計算が ある 式' },
    { id: 'rules', title: '計算の きまりで くふう' },
    { id: 'oneexpr', title: '1つの 式に 表す' },
  ],
  misconceptions: [
    {
      id: 'left-to-right',
      explain:
        '左から じゅんに 計算したのかな。かけ算・わり算は、たし算・ひき算より 先に 計算するよ。',
    },
    {
      id: 'paren-ignore',
      explain: '（ ）を 見落としたのかな。（ ）の 中は いちばん 先に 計算するよ。',
    },
    {
      id: 'paren-needed',
      explain:
        'まとめて 先に 計算したい ところに （ ）が ないのかな（または いらない （ ）が あるのかな）。場面で 先に まとめる ものを 考えよう。',
    },
    {
      id: 'paren-sign',
      explain:
        '使った 分を まとめて ひくときは （ ）で まとめるよ。（ ）を 外すと、ひく 数と たす 数が 入れかわって しまうね。',
    },
    {
      id: 'scene-order',
      explain:
        '場面と 式の 数の 組み合わせが 合って いないかも。何を 何こ 買ったのか、何から 何を ひくのかを 文から 読み取ろう。',
    },
    {
      id: 'assoc-add',
      explain:
        'かけ算の 式の とちゅうを たし算に して しまったのかな。かける 順を かえても、ぜんぶ かけ算の ままだよ。',
    },
    {
      id: 'blank-product',
      explain:
        '□に かけ算の 答えを 書いたのかな。□には、かける 数を 1つ 入れるよ。左の 式と くらべて みよう。',
    },
    {
      id: 'distrib-partial',
      explain:
        '（ ）の 中の 数の 1つにしか かけて いないのかな。（○ ＋ △）× □ は、○ にも △ にも □ を かけるよ。',
    },
  ],
  levels: [
    { label: '×÷を 先に・（ ）を 先に', chance: 0.02 },
    { label: '1つの 式に 表す', chance: 0.02 },
    { label: '3つ 以上の 計算・きまり', chance: 0.02 },
    { label: 'まとめ', chance: 0.02 },
  ],
  intro: [
    {
      text: '1こ 50円の あめを 3こと、80円の ガムを 1こ 買います。代金を 1つの 式に すると 50 × 3 ＋ 80。',
      figure: expr('50 × 3 ＋ 80 ＝ 230'),
    },
    {
      text: 'かけ算・わり算は、たし算・ひき算より 先に 計算します。6 ＋ 4 × 3 ＝ 6 ＋ 12 ＝ 18。',
      figure: expr('6 ＋ 4 × 3 ＝ 18'),
    },
    {
      text: '（ ）の ある 式は、（ ）の 中を いちばん 先に 計算します。（6 ＋ 4）× 3 ＝ 10 × 3 ＝ 30。',
      figure: expr('（6 ＋ 4）× 3 ＝ 30'),
    },
    {
      text: '計算の きまりを 使うと くふうできます。25 × 7 × 4 ＝ 7 × （25 × 4）＝ 700。',
      figure: expr('（○ ＋ △）× □ ＝ ○ × □ ＋ △ × □'),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateOrderOps(level, rng, index),
  },
  review: 'type',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第4学年 A(6) 式の表し方と読み方（四則の混合した式、（ ）を用いた式、計算に関して成り立つ性質）',
  revised: REVISED,
});
