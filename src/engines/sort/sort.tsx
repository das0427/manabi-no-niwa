/**
 * sort エンジン: なかま分け（いくつかの箱へ分ける）。
 * カードをタップ（えらぶ）→ 箱をタップで入れる。箱の中のカードをタップすると下へ戻って、えらんだ状態になる。
 * 正答は各カードの箱（複数の箱を正しいとしてもよい）。カードごとに「入れがちな誤りの箱」と誤概念を結べる。
 */
import { useState } from 'react';
import type { ItemBase, RichText } from '../../curriculum/types';
import type { Judgement } from '../types';
import {
  cardErrors,
  cardKey,
  cardText,
  CheckButton,
  RETRY_FILL_ALL,
  sameSet,
  shuffledIndices,
  TapCard,
  toddlerLimit,
  useMarks,
  useOnNewMark,
  CardFace,
  type Card,
  type TapEngineDef,
  type TapProps,
} from '../order/shared';
import { plainText } from '../../text/rich';
import './sort.css';

export interface SortCard extends Card {
  /** 正しい箱（boxes の番号）。どちらに入れても正しいときは配列 */
  box: number | number[];
  /** 入れがちな誤りの箱と誤概念（例: くじらを「さかな」の箱へ） */
  wrongBoxes?: { box: number; misconception: string }[];
}

export interface SortItem extends ItemBase {
  engine: 'sort';
  /** 箱（2〜4）。名前の文か絵（幼児は絵と name） */
  boxes: Card[];
  /** 分けるカード（2〜10）。画面では混ぜて出す */
  cards: SortCard[];
  /** カードを混ぜない（書いた順に出す） */
  fixedOrder?: boolean;
}

/** 答え: カードごとに入れた箱の番号（入れていない・出していないカードは null） */
export type SortResponse = (number | null)[];

const MAX_BOXES = 4;
const MAX_CARDS = 10;

const boxesOf = (c: SortCard): number[] => (Array.isArray(c.box) ? c.box : [c.box]);

/** k 枚に減らすとき（2〜3歳）に使うカード。箱ごとに順に1枚ずつ選ぶ。昇順 */
export function sortVisible(item: SortItem, k: number): number[] {
  const n = item.cards.length;
  if (k >= n) return item.cards.map((_, i) => i);
  const byBox = item.boxes.map((_, b) =>
    item.cards.flatMap((c, i) => (boxesOf(c)[0] === b ? [i] : [])),
  );
  const out: number[] = [];
  for (let round = 0; out.length < k && round < n; round++)
    for (const list of byBox)
      if (out.length < k && list[round] !== undefined) out.push(list[round]!);
  return out.sort((a, b) => a - b);
}

export function judgeSort(item: SortItem, res: SortResponse): Judgement {
  const placed = item.cards.flatMap((_, i) => (res[i] !== null && res[i] !== undefined ? [i] : []));
  const n = item.cards.length;
  if (placed.length < Math.min(n, 2) || !sameSet(placed, sortVisible(item, placed.length)))
    return { result: 'retry', message: RETRY_FILL_ALL };
  const wrong = placed.filter((i) => !boxesOf(item.cards[i]!).includes(res[i]!));
  if (wrong.length === 0) return { result: 'correct' };
  let misconception: string | undefined;
  for (const i of wrong) {
    misconception = item.cards[i]!.wrongBoxes?.find((w) => w.box === res[i])?.misconception;
    if (misconception) break;
  }
  return { result: 'wrong', misconception, mark: wrong };
}

export function checkSort(item: SortItem): string[] {
  const errs: string[] = [];
  const nb = item.boxes.length;
  if (nb < 2) errs.push('箱が2つ未満');
  if (nb > MAX_BOXES) errs.push(`箱は${MAX_BOXES}つまで（今 ${nb}）`);
  if (item.cards.length < 2) errs.push('分けるカードが2つ未満');
  if (item.cards.length > MAX_CARDS) errs.push(`分けるカードは${MAX_CARDS}まで`);
  errs.push(...cardErrors(item.boxes, '箱'));
  errs.push(...cardErrors(item.cards, 'カード'));
  const boxKeys = item.boxes.map(cardKey);
  if (new Set(boxKeys).size !== boxKeys.length) errs.push('同じ箱が重複している');
  const seen = new Map<string, string>();
  item.cards.forEach((c, i) => {
    const bs = boxesOf(c);
    if (bs.length === 0) errs.push(`カード${i + 1}に正しい箱が無い`);
    for (const b of bs)
      if (!Number.isInteger(b) || b < 0 || b >= nb) errs.push(`カード${i + 1}の箱 ${b} が範囲外`);
    if (bs.length >= nb && nb > 0) errs.push(`カード${i + 1}は どの箱でも正解になる`);
    for (const w of c.wrongBoxes ?? []) {
      if (w.box < 0 || w.box >= nb) errs.push(`カード${i + 1}の誤りの箱 ${w.box} が範囲外`);
      if (bs.includes(w.box)) errs.push(`カード${i + 1}の誤りの箱 ${w.box} が正しい箱と同じ`);
      if (!w.misconception) errs.push(`カード${i + 1}の誤りの箱に誤概念IDが無い`);
    }
    const k = cardKey(c);
    const sig = [...bs].sort().join(',');
    if (seen.has(k) && seen.get(k) !== sig)
      errs.push(`同じカード（${i + 1}）が別の箱を正解にしている`);
    seen.set(k, sig);
  });
  const used = new Set(item.cards.map((c) => boxesOf(c)[0]));
  if (used.size < 2 && item.cards.length >= 2)
    errs.push('すべてのカードが同じ箱（分ける問題にならない）');
  return errs;
}

