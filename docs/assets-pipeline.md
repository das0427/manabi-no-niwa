# 素材パイプライン手順書 (音声 / フォント / 書き順)

まなびのにわの素材 (読み上げ音声・日本語フォント・ひらがな書き順) を生成する手順。
すべてオフライン実行可能(初回の素材取得だけネット接続が必要)。生成物はリポジトリにコミットして配布する。

| 素材 | 生成物 | スクリプト |
|---|---|---|
| 音声 | `public/audio/<key>.mp3`, `public/audio/manifest.json` | `scripts/voice/generate.py` |
| フォント | `public/fonts/*.woff2` (4 ファイル) | `scripts/fonts/subset.py` |
| 書き順 | `src/modes/trace/data/kana-strokes.json` | `scripts/strokes/extract.py` |
| 書き順(かな全部・漢字1026字) | `src/packs/_data/strokes/*.json` (3b 参照) | `scripts/strokes/extract_all.py` |

## 0. 共通準備 (Python 仮想環境)

Python 3.12 + プロジェクト内 venv (`.venv/`, git 管理外)。グローバルには何も入れない。

```powershell
# Windows (PowerShell)
py -3.12 -m venv .venv        # または %LOCALAPPDATA%\Programs\Python\Python312\python.exe -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r scripts\voice\requirements.txt
```

```bash
# Linux (Zorin 18 = Ubuntu 24.04 系: python3.12 標準。Zorin 17 は 3.10 なので 3.12 を別途用意)
sudo apt install python3-venv
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/voice/requirements.txt
```

`scripts/voice/build.ps1` / `build.sh` は venv が無ければ作り、requirements が変わったときだけ `pip install` する(音声ビルド専用ラッパー)。
フォント・書き順スクリプトは上の venv の python で直接実行する。

`scripts/voice/requirements.txt` は音声・フォント共通 (pyopenjtalk-plus / soundfile / numpy / fonttools / brotli と推移依存を固定)。

> 注意: 依頼では `pyopenjtalk-prebuilt` が第一候補だったが、Python 3.12 用 wheel が無く sdist ビルド(setuptools+C++コンパイラ要)になるため、
> **`pyopenjtalk-plus`** (cp312 win_amd64 wheel あり, `import pyopenjtalk` で同じ API, Open JTalk 辞書同梱)を使っている。

推奨 npm scripts (package.json は統括側で管理):

```jsonc
"voice:build":    "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/voice/build.ps1",
"voice:build:sh": "bash scripts/voice/build.sh",
"fonts:build":    ".venv\\Scripts\\python.exe -I scripts\\fonts\\subset.py --chars <統括が作る文字リスト>",
"strokes:build":  ".venv\\Scripts\\python.exe -I scripts\\strokes\\extract.py"
```

## 1. 音声生成 (`scripts/voice/`)

### 構成
- `generate.py` ... 本体。`voice/script.json` を読み `public/audio` へ差分生成
- `build.ps1` / `build.sh` ... venv 準備 + `generate.py` 呼び出し(引数はそのまま転送)
- `verify.py` ... 生成済み mp3 の検査(デコード可否、manifest との長さ一致、ピーク/RMS、先頭末尾の無音)
- `make_samples.py` ... 声パラメータ比較用サンプルを `scripts/voice/samples/` に出力(不要になったらフォルダごと削除してよい)
- `requirements.txt`

### 実行
```powershell
npm run voice:build                      # = build.ps1 : script.json -> public/audio (差分)
npm run voice:build -- --force           # 全再生成
npm run voice:build -- --dry-run         # 何件生成されるかだけ表示
npm run voice:build -- --script X.json --out DIR       # 入出力先を変更(テスト用)
npm run voice:build -- --speed 0.8 --half-tone 2 --voice-scale 1.1   # 既定パラメータ上書き
.\.venv\Scripts\python.exe -I scripts\voice\verify.py --dir public\audio
```
Linux: `bash scripts/voice/build.sh [同じ引数]`

