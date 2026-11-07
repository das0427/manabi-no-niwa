# テスト計画（test-plan.md）

版 1.0（2026-10-24） / 責任: Opus（統括）

## 1. 方針

- **判定・生成・進度・保存は純粋関数として単体テスト**（Vitest）。UI はE2E（Playwright）で主要フローを確認。
- 生成問題は **seed 1〜200 × 全段階** で検査し、失敗時はテスト名に seed と段階を出して再現できるようにする。
- 検証結果は3種に分けて報告する（NF-10）:
  - **自動検証済み**: Vitest / Playwright（開発PC: Windows 11 上の Playwright 同梱 Chromium・Firefox）
  - **手動確認済み**: 開発PC上でスクリーンショットを見て確認したもの
  - **実機未確認**: Yoga 720 + Zorin でしか確認できないもの（docs/device-checklist.md）
- ブラウザ自動化によるタッチの模擬（`hasTouch`, `tap()`）は、実機の指操作の確認ではない。
- 4歳児の操作性・学習効果・継続性は観察していないため、検証済みとしない。

## 2. 単体テスト（Vitest）

| 対象 | 主な検査 | 要件 |
|---|---|---|
| core/util/rng | seed の再現性、shuffle の偏り（χ²程度の簡易検査）、balancedPositions（同じ位置3連続なし、各位置の出現差≤1） | M5-06 |
| core/progress/rules | 1問では上下しない、8/10で進む、戻る条件、固定時は変化なし、abandoned を窓に入れない、変化後の窓リセット、2択でランダム解答の通過確率の算出 | AD-01〜08 |
| core/progress/recommend | 2〜3件、同日同結果、今日2回以上遊んだモードを除く、領域の偏りなし、初回の既定 | HM-03 |
| core/storage | 各ストアの読み書き（fake-indexeddb）、プロフィール間で記録が混ざらない、attempts の上限削除 | PA-10 |
| core/storage/migrate | v0（仮の旧形式）→ v1 の移行、新しすぎる版の拒否 | DA-02, DA-03 |
| core/storage/backup | 書き出し→読み込みで同じ内容、追加モードでIDが重複しない、置き換えモード、形式不正・サイズ超過・型不正の拒否（何も変更しない） | DA-04〜06 |
| core/audio | 再生中に新しい再生で前が止まる、stopAll、欠損キーの代替、音声キーが台本に全て存在 | VO-03, VO-07 |
| voice catalog | 全キーに文がある、mp3 マニフェストとの突き合わせ（`npm run check:audio`） | VO-01, VO-08 |
| modes/shopping | 生成範囲（段階ごとの個数・種類）、判定（順不同・過不足）、合計の表示と読み上げキーの一致 | M1 |
| modes/hiragana | 選択肢に似た字の組がない（H1/H2）、語頭が正しい、言葉づくりのタイルに正解の字が全て含まれる、収録表の整合 | M2 |
| modes/sorting | 各回の絵が基準でちょうど1つの箱に属する、N4 は両基準で一意 | M3 |
| modes/shapes | 対称性の一致判定（しかく4・ながしかく2・まる∞・直角三角形1）、吸着の距離、全教材に解がある | M4 |
| modes/memory | 答えが選択肢に必ず1つ（B3は2つ）ある、正解位置の均等化、同じ回で同じ答えを使わない | M5 |
| modes/compare | 差の下限、おなじ問題は完全一致、問いの向きが半々、P5 の順序の一意性、描画寸法の比が逆転しない | M6 |
| modes/road | 全盤面: 初期は未接続・参考解で接続・空きマスのみ使用。接続判定（相互開口・端・回転・分岐・循環・複数経路）、止まる地点の決定性 | M7 |
| modes/trace | 正しいなぞりで完成、はみ出し（r以内）許容、近道で未完成、点だけで未完成、塗りつぶしで未完成、逆向きで未完成、途中で離して再開して完成、ひとつもどす | M8 |
| modes/math | 全範囲で 数・式・読み上げキー・絵の個数・答えが一致、負数なし、0 は B2/C2 のみ、分解の全有効解、E の解放条件 | M9 |

### 2.1 設計レビュー1で追加した単体テスト

| 対象 | 検査 | 要件 |
|---|---|---|
| core/progress/rules | 状態表（architecture 4.3）の全行。after_review・self_corrected が戻る判定に入らない。operationIssue の問題が窓に入らない。判定はラウンド終わりだけ。変化後の最低問数（進む10・戻る8）。2択ランダム解答・4問/回・10回の累積で誤って進む確率をシミュレーションで算出し、結果を本書に記録 | AD-04, AD-05, AD-07 |
| core/session/useChoiceQuestion | 1.5秒以内の3回以上の選択で operationIssue。最初の読み上げ中の選択は無効。ヒント2の後に「つぎへ」 | OP-05, FB-02 |
| modes/trace | 順序つき追跡: 正しいなぞり／r 以内のはみ出し／直線の近道／ループの中心を横切る線（る・ろ・の）／点を打つだけ／往復の塗りつぶし／逆向き／途中で離して再開／速い動き（点の間隔40）／閉じた形 | M8-04〜06 |
| modes/road | スタート・ゴールの開口、止まる場所の同点規則、タップで回転（道具に関係なく）、けす | M7-05 |
| modes/math | 0 を出さない段階で選択肢にも 0 がない。D1 は n=3〜5 | M9-05 |
| core/storage/migrate | 移行の途中失敗で元データが残る、VersionError の扱い | DA-03 |
| check:design | DESINGN.md 14章の自動検査 | BC-01, DESINGN |

### 2.2 測定結果の記録

- でたらめに押した場合に誤って段階が進む確率（src/core/progress/rules.test.ts のシミュレーション。1回4問×10回=40問、20000試行、操作のとまどいによる除外は考えない厳しめの条件）:
  - 2択: 進む条件を「10件中8件」にすると 28.5%。偶然の確率が 0.34 を超える段階は「10件中9件」にした結果 **7.3%**
  - 3択（10件中8件）: **2.4%**
  - 誤って進んでも、戻る規則と保護者の固定で戻せる。連打は operationIssue として窓から除外されるため、実際の確率はこれより低い。

## 3. E2E（Playwright: Chromium・Firefox）

本番ビルド（`vite build` → `vite preview --host 127.0.0.1`）に対して実行。

