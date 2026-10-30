/**
 * g3.math.abacus そろばん（curriculum-matrix 2.6・設計書 docs/expansion/p2-design/math-g34.md 2章）。
 * そろばんの数の表し方 → 珠の動かし方（直接）→ 5の あわせ → 10の あわせ → 大きな数・小数。
 *
 * abacus エンジンは無い。そろばんは図 kind 'svg'（abacus-svg.ts。数字の列から作る）で描き、
 * 答えは number（数を入れる）と choice（選択肢を図にする）で受ける。珠をタップで動かす操作は無い。
 *
 * 同一性キー: 問う形 × 数（'read:23.5'、'direct:45:1:in2'、'five:3＋4' など）。
 * 定義域: read 約11万、set 約7000、direct 900、five 20、ten 70（35＋35）、bigdec 約1700。
 */
import type { Rng } from '../../core/util/rng';
import type { ChoiceItem, ChoiceOption, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import {
  abacusFig,
  directAdd,
  directSub,
  fiveAsOne,
  fiveMissing,
  G3_READ,
  G3_SET,
  G3_SMALL,
  lowerAway,
  rodDigits,
  rodDigitsOrNull,
  shiftLeft,
  valueOf,
  zeroSkip,
  type AbacusLayout,
} from './abacus-svg';
import { kanjiNumber } from './large-numbers';
import { PLACE, pickObj, pickOne, tenths, wrongList, type Wrong } from './util';

type Obj = 'read' | 'set' | 'direct' | 'five' | 'ten' | 'bigdec';
type Op = '＋' | '−';

// ---- 小さな部品 ----

const P = (i: number) => PLACE[i]!;
const inOut = (op: Op) => (op === '＋' ? '入《い》れる' : 'はらう');
const inOutTe = (op: Op) => (op === '＋' ? '入《い》れて' : 'はらって');
const inOutRen = (op: Op) => (op === '＋' ? '入《い》れ' : 'はらい');
const apply = (a: number, op: Op, b: number) => (op === '＋' ? a + b : a - b);
const inv = (op: Op): Op => (op === '＋' ? '−' : '＋');
const dAt = (n: number, r: number) => Math.floor(n / 10 ** r) % 10;
const digitsOf = (n: number) => String(n).split('').map(Number);
const smallFig = (n: number, opt?: { lit?: boolean; mark?: number[] }): Figure =>
  abacusFig(G3_SMALL, rodDigits(G3_SMALL, n), opt);

function memo<T>(f: () => T): () => T {
  let v: T | undefined;
  return () => (v ??= f());
}

type Cand = [number[] | null, string | undefined];
/** 重なる図（同じ数字の列）を除いた候補。最初が正解。max 個まで */
function distinctCands(cands: Cand[], max = 4): [number[], string | undefined][] {
  const out: [number[], string | undefined][] = [];
  const seen = new Set<string>();
  for (const [ds, m] of cands) {
    if (!ds) continue;
    const k = ds.join('');
    if (seen.has(k)) continue;
    seen.add(k);
    if (out.length >= max) break;
    out.push([ds, m]);
  }
  return out;
}
/** 選択肢（図）。最初が正解、重なる図は除く。max 個まで */
function figOpts(layout: AbacusLayout, cands: Cand[], max = 4): ChoiceOption[] {
  return distinctCands(cands, max).map(([ds, m]) =>
    m
      ? { figure: abacusFig(layout, ds), misconception: m }
      : { figure: abacusFig(layout, ds), correct: true },
  );
}
const valDigits = (layout: AbacusLayout, n: number) => rodDigitsOrNull(layout, n);

// ---- 定義域 ----

/** 5の あわせ（20通り）: [a, op, b] */
const fiveList = memo(() => {
  const out: [number, Op, number][] = [];
  for (let a = 1; a <= 4; a++) for (let b = 1; b <= 4; b++) if (a + b >= 5) out.push([a, '＋', b]);
  for (let a = 5; a <= 9; a++) for (let b = 1; b <= 4; b++) if (a - 5 < b) out.push([a, '−', b]);
  return out;
});
export const FIVE_LIST = fiveList;

/** 10の あわせ（70通り）: [A, op, b]。たし算は A=a（一の位）、ひき算は A=10+a1 */
const tenList = memo(() => {
  const out: [number, Op, number][] = [];
  for (let a = 1; a <= 9; a++)
    for (let b = 1; b <= 9; b++) if (a + b >= 10 && directSub(a, 10 - b)) out.push([a, '＋', b]);
  for (let a1 = 0; a1 <= 8; a1++)
    for (let b = a1 + 1; b <= 9; b++) if (directAdd(a1, 10 - b)) out.push([10 + a1, '−', b]);
  return out;
});
export const TEN_LIST = tenList;

/** 直接の動かし方（900通り） */
export interface DirectCase {
  a: number;
  r: 0 | 1;
  kind: 'in' | 'out' | 'fin' | 'fout';
  k: number;
}
const directList = memo(() => {
  const out: DirectCase[] = [];
  for (let a = 10; a <= 99; a++)
    for (const r of [0, 1] as const) {
      const d = dAt(a, r);
      for (let k = 1; k <= 4; k++) {
        if ((d % 5) + k <= 4) out.push({ a, r, kind: 'in', k });
        if (d % 5 >= k) out.push({ a, r, kind: 'out', k });
      }
      if (d < 5) out.push({ a, r, kind: 'fin', k: 5 });
      else out.push({ a, r, kind: 'fout', k: 5 });
    }
  return out;
});
export const DIRECT_LIST = directList;
export const mvCode = (c: DirectCase) =>
  c.kind === 'in'
    ? `in${c.k}`
    : c.kind === 'out'
      ? `out${c.k}`
      : c.kind === 'fin'
        ? 'f-in'
        : 'f-out';

/** direct-alt: 選択肢の候補（最初が正解） */
function directAltCands(a: number, op: Op, b: number): Cand[] {
  const res = apply(a, op, b);
  const ds = valDigits(G3_SMALL, res);
  if (!ds) return [];
  const shifted = b < 10 ? b * 10 : b / 10;
  const sv = apply(a, op, shifted);
  const iv = apply(a, inv(op), b);
  return [
    [ds, undefined],
    [sv >= 0 && sv <= 99 ? valDigits(G3_SMALL, sv) : null, 'place-shift'],
    [iv >= 0 && iv <= 99 ? valDigits(G3_SMALL, iv) : null, 'in-out'],
    [lowerAway(G3_SMALL, ds), 'lower-away'],
  ];
}
export interface DirectAltCase {
  a: number;
  op: Op;
  b: number;
}
const directAltList = memo(() => {
  const out: DirectAltCase[] = [];
  const bs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90];
  for (let a = 10; a <= 99; a++)
    for (const b of bs) {
      const r = b < 10 ? 0 : 1;
      const e = b < 10 ? b : b / 10;
      const d = dAt(a, r);
      for (const op of ['＋', '−'] as const) {
        if (!(op === '＋' ? directAdd(d, e) : directSub(d, e))) continue;
        if (op === '−' && a - b < 0) continue;
        if (distinctCands(directAltCands(a, op, b)).length >= 3) out.push({ a, op, b });
      }
    }
  return out;
});
export const DIRECT_ALT_LIST = directAltList;