### script.json
```json
{"version":1,
 "defaults":{"speed":0.85,"half_tone":1.0,"voice_scale":1.0},
 "entries":[
  {"key":"item.ringo","text":"りんご","speed":1.0},
  {"key":"count.1ko","text":"1こ","yomi":"いっこ"}
 ]}
```
- `key`: `[a-z0-9._-]+`(重複不可)。出力は `<key>.mp3`
- `text`: 日本語(ひらがな/カタカナ/漢字)。`yomi` があればそちらを合成(読み誤り対策)
- `speed`: **基準話速に掛ける倍率**(1.0 = 基準のまま)。基準話速は `defaults.speed`(省略時 0.85。1.0 が Open JTalk 標準、小さいほど遅い)
- `half_tone`(任意): 音高オフセット(半音)。既定 +1.0。Mei はもともと高め(F0≈345Hz)
- `voice_scale`(任意): 声道サイズ。>1 で声が小さく(子供っぽく)なる。リサンプルで実現し、音高・話速は保たれる(既定 1.0)
- `defaults`(任意)は script ファイル側の既定。優先順位は CLI > `entry` > `defaults` > 組み込み既定
- Open JTalk の `alpha`(all-pass 定数)等は pyopenjtalk の API に出ていないため調整不可。代わりに `voice_scale` を用意した

### 出力と差分生成
- `public/audio/<key>.mp3`: mono, 24 kHz, CBR 約 48 kbps、先頭/末尾の無音は約 50 ms、有音部 RMS ≒ -18 dBFS・ピーク ≦ -1 dBFS
- `manifest.json`: `{"version":1,"voice":"...","entries":{"<key>":{"file":"<key>.mp3","hash":"<12桁>","ms":<長さ>}}}`
  - `hash` = sha1(合成文 + 実効話速 + half_tone + voice_scale + 声ファイル + パイプライン版 + SR/bitrate) の先頭 12 桁
  - `ms` = **デコード後の実長**(ヘッダ無し CBR mp3 のためフレーム境界まで丸まる。Chrome の `decodeAudioData` / `<audio>.duration` と一致を確認済み)
- hash が変わった/manifest に無い/ファイルが無いものだけ再生成。script から消えたキーの mp3 は(前回 manifest にあったものに限り)削除
- エンコーダ遅延(約 46 ms)を実測して先頭パディングから差し引くため、デコード後の先頭無音は約 50 ms になる
- 後処理や品質を変えたら `generate.py` の `PIPELINE_VERSION` を上げると全件再生成される

### 取得物
| 物 | 取得元 | ライセンス | 置き場所 |
|---|---|---|---|
| Open JTalk 辞書 + エンジン | `pyopenjtalk-plus` の wheel に**同梱**(初回DLなし) | 辞書: Modified BSD (NAIST-jdic 由来), pyopenjtalk: MIT | venv 内 |
| 声 `mei_normal.htsvoice` | MMDAgent_Example-1.8.zip (約 30MB): https://sourceforge.net/projects/mmdagent/files/MMDAgent_Example/MMDAgent_Example-1.8/MMDAgent_Example-1.8.zip/download | CC BY 3.0 (名古屋工業大学) | `.cache/mmdagent/mei_normal.htsvoice` (初回実行時に自動取得・展開) |

声ファイルが無ければ `generate.py` が自動でダウンロード・展開する。手動なら zip 内 `MMDAgent_Example-1.8/Voice/mei/mei_normal.htsvoice` を `.cache/mmdagent/` に置く。
ライセンス文: `licenses/mei-voice-COPYRIGHT.txt`(配布物同梱の COPYRIGHT.txt), `licenses/CC-BY-3.0-legalcode.txt`。
htsvoice 本体と辞書はアプリには同梱されない(生成された mp3 のみ配布)。

### 読み誤りに関する注意(Open JTalk の確認結果)
数字+助数詞は読みが外れやすい。教材 script では **ひらがなで書くか `yomi` を付ける**こと。
| text | 読み(実測) | 正しくは |
|---|---|---|
| 1こ | いちこ | いっこ (yomi 必須) |
| 8こ | はちこ | はっこ (yomi 推奨) |
| 10こ | じゅーこ | じゅっこ (yomi 必須) |
| 1ほん | いちほん | いっぽん (yomi 必須) |
| 3こ / 2こ / 6こ | さんこ/にこ/ろくこ | OK |
| 1ぴき / 6ぴき | いっぴき / ろっぴき | OK |
| 3つ | みっつ | OK |
| 今日 / 何 | きょー / なに | OK(「何」は文脈で なん/なに が変わる。ひらがな推奨) |
助詞「は」「へ」「を」は正しく わ/え/お で読まれる。4歳児向けは基本ひらがな(必要なら分かち書き)で書くと誤読が少ない。

