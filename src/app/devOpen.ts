/**
 * 開発用の指定 `?dev-open`（開発サーバーだけ。本番ビルドでは式ごと消える）。
 *
 * アプリの全画面の配置の検査（npm run check:app-layout。docs/test-plan.md 3.3）と、目で見るための入口。
 * 起動画面の「はじめる」と保護者ゲートを通らずに、hash で開いた画面をそのまま出す。
 *   http://127.0.0.1:<port>/?dev-open#/explore/p4
 *   http://127.0.0.1:<port>/?dev-open#/parent/settings
 * - `started`（音声を有効にしたか。VO-05）の初期値を true にする。音は鳴らない（audio.unlock を通らない）。
 * - 保護者画面の hash（#/parent…）で開いたときは、`parentUnlocked` の初期値も true にする。
 *   保護者画面から子供画面へ移るとゲートは閉じる（今までどおり）。
 * `import.meta.env.DEV` が false の本番ビルドでは、DEV_OPEN は false に畳まれ、'dev-open' の文字も残らない。
 */
export const DEV_OPEN: boolean =
  import.meta.env.DEV &&
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).has('dev-open');

/** 起動時の hash が保護者画面か（DEV_OPEN のときだけ true にしてよい） */
export function devOpenParent(): boolean {
  return DEV_OPEN && location.hash.startsWith('#/parent');
}