/** set: 選択肢の候補（条件を満たさなければ null） */
function setCands(n: number): Cand[] | null {
  const ds = digitsOf(n);
  if (!ds.some((d) => d >= 5)) return null;
  if (!ds.some((d) => d % 5 !== 2)) return null;
  const dg = rodDigits(G3_SET, n * 10);
  const cands: Cand[] = [
    [dg, undefined],
    [shiftLeft(dg), 'place-shift'],
    [fiveMissing(dg), 'five-missing'],
    [lowerAway(G3_SET, dg), 'lower-away'],
  ];
  return distinctCands(cands).length === 4 ? cands : null;
}
const set3List = memo(() => {
  const out: number[] = [];
  for (let n = 100; n <= 9999; n++) if (setCands(n)) out.push(n);
  return out;
});
export const SET3_LIST = set3List;

// ---- read: 数を読む ----

const placeNames = (n: number) =>
  digitsOf(n)
    .map((d, i, all) => `${P(all.length - 1 - i)}の くらいが ${d}`)
    .join('、');

function lastHint(s: string): string {
  return s.length === 1
    ? '五《ご》だまが ついて いたら 5、それに 一《いち》だまの 数《かず》を 足《た》そう。'
    : `上《うえ》の けたから ${s.slice(0, -1).split('').join('、')}。さいごの けたは いくつかな。`;
}

function readInt(level: number, rng: Rng): number {
  if (level === 0) return rng.int(1, 99);
  const L = pickOne(rng, [2, 3, 4, 5] as const);
  return rng.int(10 ** (L - 1), 10 ** L - 1);
}

function readValueWrongs(
  ds: number[],
  ans: number,
  fmt: (units: number) => string,
  shiftValue: string | number,
): Wrong[] {
  const zs = zeroSkip(G3_READ, ds);
  return wrongList(fmt(ans), 1, [
    [fmt(valueOf(fiveAsOne(G3_READ, ds))), 'five-as-one'],
    [fmt(valueOf(lowerAway(G3_READ, ds))), 'lower-away'],
    [shiftValue, 'place-shift'],
    [zs ? fmt(valueOf(zs)) : null, 'zero-skip'],
  ]);
}

