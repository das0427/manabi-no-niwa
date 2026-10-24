/**
 * みちをつくろう の教材（盤面）。段階 R1〜R4 各8面。仕様: docs/learning-design.md 7章。
 *
 * 盤面は「完成した姿」を文字で書く。1マス1文字、1行が1つの文字列。
 *   S=スタート（向きは start）  G=ゴール（向きは goal）  #=いわ  .=空きマス
 *   うすい線の記号（─ │ ┌ ┐ ┘ └ ┬ ┤ ┴ ├）= 固定の道
 *   こい線の記号（━ ┃ ┏ ┓ ┛ ┗ ┳ ┫ ┻ ┣）= 空きマス（参考解でそこに置く道）
 * 向きは u=上 r=右 d=下 l=左。
 *   ┌=右と下  ┐=下と左  ┘=左と上  └=上と右   ┬=右・下・左  ┤=下・左・上  ┴=左・上・右  ├=上・右・下
 * `alt`（R4 だけ）はもう1つの正解の道。固定の道はそのまま書き、置く道だけを こい線 で書く。
 */
import type { Board, Cell, Dir, Placement, TileKind } from './board';
import { emptyBoard } from './board';

export interface RoadBoardDef {
  /** 'r1-1' など（保護者画面の itemKey） */
  id: string;
  /** 0=R1 … 3=R4 */
  level: 0 | 1 | 2 | 3;
  cols: number;
  rows: number;
  layout: readonly string[];
  start: string;
  goal: string;
  alt?: readonly string[];
}

const D: Record<string, Dir> = { u: 0, r: 1, d: 2, l: 3 };
export const parseDirs = (s: string): Dir[] => [...s].map((ch) => D[ch] as Dir);

interface Glyph {
  kind: TileKind;
  rot: number;
}

const LIGHT = '─│┌┐┘└┬┤┴├';
const HEAVY = '━┃┏┓┛┗┳┫┻┣';
const SHAPES: Glyph[] = [
  { kind: 'straight', rot: 0 },
  { kind: 'straight', rot: 1 },
  { kind: 'corner', rot: 0 },
  { kind: 'corner', rot: 1 },
  { kind: 'corner', rot: 2 },
  { kind: 'corner', rot: 3 },
  { kind: 'tee', rot: 0 },
  { kind: 'tee', rot: 1 },
  { kind: 'tee', rot: 2 },
  { kind: 'tee', rot: 3 },
];

/** 文字 → 道の種類と向き。こい線かどうかも返す */
export function glyphOf(ch: string): (Glyph & { heavy: boolean }) | null {
  const li = LIGHT.indexOf(ch);
  if (li >= 0) return { ...SHAPES[li]!, heavy: false };
  const hi = HEAVY.indexOf(ch);
  if (hi >= 0) return { ...SHAPES[hi]!, heavy: true };
  return null;
}

export interface ParsedBoard {
  def: RoadBoardDef;
  /** 初期の盤面 */
  board: Board;
  /** 参考解（1つ目が主。R4 は2つ目が別の道） */
  solutions: Placement[][];
}

function placementsOf(layout: readonly string[]): Placement[] {
  const out: Placement[] = [];
  layout.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      const g = glyphOf(ch);
      if (g?.heavy) out.push({ r, c, kind: g.kind, rot: g.rot });
    });
  });
  return out;
}

export function parseBoard(def: RoadBoardDef): ParsedBoard {
  const board = emptyBoard(def.cols, def.rows);
  def.layout.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      let cell: Cell = { t: 'empty' };
      if (ch === '#') cell = { t: 'rock' };
      else if (ch === 'S') cell = { t: 'start', dir: parseDirs(def.start)[0]! };
      else if (ch === 'G') cell = { t: 'goal', dirs: parseDirs(def.goal) };
      else {
        const g = glyphOf(ch);
        if (g && !g.heavy) cell = { t: 'fixed', kind: g.kind, rot: g.rot };
      }
      board.cells[r]![c] = cell;
    });
  });
  const solutions = [placementsOf(def.layout)];
  if (def.alt) solutions.push(placementsOf(def.alt));
  return { def, board, solutions };
}

