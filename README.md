# まなびのにわ（manabi-no-niwa）

2歳から小学生までの子供が日本語で使える、オフラインのブラウザ学習アプリです。

- 対象（2.0.0。258単元）:
  - 幼児: 2〜3歳（中で2歳段階・3歳段階に分かれる）、4歳、5歳
  - 小学1〜6年: 算数・国語（漢字の読み書きを含む）、生活（1・2年）、理科・社会・英語（3〜6年）、プログラミング（1〜6年）
  - 単元の一覧と学年の割り当ては docs/expansion/curriculum-matrix.md、作業の記録は docs/expansion/progress.md。優先度の低い単元（P2）は入っていません。
- プロフィールごとに「年齢の目安」「在籍学年」「習熟」「支援の設定（ふりがな・読み上げ など）」を別々に持ちます。学年で教材を閉じ込めません（先取り・さかのぼりができます）。
- 幼児は絵の札から遊びます。4歳のホームには初期版（1.0）の9つのあそびがそのまま入っています。小学生は教科 → 単元 → 問題の順に選びます。
- 全年齢で「おえかき」（ペン・消しゴム・塗り・はんこ63種・図形・やり直し・自動保存・PNG 書き出し）が使えます。
- ひらがなが読めなくても、絵と日本語の音声で遊べます。手書きや声を自動で採点することはありません。
- 広告・外部への通信・アカウント登録はありません。記録はこの端末のブラウザの中にだけ保存します。
- 罰・点数・ランキング・連続日数・ガチャはありません。1回は3〜5問の短い区切りです。

> この アプリの 記録は、遊んだ内容の記録です。能力の測定では ありません。
> 学習効果は検証していません（子供での観察もまだです）。教材は自動検査と独立レビューを通していますが、学校の教科書・テストの代わりではありません。

## 導入と起動（Zorin OS）

> 以下の手順は Windows 上の Git Bash で構文と動作の一部を確かめたものです。**Zorin OS の実機ではまだ確認していません**（docs/device-checklist.md）。

### 必要なもの
- Zorin OS（Ubuntu 系）。Python 3（標準で入っています。端末で `python3 --version` を実行して確認）。
- Chromium 系ブラウザ（Chromium / Google Chrome / Brave）または Firefox。
- アプリのアドレスは必ず **`http://127.0.0.1:8765/`** です。ポートやアドレスを変えると、学習データが別のものとして扱われ、見えなくなります。ブラウザのプロファイルも変えないでください。
- `index.html` を `file://` で直接開いても、オフライン機能（PWA）は動きません。必ず下の手順で開いてください。

### 導入（最初の1回）
1. GitHub の Releases から配布 zip を入手し、**すべて同じ場所**（ホームフォルダなど）に展開します。
   - 2.0.0 からは、本体 `manabi-no-niwa-<版>.zip` と、小学生の教材の音声 `manabi-no-niwa-<版>-audio-g1-g2.zip`・`-audio-g3-g4.zip`・`-audio-g5-g6.zip` に分かれています（ファイル数と大きさの上限のため）。どれも中の最上位が `manabi-no-niwa/` なので、同じ場所に展開すれば1つにそろいます。**4つとも展開してください**（音声が足りないと、その学年の教材パックを準備できません）。
   - 端末では例えば `cd ~ && for f in ~/ダウンロード/manabi-no-niwa-2.0.0*.zip; do unzip -o "$f"; done`。
2. 端末で次を実行します。何をするかの一覧が表示されるので、読んでから `y` で進めます（sudo は使いません）。
   ```bash
   bash ~/manabi-no-niwa/deploy/zorin/install.sh
   ```
   - アプリ本体を `~/.local/share/manabi-no-niwa/app/` に配置し、アプリ一覧とデスクトップに「まなびのにわ」を作ります。
3. ログインしたときに自動で配信を始めたい場合だけ、`--autostart` を付けて実行します（systemd のユーザー単位のサービス。ログイン中だけ動きます）。
   ```bash
   bash ~/manabi-no-niwa/deploy/zorin/install.sh --autostart
   ```
4. デスクトップのアイコンを初めて開くときに「起動を許可」と出たら許可します。
5. 初めて開くと、アプリの本体（音声・絵・フォントを含む）をブラウザに保存します。小学生の教材は学年ごとの「教材パック」に分かれていて、保護者画面「きょうざい」で準備します（通信は `127.0.0.1` だけ）。保護者画面「このアプリについて」で「オフラインで つかえます」になったら完了です。初回は、準備が終わった後にもう一度開き直すと、オフラインでも開けるようになります。

### 毎日の使い方
- デスクトップ（またはアプリ一覧）の「まなびのにわ」を開くだけです。コマンドは要りません。
  - 裏で小さな配信プログラム（`127.0.0.1` だけで待ち受け。外からは接続できません）を起動し、Chromium があればアプリ窓で、無ければ Firefox で開きます。使うブラウザは環境変数 `MANABI_BROWSER` で指定できます。
