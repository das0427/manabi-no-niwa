/**
 * アプリの画面（起動・プロフィール・ホーム・ほかの がくねん・選ぶ画面・単元の地図 …）の札の名前・題。
 * text-layout-fixes「アプリの画面」A0。
 *
 * 1. 折り方は中身の段階（stage）で決める。p23〜g2 は分かち書き（data-wakachi）、g3 以上は空白で区切って書いた名前
 *    （spacedLabel）なら data-spaced、そうでなければ data-phrase（文節で折る）。CSS は app-label.css（base.css の単元の画面と同じ組み合わせ）。
 * 2. fit: { fromU } を渡すと、札の内側（線と padding の内側）にふりがなを含めた字が入るまで、字を fromU（× --ts）から
 *    0.1u ずつ下げる。下限は --text-min（app-label.css の --text-min-u）。決めた値は --fit-fs と data-fit に書く。
 *    下限でも入らなければ data-fit-overflow を付ける（検査の fit-overflow。教材の題を短くする手がかり）。
 *    入るかは、この要素の内側と、親の札の内側で見る。親の札は祖先の [data-fit-box]、無ければ親要素。
 *    札の高さ（固定の札）か幅（flex の子）を親が決めること。親も中身で伸びる箱だと、入らないことが分からない。
 */
import { useLayoutEffect, useRef } from 'react';
import type { StageId } from '../curriculum/types';
import type { RenderCtx } from '../engines/types';
import { Rt } from '../text/Rt';
import { spacedLabel } from '../text/rich';
import './app-label.css';

type LabelCtx = Pick<RenderCtx, 'furigana' | 'learnerGrade'>;

/** 分かち書きの段階（DESINGN.md 17章。UnitRunner の WAKACHI_STAGES と同じ） */
const WAKACHI_STAGES: ReadonlySet<StageId> = new Set(['p23', 'p4', 'p5', 'g1', 'g2']);

export type LabelWrap = 'wakachi' | 'spaced' | 'phrase';

/** 中身の段階と名前から、折り方を決める */
export function labelWrap(stage: StageId, text: string): LabelWrap {
  if (WAKACHI_STAGES.has(stage)) return 'wakachi';
  return spacedLabel(text) ? 'spaced' : 'phrase';
}

/** 字を下げる幅（u） */
export const FIT_STEP_U = 0.1;
/** --text-min-u が読めないとき（アプリの画面の外）の下限（u） */
const FIT_FLOOR_FALLBACK_U = 1.7;
/** 入ったとみなす余裕（px）。text-layout の検査の枠の判定と同じ */
const FIT_TOLERANCE_PX = 1;
/** 揺れが止まらないとき、この回数で測るのをやめる（最後に決めた値のまま） */
const FIT_MAX_STREAK = 6;
const FIT_STREAK_WINDOW_MS = 300;

/** 小数 2 桁に丸める（data-fit の表記と、0.1u ずつの足し引きの誤差を消す） */
const r2 = (x: number): number => Math.round(x * 100) / 100;

/**
 * fromU から floor まで step ずつ下げて、最初に入る大きさ（u）を返す。floor でも入らなければ overflow。
 * fromU が floor 以下なら floor だけを調べる。fits は DOM を見る関数（大きさ u を書いてから測る）
 */
export function searchFit(
  fromU: number,
  floor: number,
  fits: (u: number) => boolean,
  step: number = FIT_STEP_U,
): { u: number; overflow: boolean } {
  let u = r2(Math.max(fromU, floor));
  const lowest = r2(floor);
  for (let guard = 0; guard < 200; guard++) {
    if (fits(u)) return { u, overflow: false };
    if (u <= lowest) return { u: lowest, overflow: true };
    u = r2(Math.max(lowest, u - step));
  }
  return { u: lowest, overflow: true };
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const num = (v: string | null | undefined): number => {
  const n = parseFloat(v ?? '');
  return Number.isFinite(n) ? n : 0;
};

/** 要素の内側（線と padding の内側） */
function innerBox(el: Element): Box {
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  return {
    left: r.left + num(s.borderLeftWidth) + num(s.paddingLeft),
    top: r.top + num(s.borderTopWidth) + num(s.paddingTop),
    right: r.right - num(s.borderRightWidth) - num(s.paddingRight),
    bottom: r.bottom - num(s.borderBottomWidth) - num(s.paddingBottom),
  };
}

/**
 * 字（ふりがなを含む）の外接。text-layout の検査と同じく、1 行ごとの縦は字の大きさに詰める
 * （行間の分を含めない）。字が無ければ null
 */
function textExtent(el: Element): Box | null {
  const range = document.createRange();
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let out: Box | null = null;
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const t = n as Text;
    const p = t.parentElement;
    if (!p || !t.data.trim()) continue;
    const fs = num(getComputedStyle(p).fontSize) || 16;
    range.selectNodeContents(t);
    for (const q of Array.from(range.getClientRects())) {
      if (q.width <= 0 || q.height <= 0) continue;
      const cy = (q.top + q.bottom) / 2;
      const h = Math.min(q.height, fs);
      const b = { left: q.left, top: cy - h / 2, right: q.right, bottom: cy + h / 2 };
      out = out
        ? {
            left: Math.min(out.left, b.left),
            top: Math.min(out.top, b.top),
            right: Math.max(out.right, b.right),
            bottom: Math.max(out.bottom, b.bottom),
          }
        : b;
    }
  }
  return out;
}

