/**
 * match エンジン: 線でむすぶ（左右の対応）。
 * 画面では「ひだり」を上の段、「みぎ」を下の段に並べ、むすんだ組を線と番号で示す（色だけにしない）。
 * 上のカードをタップ（えらぶ）→ 下のカードをタップで組にする（下→上の順でもよい）。
 * むすんだカードをタップすると組が外れて、そのカードをえらんだ状態になる。
 * 正答は組の集合（順不同）。1つの左に1つの右。右には組にならない「まぎらわしいもの」を足してよい。
 */
import { useLayoutEffect, useRef, useState } from 'react';
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
  spreadPick,
  TapCard,
  toddlerLimit,
  useMarks,
  useOnNewMark,
  type Card,
  type TapEngineDef,
  type TapProps,
} from '../order/shared';
import './match.css';

export interface MatchItem extends ItemBase {
  engine: 'match';
  /** 上の段（例: 絵、英語の文字、漢字、1m）。2〜6 */
  left: Card[];
  /** 下の段（例: 語、読み、100cm）。left 以上・6まで。組にならないものを足してよい */
  right: Card[];
  /** 正しい組 [left の番号, right の番号]。left のすべてに1つずつ。順不同 */
  pairs: [number, number][];
  /** よくある誤りの組と誤概念 */
  wrongPairs?: { pair: [number, number]; misconception: string }[];
  /** 下の段を混ぜない（書いた順に出す。数の順など） */
  fixedOrder?: boolean;
}

/** 答え: むすんだ組 [left の番号, right の番号] の一覧 */
export type MatchResponse = [number, number][];

const MAX_SIDE = 6;

/** k 組に減らすとき（2〜3歳）に使う左の番号。昇順 */
export function matchVisible(item: MatchItem, k: number): number[] {
  return spreadPick(item.left.length, k);
}

function partnerOf(item: MatchItem, l: number): number | undefined {
  return item.pairs.find((p) => p[0] === l)?.[1];
}

export function judgeMatch(item: MatchItem, res: MatchResponse): Judgement {
  const lefts = res.map((p) => p[0]);
  const rights = res.map((p) => p[1]);
  const n = item.left.length;
  if (
    lefts.length < Math.min(n, 2) ||
    new Set(lefts).size !== lefts.length ||
    new Set(rights).size !== rights.length ||
    !sameSet(lefts, matchVisible(item, lefts.length))
  )
    return { result: 'retry', message: RETRY_FILL_ALL };
  const rk = (r: number) => (item.right[r] ? cardKey(item.right[r]) : `?${r}`);
  // 同じ見た目の右のカードは入れ替えても正解
  const wrong = res.filter(([l, r]) => {
    const p = partnerOf(item, l);
    return p === undefined || rk(p) !== rk(r);
  });
  if (wrong.length === 0) return { result: 'correct' };
  let misconception: string | undefined;
  for (const [l, r] of wrong) {
    misconception = item.wrongPairs?.find((w) => w.pair[0] === l && w.pair[1] === r)?.misconception;
    if (misconception) break;
  }
  return { result: 'wrong', misconception, mark: wrong.map((p) => p[0]) };
}

export function checkMatch(item: MatchItem): string[] {
  const errs: string[] = [];
  const nl = item.left.length;
  const nr = item.right.length;
  if (nl < 2) errs.push('上の段（left）が2つ未満');
  if (nl > MAX_SIDE || nr > MAX_SIDE) errs.push(`1つの段は${MAX_SIDE}つまで`);
  if (nr < nl) errs.push('下の段（right）が上の段より少ない');
  errs.push(...cardErrors(item.left, '上の段の'));
  errs.push(...cardErrors(item.right, '下の段の'));
  const lk = item.left.map(cardKey);
  const rk = item.right.map(cardKey);
  if (new Set(lk).size !== nl) errs.push('上の段に同じカードが重複している');
  if (new Set(rk).size !== nr) errs.push('下の段に同じカードが重複している');
  const usedL = new Set<number>();
  const usedR = new Set<number>();
  for (const [l, r] of item.pairs) {
    if (l < 0 || l >= nl || r < 0 || r >= nr) {
      errs.push(`組 [${l}, ${r}] の番号が範囲外`);
      continue;
    }
    if (usedL.has(l)) errs.push(`上の段の${l + 1}が2つの組に入っている`);
    if (usedR.has(r)) errs.push(`下の段の${r + 1}が2つの組に入っている`);
    usedL.add(l);
    usedR.add(r);
  }
  for (let l = 0; l < nl; l++) if (!usedL.has(l)) errs.push(`上の段の${l + 1}に正しい組が無い`);
  for (const w of item.wrongPairs ?? []) {
    const [l, r] = w.pair;
    if (l < 0 || l >= nl || r < 0 || r >= nr) errs.push(`誤りの組 [${l}, ${r}] の番号が範囲外`);
    else if (partnerOf(item, l) === r) errs.push(`誤りの組 [${l}, ${r}] が正しい組と同じ`);
    if (!w.misconception) errs.push(`誤りの組 [${l}, ${r}] に誤概念IDが無い`);
  }
  return errs;
}

