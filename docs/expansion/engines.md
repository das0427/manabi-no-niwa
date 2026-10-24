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
- `joiner?`（英語の語順は `' '`）、`fixedOrder?`、`hideLength?`、`wrongAnswers?: { value, misconception }[]`（parts は `'月+寺'`）。

## 年齢による違い（エンジンが自動で行う）
- 2〜3歳: カードを `ux.maxChoices` に減らし、置き終わると自動で答える。2歳段階は誤答の「？」を出さない。
- 幼児（`ctx.preschool`）: カードを押すと名前を読み上げる（読み上げ設定が off なら読まない）。

<!-- 算数の図・量（clock, measure, numberline, graph, geometry）と、聞く・読む・書く・手順（listen, reading, trace, explain, program）は担当の完了後に統括が追記する -->
