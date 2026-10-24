# エンジンの問題データの書き方（docs/expansion/engines.md）

教材パック担当向け。型の正本は各エンジンのファイル（`src/engines/<id>/<id>.tsx`）、共通項目は `src/curriculum/types.ts` の `ItemBase`。
**各エンジンの見本の問題** が `src/engines/<id>/<id>.samples.ts` にある（書き方に迷ったらまず見る）。

## 共通（ItemBase）
| 項目 | 意味 |
|---|---|
| `id` | 単元内で一意（生成なら式・場面から作る） |
| `objective` | 到達項目の id |
| `level` | 段階（0始まり） |
| `prompt` | 問題文（RichText） |
| `figure?` | 作業領域の図（`src/engines/figure/types.ts`） |
| `hints` | 幼児2段・小学生3段 |
| `explain` / `explainFigure?` | 解説 |
| `identity` | 同一性キー（curriculum-matrix 1.4） |
| `alt?` | 表し方を変えた問題（別例） |

誤りの選択・入力には、どのエンジンでも項目名 `misconception`（または order の `reverseMisconception`）で誤概念IDを付ける（`qa.ts` が全部たどって定義と照らす）。

## choice（選ぶ）
- `options: { label?, figure?, correct?, misconception? }[]`。1つ選ぶ問題は正解1つ。`multi: true` で「すべて選ぶ」（集合一致、こたえあわせ札）。
- `fixedOrder`（大小の順など意味のある並び）、`layout: 'row'|'grid'|'column'`。
- 選択肢の数は区分の上限（`ux.maxChoices`）で切られる。正解を先頭近くに置いても、画面では並べ替える（fixedOrder なし）。

## number（数を入れる）
- `fields: { label?, answer: NumberAnswer }[]`（「商とあまり」「□m□cm」は複数欄）。
- `NumberAnswer`（`src/core/answer/number.ts`）: `int` / `decimal`（places）/ `fraction`（`mustReduce`・`allowImproper`・`allowMixed`・`allowDecimal`）/ `quantity`（`unit`・`acceptUnits`・`tolerance`）。判定は有理数で正確。形だけの違いは「もう一度」。
- `keys?: ('decimal'|'fraction'|'minus')[]`（記号キーは3つまで）。`wrongAnswers: { value, misconception }[]`（複数欄は `'3|2'`）。

## order（並べ替え）
- `cards: Card[]` を**正しい順**に書く（画面で混ぜる）。Card = `{ label?, figure?, name? }`（絵だけのカードは `name` 必須）。横8枚・縦（`layout:'column'`）4枚まで。
- `alsoAccept?`（別の正しい順。番号の列）、`ends?: [はじめ, おわり]`、`wrongOrders?: { order, misconception }[]`、`reverseMisconception?`、`initial?`。

## sort（なかま分け）
- `boxes: Card[]`（2〜4）、`cards: { …Card, box: number | number[], wrongBoxes?: { box, misconception }[] }[]`（2〜10）、`fixedOrder?`。

## match（線でむすぶ）
- `left: Card[]`（2〜6）、`right: Card[]`（left 以上・6まで。まぎらわしいものを足してよい）、`pairs: [左, 右][]`、`wrongPairs?: { pair, misconception }[]`、`fixedOrder?`。

## fill（文の空欄）
- `text`（`{{}}` の数＝blanks の数。`** **` の中に空欄を置かない）、`options`（共通の選択肢 2〜6）、`blanks: { answers: RichText[]（先頭が表示用）, options?, wrong?: { value, misconception }[] }[]`、`useOnce?`。

## build（タイルで作る）
- `tiles`（2〜12。同じ字が2回要るなら2枚）、`answer`: `{ kind:'text', values, ignoreCase? }` / `{ kind:'parts', parts }`（部品の組・順不同）/ `{ kind:'romaji', kana, capital? }`（令和7年告示。訓令式は「もう一度」）。
- `joiner?`（英語の語順は `' '`）、`fixedOrder?`、`hideLength?`、`wrongAnswers?: { value, misconception }[]`（parts は タイルと同じ書き方を + でつなぐ: `'月《つき》+寺《てら》'`。よみの無い漢字は qa の検査で誤りになる）。

