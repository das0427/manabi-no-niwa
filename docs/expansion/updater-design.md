# 自動更新（アップデーター）の設計（docs/expansion/updater-design.md）

2026-11-06 設計。対象の版: **2.1.0**（この版に入れる）。作業ブランチ: p3/updater。

---

## 0. この文書について

- 依頼: 「GitHub で後続バージョンが公開されたら、ネットワーク接続時には面倒なことせずにアップデートできるようにできない？」
- 決まったこと:
  - **確認は自動**: 配信（serve.py）が起動したとき、ネットにつながっていれば GitHub に新しい版があるかを確かめる。
  - **入れるのは保護者が1回押す**: 保護者画面「このアプリについて」の「更新する」を1回押すと、取得 → 確かめ → 切り替え → アプリ（Service Worker）の新しい版の準備と切り替え → 取得済みの教材パックの取り直し まで自動で進む。もう一度押させない。
  - **2.1.0 に入れる**: 2.0.x からは今までどおり手で1回入れ直す（README の手順）。2.1.0 の次の版からは保護者画面で1回押すだけ。
- この文書は設計だけを決める。実装は 12 章の単位（U1〜U4）で並行して行う。e2e と文書（README・要件・architecture・DESINGN・test-plan）の書き換えは後の段で行う（10 章・11.3 節に中身を決めておく）。
- 用語:

| 用語 | 意味 |
|---|---|
| 配信 | `deploy/zorin/serve.py`（`127.0.0.1:8765` だけで待ち受け） |
| 更新の仕組み | serve.py の中で動く Python のパッケージ `deploy/zorin/mnwupdate/`（新規） |
| 版の情報 | リリースの asset `manabi-no-niwa-update.json`（3.1 節） |
| 部品 | リリースの zip 1つ。種類（kind）は `main`・`audio-g1-g2`・`audio-g3-g4`・`audio-g5-g6` |
| 部品の印 | zip の中の `manabi-no-niwa/parts/<kind>.json`（3.2 節） |
| 置き場 | `~/.local/share/manabi-no-niwa/`（4 章） |
| 窓口 | serve.py の `/__manabi/update/…`（5.3 節） |

---

## 1. 全体の流れ

```
【リリースする人】
  npm run build → npm run package
    → release/ に zip 4つ ＋ .sha256 4つ ＋ manabi-no-niwa-update.json（版の情報）
    → GitHub Releases に v2.2.0 として置く（版の情報は最後に置く）

【家のパソコン】
  serve.py 起動 ──15秒後──▶ 版の情報を取得
     │   https://github.com/das0427/manabi-no-niwa/releases/latest/download/manabi-no-niwa-update.json
     │   （ネットが無ければ静かにやめる。30分後にもう一度。成功したら12時間後）
     ▼
  窓口 GET /__manabi/update/status に「新しい版 2.2.0・公開日・変わった点・取得する大きさ」を載せる
     ▼
  保護者画面「このアプリについて」に表示（保護者画面の上にも小さな知らせ）
     ▼
  保護者が［更新する］を1回押す（POST /__manabi/update/apply）
     ▼ ───────────── ここから自動 ─────────────
  serve.py:
     版の情報を取り直す → 変わった zip だけ取得（途中で切れたら続きから・大きさと sha256 を確かめる）
     → app.next に組み立て（取得した zip を検査して展開。変わらない部品は今の版からハードリンクで写す）
     → 中身の確かめ → 新しい serve.py の自己検査
     → app と app.next を入れ替え（前の版は app.prev。失敗したら元に戻す）
     → serve.py 自身を起動し直す（execv。systemd の自動起動でも同じ PID のまま）
     → 新しい serve.py が版を確かめて「done」→ app.prev と取得した zip を消す
     ▼
  アプリ（ブラウザ）:
     窓口を見て、配信の版がアプリの版より新しくなったら Service Worker の更新を確かめる
     → 新しい版をキャッシュに準備（進み具合を表示）→ 切り替えて読み込み直す（押させない）
     → 読み込み直したあと、取得済みの教材パックのうち版が古いものを自動で取り直す（記録は消さない）
```

---

## 2. 守ること と 守り方

| 守ること | 守り方（この設計で決めたこと） |
|---|---|
| sudo・管理者権限を使わない | 書くのは利用者のホームの下だけ（下の行）。root で動いている serve.py では更新の仕組みを止める（`os.geteuid() == 0` なら `supported:false`・理由 `root`） |
| 端末のシステム設定・サービス登録を勝手にしない | 更新の仕組みが書く場所は **`<DATA>/manabi-no-niwa/{app, app.next, app.prev, update}` と `<CONFIG>/manabi-no-niwa/updater.json` だけ**（`<DATA>`=`${XDG_DATA_HOME:-~/.local/share}`、`<CONFIG>`=`${XDG_CONFIG_HOME:-~/.config}`）。`.desktop`・systemd の単位ファイル・デスクトップのアイコンには触らない（それらが指すパス `app/deploy/zorin/manabi.sh`・`app/deploy/zorin/serve.py`・`app/dist/icons/icon-192.png` は版をまたいで変えない約束にする） |
| 待ち受けは 127.0.0.1 だけ | 今までどおり。再起動のあとも同じ（`HOST = "127.0.0.1"` は変えない） |
| 外への通信は更新の確認と取得のときだけ、GitHub のこのリポジトリと配布用ホストだけ | 外へつなぐのは serve.py の更新の仕組みだけ。URL はコードに固定（`https://github.com/das0427/manabi-no-niwa/releases/…`）。版の情報から URL を受け取らない（受け取るのはタグと zip の名前だけで、正規表現で確かめる）。転送先は許可リスト（3.4 節）で毎回確かめる |
| アプリ（ブラウザ）から外へ通信しない | CSP の `connect-src 'self'` は変えない。アプリが話すのは同じオリジンの窓口（`/__manabi/update/…`）だけ |
| 保護者画面で自動の確認をオフにできる | 「このアプリについて」のチェックボックス → `POST /__manabi/update/settings`。設定は `<CONFIG>/manabi-no-niwa/updater.json`。オフのときは、保護者が「今すぐ確かめる」「更新する」を押したとき以外、外へつながない |
| トラッキング・アカウントなし | 送るのは HTTPS の GET だけ。User-Agent は `manabi-no-niwa-updater`（版も ID も付けない）。Cookie を持たない。問い合わせの文字列（クエリ）に何も付けない。GitHub には IP アドレスが届く（ふつうのウェブの閲覧と同じ）ことを README に書く |
| 学習の記録（IndexedDB）を消さない・オリジンを変えない | 更新の仕組みはブラウザのデータに触らない。ポート 8765・ホスト 127.0.0.1 は変えない。アプリ側の切り替えは今までの Service Worker の更新と同じ（記録は残る。OF-06） |
| Python は標準ライブラリだけ | `urllib.request`・`ssl`・`hashlib`・`zipfile`・`json`・`threading`・`ctypes`（入れ替えの `renameat2`）・`fcntl`（鍵）だけ。**Python 3.10 で動く書き方**にする（Zorin OS 17 は 3.10、18 は 3.12。`datetime.UTC`・`tomllib`・`except*` は使わない） |
| 人が聞く・人が見て判断する作業を作らない | 更新の途中で確認の質問を出さない。失敗したら自動で元に戻し、理由と次にすることを表示する |

---

## 3. 版の情報とリリースの作り

### 3.1 版の情報 `manabi-no-niwa-update.json`

リリースごとに `scripts/package-release.ts` が `release/manabi-no-niwa-update.json` を作り、リリースの asset に置く。名前に版を入れない（`latest/download` で取れるように）。

```json
{
  "schema": 1,
  "app": "manabi-no-niwa",
  "version": "2.2.0",
  "tag": "v2.2.0",
  "date": "2026-11-20",
  "minVersion": "2.1.0",
  "notes": [
    "小学4年の算数に「がい数」を足しました",
    "おえかきの消しゴムが太くなりました"
  ],
  "parts": [
    {
      "kind": "main",
      "name": "manabi-no-niwa-2.2.0.zip",
      "bytes": 178257920,
      "sha256": "<64桁の16進（小文字）>",
      "contentId": "<64桁の16進（小文字）>",
      "files": 2310,
      "unpackedBytes": 190012345
    },
    { "kind": "audio-g1-g2", "name": "manabi-no-niwa-2.2.0-audio-g1-g2.zip", "bytes": 345000000, "sha256": "…", "contentId": "…", "files": 9800, "unpackedBytes": 344900000 },
    { "kind": "audio-g3-g4", "name": "manabi-no-niwa-2.2.0-audio-g3-g4.zip", "bytes": 790000000, "sha256": "…", "contentId": "…", "files": 21000, "unpackedBytes": 789800000 },
    { "kind": "audio-g5-g6", "name": "manabi-no-niwa-2.2.0-audio-g5-g6.zip", "bytes": 1300000000, "sha256": "…", "contentId": "…", "files": 33000, "unpackedBytes": 1299700000 }
  ]
}
```

| 欄 | 決まり（serve.py 側が確かめる。合わなければ `bad-manifest`） |
|---|---|
| `schema` | 整数。`1` だけを理解する。`2` 以上なら「自動では入れられない」（`blockedReason: "schema"`）として表示だけする |
| `app` | `"manabi-no-niwa"` |
| `version` | `^\d{1,4}\.\d{1,4}\.\d{1,6}$`（`X.Y.Z` だけ。先行版の印は付けない） |
| `tag` | `"v" + version` と一致 |
| `date` | `^\d{4}-\d{2}-\d{2}$`（作った日。日本時間） |
| `minVersion` | `X.Y.Z`。`minVersion <= version`。**今の版が `minVersion` より古いと自動では入れない**（`blockedReason: "min-version"`。README の手で入れ直す手順を案内） |
| `notes` | 文字列の配列。0〜5 個。1つ 120 文字まで（超えた分は切る）。制御文字は取り除く。画面では文字として出す（HTML として解釈しない） |
| `parts` | 1〜8 個。`kind` が重ならない。`main` がちょうど1つ |
| `parts[].kind` | `^[a-z0-9][a-z0-9-]{0,39}$` |
| `parts[].name` | `main` は `manabi-no-niwa-<version>.zip`、ほかは `manabi-no-niwa-<version>-<kind>.zip` と完全に一致 |
| `parts[].bytes` | zip の大きさ。整数 1〜2147483648（GitHub の添付の上限 2GiB） |
| `parts[].sha256` | zip 全体の sha256。`^[0-9a-f]{64}$` |
| `parts[].contentId` | 中身の ID（3.2 節）。`^[0-9a-f]{64}$` |
| `parts[].files` | 中身のファイルの数（**部品の印を除く**）。整数 1〜65534 |
| `parts[].unpackedBytes` | 中身の合計の大きさ（**部品の印を除く**）。整数 0〜4294967295 |

- 版の情報の大きさは 64KiB まで（超えたら `bad-manifest`）。
- `minVersion` は `scripts/release-lib.ts` の定数 `MIN_AUTO_UPDATE_FROM`（2.1.0 では `"2.1.0"`）。**上げるとき**: 新しい版を古い更新の仕組みでは正しく入れられないとき（置き場の作りを変える、`.desktop`・systemd の単位ファイルの中身を変える、部品の印の形を変える など）。
- 変わった点（`notes`）は `docs/expansion/release-<version>.md` の見出し `## 保護者画面に出す短い説明` の下の箇条書き（`- ` で始まる行。最大5行）から取る。ファイルか見出しが無ければ `notes: []` にして警告を出す（作成は止めない）。

### 3.2 部品の印 `parts/<kind>.json` と 中身の ID（contentId）

**決めたこと: 「変わった zip だけ取得」は zip の sha256 ではなく、中身の ID（contentId）で比べる。**

