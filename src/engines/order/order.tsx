/**
 * order エンジン: 並べ替え（カード・語・文・手順を正しい順に並べる）。
 * 下の「おくもの」をタップすると、上の並びの空いている一番前に入る。入れたものをタップすると外れる。
 * 正答は1つの順序（cards に書いた順）か、許容する別の順序（alsoAccept）。同じ見た目のカードは入れ替えても正解。
 * 誤答の印は、正答に一番近い並びと比べて合っていない位置に付ける。
 */
import { useState } from 'react';
import type { ItemBase, RichText } from '../../curriculum/types';
import type { Judgement } from '../types';
import {
  cardErrors,
  cardKey,
  cardText,
  CheckButton,
  isPermutation,
  kanjiErrors,
  RETRY_FILL_ALL,
  sameSet,
  shuffledIndices,
  spreadPick,
  TapCard,
  toddlerLimit,
  useMarks,
  useOnNewMark,
  type Card,
  type TapEngineDef,
  type TapProps,
} from './shared';
import './order.css';

export interface OrderItem extends ItemBase {
  engine: 'order';
  /** 並べるもの。**正しい順に書く**（画面では混ぜて出す）。2〜8枚（layout: column は4枚まで） */
  cards: Card[];
  /** 正しい順の他に正解とする順（cards の番号の列）。例 [[1, 0, 2]] */
  alsoAccept?: number[][];
  /** 並びの両端の言葉（例 ['はじめ', 'おわり']、['ちいさい', 'おおきい']）。空いている端の置き場に出す */
  ends?: [RichText, RichText];
  /** 並びの向き（既定 row = 横。長い文のカードは column = 縦） */
  layout?: 'row' | 'column';
  /** よくある誤りの順（cards の番号の列）と誤概念 */
  wrongOrders?: { order: number[]; misconception: string }[];
  /** 逆の順に並べたときの誤概念（大小の順・時間の順の取り違え） */
  reverseMisconception?: string;
  /** 下に並べておく最初の順（cards の番号の列）。省略時は item.id から決める混ぜ方 */
  initial?: number[];
}

/** 答え: 上の並びに置いたカードの番号（前から順に） */
export type OrderResponse = number[];

const MAX_ROW = 8;
const MAX_COLUMN = 4;

function acceptedOrders(item: OrderItem): number[][] {
  const id = item.cards.map((_, i) => i);
  return [id, ...(item.alsoAccept ?? [])];
}

/** k 枚に減らすとき（2〜3歳）に使うカード。はじめ と おわり を含め、間を空けて選ぶ */
export function orderVisible(item: OrderItem, k: number): number[] {
  return spreadPick(item.cards.length, k);
}

const keysOf = (item: OrderItem, order: readonly number[]) =>
  order.map((i) => cardKey(item.cards[i]!));
const sameKeys = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

export function judgeOrder(item: OrderItem, res: OrderResponse): Judgement {
  const n = item.cards.length;
  const k = res.length;
  if (k < Math.min(n, 2) || !sameSet(res, orderVisible(item, k)) || new Set(res).size !== k)
    return { result: 'retry', message: RETRY_FILL_ALL };
  const used = new Set(res);
  const project = (o: number[]) => o.filter((i) => used.has(i));
  const got = keysOf(item, res);
  const accepted = acceptedOrders(item).map((o) => keysOf(item, project(o)));
  if (accepted.some((a) => sameKeys(a, got))) return { result: 'correct' };

  // 一番近い正しい順と比べて、合っていない位置に印
  let best = accepted[0]!;
  let bestHits = -1;
  for (const a of accepted) {
    const hits = a.filter((v, i) => v === got[i]).length;
    if (hits > bestHits) [best, bestHits] = [a, hits];
  }
  const mark = got.flatMap((v, i) => (v !== best[i] ? [i] : []));
  const known = item.wrongOrders?.find((w) => sameKeys(keysOf(item, project(w.order)), got));
  let misconception = known?.misconception;
  if (!misconception && item.reverseMisconception && sameKeys([...accepted[0]!].reverse(), got))
    misconception = item.reverseMisconception;
  return { result: 'wrong', misconception, mark };
}

export function checkOrder(item: OrderItem): string[] {
  const errs: string[] = [];
  const n = item.cards.length;
  if (n < 2) errs.push('並べるものが2つ未満');
  const max = item.layout === 'column' ? MAX_COLUMN : MAX_ROW;
  if (n > max) errs.push(`並べるものは${max}つまで（今 ${n}）`);
  errs.push(...cardErrors(item.cards, 'カード'));
  errs.push(...kanjiErrors(item.ends ?? []));
  const keys = item.cards.map(cardKey);
  if (n >= 2 && new Set(keys).size === 1) errs.push('すべて同じカードで、順が決まらない');
  const accepted = [keys];
  for (const o of item.alsoAccept ?? []) {
    if (!isPermutation(o, n)) {
      errs.push(`alsoAccept の ${JSON.stringify(o)} が カードの番号の並べ替えでない`);
      continue;
    }
    const k = keysOf(item, o);
    if (accepted.some((a) => sameKeys(a, k)))
      errs.push(`alsoAccept の ${JSON.stringify(o)} が ほかの正しい順と同じ`);
    accepted.push(k);
  }
  const isAccepted = (o: number[]) => accepted.some((a) => sameKeys(a, keysOf(item, o)));
  for (const w of item.wrongOrders ?? []) {
    if (!isPermutation(w.order, n)) {
      errs.push(`誤りの順 ${JSON.stringify(w.order)} が カードの番号の並べ替えでない`);
      continue;
    }
    if (isAccepted(w.order)) errs.push(`誤りの順 ${JSON.stringify(w.order)} が正しい順と同じ`);
    if (!w.misconception) errs.push(`誤りの順 ${JSON.stringify(w.order)} に誤概念IDが無い`);
  }
  if (item.reverseMisconception && n >= 2) {
    const rev = item.cards.map((_, i) => n - 1 - i);
    if (isAccepted(rev))
      errs.push('逆の順も正しい順になっている（reverseMisconception が使えない）');
  }
  if (item.initial) {
    if (!isPermutation(item.initial, n)) errs.push('initial が カードの番号の並べ替えでない');
    else if (isAccepted(item.initial)) errs.push('initial（最初の並び）が正しい順になっている');
  }
  return errs;
}

