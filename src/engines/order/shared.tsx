/**
 * 並べる・分ける・むすぶ・入れる・つくる（order / sort / match / fill / build）で共通の部品。
 * - カード（文か図。文字が読めない区分では絵のカード）
 * - 誤りの印（wrongMark）を、その位置を動かしたら消す
 * - 混ぜ方（item.id から決まる。同じ問題なら同じ並び）
 * - 2〜3歳（ctx.ux.noHoldOrDrag）で数を減らすときの選び方
 * - 文の検査（よみの無い漢字）
 *
 * 置き場所は order の下だが、5つのエンジンが共通に使う（統括が src/engines/common/ へ移してよい）。
 */
import { useState, type ReactNode } from 'react';
import type { ItemBase, RichText } from '../../curriculum/types';
import { audio } from '../../core/audio/index';
import { createRng, hashSeed } from '../../core/util/rng';
import { registerRich } from '../../voice/dynamic';
import { Illust } from '../../illust/Illust';
import { Rt } from '../../text/Rt';
import { findBareKanji, plainText } from '../../text/rich';
import { Figure } from '../figure/Figure';
import type { Figure as FigureData } from '../figure/types';
import type { EngineProps, Judgement, RenderCtx } from '../types';
import './shared.css';

/** カード: 文（RichText）か図、または両方 */
export interface Card {
  /** 文（漢字は《よみ》付き） */
  label?: RichText;
  /** 図（絵のカード。幼児は絵か音声が中心） */
  figure?: FigureData;
  /** 読み上げ・画面の読み手用の名前（絵だけのカードで、絵の名前と違う言い方にしたいとき） */
  name?: string;
}

/**
 * EngineDef と同じ形（Item の和に入る前でも型が通るように、item の型の制約だけを外したもの）。
 * 統括が Item の和に足した後は EngineDef<XxxItem, XxxResponse> と同じ形になる。
 */
export interface TapEngineDef<I extends ItemBase & { engine: string }, R> {
  id: I['engine'];
  Component: (props: TapProps<I, R>) => ReactNode;
  judge(item: I, response: R): Judgement;
  check(item: I): string[];
  answerText(item: I): RichText;
}
export type TapProps<I, R> = Omit<EngineProps<never, R>, 'item'> & { item: I };

// ---- 文