### Zorin(Linux) での実行
`build.sh` で同様に動く想定(`pyopenjtalk-plus` の manylinux wheel と、soundfile 同梱の libsndfile 1.2.x で MP3 書き出し)。
**Linux での実行はこの環境では未検証**。numpy 2.5 は Python 3.12 以上が必要なので、Zorin 17 (Python 3.10) では要 Python 3.12。

## 2. フォントのサブセット化 (`scripts/fonts/`)

```powershell
.\.venv\Scripts\python.exe -I scripts\fonts\make_base_chars.py                   # base-chars.txt を再生成(通常は不要)
.\.venv\Scripts\python.exe -I scripts\fonts\subset.py                            # 既定セットで 4 ファイル
.\.venv\Scripts\python.exe -I scripts\fonts\subset.py --extra build\chars-extra.txt   # src 抽出文字などを追加
.\.venv\Scripts\python.exe -I scripts\fonts\subset.py --klee-extra klee-kanji.txt     # Klee One に漢字を足す場合
```
- 入力 TTF (`.cache/fonts/`, 無ければ自動取得): `https://raw.githubusercontent.com/google/fonts/main/ofl/zenmarugothic/ZenMaruGothic-{Regular,Bold}.ttf`, `.../ofl/kleeone/KleeOne-{Regular,SemiBold}.ttf`
- 文字リスト: UTF-8 テキストで「全文字を含む」だけでよい(改行・重複は無視)。`--chars`(既定 `base-chars.txt`)と `--extra` はマージされる
- `base-chars.txt`(3307 字): ひらがな・カタカナ全部 / 半角 ASCII / 全角数字 / 基本記号(、。！？「」ー・＋−＝×（）〜… ほか) / JIS X 0208 第1水準漢字 2965 字
- Zen Maru Gothic (400, 700) は全文字、Klee One (400, 600) は漢字を除いた文字(かな・数字・記号 342 字)。Klee に漢字が要る場合は `--klee-extra`
- 残す OpenType: kern, palt, vert, vrt2, ccmp, locl, liga, calt。ヒンティング削除、woff2(brotli)
- フォントに無い文字(Zen Maru Gothic で欠落: `―` `ゕ` `ゖ` `＄` `～`(U+FF5E; 波ダッシュは `〜` U+301C を使う))はサブセットに入らずシステムフォントにフォールバックする
- 出力サイズ(base-chars のみ): zen-maru-gothic-400 約 628 KiB / -700 約 651 KiB / klee-one-400 約 49 KiB / -600 約 49 KiB (合計約 1.34 MiB)。
  src に実際に出る文字だけに絞ると Zen は大幅に小さくなる(漢字を使わなければ数十 KiB)。**統括側で src から抽出した文字を `--chars` に渡し、`base-chars.txt` の漢字を外す運用が望ましい**(`--chars` を指定すると `base-chars.txt` は使われない)

ライセンス: SIL OFL 1.1 — `licenses/OFL-ZenMaruGothic.txt`, `licenses/OFL-KleeOne.txt`。
OFL はフォントの改変(サブセット)・同梱再配布を許可する。予約フォント名(Reserved Font Name)は両ファミリーとも宣言なし(OFL.txt 先頭の著作権表記に RFN の記載なし)。
単体でフォントを販売してはならない。

## 3. ひらがな書き順 (`scripts/strokes/`)

```powershell
.\.venv\Scripts\python.exe -I scripts\strokes\extract.py
.\.venv\Scripts\python.exe -I scripts\strokes\extract.py --chars しくつ... --out X.json   # 文字を変える場合
```
- 入力: KanjiVG リリース `r20260714` の `kanjivg-20260714-main.zip` (約 12.6MB, sha256 `b5df6cd2…1a7fc`、スクリプトが自動取得・検証)
  `https://github.com/KanjiVG/kanjivg/releases/download/r20260714/kanjivg-20260714-main.zip` → `.cache/kanjivg/`
- 対象 15 字: しくつへのてこいりうそちるろひ(KanjiVG の `kanji/<5桁hex>.svg`)
- パス記法 M m L l H h V v C c S s Q q T t A a Z z すべてに対応(円弧は SVG 仕様 F.6.5 で変換)。弧長で約 2 単位(KanjiVG 109 座標)間隔にサンプリングし、1000 座標(×1000/109)に整数丸め
  → 点間隔は約 18 単位(1000 系)、`size:1000`、座標範囲は 128〜885
