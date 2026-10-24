/**
 * g6.math.letters 文字を使った式（x・y）（curriculum-matrix 3.9）。
 * 言葉の式 → 文字の式 → x の値を求める。
 *
 * 同一性キー: 場面 × 数（式を選ぶ・式の意味）、式 × x の値（式の値）、方程式の形 × 数（x を求める）。
 * 別例: 式を「y ＝ …」の関係で選ぶ／言葉の式から選ぶ／場面の文章で x の値を使う／テープ図で x を求める。
 */
import type { Rng } from '../../core/util/rng';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { expr, finishUnit, opts, pick, pickObj, REVISED, wrongList } from './util';

type Obj = 'expr' | 'read' | 'value' | 'solve';

// ---- 場面を 文字の式に ----
interface ExprScene {
  id: string;
  /** 数の組を作る */
  make: (rng: Rng) => number[];
  text: (p: number[]) => string;
  /** 求めるものの名前（y の説明） */
  what: string;
  /** y の単位 */
  yu: string;
  correct: (p: number[]) => string;
  wrongs: (p: number[]) => [string, string][];
  hint: string;
}
const tens = (rng: Rng, a: number, b: number) => rng.int(a, b) * 10;
const POLY_NAME: Record<number, string> = {
  3: '正三角形',
  4: '正方形',
  5: '正五角形',
  6: '正六角形',
};
const EXPR_SCENES: ExprScene[] = [
  {
    id: 'bread',
    make: (rng) => [rng.int(2, 6), tens(rng, 8, 15)],
    text: ([n, m]) => `1こ x円の パンを ${n}こと、${m}円の 牛にゅうを 1本 買います。`,
    what: '代金',
    yu: '円',
    correct: ([n, m]) => `x × ${n} ＋ ${m}`,
    wrongs: ([n, m]) => [
      [`x ＋ ${n} ＋ ${m}`, 'op-swap'],
      [`x × (${n} ＋ ${m})`, 'paren'],
      [`x × ${m} ＋ ${n}`, 'term-swap'],
    ],
    hint: '言葉の式は「パン 1この ねだん × こ数 ＋ 牛にゅうの ねだん」だね。',
  },
  {
    id: 'change',
    make: (rng) => [tens(rng, 30, 90)],
    text: ([m]) => `x円 持って います。${m}円の 本を 買いました。`,
    what: '残りの お金',
    yu: '円',
    correct: ([m]) => `x − ${m}`,
    wrongs: ([m]) => [
      [`${m} − x`, 'reverse-order'],
      [`x ＋ ${m}`, 'op-swap'],
      [`x × ${m}`, 'op-swap'],
    ],
    hint: '言葉の式は「持って いた お金 − 本の ねだん」だね。',
  },
  {
    id: 'square',
    make: (rng) => [rng.int(3, 6)],
    text: ([n]) => `1辺の 長さが x cmの ${POLY_NAME[n!]}が あります。`,
    what: 'まわりの 長さ',
    yu: 'cm',
    correct: ([n]) => `x × ${n}`,
    wrongs: ([n]) => [
      [`x ＋ ${n}`, 'op-swap'],
      n === 4 ? ['x × x', 'area-perim'] : [`x × ${n! - 1}`, 'side-count'],
      [`x × ${n! + 1}`, 'side-count'],
    ],
    hint: '同じ 長さの 辺が いくつ あるか 数えよう。',
  },
  {
    id: 'rect',
    make: (rng) => [rng.int(3, 9)],
    text: ([a]) => `縦《たて》が ${a}cm、横《よこ》が x cmの 長方形が あります。`,
    what: '面積',
    yu: 'cm²',
    correct: ([a]) => `${a} × x`,
    wrongs: ([a]) => [
      [`${a} ＋ x`, 'op-swap'],
      [`(${a} ＋ x) × 2`, 'area-perim'],
      [`${a} × x ÷ 2`, 'forget-half'],
    ],
    hint: '長方形の 面積は 縦《たて》 × 横《よこ》 だね。',
  },
  {
    id: 'group',
    make: (rng) => [rng.int(3, 8)],
    text: ([n]) => `x人の 子どもが ${n}人ずつの グループに 分かれます。`,
    what: 'グループの 数',
    yu: '',
    correct: ([n]) => `x ÷ ${n}`,
    wrongs: ([n]) => [
      [`${n} ÷ x`, 'reverse-order'],
      [`x × ${n}`, 'op-swap'],
      [`x − ${n}`, 'op-swap'],
    ],
    hint: '全部の 人数を 1つの グループの 人数で わるね。',
  },
  {
    id: 'otsuri',
    make: (rng) => [pick(rng, [500, 1000, 2000])],
    text: ([m]) => `x円の 品物を 1こ 買って、${m}円 出しました。`,
    what: 'おつり',
    yu: '円',
    correct: ([m]) => `${m} − x`,
    wrongs: ([m]) => [
      [`x − ${m}`, 'reverse-order'],
      [`${m} ＋ x`, 'op-swap'],
      [`${m} ÷ x`, 'op-swap'],
    ],
    hint: '言葉の式は「出した お金 − 品物の ねだん」だね。',
  },
  {
    id: 'triangle',
    make: (rng) => [rng.int(2, 9)],
    text: ([h]) => `底辺が x cm、高さが ${h}cmの 三角形が あります。`,
    what: '面積',
    yu: 'cm²',
    correct: ([h]) => `x × ${h} ÷ 2`,
    wrongs: ([h]) => [
      [`x × ${h}`, 'forget-half'],
      [`x ＋ ${h} ÷ 2`, 'op-swap'],
      [`x × 2 ÷ ${h}`, 'term-swap'],
    ],
    hint: '三角形の 面積は 底辺 × 高さ ÷ 2 だね。',
  },
  {
    id: 'notes',
    make: (rng) => {
      const n = rng.int(2, 5);
      let k = rng.int(2, 5);
      if (k === n) k = n === 5 ? 2 : n + 1;
      return [n, tens(rng, 10, 20), k];
    },
    text: ([n, m, k]) => `1本 x円の えんぴつを ${n}本と、1冊 ${m}円の ノートを ${k}冊 買います。`,
    what: '代金',
    yu: '円',
    correct: ([n, m, k]) => `x × ${n} ＋ ${m} × ${k}`,
    wrongs: ([n, m, k]) => [
      [`(x ＋ ${m}) × ${n! + k!}`, 'paren'],
      [`x ＋ ${n} ＋ ${m} ＋ ${k}`, 'op-swap'],
      [`x × ${k} ＋ ${m} × ${n}`, 'term-swap'],
    ],
    hint: '「えんぴつの 代金 ＋ ノートの 代金」と 考えよう。',
  },
];