## 年齢による違い（エンジンが自動で行う）
- 2〜3歳: カードを `ux.maxChoices` に減らし、置き終わると自動で答える。2歳段階は誤答の「？」を出さない。
- 幼児（`ctx.preschool`）: カードを押すと名前を読み上げる（読み上げ設定が off なら読まない）。

## listen（聞いて選ぶ）
- `audio: { text, key? } | { text, key? }[]`（`text` は鳴らす文。ふだん画面に出さず、正答を見せるときだけ出す。`hideTranscript: true` で出さない）。`key` を省くと教材の音声（`voice:packs` で生成）。**英字を含む文は `key` 必須**（英語の mp3 を `public/audio/<packId>/en/...` に用意。Kokoro）。`gapMs`（複数の音の間。既定 500）。
- `options` 等は choice と同じ。最初の再生が終わるまで選べない（curriculum-matrix 1.7）。

## reading（読解）
- `passage: { id, genre: 'story'|'explain'|'record'|'letter'|'poem'|'chart', title?, paragraphs: RichText[][], numbered?, figure? }`（同じ本文を複数の設問で使い回す）。
- `aspect: 'order'|'character'|'main-sentence'|'gist'|'detail'|'reason'|'feeling'`、`hintFocus: ({ p, s? } | null)[]`（ヒントの段ごとに本文の囲む場所。1始まり）、`evidence`（正答時に下線）。選択肢は choice と同じ。

## trace（書く）
- `char`（1字）、`mode: 'trace'`（書き順でなぞる。v1 と同じ判定）/`'free'`（自由に書いてお手本と見比べる。**採点しない**）/`'trace-free'`。かな・配当漢字は書き順データを自動で引く。英字は `'free'` だけ。
- `tolerance?`（既定: 幼児 90・小学生のかな 75・1年の漢字 90・2〜6年の漢字 75）、`misconceptionIds?: { order?, direction? }`。

## explain（かいてみよう。採点しない）
- `canvas?: { aspect?, guide?: 'none'|'cross'|'lines', colors? }`、`reasons?: { label?, figure? }[]`、`multiReasons?`、`require?: { drawing?, reason? }`。常に正解（求めたものが空のときだけ「もう一度」）。

## program（てじゅん）
- `grid: { w, h, walls? }`（2〜8）、`start: { at: [x,y], dir }`、`goal: [x,y]`、`palette`（小学生: `forward`/`turnRight`/`turnLeft`、幼児: `up`/`down`/`left`/`right`、混ぜない。ほかに `repeat`/`if`）、`solution`（正答の例・必須）、`initial?`（デバッグ問題の誤った列）、`maxCards?`、`repeatTimes?`、`conds?: ('wall-ahead'|'open-ahead')[]`、`misconceptionIds?: { bump, short, turn, repeatCount, tooMany }`、絵 `character`/`goalIllust`/`wallIllust`。

## 算数の図・量（clock, measure, numberline, graph, geometry）共通
- **図はエンジンが描くので、これらの問題には `figure` を付けない**（作業領域の高さが足りなくなる）。
- `misconceptions`: エンジンが自動で見つける誤り（キー）→ 誤概念ID の表。`wrongAnswers`: 決まった誤答の値 → 誤概念ID。
- 置く・合わせる操作は「図を押すと一番近い目盛りへ吸着」＋「◀▶ で1目盛りずつ」。形式だけの違い（2cm15mm、0じかん75ふん 等）は「もう一度」。

## clock（時計）
- `task.kind`: `read`（`answerBy:'choice'` は `options` 時刻の配列＋`halfWord`、`'input'` は「□じ□ふん」・`hourOnly`）/ `pick`（時刻に合う時計を選ぶ。幼児）/ `set`（`target`・`start`・`step` 1/5/10/15/30/60）/ `elapsed`（`start`・`end`、`ask:'duration'`（`unit:'min'|'hm'`）か `'end'`（`answerBy:'input'|'set'`））。時刻は `{h:0〜23, m:0〜59}`。`minuteNumbers`、`dayHalf`。
- 自動の誤り: swapHands・hourNext・hourPrev・minuteNumeral・noCarry・base100。

