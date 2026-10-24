/**
 * graph エンジン: 表とグラフ。
 *  読む（choice / number）… 表・棒グラフ・絵グラフ・折れ線・円グラフ・帯グラフを見て答える
 *  作る（make）           … 棒の高さ・絵グラフの ○ の数・折れ線の点を、目盛りの上をタップして決める
 *                          （列をタップ → その高さへ。▲▼ で1目盛りずつ直せる。ドラッグ不要）
 * 目盛りの間隔（1目盛りの大きさ）は問題で指定する（2・5・10・20・50 など）。円・帯グラフは読むだけ。
 */
import { useState } from 'react';
import { judgeNumber, normalizeInput, RETRY_MESSAGE } from '../../core/answer/number';
import type { ChoiceOption, ItemBase, NumberField, RichText } from '../../curriculum/types';
import { Illust } from '../../illust/Illust';
import { Rt } from '../../text/Rt';
import { plainText } from '../../text/rich';
import { Choice } from '../../ui/Choice';
import type { TapState } from '../../ui/Tap';
import { Figure } from '../figure/Figure';
import { svgPoint, type KitEngineDef, type KitProps } from '../numberline/kit';
import { NumFields, NumKeys, useNumEntry, type PadKey } from '../numberline/NumPad';
import type { Judgement, RenderCtx } from '../types';
import './graph.css';

export type GraphKind = 'bar' | 'picture' | 'line' | 'table' | 'pie' | 'band';

export interface GraphData {
  kind: GraphKind;
  /** 項目（横軸・表の行・円グラフの部分） */
  labels: RichText[];
  /** 値（pie・band は % で合計 100） */
  values: number[];
  /** 1目盛りの大きさ（bar・line。picture は 絵1こ の大きさ。既定 1） */
  scaleStep?: number;
  /** 数字を書く目盛り: 何目盛りごとか（既定 1） */
  labelEvery?: number;
  /** 目盛りの上限（省略時は値から決める。作る問題で答えが見えないよう指定するとよい） */
  max?: number;
  /** 折れ線の目盛りの下限（既定 0） */
  min?: number;
  /** 縦軸の単位（「にん」「ど」） */
  unit?: RichText;
  /** 表の見出し [項目, 値] */
  header?: [RichText, RichText];
  /** 絵グラフの絵（IllustId）。省略時は ○ */
  illust?: string;
  /** グラフの題 */
  title?: RichText;
}

export type GraphTask =
  | {
      kind: 'choice';
      /** choice エンジンと同じ選択肢（文か図。正解・誤概念ID） */
      options: ChoiceOption[];
      multi?: boolean;
    }
  | {
      kind: 'number';
      /** number エンジンと同じ欄 */
      fields: NumberField[];
      keys?: PadKey[];
      wrongAnswers?: { value: string; misconception: string }[];
    }
  | {
      kind: 'make';
      /** はじめの値（省略時: 棒・絵は 0、折れ線は点なし） */
      initial?: (number | null)[];
      /** 値の吸着の単位（既定 scaleStep。目盛りの半分まで読む問題は scaleStep/2） */
      snap?: number;
      /** 元の値を表で横に見せる（既定 true） */
      showTable?: boolean;
    };

export interface GraphItem extends ItemBase {
  engine: 'graph';
  data: GraphData;
  task: GraphTask;
  misconceptions?: {
    /** 作る: 1目盛りを 1 とみた（値の数だけ目盛りを進めた／目盛りの数を値とした） */
    scaleAsOne?: string;
  };
}

/** pick: 選んだ番号、fields: 数字キーの欄、values: 作った値（折れ線の点を打っていない所は null） */
export type GraphResponse =
  { pick: number[] } | { fields: string[] } | { values: (number | null)[] };

// ---- 判定 ----
const EPS = 1e-9;
const same = (a: number, b: number) => Math.abs(a - b) < EPS;

