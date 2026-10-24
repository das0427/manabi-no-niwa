/**
 * number エンジン: 数を入力する（1つ〜複数の欄。商とあまり、□m□cm など）。
 * 判定は有理数で正確に比べる（src/core/answer/number.ts）。形式だけの違いは誤答にせず「もう一度」。
 * 数字キーは作業領域の右側（DESINGN.md 18章、review-1 #21）。主操作の大きさ。
 */
import { useState } from 'react';
import {
  judgeNumber,
  normalizeInput,
  parseNumberInput,
  RETRY_MESSAGE,
  answerValue,
} from '../../core/answer/number';
import type { NumberItem } from '../../curriculum/types';
import { Rt } from '../../text/Rt';
import type { EngineDef, EngineProps, Judgement } from '../types';
import './number.css';

/** 欄ごとの入力文字列 */
export type NumberResponse = string[];

export function judgeNumberItem(item: NumberItem, res: NumberResponse): Judgement {
  let firstRetry: Judgement | null = null;
  let allCorrect = true;
  for (let i = 0; i < item.fields.length; i++) {
    const v = judgeNumber(item.fields[i]!.answer, res[i] ?? '');
    if (v.result === 'retry') {
      firstRetry ??= { result: 'retry', message: RETRY_MESSAGE[v.reason] };
      allCorrect = false;
    } else if (v.result === 'wrong') {
      allCorrect = false;
      firstRetry = null;
      break;
    }
  }
  if (allCorrect) return { result: 'correct' };
  // 読めない入力・形式の違いだけなら「もう一度」
  if (firstRetry) return firstRetry;
  // 誤答の例と値で比べる（"08" と "8"、"0.50" と "0.5" を同じとみる: コードレビュー #16）
  const known = item.wrongAnswers?.find((w) => {
    const parts = w.value.split('|');
    return parts.length === res.length && parts.every((p, i) => sameValue(p, res[i] ?? ''));
  });
  return { result: 'wrong', misconception: known?.misconception, mark: true };
}

function sameValue(a: string, b: string): boolean {
  const pa = parseNumberInput(a);
  const pb = parseNumberInput(b);
  if (pa && pb) return pa.value.n === pb.value.n && pa.value.d === pb.value.d;
  return normalizeInput(a) === normalizeInput(b);
}

export function checkNumberItem(item: NumberItem): string[] {
  const errs: string[] = [];
  if (item.fields.length === 0) errs.push('入力欄が無い');
  const fnCount =
    (item.keys?.includes('decimal') ? 1 : 0) +
    (item.keys?.includes('fraction') ? 2 : 0) +
    (item.keys?.includes('minus') ? 1 : 0);
  if (fnCount > 3) errs.push('記号のキーは3つまで（小数点・分数・マイナスを同時に使わない）');
  for (const f of item.fields) {
    const a = f.answer;
    if (a.kind === 'fraction' && a.den === 0) errs.push('分母が0');
    if (a.kind === 'fraction' && !item.keys?.includes('fraction'))
      errs.push('分数の答えなのに分数キーが無い');
    if (
      (a.kind === 'decimal' || (a.kind === 'quantity' && !Number.isInteger(a.value))) &&
      !item.keys?.includes('decimal')
    )
      errs.push('小数の答えなのに小数点キーが無い');
    const v = answerValue(a);
    if (v.n < 0 && !item.keys?.includes('minus')) errs.push('負の答えなのにマイナスキーが無い');
  }
  for (const w of item.wrongAnswers ?? []) {
    const parts = w.value.split('|');
    if (parts.length !== item.fields.length) {
      errs.push(`誤答の例 ${w.value} の欄の数が違う`);
      continue;
    }
    if (judgeNumberItem(item, parts).result === 'correct')
      errs.push(`誤答の例 ${w.value} が正解と判定される`);
  }
  return errs;
}

export function answerTextOf(item: NumberItem): string {
  return item.fields
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
}

