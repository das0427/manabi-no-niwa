# P2 設計書: そろばん（g3.math.abacus・g4.math.abacus）

版 1（2026-10-30）／設計: Opus（設計担当）／宛先: 実装担当（Sonnet）、統括（Opus）
対象パック: `g3-math`、`g4-math`。基点ブランチ `p3-unimplemented`。

この設計書だけで実装できるように、文・定義域・誤答・ヒント・解説の型をすべて書く。迷ったら本書 → curriculum-matrix → pack-brief の順に従う。

---

## 0. 決定事項（先に読む）

1. **abacus エンジンは作らない**（curriculum-matrix 2.6・統括の判断 1「abacus は作らず P2」）。本体のコードは変えない。
   そろばんは **図 `figure: { kind: 'svg' }`（パックが作る SVG）** で描き、答えは既存の **number**（数を入れる）と **choice**（選ぶ。選択肢を図にできる）で受ける。珠をタップで動かす操作は無い（2.6 の「採らない場合」）。
   - そのため、そろばんの技能のうち「珠の動かし方」は、**補数（5の あわせ・10の あわせ）でいくつ入れる／はらうか** と **動かしたあとの そろばんを選ぶ** の2つで問う。
2. **SVG は図のデータ（数字の列）から作る**（1.8-4: 図・式・読み上げを同じデータから）。文字（漢字）は SVG に描かない。
3. パックは他のパックを import できないので、**SVG を作る関数は g3-math と g4-math にそれぞれ置く**（同じ中身。ファイル `src/packs/<packId>/abacus-svg.ts`）。共有化は統括への提案に書く（報告 7章）。
4. 絵（Illust）は新しく描かない。単元のアイコンは既存の `'subj-sansu'`（g3 large-numbers と同じ）。
5. 両単元とも **種別 concept（概）**、`priority: 'P2'`、目標 `status: 'ready'`（Q≥1・C 全部・汎用誤答 20% 以下）。`review: 'objective'`（SR観）。
6. 編集してよいファイル: `src/packs/g3-math/**`、`src/packs/g4-math/**`（index.ts への追加・util や ruby 辞書への追記を含む）。`src/curriculum/unit-index.json` は `npm run build:unit-index` で作り直してよい。それ以外は変えない。
7. 書き方は同じパックの P1 単元にそろえる:
   - g3: `large-numbers.ts` と同じ。文に《よみ》を**手で**付ける。`util.ts` の `wrongList(correct, fields, cands)`・`pickObj`・`pickOne` を使う。単元の `revised: '2026-10-30'`。
   - g4: `oku-cho.ts` と同じ。文は自然に書き、`finishUnit()`（`ruby.ts` の辞書で自動《よみ》）で包む。`util.ts` の `wrongList(answers, cands)`・`opts`・`pick`・`pickObj`・`dec`・`svg`・`STROKE` を使う。`revised: '2026-10-30'`（`REVISED` は 10-24 なので使わず文字で書く）。

---

## 1. 共通: そろばんの図（abacus-svg.ts）

### 1.1 関数

```ts
/** 1本のけたの珠: 五だまが はりに ついているか、はりに ついた 一だまの数（0〜4） */
export function beadsOf(d: number): { five: boolean; ones: number } // d: 0〜9
export function digitOf(b: { five: boolean; ones: number }): number

export interface AbacusLayout { rods: number; unitRod: number } // unitRod: 一の位のけたの番号（左から0始まり）
export const G3_READ:  AbacusLayout = { rods: 7, unitRod: 5 }; // 整数5けた（十万は空き）+ 小数1けた
export const G3_SET:   AbacusLayout = { rods: 6, unitRod: 4 }; // 選択肢用。整数5けた + 小数1けた
export const G3_SMALL: AbacusLayout = { rods: 4, unitRod: 3 }; // 2けたの計算・選択肢
export const G4_READ:  AbacusLayout = { rods: 9, unitRod: 6 }; // 整数7けた + 小数2けた
export const G4_SET:   AbacusLayout = { rods: 6, unitRod: 3 }; // 選択肢用。整数4けた + 小数2けた
export const G4_SMALL: AbacusLayout = { rods: 4, unitRod: 3 }; // 4けたまでの計算・選択肢
// （g3 の abacus-svg.ts には G3_*、g4 には G4_* だけを書けばよい）

/**
 * 値をけたの数字の列にする。value は「最小のけたの単位」の整数で渡す:
 *  scale = 小数のけた数（rods - 1 - unitRod）。例 G3_READ で 23.5 → units=235, scale=1
 * 戻り値: 左から rods 個の数字（0〜9）。入りきらないときは throw（生成器の誤り）
 */
export function rodDigits(layout: AbacusLayout, units: number): number[]

/** そろばんの図（Figure の kind 'svg'） */
export function abacusFig(
  layout: AbacusLayout,
  digits: number[],          // rodDigits の結果（または誤答用に作った列）
  opt?: { lit?: boolean;     // はりに ついた珠を var(--sun) で塗る（導入・解説だけ。問題には使わない）
          mark?: number[] }  // 強調するけた（解説・ヒント用。けたの後ろに薄い帯）
): Figure
```

- 誤答の選択肢の図は「数字の列」を変えて作る（2章・3章の各誤答の作り方）。値に直せない列（例: 五だまを1と数えた結果など）は作らない。
- `label` は常に `'そろばん'`（読み上げで答えを言わない）。

### 1.2 形（viewBox の単位。実装はこの数のまま）

| 部分 | 指定 |
|---|---|
| 幅・高さ | `W = 22*2 + rods*44`、`H = 240`。`viewBox="0 0 W 240"` |
| けたの中心 | `cx(i) = 22 + 44*i + 22` |
| わく | `<rect x="6" y="6" width="W-12" height="206" rx="8" fill="var(--paper)" stroke="var(--ink)" stroke-width="3.5"/>` |
| 軸（けたの棒） | 各けたに `<line x1=cx y1="12" x2=cx y2="206" stroke="var(--ink-soft)" stroke-width="2"/>` |
| はり | `<rect x="6" y="66" width="W-12" height="10" fill="var(--ink)"/>` |
| 定位点 | はりの上に `<circle cx=cx(i) cy="71" r="3.5" fill="var(--paper)"/>`。`(unitRod - i) % 3 === 0` のけた全部（▲のけたを含む） |
| ▲（一の位の印） | わくの下に `<polygon points="cx-9,234 cx+9,234 cx,220" fill="var(--ink)"/>`（unitRod のけただけ） |
| 珠の形 | ひし形 `points="cx-18,cy cx,cy-11 cx+18,cy cx,cy+11"`、`fill="var(--wood)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"`。lit のとき はりに ついた珠だけ `fill="var(--sun)"` |
| 五だま | はりに つく: `cy = 55`。はなれる: `cy = 25` |
| 一だま（上から k=0..3） | はりに つく（k < ones）: `cy = 87 + 22*k`。はなれる（k ≥ ones）: `cy = 195 - 22*(3-k)` |
| 強調（mark） | 軸より先に `<rect x=cx-21 y="12" width="42" height="194" rx="6" fill="var(--sun)" fill-opacity="0.35"/>` |

- はりについた珠と離れた珠の間は常に 42 あく（位置で区別できる。色だけで区別しない: DESINGN 3.1）。
- 色は上の CSS 変数だけ（`palette.ts`・tokens の名前）。`<text>` は描かない。`<script>`・`on*=`・`href` を書かない（qa の `unsafeSvgsOf`）。
- 4けた（`*_SMALL`）は幅 220、6けたは 308、7けたは 352、9けたは 440。選択肢の図は `layout: 'grid'`（2×2）。

### 1.3 共通の部品（数字の列の操作。各パックの abacus-svg.ts に置く）