| ID | シナリオ | 要件 |
|---|---|---|
| E-01 | 起動→はじめる→ホーム。9モードの札がある。横スクロールがない | HM-01, HM-06 |
| E-02 | 全9モード: 開始→1問誤答→ヒント表示→正解→…→完了画面→おうち（タップのみ） | OP-01, 各M |
| E-03 | 連打: 選択肢を連続10回クリックしても記録は1問1件、遷移は1回 | OP-05 |
| E-04 | 途中でおうち→同じモード→つづきから で同じ問題番号から | CX-03 |
| E-05 | なぞり: マウスの軌跡で1題完成→作品一覧に表示 | M8-10, PA-07 |
| E-06 | みち: 道を置いて しゅっぱつ→到着／止まる。じゆうで作品保存→再表示 | M7 |
| E-07 | 保護者ゲート: 長押し→確認問題→保護者画面。短い押下では開かない | PA-01 |
| E-08 | プロフィール2つ: それぞれで遊び、記録が混ざらない（2.1.0 から、保護者画面の「こどもの画面へ」のあと「だれが あそぶ？」で遊ぶ子を選ぶ手順を含む） | PA-10 |
| E-09 | 書き出し→全削除→読み込み（追加）で記録が戻る | DA-04〜06 |
| E-10 | オフライン: SW準備完了→ **配信サーバーを停止**（`setOffline` だけに頼らない）→ 再読み込み→全9モードを開始できる | OF-03 |
| E-11 | 更新: 版を変えたビルドで再起動→データが残る、更新ボタンで新版に | OF-04〜06 |
| E-12 | 音声: 画面遷移で前の音声が止まる（AudioEngine の状態を `__mnw` で確認） | VO-04 |
| E-13 | 外部通信なし: 全シナリオで 127.0.0.1 以外へのリクエストがない | BC-03 |
| E-14 | 画面サイズ: 1920×1080, 1536×864, 1280×720 で主要画面のスクリーンショット。主操作の大きさ（6u相当以上）と横スクロール・はみ出しを自動検査 | HM-06, OP-03 |
| E-15 | タッチ相当: `hasTouch` のコンテキストで tap 操作により全モード完了（Chromium）。なぞりは CDP のタッチ入力で1題完成。Firefox のタッチ模擬は制約として記録 | OP-01, OP-06 |
| E-16 | 利用時間の目安: 時計を進めて到達→区切りで「きょうは ここまで」。なぞりの途中では出ない。2.1.0 から単元の完了でも確かめる（`e2e/ux-f1.spec.ts`。区分 10 通りで合図が出て「もういちど」が出ない・届かなければ出ない・新しいプロフィールの区分の既定） | CX-04, CX-07 |
| E-17 | 動きを減らす: `prefers-reduced-motion` をエミュレートし、うさぎの歩行などが一度に表示される | FB-07 |
| E-18 | 保護者画面: 未実施／むずかしそう／そうさに とまどった の表示が分かれる | PA-04, PA-09 |
| E-19 | 更新時に旧タブが開いたまま: 旧タブで未読込のモードを開ける（直前の版のキャッシュ） | OF-05 |
| E-20 | 配信スクリプト `deploy/zorin/serve.py`: 127.0.0.1 のみで待ち受け、MIME（.webmanifest .woff2 .mp3 .js）と Cache-Control、識別用の `/__manabi/health` | IN-03 |
| E-21 | 自動更新（`e2e/update.spec.ts`。chromium だけ。`npm run e2e:update`。本物のビルド 2 つ・本物の serve.py・偽の GitHub。12 件）: 2.1.0 → 自動の確認 →「更新する」1 回 → 2.2.0（記録・教材パックが残る、変わらない音声の zip は取らない、書いたのは決めた場所だけ、ブラウザは配信以外へ通信しない）。音声の部品も変わる版・途中で切れたら続きから・sha256 違い・電源断のあと続きから・新しい serve.py が動かない・空き容量不足・ほかのオリジンのページ・ほかのページの枠（iframe）・許可外のホストへの転送・自動の確認のオフ・窓口の無い配信 | IN-06〜13, BC-03 |
| E-22 | 二重起動の防止（`e2e/single-instance.spec.ts`。chromium・firefox。15 件ずつ）: 2つ目を開くと1つ目が閉じ、2つ目は起動画面から始まる／画面を移した窓は「べつの まどで ひらいています」になり、記録を書かない／［この まどで ひらく］で引き継ぎ直せる／おえかきの保存を待ってから引き継ぐ（PNG づくりが遅くても）／3つ続けて開いても残るのは1つ／引き下がった窓は、使っている窓が閉じられたら起動画面に戻る／「戻る」で使っている窓を追い出さない／引き継いだ画面だけ、「はじめる」で全画面にする（1回）／Web Locks が無い・試験の旗があるときは守りなし／`page.reload()` を5回続けても毎回ふつうに始まる／`?retired=1` は音・記録・Service Worker・教材に触れない／新しい2つの画面の見た目（4つの大きさ）／外部通信なし | OP-07, IN-14, IN-15, BC-03 |

**更新の仕組みの単体・結合の試験**（docs/expansion/updater-design.md 11 章・16 章）:
- Python の unittest（`npm run test:py`。Linux は `npm run test:py:sh`）: `deploy/tests/` の test_manifest・test_fetch（転送先のホストとパス・リポジトリの番号・308・転送の本文・版の情報のタグ・遅すぎる取得・中止・空き不足・おかしな応答）・test_install（zip の検査・入れ替え・元に戻せないとき）・test_service（状態・予定・各段・中止の競り合い・配信のプロセスの鍵・パスを出さない）・test_api（窓口の守り）・test_serve（自己検査・枠の見出し・本番のポートでの試験用の取得先・2 つ目の配信）・test_integration（本物の serve.py の通し）・test_install_sh（install.sh・uninstall.sh）。
- vitest: `scripts/release-lib.test.ts`（版の情報・zip・版の番号の確認）・`src/core/offline/updater.test.ts`・`src/parent/UpdateSection.test.tsx`・`src/app/ParentGate.test.tsx`・`src/core/framed.test.ts`。

**二重起動の防止の単体・Python・シェルの試験**（docs/expansion/single-instance-design.md 5 章）:
- vitest: `src/core/instance/instance.test.ts`（役割の決め方・引き下がり・3つ続けて開いた場合・戻る進むの読み込み・送り主・鍵が空いたら戻る見張り）・`src/core/pendingWrites.test.ts`・`src/drawing/autosave.test.ts`（保存の待ち）・`src/app/RetiredScreen.test.tsx`・`src/ui/fullscreen.test.ts`・`src/parent/FullscreenSection.test.tsx`。
- Python の unittest（`npm run test:py`）: `deploy/tests/test_mnwwindow.py`（窓の判定・前に出すやり直し・`wait`・`ozone-flag`・記録・ctypes の構造体）、`deploy/tests/test_manabi_sh.py`（bash があるときだけ。偽のコマンドで、focus の結果ごとの動き・`--ozone-platform` の付け方・`flock` の呼び方・鍵の fd を子に渡さないこと・配信を確かめる Python）、`deploy/tests/test_install_sh.py`（`mnwwindow.py` が必要なファイルの一覧にあること）。本物の `flock` の試験は Linux だけで動く。
- 旗（`allowMultiWindow`）を立てる既存の E2E: `e2e/drawing.spec.ts` の2つのタブの試験、`e2e/offline.spec.ts` の2つのページを同時に開く試験。

**2.1.0 の公開前の点検（3回目。updater-design.md 16.2・single-instance-design.md 8.6）で足した試験**。どれも、直しを1つずつ外すと落ちることを確かめてから戻した。
- Python（`deploy/tests/`）: `test_serve.py`（NUL などを含むパスは 404 で記録が出ない・予期しない例外は型名 1 行・全応答に `Cross-Origin-Resource-Policy`・自己検査の失敗の説明にパスが出ない・`--check-update` が Traceback で落ちない）、`test_fetch.py`（満杯のあと取得物が残らない・深い入れ子の版の情報・形の壊れた `Location`）、`test_service.py`（組み立ての途中の満杯でも取得物が空・満杯で捨てたあとの `needBytes` が全部を取り直す見積もりと同じ・深い入れ子の状態は `idle`）、`test_install.py`（壊れた deflate は `unsafe-zip`・失敗の説明のパスの置き換え・リンクの先に `chmod` しない）、`test_manifest.py`（深い入れ子は `bad-manifest`）、`test_mnwwindow.py`（`--browser`・時間切れの終了コード 1）。
- シェル（bash が無ければ skip）: `test_manabi_sh.py`（使うブラウザの種類が `focus`・`wait` に渡る・`MANABI_BROWSER` を評価しない）、`test_install_sh.py`（偽の `sync`・`mv`・`rm` で入れ替えの前後の `sync` の順・`switch-broken` を先に戻す・戻せないとき止まる）。
- リリースの道具（vitest）: `scripts/release-lib.test.ts`（使い捨ての git リポジトリで、配布に入れるファイルの選び方・元がクリーンでないと止まること・リンク・`dist` の除外・`sw.js` の一覧と `packs.json` が zip に入るファイルにそろっていること・一覧の contentId・版の形と数での比較・タグの読み取り。`package-release.ts` を使い捨てのリポジトリの中で本当に動かす通し 9 件）。

