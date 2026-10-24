/**
 * prog-g16 の単元で共有する部品（このパックの中だけで使う。他のパックは import しない）。
 *
 * - 格子の地図（文字の絵）→ ProgramItem を作る
 * - 命令の実行（エンジン program/world.ts の run と同じ決まり。テストで一致を確かめる）
 * - 最短の手順（幅優先）、手順の文、ヒントの自動生成
 * - 地図の SVG 図（choice・order の問題で使う）
 * - 「どこに つく？」「どちらが ゴール？」「ならべかえ」の問題
 */
import { createRng, hashSeed } from '../../core/util/rng';
import { plainText } from '../../text/rich';
import type {
  ChoiceItem,
  ChoiceOption,
  OrderItem,
  ProgramItem,
  UnitSpec,
} from '../../curriculum/types';
import type { Command } from '../../engines/program/program';
import type { Figure } from '../../engines/figure/types';

export const REVISED = '2026-10-24';

export type Dir = 'up' | 'right' | 'down' | 'left';
export type Cell = [number, number];
export type Cmd = Command;
export type Cond = 'wall-ahead' | 'open-ahead';

export const F: Cmd = { op: 'forward' };
export const R: Cmd = { op: 'turnRight' };
export const L: Cmd = { op: 'turnLeft' };
export const rep = (times: number | 'goal', ...body: Cmd[]): Cmd => ({
  op: 'repeat',
  times,
  body,
});
export const iff = (cond: Cond, ...body: Cmd[]): Cmd => ({ op: 'if', cond, body });
/** 同じ札を n 枚 */
export const times = (n: number, c: Cmd): Cmd[] => Array.from({ length: n }, () => c);

// ---- 格子 ----

export interface Layout {
  w: number;
  h: number;
  walls: Cell[];
  start: Cell;
  goal: Cell;
  dir: Dir;
  /** G が地図に無い（ゴールを置かない図） */
  noGoal: boolean;
}

/** 地図の文字: # かべ／S はじめ／G ゴール／. あき */
export function layout(rows: readonly string[], dir: Dir): Layout {
  const h = rows.length;
  const w = rows[0]!.length;
  const walls: Cell[] = [];
  let start: Cell | undefined;
  let goal: Cell | undefined;
  for (let y = 0; y < h; y++) {
    const row = rows[y]!;
    if (row.length !== w) throw new Error(`地図の幅がそろっていない: ${row}`);
    for (let x = 0; x < w; x++) {
      const ch = row[x]!;
      if (ch === '#') walls.push([x, y]);
      else if (ch === 'S') start = [x, y];
      else if (ch === 'G') goal = [x, y];
      else if (ch !== '.') throw new Error(`地図に使えない文字 ${ch}`);
    }
  }
  if (!start) throw new Error('地図に S が無い');
  return { w, h, walls, start, goal: goal ?? [-1, -1], dir, noGoal: goal === undefined };
}

const DELTA: Record<Dir, [number, number]> = {
  up: [0, -1],
  right: [1, 0],
  down: [0, 1],
  left: [-1, 0],
};
const ORDER: Dir[] = ['up', 'right', 'down', 'left'];
const turnDir = (d: Dir, by: 1 | -1): Dir => ORDER[(ORDER.indexOf(d) + by + 4) % 4]!;
const same = (a: readonly number[], b: readonly number[]) => a[0] === b[0] && a[1] === b[1];

function blocked(l: Layout, c: Cell): boolean {
  return c[0] < 0 || c[1] < 0 || c[0] >= l.w || c[1] >= l.h || l.walls.some((x) => same(x, c));
}

export type Outcome = 'goal' | 'bump' | 'short' | 'loop';
export interface RunResult {
  outcome: Outcome;
  at: Cell;
  dir: Dir;
  /** 動いた・向いた・確かめた手の数 */
  steps: number;
  /** 通ったマス（はじめを含む） */
  trail: Cell[];
}

const MAX_STEPS = 200;
const MAX_UNTIL = 40;

class Stop extends Error {
  constructor(readonly outcome: Outcome) {
    super(outcome);
  }
}

/** エンジン program/world.ts の run と同じ決まりで実行する */
export function run(l: Layout, program: readonly Cmd[]): RunResult {
  let at: Cell = l.start;
  let dir: Dir = l.dir;
  let steps = 0;
  const trail: Cell[] = [l.start];
  const push = () => {
    steps += 1;
    if (steps >= MAX_STEPS) throw new Stop('loop');
  };
  const move = (d: Dir) => {
    const n: Cell = [at[0] + DELTA[d][0], at[1] + DELTA[d][1]];
    if (blocked(l, n)) {
      push();
      throw new Stop('bump');
    }
    at = n;
    trail.push(n);
    push();
    if (same(at, l.goal)) throw new Stop('goal');
  };
  const exec = (cmds: readonly Cmd[]) => {
    for (const c of cmds) {
      switch (c.op) {
        case 'forward':
          move(dir);
          break;
        case 'turnRight':
        case 'turnLeft':
          dir = turnDir(dir, c.op === 'turnRight' ? 1 : -1);
          push();
          break;
        case 'up':
        case 'down':
        case 'left':
        case 'right':
          dir = c.op;
          move(c.op);
          break;
        case 'repeat': {
          const n = c.times === 'goal' ? MAX_UNTIL : c.times;
          for (let k = 0; k < n; k++) exec(c.body);
          if (c.times === 'goal') throw new Stop('loop');
          break;
        }
        case 'if': {
          const ahead: Cell = [at[0] + DELTA[dir][0], at[1] + DELTA[dir][1]];
          const wall = blocked(l, ahead);
          const ok = c.cond === 'wall-ahead' ? wall : !wall;
          push();
          if (ok) exec(c.body);
          break;
        }
      }
    }
  };
  try {
    if (!l.noGoal && same(at, l.goal)) return { outcome: 'goal', at, dir, steps, trail };
    exec(program);
    return { outcome: 'short', at, dir, steps, trail };
  } catch (e) {
    if (e instanceof Stop) return { outcome: e.outcome, at, dir, steps, trail };
    throw e;
  }
}

export const reaches = (l: Layout, p: readonly Cmd[]) => run(l, p).outcome === 'goal';

/** 札の数（くりかえす・もし も 1 まい。中の札も数える） */
export function cardCount(p: readonly Cmd[]): number {
  return p.reduce(
    (n, c) => n + 1 + (c.op === 'repeat' || c.op === 'if' ? cardCount(c.body) : 0),
    0,
  );
}

export function mapCmds(p: readonly Cmd[], f: (c: Cmd) => Cmd): Cmd[] {
  return p.map((c) => {
    const d = f(c);
    return d.op === 'repeat' || d.op === 'if' ? { ...d, body: mapCmds(d.body, f) } : d;
  });
}

/** みぎ・ひだり を入れ替えた列 */
export function swapLR(p: readonly Cmd[]): Cmd[] {
  return mapCmds(p, (c) => (c.op === 'turnRight' ? L : c.op === 'turnLeft' ? R : c));
}

/** くりかえす の回数を 1 つだけ ±1 した列の一覧 */
export function repeatVariants(p: readonly Cmd[]): Cmd[][] {
  const out: Cmd[][] = [];
  const walk = (cmds: readonly Cmd[], rebuild: (next: Cmd[]) => Cmd[]) => {
    cmds.forEach((c, i) => {
      const replace = (nc: Cmd) => rebuild(cmds.map((x, j) => (j === i ? nc : x)));
      if (c.op === 'repeat') {
        if (typeof c.times === 'number')
          for (const d of [-1, 1])
            if (c.times + d >= 1) out.push(replace({ ...c, times: c.times + d }));
        walk(c.body, (nb) => replace({ ...c, body: nb }));
      } else if (c.op === 'if') {
        walk(c.body, (nb) => replace({ ...c, body: nb }));
      }
    });
  };
  walk(p, (x) => x);
  return out;
}