function judgeChoicePart(t: Extract<GraphTask, { kind: 'choice' }>, picked: number[]): Judgement {
  const correct = t.options.flatMap((o, i) => (o.correct ? [i] : []));
  const a = [...new Set(picked)].sort((x, y) => x - y);
  if (!t.multi) {
    const i = a[0];
    if (i === undefined || !t.options[i]) return { result: 'wrong', mark: [] };
    if (t.options[i]!.correct) return { result: 'correct' };
    return { result: 'wrong', misconception: t.options[i]!.misconception, mark: [i] };
  }
  if (a.length === correct.length && a.every((v, i) => v === correct[i]))
    return { result: 'correct' };
  const wrongPick = a.find((i) => !t.options[i]?.correct);
  return {
    result: 'wrong',
    misconception: wrongPick !== undefined ? t.options[wrongPick]?.misconception : undefined,
    mark: wrongPick !== undefined ? [wrongPick] : [],
  };
}

function judgeNumberPart(t: Extract<GraphTask, { kind: 'number' }>, res: string[]): Judgement {
  let firstRetry: Judgement | null = null;
  for (let i = 0; i < t.fields.length; i++) {
    const v = judgeNumber(t.fields[i]!.answer, res[i] ?? '');
    if (v.result === 'wrong') {
      const joined = res.map((s) => normalizeInput(s)).join('|');
      const known = t.wrongAnswers?.find((w) => normalizeInput(w.value) === joined);
      return { result: 'wrong', misconception: known?.misconception, mark: true };
    }
    if (v.result === 'retry') firstRetry ??= { result: 'retry', message: RETRY_MESSAGE[v.reason] };
  }
  return firstRetry ?? { result: 'correct' };
}

export function judgeGraph(item: GraphItem, res: GraphResponse): Judgement {
  const t = item.task;
  if (t.kind === 'choice')
    return 'pick' in res ? judgeChoicePart(t, res.pick) : { result: 'wrong', mark: [] };
  if (t.kind === 'number')
    return 'fields' in res
      ? judgeNumberPart(t, res.fields)
      : { result: 'retry', message: RETRY_MESSAGE.unreadable };
  if (!('values' in res) || res.values.length !== item.data.values.length)
    return { result: 'retry', message: RETRY_MESSAGE.unreadable };
  if (res.values.some((v) => v === null || !Number.isFinite(v)))
    return { result: 'retry', message: 'ぜんぶの てんを うってね' };
  const vals = res.values as number[];
  const diff = vals.flatMap((v, i) => (same(v, item.data.values[i]!) ? [] : [i]));
  if (diff.length === 0) return { result: 'correct' };
  const step = item.data.scaleStep ?? 1;
  let mis: string | undefined;
  if (item.misconceptions?.scaleAsOne && step !== 1) {
    const asOne = diff.every((i) => {
      const want = item.data.values[i]!;
      return same(vals[i]!, want * step) || same(vals[i]!, want / step);
    });
    if (asOne) mis = item.misconceptions.scaleAsOne;
  }
  return { result: 'wrong', misconception: mis, mark: diff };
}

/** 縦軸の範囲（目盛りの数 = (max−min)/step） */
function axisOf(d: GraphData): { min: number; max: number; step: number; n: number } {
  const step = d.scaleStep ?? 1;
  const min = d.kind === 'line' ? (d.min ?? 0) : 0;
  const rawMax = d.max ?? Math.max(...d.values, min + step);
  const n = Math.max(1, Math.ceil((rawMax - min) / step - EPS));
  return { min, max: min + n * step, step, n };
}

