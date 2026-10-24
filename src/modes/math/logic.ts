/**
 * さんすう の問題生成と判定（純粋関数）。仕様: docs/learning-design.md 9章。
 *
 * 問題は {op, a, b, item} だけを持つ（M9-08）。絵の個数・式の文字・読み上げキー・答え・選択肢は
 * すべてこの4つから導く関数で作る。表示と音声が食い違わないことは logic.test.ts で全範囲を検査する。
 *
 *   op '+'     : a ＋ b       （絵は a 個と b 個の2つのまとまり）
 *   op '-'     : a － b       （絵は a 個。そのうち b 個を「たべた」）
 *   op 'part'  : a ＝ b ＋ ？  （D2。a 個のうち、こっちに b 個。あっち＝a－b 個を答える）
 *   op 'split' : a 個を2つのおさらに分ける（D1。b は使わないので a と同じ値にしておく）
 */
import { balancedPositions, createRng, hashSeed, placeAt, type Rng } from '../../core/util/rng';

export const MATH_ITEMS = ['apple', 'strawberry', 'mikan', 'egg', 'banana'] as const;
export type MathItem = (typeof MATH_ITEMS)[number];

export type MathOp = '+' | '-' | 'split' | 'part';

export interface MathProblem {
  op: MathOp;
  a: number;
  b: number;
  item: MathItem;
}

export type MathSkill = 'add' | 'sub' | 'split' | 'formula_add' | 'formula_sub';
export type MathStage = 'A' | 'B1' | 'B2' | 'B3' | 'C1' | 'C2' | 'C3' | 'D1' | 'D2' | 'E1' | 'E2';

/** registry.ts の SKILLS の段階の順と同じ */
export const STAGES: Record<MathSkill, readonly MathStage[]> = {
  add: ['A', 'B1', 'B2', 'B3'],
  sub: ['C1', 'C2', 'C3'],
  split: ['D1', 'D2'],
  formula_add: ['E1'],
  formula_sub: ['E2'],
};

export function isMathSkill(id: string | null): id is MathSkill {
  return id !== null && Object.prototype.hasOwnProperty.call(STAGES, id);
}

export function stageOf(skill: MathSkill, level: number): MathStage {
  const list = STAGES[skill];
  return list[Math.max(0, Math.min(list.length - 1, level))]!;
}

/** 式を絵に添えるか（A は絵だけ。E は式だけで、絵は「えで みる」） */
export const hasFormula = (s: MathStage): boolean => s !== 'A' && s !== 'D1';
export const isFormulaOnly = (s: MathStage): boolean => s === 'E1' || s === 'E2';
/** 0 を問題・選択肢に出してよい段階（M9-05） */
export const allowsZero = (s: MathStage): boolean =>
  s === 'B3' || s === 'C3' || s === 'E1' || s === 'E2';

// ---------- 問題の範囲 ----------

type Pair = Pick<MathProblem, 'op' | 'a' | 'b'>;

const range = (lo: number, hi: number): number[] =>
  Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);

function addPairs(minOperand: number, maxSum: number, minSum: number): Pair[] {
  const out: Pair[] = [];
  for (const a of range(minOperand, maxSum))
    for (const b of range(minOperand, maxSum))
      if (a + b >= minSum && a + b <= maxSum) out.push({ op: '+', a, b });
  return out;
}

function subPairs(maxA: number, minA: number, minAnswer: number): Pair[] {
  const out: Pair[] = [];
  for (const a of range(minA, maxA))
    for (const b of range(1, a)) if (a - b >= minAnswer) out.push({ op: '-', a, b });
  return out;
}