**使いやすさの直し（FX。2.1.0）で足した試験**（記録は docs/expansion/ab-evaluations.md・handover.md B4）。どれも、直しを外すと落ちることを確かめた（FX03・FX04・FX06 は配置の作業で直っていたので、外して落ちるかは試していない）。
- E2E（chromium・firefox）:
  - `e2e/ux-f1.spec.ts`（単元の枠）: FX01 解説の板が出た直後の「つぎへ」の2回押し（100・150・250・400ms）で解説が残り、700ms たてば進む／FX08 ヒント2回・誤答1回で中断→つづきから→正解が after_hint・self_corrected（自力にならない。何もせずに中断した問題は independent のまま）／FX10 区分ごとに目安を超えたあとの単元の完了で「きょうは ここまでに しよう」が出て「もういちど」が出ない・届かなければ出ない・新しいプロフィールは区分の既定で「おすすめにする」のときだけ入る／FX12 教材を開けない画面に保護者向けの説明。
  - `e2e/ux-f2.spec.ts`（幼児の入口と数字キー）: FX02 札・遊び方の名前の声が鳴り始める（`AudioBufferSourceNode.start` の記録）／FX16 幼児ホームの「!」の位置と大きさ（1280×620・1920×1080）／FX05 数字キーが 6u 以上で作業領域に収まる（g3.math.bar-graph・g2.math.length × 4 サイズ）。
  - `e2e/ux-f3.spec.ts`（保護者）: FX09 見るだけでは遊ぶ人が替わらない・「こどもの画面へ」で「だれが あそぶ？」・設定は見る人にだけ入る・1人ならホーム／FX11 ゲートの数字・Backspace・Enter・Esc、Esc でフォーカスが鍵へ戻る、開いた直後の Shift+Tab と「もどる」の Enter、保護者画面の 8 タブとプロフィールの編集・確認の板で 44px 未満が 0（4 サイズ）、スライダーの棒の上下を押しても値が変わる／FX13 開き直す前と後の「オフライン」の文（firefox は skip。vite preview で Firefox の Service Worker の準備が終わらないことがあるため）／FX14 小3・4歳のきろくの表・おすすめが実際のホームと同じ・問題の ID が出ない。
  - `e2e/ux-f4.spec.ts`（小学生）: FX07 どの地図でも前提の単元が上・前は逆だった組の例／FX15 仮の枠の絵が無い・絵の無かった 3 単元に完成した絵／FX04 地図の札が縮まず題が札の外にあふれない（4 サイズ）／FX16 小学生ホームの「!」（4 サイズ）。
  - 既存の `e2e/parent.spec.ts` の E-08 に、「だれが あそぶ？」で選ぶ手順を足した。
- vitest（主なもの）: `src/units/unitFlow.fx.test.ts`（FX01・FX08）・`src/units/UnitRunner.test.tsx`（FX10・FX12。判定を待つ間も おうち がある・判定に失敗しても完了画面が出る）・`src/core/session/sessionTime.test.ts`・`src/core/storage/profileDefaults.test.ts`・`src/parent/ProfilesTab.session.test.tsx`（FX10）・`src/app/ux-f2.test.tsx`（FX02・FX16。3つのホームが同じ部品 `StorageHealthMark` を使う）・`src/engines/numberline/numpad.test.ts`（FX05）・`src/parent/parentView.test.tsx`・`src/app/startPicker.test.tsx`（FX09）・`src/app/ParentGate.keyboard.test.tsx`（FX11）・`src/app/offlineNote.test.tsx`（FX13）・`src/parent/recordsHome.test.tsx`（FX14。保護者のおすすめが実際のホームを描いた結果と同じ）・`src/curriculum/unitOrder.test.ts`（FX07。表の順・前提の逆転 0）・`src/curriculum/unitIcons.test.ts`（FX15。保護者が開く単元を含めて絵が final・新しい絵の画風）・`src/app/SchoolHomeHealth.test.tsx`（FX16）。

### 3.1 自動のレイアウト検査（E-14）
- 画面サイズは 1920×1080, 1536×864, 1280×720 に加え、ブラウザの UI 分だけ高さが減った 1920×950・1280×620 でも検査する
- ホームの9枚の札: 文字のはみ出しなし、札どうしの間隔 ≥ 1.6u
- `document.documentElement.scrollWidth <= clientWidth`
- 子供画面の `button` すべての外接矩形が `6u - 許容1px` 以上（補助ボタンは 5.5u）
- テキスト要素の `scrollWidth > clientWidth`（文字切れ）がない
- 主要な操作ボタンどうしが重ならない

### 3.2 文字の配置の検査（全単元・全問題。`npm run check:text-layout`）

- 対象: v1 のモード（`engine: 'legacy'` の 11 単元。下の第4回の節）以外の全単元 × 見本の問題（`qa.ts` の `sampleItems`。生成器は段階 × `MNW_SEEDS`（既定 2）個、手作りは全件）× 画面サイズ（1280×720・1920×1080・1280×620・1536×864）× 状態（問題・ヒント①〜③・解説）。
- 開発サーバー（127.0.0.1:4299、`playwright.text-layout.config.ts`）の開発用の画面 `#/dev/unit/<単元ID>/<n>?state=h2` で、本物の単元の画面（読み上げなし）に1問ずつ出す（`src/dev/UnitSampleView.tsx`。本番ビルドには入らない）。
- 見るもの（`e2e/helpers/text-layout.ts`）: はみ出し（大きさが 0 の図を含む・舞台の外・親の枠で切れる・スクロールしないと見えない・枠の外の文字・画面のスクロール）、重なり（文字どうし・文字やボタンの上にかぶさる要素・字を横切る正解の輪・ボタンどうし・ふりがなと親字）、変な改行（1字ずつの位置から行を出し、行頭／行末禁則・最後の行が1文字・分かち書きの語の途中・英単語／数／単位／ふりがな付きの語の途中・ボタンの中の語の途中・1行1〜2字の狭い折り返し）、文字の大きさ（17章の最小）、記法の漏れ（画面に出た `《》`・`{{ }}`）。
- 違反は失敗にせず、`docs/screenshots/text-layout-report/`（`summary.md`・`report.json`・種類ごとの代表のスクリーンショット）に出す。単元ごとの途中の結果は `.cache/text-layout/` に置き、同じ条件なら飛ばす（途中から再開。`MNW_FRESH=1` ではじめから）。`MNW_UNITS=g1.math.*` で単元を絞る。`MNW_MAX_ITEMS` で問題数の上限（使ったときは要約に出す）。
- 誤検出の直し（第1回）と理由:
  - **長いふりがな**: Chrome は rt が親字より長いとき、親字の文字の Range の外接を rt の幅まで広げる（実測: `正月《しょうがつ》` で ruby の箱 146〜221px に対し親字の範囲 142〜225px）。字形は ruby の箱の中にあり、rt が隣の仮名の上に張り出すのは JIS X 4051 で許される組み方なので、重なりではない。そこで親字（ruby の中の rt でない字）の左右を ruby 要素の箱に詰めてから比べる。また、rt が相手の字より上にあり（同じ行の隣の字）、横の重なりが rt の字の 0.5 字以内のものは数えない。前の行に rt が重なる（rt の中心が相手の字より下）＝行間不足は今までどおり `overlap-text` に出す。
  - **スクロールさせる設計の枠**: `data-scroll-region` を付けた枠（読解の本文・プログラムの命令の列）の中の字・ボタンは `scroll-hidden` を 1 つずつ出さない（スクロールで読めるのが設計のため）。代わりに枠ごとに、`scrollHeight > clientHeight + 2`（横は幅）のとき、見えている `data-scroll-cue`（枠の中か、枠の親の中）が無ければ `scroll-hidden` を 1 件、枠の見える高さが本文の 4 行未満なら `clipped` を 1 件出す。枠の上・左へのはみ出し（スクロールしても見えない）は枠の中でも今までどおり出す。`data-scroll-region` の無い枠の `scroll-hidden`、`small-text`・`overlap-text` の閾値は緩めていない。
  - **始め括弧の直前の改行**（wakachi-split／button-split）: 分かち書きの文で「は／「…」」のように始め括弧の直前で折るのは、空白のところで折るのと同じ（`.stage [data-wakachi]` の `word-break: keep-all` でも括弧の前は折れる。17章）。語の途中ではないので数えない。`END_NG`（始め括弧）が次の行頭にあるときは (d) の対象から外した。語の途中の改行や、括弧の直後・禁則の検査は変えていない。
