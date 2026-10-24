# 拡張 設計レビュー1 と対応（docs/expansion/reviews/design-review-1.md）

- レビュー: Fable（独立レビュー、2026-10-24）。対象: requirements / architecture / ux-by-age / acceptance / progress、DESINGN.md 2.0、research/*、src/core/storage・progress・session、sw、precache プラグイン、illust。
- 対応の判断: Opus（統括）、2026-10-24。**この表が判断の正本**。各文書はこの表に合わせて改訂する（改訂済みの列で管理）。
- curriculum-matrix.md はレビュー時点で未作成。#6・#25 の数値は matrix 完成時に確定する。

## 重大

| # | 指摘（要旨） | 判断 | 反映先 |
|---|---|---|---|
| 1 | 2層ラスタ＋オブジェクトでは「後から描いた線がはんこの下に隠れる」 | **採用（新しい文書モデル）**: 手描きの線を「インクの層」として、はんこ・図形と同じ重なり順の列（`items`）に入れる。線を描き始めたとき、列の一番上がインクの層ならそこへ、そうでなければ新しいインクの層を一番上に作って描く。これで常に「後から描いたものが上」になり、はんこ・図形は置いた後も選択・移動できる（要件の配置後の編集を維持）。インクの層の上限は 6 枚。超えるときは一番下のインクの層とその下のオブジェクトを背景の層に焼き付ける（焼き付いたものは動かせない。保護者向けの説明に記載）。`under/over` の2層と「うえに かく」は廃止 | architecture 7.1–7.3, requirements X-ED-01, DESINGN 19, acceptance 3章（線→はんこ→線の見た目の順序 E2E） |
| 2 | 塗りつぶしがオブジェクトを境界にしない → 図形の中を塗ると全面に流れる | **採用**: 境界は「背景＋全アイテムの合成結果」で判定し、書き込み先は塗った位置の一番上のインクの層（無ければ新しく作る）。合成の読み取り用キャンバスは `willReadFrequently: true` | architecture 7.1, acceptance 3章（図形の中を塗る） |
| 3 | 消しゴムではんこが消えないことを幼児が理解できない | **採用**: かんたん では消しゴムで触れたオブジェクトをそのまま消す（短い音と縮む演出、undo 可）。くわしく では触れたオブジェクトを選択状態にして「けす」札を出す（線は通常どおり消える） | architecture 7.1, requirements X-ED-05, ux-by-age 2.6 |
| 4 | 新コアの install をパック再取得に結び付けると更新不能・巨大ダウンロード・既存の cleanupCaches で消える | **採用**: install はコアだけで完了。パックは別接頭辞 `mnw-pack/`（例 `mnw-pack/g3-sansu@<hash>`）で cleanupCaches の対象外。取得した hash は packsMeta（IndexedDB）に記録。起動時にコアの `packs.json` と比較し、hash が違う単元は開かない（子供には「あたらしい きょうざいを とってきてね」、保護者画面で一括再取得）。再取得はバックグラウンドで進捗表示、失敗しても旧パックは消さず学習を止めない（ただし版の違うパックは開かない）。`packs.json` に無いパックのキャッシュは削除して記録 | architecture 6章, requirements X-OF-03 |
| 5 | プリキャッシュとチャンク分割の現状では「パックの分離」が成立しない | **採用**: `manualChunks` でパック配下を `packs/<id>/` に閉じ込める。パック間で共有するコードは `engines/`・`core/` に置いてコアに含める規約。`check:packs` で「パックの入口から辿れるチャンクが、コアかそのパック自身だけ」を機械検査。precache プラグインは `assets/packs/**`・`audio/<packId>/**` をコアの FILES から除外し、`packs.json { files, bytes, hash }` を出力。コアの版IDにパックの内容を含めない | architecture 6章, implementation-plan |
| 6 | 受入条件が「P1 を狭めれば通る」構造。網羅の下限が無い | **採用**: (1) matrix 完成時に P1 一覧を凍結（版・日付）。以後の P1→P2 の変更は理由・日付を acceptance に記録し独立レビューを通す。(2) 網羅の下限を機械検査: 各学年の国語・算数で学習指導要領の各領域に ready 単元が1つ以上、単元数の下限、自力練習の異なる問題の下限（手作り N≥8、生成は seed 20 本で異なる問題 ≥N）。(3) `curriculum:report` の出力形式（学年×領域の表）を固定。数値は matrix 完成時に確定 | acceptance 2章, curriculum-matrix |
| 7 | 「2本目の指で線を取り消す」は手を置く幼児の線を消す | **採用**: `isPrimary` 以外のポインタは無視（描いている線は続ける）。`pointercancel` でも描いた分を確定。2本指判定は持たない | architecture 7.2, acceptance 3章 |
| 8 | 2歳段階に v1 の進度判定・正誤の記録をそのまま適用している | **採用**（progress.md 統括の判断1と同じ）: toddlerStage=2 では `evaluate` を呼ばない（段階は保護者が固定。既定は最初の段階）。attempts は記録するが、保護者画面では「あそんだ内容」としてだけ見せる（正誤・ヒント数・「むずかしそう」を出さない）。利用時間の既定 5分（目安） | requirements X-AD-01/X-TG-05, ux-by-age, src/audience（recordMastery=false 実装済み） |

## 中

| # | 指摘（要旨） | 判断 | 反映先 |
|---|---|---|---|
| 9 | 自動保存が pagehide に依存。persist() が無い | **採用**: 操作の区切りごとの保存（1.5秒後）を正とする。PNG は待機中に先に作って保持。pagehide ではアイテムの JSON とダーティ印だけを書き、再開時に「つくりかけ」として開く。初回のおえかき保存時に `navigator.storage.persist()` を要求（既存の requestPersist を使う） | architecture 7.4 |
| 10 | はんこの SVG 埋め込みの具体が無い（TSX→SVG、Firefox の drawImage、重複） | **採用**: ビルド時に illust を `renderToStaticMarkup` で文字列化し `stamps.json`（id, version, category, svg（width/height=100 を付与））を生成。`check:design` で 60種以上・6カテゴリ以上を検査。文書は `assets: Record<"<stampId>@<ver>", svg>` を1つ持ち、オブジェクトはキーで参照。画像化は (キー, 表示サイズ段階) でキャッシュ | architecture 7.1, scripts |
| 11 | 選択・ハンドル・操作札の破綻（連打で奥へ循環、細い線に当たらない、画面外の札、移動の札が無い） | **採用**: 循環選択は くわしく のみ（かんたん は常に最前面）。当たり判定は「不透明な画素 または 中心から 2.75u 以内 または 線から 2u 以内」。操作札は枠の下→上→道具欄の順に退避。移動は「選択中に空いた所をタップ → そこへ移動」を かんたん の既定、くわしく は矢印札も | architecture 7.1, DESINGN 19, requirements X-ED-02/X-ST-06 |
| 12 | ふりがな規則（在籍学年の字、学習対象の字の答えが漏れる、'none' と未習漢字の矛盾） | **採用**: ① 在籍学年**以上**の配当漢字に付ける（progress.md 判断3で決定済み、実装済み）。② RichText に `漢字《!かんじ》`（よみは音声に使うが表示しない＝学習対象）を追加し、読み単元の答えの漢字は抑制していることを検査。③ `'none'` は配当学年 ≤ 在籍学年の字にだけ効く（上の学年の字には常に付く） | architecture 4章, src/text, src/audience |
| 13 | 数の答え: 中立の「もう一度」が questionFlow に無い、浮動小数、答えの種類の不足 | **採用**: 判定は有理数で正確に比較（実装済み: src/core/answer/number.ts、retry 判定あり）。questionFlow に `nudge()`（wrongTries を増やさず短い声を返す。同じ問題で2回まで、3回目は wrong）を追加。NumberAnswer に `quotientRemainder`・`ratio{mustSimplest}`・`set` を追加 | architecture 5.1, core/session |
| 14 | 復習の滞留・優先順位・期限超過 | **採用**: 優先度＝超過日数×（後続単元の数＋1）。おすすめに出す復習は同じ教科1日1件まで、残りは単元の地図の時計の印。超過が間隔の2倍以上なら reviewStep を1つ戻す（段階は下げない）。復習用に「別の表現の問題 ≥2 種」を単元の ready 条件に含める | architecture 3章, src/curriculum/review.ts, acceptance 2章 |
| 15 | 移行の抜け（新ストアの紐付け・削除、upgrade 内の await、対応表） | **実装で対応済み**（スキーマ2, コミット a25832d）: 新ストアを RECORD_STORES・バックアップに追加、プロフィール削除で作品の画像も削除、artworkBlobs に profileId/artId の索引、upgrade は IDB リクエストだけ（await なし）。v1 の進度は**変換しない**（旧記録）ため対応表は不要。将来変換する場合は `curriculum/legacyMap.ts` を1つだけ持つ | architecture 9章 |
| 16 | バックアップ上限 50MB と作品の容量が両立しない | **採用**: 書き出しを zip（無圧縮の自前実装。PNG は既に圧縮済みのため。依存を増やさない）にする: `backup.json`（記録と作品の文書）＋ `artworks/<artId>-<kind>.png`。読み込みは .json（v1・記録のみ）と .zip の両方を受け付け、zip の上限は 500MB。作品の画像は JSON に入れない | architecture 7.4/9章, requirements X-SV-04 |
| 17 | 英語音声の手段が未定 | **解決済み**: Kokoro-82M（Apache-2.0）で生成し mp3 を同梱（docs/assets-pipeline.md 5節）。聴感は未確認のため、英語単元は試聴して問題が無いものだけ ready にする。speechSynthesis には頼らない | acceptance 2章 |
| 18 | WCAG「大きな文字」の条件の記述が誤り | **採用**: 太さ 700 なら 18.67px 以上、500 以下なら 24px 以上を大きな文字とし、想定の最小 u=12.8px で判定。ふりがな（1.1u）と補助の文字（1.7u）は常に 4.5:1 | DESINGN 3.1, check:design |
| 19 | DESINGN 第1部と第2部の矛盾（漢字禁止、leaf の○、重複） | **採用**: 4章・14章を「幼児区分と幼児向けパックに適用」と限定、check:design を区分別の許可リストに。8章の leaf → correct。3.1 の重複を削除 | DESINGN |
| 20 | 幼児の教材を別パックにすると初回オフラインが後退 | **採用**: toddler/p4/p5 の教材はコアに同梱。小学生は、初回準備画面を「コア → そのプロフィールの区分の既定パック」の2段階にし、両方そろうまで準備完了にしない | architecture 6章 |
| 21 | 数字キーが下帯 10u に収まらない | **採用**: 数の入力の単元は、作業領域の右 1/3 に数字キー（3×4＋機能の列）を置く別の区画を DESINGN 18章に定義。ヒント左下・つぎへ右下は不変。125%/150% のはみ出し E2E に含める | DESINGN 18, ux-by-age 2.4 |
| 22 | 漢字フォントの容量・配信 | **採用**: 配当漢字 1026 字＋画面で使う漢字のサブセットを「小学生用フォント」として1組作り、小学生のプロフィールで FontFace で読み込む（コアのキャッシュに含める）。パックごとの分割はしない。容量は fonts:build の出力で記録 | architecture 11章 |
| 23 | 2歳段階のホームが多すぎる・親子の案内が無い | **採用**: 2歳段階は札 4 枚（2×2）＋おえかき、おすすめは出さない。起動ごとに保護者向けの短い案内（1タップで閉じる） | ux-by-age 2.1, requirements X-TG-05 |
| 24 | 受入条件の抜け | **採用**: 指摘の項目を acceptance 1・3・4章に追加し、A-01〜A-10 との対応を付ける | acceptance |
| 25 | 実装量が受入条件に対して現実的か | **採用**: 中間の受入を置く（M1 幼児3区分＋おえかき、M2 小1〜2、M3 小3〜4、M4 小5〜6、M5 統合）。progress.md に「ready 単元数／P1 総数」を毎回記録。生成器で賄う単元と手作りの単元を matrix で分ける | implementation-plan, progress |

## 軽微（すべて採用）

| # | 判断 |
|---|---|
| 26 | パックのキャッシュ名は `mnw-pack/<packId>@<hash>`（'@' で分解。packId に '@' を使わない） |
| 27 | 色札を押すと色名を短く読み上げる（効果音の設定に従う） |
| 28 | おちついた表現の色を `--paper-calm` / `--ink-calm` / `--ink-soft-calm` として表に載せる |
| 29 | かんたん の色数・太さは ux-by-age 1章を正本とし（2〜3歳: 色6・太さ2、4歳以上: 色8・太さ3）、他は参照 |
| 30 | PNG 書き出しは論理 1600×1000 の合成から、背景色を含めて（透明にしない）。寸法を E2E で検査 |
| 31 | UnitRunner の中断データのキーは `[profileId, unitId]`。生成問題は seed と番号で再現、手作り問題の並びも seed で決める |
| 32 | 「ほかの がくねん」±1 は表示の初期範囲。学年タブで全学年へ行ける。保護者が閉じた単元だけ出ない |
| 33 | 同じ作品を2つのタブで開いたとき、`updatedAt` で古い方の保存を止め「べつの がめんで かいています」 |
| 34 | 2歳段階は正誤の効果音を鳴らさず、行動の実況（「おいたね」）だけ |
| 35 | 学習連携の作品は artworks に origin 付きで保存し attempts を作らない。UnitRunner では「描いた＝完了」 |
