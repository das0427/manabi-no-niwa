# 文字の配置の検査（text-layout）で見つかった違反の直し方

`npm run check:text-layout`（docs/test-plan.md 3.2）の結果を原因ごとに分け、直し方・確かめ方・受け入れるものを決める。
回ごとに節を足す。各回の担当は、自分の項目に書いた「ファイル」だけを触る（同じファイルを2つの項目が触らない）。

---

## 第1回（2026-10-31・分析と設計）

### 0. 元の結果と、追加で測ったもの

- 元: `docs/screenshots/text-layout-report/`（2026-10-30。308 単元・9742 問・186,784 画面）。
  違反のない単元は 1 / 308。多い順に scroll-hidden 263k 画面・overlap-text 224k・small-text 153k・covered 97k・out-of-stage 58k・wakachi-split 43k・clipped 41k・button-split 29k。
- 追加の計測（開発サーバーで実際に開いて測った。1280×720、全 308 単元 × 見本を最大 6 問 × 問題・最後のヒント・解説 = 5,502 画面）:
  - **作業領域（`.unit__work`）から中身がはみ出す画面: 2,601 / 5,502（47%）、248 単元。** 中身は縦の中央そろえ（`justify-content: center`）なので、はみ出すと上（問題文・おうち）と下（ヒント・つぎへ・解説）の両方へ出る。必要な高さに対する空きの比は 中央値 0.73、下位 25% は 0.54 以下。
    エンジン別のはみ出し画面: choice 1,058・number 543（多くは 0.9 以上で少しだけ）・listen 289・reading 288（本文の枠の中は除いて数えると少ない）・graph 84・order 53・sort 52・fill 48。
  - **解説の板（`.unit__explain`）の中身が収まらない: 解説の 643 / 1,834 画面（35%）、195 単元。** 板は下の帯（高さ 11.6u まで）に固定で、中身を縦の中央にそろえて `overflow: auto` にしているため、はみ出した上側はスクロールしても見えない（clipped「スクロールの枠の上・左にはみ出し」の大半）。
  - 問題文の高さ: 7u（1行）1,315 画面、10〜11u（2行）455、15u 以上（3〜4行）64（g1.life.*・g2.life.*・g3.math.box-expression 等）。**問題文の文字が全学年 3u**（`.unit__prompt`）で、DESINGN.md 17章の学年別（幼児 3u・小1〜2 2.8u・小3〜4 2.4u・小5〜6 2.2u）になっていない。
  - 横のはみ出し（中身が左右 4u の余白を越える）: 66 画面（カードの列が折り返さない sort/order/match）。
- 代表例の確認（スクリーンショットは `.cache` と `docs/screenshots/text-layout-report/shots/`）:
  - g1.ja.particles n=40（fill）: 図（大きな文）＋縦3択で 34.8u が 23u の作業領域に入らず、図が問題文に重なる。
  - g3.soc.city-changes n=6（choice）: 年表の図＋縦3択（47u）で、図が舞台の上にはみ出す。
  - g4.ja.idioms n=0（match）: 意味の札（長い文）が横一列に並び、札が細長くなって1行2〜3字で折れ、札の列が問題文とヒントの上に出る。
  - g2.ja.write-structure n=0（sort）: 箱のふたが上（おうち・問題文）に、カード5枚の列が下にはみ出す。
  - g1.ja.listen n=0 の解説: 書き起こし（破線の枠）が出て「きいてね」の列が伸び、上の問題文に重なる。
  - g1.ja.punctuation n=16 の解説: 4行の解説が板（11.6u）に入らず、1行目が板の上に切れて読めない。
  - g2.math.numbers-1000 n=1 の解説: 解説の図（表）が板の横に押し込まれ、「ひゃくの くらい」が1行1字の縦書きのように折れる。
  - g1.ja.read-story n=0（reading）: 本文の枠は設計どおりスクロール。右の選択肢の列もスクロールになり、4つめの選択肢が見えない。
  - p5.math.clock n=0: 選択肢の時計の文字盤の数字が 1.1u（最小 2.2u）。g4.soc.prefectures: 地図の番号の丸が 1.1u。

### 1. 原因の分類

