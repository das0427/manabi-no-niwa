/**
 * おかいものごっこ の問題生成と判定（純粋関数）。仕様: docs/learning-design.md 1章。
 * 段階: S1 1つ選ぶ / S2 同じ品物1〜3個 / S3 同じ品物1〜5個 / S4 2種類（合計2〜5、各1〜3）。棚は全段階4種。
 */
import { balancedPositions, createRng, hashSeed, type Rng } from '../../core/util/rng';

export const SHOP_ITEMS = [
  'apple',
  'banana',
  'mikan',
  'strawberry',
  'carrot',
  'tomato',
  'bread',
  'egg',
] as const;
export type ShopItem = (typeof SHOP_ITEMS)[number];

export const SHELF_SIZE = 4;
export const BASKET_MAX = 8;

export interface OrderLine {
  item: ShopItem;
  count: number;
}

export interface ShopQuestion {
  lines: OrderLine[];
  /** 棚に並ぶ品物（注文の品物を含む4種） */
  shelf: ShopItem[];
}

export type Basket = Partial<Record<ShopItem, number>>;

/** 注文の同一性（品物の並び順は問わない: りんご2＋バナナ1 と バナナ1＋りんご2 は同じ注文） */
export function orderKey(lines: readonly OrderLine[]): string {
  return lines
    .map((l) => `${l.item}x${l.count}`)
    .sort()
    .join('+');
}

export function totalOf(lines: readonly OrderLine[]): number {
  return lines.reduce((s, l) => s + l.count, 0);
}

function makeOrder(level: number, rng: Rng): OrderLine[] {
  if (level <= 0) return [{ item: rng.pick(SHOP_ITEMS), count: 1 }];
  if (level === 1) return [{ item: rng.pick(SHOP_ITEMS), count: rng.int(1, 3) }];
  if (level === 2) return [{ item: rng.pick(SHOP_ITEMS), count: rng.int(1, 5) }];
  const [a, b] = rng.sample(SHOP_ITEMS, 2) as [ShopItem, ShopItem];
  for (;;) {
    const ca = rng.int(1, 3);
    const cb = rng.int(1, 3);
    if (ca + cb <= 5)
      return [
        { item: a, count: ca },
        { item: b, count: cb },
      ];
  }
}

/**
 * 1回分の問題を作る。1回の中で同じ注文は出さない。
 * 棚の中の「注文の最初の品物」の位置は balancedPositions で偏らせない。
 */
export function generateRound(level: number, seed: number, size: number): ShopQuestion[] {
  const rng = createRng(hashSeed('shopping', level, seed));
  const positions = balancedPositions(size, SHELF_SIZE, rng);
  const used = new Set<string>();
  const out: ShopQuestion[] = [];
  let guard = 0;
  while (out.length < size && guard++ < 1000) {
    const lines = makeOrder(level, rng);
    const key = orderKey(lines);
    if (used.has(key)) continue;
    used.add(key);
    const needed = lines.map((l) => l.item);
    const others = rng.sample(
      SHOP_ITEMS.filter((i) => !needed.includes(i)),
      SHELF_SIZE - needed.length,
    );
    const rest = rng.shuffle([...needed.slice(1), ...others]);
    const pos = positions[out.length] ?? 0;
    const shelf = [...rest];
    shelf.splice(pos, 0, needed[0]!);
    out.push({ lines, shelf });
  }
  return out;
}

export type Issue =
  | { kind: 'wrong-item'; item: ShopItem }
  | { kind: 'extra'; item: ShopItem; diff: number }
  | { kind: 'missing'; item: ShopItem; diff: number };

export interface JudgeResult {
  ok: boolean;
  /** ヒントに使う順（違う品物 → 多い → 足りない） */
  issues: Issue[];
}

/** かごの中身が注文と一致するか（順序は問わない） */
export function judge(basket: Basket, lines: readonly OrderLine[]): JudgeResult {
  const want = new Map(lines.map((l) => [l.item, l.count]));
  const issues: Issue[] = [];
  for (const [item, n] of Object.entries(basket) as [ShopItem, number][]) {
    if (!n) continue;
    if (!want.has(item)) issues.push({ kind: 'wrong-item', item });
  }
  for (const l of lines) {
    const have = basket[l.item] ?? 0;
    if (have > l.count) issues.push({ kind: 'extra', item: l.item, diff: have - l.count });
  }
  for (const l of lines) {
    const have = basket[l.item] ?? 0;
    if (have < l.count) issues.push({ kind: 'missing', item: l.item, diff: l.count - have });
  }
  return { ok: issues.length === 0, issues };
}

/** 注文の読み上げ列（「りんごを にこと、バナナを いっこ ください」） */
export function orderVoice(lines: readonly OrderLine[]): string[] {
  const seq: string[] = [];
  lines.forEach((l, i) => {
    seq.push(`shop.item-wo.${l.item}`);
    seq.push(i < lines.length - 1 ? `shop.count-to.${l.count}` : `count.ko.${l.count}`);
  });
  seq.push('shop.kudasai');
  return seq;
}

export function basketCount(basket: Basket): number {
  return Object.values(basket).reduce((s, n) => s + (n ?? 0), 0);
}
