/**
 * trace エンジン: 書く。
 * (a) なぞり（mode 'trace'）: KanjiVG の書き順で、画の順序・始点・向きを追跡する（v1 のなぞりの判定
 *     src/modes/trace/judge.ts をそのまま使う。盤も v1 の TraceCanvas）。字形の正誤は判定しない。
 * (b) 自由に書く＋お手本と見比べる（mode 'free'）: 枠に指で書く → お手本を重ねる → 子が「にてる／もういちど」を選ぶ。
 *     採点しない（自己評価だけを記録。curriculum-matrix 2.2）。書き順データが無い字（英字など）は (b) だけ。
 * (c) 'trace-free': (a) のあとに (b)（運筆の「なぞり・お手本比較」。curriculum-matrix 1.3）。
 *
 * 誤答: 追跡に使えなかった線 3 本で 1 回（v1 と同じ）。そのとき判定に線を渡し、書き順の違い（ほかの画から書いた）・
 * 向きの違い（終わりから書いた）を誤概念に結び付ける。
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Item, ItemBase, RichText } from '../../curriculum/types';
import {
  countUnused,
  judge as traceJudge,
  prepareGuide,
  START_FACTOR,
  TOLERANCE_R,
  type Pt,
  type TraceJudgement,
} from '../../modes/trace/judge';
import type { TraceItem as V1TraceItem } from '../../modes/trace/content';
import { simplifyLine, UNUSED_PER_WRONG } from '../../modes/trace/logic';
import { TraceCanvas } from '../../modes/trace/TraceCanvas';
import { Tap } from '../../ui/Tap';
import { DrawPad, renderPng, type DrawLine, type PadColors } from '../explain/DrawPad';
import type { EngineProps, Judgement } from '../types';
import { kanjiGrade } from '../../text/kanji-grades';
import { isKana, loadGuide, normalizeStrokes, strokeSetOf } from './strokes';
import './trace.css';

export type TraceMode = 'trace' | 'free' | 'trace-free';

export interface TraceItem extends ItemBase {
  engine: 'trace';
  /** 書く字（1字）。ひらがな・カタカナ・小学校の配当漢字は書き順データを自動で引く。英字などは mode 'free' だけ */
  char: string;
  mode: TraceMode;
  /** 書き順データを直接持たせる（KanjiVG と同じ形: 画 → 点 [x,y]、0〜1000）。省くと字から引く */
  strokes?: number[][][];
  /** 判定幅 r（0〜1000 の正方形座標）。省くと字の種類と年齢で決める（traceTolerance） */
  tolerance?: number;
  /** 誤概念ID: order = 書き順の違い（ほかの画から書いた）、direction = 向きの違い（終わりから書いた） */
  misconceptionIds?: { order?: string; direction?: string };
}

/** 判定に渡す、なぞりの線（判定は純粋関数なので、使ったお手本と判定幅も渡す） */
export interface TraceRun {
  lines: Pt[][];
  guide: Pt[][];
  r: number;
}

export type TraceResponse =
  /** 追跡に使えなかった線が 3 本たまった（誤答 1 回） */
  | ({ kind: 'miss' } & TraceRun)
  /** 書き終えた。trace = なぞり（mode に含むとき）、free = 自由書きと自己評価（mode に含むとき） */
  | {
      kind: 'done';
      trace?: TraceRun;
      free?: {
        lines: DrawLine[];
        /** 子が選んだ自己評価（「にてる」を選んで終わる） */
        self: 'similar';
        /** 「もういちど」を選んだ回数 */
        again: number;
        /** 保存用の PNG（dataURL） */
        png?: string;
      };
    };

// ---- 判定幅（docs: 最終報告の「判定幅の根拠」） ----
/**
 * 判定幅 r。v1 の ひろい=90・ふつう=65・せまい=45 と同じ尺度（盤の1辺 = 1000）。
 * - 幼児（かな）: v1 と同じ ひろい 90。
 * - 小学生のかな・1年の漢字: 1年の漢字は画の始点どうしが離れている（中央値 101）ので 90 でも順序違いを完成扱いにしない。
 *   かなは 75（濁点など短い画が近いので、90 以上では逆向きでも完成しやすい）。
 * - 2〜6年の漢字: 75。始点どうしの最小距離の中央値が 25〜29 と近い。75 なら順序違いの線を完成扱いにする割合 0.3% 以下・
 *   逆向きで完成 4.4% 以下で、ずれ 0.6r の正しいなぞりは 99.4% 以上完成（全 1026 字の模擬入力で確かめた）。
 */
export const TRACE_R = { preschool: TOLERANCE_R.wide, kana: 75, kanjiG1: 90, kanji: 75 } as const;