| 関数 | 中身 |
|---|---|
| `spanOf(digits)` | 0 でない数字のある いちばん左のけた〜unitRod（小数があれば いちばん右の 0 でないけた）までの範囲。「数のけた」 |
| `fiveAsOne(digits)` | 範囲のけたの d≥5 を d−4 にした列を **値に直した数**（五だまを1と数えた読み）。読み問題の誤答 |
| `lowerAway(digits)` | 範囲のけたの d を `(d>=5?5:0) + (4 - d%5)` にした列（はりから離れた一だまを数えた）。読み問題の誤答の値・選択肢の図の両方に使う |
| `fiveMissing(digits)` | d≥5 を d−5 にした列（五だまを入れ忘れた置き方）。選択肢の図 |
| `shiftLeft(digits)` | 全体を1けた左へ（値×10）。右端に0。左端からはみ出すなら null |
| `zeroSkip(digits)` | 範囲の中の 0 を詰め、先頭のけたは そのまま・残りを左へ詰めた列（「2.07 → 2.7」「305 → 350」）。範囲に0が無ければ null |

---

## 2. g3.math.abacus（そろばん）

### 2.1 単元の値

| 項目 | 値 |
|---|---|
| id | `g3.math.abacus` |
| title | `'そろばん'` |
| stage / subject / domain / kind | `'g3'` / `'math'` / `'A-number'` / `'concept'` |
| priority / status | `'P2'` / `'ready'` |
| icon | `'subj-sansu'` |
| prereq | `['g3.math.large-numbers']` |
| review | `'objective'` |
| basis | `'小学校学習指導要領（平成29年告示）算数 第3学年 A 数と計算「そろばん」（そろばんによる数の表し方、簡単な加法及び減法の計算の仕方。そろばんの仕組みに着目し、大きな数や小数の計算の仕方を考える）。5・10の補数の扱いの学年の分け方（3年: 1つの補数で済む計算、4年: 5と10の補数を続けて使う計算）は本アプリの案'` |
| gradeIsAppProposal | 付けない（学年は指導要領で確定。補数の分け方は basis に書いた） |
| revised | `'2026-10-30'` |
| ファイル | `src/packs/g3-math/abacus.ts`（`export const abacus: UnitSpec`）、`src/packs/g3-math/abacus-svg.ts`。`index.ts` の units の**最後**（barGraph の後）に足す |

漢字の制約（g3 のテスト `overGrade`）: **位・億・兆・置・定位点は使わない**（4年以上の字）。「一の位」は「一《いち》の くらい」、「定位点」は「▲」と「点《てん》」で言う。そろばんの部分の名前は かな（はり・けた）と「五《ご》だま」「一《いち》だま」。

### 2.2 到達項目（6）

| id | title（そのまま書く） |
|---|---|
| `read` | `'そろばんの 数《かず》を 読《よ》む'` |
| `set` | `'数《かず》を そろばんに おく'` |
| `direct` | `'たまを 入《い》れる・はらう（たし算《ざん》・ひき算《ざん》）'` |
| `five` | `'5の あわせ（五《ご》だまを つかう 計算《けいさん》）'` |
| `ten` | `'10の あわせ（くり上《あ》がり・くり下《さ》がり）'` |
| `bigdec` | `'大《おお》きな 数《かず》・小数《しょうすう》の 計算《けいさん》'` |

### 2.3 段階（levels）と出す到達項目

| 段階 | label | chance | 出す到達項目（`pickObj` で均等） |
|---|---|---|---|
| 0 | `'そろばんの 数'` | 0.05 | read, set, direct |
| 1 | `'5の あわせ'` | 0.05 | five, direct, read |
| 2 | `'10の あわせ'` | 0.05 | ten, five, set |
| 3 | `'大きな数・小数'` | 0.05 | bigdec, ten, read |

`alt = rng.next() < 0.25`（large-numbers と同じ）。ただし read の段階0は alt を作らない（表の問題は段階1以上）。

### 2.4 誤概念（10）

| id | explain（そのまま書く） |
|---|---|
| `five-as-one` | `'五《ご》だまを 1と 数《かぞ》えたのかな。上《うえ》の 五《ご》だまは 1こで 5だよ。'` |
| `lower-away` | `'はりから はなれた たまを 数《かぞ》えたのかな。はりに くっついた たまだけを 数《かぞ》えよう。'` |
| `five-missing` | `'五《ご》だまを 入《い》れわすれたのかな。5から 9の 数字《すうじ》は、五《ご》だまを 入《い》れてから 一《いち》だまを 足《た》すよ。'` |
| `place-shift` | `'けたが 1つ ずれたのかな。▲の けたが 一《いち》の くらい。そこから 左《ひだり》へ 十《じゅう》・百《ひゃく》・千《せん》と 数《かぞ》えよう。'` |
| `zero-skip` | `'何《なに》も ない けたを とばしたのかな。たまが はりに ついて いない けたは 0だよ。'` |
| `unit-point` | `'▲の けたを まちがえたのかな。うごかす けたが ▲から いくつ 左《ひだり》か 右《みぎ》かで、数《かず》の 大《おお》きさが きまるよ。'` |
| `in-out` | `'入《い》れると はらうを 反対《はんたい》に したのかな。たす ときは はりに 入《い》れる、ひく ときは はりから はらうよ。'` |
| `complement-same` | `'たす 数《かず》や ひく 数《かず》を、そのまま はらったり 入《い》れたり したのかな。5や 10を 入《い》れすぎた ぶんだけ はらうよ。4 ＋ 3 なら、5を 入《い》れて 2を はらう。'` |
| `complement-mix` | `'5の あわせと 10の あわせを まちがえたのかな。五《ご》だまを つかう ときは 5の あわせ、となりの けたに 1 入《い》れる ときは 10の あわせだよ。'` |
| `half-move` | `'たまの うごかし方《かた》が とちゅうで おわったのかな。5や 10を 入《い》れたら、多《おお》い ぶんを はらう ところまで しよう。'` |

`complement-same` には `figure: { kind: 'text', text: '3 ＝ 5 − 2', size: 'l' }`、`five-as-one` には `figure: abacusFig(G3_SMALL, rodDigits(G3_SMALL, 7), { lit: true })` を付ける。

### 2.5 導入（intro、4場面）

1. text `'そろばんの 上《うえ》の たまを 五《ご》だま、下《した》の たまを 一《いち》だまと いいます。まん中の 横《よこ》の ぼうが はりです。'` figure `abacusFig(G3_SMALL, [0,0,0,0])`
2. text `'はりに くっついた たまだけを 数《かぞ》えます。五《ご》だまは 5、一《いち》だまは 1こで 1。この けたは 5と 2で 7です。'` figure `abacusFig(G3_SMALL, [0,0,0,7], { lit: true })`
3. text `'▲の けたが 一《いち》の くらい。左《ひだり》へ 十《じゅう》・百《ひゃく》・千《せん》の くらい。たまが はりに ついて いない けたは 0です。'` figure `{ kind:'column', items:[abacusFig(G3_SMALL,[3,0,5,2],{lit:true}), {kind:'text', text:'3052', size:'xl'}] }`
4. text `'たす ときは たまを はりに 入《い》れ、ひく ときは はらいます。3 ＋ 4 は、五《ご》だまを 入《い》れて 一《いち》だまを 1こ はらいます（4 ＝ 5 − 1）。'` figure `{ kind:'row', items:[abacusFig(G3_SMALL,[0,0,0,3]), {kind:'text', text:'→', size:'l'}, abacusFig(G3_SMALL,[0,0,0,7])] }`

### 2.6 問題の型