function readIntItem(level: number, n: number): NumberItem {
  const ds = rodDigits(G3_READ, n * 10);
  const L = String(n).length;
  const fig = abacusFig(G3_READ, ds);
  return {
    engine: 'number',
    id: `read:${n}`,
    objective: 'read',
    level,
    prompt: 'この そろばんの 数《かず》は いくつ？',
    figure: fig,
    hints: [
      'はりに くっついた たまだけを 数《かぞ》えよう。▲の けたが 一《いち》の くらいだよ。',
      `数《かず》の ある いちばん 左《ひだり》の けたは ${P(L - 1)}の くらいだよ。`,
      lastHint(String(n)),
    ],
    explain: `${placeNames(n)}。たまが ない けたは 0なので、${n}です。`,
    explainFigure: abacusFig(G3_READ, ds, { lit: true }),
    identity: `read:${n}`,
    fields: [{ answer: { kind: 'int', value: n } }],
    wrongAnswers: readValueWrongs(ds, n * 10, (u) => String(u / 10), n * 10),
  };
}

function readDecItem(level: number, t: number): NumberItem {
  const ds = rodDigits(G3_READ, t);
  const v = tenths(t);
  const whole = Math.floor(t / 10);
  const frac = t % 10;
  return {
    engine: 'number',
    id: `read:${v}`,
    objective: 'read',
    level,
    prompt: 'この そろばんの 数《かず》は いくつ？',
    figure: abacusFig(G3_READ, ds),
    hints: [
      'はりに くっついた たまだけを 数《かぞ》えよう。▲の けたが 一《いち》の くらいだよ。',
      '▲の すぐ 右《みぎ》の けたは、0.1が いくつ あるかを あらわすよ。',
      lastHint(String(t)),
    ],
    explain: `${whole > 0 ? `${placeNames(whole)}、` : ''}▲の 右《みぎ》の けたが ${frac}で、${v}です。`,
    explainFigure: abacusFig(G3_READ, ds, { lit: true }),
    identity: `read:${v}`,
    keys: ['decimal'],
    fields: [{ answer: { kind: 'decimal', value: Number(v) } }],
    wrongAnswers: readValueWrongs(ds, t, tenths, t),
  };
}

function readTableItem(level: number, n: number): NumberItem {
  const ds = rodDigits(G3_READ, n * 10);
  const digs = digitsOf(n);
  const L = digs.length;
  const names = digs.map((_, i) => P(L - 1 - i));
  const five = digs.map((d) => (d >= 5 ? '入《はい》る' : '－'));
  const ones = digs.map((d) => `${d % 5}こ`);
  const zs = zeroSkip(G3_READ, ds);
  return {
    engine: 'number',
    id: `read-table:${n}`,
    objective: 'read',
    level,
    prompt: 'たまの ようすを 表《ひょう》に しました。この 数《かず》は いくつ？',
    figure: {
      kind: 'table',
      header: ['', ...names],
      rows: [
        ['五《ご》だま', ...five],
        ['一《いち》だま', ...ones],
      ],
    },
    hints: [
      '五《ご》だまが 入《はい》って いると 5、一《いち》だまは 1こで 1だよ。',
      `${P(L - 1)}の くらいは ${digs[0]}。`,
      'のこりの けたも 1つずつ 数字《すうじ》に しよう。「－」と「0こ」の けたは 0だよ。',
    ],
    explain: `${digs.map((d, i) => `${names[i]}の くらいは ${d}`).join('、')}。だから ${n}です。`,
    explainFigure: abacusFig(G3_READ, ds, { lit: true }),
    identity: `read-table:${n}`,
    alt: true,
    fields: [{ answer: { kind: 'int', value: n } }],
    wrongAnswers: wrongList(String(n), 1, [
      [valueOf(fiveAsOne(G3_READ, ds)) / 10, 'five-as-one'],
      [n * 10, 'place-shift'],
      [zs ? valueOf(zs) / 10 : null, 'zero-skip'],
    ]),
  };
}

function genRead(level: number, rng: Rng, alt: boolean): Item {
  if (alt && level >= 1) return readTableItem(level, readInt(1, rng));
  if (level === 3 && rng.next() < 0.5) {
    let t: number;
    do t = rng.int(1, 999);
    while (t % 10 === 0);
    return readDecItem(level, t);
  }
  return readIntItem(level, readInt(level, rng));
}

// ---- set: 数を おく ----

const descOf = (d: number) =>
  d === 0
    ? 'たまなし'
    : d < 5
      ? `一《いち》だま ${d}こ`
      : d === 5
        ? '五《ご》だま'
        : `五《ご》だまと 一《いち》だま ${d - 5}こ`;

function genSet(level: number, rng: Rng, alt: boolean): ChoiceItem {
  const n = pickOne(rng, set3List());
  const cands = setCands(n)!;
  const digs = digitsOf(n);
  const L = digs.length;
  const parts = digs.map((d, i) => `${P(L - 1 - i)}の くらいは ${d}（${descOf(d)}）`).join('、');
  return {
    engine: 'choice',
    id: `set${alt ? '-kanji' : ''}:${n}`,
    objective: 'set',
    level,
    prompt: alt
      ? '漢字《かんじ》で 書《か》いた 数《かず》を おいた そろばんは どれ？'
      : `${n}を おいた そろばんは どれ？`,
    figure: alt ? { kind: 'text', text: kanjiNumber(n), size: 'xl' } : undefined,
    hints: [
      '▲の けたが 一《いち》の くらい。そこから 左《ひだり》へ くらいを 数《かぞ》えよう。',
      `${n}は ${L}けた。いちばん 上《うえ》は ${P(L - 1)}の くらいで ${digs[0]}。`,
      '5から 9の 数字《すうじ》の けたは、五《ご》だまが はりに ついて いるかを 見《み》よう。',
    ],
    explain: `${alt ? `数字《すうじ》で 書《か》くと ${n}。` : ''}▲の けたが 一《いち》の くらい。${parts}。`,
    explainFigure: abacusFig(G3_SET, cands[0]![0]!, { lit: true }),
    identity: `set${alt ? '-kanji' : ''}:${n}`,
    alt,
    layout: 'grid',
    options: figOpts(G3_SET, cands),
  };
}

