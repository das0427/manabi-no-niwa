/**
 * match エンジン: 線でむすぶ（左右の対応）。
 * 画面では「ひだり」を上の段、「みぎ」を下の段に並べ、むすんだ組を線と番号で示す（色だけにしない）。
 * 上のカードをタップ（えらぶ）→ 下のカードをタップで組にする（下→上の順でもよい）。
 * むすんだカードをタップすると組が外れて、そのカードをえらんだ状態になる。
 * 正答は組の集合（順不同）。1つの左に1つの右。右には組にならない「まぎらわしいもの」を足してよい。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ItemBase, RichText } from '../../curriculum/types';
import { plainText } from '../../text/rich';
import type { Judgement } from '../types';
import {
  cardErrors,
  cardKey,
  cardText,
  CheckButton,
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

/** 「もう一度」の文。線でむすぶ問題なので「おいて」でなく「むすんで」（order・sort の RETRY_FILL_ALL は「おく」問題の文） */
export const RETRY_MATCH_ALL: RichText = 'ぜんぶ むすんでから こたえあわせ しよう。';

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
    return { result: 'retry', message: RETRY_MATCH_ALL };
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

/** 左右を縦に並べる（eng-match--rows）文の長さの境（字） */
const LONG_LABEL = 10;

/** ふりがな（rt）を除いた字の行（行の中心の高さごとに、幅の合計と左右の端を足す）。上から順 */
function labelLines(label: Element): { mid: number; w: number; h: number; l: number; r: number }[] {
  const lines: { mid: number; w: number; h: number; l: number; r: number }[] = [];
  const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent?.trim() || n.parentElement?.closest('rt')) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    // jsdom には getClientRects が無い（測れないときは行を数えない）
    for (const r of Array.from(range.getClientRects?.() ?? [])) {
      if (r.width < 1) continue;
      const mid = r.top + r.height / 2;
      const line = lines.find((t) => Math.abs(t.mid - mid) < r.height * 0.5);
      if (line) {
        line.w += r.width;
        line.l = Math.min(line.l, r.left);
        line.r = Math.max(line.r, r.right);
      } else lines.push({ mid, w: r.width, h: r.height, l: r.left, r: r.right });
    }
  }
  return lines.sort((a, b) => a.mid - b.mid);
}

/** 改行してよい字の後ろ・前（文字の配置の検査の BREAK_OK_AFTER・END_NG と同じ） */
const BREAK_AFTER = new Set(Array.from('、。，．！？!?」』）)…:：'));
const OPEN_BEFORE = new Set(Array.from('「『（(【［〔〈《“‘'));
let wordSeg: Intl.Segmenter | null | undefined;

/**
 * ラベルの改行が語の途中に無いか（文字の配置の検査の (d)(f) と同じ考え）。改行は、空白のところ・句読点と閉じ括弧の後ろ・
 * 始め括弧の前ならよい。分かち書き（data-wakachi）か空白で区切って書いたラベル（data-spaced）はそれだけ。ほかは
 * Intl.Segmenter の語の切れ目でもよい。1 段で札が縮むと「「すっぱ／い」」「それなら／ば」と折れた（g6.ja.language-change/10 の解説。レビュー）
 */
function labelBreaksOk(label: Element): boolean {
  const chars: { ch: string; top: number; h: number; space: boolean; i: number }[] = [];
  let text = '';
  let space = false;
  const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.parentElement?.closest('rt')) continue;
    const t = n.textContent ?? '';
    for (let i = 0; i < t.length; i++) {
      const ch = t[i]!;
      if (/\s/u.test(ch)) {
        space = true;
        text += ' ';
        continue;
      }
      const range = document.createRange();
      range.setStart(n, i);
      range.setEnd(n, i + 1);
      // jsdom には getClientRects が無い（測れないときは改行を見ない）
      const b = range.getClientRects?.()[0];
      text += ch;
      if (!b || b.width < 0.5) continue;
      chars.push({ ch, top: b.top, h: b.height, space, i: text.length - 1 });
      space = false;
    }
  }
  const spacedOnly = !!label.closest('[data-wakachi]') || label.hasAttribute('data-spaced');
  for (let k = 1; k < chars.length; k++) {
    const a = chars[k - 1]!;
    const b = chars[k]!;
    if (b.top < a.top + a.h * 0.5) continue; // 同じ行
    if (b.space || BREAK_AFTER.has(a.ch) || OPEN_BEFORE.has(b.ch)) continue;
    if (spacedOnly) return false;
    if (wordSeg === undefined)
      wordSeg =
        typeof Intl !== 'undefined' && 'Segmenter' in Intl
          ? new Intl.Segmenter('ja', { granularity: 'word' })
          : null;
    if (!wordSeg) continue;
    for (const sg of wordSeg.segment(text)) {
      const end = sg.index + sg.segment.length;
      if (b.i > sg.index && b.i < end && sg.isWordLike) return false;
      if (end > b.i) break;
    }
  }
  return true;
}

