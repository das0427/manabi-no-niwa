# 実装計画（implementation-plan.md）

版 1.0（2026-10-24） / 責任: Opus（統括）

## 1. 進め方

1. **共通基盤と1モード（おかいものごっこ）を縦に通す**（音声・タッチ・保存・オフラインを早期に検証）
2. 残り8モードを並列に展開（モードごとに担当とフォルダを分け、共有ファイルを同時に編集しない）
3. 保護者画面・がんばりノート・E2E・レビュー・文書・配布物

### 担当とモデル（実際に使う指定）

この環境の Agent ツールで指定できるモデルは `opus` / `sonnet` / `haiku` / `fable`、effort は `low`〜`max`。以下の指定で委譲する（委譲しない作業は Opus が直接行う）。

| 区分 | モデル / effort | 用途 |
|---|---|---|
| 統括 | Opus（このセッション） | 要件・学習設計・UX・アーキテクチャ・進度と判定の重要設計・統合・最終レビュー |
| 実装 | Sonnet / medium | 設計済みの画面・部品、教材データ、保存・音声の実装、テスト、文書 |
| 難所 | Sonnet / high | なぞり判定、経路判定、図形の回転・吸着、オフライン更新、横断修正、独立レビュー |
| 軽微 | Sonnet / low | 範囲が明確な修正、表記・リンクの確認 |

### 共有ファイルの規則
- `src/core/**`, `src/ui/**`, `src/app/**`, `src/styles/**`, `src/modes/registry.ts`, `src/content/vocab.ts`, `src/voice/catalog/common.ts` は **Opus が所有**。他の担当は編集しない（必要なら報告し、Opus が反映）。
- 各モード担当は `src/modes/<mode>/**` のみ編集。音声台本は `src/modes/<mode>/voice.ts` に書き、Opus が集約ファイルに登録済み。
- イラスト担当は `src/illust/<group>/**` のみ。登録表 `src/illust/registry.ts` は Opus が統合。

## 2. タスク一覧

