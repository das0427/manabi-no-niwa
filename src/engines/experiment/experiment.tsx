/**
 * experiment エンジン: 実験のシミュレーション（理科。curriculum-matrix 2.6）。
 * 条件の値を札で選ぶ →「やってみる」で例示の結果（model.ts の単純な式・問題データの固定表）→ 結果の表に記録 → 設問。
 * 画面に「この アプリの せっていでは」と出し、実際の実験の代わりではないことを示す。
 *
 * 設問（task）:
 *  consider … 考察の設問（choice と同じ判定）。minTrials 回やってみると「こたえる」が押せる
 *  reach    … 結果が target になる条件を作って答える（てこをつり合わせる・モーターを速く回す など）
 *  control  … 条件制御: factor だけを変えた2回の実験を記録して答える（2つ以上を同時に変えると誤り）
 */
import { useState } from 'react';
import type { ChoiceOption, ItemBase, RichText } from '../../curriculum/types';
import { Rt } from '../../text/Rt';
import { plainText } from '../../text/rich';
import { Choice } from '../../ui/Choice';
import type { TapState } from '../../ui/Tap';
import { checkChoice } from '../choice/choice';
import { Figure } from '../figure/Figure';
import type { KitEngineDef, KitProps } from '../numberline/kit';
import { kanjiErrors } from '../order/shared';
import type { Judgement } from '../types';
import { Apparatus } from './Apparatus';
import {
  allConds,
  condKey,
  diffFactors,
  factorActive,
  factorsOf,
  initialCond,
  resultKeys,
  resultOf,
  type Cond,
  type CondValue,
  type ExpSetup,
} from './model';
import '../numberline/numpad.css';
import './experiment.css';

export type { Cond, CondValue, ExpSetup, TableFactor, TableRow } from './model';

export type ExpTask =
  | {
      kind: 'consider';
      /** 考察の選択肢（choice と同じ） */
      options: ChoiceOption[];
      multi?: boolean;
      /** この回数やってみると答えられる（既定 2） */
      minTrials?: number;
    }
  | {
      kind: 'reach';
      /** 作る結果（model の結果の key: てこ 'balance'、豆電球 'bright'、ふりこ '1.4' など） */
      target: string;
    }
  | {
      kind: 'control';
      /** この因子だけを変えた2回の実験を記録する */
      factor: string;
    };

export type ExpMis =
  /** てこ: 位置を考えず、重さだけをそろえた */
  | 'weightOnly'
  /** てこ: 重さを考えず、位置だけをそろえた */
  | 'distanceOnly'
  /** 回路: 直列と並列を取り違えた */
  | 'seriesParallel'
  /** 条件制御: 2つ以上の条件を同時に変えた */
  | 'changedMany'
  /** 条件制御: 調べる条件を変えていない */
  | 'notChanged';

export interface ExperimentItem extends ItemBase {
  engine: 'experiment';
  setup: ExpSetup;
  task: ExpTask;
  /** はじめの条件（省略時は各因子の最初の値） */
  initial?: Cond;
  misconceptions?: Partial<Record<ExpMis, string>>;
  /** reach: この条件（の一部）で答えたときの誤概念 */
  wrongConditions?: { when: Cond; misconception: string }[];
}

/** consider: 選んだ番号、reach: 答えた条件、control: 記録した実験の条件（順に） */
export type ExperimentResponse = { pick: number[] } | { cond: Cond } | { trials: Cond[] };

export const MIN_TRIALS_DEFAULT = 2;
export const NOTE: RichText =
  'この アプリの せっていでは こう なるよ（じっけんの かわりでは ないよ）';

// ---- 判定 ----

const matches = (when: Cond, c: Cond) => Object.entries(when).every(([k, v]) => c[k] === v);

function reachMis(item: ExperimentItem, c: Cond, target: string): string | undefined {
  const known = item.wrongConditions?.find((w) => matches(w.when, c));
  if (known) return known.misconception;
  const m = item.misconceptions ?? {};
  const s = item.setup;
  if (s.kind === 'lever') {
    if (c.leftWeight === c.rightWeight && c.leftPos !== c.rightPos) return m.weightOnly;
    if (c.leftPos === c.rightPos && c.leftWeight !== c.rightWeight) return m.distanceOnly;
  }
  if (s.kind === 'circuit' && c.cells === 2) {
    const other = { ...c, connection: c.connection === 'series' ? 'parallel' : 'series' };
    if (resultOf(s, other)?.key === target) return m.seriesParallel;
  }
  return undefined;
}