表記: `P(i)` = くらいの名前（`'一《いち》' '十《じゅう》' '百《ひゃく》' '千《せん》' '一万《いちまん》' '十万《じゅうまん》'`、util の `PLACE` と同じ）。`op` は `'＋'` か `'−'`（U+2212。P1 と同じ）。`入る/はらう` は op に合わせて `入《い》れる`/`はらう`。

#### (1) read — 数を読む（number）

- **定義域**（段階で変える。どれも一様に選ぶ）:
  - 段階0: `n` = 1〜99 の整数（99通り）。
  - 段階1・2: けた数 `L` を {2,3,4,5} から一様 → `n` を [10^(L−1), 10^L − 1] から一様。
  - 段階3: 半分は段階1と同じ整数。半分は小数 `t` = 1〜999 のうち 10 の倍数でないもの（900通り）から一様、値は t/10（0.1〜99.9）。
- figure: `abacusFig(G3_READ, rodDigits(G3_READ, n*10 または t))`（小数のけたは G3_READ の右端）。
- prompt: `'この そろばんの 数《かず》は いくつ？'`
- fields: 整数 `{ answer: { kind:'int', value:n } }`／小数 `{ answer: { kind:'decimal', value:t/10 } }` と `keys: ['decimal']`。
- wrongAnswers（`wrongList(String(ans), 1, …)`）: `[fiveAsOne, 'five-as-one']`、`[lowerAway の値, 'lower-away']`、`[ans×10, 'place-shift']`（小数は t を整数として読んだ値）、`[zeroSkip の値, 'zero-skip']`（整数で範囲に0があるときだけ）。
- identity: `read:${n}`（小数は `read:${t/10}` を文字で。例 `read:23.5`）。id: `read:${…}`。
- hints（3段）:
  1. `'はりに くっついた たまだけを 数《かぞ》えよう。▲の けたが 一《いち》の くらいだよ。'`
  2. 整数: `` `数《かず》の ある いちばん 左《ひだり》の けたは ${P(L-1)}の くらいだよ。` ``／小数: `'▲の すぐ 右《みぎ》の けたは、0.1が いくつ あるかを あらわすよ。'`
  3. `` `上《うえ》の けたから ${最後の1けたを除いた数字を「、」で}。さいごの けたは いくつかな。` ``（1けたの数は `'五《ご》だまが ついて いたら 5、それに 一《いち》だまの 数《かず》を 足《た》そう。'`）
- explain: `` `${くらいごとに「${P(i)}の くらいが ${d}」を「、」で}。たまが ない けたは 0なので、${ans}です。` ``（小数は最後を `'▲の 右《みぎ》の けたが ${d}で、'` に）。explainFigure: 同じ図に `{ lit: true }`。
- **alt `read-table`**（段階1〜3。整数だけ、定義域は段階1と同じ）:
  - prompt: `'たまの ようすを 表《ひょう》に しました。この 数《かず》は いくつ？'`
  - figure: `{ kind:'table', header:['', …数のけたの P(i)（大きい順）], rows:[['五《ご》だま', …(d>=5 ? '入《はい》る' : '－')], ['一《いち》だま', …`${d%5}こ`]] }`
  - wrongAnswers: five-as-one（五だまの欄を1と数えた値）、`[n×10,'place-shift']`、zero-skip（0があるとき）。
  - hints: `'五《ご》だまが 入《はい》って いると 5、一《いち》だまは 1こで 1だよ。'` ／ `` `${P(L-1)}の くらいは ${最上位の数字}。` `` ／ `'のこりの けたも 1つずつ 数字《すうじ》に しよう。「－」と「0こ」の けたは 0だよ。'`
  - explain: `` `${くらいごとに「${P(i)}の くらいは ${d}」}。だから ${n}です。` ``
  - identity: `read-table:${n}`。

#### (2) set — 数をおく（choice、選択肢は図）

- **定義域 SET3**: `n` = 100〜9999 のうち「5〜9 の数字を1つ以上含む」かつ「範囲のけたに d%5≠2 のけたが1つ以上ある」もの。配列に列挙して一様に選ぶ（テストで大きさを出す）。
- prompt: `` `${n}を おいた そろばんは どれ？` ``、`layout: 'grid'`。
- options（4つ。どれも `label` なし・`figure` だけ）:
  - 正解 `abacusFig(G3_SET, rodDigits(G3_SET, n*10))`
  - `shiftLeft` の図 → `'place-shift'`
  - `fiveMissing` の図 → `'five-missing'`
  - `lowerAway` の図 → `'lower-away'`
  （どれも正解と違う列になることは定義域の条件で保証。テストで確かめる）
- identity: `set:${n}`。
- hints: `'▲の けたが 一《いち》の くらい。そこから 左《ひだり》へ くらいを 数《かぞ》えよう。'` ／ `` `${n}は ${L}けた。いちばん 上《うえ》は ${P(L-1)}の くらいで ${最上位}。` `` ／ `'5から 9の 数字《すうじ》の けたは、五《ご》だまが はりに ついて いるかを 見《み》よう。'`
- explain: `` `▲の けたが 一《いち》の くらい。${くらいごとに「${P(i)}の くらいは ${d}（${desc(d)}）」を「、」で}。` `` desc(d): d=0 `'たまなし'`、d<5 `'一《いち》だま ${d}こ'`、d=5 `'五《ご》だま'`、d>5 `'五《ご》だまと 一《いち》だま ${d-5}こ'`。explainFigure: 正解の図 lit。
- **alt `set-kanji`**: 同じ定義域。prompt `'漢字《かんじ》で 書《か》いた 数《かず》を おいた そろばんは どれ？'`、figure `{ kind:'text', text: kanjiNumber(n), size:'xl' }`（`kanjiNumber` は同じパックの `./large-numbers` から import してよい）。options・hints・explain は set と同じ（explain の先頭に `` `数字《すうじ》で 書《か》くと ${n}。` ``）。identity `set-kanji:${n}`。

#### (3) direct — たまを入れる・はらう（number）

- **定義域 DIRECT（900通り）**: `a` = 10〜99、けた `r` ∈ {0: 一, 1: 十}、動かし方 `mv`:
  - `in k`（一だまを k こ入れる, k=1〜4）: そのけたの数字 d が `d%5 + k ≤ 4`
  - `out k`（一だまを k こはらう）: `d%5 ≥ k`
  - `five-in`（五だまを入れる）: `d < 5`／`five-out`（五だまをはらう）: `d ≥ 5`
  正しい組を全部列挙して一様に選ぶ。