/** 字が、この要素の内側と親の札の内側に入っているか */
function fitsInside(el: Element, card: Element | null): boolean {
  const t = textExtent(el);
  if (!t) return true;
  const inside = (b: Box) =>
    t.left >= b.left - FIT_TOLERANCE_PX &&
    t.right <= b.right + FIT_TOLERANCE_PX &&
    t.top >= b.top - FIT_TOLERANCE_PX &&
    t.bottom <= b.bottom + FIT_TOLERANCE_PX;
  return inside(innerBox(el)) && (!card || inside(innerBox(card)));
}

/** 字の大きさを u で書く（--fit-fs と data-fit。CSS は max(--fit-fs, --text-min)） */
function applySize(el: HTMLElement, u: number) {
  el.style.setProperty('--fit-fs', `calc(var(--u) * ${u})`);
  el.setAttribute('data-fit', String(u));
}

function clearFit(el: HTMLElement) {
  el.style.removeProperty('--fit-fs');
  el.removeAttribute('data-fit');
  el.removeAttribute('data-fit-overflow');
}

/** 札（親）を探す。祖先の [data-fit-box]、無ければ親要素 */
function cardOf(el: HTMLElement): Element | null {
  return el.parentElement?.closest('[data-fit-box]') ?? el.parentElement;
}

/** 測って決める。表示されていない（大きさが無い）ときは何もしない */
function runFit(el: HTMLElement, fromU: number) {
  if (el.getClientRects().length === 0) return;
  const s = getComputedStyle(el);
  const ts = num(s.getPropertyValue('--ts')) || 1;
  const floor = num(s.getPropertyValue('--text-min-u')) || FIT_FLOOR_FALLBACK_U;
  const card = cardOf(el);
  const r = searchFit(fromU * ts, floor, (u) => {
    applySize(el, u);
    return fitsInside(el, card);
  });
  applySize(el, r.u);
  if (r.overflow) el.setAttribute('data-fit-overflow', '');
  else el.removeAttribute('data-fit-overflow');
}

/** いまの大きさの印（これが前に測ったときと同じなら、測り直さない） */
function sizeKey(el: HTMLElement): string {
  const card = cardOf(el);
  const r = el.getBoundingClientRect();
  const c = card?.getBoundingClientRect();
  const f = (x: number) => Math.round(x * 2) / 2;
  return `${f(r.width)}x${f(r.height)}|${c ? `${f(c.width)}x${f(c.height)}` : '-'}`;
}

/**
 * fit の測り。useLayoutEffect（表示の前）・ResizeObserver（札・親の札の大きさ）・document.fonts.ready（字体が来たとき）で測る。
 * 揺れない（字の大きさを変えると札の大きさが変わって測り直しになる循環を止める）ための決まり:
 * - 測ったあとの大きさの印が前回と同じなら測り直さない
 * - 300ms 以内に 6 回測っても落ち着かないときは、最後に決めた値のまま止める
 */
function useFit(
  ref: { current: HTMLElement | null },
  fromU: number | undefined,
  /** 中身が変わったら測り直す印（文・段階・ふりがなの設定） */
  sig: string,
) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || fromU === undefined) return;
    let alive = true;
    let raf = 0;
    let last = 0;
    let streak = 0;
    let after = '';
    const measure = (force: boolean) => {
      if (!alive) return;
      if (!force && sizeKey(el) === after) return;
      const now = performance.now();
      streak = now - last < FIT_STREAK_WINDOW_MS ? streak + 1 : 0;
      last = now;
      if (streak >= FIT_MAX_STREAK) return;
      runFit(el, fromU);
      after = sizeKey(el);
    };
    measure(true);
    // 字体が来たら字の幅が変わる（最初の測りで字体の読み込みが始まるので、そのあとで待つ）
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    const onFonts = () => measure(true);
    void fonts?.ready?.then(onFonts);
    fonts?.addEventListener?.('loadingdone', onFonts);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          measure(false);
        });
      });
      ro.observe(el);
      const card = cardOf(el);
      if (card) ro.observe(card);
    }
    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      fonts?.removeEventListener?.('loadingdone', onFonts);
      clearFit(el);
    };
  }, [ref, fromU, sig]);
}

export interface AppLabelProps {
  /** 名前・題（《よみ》・分数の記法。Rt で描く） */
  text: string;
  /** 中身の段階。折り方を決める（札の持ち主の区分ではなく、名前の書き方の段階） */
  stage: StageId;
  ctx: LabelCtx;
  className?: string;
  /** 札の内側に字が入るまで fromU（× --ts）から 0.1u ずつ --text-min まで縮める */
  fit?: { fromU: number };
  testId?: string;
}

/** 札の名前・題。折り方と縮め方は上のとおり */
export function AppLabel({ text, stage, ctx, className, fit, testId }: AppLabelProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const wrap = labelWrap(stage, text);
  useFit(ref, fit?.fromU, `${stage}|${ctx.furigana}|${ctx.learnerGrade}|${text}`);
  const cls = ['app-label', fit ? 'app-label--fit' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <span
      ref={ref}
      className={cls}
      data-testid={testId}
      data-wakachi={wrap === 'wakachi' ? '' : undefined}
      data-spaced={wrap === 'spaced' ? '' : undefined}
      data-phrase={wrap === 'phrase' ? '' : undefined}
    >
      <Rt text={text} ctx={ctx} />
    </span>
  );
}