- JSON: `{"source":"KanjiVG","license":"CC BY-SA 3.0","version":"r20260714","size":1000,"chars":{"し":{"strokes":[[[x,y],...]]}}}` (ストローク順 = 書き順)。サイズ約 13 KB
- `scripts/strokes/preview.svg` に番号付きプレビュー(丸が始点、数字が書き順)。ブラウザで開いて目視確認できる(確認済み)
- KanjiVG のストローク数: し1 く1 つ1 へ1 の1 て1 こ2 い2 り2 う2 そ1 ち2 る1 ろ1 ひ1(「そ」は 1 画の字形)

ライセンス: CC BY-SA 3.0 (Ulrich Apel / KanjiVG) — `licenses/KanjiVG-COPYING-CC-BY-SA-3.0.txt`, `licenses/CC-BY-SA-3.0-legalcode.txt`。
**ShareAlike**: `kana-strokes.json` は KanjiVG の改変物(翻案)なので CC BY-SA 3.0 で提供する必要がある。アプリ全体への波及範囲は要判断(データファイルを独立ファイルとして同ライセンスで明示するのが無難)。

## 3b. 書き順データの拡張: かな全部と学年別漢字 1026 字 (`scripts/strokes/extract_all.py`)

小学 1〜6 年への拡張用。ひらがな・カタカナ全部と、学年別漢字配当表の 1026 字を KanjiVG から作る。

```powershell
.\.venv\Scripts\python.exe -I scripts\strokes\extract_all.py            # 全ファイルと preview-*.svg を再生成
.\.venv\Scripts\python.exe -I scripts\strokes\extract_all.py --step 3.0 # 点の間隔を粗く(容量を減らす)場合
```
- `extract.py` の関数(パス解析・サンプリング)を再利用するので、点の間隔・座標系は 3 章と同じ(1000 座標で約 18 単位、0〜1000 の整数)。
- 漢字の学年は `src/text/kanji-grades.ts`(`KANJI_BY_GRADE`)を読む。配当表を直せば再生成で追随する。
- 出力は `src/packs/_data/strokes/`(学年ごとに分けて遅延読み込みできるようにする)。形式は `kana-strokes.json` と同じで、`"set"` を足した:
  `{"source":"KanjiVG","license":"CC BY-SA 3.0","version":"r20260714","size":1000,"set":"kanji-g3","chars":{"字":{"strokes":[[[x,y],...],...]}}}`

| ファイル | 内容 | 字数 | 画数 | 大きさ | gzip |
|---|---|---|---|---|---|
| `kana.json` | ひらがな U+3041〜3094(ぁ〜ゔ)、カタカナ U+30A1〜30F6(ァ〜ヶ)、ー | 171 | 490 | 172,612 B | 約 51 KB |
| `kanji-g1.json` | 1 年 | 80 | 400 | 118,150 B | 約 42 KB |
| `kanji-g2.json` | 2 年 | 160 | 1,318 | 316,154 B | 約 111 KB |
| `kanji-g3.json` | 3 年 | 200 | 1,881 | 433,320 B | 約 152 KB |
| `kanji-g4.json` | 4 年 | 202 | 1,995 | 444,679 B | 約 156 KB |
| `kanji-g5.json` | 5 年 | 193 | 2,047 | 443,458 B | 約 155 KB |
| `kanji-g6.json` | 6 年 | 191 | 2,021 | 440,099 B | 約 154 KB |
| 合計 | | 1,197 | | 約 2.37 MB | 約 820 KB |

- KanjiVG に無い字・ストローク番号が連番でない字は無かった(全字抽出済み)。あれば出力から外して一覧表示し、終了コード 1 を返す。
- 確認: `scripts/strokes/preview-kana.svg`, `preview-g1.svg` … `preview-g6.svg`(各学年から 10 字前後を抜粋。丸が始点、数字が書き順)。ブラウザで開いて目視する。
- 単体テスト: `src/packs/_data/strokes/strokes-data.test.ts`(各ファイルの出典・ライセンス、全字が 1 画以上、各画 2 点以上、座標が 0〜1000 の整数、学年別ファイルの字が配当表と過不足なく一致、画数の目安)。
- 容量を減らすなら `--step` を大きくする(3.0 で点がおよそ 2/3)。点の間隔を変えるとなぞり判定の許容に影響するので、変えるときは trace モードと合わせて確認する。
- `.prettierignore` に `src/packs/_data/strokes/*.json` を足すこと(生成物。`format:check` が失敗する)。

