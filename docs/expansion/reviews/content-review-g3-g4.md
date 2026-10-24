<!-- 独立レビュー（Fable、2026-10-24）。対象: 小3・小4の算数・国語。指摘への対応はコミット履歴と各パックの review*.test.ts を参照 -->

# 教材内容レビュー（g3-math 16・g4-math 18・g3-ja 9・g4-ja 7 ＝ 50単元）

報告時刻 18:30 ごろ（締め切り 20:45 より前）。**50単元すべてのソースを通読**（分担: g3-math は私が直接精読・生成確認、g4-math／g3-ja／g4-ja は並列の下請け3名が全行精読し、私はその重大指摘と「エンジン側の並び順」の主張をソースで裏取りした）。リポジトリは編集・コミットしていない。

## 進め方
- 生成器（g3-math 16・g4-math 18 の全単元）は seed 200×段階4×index 4（単元あたり 3200 問）で実際に生成し、選択肢の重複・正答数・`wrongAnswers`＝正答・正答位置の偏り・同一性キーの偏り・ヒント③の答え含有を機械的に数えたうえで、見本（テンプレートごと3件）を目で確認。スクリプト （作業用のスクリプト・出力。リポジトリには含めない）、出力 （同上）・（同上）。追加検査 （同上）（展開図判定・order-ops の型の出現・角の360°超）、（同上） → `g3-ja-check.txt`、（同上） → `check-g4-ja.out.txt`。
- 機械集計の結果: 生成例外なし、`wrongAnswers`＝正答なし、選択肢の重複なし、正解数≠1なし（multi 以外）。学年超過の漢字（ふりがな付き教科用語を除く）なし。
- **エンジンの並び順を確認した事実**（内容面の判定に直結するので先に書く）: `choice` は `fixedOrder` でなければ id で並べ替えるが、**絵だけの選択肢（label なし）があると並べ替えない**（engines/choice/choice.tsx `displayOrder` L44-46）。`geometry` の pick（geometry.tsx L768）、`graph` の choice（graph.tsx L849）、`fill`（fill.tsx）は**書いた順のまま描く**。多くの単元が `opts(正解, 誤り…)`＝正解を先頭に書いているため、これらでは**正解が常に1番目**になる（下の「中-A」）。下請けの g4-math 報告は「位置の偏りは全部偽陽性」としていたが、これは choice のラベル付き選択肢に限って正しく、絵・図形・グラフ・fill では実際に偏る。

---

## 重大（誤りを教える／正しい答えを誤りにする）

### 算数
1. **g3.math.triangles `classify-alt:pick:{b}x{h}`（二等辺三角形はどれ、geometry pick）: 誤答用の形が二等辺三角形になる組がある。** `sc2 = [0,0],[b,0],[0,h+1]` は b＝h＋1 のとき直角二等辺三角形（b=4,h=3 → 4・4・4√2、b=6,h=5 → 6・6・6√2）。ダンプ `classify-alt:pick:6x5`（level0）: 3つ目の選択肢 `[[6,6],[0,6],[6,0]]` が二等辺なのに `not-iso`（辺の長さをくらべまちがえた）で誤り。正答が2つある。直し方: h を b−1 以外に限る（`if (h + 1 === b) h++` など）。
2. **g3.math.fractions `figure-alt:{k}/{n}`（k/n m を表す図はどれ）: 「等分でない」誤答図が、n−k＝2 のとき ● の長さがちょうど k/n m になる。** uneven 図の部品は ●×k（長さ1）＋無印1つ（長さ (n−k−1)×2）なので、n−k＝2 なら全長 n のうち ● が k。例 `figure-alt:1/3`（ダンプ 2390 行）: 誤答図 [●1｜2] は 1m テープの 1/3 の長さに ● がある。1/3・2/4・3/5・4/6・5/7・6/8・7/9・8/10 のすべてで、長さを正しく読んだ子が `not-equal`（同じ大きさに分けていない図を選んだのかな）で誤りになる。直し方: 無印部分の長さを (n−k−1)×2 でなく、● の割合が k/n にならない値（例 n−k＋1 や、● 側を長さ1.5 にする）にし、生成時に「● の長さ÷全長 ≠ k/n」を検査する。
3. **g4.math.order-ops `mixed`（calc）ヒント③「のこりを 左から 計算しよう」が、型によって誤った手順を教える。** 例 `mixed:57 ＋ 12 ÷ 2 × 11`（正答 123）: ②「まず 12 ÷ 2 ＝ 6」→③「のこりを左から」だと 57＋6＝63、×11＝693。`mixed:53 − （16 ＋ 9） ÷ 5`（正答 48）も (53−25)÷5。該当型 `a × b − c ÷ d`、`a − (b + c) ÷ d`、`a + b ÷ c × d`（ダンプで各 64〜74 件）。直し方: ③を「のこりの かけ算・わり算を 先に して、さいごに たし算・ひき算」にするか、型ごとに2手目まで示す。`explain` も全手順を書く。
4. **g4.math.area `compound-alt`（花だんと道）: 問題文と図・計算が矛盾。** 文は「たて H m、横 W m の**花だん**の まわりに はば r m の道」だが、計算は W×H を外枠として `W×H − (W−2r)(H−2r)`。文のとおりなら道の面積は `(W+2r)(H+2r) − WH`。例 `compound-alt:12x5:2` 正答 52、文の読みでは 84。`compound-alt:6x6:2` は「6m×6m の花だん」なのに中の花だんが 2m×2m。直し方: 文を「たて H m・横 W m の 長方形の 土地の まわりに はば r m の 道を つけ、のこりが 花だん（色の 部分が 道）」に。

