/**
 * 3択の問題（A〜C、D2、E）。絵をタップして数える（M9-02）。
 * ヒント: A〜C 1「えを ひとつずつ かぞえて みよう」2 番号を順に付ける実演。D2 1「ぜんぶで〜こ だったね。こっちに〜こ」
 * 2 残りに番号。E 1「えで みる」を勧める 2 絵を表示して番号。ヒント2の後は「つぎへ」。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { textOf } from '../../app/voiceText';
import type { ModeSession } from '../../core/session/types';
import { useQuestion } from '../../core/session/useQuestion';
import type { VoiceSeq } from '../../voice/catalog/index';
import { Bubble } from '../../ui/Bubble';
import { Choice } from '../../ui/Choice';
import { Tap } from '../../ui/Tap';
import { Board } from './Board';
import { buildLayout, countable, demoOrder } from './layout';
import {
  answerOf,
  answerVoice,
  formulaText,
  hintVoice,
  isFormulaOnly,
  itemKeyOf,
  promptOf,
  type MathQuestion,
  type MathStage,
} from './logic';
import { settleAfter, u, type ChoiceDraft, type QResult } from './types';

const SLOTS = 10;
const zeros = (): number[] => Array.from({ length: SLOTS }, () => 0);

interface Props {
  session: ModeSession;
  stage: MathStage;
  question: MathQuestion;
  index: number;
  first: boolean;
  initial: ChoiceDraft | null;
  saveDraft: (d: ChoiceDraft) => void;
  /** 答えが決まった（正解・つぎへ）。結果を渡し、次の問題の下書きを保存する */
  onSettled: (r: QResult) => void;
  /** 演出が終わった。次の問題へ（最後なら完了画面へ） */
  onAdvance: () => void;
}