// ---- direct: たまを入れる・はらう ----

function genDirect(level: number, rng: Rng, alt: boolean): Item {
  if (alt) return genDirectAlt(level, rng);
  const c = pickOne(rng, directList());
  const { a, r, kind, k } = c;
  const plus = kind === 'in' || kind === 'fin';
  const op: Op = plus ? '＋' : '−';
  const d = dAt(a, r);
  const e = k;
  const unit = 10 ** r;
  const ans = apply(a, op, e * unit);
  const mvText =
    kind === 'in'
      ? `一《いち》だまを ${k}こ 入《い》れる`
      : kind === 'out'
        ? `一《いち》だまを ${k}こ はらう`
        : kind === 'fin'
          ? '五《ご》だまを 入《い》れる'
          : '五《ご》だまを はらう';
  const sh = apply(a, op, e * 10 ** (1 - r));
  const io = apply(a, inv(op), e * unit);
  return {
    engine: 'number',
    id: `direct:${a}:${r}:${mvCode(c)}`,
    objective: 'direct',
    level,
    prompt: `${P(r)}の くらいで、${mvText}。いくつに なる？`,
    figure: smallFig(a),
    hints: [
      '入《い》れると たす、はらうと ひく だよ。',
      `うごくのは ${P(r)}の くらいの たま。いまは ${d}だよ。`,
      `${P(r)}の くらいは ${d} ${op} ${e}に なるよ。ほかの けたは そのまま。`,
    ],
    explain: `${P(r)}の くらいの ${d}が ${apply(d, op, e)}に なります。答《こた》えは ${ans}です。`,
    explainFigure: smallFig(ans, { lit: true, mark: [G3_SMALL.unitRod - r] }),
    identity: `direct:${a}:${r}:${mvCode(c)}`,
    fields: [{ answer: { kind: 'int', value: ans } }],
    wrongAnswers: wrongList(String(ans), 1, [
      [sh >= 0 && sh <= 99 ? sh : null, 'place-shift'],
      [io >= 0 ? io : null, 'in-out'],
      [kind === 'fin' || kind === 'fout' ? apply(a, op, unit) : null, 'five-as-one'],
    ]),
  };
}

function genDirectAlt(level: number, rng: Rng): ChoiceItem {
  const { a, op, b } = pickOne(rng, directAltList());
  const r = b < 10 ? 0 : 1;
  const e = b < 10 ? b : b / 10;
  const d = dAt(a, r);
  const ans = apply(a, op, b);
  return {
    engine: 'choice',
    id: `direct-alt:${a}${op}${b}`,
    objective: 'direct',
    level,
    prompt: `${a} ${op} ${b} を した あとの そろばんは どれ？`,
    figure: smallFig(a),
    hints: [
      `${b}は ${b < 10 ? '一《いち》' : '十《じゅう》'}の くらいの たまを うごかすよ。`,
      'たす ときは 入《い》れる、ひく ときは はらう。',
      `${P(r)}の くらいが ${d} ${op} ${e}に なった そろばんを さがそう。`,
    ],
    explain: `${P(r)}の くらいで ${e}を ${inOutTe(op)}、${a} ${op} ${b} ＝ ${ans}。`,
    explainFigure: smallFig(ans, { lit: true, mark: [G3_SMALL.unitRod - r] }),
    identity: `direct-alt:${a}${op}${b}`,
    alt: true,
    layout: 'grid',
    options: figOpts(G3_SMALL, directAltCands(a, op, b)),
  };
}

// ---- five: 5の あわせ ----

