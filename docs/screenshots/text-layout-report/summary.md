# 文字の配置の検査（text-layout）の要約

作成: 2026-10-30T15:29:05.030Z ／ 単元 247 ／ 問題 7382（見本 7382 問中） ／ 画面 143512（問題 × 状態 × 画面サイズ）
seed: 2 ／ 問題数の上限: なし ／ 所要（各単元の合計）2.4 時間・経過 23.8 分（最後に流した分）

再現: `npm run dev` で `#/dev/unit/<単元ID>/<n>?seeds=2&state=h2` を開く（state: q / h1〜h3 / explain）。画面サイズは下の表の値に合わせる。
件数: 「件」は同じ単元・種類・文字列・要素を1件に数えた数（問題の番号・サイズ・状態が違っても1件）、「画面」は延べの数。

## 種類別

| 種類 | | 件 | 画面 | 単元 |
|---|---|---:|---:|---:|
| out-of-stage | 舞台の外にはみ出し | 1674 | 46810 | 66 |
| clipped | 親の枠で切れる | 3753 | 32259 | 164 |
| scroll-hidden | スクロールしないと見えない | 6474 | 223741 | 109 |
| overlap-text | 文字どうしの重なり | 16921 | 168724 | 139 |
| covered | 文字・ボタンが隠れる | 6424 | 67934 | 124 |
| text-on-figure | 文字が図に重なる（参考） | 147 | 548 | 16 |
| overlap-button | ボタンどうしの重なり | 817 | 10512 | 63 |
| kinsoku-start | 行頭禁則 | 364 | 6430 | 98 |
| kinsoku-end | 行末禁則 | 3 | 36 | 3 |
| orphan | 最後の行が1文字 | 593 | 11485 | 85 |
| wakachi-split | 分かち書きの語の途中で改行 | 1850 | 33821 | 88 |
| word-split | 語・数・単位の途中で改行 | 185 | 4128 | 64 |
| button-split | ボタン・選択肢の中で語が折れる | 1905 | 25743 | 67 |
| narrow-wrap | 極端に狭い折り返し | 157 | 1447 | 26 |
| small-text | 文字が小さすぎる | 3677 | 117416 | 198 |

## 画面サイズ別（画面の延べ数）

| 種類 | 1280×720 | 1920×1080 | 1280×620 | 1536×864 |
|---|---:|---:|---:|---:|
| out-of-stage | 11636 | 11570 | 11910 | 11694 |
| clipped | 8237 | 8260 | 7866 | 7896 |
| scroll-hidden | 55895 | 55960 | 56030 | 55856 |
| overlap-text | 41994 | 42212 | 41917 | 42601 |
| covered | 16655 | 16572 | 17361 | 17346 |
| text-on-figure | 158 | 117 | 156 | 117 |
| overlap-button | 2597 | 2692 | 2536 | 2687 |
| kinsoku-start | 1600 | 1595 | 1619 | 1616 |
| kinsoku-end | 9 | 9 | 9 | 9 |
| orphan | 2860 | 2860 | 2890 | 2875 |
| wakachi-split | 8456 | 8455 | 8455 | 8455 |
| word-split | 1034 | 1035 | 1026 | 1033 |
| button-split | 6435 | 6435 | 6455 | 6418 |
| narrow-wrap | 366 | 366 | 349 | 366 |
| small-text | 32343 | 28439 | 28281 | 28353 |

## 状態別（画面の延べ数）

| 種類 | 問題 | ヒント① | ヒント② | ヒント③ | 解説 |
|---|---:|---:|---:|---:|---:|
| out-of-stage | 9760 | 9772 | 9772 | 9756 | 7750 |
| clipped | 2278 | 2278 | 2278 | 2211 | 23214 |
| scroll-hidden | 43287 | 43228 | 43110 | 43114 | 51002 |
| overlap-text | 24879 | 31172 | 32289 | 34177 | 46207 |
| covered | 7600 | 13678 | 14195 | 14290 | 18171 |
| text-on-figure | 0 | 56 | 192 | 122 | 178 |
| overlap-button | 1413 | 1413 | 2777 | 2709 | 2200 |
| kinsoku-start | 1133 | 1133 | 1177 | 1177 | 1810 |
| kinsoku-end | 8 | 8 | 8 | 8 | 4 |
| orphan | 2237 | 2237 | 2237 | 2237 | 2537 |
| wakachi-split | 4512 | 5520 | 7201 | 5728 | 10860 |
| word-split | 747 | 751 | 755 | 791 | 1084 |
| button-split | 5193 | 5193 | 5193 | 5193 | 4971 |
| narrow-wrap | 209 | 209 | 209 | 209 | 611 |
| small-text | 16460 | 29945 | 29660 | 17611 | 23740 |

## 単元別（件の多い順。上位 60）