- figure: `abacusFig(G3_SMALL, rodDigits(G3_SMALL, a))`
- prompt: `` `${P(r)}の くらいで、${mvText}。いくつに なる？` `` mvText: `'一《いち》だまを ${k}こ 入《い》れる'` / `'一《いち》だまを ${k}こ はらう'` / `'五《ご》だまを 入《い》れる'` / `'五《ご》だまを はらう'`
- 答え: `a ± k·10^r`、五だまは `a ± 5·10^r`。fields int。
- wrongAnswers: `[a ± (同じ数)·10^(1−r), 'place-shift']`（0〜99 のとき）、`[a ∓ 同じ数·10^r, 'in-out']`（0以上）、五だまのとき `[a ± 10^r, 'five-as-one']`。
- identity `direct:${a}:${r}:${mv}`（mv は `in2`・`out1`・`f-in`・`f-out` のような文字）。
- hints: `'入《い》れると たす、はらうと ひく だよ。'` ／ `` `うごくのは ${P(r)}の くらいの たま。いまは ${d}だよ。` `` ／ `` `${P(r)}の くらいは ${d} ${op} ${e}に なるよ。ほかの けたは そのまま。` ``（e = k か 5）
- explain: `` `${P(r)}の くらいの ${d}が ${d±e}に なります。答《こた》えは ${ans}です。` `` explainFigure: 答えの図 lit・mark=[動いたけた]。
- **alt `direct-alt`（choice・図）**: 定義域 DIRECT_ALT: `a` = 10〜99、`b` ∈ {1〜9, 10,20,…,90}、op ∈ {＋, −}、b の数字 e を対応するけたの数字 d に「そのまま」足せる／引ける（`directAdd(d,e)`: e<5 なら d%5+e≤4、e≥5 なら d<5 かつ d%5+(e−5)≤4。`directSub(d,e)`: e<5 なら d%5≥e、e≥5 なら d≥5 かつ d%5≥e−5）もの、かつ下の選択肢が3つ以上できるもの。列挙して一様（約1150通り。テストで数を出す）。
  - prompt `` `${a} ${op} ${b} を した あとの そろばんは どれ？` ``、`layout:'grid'`
  - options（図。重複は除く・4つまで）: 正解 a op b ／ もう一方のけたで同じ数字を動かした値（b<10 なら a op 10b、b≥10 なら a op b/10。0〜99 のとき）→ `'place-shift'` ／ a（逆の op）b（0〜99）→ `'in-out'` ／ 正解の `lowerAway` 図 → `'lower-away'`。
  - hints: `` `${b}は ${b<10 ? '一《いち》' : '十《じゅう》'}の くらいの たまを うごかすよ。` `` ／ `'たす ときは 入《い》れる、ひく ときは はらう。'` ／ `` `${P(r)}の くらいが ${d} ${op} ${e}に なった そろばんを さがそう。` ``
  - explain: `` `${P(r)}の くらいで ${e}を ${入れて/はらって}、${a} ${op} ${b} ＝ ${ans}。` ``
  - identity `direct-alt:${a}${op}${b}`。

#### (4) five — 5の あわせ（number）

- **定義域 FIVE（20通り）**: たし算 `1+4 2+3 2+4 3+2 3+3 3+4 4+1 4+2 4+3 4+4`、ひき算 `5−1 5−2 5−3 5−4 6−2 6−3 6−4 7−3 7−4 8−4`。一様に選ぶ。
- figure: `abacusFig(G3_SMALL, [0,0,0,a])`、fields `[{ answer:{kind:'int', value: 5−b}, unit:'こ' }]`
- prompt: たし算 `` `${a} ＋ ${b}。五《ご》だまを 入《い》れて、一《いち》だまを いくつ はらう？` ``／ひき算 `` `${a} − ${b}。一《いち》だまを いくつ 入《い》れて、五《ご》だまを はらう？` ``
- wrongAnswers: `[b, 'complement-same']`、`[10−b, 'complement-mix']`。
- hints（たし算）: `` `一《いち》だまは あと ${4−a}こしか 入《い》らないね。` `` ／ `` `5を 入《い》れると、${b}より 多《おお》く 入《い》れた ことに なるよ。` `` ／ `` `${b} と □ で 5。□を はらうよ。` ``
  hints（ひき算）: `` `一《いち》だまは ${a−5}こしか ないので、${b}こは はらえないね。` `` ／ `'5を はらうと ひきすぎるので、ひきすぎた ぶんを 入《い》れて おくよ。'` ／ `` `${b} と □ で 5。□を 入《い》れるよ。` ``
- explain: たし算 `` `${b}は 5より ${5−b} 小《ちい》さい。だから 5を 入《い》れて ${5−b}を はらいます。${a} ＋ ${b} ＝ ${a+b}。` ``／ひき算 `` `${b}は 5より ${5−b} 小《ちい》さい。だから ${5−b}を 入《い》れて 5を はらいます。${a} − ${b} ＝ ${a−b}。` `` explainFigure: 答えの図 lit。
- identity `five:${a}${op}${b}`。
- **alt `five-alt`（choice・図、20通り）**: prompt `` `${a} ${op} ${b} を した あとの そろばんは どれ？` ``、options（G3_SMALL の図。重複除く）:
  - たし算: 正解 a+b ／ a+5 → `'half-move'` ／ a+5−b → `'complement-same'` ／ a−(5−b)（0以上）→ `'half-move'`
  - ひき算: 正解 a−b ／ a−5 → `'half-move'` ／ a−5+b → `'complement-same'` ／ a+(5−b)（9以下）→ `'half-move'`
  - hints は (4) と同じ1・2段、3段は `'五《ご》だまと 一《いち》だまの 両方《りょうほう》が うごいた そろばんを さがそう。'`。explain は (4) と同じ。identity `five-alt:${a}${op}${b}`。

#### (5) ten — 10の あわせ（number）

- **定義域 TEN（70通り）**: 「10の補数だけで済む（はらう／入れるが5の補数なしで直接できる）」組。
  - たし算35: `1+9 2+8 2+9 3+7 3+8 3+9 4+6 4+7 4+8 4+9 5+5 6+4 6+5 6+9 7+3 7+4 7+5 7+8 7+9 8+2 8+3 8+4 8+5 8+7 8+8 8+9 9+1 9+2 9+3 9+4 9+5 9+6 9+7 9+8 9+9`
  - ひき算35: `10−1 10−2 10−3 10−4 10−5 10−6 10−7 10−8 10−9 11−2 11−3 11−4 11−5 11−7 11−8 11−9 12−3 12−4 12−5 12−8 12−9 13−4 13−5 13−9 14−5 15−6 15−7 15−8 15−9 16−7 16−8 16−9 17−8 17−9 18−9`
  - 実装は列挙で作る（たし算: a,b∈1..9, a+b≥10, `directSub(a, 10−b)`。ひき算: 10+a1, a1∈0..8, b∈a1+1..9, `directAdd(a1, 10−b)`）。テストで 35+35 を確かめる。残りの20組（5の補数も要る）は g4 の hosu で扱う。
- figure: `abacusFig(G3_SMALL, rodDigits(G3_SMALL, a))`（a はたし算の左の数、ひき算は 10+a1）、fields `[{ answer:{kind:'int', value:10−b} }]`
- prompt: たし算 `` `${a} ＋ ${b}。十《じゅう》の くらいに 1 入《い》れたら、一《いち》の くらいで いくつ はらう？` ``／ひき算 `` `${A} − ${b}。十《じゅう》の くらいで 1 はらったら、一《いち》の くらいに いくつ 入《い》れる？` ``
- wrongAnswers: `[b, 'complement-same']`、`[5−b, 'complement-mix']`（b<5）、`[b−5, 'complement-mix']`（b>5）。
- hints（たし算）: `` `${a} ＋ ${b}は 10を こえるね。` `` ／ `'十《じゅう》の くらいに 1 入《い》れると、10 たした ことに なるよ。'` ／ `` `${b} と □ で 10。□を はらうよ。` ``
  hints（ひき算）: `` `一《いち》の くらいの ${a1}から ${b}は ひけないね。` `` ／ `'十《じゅう》の くらいで 1 はらうと、10 ひいた ことに なるよ。'` ／ `` `${b} と □ で 10。□を 入《い》れるよ。` ``
- explain: たし算 `` `${b}は 10より ${10−b} 小《ちい》さい。十《じゅう》の くらいに 1 入《い》れて、一《いち》の くらいから ${10−b}を はらいます。${a} ＋ ${b} ＝ ${a+b}。` ``／ひき算 `` `${b}は 10より ${10−b} 小《ちい》さい。十《じゅう》の くらいで 1 はらって、一《いち》の くらいに ${10−b}を 入《い》れます。${A} − ${b} ＝ ${A−b}。` ``
- identity `ten:${a}${op}${b}`（ひき算は `ten:${A}−${b}`）。
- **alt `ten-alt`（choice・図、70通り）**: prompt は five-alt と同じ型。options:
  - たし算: 正解 a+b ／ a+10 → `'half-move'` ／ a+10−b → `'complement-same'` ／ a−(10−b)（0以上）→ `'half-move'`
  - ひき算: 正解 A−b ／ A−10 → `'half-move'` ／ A−10+b → `'complement-same'` ／ A+(10−b)（99以下）→ `'half-move'`
  - hints 3段目 `'十《じゅう》の くらいと 一《いち》の くらいの 両方《りょうほう》が うごいた そろばんを さがそう。'`。identity `ten-alt:…`。