| 分類 | 内容 | 主な種類 |
|---|---|---|
| (1) 共通の画面の作り | 作業領域が中身の量に合わせて縮まない・中央そろえではみ出す／解説の板が小さく中央そろえ／問題文が学年別の大きさでない／改行の規則（禁則・分かち書き・孤立）を CSS で指定していない／ふりがな・補助の文字の最小を守っていない／選択肢・カードの寸法と並び／図（SVG）の文字の最小が無い | overlap-text・covered・out-of-stage・clipped・scroll-hidden・overlap-button・wakachi-split・kinsoku-start・orphan・button-split・small-text のほとんど |
| (2) パックの文の長さ・数・配置 | 問題文が3〜4行（生活科・作文系）／選択肢の文が長い（ことわざ・慣用句・意見文・作文）／解説が長い | (1) を直したあとに残る分。次の回で見る |
| (3) 検査の誤検出 | ふりがなの張り出し（ルビの親字の範囲が rt の幅に広がる）／読解の本文の枠のように「スクロールさせる設計」の枠の中の行を1行ずつ数える | overlap-text（ruby と …）約 2 万画面・scroll-hidden（本文）約 1.8 万画面 |
| (4) 設計上受け入れる | 読解の本文の枠のスクロール（条件つき）／text-on-figure（参考。意図した重ね） | — |

### 2. 共通の直し（systemic。項目ごとにファイルを分ける）

#### S1 単元の画面の枠（UnitRunner・unit.css・tokens.css・DESINGN.md）

ファイル: `src/units/UnitRunner.tsx`、`src/units/unit.css`、`src/styles/tokens.css`、`DESINGN.md`

1. **単元の画面に段階の印を付ける**: `.screen.unit` に `data-stage={unit.stage}`（p23/p4/p5/g1〜g6）と、分かち書きの段階（p23・p4・p5・g1・g2）なら `data-wakachi=""` を付ける（S2 の改行の規則・S3〜S8 の最小の文字が使う）。
2. **段階ごとの文字の大きさの変数**を `.unit[data-stage]` に定義する（tokens.css に既定値）:
   - `--prompt-size`: 幼児 3u・小1〜2 2.8u・小3〜4 2.4u・小5〜6 2.2u（17章の表）。`.unit__prompt` の `font-size: calc(var(--prompt-size) * var(--ts, 1))`。
   - `--text-min`: 補助の文字の最小（幼児 2.2u・小1〜2 2.0u・小3〜4 1.8u・小5〜6 1.7u）。各エンジンの補助の文字・札の番号・バッジはこれを下限にする（`max(…, var(--text-min))`）。
3. **作業領域の中身を収める（fit）**:
   - tokens.css で基準を分ける: `--u0: max(5px, min(1vw, 1.7778dvh))`（今の --u と同じ式）、`--u: var(--u0)`。
   - `.unit__work > * { --u: calc(var(--u0) * var(--fit, 1)); }`（.unit__work 自身の位置は縮めない）。
   - UnitRunner: `.unit__work` と子を ResizeObserver で見て、`--fit` を1にして測った中身の高さ（子の外接の合計＋gap）が空きを超えるとき `--fit = max(0.8, 空き / 必要)` を `.unit__work` の style に書く（文字の折り返しが変わるので2回まで測り直す。問題が変わったら1に戻す）。下限 0.8 は「主操作 6u・補助の文字の最小」を割らないため（3.2u の選択肢の文字 → 2.56u、7.5u の札 → 6u）。
   - `.unit__work` を `justify-content: safe center`、`align-items: safe center` にする（収まらないときは上にはみ出さず、問題文に重ならない）。
4. **解説の板を作り直す**（18章「回答欄の上に開く板」）:
   - `max-height` を 11.6u → `calc(var(--u) * 22)` に上げ、`display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: start;`（中央そろえをやめる。上が切れない）。図（`item.explainFigure`）は2段目に置き（`grid-column: 2`）、横に並べて押しつぶさない。図の幅は 100% まで・高さ 12u まで。
   - 解説の板の高さを ResizeObserver で測って `--panel-h` に書き、`[data-phase=explain] .unit__work { bottom: calc(var(--panel-h) + var(--u) * 2.4) }` にする（板と作業領域が重ならない。作業領域は 3. の fit で縮む）。
   - それでも収まらない長さ（板が 22u に達する）は板の中で縦スクロール（`overflow-y: auto`。上端から始まるので切れない）。スクロールが要るときは下端に「▼」の印（`data-scroll-cue`）を出す。