/** くりかえす を回数どおりに開いた、動きだけの列（回数が goal のものは開けない） */
export function flat(p: readonly Cmd[]): string[] {
  return p.flatMap((c): string[] => {
    if (c.op === 'repeat') {
      if (c.times === 'goal') throw new Error('つくまで は開けない');
      return Array.from({ length: c.times }, () => flat(c.body)).flat();
    }
    if (c.op === 'if') throw new Error('もし は開けない');
    return [c.op];
  });
}

/** 最短の手順（すすむ・みぎを むく・ひだりを むく）。着けなければ null */
export function shortest(l: Layout): Cmd[] | null {
  type S = { x: number; y: number; d: Dir };
  const key = (s: S) => `${s.x},${s.y},${s.d}`;
  const first: S = { x: l.start[0], y: l.start[1], d: l.dir };
  const prev = new Map<string, { from: string; c: Cmd } | null>([[key(first), null]]);
  const states = new Map<string, S>([[key(first), first]]);
  const queue: S[] = [first];
  for (let qi = 0; qi < queue.length; qi++) {
    const s = queue[qi]!;
    const next: [S, Cmd][] = [];
    const ahead: Cell = [s.x + DELTA[s.d][0], s.y + DELTA[s.d][1]];
    if (!blocked(l, ahead)) next.push([{ x: ahead[0], y: ahead[1], d: s.d }, F]);
    next.push([{ ...s, d: turnDir(s.d, 1) }, R]);
    next.push([{ ...s, d: turnDir(s.d, -1) }, L]);
    for (const [n, c] of next) {
      const k = key(n);
      if (prev.has(k)) continue;
      prev.set(k, { from: key(s), c });
      states.set(k, n);
      if (c === F && same([n.x, n.y], l.goal)) {
        const out: Cmd[] = [];
        let cur: string | undefined = k;
        while (cur) {
          const p: { from: string; c: Cmd } | null | undefined = prev.get(cur);
          if (!p) break;
          out.unshift(p.c);
          cur = p.from;
        }
        return out;
      }
      queue.push(n);
    }
  }
  return null;
}

// ---- 文 ----

export const CARD_NAME: Record<string, string> = {
  forward: 'すすむ',
  turnRight: 'みぎを むく',
  turnLeft: 'ひだりを むく',
  up: 'うえ',
  down: 'した',
  left: 'ひだり',
  right: 'みぎ',
  repeat: 'くりかえす',
  if: 'もし',
};
const timesName = (t: number | 'goal') => (t === 'goal' ? 'つくまで' : `${t}かい`);
const condName: Record<Cond, string> = {
  'wall-ahead': 'まえが かべなら',
  'open-ahead': 'まえが あいていたら',
};

/** 手順を文で（エンジンの programText と同じ書き方） */
export function cmdText(p: readonly Cmd[]): string {
  return p
    .map((c) =>
      c.op === 'repeat'
        ? `くりかえす ${timesName(c.times)}（${cmdText(c.body)}）`
        : c.op === 'if'
          ? `もし ${condName[c.cond]}（${cmdText(c.body)}）`
          : CARD_NAME[c.op]!,
    )
    .join('、');
}

/** 同じ札が続くところをまとめた言い方（「すすむ」を 3かい） */
export function phrases(p: readonly Cmd[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < p.length;) {
    const c = p[i]!;
    if (c.op === 'repeat' || c.op === 'if') {
      out.push(`「${cmdText([c])}」`);
      i += 1;
      continue;
    }
    let j = i;
    while (j < p.length && p[j]!.op === c.op) j++;
    const n = j - i;
    out.push(n === 1 ? `「${CARD_NAME[c.op]}」` : `「${CARD_NAME[c.op]}」を ${n}かい`);
    i = j;
  }
  return out;
}

/** 札の言葉を、同じ札が続くところをまとめて（解説用） */
export const say = (p: readonly Cmd[]) => phrases(p).join('、つぎに ');

// ---- ヒントの自動生成 ----

function relative(l: Layout): string {
  const dx = l.goal[0] - l.start[0];
  const dy = l.goal[1] - l.start[1];
  const parts: string[] = [];
  if (dx !== 0) parts.push(`${dx > 0 ? 'みぎ' : 'ひだり'}に ${Math.abs(dx)}マス`);
  if (dy !== 0) parts.push(`${dy > 0 ? 'した' : 'うえ'}に ${Math.abs(dy)}マス`);
  return `ゴールは、はじめの ばしょから ${parts.join('、')} はなれた ところだよ。`;
}

/** 解のはじめの半分だけを言う（最後の一手は残す） */
function firstHalf(sol: readonly Cmd[]): string {
  if (sol.length <= 1) return '';
  let n = Math.max(1, Math.floor(sol.length / 2));
  // 同じ札が続くところの途中で切らない
  while (n < sol.length - 1 && sol[n]!.op === sol[n - 1]!.op) n++;
  if (n >= sol.length) n = sol.length - 1;
  return `はじめは ${phrases(sol.slice(0, n)).join('、つぎに ')}。そのあとは どうなるかな。`;
}

export function autoHints(l: Layout, sol: readonly Cmd[]): string[] {
  return [
    'キャラクターは どちらを むいて いるかな。ゴールは どっちに あるかな。',
    relative(l),
    firstHalf(sol) || 'ゴールまで あと ひとつ マスを すすむよ。かべに ぶつからないように しよう。',
  ];
}

// ---- 地図の SVG ----

const CELL = 36;
const PAD = 4;
const STAR = (cx: number, cy: number) => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 13 : 5.5;
    const a = (-90 + i * 36) * (Math.PI / 180);
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
};
const ANGLE: Record<Dir, number> = { up: 0, right: 90, down: 180, left: 270 };

export type MarkShape = 'circle' | 'triangle' | 'square';
/** 選択肢の ラベルに つける 形の 字（図の しるしと そろえる） */
export const SHAPE_GLYPH: Record<MarkShape, string> = {
  circle: '○',
  triangle: '△',
  square: '□',
};
export const SHAPE_NAME: Record<MarkShape, string> = {
  circle: 'まる',
  triangle: 'さんかく',
  square: 'しかく',
};

