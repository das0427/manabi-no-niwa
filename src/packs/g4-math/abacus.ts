/**
 * g4.math.abacus そろばん（curriculum-matrix 2.6・設計書 docs/expansion/p2-design/math-g34.md 3章）。
 * 小数と ▲（定位点）→ 上の位から計算 → 5と10の あわせを つづけて使う → 億・兆 → 小数の たし算・ひき算。
 *
 * abacus エンジンは無い。そろばんは図 kind 'svg'（abacus-svg.ts。数字の列から作る）で描き、
 * 答えは number（数を入れる）と choice（選択肢を図にする）で受ける。珠をタップで動かす操作は無い。
 * 文はふつうに書き、finishUnit が《よみ》を付ける（辞書に無い「定位点」「一兆」は手で付ける）。
 *
 * 同一性キー: 問う形 × 数（'read:3.25'、'hosu:46＋8'、'okucho:億:35＋48' など）。
 * 定義域: read 約9万＋2万、set 約6万、multi 約50万、hosu 160（80＋80）、okucho 約3万、dec 約50万。
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
  G4_READ,
  G4_SET,
  G4_SMALL,
  lowerAway,
  rodDigits,
  rodDigitsOrNull,
  shiftLeft,
  spanOf,
  valueOf,
  zeroSkip,
  type AbacusLayout,
} from './abacus-svg';
import { dec, decAns, finishUnit, pick, pickObj, wrongList } from './util';

type Obj = 'read' | 'set' | 'multi' | 'hosu' | 'okucho' | 'dec';
type Op = '＋' | '−';
type U = '万' | '億' | '兆';

// ---- 小さな部品 ----

/** 位の名前（p: 0 = 一の位、−1 = 1/10の位）。ふつうの文字で書き、finishUnit が《よみ》を付ける */
const NAME = ['一', '十', '百', '千'];
const PLX = (p: number) =>
  p >= 0 ? `${NAME[p]}の 位` : p === -1 ? '[[1/10]]の 位' : '[[1/100]]の 位';
/** 「一万」「一億」「一兆」（兆だけ手でよみを付ける。辞書だと「いちちょう」になる） */
const ONE: Record<U, string> = { 万: '一万', 億: '一億', 兆: '一兆《いっちょう》' };
const inOut = (op: Op) => (op === '＋' ? '入れる' : 'はらう');
const inOutTe = (op: Op) => (op === '＋' ? '入れて' : 'はらって');
const inOutRen = (op: Op) => (op === '＋' ? '入れ' : 'はらい');
const apply = (a: number, op: Op, b: number) => (op === '＋' ? a + b : a - b);
const inv = (op: Op): Op => (op === '＋' ? '−' : '＋');
const dAt = (n: number, r: number) => Math.floor(n / 10 ** r) % 10;
const smallFig = (n: number, opt?: { lit?: boolean; mark?: number[] }): Figure =>
  abacusFig(G4_SMALL, rodDigits(G4_SMALL, n), opt);
const valDigits = (layout: AbacusLayout, n: number) => rodDigitsOrNull(layout, n);

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

/** 位ごとに繰り上がり・繰り下がりをしない計算（わざと まちがえた答え） */
function noCarry(a: number, b: number, op: Op): number {
  let out = 0;
  for (let p = 0; p < 6; p++) {
    const x = dAt(a, p);
    const y = dAt(b, p);
    out += (op === '＋' ? (x + y) % 10 : (x - y + 10) % 10) * 10 ** p;
  }
  return out;
}

/** 数字の列の「位の名」つきの表（x: 数のけた p のリスト） */
const spanPlaces = (layout: AbacusLayout, ds: number[]): number[] => {
  const [lo, hi] = spanOf(layout, ds);
  const out: number[] = [];
  for (let i = lo; i <= hi; i++) out.push(layout.unitRod - i);
  return out;
};

// ---- 定義域 ----

/** 小数（0.01 の個数 h = 1〜99999 のうち 小数部がある）から均等に */
function pickDecH(rng: Rng): number {
  let h: number;
  do h = rng.int(1, 99999);
  while (h % 100 === 0);
  return h;
}

