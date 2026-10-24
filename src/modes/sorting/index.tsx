/**
 * なかまわけ（M3）。絵をタップ（持ち上がる）→ 箱をタップ。違う箱なら絵は元の場所へ戻りヒント。
 * 箱の中の絵をタップすると外へ戻せる。1盤面 = 1問。N4 は しゅるい → いろ の順に分け直す。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ModePlayProps } from '../../core/session/types';
import { useQuestion } from '../../core/session/useQuestion';
import type { QuestionState } from '../../core/session/questionFlow';
import type { Outcome } from '../../core/types';
import { vocab } from '../../content/vocab';
import { Illust } from '../../illust/Illust';
import { Bubble } from '../../ui/Bubble';
import { Tap } from '../../ui/Tap';
import { textOf } from '../../app/voiceText';
import {
  boardLabel,
  correctBox,
  generateRound,
  isVoice,
  lookVoice,
  stageVoice,
  type Board,
  type BoxValue,
  type SortPic,
} from './logic';
import { SortBox } from './SortBox';
import './sorting.css';

type Placed = Partial<Record<SortPic, BoxValue>>;

interface Draft {
  index: number;
  stage: number;
  placed: Placed;
  q: QuestionState;
  outcomes: Outcome[];
}

interface HintView {
  pic: SortPic;
  level: 1 | 2;
}

export default function Sorting({ session }: ModePlayProps) {
  const boards = useMemo(
    () => generateRound(session.level, session.seed, session.roundSize),
    [session.level, session.seed, session.roundSize],
  );
  const resume = session.resume as Draft | null;
  const [index, setIndex] = useState(resume?.index ?? 0);
  const [stageNo, setStageNo] = useState(resume?.stage ?? 0);
  const [placed, setPlaced] = useState<Placed>(resume?.placed ?? {});
  const [selected, setSelected] = useState<SortPic | null>(null);
  const [hint, setHint] = useState<HintView | null>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [solved, setSolved] = useState(false);
  const outcomes = useRef<Outcome[]>(resume?.outcomes ?? []);
  const lastTried = useRef<SortPic | null>(null);
  const q = useQuestion();
  const board: Board = boards[index]!;
  const stage = board.stages[stageNo]!;
  const restored = useRef(false);

  const say = (seq: string[]) => {
    setBubble(textOf(seq));
    void session.say(seq);
  };

  // 盤面（と基準）の始まり
  useEffect(() => {
    if (resume && !restored.current) {
      restored.current = true;
      q.restore(resume.q);
    }
    session.expose({
      index,
      stage: stageNo,
      criterion: stage.criterion,
      boxes: stage.boxes,
      pics: board.pics,
      answer: Object.fromEntries(board.pics.map((p) => [p, correctBox(stage, p)])),
    });
    const seq = stageVoice(stage, stageNo > 0);
    const first = index === 0 && stageNo === 0 && !resume;
    void session.prompt(first ? ['sort.how', 300, ...seq] : seq, seq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, stageNo]);

  const saveDraft = (nextPlaced: Placed, st = stageNo, i = index) =>
    session.saveDraft({
      index: i,
      stage: st,
      placed: nextPlaced,
      q: q.current,
      outcomes: outcomes.current,
    } satisfies Draft);

  const inBox = (v: BoxValue) => board.pics.filter((p) => placed[p] === v);
  const inTray = board.pics.filter((p) => placed[p] === undefined);

  const showHint = (level: 1 | 2, pic: SortPic) => {
    setHint({ pic, level });
    if (level === 1) {
      say([lookVoice(stage.criterion)]);
    } else {
      say([isVoice(correctBox(stage, pic))]);
    }
  };

  const tapPic = (pic: SortPic) => {
    if (busy || solved) return;
    if (placed[pic] !== undefined) {
      const next = { ...placed };
      delete next[pic];
      setPlaced(next);
      setHint(null);
      session.sfx('remove');
      saveDraft(next);
      return;
    }
    session.sfx('tap');
    setSelected(selected === pic ? null : pic);
  };

  const nextBoard = () => {
    outcomes.current = [...outcomes.current, q.current.outcome ?? 'skipped'];
    window.setTimeout(() => {
      if (index + 1 >= boards.length) {
        const independent = outcomes.current.includes('independent');
        session.finish({
          praise: independent
            ? stage.criterion === 'color'
              ? 'praise.sorted-color'
              : 'praise.sorted-kind'
            : 'praise.finished',
          showcase: <Showcase board={board} stageNo={stageNo} />,
        });
        return;
      }
      setIndex(index + 1);
      setStageNo(0);
      setPlaced({});
      setSelected(null);
      setHint(null);
      setBubble(null);
      setSolved(false);
      setBusy(false);
      lastTried.current = null;
      q.reset();
      saveDraft({}, 0, index + 1);
    }, 1600);
  };

  const tapBox = (value: BoxValue) => {
    if (busy || solved) return;
    if (!selected) {
      void session.say('sort.pick-first');
      return;
    }
    if (!q.tap()) return;
    const pic = selected;
    lastTried.current = pic;
    if (correctBox(stage, pic) !== value) {
      const s = q.wrong();
      session.sfx('wrong');
      setSelected(null); // 絵は元の場所へ戻る
      showHint(s.hintLevel === 2 ? 2 : 1, pic);
      saveDraft(placed);
      return;
    }
    const next: Placed = { ...placed, [pic]: value };
    setPlaced(next);
    setSelected(null);
    setHint(null);
    setBubble(null);
    session.sfx('place');
    saveDraft(next);
    if (board.pics.some((p) => next[p] === undefined)) return;

    // この基準は全部入った
    setBusy(true);
    if (stageNo + 1 < board.stages.length) {
      void session.say('app.ok');
      window.setTimeout(() => {
        setStageNo(stageNo + 1);
        setPlaced({});
        setBusy(false);
        saveDraft({}, stageNo + 1);
      }, 1600);
      return;
    }
    const s = q.correct();
    setSolved(true);
    session.sfx('correct');
    void session.say('app.ok');
    session.record({
      itemKey: boardLabel(board),
      outcome: s.outcome!,
      wrongTries: s.wrongTries,
      hintsUsed: s.hintsUsed,
      operationIssue: s.operationIssue,
      detail: { stages: board.stages.length },
    });
    nextBoard();
  };

  const askHint = () => {
    if (busy || solved) return;
    const s = q.hint();
    const pic = selected ?? lastTried.current ?? inTray[0];
    if (!pic) return;
    showHint(s.hintLevel === 2 ? 2 : 1, pic);
  };

  const skip = () => {
    if (busy || solved) return;
    const s = q.skip();
    setBusy(true);
    setSolved(true);
    setSelected(null);
    setHint(null);
    setPlaced(Object.fromEntries(board.pics.map((p) => [p, correctBox(stage, p)])));
    say(['app.show-answer']);
    session.record({
      itemKey: boardLabel(board),
      outcome: s.outcome!,
      wrongTries: s.wrongTries,
      hintsUsed: s.hintsUsed,
      operationIssue: s.operationIssue,
      detail: { stages: board.stages.length },
    });
    nextBoard();
  };

  const hintBox = hint && hint.level === 2 ? correctBox(stage, hint.pic) : null;
  const n = stage.boxes.length;

  return (
    <div className="sort" data-testid="sorting-board" data-criterion={stage.criterion}>
      <div className={`sort-boxes sort-boxes--${n}`}>
        {stage.boxes.map((v) => (
          <SortBox
            key={`${stageNo}-${v}`}
            value={v}
            allPics={board.pics}
            contents={inBox(v)}
            hint={hintBox === v}
            onBox={() => tapBox(v)}
            onPic={(pic) => (selected ? tapBox(v) : tapPic(pic))}
          />
        ))}
      </div>

      <div className="sort-tray" role="group" aria-label="えを わけよう">
        {board.pics.map((pic) =>
          placed[pic] === undefined ? (
            <button
              key={pic}
              type="button"
              className={`choice sort-pic ${selected === pic ? 'is-selected' : ''} ${hint?.level === 2 && hint.pic === pic ? 'is-hint' : ''}`}
              aria-label={vocab(pic).label}
              onClick={() => tapPic(pic)}
              disabled={busy}
              data-testid={`pic-${pic}`}
            >
              <Illust id={pic} className="sort-pic__img" decorative />
            </button>
          ) : (
            <span key={pic} className="sort-pic sort-pic--gap" aria-hidden />
          ),
        )}
      </div>

      <Bubble text={bubble} style={{ left: 'calc(var(--u) * 12)', bottom: 'calc(var(--u) * 3)' }} />

      <div className="sort-bottom">
        <Tap
          label="ヒント"
          icon="hint"
          size="aux"
          variant="white"
          onPress={askHint}
          disabled={busy}
          testId="hint-button"
        />
        {q.state.canSkip && !solved ? (
          <Tap label="つぎへ" icon="next" size="aux" onPress={skip} testId="skip-button" />
        ) : (
          <span style={{ width: 'var(--tap-aux)' }} />
        )}
      </div>
    </div>
  );
}

function Showcase({ board, stageNo }: { board: Board; stageNo: number }) {
  const stage = board.stages[stageNo]!;
  return (
    <div className="sort-showcase">
      {stage.boxes.map((v) => (
        <SortBox
          key={v}
          value={v}
          allPics={board.pics}
          contents={board.pics.filter((p) => correctBox(stage, p) === v)}
          interactive={false}
          size="small"
        />
      ))}
    </div>
  );
}