export function answerTextOfMatch(item: MatchItem): RichText {
  return [...item.pairs]
    .sort((a, b) => a[0] - b[0])
    .map(([l, r]) => `${cardText(item.left[l]!)} − ${cardText(item.right[r]!)}`)
    .join('、');
}

/** 下の段の並び（上の段とそのまま縦にそろわないようにする） */
export function rightOrder(item: MatchItem, lefts: number[], rights: number[]): number[] {
  let order = item.fixedOrder
    ? rights
    : shuffledIndices(item.id, 'match', item.right.length).filter((r) => rights.includes(r));
  if (item.fixedOrder || order.length < 2) return order;
  const aligned = (o: number[]) => lefts.every((l, i) => partnerOf(item, l) === o[i]);
  for (let t = 0; t < order.length && aligned(order); t++) order = [...order.slice(1), order[0]!];
  return order;
}

interface Geo {
  w: number;
  h: number;
  l: Record<number, [number, number]>;
  r: Record<number, [number, number]>;
}

function MatchView({
  item,
  ctx,
  revealed,
  wrongMark,
  disabled,
  submit,
}: TapProps<MatchItem, MatchResponse>) {
  const nl = item.left.length;
  const lefts = matchVisible(item, Math.min(nl, toddlerLimit(ctx)));
  const toddler = ctx.ux.noHoldOrDrag;
  const rightsShown = toddler
    ? lefts
        .map((l) => partnerOf(item, l))
        .filter((r): r is number => r !== undefined)
        .sort((a, b) => a - b)
    : item.right.map((_, i) => i);
  const rights = rightOrder(item, lefts, rightsShown);
  const [links, setLinks] = useState<(number | null)[]>(() => Array<number | null>(nl).fill(null));
  const [picked, setPicked] = useState<{ side: 'l' | 'r'; i: number } | null>(null);
  const marks = useMarks(wrongMark, revealed || ctx.ux.softJudgement);
  const locked = disabled || revealed;
  useOnNewMark(wrongMark, (m) => {
    if (toddler) setLinks((ls) => ls.map((r, l) => (m.includes(l) ? null : r)));
  });
  const linkOf = (l: number): number | null =>
    revealed ? (partnerOf(item, l) ?? null) : (links[l] ?? null);
  const leftOfRight = (r: number): number | null => {
    const l = lefts.find((x) => linkOf(x) === r);
    return l === undefined ? null : l;
  };
  const complete = lefts.every((l) => links[l] !== null);

  const join = (l: number, r: number) => {
    // その右に別の左がむすんであれば外す（1つの右に1つの左）
    const next = links.map((x) => (x === r ? null : x));
    const prevL = links.findIndex((x) => x === r);
    next[l] = r;
    setLinks(next);
    marks.clear(l, ...(prevL >= 0 ? [prevL] : []));
    setPicked(null);
    if (toddler && lefts.every((x) => next[x] !== null))
      submit(lefts.map((x) => [x, next[x]!] as [number, number]));
  };
  const press = (side: 'l' | 'r', i: number) => {
    if (locked) return;
    // むすんであるカード: 組を外して、えらんだ状態にする
    const linkedL = side === 'l' ? (links[i] !== null ? i : null) : links.indexOf(i);
    if (linkedL !== null && linkedL >= 0 && !(picked && picked.side !== side)) {
      const next = [...links];
      next[linkedL] = null;
      setLinks(next);
      marks.clear(linkedL);
      setPicked({ side, i });
      return;
    }
    if (picked && picked.side !== side) {
      if (side === 'r') join(picked.i, i);
      else join(i, picked.i);
      return;
    }
    setPicked(picked && picked.side === side && picked.i === i ? null : { side, i });
  };

  // 線: カードの位置を測る（描くたびに測り、変わったときだけ更新）
  const wrap = useRef<HTMLDivElement>(null);
  const refs = useRef<{
    l: Record<number, HTMLElement | null>;
    r: Record<number, HTMLElement | null>;
  }>({
    l: {},
    r: {},
  });
  const [geo, setGeo] = useState<Geo | null>(null);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const base = el.getBoundingClientRect();
      const g: Geo = { w: base.width, h: base.height, l: {}, r: {} };
      for (const [side, map] of [
        ['l', refs.current.l],
        ['r', refs.current.r],
      ] as const) {
        for (const [k, node] of Object.entries(map)) {
          if (!node) continue;
          const b = node.getBoundingClientRect();
          g[side][Number(k)] = [
            b.left + b.width / 2 - base.left,
            side === 'l' ? b.bottom - base.top : b.top - base.top,
          ];
        }
      }
      setGeo((old) => (JSON.stringify(old) === JSON.stringify(g) ? old : g));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  });

  const lines = lefts.flatMap((l) => {
    const r = linkOf(l);
    const a = geo?.l[l];
    const b = r !== null ? geo?.r[r] : undefined;
    return r !== null && a && b ? [{ l, a, b }] : [];
  });

  return (
    <div className={['tk-frame', 'eng-match', toddler ? 'tk--big' : ''].join(' ')}>
      <div className="tk-frame__main eng-match__main" ref={wrap}>
        {geo ? (
          <svg
            className="eng-match__lines"
            viewBox={`0 0 ${Math.max(1, geo.w)} ${Math.max(1, geo.h)}`}
            width={geo.w}
            height={geo.h}
            aria-hidden
          >
            {lines.map(({ l, a, b }) => (
              <line
                key={l}
                x1={a[0]}
                y1={a[1]}
                x2={b[0]}
                y2={b[1]}
                className={[
                  'eng-match__line',
                  revealed ? 'is-correct' : marks.has(l) ? 'is-wrong' : '',
                ].join(' ')}
                data-testid={`line-${l}`}
              />
            ))}
          </svg>
        ) : null}
        <div className="eng-match__row" role="group" aria-label="うえの だん">
          {lefts.map((l) => (
            <span key={l} ref={(n) => void (refs.current.l[l] = n)} className="eng-match__cell">
              <TapCard
                card={item.left[l]!}
                ctx={ctx}
                state={
                  revealed
                    ? 'correct'
                    : marks.has(l)
                      ? 'wrong'
                      : picked?.side === 'l' && picked.i === l
                        ? 'selected'
                        : null
                }
                disabled={locked}
                onPress={() => press('l', l)}
                testId={`left-${l}`}
                badge={linkOf(l) !== null ? lefts.indexOf(l) + 1 : undefined}
              />
            </span>
          ))}
        </div>
        <div className="eng-match__row" role="group" aria-label="したの だん">
          {rights.map((r) => {
            const l = leftOfRight(r);
            return (
              <span key={r} ref={(n) => void (refs.current.r[r] = n)} className="eng-match__cell">
                <TapCard
                  card={item.right[r]!}
                  ctx={ctx}
                  state={picked?.side === 'r' && picked.i === r && !locked ? 'selected' : null}
                  disabled={locked}
                  onPress={() => press('r', r)}
                  testId={`right-${r}`}
                  badge={l !== null ? lefts.indexOf(l) + 1 : undefined}
                />
              </span>
            );
          })}
        </div>
      </div>
      {!toddler && !revealed ? (
        <CheckButton
          disabled={disabled || !complete}
          onPress={() => submit(lefts.map((l) => [l, links[l]!] as [number, number]))}
        />
      ) : null}
    </div>
  );
}

export const matchEngine: TapEngineDef<MatchItem, MatchResponse> = {
  id: 'match',
  Component: MatchView,
  judge: judgeMatch,
  check: checkMatch,
  answerText: answerTextOfMatch,
};

export function matchMisconceptions(item: MatchItem): string[] {
  return (item.wrongPairs ?? []).map((w) => w.misconception);
}
export function matchTexts(item: MatchItem): RichText[] {
  return [...item.left, ...item.right].flatMap((c) => (c.label !== undefined ? [c.label] : []));
}
