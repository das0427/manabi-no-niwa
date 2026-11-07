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

---

## 第2回（2026-10-31・分析と設計）

### 0. 元の結果と、追加で測ったもの

- 元: 第1回の直し（0ae44d4）のあとに流し直した `docs/screenshots/text-layout-report/`（308 単元・9,742 問・186,784 画面。全件は `.cache/text-layout/units/`）。件 22,568（前回 22,744）。違反のない単元 33 / 308。
  画面の延べでは overlap-text 40,620・covered 34,810・small-text 27,134・out-of-stage 24,982・clipped 4,431・overlap-button 3,270・button-split 2,147。
- **状態の偏り**: overlap-text の 56%（22,772）と covered の 55% が解説、残りの大半がヒント①〜③。問題（q）の画面はどちらも 150 未満。covered のうち 19,325 は「解説の板・吹き出しの下に字・ボタンが隠れる」。
- 追加の計測（開発サーバー 127.0.0.1:4321 で全 308 単元 × 見本 2 問 × 問題・ヒント③・解説、1280×720、1,848 画面）:
  - 作業領域から中身がはみ出す画面（0.5u 超）: 読解を除いて 問題 92 / 578・ヒント③ 92・**解説 206**。問題は中央値 3.6u、解説は中央値 10〜14u はみ出す。問題では収まるのに解説だけはみ出すものが 138。はみ出す画面の多くは fit の下限 0.8 に張りついている（307 画面）。
  - 吹き出し（ヒント）は下の帯の中に収まっている（上端 43〜49u、作業領域の下端 42.3u）。ヒントの状態の重なりは「作業領域からはみ出した札・選択肢の上に吹き出しが来る」もの。
  - 解説の板の高さ: 中央値 9.4u・上位 25% 12.9u 以上・22u に達してスクロールするもの 22 / 616。
- 代表例の確認（開発用の画面を Playwright で開いて撮影し、同じ検査の関数で測った）:
  - g1.ja.punctuation/31 解説（1536×864）: 文の選択肢3つ（各 6.7u）が板（5行・20u）の上の 17u に入らず、3つ目が板の下に隠れる。板の文と隠れた選択肢の字が overlap-text と covered の両方に出る。
  - g3.ja.proverbs/0 解説（1280×720）: 同じ形。加えて正解の ○（`.mark--correct`、札の高さ＋1.6u の真円）が選択肢の字の上に重なって読めない（g6.ja.write-opinion/0 の解説も）。
  - g1.math.position/2 問題: 絵の棚（3段×4）の図が縮まず、2列の選択肢が舞台の下に出る（out-of-stage 7,824 画面の大半）。g2.math.box/1: 箱の図（22u）と図の選択肢4つ（各 22u）が縦に並び、選択肢が舞台の下に出る。
  - g1.math.numbers-10/4 ヒント①: 絵（ねこ）の選択肢3つが縦一列（パックの `column`）で、3つ目が吹き出しの下に隠れる。
  - g1.ja.read-info/33（order）: 本文5行の図（fig-text）が作業領域の大半を使い、札が舞台の下に出る。ヒントのボタンが札に重なる。
  - g4.en.time-days/14 ヒント③: 時計の選択肢3つが「きく」の札の右に入らず2段に折れ、3つ目が舞台の下に出る。「もういちど きく」の札が吹き出しの下に入る。
  - g2.ja.culture/22 解説（listen）: 書き起こし（破線の枠）が幅 28u の細い列で1行 9〜10字に折れて縦に伸び、解説の板の下まで続く（第1回で高さの上限を外したため）。
  - g4.ja.idioms/110（sort）: 意味の札7枚を2列にし、右の 22u（こたえあわせ）は空いたまま。ふたの段が 9u あり、札の4段目が舞台の下に出る。
  - g4.ja.read-summary/5（読解）: 右の列の選択肢4つ（引用の文。各 2〜3行）が 30u に入らず、4つ目が舞台の下に出る。
  - g5.en.read-words/322 解説（match）: 解説の図（表）が `.unit__explain-figure` の `max-height: 12u; overflow: hidden` で切れる（clipped の約 2,500 画面）。
  - g2.math.mult-beyond/2 解説: 10の棒のまとまり3つが縦に並び（図が 30u を超える）、回答欄が舞台の下に出る。
  - g6.prog.efficient/12: ますの図（パックの SVG、高さ 9u）の A・B・C の字が 0.7u。g2.prog.debug/8 は引き上げ後も 1.82u（最小 2u。`<g transform>` の中の字の拡大率を svg 全体の値で測っている）。g1.math.compare-quantity/4 の「ます」1.9u（measure には最小の仕組みが無い）。g1.math.numbers-10/0 の目盛りは 1.998u（0.1 単位の丸めで最小をわずかに割る）。
- **改行の規則（Chrome 156 で確かめた）**: `word-break: auto-phrase` と `text-wrap: balance` を同じ要素に付けると、balance が文節の区切りを無視して字の途中で折る（「みんながそろ／うまで、ゆっくりまつ」。pretty や指定なしでは「みんながそろうまで、／ゆっくりまつ」）。小3以上の選択肢・札の button-split（2,147 画面）の主な原因。`keep-all` と balance の組み合わせは正しく折れる。
- 開発用の EngineGallery と React の key（第1回 S9）: `src/App.tsx` は DEV のときだけ lazy、`life-g12.tsx` の leafShape は `${x}-${y}-${rot}`。今回 `vite build` で `dist/assets` に EngineGallery の chunk が無いことを確かめた。検査中のページのエラー（pageerror）は 0 件。

### 1. 原因の分類（第2回）

| 分類 | 内容 | 主な種類 |
|---|---|---|
| (1) 共通の画面の作り | 図が縮まない／解説のとき作業領域が板の上の 15〜18u しか無く fit の下限 0.8 では入らない／収まらないときに重ねて描く（スクロールさせない）／解説の図（表）を切る／解説の板の文字が幼児の最小（2.2u）を割る（2.1u）／正解の ○ が字の上／balance と auto-phrase の組み合わせ／数と助数詞・式の途中の改行／絵の選択肢の縦一列・聞く問題の選択肢の折り返し・書き起こしの細い列／sort の札の並び／SVG の最小の測り方（丸め・群の拡大率）／measure・numberline に最小の仕組みが無い／数の入力・実験の部品 | overlap-text・covered・out-of-stage・clipped・overlap-button・small-text・button-split・word-split の大部分 |
| (2) パックの文の長さ・数・図 | パックの SVG の字が最小の半分未満（2倍までの引き上げでは足りない）／選択肢・札・解説の文が長い／本文の図を札と同じ作業領域に置く | small-text（パックの SVG）・(1) のあとに残る分 |
| (3) 検査の誤検出 | 不透明な板・吹き出しの下に隠れた字を、板の字との overlap-text にも数える（covered と二重）／スクロールさせる枠（解説の板）の中を1行ずつ数える／分かち書きの「・」のあとの改行（JIS X 4051 で許される）／字の大きさの丸め（1.998u を 2u 未満とする）／自動スクロールの途中で測る（推定） | overlap-text 約 2 万画面・scroll-hidden（解説）1,306 画面・wakachi-split の一部・small-text の一部 |
| (4) 設計上受け入れる | 読解の本文の枠のスクロール（第1回の条件）／表・図のある解説の板の中のスクロール／書き起こしの枠のスクロール（条件つき）／text-on-figure（参考） | — |

### 2. 共通の直し（systemic。項目ごとにファイルを分ける）

#### R1 作業領域の並べ方と解説の板（UnitRunner・unit.css・DESINGN.md）

ファイル: `src/units/UnitRunner.tsx`、`src/units/unit.css`、`DESINGN.md`

1. **図を伸び縮みさせる**: 作業領域の中身が収まらないとき、まず図（`.unit__figure`）を縮め、足りない分だけ fit で全体を縮める。
   - fitNow の前に、図の自然な高さ `figH` と不足（`scrollHeight − clientHeight`）を測り、`--fig-max = max(min(figH, 12u), figH − 不足)` を `.unit__work` に書く。CSS: `.unit__work > .unit__figure { max-height: var(--fig-max, none); min-height: 0; }`、中の `svg`・`.fig-svg > svg`・`.fig-svgbox`・`img` は `max-height: var(--fig-max); width: auto; height: auto; max-width: 100%`。文字の図（fig-text・fig-table）は縮めない（2. の横並びか 4. のスクロール）。
   - 図の SVG の字は R6 の最小（svgText.ts）が引き上げる（図が縮んでも字は最小を守る）。
2. **横に並べる**: 図の自然な高さが空きの 45% を超え、かつ図の幅が作業領域の 55% 以下のとき（g2.math.box の箱・g1.math.position の棚・g1.ja.read-info/33 の本文の図）、`.unit__work[data-layout="side"]` にして `display: grid; grid-template-columns: minmax(0, auto) minmax(0, 1fr); align-items: safe center`、左に図・右にエンジンを置く。判定は fitNow の中（図の自然な寸法で。問題が変わったら戻す）。数の入力（`.unit__work--number`）・読解（もともと2列）・なぞり・かいてみようは対象外。
3. **fit の下限を状態で分ける**: 問題・ヒントは 0.8（押す所の最小 6u のため。今のまま）。**解説は 0.6**（解説では選択肢・札を押さない。押すのは「つぎへ」だけ）。文字は `--text-min` を下限にしたまま。
4. **それでも収まらないときは重ねずにスクロールさせる**: fit が下限でも `scrollHeight > clientHeight + 1` のとき、`.unit__work` に `data-scroll-region="work"`・`overflow-y: auto`・`justify-content: flex-start`（上そろえ）を付け、右下に「▼」の印（`data-scroll-cue`。解説の板と同じ形・右の余白）を出す。作業領域の外（下の帯・解説の板・吹き出しの下）へは描かない。検査はこれを1画面1件として残す（C2 の続き。パックの直しの手がかり）。
5. **解説の板**:
   - 左端を 12u → 4u（解説ではヒントのボタンを出さないので左下が空いている。幅 64u → 72u で行が減る）。右端（つぎへ の手前 24u）は今のまま。
   - 文字: `font-size: max(calc(var(--u) * 2.1 * var(--ts, 1)), var(--text-min))`（幼児の 2.2u を割っていた。small-text「span.rt 2.1u（最小 2.2u）」約 7,000 画面）。`.unit__explain-head` も同じ下限。
   - 解説の図: SVG の図だけ高さ 12u まで。表・文の図（`.fig-table`・`.fig-text` を含むもの）は `max-height: none; overflow: visible`（切らない）。板が 22u を超えたら今のとおり板の中でスクロールし ▼ を出す。
   - 板に `data-scroll-region="explain"` を付ける（検査が中の行を1行ずつ数えない。C2 の続き）。
6. DESINGN.md 5.1（作業領域: 図が先に縮む・横並びの条件・解説の fit 0.6・収まらないときのスクロールと印）、18章（解説の板の位置・文字の下限・図）、17章（R2 の改行・R3 の ○ の重ね順・R6 の最小の測り方）を、この項目の担当がまとめて書く（R2〜R8 の担当は DESINGN.md を触らない。必要な文はこの節を見て R1 が書く）。
- 減る見込み: out-of-stage（choice・order・sort・listen の span.rt・button）約 1.8 万画面の大半、解説の covered・overlap-text（板の下）の大半、clipped（explain-figure）約 2,500 → 0、small-text（解説の板 2.1u）約 7,000 → 0、overlap-button（選択肢と つぎへ）約 2,500 の大半。残りは work・explain のスクロール1件として出る（パックの直し）。
- 確かめ方: `#/dev/unit/g1.ja.punctuation/31?seeds=2&state=explain`（1536×864）・`g3.ja.proverbs/0?state=explain`・`g1.math.position/2`・`g2.math.box/1`（1536×864）・`g1.ja.read-info/33`・`g5.en.read-words/322?state=explain`・`p4.en.colors-numbers/0?state=explain` を 1280×620 と 1920×1080 でも開く。`MNW_UNITS=g1.ja.punctuation,g3.ja.proverbs,g1.math.position,g2.math.box,g1.ja.read-info,g5.en.read-words,p4.en.colors-numbers npm run check:text-layout`、`npm run test`（unitFlow）、`npm run check:design`。

#### R2 改行の規則（base.css・Rt）

ファイル: `src/styles/base.css`、`src/text/Rt.tsx`、`src/text/rt.css`、`src/text/rt-wrap.test.ts`

1. **小3以上の選択肢・札は balance をやめて pretty**: `.unit[data-stage]:not([data-wakachi]) :is(.choice, .tk-card__label, .eng-opts__label, .eng-choice__label) { text-wrap: pretty; }`（auto-phrase と balance の組み合わせは字の途中で折る）。分かち書きの段階（keep-all）は balance のまま。`th`・`td` は balance のまま（auto-phrase を付けていない）。
2. **数と助数詞・式を離さない**（Rt の表示だけ。読み上げ・plainText は変えない）:
   - 数字の並び＋直後の1字（空白・句読点・括弧でない字。「1字」「4音」「2つ」「7こ」「60分」）を `.rt-nobr` で包む（word-split「1／字目」「4／音」「7／こ」「60／分」。小3以上の解説で 35 単元）。
   - 空白を含まない式（数字・＋−×÷＝＜＞・括弧・□ が3字以上続くもの。「10＋4＝14」）を `.rt-nobr` で包む（wakachi-split「10＋4／＝14」）。
   - 1字ずつ「・」でつないだ並び（「き・つ・つ・き」「あ・い・う・え・お」）を `.rt-nobr` で包む（C5 は2字以上の語の「・」だけを許すので、1字の並びは画面の側で離さない）。
   - 10字を超える式・並びは包まない（行より長い nowrap ではみ出さないように）。
- 減る見込み: button-split 約 2,100 画面の大半、word-split 約 450 の大半、wakachi-split の式と1字の並び。
- 確かめ方: `#/dev/unit/g3.soc.safety/19`（1536×864。「みんながそろうまで、／ゆっくりまつ」）・`g3.ja.proverbs/38`・`g4.ja.read-feelings/15`・`g3.ja.dictionary/0?state=explain`・`g3.ja.haiku/4?state=explain`・`g1.math.add-carry/0?state=explain`・`g1.ja.word-play/32?state=explain`。`npm run test`（rt-wrap.test.ts に数＋助数詞・式・1字の並びの包み方を足す）。

#### R3 選択肢・聞く問題・ボタンの基本形（choice・listen・ui）

ファイル: `src/engines/choice/choice.css`、`src/engines/choice/choice.tsx`、`src/engines/listen/listen.css`、`src/engines/listen/listen.tsx`、`src/engines/listen/options.css`、`src/engines/listen/options.tsx`、`src/ui/ui.css`、`src/ui/Tap.tsx`

1. **正解の ○ を字の後ろに**: `.mark--correct { z-index: 0; }`、札・選択肢の中身（`.choice > :not(.mark)`・`.tk-card > :not(.mark)`）を `position: relative; z-index: 1`。○ の寸法は今のまま、字はその上に読める。誤答の ？ は今のまま（角に出る）。検査は `pointer-events: none` の ○ を拾わないので、画像で確かめる。
2. **ボタンの文字の下限**: `.tap` の文字を `max(…, var(--text-min))`（幼児の「こたえあわせ」「できた」2.1u。small-text 約 900 画面）。
3. **絵の選択肢は横一列**: 選択肢が絵・図だけ（文字の label が無い、または 4字以下）のときは、パックの `layout: 'column'` でも row にする（g1.math.numbers-10/4 のねこ3枚）。横に入らないときは絵を `min(既定, (作業領域の幅 − 間隔) ÷ 数)` に縮める。
4. **聞く問題の並び**（listen）:
   - 選択肢は折り返さない（`flex-wrap: nowrap`、各 `flex: 0 1 auto; min-width: 0`）。絵・時計の選択肢は幅 `min(既定, (作業領域の幅 − きくの札 − 間隔) ÷ 数)` に縮める（g4.en.time-days/14）。
   - 選択肢に絵があるときは、「きく」の札を選択肢の上の段（補助の寸法 5.5u）に置く（左の列に置くと選択肢の幅が足りない）。
   - 解説の書き起こし（`eng-listen__transcript`）は「きく」の札の下の細い列に置かず、作業領域の幅（60u まで）の段にして選択肢の上に置く。高さは本文の4行以上・空きまでとし、入らない分は枠の中でスクロール（`data-scroll-region="transcript"` と ▼ の印）。第1回の「高さの上限を外す」は、細い列で縦に伸びて解説の板の下に出ていた（g2.ja.culture/22）ので改める。
- 減る見込み: out-of-stage（listen の opt・text）約 1,600 画面、covered（listen の解説・吹き出し）約 2,000、small-text（tap）約 900、overlap-button（listen の opt と つぎへ）約 500、orphan「ボールあそ／び」（細い列）。
- 確かめ方: `#/dev/unit/g4.en.time-days/14?state=h3`（1536×864）・`g3.en.numbers-colors/30`・`g2.ja.culture/22?state=explain`・`g1.ja.listen/14?state=explain`・`g1.math.numbers-10/4?state=h1`・`p5.ja.word-build/0`・`g3.ja.proverbs/0?state=explain`。choice・listen のテスト。

#### R4 札のエンジン（order・sort・match・fill・build）

ファイル: `src/engines/order/shared.css`、`src/engines/order/shared.tsx`、`src/engines/order/order.css`、`src/engines/order/order.tsx`、`src/engines/sort/sort.css`、`src/engines/sort/sort.tsx`、`src/engines/match/match.css`、`src/engines/match/match.tsx`、`src/engines/fill/fill.css`、`src/engines/fill/fill.tsx`、`src/engines/build/build.css`、`src/engines/build/build.tsx`

1. **sort の「こたえあわせ」を下の帯へ**（S3 の 4. と同じ位置。つぎへ の左）。札の列は作業領域の幅いっぱいを使い、文の札が6枚以上で幅が足りるとき（札の幅 ≥ 24u）は3列（g4.ja.idioms/110 は今2列＋右に空き 22u）。
2. **sort のふた**: 札が入るまでは高さ 5.5u（補助の寸法）。入った札が増えたら伸びる（今は空のまま 9u）。
3. 札の中の文字は `--text-small`（縮む --u）にそろえる（`tk-card__label` を固定の u で書いている所を直し、R1 の fit で一緒に縮むように）。解説・ヒントで札の列が作業領域を越えるものは R1 の fit（解説 0.6）とスクロールに任せる。
4. `.tk-slot`・`.tk-badge` が作業領域の外に出ない（g1.ja.read-info/33 の「2」）: 番号の列と札の列を同じ格子に入れ、札と一緒に縮む。
- 減る見込み: g4.ja.idioms・g4.ja.write-report・g5.ja.write-fact-opinion・g6.ja.write-opinion の out-of-stage（span.rt・tk-card・tk-slot）約 4,000 画面の大部分、overlap-button（lid と つぎへ）64。
- 確かめ方: `#/dev/unit/g4.ja.idioms/110`（1280×720）・`g2.ja.write-structure/0?state=explain`・`g6.ja.write-opinion/0?state=explain`・`g3.sci.circuits/6`・`g1.ja.read-info/33`（R1 の横並びと合わせて）。order・sort・match のテスト。

#### R5 読解（本文の枠・右の列）

ファイル: `src/engines/reading/reading.css`、`src/engines/reading/reading.tsx`

1. 本文の枠の見える高さを「本文の4行＋0.3行」以上にする（clipped「枠の見える高さが本文の4行未満（3.9行）」g1.ja.folktales/29・g2.ja.read-story/9、1536×864）。
2. 右の列の選択肢が収まらないとき（列の scrollHeight > clientHeight）: 本文:右 の比を 1.5:1 → 1:1 にし、選択肢の上下の余白を 1u → 0.6u に。右の列はスクロールさせない（第1回の条件）。それでも入らないものはパックの直し（引用の文が長い選択肢）。
3. 「▼ つづき」「▲ はじめから」の段（`eng-reading__cue`）が本文の字に重なるという報告（covered「span.rt の上に button[reading-cue]」g1.ja.folktales/5 ヒント②・g1.ja.read-story/0 ヒント①）は、開き直すと再現しない。ヒントの自動スクロールの途中で測った可能性が高いので C6 と合わせて確かめ、待っても重なるなら印の段を枠の外（下）に出す。
- 減る見込み: overlap-button（読解の選択肢と つぎへ）約 1,000 画面・covered（読解の選択肢と吹き出し）約 550、clipped（本文の枠 3.9 行）。
- 確かめ方: `#/dev/unit/g4.ja.read-summary/5`（1536×864）・`g1.ja.read-info/11?state=h2`・`g1.ja.folktales/29?state=explain`・`g1.ja.folktales/5?state=h2`（1280×620）。

#### R6 図の文字の最小の測り方と、最小の仕組みの無いエンジン（figure・measure・numberline・graph・map）

ファイル: `src/engines/figure/Figure.tsx`、`src/engines/figure/figure.css`、`src/engines/figure/svgText.ts`、`src/engines/measure/measure.css`、`src/engines/measure/measure.tsx`、`src/engines/numberline/numberline.css`、`src/engines/numberline/numberline.tsx`、`src/engines/numberline/numpad.css`、`src/engines/numberline/NumPad.tsx`、`src/engines/graph/graph.css`、`src/engines/graph/graph.tsx`、`src/engines/map/map.css`、`src/engines/map/map.tsx`

1. **liftSvgText は字ごとの拡大率で測る**: 今は svg の CSS の寸法 ÷ viewBox で1つの拡大率を出しているが、`<g transform>` の中の字は実際の拡大率が違う（g2.prog.debug/8: 23.4 に引き上げても 1.82u）。各 `<text>` の `getScreenCTM()` の拡大率（a と d の小さいほう）で px を出して引き上げる。
2. **useSvgTextFloor の丸めを切り上げに**（`Math.round` → `Math.ceil`。g1.math.numbers-10 の 1.998u・g4.soc.prefectures の 1.7u）。
3. **measure・numberline に最小を入れる**（今は仕組みが無い）: `useSvgTextFloor` と `floorStyle` で、目盛りの数字・単位（「ます」「dL」「0」）を `max(既定, floor)` に（g1.math.compare-quantity・g2.math.volume 1.6u・g3.math.weight 1.6u・p5.math.measure-compare 2.1u）。目盛りが重なるときは1つおきに間引く。`.mnp-key--ok`（numpad.css）の文字も `--text-min` を下限に。
4. **図の表示範囲の外の字**（clipped「text ⊂ svg」: g1.math.numbers-10「0」・g4.math.rounding「3420」・g3.soc.map-symbols「きた」・g2.math.time「？」）: liftSvgText の widenToText（viewBox を字の外接まで広げる）を Figure の数直線・時計の図・map の SVG にも使う（今はパックの SVG だけ）。
5. **10の棒のまとまりを横に**（g2.math.mult-beyond/2・g2.math.mult-meaning: 3まとまりが縦に並び図が 30u を超える）: Figure の Blocks でまとまりを横に並べ（`flex-direction: row; flex-wrap: wrap`）、入らないときだけ折り返す。原因が Blocks でなくパックの figure の `column` なら、そのパックを第3回の content に回す。
6. グラフの横軸の札（`button.gr-xlabel`「オートバイ」が枠 8.6u の外に出る。text-outside-box）: S6 の「縮める→2段」を `button` の札にも使う。
- 減る見込み: small-text（エンジンの SVG の字。choice・number・measure・map・graph の 1.6〜1.9u）約 1.2 万画面、clipped（text ⊂ svg）約 1,300、out-of-stage（棒の図・回答欄）約 1,000。パックの SVG で 2倍を超えて小さいもの（5. の content）は残る。
- 確かめ方: `#/dev/unit/g2.prog.debug/8`・`g1.math.numbers-10/0`（1920×1080）・`g1.math.compare-quantity/4`・`g2.math.volume/0`・`g3.math.weight/2`・`g2.math.mult-beyond/2?state=explain`・`g3.math.bar-graph/7`（1536×864）・`g4.soc.prefectures/0?state=explain`（1280×620）。graph・map・numberline・measure のテスト。

#### R7 数の入力（number）

ファイル: `src/engines/number/number.css`、`src/engines/number/number.tsx`

1. 回答欄の札「1ばんめの こたえ から」（`.eng-number__box`）が作業領域の下に出る（g2.math.mult-beyond/2・g2.math.mult-meaning/1）: 札を回答欄の中の上の段（1行・`--text-min`）にし、回答欄の高さに含める。
2. 数字キーの区画がヒント②③で「つぎへ」に重なる（overlap-button numkey と tap--main、g2.math.mult-beyond/2・g2.math.mult-meaning/2）: 区画の高さを作業領域の高さまでにする（`grid-row: 1 / span 2` のまま `max-height: 100%`、キーの寸法は第1回 S7 の式）。
3. 筆算の表の見出し（「じゅう」「ひゃく」）の文字を `max(…, var(--text-min))`（fit 0.8 で 1.9u になる。g2.math.add-column・g2.math.add-sub-3digit・g3.math.mult-2digit。small-text 約 1,650 画面）。
- 確かめ方: `#/dev/unit/g2.math.mult-beyond/2?state=h2`（1280×720）・`g2.math.mult-meaning/2`・`g2.math.add-column/1`（1536×864）。`number.render.test.tsx`。

#### R8 実験（experiment）

ファイル: `src/engines/experiment/experiment.css`、`src/engines/experiment/experiment.tsx`、`src/engines/experiment/Apparatus.tsx`

1. 結果の札（`.exp-card`、16u×16u）の文が札の外に出る（text-outside-box: g3.sci.light-sound/12・g4.sci.rainwater/10・g5.sci.flowing-water/26・g5.sci.germination/11 の解説）: 札の高さを中身で決める（`height: auto; min-height: 16u`）。
2. 結果の表の見出し（`th`「水の／量」g5.sci.dissolve 340 画面）は `white-space: nowrap`、表が入らないときは表の文字を縮める（figure の useFitWidth を import して使う）。`exp-factor__label`（「集めた 光の／円」）は小3以上で balance をやめて pretty（R2 と同じ理由）。
3. てこの装置（g6.sci.lever）の目盛りの数字 1.3u・「30g」1.4u: Apparatus の SVG の字を `useSvgTextFloor` で最小に（引き上げで重なる目盛りは間引く）。`.mk-btn--ok`（p5.env.predict「やってみる」1.9u）は `--text-min` を下限に。
- 確かめ方: `#/dev/unit/g3.sci.light-sound/12?state=explain`・`g5.sci.dissolve/1`（1536×864）・`g6.sci.lever/9`（1536×864）・`p5.env.predict/1`。experiment のテスト。

### 3. 検査の誤検出として直すこと（checkerChanges）

ファイル: `e2e/helpers/text-layout.ts`、`e2e/text-layout.tl.ts`、`e2e/text-layout-probe.tl.ts`（見本を足す）、`docs/test-plan.md`（3.2 に理由を書く）

- **C3 隠れた字との overlap-text（covered と二重）**: 解説の板・吹き出し（不透明の背景）の下に隠れた選択肢の字を、板の字と「重なった」としても数えている（g1.ja.punctuation/31: 同じ所を covered「span.rt の上に div.unit__explain」と overlap-text「span.rt と span.rt」の両方で出す）。**直し方**: 重なりの中心で `elementsFromPoint` を見て、片方の字を含む要素のうち不透明な背景（`background-color` の alpha が 1）をもつものが、もう片方の字を含まずに手前にあるとき、その組は overlap-text に数えない（隠れたことは (8) の covered で出ている）。両方とも見えている字の重なり（同じ層の字どうし・透明な枠どうし）は今どおり出す。プローブに「不透明な板の下の字」（overlap-text に出さず covered に出す）と「透明な枠どうしの重なり」（出す）の見本を足す。
- **C2 の続き（スクロールさせる枠を1件にまとめる）**: `data-scroll-region` の枠の中の字は1行ずつ数えない（第1回）。今回 R1・R3 が付ける `explain`（解説の板）・`work`（収まらない作業領域）・`transcript`（書き起こし）も同じ扱いにする。ただし **`work` と `explain` は印があっても枠につき1件を残す**（`scroll-hidden`、「作業領域が N u 足りずスクロール」「解説が板に N 行分 入らずスクロール」）。この2つは設計で受け入れたスクロールではなく、パックの文・図を短くする手がかりなので消さない（1行ずつ数えると件数が文の長さに比例して膨らむだけ）。`passage`・`strip`・`transcript` は今どおり印が無いときだけ出す。
- **C5 分かち書きの「・」のあとの改行**: 「がいこくの くに・／まち・ひとの なまえ」「ひこうき・／じてんしゃ」を wakachi-split にしている（g2.ja.katakana-words 165 画面ほか）。中黒（・）のあとは JIS X 4051 で改行してよい位置で、語と語の区切り。**直し方**: 改行の直前が「・」で、「・」の前後の部分がどちらも2字以上なら数えない。1字の並び（「き・つ・つ・き」）は今どおり出す（R2 で画面の側が離さない）。
- **C7 字の大きさの丸め**: 1.998u（最小 2u の 99.9%）を「1.9u（最小 2u）」と出している（g1.math.numbers-10）。**直し方**: 最小の 1% までの差（px の丸め・SVG の拡大率の誤差）は数えない。表示は小数2桁まで出す。1% を超えるものは今どおり出す。
- **C6 測る前にスクロールが止まるのを待つ**（推定。R5 の 3. と一緒に確かめる）: ヒント・解説で読解の本文を自動でスクロールする（scrollIntoView）間に測ると、印の段と本文の字の位置がずれて covered になる。`settle` で、スクロールできる要素の scrollTop が2フレーム続けて変わらなくなるまで（1秒まで）待つ。g1.ja.folktales/5（ヒント②、1280×620）を検査で再現し、待つと消えることを確かめてから入れる（消えなければ R5 の不具合として残し、この変更は入れない）。
- 緩めないもの: covered・out-of-stage・clipped の判定、small-text の最小（1% の丸めだけ）、overlap-text の閾値（同じ層の字どうし）、分かち書きの1字の並び。

### 4. 受け入れるもの（accepted）

- 読解の本文の枠のスクロール（第1回の条件: 印・スクロールバー・4行以上・右の列はスクロールしない）。
- 解説に表・図があり、板が 22u を超えて板の中でスクロールするもの（g5.en.read-words の対応表など）: 板に ▼ の印があり、文は上そろえで上から読める。検査には C2 の1件として残るが、第3回の content の対象にしない。図の無い解説が板に入らないものは content（文を短くする）。
- 書き起こし（listen の解説）の枠の中のスクロール: R3 の 4. の条件（4行以上・印）を満たすもの。
- text-on-figure（参考。319 件・1,197 画面）: ふりがな・吹き出しが図の上にかかるもの。R1 の図の伸び縮み・横並びのあとに残ったものだけ第3回で見る。

### 5. 次の回（第3回）に回すもの（content）

共通の直し（R1〜R8）で図の伸び縮み・解説の fit 0.6・スクロールへの切り替えが入ると、作業領域のはみ出しは「work のスクロール1件」に変わる。第3回はもう一度 `MNW_FRESH=1 npm run check:text-layout` を流し、残った work・explain のスクロールの件と small-text をパックごとに直す。いま見えている候補:

- **パックの SVG の字が最小の半分未満**（liftSvgText の2倍の引き上げでは足りない。図の viewBox・font-size・図の高さを直す）: prog-g16（g4.prog.prefecture-finder 0.4〜0.7u・g6.prog.sensor・g6.prog.efficient・g2.prog.debug。`kit.ts` の gridFigure の字と hU）、g4-math（area・quadrilaterals・cuboid）、g5-math（area-formulas・congruence・angle-sum・speed・per-unit・percent・polygon-circle）、g6-math（scale・approx-area・prism-volume・circle-area・fraction-mult）、soc-g56（world の ①）、en-g34（directions の「スタート」1u）、g1-math（sub-basic の 0.9u）、p5（think.pattern）。
- **文の札・選択肢が長い**: g6-ja（write-opinion・read-argument・info-relations・read-literature）、g4-ja（write-report・idioms・read-summary・info-compare）、g5-ja（write-fact-opinion・read-gist・read-relations・figurative・classics・spoken-written）、g3-ja（write-reasons・proverbs・read-paragraphs）、soc-g34（city-changes・safety）。読解の「中心となる文はどれ」は、引用の文でなく「⑤の 1文め」等の短い札にする案も含めて検討。
- **本文の図を札と同じ作業領域に置く問題**: g1.ja.read-info/33（R1 の横並びで足りなければ、本文を読解のエンジンに移す）。
- **解説が板に入らない（図なし）**: g4.ja.idioms・g3.ja.proverbs・g2.life.town・g2.math.add-column・g3.ja.romaji など（第3回の結果で一覧にする）。

### 6. 第2回の実施とレビュー（2026-10-31）

R1〜R8・C2 の続き・C3・C5・C7 を実装した（C6 は待っても同じ covered が出たので入れていない。docs/test-plan.md 3.2）。設計から変えたところと、レビューで直したところ:

- R1: 作業領域を枠にする（`data-scroll-region="work"`）と、choice・listen の複数選択の「こたえあわせ」（`position: absolute; bottom: -12u`）が枠の中に入って切れ、押せなかった（g1.ja.listen/12）。sort と同じく `position: fixed`（基準は transform を持つ舞台）にして、作業領域の高さにも数えないようにした（fit も不要に 0.8 まで縮んでいた）。
- R1: 数の入力は作業領域を枠にしない・図を `--fig-max` で縮めない（足りないのは縮まない数字キーで、枠にするとキーの「こたえあわせ」が切れ、図だけが不要に小さくなった。g2.math.mult-beyond/2 ヒント②）。
- R1: fit の比で縮めても数 px 残るときは 0.02 ずつ下限まで試す。0.5u 以下の不足は枠にしない。測り直しでスクロールの位置を戻す。枠の上の余白 1.4u（ふりがな・番号の丸が枠の上で切れていた）。
- R1: 図の中の SVG・画像の `height: auto`・`max-height` は縮めるとき（`data-fig-fit`）だけにした（いつも付けると CSS で高さを決めた図の形が変わる）。
- R3: ○ を字の後ろにする z-index は作業領域の中だけにした（幼児ホーム・v1 モードの選択肢の字が z-index の無い重ね物より上に出るのを防ぐ）。番号の丸は除く。
- R3: 解説で時計など絵が3つ以下のとき、左の列の書き起こしが列の高さに縛られず伸びていた（g2.ja.culture/30 で作業領域が 45u 足りない）。列を行の高さまでにし、札の分を4行の下限に足した。
- R6: 時計の時の数字は、となりと入らないほど混み合うとき 12・3・6・9 だけにした（17章の規約どおり。g4.en.time-days/15 の「10・11・12」の重なり）。図の表・文（m）・テープ・数直線の札の字に `--text-min` の下限を付けた（解説の fit 0.6 で 1.45u になっていた。g6.sci.lever/4）。
- R8: てこの目盛りを間引くとき、おもりを下げた位置の数字は残す（問題文が「2の 位置」と言うのに 2 が消えていた）。
- DESINGN.md に R3〜R8 の規約（sort の列とこたえあわせ、番号の丸、数の入力の札、読解の data-tight と行間 1.8、図・実験の最小）を書き足した。

第3回に残るもの: g2.math.box/1（縦長の面の選択肢4つで作業領域が約 4 倍。選択肢の図・文の直し）、g2.math.mult-meaning（●のアレイの図が大きく問題文に重なる。図の size の直し）、g1.ja.read-info/33 の order の「こたえあわせ」が作業領域の枠の下（order・match・fill・build の こたえあわせ も帯へ移すか）、g4.ja.read-summary の右の列のはみ出し、g2.math.time の clock エンジンの「？」、番号の丸が ふりがなに重なる covered（g3.ja.proverbs/35・g4.ja.idioms の解説）。

## 第3回（2026-10-31・分析と設計）

### 0. 元の結果と、追加で測ったもの

- 元: 第2回の直し（808b9a9）のあとに流し直した `docs/screenshots/text-layout-report/`（308 単元・9,741 問・186,780 画面。全件は `.cache/text-layout/units/`）。件 2,471・画面の延べ 29,412（前回は件 22,568）。違反のない単元 109 / 308。
  画面の延べの多い順: small-text 11,348・scroll-hidden 9,439・button-split 2,649・covered 2,627・overlap-text 1,214・clipped 1,116。
- 全件を「種類 × 要素 × 説明」でまとめ直した（`.cache/text-layout/units/*.json` の rows）:
  - small-text の 85%（9,646）は SVG の `text`（47 単元）。大半はパックの SVG で、字が最小の 0.1〜0.7 倍（g4.prog.prefecture-finder 3,696・g6.prog.sensor 1,800・g6.soc.world 800・g6.prog.efficient 480・算数 g4〜g6 の図 約 1,700）。
  - scroll-hidden の 89%（8,397）は「作業領域が N u 足りずスクロール」（第2回の R1 の枠）。不足は 2〜4u が 1,835・4〜8u が 2,508・8u 超が 3,980。2〜3u で揃っているもの（g1.life.home・seasons・growth・animals の 2.9〜3.2u、g1.prog.sequence の 2.6〜2.8u、g2.math.triangles-quads の 2.3u、p23.ja.picture-book の 3.2u）はエンジンの部品が原因。残りの 1,009 は「解説が板に N 行分入らず」（39 単元）。
  - button-split 2,649 のうち 1,171 は「空白でない所で改行」、1,478 は「語の途中」（Intl.Segmenter）。前者のうち 1,011 は小4の `eng-choice__label`（g4.ja.write-report・info-compare など。ラベルの中に「森川 はるか」のような空白が1つあるもの）。
- 代表例を開発サーバー（127.0.0.1:4347、`MNW_DEV_NO_HMR=1`）で開き、同じ `inspectText` で測って撮影した（約 40 画面）。分かったこと:
  - **パックの SVG の大きさ**: `figure.css` の `.fig-svg svg:not([width]) { width: 23u }` で、viewBox の大きさに関係なく幅 23u で描いている。g6.math.scale/0 は viewBox 幅 620・字 16 で 0.59u、g4.prog.prefecture-finder/0 は viewBox 幅 506・字 12 で 0.44u（作業領域の幅 90u のうち 23u しか使っていない）。liftSvgText は 2 倍までしか引き上げないので残る。
  - **数の入力の左の列**: 図（表・10の棒・テープ）が縮まない。格子が中央そろえなので、図が上へはみ出して問題文に重なり、下は回答欄に重なる（g3.math.mult-2digit/5、g4.math.two-way-table/1 の 12 行の表、g1.math.numbers-120/0、g4.math.ratio-intro/0、g1.math.add-sub-2digit/4 の解説）。テープの図は、列の幅が内容の幅まで縮むので幅 10u になり、「18ページ」が切れる。回答欄が5つ（「一万のくらい」など）あると2段に折れる。
  - **作業領域の中の主操作**: 次のボタンが作業領域の中にある。
    - explain エンジンの「できた」
    - program の「もどす・けす・うごかす」の段
    - geometry・order・match・fill・build・experiment の「こたえあわせ」
    
    これらは 2〜3u 足りずに枠でスクロールし、ボタンが下で切れる（g1.life.home/13・g1.prog.sequence/22・g2.math.triangles-quads/0）。下の帯の右（つぎへ の左）は、問題とヒントのあいだ空いている。第2回で帯に移ったのは、choice・listen の複数選択と sort だけ。
  - **選択肢の文字**: `.eng-choice__label` は学年によらず 3.2u で、小3以上の問題文（2.4u・2.2u）より大きい。長い文の選択肢が2×2の格子で3〜4行に折れ、作業領域に入らない（g4.ja.write-report/22・g3.sci.weight/19）。解説の fit 0.6 では 1.92u になり、幼児の最小 2.2u を割る（p5.math.shapes・p23.math.shape-match・p5.think.pattern の解説）。
  - **聞く問題**:
    - 絵＋5字以上の文の選択肢3つが「きく」の札の右に入らず、2段に折れる（g6.en.past/4・g6.en.future・g6.en.places・g5.en.where。作業領域が約 11u 足りない）。
    - 絵が3つ以下のとき、書き起こしは左の 28u の列に置くので1行 9字に折れ、「。」が行頭に来る（kinsoku-start。p5.ja.story-listen/15・p23.ja.picture-book/0）。
    - 書き起こしの字には `--text-min` の下限が無く、1.92u になる（p23・p4・p5 の解説で約 470 画面）。
  - **order の端の札**: `order.tsx` の `{endLabel(pos) ?? pos + 1}` がパックの文字を Rt に通さないので、「終《お》わり」と《》の記法のまま出る（g5.ja.write-fact-opinion・g6.ja.write-opinion）。sci-g34 の `ends`（大《おお》きい・明《あか》るい・春《はる》など）も同じ。検査はこの種類を見ていない。
  - **match の正解の ○**: 解説で左の札の字の上に大きな ○ が重なり、字が読めない（g3.ja.proverbs/35）。検査は `.mark` を「意図した重ね」として飛ばすので、数に出ていない。番号の丸（`.tk-badge`）も札の左上でふりがなに重なる（covered「rt の上に span.tk-badge」147 画面）。
  - **読解**:
    - 「▼ つづき」の段（`eng-reading__cue`）の高さが 1.7〜2u しかなく、字（2.2u 以上）が枠の外に出る（text-outside-box 242 画面・10 単元。聞く問題の `eng-listen__cue` も 24 画面）。
    - 右の列の選択肢4つ（引用の文で各2〜3行）が入らず、ヒントのときに吹き出しや つぎへ の下に入る（g4.ja.read-summary/21・g5.ja.read-gist/29。overlap-button 32・covered 124）。
  - **解説の板**: 図（SVG・10の棒・絵）を文の下の段に置くので、文が1〜2行でも板が 22u に達する（g1.math.add-carry/0 は 0.3 行入らない。g5.en.where/0 は英文が図の下で見えない）。図の右は空いている。
  - **sort の箱の名前の図**: p23.think.sort の箱の色の丸（`.eng-sort__name` の図）が ふた（5.5u）より大きく、上下が切れる（clipped「svg ⊂ span.tk-card__fig」304 画面）。
  - **改行**:
    - `Rt.tsx` の nobr のまとまり（ふりがな付きの語と前後の1字）が「、」で始まると、その前で折れて「、」が行頭に来る（g3.ja.proverbs/44「…のに／、相手は」。`<span class="rt-nobr">、<ruby>相手</ruby>は</span>`）。
    - 小3以上の図の文（`.fig-text`）は keep-all なので、空白の無い文が1つの語になり、`overflow-wrap: anywhere` で好きな所で折れる。
- 検査の側で再現したこと:
  - **描き直しの途中で測る**: 検査の設定の `reducedMotion: 'reduce'` で、1920×1080 から 1280×620 に変えて2フレーム後に測ると再現した。SVG の字の下限（`useSvgTextFloor` の React の状態）が前の画面の値のまま1フレーム残り、目盛りの数字が 11u の高さで重なる（g1.math.numbers-10/0 で overlap-text 20 件）。600ms 後には消え、撮った画像も正常。g5.math.speed の「0.06u」（1280×620 だけ）も同じ原因。reducedMotion なしでは再現しない（アニメーションを待つ間に描き直しが終わるため）。1280×620 だけに出る違反は 539 画面ある。
  - **読解の本文の枠の下端**: ヒント③（1920×1080 から 1280×720）で、枠の下端で半分切れた行の字を「印の段（reading-cue）に隠れた」と数える（g1.ja.read-story/3。600ms 後も残る）。印の段は枠の外（下）にあり、字は枠で切れているだけ。第2回の C6（スクロールが止まるのを待つ）で消えなかったのはこのため。
  - **ボタンの上の飾り**: sort の ふたは文字の無いボタン（aria-label だけ）で、その上に色の丸（`pointer-events: none`）がある。検査は重なりを調べるとき pointer-events を全部有効にするので、丸を「ふたを隠すもの」と数える。丸はふたの枠で切れているが、切れる前の外接がふたより大きいので、「ボタンより小さい札」の例外に入らない。
- 開発用の EngineGallery と React の key（第1回 S9）:
  - `src/App.tsx` は `import.meta.env.DEV` のときだけ lazy で読み込んでいる。
  - `src/illust/content/life-g12.tsx` の leafShape の key は `${x}-${y}-${rot}` のまま。
  - 今回の検査の pageerror は 0 件で、変えるものは無い。確かめ方は、2. の各項目の build のあとに `dist/assets` に EngineGallery の chunk が無いことを見る。

### 1. 原因の分類（第3回）

| 分類 | 内容 | 主な種類（画面の延べ） |
|---|---|---|
| (1) 共通の画面の作り | パックの SVG を幅 23u に固定／数の入力の左の列が縮まず上下にはみ出す／主操作のボタンが作業領域の中／選択肢の文字が学年によらず 3.2u・長い文の並び／聞く問題の絵の選択肢の折り返しと書き起こしの細い列／order の端の札が Rt を通らない／match の ○ と番号の丸／読解・聞く問題の「▼ つづき」の段の高さ／解説の板の図を文の下に置く／sort の名前の図が ふたより大きい／nobr のまとまりが行頭禁則の字で始まる・小3以上の図の文が keep-all | small-text 約 9,000・scroll-hidden 約 3,500・covered 約 1,300・overlap-text 約 600・button-split の一部・text-outside-box 266・clipped 約 700・kinsoku-start 約 60 |
| (2) パックの文の長さ・数・図 | 書く単元の札・選択肢の文が長い（g6.ja.write-opinion・g4.ja.write-report・g5.ja.write-fact-opinion ほか）／12 行の表（g4.math.two-way-table）／回答欄5つ＋表（g3.math.mult-2digit）／図の viewBox が字に比べて極端に大きい（(1) のあとに残る分） | scroll-hidden の残り（不足 8u 超の 3,980 の大半）・small-text の残り |
| (3) 検査の誤検出 | 描き直しの途中で測る（C8）／スクロールの枠の下端で切れた字を、枠の外の要素に隠れたと数える（C9）／`pointer-events: none` の飾りがボタンを隠すと数える（C10）／小3以上のラベルに空白が1つあるだけで分かち書きとみなす（C11） | overlap-text・small-text・covered の約 540（C8）・covered 約 300（C9）・covered 304（C10）・button-split 約 1,000（C11） |
| (3') 検査の見落とし（足す） | 《》の記法がそのまま出る（C12）／正解の ○ が字の上（`.mark` の例外を狭める。C13） | 新しく出る（数百画面の見込み） |
| (4) 設計上受け入れる | 読解の本文の枠・命令の列・書き起こしの枠のスクロール（印あり）／表・図のある解説の板の中のスクロール／text-on-figure（参考） | — |

### 2. 共通の直し（systemic。項目ごとにファイルを分ける）

#### T1 作業領域・下の帯の主操作・解説の板（UnitRunner・unit.css・DESINGN.md）

ファイル: `src/units/UnitRunner.tsx`、`src/units/unit.css`、`DESINGN.md`

1. **下の帯の主操作の共通の形**: `unit.css` に `.unit .eng-check` を定義する。
   - 値: `position: fixed; right: 21.5u0; bottom: 2u0; min-width: 14u; max-width: 17.5u0; font-size: max(2.4u, --text-min); z-index: 4`。舞台の `--u0` で置く。
   - 理由: 今は `choice.css`・`order/shared.css` にだけある。エンジンの CSS は単元の種類ごとに読み込まれるので、他のエンジンが同じクラスを付けても効かない。
   - 吹き出しを避ける `:has(.eng-check)` は今のまま。T3・T4・T6 はボタンに `eng-check` を付けるだけにする（エンジンの CSS の重複は残してよい）。
   - 主操作が複数あるエンジン（program の「もどす・けす・うごかす」）用に `.unit .eng-band` も足す。同じ位置に横に並べる箱で、幅は吹き出しの右端 39u までに入る 24u まで（`display: flex; gap: 1.6u`）。
2. **解説の板の図を文の右に**: 次のどちらも満たすとき、板を3列（見出し｜文｜図）にする。図は幅 `min(30%, 24u)`・高さ 12u まで。
   - 解説の図が SVG・絵・10の棒（`.fig-svg`・`.fig-illust`・`.fig-blocks`・`.fig-column`）である。
   - 文が板の幅で3行以下である。

   表・文の図（`.fig-table`・`.fig-text`）と、図が板の幅の 40% を超えるものは今のまま下の段に置く。判定は UnitRunner の板の測り（`--panel-h` を書く所）で行い、図の自然な幅と文の行数から `data-fig-side` を付ける。
   - 減る見込み: 解説の板のスクロール 1,009 のうち、図のある単元（g1.math.add-carry・g5.en.where・g6.en.*・g5.en.listen-self・g2.math.times-tables・p5.env.predict など）の約 600。解説の図が板の下で切れる clipped（text ⊂ svg の解説の分）も減る。
3. **DESINGN.md**: 次の章を、この項目の担当がまとめて書く。T2〜T8 は DESINGN.md を触らない。必要な文はこの節を見て T1 が書く。
   - 5.1: 主操作は全エンジンで下の帯に置く（`.eng-check`・`.eng-band`）。
   - 17章: T2 のパックの SVG の大きさ、T3 の選択肢の文字と聞く問題の並び、T4 の端の札・○・番号の丸、T5 の印の段、T7 の数の入力の左の列、T8 の改行。
   - 18章: 解説の板の図の位置。
- 確かめ方:
  - 開く画面: `#/dev/unit/g1.math.add-carry/0?seeds=2&state=explain`（1920×1080）・`g5.en.where/0?state=explain`（1280×720）・`g2.math.times-tables/2?state=explain`・`g3.ja.proverbs/0?state=explain`（文だけの解説が今のままであること）。
  - コマンド: `npm run test`（unitFlow）、`npm run check:design`。

#### T2 パックの SVG の大きさと図の部品（figure）

ファイル: `src/engines/figure/Figure.tsx`、`src/engines/figure/figure.css`、`src/engines/figure/svgText.ts`

1. **パックの SVG を viewBox と字の大きさから描く**: `PackSvg` で、描いたあとに次の値を測る。
   - viewBox の幅 `vbW`
   - `<text>` の font-size の最小 `f`（viewBox の単位。`<g transform>` の中は、第2回の字ごとの拡大率で換算する）

   字が `--text-min × 1.05` になる幅 `w = vbW × (textMin × 1.05) ÷ f` を求め、svg の幅を `min(w, 親の幅)` にする。`--fig-w` を `.fig-svg` に書き、CSS は `.fig-svg :where(svg:not([width])) { width: var(--fig-w, 23u) }` とする。
   - 高さは今のとおり viewBox の比で決まる。
   - 図が縮む（R1 の `--fig-max`）ときは今のまま縮み、足りない分は liftSvgText（2 倍まで）が引き上げる。
   - 字の無い図と、字が十分大きい図は 23u のまま（`w < 23u` なら 23u）。
   - width を書いた SVG（パックが寸法を決めた図）は変えない。
   - 例:
     - g6.math.scale/0（vbW 620・f 16・小6 の最小 1.7u）: 幅は約 69u。作業領域の左の列（約 55u）に入れると字は 1.42u で、liftSvgText が 1.7u に上げる。
     - g4.prog.prefecture-finder/0（vbW 506・f 12・小4 の最小 1.8u）: 幅は約 80u で、字は 1.8u。
2. **テープの図の幅**（`.fig-tape`）: 親が内容の幅になる所（数の入力の左の列）では 10u まで縮み、「18ページ」が切れる（g4.math.ratio-intro/0 の clipped 60 画面）。`width: min(100%, 48u)`・`min-width: min(100%, 30u)` にする。
- 減る見込み:
  - small-text（text）9,646 のうち、パックの SVG の分の約 8,500（prog-g16、soc-g56 の world、算数 g4〜g6 の util の svg、en-g34 の directions、p5 の pattern、soc-g34 の disaster）。
  - overlap-text（text と text）のうち、g4.prog.prefecture-finder の解説の 284。
  - clipped（text ⊂ svg）の一部。
  - 2 倍を超えて小さいまま残るものは、第4回の content で直す。
- 確かめ方:
  - 開く画面: `#/dev/unit/g6.math.scale/0`・`g4.prog.prefecture-finder/0`・`g6.prog.sensor/22`・`g6.soc.world/0`・`g6.math.approx-area/18`・`g4.en.directions/35?state=explain`（1920×1080）・`g4.math.ratio-intro/0` を4つの画面サイズで開く。図が作業領域を越えるときは、R1 の縮み・スクロールになること。
  - テスト: figure のテスト（`figure.render.test.tsx` があれば、幅の計算の単体テストを足す）。

#### T3 選択肢と聞く問題（choice・listen）

ファイル: `src/engines/choice/choice.css`、`src/engines/choice/choice.tsx`、`src/engines/listen/listen.css`、`src/engines/listen/listen.tsx`、`src/engines/listen/options.css`、`src/engines/listen/options.tsx`

1. **選択肢の文字を長さと学年で決める**: 文字だけの選択肢で、いちばん長いラベルが 12 字を超えるとき、choice.tsx が `data-long` を付ける。そのときのラベルは次のとおり。
   - 字の大きさ: `max(calc(var(--prompt-size) * var(--ts, 1)), var(--text-min))`（小1・小2 2.8u、小3・小4 2.4u、小5・小6 2.2u）
   - 行間 1.5・左そろえ・余白 0.8u 1.2u・高さ 6u 以上
   
   短いラベルは今の 3.2u のまま。どちらも `max(…, var(--text-min))` を下限にする（解説の fit 0.6 で 1.92u になっていた。p5・p23 の解説で約 200 画面）。
2. **絵＋文の選択肢は1段にする**（choice・listen）: 絵・図の選択肢に5字以上の文が付くとき（is-pics の対象外）も、選択肢が4つ以下なら折り返さない。
   - CSS: `flex-wrap: nowrap`、各選択肢は `flex: 1 1 0; min-width: 0`、絵は `max-width: 100%`。文は札の中で2行まで折る。
   - g6.en.past/4（「アイスクリームを たべた」）・g6.en.future・g6.en.places・g5.en.where の作業領域の不足（約 11u）が無くなる見込み。
3. **書き起こしの列**: 絵の選択肢が3つ以下（1つに1つずつ）で書き起こしを左の列に置くとき、列の幅を 28u から `max(28u, 作業領域の幅 − 絵の札の合計の最小（各 14u）− 間隔)` まで広げる。
   - 絵の札は 14u まで縮む（時計は 18u の下限のまま）。
   - 書き起こしの字は `max(…, var(--text-min))` にする。
4. **聞く問題の「▼ つづき」**（`eng-listen__cue`）: 段の高さを `max(2.9u, 1.3em)`（DESINGN 17章の 2.9u）、`line-height: 1.2`、字を `--text-min` にする。今は高さが 1.9u で、字が枠の外に出ている（g3.ja.listen-memo の 24 画面）。
5. 選択肢の「こたえあわせ」は第2回のまま（`eng-check`）。
- 減る見込み:
  - scroll-hidden（choice 3,870・listen 770）のうち、選択肢の文字・並びの分の約 2,000。
  - button-split（小3以上の eng-choice__label・eng-opts__label）の一部（C11・T8 と合わせて）。
  - small-text（解説の span.rt）約 650。
  - kinsoku-start・orphan（書き起こし）約 40。
- 確かめ方:
  - 開く画面: `#/dev/unit/g4.ja.write-report/22`（1280×720）・`g3.sci.weight/19`（1536×864）・`g3.ja.proverbs/0`・`g6.en.past/4`・`g5.en.where/0`・`p5.ja.story-listen/15?state=explain`（1536×864）・`p23.ja.picture-book/0?state=explain`・`p5.math.shapes/11?state=explain`。
  - テスト: choice・listen のテスト（autoLayout と data-long の単体テスト）。

#### T4 札のエンジン（order・sort・match・fill・build）

ファイル: `src/engines/order/shared.css`、`src/engines/order/shared.tsx`、`src/engines/order/order.css`、`src/engines/order/order.tsx`、`src/engines/sort/sort.css`、`src/engines/sort/sort.tsx`、`src/engines/match/match.css`、`src/engines/match/match.tsx`、`src/engines/fill/fill.css`、`src/engines/fill/fill.tsx`、`src/engines/build/build.css`、`src/engines/build/build.tsx`

1. **order の端の札を Rt に通す**（不具合）: `{endLabel(pos) ?? pos + 1}` を `<Rt text={endLabel(pos)} ctx={ctx} />` にする。今は「終《お》わり」が記法のまま出ている（g5.ja.write-fact-opinion・g6.ja.write-opinion・sci-g34 の ends）。order のテストに、ends に《》を含む札の表示を足す。
2. **こたえあわせ を全部の札のエンジンで帯へ**: `CheckButton` の `band` を既定で true にする（order・match・fill・build。sort は第2回で済み）。
   - 札の列は作業領域の幅いっぱいを使う（`.tk-frame--band`）。
   - order で文の札（8字超）が4枚以上なら、札の置き場と札の列を左右に並べ、札の列を2列にする（右の 22u の空きを使う）。g6.ja.write-opinion/0 は、札の列が幅 30u の1列で縦に伸びていた。
   - こたえあわせ の字は `max(2.4u, --text-min)` にする（p4.env.daily-order の「こたえあわせ」が 2.08u。small-text 180 画面）。
3. **match の正解の ○**: 札の字の上に大きな ○ を重ねない。次のどちらかにする。
   - choice（第2回 R3）と同じく、○ を札の字の後ろに置く（`z-index: 0`、札の中身は `position: relative; z-index: 1`）。
   - 札の枠を太い緑の輪郭にし、形でも分かるよう角に小さな ○ を足す。
   
   C13 で、検査がこれを数えるようになる。
4. **番号の丸がふりがなに重ならないようにする**: match・order の札の左上の `.tk-badge` を札の外（左の余白 `margin-left: 番号の丸の半径`）に出し、札の文字の開始位置を丸の幅だけ右にずらす（`padding-left: calc(丸 + 0.6u)`）。対象は g3.ja.proverbs/35・g4.ja.idioms/0 の解説（covered「rt の上に span.tk-badge」147 画面）。
5. **sort の箱の名前の図**: ふた（5.5u）の中の図（`.eng-sort__name .tk-card__fig svg`）を `max-height: calc(ふたの高さ − 1u)`・`width: auto` にし、切らない（p23.think.sort の clipped 304 画面）。
- 減る見込み:
  - scroll-hidden（order 1,189・sort 786・match 422・fill・build）のうち、こたえあわせ の分（不足 2〜4u）の約 600。
  - order の2列で、g6.ja.write-opinion・g3.ja.read-paragraphs・p5.ja.story-listen の一部。
  - clipped 304、covered（tk-badge）147。
  - C12 で出る《》の記法の約 190 が 0 になる。
- 確かめ方:
  - 開く画面: `#/dev/unit/g6.ja.write-opinion/0`（1280×720）・`g5.ja.write-fact-opinion/0`・`g3.ja.proverbs/35?state=explain`（1536×864）・`g4.ja.idioms/0?state=explain`・`p23.think.sort/0`・`p4.env.daily-order/8`・`g1.ja.write-order/15`（1536×864）。
  - テスト: order・sort・match・fill・build のテスト。

#### T5 読解（印の段・右の列）

ファイル: `src/engines/reading/reading.css`、`src/engines/reading/reading.tsx`

1. **「▼ つづき」「▲ はじめから」の段**: 高さを `max(2.9u, 1.3em)` に固定し（今は data-tight などで 1.7〜2u に詰まる）、字を `--text-min`・`line-height: 1.2` にする（text-outside-box 242 画面）。
2. **右の列が入らないとき**: 第2回の data-tight（1:1・余白 0.6u）でも、選択肢の列の scrollHeight が clientHeight を超えるなら、次のようにする。
   - 選択肢の文字を `max(calc(var(--u) * 2.2), var(--text-min))`・行間 1.4 にする。
   - 本文:右 を 1:1.3 にする（本文の枠はスクロールするので狭くしてよい）。
   
   それでも入らないものはパックで直す（引用の文の選択肢。第4回）。右の列はスクロールさせない（第1回の条件のまま）。
- 減る見込み: text-outside-box 242 が 0 になる。overlap-button 32・covered（選択肢と吹き出し・解説の板）約 120 の大半が消える。
- 確かめ方:
  - 開く画面: `#/dev/unit/g4.ja.read-summary/3?state=explain`（1536×864）・`g4.ja.read-summary/21?state=h2`（1536×864）・`g5.ja.read-gist/29?state=h2`・`g5.ja.read-relations/2?state=explain`（1280×720）。
  - テスト: reading のテスト。

#### T6 ほかのエンジンの主操作を帯へ（explain・program・geometry・experiment・graph・map・measure・clock・numberline）

ファイル: `src/engines/explain/explain.tsx`、`src/engines/explain/explain.css`、`src/engines/program/program.tsx`、`src/engines/program/program.css`、`src/engines/geometry/geometry.tsx`、`src/engines/geometry/geometry.css`、`src/engines/experiment/experiment.tsx`、`src/engines/experiment/experiment.css`、`src/engines/graph/graph.tsx`、`src/engines/graph/graph.css`、`src/engines/map/map.tsx`、`src/engines/map/map.css`、`src/engines/measure/measure.tsx`、`src/engines/measure/measure.css`、`src/engines/clock/clock.tsx`、`src/engines/clock/clock.css`、`src/engines/numberline/numberline.tsx`、`src/engines/numberline/numberline.css`

1. 各エンジンの「できた」「こたえあわせ」「これで こたえる」に `eng-check` を付けて、下の帯へ移す（T1 の共通の形）。
   - エンジンの CSS で字の大きさを u で上書きしている所（`.eng-explain__done { font-size: calc(var(--u) * 2.6) }` など）は、消すか `max(…, var(--text-min))` にする。
   - p5.ja.letter-play・p5.think.why の「できた」は 2.08u になっている（small-text 288 画面）。
2. program は「もどす・けす・うごかす」を `.eng-band` の箱に入れて帯へ移す（うごかす がいちばん右）。命令の列（`.prog-strip`）と札の置き場は作業領域に残す。
3. experiment の「やってみる」（装置の操作）は作業領域に残し、「こたえあわせ」「これで こたえる」だけ帯へ移す。
4. numberline の数字キー（NumPad）の「こたえあわせ」は、数字キーの区画の中のまま（数の入力と同じ。帯に移さない）。
- 減る見込み: scroll-hidden（explain 480・program 288・geometry 16・experiment 168・graph 260 の一部）のうち、不足 2〜4u の大半。small-text 288。
- 確かめ方:
  - 開く画面: `#/dev/unit/g1.life.home/13`（1536×864）・`g1.prog.sequence/22`（1280×720）・`g3.prog.condition-combo/4`・`g2.math.triangles-quads/0`・`p5.env.predict/1`・`g3.sci.magnets/9`・`g4.soc.water-waste/19`・`p5.ja.letter-play/0`。
  - ヒント①〜③で吹き出しと重ならないこと（`:has(.eng-check)` で、吹き出しの右端が 39u になる）。
  - テスト: 各エンジンのテスト。

#### T7 数の入力の左の列（number）

ファイル: `src/engines/number/number.css`、`src/engines/number/number.tsx`

1. **上下にはみ出さない**:
   - 左の列を `grid-template-rows: minmax(0, 1fr) auto`（図の段が縮み、回答欄の段は中身の高さ）・`align-content: safe center` にする。
   - `.unit__work.unit__work--number` は number.css で詳しさを上げて上書きする（unit.css は T1 の担当なので触らない）。
   - 図の段は `min-height: 0; display: flex; flex-direction: column; justify-content: safe center; align-items: center`、中の svg・img は `max-height: 100%`。
2. **縮まない図（表・10の棒・テープ）**: 図の段の高さを超える表・10の棒は、図の段だけを枠にして縦にスクロールさせる（`overflow-y: auto`・`data-scroll-region="figure"` と ▼ の印）。
   - 数字キーと回答欄は枠の外なので、こたえあわせ は切れない。問題文・回答欄にも重ねない。
   - 検査は C2 の続きで、枠につき1件を残す。g4.math.two-way-table の 12 行の表などは、第4回の content で図を直す。
3. **回答欄が4つ以上**: 札つきの回答欄を1段（5つまで）に並べる。
   - 並べ方: `display: grid; grid-template-columns: repeat(auto-fit, minmax(10u, 1fr))`。
   - 回答欄の幅の下限は 14u から 10u にする。札は1行・`--text-min` で、入らなければ札の字を縮める。
   - g3.math.mult-2digit/5 では、「一万のくらい」などが2段に折れて表に重なっていた。
- 減る見込み:
  - covered（number。span.rt の上に eng-number__box・table・th・td・span.rt）約 700。
  - overlap-text（span.rt と span.rt のうち number の分）約 250。
  - out-of-stage（span.rt・svg のうち number の分）約 30。
- 確かめ方:
  - 開く画面: `#/dev/unit/g3.math.mult-2digit/5`（1536×864）・`g4.math.two-way-table/1`（1536×864）・`g1.math.numbers-120/0`・`g4.math.ratio-intro/0`・`g1.math.add-sub-2digit/4?state=explain`（1280×720）・`g2.math.mult-meaning/1`・`g3.math.division-remainder/1`。
  - テスト: `number.render.test.tsx`。

#### T8 改行の規則（base.css・Rt）

ファイル: `src/styles/base.css`、`src/text/Rt.tsx`、`src/text/rt.css`、`src/text/rt-wrap.test.ts`

1. **nobr のまとまりが行頭禁則の字で始まらないようにする**: Rt はふりがな付きの語・空欄を、前後の1字と `.rt-nobr` にまとめる。まとまりの先頭が行頭禁則の字（`、。，．」』）〕】ー` と小さい仮名）なら、さらに前の1字も含める（「…のに／、相手は」→「…の／に、相手は」）。rt-wrap.test.ts に例を足す。
2. **小3以上の図の文は文節で折る**: `.stage .unit[data-stage]:not([data-wakachi]) .fig-text { word-break: auto-phrase; }` を足す。今は keep-all なので、空白の無い文が1つの語になり、`anywhere` で好きな所で折れる（g3.ja.proverbs/44・45）。分かち書きの段階は keep-all のまま。
3. **選択肢・札の語の途中の改行**: 小3以上の選択肢・札（auto-phrase＋pretty＋`overflow-wrap: anywhere`）で、文節が行に入るのに語の途中で折れるものがある（g3.soc.safety/19「ならべてお／く」・g3.soc.city-changes/17「たい／へん」・g3.ja.write-reasons/19「できまし／た。」）。
   - Chrome 156 の見本のページ（それぞれの幅・字の大きさ）で、次の3つを比べる。
     - (a) 今のまま
     - (b) `overflow-wrap: break-word`＋ラベルに `min-width: 0`
     - (c) `text-wrap` の指定なし
   - 語の途中で折れないものを採る。
   - 第2回で break-word にしなかった理由は、狭いボタンで字が枠の外に出ることだった（g3.ja.haiku/33・39）。(b) の `min-width: 0` でこれが起きないことを確かめる。
- 減る見込み: kinsoku-start（fig-text）40。button-split の「語の途中」1,478 の一部（T3 の文字の大きさと合わせて）。orphan の一部。
- 確かめ方:
  - 開く画面: `#/dev/unit/g3.ja.proverbs/44`（1280×720）・`g3.ja.proverbs/45`（1536×864）・`g3.soc.safety/19`（1536×864）・`g3.soc.city-changes/17`・`g3.ja.write-reasons/19`・`g3.ja.haiku/33`。
  - テスト: `npm run test`（rt-wrap.test.ts）。

### 3. 検査の誤検出として直すこと・足すこと（checkerChanges）

ファイル: `e2e/helpers/text-layout.ts`、`e2e/text-layout.tl.ts`、`e2e/text-layout-probe.tl.ts`（見本を足す）、`e2e/helpers/text-layout-report.ts`（種類の名前）、`docs/test-plan.md`（3.2 に理由を書く）

- **C8 描き直しが終わるまで待つ**: `settle` を「2フレーム＋アニメーション」から、「次の印が2フレーム続けて同じになるまで（1秒まで）」に変える。
  - 見る印: 各 `svg` の viewBox・`--svg-floor`・最初の `text` の computed font-size、`.unit__work` の `--fit`・`--fig-max`・scrollHeight、解説の板の高さ。
  - 理由: `reducedMotion: 'reduce'` ではアニメーションを待たない。そのため、画面サイズを変えた直後の ResizeObserver → React の状態 → 描き直しの途中（前の画面の字の大きさのまま）を測ってしまう。g1.math.numbers-10/0 を 1920×1080 から 1280×620 に変えて再現した。600ms 後の測りと撮った画像は正常だった。
  - 待っても変わり続ける画面は、そのとき測って結果に `unstable` と書く（隠さない）。
- **C9 スクロールの枠で切れた字**: (8) 隠れるの見本の点を、文字の祖先のうち `overflow` が visible でない枠の **padding box**（`getBoundingClientRect` から border を引いた範囲）で切る。
  - 今は border box で切っているので、枠の下端で半分切れた行の中心が、枠の外の「▼ つづき」の段の上に来て covered になる（g1.ja.read-story/3 ヒント③、1280×720）。
  - 点の中心が padding box の内側 0.5px 以内に無い字は見ない（枠で隠れた字。スクロールで見えることは C2 が受け持つ）。
- **C10 ボタンの上の飾り**: ボタンの (8) で、上に来た要素の外接を、その要素の祖先の `overflow` の枠で切ってから、「ボタンより小さい札」の例外を判定する。
  - さらに、検査が pointer-events を有効にする前の computed の値を覚えておく。次の3つを満たすものは数えない（押せることも、見た目の文字も損なわない飾り。例: p23.think.sort の ふたの上の色の丸）。
    - 上に来た要素が、元は `pointer-events: none` である。
    - ボタンと同じ親（ボタンの親の子孫）にある。
    - ボタンに見える文字が無い（aria-label だけ）。
  - 文字のあるボタンの上の飾りは、今どおり数える。
- **C11 小3以上のラベルの空白**: button-split の「空白でない所で改行」は、分かち書きの段階か、ラベルの空白が多い（空白の数 ≥ 字数 ÷ 12）ときだけ出す。
  - 小3以上で、空白が名前の中などに1〜2か所だけあるラベル（「『小さな虫のひみつ』（森川 はるか、そよかぜ社、2023年）には…」）は、Intl.Segmenter の「語の途中」の判定に回す。
  - 理由: 空白が1つあるだけで分かち書きとみなし、文節の切れ目（「自分の体より／ずっと」）まで違反にしていた（g4.ja.write-report・g4.ja.info-compare で約 1,000 画面）。
  - g3 の理科・社会の分かち書きのラベル（g3.sci.weight「プラスチック／より かるい」）は空白が多いので、今どおり出る。
- **C12 記法の漏れ（足す）**: 画面の文字に《》（ふりがなの記法）や `{{`・`}}`（空欄の記法）がそのまま出ていたら、新しい種類 `markup-leak`（「教材の記法がそのまま出る」）で出す。order の端の札で見つかった（g6.ja.write-opinion「終《お》わり」）。プローブに見本を足す。
- **C13 正解の ○ の例外を狭める（足す）**: (8) で `.mark` を「意図した重ね」として飛ばしている。これを、誤答の ？（角の小さな印）と、字の後ろに置いた ○（z-index で字より下。字の点からは見えない）だけにする。字の上に来る ○（match の解説。g3.ja.proverbs/35）は covered に出す。T4 の 3. で消える。
- 緩めないもの: covered・out-of-stage・clipped の判定、small-text の最小（第2回の 1% だけ）、overlap-text の閾値、分かち書きのラベル（空白が多いもの）の「空白でない所で改行」、work・explain のスクロールの1件。

### 4. 受け入れるもの（accepted）

- 読解の本文の枠・プログラムの命令の列・聞く問題の書き起こしの枠のスクロール（第1回・第2回の条件: 4行以上・▼ の印・右の列はスクロールしない）。
  - ただし、印の無いものが 9 画面残っている（g6.soc.history-1/0・g6.soc.history-3/3・g3.prog.decompose/24・g5.prog.debug-plan/13・g1.ja.read-story/26・g3.ja.listen-memo/32 の解説）。これは受け入れない。T5・T6・T3 の担当が、印が出ない理由（解説の板が開いたあとの高さの測り直し）を調べる。
- 表・図のある解説の板の中のスクロール（g5.en.read-words の対応表など）: 板に ▼ の印があり、上から読める。1件として残す。
- T7 の 2. の、数の入力の図の枠のスクロール（印あり。12 行の表など）: 問題文・回答欄に重ねないための逃げ。1件として残し、第4回の content で図を直す。
- text-on-figure（参考。17 件・100 画面）: ふりがな・吹き出しが図の上にかかるもの。数が少ないので、T7・T2 のあとに残ったものだけ見る。
- 開発用の EngineGallery と React の key（第1回 S9）は直っていて、変えるものは無い。

### 5. 次の回（第4回）に回すもの（content）

共通の直し（T1〜T8）で、パックの SVG の大きさ・主操作の位置・選択肢の文字・数の入力の左の列が変わると、パックの直しの対象が大きく変わる。第4回はもう一度 `MNW_FRESH=1 npm run check:text-layout` を流し、残った work・explain・figure のスクロールの件と small-text をパックごとに直す。いま見えている候補:

- **書く単元の札・選択肢の文が長い**（作業領域が 8u 以上足りない）:
  - g6-ja: write-opinion 32u・info-relations・read-argument
  - g4-ja: write-report 57u・idioms・info-compare・read-summary
  - g5-ja: write-fact-opinion 31u・figurative・spoken-written・text-figure 54u
  - g3-ja: read-paragraphs 25u・write-reasons
  - g2-ja: write-structure
  - soc-g34: city-changes・safety
  - p5: story-listen・letter-play・think.why 37u・math.shapes 24u・think.pattern 39u
  - sci-g56: weather-change 30u・moon-sun 35u
- **図が大きすぎる・表が長い**:
  - g4-math: two-way-table の 12 行の表を横長にする。
  - g3-math: mult-2digit の表＋回答欄5つ、abacus 24u。
  - g2-math: box/1 の縦長の面の選択肢4つ 76u、mult-meaning の●のアレイ。
  - g1-ja: read-info/33・read-story/33 で、本文の図を order と同じ作業領域に置いている（40〜98u）。
- **パックの SVG の字が viewBox に比べて極端に小さい**（T2 のあとに残るもの）:
  - prog-g16: kit.ts の gridFigure の hU。
  - g4/g5/g6-math: util の `svgText` の size の既定 16 と viewBox の幅。
  - soc-g56 の world、en-g34 の directions。
- **解説が板に入らない（図なし）**:
  - g4-ja: idioms
  - g2-math: add-column・sub-column・add-sub-3digit（3.7 行）
  - g3-math: add-sub-column（6.2 行）・mult-2digit
  - g4-math: oku-cho（33.6 行）・decimal-add-sub・div-1digit
  - kanji-g12: kanji-read-g2

## 第4回（2026-10-31・分析と設計）

### 0. 元の結果と、追加で測ったもの

- 元: 第3回の直し（d161b80）と幼児の英語の追加5単元・p4.en.move・p4.en.hello の拡充（f4337a1）のあとに流した `docs/screenshots/text-layout-report/`（313 単元・10,043 問・191,600 画面。全件は `.cache/text-layout/units/`）。件 1,883（第3回のあとは 2,471）。違反のない単元 114 / 313。
  - 件の内訳: scroll-hidden 959・small-text 282・button-split 176・clipped 153・orphan 93・overlap-text 67・covered 57・kinsoku-start 17・overlap-button 14・wakachi-split 9・text-on-figure 8・out-of-stage 7・word-split 7・markup-leak 6・text-outside-box 1。
- **検査から外れた 11 単元**: unit-index の 324 単元のうち、`engine: 'legacy'`（v1 のモードを使う単元）の 11 単元。
  - p23.hand.lines・p4.hand.lines（trace の lines・maze）・p4.hand.letters-classic（trace の letters）
  - p4.ja.hiragana-classic・p4.math.classic・p4.math.compare・p4.math.shapes・p4.math.shop
  - p4.think.memory・p4.think.road・p4.think.sort

  `e2e/text-layout.tl.ts` は `u.engine !== 'legacy'` で外している。v1 のモードは単元の画面（`#/dev/unit/…`）を通らず、`e2e/layout.spec.ts` が受け持つ設計（test-plan 3.2 の「v1 のモード以外」）なので、外す理由は正しい。新しく足した幼児の英語の単元（p5.en.abc を含む）は、313 単元に入っている。ただし `layout.spec.ts` の `MODES` は trace を `lines` しか開かず、p4.hand.letters-classic（letters）と p4.hand.lines の maze を見ていない。これを C19 で足す。
- 全件を「単元 × 種類 × 要素 × 説明」でまとめ直し、代表例を開発サーバー（127.0.0.1:4351、`MNW_DEV_NO_HMR=1`。4299 は使っていない）で開いた。同じ `inspectText` で測り、約 60 画面を撮影した。分かったこと:
  - **解説の図が 0×0 で見えない**（不具合・見落とし）:
    - 起きること: パックの SVG（`.fig-svg` の width の無い svg）を解説の図にすると、`.unit__explain-figure` の高さが 0、中の svg が 0×0 になる。字だけが板の外（舞台の下、y=974px）に描かれる。
    - 例: g4.en.directions/35 の地図、g5.math.speed/3 の数直線（1280×720）。
    - 原因: unit.css の `.unit__explain-figure svg { width: auto }` が、T2 の幅（`.fig-svg` の `--fig-k` から決める幅）を消す。そのため flex の中で内容の幅 0 に縮む。
    - 検査での出方: この字が clipped（text ⊂ svg、説明なし）と small-text（解説の状態の `text`）として、約 130 件・1,300 画面に出ている。対象は g4.en.directions・g5.math.speed・angle-sum・per-unit・g4.math.fraction-kinds・p5.math.compose ほか。
    - 字の無い図は検査に出ないので、実際の数はもっと多い。絵・10の棒（`.fig-illust`・`.fig-svgbox`）は出ている（g1.math.add-carry は右置き、g5.en.where は下の段）。
  - **幼児の選択肢の語が途中で折れる**:
    - 例: 「じてんし／ゃ」「おめでと／う」「こんにち／は」「おつきさ／ま」「おなかい／っぱい」「（くさばな／）」。
    - 原因: 札は 14u 前後で、ラベル 3.2u の 5〜7 字が入らない。分かち書きの `keep-all`＋`anywhere` で、好きな所で折れる。
    - 範囲: 次の単元で、orphan・kinsoku-start・button-split の 146 件・約 3,000 画面。
      - 幼児: p4.en.hello・p4.en.words・p23.en.words・p4.en.picture-book・p5.en.first-sound・p23.ja.*・p4.ja.story-listen・p5.ja.story-listen
      - 小学校の英語の解説: g6.en.future「パイ／ロット」・g5.en.where「つくえの／中」・g3.en.*
    - 4歳には読めない形（語が2行に割れ、行頭に「ゃ」「っ」「う」が来る）。
  - **幼児の絵の選択肢が作業領域の下で切れる**:
    - 例と不足: p4.en.words/20・p4.en.picture-book/7・p5.en.phrases は 2.6〜3.8u、p5.math.numbers-10/4 は 3.8u、p23.math.shape-match/28 は 7.5u。
    - 原因: 絵の札の大きさ `--pic-max` は作業領域の幅だけから計算し、高さを見ない。そのため札の下半分（ラベル）が作業領域の下端で切れ、▼ が出る。
    - 上の段に「きいてね」や絵の列（p5.math.numbers-10 の動物の列）があると、もっと足りない。
    - 幼児はスクロールに気づけず、ラベルが見えないので受け入れない。
    - 幼児の英語の残り（p23.en.move・p4.en.where・p4.en.move・p5.en.abc・p5.en.picture-book・p4.en.colors-numbers・p5.en.shop）は 0 件。幼児の規約で目視した。
      - 1280×620 の解説でも、文字は 2.2u 以上
      - 絵は 10u 以上
      - 札は 14u×18u 以上
      - 「きいてね」は 14u×9u
  - **ヒントの吹き出しの最後の行が見えない**:
    - 原因: `.unit__bubble` は `max-height: 11.6u; overflow: auto` で、▼ が無い。ヒントが4行を超えると、最後の行（「よ。」「かな。」「くらべよう。」）が吹き出しの中に隠れる。
    - 主操作（こたえあわせ）のある画面は、吹き出しの右端が 39u で幅が狭く、行が増える。
    - 例: g6.ja.write-opinion/0 h2・g3.ja.reference-connectives/22 h2・g1.prog.condition/20 h3・g2.prog.repeat/22 h3・g3.ja.romaji/245 h2・g6.ja.language-change/14 h3 で、176 画面。
    - 数字キーとの重なり: 数字キーは帯の右（70〜96u）にあるが、吹き出しの右端（24u）がその列にかかる。3行の問題文で数字キーが下がると、「0」のキーを隠す（g3.math.length-km/6 h1、1536×864）。
  - **読解の右の列が、ヒントの吹き出し・解説の板の下に入る**:
    - 例: g4.ja.read-summary/33 h2・g5.ja.read-gist/29 h3・g5.ja.read-relations/7 解説・g6.ja.read-argument/8 解説・g6.ja.read-literature/7 解説。
    - 原因: 読解は作業領域をスクロールの枠にしない（NO_WORK_SCROLL）。そのため、引用の文の選択肢4つ（各2〜3行）が下に伸び、4つ目の選択肢が板や吹き出しに隠れる（covered 約 70 画面）。
  - **正解の ○ が長い文の字を横切る**:
    - 例: g6.ja.write-opinion/6 の解説の sort の札4枚、g5.ja.read-relations/7 の解説の選択肢。
    - ○ は字の後ろにある（第2回 R3）が、札の短い辺に合わせた輪が文の真ん中の字を横切り、読みにくい。match だけは、第3回 T4 で「緑の太い輪郭＋角の小さな ○」にした。
    - 輪の中は透明で当たり判定が通り抜けるので、検査は数えていない（見落とし）。
  - **fill の解説で、埋まった空欄の文が舞台の外へ**: 解説で正解の文が入った空欄（`.eng-fill__blank.is-revealed`）が折り返さず、1行のまま舞台の左右の外に出る（g4.ja.write-report/31・32、1536×864。out-of-stage 7 件）。
  - **sort の解説で、ふたと札が重なる**: 箱に入った長い文の札が箱の高さを越え、次の段のふた（`.eng-sort__lid`）に重なる（g4.ja.write-report・g6.ja.write-opinion。overlap-button 14 件・covered 12 件）。
  - **数の入力の図の段**:
    - 10の棒・筆算の表が縮まず、図の段だけがスクロールする（第3回 T7 の逃げ。246 件・2,786 画面・57 単元）。
    - 子供から見ると、次のものが見えず、数えられない・計算できない。
      - たし算の 10 の棒の下半分（g2.math.add-column/0）
      - 筆算の × の行と答えの行（g3.math.mult-2digit/5）
    - 一方、作業領域の下（回答欄の下）には 6〜8u の空きがある。印があっても、解く手がかりが隠れるので受け入れない。
    - 解説の状態では、板の分だけ図の段が 1.4〜3.8 行に減り、clipped（4行未満）が 143 画面出る。
    - 大きい字の式（`fig-text--xl`）のふりがな（g3.math.time/0「びょう」）は、図の段のスクロールの枠の上端で切れる。
  - **読解の本文の枠の上端・左端で、ふりがなが切れる**（clipped 17 件・574 画面）:
    - g1.ja.read-info/24 の表（「なまえ」「だんごむし」）は、本文の枠より広く、左にはみ出す。
    - g5.ja.text-figure・g4.soc.tradition は、本文の1行目の rt が `padding-top: 0.6u` に入らない。
  - **記法の漏れ**（markup-leak 6 件）:
    - 起きること: soc-g34 の g3.soc.map-symbols のヒント・解説に、「×《ばつ》」「Y《ワイ》」がそのまま出る。
    - 原因: `rich.ts` の《》は、直前の漢字の並びだけを親字にする。そのため、記号・英字の後ろの《》は記法として読まれず、字として出る。教材の書き方の誤り。
  - **分かち書きの記号のあとの改行**（wakachi-split 9 件）: 記号・分数・空欄と、続く助詞の間で折れる。
    - 例: 「○／が つまれるよ」（g1.math.picture-graph）、「□／は 2こ」（g2.math.fraction-simple の分数）、「〜／が」（g2.ja.subject-predicate）、「○／を つみます」（g2.math.tables-graphs）。
    - 記号は keep-all でも前後で折れる。
    - 「二年／一組」（g2.ja.read-info/24）は、本文の語が行に入らず、`anywhere` で折れたもの。
  - **小3以上の式の図の文**（orphan）: 「（7 ＋ 9） ＝／□」（g4.math.order-ops）・「3 − 5919 ＝／□」のように、最後の □ だけが次の行に落ちる。
  - **パックの SVG の字**（small-text 282 件の大半と、overlap-text の text と text）: T2 のあとに次の2種類が残った。
    - (a) 最小の 0.97〜0.99 倍で、1920×1080・1280×620 だけに出るもの。g4.soc.prefectures 268 画面・g2.math.time・g6.math.frequency・g5.math.area-formulas・g3.math.bar-graph・g4.math.angle ほかで、約 450 画面。
    - (b) パックが width を書いた図や、viewBox が極端に大きい図で、0.36〜0.8 倍のもの。
      - g6.soc.world の ⑥ 0.62u
      - g6.prog.efficient 0.41
      - g2.prog.debug 0.78（ロボットの盤が幅 9u）
      - g4.en.directions のスタート 0.46
      - g4.prog.prefecture-finder の解説の A・B・C の重なり
      - g5.math.angle-sum の細い三角形で、75°・90° が重なる
- 検査の側で分かったこと:
  - **word-split の誤検出**: 「12−1801＝11／で」「4は自然科学、7／は芸術」「資料2／は」「＝ 9／で」は、数のあとの助詞の前の改行で、組版として正しい。
    - 検査は「数字のあとに仮名・漢字が続けば助数詞」としている。
    - 7 件・78 画面が全部これだった（g4.soc.tradition・g5.ja.read-gist・g5.ja.text-figure・g5.math.average）。
  - **button-split の複合辞**: `Intl.Segmenter` は「という」「について」を1語として返すので、「〜と／いう」「〜に／ついて」「〜と／して」が「語の途中」になる。
    - これらは助詞と動詞の境目（文節の切れ目）で、改行してよい所（g6.ja.write-opinion・g5.ja.write-fact-opinion・g3.soc.city-changes・g4.ja.info-compare などで約 40 件）。
    - 一方、次のものは語の途中で、本当の違反。
      - 「方／向」「一年／生」「の／びる」「落と／す」
      - 「パイ／ロット」
    - 原因は、文節が札の幅より長く、`break-word` の最後の手段で折れること。
  - **見落とし（足す）**:
    - 0×0 の図（C15）
    - 字を横切る正解の輪（C16）
    - 親字の無い《》を、教材の段階で止める静的な検査（C18。今は画面で出るまで分からない）

### 1. 原因の分類（第4回）

| 分類 | 内容 | 主な件（件・画面の延べ） |
|---|---|---|
| (1) 共通の画面の作り | 解説の図が 0×0／吹き出しが伸びず ▼ も無い・数字キーにかかる／幼児の語のラベルが途中で折れる／絵の札の高さを見ない／正解の ○ が文を横切る／fill の空欄の文が折れない・sort の札がふたに重なる／数の入力の図が縮まない／読解の右の列が板・吹き出しの下・本文の枠の上端のふりがな・表のはみ出し／分かち書きの記号・式の □ の改行／SVG の字の 0.97〜0.99 倍 | 解説の図 約 130 件・1,300 画面、語のラベル 146 件・3,056 画面、絵の高さ 54 件・660 画面、数の入力の図 246 件・2,786 画面、吹き出し 14 件・208 画面、読解 36 件・640 画面、sort・fill 25 件、改行 約 20 件、SVG の字 約 60 件・450 画面 |
| (2) パックの文・選択肢・図 | 書く単元の札・選択肢の文が長い（作業領域が 8u 以上足りない）／長いヒント・解説／筆算・表・10の棒が大きい／パックの SVG の width・viewBox／教材の記法の誤り（×《ばつ》） | work のスクロール 454 件の大半・explain のスクロール 254 件の一部・small-text の (b)・markup-leak 6 |
| (3) 検査の誤検出 | 数のあとの助詞を助数詞とみなす（C14）／複合辞の文節の切れ目を語の途中とみなす（C17） | word-split 7 件・78 画面、button-split 約 40 件 |
| (3') 検査の見落とし（足す） | 0×0 の図（C15）／字を横切る正解の輪（C16）／親字の無い《》（C18、静的）／v1 の trace letters・maze（C19、layout.spec） | 新しく出る（解説の図の単元・sort と読解の解説） |
| (4) 設計上受け入れる | 読解の本文の枠のスクロール（印あり）／表の解説の板のスクロール（印あり・上から読める）／text-on-figure（参考） | 下の 4. |

### 2. 共通の直し（systemic。項目ごとにファイルを分ける）

#### V1 単元の枠: 解説の図・吹き出し・作業領域の高さ（UnitRunner・unit.css・DESINGN.md）

ファイル: `src/units/UnitRunner.tsx`、`src/units/unit.css`、`DESINGN.md`

1. **解説の図を 0×0 にしない（不具合）**:
   - `.unit__explain-figure svg` の `width: auto` を、width の無いパックの SVG（`.fig-svg` の svg）には当てない。
   - 下の段に置く図は、次のようにする。
     - 高さ: `min(12u, 自然な高さ)`
     - 幅: `width: auto`・`max-width: 100%`（width の無い svg は viewBox の比で幅が決まる）
   - 右置き（data-fig-side）の図は、幅を `min(30%, 24u)` にし、高さは比から決める。
   - 字の大きさは、T2 の `liftSvgText`（2 倍まで）に任せる。
   - `decideSide` は `figW <= 0` のとき右置きをやめているので、0×0 だった図は、直すと右置きにも乗る。
   - 確かめ方: 解説の状態で、すべての `.unit__explain-figure svg, img` が幅・高さ 1px 以上であること（C15 で検査に入る）。
     - 開く画面: `#/dev/unit/g5.math.speed/3?state=explain`・`g4.en.directions/35?state=explain`・`g5.math.angle-sum/5?state=explain`・`g4.math.fraction-kinds/4?state=explain`（1280×720・1280×620）。
     - 図が出ると板が高くなるので、`--panel-h` と作業領域の縮みが合っていることも見る。
2. **吹き出しが中身に合わせて伸びる・最後の行を隠さない**:
   - ヒントの吹き出しの高さを測る（板の `--panel-h` と同じ所で、`phaseKey` ごとに測り直す）。
   - `scrollHeight > clientHeight` なら `data-tall` を付け、次のようにする。
     - 字: `--text-min`・行間 1.3
     - `max-height`: 11.6u から 16u（`--u0` で。下の帯の上端から問題文の下まで）
   - 吹き出しの高さは root の `--bubble-h` に書き、作業領域の下端を `max(--panel-h, --bubble-h)` の上までにする（fit の測りに入る）。
   - それでも入らないときは、板と同じく下端に ▼（`data-scroll-cue`）を出す。scroll-hidden を1件残し、パックのヒントを短くする（5. の content）。
   - 数字キーのある画面（`.unit:has(.numkey)`）では、吹き出しの右端を主操作と同じ 39u にし、数字キーの列 70〜96u にかけない（g3.math.length-km/6 h1）。
3. **作業領域の高さを子に渡す**:
   - fit を測るとき、`.unit__work` に `--work-h`（fit=1 での clientHeight、px）を書く。V2 の絵の札の高さの上限に使う。
   - V2 は `var(--work-h, 9999px)` で読むので、どちらが先に入っても壊れない。
4. **DESINGN.md**: この項目の担当がまとめて書く（V2〜V7 は DESINGN.md を触らない）。
   - 18章: 解説の図の大きさ（width の無い SVG は高さ 12u まで・比で幅）と、吹き出しの伸び方（16u まで・▼・`--bubble-h`）。
   - 17章:
     - V2: 語のラベル・絵の札の高さ
     - V3: 正解の印（文の札・長い文の選択肢は、輪郭＋角の ○）
     - V4: 数の入力の図の縮み
     - V5: 読解の右の列の下端
     - V6: 記号のまとまり
     - V7: SVG の字の余裕
- 減る見込み: 解説の図の clipped・small-text 約 130 件、吹き出し 14 件・208 画面、covered（numkey）8 画面。
- 確かめ方:
  - 上の画面と、`#/dev/unit/g6.ja.write-opinion/0?state=h2`（1280×720）・`g3.ja.reference-connectives/22?state=h2`・`g3.math.length-km/6?state=h1`（1536×864）を開く。
  - テスト: `npm run test`（unitFlow）・`npm run check:design`。

#### V2 選択肢と聞く問題: 語のラベル・絵の札の高さ（choice・listen・options）

ファイル: `src/engines/choice/choice.css`、`src/engines/choice/choice.tsx`、`src/engines/listen/listen.css`、`src/engines/listen/listen.tsx`、`src/engines/listen/options.css`、`src/engines/listen/options.tsx`

1. **語のラベルは語の途中で折らない**:
   - tsx（choice.tsx の `optionTraits` と options.tsx）で、ラベルを次の2つに分け、`data-word` と `--len`（字数）を付ける。
     - 一つの語: 空白が無く 8 字以下（「じてんしゃ」「おめでとう」「パイロット」「すいぞくかん」）。
     - 空白で区切った短い句: 各語 8 字以下・全体 14 字以下（「つくえの 中」「したの いぬ」「アイスクリームを たべた」）。
   - 一つの語は `white-space: nowrap` にする。
     - 字は、札の中の幅に入る大きさにする: `min(既定, 100cqi ÷ (--len × 1.05))`（札に `container-type: inline-size`）。下限は `--text-min`。
     - 下限でも入らないときは、札の `min-width` を `--len × --text-min ＋ 余白` にして札を広げる（is-pics の縮みより優先）。
   - 空白で区切った句は、空白でだけ折る: `word-break: keep-all; overflow-wrap: normal`・`text-wrap: balance`。
   - 「はな（くさばな）」のように括弧で読みを足したラベルは、括弧の前でだけ折る。「（」の前は keep-all でも折れるので、括弧の中を nowrap の span にする。
   - 12 字を超える文のラベル（`data-long`）は今のまま。
2. **絵の札の高さの上限**:
   - `--pic-max` を、次の2つの小さいほうにする。
     - 今の幅の式
     - 高さの式 `var(--work-h) − 札の段・絵の列・問題の段の高さ − (ラベルの行 × 行の高さ ＋ 札の余白 ＋ 間隔)`
   - 札の段・絵の列の高さは tsx で測り、`--pics-above` に書く（listen の「きいてね」が上の段のとき、choice の `--fig` の絵の列があるとき）。
   - 幼児の絵の下限は 10u（DESINGN 17章の絵の大きさ）。下限でも入らないときだけ、作業領域のスクロールが残る。
   - 対象: p4.en.words/20・p4.en.picture-book/7・p5.en.phrases/4・p5.math.numbers-10/4・p23.math.shape-match/28（1280×720）。
3. **4つの短い文字の選択肢は1行に**:
   - choice の文字だけの選択肢が4つで、いちばん長いラベルが 9 字以下なら、2×2 の格子でなく横1行にする（`data-row4`。各札 `flex: 1 1 0`、字は `max(2.6u, --text-min)`）。
   - 例: g6.soc.world/0 の「北アメリカ大陸／アフリカ大陸／ユーラシア大陸／オーストラリア大陸」は、2段で作業領域が 4.7〜12u 足りなかった。
4. **長い文の選択肢の正解の印**: `data-long` の選択肢（読解・聞く問題の引用の文）の ○ は、ui.css の V3 の規則（輪郭＋角の ○）に従う。options.css で輪の大きさを上書きしている所があれば外す。
- 減る見込み: 語のラベルの orphan・kinsoku-start・button-split 146 件・約 3,000 画面、幼児の作業領域のスクロール 54 件・660 画面、g6.soc.world の scroll-hidden。
- 確かめ方:
  - 開く画面: `#/dev/unit/p4.en.hello/0`・`p4.en.words/69?state=explain`（1280×620）・`p4.en.words/87`・`p4.en.picture-book/7`・`p5.en.first-sound/3`・`g6.en.future/0?state=explain`・`g5.en.where/0?state=explain`・`p5.math.numbers-10/4`・`p23.math.shape-match/28`・`g6.soc.world/0`（1536×864）。4つの画面サイズで開く。
  - 幼児の札の字が 2.2u 以上、絵が 10u 以上、札が 14u×10u 以上であること。
  - テスト: choice・listen のテスト（`data-word` の判定の単体テスト）。

#### V3 札のエンジンの解説と正解の印（sort・fill・order・ui）

ファイル: `src/engines/sort/sort.css`、`src/engines/sort/sort.tsx`、`src/engines/fill/fill.css`、`src/engines/fill/fill.tsx`、`src/engines/order/shared.css`、`src/engines/order/shared.tsx`、`src/ui/ui.css`

1. **正解の ○ を文の上に重ねない**:
   - ui.css で、単元の作業領域の中の文の札と長い文の選択肢の正解の印を、match（第3回 T4）と同じにする。
     - 札の輪郭: 緑の太線（0.6u）
     - 印: 右上の角に小さな ○（3.2u、白地）
     - 対象: `.unit__work .tk-card`、`.unit__work :is(.eng-opts__list, .eng-choice__options)[data-long] > .choice`
   - match.css の同じ規則は、ui.css に移したあとも残してよい（重複は害が無い）。
   - 絵・短い語の札（幼児の絵の札など）は、今の大きな ○ のまま。
   - 確かめ方: `#/dev/unit/g6.ja.write-opinion/6?state=explain`（1280×720）・`g5.ja.read-relations/7?state=explain`（1536×864）・`g3.ja.proverbs/35?state=explain`。C16 で検査に入る。
2. **fill の埋まった空欄の文を折る**:
   - `.eng-fill__blank.is-revealed` を `display: inline; white-space: normal; box-decoration-break: clone`（行ごとに枠）にする。字は文と同じ大きさにする。
   - 空欄の元の幅（`min-width`）は、埋まったら外す。文の段は `max-width: 100%`。
   - g4.ja.write-report/31・32 の解説で、out-of-stage 7 件が消える。
3. **sort の解説で、札をふたに重ねない**:
   - 解説で箱に入った札の段（`.eng-sort__box` の中身）は、今の固定の高さをやめて `height: auto` にする。ふたの段と重ねない（`grid` の行を `auto`）。
   - 長い文の札の字は `max(--prompt-size × 0.85, --text-min)`、行間は 1.4 にする。
   - それでも作業領域を越える分は、作業領域のスクロール（1件）にし、パックの札の文の長さで直す（5. の g4-ja・g6-ja）。
- 減る見込み: overlap-button 14 件、covered（lid・span.rt）12 件、out-of-stage 7 件。
- 確かめ方:
  - 開く画面: `#/dev/unit/g4.ja.write-report/1?state=explain`（1536×864）・`g4.ja.write-report/31?state=explain`・`g6.ja.write-opinion/6?state=explain`（1280×720）。
  - テスト: sort・fill・order のテスト。

#### V4 数の入力の図の段（number）

ファイル: `src/engines/number/number.css`、`src/engines/number/number.tsx`

1. **図の段に入らない 10の棒・表・筆算を縮める**:
   - 図の段の高さを測り、図の自然な高さが段を越えるときは、図の中の `--u` を `--fig-k = max(0.6, 段の高さ ÷ 図の高さ)` で縮める（`.fig-blocks`・`.fig-column`・`.fig-table`・筆算の表）。UnitRunner の `--fig-k` と同じ考えで、number は NO_FIG_FIT なので number.tsx で行う。
   - 縮める前に、表の行の高さ（今 4.4u）を 3.4u まで詰める（`td, th { padding-block: 0.3u }`）。
   - 縮めた表・式の字は `max(…, --text-min)` を割らない。
   - 0.6 でも入らないものだけ、今の図の段のスクロール（印あり・1件）を残し、パックで図を直す（5. の content）。
2. **回答欄の下の空き**:
   - 左の列の `grid-template-rows: minmax(0, 1fr) auto` で、回答欄の段の下に空き（6〜8u）が残っている（g2.math.add-column/0・g3.math.mult-2digit/5）。
   - `align-content: safe center` をやめて上そろえ（`start`）にし、図の段がその空きまで使えるようにする。
3. **解説の状態**:
   - 板の分だけ図の段が 4 行未満になるときは、まず 1. の縮みで入れる。
   - 答えが入った回答欄の段は、解説では1行に詰める（札は回答欄の上でなく左）。
4. **大きい字の式のふりがな**: 図の段がスクロールの枠になるとき、枠の `padding-top` を `0.6em` 以上にし、1行目のふりがな（g3.math.time/0「びょう」）を枠の上端で切らない。
- 減る見込み: 数の入力の図の段の scroll-hidden・clipped 246 件のうち、不足が図の高さの 40% 以下のもの（約 150 件）、解説の 4 行未満の clipped 143 画面。
- 確かめ方:
  - 開く画面: `#/dev/unit/g2.math.add-column/0`（1280×720）・`g3.math.mult-2digit/5`（1536×864）・`g3.math.time/0`・`g1.math.add-sub-2digit/4?state=explain`（1280×720）・`g1.math.numbers-120/0`・`g4.math.two-way-table/1`。
  - 10の棒が数えられる大きさ（棒 1 本の幅 1.2u 以上）であること。
  - テスト: `number.render.test.tsx`。

#### V5 読解: 右の列の下端・本文の枠の上端・表（reading）

ファイル: `src/engines/reading/reading.css`、`src/engines/reading/reading.tsx`

1. **右の列を板・吹き出しの下に入れない**:
   - 右の列（選択肢）の下端を、V1 が root に書く `max(--panel-h, --bubble-h)` の上までにする（`max-height: calc(100% − …)`）。読解は作業領域を枠にしないので、列の側で切る。
   - 入らないときは、第3回の data-tight（字 2.2u・行間 1.4・本文:右 1:1.3）を、ヒント・解説の状態でも測り直して付ける。
   - それでも入らないときは `data-tighter` にする。
     - 字: `--text-min`、行間 1.35
     - 選択肢の余白 0.6u、間隔 0.8u
   - 右の列はスクロールさせない（第1回の条件のまま）。下限でも入らないものは、パックの選択肢・解説を短くする（5. の g4-ja・g5-ja・g6-ja）。
2. **本文の枠の上端のふりがな**:
   - `.eng-reading__passage` の `padding-top` を 0.6u から `max(0.6u, 0.6em)` にする（1行目の rt が入る高さ）。
   - 第3回で詰めた「枠の見える高さ 4 行以上」は、印の段を変えずに保つ。足りなければ、大の行の高さ 1.8 を 1.75 にする。
3. **本文の中の表**:
   - 今は表が本文の枠より広く、左の列「なまえ」が枠の左で切れる（g1.ja.read-info/24）。
   - `table { max-width: 100%; margin-inline: auto }`、セルの余白を 0.4u 0.6u にし、枠の左にはみ出さないようにする。列が狭いときは、字を `--text-min` まで下げる。
   - 表のセルでは、「だんご／むし」のような分かち書きの語の途中の改行は、`word-break: keep-all; overflow-wrap: anywhere` のままでよい（狭い列の逃げ）。ただし `table-layout: auto` にして、列の幅を語の長さに合わせる。
4. **印の無い本文の枠**: g1.ja.read-story/25 の問題（1536×864）で、本文の枠に ▼ が無い（scroll-hidden「スクロールできる印が無い」2 画面）。枠の大きさが変わったとき（ResizeObserver）にも、印の付け外しを行う。
- 減る見込み: covered（読解の選択肢・本文の上の板・吹き出し）約 70 画面、clipped（本文の枠の上・左）17 件・574 画面、scroll-hidden（印なし）2 画面。
- 確かめ方:
  - 開く画面: `#/dev/unit/g4.ja.read-summary/33?state=h2`（1536×864）・`g5.ja.read-gist/29?state=h3`（1280×720）・`g5.ja.read-relations/7?state=explain`（1536×864）・`g6.ja.read-argument/8?state=explain`・`g1.ja.read-info/24`・`g5.ja.text-figure/25`・`g1.ja.read-story/25`。
  - テスト: reading のテスト。

#### V6 改行: 記号のまとまり・式の □（base.css・Rt）

ファイル: `src/styles/base.css`、`src/text/Rt.tsx`、`src/text/rt.css`、`src/text/rt-wrap.test.ts`

1. **分かち書きの段階で、記号・分数・空欄を、続く仮名とまとめる**:
   - Rt は、ふりがな付きの語・空欄を `.rt-nobr` にまとめている。
   - 分かち書きの段階（`data-wakachi`）では、次のものも、すぐ後ろの空白までの仮名とまとめる。
     - 記号（`○●□■△▲◎×〜…`）
     - 分数（`[[a/b]]`）
     - 空欄（`{{ }}`）
   - 例: 「○／が つまれるよ」→「○が」、「□／は 2こ」→「（分数）は」、「〜／が」→「〜が」。
   - まとまりが行より長いとき（12 字を超える）は、まとめない。
   - rt-wrap.test.ts に例を足す（g1.math.picture-graph・g2.math.fraction-simple・g2.ja.subject-predicate・g2.math.tables-graphs）。
2. **式の最後の □**:
   - 演算子（`＋−×÷＝`）と、後ろの1つの数・空欄・□（間の空白を含む）を `.rt-nobr` にまとめる。「＝／□」で □ だけが次の行に落ちないようにする。
   - 対象: g4.math.order-ops・g3.math.add-sub-column・g3.math.mult-rules・g6.math.letters の `fig-text--xl`、g6.math.approx-area の「÷／2」（「÷ 2」をまとめる）。
3. 第3回の auto-phrase の組み合わせ（break-word＋min-width: 0＋text-wrap: wrap）は変えない。文節が札より長く、語の途中で折れるもの（「方／向」「一年／生」「は／っきり」）は、CSS の規則ではなく文節の長さが原因なので、パックの文・札の幅で直す（5. の content）。
- 減る見込み: wakachi-split 9 件のうち 6 件、orphan（`fig-text`・`eng-choice__label` の □・2）約 20 件。
- 確かめ方:
  - 開く画面: `#/dev/unit/g2.math.fraction-simple/51?state=explain`（1536×864）・`g1.math.picture-graph/4?state=h2`・`g4.math.order-ops/0`（1920×1080）・`g6.math.approx-area/0`。
  - テスト: `npm run test`（rt-wrap.test.ts）。

#### V7 図の字の余裕・グラフの札・プログラムの印（figure・graph・program）

ファイル: `src/engines/figure/svgText.ts`、`src/engines/figure/Figure.tsx`、`src/engines/figure/figure.css`、`src/engines/graph/graph.css`、`src/engines/graph/graph.tsx`、`src/engines/program/program.tsx`、`src/engines/program/program.css`

1. **最小のわずかな割り込み（0.97〜0.99 倍）**:
   - `lift` の目標の `floor` と、`useSvgTextFloor` の床を、最小の 1.02 倍にする。今は最小ちょうどで、拡大率の丸めや、あとからの fit の変化で 1〜3% 割る。
   - `liftSvgText` を、svg の ResizeObserver でも測り直す。今は描画のあとと viewBox の変化だけなので、fit が変わって svg の表示の大きさが変わったとき、引き上げが古いまま残る。
   - map エンジンの字も `useSvgTextFloor` を使うので、この直しで入る。
   - 確かめる画面: g4.soc.prefectures/201（1536×864・1920×1080）・g2.math.time/2 h1（1920×1080）・g6.math.frequency・g5.math.area-formulas・g3.math.bar-graph/0。
2. **グラフの横軸の札**（`.gr-xlabel--btn`）:
   - ふりがな付きの長い名前（「オートバイ」のように5字以上のもの）で、rt が札の枠の外に出る（g3.math.bar-graph/7、text-outside-box 1 件）。
   - 札の `padding-top` を rt の高さ（0.6em）だけ取り、札の高さを `max(4.8u, 内容)` にする。
3. **プログラムの命令の列の印**: g2.prog.debug/8 の問題・g3.prog.decompose の解説で、命令の列（`.prog-strip`）がスクロールするのに ▼ が無い（2 画面）。列の大きさが変わったとき（ResizeObserver）にも、印の付け外しを測り直す。
4. 2 倍を超えて小さい図（width を書いた図・viewBox が大きい図）の引き上げは、広げない（字が線や他の字に重なる）。これらはパックで直す（5. の prog-g16・soc-g56・en-g34・g5-math）。
- 減る見込み: small-text の (a) 約 450 画面・60 件、text-outside-box 1 件、scroll-hidden（印なし）2 画面。
- 確かめ方: 上の画面を4つの画面サイズで開く。テストは figure・graph・program のテスト。

### 3. 検査の誤検出として直すこと・足すこと（checkerChanges）

ファイル（V1〜V7 とは重ならない）:
- `e2e/helpers/text-layout.ts`
- `e2e/text-layout-probe.tl.ts`（見本を足す）
- `e2e/layout.spec.ts`
- `src/text/rich.ts`・`src/text/rich.test.ts`・`src/curriculum/qa.ts`（静的な検査）
- `docs/test-plan.md`（3.2 に理由と 11 単元を書く）

- **C14 数のあとの助詞（誤検出）**:
  - word-split の「数と単位・助数詞の間」で、数字の次の字が助詞（`は が を に で と の も や へ か`）なら数えない。
    - 仮名で書いた助数詞の頭は、今どおり数える: 「に＋ん」（人《にん》）・「と＋う」（頭《とう》）・「は＋い」（杯《はい》）・「か＋い」（回《かい》）・「か＋げつ」。
  - 理由: 「11／で」「7／は芸術」「資料2／は」「9／で」は、数と助詞の境目で、改行してよい所。7 件・78 画面が全部これだった（g4.soc.tradition/8・g5.ja.read-gist/12・g5.ja.text-figure/25・29・32・g5.math.average/2・7）。
  - 英字の単位（cm・kg など）・漢字の助数詞（年・人・本）・「2こ」「3ばんめ」は今どおり出す。
  - プローブに見本を足す（「11で」「2は」は出さない／「3にん」「2こ」は出す）。
- **C15 0×0 の図（見落とし）**:
  - 舞台の中の `svg`・`img`・`.fig-svg`・`.fig-illust` で、子（`text`・図形）を持つのに幅か高さが 1px 未満のものを、`clipped` で1件出す（説明「図の大きさが 0（見えない）」）。
    - 除くもの: `display: none`・`visibility: hidden`・`aria-hidden` の祖先・`.sr-only`
    - その中の `text` は、clipped・small-text に1字ずつ数えない（二重に数えない）。
  - 理由: 解説の図（width の無いパックの SVG）が 0×0 で見えないのに、字の無い図は何も出なかった。字のある図も「text ⊂ svg（説明なし）」「small-text」として出ていて、原因が分からなかった（g5.math.speed/3・g4.en.directions/35 の解説）。
- **C16 字を横切る正解の輪（見落とし）**:
  - 見えている `.mark--correct` ごとに、同じ札（`.mark` の親のボタン・札）の中の字のうち、中心が輪の線の帯（外接の円から、内側の円 `半径 − border-width` を除いた輪）に入るものを数える。2字以上なら、`covered` で1件出す（説明「正解の ○ が字を横切る」）。
  - 当たり判定（`elementsFromPoint`）は輪の中（透明）を通り抜けるので使わず、円の式で判定する。
  - 字の後ろか前かは問わない。輪の線は、字の後ろでも字を横切って読みにくい。
  - 対象外: 幼児の絵の札（文字が1行・6字以下の札は、輪が字の上下を通るだけなので数えない）。
- **C17 複合辞の文節の切れ目（誤検出）**:
  - 分かち書きでない段階の button-split の「語の途中」で、次の両方を満たすときは数えない。
    - `Intl.Segmenter` の語が、次の複合辞である: という・といった・として・について・にとって・によって・にして・にたいして・をして・とする・とした・とともに・のように
    - 改行が、頭の助詞（と・に・を・の）の直後にある。
  - 理由: 「〜と／いう」「〜に／ついて」は助詞と動詞の境目（文節の切れ目）で、改行してよい所。
  - 同じ語の中のほかの位置（「とい／う」）と、ほかの語の途中（「方／向」「落と／す」）は、今どおり出す。
  - プローブに見本を足す。
- **C18 親字の無い《》（静的な検査を足す）**:
  - `rich.ts` に `findOrphanReading(src)` を足す（直前が漢字の並びでない《》を返す）。
  - `qa.ts` の `findBareKanji` と同じ所で、`よみの親字が無い《…》` を誤りにする。
  - 理由: g3.soc.map-symbols の「×《ばつ》」「Y《ワイ》」は、画面の検査（markup-leak）で初めて見つかった。教材を作った段階（`npm run test` の qa）で止める。
  - rich.test.ts に例を足す。
- **C19 v1 のモードの単元**:
  - `e2e/layout.spec.ts` の `MODES` に `{ id: 'trace', variant: 'letters' }`・`{ id: 'trace', variant: 'maze' }` を足す。p4.hand.letters-classic と p4.hand.lines の maze が、どちらの検査にも入っていなかったため。
  - `e2e/text-layout.tl.ts` の対象（legacy を外す）は変えない。
  - test-plan 3.2 の「対象」に、外れる 11 単元の名前と理由を書く。理由は、v1 のモード（`engine: 'legacy'`）は単元の画面を通らないので、`layout.spec.ts` が受け持つこと。
- 緩めないもの:
  - covered・out-of-stage・clipped の判定
  - small-text の最小（1% の丸めのまま。V7 の 1.02 倍は画面の側の余裕で、検査は変えない）
  - overlap-text の閾値
  - work・explain・figure のスクロールの1件
  - 分かち書きのラベル・語の途中の判定（C17 の複合辞の頭の位置だけを外す）
- どれも、直す前のコードで、プローブの壊した見本が検出されることを確かめる。

### 4. 受け入れるもの（accepted）

画面で確かめたうえで、理由で決めた。子供が読めない・押せない・意味が変わるものは入れていない。

- **読解の本文の枠のスクロール**（印あり）:
  - g4.ja.read-summary/33 h2・g5.ja.read-relations/7 の解説（1536×864）で確かめた。
    - 本文は枠の中で上から読める。
    - 下に「▼ つづき」の段（2.9u・破線・押すと進む）がある。
    - 枠の見える高さは 4 行以上ある。
    - 右の列はスクロールしない。
  - 第1回からの条件どおりで、件には出ない（印が無いもの・4 行未満のものだけが出る）。
- **表の解説の板のスクロール**（印あり）: g2.math.times-tables/2 の解説の九九の表（板の中で 625px）・g5.en.read-words の対応表。
  - 板に ▼ があり、上から読める。表は切らない設計（DESINGN 18章）。
  - 1件として残す。パックで短くできるもの（5. の g2-math の times-tables の解説の図）は直す。
- **text-on-figure**（参考。8 件・11 画面）: 解説の板のふりがなが、作業領域の図の線の上にわずかにかかるもの（g1.math.numbers-20/4・g3.soc.safety/21 ほか）。
  - 字は読め、図は板の後ろにある。
  - V1 の図の出し方と V4 の縮みで変わるので、そのあとに残ったものだけ見る。
- **unstable の 2 画面**（g5.ja.text-figure の作業領域）: 描き直しが 1 秒で終わらない画面。V2・V5 で作業領域の測りが変わるので、次の検査で残ったら調べる（隠さず残す）。
- 受け入れないもの（念のため）: どれも上の V で直す。
  - 幼児の絵の札の作業領域のスクロール（印はあるが、幼児は気づけない）
  - 数の入力の図の段のスクロール（数える・計算する手がかりが隠れる）
  - 吹き出しの最後の行（印が無い）
  - 読解の4つ目の選択肢が板の下（押せない）

### 5. このラウンドで直すもの（content。パックごと）

V1〜V7 のファイルは触らない。教材の文を短くするときは、意味・学年の漢字・《よみ》・分かち書き・ヒントと解説の対応を保つ。英語の文を変えたら、`src/packs/<p>/script-en.json` と `voice/script-en.json` も合わせる。

目安:
- 作業領域: 1280×720 で、fit 0.8 の下限まで縮めずに入ること。V の直しのあとの残りを見込んで、長い文の札は1枚 2 行まで。
- ヒント: 吹き出しの幅 49u（主操作のある画面）で 3 行まで（小3以上 約 60 字、分かち書きの段階 約 45 字）。
- 解説: 板の幅で 4 行まで（図があれば 3 行）。

確かめ方: それぞれの単元を `MNW_UNITS=<単元> MNW_FRESH=1 npm run check:text-layout` で流し、開発用の画面で代表の問題を4つの画面サイズで開く。

- **soc-g34**（g3.soc.map-symbols・g3.soc.city-changes・g3.soc.safety・g3.soc.shop-work・g4.soc.disaster・g4.soc.tradition）:
  - 記法の誤り（必ず直す）: 「×《ばつ》」「Y《ワイ》」を、記号を親字にしない書き方にする（例: 「ばつ（×）」「Y（ワイ）の 形」）。
    - 読み上げ（`yomi.ts` の記号の読み）でも「ばつ」「ワイ」と読まれることを、`npm run voice:packs` の台本で確かめる。
  - city-changes の order・choice の札（19u 足りない）と safety（26u）の文を、1枚 2 行までに短くする。
  - shop-work の graph の札「しんせんさ」の切れと、れいのデータの小さい字（1.78u）を直す。
  - disaster の SVG の字（0.6〜0.87 倍）は、viewBox を詰めて直す。
- **g6-ja**（g6.ja.write-opinion・info-relations・read-argument・read-literature・language-change・classics-read）:
  - write-opinion の order・sort・choice の札（作業領域 38u 足りない）を短くし、根拠などの例文を1枚 2 行までにする。
  - write-opinion のヒント② の長文（吹き出し4行超）と、language-change のヒント③ を、3行にする。
  - read-argument・read-literature の引用の文の選択肢を短くし、解説を4行までにする（右の列が板の下に入る）。
  - info-relations の札（11u）を短くする。
- **g4-ja**（g4.ja.write-report・idioms・info-compare・read-summary・read-feelings・tanka・kanji-read-g4）:
  - write-report の sort・choice・fill の札と選択肢（48u 足りない）を短くする。fill の正解の引用の文は、V3 で折れるようになるが、2 行までに寄せる。
  - idioms の match の札（19.5u）と、解説（3.4 行の超過）を短くする。
  - info-compare・read-summary の引用の選択肢を短くする（右の列が吹き出しの下に入る）。
- **g5-ja**（g5.ja.write-fact-opinion・figurative・text-figure・read-gist・read-relations・spoken-written・classics・honorifics・sentence-relations・kanji-read-g5）:
  - 次の単元を短くする。
    - write-fact-opinion（31u）・figurative（12u）
    - text-figure（48.9u。資料の図と本文を同じ作業領域に置く問題は、図を小さくするか本文を短くする）
    - spoken-written（「は／っきり」「方／向」のように、文節の長さで折れる選択肢）
  - read-gist・read-relations の選択肢と解説を短くする。
- **g3-ja**（g3.ja.write-reasons・read-paragraphs・reference-connectives・romaji・proverbs・read-character・haiku・listen-memo）:
  - write-reasons（13u）・read-paragraphs（21u）の札と選択肢を短くする。
  - reference-connectives のヒント②（つなぎ言葉の種類を全部並べている）と、romaji のヒント② を、3行にする。
  - read-character の「→」を使った長い選択肢を、2行までにする。
- **g2-ja**（g2.ja.write-structure・read-info・read-story・listen-notes・subject-predicate・kanji-read-g2）:
  - write-structure の札（18u）を短くする。
  - read-info/24 の「二年一組」の折れは、本文の分かち書きの区切り（読点のあと）を pack-brief どおりにする。
  - read-story/15 の「歌いはじめました／。」の1字の行は、本文の語を1つ減らすか、区切りを変える。
  - kanji-read-g2 の解説を4行までにする。
- **g1-ja**（g1.ja.read-info・read-story・write-order・listen）:
  - read-info/33・read-story/33 は、order の作業領域に本文（6文）を図として置いていて、49u・98u 足りない。本文を札そのものにする（札＝本文の文）か、並べる文を4つにして本文の図を外す。問いの意味（説明の順・お話の順）は変えない。
  - write-order の解説（6.9u）を短くする。
- **p5**（p5.ja.story-listen・p5.math.shapes・p5.think.pattern・p5.think.why・p5.math.add-sub・p5.env.predict）:
  - story-listen の order の札（11.5u）を、1枚 6 字までの句に短くする。
  - shapes（24u）・pattern（37u）は、絵の数か列を、並びの規則が分かる最小の数に減らす。
  - think.why（29u）の「ほかの わけ（えで かこう）」の札と、絵を描く欄の大きさを、作業領域に入る形にする。
  - env.predict・add-sub の解説を3行までにする。
- **en-g56**（g5.en.where・read-words・listen-self・g6.en.past・places・future・sentence-write）:
  - 解説の英文の図（`fig-text` の大きい字。g6.en.future/0 で 1 行 5u）を `--m` にして、板に入れる（where 6.7 行・past・future 5.9 行の超過）。
  - past・places・future の絵＋文の選択肢（12u）の文を、語の数を減らして短くする（例: 「アイスクリームを たべた」）。
  - read-words の作業領域（18u）と、解説の対応表を短くする。
  - 英文を変えたら script-en を合わせる。
- **en-g34**（g4.en.directions・want・time-days・g3.en.greetings・likes・numbers-colors）:
  - directions の地図の SVG（width を書いた図。字 0.46 倍）の viewBox を詰めて、字（「スタート」「パンやさん」）を大きくする。
  - greetings の解説の図と want の解説を、板に入れる。
- **soc-g56**（g6.soc.world・g5.soc.food・land・environment・information・g6.soc.history-1・history-2・history-3・politics）:
  - world の地図の ⑥（0.62u。南極の帯の中の番号）と番号の字を、最小以上にする（viewBox を詰めるか、番号を外に出す）。
  - food・land の graph の作業領域と字を直す。
  - history-1〜3・politics の選択肢と札の文を、2行までにする。
- **prog-g16**（g2.prog.debug・g6.prog.efficient・g4.prog.prefecture-finder・g6.prog.sensor・g1.prog.condition・g2.prog.repeat・g5.prog.debug-plan）:
  - debug の盤（width を書いた幅 9u の盤。字 0.78 倍）と efficient（0.41 倍）について、`kit.ts` の gridFigure の大きさを、字が最小以上になる幅にする。
  - prefecture-finder の解説で、A・B・C の印が名前に重なる配置を直す。
  - sensor の時刻の目盛りの重なりを直す。
  - condition・repeat のヒント③ を3行にする。
  - 実施（prog-g16。6単元 31問×4サイズで再検査。debug・sensor・condition・repeat・prefecture-finder は 0 件、efficient は 20 画面の 1 件だけ残る）:
    - **efficient の道の図（routesFigure）**: A・B・C の字を地図のマスの中でなく右の凡例（線の見本＋字 2.1u）に出した（マスの中では 0.7u）。解説の長さ（n8・n18）は「どうして」の文と最後の文を短くして板に入れた。「左の カードを 「いまの」に する」の語の途中の改行は、「を」のあとに空白を足した。
    - **debug の番号（stripFigure の numbered）**: 札の列の番号を 2.2u にした（viewBox の字を「2.2u × H ÷ hU」で決め、hU は 6.5）。
    - **prefecture-finder の凡例（legendFigure）**: 1行 460 単位（78u）を、幅 600 単位（60u）・字 1.9u の 2 行にした。ふだは hU 6.2 まで。budget.test の見積り（あふれは 3u まで）を満たす。
    - **sensor の時刻の表（timelineFig）**: 「10じ」を「10」にして「じかん」の見出しに単位を預け、字 2u・1 単位 0.1u で描いた。
    - **condition・repeat のヒント③**: 「かべの まえで みぎを むきたいよ。「かべなら」「あいていたら」の どちらかな。」「はじめは「…」を くりかえすよ。なんかい くりかえすか かぞえよう。」（吹き出しの 4 行 → 3 行）。
    - **残り（efficient/11）**: 札の列を 3 つの選択肢の札（約 11u）に入れると「くりかえす 2かい」の 2 が 0.54u になる。`.eng-choice__opt` の絵の幅は `--pic-max`（高さから決まる）で抑えられ、ボタンの字を 5字以上にしても（is-caption）同じ。engine（choice.css）の選択肢の絵の幅の上限を、横長の図だけ緩める必要がある。
- **g6-math**（g6.math.approx-area・scale・prism-volume・circle-area・frequency・letters・fraction-mult・proportion・inverse・symmetry）:
  - approx-area の図（6.2u 足りない・字 0.61 倍）と、選択肢の式「÷ 2」を直す。
  - scale の「C」と「10cm」の重なりを直す。
  - prism-volume・frequency・letters の図の段の不足（7〜22u）を、図を小さくして入れる。
- **g5-math**（g5.math.speed・angle-sum・per-unit・pie-band・area-formulas・congruence・fraction-equiv・polygon-circle・proportion-simple・decimal-shift・decimal-mult・decimal-div・percent・average）:
  - angle-sum（75°・90° の重なり）は、三角形を次のどちらかにし、角の字を図の外側に置く。
    - 極端に細くならない角の組（どの角も 25° 以上）
    - 「図は正確ではありません」の模式図
  - speed・per-unit の数直線の字（解説で 0.4〜0.9 倍）と、pie-band（18u）・fraction-equiv（23u）・polygon-circle（19u）の図の大きさを直す。
- **g4-math**（g4.math.two-way-table・oku-cho・order-ops・div-1digit・div-2digit・decimal-add-sub・decimal-int・abacus・area・cuboid・ratio-intro・fraction-same・fraction-kinds・angle・quadrilaterals・line-graph）:
  - two-way-table の 12 行の表（42u）を、行と列を入れかえて横長の表にする。
  - oku-cho の解説（33.6 行分・横にもはみ出す）は、位取りの表を短くして4行までにする。
  - abacus（26u）・area（13u）・cuboid（14.6u）の図を小さくする。
  - div-1digit・decimal-add-sub・decimal-int の解説を短くする。
- **g3-math**（g3.math.mult-1digit・mult-2digit・add-sub-column・division-remainder・abacus・time・weight・circle-sphere・mult-rules・fractions・length-km）:
  - division-remainder（139u）・mult-1digit（56u）の図（●の並び・筆算）を、まとまり（10 ずつの列など）で描いて小さくする。
  - abacus（24u）・circle-sphere（23u）・weight（11u）の図を小さくする。
  - add-sub-column・mult-2digit の解説（6 行）を、4行までにする。
- **g2-math**（g2.math.add-column・sub-column・add-sub-3digit・times-tables・mult-meaning・fraction-simple・box・time・length・numbers-1000・numbers-10000・mult-beyond・volume）:
  - mult-meaning（46u）・box（13.6u。縦長の面の選択肢4つ）・times-tables（43u の解説の表）の図を小さくする。
  - add-column・sub-column・add-sub-3digit の解説（3.8 行の超過）と、numbers-10000 の解説の横のはみ出しを直す。
  - fraction-simple の図の段の不足（0.5〜2u）は V4 で消える見込み。残れば図の高さを詰める。
- **g1-math**（g1.math.numbers-120・numbers-20・sub-borrow・add-sub-2digit・story-expression・position・add-carry・picture-graph）:
  - numbers-120（31.8u）・numbers-20（16.8u）・sub-borrow（17.9u）の 10 の棒・数の表を、まとまり（10 の棒を横に並べる）で小さくする。
  - story-expression の explain・match の作業領域（15u）を短くする。
  - position（13u）の選択肢の文を短くする。
- **sci-g56**（g5.sci.weather-change・g6.sci.moon-sun・combustion・solutions・body・electricity-use・strata・plant-water・ecosystem・g5.sci.electromagnet・dissolve）:
  - weather-change（30u）・moon-sun（34.5u）の図を小さくし、札を短くする。
  - ecosystem の表の見出し「ふくろの／中」と、plant-water・dissolve・body の札の語の途中の折れを、札の文を短くして直す。
- **sci-g34**（g3.sci.magnets・wind-rubber・circuits・light-sound・weight・g4.sci.rainwater・air-water・seasons-life・weather・current・moon-stars）:
  - rainwater（10u）・magnets（9.9u）・circuits（9.2u）・seasons-life・air-water を、札・選択肢を短くして作業領域に入れる。
  - weather の `exp-note` がふりがなを隠すもの（covered 16 画面）は、注の位置か文で直す。
  - 分かち書きの札の折れ（「は／かる」「の／せる」）を直す。
- **kanji-g12・kanji-g34・kanji-g56**（g2.ja.kanji-read-g2・g4.ja.kanji-read-g4・g5.ja.kanji-read-g5）: 解説（2.6〜3.6 行の超過）と、g5 の fill の作業領域（4.7u）を短くする。
- **p23**（p23.math.shape-match・p23.ja.picture-book・sound-play・word-listen）・**en-pre**・**p4** は、文を変えない。V2（語のラベル・絵の札の高さ）で消える見込み。
  - V2 のあとの検査で残ったもの（「はな（くさばな）」が2行になる札など）は、統括がまとめて見る。
  - shape-match/28 の「はんぶんの まる」「ながしかく」の札は、V2 で入らなければ、ラベルを省いて絵だけの札にする（名前は音声で言う）。

### 6. g2-ja の直し（第4回・content。実装結果）

対象: g2.ja.write-structure・read-info・read-story・subject-predicate（`src/packs/g2-ja/**` だけ）。`MNW_UNITS=<この4単元> MNW_FRESH=1` で 4単元とも違反 0（write-structure 18u・read-info/10・24・read-story/15・subject-predicate/46 の ○ を含む）を確かめた。

- **write-structure の札（18u → 0）**: 文の札を、箱の中（幅の狭い列。1行 10 字ほど）でも2行までに収める。
  - 6つの文章すべてで、「なか」の文を3つから2つに減らした（札は5枚 → 4枚）。箱の中の札が2行 ×3 枚だと、解説の板との合計が作業領域に入らない。はじめ・おわりの札は2行までの長さ（17字以内）にした。
  - 「なか」の札のうち1枚は、1行（10字以内）にした（2行の札2枚だと、解説の状態で 3.2u 足りない）。
  - 解説の文を2行にした（「のこりの 三つは くわしく かいた なかの ぶんです」→「のこりは なかです」）。
  - 題の長い「としょかんの しょうかい」→「としょかん」（問題文が2行になって作業領域を食っていた）。別例の「なかに かく ことを えらぶ」問題の問題文も1行にした。
  - 別例の「はじめ・なか・おわりの じゅんに ならべる」（order。pool/nawatobi/otetsudai）は、札を 13 字以内の1行にした（2行の札4枚だと解説の状態で 4〜10u 足りない）。
  - 文の意味・学年の漢字・《よみ》は変えていない。つなぎ言葉・見直しの問題は変えていない。
- **read-info/24 の「二年／一組」**: 本文の「二年一組」は、「二年」（ふりがなを出さない）の後ろの「一組」（ふりがなを出す）の境目で行が折れる。ふりがなの付く語の前で折れるのは本文の組み方の仕様なので、本文の語を「クラス」にして境目をなくした（題の「二年一組の すきな あそび」はそのまま）。読点のあとの分かち書き（「けっかから、 クラスでは、 走りまわる」）は pack-brief どおりに空白を足した。
- **read-info/10 の解説（枠が4行未満）**: 解説の引用を1文にして2行にした。
- **read-story/15 の「歌いはじめました／。」**: 読点のあとに空白を入れて、「歌いはじめました。」が1つのまとまりとして次の行へ送られるようにした（語は減らしていない）。
- **subject-predicate/46 の ○ が字を横切る**: 「しゅごの ない ぶん」の選択肢を、どれも 13 字以上にした（`optionTraits` の long: 12 字を超える選択肢がある問題は、○ を札の右上の角の小さな ○ にする）。解説は「しゅごが ありません」に短くして2行にした。

### 7. g5-math の直し（第4回・content。実装結果）

対象: g5.math.speed・angle-sum・per-unit・pie-band・fraction-equiv・polygon-circle・area-formulas（`src/packs/g5-math/**` だけ）。`MNW_UNITS=<この7単元> MNW_FRESH=1` で 6〜8 問 × 5 状態 × 4 サイズを再検査し、**speed・angle-sum・per-unit・pie-band・polygon-circle・area-formulas は 0 件**。fraction-equiv だけ、解説の「正解の ○ が字を横切る」が 12 画面（n=3・4・5。下の「残り」）。

- **共通（util.ts の `svg`）**: 第5引数 `widthU` を足した。書くと、その幅（`calc(var(--u) * widthU)`）で描く。書かないと、図の幅は「最小の字が最小になる幅」と 23u の大きいほうになり、字が少ない・縦長の図は 23u で縦に伸びて図の段（約 14u）に入らなかった（fraction-equiv 23u・polygon-circle 19u・pie-band 18u の原因）。字は viewBox の単位で、画面では「字 × widthU ÷ viewBox の幅」（u）。最小（1.73u）以上になるよう、図の大きさと字を決める。
- **speed・per-unit の数直線（util.ts の `doubleLine`）**: 字を 15 → 20、図を 400×128 → 376×118 にそろえた。解説の枠（幅の小さい図）でも字が最小を割らない（0.4〜0.9 倍 → 1 倍以上）。解説の図が 0×0 になる不具合は、共通の直し（unit.css）で直っている。
- **angle-sum**: 角の字を、角の二等分線の外側（図の外）に置く（`outsideLabel`）。viewBox は図と字の枠の外接に合わせる（`labeledFig`）。三角形の「のこりの角」は、どの角も 25° 以上の組だけにした（`twoAngles` の下限 15・20 → 25）。外の角の図は、ア を外がわの角の二等分線の上に、角が狭いほど頂点から離して置く。図の幅は字が最小以上になる幅。
- **pie-band**: 「のこりの割合」の表を、たて 7 行 → 横長（見出し＝種類・合計、行＝割合）にした。図の段に入る。
- **fraction-equiv**: 「n/d ＝ □/d'」を、式（大きな字）＋小さな SVG の横並びから、**1つの横長の SVG**（`fracEq`。字 26 → 23u の幅で 3.7u）にした。
- **polygon-circle**: 正多角形・円の図を 220×200 → 160×148、幅 13u（字 22 → 1.79u、高さ 12u）にした。くさびの字は、n が大きいほど中心から離し、辺の内側に収める。正多角形を選ぶ選択肢は、並べ方を grid → row にした。
- **area-formulas**: 長さの字（cm）を、図の外側・点線のわきに置く（辺・点線・ほかの字に重ならない所を、距離を変えて探す。`draw`）。図形は 150×72 に収め、図の高さが 118（12.5u）を超えるときは図形を小さくする。幅は字が 1.8u になる幅。ひし形の対角線の字は、対角線の端に置く。
- **テスト（図の書き方が変わったもの）**: review-g5a（図の高さの比。座標を 0.1 に丸めるので許す差を 1e-6 → 0.05 に）・review-g5d（pie-band の表が横長になった）・review-g5e（speed の数直線の字の y=114 → 106、x の基準 40 → 34）。内容の検査は変えていない。
- **残り（fraction-equiv n=3・4・5 の解説・12 画面）**: 選択肢が「[[16/24]] と [[3/24]]」のような横長の分数の並びのとき、正解の ○（札の高さの真円）が分数を横切る。共通の直し（V6）の「文字が長い選択肢は角の小さな ○」は、12 字を超える文字だけの選択肢に限るので、分数の並びには効かない。パックでは直せない。engine（ui.css の `.mark--correct`・choice の `traits.long`）で、分数・式を含む横長の選択肢にも角の ○ を使うようにする必要がある。g3.ja.romaji・g3.soc.city-changes・g3.en.greetings の「正解の ○ が字を横切る」も同じ原因。

### 8. g3-ja の直し（第4回・content。実装結果）

対象: g3.ja.write-reasons・read-paragraphs・reference-connectives・romaji・read-character・proverbs（`src/packs/g3-ja/**` だけ）。`MNW_UNITS=<この6単元> MNW_FRESH=1` で、6単元とも違反 0（直す前の結果は write-reasons 21 画面・read-paragraphs 26 画面・proverbs 18 画面・romaji の○・read-character と reference-connectives の折れ）。

- **write-reasons（作業領域 13u 不足）**: 考え・理由・まとめの札と選択肢を、1文 1〜2 行に短くした（「わたしは、クラスでミニトマトを育《そだ》てたいと思《おも》います。」→「ミニトマトを育《そだ》てたい。」など）。理由の文は「〜からです。」で終える（「また、体《からだ》が強《つよ》くなるから。」は「…からです。」に戻した）。れいは「たとえば、」ではじめる。別例の match の解説は「どうして？」の答えが理由、と意味を言う文にした。
- **read-paragraphs（作業領域 21u 不足）**: 段落を並べる問題の札を、問い・まず・つぎに・まとめの1行ずつにした。ヒント①〜③と解説は札の語（まず・つぎに・このように・そこで）に合わせた。せっけんのまとめは「だから、せっけんで落《お》ちます。」。ホウセンカの記録の最後の札は「花《はな》がさきました。」にして、ヒント③を「花がさいたのは、たねをまいたあとだね。」にした（札を短くしたあと「わかりました」の札ではなくなったため）。選択肢の「れいをあげてくわしく／せつめいしている」は「くわしく」を除いた（語「くわしく」の途中で折れていた）。
- **reference-connectives**: ヒント②がつなぎ言葉の種類を全部並べていたので、「理由・ぎゃく・つづきなど、どんなつながりかな。」の1文にして3行に収めた。
- **romaji**: ヒント②（sok・long・yoon・kunrei・plain）を 1〜2 文・3行以内にした。別例の名前のつづりを選ぶ問題を「とっとり」→「べっぷ」（Beppu）にした: 7 字の「Tottori」だと、正解の ○ の輪が中の字を横切った（検査は 1 行・6 字以下の札は数えない）。「Beppu」は 5 字で輪が字の上下を通るだけ。誤りは beppu（大文字）・Bepu（小さい「っ」ぬけ）。
- **read-character**: 「→」を使った長い選択肢（一度いやになっても…など）を、2行までの長さにした（「小《ちい》さな声《こえ》だった → 声《こえ》が大《おお》きくなった」など）。意味・学年の漢字・《よみ》は変えていない。
- **proverbs**: 作業領域の不足（札が長い）は、図の文（scene）と shorts（意味の短い言い方）を短くして直した（「あわてずたしかにする」など。意味は変えていない）。正解の ○ が字を横切る 6 問（scene の ishibashi・uma・toudai、similar の neko・chiri・ishibashi）は、誤りの選択肢の1つを 13 字の「のうあるたかはつめをかくす」にして、選択肢に 12 字を超えるものがあるようにした（`optionTraits` の long。○ が札の右上の角の小さな ○ になる）。どの問題の場面・意味とも合わない（p-mix）ことは、場面とにた意味の説明で確かめた。
- 読み上げの台本は `npm run voice:packs` で作り直した（voice/packs/g3-ja.json。音声ファイルは作っていない）。`npm run chars` の used-chars は変わらなかった（フォントの作り直しなし）。

### 9. g2-math の直し（第4回・content。実装結果）

対象: g2.math.mult-meaning・box・times-tables・add-column・sub-column・add-sub-3digit・numbers-10000（`src/packs/g2-math/**` だけ）。`MNW_UNITS=<この7単元> MNW_FRESH=1 MNW_WORKERS=2` で 4〜8 問 × 5 状態 × 4 サイズ（延べ 840 画面）を再検査し、**7単元とも 0 件**（直す前の第4回の結果は、box の選択肢が 13.6u・mult-meaning が 46u・times-tables の解説の表が 43u 足りないなど）。

- **共通（util.ts の `dotArrayFig`）**: ●のアレイ図を、「●●●」の文字 b 行の column から、SVG の円に変えた（mult-meaning の alt・文章題、times-tables の alt・解説・きまり・文章題）。
  - 原因: 文字の ● は 1 行が約 5u で、7 れつ以上で 35〜46u になり、作業領域・解説の板（22u）に入らなかった。
  - 直し方: 円の間隔は「12u ÷ max(a, b, 5)」にして、図全体を 12u 四方に収める（解説の図の上限 12u と同じ）。幅は style（`calc(var(--u) * …)`）で書く。幅の無い図は 23u に広がり、2 × 9 のような縦長が 100u を超えるため。字が無いので、字の最小の大きさ（liftSvgText）は関係しない。
  - 子供から見ると、●の数は数えられる（1.3〜2.4u の円。9 × 9 でも 1.3u 間隔）。式・文は変えていない。
- **box（13.6u → 0）**: 面の絵（`faceFig`）と箱の絵（`boxFig`）の SVG に幅（1cm = 1.4u）を書いた。
  - 原因: 面の絵は幅が無く、23u に広がる（2cm × 6cm の面は 23u × 69u）。縦長の面の選択肢4つで作業領域が約 4 倍になっていた。
  - 直し方: 6cm でも 9u 弱になる。札の中に「3cmと 6cm」の文字と絵が入る。面の大きさの比は変えていない。
- **add-column・sub-column・add-sub-3digit の解説（3.7〜3.8 行 → 0）**: 別例（ブロック・式）と文章題の `explainFigure`（筆算の表）をやめた。
  - 原因: 解説の板は 22u まで。筆算の表（見出し＋3行）は約 22u で、文 2〜3 行と合わせて入らない。表の行を省く案（見出しなし・答えの行に答えを入れる）も試したが、表 3 行（約 16u）＋文 2 行で、まだ 1.8 行足りなかった。
  - 直し方: 別例の問題の図（ブロック・式）は解説でもそのまま見え、位ごとの計算は解説の文に書いてあるので、解説の図は置かない。ふつうの筆算の問題は、もともと問題の図が筆算の表。ヒント・解説の文は変えていない。
  - add-column の「くりあがりが2回（答えが 3 けた）」の解説だけ、文が3行になって図の段が 3u 足りなかった（n=4）。くらいの名前（いちの くらい・じゅうの くらい）を省いた2行の文にした（「8 ＋ 9 ＝ 17 で、7を かいて 1を くりあげる。1 ＋ 3 ＋ 7 ＝ 11 で、ひゃくの くらいに 1。こたえは 117 です。」。意味・学年の漢字は同じ）。
- **numbers-10000 の解説の横はみ出し（3.5u → 0）**: 位の表（`table4`）の見出しを「せんの くらい」「ひゃくの くらい」… の4列（約 70u）から、先頭の列「くらい」＋「せん」「ひゃく」「じゅう」「いち」（行は「かず」）にした（約 45u）。「いちの くらい」の ふりがなが解説の板の右で切れ、回答欄の札「1ばんめの こたえ から」に重なる件もなくなった。問題の別例（くらいの ひょうの かずを すうじで かこう）の表も同じ。
- **読み上げの台本**: `npm run voice:packs` で voice/packs/g2-math.json を作り直した（図の表の見出し・add-column の解説の文が変わった。音声ファイルは作っていない）。`npm run chars` の used-chars-elementary.txt は、ほかのパックの追加（「枠」）で変わっている。g2-math の文は新しい字を使っていない。
- **確かめた画面**: `#/dev/unit/g2.math.box/1`（1280×620）・`times-tables/2?state=explain`・`mult-meaning/2`・`add-column/0?state=explain`・`numbers-10000/3?state=explain`。
- **g2-math で残るもの（対象外）**: fraction-simple・numbers-1000・time・volume（別の担当・V4 のあとに残ったもの）。

### 10. g3-math の直し（第4回・content。実装結果）

対象: g3.math.division-remainder・mult-1digit・mult-2digit・add-sub-column・abacus・circle-sphere・weight（`src/packs/g3-math/**` だけ）。`MNW_UNITS=<この7単元> MNW_FRESH=1 MNW_WORKERS=2` で、seed 2（8 問）・8（32 問）× 5 状態 × 4 サイズを再検査し、**7単元とも 0 件**（mult-1digit・mult-2digit・add-sub-column は seed 16 でも確かめた）。直す前は division-remainder の●の並び 139u・mult-1digit の 10 の棒 56u・abacus 24u・circle-sphere 23u・add-sub-column と mult-2digit の解説 6 行など。weight は共通の直し（T/V）のあとは 0 件で、パックでは変えていない。

- **まとまりの図（`util.ts` の `bundleFigure`、`division-remainder.ts` の `groups`）**: ●のならびと 10 の棒・100 の板を、「まとまり1つを枠」にした SVG で描く。ボールの絵を d × q 個ならべると 139u・ブロックを b 組ならべると 56u になっていた。
  - 枠の中は 5 つずつ（6 つ以上は 2 段）。枠のならべ方（1行に何枠か・枠の中を何段か）は、幅 56u・高さ 12u に入る組のうち、いちばん大きく描ける組を選ぶ。あまりの枠は点線・● は白ぬき（色だけで区別しない）。字は描かない。
  - mult-1digit の 10 の棒は縦長の棒、100 の板は正方形。式・文は変えていない（「100の まとまりが 9こずつ、3つ」）。
- **筆算の図（`util.ts` の `columnFigure`）**: 表（位の名前の見出し＋行）をやめて、罫線の筆算の SVG にした。mult-1digit・mult-2digit・add-sub-column の q・h1〜h3 の図の段（4.8〜13.5u 不足）と、解説の図（2〜18u 不足）の原因は、表が 4〜6 行で約 22〜26u あったこと。
  - 1けた 2.4u・1行 2.4u・字 2u で、いちばん大きい mult-2digit の「とちゅうの数」（5 行）でも 12.8u。位の名前は答えの欄の札（「十のくらい」）にあるので、見出しは省いた。
  - 字は数字と記号だけなので、行の外接が字の高さの 1.12 倍の欧文の字体（`Arial, Helvetica, sans-serif`）にした。本文の字体（Zen Maru Gothic）は外接が 1.45 倍で、行の間 2.4u の筆算だと行ごとの外接が重なり、overlap-text が出た（図の字を最小に引き上げたあとの大きさで測るため）。文字（？）は ASCII の「?」・「＋」は「+」にして、字体を欧文のものにそろえた。
  - 解説の図（`explainFigure`）は、答え（mult-2digit は 1だんめ・2だんめも）を書いた形にした（これまでは答えの行が ？のまま）。
- **解説の文を 4 行に（add-sub-column・mult-2digit・mult-1digit）**: くらいごとの計算を、短い言い回しにした。意味・学年の漢字・《よみ》・ヒントとの対応は変えていない。
  - mult-2digit: 「一のくらい: 65 × 2 ＝ 130。十のくらい: 65 × 4 ＝ 260（1けた 左に ずらして 2600）。130 ＋ 2600 ＝ 2730。答えは 2730です。」（これまでは「一のくらいの 2を かける」「じっさいは 65 × 40 ＝ 2600なので」などで 9 行分）。
  - add-sub-column: ひき算は「かした・かりた」のわけを、引く数の上の数（かした・かりたあとの数）のそばに（「十のくらい: 12 − 5 ＝ 7（1 かして、10 かりた）」）。長いときは、わけを省いた形（`short`）→ くり上げ・くり下げのからまない位を 1 つにまとめた形、の順に短くする。図つき（横書きの式を筆算に直す問題）の上限は 78 字、図なしは 100 字（《よみ》を除く）。たしかめ（ひき算）は入るときだけ。
  - mult-1digit: 3 けた × 1 けたのくり上げの書き方（「9を 書いて 4 くり上げる」）は、長いときだけ式（「十のくらい: 5 × 7 ＋ 4 ＝ 39」。くり上がりは かけたあとに たす）にする。
- **選択肢の図の幅（abacus・circle-sphere）**: そろばん（7・6・4 本のけた）と円の図は、幅を書かないと札いっぱいに広がり、4 つで 36u（作業領域の 25u を超え）になっていた。
  - そろばんは高さ 8.6u になる幅（`abacus-svg.ts` の `optionWidth`。7 本 12.6u・6 本 11u・4 本 7.9u）、円は 9.5u。2 段で作業領域に入る。選択肢の図と、そのほかの図（問題・解説）の大きさは分かれた。abacus.test.ts は選択肢の図の期待を幅つきにした。
  - 「数を おく」（set）の解説は、図（そろばん）を置かない。選択肢の中に正解の図があり、文（千の くらいは 6（五だまと 一だま 1こ）…）が 3 行になるので、図を足すと板（22u）に入らない。
- **読み上げの台本**: `npm run voice:packs` で voice/packs/g3-math.json を作り直した（解説の文が変わった。音声ファイルは作っていない）。`npm run chars` の used-chars は変わらなかった（フォントの作り直しなし）。
- **確かめた画面**: `#/dev/unit/g3.math.mult-1digit/3`（100 の板）・`mult-2digit/1`・`/3?state=explain`・`add-sub-column/0?state=explain`・`abacus/0`・`abacus/3`・`circle-sphere/7`（1280×720）。

### 11. sci-g34 の直し（第4回・content。実装結果）

対象: g4.sci.rainwater・g3.sci.magnets・g3.sci.circuits・g4.sci.seasons-life・g4.sci.air-water・g4.sci.weather・g3.sci.weight（`src/packs/sci-g34/**` だけ。絵 `src/illust/content/sci-g34.tsx` は触っていない）。`MNW_UNITS=<この7単元> MNW_FRESH=1 MNW_WORKERS=2` で、直す前の 作業領域の不足（rainwater 10u・magnets 9.9u と 3.5u・circuits 5u と 9.1u・seasons-life 6.5u と 7.3u・air-water 8.1u・weather 5.2u・weight 4.7u）・分かち書きの札の折れ・weather の exp-note に ふりがなが隠れる covered 16 画面は、すべて 0 になった（rainwater は 0。ほかの単元に残る正解の ○ は下の「残り」）。

- **rainwater**: 選択肢を短くし、表を横長にした。
  - 土の つぶの表（rs-table）は 4 行 3 列 → 3 行 4 列（見出し＝土・じゃり・すな・校庭の 土、行＝つぶ・時間）。問題文は 1 行（「しみこむ 時間の きろく（れい）。わかる ことは？」）。選択肢は「小さいほど おそい」「大きいほど おそい」「かんけい ない」。ヒント①②③は「らん」を「ところ」に合わせて直した。
  - つぶの図（rs-svg-grains）は、「あ」「い」の字を図の上ではなく左に置き（1 行の並び）、問題文を 1 行にした。
  - 地面の だんめんの図（rw-svg-ground）の選択肢は「まん中」「左はし」「右はし」にした（「たいらな／所」の折れと、狭い札の 3 行折れ〔narrow-wrap〕を避ける）。解説の「まん中の くぼみ」で意味は残る。
- **magnets**: ことばの選択肢（po-words）を「ちがう きょくは 引き合う」「同じ きょくは 引き合う」「どの きょくでも 引き合う」にした（長い 2 文の選択肢をやめた）。はさむ ものの表（pw-table）は問題文を 1 行にし、「下じき（プラスチック）」→「下じき」、「ノート 1さつ（あつい）」→「あつい ノート」、選択肢を 13 字以内にした。解説は変えていない。
- **circuits**（lp-sort）: 札を 8〜14 字にした（「わに なって いる」「むきを ぎゃくに した わ」「どう線が 1本 はずれた」「2本とも ＋きょくに つけた」「どう線が 切れて いる」）。問題文・ヒント③・解説を合わせて短くした（解説の状態の 9.1u 不足 → 0）。
- **seasons-life**: 札「ヘチマの くきが ぐんぐん のびる」→「ヘチマの くきが のびる」（「の／びる」の折れ）。解説づくりの問題（st-explain-compare）は、問題文を 1 行にし（書いてもいいよ を省いた）、理由の選択肢を 4 つから 3 つにした（「気温が 上がった」「下がった」→「気温が かわった」）。右の列（理由＋ペン）が作業領域に入る。
- **air-water**: 選択肢を 12 字以内にした（「うきわが へこむから」「空気は 見えないから」「水は かわらないから」。「うきわを おすと へ／こむから」の折れ）。表の問題は問題文を 1 行にし、選択肢を「小さいほど 手ごたえが 大きい」ほかにした。札「ペットボトルいっぱいの 水」→「ボトルいっぱいの 水」（「／水」の折れ）。
- **weather**: 場所の表・選択肢・札の「日光が 当たらない 風通しの よい 所」→「日かげで 風通しの よい 所」（別の問題と同じ言い方にそろえた）。長い札が注（`exp-note`）の下に回り込んで ふりがなが隠れていた（covered 16 画面）のが無くなった。注の位置は変えていない（エンジンは触らない）。
  - 札「時こくと 気温を きろくする」→「気温を きろくする」（「きろく／する」の折れ）。「天気と 気温の 関係」の選択肢は 1 行〜2 行の短い文にした（5.2u 不足 → 0）。別例（me-sort）の解説を 2 行にした。
- **weight**: 札「はりが 0で ない まま のせる」→「0を たしかめず のせる」、「もう いちど 重さを はかる」→「もう いちど はかる」（「は／かる」「の／せる」の折れ）。はかりの 分ける問題は問題文と解説を短くした（解説の状態 4.7u 不足 → 0）。選択肢「木は プラスチックより かるい」は 狭い札で「プラスチックよ／り」と折れるので、「木が いちばん かるい」にした（表から正しい）。
- 学年の漢字・《よみ》・分かち書きは既存に合わせた（「日」は「日《ひ》かげ」と書いた。vitest の 漢字検査）。ヒント・解説の対応は保った。他社教材の文は写していない。
- **読み上げの台本**: `npm run voice:packs` で voice/packs/sci-g34.json を作り直した（音声ファイルは作っていない）。`npm run chars` の used-chars は変わらなかった。
- **確かめた画面**: `#/dev/unit/g4.sci.rainwater/14`・`/17`・`/2`、`g3.sci.magnets/18`・`/26`、`g3.sci.circuits/6`、`g4.sci.seasons-life/17`・`/20`、`g4.sci.air-water/1`・`/7`・`/15`、`g4.sci.weather/0`・`/6`・`/8`・`/26`、`g3.sci.weight/9`・`/19`・`/30` を、4 つの画面サイズ × 問題・ヒント①〜③・解説で（作業領域の不足 0・札の折れ 0）。
- **残り（対象外・エンジンの正解の ○）**: circuits/2・magnets/13・air-water/1・10・23・weather/9 の解説の状態で、正解の ○（`span.mark`）が選択肢の字にかかる covered が 20 画面ある。パックの文ではなく、choice の ○ の出し方（g5.en.read-words など ほかの単元にも出ている同じ種類）なので、パックでは直していない。

## 第6回（2026-11-01・分析と設計）

第5回は全単元の検査がリソース不足で落ち（305 単元が失敗）、分析していない。第4回の直し（7f8ebb9・a3814b8）のあとに流し直した結果を使って、第6回の分析をする。

### 0. 元の結果と、追加で測ったもの

- 元の結果: `docs/screenshots/text-layout-report/`（作成 2026-10-31T15:43Z。313 単元・10,056 問・191,860 画面。全件は `.cache/text-layout/units/`。単元の errors は 0）。件は 333（第4回の前は 1,883）。違反のない単元は 208 / 313。
  - 件の内訳: covered 192・scroll-hidden 79・orphan 18・overlap-text 11・clipped 10・kinsoku-start 7・button-split 7・narrow-wrap 4・small-text 2・text-on-figure 2・text-outside-box 1。markup-leak・wakachi-split・word-split・out-of-stage・overlap-button は 0。
  - `shots/markup-leak/` の画像は前の実行の古いもの（この実行の markup-leak は 0 件。検査は shots を消さない。C26）。
- **検査から外れた 11 単元**: unit-index の 324 単元と `.cache/text-layout/units/` を突き合わせた。外れたのは `engine: 'legacy'` の 11 単元だけで、第4回と同じ。
  - 外れた単元: p23.hand.lines・p4.hand.lines・p4.hand.letters-classic・p4.ja.hiragana-classic・p4.math.classic・p4.math.compare・p4.math.shapes・p4.math.shop・p4.think.memory・p4.think.road・p4.think.sort。
  - v1 のモードは `e2e/layout.spec.ts` が受け持つ。trace の letters・maze も第4回の C19 で `MODES` に入った。外す理由は正しいので、検査の対象は変えない。
  - 幼児の英語の追加5単元（p5.en.abc を含む）と p4.en.move・p4.en.hello は、313 単元に入っている。
- 全件を「種類 × 要素 × 説明」でまとめ直した。代表例と独立の点検の指摘を、開発サーバー（127.0.0.1:4361、`MNW_DEV_NO_HMR=1`。4299 は使っていない。終わってから止めた）で開いた。約 40 画面を撮り、要素の寸法と計算された CSS を測った。分かったことは次のとおり。
  - **正解の輪が字を横切る**（covered 733 画面・74 単元。この回の件の大半）:
    - 字だけの札・横に長い札では、輪（`.mark--correct`）が両端の字を横切る。輪は札の短い辺に合わせた真円で、大きさは札の高さ＋1.6u、位置は札の中央。
      - 例: 「なかの ねこ」の「な」「こ」（p4.en.where/0 の解説、1280×620・1920×1080）、「こんにちは」（p4.en.hello/0）、「おひさま」（p5.en.picture-book/0）、「てんつく てんつく」（g1.ja.folktales/27）。
    - 輪は札の中央にある。g5.en.read-words/3 では、札（bear）が 358〜538px、輪が 404〜491px。点検で「左に寄る」と見えたのは、札の中の字が左寄りに見えるため。小さい輪が「bear」の b と r を切り、g3.en.alphabet-upper/3 では B の札の枠を切る。
    - p5.en.abc の文字の札は縦長（83×155px）で、輪（166px）のほうが札より広い。輪の白い縁取りが札の上下の枠を消して「|A|」に見え、輪が隣の U の札の枠にも重なる。
    - 第4回 V3 の「輪郭の緑＋角の小さな ○」は、`.tk-card` と `[data-long]` の選択肢にしか当たっていない。短い文字の札と絵の札は、大きな輪のまま。C16 は「1 行・6 字以下の札は数えない」ので、上の幼児の英語の例は検査に出ていない（見落とし）。
    - 角の小さな ○（白地）は、札の右上のふりがなを隠す。例: g3.ja.kanji-parts/30 の「みずうみ」の「み」（rt の上に span.mark。130 画面・10 単元）。
  - **線でむすぶ問題で、線がほかの札の後ろを通る**（意味が変わる）:
    - 下（または上）の札の列が折り返して 2 段になると、線が途中の札の後ろを通る。
    - g3.soc.safety/21 の解説（1536×864）: 「④交番→④近くの安全を見守る」の線が「①火事のとき水をとる」の札の後ろを通り、④→① に見える。
    - g5.soc.environment/37 の解説（1280×620）: 上の列が 3＋1 段になり、「②新潟みなまた病→新潟県」の線が「④四日市ぜんそく」の札の後ろを通る。
    - 札の番号のバッジは正しいが、線と食い違う。text-on-figure（参考）の 3 画面は、この線にふりがながかかったもの。
  - **英語の単元の分かち書き**:
    - en-g34・en-g56 の日本語（問題文・ヒント・解説）は分かち書きで書いてある。ところが `UnitRunner` の `data-wakachi` は段階（p23〜g2）だけで決まる。
    - そのため小3以上の英語の単元は `auto-phrase` で折れる。例: 「もういちど 聞／こう。」（g5.en.read-words/3 の解説）、「見つけ／よう。」（g3.en.alphabet-upper/3 の解説）。
    - 検査も wakachi-split を段階だけで判定するので、違反として出ていない（見落とし）。
  - **選択肢の句の札が狭すぎる**（narrow-wrap 4 件・80 画面、札の orphan 11 件・181 画面）:
    - `wordTrait` は、8 字を超える句の札の幅を「いちばん長い語」に合わせる。
    - そのため「東の 空の ひくい 所」（g3.sci.sun-ground/11）が 4 行・1 行 2 字になる。また「ひくい／所」「そった／形」「からの／中」「たすと／4」「むらの／こ」のように、最後の語の 1 字だけが次の行に落ちる。
    - 札は 215px・字 3.2u で、横には余白がある。
  - **解説の板に図・表が入らない**（scroll-hidden の explain 148 画面・7 単元、clipped 12 画面）:
    - g2.math.fraction-simple/2 の解説（1280×720）: 2 行の文の下の図（正解の 1/2 の長方形）が板の下で切れ、▼ だけが出る。
    - g5.math.decimal-shift/0 の解説: 位の表の答えの行（5）が半分隠れる。作業領域（式と回答欄）の上には空きが多いのに、板の高さの上限が決まった値になっている。
    - p5.math.compose/1 の解説（1536×864）: 「5は 2と 3」の図で、いちご 5 こが 2 段に折り返す。下の段の 3 こは `.unit__explain-figure`（overflow: hidden）で消える。子供には 2 こしか見えず、意味が変わる。
    - g3.soc.shop-work/14 の解説の表は、字が 1.73u（最小は 1.8u）。
  - **聞く問題の解説**（listen の work 57 画面・3 単元）: g2.ja.listen-notes/26 の解説（1280×620）では、聞いた文（4 行）の枠が作業領域の大半を取る。2 列の選択肢は板の下に入り、1 行目しか見えない（▼ だけ）。正解の札が見えない。
  - **sort の解説**（sort の work 90 画面・12 単元）: g1.life.school-safety/9 の解説（1536×864）では、6 枚の札のうち 2 枚（「ひろい ところで なげる」「とびおりる」）が箱の下で見えない。
  - **fill の解説で、空欄のあとの句点が行頭に来る**（kinsoku-start・orphan 10 件・44 画面）:
    - 埋まった空欄は、第4回 V3 で折り返せる inline にした。その空欄と次の「。」の間で折れ、「。」が行頭に来る。
    - 例: g2.ja.polite/23・g2.ja.vocab-meaning/9・g4.ja.plain-polite-style/16・g6.ja.kanji-usage/23・36。
    - 「下水道 → □ →／□」（g4.soc.water-waste/9）も、矢印と空欄の間で折れ、□ が 1 つだけ次の行に残る。
  - **記法の漏れ（検査の見落とし）**:
    - g4.math.fraction-kinds/4 の問題の式に、「[[□/10]]」がそのまま出ている（全状態・全サイズ）。`rich.ts` の `parseFrac` は数字だけを受けるので、□・○ の分数を記法として読まない。
    - g5.math.fraction-decimal のヒントの「[[□/○]]」も同じ。
    - 検査の markup-leak は、《》と {{ }} しか見ていない。
  - **図の字**:
    - 数直線の目もりの数が重なる: g4.math.rounding/7（1280×620）では「460000461000…470000」が 1 本につながり、読めない（overlap-text）。11 本の目もりに 6 けたの数を全部書いている。
    - 解説の数直線の分数のラベル（`.fig-nl__labels` の `.rt-frac`）が 0×0 で、分子と分母が重なる（g4.math.fraction-kinds/4、covered 4・overlap-text 4）。
    - 時計の帯（`eng-clock__band`）・振り子の図（`exp-svg`）の字は、svg の表示範囲の外にある。ただし svg が `overflow: visible` なので、切れてはいない（clipped 128 画面・3 単元は誤検出。C20）。
    - 時計の数「35」と「40」の重なり（0.1u）は、時計の数の配置が原因。
    - g4.math.quadrilaterals/1（1536×864）・g5.math.congruence: 数の入力の図（geometry）が図の段で縮まず、頂点の「ア」「イ」が切れる。下には回答欄と空きがある。
    - プログラムの図が小さい: g3.prog.decompose/30 の盤は 9u ほど。g6.prog.efficient/11 の選択肢の手順のブロックは、字が 0.54u（最小は 1.7u）。空きは多い。
    - パックの SVG の重なり:
      - g4.soc.prefectures の「やまなしけん｜きた」（方位の「きた」が県名に重なる）
      - g5.ja.text-figure の「10｜15」
      - g5.math.congruence の「45°｜108°」
      - p5.math.measure-compare の「10｜こ」
    - g3.math.bar-graph/7 の横軸の札「オートバイ」が、札の枠から出る（text-outside-box）。
  - **パックの文**:
    - g4.soc.water-waste/5: 「いつでも安心して飲める水をと／どけるため」（`auto-phrase` が文節で折らない）。
    - g4.ja.write-report/4: 札「知りたくなりまし／た。」。
    - g3.sci.light-sound/20: 図の見出し「日光を 当てると」が選択肢 3 つの頭と同じで、3 つ目が切れる。
    - g1.ja.folktales のヒント③: 「…」の／……の ところだよ。」（「……」が行頭に来る）。
    - g6.ja.read-literature/24: 詩の行が「あたためてい／る」と折れる。
- 検査の側で分かったこと:
  - **clipped の誤検出（C20）**: 上に書いた、svg の `overflow: visible` の件。
  - **button-split の誤検出（C23）**: 「種子の 中／（子葉）」「水の 底／（海など）」（g5.sci.germination・g6.sci.strata、40 画面）は始め括弧の前の改行で、組版として正しい。(d) の分かち書きの判定では外しているが、(f) の「空白でない所で改行」では外していない。
  - **見落とし**: C16 の 6 字以下の除外（C21）、英語の単元の分かち書き（C22）、`[[ ]]` の漏れ（C24）、線がほかの札の後ろを通る（C25）。
  - 点検の参考（文字の配置とは別）: 保護者画面の「きょうざい」で、教材名が `packLabel` を通っても「小1 ja」「en-g34」「life-g12」「prog-g16」のまま出る（W11）。
  - 第5回の点検の残り:
    - p4.en.move n=39 のエラーは、この実行では出ていない（errors 0）。
    - g4.ja.read-summary/33 h2 の本文の「おお／なか」は、小3以上の地の文で字の間に改行が入ったもの。JIS X 4051 で許される（下の 4.）。
    - g3.prog.decompose/30 の図が小さい件は、W8 で直す。
    - explore 画面の 10 枚目のカードは単元の画面ではないので、この検査の外。`layout.spec` で別に見ることにし、この回では扱わない。

### 1. 原因の分類（第6回）

| 分類 | 内容 | 主な件（件・画面の延べ） |
|---|---|---|
| (1) 共通の画面の作り | 正解の輪・角の ○（W1）／句の札の幅（W2）／線でむすぶ問題の折り返し（W3）／英語の単元の分かち書き・解説の板の高さと図（W4）／聞く問題の解説（W5）／fill の空欄と句点（W6）／sort の解説（W7）／数直線の目もり・分数のラベル・プログラムの図（W8）／数の入力の図・時計の数（W9）／□ の分数の記法（W10）／教材名（W11） | 輪 733 画面、句の札 約 260 画面、解説の板 160 画面、listen 57、sort 90、fill 44、図 約 120 |
| (2) パックの文・選択肢・図 | 長い選択肢・札（g4-ja・soc-g34・sci-g34・g2-ja ほか）／パックの SVG の字の位置（soc-g34・g5-ja・g5-math・p5・g3-math）／ヒントの「……」／詩の行 | work のスクロール 252（choice）の大半・overlap-text の SVG・text-outside-box 16 |
| (3) 検査の誤検出 | svg の overflow: visible（C20）／始め括弧の前の改行（C23） | clipped 128 画面、button-split 40 画面 |
| (3') 検査の見落とし | 6 字以下の札の輪（C21）／英語の単元の分かち書き（C22）／`[[ ]]`（C24）／線がほかの札の後ろ（C25）／古い shots（C26） | 新しく出る（幼児の英語の解説・en-g34・en-g56・match の解説） |
| (4) 設計上受け入れる | 小3以上の地の文の字の間の改行／読解の本文の枠・表の板のスクロール（第4回のまま）／text-on-figure（W3 のあとの残り） | 下の 4. |

### 2. 共通の直し（systemic。項目ごとにファイルを分ける）

DESINGN.md は W1 が持つ。W2〜W11 の規約の変更（各項目の「DESINGN.md に書くこと」）も W1 がまとめて書く（ファイルを重ねないため）。

#### W1 正解の印（ui.css・選択肢の CSS・DESINGN.md）

ファイル: `src/ui/ui.css`、`src/engines/choice/choice.css`、`src/engines/listen/options.css`、`src/engines/listen/options.tsx`、`DESINGN.md`

1. **字だけの札は、すべて「輪郭の緑＋角の小さな ○」にする**:
   - 今の規則は `[data-long]` の選択肢と `.tk-card` にしか当たらない。これを、単元の作業領域の「図・絵の無い札」全部に広げる（`.unit__work .choice:not(:has(.fig-illust, .fig-svgbox, svg, img)) > .mark--correct`。`.eng-opts__opt--text`・`.eng-choice__opt--text` を含む）。
   - 字だけの札には、大きな輪を使わない。
   - 対象: p5.en.abc の縦長の札、g5.en.read-words の語の札、g3.en.alphabet-upper の文字の札、g1.ja.folktales の語の札。
2. **角の ○ をふりがなに重ねない**:
   - 角の ○ を、右上から**右下**に移す（`top: auto; bottom: calc(u * -1.4); right: calc(u * -1.4)`）。ふりがなは字の上にしか出ないので、右上の rt（g3.ja.kanji-parts の「みずうみ」）を隠さなくなる。
   - 札の下の余白が 1.8u 未満の札（1 行の短い札）も、正解の状態で `padding-bottom` を変えない。○ と字が重ならないことは C21 で確かめる。
   - match（`match.css`）の角の ○ は、W3 で同じ位置にする。
3. **絵の札の輪は、絵だけを囲む**:
   - 対象は、絵と語のラベルの両方がある札（`.eng-opts__opt` で figure と label がある）。
   - 輪の中心を絵の段の中心に、直径を「絵の段の高さ＋1.6u」（札の幅を超えない）にする。
   - `options.tsx` で figure を `<span class="eng-opts__pic">` で包み、輪をその中に描く（`span.mark.mark--correct`、`aria-hidden`）。`Choice` の `state` で出る ○ は使わない。
   - これで、輪がラベルの字（「なかの ねこ」「こんにちは」「おひさま」）にかからない。
4. **DESINGN.md**: 3.1（正解の印）を「絵の札＝絵を囲む輪、字の札＝輪郭＋右下の ○」に書き直す。W2〜W11 の規約もここで書く。
- 確かめ方: 次の画面で、輪・○ が字とふりがなにかからないこと、隣の札の枠に重ならないことを見る。C21 の判定で covered が 0 になること。幼児の英語は、絵 10u 以上・札 14u×18u 以上のままであること。
  - `#/dev/unit/p4.en.where/0?state=explain`・`p4.en.hello/0`・`p5.en.picture-book/0`（1280×620・1920×1080）
  - `p5.en.abc/0`（1280×620）・`/5`（1536×864）
  - `g5.en.read-words/3`（1280×620）、`g3.en.alphabet-upper/3`（1280×720）
  - `g3.ja.kanji-parts/30`（1280×720）、`g1.ja.folktales/27`（1536×864）

#### W2 句の札の幅（choice.tsx）

ファイル: `src/engines/choice/choice.tsx`、`src/engines/choice/visible.test.ts`（または新しい `wordTrait.test.ts`）

- `wordTrait` の `phrase`（空白のある句）で、8 字を超える句の `len` を変える。今は「いちばん長い語」だが、これを **2 行に入る最小の幅** にする。
  - 求め方: 語を空白で区切り、1 行目と 2 行目のうち字数の大きいほうが最小になる切れ目を選ぶ。その字数（語の最大長以上）を `len` にする。
  - 3 行以上にはしない。
- これで「東の 空の／ひくい 所」「母親の／子宮の 中」「となりの／むらの こ」「□と △を／たすと 4」のように 2 行になり、最後の行が 1 字だけにならない。
- 確かめ方:
  - 単体テスト: 「東の 空の ひくい 所」→ len 5、「いつも 自分の 前」→ 1 行（7 字以内）。
  - 画面: `g3.sci.sun-ground/11`・`/14`（1536×864）、`g5.sci.birth/20`・`g4.sci.temperature/14`・`g4.math.change-relations/2`（1280×720）、`g1.ja.folktales/12`、`g6.sci.strata/3`。narrow-wrap と札の orphan が 0 になること。

#### W3 線でむすぶ問題（match）

ファイル: `src/engines/match/match.tsx`、`src/engines/match/match.css`

- まず、上と下の札の列を**折り返さない**ようにする。
  - 札の字を `--text-min` まで、札の左右の余白を 0.8u まで縮める。
  - ラベルは 2 行まで許す（分かち書きは空白のところで折る）。
- それでも 1 段に入らないとき（どちらかの列が折り返すとき）は、**左右 2 列**の並びにする。
  - 左の列に問いの札を、右の列に答えの札を縦に並べる。線は 2 列の間の通り道だけを通る。
  - 線が札の後ろを通る配置は作らない。
  - 作業領域の高さが足りないときは、今までどおりスクロール（▼）にする。
- 角の ○ は、W1 と同じ右下に置く（`match.css` の `.eng-match .tk-card > .mark--correct`）。
- 確かめ方: `g3.soc.safety/21?state=explain`（1536×864・1920×1080）、`g5.soc.environment/37?state=explain`（1280×620）、`g2.life.town/0`（1920×1080）で、どの線もほかの札の矩形と交わらないこと（C25 で 0）。

#### W4 単元の枠: 英語の単元の分かち書き・解説の板の高さと図（UnitRunner・unit.css）

ファイル: `src/units/UnitRunner.tsx`、`src/units/unit.css`

1. **分かち書きの判定に教材を足す**:
   - `data-wakachi` を付ける条件を、「段階が p23〜g2」または「教材が分かち書きの教材（`WAKACHI_PACKS = en-g34・en-g56`）」にする。
   - 英語の単元の日本語（問題文・ヒント・解説・選択肢の日本語）は、分かち書きで書く決まり（pack-brief）。`keep-all`＋`anywhere` で、空白のところだけで折る。英字は空白で折れるので影響しない。
2. **解説の板の高さの上限を、作業領域に要る高さから決める**:
   - 今の上限（`--panel-h` の決まった値）をやめ、「下の帯の上端 −（問題文の下端 ＋ 作業領域の最小の高さ）」にする。
   - 作業領域の最小の高さは、解説の状態で残すもの（数の入力なら式と回答欄、選択肢なら札）の高さを測った値。
   - これで g5.math.decimal-shift の位の表と、g2.math.fraction-simple の図が板に入る。
3. **解説の図を板に入れる**:
   - 文と図が板に入らないときは、図を右に置く（`data-fig-side`）。
   - それでも入らないときは、図の高さを残りの高さまで縮める（下限 6u）。図は切らない。
4. **絵の並びの図（`.fig-illust`）は、解説の図の中で折り返さない**:
   - `flex-wrap: nowrap` にし、絵の大きさを「（図の幅 − すき間）÷ 絵の数」まで縮める（下限 4u）。
   - これで p5.math.compose の 5 こが 1 行に並ぶ。グループ（2 こと 3 こ）の間のすき間は今のまま。
5. **解説の板の表の字**を `--text-min` 以上にする（g3.soc.shop-work/14 は 1.73u）。
- 確かめ方:
  - `g5.en.read-words/3?state=explain`（1280×620・1920×1080）の「もういちど 聞こう。」と、`g3.en.alphabet-upper/3`（1280×720）の「見つけよう。」が、語の途中で折れないこと（C22 で wakachi-split 0）。
  - `g2.math.fraction-simple/2`・`g5.math.decimal-shift/0`・`g4.math.fraction-kinds/4`（1280×720）の解説で、板の ▼ が出ないこと。
  - `p5.math.compose/1`（1536×864）の解説で、いちごが 5 こ見えること。
  - `.unit__explain-figure` の子が切れないこと（clipped 0）。

#### W5 聞く問題の解説（listen）

ファイル: `src/engines/listen/listen.tsx`、`src/engines/listen/listen.css`

- 解説の状態では、聞いた文の枠（4 行以上）の高さを 3 行に抑える。
  - 枠の中は、上から読めるスクロールにする。下に「▼ つづき」の段を出し、押すと進む（読解の本文の枠と同じ作り）。
  - 選択肢の札は作業領域の中に入れ、正解の札が必ず見えるようにする。
- 正解の札が作業領域の外に出るときは、先にスクロールして正解の札を見せる（`scrollIntoView({ block: 'nearest' })`）。
- 確かめ方:
  - `g2.ja.listen-notes/26?state=explain`（1280×620）で 4 つの札が見え、正解の札が全部見えること。
  - `g2.ja.listen-notes/24`・`g3.ja.listen-memo/16`（1280×720）・`p4.ja.story-listen`（全サイズ）で、work の scroll-hidden が 0 になること。

#### W6 fill の空欄と句読点・矢印（fill）

ファイル: `src/engines/fill/fill.tsx`、`src/engines/fill/fill.css`

- 空欄（埋まった空欄を含む）のすぐ後ろが行頭禁則の字（`。、」』）` など）なら、その字を空欄と同じ nowrap のまとまりに入れる。
  - まとまりは「空欄の最後の字＋句読点」。埋まった空欄の中の文は折り返せるまま（第4回 V3）にし、最後の字と句読点だけを離さない。
- 「→ □」のような「矢印・記号＋空白＋空欄」も、1 つのまとまりにする（記号のあとで折らない。第4回 V6 と同じ考え）。
- 確かめ方: 次の解説で、kinsoku-start と orphan が 0 になること。
  - `g2.ja.polite/23`・`g2.ja.vocab-meaning/9`・`g6.ja.kanji-usage/23`（1536×864）
  - `g4.ja.plain-polite-style/16`・`g6.ja.kanji-usage/36`（1280×720）
  - `g4.soc.water-waste/9`（1536×864）

#### W7 sort の解説（sort）

ファイル: `src/engines/sort/**`

- 解説の状態では、箱の中の札を詰める。
  - 札の字を `--text-min` に、札の上下の余白を 0.6u に、札どうしのすき間を 0.6u にする。
  - 箱の見出しは 1 行にする。
  - 箱が 2 列で札が多いとき（片方に 3 枚以上）は、箱の中を 2 列にする。
- 確かめ方:
  - `g1.life.school-safety/9?state=explain`（1536×864）で、6 枚の札が全部見えること。
  - sort の work の scroll-hidden が減ること（g4.ja.idioms・g4.ja.info-compare・g4.ja.plain-polite-style・g4.sci.current・g4.sci.temperature ほか 12 単元）。残る単元は、5. の content で札を短くする。

#### W8 図: 数直線の目もり・分数のラベル・プログラムの図（figure・program）

ファイル: `src/engines/figure/**`、`src/engines/program/**`

1. **数直線の目もりの数を間引く**:
   - 目もりの数のラベルの幅の合計が数直線の長さを超えるときは、両端・印（▼）のある目もり・中ほどの区切り（5 本ごとなど）にだけ数を書く。間引いた目もりは線だけ残す。
   - 例: g4.math.rounding の 460000〜470000 は、460000・465000・470000 と、印のある 466000 だけになる。
2. **数直線の分数のラベル**（`.fig-nl__labels .rt-frac`）を 0×0 にしない:
   - ラベルの箱を分数の高さ（字の 2.2 倍）にする。
   - `inline-flex` の縦並びにし、分子と分母を重ねない。
3. **プログラムの図（盤・手順のブロック）**の最小の大きさを決める:
   - 盤の 1 ますは 2.4u 以上、手順のブロックの字は `--text-min` 以上。
   - 選択肢の札の中に手順が入らないときは、札を 1 列（横に長い札）に並べ替える。図の縦横比が 4:1 を超える選択肢は 1 列にする。
- 確かめ方:
  - `g4.math.rounding/7`（1280×620）の数直線で、数が重ならないこと（overlap-text 0）。
  - `g4.math.fraction-kinds/4?state=explain`（1280×720）の分数のラベル。
  - `g3.prog.decompose/30`（1280×720）の盤が 20u 以上あること。
  - `g6.prog.efficient/11`（1536×864）で small-text が 0 になること。

#### W9 数の入力の図・時計（number・clock）

ファイル: `src/engines/number/**`、`src/engines/clock/**`

- 数の入力の図の段の縮め方（第4回 V4 の `--num-k`）を、geometry の図（`mk-svg` の四角形・三角形）にも当てる。図の段の高さに合わせて縮め（下限 0.6）、頂点の字（ア〜エ）を切らない。
- 時計の外側の分の数（5〜55）の半径を 1.05 倍にし、「35」と「40」の重なりを無くす。字の大きさは変えない。
- 確かめ方: `g4.math.quadrilaterals/1`（1536×864）・`g5.math.congruence/1`・`g2.math.time/2`（1280×720）で、図の段の scroll-hidden と overlap-text が 0 になること。

#### W10 □・○ の分数の記法（rich・Rt）

ファイル: `src/text/rich.ts`、`src/text/Rt.tsx`、`src/text/rich.test.ts`

- `parseFrac` で、分子・分母に数字のほか **□・○・△ の 1 字**を受けるようにする（`num`・`den` の型を `number | string` にする）。
  - `Rt` は、分数の分子・分母にその記号を描く（空欄の □ と同じ大きさ）。
  - 読み上げは「10ぶんの しかく」のように、今の分数の読み方に合わせる。
- `[[` があるのに分数として読めないものは、記法の誤りとして静的な検査で止める（`qa.ts` の C18 の隣。C24）。
- 確かめ方:
  - `g4.math.fraction-kinds/4`（全サイズ・全状態）で、式が「4/5 ＝ □/10」の分数として出ること。
  - `g5.math.fraction-decimal` の「□ ÷ ○」のヒントが分数として出ること。
  - 単体テスト: `[[□/10]]`・`[[3/□]]`・`[[□/○]]`。

#### W11 保護者画面の教材名（PacksTab）

ファイル: `src/parent/PacksTab.tsx`（とそのテスト）

- `packLabel` に、教科の ID（`ja`・`math`・`life`・`prog`・`sci`・`soc`・`en`）の名前と、段階の範囲を足す。
  - 例: `en-g34` → 「英語（小3・小4）」、`life-g12` → 「生活（小1・小2）」、`prog-g16` → 「プログラミング（小1〜小6）」、`g1-ja` → 「小1 国語」。`sci-g34`・`soc-g56` なども同じ形にする。
- 幼児の英語（en-pre）は、「幼児の英語」の見出しの下に並べる。dev で一覧を読めないときも、ID の頭で分ける。
- 確かめ方: 保護者画面の「きょうざい」に、生の ID が出ないこと。

### 3. 検査の誤検出として直すこと・足すこと（checkerChanges）

ファイル: `e2e/helpers/text-layout.ts`、`e2e/text-layout.tl.ts`、`playwright.text-layout.config.ts`、`src/curriculum/qa.ts`（C24 の静的な検査）、`docs/test-plan.md`（3.2 に理由を書く）

- **C20 svg の overflow: visible（誤検出）**:
  - 図の字が svg の表示範囲の外にあっても、いちばん外の svg の計算された `overflow` が `visible` なら、svg の枠では切れない。
  - このときは svg の枠での判定をやめ、svg の祖先の枠（`clipBy`）で切れるかを見る。
  - 時計の帯・振り子の図の 128 画面が消える。祖先の overflow: hidden やスクロールの枠で本当に切れるものは残る。
- **C21 正解の輪の 6 字以下の除外をやめる（見落とし）**:
  - 「1 行・6 字以下の札は数えない」の前提（輪は字の上下を通るだけ）は、幼児の英語の札で成り立たなかった。
  - 札の字数では外さない。**字の中心が輪の線の帯（外の円 − 内の円）に入る字が 1 つでもあれば** covered にする。
  - 角の小さな ○ は、字（ふりがなを含む）の矩形と ○ の円が重なれば covered にする（今は elementsFromPoint で一部しか見えていない）。
  - 輪が札の枠からはみ出して隣の札の矩形に入るものも、covered（「正解の ○ が隣の札にかかる」）にする。
- **C22 分かち書きの判定に教材を足す（見落とし）**:
  - wakachi-split を、段階（p23〜g2）に加えて、教材が en-g34・en-g56 のときも判定する。`inspectText` に `pack` を渡す。
  - 教材の一覧は検査の側で持ち、画面の `data-wakachi` は見ない（画面の不具合を隠さないため）。
  - これで、英語の単元の日本語の文の「聞／こう」「見つけ／よう」が出るようになる。
- **C23 始め括弧の前の改行（誤検出）**:
  - (f) ボタン・選択肢の「空白でない所で改行」でも、次の字が始め括弧（`（「『【〔`）なら改行してよいとする（JIS X 4051。(d) と同じ扱い）。
  - 「種子の 中／（子葉）」「水の 底／（海など）」の 40 画面が消える。
- **C24 `[[ ]]` の漏れ（見落とし）**:
  - markup-leak の正規表現に `\[\[`・`\]\]` を足す。
  - 静的な検査（C18 の隣）で、`[[…]]` のうち `parseFrac` で読めない教材の文を止める。W10 のあとで 0 になること。
- **C25 線がほかの札の後ろを通る（見落とし）**: match の線（`.eng-match__line`）の線分が、両端の札以外の札の矩形（2px 内側）と交わるとき、covered（「線が別の札の後ろを通る」）にする。正解の線と、子供が引いた線の両方を見る。
- **C26 古いスクリーンショット**: `MNW_FRESH=1` で `MNW_UNITS` を指定しない（全部を流す）ときは、始める前に `shots/` の種類ごとのフォルダを消す（globalSetup）。違反が 0 の種類に、前の実行の画像が残らないようにする。
- `docs/test-plan.md` の 3.2 に、C20（svg の overflow）・C23（始め括弧）の理由を書き、C21・C22・C24・C25・C26 も書く。

### 4. 受け入れるもの（accepted）

- **小3以上の地の文（読解の本文・解説の文）で、字の間に改行が入るもの**:
  - 例: g4.ja.read-summary/33 の本文の「子メダカのお／なかには」。
  - 分かち書きでない段階の地の文は、JIS X 4051 で字の間で改行してよい。
  - 1536×864 で開き、行頭禁則の違反もふりがなの分かれも無く、読めることを確かめた。
  - 選択肢・札・ボタンの中（button-split）は、今までどおり違反として見る。
- **読解の本文の枠のスクロール（印あり）と、表の解説の板のスクロール（印あり・上から読める）**:
  - 第4回の判断のまま受け入れる。
  - ただし、答えの行や正解の図が隠れる板（g5.math.decimal-shift・g2.math.fraction-simple）は受け入れず、W4 で直す。
- **text-on-figure（参考）**:
  - W3 で線の通り道を直したあとに残るもののうち、ふりがなが線に少しかかるだけのものは受け入れる（字は読める）。
  - 線がほかの札の後ろを通るもの（意味が変わる）は受け入れない。
- **検査から外れた 11 単元**: v1 のモード（legacy）で、`layout.spec` が受け持つ。外す理由は正しい。
- **幼児の英語**:
  - 対象: p23.en.move・p4.en.where・p4.en.move・p4.en.hello・p5.en.picture-book・p5.en.first-sound・p5.en.abc。
  - 問題とヒントの状態は 0 件。
  - 1280×620 の解説でも、文字 2.2u 以上・絵 10u 以上・札 14u×18u 以上・「きいてね」14u×9u であることを目視で確かめた。
  - 直すのは、解説の正解の輪（W1）だけ。p5.en.abc は既定で非表示だが、同じ W1 で直す。

受け入れないもの:
- 正解の輪・角の ○ が、字やふりがなを横切る・隠すもの（W1）
- 線がほかの札の後ろを通るもの（W3）
- 解説で、図・表・札の一部が見えないもの（W4・W5・W7）
- 記法の漏れ（W10）

### 5. このラウンドで直すもの（content。パックごと）

systemic のファイル（エンジン・`src/units`・`src/ui`・`src/text`・`src/parent`）は触らない。教材の文を変えたら `npm run voice:packs` を流す（改行だけ変わった JSON は戻す）。学年の漢字・《よみ》・分かち書き・ヒントと解説の対応は保つ。

- **g1-ja**（`src/packs/g1-ja/**`）: g1.ja.folktales のヒント③（kinsoku-start 2 件）を直す。
  - 対象: 「「……は、おべんとうに きびだんごを」の ……の ところだよ。」と「「……は どうしても なかが みたく なって」の ……の ところだよ。」。
  - 2 つ目の「……」を「「……」」にして、「……」が行頭に来ないようにする（例: 「…」の 「……」の ところだよ。）。
- **g2-ja**（`src/packs/g2-ja/**`）:
  - g2.ja.listen-notes: W5 のあとも正解の札が見えないものが残れば、選択肢の文を短くする（例: 26 の「まい日 れんしゅうしますか。」は残し、ほかの選択肢を 1 行にする）。
  - g2.ja.orthography の covered 10 件は、W1 で消える見込み（パックは触らない）。
- **g4-ja**（`src/packs/g4-ja/**`）:
  - g4.ja.write-report/4 の解説: 札「知りたくなりました。」を、「知りたく なった。」のように 1 行に入る長さにする。
  - g4.ja.write-report/30〜32 の fill: 選択肢（引用の文）を 1 行に入る長さにする（作業領域が 4〜5u 足りない）。
  - g4.ja.info-compare・g4.ja.plain-polite-style・g4.ja.idioms の sort・choice の札: W7 のあとに作業領域の不足が残るものだけ短くする。
- **g6-ja**（`src/packs/g6-ja/**`）: g6.ja.read-literature/24 の詩の行「胸の中にじっと じっと あたためている」を 2 行（「胸の中に」「じっと じっと あたためている」）に分け、1280×620 で「る」だけが次の行に落ちないようにする。自作の詩なので行を分けてよい。設問の引用と解説の行も合わせる。
- **g5-ja**（`src/packs/g5-ja/**`）: g5.ja.text-figure の図（グラフ）の目もりの「10」と「15」の重なり（1920×1080 のヒント①）を、目もりの数の位置か字の大きさで直す。
- **g3-math**（`src/packs/g3-math/**`）: g3.math.bar-graph/7 の横軸の札「オートバイ」が札の枠から出る。札の幅に入る名前（「バイク」）にするか、ふりがなの要らない書き方にする。問題・ヒント・解説・台本も合わせる。
- **g5-math**（`src/packs/g5-math/**`）:
  - g5.math.congruence の図の「45°」と「108°」の重なりを、角の印の字の位置をずらして直す。
  - g5.math.decimal-div・decimal-mult・decimal-shift で、W4 のあとも解説が板に入らないものは、解説の文を 1 行短くする。
- **g4-math**（`src/packs/g4-math/**`）:
  - g4.math.div-2digit で、W4 のあとも解説が板に入らないものは、解説の文を短くする。
  - fraction-kinds の `[[□/10]]` は W10 で分数として出るので、パックは変えない。
- **p5**（`src/packs/p5/**`）:
  - p5.math.measure-compare の図の「10」と「こ」の重なりを直す（数と助数詞を 1 つの text にするか、位置をずらす）。
  - p5.think.why の covered 6 件は、W1 で消える見込み。
- **soc-g34**（`src/packs/soc-g34/**`）:
  - g4.soc.water-waste/5: 「いつでも安心して飲める水をとどけるため」を、意味を保って 1 行に入る長さにする（「いつでも安全な水をとどけるため」など）。
  - g4.soc.prefectures（201 ほか、1536×864）: 地図の方位の「きた」を、県名に重ならない右上の角に置く。
- **sci-g34**（`src/packs/sci-g34/**`）:
  - g3.sci.light-sound/20: 図の見出し「日光を 当てると」は選択肢の頭と同じなので、図をやめるか、選択肢から頭を外して短くする（3 つ目が切れる。3.5u 足りない）。
  - g3.sci.wind-rubber: choice の選択肢を短くする（4.9u 足りない）。
  - g4.sci.current・g4.sci.temperature の sort: W7 のあとに残るものだけ直す。
- **sci-g56**（`src/packs/sci-g56/**`）: g6.sci.combustion・g6.sci.electricity-use の choice で、W2 のあとも作業領域が足りないものを、選択肢を短くして直す。
- **life-g12**（`src/packs/life-g12/**`）:
  - g1.life.school-safety の sort（6 枚）: W7 のあとも入らないときは、札を 5 枚にするか短くする。
  - g2.life.town の match: W3 のあとに残れば、札を短くする。
- **prog-g16**（`src/packs/prog-g16/**`）:
  - g6.prog.efficient: 選択肢の手順を、W8 の 1 列の札で字が 1.7u 以上になる長さにする（入らなければ、問題の手順を短くする）。
  - g3.prog.decompose: 解説（2 行分スクロールする）を短くする。

### 6. 確かめ方（全体）

- systemic と content のあとで、`MNW_FRESH=1 MNW_WORKERS=2 npm run check:text-layout` を流し直す。第5回は 6 にしてリソース不足で落ちたので、2〜3 にする。
- 失敗した単元が 0、errors が 0 であることを確かめてから、件数を見る。
- covered（輪・○・線）・markup-leak・wakachi-split が 0 になっていること。clipped は、祖先の枠で本当に切れるものだけが残っていること。

### 7. 第6回の実施とレビュー（2026-11-07）

W1〜W11・C20〜C26 を担当ごとにファイルを分けて実装した。レビューでは git の差分と追加したファイルを全部読み、自分の開発サーバー（127.0.0.1:4433、`MNW_DEV_NO_HMR=1`。4299 は使っていない。終わってから止めた）で代表の画面を開いて DOM の寸法を測り、検査を単元に絞って流した（下の「確かめたこと」）。

担当の判断で設計から変えたところ:

- W1: 右下の角の ○ は `bottom`・`right` とも -1.8u（設計は -1.4u。-1.4u だと g3.ja.kanji-parts の 1 字の札で ○ が字に触れた）。match の角の ○ も -1.8u にそろえた。字を含む横長の図（`fig-svg--wide`。W8 の 1 列の札）の札も「輪郭＋右下の ○」にした（輪が図の字を横切る。g6.prog.efficient）。
- W1: 「3.1 を書き直す」は、正解の印の記述が 17 章にあるので 17 章を直した。18 章の「重なりの順」も、大きな輪は絵・図の札だけに直した。W2〜W11 の規約は 17 章の「第6回の規約」にまとめた。
- W5: 3 行で作業領域に入らないときだけ、聞いた文の枠を 2 行にする（3 行だけでは listen の work の不足が 63 画面残った）。
- W6: 埋まった空欄は button なので `display: inline` でも inline-block になり、包み（`.rt-nobr`）の nowrap を外すと「。」が行頭に来た。包みの nowrap は残し、空欄の中の文は空欄自身の `white-space: normal` と `max-width`（前後に字がある空欄は `100% − 3em`）で折る。「→ □」は記号と空白を空欄の包みに入れた。
- W8: 盤の 1 ますの下限は、パックの SVG（同じ大きさの正方形が 4 つ以上・高さを `calc(var(--u) * hU)` で書いた図）を `gridFloor.ts` の `sizePackSvg` で広げる（program の部品ではなく PackSvg で直した）。当たるのは prog の 9 単元だけ（全単元の見本で数えた）。1 列の札は記号を図の横に置き、図の高さを 4.6u にした。幼児の段階（p23〜p5）は 1 列にしない。字の無い横長の図（分数の帯・幼児の比べる絵）は印を付けない（1 列だと横に並べたときより小さくなる）。
- W9: 時計の外の数の半径を 1.05 倍にしても、図の範囲が広がって字の下限が上がり、px の間隔が変わらなかった。図の範囲の余白を 1.1×字 から 0.8×字 にした（字の大きさは変えていない）。
- W10: 記号の分子・分母は `.rt-frac__sym`（1em 角・中央）で描く（`rt.css`）。

レビューで直したもの:

1. **右下の ○ が作業領域の高さに数えられていた（W1 の副作用）**: ○ は札の下へ 1.8u 出る。`.unit__work` は overflow: visible なので、この分が `scrollHeight` に入り、`--fit` が縮んだうえ、下の札が正解のときは作業領域がスクロールの枠になった（g6.en.past/19 の解説 1536×864 で 2.3u、g3.soc.safety の解説で 1.6〜1.8u。○ が枠で半分切れていた）。○ は作業領域の下の余白（板・帯との間 2.4u）に描かれるだけなので、UnitRunner の fit・枠の判定と解説の板の上限、listen の 2 行の判定では、測る間だけ印を外す（`data-measure`。ui.css）。
2. **match の 1 段の判定（W3）**: `scrollWidth` で札のあふれを見ていたので、正解の ○ のはみ出しで解説では必ず「入らない」になり、1 段に入る札も左右 2 列になっていた（g3.soc.safety/21 の解説 1536×864）。札の中身（○・番号の丸を除く）とラベルの行の矩形で見る。最後の行の 1 字の判定は、行の高さの 1.5 倍では 2 字の行（「とる」）まで落としていたので、字の大きさの 1.5 倍にした。札が縮んで語の途中で折れるとき（「「すっぱ／い」」「それなら／ば」。g6.ja.language-change/10 の解説）も入らないとみなす（空白・句読点のあと・始め括弧の前・Intl.Segmenter の語の切れ目だけを許す。分かち書きと data-spaced は空白だけ）。並べ方は広げる向きにしか進まないので、作業領域の幅が変わったら 1 段から測り直す。
3. **sort の解説の 2 列で、札が語の途中で折れた（W7 の副作用）**: 2 列を同じ幅の格子にしたので、札が箱の半分に縮み、小3以上の札が「ぐっすりねむ／る」「トライアング／ル」「パトロールす／る」と折れた（g3.ja.modifiers・g3.ja.proverbs・g3.soc.safety・g4.ja.idioms・g4.ja.info-compare・g4.ja.plain-polite-style・g5.soc.environment・g6.sci.strata の解説。担当の報告では「ほかのエンジン」としていたが、どれも sort だった）。格子をやめ、札を字の幅より縮めずに横に並べる（`flex: 1 0 auto`。入れば 3 枚）。
4. **聞く問題の解説の描き直しが止まらなかった（W5 の副作用）**: 聞いた文の枠の高さが字の大きさで決まるようになり、「▼ つづき」の段の有無で枠の高さが変わる。UnitRunner の `--fit` が「段が無い → 0.99 → 枠からあふれて段が出る → 0.89 → あふれず段が消える」を毎フレームくり返した（g6.en.future/32 の解説 1536×864。検査では unstable・板の下の札の covered として出ていた）。段の場所は一度出したら、画面の大きさ・聞く文が変わるまで残す（あふれていないときは見えない場所だけ）。2 行に縮めたあと 3 行に戻す合図も、作業領域の大きさ（枠の行数で解説の板の上限が変わると一緒に変わる）でなく画面の大きさで決める。`sounds` は `useMemo` にした（音の再生のたびに測り直しが走っていた）。
5. **聞く問題の書き起こしの「・」が検査から見えなかった（C22 で新しく出た誤検出）**: 文と文の間の「・」が `::before` だったので、検査には「Thank you.／Good morning.」が語の途中の改行に見えた（en-g34・en-g56 の wakachi-split。g3.en.greetings 32 件・g6.en.past 22 件ほか）。「・」を字（`aria-hidden` の span）として書いた。検査の側も、文の終わり（。．.!?！？）のすぐ後ろの「・」のあとの改行は、後ろが 1 字の語（「I」）でも数えないようにした（docs/test-plan.md 3.2 の C22。probe に見本。直す前の判定では見本が失敗することを確かめた）。
6. **大きな輪が縦長の札より広がっていた（W1 の残り）**: 大きな輪は「札の短い辺に合わせた真円」の設計だが、実装は札の高さ＋1.6u だったので、縦長の札（g3.en.numbers-colors の色の札、40 件）で輪が札より広がって隣の札にかかった。四方を 0.8u 外へ広げた枠の中に幅・高さ auto・縦横比 1 で置き、高さの上限（札の高さ＋1.6u・20u）が縦横比で幅にも効くようにした（短い辺＋1.6u になる）。横長・正方形の札・なぞりの輪の大きさは変わらない。
7. **choice・experiment の絵と語のある札（W1 の残り）**: 札を囲む輪がラベルの字を横切り（g5.en.read-words の「はな（しょくぶつ）」）、幼児の縦長の札では輪（20u）が札（14u）より広がって隣の札にかかった（p23.math.shape-match、56 件）。listen と同じ「絵の段だけを囲む輪」も開発用の画面で試したが、横長の絵（`.fig-illust` が札の幅いっぱい）では輪の中心が絵からずれ、輪の下がラベルに触れた。ラベルの子（`.eng-choice__label`・`.exp-opt__label`）がある札は、字の札と同じ「輪郭＋右下の ○」にした。字を含む図（svg の text・表・文の図。グラフ・時計・数直線・札の列）の札も同じにした（大きな輪は上限 20u で --fit と一緒に縮むので、大きな札では輪が札の中に入り、g5.ja.text-figure の解説でグラフの目もりの数・単位を横切っていた。12 件）。W8 の `fig-svg--wide` の札の規則は、これに含めた。listen の絵の段の輪（幼児の英語）は設計どおり残す。
8. **空白で区切って書いた長い選択肢の最後の 1 語（W2 の残り）**: 12 字を超える選択肢（data-long）は語のラベルにならず、W2 が効かない。小3以上は auto-phrase で折るので「南東より 南に よった／所」「西の 方／へ」と落ちた（g4.sci.moon-stars/0・1。W2 の確かめ方の単元）。空白の数 × 12 ≧ 字数のラベル（検査の (f) と同じ境。`rich.ts` の `spacedLabel`）に `data-spaced` を付け、空白のところでだけ折って最後の行を 1 語にしない（`keep-all`・`text-wrap: pretty`。base.css）。choice・listen・experiment の選択肢と札のラベルに付けた。
9. **検査の見落とし（C21）**: listen の絵の段の輪は、包み（`.eng-opts__pic`）の中の字と兄弟しか見ていなかったので、輪がラベルの字や隣の札にかかっても出なかった。札（`.choice`）の字と隣の札で見るようにし、probe に見本を足した（直す前のコードでは失敗する）。probe の C16 の見本の説明の誤り（「直径 36u」）も直した。
10. 横長の図の 1 列の規則（figure.css）を、単元の画面（`.unit[data-stage]`）に絞った（v1 モード・幼児ホームの `data-stage` は D1 などで別）。
11. DESINGN.md: 17 章の W1（短い辺の輪・右下の ○ を作業領域の高さに数えない・choice の絵と語の札）、W2（data-spaced）、W3（1 段の条件と測り直し）、W5（2 行・段の場所・「・」は字・正解の札を見せる）、W7（同じ幅の格子にしない）を直し、21 章に W11（教材名・幼児の教材の分け方）を書いた。docs/test-plan.md 3.2 の C21・C22 に 5.・9. を書いた。
12. 作業ツリーの一時ファイル（chk2.tmp.ts・lib.tmp.cjs・playwright.tl5290.tmp.config.ts・scripts/_g4ja-dump.ts・scripts/_soc56dump.tmp.ts）は、中身がパックの文・図の書き出しと一時の設定だけだったので消した。担当が CRLF にしていたファイルは LF に戻した（`prettier --check` が通らなかった）。

確かめたこと:

- 検査（`MNW_FRESH=1`・`MNW_WORKERS=3`。ポートを 4433 にした一時の設定。終わってから消した）を、設計の確かめ方の単元と、レビューで直した所に当たる単元に絞って 5 回流した（のべ 177 単元。どの回も失敗した単元 0・errors 0）。直したあとの最後の実行で違反が 0 だった単元:
  - W1: p4.en.where・p4.en.hello・p5.en.picture-book・p5.en.abc・p23.en.move・p4.en.move・p5.en.first-sound・g3.en.alphabet-upper・g3.ja.kanji-parts・g5.en.read-words（398 問）・g3.en.numbers-colors・p23.math.shape-match・p5.think.why・p5.env.predict・p4.env.daily-order・g2.ja.orthography・g3.soc.shop-work・g1.ja.word-play・g3.sci.magnets・g6.soc.world。g5.ja.text-figure の covered も 0（残りは下の content）。
  - W2: g3.sci.sun-ground・g5.sci.birth・g4.sci.temperature・g4.math.change-relations・g4.sci.moon-stars。
  - W3: g3.soc.safety・g5.soc.environment・g1.ja.katakana・g2.ja.vocab-meaning・g6.ja.info-relations・g6.ja.language-change・p5.ja.katakana-read。
  - W4: g2.math.fraction-simple・g5.math.decimal-shift・p5.math.compose。
  - W5: g3.en.greetings・g4.en.directions・g6.en.future・g6.en.past・p4.ja.story-listen・g1.ja.listen・g1.ja.particles・g2.ja.culture。
  - W6: g2.ja.polite・g4.ja.plain-polite-style・g6.ja.kanji-usage。W7: g1.life.school-safety・g3.ja.modifiers・g3.ja.proverbs・g5.sci.germination。
  - W8: g4.math.rounding・g6.prog.efficient・g5.prog.debug-plan。W9: g4.math.quadrilaterals・g2.math.time・g1.math.clock・g3.math.time。W10: g5.math.fraction-decimal。
- 開発用の画面（4433）で目で確かめたもの: p4.en.where/0・p5.en.abc/0（1280×620）、g3.en.numbers-colors/30（1280×720）、g3.soc.safety/21（1536×864。1 段）、g6.ja.language-change/10（1280×720。縮めた 1 段）、g3.ja.modifiers/26（1280×720）、g4.sci.moon-stars/1（1536×864）、g5.en.read-words/237・p23.math.shape-match/2・g6.en.past/19・g6.prog.efficient/11・g5.ja.text-figure/33（1536×864）、g2.ja.listen-notes/26（1280×620・1280×720。正解の札は見える）、g5.math.decimal-shift/0（1280×620。位の表が板に入り、つぎへ が押せる）、g3.ja.listen-memo/19（1920×1080）。保護者画面の「きょうざい」（1280×620。教材名が日本語・幼児の英語の見出し）と幼児ホーム（1280×620）。
  - Browser の枠がほかの担当と同じだったので、途中から Playwright の画像（同じサーバー）で見た。
- 聞く問題の解説の揺れ: Playwright で 30 フレームの `--fit` を見て、どの画面サイズでも 1〜3 回の変化で止まることを確かめた（直す前の g6.en.future/32 は 30 フレーム中 39 回）。
- `npm run check:text-layout:probe` 29 本・`npx tsc -b`・`npx eslint .`・`npx prettier --check`（変えたファイル）・`npx vitest run`（170 ファイル 3,855 件）・`npm run check:design`。

残したもの（第6回の 5. の content。共通の直しのあとに残ったもの）:

- g1-ja: g1.ja.folktales/4・16 のヒント③（kinsoku-start 5。設計どおり）。
- g2-ja: g2.ja.listen-notes/24・26・27・29・31 の解説（work の scroll-hidden 14。2×2 の選択肢の文が長く、12 字を超えるラベルは問題文と同じ大きさで --fit で縮まない。26 は 12u 足りない。正解の札は見える）。
- g3-ja: g3.ja.listen-memo/19・26 の解説（1920×1080 で 1.3u。「▼ つづき」の段の場所を残すため。画面サイズを回す順で出たり出なかったりする）。
- g4-ja: g4.ja.write-report（sort の解説の「知りたくなりまし／た。」ほか button-split 20、fill の問題 30〜32・order の解説 16 の scroll-hidden 49）、g4.ja.info-compare（choice/10・sort/26 の問題の状態 28）、g4.ja.idioms（sort の解説 110・111 の 7）。
- sci-g34: g4.sci.current/16 の sort の解説（5.6u）。sci-g56: g6.sci.strata/17 の sort の札「下から れき・砂・どろと ならぶ 層」（orphan 4・scroll-hidden 4。data-spaced でも Chrome の `text-wrap: pretty` が最後の「層」を戻さない。札を短くする）、g6.sci.electricity-use/16 の問題（3.5u）。
- soc-g34: g4.soc.water-waste/5（button-split 20。設計どおり）。life-g12: g2.life.town の match（問題・解説 25。左右 2 列で 2.2〜7u）。
- g4-math: g4.math.fraction-kinds/4 の解説（数直線 2 本の列 `fig-column` が板に 5 行分入らない。W4・W8 の両方の担当が相手の範囲としたもの。図は切らない設計なので、パックで数直線を 1 本にする）。
- g5-math: g5.math.congruence（45°｜108° 16）、g5.math.decimal-div/3・4 の解説（1.8〜1.9 行）。g5-ja: g5.ja.text-figure/8（10｜15）、g5.ja.sentence-relations/37〜39 の問題（choice 2.5〜2.7u。第6回の元の結果にもある）。
- prog-g16: g3.prog.decompose/28 の解説（0.7 行）。g6.prog.efficient の問題の手順の図（字の無い札の列）が 4.4u（1 こ 1.9u）と小さい（検査は字の無い図の大きさを見ないので出ない）。
- p5: p5.math.measure-compare（10｜こ 15）、p5.math.numbers-10/4・5 の問題（1280×720 で 2.3u。第3回のころから 3.8u で出ていたもので、第6回の差分には効く所が無い）。

次の回に回すもの:

- 全単元の検査は流していない（統括が `MNW_FRESH=1 MNW_WORKERS=2` で流す）。絞った実行で `.cache/text-layout/units/` と報告書は一部の単元だけが新しい。
- 12 字を超える選択肢（data-long）のラベルは、問題文と同じ大きさで --fit で縮まない（T3 の決め）。g2.ja.listen-notes は縮めても足りないので、今回は content に任せた。
- match の 1 段では札が縮むので、ラベルが語の切れ目で 2 行に折れる（「近く／の安全を見守る」。検査の違反ではない）。
- C25 の線は同じ `.eng-match` の札だけ、C21 の「隣の札」は同じ親の兄弟の札だけを見る（担当の残し事項のとおり）。

### 8. 第6回のパックごとの直しとレビュー（2026-11-07）

5. の content を、パックごとに担当（Sonnet）が直し、パックごとにレビュー（Opus）した。レビューでは git の差分を全部読み、意味・答え・誤答と誤概念・ヒント3段と解説の対応・学年の漢字・《よみ》・分かち書きを確かめ、自分の開発サーバー（4300〜4999 の空いている番号・`MNW_DEV_NO_HMR=1`。4299 は使っていない。終わってから止めた）で直した問題を開いて、画像と DOM の寸法で見た。`src/illust/content` は、どのパックも変えていない。

パックごとの直し（→ はレビューで直したもの）:

- **g1-ja**（folktales.ts）: who-dango（4）・who-peek（16）のヒント③の 2 つ目の「……」を「「……」」にした（設計どおり）。
  - 2 行目が「の ところだよ。」で始まる（括弧のところで折れる）。DESINGN.md S2 は分かち書きの段階で括弧のところで折ることを認めていて、検査も違反にしないので受け入れる。
- **g2-ja**（listen-notes.ts）: 聞く問題（ask-hamster・ask-tulip・ask-piano・ask-market・ask-soccer・ask-alt-beetle）の選択肢 11 か所と、ask-piano の解説を短くした。
  - → 24・29 の誤答「〜は なにですか。」を「なんですか。」にした（パックのほかの 20 か所と同じ言い方。字数は同じ）。
  - → 26 の解説「はっぴょうかいが いつかは もう いって いたね。」は「いつか（そのうち）」とも読めるので、ヒント②と同じ言い方の「はっぴょうかいの 月《つき》は もう いって いたね。」にした（2 行のまま）。
  - → 27 の誤答「あそびは すきですか。」（不自然）を「かくれんぼは すきですか。」にした。13 字なので、ほかの問い（22〜31）と同じ大きさ・左そろえの札になる（12 字以下だと 27 だけ語のラベルの小さな字で中央にそろう）。解説の `--fit` は 0.74〜0.76（直す前は 1280×620 で 0.605）。
- **g4-ja**:
  - write-report.ts: 報告の札（調べたきっかけ・調べ方・分かったこと）と引用の別例 30〜32（本の文と変えた文）を、札・選択肢が 1 行に入り、折れても文節の切れ目になる文にした。31 は本の文を「カエルは小さな虫を食べる」（事実）に、変えた文を「カエルは虫がだいすきだ」に替えた（32 の「残」は 4 年の字）。
    - → jitensha のきっかけ: 担当の「道で自転車と人がぶつかりそうになりました。」は、sort の解説の札で「ぶつかりそうになり／ました。」と文節の途中で折れた（検査は Intl.Segmenter の語の切れ目で見るので、「なり／ました」は違反に出ない）。「自転車《じてんしゃ》と人《ひと》がぶつかりそうなところを見《み》ました。」にした（「道で」は題「学校の前の道」で分かる。「道で…ところを見ました」は問題の札が 3 行になり、作業領域が 4.9u 足りなかった）。札の折れは、どの画面でも文節の切れ目。
    - → petbottle のきっかけ: 担当の「ペットボトルが気になりました。」は何が気になったかが抜けるので、「ペットボトルがどうなるのか気《き》になりました。」に戻した。order の札が 2 行になるので、調べ方を「リサイクルしせつを見学《けんがく》しました。」にして 1 行にした（報告の札の行数の合計は 7 行のまま）。
  - info-compare.ts: 10 の誤答（「どちらもさんぽに行く」＝同じ点とちがう点の取りちがえ、「どちらもえさが同じ」＝書かれていないこと）と、26 の引用の札（「北の星は北極星を回る」「北極星はほぼ動かない」）を短くした。
  - idioms.ts: 111 の sort（手・足・頭）の札を 6 枚から 4 枚にした。外した「手にあせをにぎる」「足がぼうになる」は、ほかの問題で出る（「足がぼうになる」は意味の文に「足」が入っていて答えが分かる札だった）。110・111 の解説の板の「「…」、「…」」の「、」を外した。
- **g6-ja**（read-literature.ts）: 設計（24 の詩の行を 2 行に分ける）とちがい、「冬の木」第三連の 1 行目「ぼくも　きっと　今は冬」を「ぼくも　今は　冬」にした。詩の行は 1 つの p の中の inline の span で、行ごとには改行されない（`src/engines/reading/reading.tsx`）ので、行を分けても折れ方が変わらないため。設問 26 の正解・ヒント②③・解説の引用はそのまま成り立ち、解説の「今は冬でも」とはより素直に対応する。どの画面でも最後の行は 3 字以上（「あたためている」「めている」「ている」）。
- **g5-ja**: 変えていない。g5.ja.text-figure/8 のヒント①（1920×1080）の overlap-text「10｜15」は、検査の誤検出として受け入れる（下の「受け入れたもの」）。
- **g3-math**（bar-graph.ts・review-fixes.test.ts）: 横軸の札を 4 字まで（ふりがなを除く）にした（ドッジボール→バレー、ハムスター→ことり、おにごっこ・かくれんぼ→ままごと・しりとり、オートバイ→バイク）。表で読む問題（read の alt）は、多い 3 つ・その他・合計の横の表にした（4 番目に多いものは表に出さず、合計は表の 4 つの和。答え・ヒント・解説・誤概念 table-total は合っている）。導入の図も合わせた。
  - → ならべ方を選ぶ問題（make の alt）の選択肢の小さい図は札 1 つに棒 2 本ぶんの幅しか無く、4 字の札どうしが同じ段で隣に来ると 5〜9px 重なった（すきな 遊びの しりとり｜ままごと・しりとり｜ブランコ。seeds=50 の n=140。4 つの画面サイズすべて。seeds=2・12 の見本には出ない）。4 字と 3 字もすきまが 0px で「バレーサッカー」と 1 語に読めた。この問題だけ、札がすべて 3 字までの題材（`CHOICE_FIG_THEMES`。くだもの・動物・本）を使う（乱数を使う回数は変わらないので、ほかの問題は前と同じものが出る）。直したあとは 4 サイズとも札のすきまが 9.4px 以上。再発防止のテスト（横軸の札は 4 字まで・この問題の図の札は 3 字まで。直しを戻すと失敗する）を足した。
- **g5-math**:
  - congruence.ts・angle-labels.ts（新）・util.ts: 角の大きさの字の置き場を、画面で引き上げられる大きさ（26 単位）の箱で見積もり、頂点の名前・ほかの角の字にぶつからない所を 3 つ一緒に探して決める（`placeAngleLabels`）。角と辺の長さの字に白いふち（`svgHaloText`。paint-order: stroke）を付けた。
    - → angle-labels.test.ts を、字が自分の頂点から 50 以内にあり、しかも 3 つの頂点のうち自分の頂点がいちばん近いかを見る形に強めた（字が別の角の大きさに見える置き方で失敗する）。右のはしの 204 に名前（`LEFT_MAX_X`）と理由（右の三角形は x=210 から描く）を付けた。
    - 細い三角形で角の字が辺の上に乗る（t0・t2 の底辺、t4 の 90° が辺 AC の中ほど）のは、高さ約 14u の図に 24〜26 単位の字を 3 つ入れるので避けられない。白いふちで読め、どの字もいちばん近い頂点が自分の頂点なので受け入れる。
  - decimal-div.ts: exact・rem の解説を短くし、exact・further・rem の解説の図を、倍したあとの 1 行の表（`divFigMoved`）にした（もとの式は画面の式にある）。外した「（うつした 小数点では ありません）」は誤概念 rem-point と導入にある。4 画面とも解説が板に入る（scrollHeight＝clientHeight・▼ なし）。decimal-mult・decimal-shift は W4 のあとで違反 0 だったので変えていない。
- **g4-math**:
  - div-2digit.ts: 商が 2 けた（twoq）の解説を「上の 位から じゅんに わると、… ＝ …。たしかめ: …」にし、解説の図を商を入れた 2 行の筆算（`answerDivFigure`。div-1digit と同じ作り）にした。check の図は size l、あまりと数の間は U+00A0。導入の「24 × 6 ＝ 144　156 − 144 ＝ 12」は式ごとの 2 行（column）にした。
    - → 担当の報告の「手順はヒント②③にある」は事実とちがった（③は②の十の位の式に「のこりの 位も 同じように。」を足しただけで、一の位の手順も商に 0 がたつ場合も、ヒント・解説のどこにも無かった）。ヒント③を②と同じ「○の位:」の形で、一の位の手順の入口まで進める文にした（「一の位: あまりの 14に 1を おろして 141 ÷ 16。」。十の位のあまりが 0 のときは「一の位: あまりは 0。1を おろして 1 ÷ 27。」。答えは出さない。式の中は U+00A0）。途中で試した長い文は 1280×620 で「一／の位」と折れた（検査には出ない）のでやめた。
  - order-ops.ts: 導入の式「（○ ＋ △）× □ ＝ …」を size l にした（xl では「＋ △ × □」が次の行に落ちた）。
- **p5**（measure-compare.ts）: ものさしの右はしに単位「こ」を書かない（`labelUnit: ''`）。いちばん右の「10」の真下に「こ」が来て重なり、ものさしの枠の下の線も横切っていた。「めもり いくつぶん」を数える図なので「こ」が無くても伝わり、「こ」は答えの欄に出る。空の text は図の枠を広げない（svgText.ts）。
- **soc-g34**:
  - water-waste.ts: 5 の正解の札「いつでも安心して飲める水をとどけるため」から「いつでも」を外した（時間の面はヒント①と解説に残る。正解の札は 19 字から 15 字になり、誤答（12・9・11 字）との長さの差で答えが分かる度合いも減った）。
  - prefectures.ts: 方位の問題の長野→山梨を、岐阜→静岡にした（エンジンのピンの位置で 131.7°・南東・境目から 19.2°。ファイルの頭の「境目から 10 度以上」を満たし、答えの方位の偏りは変わらない）。地図の「きた」と県名「しずおかけん」は、4 サイズとも県名の字の約 0.6 字分（17.8〜30px）あく。古い id（bearing-20-19）を参照している所は無い。
- **sci-g34**:
  - light-sound.ts: 20 の図の見出し「日光を 当てると」（選択肢の頭と同じ文）を外した。
  - wind-rubber.ts: 9・21 の図の見出し「風の 力」「ゴムの 力」を、問題文に入れた（air-water の「とじこめた 空気に ついて、ことばで まとめよう」と同じ書き方。4 サイズとも 1 行）。
  - current.ts: 16 の札「＋極どうし、－極どうしを つなぐ」を「同じ 極どうしを つなぐ」（単元のヒントと同じ言い方）に、解説を 2 行に入る長さにした（「大きく なる」→「大きい」、「ほぼ」を外した）。単元のほかの所は「ほぼ 同じ」だが、「1こと 同じ」もふつうの言い方で誤概念にならない。「ほぼ」を戻すと 3 行になる。
- **sci-g56**（combustion.ts・electricity-use.ts）: combustion/8・17・25、electricity-use/16 の選択肢を短くした。正解は 1 つで、誤答は表や図と食いちがう。誤概念の ID・ヒント・解説は変えていない（8 で外した「空気の 中の」は解説に、25 で外した「下に」は表の見出し「下の すき間」に残る）。4 問とも選択肢は 2 段か表の下の 1 段に入り、字は 2.2u。
- **life-g12**（town.ts）: g2.life.town の match（place-m1〜m6）の問題文を 1 行にし、4 組の問題（m6）の解説を短くした。
  - → 担当の問題文「まちの ばしょと はたらく ひとを、せんで むすぼう。…」は「ばしょと はたらく」と続けて読めるので、「まちの ばしょと、はたらく ひとを せんで むすぼう。（えは れいだよ）」にした（ほかの match の「おはなしと、あう しきを せんで むすぼう」と同じ形。字数は同じ）。
  - → 担当の m6 の解説（かんばんの えを みて…）はヒント①②のくり返しに近く、答えを言っていなかった（pack-brief の「解説＝答えと理由」に足りない）。4 組の「ばしょは「ひと」」を全部書き、結びの注意「ちがう ばしょの ひとと むすばないように ね。」（同じ注意は誤概念 place-mix の文にある）だけを省く形にした。4 行になり、3 組の解説と同じ高さ。3 組以下は元の文のまま（`MATCH_NOTE_MAX`）。
- **prog-g16**（kit.ts・decompose.ts）: g3.prog.decompose の join-j6・j7（28・29）の解説を、「この みちは 5つの ぶぶんに わけられるよ。はじめの ぶぶんは …。」と、ぶぶんの数とはじめの 1 ぶぶんを言う文にした（手順が 7 つ以上の言い方になるときだけ。j1〜j5 は今までの「たとえば …」のまま。全部の手順は解説の画面の答えの札の列に出て、列はスクロールの印つきで見られる）。`PuzzleSpec` に `explain`（解説の全文）を足した。

受け入れたもの:

- **g5.ja.text-figure/8 のヒント①（1920×1080）の overlap-text「10｜15」**: `src/engines/figure/Figure.tsx` の Chart は縦軸の数を `ceil(字の大きさ × 1.1 ÷ 1目もりの高さ)` おきに間引くので、数の間はいつも字の 1.1 倍以上あり、字の本体は重ならない。検査が SVG の text の外接（ascent＋descent で約 1.47em）をそのまま使うことと、枠で切れた「15」の箱が低くなって閾値（低いほうの 0.3 倍）が 4px まで下がったことが重なった誤検出。開発用の画面（ヒント①の 1920×1080・1536×864、/25 の解説の 1280×620）で目で見て、重なりは無かった。教材で消すには scaleStep を 10 にするしかなく、割に合わない。検査の側の直しは次の回にする（下）。
- g6.sci.electricity-use/16 の正解「同じ 回数で 発光ダイオードが 長い」（「長い」の主語を省く。真上の表の「ついて いた 時間」の欄の「長い」と対応する）と、g6.sci.combustion/25 の誤答「すき間は いらない」（パックの「〜は かんけい ない」の型から外れる）: 意味がはっきりしていて誤概念とも合うので受け入れる（「長く つく」「すき間は かんけい ない」は 1 段に入らない）。
- 小3以上の解説の文が語の途中で折れるもの（g5.math の「小数／点」「あま／り」、g6.sci.combustion/8 の「二酸／化炭素」など）は 4. のとおり受け入れる。

確かめたこと（commit の前）:

- `npm run voice:packs` を流し直しても台本は変わらない（HEAD との差分は、直した文の入れ替えだけ。改行だけ変わった JSON は無い）。`npm run build:unit-index`・`npm run chars` も変わらない（used-chars が同じなので、フォントは作り直していない）。英語の文は変えていない。
- `npx tsc -b`・`npx eslint src/packs src/illust`・`npx prettier --check`（変えたファイル。担当が CRLF にしていた prog-g16/kit.ts・decompose.ts、sci-g56/combustion.ts・electricity-use.ts、soc-g34/water-waste.ts を LF に戻した。中身は同じ）・`npx vitest run src/packs src/illust src/curriculum`（85 ファイル 1,533 件）・`npm run check:design`・`npm run check:packs`。
- 検査（単元に絞った実行。`.cache/text-layout/units/` の結果）で、直した単元とその近くの単元はどれも違反 0・errors 0: g1.ja.folktales・g2.ja.listen-notes・g4.ja.write-report・g4.ja.info-compare・g4.ja.idioms・g4.ja.plain-polite-style・g6.ja.read-literature・g3.math.bar-graph・g4.math.div-2digit・g4.math.order-ops・g5.math.congruence・g5.math.decimal-div・g5.math.decimal-mult・g5.math.decimal-shift・p5.math.measure-compare・g4.soc.water-waste・g4.soc.prefectures・g3.sci.light-sound・g3.sci.wind-rubber・g4.sci.current・g4.sci.temperature・g6.sci.combustion・g6.sci.electricity-use・g1.life.school-safety・g2.life.town・g3.prog.decompose・g6.prog.efficient。レビューのあとで文を変えた g2.ja.listen-notes・g2.life.town と、検査が古いままだった g4.math.order-ops は、commit の前に流し直した（ポート 4655 の一時の設定・専用の依存の cache。終わってから消した）。

残したもの（次の回）:

- **p5.math.numbers-10/4・5**（ord の問題すべて。seeds=6 の ord:1:5・ord:5:6 も同じ）: 作業領域が 2.3u 足りない（4 サイズ × 問題・ヒント①②）。1280×720 では選択肢の札の名前「きつね・かえる・うさぎ」が下で切れて ▼ が出るので受け入れない（どうぶつの列 9.6u＋札 15.3u で 28.5u 要るのに 26.3u）。パックの中では選択肢の字を消す（label を省く）か列を小さくするしかなく、読み上げにも関わる設計の判断が要る。
- 7. の「残したもの」のうち、今回のパックの直しで手を付けなかったもの: g5.ja.sentence-relations/37〜39 の問題・ヒント（choice、2.5〜2.7u）、g6.sci.strata/17 の sort の解説（札「下から れき・砂・どろと ならぶ 層」の orphan と 5.3u）、g4.math.fraction-kinds/4 の解説（数直線 2 本の列が板に 5.1 行分入らない）、g3.ja.listen-memo/19・26 の解説（1920×1080 で 1.3u）。
- **読解の詩の行**（エンジン）: `reading.tsx` は詩（genre: 'poem'）の行も 1 つの p の中の inline の span として並べるので、詩の行が行ごとに改行されず、散文のように流れる。行の区切りが見えないのは詩として正しくない。共通の直し（行を block にする・連の間をあける）に回す。
- **検査の SVG の text の重なり**（検査）: 外接の箱（約 1.47em）で見るので、字の本体が離れていても、枠で切れた箱があると閾値が下がって重なりに出る（上の g5.ja.text-figure/8）。字の本体の高さで見るなど、誤検出を消す直しを検査の側で考える（直したら理由を `docs/test-plan.md` 3.2 に書く。今回は `e2e/helpers/text-layout.ts` をほかの担当が直している最中なので触っていない）。
- g6.sci.combustion の gas の問題（17）の問題文「正しい 組み合わせは？」は、選択肢が「燃やす はたらきが あるのは 酸素だけ」の言い切りになって少し合いにくい。8・16 と同じ「ことばで まとめよう。正しい のは どれ？」（台本にある）にするかは統括が決める。

## アプリの画面（2026-11-07・分析と設計）

単元の画面は `check:text-layout` が全問題を見ているが、アプリの画面（起動・プロフィール選択・ホーム・ほかの がくねん・選ぶ画面・単元の地図・ノート・おえかき・作品・保護者画面）は見ていなかった。前回の点検で「ほかの がくねん」（`#/explore`）の幼児の区分で 10 枚目の「えいご」の札が舞台の下で切れて押せないこと、保護者画面と設定は開発用の hash で開くと起動画面に戻されて目で見られないことが分かった。この節は、アプリの全画面を同じ考え（重なり・切れ・舞台の外・押せない・小さすぎる字・変な改行）で検査する仕組み（AC）と、いまの崩れの直し方（A0〜A10）を決める。

### 0. 調べ方と、いまの崩れ

調べ方:

- 自分の開発サーバー（127.0.0.1:4547、`MNW_DEV_NO_HMR=1`。4299 は使っていない。終わってから止めた）で、一時の Playwright の巡回（`e2e/app-scan*.tmp.spec.ts` と一時の設定。終わってから消した）を流した。
- プロフィールは 11 通り: 2〜3さい（2さいの段階・3さいの段階）、4さい、4さい（えいごの札を隠す `showPreschoolEnglish: false`）、5さい、小1〜小6。画面サイズは 4 通り（1280×720・1920×1080・1280×620・1536×864）。
- 画面ごとに `textLayoutProbe`（`e2e/helpers/text-layout.ts`）と `inspectLayout`（`e2e/helpers/layout.ts`）を当てた。
- 中身の多い状態も作った: 小学生のおすすめに「ふくしゅう」2 件（学年でいちばん長い題の単元）、小3 は文字 1.3 倍・ふりがな すべて、ノート 14 日分、作品 18 枚＋なぞり 5 枚、プロフィール 4 人（20 字の名前・空白のある名前）。
- 起動画面の「きょうざいの じゅんび」は、開発サーバーではオフラインの準備が整わず出ない。そのため部品の DOM を差し込んで近似した（直したあとは A5 の開発用の指定で本物を出す）。
- のべ 1,398 画面を調べた。

いまの崩れ（件数は検査の種類の件数。「画面」は プロフィール × 画面サイズ の数）:

| 画面 | 違反のある画面 / 調べた画面 | 主な種類と件数 | 原因 |
|---|---|---|---|
| ほかの がくねん（幼児の区分 2〜3さい・4さい・5さい のタブ） | どのプロフィールでも全サイズ | out-of-stage 286 | **10 枚目の「えいご」の札が舞台の下に出て押せない**。札は 3 列 × 14u・間 1.6u で、10 枚だと 4 段になる。上 8u ＋ 4 段で 68.8u、舞台は 56.25u なので、札の上端 54.8u・下に 12.5u はみ出す。`.screen.explore` の scrollHeight / clientHeight は 1280×620 で 758 / 620、1280×720 で 881 / 720、1536×864 で 1057 / 864、1920×1080 で 1321 / 1080。舞台は overflow: hidden なので、スクロールでも見えない |
| 単元の地図（小学生の教科 × 学年） | 134 / 134 | scroll-hidden 1626・button-split 946・text-outside-box 800・overlap-text 180・covered 163・orphan 21・small-text 16 | (1) `.smap-unit` の `min-height: 8u` が flex の自動の最小（中身の高さ）を置きかえるため、列（`overflow-y: auto` の flex の縦並び）が札を 8u まで縮める。2〜5 行の題が札の外にあふれ、下の札に重なる。(2) 題の幅が約 9.75u（札 22.8u − 線 0.9u・0.35u − 余白 1u − 絵 5.4u − 間 1u − 印の分の余白 4.4u）で、2.2u の字が 1 行に 4 字ほどしか入らない。(3) 分かち書き・文節の折り方の指定が無く、語の途中で折れる（「たしざん／の ひっ／さん」「長さの た／んい」「小数の わ／り算」「よむ（1ね／ん）」）。(4) 列ごとのスクロールに印が無い（算数の小1・小3 は 1 列 11 枚で、見えるのは 4 枚ほど）。(5) 小2 の題の分数が 1.8u（最小 2.0u。アプリの画面に `--text-min` が無い） |
| 小学生ホームの「きょうの おすすめ」 | ふつうの状態はホーム 45 画面のうち 21（すべて小学生）、中身の多い状態 24 / 24 | text-outside-box 236・button-split 68（ふつうの状態は 40）・overlap-text 101・covered 69・orphan 28・small-text 8 | 札 30u × 8.6u に、題（`--text-label` 2.6u、絵 6.4u の右の約 19u）が 3 行以上になって入らない（小4〜小6 の「表現の工夫（比喩・反復など）」「雨水の ゆくえと 地面の ようす」など）。文字 1.3 倍・ふりがな すべてでは見出しと次の札に重なる。語の途中で折れる（「ていねいな こ／とば」「話し言葉と書き／言葉」）。「ふくしゅう」の札の字が 1.8u（小1・小2 の最小 2.0u 未満） |
| 選ぶ画面（幼児の札に単元が 2 つ以上のとき） | 44 / 172 | button-split 48 | 札の名前に分かち書きの折り方（`data-wakachi`）が無い（「おかいも／の ごっこ」「かずと い／ろと もの」「ながい えい／ごの えほん」「せん・かた／ち・めいろ」）。6 枚（2 段 × 22u）だと下の余白が約 1u（2u 未満） |
| 起動画面の教材の準備（近似） | 8 / 8 | overlap-text 11・covered 12 | 保護者向けの表示（`.start-notes`、下に絶対配置）が 2 行になると、真ん中の列の「さきに あそんで いいよ」「おうちの ひとに みてもらってね」「もういちど」に重なる。small-text 16 は保護者向けの字を子供の最小（u）で測った誤検出 |
| プロフィール選択（20 字の名前） | 4 / 4 | button-split 3 | 名前に分かち書きの折り方が無い（「さくら は／るか みな／み」）。札の高さが名前の行数でそろわない（重なりは無い） |
| がんばりノート（14 日分） | 4 / 4 | scroll-hidden 80・word-split 4 | 一覧はスクロールするが印が無い（1280×620 で scrollHeight 1655 / clientHeight 532）。日付の列 16u に「10がつ30にち」（2.6u）が入らず「10がつ 30／にち」 |
| さくひん（18 枚＋なぞり 5 枚） | 4 / 4 | scroll-hidden 28 | 一覧のスクロールに印が無い（1247 / 532）。3 段目が半分で切れて見える |
| 保護者画面の各タブ | 全タブ | ボタン・選ぶ欄の高さ不足 416（ボタン 34px・選ぶ欄 24px・ファイル 23px）、word-split（「えいごの えほん（4／歳）」） | DESINGN.md 2章の「保護者画面のボタンの高さ 44px 以上」を、ボタン（padding 5px 12px）・選ぶ欄・入力欄が満たさない。「このアプリについて」の幼児の英語の表で、年齢の括弧が数と単位の間で折れる。wakachi-split は大人の文を子供の規則で見た誤検出 |
| 保護者の入り口（ゲート） | 全サイズ | covered 1096・overlap-button 516・small-text 613 | どれも誤検出。後ろのホーム（ゲートの板で隠すのが設計）と、大人の字（px）を u で測ったもの。板の中は、数字キー 52px・もどる 44px・注意書き 12px で問題なし |
| おえかきの板（かみを えらぶ） | 4 / 4 | covered 100・overlap-button 16 | 誤検出。後ろの道具欄（板で隠すのが設計） |
| 幼児ホーム・小学生ホームの右の列 | 全サイズ | （検査の種類なし） | 右の列の下端が 54.8u で、下の余白が約 1.4u（2章の 2u 未満）。幼児は おすすめ 2＋おえかき・ノート 11u＋えいご、小学生は おすすめ 3＋おえかき・ノート 11u |
| 意図して小さい札 | — | small-button | 鍵 4.5u（2章）、おえかきの くわしく の色の札 4.5u（19章）。違反ではない |

違反が無かった画面: ほかの がくねん の小学生のタブ（246 画面）、遊び方を選ぶ画面（24）、おえかき（かんたん・くわしく。41）、ふつうの起動画面（41）、プロフィール選択（短い名前）。幼児ホームは右の列の余白だけ。

そのほかに分かったこと:

- 開発用の hash で開いても起動画面に戻る。理由は二つ。`App.tsx` の `needsStart`（「はじめる」を押すまで子供画面を出さない。VO-05）と `parentLocked`（ゲートを通るまで保護者画面を出さない）。
- 保護者ゲートの長押し（`openParent`）は、小4 のプロフィールで 4 サイズ中 3 サイズが 6 秒以内に開かなかった。おえかき → ホームの直後で、`onPointerLeave` で取り消された可能性がある。検査では保護者画面を開発用の指定（AC-2）で開き、ゲートの画面だけを長押しで開く。
- 単元の地図・おすすめの札の絵が、パックの絵の読み込み前で点線の枠（DEV）になる単元がある（g1.ja.folktales の `book` ほか）。絵の登録の担当に回す（4.）。

直し方を試したもの（ほかの がくねん）: 4 列（15.4u）の CSS を差し込むと、4 サイズとも「えいご」の札は左 81u・上 39.2u・15.4u × 14u に入った。格子の右端 96.4u・下端 53.2u、`.screen.explore` は scrollHeight = clientHeight、`textLayoutProbe` の違反は 0。

### 1. 検査の仕組み（AC。`npm run check:app-layout`）

#### AC-1 ファイルと実行

- 設定は `playwright.app-layout.config.ts`。
  - `testDir: 'e2e'`、`testMatch: /app-layout.*\.al\.ts$/`。project は `screens`（`e2e/app-layout.al.ts`）と `probe`（`e2e/app-layout-probe.al.ts`）。
  - `reducedMotion: 'reduce'`、`--mute-audio`、`retries: 0`、reporter は line。
  - 開発サーバーは `npx vite --host 127.0.0.1 --port ${MNW_PORT ?? 4298} --strictPort` を `MNW_DEV_NO_HMR=1` で起動する。4298 にするのは、全体の文字の検査（4299）と担当の開発サーバー（4300〜4999）にぶつけないため。`MNW_REUSE_SERVER=1` で起動済みのサーバーを使う。
- 本体と補助:
  - `e2e/app-layout.al.ts`: 1 プロフィール = 1 テスト。
  - `e2e/helpers/app-layout.ts`: 画面の一覧・巡り方・ページの中の検査 `appLayoutProbe`。
  - `e2e/helpers/app-layout-fixtures.ts`: プロフィールと中身の作り方。
  - `e2e/helpers/app-layout-report.ts`: 要約。
- 結果:
  - 要約は `docs/screenshots/app-layout-report/summary.md`・`report.json`・`shots/<種類>/`（text-layout と同じ形）。
  - 途中の結果は `.cache/app-layout/<プロフィール>.json`。同じ条件（プロフィール・画面・サイズ・`src/app`・`src/parent`・`src/drawing`・`src/ui` の更新時刻の最大）の結果があれば飛ばす。
  - 報告書と .cache は commit しない。
- 環境変数:
  - `MNW_APP_PROFILES=p4,g*`: プロフィールを絞る。`*` が使え、カンマで区切る。
  - `MNW_APP_SCREENS=explore*,parent-*`: 画面を絞る。
  - `MNW_FRESH=1`・`MNW_WORKERS`（既定 3）・`MNW_REUSE_SERVER=1`・`MNW_PORT`。
- `package.json` の scripts:
  - `"check:app-layout": "playwright test -c playwright.app-layout.config.ts --project=screens"`
  - `"check:app-layout:probe": "playwright test -c playwright.app-layout.config.ts --project=probe"`
  - `"check:app-layout:summary": "tsx e2e/helpers/app-layout-report.ts"`
- 違反は失敗にしない（text-layout と同じ）。テストが失敗するのは、画面に行けないとき（目印が出ない・例外）だけ。
- 目安の時間: 3 並列で 15 分前後（今回の一時の巡回は 44 テスト 9 分）。

#### AC-2 画面への行き方（開発用の指定。本番では消える）

- `src/app/devOpen.ts`（新規）に次を置く。

  ```ts
  export const DEV_OPEN = import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('dev-open');
  ```

- `AppState.tsx` は、`started` の初期値を `DEV_OPEN` にする。`parentUnlocked` の初期値は `DEV_OPEN && location.hash.startsWith('#/parent')` にする。
  - `http://127.0.0.1:<port>/?dev-open#/parent/settings` や `/?dev-open#/explore/p4` で、起動画面とゲートを通らずに開く。目で見るのにも使う。
  - 音は鳴らない（`audio.unlock` を通らない）。保護者画面から子供画面へ移るとゲートは閉じる（今までどおり）。
- `import.meta.env.DEV` が false の本番ビルドでは式ごと消える。`devOpen.test.ts` で、指定の無いときに false であることを確かめる。
- 起動画面の状態は、開発用の `?dev-setup=preparing|renewing|failed|offline` と `?dev-notes=2` で出す（A6）。
- 子供の設定と中身は、`e2e/helpers/app.ts` の `idbPutMany`（テスト専用）で書いてから読み込み直す。
- 作品は、1 枚を描く画面で描き（線 1 本）、残りを開発サーバーの `await import('/src/drawing/persist.ts')` の `duplicateArtwork` で増やす。画像の形を検査の側で作り直さない。

#### AC-3 プロフィール（子供の設定）

| キー | 区分 | 設定 | 見るもの |
|---|---|---|---|
| p23-2 | toddler・toddlerStage 2 | 既定 | 札 4 枚のホーム・おすすめなし・えいごなし |
| p23-3 | toddler・toddlerStage 3 | 既定 | |
| p4 | p4 | 既定 | えいごの札あり |
| p4-noen | p4 | `showPreschoolEnglish: false` | えいごの札なし |
| p5 | p5 | `unitsOpened: ['p5.en.abc']` | えいごの選ぶ画面が 6 枚 |
| g1〜g6 | gN・enrolledGrade N | 既定（表現・ふりがな・おえかきの道具は区分の既定） | |
| g3-big | g3 | `textScale: 1.3`・`furigana: 'all'` | 字がいちばん大きく、ふりがなが多い |
| g4-left | g4 | `drawingHand: 'left'` | おえかきだけ（道具欄が右） |

中身の状態は二つ。`fresh`（作ったばかり）と `full`（AC-0 の中身の多い状態）。

- `full` の中身: 14 日分の遊んだ記録、すき 3 つ、作品 18 枚＋なぞり・みちの作品 5 枚、メモ 10 件、記録（attempts）。
- 小学生の `full` には次も入れる。学年でいちばん長い題の 2 単元を「ふくしゅう まち」、6 単元を「とりくみちゅう」、2 単元を「できた」「しっかり」。
- プロフィールは 4 人にする（20 字＝`NAME_MAX` の名前、空白のある名前、英字の名前、ふつうの名前）。

#### AC-4 画面の一覧

検査の段階（stage）は、その画面の中身の段階にする。分かち書きと最小の字はこれで決まる。ほかの がくねん のタブ・単元の地図の学年のタブでは、子供の区分ではなく表示している区分を使う。

| 画面の ID | 行き方 | 範囲・規則 | プロフィール・状態 |
|---|---|---|---|
| `start` | `/`（プロフィール 1 人） | 子供。`.start-notes` は大人の島 | 全部・fresh |
| `start-setup-<preparing・renewing・failed・offline>` | `/?dev-setup=…&dev-notes=2` | 同上 | p4・g3 |
| `profile-picker` | `/`（4 人）→ はじめる | 子供 | p4・full |
| `home` | `/?dev-open#/home` | 子供 | 全部・fresh と full |
| `explore-own`・`explore-<p23〜g6>` | `#/explore`・`#/explore/<st>` | 子供（段階は st） | 全部・fresh |
| `card-<札>` | `#/card/<区分>/<札>`（札に単元が 2 つ以上のもの。えいごを含む） | 子供 | 幼児・fresh |
| `variant-<単元>` | `#/legacy/<単元>`（遊び方を選ぶ画面が出るもの） | 子供 | p23-3・p4 |
| `resume-<単元>` | 下書き（drafts）を入れて `#/legacy/<単元>/<遊び方>`（「つづきから？」） | 子供 | p4 |
| `subject-<教科>-<学年>` | `#/subject/<教科>/g<学年>` | 子供（段階は学年） | 小学生は自分の学年の全教科（fresh・full）。p4 と g3 はすべての教科 × 学年（のぞく側が幼児と小学生） |
| `notebook` | `#/notebook` | 子供 | 幼児・小学生・fresh と full |
| `gallery`・`gallery-old-view`・`gallery-confirm` | `#/gallery`、なぞりの作品を開く、すてる → ほんとうに？ | 子供。板は板の中だけ（AC-5） | p23-3・p4・g4・full |
| `draw`・`draw-stamp`・`draw-shape`・`draw-paper`・`draw-select` | `#/draw/new/plain`、各板を開く、はんこを置いて選ぶ | 子供。板は板の中だけ | p23-3・p4・g4・g4-left |
| `parent-gate` | ホームで鍵を長押し | 板 `[aria-modal="true"]` の中だけ・大人 | p4・g3 |
| `parent-<records・settings・works・memos・profiles・data・packs・about>` | `/?dev-open#/parent/<tab>` | `.parent-root`・大人・ページのスクロール | p23-2・p4・g3・g6・full |
| `parent-profiles-confirm` | プロフィール削除 → 確認 | 確認の板の中だけ・大人 | p4・full |

#### AC-5 検査（`textLayoutProbe` の再利用と、アプリの画面の検査）

`e2e/helpers/text-layout.ts` の `TextProbeOptions` に次の項目を足す。**どれも省略時は今と同じ動きにする**（単元の検査の結果を変えない。`check:text-layout:probe` 29 本を流して確かめる）。

- `root?: string`: 調べる範囲の CSS セレクタ（既定は `.stage`、無ければ body）。
  - 板（`[aria-modal="true"]`・`.draw-panel`・`.draw-confirm`）が出ているときは、その中だけを見る。後ろの画面は板で隠すのが設計なので、covered・overlap-button に数えない。
  - 舞台の外の判定の範囲は、root が舞台の中なら舞台、外なら画面。
- `adultSel?: string`・`minAdultPx?: number`（既定 12）: 大人の文字の範囲。
  - 対象は保護者画面、ゲートの板（`.gate-panel`）、起動画面の保護者向けの表示（`.start-notes`）、各画面の「（保護者の方へ）」の文。
  - この中の字は、最小の大きさを px（12px）で見る。分かち書き（wakachi-split）とボタンの中の語の折れ（button-split）は見ない。行頭・行末の禁則、数と単位の折れ（word-split）、重なり、切れは見る。
- `pageScroll?: string`: 画面全体のスクロールの枠（保護者画面の `.parent-root`）。
  - この枠で切れる字を scroll-hidden にしない。
  - 巡回の側が `scrollTop` を 0 から `clientHeight × 0.8` ずつずらして、そのたびに検査し、同じ違反（種類・文字・場所）をまとめる。画面の外の字の隠れ（`elementsFromPoint` は画面の中しか見ない）も見られる。

`e2e/helpers/app-layout.ts` の `appLayoutProbe`（ページの中で動く。外の名前を使わない）で、アプリの画面に特有のものを見る。種類は次のとおり。

| 種類 | 見るもの | 規則の出どころ |
|---|---|---|
| `screen-overflow` | 画面の中身（ボタン・字・図）が舞台の外へ出る。1 画面 1 件で、超えた u と、押せない札の名前を書く | DESINGN.md 2章（舞台の中に収める） |
| `unreachable` | 押せない札。見えている部分が札の半分未満、または中心と四隅の内側の点が別の要素に当たる、または舞台の外 | 同上 |
| `tap-size` | 子供は補助 5.5u・主操作 6u 未満（主操作は `.home-card`・`.home-rec`・`.school-subject`・`.smap-unit`・`.choice`・`.gallery-thumb`・道具の札。学年のタブ `.explore-tab`・`.smap-tab` は補助の 5.5u で見る）。大人は高さ 44px 未満（button・select・テキスト・数・ファイルの input・summary。checkbox・radio・range は除く） | 2章の表、2章の保護者画面 |
| `tap-gap` | 同じ並びの主操作どうしの間が 1.6u 未満（今の `home-gap` を全部の主操作に広げる） | 2章 |
| `scroll-no-cue` | 子供画面で縦にスクロールする枠（overflow-y が auto・scroll で、`scrollHeight > clientHeight + 2`）に `data-scroll-region` と見える印（`data-scroll-cue`）が無い。1 枠 1 件 | 5.1・A0 |
| `scroll-no-button` | 幼児が見る画面（プロフィールの区分が p23・p4・p5）のスクロールの枠に、▲▼ の札（`[data-scroll-btn]`）が無い | ux-by-age 1章（2〜3歳はドラッグを使わない）・A0 |
| `fit-overflow` | A0 の AppLabel が下限の字まで縮めても入らない（`data-fit-overflow`）。教材の題を短くする手がかり | A0 |
| `edge-margin`（参考） | 主操作の札の下端・左右が舞台の端から 2u 未満 | 2章 |
| `missing-illust`（参考） | 絵が無くて DEV の点線の枠になっている（`svg[data-illust]` の中が仮の枠） | 6章 |

除くもの（理由をコードと docs/test-plan.md に書く）:

- 鍵（`.gate-key` 4.5u。2章で意図して小さい）。
- くわしく の色の札（`.draw-screen--detailed [data-testid^="color-"]` 4.5u。19章）。
- 板の後ろ（root で除く）。
- `data-scroll-region="list"` の枠の中で、印のある状態のスクロール。text-layout と同じく、1 字ずつ数えない。印が無いときだけ出す。
- text-on-figure（参考のまま）。

落ち着くのを待つ（settle）。text-layout の `settle` と同じ考えで、次の印が 4 フレーム続けて同じになるまで（最大 1 秒）待つ。

- 印にするのは `document.fonts.ready`、全部の img の `complete`、ボタンの数と外接、`[data-fit]` の値、スクロールの枠の scrollHeight。
- 待っても変わり続ける画面は、detail の先頭に `unstable:` を付けて残す。

画面サイズは、画面を開いたまま 4 サイズに変えて測る（text-layout と同じ順）。サイズを変えたら settle をやり直す。

#### AC-6 検査の確かめ（probe）

`e2e/app-layout-probe.al.ts` で、`page.setContent` に壊した見本と普通の見本を作り、出ること・出ないことを確かめる。

- 舞台の下に 4 段目の札がある格子（explore と同じ形）: `screen-overflow`・`unreachable` が出る。3 段なら出ない。
- 印の無いスクロールの一覧: `scroll-no-cue` が出る。`data-scroll-region="list"`＋印なら出ない。幼児の段階で ▲▼ が無いときは `scroll-no-button` が出る。
- 大人の範囲の 11px の字: 出る。13px: 出ない。34px のボタン: `tap-size` が出る。44px: 出ない。
- `aria-modal` の板の後ろのボタン: covered にならない。板の中で重なった字: 出る。
- `.gate-key` 4.5u: 出ない。`data-fit-overflow`: `fit-overflow` が出る。
- `pageScroll` の枠の画面の外で重なった字: 出る。

#### AC-7 文書

- docs/test-plan.md に「3.3 アプリの画面の配置の検査」を足す。中身は、範囲・プロフィール・画面・種類・除くものとその理由・環境変数・開発用の `?dev-open`・`?dev-setup`。
- E-14（`e2e/layout.spec.ts`）は今のまま残す。モードの遊ぶ画面と完了画面を見るのは E-14 で、アプリの画面はこの検査が受け持つ。

### 2. 直し方（画面ごと。ファイルを分ける）

#### A0 アプリの画面の共通部品（ラベルの折り方と縮め方・スクロールの一覧）

ファイル: `src/ui/AppLabel.tsx`・`src/ui/app-label.css`・`src/ui/ScrollList.tsx`・`src/ui/scroll-list.css`（すべて新規）と、それぞれの単体テスト。`src/ui/ui.css` は変えない。

1. **`AppLabel`**: `<AppLabel text stage ctx className fit? />`。札の名前・題を、中身の段階に合わせて折る。
   - `stage` が p23・p4・p5・g1・g2 なら `data-wakachi` を付ける。base.css の `.stage [data-wakachi]`（keep-all・anywhere）が効く。
   - g3 以上は、`spacedLabel(text)`（rich.ts）が真なら `data-spaced`、偽なら `data-phrase` を付ける。
   - app-label.css に、単元の画面と同じ組み合わせを置く。
     - `[data-spaced]`: keep-all・anywhere・`text-wrap: pretty`。
     - `[data-phrase]`: `word-break: auto-phrase`・`overflow-wrap: break-word`・`min-width: 0`・`max-width: 100%`・`text-wrap: wrap`。
     - 理由は base.css の注のとおり（Chrome で auto-phrase と balance・pretty を同じ要素に付けると、語の途中で折る）。
   - 中身は `Rt`（ふりがな・分数）。
2. **縮めて入れる（`fit`）**: `fit: { fromU: number }` を渡すと、札の内側（線と padding の内側）に字（ふりがなを含めた外接）が入るまで、字を 0.1u ずつ下げる。
   - 範囲は `fromU`（× 文字の大きさの設定）から `--text-min` まで。値は `--fit-fs` に書き、`data-fit` に今の値を書く。
   - 下限でも入らなければ、`data-fit-overflow` を付ける（検査の `fit-overflow`。教材の題を短くする手がかり）。
   - 測り直すのは、`useLayoutEffect`・ResizeObserver（札）・`document.fonts.ready` のとき。同じ大きさで 2 回測ったら止める（揺れない）。
3. **アプリの画面の `--text-min`**: app-label.css に `.stage .screen[data-stage]:not(.unit)` の段階ごとの値を置く。p23〜p5 は 2.2u、g1・g2 は 2.0u、g3・g4 は 1.8u、g5・g6 は 1.7u（17章の表）。単元の画面（`.unit`）は unit.css のまま。分数（`.rt-frac`）とふりがなの下限が、アプリの画面でも効く。
4. **`ScrollList`**: `<ScrollList viewer className label testId>{…}</ScrollList>`。縦にスクロールする一覧の枠。
   - 枠に `data-scroll-region="list"` を付ける。下まで見ていないあいだは `data-scroll-cue` を付け、右の余白（3.6u）の下に ▼ を出す（単元の画面の ▼ と同じ形。`--text-min` の大きさ、paper の地に ink）。下まで行くと消す。
   - `viewer`（見ている子供の区分）が p23・p4・p5 のときは、右の余白を 7u にし、上と下に ▲・▼ の札を置く（補助 5.5u、`data-scroll-btn`、aria-label「うえへ」「したへ」）。押すと `clientHeight × 0.8` 動かす。動きを減らす設定では `behavior: 'auto'`。端では札を `visibility: hidden` にする。
   - 2〜3歳はドラッグを使わない（ux-by-age 1章）。4・5歳も指でのスクロールに頼らない。
   - スクロールの位置は、ResizeObserver と scroll で見る。

#### A1 ほかの がくねん（explore）

ファイル: `src/app/Explore.tsx`・`src/app/explore.css`・`e2e/explore.spec.ts`

- **幼児の区分（p23・p4・p5）の札を 4 列の格子にし、3×3 ＋ 4 列目の 3 段目を「えいご」にする**。
  - `.explore-cards--pre { grid-template-columns: repeat(4, calc(var(--u) * 15.4)); }`
  - 札の大きさは 15.4u × 14u、間は 1.6u（行も列も）。
  - ふつうの札 9 枚は、`def.cards` の順番の位置 i に置く（`grid-column: i % 3 + 1`・`grid-row: ⌊i / 3⌋ + 1`）。出せる単元の無い札は、その位置を空ける（ホームと同じ。並べ直さない）。
  - 「えいご」は `grid-column: 4; grid-row: 3`。ホームの右の列の一番下と同じ、右下の位置にする。
  - 寸法: 格子は左 30u・上 8u から右 96.4u・下 53.2u。舞台の右と下に 2u 以上あく（試した値は 0. のとおり）。
  - 札の字（2.2u・最大 5 字 × 2 行 ≒ 11u）は札の内側 13.5u に入る。17章の「選択肢の絵カード 14〜18u」の範囲、主操作の最小 6u と間 1.6u を守る。
- 小学生の区分（教科の札。最大 6 枚）は、今の 3 列 × 19u のまま。
- スクロールにはしない。幼児が 1 回のタップで全部の札を押せることを優先する。
- 画面の根に `data-stage={stage}` を付ける（今もある）。幼児と小1・小2 のタブでは、札の名前の箱に `data-wakachi` を付ける。
- e2e: `explore.spec.ts` に、1280×620 と 1920×1080 で p23・p4・p5 のタブの全部の札（10 枚）が舞台の中にあり、`explore-card-eigo` を押すと選ぶ画面が出ることを足す。

#### A2 単元の地図（subject map）

ファイル: `src/app/SubjectMap.tsx`・`src/app/subject-map.css`（A0 を使う）

1. **札を縮めない**: `.smap-unit { flex: none; }`。`min-height: 8u` は残す。題が 2 行以上なら札が伸びる。
2. **題の幅を広げる**:
   - 絵を 4.4u にし、状態の印（`MarkIcon`）を右の余白から絵の右下の角へ移す。札（`.smap-unit__icon` の中、absolute）、2.8u、右 −0.9u・下 −0.7u。印は surface の地の輪なので、絵の上でも読める。
   - 札の右の余白は 0.8u にする。題の幅は、4 列・▼ の余白 3.6u で約 13.8u（2.2u の字で 6 字）、幼児がのぞくとき（▲▼ の余白 7u）で約 13u になる。
   - 状態は形で示す（ux-by-age 2.3）のまま。印の aria-label は今のまま。
3. **題の折り方と大きさ**:
   - `AppLabel`（stage は表示している学年）で折る。
   - 字は、小1・小2 が `max(var(--text-min), 2.2u)`、小3 以上が `max(var(--text-min), 2u)`、行間 1.3。
   - 画面の根に `data-stage="g<学年>"` を付ける（A0 の `--text-min` が効き、分数が 2.0u 以上になる）。
4. **一つのスクロールにする**:
   - 列の並び（`.smap-columns`）を `ScrollList` にする（viewer は子供の区分。幼児が「ほかの がくねん」からのぞくときは ▲▼ の札が出る）。
   - 列（`.smap-col`）は自分でスクロールしない（`overflow: visible`・`flex: 1 1 0`・`min-width: 0`。1〜2 列の教科は今の最大 30u のまま）。
   - 列の名前（`.smap-col__name`）は `position: sticky; top: 0`、paper の地、`z-index: 1`。スクロールしても領域の名前が見える。
5. 確かめ:
   - 小1〜小6 の算数・国語の地図（全 4 サイズ）で、text-outside-box・overlap-text・covered・button-split が 0。scroll-hidden は枠ごとの印のある状態だけ。
   - 小1 算数（1 列 11 枚）で、一番下の札まで ▼ で行ける。

#### A3 小学生ホーム（と、幼児ホームの右の列の余白）

ファイル: `src/app/SchoolHome.tsx`・`src/app/school-home.css`（A0 を使う）

1. **おすすめの札**（30u × 8.6u は変えない）:
   - 絵を 5u、左右の余白を 1u、間を 1u にし、題の幅を約 21u にする。
   - 題は `AppLabel`（stage は単元の段階）で、`fit: { fromU: 2.6 }`（`--text-label` と同じ。文字の大きさの設定をかける）にし、`--text-min` まで縮めて入れる。
2. **「ふくしゅう」**:
   - 題の中の字の札（`.school-rec__tag`、1.8u）をやめる。絵の右下の角に、単元の地図と同じ時計の印（`MarkIcon mark="review-due"`、2.8u）を置く。
   - aria-label の「ふくしゅう」は残す。ux-by-age 2.3 の「ふくしゅう まち＝時計の印」とそろえ、題の行を 1 行分あける。
3. **教科の札の名前**も `AppLabel`（stage は学年）にする（今は短いので見た目は変わらない。今後の名前のため）。画面の根に `data-stage`。
4. **右の列の下の余白**:
   - `.school-side__half`（おえかき・ノートの半分の札）の高さを 11u から 10.4u にする。幼児ホーム（p4・p5 のおすすめ 2＋えいご）と小学生ホーム（おすすめ 3）の右の列の下端が、54.84u から 54.24u（下の余白 2u）になる。
   - school-home.css は幼児ホーム・ほかの がくねん も読むので、PreschoolHome.tsx は変えずに効く。
5. 確かめ: `full`（ふくしゅう 2＋長い題）と g3-big で、text-outside-box・overlap-text・covered が 0。残る `fit-overflow` は 4. の content に回す。

#### A4 選ぶ画面（幼児の札の単元）

ファイル: `src/app/UnitEntry.tsx`（A0 を使う）

- 札の名前を `AppLabel`（stage は札の区分 p23・p4・p5。分かち書き）にし、`fit: { fromU: 2.6 }` にする。
- 札は 24u × 22u から 24u × 21u に、行の間を 1.6u（列の間は 2.4u のまま）にする。
- 並びの箱は `top: 8u; bottom: 2u` にし、6 枚（2 段）のときも下の余白を 2u にする。

#### A5 起動画面とプロフィール選択（教材の準備の表示を含む）

ファイル: `src/app/StartScreen.tsx`・`src/app/start.css`（新規。A0 を使う）

1. **保護者向けの表示の帯**:
   - 画面を縦の 2 段の格子にする（上の段 `1fr` に今の真ん中の列、下の段 `auto` に `.start-notes`）。保護者向けの表示が真ん中の列に重ならない。
   - start.css の `.start-screen .start-notes` で、ui.css の absolute を流れの中に戻す。右寄せ、最大幅 60u、下の余白 2u、字は今の `max(12px, 1.4u)`。
2. **教材の準備が出ているとき**（`data-setup` を根に付ける）は、真ん中の列の絵を 18u から 14u に、間を 3u から 2u にする。最も高い状態（失敗の 2 行＋「もういちど」、保護者向け 2 行）でも、上の段に約 7u の余白が残る（0. の近似の測りから）。
3. **開発用の指定**（`import.meta.env.DEV` のときだけ。本番では消える）:
   - `?dev-setup=preparing|renewing|failed|offline` で `PackSetupStatus` の view を、`?dev-notes=2` で保護者向けの表示を最も長い 2 行（保存の問題 version と、教材の準備の失敗 quota）にする。
   - 検査（AC-4 の `start-setup-*`）と目視に使う。
4. **プロフィール選択の札**:
   - 18u × 22u の決まった高さにし、並びを `align-items: stretch` にする。
   - 名前は `AppLabel`（stage p4 の扱い。保護者の入力なので分かち書きの折り方）で、`fit: { fromU: 2.6 }`、下限 2.2u。20 字の名前は 3 行・2.2u で入る（入らなければ `fit-overflow`）。

#### A6 がんばりノート

ファイル: `src/app/Notebook.tsx`・`src/app/notebook.css`（A0 を使う）

- 日の一覧（`.notebook`）を `ScrollList`（viewer は子供の区分）にする。幼児は ▲▼ の札、小学生は ▼ の印が出る。
- 日付（`.notebook-day__date`）は `white-space: nowrap`、幅は `max-content`（最小 16u）。「10がつ30にち」を 1 行にする。

#### A7 さくひん（作品の一覧）

ファイル: `src/drawing/GalleryScreen.tsx`・`src/drawing/drawing.css`（A0 を使う）

- `.gallery-grid` を `ScrollList` にする。おえかきの作品・見出し「なぞりと みちの さくひん」・なぞりの作品を、同じ一つのスクロールにする。
- 右の余白（幼児 7u・小学生 3.6u）の分、4 列の札の幅を詰める。100u − 端 4u − 7u − 間 3 × 1.6u で 21u、19章の 16u 以上を保つ。下の余白は 2u にする。

#### A8 保護者画面

ファイル: `src/parent/parent.css`・`src/parent/AboutTab.tsx`

- `.parent-root` の button・select・テキスト・数・ファイルの input・summary に `min-height: 44px` を付ける（2章）。
  - ボタンの padding は上下 8px、`display: inline-flex; align-items: center` にする。
  - 表の中の「この段階から始める」「大きく見る」「削除」も 44px にする。表が縦に伸びるのは受け入れる。
  - checkbox・radio は、ラベルの押せる所を 44px にする（`label:has(> input[type=checkbox])` の高さ）。
- 「このアプリについて」の幼児の英語の表: 題を `<span className="p-keep">`（`word-break: keep-all`）、年齢を `<span className="p-nowrap">（4歳）</span>` にし、「（4／歳）」「え／ほん」で折らない。th に `min-width: 11em` を付ける。
- 確かめ: 8 タブ × 4 サイズで、大人の `tap-size`・word-split が 0。横のスクロール（`.parent-root` の scrollWidth > clientWidth）が無い。

#### A9 遊び方を選ぶ画面・保護者の入り口・おえかき

変えない（0. のとおり違反なし。板の後ろは検査の範囲で除く）。

#### A10 DESINGN.md

ファイル: `DESINGN.md`

- 5.2 ワイヤーフレーム:
  - 「ほかの がくねん」の図と寸法を足す。左にタブ 2 列 × 5 段（12.5u × 5.5u）。幼児の区分は 4 列 × 15.4u × 14u で、3×3 ＋ 右下に「えいご」。小学生の区分は 3 列 × 19u × 14u。スクロールしない。
  - 単元の地図の図と寸法を足す。札は縮めない、絵 4.4u ＋ 印は絵の右下の角、題の折り方、列の並びは一つのスクロール、列の名前は上に残る。
  - ホーム: 「ふくしゅう」は絵の右下の時計の印。おすすめの題は札に入るまで縮める。右の列の半分の札は 10.4u、下の余白 2u。
- 17章に「アプリの画面の文字」を足す。中身の段階で折る（AppLabel）、`--text-min` の段階ごとの値、縮めて入れる規則と下限、入らないときは教材の題を短くする。
- 5.1 または新しい項に「アプリの画面の一覧のスクロール」を足す。幼児の見る画面は ▲▼ の札（5.5u）＋▼、小学生は ▼。`data-scroll-region="list"`。使う画面は 単元の地図・ノート・さくひん。
- 24章: 保護者向けの表示は下の帯に置き、真ん中の列に重ねない。準備の表示が出ているときの絵 14u・間 2u。開発用の `?dev-setup`。
- 2章の保護者画面の 44px が、ボタン・選ぶ欄・入力欄・summary にかかることを書く。
- 23章（自動検査）に `check:app-layout` を足す。

### 3. 受け入れるもの・検査で除くもの

- 鍵 4.5u、くわしく の色の札 4.5u（DESINGN.md 2章・19章。意図して小さい）。
- 板（ゲート・おえかきの板・確認）の後ろが隠れること。
- 単元の地図・ノート・さくひんの一覧が、印（と幼児は ▲▼ の札）のあるスクロールになること。一覧の長さが中身で決まるので、全部を舞台に入れる設計にしない。違反として数えるのは、印・札が無いときだけ。
- 保護者画面のページの縦のスクロール。

### 4. ほかの担当へ回すもの

- 単元の題（unit-index の title。パックの担当）: A2・A3 のあとに `fit-overflow` が残る題は、意味を保って短くする。候補は、小1 算数「2けたの たしざん・ひきざん（かんたんな けいさん）」、小6 国語「同じ読みの言葉と、漢字とかなの使い分け」、小5 理科「流れる 水の はたらきと 土地の 変化」など。検査の要約に一覧が出る。
- 単元の絵（絵の登録の担当）: 単元の地図・おすすめの札の絵がパックの絵の読み込み前で無い単元（`book`＝g1.ja.folktales・g6.ja.language-change、`music-note`＝g1.ja.word-play ほか）。地図で出すために、絵をコアに入れるか、地図が開くときにパックの絵を読む。
- 保護者ゲートの長押しが途中で取り消されることがある件（`onPointerLeave`）。再現の条件を確かめてから直す。

### 5. 確かめ方（全体）

- AC の実装のあと:
  - `npm run check:app-layout:probe` が全部通ること。
  - `npm run check:text-layout:probe`（29 本）が今までどおり通ること（`TextProbeOptions` の追加が単元の検査を変えていない）。
- A0〜A8 のあと:
  - `MNW_FRESH=1 MNW_WORKERS=3 npm run check:app-layout` を流す。失敗したテストが 0 であることを確かめる。
  - 次の種類が 0 であること: `screen-overflow`・`unreachable`・`scroll-no-cue`・`scroll-no-button`、text-layout の out-of-stage・overlap-text・covered・text-outside-box・button-split・wakachi-split（大人の範囲を除く）。
  - 残る `fit-overflow` は 4. の content。
- `npx tsc -b`・`npx eslint .`・`npx prettier --check`（変えたファイル）・`npx vitest run`・`npm run check:design`、既存の e2e の explore・parent・preschool-english・layout。
- 開発サーバー（4300〜4999）の `?dev-open` で、ほかの がくねん（p23・p4・p5 のタブ、1280×620）、単元の地図（小1 算数・小5 算数）、小学生ホーム（g3-big）、起動画面（`?dev-setup=failed&dev-notes=2`）、保護者画面の せってい を目で見る。

### 6. 担当の分け方（ファイルが重ならない）

| 担当 | ファイル | 先に要るもの |
|---|---|---|
| AC 検査の仕組み | `playwright.app-layout.config.ts`・`e2e/app-layout.al.ts`・`e2e/app-layout-probe.al.ts`・`e2e/helpers/app-layout.ts`・`e2e/helpers/app-layout-fixtures.ts`・`e2e/helpers/app-layout-report.ts`・`e2e/helpers/text-layout.ts`（省略時は今と同じ）・`src/app/devOpen.ts`・`src/app/devOpen.test.ts`・`src/app/AppState.tsx`・`package.json`（scripts）・`docs/test-plan.md` | なし（`start-setup-*` は A5 のあとに出る。それまでは「未対応」と要約に書く） |
| A0 共通部品 | `src/ui/AppLabel.tsx`・`src/ui/app-label.css`・`src/ui/AppLabel.test.tsx`・`src/ui/ScrollList.tsx`・`src/ui/scroll-list.css`・`src/ui/ScrollList.test.tsx` | なし |
| A1 ほかの がくねん | `src/app/Explore.tsx`・`src/app/explore.css`・`e2e/explore.spec.ts` | なし |
| A2 単元の地図 | `src/app/SubjectMap.tsx`・`src/app/subject-map.css` | A0 |
| A3 小学生ホーム | `src/app/SchoolHome.tsx`・`src/app/school-home.css` | A0 |
| A4 選ぶ画面 | `src/app/UnitEntry.tsx` | A0 |
| A5 起動画面 | `src/app/StartScreen.tsx`・`src/app/start.css` | A0 |
| A6 ノート | `src/app/Notebook.tsx`・`src/app/notebook.css` | A0 |
| A7 さくひん | `src/drawing/GalleryScreen.tsx`・`src/drawing/drawing.css` | A0 |
| A8 保護者画面 | `src/parent/parent.css`・`src/parent/AboutTab.tsx` | なし |
| A10 DESINGN.md | `DESINGN.md` | A1〜A8 の寸法（この節のとおり。実装で変えたら合わせる） |

### 7. アプリの画面の実施とレビュー（2026-11-07）

AC・A0〜A8・A10 を担当ごとにファイルを分けて実装した。レビューでは、この節と照らしてアプリの画面のファイルの差分と追加したファイルを全部読み、`check:app-layout` を全部（13 プロフィール・画面 422・検査 約 2,060 回）流した。自分の開発サーバー（127.0.0.1:4643。検査は 4642・4644 の `MNW_DEV_NO_HMR=1`。4299・4298 は使っていない。終わってから止めた）で、ほかの がくねん（p23-2・p23-3・p4・p4-noen・p5 の 3 つの幼児のタブ）・ホーム・保護者画面（せってい・きろく・このアプリについて・プロフィール）・おえかき（かんたん・くわしく・図形の選択板）を 1280×620 と 1920×1080 で開いて画像で見た。幼児のタブの 10 枚の札は、全部が舞台の中（右 96.4u・下 53.2u）で、中心の当たり判定が札に当たり、押すと選ぶ画面・単元の画面・モードの画面に移った（5 プロフィール × 3 タブ × 2 サイズ）。

担当の判断で設計から変えたところ（どれも DESINGN.md に反映済み）:

- A0: ScrollList は外側（className）・スクロールする枠（`data-scroll-region="list"`）・body（`bodyClassName`）の 3 層。AppLabel の親の札は `[data-fit-box]` で指定できる。下限は `app-label.css` の `--text-min-u` を JS が読む（値の正本は CSS の 1 か所）。
- A2: 分かち書き・空白で区切った題に `text-wrap: balance`（最後の行を 1 字にしない）。
- A3: 右の列の見出しの行間を 1.4 に決めた（3.64u。字体の normal だと下端が 0.1〜0.2u 動いた）。右の列の下端は 54.23〜54.24u（下の余白 2u）を実測した。
- A5: 保護者向けの文を文節で折る（auto-phrase）。プロフィール選択の段の間 1.6u。
- A7: 格子の四方に 0.8u の余白（札の影と焦点の輪が枠で切れない）。

レビューで直したもの:

1. **単元の地図の札の間が 1.2u（tap-gap 271 件）**: 列の中の札の間と、列の名前と最初の札の間を 1.6u（`--gap-min`）にした（DESINGN.md 2章の主操作どうしの間）。
2. **幼児がのぞく単元の地図の題（button-split・orphan・kinsoku-start）**: ▲▼ の札の余白 7u で題の幅が約 12.6u に狭まり、2.2u の字で 6 字の語（「ことばあそび」「なんじはん）」「くりあがりの」）が入らず、語の途中や「）」の前で折れた。のぞくときは題の字を 0.2u 下げる（`.scroll-list[data-buttons]`。下限は `--text-min` のまま）。1 行の字の数が小学生の画面と同じになる。
3. **ノートの ▼ が舞台の下へ 0.2u はみ出した（screen-overflow。7 プロフィール）**: 一覧の枠を舞台の下の端まで伸ばしていた。枠の下を 2u（単元の地図・さくひんと同じ）にした。
4. **図形の選択板の色の札が かんたん でも 4.5u（tap-size 24 件）**: かんたん は道具欄と同じ 6u・間 1.6u・4 列（板の右の列 30u に入る）、くわしく は今までどおり 4.5u・6 列にした（19章）。
5. **保護者画面「きろく」のスキルの表の 1 列目が「おぼえてさが／す」（orphan）**: 1 列目を `keep-all` にした（`p-table--skills`。「ひらがな／（よむ）」と括弧の前でだけ折る）。
6. **検査の誤検出（理由はコードと docs/test-plan.md 3.2・3.3）**:
   - `tap-gap`: 選んでいる札（`.is-selected`）の 8章の持ち上がり（`translateY(-1u)`）で、上の札との間が 0.6u に見えていた（おえかきの道具欄・図形の選択板）。持ち上がりを戻した、置いた位置で測る。選んでいない札のずれは戻さない（probe に見本を足した）。
   - `tap-size`: くわしく の図形の選択板の色の札（`shape-color-*`）も、道具欄の色の札と同じく 19章で意図して小さい 4.5u として除く。かんたん の色の札は数える（probe に見本を足した）。
   - 分かち書きの「・」のあとの改行（`textLayoutProbe`。単元の検査にも効く）: 前の項目を空白の所で止めて「ちいさい じ・／のばす おと」（選ぶ画面の札）を「じ」の 1 字と数えていた。項目を「・」か文の始め・終わりで区切った部分（空白を含む句でもよい）にした。1 字の並び（き・つ・つ・き）は今までどおり出る（probe に見本を足した。29 本が通る）。
7. `tsconfig.node.json` の include に `playwright.app-layout.config.ts` を足し、`.gitignore` に報告書（`docs/screenshots/app-layout-report/`）を足した。
8. DESINGN.md: 5.2 ホームの右の列（実測は 54.24u で下の余白 2u。「行間 normal・約 1.9u」と書いていたのを直した）、単元の地図の札の間 1.6u と幼児がのぞくときの字、5.3 の枠の下 2u、19章の図形の選択板の色の札、21章のスキルの表、23章の除くもの。

結果（`MNW_FRESH=1 npm run check:app-layout`。13 テストとも通過・画面を開けないもの 0）: screen-overflow・unreachable・tap-size・tap-gap・scroll-no-cue・scroll-no-button・out-of-stage・overlap-text・covered・edge-margin は **0**。直す前は screen-overflow 1・tap-size 24・tap-gap 271・button-split 38・orphan 6・kinsoku-start 3・kinsoku-end 3・text-outside-box 4・word-split 2・fit-overflow 1・edge-margin 1。

残り（どれも単元の地図・ホームのおすすめの**単元の題**。レイアウトでは直せない。4. のとおり担当へ回す）:

- **教材の題（パックの担当）**: 札の題の幅（小学生の 4 列で約 13.5u・幼児がのぞくとき約 12.6u）に入らない「空白の無い長いまとまり」。意味・学年の漢字・《よみ》・分かち書きを保って、空白を入れるか短くする。
  - 小1・小2（2.2u で 1 行 6 字）: 「むかしばなしを きこう」「じゅんじょよく かこう」「100までの かず・120くらいまでの かず」「むかしばなしと ことばあそび」（button-split）。
  - 小3〜小6（2u で 1 行 6〜7 字。文節で折る題は Chrome の auto-phrase が語を割る）: 「まちの安全を守るはたらき」「文の組み立てとつながり」「熟語の組み立てと言葉の種類」「同じ読みの言葉と、漢字とかなの使い分け」（「、」が行頭。kinsoku-start）「方言と共通語、言葉の変化と由来」（「方／言」）、「いろいろな 四角形（台形・平行四辺形・ひし形）」（「（台／形」「・」が行頭）「分数の しゅるい（真分数・仮分数・帯分数）」「単位量あたりの 大きさ」「10倍・100倍と □・□（小数点の いどう）」（「い／どう」）「変わり方（ともなって 変わる 2つの 数）」「金ぞく・水・空気と 温度」「表現の工夫（比喩・反復など）」（「（」が行末）「歴史2 武士の世の中から江戸の文化まで」「歴史3 明治から今の日本へ」「話し言葉と書き言葉」（ホームのおすすめ）。
  - g3-big（ふりがな すべて）・幼児がのぞくとき（ふりがな すべて）だけ: 「俳句を楽しもう」「ローマ字の読み書き」「漢字の組み立て」「だんらくの役わり」「くらべる・分ける・引用」。
  - fit-overflow（下限 2.0u でも入らない）: 小1 算数「2けたの たしざん・ひきざん（かんたんな けいさん）」（ホームのおすすめ。text-outside-box 3 件も同じ題）。
- **Rt（共通の文字の部品。統括）**: 隣の字を包み（`.rt-nobr`）に取り込めなかった ruby は nowrap にならず、Chrome が ruby の親字の途中で折る（幼児がのぞく小5 社会「わたしたちの生活と食／料生産」「工業／生産」。word-split）。分数（`.rt-frac`）の前の「（」の後ろで折れる（小2 算数「ぶんすう（／□・□・□）」。kinsoku-end）。単元の画面にも同じ形があれば出る。
- **絵（絵の登録の担当。参考の missing-illust）**: `book`（g1.ja.folktales・g6.ja.language-change）・`music-note`（g1.ja.word-play）ほか 6 件。単元の地図・ホーム・ノートで点線の枠になる。
- 保護者ゲートの長押しが途中で取り消されることがある件（4. のまま）。

## 第7回（2026-11-07・分析と設計）

第6回の直し（共通 0ddf24f・パックごと 1b128c8）とアプリの画面の直し（0ceda44）のあとに全単元を流した結果と、独立の点検の指摘 24 点を合わせて分析する。

### 0. 元の結果と、追加で測ったもの

- 元の結果: `docs/screenshots/text-layout-report/`（作成 2026-11-06T20:26Z。313 単元・10,056 問・191,860 画面。`MNW_FRESH=1 MNW_WORKERS=4`。失敗した単元 0・errors 0。全件は `.cache/text-layout/units/`）。件は **18**（第6回の前は 333）。違反のない単元は 301 / 313。
  - 件の内訳: scroll-hidden 15（10 単元）・overlap-text 1・covered 1・orphan 1。clipped・kinsoku-start・button-split・narrow-wrap・small-text・text-on-figure・text-outside-box・markup-leak・wakachi-split・word-split・out-of-stage・overlap-button は 0。
  - 残りの単元: g5.ja.sentence-relations 3・p4.env.seasons 2・p5.math.numbers-10 2・p5.think.pattern 2・g6.sci.strata 2（scroll-hidden・orphan）・g1.math.shapes 1（covered）・g3.ja.listen-memo 1・g4.ja.read-summary 1・g4.math.fraction-kinds 1・g5.ja.text-figure 1（overlap-text）・g6.math.proportion 1・g6.sci.solutions 1。
- アプリの画面の検査（`docs/screenshots/app-layout-report/`。作成 2026-11-06T21:10Z）: 残りは単元の地図・ホームの**単元の題**（button-split 28・kinsoku-end 3・kinsoku-start 2・orphan 2・word-split 2・text-outside-box 3・fit-overflow 1）と、参考の missing-illust 6。アプリの画面の節の 4. で「パックの担当」「Rt（統括）」に回したまま、まだ直していない。この回で扱う（X7 と 5. の題）。
- 開発サーバー（127.0.0.1:4377、`MNW_DEV_NO_HMR=1`。4299 は使っていない。終わってから止めた）で、残りの 18 件の代表と点検の 24 点を開いた。Playwright（同じサーバー）で約 60 画面を撮り、札・絵・図の矩形と計算された CSS を測った。分かったことは次のとおり（u は舞台の単位）。
  - **絵が札の外に出る・札で切れる**（点検 1〜5。検査は字しか見ないので 1 件も出ていない）:
    - p5.en.picture-book/42（1280×620）: 札 4 枚はどれも 14u。いぬ 5 ひきの絵の列は 36.3u で、札の左右に 11.1u ずつ出る。/46 は ねこ 2.9u・いぬ 5.5u、/50 は いぬ 9.3u（札のすき間は 2.4u なので、5 ひき目が隣の札に入る）、/55 は とり 6.9u 出る。解説（1920×1080）も同じ。
      - 原因 1: 語のラベルのある札（`has-word`）は `container-type: inline-size` で中身の幅を持たないので、札は `--word-min-w`（14u）で止まる。
      - 原因 2: 絵の包み（`.eng-opts__pic`。第6回 W1）の中の `.fig-illust` は flex の子で `min-width: auto`、`.fig-illust__group` は nowrap なので縮まない。
      - 原因 3: 絵の大きさの式（`--pic-w`）は「88u − すき間 − 札の余白」を絵の総数（9）で割るだけで、札ごとの幅を決めない。
    - g3.en.numbers-colors/26（1280×720）: 7 こ・6 こ・11 この札。7 この札は 25.1u なのに絵の列は 27.5u（左右に 1.2u）、6 この札は 0.8u 出る。11 この札は群（5・5・1）を横に並べた幅（約 45u）を基にして縮み、2 段に折り返して 19.5u しか使わないのに 40.2u を取る。1 枚目と 2 枚目の いちごが続いて並び、数えられない。
    - p5.math.measure-compare/8（tower、1280×720）: 塔の SVG（viewBox 40×170、width・height なし）は、`.fig-svg svg:not([width])` の幅の規則と札の図の枠（`.tk-card__fig`。16u×9u・overflow: hidden）の幅で 16u×68u に描かれ、上下 28.6u ずつ切れる。1 枚目は空の札に見え、2・3 枚目は中ほどの 2 段だけが見える。
    - p5.math.numbers-10/2（match の点の列）: 4 この点の svg は 12.4u（`Blocks` がインラインで `height` を書く）で、9u の枠の上下で 0.8u ずつ切れ、「半分・2 こ・半分」に見える。
    - p23.math.shop/12（choice）: 札の中は 26.9u、くだもの 3 こ（10u×3＋すき間）は 31.2u で、左右に 1.1u 出る。
  - **作業領域・解説の板に入らない**（残りの scroll-hidden。どれも開いて確かめた）:
    - p4.env.seasons/22: 8 枚の札（5 字の語 4 枚）は `--fit` 0.8 で幅の合計が約 100u になり、1 段（88u）に入らない。2 段では 30.8u 要り、作業領域（26.3u）に入らない（てぶくろ・ゆきだるまの札が切れる）。4 さいの画面にスクロールの ▲▼ は無く、▼ だけ。解説は、空の札置き場（`eng-sort__pool`）が高さを取り、何も無いのに ▼ が出る（4.4〜4.9u）。
    - p5.math.numbers-10/4・5（ord）: 動物の列（`fig-row`）9.6u＋選択肢 15.3u で 28.5u 要る。図を縮めるのは「min(図の高さ, 12u)」までなので、9.6u の列は縮まない（UnitRunner）。
    - p5.think.pattern/2・3 の解説（1536×864）: 解説が並びを 8 つ全部言うので 4 行になり、板が 17.2u を取る。選択肢の名前と正解の ○ が半分隠れる。
    - g4.math.fraction-kinds/4 の解説: 数直線 2 本の列（`fig-column`）が板に 5.1 行分入らない。2 本目（0.1 きざみ。8/10 を示す）は全部隠れる。1 本目の 4/5 のラベルは、svg の下の余白（viewBox の y=120〜150、約 2.5u）のさらに下の段（`.fig-nl__labels`）に置かれ、線から約 8u 離れる。2 本目の印のラベルは解説でも「？」のまま。目もりの数は 0.2・0.4…の小数で書かれる（分母 3・6 の問題では 0.333333 になる）。
    - g6.sci.solutions/22: 表（4 行）17.7u の下に、長い選択肢 3 つが縦一列（`layout: 'column'`）。2 つ目からが隠れる（8.7u 足りない）。
    - g6.math.proportion/2: グラフの選択肢 4 つを 2×2（`layout: 'grid'`）に並べ、下の段の横軸が隠れる（4.8u）。
    - g5.ja.sentence-relations/37〜39: 選択肢 3 つ（各 18 字前後）を縦一列（`layout: 'column'`）。3 つ目が半分隠れる（2.5〜2.7u）。2 列なら 1 つ約 34u で入る（作業領域の幅 88u）。
    - g4.ja.read-summary/41 の解説: 並べた札の列の右に、空の枠（`eng-order__ghost`）4 つが 2 列の格子の半分を取り、札が 2 行に折れて 4 枚目が切れる。
    - g3.ja.listen-memo/19・26 の解説（1920×1080・1536×864）: 解説が 3 行で板が 12.9u を取り、3 つ目の選択肢の下が切れる（26 は 1920×1080 で 0.5u。画面サイズを回す順で出たり出なかったりするのは第6回のとおり）。
    - g6.sci.strata/17 の解説: 隠れているのは空の札置き場だけ。札「下から れき・砂・どろと ならぶ 層」は最後の行が「層」1 字（`data-spaced` でも Chrome の `text-wrap: pretty` が戻さない。第6回 7. のとおり）。
  - **正解の輪**（点検 17・18）:
    - g1.math.shapes/1・2 の解説（4 サイズ）: geometry の札（`.eng-geo__opt`。絵＋`.eng-geo__optlabel`）は、第6回 W1 の「輪郭＋右下の ○」の対象の一覧に無く、大きな輪のまま。輪が「すいか」「つみきの つつ」「かん」の字を横切り、札の外へも出る。検査（C21）は字の中心が輪の帯に入るかだけを見るので、「つつ」の 1 件しか出ない。
    - listen の絵の段の輪: 輪の箱は絵の段の上下に 0.8u 出て、外の白い縁取り（0.35u）も足すと 1.15u 出る。ラベルのふりがなは絵の段の下端から始まる（g6.en.future/7 の解説 1280×720 で、段の下端 31.17u・rt の上端 31.18u・輪の下端 31.97u）。検査は rt の字を輪の判定から外している（`if (c.rt) return false`）ので出ない。
  - **横軸の札がつながる**（点検 19・20）: g4.sci.weather/9（4 サイズ）の「9時 10時11時12時13時14時15時」は、札の間のすき間が字の 0〜0.05 倍。g5.ja.text-figure/17（1536×864）の「運動場体育館ろうか階だん 教室」は 0.01 倍。`useStaggerLabels` は「中身の幅 ≦ 枠の幅 × 1.01」なら縮めないので、すき間を見ていない。
    - あわせて、折れ線グラフの縦軸の単位「（℃）」は、横軸の札のさらに下の左はしに置かれ、横軸の単位に読める（`.fig-chart__unit`。g4.sci.weather/9）。
  - **小さすぎる絵・札**（点検 21・22）:
    - p5.en.phrases/92（1280×720）: 札 4 枚に くるま 5・ほし 9・くるま 6・いぬ 5。絵は 1 つ 2.06u（約 26px）。/49（1280×620）は 3.55u、/120（1920×1080）は 6.78u。数える札は 1 行に並べるので、絵の総数で幅を割ることになる。
    - g6.prog.efficient/11: 問題の札の列（パックの SVG。viewBox 330×34、`height: calc(var(--u) * 5)`）は、width の無い svg の既定（23u）で 23u×5u の箱になり、縦横比 9.7 の図が箱の中に高さ約 2.4u で描かれる（札 1 枚 1.49u）。作業領域の幅は 92u あり、高さ 5u のまま幅を縦横比で決めれば約 48u（札 1 枚 約 4u）になる。
  - **意味**（点検 23・24。どちらも画面で確かめた）:
    - p23.think.sort: 2〜3 歳は sort の札を `toddlerLimit`（2 歳の段階 2 枚・3 歳の段階 3 枚）に減らすが、解説はパックの決まった文で 4 枚ぶんを言う（/25 の解説で、画面に無い「ふね」、/10 で「レモン」）。
    - p5.math.shapes/8: 何も描かずに つぎへ で解説に進むと、空の格子に「こたえ ましかくが かけたね。」と出る。geometry の見本（`ans`）は exact・reflect・rotate180 の目標だけで、shape・congruent・similar・直線の目標は出ない。
  - **新しく見つけたもの（意味）**: g1.math.shapes の「ボールの かたち」の物に すいか が入っているが、絵（`watermelon`）は切った一切れ（半月の形）で、球に見えない（/1 の解説 1280×720 で確かめた）。
- 検査の側で分かったこと:
  - g5.ja.text-figure/8 のヒント①（1920×1080）の overlap-text「10｜15」は、第6回 8. で誤検出と判断し、検査の直しを次の回に回したもの（C31）。
  - 点検 1〜5・21・22 は、検査が絵の矩形と大きさを見ないので出ない（C28・C29）。点検 17・18 は C21 の判定の漏れ（C27）。点検 19・20 は重なりしか見ないため（C30）。

### 1. 原因の分類（第7回）

| 分類 | 内容 | 主なもの（点検の番号） |
|---|---|---|
| (1) 共通の画面の作り | 正解の印の対象の漏れ・絵の段の輪（X1）／絵の札の幅と数える絵（X2）／札の図の枠・解説の空の枠と置き場（X3）／横軸の札のすき間・数直線の印のラベル・手順の札の列・縦軸の単位（X4）／12u 以下の図が縮まない（X5）／描く問題の見本（X6）／ruby と分数の前の括弧（X7） | 1〜4・6（解説）・7・9（ラベル）・13・15（置き場）・17〜22・24 と、残りの covered 1・scroll-hidden 6 |
| (2) パックの文・選択肢・配置 | 札・選択肢の数と長さ・並べ方（p4・g5-ja・g6-math・sci-g56）／解説の長さ（p5・g3-ja）／解説の図（g4-math）／解説が画面と食い違う（p23・p5）／絵の意味（g1-math）／単元の題（アプリの画面） | 6（問題）・8〜12・14・15（札）・23・24（文）と、残りの scroll-hidden 9・orphan 1 |
| (3) 検査の誤検出 | SVG の text の外接の箱と、枠で切れた箱の閾値（C31） | overlap-text 1（点検 16） |
| (3') 検査の見落とし | 輪の判定を字の中心と rt 抜きで見ていた（C27）／絵の矩形を見ない（C28）／絵と札の大きさを見ない（C29）／札のすき間を見ない（C30） | 1〜5・17〜22 |
| (4) 設計上受け入れる | 第6回までのもの（下の 4.）と、問題の状態の作業領域の下の空き | 点検 12 の一部 |

### 2. 共通の直し（systemic。項目ごとにファイルを分ける）

DESINGN.md は X1 が持つ。X2〜X7 の規約（各項目の「DESINGN.md に書くこと」）も、X1 がまとめて 17 章に書く（ファイルを重ねないため）。

#### X1 正解の印の残り（ui.css・DESINGN.md）

ファイル: `src/ui/ui.css`、`DESINGN.md`

1. **絵と字の両方がある札は、すべて「輪郭＋右下の ○」にする**（点検 17）:
   - 今の規則は、ラベルの子が `.eng-choice__label`・`.exp-opt__label` の札だけ。geometry の札（`.eng-geo__opt` の `.eng-geo__optlabel`）が漏れていた。
   - エンジンを grep し、`Choice` の札で絵・図と字の子の両方を持つものを全部一覧に入れる（少なくとも `.eng-geo__optlabel`）。listen の絵の段の輪（`.eng-opts__pic`）は 2. のとおり別。
2. **listen の絵の段の輪を、絵の段の上下に出さない**（点検 18）:
   - 輪の箱を絵の段の中に収め、直径を「絵の段の高さ − 0.7u」にする（外の白い縁取り 0.35u も段の中）。左右は今のまま段の中央。
   - ラベルのふりがなは段の下端から始まるので、輪と縁取りがふりがなに触れなくなる。
3. **DESINGN.md**: 17 章の正解の印（第6回 W1 の項）に 1.・2. を書き、X2〜X7 の規約（各項目の「DESINGN.md に書くこと」）を「第7回の規約」としてまとめる。
- 確かめ方: `#/dev/unit/g1.math.shapes/1?seeds=2&state=explain`・`/2`（4 サイズ）、`g6.en.future/7`（4 サイズ）・`/5`・`/9`、`g6.en.places/14`・`/19`、`p4.en.words/89`、`p5.en.phrases/29`（1280×620）。C27 で covered が 0 になること。幼児の英語の札が 14u×18u 以上のままであること。

#### X2 絵の札の幅と数える絵（choice・listen）

ファイル: `src/engines/choice/choice.tsx`、`src/engines/choice/choice.css`、`src/engines/choice/` のテスト（新しい `pics.test.ts` など）、`src/engines/listen/options.tsx`、`src/engines/listen/options.css`、`src/engines/listen/listen.tsx`、`src/engines/listen/listen.css`

1. **絵の大きさ s と札の幅を、札ごとの絵の数から JS で決める**（`usePicsGeometry`）:
   - 札 i について、1 行に並ぶ絵の数 r_i と行の数 k_i、札の余白・枠・ラベルの高さを測る。
   - 次の 2 つを満たす最大の s を求める（上限 15u。2 分探索でよい）:
     - 幅: Σ max(札の最小の幅, r_i × s ＋ (r_i − 1) × 絵のすき間 ＋ 札の余白) ＋ (札の数 − 1) × 札のすき間 ≦ 列の幅
     - 高さ: max(k_i × s ＋ (k_i − 1) × 絵のすき間) ＋ ラベル ＋ 札の余白 ≦ 高さの上限（今の `--pics-above`・`--pics-below`・`--work-h` から）
   - s を `--pic-max` に、札の幅を札ごとに `--card-w` に書く。語のラベルの札（`has-word`。inline-size の container）は `min-width: max(var(--word-min-w), var(--card-w))` にする。
   - CSS の式（`--pic-w`）は、JS が測る前の初めの値にだけ使う。
2. **数える札は 5 こずつの行にする**: 選択肢のどれかに絵が 6 こ以上ある問題では、札の中の絵を 5 こずつの行に並べる（6〜10 こは「5＋残り」の 2 行。11 こ以上は今の 5 のまとまりのまま）。図の部品（`Figure.tsx`）は変えず、札の中の CSS（`flex-wrap` と 5 こぶんの `max-width`）で折る。
3. **並べ方を比べて選ぶ**（4 つ以下の選択肢）: 「1 段・きいてね が上」「1 段・きいてね が左」「2×2・きいてね が上」「2×2・きいてね が左」で 1. の s を求め、s が最大のものにする（聞く問題の `earOnTop`・`picsSide` もこの結果で決める。choice は「きいてね」が無いので 1 段と 2×2 の 2 つ）。
   - 見積り（1280×720）: p5.en.phrases/92 は、1 段・上で 3.3u、2×2・左で 4.5u。g3.en.numbers-colors/26 は 1 段・上で 4.4u。
4. **下限**: 絵が 1 つの札は今の `--pic-floor`（幼児 10u・ほかの段階 6u）。数える札（1 つの札に絵が 2 つ以上）の絵は 4u。下限に届かないときも、s が最大の並べ方のままにする（C29 で検査に出る）。
5. **安全網: 札の中の絵は札の内側に入れる**: `.choice` の中の `.fig-illust`・`.fig-illust__group` は `min-width: 0; max-width: 100%`、絵は `flex: 0 1 auto`（縦横比 1）。1.〜4. で幅を決めたあとに残るはみ出し（p23.math.shop/12 の くだもの 3 こ。札の中 26.9u に 31.2u）を、札の中で縮める。
- DESINGN.md に書くこと（X1 が書く）: 17 章の「語のラベルと絵の札の高さ」（第4回 V2）に、1.〜5.（札の幅は絵の数から・数える札は 5 こずつの行・並べ方の選び方・数える絵の下限 4u・絵は札の外に出さない）。
- 確かめ方: 次の画面で、絵が札の外に出ないこと（C28 で 0）、絵の大きさが下限以上であること（C29 で 0）。
  - `p5.en.picture-book/42`・`/46`・`/50`・`/55`（問題と解説、4 サイズ。/50 の 1280×620 で 5 ひき目のいぬが隣の札に入らない）
  - `g3.en.numbers-colors/26`（4 サイズ）
  - `p5.en.phrases/49`・`/92`・`/120`（数の問題 67 問の代表、1280×620・1280×720）
  - `p23.math.shop/12`〜`/14`（1280×720）。絵の選択肢の多い `p4.en.where`・`p4.en.hello`・`g4.en.time-days/14` が崩れないこと。

#### X3 札の図・解説の空の枠と置き場（order・sort。`.tk-card`）

ファイル: `src/engines/order/**`（`shared.css`・`order.tsx`・`order.css`）、`src/engines/sort/**`

1. **札の図の枠に、図を縮めて入れる**（点検 3・4）:
   - `.tk-card__fig`（16u×9u・overflow: hidden）の中の svg・img に `max-width: 100%; max-height: 100%` を当てる（`Blocks` などがインラインで書く `height` にも効くように）。
   - 縦長の SVG は高さで決まり、viewBox の縦横比は既定の `preserveAspectRatio`（meet）で保つ。塔 3 本は同じ viewBox（40×170）なので、高さの違いはそのまま残る。
   - match の札も `.tk-card`（`shared.css`）なので、p5.math.numbers-10/2・3 の点の列も同じ直しで入る。
2. **order の解説で、空の枠の列を出さない**（点検 13）: 解説（`revealed`）で、おくもの の列が空の枠（`eng-order__ghost`）だけのときは列を出さず、並べた所の列を作業領域の幅いっぱいにする（縦の 2 列の格子をやめる）。
3. **sort の解説で、空の札置き場を出さない**（点検 6 の解説・15）: 解説で `eng-sort__pool` が空なら描かない（高さを取らない）。
- DESINGN.md に書くこと: 7〜8 章の札（図は札の図の枠に縮めて入れる）、order・sort の解説（空の枠・置き場を出さない）。
- 確かめ方:
  - `p5.math.measure-compare/8`〜`/10`（問題と解説、4 サイズ）で、塔が 3 本とも上から下まで見え、高さを比べられること。
  - `p5.math.numbers-10/2`・`/3` で、点を 4 こ・3 こ・6 こと数えられること。
  - `g4.ja.read-summary/41`（1536×864・1280×720）・`g6.sci.strata/17`・`p4.env.seasons/22` の解説で、作業領域の scroll-hidden が 0 になること。

#### X4 図: 横軸の札・数直線の印・手順の札の列・縦軸の単位（figure・graph）

ファイル: `src/engines/figure/**`（`Figure.tsx`・`figure.css`・`svgText.ts`・`gridFloor.ts` とテスト）、`src/engines/graph/**`

1. **横軸の札のすき間**（点検 19・20）:
   - `useStaggerLabels` の入る条件を「札の中身の幅 ＋ 字の 0.4 倍 ≦ 枠の幅」にする（今は中身の幅 ≦ 枠の幅 × 1.01）。入らなければ今の順（字を `--text-min` まで縮める → 1 つおきに下の段）。
   - graph の横軸（`useXLabelFit`）も同じ条件にする。
2. **数直線の印のラベル**（点検 9 の後半）:
   - 印（▼）のラベルを ▼ の真上に置く（今は svg の下の余白のさらに下の段）。分数のラベル（2.2em）も同じ。
   - svg の viewBox の下の空き（目もりの数の下、y=120〜150）を詰め、図の高さを減らす。
3. **手順の札の列**（点検 22）:
   - `gridFloor.ts` で、同じ大きさの正方形（rect）が 3 つ以上、すき間が辺の半分以下で横に並ぶパックの SVG を「札の列」とみなす。
   - 札の列の svg には viewBox の縦横比（`aspect-ratio`）を書き、幅を「高さ × 縦横比」にする（作業領域の幅まで）。今は width の無い svg の既定 23u の箱に描かれ、g6.prog.efficient/11 の問題の札が 1 枚 1.49u になる。
   - 選択肢の中の札の列は、札 1 枚が 2.4u（盤の 1 ますと同じ下限。第6回 W8）を下回るなら、1 列の札（`fig-svg--wide`。W8）にする（g6.prog.efficient/9・g5.prog.debug-plan/8 の 1.67u）。
4. **縦軸の単位**: 折れ線・棒グラフの単位の札（`.fig-chart__unit`）を、横軸の札の下でなく縦軸の上（図の左上）に置く。横軸の下の左はしの「（℃）」は、横軸の単位に読める（g4.sci.weather/9）。
- DESINGN.md に書くこと: 17 章の図（横軸の札のすき間は字の 0.4 倍以上・印のラベルは ▼ の上・手順の札は 1 枚 2.4u 以上・縦軸の単位は縦軸の上）。
- 確かめ方:
  - `g4.sci.weather/9`・`/13`（問題と解説、4 サイズ）、`g5.ja.text-figure/16`・`/17`・`/19`（4 サイズ）で、札のすき間が字の 0.4 倍以上（C30 で 0）。
  - `g4.math.fraction-kinds/4` の解説で、印のラベルが ▼ のすぐ上にあり、図の高さが減ること。
  - `g6.prog.efficient/11`・`/9`、`g5.prog.debug-plan/8`（問題と解説、1280×720・1536×864）で、札 1 枚が 2.4u 以上（C29 で 0）。盤（第6回 W8 の 9 単元）が崩れないこと。

#### X5 単元の枠: 12u 以下の図を縮める（UnitRunner・unit.css）

ファイル: `src/units/UnitRunner.tsx`、`src/units/unit.css`

- 今の図の縮め方は「`--fig-max` = max(min(図の高さ, 12u), 図の高さ − 不足)」で、12u 以下の図は縮めない。p5.math.numbers-10/4・5 の動物の列（9.6u）は縮まず、`--fit` が下限（0.8）でも 2.3u 足りずにスクロールになり、選択肢の名前（きつね・かえる・うさぎ）が切れる（点検 7）。
- `--fit` が下限でも入らないときだけ、図の下限を 6u（絵の並びは `--fig-k`。下限 0.35 のまま）に下げて、もう一度図を縮めてから測り直す。作業領域をスクロールの枠にするのは、そのあとでも入らないときだけ。
- 文字の図（`.fig-text`・`.fig-table`）と数の入力（`NO_FIG_FIT`）は、今までどおり縮めない。
- DESINGN.md に書くこと: 17 章の「図を先に縮める」に、下限の fit でも入らないときの 6u。
- 確かめ方: `p5.math.numbers-10/4`・`/5`（問題・ヒント①②、4 サイズ）で work の scroll-hidden が 0、動物の列が 6u 以上、選択肢の名前が見えること。ほかの単元の図の大きさが変わらないこと（今入っている画面では、この直しは働かない）。

#### X6 描く問題の見本（geometry）

ファイル: `src/engines/geometry/**`

- 解説（`revealed`）で、子供の図が目標を満たしていないとき（何も描いていないときを含む）、見本の形を格子に描く（今の `ans` と同じ点線）。
- 今は exact・reflect・rotate180 の目標だけで、congruent・similar・shape・perpendicular・parallel は見本が出ない（`targetPolygon` が null）。
  - congruent: `given` の形を、格子の空いている所（`given` と重ならない所）へずらしたもの。
  - similar: `given` の形を ratio 倍したもの。
  - shape: 種類と辺（`sides`）から作った形（ましかく 2×2・ながしかく 3×2・さんかく など）を格子の中ほどに置く。
  - perpendicular・parallel: `through`（無ければ格子の中ほど）を通る直線。
- DESINGN.md に書くこと: 18 章の解説（描く問題は、正しく描けていなければ見本の形を出す）。
- 確かめ方: `p5.math.shapes/8` の解説（何も描かずに つぎへ）で、見本のましかくが出ること。`g1.math.shapes`（congruent）・`g2.math.triangles-quads`・`g3.math.triangles`（shape）・`g5.math.congruence`・`g6.math.scale`（similar）の描く問題の解説。

#### X7 Rt の折れ（アプリの画面の検査の残り）

ファイル: `src/text/Rt.tsx`、`src/text/rt.css`、`src/text/rt-wrap.test.ts`

- ruby は、隣の字を包み（`.rt-nobr`）に取り込めなかったときも、親字の途中で折らない（`.rt ruby { white-space: nowrap }`）。対象: 単元の地図の「わたしたちの生活と食／料生産」「工業／生産」（g5.soc.food・g5.soc.industry の題。word-split）。
- 分数（`.rt-frac`）の直前の始め括弧を、ruby・空欄と同じく分数の包みに入れる。対象: 「ぶんすう（／1/2・1/4・1/3）」（g2.math.fraction-simple の題。kinsoku-end）。
- DESINGN.md に書くこと: 17 章の改行の規則（S2）の nowrap のまとまりに、ruby の中と分数の前の始め括弧。
- 確かめ方: `npm run check:app-layout` で word-split と「（」の kinsoku-end が 0。text-layout で、単元の画面の同じ形（分数の前の括弧）が増えないこと。

### 3. 検査の直し（checkerChanges）

ファイル: `e2e/helpers/text-layout.ts`、`e2e/helpers/text-layout-report.ts`（新しい種類の名前と順）、`e2e/text-layout-probe.tl.ts`（見本）、`docs/test-plan.md`（3.2 に理由を書く）

- **C27 正解の輪と字（見落とし）**:
  - 字の中心でなく、字の矩形（上下左右を 15% ずつ内側に縮めたもの）が輪の線の帯（外の円 − 内の円）と交わるかで見る。外の円の外、内の円の内に入りきった字は数えない。
  - ふりがな（rt）の字も数える（今は除いている）。
  - 理由: g1.math.shapes/1・2 の「すいか」「かん」は、輪が字を横切るのに字の中心が帯の外で、検査を通り抜けた（点検 17）。listen の絵の段の輪がふりがなにかかるもの（点検 18）は、rt を除いていたので出なかった。
- **C28 絵が札の外に出る・札で切れる（見落とし。新しい種類 `figure-outside-box`「絵が札の外に出る・札で切れる」）**:
  - 札（`BTN_SEL`・`.tk-card`・`.choice`）の中の絵（いちばん外の svg・img・`.fig-illust__group` の子）の矩形が、(a) 札の矩形（枠線の内側）から 0.3u を超えて出る、または (b) 札の中の祖先で overflow が visible でない枠から 0.3u を超えて出る（その枠で切れる）とき、札ごとに 1 件出す。
  - detail は「絵が札の外に 11.1u 出る」「絵が札の枠で 28.6u 切れる」の形。`.mark`・`.tk-badge` は絵に数えない。
  - 理由: 点検 1〜5 は、字の検査（clipped・text-outside-box）が字しか見ないので 1 件も出ていなかった。
- **C29 絵・札が小さすぎる（見落とし。新しい種類 `small-figure`「絵・札が小さすぎる」）**:
  - (a) 1 つの札に絵が 2 つ以上ある札（数える札）の絵（`.fig-illust__group` の子）の短い辺が 4u 未満（段階を問わない。g3.en.numbers-colors も数える札）。
  - (b) パックの SVG（`.fig-svg` の svg）の中の、同じ大きさの正方形（rect）が 3 つ以上・すき間が辺の半分以下で並ぶもの（手順の札・盤のます）の 1 つが、画面で 2.4u 未満。間をあけて置いた図形（p5.think.pattern の「ちいさい しかく」）は数えない。
  - 理由: 点検 21・22。下限は DESINGN.md（X2 の 4u、第6回 W8 と X4 の 2.4u）に合わせる。
- **C30 並んだ札がつながって見える（見落とし。新しい種類 `label-gap`「札がつながって見える」）**:
  - 横軸の札の列（`.fig-chart__labels` と graph の `.gr-xlabels` の子）と数直線の印のラベル（`.fig-nl__labels` の子）で、同じ行の隣どうしの字の矩形のすき間が、字の大きさの 0.25 倍未満のもの。
  - 理由: 点検 19・20。overlap-text は重なり（すき間が負）しか見ない。対象を札の列に絞るのは、文の中の span どうし（Rt の ruby・nobr の包み）は、すき間 0 で並ぶのが正しいため。
- **C31 SVG の text の重なり（誤検出）**:
  - overlap-text で SVG の text どうしを比べるときは、外接の箱（ascent＋descent。約 1.47em）でなく、上下を字の大きさ（font-size）の高さに詰めた箱で比べる。
  - 閾値（低いほうの 0.3 倍）は、スクロールの枠で切る前の箱で決める。HTML の字は今までどおり。
  - 理由: g5.ja.text-figure/8 のヒント①（1920×1080）の「10｜15」。Chart の縦軸の数は字の 1.1 倍以上の間をあけて間引いていて、字の本体は重ならない（第6回 8. で目で確かめた）。外接の箱どうしがかかったうえ、本文の枠で切れた「15」の箱が低くなって閾値が 4px まで下がった。
- probe に、C27〜C31 の見本（直す前のコードでは失敗するもの・数えないもの）を足す。`docs/test-plan.md` 3.2 に C27〜C31 の理由を書く。新しい種類は app-layout の要約（`KIND_LABEL`）にも入るので、アプリの画面の検査（`check:app-layout:probe`）も通ることを確かめる。

### 4. 受け入れるもの（accepted）

- 第6回までのもの（そのまま）:
  - 小3以上の地の文（読解の本文・解説の文）で、字の間に改行が入るもの（JIS X 4051 で許される）。選択肢・札・ボタンの中は、今までどおり違反として見る。
  - 読解の本文の枠のスクロールと、表の解説の板のスクロール（どちらも印あり）。ただし、答えの行や正解の図が隠れる板は受け入れない（点検 9 の g4.math.fraction-kinds/4 はこれに当たるので、X4 と 5. の g4-math で直す）。
  - text-on-figure（参考）で、ふりがなが線に少しかかるだけのもの。
  - 検査から外れた 11 単元（legacy。`layout.spec` が受け持つ）。
- **幼児の英語の受け入れを改める**: 第6回の「絵 10u 以上」は、絵が 1 つの札のこと（DESINGN.md 17 章の `--pic-floor`）。1 つの札に絵が 2 つ以上ある札（数える札）は、この回で下限 4u・5 こずつの行を決める（X2）。点検 21 は受け入れない。
- **問題の状態の作業領域の下の空き**（点検 12 の「約 6u の空き」）: 作業領域を下へ伸ばさない。ヒントを出すと吹き出しがそこに入るので、伸ばすと状態によって作業領域の大きさが変わり、札が動く。5.1 の配置（作業領域の高さは状態で変えない）を保ち、g5.ja.sentence-relations は並べ方（5. の g5-ja）で直す。
- 第6回 8. で受け入れた g5.ja.text-figure/8 の「10｜15」は、この回は受け入れでなく検査の直し（C31）にする。

受け入れないもの（この回で直す）: 絵が札の外に出る・札で切れるもの、数える絵が 4u に足りないもの、作業領域・解説の板で選択肢・札・図が隠れるもの（幼児の画面では ▼ だけでもスクロールさせない）、正解の輪が字・ふりがなを横切るもの、横軸の札がつながって読めるもの、解説が画面と食い違うもの。

### 5. このラウンドで直すもの（content。パックごと）

systemic のファイル（エンジン・`src/units`・`src/ui`・`src/text`）は触らない。教材の文を変えたら `npm run voice:packs` を流す（改行だけ変わった JSON は戻す）。学年の漢字・《よみ》・分かち書き・ヒントと解説の対応は保つ。題を変えたら `npm run build:unit-index` と `npm run chars` も流す（used-chars が変われば、フォントを作り直す）。

- **p4**（`src/packs/p4/**`）: p4.env.seasons/22（sort:l3）の札を 8 枚から 6 枚にする（どの季節にも 1 枚以上。5 字の語を減らす）。作業領域の 1 段（88u）に入ることを 4 サイズで確かめる。解説も 6 枚に合わせる。
- **p5**（`src/packs/p5/**`）:
  - p5.think.pattern の解説を、並びを全部言わずに「くりかえしの まとまり」と答えで言う形にする。例: 「おおきい まる、おおきい さんかく、ちいさい しかくの くりかえし。？は おおきい さんかく。」。形と大きさが別々に回る問題は「かたちは ほし・さんかく・しかくの じゅん、おおきさは おおきい・ちいさいの じゅん。？は ちいさい さんかく。」。1536×864 で板が 3 行までになること（/2・/3）。
  - p5.math.shapes の copy・draw の解説を、描けたことを前提にしない文にする（今は「…が かけたね。」）。例: 「ましかくは かどが 4つ、へんの ながさが みんな おなじ。」。見本の形は X6 が出す。
- **p23**（`src/packs/p23/**`）: p23.think.sort の解説（色・種類の両方）を、2〜3 歳で減らした札（`sortVisible`。2 歳の段階 2 枚・3 歳の段階 3 枚）と食い違わない文にする。名前を言うのは、どの段階でも画面に出る札（各箱の 1 枚目）だけにするか、名前を言わずに分け方を言う（例: 「どうぶつは どうぶつの はこ、のりものは のりものの はこ。」）。4 さい以上が見る 4 枚の画面でも、うそにならないこと。
- **g1-math**（`src/packs/g1-math/**`）:
  - g1.math.shapes の「ボールの かたち」の物から すいか を外す（絵が切った一切れで、球に見えない）。ボール・みかん・トマトが残る。すいか を正解にしていた問題（/1）が、ほかの物で同じ問いになること。
  - 単元の題（アプリの画面の検査の残り）: g1.math.numbers-120「100までの かず・120くらいまでの かず」（button-split）、g1.math.add-sub-2digit「2けたの たしざん・ひきざん（かんたんな けいさん）」（ホームのおすすめで fit-overflow・text-outside-box）。
- **単元の題**（アプリの画面の検査の残り。g1-ja・g2-ja・g3-ja・g4-ja・g5-ja・g6-ja・g4-math・g5-math・sci-g34・soc-g34・soc-g56。`docs/screenshots/app-layout-report/summary.md` の該当の行）:
  - 空白で区切って書く題は、空白で区切った 1 まとまりが札の 1 行（小1・小2 で約 6 字、小3〜小6 で 6〜7 字）に入るよう、空白を足すか短くする。空白で区切らない題（国語・社会の小3以上）は、短くするか、文節の切れ目に空白を入れる（`spacedLabel` の条件: 空白の数 × 12 ≧ 字数）。意味・学年の漢字・《よみ》を保つ。
  - 題: g1-ja（folktales「むかしばなしを きこう」・write-order「じゅんじょよく かこう」）、g2-ja（culture「むかしばなしと ことばあそび」）、g3-ja（haiku・romaji・kanji-parts・read-paragraphs）、g4-ja（info-compare「くらべる・分ける・引用」）、g5-ja（figurative・sentence-relations・spoken-written・word-structure）、g6-ja（kanji-usage・language-change）、g4-math（change-relations・fraction-kinds・quadrilaterals）、g5-math（decimal-shift・per-unit）、sci-g34（g4.sci.temperature）、soc-g34（g3.soc.safety）、soc-g56（g6.soc.history-2・history-3）。g5.soc.food・industry と g2.math.fraction-simple は X7 で直るので変えない。
  - 確かめ方: `npm run check:app-layout`（自分のポートの一時の設定）で、その題の違反が 0。
- **g3-ja**（`src/packs/g3-ja/**`）: g3.ja.listen-memo の amibou の解説（shitsumon/19・chuushin/26）を、1920×1080・1536×864 で 2 行に入る長さにする。答えのわけ（話に出てこなかったこと・はじめとおわりの言葉）は残す。
- **g4-math**（`src/packs/g4-math/**`）: fraction-kinds の等しい分数（equiv）:
  - 数の入力の問題の解説の図を、数直線 1 本にする: `step: 1/d`（もとの分母の目もり）・`minorStep: 1/D`（細かい目もり）・`labelEvery: 1`（数は 0 と 1 だけ）・印 1 つ（`at: n/d`、ラベル `[[n/d]] ＝ [[N/D]]`）。解説の図に「？」を出さない。ヒント①（「数直線を ならべると…」）と図の対応を確かめ、合わなければ①を直す。
  - 選ぶ問題（alt）の問題の図（2 本のまま）にも `labelEvery: 1` を付ける（目もりの数が 0.2・0.333333 の小数で出ないように）。
  - 解説の板に図が入ること（4 サイズ。▼ なし）。
- **g5-ja**（`src/packs/g5-ja/**`）: g5.ja.sentence-relations の setsuzoku-alt（/37〜39）の `layout: 'column'` を `'grid'`（2 列）にする。4 サイズ・問題とヒントで作業領域に入ること。同じ単元の `layout: 'column'` のほかの問題も、2 列で入るなら合わせる。
- **g6-math**（`src/packs/g6-math/**`）: g6.math.proportion の graph-alt（/2）を 1 段の 4 つ（`layout: 'row'`）にするか、グラフを低くして、下の段の横軸が見えるようにする。横軸の数（0〜5）が読める大きさであること（C29・C30 で出ないこと）。
- **sci-g56**（`src/packs/sci-g56/**`）:
  - g6.sci.solutions/22（mt-solid-diff）: 選択肢を表の下の 1 段（`layout: 'row'`）に入る長さにする（例: 「アルミニウムとは ちがう 物に なった」→「ちがう 物に なった」、「アルミニウムは 消えて、塩酸だけが のこった」→「塩酸だけが のこった」）。誤概念（sol-metal-same・sol-metal-vanish）と食い違わないこと。4 サイズで作業領域に入ること（今は 8.7u 足りない）。
  - g6.sci.strata/17（fm-alt-sort）: 札「下から れき・砂・どろと ならぶ 層」を、箱の幅で 1 行に入る長さにする（例: 「れき・砂・どろが 重なる 層」）。解説の「大きい つぶから 重なる 層」と対応させる。

パックを変えないもの（共通の直しで直る）: en-pre（p5.en.picture-book・p5.en.phrases・p4.en.words → X1・X2）、en-g34（g3.en.numbers-colors → X2）、en-g56（g6.en.future・g6.en.places → X1）、p5 の measure-compare・numbers-10（X3・X5）、sci-g34 の g4.sci.weather（X4）、g5-ja の text-figure（X4・C31）、prog-g16（X4）、g4-ja の read-summary（X3）、g2-math（X6・X7）、g3-math・g5-math・g6-math の描く問題（X6）。

### 6. 点検の指摘の扱い（1〜24）

| 点検 | 内容 | 扱い |
|---|---|---|
| 1 | p5.en.picture-book の絵が札の外へ最大 11u | X2・C28 |
| 2 | g3.en.numbers-colors/26 の いちごが札の外へ | X2・C28 |
| 3 | p5.math.measure-compare の塔が札で切れる | X3・C28 |
| 4 | p5.math.numbers-10/2・3 の点の列が切れる | X3・C28 |
| 5 | p23.math.shop の くだものが枠にかかる | X2（安全網）・C28 |
| 6 | p4.env.seasons/22 の札が切れる・空の置き場 | 問題は p4（6 枚）、解説は X3 |
| 7 | p5.math.numbers-10/4・5 の名前が切れる | X5 |
| 8 | p5.think.pattern/2・3 の解説の板が 4 行 | p5（解説を短く） |
| 9 | g4.math.fraction-kinds/4 の 2 本目が隠れる・ラベルが離れる | g4-math（1 本の数直線）・X4（印のラベル） |
| 10 | g6.sci.solutions/22 の選択肢が隠れる | sci-g56（短く・1 段） |
| 11 | g6.math.proportion/2 の横軸が隠れる | g6-math（並べ方） |
| 12 | g5.ja.sentence-relations/37〜39 | g5-ja（2 列）。下の空きは 4. で受け入れる |
| 13 | g4.ja.read-summary/41 の空の枠 | X3 |
| 14 | g3.ja.listen-memo/19・26 | g3-ja（解説を 2 行に） |
| 15 | g6.sci.strata/17 の空の置き場と「層」1 字 | X3・sci-g56（札を短く） |
| 16 | g5.ja.text-figure/8 の「10｜15」 | C31（誤検出） |
| 17 | g1.math.shapes の大きな輪 | X1・C27 |
| 18 | listen の絵の段の輪とふりがな | X1・C27 |
| 19 | g4.sci.weather の横軸の札 | X4・C30（縦軸の単位も X4） |
| 20 | g5.ja.text-figure/16・17・19 の横軸の札 | X4・C30 |
| 21 | p5.en.phrases の数の絵 1.24〜2.1u | X2・C29（下限 4u） |
| 22 | g6.prog.efficient・g5.prog.debug-plan の札 | X4・C29 |
| 23 | p23.think.sort の解説が画面と食い違う | p23 |
| 24 | p5.math.shapes の描く問題の解説 | X6・p5 |

### 7. 確かめ方（全体）

- systemic・検査・content のあとで、`MNW_FRESH=1 npm run check:text-layout` を全単元で流す（`MNW_WORKERS` は 2〜4。第6回のあとは 4 で 1.6 時間・失敗 0）。失敗した単元 0・errors 0 を確かめてから件数を見る。
- 新しい種類（figure-outside-box・small-figure・label-gap）は、この回で初めて全単元を見るので、上の点検の単元のほかにも出てよい。出たものは次の回で同じように原因を分ける。
- `npm run check:app-layout` も流し、単元の題（5.）と Rt（X7）の違反が 0、新しい種類で増えたものが無いことを確かめる。

### 8. 第7回の共通の直しの実施とレビュー（2026-11-07）

X1〜X7・C27〜C31 を、担当ごとにファイルを分けて実装した。レビューでは、git の差分と追加したファイルを全部読んだ。自分の開発サーバー（127.0.0.1:4787。`node_modules/.vite` の最適化が止まったので、cacheDir を分けた一時の設定で起動した。4299 は使っていない。終わってから止めた）で代表の画面を Playwright で撮って目で見て、DOM の寸法を測り、検査を単元に絞って流した（下の「確かめたこと」）。

担当の判断で設計から変えたところ:

- X1: listen の絵の段の輪は、左右を段より 0.8u まで広げてよい（細長い絵でも輪が絵を囲む。横長の段では段の中央のまま）。DESINGN.md 17 章に「第7回の規約」の節を作り、X2〜X7 の規約をまとめた。
- X2:
  - 寸法を測って決めるのは、選択肢が全部「絵だけの図」の列（`data-fit`）だけ。時計・パックの SVG が混じる列は CSS の式のまま。
  - 11 こ以上は 5・5・1 の行。絵が 2 種類の札（りんご 3 こ＋バナナ 6 こ）は、種類ごとのまとまりを縦に積む（まとまりの間は 1.2u）。
  - 寸法は `--fit` を 1 に戻した単位で決める（縮んだ値では、画面サイズを往復したときに作業領域がスクロールの枠のまま戻らなかった）。
  - 並べ方を替えるのは、`s` が 1.1 倍以上になるときだけ（行き来しない）。`--pic-floor` は JS が 0 にする。
  - listen の「きく」の札の場所は、測った結果で選ぶ（解説では替えない）。
  - 解説で札を左に置くときの右の列の幅の見積り（`sideWidth`）を、絵の札と is-caption の字に合わせた（右の選択肢が作業領域から 1.15u 出ていた）。
  - 安全網はパックの SVG（`.fig-svg`）にも当てた（p4.ja.word-play の点の図で figure-outside-box が 936 件）。
- X3:
  - 札の図の枠は height が auto なので、設計の `max-height: 100%` が効かない。枠の寸法を変数（`--tk-fig-w`・`--tk-fig-h`）で子に渡した。
  - 枠に縮めると、match の数える札（p5.math.numbers-10/3 の ひよこ 6〜7 こ）が 1.8〜2.2u になった。そこで「絵 4.1u・5 こずつの行・枠の幅 23u まで」を足した。
  - 空の札置き場を出さなくなると、sort の解説の `--fit` が 1 に戻った。すると箱が 34u 止まりになり、20 字前後の札が語の途中で折れた（g4.ja.plain-polite-style/13・g5.ja.figurative/13）。解説の箱を 44u まで広げた。
- X4:
  - すき間（字の 0.4 倍）から、枠のあるボタンの枠線・余白と札の列のすき間を引く（引かないと g2.math.tables-graphs/1 が不要に 2 段になり、スクロールした）。
  - 札の列は正方形に限らず、同じ大きさ・辺の比 1:2 以内の rect とした（手順の札は角丸の 24×28）。
  - 1 列の選択肢の余白は 0.2u、すき間は 0.4u（余白 0.8u では `--fit` が 0.83 まで縮み、札 1 枚が 2.2u になった）。
- X5: p5.math.numbers-10/4・5 の動物の列には「まえ」の `.fig-text` があり、1 回目の判定（文字の図は縮めない）に当たっていた。2 回目の縮めの対象は「表が無く、絵がある図」にした。
- X6:
  - 判定と見本の探索が同じ基準を使うよう、`shapes.ts` に `matchShape` を足した。
  - 正しく描けていれば、見本を出さない（以前は exact・reflect・rotate180 の点線を、正しく描けていても出していた）。
- X7: 分数の直前の括弧を包みに入れると、「□／・□」の kinsoku-start が新しく出た。そこで、分数の後ろの終わり括弧・句読点・「・」も包みに付けた。
- C29 (b): 正方形のほか、角丸（rx > 0）で縦横比 1.5 倍以内の札も数える。角のない長方形の分割と、縦横比 1.5 倍を超えるものは除く（docs/test-plan.md 3.2）。

レビューで直したもの:

1. **札の列（手順の札）が、絵の札の大きさ `--pic-max` の幅に縮んでいた**（X2 の安全網と X4 の札の列の組み合わせ）:
   - X2 は、絵の札の列（`.is-pics`）の中のパックの SVG に `max-width: min(100%, --pic-max)` を足した。`--pic-max` は 1 段に並べる絵の大きさ（高さの予算）の式で、横長の札の列にも幅の上限として当たっていた。
   - 1 列（`fig-svg--wide`）の列: svg の箱が 11.2u×4.6u に止まり、縦横比 5.8 の図が meet で縮んで、札 1 枚が約 1.1u（g6.prog.efficient/11 の問題と解説・g5.prog.debug-plan/8）。
   - 1 段の列: svg が 6.2u 幅になり、札 1 枚が 1.5u・番号の字が 0.76u（g2.prog.repeat/2・/4 の解説。small-text 16・small-figure 20）。
   - X4 が測ったのは、X2 の安全網が入る前だった。
   - パックの SVG の幅の上限は札の中（100%）にし、`--pic-max` は高さの上限にした。正方形に近い図（p4.ja.word-play の点の図）は、幅も高さも今までどおり min(札の中, `--pic-max`) に収まる。1 列の列は `--pic-max` で止めない（高さは figure.css の 4.6u）。
   - 直したあとの svg は、efficient/11 で 26.7u×4.6u、debug-plan/8 で 13.7u×4.6u、repeat/2 の解説で 10.5〜11.0u 幅（札 1 枚 約 2.6u）。
2. **数える札の正解の大きな輪が、数える絵を横切っていた**（X2 の残し事項。X1 の範囲で扱われていなかった）:
   - g3.en.numbers-colors/26 の いちご、p5.en.phrases/92 の くるま（解説）。輪は札の短い辺で決まる真円なので、横長の札の真ん中で絵を 3 つ横切る。
   - 絵が 2 つ以上並ぶ札（`.fig-illust__group` の絵が 2 つ以上か、絵の図が 2 つ以上）は、絵だけの札でも listen の絵と語の札でも、輪郭＋右下の ○ にした（ui.css）。
   - はじめは border を 0.6u に太くした。すると札の中が 0.5u 狭くなり、解説の数える絵が 4u を割った（g4.en.want/37 で 3.9u。g3.en.numbers-colors/25・27〜29 で 3.9u）。輪郭の足し分 0.25u は、内側の影で描くことにした（直したあとの g4.en.want/37 は 4 サイズで 4.01〜4.08u）。DESINGN.md 17 章に書いた。
3. **DESINGN.md の「第7回の規約」を実装に合わせて書き直した**:
   - X1 は、設計書の文から書いていた。そのため、次のものが抜けていたり、実装と違っていたりした。
     - X3 の変数・数える札・44u
     - X4 の札の列の判定・すき間の引き方・viewBox
     - X5 の 2 回目の縮めの対象
     - X6 の「正しく描けていれば出さない」と置き方
     - X7 の分数の後ろ
     - X2 の data-fit の対象・縦積み・1.1 倍・`--pic-floor` の 0
   - V2 の項には、data-fit の列では `--pic-floor` を当てないことを足した。正解の印の listen の輪には、絵の後ろなので段いっぱいの絵では一部が隠れることを足した。
4. **コメント・テスト名の誤り**:
   - choice.tsx の「下限は並べ方の選び方で見ている」は誤り（見ていない）。
   - pics.ts の `COUNT_FLOOR_U` は計算では使わない（検査の下限）。
   - rt-wrap.test.ts のテスト名「分数と離す」は「離さない」の誤り。

確かめたこと:

- 静的な検査:
  - `npx tsc -b`・`npx eslint .`・`npx prettier --check`（変えたファイル）: 通った。
  - `npx vitest run`: 180 ファイル 4,011 件が通った。
  - `npm run check:design`: OK。
  - `npm run check:text-layout:probe` 相当（ポートだけ変えた一時の設定）: 34 本が通った。
  - `npm run check:app-layout:probe`: 13 本が通った。
- 検査（`MNW_FRESH=1`・`MNW_WORKERS=3〜4`、ポートを 4787 にした一時の設定。終わってから消した）:
  - 直したところと設計の確かめ方に当たる単元、選択肢にパックの SVG がある単元（31 単元）、prog の全単元を、4 回に分けて流した（のべ 64 単元、重ならない 52 単元・32,736 画面）。どの回も、失敗した単元 0・errors 0。
  - 最後の結果で違反が 0 だった単元（49）:
    - prog: g1.prog.sequence・g1.prog.condition・g2.prog.debug・g3.prog.condition-combo・g3.prog.decompose・g4.prog.draw-shapes・g4.prog.prefecture-finder・g5.prog.debug-plan・g5.prog.polygon・g6.prog.efficient・g6.prog.sensor
    - 英語: g4.en.directions・g4.en.want・g5.en.letters-write・g6.en.future・p4.en.colors-numbers・p4.en.hello・p4.en.move・p4.en.picture-book・p4.en.where・p4.en.words（2,352 画面）・p5.en.phrases（2,592 画面）・p5.en.picture-book
    - 算数: g1.math.numbers-10・g1.math.position・g1.math.shapes・g2.math.box・g2.math.fraction-simple・g3.math.abacus・g3.math.circle-sphere・g4.math.abacus・g4.math.cuboid・g5.math.polygon-circle・p23.math.compare・p23.math.shop・p4.math.count-pictures・p5.math.compose・p5.math.numbers-10・p5.math.shapes
    - ほか: p23.think.road・p4.think.pattern・p4.ja.word-play（X2 の安全網の単元。figure-outside-box も 0）・p5.ja.story-listen・g4.sci.current・g5.sci.birth・g5.sci.weather-change・g6.sci.moon-sun・g6.sci.plant-water・g6.sci.strata
  - 違反が残った単元: g3.en.numbers-colors/26 の解説（small-figure 12。2.6u。X2 の残し事項）、g2.prog.repeat（small-figure 46。X4 の残し事項と同じ数）、p5.think.pattern/2・3 の解説（scroll-hidden 2。パックの担当）。
- アプリの画面（`check:app-layout`。同じサーバー・全 13 プロフィール・422 画面・2,064 回）: 違反の 43 件は、レビューの前の結果（X7 のあと。2026-11-06T22:22Z）と同じ。新しい種類・増えたもの・開けない画面は無い。幼児ホーム・ほかの がくねん・おえかき は画面でも見た。
- 開発用の画面で目で確かめたもの:
  - X1: g1.math.shapes/1 の解説（1280×720。geometry の札が輪郭＋右下の ○）、g6.en.future/7、p4.en.words/89・p5.en.phrases/29（1280×620）、p4.en.where/0・p4.en.hello/0・p5.en.picture-book/0・g6.en.places/14 の解説。輪は ふりがなにかからない。
  - X2: p5.en.picture-book/42（1280×620・1920×1080 の解説）・/50、g3.en.numbers-colors/26、p5.en.phrases/92、p23.math.shop/12、g4.en.time-days/14、g4.en.want/37。どれも、絵は札の外に出ない。
  - X3: p5.math.measure-compare/8（塔 3 本が上から下まで見える）、p5.math.numbers-10/2・/3、g4.ja.read-summary/41・g6.sci.strata/17・p4.env.seasons/22 の解説。
  - X4: g4.sci.weather/9（単位が図の左上・札は 1 つおきの段）、g5.ja.text-figure/17、g4.math.fraction-kinds/4 の解説（印のラベルが ▼ の真上）、g6.prog.efficient/11・g5.prog.debug-plan/8。
  - X5: p5.math.numbers-10/4（1280×620）・/5（1280×720 のヒント②）。動物の列と選択肢の名前が見える。
  - X6: p5.math.shapes/8 の解説（何も描かずに つぎへ。2×2 のましかくの点線）。

残したもの:

- 絵が 1 つの札の下限（`--pic-floor`。幼児 10u・ほかの段階 6u）:
  - 絵だけの札の列では、JS が `--pic-floor` を 0 にする。検査（small-figure）も、数える札と手順の札しか見ない。
  - p5.math.numbers-10/4 の問題（1280×620）では、選択肢の札の絵が約 3u になる。札は動物の名前の札で、主の図は上の動物の列。
  - 下限に合わせて大きくすると、作業領域がスクロールの枠に戻って札が隠れる。そのため今回は受け入れた。次の回で、C29 に絵が 1 つの札の下限を足すか決める。
- listen の絵の段の輪は絵の後ろにあるので、段いっぱいに描かれた絵では一部が隠れる:
  - 輪の形は分かる（ぞう・ねこ・さる・おひさま）。
  - 緑の絵（p5.en.picture-book/42 の かえる）では、緑の輪が見えにくい。
- g3.en.numbers-colors/26 の解説の数える絵（2.6u。X2 の残し事項 1）:
  - 書き起こしの段と「きく」の札が上に積まれ、11 この札が 3 行になる。
  - 直すには、書き起こしの段の幅か、解説の板の高さを見直す必要がある（設計の判断）。
- X4 の残し事項:
  - g2.prog.repeat の盤（n=28・30 の 4×4 は数の入力で `--fit` が 0.8）と、n=3 の解説の札（2.2u）。
  - 数直線で jump と印のラベルを同時に使うと、ラベルが弧に近い（今のパックにこの組み合わせは無い）。
- X6: `geometryAnswerText` の similar・congruent は、given の座標を返すまま（画面には出ない）。
- X1: Choice の札のラベルの class の足し忘れを止める静的なテストは無い（DESINGN.md 17 章に運用を書いた）。
- p23.math.shop/12: 札の中の絵の高さが札ごとに違うので、中央にそろえたラベルの高さがそろわない（違反ではない）。
- パックの担当（5. の content）:
  - g1.math.shapes の すいか・p5.math.shapes の解説の文（「ましかくが かけたね。」）
  - p4.env.seasons/22 の札 8 枚・g4.math.fraction-kinds/4 の数直線 2 本と小数の目もり
  - g6.math.proportion/2・g5.ja.sentence-relations/37〜39・g6.sci.solutions/22・g6.sci.strata/17 の札
  - p5.think.pattern の解説
- 全単元の検査は流していない（統括が `MNW_FRESH=1` で流す）。新しい種類（figure-outside-box・small-figure・label-gap）は、全単元で初めて数える。絞った実行で、`.cache/text-layout/units/` と報告書は一部の単元だけが新しい。

### 9. 第7回のパックごとの直しとレビュー（2026-11-07）

5. の content と、共通の直しのあとの検査で見つかったパックの残りを、パックごとに担当（Sonnet）が直し、パックごとにレビュー（Opus）した。レビューでは git の差分を全部読み、次のことを確かめた。

- 意味・答え・誤答と誤概念・ヒント3段と解説の対応
- 学年の漢字・《よみ》・分かち書き
- 直した問題と単元の地図の札を、自分の開発サーバー（4300〜4999 の空いている番号。4299 は使っていない。終わってから止めた）で開き、画像と DOM の寸法で見た

`src/illust/content` は、どのパックも変えていない。英語の文も変えていない。

パックごとの直し（→ はレビューで直したもの）:

- **p4**（seasons.ts）: p4.env.seasons/22（sort の l3）の札を 8 枚から 6 枚にした。
  - 札は たけのこ・うきわ・かきごおり・くり・ゆきだるま・てぶくろ（はる 1・なつ 2・あき 1・ふゆ 2）。5 字の語は かきごおり・ゆきだるま の 2 枚。
  - 正しい箱と、誤った箱の誤概念は THINGS から決まるので、ずれない。外した こいのぼり・さつまいも は、練習・l1・別例に残る。
  - 解説は自動で 6 枚に合う（「はるは たけのこ、なつは うきわと かきごおり、あきは くり、ふゆは ゆきだるまと てぶくろ。」）。
- **p5**:
  - pattern.ts: 解説を、並びを全部は言わず、くりかえしの まとまりと答えで言う形にした。
    - 形と大きさ（もよう）が別々に回り、まとまりが 4 つ以上になる問題は、「かたちは …の じゅん、おおきさは …の じゅん。」と分けて言う。
    - 音の問題は「「…」の くりかえし。つぎは「…」。」。
    - → 形の解説の「？は X。」を「つぎは X。」にした。1536×864 の /1 で「…くりかえし。？／は まる。」と、「？」と「は」の間で折れていた。keep-all と line-break: strict のもとでも、ブラウザは「？」の後ろで折ってよい。検査には出ない種類の変な改行だった。音の問題・導入の「つぎは」にそろえた（5. の例の「？は」から変えた）。
  - shapes.ts: copy・draw の解説を、描けたことを前提にしない文にした。
    - copy の例: 「ましかくは かどが 4つ。かどから かどまで みほんと おなじだけ すすむと、おなじ おおきさに なるよ。」
    - draw は「…は かどが 4つ、…」と、形の特徴で言う。
    - → draw の ながしかく の特徴「よこの へんが たての へんより ながい。」を「ながい へんと みじかい へんが ある。」にした。判定（matchShape）は縦に長い ながしかく も正解にするので、向きで言うと、縦に描いた子が まちがえたと思ってしまう。ヒントの「たてより よこを ながく しよう」は描き方の案内なので残した。
- **p23**（sort.ts・p23.review.test.ts）: p23.think.sort の解説で名指す札を、各箱の 1 枚目（`firstOfEachBox`）だけにした。
  - この札は、`sortVisible` が 2 枚の段階でも必ず出す札。残りの札は「おなじ いろは おなじ はこへ。」「おなじ なかまは おなじ はこへ。」の決まりで言う。2 枚の問題は 2 枚とも名指し、決まりの文は付けない。
  - 答え・箱・誤概念・ヒントは変わらない。再発防止のテスト（2 枚の画面に出る札だけを名指す）を足した。
  - レビューでは、全 29 問 × 2〜3 歳・4 さい（1280×620 の解説）を DOM で測った。名指した札はすべて画面にあり、解説の板のはみ出しは 0。
- **g1-math**:
  - shapes.ts（すいか）: ボールの かたちの物から すいか を外した（絵が切った一切れで、球に見えない）。/1 の解説は「トマトが ボールの かたちだよ。」になり、ヒント③とも合う。
  - shapes.ts（katachi-alt。まわすと同じ形を選ぶ）: 3 つの選択肢を、同じ枠・同じ縮尺で描くようにした。形ぴったりの枠だと、まわした細長い形（1×4）が 54u の高さになり、作業領域に入らなかった。
    - → おてほんも、選択肢と同じ枠（bw × bh ます）・同じ縮尺で描くようにした。おてほんだけ形ぴったりの枠のままだと、ほかの選択肢が広い問題で、正解が おてほんより小さく描かれた（sq1 で 1/4）。これはヒント③「まわして かさねたら ぴったり あう」・解説「ぴったり かさなる」と合わない。たての枠も選択肢と同じにした（おてほんだけ低い枠では、1920×1080 の rect2x1 で作業領域が 2.1u 足りず、スクロールした）。`polyFig` は `polyFigIn` にまとめた。
    - → 問題文の「うえの かたちと」を「おてほんの かたちと」にした。図が高いと、おてほんは選択肢の左に並ぶので、「うえの」が画面と合わない（担当の直しより前からの食い違い）。「おてほん」は、同じ単元の katachiDraw のヒントで使っている言葉。テスト（おてほんの枠が選択肢と同じ・問題文に「うえの」が無い）を足した。
  - add-sub-2digit.ts: ひきざんの別例のブロックの図を、「N こ とる」をブロックの右に置く横並び（row）にした。下に置くと、解説が出たときの図の段（高さ約 12u）に入らず、字が切れた。
- **単元の題**（アプリの画面の検査の残り。5. の「単元の題」）: 空白で区切った 1 まとまりが札の 1 行に入るように、文節の切れ目に空白を入れるか、短くした。
  - g1-ja: write-order「じゅんじょ よく かこう」。
    - → folktales: 担当の「むかしばなし きこう」は「を」を落としている。助詞を教える 1 年の国語の題として手本にならないので、「むかしばなし」にした。6 字で 1 行に入る。練習は聞く問題・別例は読む問題なので、名詞だけの題が中身に合う（g1 の「カタカナ」「ことばあそび」と同じ形）。
  - g1-math: numbers-120「100までの かず・120くらいの かず」（範囲は中の節の題で分かる）、add-sub-2digit「2けたの かんたんな たしざん・ひきざん」。
  - g2-ja: culture「むかし話《ばなし》と ことばあそび」。話は小2の漢字で、むかし（昔）は小3の漢字。
    - → 子供に見えるせつめい（intro）の 3 つ目の「むかしばなしは、…」も「むかし話《ばなし》は、…」にそろえた。読みは同じなので、音声のキーも変わらない。
  - g3-ja: haiku「俳句を 楽しもう」・romaji「ローマ字の 読み書き」・kanji-parts「漢字の 組み立て」・read-paragraphs「だんらくの 役わり」。
    - → g3-ja.test.ts の題の検査（`wakachiTitleErrors`）の説明が、判定と逆（「空白が多すぎる題は誤り」）だったので直した。空白で区切った 1 まとまりは 7 字まで、という検査も足した。
  - g4-ja: info-compare「くらべる 分ける 引用」（「・」を空白に替えた）。ふりがなの付く漢字の前後の 1 字が包みにまとまるので、古い題は「分け／る」の間でしか折れなかった。
    - → g4-ja.test.ts の `wakachiTitleErrors` の説明とテスト名が、判定と逆だったので直した（検査の中身は同じ）。
  - g5-ja: figurative「表現の 工夫」・sentence-relations「文の 組み立てと つながり」・spoken-written「話し言葉と 書き言葉」・word-structure「熟語の 組み立てと 言葉の 種類」。figurative から外した「（比喩・反復など）」は、到達項目 find の題に残る。
  - g6-ja: kanji-usage「同じ読みの 言葉と 漢字とかなの 使い分け」・language-change「方言と共通語 言葉の 変化と由来」（「、」を空白に替えた）。
    - → g6-ja.test.ts に検査を足した。題に空白があるときは、`spacedLabel` を満たすこと、「、」「。」が残っていないことを見る。
  - g4-math: change-relations・fraction-kinds・quadrilaterals は「（」の前に空白を入れ、fraction-kinds・quadrilaterals は括弧の中の「・」の後ろにも空白を入れた（「分数の しゅるい （真分数・ 仮分数・ 帯分数）」など）。
  - g5-math: decimal-shift「…[[1/100]] （小数点の いどう）」・per-unit「単位量 あたりの 大きさ」。
  - sci-g34: g4.sci.temperature「金ぞく・ 水・ 空気と 温度」。
    - → 担当の版は、2 つ目の「・」の後ろにだけ空白があった（「金ぞく・水・ 空気と 温度」）。どの「・」の後ろにも空白を入れた。1 行で出る画面（単元を終えた画面など）で空白の入り方がそろい、g4-math の題と同じ形になる。札での折れ方は変わらない。
  - soc-g34: g3.soc.safety「まちの 安全を 守るはたらき」。空白 1 つでは 12 < 13 字で `spacedLabel` にならないので、2 つ入れた。
    - → review-soc34.test.ts で、担当は題を分かち書きの検査から丸ごと外していた。「題に空白があるなら `spacedLabel` が真」の検査を足した。
    - → g4.soc.tradition の題が、4 サイズとも「地いき／の伝統と先人の働き」と、文節の途中で折れていた。Rt が、ふりがなの語と前後の 1 字を包むため。check:app-layout は違反に出していなかった。「地いきの 伝統と 先人の働き」にした。
    - → g4.soc.prefectures の題「47都道府県《よんじゅうななとどうふけん》」は、数の読みまで《よみ》に入れていた。そのため、ふりがなが親字より長くなって字の間が空き（都 道 府 県）、読み上げも「よんじゅうなな よんじゅうななとどうふけん」と 2 回読んでいた。「47都道府県《とどうふけん》」にし、「数字の直後の《よみ》に数の読みを重ねない」検査を足した（直す前の題で落ちることを確かめた）。
  - soc-g56: history-2「歴史2 武士の世から 江戸の文化まで」（「世の中」を「世」にした）・history-3「歴史3 明治から 今の日本へ」。
    - → soc-g56.test.ts に、題に日本語どうしの空白があるなら `spacedLabel` になることを見る検査を足した。
  - 単元の地図・ホームでは、プロフィールと 4 サイズを変えて、どの題も空白か語の切れ目でだけ折れ、札の中に収まることを DOM で確かめた（scrollWidth ＝ clientWidth、data-fit-overflow なし）。
- **g3-ja**（listen-memo.ts）: amibou の解説（shitsumon/19・chuushin/26）を 2 行に入る長さにした。chuushin/26「はじめは「たからものは、あみぼう」、おわりは「がんばった日を思い出す」。たからもののわけを話しているよ。」は受け入れた。
  - → shitsumon/19: 担当の「マフラーをあげた人は話に出てこなかった」は、マフラーをわたした側（話し手）とも読め、意味が逆に取れる。前半を元の「あんだマフラーをどうしたかは」に戻し、後半を「教えたのは「おばあちゃん」だよ。」にした（52 字）。見出しが「こたえ」（1 行 28 字）でも「せいかい」（27 字）でも、4 サイズとも 2 行に入る。
- **g4-math**:
  - fraction-kinds.ts（等しい分数 equiv）:
    - 数の入力の解説の図を、数直線 1 本にした（`step: 1/d`・`minorStep: 1/D`・`labelEvery: 1`・印 1 つ。ラベルは「n/d ＝ N/D」）。
    - 選ぶ問題の 2 本の数直線に `labelEvery: 1` を付けた。
    - 導入の 3 本の数直線（1/2・2/4・3/6）は、図の列（`fig-column`）だと作業領域に入らず、3 本目が隠れた。1 つの SVG（`equalLinesFig`）にまとめて低くした。
    - → ヒント①を解説の図に合わせた新しい文は、分母を求める問題（[[N/□]]）で「1を Dこに 分けた めもり」と、答えの D を言っていた。分母を求める問題は「大きさの 等しい 分数は、数直線の 同じ 位置に あるよ。」にした。分子を求める問題の「かさねて 見よう」は「かさねて みよう」にした（「〜てみる」はひらがなで書く）。
    - → 分子が 1 のときの分子を求める問題で、ヒント②「D ÷ d ＝ k」の k が答えそのものだった（前からの不具合。足したテストで見つけた）。この場合だけ「D ÷ dを 計算しよう。」にした。review-hints.test.ts に、①に答えの数を出さない・どのヒントにも「＝ 答え」を出さない検査を足した。
    - → 数直線の `labelEvery` は値の間隔で、目もりの本数ではない。それなのに、compare の数直線の問題は `labelEvery: den`（分母 5 以上で「0」しか数が出ない）、導入の 1 枚目は `labelEvery: 3`（文の「1」が図に無い）だった（前からの不具合）。どちらも 1 にした。
  - quadrilaterals.ts:
    - 分ける問題の札を 6 枚から 5 枚（台形 2・平行四辺形 2・ひし形 1）にした。6 枚だと 2 段になり、1280×620 で作業領域が 2.1u 足りなかった。
    - 平行四辺形・ひし形の図（paraFig）を小さめ（k = 16）にし、字を大きめ（頂点 22・辺と角 20）にした。数の入力で図が 12u まで縮むと、8cm・70° の字が 0.84u になっていた。
    - → 角の字を固定のずれ（右 36・上 12）に置いていたので、底辺 3cm の図では「60°」が辺イウをまたいで イ の近くに出た。「角イは何度」の問題で角イの大きさに読め、誤答 opp-angle を誘う（50°・55° では辺アエにもかかった。seeds=30 で 7 件）。角アに弧（角のしるし）を描き、字は弧のすぐ外の、辺アイと辺アエの間に置くようにした。字の箱は、画面で引き上げられたあとの大きさで見積もる（g5-math/angle-labels と同じ考え方）。底辺 3cm で入らないときだけ k を大きくする。
    - → 縦に細長い組み合わせ（3cm×6cm など）は、k をいくつにしても字が角の中に入らない。props の辺アエを「底辺＋2cm まで」にした（問題の出し方が少し変わる）。
- **g5-ja**（sentence-relations.ts）: setsuzoku-alt（/37〜40）は、設計の 2 列（grid）ではなく、もとの文を図にせず「」で問題文に入れる形にした。図（4.9u）と長い選択肢 3 つでは、作業領域に入らなかった。
  - `LINK_ALT` に kind（split・merge）を足し、問題文を `linkAltPrompt` で作る。
  - 二つに分ける問いの差を決める「意味を変えずに」は残した。ヒント①の「もとの文の、つなぎの言葉…」は、「」の中の文を指すと読める。「「…」を、」の書き方は g6-ja の write-opinion と同じ。
- **g6-math**（proportion.ts）: graph-alt（/2）を 1 段の 4 つ（`layout: 'row'`）にした。4 サイズの問題・ヒント・解説で、グラフは 16u×8.4u（解説は 15.6〜15.8u）。4 つとも横軸 0〜5 が見え、作業領域のはみ出しは 0。
  - → 0 の点を通らない直線（誤概念 through-origin）は `i × kk + d` だった。kk=3・d=1 だと縦の軸の 1/16 しかずれず、1 段のグラフでは、線の始まりが 0 の点から約 0.35u（点 1 つ分）しか離れなかった。正解と見分けにくい。`(i + d) × kk` にした。ずれは、いつも縦の軸の 1/6 以上になる（同じ問題で約 0.93u。kk=1 は前と同じ）。
- **sci-g56**:
  - solutions.ts: g6.sci.solutions/22（mt-solid-diff）の表を転置した（行は アルミニウム・出て きた 固体、列は 見た目・塩酸に 入れる・水に 入れる）。選択肢を「ちがう 物に なった」「もとの 物に もどった」と短くし、表の下の 1 段（`layout: 'row'`）にした。解説は「見た目も とけ方も アルミニウムと ちがうので、別の 物だよ。…」。
    - → 問題文の「とかして 蒸発させ」（担当の版）を「とかした 液を 蒸発させ」に戻した。アルミニウムそのものを蒸発させるとも読めるため。「出た 固体」は残した。問題文は 1 行のまま（欄の幅の 97.9%）。
    - → 転置したあとも、左上の見出しが「調べた こと」のまま、物の名前の列の上に残っていた。空欄にした（パックで多い形）。
    - → 誤概念 sol-metal-vanish の選択肢「塩酸だけが のこった」は、「アルミニウムが消えた」という誤概念の中身が抜けていた。「消えて なくなった」にした（誤概念の説明「消えて なくなったと 考えたのかな」・mt-where の選択肢と同じ文）。
  - strata.ts: g6.sci.strata/17 の札を「れき・砂・どろが 重なる 層」にした。解説を「…れき・砂・どろが 大きい じゅんに 重なる 層は 水の 働きで できたよ。…」にして、札と対応させた（札から抜けた「下から」の順は、解説で補う）。

受け入れたもの:

- 文や題が、分かち書きの空白のところで折れるもの（p4.env.seasons/22 の解説の「あきは／」など）。
- g6.math.proportion/2 の解説が「縦の じく／が 交わる」と、文節の途中で折れるもの。小3以上の本文・解説は文節で折らない（DESINGN.md 17 章）。検査も違反にしない。
- g6.sci.solutions/22 の解説が、主語（出た 固体は）の無い 2 行になったもの。表を見ながら読む場面なので通じる。主語を足すと 3 行になり、作業領域が足りない。
- g3.ja.listen-memo/26 の解説の「たからもののわけ」。正解の札と同じ言い方にすると 59 字・3 行になる。

確かめたこと（commit の前）:

- `npm run voice:packs` を流し直しても、台本は変わらない（担当とレビューが作り直した台本と同じ）。HEAD との差分は直した文の入れ替えだけで、改行だけ変わった JSON は無い。音声ファイルは作っていない（統括があとで作る）。
- `npm run build:unit-index` も変わらない（題の 27 行）。`npm run chars` も変わらない（990 字・うち漢字 539）ので、フォントは作り直していない。
- `npx tsc -b`・`npx eslint src/packs src/illust`・`npx vitest run src/packs src/illust src/curriculum`（85 ファイル 1,558 件）・`npm run check:design`・`npm run check:packs` が通った。
- `npx prettier --check`（変えたファイル）:
  - 担当が CRLF にしていた 9 ファイルを LF に戻した（中身は同じ）。g2-ja/culture.ts・g4-ja/g4-ja.test.ts・p23/sort.ts・p23/p23.review.test.ts・p4/seasons.ts・sci-g56/strata.ts・soc-g34/tradition.ts・soc-g56/history-3.ts・soc-g56/soc-g56.test.ts。
  - 残る 4 ファイル（g1-ja/write-order.ts・g1-math/g1-math.test.ts・soc-g56/history-2.ts・history-3.ts）の差は、HEAD からある行だけ。このラウンドで変えた行には無い。

残したもの:

- 全単元の検査（`MNW_FRESH=1 npm run check:text-layout`）と `npm run check:app-layout` は、このパックの直しのあとでは流していない（統括が流す）。
- 8. の「残したもの」（g3.en.numbers-colors/26 の数える絵・g2.prog.repeat の札・絵が 1 つの札の下限など）は、このラウンドのパックの直しでは変えていない。
- check:app-layout は、g4.soc.tradition の「地いき／の伝統と…」（Rt の包みのせいで、文節の途中の「の」が行頭に来る折れ）を違反にしていなかった。検査の側で見るかは、次の回で決める。

## 第8回（2026-11-07・分析と設計）

第7回の直し（共通 6c4cc74・パックごと 70b6e5c）のあとに全単元を流した結果と、独立の点検の指摘 9 点を合わせて分析する。

### 0. 元の結果と、追加で測ったもの

- 元の結果: `docs/screenshots/text-layout-report/`（作成 2026-11-07T08:11Z。313 単元・10,056 問・191,860 画面。`MNW_FRESH=1 MNW_WORKERS=4`。失敗した単元 0・errors 0。全件は `.cache/text-layout/units/`）。件は **11**（第7回の前は 18）。違反のない単元は 309 / 313。
  - 種類は small-figure（絵・札が小さすぎる。第7回 C29 で入れた種類）だけ。前回の scroll-hidden 15・overlap-text 1・covered 1・orphan 1 は 0 になった。figure-outside-box・label-gap も 0。
  - 件の内訳（`.cache` の行で数えた画面）:
    - g2.prog.repeat 4 件: 盤の 4×4 のます 2u（/28・/30 の問題とヒントの全サイズと解説の 1280×720。34 画面）、解説の手順の札 2.2u（/3 の A・B・C の札。4 サイズ）。
    - g3.en.numbers-colors 3 件: /26（num-pic:7。7 こ・6 こ・11 この札）の解説の数える絵 2.6u（4 サイズ）。
    - g4.en.want 3 件: /17（7 こ・6 こ・7 この札）の解説の数える絵 3.6u（1280×620・1920×1080）。
    - g4.math.area 1 件: /0・/1（count）の方眼のます 1.9u（問題とヒントの 4 サイズ。32 画面）。
- アプリの画面の検査（`docs/screenshots/app-layout-report/`。作成 2026-11-07T08:16Z。13 プロフィール・422 画面）: 残りは参考の missing-illust 6 件・68 画面だけ（単元の地図・ホームのおすすめ・ノートの `book`・`music-note`）。ほかの種類は 0。
- 開発サーバー（127.0.0.1:4388、`MNW_DEV_NO_HMR=1`。`node_modules/.vite` の取り合いを避けて cacheDir を分けた一時の設定。4299 は使っていない。終わってから止めた）で、11 件の代表と点検の 9 点を開いた。Playwright（同じサーバー）で約 60 画面を撮り、札・絵・図・数字キーの矩形と計算された CSS を測った。絵の大きさは 18 単元の全問も測った（1280×620 の問題と解説。1,560 画面）。聞く問題は、検査と同じ順（問題 → ヒント①〜③ → 解説、状態ごとに 4 サイズを往復）でも測った（下の「再現の差」）。分かったことは次のとおり（u は舞台の単位）。
  - **数字キーが --fit を下限まで縮める**（g2.prog.repeat/28・/30）:
    - 数字キーの区画は --u0 で 1 つ 6u 以上（4 段で 6u × 4 ＋ すき間 0.6u × 3 ＝ 25.8u）。問題文が 2 行の作業領域は 23.75u（1280×720）、ヒント③では 22.66u なので、キーが 2.05〜3.1u 下へ出る。
    - UnitRunner の fit はこのはみ出しも scrollHeight で数え、--fit を下限の 0.8 まで縮める。キーは --u0 なので縮まず、縮むのは図と回答欄だけ（盤の svg が 10.6u → 8.48u、ます 2.5u → 2.0u。回答欄 7u → 5.6u）。
    - --fit を 1 に戻して測ると、左の列（図 10.6u ＋ 札と回答欄 10.3u ＋ すき間 2u ＝ 22.9u）は作業領域に入る。数の入力で問題文が 2 行の問題と、ヒントを出した状態の多くで、同じことが起きている（キーの下端は つぎへ・吹き出しに重ならない。1280×620 のヒント③で キーの下端 490px、つぎへ の上端 532px）。
  - **解説で、手順の札の列が --fit で縮む**（g2.prog.repeat/3）: 札の列の svg の高さは 4.6u（第7回 X4）。解説の板が 3 行（16.5u）で --fit が 0.835 になり、svg が 3.84u、札 1 枚（viewBox の 24×28）が 2.2u になる。問題の状態（1280×620）では 4.6u・2.6u。
  - **方眼が 7×7 のまま**（g4.math.area/0・/1）: count の図は形にかかわらず 7×7 の方眼（`cellsFig(cells, 7, 7)`。viewBox 184×184）。形は 2×4 ほどで、方眼の大半は空き。数の入力の図の段は、札「cm²」（回答欄の上の 3u）を除いて 14.4u（1280×720）なので、ます 1.9u。解説では札が左に来て図の段が 24.8u になり、ます 2.9u（状態で大小が逆になる）。
  - **聞く問題の解説で、絵が縮む**（g3.en.numbers-colors/26・g4.en.want/17・点検 6）:
    - 解説では「きく」の札と書き起こしの枠の段（`.eng-listen__head`。幅 60u まで）が選択肢の上に積まれ、残りの高さで絵の大きさを決める（第7回 X2 の `usePicsGeometry`。解説では並べ方を選び直さない: `options.tsx` の `free: !revealed`）。
    - 最初の再生が終わると「きく」の札が「きいてね」（19.5u）から「もういちど きく」（26.6u）になり、段の 60u のうち書き起こしの枠が 38u → 31u に狭くなる。g4.en.want/17 の「I want seven strawberries.」は 31u では 2 行になり、段が 11u を取って、数える絵が 4.46u → 3.59u（1280×720・1920×1080・1536×864）。書き起こしが 1 行に入る 1280×620 では 4.47u。
    - g3.en.numbers-colors/26: 11 この札は 5・5・1 の 3 行。段（6.7u）と板で作業領域が 22.4u になり、3 行の札の高さ 11.1u から絵が 2.57u。段を左に置いても（札の列の幅 57u）、2×2 にしても 4u に届かない（見積り 3.6u・2.5u）。11 この絵が出るのは、7 の誤答の 11（`SAME_START[7]`）を絵の問題にも使うこの 1 問だけ。
    - 絵と語の札（`has-word`）: 問題の状態の 9.6〜9.7u が、解説で 3.3〜3.5u になる（g3.ja.listen-memo/28・g1.ja.listen/21 の 4 サイズ、p5.en.first-sound/53 の 4 サイズ。p4.ja.story-listen/28 は 1920×1080 で 3.37u、ほかのサイズは 6.3u）。字は 3.2u のまま残り、絵だけが縮む。正解の輪（絵の段の後ろ）も 2.7u ほどになり、緑の点にしか見えない。
    - p4.ja.story-listen/28 の 1920×1080 だけ小さいのは、書き起こしの枠が 3 行（15.5u）のままだったため（ほかのサイズは 2 行・11.6u）。行の数は、入らないと 3 → 2 に減らすだけで戻さない（`Transcript` の `lines`）ので、画面サイズを回す順で変わる。
  - **再現の差**: 開発用の画面の `state=explain` は、最初の再生が終わる前に つぎへ を押すことがあり、「きく」の札が「きいてね」のまま（`data-heard="0"`）で解説になる。検査はヒントを 1 つずつ押すので、たいてい再生が終わっている（`data-heard="1"`）。本当の画面では、聞き終わるまで選択肢を押せないので、解説はいつも `data-heard="1"`。g4.en.want/17 は `state=explain` では 4.47u で、検査の 3.6u を再現しなかった。
  - **単位が回答欄の前に来る**（点検 2）: 数の入力（number）とグラフの数の欄（graph）の `label` は回答欄の上（問題）・左（解説。第4回 V4）の見出しで、`unit` は回答欄の右。パックが単位を `label` に書いている欄が、全パックの見本（seed 2）で **61 単元・274 問**（number 59 単元・256 問、graph 18 問）。例: g4.math.area の「cm² [7]」、g3.math.weight の「kg [1] g [228]」（問題の図は「□kg□g」）、g1.math.three-numbers の「にん [16]」、g6.math.representative/4（graph・データの散らばり）の「冊 [ ]」は、図を左に置く並べ方（`data-layout="side"`）のため問題の状態でも左。単位は cm・m・こ・かい・まい・円・kg・g・cm²・度・人・%・L・dL・mm・km・本・分・時間・倍・cm³・点・ど・マス・わ・ひき・にん・こずつ・れつ・そう・秒・m²・a・ほ・角形・m³・mL・枚・冊・回・通り・つ・台。「じゅうの くらい」「商」「あまり」「約」「□が 4」「犬○ねこ○」などの見出しは左のままでよい（「約 [3] m²」は正しい順）。
    - 単位を `label` に書くと、問題の状態でも回答欄の上に 3u の札の段が要る（g4.math.area の図が 14.4u に止まる原因の 1 つ）。
  - **sort の札が減らされ、解説が画面と食い違う**（点検 3）: life-g12 の `sortItem` は `fitSortCards` で札を 4 枚（箱 4 つなら 1 枚ずつ、2 つなら 2 枚ずつ。字の少ないもの）に減らすが、解説はパックの決まった文で、減らす前の 6〜8 枚を言う。18 問（seasons・school-safety 2 組・town・animals・plant-diary の別例）。
  - **描く問題の解説**（点検 4）: p5.think.why の描く問題 6 問（`drawItem`）の解説は「かけたね。どうして そう おもったのか、…」。ヒントを出すと つぎへ が出て、何も描かずに解説へ進める（第7回 p5.math.shapes と同じ型）。
  - **選択肢の札の中のパックの図が左に寄る**（点検 5）: `.choice svg { max-width: min(100%, var(--pic-max)) }` で svg が `.fig-svg`（札の中の幅いっぱいの箱）より細くなり、margin が無いので左に寄る。p5.think.pattern/2（1280×620）で 4.31u、p5.math.shapes/17 で 6.5u 左。
  - **絵の代わりの赤い破線の枠**（点検 7）: 単元の `icon` が登録の無い絵の ID（`book`・`music-note`）。`Illust.tsx` は本番でも赤い破線の四角を描く。g1.ja.folktales・g6.ja.language-change（book）、g1.ja.word-play（music-note）。登録済みの `p5-book`（えほん）・`p5-note`（おんぷ）がある。`icon` は string で、登録を見る検査が無い。
  - **書き起こしの区切り**（点検 8）: `Transcript` は音と音の間に必ず「・」を置く。日本語の文が「。」で終わると「いました。・まいにち」となる（p4.ja.story-listen/28 の 1920×1080 で確かめた）。
  - **塔のつみき**（点検 9）: p5.math.measure-compare の塔（viewBox 40×170）は札の図の枠（16u×9u）に高さで縮み、つみき 1 こ 1.06u（1280×620）。高さは比べられるが、解説が「つみき 7こ、6こ、2この じゅんに たかいね。」と数を言う。
  - **絵が 1 つの札の下限**（点検 6 の後半）: DESINGN.md 17 章の `--pic-floor`（幼児 10u・ほか 6u）は、絵だけの札の列（`data-fit`）で JS が 0 にしていて、検査も見ていない（第7回の残し事項）。点検の測りでは、幼児の英語の問題と解説（1280×620）で 10u 未満が 417 / 1,436 画面、6u 未満が 50 画面（p5.en.phrases・p5.en.shop・p5.en.picture-book・p5.en.first-sound）。
    - 10 単元（幼児の英語 4・p5.math.numbers-10・p4.en.words・p4.en.where・聞いて選ぶ 3 単元）の全問を、1280×620 の問題と解説（`state=` で開いた）で測り直した（1,386 画面）。選択肢の札で絵が 1 つのもののうち 6u 未満は、**数える札の無い列では 10 画面だけ**: 聞いて選ぶ問題の解説 8（p4.ja.story-listen/27〜29・g1.ja.listen/21・g3.ja.listen-memo/28〜30・p5.en.first-sound/53。3.3〜3.5u）と、p5.math.numbers-10/4・/5 の問題（名前の札の絵 4.8u。主の図の動物の列が約 10u。解説の 1920×1080 では 9.74u）。
    - 点検の 50 画面のうち、上の 10 画面のほかは、数える札の列の中の「1 こ」の札（p5.en.phrases・shop・picture-book の 4.35〜5.9u）で、数える絵の 4u は満たす（第7回 X2 は列ごとに数える札として大きさを決める）。
    - 単元の札（`.tk-card`）の絵は、札の設計の大きさ（`.tk-card__illust` 5.6u、2〜3 歳 8u、sort の箱の中 4.6u）× --fit。8 単元（life の sort・order・match、p4.env.seasons、p23.think.sort ほか）を同じように測ると 3.6〜5.6u（g2.life.town の match の左の絵だけの札 3.6〜5.05u、p23.think.sort の解説の箱の中 4.6u）。
- 検査の側で分かったこと:
  - 11 件はどれも本物（誤検出は無い）。C29 は初めて全単元を見て、点検の単元のほかに g2.prog.repeat の盤・g4.math.area の方眼を見つけた。
  - 点検 2・3・4・7・8・9 は、字の配置の検査では見えない種類（読む順・意味・絵の登録）。2 と 7 は静的な検査で止める（Y4）。

### 1. 原因の分類（第8回）

| 分類 | 内容 | 主なもの（点検の番号） |
|---|---|---|
| (1) 共通の画面の作り | 聞く問題の解説の段（書き起こしの幅・行の数・「きく」の札の幅・並べ方を選び直さない）と区切り・札の中の図の左寄せ（Y1）／数字キーのはみ出しで --fit が縮む（Y2）／手順の札の列が --fit で縮む（Y3）／単位の札と単元の絵を見る静的な検査が無い（Y4） | 1（g4.en.want・g2.prog.repeat）・5・6・8、2 と 7 の再発防止 |
| (2) パックの文・選択肢・配置 | 単位を `label` に書く（算数 6 パック・prog）／方眼の大きさ（g4-math）／盤の高さと解説の長さ（prog-g16）／札を減らす作りと解説（life-g12）／描く問題・塔の解説、名前の札の絵（p5）／11 この誤答（en-g34）／単元の絵の ID（g1-ja・g6-ja） | 1（g3.en.numbers-colors・g4.math.area・g2.prog.repeat）・2・3・4・6（p5.math.numbers-10）・7・9 |
| (3) 検査の誤検出 | なし | — |
| (3') 検査の見落とし・再現の差 | 絵が 1 つの札の下限を見ない（C32）／開発用の画面の `state=` が最初の再生を待たない（C33） | 6 |
| (4) 設計上受け入れる | 第7回までのもの（下の 4.）と、幼児の絵の 10u は並べ方の目標（検査の下限は 6u） | 6 の一部 |

### 2. 共通の直し（systemic。項目ごとにファイルを分ける）

DESINGN.md は Y4 が持つ。Y1〜Y3 と C32・C33 の規約（各項目の「DESINGN.md に書くこと」）も、Y4 がまとめて 17 章・18 章に書く（ファイルを重ねないため）。Y4 は、ほかの項目の実装を読んでから書く（第7回 8. のレビュー 3.: 設計書の文だけで書くと実装とずれた）。

#### Y1 聞く問題の解説の段と絵の札（listen・choice）

ファイル: `src/engines/listen/**`（`listen.tsx`・`listen.css`・`options.tsx`・`options.css` とテスト）、`src/engines/choice/**`（`choice.tsx`・`choice.css`・`pics.ts` とテスト）

1. **「きく」の札の幅を、再生の前後で変えない**: 「きいてね」と「もういちど きく」の長いほうの幅を、はじめから取る（字の幅を測るか、2 つの文を重ねて置き、見えないほうを `visibility: hidden` にする）。今は最初の再生が終わると札が 19.5u → 26.6u に広がり、書き起こしの枠と選択肢の列の幅が問題の途中で変わる。
2. **書き起こしの枠の幅**: 枠そのものを 60u まで（今は段全体が 60u まで）にし、段（「きく」の札 ＋ すき間 ＋ 枠）は作業領域の幅（88u。`--u0`）まで広げてよい。g4.en.want/17 の「I want seven strawberries.」（約 33u）が 1 行に入る。日本語の長い書き起こしの 1 行の字数は今と同じ（枠の 60u）。
3. **書き起こしの行の数を、並べ方と画面サイズから決める**: 絵・図の選択肢と並べる解説（`hasPics`・`sideHead`）では、枠を 2 行まで（続きは枠の中のスクロールと ▼ つづき。第6回 W5）にする。ほかは今の 3 行まで。入らないときに 3 → 2 へ減らす今の処理は、画面サイズが変わったら 3 から測り直す（減らした行の数を次のサイズに持ち越さない）。
4. **解説で、並べ方を選び直す**: 解説（`revealed`）でも `free: true` にし、「段が上」「段が左」× 1 段・2×2（4 つの選択肢）の `s` を、解説の段（「きく」の札 ＋ 書き起こしの枠）の実際の寸法で比べて、最大のものにする（`chooseArrange`）。
   - 段を左に置くときの幅は、今の `side: 32`（u）の見積りでなく、段の幅を測った値。段を左に置く並べ方の CSS（段を縦に積む・右に札の列）は、今の時計の並べ方（`eng-listen--explain-side`）と同じ形にする。
   - 並べ方を替えるのは、今と同じく `s` が `SWITCH_RATIO`（1.1）倍以上になるときだけ。ただし、画面サイズが変わったときは、前のサイズの並べ方を持ち越さず、はじめから比べる（同じサイズの中の行き来だけを止める。g4.en.want/17 の 3.6u は、回す順で出たり出なかったりした）。
   - 見積り（1280×620）: g3.ja.listen-memo/28 は、段が上の 1 段で 3.46u、段が左の 2×2 で約 6.5u。p5.en.first-sound/53（書き起こし無し・主の図あり）は、札が左の 1 段で約 9u。g4.en.want/17 は 2. だけで 4.46u。g3.en.numbers-colors/26 は、どの並べ方でも 4u に届かない（5. の en-g34 で直す）。
5. **絵の大きさの下限**: 選んだ並べ方で、絵が 1 つの札の絵が 6u（数える絵は 4u）に届かないときも、`s` が最大の並べ方のまま描く（今と同じ。C32・C29 が検査に出す）。幼児の 10u（`--pic-floor`）は並べ方を選ぶときの目標で、下限ではない（4. の受け入れ）。
6. **書き起こしの区切り**（点検 8）: 前の音の文が文の終わりの記号（日本語の「。」「！」「？」、英語の「.」「!」「?」。閉じ括弧が後ろに付くときも）で終わるときは「・」を置かない（日本語は何も置かず、英語は空白 1 つ）。そうでない音どうし（語の並び）は今のまま「・」。
7. **札の中のパックの図を中央に置く**（点検 5）: `choice.css` の `.choice svg`（`max-width: min(100%, var(--pic-max))`）に `margin-inline: auto` を足す（`.fig-svg` の中で svg が細くなっても中央）。絵の段（`.fig-illust`）・数える札の並びは変えない。
- DESINGN.md に書くこと（Y4 が書く）: 17 章の「語のラベルと絵の札の高さ」と「第8回の規約」に 1.〜7.（「きく」の札の幅は再生の前後で同じ・書き起こしの枠は 60u まで・絵と並べる解説は 2 行まで・解説でも並べ方を選び直す・画面サイズが変わったら持ち越さない・区切りの「・」・札の中の図は中央）。
- 確かめ方: 検査と同じ順（ヒントを 1 つずつ押してから解説。C33 のあとは `state=explain` でもよい）で、次の画面の絵の大きさを測る。
  - g4.en.want/17（4 サイズの解説）で数える絵 4u 以上（C29 で 0）。
  - g3.ja.listen-memo/28〜30・g1.ja.listen/21・p4.ja.story-listen/28・p5.en.first-sound/53（4 サイズの解説）で、絵が 6u 以上（C32 で 0）、正解の輪が絵を囲んで見えること。
  - p4.ja.story-listen/17・/28 の書き起こしに「。・」が無いこと。g3.en.greetings（英語の文の並び）・p4.en.words（語の並び）の区切りが今と同じこと。
  - p5.think.pattern/2・/3（1280×620・1536×864）・p5.math.shapes/17 で、札の中の図の中心と札の中心の差が 0.3u 以内。
  - 聞く問題の時計（`eng-listen--explain-side`）・p5.en.picture-book・p4.en.where・g4.en.time-days/14 が崩れないこと（第7回 X2 の確かめ方の画面）。

#### Y2 数字キーで --fit を縮めない（UnitRunner）

ファイル: `src/units/UnitRunner.tsx`、`src/units/unit.css`（測る間の規則を CSS で書くとき）、`src/units/` のテスト

- 数字キーの区画（`.eng-number__pad`）がある作業領域（数の入力 number と、数の欄に答えるグラフの問題）の fit の `need` に、その区画のはみ出しを入れない。キーは `--u0` で 1 つ 6u 以上（DESINGN.md 18 章）なので、--fit を下げても縮まず、図と回答欄だけが縮む。
  - 例: 測る間（`data-measure`）だけ区画の高さを 0 にする（`.unit__work[data-measure] .eng-number__pad { max-height: 0; overflow: hidden }`）か、`need` を左の列（図と回答欄）の下端で測る。
  - 左の列が入らないときは、今までどおり図を縮め、--fit を下げる。区画の位置と大きさは今と同じ（--fit を下げても変わらなかった）。
- DESINGN.md に書くこと: 5.1 の「図が先に縮む」と 18 章の数の入力に、「数字キーの区画のはみ出しは --fit の計算に入れない（キーは縮まない）」。
- 確かめ方:
  - g2.prog.repeat/28・/30（問題・ヒント①〜③、4 サイズ）で --fit が 1（左の列が入るとき）、盤のますが 2.4u 以上（5. の prog-g16 の直しと合わせて C29 で 0）。
  - 数の入力で問題文が 2 行の問題（g3.math.weight/4・g4.math.area/0・g6.math.representative/0 など）のヒント③で、数字キーが つぎへ・吹き出しに重ならないこと（overlap-button・covered で 0）。
  - 解説（キーの区画が高さ 0）の --fit が今と同じこと。

#### Y3 手順の札の列の高さの下限（figure.css）

ファイル: `src/engines/figure/figure.css`

- 1 列にした札の列（`.eng-choice__options:has(.fig-svg--wide) .fig-svg svg`）の高さ `calc(var(--u) * 4.6)` を `max(calc(var(--u) * 4.6), calc(var(--u0) * 4.4))` にする（札 1 枚は viewBox の 24×28 で、高さ 4.4u0 なら幅 2.51u。解説の --fit が 0.835 でも 2.4u を割らない）。
- 同じ列の、縦横比 4:1 以下の札の列（g2.prog.repeat/3 の A。`fig-svg--wide` でない `.fig-svg`）にも同じ規則が当たることを確かめる（今の規則は列の中の `.fig-svg svg` 全部に当たる）。
- DESINGN.md に書くこと: 17 章の「第7回の規約」の手順の札（1 枚 2.4u 以上）に、「列の高さは --fit で 4.4u0 より低くしない」。
- 確かめ方: g2.prog.repeat/3（解説の 4 サイズ）・g6.prog.efficient/11・g5.prog.debug-plan/8（問題と解説、1280×720・1536×864）で札 1 枚 2.4u 以上（C29 で 0）、作業領域の scroll-hidden が 0。

#### Y4 教材の静的な検査（単位の札・単元の絵）と DESINGN.md

ファイル: `src/engines/number/number.tsx`（`check` と、graph が使う検査の関数）、`src/engines/number/number.test.ts`、`src/engines/graph/graph.tsx`（`check` から同じ関数を呼ぶ 1 か所だけ）、`src/engines/graph/` のテスト、`src/curriculum/unitIndex.test.ts`、`DESINGN.md`

1. **単位だけの `label` を誤りにする**（点検 2）: 数の欄（`NumberField`。number の `fields`・graph の数の欄）の `label` が、《よみ》と空白を除いて単位だけ（上の 0. の一覧。cm・m・km・mm・cm²・m²・km²・a・ha・cm³・m³・L・dL・mL・g・kg・t・円・%・度・ど・人・にん・こ・個・本・ほん・ぽん・ぼん・まい・枚・かい・回・わ・ひき・びき・ぴき・冊・点・分・ふん・秒・時間・倍・つ・マス・そう・れつ・こずつ・角形・通り・ほ・台）なら、`単位「cm」は label でなく unit に書く（label は回答欄の上・左の見出し。解説で「cm 7」と逆に読める）` を返す。見出し（「じゅうの くらい」「あまり」「商」「約」「□が 4」など）は誤りにしない。
   - 一覧は 1 か所（例 `UNIT_WORDS`）に置き、テストで「見出しの例は通る・単位の例は落ちる」を見る。
   - この検査を足すと、5. の算数 6 パックと prog-g16 の直しが入るまで、61 単元のパックのテスト（`checkUnit`）が落ちる。実装のときは、落ちる単元の一覧が 0. の 61 単元と同じことを確かめて報告する（直すのは 5.）。
2. **単元の絵を登録済みにする検査**（点検 7）: `unitIndex.test.ts` に、全単元の `icon` が `getIllust` で見つかり、`status` が `'final'` であることを足す（本番で赤い破線の枠を出さない）。5. の g1-ja・g6-ja が直すまで 3 単元で落ちる。
3. **DESINGN.md**: 17 章に「第8回の規約（Y1〜Y4・C32・C33）」の項を作り、Y1〜Y3 の「DESINGN.md に書くこと」をまとめる。あわせて次を書く。
   - 18 章の数の入力: `label` は見出し（回答欄の上・左）、`unit` は単位（回答欄の右）。単位を `label` に書かない（1.）。
   - 17 章の `--pic-floor` の項（第7回の残し事項の文）: 選択肢の札で絵が 1 つの札の下限は検査（C32）で 6u（段階を問わない。数える札の列の中の札は 4u）。幼児の 10u は並べ方を選ぶときの目標（4. の受け入れの理由）。
   - 6 章: 単元の `icon` は登録済み（final）の絵（2.）。
- 確かめ方: `npx vitest run src/engines/number src/engines/graph src/curriculum` で 1.・2. のテストが通ること、5. の前のパックのテストが 0. の単元で落ちること。5. のあとに `npx vitest run` が全部通ること。`npm run check:design` が通ること。

### 3. 検査の直し（checkerChanges）

ファイル: `e2e/helpers/text-layout.ts`、`e2e/text-layout-probe.tl.ts`（見本）、`src/dev/UnitSampleView.tsx`（C33）、`docs/test-plan.md`（3.2 に理由を書く）

- **C32 選択肢の札の絵の下限（見落とし。種類は small-figure の (c)）**:
  - 選択肢の札（`.choice`）の中の絵が 1 つで、それが登録の絵（`svg[data-illust]`）のとき、絵の短い辺が 6u 未満なら、札ごとに 1 件出す。detail は「絵が 3.4u（最小 6u・1 つの札）」の形。
  - 同じ選択肢の列に数える札（C29 (a)）があるときは、その列の絵が 1 つの札も数える札として 4u で見る（第7回 X2 は列ごとに数える札として大きさを決める。p5.en.phrases の「1 こ」の札）。
  - 段階を問わず 6u。幼児の 10u は見ない（4. の受け入れ）。パックの SVG の図（時計・図形・札の列）・アイコン（`.tap__icon` など札の中の飾り）は対象外。
  - 単元の札（`.tk-card`）は、この回は対象にしない。札の絵は札の設計の大きさ（5.6u・2〜3 歳 8u・sort の箱の中 4.6u）で、--fit でだけ縮み、多くの札は名前が中身。絵だけの札（g2.life.town の match の左・p23.think.sort の箱の中）の下限は、設計の大きさを改めるかと合わせて次の回に決める（下の「次の回に回すもの」）。
  - 理由: 点検 6。解説で絵と語の札の絵が 3.3〜3.5u になり、正解の輪が緑の点にしか見えないのに、検査は数える札と手順の札しか見ていなかった。6u は DESINGN.md 17 章の幼児以外の `--pic-floor`（V2。選択肢の絵の札の規約）で、1280×620 でも約 66px（絵の形が分かる大きさ）。
- **C33 開発用の画面の `state=` で、聞く問題は最初の再生を待つ（再現の差）**:
  - `StateDriver` は、聞く問題（`.eng-listen` がある画面）では `data-heard="1"`（最初の再生が終わった。音が出せない環境でも `heard` になる）を待ってから、ヒント・つぎへ を押す（待つのは 5 秒まで）。
  - 検査（`text-layout.tl.ts`）は今の流れのまま（ヒントを押す前に 4 サイズを回すので、たいてい再生が終わっている）。必要なら、聞く問題で `data-heard="1"` を待ってからヒントを押す 1 行を足す（今の結果を変えないこと）。
  - 理由: 本当の画面では聞き終わるまで選択肢を押せないので、解説はいつも「もういちど きく」の札。開発用の画面だけ「きいてね」のまま解説になり、検査の結果（g4.en.want/17 の 3.6u）を再現しなかった（Y1 の 1. のあとは札の幅が変わらないので、差は小さくなる）。
- probe に C32 の見本（絵が 1 つで 3u の札・6u の札・数える札の列の中の 4.5u の「1 こ」の札・時計の札・アイコン・絵が 1 つの小さな tk-card）を足し、直す前のコードで (c) の見本が失敗し、ほかは出ないことを確かめる。`docs/test-plan.md` 3.2 に C32・C33 の理由を書く。
- 検査を足さないもの: 第7回 9. の残し事項（check:app-layout が g4.soc.tradition の「地いき／の伝統と…」を出さなかった）。題は第7回で直した。小3以上の札の文節の折れ目は Chrome の `word-break: auto-phrase` が決めていて、検査が同じ区切りを持つには辞書が要る（ほかの字の検査と同じ考えで見ると、漢字の熟語の中で誤検出が多くなる）。今わかっている例は無いので、足さない。
- 緩めていないもの: C32 は出る件が増えるだけ。C33 は開発用の画面の再現を本物の流れに合わせるだけで、検査の判定は変えない。

### 4. 受け入れるもの（accepted）

- 第7回までのもの（そのまま）:
  - 小3以上の地の文（読解の本文・解説の文）の字の間の改行（JIS X 4051。選択肢・札・ボタンの中は今までどおり違反）。
  - 読解の本文の枠と表の解説の板のスクロール（印あり）。答えの行や正解の図が隠れる板は受け入れない。
  - text-on-figure（参考）で、ふりがなが線に少しかかるだけのもの。
  - 検査から外れた 11 単元（legacy。`layout.spec` が受け持つ）。
  - 問題の状態の作業領域の下の空き（第7回 4.）。文や題が分かち書きの空白のところで折れるもの（第7回 9.）。
- **幼児の絵の 10u は目標で、下限は 6u**（点検 6 の「受け入れる範囲をはっきり決め直す」）:
  - 理由: 押す所は札（幼児で 14u×18u 以上）で、絵ではない。6u（1280×620 で約 66px）の絵は形が分かる。10u を下限にすると、幼児の英語の 3 割近い画面（点検の 417 / 1,436）で、作業領域をスクロールの枠にするか札を減らすしかなく、どちらも「幼児の画面では ▼ だけでもスクロールさせない」に反する。
  - 並べ方は、今までどおり `s` が最大のもの（Y1 の 4.）。6u を割るものは C32 で直す。
- **p5.math.measure-compare の塔のつみき（1.06u）**: 高さを比べる問題で、つみきを数える問題ではない。解説を数に頼らない文にする（5. の p5）ので、つみきの大きさは受け入れる。札の図の枠（16u×9u）を縦長の図のために高くするのは、order の札の高さが変わる（ほかの単元の札が動く）ので、この回はしない。

次の回に回すもの（受け入れではない）: 単元の札（`.tk-card`）の絵だけの札の大きさ。g2.life.town の match の左の建物の絵（3.6〜5.05u。屋根の小さな印で見分ける絵）と、p23.think.sort の解説の箱の中の絵（4.6u。問題の状態は 8u）。札の絵は札の設計の大きさ（`.tk-card__illust` 5.6u など）で決まり、match の 4 組は作業領域の高さ（26.3u）で行の高さが決まるので、直すには札の設計の大きさか並べ方を変える（sort・match・order の札がそろって動く）。この回の直し（Y1〜Y4）と同じファイルにならないよう、C32 の結果と合わせて次の回で決める。

受け入れないもの（この回で直す）: 数える絵が 4u・選択肢の札の絵が 6u・手順の札と盤のますが 2.4u に足りないもの、単位が回答欄の前に来るもの、解説が画面と食い違うもの（life-g12 の sort・p5.think.why の描く問題・塔の数）、本番で赤い破線の枠が出るもの、文の後ろの「。・」。

### 5. このラウンドで直すもの（content。パックごと）

systemic のファイル（エンジン・`src/units`・`src/dev`・`src/curriculum` のテスト・DESINGN.md）は触らない。教材の文を変えたら `npm run voice:packs` を流す（改行だけ変わった JSON は戻す）。英語の文を変えたら `src/packs/<p>/script-en.json` と `voice/script-en.json` も合わせる。学年の漢字・《よみ》・分かち書き・ヒントと解説の対応は保つ。`icon` を変えたら `npm run build:unit-index` を流す。

**単位の札を `unit` にする**（算数 6 パックと prog-g16。点検 2・Y4 の 1.）:
- 単位だけの `label` を `unit` に移す（回答欄の右）。見出しと単位をまとめた札は分ける（g3.math.division-remainder の「あまり（まい）」→ `label: 'あまり'`・`unit: 'まい'`、「あまり（cm）」も同じ）。答えが `quantity` のときは、`unit` があると答えの値の単位を重ねない（今のエンジンのまま）。
- 誤答の例・ヒント・解説の文は変えない（欄の数と順は同じ）。問題文に「□kg□g」のような書き方があれば、欄の並びと合うことを確かめる。
- 確かめ方: Y4 の 1. の検査（パックのテスト）が通る。直した単元の代表を開発用の画面で開き、解説で「[7] cm²」の順、問題の状態で単位が回答欄の右・回答欄が作業領域に入ること（4 サイズ。札つきの回答欄が 4 つ以上の `--many` の問題を含む）。

- **g1-math**（`src/packs/g1-math/**`）: add-basic・add-carry・sub-borrow・add-sub-2digit・three-numbers の単位の札。
- **g2-math**（`src/packs/g2-math/**`）: sub-column・mult-meaning（「こずつ」「れつ」）・mult-beyond・length・volume・time・fraction-simple の単位の札。
- **g3-math**（`src/packs/g3-math/**`）: division-basic・division-remainder・decimals・fractions・box-expression・circle-sphere・triangles・length-km・weight・time・bar-graph（graph の欄）の単位の札。
- **g4-math**（`src/packs/g4-math/**`）:
  - decimal-int・fraction-same・quadrilaterals・cuboid・area・angle・ratio-intro・two-way-table・line-graph（graph の欄）の単位の札。
  - g4.math.area の count（`cellsFig(cells, 7, 7)`）: 方眼を形の外接の長方形 ＋ まわり 1 ますにする（形の位置もそれに合わせてずらす）。広さくらべ（alt の 13×7）・単位の関係の図も、空きが半分を超えるなら同じ考えで詰める。単位の札を `unit` にしたうえで、/0・/1 の問題・ヒント・解説（4 サイズ）で方眼のますが 2.4u 以上（C29 で 0）。まわりの長さの誤答（perimeter）の計算は形だけから決まるので変わらない。
- **g5-math**（`src/packs/g5-math/**`）: multiples-divisors・decimal-div・congruence・angle-sum・polygon-circle（「角形」）・area-formulas・volume・proportion-simple・per-unit・speed・percent・pie-band・average（graph の欄を含む）の単位の札。
- **g6-math**（`src/packs/g6-math/**`）: scale・circle-area・prism-volume・proportion（graph の欄を含む）・inverse・representative（/4 の graph の「冊」を含む）・frequency・combinations（「通り」）の単位の札。
- **prog-g16**（`src/packs/prog-g16/**`）:
  - repeat・decompose・prefecture-finder・draw-shapes・polygon・debug-plan・sensor・efficient の単位の札（「かい」「まい」「ど」「マス」「こ」「つ」）。
  - g2.prog.repeat の pattern-alt（/28・/30）の盤: `gridFigure(..., { hU: 10 })` を 12 にする（4×4 の盤で 1 ます 3u）。Y2・単位の札の直しと合わせて、問題・ヒント①〜③の 4 サイズで、盤のます 2.4u 以上（C29 で 0）・作業領域に入ること。
  - g2.prog.repeat の find の解説（`「…」は「…」と おなじ うごきだよ。おなじ ならびは「くりかえす」で まとめられるよ。`）を、解説の板（72u）で 2 行に入る長さにする。例: 「「…」を くりかえすと、「…」と おなじ うごきに なるよ。」（並びを 1 回だけ言う）。/3 の 4 サイズで板が 2 行・手順の札 2.4u 以上（Y3 と合わせて C29 で 0）。
- **life-g12**（`src/packs/life-g12/**`）:
  - `sortItem` で札を黙って減らすのをやめる（`fitSortCards` を、入る枚数を超える札が書いてあれば例外にする確かめに替える）。18 問（seasons の compare-alt-s1〜s3、school-safety の 2 組、town・animals・plant-diary の別例）の `cards` を、出す札（箱 4 つなら 1 枚ずつ、2 つなら 2 枚ずつ）だけにし、解説をその札だけで言う文にする。例: compare-alt-s1 は「はるは さくら、なつは うきわ、あきは もみじ、ふゆは ゆき。いっぱんてきな れいだよ。」。
  - どの札を残すかは、今の `fitSortCards` が出している札（字の少ないもの）を基本にし、絵のある札を優先してよい。誤答の箱の誤概念・ヒントは変えない。
  - テスト（`life-g12.test.ts`）に、sort の解説に出る札の名前がすべて画面の札にあること（または、解説に札の名前でない語だけが出ること）を足す。
  - 確かめ方: seasons/15・school-safety/9（1280×620）・town/15 の解説で、名指した札がすべて画面にある。作業領域に入る（4 サイズ）。
- **p5**（`src/packs/p5/**`）:
  - why.ts（点検 4）: 描く問題 6 問（rain-stop・snowman・seed・icecream・balloon・frog）の解説を、描けたことを前提にしない文にする。問題ごとに「この あと」の例を 1 つ言い、おうちの人に話す誘いで終える。例: snowman「おひさまが あたると、ゆきだるまは とけて ちいさく なるね。どう なると おもったか、おうちの ひとに おはなし してね。」。ヒント①②と食い違わないこと。
  - measure-compare.ts（点検 9）: 塔の問題（tower）の解説を、数に頼らない文にする。例: 「したを そろえて くらべると、ひだりから たかい じゅんだね。」（解説では札が正しい順に並ぶ）。ヒント②「したは そろって いるよ。うえの はしを くらべよう。」と対応させる。
  - numbers-10.ts（点検 6）: ord の問題（/4・/5 ほか。動物の名前の札）の札の絵が、問題の状態（1280×620）で 4.8u。主の図（動物の列）の何番目かを選ぶ問題なので、札を絵だけにする（名前の行の約 4.5u が絵に回り、札の高さ 11.3u のままで絵が約 9u）。名前だけの札にはしない（5 さいは字を読めない子がいる。主の図と同じ絵で選べるほうがよい）。札の読み上げの名前（aria-label）と解説が動物の名前を言うこと、誤答の誤概念（off-by-one-ord など）の説明が変わらないこと。4 サイズの問題・ヒント・解説で C32 の 6u を割らないこと。
- **en-g34**（`src/packs/en-g34/**`）: numbers-colors の絵を選ぶ問題（num-pic。答えが 10 以下で絵の数を数える）の誤答を 10 以下にする。今 11 が出るのは num-pic:7 だけ（`SAME_START[7]` の 11）。数の札の問題（num:7）の誤答の 11 は変えない（字の札なので行が増えない）。代わりの数は、6（same-start）と、絵を数えまちがえやすい隣の数（8）など。誤概念の説明が絵の問題に合うこと（teen-near の「ブロックを かぞえなおそう」は絵の問題に合わないので、使うなら説明を絵にも合う文にするか、別の誤概念を足す）。/26 の解説（4 サイズ）で数える絵 4u 以上（Y1 と合わせて C29 で 0）。英語の音声・台本は変わらない（数の読みは同じ）。
- **g1-ja**（`src/packs/g1-ja/**`）: folktales の `icon: 'book'` を `'p5-book'`、word-play の `'music-note'` を `'p5-note'` にする（Y4 の 2.）。
- **g6-ja**（`src/packs/g6-ja/**`）: language-change の `icon: 'book'` を `'p5-book'` にする。
  - 確かめ方（g1-ja・g6-ja）: `npm run build:unit-index`。`npm run check:app-layout`（自分のポートの一時の設定）で missing-illust が 0。

パックを変えないもの（共通の直しで直る）: en-g34 の g4.en.want/17（Y1）、g1-ja の listen・g3-ja の listen-memo・p4 の story-listen・en-pre の first-sound（Y1・C32）、p5.think.pattern・p5.math.shapes の札の中の図（Y1 の 7.）、prog-g16 の efficient・debug-plan の札の列（Y3）。

### 6. 点検の指摘の扱い（1〜9）

| 点検 | 内容 | 扱い |
|---|---|---|
| 1 | small-figure の 11 件 | g2.prog.repeat → Y2・Y3・prog-g16（盤 hU・解説・単位の札）／g3.en.numbers-colors → en-g34（11 この誤答）・Y1／g4.en.want → Y1（「きく」の札の幅・書き起こしの枠の幅）／g4.math.area → g4-math（方眼・単位の札） |
| 2 | 単位が回答欄の前に来る（61 単元） | 算数 6 パック・prog-g16 で `unit` に移す。Y4 の 1. で再発を止める |
| 3 | life-g12 の sort の解説が画面と食い違う（18 問） | life-g12（札を減らさない・解説を出す札で言う・テスト） |
| 4 | p5.think.why の描く問題の解説 | p5（描けたことを前提にしない文） |
| 5 | 札の中のパックの図が左に寄る | Y1 の 7. |
| 6 | 聞いて選ぶ問題の解説で絵と輪が小さい・絵が 1 つの札の下限 | Y1（1.〜4.）・C32（6u）・C33。p5.math.numbers-10 は p5。幼児の 10u は 4. で目標とする |
| 7 | 赤い破線の枠（missing-illust） | g1-ja・g6-ja（登録済みの絵）・Y4 の 2. |
| 8 | 書き起こしの「。・」 | Y1 の 6. |
| 9 | 塔のつみき 1.06u と解説の数 | p5（解説を数に頼らない文）。つみきの大きさは 4. で受け入れる |

### 7. 確かめ方（全体）

- systemic（Y1〜Y4）・検査（C32・C33）・content のあとで、`MNW_FRESH=1 npm run check:text-layout` を全単元で流す（`MNW_WORKERS` は 2〜4）。失敗した単元 0・errors 0 を確かめてから件数を見る。
- C32 は初めて全単元を見るので、点検の単元のほかにも出てよい（1280×620 の 10 単元の測りでは、数える札の無い列の 6u 未満は 10 画面で、どれも Y1 か p5 の直しの対象）。出たものは次の回で同じように原因を分ける。
- Y2 で、数の入力の問題文が 2 行の問題とヒントの状態の --fit が 1 に戻るので、図と回答欄が今より大きくなる。overlap-button・covered・out-of-stage が増えないことを見る。
- `npm run check:app-layout` も流し、missing-illust が 0、新しく増えた種類が無いことを確かめる。
- `npx vitest run`（Y4 の検査が全パックで通る）・`npm run check:packs`・`npm run check:design`。