### 国語
5. **g3.ja.modifiers 誤概念 `m-near`（「すぐとなりの言葉をえらんだのかな。はなれた言葉につながることもある」）が、修飾語より前の語・離れた語を選んだ誤答に付いている（説明が逆、9件）。** `target:okiru`「ぼくは 毎朝 早く 起きる」誤答「毎朝」（正解「起きる」こそ隣）、`target:nioi`「台所から」、`target:hoshi`「夜空に」、`target:kaze`「まどから」、`target:kokuban`「字を」、`target:match:boushi/hon/nimotsu/uta` の wrongPairs。子は「正解は離れた語」と逆方向に学習する。直し方: `m-before`（前の言葉を選んだ→後ろの言葉につながる）と `m-far`（離れた語→まず直後とつなぐ）を新設して付け替える。
6. **g3.ja.reference-connectives ペア取り違え型の誤概念ID（`rc-jun-gyaku`＝だから↔しかし、`rc-tenka-sentaku`、`rc-matome-rei`）が、正解がそのペアに含まれない問題の誤答に付いている（13件）。** `setsuzoku:keeki`（正解そのうえ）誤答「しかし」→rc-jun-gyaku、`setsuzoku:ensoku/aki/irogami`、`g3rc-enpitsu:i`（すると）「それとも」→rc-tenka-sentaku・「たとえば」→rc-matome-rei、`g3rc-dacho:a/i`、`g3rc-katatsumuri:shikashi`。「だからとしかしを取りちがえたのかな」が、どちらも正解でない問題で返る。直し方: 正解がペア外の誤答は `rc-func`（働きを確かめずに選んだ）に。
7. **g3.ja.write-reasons `riyuu-match:anzen`: 誤答ペアが理由として成立する（正解が2つ）。** 左「自転車に乗るときはヘルメットをかぶります」×右「自転車は速いからです」を `reason-unrelated` にしている。直し方: 右の誤答文を明らかに無関係な文（例「自転車には車りんが二つあるからです」）に。
8. **g4.ja.plain-polite-style `shiki:*`（見分ける11問全部）・`soroe-alt:koro/himawari`: `opts(正解,…)`＋`fixedOrder: true` で正解が常に先頭に表示される**（敬体の文なら「です・ます｜だ・である」、常体なら逆）。1番目を押せば必ず正解で、到達項目 identify の習熟判定が無意味。直し方: 選択肢をラベル順（KEI, JOU／①②③）に固定して `correct` を該当側に付けるか、`fixedOrder` を外す。（下請けは重大に分類。位置の偏りだが13問全部・固定なので重大に残す）

---

## 中

