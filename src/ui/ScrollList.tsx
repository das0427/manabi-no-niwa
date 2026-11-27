/**
 * 縦にスクロールする一覧の枠（アプリの画面: 単元の地図・ノート・作品の一覧 …）。text-layout-fixes「アプリの画面」A0。
 *
 * 作り（外から順に）:
 *   .scroll-list（className。位置と大きさ。高さが決まっていること: absolute の top・bottom か、flex: 1 1 0 ＋ min-height: 0）
 *     ├ .scroll-list__region（data-scroll-region="list"。スクロールする枠。testId・aria-label。下まで見ていないあいだ data-scroll-cue）
 *     │   └ .scroll-list__body（bodyClassName。一覧の並べ方 = grid・flex・padding。中身の高さで伸びる）
 *     ├ ▼ の印（小学生。右の余白 3.6u。下まで見ていないあいだだけ）
 *     └ ▲▼ の札（幼児 p23・p4・p5。右の余白 7u。補助 5.5u。data-scroll-btn。端では visibility: hidden）
 *
 * 2〜3歳はドラッグを使わず、4・5歳も指でのスクロールに頼らない（ux-by-age 1章）ので、幼児には ▲▼ の札を置く。
 * 押すと枠の見える高さの 0.8 だけ動く（動きを減らす設定では滑らかにしない）。
 * スクロールバーは隠す（環境で幅が変わらないように。印と札で示す）。位置は scroll と ResizeObserver で見る。
 */
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { StageId } from '../curriculum/types';
import './app-label.css'; // アプリの画面の --text-min（▼ の印の大きさ）。AppLabel を使わない画面でも効かせる
import './scroll-list.css';

/** ▲▼ の札を置く区分 */
const BUTTON_VIEWERS: ReadonlySet<StageId> = new Set(['p23', 'p4', 'p5']);
/** 1 回に動く量（見える高さの何倍か） */
export const SCROLL_PAGE = 0.8;
/** 端とみなす余裕（px） */
const EDGE_PX = 2;

export interface ScrollListProps {
  /** 見ている子供の区分。p23・p4・p5 なら ▲▼ の札、それ以外は ▼ の印 */
  viewer: StageId;
  /** 外側の枠（位置と大きさ） */
  className?: string;
  /** 一覧の並べ方（grid・flex・padding）を決めるクラス */
  bodyClassName?: string;
  /** スクロールする枠の名前（読み上げ） */
  label: string;
  testId?: string;
  children?: ReactNode;
}

/** 動きを減らす設定か（AppState が html に reduce-motion を付ける。システムの設定も見る） */
function reduceMotion(): boolean {
  return (
    document.documentElement.classList.contains('reduce-motion') ||
    (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  );
}

export function ScrollList({
  viewer,
  className,
  bodyClassName,
  label,
  testId,
  children,
}: ScrollListProps) {
  const regionRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const buttons = BUTTON_VIEWERS.has(viewer);
  /** up: 上に見えていない所がある。down: 下に見えていない所がある */
  const [edge, setEdge] = useState({ up: false, down: false });

  const update = useCallback(() => {
    const r = regionRef.current;
    if (!r) return;
    const up = r.scrollTop > EDGE_PX;
    const down = r.scrollTop + r.clientHeight < r.scrollHeight - EDGE_PX;
    setEdge((p) => (p.up === up && p.down === down ? p : { up, down }));
  }, []);

  useLayoutEffect(() => {
    const r = regionRef.current;
    if (!r) return;
    update();
    r.addEventListener('scroll', update, { passive: true });
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(r);
      if (bodyRef.current) ro.observe(bodyRef.current);
    }
    return () => {
      r.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  }, [update]);

  const move = (dir: -1 | 1) => {
    const r = regionRef.current;
    if (!r) return;
    const top = dir * r.clientHeight * SCROLL_PAGE;
    const behavior = reduceMotion() ? 'auto' : 'smooth';
    if (typeof r.scrollBy === 'function') r.scrollBy({ top, behavior });
    else r.scrollTop += top;
  };

  const cls = ['scroll-list', className ?? ''].filter(Boolean).join(' ');
  const hidden = { visibility: 'hidden' } as const;
  return (
    <div className={cls} data-buttons={buttons ? '' : undefined} data-viewer={viewer}>
      <div
        ref={regionRef}
        className="scroll-list__region"
        role="region"
        aria-label={label}
        tabIndex={0}
        data-testid={testId}
        data-scroll-region="list"
        data-scroll-cue={edge.down ? '' : undefined}
      >
        <div
          ref={bodyRef}
          className={['scroll-list__body', bodyClassName ?? ''].filter(Boolean).join(' ')}
        >
          {children}
        </div>
      </div>
      {buttons ? (
        <>
          <button
            type="button"
            className="tap tap--aux scroll-list__btn scroll-list__btn--up"
            aria-label="うえへ"
            data-scroll-btn="up"
            data-testid={testId ? `${testId}-up` : undefined}
            style={edge.up ? undefined : hidden}
            onClick={() => move(-1)}
          >
            ▲
          </button>
          <button
            type="button"
            className="tap tap--aux scroll-list__btn scroll-list__btn--down"
            aria-label="したへ"
            data-scroll-btn="down"
            data-testid={testId ? `${testId}-down` : undefined}
            style={edge.down ? undefined : hidden}
            onClick={() => move(1)}
          >
            ▼
          </button>
        </>
      ) : edge.down ? (
        <span className="scroll-list__cue" aria-hidden>
          ▼
        </span>
      ) : null}
    </div>
  );
}
