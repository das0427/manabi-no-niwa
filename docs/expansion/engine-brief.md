# エンジン実装の共通の依頼（docs/expansion/engine-brief.md）

統括（Opus）が書いた、エンジン担当への共通の前提。個別の依頼文はこのファイルを読む前提で書く。

## 目的
単元の問題形式（エンジン）を、見本の choice・number と同じ約束で作る。教材パックの担当が、問題データだけを書けば使える状態にする。

## 必ず読むもの
- `src/engines/types.ts`（EngineDef・EngineProps・Judgement・RenderCtx の約束）
- `src/engines/choice/choice.tsx`、`src/engines/number/number.tsx`（見本の実装。judge・check・answerText・画面）
- `src/curriculum/types.ts`（ItemBase。問題の共通項目）、`src/engines/figure/types.ts`（図の記述）
- `src/units/UnitRunner.tsx`・`src/units/unitFlow.ts`（流れ。誤答・ヒント・解説・つぎへ は枠が受け持つ。エンジンは答えを `submit(response)` するだけ）
- `src/curriculum/qa.ts`（教材の自動検査。エンジンの `check` がここから呼ばれる）
- `docs/expansion/curriculum-matrix.md` 1章・2章（受入条件と正答の定義）、`docs/expansion/ux-by-age.md`（年齢別の操作）、`DESINGN.md`（寸法 u・色トークン・主操作の寸法 6u 以上・押せるものは木の札）、`docs/expansion/reviews/design-review-1.md`

## 約束
1. 各エンジンは `src/engines/<id>/` に置く: `<id>.tsx`（画面と EngineDef）、`<id>.css`、`<id>.test.ts`（判定と check の単体テスト）。
2. 問題の型は自分のファイルで `export interface <Id>Item extends ItemBase { engine: '<id>'; … }` と定義する（`ItemBase` は `src/curriculum/types.ts` から import）。**`src/curriculum/types.ts` の Item の和と `src/engines/registry.ts` には自分で足さない**（統括が最後にまとめて足す）。最終報告に、足すべき型名と EngineDef の名前を書く。
3. 判定は純粋関数（`judge(item, response)`）。正答の定義（順不同・集合一致・許容誤差・表記ゆれ）は問題データに持たせる。形式だけの違いは誤答にせず `{ result: 'retry', message }`。誤りの選択・入力に誤概念IDを結び付けられるようにする（`misconception`）。
4. `check(item)` で問題データの誤り（正答が無い・一意でない・範囲外・ID の不整合・誤りの選択肢が正答と等価 など）を日本語で返す。
5. 画面: タップだけで完結する（ドラッグ必須にしない。ドラッグできても、タップ→タップでも同じことができる）。hover・右クリック・ダブルクリック・長押しを使わない。押せるものは主操作の寸法（6u 以上）。`ctx.ux.noHoldOrDrag` が true（2〜3歳）のときはタップだけ。色だけで区別しない。`revealed` のときは正答を見せる。`disabled` のときは操作を受け付けない。`wrongMark` で誤りの印を付ける。
6. 文は `Rt`（`src/text/Rt.tsx`）で描く（ふりがな）。教材の文の漢字は必ず《よみ》付き。
7. 作業領域は 上15u〜下14u の間（UnitRunner の `.unit__work`）。はみ出さない。回答の操作部分が大きいときは number と同じく「左に図・右に操作」の配置にしてよい（`.unit__work--<id>` で CSS を書く）。
8. 依存パッケージを増やさない。色は CSS 変数（トークン）だけ。グラデーション・ぼかしの影は使わない（`npm run check:design`）。
9. 編集してよいのは `src/engines/<自分の id>/**` だけ。図の部品（`src/engines/figure/`）に足したいものがあれば、最終報告に提案として書く（統括が足す）。git のコミットはしない。

## 完了条件
- 各エンジンの単体テスト（判定・check・表記ゆれ・誤概念・境界）が通る。`npx tsc -b`、`npx eslint src/engines/<id>`、`npm run check:design` が通る（他の担当の作業中のファイルの誤りは除く）。
- 見本の問題データ（各エンジン2〜3問）を `src/engines/<id>/<id>.samples.ts` に書き、`checkItem` が誤りを返さないこと。統括がこれを使って画面で確かめる。
- 最終報告: 型名・EngineDef 名、判定の規則、画面の操作（タップの手順）、年齢による違い、未確認のこと、図の部品への提案。