/** set: 選択肢の候補（条件を満たさなければ null） */
function setCands(h: number): Cand[] | null {
  if (h % 100 === 0) return null;
  const dg = rodDigits(G4_SET, h);
  if (!dg.some((d) => d >= 5)) return null;
  const [lo, hi] = spanOf(G4_SET, dg);
  if (!dg.slice(lo, hi + 1).some((d) => d % 5 !== 2)) return null;
  const zs = zeroSkip(G4_SET, dg);
  const cands: Cand[] = [
    [dg, undefined],
    [shiftLeft(dg), 'place-shift'],
    zs ? [zs, 'zero-skip'] : [lowerAway(G4_SET, dg), 'lower-away'],
    [fiveMissing(dg), 'five-missing'],
  ];
  return distinctCands(cands).length === 4 ? cands : null;
}
const set4List = memo(() => {
  const out: number[] = [];
  for (let h = 1; h <= 99999; h++) if (setCands(h)) out.push(h);
  return out;
});
export const SET4_LIST = set4List;

/** 5と10の あわせを つづけて使う計算（160通り） */
export interface HosuCase {
  A: number;
  op: Op;
  b: number;
}
const hosuList = memo(() => {
  const out: HosuCase[] = [];
  for (let a1 = 1; a1 <= 9; a1++)
    for (let b = 1; b <= 9; b++) {
      if (a1 + b < 10 || directSub(a1, 10 - b)) continue;
      for (let t = 0; t <= 9; t++) if (directAdd(t, 1)) out.push({ A: 10 * t + a1, op: '＋', b });
    }
  for (let a1 = 0; a1 <= 8; a1++)
    for (let b = a1 + 1; b <= 9; b++) {
      if (directAdd(a1, 10 - b)) continue;
      for (let t = 1; t <= 9; t++) if (directSub(t, 1)) out.push({ A: 10 * t + a1, op: '−', b });
    }
  return out;
});
export const HOSU_LIST = hosuList;

// ---- read: 読む ----

function readDecItem(level: number, h: number): NumberItem {
  const ds = rodDigits(G4_READ, h);
  const v = dec(h, 2);
  const int = Math.floor(h / 100);
  const d1 = Math.floor(h / 10) % 10;
  const d2 = h % 10;
  const answers = [decAns(h, 2)];
  return {
    engine: 'number',
    id: `read:${v}`,
    objective: 'read',
    level,
    prompt: 'この そろばんの 数は いくつ？',
    figure: abacusFig(G4_READ, ds),
    hints: [
      '▲の けたが 一の 位。右へ [[1/10]]の 位、[[1/100]]の 位だよ。',
      `一の 位までで ${int}。`,
      `[[1/10]]の 位は ${d1}。[[1/100]]の 位は いくつかな。`,
    ],
    explain: `一の 位までで ${int}、[[1/10]]の 位が ${d1}、[[1/100]]の 位が ${d2}。${v}です。`,
    explainFigure: abacusFig(G4_READ, ds, { lit: true }),
    identity: `read:${v}`,
    keys: ['decimal'],
    fields: [{ answer: answers[0]! }],
    wrongAnswers: wrongList(
      answers,
      readWrongsCands(ds, (u) => dec(u, 2), [dec(h * 10, 2), dec(h, 3)]),
    ),
  };
}

/** wrongList に渡す候補（[値, 誤概念] の並び）を作る */
function readWrongsCands(
  ds: number[],
  fmt: (units: number) => string,
  shifted: (string | null)[],
): [string | null, string][] {
  const zs = zeroSkip(G4_READ, ds);
  return [
    [fmt(valueOf(fiveAsOne(G4_READ, ds))), 'five-as-one'],
    [fmt(valueOf(lowerAway(G4_READ, ds))), 'lower-away'],
    ...shifted.map((s) => [s, 'place-shift'] as [string | null, string]),
    [zs ? fmt(valueOf(zs)) : null, 'zero-skip'],
  ];
}

function readUnitItem(level: number, u: U, v: number): NumberItem {
  const ds = rodDigits(G4_READ, v * 100);
  const L = String(v).length;
  const answers = [{ kind: 'int' as const, value: v }];
  const topName = L === 1 ? ONE[u] : `${NAME[L - 1]}${u}`;
  return {
    engine: 'number',
    id: `read:${u}:${v}`,
    objective: 'read',
    level,
    prompt: `▲の けたを ${ONE[u]}の 位と すると、何${u}？`,
    figure: abacusFig(G4_READ, ds),
    hints: [
      `▲の けたが ${ONE[u]}の 位。左へ 十${u}・百${u}・千${u}の 位だよ。`,
      `数の ある いちばん 左の けたは ${topName}の 位。`,
      L === 1
        ? '五だまが ついて いたら 5、それに 一だまの 数を 足そう。'
        : `上の けたから ${String(v).slice(0, -1).split('').join('、')}。▲の けたは いくつかな。`,
    ],
    explain: `▲の けたを ${ONE[u]}の 位に すると、${v}${u}です。`,
    explainFigure: abacusFig(G4_READ, ds, { lit: true }),
    identity: `read:${u}:${v}`,
    fields: [{ answer: answers[0]!, unit: u }],
    wrongAnswers: wrongList(
      answers,
      readWrongsCands(ds, (x) => String(x / 100), [
        String(v * 10),
        v % 10 === 0 ? String(v / 10) : null,
      ]),
    ),
  };
}