export function answerTextOfOrder(item: OrderItem): RichText {
  return item.cards.map(cardText).join(' → ');
}

/** 下に並べる順（正しい順と同じにならないようにする） */
export function poolOrder(item: OrderItem, visible: number[]): number[] {
  const n = item.cards.length;
  const base = item.initial ?? shuffledIndices(item.id, 'order', n);
  const set = new Set(visible);
  let pool = base.filter((i) => set.has(i));
  if (pool.length < 2) return pool;
  const accepted = acceptedOrders(item).map((o) =>
    keysOf(
      item,
      o.filter((i) => set.has(i)),
    ),
  );
  const ok = (p: number[]) => !accepted.some((a) => sameKeys(a, keysOf(item, p)));
  for (let r = 0; r < pool.length && !ok(pool); r++) pool = [...pool.slice(1), pool[0]!];
  if (!ok(pool)) pool = [...pool].reverse();
  return pool;
}

function OrderView({
  item,
  ctx,
  revealed,
  wrongMark,
  disabled,
  submit,
}: TapProps<OrderItem, OrderResponse>) {
  const n = item.cards.length;
  const visible = orderVisible(item, Math.min(n, toddlerLimit(ctx)));
  const k = visible.length;
  const pool = poolOrder(item, visible);
  const [slots, setSlots] = useState<(number | null)[]>(() => Array<number | null>(k).fill(null));
  const marks = useMarks(wrongMark, revealed || ctx.ux.softJudgement);
  const auto = ctx.ux.noHoldOrDrag;
  // 2〜3歳: 誤答のとき、合っていない位置のカードを下へ戻す
  useOnNewMark(wrongMark, (m) => {
    if (auto) setSlots((s) => s.map((c, i) => (m.includes(i) ? null : c)));
  });
  const locked = disabled || revealed;
  const shown: (number | null)[] = revealed
    ? acceptedOrders(item)[0]!.filter((i) => visible.includes(i))
    : slots;
  const nextEmpty = slots.indexOf(null);
  const complete = nextEmpty === -1;

  const place = (card: number) => {
    if (locked || complete || slots.includes(card)) return;
    const next = [...slots];
    next[nextEmpty] = card;
    setSlots(next);
    marks.clear(nextEmpty);
    if (auto && !next.includes(null)) submit(next as number[]);
  };
  const remove = (pos: number) => {
    if (locked || slots[pos] === null) return;
    const next = [...slots];
    next[pos] = null;
    setSlots(next);
    marks.clear(pos);
  };

  const column = item.layout === 'column';
  const endLabel = (pos: number) =>
    item.ends ? (pos === 0 ? item.ends[0] : pos === k - 1 ? item.ends[1] : null) : null;

  return (
    <div className={['tk-frame', 'eng-order', auto ? 'tk--big' : ''].join(' ')}>
      <div
        className={`tk-frame__main eng-order__main eng-order__main--${column ? 'column' : 'row'}`}
      >
        <ol className="eng-order__track" aria-label="ならべる ところ">
          {shown.map((c, pos) => (
            <li key={pos} className="eng-order__cell">
              {c === null ? (
                <span
                  className={['tk-slot', pos === nextEmpty && !locked ? 'is-next' : ''].join(' ')}
                  data-testid={`slot-${pos}`}
                >
                  {endLabel(pos) ?? pos + 1}
                </span>
              ) : (
                <TapCard
                  card={item.cards[c]!}
                  ctx={ctx}
                  state={revealed ? 'correct' : marks.has(pos) ? 'wrong' : null}
                  disabled={locked}
                  onPress={() => remove(pos)}
                  testId={`slot-${pos}`}
                  badge={column ? pos + 1 : undefined}
                />
              )}
            </li>
          ))}
        </ol>
        <div className="eng-order__pool" role="group" aria-label="おく もの">
          {pool.map((c) =>
            shown.includes(c) ? (
              <span key={c} className="tk-slot eng-order__ghost" aria-hidden />
            ) : (
              <TapCard
                key={c}
                card={item.cards[c]!}
                ctx={ctx}
                disabled={locked || complete}
                onPress={() => place(c)}
                testId={`card-${c}`}
              />
            ),
          )}
        </div>
      </div>
      {!auto && !revealed ? (
        <CheckButton disabled={disabled || !complete} onPress={() => submit(slots as number[])} />
      ) : null}
    </div>
  );
}

export const orderEngine: TapEngineDef<OrderItem, OrderResponse> = {
  id: 'order',
  Component: OrderView,
  judge: judgeOrder,
  check: checkOrder,
  answerText: answerTextOfOrder,
};

/** 誤概念ID（qa.ts で定義の有無を確かめる用） */
export function orderMisconceptions(item: OrderItem): string[] {
  return [
    ...(item.wrongOrders ?? []).map((w) => w.misconception),
    ...(item.reverseMisconception ? [item.reverseMisconception] : []),
  ];
}
/** 子供に見せる文（qa.ts の よみの検査用） */
export function orderTexts(item: OrderItem): RichText[] {
  return [
    ...item.cards.flatMap((c) => (c.label !== undefined ? [c.label] : [])),
    ...(item.ends ?? []),
  ];
}
