/**
 * ひらがな（よむ）。H1〜H3 は1タップで即判定、H4・H5 は字のタイルを左のマスから順に置く。
 * 仕様: docs/learning-design.md 2章。問題の生成と判定は logic.ts、教材の表は kana-table.ts。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ModePlayProps } from '../../core/session/types';
import { useQuestion } from '../../core/session/useQuestion';
import type { QuestionState } from '../../core/session/questionFlow';
import { useAudioState } from '../../core/audio/index';
import { vocab } from '../../content/vocab';
import { Illust } from '../../illust/Illust';
import { Bubble } from '../../ui/Bubble';
import { Choice } from '../../ui/Choice';
import { StateMark, Tap } from '../../ui/Tap';
import { textOf } from '../../app/voiceText';
import {
  charKey,
  displayOf,
  generateRound,
  hintSeq,
  hintText,
  introOf,
  judgeChoice,
  judgePlace,
  promptOf,
  recapSeq,
  thatIsSeq,
  thatIsText,
  wordChars,
  type BuildQuestion,
  type ChoiceQuestion,
  type KanaQuestion,
} from './logic';
import { kanaOf } from './kana-table';
import './hiragana.css';

interface Result {
  ok: boolean;
  /** 誤答の後に選び直して正解した（声かけ praise.self-fixed の条件） */
  fixed: boolean;
}

interface Draft {
  index: number;
  q: QuestionState;
  filled: string[];
  used: number[];
  results: Result[];
}

const NO_SOUND = 'おとが でません。おとなの ひとが よんで あげてください';
/** 音声だけが手がかりの問題で、最初の読み上げを待つ最長（ミリ秒） */
const LISTEN_MAX_MS = 3000;

