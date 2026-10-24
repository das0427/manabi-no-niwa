/**
 * みちをつくろう の出題・ヒント・判定（純粋関数）。仕様: docs/learning-design.md 7章。
 * 段階: R1 1か所 / R2 2〜3か所 / R3 いわを避ける / R4 分かれ道。1回 = roundSize 盤面（同じ面は繰り返さない）。
 */
import { createRng, hashSeed } from '../../core/util/rng';
import {
  cellAt,
  findPath,
  manhattan,
  matchesPlacement,
  stopPoint,
  type Board,
  type Placement,
  type Pos,
} from './board';
import { LEVEL_BOARDS, parsed, type ParsedBoard, type RoadBoardDef } from './content';

/** 1回分の盤面を選ぶ。同じ回の中で同じ盤面を出さない（決定的: seed が同じなら同じ） */
export function generateRound(level: number, seed: number, size: number): RoadBoardDef[] {
  const lv = Math.max(0, Math.min(LEVEL_BOARDS.length - 1, level));
  const pool = LEVEL_BOARDS[lv]!;
  const rng = createRng(hashSeed('road', lv, seed));
  return rng.sample(pool, Math.min(size, pool.length));
}

export function initialBoard(def: RoadBoardDef): Board {
  return parsed(def).board;
}

/** 参考解のうち、いまの盤面から見て足りない配置が最も少ないもの（同数なら先のもの） */
export function bestSolution(p: ParsedBoard, board: Board): Placement[] {
  let best = p.solutions[0]!;
  let bestMissing = Infinity;
  for (const sol of p.solutions) {
    const missing = sol.filter((pl) => !matchesPlacement(cellAt(board, pl), pl)).length;
    if (missing < bestMissing) {
      best = sol;
      bestMissing = missing;
    }
  }
  return best;
}

/**
 * ヒント2で囲むマス（向きは示さない）。
 * 止まった所に一番近い、参考解のマス。すでに参考解どおりに置いてあるマスは除く。
 * 同じ距離なら 行が小さい → 列が小さい。止まる場所が無ければ（すでにつながっている等）null。
 */
export function hintCell(def: RoadBoardDef, board: Board): Pos | null {
  const p = parsed(def);
  if (findPath(board)) return null;
  const stop = stopPoint(board);
  if (!stop) return null;
  const sol = bestSolution(p, board);
  const todo = sol.filter((pl) => !matchesPlacement(cellAt(board, pl), pl));
  const pool = todo.length > 0 ? todo : sol;
  let best: Placement | null = null;
  for (const pl of pool) {
    if (!best) {
      best = pl;
      continue;
    }
    const d = manhattan(pl, stop.pos);
    const db = manhattan(best, stop.pos);
    if (d < db || (d === db && (pl.r < best.r || (pl.r === best.r && pl.c < best.c)))) best = pl;
  }
  return best ? { r: best.r, c: best.c } : null;
}

/** 回の終わりの声かけ（行動に基づくもの。learning-design.md 0.5）。当てはまらなければ undefined（＝さいごまで できたね） */
export function praiseKey(
  results: readonly { rotated: boolean; selfFixed: boolean }[],
): string | undefined {
  if (results.some((r) => r.rotated)) return 'praise.rotated';
  if (results.some((r) => r.selfFixed)) return 'praise.self-fixed';
  return undefined;
}