- 誤検出の直し（第2回）と理由:
  - **隠れた字との overlap-text（C3）**: 不透明な解説の板・吹き出しの下に隠れた選択肢の字を、板の字と重なったものとして `overlap-text` にも数えていた（同じ所が covered と二重）。文字どうしの重なりの中心で `elementsFromPoint` を見て、片方の字を含む要素のうち不透明な背景（`background-color` の alpha が 1、opacity 1）をもつものが、もう片方を含まずに手前にあるときは `overlap-text` に数えない（隠れたことは covered で出る）。同じ層の字どうし・背景が透明な枠どうしは今までどおり出す。covered・overlap-text の閾値は変えていない。
  - **スクロールさせる枠の種類（C2 の続き）**: `data-scroll-region` に `explain`（解説の板）・`work`（収まらない作業領域）・`transcript`（書き起こし）を足した。枠の中の字は1行ずつ数えない。`work`・`explain` は印（`data-scroll-cue`）があっても枠につき1件の `scroll-hidden`（「作業領域が N u 足りずスクロール」「解説が板に N 行分入らずスクロール」）を残す。設計で受け入れたスクロールではなく、パックの文・図を短くする手がかりなので消さない（1行ずつ数えると件数が文の長さに比例して膨らむだけ）。`passage`・`strip`・`transcript` は印が無いときだけ出す（4行未満の `clipped` は passage・strip のみ）。
  - **分かち書きの「・」（C5）**: 改行の直前が「・」で、その前後の項目（「・」か文の始め・終わりで区切った部分。空白を含む句でもよい）がどちらも2字以上（空白を除いて数える）なら `wakachi-split`・`button-split` に数えない（中黒のあとは JIS X 4051 で改行してよい語の区切り。g2.ja.katakana-words「くに・／まち」）。1字の並び（き・つ・つ・き）は今までどおり出す。前の部分を空白の所で止めていたときは、項目が句の「ちいさい じ・／のばす おと」（アプリの選ぶ画面の札）を「じ」の 1 字と数えて出していた（誤検出。3.3 のレビューで直した）。
  - **字の大きさの丸め（C7）**: 最小の 1% までの差（px の丸め・SVG の拡大率の誤差）は `small-text` にしない（しきい値は `最小 × 0.99`。以前の「最小 − 0.05u」より厳しいので、2.15〜2.2u のような小さい不足も出る）。表示は小数2桁。
  - **スクロールが止まるまで待つ（C6）は入れていない**: 読解の自動スクロール中に測って reading-cue が本文に重なる covered（g1.ja.folktales/5 ヒント②）を、検査と同じ手順（4サイズを往復）で再現した。スクロールできる要素の scrollTop が2フレーム変わらなくなるまで待っても、さらに 1.5 秒待っても同じ covered（rt の上に button.eng-reading__cue）が出た。測るタイミングの誤検出ではなく画面の不具合（R5）なので、`settle` は変えていない。
- 誤検出の直しと見落としの直し（第3回）と理由:
  - **描き直しが終わるまで待つ（C8）**: `settle`（`e2e/text-layout.tl.ts`）を「2フレーム＋アニメーション」から、有限のアニメーションの終わり（今までどおり最大 1 秒）を待ったうえで、次の印が2フレーム続けて同じになるまで（最大 1 秒）待つ形にした（アニメーションの待ちは残す。印は transform・opacity の動きを見ないので、外すと動きの途中を測る）。印は、各 svg の `viewBox`・`--svg-floor`・最初の `text` の `font-size`、`.unit__work` の `--fit`・`--fig-max`・`scrollHeight`、解説の板の高さ。理由: `reducedMotion: 'reduce'` ではアニメーションを待てず、画面サイズを変えた直後の「ResizeObserver → React の状態 → 描き直し」の途中を測っていた（g1.math.numbers-10/0 で 1920×1080 から 1280×620 に変えると overlap-text 20 件。600ms 後と撮った画像は正常。g5.math.speed の 0.06u も同じ。1280×620 だけに出る違反が 539 画面）。1 秒たっても印が変わり続ける画面は隠さず、違反の `detail` の先頭に「unstable: 描き直しが 1 秒たっても終わらない」を付けてそのまま残す。
  - **スクロールの枠で半分切れた字（C9）**: (8) の当たり判定の点（字の中心）を、`overflow` が visible でない祖先の padding box（線の内側・スクロールバーを除く。`getBoundingClientRect` の小数のまま）の 1px 内側で切る。以前は `clientHeight`（整数に丸まる）の箱で切っていたうえ、当たり判定は画面のピクセルに丸まるので、枠の下端でちょうど半分切れた行の字の中心が、枠の外の「▼ つづき」の段（`button.eng-reading__cue`）に当たり、「隠れた」と数えていた（g1.ja.read-story/3 ヒント③ 1280×720。字の中心が枠の下端の 0.4px 内側にあり、待っても消えない。第2回の C6 の待ち方では直らなかった）。枠で切れて見えない字は (5) の `clipped`・`scroll-hidden` で出すので、`covered` では数えない。枠の中にかぶさる段は今までどおり `covered`。
  - **ボタンの上の飾り（C10）**: (8) のボタンの `covered` で、上に来た要素の外接を、祖先の `overflow` の枠で切ってから「ボタンより小さい札」の例外（ボタンの内側で面積が 0.9 倍未満）を判定する。さらに次の3つを満たすものは数えない: 元の `pointer-events` が none（検査の間は全部 auto にしているので、`peStyle` を一時的に外して読む）／ボタンと同じ親の中にある／ボタンに見える文字が無い（`aria-label` だけ）。対象は p23.think.sort のふたの上の色の丸（covered 304 画面）。押せることも見た目の文字も損なわない。文字のあるボタンの上の飾り、`pointer-events` が効く覆い、ボタンの親の外から覆うものは今までどおり出す。
  - **空白の扱い（C11）**: button-split の「空白でない所で改行」は、分かち書きの段階（`wakachi`）か、空白が多い（空白の数 × 12 ≧ 字数）ラベルだけにする。それ以外は `Intl.Segmenter` の「語の途中」の判定に回す。小4のラベルに名前の空白（森川 はるか）が1つあるだけで、文節の切れ目まで違反にしていた（g4.ja.write-report・info-compare で約 1,000 画面）。分かち書きの段階の判定と、`Intl.Segmenter` の語の途中の判定は変えていない。
  - **記法の漏れ（新しい種類 markup-leak、C12）**: 画面に `《》`・`{{`・`}}` の記法（ふりがな・差し込みの書き方）がそのまま出ていたら出す。order の端の札「終《お》わり」の見落としが見つかったため。
  - **正誤の印 `.mark` の例外を狭める（C13）**: 文字・ボタンの上に来ていても数えない `.mark` は、誤答の ？（`.mark--wrong`）だけにした。正解の ○（`.mark--correct`）は字の後ろに置く設計なので、字の上に来ていれば数える（match の解説で ○ が字に重なる見落としが見つかったため）。字の後ろにある ○ は、重ね順で字より下なので今までどおり数えない。
  - **数の入力の図の段のスクロール（T7・第3回のレビューで足した）**: number の左の列の図の段（`data-scroll-region="figure"`。入らない表・10の棒を問題文・回答欄に重ねないための逃げ）は、`work`・`explain` と同じく印があっても枠につき1件の `scroll-hidden`（「図の段が N u 足りずスクロール」）を残す。印が無いこと・見える高さが4行未満（`clipped`）も今までどおり出す。区別せず `passage` と同じ扱いにすると、印があるだけで件が消え、第4回で図を直す手がかりが無くなるため。
  - **緩めていないもの**: `covered`・`out-of-stage`・`clipped` の判定、`small-text` の最小、`overlap-text` の閾値、分かち書きのラベルの判定、`work`・`explain` のスクロールの1件。上の直しはどれも `e2e/text-layout-probe.tl.ts` に見本を足し（枠の下端の半分切れた行とかぶさる段・飾りと文字ありのボタン・枠で切れる札・空白1つ／空白の多いラベル・漏れた記法・○ の前後）、直す前のコードでは失敗すること（わざと壊した見本が引き続き検出されること）を確かめた。