function readTableItem(level: number, h: number): NumberItem {
  const ds = rodDigits(G4_READ, h);
  const places = spanPlaces(G4_READ, ds);
  const v = dec(h, 2);
  const SHORT: Record<number, string> = {
    2: '百',
    1: '十',
    0: '一',
    [-1]: '[[1/10]]',
    [-2]: '[[1/100]]',
  };
  const digs = places.map((p) => ds[G4_READ.unitRod - p]!);
  const answers = [decAns(h, 2)];
  return {
    engine: 'number',
    id: `read-table:${v}`,
    objective: 'read',
    level,
    prompt: 'たまの ようすを 表に しました。この 数は いくつ？',
    figure: {
      kind: 'table',
      header: ['', ...places.map((p) => SHORT[p]!)],
      rows: [
        ['五だま', ...digs.map((d) => (d >= 5 ? '入る' : '－'))],
        ['一だま', ...digs.map((d) => `${d % 5}こ`)],
      ],
    },
    hints: [
      '五だまが 入って いると 5、一だまは 1こで 1だよ。',
      `${PLX(places[0]!)}は ${digs[0]}。`,
      'のこりの けたも 1つずつ 数字に しよう。「－」と「0こ」の けたは 0だよ。',
    ],
    explain: `${places.map((p, i) => `${PLX(p)}は ${digs[i]}`).join('、')}。だから ${v}です。`,
    explainFigure: abacusFig(G4_READ, ds, { lit: true }),
    identity: `read-table:${v}`,
    alt: true,
    keys: ['decimal'],
    fields: [{ answer: answers[0]! }],
    wrongAnswers: wrongList(
      answers,
      readWrongsCands(ds, (u) => dec(u, 2), [dec(h * 10, 2), dec(h, 3)]),
    ),
  };
}

function genRead(level: number, rng: Rng, alt: boolean): Item {
  if (alt) return readTableItem(level, pickDecH(rng));
  if (level === 3 && rng.next() < 0.5) {
    const u = pick(rng, ['億', '兆'] as const);
    return readUnitItem(level, u, rng.int(1, 9999));
  }
  return readDecItem(level, pickDecH(rng));
}

// ---- set: 小数をおく ----

function genSet(level: number, rng: Rng, alt: boolean): ChoiceItem {
  // 定義域 SET4 からの一様な選び方（棄却法。全件を並べると起動が重いので）
  let h: number;
  let cands: Cand[] | null;
  do {
    h = rng.int(1, 99999);
    cands = setCands(h);
  } while (!cands);
  const dg = cands[0]![0]!;
  const v = dec(h, 2);
  const places = spanPlaces(G4_SET, dg);
  const parts = places.map((p) => `${PLX(p)}は ${dg[G4_SET.unitRod - p]}`).join('、');
  return {
    engine: 'choice',
    id: `set${alt ? '-units' : ''}:${alt ? h : v}`,
    objective: 'set',
    level,
    prompt: alt
      ? `0.01を ${h}こ 集めた 数を おいた そろばんは どれ？`
      : `${v}を おいた そろばんは どれ？`,
    hints: [
      '▲の けたが 一の 位。小数点の すぐ 右は [[1/10]]の 位だよ。',
      `${v}の 一の 位は ${Math.floor(h / 100) % 10}。`,
      '0の 位は たまを おかずに 1けた あけるよ。',
    ],
    explain: `${alt ? `0.01を ${h}こ 集めると ${v}。` : ''}▲の けたが 一の 位。${parts}。`,
    explainFigure: abacusFig(G4_SET, dg, { lit: true }),
    identity: `set${alt ? '-units' : ''}:${alt ? h : v}`,
    alt,
    layout: 'grid',
    options: figOpts(G4_SET, cands),
  };
}