### A. 正答が常に1番目（エンジンが並べ替えない形式に `opts(正解, …)` を使っている）— パック横断
- **choice・絵だけの選択肢**: g3.math.fractions `figure-alt`、g3.math.circle-sphere `parts-alt`（半径／直径を表す図はどれ）、g3.math.bar-graph `make-alt`（ならべ方が正しいグラフ）、g4.math.cuboid `net-alt`（立方体の展開図はどれ、cuboid.ts L132）。ダンプの `correct position bias 100%` のうちこれらは**本物**。
- **geometry pick**: g3.math.triangles `angle:*`（いちばん大きい角）・`angle-alt:min:*`・`classify-alt:pick:*`、g4.math.quadrilaterals `classify:*`（quadrilaterals.ts L196。正解の形が常に「1ばんのかたち」）。
- **graph choice**: g4.math.line-graph `change:*`（上がり方が大きい区間、L196）・`trend-alt:*`（L229）。
- **fill**: g4-ja 51問（okurigana 15・idioms 23・plain-polite 10・write-report 3）に加え、**g3-ja でも** proverbs `fill:*`（`[c.t, ...]`）、modifiers `kuwashiku:*`（`[f.ans, f.wrong]`）、reference-connectives `setsuzoku:*`（`[c.ans, ...]`）が正解先頭（write-reasons `tsunagi:*` は固定リスト `[...CONJ]` なので無事）。
- g3.ja.reference-connectives `kosoado:rule:こ/そ/あ/ど`（4問）も `opts`＋`fixedOrder` で先頭固定。
- 直し方（統括判断）: choice の `displayOrder` を絵だけの選択肢にも適用し（ヒント・解説が「1ばん」で指す問題だけ `fixedOrder` を明示）、geometry pick・graph choice・fill にも同じ id ベースの並べ替えを入れる。エンジンを変えないなら、各パックで正解の位置をデータ側でばらす。

### B. ヒント③（または②）が答えそのものを言う（1.2-5）
- g3.math.division-basic `zero-one`: ③「d × 0 は いくつかな」（0÷d の答え0）、「1 × D は いくつかな」（D÷1 の答えD）、「d × 1 は いくつかな」（d÷d で □＝1 を露呈）。3種すべて。②「d × □ ＝ D を考えよう」で止める。
- g3.math.box-expression `make`/`make-alt`: ③「□ ＋ 36 の 答えが 72 に なる 式は？」＝正解の選択肢「□ ＋ 36 ＝ 72」。
- g3.math.circle-sphere `sphere-alt:biggest`: ③「球の 中心を とおる ところ。」＝正解ラベルそのまま。
- g3.math.mult-2digit `partial`/`partial-alt`（3欄）: ②「a × b1 ＝ p1」で1欄目、③「p1 と p2×10 を たそう」で alt の2欄目も確定（例 `partial-alt:67x53` ③「201 と 3350 を たそう」）。③は「2だんめを 1けた ずらして たそう」程度に。
- g3.math.length-km `unit-alt:*`／g3.math.weight `unit-alt:*`・`convert-alt:t-kg:1`: 「1kmは何m」「1kgは何g」「1tは何kg」の問いに、②「1km ＝ 1000m、1m ＝ 100cm、1cm ＝ 10mm」「1kg ＝ 1000g、1t ＝ 1000kg」と答えを列挙。②は「k は 1000 の いみ」、③は数の関係を聞き返す形に。
- g4.math.div-2digit `story`（商1けた）③「一の位: 274 ÷ 32 ＝ 8 あまり 18」＝答え；`tens` ③「66 ÷ 6 ＝ 11 あまり 0」。
- g4.math.fraction-same `calc` ③「[[1/5]]が 2 − 1 ＝ 1こ」（form any/improper で答え）。
- g4.math.fraction-kinds `toMixed` ③「8 ÷ 6 ＝ 1 あまり 2。商が整数、あまりが分子」＝1と2/6；`compare` 等しい組で③が「同じ」を露呈。
- g4.math.rounding `range` ②③で両端を明示、`range-alt` ③「lo 以上 X+U/2 未満」が答え。
- g4.math.quadrilaterals `diag-alt` ③（ひし形は垂直、長方形は同じ長さ…）が問1・問2の答えを含む。
- g4.math.area `units-alt` ③「1km²は…」固定文が答えの単位だけを説明。
- g3.ja: modifiers `target:doa`（正答句そのまま）・`find:donna:*`12問（位置で確定）・`kuwashiku:*`（②③が2択の差そのもの）、reference-connectives `kosoado:rule:あ/ど`・`shiji:biidama/mafuraa/kai/toshokan/ie`、proverbs `scene:*`31問（③が clue の流用で選択肢＝ことわざ本文を名指し。`scene:neko/buta/nuka` は正答文字列を含む）・`meaning:zen/suki/narau/hyakubun/nasake`（②が意味そのもの）、write-reasons `matome:*`③「『このように』『だから』で始まる文」（正解だけ該当）・`tsunagi:*`②③に対応表・`rei-sort:*`、romaji `table:read:*`101問（②「か行」＋③「母音が a」で誤答が全部消える。要確認: 表を引く操作は残る）、kanji-parts `build:時/秋/読`（部品を名指し。要確認）。
- g4.ja: idioms `bamen:*` ③「『意味』という意味のことばをさがそう」（辞書的意味をそのまま）、write-report `inyou-alt:*`3問は**問題文**に正答の引用文がそのまま出る（照合で解ける）。

