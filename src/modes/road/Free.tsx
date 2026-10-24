/**
 * みちを つくろう「じゆうに つくる」（M7-08）。5×4 の空の盤面にスタートとゴールだけがある。
 * 操作のたびに「つくりかけ」として作品に保存し（期限なし）、再開用の draft にも保存する。
 * 「しゅっぱつ」で進めるところまで進む。「かざる」で完成作品として保存して終わる。
 */
import { useEffect, useRef, useState } from 'react';
import type { ModePlayProps } from '../../core/session/types';
import { Tap } from '../../ui/Tap';
import {
  applyTool,
  findPath,
  isBoard,
  openSidesNotConnected,
  placedCount,
  stopPoint,
  type Board,
  type Pos,
  type Tool,
} from './board';
import { freeBoard } from './content';
import { RoadPicture } from './draw';
import { BUBBLE_STYLE, FREE_TOOLS, Toolbar, cellUFor, rabbitView } from './parts';
import { RoadBoard, type StopView } from './RoadBoard';
import { useWalker } from './useWalker';
import { Bubble } from '../../ui/Bubble';
import { textOf } from '../../app/voiceText';
import './road.css';

interface Draft {
  board: Board;
  workId?: string;
}

function readDraft(raw: unknown): Draft | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Partial<Draft>;
  if (!isBoard(d.board)) return null;
  return { board: d.board, workId: typeof d.workId === 'string' ? d.workId : undefined };
}

const TITLE = 'じゆうな みち';

export default function Free({ session }: ModePlayProps) {
  const resume = useRef(readDraft(session.resume)).current;
  const [board, setBoard] = useState<Board>(resume?.board ?? freeBoard());
  const [tool, setTool] = useState<Tool>('straight');
  const [busy, setBusy] = useState(false);
  const [stop, setStop] = useState<StopView | null>(null);
  const [arrived, setArrived] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const walker = useWalker(session.reduceMotion);
  /** 作品の id（最初の保存の戻り値を使い回す）と、保存の順番待ち */
  const workId = useRef<string | undefined>(resume?.workId);
  const chain = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!bubble) return;
    const t = window.setTimeout(() => setBubble(null), 7000);
    return () => window.clearTimeout(t);
  }, [bubble]);

  useEffect(() => {
    session.expose({ kind: 'free', board });
    void session.prompt(
      resume ? 'road.free-prompt' : ['road.free-intro', 300, 'road.free-prompt'],
      'road.free-prompt',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 作品として保存（順番に1つずつ。最初の1回で id が決まるまで次を待つ） */
  const persist = (b: Board, draft: boolean): Promise<boolean> => {
    let ok = true;
    const run = async () => {
      try {
        const id = await session.saveWork({
          kind: 'road',
          title: TITLE,
          data: { board: b },
          draft,
          id: workId.current,
        });
        workId.current = id;
        if (draft) session.saveDraft({ board: b, workId: id } satisfies Draft);
      } catch (e) {
        ok = false;
        console.error('みちの保存に失敗', e);
      }
    };
    chain.current = chain.current.then(run);
    return chain.current.then(() => ok);
  };

  const clearView = () => {
    walker.reset();
    setStop(null);
    setArrived(false);
    setBubble(null);
  };

  const pickTool = (t: Tool) => {
    if (busy) return;
    setTool(t);
    session.sfx('tap');
    void session.say(`road.tool.${t}`);
  };

  const onCell = (p: Pos) => {
    if (busy || saving) return;
    const res = applyTool(board, p, tool);
    if (res.action === 'none') return;
    setBoard(res.board);
    clearView();
    session.sfx(res.action === 'place' ? 'place' : res.action === 'remove' ? 'remove' : 'tap');
    session.saveDraft({ board: res.board, workId: workId.current } satisfies Draft);
    void persist(res.board, true);
  };

  const go = () => {
    if (busy || saving) return;
    setBubble(null);
    setStop(null);
    setArrived(false);
    const path = findPath(board);
    setBusy(true);
    if (path) {
      walker.start(path, () => {
        setBusy(false);
        setArrived(true);
        session.sfx('correct');
        void session.say('road.arrived');
      });
      return;
    }
    const stp = stopPoint(board);
    if (!stp) {
      setBusy(false);
      return;
    }
    walker.start(stp.path, () => {
      setBusy(false);
      setStop({ pos: stp.pos, sides: openSidesNotConnected(board, stp.pos) });
      session.sfx('wrong');
      setBubble(textOf('road.free-stopped'));
      void session.say('road.free-stopped');
    });
  };

  const decorate = () => {
    if (busy || saving || placedCount(board) === 0) return;
    setSaving(true);
    void persist(board, false).then((ok) => {
      if (!ok) {
        setSaving(false);
        return;
      }
      session.finish({
        showcase: (
          <RoadPicture board={board} icons className="road-showcase__big" label="できた みち" />
        ),
        before: 'road.decorated',
        caption: textOf('road.decorated'),
      });
    });
  };

  const rabbit = rabbitView(board, walker.walk);
  const trail = walker.walk ? walker.walk.path.slice(0, walker.walk.step + 1) : [];
  const locked = busy || saving;

  return (
    <div className="road" data-testid="road-free" data-phase={busy ? 'walking' : 'build'}>
      <div className="road-stage">
        <RoadBoard
          board={board}
          cellU={cellUFor(board)}
          interactive={!locked}
          stop={stop}
          rabbit={rabbit}
          trail={trail}
          arrived={arrived}
          onCell={onCell}
        />
      </div>

      <Bubble text={bubble} style={BUBBLE_STYLE} />

      <div className="road-bottom road-bottom--free">
        <Toolbar tools={FREE_TOOLS} tool={tool} disabled={locked} onPick={pickTool} />
        <div className="road-bottom__right">
          <Tap
            label="しゅっぱつ"
            text="しゅっぱつ"
            icon="go"
            variant="main"
            className="road-go"
            disabled={locked}
            onPress={go}
            testId="go-button"
          />
          <Tap
            label="かざる"
            text="かざる"
            icon="done"
            variant="sky"
            className="road-go road-go--short"
            disabled={locked || placedCount(board) === 0}
            onPress={decorate}
            testId="decorate-button"
          />
        </div>
      </div>
    </div>
  );
}