/** 地図の図。start はキャラクター（矢印）、goal は星、marks は ○△□ の印 */
export function gridFigure(
  l: Layout,
  opt: { marks?: { at: Cell; shape: MarkShape }[]; label?: string; hU?: number } = {},
): Figure {
  const W = l.w * CELL + PAD * 2;
  const H = l.h * CELL + PAD * 2;
  const cx = (x: number) => PAD + x * CELL + CELL / 2;
  const cy = (y: number) => PAD + y * CELL + CELL / 2;
  let body = '';
  for (let y = 0; y < l.h; y++)
    for (let x = 0; x < l.w; x++) {
      const wall = l.walls.some((c) => same(c, [x, y]));
      const px = PAD + x * CELL;
      const py = PAD + y * CELL;
      body += `<rect x="${px}" y="${py}" width="${CELL}" height="${CELL}" fill="${wall ? 'var(--disabled)' : 'var(--white)'}" stroke="var(--ink-soft)" stroke-width="1.5"/>`;
      if (wall)
        body += `<path d="M${px + 6} ${py + 6} L${px + CELL - 6} ${py + CELL - 6} M${px + CELL - 6} ${py + 6} L${px + 6} ${py + CELL - 6}" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" fill="none"/>`;
    }
  if (!l.noGoal)
    body += `<polygon points="${STAR(cx(l.goal[0]), cy(l.goal[1]))}" fill="var(--sun)" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>`;
  for (const m of opt.marks ?? []) {
    if (same(m.at, l.start)) throw new Error('印がはじめの位置に重なる');
    const x = cx(m.at[0]);
    const y = cy(m.at[1]);
    if (m.shape === 'circle')
      body += `<circle cx="${x}" cy="${y}" r="11" fill="var(--sky)" stroke="var(--ink)" stroke-width="2.5"/>`;
    else if (m.shape === 'triangle')
      body += `<polygon points="${x},${y - 12} ${x + 12},${y + 9} ${x - 12},${y + 9}" fill="var(--sun)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/>`;
    else
      body += `<rect x="${x - 10}" y="${y - 10}" width="20" height="20" fill="var(--wood)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/>`;
  }
  body += `<g transform="translate(${cx(l.start[0])} ${cy(l.start[1])}) rotate(${ANGLE[l.dir]})"><polygon points="0,-13 10,-2 4,-2 4,12 -4,12 -4,-2 -10,-2" fill="var(--leaf)" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/></g>`;
  return {
    kind: 'svg',
    label: opt.label ?? 'ますの ず',
    // 作業領域は高さに限りがある（選択肢や札と同じ領域に入れる）ので、高さ hU（--u の何個分）に合わせて小さくする
    markup: `<svg viewBox="0 0 ${W} ${H}" style="height:calc(var(--u) * ${gridHeightU(l, opt.hU).toFixed(1)})" xmlns="http://www.w3.org/2000/svg">${body}</svg>`,
  };
}

/** 地図の図の高さ（--u の何個分）。1マスは 3.6 まで、全体で hU（既定 9）に収める */
function gridHeightU(l: Layout, hU = 9): number {
  const cell = Math.min(3.6, hU / l.h, 40 / l.w);
  return ((l.h * CELL + PAD * 2) / CELL) * cell;
}

// ---- 問題 ----

/** キャラクターとゴールの組（絵は既存の IllustId） */
const CAST = [
  { c: 'rabbit', g: 'carrot', cn: 'うさぎ', gn: 'にんじん' },
  { c: 'monkey', g: 'banana', cn: 'さる', gn: 'バナナ' },
  { c: 'bear', g: 'apple', cn: 'くま', gn: 'りんご' },
  { c: 'dog', g: 'ball', cn: 'いぬ', gn: 'ボール' },
  { c: 'turtle', g: 'watermelon', cn: 'かめ', gn: 'すいか' },
  { c: 'frog', g: 'leaf', cn: 'かえる', gn: 'はっぱ' },
  { c: 'chick', g: 'egg', cn: 'ひよこ', gn: 'たまご' },
] as const;

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export const MOVE_PALETTE: ProgramItem['palette'] = ['forward', 'turnRight', 'turnLeft'];

/** 誤概念ID（単元ごとに別の ID を使ってよい。付けた ID は単元の misconceptions に定義すること） */
export interface ProgMis {
  bump: string;
  short: string;
  turn: string;
  repeatCount?: string;
  tooMany?: string;
}

export interface PuzzleSpec {
  id: string;
  obj: string;
  level: number;
  rows: readonly string[];
  dir: Dir;
  /** 正答の例。省略すると最短の手順 */
  solution?: Cmd[];
  palette?: ProgramItem['palette'];
  /** 問題文の先頭の文を差し替える（省略すると「◯◯を ◯◯の ところまで つれて いこう。」） */
  lead?: string;
  /** 問題文に足す文 */
  note?: string;
  initial?: Cmd[];
  maxCards?: number;
  repeatTimes?: ProgramItem['repeatTimes'];
  conds?: ProgramItem['conds'];
  hints?: [string, string, string];
  /** 解説の「どうして」の部分 */
  why?: string;
  alt?: boolean;
  mis: ProgMis;
  /** キャラクターの組の番号（省略すると id から決める） */
  cast?: number;
}

export function puzzle(s: PuzzleSpec): ProgramItem {
  const l = layout(s.rows, s.dir);
  const sol = s.solution ?? shortest(l);
  if (!sol) throw new Error(`${s.id}: ゴールに着けない地図`);
  const cast = CAST[(s.cast ?? hash(s.id)) % CAST.length]!;
  const wallIllust = hash(`${s.id}w`) % 3 === 0 ? 'tree' : 'rock';
  const lead = s.lead ?? `${cast.cn}を ${cast.gn}の ところまで つれて いこう。`;
  const prompt = [lead, s.maxCards ? `ふだは ${s.maxCards}まいまで。` : '', s.note ?? '']
    .filter(Boolean)
    .join(' ');
  const item: ProgramItem = {
    engine: 'program',
    id: s.id,
    objective: s.obj,
    level: s.level,
    prompt,
    grid: { w: l.w, h: l.h, ...(l.walls.length ? { walls: l.walls } : {}) },
    start: { at: l.start, dir: l.dir },
    goal: l.goal,
    palette: s.palette ?? MOVE_PALETTE,
    solution: sol,
    ...(s.initial ? { initial: s.initial } : {}),
    ...(s.maxCards ? { maxCards: s.maxCards } : {}),
    ...(s.repeatTimes ? { repeatTimes: s.repeatTimes } : {}),
    ...(s.conds ? { conds: s.conds } : {}),
    misconceptionIds: s.mis,
    character: cast.c,
    goalIllust: cast.g,
    wallIllust,
    hints: s.hints ?? (autoHints(l, sol) as [string, string, string]),
    explain: `たとえば ${say(sol)}。${s.why ?? ''}`.trim(),
    identity: s.id,
    ...(s.alt ? { alt: true } : {}),
  };
  return item;
}

export interface OptSpec {
  /** 正解 */
  right: string;
  /** 誤り: [文, 誤概念ID?] */
  wrongs: readonly (readonly [string, string?])[];
}
export function opts(o: OptSpec): ChoiceOption[] {
  return [
    { label: o.right, correct: true },
    ...o.wrongs.map(([label, m]) => (m ? { label, misconception: m } : { label })),
  ];
}

export interface ChoiceSpec {
  id: string;
  obj: string;
  level: number;
  prompt: string;
  figure?: Figure;
  right: string;
  wrongs: readonly (readonly [string, string?])[];
  hints: [string, string, string];
  explain: string;
  alt?: boolean;
  layout?: 'row' | 'grid' | 'column';
}

/**
 * 作業領域（高さ 約 23〜27 u。問題文が長いほど せまい）に入るように、選択肢の出し方を決める。
 * 選択肢のカードは文が 1行に そのまま ならぶので、長いと よこに ならばない。
 * - ラベルが すべて 7字まで: よこに ならべる（3〜4つ）
 * - 3つ以上で、問題文が 1行・ラベルが 28字まで・図なし: 選択肢を問題文の下に 1・2・3 と ならべて書き、
 *   ボタンは「1」「2」「3」だけにする（音声でも読まれる）
 * - それ以外: 正解と 誤り1つの 2つにする（図なしで 12字までなら よこに、それ以外は たてに）
 */
export function promptLineCount(prompt: string): number {
  return prompt
    .split('\n')
    .reduce((n, l) => n + Math.max(1, Math.ceil(plainText(l).length / 30)), 0);
}

export interface FitChoice {
  prompt: string;
  options: ChoiceOption[];
  layout: 'row' | 'column';
  fixedOrder?: boolean;
}