### C. 学年・内容・場面
- **g4.math.angle `rotate`: 360°を超える角（450°・495°・540°）が約3割**（152/465）。4年は1回転まで。h を 1〜8 に限る。
- **g4.math.order-ops 型の欠落**: 「左から計算した答えが正答と違う」フィルタで `a × b + c`・`a × b − c`・`a ÷ b ± c`・`(a + b) × c − d`・`a × (b − c) + d` が一度も出ない → 「×÷は常に後ろ」と誤学習しうる。muldiv・mixed ではこの条件を外す。
- **g4.math.cuboid intro**「長方形だけで かこまれた 形を 直方体」— 正しくは「長方形（や 長方形と正方形）で かこまれた形」。同じ intro の図（5×3×3）に正方形の面があり自己矛盾。
- **g4.math.decimal-int `rem-alt`**: 1/10 の位までのがい数で正答 4.0 を「4」と表示（`dec()` が末尾0を落とす）。「3.95…」の「…」も不適（割り切れる）。`decFixed` を使う。判定は値一致なので子の入力は救われる。
- **g3.math.mult-1digit／mult-2digit 文章題の数の現実感**: 3けた×1けた／3けた×2けたの場面に `seats`「1台の バスに 487人ずつ」、`pages`「毎日 999ページずつ」、`weight`「子ねこの体重 13g」、mult-2digit `bus`「1台に 999人 乗れる」`chairs`「1れつに 999きゃく」`eggs`「1はこに 999こ」`paper`「1人に 999まい」が出る。3けたの場面は tickets/walk/rope/stamps/boxes 等に限る。
- **g3.math.mult-rules `ten`（10 × a）**: 式は「10 × a」なのにヒント②③・解説が「a × 9 ＝ 9a より a 大きい」と交換した形で説明（交換は同単元の後の到達項目）。「10 × a は 10 が a こ」で説明する。
- **g3.math.fractions `compare-alt`（k/n □ 1）**: 3年は真分数のみなので「＜」が正解の約90%（fixedOrder）。「1 □ k/n」の向きを半分混ぜる。
- **g4.math.ratio-intro `compare`**: 「ア」正解 72%（a1≤60, a2≤90 の非対称）。範囲を揃える。
- **誤概念IDの付け違い**（説明が実際の誤りと合わない）: g4.math.change-relations `formula-alt`（誤答 target×2 に rope 専用の `half-perimeter` を全場面で）、line-graph `change`（横ばい区間に `down-vs-up`）、decimal-int `rem-alt`（切り上げすぎに `round-cut`）、order-ops `rules-alt` kind2（b×c に `assoc-add`）；g3.math.circle-sphere `apply-alt` 誤答 `d×n − n` に `use-radius`；g3.math.division-basic `big` 誤答 x/d＋y/d に `tens-drop`（説明は 60÷3 の例で、48÷4→3 には合わない）；g3.ja write-reasons `tsunagi-alt:2`（conj-reason-example→conj-summary）・`matome:*`、proverbs `sort:*` 一律 `p-similar-form`・`similar:kappa`、read-paragraphs `*:matome` の `p-near-para`・`g3p-tosho:hyou`・`g3p-kaiware:nanoka`、read-character `*:henka` の `r-feeling-mix`、reference-connectives `g3rc-dacho:kore`；g4.ja plain-polite `shiki:gyunyu/ike/yume/kawa`（「 」も丁寧語もない文の誤答に `pp-not-end`）、read-summary `g4m-dokusho:c2`（表と矛盾する誤答に `s-not-written`→`s-opposite`）。
- **題材の偏り（同一性キー）**: g4.math.angle 539/3200（`rotate` 12通り）、change-relations 517/2400、cuboid 662/2400、g3.math.mult-rules 293（定義域どおり）。いずれも1キー3%未満だが angle・change-relations は定義域を広げたい。
- **g4-ja 分かち書きの不統一**: okurigana・idioms・plain-polite・info-compare・write-report・read-summary が文節分かち書き、read-feelings のみ通常の文。2.1「小3以上は通常の文」と逆（統括判断で統一）。
- **g3.ja.reference-connectives `g3rc-enpitsu:i`**: 正解「すると」が intro・ヒント・`rc-func` の6種のどこにも導入されず消去法のみ。働き一覧に「つづき（すると・そして）」を足す。
- **g3.ja.kanji-parts `build:洋`** ③「右は『半』に似ているけれど、上に2つの点がある動物の字」—「半」の上にも点が2つあり見分けにならない（→「横線が3本」）。`build:読` の部品タイル「売《ばい》」とヒント「うる」の読みが不一致。
- **g3.ja.romaji**: 長音の説明が `NOTE.long`「ou・oo と書いてもよい」だけだが、タイルで作る正答は okaasan・keeki・kyuuri など母音重ね、解説は okāsan 表示 → 「aa・uu のように母音を重ねてもよい」を含める。`word:write:ゆびわ/でんわ`・`cap:write:おきなわ` は誤答例が空、`word:letters:みち` の誤答 mitsu はタイルから作れない。
- **g4.ja.read-summary `g4m-penguin:c2`（要確認）**: ②の中心文を「一つめは、羽です。」とするが主張は3文目（羽が空気をふくんで…）にあり、別解が成り立つ。設問を変えるか本文1文目に主張を含める。
- **g4.ja.info-compare `bunrui:tobu`（要確認）**: ニワトリ→「とばない」は短距離なら飛べる。ダチョウ等に。
- **題材の重複**: g4-ja ペンギン・メダカ・はち・たんぽぽ・つばめ・トマトが単元間で重複；g3-ja modifiers の例文再利用（intro の例文＝`find:*:inu` の正解）、reference-connectives intro 2段目＝`shiji:biidama`、proverbs `scene:isogaba/ishibashi`・`scene:uma/nuka/fill:uma` が同じ場面、read-character `g3c-kingyo`×read-paragraphs `narabe:kingyo`。
- **要確認**: proverbs「犬も歩けば棒に当たる」を幸運側だけで扱う（原義は災難。両義を解説に）、`meaning:koubou` の clue「こうぼうだいし」は実在人物（由来語なので許容か）、basis が慣用句・故事成語を含むのに収録はことわざ31のみ；g4.ja plain-polite `mokuteki:shinbun`（学級新聞＝常体を唯一の正解。解説に「ふつう」あり）；g4.math parallel-perp `find` の「直角に近い」誤答が 45°ずれで説明と合わない；g4.math line-graph `two` の軸ラベル「1〜6」と文「1月〜6月」の対応。

