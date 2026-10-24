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
  const joined = res.map((s) => normalizeInput(s)).join('|');
  const known = item.wrongAnswers?.find((w) => normalizeInput(w.value) === joined);
  return { result: 'wrong', misconception: known?.misconception, mark: true };
}

export function checkNumberItem(item: NumberItem): string[] {
  const errs: string[] = [];
  if (item.fields.length === 0) errs.push('入力欄が無い');
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
      <div className="eng-number__pad" role="group" aria-label="すうじの キー">
        {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0'].map((d) => (
          <button
            key={d}
            type="button"
            className="numkey"
            onClick={() => put(d)}
            disabled={disabled || revealed}
            data-testid={`key-${d}`}
          >
            {d}
          </button>
        ))}
        {keys.includes('decimal') ? (
          <button
            type="button"
            className="numkey"
            onClick={() => put('.')}
            disabled={disabled || revealed}
            aria-label="しょうすうてん"
            data-testid="key-dot"
          >
            .
          </button>
        ) : null}
        {keys.includes('fraction') ? (
          <>
            <button
              type="button"
              className="numkey"
              onClick={() => put('/')}
              disabled={disabled || revealed}
              aria-label="ぶんすう"
              data-testid="key-frac"
            >
              ／
            </button>
            <button
              type="button"
              className="numkey"
              onClick={() => put(' ')}
              disabled={disabled || revealed}
              aria-label="たいぶんすうの と"
              data-testid="key-mixed"
            >
              と
            </button>
          </>
        ) : null}
        {keys.includes('minus') ? (
          <button
            type="button"
            className="numkey"
            onClick={() => put('-')}
            disabled={disabled || revealed}
            aria-label="マイナス"
          >
            −
          </button>
        ) : null}
        <button
          type="button"
          className="numkey numkey--fn"
          onClick={() => put('back')}
          disabled={disabled || revealed}
          aria-label="ひとつ けす"
          data-testid="key-back"
        >
          けす
        </button>
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