| ID | タスク | 担当 / モデル / effort | 依存 | 完了条件 | 要件 |
|---|---|---|---|---|---|
| T00 | 雛形（Vite/React/TS、lint、format、Vitest、Playwright、トークンCSS、ハッシュルーター） | Opus | — | `npm run check` と `npm test` が通る | NF-01〜03 |
| T01 | 共通の型・乱数・位置均等化 | Opus | T00 | 単体テスト | M5-06 |
| T02 | 保存（IndexedDB・スキーマ・移行・書き出し/読み込み） | Sonnet / medium | T00, T01（型） | fake-indexeddb で単体テスト全件 | DA-01〜08 |
| T03 | 音声エンジン・効果音・台本の集約と出力スクリプト | Sonnet / medium | T00 | 単体テスト（停止・重複防止・欠損時代替） | VO-01〜08 |
| T04 | 進度ルール・おすすめ | Opus | T01 | 単体テスト | AD-01〜09, HM-03 |
| T05 | 実行枠（ModeRunner/セッション/回答ロック/選択式フロー）・共通UI・起動・ホーム・完了画面 | Opus | T01〜T04 | おかいもので動く | HM, OP, FB, CX |
| T06 | Service Worker・プリキャッシュ生成・更新・Zorin 配信スクリプト | Sonnet / high | T00 | 本番ビルドでオフライン再起動（E2E） | OF-01〜08, IN-01〜05 |
| T07a | イラスト: 食べ物・物（約20点） | Sonnet / medium | DESINGN.md | 一覧画面のスクリーンショットで規約を自己点検 | 素材 |
| T07b | イラスト: 動物・乗り物・自然（約24点） | Sonnet / medium | DESINGN.md | 同上 | 素材 |
| T07c | イラスト: 操作アイコン・モードの絵・プロフィールの絵 | Sonnet / medium | DESINGN.md | 同上 | 素材 |
| T08 | おかいものごっこ（縦の1本目） | Opus | T05 | 全段階・単体テスト・E2E | M1 |
| **I1** | **統合1**: 基盤＋おかいもの。音声・タッチ・保存・オフラインを確認 | Opus | T02〜T08 | E2E-01,02(shopping),10 が通る | — |
| T09 | ひらがな | Sonnet / medium | I1 | 全段階・単体・E2E | M2 |
| T10 | なかまわけ | Sonnet / medium | I1 | 同上 | M3 |
| T11 | かたち・パズル | Sonnet / high | I1 | 同上 | M4 |
| T12 | おぼえてさがす | Sonnet / medium | I1 | 同上 | M5 |
| T13 | くらべっこ | Sonnet / medium | I1 | 同上 | M6 |
| T14 | みちをつくろう | Sonnet / high | I1 | 同上＋全盤面の検証 | M7 |
| T15 | なぞってあそぼう | Sonnet / high | I1, 書き順データ | 同上＋判定テスト | M8 |
| T16 | さんすう | Sonnet / high | I1 | 同上＋全範囲の一致検査 | M9 |
| T17 | 保護者画面（記録・設定・作品・メモ・プロフィール・データ・更新） | Sonnet / medium | I1 | E2E-07〜09 | PA-01〜12 |
| T18 | がんばりノート | Opus | I1 | 表示確認 | CX-08 |
| T19 | 音声の全件生成・フォントのサブセット・書き順データ | Sonnet / high（素材パイプライン担当） | T03, 全モードの台本 | `check:audio` 成功 | VO-08, M2-04, M8-08 |
| **I2** | **統合2**: 全9モード＋保護者画面 | Opus | T09〜T19 | E2E 全件（両ブラウザ） | — |
| T20 | E2E 全シナリオとレイアウト自動検査・スクリーンショット | Sonnet / medium | I2 | test-plan.md 3章 | — |
| T21a | 独立レビュー: 学習設計・問題の妥当性・日本語/音声/素材の一貫性 | Sonnet / high（実装担当と別） | I2 | 指摘一覧 | 11章 |
| T21b | 独立レビュー: 子供の操作性・視覚デザイン（スクリーンショット） | Sonnet / high（別） | T20 | 指摘一覧 | DESINGN.md |
| T21c | 独立レビュー: 判定・データ保全・オフライン・互換・テストと要件充足 | Sonnet / high（別） | I2 | 指摘一覧 | — |
| T22 | 指摘の修正と再確認 | 該当担当 / Opus | T21 | 重大指摘0件 or 明記 | — |
| T23 | README・実機チェックリスト・素材ライセンス・クレジット | Sonnet / medium → Opus 確認 | I2 | — | IN, BC-05 |
| T24 | 配布 zip 作成・GitHub リポジトリ作成・push・Issues 登録 | Opus | T22, T23 | リポジトリURL、Release | RP |
| T25 | 最終レビューと完了報告 | Opus | 全部 | 報告12章の9項目 | — |

## 3. 要件 → 実装 → 検証 の対応（主なもの）