理由:
1. 今の zip には作った時刻が入るので、中身が同じでも作るたびに sha256 が変わる。
2. 時刻を固定して zip を毎回同じに作れたとしても、zip の sha256 は zip の中に書けない。手で入れた版（install.sh）では、入れた zip の sha256 を知る方法が無い（展開したファイルしか無い）。
3. 中身の ID なら zip の中の印に書いておけるので、install.sh で入れても、更新の仕組みで入れても、`app/parts/<kind>.json` を読めば今の中身が分かる。

各 zip に、部品の印を1つ入れる（`manabi-no-niwa/parts/<kind>.json`）:

```json
{
  "schema": 1,
  "app": "manabi-no-niwa",
  "kind": "audio-g1-g2",
  "version": "2.2.0",
  "contentId": "<64桁の16進>",
  "files": 12345,
  "unpackedBytes": 345678901,
  "roots": ["dist/audio/g1-kokugo", "dist/audio/g1-sansu", "dist/audio/g2-kokugo"]
}
```

- `contentId` = 次の文字列（UTF-8）の sha256（16進・小文字）:
  中身の各ファイル（**部品の印を除く**）について `<相対パス>\t<大きさ（10進）>\t<内容の sha256（16進）>\n` を、相対パスの順（JavaScript の文字列の `<` で並べる。パスは ASCII だけの想定）につないだもの。相対パスは zip の中の名前から先頭の `manabi-no-niwa/` を除いたもの（例 `dist/audio/g1-kokugo/q1.mp3`）。
- `files`・`unpackedBytes` は印を除いた中身の数と合計。版の情報の `parts[]` の同じ欄と同じ値。
- `roots`: その部品が持つフォルダ（音声の部品は `dist/audio/<packId>` を並べたもの）。**変わらない部品を今の版から写すとき、この下を全部写す**。`main` は `[]`（main は毎回取得する。版が変われば `version.json` が変わるので、中身は必ず変わる）。
- `version`: その zip を作ったときの版。変わらない部品を写したときは、写した印をそのまま使う（中身の ID が正しければよい）。
- Python 側は contentId を計算し直さない（文字列として比べるだけ）。zip は sha256 で、写した部品はファイルの数と合計の大きさで確かめる（5.6 節）。

`main` の印にも同じ形で書く。**今の版の番号は `app/parts/main.json` の `version`** から読む（`dist/version.json` の `version` は Service Worker の版ID（内容のハッシュ）で、版の番号ではないため）。あわせて `dist/version.json` に `appVersion`（package.json の版）を足し、自己検査で `parts/main.json` の版と合うかを確かめる。

### 3.3 取り方: `releases/latest/download/<名前>` を使う

**決めたこと**: 版の情報は `https://github.com/das0427/manabi-no-niwa/releases/latest/download/manabi-no-niwa-update.json` から取る。zip は `https://github.com/das0427/manabi-no-niwa/releases/download/<tag>/<name>` から取る（`<tag>`・`<name>` は版の情報の値。3.1 節の形に合うことを確かめてから URL に入れる）。

理由:
- GitHub の API（`api.github.com/repos/…/releases/latest`）は認証なしだと 1 時間に 60 回の回数制限があり、家の回線を複数の機器で共有していると当たることがある。`latest/download` はふつうのダウンロードと同じ扱いで回数制限の心配が少ない。
- API の応答（大きな JSON）を読まなくてよい。必要な情報は全部、版の情報に入れる。
- `latest` は「下書きでも先行版（prerelease）でもない、いちばん新しいリリース」を指すので、ベータ版を家に配らない。
- 欠点: リリースの一覧は取れない（必要ない）。最新のリリースに版の情報が無い（2.0.x など）ときは 404 になる → 「新しい版の情報は無い」として扱う（エラーにしない）。

### 3.4 転送先の許可リストと TLS

- `github.com` は 302 で配布用ホストへ転送する。**転送のたびに、転送先を確かめる**:
  - スキームが `https` であること
  - ホストが許可リスト `{"github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com"}` のどれかと**完全に一致**すること（`github.com.example.com` などは不可）
  - ポートが無いか 443、URL に利用者名・パスワード（`user@`）が無いこと
  - 転送は 5 回まで
  - 合わなければ `redirect-host` で止める（何も保存しない）
- TLS: `ssl.create_default_context()`（証明書とホスト名の確認あり。OS の証明書を使う）。**確認を切る設定は作らない**（環境変数でも切れない）。
- プロキシ: 環境変数（`https_proxy`・`no_proxy`）は urllib の既定どおり使う（家庭でプロキシを使う人のため。TLS は相手のホストまでつながったまま確かめる）。
- `urllib.request` の転送の処理（`HTTPRedirectHandler`）を継ぎ、`redirect_request` で上の確認をする。`Range` の見出しは転送先にもそのまま付く（urllib の動き）。

**試験用の切り替え（偽の GitHub に向ける）**:
- 環境変数 `MANABI_UPDATE_TEST_ORIGIN` に `http://127.0.0.1:<ポート>` を入れたときだけ、GitHub の代わりにその場所を使う。形は `^http://127\.0\.0\.1:([0-9]{1,5})$`（ポート 1〜65535）に**完全一致**だけを受け付ける（`localhost`・`127.0.0.2`・`https`・パス付き・利用者名付きは不可）。
- そのときの URL: `<origin>/das0427/manabi-no-niwa/releases/latest/download/manabi-no-niwa-update.json`、`<origin>/das0427/manabi-no-niwa/releases/download/<tag>/<name>`。転送先の許可リストは**その origin（ホストとポート）だけ**になり、GitHub へはつながない。プロキシは使わない。
- 形が合わない値が入っていたら、**更新の仕組み全体を止める**（`supported:false`・理由 `bad-test-origin`。GitHub にも向けない）。
- 本番で悪用できない理由: 向けられるのは同じパソコンの 127.0.0.1 だけ。環境変数を書き換えられる者は、すでにその利用者として何でもできる。

### 3.5 署名を付けるか → **2.1.0 では付けない**

付けない理由:
1. **Python の標準ライブラリに公開鍵署名の検証が無い**（Ed25519・ECDSA の検証は `cryptography` などの外部の部品が要る）。RSA の検証を自分で書くことはできるが、詰め物（padding）の確かめの誤りで署名を偽造される例が多く、自作の暗号は避ける。
2. **鍵の管理の手間**: 鍵を作る・安全にしまう・なくしたら更新を出せなくなる（全員に手で入れ直してもらう）・漏れたら差し替える、を1人の開発者が続けるのは重い。
3. **守れる範囲が狭い**: 署名が守るのは「GitHub のアカウント・リポジトリが乗っ取られて、偽の版が置かれた」場合だけ。鍵が開発機にあれば、開発機を乗っ取られたときは守れない。通信の途中での改ざんは HTTPS で守られる。

付けない代わりの守り:
- HTTPS（証明書とホスト名の確認を切らない）と転送先の許可リスト（3.4 節）
- リポジトリの固定（コードに書く。版の情報から URL を受け取らない）
- zip の大きさと sha256（途中で切れた・壊れたものを入れない）
- zip の中のパスの検査・展開は別の置き場・中身の確かめ・新しい serve.py の自己検査（5.7〜5.8 節）
- 運用で: GitHub の2段階認証、リポジトリの設定で「immutable releases」（公開したリリースの asset を差し替えられなくする）を有効にする、asset を全部上げてから公開する（12 章の後の段で release の手順に書く）。

残るリスク: GitHub のアカウントが乗っ取られると、偽の版を配られうる（9 章）。将来署名を付けるなら、版の情報の `schema: 2` に署名の欄を足し、検証を入れた更新の仕組みを出す（その版から先にだけ効く。それより前の版には効かない）。

### 3.6 リリースの手順に足すこと（後の段で docs に書く）

1. `docs/expansion/release-<版>.md` に `## 保護者画面に出す短い説明`（箇条書き 5 行まで）を書く。
2. `npm run build` → `npm run package`。`release/` に zip 4つ・`.sha256` 4つ・`manabi-no-niwa-update.json` ができる。
3. GitHub でタグ `v<版>` の下書きのリリースを作り、zip と `.sha256` を上げ、**最後に** `manabi-no-niwa-update.json` を上げる。先行版にしない。「Set as latest」にして公開する。
4. （任意）開発機で `py -3 deploy/zorin/serve.py --check-update` を実行し、版の情報が取れることを確かめる（5.1 節）。

---

## 4. 置き場の作り（install.sh と更新の仕組みが同じ形を作る）

```
<DATA>/manabi-no-niwa/                  <DATA> = ${XDG_DATA_HOME:-~/.local/share}
  app/                    いまの版。中身は「配布 zip の manabi-no-niwa/ の下」と同じ:
    dist/                   アプリ本体と教材の音声
    deploy/zorin/           serve.py・manabi.sh・install.sh・uninstall.sh・manabi-no-niwa.desktop・
                            manabi-no-niwa.service・mnwupdate/（__init__.py ほか）
    parts/                  main.json・audio-g1-g2.json・audio-g3-g4.json・audio-g5-g6.json（部品の印）
    licenses/  README.md  LICENSE  DESINGN.md  docs/device-checklist.md
  app.next/               組み立て中の新しい版（更新の途中だけある）
  app.prev/               入れ替えた直後の前の版（新しい serve.py が版を確かめたら消す）
  update/
    downloads/            <zip名>.part・<zip名>.part.json（取得の途中）、<zip名>（確かめ済み）
    state.json            更新の状態（再起動をまたいで残す。5.11 節）
    lock                  同時に2つの更新が動かないための鍵（fcntl.flock）
<CONFIG>/manabi-no-niwa/updater.json    {"schema":1,"autoCheck":true}（無ければオン）
<STATE>/manabi-no-niwa/serve.log        今までどおり（manabi.sh が書く。<STATE> = ${XDG_STATE_HOME:-~/.local/state}）
```

- 更新の仕組みは `<DATA>/manabi-no-niwa/` を **serve.py 自身の場所から求める**（`XDG_DATA_HOME` を見ない）。`app.next` と `app` が必ず同じファイルシステムに入り、名前の付け替え（rename）で入れ替えられるようにするため。
- 設定だけは `XDG_CONFIG_HOME`（無ければ `~/.config`）を見る。
- 2.0.x の install.sh が作った `app/`（`dist/` と `deploy/zorin/` だけ）は、2.1.0 の install.sh が丸ごと入れ替える（7 章）。

---

## 5. serve.py 側

### 5.1 ファイルと、更新の仕組みが動く条件

新しいファイル（Python のパッケージ。1ファイル概ね 400 行以内）:

| ファイル | 役割 |
|---|---|
| `deploy/zorin/mnwupdate/__init__.py` | パッケージの印と説明 |
| `deploy/zorin/mnwupdate/common.py` | `UpdateError`（`code`・`detail`・`need_bytes`）、置き場（`Layout`）と `detect_layout()`、時刻（ISO 8601・UTC・`Z`）、JSON の読み書き（大きさの上限・一時ファイル＋`os.replace`） |
| `deploy/zorin/mnwupdate/manifest.py` | 版の情報・部品の印の確かめ、版の比較、今の中身の読み取り、計画（どの部品を取得するか） |
| `deploy/zorin/mnwupdate/fetch.py` | 取得先（GitHub／試験用）、転送先の確認、版の情報の取得、zip の取得（続きから・sha256） |
| `deploy/zorin/mnwupdate/install.py` | 空き容量、zip の検査と展開、変わらない部品の写し、中身の確かめ、自己検査の呼び出し、入れ替えと元に戻す、片付け |
| `deploy/zorin/mnwupdate/service.py` | 状態・設定・自動の確認の予定・更新の作業（別スレッド）・再起動の合図 |
| `deploy/zorin/mnwupdate/api.py` | 窓口（`/__manabi/update/…`）の振り分けと守り（5.4 節） |