### 学年別漢字配当表 (`src/text/kanji-grades.ts`)
- 出典: 小学校学習指導要領(平成29年告示)国語 別表「学年別漢字配当表」。https://www.mext.go.jp/content/1413522_001.pdf (確認日 2026-10-24)。80 / 160 / 200 / 202 / 193 / 191 字、計 1026 字(2020 年度からの表)。
- この PDF の表は文字がアウトライン図形でテキスト抽出ができない。`scripts/kanji/extract_grades.py` で表を画像にして 1 字ずつ切り出し、目で 2 回読み取って確定した(自動の字形照合は UD デジタル教科書体との差で精度が足りず、補助としてだけ使った)。字数が表示の字数と一致し、重複が無いことをテストで検査している。
- PDF は `.cache/mext-g/` に置く(git 管理外。再取得は上の URL)。

### ライセンスと派生データの扱い
- `kana-strokes.json`, `kana.json`, `kanji-g1〜g6.json` は KanjiVG(CC BY-SA 3.0)の翻案なので、**データファイルそのものを CC BY-SA 3.0 で提供する**。各 JSON に `"source"`, `"license"`, `"version"` を入れてあり、ファイル単体を取り出しても出所と条件が分かる。
- 改変内容・対象ファイル・条件は `licenses/KanjiVG-derived-data-NOTICE.txt` に記載。原文は `licenses/KanjiVG-COPYING-CC-BY-SA-3.0.txt`、`licenses/CC-BY-SA-3.0-legalcode.txt`。
- ShareAlike の範囲: 点列データを**独立した JSON ファイルとして配布し、コードから読み込むだけ**にして、アプリ全体のライセンスには波及しない(データを他のコンテンツに混ぜて 1 つの翻案にしない)という整理で運用する。ただしこれは設計上の整理で、法的な見解は**未確認**(必要なら専門家に確認する)。
- 配布物(`dist/`, アプリ内の「このアプリについて」)には、帰属表示(4 章の文言)と上記 NOTICE を同梱する。`public/licenses/` に `licenses/` をコピーする運用が望ましい。
- 学年別漢字配当表のデータ(`kanji-grades.ts`)は事実の一覧(文部科学省の告示の別表)で、KanjiVG の派生ではない。

## 4. クレジット表記(アプリの「このアプリについて」等に掲載する文言案)

```
■ 音声
読み上げ音声は Open JTalk (https://open-jtalk.sp.nitech.ac.jp/) による音声合成です。
声: 「Mei」 HTS Voice (MMDAgent Project Team / 名古屋工業大学), Copyright (c) 2009-2018 Nagoya Institute of Technology,
Creative Commons Attribution 3.0 (CC BY 3.0) — https://creativecommons.org/licenses/by/3.0/ (http://www.mmdagent.jp/)

■ フォント
Zen Maru Gothic — Copyright 2021 The Zen Maru Gothic Project Authors (https://github.com/googlefonts/zen-marugothic)
Klee One — Copyright 2020 The Klee Project Authors (https://github.com/fontworks-fonts/Klee)
いずれも SIL Open Font License 1.1 (https://openfontlicense.org)

■ かな・漢字の書き順
KanjiVG — Copyright (C) 2009-2011 Ulrich Apel, Creative Commons Attribution-Share Alike 3.0 (CC BY-SA 3.0)
https://kanjivg.tagaini.net / https://creativecommons.org/licenses/by-sa/3.0/
本アプリでは座標を等間隔サンプリングして利用しています(改変あり)。
```
ライセンス全文は `licenses/` を配布物(`public/licenses/` など)に同梱するのが望ましい。

## 5. 英語音声 (`scripts/voice/generate_en.py`)

小学校外国語活動・外国語(英語)の単元で使う英語の読み上げ。日本語(Open JTalk)とは別パイプラインで、**開発時にオフライン生成した mp3 だけをアプリに同梱**する(実行時に音声合成サービスは使わない)。