5. **吹き出し（ヒント）**: `font-size: max(calc(var(--u) * 2 * var(--ts, 1)), var(--text-min))`。`.unit__hint-mark` も同じ下限（幼児の 2u → 2.2u）。吹き出しは下の帯の中で高さ 11.6u まで（今のまま）。
6. **DESINGN.md の更新**（この項目の担当がまとめて書く。S2〜S8 の規則もここに書く）: 5.1（作業領域は問題文の下〜下の帯／解説の板の上。収まらないときは中身を 0.8 倍まで縮める）、17章（問題文は学年別の大きさ・補助の文字の最小を CSS 変数で守る・改行の規則（S2）・図の文字の最小（S6））、18章（解説の板の寸法と並び）。
- 減る見込み: overlap-text・covered・out-of-stage・overlap-button・clipped（解説の板の上の切れ）・scroll-hidden（解説）の大部分。特に clipped の「スクロールの枠の上・左にはみ出し」（約 1.8 万画面）はほぼ 0、small-text の hint-mark・吹き出し（約 4 万画面）は 0。
- 確かめ方: `MNW_UNITS=g1.ja.particles,g3.soc.city-changes,g1.ja.punctuation,g2.math.numbers-1000,g1.ja.listen,g3.sci.circuits npm run check:text-layout` と、`#/dev/unit/g1.ja.particles/40?state=q`・`#/dev/unit/g1.ja.punctuation/16?state=explain`・`#/dev/unit/g2.math.numbers-1000/1?state=explain` を 1280×620 と 1920×1080 で開いて見る。`npm run test`（unitFlow）と `npm run check:design`。

#### S2 改行の規則・ふりがな・RichText

ファイル: `src/text/Rt.tsx`、`src/text/rt.css`、`src/styles/base.css`

1. **改行の規則を子供画面に指定**（Chrome 156 で動作を確認済み）:
   - `.stage { line-break: strict; }` … 小さい仮名（っゃゅょ）・長音（ー）を行頭に置かない（kinsoku-start「おど／って」「ノ／ート」「じ／ゅん」）。
   - `.stage [data-wakachi] { word-break: keep-all; overflow-wrap: anywhere; }` … 分かち書きの段階は空白（と句読点・括弧）のところだけで折る（wakachi-split・button-split の「分かち書きの語の途中」・「2／かい」等の数と助数詞）。空白の無い長い語は枠の手前で折る（はみ出さない）。figure.css の `.fig-text` と同じ考え方（17章）。
   - `.stage { text-wrap: pretty; }` … 最後の行が1字になるのを避ける（orphan）。ボタン・札の文字（`.choice`, `.tk-card__label`, `.eng-opts__label`, `.eng-choice__label`, `th`, `td`）は `text-wrap: balance`。
   - 小3以上（`[data-stage]` で `data-wakachi` が無い）のボタン・札の文字は `word-break: auto-phrase`（BudouX の文節。html は lang="ja"）＋ `overflow-wrap: anywhere`。本文（読解の段落・解説）には付けない（右端がそろわなくなるため）。
2. **ふりがなの最小**: `.rt rt { font-size: max(0.5em, calc(var(--u) * 1.1)); }`（解説 2.1u・吹き出し 2u のふりがなが 1.0u になっていた。small-text の rt 約 2.2 万画面）。
3. **分数の文字**: `.rt-frac { font-size: max(0.82em, var(--text-min, 0px)); }`（吹き出しの中の分数が 1.6u になっていた）。
4. **空欄と句読点・括弧を離さない**: Rt の描画で、空欄（`blank`）の直前の始め括弧（「『（）と直後の終わり括弧・句読点（」』）、。！？）を `white-space: nowrap` の span（`.rt-nobr`）で包む（kinsoku-end「「／□」・kinsoku-start「□／。」）。
5. **数と単位の間の空白**: 表示のときだけ、数字の後ろの半角空白＋単位（cm mm km m kg g mL dL L ％ ℃ 度 など）を改行しない空白（U+00A0）に置き換える（読み上げ・plainText は変えない）。
- 減る見込み: kinsoku-start 7,393 → ほぼ 0、wakachi-split 43k → ほぼ 0、button-split 29k の大半、orphan 15k の大半、small-text（rt・分数）約 2.4 万画面 → 0。
- 確かめ方: `#/dev/unit/g1.ja.folktales/10?state=q`（「おどって」）・`g1.ja.particles/0?state=explain`・`g1.ja.read-info/24`（表の「はっぱ」）・`g3.ja.reference-connectives/16`・`g2.ja.polite/10`。`npm run test`（src/text の単体テスト。nowrap の包み方と U+00A0 の置き換えにテストを足す）。

