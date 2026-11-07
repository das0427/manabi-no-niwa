/**
 * アプリがほかのページの枠（iframe）の中で開かれているか。
 * 配信（serve.py）は X-Frame-Options・frame-ancestors で枠に入れさせないが、ほかの配り方
 * （開発サーバー・ほかの静的サーバー）でも保護者の操作を枠の中から押させないように、アプリ側でも確かめる
 * （クリックジャッキング。docs/expansion/updater-design.md 5.4 節）。
 */
export function isFramed(win: Pick<Window, 'self' | 'top'> = window): boolean {
  try {
    return win.self !== win.top;
  } catch {
    // ほかのオリジンの枠の中では、window.top を読めないことがある
    return true;
  }
}