/** 段階ごとの式（品物を除く）の全部。E1 は B3、E2 は C3 と同じ範囲 */
export function formulasOf(stage: MathStage): Pair[] {
  switch (stage) {
    case 'A':
    case 'B1':
      return addPairs(1, 3, 2);
    case 'B2':
      return addPairs(1, 5, 2);
    case 'B3':
    case 'E1':
      // たす 0（0＋0 は除く）。合計 1〜5
      return addPairs(0, 5, 1);
    case 'C1':
      return subPairs(3, 2, 1);
    case 'C2':
      return subPairs(5, 2, 1);
    case 'C3':
    case 'E2':
      // 答えが 0 を含む。a は 1〜5、b は 1〜a
      return subPairs(5, 1, 0);
    case 'D1':
      return range(3, 5).map((n) => ({ op: 'split' as const, a: n, b: n }));
    case 'D2': {
      const out: Pair[] = [];
      for (const n of range(2, 5))
        for (const b of range(1, n - 1)) out.push({ op: 'part', a: n, b });
      return out;
    }
  }
}

// ---------- 導出（絵・式・答え・読み上げ） ----------

export function answerOf(p: MathProblem): number | null {
  switch (p.op) {
    case '+':
      return p.a + p.b;
    case '-':
    case 'part':
      return p.a - p.b;
    case 'split':
      return null;
  }
}

/** 絵の個数。groups は2つのまとまり（または1つ）、eaten は a 個のうち「たべた」個数 */
export function picturesOf(p: MathProblem): { groups: number[]; eaten: number } {
  switch (p.op) {
    case '+':
      return { groups: [p.a, p.b], eaten: 0 };
    case '-':
      return { groups: [p.a], eaten: p.b };
    case 'part':
      return { groups: [p.b, p.a - p.b], eaten: 0 };
    case 'split':
      return { groups: [p.a], eaten: 0 };
  }
}

export interface FormulaToken {
  text: string;
  role: 'a' | 'b' | 'op' | 'eq' | 'ans';
}

/** 式の部品（見える順）。? は答えの位置 */
export function formulaTokens(p: MathProblem): FormulaToken[] {
  const q: FormulaToken = { text: '？', role: 'ans' };
  const eq: FormulaToken = { text: '＝', role: 'eq' };
  switch (p.op) {
    case '+':
      return [
        { text: String(p.a), role: 'a' },
        { text: '＋', role: 'op' },
        { text: String(p.b), role: 'b' },
        eq,
        q,
      ];
    case '-':
      return [
        { text: String(p.a), role: 'a' },
        { text: '－', role: 'op' },
        { text: String(p.b), role: 'b' },
        eq,
        q,
      ];
    case 'part':
      return [
        { text: String(p.a), role: 'a' },
        eq,
        { text: String(p.b), role: 'b' },
        { text: '＋', role: 'op' },
        q,
      ];
    case 'split':
      return [{ text: String(p.a), role: 'a' }];
  }
}

/** 式の文字列。solved なら ？ を答えにする */
export function formulaText(p: MathProblem, solved = false): string {
  const ans = answerOf(p);
  return formulaTokens(p)
    .map((t) => (t.role === 'ans' && solved && ans !== null ? String(ans) : t.text))
    .join(' ');
}

/** 分けた結果の式「5 ＝ 3 ＋ 2」 */
export function splitFormula(n: number, x: number, y: number): string {
  return `${n} ＝ ${x} ＋ ${y}`;
}

/** 保護者画面に出す問題の内容（例「2+1」「5-2」「4=1+?」「5=3+2」） */
export function itemKeyOf(p: MathProblem, split?: [number, number]): string {
  switch (p.op) {
    case '+':
      return `${p.a}+${p.b}`;
    case '-':
      return `${p.a}-${p.b}`;
    case 'part':
      return `${p.a}=${p.b}+?`;
    case 'split':
      return split ? `${p.a}=${split[0]}+${split[1]}` : `${p.a}=?+?`;
  }
}

const ko = (n: number): string => `count.ko.${n}`;
const num = (n: number): string => `num.${n}`;

type Seq = (string | number)[];