#### S3 選択肢（choice・listen の選択肢・ボタンの基本形）

ファイル: `src/engines/choice/choice.css`、`src/engines/choice/choice.tsx`、`src/engines/listen/options.css`、`src/engines/listen/options.tsx`、`src/engines/listen/listen.css`、`src/engines/listen/listen.tsx`、`src/ui/ui.css`

1. 文字だけの選択肢（絵・図の無いもの）は `min-height: 7u`（今は `.choice` 14u・`.eng-choice__opt` 10u）、`min-width: 14u` のまま。絵・図の選択肢は今のまま。
2. 並びを中身で決める（`layout` の指定が無いとき。指定があっても `column` で収まらないとき）:
   - 文字の選択肢が4つ以上 → 2列のグリッド（`grid-template-columns: repeat(2, minmax(0, 1fr))`、幅は作業領域の 90% まで）。
   - 問題に図（`item.figure`）がある、または選択肢の文が短い（全部 8字以下）→ 横一列（row）。
   - `column` は「文が長い（1つでも 16字超）かつ 3つ以下」のときだけ。
3. 聞いて選ぶ（listen）: 解説のときの書き起こし（`eng-listen__transcript`）は「きく」の札の下に足さず、札を補助の寸法（5.5u）に縮めて同じ列に置く（列の高さを変えない）。書き起こしは `max-height` を作業領域の高さまでにして、それを超えるときは S1 の解説の板に入れる（`item.explain` の後ろ）。
4. 「こたえあわせ」（`.eng-check`・`.eng-opts__check`）は選択肢の列の下でなく、下の帯の主操作の位置（つぎへ の左 3u。5.1）に置く（out-of-stage「こたえあわせ」・overlap-button）。
- 減る見込み: choice の作業領域のはみ出し（1,058 画面のうち、比 0.55 以上の大部分）・overlap-button（opt と next/hint）約 6 千画面・out-of-stage（opt・check）約 4 千画面。
- 確かめ方: `#/dev/unit/g1.ja.particles/40`・`g3.soc.city-changes/6`・`g1.ja.listen/0?state=explain`・`g1.ja.listen/12`・`g3.en.numbers-colors/21`・`g1.math.position/5?state=h2`。`src/engines/choice/*.test.ts`・`listen` のテスト。

#### S4 札のエンジン（order・sort・match・fill・build の共通部品）

ファイル: `src/engines/order/shared.css`、`src/engines/order/shared.tsx`、`src/engines/order/order.css`、`src/engines/order/order.tsx`、`src/engines/sort/sort.css`、`src/engines/sort/sort.tsx`、`src/engines/match/match.css`、`src/engines/match/match.tsx`、`src/engines/fill/fill.css`、`src/engines/fill/fill.tsx`、`src/engines/build/build.css`、`src/engines/build/build.tsx`

1. カードの列は `flex-wrap: wrap` にして横にはみ出さない（横のはみ出し 66 画面）。カードの最大幅 `max-width: 40u`。
2. match: どちらかの列の札に 10字を超える文があるときは、左の札を縦に並べ、右の札（意味）も縦に並べる2列の表の形（`eng-match--rows`）にする（g4.ja.idioms・g6.ja.info-relations・g6.ja.language-change）。
3. sort: 箱（ふた）は作業領域の中に置く（上の帯に出さない。`position` を絶対にしない／作業領域の上端より上に出さない）。カードが5枚以上なら2列。
4. `.tk-badge` の文字を `max(1.8u, var(--text-min))`・丸の寸法も合わせて 3u に（small-text 1.8u）。`.tk-slot` の文字も `--text-min` を下限に。
5. `.tk-card__label` は S2 の `text-wrap: balance` が効くように `display: block` で包む（inline のままだと balance が効かない）。
- 減る見込み: g4.ja.idioms・g6.ja.write-opinion・g5.ja.write-fact-opinion・g4.ja.write-report など上位の単元の overlap-text・covered・out-of-stage の大半、overlap-button（home と lid）、narrow-wrap（札）。
- 確かめ方: `#/dev/unit/g4.ja.idioms/0`・`g2.ja.write-structure/0`・`g6.ja.write-opinion/0`・`g1.ja.read-info/33`（1536×864）。`npm run test`（order・sort・match のテスト）。

