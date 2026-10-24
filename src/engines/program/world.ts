/**
 * プログラミング的活動の「格子の世界」と命令の実行（純粋関数）。
 * 座標は [x, y]（0 始まり、左上が [0, 0]、右が x+、下が y+）。
 */

export type Dir = 'up' | 'right' | 'down' | 'left';
export type Cell = readonly [number, number];

/**
 * 動きの札。
 * - 向きで動く（小学生）: forward = まえに すすむ、turnRight = みぎを むく、turnLeft = ひだりを むく
 * - 方向で動く（幼児）: up・down・left・right = その方向に 1 マス（向きもそちらになる）
 */
export type MoveOp = 'forward' | 'turnRight' | 'turnLeft' | 'up' | 'down' | 'left' | 'right';
/** もし の条件: まえが かべ（格子の外を含む）／まえが あいている */
export type Cond = 'wall-ahead' | 'open-ahead';
/** くりかえす の回数（'goal' = ゴールに つくまで） */
export type RepeatTimes = number | 'goal';

export type Command =
  | { op: MoveOp }
  | { op: 'repeat'; times: RepeatTimes; body: Command[] }
  | { op: 'if'; cond: Cond; body: Command[] };

export type CardKind = MoveOp | 'repeat' | 'if';

export interface World {
  w: number;
  h: number;
  walls?: Cell[];
  start: { at: Cell; dir: Dir };
  goal: Cell;
}

export const RELATIVE_OPS: readonly MoveOp[] = ['forward', 'turnRight', 'turnLeft'];
export const ABSOLUTE_OPS: readonly MoveOp[] = ['up', 'down', 'left', 'right'];

const DELTA: Record<Dir, [number, number]> = {
  up: [0, -1],
  right: [1, 0],
  down: [0, 1],
  left: [-1, 0],
};
const ORDER: Dir[] = ['up', 'right', 'down', 'left'];
export const turn = (d: Dir, by: 1 | -1): Dir => ORDER[(ORDER.indexOf(d) + by + 4) % 4]!;

export const sameCell = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];

export function blocked(w: World, c: Cell): boolean {
  return (
    c[0] < 0 ||
    c[1] < 0 ||
    c[0] >= w.w ||
    c[1] >= w.h ||
    (w.walls ?? []).some((x) => sameCell(x, c))
  );
}

/** 1 手ごとの出来事（画面で 1 手ずつ見せる）。path は実行中の札の位置（入れ子の番号の列） */
export interface Step {
  kind: 'move' | 'turn' | 'bump' | 'check';
  at: Cell;
  dir: Dir;
  path: number[];
  /** check（もし）の結果 */
  ok?: boolean;
}

export type Outcome = 'goal' | 'bump' | 'short' | 'loop';

export interface RunResult {
  outcome: Outcome;
  steps: Step[];
  at: Cell;
  dir: Dir;
}

/** 実行の上限（無限のくりかえしを止める） */
export const MAX_STEPS = 200;
/** 「ゴールに つくまで」の回数の上限 */
export const MAX_UNTIL = 40;

class Stop extends Error {
  constructor(readonly outcome: Outcome) {
    super(outcome);
  }
}

export function run(world: World, program: readonly Command[]): RunResult {
  let at: Cell = world.start.at;
  let dir: Dir = world.start.dir;
  const steps: Step[] = [];
  const push = (s: Step) => {
    steps.push(s);
    if (steps.length >= MAX_STEPS) throw new Stop('loop');
  };
  const move = (d: Dir, path: number[]) => {
    const n: Cell = [at[0] + DELTA[d][0], at[1] + DELTA[d][1]];
    if (blocked(world, n)) {
      push({ kind: 'bump', at, dir, path });
      throw new Stop('bump');
    }
    at = n;
    push({ kind: 'move', at, dir, path });
    if (sameCell(at, world.goal)) throw new Stop('goal');
  };
  const exec = (cmds: readonly Command[], base: number[]) => {
    cmds.forEach((c, i) => {
      const path = [...base, i];
      switch (c.op) {
        case 'forward':
          move(dir, path);
          break;
        case 'turnRight':
        case 'turnLeft':
          dir = turn(dir, c.op === 'turnRight' ? 1 : -1);
          push({ kind: 'turn', at, dir, path });
          break;
        case 'up':
        case 'down':
        case 'left':
        case 'right':
          dir = c.op;
          move(c.op, path);
          break;
        case 'repeat': {
          const n = c.times === 'goal' ? MAX_UNTIL : c.times;
          for (let k = 0; k < n; k++) exec(c.body, path);
          if (c.times === 'goal') throw new Stop('loop');
          break;
        }
        case 'if': {
          const ahead: Cell = [at[0] + DELTA[dir][0], at[1] + DELTA[dir][1]];
          const wall = blocked(world, ahead);
          const ok = c.cond === 'wall-ahead' ? wall : !wall;
          push({ kind: 'check', at, dir, path, ok });
          if (ok) exec(c.body, path);
          break;
        }
      }
    });
  };
  try {
    if (sameCell(at, world.goal)) return { outcome: 'goal', steps, at, dir };
    exec(program, []);
    return { outcome: 'short', steps, at, dir };
  } catch (e) {
    if (e instanceof Stop) return { outcome: e.outcome, steps, at, dir };
    throw e;
  }
}

