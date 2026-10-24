/**
 * numberline エンジン: 数直線。
 *  (a) read  … ↓で指された目盛りの数を答える（number と同じ数字キー）
 *  (b) place … 数を数直線の上に置く（目盛りをタップ。最小目盛りへ吸着。◀▶ で1目盛りずつ直せる）
 * 整数・小数・分数の目盛り。値は有理数で比べる（浮動小数点で比べない）。
 */
import { useState } from 'react';
import {
  answerValue,
  eq,
  judgeNumber,
  RETRY_MESSAGE,
  type NumberAnswer,
  type Rational,
} from '../../core/answer/number';
import type { ItemBase, RichText } from '../../curriculum/types';
import type { Judgement } from '../types';
import {
  clampInt,
  ratAdd,
  ratDiv,
  ratMul,
  ratSub,
  ratText,
  ratToNumber,
  svgPoint,
  toRational,
  type KitEngineDef,
  type KitProps,
  type Num,
} from './kit';
import { NumFields, NumKeys, useNumEntry, type PadKey } from './NumPad';
import './numberline.css';

export interface NumberlineScale {
  /** 左はしの値 */
  min: Num;
  /** 右はしの値 */
  max: Num;
  /** 最小目盛りの大きさ（0.1、'1/5'、10 など）。置く問題はこの目盛りに吸着する */
  minor: Num;
  /** 中くらいの目盛り: 最小目盛りいくつごとか（例 5） */
  midEvery?: number;
  /** 長い目盛り: 最小目盛りいくつごとか（例 10） */
  majorEvery: number;
  /** 数字を書く目盛りの値。省略時は長い目盛りすべて。[] なら数字を書かない */
  labels?: Num[];
  /** 数字の書き方（既定 auto: 整数・有限小数はそのまま、他は分数） */
  labelAs?: 'auto' | 'fraction' | 'mixed' | 'decimal';
}

export type NumberlineTask =
  | {
      kind: 'read';
      /** ↓で指す値（目盛りの上） */
      at: Num;
      /** 答えの形（省略時: 整数→int、有限小数→decimal、他→fraction。値は at から導く） */
      answer?: NumberAnswer;
      /** 欄の後ろの単位など */
      unit?: RichText;
      keys?: PadKey[];
    }
  | {
      kind: 'place';
      /** 置く値 */
      target: Num;
      /** 許容誤差（値の幅。既定 0 = 目盛りぴったり） */
      tolerance?: Num;
      /** 最初に印を置く値（省略時は印なし） */
      start?: Num;
    };

export interface NumberlineItem extends ItemBase {
  engine: 'numberline';
  line: NumberlineScale;
  task: NumberlineTask;
  /** ほかに示す印（「0」「1」の名前、比べる数など） */
  marks?: { at: Num; label?: RichText }[];
  /** よくある誤りの自動の推定に結ぶ誤概念ID */
  misconceptions?: {
    /** 最小目盛りを 1 とみて数えた（0.1 の目盛りを 1 ずつ、10 の目盛りを 1 ずつ） */
    minorAsOne?: string;
    /** となりの目盛り（1目盛りずれ） */
    neighborTick?: string;
  };
  /** 決まった誤答の値 → 誤概念 */
  wrongAnswers?: { value: Num; misconception: string }[];
}

export type NumberlineResponse = { fields: string[] } | { tick: number };

// ---- 目盛りの計算 ----
interface Line {
  min: Rational;
  max: Rational;
  minor: Rational;
  n: number;
}

function lineOf(s: NumberlineScale): Line | null {
  const min = toRational(s.min);
  const max = toRational(s.max);
  const minor = toRational(s.minor);
  if (!min || !max || !minor || minor.n <= 0) return null;
  const span = ratDiv(ratSub(max, min), minor);
  if (span.d !== 1 || span.n <= 0) return null;
  return { min, max, minor, n: span.n };
}

function valueAt(l: Line, i: number): Rational {
  return ratAdd(l.min, ratMul(l.minor, { n: i, d: 1 }));
}

/** 値の目盛りの番号（目盛りの上でなければ null） */
function tickOf(l: Line, v: Rational): number | null {
  const k = ratDiv(ratSub(v, l.min), l.minor);
  return k.d === 1 ? k.n : null;
}

/** 分数の数直線か（最小目盛りを '1/5' のように分数で書いた、または数字を分数で書く） */
function isFractionLine(s: NumberlineScale): boolean {
  return (
    (typeof s.minor === 'string' && s.minor.includes('/')) ||
    s.labelAs === 'fraction' ||
    s.labelAs === 'mixed'
  );
}

