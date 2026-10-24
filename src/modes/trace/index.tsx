/**
 * なぞって あそぼう（M8）。1題 = 線・形・字・迷路の1つ。判定は judge.ts（順序つき追跡）。
 * 子供のインクは外れても常に描く（M8-04）。使われなかった線は薄く残る。
 * 誤答（wrongTries）= 追跡に使えなかった線 3 本で 1 回。ヒント1 = 始点（止まった所）を囲む、
 * ヒント2 = お手本の動きをもう一度＋「つぎへ」。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { textOf } from '../../app/voiceText';
import type { ModePlayProps } from '../../core/session/types';
import { initialQuestion } from '../../core/session/questionFlow';
import { useQuestion } from '../../core/session/useQuestion';
import { Bubble } from '../../ui/Bubble';
import { Tap } from '../../ui/Tap';
import type { TraceItem } from './content';
import { judge, maxShortRun, prepareGuide, type Pt, type TraceJudgement } from './judge';
import {
  isWrongStep,
  parseDraft,
  pickRound,
  praiseOf,
  simplifyLine,
  toleranceFor,
  type DoneItem,
  type PointerKind,
  type SavedLine,
  type TraceDraft,
  type TraceWorkData,
} from './logic';
import { TraceThumb } from './thumb';
import { TraceCanvas } from './TraceCanvas';
import './trace.css';

type Phase = 'play' | 'solved' | 'skipped';

const NEXT_MS = 1600;
const SKIP_MS = 2600;

const promptOf = (item: TraceItem): string =>
  item.kind === 'letter'
    ? `trace.letter.${item.voiceId}`
    : item.kind === 'maze'
      ? 'trace.prompt.maze'
      : 'trace.prompt.line';

/** 次に書く場所: 今の画の進み位置のお手本の点（始点か、止まった所） */
function targetOf(item: TraceItem, j: TraceJudgement): { stroke: number; at: Pt } {
  const stroke = Math.min(j.current, item.strokes.length - 1);
  const g = prepareGuide(item.strokes)[stroke]!;
  return { stroke, at: g.pts[j.strokes[stroke]!.k]! };
}

/** すべての画が「始点（みどりの まる）から書き始めた線」で進んだか（声かけ みどりの まるから かけたね） */
function fromStartOf(j: TraceJudgement): boolean {
  return j.strokes.every((_, s) => j.lines.find((l) => l.used && l.stroke === s)?.startedAtStart);
}