## measure（ものさし・ます・はかり）
- `instrument: 'ruler'|'masu'|'scale'`、`task: 'read'|'set'`、`scale: { unit, min?, max, minor, mid?, major, labelFactor?, labelUnit? }`（値は基準の単位）、`value`、`from?`、`object?: 'tape'|'pencil'|'line'`、`fields`（大きい単位から `{unit, factor}`）、`keys?: ['decimal']`、`tolerance?`。
- 自動の誤り: fromEnd・fieldSwap・minorAsOne。

## numberline（数直線）
- `line: { min, max, minor（'1/5' と書けば分数の数直線）, midEvery?, majorEvery, labels?, labelAs? }`、`task: { kind:'read', at, answer?, unit?, keys? }` か `{ kind:'place', target, tolerance?, start? }`、`marks?`。数は `3` / `0.4` / `'2/5'`。
- 自動の誤り: minorAsOne・neighborTick。

## graph（表とグラフ）
- `data: { kind: 'bar'|'picture'|'line'|'table'|'pie'|'band', labels, values, scaleStep?, labelEvery?, max?, min?, unit?, header?, illust?, title? }`（pie・band は % で合計100、読むだけ）。
- `task: { kind:'choice', options, multi? }` / `{ kind:'number', fields, keys?, wrongAnswers? }` / `{ kind:'make', initial?, snap?, showTable? }`（make は `data.max` 必須）。
- 自動の誤り: scaleAsOne。

## geometry（図形）
- `task: { kind:'pick', options: { shape?: { points }, figure?, label?, correct?, misconception? }[], multi? }` / `{ kind:'draw', grid: { w, h }, given?, target }` / `{ kind:'angle', degrees, base?, protractor?, tolerance? }`（既定 ±2度）。
- draw の `target`: `exact` / `congruent`（allowFlip）/ `similar`（ratio）/ `reflect`（axis）/ `rotate180`（center）/ `shape`（shape・sides・exclusive）/ `perpendicular`・`parallel`（to・through）。格子は小2なら h≤4 を勧める（点の間隔を広く）。
- 自動の誤り: translated・sameSize・wrongSides・wrongClass・swapPerpPar・notThrough・otherScale・reflexComplement。

## map（地図: 都道府県・地図記号・方位）
- **図はエンジンが描くので `figure` を付けない**。日本地図は Natural Earth（パブリックドメイン）を簡略化したもの（出典・離島の扱いは `docs/assets-pipeline.md` 6節）。都道府県はコード（1〜47）で書く。
- `task.kind`:
  - `name`: 印の都道府県の名前を選ぶ。`pref`、`options`（コード。pref を含む 2〜6）、`view?`、`nameStyle?: 'ruby'|'kana'|'kanji'`（kanji は漢字を学ぶ問題用。よみは音声だけ）
  - `spell`: 印の都道府県の名前をかなのタイルで入れる。`tiles`（2〜12）、`withSuffix?`（既定は「ぎふ」「ぎふけん」どちらも正解）。判定は build と同じ
  - `find`: 名前の都道府県を地図でタップ→こたえあわせ。`prefs`（2つ以上なら全部。順不同）、`view?`、`showRegions?`。**東京・大阪・香川・神奈川・佐賀などは全国の図では約 1u しかない**ので `view`（地方の図）を使う（小さい県は輪郭の少し外のタップも当たり）
  - `region`: 印の都道府県の地方を選ぶ。`options`（RegionId 2〜8）、`showRegions?`（地方を色＋模様＋番号で塗る。見本の札にも模様と番号）
  - `bearing`: `from` から見た `to` の方位（ピンの位置で測る）。`points?: 4|8`（既定 8）。方位の境目に近い組は check で止まる（八方位は境目から 7度以上）。囲み（沖縄など）の県は使えない
  - `symbol`: `ask:'name'`（記号を見て名前）/`'pick'`（名前を見て記号）、`symbol`、`options`（2〜6）。記号は `SymbolId`（`symbols.tsx`。市役所・町村役場・学校・高等学校・警察署・交番・消防署・郵便局・病院・神社・寺・図書館・博物館・工場・発電所・田・畑・果樹園・茶畑・広葉樹林・針葉樹林・老人ホーム・温泉・城跡・灯台・港・駅）
  - `town`: 絵地図（ます目 2〜8）。`places: { symbol, at:[x,y], label? }[]`、`roads?`・`rail?`（折れ線）、`answer`（場所の番号）。`from`＋`dir` で「駅の 北に ある もの」（その方位に場所が1つだけであることを check）。from・dir が無いときは答えの記号が1つだけ
  - `compass`: `ask:'name'`（矢印の方位の名前を選ぶ）/`'point'`（方位の形に並んだ札から選ぶ。`given` の方位だけ名前を見せる）、`dir`、`points?: 4|8`（既定 4）