/** 数字の書き方（分数の数直線は既定で分数） */
function labelMode(s: NumberlineScale): NonNullable<NumberlineScale['labelAs']> {
  return s.labelAs ?? (isFractionLine(s) ? 'fraction' : 'auto');
}

function defaultAnswer(v: Rational, s: NumberlineScale): NumberAnswer {
  if (v.d === 1) return { kind: 'int', value: v.n };
  if (!isFractionLine(s) && !ratText(v, 'auto').includes('[['))
    return { kind: 'decimal', value: ratToNumber(v) };
  return { kind: 'fraction', num: v.n, den: v.d };
}

function readAnswer(item: NumberlineItem): NumberAnswer | null {
  if (item.task.kind !== 'read') return null;
  if (item.task.answer) return item.task.answer;
  const v = toRational(item.task.at);
  return v ? defaultAnswer(v, item.line) : null;
}

function misOf(
  item: NumberlineItem,
  l: Line,
  v: Rational,
  want: Rational,
  userTick?: number,
): string | undefined {
  const known = item.wrongAnswers?.find((w) => {
    const r = toRational(w.value);
    return r !== null && eq(r, v);
  });
  if (known) return known.misconception;
  const wantTick = tickOf(l, want);
  if (item.misconceptions?.minorAsOne && wantTick !== null && !eq(l.minor, { n: 1, d: 1 })) {
    if (userTick === undefined) {
      // 読む: 目盛りの数をそのまま値とみた（min + 目盛りの数）
      if (eq(v, ratAdd(l.min, { n: wantTick, d: 1 }))) return item.misconceptions.minorAsOne;
    } else {
      // 置く: 1目盛りを1とみて、値の数だけ目盛りを進めた
      const k = ratSub(want, l.min);
      if (k.d === 1 && userTick === k.n) return item.misconceptions.minorAsOne;
    }
  }
  if (item.misconceptions?.neighborTick) {
    const diff = ratSub(v, want);
    if (eq({ n: Math.abs(diff.n), d: diff.d }, l.minor)) return item.misconceptions.neighborTick;
  }
  return undefined;
}

export function judgeNumberline(item: NumberlineItem, res: NumberlineResponse): Judgement {
  const l = lineOf(item.line);
  if (!l) return { result: 'wrong', mark: true };
  const t = item.task;
  if (t.kind === 'read') {
    const ans = readAnswer(item);
    if (!ans || !('fields' in res)) return { result: 'wrong', mark: true };
    const input = res.fields[0] ?? '';
    const v = judgeNumber(ans, input);
    if (v.result === 'correct') return { result: 'correct' };
    if (v.result === 'retry') return { result: 'retry', message: RETRY_MESSAGE[v.reason] };
    const given = toRational(input);
    const mis = given ? misOf(item, l, given, answerValue(ans)) : undefined;
    return { result: 'wrong', misconception: mis, mark: true };
  }
  if (!('tick' in res) || !Number.isInteger(res.tick) || res.tick < 0 || res.tick > l.n)
    return { result: 'retry', message: 'めもりの うえを タップしてね' };
  const want = toRational(t.target);
  if (!want) return { result: 'wrong', mark: res.tick };
  const v = valueAt(l, res.tick);
  const tol = t.tolerance !== undefined ? (toRational(t.tolerance) ?? { n: 0, d: 1 }) : null;
  const diff = Math.abs(ratToNumber(ratSub(v, want)));
  if (tol ? diff <= ratToNumber(tol) + 1e-9 : eq(v, want)) return { result: 'correct' };
  return { result: 'wrong', misconception: misOf(item, l, v, want, res.tick), mark: res.tick };
}