export function fitChoice(
  id: string,
  prompt: string,
  right: string,
  wrongs: readonly (readonly [string, string?])[],
  hasFigure: boolean,
): FitChoice {
  const mk = (rs: readonly (readonly [string, string?])[]): ChoiceOption[] =>
    opts({ right, wrongs: rs });
  const all = [right, ...wrongs.map((w) => w[0])];
  const max = Math.max(...all.map((x) => plainText(x).length));
  if (max <= 7) return { prompt, options: mk(wrongs), layout: 'row' };
  if (wrongs.length >= 2 && !hasFigure && promptLineCount(prompt) <= 1 && max <= 28) {
    const n = wrongs.length + 1;
    const at = hash(id) % n;
    const entries = [
      ...wrongs.slice(0, at).map((w) => ({ label: w[0], mis: w[1], ok: false })),
      { label: right, mis: undefined, ok: true },
      ...wrongs.slice(at).map((w) => ({ label: w[0], mis: w[1], ok: false })),
    ];
    return {
      prompt: `${prompt}\n${entries.map((e, i) => `${i + 1}：${e.label}`).join('\n')}`,
      options: entries.map((e, i) => ({
        label: String(i + 1),
        ...(e.ok ? { correct: true } : e.mis ? { misconception: e.mis } : {}),
      })),
      layout: 'row',
      fixedOrder: true,
    };
  }
  const two = wrongs.slice(0, 1);
  return {
    prompt,
    options: mk(two),
    layout: !hasFigure || max > 12 ? 'column' : 'row',
  };
}

export function choiceItem(s: ChoiceSpec): ChoiceItem {
  const fit = fitChoice(s.id, s.prompt, s.right, s.wrongs, !!s.figure);
  return {
    engine: 'choice',
    id: s.id,
    objective: s.obj,
    level: s.level,
    prompt: fit.prompt,
    ...(s.figure ? { figure: s.figure } : {}),
    options: fit.options,
    layout: fit.layout,
    ...(fit.fixedOrder ? { fixedOrder: true } : {}),
    hints: s.hints,
    explain: s.explain,
    identity: s.id,
    ...(s.alt ? { alt: true } : {}),
  };
}
const SHAPES: MarkShape[] = ['circle', 'triangle', 'square'];

/** もし の札を、いつも動かす（always）か いつも動かさない（!always）形にした列 */
function flattenIf(p: readonly Cmd[], always: boolean): Cmd[] {
  return p.flatMap((c): Cmd[] => {
    if (c.op === 'if') return always ? flattenIf(c.body, always) : [];
    if (c.op === 'repeat') return [{ ...c, body: flattenIf(c.body, always) }];
    return [c];
  });
}

export interface LandingSpec {
  id: string;
  obj: string;
  level: number;
  rows: readonly string[];
  dir: Dir;
  prog: Cmd[];
  mis: { turn: string; short: string; count: string; cond?: string };
  /** 正解の印の位置をずらす（0〜2） */
  rot?: number;
  alt?: boolean;
  /** 問題文の先頭に足す文 */
  promptHead?: string;
  hints?: [string, string, string];
}

/** 「この てじゅんで うごくと、どこに つく？」（地図に ○△□ の印。ゴールは置かない） */
export function landingItem(s: LandingSpec): ChoiceItem {
  const l = layout(s.rows, s.dir);
  const r = run(l, s.prog);
  if (r.outcome !== 'short') throw new Error(`${s.id}: 実行が ${r.outcome} で終わる`);
  const real = r.at;
  const cands: { at: Cell; m: string }[] = [];
  const tryAdd = (p: Cmd[], m: string) => {
    const x = run(l, p);
    if (x.outcome === 'bump' || x.outcome === 'loop') return;
    if (same(x.at, real) || same(x.at, l.start)) return;
    if (cands.some((c) => same(c.at, x.at))) return;
    cands.push({ at: x.at, m });
  };
  tryAdd(swapLR(s.prog), s.mis.turn);
  if (s.mis.cond) {
    // もし の札の条件を見なかった（いつも動かす・いつも動かさない）
    tryAdd(flattenIf(s.prog, true), s.mis.cond);
    tryAdd(flattenIf(s.prog, false), s.mis.cond);
  }
  for (const v of repeatVariants(s.prog)) tryAdd(v, s.mis.count);
  tryAdd(s.prog.slice(0, -1), s.mis.short);
  tryAdd([...s.prog, F], s.mis.count);
  const firstF = s.prog.findIndex((c) => c.op === 'forward');
  if (firstF >= 0) tryAdd([...s.prog.slice(0, firstF), F, ...s.prog.slice(firstF)], s.mis.count);
  if (same(real, l.start)) throw new Error(`${s.id}: 正解の位置がはじめと同じ`);
  if (cands.length < 2) throw new Error(`${s.id}: 誤りの候補が足りない`);
  const rot = s.rot ?? hash(s.id) % 3;
  // 印 3つ: 正解が rot 番目の形になるよう並べる
  const all = [{ at: real, m: '' }, cands[0]!, cands[1]!];
  const placed: ({ at: Cell; m: string } | undefined)[] = [undefined, undefined, undefined];
  placed[rot] = all[0];
  let k = 1;
  for (let i = 0; i < 3; i++) if (!placed[i]) placed[i] = all[k++];
  const marks = placed.map((p, i) => ({ at: p!.at, shape: SHAPES[i]! }));
  const options: ChoiceOption[] = placed.map((p, i) => ({
    label: `${SHAPE_GLYPH[SHAPES[i]!]} ${SHAPE_NAME[SHAPES[i]!]}`,
    ...(i === rot ? { correct: true } : { misconception: p!.m }),
  }));
  return {
    engine: 'choice',
    id: s.id,
    objective: s.obj,
    level: s.level,
    prompt: s.promptHead ?? 'つぎの てじゅんで うごくと、どこに つくかな。',
    figure: stripsColumn(
      [
        gridFigure(l, {
          marks,
          label: 'ますの ず。まる・さんかく・しかくの しるしが ある',
          hU: 7.5,
        }),
        stripFigure(s.prog, { label: `てじゅんの ふだ: ${cmdText(s.prog)}`, hU: 4.5 }),
      ],
      1.2,
    ),
    options,
    hints: s.hints ?? [
      'キャラクターの むきを みて、ふだを ひとつずつ ゆびで たどろう。',
      'すすむ ふだは マスを ひとつ すすむ。みぎを むく・ひだりを むく は その ばしょで むきだけ かえるよ。',
      `${phrases(s.prog.slice(0, Math.max(1, s.prog.length - 2))).join('、つぎに ')}まで たどると、のこりは あとふたつの ふだだよ。`,
    ],
    explain: `${say(s.prog)}と うごくと、${SHAPE_NAME[SHAPES[rot]!]}の ところに つくよ。ふだを じゅんばんに たどって たしかめよう。`,
    identity: s.id,
    ...(s.alt ? { alt: true } : {}),
  };
}

export interface CompareSpec {
  id: string;
  obj: string;
  level: number;
  rows: readonly string[];
  dir: Dir;
  /** 正しい手順（省略すると最短） */
  prog?: Cmd[];
  mis: { order: string; turn: string };
  /** 誤りの手順を自分で決める（省略すると、入れかえ・左右の取り違え） */
  wrongs?: [Cmd[], string][];
  alt?: boolean;
  prompt?: string;
}