/**
 * 1段の並びに入るか: 札の列が段からあふれない・札の中身が札からはみ出さない・どの札のラベルも 2 行以内・最後の行が 1 字だけにならない・
 * 語の途中で折れない（labelBreaksOk）。
 * 正解の角の ○（.mark）と番号の丸（.tk-badge）は札の角の外に出る印なので、はみ出しに数えない（scrollWidth で見ると、
 * 解説では ○ の分だけ必ずあふれて見え、1 段に入る札も左右 2 列になった。g3.soc.safety/21 の解説。レビュー）
 */
function rowFits(main: HTMLElement): boolean {
  for (const row of Array.from(main.querySelectorAll<HTMLElement>('.eng-match__row'))) {
    const rr = row.getBoundingClientRect();
    for (const cell of Array.from(row.children)) {
      const b = cell.getBoundingClientRect();
      if (b.left < rr.left - 1 || b.right > rr.right + 1) return false;
    }
    for (const card of Array.from(row.querySelectorAll<HTMLElement>('.tk-card'))) {
      const cr = card.getBoundingClientRect();
      for (const kid of Array.from(card.children)) {
        if (kid.matches('.mark, .tk-badge')) continue;
        const b = kid.getBoundingClientRect();
        if (b.left < cr.left - 1 || b.right > cr.right + 1) return false;
      }
      const label = card.querySelector('.tk-card__label');
      if (!label) continue;
      const lines = labelLines(label);
      if (lines.some((t) => t.l < cr.left - 1 || t.r > cr.right + 1)) return false;
      if (lines.length > 2) return false;
      // 最後の行が 1 字だけ（字の大きさの 1.5 倍に届かない幅）。行の高さで比べると 2 字の行（「とる」）まで落ちた
      const fs = parseFloat(getComputedStyle(label).fontSize) || 0;
      const last = lines[lines.length - 1];
      if (lines.length === 2 && last && last.w < fs * 1.5) return false;
      if (lines.length === 2 && !labelBreaksOk(label)) return false;
    }
  }
  return true;
}

/** 並べ方: 0=1段（ふつうの大きさ）、1=1段（字を --text-min・余白 0.8u まで縮める）、2=左右2列（線は2列の間だけを通る） */
type Layout = 0 | 1 | 2;

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
  // どちらかの札に 10字を超える文があるときは、左右を縦に並べる2列の表の形にする（細長い札を作らない）
  const longLabel = [...item.left, ...item.right].some(
    (c) => c.label !== undefined && plainText(c.label).length > LONG_LABEL,
  );
  // 上か下の列が折り返して 2 段になると、線が途中の札の後ろを通る。まず 1 段に入れ（字と余白を縮める）、
  // それでも入らないときは左右 2 列にする（text-layout-fixes 第6回 W3）
  const firstLayout: Layout = longLabel ? 2 : 0;
  const [layout, setLayout] = useState<Layout>(firstLayout);
  const rows = layout === 2;

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
    if (!el || layout === 2) return;
    const check = () => {
      if (!rowFits(el)) setLayout((v) => (v === 2 ? 2 : ((v + 1) as Layout)));
    };
    check();
    // 字体の読み込みで札の幅が変わる（読み込みは最初の描画のあと）。札の大きさが変わるたびに測り直す
    const fonts = document.fonts;
    fonts?.addEventListener?.('loadingdone', check);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check);
    for (const card of Array.from(el.querySelectorAll('.tk-card'))) ro?.observe(card);
    return () => {
      fonts?.removeEventListener?.('loadingdone', check);
      ro?.disconnect();
    };
  }, [layout]);
  // 並べ方は広げる向き（1段→縮めた1段→左右2列）にしか進まないので、作業領域の幅が変わったら（画面の大きさ・向き）
  // はじめの並べ方から測り直す。幅は並べ方では変わらない（.unit__engine の幅）
  useEffect(() => {
    const host = wrap.current?.closest('.tk-frame')?.parentElement;
    if (!host || typeof ResizeObserver === 'undefined') return undefined;
    let w = host.clientWidth;
    const ro = new ResizeObserver(() => {
      const nw = host.clientWidth;
      if (Math.abs(nw - w) <= 2) return;
      w = nw;
      setLayout(firstLayout);
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, [firstLayout]);
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
          g[side][Number(k)] = rows
            ? [(side === 'l' ? b.right : b.left) - base.left, b.top + b.height / 2 - base.top]
            : [
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
    <div
      className={[
        'tk-frame',
        'tk-frame--band',
        'eng-match',
        rows ? 'eng-match--rows' : layout === 1 ? 'eng-match--tight' : 'eng-match--one',
        toddler ? 'tk--big' : '',
      ].join(' ')}
    >
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