#### (6) bigdec — 大きな数・小数（number）

段階3だけ。`kind` を {big, dec} から一様に選ぶ。

- **big**: 単位 `u` ∈ {100, 1000, 10000} 一様、組 (a, op, b) を BIG（たし算 a,b∈1..9 の81組 ＋ ひき算 a>b の36組 ＝ 117）から一様。A=a·u、B=b·u。定義域 351。
  - figure `abacusFig(G3_READ, rodDigits(G3_READ, A*10))`、prompt `` `${A} ${op} ${B} を そろばんで しよう。答《こた》えは？` ``、fields int `ans = (a op b)·u`。
  - wrongAnswers: `[a op b, 'unit-point']`、`[ans×10, 'place-shift']`、`[ans/10, 'place-shift']`、`[(a 逆op b)·u, 'in-out']`（0以上）。
  - hints: `` `${A}の ${a}は、▲から ${k}つ 左《ひだり》の けた（${P(k)}の くらい）に あるよ。` ``（k=log10 u）／ `` `${B}も 同《おな》じ けたで ${b}を ${入れる/はらう}よ。うごかし方《かた》は ${a} ${op} ${b} と 同《おな》じ。` `` ／ `` `${a} ${op} ${b} の 答《こた》えを ${P(k)}の くらいから おいた 数《かず》だよ。` ``
  - explain `` `${a} ${op} ${b} ＝ ${a op b} と 同《おな》じ うごかし方《かた》を、${P(k)}の くらいで します。${A} ${op} ${B} ＝ ${ans}。` `` identity `big:${A}${op}${B}`。
- **dec**: A を 0.1 の数 `At` = 1〜99、B を `bt` = 1〜9（0.1〜0.9）、op ∈ {＋,−}（ひき算は At>bt）。組を列挙して一様（99×9 ＋ Σ ひき算）。
  - figure `abacusFig(G3_READ, rodDigits(G3_READ, At))`、prompt は big と同じ型（数は `tenths()` で表示）、fields decimal ＋ `keys:['decimal']`。
  - wrongAnswers: `[At op bt（整数として）, 'unit-point']`、`[答え/10（小数2けた）, 'place-shift']`、`[At 逆op bt を小数で, 'in-out']`。
  - hints: `'▲の けたが 一《いち》の くらい。その すぐ 右《みぎ》が 0.1の いくつ分《ぶん》の けただよ。'` ／ `` `${B}は 0.1が ${bt}こ。▲の すぐ 右《みぎ》の けたで ${bt}を ${入れる/はらう}よ。` `` ／ `` `0.1が ${At} ${op} ${bt}こ ぶんの 数《かず》に なるよ。` ``
  - explain `` `0.1が ${At}こと ${bt}こ。▲の 右《みぎ》の けたで ${bt}を ${入れて/はらって}、${A} ${op} ${B} ＝ ${ans}です。` `` identity `dec:${A}${op}${B}`。
- explainFigure（両方）: 答えの図 lit・mark=[動いたけた]。
- **alt `bigdec-rod`（choice・文）**: 上と同じ組。prompt `` `${A} ${op} ${B} で、${b}を ${入れる/はらう} けたは どこ？` ``（dec は b=bt）。`fixedOrder: true`、`layout:'column'`。
  - 位置の札（左右の順に並べる）: `pos=1..4` → `'▲から ${pos}つ 左《ひだり》'`、`pos=0` → `'▲の けた'`、`pos=−1` → `'▲の 1つ 右《みぎ》'`。
  - 正解 pos = k（big）／ −1（dec）。誤り: pos=0（正解でなければ）→ `'unit-point'`、正解±1（範囲 −1〜4、0と重ならないもの）→ `'place-shift'`。4つまで（正解＋3）。
  - hints: `'▲の けたが 一《いち》の くらいだよ。'` ／ `` `${B}の ${b}は ${dec ? '0.1が いくつ' : P(k)+'の くらい'}を あらわすよ。` `` ／ `'一《いち》の くらいから 1けたずつ 数《かぞ》えて みよう。'`
  - explain `` `${b}は ${dec ? '0.1の くらい' : P(k)+'の くらい'}の 数字《すうじ》なので、${正解の札}の けたで ${入れ/はらい}ます。` ``（「0.1の くらい」は小3の P1 で使う言い方でなければ `'▲の すぐ 右《みぎ》の けた'` にする。g3 decimals.ts の言い方に合わせる）
  - identity `bigdec-rod:${u または 'dec'}:${b}`（36通り）。

### 2.7 量の見込み（g3）

| 到達項目 | 練習のキー | alt のキー |
|---|---|---|
| read | 段階0 99 ＋ 整数 約11万 ＋ 小数 900 | read-table 約11万 |
| set | SET3 約7000 | set-kanji 同じ |
| direct | 900 | 約1150 |
| five | 20 | 20 |
| ten | 70 | 70 |
| bigdec | 351 ＋ 約1300 | 36 |

seed 1000×4段階 = 4000問のサンプルで異なるキーは 2000 以上の見込み → **Q ≈ 30 以上（基準 生60）**、C 6/6。偏り: 一番小さい five は段階1で 1/3×0.75×1/20 ≈ 1.3% < 3%。`domainSize` は書かない（定義域が 60 より大きい）。

---

## 3. g4.math.abacus（そろばん）

### 3.1 単元の値

| 項目 | 値 |
|---|---|
| id | `g4.math.abacus` |
| title | `'そろばん'` |
| stage / subject / domain / kind | `'g4'` / `'math'` / `'A-number'` / `'concept'` |
| priority / status | `'P2'` / `'ready'` |
| icon | `'subj-sansu'` |
| prereq | `['g3.math.abacus']` |
| review | `'objective'` |
| basis | `'小学校学習指導要領（平成29年告示）算数 第4学年 A 数と計算「そろばん」（加法及び減法の計算。そろばんの仕組みに着目し、大きな数（億・兆）や小数の計算の仕方を考える）。5と10の補数を続けて使う計算を4年に置くのは本アプリの案'` |
| revised | `'2026-10-30'` |
| ファイル | `src/packs/g4-math/abacus.ts`（`export const abacus = finishUnit({...})`）、`src/packs/g4-math/abacus-svg.ts`。`index.ts` の units の最後（twoWayTable の後）に足す |

よみ: `finishUnit` の辞書で付く。辞書に無い語は **文に《よみ》を手で書く**か `ruby.ts` の WORDS に足す（他の単元の よみが変わらない語だけ）。手で書く語: `定位点《ていいてん》`、`一兆《いっちょう》`（辞書だと「いちちょう」になる）、`十兆《じゅうちょう》`、`百兆《ひゃくちょう》`、`千兆《せんちょう》`、`両方《りょうほう》`（辞書にある）。テストの `MISSING` が空になること。4年より上の字は使わない（置 4年・位 4年・億 4年・兆 4年は可）。

### 3.2 到達項目（6）

| id | title |
|---|---|
| `read` | `'そろばんの 数を 読む（小数・億・兆）'` |
| `set` | `'小数を そろばんに おく'` |
| `multi` | `'上の 位から 計算する（2けた・3けた）'` |
| `hosu` | `'5と 10の あわせを 続けて 使う'` |
| `okucho` | `'億・兆の たし算・ひき算'` |
| `dec` | `'小数の たし算・ひき算'` |