- 終わるときはブラウザの窓を閉じます。配信は裏で動き続けますが、とても軽いです。
- 配信も止める場合: `pkill -f deploy/zorin/serve.py`（自動起動にした場合は `systemctl --user stop manabi-no-niwa.service`）。
- 自動起動をやめる場合: `systemctl --user disable --now manabi-no-niwa.service`。
- 全画面表示は強制しません。保護者画面の「せってい」から切り替えられます（ブラウザの F11 でも解除できます）。

### 更新
1. 新しい配布 zip を展開し、もう一度 `install.sh` を実行します。学習データは消えません。
2. 次にアプリを開くと、新しい版を裏で準備します（遊んでいる途中で画面が変わることはありません）。
3. 保護者画面「このアプリについて」に「あたらしい ばーじょんが あります」と出たら「こうしんする」を押します。押さなくても、すべての窓を閉じて開き直せば切り替わります。

### 取り消し
```bash
bash ~/.local/share/manabi-no-niwa/app/deploy/zorin/uninstall.sh
```
学習データはブラウザの中にあるため、これでは消えません。消すときは保護者画面の「データ」かブラウザの設定（サイトデータの削除）を使います。

### 通信が必要な場面
| 場面 | インターネット | 説明 |
|---|---|---|
| 導入時 | 必要 | 配布 zip を入手するときだけ。`install.sh` は通信しません |
| 初回の準備 | 不要 | `127.0.0.1` の配信から全ファイルをブラウザに保存します。画面に準備の割合が出ます |
| 日常の利用 | 不要 | 外部への通信は一切行いません（広告・解析・音声合成サービスなし） |
| 更新時 | 必要 | 新しい配布 zip を入手するときだけ。その後の新版の準備は `127.0.0.1` だけです |

### ブラウザごとの違い
- **Chromium 系**: アプリ窓（`--app`）で開きます。PWA としてインストールもできます（実機では未確認）。
- **Firefox**: 通常のタブで使います。デスクトップ版の Firefox は通常 PWA のインストールができませんが、オフライン利用（Service Worker）は動きます（開発環境の Playwright で、準備後に配信を止めても開けることを確認）。
  - Zorin でタッチがマウスとして扱われる場合は、Firefox を `MOZ_USE_XINPUT2=1` を付けて起動すると改善することがあります（実機未確認）。
- ブラウザを変えると記録は別々になります。

## 保護者画面

ホーム右上の小さな鍵のボタンを **2秒長押し** → 表示された足し算に答えると開きます（任意で暗証番号に変更できます）。

- **これは子供の誤操作を防ぐためのもので、強固な保護ではありません**（ブラウザの開発者ツールなどで回避できます）。
- できること: 記録（自分でできた問題・ヒントを使った問題・まだ取り組んでいない内容・操作にとまどったかもしれない記録）、設定（音量・効果音・動きを減らす・利用時間の目安・1回の問題数・ホームの表示・なぞりの判定幅・難易度の固定）、作品、観察メモ、プロフィール（きょうだいで分けられます）、データの書き出し・読み込み、オフラインの準備状況と更新。
- 利用時間の目安（初期10分）は医学的な推奨ではありません。目安に達すると、遊びの区切りで「きょうは ここまで」と出ます。

## 記録のバックアップ（大切）

記録・設定・作品は、このブラウザの保存領域（IndexedDB）にあります。

- **ブラウザの「閲覧データの削除」「サイトデータの削除」をすると、記録も消えます。**
- **アドレス（`http://127.0.0.1:8765/`）が変わると、別のアプリとして扱われ、記録が見えなくなります。** ポート番号やホスト名（`localhost` と `127.0.0.1` は別扱い）を変えないでください。
- ブラウザを変えた場合（Chromium ↔ Firefox）も、記録は別々です。
- 定期的に、保護者画面 →「データ」→「書き出し」でファイルに保存してください。
- 読み込みは「プロフィールとして追加」が基本です。「すべて置き換え」は確認のうえ、直前の状態を自動で書き出してから行います。
- 保護者画面の「データを守る」を押すと、ブラウザに保存の継続を求めます（ブラウザが許可しない場合もあります）。

## 素材とライセンス