- 誤検出の直しと見落としの直し（第4回）と理由:
  - **数のあとの助詞（C14・誤検出）**: word-split の「数と単位・助数詞の間」で、数字の次の字が助詞（は が を に で と の も や へ か）なら数えない。「11／で」「7／は芸術」「資料2／は」「9／で」は、数と助詞の境目の改行で、組版として改行してよい所。第3回のあとの word-split 7 件・78 画面が全部これだった（g4.soc.tradition・g5.ja.read-gist・g5.ja.text-figure・g5.math.average）。ただし仮名で書いた助数詞の頭（に＋ん=人・に＋ち=日・と＋う=頭・は＋い=杯・か＋い=回・か＋げつ・か＋しょ／所・か＋国）は助詞でなく助数詞なので、次の字を見て今までどおり数える。「2こ」「3年」「3 cm」も数える。
  - **0×0 の図（C15・見落とし）**: 舞台の中の `svg`・`img`・`.fig-svg`・`.fig-illust` で、子（図形・字・絵）があるのに幅か高さが 1px 未満のものを、図ごとに `clipped` で 1 件出す（「図の大きさが 0（見えない）」）。中の `text` は 1 字ずつ数えない（clipped「text ⊂ svg」・small-text・overlap-text に出さない）。除くもの: `display:none`・`visibility:hidden`・opacity 0、`aria-hidden` の祖先、`.sr-only`・`.visually-hidden`、`display:contents`、defs・symbol だけの svg（グラデーションの置き場）。外側の枠が 0 のときは中を数えない。理由: 解説の図（width の無いパックの SVG）が 0×0 で見えない不具合が、字の無い図では何も出ず、字のある図では原因の分からない形（text ⊂ svg の clipped と small-text が約 130 件）で出ていた（g5.math.speed/3・g4.en.directions/35 の解説）。
  - **字を横切る正解の輪（C16・見落とし）**: 見えている `.mark--correct` の輪の線の帯（外接の円から、線の幅の分だけ内側の円を除いたもの）に、同じ札（`.mark` の親）の字の中心が入れば（C21 で 2 つ以上から 1 つでもに変えた）、`covered` で 1 件出す（「正解の ○ が字を横切る」）。輪の中は透明で `elementsFromPoint` が通り抜けるので、(8) の当たり判定では数えられず、円の式（`paints` と同じ式）で判定する。字の後ろ（z-index 0）でも、線は字を横切って読みにくいので数える。1 行・6 字以下の札を数えない除外は、第6回の C21 でやめた（下）。線の無い印（背景だけ）は帯が無いので数えない。理由: sort の解説の札・読解の引用の選択肢で、輪が長い文の真ん中の字を横切っていたが、検査が見ていなかった（g6.ja.write-opinion/6・g5.ja.read-relations/7）。
  - **複合辞の切れ目（C17・誤検出）**: 分かち書きでない段階の button-split の「語の途中」で、`Intl.Segmenter` の語が複合辞（という・といった・として・について・にとって・によって・にして・にたいして・をして・とする・とした・とともに・のように）で、改行が頭の助詞の直後（語の 2 字目の直前）にあるときは数えない。「〜と／いう」「〜に／ついて」は助詞と動詞の境目（文節の切れ目）で、改行してよい所。同じ語のほかの位置（「につい／て」）と、ほかの語の途中（「方／向」「落と／す」「パイ／ロット」）は今までどおり出す。分かち書きの段階の判定は変えていない。
  - **親字の無い《》（C18・静的な検査）**: 画面の検査ではなく教材の段階で止める。`src/text/rich.ts` の `findOrphanReading`（直前が漢字の並びでない《》を返す）を、`src/curriculum/qa.ts` で誤りにした（`rich.test.ts` に例）。理由: g3.soc.map-symbols の「×《ばつ》」「Y《ワイ》」は記法として読まれず字のまま画面に出て、画面の検査（markup-leak）で初めて見つかった。
  - **v1 のモード（C19）**: `e2e/layout.spec.ts` の `MODES` に trace の letters と maze を足した。p4.hand.letters-classic（letters）と p4.hand.lines の maze が、どちらの検査にも入っていなかったため。
  - **svg の overflow: visible（C20・誤検出）**: 図の字が svg の表示範囲の外にあっても、いちばん外の svg の計算された `overflow` が `visible` なら、svg の枠での `clipped`（「図の表示範囲の外」）を出さない。svg は既定で `overflow: hidden` だが、`visible` にした svg は枠の外の字も描かれるので切れていない（開発用の画面で確かめた。時計の帯 `eng-clock__band`・振り子の図 `exp-svg` の 128 画面・3 単元）。祖先の枠（`clipBy`。overflow: hidden やスクロールの枠）で切れるかは今までどおり先に見るので、本当に切れるものは残る。`overflow: hidden` の svg の外の字は、今までどおり出す。
  - **正解の輪の 6 字以下の除外をやめる（C21・見落とし）**: C16 の「1 行・6 字以下の札は数えない」の前提（輪は字の上下を通るだけ）は、幼児の英語の短い札（「なかの ねこ」「こんにちは」「おひさま」・p5.en.abc の縦長の札）で成り立たなかった。札の字数では外さず、字の中心が輪の線の帯（外の円 − 内の円）に入る字が 1 つでもあれば `covered`（「正解の ○ が字を横切る」）にする。あわせて、(1) 角の小さな ○（3.2u 前後）は、字（ふりがな rt を含む）の矩形に円が重なれば `covered`（「角の ○ が字・ふりがなに重なる」。今は elementsFromPoint で一部しか見えず、g3.ja.kanji-parts/30 の「み」の rt を隠すものを取りこぼした）、(2) 輪が札からはみ出して隣の札の矩形（2px 内側）に入るものも `covered`（「正解の ○ が隣の札にかかる」。同じ親の兄弟の札だけ見る）。輪が字の外にあるもの・線の無い背景だけの印は、今までどおり出さない。絵とラベルのある listen の札（輪は絵の段 `.eng-opts__pic` の中。第6回 W1）は、包みでなく札（`.choice`）の字と隣の札を見る（第6回のレビューで直した見落とし: 包みの中だけを見ると、輪がラベルの字や隣の札にかかっても出なかった。probe に見本）。
  - **分かち書きの教材（C22・見落とし）**: `wakachi-split` と分かち書きの段階の判定を、段階（p23・p4・p5・g1・g2）に加えて、教材（`inspectText` の `pack`）が en-g34・en-g56 のときも行う。英語の単元の日本語（問題文・ヒント・解説）は小3以上でも分かち書きで書いてあるが、検査が段階だけで決めていたので、「もういちど 聞／こう。」のような語の途中の改行が出なかった。教材の一覧は検査の側（`textLayoutProbe`）で持ち、画面の `data-wakachi` は見ない（画面が分かち書きにしていない不具合を隠さないため）。`e2e/text-layout.tl.ts` が単元の pack を渡す。あわせて、文の終わり（。．.!?！？）のすぐ後ろの「・」のあとの改行は、後ろが 1 字の語（英語の「I」）でも数えない（第6回のレビュー・誤検出）。聞く問題の書き起こしは文と文の間を「・」で区切る（listen.tsx。検査から見えるよう ::before でなく字で書く）ので、「last summer.・／I swam」は文の区切りでの改行で、1 字の並び（き・つ・つ・き）の語の途中とは違う。文の終わりの無い「・」の 1 字の並びは今までどおり出す（probe に見本）。
  - **始め括弧の前の改行（C23・誤検出）**: (f) のボタン・選択肢の「空白でない所で改行」（button-split）で、次の字が始め括弧（`（「『【〔` など `END_NG` の字）のときは数えない。「種子の 中／（子葉）」「水の 底／（海など）」（g5.sci.germination・g6.sci.strata の 40 画面）は、始め括弧の前の改行で、組版（JIS X 4051）として正しい。(d) の分かち書きの判定では同じ扱いで外していたが、(f) では外れていなかった。
  - **`[[ ]]` の漏れ（C24・見落とし）**: markup-leak の正規表現に `[[` と `]]` を足した（分数の記法 `[[3/4]]` が parseFrac で読めないと、そのまま画面に出る）。画面の検査の前に止めるため、`src/curriculum/qa.ts` の `findFracLeak`（`parseRich` のあとの text に `[[`・`]]` が残るものを返す）を、単元の文・問題の文の両方で誤りにした（C18 の隣）。
  - **線がほかの札の後ろを通る（C25・見落とし）**: match の線（`line.eng-match__line`）の線分が、両端の札（端点が 4px 以内の札）以外の `.tk-card` の矩形（2px 内側）と交われば、その札を `covered`（「線が別の札の後ろを通る」）にする。正解の線も子供が引いた線も見る。下（または上）の列が折り返して 2 段になると、線が途中の札の後ろを通り、番号のバッジは正しいのに線とは食い違って別の組に見える（g3.soc.safety/21・g5.soc.environment/37 の解説）が、検査は見ていなかった。
  - **古いスクリーンショット（C26）**: `MNW_FRESH=1` で `MNW_UNITS` を指定しない（全部を流す）ときは、始める前に `shots/` の種類ごとのフォルダを消す（`e2e/helpers/text-layout-setup.ts`・config の `globalSetup`）。違反が 0 の種類に、前の実行の画像が残らないようにする（markup-leak の古い画像が残っていた）。単元を絞った実行・途中からの続きでは消さない。
  - **検査から外れる 11 単元**: unit-index は 324 単元だが、この検査が流すのは 313 単元。外れるのは `engine: 'legacy'`（v1 のモードを使う単元）の 11 単元で、`e2e/text-layout.tl.ts` の `u.engine !== 'legacy'` で外している（対象は変えていない）。理由: v1 のモードは単元の画面（`#/dev/unit/…`）を通らず、`e2e/layout.spec.ts`（`inspectLayout`）が受け持つ設計だから。
    - p23.hand.lines・p4.hand.lines（trace の lines・maze）・p4.hand.letters-classic（trace の letters）
    - p4.ja.hiragana-classic・p4.math.classic・p4.math.compare・p4.math.shapes・p4.math.shop
    - p4.think.memory・p4.think.road・p4.think.sort
  - **描き直しの待ち（settle）を2フレームから4フレームに**: `e2e/text-layout.tl.ts` の settle は、印（svg の viewBox・字の大きさ・作業領域の --fit など。第4回で吹き出しの `--bubble-h`・数の入力の図の段の `--num-k` も足した）が続けて同じになるフレームの数を待つ。SVG の字の引き上げ（V7）は「ResizeObserver → 次のフレームの rAF」の 2 フレームかけて測り直すので、2 フレームでは画面サイズを変えた直後の引き上げ前を測り、g5.math.area-formulas で small-text が約 20 画面出た（読み込み直して測ると 0。子供が見る落ち着いた画面では起きない）。1 秒たっても変わり続ける画面は今までどおり unstable として残すので、描き直しが終わらない不具合は隠れない。
  - **緩めていないもの**: `covered`・`out-of-stage`・`clipped` の判定、`small-text` の最小（1% の丸め）、`overlap-text` の閾値、`work`・`explain`・`figure` のスクロールの 1 件、分かち書きの判定（C17 の複合辞の頭の位置と、C23 の始め括弧の前だけを外し、C22 で対象を増やした）。C20 も、`overflow: hidden` の svg と祖先の枠で切れるものは残る。どれも `e2e/text-layout-probe.tl.ts` に見本を足し（助詞と仮名の助数詞・0×0 の図と除くもの・輪が字を横切る札と数えない札・複合辞の頭と同じ語のほかの位置・C20〜C25 の見本）、直す前のコードでは失敗すること（壊した見本が検出されること）と、直したあとも通ることを確かめた。