### 3.3 段階

| 段階 | label | chance | 到達項目 |
|---|---|---|---|
| 0 | `'小数と ▲'` | 0.05 | read, set, dec |
| 1 | `'上の位から'` | 0.05 | multi, hosu, read |
| 2 | `'5と10の あわせ'` | 0.05 | hosu, multi, set |
| 3 | `'億・兆'` | 0.05 | okucho, dec, read |

`alt = rng.next() < 0.25`。

### 3.4 誤概念（13）

g3 の10個（文は下のとおり4年の書き方に直す）＋3個。

| id | explain |
|---|---|
| `five-as-one` | `'五だまを 1と 数えたのかな。上の 五だまは 1こで 5だよ。'` |
| `lower-away` | `'はりから はなれた たまを 数えたのかな。はりに くっついた たまだけを 数えよう。'` |
| `five-missing` | `'五だまを 入れわすれたのかな。5から 9の 数字は、五だまを 入れてから 一だまを 足すよ。'` |
| `place-shift` | `'位が 1つ ずれたのかな。▲の けたを 一の 位に して、左へ 十・百・千、右へ [[1/10]]・[[1/100]]の 位と 数えよう。'` |
| `zero-skip` | `'0の けたを とばしたのかな。2.07 なら [[1/10]]の 位は 0。たまを おかない けたを 1つ あけるよ。'` |
| `unit-point` | `'▲（一の 位）の 場所を まちがえたのかな。小数点の 位置を ▲に 合わせて、そこから 位を 数えよう。'` |
| `in-out` | `'入れると はらうを 反対に したのかな。たす ときは はりに 入れる、ひく ときは はりから はらうよ。'` |
| `complement-same` | `'たす 数や ひく 数を、そのまま はらったり 入れたり したのかな。5や 10を 入れすぎた ぶんだけ はらうよ。'` |
| `complement-mix` | `'5の あわせと 10の あわせを まちがえたのかな。五だまを 使う ときは 5の あわせ、となりの 位に 1 入れる ときは 10の あわせだよ。'` |
| `half-move` | `'たまの 動かし方が とちゅうで おわったのかな。5や 10を 入れたら、多い ぶんを はらう ところまで しよう。'` |
| `carry-forget` | `'くり上がりや くり下がりを わすれたのかな。10を こえたら となりの 位に 1 入れ、ひけない ときは となりの 位で 1 はらうよ。'` |
| `step-order` | `'計算する 位の じゅんを まちがえたのかな。そろばんは 上の 位から 1けたずつ 計算するよ。'` |
| `align-right` | `'数の 右の はしを そろえたのかな。小数は 小数点の 位置（▲）を そろえて 入れるよ。'` |

`align-right` に `figure: { kind:'text', text:'2.4 ＋ 1.35 → 2.40 ＋ 1.35', size:'l' }`。

### 3.5 導入（4場面）

1. `'はりの 上の 点を 定位点《ていいてん》と いいます。▲の ついた 定位点の けたを 一の 位に きめると、右へ [[1/10]]の 位・[[1/100]]の 位です。'` figure `abacusFig(G4_READ, rodDigits(G4_READ, 325), { lit:true })`（3.25）＋ `{kind:'text', text:'3.25', size:'xl'}` を column で。
2. `'大きな 数は、▲の けたを 一億の 位に きめて おきます。3億 ＋ 5億 は、3 ＋ 5 と 同じ たまの 動かし方です。'` figure `{kind:'text', text:'3億 ＋ 5億 ＝ 8億', size:'l'}`
3. `'そろばんは 上の 位から 計算します。46 ＋ 38 は、十の 位に 3を 入れて 76、つぎに 一の 位に 8を 足して 84。'` figure row: G4_SMALL の 46 → 76 → 84（間に `→` の text）
4. `'6 ＋ 7 は、十の 位に 1 入れ、一の 位から 3 はらいます。6から 3を はらうには、五だまを はらって 一だまを 2 入れます。'` figure row: G4_SMALL の 6 → 13

### 3.6 問題の型

表記: `PL(p)` = `placeLabel(p)` 相当（g4 util。`'十《じゅう》の 位《くらい》'`）。文はふつうに書き、finishUnit が よみを付ける。小数の表示は util の `dec(v, places)`。

#### (1) read — 読む（number）

- **定義域**:
  - 段階0〜2: 小数 `h` = 1〜99999（0.01〜999.99）のうち `h%100≠0`（小数部がある）から一様。figure `abacusFig(G4_READ, rodDigits(G4_READ, h))`。fields decimal（`decAns(h,2)`）、`keys:['decimal']`。
  - 段階3: 半分は上の小数。半分は億・兆: 単位 `U` ∈ {億, 兆} 一様、`v` = 1〜9999 一様。figure `abacusFig(G4_READ, rodDigits(G4_READ, v*100))`（▲のけた＝一U の位）。fields `[{ answer:{kind:'int', value:v}, unit: U }]`。
- prompt: 小数 `'この そろばんの 数は いくつ？'`／億・兆 `` `▲の けたを 一${U}の 位と すると、何${U}？` ``（兆は `一兆《いっちょう》`）
- wrongAnswers（g4 `wrongList(answers, …)`）: `[値×10, 'place-shift']`、`[値÷10, 'place-shift']`、`[fiveAsOne, 'five-as-one']`、`[lowerAway, 'lower-away']`、整数（億・兆）で範囲に0があれば `[zeroSkip, 'zero-skip']`。
- identity: `read:${dec(h,2)}`／`read:${U}:${v}`。
- hints（小数）: `'▲の けたが 一の 位。右へ [[1/10]]の 位、[[1/100]]の 位だよ。'` ／ `` `一の 位までで ${整数部}。` `` ／ `` `[[1/10]]の 位は ${d1}。[[1/100]]の 位は いくつかな。` ``
  hints（億・兆）: `` `▲の けたが 一${U}の 位。左へ 十${U}・百${U}・千${U}の 位だよ。` `` ／ `` `数の ある いちばん 左の けたは ${位の名}の 位。` `` ／ `` `上の けたから ${最後を除く数字}。▲の けたは いくつかな。` ``
- explain: 小数 `` `一の 位までで ${int}、[[1/10]]の 位が ${d1}、[[1/100]]の 位が ${d2}。${ans}です。` ``／億・兆 `` `▲の けたを 一${U}の 位に すると、${v}${U}です。` `` explainFigure: lit。
- **alt `read-table`**（小数だけ）: g3 と同じ表（header は数のけたの位の名: `千 百 十 一 [[1/10]] [[1/100]]` のうち範囲）。prompt `'たまの ようすを 表に しました。この 数は いくつ？'`。identity `read-table:${dec(h,2)}`。

#### (2) set — 小数をおく（choice・図）

- **定義域 SET4**: `h` = 1〜99999 のうち `h%100≠0`、5〜9 の数字を含む、範囲に d%5≠2 のけたがある。一様。
- prompt `` `${dec(h,2)}を おいた そろばんは どれ？` ``、`layout:'grid'`。
- options（図だけ）: 正解 `abacusFig(G4_SET, rodDigits(G4_SET, h))` ／ `shiftLeft`（値×10）→ `'place-shift'` ／ `zeroSkip`（範囲に0があれば）→ `'zero-skip'`、無ければ `lowerAway` → `'lower-away'` ／ `fiveMissing` → `'five-missing'`。
- hints: `'▲の けたが 一の 位。小数点の すぐ 右は [[1/10]]の 位だよ。'` ／ `` `${dec(h,2)}の 一の 位は ${d0}。` `` ／ `'0の 位は たまを おかずに 1けた あけるよ。'`
- explain: `` `▲の けたが 一の 位。${位ごとに「${位の名}の 位は ${d}」}。` `` explainFigure 正解 lit。identity `set:${dec(h,2)}`。
- **alt `set-units`**: prompt `` `0.01を ${h}こ 集めた 数を おいた そろばんは どれ？` ``。options 同じ。explain の先頭に `` `0.01を ${h}こ 集めると ${dec(h,2)}。` ``。identity `set-units:${h}`。