### 採用: Kokoro-82M (ONNX) + 声 `af_heart`(米国英語・女声)
| 項目 | 内容 |
|---|---|
| モデル | hexgrad/Kokoro-82M v1.0(8,200 万パラメータ)の ONNX 変換版 `kokoro-v1.0.onnx` + `voices-v1.0.bin`(thewh1teagle/kokoro-onnx のリリース `model-files-v1.1`) |
| 実行 | Python `kokoro-onnx 0.6.1` + `onnxruntime 1.31.0`(CPU のみ。GPU 不要)。テキスト→音素は `phonemizer` + `espeakng-loader`(espeak-ng 同梱) |
| ライセンス | モデル: **Apache-2.0**。kokoro-onnx: MIT。onnxruntime: MIT。phonemizer / espeak-ng: GPL-3.0(**生成時のツールでアプリには入らず、出力の mp3 にも及ばない**) |
| 取得物 | `.cache/kokoro-en/kokoro-v1.0.onnx`(約 310 MiB), `voices-v1.0.bin`(約 27 MiB)。初回に自動取得し SHA-256 を検証(`.cache/` は git 管理外) |
| 出力 | `public/audio/en/<key>.mp3` + `manifest.json`(mono, 24 kHz, CBR 約 48 kbps、先頭/末尾の無音約 50 ms、有音部 RMS ≒ -18 dBFS・ピーク ≦ -1 dBFS)。後処理・エンコードは日本語の `generate.py` の関数を共用 |

声は米国英語で統一(`af_heart`。Kokoro 公式の声評価で最高の A)。英国英語にしたい場合は `--voice bf_emma` かつ script の `defaults.lang` を `"en-gb"` にする(一冊の教材内で米英を混ぜない)。

### 実行
```powershell
.\scripts\voice\build_en.ps1                       # voice/script-en.json -> public/audio/en (差分)
.\scripts\voice\build_en.ps1 --force               # 全再生成
.\scripts\voice\build_en.ps1 --dry-run             # 何件生成されるかだけ表示
.\scripts\voice\build_en.ps1 --script X.json --out DIR      # 入出力先を変更(テスト用)
.\scripts\voice\build_en.ps1 --voice af_bella --speed 0.8   # 声・基準話速を変更
.\.venv\Scripts\python.exe -I scripts\voice\verify.py --dir public\audio\en   # 検査(日本語と共通)
```
`build_en.ps1` / `build_en.sh` は venv が無ければ作り、`requirements-en.txt`(版固定)が変わったときだけ `pip install` する。
venv は日本語・フォントと共用(`.venv`)。pip で入るのは `.venv` の中だけ。

### Linux (Zorin 等) での実行
```bash
bash scripts/voice/build_en.sh [同じ引数]
```
`kokoro-onnx` / `onnxruntime` / `espeakng-loader` はいずれも manylinux wheel があり、espeak-ng ライブラリは `espeakng-loader` に同梱されるので `apt install espeak-ng` は不要の想定。
**Linux での実行はこの環境では未検証**(Windows 11 / Python 3.12.10 のみで確認)。

### voice/script-en.json
```json
{"version":1,
 "defaults":{"speed":0.85,"voice":"af_heart","lang":"en-us"},
 "entries":[
  {"key":"en.word.apple","text":"apple","speed":1.0},
  {"key":"en.abc.a","text":"A"},
  {"key":"en.word.read-past","text":"read","say":"red"},
  {"key":"en.word.x","text":"apple","phonemes":"ˈæpəl"}
 ]}
```
- `key`: `[a-z0-9._-]+`(重複不可)。出力は `<key>.mp3`。`defaults` は省略可
- `text`: 表示用の英文。`say` があればそちらを合成(読み誤り対策。日本語側の `yomi` に相当)。`phonemes` があれば IPA 音素列を直接合成(最優先。espeak-ng 形式。例 `ˈæpəl`)
- `speed`: **基準話速に掛ける倍率**(1.0 = 基準)。基準話速 `defaults.speed` の既定は 0.85(Kokoro の speed は 0.5〜2.0、1.0 が標準)
- `voice`(任意): 個別に声を変える。通常は使わない(一貫性のため)
- 文末の `.` `?` `!` を付けるとイントネーションが文として終わる。単語1語はピリオドなしでよい(`apple`, `dog`)
- 1 文字の `A` `B` `C` は文字名(エー・ビー・シー)で読まれる(実測の音素: `ˈeɪ` `bˈiː` `sˈiː`)。冠詞の "a" の弱形にはならない
- 差分生成: hash(合成文 + 音素 + 実効話速 + 声 + 言語 + モデル + パイプライン版 + SR/bitrate)の先頭 12 桁が変わった/manifest に無い/ファイルが無いものだけ再生成。script から消えたキーの mp3 は(前回 manifest にあったものに限り)削除
- 後処理を変えたら `generate.py` の `PIPELINE_VERSION`、英語固有の処理を変えたら `generate_en.py` の `EN_PIPELINE_VERSION` を上げる