| 単元 | エンジン | 問題 | 計 | 内訳 |
|---|---|---:|---:|---|
| g6.ja.write-opinion | order | 39 | 2181 | overlap-text 999、out-of-stage 338、covered 309、clipped 202、overlap-button 108、button-split 106、scroll-hidden 103、small-text 8、kinsoku-start 7、orphan 1 |
| g5.ja.write-fact-opinion | sort | 34 | 1869 | overlap-text 1128、covered 238、out-of-stage 223、button-split 86、clipped 76、scroll-hidden 58、overlap-button 50、kinsoku-start 6、small-text 4 |
| g3.ja.proverbs | choice | 88 | 1791 | overlap-text 894、covered 366、clipped 231、button-split 94、scroll-hidden 75、small-text 45、orphan 36、overlap-button 30、kinsoku-start 14、out-of-stage 5、narrow-wrap 1 |
| g4.ja.idioms | match | 114 | 1764 | overlap-text 954、covered 229、button-split 179、clipped 123、overlap-button 93、scroll-hidden 81、out-of-stage 36、kinsoku-start 22、orphan 20、narrow-wrap 16、small-text 10、text-on-figure 1 |
| g4.ja.write-report | sort | 36 | 1677 | overlap-text 897、out-of-stage 210、covered 201、button-split 162、clipped 82、overlap-button 69、scroll-hidden 43、small-text 7、kinsoku-start 5、orphan 1 |
| g3.ja.write-reasons | choice | 42 | 1412 | overlap-text 761、covered 278、clipped 161、button-split 83、overlap-button 45、scroll-hidden 39、small-text 32、kinsoku-start 10、out-of-stage 3 |
| g5.ja.figurative | choice | 39 | 1185 | overlap-text 847、covered 195、out-of-stage 45、scroll-hidden 36、overlap-button 24、button-split 14、clipped 11、small-text 9、orphan 3、text-on-figure 1 |
| g6.ja.classics-read | listen | 37 | 1002 | overlap-text 357、scroll-hidden 266、clipped 176、covered 93、button-split 40、small-text 19、orphan 17、overlap-button 13、out-of-stage 11、kinsoku-start 5、narrow-wrap 4、word-split 1 |
| g6.soc.politics | choice | 45 | 947 | overlap-text 603、covered 192、small-text 47、clipped 37、overlap-button 23、button-split 22、out-of-stage 11、orphan 6、scroll-hidden 2、kinsoku-start 2、word-split 1、narrow-wrap 1 |
| g4.ja.info-compare | choice | 38 | 896 | overlap-text 550、scroll-hidden 139、covered 117、out-of-stage 23、button-split 16、overlap-button 10、orphan 10、clipped 9、small-text 8、kinsoku-start 8、word-split 5、kinsoku-end 1 |
| g3.ja.read-paragraphs | reading | 45 | 895 | scroll-hidden 317、overlap-text 314、covered 115、button-split 54、out-of-stage 39、small-text 25、clipped 13、kinsoku-start 8、overlap-button 6、orphan 4 |
| g3.soc.shop-work | choice | 32 | 881 | overlap-text 570、covered 172、button-split 40、out-of-stage 31、overlap-button 23、small-text 22、orphan 8、clipped 5、narrow-wrap 5、kinsoku-start 4、text-on-figure 1 |
| g6.ja.info-relations | match | 35 | 862 | overlap-text 565、covered 104、clipped 79、button-split 31、orphan 18、kinsoku-start 16、overlap-button 15、out-of-stage 14、scroll-hidden 13、narrow-wrap 4、small-text 3 |
| g6.soc.history-3 | reading | 32 | 710 | overlap-text 316、scroll-hidden 111、covered 97、small-text 45、clipped 45、button-split 37、overlap-button 28、out-of-stage 16、orphan 6、word-split 5、kinsoku-start 3、narrow-wrap 1 |
| g6.soc.history-1 | reading | 32 | 707 | overlap-text 376、scroll-hidden 102、covered 86、small-text 34、clipped 34、overlap-button 26、button-split 22、out-of-stage 14、orphan 8、kinsoku-start 2、narrow-wrap 2、word-split 1 |
| g6.soc.history-2 | reading | 32 | 699 | overlap-text 342、scroll-hidden 111、covered 92、small-text 45、clipped 31、button-split 23、out-of-stage 21、overlap-button 19、orphan 9、kinsoku-start 3、word-split 2、narrow-wrap 1 |
| g5.ja.text-figure | reading | 42 | 698 | scroll-hidden 258、overlap-text 152、out-of-stage 72、covered 49、clipped 46、small-text 42、button-split 32、orphan 20、word-split 15、kinsoku-start 7、overlap-button 5 |
| g6.ja.read-literature | reading | 33 | 626 | scroll-hidden 342、clipped 197、button-split 52、small-text 12、kinsoku-start 12、orphan 9、overlap-text 2 |
| g5.ja.honorifics | choice | 52 | 590 | overlap-text 400、covered 85、clipped 34、button-split 18、out-of-stage 17、orphan 11、scroll-hidden 9、kinsoku-start 9、small-text 5、overlap-button 2 |
| g3.soc.city-changes | order | 34 | 582 | overlap-text 321、covered 139、small-text 35、out-of-stage 30、orphan 17、button-split 15、overlap-button 12、clipped 5、kinsoku-start 4、word-split 4 |
| g4.ja.read-summary | reading | 45 | 574 | scroll-hidden 293、overlap-text 110、button-split 85、covered 53、clipped 18、small-text 8、kinsoku-start 7 |
| g5.ja.read-gist | reading | 35 | 573 | scroll-hidden 309、clipped 82、button-split 74、overlap-text 56、out-of-stage 22、small-text 11、covered 10、kinsoku-start 4、orphan 2、overlap-button 2、word-split 1 |
| g5.ja.read-relations | reading | 33 | 571 | scroll-hidden 348、clipped 138、button-split 53、kinsoku-start 15、orphan 13、small-text 4 |
| g6.soc.world | choice | 44 | 564 | overlap-text 319、covered 145、clipped 31、small-text 22、button-split 20、overlap-button 6、scroll-hidden 6、orphan 6、out-of-stage 6、word-split 1、kinsoku-start 1、narrow-wrap 1 |
| g6.ja.read-argument | reading | 33 | 557 | scroll-hidden 278、clipped 207、button-split 52、small-text 10、orphan 9、kinsoku-start 1 |
| g3.ja.read-character | reading | 36 | 548 | scroll-hidden 336、clipped 87、overlap-text 43、button-split 40、small-text 19、orphan 13、kinsoku-start 10 |
| g4.ja.read-feelings | reading | 46 | 518 | scroll-hidden 335、clipped 85、button-split 56、kinsoku-start 15、small-text 14、orphan 13 |
| g5.en.read-words | listen | 385 | 487 | scroll-hidden 164、clipped 132、narrow-wrap 83、orphan 68、button-split 34、kinsoku-start 5、word-split 1 |
| g2.ja.read-info | reading | 36 | 482 | scroll-hidden 275、wakachi-split 99、small-text 40、overlap-text 40、button-split 20、orphan 4、kinsoku-start 3、clipped 1 |
| g2.ja.read-story | reading | 43 | 479 | scroll-hidden 293、wakachi-split 100、small-text 38、overlap-text 31、kinsoku-start 8、button-split 5、orphan 2、clipped 2 |
| g1.ja.read-info | reading | 36 | 478 | scroll-hidden 256、wakachi-split 94、out-of-stage 52、overlap-text 31、covered 25、button-split 12、small-text 4、orphan 3、kinsoku-start 1 |
| g1.ja.read-story | reading | 35 | 453 | scroll-hidden 259、wakachi-split 102、out-of-stage 42、overlap-text 24、covered 14、button-split 7、small-text 4、kinsoku-start 1 |
| g5.soc.land | choice | 51 | 433 | overlap-text 225、covered 107、small-text 52、word-split 13、orphan 12、clipped 11、out-of-stage 7、overlap-button 4、button-split 1、kinsoku-start 1 |
| g4.soc.water-waste | choice | 32 | 427 | overlap-text 256、covered 114、small-text 35、clipped 12、overlap-button 3、orphan 2、kinsoku-start 1、scroll-hidden 1、text-on-figure 1、word-split 1、out-of-stage 1 |
| g4.sci.weather | experiment | 27 | 387 | overlap-text 179、covered 102、out-of-stage 38、small-text 16、orphan 15、clipped 11、button-split 8、overlap-button 7、word-split 7、kinsoku-start 3、scroll-hidden 1 |
| g4.soc.disaster | choice | 30 | 383 | overlap-text 212、covered 105、small-text 20、clipped 19、overlap-button 14、button-split 7、orphan 3、scroll-hidden 2、out-of-stage 1 |
| p5.ja.story-listen | listen | 38 | 354 | wakachi-split 122、covered 91、overlap-text 72、small-text 48、out-of-stage 15、kinsoku-start 5、overlap-button 1 |
| g4.soc.prefectures | map | 222 | 345 | overlap-text 143、covered 111、small-text 83、clipped 8 |
| g3.sci.circuits | experiment | 27 | 320 | overlap-text 165、covered 91、small-text 20、overlap-button 12、out-of-stage 12、button-split 7、orphan 7、kinsoku-start 4、clipped 2 |
| g5.soc.food | choice | 46 | 315 | overlap-text 125、covered 88、small-text 44、clipped 15、out-of-stage 10、orphan 9、button-split 6、overlap-button 6、word-split 6、kinsoku-start 4、scroll-hidden 1、text-on-figure 1 |
| g6.sci.combustion | choice | 27 | 313 | overlap-text 159、covered 88、out-of-stage 22、small-text 17、overlap-button 11、orphan 7、button-split 5、kinsoku-start 2、clipped 1、word-split 1 |
| g5.sci.pendulum | experiment | 27 | 297 | overlap-text 165、covered 82、small-text 20、out-of-stage 14、overlap-button 9、kinsoku-start 2、clipped 2、word-split 2、button-split 1 |
| g5.ja.sentence-relations | choice | 41 | 277 | overlap-text 174、covered 45、clipped 33、scroll-hidden 17、overlap-button 4、kinsoku-start 3、small-text 1 |
| g3.ja.reference-connectives | choice | 43 | 275 | overlap-text 115、scroll-hidden 101、covered 31、small-text 13、kinsoku-start 5、clipped 4、button-split 3、orphan 2、kinsoku-end 1 |
| g2.ja.write-structure | sort | 39 | 263 | wakachi-split 67、button-split 61、covered 50、overlap-text 39、out-of-stage 14、overlap-button 10、clipped 9、scroll-hidden 6、small-text 4、kinsoku-start 3 |
| g5.soc.industry | choice | 44 | 250 | overlap-text 109、covered 79、small-text 46、overlap-button 8、clipped 4、button-split 2、kinsoku-start 1、word-split 1 |
| g5.ja.word-structure | choice | 53 | 245 | overlap-text 90、clipped 54、small-text 32、covered 29、scroll-hidden 16、orphan 9、button-split 7、overlap-button 4、kinsoku-start 4 |
| g5.sci.dissolve | experiment | 27 | 229 | overlap-text 123、covered 75、small-text 14、out-of-stage 7、orphan 5、overlap-button 2、button-split 2、kinsoku-start 1 |
| g4.sci.moon-stars | experiment | 27 | 228 | overlap-text 134、covered 65、out-of-stage 10、small-text 9、kinsoku-start 3、orphan 2、button-split 2、overlap-button 2、clipped 1 |
| g6.en.past | listen | 60 | 228 | clipped 58、covered 58、scroll-hidden 55、overlap-text 31、overlap-button 7、button-split 6、out-of-stage 4、orphan 4、kinsoku-start 3、text-on-figure 2 |
| g4.en.time-days | listen | 47 | 225 | overlap-text 68、out-of-stage 48、covered 38、text-on-figure 28、clipped 23、scroll-hidden 13、overlap-button 7 |
| g4.sci.air-water | experiment | 27 | 211 | overlap-text 100、covered 80、out-of-stage 11、overlap-button 7、small-text 6、button-split 3、orphan 2、clipped 1、word-split 1 |
| g4.sci.current | experiment | 29 | 211 | overlap-text 114、covered 64、small-text 13、out-of-stage 10、button-split 4、overlap-button 4、kinsoku-start 1、clipped 1 |
| g5.sci.germination | experiment | 27 | 207 | overlap-text 118、covered 69、small-text 11、overlap-button 5、out-of-stage 2、kinsoku-start 1、clipped 1 |
| g6.sci.electricity-use | experiment | 27 | 207 | overlap-text 130、covered 52、small-text 8、button-split 5、overlap-button 4、orphan 3、kinsoku-start 2、out-of-stage 2、narrow-wrap 1 |
| g3.math.mult-2digit | number | 8 | 205 | overlap-text 102、covered 46、scroll-hidden 31、clipped 25、small-text 1 |
| g6.sci.lever | choice | 27 | 199 | overlap-text 120、covered 47、small-text 14、overlap-button 6、out-of-stage 4、button-split 4、orphan 2、clipped 1、word-split 1 |
| g3.sci.magnets | experiment | 28 | 191 | covered 81、overlap-text 75、small-text 9、out-of-stage 8、overlap-button 7、kinsoku-start 4、button-split 3、orphan 3、clipped 1 |
| g4.ja.plain-polite-style | choice | 40 | 183 | overlap-text 88、covered 62、clipped 9、small-text 7、overlap-button 6、button-split 5、out-of-stage 4、scroll-hidden 1、kinsoku-start 1 |
| g5.sci.weather-change | choice | 27 | 176 | overlap-text 99、covered 56、out-of-stage 6、overlap-button 6、button-split 4、small-text 3、kinsoku-start 1、clipped 1 |