| 素材 | 出典 | ライセンス |
|---|---|---|
| ソースコード | このリポジトリ | MIT（LICENSE） |
| イラスト・アイコン | このアプリのオリジナル SVG（src/illust） | MIT（コードと同じ） |
| 日本語音声（public/audio） | Open JTalk（pyopenjtalk-plus）で生成。声は「Mei」HTS Voice（MMDAgent Project Team / 名古屋工業大学） | 声: CC BY 3.0（licenses/mei-voice-COPYRIGHT.txt, licenses/CC-BY-3.0-legalcode.txt）。Open JTalk・辞書: Modified BSD |
| フォント | Zen Maru Gothic（© The Zen Maru Gothic Project Authors）、Klee One（© The Klee Project Authors） | SIL Open Font License 1.1（licenses/OFL-*.txt）。使う文字だけに絞って同梱 |
| ひらがなの書き順データ（src/modes/trace/data/kana-strokes.json） | KanjiVG（© Ulrich Apel）を等間隔の点に変換 | CC BY-SA 3.0（licenses/KanjiVG-COPYING-CC-BY-SA-3.0.txt）。このファイルは CC BY-SA 3.0 で提供します |
| かな・漢字の書き順データ（src/packs/_data/strokes/） | KanjiVG（© Ulrich Apel）から変換（licenses/KanjiVG-derived-data-NOTICE.txt） | CC BY-SA 3.0。これらのファイルは CC BY-SA 3.0 で提供します |
| 日本地図（src/engines/map/data/japan.json） | Natural Earth 1:10m Admin 1 を簡略化 | パブリックドメイン（licenses/NaturalEarth-NOTICE.txt） |
| 教材の文・問題 | このアプリのオリジナル（他社の教材・教科書の問題や文を写していません。昔話・古典は著作権の切れた原典から再話） | MIT（コードと同じ） |

クレジット表記: 音声「Mei」(c) Nagoya Institute of Technology, CC BY 3.0 / 書き順 KanjiVG (c) Ulrich Apel, CC BY-SA 3.0 / フォント Zen Maru Gothic・Klee One, SIL OFL 1.1

### 音声の作り直し・差し替え
- 台本は `src/voice/catalog/common.ts` と各モードの `src/modes/<mode>/voice.ts` にあり、`npm run voice:script` で `voice/script.json`（全文の一覧）を出力します。
- `npm run voice:build`（Windows）／`npm run voice:build:sh`（Linux）で Open JTalk により `public/audio/*.mp3` を作り直します（手順: docs/assets-pipeline.md）。実行時は音声合成を使いません。
- 家庭で録音した声に差し替える場合は、`voice/script.json` の各キーと同じ名前の mp3 を `public/audio/` に置き、`public/audio/manifest.json` を更新してからビルドします（録音した声は公開リポジトリに含めないでください）。
- **教材パックの音声**（`public/audio/<パック名>/`、数万本）は git に入れず、配布 zip にだけ同梱しています。リポジトリから自分でビルドするときは、`npm run voice:packs` で台本（`voice/packs/*.json`）を書き出し、パックごとに `python scripts/voice/generate.py --script voice/packs/<パック名>.json --out public/audio/<パック名>` で作ります（docs/assets-pipeline.md）。
- 音声ファイルが無い場合だけ、ブラウザの日本語読み上げで代わりに読みます。どちらも無い場合は無音になり、保護者画面に「おとが でない」と表示します。

## 開発

```bash
npm install
npm run dev          # http://127.0.0.1:5173
npm run check        # 型・lint・format
npm test             # 単体テスト（Vitest）
npm run e2e          # E2E（Playwright: Chromium・Firefox）
npm run check:design # DESINGN.md の自動検査
npm run check:audio  # 台本と音声ファイルの突き合わせ
npm run build        # dist/ に本番ビルド
npm run package      # release/ に配布用 zip
```

設計文書:
- [docs/requirements.md](docs/requirements.md) 要件定義（要件IDと受入条件）
- [docs/research.md](docs/research.md) 調査記録
- [docs/architecture.md](docs/architecture.md) アーキテクチャ
- [docs/learning-design.md](docs/learning-design.md) 学習設計（9モードの段階・教材数・判定・ヒント）
- [DESINGN.md](DESINGN.md) 見た目と体験の規約（正本）
- [docs/test-plan.md](docs/test-plan.md) テスト計画
- [docs/implementation-plan.md](docs/implementation-plan.md) 実装計画
- [docs/mode-guide.md](docs/mode-guide.md) モードの作り方
- [docs/device-checklist.md](docs/device-checklist.md) 実機確認チェックリスト
- [docs/assets-pipeline.md](docs/assets-pipeline.md) 音声・フォント・書き順データの作り方
- [docs/expansion/](docs/expansion/) 2.0（対象年齢の拡張）の調査・要件・設計・単元対応表・計画・レビュー・進捗（[progress.md](docs/expansion/progress.md)）

## 保護者が子供と試すときの観察チェックリスト

数分そばで見て、気づいたことを保護者画面の「メモ」に残してください。
1. 自分で「はじめる」を押して、遊びを選べたか（どの絵を選んだか）
2. 問題の声を聞いて、何をすればよいか分かっていたか（「もういちど きく」を使ったか）
3. 間違えたとき、ヒントの後にもう一度試せたか。いやになってやめなかったか
4. どこで手が止まったか（操作が分からない／内容が難しい、のどちらに見えたか）
5. 「おうち」を自分で押して終われたか。「きょうは ここまで」で納得して終われたか
6. 次の日、自分から「やりたい」と言ったか
7. 遊んだ内容（数える・形・字）が、生活の会話や遊びに出てきたか

アプリでの指の練習は、鉛筆の持ち方や筆圧の練習とは別のものです。