/** 「ゴールに つく てじゅんは どれ？」（順序をかえた手順・左右を取り違えた手順と比べる） */
export function compareItem(s: CompareSpec): ChoiceItem {
  const l = layout(s.rows, s.dir);
  const good = s.prog ?? shortest(l);
  if (!good || !reaches(l, good)) throw new Error(`${s.id}: 正しい手順がゴールに着かない`);
  const wrongs: [string, string][] = [];
  const seen = new Set([cmdText(good)]);
  const add = (p: Cmd[], m: string) => {
    const t = cmdText(p);
    if (!t || seen.has(t) || reaches(l, p)) return;
    seen.add(t);
    wrongs.push([t, m]);
  };
  if (s.wrongs) for (const [p, m] of s.wrongs) add(p, m);
  else {
    // 入れかえ: となりあう違う札を入れかえる
    for (let i = 0; i + 1 < good.length && wrongs.length < 1; i++)
      if (good[i]!.op !== good[i + 1]!.op) {
        const q = [...good];
        [q[i], q[i + 1]] = [q[i + 1]!, q[i]!];
        add(q, s.mis.order);
      }
    add(swapLR(good), s.mis.turn);
    if (wrongs.length < 2) {
      // 最後の札をなくす
      add(good.slice(0, -1), s.mis.order);
    }
  }
  if (wrongs.length < 2) throw new Error(`${s.id}: 誤りの手順が足りない`);
  return choiceItem({
    id: s.id,
    obj: s.obj,
    level: s.level,
    prompt:
      s.prompt ?? 'ふだの ならべかたが ちがう てじゅんが あるよ。ゴールに つくのは どれかな。',
    figure: gridFigure(l, { label: 'ますの ず。ほしが ゴール', hU: 7.5 }),
    right: cmdText(good),
    // 作業領域に入る数: ながい 手順は 2つ（よこに ならべる）
    wrongs: wrongs.slice(0, 1),
    layout: 'row',
    hints: [
      'ほしの ばしょを たしかめて、キャラクターが どちらを むいて いるか みよう。',
      'どの てじゅんも、さいしょの ふだから ひとつずつ たどって みよう。',
      'かべや そとに ぶつかる てじゅんや、ほしの てまえで おわる てじゅんは ちがうよ。',
    ],
    explain: `「${cmdText(good)}」だと ゴールに つくよ。ふだの じゅんばんが かわると、とまる ばしょも かわるよ。`,
    alt: s.alt,
  });
}

export interface OrderSpec {
  id: string;
  obj: string;
  level: number;
  rows: readonly string[];
  dir: Dir;
  prog?: Cmd[];
  mis: { order: string };
  alt?: boolean;
  prompt?: string;
}

function permutations(n: number): number[][] {
  const out: number[][] = [];
  const rec = (cur: number[], rest: number[]) => {
    if (rest.length === 0) {
      out.push(cur);
      return;
    }
    rest.forEach((v, i) => rec([...cur, v], [...rest.slice(0, i), ...rest.slice(i + 1)]));
  };
  rec(
    [],
    Array.from({ length: n }, (_, i) => i),
  );
  return out;
}

/** 札をならべかえて、ゴールに着く順にする */
export function orderItem(s: OrderSpec): OrderItem {
  const l = layout(s.rows, s.dir);
  const good = s.prog ?? shortest(l);
  if (!good || !reaches(l, good)) throw new Error(`${s.id}: 正しい手順がゴールに着かない`);
  if (good.length < 3 || good.length > 6)
    throw new Error(`${s.id}: 札は 3〜6 まい（今 ${good.length}）`);
  const label = (c: Cmd) => CARD_NAME[c.op]!;
  const keyOf = (idx: number[]) => idx.map((i) => label(good[i]!)).join('|');
  const canon = good.map((_, i) => i);
  const seen = new Set([keyOf(canon)]);
  const alsoAccept: number[][] = [];
  for (const p of permutations(good.length)) {
    const k = keyOf(p);
    if (seen.has(k)) continue;
    const ok = reaches(
      l,
      p.map((i) => good[i]!),
    );
    if (ok) {
      seen.add(k);
      alsoAccept.push(p);
    }
  }
  // 誤りの順の例: となりあう違う札を入れかえたもの
  const wrongOrders: { order: number[]; misconception: string }[] = [];
  for (let i = 0; i + 1 < good.length && wrongOrders.length < 2; i++)
    if (good[i]!.op !== good[i + 1]!.op) {
      const q = [...canon];
      [q[i], q[i + 1]] = [q[i + 1]!, q[i]!];
      const k = keyOf(q);
      if (
        !seen.has(k) &&
        !reaches(
          l,
          q.map((v) => good[v]!),
        )
      ) {
        seen.add(k);
        wrongOrders.push({ order: q, misconception: s.mis.order });
      }
    }
  return {
    engine: 'order',
    id: s.id,
    objective: s.obj,
    level: s.level,
    prompt: s.prompt ?? 'ゴールに つくように、ふだを ならべよう。',
    figure: gridFigure(l, { label: 'ますの ず。ほしが ゴール', hU: 6.5 }),
    cards: good.map((c) => ({ label: label(c) })),
    ...(alsoAccept.length ? { alsoAccept } : {}),
    ...(wrongOrders.length ? { wrongOrders } : {}),
    ends: ['はじめ', 'おわり'],
    hints: [
      'キャラクターの むきと、ほしの ばしょを みよう。',
      'さいしょに どちらへ すすむ ふだが くるか かんがえよう。',
      'まがる ふだは、まがりたい ばしょに ついてから ならべるよ。',
    ],
    explain: `${say(good)}の じゅんに ならべると ゴールに つくよ。じゅんばんが かわると、つく ばしょも かわるよ。`,
    identity: s.id,
    ...(s.alt ? { alt: true } : {}),
  };
}

/** 単元の共通の既定値 */
export function baseUnit(
  id: string,
  stage: 'g1' | 'g2' | 'g3' | 'g4' | 'g5' | 'g6',
): Pick<
  UnitSpec,
  | 'id'
  | 'stage'
  | 'subject'
  | 'domain'
  | 'kind'
  | 'priority'
  | 'status'
  | 'icon'
  | 'review'
  | 'revised'
> {
  return {
    id,
    stage,
    subject: 'prog',
    domain: 'prog',
    kind: 'concept',
    priority: 'P1',
    status: 'ready',
    icon: 'subj-program',
    review: 'objective',
    revised: REVISED,
  };
}

/** 誤概念の定義（どの単元でも使う基本の3つ） */
export const BASE_MIS = [
  {
    id: 'bump',
    explain:
      'かべや ますの そとに ぶつかったのかな。すすむ まえに、キャラクターが どちらを むいて いるか たしかめよう。',
  },
  {
    id: 'short',
    explain:
      'ゴールの てまえで おわったのかな。ゴールまで マスが いくつ あるか かぞえて、ふだを たそう。',
  },
  {
    id: 'turn',
    explain: 'みぎと ひだりを まちがえたのかな。キャラクターから みて、みぎ・ひだり を きめよう。',
  },
] as const;

// ---- 地図の部品 ----

/** 地図を左右反転する（S・G・# はそのまま。向きは呼び出し側で left/right を入れかえる） */
export const mirrorH = (rows: readonly string[]): string[] =>
  rows.map((r) => [...r].reverse().join(''));

/**
 * うずまきの道。S は左上、右へ進み、時計まわりにうずを巻いて、道の終わりが G。
 * 道のほかは かべ。道と道のあいだは かべ 1マス。
 * 「ずっと くりかえす: もし まえが かべなら みぎを むく、すすむ」で、かならず G に着く。
 */