export function judgeExperiment(item: ExperimentItem, res: ExperimentResponse): Judgement {
  const t = item.task;
  const s = item.setup;
  if (t.kind === 'consider') {
    if (!('pick' in res) || res.pick.length === 0)
      return { result: 'retry', message: 'こたえを えらぼう。' };
    const correct = t.options.flatMap((o, i) => (o.correct ? [i] : []));
    const a = [...new Set(res.pick)].sort((x, y) => x - y);
    if (!t.multi) {
      const i = a[0]!;
      if (t.options[i]?.correct) return { result: 'correct' };
      return { result: 'wrong', misconception: t.options[i]?.misconception, mark: [i] };
    }
    if (a.length === correct.length && a.every((v, i) => v === correct[i]))
      return { result: 'correct' };
    const w = a.find((i) => !t.options[i]?.correct);
    return {
      result: 'wrong',
      misconception: w !== undefined ? t.options[w]?.misconception : undefined,
      mark: w !== undefined ? [w] : [],
    };
  }
  if (t.kind === 'reach') {
    if (!('cond' in res)) return { result: 'retry', message: 'じょうけんを えらんで こたえよう。' };
    const r = resultOf(s, res.cond);
    if (r && r.key === t.target) return { result: 'correct' };
    return { result: 'wrong', misconception: reachMis(item, res.cond, t.target), mark: true };
  }
  if (!('trials' in res) || res.trials.length < 2)
    return { result: 'retry', message: '2かい いじょう やってみてから こたえよう。' };
  const m = item.misconceptions ?? {};
  let changedWithOthers = false;
  for (let i = 0; i < res.trials.length; i++)
    for (let j = i + 1; j < res.trials.length; j++) {
      const d = diffFactors(s, res.trials[i]!, res.trials[j]!);
      if (d.length === 1 && d[0] === t.factor) return { result: 'correct' };
      if (d.includes(t.factor)) changedWithOthers = true;
    }
  return {
    result: 'wrong',
    misconception: changedWithOthers ? m.changedMany : m.notChanged,
    mark: true,
  };
}

// ---- 検査 ----

function setupErrors(s: ExpSetup): string[] {
  const errs: string[] = [];
  const nums = (xs: number[], what: string, ok: (v: number) => boolean) => {
    if (xs.length === 0) errs.push(`${what}の候補が無い`);
    if (new Set(xs).size !== xs.length) errs.push(`${what}の候補が重複している`);
    for (const v of xs) if (!ok(v)) errs.push(`${what} ${v} が範囲外`);
  };
  switch (s.kind) {
    case 'pendulum':
      nums(s.length, '長さ', (v) => v > 0 && v <= 300);
      nums(s.weight, '重さ', (v) => v > 0 && v <= 1000);
      nums(s.amplitude, '振れ幅', (v) => v >= 1 && v <= 45);
      break;
    case 'lever':
      for (const k of ['leftPos', 'rightPos'] as const)
        nums(s[k], '位置', (v) => Number.isInteger(v) && v >= 1 && v <= 6);
      for (const k of ['leftWeight', 'rightWeight'] as const)
        nums(s[k], '重さ', (v) => v > 0 && v <= 600);
      break;
    case 'circuit':
      nums(s.cells, '乾電池の数', (v) => v === 1 || v === 2);
      if (s.connection.length === 0) errs.push('つなぎ方の候補が無い');
      if (s.cells.includes(2) && s.connection.length === 0) errs.push('2個のつなぎ方が無い');
      if (s.direction && s.device !== 'motor') errs.push('電池の向きはモーターのときだけ');
      break;
    case 'table': {
      if (s.factors.length === 0) errs.push('因子が無い');
      const ids = s.factors.map((f) => f.id);
      if (new Set(ids).size !== ids.length) errs.push('因子の id が重複している');
      for (const f of s.factors) {
        if (f.values.length === 0) errs.push(`因子 ${f.id} の値が無い`);
        if (new Set(f.values.map((v) => v.id)).size !== f.values.length)
          errs.push(`因子 ${f.id} の値の id が重複している`);
        errs.push(...kanjiErrors([f.label, ...f.values.map((v) => v.label)]));
      }
      errs.push(...kanjiErrors([s.output, ...s.rows.map((r) => r.result)]));
      for (const r of s.rows)
        for (const [k, v] of Object.entries(r.when)) {
          const f = s.factors.find((x) => x.id === k);
          if (!f) errs.push(`表の行の因子 ${k} が無い`);
          else if (!f.values.some((x) => x.id === v)) errs.push(`表の行の値 ${k}=${v} が無い`);
        }
      for (const c of allConds(s)) {
        const n = s.rows.filter((r) => s.factors.every((f) => r.when[f.id] === c[f.id])).length;
        if (n !== 1) errs.push(`条件 ${condKey(s, c)} の行が${n === 0 ? '無い' : '2つ以上ある'}`);
      }
      break;
    }
  }
  return errs;
}

