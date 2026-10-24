# 拡張 実装計画（docs/expansion/implementation-plan.md）

版 2.1-draft（2026-10-24） / 責任: Opus（統括）
前提: requirements.md・architecture.md・ux-by-age.md・acceptance.md・curriculum-matrix.md（P1 251 単元を凍結）・reviews/design-review-1.md（判断の正本）・progress.md（統括の判断）。

## 1. マイルストーン（中間受入: design-review-1 #25）

| M | 内容 | 中間受入 |
|---|---|---|
| M0 基盤 | 区分・支援設定・スキーマ2（済）、判定（数・ローマ字: 済）、RichText（済）、復習（済）、単元の型・エンジン枠・UnitRunner・図の部品・読み上げの組み立て・パックの読み込み・単元の索引・区分別ホーム・単元の地図 | 単体テスト、見本の単元1つ（g1.math.add-basic）を E2E で最後まで |
| M1 幼児＋おえかき | おえかき（全年齢）、p23・p4（再構成）・p5 の P1（33単元） | acceptance 3章の E2E、幼児の各区分で1単元以上を E2E |
| M2 小1・小2 | g1/g2 の国語・算数・漢字（kanji-g12）・生活・プログラミングの P1 | `curriculum:report` で対象パックの Q・C |
| M3 小3・小4 | g3/g4 の国語・算数・漢字・理科・社会・英語・プログラミングの P1 | 同上 |
| M4 小5・小6 | g5/g6 の同上 | 同上 |
| M5 統合 | 教材パックの取得と版の整合、移行、性能、回帰、独立レビュー、文書・README・ライセンス | acceptance 全体、最終報告（P1 達成率） |

## 2. 作業と担当（モデル・推論の強さ）

依頼のモデル方針: 基本の作業は Sonnet、重要・複雑な作業は Opus、最も難しい推論とレビューは Fable。各委任には目的・範囲・ファイル・資料・成果物・依存・完了条件・モデル・推論の強さを書く。

| ID | 作業 | 担当 | 強さ | 依存 | 並行 |
|---|---|---|---|---|---|
| T0-1 | 単元・問題の型、エンジン枠、UnitRunner、choice・number エンジン、読み上げの組み立て、見本単元 | Opus（統括） | high | — | — |
| T0-2 | 教材パックの分離（manualChunks、precache 除外、packs.json、check:packs）、パックのキャッシュ（mnw-pack/）、packsMeta、版の整合、保護者画面の取得 | Opus | high | パックの置き場所の規約（下の3章） | T0-1 と並行 |
| T0-3 | 設計文書へのレビュー判断の反映 | Opus | high | design-review-1 | 進行中 |
| T0-4 | 漢字配当表の独立検証（KANJIDIC2 等と照合） | Sonnet | high | — | 進行中 |
| T1-1 | おえかき（文書モデル items、インクの層、はんこ60種以上・6カテゴリ以上、図形7種、配置後の編集、undo/redo、保存・作品一覧・再編集、PNG、自動保存、zip 書き出し） | Opus | high | スキーマ2（済） | T0-1 と並行 |
| T1-2 | 残りのエンジン（order, match, sort, fill, build, trace, clock, measure, numberline, graph, geometry, map, reading, listen, program, experiment, explain）と図の部品 | Opus（設計）＋ Sonnet（実装） | high | T0-1 の枠 | エンジンごとに並行 |
| T1-3 | 幼児パック p23・p4・p5 | Opus | high | T0-1、T1-2 の一部 | パックごと |
| T2〜T4 | 小学校パック（curriculum-matrix 7章の26パックのうち小学校分） | 算数・国語の読解は Opus、知識・漢字・英語・生活は Sonnet | high | T0-1、T1-2 | 1回に最大6パック |
| T5-1 | 音声の生成（日本語 Open JTalk、英語 Kokoro）と check:audio の拡張 | Sonnet | medium | 各パックの台本 | パックの完成ごと |
| T5-2 | 独立レビュー（コード・教材の正しさ・UX） | Fable | high | M1・M3・M5 の終わり | — |
| T5-3 | E2E・移行・オフライン・性能の検証、文書 | Opus | high | M5 | — |

格上げの規則: Sonnet の成果がテスト・検査に2回落ちる、または教材の正しさ（学年配当・正答の幅・誤概念）に疑いがあるときは Opus で作り直す。設計の対立・正しさの判断が割れるときは Fable にレビューを依頼する。

## 3. 規約（並行作業の衝突を防ぐ）

- 教材パックは `src/packs/<packId>/`（packId は curriculum-matrix 7章の名前。例 `g1-math`、`kanji-g12`、`p4`）。入口は `index.ts`（`PackContent` を default export）。**パックは他のパックを import しない**。共有するコードは `src/engines/`・`src/curriculum/`・`src/core/` に置く。
- パックの担当は自分のパックの外を編集しない。エンジンや型の変更が要るときは統括に依頼する。
- 単元の索引（`src/curriculum/index.ts` の UnitMeta 一覧）は、パックの単元定義からスクリプトで生成する（手で二重に書かない）。
- 音声の台本はパックごと（`src/packs/<packId>/voice.json` を生成）。mp3 は `public/audio/<packId>/`。
- 問題データの検査（同一性キー・誤概念ID付与率・ふりがな・正答の一意・数の範囲）は共通の検査関数を各パックのテストから呼ぶ（`src/curriculum/qa.ts`）。

## 4. リスク

| リスク | 対策 |
|---|---|
| P1 251 単元の教材量（読解の本文約110本、探究の場面約180） | 生成器で賄える単元を先に。手作りは担当を分けて並行。未達は partial として正直に数える（P1 を P2 に落として数を合わせない） |
| 生成問題の音声 | 決まった言い回し＋数の読みの音声をつなぐ（読み上げの組み立て）。抑揚が不自然になる限界を記録 |
| 教材の正しさ | 生成器の seed 検査、正答の一意検査、誤概念の説明、Fable の教材レビュー（学年の抽出検査） |
| 容量（音声・書き順データ） | パックの遅延取得、音声 48kbps mono、書き順は学年別ファイル |
| 実機・子供の観察ができない | 最終報告で未確認として区別（Issue #12, #13） |
