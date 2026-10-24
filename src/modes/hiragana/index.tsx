/**
 * ひらがな（よむ）。H1〜H3 は1タップで即判定、H4・H5 は字のタイルを左のマスから順に置く。
 * 仕様: docs/learning-design.md 2章。問題の生成と判定は logic.ts、教材の表は kana-table.ts、
 * 盤面の部品は boards.tsx。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ModePlayProps } from '../../core/session/types';
import { useQuestion } from '../../core/session/useQuestion';
import { initialQuestion, type QuestionState } from '../../core/session/questionFlow';
import { useAudioState } from '../../core/audio/index';
import { Illust } from '../../illust/Illust';
import { Bubble } from '../../ui/Bubble';
import { Tap } from '../../ui/Tap';
import { textOf } from '../../app/voiceText';
import { BuildBoard, ChoiceBoard, Showcase } from './boards';
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
} from './logic';
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
  const silent = useAudioState().health === 'silent';

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
  const listening = question.kind === 'pick' && !silent && listenDone !== index;

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
      displayOf(question, silent),
    );
    if (question.kind === 'pick') {
      // 音声だけが手がかり: 読み上げが終わるまで（最大3秒）選択肢を押せなくする
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

  // 音が出ないと分かったら、上部の文を字入りに切り替える（音は出ないので再生しても支障なし）
  const silentSeen = useRef(false);
  useEffect(() => {
    if (silent && !silentSeen.current) {
      silentSeen.current = true;
      void session.prompt(promptOf(question), displayOf(question, true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [silent]);

  const saveDraft = () =>
    session.saveDraft({
      index,
      q: q.current,
      filled: filledRef.current,
      used: usedRef.current,
      results: results.current,
    } satisfies Draft);

  const clearHint = () => {
    setHintLevel(0);
    setBubble(null);
  };

  /** 1問の確定: 記録と、次の問題の下書き（最後なら破棄）を同時に行う（L5） */
  const commit = (s: QuestionState, res: Result) => {
    results.current = [...results.current, res];
    session.record({
      itemKey: question.itemKey,
      outcome: s.outcome!,
      wrongTries: s.wrongTries,
      hintsUsed: s.hintsUsed,
      operationIssue: s.operationIssue,
      detail: { kind: question.kind, level: session.level },
    });
    if (index + 1 >= questions.length) {
      session.clearDraft();
    } else {
      session.saveDraft({
        index: index + 1,
        q: initialQuestion(),
        filled: [],
        used: [],
        results: results.current,
      } satisfies Draft);
    }
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
    }, 1700);
  };

  const fixedOf = (s: QuestionState) => s.wrongTries > 0 && s.outcome === 'self_corrected';

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
      commit(s, { ok: true, fixed: fixedOf(s) });
    } else {
      const s = q.wrong();
      const c = question.choices[i]!;
      setWrongIdx(i);
      session.sfx('wrong');
      const level = s.hintLevel === 2 ? 2 : 1;
      setHintLevel(level);
      setBubble(`${thatIsText(c)}。${hintText(question, level, 0)}`);
      void session.say([...thatIsSeq(c), 400, ...hintSeq(question, level)]);
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
        commit(s, { ok: true, fixed: fixedOf(s) });
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
      setBubble(hintText(question, level, pos));
      void session.say([charKey(ch), 500, ...hintSeq(question, level, pos)]);
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
    const level = s.hintLevel === 2 ? 2 : 1;
    const pos = filledRef.current.length;
    setHintLevel(level);
    setBubble(hintText(question, level, pos));
    void session.say(hintSeq(question, level, pos));
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
    commit(s, { ok: false, fixed: false });
  };

  return (
    <div className={`hira hira--${question.kind}`} data-testid="hiragana-board">
      {silent && question.kind !== 'build' ? (
        <p className="hira-bigtext" data-testid="silent-prompt">
          {textOf(displayOf(question, true))}
        </p>
      ) : null}
      {listening ? (
        <p className="hira-listening" data-testid="listening">
          <Illust id="listen" className="hira-listening__icon" decorative />
          きいてね
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

      <div className="bottom-left">
        <Tap
          label="ヒント"
          icon="hint"
          size="aux"
          variant="white"
          onPress={askHint}
          disabled={busy || solved || listening}
          testId="hint-button"
        />
      </div>
      <div className="bottom-right">
        {q.state.canSkip && !solved ? (
          <Tap label="つぎへ" icon="next" size="aux" onPress={skip} testId="skip-button" />
        ) : null}
      </div>
    </div>
  );
}