export function checkExperiment(item: ExperimentItem): string[] {
  const s = item.setup;
  const errs = setupErrors(s);
  if (errs.length) return errs;
  const fs = factorsOf(s);
  for (const [k, v] of Object.entries(item.initial ?? {})) {
    const f = fs.find((x) => x.id === k);
    if (!f) errs.push(`はじめの条件の因子 ${k} が無い`);
    else if (!f.values.some((x) => x.v === v)) errs.push(`はじめの条件 ${k}=${v} が候補に無い`);
  }
  const t = item.task;
  const conds = allConds(s);
  if (t.kind === 'consider') {
    errs.push(
      ...checkChoice({ ...item, engine: 'choice', options: t.options, multi: t.multi }),
      ...kanjiErrors(t.options.map((o) => o.label)),
    );
    const min = t.minTrials ?? MIN_TRIALS_DEFAULT;
    if (min < 0 || min > conds.length) errs.push(`minTrials は 0〜${conds.length}`);
  }
  if (t.kind === 'reach') {
    if (!resultKeys(s).has(t.target)) errs.push(`結果 ${t.target} になる条件が無い`);
    if (resultOf(s, initialCond(s, item.initial))?.key === t.target)
      errs.push('はじめの条件で、もう結果が target になっている');
    for (const w of item.wrongConditions ?? []) {
      const hit = conds.filter((c) => matches(w.when, c));
      if (hit.length === 0) errs.push(`誤りの条件 ${JSON.stringify(w.when)} に当てはまる組が無い`);
      if (hit.some((c) => resultOf(s, c)?.key === t.target))
        errs.push(`誤りの条件 ${JSON.stringify(w.when)} に正解の組が含まれる`);
    }
  }
  if (t.kind === 'control') {
    const f = fs.find((x) => x.id === t.factor);
    if (!f) errs.push(`調べる因子 ${t.factor} が無い`);
    else if (f.values.length < 2)
      errs.push(`調べる因子 ${t.factor} の値が1つしかない（変えられない）`);
    if (fs.filter((x) => x.values.length >= 2).length < 2)
      errs.push('変えられる因子が1つだけ（条件制御の問題にならない）');
  }
  if (t.kind !== 'reach' && item.wrongConditions?.length)
    errs.push('wrongConditions は reach の問題だけ');
  return errs;
}

// ---- 正答の文 ----

/** reach の正答の例（はじめの条件から変える因子が少ない組） */
export function reachExample(item: ExperimentItem): Cond | null {
  const t = item.task;
  if (t.kind !== 'reach') return null;
  const s = item.setup;
  const init = initialCond(s, item.initial);
  const ok = allConds(s).filter((c) => resultOf(s, c)?.key === t.target);
  ok.sort((a, b) => diffFactors(s, init, a).length - diffFactors(s, init, b).length);
  return ok[0] ?? null;
}

function condText(s: ExpSetup, c: Cond): RichText {
  return factorsOf(s)
    .filter((f) => f.values.length > 1 && factorActive(s, f.id, c))
    .map((f) => `${f.label} ${f.values.find((x) => x.v === c[f.id])?.label ?? c[f.id]}`)
    .join('、');
}