function genFive(level: number, rng: Rng, alt: boolean): Item {
  const [a, op, b] = pickOne(rng, fiveList());
  const plus = op === '＋';
  const c = 5 - b;
  const ans = apply(a, op, b);
  const hints = plus
    ? [
        `一《いち》だまは あと ${4 - a}こしか 入《はい》らないね。`,
        `5を 入《い》れると、${b}より 多《おお》く 入《い》れた ことに なるよ。`,
        `${b} と □ で 5。□を はらうよ。`,
      ]
    : [
        `一《いち》だまは ${a - 5}こしか ないので、${b}こは はらえないね。`,
        '5を はらうと ひきすぎるので、ひきすぎた ぶんを 入《い》れて おくよ。',
        `${b} と □ で 5。□を 入《い》れるよ。`,
      ];
  const explain = plus
    ? `${b}は 5より ${c} 小《ちい》さい。だから 5を 入《い》れて ${c}を はらいます。${a} ＋ ${b} ＝ ${ans}。`
    : `${b}は 5より ${c} 小《ちい》さい。だから ${c}を 入《い》れて 5を はらいます。${a} − ${b} ＝ ${ans}。`;
  const start = abacusFig(G3_SMALL, [0, 0, 0, a]);
  const lit = abacusFig(G3_SMALL, [0, 0, 0, ans], { lit: true });
  if (alt) {
    const cands: Cand[] = plus
      ? [
          [valDigits(G3_SMALL, ans), undefined],
          [valDigits(G3_SMALL, a + 5), 'half-move'],
          [valDigits(G3_SMALL, a + 5 - b), 'complement-same'],
          [valDigits(G3_SMALL, a - c), 'half-move'],
        ]
      : [
          [valDigits(G3_SMALL, ans), undefined],
          [valDigits(G3_SMALL, a - 5), 'half-move'],
          [valDigits(G3_SMALL, a - 5 + b), 'complement-same'],
          [valDigits(G3_SMALL, a + c), 'half-move'],
        ];
    return {
      engine: 'choice',
      id: `five-alt:${a}${op}${b}`,
      objective: 'five',
      level,
      prompt: `${a} ${op} ${b} を した あとの そろばんは どれ？`,
      figure: start,
      hints: [
        hints[0]!,
        hints[1]!,
        '五《ご》だまと 一《いち》だまの 両方《りょうほう》が うごいた そろばんを さがそう。',
      ],
      explain,
      explainFigure: lit,
      identity: `five-alt:${a}${op}${b}`,
      alt: true,
      layout: 'grid',
      options: figOpts(G3_SMALL, cands),
    };
  }
  return {
    engine: 'number',
    id: `five:${a}${op}${b}`,
    objective: 'five',
    level,
    prompt: plus
      ? `${a} ＋ ${b}。五《ご》だまを 入《い》れて、一《いち》だまを いくつ はらう？`
      : `${a} − ${b}。一《いち》だまを いくつ 入《い》れて、五《ご》だまを はらう？`,
    figure: start,
    hints,
    explain,
    explainFigure: lit,
    identity: `five:${a}${op}${b}`,
    fields: [{ answer: { kind: 'int', value: c }, unit: 'こ' }],
    wrongAnswers: wrongList(String(c), 1, [
      [b, 'complement-same'],
      [10 - b, 'complement-mix'],
    ]),
  };
}

// ---- ten: 10の あわせ ----

function genTen(level: number, rng: Rng, alt: boolean): Item {
  const [A, op, b] = pickOne(rng, tenList());
  const plus = op === '＋';
  const c = 10 - b;
  const ans = apply(A, op, b);
  const a1 = A % 10;
  const hints = plus
    ? [
        `${A} ＋ ${b}は 10を こえるね。`,
        '十《じゅう》の くらいに 1 入《い》れると、10 たした ことに なるよ。',
        `${b} と □ で 10。□を はらうよ。`,
      ]
    : [
        `一《いち》の くらいの ${a1}から ${b}は ひけないね。`,
        '十《じゅう》の くらいで 1 はらうと、10 ひいた ことに なるよ。',
        `${b} と □ で 10。□を 入《い》れるよ。`,
      ];
  const explain = plus
    ? `${b}は 10より ${c} 小《ちい》さい。十《じゅう》の くらいに 1 入《い》れて、一《いち》の くらいから ${c}を はらいます。${A} ＋ ${b} ＝ ${ans}。`
    : `${b}は 10より ${c} 小《ちい》さい。十《じゅう》の くらいで 1 はらって、一《いち》の くらいに ${c}を 入《い》れます。${A} − ${b} ＝ ${ans}。`;
  const start = smallFig(A);
  const lit = smallFig(ans, { lit: true, mark: [2, 3] });
  if (alt) {
    const cands: Cand[] = plus
      ? [
          [valDigits(G3_SMALL, ans), undefined],
          [valDigits(G3_SMALL, A + 10), 'half-move'],
          [valDigits(G3_SMALL, A + 10 - b), 'complement-same'],
          [valDigits(G3_SMALL, A - c), 'half-move'],
        ]
      : [
          [valDigits(G3_SMALL, ans), undefined],
          [valDigits(G3_SMALL, A - 10), 'half-move'],
          [valDigits(G3_SMALL, A - 10 + b), 'complement-same'],
          [valDigits(G3_SMALL, A + c), 'half-move'],
        ];
    return {
      engine: 'choice',
      id: `ten-alt:${A}${op}${b}`,
      objective: 'ten',
      level,
      prompt: `${A} ${op} ${b} を した あとの そろばんは どれ？`,
      figure: start,
      hints: [
        hints[0]!,
        hints[1]!,
        '十《じゅう》の くらいと 一《いち》の くらいの 両方《りょうほう》が うごいた そろばんを さがそう。',
      ],
      explain,
      explainFigure: lit,
      identity: `ten-alt:${A}${op}${b}`,
      alt: true,
      layout: 'grid',
      options: figOpts(G3_SMALL, cands),
    };
  }
  return {
    engine: 'number',
    id: `ten:${A}${op}${b}`,
    objective: 'ten',
    level,
    prompt: plus
      ? `${A} ＋ ${b}。十《じゅう》の くらいに 1 入《い》れたら、一《いち》の くらいで いくつ はらう？`
      : `${A} − ${b}。十《じゅう》の くらいで 1 はらったら、一《いち》の くらいに いくつ 入《い》れる？`,
    figure: start,
    hints,
    explain,
    explainFigure: lit,
    identity: `ten:${A}${op}${b}`,
    fields: [{ answer: { kind: 'int', value: c } }],
    wrongAnswers: wrongList(String(c), 1, [
      [b, 'complement-same'],
      [b < 5 ? 5 - b : null, 'complement-mix'],
      [b > 5 ? b - 5 : null, 'complement-mix'],
    ]),
  };
}

