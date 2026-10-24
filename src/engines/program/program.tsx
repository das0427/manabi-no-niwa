/**
 * program エンジン: プログラミング的活動（順次・繰り返し・条件・デバッグ）。
 * 格子の上のキャラクターを、命令の札を並べて動かす。「うごかす」で 1 手ずつ動かして見せ、終わったら判定に出す。
 *
 * 操作（タップだけ）:
 * - 下の札（すすむ・みぎ・ひだり・くりかえす・もし）をタップ → 「ここに いれる」の所の最後に足す。
 * - 並べた札をタップ → 外す（くりかえす・もし は中の札ごと。「ひとつ もどす」で戻せる）。
 * - くりかえす・もし の札の右の小札（「3かい」「かべなら」）をタップ → 回数・条件が変わる。
 * - くりかえす・もし の中の「ここに いれる」をタップ → そこに足すようになる。
 * 正答: ゴールに着くこと（列の違いは問わない）。maxCards があれば札の数がそれ以下であること。
 * デバッグ問題は initial（誤った列）が最初から並ぶ。
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Item, ItemBase, RichText } from '../../curriculum/types';
import { Illust } from '../../illust/Illust';
import type { EngineProps, Judgement } from '../types';
import {
  ABSOLUTE_OPS,
  cardCount,
  commandAt,
  depthOf,
  kindsUsed,
  RELATIVE_OPS,
  removeAt,
  repeatVariants,
  replaceAt,
  run,
  sameCell,
  swapLeftRight,
  updateContainer,
  type CardKind,
  type Cell,
  type Command,
  type Cond,
  type Dir,
  type RepeatTimes,
  type Step,
  type World,
} from './world';
import './program.css';

export type { CardKind, Cell, Command, Cond, Dir, RepeatTimes } from './world';

export interface ProgramItem extends ItemBase {
  engine: 'program';
  /** 格子（w × h。2〜8）。walls は通れないマス */
  grid: { w: number; h: number; walls?: Cell[] };
  /** はじめの位置と向き */
  start: { at: Cell; dir: Dir };
  goal: Cell;
  /** 使える札（向きで動く forward・turnRight・turnLeft と、方向で動く up・down・left・right は混ぜない） */
  palette: CardKind[];
  /** 正答の例（検査と「こたえ」の表示に使う。正答はこれに限らない） */
  solution: Command[];
  /** デバッグ問題: 最初から並んでいる誤った列 */
  initial?: Command[];
  /** 札の数の上限（「◯まい いかで」。くりかえす・もし の札も 1 まい） */
  maxCards?: number;
  /** くりかえす で選べる回数（既定 [2, 3, 4]。'goal' = ゴールに つくまで） */
  repeatTimes?: RepeatTimes[];
  /** もし で選べる条件（既定 ['wall-ahead']） */
  conds?: Cond[];
  /** 誤概念ID: bump = かべ・外にぶつかった、short = ゴールの手前で終わった、turn = みぎ・ひだりの取り違え、
   *  repeatCount = くりかえしの回数の数え違い、tooMany = 札が上限より多い */
  misconceptionIds?: {
    bump?: string;
    short?: string;
    turn?: string;
    repeatCount?: string;
    tooMany?: string;
  };
  /** キャラクターの絵（IllustId。既定 rabbit）とゴールの絵（既定 flower）、かべの絵（既定 rock） */
  character?: string;
  goalIllust?: string;
  wallIllust?: string;
}

/** 答え: 並べた命令の列 */
export type ProgramResponse = Command[];

export const DEFAULT_REPEAT_TIMES: RepeatTimes[] = [2, 3, 4];
export const DEFAULT_CONDS: Cond[] = ['wall-ahead'];
/** 入れ子の深さの上限（くりかえす の中に もし まで） */
export const MAX_DEPTH = 3;