function exprItem(level: number, rng: Rng, alt: boolean): ChoiceItem {
  const sc = pick(rng, EXPR_SCENES);
  const p = sc.make(rng);
  const pre = alt ? 'y ＝ ' : '';
  const c = `${pre}${sc.correct(p)}`;
  return {
    engine: 'choice',
    id: `expr${alt ? '-alt' : ''}:${sc.id}:${p.join(',')}`,
    objective: 'expr',
    level,
    prompt: alt
      ? `${sc.text(p)}${sc.what}を y${sc.yu}と して、x と yの 関係を 式に 表すと どれですか。`
      : `${sc.text(p)}${sc.what}を 表す 式は どれですか。`,
    hints: [
      sc.hint,
      '分からない 数の ところに xを 入れて、言葉の式を 文字の式に しよう。',
      `${sc.what}の 求め方を、x を 使って 書いて みよう。`,
    ],
    explain: `${sc.what}は ${sc.correct(p)}で 表せます。${sc.hint.replace('だね。', 'です。').replace('ね。', '。')}`,
    identity: `expr:${sc.id}:${p.join(',')}${alt ? ':y' : ''}`,
    alt,
    options: opts(
      c,
      sc.wrongs(p).map(([l, m]) => [`${pre}${l}`, m] as [string, string]),
    ),
  };
}

