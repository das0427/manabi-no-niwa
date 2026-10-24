/**
 * fill エンジン: 文の空欄（{{}}）に選択肢から入れる。空欄が複数ある文に対応。
 * 空欄をタップでえらぶ（はじめは最初の空欄をえらんでいる）→ 選択肢をタップで入る。入れると次の空いている空欄へ進む。
 * 入っている空欄をえらんだ状態でもう一度タップすると、中身を外す。
 * 正答は空欄ごと（許容する表記を複数持てる）。比べるときは ふりがな・全角半角・空白の違いを無視する。
 */
import { useState } from 'react';
import type { ItemBase, RichText } from '../../curriculum/types';
import { Rt } from '../../text/Rt';
import { plainText } from '../../text/rich';
import type { Judgement } from '../types';
import {
  CheckButton,
  kanjiErrors,
  norm,
  useMarks,
  type TapEngineDef,
  type TapProps,
} from '../order/shared';
import { displayOrder } from '../shared/order';
import './fill.css';

export interface FillBlank {
  /** 正解（RichText）。表記ゆれを並べる。先頭が解説・正答表示に使う表記。どれも選択肢の中にあること */
  answers: RichText[];
  /** この空欄だけの選択肢（省略時は item.options） */
  options?: RichText[];
  /** 入れがちな誤りの選択肢と誤概念（例: 「は」の所に「わ」） */
  wrong?: { value: RichText; misconception: string }[];
}

export interface FillItem extends ItemBase {
  engine: 'fill';
  /** 空欄 {{}} を含む文（RichText）。{{}} の数 = blanks の数。** ** の中に空欄を置かない */
  text: RichText;
  blanks: FillBlank[];
  /** 選択肢（すべての空欄で共通。2〜6）。書いた順に出す */
  options: RichText[];
  /** 1つの選択肢を1回だけ使える（接続語のカードなど）。既定は何度でも使える（は・へ・を） */
  useOnce?: boolean;
}

/** 答え: 空欄ごとに入れた選択肢の文（空いている所は null） */
export type FillResponse = (RichText | null)[];

const BLANK = /\{\{[^}]*\}\}/g;
const MAX_OPTIONS = 6;

export const blankCount = (text: string) => (text.match(BLANK) ?? []).length;
const optionsOf = (item: FillItem, b: number) => item.blanks[b]?.options ?? item.options;

export function judgeFill(item: FillItem, res: FillResponse): Judgement {
  if (item.blanks.some((_, i) => res[i] === null || res[i] === undefined || !norm(res[i]!)))
    return { result: 'retry', message: 'あいている ところに いれてから こたえあわせ しよう。' };
  const wrong = item.blanks.flatMap((b, i) =>
    b.answers.some((a) => norm(a) === norm(res[i]!)) ? [] : [i],
  );
  if (wrong.length === 0) return { result: 'correct' };
  let misconception: string | undefined;
  for (const i of wrong) {
    misconception = item.blanks[i]!.wrong?.find(
      (w) => norm(w.value) === norm(res[i]!),
    )?.misconception;
    if (misconception) break;
  }
  return { result: 'wrong', misconception, mark: wrong };
}

/** useOnce のとき、空欄ごとに違う選択肢で全部の正答を作れるか（小さいので総当たり） */
function solvableOnce(item: FillItem): boolean {
  const used = new Set<number>();
  const go = (b: number): boolean => {
    if (b === item.blanks.length) return true;
    const opts = optionsOf(item, b);
    for (let o = 0; o < opts.length; o++) {
      if (used.has(o) || !item.blanks[b]!.answers.some((a) => norm(a) === norm(opts[o]!))) continue;
      used.add(o);
      if (go(b + 1)) return true;
      used.delete(o);
    }
    return false;
  };
  return go(0);
}