// ---- bigdec: 大きな数・小数 ----

/** 位置の札（pos: ▲から左へ いくつ。0 は ▲の けた、−1 は 右へ 1つ） */
const posLabel = (pos: number) =>
  pos >= 1 ? `▲から ${pos}つ 左《ひだり》` : pos === 0 ? '▲の けた' : '▲の 1つ 右《みぎ》';

const bigPairs = memo(() => {
  const out: [number, Op, number][] = [];
  for (let a = 1; a <= 9; a++)
    for (let b = 1; b <= 9; b++) {
      out.push([a, '＋', b]);
      if (a > b) out.push([a, '−', b]);
    }
  return out;
});
export const BIG_PAIRS = bigPairs;

const decPairs = memo(() => {
  const out: [number, Op, number][] = [];
  for (let at = 1; at <= 99; at++)
    for (let bt = 1; bt <= 9; bt++) {
      out.push([at, '＋', bt]);
      if (at > bt) out.push([at, '−', bt]);
    }
  return out;
});
export const DEC_PAIRS = decPairs;

function genBigDec(level: number, rng: Rng, alt: boolean): Item {
  const isBig = rng.next() < 0.5;
  if (isBig) {
    const u = pickOne(rng, [100, 1000, 10000] as const);
    const [a, op, b] = pickOne(rng, bigPairs());
    return bigItem(level, u, a, op, b, alt);
  }
  const [at, op, bt] = pickOne(rng, decPairs());
  return decItem(level, at, op, bt, alt);
}

function rodItem(
  level: number,
  idKey: string,
  A: string,
  op: Op,
  B: string,
  b: number,
  dec: boolean,
  k: number,
  explainFig: Figure,
  figure: Figure,
): ChoiceItem {
  const correct = dec ? -1 : k;
  const wrongs: [number, string][] = [];
  const add = (p: number, m: string) => {
    if (p < -1 || p > 4 || p === correct || wrongs.some(([q]) => q === p)) return;
    wrongs.push([p, m]);
  };
  add(0, 'unit-point');
  add(correct - 1, 'place-shift');
  add(correct + 1, 'place-shift');
  for (let dist = 2; wrongs.length < 2 && dist <= 5; dist++) {
    add(correct - dist, 'place-shift');
    add(correct + dist, 'place-shift');
  }
  const all: [number, string | undefined][] = [[correct, undefined], ...wrongs.slice(0, 3)];
  all.sort((x, y) => y[0] - x[0]);
  return {
    engine: 'choice',
    id: `bigdec-rod:${idKey}:${b}:${A}${op}${B}`,
    objective: 'bigdec',
    level,
    prompt: `${A} ${op} ${B} で、${b}を ${inOut(op)} けたは どこ？`,
    figure,
    hints: [
      '▲の けたが 一《いち》の くらいだよ。',
      `${B}の ${b}は ${dec ? '0.1が いくつ' : `${P(k)}の くらい`}を あらわすよ。`,
      '一《いち》の くらいから 1けたずつ 数《かぞ》えて みよう。',
    ],
    explain: `${b}は ${dec ? '▲の すぐ 右《みぎ》の けたの 数字《すうじ》' : `${P(k)}の くらいの 数字《すうじ》`}なので、${posLabel(correct)}の けたで ${inOutRen(op)}ます。`,
    explainFigure: explainFig,
    identity: `bigdec-rod:${idKey}:${b}`,
    alt: true,
    fixedOrder: true,
    layout: 'column',
    options: all.map(([p, m]) =>
      m ? { label: posLabel(p), misconception: m } : { label: posLabel(p), correct: true },
    ),
  };
}