serve.py の変更:
- 先頭で `sys.dont_write_bytecode = True`（置き場に `__pycache__` を作らない）。
- 自分のフォルダ（`deploy/zorin`）を `sys.path` の先頭に入れてから `mnwupdate` を読み込む。**読み込みに失敗しても配信は続ける**（`supported:false`・理由 `updater-error`。標準エラーに1行）。
- 更新の仕組みが動く条件（`detect_layout(serve_py_path, dist_dir)`）。どれかが合わなければ `supported:false` と理由:

| 条件 | 合わないときの理由 |
|---|---|
| serve.py の場所が `<…>/manabi-no-niwa/app/deploy/zorin/serve.py` の形（`os.path.abspath` で見る） | `not-installed` |
| `--dir` を指定していないか、`app/dist` と同じ | `custom-dir` |
| `app/parts/main.json` があり、`version` が `X.Y.Z` | `no-parts` |
| root で動いていない（`os.geteuid` がある環境で 0 でない） | `root` |
| `MANABI_UPDATE_TEST_ORIGIN` が空か正しい形 | `bad-test-origin` |
| `mnwupdate` を読み込めた | `updater-error` |

- 新しい引数:
  - `--self-test`: 自己検査（5.8 節）。成功で終了コード 0、失敗で 1（理由を標準エラーに）。ネットにつながない・ファイルを書かない。
  - `--check-update`: 版の情報を1回だけ取得して、要約の JSON（`{"latest": …|null, "error": …|null}`）を標準出力に出して終わる（成功・「版の情報なし」は 0、失敗は 1）。置き場が無くても動く（保守用。リリースのあとの確かめ）。
- `do_POST` を足す（`/__manabi/update/` だけを受け付ける。ほかのパスは 405）。`/__manabi/update/` の GET も静的なファイルより先に振り分ける。
- `/__manabi/health` は変えない（`{"app":"manabi-no-niwa","version":<SWの版ID>}`）。manabi.sh が使う。

### 5.2 自動の確認（予定）

| 定数 | 値 |
|---|---|
| 起動してから最初の確認まで | 15 秒 |
| 確認が成功したら、次の確認まで | 12 時間 |
| 失敗（ネットが無い・GitHub の不調）したら、次の確認まで | 30 分 |
| 「今すぐ確かめる」を続けて押したとき | 確認中か、前の確認から 10 秒以内なら、新しく確認せず今の状態を返す（202） |

- 自動の確認はオフ（`autoCheck:false`）のとき行わない。オンに戻したら 5 秒後に確認する。
- 確認の中身: 版の情報を取得 → 確かめる → 今の中身（`app/parts/*.json`）と比べて計画を作る（ファイルを歩かず contentId だけで比べる。速い）→ `latest` を作る → `state.json` に保存。
- ネットが無いとき（名前の解決の失敗・接続の失敗・時間切れ）は `check.state = "offline"` にするだけ。記録（標準エラー）は状態が変わったときだけ1行（30分ごとに同じ行を出さない）。
- 最新のリリースに版の情報が無い（404）ときは `check.state = "ok"`・`latest = null`（新しい版の情報は無い）。
- 更新の作業中は確認しない（作業の終わりを待つ）。

### 5.3 窓口と JSON の形（**U1 と U3 の約束**）

すべて `/__manabi/update/` の下（パスは `?` より前で完全一致で振り分ける）。応答は `Content-Type: application/json; charset=utf-8`、`Cache-Control: no-store`、`Cross-Origin-Resource-Policy: same-origin`、`X-Content-Type-Options: nosniff`。CORS の見出し（`Access-Control-*`）は**返さない**。

| メソッド | パス | 本文 | 成功 | おもな失敗 |
|---|---|---|---|---|
| GET | `/__manabi/update/status` | なし | 200 状態（下） | 403 |
| POST | `/__manabi/update/check` | `{}` | 202 `{"ok":true,"status":<状態>}` | 409 `busy` |
| POST | `/__manabi/update/apply` | `{"version":"2.2.0"}` | 202 `{"ok":true,"status":<状態>}` | 409 `busy`・`not-newer`・`blocked`、400 `bad-request` |
| POST | `/__manabi/update/cancel` | `{}` | 202 `{"ok":true,"status":<状態>}` | 409 `not-cancellable` |
| POST | `/__manabi/update/settings` | `{"autoCheck":false}` | 200 `{"ok":true,"status":<状態>}` | 400 `bad-request` |
| どれでも | `/__manabi/update/<ほか>` | — | — | 404 `not-found` |
| ほかのメソッド（PUT・OPTIONS など） | `/__manabi/update/…` | — | — | 405 `method-not-allowed` |

失敗の本文はいつも `{"ok":false,"error":{"code":"<コード>","detail":"<技術的な説明。英語可>"}}`。

更新の仕組みが動かないとき（5.1 節）: `GET status` は 200 で `{"schema":1,"supported":false,"reason":"<理由>"}` だけを返す。POST は 404 `unsupported`。

**状態（`GET /__manabi/update/status` の本文）**:

```json
{
  "schema": 1,
  "supported": true,
  "reason": null,
  "token": "9f2c4e0b8a7d6c5b4a3f2e1d0c9b8a7f",
  "server": { "pid": 12345, "startedAt": "2026-11-20T01:23:45Z" },
  "current": { "version": "2.1.0" },
  "settings": { "autoCheck": true },
  "disk": { "freeBytes": 53687091200 },
  "check": {
    "state": "ok",
    "at": "2026-11-20T01:24:00Z",
    "error": null
  },
  "latest": {
    "version": "2.2.0",
    "date": "2026-11-20",
    "notes": ["小学4年の算数に「がい数」を足しました"],
    "newer": true,
    "installable": true,
    "blockedReason": null,
    "downloadBytes": 178257920,
    "needBytes": 636870912,
    "parts": [
      { "kind": "main", "bytes": 178257920, "changed": true },
      { "kind": "audio-g1-g2", "bytes": 345000000, "changed": false },
      { "kind": "audio-g3-g4", "bytes": 790000000, "changed": false },
      { "kind": "audio-g5-g6", "bytes": 1300000000, "changed": false }
    ]
  },
  "update": {
    "phase": "downloading",
    "targetVersion": "2.2.0",
    "progress": {
      "doneBytes": 81000000,
      "totalBytes": 178257920,
      "part": "main",
      "partIndex": 1,
      "partCount": 1
    },
    "error": null,
    "startedAt": "2026-11-20T01:30:00Z",
    "finishedAt": null
  },
  "lastApplied": { "version": "2.1.0", "from": "2.0.2", "at": "2026-11-01T10:00:00Z" }
}
```

| 欄 | 意味 |
|---|---|
| `token` | 起動ごとの合言葉（`secrets.token_hex(16)`。32 桁の16進）。POST の見出し `X-Manabi-Token` に付ける。serve.py を起動し直すと変わる |
| `server.pid` | いまの serve.py のプロセス番号（e2e が後片付けに使う） |
| `current.version` | `app/parts/main.json` の `version` |
| `disk.freeBytes` | `<DATA>/manabi-no-niwa` のある場所の空き（`shutil.disk_usage`） |
| `check.state` | `never`（まだ）・`checking`（確認中）・`ok`・`offline`・`error` |
| `check.at` | 最後に確認を終えた時刻（成功でも失敗でも）。まだなら `null` |
| `check.error` | `{"code","detail"}` か `null`（コードは下の表） |
| `latest` | 最後に成功した確認の結果（失敗しても前の結果を残す）。版の情報が無い・まだなら `null` |
| `latest.newer` | `latest.version > current.version` |
| `latest.installable` | `newer` で、`schema` が 1、`current.version >= minVersion` |
| `latest.blockedReason` | `null`・`"min-version"`・`"schema"` |
| `latest.downloadBytes` | 取得する zip（`changed:true`）の合計 |
| `latest.needBytes` | 必要な空きの見積もり（5.6 節の式。ハードリンクが使える前提） |
| `update.phase` | 下の表 |
| `update.progress` | `downloading`・`extracting` のときだけ。どちらも**バイト数**（展開は書いた大きさ）。ほかは `null` |
| `update.error` | `failed` のとき `{"code","detail"}`（`disk-full` は `"needBytes": <数>` も付く）。ほかは `null` |
| `lastApplied` | 更新の仕組みで最後に入れた版（`from` は入れる前の版）。まだなら `null` |

**`update.phase`（作業の段階）**:

| phase | 意味 | 次 |
|---|---|---|
| `idle` | 何もしていない | `downloading` |
| `downloading` | 変わった zip を取得・sha256 を確かめている | `extracting`・`failed`・`cancelled` |
| `extracting` | `app.next` を組み立てている（展開と写し） | `testing`・`failed`・`cancelled` |
| `testing` | 中身の確かめと、新しい serve.py の自己検査 | `switching`・`failed` |
| `switching` | `app` と `app.next` を入れ替えている | `restarting`・`failed` |
| `restarting` | serve.py を起動し直している（新しい serve.py が起動したらすぐ `done` に変わる） | `done`・`failed` |
| `done` | 入れ終わった（`targetVersion` が今の版） | — |
| `failed` | 失敗した（`error` に理由。今の版はそのまま） | `downloading`（もう一度押したとき） |
| `cancelled` | 中止した（取得した分は残る） | `downloading` |

**エラーのコード**（`check.error.code`・`update.error.code`・POST の失敗。画面の文言は 6.2 節）:

| コード | 意味 |
|---|---|
| `offline` | 名前の解決・接続・時間切れ（ネットが無い、GitHub につながらない） |
| `http` | 予想外の HTTP の応答（`detail` に `HTTP 503` など） |
| `not-found` | zip が 404（リリースの asset を上げている途中など） |
| `redirect-host` | 許可リストに無いホストへの転送 |
| `tls` | 証明書・TLS の失敗 |
| `bad-manifest` | 版の情報・部品の印が決まりに合わない |
| `version-changed` | 押したあと版の情報を取り直したら、さらに新しい版になっていた（表示を新しくして、もう一度押してもらう） |
| `not-newer` | 押した版が今の版より新しくない／確認で見つかった版と違う |
| `blocked` | `min-version`・`schema` で自動では入れられない |
| `busy` | ほかの更新・確認の作業中 |
| `disk-full` | 空きが足りない（`needBytes` 付き） |
| `size-mismatch` | 取得した zip の大きさが違う |
| `sha256-mismatch` | 取得した zip の sha256 が違う（1回だけ最初から取り直し、それでも違えばこのコード） |
| `unsafe-zip` | zip の検査（5.7 節）に通らない |
| `content-check` | 組み立てた中身の確かめに通らない |
| `self-test` | 新しい serve.py の自己検査に通らない |
| `switch-failed` | 入れ替えに失敗した（元に戻した） |
| `interrupted` | 前回の作業が途中で止まった（電源が切れたなど） |
| `not-cancellable` | 中止できない段階（`testing` 以降） |
| `forbidden`・`unsupported-media-type`・`payload-too-large`・`bad-request`・`not-found`・`method-not-allowed`・`unsupported` | 窓口の守り・使い方の誤り（5.4 節） |
| `internal` | 予想外の失敗（`detail` に例外の名前） |

### 5.4 窓口の守り（ほかのサイトから呼ばれないように）

`/__manabi/update/` のすべての要求で、上から順に確かめ、最初に合わないところで止める:

| # | 確かめること | 合わないとき |
|---|---|---|
| 1 | `Host` があり、小文字にして `127.0.0.1:<port>` か `localhost:<port>`（DNS rebinding。今の静的配信と同じ。ただし窓口では `Host` が無い要求も断る） | 403 `forbidden` |
| 2 | `Sec-Fetch-Site` が無いか、GET は `same-origin`・`none`、POST は `same-origin` | 403 `forbidden` |
| 3 | POST: `Origin` があり、`"http://" + Host`（小文字）と一致（ほかのポートの 127.0.0.1 のページ（same-site）も断る） | 403 `forbidden` |
| 4 | POST: `Content-Type` の `;` より前が `application/json`（ほかのサイトがプリフライトなしで送れる形を断る） | 415 `unsupported-media-type` |
| 5 | POST: `X-Manabi-Token` が起動ごとの合言葉と一致（`hmac.compare_digest`） | 403 `forbidden` |
| 6 | POST: `Content-Length` があり 0〜4096 | 413 `payload-too-large`（無い・数でないは 400） |
| 7 | POST: 本文が UTF-8 の JSON のオブジェクト。欄の型が合う（`apply` の `version` は `X.Y.Z`、`settings` の `autoCheck` は真偽値）。知らない欄は無視 | 400 `bad-request` |