// ---- 式の 意味を 読む ----
interface ReadQ {
  key: string;
  ex: string;
  /** ことばの式 */
  words: string;
  correct: string;
  wrongs: [string, string][];
}
const READS: ReadQ[] = [];
for (let a = 2; a <= 5; a++) {
  READS.push({
    key: `xa+y:${a}`,
    ex: `x × ${a} ＋ y`,
    words: `えんぴつ 1本の ねだん × ${a} ＋ ノート 1冊の ねだん`,
    correct: `えんぴつ ${a}本と ノート 1冊の 代金`,
    wrongs: [
      [`えんぴつ 1本と ノート ${a}冊の 代金`, 'term-swap'],
      [`えんぴつと ノートを ${a}組 買った 代金`, 'paren'],
      [`えんぴつ ${a}本と ノート 1冊の 代金の ちがい`, 'op-swap'],
    ],
  });
  READS.push({
    key: `x+yb:${a}`,
    ex: `x ＋ y × ${a}`,
    words: `えんぴつ 1本の ねだん ＋ ノート 1冊の ねだん × ${a}`,
    correct: `えんぴつ 1本と ノート ${a}冊の 代金`,
    wrongs: [
      [`えんぴつ ${a}本と ノート 1冊の 代金`, 'term-swap'],
      [`えんぴつと ノートを ${a}組 買った 代金`, 'paren'],
      [`えんぴつ ${a}本と ノート ${a}冊の 代金`, 'paren'],
    ],
  });
  READS.push({
    key: `(x+y)a:${a}`,
    ex: `(x ＋ y) × ${a}`,
    words: `(えんぴつ 1本の ねだん ＋ ノート 1冊の ねだん) × ${a}`,
    correct: `えんぴつ 1本と ノート 1冊を 1組に して、${a}組 買った 代金`,
    wrongs: [
      [`えんぴつ 1本と ノート ${a}冊の 代金`, 'paren'],
      [`えんぴつ ${a}本と ノート 1冊の 代金`, 'paren'],
      [`えんぴつ 1本と ノート 1冊の 代金と ${a}円`, 'op-swap'],
    ],
  });
  READS.push({
    key: `1000-xa:${a}`,
    ex: `1000 − x × ${a}`,
    words: `1000 − えんぴつ 1本の ねだん × ${a}`,
    correct: `1000円 出して えんぴつを ${a}本 買った ときの おつり`,
    wrongs: [
      [`1000円 出して えんぴつを 1本 買った ときの おつり`, 'drop-term'],
      [`えんぴつ ${a}本と 1000円の 品物の 代金`, 'op-swap'],
      [`1000円を ${a}人で 分けた 1人分`, 'op-swap'],
    ],
  });
  for (let b = 2; b <= 5; b++)
    if (a !== b)
      READS.push({
        key: `xa+yb:${a},${b}`,
        ex: `x × ${a} ＋ y × ${b}`,
        words: `えんぴつ 1本の ねだん × ${a} ＋ ノート 1冊の ねだん × ${b}`,
        correct: `えんぴつ ${a}本と ノート ${b}冊の 代金`,
        wrongs: [
          [`えんぴつ ${b}本と ノート ${a}冊の 代金`, 'term-swap'],
          [`えんぴつと ノートを ${a + b}組 買った 代金`, 'paren'],
          [`えんぴつ ${a}本と ノート ${b}冊の 代金の ちがい`, 'op-swap'],
        ],
      });
}
READS.push({
  key: 'y-x',
  ex: 'y − x',
  words: 'ノート 1冊の ねだん − えんぴつ 1本の ねだん',
  correct: 'ノート 1冊が えんぴつ 1本より 何円 高いか',
  wrongs: [
    ['えんぴつ 1本と ノート 1冊の 代金', 'op-swap'],
    ['えんぴつ 1本が ノート 1冊より 何円 高いか', 'reverse-order'],
  ],
});