// ---- multi: 上の位から ----

function multiPair(level: number, rng: Rng, op: Op): [number, number] {
  for (;;) {
    const lv2 = level >= 2;
    const a = lv2 ? rng.int(101, 999) : rng.int(11, 99);
    const b = lv2 ? rng.int(11, 999) : rng.int(11, 99);
    if (op === '−' ? a > b : a + b <= 1999) return [a, b];
  }
}

/** b の 0 でない位を、上から [位, 数字] で */
const stepsOf = (b: number): [number, number][] =>
  String(b)
    .split('')
    .map((c, i, all) => [all.length - 1 - i, Number(c)] as [number, number])
    .filter(([, d]) => d > 0);

function multiCommon(a: number, op: Op, b: number) {
  const steps = stepsOf(b);
  let run = a;
  const trail = steps.map(([p, e]) => {
    run = apply(run, op, e * 10 ** p);
    return { p, e, run };
  });
  return { steps, trail, ans: apply(a, op, b) };
}

function genMulti(level: number, rng: Rng, alt: boolean): Item {
  const op: Op = rng.next() < 0.5 ? '＋' : '−';
  if (alt) {
    for (;;) {
      const [a, b] = multiPair(level, rng, op);
      if (stepsOf(b).length < 2) continue;
      const item = multiStepItem(level, a, op, b);
      if (item.options.length >= 3) return item;
    }
  }
  const [a, b] = multiPair(level, rng, op);
  const { trail, ans } = multiCommon(a, op, b);
  const first = trail[0]!;
  return {
    engine: 'number',
    id: `multi:${a}${op}${b}`,
    objective: 'multi',
    level,
    prompt: `${a} ${op} ${b} を そろばんで 計算しよう。`,
    figure: smallFig(a),
    hints: [
      'そろばんは 上の 位から 計算するよ。',
      trail.length > 1
        ? `まず ${PLX(first.p)}に ${first.e}を ${inOut(op)}と ${first.run}。`
        : `まず ${PLX(first.p)}に ${first.e}を ${inOut(op)}よ。`,
      'のこりの 位も じゅんに。10を こえたら となりの 位に 1 入れ、ひけない ときは となりの 位で 1 はらうよ。',
    ],
    explain: `${trail.map((t) => `${PLX(t.p)}で ${t.e}を ${inOutTe(op)} ${t.run}`).join(' → ')}。${a} ${op} ${b} ＝ ${ans}。`,
    explainFigure: smallFig(ans, { lit: true }),
    identity: `multi:${a}${op}${b}`,
    fields: [{ answer: { kind: 'int', value: ans } }],
    wrongAnswers: wrongList(
      [{ kind: 'int', value: ans }],
      [
        [noCarry(a, b, op), 'carry-forget'],
        [apply(a, inv(op), b) >= 0 ? apply(a, inv(op), b) : null, 'in-out'],
      ],
    ),
  };
}

function multiStepItem(level: number, a: number, op: Op, b: number): ChoiceItem {
  const { trail } = multiCommon(a, op, b);
  const first = trail[0]!;
  const topVal = first.e * 10 ** first.p;
  const iv = apply(a, inv(op), topVal);
  const cands: Cand[] = [
    [valDigits(G4_SMALL, first.run), undefined],
    [valDigits(G4_SMALL, apply(a, op, b % 10)), 'step-order'],
    [valDigits(G4_SMALL, apply(a, op, b)), 'step-order'],
    [iv >= 0 ? valDigits(G4_SMALL, iv) : null, 'in-out'],
  ];
  return {
    engine: 'choice',
    id: `multi-step:${a}${op}${b}`,
    objective: 'multi',
    level,
    prompt: `${a} ${op} ${b} を 上の 位から。${PLX(first.p)}まで した ところは どれ？`,
    figure: smallFig(a),
    hints: [
      'そろばんは 上の 位から 計算するよ。',
      `${PLX(first.p)}に ${first.e}を ${inOut(op)}よ。下の 位は まだ 計算しないよ。`,
      `${PLX(first.p)}の たまだけが うごいた そろばんを さがそう。`,
    ],
    explain: `上の 位から 1けたずつ 計算するよ。${PLX(first.p)}で ${first.e}を ${inOutTe(op)} ${first.run}。`,
    explainFigure: smallFig(first.run, { lit: true, mark: [G4_SMALL.unitRod - first.p] }),
    identity: `multi-step:${a}${op}${b}`,
    alt: true,
    layout: 'grid',
    options: figOpts(G4_SMALL, cands),
  };
}