---

## 軽微
- **g3-math**: time の `seconds` で「m分《ぷん》」「m分《ふん》」をハードコード（2分《ぷん》・1分《ふん》が誤読。`FUN()` を使う）；time `duration-alt` で 10時55分→1時25分のように正午をまたぐのに午前・午後なし；add-sub-column level0 ラベル「くり下がり1回」だが sub1 は2回以上も出る；mult-rules `zero-alt` a=0 で「玉が 0こ 入りました」、`split-alt` 誤答 10b の `split-whole` 説明が合わない；division-basic `hougan` ③「□ × d ＝ D の □を（dのだん）で」の段の言い方；division-remainder `gum`「1こ 3円のガム」、`down` ③「あまりの 3では、7の まとまりは 作れないね」が金額の場面に不自然；circle-sphere `parts:same` の文に点ア・イがあるのに図に印がない、`parts`/triangles `classify` の③が判定規則の全文（事実上の答え。固定3択なので弱い）；triangles `classify` で3辺が等しい三角形に「二等辺三角形」を選ぶと誤り（正三角形は二等辺三角形の仲間でもある旨を解説に一言）；large-numbers `place-alt` ③が漢数字→数字の変換（非 alt に還元）；bar-graph の誤概念 `scale-choice` が未使用；weight `calc` ③「3000 ＋ 650 を計算して」で g 欄の答え(650)がそのまま見える組（a が kg ちょうどのとき。偶然だが頻出）。
- **g4-math**: angle `rotate-alt` min=5 で③「30 × 1」；decimal-add-sub `units:compose` の `unit-zero` 誤答が "." になり必ず捨てられる；div-2digit `page`「dページ 読める 日は 何日」が不自然；div-1digit `tens` に 2700÷3；line-graph `read-alt` 体温で「温度は 何度」；fraction-kinds `compare-alt` の数直線に印なし；change-relations `rope` で正方形の列が表に出る；ratio-intro `plant` 先週→今週で9倍；order-ops `rules` kind2・3 で②＝③。
- **g3-ja**: dictionary `midashi:mijikakatta`「えんぴつが すっかり 短かった」、objective「にごる 音《おん》」；kanji-parts `build:岩`③が筆順の説明；proverbs `meaning:toudai` lit が字義でない、`scene:korobanu` だけ4択、「生活の知《し》え」交ぜ書き；write-reasons `rei:ゲーム…`理由が逆に読める、`matome:ぼくは本を…`が新情報；read-character `g3c-baton`「三年二組《ふたくみ》」→にくみ、詩「にわか雨」の語義、`g3c-nikki` 3年生が一人で火と包丁、`g3c-kabocha:hoppeta`③；read-paragraphs `g3p-ha:kiiro`②が①にも該当、`g3p-enpitsu`「H」「B」のふりがな、`narabe:hechima`（4年理科の定番植物）；reference-connectives `kosoado:rule:ど`「もの」重複、`shiji:tokei/ie` の「あれ／あそこ」；性役割: write-reasons「母はほかの仕事ができます」、modifiers 妹・姉＝本・手芸／兄＝力仕事。
- **g4-ja**: okurigana `word:atatakai` の「れい外」説明（通則2の語で例外ではない）；idioms `tsukai:hana-takai` 誤答文が読みにくい、`bamen:ki-nagai` 誤答「首を長くする」が紛らわしい、`imi:*` match ②が体の部分のない組に合わない；read-summary `g4m-medaka`「十一日目」→「十一日後」；read-feelings `scene` 系③が正答とほぼ一対一；write-report `inyou-alt` explain の `**` 強調、`kaku:*` id にふりがな付き日本語；性役割（母＝料理・台所、父＝工場・漁）は中和もあり許容範囲。
- **実在の人物・団体・商品名・教科書の定番教材のなぞり**: 4パックとも見当たらない（proverbs の「こうぼうだいし」は由来語）。事実（面積の単位換算、展開図11種、角、国語辞典の並び、部首・画数、ことわざの意味、ローマ字の新告示、送り仮名の本則、表の数値）は確認した範囲で正しい。