function bigItem(level: number, u: number, a: number, op: Op, b: number, alt: boolean): Item {
  const A = a * u;
  const B = b * u;
  const k = String(u).length - 1;
  const small = apply(a, op, b);
  const ans = small * u;
  const fig = abacusFig(G3_READ, rodDigits(G3_READ, A * 10));
  const lit = abacusFig(G3_READ, rodDigits(G3_READ, ans * 10), {
    lit: true,
    mark: [G3_READ.unitRod - k],
  });
  if (alt) return rodItem(level, String(u), String(A), op, String(B), b, false, k, lit, fig);
  const io = apply(a, inv(op), b) * u;
  return {
    engine: 'number',
    id: `big:${A}${op}${B}`,
    objective: 'bigdec',
    level,
    prompt: `${A} ${op} ${B} を そろばんで しよう。答《こた》えは？`,
    figure: fig,
    hints: [
      `${A}の ${a}は、▲から ${k}つ 左《ひだり》の けた（${P(k)}の くらい）に あるよ。`,
      `${B}も 同《おな》じ けたで ${b}を ${inOut(op)}よ。うごかし方《かた》は ${a} ${op} ${b} と 同《おな》じ。`,
      `${a} ${op} ${b} の 答《こた》えを ${P(k)}の くらいから おいた 数《かず》だよ。`,
    ],
    explain: `${a} ${op} ${b} ＝ ${small} と 同《おな》じ うごかし方《かた》を、${P(k)}の くらいで します。${A} ${op} ${B} ＝ ${ans}。`,
    explainFigure: lit,
    identity: `big:${A}${op}${B}`,
    fields: [{ answer: { kind: 'int', value: ans } }],
    wrongAnswers: wrongList(String(ans), 1, [
      [small, 'unit-point'],
      [ans * 10, 'place-shift'],
      [ans / 10, 'place-shift'],
      [io >= 0 ? io : null, 'in-out'],
    ]),
  };
}

function decItem(level: number, at: number, op: Op, bt: number, alt: boolean): Item {
  const A = tenths(at);
  const B = tenths(bt);
  const rt = apply(at, op, bt);
  const ans = tenths(rt);
  const fig = abacusFig(G3_READ, rodDigits(G3_READ, at));
  const lit = abacusFig(G3_READ, rodDigits(G3_READ, rt), {
    lit: true,
    mark: [G3_READ.unitRod + 1],
  });
  if (alt) return rodItem(level, 'dec', A, op, B, bt, true, 0, lit, fig);
  const io = apply(at, inv(op), bt);
  return {
    engine: 'number',
    id: `dec:${A}${op}${B}`,
    objective: 'bigdec',
    level,
    prompt: `${A} ${op} ${B} を そろばんで しよう。答《こた》えは？`,
    figure: fig,
    hints: [
      '▲の けたが 一《いち》の くらい。その すぐ 右《みぎ》が 0.1の いくつ分《ぶん》の けただよ。',
      `${B}は 0.1が ${bt}こ。▲の すぐ 右《みぎ》の けたで ${bt}を ${inOut(op)}よ。`,
      `0.1が ${at} ${op} ${bt}こ ぶんの 数《かず》に なるよ。`,
    ],
    explain: `0.1が ${at}こと ${bt}こ。▲の 右《みぎ》の けたで ${bt}を ${inOutTe(op)}、${A} ${op} ${B} ＝ ${ans}です。`,
    explainFigure: lit,
    identity: `dec:${A}${op}${B}`,
    keys: ['decimal'],
    fields: [{ answer: { kind: 'decimal', value: Number(ans) } }],
    wrongAnswers: wrongList(ans, 1, [
      [rt, 'unit-point'],
      [String(Number((rt / 100).toFixed(2))), 'place-shift'],
      [io >= 0 ? tenths(io) : null, 'in-out'],
    ]),
  };
}

// ---- 単元 ----

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['read', 'set', 'direct'] },
  { objs: ['five', 'direct', 'read'] },
  { objs: ['ten', 'five', 'set'] },
  { objs: ['bigdec', 'ten', 'read'] },
];

export function generateAbacus(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.25;
  switch (obj) {
    case 'read':
      return genRead(level, rng, alt);
    case 'set':
      return genSet(level, rng, alt);
    case 'direct':
      return genDirect(level, rng, alt);
    case 'five':
      return genFive(level, rng, alt);
    case 'ten':
      return genTen(level, rng, alt);
    case 'bigdec':
      return genBigDec(level, rng, alt);
  }
}

