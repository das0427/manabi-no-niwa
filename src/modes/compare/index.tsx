/**
 * くらべっこ（M6）。P1〜P3 は左右のカードをタップ、P4 は「ひだり・みぎ・おなじ」の札、P5 は3つをタップした順にマスへ並べる。
 * 2つ（3つ）は 1 つの SVG（Scene）に同じ座標系・同じ倍率で描く。
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { ModePlayProps } from '../../core/session/types';
import { useQuestion } from '../../core/session/useQuestion';
import { initialQuestion, type QuestionState } from '../../core/session/questionFlow';
import { textOf } from '../../app/voiceText';
import { Bubble } from '../../ui/Bubble';
import { Choice } from '../../ui/Choice';
import { Tap, type TapState } from '../../ui/Tap';
import {
  cardBoxes,
  doneVoice,
  generateRound,
  hintVoice,
  itemKey,
  judgeOrder,
  judgePair,
  questionVoice,
  slotBoxes,
  type Box,
  type CompareQuestion,
} from './logic';
import { Scene, Showcase } from './Scene';
import { Tabs } from './Tabs';
import './compare.css';

interface Draft {
  index: number;
  q: QuestionState;
  results: { key: string; ok: boolean }[];
  wrong: number[];
  placed: number[];
  counted: boolean;
  own?: number;
}

const at = (b: Box): CSSProperties => ({
  left: `calc(var(--u) * ${b.x})`,
  top: `calc(var(--u) * ${b.y})`,
  width: `calc(var(--u) * ${b.w})`,
  height: `calc(var(--u) * ${b.h})`,
});

const SIDE = ['ひだり', 'みぎ', 'おなじ'] as const;
const NEXT_MS = 1600;

export default function Compare({ session }: ModePlayProps) {
  const questions = useMemo(
    () => generateRound(session.level, session.seed, session.roundSize),
    [session.level, session.seed, session.roundSize],
  );
  const resume = session.resume as Draft | null;
  const [index, setIndex] = useState(resume?.index ?? 0);
  const [wrong, setWrong] = useState<number[]>(resume?.wrong ?? []);
  const [placed, setPlaced] = useState<number[]>(resume?.placed ?? []);
  const [solved, setSolved] = useState<number | null>(null);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2>(resume?.q.hintLevel ?? 0);
  const [bubble, setBubble] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [nums, setNums] = useState<Record<string, number>>({});
  const results = useRef<Draft['results']>(resume?.results ?? []);
  const countedRound = useRef(resume?.counted ?? false);
  const ownSolved = useRef(resume?.own ?? 0);
  const restored = useRef(false);
  const q = useQuestion();
  const question: CompareQuestion = questions[index]!;
  const isOrder = question.type === 'order';

  // 問題の開始
  useEffect(() => {
    if (resume && !restored.current) {
      restored.current = true;
      q.restore(resume.q);
    }
    session.expose(
      question.type === 'pair'
        ? {
            index,
            level: question.level,
            kind: question.kind,
            ask: question.ask,
            values: question.values,
            answer: question.answer,
          }
        : {
            index,
            level: question.level,
            kind: question.kind,
            ask: question.ask,
            values: question.values,
            order: question.order,
          },
    );
    const qv = questionVoice(question);
    let intro: string | null = null;
    if (index === 0 && !resume) {
      intro =
        question.type === 'order'
          ? 'cmp.intro.order'
          : question.withSame
            ? 'cmp.intro.three'
            : 'cmp.intro.pick';
    }
    void session.prompt(intro ? [intro, 300, ...qv] : qv, qv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const saveDraft = (over: Partial<Draft> = {}) =>
    session.saveDraft({
      index,
      q: q.current,
      results: results.current,
      wrong,
      placed,
      counted: countedRound.current,
      own: ownSolved.current,
      ...over,
    } satisfies Draft);

  const showHint = (level: 1 | 2) => {
    const key = hintVoice(question, level);
    setHintLevel(level);
    setBubble(textOf(key));
    void session.say(key);
  };

  const advance = (ok: boolean) => {
    results.current = [...results.current, { key: itemKey(question), ok }];
    // 記録と同時に次の問題の下書きを保存する（最後なら消す）
    if (index + 1 >= questions.length) session.clearDraft();
    else {
      session.saveDraft({
        index: index + 1,
        q: initialQuestion(),
        results: results.current,
        wrong: [],
        placed: [],
        counted: countedRound.current,
        own: ownSolved.current,
      } satisfies Draft);
    }
    window.setTimeout(() => {
      if (index + 1 >= questions.length) {
        const done = doneVoice(questions);
        const praise =
          ownSolved.current === 0
            ? 'praise.watched'
            : countedRound.current
              ? 'praise.counted'
              : 'praise.finished';
        const seen = new Set<string>();
        const things = questions
          .filter((x) => !seen.has(x.thing) && seen.add(x.thing))
          .slice(0, 5)
          .map((x) => ({ kind: x.kind, thing: x.thing }));
        session.finish({
          before: done,
          praise,
          caption: textOf([done, praise]),
          showcase: <Showcase things={things} />,
        });
        return;
      }
      setIndex(index + 1);
      setWrong([]);
      setPlaced([]);
      setSolved(null);
      setDone(false);
      setHintLevel(0);
      setBubble(null);
      setNums({});
      setBusy(false);
      q.reset();
    }, NEXT_MS);
  };

  const onCorrect = (mark: number | null, finalPlaced?: number[]) => {
    const s = q.correct();
    setBusy(true);
    setSolved(mark);
    setDone(true);
    if (finalPlaced) setPlaced(finalPlaced);
    setBubble(null);
    ownSolved.current += 1;
    // 比べる2つの群の物を全部数えたときだけ「かぞえられたね」
    if (question.type === 'pair' && question.kind === 'count') {
      const n0 = Object.keys(nums).filter((k) => k.startsWith('0-')).length;
      const n1 = Object.keys(nums).filter((k) => k.startsWith('1-')).length;
      if (n0 === question.values[0] && n1 === question.values[1]) countedRound.current = true;
    }
    session.sfx('correct');
    void session.say(
      question.type === 'pair' && question.answer === 2 ? 'cmp.same-right' : 'app.right',
    );
    session.record({
      itemKey: itemKey(question),
      outcome: s.outcome!,
      wrongTries: s.wrongTries,
      hintsUsed: s.hintsUsed,
      operationIssue: s.operationIssue,
      detail: { kind: question.kind, ask: question.ask },
    });
    advance(true);
  };

  const onWrong = () => {
    const s = q.wrong();
    session.sfx('wrong');
    showHint(s.hintLevel === 2 ? 2 : 1);
  };

  // 2択・3択の選択
  const choose = (side: number) => {
    if (question.type !== 'pair' || busy || wrong.includes(side)) return;
    if (!q.tap()) return;
    if (judgePair(question, side)) {
      onCorrect(side);
    } else {
      const next = [...wrong, side];
      setWrong(next);
      onWrong();
      saveDraft({ wrong: next, q: q.current });
    }
  };

  // P5: カードをタップするとマスに入る
  const place = (d: number) => {
    if (question.type !== 'order' || busy || placed.includes(d) || placed.length >= 3) return;
    const next = [...placed, d];
    setPlaced(next);
    session.sfx('place');
    if (next.length < 3) {
      saveDraft({ placed: next });
      return;
    }
    if (!q.tap()) return;
    if (judgeOrder(question, next)) {
      onCorrect(null, next);
    } else {
      setBusy(true);
      onWrong();
      saveDraft({ placed: [], q: q.current });
      window.setTimeout(() => {
        setPlaced([]);
        setBusy(false);
      }, 1500);
    }
  };

  const unplace = (slot: number) => {
    if (busy || slot >= placed.length) return;
    const next = placed.slice(0, slot);
    setPlaced(next);
    session.sfx('remove');
    saveDraft({ placed: next });
  };

  const count = (card: number, i: number) => {
    if (busy) return;
    const key = `${card}-${i}`;
    if (nums[key] !== undefined) return;
    const n = Object.keys(nums).filter((k) => k.startsWith(`${card}-`)).length + 1;
    setNums({ ...nums, [key]: n });
    session.sfx('tap');
    void session.say(`num.${n}`);
  };

  const askHint = () => {
    if (busy) return;
    const s = q.hint();
    showHint(s.hintLevel === 2 ? 2 : 1);
    saveDraft({ q: q.current });
  };

  const skip = () => {
    if (busy) return;
    const s = q.skip();
    setBusy(true);
    setBubble(null);
    if (question.type === 'pair') setSolved(question.answer);
    else {
      setPlaced([...question.order]);
      setDone(true);
    }
    void session.say('app.show-answer');
    session.record({
      itemKey: itemKey(question),
      outcome: s.outcome!,
      wrongTries: s.wrongTries,
      hintsUsed: s.hintsUsed,
      operationIssue: s.operationIssue,
      detail: { kind: question.kind, ask: question.ask },
    });
    advance(false);
  };

  const cards = cardBoxes(question);
  const slots = slotBoxes();
  const stateOf = (side: number): TapState =>
    solved === side ? 'correct' : wrong.includes(side) ? 'wrong' : null;

  return (
    <div className="cmp" data-testid="compare-board">
      {question.type === 'pair' ? (
        <>
          {cards.map((b, i) =>
            question.kind === 'count' ? (
              <div key={i} className="cmp-card cmp-card--static" style={at(b)} />
            ) : (
              <Choice
                key={i}
                label={SIDE[i]!}
                state={stateOf(i)}
                className="cmp-card"
                style={at(b)}
                onPress={() => choose(i)}
                testId={question.withSame ? `card-${i}` : `choice-${i}`}
              />
            ),
          )}
          <Scene
            q={question}
            hintLevel={hintLevel}
            wrong={wrong}
            placed={[]}
            nums={nums}
            onCount={question.kind === 'count' ? count : undefined}
          />
          {question.labels ? (
            <Tabs withSame={question.withSame} stateOf={stateOf} onChoose={choose} />
          ) : null}
        </>
      ) : (
        <>
          {cards.map((b, d) => (
            <Choice
              key={d}
              label={`${d + 1}ばんめの カード`}
              className={`cmp-card ${placed.includes(d) ? 'cmp-card--empty' : ''}`}
              style={at(b)}
              onPress={() => place(d)}
              testId={`card-${d}`}
            />
          ))}
          {slots.map((b, s) => (
            <button
              key={s}
              type="button"
              className={`cmp-slot ${done ? 'cmp-slot--done' : ''}`}
              style={at(b)}
              aria-label={`${s + 1}ばんの マス`}
              onClick={() => unplace(s)}
              data-testid={`slot-${s}`}
            />
          ))}
          <Scene q={question} hintLevel={hintLevel} wrong={[]} placed={placed} nums={nums} />
        </>
      )}

      <Bubble
        text={bubble}
        style={{ left: 'calc(var(--u) * 10)', bottom: 'calc(var(--u) * 3.5)' }}
      />

      <div className="bottom-left">
        <Tap
          label="ヒント"
          icon="hint"
          size="aux"
          variant="white"
          onPress={askHint}
          testId="hint-button"
        />
      </div>
      <div className="bottom-right">
        {isOrder ? (
          <Tap
            label="もどす"
            icon="undo"
            size="aux"
            variant="white"
            onPress={() => unplace(placed.length - 1)}
            testId="undo-button"
          />
        ) : null}
        {q.state.canSkip && !busy ? (
          <Tap label="つぎへ" icon="next" size="aux" onPress={skip} testId="skip-button" />
        ) : (
          <span style={{ width: 'var(--tap-aux)' }} />
        )}
      </div>
    </div>
  );
}