/** 場面の読み上げ「りんごが いっこ。もう にこ きたよ。ぜんぶで なんこ？」 */
export function sceneVoice(p: MathProblem): Seq {
  const ga = `math.item-ga.${p.item}`;
  switch (p.op) {
    case '+': {
      const first: Seq = p.a === 0 ? [`math.item-wa.${p.item}`, 'math.none'] : [ga, ko(p.a)];
      const second: Seq =
        p.b === 0 ? ['math.add-none'] : ['math.add-more', ko(p.b), 'math.add-came'];
      return [...first, 300, ...second, 300, 'math.q-all'];
    }
    case '-':
      return [ga, ko(p.a), 'math.aru', 300, ko(p.b), 'math.tabeta', 300, 'math.q-rest'];
    case 'part':
      return [ga, ko(p.a), 300, 'math.kocchi', ko(p.b), 300, 'math.q-other'];
    case 'split':
      return [ga, ko(p.a), 'math.aru', 300, 'math.q-split'];
  }
}

/** 式を問う読み上げ「いち たす に は？」 */
export function formulaVoice(p: MathProblem): Seq {
  switch (p.op) {
    case '+':
      return [num(p.a), 'math.plus', num(p.b), 'math.wa-q'];
    case '-':
      return [num(p.a), 'math.minus', num(p.b), 'math.wa-q'];
    case 'part':
      return [num(p.a), 'math.wa', num(p.b), 'math.to', 'math.ikutsu'];
    case 'split':
      return [num(p.a), 'math.wa', 'math.q-split'];
  }
}

/** 答えまで言う読み上げ「いち たす に は さん」 */
export function answerVoice(p: MathProblem): Seq {
  const ans = answerOf(p);
  if (ans === null) return [];
  switch (p.op) {
    case '+':
      return [num(p.a), 'math.plus', num(p.b), 'math.wa', num(ans)];
    case '-':
      return [num(p.a), 'math.minus', num(p.b), 'math.wa', num(ans)];
    case 'part':
      return [num(p.a), 'math.wa', num(p.b), 'math.to', num(ans)];
    case 'split':
      return [];
  }
}

/** 分けたあとの読み上げ「さんこと にこ。ごは さんと に」 */
export function splitVoice(n: number, x: number, y: number): Seq {
  return [`math.ko-to.${x}`, ko(y), 400, num(n), 'math.wa', num(x), 'math.to', num(y)];
}

/** 画面上部に出す短い問い（音声の列と同じ文） */
export function headerVoice(p: MathProblem, stage: MathStage): Seq {
  if (isFormulaOnly(stage)) return formulaVoice(p);
  switch (p.op) {
    case '+':
      return ['math.q-all'];
    case '-':
      return ['math.q-rest'];
    case 'part':
      return ['math.q-other'];
    case 'split':
      return ['math.q-split'];
  }
}

/** 各回の最初の問題だけに付ける短い説明（お手本: learning-design.md 0章） */
export function introVoice(stage: MathStage): string {
  if (stage === 'D1') return 'math.intro-split';
  if (isFormulaOnly(stage)) return 'math.intro-formula';
  return 'math.intro-count';
}

/** 問題文として再生する列と、画面上部に出す列 */
export function promptOf(
  p: MathProblem,
  stage: MathStage,
  withIntro: boolean,
): { seq: Seq; display: Seq } {
  const display = headerVoice(p, stage);
  const body: Seq = isFormulaOnly(stage) ? formulaVoice(p) : sceneVoice(p);
  return { seq: withIntro ? [introVoice(stage), 500, ...body] : body, display };
}

/** ヒントの声（learning-design.md 9章） */
export function hintVoice(p: MathProblem, stage: MathStage, level: 1 | 2): Seq {
  if (stage === 'D1') return [level === 1 ? 'math.hint-split-1' : 'math.hint-split-2'];
  if (level === 2) return ['math.hint-together'];
  if (isFormulaOnly(stage)) return ['math.hint-picture'];
  if (p.op === 'part')
    return ['math.zenbu', ko(p.a), 'math.datta', 300, 'math.hint-kocchi', ko(p.b)];
  return ['math.hint-count'];
}

