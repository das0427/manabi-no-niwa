/**
 * みちを つくろう「もんだい」（R1〜R4）。1盤面 = 1問。
 * 道具を選んで空きマスをタップ → 置く。置いた道をタップ → 90°回る。「しゅっぱつ」で うさぎが進む。
 * つながらなければ 止まった所に「？」。盤面はそのまま、直して もう一度 しゅっぱつ できる（M7-03）。
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { textOf } from '../../app/voiceText';
import { initialQuestion, type QuestionState } from '../../core/session/questionFlow';
import type { ModePlayProps } from '../../core/session/types';
import { useQuestion } from '../../core/session/useQuestion';
import { Bubble } from '../../ui/Bubble';
import { Tap } from '../../ui/Tap';
import {
  applyPlacements,
  applyTool,
  findPath,
  isBoard,
  openSidesNotConnected,
  placedCount,
  posKey,
  stopPoint,
  type Board,
  type Pos,
  type Stop,
  type Tool,
} from './board';
import { parsed, type RoadBoardDef } from './content';
import { RoadPicture } from './draw';
import { bestSolution, generateRound, hintCell, initialBoard, praiseKey } from './logic';
import { BUBBLE_STYLE, PUZZLE_TOOLS, Toolbar, cellUFor, rabbitView } from './parts';
import { RoadBoard, type StopView } from './RoadBoard';
import { useWalker } from './useWalker';
import './road.css';

interface Result {
  id: string;
  solved: Board;
  rotated: boolean;
  selfFixed: boolean;
}

interface Draft {
  index: number;
  board: Board;
  q: QuestionState;
  results: Result[];
  rotated: string[];
}

type Phase = 'build' | 'walking' | 'arrived' | 'shown';

/** 保存データが使えるか確かめる（壊れていたら最初から） */
function readDraft(raw: unknown, defs: RoadBoardDef[]): Draft | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Partial<Draft>;
  const def = defs[d.index ?? -1];
  if (!def || !isBoard(d.board) || !d.q || !Array.isArray(d.results)) return null;
  if (d.board.cols !== def.cols || d.board.rows !== def.rows) return null;
  return {
    index: d.index!,
    board: d.board,
    q: d.q,
    results: d.results.filter((r) => isBoard(r?.solved)),
    rotated: Array.isArray(d.rotated) ? d.rotated : [],
  };
}