---

## 単元ごとの一言総評（50単元）
**g3-math（私が精読・生成確認）**
- large-numbers: 位取り・漢数字・10倍・数直線とも正しい。問題なし。
- add-sub-column: 筆算手順・0をまたぐ繰り下がり・誤答例とも正しい。良好（ラベルの軽微のみ）。
- mult-rules: 計算は正しい。10×a のヒントが交換形（中）。
- mult-1digit: 筆算・誤答（繰り上げ忘れ・先に足す・並べる）正しい。文章題の数の現実感（中）。
- mult-2digit: 部分積・2段目のずらしの説明が正しい。`partial` の②③が欄の答え（中）、場面の現実感。
- division-basic: 等分除・包含除・0と1・2けた÷1けた すべて正しい。`zero-one` ③が答え（中）。
- division-remainder: あまり＜わる数を全件で確認、たしかめ・切り上げ切り捨ての設計が良い。問題なし。
- decimals: 0.1のいくつ分で持つ計算・比較・誤答とも正しい。問題なし。
- fractions: 単位分数・加減・小数との関係は正しい。`figure-alt` の等分でない図が正答になる（**重大**）、絵の選択肢が先頭固定、`compare-alt` の＜偏り。
- box-expression: 逆算・式の選択の誤答設計が良い。`make` ③が答え（中）。
- circle-sphere: 定義・半径直径・球とも正しい。`parts-alt` 先頭固定、`sphere-alt:biggest` ③が答え。
- triangles: 辺・角・円を使った三角形の論理は正しい。`classify-alt:pick` の誤答が二等辺になる組（**重大**）、geometry pick 先頭固定。
- length-km: まきじゃく・km・道のり/きょり・単位の感覚（実測値）とも正しい。`unit-alt` ヒント②が答え。
- weight: はかり3種の目盛り・kg/g/t・計算（ねこの体重の作り方も自然）正しい。`unit-alt` ヒント②が答え。
- time: 時刻計算・正午またぎ・誤答とも正しい。ぷん/ふん のハードコード（軽微）。
- bar-graph: 読み・目盛り・ちがい・並べ方・二次元表とも正しい。`make-alt` 先頭固定、未使用の誤概念。