export function spiral(w: number, h: number): string[] {
  if (w < 3 || h < 3) throw new Error('うずまきは 3×3 いじょう');
  const seen = new Set<string>(['0,0']);
  const path: Cell[] = [[0, 0]];
  let at: Cell = [0, 0];
  let dir: Dir = 'right';
  const inside = (c: Cell) => c[0] >= 0 && c[1] >= 0 && c[0] < w && c[1] < h;
  const add = (c: Cell, d: Dir): Cell => [c[0] + DELTA[d][0], c[1] + DELTA[d][1]];
  for (let guard = 0; guard < 400; guard++) {
    let moved = false;
    for (let t = 0; t < 4 && !moved; t++) {
      const n = add(at, dir);
      const nn = add(n, dir);
      if (inside(n) && !seen.has(n.join(',')) && !(inside(nn) && seen.has(nn.join(',')))) {
        at = n;
        seen.add(n.join(','));
        path.push(n);
        moved = true;
      } else dir = turnDir(dir, 1);
    }
    if (!moved) break;
  }
  const goal = path[path.length - 1]!;
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++)
      row +=
        x === 0 && y === 0
          ? 'S'
          : x === goal[0] && y === goal[1]
            ? 'G'
            : seen.has(`${x},${y}`)
              ? '.'
              : '#';
    rows.push(row);
  }
  return rows;
}

/**
 * かべの一部をあけて、行き止まりの出っぱりを作る。
 * 条件: 決まりの手順（rule）で通る道が変わらない／近道ができない。
 */
export function addDecoys(
  rows: readonly string[],
  dir: Dir,
  rule: readonly Cmd[],
  seed: string,
  count: number,
): string[] {
  const rng = createRng(hashSeed('decoy', seed));
  let cur = [...rows];
  const base = layout(cur, dir);
  const baseTrail = run(base, rule)
    .trail.map((c) => c.join(','))
    .join(';');
  const baseLen = shortest(base)!.length;
  const walls = rng.shuffle(base.walls);
  let made = 0;
  for (const [x, y] of walls) {
    if (made >= count) break;
    const next = cur.map((r, yy) => (yy === y ? r.slice(0, x) + '.' + r.slice(x + 1) : r));
    const l = layout(next, dir);
    const r = run(l, rule);
    if (r.outcome !== 'goal') continue;
    if (r.trail.map((c) => c.join(',')).join(';') !== baseTrail) continue;
    if (shortest(l)!.length < baseLen) continue;
    cur = next;
    made++;
  }
  return cur;
}
/** 同じ札が3つ以上つづくところを「くりかえす」にまとめる（6回まで） */
export function compressRuns(cmds: readonly Cmd[]): Cmd[] {
  const out: Cmd[] = [];
  for (let i = 0; i < cmds.length;) {
    const c = cmds[i]!;
    let j = i;
    while (j < cmds.length && cmds[j]!.op === c.op && c.op !== 'repeat' && c.op !== 'if') j++;
    const n = j - i;
    if (n >= 3 && n <= 6) {
      out.push(rep(n, c));
      i = j;
    } else {
      out.push(c);
      i += 1;
    }
  }
  return out;
}
export interface FixSpec {
  id: string;
  obj: string;
  level: number;
  rows: readonly string[];
  dir: Dir;
  /** うまく動かない手順 */
  bad: Cmd[];
  /** なおし方の候補（ラベルは 10字ほどまでの みじかい ことば）。先頭が正解（それでゴールに着く）、あとは着かないもの */
  fixes: { label: string; prog: Cmd[]; mis?: string }[];
  alt?: boolean;
  hints?: [string, string, string];
  explain: string;
}

/** 「どこを なおせば ゴールに つくかな？」（なおす ところを選ぶ。選択肢はよこに ならべる） */
export function fixChoice(s: FixSpec): ChoiceItem {
  const l = layout(s.rows, s.dir);
  if (reaches(l, s.bad)) throw new Error(`${s.id}: うまく動かない手順がゴールに着く`);
  s.fixes.forEach((f, i) => {
    const ok = reaches(l, f.prog);
    if (i === 0 && !ok) throw new Error(`${s.id}: 正解のなおし方でゴールに着かない`);
    if (i > 0 && ok) throw new Error(`${s.id}: 誤りのなおし方でもゴールに着く: ${f.label}`);
  });
  return choiceItem({
    id: s.id,
    obj: s.obj,
    level: s.level,
    alt: s.alt,
    prompt: 'ロボットが ゴールに つかないよ。どこを なおせば いいかな。',
    figure: stripsColumn(
      [
        gridFigure(l, { label: 'ますの ず。ほしが ゴール', hU: 6.2 }),
        stripFigure(s.bad, { label: `うまく いかない てじゅん: ${cmdText(s.bad)}`, hU: 4.2 }),
      ],
      1.2,
    ),
    right: s.fixes[0]!.label,
    wrongs: s.fixes.slice(1).map((f) => [f.label, f.mis ?? 'wrong-spot'] as [string, string]),
    layout: 'row',
    hints: s.hints ?? [
      'てじゅんを うごかした つもりで、ゴールと くらべよう。',
      'キャラクターが ゴールから はなれはじめるのは、どの ふだの あとかな。',
      'なおしかたを ひとつずつ あてはめて、ゴールに つくか たしかめよう。',
    ],
    explain: s.explain,
  });
}

export interface LetterChoiceSpec {
  id: string;
  obj: string;
  level: number;
  prompt: string;
  figure?: Figure;
  /** ボタンの字（A・B・C など）。この順に ならべる（入れかえない） */
  letters: string[];
  /** 正解の番号 */
  correct: number;
  /** 文字ごとの誤概念（正解の分は使わない） */
  mis: string[];
  /** ボタンに つける 絵（文字の上） */
  optionFigures?: (Figure | undefined)[];
  hints: [string, string, string];
  explain: string;
  alt?: boolean;
}

/** A・B・C のボタンから選ぶ（図や札の列の図の中の A・B・C と対応させる） */
export function letterChoice(s: LetterChoiceSpec): ChoiceItem {
  return {
    engine: 'choice',
    id: s.id,
    objective: s.obj,
    level: s.level,
    prompt: s.prompt,
    ...(s.figure ? { figure: s.figure } : {}),
    options: s.letters.map((label, i) => ({
      label,
      ...(s.optionFigures?.[i] ? { figure: s.optionFigures[i] } : {}),
      ...(i === s.correct ? { correct: true } : s.mis[i] ? { misconception: s.mis[i] } : {}),
    })),
    layout: 'row',
    fixedOrder: true,
    hints: s.hints,
    explain: s.explain,
    identity: s.id,
    ...(s.alt ? { alt: true } : {}),
  };
}

export interface StripChoiceSpec {
  id: string;
  obj: string;
  level: number;
  prompt: string;
  /** 上に出す、もとの手順 */
  given?: Cmd[];
  /** 正解の手順の札の列 */
  right: Cmd[];
  /** 誤りの手順の札の列と誤概念 */
  wrongs: [Cmd[], string][];
  hints: [string, string, string];
  explain: string;
  alt?: boolean;
}