- 合言葉は `GET status` の本文で渡す。ほかのサイトのページは同一オリジンの決まり（SOP）で本文を読めない（CORS を許可しない）。DNS rebinding は `Host` で断る。JSON の `Content-Type` と独自の見出し `X-Manabi-Token` があるので、ほかのサイトからの送信はプリフライトになり、serve.py は許可を返さないため届かない。
- 同じパソコンのほかのプログラム（curl など）は、合言葉を読めるので呼べる。それは守らない（範囲外）。呼ばれてもできるのは「公式の最新版への更新」「自動の確認のオン・オフ」「確認」「中止」だけ。
- 状態の応答は JSON（`nosniff`）なので、`<script src>` で読まれても実行されない。

### 5.5 更新の手順（`apply` を受けてから）

`POST apply` は、受け付けの確かめ（動作中でない・`latest` があって `newer` かつ `installable`・本文の `version == latest.version`）だけをして 202 を返す。作業は別スレッド（作業用スレッドは1本。鍵 `update/lock` を `fcntl.flock(LOCK_EX|LOCK_NB)` で取る。Windows では取らない）で進む:

1. **版の情報を取り直す**（5.2 節と同じ確かめ）。`version` が押した版と違えば `failed`（`version-changed`）にし、`latest` を新しくする。
2. **計画**: 部品ごとに「取得する／今の版から写す」を決める（5.6 節）。写す部品は、今の版の `roots` の下を歩いて、ファイルの数と合計の大きさが印と合うかを確かめる。合わなければ取得する側に回す（壊れた・足りない音声を自動で直す）。
3. **空きの確認**（5.6 節）。足りなければ `failed`（`disk-full`）。
4. **取得**（`downloading`）: 取得する zip を1つずつ。続きから・大きさと sha256（5.6 節）。中止できる。
5. **組み立て**（`extracting`）: `app.next` を消して作り直す。取得した zip を検査して展開（5.7 節）、写す部品をハードリンクで写す（5.6 節）。中止できる。
6. **確かめ**（`testing`）: 中身の確かめと自己検査（5.8 節）。
7. **入れ替え**（`switching`）: 5.9 節。
8. **再起動**（`restarting`）: 5.10 節。
9. **確定**（新しい serve.py）: 自分の版（`app/parts/main.json`）が `targetVersion` と同じなら `done`。`lastApplied` を記録し、`app.prev` と `update/downloads/` の中身を別スレッドで消す。

- どの段で失敗しても `failed` にして理由を残し、`app.next` を消す（今の `app` はそのまま）。確かめ済みの zip は残す（もう一度押したとき取り直さない）。
- `cancel` は `downloading`・`extracting` のときだけ受け付ける。作業を止めて `cancelled` にし、`app.next` を消す（`.part` は残す）。
- 取得の途中でネットが切れたら、5 秒・15 秒・30 秒あけて 3 回まで自動で続きから取り直す。それでもだめなら `failed`（`offline`）。

### 5.6 取得（変わった zip だけ・続きから・空き容量・sha256）

- **変わった部品の決め方**: `app/parts/<kind>.json` が無い、または `contentId` が版の情報の `parts[].contentId` と違う、または（計画の段 2 で）写すはずのファイルの数・大きさが印と合わない → 取得する。`main` はいつも取得する。版の情報に無い種類の部品（今の版にだけある）は新しい版に持っていかない。
- **続きから**: `update/downloads/<name>.part` と `<name>.part.json`（`{"sha256":…,"bytes":…}`）。`.part.json` の値が今回の部品と違えば `.part` を捨てる。続きは `Range: bytes=<今の大きさ>-` で頼み、206 と `Content-Range: bytes <始め>-…/<全体>` の始めが合えば続きを書く。200 が返ったら最初から書き直す。416 なら全部そろっているとみなして確かめに進む。
- 書き終えたら大きさが `bytes` と同じかを確かめ（違えば `size-mismatch`）、ファイル全体の sha256 を計算して比べる（続きからのときは、それまでの分も読んで計算する）。違えば捨てて1回だけ最初から取り直し、それでも違えば `sha256-mismatch`。合えば `<name>` に名前を変える（確かめ済み）。すでに `<name>` があり大きさと sha256 が合えば取得しない。
- 1 MiB ずつ読む。読み取りの時間切れは 60 秒。進み具合は 0.25 秒に 1 回まで更新する。
- 今回の部品に無い古い `<name>`・`.part` は、作業の始めに消す。
- **変わらない部品を写す**: `roots` の下のファイルを `os.link`（ハードリンク）で `app.next` に写す。ハードリンクが使えない（`OSError`）ときはコピー（`shutil.copy2`）にする。写した印 `app/parts/<kind>.json` も `app.next/parts/` に写す。写したファイルの数と大きさを印と比べ、違えば `content-check`。
- **空きの見積もり**（`needBytes`）:
  `Σ(取得する部品の 残りの取得の大きさ) + Σ(取得する部品の unpackedBytes) + (ハードリンクが使えないなら Σ(写す部品の unpackedBytes)) + 256 MiB`
  - ハードリンクが使えるかは、作業の始めに `update/` の中で小さなファイルを作ってリンクしてみて決める（状態の `latest.needBytes` は使える前提の値）。
  - 取得の前と、組み立ての前（取得の分を 0 にして）の 2 回確かめる。
  - 前の版（`app.prev`）は入れ替えのあと確定で消すので、見積もりに入れない（入れ替えは名前の付け替えで、増えない）。

### 5.7 zip の検査と展開

zip の各項目（`zipfile.ZipInfo`）について確かめ、1つでも合わなければ何も入れずに `unsafe-zip`:

