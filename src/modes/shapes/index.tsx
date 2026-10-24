/**
 * かたち・パズル（M4）。ピースをタップして選び、盤面の置き場所をタップして入れる。
 * K1 穴に同じ形 / K2〜K3 破線の置き場所に絵を作る / K4 「まわす」で向きを変える / K5 外形と見本だけ。
 * 1問 = 1つの絵（K1 は1つの穴）。置き間違いは手元に戻って wrongTries+1。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ModePlayProps } from '../../core/session/types';
import { useQuestion } from '../../core/session/useQuestion';
import type { QuestionState } from '../../core/session/questionFlow';
import { Bubble } from '../../ui/Bubble';
import { Tap } from '../../ui/Tap';
import { textOf } from '../../app/voiceText';
import { Board } from './Board';
import { matches, nearSlot, sameKind, slotAt, type Point } from './geometry';
import {
  answerBoard,
  currentPiece,
  featureKey,
  filledSet,
  generateRound,
  hasOwnSlot,
  hintTarget,
  initBoard,
  isComplete,
  LEVEL_COUNT,
  needsTurn,
  place,
  resolvePlacement,
  restoreBoard,
  rotateSelected,
  selectPiece,
  solution,
  type BoardState,
  type Puzzle,
} from './logic';
import { PictureSvg } from './ShapeSvg';
import { Tray } from './Tray';
import './shapes.css';

interface Result {
  ok: boolean;
  rotated: boolean;
  outcome: string;
}

interface Draft {
  index: number;
  board: BoardState;
  q: QuestionState;
  results: Result[];
}

/** 中断データが今の問題に合っているか確かめる */
function parseDraft(raw: unknown, puzzles: readonly Puzzle[]): Draft | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const d = raw as Partial<Draft>;
  if (typeof d.index !== 'number' || !Number.isInteger(d.index)) return null;
  const puzzle = puzzles[d.index];
  if (!puzzle) return null;
  const board = restoreBoard(puzzle, d.board);
  if (!board || typeof d.q !== 'object' || d.q === null) return null;
  if (typeof d.q.wrongTries !== 'number' || typeof d.q.hintsUsed !== 'number') return null;
  const results = Array.isArray(d.results) ? (d.results as Result[]) : [];
  return { index: d.index, board, q: d.q, results };
}

interface HintView {
  /** ヒント2: 囲む置き場所 */
  slot: number | null;
  /** ヒント2（K4）: 「まわす」を囲む */
  rotate: boolean;
}

const mainPrompt = (level: number) =>
  level === 0 ? 'shape.q-same' : level >= 4 ? 'shape.q-sample' : 'shape.q-make';
const howPrompt = (level: number) =>
  level === 3 ? 'shape.how-turn' : level >= 4 ? 'shape.how-sample' : 'shape.how';