**g4-math（下請け精読＋私が裏取り）**
- oku-cho 問題なし／rounding 計算正しい・ヒントが言いすぎ／div-1digit 良好／div-2digit ヒント③が答え／decimal-add-sub 良好／decimal-int 4.0 表示と誤概念／fraction-kinds toMixed ③・偏り／fraction-same ③が答え／order-ops **mixed ③が誤手順（重大）**・型欠落／parallel-perp 正しい・誤答の近さが弱い／quadrilaterals 性質正しい・pick 先頭固定・diag-alt ③／cuboid 展開図判定を検証済み・intro 定義・net-alt 先頭固定／area **花だんの文（重大）**・単位換算は正しい／angle 360°超／change-relations 誤概念付け違い・偏り／ratio-intro ア偏り／line-graph change・trend-alt 先頭固定・down-vs-up／two-way-table 問題なし。

**g3-ja（下請け全行精読）**
- romaji: つづり・判定・新告示との整合は正しい（15テスト pass）。②③が確定、長音 aa/uu の説明不足。
- modifiers: 判定は一意。`m-near` が逆（**重大**）、fill 先頭固定、例文再利用。
- reference-connectives: 正答は妥当。ペア型IDの誤用（**重大**）、rule 先頭固定、「すると」未導入。
- dictionary: 並び順の規則・誤概念とも正しい。最も問題が少ない。
- kanji-parts: 部首・部品・配当は正しい。「洋」の見分け、「売」の読み、③の部品名指し。
- proverbs: 31語の意味・文言に誤りなし。sort の一律ID、scene ③の名指し、fill 先頭固定。
- read-paragraphs: 全設問が本文と整合、科学的内容も正しい。まとめ設問の `p-near-para`。
- read-character: 全設問の正解が本文に根拠、複数解なし。`r-feeling-mix` の説明追加。
- write-reasons: 区別・並べ替えの一意性は正しい。`riyuu-match:anzen`（**重大**）。

**g4-ja（下請け全行精読）**
- okurigana: 本則どおりで許容形を誤りにしていない。fill 先頭固定。
- idioms: 40項目の意味・用法正しい。fill 先頭固定、bamen ③。
- plain-polite-style: 判定はすべて正しいが見分け13問が位置で解ける（**重大**）、誤概念1件ずれ。
- info-compare: 表・分類・引用・出典とも誤りなし。ニワトリ要確認。
- read-summary: 本文9本は独自でレベル適切。PENGUIN c2 要確認、MEDAKA の日数。
- read-feelings: 情景と心情の結び付きが本文に根拠。最も問題の少ない単元。分かち書きだけ不統一。
- write-report: 報告文の型の説明は正しい。引用の空欄3問が問題文で解ける。

## 見ていない範囲・限界
- 50単元のソースはすべて読んだが、g4-math／g3-ja／g4-ja の個々の指摘は下請けの読みに依る（重大指摘とエンジンの並び順はソースで裏取り済み）。
- 実機での描画（measure のます・はかり、geometry の draw 判定、numberline、clock）は見ていない。数の判定は `core/answer/number.ts` を読み、分数は値一致（1＝5/5、2/4＝1/2 を正とする）・小数は `places` 指定時のみ形式を直させる、と確認した。
- 自動テスト（vitest）は g3-ja のみ実行（pass）。他パックは前提として合格扱い。

result: 50単元レビュー完了。重大8件（算数: 二等辺三角形の誤答が二等辺／等分でない図が正答になる分数／order-ops の誤った手順ヒント／面積の花だん文。国語: 誤概念IDの系統的逆転2・正解が2つ成立1・文体の見分けが位置で解ける）、中: 絵・図形・グラフ・fill の選択肢で正解が常に先頭になるパック横断の問題（エンジン側の対応が本筋）、ヒント③の答え漏れ多数、360°超の角、計算順序の型欠落ほか。事実・計算・定義の誤りは上記以外に見つからなかった。