export function traceTolerance(item: Pick<TraceItem, 'char' | 'tolerance'>, preschool: boolean) {
  if (item.tolerance !== undefined) return item.tolerance;
  if (preschool) return TRACE_R.preschool;
  if (isKana(item.char)) return TRACE_R.kana;
  if (kanjiGrade(item.char) === 1) return TRACE_R.kanjiG1;
  return TRACE_R.kanji;
}

const needsTrace = (m: TraceMode) => m !== 'free';
const needsFree = (m: TraceMode) => m !== 'trace';

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** 線の点の、お手本の画への平均の距離 */
function meanDistTo(line: readonly Pt[], stroke: readonly Pt[]): number {
  let sum = 0;
  for (const p of line) {
    let best = Infinity;
    for (const q of stroke) best = Math.min(best, dist(p, q));
    sum += best;
  }
  return line.length ? sum / line.length : Infinity;
}

export type MissKind = 'order' | 'direction' | null;

/** 追跡に使えなかった最後の線が、どんな誤りか（書き順の違い・向きの違い・どちらでもない） */
export function classifyMiss(run: TraceRun): { kind: MissKind; stroke: number } {
  const j = traceJudge(run.lines, run.guide, run.r);
  const g = prepareGuide(run.guide);
  let idx = -1;
  for (let i = j.lines.length - 1; i >= 0; i--) {
    const reason = j.lines[i]!.reason;
    if (reason === 'far-start' || reason === 'off-track') {
      idx = i;
      break;
    }
  }
  if (idx < 0) return { kind: null, stroke: j.current };
  const s = j.lines[idx]!.stroke;
  const line = run.lines[idx]!;
  const p0 = line[0]!;
  const cur = g[s]!;
  const near = START_FACTOR * run.r;
  if (
    cur.total > 2 * run.r &&
    dist(p0, cur.pts[cur.pts.length - 1]!) <= near &&
    meanDistTo(line, cur.pts) <= run.r
  )
    return { kind: 'direction', stroke: s };
  for (let t = 0; t < g.length; t++) {
    if (t === s || j.strokes[t]!.complete) continue;
    if (dist(p0, g[t]!.pts[0]!) <= near && meanDistTo(line, g[t]!.pts) <= run.r)
      return { kind: 'order', stroke: s };
  }
  return { kind: null, stroke: s };
}

export const TRACE_RETRY: RichText = 'さいごまで かいてから おしてね。';

export function judgeTrace(item: TraceItem, res: TraceResponse): Judgement {
  if (res.kind === 'miss') {
    if (traceJudge(res.lines, res.guide, res.r).complete) return { result: 'correct' };
    const m = classifyMiss(res);
    const ids = item.misconceptionIds ?? {};
    return {
      result: 'wrong',
      misconception:
        m.kind === 'order' ? ids.order : m.kind === 'direction' ? ids.direction : undefined,
      mark: { stroke: m.stroke, kind: m.kind },
    };
  }
  if (needsTrace(item.mode)) {
    const t = res.trace;
    if (!t || !traceJudge(t.lines, t.guide, t.r).complete)
      return { result: 'retry', message: TRACE_RETRY };
  }
  if (needsFree(item.mode) && (!res.free || res.free.lines.length === 0))
    return { result: 'retry', message: TRACE_RETRY };
  return { result: 'correct' };
}

export function checkTrace(item: TraceItem): string[] {
  const errs: string[] = [];
  if ([...item.char].length !== 1) errs.push(`字は1字（今「${item.char}」）`);
  if (!['trace', 'free', 'trace-free'].includes(item.mode))
    errs.push(`mode ${String(item.mode)} が無い`);
  const hasData = item.strokes !== undefined || strokeSetOf(item.char) !== null;
  if (needsTrace(item.mode) && !hasData)
    errs.push(`「${item.char}」は書き順データが無いので mode は free だけ`);
  if (item.strokes) {
    if (item.strokes.length === 0) errs.push('strokes が空');
    item.strokes.forEach((s, i) => {
      if (s.length < 2) errs.push(`第${i + 1}画の点が2つ未満`);
      for (const p of s)
        if (p.length !== 2 || p.some((v) => !(v >= 0 && v <= 1000)))
          errs.push(`第${i + 1}画に 0〜1000 の外の点がある`);
    });
  }
  if (item.tolerance !== undefined && !(item.tolerance >= 30 && item.tolerance <= 150))
    errs.push('tolerance は 30〜150');
  if (item.misconceptionIds && !needsTrace(item.mode))
    errs.push('自由書きだけの問題に誤概念IDは付けない（採点しない）');
  return errs;
}

