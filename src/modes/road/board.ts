/**
 * みちをつくろう の盤面規則（純粋関数）。仕様: docs/architecture.md 6.2（M7-05）。
 *
 * - 盤面は格子（列×行）。各マスは empty / tile(kind, rot) / fixed(kind, rot) / rock / start(dir) / goal(dirs)。
 * - 向きは 0=上 1=右 2=下 3=左。タイルの回転は時計回り 90°。
 *   straight: 初期（rot 0）はよこ（右・左）、rot 1 でたて。
 *   corner:   初期（rot 0）は右と下。
 *   tee:      初期（rot 0）は右・下・左（上が閉じた T）。
 * - つながり: 隣り合う2マスが互いに向き合う開口を持つときだけ接続（片側だけは接続しない）。
 * - 盤面の端に向いた開口は行き止まり。
 */

export type Dir = 0 | 1 | 2 | 3;
export type TileKind = 'straight' | 'corner' | 'tee';
export type Tool = 'straight' | 'corner' | 'tee' | 'erase';

export type Cell =
  | { t: 'empty' }
  | { t: 'tile'; kind: TileKind; rot: number }
  | { t: 'fixed'; kind: TileKind; rot: number }
  | { t: 'rock' }
  | { t: 'start'; dir: Dir }
  | { t: 'goal'; dirs: Dir[] };

export interface Board {
  cols: number;
  rows: number;
  /** cells[行][列] */
  cells: Cell[][];
}

export interface Pos {
  r: number;
  c: number;
}

export const DR = [-1, 0, 1, 0] as const;
export const DC = [0, 1, 0, -1] as const;

export const opposite = (d: Dir): Dir => ((d + 2) % 4) as Dir;

export const posKey = (p: Pos): string => `${p.r},${p.c}`;
export const samePos = (a: Pos, b: Pos): boolean => a.r === b.r && a.c === b.c;
export const manhattan = (a: Pos, b: Pos): number => Math.abs(a.r - b.r) + Math.abs(a.c - b.c);

// ---- タイル ----

const BASE_OPENINGS: Record<TileKind, readonly Dir[]> = {
  straight: [1, 3],
  corner: [1, 2],
  tee: [1, 2, 3],
};

/** 回転できる種類ごとの向きの数（straight は 2、それ以外は 4） */
export const ROT_COUNT: Record<TileKind, number> = { straight: 2, corner: 4, tee: 4 };

/** タイルの開口（昇順）。rot は時計回りに 90° ずつ */
export function tileOpenings(kind: TileKind, rot: number): Dir[] {
  const r = ((rot % 4) + 4) % 4;
  return BASE_OPENINGS[kind].map((d) => ((d + r) % 4) as Dir).sort((a, b) => a - b);
}

/** 90° 回した次の rot（straight は 0 ⇄ 1） */
export function nextRot(kind: TileKind, rot: number): number {
  return (rot + 1) % ROT_COUNT[kind];
}

/** マスの開口（empty・rock は開口なし） */
export function openingsOf(cell: Cell): readonly Dir[] {
  switch (cell.t) {
    case 'tile':
    case 'fixed':
      return tileOpenings(cell.kind, cell.rot);
    case 'start':
      return [cell.dir];
    case 'goal':
      return [...cell.dirs].sort((a, b) => a - b);
    default:
      return [];
  }
}

export function inBoard(board: Board, p: Pos): boolean {
  return p.r >= 0 && p.r < board.rows && p.c >= 0 && p.c < board.cols;
}

export function cellAt(board: Board, p: Pos): Cell | null {
  if (!inBoard(board, p)) return null;
  return board.cells[p.r]?.[p.c] ?? null;
}

export function neighbor(p: Pos, d: Dir): Pos {
  return { r: p.r + DR[d], c: p.c + DC[d] };
}

/** p の d 向きの開口が、隣のマスの向かい合う開口とつながっているか */
export function isLinked(board: Board, p: Pos, d: Dir): boolean {
  const me = cellAt(board, p);
  if (!me || !openingsOf(me).includes(d)) return false;
  const q = neighbor(p, d);
  const other = cellAt(board, q);
  if (!other) return false; // 盤面の端: 行き止まり
  return openingsOf(other).includes(opposite(d));
}