export function checkNumberline(item: NumberlineItem): string[] {
  const errs: string[] = [];
  const l = lineOf(item.line);
  if (!l) {
    errs.push('数直線の min・max・minor が読めない、または (max−min) が最小目盛りで割り切れない');
    return errs;
  }
  if (l.n > 400) errs.push(`目盛りが多すぎる（${l.n}。400まで）`);
  if (!Number.isInteger(item.line.majorEvery) || item.line.majorEvery < 1)
    errs.push('majorEvery は1以上の整数');
  if (
    item.line.midEvery !== undefined &&
    (!Number.isInteger(item.line.midEvery) || item.line.midEvery < 1)
  )
    errs.push('midEvery は1以上の整数');
  for (const x of item.line.labels ?? []) {
    const r = toRational(x);
    if (!r || tickOf(l, r) === null || tickOf(l, r)! < 0 || tickOf(l, r)! > l.n)
      errs.push(`数字を書く目盛り ${x} が目盛りの上にない`);
  }
  const inRange = (r: Rational) =>
    tickOf(l, r) !== null && tickOf(l, r)! >= 0 && tickOf(l, r)! <= l.n;
  for (const m of item.marks ?? []) {
    const r = toRational(m.at);
    if (!r || !inRange(r)) errs.push(`印 ${m.at} が目盛りの上にない`);
  }
  const t = item.task;
  let want: Rational | null = null;
  if (t.kind === 'read') {
    want = toRational(t.at);
    if (!want || !inRange(want)) errs.push(`指す値 ${t.at} が目盛りの上にない`);
    const ans = readAnswer(item);
    if (want && ans && !eq(answerValue(ans), want)) errs.push('答えの値が指す値と一致しない');
    if (ans) {
      const av = answerValue(ans);
      if (ans.kind === 'fraction' && !t.keys?.includes('fraction'))
        errs.push('分数の答えなのに分数キーが無い');
      if (ans.kind === 'decimal' && !t.keys?.includes('decimal'))
        errs.push('小数の答えなのに小数点キーが無い');
      if (av.n < 0 && !t.keys?.includes('minus')) errs.push('負の答えなのにマイナスキーが無い');
    }
    // 数字を書いた目盛りを指すと、答えが図に出てしまう
    if (want && (item.line.labels ?? majorLabels(item.line, l)).some((x) => eqNum(x, want!)))
      errs.push('指す値の目盛りに数字が書いてある（答えが見える）');
  } else {
    want = toRational(t.target);
    if (!want) errs.push(`置く値 ${t.target} が読めない`);
    else {
      const tol = t.tolerance !== undefined ? toRational(t.tolerance) : { n: 0, d: 1 };
      if (!tol || tol.n < 0) errs.push('許容誤差が読めない');
      const k = ratToNumber(ratDiv(ratSub(want, l.min), l.minor));
      if (k < -1e-9 || k > l.n + 1e-9) errs.push(`置く値 ${t.target} が数直線の外`);
      else if (tickOf(l, want) === null && tol && ratToNumber(tol) < ratToNumber(l.minor) / 2)
        errs.push(`置く値 ${t.target} が目盛りの上になく、許容誤差でも届かない`);
      if (t.start !== undefined) {
        const s = toRational(t.start);
        if (!s || !inRange(s)) errs.push(`最初の印 ${t.start} が目盛りの上にない`);
      }
    }
  }
  for (const w of item.wrongAnswers ?? []) {
    const r = toRational(w.value);
    if (!r) {
      errs.push(`誤答の例 ${w.value} が読めない`);
      continue;
    }
    if (want && eq(r, want)) errs.push(`誤答の例 ${w.value} が正答と同じ`);
  }
  return errs;
}

function eqNum(x: Num, r: Rational): boolean {
  const a = toRational(x);
  return a !== null && eq(a, r);
}

function majorLabels(s: NumberlineScale, l: Line): Num[] {
  const out: Num[] = [];
  for (let i = 0; i <= l.n; i += s.majorEvery) {
    const v = valueAt(l, i);
    out.push(v.d === 1 ? v.n : `${v.n}/${v.d}`);
  }
  return out;
}

export function numberlineAnswerText(item: NumberlineItem): RichText {
  const t = item.task;
  if (t.kind === 'read') {
    const a = readAnswer(item);
    if (!a) return '';
    const v = answerValue(a);
    const txt = ratText(
      v,
      a.kind === 'fraction' ? (item.line.labelAs === 'mixed' ? 'mixed' : 'fraction') : 'auto',
    );
    return t.unit ? `${txt}${t.unit}` : txt;
  }
  const v = toRational(t.target);
  return v ? ratText(v, labelMode(item.line)) : '';
}

// ---- 画面 ----
const W = 1000;
const H = 236;
const PAD = 50;
const AXIS_Y = 136;