### 実測(Windows 11, CPU のみ)
- 生成: 52 件(アルファベット26 + 単語/文26)で 18.2 秒 = 約 0.35 秒/件(モデル読込・初回の準備は別)
- サイズ: 平均 約 4.8 KB/件(単語 約 3.6〜4.8 KB、文 約 6〜8 KB)。長さは単語 0.6〜0.8 秒、短文 0.9〜1.4 秒
- 全件デコード可能・mono・24 kHz・48 kbps・ピーク -1.4〜-8 dBFS・RMS 約 -18.4 dBFS・先頭無音 42〜52 ms(`verify.py`)

### ライセンスと検討した代替
一次情報で確認した結果:
| 候補 | 判定 | 根拠 |
|---|---|---|
| **Kokoro-82M** | **採用** | モデルカードに `license: apache-2.0`、「This is an Apache-licensed model, and Kokoro has been deployed in numerous projects and commercial APIs.」「trained exclusively on permissive/non-copyrighted audio data」。https://huggingface.co/hexgrad/Kokoro-82M ・ https://github.com/hexgrad/kokoro/blob/main/LICENSE (Apache-2.0) ・ https://github.com/thewh1teagle/kokoro-onnx (MIT) |
| Piper `en_US-lessac`(最も有名) | 不採用 | データセット(Blizzard 2013 Lessac)のライセンスが研究目的限定で商用開発・配布を含まない(https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html )。`amy` `alba` `hfc_*` `jenny` など多くの声が lessac のファインチューン |
| Piper `hfc_female/male` | 不採用 | CC BY-NC-SA 4.0(非商用) |
| Piper `ljspeech`(public domain)/`libritts_r`(CC BY 4.0)/`cori`・`kristin`(LibriVox, public domain) | 採用可能な予備 | 各 `MODEL_CARD`(https://huggingface.co/rhasspy/piper-voices )に記載。ただしエンジンは現行の OHF-Voice/piper1-gpl が GPL-3.0(出力音声には及ばない)。声は Kokoro より機械的で、品質は未比較 |
| espeak-ng 単体 | 不採用 | GPL-3.0 だが出力音声は問題ない。品質が明らかに機械的で子供向けに不向き(音素変換にのみ利用) |

### クレジット表記案(「このアプリについて」に追加。第4節の「■ 音声」に続けて)
```
英語の読み上げ音声は音声合成 Kokoro-82M (hexgrad, Apache License 2.0) https://huggingface.co/hexgrad/Kokoro-82M
で作成しました(kokoro-onnx (MIT) https://github.com/thewh1teagle/kokoro-onnx を使用)。
```
ライセンス全文: `licenses/Apache-2.0-Kokoro-LICENSE.txt`, `licenses/MIT-kokoro-onnx-LICENSE.txt`、由来・取得物のハッシュ・モデルカード抜粋: `licenses/Kokoro-82M-NOTICE.txt`。
mp3 の再配布にクレジットは法的には必須とされていない(Apache-2.0 は出力物に条件を付けない)が、上記を入れておくのが安全。モデルや espeak-ng 自体はアプリに同梱しない。

### 未確認事項
- **聴感での品質確認は未実施**(聞き取りやすさ・発音の自然さ・子供向けの速さは人が聴いて確認が必要)。波形上は長さ・音量・無音が正常で、`apple/dog/red/Hello./How are you?/I like cats./What color do you like?/A/B/C` を含むアルファベット全 26 字・短文 24 文で生成エラー無し
- 基準話速 0.85 でも文によっては速めに感じる可能性がある(「What color do you like?」は約 4.7 音節/秒)。必要なら `defaults.speed` を 0.75〜0.8 に下げる
- Kokoro の学習データの一部は「closed TTS provider 由来の合成音声」(モデルカードの記載)。モデルは Apache-2.0 で公開されているが、その合成元事業者の利用規約までは確認できていない(残余リスク)。個々の声(`af_heart`)のデータ来歴・ライセンスはモデルカード/VOICES.md に個別記載が無い
- Linux 実行は未検証。Piper の予備案の音質は未検証