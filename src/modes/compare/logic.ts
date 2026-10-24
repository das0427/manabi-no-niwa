/**
 * くらべっこ の問題生成・判定・描画寸法（純粋関数）。仕様: docs/learning-design.md 6章。
 * 段階: P1 大きさ2択 / P2 長さ2択 / P3 数2択 / P4 「おなじ」を含む3択 / P5 3つを順に並べる。
 * 描画寸法（Box）もここで決め、UI は 1 つの SVG（座標の単位は u）にそのまま描く。
 * 同じ座標系・同じ倍率なので、表示倍率で大小が逆転しない（M6-07）。
 */
import { balancedPositions, createRng, hashSeed, type Rng } from '../../core/util/rng';

export type Kind = 'size' | 'length' | 'count';
export type Ask = 'more' | 'less';

export const SIZE_THINGS = [
  'apple',
  'mikan',
  'tomato',
  'ball',
  'bread',
  'flower',
  'rabbit',
  'dog',
  'car-red',
  'tree',
] as const;
export const COUNT_THINGS = [
  'apple',
  'mikan',
  'strawberry',
  'tomato',
  'ball',
  'flower',
  'leaf',
  'bread',
  'egg',
  'onigiri',
] as const;
/** 長さの物は絵ではなく SVG で描く（同じ幅のリボン／えんぴつ） */
export const LENGTH_THINGS = ['ribbon-red', 'ribbon-green', 'pencil'] as const;

export const THINGS: Record<Kind, readonly string[]> = {
  size: SIZE_THINGS,
  length: LENGTH_THINGS,
  count: COUNT_THINGS,
};

export const THING_LABEL: Record<string, string> = {
  'ribbon-red': 'あかい リボン',
  'ribbon-green': 'みどりの リボン',
  pencil: 'えんぴつ',
};

/** [小, 大]。大きさは辺(u)、長さは長さ(u)、数は個数 */
export const SIZE_PAIRS: readonly (readonly [number, number])[] = [
  [8, 13],
  [10, 16.5],
  [12, 20],
];
export const LENGTH_PAIRS: readonly (readonly [number, number])[] = [
  [8, 14],
  [10, 17],
  [12, 20],
  [14, 23],
];
export const COUNT_PAIRS: readonly (readonly [number, number])[] = [
  [1, 3],
  [1, 4],
  [1, 5],
  [1, 6],
  [2, 4],
  [2, 5],
  [2, 6],
  [3, 5],
  [3, 6],
  [4, 6],
];
const PAIRS: Record<Kind, readonly (readonly [number, number])[]> = {
  size: SIZE_PAIRS,
  length: LENGTH_PAIRS,
  count: COUNT_PAIRS,
};
const SAME_VALUES: Record<Kind, readonly number[]> = {
  size: [...new Set(SIZE_PAIRS.flat())],
  length: [...new Set(LENGTH_PAIRS.flat())],
  count: [1, 2, 3, 4, 5, 6],
};
/** P5 の長さ（隣どうし 1.4 倍以上、カードの幅に収まる） */
export const LENGTH_TRIPLES: readonly (readonly [number, number, number])[] = [
  [6, 9, 13.5],
  [7, 10.5, 16],
  [8, 12, 18],
  [9, 13, 19],
  [10, 15, 22],
];
/** P5 の数: 3つの異なる数（1〜6） */
export const COUNT_TRIPLES: readonly (readonly [number, number, number])[] = (() => {
  const out: [number, number, number][] = [];
  for (let a = 1; a <= 6; a++)
    for (let b = a + 1; b <= 6; b++) for (let c = b + 1; c <= 6; c++) out.push([a, b, c]);
  return out;
})();

export const BAR_T = 5;
export const PAD = 3;

export interface PairQuestion {
  type: 'pair';
  level: number;
  kind: Kind;
  ask: Ask;
  thing: string;
  /** ひだり・みぎの量 */
  values: [number, number];
  /** 0 ひだり / 1 みぎ / 2 おなじ */
  answer: 0 | 1 | 2;
  /** 「おなじ」の札を出す（P4） */
  withSame: boolean;
  /** カードの下に札を出す（P4 と数の問題） */
  labels: boolean;
}