// ---- 盤面の生成・検索 ----

export function emptyBoard(cols: number, rows: number): Board {
  return {
    cols,
    rows,
    cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ t: 'empty' }))),
  } as Board;
}

export function cloneBoard(board: Board): Board {
  return {
    cols: board.cols,
    rows: board.rows,
    cells: board.cells.map((row) => row.map((c) => ({ ...c }) as Cell)),
  };
}

export function setCell(board: Board, p: Pos, cell: Cell): Board {
  const next = cloneBoard(board);
  next.cells[p.r]![p.c] = cell;
  return next;
}

export function findCell(board: Board, t: 'start' | 'goal'): Pos | null {
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (board.cells[r]![c]!.t === t) return { r, c };
    }
  }
  return null;
}

interface Reach {
  pos: Pos;
  dist: number;
  prev: string | null;
}

/** スタートから到達できるマス（幅優先。ゴールに着いたらそこからは広げない） */
function explore(board: Board): { reach: Map<string, Reach>; goal: Pos | null } {
  const start = findCell(board, 'start');
  const reach = new Map<string, Reach>();
  if (!start) return { reach, goal: null };
  reach.set(posKey(start), { pos: start, dist: 0, prev: null });
  const queue: Pos[] = [start];
  let goal: Pos | null = null;
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i]!;
    const cell = cellAt(board, cur)!;
    if (cell.t === 'goal') {
      goal ??= cur;
      continue;
    }
    for (const d of openingsOf(cell)) {
      if (!isLinked(board, cur, d)) continue;
      const nb = neighbor(cur, d);
      const key = posKey(nb);
      if (reach.has(key)) continue; // 訪問済みには戻らない（循環でも止まる）
      reach.set(key, { pos: nb, dist: reach.get(posKey(cur))!.dist + 1, prev: posKey(cur) });
      queue.push(nb);
    }
  }
  return { reach, goal };
}

function pathTo(reach: Map<string, Reach>, p: Pos): Pos[] {
  const out: Pos[] = [];
  let key: string | null = posKey(p);
  while (key) {
    const r: Reach | undefined = reach.get(key);
    if (!r) break;
    out.push(r.pos);
    key = r.prev;
  }
  return out.reverse();
}

/** スタート→ゴールの最短経路（幅優先）。つながっていなければ null。分岐はどちらでもよい */
export function findPath(board: Board): Pos[] | null {
  const { reach, goal } = explore(board);
  return goal ? pathTo(reach, goal) : null;
}

export function isConnected(board: Board): boolean {
  return findPath(board) !== null;
}

export interface Stop {
  pos: Pos;
  /** スタートから止まる場所までの経路（止まる場所を含む） */
  path: Pos[];
}

/**
 * 経路が無いときに、うさぎが止まる場所。
 * スタートから到達できるマスのうち、ゴールに最も近い（マンハッタン距離）マス。
 * 同点は (1) スタートからの経路が長い方 (2) 行が小さい方 (3) 列が小さい方。
 */
export function stopPoint(board: Board): Stop | null {
  const goal = findCell(board, 'goal');
  const { reach } = explore(board);
  if (!goal || reach.size === 0) return null;
  let best: Reach | null = null;
  for (const cand of reach.values()) {
    if (!best) {
      best = cand;
      continue;
    }
    const dc = manhattan(cand.pos, goal);
    const db = manhattan(best.pos, goal);
    if (dc !== db) {
      if (dc < db) best = cand;
      continue;
    }
    if (cand.dist !== best.dist) {
      if (cand.dist > best.dist) best = cand;
      continue;
    }
    if (cand.pos.r !== best.pos.r) {
      if (cand.pos.r < best.pos.r) best = cand;
      continue;
    }
    if (cand.pos.c < best.pos.c) best = cand;
  }
  return best ? { pos: best.pos, path: pathTo(reach, best.pos) } : null;
}