// ---- R1: 1か所を埋める（4×3） ----
const R1: RoadBoardDef[] = [
  {
    id: 'r1-1',
    level: 0,
    cols: 4,
    rows: 3,
    layout: ['....', 'S━─G', '....'],
    start: 'r',
    goal: 'l',
  },
  {
    id: 'r1-2',
    level: 0,
    cols: 4,
    rows: 3,
    layout: ['S...', '┃...', '└──G'],
    start: 'd',
    goal: 'l',
  },
  {
    id: 'r1-3',
    level: 0,
    cols: 4,
    rows: 3,
    layout: ['S─┓.', '..│.', '..└G'],
    start: 'r',
    goal: 'l',
  },
  {
    id: 'r1-4',
    level: 0,
    cols: 4,
    rows: 3,
    layout: ['.┌─G', '.│..', 'S┛..'],
    start: 'r',
    goal: 'l',
  },
  {
    id: 'r1-5',
    level: 0,
    cols: 4,
    rows: 3,
    layout: ['.S..', '.┗─G', '....'],
    start: 'd',
    goal: 'l',
  },
  {
    id: 'r1-6',
    level: 0,
    cols: 4,
    rows: 3,
    layout: ['....', '┏──G', 'S...'],
    start: 'u',
    goal: 'l',
  },
  {
    id: 'r1-7',
    level: 0,
    cols: 4,
    rows: 3,
    layout: ['S┐..', '.└━┐', '...G'],
    start: 'r',
    goal: 'u',
  },
  {
    id: 'r1-8',
    level: 0,
    cols: 4,
    rows: 3,
    layout: ['S┐..', '.┃..', '.└─G'],
    start: 'r',
    goal: 'l',
  },
];

// ---- R2: 2〜3か所（直線と曲がり角）（4×3） ----
const R2: RoadBoardDef[] = [
  {
    id: 'r2-1',
    level: 1,
    cols: 4,
    rows: 3,
    layout: ['S━┓.', '..│.', '..└G'],
    start: 'r',
    goal: 'l',
  },
  {
    id: 'r2-2',
    level: 1,
    cols: 4,
    rows: 3,
    layout: ['┏──┐', '┃..│', 'S..G'],
    start: 'u',
    goal: 'u',
  },
  {
    id: 'r2-3',
    level: 1,
    cols: 4,
    rows: 3,
    layout: ['S...', '│..G', '┗━─┘'],
    start: 'd',
    goal: 'd',
  },
  {
    id: 'r2-4',
    level: 1,
    cols: 4,
    rows: 3,
    layout: ['S┓..', '.┗┓.', '..└G'],
    start: 'r',
    goal: 'l',
  },
  {
    id: 'r2-5',
    level: 1,
    cols: 4,
    rows: 3,
    layout: ['S.┌G', '┃.│.', '└━┘.'],
    start: 'd',
    goal: 'l',
  },
  {
    id: 'r2-6',
    level: 1,
    cols: 4,
    rows: 3,
    layout: ['.┏━┐', 'S┛.│', '...G'],
    start: 'r',
    goal: 'u',
  },
  {
    id: 'r2-7',
    level: 1,
    cols: 4,
    rows: 3,
    layout: ['G─┐.', '..┃.', 'S━┛.'],
    start: 'r',
    goal: 'r',
  },
  {
    id: 'r2-8',
    level: 1,
    cols: 4,
    rows: 3,
    layout: ['....', 'S┓.G', '.┗━┘'],
    start: 'r',
    goal: 'd',
  },
];

// ---- R3: いわを避ける（5×4） ----
const R3: RoadBoardDef[] = [
  {
    id: 'r3-1',
    level: 2,
    cols: 5,
    rows: 4,
    layout: ['.┌━┓.', 'S┛#└G', '.....', '...#.'],
    start: 'r',
    goal: 'l',
  },
  {
    id: 'r3-2',
    level: 2,
    cols: 5,
    rows: 4,
    layout: ['.....', '.....', 'S┓##G', '.┗━─┘'],
    start: 'r',
    goal: 'd',
  },
  {
    id: 'r3-3',
    level: 2,
    cols: 5,
    rows: 4,
    layout: ['..S..', '..┗┓.', '..#┃.', '..G┘.'],
    start: 'd',
    goal: 'r',
  },
  {
    id: 'r3-4',
    level: 2,
    cols: 5,
    rows: 4,
    layout: ['S┓...', '#┃...', '#│...', 'G┛...'],
    start: 'r',
    goal: 'r',
  },
  {
    id: 'r3-5',
    level: 2,
    cols: 5,
    rows: 4,
    layout: ['S─┓#.', '..┗─┓', '.#..│', '....G'],
    start: 'r',
    goal: 'u',
  },
  {
    id: 'r3-6',
    level: 2,
    cols: 5,
    rows: 4,
    layout: ['..#.G', '##┏─┛', '┏─┛..', 'S....'],
    start: 'u',
    goal: 'd',
  },
  {
    id: 'r3-7',
    level: 2,
    cols: 5,
    rows: 4,
    layout: ['S━┓..', '.#┃#.', '.#│#.', '..G..'],
    start: 'r',
    goal: 'u',
  },
  {
    id: 'r3-8',
    level: 2,
    cols: 5,
    rows: 4,
    layout: ['.┏━┓.', '.│#┃.', '.│#│.', '.S#G.'],
    start: 'u',
    goal: 'u',
  },
];