#### S5 読解とかいてみよう（本文の枠・右の列）

ファイル: `src/engines/reading/reading.css`、`src/engines/reading/reading.tsx`、`src/engines/explain/explain.css`、`src/engines/explain/explain.tsx`

1. 本文の枠（`.eng-reading__passage`）はスクロールさせる設計のまま。ただし
   - 枠に `data-scroll-region="passage"` を付ける（検査が中の行を1行ずつ数えない。docs/test-plan.md 3.2）。
   - スクロールできることが分かる印: 下にまだ文があるときだけ、枠の下端に薄い面のグラデーション＋「▼ つづき」の札（`data-scroll-cue`、2u、押すと1画面分スクロール）。スクロールバーも見せる（`scrollbar-gutter: stable; scrollbar-width: thin; scrollbar-color: var(--ink-soft) transparent`）。
   - ヒント・解説で示す文（`is-focus`・`is-evidence`）は今どおり scrollIntoView。
2. 右の列（`.eng-reading__side`）はスクロールさせない（選択肢が見えないのは不可）。選択肢は `min-height: 5.5u`・文字 2.2u → `max(2u, var(--text-min))`、列の幅が足りないときは本文と右の列の比を 1.5:1 → 1.3:1 にする。4択が収まらないときは S1 の fit で縮む。
3. かいてみよう（`.eng-explain__side`）: `justify-content: safe center`（上の理由・道具が切れて見えない clipped を無くす）。
- 減る見込み: scroll-hidden（本文の行）約 1.8 万画面は検査の変更（下の C2）と合わせて 0、scroll-hidden（右の列の選択肢）・clipped（eng-explain__side）0。
- 確かめ方: `#/dev/unit/g1.ja.read-story/0`（1280×620）・`g6.ja.read-argument/0`・`g1.life.home/12`。本文の枠を手で（ホイール・タッチ）スクロールでき、「▼ つづき」が最後で消えること。

#### S6 図の文字（figure・graph・clock・map・geometry）

ファイル: `src/engines/figure/Figure.tsx`、`src/engines/figure/figure.css`、`src/engines/figure/types.ts`、`src/engines/graph/graph.css`、`src/engines/graph/graph.tsx`、`src/engines/clock/clock.css`、`src/engines/clock/clock.tsx`、`src/engines/map/map.css`、`src/engines/map/map.tsx`、`src/engines/map/symbols.tsx`、`src/engines/geometry/geometry.css`、`src/engines/geometry/geometry.tsx`、新規 `src/engines/figure/svgText.ts`

1. **SVG の文字の最小**: 共通の小さな仕組み `useSvgTextFloor(svgRef, viewBoxWidth)`（svgText.ts）を作る。ResizeObserver で「画面の px ÷ viewBox の単位」を測り、`--text-min`（S1）を viewBox の単位に直した値を返す。各描画は `fontSize={Math.max(既定, floor)}` にする。文字が大きくなって図からはみ出す所（軸の目盛り・時計の数字）は、目盛りの間引き（graph: 1つおき）や図の余白（viewBox の padding）で受ける。
2. 時計の選択肢（p5.math.clock・g1〜g3 の時計）: 選択肢の時計は 18u 以上にし、数字は 12・3・6・9 を大きく、ほかは小さくしない（最小を守る）。
3. 地図（g4.soc.prefectures・g3.soc.map-symbols・g5/g6 社会）: 地図の図を作業領域の高さいっぱい（今は 26u）に広げ、番号の丸・記号の文字に 1. の最小を使う。
4. グラフ: 横軸の札（`.gr-xlabel`）は `white-space: nowrap`、入らないときは文字を `--text-min` まで縮め、それでも入らなければ 2段にずらす（「みか／ん」「1960／年」）。
5. 図の表（`.fig-table`）の見出し（`th`）は `word-break: keep-all; white-space: nowrap` を既定にし、表が入らないときは表全体の文字を縮める（narrow-wrap「ひゃくの くらい」の1行1字）。
6. `.fig-text--xl`・`--l`（英語の大きな語）: 英単語の中では折らない（`overflow-wrap: normal`・`hyphens: none`）。語が入らないときは文字の大きさを枠に合わせて縮める（「ST／OP」「morni／ng」）。
7. 図の文字が SVG の表示範囲の外に出るもの（clipped「text ⊂ svg」: g1.math.compare-quantity の「あ」、g2.math.time の「？」、g6.math.approx-area の「20m」）は viewBox を文字の外接まで広げる。
- 減る見込み: small-text の SVG の文字（約 2.7 万画面）・span.gr-xlabel・th の orphan/narrow-wrap/word-split・clipped（text ⊂ svg）約 1 万画面の大半。
- 確かめ方: `#/dev/unit/p5.math.clock/0`・`g4.soc.prefectures/0`・`g3.math.bar-graph/0`・`g3.soc.city-changes/29`・`g4.math.angle/5?state=explain`・`g3.en.alphabet-upper/67?state=explain`。`src/engines/graph/graph.render.test.tsx`・`map.render.test.tsx`。