| 確かめること | 防ぐもの |
|---|---|
| 名前に `\`・NUL・制御文字（0x00〜0x1f, 0x7f）・`:` が無い。長さ 400 文字まで | Windows 形式のパス・ドライブ名・おかしな名前 |
| 名前が `manabi-no-niwa/` で始まる | ほかの場所への展開 |
| 先頭の `manabi-no-niwa/` を除いた残りが空でなく、`/` で区切った各部分が `""`・`.`・`..` でない（先頭が `/` でない） | zip slip（`../`・絶対パス） |
| 種類（`external_attr >> 16` の上位）がふつうのファイルかフォルダ。シンボリックリンク・装置・FIFO は断る | リンクを使った外への書き込み |
| 暗号化の印（`flag_bits & 0x1`）が無い。圧縮の方式は 0（格納）か 8（deflate）だけ | 読めない・想定外の形式 |
| 同じ名前が2つ無い（大文字・小文字だけ違うものも断る） | 上書きでの差し替え |
| ファイルの数 = `parts[].files + 1`（印の分）、大きさの合計 <= `parts[].unpackedBytes + 64KiB` | zip 爆弾・余計なファイル |
| `manabi-no-niwa/parts/<kind>.json` があり、その `kind` と `contentId` が版の情報と一致し、`roots` の各要素が `dist/` で始まる安全な相対パス | 取り違え |

展開:
- 先頭の `manabi-no-niwa/` を除いて `app.next/` の下に書く。フォルダは自分で作る（`0o755`）。
- ファイルは `os.open(…, O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW(あれば)|O_BINARY(あれば))` で作る（すでにあれば `content-check`: 部品どうしの重なり）。書いた大きさが `file_size` を超えたら止める（`zipfile` は CRC と大きさも確かめる）。
- 権限: `deploy/zorin/` の下の `.sh`・`.py` は `0o755`、ほかは `0o644`（zip の権限の欄は使わない）。
- 書く先が `app.next` の中にあることを `os.path.commonpath` で確かめる（`app.next` の中にリンクは作らないので、これで足りる）。

### 5.8 中身の確かめと自己検査

**中身の確かめ**（古い serve.py の `install.verify_tree(app.next, manifest)`）:
- 必ずあるもの: `dist/index.html`・`dist/sw.js`・`dist/version.json`・`deploy/zorin/serve.py`・`deploy/zorin/manabi.sh`・`deploy/zorin/mnwupdate/__init__.py`・`parts/main.json`
- `parts/main.json` の `version` が版の情報の `version` と同じ。版の情報の各部品について `parts/<kind>.json` があり `contentId` が同じ。
- `dist/packs.json` があれば、各パックの `files` が全部ある（install.sh の確かめと同じ）。

**自己検査**（新しい serve.py を別のプロセスで動かす）:
- 古い serve.py が `[sys.executable, "-B", "app.next/deploy/zorin/serve.py", "--self-test"]` を 60 秒の時間切れで実行し、終了コード 0 を確かめる。環境変数は今のものを引き継ぐ（`MANABI_UPDATE_TEST_ORIGIN` を含む）。
- 新しい serve.py の `--self-test` がすること（新しい版の側で決める。版ごとの条件は新しい版が知っているため）:
  1. `mnwupdate` とその下のすべてのモジュールを読み込む（書き間違い・読み込みの失敗を見つける）
  2. 自分の置き場（`--dir` が無ければ `../../dist`）について上の「中身の確かめ」と同じこと（版の情報なしでできる分）＋ `dist/version.json` の `appVersion` があれば `parts/main.json` の `version` と同じ
  3. `127.0.0.1:0`（空いているポート）で本物の `Handler` を使って待ち受け、自分に `GET /__manabi/health`（`app == "manabi-no-niwa"`）と `GET /`（200）を送る
  4. ネットにつながない・ファイルを書かない
- これで「新しい serve.py が起動できない」（書き間違い・足りないファイル）を、入れ替えの前に見つける。

### 5.9 入れ替えと元に戻す

1. `state.json` に `switching` を書く（`fsync`）。
2. 残っている `app.prev` を消す。
3. **Linux**: `renameat2(AT_FDCWD, "app.next", AT_FDCWD, "app", RENAME_EXCHANGE)`（`ctypes` で libc を呼ぶ）で、`app` と `app.next` を**一度に**入れ替える（`app` が無い瞬間が無い）。そのあと `app.next`（中身は前の版）を `app.prev` に名前を変える。
4. `renameat2` が無い・使えない（`AttributeError`・`EINVAL`・`ENOSYS`。Windows を含む）ときは、`os.rename("app", "app.prev")` → `os.rename("app.next", "app")`。2 つ目が失敗したら `os.rename("app.prev", "app")` で戻す。Windows ではファイルを開いているプログラム（ウイルス対策など）で名前の変更が一時的に失敗するので、0.5 秒あけて 10 回まで試す。
5. 失敗したら元に戻して `failed`（`switch-failed`）。

- 名前の付け替えは同じファイルシステムの中なので、ファイルの量によらず一瞬で終わる。
- 入れ替えの直後から、古い serve.py のプロセスもパス `…/app/dist` を通して新しいファイルを配る（ファイルの開き方がパスごとのため）。ブラウザの画面は Service Worker のキャッシュで動いているので、子供が遊んでいても見た目は変わらない。

### 5.10 serve.py 自身の再起動

1. 作業用スレッド: `state.json` に `restarting`（`targetVersion`・`from`）を書く（`fsync`）→ 再起動の合図（`threading.Event`）を立てる → `server.shutdown()` を呼ぶ（待ち受けの繰り返しが終わるのを待つ。作業用スレッドからなので固まらない）。
2. 主スレッド: `serve_forever()` から戻ったら `server_close()`（待ち受けのソケットを閉じる）→ 標準出力・標準エラーを flush → 起動し直す:
   - **Linux**: `os.execv(sys.executable, [sys.executable, "<app>/deploy/zorin/serve.py", *sys.argv[1:]])`。プロセスの番号（PID）が変わらないので、**systemd の自動起動（`Type=simple`）でもそのまま**動く。manabi.sh が `nohup setsid` で起動したものも同じ。ソケット・鍵のファイルは exec で閉じる（Python の既定で引き継がない）。
   - **Windows**（試験だけ）: `os.execv` は引数の扱いが不確かなので、`subprocess.Popen([...])` で新しいプロセスを起動して自分は終了コード 0 で終わる（PID は変わる。e2e は状態の `server.pid` で後片付けする）。
   - `<app>` は起動したときに求めた置き場の `app`（入れ替えのあとは新しい版の serve.py を指す）。
3. exec が失敗した（ふつう起きない）ときは終了コード 1 で終わる（systemd なら `Restart=on-failure` で新しい版が起動する。manabi.sh なら次にアイコンを開いたときに起動する）。
4. 新しい serve.py は、ポートを取れなかったら今までどおり終了コード 3 で終わる（ほぼ同時に manabi.sh が起動した別の serve.py が先に取った場合。そちらも新しい版なので問題ない）。

### 5.11 状態ファイルと、途中で止まったときの片付け

`update/state.json`（一時ファイルに書いて `os.replace`。大事な段では `fsync`）:

```json
{
  "schema": 1,
  "phase": "restarting",
  "targetVersion": "2.2.0",
  "fromVersion": "2.1.0",
  "startedAt": "2026-11-20T01:30:00Z",
  "finishedAt": null,
  "error": null,
  "resumeCount": 0,
  "lastApplied": null,
  "check": { "state": "ok", "at": "2026-11-20T01:24:00Z", "error": null },
  "latest": { "...": "状態の latest と同じ形（manifest の minVersion も持つ）" }
}
```

serve.py が起動したときの片付け（`service.start()` の中。重い削除は別スレッド）:

| 前回の phase | 何が起きたか | すること |
|---|---|---|
| `restarting` | 再起動した（ふつうの流れ） | 自分の版 == `targetVersion` なら `done`・`lastApplied` を記録・`app.prev` と `downloads/` の中身を消す。違えば `failed`（`switch-failed`） |
| `switching` | 入れ替えの途中で止まった | いま動いている `app` の版 == `targetVersion` なら `done` と同じ扱い。違えば `failed`（`interrupted`）。`app.next`・`app.prev` を消す |
| `downloading`・`extracting`・`testing` | 途中で止まった（電源・強制終了） | `failed`（`interrupted`）。`app.next` を消す。`.part` と確かめ済みの zip は残す。**自動の確認がオンなら**、最初の確認が成功して `latest.version == targetVersion` のとき、自動で続きから始める（同じ版で `resumeCount` 3 回まで） |
| `idle`・`done`・`failed`・`cancelled` | — | そのまま。残っている `app.next`・`app.prev` があれば消す |

- フォールバックの入れ替え（5.9 節の 4）の 2 つの名前の変更のあいだで電源が切れると `app` が無くなり、serve.py も manabi.sh も起動できない（Linux では `renameat2` を使うので起きない）。そのときは README の手順で手で入れ直す（13 章）。

### 5.12 設定（自動の確認のオン・オフ）

- `<CONFIG>/manabi-no-niwa/updater.json`: `{"schema":1,"autoCheck":true}`。無い・読めないときはオン。書くときは一時ファイル＋`os.replace`。
- `POST settings {"autoCheck":false}` で書き換え、予定を止める。`true` にしたら 5 秒後に確認する。
- オフでも「今すぐ確かめる」「更新する」は使える（保護者が押したときだけつながる）。

### 5.13 記録（ログ）

- 標準エラーに `[更新] <ISO 時刻> <短い文>` の形で、確認の結果が変わったとき・作業の各段の始めと終わり・失敗のときだけ出す（manabi.sh が `serve.log` に書く）。要求ごとの記録は今までどおり出さない。合言葉は出さない。

---

## 6. アプリ側（ブラウザ）

### 6.1 窓口があるかの判定

- `src/core/offline/updater.ts`（新規）の `fetchUpdaterStatus()` が `GET ./__manabi/update/status`（`cache: 'no-store'`）を読む。次のどれかなら「窓口なし」（`null`）:
  - 通信の失敗、200 以外、`Content-Type` が `application/json` でない（vite preview の SPA の代わりの index.html、ほかの静的サーバーの 404、2.0.x の serve.py の 404）
  - 本文が JSON でない・`schema !== 1`・`supported !== true`・欄の形が合わない
- 「窓口なし」のときは今までどおりの表示（「このアプリについて」の「オフラインの準備」の節と、Service Worker の「更新する」）。更新の節も保護者画面の知らせも出さない。
- 本番のビルドだけで動かす（`startOffline()` から呼ぶ。開発サーバーでは呼ばない）。

### 6.2 保護者画面「このアプリについて」の表示（`src/parent/UpdateSection.tsx`）

窓口があるときだけ、「このアプリについて」の最初の節の次に節「**アプリの更新**」を出す（`data-testid="update-section"`）。文言（漢字かな交じり・保護者向け）:

| 状態 | 表示 |
|---|---|
| いつも | 「いまの版: 2.1.0」（`update-current`） |
| `check.state` | `never`「まだ確かめていません」／`checking`「新しい版があるか確かめています…」／`ok`「11/20 10:24 に確かめました」＋（`latest` が無い・`newer:false`）「新しい版はありません」／`offline`「インターネットにつながっていないため、確かめられませんでした（つながっているときに、また確かめます）」／`error`「確かめられませんでした（理由）」（`update-check-status`） |
| `latest.newer && installable`、作業なし | 囲み（`p-alert`。`update-available`）:「新しい版 2.2.0 があります（公開日 2026-11-20）」、変わった点の箇条書き（`update-notes`）、「ダウンロードする大きさ: 約 170.0 MB（変わった部分だけ）」（`update-size`）、［**更新する**］（`p-primary`。`update-apply`）、注意「押すと、ダウンロード・確認・切り替え・教材の取り直しまで自動で行います。終わるとアプリを1回読み込み直します（そのあと保護者画面を開き直すと結果が見られます）。学習の記録は消えません。お子さんが遊んでいないときに押してください。」 |
| 空き不足の見込み（`disk.freeBytes < latest.needBytes`） | 「空き容量が足りないかもしれません（あと約 X GB 必要です）」（`update-disk-warning`）。ボタンは押せる（serve.py がもう一度確かめる） |
| `latest.newer && !installable` | 「新しい版 2.2.0 があります。この版からは自動で更新できません。README の「新しい版に更新するとき」の手順で入れ直してください。」（`update-blocked`） |
| 作業中（6.3 節の流れ） | 段階の文＋棒（`<progress>`。`update-progress`）＋割合（`update-progress-text`）。`downloading`「ダウンロードしています 45%（81.0 MB / 170.0 MB）」、`extracting`「展開しています 30%」、`testing`「新しい版を確かめています」、`switching`「切り替えています」、`restarting`・配信を待つ「配信を起動し直しています」、アプリの準備「アプリの新しい版を準備しています 60%」、読み込み直し「読み込み直します」、教材「教材を取り直しています（3 / 5）」。`downloading`・`extracting` のときだけ［中止する］（`update-cancel`）。「この画面を離れても続きます」 |
| 失敗（`failed` か、アプリ側の失敗） | 「更新できませんでした: <理由の文>」（`p-error`。`update-error`）＋「いまの版はそのまま使えます」＋［もう一度ためす］（`update-retry`。`requestApply(latest.version)`）。理由の文は下の表 |
| `lastApplied.version === current.version` かつ作業なし | 「2.2.0 に更新しました（11/20 10:30）」（`update-done`） |
| いつも（下のほう） | チェックボックス「起動したときに、新しい版があるかを自動で確かめる（インターネットにつながっているときだけ）」（`update-autocheck`）、［今すぐ確かめる］（`update-check-now`。確認中・作業中は押せない）、小さな注意「更新を確かめるときと取得するときだけ、GitHub（github.com）に接続します。送るのはアプリの名前だけで、記録や個人の情報は送りません。」 |

理由の文（コード → 文。`detail` は小さな字で後ろに出す）:

| コード | 文 |
|---|---|
| `offline` | インターネットにつながっていないか、GitHub に接続できませんでした。つながってから「もう一度ためす」を押してください（取得した分は残っていて、続きから始めます）。 |
| `http`・`not-found` | 配布元（GitHub）から取得できませんでした。新しい版の準備中かもしれません。しばらくしてからお試しください。 |
| `redirect-host`・`tls` | 配布元への接続を安全に確かめられなかったため、中止しました。ネットワークの設定（プロキシなど）をご確認ください。 |
| `bad-manifest`・`size-mismatch`・`sha256-mismatch`・`unsafe-zip`・`content-check` | 取得した内容が正しくなかったため、入れずに中止しました。もう一度お試しください。 |
| `disk-full` | 空き容量が足りません（あと約 X GB 必要です）。不要なファイルを消してから、もう一度お試しください。 |
| `self-test`・`switch-failed` | 新しい版を動かす準備で問題が見つかったため、元の版のままにしました。 |
| `interrupted` | 前回の更新が途中で止まりました。もう一度押すと続きから始めます。 |
| `version-changed` | さらに新しい版が出ていました。表示を新しくしたので、もう一度「更新する」を押してください。 |
| `busy` | ほかの更新が進んでいます。終わるまでお待ちください。 |
| `blocked` | この版からは自動で更新できません。README の手順で入れ直してください。 |
| `server-timeout`（アプリ側） | 配信が起動し直しませんでした。アプリの窓を閉じて、デスクトップのアイコンから開き直してください。 |
| `sw-failed`（アプリ側） | アプリの新しい版の準備に失敗しました。アプリを開き直すと、もう一度準備します。 |
| `sw-mismatch`（アプリ側） | 読み込み直しても新しい版に切り替わりませんでした。アプリの窓を全部閉じて、開き直してください。 |
| そのほか | 更新できませんでした。 |

ほかの変更:
- 「このアプリについて」の最初の節の「広告・外部への通信・アカウント登録はありません」は、窓口があるときは「広告・アカウント登録はありません。記録はこの端末のブラウザの中だけに保存されます。外部への通信は、アプリの更新を確かめるときと取得するときだけです（下の「アプリの更新」で自動の確認を止められます）。」にする。窓口が無いときは今の文のまま（そのときアプリは外へ通信しない）。
- 保護者画面の上（`src/parent/index.tsx` のタブの上）に小さな知らせ（`parent-update-notice`）: `latest.newer && installable` で作業が無ければ「新しい版 2.2.0 があります」＋［くわしく］（`parent-update-notice-open`。「このアプリについて」へ）、作業中なら「アプリを更新しています…」。子供の画面には出さない。
- 「オフラインの準備」の節の Service Worker の「更新する」（`apply-update`）は、窓口があって 6.3 節の流れが動いているときは隠す（ボタンが2つにならないように）。それ以外は今までどおり。

### 6.3 押したあとの自動の流れ（`src/core/offline/updater.ts` の制御）

`requestApply(version)`:
1. `POST apply` → 流れ `server`。
2. 1 秒ごとに状態を読む。`downloading`〜`switching` は段階と進み具合を出す。`restarting` か、読めない（配信が起動し直している）あいだは `waiting-server`。120 秒読めなければ失敗（`server-timeout`）。
3. `status.current.version === version`（配信が新しい版になった）→ 流れ `sw`: `checkForUpdateNow()`（`src/core/offline/index.ts` に足す。`registration.update()` を間隔の制限なしで呼ぶ）→ 新しい Service Worker の準備の進み具合（`OfflineState.progress`）を出す → `OfflineState.updateReady` になったら → 読み込み直してよいとき（6.5 節）に流れ `reloading` → `applyUpdate()`（今の関数。`SKIP_WAITING` → 読み込み直し）。準備に失敗（`OfflineState.error`）したら `sw-failed`。10 分で準備が終わらなければ `sw-failed`。
4. `failed` → 流れ `failed`（コードは `update.error.code`）。`cancelled` → 流れ `none`。
5. POST が 403（合言葉が古い。配信が起動し直した）なら、状態を読み直して1回だけ送り直す。

流れは画面の部品ではなくモジュールが持つ（保護者が別のタブへ移っても続く）。状態を読む間隔は、作業中 1 秒、作業が無くて保護者画面を開いているあいだ 30 秒、それ以外は読まない（起動のときに1回だけ読む）。

### 6.4 起動したときの続き（`startUpdater()`。`startOffline()` から、本番のみ）

起動のたびに状態を1回読み、次を行う（どれも窓口があるときだけ）:
- **配信の版がアプリの版より新しい**（`current.version > APP_VERSION`。`APP_VERSION` は `import.meta.env.VITE_APP_VERSION`。どちらかが `X.Y.Z` でなければ何もしない）→ 6.3 節の 3 と同じ `sw` の流れを自動で始める。配信を更新したあとブラウザを閉じた、子供の画面にいるあいだに更新が終わった、手で入れ直した、などのとき。読み込み直しは 6.5 節の条件のときだけ。
  - 繰り返しの防止: 読み込み直す前に `sessionStorage['mnw:update:reloaded'] = <配信の版>` を書く。読み込み直したあとも版が合わず、この値が同じなら、もう自動で読み込み直さず `sw-mismatch` を出す。
- **配信の版 == アプリの版** → **取得済みの教材パックの取り直し**: オフラインの準備（コア）がそろい、`reconcilePacks()` が終わったあと、`packs.json` の全パックのうち `outdated` のものを `downloadPackList()` で取り直す（流れ `packs`。進み具合は `getPackProgress`）。1回の起動で1回だけ。失敗しても繰り返さない（「きょうざい」タブの「まとめて取得し直す」で取り直せる）。取り直しは 127.0.0.1 の配信から行う（インターネットは使わない）。記録・未取得のパックには触らない。
  - これは更新の仕組みで入れたときだけでなく、窓口のある配信（2.1.0 以降の serve.py）で動いているときはいつも行う（版が古いパックは開けないので、取り直すのが正しい。インターネットを使わず、取得済みのものだけを取り直す）。起動画面が既定パックを取り直す今の動き（setup.ts）と同時に走っても、packs.ts が同じパックの取得を1つにまとめる。
- **配信が作業中**（`downloading`〜`restarting`）→ 6.3 節の 2 から続ける（読み込み直したら作業中だった場合）。

### 6.5 子供の画面に出さない／読み込み直してよいとき

- 更新の表示は保護者画面（「このアプリについて」と上の知らせ）だけ。子供の画面・起動画面には出さない（起動画面の教材の準備の表示（DESINGN.md 24 章）は今までどおり）。
- 自動で読み込み直してよいのは、画面が起動画面か保護者画面のときだけ: `location.hash` が `''`・`'#'`・`'#/'`・`'#/start'`、または `'#/parent'` で始まるとき。それ以外（子供が遊んでいる）なら、`hashchange` を待って、条件に合ったときに読み込み直す。
- 読み込み直したあとは、今までどおり起動画面から始まる（保護者ゲートは閉じる。ゲートを通らずに保護者画面へ戻す仕組みは作らない）。教材の取り直しは起動画面の裏で自動で続く。

### 6.6 Service Worker の変更（`src/sw/sw.ts`）

- `fetch` で、scope からの相対パスが `__manabi/` で始まる要求は `respondWith` しない（キャッシュを通さず配信へ）。今も結果的に配信へ行くが、窓口の応答をキャッシュから返す余地を無くす。POST は今までどおり触らない。

---

## 7. 導入・起動・削除のスクリプト（`deploy/zorin/`）

### 7.1 install.sh

- 必要なファイルの確かめに `deploy/zorin/mnwupdate/__init__.py` を足す。`parts/main.json` が無い（リポジトリから直接入れたなど）ときは止めずに「この入れ方では、保護者画面からの更新は使えません（配布 zip から入れたときだけ使えます）」と出す。
- 実行の前の表示に足す: 「動いている配信を止めて、新しい版で始め直す」「前の版の控え・更新の作業用のフォルダ（`app.prev`・`app.next`・`update`）を片付ける」「保護者画面『このアプリについて』で、更新の自動の確認をオフにできる」。
- 手順:
  0. 動いている配信を止める: `systemctl` があり、systemd の単位が動いていれば（`systemctl --user is-active --quiet manabi-no-niwa.service`）`systemctl --user stop`（あとで start する印を付ける）。そのうえで `pkill` があれば `pkill -u "$(id -u)" -f "$APP_DIR/deploy/zorin/serve.py"`（手で起動したもの。更新の作業中ならそれも止まる）。どちらも無ければ何もしない（Git Bash など）。
  1. `$BASE/app.next` を消して作り、配布物から写す: `dist/`、`deploy/zorin/`（フォルダごと。`__pycache__` は消す）、`parts/`（あれば）、`licenses/`・`README.md`・`LICENSE`・`DESINGN.md`・`docs/device-checklist.md`（あれば）。`deploy/zorin/` の `.sh`・`serve.py` に実行権限。
  2. 入れ替え: `rm -rf "$BASE/app.prev"`、`[ -d "$APP_DIR" ] && mv "$APP_DIR" "$BASE/app.prev"`、`mv "$BASE/app.next" "$APP_DIR"`、`rm -rf "$BASE/app.prev" "$BASE/update"`。
  3. `.desktop`・デスクトップのアイコン（今までどおり）。
  4. 自動起動（今までどおり）。0 で止めた単位があれば `systemctl --user start manabi-no-niwa.service`。
- 「配置先の中から実行していないか」の確かめを `app.prev`・`app.next` にも広げる。
- 2.0.x の配置（`app/dist`・`app/deploy/zorin` だけ）もこの手順で丸ごと入れ替わる。

### 7.2 uninstall.sh

- 消すものに足す（表示にも出す）: `$BASE/app.prev`・`$BASE/app.next`・`$BASE/update`、`$CONFIG_HOME/manabi-no-niwa/`（`updater.json`。更新の設定）。パスが `*/manabi-no-niwa/…` の形であることを確かめてから消す（今の本体の削除と同じ考え）。
- `$BASE` が空なら `rmdir`（今までどおり）。

### 7.3 manabi.sh・manabi-no-niwa.service・.desktop

- **変えない**。更新のあとも `app/deploy/zorin/manabi.sh`・`app/deploy/zorin/serve.py`・`app/dist/icons/icon-192.png` は同じパスにある。serve.py の再起動のあいだ（1 秒ほど）に manabi.sh が動いた場合は、今の「ほぼ同時に別の起動が先に動いた場合は、それを使う」の処理で足りる。systemd の単位は exec でも同じ PID なので変えない。
- （U4 の担当が、説明の注釈を足すのはよい。動きは変えない。）

---

## 8. 2.0.x から 2.1.0 へ（この1回だけ手で）

1. README の手順で 2.1.0 の zip 4つを取得し、端末で1行を貼る（今までどおり）。2.1.0 の install.sh が置き場を新しい形にし（`parts/` を含む）、動いている配信を止める。
2. アプリを開くと、ブラウザの中の 2.0.x のアプリが新しい版を準備し、「このアプリについて」に「あたらしい ばーじょんが あります」が出る → 「更新する」を押す（**この1回だけ**。2.0.x のアプリには更新の仕組みが無いため）。
   - 押さなくても、窓を全部閉じて開き直せば切り替わる（今までどおり）。
3. 2.1.0 のアプリは窓口がある配信で動くので、取得済みの教材パックで版が古いもの（2.0.x → 2.1.0 ではファイル構成が変わるため全部）を自動で取り直す（6.4 節）。「まとめて取得し直す」を押さなくてよい。
4. 2.1.0 から先は、保護者画面「このアプリについて」で「更新する」を1回押すだけ。

---

## 9. 脅威と守り

| 脅威 | 守り | 残るもの |
|---|---|---|
| 悪意のあるページが窓口を呼ぶ（CSRF） | `Origin`・`Sec-Fetch-Site`・JSON の `Content-Type`（プリフライト）・起動ごとの合言葉・CORS を許可しない | — |
| DNS rebinding（悪意のある名前を 127.0.0.1 に向ける） | `Host` の確かめ（窓口では `Host` が無い要求も断る） | — |
| 同じパソコンのほかのプログラム | 守らない（範囲外） | 公式の最新版への更新・設定の切り替えはできる |
| 通信の途中での改ざん・偽のサーバー | HTTPS（確認を切らない）、転送先の許可リスト、URL の固定 | — |
| 版の情報に悪い値を入れる（パス・URL） | タグ・名前・種類を正規表現で確かめる。URL を受け取らない。`notes` は文字として表示 | — |
| 途中で切れた・壊れた取得 | 大きさと sha256、続きからの取得 | — |
| 悪い zip（zip slip・リンク・zip 爆弾・重なり） | 5.7 節の検査、別の置き場での組み立て、`O_EXCL` | — |
| 新しい版が動かない | 中身の確かめ・新しい serve.py の自己検査・入れ替えの失敗で元に戻す | 自己検査に通ったが、実際に動かすと固まる版（まれ）。次の版で直す |
| 空き容量の不足 | 取得の前と組み立ての前に見積もりで確かめる | — |
| 停電・強制終了 | 状態ファイル・起動時の片付け・`renameat2` で一度に入れ替え・続きから | Linux 以外の入れ替え（2 回の名前の変更）のあいだの停電 |
| GitHub のアカウント・リポジトリの乗っ取り | 2段階認証・immutable releases（運用） | 署名が無いので、偽の版を配られうる（3.5 節） |
| ベータ版を配ってしまう | `latest` は先行版を指さない。`X.Y.Z` だけを受け付ける | — |
| 古い更新の仕組みで入れられない新しい版 | `minVersion`・`schema` で止めて、手での入れ直しを案内 | — |

---

## 10. 文書の変更（後の段で行う。中身はここで決める）

### 10.1 要件（docs/requirements.md 6.10 導入（IN）に足す・直す）

| ID | 要件 |
|---|---|
| IN-06 | 更新の確認（自動）: 配信（serve.py）は起動して 15 秒後と、その後 12 時間ごと（失敗したら 30 分ごと）に、GitHub の最新のリリースの版の情報（manabi-no-niwa-update.json）を確かめる。ネットが無ければ静かにやめる。保護者画面でオフにできる（オフのときは保護者が押したときだけつながる） |
| IN-07 | 更新の実行: 保護者が保護者画面「このアプリについて」で「更新する」を1回押すと、取得・確かめ・切り替え・アプリの新しい版の準備と切り替え・取得済みの教材パックの取り直しまで自動で進む。もう一度押させない。学習の記録は消えない |
| IN-08 | 通信先の限定: 外への通信は更新の確認と取得のときだけ。github.com のこのリポジトリと配布用ホスト（objects.githubusercontent.com・release-assets.githubusercontent.com）だけ。TLS の確認を切らない。送るのはアプリの名前（User-Agent）だけ。ブラウザ側からは外へ通信しない（CSP の connect-src 'self'） |
| IN-09 | 入れる前の確かめ: 大きさと sha256、zip の中のパスの検査（zip slip・リンク・大きさ）、中身の確かめ、新しい serve.py の自己検査に通ったものだけを入れる。通らなければ今の版のまま |
| IN-10 | 安全な切り替え: 別の置き場で組み立て、前の版を控えに残して一度に入れ替え、失敗したら戻す。待ち受け（127.0.0.1:8765）・オリジン・学習の記録を変えない。sudo・システム設定・サービス登録・アイコンに触らない |
| IN-11 | 窓口の守り: 更新の窓口（/__manabi/update/…）は Host・Origin・Sec-Fetch-Site・JSON の Content-Type・起動ごとの合言葉を確かめ、ほかのサイトから呼べない |
| IN-12 | 取得の手間を減らす: 変わった部品の zip だけを取得する。途中で切れたら続きから。始める前に空き容量を確かめる |
| IN-13 | 配り方が serve.py でないとき（開発サーバー・ほかの静的サーバー・2.0.x の serve.py）は、更新の表示を出さず今までどおり |

直す:
- BC-03 の受入条件「外部ドメインへの通信がない」→「アプリ（ブラウザ）から外部ドメインへの通信がない（E2E で監視）。配信（serve.py）の外への通信は IN-08 の範囲だけ」。
- BC-05 の「更新時」の説明に、保護者画面からの更新と自動の確認を足す。
- NF-11「外部送信なし」→「学習の記録・個人の情報を外部へ送らない。外への通信は更新の確認と取得だけ（IN-08）」。
- PA-12 に「新しい版の有無・大きさ・変わった点・更新の進み具合・失敗のときの案内・自動の確認のオン・オフ（IN-06〜07）」を足す。
- 9 章の「後続の拡張」の「自動更新配信」を消し、「署名つきの更新（3.5 節）」を足す。
- docs/expansion/requirements.md の X-OF-07 に「更新の仕組みも同じ（IN-10）」を足す。

### 10.2 README.md

- 冒頭の「広告・外部への通信・アカウント登録はありません」→「広告・アカウント登録はありません。記録はこの端末のブラウザの中にだけ保存します。インターネットへの接続は、新しい版があるかを確かめるときと、取得するときだけです（GitHub に接続します。保護者画面で自動の確認を止められます）。」
- 「用意するもの」のインターネットの行に「新しい版の確認と更新のときにも使います（つながっていなければ使いません）」を足す。
- 「新しい版に更新するとき」を書き直す:
  - **2.1.0 から先**: 保護者画面「このアプリについて」に「新しい版 ○○ があります」と出たら「更新する」を1回押す。あとは自動（ダウンロード・確認・切り替え・教材の取り直し）。終わるとアプリが1回読み込み直される。お子さんが遊んでいないときに押す。学習の記録は消えない。
  - **2.0.x から 2.1.0 へ（この1回だけ）**: 今の手順（zip を4つ取得して1行を貼る）＋「アプリを開いて『更新する』を押す（この1回だけ）」。教材は自動で取り直す。
  - 自動で更新できない版（`minVersion` で止まった）のときは、2.0.x と同じ手順で入れ直す。
- 「通信が必要な場面」の表: 「日常の利用」を「不要。アプリは外部へ通信しません。配信が起動したとき・12時間ごとに、新しい版があるかを GitHub に確かめます（つながっていなければ何もしません。保護者画面で止められます）」に。「更新時」を「必要。保護者画面の『更新する』で GitHub から取得します（変わった部分だけ）」に。
- 「入れたアプリを消すとき」: 更新の設定（`~/.config/manabi-no-niwa/`）と作業用のフォルダも消えることを足す。
- 「困ったとき」に足す: 「更新できませんでした」と出る（保護者画面の理由に従う。空き容量・ネット）、更新のあと開けない（README の手順で入れ直す。記録は消えない）。
- 技術的な説明に「更新の仕組み」の節（置き場・確かめ・入れ替え・通信先・自動の確認の止め方・`MANABI_UPDATE_TEST_ORIGIN` は試験用で 127.0.0.1 にしか向けられない）。

### 10.3 そのほかの文書

- docs/architecture.md 8 章（ローカル配信と導入）に更新の仕組みの表（ファイル・置き場・窓口）を足し、「更新: 新しい zip を展開して install.sh を再実行」を「保護者画面から（IN-07）。手でも同じ手順で入れ直せる」に。11 章（セキュリティ）に 5.4 節と 9 章の要約。
- DESINGN.md 21 章（保護者画面（拡張））に足す: 「アプリの更新」の節（「このアプリについて」の2番目）。進み具合は `<progress>` の棒と割合と段階の文（数字だけにしない）。失敗は `p-error` で理由と次にすることと「いまの版はそのまま使えます」。自動のポップアップや、子供の画面への表示はしない。保護者画面の上の知らせは1行（`p-alert` の小さい形）。
- docs/test-plan.md に 11 章の試験を足す。docs/expansion/handover.md に 13 章の確かめられないことを足す。
- docs/expansion/release-2.1.0.md に `## 保護者画面に出す短い説明` を書く（リリースのとき）。