- 検査自体の確認: `npm run check:text-layout:probe`（わざと壊した見本で検出すること、普通の見本で何も出さないこと）。
- 検出できないこと: 字形の中の重なり（字のすき間に線がかかる程度）、色・コントラスト、Canvas に描いた文字、意味の切れ目（分かち書きでない文の語の切れ目は、ボタンの中だけ Intl.Segmenter で見る）。

### 3.3 アプリの画面の配置の検査（アプリの全画面。`npm run check:app-layout`）

単元の画面は 3.2 が全問題を見ている。それ以外のアプリの画面（起動・プロフィール選択・ホーム・ほかの がくねん・選ぶ画面・単元の地図・ノート・さくひん・おえかき・保護者の入り口・保護者画面）は、これが同じ考え（重なり・切れ・舞台の外・押せない・小さすぎる字・変な改行）で見る。設計は docs/expansion/text-layout-fixes.md「アプリの画面」（AC-1〜AC-7）。モードの遊ぶ画面と完了画面は、これまでどおり E-14（3.1。`e2e/layout.spec.ts`）が受け持つ。

- 開発サーバー（127.0.0.1:4298。`MNW_PORT` で変える。全体の文字の検査 3.2 は 4299）を `MNW_DEV_NO_HMR=1`（ファイルの変更を見ない）で起動して流す。`playwright.app-layout.config.ts`。違反は失敗にせず、`docs/screenshots/app-layout-report/`（`summary.md`・`report.json`・種類ごとの代表のスクリーンショット `shots/<種類>/`）に出す。**報告書と `.cache/` は commit しない。** テストが失敗するのは、画面に行けないとき（目印が出ない・例外・止まった）だけで、そのときも結果は `.cache` に残す。
- 目安の時間: 3 並列で 3 分前後（画面 約 420〔プロフィール × 状態 × 画面〕・検査 約 2,000 回〔画面 × 4 サイズ。保護者画面はスクロールの位置ごと〕。2026-11-07 の実測）。ほかの担当が動いているときは長くなる。

#### 範囲

- **プロフィール 13 通り**（`e2e/helpers/app-layout-fixtures.ts`）:

  | キー | 区分 | 設定 | 見るもの |
  |---|---|---|---|
  | `p23-2`・`p23-3` | 2〜3さい（2さいの段階・3さいの段階） | 既定 | 札 4 枚のホーム・おすすめなし・えいごなし／3さいの段階 |
  | `p4`・`p4-noen` | 4さい | `p4-noen` は `showPreschoolEnglish: false` | えいごの札あり／なし |
  | `p5` | 5さい | `unitsOpened: ['p5.en.abc']` | えいごの選ぶ画面が 6 枚 |
  | `g1`〜`g6` | 小1〜小6 | 区分の既定 | |
  | `g3-big` | 小3 | `textScale: 1.3`・`furigana: 'all'` | 字がいちばん大きく、ふりがなが多い |
  | `g4-left` | 小4 | `drawingHand: 'left'` | おえかきだけ（道具欄が右） |