/** 札の数（くりかえす・もし の札も 1 まいと数え、中の札も数える） */
export function cardCount(program: readonly Command[]): number {
  return program.reduce(
    (n, c) => n + 1 + (c.op === 'repeat' || c.op === 'if' ? cardCount(c.body) : 0),
    0,
  );
}

/** 使っている札の種類 */
export function kindsUsed(program: readonly Command[], out = new Set<CardKind>()): Set<CardKind> {
  for (const c of program) {
    out.add(c.op);
    if (c.op === 'repeat' || c.op === 'if') kindsUsed(c.body, out);
  }
  return out;
}

/** すべての命令に関数を当てた新しい列 */
export function mapProgram(program: readonly Command[], f: (c: Command) => Command): Command[] {
  return program.map((c) => {
    const d = f(c);
    return d.op === 'repeat' || d.op === 'if' ? { ...d, body: mapProgram(d.body, f) } : d;
  });
}

/** みぎ と ひだり を入れ替えた列（左右の取り違えの推定） */
export function swapLeftRight(program: readonly Command[]): Command[] {
  const sw: Partial<Record<MoveOp, MoveOp>> = {
    turnRight: 'turnLeft',
    turnLeft: 'turnRight',
    left: 'right',
    right: 'left',
  };
  return mapProgram(program, (c) =>
    c.op !== 'repeat' && c.op !== 'if' && sw[c.op] ? { op: sw[c.op]! } : c,
  );
}

/** くりかえす の回数を 1 つだけ ±1 した列の一覧（回数の数え違いの推定） */
export function repeatVariants(program: readonly Command[]): Command[][] {
  const out: Command[][] = [];
  const walk = (cmds: readonly Command[], rebuild: (next: Command[]) => Command[]) => {
    cmds.forEach((c, i) => {
      const replace = (nc: Command) => rebuild(cmds.map((x, j) => (j === i ? nc : x)));
      if (c.op === 'repeat') {
        if (typeof c.times === 'number') {
          for (const d of [-1, 1])
            if (c.times + d >= 1) out.push(replace({ ...c, times: c.times + d }));
        }
        walk(c.body, (nb) => replace({ ...c, body: nb }));
      } else if (c.op === 'if') {
        walk(c.body, (nb) => replace({ ...c, body: nb }));
      }
    });
  };
  walk(program, (x) => x);
  return out;
}

/** 位置 path（入れ子の番号の列）の札を取り出す */
export function commandAt(
  program: readonly Command[],
  path: readonly number[],
): Command | undefined {
  let cmds: readonly Command[] = program;
  let c: Command | undefined;
  for (const i of path) {
    c = cmds[i];
    if (!c) return undefined;
    cmds = c.op === 'repeat' || c.op === 'if' ? c.body : [];
  }
  return c;
}

/** 入れ物（[] = いちばん外、ほかは くりかえす・もし の札の位置）の中身を f で変えた新しい列 */
export function updateContainer(
  program: readonly Command[],
  path: readonly number[],
  f: (body: Command[]) => Command[],
): Command[] {
  if (path.length === 0) return f([...program]);
  const [i, ...rest] = path;
  return program.map((c, j) =>
    j === i && (c.op === 'repeat' || c.op === 'if')
      ? { ...c, body: updateContainer(c.body, rest, f) }
      : c,
  );
}

/** 位置 path の札を外す（中の札ごと） */
export function removeAt(program: readonly Command[], path: readonly number[]): Command[] {
  const parent = path.slice(0, -1);
  const i = path[path.length - 1]!;
  return updateContainer(program, parent, (b) => b.filter((_, j) => j !== i));
}

/** 位置 path の札を c に置き換える（中の札はそのまま） */
export function replaceAt(
  program: readonly Command[],
  path: readonly number[],
  c: Command,
): Command[] {
  const parent = path.slice(0, -1);
  const i = path[path.length - 1]!;
  return updateContainer(program, parent, (b) => b.map((x, j) => (j === i ? c : x)));
}

/** 入れ子の深さ（いちばん外の札は 1） */
export function depthOf(program: readonly Command[]): number {
  return program.reduce(
    (d, c) => Math.max(d, 1 + (c.op === 'repeat' || c.op === 'if' ? depthOf(c.body) : 0)),
    0,
  );
}
