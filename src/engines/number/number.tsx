/**
 * number エンジン: 数を入力する（1つ〜複数の欄。商とあまり、□m□cm など）。
 * 判定は有理数で正確に比べる（src/core/answer/number.ts）。形式だけの違いは誤答にせず「もう一度」。
 * 数字キーは作業領域の右側（DESINGN.md 18章、review-1 #21）。主操作の大きさ。
 * column があれば筆算の形（位ごとのます）で出す（column.ts）。判定は同じ（各欄の値）。
 */
import { useState } from 'react';
import {
  judgeNumber,
  normalizeInput,
  parseNumberInput,
  RETRY_MESSAGE,
  answerValue,
  type NumberAnswer,
} from '../../core/answer/number';
import type { NumberItem } from '../../curriculum/types';
import { plainText } from '../../text/rich';
import { Rt } from '../../text/Rt';
import type { EngineDef, EngineProps, Judgement } from '../types';
import {
  cellsToValue,
  COL_MAX_H,
  COL_MAX_W,
  columnLayout,
  columnSize,
  MEMO_MAX,
  valueToCells,
  type ColLayout,
} from './column';
import './number.css';

/** 欄ごとの入力文字列 */
export type NumberResponse = string[];

/** 欄に入る字数の既定（兆の位 3000000000000 = 13字が入る） */
export const DEFAULT_MAX_LENGTH = 15;

/** 筆算のますに空きがあるとき（数字の間・下の位） */
export const COLUMN_GAP_MESSAGE = 'あいている ますが あるよ';