export function checkGraph(item: GraphItem): string[] {
  const errs: string[] = [];
  const d = item.data;
  if (d.labels.length < 1) errs.push('項目が無い');
  if (d.labels.length !== d.values.length) errs.push('項目と値の数が違う');
  if (d.values.some((v) => !Number.isFinite(v))) errs.push('値が数でない');
  const step = d.scaleStep ?? 1;
  if (!(step > 0)) errs.push('目盛りの間隔が 0 以下');
  if (d.kind === 'pie' || d.kind === 'band') {
    const sum = d.values.reduce((s, v) => s + v, 0);
    if (!same(sum, 100)) errs.push(`割合の合計が 100 でない（${sum}）`);
    if (item.task.kind === 'make') errs.push('円・帯グラフは作る問題にしない（読むだけ）');
  }
  if (d.kind === 'bar' || d.kind === 'line' || d.kind === 'picture') {
    const ax = axisOf(d);
    if (d.values.some((v) => v < ax.min - EPS || v > ax.max + EPS))
      errs.push('値が目盛りの範囲の外');
    if (ax.n > 40) errs.push(`目盛りが多すぎる（${ax.n}。40まで。目盛りの間隔を大きく）`);
    if (d.kind === 'picture' && d.values.some((v) => !Number.isInteger(v / step)))
      errs.push('絵グラフの値が 絵1こ の大きさの倍数でない');
  }
  if (d.kind === 'table' && item.task.kind === 'make')
    errs.push('表は作る問題にしない（表の空欄は number で）');
  const t = item.task;
  if (t.kind === 'choice') {
    const nCorrect = t.options.filter((o) => o.correct).length;
    if (t.options.length < 2) errs.push('選択肢が2つ未満');
    if (nCorrect === 0) errs.push('正解の選択肢が無い');
    if (!t.multi && nCorrect !== 1) errs.push('1つ選ぶ問題なのに正解が1つではない');
    const labels = t.options.map((o) =>
      o.label !== undefined ? plainText(o.label) : JSON.stringify(o.figure),
    );
    if (new Set(labels).size !== labels.length) errs.push('同じ選択肢が重複している');
    for (const o of t.options) {
      if (o.label === undefined && o.figure === undefined) errs.push('選択肢に文も図も無い');
      if (o.correct && o.misconception) errs.push('正解の選択肢に誤概念IDが付いている');
    }
  }
  if (t.kind === 'number') {
    if (t.fields.length === 0) errs.push('入力欄が無い');
    for (const f of t.fields) {
      if (f.answer.kind === 'fraction' && !t.keys?.includes('fraction'))
        errs.push('分数の答えなのに分数キーが無い');
      if (
        (f.answer.kind === 'decimal' ||
          (f.answer.kind === 'quantity' && !Number.isInteger(f.answer.value))) &&
        !t.keys?.includes('decimal')
      )
        errs.push('小数の答えなのに小数点キーが無い');
    }
    for (const w of t.wrongAnswers ?? []) {
      const parts = w.value.split('|');
      if (parts.length !== t.fields.length) errs.push(`誤答の例 ${w.value} の欄の数が違う`);
      else if (judgeNumberPart(t, parts).result === 'correct')
        errs.push(`誤答の例 ${w.value} が正解と判定される`);
    }
  }
  if (t.kind === 'make') {
    if (d.kind === 'bar' || d.kind === 'line' || d.kind === 'picture') {
      const snap = t.snap ?? step;
      if (
        d.values.some(
          (v) => !Number.isInteger(Math.round(((v - axisOf(d).min) / snap) * 1e6) / 1e6),
        )
      )
        errs.push('作る値が吸着の単位（snap）の倍数でない');
      if (d.kind === 'picture' && t.snap !== undefined && t.snap !== step)
        errs.push('絵グラフの snap は 絵1こ の大きさと同じにする');
    }
    if (t.initial) {
      if (t.initial.length !== d.values.length) errs.push('はじめの値の数が項目の数と違う');
      else if (t.initial.every((v, i) => v !== null && same(v, d.values[i]!)))
        errs.push('はじめから正答になっている');
    }
    if (d.max === undefined)
      errs.push(
        '作る問題は目盛りの上限 max を指定する（いちばん大きい値が目盛りの上限だと答えが見える）',
      );
  }
  return errs;
}

export function graphAnswerText(item: GraphItem): RichText {
  const t = item.task;
  if (t.kind === 'choice')
    return t.options
      .filter((o) => o.correct)
      .map((o) => o.label ?? '')
      .join('、');
  if (t.kind === 'number')
    return t.fields
      .map((f) => {
        const a = f.answer;
        const v =
          a.kind === 'fraction'
            ? `[[${a.num}/${a.den}]]`
            : a.kind === 'quantity'
              ? `${a.value}${a.unit}`
              : String(a.value);
        return f.label ? `${f.label} ${v}` : v;
      })
      .join('、');
  return item.data.labels.map((l, i) => `${l} ${item.data.values[i]}`).join('、');
}

// ---- 画面 ----
const W = 720;
const H = 360;
const LEFT = 80;
const TOP = 24;
const BOTTOM = 16;
const RIGHT = 16;

function fmt(v: number): string {
  return String(Math.round(v * 1e6) / 1e6);
}

