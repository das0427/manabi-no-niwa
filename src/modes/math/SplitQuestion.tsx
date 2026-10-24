/**
 * D1: n 個を2つのおさらに分ける。絵をタップすると おさらA → おさらB → 元の場所 の順に移る（タップのみ）。
 * 両方のおさらに1つ以上（全部のせて）で「できた」。1と4・4と1 は別の分け方。分けたあと、任意でもう一度。
 * 探索の遊び: ヒントなしで「できた」を押せば independent。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { textOf } from '../../app/voiceText';
import type { ModeSession } from '../../core/session/types';
import { useQuestion } from '../../core/session/useQuestion';
import { vocab } from '../../content/vocab';
import { Illust } from '../../illust/Illust';
import type { VoiceSeq } from '../../voice/catalog/index';
import { Bubble } from '../../ui/Bubble';
import { Tap } from '../../ui/Tap';
import { buildSplitLayout, splitPicPos } from './layout';
import {
  hintVoice,
  isValidSplit,
  itemKeyOf,
  promptOf,
  splitFormula,
  splitVoice,
  splitsOf,
  type MathQuestion,
} from './logic';
import { u, type QResult, type SplitDraft } from './types';

interface Props {
  session: ModeSession;
  question: MathQuestion;
  index: number;
  first: boolean;
  initial: SplitDraft | null;
  saveDraft: (d: SplitDraft) => void;
  onNext: (r: QResult) => void;
}

export function SplitQuestion({
  session,
  question,
  index,
  first,
  initial,
  saveDraft,
  onNext,
}: Props) {
  const p = question.problem;
  const n = p.a;
  const q = useQuestion();
  const lay = useMemo(() => buildSplitLayout(n), [n]);
  const label = vocab(p.item).label;

  const [place, setPlace] = useState<number[]>(
    initial?.place ?? Array.from({ length: n }, () => 0),
  );
  const [splits, setSplits] = useState<string[]>(initial?.splits ?? []);
  const [phase, setPhase] = useState<SplitDraft['phase']>(initial?.phase ?? 'play');
  const [recorded, setRecorded] = useState(initial?.recorded ?? false);
  const [hint, setHint] = useState<0 | 1 | 2>(initial?.q.hintLevel ?? 0);
  const [bubble, setBubble] = useState<string | null>(null);
  const otherSplit = useRef(false);
  const skipped = useRef(false);
  const leaving = useRef(false);
  const alive = useRef(true);
  const bubbleTimer = useRef<number | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (bubbleTimer.current !== null) window.clearTimeout(bubbleTimer.current);
    };
  }, []);

  useEffect(() => {
    if (initial) q.restore(initial.q);
    session.expose({
      index,
      stage: 'D1',
      op: 'split',
      n,
      item: p.item,
      validSplits: splitsOf(n),
    });
    const pr = promptOf(p, 'D1', first);
    void session.prompt(pr.seq as VoiceSeq, pr.display as VoiceSeq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = (over: Partial<SplitDraft> = {}) =>
    saveDraft({ q: q.current, place, splits, phase, recorded, ...over });

  const say = (seq: (string | number)[], show: boolean) => {
    if (show) {
      setBubble(textOf(seq as VoiceSeq));
      if (bubbleTimer.current !== null) window.clearTimeout(bubbleTimer.current);
      bubbleTimer.current = window.setTimeout(() => {
        if (alive.current) setBubble(null);
      }, 7000);
    }
    return session.say(seq as VoiceSeq);
  };

  const cntA = place.filter((w) => w === 1).length;
  const cntB = place.filter((w) => w === 2).length;
  const total = splitsOf(n).length;

  const tapItem = (i: number) => {
    if (phase === 'done') return;
    const next = [...place];
    next[i] = (next[i]! + 1) % 3;
    setPlace(next);
    setBubble(null);
    session.sfx(next[i] === 0 ? 'remove' : 'place');
    save({ place: next });
  };

  const showHint = (level: 1 | 2) => {
    setHint(level);
    void say(hintVoice(p, 'D1', level), true);
  };

  const askHint = () => {
    if (phase !== 'play') return;
    const s = q.hint();
    showHint(s.hintLevel === 2 ? 2 : 1);
    save();
  };

  const done = () => {
    if (phase === 'done') return;
    const allPlaced = place.every((w) => w > 0);
    if (!allPlaced || cntA < 1 || cntB < 1 || !isValidSplit(n, cntA, cntB)) {
      void say(['math.split-need'], true);
      return;
    }
    const key = `${cntA}-${cntB}`;
    setBubble(null);
    if (!recorded) {
      if (!q.tap()) return;
      const s = q.correct();
      session.sfx('correct');
      session.record({
        itemKey: itemKeyOf(p, [cntA, cntB]),
        outcome: s.outcome!,
        wrongTries: s.wrongTries,
        hintsUsed: s.hintsUsed,
        reviewsUsed: s.reviewsUsed,
        operationIssue: s.operationIssue,
        detail: { stage: 'D1', item: p.item },
      });
      const nextSplits = [key];
      setRecorded(true);
      setSplits(nextSplits);
      setPhase('done');
      void say([...splitVoice(n, cntA, cntB), 700, 'math.other-split'], false);
      setBubble(textOf('math.other-split'));
      save({ q: q.current, recorded: true, splits: nextSplits, phase: 'done' });
      return;
    }
    if (splits.includes(key)) {
      setPhase('done');
      void say(['math.same-split'], true);
      save({ phase: 'done' });
      return;
    }
    const nextSplits = [...splits, key];
    otherSplit.current = true;
    setSplits(nextSplits);
    setPhase('done');
    session.sfx('correct');
    const more = nextSplits.length < total;
    void say(
      [
        'praise.other-split',
        400,
        ...splitVoice(n, cntA, cntB),
        ...(more ? [] : [600, 'math.all-splits']),
      ],
      false,
    );
    setBubble(textOf(more ? 'praise.other-split' : 'math.all-splits'));
    save({ splits: nextSplits, phase: 'done' });
  };

  const again = () => {
    const zeros = Array.from({ length: n }, () => 0);
    setPlace(zeros);
    setPhase('retry');
    setBubble(null);
    session.sfx('remove');
    save({ place: zeros, phase: 'retry' });
  };

  const buildResult = (): QResult => ({
    texts: splits.map((s) => {
      const [x, y] = s.split('-').map(Number) as [number, number];
      return splitFormula(n, x, y);
    }),
    item: p.item,
    ok: !skipped.current,
    counted: false,
    reviewed: false,
    otherSplit: otherSplit.current,
  });

  const leave = () => {
    if (leaving.current) return;
    leaving.current = true;
    onNext(buildResult());
  };

  // 「つぎへ」（ヒント2の後）: 分け方の例を見せて、次へ進めるようにする
  const skip = () => {
    if (phase !== 'play' || recorded) return;
    const s = q.skip();
    skipped.current = true;
    const example = place.map((_, i) => (i === n - 1 ? 2 : 1));
    const key = `${n - 1}-1`;
    setPlace(example);
    setRecorded(true);
    setSplits([key]);
    setPhase('done');
    setBubble(null);
    session.record({
      itemKey: itemKeyOf(p, [n - 1, 1]),
      outcome: s.outcome!,
      wrongTries: s.wrongTries,
      hintsUsed: s.hintsUsed,
      reviewsUsed: s.reviewsUsed,
      operationIssue: s.operationIssue,
      detail: { stage: 'D1', item: p.item },
    });
    void say(splitVoice(n, n - 1, 1), false);
    save({ q: q.current, place: example, recorded: true, splits: [key], phase: 'done' });
  };

  const showFormula = phase === 'done' && cntA >= 1 && cntB >= 1;
  const canAgain = splits.length < total;
  const hintPlates = hint === 2 && phase === 'play';

  return (
    <div className="math-board" data-testid="math-board" data-stage="D1">
      <div
        className="math-tray"
        style={{
          left: u(lay.home[0]!.x - 2),
          top: u(lay.trayY),
          width: u(lay.home[n - 1]!.x + lay.size - lay.home[0]!.x + 4),
        }}
      />
      {(
        [
          ['a', lay.plateA, cntA],
          ['b', lay.plateB, cntB],
        ] as const
      ).map(([id, pl, count]) => (
        <div key={id}>
          <div
            className={`math-plate ${hintPlates ? 'is-hint' : ''}`}
            style={{ left: u(pl.x), top: u(pl.y), width: u(pl.w), height: u(pl.h) }}
            data-testid={`plate-${id}`}
            data-count={count}
          />
          <span
            className="math-count"
            style={{ left: u(pl.x), top: u(pl.y + pl.h + 0.4), width: u(pl.w) }}
          >
            {count > 0 ? count : ''}
          </span>
        </div>
      ))}

      {place.map((where, i) => {
        const pos = splitPicPos(lay, place, i);
        return (
          <button
            key={i}
            type="button"
            className="math-pic"
            style={{
              left: u(pos.x),
              top: u(pos.y),
              width: u(lay.size),
              height: u(lay.size),
            }}
            aria-label={`${label} ${where === 0 ? 'もとの ばしょ' : where === 1 ? 'ひだりの おさら' : 'みぎの おさら'}`}
            disabled={phase === 'done'}
            onClick={() => tapItem(i)}
            data-testid={`split-item-${i}`}
            data-place={where}
          >
            <Illust id={p.item} className="math-pic__img" decorative />
          </button>
        );
      })}

      {showFormula ? (
        <p className="math-split-formula" data-testid="split-formula">
          {splitFormula(n, cntA, cntB)}
        </p>
      ) : null}

      <Bubble text={bubble} style={{ left: u(9), top: u(37), maxWidth: u(50) }} />

      <div className="math-left">
        {q.state.canSkip && phase === 'play' ? (
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
          disabled={phase !== 'play'}
          testId="hint-button"
        />
      </div>

      <div className="math-split-actions">
        {phase === 'done' ? (
          <>
            {canAgain ? (
              <Tap
                label="ほかの わけかたを やってみる"
                text={<span className="math-tool-text">もういちど</span>}
                icon="again"
                size="aux"
                variant="white"
                onPress={again}
                testId="split-again"
              />
            ) : null}
            <Tap
              label="つぎへ"
              text="つぎへ"
              icon="next"
              variant="main"
              onPress={leave}
              testId="split-next"
            />
          </>
        ) : (
          <>
            {phase === 'retry' ? (
              <Tap
                label="つぎへ"
                text={<span className="math-tool-text">つぎへ</span>}
                icon="next"
                size="aux"
                variant="white"
                onPress={leave}
                testId="split-next"
              />
            ) : null}
            <Tap
              label="できた"
              text="できた"
              icon="done"
              variant="main"
              onPress={done}
              testId="done-button"
            />
          </>
        )}
      </div>
    </div>
  );
}