/** 入力中の文字列の表示（分数は縦に） */
function Shown({ s }: { s: string }) {
  const p = parseNumberInput(s);
  if (p && (p.form === 'fraction' || p.form === 'mixed') && p.raw) {
    const m = /^(-?)(?:(\d+)\s*(?:と|\s)\s*)?(\d+)\/(\d+)$/.exec(normalizeInput(s));
    if (m)
      return (
        <span className="num-frac-show">
          {m[1]}
          {m[2] ? <span className="num-frac-show__w">{m[2]}</span> : null}
          <span className="num-frac-show__f">
            <span>{m[3]}</span>
            <span>{m[4]}</span>
          </span>
        </span>
      );
  }
  return <>{s.replace(/\//g, '／').replace(/ /g, 'と')}</>;
}

function NumberView({
  item,
  ctx,
  revealed,
  wrongMark,
  disabled,
  submit,
}: EngineProps<NumberItem, NumberResponse>) {
  const [vals, setVals] = useState<string[]>(() => item.fields.map(() => ''));
  const [active, setActive] = useState(0);
  const keys = item.keys ?? [];
  const put = (ch: string) => {
    if (disabled || revealed) return;
    setVals((v) => {
      const next = [...v];
      const cur = next[active] ?? '';
      if (ch === 'back') next[active] = cur.slice(0, -1);
      else if (cur.length < 12) next[active] = cur + ch;
      return next;
    });
  };
  const ready = vals.every((v) => v.trim() !== '');
  const key = (ch: string, text: string, label: string, testId: string, cls = '') => (
    <button
      key={testId}
      type="button"
      className={`numkey ${cls}`}
      onClick={() => put(ch)}
      disabled={disabled || revealed}
      aria-label={label}
      data-testid={testId}
    >
      {text}
    </button>
  );
  const digit = (d: string) => key(d, d, d, `key-${d}`);
  // 問題で使う記号のキー（最大3つ。右の列に入る）
  const fns = [
    keys.includes('decimal') ? key('.', '.', 'しょうすうてん', 'key-dot') : null,
    keys.includes('fraction') ? key('/', '／', 'ぶんすう', 'key-frac') : null,
    keys.includes('fraction') ? key(' ', 'と', 'たいぶんすうの と', 'key-mixed') : null,
    keys.includes('minus') ? key('-', '−', 'マイナス', 'key-minus') : null,
  ].filter((x) => x !== null);
  return (
    <div className="eng-number">
      <div className="eng-number__fields">
        {item.fields.map((f, i) => (
          <label key={i} className="eng-number__field">
            {f.label ? (
              <span className="eng-number__label">
                <Rt text={f.label} ctx={ctx} />
              </span>
            ) : null}
            <button
              type="button"
              className={[
                'eng-number__box',
                i === active ? 'is-active' : '',
                wrongMark && !revealed ? 'is-wrong' : '',
                revealed ? 'is-revealed' : '',
              ].join(' ')}
              onClick={() => setActive(i)}
              aria-label={`${i + 1}ばんめの こたえ ${vals[i] || 'から'}`}
              data-testid={`field-${i}`}
            >
              {revealed ? (
                <Rt
                  text={answerTextOf({ ...item, fields: [{ ...f, label: undefined }] })}
                  ctx={ctx}
                />
              ) : (
                <Shown s={vals[i] ?? ''} />
              )}
            </button>
          </label>
        ))}
      </div>
      {/* 4列×4段（作業領域の右側に収める。右下の「つぎへ」と重ならない: DESINGN.md 18章） */}
      <div className="eng-number__pad" role="group" aria-label="すうじの キー">
        {['7', '8', '9'].map(digit)}
        {key('back', 'けす', 'ひとつ けす', 'key-back', 'numkey--fn')}
        {['4', '5', '6'].map(digit)}
        {fns[0] ?? <span />}
        {['1', '2', '3'].map(digit)}
        {fns[1] ?? <span />}
        {digit('0')}
        {fns[2] ?? <span />}
        <button
          type="button"
          className="numkey numkey--ok"
          onClick={() => submit(vals)}
          disabled={disabled || revealed || !ready}
          data-testid="check"
        >
          こたえあわせ
        </button>
      </div>
    </div>
  );
}

export const numberEngine: EngineDef<NumberItem, NumberResponse> = {
  id: 'number',
  Component: NumberView,
  judge: judgeNumberItem,
  check: checkNumberItem,
  answerText: answerTextOf,
};