#### S7 数の入力（number）

ファイル: `src/engines/number/number.css`、`src/engines/number/number.tsx`

1. 数字キーの区画（18章）を作業領域の高さに合わせる: キーの寸法を `min(7u, (作業領域の高さ − 間隔) / 4)` に（6u を下限）。こたえあわせのキーはキーの列の中に置く（今は下にはみ出す）。
2. 回答欄（`.eng-number__box`）の「2ばんめの こたえ から」等の札が舞台の外に出る（g1.math.numbers-120）: 札を回答欄の上に置き、幅を回答欄に合わせる。
3. 筆算の図（`th`「じゅう」「ひゃく」の1行1字）: 見出しは `nowrap`（S6 の 5. と同じ考え。number の中の表はこの項目で直す）。
- 減る見込み: number の作業領域のはみ出し（543 画面。多くは比 0.9 以上）と out-of-stage（eng-number__box）、narrow-wrap（th）。
- 確かめ方: `#/dev/unit/g1.math.numbers-120/0?state=explain`・`g2.math.add-column/0`・`g2.math.numbers-1000/1`（1280×620）。

#### S8 プログラムと実験（program・experiment）

ファイル: `src/engines/program/program.css`、`src/engines/program/program.tsx`、`src/engines/experiment/experiment.css`、`src/engines/experiment/experiment.tsx`、`src/engines/experiment/Apparatus.tsx`

1. program: `.prog-card__name`・`.prog-slot`（1.6u）・`.prog-card--param`（1.8u）を `max(…, var(--text-min))` に。命令の列（`.prog-strip`）はスクロールさせる設計なら `data-scroll-region="strip"` とスクロールの向きの「▼」等の印（`data-scroll-cue`）を付け、命令が少なく入るときは折り返して全部見せる。盤（`.prog-board`）の SVG が切れる（clipped svg ⊂ prog-board）のは盤の大きさを作業領域から決める。
2. experiment: 注記（「この アプリの せっていでは こう なるよ…」1.5〜1.6u）を `--text-min` 以上に。装置の SVG の文字（g4.sci.weather の目盛り 0.8u・g3.sci.wind-rubber 0.4u・g6.sci.combustion 0.5u 等）は viewBox の文字の大きさを上げ、目盛りの数字を間引く。結果の表（`exp-table`）の空欄の文字（1u 以下）を最小に。
- 減る見込み: small-text の prog-card・prog-slot（約 1.4 万画面）、experiment の small-text・overlap-text（g3.sci.* g4.sci.* g5.sci.*）の一部。
- 確かめ方: `#/dev/unit/g1.prog.condition/20`・`g3.prog.condition-combo/1?state=h2`・`g3.sci.circuits/0`・`g4.sci.weather/9`。

#### S9 開発用の画面の分離と React の key

ファイル: `src/App.tsx`、`src/illust/content/life-g12.tsx`

1. `EngineGallery` を `UnitSampleView` と同じ形にする: `const EngineGallery = import.meta.env.DEV ? lazy(() => import('./dev/EngineGallery')…) : null;`、経路の条件も `EngineGallery &&`。いまは本番の `dist/assets/EngineGallery-*.js`（49KB）が作られ、`dist/sw.js` の先読みの一覧にも入っている。直したあと `npm run build` で dist に EngineGallery が無く、sw.js に名前が出ないことを確かめる。
2. **key の重複（「50-50」「50-66」）**: `src/illust/content/life-g12.tsx` の `leafShape`（267行目）が `key={`${x}-${y}`}` で、`life-leaves`（はっぱが ふえた）は (50,66) と (50,50) を左右の2枚で使うため同じ key になる（`life-bud` も (50,66) が2つ）。key に角度を足す（`${x}-${y}-${rot}`）。ほかの `${x}-${y}` の key（blossom・signFlower・p5 の雨つぶ・flower 等）は座標が重ならないことを確認した。
- 確かめ方: `npm run build`、`grep -c EngineGallery dist/sw.js` が 0。`#/dev/unit/g1.life.plant-diary/0` をコンソールを開いて表示し、「Encountered two children with the same key」が出ないこと。`npm run test`（illust の描画テスト）。