// ---- hosu: 5と10の あわせを つづけて ----

function genHosu(level: number, rng: Rng, alt: boolean): Item {
  const { A, op, b } = pick(rng, hosuList());
  const plus = op === '＋';
  const a1 = A % 10;
  const c = 10 - b;
  const ans = apply(A, op, b);
  const hints = plus
    ? [
        `一の 位は ${a1}。一だまは ${a1 - 5}こしか ないね。`,
        `${c}を はらう かわりに、5を はらって、はらいすぎた ぶんを 入れるよ。`,
        `${c} と □ で 5。`,
      ]
    : [
        `一の 位は ${a1}。一だまは あと ${4 - a1}こしか 入《はい》らないね。`,
        `${c}を 入れる かわりに、5を 入れて、多い ぶんを はらうよ。`,
        `${c} と □ で 5。`,
      ];
  const explain = plus
    ? `${b}を たすには、十の 位に 1 入れて 一の 位から ${c} はらう（10の あわせ）。${a1}から ${c}を はらうには、5を はらって ${5 - c} 入れる（5の あわせ）。${A} ＋ ${b} ＝ ${ans}。`
    : `${b}を ひくには、十の 位で 1 はらって 一の 位に ${c} 入れる（10の あわせ）。${a1}に ${c}を 入れるには、5を 入れて ${5 - c} はらう（5の あわせ）。${A} − ${b} ＝ ${ans}。`;
  const lit = smallFig(ans, { lit: true, mark: [2, 3] });
  if (alt) {
    const cands: Cand[] = plus
      ? [
          [valDigits(G4_SMALL, ans), undefined],
          [valDigits(G4_SMALL, A + 10), 'half-move'],
          [valDigits(G4_SMALL, A + 10 - b), 'complement-same'],
          [valDigits(G4_SMALL, A + b - 10), 'carry-forget'],
        ]
      : [
          [valDigits(G4_SMALL, ans), undefined],
          [valDigits(G4_SMALL, A - 10), 'half-move'],
          [valDigits(G4_SMALL, A - 10 + b), 'complement-same'],
          [valDigits(G4_SMALL, A - b + 10), 'carry-forget'],
        ];
    return {
      engine: 'choice',
      id: `hosu-alt:${A}${op}${b}`,
      objective: 'hosu',
      level,
      prompt: `${A} ${op} ${b} を した あとの そろばんは どれ？`,
      figure: smallFig(A),
      hints: [hints[0]!, hints[1]!, '十の 位と 一の 位の 両方が 動いた そろばんを さがそう。'],
      explain,
      explainFigure: lit,
      identity: `hosu-alt:${A}${op}${b}`,
      alt: true,
      layout: 'grid',
      options: figOpts(G4_SMALL, cands),
    };
  }
  return {
    engine: 'number',
    id: `hosu:${A}${op}${b}`,
    objective: 'hosu',
    level,
    prompt: plus
      ? `一の 位から ${c} はらう。五だまを はらって、一だまを いくつ 入れる？`
      : `一の 位に ${c} 入れる。五だまを 入れて、一だまを いくつ はらう？`,
    figure: {
      kind: 'column',
      items: [
        smallFig(A),
        {
          kind: 'text',
          size: 'm',
          text: plus
            ? `${A} ＋ ${b}：十の 位に 1 入れ、一の 位から ${c} はらう`
            : `${A} − ${b}：十の 位で 1 はらい、一の 位に ${c} 入れる`,
        },
      ],
    },
    hints,
    explain,
    explainFigure: lit,
    identity: `hosu:${A}${op}${b}`,
    fields: [{ answer: { kind: 'int', value: 5 - c }, unit: 'こ' }],
    wrongAnswers: wrongList(
      [{ kind: 'int', value: 5 - c }],
      [
        [c, 'complement-same'],
        [b, 'complement-mix'],
      ],
    ),
  };
}

// ---- okucho: 億・兆 ----