export default function Shapes({ session }: ModePlayProps) {
  const level = Math.max(0, Math.min(LEVEL_COUNT - 1, session.level));
  const puzzles = useMemo(
    () => generateRound(level, session.seed, session.roundSize),
    [level, session.seed, session.roundSize],
  );
  const resume = useMemo(() => parseDraft(session.resume, puzzles), [session.resume, puzzles]);

  const [index, setIndex] = useState(resume?.index ?? 0);
  const puzzle = puzzles[index]!;
  const [board, setBoard] = useState<BoardState>(() => resume?.board ?? initBoard(puzzles[0]!));
  const [hint, setHint] = useState<HintView | null>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const results = useRef<Result[]>(resume?.results ?? []);
  const rotatedPlaced = useRef(false);
  const timers = useRef<number[]>([]);
  const q = useQuestion();
  const restored = useRef(false);

  useEffect(
    () => () => {
      for (const t of timers.current) window.clearTimeout(t);
    },
    [],
  );
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  // 問題の開始
  useEffect(() => {
    if (resume && !restored.current) {
      restored.current = true;
      q.restore(resume.q);
    }
    session.expose({
      index,
      level,
      key: puzzle.key,
      layout: puzzle.layout,
      slots: puzzle.slots.map(({ shape, size, rot, x, y }) => ({ shape, size, rot, x, y })),
      pieces: puzzle.pieces.map(({ id, shape, size, rot }) => ({ id, shape, size, rot })),
      solution: solution(puzzle),
    });
    const main = mainPrompt(level);
    void session.prompt(index === 0 && !resume ? [howPrompt(level), 300, main] : main, main);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const saveDraft = (b: BoardState, nextIndex = index) =>
    session.saveDraft({
      index: nextIndex,
      board: b,
      q: q.current,
      results: results.current,
    } satisfies Draft);

  const showHint = (
    lv: 1 | 2,
    b: BoardState,
    pieceId: number | null,
    tapped: number | null = null,
  ) => {
    const target = hintTarget(puzzle, b, pieceId, tapped);
    if (target === null) return;
    const slot = puzzle.slots[target]!;
    const piece = pieceId === null ? null : currentPiece(puzzle, b, pieceId);
    const turnForPiece =
      piece !== null && puzzle.turnable && sameKind(piece, slot) && !matches(piece, slot);
    let seq: string[];
    if (lv === 1) {
      seq = [featureKey(slot.shape), ...(turnForPiece ? ['shape.try-turn'] : [])];
      setHint(null);
    } else {
      const rotate = needsTurn(puzzle, b, pieceId, target);
      seq = [
        hasOwnSlot(puzzle, b, pieceId) ? 'shape.here' : 'shape.here-find',
        ...(rotate ? ['shape.try-turn'] : []),
      ];
      setHint({ slot: target, rotate });
    }
    setBubble(seq.map((k) => textOf(k)).join('。'));
    void session.say(seq);
  };

  const next = () => {
    later(() => {
      if (index + 1 >= puzzles.length) {
        const rotated = results.current.some((r) => r.ok && r.rotated);
        const selfFixed = results.current.some((r) => r.outcome === 'self_corrected');
        session.finish({
          showcase: (
            <div className="shp-showcase" data-testid="shapes-showcase">
              {puzzles.map((p) => (
                <PictureSvg key={p.key} slots={p.slots} className="shp-showcase__pic" />
              ))}
            </div>
          ),
          praise: rotated ? 'shape.rotated' : selfFixed ? 'praise.self-fixed' : undefined,
        });
        return;
      }
      const nextPuzzle = puzzles[index + 1]!;
      const fresh = initBoard(nextPuzzle);
      setIndex(index + 1);
      setBoard(fresh);
      setHint(null);
      setBubble(null);
      setFlash(null);
      setDone(false);
      setBusy(false);
      rotatedPlaced.current = false;
      q.reset();
      session.saveDraft({
        index: index + 1,
        board: fresh,
        q: q.current,
        results: results.current,
      } satisfies Draft);
    }, 1600);
  };

  const choose = (id: number) => {
    if (busy) return;
    const nextBoard = selectPiece(board, id);
    if (nextBoard === board) return;
    setBoard(nextBoard);
    if (hint === null) setBubble(null);
    session.sfx('tap');
    if (nextBoard.selected === id) void session.say(`shape.name.${puzzle.pieces[id]!.shape}`);
    saveDraft(nextBoard);
  };

  const rotate = () => {
    if (busy || board.selected === null) return;
    const nextBoard = rotateSelected(board);
    setBoard(nextBoard);
    session.sfx('tap');
    saveDraft(nextBoard);
  };

  const complete = (b: BoardState, rotated: boolean) => {
    const s = q.correct();
    setDone(true);
    setBusy(true);
    setHint(null);
    setBubble(null);
    session.sfx('correct');
    void session.say([
      ...(rotated ? ['shape.rotated'] : []),
      level === 0 ? 'shape.fit' : `shape.made.${puzzle.key}`,
    ]);
    results.current = [
      ...results.current,
      { ok: true, rotated: rotatedPlaced.current, outcome: s.outcome! },
    ];
    session.record({
      itemKey: puzzle.name,
      outcome: s.outcome!,
      wrongTries: s.wrongTries,
      hintsUsed: s.hintsUsed,
      operationIssue: s.operationIssue,
      detail: { rotated: rotatedPlaced.current, pieces: b.placed.length },
    });
    next();
  };

  const tapBoard = (p: Point) => {
    if (busy) return;
    const filled = filledSet(board);
    if (board.selected === null) {
      if (slotAt(p, puzzle.slots, filled) !== null || nearSlot(p, puzzle.slots, filled) !== null) {
        setBubble(textOf('shape.pick-first'));
        void session.say('shape.pick-first');
      }
      return;
    }
    const pieceId = board.selected;
    const r = resolvePlacement(puzzle, board, pieceId, p);
    if (r.kind === 'ignore') return;

    if (r.kind === 'place') {
      const rotated = puzzle.turnable && (board.turns[pieceId] ?? 0) > 0;
      if (rotated) rotatedPlaced.current = true;
      const nextBoard = place(board, pieceId, r.slot);
      setBoard(nextBoard);
      setHint(null);
      setBubble(null);
      setFlash(null);
      if (isComplete(nextBoard)) {
        complete(nextBoard, rotated);
      } else {
        session.sfx('place');
        if (rotated) void session.say('shape.rotated');
        saveDraft(nextBoard);
      }
      return;
    }

    // 合わない場所に置こうとした: 手元に戻る。連打（1.5秒以内に3回）の判定は置き間違いの操作で見る
    //（正しく置いていくのが速いだけでは、とまどいとしない）
    if (!q.tap()) return;
    const s = q.wrong();
    session.sfx('wrong');
    // K4 は、そのまま「まわす」で向きを変えて置き直せるよう選んだままにする
    const nextBoard: BoardState = puzzle.turnable ? board : { ...board, selected: null };
    setBoard(nextBoard);
    setFlash(pieceId);
    later(() => setFlash((f) => (f === pieceId ? null : f)), 1200);
    showHint(s.hintLevel === 2 ? 2 : 1, nextBoard, pieceId, r.slot);
    saveDraft(nextBoard);
  };

  const askHint = () => {
    if (busy) return;
    const s = q.hint();
    showHint(s.hintLevel === 2 ? 2 : 1, board, board.selected);
  };

  const skip = () => {
    if (busy) return;
    const s = q.skip();
    const nextBoard = answerBoard(puzzle, board);
    setBoard(nextBoard);
    setBusy(true);
    setDone(true);
    setHint(null);
    setBubble(null);
    void session.say('shape.answer');
    results.current = [...results.current, { ok: false, rotated: false, outcome: s.outcome! }];
    session.record({
      itemKey: puzzle.name,
      outcome: s.outcome!,
      wrongTries: s.wrongTries,
      hintsUsed: s.hintsUsed,
      operationIssue: s.operationIssue,
    });
    next();
  };

  const selectedPiece = board.selected !== null;

  return (
    <div
      className={`shp ${puzzle.sample ? 'shp--sample' : ''}`}
      data-testid="shapes-play"
      data-level={level}
    >
      {puzzle.sample ? (
        <div className="shp-sample" aria-label="みほん">
          <PictureSvg slots={puzzle.slots} className="shp-sample__pic" testId="sample" />
          <span className="shp-sample__label">みほん</span>
        </div>
      ) : null}

      <div className={`shp-board ${done ? 'shp-board--done' : ''}`}>
        <Board
          puzzle={puzzle}
          board={board}
          hintSlot={hint?.slot ?? null}
          done={done}
          onTap={tapBoard}
        />
      </div>

      <Tray puzzle={puzzle} board={board} flash={flash} disabled={busy} onSelect={choose} />

      <Bubble text={bubble} style={{ left: 'calc(var(--u) * 10)', bottom: 'calc(var(--u) * 1)' }} />

      <div className="shp-bottom">
        <Tap
          label="ヒント"
          icon="hint"
          size="aux"
          variant="white"
          onPress={askHint}
          disabled={busy}
          testId="hint-button"
        />
        <span className="shp-bottom__space" />
        {q.state.canSkip && !done ? (
          <Tap label="つぎへ" icon="next" size="aux" onPress={skip} testId="skip-button" />
        ) : null}
        {puzzle.turnable ? (
          <Tap
            label="まわす"
            text="まわす"
            icon="rotate"
            variant="main"
            state={hint?.rotate ? 'hint' : null}
            disabled={busy || !selectedPiece}
            onPress={rotate}
            testId="rotate-button"
          />
        ) : null}
      </div>
    </div>
  );
}