- **中身の状態は二つ**。`fresh`（作ったばかり。プロフィール 1 人）と `full`（遊んだ記録 14 日分〔12月31日から数える＝日付の字がいちばん長い〕・すき 3 つ・作品 18 枚＋なぞり・みち 5 枚・メモ 10 件・記録・単元の進度。名前が 20 字・空白のある・英字・ふつうのプロフィール 4 人。小学生は、その学年でいちばん長い題の 2 単元を「ふくしゅう」〔教科は別々〕、次に長い 6 単元を「とりくみちゅう」、2 単元を「できた」「しっかり できた」。p4 は v1 のモードの単元に「つづきから する？」の下書き）。fresh と full は別の context（別の IndexedDB）で流す。設定と中身は IndexedDB に直接書いて読み込み直す（テスト専用。`e2e/helpers/app.ts` と同じ）。作品は、1 枚を描く画面で描き（線 1 本）、残りを開発サーバーの `duplicateArtwork` で増やす（画像の形を検査の側で作り直さない）。
- **画面**（`e2e/helpers/app-layout.ts` の `screenDefs`）。段階（stage）は、その画面の中身の段階（ほかの がくねん のタブ・単元の地図の学年のタブでは、子供の区分でなく表示している区分）。

  | 画面の ID | 行き方 | プロフィール・状態 |
  |---|---|---|
  | `start` | `/` | 全部・fresh |
  | `start-setup-<preparing・renewing・failed・offline>` | `/?dev-setup=…&dev-notes=2` | p4・g3・fresh |
  | `profile-picker` | `/`（4 人）→ はじめる | p4・full |
  | `home` | `#/home` | 全部・fresh と full |
  | `explore-own`・`explore-<p23〜g6>` | `#/explore`・`#/explore/<区分>` | 全部・fresh |
  | `card-<札>` | `#/card/<区分>/<札>`（単元が 2 つ以上の札。えいごを含む） | 幼児・fresh |
  | `variant-<単元>`・`resume-<単元>` | `#/legacy/<単元>`（遊び方を選ぶ画面）・下書きを入れて `#/legacy/<単元>/<遊び方>`（つづきから する？） | p23-3・p4／p4（full）。遊び方の選ぶ画面が出ない単元は「飛ばした」と要約に残す |
  | `subject-<教科>-g<学年>` | `#/subject/<教科>/g<学年>` | 小学生は自分の学年の全教科（fresh・full）。p4 と g3 は全部の教科 × 学年 |
  | `notebook` | `#/notebook` | 全部・fresh と full |
  | `gallery`・`gallery-old-view`・`gallery-confirm`（幼児は `gallery-confirm-2`＝「ほんとうに？」） | `#/gallery`・なぞりの作品を開く・すてる | p23-3・p4・g4・full |
  | `draw`・`draw-stamp`・`draw-shape`・`draw-paper`・`draw-select` | `#/draw/new`・各板を開く・はんこを置いて選ぶ | p23-3・p4・g4・g4-left・fresh |
  | `parent-gate` | ホームで鍵を長押し（2 秒） | p4・g3・fresh |
  | `parent-<records・settings・works・memos・profiles・data・packs・about>` | `/?dev-open#/parent/<タブ>` | p23-2・p4・g3・g6・full |
  | `parent-profiles-confirm` | プロフィール削除 → 確認 | p4・full |

- **画面サイズ**は 4 通り（1280×720・1920×1080・1280×620・1536×864）。画面を開いたまま 4 サイズに変えて測る（往復の順）。

#### 開発用の指定（開発サーバーだけ。本番ビルドでは消える）

- **`?dev-open`**（`src/app/devOpen.ts`・`AppState.tsx` の `started`・`parentUnlocked` の初期値）: 起動画面の「はじめる」と保護者ゲートを通らずに、hash の画面を開く。例 `http://127.0.0.1:<port>/?dev-open#/explore/p4`・`/?dev-open#/parent/settings`。音は鳴らない（`audio.unlock` を通らない）。保護者画面の hash（`#/parent…`）で**読み込んだとき**だけゲートも開く（hash の変更だけでは開けない。検査は保護者画面と起動画面を読み込み直して開く）。保護者画面から子供画面へ移るとゲートは閉じる（今までどおり）。`import.meta.env.DEV` が false の本番ビルドでは `DEV_OPEN` が false に畳まれ、`dev-open` の文字も残らない（`devOpen.test.ts` が、指定が無いとき・本番のときに false であることを確かめる）。
- **`?dev-setup=preparing|renewing|failed|offline`・`?dev-notes=2`**（起動画面。text-layout-fixes A5）: 教材の準備の表示と、保護者向けの表示を最も長い 2 行にする。`start-setup-*` は、画面の根に `data-setup` が付いたときに検査する。付かない（A5 が未実装）ときは検査せず、要約に「**未対応**」と書く。

#### 見るもの

- **文字の重なり・切れ・改行**は `textLayoutProbe`（3.2 と同じ関数）。アプリの画面のために次の項目を足した（**どれも省略時は今と同じ動き**。`check:text-layout:probe` の 29 本が同じに通る）:
  - `root`: 調べる範囲の CSS セレクタ（既定は `.stage`）。板（ゲート `aria-modal`・おえかきの板 `.draw-panel`・確認 `.draw-confirm`・保護者画面の確認）が出ているときは、板を渡して中だけを見る（後ろの画面は板で隠すのが設計なので covered・overlap-button に数えない）。舞台の外の判定の範囲は、root が舞台の中なら舞台、外（保護者画面）なら画面。
  - `adultSel`・`minAdultPx`（既定 12）: 大人の文字の範囲（保護者画面 `.parent-root`・ゲートの板 `.gate-panel`・起動画面の保護者向けの表示 `.start-notes`。各画面の「（保護者の方へ）」で始まる文も含む）。この中の字は最小の大きさを px（12px）で見る。分かち書き（wakachi-split）とボタンの中の語の折れ（button-split）は見ない（大人の文は漢字かな交じりで書き、子供の規則を当てると誤検出になるため）。行頭・行末の禁則・数や単位の折れ（word-split）・重なり・切れ・最後の行が 1 文字は見る。
  - `pageScroll`: 画面全体のスクロールの枠（保護者画面の `.parent-root`）。この枠の縦のはみ出し（いまの位置で画面の外にある字・ボタン）は、その位置では検査しない（out-of-stage・clipped・scroll-hidden にしない）。巡回の側が `scrollTop` を 0 から `clientHeight × 0.8` ずつずらして、そのたびに検査し、同じ違反（種類・文字・場所）を最初の位置の 1 件にまとめる。横にスクロールが出るときは page-scroll にする。
- **アプリの画面に特有の種類**（`appLayoutProbe`。ページの中で動く）:

  | 種類 | 見るもの |
  |---|---|
  | `screen-overflow` | 画面の中身（ボタン・字・図）が舞台の外へ出る。1 画面 1 件で、超えた u と押せない札の名前を書く |
  | `unreachable` | 押せない札。見えている部分が札の半分未満、中心が別の要素に当たる（`elementsFromPoint`。`pointer-events` も効く）、5 点（中心と四隅の内側）のうち 3 点以上が別の要素に当たる・舞台の外 |
  | `tap-size` | 子供は補助 5.5u・主操作 6u 未満（主操作は `.tap`〔`tap--aux` 以外〕・`.choice`・`.home-card`・`.home-rec`・`.school-subject`・`.smap-unit`・`.gallery-thumb`・`.draw-tool`。学年のタブ `.explore-tab`・`.smap-tab` は補助）。大人は高さ 44px 未満（button・select・textarea・summary・checkbox/radio/range/hidden 以外の input） |
  | `tap-gap` | 主操作どうしの間が 1.6u 未満（DESINGN.md 2章。以前の `home-gap` を全部の主操作に広げた） |
  | `scroll-no-cue` | 子供画面で縦にスクロールする枠（`overflow-y` が auto・scroll で `scrollHeight > clientHeight + 2`）に `data-scroll-region` か、見える印（`data-scroll-cue`）が無い。1 枠 1 件 |
  | `scroll-no-button` | 幼児が見る画面（プロフィールの区分が p23・p4・p5）のスクロールの枠に ▲▼ の札（`[data-scroll-btn]`）が無い |
  | `fit-overflow` | `data-fit-overflow`（AppLabel が下限の字まで縮めても入らない）。教材の題を短くする手がかり（要約に一覧が出る） |
  | `edge-margin`（参考） | 主操作の札の下端・左右が舞台の端から 2u 未満 |
  | `missing-illust`（参考） | 絵が無くて開発用の点線の枠（`svg[data-illust]` の中が `#c00` の破線の `rect` 1 つ）になっている |