---

## 11. 試験

### 11.1 Python の unittest（U1・U4。`npm run test:py` = `py -3 -B -m unittest discover -s deploy/tests -v`、Linux は `npm run test:py:sh` = `python3 -B -m unittest discover -s deploy/tests -v`）

`deploy/tests/`（配布 zip に入らない場所。`__init__.py` は置かない。U4 の試験は U1 の helpers.py を読み込まない）。作業ツリーに `.venv` が無いときは `<本体の作業ツリー>\.venv\Scripts\python.exe -B -m unittest discover -s deploy/tests -v` でもよい。テストはすべて一時フォルダの中だけで行い、`HOME`・`XDG_*` を一時フォルダに向ける。ネットにつながない（偽の GitHub は `http.server` で 127.0.0.1 の空いたポート）。

| ファイル | 中身 |
|---|---|
| test_manifest.py | 版の情報の正しい例・欄ごとの誤り（版の形・タグ・名前と種類の不一致・`main` が無い／2つ・大きさの範囲・sha256 の形・`notes` の長さと制御文字・64KiB 超え）・`schema: 2` は `blockedReason: "schema"`・版の比較（`2.10.0 > 2.9.9`）・`minVersion`・計画（contentId の一致で写す、印が無い・数が合わないと取得） |
| test_fetch.py | 試験用の origin の形（`http://127.0.0.1:4801` だけ可。`localhost`・`127.0.0.2`・`https://127.0.0.1:1`・`:0`・`:70000`・パス付き・`user@`・IPv6 は不可）。本番の許可リストでの転送先の確かめ（`github.com`・2つの配布用ホストは可。`evil.example`・`github.com.evil.example`・`http://github.com`・`https://github.com:8443`・`https://u@github.com` は不可）。偽の GitHub での取得: 302 を2回たどる・許可されていない転送先で止まる・404 で「版の情報なし」・続きから（`Range` の 206）・`Range` に 200 で答える相手（最初から）・416・大きさ違い・sha256 違い（1回取り直して `sha256-mismatch`）・中止・接続が切れたら続きから取り直す |
| test_install.py | 攻撃の見本の zip（`../x`・`/etc/x`・`manabi-no-niwa/../x`・`manabi-no-niwa/a/../../x`・`\`・`C:`・シンボリックリンクの項目・FIFO の項目・同じ名前・大文字小文字だけ違う名前・暗号化の印・圧縮の方式 12・ファイルの数が多い・大きさが申告より大きい・印が無い・印の contentId 違い・先頭が `manabi-no-niwa/` でない）を全部断ること。展開の権限。部品の重なり。変わらない部品のハードリンクでの写し（とコピーへの切り替え）。中身の確かめ。空きの見積もり（`shutil.disk_usage` を差し替え）。入れ替えと、2つ目の名前の変更が失敗したときに元に戻ること。`renameat2` は Linux のときだけ（Windows では skip） |
| test_service.py | 状態の形（5.3 節の全欄）。設定の保存と読み込み（無い・壊れているときはオン）。予定（時計を差し替え: 15 秒・12 時間・30 分・オフのときは確認しない）。起動時の片付けの表（5.11 節）。`apply` の受け付け（`busy`・`not-newer`・`blocked`）、`version-changed`、中止。作業の各段を差し替えて、成功で再起動の合図が立つこと |
| test_api.py | 窓口の守り: `Host` 違い・無し → 403、`Sec-Fetch-Site: cross-site`・`same-site` → 403、POST の `Origin` 無し・別のポート・`localhost` と `127.0.0.1` の食い違い → 403、`Content-Type: text/plain`・`application/x-www-form-urlencoded` → 415、合言葉無し・違う → 403、本文 4097 バイト → 413、JSON でない → 400、OPTIONS → 405、知らないパス → 404。応答の見出し（`no-store`・CORS の見出しが無い）。窓口が無い置き場では `supported:false` |
| test_serve.py | `--self-test` が正しい置き場で 0、足りない置き場で 1。`mnwupdate` が読み込めなくても配信は続く（`supported:false`・`updater-error`）。置き場でない場所の serve.py では `not-installed` |
| test_integration.py | 偽の GitHub（`http.server`。302 の転送・`Range` を返す）と、一時フォルダに作った置き場の**本物の serve.py**（別のプロセス。空いたポート）で、窓口だけを使って 2.1.0 → 2.2.0 を通す: 確認 → `apply` → `restarting` → 新しい serve.py（Windows では別の PID）が `done` → `current.version` が 2.2.0、`app.prev` と `downloads` が消えている、変わらない音声の部品は取得していない（偽の GitHub の記録）、書いたのが決められた場所だけ（一時の HOME の中を全部見て確かめる） |
| test_install_sh.py（U4） | Git Bash があるときだけ（無ければ skip）。一時の HOME で `bash install.sh --yes` → 置き場の形（4 章）、`parts/`・`mnwupdate/` がある、`app.prev`・`app.next`・`update` が無い。もう一度実行（版を変えた配布物）→ 入れ替わる・残り物が無い。`uninstall.sh --yes` → `app`・`app.prev`・`update`・`~/.config/manabi-no-niwa` が消える。`python3` は試験が作る小さなシェルスクリプト（今の Python を呼ぶ）で用意する |

### 11.2 vitest（U2・U3）

| ファイル | 中身 |
|---|---|
| scripts/release-lib.test.ts（U2） | contentId（並べ方・タブ区切り・印を除く）。部品の印の形。版の情報の形（3.1 節の全欄、名前の決まり、`minVersion <= version`）。音声の部品への分け方（今の `audioGroupOf` と同じ結果）。`notes` の読み取り（見出しが無い・6行以上・空行）。zip の書き出し（`zipfile` 互換は U1 の試験と e2e で見る。ここでは中央ディレクトリの数・名前の順・`__pycache__`・`.pyc` を入れないこと） |
| scripts/vite-plugin-precache.test.ts（U2） | `version.json` に `appVersion` が入る |
| src/core/offline/updater.test.ts（U3） | 状態の読み取り（JSON でない・HTML・404・`supported:false`・欄の形の誤りは `null`）。POST の見出し（`Content-Type: application/json`・`X-Manabi-Token`）と 403 での1回の送り直し。流れ（偽の時計: `downloading` → 読めない → `done`（版が変わった）→ `checkForUpdateNow` → `updateReady` → `applyUpdate` が1回だけ）。読み込み直しの条件（`#/home` では待ち、`#/parent/about` に変わったら読み込み直す）。繰り返しの防止（`sessionStorage`）。起動時の教材の取り直し（`outdated` だけを `downloadPackList` に渡す・配信の版が違うときはしない・窓口が無いときはしない） |
| src/parent/UpdateSection.test.tsx（U3） | 6.2 節の表の各状態の表示（文言と `data-testid`）、ボタンが呼ぶ関数、チェックボックス、窓口が無いときに何も出さないこと、保護者画面の上の知らせ |
| scripts/vite-plugin-precache.sw.test.ts（U3） | `__manabi/update/status` の GET に `respondWith` しない |

