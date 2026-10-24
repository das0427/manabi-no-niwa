/**
 * seed 付きの乱数。問題生成はすべてこれを使い、同じ seed なら同じ問題になる（テストで再現可能）。
 */
export interface Rng {
  /** 0 以上 1 未満 */
  next(): number;
  /** min 以上 max 以下の整数 */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
  /** items から重複なく n 個 */
  sample<T>(items: readonly T[], n: number): T[];
}

/** mulberry32。暗号用途ではない */
export function createRng(seed: number): Rng {
  let s = seed >>> 0 || 0x9e3779b9;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const shuffle = <T>(items: readonly T[]): T[] => {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = int(0, i);
      [a[i], a[j]] = [a[j] as T, a[i] as T];
    }
    return a;
  };
  return {
    next,
    int,
    pick: <T>(items: readonly T[]): T => {
      if (items.length === 0) throw new Error('pick from empty list');
      return items[int(0, items.length - 1)] as T;
    },
    shuffle,
    sample: <T>(items: readonly T[], n: number): T[] => {
      if (n > items.length) throw new Error(`sample ${n} from ${items.length}`);
      return shuffle(items).slice(0, n);
    },
  };
}

/** 文字列から seed を作る（モードごとに seed をずらすため） */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 新しい回の seed（テストでは ?seed= で固定できる） */
export function freshSeed(): number {
  const fixed =
    typeof location !== 'undefined' ? new URLSearchParams(location.search).get('seed') : null;
  if (fixed && /^\d+$/.test(fixed)) return Number(fixed);
  return Math.floor(Math.random() * 2 ** 31);
}

/**
 * 1回（count 問）の正解位置を決める。
 * - 各位置の出現回数の差は 1 以下
 * - 同じ位置が 3 回続かない（choices が 2 以上のとき）
 * 正解位置の癖で答えが分かることを防ぐ（requirements M5-06 ほか全モード）。
 */
export function balancedPositions(count: number, choices: number, rng: Rng): number[] {
  if (choices < 1) throw new Error('choices must be >= 1');
  if (choices === 1) return Array.from({ length: count }, () => 0);
  for (let attempt = 0; attempt < 200; attempt++) {
    const bag: number[] = [];
    while (bag.length < count) {
      bag.push(...rng.shuffle(Array.from({ length: choices }, (_, i) => i)));
    }
    const seq = bag.slice(0, count);
    let ok = true;
    for (let i = 2; i < seq.length; i++) {
      if (seq[i] === seq[i - 1] && seq[i] === seq[i - 2]) ok = false;
    }
    if (ok) return seq;
  }
  // 理論上ここには来ないが、念のため単純な巡回で返す
  return Array.from({ length: count }, (_, i) => i % choices);
}

/** answer を index の位置に置いた並びを作る（他の選択肢の順は乱数） */
export function placeAt<T>(answer: T, others: readonly T[], index: number, rng: Rng): T[] {
  const rest = rng.shuffle(others);
  const out = [...rest];
  out.splice(Math.min(index, out.length), 0, answer);
  return out;
}