function genOkucho(level: number, rng: Rng, alt: boolean): Item {
  const u = pick(rng, ['万', '億', '兆'] as const);
  const op: Op = rng.next() < 0.5 ? '＋' : '−';
  let a: number;
  let b: number;
  do {
    a = rng.int(10, 99);
    b = rng.int(1, 99);
  } while (op === '−' && a <= b);
  const r = apply(a, op, b);
  const k = u === '万' ? 4 : u === '億' ? 8 : 12;
  const hints = [
    `${a}${u}は、${ONE[u]}を ${a}こ 集めた 数。`,
    `▲を ${ONE[u]}の 位に すると、${a} ${op} ${b} と 同じ たまの 動かし方だよ。`,
    alt
      ? `${ONE[u]}は 数字では 1の 後ろに 0が ${k}こ つくよ。`
      : `${a} ${op} ${b} の 答えに ${u}を つけよう。`,
  ];
  const io = apply(a, inv(op), b);
  const ans = r * 10 ** k;
  const fig = smallFig(a);
  const lit = smallFig(r, { lit: true });
  if (alt) {
    const answers = [{ kind: 'int' as const, value: ans }];
    const tooLong = (x: number) => (String(x).length > 15 ? null : x);
    return {
      engine: 'number',
      id: `okucho-num:${u}:${a}${op}${b}`,
      objective: 'okucho',
      level,
      prompt: `${a}${u} ${op} ${b}${u} の 答えを 数字だけで 書こう。`,
      figure: fig,
      hints,
      explain: `${ONE[u]}を 1と みると、${a} ${op} ${b} ＝ ${r}。だから ${r}${u}。数字だけで 書くと ${ans}です。`,
      explainFigure: lit,
      identity: `okucho-num:${u}:${a}${op}${b}`,
      alt: true,
      fields: [{ answer: answers[0]!, digitGroup: 4, maxLength: 15 }],
      wrongAnswers: wrongList(answers, [
        [tooLong(ans * 10), 'place-shift'],
        [ans / 10, 'place-shift'],
        [r, 'unit-point'],
      ]),
    };
  }
  const answers = [{ kind: 'int' as const, value: r }];
  return {
    engine: 'number',
    id: `okucho:${u}:${a}${op}${b}`,
    objective: 'okucho',
    level,
    prompt: `▲を ${ONE[u]}の 位に して、${a}${u} ${op} ${b}${u} を 計算しよう。`,
    figure: fig,
    hints,
    explain: `${ONE[u]}を 1と みると、${a} ${op} ${b} ＝ ${r}。だから ${a}${u} ${op} ${b}${u} ＝ ${r}${u}です。`,
    explainFigure: lit,
    identity: `okucho:${u}:${a}${op}${b}`,
    fields: [{ answer: answers[0]!, unit: u }],
    wrongAnswers: wrongList(answers, [
      [noCarry(a, b, op), 'carry-forget'],
      [io >= 0 ? io : null, 'in-out'],
      [r * 10, 'place-shift'],
    ]),
  };
}

// ---- dec: 小数の たし算・ひき算 ----

/** 表示したときの小数のけた数（3.00 → 0、2.40 → 1、2.45 → 2） */
const placesOfHundredths = (x: number) => (x % 100 === 0 ? 0 : x % 10 === 0 ? 1 : 2);

function pickDecOperand(rng: Rng): number {
  if (rng.next() < 0.5) return rng.int(1, 99) * 10;
  let x: number;
  do x = rng.int(1, 999);
  while (x % 10 === 0);
  return x;
}

