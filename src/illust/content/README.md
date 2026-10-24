# 教材パックの絵（src/illust/content/）

教材パックの担当が描いた絵を置く。1パック1ファイル（`<packId>.tsx`）で、`IllustGroup`（`../types`）を export する。
`registry.ts` が自動で読み込む（登録表を編集しない）。画風は DESINGN.md 6章（輪郭 INK・太さ 3.5・平塗り・`palette.ts` の色だけ・文字を描き込まない）。
絵の id は全体で一意（既存の id と重ならないこと。重なると起動時にエラー）。