export function judgeNumberItem(item: NumberItem, res: NumberResponse): Judgement {
  // 筆算: 数字の間・下の位のますが空いている → 誤答にせず「もう一度」
  if (item.column && res.some((s) => s.includes('?')))
    return { result: 'retry', message: COLUMN_GAP_MESSAGE };
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

/** 答えを書いたときの字数（maxLength の検査用） */
function answerLength(a: NumberAnswer): number {
  switch (a.kind) {
    case 'fraction':
      return `${a.num}/${a.den}`.length;
    default:
      return String(a.value).length;
  }
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
    if (a.kind !== 'fraction' && !Number.isSafeInteger(Math.round(Math.abs(a.value))))
      errs.push(`答え ${a.value} が大きすぎる（16けたまで）`);
    if (f.maxLength !== undefined) {
      if (!Number.isInteger(f.maxLength) || f.maxLength < 1 || f.maxLength > 16)
        errs.push('maxLength は 1〜16');
      else if (answerLength(a) > f.maxLength)
        errs.push(`答え（${answerLength(a)}字）が maxLength ${f.maxLength} より長い`);
    } else if (answerLength(a) > DEFAULT_MAX_LENGTH)
      errs.push(`答えが ${DEFAULT_MAX_LENGTH}字より長い（maxLength を指定する）`);
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
  if (item.column) errs.push(...checkColumn(item));
  return errs;
}

function checkColumn(item: NumberItem): string[] {
  const c = item.column!;
  const errs: string[] = [];
  const l = columnLayout(c);
  if (!l) {
    if (c.op === 'div') errs.push('筆算のわり算は わる数 1以上・わられる数 ≧ わる数');
    else if (c.op === 'sub') errs.push('筆算のひき算は 上の数 ≧ 下の数');
    else errs.push('筆算の数は 0以上の整数');
    return errs;
  }
  if (item.keys?.length) errs.push('筆算では記号のキーを使わない（整数だけ）');
  if (item.figure) errs.push('筆算の問題に figure を付けない（作業領域の高さが足りない）');
  if (c.op === 'div' && c.memo) errs.push('わり算の筆算に memo は使わない');
  if (c.partials !== undefined && c.op !== 'mul') errs.push('partials は かけ算だけ');
  if (c.op === 'mul' && c.partials !== false && String(c.operands[1]).length >= 2) {
    if (String(c.operands[1]).includes('0'))
      errs.push('かける数に 0 の位がある筆算は partials: false にする（部分積の書き方が教科書で違う）');
  }
  if (item.fields.length !== l.expected.length)
    errs.push(
      `筆算の欄の数が違う（${item.fields.length}。この式では ${l.expected.length}: ${l.expected.join('|')}）`,
    );
  item.fields.forEach((f, i) => {
    if (f.answer.kind !== 'int') errs.push(`筆算の欄 ${i + 1} は int にする`);
    else if (l.expected[i] !== undefined && f.answer.value !== l.expected[i])
      errs.push(`筆算の欄 ${i + 1} の答え ${f.answer.value} が式と合わない（${l.expected[i]}）`);
    if (f.unit || f.digitGroup) errs.push(`筆算の欄 ${i + 1} に unit・digitGroup を付けない`);
  });
  for (const w of item.wrongAnswers ?? [])
    for (const p of w.value.split('|'))
      if (!/^\d+$/.test(normalizeInput(p))) errs.push(`筆算の誤答の例 ${w.value} は数字だけで書く`);
  const size = columnSize(l);
  if (size.h > COL_MAX_H + 1e-9)
    errs.push(
      `筆算が作業領域の高さに入らない（${size.h.toFixed(1)}u。${COL_MAX_H}u まで。memo・partials を外すか、商が1けたの式に）`,
    );
  if (size.w > COL_MAX_W + 1e-9)
    errs.push(`筆算が作業領域の幅に入らない（${l.width}列。数を小さく）`);
  // 問題文が2行になると作業領域が低くなる
  if (plainText(item.prompt).length > 24) errs.push('筆算の問題文は1行（24字まで）にする');
  return errs;
}

function valueText(a: NumberAnswer, withUnit: boolean): string {
  return a.kind === 'fraction'
    ? `[[${a.num}/${a.den}]]`
    : a.kind === 'quantity' && withUnit
      ? `${a.value}${a.unit}`
      : String(a.value);
}

export function answerTextOf(item: NumberItem): string {
  return item.fields
    .map((f) => {
      // 欄の後ろに単位があるときは、quantity の単位を重ねない
      const v = valueText(f.answer, !f.unit) + (f.unit ? ` ${f.unit}` : '');
      return f.label ? `${f.label} ${v}` : v;
    })
    .join('、');
}

/** 入力中の文字列の表示（分数は縦に。digitGroup があれば数字を区切って見せる） */
function Shown({ s, group }: { s: string; group?: 3 | 4 }) {
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
  if (group) {
    const m = /^(-?)(\d+)(\.\d*)?$/.exec(s);
    if (m && m[2]!.length > group) {
      const int = m[2]!;
      const parts: string[] = [];
      for (let e = int.length; e > 0; e -= group) parts.unshift(int.slice(Math.max(0, e - group), e));
      return (
        <span className="num-group">
          {m[1]}
          {parts.map((g, i) => (
            <span key={i} className={i > 0 ? 'num-group__g num-group__g--sep' : 'num-group__g'}>
              {g}
            </span>
          ))}
          {m[3]}
        </span>
      );
    }
  }
  return <>{s.replace(/\//g, '／').replace(/ /g, 'と')}</>;
}

/** 数字キー（4列×4段。作業領域の右側。右下の「つぎへ」と重ならない: DESINGN.md 18章） */
function Pad({
  keys,
  locked,
  ready,
  put,
  onSubmit,
}: {
  keys: NonNullable<NumberItem['keys']>;
  locked: boolean;
  ready: boolean;
  put(ch: string): void;
  onSubmit(): void;
}) {
  const key = (ch: string, text: string, label: string, testId: string, cls = '') => (
    <button
      key={testId}
      type="button"
      className={`numkey ${cls}`}
      onClick={() => put(ch)}
      disabled={locked}
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
        onClick={onSubmit}
        disabled={locked || !ready}
        data-testid="check"
      >
        こたえあわせ
      </button>
    </div>
  );
}

function NumberView(props: EngineProps<NumberItem, NumberResponse>) {
  const layout = props.item.column ? columnLayout(props.item.column) : null;
  if (layout) return <ColumnView {...props} layout={layout} />;
  return <FieldsView {...props} />;
}

function FieldsView({
  item,
  ctx,
  revealed,
  wrongMark,
  disabled,
  submit,
}: EngineProps<NumberItem, NumberResponse>) {
  const [vals, setVals] = useState<string[]>(() => item.fields.map(() => ''));
  const [active, setActive] = useState(0);
  const put = (ch: string) => {
    if (disabled || revealed) return;
    setVals((v) => {
      const next = [...v];
      const cur = next[active] ?? '';
      const max = item.fields[active]?.maxLength ?? DEFAULT_MAX_LENGTH;
      if (ch === 'back') next[active] = cur.slice(0, -1);
      else if (cur.length < max) next[active] = cur + ch;
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
                <Rt text={valueText(f.answer, !f.unit)} ctx={ctx} />
              ) : (
                <Shown s={vals[i] ?? ''} group={f.digitGroup} />
              )}
            </button>
            {f.unit ? (
              <span className="eng-number__unit" data-testid={`unit-${i}`}>
                <Rt text={f.unit} ctx={ctx} />
              </span>
            ) : null}
          </label>
        ))}
      </div>
      <Pad
        keys={item.keys ?? []}
        locked={disabled || revealed}
        ready={ready}
        put={put}
        onSubmit={() => submit(vals)}
      />
    </div>
  );
}