#### (3) multi — 上の位から（number）

- **定義域**: op を {＋,−} から一様。段階1: a,b = 11〜99 一様（ひき算は a>b になるまで引き直す＝一様の棄却）。段階2: a = 101〜999、b = 11〜999 一様（たし算は a+b ≤ 1999、ひき算は a>b）。
- figure `abacusFig(G4_SMALL, rodDigits(G4_SMALL, a))`、prompt `` `${a} ${op} ${b} を そろばんで 計算しよう。` ``、fields int。
- wrongAnswers: `[noCarry(a,b,op), 'carry-forget']`（たし算は位ごとに (x+y)%10、ひき算は位ごとに (x−y+10)%10 を並べた数。答えと同じなら除く）、`[a 逆op b, 'in-out']`（0以上）。
- hints: `'そろばんは 上の 位から 計算するよ。'` ／ `` `まず ${PL(bの最上位)}に ${bの最上位の数字}を ${入れる/はらう}と ${途中の数}。` `` ／ `'のこりの 位も じゅんに。10を こえたら となりの 位に 1 入れ、ひけない ときは となりの 位で 1 はらうよ。'`
- explain: `` `${bの位ごとに「${PL(p)}で ${e}を ${入れて/はらって} ${途中}」を「→」で}。${a} ${op} ${b} ＝ ${ans}。` ``
- identity `multi:${a}${op}${b}`。
- **alt `multi-step`（choice・図）**: b に 0 でない数字が2つ以上あるものだけ（無ければ引き直す）。prompt `` `${a} ${op} ${b} を 上の 位から。${PL(bの最上位)}まで した ところは どれ？` ``、options（G4_SMALL の図）: 正解 a op (bの最上位の数字×位) ／ a op (b の一の位の数字) → `'step-order'` ／ a op b（最後まで）→ `'step-order'` ／ a 逆op (最上位の数字×位)（0以上）→ `'in-out'`。重複を除き3つ以上。identity `multi-step:${a}${op}${b}`。

#### (4) hosu — 5と10の あわせを続けて（number）

- **定義域 HOSU（160通り）**:
  - たし算の一の位の組10: `5+6 5+7 5+8 5+9 6+6 6+7 6+8 7+6 7+7 8+6` × 十の位 `t` ∈ {0,1,2,3,5,6,7,8}（十の位に1を「そのまま」入れられる数）→ 80。A = 10t + a1。
  - ひき算の組10: `11−6 12−6 12−7 13−6 13−7 13−8 14−6 14−7 14−8 14−9`（一の位 a1 と b）× 十の位 `T` ∈ {1,2,3,4,6,7,8,9}（十の位から1を「そのまま」はらえる数）→ 80。A = 10T + a1。
  - 実装は列挙（g3 ten で除いた組 = `!directSub(a1, 10−b)` ／ `!directAdd(a1, 10−b)`）。テストで 80+80。
- c = 10 − b。答え = 5 − c。fields `[{ answer:{kind:'int', value:5−c}, unit:'こ' }]`。
- figure: `{ kind:'column', items:[ abacusFig(G4_SMALL, rodDigits(G4_SMALL, A)), { kind:'text', size:'m', text: たし算 `${A} ＋ ${b}：十の 位に 1 入れ、一の 位から ${c} はらう` ／ ひき算 `${A} − ${b}：十の 位で 1 はらい、一の 位に ${c} 入れる` } ] }`
- prompt: たし算 `` `一の 位から ${c} はらう。五だまを はらって、一だまを いくつ 入れる？` ``／ひき算 `` `一の 位に ${c} 入れる。五だまを 入れて、一だまを いくつ はらう？` ``
- wrongAnswers: `[c, 'complement-same']`、`[10−c, 'complement-mix']`（9以下）。
- hints（たし算）: `` `一の 位は ${a1}。一だまは ${a1−5}こしか ないね。` `` ／ `` `${c}を はらう かわりに、5を はらって、はらいすぎた ぶんを 入れるよ。` `` ／ `` `${c} と □ で 5。` ``
  hints（ひき算）: `` `一の 位は ${a1}。一だまは あと ${4−a1}こしか 入らないね。` `` ／ `` `${c}を 入れる かわりに、5を 入れて、多い ぶんを はらうよ。` `` ／ `` `${c} と □ で 5。` ``
- explain: たし算 `` `${b}を たすには、十の 位に 1 入れて 一の 位から ${c} はらう（10の あわせ）。${a1}から ${c}を はらうには、5を はらって ${5−c} 入れる（5の あわせ）。${A} ＋ ${b} ＝ ${A+b}。` ``／ひき算 `` `${b}を ひくには、十の 位で 1 はらって 一の 位に ${c} 入れる（10の あわせ）。${a1}に ${c}を 入れるには、5を 入れて ${5−c} はらう（5の あわせ）。${A} − ${b} ＝ ${A−b}。` `` explainFigure 答え lit・mark=[2,3]。
- identity `hosu:${A}${op}${b}`。
- **alt `hosu-alt`（choice・図、160通り）**: prompt `` `${A} ${op} ${b} を した あとの そろばんは どれ？` ``（figure は A の図だけ）。options:
  - たし算: 正解 A+b ／ A+10 → `'half-move'` ／ A+10−b → `'complement-same'` ／ A+b−10 → `'carry-forget'`
  - ひき算: 正解 A−b ／ A−10 → `'half-move'` ／ A−10+b → `'complement-same'` ／ A−b+10 → `'carry-forget'`
  - hints 3段目 `'十の 位と 一の 位の 両方が 動いた そろばんを さがそう。'`。identity `hosu-alt:${A}${op}${b}`。

#### (5) okucho — 億・兆（number）

- **定義域**: `U` ∈ {万, 億, 兆} 一様、op 一様、a = 10〜99、b = 1〜99 一様（ひき算は a>b、たし算は制限なし: 最大 198）。
- figure `abacusFig(G4_SMALL, rodDigits(G4_SMALL, a))`、prompt `` `▲を 一${U}の 位に して、${a}${U} ${op} ${b}${U} を 計算しよう。` ``、fields `[{ answer:{kind:'int', value:r}, unit:U }]`（r = a op b）。
- wrongAnswers: `[noCarry, 'carry-forget']`、`[a 逆op b, 'in-out']`（0以上）、`[r×10, 'place-shift']`。
- hints: `` `${a}${U}は、一${U}を ${a}こ 集めた 数。` `` ／ `` `▲を 一${U}の 位に すると、${a} ${op} ${b} と 同じ たまの 動かし方だよ。` `` ／ `` `${a} ${op} ${b} の 答えに ${U}を つけよう。` ``
- explain: `` `一${U}を 1と みると、${a} ${op} ${b} ＝ ${r}。だから ${a}${U} ${op} ${b}${U} ＝ ${r}${U}です。` ``
- identity `okucho:${U}:${a}${op}${b}`（定義域 約3×(90×99+Σ)＝約3万）。
- **alt `okucho-num`**: 同じ定義域。prompt `` `${a}${U} ${op} ${b}${U} の 答えを 数字だけで 書こう。` ``、fields `[{ answer:{kind:'int', value: r·10^k}, digitGroup: 4, maxLength: 15 }]`（k=4,8,12）。wrongAnswers `[r·10^(k+1), 'place-shift']`、`[r·10^(k−1), 'place-shift']`、`[r, 'unit-point']`。hints 3段目 `` `${U}は 0が ${k}こ。` ``。identity `okucho-num:${U}:${a}${op}${b}`。