/** 棒グラフ・折れ線（作る問題では列ごとに当たり判定） */
function XYChart({
  item,
  values,
  ghost,
  selected,
  wrongCols,
  onTap,
}: {
  item: GraphItem;
  values: (number | null)[];
  /** 正答（revealed）を点線で重ねる */
  ghost: number[] | null;
  selected: number | null;
  wrongCols: Set<number>;
  onTap?: (col: number, value: number) => void;
}) {
  const d = item.data;
  const ax = axisOf(d);
  const n = d.labels.length;
  const slot = (W - LEFT - RIGHT) / n;
  const Y = (v: number) => TOP + (1 - (v - ax.min) / (ax.max - ax.min)) * (H - TOP - BOTTOM);
  const every = d.labelEvery ?? 1;
  const snap = item.task.kind === 'make' ? (item.task.snap ?? ax.step) : ax.step;
  const grid = [];
  for (let k = 0; k <= ax.n; k++) {
    const v = ax.min + k * ax.step;
    grid.push(
      <g key={k}>
        <line
          x1={LEFT}
          y1={Y(v)}
          x2={W - RIGHT}
          y2={Y(v)}
          className={k % every === 0 ? 'gr-grid gr-grid--l' : 'gr-grid'}
        />
        {k % every === 0 ? (
          <text x={LEFT - 10} y={Y(v) + 8} className="gr-ylabel">
            {fmt(v)}
          </text>
        ) : null}
      </g>,
    );
  }
  const vb = { x: 0, y: 0, w: W, h: H };
  const cx = (i: number) => LEFT + slot * (i + 0.5);
  const tap = onTap
    ? (e: React.MouseEvent<SVGSVGElement>) => {
        const p = svgPoint(e, vb);
        const col = Math.floor((p.x - LEFT) / slot);
        if (col < 0 || col >= n) return;
        const raw = ax.min + (1 - (p.y - TOP) / (H - TOP - BOTTOM)) * (ax.max - ax.min);
        const k = Math.round((raw - ax.min) / snap);
        const v = ax.min + Math.max(0, Math.min(Math.round((ax.max - ax.min) / snap), k)) * snap;
        onTap(col, Math.round(v * 1e9) / 1e9);
      }
    : undefined;
  const isBar = d.kind === 'bar';
  const placed = values
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v !== null);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mk-svg gr-svg"
      role="img"
      aria-label="グラフ"
      onClick={tap}
      data-testid="chart"
    >
      {onTap ? <rect x={0} y={0} width={W} height={H} className="mk-hit" /> : null}
      {selected !== null ? (
        <rect
          x={LEFT + slot * selected + 4}
          y={TOP - 14}
          width={slot - 8}
          height={H - TOP - BOTTOM + 14}
          className="gr-sel"
        />
      ) : null}
      {grid}
      <line x1={LEFT} y1={TOP} x2={LEFT} y2={H - BOTTOM} className="gr-axis" />
      <line x1={LEFT} y1={H - BOTTOM} x2={W - RIGHT} y2={H - BOTTOM} className="gr-axis" />
      {isBar ? (
        placed.map(({ v, i }) => (
          <rect
            key={i}
            x={LEFT + slot * i + slot * 0.22}
            y={Y(v)}
            width={slot * 0.56}
            height={Math.max(0, Y(ax.min) - Y(v))}
            className={`gr-bar${wrongCols.has(i) ? ' is-wrong' : ''}`}
          />
        ))
      ) : (
        <>
          <polyline
            points={values
              .map((v, i) => (v === null ? null : `${cx(i)},${Y(v)}`))
              .filter((s) => s !== null)
              .join(' ')}
            className="gr-line"
          />
          {placed.map(({ v, i }) => (
            <circle
              key={i}
              cx={cx(i)}
              cy={Y(v)}
              r={10}
              className={`gr-dot${wrongCols.has(i) ? ' is-wrong' : ''}`}
            />
          ))}
        </>
      )}
      {ghost
        ? ghost.map((v, i) =>
            values[i] !== null && same(values[i]!, v) ? null : isBar ? (
              <rect
                key={`g${i}`}
                x={LEFT + slot * i + slot * 0.22}
                y={Y(v)}
                width={slot * 0.56}
                height={Math.max(0, Y(ax.min) - Y(v))}
                className="gr-ghost"
              />
            ) : (
              <circle key={`g${i}`} cx={cx(i)} cy={Y(v)} r={14} className="gr-ghost" />
            ),
          )
        : null}
    </svg>
  );
}

