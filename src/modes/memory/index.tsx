/**
 * おぼえてさがす（M5）。絵を見て「おぼえた！」→ 答える（選ぶ・場所・順番）。
 * 表示時間は全段階で同じ（子供が押すまで。保護者設定があれば自動で隠す）。
 * 答える画面では覚えた絵を DOM から取り除く。「もういちど みる」でいつでも戻れる（罰なし）。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ModePlayProps } from '../../core/session/types';
import { useQuestion } from '../../core/session/useQuestion';
import { initialQuestion, praiseFor, type QuestionState } from '../../core/session/questionFlow';
import { Bubble } from '../../ui/Bubble';
import { Tap } from '../../ui/Tap';
import { textOf } from '../../app/voiceText';
import {
  generateRound,
  isAnswerPick,
  isFinishedPick,
  itemKey,
  nextInOrder,
  type MemItem,
} from './logic';
import { AnswerView, StudyView } from './views';
import './memory.css';

/** 「おぼえた！」が押せるようになるまで（見ないまま押すのを防ぐ操作の有効化） */
const READY_MS = 1500;

interface Draft {
  index: number;
  q: QuestionState;
  picked: MemItem[];
  placedCount: number;
  outcomes: string[];
  phase: 'study' | 'answer';
}

const ANSWER_PROMPT = {
  pick: 'mem.which',
  place: 'mem.where',
  order: 'mem.order',
} as const;