export const worldOf = (item: ProgramItem): World => ({
  w: item.grid.w,
  h: item.grid.h,
  walls: item.grid.walls,
  start: item.start,
  goal: item.goal,
});

export const EMPTY_PROGRAM: RichText = 'ふだを ならべてから 「うごかす」を おしてね。';

export function judgeProgram(item: ProgramItem, program: ProgramResponse): Judgement {
  if (program.length === 0) return { result: 'retry', message: EMPTY_PROGRAM };
  const w = worldOf(item);
  const r = run(w, program);
  const ids = item.misconceptionIds ?? {};
  const mark = { outcome: r.outcome, steps: r.steps.length, at: r.at };
  if (r.outcome === 'goal') {
    if (item.maxCards !== undefined && cardCount(program) > item.maxCards)
      return {
        result: 'wrong',
        misconception: ids.tooMany,
        mark: { ...mark, outcome: 'too-many' },
      };
    return { result: 'correct' };
  }
  // 誤りの推定: みぎ・ひだりを入れ替えると着く → 取り違え、くりかえしの回数を ±1 すると着く → 数え違い
  if (run(w, swapLeftRight(program)).outcome === 'goal')
    return {
      result: 'wrong',
      misconception: ids.turn ?? (r.outcome === 'bump' ? ids.bump : ids.short),
      mark,
    };
  if (repeatVariants(program).some((p) => run(w, p).outcome === 'goal'))
    return { result: 'wrong', misconception: ids.repeatCount ?? ids.short, mark };
  return { result: 'wrong', misconception: r.outcome === 'bump' ? ids.bump : ids.short, mark };
}

function usesOnly(item: ProgramItem, p: readonly Command[], what: string, errs: string[]) {
  for (const k of kindsUsed(p))
    if (!item.palette.includes(k)) errs.push(`${what}に使えない札 ${k} がある`);
  const times = item.repeatTimes ?? DEFAULT_REPEAT_TIMES;
  const conds = item.conds ?? DEFAULT_CONDS;
  const walk = (cmds: readonly Command[]) => {
    for (const c of cmds) {
      if (c.op === 'repeat') {
        if (!times.includes(c.times)) errs.push(`${what}のくりかえしの回数 ${c.times} が選べない`);
        walk(c.body);
      } else if (c.op === 'if') {
        if (!conds.includes(c.cond)) errs.push(`${what}のもしの条件 ${c.cond} が選べない`);
        walk(c.body);
      }
    }
  };
  walk(p);
  if (depthOf(p) > MAX_DEPTH) errs.push(`${what}の入れ子が深すぎる（${MAX_DEPTH}まで）`);
}

export function checkProgram(item: ProgramItem): string[] {
  const errs: string[] = [];
  const { w, h, walls = [] } = item.grid;
  const inGrid = (c: Cell) =>
    Number.isInteger(c[0]) &&
    Number.isInteger(c[1]) &&
    c[0] >= 0 &&
    c[1] >= 0 &&
    c[0] < w &&
    c[1] < h;
  if (!(Number.isInteger(w) && Number.isInteger(h) && w >= 2 && h >= 1 && w <= 8 && h <= 8))
    errs.push('格子は 2〜8 マス');
  if (!inGrid(item.start.at)) errs.push('はじめの位置が格子の外');
  if (!inGrid(item.goal)) errs.push('ゴールが格子の外');
  if (sameCell(item.start.at, item.goal)) errs.push('はじめの位置とゴールが同じ');
  for (const c of walls) {
    if (!inGrid(c)) errs.push(`かべ [${c.join(',')}] が格子の外`);
    if (sameCell(c, item.start.at) || sameCell(c, item.goal))
      errs.push(`かべ [${c.join(',')}] がはじめの位置かゴールに重なる`);
  }
  if (item.palette.length === 0) errs.push('使える札が無い');
  if (new Set(item.palette).size !== item.palette.length) errs.push('使える札が重複している');
  const rel = item.palette.some((k) => RELATIVE_OPS.includes(k as never));
  const abs = item.palette.some((k) => ABSOLUTE_OPS.includes(k as never));
  if (rel && abs) errs.push('向きで動く札と方向で動く札を混ぜない');
  if (!rel && !abs) errs.push('動く札が無い');
  if (item.palette.includes('if') && (item.conds ?? DEFAULT_CONDS).length === 0)
    errs.push('もし の条件が無い');
  if (item.maxCards !== undefined && !(item.maxCards >= 1 && item.maxCards <= 16))
    errs.push('maxCards は 1〜16');
  if (item.solution.length === 0) errs.push('正答の例が無い');
  else {
    usesOnly(item, item.solution, '正答の例', errs);
    const j = judgeProgram(item, item.solution);
    if (j.result !== 'correct') errs.push('正答の例でゴールに着かない（または札が多すぎる）');
  }
  if (item.initial) {
    usesOnly(item, item.initial, 'デバッグの列', errs);
    if (item.initial.length > 0 && judgeProgram(item, item.initial).result === 'correct')
      errs.push('デバッグの列が最初から正答になっている');
  }
  return errs;
}

