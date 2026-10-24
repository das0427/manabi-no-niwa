# 素材パイプライン手順書 (音声 / フォント / 書き順)

まなびのにわの素材 (読み上げ音声・日本語フォント・ひらがな書き順) を生成する手順。
すべてオフライン実行可能(初回の素材取得だけネット接続が必要)。生成物はリポジトリにコミットして配布する。

| 素材 | 生成物 | スクリプト |
|---|---|---|
| 音声 | `public/audio/<key>.mp3`, `public/audio/manifest.json` | `scripts/voice/generate.py` |
| フォント | `public/fonts/*.woff2` (4 ファイル) | `scripts/fonts/subset.py` |
| 書き順 | `src/modes/trace/data/kana-strokes.json` | `scripts/strokes/extract.py` |

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

■ ひらがなの書き順
KanjiVG — Copyright (C) 2009-2011 Ulrich Apel, Creative Commons Attribution-Share Alike 3.0 (CC BY-SA 3.0)
https://kanjivg.tagaini.net / https://creativecommons.org/licenses/by-sa/3.0/
本アプリでは座標を等間隔サンプリングして利用しています(改変あり)。
```
ライセンス全文は `licenses/` を配布物(`public/licenses/` など)に同梱するのが望ましい。