違反のない単元: 1 / 247

## 代表例（種類ごとに 8 件まで。単元が重ならないように選ぶ）

### out-of-stage（舞台の外にはみ出し）

- **g1.ja.listen** n=12・1280×720・問題 ほか 63 画面: 「こたえあわせ」 — `button[check].tap.tap--main` [画像](shots/out-of-stage/g1.ja.listen__12__1280x720__q.png)
- **g1.ja.read-info** n=33・1536×864・問題 ほか 19 画面: 「①おいしいおにぎりのつくりかたをしょうかいしま」 — `span.rt` [画像](shots/out-of-stage/g1.ja.read-info__33__1536x864__q.png)
- **g1.ja.read-story** n=33・1536×864・問題 ほか 39 画面: 「山」 — `ruby` [画像](shots/out-of-stage/g1.ja.read-story__33__1536x864__q.png)
- **g1.ja.sentence-build** n=27・1536×864・問題 ほか 4 画面: 「いぬがほえる。」 — `span.rt` [画像](shots/out-of-stage/g1.ja.sentence-build__27__1536x864__q.png)
- **g1.math.numbers-120** n=0・1280×720・解説 ほか 5 画面: 「2ばんめの こたえ から」 — `button[field-1].eng-number__box.is-revealed` [画像](shots/out-of-stage/g1.math.numbers-120__0__1280x720__explain.png)
- **g1.math.position** n=2・1280×720・問題 ほか 19 画面: 「うえから3だんめ、ひだりから1ばんめ」 — `span.rt` [画像](shots/out-of-stage/g1.math.position__2__1280x720__q.png)
- **g2.ja.write-structure** n=0・1280×720・問題 ほか 15 画面: 「きのう、うんどうかいが ありました。」 — `button[card-0].tk-card`
- **g2.math.fraction-simple** n=54・1280×720・問題 ほか 39 画面: 「けす」 — `button[key-back].numkey.numkey--fn`