export const traceAnswerText = (item: TraceItem): RichText =>
  needsTrace(item.mode)
    ? `「${item.char}」を かきじゅんどおりに かけたね`
    : `「${item.char}」を かいたね`;

// ---- 画面 ----

type Props = Omit<EngineProps<Item, TraceResponse>, 'item'> & {
  item: TraceItem;
  /** 見せたヒントの数（実行枠から。提案中の追加）。1 = 次に書く所を囲む、2 = お手本の動きをもう一度 */
  hintsShown?: number;
};

type Stage = 'loading' | 'trace' | 'free' | 'compare' | 'sent';

const reduceMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** お手本を重ねる（見比べ）。書き順データがあれば画を太く薄く、無ければ字体で */
function paintModel(
  g: CanvasRenderingContext2D,
  c: PadColors,
  guide: Pt[][] | null,
  ch: string,
  alpha: number,
) {
  g.globalAlpha = alpha;
  if (guide) {
    g.strokeStyle = c.skyDark;
    g.lineWidth = 60;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const s of guide) {
      g.beginPath();
      s.forEach((p, i) => (i === 0 ? g.moveTo(p[0], p[1]) : g.lineTo(p[0], p[1])));
      g.stroke();
    }
  } else {
    g.fillStyle = c.skyDark;
    g.font = `600 760px ${c.letterFont}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ch, 500, 540);
  }
  g.globalAlpha = 1;
}

function targetOf(guide: Pt[][], j: TraceJudgement): Pt {
  const s = Math.min(j.current, guide.length - 1);
  return prepareGuide(guide)[s]!.pts[j.strokes[s]!.k]!;
}

function TraceView({ item, ctx, revealed, disabled, submit, hintsShown = 0 }: Props) {
  const [guide, setGuide] = useState<Pt[][] | null>(() =>
    item.strokes ? normalizeStrokes(item.strokes) : null,
  );
  const [loaded, setLoaded] = useState(item.strokes !== undefined);
  useEffect(() => {
    if (item.strokes) return;
    let alive = true;
    void loadGuide(item.char).then((g) => {
      if (!alive) return;
      setGuide(g);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [item.char, item.strokes]);

  const canTrace = needsTrace(item.mode) && guide !== null;
  const [stage, setStage] = useState<Stage>('loading');
  const effective: Stage = stage === 'loading' && loaded ? (canTrace ? 'trace' : 'free') : stage;

  // なぞり
  const r = traceTolerance(item, ctx.preschool);
  const [lines, setLines] = useState<Pt[][]>([]);
  const [demoToken, setDemoToken] = useState(1);
  const unusedEver = useRef(0);
  const traceRun = useRef<TraceRun | null>(null);
  const v1Item: V1TraceItem | null = useMemo(
    () =>
      guide
        ? {
            id: `unit-${item.char}`,
            level: 0,
            kind: 'letter',
            title: item.char,
            char: item.char,
            strokes: guide,
          }
        : null,
    [guide, item.char],
  );
  const judgement = useMemo(() => (guide ? traceJudge(lines, guide, r) : null), [lines, guide, r]);

  // 自由書き
  const [freeLines, setFreeLines] = useState<DrawLine[]>([]);
  const [again, setAgain] = useState(0);

  // ヒント（実行枠の hintsShown）: 1 = 次に書く所を囲む、2 以上 = お手本の動きをもう一度
  const [hintToken, setHintToken] = useState(0);
  const lastHints = useRef(hintsShown);
  useEffect(() => {
    if (hintsShown > lastHints.current) {
      setHintToken(hintsShown);
      if (hintsShown >= 2) setDemoToken((n) => n + 1);
    }
    lastHints.current = hintsShown;
  }, [hintsShown]);

  const locked = disabled || revealed || effective === 'sent' || effective === 'loading';

  const onLine = (pts: Pt[]) => {
    if (locked || !guide || effective !== 'trace') return;
    const next: Pt[][] = [...lines, simplifyLine(pts, 2)];
    setLines(next);
    setHintToken(0);
    const j = traceJudge(next, guide, r);
    const run: TraceRun = { lines: next, guide, r };
    if (j.complete) {
      traceRun.current = run;
      if (needsFree(item.mode)) setStage('free');
      else {
        setStage('sent');
        submit({ kind: 'done', trace: run });
      }
      return;
    }
    const last = j.lines[j.lines.length - 1]!;
    if (last.reason === 'far-start' || last.reason === 'off-track') {
      unusedEver.current += 1;
      if (unusedEver.current % UNUSED_PER_WRONG === 0) submit({ kind: 'miss', ...run });
    }
  };

  const finishFree = () => {
    if (locked) return;
    const png = renderPng({ aspect: 1, guide: 'cross', lines: freeLines });
    setStage('sent');
    submit({
      kind: 'done',
      ...(traceRun.current ? { trace: traceRun.current } : {}),
      free: { lines: freeLines, self: 'similar', again, ...(png ? { png } : {}) },
    });
  };

  const hintAt =
    hintToken > 0 && guide && judgement && effective === 'trace'
      ? targetOf(guide, judgement)
      : null;
  const showModel = effective === 'compare' || (revealed && effective !== 'trace');
  const modelUnder = effective === 'free' && hintsShown > 0;

  return (
    <div
      className="eng-trace"
      data-stage={effective}
      data-r={r}
      data-unused={judgement ? countUnused(judgement) : 0}
    >
      <div className="eng-trace__board">
        {v1Item &&
        judgement &&
        (effective === 'trace' || (effective === 'sent' && !needsFree(item.mode))) ? (
          <TraceCanvas
            item={v1Item}
            r={r}
            judgement={judgement}
            lines={lines.map((p) => ({ p }))}
            hintAt={hintAt}
            demoToken={demoToken}
            reduceMotion={reduceMotion()}
            locked={locked}
            reveal={revealed}
            onLine={onLine}
            onKind={() => undefined}
          />
        ) : effective === 'loading' ? (
          <div className="eng-trace__loading" aria-label="じゅんびちゅう" />
        ) : (
          <DrawPad
            aspect={1}
            guide="cross"
            lines={freeLines}
            color="ink"
            locked={locked || effective === 'compare'}
            onLine={(l) => setFreeLines((ls) => [...ls, l])}
            under={modelUnder ? (g, c) => paintModel(g, c, guide, item.char, 0.18) : undefined}
            over={showModel ? (g, c) => paintModel(g, c, guide, item.char, 0.4) : undefined}
            label={`「${item.char}」を かく ところ`}
            testId="trace-free-pad"
          />
        )}
      </div>
      <div className="eng-trace__side">
        {effective === 'trace' ? (
          <>
            <Tap
              label="おてほんを みる"
              icon="look"
              size="aux"
              variant="white"
              text={<span className="eng-trace__tool-text">みる</span>}
              disabled={locked}
              onPress={() => setDemoToken((n) => n + 1)}
              testId="look-button"
            />
            <Tap
              label="ひとつ もどす"
              icon="undo"
              size="aux"
              variant="white"
              text={<span className="eng-trace__tool-text">もどす</span>}
              disabled={locked || lines.length === 0}
              onPress={() => setLines((ls) => ls.slice(0, -1))}
              testId="undo-button"
            />
          </>
        ) : null}
        {effective === 'free' ? (
          <>
            {canTrace || traceRun.current ? (
              <p className="eng-trace__say">じぶんで かいて みよう</p>
            ) : null}
            <Tap
              label="ひとつ もどす"
              icon="undo"
              size="aux"
              variant="white"
              text={<span className="eng-trace__tool-text">もどす</span>}
              disabled={locked || freeLines.length === 0}
              onPress={() => setFreeLines((ls) => ls.slice(0, -1))}
              testId="undo-button"
            />
            <Tap
              label="おてほんと みくらべる"
              icon="look"
              variant="main"
              text="みくらべる"
              disabled={locked || freeLines.length === 0}
              onPress={() => setStage('compare')}
              testId="compare-button"
              className="eng-trace__main"
            />
          </>
        ) : null}
        {effective === 'compare' && !revealed ? (
          <>
            <p className="eng-trace__say">おてほんと くらべて どうかな</p>
            <Tap
              label="にてる"
              icon="done"
              variant="main"
              text="にてる"
              disabled={disabled}
              onPress={finishFree}
              testId="self-similar"
              className="eng-trace__main"
            />
            <Tap
              label="もういちど かく"
              icon="again"
              variant="wood"
              text="もういちど"
              disabled={disabled}
              onPress={() => {
                setFreeLines([]);
                setAgain((n) => n + 1);
                setStage('free');
              }}
              testId="self-again"
              className="eng-trace__main"
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

export interface TraceEngineDef {
  id: 'trace';
  Component: (props: Props) => ReactNode;
  judge(item: TraceItem, response: TraceResponse): Judgement;
  check(item: TraceItem): string[];
  answerText(item: TraceItem): RichText;
}

export const traceEngine: TraceEngineDef = {
  id: 'trace',
  Component: TraceView,
  judge: judgeTrace,
  check: checkTrace,
  answerText: traceAnswerText,
};