export default function Memory({ session }: ModePlayProps) {
  const questions = useMemo(
    () => generateRound(session.level, session.seed, session.roundSize),
    [session.level, session.seed, session.roundSize],
  );
  const resume = session.resume as Draft | null;
  const [index, setIndex] = useState(resume?.index ?? 0);
  const [phase, setPhase] = useState<'study' | 'answer'>('study');
  const [studyKey, setStudyKey] = useState(0);
  const [allShown, setAllShown] = useState(false);
  const [ready, setReady] = useState(false);
  const [picked, setPicked] = useState<MemItem[]>(resume?.picked ?? []);
  const [placedCount, setPlacedCount] = useState(resume?.placedCount ?? 0);
  const [wrongs, setWrongs] = useState<(MemItem | number)[]>([]);
  const [flash, setFlash] = useState<MemItem | null>(null);
  const [hintItem, setHintItem] = useState<MemItem | null>(null);
  const [nudge, setNudge] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const outcomes = useRef<string[]>(resume?.outcomes ?? []);
  const restored = useRef(false);
  const q = useQuestion();
  const question = questions[index]!;
  const autoHide = session.settings.memoryAutoHideSec;

  // 問題の開始（中断からの再開時は、覚える画面から）
  useEffect(() => {
    if (resume && !restored.current) {
      restored.current = true;
      // 答える画面で中断していたら、覚える画面から始まる＝見直しとして数える
      q.restore(
        resume.phase === 'answer'
          ? { ...resume.q, reviewsUsed: resume.q.reviewsUsed + 1 }
          : resume.q,
      );
    }
    session.expose({
      index,
      kind: question.kind,
      shown: question.shown,
      answer: question.answer,
      choices: question.choices,
      pos: question.pos ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // 声（覚える画面・答える画面）
  useEffect(() => {
    if (phase === 'study') {
      if (index === 0 && studyKey === 0 && !resume) {
        void session.prompt(['mem.look', 'mem.press'], 'mem.look');
      } else void session.prompt('app.look-again');
    } else {
      const key = question.answer.length === 2 ? 'mem.which2' : ANSWER_PROMPT[question.kind];
      void session.prompt(key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, phase, studyKey]);

  // 「おぼえた！」の有効化と自動で隠す（出し終えてから数える）
  useEffect(() => {
    if (phase !== 'study' || !allShown) return;
    const t1 = window.setTimeout(() => setReady(true), READY_MS);
    const t2 =
      autoHide > 0 ? window.setTimeout(() => setPhase('answer'), autoHide * 1000) : undefined;
    return () => {
      window.clearTimeout(t1);
      if (t2 !== undefined) window.clearTimeout(t2);
    };
  }, [phase, allShown, studyKey, autoHide]);

  const save = (over: Partial<Draft> = {}) =>
    session.saveDraft({
      index,
      q: q.current,
      picked,
      placedCount,
      outcomes: outcomes.current,
      phase,
      ...over,
    } satisfies Draft);

  // 覚える画面・答える画面の切り替えのたびに下書きを保存する（再開時の見直し判定に使う）
  useEffect(() => {
    save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startStudy = () => {
    setPhase('study');
    setStudyKey((k) => k + 1);
    setAllShown(false);
    setReady(false);
    setBubble(null);
    setHintItem(null);
    setNudge(false);
  };

  const review = () => {
    if (busy) return;
    q.review();
    session.sfx('tap');
    startStudy();
    save({ q: q.current });
  };

  const showHint = (level: 1 | 2) => {
    let seq: string[] = ['mem.hint-review'];
    if (level === 2) {
      setNudge(true);
      seq = ['mem.hint-review2'];
      if (question.kind === 'order') {
        const next = nextInOrder(question, placedCount);
        setHintItem(next ?? null);
        if (placedCount === 0) seq = [`mem.first.${question.answer[0]!}`];
      }
    }
    setBubble(textOf(seq));
    void session.say(seq);
  };

  const askHint = () => {
    if (busy) return;
    const s = q.hint();
    showHint(s.hintLevel === 2 ? 2 : 1);
    save({ q: q.current });
  };

  const advance = () => {
    const last = index + 1 >= questions.length;
    // record と同時に次の問題の下書きを保存する（最後なら消す）
    if (last) session.clearDraft();
    else {
      session.saveDraft({
        index: index + 1,
        q: initialQuestion(),
        picked: [],
        placedCount: 0,
        outcomes: outcomes.current,
        phase: 'study',
      } satisfies Draft);
    }
    window.setTimeout(() => {
      if (last) {
        const seen = new Set<string>();
        for (const qu of questions) for (const a of qu.answer) seen.add(a);
        const solved = outcomes.current.some((o) => o !== 'skipped');
        const praise = !solved
          ? 'praise.watched'
          : outcomes.current.includes('after_review')
            ? 'praise.reviewed'
            : 'praise.finished';
        session.finish({ illusts: [...seen].slice(0, 5), praise });
        return;
      }
      setIndex(index + 1);
      setPicked([]);
      setPlacedCount(0);
      setWrongs([]);
      setFlash(null);
      setRevealed(false);
      setBusy(false);
      q.reset();
      startStudy();
    }, 1600);
  };

  const complete = () => {
    const s = q.correct();
    setBusy(true);
    setBubble(null);
    setHintItem(null);
    session.sfx('correct');
    void session.say(praiseFor(s) ?? 'app.right');
    outcomes.current = [...outcomes.current, s.outcome!];
    session.record({
      itemKey: itemKey(question),
      outcome: s.outcome!,
      wrongTries: s.wrongTries,
      hintsUsed: s.hintsUsed,
      reviewsUsed: s.reviewsUsed,
      operationIssue: s.operationIssue,
    });
    advance();
  };

  const miss = (mark: MemItem | number) => {
    const s = q.wrong();
    session.sfx('wrong');
    if (typeof mark === 'number' || question.kind === 'pick') setWrongs((w) => [...w, mark]);
    else {
      setFlash(mark);
      window.setTimeout(() => setFlash(null), 900);
    }
    showHint(s.hintLevel === 2 ? 2 : 1);
    save({ q: q.current });
  };

  const onPick = (item: MemItem) => {
    if (busy || !q.tap()) return;
    if (question.kind === 'order') {
      if (item !== nextInOrder(question, placedCount)) return miss(item);
      const n = placedCount + 1;
      setPlacedCount(n);
      setHintItem(null);
      session.sfx('place');
      if (n >= question.answer.length) complete();
      else save({ placedCount: n });
      return;
    }
    if (!isAnswerPick(question, item)) return miss(item);
    const next = [...picked, item];
    setPicked(next);
    session.sfx('place');
    if (isFinishedPick(question, next)) complete();
    else save({ picked: next });
  };

  const onCard = (i: number) => {
    if (busy || !q.tap()) return;
    if (i !== question.pos) return miss(i);
    setRevealed(true);
    complete();
  };

  const skip = () => {
    if (busy) return;
    const s = q.skip();
    setBusy(true);
    setBubble(null);
    setHintItem(null);
    setRevealed(true);
    setPicked([...question.answer]);
    setPlacedCount(question.answer.length);
    void session.say('mem.answer');
    outcomes.current = [...outcomes.current, s.outcome!];
    session.record({
      itemKey: itemKey(question),
      outcome: s.outcome!,
      wrongTries: s.wrongTries,
      hintsUsed: s.hintsUsed,
      reviewsUsed: s.reviewsUsed,
      operationIssue: s.operationIssue,
    });
    advance();
  };

  if (phase === 'study') {
    return (
      <div className="mem" data-testid="memory-study">
        <StudyView key={`${index}-${studyKey}`} q={question} onAllShown={() => setAllShown(true)} />
        <div className="bottom-right">
          <Tap
            label="おぼえた"
            text={<span>おぼえた</span>}
            variant="main"
            size="big"
            className="mem-done"
            disabled={!ready}
            onPress={() => {
              session.sfx('tap');
              setPhase('answer');
            }}
            testId="memorized-button"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mem" data-testid="memory-answer">
      <Bubble text={bubble} style={{ left: 'calc(var(--u) * 2)', top: 'calc(var(--u) * 0.8)' }} />
      <AnswerView
        q={question}
        picked={picked}
        placedCount={placedCount}
        wrongs={wrongs}
        flash={flash}
        hintItem={hintItem}
        revealed={revealed}
        disabled={busy}
        onPick={onPick}
        onCard={onCard}
      />
      <div className="bottom-left">
        <Tap
          label="ヒント"
          icon="hint"
          size="aux"
          variant="white"
          onPress={askHint}
          disabled={busy}
          testId="hint-button"
        />
      </div>
      <div className="bottom-right">
        <Tap
          label="もういちど みる"
          text={<span>もういちど みる</span>}
          icon="look"
          variant="sky"
          state={nudge && !busy ? 'hint' : null}
          onPress={review}
          disabled={busy}
          testId="review-button"
        />
        {q.state.canSkip && !busy ? (
          <Tap label="つぎへ" icon="next" size="aux" onPress={skip} testId="skip-button" />
        ) : (
          <span style={{ width: 'var(--tap-aux)' }} />
        )}
      </div>
    </div>
  );
}