### clipped（親の枠で切れる）

- **g1.ja.kanji-read-g1** n=1・1536×864・解説 ほか 3 画面: 「見」 — `ruby ⊂ div[explain].unit__explain`（スクロールの枠の上・左にはみ出し（スクロールしても見えない）） [画像](shots/clipped/g1.ja.kanji-read-g1__1__1536x864__explain.png)
- **g1.ja.punctuation** n=16・1280×720・解説 ほか 3 画面: 「「おはよう。」といいました。はなしたことばは」 — `span.rt ⊂ div[explain].unit__explain`（スクロールの枠の上・左にはみ出し（スクロールしても見えない）） [画像](shots/clipped/g1.ja.punctuation__16__1280x720__explain.png)
- **g1.ja.write-order** n=16・1280×720・解説 ほか 3 画面: 「1.ともだちとあそぶやくそくをしました。2.こうえ」 — `span.rt ⊂ div[explain].unit__explain`（スクロールの枠の上・左にはみ出し（スクロールしても見えない）） [画像](shots/clipped/g1.ja.write-order__16__1280x720__explain.png)
- **g1.life.plant-diary** n=0・1280×720・解説 ほか 35 画面: 「よくみて、かんじたことをかいたね。かんさつきろ」 — `span.rt ⊂ div[explain].unit__explain`（スクロールの枠の上・左にはみ出し（スクロールしても見えない）） [画像](shots/clipped/g1.life.plant-diary__0__1280x720__explain.png)
- **g1.life.school-safety** n=16・1280×720・解説 ほか 3 画面: 「くるまのかげはみえにくいから、とびださないよ。」 — `span.rt ⊂ div[explain].unit__explain`（スクロールの枠の上・左にはみ出し（スクロールしても見えない）） [画像](shots/clipped/g1.life.school-safety__16__1280x720__explain.png)
- **g1.life.seasons** n=6・1280×720・問題 ほか 15 画面: 「すずしい（あたたかい）」 — `button[reason-0].choice.eng-explain__reason ⊂ div.eng-explain__side`（スクロールの枠の上・左にはみ出し（スクロールしても見えない）） [画像](shots/clipped/g1.life.seasons__6__1280x720__q.png)
- **g1.math.compare-quantity** n=0・1280×720・問題 ほか 79 画面: 「あ」 — `text ⊂ svg`
- **g1.math.compose-10** n=1・1536×864・解説 ほか 3 画面: 「2」 — `svg ⊂ div[explain].unit__explain`（スクロールの枠の上・左にはみ出し（スクロールしても見えない））

### scroll-hidden（スクロールしないと見えない）

- **g1.ja.kanji-read-g1** n=1・1536×864・解説 ほか 3 画面: 「学」 — `ruby ⊂ div[explain].unit__explain` [画像](shots/scroll-hidden/g1.ja.kanji-read-g1__1__1536x864__explain.png)
- **g1.ja.punctuation** n=16・1280×720・解説 ほか 7 画面: 「はかぎのなかにうつよ。」 — `span.rt ⊂ div[explain].unit__explain` [画像](shots/scroll-hidden/g1.ja.punctuation__16__1280x720__explain.png)
- **g1.ja.read-info** n=0・1280×720・問題 ほか 126 画面: 「ん」 — `span.rt ⊂ section[reading-passage].eng-reading__passage.eng-reading__passage--l` [画像](shots/scroll-hidden/g1.ja.read-info__0__1280x720__q.png)
- **g1.ja.read-story** n=0・1280×720・問題 ほか 88 画面: 「大」 — `ruby ⊂ section[reading-passage].eng-reading__passage.eng-reading__passage--l` [画像](shots/scroll-hidden/g1.ja.read-story__0__1280x720__q.png)
- **g1.ja.write-order** n=16・1280×720・解説 ほか 3 画面: 「した。」 — `span.rt ⊂ div[explain].unit__explain` [画像](shots/scroll-hidden/g1.ja.write-order__16__1280x720__explain.png)
- **g1.life.plant-diary** n=0・1280×720・解説 ほか 35 画面: 「よ。」 — `span.rt ⊂ div[explain].unit__explain` [画像](shots/scroll-hidden/g1.life.plant-diary__0__1280x720__explain.png)
- **g1.life.school-safety** n=16・1280×720・解説 ほか 3 画面: 「るのは、なるべくやめようね。」 — `span.rt ⊂ div[explain].unit__explain`
- **g1.life.seasons** n=6・1280×720・問題 ほか 47 画面: 「できた」 — `button[done-button].tap.tap--main ⊂ div.eng-explain__side`