const PLACE = ['いち', 'じゅう', 'ひゃく', 'せん', 'まん', 'じゅうまん', 'ひゃくまん', 'せんまん'];

/** 筆算: 式の数字の行・答えの ます（位ごと）・メモの ます（採点しない） */
function ColumnView({
  item,
  revealed,
  wrongMark,
  disabled,
  submit,
  layout,
}: EngineProps<NumberItem, NumberResponse> & { layout: ColLayout }) {
  const fieldRows = layout.rows.flatMap((r) => (r.kind === 'field' ? [r] : []));
  const memoRow = layout.rows.find((r) => r.kind === 'memo');
  // ますの値: field の番号ごと（左から）。メモは 'm'。続けて押されても取りこぼさないよう、1つの状態で持つ
  const [st, setSt] = useState<{
    cells: Record<string, string[]>;
    active: { row: string; i: number };
  }>(() => {
    const init: Record<string, string[]> = {};
    for (const r of fieldRows) init[String(r.field)] = r.cols.map(() => '');
    if (memoRow) init.m = memoRow.cols.map(() => '');
    const first = fieldRows[0];
    return {
      cells: init,
      active: {
        row: String(first?.field ?? 0),
        i: first && layout.direction === 'rtl' ? first.cols.length - 1 : 0,
      },
    };
  });
  const { cells, active } = st;
  const setActive = (a: { row: string; i: number }) => setSt((s) => ({ ...s, active: a }));
  const locked = disabled || revealed;
  const step = layout.direction === 'rtl' ? -1 : 1;
  const put = (ch: string) => {
    if (locked) return;
    setSt((s) => {
      const row = s.cells[s.active.row];
      if (!row) return s;
      const next = [...row];
      let i = s.active.i;
      if (s.active.row === 'm') {
        // メモ: 2字まで（繰り下がりの「12」など）。動かない
        if (ch === 'back') next[i] = next[i]!.slice(0, -1);
        else if (/^\d$/.test(ch) && next[i]!.length < MEMO_MAX) next[i] = next[i]! + ch;
      } else if (ch === 'back') {
        // 空のますで けす → 1つ前（入れてきた向きの逆）のますを消す
        if (next[i] === '' && next[i - step] !== undefined) i -= step;
        next[i] = '';
      } else if (/^\d$/.test(ch)) {
        next[i] = ch;
        if (next[i + step] !== undefined) i += step;
      }
      return { cells: { ...s.cells, [s.active.row]: next }, active: { row: s.active.row, i } };
    });
  };
  const values = fieldRows
    .slice()
    .sort((x, y) => x.field - y.field)
    .map((r) => cellsToValue(cells[String(r.field)] ?? []));
  const ready = values.length === item.fields.length && values.every((v) => v !== '');
  const wrong = !!wrongMark && !revealed;
  // ますの位（右はしの列が一の位）
  const placeName = (col: number) => {
    const p = layout.width - 1 - col;
    return PLACE[p] ?? `${p + 1}ばんめ`;
  };
  // 行の並び（答えの行の前後には すき間だけの行を入れる: column.ts の columnSize と同じ）
  const tracks: string[] = [];
  const rowTrack: number[] = [];
  const gapTrack: (number | null)[] = [];
  layout.rows.forEach((r, i) => {
    const prev = layout.rows[i - 1];
    if (prev && (r.kind === 'field' || prev.kind === 'field')) {
      tracks.push('var(--col-gap)');
      gapTrack.push(tracks.length);
    } else gapTrack.push(null);
    tracks.push(
      r.kind === 'field' ? 'var(--col-fh)' : r.kind === 'memo' ? 'var(--col-mh)' : 'var(--col-nh)',
    );
    rowTrack.push(tracks.length);
  });
  return (
    <div className="eng-number eng-number--column">
      <div
        className="num-col"
        role="group"
        aria-label="ひっさん"
        data-testid="column"
        style={{
          gridTemplateColumns: Array.from({ length: layout.width }, (_, c) =>
            layout.narrow?.includes(c) ? 'var(--col-bw)' : 'var(--col-w)',
          ).join(' '),
          gridTemplateRows: tracks.join(' '),
        }}
      >
        {layout.rows.map((r, ri) => {
          if (r.kind === 'num')
            return [
              ...r.chars.map(([c, ch]) => (
                <span
                  key={`n${ri}-${c}`}
                  className="num-col__d"
                  style={{ gridRow: rowTrack[ri], gridColumn: c + 1 }}
                >
                  {ch}
                </span>
              )),
              ...(r.bracket !== undefined
                ? [
                    <span
                      key={`b${ri}`}
                      className="num-col__bracket"
                      aria-hidden
                      style={{ gridRow: rowTrack[ri], gridColumn: r.bracket + 1 }}
                    />,
                  ]
                : []),
            ];
          const key = r.kind === 'memo' ? 'm' : String(r.field);
          const shown =
            revealed && r.kind === 'field'
              ? valueToCells(
                  item.fields[r.field]?.answer.kind === 'int'
                    ? (item.fields[r.field]!.answer as { value: number }).value
                    : 0,
                  r.cols.length,
                )
              : (cells[key] ?? []);
          return r.cols.map((c, i) => {
            const on = !locked && active.row === key && active.i === i;
            const label =
              r.kind === 'memo'
                ? `メモ ${placeName(c)}の くらい`
                : `${r.field + 1}ばんめの こたえ ${placeName(c)}の くらい`;
            return (
              <button
                key={`${key}-${i}`}
                type="button"
                className={[
                  r.kind === 'memo' ? 'num-col__memo' : 'num-col__cell',
                  on ? 'is-active' : '',
                  wrong && r.kind === 'field' ? 'is-wrong' : '',
                  revealed && r.kind === 'field' ? 'is-revealed' : '',
                ].join(' ')}
                style={{ gridRow: rowTrack[ri], gridColumn: c + 1 }}
                onClick={() => !locked && setActive({ row: key, i })}
                aria-label={`${label} ${shown[i] || 'から'}`}
                data-testid={r.kind === 'memo' ? `memo-${i}` : `cell-${r.field}-${i}`}
              >
                {r.kind === 'memo' ? <span className="num-col__memobox">{shown[i]}</span> : shown[i]}
              </button>
            );
          });
        })}
        {layout.lines.map(([row, c0, c1], i) => {
          const g = gapTrack[row] ?? null;
          const r = layout.rows[row];
          // わり算の ）の上の線は ）につなげる（すき間の下のふち）
          const cls = !g
            ? 'num-col__line num-col__line--top'
            : r?.kind === 'num' && r.bracket !== undefined
              ? 'num-col__line num-col__line--bottom'
              : 'num-col__line';
          return (
            <span
              key={`l${i}`}
              className={cls}
              aria-hidden
              style={{ gridRow: g ?? rowTrack[row], gridColumn: `${c0 + 1} / ${c1 + 2}` }}
            />
          );
        })}
      </div>
      <Pad keys={[]} locked={locked} ready={ready} put={put} onSubmit={() => submit(values)} />
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