export function checkFill(item: FillItem): string[] {
  const errs: string[] = [];
  const nb = blankCount(item.text);
  if (nb === 0) errs.push('文に空欄 {{}} が無い');
  if (nb !== item.blanks.length)
    errs.push(`空欄の数（${nb}）と blanks の数（${item.blanks.length}）が違う`);
  if (/\*\*[^*]*\{\{/.test(item.text)) errs.push('強調 ** ** の中に空欄を置かない');
  errs.push(...kanjiErrors([item.text, ...item.options]));
  const checkOpts = (opts: RichText[], where: string) => {
    if (opts.length < 2) errs.push(`${where}選択肢が2つ未満`);
    if (opts.length > MAX_OPTIONS) errs.push(`${where}選択肢は${MAX_OPTIONS}つまで`);
    const keys = opts.map(norm);
    if (new Set(keys).size !== keys.length) errs.push(`${where}同じ選択肢が重複している`);
    if (keys.some((k) => !k)) errs.push(`${where}空の選択肢がある`);
  };
  checkOpts(item.options, '');
  item.blanks.forEach((b, i) => {
    const where = `空欄${i + 1}: `;
    if (b.options) {
      checkOpts(b.options, where);
      errs.push(...kanjiErrors(b.options));
    }
    const opts = optionsOf(item, i).map(norm);
    if (b.answers.length === 0) errs.push(`${where}正解が無い`);
    if (!b.answers.some((a) => opts.includes(norm(a)))) errs.push(`${where}正解が選択肢の中に無い`);
    if (b.answers.filter((a) => opts.includes(norm(a))).length > 1)
      // 表記ゆれが2つとも選択肢にあると「どちらでも正解」になる。意図していればよいが多くは誤り
      errs.push(`${where}正解が2つ以上 選択肢に入っている（表記ゆれの片方を選択肢から外す）`);
    errs.push(...kanjiErrors(b.answers));
    for (const w of b.wrong ?? []) {
      if (b.answers.some((a) => norm(a) === norm(w.value)))
        errs.push(`${where}誤りの「${plainText(w.value)}」が正解と同じ`);
      if (!opts.includes(norm(w.value)))
        errs.push(`${where}誤りの「${plainText(w.value)}」が選択肢に無い`);
      if (!w.misconception) errs.push(`${where}誤りの「${plainText(w.value)}」に誤概念IDが無い`);
    }
  });
  if (item.useOnce && !solvableOnce(item)) errs.push('1回だけ使う選択肢では正解が作れない');
  return errs;
}

export function answerTextOfFill(item: FillItem): RichText {
  let i = 0;
  return item.text.replace(BLANK, () => `**${item.blanks[i++]?.answers[0] ?? ''}**`);
}

function FillView({
  item,
  ctx,
  revealed,
  wrongMark,
  disabled,
  submit,
}: TapProps<FillItem, FillResponse>) {
  const nb = item.blanks.length;
  const [vals, setVals] = useState<FillResponse>(() => Array<RichText | null>(nb).fill(null));
  const [active, setActive] = useState(0);
  const marks = useMarks(wrongMark, revealed || ctx.ux.softJudgement);
  const locked = disabled || revealed;
  const parts = item.text.split(BLANK);
  const valueAt = (i: number) =>
    revealed ? (item.blanks[i]?.answers[0] ?? null) : (vals[i] ?? null);
  const complete = vals.every((v) => v !== null);
  const opts = optionsOf(item, active);
  const usedElsewhere = (o: RichText) =>
    !!item.useOnce && vals.some((v, i) => i !== active && v !== null && norm(v) === norm(o));

  const pressBlank = (i: number) => {
    if (locked) return;
    if (i === active && vals[i] !== null) {
      const next = [...vals];
      next[i] = null;
      setVals(next);
      marks.clear(i);
      return;
    }
    setActive(i);
  };
  const pressOption = (o: RichText) => {
    if (locked || usedElsewhere(o)) return;
    const next = [...vals];
    next[active] = o;
    setVals(next);
    marks.clear(active);
    // 次の空いている空欄へ（今の空欄の後ろから順に、最後まで行ったら前へ戻って探す）
    const after = [...Array(nb).keys()]
      .map((k) => (active + 1 + k) % nb)
      .find((k) => next[k] === null);
    if (after !== undefined) setActive(after);
  };

  return (
    <div className="tk-frame eng-fill">
      <div className="tk-frame__main">
        <p className="eng-fill__text">
          {parts.map((p, i) => (
            <span key={i}>
              {p ? <Rt text={p} ctx={ctx} /> : null}
              {i < nb ? (
                <button
                  type="button"
                  className={[
                    'eng-fill__blank',
                    i === active && !locked ? 'is-active' : '',
                    valueAt(i) === null ? 'is-empty' : '',
                    revealed ? 'is-revealed' : '',
                    marks.has(i) ? 'is-wrong' : '',
                  ].join(' ')}
                  onClick={() => pressBlank(i)}
                  disabled={locked}
                  aria-label={`${i + 1}ばんめの あいている ところ ${valueAt(i) !== null ? plainText(valueAt(i)!) : 'から'}`}
                  aria-pressed={i === active && !locked}
                  data-testid={`blank-${i}`}
                >
                  {valueAt(i) !== null ? <Rt text={valueAt(i)!} ctx={ctx} /> : ' '}
                  {marks.has(i) ? (
                    <span className="mark mark--wrong" aria-hidden>
                      ？
                    </span>
                  ) : null}
                </button>
              ) : null}
            </span>
          ))}
        </p>
        {!revealed ? (
          <div className="eng-fill__options" role="group" aria-label="いれる もの">
            {displayOrder(
              item,
              opts.map((_, oi) => oi),
              opts.map((o) => (typeof o === 'string' ? o : undefined)),
              item.blanks[active]?.options ? String(active) : '',
            )
              .map((oi) => ({ o: opts[oi]!, oi }))
              .map(({ o, oi }) => (
                <button
                  key={oi}
                  type="button"
                  className="tk-card eng-fill__opt"
                  onClick={() => pressOption(o)}
                  disabled={locked || usedElsewhere(o)}
                  aria-label={plainText(o)}
                  data-testid={`opt-${oi}`}
                >
                  <span className="tk-card__label">
                    <Rt text={o} ctx={ctx} />
                  </span>
                </button>
              ))}
          </div>
        ) : null}
      </div>
      {!revealed ? (
        <CheckButton disabled={disabled || !complete} onPress={() => submit(vals)} />
      ) : null}
    </div>
  );
}

export const fillEngine: TapEngineDef<FillItem, FillResponse> = {
  id: 'fill',
  Component: FillView,
  judge: judgeFill,
  check: checkFill,
  answerText: answerTextOfFill,
};

export function fillMisconceptions(item: FillItem): string[] {
  return item.blanks.flatMap((b) => (b.wrong ?? []).map((w) => w.misconception));
}
export function fillTexts(item: FillItem): RichText[] {
  return [
    item.text,
    ...item.options,
    ...item.blanks.flatMap((b) => [...b.answers, ...(b.options ?? [])]),
  ];
}