### overlap-text（文字どうしの重なり）

- **g1.ja.listen** n=6・1280×720・解説 ほか 3 画面: 「りません。｜「ぼうしはいりません。」といっていたね。みずぎ」 — `span.rt と span.rt`（13u×1.1u） [画像](shots/overlap-text/g1.ja.listen__6__1280x720__explain.png)
- **g1.ja.particles** n=40・1280×720・問題 ほか 19 画面: 「うえのぶんにはまちがいがあるよ。ただしくなおしたぶんはど｜ぼくわこうえんえいく。」 — `span.rt と span.rt`（60.1u×2.3u） [画像](shots/overlap-text/g1.ja.particles__40__1280x720__q.png)
- **g1.ja.read-info** n=33・1536×864・問題 ほか 19 画面: 「「おにぎりのつくりかた」をよんで、せつめいのじゅんにカード｜て」 — `span.rt と rt`（3.6u×1.8u） [画像](shots/overlap-text/g1.ja.read-info__33__1536x864__q.png)
- **g1.ja.read-story** n=12・1280×720・問題 ほか 31 画面: 「お｜正月」 — `span.rt と ruby`（0.3u×2.6u） [画像](shots/overlap-text/g1.ja.read-story__12__1280x720__q.png)
- **g1.ja.sentence-build** n=36・1280×720・問題 ほか 19 画面: 「「だれが」と「どうする」がそろったぶんはどれ？｜ねむる。」 — `span.rt と span.rt`（12.8u×2.1u） [画像](shots/overlap-text/g1.ja.sentence-build__36__1280x720__q.png)
- **g1.ja.write-order** n=15・1536×864・問題 ほか 15 画面: 「う。｜いえにはいって、てをあたた」 — `span.rt と span.rt`（6u×2u） [画像](shots/overlap-text/g1.ja.write-order__15__1536x864__q.png)
- **g1.math.numbers-120** n=0・1280×720・問題 ほか 19 画面: 「83のじゅうのくらいといちのくらいのすうじは？｜83」 — `span.rt と span.rt`（6.9u×1.5u）
- **g1.math.position** n=3・1280×720・ヒント① ほか 3 画面: 「はさみ｜うえからかぞえる「だん」と、ひだりからかぞえる「ばん」 — `span.rt と span.rt`（9.6u×1u）

### covered（文字・ボタンが隠れる）

- **g1.ja.listen** n=0・1280×720・解説 ほか 3 画面: 「きいてね。も」 — `span.rt の上に button[listen-button].tap.tap--sky` [画像](shots/covered/g1.ja.listen__0__1280x720__explain.png)
- **g1.ja.particles** n=40・1280×720・問題 ほか 19 画面: 「にはまちがいがあるよ。ただしくなおしたれ？」 — `span.rt の上に span.rt` [画像](shots/covered/g1.ja.particles__40__1280x720__q.png)
- **g1.ja.punctuation** n=27・1536×864・解説 ほか 3 画面: 「ぼくは。いもうとと あそんだ。」 — `button[opt-2].choice.eng-choice__opt の上に span.rt` [画像](shots/covered/g1.ja.punctuation__27__1536x864__explain.png)
- **g1.ja.read-info** n=33・1536×864・問題 ほか 19 画面: 「つくかをならべよう。」 — `span.rt の上に rt` [画像](shots/covered/g1.ja.read-info__33__1536x864__q.png)
- **g1.ja.read-story** n=33・1536×864・問題 ほか 15 画面: 「「くまのぱんやさん」のおはなしのじゅんに、ぶんのカードをならべよう。」 — `span.rt の上に span.rt` [画像](shots/covered/g1.ja.read-story__33__1536x864__q.png)
- **g1.ja.sentence-build** n=3・1536×864・問題 ほか 31 画面: 「。」 — `span.rt の上に path` [画像](shots/covered/g1.ja.sentence-build__3__1536x864__q.png)
- **g1.ja.hiragana-read** n=171・1536×864・問題 ほか 39 画面: 「て」 — `span.rt の上に path`
- **g1.ja.write-order** n=0・1280×720・問題 ほか 11 画面: 「」のにっ。たこ」 — `span.rt の上に span[slot-0].tk-slot.is-next`

### text-on-figure（文字が図に重なる（参考））

- **g1.math.numbers-10** n=4・1536×864・ヒント①: 「かぞえう。」 — `span.rt の下に svg` [画像](shots/text-on-figure/g1.math.numbers-10__4__1536x864__h1.png)
- **g1.math.numbers-120** n=3・1536×864・解説 ほか 3 画面: 「9よりおきくらでく」 — `span.rt の下に svg` [画像](shots/text-on-figure/g1.math.numbers-120__3__1536x864__explain.png)
- **g2.math.mult-beyond** n=2・1280×720・ヒント② ほか 3 画面: 「、2」 — `span.rt の下に svg` [画像](shots/text-on-figure/g2.math.mult-beyond__2__1280x720__h2.png)
- **g3.en.numbers-colors** n=21・1536×864・解説 ほか 7 画面: 「え」 — `p.unit__explain-head の下に svg` [画像](shots/text-on-figure/g3.en.numbers-colors__21__1536x864__explain.png)
- **g3.math.mult-1digit** n=3・1280×720・ヒント① ほか 3 画面: 「1」 — `span.unit__hint-mark の下に svg` [画像](shots/text-on-figure/g3.math.mult-1digit__3__1280x720__h1.png)
- **g3.prog.condition-combo** n=1・1280×720・ヒント① ほか 1 画面: 「りた」 — `span.rt の下に svg` [画像](shots/text-on-figure/g3.prog.condition-combo__1__1280x720__h1.png)
- **g3.soc.shop-work** n=13・1536×864・解説 ほか 3 画面: 「ちばいぼ「し」 — `span.rt の下に svg[chart]`
- **g4.en.time-days** n=14・1280×720・ヒント② ほか 47 画面: 「いみだよ。みじかいはり」 — `span.rt の下に svg`

### overlap-button（ボタンどうしの重なり）