export function ChoiceQuestion({
  session,
  stage,
  question,
  index,
  first,
  initial,
  saveDraft,
  onSettled,
  onAdvance,
}: Props) {
  const p = question.problem;
  const formulaOnly = isFormulaOnly(stage);
  const answer = answerOf(p)!;
  const q = useQuestion();

  const [pic, setPic] = useState(initial?.pic ?? !formulaOnly);
  const [numbers, setNumbers] = useState<number[]>(initial?.numbers ?? zeros());
  const [numBy, setNumBy] = useState<'child' | 'demo'>(initial?.numBy ?? 'child');
  const [wrong, setWrong] = useState<number[]>(initial?.wrong ?? []);
  const [hint, setHint] = useState<0 | 1 | 2>(initial?.q.hintLevel ?? 0);
  const [bubble, setBubble] = useState<string | null>(null);
  const [demoRunning, setDemoRunning] = useState(false);
  const [eaten, setEaten] = useState(false);
  const [solved, setSolved] = useState(false);
  const [shown, setShown] = useState<number | null>(null);

  const layout = useMemo(() => buildLayout(p, stage, pic), [p, stage, pic]);
  const canCount = useMemo(() => new Set(countable(layout)), [layout]);

  const alive = useRef(true);
  const timers = useRef<number[]>([]);
  const clearTimers = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimers();
    };
  }, []);

  // 問題の開始: 前回の状態を戻し、問題文を読む
  useEffect(() => {
    if (initial) q.restore(initial.q);
    session.expose({
      index,
      stage,
      op: p.op,
      a: p.a,
      b: p.b,
      item: p.item,
      answer,
      choices: question.choices,
      answerIndex: question.answerIndex,
    });
    const pr = promptOf(p, stage, first);
    void session.prompt(pr.seq as VoiceSeq, pr.display as VoiceSeq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // C: 「たべた」絵に印を付けて皿の外へ動かす（絵が見えてから少し待つ）
  useEffect(() => {
    if (!pic || p.op !== '-' || eaten) return;
    const t = window.setTimeout(
      () => {
        if (alive.current) setEaten(true);
      },
      session.reduceMotion ? 0 : 1100,
    );
    return () => window.clearTimeout(t);
  }, [pic, p.op, eaten, session.reduceMotion]);

  const save = (over: Partial<ChoiceDraft> = {}) =>
    saveDraft({ q: q.current, numbers, numBy, pic, wrong, ...over });

  const hintPlates =
    hint === 2 && pic && !solved
      ? p.op === 'part'
        ? ['c']
        : layout.plates.filter((pl) => !pl.area).map((pl) => pl.id)
      : [];

  const speakBubble = (seq: (string | number)[]) => {
    setBubble(textOf(seq as VoiceSeq));
    void session.say(seq as VoiceSeq);
    for (const t of timers.current.splice(0)) window.clearTimeout(t);
    timers.current.push(
      window.setTimeout(() => {
        if (alive.current) setBubble(null);
      }, 7000),
    );
  };

  // ヒント2: 番号を順に付けて数える様子を見せる（答えの札は囲まない）
  const runDemo = (order: number[]) => {
    setNumBy('demo');
    if (session.reduceMotion) {
      const n = zeros();
      order.forEach((id, k) => (n[id] = k + 1));
      setNumbers(n);
      return;
    }
    setNumbers(zeros());
    setDemoRunning(true);
    order.forEach((id, k) => {
      timers.current.push(
        window.setTimeout(
          () => {
            if (!alive.current) return;
            setNumbers((prev) => {
              const n = [...prev];
              n[id] = k + 1;
              return n;
            });
            void session.say(`num.${k + 1}`);
            if (k === order.length - 1) setDemoRunning(false);
          },
          2200 + k * 900,
        ),
      );
    });
  };

  const showHint = (level: 1 | 2) => {
    setHint(level);
    speakBubble(hintVoice(p, stage, level));
    if (level === 2) {
      if (formulaOnly && !pic) setPic(true);
      runDemo(demoOrder(p, buildLayout(p, stage, true)));
    }
  };

  const tapPic = (i: number) => {
    if (solved || demoRunning || !canCount.has(i)) return;
    const base = numBy === 'demo' ? zeros() : numbers;
    if (base[i]! > 0) {
      void session.say(`num.${base[i]}`);
      return;
    }
    const n = [...base];
    n[i] = Math.max(0, ...base) + 1;
    setNumbers(n);
    setNumBy('child');
    session.sfx('tap');
    void session.say(`num.${n[i]}`);
    save({ numbers: n, numBy: 'child' });
  };

  const recount = () => {
    if (solved || demoRunning) return;
    for (const t of timers.current.splice(0)) window.clearTimeout(t);
    setNumbers(zeros());
    setNumBy('child');
    session.sfx('remove');
    save({ numbers: zeros(), numBy: 'child' });
  };

  /** E: 「えで みる」 */
  const showPictures = () => {
    if (solved || pic) return;
    q.review();
    setPic(true);
    session.sfx('place');
    save({ pic: true });
  };

  const finishWith = (result: QResult, voice: Promise<unknown>) => {
    onSettled(result);
    void settleAfter(voice).then(() => {
      if (alive.current) onAdvance();
    });
  };

  const choose = (i: number) => {
    if (solved || !q.tap()) return;
    if (i === question.answerIndex) {
      const s = q.correct();
      const counted =
        numBy === 'child' && numbers.filter((n) => n > 0).length >= Math.min(2, canCount.size);
      setSolved(true);
      setShown(i);
      setBubble(null);
      setDemoRunning(false);
      clearTimers();
      session.sfx('correct');
      session.record({
        itemKey: itemKeyOf(p),
        outcome: s.outcome!,
        wrongTries: s.wrongTries,
        hintsUsed: s.hintsUsed,
        reviewsUsed: s.reviewsUsed,
        operationIssue: s.operationIssue,
        detail: { stage, item: p.item, counted },
      });
      const voice = session.say(['app.ok', 200, ...answerVoice(p)] as VoiceSeq);
      finishWith(
        {
          texts: [formulaText(p, true)],
          item: p.item,
          ok: true,
          counted,
          reviewed: formulaOnly && s.outcome === 'after_review',
          otherSplit: false,
        },
        voice,
      );
    } else {
      const s = q.wrong();
      session.sfx('wrong');
      const nextWrong = [...wrong, i];
      setWrong(nextWrong);
      showHint(s.hintLevel === 2 ? 2 : 1);
      save({ wrong: nextWrong });
    }
  };

  const askHint = () => {
    if (solved) return;
    const s = q.hint();
    showHint(s.hintLevel === 2 ? 2 : 1);
    save();
  };

  const skip = () => {
    if (solved) return;
    const s = q.skip();
    setSolved(true);
    setShown(question.answerIndex);
    setBubble(null);
    setDemoRunning(false);
    clearTimers();
    session.record({
      itemKey: itemKeyOf(p),
      outcome: s.outcome!,
      wrongTries: s.wrongTries,
      hintsUsed: s.hintsUsed,
      reviewsUsed: s.reviewsUsed,
      operationIssue: s.operationIssue,
      detail: { stage, item: p.item },
    });
    const voice = session.say('app.show-answer');
    finishWith(
      {
        texts: [formulaText(p, true)],
        item: p.item,
        ok: false,
        counted: false,
        reviewed: false,
        otherSplit: false,
      },
      voice,
    );
  };

  const anyNumber = numbers.some((n) => n > 0);

  return (
    <div className="math-board" data-testid="math-board" data-stage={stage}>
      <Board
        layout={layout}
        item={p.item}
        eaten={eaten}
        moveEaten={!session.reduceMotion}
        numbers={numbers}
        locked={solved || demoRunning}
        hintPlates={hintPlates}
        answer={solved ? answer : null}
        onPic={tapPic}
      />

      <Bubble
        text={bubble}
        style={{
          left: '50%',
          transform: 'translateX(-50%)',
          top: u(layout.bottom + 0.8),
          maxWidth: u(60),
        }}
      />

      <div className="math-choices" role="group" aria-label="こたえ">
        {question.choices.map((v, i) => (
          <Choice
            key={i}
            label={String(v)}
            text={String(v)}
            className="math-choice"
            state={shown === i ? 'correct' : wrong.includes(i) ? 'wrong' : null}
            disabled={solved || wrong.includes(i)}
            onPress={() => choose(i)}
            testId={`choice-${i}`}
          />
        ))}
      </div>

      <div className="math-left">
        {q.state.canSkip && !solved ? (
          <Tap
            label="つぎへ"
            text={<span className="math-tool-text">つぎへ</span>}
            icon="next"
            size="aux"
            onPress={skip}
            testId="skip-button"
          />
        ) : null}
        <Tap
          label="ヒント"
          icon="hint"
          size="aux"
          variant="white"
          onPress={askHint}
          disabled={solved}
          testId="hint-button"
        />
      </div>

      <div className="math-right">
        {formulaOnly && !pic ? (
          <Tap
            label="えで みる"
            text={<span className="math-tool-text">えで みる</span>}
            icon="picture"
            size="aux"
            variant="white"
            className={hint === 1 ? 'is-hint' : ''}
            onPress={showPictures}
            disabled={solved}
            testId="review-button"
          />
        ) : (
          <Tap
            label="かぞえなおす"
            text={<span className="math-tool-text">かぞえなおす</span>}
            icon="recount"
            size="aux"
            variant="white"
            onPress={recount}
            disabled={solved || demoRunning || !anyNumber}
            testId="recount-button"
          />
        )}
      </div>
    </div>
  );
}
