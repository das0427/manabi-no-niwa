/**
 * 数の入力欄と数字キー（number エンジンと同じ操作）。clock・measure・numberline・graph・geometry で共有する。
 * 欄（NumFields）は図の近く、キー（NumKeys）は作業領域の右側に置けるよう、2つに分けてある（DESINGN.md 18章）。
 * キーは主操作の寸法（6u）。
 */
import { useState } from 'react';
import type { RichText } from '../../curriculum/types';
import { Rt } from '../../text/Rt';
import type { RenderCtx } from '../types';
import './numpad.css';

export type PadKey = 'decimal' | 'fraction' | 'minus';

export interface PadField {
  /** 欄の前の文字 */
  label?: RichText;
  /** 欄の後ろの単位（「cm」「じ」「ふん」など） */
  unit?: RichText;
}

export interface NumEntry {
  vals: string[];
  active: number;
  setActive(i: number): void;
  put(ch: string): void;
  ready: boolean;
}

export function useNumEntry(count: number, locked: boolean): NumEntry {
  const [vals, setVals] = useState<string[]>(() => Array.from({ length: count }, () => ''));
  const [active, setActive] = useState(0);
  const put = (ch: string) => {
    if (locked) return;
    setVals((v) => {
      const next = [...v];
      const cur = next[active] ?? '';
      if (ch === 'back') next[active] = cur.slice(0, -1);
      else if (cur.length < 10) next[active] = cur + ch;
      return next;
    });
  };
  return { vals, active, setActive, put, ready: vals.every((v) => v.trim() !== '') };
}

export function NumFields({
  entry,
  fields,
  ctx,
  wrong,
  revealed,
  answers,
}: {
  entry: NumEntry;
  fields: PadField[];
  ctx: RenderCtx;
  wrong: boolean;
  revealed: boolean;
  /** revealed のときに欄に出す正答（RichText） */
  answers?: RichText[];
}) {
  return (
    <div className="mnp-fields">
      {fields.map((f, i) => (
        <span key={i} className="mnp-field">
          {f.label ? (
            <span className="mnp-field__label">
              <Rt text={f.label} ctx={ctx} />
            </span>
          ) : null}
          <button
            type="button"
            className={[
              'mnp-box',
              i === entry.active && !revealed ? 'is-active' : '',
              wrong && !revealed ? 'is-wrong' : '',
              revealed ? 'is-revealed' : '',
            ].join(' ')}
            onClick={() => entry.setActive(i)}
            aria-label={`${i + 1}ばんめの こたえ ${entry.vals[i] || 'から'}`}
            data-testid={`field-${i}`}
          >
            {revealed && answers?.[i] !== undefined ? (
              <Rt text={answers[i]!} ctx={ctx} />
            ) : (
              (entry.vals[i] ?? '').replace(/\//g, '／').replace(/ /g, 'と')
            )}
          </button>
          {f.unit ? (
            <span className="mnp-field__unit">
              <Rt text={f.unit} ctx={ctx} />
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

export function NumKeys({
  entry,
  keys = [],
  disabled,
  onSubmit,
}: {
  entry: NumEntry;
  keys?: PadKey[];
  disabled: boolean;
  onSubmit(): void;
}) {
  const key = (ch: string, text: string, label: string, testId: string, cls = '') => (
    <button
      key={testId}
      type="button"
      className={`mnp-key ${cls}`}
      onClick={() => entry.put(ch)}
      disabled={disabled}
      aria-label={label}
      data-testid={testId}
    >
      {text}
    </button>
  );
  const digit = (d: string) => key(d, d, d, `key-${d}`);
  const fns = [
    keys.includes('decimal') ? key('.', '.', 'しょうすうてん', 'key-dot') : null,
    keys.includes('fraction') ? key('/', '／', 'ぶんすう', 'key-frac') : null,
    keys.includes('fraction') ? key(' ', 'と', 'たいぶんすうの と', 'key-mixed') : null,
    keys.includes('minus') ? key('-', '−', 'マイナス', 'key-minus') : null,
  ].filter((x) => x !== null);
  return (
    <div className="mnp-pad" role="group" aria-label="すうじの キー">
      {['7', '8', '9'].map(digit)}
      {key('back', 'けす', 'ひとつ けす', 'key-back', 'mnp-key--fn')}
      {['4', '5', '6'].map(digit)}
      {fns[0] ?? <span />}
      {['1', '2', '3'].map(digit)}
      {fns[1] ?? <span />}
      {digit('0')}
      {fns[2] ?? <span />}
      <button
        type="button"
        className="mnp-key mnp-key--ok"
        onClick={onSubmit}
        disabled={disabled || !entry.ready}
        data-testid="check"
      >
        こたえあわせ
      </button>
    </div>
  );
}