/** SVG の中の数（分数は縦に積む） */
function SvgNum({
  v,
  x,
  y,
  as,
}: {
  v: Rational;
  x: number;
  y: number;
  as: NumberlineScale['labelAs'];
}) {
  const t = ratText(v, as ?? 'auto');
  const m = /^(-?)\[\[(?:(\d+) )?(\d+)\/(\d+)\]\]$/.exec(t);
  if (!m)
    return (
      <text x={x} y={y} className="nl2-label">
        {t}
      </text>
    );
  const dx = m[2] ? 12 : 0;
  return (
    <g>
      {m[2] ? (
        <text x={x - 14} y={y + 2} className="nl2-label" textAnchor="end">
          {m[1]}
          {m[2]}
        </text>
      ) : null}
      <text x={x + dx} y={y - 14} className="nl2-label nl2-label--frac">
        {m[2] ? '' : m[1]}
        {m[3]}
      </text>
      <line x1={x + dx - 16} y1={y - 6} x2={x + dx + 16} y2={y - 6} className="nl2-fracbar" />
      <text x={x + dx} y={y + 22} className="nl2-label nl2-label--frac">
        {m[4]}
      </text>
    </g>
  );
}

export function NumberlineSvg({
  item,
  l,
  pointer,
  placed,
  placedState,
  answerTick,
  showAnswerLabel,
  onTapTick,
}: {
  item: NumberlineItem;
  l: Line;
  /** read: ↓で指す目盛り */
  pointer?: number;
  /** place: 子が置いた印 */
  placed?: number | null;
  placedState?: 'normal' | 'wrong';
  /** 正答の印（revealed） */
  answerTick?: number | null;
  showAnswerLabel?: boolean;
  onTapTick?: (i: number) => void;
}) {
  const X = (i: number) => PAD + (i / l.n) * (W - PAD * 2);
  const s = item.line;
  const labelSet = (s.labels ?? majorLabels(s, l))
    .map((x) => toRational(x))
    .filter((r): r is Rational => r !== null)
    .map((r) => tickOf(l, r))
    .filter((k): k is number => k !== null);
  const ticks = [];
  for (let i = 0; i <= l.n; i++) {
    const major = i % s.majorEvery === 0;
    const mid = !major && s.midEvery !== undefined && i % s.midEvery === 0;
    const len = major ? 26 : mid ? 18 : 11;
    ticks.push(
      <line
        key={i}
        x1={X(i)}
        y1={AXIS_Y - len}
        x2={X(i)}
        y2={AXIS_Y + len}
        className={major ? 'nl2-major' : mid ? 'nl2-mid' : 'nl2-minor'}
      />,
    );
  }
  const vb = { x: 0, y: 0, w: W, h: H };
  const tap = onTapTick
    ? (e: React.MouseEvent<SVGSVGElement>) => {
        const p = svgPoint(e, vb);
        onTapTick(clampInt(((p.x - PAD) / (W - PAD * 2)) * l.n, 0, l.n));
      }
    : undefined;
  const marker = (i: number, cls: string, key: string) => (
    <path key={key} d={`M ${X(i)} ${AXIS_Y - 28} l -22 -40 h 44 z`} className={cls} />
  );
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mk-svg nl2-svg"
      role="img"
      aria-label="すうちょくせん"
      onClick={tap}
      data-testid="numberline"
    >
      {onTapTick ? <rect x={0} y={0} width={W} height={H} className="mk-hit" /> : null}
      <line x1={PAD - 24} y1={AXIS_Y} x2={W - PAD + 30} y2={AXIS_Y} className="nl2-axis" />
      <path d={`M ${W - PAD + 30} ${AXIS_Y} l -18 -10 v 20 z`} className="nl2-arrow" />
      {ticks}
      {labelSet.map((k) => (
        <SvgNum key={`l${k}`} v={valueAt(l, k)} x={X(k)} y={AXIS_Y + 62} as={labelMode(s)} />
      ))}
      {(item.marks ?? []).map((m, i) => {
        const r = toRational(m.at);
        const k = r ? tickOf(l, r) : null;
        if (k === null) return null;
        return <circle key={`m${i}`} cx={X(k)} cy={AXIS_Y} r={9} className="nl2-dot" />;
      })}
      {pointer !== undefined ? marker(pointer, 'nl2-pointer', 'ptr') : null}
      {pointer !== undefined && showAnswerLabel ? (
        <SvgNum v={valueAt(l, pointer)} x={X(pointer)} y={AXIS_Y - 94} as={labelMode(s)} />
      ) : null}
      {answerTick !== undefined && answerTick !== null ? (
        <>
          {marker(answerTick, 'nl2-answer', 'ans')}
          <SvgNum v={valueAt(l, answerTick)} x={X(answerTick)} y={AXIS_Y - 94} as={labelMode(s)} />
        </>
      ) : null}
      {placed !== undefined && placed !== null
        ? marker(placed, `nl2-placed${placedState === 'wrong' ? ' is-wrong' : ''}`, 'pl')
        : null}
    </svg>
  );
}