function readItem(level: number, rng: Rng, alt: boolean): ChoiceItem {
  const r = pick(rng, READS);
  const base = '1本 x円の えんぴつと、1冊 y円の ノートが あります。';
  if (alt) {
    // 言葉の式 → 文字の式
    const others = READS.filter(
      (o) => o.key !== r.key && o.key.split(':')[0] !== r.key.split(':')[0],
    );
    const near = READS.filter(
      (o) => o.key !== r.key && o.key.split(':')[0] === r.key.split(':')[0],
    );
    const w1 = near.length ? pick(rng, near) : pick(rng, others);
    const w2 = pick(
      rng,
      others.filter((o) => o.ex !== w1.ex),
    );
    // 誤りの式と 正しい式の ちがいで 誤概念を 決める（( )の 有無 → paren、ひき算か どうか → op-swap、それ以外は 組の 取りちがえ）
    const paren = (o: ReadQ) => o.key.startsWith('(x+y)');
    const minus = (o: ReadQ) => o.key.startsWith('1000') || o.key === 'y-x';
    const kindOf = (o: ReadQ) =>
      paren(o) !== paren(r) ? 'paren' : minus(o) !== minus(r) ? 'op-swap' : 'term-swap';
    return {
      engine: 'choice',
      id: `read-alt:${r.key}`,
      objective: 'read',
      level,
      prompt: `${base}「${r.words}」を 文字の 式で 表すと どれですか。`,
      hints: [
        'えんぴつ 1本の ねだんは x、ノート 1冊の ねだんは y だね。',
        '言葉の 式の ことばを、x と y に おきかえよう。',
        `「えんぴつ 1本の ねだん」を x に すると…`,
      ],
      explain: `「${r.words}」の ことばを x、y に おきかえると ${r.ex}です。`,
      identity: `read:${r.key}:words`,
      alt: true,
      options: opts(r.ex, [
        [w1.ex, kindOf(w1)],
        [w2.ex, kindOf(w2)],
      ]),
    };
  }
  return {
    engine: 'choice',
    id: `read:${r.key}`,
    objective: 'read',
    level,
    prompt: `${base}式 ${r.ex} は、何を 表して いますか。`,
    figure: expr(r.ex),
    hints: [
      'x は えんぴつ 1本の ねだん、y は ノート 1冊の ねだん だね。',
      `式を 言葉に もどすと「${r.words}」。`,
      'かけ算は 何本・何冊 買ったかを 表して いるよ。',
    ],
    explain: `${r.ex}は「${r.words}」なので、${r.correct}を 表して います。`,
    identity: `read:${r.key}`,
    alt: false,
    layout: 'column',
    options: opts(r.correct, r.wrongs),
  };
}

// ---- 式の 値 ----
function valueItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const a = rng.int(2, 9);
  const b = rng.int(1, 9) * 10;
  const x = alt ? rng.int(6, 15) * 10 : rng.int(2, 12);
  const y = x * a + b;
  const answer = { kind: 'int' as const, value: y };
  return {
    engine: 'number',
    id: `value${alt ? '-alt' : ''}:${a},${b},${x}`,
    objective: 'value',
    level,
    prompt: alt
      ? `1こ x円の パンを ${a}こと、${b}円の ジャムを 1つ 買います。代金は x × ${a} ＋ ${b}（円）です。パン 1こが ${x}円の とき、代金は 何円ですか。`
      : `y ＝ x × ${a} ＋ ${b} で、x が ${x}の とき、y の 値を 求めよう。`,
    figure: alt ? undefined : expr(`y ＝ ${x} × ${a} ＋ ${b} ＝ {{}}`),
    hints: [
      'x の ところに 数を あてはめよう。',
      `x × ${a} ＋ ${b} の x に ${x}を 入れると ${x} × ${a} ＋ ${b}。`,
      `かけ算を 先に 計算するよ。${x} × ${a} ＝ ${x * a}。`,
    ],
    explain: `${x} × ${a} ＋ ${b} ＝ ${x * a} ＋ ${b} ＝ ${y}。かけ算を 先に 計算します。`,
    identity: `value:${a},${b},${x}${alt ? ':scene' : ''}`,
    alt,
    fields: [{ label: alt ? '円' : undefined, answer }],
    wrongAnswers: wrongList(
      [answer],
      [
        [x * (a + b), 'order-ops'],
        [x * a, 'drop-term'],
        [x + a + b, 'op-swap'],
      ],
    ),
  };
}