/** テスト用: 読み上げの列から、数として言っている値を順に取り出す（0 は「ひとつも〜」の言い方） */
export function spokenNumbers(seq: readonly (string | number)[]): number[] {
  const out: number[] = [];
  for (const k of seq) {
    if (typeof k !== 'string') continue;
    const m = /^(?:count\.ko|num|math\.ko-to)\.(\d+)$/.exec(k);
    if (m) out.push(Number(m[1]));
    else if (k === 'math.none' || k === 'math.add-none') out.push(0);
  }
  return out;
}

// ---------- 選択肢 ----------

/** 選択肢に使ってよい数の範囲。0 を出さない段階では 1〜5 */
export function choiceRange(stage: MathStage): [number, number] {
  return allowsZero(stage) ? [0, 5] : [1, 5];
}

/** 答え＋近い数2つ。重複なし。正解は position の位置 */
export function choicesFor(
  p: MathProblem,
  stage: MathStage,
  position: number,
  rng: Rng,
): { choices: number[]; answerIndex: number } {
  const ans = answerOf(p);
  if (ans === null) return { choices: [], answerIndex: -1 };
  const [lo, hi] = choiceRange(stage);
  const near = range(lo, hi).filter((x) => x !== ans && Math.abs(x - ans) <= 2);
  const others = rng.sample(near, 2);
  const choices = placeAt(ans, others, position, rng);
  return { choices, answerIndex: choices.indexOf(ans) };
}

// ---------- D1（分ける） ----------

/** n 個を2つのおさらに分けたとき、有効か（どちらにも1つ以上、合計が n） */
export function isValidSplit(n: number, x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 1 && y >= 1 && x + y === n;
}

/** n 個の分け方の全部（1と4・4と1 は別） */
export function splitsOf(n: number): [number, number][] {
  return range(1, n - 1).map((k) => [k, n - k] as [number, number]);
}

// ---------- 1回分 ----------

export interface MathQuestion {
  problem: MathProblem;
  /** 3枚の数字の札（D1 は空） */
  choices: number[];
  answerIndex: number;
}

export function problemKey(p: MathProblem): string {
  return `${p.op}:${p.a}:${p.b}:${p.item}`;
}

/** 式を1回の中でなるべく重ねずに並べる（段階の式が少なければ周回する。隣り合わせの同じ式は避ける） */
function pickFormulas(pool: readonly Pair[], size: number, rng: Rng): Pair[] {
  const out: Pair[] = [];
  let bag: Pair[] = [];
  while (out.length < size) {
    if (bag.length === 0) {
      bag = rng.shuffle(pool);
      const last = out[out.length - 1];
      if (last && bag.length > 1 && bag[0]!.a === last.a && bag[0]!.b === last.b) {
        [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1]!, bag[0]!];
      }
    }
    out.push(bag.shift()!);
  }
  return out;
}

/** 品物を重ねずに並べる（5種なので size が5以下なら全部ちがう） */
function pickItems(size: number, rng: Rng): MathItem[] {
  const out: MathItem[] = [];
  while (out.length < size) out.push(...rng.shuffle(MATH_ITEMS));
  return out.slice(0, size);
}

/**
 * 1回分の問題を作る。1回の中で同じ問題（式と品物）を出さない。
 * 正解の位置は balancedPositions で偏らせない。
 */
export function generateRound(
  skill: MathSkill,
  level: number,
  seed: number,
  size: number,
): MathQuestion[] {
  const stage = stageOf(skill, level);
  const rng = createRng(hashSeed('math', skill, stage, seed));
  const formulas = pickFormulas(formulasOf(stage), size, rng);
  const items = pickItems(size, rng);
  const positions = balancedPositions(size, 3, rng);
  return formulas.map((f, i) => {
    const problem: MathProblem = { ...f, item: items[i]! };
    const { choices, answerIndex } = choicesFor(problem, stage, positions[i] ?? 0, rng);
    return { problem, choices, answerIndex };
  });
}