export default function Trace({ session }: ModePlayProps) {
  const items = useMemo(
    () => pickRound(session.level, session.seed, session.roundSize),
    [session.level, session.seed, session.roundSize],
  );
  // 中断データ（形が合わない・古い場合は新しく始める）
  const resume = useMemo(
    () => parseDraft(session.resume, items.length),
    [session.resume, items.length],
  );
  const [index, setIndex] = useState(resume?.index ?? 0);
  const [lines, setLines] = useState<SavedLine[]>(resume?.lines ?? []);
  const [kind, setKind] = useState<PointerKind>(
    resume?.kind ??
      (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
        ? 'touch'
        : 'mouse'),
  );
  const [phase, setPhase] = useState<Phase>('play');
  const [hint, setHint] = useState<{ stroke: number; at: Pt } | null>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  const [demoToken, setDemoToken] = useState(resume && resume.lines.length > 0 ? 0 : 1);

  const q = useQuestion();
  const item = items[index]!;
  const r = toleranceFor(item, kind, session.settings);
  const judgement = useMemo(
    () =>
      judge(
        lines.map((l) => l.p),
        item.strokes,
        r,
      ),
    [lines, item, r],
  );

  // 非同期の処理から最新の値を読むための ref
  const linesRef = useRef(lines);
  const phaseRef = useRef<Phase>('play');
  const unused = useRef(resume?.unused ?? 0);
  const opIssue = useRef(resume?.opIssue ?? false);
  const soft = useRef(false);
  const done = useRef<DoneItem[]>(resume?.done ?? []);
  const timer = useRef<number | undefined>(undefined);
  const restored = useRef(false);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // 題の開始: 中断データの復元、問題の公開、問題文
  useEffect(() => {
    if (resume && !restored.current) {
      restored.current = true;
      q.restore(resume.q);
    }
    session.expose({
      index,
      total: items.length,
      id: item.id,
      kind: item.kind,
      level: session.level,
      r,
      strokes: item.strokes,
    });
    void session.prompt(promptOf(item));
    // 題が変わるときだけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const saveDraft = (next: SavedLine[], at = index) =>
    session.saveDraft({
      index: at,
      lines: next,
      q: q.current,
      unused: unused.current,
      opIssue: opIssue.current,
      done: done.current,
      kind,
    } satisfies TraceDraft);

  /** 題を終えた直後の保存: 次の題の始まりの状態を残す（完成した題の線を残さない）。最後の題なら中断データを消す */
  const persistNext = () => {
    if (index + 1 >= items.length) {
      session.clearDraft();
      return;
    }
    session.saveDraft({
      index: index + 1,
      lines: [],
      q: initialQuestion(),
      unused: 0,
      opIssue: false,
      done: done.current,
      kind,
    } satisfies TraceDraft);
  };

  const commit = (next: SavedLine[]) => {
    linesRef.current = next;
    setLines(next);
  };

  const showHint = (level: 1 | 2, j: TraceJudgement) => {
    const t = targetOf(item, j);
    const k = j.strokes[t.stroke]!.k;
    const key =
      level === 2
        ? 'trace.hint.watch'
        : k > 0
          ? 'trace.hint.resume'
          : t.stroke > 0
            ? 'trace.hint.next'
            : 'trace.hint.start';
    setHint(t);
    setBubble(textOf(key));
    void session.say(key);
    if (level === 2) setDemoToken((n) => n + 1);
  };

  const advance = (ms: number) => {
    const last = index + 1 >= items.length;
    timer.current = window.setTimeout(() => {
      if (last) {
        session.finish({
          showcase: <Showcase done={done.current} />,
          praise: praiseOf(done.current),
        });
        return;
      }
      const at = index + 1;
      linesRef.current = [];
      phaseRef.current = 'play';
      unused.current = 0;
      opIssue.current = false;
      soft.current = false;
      q.reset();
      setLines([]);
      setHint(null);
      setBubble(null);
      setPhase('play');
      setIndex(at);
      setDemoToken((n) => n + 1);
    }, ms);
  };

  const solve = (j: TraceJudgement, all: SavedLine[]) => {
    phaseRef.current = 'solved';
    setPhase('solved');
    setHint(null);
    const s = q.correct();
    const last = index + 1 >= items.length;
    session.sfx('correct');
    setBubble(textOf('praise.traced'));
    if (!last) void session.say('praise.traced'); // 最後の題は完了画面が声かけを言う
    session.record({
      itemKey: item.title,
      outcome: s.outcome!,
      wrongTries: s.wrongTries,
      hintsUsed: s.hintsUsed,
      reviewsUsed: s.reviewsUsed,
      operationIssue: s.operationIssue || opIssue.current,
      inputKind: kind,
      detail: { guideId: item.id, lines: all.length, unusedLines: unused.current },
    });
    const strokes = all.map((l) => l.p).filter((p) => p.length >= 2);
    const data: TraceWorkData = { guideId: item.id, strokes };
    void session.saveWork({ kind: 'trace', title: item.title, data });
    done.current = [
      ...done.current,
      { guideId: item.id, strokes, skipped: false, fromStart: fromStartOf(j) },
    ];
    persistNext();
    advance(NEXT_MS);
  };

  const onLine = (pts: Pt[], k: PointerKind) => {
    if (phaseRef.current !== 'play') return;
    const saved: SavedLine = { p: simplifyLine(pts, 2), k };
    const next = [...linesRef.current, saved];
    const rNow = toleranceFor(item, k, session.settings);
    const j = judge(
      next.map((l) => l.p),
      item.strokes,
      rNow,
    );
    const li = j.lines[j.lines.length - 1]!;
    commit(next);

    if (li.reason === 'short') {
      // 極端に短い線が5本以上続く = 入力の途切れ（学力の記録とは分ける）
      if (maxShortRun(j) >= 5) opIssue.current = true;
    } else if (li.reason === 'far-start' || li.reason === 'off-track') {
      unused.current += 1;
      if (isWrongStep(unused.current)) {
        const s = q.wrong();
        session.sfx('wrong');
        showHint(s.hintLevel === 2 ? 2 : 1, j);
      } else if (li.reason === 'far-start' && !soft.current) {
        // 逆向き・遠くから始めた線。誤答には数えず、やさしく声をかける（1題に1回）
        soft.current = true;
        setBubble(textOf('trace.from-green'));
        void session.say('trace.from-green');
      }
    } else if (li.used) {
      setHint(null);
      setBubble(null);
    }

    if (j.complete) {
      solve(j, next);
      return;
    }
    if (li.completedStroke) session.sfx('place');
    saveDraft(next);
  };

  const undo = () => {
    if (phaseRef.current !== 'play' || linesRef.current.length === 0) return;
    const next = linesRef.current.slice(0, -1);
    commit(next);
    setHint(null);
    setBubble(null);
    session.sfx('remove');
    saveDraft(next);
  };

  const look = () => {
    if (phaseRef.current !== 'play') return;
    q.review();
    setDemoToken((n) => n + 1);
    saveDraft(linesRef.current);
  };

  const askHint = () => {
    if (phaseRef.current !== 'play') return;
    const s = q.hint();
    showHint(s.hintLevel === 2 ? 2 : 1, judgement);
    saveDraft(linesRef.current);
  };

  const skip = () => {
    if (phaseRef.current !== 'play') return;
    const s = q.skip();
    phaseRef.current = 'skipped';
    setPhase('skipped');
    setHint(null);
    setBubble(null);
    void session.say('app.show-answer');
    setDemoToken((n) => n + 1);
    session.record({
      itemKey: item.title,
      outcome: s.outcome!,
      wrongTries: s.wrongTries,
      hintsUsed: s.hintsUsed,
      reviewsUsed: s.reviewsUsed,
      operationIssue: s.operationIssue || opIssue.current,
      inputKind: kind,
      detail: { guideId: item.id, lines: linesRef.current.length, unusedLines: unused.current },
    });
    done.current = [
      ...done.current,
      { guideId: item.id, strokes: [], skipped: true, fromStart: false },
    ];
    persistNext();
    advance(SKIP_MS);
  };

  const cur = judgement.strokes[Math.min(judgement.current, judgement.strokes.length - 1)]!;
  return (
    <div
      className="trace"
      data-testid="trace-board"
      data-index={index}
      data-phase={phase}
      data-stroke={judgement.current}
      data-progress={cur.progress.toFixed(2)}
      data-lines={lines.length}
      data-unused={unused.current}
      data-wrong={q.state.wrongTries}
      data-hint-level={q.state.hintLevel}
      data-r={r}
    >
      <Bubble
        text={bubble}
        style={{
          left: 'calc(var(--u) * 2)',
          top: 'calc(var(--u) * 3)',
          maxWidth: 'calc(var(--u) * 25)',
          wordBreak: 'keep-all',
        }}
      />
      <div className="trace-board">
        <TraceCanvas
          item={item}
          r={r}
          judgement={judgement}
          lines={lines}
          hintAt={hint?.at ?? null}
          demoToken={demoToken}
          reduceMotion={session.reduceMotion}
          locked={phase !== 'play'}
          reveal={phase === 'skipped'}
          onLine={onLine}
          onKind={setKind}
        />
        {phase === 'solved' ? (
          <span className="mark mark--correct" aria-hidden data-testid="trace-ring" />
        ) : null}
      </div>

      <Tap
        label="もういちど みる"
        text={<span className="trace-aux__text">みる</span>}
        icon="look"
        size="aux"
        variant="white"
        className="trace-aux trace-aux--left trace-aux--upper"
        disabled={phase !== 'play'}
        onPress={look}
        testId="look-button"
      />
      <Tap
        label="ヒント"
        text={<span className="trace-aux__text">ヒント</span>}
        icon="hint"
        size="aux"
        variant="white"
        className="trace-aux trace-aux--left"
        disabled={phase !== 'play'}
        onPress={askHint}
        testId="hint-button"
      />
      {q.state.canSkip && phase === 'play' ? (
        <Tap
          label="つぎへ"
          text={<span className="trace-aux__text">つぎへ</span>}
          icon="next"
          size="aux"
          className="trace-aux trace-aux--right trace-aux--upper"
          onPress={skip}
          testId="skip-button"
        />
      ) : null}
      <Tap
        label="ひとつ もどす"
        text={<span className="trace-aux__text">ひとつ もどす</span>}
        icon="undo"
        size="aux"
        variant="sky"
        className="trace-aux trace-aux--right"
        disabled={phase !== 'play' || lines.length === 0}
        onPress={undo}
        testId="undo-button"
      />
    </div>
  );
}

/** 完了画面: なぞった作品を並べる（「つぎへ」で進んだ題はお手本だけ） */
function Showcase({ done }: { done: DoneItem[] }) {
  return (
    <div className="trace-showcase">
      {done.map((d, i) => (
        <div key={`${d.guideId}-${i}`} className="trace-showcase__item">
          <TraceThumb data={{ guideId: d.guideId, strokes: d.strokes }} />
        </div>
      ))}
    </div>
  );
}