| 要件 | 実装 | 検証 |
|---|---|---|
| HM-01〜06 | src/app/Home.tsx, core/progress/recommend.ts | E-01, E-14, recommend.test |
| VO-01〜08 | core/audio/*, voice/catalog/*, scripts/voice/* | audio.test, check:audio, E-12 |
| OP-01〜07 | ui/*, core/session/useAnswerLock | E-02, E-03, E-15 |
| FB-01〜07 | core/session/useChoiceQuestion, ui/Feedback | 各モードの単体・E-02 |
| CX-01〜08 | app/ModeRunner, app/DoneScreen, app/Notebook | E-04, 手動 |
| AD-01〜09 | core/progress/rules.ts | rules.test |
| PA-01〜12 | src/parent/* | E-07〜09 |
| DA-01〜09 | core/storage/* | storage.test, backup.test, migrate.test, E-09, E-11 |
| OF-01〜08 | scripts/vite-plugin-precache.ts, public/sw 生成, core/offline | E-10, E-11 |
| M1〜M9 | src/modes/<mode>/* | 各 logic.test, E-02 |
| IN-01〜05 | deploy/zorin/* | 手動（Windows 上では構文確認のみ）・実機チェック |

## 4. 統合のタイミング

- **I1**（基盤＋おかいもの）: ここで音声・タッチ・保存・オフラインの成立を確認してから並列展開する。
- 並列展開中: 各モード担当は完了時に `npm run check && npm test` を通してから報告。Opus が受け取り次第、ホームからの導線・音声台本・E2E を統合する。
- **I2**（全モード）: 両ブラウザE2E、スクリーンショット、レビュー。

## 5. リスクと対応

| リスク | 影響 | 対応 |
|---|---|---|
| 生成音声の読み誤り・不自然さ | 子供が聞き取れない | `yomi` で修正、台本を保護者が差し替えられる形で残す。重要語（数字・助数詞）は全件聞いて確認 |
| イラストの品質・一貫性 | 教材の識別性 | 画風規約（DESINGN.md 6章）を厳密化、一覧画面で目視レビュー、修正の反復 |
| Firefox の SW・タッチ挙動 | オフライン・操作 | E2E を Firefox でも実行。実機のタッチは device-checklist に残す |
| 並列実装の不整合 | 体験がそろわない | 共通の実行枠・選択式フロー・部品を先に作り、モード担当はそれを使う規則 |
| なぞり判定の誤判定 | 子供が完成できない／近道で完成 | 判定幅を保護者が調整可能。判定のテストケースを先に定義 |
| 容量・保存失敗 | 記録の消失 | 書き出し、永続化要求、エラー表示 |
| Zorin 実機で未確認 | 導入失敗 | 標準の python3 のみに依存。スクリプトは実行前に表示して確認 |

## 6. 進捗管理

- GitHub Issues に T09〜T25 と残課題を登録（リポジトリ作成後）。
- このファイルの「状況」欄を統合時点で更新する。

| 区分 | 状況 |
|---|---|
| フェーズ1 要件 | 完了（2026-10-24） |
| フェーズ2 設計 | 完了（2026-10-24） |
| フェーズ3 計画 | 完了（2026-10-24） |
| フェーズ4 実装 | 全9モード・保護者画面・オフライン・配信スクリプト 完了（2026-10-24） |
| I1 統合1（基盤＋おかいもの） | 完了。ブラウザで最後まで遊び、記録・進度・完了画面を確認 |
| I2 統合2（全モード） | 完了。単体テスト全件成功、音声555件生成・読み確認、フォント縮小 |
| T20 E2E | 実施中 |
| T21 独立レビュー（a 学習設計・日本語 / b 操作性・見た目 / c 判定・データ・オフライン・テスト） | 実施中 |

### 実際の担当とモデル（記録）

| タスク | 実施 | モデル / effort |
|---|---|---|
| 調査 | サブエージェント | Sonnet / medium |
| 設計レビュー1 | サブエージェント（設計者と別） | Sonnet / high |
| 素材パイプライン（音声・フォント・書き順） | サブエージェント | Sonnet / high |
| T02 保存 / T03 音声 | サブエージェント | Sonnet / medium |
| T06 オフライン・配信 | サブエージェント | Sonnet / high |
| T07 イラスト（見本→3担当） | サブエージェント | Sonnet / medium |
| T00〜T01, T04〜T05, T08, T18, 統合 | Opus（統括） | Opus |
| T09 ひらがな / T10 なかまわけ / T12 おぼえて / T13 くらべっこ / T17 保護者画面 | サブエージェント | Sonnet / medium |
| T11 かたち / T14 みち / T15 なぞり / T16 さんすう | サブエージェント | Sonnet / high |
| T20 E2E | サブエージェント | Sonnet / medium |
| T21a〜c 独立レビュー | サブエージェント（実装担当と別） | Sonnet / high |