#### (6) dec — 小数の計算（number）

- **定義域**: A・B それぞれ「小数1けた（0.1〜9.9: 10の倍数の 0.01 単位 10〜990）」か「小数2けた（1〜999 のうち 10 の倍数でない 0.01 単位）」を一様に選び、その中で一様。op 一様。ひき算は A>B、たし算は A+B ≤ 999.99 以内（必ず入る）。値は 0.01 の整数で持つ（util `dec`）。
- figure `abacusFig(G4_READ, rodDigits(G4_READ, A))`、prompt `` `${dec(A,2)} ${op} ${dec(B,2)} を そろばんで 計算しよう。` ``、fields decimal ＋ `keys:['decimal']`。
- wrongAnswers: 小数のけた数が違うとき `[alignRight(A,B,op), 'align-right']`（両方の数字の並びを右端でそろえた計算。2.4 ＋ 1.35 → 0.24 ＋ 1.35 ＝ 1.59、2.45 ＋ 1.3 → 2.45 ＋ 0.13 ＝ 2.58）、`[答え×10, 'place-shift']`、`[A 逆op B, 'in-out']`（0以上）。
- hints: `'▲の けたが 一の 位。小数点の 位置を ▲に 合わせて 入れよう。'` ／ `` `${dec(B,2)}の ${Bの最下位の数字}は ${最下位の位の名}の 位に ${入れる/はらう}よ。` `` ／ `` `上の 位から じゅんに。0.01が ${A} ${op} ${B}こ ぶんの 数だよ。` ``
- explain: `` `${dec(A,2)}の 小数点を ▲に 合わせ、${dec(B,2)}を 同じ 位どうしで ${入れ/はらい}ます。${dec(A,2)} ${op} ${dec(B,2)} ＝ ${ans}。` ``
- identity `dec:${A}${op}${B}`。
- **alt `dec-rod`（choice・文）**: 同じ定義域。prompt `` `${dec(A,2)} ${op} ${dec(B,2)}。${dec(B,2)}の いちばん 右の 数字を 入れる けたは？` ``（ひき算は「はらう けたは？」）。`fixedOrder:true`、`layout:'column'`。札: `'▲から 1つ 左'`(1)・`'▲の けた'`(0)・`'▲から 1つ 右'`(−1)・`'▲から 2つ 右'`(−2)。正解 = −(B の小数のけた数)。誤り: A の小数のけた数と違えば −(Aのけた数) → `'align-right'`、0 → `'unit-point'`、のこりは `'place-shift'`。identity `dec-rod:${dec(B,2)}`。

### 3.7 量の見込み（g4）

| 到達項目 | 練習 | alt |
|---|---|---|
| read | 約9万＋約2万 | 約9万 |
| set | 約6万 | 同じ |
| multi | 約1万＋約50万 | 同じ |
| hosu | 160 | 160 |
| okucho | 約3万 | 同じ |
| dec | 約50万 | 約1000 |

サンプル4000問の異なるキーは 3000 以上の見込み → **Q ≈ 50 以上（基準 生60）**、C 6/6。一番小さい hosu（160）でも1キーの割合は 1% 未満。`domainSize` は書かない。

---

## 4. テスト（実装担当が書く）

既存の `g3-math.test.ts`・`g4-math.test.ts` は全単元を回すので、index.ts に足せば checkUnit・isReady・漢字の学年・選択肢の数・number の正誤判定・1回の問題が作れること は自動で検査される。加えて **`src/packs/g3-math/abacus.test.ts`・`src/packs/g4-math/abacus.test.ts`** に次を書く。

1. **珠と数字**: d=0〜9 で `digitOf(beadsOf(d)) === d`。`abacusFig` の markup に ひし形（`<polygon`）が rods×5＋1（▲）個、`<text` が無い、`unsafeSvgsOf` が空。
2. **図と答えが同じデータ**: read・direct・five・ten・hosu・multi・okucho・dec の各問題で、`item.figure`（column のときは中の svg）の markup が、identity から復元した数で作った `abacusFig(...)` の markup と一致する（生成器はこのため identity に数を入れておく）。read の答え ＝ その数。
3. **選択肢の図**: set・*-alt の図の選択肢は、正解の図がちょうど1つ（答えの数で作った図と一致）、誤りの図はどれも正解と違い、互いに重ならない。選択肢は3〜4つ。
4. **定義域の大きさ**（列挙した配列の長さ）: FIVE=20、TEN=70（35+35）、DIRECT=900、HOSU=160（80+80）。TEN の各組は「直接できる」、HOSU の各組は「直接できない」ことを `directAdd`/`directSub` で確かめる。DIRECT_ALT・SET3・SET4 の大きさは console.info で出す。
5. **補数の答え**: five・ten・hosu の答えが それぞれ 5−b・10−b・5−(10−b) で、誤答例は答えと違う。
6. **文の長さ**（画面の収まり。`plainText` は `src/text/rich` から）: prompt は《よみ》を除いて **40字以内**、選択肢の文は **10字以内**、figure の text は **30字以内**（hosu の手順の文）。語の途中で折れない長さ。
7. g4: `MISSING` が空（既存のテストがあるのでそのまま通ること）。

コマンド（pack-brief の「検査とコマンド」）: `npx vitest run src/packs/g3-math src/packs/g4-math`、`npx tsc -b`、`npx eslint src/packs/g3-math src/packs/g4-math`、最後に `npm run build:unit-index`、`npm run check:design`。

---

## 5. 内容の確認（設計担当が確かめたこと・未確認のこと）

- そろばんの数の表し方: 五だま1つ（5）＋一だま4つ（各1）、はりに寄せた珠を数える、定位点で一の位を決める。小数・大きな数は一の位を決める点を変えて同じ動かし方で計算する。
- 補数の手順（FIVE・TEN・HOSU の組と答え）は 1.3 の珠の規則（`directAdd`/`directSub`）から機械的に列挙して確かめた（本書の組の一覧はその出力）。
- 例: 4＋3（五だまを入れて一だまを2はらう）、7−4（一だまを1入れて五だまをはらう）、8＋6（十に1入れ一から4はらう）、6＋7（十に1入れ、一から3を はらう＝五だまをはらって一だまを2入れる）、13−8 は TEN（一に2を直接入れる）、12−7 は HOSU（一に3を入れる＝五だまを入れて一だまを2はらう）。
- **未確認**: 指導要領の本文の項目番号（A の何番か）は調査メモに無いので basis に番号を書かない（curriculum-matrix 0.1 の方針）。3年と4年で補数の計算をどこまで扱うかの解説の細部は未確認（本書の分け方は本アプリの案として basis に明記）。

---

## 6. 守ること（再掲）

- オリジナル: 他社のそろばん教材・検定の問題形式・図・言い回しを写さない。数はすべて生成。実在の人物・団体・商品名を出さない。
- 音声ファイルは作らない。npm パッケージを足さない。本体のコード・他のパックを変えない。
- 文は書いたあと一通り読み直す（「入れる」「はらう」の取り違え、＋と − の取り違えに注意）。

## 7. 統括への報告事項（実装担当も報告にそのまま書く）

- abacus エンジンを作らず、SVG の図＋number/choice で代えた（珠を指で動かす操作は無い）。エンジンを作るなら、この単元の図の部品（abacus-svg.ts）がそのまま描画の土台になる。
- `abacus-svg.ts` が g3-math と g4-math に重複する。共有の部品（例 `src/engines/figure` の kind `'abacus'`）にするかは統括の判断。
- 新しい絵は無し（アイコンは `subj-sansu`）。そろばんのアイコン（`abacus`）を足すなら統括が登録。