/** そのマスの開口のうち、相手とつながっていない向き（止まった所に点線を出す向き） */
export function openSidesNotConnected(board: Board, p: Pos): Dir[] {
  const cell = cellAt(board, p);
  if (!cell) return [];
  return openingsOf(cell).filter((d) => !isLinked(board, p, d));
}

// ---- 操作（道具） ----

export type ToolResult = {
  board: Board;
  /** place=置いた rotate=回した remove=消した none=何も起きない */
  action: 'place' | 'rotate' | 'remove' | 'none';
};

/**
 * 道具を選んでマスをタップしたときの結果。
 * - 空きマス: 道具の種類を置く（けす では何もしない）
 * - 置いた道: けす なら消す。それ以外は選んでいる道具に関係なく90°回す
 * - 固定の道・いわ・スタート・ゴール: 変わらない
 */
export function applyTool(board: Board, p: Pos, tool: Tool): ToolResult {
  const cell = cellAt(board, p);
  if (!cell) return { board, action: 'none' };
  if (cell.t === 'empty') {
    if (tool === 'erase') return { board, action: 'none' };
    return { board: setCell(board, p, { t: 'tile', kind: tool, rot: 0 }), action: 'place' };
  }
  if (cell.t === 'tile') {
    if (tool === 'erase') return { board: setCell(board, p, { t: 'empty' }), action: 'remove' };
    return {
      board: setCell(board, p, { ...cell, rot: nextRot(cell.kind, cell.rot) }),
      action: 'rotate',
    };
  }
  return { board, action: 'none' };
}

/** 置いた道の数 */
export function placedCount(board: Board): number {
  return board.cells.reduce((n, row) => n + row.filter((c) => c.t === 'tile').length, 0);
}

// ---- 参考解 ----

export interface Placement extends Pos {
  kind: TileKind;
  rot: number;
}

/** 参考解（空きマスへのタイル配置）を置いた盤面。空きマス以外には置かない */
export function applyPlacements(board: Board, placements: readonly Placement[]): Board {
  const next = cloneBoard(board);
  for (const pl of placements) {
    const cell = next.cells[pl.r]?.[pl.c];
    if (cell && (cell.t === 'empty' || cell.t === 'tile')) {
      next.cells[pl.r]![pl.c] = { t: 'tile', kind: pl.kind, rot: pl.rot };
    }
  }
  return next;
}

/** マスが参考解の配置と同じ道になっているか（向きは開口で比べる） */
export function matchesPlacement(cell: Cell | null, pl: Placement): boolean {
  if (!cell || cell.t !== 'tile') return false;
  const a = tileOpenings(cell.kind, cell.rot).join('');
  const b = tileOpenings(pl.kind, pl.rot).join('');
  return cell.kind === pl.kind && a === b;
}

// ---- 保存データの検証（つくりかけ・作品の読み込み用） ----

const isDir = (x: unknown): x is Dir => x === 0 || x === 1 || x === 2 || x === 3;

function isCell(x: unknown): x is Cell {
  if (!x || typeof x !== 'object') return false;
  const c = x as Record<string, unknown>;
  switch (c.t) {
    case 'empty':
    case 'rock':
      return true;
    case 'tile':
    case 'fixed':
      return (
        (c.kind === 'straight' || c.kind === 'corner' || c.kind === 'tee') &&
        typeof c.rot === 'number'
      );
    case 'start':
      return isDir(c.dir);
    case 'goal':
      return Array.isArray(c.dirs) && c.dirs.every(isDir);
    default:
      return false;
  }
}

/** 保存データが盤面として使えるか（壊れていたら false） */
export function isBoard(x: unknown): x is Board {
  if (!x || typeof x !== 'object') return false;
  const b = x as Record<string, unknown>;
  if (typeof b.cols !== 'number' || typeof b.rows !== 'number') return false;
  if (b.cols < 1 || b.cols > 12 || b.rows < 1 || b.rows > 12) return false;
  if (!Array.isArray(b.cells) || b.cells.length !== b.rows) return false;
  return b.cells.every((row) => Array.isArray(row) && row.length === b.cols && row.every(isCell));
}