### 11.3 e2e（後の段。units に入れない）

- `e2e/updater.spec.ts`（chromium だけ）と `e2e/helpers/fake-github.ts`（Node の `http`。127.0.0.1 の 4800〜4999 の空いたポート）。8765・4299 は使わない。
- 版の違う2つのビルドが要る: `vite.config.ts` に試験用の上書き（例 `MNW_APP_VERSION` があれば `VITE_APP_VERSION` に使う）を後の段で足す。見本パック入り（`VITE_MNW_SAMPLE_PACKS=1`）で作る（見本パックの音声は `audio-g1-g2` の部品に入る）。
- zip と版の情報は U2 の `scripts/release-lib.ts` の関数で作る（小さな偽のリリース）。置き場は Git Bash があれば `install.sh --yes`（一時の HOME）、無ければ zip を一時フォルダに展開して作る。
- 本物の serve.py を `--port <4900 台>`・`MANABI_UPDATE_TEST_ORIGIN=http://127.0.0.1:<偽の GitHub のポート>`・`XDG_CONFIG_HOME=<一時>` で起動する。
- 通す: 2.1.0 で開く → 記録を作る（1問解く）・見本パックを取得 → 保護者画面「このアプリについて」に「新しい版 2.2.0」→「更新する」を1回 → 読み込み直し → 版の表示が 2.2.0 → 見本パックが自動で `ready` に戻る → 記録が残っている → 置き場に `app.prev` が無い・偽の GitHub は main の zip だけを渡した。
- ほかに: 取得の途中で偽の GitHub が接続を切る → `Range` で続きから。偽の GitHub が許可されていないホストへ転送 → 失敗の表示・今の版のまま。自動の確認をオフ → 起動しても偽の GitHub に要求が来ない。窓口の無い配信（vite preview）では更新の節が出ない。
- アプリ（ブラウザ）から 127.0.0.1 の配信以外への要求が無いことを、ページの要求を見て確かめる（BC-03）。
- 後片付け: 状態の `server.pid` のプロセスを止める。