- **g1.math.position** n=5・1536×864・ヒント② ほか 11 画面: 「おにぎり｜つぎへ」 — `button[opt-3].choice.eng-choice__opt と button[next-button].tap.tap--main`（1.7u×6u） [画像](shots/overlap-button/g1.math.position__5__1536x864__h2.png)
- **g1.math.shapes** n=3・1536×864・ヒント② ほか 11 画面: 「さんかく｜つぎへ」 — `button[opt-2].choice.eng-choice__opt と button[next-button].tap.tap--main`（2.2u×3.1u） [画像](shots/overlap-button/g1.math.shapes__3__1536x864__h2.png)
- **g1.math.story-expression** n=0・1280×720・問題 ほか 15 画面: 「おうち｜すなばで 6にん、ブランコで 2にん あそんで います。あわせて なんにん ですか。」 — `button[home-button].tap.tap--wood と button[left-0].tk-card`（3.5u×0.5u） [画像](shots/overlap-button/g1.math.story-expression__0__1280x720__q.png)
- **g2.ja.polite** n=31・1536×864・問題 ほか 15 画面: 「ぼくの すきな たべものは カレーだです。こんやも たべたいです。｜ヒント」 — `button[opt-2].choice.eng-choice__opt と button[hint-button].tap.tap--white`（3.5u×1.7u） [画像](shots/overlap-button/g2.ja.polite__31__1536x864__q.png)
- **g2.ja.write-structure** n=0・1280×720・問題 ほか 119 画面: 「おうち｜はじめ の はこに いれる」 — `button[home-button].tap.tap--wood と button[box-0].eng-sort__lid`（3.5u×5.5u） [画像](shots/overlap-button/g2.ja.write-structure__0__1280x720__q.png)
- **g3.en.numbers-colors** n=20・1280×720・ヒント② ほか 95 画面: 「3ばん｜つぎへ」 — `button[opt-2].choice.eng-opts__opt と button[next-button].tap.tap--main`（16.2u×1.8u） [画像](shots/overlap-button/g3.en.numbers-colors__20__1280x720__h2.png)
- **g3.ja.proverbs** n=0・1280×720・ヒント② ほか 7 画面: 「急ぐときほど、あぶない近道よりたしかなやり方をえらぶほうが、けっきょく早い。｜つぎへ」 — `button[opt-0].choice.eng-choice__opt と button[next-button].tap.tap--main`（14.2u×0.5u）
- **g3.ja.read-paragraphs** n=37・1536×864・解説 ほか 1 画面: 「おうち｜えんぴつで書いた字は、消しゴムでこすると消えます。どうして消えるのでしょうか。」 — `button[home-button].tap.tap--wood と button[slot-0].tk-card.is-correct`（3.5u×0.2u）

### kinsoku-start（行頭禁則）

- **g1.ja.listen** n=0・1280×720・解説 ほか 3 画面: 「たいそうふくを も／って きて くださ」 — `p[listen-transcript].eng-listen__transcript`（あしたは そとで たいそうを します。たいそうふくを もって きて ください。） [画像](shots/kinsoku-start/g1.ja.listen__0__1280x720__explain.png)
- **g1.ja.read-info** n=4・1280×720・問題 ほか 79 画面: 「てに はんぶんに お／って、おりめを つけ」 — `p.eng-reading__para`（②まず、かみを たてに はんぶんに おって、おりめを つけて ひらきます。） [画像](shots/kinsoku-start/g1.ja.read-info__4__1280x720__q.png)
- **g1.ja.read-story** n=12・1280×720・問題 ほか 79 画面: 「い 竹の ぼうで、そ／っと たこを はずし」 — `p.eng-reading__para`（おじいさんは、ながい 竹の ぼうで、そっと たこを はずして くれました。たこは また 空 たかく あがって いきました） [画像](shots/kinsoku-start/g1.ja.read-story__12__1280x720__q.png)
- **g1.ja.write-order** n=8・1280×720・解説 ほか 3 画面: 「んごが なる の じ／ゅん だよ。」 — `p.unit__explain-text`（はっぱが でる → はなが さく → りんごが なる の じゅん だよ。） [画像](shots/kinsoku-start/g1.ja.write-order__8__1280x720__explain.png)
- **g1.life.plant-diary** n=0・1280×720・解説 ほか 35 画面: 「のこす だいじな ノ／ートだよ。じょうずか」 — `p.unit__explain-text`（よく みて、かんじた ことを かいたね。かんさつ きろくは、じぶんの めで みた ことを のこす だいじな ノートだよ。） [画像](shots/kinsoku-start/g1.life.plant-diary__0__1280x720__explain.png)
- **g1.life.school-safety** n=3・1536×864・解説 ほか 3 画面: 「るよ。とんだり はし／ったり すると、ころ」 — `p.unit__explain-text`（てすりを もって、ゆっくり おりるよ。とんだり はしったり すると、ころんで けがを するよ。） [画像](shots/kinsoku-start/g1.life.school-safety__3__1536x864__explain.png)
- **g1.life.seasons** n=23・1536×864・解説 ほか 3 画面: 「から、みずや むぎち／ゃを こまめに のむ」 — `p.unit__explain-text`（あつい ひは あせを たくさん かくから、みずや むぎちゃを こまめに のむよ。）
- **g1.math.story-expression** n=1・1536×864・問題 ほか 15 画面: 「います。5だい はい／って きました。くる」 — `span.tk-card__label`（ちゅうしゃじょうに くるまが 2だい とまって います。5だい はいって きました。くるまは なんだいに なりましたか。）

### kinsoku-end（行末禁則）

- **g3.ja.reference-connectives** n=16・1280×720・問題 ほか 15 画面: 「れた空の鳥を見て）「／□鳥は、何という名前」 — `p.eng-fill__text`（（二人から遠くはなれた空の鳥を見て）「 鳥は、何という名前かな。」） [画像](shots/kinsoku-end/g3.ja.reference-connectives__16__1280x720__q.png)
- **g4.ja.info-compare** n=25・1536×864・解説 ほか 3 画面: 「しかめたい」です。「／」の中は本からうつし」 — `p.unit__explain-text`（自分で考えたことは、さいごのだんらくの「風の強い日にカエデのたねを落としてたしかめたい」です。「 」の中は本からうつした） [画像](shots/kinsoku-end/g4.ja.info-compare__25__1536x864__explain.png)
- **g5.ja.kanji-read-g5** n=4・1280×720・問題 ほか 15 画面: 「□」、下のことばは「／□」と読む。」 — `p.eng-fill__text`（上のことばは「 」、下のことばは「 」と読む。） [画像](shots/kinsoku-end/g5.ja.kanji-read-g5__4__1280x720__q.png)