export function experimentAnswerText(item: ExperimentItem): RichText {
  const t = item.task;
  if (t.kind === 'consider')
    return t.options
      .filter((o) => o.correct)
      .map((o) => o.label ?? '')
      .join('、');
  if (t.kind === 'reach') {
    const c = reachExample(item);
    return c ? condText(item.setup, c) : '';
  }
  const f = factorsOf(item.setup).find((x) => x.id === t.factor);
  return f ? `${f.label}だけを かえて、ほかの じょうけんは おなじに する` : '';
}

// ---- 画面 ----

type View = KitProps<ExperimentItem, ExperimentResponse>;

interface Trial {
  cond: Cond;
  key: string;
  text: RichText;
}

function FactorControl({
  f,
  value,
  active,
  disabled,
  onChange,
  ctx,
}: {
  f: ReturnType<typeof factorsOf>[number];
  value: CondValue;
  active: boolean;
  disabled: boolean;
  onChange: (v: CondValue) => void;
  ctx: View['ctx'];
}) {
  const fixed = f.values.length <= 1;
  const idx = Math.max(
    0,
    f.values.findIndex((x) => x.v === value),
  );
  const cur = f.values[idx];
  return (
    <div
      className={`exp-factor${active ? '' : ' is-inactive'}`}
      role="group"
      aria-label={plainText(f.label)}
    >
      <span className="exp-factor__label">
        <Rt text={f.label} ctx={ctx} />
      </span>
      {fixed || !active ? (
        <span className="exp-factor__fixed">
          {active && cur ? <Rt text={cur.label} ctx={ctx} /> : '−'}
        </span>
      ) : f.values.length <= 3 ? (
        <span className="exp-factor__seg">
          {f.values.map((x, i) => (
            <button
              key={String(x.v)}
              type="button"
              className={`mk-btn exp-val${x.v === value ? ' is-on' : ''}`}
              aria-pressed={x.v === value}
              disabled={disabled}
              onClick={() => onChange(x.v)}
              data-testid={`val-${f.id}-${i}`}
            >
              <Rt text={x.label} ctx={ctx} />
            </button>
          ))}
        </span>
      ) : (
        <span className="exp-factor__step">
          <button
            type="button"
            className="mk-btn exp-arrow"
            aria-label="まえの あたい"
            disabled={disabled || idx === 0}
            onClick={() => onChange(f.values[idx - 1]!.v)}
            data-testid={`prev-${f.id}`}
          >
            ◀
          </button>
          <span className="exp-factor__value">
            {cur ? <Rt text={cur.label} ctx={ctx} /> : null}
          </span>
          <button
            type="button"
            className="mk-btn exp-arrow"
            aria-label="つぎの あたい"
            disabled={disabled || idx >= f.values.length - 1}
            onClick={() => onChange(f.values[idx + 1]!.v)}
            data-testid={`next-${f.id}`}
          >
            ▶
          </button>
        </span>
      )}
    </div>
  );
}