export function answerTextOfSort(item: SortItem): RichText {
  return item.boxes
    .map((b, bi) => {
      const cs = item.cards.filter((c) => boxesOf(c).includes(bi)).map(cardText);
      return `${cardText(b)}: ${cs.length ? cs.join('、') : 'なし'}`;
    })
    .join(' ／ ');
}

function SortView({
  item,
  ctx,
  revealed,
  wrongMark,
  disabled,
  submit,
}: TapProps<SortItem, SortResponse>) {
  const n = item.cards.length;
  const visible = sortVisible(item, Math.min(n, toddlerLimit(ctx)));
  const shownBoxes = item.boxes
    .map((_, b) => b)
    .filter(
      (b) => !ctx.ux.noHoldOrDrag || visible.some((i) => boxesOf(item.cards[i]!).includes(b)),
    );
  const order = (
    item.fixedOrder ? item.cards.map((_, i) => i) : shuffledIndices(item.id, 'sort', n)
  ).filter((i) => visible.includes(i));
  const [where, setWhere] = useState<(number | null)[]>(() => Array<number | null>(n).fill(null));
  const [picked, setPicked] = useState<number | null>(null);
  const marks = useMarks(wrongMark, revealed || ctx.ux.softJudgement);
  const auto = ctx.ux.noHoldOrDrag;
  const locked = disabled || revealed;
  useOnNewMark(wrongMark, (m) => {
    if (auto) setWhere((w) => w.map((b, i) => (m.includes(i) ? null : b)));
  });
  const boxOf = (i: number): number | null =>
    revealed ? (boxesOf(item.cards[i]!)[0] ?? null) : (where[i] ?? null);
  const complete = visible.every((i) => where[i] !== null);

  const pressCard = (i: number) => {
    if (locked) return;
    if (where[i] !== null) {
      // 箱の中のカード: 下へ戻して、えらんだ状態にする
      const next = [...where];
      next[i] = null;
      setWhere(next);
      marks.clear(i);
      setPicked(i);
      return;
    }
    setPicked((p) => (p === i ? null : i));
  };
  const pressBox = (b: number) => {
    if (locked || picked === null) return;
    const next = [...where];
    next[picked] = b;
    setWhere(next);
    marks.clear(picked);
    setPicked(null);
    if (auto && visible.every((i) => next[i] !== null)) submit(next);
  };

  return (
    <div className={['tk-frame', 'eng-sort', auto ? 'tk--big' : ''].join(' ')}>
      <div className="tk-frame__main">
        <div className="eng-sort__boxes">
          {shownBoxes.map((b) => (
            <div
              key={b}
              className={['eng-sort__box', picked !== null && !locked ? 'is-ready' : ''].join(' ')}
            >
              {/* 箱の全面が押せる（中のカードの所はカードが押される） */}
              <button
                type="button"
                className="eng-sort__lid"
                onClick={() => pressBox(b)}
                disabled={locked}
                aria-label={`${plainText(item.boxes[b]!.name ?? cardText(item.boxes[b]!))} の はこに いれる`}
                data-testid={`box-${b}`}
              />
              <div className="eng-sort__name" aria-hidden>
                <CardFace card={item.boxes[b]!} ctx={ctx} />
              </div>
              <div className="eng-sort__inside">
                {order
                  .filter((i) => boxOf(i) === b)
                  .map((i) => (
                    <TapCard
                      key={i}
                      card={item.cards[i]!}
                      ctx={ctx}
                      state={revealed ? 'correct' : marks.has(i) ? 'wrong' : null}
                      disabled={locked}
                      onPress={() => pressCard(i)}
                      testId={`card-${i}`}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
        <div className="eng-sort__pool" role="group" aria-label="わける もの">
          {order
            .filter((i) => boxOf(i) === null)
            .map((i) => (
              <TapCard
                key={i}
                card={item.cards[i]!}
                ctx={ctx}
                state={picked === i ? 'selected' : null}
                disabled={locked}
                onPress={() => pressCard(i)}
                testId={`card-${i}`}
              />
            ))}
        </div>
      </div>
      {!auto && !revealed ? (
        <CheckButton disabled={disabled || !complete} onPress={() => submit(where)} />
      ) : null}
    </div>
  );
}

export const sortEngine: TapEngineDef<SortItem, SortResponse> = {
  id: 'sort',
  Component: SortView,
  judge: judgeSort,
  check: checkSort,
  answerText: answerTextOfSort,
};

export function sortMisconceptions(item: SortItem): string[] {
  return item.cards.flatMap((c) => (c.wrongBoxes ?? []).map((w) => w.misconception));
}
export function sortTexts(item: SortItem): RichText[] {
  return [...item.boxes, ...item.cards].flatMap((c) => (c.label !== undefined ? [c.label] : []));
}