### 3. 検査の誤検出として直すこと（checkerChanges）

ファイル: `e2e/helpers/text-layout.ts`、`e2e/text-layout-probe.tl.ts`（見本を足す）、`docs/test-plan.md`（3.2 に理由を書く）

- **C1 ふりがなの張り出し**: Chrome はふりがな（rt）が親字より長いとき、親字の文字の範囲（Range の外接）を rt の幅まで広げて返す（g1.ja.read-story の「正月《しょうがつ》」: ruby の箱 146〜221px、親字の範囲 142〜225px）。そのため隣の字と 0.2〜1.3u 重なったように見える（overlap-text の「ruby と span.rt」「span.rt と ruby」「ruby と ruby」約 2 万画面）。実際の字形は ruby の箱の中にあり、rt が隣の仮名の上に張り出すのは JIS X 4051 で許される組み方。**直し方**: 親字（ruby の中で rt でない字）の l/r を、その ruby 要素の getBoundingClientRect の左右に詰めてから比べる。rt と同じ行の隣の文字（rt が上にある・横の重なりが rt の字の 0.5 字以内）も重なりに数えない。前の行の字に rt が重なる（行間が足りない）ものは今どおり出す。プローブに「長いふりがな」の見本（誤検出しないこと）と「行間 1.0 でふりがなが前の行に重なる」見本（検出すること）を足す。
- **C2 スクロールさせる設計の枠**: `data-scroll-region` を付けた枠（読解の本文・プログラムの命令の列。S5・S8 が付ける）の中の字・ボタンは scroll-hidden を1行ずつ出さない。その代わり、枠が `scrollHeight > clientHeight + 2`（横は Width）のとき、枠の中または下端に見えている `[data-scroll-cue]` が無ければ scroll-hidden を枠につき1件（「スクロールできる印が無い」）出す。枠の見えている高さが 4行（本文の line-height × 4）未満なら clipped を1件出す（枠が小さすぎて読めない）。clipped（上・左へのはみ出しでスクロールしても見えない）は枠の中でも今どおり出す。
- 緩めないもの: scroll-hidden の判定そのもの（`data-scroll-region` の無い枠は今どおり）、small-text の閾値、overlap-text の閾値。

### 4. 受け入れるもの（accepted）

- 読解の本文の枠のスクロール（g1〜g6 の read-*・soc.history-* 等）: 本文は 1行 24〜32字・2〜6 段落あり、作業領域（約 26u）に全部は入らない。読み手が上から順に読む枠で、ヒント・解説の根拠の文は自動で見える所までスクロールする。条件: S5 の「▼ つづき」の印とスクロールバーがあること、枠の高さが 4行以上あること、右の選択肢はスクロールしないこと（C2 で検査する）。
- text-on-figure（参考。1,561 画面）: ヒントの吹き出し・ふりがなが図（時計・絵）の上に重なるもので、多くは意図した重ね（図の上の札）。数が少なく、第2回で S1・S6 のあとに残ったものだけ個別に見る。
- プログラムの命令の列（`.prog-strip`）のスクロール（命令の多い問題）: S8 の印（`data-scroll-cue`）があり、C2 の検査を通ること。

### 5. 次の回（第2回）に回すもの（content）

共通の直し（S1〜S8）で、作業領域の fit・解説の板・改行の規則が入ると、パック側の違反の多くは消える見込み。第2回はもう一度 `MNW_FRESH=1 npm run check:text-layout` を流し、残ったものをパックごとに直す。いま見えている候補:

- 問題文が3〜4行: life-g12（g1.life.plant-diary・school-safety・public・seasons、g2.life.tell・animals・town）、g1-math（story-expression・sub-basic・sub-borrow）、g3-math（box-expression・length-km・triangles・division-basic）、g4-math（change-relations・ratio-intro・order-ops）。2行までに（17章）。指示と状況の文を分け、状況は図・本文に移す。
- 選択肢の文が長い（1つ 30字超）: g3-ja（proverbs・write-reasons）、g4-ja（idioms・write-report・info-compare）、g5-ja（write-fact-opinion・figurative・classics・spoken-written・honorifics）、g6-ja（write-opinion・info-relations・language-change）、soc-g34（safety・shop-work）、soc-g56（politics・world）。
- 解説が 4行（板が 22u に達する）を超えるもの: 第2回の結果で一覧にする。