function XLabels({
  labels,
  ctx,
  selected,
  onSelect,
}: {
  labels: RichText[];
  ctx: RenderCtx;
  selected?: number | null;
  onSelect?: (i: number) => void;
}) {
  return (
    <div
      className="gr-xlabels"
      style={{ paddingLeft: `${(LEFT / W) * 100}%`, paddingRight: `${(RIGHT / W) * 100}%` }}
    >
      {labels.map((l, i) =>
        onSelect ? (
          <button
            key={i}
            type="button"
            className={`gr-xlabel gr-xlabel--btn${selected === i ? ' is-on' : ''}`}
            onClick={() => onSelect(i)}
            data-testid={`col-${i}`}
          >
            <Rt text={l} ctx={ctx} />
          </button>
        ) : (
          <span key={i} className="gr-xlabel">
            <Rt text={l} ctx={ctx} />
          </span>
        ),
      )}
    </div>
  );
}

/** 絵グラフ（HTML。列をタップした高さまで積む） */
function PictureChart({
  item,
  ctx,
  values,
  ghost,
  selected,
  wrongCols,
  onTap,
}: {
  item: GraphItem;
  ctx: RenderCtx;
  values: number[];
  ghost: number[] | null;
  selected: number | null;
  wrongCols: Set<number>;
  onTap?: (col: number, value: number) => void;
}) {
  const d = item.data;
  const ax = axisOf(d);
  const slots = ax.n;
  const icon = (key: string, cls: string) =>
    d.illust ? (
      <Illust key={key} id={d.illust} decorative className={`gr-pic ${cls}`} />
    ) : (
      <span key={key} className={`gr-pic gr-pic--o ${cls}`} aria-hidden />
    );
  return (
    <div className="gr-picture" style={{ gridTemplateColumns: `repeat(${d.labels.length}, 1fr)` }}>
      {d.labels.map((l, i) => {
        const cnt = Math.round((values[i] ?? 0) / ax.step);
        const want = ghost ? Math.round(ghost[i]! / ax.step) : null;
        return (
          <div key={i} className="gr-piccol">
            <div
              className={`gr-picstack${selected === i ? ' is-on' : ''}${wrongCols.has(i) ? ' is-wrong' : ''}`}
              style={{ gridTemplateRows: `repeat(${slots}, 1fr)` }}
              role={onTap ? 'button' : undefined}
              aria-label={`${plainText(l)} ${cnt}こ`}
              data-testid={`piccol-${i}`}
              onClick={
                onTap
                  ? (e) => {
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const k = Math.min(
                        slots,
                        Math.max(1, Math.ceil(((r.bottom - e.clientY) / r.height) * slots)),
                      );
                      // いちばん上の絵をもう一度タップすると1つ減らす
                      const next = k === cnt ? k - 1 : k;
                      onTap(i, next * ax.step);
                    }
                  : undefined
              }
            >
              {Array.from({ length: slots }, (_, s) => {
                const k = slots - s; // 上から
                const on = k <= cnt;
                const g = want !== null && !on && k <= want;
                return (
                  <span key={s} className="gr-slot">
                    {on ? icon(`p${s}`, '') : g ? icon(`g${s}`, 'gr-pic--ghost') : null}
                  </span>
                );
              })}
            </div>
            <span className="gr-xlabel">
              <Rt text={l} ctx={ctx} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

const SECTOR_CLASSES = [
  'gr-sec--a',
  'gr-sec--b',
  'gr-sec--c',
  'gr-sec--d',
  'gr-sec--e',
  'gr-sec--f',
];
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

/** 円グラフ・帯グラフ（読むだけ。割合の目盛り: 1%、5%、10% ごとに数字） */
function RatioChart({ item, ctx }: { item: GraphItem; ctx: RenderCtx }) {
  const d = item.data;
  let acc = 0;
  const parts = d.values.map((v, i) => {
    const from = acc;
    acc += v;
    return { from, to: acc, i };
  });
  const legend = (
    <ol className="gr-legend">
      {d.labels.map((l, i) => (
        <li key={i}>
          <span className={`gr-swatch ${SECTOR_CLASSES[i % SECTOR_CLASSES.length]}`}>
            {CIRCLED[i] ?? i + 1}
          </span>
          <Rt text={l} ctx={ctx} />
        </li>
      ))}
    </ol>
  );
  if (d.kind === 'band') {
    const BW = 900;
    const X = (p: number) => 20 + (p / 100) * (BW - 40);
    const ticks = [];
    for (let p = 0; p <= 100; p++) {
      const len = p % 10 === 0 ? 22 : p % 5 === 0 ? 14 : 7;
      ticks.push(<line key={p} x1={X(p)} y1={130} x2={X(p)} y2={130 + len} className="gr-rtick" />);
      if (p % 10 === 0)
        ticks.push(
          <text key={`t${p}`} x={X(p)} y={180} className="gr-rlabel">
            {p}
          </text>,
        );
    }
    return (
      <div className="gr-ratio gr-ratio--band">
        <svg
          viewBox={`0 0 ${BW} 200`}
          className="mk-svg gr-band"
          role="img"
          aria-label="おびグラフ"
        >
          {parts.map((p) => (
            <g key={p.i}>
              <rect
                x={X(p.from)}
                y={30}
                width={X(p.to) - X(p.from)}
                height={90}
                className={`gr-sec ${SECTOR_CLASSES[p.i % SECTOR_CLASSES.length]}`}
              />
              <text x={(X(p.from) + X(p.to)) / 2} y={86} className="gr-secno">
                {CIRCLED[p.i] ?? p.i + 1}
              </text>
            </g>
          ))}
          <line x1={X(0)} y1={130} x2={X(100)} y2={130} className="gr-rtick" />
          {ticks}
        </svg>
        {legend}
      </div>
    );
  }
  const R = 120;
  const P = (pct: number, r: number) => {
    const a = ((pct / 100) * 360 - 90) * (Math.PI / 180);
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  };
  const ticks = [];
  for (let p = 0; p < 100; p++) {
    const len = p % 10 === 0 ? 16 : p % 5 === 0 ? 10 : 5;
    const a = P(p, R);
    const b = P(p, R + len);
    ticks.push(<line key={p} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="gr-rtick" />);
    if (p % 10 === 0) {
      const t = P(p, R + 32);
      ticks.push(
        <text key={`t${p}`} x={t.x} y={t.y + 7} className="gr-rlabel">
          {p}
        </text>,
      );
    }
  }
  return (
    <div className="gr-ratio">
      <svg viewBox="-170 -170 340 340" className="mk-svg gr-pie" role="img" aria-label="えんグラフ">
        {parts.map((p) => {
          const a = P(p.from, R);
          const b = P(p.to, R);
          const large = p.to - p.from > 50 ? 1 : 0;
          const mid = P((p.from + p.to) / 2, R * 0.62);
          const path =
            p.to - p.from >= 100 - EPS
              ? `M 0 ${-R} A ${R} ${R} 0 1 1 -0.01 ${-R} Z`
              : `M 0 0 L ${a.x} ${a.y} A ${R} ${R} 0 ${large} 1 ${b.x} ${b.y} Z`;
          return (
            <g key={p.i}>
              <path d={path} className={`gr-sec ${SECTOR_CLASSES[p.i % SECTOR_CLASSES.length]}`} />
              <text x={mid.x} y={mid.y + 9} className="gr-secno">
                {CIRCLED[p.i] ?? p.i + 1}
              </text>
            </g>
          );
        })}
        {ticks}
      </svg>
      {legend}
    </div>
  );
}

function DataTable({ d, ctx, hideValues }: { d: GraphData; ctx: RenderCtx; hideValues?: boolean }) {
  return (
    <table className="gr-table">
      {d.header ? (
        <thead>
          <tr>
            <th>
              <Rt text={d.header[0]} ctx={ctx} />
            </th>
            <th>
              <Rt text={d.header[1]} ctx={ctx} />
            </th>
          </tr>
        </thead>
      ) : null}
      <tbody>
        {d.labels.map((l, i) => (
          <tr key={i}>
            <td>
              <Rt text={l} ctx={ctx} />
            </td>
            <td>{hideValues ? '' : fmt(d.values[i]!)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 読む問題の図 */
function ReadChart({ item, ctx }: { item: GraphItem; ctx: RenderCtx }) {
  const d = item.data;
  const head = (
    <>
      {d.title ? (
        <div className="gr-title">
          <Rt text={d.title} ctx={ctx} />
        </div>
      ) : null}
      {d.unit && d.kind !== 'table' && d.kind !== 'pie' && d.kind !== 'band' ? (
        <div className="gr-unit">
          （<Rt text={d.unit} ctx={ctx} />）
        </div>
      ) : null}
    </>
  );
  switch (d.kind) {
    case 'table':
      return (
        <div className="gr-chart">
          {head}
          <DataTable d={d} ctx={ctx} />
        </div>
      );
    case 'pie':
    case 'band':
      return (
        <div className="gr-chart">
          {head}
          <RatioChart item={item} ctx={ctx} />
        </div>
      );
    case 'picture':
      return (
        <div className="gr-chart">
          {head}
          <PictureChart
            item={item}
            ctx={ctx}
            values={d.values}
            ghost={null}
            selected={null}
            wrongCols={new Set()}
          />
        </div>
      );
    default:
      return (
        <div className="gr-chart">
          {head}
          <div className="gr-xy">
            <XYChart
              item={item}
              values={d.values}
              ghost={null}
              selected={null}
              wrongCols={new Set()}
            />
            <XLabels labels={d.labels} ctx={ctx} />
          </div>
        </div>
      );
  }
}

function GraphView(props: KitProps<GraphItem, GraphResponse>) {
  const t = props.item.task;
  if (t.kind === 'make') return <MakeView {...props} />;
  if (t.kind === 'number') return <NumberReadView {...props} />;
  return <ChoiceReadView {...props} />;
}

function ChoiceReadView({
  item,
  ctx,
  revealed,
  wrongMark,
  disabled,
  submit,
}: KitProps<GraphItem, GraphResponse>) {
  const t = item.task as Extract<GraphTask, { kind: 'choice' }>;
  const [picked, setPicked] = useState<number[]>([]);
  const wrong = new Set(Array.isArray(wrongMark) ? (wrongMark as number[]) : []);
  const stateOf = (i: number): TapState => {
    if (revealed && t.options[i]!.correct) return 'correct';
    if (wrong.has(i)) return 'wrong';
    if (t.multi && picked.includes(i)) return 'selected';
    return null;
  };
  const press = (i: number) => {
    if (disabled || revealed) return;
    if (!t.multi) submit({ pick: [i] });
    else setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  };
  return (
    <div className="mk eng-graph">
      <div className="mk__main">
        <ReadChart item={item} ctx={ctx} />
      </div>
      <div
        className="eng-graph__options"
        style={{ gridTemplateColumns: t.options.length > 3 ? 'repeat(2, auto)' : 'auto' }}
      >
        {t.options.map((o, i) => (
          <Choice
            key={i}
            label={o.label !== undefined ? plainText(o.label) : `${i + 1}ばん`}
            state={stateOf(i)}
            disabled={disabled || revealed}
            onPress={() => press(i)}
            testId={`opt-${i}`}
            className="eng-graph__opt"
          >
            {o.figure ? <Figure fig={o.figure} ctx={ctx} /> : null}
            {o.label !== undefined ? (
              <span className="eng-graph__optlabel">
                <Rt text={o.label} ctx={ctx} />
              </span>
            ) : null}
          </Choice>
        ))}
        {t.multi && !revealed ? (
          <button
            type="button"
            className="mk-btn mk-btn--ok"
            disabled={disabled || picked.length === 0}
            onClick={() => submit({ pick: picked })}
            data-testid="check"
          >
            こたえあわせ
          </button>
        ) : null}
      </div>
    </div>
  );
}

function NumberReadView({
  item,
  ctx,
  revealed,
  wrongMark,
  disabled,
  submit,
}: KitProps<GraphItem, GraphResponse>) {
  const t = item.task as Extract<GraphTask, { kind: 'number' }>;
  const locked = disabled || revealed;
  const entry = useNumEntry(t.fields.length, locked);
  return (
    <div className="mk eng-graph">
      <div className="mk__main eng-graph__nummain">
        <ReadChart item={item} ctx={ctx} />
        <NumFields
          entry={entry}
          fields={t.fields.map((f) => ({ label: f.label }))}
          ctx={ctx}
          wrong={!!wrongMark}
          revealed={revealed}
          answers={t.fields.map((f) =>
            graphAnswerText({ ...item, task: { ...t, fields: [{ ...f, label: undefined }] } }),
          )}
        />
      </div>
      <NumKeys
        entry={entry}
        keys={t.keys}
        disabled={locked}
        onSubmit={() => submit({ fields: entry.vals })}
      />
    </div>
  );
}

function MakeView({
  item,
  ctx,
  revealed,
  wrongMark,
  disabled,
  submit,
}: KitProps<GraphItem, GraphResponse>) {
  const t = item.task as Extract<GraphTask, { kind: 'make' }>;
  const d = item.data;
  const locked = disabled || revealed;
  const ax = axisOf(d);
  const snap = d.kind === 'picture' ? ax.step : (t.snap ?? ax.step);
  const [values, setValues] = useState<(number | null)[]>(
    () => t.initial ?? d.values.map(() => (d.kind === 'line' ? null : 0)),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const wrongCols = new Set(!revealed && Array.isArray(wrongMark) ? (wrongMark as number[]) : []);
  const setAt = (col: number, v: number) => {
    if (locked) return;
    setSelected(col);
    setValues((vs) => vs.map((x, i) => (i === col ? v : x)));
  };
  const nudge = (dir: number) => {
    if (locked || selected === null) return;
    const cur = values[selected] ?? ax.min;
    const next = Math.round(Math.max(ax.min, Math.min(ax.max, cur + dir * snap)) * 1e9) / 1e9;
    setAt(selected, next);
  };
  const ghost = revealed ? d.values : null;
  return (
    <div className="mk eng-graph eng-graph--make">
      <div className="mk__main eng-graph__makemain">
        {t.showTable !== false ? <DataTable d={d} ctx={ctx} /> : null}
        <div className="gr-chart">
          {d.unit ? (
            <div className="gr-unit">
              （<Rt text={d.unit} ctx={ctx} />）
            </div>
          ) : null}
          {d.kind === 'picture' ? (
            <PictureChart
              item={item}
              ctx={ctx}
              values={values.map((v) => v ?? 0)}
              ghost={ghost}
              selected={selected}
              wrongCols={wrongCols}
              onTap={locked ? undefined : setAt}
            />
          ) : (
            <div className="gr-xy">
              <XYChart
                item={item}
                values={values}
                ghost={ghost}
                selected={locked ? null : selected}
                wrongCols={wrongCols}
                onTap={locked ? undefined : setAt}
              />
              <XLabels
                labels={d.labels}
                ctx={ctx}
                selected={selected}
                onSelect={locked ? undefined : setSelected}
              />
            </div>
          )}
        </div>
      </div>
      <div className="mk__side eng-graph__side">
        <div className="mk-row">
          <button
            type="button"
            className="mk-btn"
            onClick={() => nudge(-1)}
            disabled={locked || selected === null}
            aria-label="ひとめもり さげる"
            data-testid="nudge-down"
          >
            ▼
          </button>
          <button
            type="button"
            className="mk-btn"
            onClick={() => nudge(1)}
            disabled={locked || selected === null}
            aria-label="ひとめもり あげる"
            data-testid="nudge-up"
          >
            ▲
          </button>
        </div>
        <button
          type="button"
          className="mk-btn mk-btn--ok"
          onClick={() => submit({ values })}
          disabled={locked || (d.kind === 'line' && values.some((v) => v === null))}
          data-testid="check"
        >
          こたえあわせ
        </button>
      </div>
    </div>
  );
}

/** 問題データの中の、子供に見せる文（よみの検査用。qa.ts の textsOf に加える） */
export function graphTexts(item: GraphItem): RichText[] {
  const d = item.data;
  const t: RichText[] = [...d.labels, ...(d.header ?? [])];
  if (d.unit) t.push(d.unit);
  if (d.title) t.push(d.title);
  if (item.task.kind === 'choice') for (const o of item.task.options) if (o.label) t.push(o.label);
  if (item.task.kind === 'number') for (const f of item.task.fields) if (f.label) t.push(f.label);
  return t;
}

export const graphEngine: KitEngineDef<GraphItem, GraphResponse> = {
  id: 'graph',
  Component: GraphView,
  judge: judgeGraph,
  check: checkGraph,
  answerText: graphAnswerText,
};