### orphan（最後の行が1文字）

- **g1.ja.kanji-read-g1** n=1・1536×864・解説 ほか 3 画面: 「見／学」 — `div.fig-text.fig-text--l`（見学） [画像](shots/orphan/g1.ja.kanji-read-g1__1__1536x864__explain.png)
- **g1.ja.punctuation** n=1・1536×864・問題 ほか 15 画面: 「かおを あらいました／□」 — `p.eng-fill__text`（あさ おきました かおを あらいました） [画像](shots/orphan/g1.ja.punctuation__1__1536x864__q.png)
- **g1.ja.read-info** n=24・1280×720・問題 ほか 59 画面: 「やわらかい はっ／ぱ」 — `td`（やわらかい はっぱ） [画像](shots/orphan/g1.ja.read-info__24__1280x720__q.png)
- **g1.life.school-safety** n=9・1536×864・解説 ほか 3 画面: 「ンコの まえを はし／る」 — `span.tk-card__label`（ブランコの まえを はしる） [画像](shots/orphan/g1.life.school-safety__9__1536x864__explain.png)
- **g1.math.numbers-120** n=1・1536×864・解説 ほか 3 画面: 「の くら／い」 — `th`（じゅうの くらい） [画像](shots/orphan/g1.math.numbers-120__1__1536x864__explain.png)
- **g1.math.picture-graph** n=4・1280×720・問題 ほか 19 画面: 「うえきば／ち」 — `td`（うえきばち） [画像](shots/orphan/g1.math.picture-graph__4__1280x720__q.png)
- **g1.prog.condition** n=7・1536×864・解説 ほか 3 画面: 「てぶくろを す／る」 — `span.tk-card__label`（てぶくろを する）
- **g1.prog.sequence** n=2・1280×720・問題 ほか 15 画面: 「はみがきこを つけ／る」 — `span.tk-card__label`（はぶらしに はみがきこを つける）

### wakachi-split（分かち書きの語の途中で改行）

- **g1.ja.hiragana-write** n=0・1280×720・ヒント② ほか 223 画面: 「りから みぎへ なぞ／るよ。」 — `span.rt`（すうじの じゅんに、うえから したへ、ひだりから みぎへ なぞるよ。） [画像](shots/wakachi-split/g1.ja.hiragana-write__0__1280x720__h2.png)
- **g1.ja.kanji-read-g1** n=1・1536×864・解説 ほか 3 画面: 「と よむよ。見は こ／こでは 「けん」。」 — `p.unit__explain-text`（「見学」は 「けんがく」と よむよ。見は ここでは 「けん」。） [画像](shots/wakachi-split/g1.ja.kanji-read-g1__1__1536x864__explain.png)
- **g1.ja.kanji-write-g1** n=0・1280×720・解説 ほか 11 画面: 「た、ひだりから みぎ／の じゅんで かこう」 — `p.unit__explain-text`（「白」は 5かくだよ。うえから した、ひだりから みぎの じゅんで かこうね。） [画像](shots/wakachi-split/g1.ja.kanji-write-g1__0__1280x720__explain.png)
- **g1.ja.katakana** n=0・1280×720・ヒント② ほか 63 画面: 「て いる ものが あ／るよ。」 — `span.rt`（カタカナと ひらがなは、かたちが すこし にて いる ものが あるよ。） [画像](shots/wakachi-split/g1.ja.katakana__0__1280x720__h2.png)
- **g1.ja.listen** n=0・1280×720・解説 ほか 3 画面: 「あしたは そとで た／いそうを します。」 — `p[listen-transcript].eng-listen__transcript`（あしたは そとで たいそうを します。たいそうふくを もって きて ください。） [画像](shots/wakachi-split/g1.ja.listen__0__1280x720__explain.png)
- **g1.ja.particles** n=0・1280×720・解説 ほか 7 画面: 「ことばの あとに つ／く「わ」の おとは「」 — `p.unit__explain-text`（「ぼくは いちねんせいです。」。ことばの あとに つく「わ」の おとは「は」と かくよ。） [画像](shots/wakachi-split/g1.ja.particles__0__1280x720__explain.png)
- **g1.ja.hiragana-read** n=21・1536×864・解説 ほか 3 画面: 「に」と おなじ じだ／ね。」 — `p.unit__explain-text`（「に」だよ。「にんじん」の「に」と おなじ じだね。）
- **g1.ja.punctuation** n=0・1536×864・ヒント③ ほか 43 画面: 「つかうよ。おわる と／ころは どうかな。」 — `span.rt`（ぶんが まだ つづく ところには「、」を つかうよ。おわる ところは どうかな。）

### word-split（語・数・単位の途中で改行）

- **g1.math.add-carry** n=5・1536×864・解説 ほか 3 画面: 「10。8を 2と 6／に わけて、8＋2＝」 — `p.unit__explain-text`（数と単位・助数詞の間） [画像](shots/word-split/g1.math.add-carry__5__1536x864__explain.png)
- **g1.math.clock** n=2・1280×720・解説 ほか 3 画面: 「い はりが 6で 8／じはん だよ。」 — `p.unit__explain-text`（数と単位・助数詞の間） [画像](shots/word-split/g1.math.clock__2__1280x720__explain.png)
- **g1.math.story-expression** n=0・1280×720・問題 ほか 15 画面: 「い シールが 1／まい ありま」 — `span.tk-card__label`（数と単位・助数詞の間） [画像](shots/word-split/g1.math.story-expression__0__1280x720__q.png)
- **g1.math.sub-borrow** n=0・1280×720・解説 ほか 3 画面: 「4を ひいて 6、6／と ばらの 2で 8」 — `p.unit__explain-text`（数と単位・助数詞の間） [画像](shots/word-split/g1.math.sub-borrow__0__1280x720__explain.png)
- **g1.prog.condition** n=21・1536×864・解説 ほか 7 画面: 「に 「すすむ」を 2／かい。「まえが かべ」 — `p.unit__explain-text`（数と単位・助数詞の間） [画像](shots/word-split/g1.prog.condition__21__1536x864__explain.png)
- **g1.prog.sequence** n=21・1280×720・ヒント③ ほか 3 画面: 「に 「すすむ」を 2／かいまで たどると、」 — `span.rt`（数と単位・助数詞の間） [画像](shots/word-split/g1.prog.sequence__21__1280x720__h3.png)
- **g2.math.fraction-simple** n=51・1536×864・解説 ほか 3 画面: 「と 1つ ぶんは 2／こ。4この □は 2」 — `p.unit__explain-text`（数と単位・助数詞の間）
- **g2.math.mult-meaning** n=0・1280×720・解説 ほか 3 画面: 「では 2 × 2（1／つぶんの かず ×」 — `p.unit__explain-text`（数と単位・助数詞の間）