/** 札の列の絵を ならべた 選択肢から選ぶ（A・B・C のボタンの上に札の列を かく） */
export function stripChoice(s: StripChoiceSpec): ChoiceItem {
  const n = s.wrongs.length + 1;
  const at = hash(s.id) % n;
  const progs: Cmd[][] = [];
  const mis: string[] = [];
  let wi = 0;
  for (let i = 0; i < n; i++) {
    if (i === at) {
      progs.push(s.right);
      mis.push('');
    } else {
      progs.push(s.wrongs[wi]![0]);
      mis.push(s.wrongs[wi]![1]);
      wi++;
    }
  }
  const letters = ['A', 'B', 'C', 'D'].slice(0, n);
  return letterChoice({
    id: s.id,
    obj: s.obj,
    level: s.level,
    alt: s.alt,
    prompt: s.prompt,
    ...(s.given
      ? { figure: stripFigure(s.given, { label: `もとの てじゅん: ${cmdText(s.given)}`, hU: 5 }) }
      : {}),
    letters,
    correct: at,
    mis,
    optionFigures: progs.map((p, i) =>
      stripFigure(p, { label: `${letters[i]}の てじゅん: ${cmdText(p)}`, hU: 6.5 }),
    ),
    hints: s.hints,
    explain: s.explain,
  });
}

// ---- 手順の比べ方（札の数・すすむマスの数） ----

const measureOf = (l: Layout, p: Cmd[], m: 'cards' | 'moves') =>
  m === 'cards' ? cardCount(p) : run(l, p).trail.length - 1;

export interface BestSpec {
  id: string;
  obj: string;
  level: number;
  rows: readonly string[];
  dir: Dir;
  /** ゴールに着く手順の候補（どれもゴールに着くこと）。mis は「いちばんではない」ときの誤概念 */
  progs: { prog: Cmd[]; mis: string }[];
  alt?: boolean;
}

/** 「ゴールに つく てじゅんの うち、ふだが いちばん すくないのは どれ？」（手順の文をよこに2つならべる） */
export function bestChoice(s: BestSpec): ChoiceItem {
  const l = layout(s.rows, s.dir);
  for (const p of s.progs)
    if (!reaches(l, p.prog)) throw new Error(`${s.id}: ゴールに着かない手順がある`);
  const vals = s.progs.map((p) => measureOf(l, p.prog, 'cards'));
  const min = Math.min(...vals);
  if (vals.filter((v) => v === min).length !== 1)
    throw new Error(`${s.id}: いちばんが1つに決まらない`);
  const bi = vals.indexOf(min);
  return letterChoice({
    id: s.id,
    obj: s.obj,
    level: s.level,
    alt: s.alt,
    prompt: 'どちらの てじゅんも ゴールに つくよ。ふだが 少《すく》ない のは どちらかな。',
    figure: stripsColumn(
      s.progs.map((p, i) =>
        stripFigure(p.prog, {
          label: `${'AB'[i]}の てじゅん: ${cmdText(p.prog)}`,
          hU: 5,
          letter: 'AB'[i],
        }),
      ),
      1.2,
    ),
    letters: ['A', 'B'].slice(0, s.progs.length),
    correct: bi,
    mis: s.progs.map((p) => p.mis),
    hints: [
      'ふだの 数《かず》を くらべるよ。「くりかえす」の ふだも 1まいと 数《かぞ》えよう。',
      'それぞれの てじゅんの ふだを、くりかえす の なかも ふくめて 数《かぞ》えよう。',
      'なかに ある ふだの 数《かず》に「くりかえす」の 1まいを たして、くらべよう。',
    ],
    explain: `${s.progs.map((p) => `「${cmdText(p.prog)}」は ふだ ${cardCount(p.prog)}まい`).join('。')}。だから「${cmdText(s.progs[bi]!.prog)}」の ほうが 少《すく》ないよ。`,
  });
}

const ROUTE_STYLE = [
  { dash: '', color: 'var(--ink)' },
  { dash: '9 6', color: 'var(--berry)' },
  { dash: '2 6', color: 'var(--sky-dark)' },
] as const;
const ROUTE_LETTER = ['A', 'B', 'C'] as const;