export interface OrderQuestion {
  type: 'order';
  level: number;
  kind: 'length' | 'count';
  ask: Ask;
  thing: string;
  /** 画面に並ぶ順（左から）の量。すべて異なる */
  values: [number, number, number];
  /** 正解の並び: マス1・2・3 に入れるカードの番号（左から 0,1,2） */
  order: [number, number, number];
}

export type CompareQuestion = PairQuestion | OrderQuestion;

export function questionKey(q: CompareQuestion): string {
  const v = q.type === 'pair' ? [...q.values] : [...q.values].sort((a, b) => a - b);
  const same = q.type === 'pair' && q.answer === 2;
  const vs = same ? `=${v[0]}` : [...v].sort((a, b) => a - b).join('-');
  return `${q.kind}|${q.thing}|${vs}|${q.ask}`;
}

export function thingLabel(thing: string): string {
  return THING_LABEL[thing] ?? thing;
}

function askSequence(size: number, rng: Rng): Ask[] {
  return balancedPositions(size, 2, rng).map((p) => (p === 0 ? 'more' : 'less'));
}

function genPairs(
  level: number,
  kind: Kind,
  size: number,
  rng: Rng,
  sameAt: ReadonlySet<number>,
): PairQuestion[] {
  const asks = askSequence(size, rng);
  const positions = balancedPositions(size - sameAt.size, 2, rng);
  const used = new Set<string>();
  const out: PairQuestion[] = [];
  let pi = 0;
  const withSame = level === 3;
  const labels = level === 3 || kind === 'count';
  for (let i = 0; i < size; i++) {
    const ask = asks[i]!;
    for (let guard = 0; guard < 1000; guard++) {
      const thing = rng.pick(THINGS[kind]);
      let q: PairQuestion;
      if (sameAt.has(i)) {
        const v = rng.pick(SAME_VALUES[kind]);
        q = { type: 'pair', level, kind, ask, thing, values: [v, v], answer: 2, withSame, labels };
      } else {
        const [lo, hi] = rng.pick(PAIRS[kind]);
        const pos = positions[pi]!;
        const want = ask === 'more' ? hi : lo;
        const other = ask === 'more' ? lo : hi;
        const values: [number, number] = pos === 0 ? [want, other] : [other, want];
        q = {
          type: 'pair',
          level,
          kind,
          ask,
          thing,
          values,
          answer: pos as 0 | 1,
          withSame,
          labels,
        };
      }
      const key = questionKey(q);
      if (used.has(key)) continue;
      used.add(key);
      if (!sameAt.has(i)) pi++;
      out.push(q);
      break;
    }
  }
  return out;
}

function genOrders(level: number, size: number, rng: Rng): OrderQuestion[] {
  // 回ごとに量の種類を1つ決める（1回の中は1種類）
  const roundKind = rng.pick(['length', 'count'] as const);
  const kinds: ('length' | 'count')[] = Array.from({ length: size }, () => roundKind);
  const asks = askSequence(size, rng);
  const used = new Set<string>();
  const out: OrderQuestion[] = [];
  for (let i = 0; i < size; i++) {
    const kind = kinds[i]!;
    const ask = asks[i]!;
    for (let guard = 0; guard < 1000; guard++) {
      const thing = rng.pick(THINGS[kind]);
      const triple = rng.pick(kind === 'length' ? LENGTH_TRIPLES : COUNT_TRIPLES);
      const values = rng.shuffle(triple) as [number, number, number];
      const order = [0, 1, 2].sort((a, b) =>
        ask === 'more' ? values[b]! - values[a]! : values[a]! - values[b]!,
      ) as [number, number, number];
      // 画面の並びが正解の並びと同じ（そのままタップするだけ）にならないようにする
      if (order.every((d, s) => d === s)) continue;
      const q: OrderQuestion = { type: 'order', level, kind, ask, thing, values, order };
      const key = questionKey(q);
      if (used.has(key)) continue;
      used.add(key);
      out.push(q);
      break;
    }
  }
  return out;
}