function ResultTable({
  setup,
  output,
  trials,
  ctx,
  last,
}: {
  setup: ExpSetup;
  output: RichText;
  trials: Trial[];
  ctx: View['ctx'];
  last: boolean;
}) {
  const fs = factorsOf(setup).filter((f) => f.values.length > 1);
  const shown = trials.slice(-3);
  const offset = trials.length - shown.length;
  return (
    <table className="exp-table" data-testid="result-table">
      <thead>
        <tr>
          {fs.map((f) => (
            <th key={f.id} scope="col">
              <Rt text={f.label} ctx={ctx} />
            </th>
          ))}
          <th scope="col">
            <Rt text={output} ctx={ctx} />
          </th>
        </tr>
      </thead>
      <tbody>
        {shown.length === 0 ? (
          <tr>
            <td colSpan={fs.length + 1} className="exp-table__empty">
              まだ ない
            </td>
          </tr>
        ) : (
          shown.map((t, i) => (
            <tr key={offset + i} className={last && i === shown.length - 1 ? 'is-last' : ''}>
              {fs.map((f) => (
                <td key={f.id}>
                  {factorActive(setup, f.id, t.cond) ? (
                    <Rt
                      text={
                        f.values.find((x) => x.v === t.cond[f.id])?.label ?? String(t.cond[f.id])
                      }
                      ctx={ctx}
                    />
                  ) : (
                    '−'
                  )}
                </td>
              ))}
              <td className="exp-table__result">
                <Rt text={t.text} ctx={ctx} />
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function outputLabel(s: ExpSetup): RichText {
  switch (s.kind) {
    case 'pendulum':
      return '1おうふくの 時間《じかん》';
    case 'lever':
      return 'けっか';
    case 'circuit':
      return s.device === 'bulb' ? '明《あか》るさ' : '回《まわ》り方《かた》';
    case 'table':
      return s.output;
  }
}

function ExperimentView({ item, ctx, revealed, wrongMark, disabled, submit }: View) {
  const s = item.setup;
  const t = item.task;
  const fs = factorsOf(s);
  const locked = disabled || revealed;
  const [cond, setCond] = useState<Cond>(() => initialCond(s, item.initial));
  const [trials, setTrials] = useState<Trial[]>([]);
  const [shownResult, setShownResult] = useState<Trial | null>(null);
  const [run, setRun] = useState(0);
  const [mode, setMode] = useState<'setup' | 'answer'>('setup');
  const [picked, setPicked] = useState<number[]>([]);
  const [markRef, setMarkRef] = useState<unknown>(null);
  const wrongOpts = new Set(Array.isArray(wrongMark) ? (wrongMark as number[]) : []);
  const wrongShown = !!wrongMark && !revealed && markRef !== wrongMark;

  // 正答を見せるとき: reach は正答の例の条件と結果
  const shownCond = revealed && t.kind === 'reach' ? (reachExample(item) ?? cond) : cond;
  const shownRes =
    revealed && t.kind === 'reach'
      ? resultOf(s, shownCond)
      : shownResult && condKey(s, shownResult.cond) === condKey(s, cond)
        ? resultOf(s, cond)
        : null;

  const change = (id: string, v: CondValue) => {
    if (locked) return;
    setMarkRef(wrongMark);
    setCond((c) => ({ ...c, [id]: v }));
  };
  const tryIt = () => {
    if (locked) return;
    const r = resultOf(s, cond);
    if (!r) return;
    const tr = { cond: { ...cond }, key: r.key, text: r.text };
    setTrials((ts) => [...ts, tr]);
    setShownResult(tr);
    setRun((n) => n + 1);
    setMarkRef(wrongMark);
  };
  const minTrials = t.kind === 'consider' ? (t.minTrials ?? MIN_TRIALS_DEFAULT) : 0;
  const answering = t.kind === 'consider' && (mode === 'answer' || revealed);

  const stateOf = (i: number): TapState => {
    if (t.kind !== 'consider') return null;
    if (revealed && t.options[i]!.correct) return 'correct';
    if (wrongOpts.has(i)) return 'wrong';
    if (t.multi && picked.includes(i)) return 'selected';
    return null;
  };

  let mainButton: React.ReactNode;
  if (t.kind === 'consider') {
    mainButton =
      mode === 'setup' && !revealed ? (
        <button
          type="button"
          className="mk-btn mk-btn--ok"
          onClick={() => setMode('answer')}
          disabled={locked || trials.length < minTrials}
          data-testid="to-answer"
        >
          こたえる
        </button>
      ) : !revealed ? (
        <div className="mk-row">
          <button
            type="button"
            className="mk-btn"
            onClick={() => setMode('setup')}
            disabled={locked}
            data-testid="to-setup"
          >
            じっけんに
            <br />
            もどる
          </button>
          {t.multi ? (
            <button
              type="button"
              className="mk-btn mk-btn--ok"
              onClick={() => submit({ pick: picked })}
              disabled={locked || picked.length === 0}
              data-testid="check"
            >
              こたえあわせ
            </button>
          ) : null}
        </div>
      ) : null;
  } else if (!revealed) {
    mainButton = (
      <button
        type="button"
        className="mk-btn mk-btn--ok"
        onClick={() =>
          submit(t.kind === 'reach' ? { cond } : { trials: trials.map((x) => x.cond) })
        }
        disabled={locked || (t.kind === 'control' && trials.length < 2)}
        data-testid="check"
      >
        {t.kind === 'reach' ? 'これで こたえる' : 'こたえあわせ'}
      </button>
    );
  }

  return (
    <div className="exp">
      <div className="exp__stage">
        <div className={`exp__apparatus${wrongShown && t.kind === 'reach' ? ' mk-wrong' : ''}`}>
          {s.kind === 'table' ? (
            <div className="exp-card" role="img" aria-label="けっか">
              {shownRes?.figure ? <Figure fig={shownRes.figure} ctx={ctx} /> : null}
              <span className="exp-card__text">
                {shownRes ? <Rt text={shownRes.text} ctx={ctx} /> : 'やってみよう'}
              </span>
            </div>
          ) : (
            <Apparatus setup={s} cond={shownCond} result={shownRes} run={run} />
          )}
        </div>
        {!revealed ? (
          <button
            type="button"
            className="mk-btn mk-btn--ok exp-try"
            onClick={tryIt}
            disabled={locked || answering || !resultOf(s, cond)}
            data-testid="try"
          >
            やってみる
          </button>
        ) : null}
      </div>

      <div className="exp__panel">
        {answering && t.kind === 'consider' ? (
          <div className="exp-options">
            {t.options.map((o, i) => (
              <Choice
                key={i}
                label={o.label !== undefined ? plainText(o.label) : `${i + 1}ばん`}
                state={stateOf(i)}
                disabled={locked}
                onPress={() => {
                  if (locked) return;
                  if (!t.multi) submit({ pick: [i] });
                  else setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
                }}
                testId={`opt-${i}`}
                className="exp-opt"
              >
                {o.figure ? <Figure fig={o.figure} ctx={ctx} /> : null}
                {o.label !== undefined ? (
                  <span className="exp-opt__label">
                    <Rt text={o.label} ctx={ctx} />
                  </span>
                ) : null}
              </Choice>
            ))}
          </div>
        ) : (
          <div className="exp-factors">
            {fs.some((f) => f.values.length <= 1) ? (
              // 変えられない条件は1行にまとめる（作業領域の高さを使い切らないため）
              <p className="exp-fixed" data-testid="fixed">
                {fs
                  .filter((f) => f.values.length <= 1)
                  .map((f) => (
                    <span key={f.id} className="exp-fixed__item">
                      <Rt text={`${f.label} ${f.values[0]?.label ?? ''}`} ctx={ctx} />
                    </span>
                  ))}
              </p>
            ) : null}
            {fs
              .filter((f) => f.values.length > 1)
              .map((f) => (
                <FactorControl
                  key={f.id}
                  f={f}
                  value={shownCond[f.id] ?? ''}
                  active={factorActive(s, f.id, shownCond)}
                  disabled={locked || answering}
                  onChange={(v) => change(f.id, v)}
                  ctx={ctx}
                />
              ))}
          </div>
        )}
      </div>

      <div className="exp__record">
        <p className="exp-note" data-testid="exp-note">
          <Rt text={NOTE} ctx={ctx} />
        </p>
        <div className={`exp-tablewrap${wrongShown && t.kind === 'control' ? ' mk-wrong' : ''}`}>
          <ResultTable
            setup={s}
            output={outputLabel(s)}
            trials={trials}
            ctx={ctx}
            last={!!shownRes}
          />
        </div>
        {t.kind === 'consider' && mode === 'setup' && !revealed && trials.length < minTrials ? (
          <p className="exp-need">{`あと ${minTrials - trials.length}かい やってみよう`}</p>
        ) : null}
        {revealed && t.kind === 'control' ? (
          <p className="exp-need">
            <Rt text={experimentAnswerText(item)} ctx={ctx} />
          </p>
        ) : null}
        {mainButton}
      </div>
    </div>
  );
}

/** 問題データの中の、子供に見せる文（よみの検査用） */
export function experimentTexts(item: ExperimentItem): RichText[] {
  const out: RichText[] = factorsOf(item.setup).flatMap((f) => [
    f.label,
    ...f.values.map((v) => v.label),
  ]);
  if (item.setup.kind === 'table')
    out.push(item.setup.output, ...item.setup.rows.map((r) => r.result));
  if (item.task.kind === 'consider')
    for (const o of item.task.options) if (o.label) out.push(o.label);
  return out;
}

export const experimentEngine: KitEngineDef<ExperimentItem, ExperimentResponse> = {
  id: 'experiment',
  Component: ExperimentView,
  judge: judgeExperiment,
  check: checkExperiment,
  answerText: experimentAnswerText,
};