/** 地図に いくつかの みちを かいた 図（線の しゅるいと 文字 A・B・C で見わける） */
export function routesFigure(l: Layout, trails: Cell[][], label: string, hU = 9): Figure {
  const W = l.w * CELL + PAD * 2;
  const H = l.h * CELL + PAD * 2;
  const cx = (x: number) => PAD + x * CELL + CELL / 2;
  const cy = (y: number) => PAD + y * CELL + CELL / 2;
  let body = '';
  for (let y = 0; y < l.h; y++)
    for (let x = 0; x < l.w; x++) {
      const wall = l.walls.some((c) => same(c, [x, y]));
      const px = PAD + x * CELL;
      const py = PAD + y * CELL;
      body += `<rect x="${px}" y="${py}" width="${CELL}" height="${CELL}" fill="${wall ? 'var(--disabled)' : 'var(--white)'}" stroke="var(--ink-soft)" stroke-width="1.5"/>`;
    }
  trails.forEach((tr, i) => {
    const off = (i - (trails.length - 1) / 2) * 5;
    const pts = tr
      .map((c) => `${(cx(c[0]) + off).toFixed(1)},${(cy(c[1]) + off).toFixed(1)}`)
      .join(' ');
    const st = ROUTE_STYLE[i]!;
    body += `<polyline points="${pts}" fill="none" stroke="${st.color}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"${st.dash ? ` stroke-dasharray="${st.dash}"` : ''}/>`;
  });
  trails.forEach((tr, i) => {
    // 文字は、みちの まんなかあたりに
    const mid = tr[Math.floor(tr.length / 2)]!;
    const off = (i - (trails.length - 1) / 2) * 5;
    const x = cx(mid[0]) + off;
    const y = cy(mid[1]) + off;
    body += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="var(--white)" stroke="var(--ink)" stroke-width="2"/><text x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="middle" font-size="14" font-weight="700" fill="var(--ink)">${ROUTE_LETTER[i]}</text>`;
  });
  body += `<polygon points="${STAR(cx(l.goal[0]), cy(l.goal[1]))}" fill="var(--sun)" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>`;
  body += `<g transform="translate(${cx(l.start[0])} ${cy(l.start[1])}) rotate(${ANGLE[l.dir]})"><polygon points="0,-13 10,-2 4,-2 4,12 -4,12 -4,-2 -10,-2" fill="var(--leaf)" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/></g>`;
  return {
    kind: 'svg',
    label,
    markup: `<svg viewBox="0 0 ${W} ${H}" style="height:calc(var(--u) * ${gridHeightU(l, hU).toFixed(1)})" xmlns="http://www.w3.org/2000/svg">${body}</svg>`,
  };
}

export interface FasterSpec {
  id: string;
  obj: string;
  level: number;
  rows: readonly string[];
  dir: Dir;
  /** ゴールに着く手順（2〜3つ）。すすむマスの数が いちばん少ない ものは ひとつだけ */
  progs: { prog: Cmd[]; mis: string }[];
  alt?: boolean;
}

/** 「ゴールまで いちばん はやく つくのは どれ？」（みちを 地図に かいて、A・B・C から選ぶ） */
export function fasterChoice(s: FasterSpec): ChoiceItem {
  const l = layout(s.rows, s.dir);
  for (const p of s.progs)
    if (!reaches(l, p.prog)) throw new Error(`${s.id}: ゴールに着かない手順がある`);
  const vals = s.progs.map((p) => measureOf(l, p.prog, 'moves'));
  const min = Math.min(...vals);
  if (vals.filter((v) => v === min).length !== 1)
    throw new Error(`${s.id}: いちばんが1つに決まらない`);
  const bi = vals.indexOf(min);
  const trails = s.progs.map((p) => run(l, p.prog).trail);
  const names = ROUTE_LETTER.slice(0, s.progs.length);
  return letterChoice({
    id: s.id,
    obj: s.obj,
    level: s.level,
    alt: s.alt,
    prompt: `ゴールまで ${names.join('・')} の みちが あるよ。すすむ マスが いちばん 少《すく》ないのは どれかな。`,
    figure: routesFigure(
      l,
      trails,
      `ますの ず。${names.join('・')} の みちが ある。ほしが ゴール`,
      9,
    ),
    letters: [...names],
    correct: bi,
    mis: s.progs.map((p) => p.mis),
    hints: [
      'それぞれの みちを、はじめの やじるしから ゴールまで ゆびで たどろう。',
      'すすむ マスの 数《かず》を、みちごとに 数《かぞ》えて くらべよう。',
      'まわりみちを して いる みちは、すすむ マスの 数《かず》が 多《おお》くなるよ。',
    ],
    explain: `すすむ マスは ${s.progs.map((_, i) => `${names[i]}が ${vals[i]}マス`).join('、')}。いちばん 少《すく》ない ${names[bi]}が はやく ゴールに つくよ。`,
  });
}
// ---- 札の列の図（プログラムの札の絵。エンジンの札の絵と同じ形） ----

const CW = 24; // 札の幅
const CH = 28; // 札の高さ
const CG = 3; // 札のすきま
const PADBOX = 4; // くりかえす・もし の外わくの内側のよゆう

function cardIcon(op: string, cx: number, cy: number): string {
  // 40×40 の絵を 0.45 倍にして札の中央に置く
  const s = 0.45;
  const g = (inner: string) =>
    `<g transform="translate(${cx - 20 * s} ${cy - 20 * s}) scale(${s})">${inner}</g>`;
  const ink = 'var(--ink)';
  if (op === 'forward')
    return g(`<path d="M20 4 L33 19 L24 19 L24 36 L16 36 L16 19 L7 19 Z" fill="${ink}"/>`);
  if (op === 'turnRight')
    return g(
      `<path d="M10 36 L10 20 Q10 10 20 10 L24 10" fill="none" stroke="${ink}" stroke-width="6"/><path d="M23 2 L35 10 L23 18 Z" fill="${ink}"/>`,
    );
  if (op === 'turnLeft')
    return g(
      `<g transform="translate(40 0) scale(-1 1)"><path d="M10 36 L10 20 Q10 10 20 10 L24 10" fill="none" stroke="${ink}" stroke-width="6"/><path d="M23 2 L35 10 L23 18 Z" fill="${ink}"/></g>`,
    );
  if (op === 'repeat')
    return g(
      `<path d="M30 14 A11 11 0 1 0 31 26" fill="none" stroke="${ink}" stroke-width="5"/><path d="M24 6 L35 13 L26 20 Z" fill="${ink}"/>`,
    );
  // if（ひし形に ！）
  return g(
    `<path d="M20 4 L36 20 L20 36 L4 20 Z" fill="none" stroke="${ink}" stroke-width="4"/><path d="M17 12 h6 v12 h-6 z M17 27 h6 v5 h-6 z" fill="${ink}"/>`,
  );
}

interface Drawn {
  svg: string;
  w: number;
}

/** 札の列を x0,y0 から描く。top: いちばん外の列（番号を付ける） */
function drawCmds(cmds: readonly Cmd[], x0: number, y0: number, numberFrom: number | null): Drawn {
  let x = x0;
  let svg = '';
  cmds.forEach((c, i) => {
    if (c.op === 'repeat' || c.op === 'if') {
      // 外わく: 先頭の札（くりかえす／もし）＋ 小さな目印 ＋ 中の札
      const head = x + PADBOX;
      let inner = head;
      let body = '';
      // 先頭の札
      body += `<rect x="${inner}" y="${y0 + PADBOX}" width="${CW}" height="${CH}" rx="5" fill="var(--white)" stroke="var(--ink)" stroke-width="2.2"/>`;
      body += cardIcon(c.op, inner + CW / 2, y0 + PADBOX + CH / 2 - 3);
      // 回数・条件の目印（札の下側）
      const my = y0 + PADBOX + CH - 8;
      if (c.op === 'repeat') {
        if (c.times === 'goal')
          body += `<polygon points="${STAR(inner + CW / 2, my)
            .split(' ')
            .map((p) => {
              const [a, b] = p.split(',').map(Number);
              return `${(inner + CW / 2 + (a! - (inner + CW / 2)) * 0.55).toFixed(1)},${(my + (b! - my) * 0.55).toFixed(1)}`;
            })
            .join(' ')}" fill="var(--sun)" stroke="var(--ink)" stroke-width="1.2"/>`;
        else
          body += `<text x="${inner + CW / 2}" y="${my + 4}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)">${c.times}</text>`;
      } else {
        const wall = c.cond === 'wall-ahead';
        body += `<rect x="${inner + CW / 2 - 5}" y="${my - 5}" width="10" height="10" fill="${wall ? 'var(--ink)' : 'var(--white)'}" stroke="var(--ink)" stroke-width="1.6"/>`;
      }
      inner += CW + CG;
      const sub = drawCmds(c.body, inner, y0 + PADBOX, null);
      const width = CW + CG + sub.w + PADBOX * 2;
      const frame = `<rect x="${x}" y="${y0}" width="${width - CG * 0}" height="${CH + PADBOX * 2}" rx="8" fill="var(--paper-2)" stroke="var(--ink)" stroke-width="2" stroke-dasharray="${c.op === 'if' ? '5 3' : ''}"/>`;
      svg += frame + body + sub.svg;
      if (numberFrom !== null)
        svg += `<text x="${x + 8}" y="${y0 - 3}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--ink-soft)">${numberFrom + i + 1}</text>`;
      x += width + CG;
    } else {
      svg += `<rect x="${x}" y="${y0}" width="${CW}" height="${CH}" rx="5" fill="var(--white)" stroke="var(--ink)" stroke-width="2.2"/>`;
      svg += cardIcon(c.op, x + CW / 2, y0 + CH / 2);
      if (numberFrom !== null)
        svg += `<text x="${x + CW / 2}" y="${y0 - 3}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--ink-soft)">${numberFrom + i + 1}</text>`;
      x += CW + CG;
    }
  });
  return { svg, w: x - x0 };
}

/** 札の列を、エンジンの札と同じ絵（矢印・まわる矢印・くりかえす・もし）で 1行に かいた図 */
export function stripFigure(
  prog: readonly Cmd[],
  opt: { label: string; hU?: number; numbered?: boolean; letter?: string } = { label: '札の列' },
): Figure {
  const top = opt.numbered ? 14 : 2;
  const lead = opt.letter ? 24 : 0;
  const d = drawCmds(prog, lead + 2, top, opt.numbered ? 0 : null);
  const W = lead + d.w + 6;
  const hasBox = prog.some((c) => c.op === 'repeat' || c.op === 'if');
  const H = top + CH + (hasBox ? PADBOX * 2 : 0) + 4;
  const letter = opt.letter
    ? `<circle cx="11" cy="${top + (CH + (hasBox ? PADBOX * 2 : 0)) / 2}" r="9" fill="var(--white)" stroke="var(--ink)" stroke-width="2"/><text x="11" y="${top + (CH + (hasBox ? PADBOX * 2 : 0)) / 2 + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="var(--ink)">${opt.letter}</text>`
    : '';
  return {
    kind: 'svg',
    label: opt.label,
    markup: `<svg viewBox="0 0 ${W} ${H}" style="height:calc(var(--u) * ${(opt.hU ?? 5).toFixed(1)})" xmlns="http://www.w3.org/2000/svg">${letter}${d.svg}</svg>`,
  };
}

/** 札の列の図を たてに ならべる */
export function stripsColumn(figs: Figure[], gap = 1.2): Figure {
  return { kind: 'column', items: figs, gap };
}