// ---- x の 値を 求める ----
type Form = 'add' | 'sub' | 'mul' | 'div' | 'two';
const FORMS: Form[] = ['add', 'sub', 'mul', 'div', 'two'];
function solveItem(level: number, rng: Rng, alt: boolean): NumberItem {
  const form = alt ? pick(rng, ['add', 'sub', 'mul'] as const) : pick(rng, FORMS);
  let x: number;
  let a: number;
  let b: number;
  let c = 0;
  let eq: string;
  let inv: number | null;
  let step: string;
  switch (form) {
    case 'add':
      x = rng.int(12, 89);
      a = rng.int(11, 60);
      b = x + a;
      eq = `x ＋ ${a} ＝ ${b}`;
      inv = b + a;
      step = `x ＝ ${b} − ${a}`;
      break;
    case 'sub':
      a = rng.int(11, 60);
      b = rng.int(10, 80);
      x = a + b;
      eq = `x − ${a} ＝ ${b}`;
      inv = b - a;
      step = `x ＝ ${b} ＋ ${a}`;
      break;
    case 'mul':
      x = rng.int(3, 15);
      a = rng.int(3, 9);
      b = x * a;
      eq = `x × ${a} ＝ ${b}`;
      inv = b * a;
      step = `x ＝ ${b} ÷ ${a}`;
      break;
    case 'div':
      a = rng.int(2, 9);
      b = rng.int(3, 12);
      x = a * b;
      eq = `x ÷ ${a} ＝ ${b}`;
      inv = b % a === 0 ? b / a : null;
      step = `x ＝ ${b} × ${a}`;
      break;
    case 'two':
      x = rng.int(2, 12);
      a = rng.int(2, 9);
      c = rng.int(1, 9) * 10;
      b = x * a + c;
      eq = `x × ${a} ＋ ${c} ＝ ${b}`;
      inv = null;
      step = `x × ${a} ＝ ${b} − ${c} ＝ ${b - c}`;
      break;
  }
  const answer = { kind: 'int' as const, value: x };
  const scene =
    form === 'add'
      ? `x円 持って いました。おこづかいを ${a}円 もらったので、${b}円に なりました。はじめに 持って いた お金は 何円ですか。`
      : form === 'sub'
        ? `x mの リボンから ${a}m 使ったら、残りが ${b}mに なりました。はじめの リボンは 何mですか。`
        : `1こ x円の あめを ${a}こ 買ったら、代金は ${b}円でした。あめ 1この ねだんは 何円ですか。`;
  const unit = form === 'sub' ? 'm' : '円';
  return {
    engine: 'number',
    id: `solve${alt ? '-alt' : ''}:${eq}`,
    objective: 'solve',
    level,
    prompt: alt ? scene : `x に あてはまる 数を 求めよう。`,
    figure: alt
      ? form === 'mul'
        ? {
            kind: 'tape',
            parts: Array.from({ length: a }, (_, i) => ({
              length: 1,
              label: i === 0 ? 'x' : '',
              tone: i === 0 ? 'focus' : 'a',
            })),
            total: `${b}円`,
          }
        : {
            kind: 'tape',
            parts:
              form === 'add'
                ? [
                    { length: 3, label: 'x', tone: 'focus' },
                    { length: 2, label: `${a}円`, tone: 'b' },
                  ]
                : [
                    { length: 2, label: `${a}m`, tone: 'b' },
                    { length: 3, label: `${b}m`, tone: 'a' },
                  ],
            total: form === 'add' ? `${b}円` : 'x',
          }
      : expr(eq),
    hints: [
      alt ? 'テープ図で、x が どこに あたるか 見よう。' : 'x を 求めるには、反対の 計算を するよ。',
      form === 'add'
        ? `たし算の 反対は ひき算。${step}`
        : form === 'sub'
          ? `ひき算の 反対は たし算。${step}`
          : form === 'mul'
            ? `かけ算の 反対は わり算。${step}`
            : form === 'div'
              ? `わり算の 反対は かけ算。${step}`
              : `まず ${c}を ひいて、${step}`,
      form === 'two'
        ? `x × ${a} ＝ ${b - c} だから、x ＝ ${b - c} ÷ ${a}。`
        : `${step} を 計算しよう。`,
    ],
    explain:
      form === 'two'
        ? `${step}、x ＝ ${b - c} ÷ ${a} ＝ ${x}。たしかめ: ${x} × ${a} ＋ ${c} ＝ ${b}。`
        : `${step} ＝ ${x}。たしかめ: x に ${x}を 入れると ${eq.replace('x', String(x))} に なります。`,
    identity: `solve:${eq}${alt ? ':scene' : ''}`,
    alt,
    fields: [{ label: alt ? unit : 'x', answer }],
    wrongAnswers: wrongList(
      [answer],
      form === 'two'
        ? [
            [(b + c) % a === 0 ? (b + c) / a : null, 'inverse-miss'],
            [b - c, 'drop-term'],
            [Math.floor(b / a) === b / a ? b / a : null, 'drop-term'],
          ]
        : [[inv, 'inverse-miss']],
    ),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['expr', 'value'] },
  { objs: ['read', 'expr', 'value'] },
  { objs: ['solve', 'value'] },
  { objs: ['solve', 'read', 'expr', 'value'] },
];