// ---- R4: 分かれ道（固定のT字）。どちらの道でも着く（5×4） ----
const R4: RoadBoardDef[] = [
  {
    id: 'r4-1',
    level: 3,
    cols: 5,
    rows: 4,
    layout: ['..┏━┓', 'S─┤.G', '....┘', '.....'],
    alt: ['.....', 'S─┤.G', '..┗━┘', '.....'],
    start: 'r',
    goal: 'ud',
  },
  {
    id: 'r4-2',
    level: 3,
    cols: 5,
    rows: 4,
    layout: ['.S...', '.├━┓.', '...┃.', '..G┛.'],
    alt: ['.S...', '.├...', '.┃...', '.┗G..'],
    start: 'd',
    goal: 'lr',
  },
  {
    id: 'r4-3',
    level: 3,
    cols: 5,
    rows: 4,
    layout: ['S─┬..', '..┃.│', '..│.│', '..┗━G'],
    alt: ['S─┬━┓', '....│', '..│.│', '....G'],
    start: 'r',
    goal: 'lu',
  },
  {
    id: 'r4-4',
    level: 3,
    cols: 5,
    rows: 4,
    layout: ['┏━┬─G', '┃....', '├....', 'S....'],
    alt: ['..┬─G', '..┃..', '├━┛..', 'S....'],
    start: 'u',
    goal: 'l',
  },
  {
    id: 'r4-5',
    level: 3,
    cols: 5,
    rows: 4,
    layout: ['..┏━┓', '..│.┃', 'S─┴.│', '....G'],
    alt: ['.....', '..│..', 'S─┴┓│', '...┗G'],
    start: 'r',
    goal: 'lu',
  },
  {
    id: 'r4-6',
    level: 3,
    cols: 5,
    rows: 4,
    layout: ['S....', '├..┐.', '│..G.', '┗━━┘.'],
    alt: ['S....', '├━━┐.', '│..G.', '...┘.'],
    start: 'd',
    goal: 'ud',
  },
  {
    id: 'r4-7',
    level: 3,
    cols: 5,
    rows: 4,
    layout: ['.┏━┓.', 'S┤#├G', '.....', '.....'],
    alt: ['.....', 'S┤#├G', '.┗━┛.', '.....'],
    start: 'r',
    goal: 'l',
  },
  {
    id: 'r4-8',
    level: 3,
    cols: 5,
    rows: 4,
    layout: ['...─G', '..│.┃', '....┃', 'S─┴━┛'],
    alt: ['..┏─G', '..│..', '..┃..', 'S─┴..'],
    start: 'r',
    goal: 'ld',
  },
];

export const LEVEL_BOARDS: readonly (readonly RoadBoardDef[])[] = [R1, R2, R3, R4];
export const ALL_BOARDS: readonly RoadBoardDef[] = [...R1, ...R2, ...R3, ...R4];

const cache = new Map<string, ParsedBoard>();

/** 定義 → 初期の盤面と参考解（同じ定義は同じ結果をキャッシュ） */
export function parsed(def: RoadBoardDef): ParsedBoard {
  let p = cache.get(def.id);
  if (!p) {
    p = parseBoard(def);
    cache.set(def.id, p);
  }
  return p;
}

// ---- じゆうに つくる ----
export const FREE_COLS = 5;
export const FREE_ROWS = 4;

/** 空の盤面＋スタートとゴール（スタートは左の2行目、ゴールは右の3行目） */
export function freeBoard(): Board {
  const b = emptyBoard(FREE_COLS, FREE_ROWS);
  b.cells[1]![0] = { t: 'start', dir: 1 };
  b.cells[2]![FREE_COLS - 1] = { t: 'goal', dirs: [3] };
  return b;
}