- 同じ枠の二重の報告は除く（印の無いスクロールの枠は、文字の検査の `scroll-hidden`〔印が無い〕でなく `scroll-no-cue` に任せる）。
- 分かち書きの「・」のあとの改行（3.2 と同じ `textLayoutProbe`）: 「・」の前後の項目がどちらも 2 字以上なら語の途中に数えない。項目は「・」か文の始め・終わりで区切った部分で、空白を含む句でもよい（選ぶ画面の札「ちいさい じ・／のばす おと」。前の部分を空白の所で止めて「じ」の 1 字と数えていたのは誤検出だった）。1 字の並び（き・つ・つ・き）は今までどおり出す。

#### 除くもの（理由。コード `appLayoutProbe`・`e2e/helpers/app-layout.ts` にも書いた）

- **鍵**（`.gate-key` 4.5u）: DESINGN.md 2章で、子供が間違えて押さないよう意図して小さい。
- **おえかきの「くわしく」の色の札**（`.draw-screen--detailed` の道具欄の `color-*` と、図形の選択板の `shape-color-*`。4.5u）: 19章で意図して小さい（くわしくは小学生向け）。「かんたん」の色の札は道具欄も図形の選択板も 6u なので数える（図形の選択板は かんたん でも 4.5u にしていて、この検査で見つかり 6u に直した）。
- **選んでいる札の持ち上がり**（`tap-gap`）: 選んでいる札（`.is-selected`）は DESINGN.md 8章の「選択中は 1u 持ち上がる」で `translateY(-1u)` が付き、上の札との間が 1.6u − 1u = 0.6u に見える（おえかきの道具欄・図形の選択板）。持ち上がりは選んだことを示す状態の表示で、並びの間（2章の 1.6u）は置いた位置で決まるので、`tap-gap` はその移動を戻した位置で測る（戻さないと、選んでいる札の上の間がどの並びでも必ず出る誤検出になる）。選んでいない札のずれは戻さない（probe で確かめる）。
- **板の後ろ**: 板が出ているときは `root` を板にして中だけを見る。後ろの画面は板で隠すのが設計。
- **印のあるスクロールの枠（`data-scroll-region`）の中**: スクロールで見るのが設計（DESINGN.md 5.3）なので、枠からはみ出した札は押せない札に数えず（枠の見えている範囲に全部は入っていない札は飛ばす）、字は 1 字ずつ数えない（`textLayoutProbe` と同じ）。枠に印・▲▼ の札が無いときだけ `scroll-no-cue`・`scroll-no-button` で出す。印も `data-scroll-region` も無い枠の中の札は、押せない札として数える（見えない札に届く手段が無い）。
- **保護者画面のページの縦スクロール**: 画面全体のスクロールは許す（横は出さない）。画面の端で半分切れた札・字は、その位置では見ず、別の位置で全部見える。
- **text-on-figure**: 参考のまま（意図した重ねがある）。

#### 落ち着くのを待つ（settle）

`settleApp`（text-layout の `settle` と同じ考え）。次の印が 4 フレーム続けて同じになるまで（最大 1 秒）待つ。印は `document.fonts`・全部の `img` の `complete`・ボタンの数と外接・`[data-fit]` の値・`[data-scroll-region]` の `scrollHeight`。有限のアニメーションは終わるまで待つ。サイズを変えたら待ち直す。待っても変わり続ける画面は、違反の detail の先頭に `unstable:` を付けて残す。

#### 結果・途中の再開・環境変数

- 結果はプロフィールごとに `.cache/app-layout/<プロフィール>.json`（画面を 1 つ終えるごとに書く）。同じ条件（プロフィール・状態・画面・サイズ・`src/app`・`src/parent`・`src/drawing`・`src/ui`・`src/styles`・`src/text`・`src/curriculum`・`src/illust` と、`e2e/helpers/app-layout*.ts`・`text-layout.ts` の更新時刻の最大）の結果があれば飛ばす。ソースを変えると、その後の実行では自動で作り直す。全部が終わると要約（`summary.md`・`report.json`）を作る（`npm run check:app-layout:summary` で要約だけ作り直す）。画像は、作り直す画面の分だけ消してから撮る。
- 環境変数: `MNW_APP_PROFILES=p4,g*`（プロフィール。`*` が使える）・`MNW_APP_SCREENS=explore*,parent-*`（画面）・`MNW_FRESH=1`（途中の結果を使わず、はじめから）・`MNW_WORKERS`（既定 3）・`MNW_REUSE_SERVER=1`（起動済みの開発サーバーを使う）・`MNW_PORT`（既定 4298）・`MNW_SHOTS`（種類ごとの代表の画像の枚数。既定 8）。
- 検査自体の確認: `npm run check:app-layout:probe`（`e2e/app-layout-probe.al.ts`。`page.setContent` の見本だけで、開発サーバーは起動しない）。わざと壊した見本で検出すること、普通の見本で何も出さないことを確かめる: 舞台の下に 4 段目の札がある格子（`screen-overflow`・`unreachable`。3 段なら出ない）、印の無いスクロールの一覧（`scroll-no-cue`。印があれば出ない。幼児で ▲▼ が無ければ `scroll-no-button`）、大人の範囲の 11px の字（13px は出ない）・34px のボタン（44px は出ない）、`aria-modal` の板の後ろのボタン（root が板なら covered にならない。板の中で重なった字は出る）、`.gate-key` 4.5u（出ない）、`data-fit-overflow`、画面全体のスクロールの枠の画面の外で重なった字（スクロールすると出る。端で半分切れた札は出ない）ほか。
- 検出できないこと: 字形の中の重なり、色・コントラスト、Canvas に描いた文字（おえかきの紙の上）、実機の指での押しやすさ（実寸は実機で測る。5章）。保護者ゲートの長押しが途中で取り消される件（`onPointerLeave`）は、検査が 3 回まで押し直すので見えない（再現の条件を確かめて直す。text-layout-fixes「アプリの画面」4.）。

## 4. 手動確認（開発PC）

- 主要画面（起動・ホーム・各モードの問題・ヒント・完了・保護者各タブ）のスクリーンショットを docs/screenshots/ に保存し、DESINGN.md 15章のチェック項目で目視確認。
- 音声: 生成音声を聞き、読み誤り（数字・助数詞・アクセント）を台本の `yomi` で修正。

## 5. 実機確認（Yoga 720 + Zorin）

開発環境から実機を操作できないため、チェックリスト（docs/device-checklist.md）として残す。主な項目:
- Chromium系・Firefox系の版の記録、起動・PWAインストール可否、オフライン再起動
- 指タッチでの操作感（全モード）、なぞりの遅延、ブラウザのジェスチャー（スワイプで戻る・ピンチ）との干渉
- Firefox のタッチ（Zorin で `MOZ_USE_XINPUT2=1` が必要な場合がある）
- 実寸（定規）、音量、表示倍率、起動時間
- 保護者が子供と試す観察（README の観察チェックリスト）
- 二重起動（アイコンを2回押したとき）の窓の前面化・全画面・F11 で戻ること（IN-14〜16。device-checklist の「二重起動」）

## 6. 実行コマンド

```bash
npm run check        # 型・lint・format
npm test             # 単体テスト
npm run e2e          # E2E（Chromium・Firefox）
npm run e2e:update   # 自動更新の通し（E-21。chromium だけ。約 5 分）
npm run test:py      # 更新の仕組み・配信・導入スクリプトの Python の試験（Linux は test:py:sh）
npm run check:audio  # 台本と音声ファイルの突き合わせ
```

## 7. 合格基準

- 単体テスト・E2E が両ブラウザで全件成功（既知の制約は明記して除外し、Issue に記録）。
- 自動のレイアウト検査で違反なし。
- 重大なレビュー指摘（学習設計・操作性・データ保全・オフライン）が修正済み、または未解決として明記。