function genDec(level: number, rng: Rng, alt: boolean): Item {
  const op: Op = rng.next() < 0.5 ? '＋' : '−';
  let A: number;
  let B: number;
  do {
    A = pickDecOperand(rng);
    B = pickDecOperand(rng);
  } while (op === '−' && A <= B);
  const pa = placesOfHundredths(A);
  const pb = placesOfHundredths(B);
  const sA = dec(A, 2);
  const sB = dec(B, 2);
  const r = apply(A, op, B);
  const ans = dec(r, 2);
  const lowPlace = 0 - pb;
  const lowDigit = Math.floor(B / 10 ** (2 - pb)) % 10;
  const fig = abacusFig(G4_READ, rodDigits(G4_READ, A));
  const lit = abacusFig(G4_READ, rodDigits(G4_READ, r), {
    lit: true,
    mark: [G4_READ.unitRod + pb],
  });
  const explain = `${sA}の 小数点を ▲に 合わせ、${sB}を 同じ 位どうしで ${inOutRen(op)}ます。${sA} ${op} ${sB} ＝ ${ans}。`;
  if (alt) {
    const labelOf = (p: number) =>
      p === 1 ? '▲から 1つ 左' : p === 0 ? '▲の けた' : `▲から ${-p}つ 右`;
    const correct = lowPlace;
    const all: [number, string | undefined][] = [1, 0, -1, -2].map((p) => [
      p,
      p === correct
        ? undefined
        : p === 0 - pa
          ? 'align-right'
          : p === 0
            ? 'unit-point'
            : 'place-shift',
    ]);
    const options: ChoiceOption[] = all.map(([p, m]) =>
      m ? { label: labelOf(p), misconception: m } : { label: labelOf(p), correct: true },
    );
    return {
      engine: 'choice',
      id: `dec-rod:${sA}${op}${sB}`,
      objective: 'dec',
      level,
      prompt: `${sA} ${op} ${sB}。${sB}の いちばん 右の 数字を ${inOut(op)} けたは？`,
      figure: fig,
      hints: [
        '▲の けたが 一の 位。右へ [[1/10]]の 位、[[1/100]]の 位だよ。',
        pb === 0
          ? `${sB}には 小数点の 右の 数字が ないね。`
          : `${sB}は 小数点の 右に 数字が ${pb}こ ならんで いるよ。`,
        '小数点の 位置を ▲に 合わせて、右へ 数えて みよう。',
      ],
      explain: `${sB}の いちばん 右の ${lowDigit}は ${PLX(lowPlace)}の 数字。だから ${labelOf(lowPlace)}の けたに ${inOut(op)}。`,
      explainFigure: lit,
      identity: `dec-rod:${sB}`,
      alt: true,
      fixedOrder: true,
      layout: 'column',
      options,
    };
  }
  const align = (x: number, p: number) => x / 10 ** (Math.max(pa, pb) - p);
  const al = pa !== pb ? apply(align(A, pa), op, align(B, pb)) : null;
  const io = apply(A, inv(op), B);
  const answers = [decAns(r, 2)];
  return {
    engine: 'number',
    id: `dec:${sA}${op}${sB}`,
    objective: 'dec',
    level,
    prompt: `${sA} ${op} ${sB} を そろばんで 計算しよう。`,
    figure: fig,
    hints: [
      '▲の けたが 一の 位。小数点の 位置を ▲に 合わせて 入れよう。',
      `${sB}の ${lowDigit}は ${PLX(lowPlace)}に ${inOut(op)}よ。`,
      `上の 位から じゅんに。0.01が ${A} ${op} ${B}こ ぶんの 数だよ。`,
    ],
    explain,
    explainFigure: lit,
    identity: `dec:${sA}${op}${sB}`,
    keys: ['decimal'],
    fields: [{ answer: answers[0]! }],
    wrongAnswers: wrongList(answers, [
      [al !== null && al >= 0 ? dec(al, 2) : null, 'align-right'],
      [dec(r * 10, 2), 'place-shift'],
      [io >= 0 ? dec(io, 2) : null, 'in-out'],
    ]),
  };
}

// ---- 単元 ----

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['read', 'set', 'dec'] },
  { objs: ['multi', 'hosu', 'read'] },
  { objs: ['hosu', 'multi', 'set'] },
  { objs: ['okucho', 'dec', 'read'] },
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
    case 'multi':
      return genMulti(level, rng, alt);
    case 'hosu':
      return genHosu(level, rng, alt);
    case 'okucho':
      return genOkucho(level, rng, alt);
    case 'dec':
      return genDec(level, rng, alt);
  }
}