### 6. 第1回の実施とレビュー（2026-10-31）

S1〜S9・C1・C2 を実装した。設計から変えたところと、レビューで直したところ:

- S2 の 4.: 始め括弧・終わり括弧を空欄と別の nowrap の span に包むと、span の境目で折れる（kinsoku-end が減らなかった）。空欄と前後の括弧・句読点（無ければ隣の1字。空白の隣は付けない）を1つの `span.rt-nobr` にまとめた（`Rt.tsx`、`rt-wrap.test.ts`。空欄の inline-block の前後は keep-all でも折れ、「あらいました／□」「□／と」が出ていた）。fill の空欄のボタンも同じ規則で前後の字と包んだ（`fill.tsx`、`splitRichEdge`）。
- S2 の 1.（ふりがな）: ruby の前後も keep-all で折れていた（「お／金を」「とび／出して」。g1.ja.folktales の wakachi-split 119 画面）。空欄と同じく、ruby と隣の1字（括弧・句読点の並び）を1つの nowrap にまとめた。
- S2 の 1.: 小3以上の `word-break: auto-phrase` の対象を `.unit[data-stage]` に絞った（幼児ホーム・v1 モードの `data-stage` に付かないように）。
- S1: tokens.css の `--text-label`・`--text-small` 等は `:root` で解決されて `--fit` で縮まなかった。作業領域の子で定義し直した（DESINGN.md 17章）。`.unit__work--number` の grid も `align-content: safe center` にした（上へはみ出して図が問題文に重なっていた）。作業領域を `z-index: 0` にして、はみ出した札が解説の板・吹き出しの上に出ないようにした。解説の板の「▼」は右の余白へ（文の字にかぶっていた）。
- S3 の 4.: 「こたえあわせ」と吹き出しが重なる（multi のヒント）。こたえあわせがあるときは吹き出しの右端を 39u にした。
- S4: sort の2列は文の札（8字超）のときだけにした（絵の札6枚が2列×3段で下にはみ出していた）。match の表の形は、左を中身の幅（40% まで）、右に残りにし、札の文字を縮む `--u` で書いた（g4.ja.idioms/0 が 1536×864 で舞台の下に出ていた）。
- S5 の 1.: グラデーションは 14章で禁止なので使わず、枠の下に印の段を取った（DESINGN.md 17章）。最後まで読んだ（自動でスクロールした）あとは印が消えて C2 の「印が無い」になっていたので、「▲ はじめから」を出す。S3 の autoLayout で読解の右の細い列の選択肢が2列になり1行6〜7字で語の途中で折れていたので、読解は指定の縦一列のままにした（`autoArrange={false}`）。
- S3 の 3.: 聞く問題の書き起こしは高さで切ってスクロールさせると下の行が見えない（印も無い）ので、高さの上限を外した（作業領域に入らなければ fit で縮む）。
- S6 の 4.: 図のグラフ（`Figure` の bar・line）の横軸の札にも、graph と同じ「縮める→2段」を入れた（g4.sci.weather/9 の「9時10時11時…」が詰まっていた）。`.fig-chart` の幅を 32u に決めた（札の幅で図の幅が決まっていた）。
- S7: 解説では数字キーを見えなくするだけでなく高さを 0 にした（6u×4 のキーで回答欄が解説の板の下に押し出されていた）。

第2回に残るもの（共通の直しでは足りない。教材の長さ・図の大きさ）:

- 作業領域が 0.8 倍でも足りない問題: g1.ja.read-info/33（本文5行の図＋札）、g2.ja.write-structure/0（文の札5枚）、g6.ja.write-opinion/0、g4.sci.weather/9（グラフ＋長い4択）、g1.math.position/5（絵の棚＋絵の選択肢。1280×620 で選択肢が下の帯に隠れる）。
- 解説が 22u を超えて板の中でスクロールするもの（g4.ja.idioms/0 など）。
- 正解の丸の印（`.mark`）が選択肢・札の字にかぶる（g1.ja.listen/0・g3.en.alphabet-upper/67 の解説、g4.ja.idioms の左の札）。前からある形で、第1回では変えていない。
