/**
 * 全画面の判定と呼び出し（docs/expansion/single-instance-design.md 2.4 節）。起動画面の「はじめる」と保護者画面「せってい」で使う。
 *
 * 全画面には2種類ある。
 * - ページの全画面: ページが requestFullscreen() で入る。Esc・F11・exitFullscreen() で戻る。
 * - ブラウザの全画面（窓の全画面）: 起動スクリプトが OS 経由で送る。F11 の全画面と同じで、ページからは戻せない。
 */

export type FullscreenMode = 'page' | 'window' | 'none';

/** ページの全画面か（document.fullscreenElement がある） */
export function isPageFullscreen(doc: Pick<Document, 'fullscreenElement'> = document): boolean {
  return !!doc.fullscreenElement;
}

type WindowLike = Pick<Window, 'innerWidth' | 'innerHeight' | 'screen' | 'matchMedia'> & {
  document: Pick<Document, 'fullscreenElement'>;
};

/**
 * ページの全画面ではないが、窓が全画面か。
 * `display-mode: fullscreen` が真、または窓の中身の大きさが画面の大きさと同じ。
 */
export function isWindowFullscreen(win: WindowLike = window): boolean {
  if (isPageFullscreen(win.document)) return false;
  try {
    if (win.matchMedia?.('(display-mode: fullscreen)').matches) return true;
  } catch {
    // matchMedia が使えなければ大きさの比べに進む
  }
  const s = win.screen;
  if (!s || !(win.innerWidth > 0) || !(win.innerHeight > 0)) return false;
  return Math.abs(win.innerWidth - s.width) <= 1 && Math.abs(win.innerHeight - s.height) <= 1;
}

export function fullscreenMode(win: WindowLike = window): FullscreenMode {
  if (isPageFullscreen(win.document)) return 'page';
  return isWindowFullscreen(win) ? 'window' : 'none';
}

/**
 * ページを全画面にする。ユーザー操作（タップ・キー）の中で呼ぶこと。
 * 失敗は飲み込んで false を返す（全画面にできなくても学習は続けられる）。
 */
export async function requestAppFullscreen(
  doc: Pick<Document, 'documentElement'> = document,
): Promise<boolean> {
  try {
    const el = doc.documentElement as { requestFullscreen?: () => Promise<void> | void };
    if (typeof el.requestFullscreen !== 'function') return false;
    await el.requestFullscreen();
    return true;
  } catch {
    return false;
  }
}

let fullscreenOnStart = false;

/** 引き継ぎで始まった画面（takeover）だけ、最初の「はじめる」で全画面にする。main.tsx が決める */
export function armStartFullscreen(on: boolean): void {
  fullscreenOnStart = on;
}

/**
 * 起動画面の「はじめる」のタップで呼ぶ。armStartFullscreen(true) のあとの1回だけ全画面にする。
 * タップのユーザー操作の中で呼ぶため、最初の await より前に呼ぶこと。
 * 呼んだら true。
 */
export function requestStartFullscreen(): boolean {
  if (!fullscreenOnStart) return false;
  fullscreenOnStart = false;
  if (isPageFullscreen()) return false;
  void requestAppFullscreen();
  return true;
}