export default function Hiragana({ session }: ModePlayProps) {
  const questions = useMemo(
    () => generateRound(session.level, session.seed, session.roundSize),
    [session.level, session.seed, session.roundSize],
  );
  const resume = session.resume as Draft | null;
  const audioState = useAudioState();
  const silent = audioState.health === 'silent';

  const [index, setIndex] = useState(resume?.index ?? 0);
  const [filled, setFilled] = useState<string[]>(resume?.filled ?? []);
  const [used, setUsed] = useState<number[]>(resume?.used ?? []);
  const [pending, setPending] = useState<{ tile: number; char: string } | null>(null);
  const [wrongIdx, setWrongIdx] = useState<number | null>(null);
  const [correctIdx, setCorrectIdx] = useState<number | null>(null);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2>(0);
  const [bubble, setBubble] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [solved, setSolved] = useState(false);
  const [listenDone, setListenDone] = useState(-1);
  const results = useRef<Result[]>(resume?.results ?? []);
  const filledRef = useRef<string[]>(resume?.filled ?? []);
  const usedRef = useRef<number[]>(resume?.used ?? []);
  const timers = useRef<number[]>([]);
  const restored = useRef(false);
  const q = useQuestion();
  const question = questions[index]!;
  const isPick = question.kind === 'pick';
  const listening = isPick && !silent && listenDone !== index;

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((id) => window.clearTimeout(id));
  }, []);

  // 問題の開始
  useEffect(() => {
    let alive = true;
    if (resume && !restored.current) {
      restored.current = true;
      q.restore(resume.q);
    }
    session.expose({
      index,
      level: session.level,
      kind: question.kind,
      ...(question.kind === 'build'
        ? { word: question.word, chars: question.chars, tiles: question.tiles }
        : {
            answer: question.answer,
            choices: question.choices,
            answerIndex: question.answerIndex,
            word: question.word,
          }),
    });
    const main = promptOf(question);
    const first = index === 0 && !resume;
    const done = session.prompt(
      first ? [introOf(question.kind), 400, ...main] : main,
      displayOf(question),
    );
    if (question.kind === 'pick') {
      // 音声だけが手がかり: 読み上げが終わるまで（最大3秒）選択肢を無効にする
      const timeout = new Promise<void>((r) => window.setTimeout(r, LISTEN_MAX_MS));
      void Promise.race([done, timeout]).then(() => {
        if (alive) setListenDone(index);
      });
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const saveDraft = (over: Partial<Draft> = {}) =>
    session.saveDraft({
      index,
      q: q.current,
      filled: filledRef.current,
      used: usedRef.current,
      results: results.current,
      ...over,
    } satisfies Draft);

  // ---- ヒント ----
  const showHint = (level: 1 | 2) => {
    const seq = hintSeq(question, level, filledRef.current.length);
    setHintLevel(level);
    setBubble(hintText(question, level, filledRef.current.length));
    void session.say(seq);
  };

  const clearHint = () => {
    setHintLevel(0);
    setBubble(null);
  };

  // ---- 次の問題へ ----
  const advance = (res: Result) => {
    results.current = [...results.current, res];
    later(() => {
      if (index + 1 >= questions.length) {
        const tried = questions.slice(0, results.current.length);
        session.finish({
          before: recapSeq(tried),
          praise: results.current.some((r) => r.fixed) ? 'praise.self-fixed' : undefined,
          showcase: <Showcase items={tried} />,
        });
        return;
      }
      filledRef.current = [];
      usedRef.current = [];
      setIndex(index + 1);
      setFilled([]);
      setUsed([]);
      setPending(null);
      setWrongIdx(null);
      setCorrectIdx(null);
      clearHint();
      setSolved(false);
      setBusy(false);
      q.reset();
      session.saveDraft({
        index: index + 1,
        q: q.current,
        filled: [],
        used: [],
        results: results.current,
      } satisfies Draft);
    }, 1700);
  };

  const record = (s: QuestionState) =>
    session.record({
      itemKey: question.itemKey,
      outcome: s.outcome!,
      wrongTries: s.wrongTries,
      hintsUsed: s.hintsUsed,
      operationIssue: s.operationIssue,
      detail: { kind: question.kind, level: session.level },
    });

  // ---- H1〜H3: 選ぶ ----
  const pickChoice = (i: number) => {
    if (question.kind === 'build' || busy || solved || listening) return;
    if (!q.tap()) return;
    if (judgeChoice(question, i)) {
      const s = q.correct();
      setSolved(true);
      setBusy(true);
      setCorrectIdx(i);
      clearHint();
      session.sfx('correct');
      void session.say(['app.ok', 300, charKey(question.answer)]);
      record(s);
      advance({ ok: true, fixed: s.wrongTries > 0 && s.outcome === 'self_corrected' });
    } else {
      const s = q.wrong();
      const c = question.choices[i]!;
      setWrongIdx(i);
      session.sfx('wrong');
      const level = s.hintLevel === 2 ? 2 : 1;
      setHintLevel(level);
      const hs = hintSeq(question, level);
      setBubble(`${thatIsText(c)}。${hintText(question, level, 0)}`);
      void session.say([...(thatIsSeq(c) as string[]), 400, ...(hs as (string | number)[])]);
      later(() => setWrongIdx(null), 1100);
      saveDraft();
    }
  };

  // ---- H4・H5: タイルを置く ----
  const pickTile = (ti: number) => {
    if (question.kind !== 'build' || busy || solved || usedRef.current.includes(ti)) return;
    if (!q.tap()) return;
    const ch = question.tiles[ti]!;
    const pos = filledRef.current.length;
    if (judgePlace(question, pos, ch)) {
      filledRef.current = [...filledRef.current, ch];
      usedRef.current = [...usedRef.current, ti];
      setFilled(filledRef.current);
      setUsed(usedRef.current);
      clearHint();
      session.sfx('place');
      if (filledRef.current.length === question.chars.length) {
        const s = q.correct();
        setSolved(true);
        setBusy(true);
        void session.say([charKey(ch), 300, `item.${question.word}`, 300, 'app.ok']);
        record(s);
        saveDraft();
        advance({ ok: true, fixed: s.wrongTries > 0 && s.outcome === 'self_corrected' });
      } else {
        void session.say(charKey(ch));
        saveDraft();
      }
    } else {
      // 違う字: マスに置いてから、タイルが戻る。マスの音を言う
      const s = q.wrong();
      setPending({ tile: ti, char: ch });
      setBusy(true);
      session.sfx('wrong');
      const level = s.hintLevel === 2 ? 2 : 1;
      setHintLevel(level);
      const hs = hintSeq(question, level, pos);
      setBubble(hintText(question, level, pos));
      void session.say([charKey(ch), 500, ...(hs as (string | number)[])]);
      later(() => {
        setPending(null);
        setBusy(false);
      }, 1100);
      saveDraft();
    }
  };

  const askHint = () => {
    if (busy || solved || listening) return;
    const s = q.hint();
    showHint(s.hintLevel === 2 ? 2 : 1);
    saveDraft();
  };

  const skip = () => {
    if (busy || solved) return;
    const s = q.skip();
    setBusy(true);
    setSolved(true);
    setPending(null);
    clearHint();
    if (question.kind === 'build') {
      filledRef.current = [...question.chars];
      setFilled(filledRef.current);
      void session.say(['app.show-answer', 300, `item.${question.word}`]);
    } else {
      setCorrectIdx(question.answerIndex);
      void session.say(['app.show-answer', 300, charKey(question.answer)]);
    }
    record(s);
    advance({ ok: false, fixed: false });
  };

  const showSkip = q.state.canSkip && !solved;

  return (
    <div className={`hira hira--${question.kind}`} data-testid="hiragana-board">
      {silent && question.kind !== 'build' ? (
        <p className="hira-bigtext" data-testid="silent-prompt">
          {textOf(displayOf(question))}
        </p>
      ) : null}

      {question.kind === 'build' ? (
        <BuildBoard
          question={question}
          filled={filled}
          used={used}
          pending={pending}
          hintLevel={hintLevel}
          busy={busy}
          onTile={pickTile}
        />
      ) : (
        <ChoiceBoard
          question={question}
          wrongIdx={wrongIdx}
          correctIdx={correctIdx}
          hintLevel={hintLevel}
          listening={listening}
          busy={busy}
          onPick={pickChoice}
        />
      )}

      <div className={`hira-bubble-slot hira-bubble-slot--${question.kind}`}>
        <Bubble text={bubble} style={{ position: 'relative' }} />
      </div>

      {silent ? <p className="hira-parent-note">{NO_SOUND}</p> : null}

      <div className="hira-bottom">
        <Tap
          label="ヒント"
          icon="hint"
          size="aux"
          variant="white"
          onPress={askHint}
          disabled={busy || solved || listening}
          testId="hint-button"
        />
        {showSkip ? (
          <Tap label="つぎへ" icon="next" size="aux" onPress={skip} testId="skip-button" />
        ) : (
          <span style={{ width: 'var(--tap-aux)' }} />
        )}
      </div>
    </div>
  );
}

function ChoiceBoard({
  question,
  wrongIdx,
  correctIdx,
  hintLevel,
  listening,
  busy,
  onPick,
}: {
  question: ChoiceQuestion;
  wrongIdx: number | null;
  correctIdx: number | null;
  hintLevel: number;
  listening: boolean;
  busy: boolean;
  onPick: (i: number) => void;
}) {
  const first = question.kind === 'first';
  const word = wordChars(question.word);
  return (
    <>
      {first ? (
        <div className="hira-picture" data-testid="word-picture">
          <Illust id={question.word} className="hira-picture__illust" decorative />
        </div>
      ) : null}
      <div
        className={`hira-choices hira-choices--${question.choices.length} ${listening ? 'is-waiting' : ''}`}
        role="group"
        aria-label="えらぶ"
      >
        {question.choices.map((c, i) => (
          <Choice
            key={`${c}-${i}`}
            label={c}
            letter={c}
            className="hira-card"
            state={correctIdx === i ? 'correct' : wrongIdx === i ? 'wrong' : null}
            disabled={listening || (busy && correctIdx !== i)}
            onPress={() => onPick(i)}
            testId={`choice-${i}`}
          />
        ))}
      </div>
      {hintLevel === 2 && !first ? (
        <div className="hira-clue" data-testid="hint-picture">
          <Illust id={question.word} className="hira-clue__illust" decorative />
          <span className="hira-clue__label">{vocab(question.word).label}</span>
        </div>
      ) : null}
      {hintLevel === 2 && first ? (
        <div className="hira-split" data-testid="hint-split" aria-hidden>
          {word.map((c, i) => (
            <span key={i} className={`hira-split__char ${i === 0 ? 'is-hint' : ''}`}>
              {c}
            </span>
          ))}
        </div>
      ) : null}
    </>
  );
}

function BuildBoard({
  question,
  filled,
  used,
  pending,
  hintLevel,
  busy,
  onTile,
}: {
  question: BuildQuestion;
  filled: string[];
  used: number[];
  pending: { tile: number; char: string } | null;
  hintLevel: number;
  busy: boolean;
  onTile: (i: number) => void;
}) {
  const next = filled.length;
  const nextChar = question.chars[next];
  const exWord = nextChar ? kanaOf(nextChar).word : undefined;
  return (
    <>
      <div className="hira-picture hira-picture--build" data-testid="word-picture">
        <Illust id={question.word} className="hira-picture__illust" decorative />
      </div>
      <div className="hira-cells" aria-label="ことば">
        {question.chars.map((_, i) => {
          const ch = filled[i] ?? (i === next && pending ? pending.char : '');
          const isWrong = i === next && pending !== null;
          const isHint = hintLevel === 2 && i === next && !pending;
          return (
            <div
              key={i}
              className={`hira-cell ${ch && !isWrong ? 'is-filled' : ''} ${isHint ? 'is-hint' : ''}`}
              data-testid={`cell-${i}`}
              data-state={isWrong ? 'wrong' : ch ? 'placed' : 'empty'}
            >
              <span className="hira-cell__letter">{ch}</span>
              {isWrong ? <StateMark state="wrong" /> : null}
            </div>
          );
        })}
      </div>
      {hintLevel === 2 && exWord && !pending ? (
        <div className="hira-clue hira-clue--build" data-testid="hint-picture">
          <Illust id={exWord} className="hira-clue__illust" decorative />
          <span className="hira-clue__label">{vocab(exWord).label}</span>
        </div>
      ) : null}
      <div
        className={`hira-tiles hira-tiles--${question.tiles.length}`}
        role="group"
        aria-label="もじ"
      >
        {question.tiles.map((c, i) =>
          used.includes(i) ? (
            <span key={i} className="hira-tile-slot" aria-hidden />
          ) : (
            <Choice
              key={i}
              label={c}
              letter={c}
              className="hira-card"
              state={pending?.tile === i ? 'wrong' : null}
              disabled={busy && pending?.tile !== i}
              onPress={() => onTile(i)}
              testId={`tile-${i}`}
            />
          ),
        )}
      </div>
    </>
  );
}

function Showcase({ items }: { items: readonly KanaQuestion[] }) {
  return (
    <div className="hira-showcase" data-testid="hiragana-showcase">
      {items.map((it, i) => (
        <div key={i} className="hira-showcase__item">
          <Illust id={it.word} className="hira-showcase__pic" decorative />
          <span className={`hira-showcase__letter ${it.kind === 'build' ? 'is-word' : ''}`}>
            {it.kind === 'build' ? vocab(it.word).label : it.answer}
          </span>
        </div>
      ))}
    </div>
  );
}
