/**
 * 1回分の問題を選ぶ（純粋関数）。同じ回の中で同一性キーが重ならないようにし、
 * 最近出した問題（recent）をなるべく避ける。seed と番号から再現できる（中断・再開: review-1 #31）。
 */
import { createRng, hashSeed } from '../core/util/rng';
import type { Item, UnitSpec } from './types';

export interface RoundOptions {
  level: number;
  seed: number;
  count: number;
  /** 最近出した問題の同一性キー（避ける） */
  recent?: ReadonlySet<string>;
}

/** 生成器で同じキーを避けるために作り直す回数 */
const RETRIES = 30;

export function buildRound(unit: UnitSpec, opt: RoundOptions): Item[] {
  const used = new Set<string>();
  const out: Item[] = [];
  const src = unit.source;
  if (src.kind === 'generator') {
    for (let index = 0; index < opt.count; index++) {
      let pick: Item | null = null;
      let fallback: Item | null = null;
      for (let t = 0; t < RETRIES; t++) {
        const rng = createRng(hashSeed(opt.seed, index, t));
        const it = src.generate({ level: opt.level, rng, index });
        if (used.has(it.identity)) continue;
        fallback ??= it;
        if (opt.recent?.has(it.identity)) continue;
        pick = it;
        break;
      }
      pick ??= fallback;
      if (!pick) break; // 定義域が小さく、これ以上異なる問題が作れない
      used.add(pick.identity);
      out.push(pick);
    }
    return out;
  }
  // v1 のモードの単元は UnitRunner では出題しない（ModeRunner が受け持つ）
  if (src.kind === 'legacy') return [];
  // 手作り: その段階の問題（無ければ近い段階）から、未出→最近出した の順に
  const rng = createRng(hashSeed(opt.seed, 'items'));
  const pool = poolFor(src.items, opt.level);
  const fresh = rng.shuffle(pool.filter((it) => !opt.recent?.has(it.identity)));
  const seen = rng.shuffle(pool.filter((it) => opt.recent?.has(it.identity)));
  for (const it of [...fresh, ...seen]) {
    if (out.length >= opt.count) break;
    if (used.has(it.identity)) continue;
    used.add(it.identity);
    out.push(it);
  }
  return out;
}

/** その段階の問題。無ければ近い下の段階、それも無ければ近い上の段階 */
function poolFor(items: Item[], level: number): Item[] {
  for (let d = 0; d <= 20; d++) {
    const lower = items.filter((it) => it.level === level - d);
    if (lower.length > 0) return lower;
    const upper = items.filter((it) => it.level === level + d);
    if (upper.length > 0) return upper;
  }
  return items;
}