function NumberlineView(props: KitProps<NumberlineItem, NumberlineResponse>) {
  const l = lineOf(props.item.line);
  if (!l) return null;
  return props.item.task.kind === 'read' ? (
    <ReadView {...props} l={l} />
  ) : (
    <PlaceView {...props} l={l} />
  );
}

function ReadView({
  item,
  ctx,
  revealed,
  wrongMark,
  disabled,
  submit,
  l,
}: KitProps<NumberlineItem, NumberlineResponse> & { l: Line }) {
  const t = item.task as Extract<NumberlineTask, { kind: 'read' }>;
  const locked = disabled || revealed;
  const entry = useNumEntry(1, locked);
  const at = toRational(t.at);
  const pointer = at ? (tickOf(l, at) ?? 0) : 0;
  return (
    <div className="mk eng-nl">
      <div className="mk__main">
        <NumberlineSvg item={item} l={l} pointer={pointer} showAnswerLabel={revealed} />
        <NumFields
          entry={entry}
          fields={[{ unit: t.unit }]}
          ctx={ctx}
          wrong={!!wrongMark}
          revealed={revealed}
          answers={[numberlineAnswerText({ ...item, task: { ...t, unit: undefined } })]}
        />
      </div>
      <div className="mk__side">
        <NumKeys
          entry={entry}
          keys={t.keys}
          disabled={locked}
          onSubmit={() => submit({ fields: entry.vals })}
        />
      </div>
    </div>
  );
}

function PlaceView({
  item,
  revealed,
  wrongMark,
  disabled,
  submit,
  l,
}: KitProps<NumberlineItem, NumberlineResponse> & { l: Line }) {
  const t = item.task as Extract<NumberlineTask, { kind: 'place' }>;
  const locked = disabled || revealed;
  const start = t.start !== undefined ? toRational(t.start) : null;
  const [tick, setTick] = useState<number | null>(start ? tickOf(l, start) : null);
  const want = toRational(t.target);
  const wantTick = want ? Math.round(ratToNumber(ratDiv(ratSub(want, l.min), l.minor))) : null;
  const move = (d: number) => {
    if (locked) return;
    setTick((k) => clampInt((k ?? 0) + d, 0, l.n));
  };
  const wrongNow = typeof wrongMark === 'number' && wrongMark === tick && !revealed;
  return (
    <div className="mk eng-nl">
      <div className="mk__main">
        <NumberlineSvg
          item={item}
          l={l}
          placed={tick}
          placedState={wrongNow ? 'wrong' : 'normal'}
          answerTick={revealed ? wantTick : null}
          onTapTick={locked ? undefined : (i) => setTick(i)}
        />
      </div>
      <div className="mk__side eng-nl__side">
        <div className="mk-row">
          <button
            type="button"
            className="mk-btn"
            onClick={() => move(-1)}
            disabled={locked || tick === null || tick <= 0}
            aria-label="ひだりへ ひとめもり"
            data-testid="nudge-left"
          >
            ◀
          </button>
          <button
            type="button"
            className="mk-btn"
            onClick={() => move(1)}
            disabled={locked || (tick !== null && tick >= l.n)}
            aria-label="みぎへ ひとめもり"
            data-testid="nudge-right"
          >
            ▶
          </button>
        </div>
        <button
          type="button"
          className="mk-btn mk-btn--ok"
          onClick={() => tick !== null && submit({ tick })}
          disabled={locked || tick === null}
          data-testid="check"
        >
          こたえあわせ
        </button>
      </div>
    </div>
  );
}

/** 問題データの中の、子供に見せる文（よみの検査用。qa.ts の textsOf に加える） */
export function numberlineTexts(item: NumberlineItem): RichText[] {
  const t: RichText[] = (item.marks ?? []).flatMap((m) => (m.label ? [m.label] : []));
  if (item.task.kind === 'read' && item.task.unit) t.push(item.task.unit);
  return t;
}

export const numberlineEngine: KitEngineDef<NumberlineItem, NumberlineResponse> = {
  id: 'numberline',
  Component: NumberlineView,
  judge: judgeNumberline,
  check: checkNumberline,
  answerText: numberlineAnswerText,
};
