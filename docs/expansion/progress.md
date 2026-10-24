# 拡張作業の進捗記録（progress.md）

長期作業の引き継ぎ用。判断・進捗・残課題・次の作業をここに追記する（新しいものを上に）。

## 基準
- 初期版（4歳向け）: タグ `v1.0.0`（コミット 6e317d6）。テスト結果は docs/test-results-v1.md。GitHub Release: https://github.com/das0427/manabi-no-niwa/releases/tag/v1.0.0
- 拡張ブランチ: `expansion`（main から分岐）。PR で main へ統合する。

## 進捗

### 2026-10-24
- [完了] 初期版の E2E 全件・基準コミット・タグ・Release
- [完了] 調査メモ6本（docs/expansion/research/）: 小学校 国語・算数／その他教科、幼児、他社ベンチマーク、配色・アクセシビリティ、おえかき
- [進行中] 調査の統合（research.md, design-benchmark.md）、単元対応表（curriculum-matrix.md）
- [進行中] 要件・UX・アーキテクチャ・DESINGN.md 改訂・受入条件・計画

## 重要な判断（理由は各文書）
- 2〜3歳は親子利用を前提に入口を1つにし、内部で2歳段階・3歳段階を分ける（research/early-childhood.md）。
- はんこ・図形は「確定後も再編集できるオブジェクト」として保存する（要件。research/drawing.md の推奨案Cとは異なる判断）。
- ローマ字は令和7年内閣告示第4号（ヘボン式に準ずる）を現行として扱う（research/elementary-japanese-math.md）。
- 次期学習指導要領（審議まとめ 2026-10-05、小学校全面実施は令和12年度想定）は未施行として扱い、現行（平成29年告示）に基づく。

## 残課題・未確認
- 実機（Yoga 720 / Zorin）と子供の観察は未実施（Issue #12, #13）