/** 1回分の問題。1回の中で同じ問題（物・量の組・問いの向き）は出さない */
export function generateRound(level: number, seed: number, size: number): CompareQuestion[] {
  const rng = createRng(hashSeed('compare', level, seed));
  if (level <= 2) {
    return genPairs(level, (['size', 'length', 'count'] as const)[level]!, size, rng, new Set());
  }
  if (level === 3) {
    // 回ごとに量の種類を 1 つ決める。「おなじ」は回の 1/3 前後
    const kind = rng.pick(['size', 'length', 'count'] as const);
    const nSame = Math.max(1, Math.round(size / 3));
    const sameAt = new Set(
      rng.sample(
        Array.from({ length: size }, (_, i) => i),
        nSame,
      ),
    );
    return genPairs(level, kind, size, rng, sameAt);
  }
  return genOrders(level, size, rng);
}

/** ひだり(0)・みぎ(1)・おなじ(2) を選んだ判定 */
export function judgePair(q: PairQuestion, choice: number): boolean {
  return choice === q.answer;
}

/** 並べた順（マス1・2・3 に入れたカードの番号）の判定 */
export function judgeOrder(q: OrderQuestion, placed: readonly number[]): boolean {
  return placed.length === 3 && placed.every((d, s) => d === q.order[s]);
}

/** 問題文の音声列 */
export function questionVoice(q: CompareQuestion): string[] {
  if (q.type === 'order') return [`cmp.q5.${q.kind}.${q.ask}`];
  return q.withSame ? [`cmp.q.${q.kind}.${q.ask}`, 'cmp.or-same'] : [`cmp.q.${q.kind}.${q.ask}`];
}

export function hintVoice(q: CompareQuestion, level: 1 | 2): string {
  if (level === 1) return `cmp.hint.${q.kind}`;
  return q.type === 'order' && q.kind === 'count' ? 'cmp.hint2.count5' : `cmp.hint2.${q.kind}`;
}

export function doneVoice(qs: readonly CompareQuestion[]): string {
  const kinds = new Set(qs.map((q) => q.kind));
  if (kinds.size === 1) return `cmp.done.${[...kinds][0]}`;
  return 'cmp.done.length-count';
}

export function itemKey(q: CompareQuestion): string {
  const ask = { more: 'おおい', less: 'すくない' }[q.ask];
  return `${q.kind}:${thingLabel(q.thing)} ${q.values.join('/')} ${ask}`;
}

// ---- 描画寸法（単位 u。舞台の描画領域 100 × 48.25） ----

export const STAGE_W = 100;
export const STAGE_H = 48.25;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** カード（2つまたは3つ）の枠 */
export function cardBoxes(q: CompareQuestion): Box[] {
  if (q.type === 'order') return [0, 1, 2].map((i) => ({ x: 4 + 32 * i, y: 1, w: 28, h: 17.5 }));
  const h = q.labels ? 26 : 34;
  return [
    { x: 6, y: 1.5, w: 40, h },
    { x: 54, y: 1.5, w: 40, h },
  ];
}

/** P5 の並べ替え先のマス */
export function slotBoxes(): Box[] {
  return [0, 1, 2].map((i) => ({ x: 4 + 32 * i, y: 20.5, w: 28, h: 17.5 }));
}

export const COLS = 3;

/** 数の物を並べる格子（間隔・大きさ）。2つのカードで同じ */
export function gridOf(compact: boolean): { pitch: number; size: number } {
  return compact ? { pitch: 7, size: 6 } : { pitch: 10, size: 8 };
}

/**
 * 枠の中に量 value を描く寸法。大きさ = 辺 value の正方形（枠の中央）、長さ = 左端をそろえた太さ一定の帯、
 * 数 = 同じ大きさの物を同じ間隔の格子に左上から value 個。
 */
export function itemBoxes(kind: Kind, value: number, box: Box, compact: boolean): Box[] {
  if (kind === 'size') {
    return [{ x: box.x + (box.w - value) / 2, y: box.y + (box.h - value) / 2, w: value, h: value }];
  }
  if (kind === 'length') {
    return [{ x: box.x + PAD, y: box.y + (box.h - BAR_T) / 2, w: value, h: BAR_T }];
  }
  const { pitch, size } = gridOf(compact);
  const rows = 2;
  const x0 = box.x + (box.w - COLS * pitch) / 2 + (pitch - size) / 2;
  const y0 = box.y + (box.h - rows * pitch) / 2 + (pitch - size) / 2;
  return Array.from({ length: value }, (_, i) => ({
    x: x0 + (i % COLS) * pitch,
    y: y0 + Math.floor(i / COLS) * pitch,
    w: size,
    h: size,
  }));
}