export const abacus: UnitSpec = finishUnit({
  id: 'g4.math.abacus',
  title: 'そろばん',
  stage: 'g4',
  subject: 'math',
  domain: 'A-number',
  kind: 'concept',
  priority: 'P2',
  status: 'ready',
  icon: 'subj-sansu',
  prereq: ['g3.math.abacus'],
  objectives: [
    { id: 'read', title: 'そろばんの 数を 読む（小数・億・兆）' },
    { id: 'set', title: '小数を そろばんに おく' },
    { id: 'multi', title: '上の 位から 計算する（2けた・3けた）' },
    { id: 'hosu', title: '5と 10の あわせを つづけて 使う' },
    { id: 'okucho', title: '億・兆の たし算・ひき算' },
    { id: 'dec', title: '小数の たし算・ひき算' },
  ],
  misconceptions: [
    {
      id: 'five-as-one',
      explain: '五だまを 1と 数えたのかな。上の 五だまは 1こで 5だよ。',
      figure: abacusFig(G4_SMALL, rodDigits(G4_SMALL, 7), { lit: true }),
    },
    {
      id: 'lower-away',
      explain: 'はりから はなれた たまを 数えたのかな。はりに くっついた たまだけを 数えよう。',
    },
    {
      id: 'five-missing',
      explain:
        '五だまを 入れわすれたのかな。5から 9の 数字は、五だまを 入れてから 一だまを 足すよ。',
    },
    {
      id: 'place-shift',
      explain:
        '位が 1つ ずれたのかな。▲の けたを 一の 位に して、左へ 十・百・千、右へ [[1/10]]・[[1/100]]の 位と 数えよう。',
    },
    {
      id: 'zero-skip',
      explain:
        '0の けたを とばしたのかな。2.07 なら [[1/10]]の 位は 0。たまを おかない けたを 1つ あけるよ。',
    },
    {
      id: 'unit-point',
      explain:
        '▲（一の 位）の 場所を まちがえたのかな。小数点の 位置を ▲に 合わせて、そこから 位を 数えよう。',
    },
    {
      id: 'in-out',
      explain:
        '入れると はらうを 反対に したのかな。たす ときは はりに 入れる、ひく ときは はりから はらうよ。',
    },
    {
      id: 'complement-same',
      explain:
        'たす 数や ひく 数を、そのまま はらったり 入れたり したのかな。5や 10を 入れすぎた ぶんだけ はらうよ。',
    },
    {
      id: 'complement-mix',
      explain:
        '5の あわせと 10の あわせを まちがえたのかな。五だまを 使う ときは 5の あわせ、となりの 位に 1 入れる ときは 10の あわせだよ。',
    },
    {
      id: 'half-move',
      explain:
        'たまの 動かし方が とちゅうで おわったのかな。5や 10を 入れたら、多い ぶんを はらう ところまで しよう。',
    },
    {
      id: 'carry-forget',
      explain:
        'くり上がりや くり下がりを わすれたのかな。10を こえたら となりの 位に 1 入れ、ひけない ときは となりの 位で 1 はらうよ。',
    },
    {
      id: 'step-order',
      explain:
        '計算する 位の じゅんを まちがえたのかな。そろばんは 上の 位から 1けたずつ 計算するよ。',
    },
    {
      id: 'align-right',
      explain: '数の 右の はしを そろえたのかな。小数は 小数点の 位置（▲）を そろえて 入れるよ。',
      figure: { kind: 'text', text: '2.4 ＋ 1.35 → 2.40 ＋ 1.35', size: 'l' },
    },
  ],
  levels: [
    { label: '小数と ▲', chance: 0.05 },
    { label: '上の位から', chance: 0.05 },
    { label: '5と10の あわせ', chance: 0.05 },
    { label: '億・兆', chance: 0.05 },
  ],
  intro: [
    {
      text: 'はりの 上の 点を 定位点《ていいてん》と いいます。▲の ついた 定位点《ていいてん》の けたを 一の 位に きめると、右へ [[1/10]]の 位・[[1/100]]の 位です。',
      figure: {
        kind: 'column',
        items: [
          abacusFig(G4_READ, rodDigits(G4_READ, 325), { lit: true }),
          { kind: 'text', text: '3.25', size: 'xl' },
        ],
      },
    },
    {
      text: '大きな 数は、▲の けたを 一億の 位に きめて おきます。3億 ＋ 5億 は、3 ＋ 5 と 同じ たまの 動かし方です。',
      figure: { kind: 'text', text: '3億 ＋ 5億 ＝ 8億', size: 'l' },
    },
    {
      text: 'そろばんは 上の 位から 計算します。46 ＋ 38 は、十の 位に 3を 入れて 76、つぎに 一の 位に 8を 足して 84。',
      figure: {
        kind: 'row',
        items: [
          smallFig(46),
          { kind: 'text', text: '→', size: 'l' },
          smallFig(76),
          { kind: 'text', text: '→', size: 'l' },
          smallFig(84),
        ],
      },
    },
    {
      text: '6 ＋ 7 は、十の 位に 1 入れ、一の 位から 3 はらいます。6から 3を はらうには、五だまを はらって 一だまを 2 入れます。',
      figure: {
        kind: 'row',
        items: [smallFig(6), { kind: 'text', text: '→', size: 'l' }, smallFig(13)],
      },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateAbacus(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第4学年 A 数と計算「そろばん」（加法及び減法の計算。そろばんの仕組みに着目し、大きな数（億・兆）や小数の計算の仕方を考える）。5と10の補数を続けて使う計算を4年に置くのは本アプリの案',
  revised: '2026-10-30',
});