export default function Puzzle({ session }: ModePlayProps) {
  const defs = useMemo(
    () => generateRound(session.level, session.seed, session.roundSize),
    [session.level, session.seed, session.roundSize],
  );
  const resume = useMemo(() => readDraft(session.resume, defs), [session.resume, defs]);
  const [index, setIndex] = useState(resume?.index ?? 0);
  const def = defs[index]!;
  const [board, setBoard] = useState<Board>(resume?.board ?? initialBoard(defs[0]!));
  const [tool, setTool] = useState<Tool>('straight');
  const [phase, setPhase] = useState<Phase>('build');
  const [stop, setStop] = useState<StopView | null>(null);
  const [hint, setHint] = useState<Pos | null>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  const q = useQuestion();
  const walker = useWalker(session.reduceMotion);
  const results = useRef<Result[]>(resume?.results ?? []);
  const rotated = useRef<Set<string>>(new Set(resume?.rotated ?? []));
  const outside = useRef(0);
  const restored = useRef(false);
  const nextTimer = useRef<number | undefined>(undefined);
  /** この盤面で しゅっぱつ して止まったことがあるか（ヒント1の言い方を変える） */
  const ran = useRef(false);

  // 吹き出しは声のあと自然に消える（盤面の囲みは、道を変えるまで残る）
  useEffect(() => {
    if (!bubble) return;
    const t = window.setTimeout(() => setBubble(null), 7000);
    return () => window.clearTimeout(t);
  }, [bubble]);

  useEffect(
    () => () => {
      if (nextTimer.current !== undefined) window.clearTimeout(nextTimer.current);
    },
    [],
  );

  // 盤面の開始: 問題文を言う
  useEffect(() => {
    if (resume && !restored.current) {
      restored.current = true;
      q.restore(resume.q);
    }
    const p = parsed(def);
    session.expose({
      index,
      id: def.id,
      level: def.level,
      cols: def.cols,
      rows: def.rows,
      board: p.board,
      solutions: p.solutions,
    });
    const first = index === 0 && !resume;
    void session.prompt(
      first
        ? ['road.intro', 300, 'road.how1', 300, 'road.how2', 300, 'road.how3', 300, 'road.prompt']
        : 'road.prompt',
      'road.prompt',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const save = (b: Board, i = index) =>
    session.saveDraft({
      index: i,
      board: b,
      q: q.current,
      results: results.current,
      rotated: [...rotated.current],
    } satisfies Draft);

  const clearView = () => {
    walker.reset();
    setStop(null);
    setHint(null);
    setBubble(null);
  };

  const pickTool = (t: Tool) => {
    if (phase !== 'build') return;
    setTool(t);
    session.sfx('tap');
    void session.say(`road.tool.${t}`);
  };

  const onCell = (p: Pos) => {
    if (phase !== 'build') return;
    const res = applyTool(board, p, tool);
    if (res.action === 'none') return;
    if (res.action === 'rotate') rotated.current.add(posKey(p));
    else rotated.current.delete(posKey(p));
    setBoard(res.board);
    clearView();
    session.sfx(res.action === 'place' ? 'place' : res.action === 'remove' ? 'remove' : 'tap');
    save(res.board);
  };

  const showHint = (level: 1 | 2, ran: boolean, now: Board) => {
    let seq: string;
    if (level === 1) {
      seq = ran ? 'road.hint1' : 'road.hint-start';
    } else {
      seq = 'road.hint2';
      setHint(hintCell(def, now));
    }
    setBubble(textOf(seq));
    void session.say(seq);
  };

  /** 1問が終わったら、途中でやめても二重に数えないよう、次の盤面の状態を保存しておく */
  const saveAfterDone = () => {
    if (index + 1 >= defs.length) {
      session.clearDraft();
      return;
    }
    session.saveDraft({
      index: index + 1,
      board: initialBoard(defs[index + 1]!),
      q: initialQuestion(),
      results: results.current,
      rotated: [],
    } satisfies Draft);
  };

  /** 次の盤面へ（なければ回の終わり） */
  const next = (ms: number) => {
    nextTimer.current = window.setTimeout(() => {
      if (index + 1 >= defs.length) {
        session.finish({
          showcase: (
            <div className="road-showcase">
              {results.current.map((r) => (
                <RoadPicture
                  key={r.id}
                  board={r.solved}
                  icons
                  className="road-showcase__pic"
                  label="できた みち"
                />
              ))}
            </div>
          ),
          praise: praiseKey(results.current),
        });
        return;
      }
      const ni = index + 1;
      const nb = initialBoard(defs[ni]!);
      q.reset();
      rotated.current = new Set();
      outside.current = 0;
      ran.current = false;
      clearView();
      setBoard(nb);
      setPhase('build');
      setIndex(ni);
      save(nb, ni);
    }, ms);
  };

  const arrive = (path: Pos[]) => {
    const s = q.correct();
    const viaRotated = path.some((p) => rotated.current.has(posKey(p)));
    setPhase('arrived');
    session.sfx('correct');
    void session.say(viaRotated ? 'praise.rotated' : 'road.arrived');
    session.record({
      itemKey: def.id,
      outcome: s.outcome!,
      wrongTries: s.wrongTries,
      hintsUsed: s.hintsUsed,
      reviewsUsed: s.reviewsUsed,
      operationIssue: s.operationIssue,
      detail: { tiles: placedCount(board), rotated: viaRotated },
    });
    results.current = [
      ...results.current,
      {
        id: def.id,
        solved: board,
        rotated: viaRotated,
        selfFixed: s.outcome === 'self_corrected' && s.wrongTries > 0,
      },
    ];
    saveAfterDone();
    next(1700);
  };

  const stopped = (stp: Stop) => {
    setPhase('build');
    ran.current = true;
    setStop({ pos: stp.pos, sides: openSidesNotConnected(board, stp.pos) });
    const s = q.wrong();
    session.sfx('wrong');
    showHint(s.hintLevel === 2 ? 2 : 1, true, board);
    save(board);
  };

  const go = () => {
    if (phase !== 'build' || !q.tap()) return;
    setBubble(null);
    setHint(null);
    setStop(null);
    const path = findPath(board);
    setPhase('walking');
    if (path) {
      walker.start(path, () => arrive(path));
      return;
    }
    const stp = stopPoint(board);
    if (!stp) {
      setPhase('build');
      return;
    }
    walker.start(stp.path, () => stopped(stp));
  };

  const askHint = () => {
    if (phase !== 'build') return;
    const s = q.hint();
    showHint(s.hintLevel === 2 ? 2 : 1, ran.current, board);
    save(board);
  };

  /** 「つぎへ」: 参考解を置いて見せてから次へ */
  const skip = () => {
    if (phase !== 'build') return;
    const s = q.skip();
    const solved = applyPlacements(board, bestSolution(parsed(def), board));
    setBoard(solved);
    setStop(null);
    setHint(null);
    setBubble(null);
    setPhase('shown');
    void session.say('app.show-answer');
    session.record({
      itemKey: def.id,
      outcome: s.outcome!,
      wrongTries: s.wrongTries,
      hintsUsed: s.hintsUsed,
      reviewsUsed: s.reviewsUsed,
      operationIssue: s.operationIssue,
    });
    results.current = [
      ...results.current,
      { id: def.id, solved, rotated: false, selfFixed: false },
    ];
    const path = findPath(solved);
    if (path) walker.start(path, () => undefined);
    saveAfterDone();
    next(2600);
  };

  /** 盤面の外のタップが1問で10回以上: 操作のとまどい */
  const outsideTap = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('button, [data-hit]')) return;
    outside.current += 1;
    if (outside.current >= 10 && !q.current.operationIssue) {
      q.restore({ ...q.current, operationIssue: true });
    }
  };

  const busy = phase !== 'build';
  const rabbit = rabbitView(board, walker.walk);
  const trail = walker.walk ? walker.walk.path.slice(0, walker.walk.step + 1) : [];

  return (
    <div className="road" data-testid="road-puzzle" data-phase={phase} onPointerDown={outsideTap}>
      <div className="road-stage">
        <RoadBoard
          board={board}
          cellU={cellUFor(board)}
          interactive={!busy}
          hint={hint}
          stop={stop}
          rabbit={rabbit}
          trail={trail}
          arrived={phase === 'arrived'}
          onCell={onCell}
        />
      </div>

      <Bubble text={bubble} style={BUBBLE_STYLE} />

      <div className="road-bottom">
        <div className="road-bottom__left">
          <Tap
            label="ヒント"
            icon="hint"
            size="aux"
            variant="white"
            disabled={busy}
            onPress={askHint}
            testId="hint-button"
          />
        </div>
        <Toolbar tools={PUZZLE_TOOLS} tool={tool} disabled={busy} onPick={pickTool} />
        <div className="road-bottom__right">
          {q.state.canSkip && phase === 'build' ? (
            <Tap label="つぎへ" icon="next" size="aux" onPress={skip} testId="skip-button" />
          ) : null}
          <Tap
            label="しゅっぱつ"
            text="しゅっぱつ"
            icon="go"
            variant="main"
            className="road-go"
            disabled={busy}
            onPress={go}
            testId="go-button"
          />
        </div>
      </div>
    </div>
  );
}