// ---- 札の名前 ----
export const CARD_NAME: Record<CardKind, string> = {
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
export const timesName = (t: RepeatTimes) => (t === 'goal' ? 'つくまで' : `${t}かい`);
export const condName: Record<Cond, string> = {
  'wall-ahead': 'まえが かべなら',
  'open-ahead': 'まえが あいていたら',
};

export function programText(p: readonly Command[]): string {
  return p
    .map((c) =>
      c.op === 'repeat'
        ? `くりかえす ${timesName(c.times)}（${programText(c.body)}）`
        : c.op === 'if'
          ? `もし ${condName[c.cond]}（${programText(c.body)}）`
          : CARD_NAME[c.op],
    )
    .join('、');
}

export const programAnswerText = (item: ProgramItem): RichText =>
  `たとえば ${programText(item.solution)}`;

// ---- 画面 ----

type Props = Omit<EngineProps<Item, ProgramResponse>, 'item'> & { item: ProgramItem };

/** 札の絵（矢印）。色は文字の色（ink） */
function CardIcon({ kind }: { kind: CardKind }) {
  const rot: Partial<Record<CardKind, number>> = {
    up: 0,
    right: 90,
    down: 180,
    left: 270,
    forward: 0,
  };
  if (kind in rot)
    return (
      <svg className="prog-icon" viewBox="0 0 40 40" aria-hidden>
        <g transform={`rotate(${rot[kind]} 20 20)`}>
          <path d="M20 4 L33 19 L24 19 L24 36 L16 36 L16 19 L7 19 Z" fill="currentColor" />
        </g>
      </svg>
    );
  if (kind === 'turnRight' || kind === 'turnLeft')
    return (
      <svg className="prog-icon" viewBox="0 0 40 40" aria-hidden>
        <g transform={kind === 'turnLeft' ? 'translate(40 0) scale(-1 1)' : undefined}>
          <path
            d="M10 36 L10 20 Q10 10 20 10 L24 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
          />
          <path d="M23 2 L35 10 L23 18 Z" fill="currentColor" />
        </g>
      </svg>
    );
  if (kind === 'repeat')
    return (
      <svg className="prog-icon" viewBox="0 0 40 40" aria-hidden>
        <path d="M30 14 A11 11 0 1 0 31 26" fill="none" stroke="currentColor" strokeWidth="5" />
        <path d="M24 6 L35 13 L26 20 Z" fill="currentColor" />
      </svg>
    );
  return (
    <svg className="prog-icon" viewBox="0 0 40 40" aria-hidden>
      <path d="M20 4 L36 20 L20 36 L4 20 Z" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M17 12 h6 v12 h-6 z M17 27 h6 v5 h-6 z" fill="currentColor" />
    </svg>
  );
}

const STEP_MS = 450;

function ProgramView({ item, revealed, wrongMark, disabled, submit }: Props) {
  const world = useMemo(() => worldOf(item), [item]);
  const [prog, setProg] = useState<Command[]>(() => item.initial ?? []);
  const [history, setHistory] = useState<Command[][]>([]);
  const [cursor, setCursor] = useState<number[]>([]);
  /** 実行の表示: 何手目まで見せたか（null = 実行していない） */
  const [shown, setShown] = useState<{ steps: Step[]; n: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const running = shown !== null && shown.n < shown.steps.length;
  const locked = disabled || revealed || running;
  const times = item.repeatTimes ?? DEFAULT_REPEAT_TIMES;
  const conds = item.conds ?? DEFAULT_CONDS;
  const count = cardCount(prog);
  const full = item.maxCards !== undefined && count >= item.maxCards;
  const program = revealed ? item.solution : prog;

  // 今の位置（実行中・実行後は最後に見せた手、正答を見せるときは正答の例の終わり）
  const pose = useMemo(() => {
    if (revealed) {
      const r = run(world, item.solution);
      return { at: r.at, dir: r.dir, path: null as number[] | null, bump: false };
    }
    if (shown && shown.n > 0) {
      const s = shown.steps[shown.n - 1]!;
      return { at: s.at, dir: s.dir, path: running ? s.path : null, bump: s.kind === 'bump' };
    }
    return { at: world.start.at, dir: world.start.dir, path: null, bump: false };
  }, [revealed, shown, running, world, item.solution]);

  const edit = (next: Command[], nextCursor = cursor) => {
    setHistory((h) => [...h, prog]);
    setProg(next);
    setCursor(commandAt(next, nextCursor) || nextCursor.length === 0 ? nextCursor : []);
    setShown(null);
  };
  const add = (k: CardKind) => {
    if (locked || full) return;
    const c: Command =
      k === 'repeat'
        ? { op: 'repeat', times: times[0] ?? 2, body: [] }
        : k === 'if'
          ? { op: 'if', cond: conds[0] ?? 'wall-ahead', body: [] }
          : { op: k };
    // 入れ物の札は、中に札を1段入れられる深さまで
    if ((k === 'repeat' || k === 'if') && cursor.length + 2 > MAX_DEPTH) return;
    let newPath: number[] | null = null;
    const next = updateContainer(prog, cursor, (b) => {
      newPath = [...cursor, b.length];
      return [...b, c];
    });
    // くりかえす・もし を置いたら、その中に入れるようにする
    edit(next, (k === 'repeat' || k === 'if') && newPath ? newPath : cursor);
  };
  const remove = (path: number[]) => {
    if (locked) return;
    const inside = cursor.length >= path.length && path.every((v, i) => cursor[i] === v);
    edit(removeAt(prog, path), inside ? path.slice(0, -1) : cursor);
  };
  const cycle = (path: number[]) => {
    if (locked) return;
    const c = commandAt(prog, path);
    if (!c) return;
    if (c.op === 'repeat')
      edit(
        replaceAt(prog, path, { ...c, times: times[(times.indexOf(c.times) + 1) % times.length]! }),
      );
    else if (c.op === 'if')
      edit(
        replaceAt(prog, path, { ...c, cond: conds[(conds.indexOf(c.cond) + 1) % conds.length]! }),
      );
  };
  const undo = () => {
    if (locked || history.length === 0) return;
    setProg(history[history.length - 1]!);
    setHistory((h) => h.slice(0, -1));
    setCursor([]);
    setShown(null);
  };
  const clear = () => {
    if (locked || prog.length === 0) return;
    edit([], []);
  };
  const go = () => {
    if (locked || prog.length === 0) return;
    const r = run(world, prog);
    const steps = r.steps;
    const p = prog;
    setShown({ steps, n: 0 });
    let n = 0;
    const tick = () => {
      n += 1;
      setShown({ steps, n: Math.min(n, steps.length) });
      if (n < steps.length) timer.current = window.setTimeout(tick, STEP_MS);
      else timer.current = window.setTimeout(() => submit(p), STEP_MS);
    };
    if (steps.length === 0) submit(p);
    else timer.current = window.setTimeout(tick, STEP_MS / 2);
  };

  const pathKey = (p: number[] | null) => (p ? p.join('.') : '');
  const activeKey = pathKey(pose.path);
  const cursorKey = cursor.join('.');
  const wrong =
    !revealed && !running && wrongMark !== null && wrongMark !== undefined && shown !== null;

  const renderCmds = (cmds: readonly Command[], base: number[]): ReactNode[] =>
    cmds.map((c, i) => {
      const path = [...base, i];
      const key = path.join('.');
      const active = key === activeKey;
      if (c.op === 'repeat' || c.op === 'if') {
        const inCursor = cursorKey === key;
        return (
          <div key={key} className={`prog-block prog-block--${c.op}${active ? ' is-active' : ''}`}>
            <div className="prog-block__head">
              <button
                type="button"
                className="prog-card prog-card--block"
                onClick={() => remove(path)}
                disabled={locked}
                aria-label={`${CARD_NAME[c.op]} を はずす`}
                data-testid={`card-${key}`}
              >
                <CardIcon kind={c.op} />
                <span className="prog-card__name">{CARD_NAME[c.op]}</span>
              </button>
              <button
                type="button"
                className="prog-card prog-card--param"
                onClick={() => cycle(path)}
                disabled={locked}
                aria-label={`${c.op === 'repeat' ? timesName(c.times) : condName[c.cond]} を かえる`}
                data-testid={`param-${key}`}
              >
                {c.op === 'repeat' ? timesName(c.times) : condName[c.cond]}
              </button>
            </div>
            <div className="prog-block__body">
              {renderCmds(c.body, path)}
              {!revealed ? (
                <button
                  type="button"
                  className={`prog-slot${inCursor ? ' is-on' : ''}`}
                  onClick={() => !locked && setCursor(path)}
                  disabled={locked}
                  aria-pressed={inCursor}
                  data-testid={`slot-${key}`}
                >
                  ここに いれる
                </button>
              ) : null}
            </div>
          </div>
        );
      }
      return (
        <button
          key={key}
          type="button"
          className={`prog-card${active ? ' is-active' : ''}`}
          onClick={() => remove(path)}
          disabled={locked}
          aria-label={`${CARD_NAME[c.op]} を はずす`}
          data-testid={`card-${key}`}
        >
          <CardIcon kind={c.op} />
          <span className="prog-card__name">{CARD_NAME[c.op]}</span>
        </button>
      );
    });

  const walls = item.grid.walls ?? [];
  const cells: ReactNode[] = [];
  for (let y = 0; y < item.grid.h; y++)
    for (let x = 0; x < item.grid.w; x++) {
      const c: Cell = [x, y];
      const wall = walls.some((v) => sameCell(v, c));
      const goal = sameCell(item.goal, c);
      cells.push(
        <div
          key={`${x}-${y}`}
          className={`prog-cell${wall ? ' prog-cell--wall' : ''}${goal ? ' prog-cell--goal' : ''}`}
          data-testid={`cell-${x}-${y}`}
        >
          {wall ? (
            <Illust id={item.wallIllust ?? 'rock'} className="prog-cell__illust" decorative />
          ) : null}
          {goal ? (
            <Illust id={item.goalIllust ?? 'flower'} className="prog-cell__illust" decorative />
          ) : null}
        </div>,
      );
    }
  const rotate = { up: 0, right: 90, down: 180, left: 270 }[pose.dir];

  return (
    <div className="eng-program">
      <div
        className="prog-board"
        style={{
          gridTemplateColumns: `repeat(${item.grid.w}, 1fr)`,
          gridTemplateRows: `repeat(${item.grid.h}, 1fr)`,
          aspectRatio: `${item.grid.w} / ${item.grid.h}`,
        }}
        role="img"
        aria-label="ます"
        data-testid="prog-board"
        data-at={pose.at.join(',')}
        data-dir={pose.dir}
      >
        {cells}
        <div
          className={`prog-actor${pose.bump ? ' is-bump' : ''}`}
          style={{
            left: `${(pose.at[0] / item.grid.w) * 100}%`,
            top: `${(pose.at[1] / item.grid.h) * 100}%`,
            width: `${100 / item.grid.w}%`,
            height: `${100 / item.grid.h}%`,
          }}
          data-testid="prog-actor"
        >
          <Illust id={item.character ?? 'rabbit'} className="prog-actor__illust" decorative />
          <svg
            className="prog-actor__dir"
            viewBox="0 0 40 40"
            aria-hidden
            style={{ transform: `rotate(${rotate}deg)` }}
          >
            <path d="M20 2 L32 16 L8 16 Z" />
          </svg>
          {pose.bump ? (
            <span className="mark mark--wrong" aria-hidden>
              ？
            </span>
          ) : null}
        </div>
      </div>

      <div className="prog-side">
        <div
          className={`prog-strip${wrong ? ' is-wrong' : ''}`}
          aria-label="ならべた ふだ"
          data-testid="prog-strip"
        >
          {renderCmds(program, [])}
          {!revealed ? (
            <button
              type="button"
              className={`prog-slot${cursorKey === '' ? ' is-on' : ''}`}
              onClick={() => !locked && setCursor([])}
              disabled={locked}
              aria-pressed={cursorKey === ''}
              data-testid="slot-top"
            >
              ここに いれる
            </button>
          ) : null}
        </div>
        {!revealed ? (
          <>
            <div className="prog-palette" role="group" aria-label="ふだ">
              {item.palette.map((k) => (
                <button
                  key={k}
                  type="button"
                  className="prog-card prog-card--palette"
                  onClick={() => add(k)}
                  disabled={locked || full}
                  aria-label={`${CARD_NAME[k]} を いれる`}
                  data-testid={`palette-${k}`}
                >
                  <CardIcon kind={k} />
                  <span className="prog-card__name">{CARD_NAME[k]}</span>
                </button>
              ))}
            </div>
            <div className="prog-tools">
              {item.maxCards !== undefined ? (
                <span className="prog-count" data-testid="prog-count">
                  のこり {Math.max(0, item.maxCards - count)}まい
                </span>
              ) : null}
              <button
                type="button"
                className="tap tap--white tap--aux"
                onClick={undo}
                disabled={locked || history.length === 0}
                aria-label="ひとつ もどす"
                data-testid="undo-button"
              >
                <Illust id="undo" className="tap__icon" decorative />
              </button>
              <button
                type="button"
                className="tap tap--white tap--aux"
                onClick={clear}
                disabled={locked || prog.length === 0}
                aria-label="ぜんぶ けす"
                data-testid="clear-button"
              >
                <Illust id="eraser" className="tap__icon" decorative />
              </button>
              <button
                type="button"
                className="tap tap--main prog-go"
                onClick={go}
                disabled={locked || prog.length === 0}
                data-testid="run-button"
              >
                <Illust id="go" className="tap__icon" decorative />
                うごかす
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export interface ProgramEngineDef {
  id: 'program';
  Component: (props: Props) => ReactNode;
  judge(item: ProgramItem, response: ProgramResponse): Judgement;
  check(item: ProgramItem): string[];
  answerText(item: ProgramItem): RichText;
}

export const programEngine: ProgramEngineDef = {
  id: 'program',
  Component: ProgramView,
  judge: judgeProgram,
  check: checkProgram,
  answerText: programAnswerText,
};