### button-split（ボタン・選択肢の中で語が折れる）

- **g1.ja.read-info** n=3・1536×864・問題 ほか 19 画面: 「どのように して お／おきく なるのでしょ」 — `span.eng-opts__label`（分かち書きの語の途中） [画像](shots/button-split/g1.ja.read-info__3__1536x864__q.png)
- **g1.ja.read-story** n=2・1280×720・問題 ほか 19 画面: 「たちに あげて、ひと／りで かえった」 — `span.eng-opts__label`（分かち書きの語の途中） [画像](shots/button-split/g1.ja.read-story__2__1280x720__q.png)
- **g1.ja.write-order** n=10・1280×720・問題 ほか 15 画面: 「っこうに あつまりま／した。」 — `span.tk-card__label`（分かち書きの語の途中） [画像](shots/button-split/g1.ja.write-order__10__1280x720__q.png)
- **g1.life.school-safety** n=9・1536×864・解説 ほか 3 画面: 「ンコの まえを はし／る」 — `span.tk-card__label`（分かち書きの語の途中） [画像](shots/button-split/g1.life.school-safety__9__1536x864__explain.png)
- **g1.math.story-expression** n=0・1280×720・問題 ほか 15 画面: 「すなばで 6に／ん、ブラン」 — `span.tk-card__label`（分かち書きの語の途中） [画像](shots/button-split/g1.math.story-expression__0__1280x720__q.png)
- **g1.prog.sequence** n=2・1280×720・問題 ほか 15 画面: 「はみがきこを つけ／る」 — `span.tk-card__label`（分かち書きの語の途中） [画像](shots/button-split/g1.prog.sequence__2__1280x720__q.png)
- **g1.prog.condition** n=7・1280×620・問題 ほか 3 画面: 「ぼうしを か／ぶる」 — `span.tk-card__label`（分かち書きの語の途中）
- **g2.ja.polite** n=31・1536×864・問題 ほか 19 画面: 「こんやも たべたいで／す。」 — `span.eng-choice__label`（分かち書きの語の途中）

### narrow-wrap（極端に狭い折り返し）

- **g1.math.numbers-120** n=0・1280×720・解説 ほか 7 画面: 「じゅうの くらい」 — `th`（4行・1行 2字まで） [画像](shots/narrow-wrap/g1.math.numbers-120__0__1280x720__explain.png)
- **g2.life.town** n=1・1536×864・問題 ほか 11 画面: 「やさいを うる ひと」 — `span.tk-card__label`（4行・1行 2字まで） [画像](shots/narrow-wrap/g2.life.town__1__1536x864__q.png)
- **g2.math.add-column** n=0・1280×720・解説 ほか 11 画面: 「じゅう」 — `th`（3行・1行 1字まで） [画像](shots/narrow-wrap/g2.math.add-column__0__1280x720__explain.png)
- **g2.math.add-sub-3digit** n=1・1536×864・解説 ほか 3 画面: 「ひゃく」 — `th`（3行・1行 1字まで） [画像](shots/narrow-wrap/g2.math.add-sub-3digit__1__1536x864__explain.png)
- **g2.math.numbers-1000** n=1・1536×864・解説 ほか 3 画面: 「ひゃくの くらい」 — `th`（7行・1行 1字まで） [画像](shots/narrow-wrap/g2.math.numbers-1000__1__1536x864__explain.png)
- **g2.math.numbers-10000** n=3・1536×864・解説 ほか 3 画面: 「せんの くらい」 — `th`（6行・1行 1字まで） [画像](shots/narrow-wrap/g2.math.numbers-10000__3__1536x864__explain.png)
- **g2.math.sub-column** n=3・1536×864・解説 ほか 11 画面: 「じゅう」 — `th`（3行・1行 1字まで）
- **g3.ja.proverbs** n=33・1536×864・問題 ほか 15 画面: 「花よりだんご」 — `span.tk-card__label`（3行・1行 2字まで）

### small-text（文字が小さすぎる）

- **g1.ja.kanji-read-g1** n=0・1280×720・解説: 「なか」 — `rt`（1u（最小 1.1u・ふりがな）） [画像](shots/small-text/g1.ja.kanji-read-g1__0__1280x720__explain.png)
- **g1.ja.kanji-write-g1** n=0・1280×720・解説: 「しろ」 — `rt`（1u（最小 1.1u・ふりがな）） [画像](shots/small-text/g1.ja.kanji-write-g1__0__1280x720__explain.png)
- **g1.ja.katakana** n=0・1280×720・解説 ほか 63 画面: 「1」 — `span.tk-badge`（1.8u（最小 2u）） [画像](shots/small-text/g1.ja.katakana__0__1280x720__explain.png)
- **g1.ja.read-info** n=33・1536×864・解説 ほか 11 画面: 「1」 — `span.tk-badge`（1.8u（最小 2u）） [画像](shots/small-text/g1.ja.read-info__33__1536x864__explain.png)
- **g1.ja.read-story** n=33・1536×864・解説 ほか 7 画面: 「1」 — `span.tk-badge`（1.8u（最小 2u）） [画像](shots/small-text/g1.ja.read-story__33__1536x864__explain.png)
- **g1.ja.write-order** n=10・1280×720・解説 ほか 43 画面: 「1」 — `span.tk-badge`（1.8u（最小 2u）） [画像](shots/small-text/g1.ja.write-order__10__1280x720__explain.png)
- **g1.life.school-safety** n=17・1536×864・解説 ほか 11 画面: 「1」 — `span.tk-badge`（1.8u（最小 2u））
- **g1.math.clock** n=2・1280×720・問題 ほか 19 画面: 「1」 — `text`（1.1u（最小 2u））