/** 比べるための文（ふりがな・記号を除き、NFKC・空白をつめる） */
export function norm(s: string): string {
  return plainText(s).normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/** カードの同一性（同じ見た目のカードは入れ替えても同じ） */
export function cardKey(c: Card): string {
  return `${c.label !== undefined ? norm(c.label) : ''}|${c.figure ? JSON.stringify(c.figure) : ''}`;
}

/** カードを文で（解説・保護者画面）。絵だけのカードは name */
export function cardText(c: Card): RichText {
  if (c.label !== undefined) return c.label;
  if (c.name) return c.name;
  if (c.figure?.kind === 'illust') return c.figure.id;
  return 'え';
}

/** よみの無い漢字の検査（qa.ts の textsOf はエンジンごとの文を見ないので、エンジンの check で見る） */
export function kanjiErrors(texts: (RichText | undefined)[]): string[] {
  const errs: string[] = [];
  for (const t of texts) {
    if (t === undefined) continue;
    for (const k of findBareKanji(t)) errs.push(`よみの無い漢字「${k}」: ${t.slice(0, 30)}`);
  }
  return errs;
}

export function cardErrors(cards: Card[], what: string): string[] {
  const errs: string[] = [];
  cards.forEach((c, i) => {
    if (c.label === undefined && c.figure === undefined)
      errs.push(`${what}${i + 1}に 文も図も無い`);
    if (c.label !== undefined && !plainText(c.label).trim()) errs.push(`${what}${i + 1}の文が空`);
  });
  errs.push(...kanjiErrors(cards.map((c) => c.label)));
  return errs;
}

/** 0..n-1 の並べ替えか */
export function isPermutation(a: readonly number[], n: number): boolean {
  if (a.length !== n) return false;
  const seen = new Set<number>();
  for (const v of a) {
    if (!Number.isInteger(v) || v < 0 || v >= n || seen.has(v)) return false;
    seen.add(v);
  }
  return true;
}

// ---- 混ぜ方・数を減らす

/** item.id から決まる混ぜ方（同じ問題なら同じ並び。画面を描き直しても変わらない） */
export function shuffledIndices(id: string, salt: string, n: number): number[] {
  return createRng(hashSeed(salt, id)).shuffle(Array.from({ length: n }, (_, i) => i));
}

/** 2〜3歳でカード・組を減らすときの上限（それ以外は制限なし） */
export function toddlerLimit(ctx: Pick<RenderCtx, 'ux'>): number {
  return ctx.ux.noHoldOrDrag ? Math.max(2, Math.min(3, ctx.ux.maxChoices)) : Infinity;
}

/** n 個から k 個を、間が空くように選ぶ（はじめ と おわり を必ず含む）。昇順 */
export function spreadPick(n: number, k: number): number[] {
  if (k >= n) return Array.from({ length: n }, (_, i) => i);
  if (k <= 1) return [0];
  const out = new Set<number>();
  for (let i = 0; i < k; i++) out.add(Math.round((i * (n - 1)) / (k - 1)));
  return [...out].sort((a, b) => a - b);
}

/** 同じ集合か（昇順にして比べる） */
export function sameSet(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const x = [...a].sort((p, q) => p - q);
  const y = [...b].sort((p, q) => p - q);
  return x.every((v, i) => v === y[i]);
}

// ---- 誤りの印

/**
 * 誤りの印（judge の mark: 位置の番号の配列）。印の付いた位置を子が動かしたら、その位置の印を消す。
 * 新しい判定（wrongMark が変わる）で印は付け直される。
 * hide: 正答を見せているとき・2歳段階（誤答の印を出さない: ux-by-age 1章）
 */
export function useMarks(wrongMark: unknown, hide: boolean) {
  const [cleared, setCleared] = useState<{ ref: unknown; keys: number[] }>({ ref: null, keys: [] });
  const marks = Array.isArray(wrongMark) ? (wrongMark as number[]) : [];
  const gone = cleared.ref === wrongMark ? cleared.keys : [];
  return {
    has: (k: number) => !hide && marks.includes(k) && !gone.includes(k),
    clear: (...ks: number[]) => {
      if (!marks.some((m) => ks.includes(m))) return;
      setCleared((c) => ({
        ref: wrongMark,
        keys: [...(c.ref === wrongMark ? c.keys : []), ...ks],
      }));
    },
  };
}

// ---- 画面の部品

/**
 * 2〜3歳: 誤答のとき、印の付いた位置のものを自動で戻す（置き直すだけで次が試せる）。
 * wrongMark が変わったときに一度だけ onNewMark を呼ぶ（描画中の状態更新。effect を使わない）。
 */
export function useOnNewMark(wrongMark: unknown, onNewMark: (marks: number[]) => void) {
  const [seen, setSeen] = useState<unknown>(wrongMark);
  if (seen !== wrongMark) {
    setSeen(wrongMark);
    if (Array.isArray(wrongMark)) onNewMark(wrongMark as number[]);
  }
}

export type CardState = 'selected' | 'correct' | 'wrong' | null;

/** カードの中身（図と文） */
export function CardFace({ card, ctx }: { card: Card; ctx: RenderCtx }) {
  return (
    <>
      {card.figure ? (
        <span className="tk-card__fig">
          {card.figure.kind === 'illust' && (card.figure.count ?? 1) === 1 ? (
            <Illust
              id={card.figure.id}
              className="tk-card__illust"
              label={card.name}
              decorative={card.label !== undefined}
            />
          ) : (
            <Figure fig={card.figure} ctx={ctx} />
          )}
        </span>
      ) : null}
      {card.label !== undefined ? (
        <span className="tk-card__label">
          <Rt text={card.label} ctx={ctx} />
        </span>
      ) : null}
    </>
  );
}

/**
 * 文字が読めない区分（ctx.preschool）では、カードを押すとその名前を読み上げる（音声が中心）。
 * 読み上げの設定が off のとき、名前の無い絵のカードは読まない。
 */
export function speakCard(ctx: RenderCtx, card: Card) {
  if (!ctx.preschool || ctx.readAloud === 'off') return;
  const text = card.name ?? card.label;
  if (!text) return;
  void audio.play(registerRich(ctx.packId, text));
}

/** 押せるカード（白い面＋輪郭＋段差。DESINGN.md 7〜8章）。状態は印と輪郭でも示す（色だけにしない） */
export function TapCard({
  card,
  ctx,
  state = null,
  disabled,
  onPress,
  testId,
  className,
  badge,
}: {
  card: Card;
  ctx: RenderCtx;
  state?: CardState;
  disabled?: boolean;
  onPress?: () => void;
  testId?: string;
  className?: string;
  /** 組の番号など、カードの角に出す小さな印 */
  badge?: ReactNode;
}) {
  const name = card.name ?? (card.label !== undefined ? plainText(card.label) : undefined);
  return (
    <button
      type="button"
      className={['tk-card', state ? `is-${state}` : '', className ?? ''].filter(Boolean).join(' ')}
      aria-label={name}
      aria-pressed={state === 'selected' ? true : undefined}
      disabled={disabled}
      onClick={() => {
        speakCard(ctx, card);
        onPress?.();
      }}
      data-testid={testId}
      data-state={state ?? undefined}
    >
      <CardFace card={card} ctx={ctx} />
      {badge !== undefined ? (
        <span className="tk-badge" aria-hidden>
          {badge}
        </span>
      ) : null}
      {state === 'correct' ? <span className="mark mark--correct" aria-hidden /> : null}
      {state === 'wrong' ? (
        <span className="mark mark--wrong" aria-hidden>
          ？
        </span>
      ) : null}
    </button>
  );
}

/** 「こたえあわせ」（主操作）。作業領域の右に置く */
export function CheckButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return (
    <button
      type="button"
      className="tap tap--main tk-check"
      disabled={disabled}
      onClick={onPress}
      data-testid="check"
    >
      こたえあわせ
    </button>
  );
}

export const RETRY_FILL_ALL: RichText = 'ぜんぶ おいてから こたえあわせ しよう。';