---

## 12. 実装の単位（units）と約束

並行して作る。**ファイルは単位どうしで重ならない**。ほかの単位のファイルは変えない（必要なら報告する）。共通の約束は 5.3 節（窓口と JSON）・3.1〜3.2 節（版の情報と部品の印）・4 章（置き場）。

| 単位 | 中身 | ファイル |
|---|---|---|
| U1 | サーバー: 更新の仕組みと serve.py の変更、Python の試験 | `deploy/zorin/serve.py`、`deploy/zorin/mnwupdate/{__init__,common,manifest,fetch,install,service,api}.py`、`deploy/tests/{helpers,test_manifest,test_fetch,test_install,test_service,test_api,test_serve,test_integration}.py`、`package.json`（scripts の `test:py`・`test:py:sh` だけ） |
| U2 | リリースの版の情報: zip に部品の印、版の情報の JSON、`version.json` の `appVersion` | `scripts/package-release.ts`、`scripts/release-lib.ts`（新規）、`scripts/release-lib.test.ts`（新規）、`scripts/vite-plugin-precache.ts`、`scripts/vite-plugin-precache.test.ts` |
| U3 | アプリ: 保護者画面の更新の節・知らせ・押したあとの流れ・起動時の続き（教材の取り直し）・SW の素通し | `src/core/offline/updater.ts`（新規）、`src/core/offline/updater.test.ts`（新規）、`src/core/offline/index.ts`、`src/core/offline/index.test.ts`、`src/sw/sw.ts`、`scripts/vite-plugin-precache.sw.test.ts`、`src/parent/AboutTab.tsx`、`src/parent/UpdateSection.tsx`（新規）、`src/parent/UpdateSection.test.tsx`（新規）、`src/parent/index.tsx`、`src/parent/parent.css` |
| U4 | 導入・起動・削除のスクリプト | `deploy/zorin/install.sh`、`deploy/zorin/uninstall.sh`、`deploy/zorin/manabi.sh`（注釈だけ）、`deploy/tests/test_install_sh.py`（新規） |

単位に入れないもの（後の段）: e2e（`e2e/updater.spec.ts`・`e2e/helpers/fake-github.ts`・`vite.config.ts` の試験用の版の上書き・`playwright.config.ts`）、文書（README・docs・DESINGN.md）、`package.json` の版を 2.1.0 にすること、`docs/expansion/release-2.1.0.md`。

各単位の詳しい約束は、この文書のほかに、作業の指示（units の what）に書く。

---

## 13. Windows で確かめられないこと・残るリスク

Zorin OS の実機が無いため、Windows 11（Git Bash・`.venv` の Python 3.12）で確かめられる範囲だけを確かめる。次は確かめられない（handover.md に書く）:

| 確かめられないこと | 代わりにしたこと |
|---|---|
| `renameat2(RENAME_EXCHANGE)` での入れ替え（Linux だけ） | 呼び出しを1つの関数にまとめ、失敗したら名前の変更 2 回に切り替える。Windows では切り替えた側を試験する。Linux の動きは ext4 の仕様（Linux 3.15 以降・glibc 2.28 以降）に頼る |
| `os.execv` での再起動と、systemd の自動起動のときの動き（同じ PID） | Windows では `subprocess.Popen` の別の道で通しを試験する。exec の道は Linux の実機で確かめる（device-checklist に足す） |
| `fcntl.flock` の鍵 | Windows では鍵を取らない（スレッドの鍵だけ）。install.sh が配信を止めてから入れるので、鍵が無くても重ならない |
| Zorin の python3（3.10）での動き | 3.10 にある機能だけを使う約束にする（2 章）。可能なら `py -3.10` で unittest を流す（入っていなければ書いておく） |
| 本物の GitHub の転送先のホスト名（`release-assets.githubusercontent.com` か `objects.githubusercontent.com`） | 両方を許可リストに入れる。リリースのあとに `serve.py --check-update` で確かめる（3.6 節の 4）。GitHub が別のホストに変えたら確認が `redirect-host` で失敗する（安全な側に倒れる）ので、許可リストを直した版を手で入れ直してもらう |
| `xdg-user-dir`・`gio`・`systemctl --user` を使う install.sh の部分 | Git Bash では無いので、そこを通らない道だけを試験する |
| 実機の空き容量・遅い回線での大きな zip（1.3GB）の取得 | 偽の GitHub で、続きから・中止・空き不足（差し替え）を試験する |

残るリスク:
- GitHub のアカウントが乗っ取られると偽の版を配られうる（署名なし。3.5 節）。
- フォールバックの入れ替えのあいだの停電（Linux では起きない）。
- 自己検査に通っても実際には動かない版（まれ）。そのときは README の手順で入れ直す（記録は消えない）。
- 音声の部品は zip ごとに取得するので、音声が1本変わっただけでもその学年の zip（最大 1.3GB）を取り直す。

---

## 14. やらないこと・決めなかったこと

- 署名（3.5 節）。
- 子供の画面での知らせ、勝手に入れる（無人の）更新。保護者が押すまで入れない。
- 「前の版に戻す」ボタン（前の版は確定まで控えるだけ）。戻したいときは前の版の zip を手で入れ直す。
- 部品より細かい（ファイルごとの）差分の取得。
- 更新の仕組みが `.desktop`・systemd の単位ファイルを書き換えること（変えるときは `minVersion` を上げて手で入れ直してもらう）。
- アプリ（ブラウザ）からの GitHub への直接の通信。

---

## 15. 実装とレビューの記録（2026-11-07）

U1〜U4 を実装し、レビューで窓口の形（5.3 節）・版の情報と部品の印（3.1〜3.2 節）・置き場（4 章）が単位どうしで合っていることを確かめた。

### 15.1 Windows で確かめたこと

| 確かめたこと | どうやって |
|---|---|
| 状態の窓口が動く（`supported:true`・`current.version`・`token`・`server.pid`・応答の見出し・CORS なし）。`/__manabi/health` と静的配信は今までどおり | `npm run build` の dist で一時フォルダに置き場を作り、本物の serve.py を 127.0.0.1 の空きポートで起動して確かめた |
| ネットが無いとき静かにやめる（`check.state=offline`・`latest=null`・記録は状態が変わったときだけ1行） | `https_proxy` を「受けてすぐ切る」127.0.0.1 の聞き役に向けて確かめた（GitHub にはつながない）。外へつなごうとしたのは `CONNECT github.com:443` の1回だけ |
| 自動の確認をオフにできる（`updater.json` に保存・起動し直しても残る・オフのときは起動して 22 秒たっても外へつながない・「今すぐ確かめる」を押したときだけつなぐ・オンに戻すと 5 秒後に確認） | 同上（聞き役が受けた接続の数で数えた） |
| 窓口の守り（合言葉・Origin・Sec-Fetch-Site・Content-Type・Host・OPTIONS） | 同上と test_api.py |
| 本物のブラウザから同じオリジンの GET・POST が通り、CSP（`connect-src 'self'`）で外への通信が止まる | 作業用のブラウザで、本物の serve.py が配るページから fetch して確かめた |
| 本物の GitHub の版の情報の取得（TLS と github.com の中の転送） | `py -3 deploy/zorin/serve.py --check-update`。最新のリリース（2.0.x）に版の情報が無いので `{"latest": null, "error": null}`・終了コード 0 |
| 2.1.0 → 2.2.0 の通し（変わらない音声の zip は取得しない・書いたのは決めた場所だけ・sha256 違いで今の版のまま） | test_integration.py（偽の GitHub と本物の serve.py の別プロセス。Windows の Popen の道） |
| zip・部品の印・版の情報（4 つの zip の中身・contentId・`.sha256`） | release-lib.test.ts と、本体の dist の写しでの `npm run package` の通し（Python の zipfile で検算） |
| install.sh・uninstall.sh（置き場の形・入れ替え・2.0.x の配置の丸ごと入れ替え・後始末） | test_install_sh.py（Git Bash。python3・systemctl・pkill・pgrep・xdg-user-dir は試験が作る偽物） |
| Python 3.10 の構文 | `ast.parse(..., feature_version=(3, 10))` を deploy/ の全 .py に通した |

### 15.2 確かめられないこと（実機・後の段で確かめる）

13 章の表のほかに、次は確かめられていない。

- **Service Worker を通した流れ**（新しい版の準備 → 読み込み直し → 教材の取り直し）: 作業用のブラウザでは Service Worker の登録そのものが失敗する（2.0.x の dist でも同じ）。単体試験だけで確かめた。後の段の e2e（11.3 節）で通す。
- **Zorin の実機**: `renameat2` での入れ替え・`os.execv` での再起動と systemd での PID・`fcntl.flock`・Python 3.10 での実行・`systemctl --user` の stop と start・`pkill`/`pgrep`・mawk の awk・実行権限の付き方。docs/device-checklist.md に足す（後の段）。
- **本物の GitHub からの zip の取得**（配布用ホストへの転送・大きな zip の続きから）: 版の情報を置いた 2.1.0 のリリースのあとに `--check-update` と実機で確かめる。
- `npm run test:py:sh`（Linux の python3）は流していない。

### 15.3 設計との違い・決めたこと

- 失敗の理由 `disk-full` の「あと約 X GB 必要です」の X は、配信の `needBytes`（必要な空きの合計）から今の `disk.freeBytes` を引いた足りない分にした（6.2 節の空き不足の見込みと同じ考え）。今の空きのほうが大きいときは数を出さない。
- `--check-update` は `MANABI_UPDATE_TEST_ORIGIN` が不正な形のとき `error.code = "bad-test-origin"`（終了コード 1）を出す（保守用の道具だけのコード）。
- 1 ファイル概ね 400 行の目安を、`service.py`（523 行）・`install.py`（431 行）・`serve.py`（497 行）が超えている。分けるなら `service.py` の更新の作業（`_run_apply` など）を別のモジュールに出す（自己検査は `mnwupdate` の下を全部読み込むので、足しても検査に入る）。
- アプリ側（U3）で決めたこと: 確認中は保護者画面で 1 秒ごとに読む。配信がすでにその版なら POST せずアプリの準備から始める（`sw-failed` の「もう一度ためす」用）。押したのに配信が 30 秒 idle のままなら `interrupted`。Service Worker が使えない（`unsupported`・`error`）なら待たずに `sw-failed`。
- 画面に足した字（展・布・待・送）のため、`npm run chars` で scripts/fonts/used-chars.txt を作り直し、コアのフォント（zen-maru-gothic-400/700）を作り直した。