export function generateLetters(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'expr':
      return exprItem(level, rng, alt);
    case 'read':
      return readItem(level, rng, alt);
    case 'value':
      return valueItem(level, rng, alt);
    case 'solve':
      return solveItem(level, rng, alt);
  }
}

export const letters: UnitSpec = finishUnit({
  id: 'g6.math.letters',
  title: '文字を 使った 式',
  stage: 'g6',
  subject: 'math',
  domain: 'A-number',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'math-formula-add',
  prereq: ['g4.math.change-relations'],
  objectives: [
    { id: 'expr', title: '場面を x を 使った 式に 表す' },
    { id: 'read', title: '式が 表す ことを 読む' },
    { id: 'value', title: 'x に 数を あてはめて 計算する' },
    { id: 'solve', title: 'x の 値を 求める' },
  ],
  misconceptions: [
    {
      id: 'op-swap',
      explain:
        '計算の 記号を まちがえたのかな。「何こ分」は かけ算、「あわせて」は たし算、「残り」は ひき算だよ。場面を 言葉の式に してから 考えよう。',
    },
    {
      id: 'reverse-order',
      explain:
        'ひく 数（わる 数）と ひかれる 数（わられる 数）を 反対に したのかな。ひき算・わり算は 順番を 入れかえると 意味が 変わるよ。',
    },
    {
      id: 'paren',
      explain:
        '( )の つけ方を まちがえたのかな。( )の 中は ひとまとまりで 先に 計算するよ。何を ひとまとまりと 見るか 場面で たしかめよう。',
    },
    {
      id: 'term-swap',
      explain: 'かける 数を 入れかえたのかな。何の ねだんを 何こ 買ったのか、組を たしかめよう。',
    },
    {
      id: 'area-perim',
      explain:
        '面積と まわりの 長さを 取りちがえたのかな。まわりの 長さは 辺の 長さを たし、面積は 縦《たて》 × 横《よこ》だよ。',
    },
    {
      id: 'side-count',
      explain:
        '辺の 数を まちがえたのかな。正三角形は 3つ、正方形は 4つ、正五角形は 5つの 辺が あるよ。',
    },
    {
      id: 'forget-half',
      explain:
        '三角形の 面積で ÷ 2を 忘れたのかな（長方形では ÷ 2は いらないよ）。形に 合う 公式を 使おう。',
    },
    {
      id: 'order-ops',
      explain:
        'たし算を 先に したのかな。かけ算と たし算が まじった 式は、かけ算を 先に 計算するよ。',
    },
    { id: 'drop-term', explain: '式の 一部を 計算し忘れたのかな。式の さいごまで 計算しよう。' },
    {
      id: 'inverse-miss',
      explain:
        'x を 求める ときに、式と 同じ 計算を したのかな。x ＋ 3 ＝ 10 なら x ＝ 10 − 3 のように、反対の 計算で x を 求めるよ。答えを 式に もどして たしかめよう。',
    },
  ],
  levels: [
    { label: '式に 表す・あてはめる', chance: 0.05 },
    { label: '式を 読む', chance: 0.05 },
    { label: 'x を 求める', chance: 0.05 },
    { label: 'まとめ', chance: 0.05 },
  ],
  intro: [
    {
      text: '1こ 120円の パンを 3こと 100円の 牛にゅうの 代金は 120 × 3 ＋ 100。パンの ねだんが 変わっても 同じ 形の 式に なります。',
      figure: expr('120 × 3 ＋ 100'),
    },
    {
      text: 'いろいろ 変わる 数の かわりに x を 使うと、1つの 式に まとめて 書けます。代金を y と すると、y ＝ x × 3 ＋ 100。',
      figure: expr('y ＝ x × 3 ＋ 100'),
    },
    {
      text: 'x が 150の ときは、y ＝ 150 × 3 ＋ 100 ＝ 550。x に 数を あてはめると 式の 値が 求められます。',
    },
    {
      text: 'x × 3 ＝ 450 の x は、かけ算の 反対の わり算で x ＝ 450 ÷ 3 ＝ 150。答えを 式に もどして たしかめます。',
      figure: expr('x × 3 ＝ 450 → x ＝ 450 ÷ 3'),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateLetters(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第6学年 A(2) 文字を用いた式（a、x などを用いた式）',
  revised: REVISED,
});