- `view?: 'japan' | RegionId`（`hokkaido`・`tohoku`・`kanto`・`chubu`・`kinki`・`chugoku`・`shikoku`・`kyushu`）。地方の図に沖縄は出ない。
- 自動の誤り（`misconceptions`）: neighbor（となりの県）・sameRegion（同じ地方の県）・opposite（反対の方位）・mirrorEW（東西の取り違え）・missing（ぜんぶ選ぶ問題で足りない）。`wrongAnswers: { value, misconception }[]`（value は コード・地方・記号・方位・場所の番号・かなの文字列）が先に効く。
- 道具: `prefName(code, style)`・`prefsOfRegion(region)`・`prefBearing(from, to)`・`neighborsOf(code)`（`japan.ts`）。

## experiment（実験のシミュレーション）
- 条件の札を選ぶ →「やってみる」→ 結果の表に記録 → 設問。画面に「この アプリの せっていでは こう なるよ（じっけんの かわりでは ないよ）」を常に出す。結果は**例示**（単純な式か問題データの固定表）。火・薬品の手順は書かない。
- `setup.kind`（候補の値が1つだけの条件は固定として1行にまとめて見せる）:
  - `pendulum`: `length`（cm）・`weight`（g）・`amplitude`（度 1〜45）。1往復の時間 = 2π√(長さ/980) を 0.1秒に丸める（重さ・振れ幅では変わらない）。結果の key は `'1.4'` など
  - `lever`: `leftPos`・`rightPos`（1〜6）・`leftWeight`・`rightWeight`（g。10g ごとにおもり1こを描く）。位置×重さを比べる。key は `'balance'|'left'|'right'`（下がる側）
  - `circuit`: `device: 'bulb'|'motor'`、`cells`（1・2）、`connection`（`'series'|'parallel'`。1個のときは選べない）、`direction?`（モーターの向き）。key: 豆電球 `'bright'|'normal'`、モーター `'fast'|'normal'`（direction があれば `'fast-cw'` など）
  - `table`: `factors: { id, label, values: { id, label }[] }[]`、`output`（結果の列名）、`rows: { when, result, key?, figure? }[]`（条件の組を**全部**1行ずつ。磁石・電気の利用・p5 の予想など）
- `task.kind`:
  - `consider`: 考察の設問。`options`（choice と同じ）・`multi?`・`minTrials?`（既定 2 回やると「こたえる」が押せる）
  - `reach`: 結果が `target`（上の key）になる条件を作って「これで こたえる」。はじめの条件（`initial?`）でもう target になる問題は check で止まる。`wrongConditions?: { when, misconception }[]`
  - `control`: 条件制御。`factor` だけを変えた2回の実験を記録して「こたえあわせ」
- 自動の誤り（`misconceptions`）: weightOnly・distanceOnly（てこ: 重さだけ／位置だけそろえた）・seriesParallel（直列と並列の取り違え）・changedMany（2つ以上を同時に変えた）・notChanged（調べる条件を変えていない）。