export const abacus: UnitSpec = {
  id: 'g3.math.abacus',
  title: 'そろばん',
  stage: 'g3',
  subject: 'math',
  domain: 'A-number',
  kind: 'concept',
  priority: 'P2',
  status: 'ready',
  icon: 'subj-sansu',
  prereq: ['g3.math.large-numbers'],
  objectives: [
    { id: 'read', title: 'そろばんの 数《かず》を 読《よ》む' },
    { id: 'set', title: '数《かず》を そろばんに おく' },
    { id: 'direct', title: 'たまを 入《い》れる・はらう（たし算《ざん》・ひき算《ざん》）' },
    { id: 'five', title: '5の あわせ（五《ご》だまを つかう 計算《けいさん》）' },
    { id: 'ten', title: '10の あわせ（くり上《あ》がり・くり下《さ》がり）' },
    { id: 'bigdec', title: '大《おお》きな 数《かず》・小数《しょうすう》の 計算《けいさん》' },
  ],
  misconceptions: [
    {
      id: 'five-as-one',
      explain: '五《ご》だまを 1と 数《かぞ》えたのかな。上《うえ》の 五《ご》だまは 1こで 5だよ。',
      figure: abacusFig(G3_SMALL, rodDigits(G3_SMALL, 7), { lit: true }),
    },
    {
      id: 'lower-away',
      explain:
        'はりから はなれた たまを 数《かぞ》えたのかな。はりに くっついた たまだけを 数《かぞ》えよう。',
    },
    {
      id: 'five-missing',
      explain:
        '五《ご》だまを 入《い》れわすれたのかな。5から 9の 数字《すうじ》は、五《ご》だまを 入《い》れてから 一《いち》だまを 足《た》すよ。',
    },
    {
      id: 'place-shift',
      explain:
        'けたが 1つ ずれたのかな。▲の けたが 一《いち》の くらい。そこから 左《ひだり》へ 十《じゅう》・百《ひゃく》・千《せん》と 数《かぞ》えよう。',
    },
    {
      id: 'zero-skip',
      explain:
        '何《なに》も ない けたを とばしたのかな。たまが はりに ついて いない けたは 0だよ。',
    },
    {
      id: 'unit-point',
      explain:
        '▲の けたを まちがえたのかな。うごかす けたが ▲から いくつ 左《ひだり》か 右《みぎ》かで、数《かず》の 大《おお》きさが きまるよ。',
    },
    {
      id: 'in-out',
      explain:
        '入《い》れると はらうを 反対《はんたい》に したのかな。たす ときは はりに 入《い》れる、ひく ときは はりから はらうよ。',
    },
    {
      id: 'complement-same',
      explain:
        'たす 数《かず》や ひく 数《かず》を、そのまま はらったり 入《い》れたり したのかな。5や 10を 入《い》れすぎた ぶんだけ はらうよ。4 ＋ 3 なら、5を 入《い》れて 2を はらう。',
      figure: { kind: 'text', text: '3 ＝ 5 − 2', size: 'l' },
    },
    {
      id: 'complement-mix',
      explain:
        '5の あわせと 10の あわせを まちがえたのかな。五《ご》だまを つかう ときは 5の あわせ、となりの けたに 1 入《い》れる ときは 10の あわせだよ。',
    },
    {
      id: 'half-move',
      explain:
        'たまの うごかし方《かた》が とちゅうで おわったのかな。5や 10を 入《い》れたら、多《おお》い ぶんを はらう ところまで しよう。',
    },
  ],
  levels: [
    { label: 'そろばんの 数', chance: 0.05 },
    { label: '5の あわせ', chance: 0.05 },
    { label: '10の あわせ', chance: 0.05 },
    { label: '大きな数・小数', chance: 0.05 },
  ],
  intro: [
    {
      text: 'そろばんの 上《うえ》の たまを 五《ご》だま、下《した》の たまを 一《いち》だまと いいます。まん中《なか》の 横《よこ》の ぼうが はりです。',
      figure: abacusFig(G3_SMALL, [0, 0, 0, 0]),
    },
    {
      text: 'はりに くっついた たまだけを 数《かぞ》えます。五《ご》だまは 5、一《いち》だまは 1こで 1。この けたは 5と 2で 7です。',
      figure: abacusFig(G3_SMALL, [0, 0, 0, 7], { lit: true }),
    },
    {
      text: '▲の けたが 一《いち》の くらい。左《ひだり》へ 十《じゅう》・百《ひゃく》・千《せん》の くらい。たまが はりに ついて いない けたは 0です。',
      figure: {
        kind: 'column',
        items: [
          abacusFig(G3_SMALL, [3, 0, 5, 2], { lit: true }),
          { kind: 'text', text: '3052', size: 'xl' },
        ],
      },
    },
    {
      text: 'たす ときは たまを はりに 入《い》れ、ひく ときは はらいます。3 ＋ 4 は、五《ご》だまを 入《い》れて 一《いち》だまを 1こ はらいます（4 ＝ 5 − 1）。',
      figure: {
        kind: 'row',
        items: [
          abacusFig(G3_SMALL, [0, 0, 0, 3]),
          { kind: 'text', text: '→', size: 'l' },
          abacusFig(G3_SMALL, [0, 0, 0, 7]),
        ],
      },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateAbacus(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第3学年 A 数と計算「そろばん」（そろばんによる数の表し方、簡単な加法及び減法の計算の仕方。そろばんの仕組みに着目し、大きな数や小数の計算の仕方を考える）。5・10の補数の扱いの学年の分け方（3年: 1つの補数で済む計算、4年: 5と10の補数を続けて使う計算）は本アプリの案',
  revised: '2026-10-30',
};
