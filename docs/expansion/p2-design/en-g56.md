# P2 設計書: en-g56（g5.en.where・g6.en.future）

版 1（2026-10-30）／設計: Opus／宛先: 実装担当（Sonnet）、統括
正本: `docs/expansion/curriculum-matrix.md` の 3.8 行 g5.en.where、3.9 行 g6.en.future。規則は `docs/expansion/pack-brief.md`。

この設計書だけで実装できるように、英文・問題文・選択肢・正答・誤概念ID・ヒント・解説を全部書いた。**内容（英文・日本語・漢字の学年）は設計で確かめ済み。実装で文を変えない**（変えるときは報告に理由を書く）。

---

## 0. 共通（両単元）

### 0.1 置き場所・書き方
- 新しいファイル: `src/packs/en-g56/where.ts`（`export const where: UnitSpec`）、`src/packs/en-g56/future.ts`（`export const future: UnitSpec`）、絵 `src/illust/content/en-g56.tsx`（`export const enG56Illust: IllustGroup`）。
- `src/packs/en-g56/index.ts` の `units` に `where` を `wordOrder` の後、`future` を `sentenceWrite` の後に足す（並び: lettersWrite, listenSelf, readWords, wordOrder, **where**, past, places, sentenceWrite, **future**）。
- 書き方は同じパックの `past.ts`・`listen-self.ts` にそろえる。部品は `lib.ts` の `en`・`enText`・`listen`・`ordinalOptions`・`slugOf` を使う（`lib.ts` は変えなくてよい）。
- エンジンは **listen だけ**（matrix の指定）。問題はすべて手作り（`source: { kind: 'items', items: [...] }`）。表（配列）から関数で問題を作る形にする（past.ts と同じ）。
- `kind: 'knowledge'`、`priority: 'P2'`、`status: 'ready'`、`subject: 'en'`、`domain: 'en'`、`icon: 'subj-eigo'`、`review: 'objective'`、`gradeIsAppProposal: true`、`revised: '2026-10-30'`。
- 段階 `levels` の `chance` は past.ts と同じ 0.05。
- **問題文・導入の文に英字を入れない**（日本語の音声で読み上げるため。既存テストの検査）。英語は音声（audio）・図（`enText`）・解説の図にだけ置く。誤概念の説明・ヒント・解説・選択肢の文にも英字を入れない（本設計の文はすべて英字なし）。
- 漢字は全部 `漢字《よみ》`（qa の検査は学年に関係なく、よみの無い漢字を誤りにする）。本設計の文の漢字はすべて g5 は5年以下、g6 は6年以下の配当であることを確かめた（表の文をそのまま使えば検査に通る）。
- 選択肢は 3 つ（ux-by-age の上限 4 以内）。誤りの選択肢には**すべて**誤概念IDを付ける（汎用誤答 0%）。
- 音声のキー: `en(<種類>, 英文)`。種類は g5.en.where が `'where'`、g6.en.future が `'future'`（1文の問題）と `'dream'`（発表の3文）。どれも既存の台本と重ならない種類名（確認済み）。
- 音声ファイルは作らない（統括が台本から作る）。ただし `script-en.json` は作り直す（0.4）。

### 0.2 同一性キー（curriculum-matrix 1.4）
- キー = `形式:英文のスラッグ`（2つ以上の音は `:` でつなぐ）。形式の名前は各表に書いた（`pos`・`word`・`phrase`・`thing`・`pic`・`ask`・`not`・`be`・`desc`・`want`・`likewant`・`dream`・`gist`）。
- 同じ英文を同じ形式で2回使わない。同じ英文を別の形式で使うのは、問題の形（聞く量・選ぶもの）が違う別例だけ（表で確かめ済み）。
- `id` はキーと同じ文字列でよい（単元内で一意）。

### 0.3 テスト（`src/packs/en-g56/en-g56.test.ts` に足す）
既存のテスト（checkUnit・extraChecks・絵の存在・誤概念IDの付与・台本の一致）は、index.ts に足せば自動で両単元にかかる。加えて:
1. `known()` に `|| id in enG56Illust` を足す（`import { enG56Illust } from '../../illust/content/en-g56';`。新しいファイルはテストの変換キャッシュで registry に入らないことがあるため。life-g12 と同じ扱い）。
2. **where: 正答の絵が音声の文と一致**: g5.en.where の各問題で、正答の選択肢に `figure.kind === 'illust'` があれば、その id が「最後の音声の文」から作った `en56-<もの>-<ようす>-<ばしょ>` と一致する。文の読み取り: `/The (ball|cat|cap|book) is (in|on|under) the (desk|bed)\./` と `/It's (in|on|under) the (desk|bed)\.$/`（後者は、1つめの音声 `Where is (my|the) (ball|cat|cap|book)\?` から もの を取る。`It's not … It's …` の文は最後の `It's (in|on|under) the (desk|bed)\.` を使う）。
3. **where: 正答以外の絵は正答と違う絵**: 各問題の選択肢の絵の id がすべて異なる。
4. **where: 不自然な文を問わない**: 音声の文に `ball is in the bed`・`cap is in the bed`・`book is in the bed`・`cat is in the desk` と、`It's in the bed` を ball/cap/book に、`It's in the desk` を cat に答える組が無い（絵は選択肢の誤答としてだけ使う）。
5. **where: 1問の選択肢は、ちょうど1つの点だけが正答と違う**（pos は ようす だけ、thing・ask は もの か ばしょ か ようす の1つだけ）。絵の id を `-` で分けて、正答と比べて違う部分が1つであることを確かめる（ordinal の問題は対象外）。
6. **future: 台本の種類**: g6.en.future の音声キーはすべて `en/en-g56.future.` か `en/en-g56.dream.` で始まる。g5.en.where は `en/en-g56.where.` で始まる。
7. **future: ヒント② の「Nつめ」と発表の文**: `dream:` の問題のヒント②にある数 N について、その文（`audio[N-1].text`）が表の「答えのある文」と同じ（表に `at` を持たせ、ヒントを `at` から作れば自動で一致する。テストは `at` が 1〜3 であることを確かめる）。
8. 既存の `console.info` で Q・C が出る。報告に写す。

### 0.4 台本 `script-en.json` の作り直し
既存テストが `englishScript(pack)` と `script-en.json` の一致を確かめる。単元を足したら、`version`・`defaults` はそのままにして `entries` だけを `englishScript(pack).entries` で置き換える（2スペースの字下げ、最後に改行）。一回だけの tsx の小さなスクリプトをスクラッチ（リポジトリの外）に書いて実行してよい。例:
```ts
import { readFileSync, writeFileSync } from 'node:fs';
import pack from '<作業ツリー>/src/packs/en-g56/index';
import { englishScript } from '<作業ツリー>/src/packs/en-g56/voice';
const f = '<作業ツリー>/src/packs/en-g56/script-en.json';
const j = JSON.parse(readFileSync(f, 'utf8'));
j.entries = englishScript(pack).entries;
writeFileSync(f, JSON.stringify(j, null, 2) + '\n');
```
（実行: `npx tsx --tsconfig tsconfig.app.json <スクリプト>`）

### 0.5 量の見込み
| 単元 | 種別 | 基準 M | 到達項目（練習＋別例） | 異なる問題 | Q |
|---|---|---|---|---|---|
| g5.en.where | 知（場8） | 30 | prep 12+6・thing 8+4・ask 8+4 | 42 | 1.40 |
| g6.en.future | 知（場8） | 30 | be 10+4・want 10+4・dream 8+8 | 44 | 1.47 |

C は両単元 3/3（各到達項目 練習6以上・別例3以上）。誤概念: where 7、future 10。汎用誤答 0%。

---

## 1. g5.en.where 「どこに あるかを 聞《き》こう」

| 項目 | 値 |
|---|---|
| 単元ID | `g5.en.where` |
| title | `どこに あるかを 聞《き》こう` |
| stage / 領域 | `g5` / `en` |
| エンジン | listen |
| 前提 prereq | `['g5.en.listen-self']` |
| basis | `小学校学習指導要領（平成29年告示）外国語 第5・6学年 聞くこと（日常生活に関する身近で簡単な事柄について、具体的な情報を聞き取る）。物の位置を表す語（in / on / under）と、場所をたずねる・答えるやり取り` |
| gradeIsAppProposal | true（外国語は5・6年のまとまり。5年への割当は本アプリの案） |
| 場面（場8） | もの4（ボール・ねこ・ぼうし・本）× ばしょ2（つくえ・ベッド）＝ 8 場面 |

### 1.1 語と日本語
| 英語 | 日本語（選択肢・解説で使う） |
|---|---|
| ball | ボール |
| cat | ねこ |
| cap | ぼうし |
| book | 本《ほん》 |
| desk | つくえ |
| bed | ベッド |
| in | 中《なか》 |
| on | 上《うえ》 |
| under | 下《した》 |

（「机」は6年の字なので g5 では ひらがな「つくえ」。）

### 1.2 到達項目
| id | title |
|---|---|
| `prep` | `ばしょの ようすの ことば（中《なか》・上《うえ》・下《した》）を 聞《き》きわける` |
| `thing` | `なにが どこに あるかを 聞《き》きとる` |
| `ask` | `「どこ？」と たずねる 文《ぶん》と こたえを 聞《き》きとる` |

### 1.3 段階 levels
`[{ label: 'ばしょの ことば', chance: 0.05 }, { label: 'なにが どこに', chance: 0.05 }, { label: 'たずねて こたえる', chance: 0.05 }]`
prep の問題は level 0、thing は level 1、ask は level 2（別例も同じ到達項目の段階）。

### 1.4 誤概念
| id | explain |
|---|---|
| `in-on` | `「中《なか》」と「上《うえ》」を とりちがえたのかな。どちらも みじかい ことばだよ。はじめの 音《おと》が、「中」は イに にた 音《おと》、「上」は オに にた 音《おと》だよ。` |
| `in-under` | `「中《なか》」と「下《した》」を とりちがえたのかな。「下」を あらわす ことばは、2つの 音《おと》が つづく すこし ながい ことばだよ。` |
| `on-under` | `「上《うえ》」と「下《した》」を とりちがえたのかな。「上」の ことばは みじかく、「下」の ことばは すこし ながいよ。` |
| `thing-mix` | `ものの なまえを とりちがえたのかな。はじめの ほうの ことばを もういちど 聞《き》こう。` |
| `place-mix` | `つくえと ベッドを とりちがえたのかな。文《ぶん》の さいごの ことばを もういちど 聞《き》こう。` |
| `it-mix` | `たずねた ものと ちがう ものを えらんだのかな。こたえの はじめの ことばは、たずねた ものの ことだよ。` |
| `not-heard` | `「そこには ない」の ぶぶんを 聞《き》きのがしたのかな。こたえの 1つめの 文《ぶん》は「ない」ばしょ、2つめの 文《ぶん》が「ある」ばしょだよ。` |

ようすの取り違えの誤概念IDは、**正答のようす と 選んだようす の組**（順不同）で決める: in↔on → `in-on`、in↔under → `in-under`、on↔under → `on-under`。関数 `pairMis(a, b)` を作る（2つを `['in','on','under']` の順に並べて `-` でつなぐ）。

### 1.5 導入 intro
1. text: `ものの ばしょは、「中《なか》」「上《うえ》」「下《した》」を あらわす ことばで つたえるよ。`
   figure: `{ kind: 'row', items: [ col('en56-ball-in-desk','in'), col('en56-ball-on-desk','on'), col('en56-ball-under-desk','under') ] }`
   （`col(id, w)` = `{ kind: 'column', items: [{ kind: 'illust', id }, enText(w, 'm')] }`）
2. text: `「〜は どこ？」と たずねられたら、ばしょを こたえるよ。`
   figure: `{ kind: 'column', items: [enText('Where is the ball?', 'l'), enText("It's under the desk.", 'l')] }`

### 1.6 絵（新しく描く。`src/illust/content/en-g56.tsx`）
24 点を表から生成する: id `en56-<obj>-<prep>-<cont>`、obj ∈ {ball, cat, cap, book}、prep ∈ {in, on, under}、cont ∈ {desk, bed}。label は ひらがな（例 `つくえの うえの ボール`、`ベッドの なかの ねこ`、`つくえの したの ぼうし`、`ベッドの うえの ほん`）。`status: 'final'`。
画風: 輪郭 `INK`・`line`（太さ 3.5）・平塗り・`P` の色だけ・文字なし・影なし（DESINGN 6章）。既存の絵（ball・cat）を縮小して重ねない（線の太さが細くなる）。**小さい もの を 3.5 の線で描き直す**。

**ばしょ**（viewBox 0 0 100 100、床の線は描かない。前面＝ものの手前に重ねる部分）
- desk（学校の つくえ、正面から）: 天板 `rect x=14 y=36 w=72 h=7`（P.wood）。天板の下の 物入れ `rect x=18 y=43 w=64 h=17`（P.brown、中が暗く見える）。物入れの 前のふち（前面）: `rect x=18 y=55 w=64 h=5`（P.wood）。脚 2本 `x=20〜25` と `x=75〜80`、`y=43〜94`（P.gray）。
- bed（横から）: 頭の板 `rect x=8 y=34 w=9 h=60`（P.wood）。マットレス `rect x=14 y=54 w=80 h=10`（P.white）。脚 `x=16〜21`・`x=86〜91`、`y=64〜94`（P.wood）。まくら `ellipse cx=27 cy=50 rx=10 ry=5`（P.white）。かけぶとん（前面）: `path` で マットレスの上 `x=34〜94`、上の線 y=47 ぐらいの ゆるい山形、下は y=66（P.blue）。

**もの**（`draw(cx, by, s)`: 下の中心 (cx, by)、大きさ s（目安 高さ）。線は常に 3.5）
- ball: 円 r = s/2。色は P.red と P.yellow の2色の扇形を交互に4つ（既存 ball に似た配色）、中心の小円なし。
- cat: すわった ねこ（P.orange）。からだ（楕円）・あたま（円）・三角の耳2つ・目は INK の点2つ・しっぽ。
- cap: 野球ぼう（P.blue のドーム＋前に出たつば P.blue、てっぺんに小さいボタン）。
- book: とじた本（表紙 P.green の長方形、右側に白い紙の小口 P.white、背に1本の線）。

**ようすの置き方**（同じ もの・ばしょ の3点が はっきり違って見えることが大事）
| | desk | bed |
|---|---|---|
| on | 天板の上に置く: `by=36`、s=24（cx=50） | ふとんの上: `by=48`、s=22（cx=62） |
| in | 物入れの中: `by=58`、s=13、cx=50。**ものを描いてから** 前のふち（前面）を重ねて、下の部分が かくれるようにする | ふとんの中: `by=62`、s=20、cx=60。**ものを描いてから** かけぶとん（前面）を重ねる。上 1/3 ほどが ふとんから出る（ねこは あたまが出る） |
| under | 脚の間の床: `by=94`、s=20、cx=50 | ベッドの下の床: `by=94`、s=20（ねこは 18）、cx=55 |

- 1枚の絵には ものを1つだけ描く。
- 色だけで区別する点は無い（ようすは位置、ものは形で分かる）。赤と緑を見分けさせる点も無い（ball は赤と黄、book は緑だが、ball と book は形で区別）。
- 描いたら `npm run dev` の `/gallery.html` で 24 点を目で確かめる（in と under が まぎれないこと、in で ものが 半分ほど見えること）。

### 1.7 問題の作り方
共通の型:
```ts
type Obj = 'ball' | 'cat' | 'cap' | 'book';
type Prep = 'in' | 'on' | 'under';
type Cont = 'desk' | 'bed';
const il = (o: Obj, p: Prep, c: Cont) => `en56-${o}-${p}-${c}`;
const posJa = (p: Prep, c: Cont) => `${CONT_JA[c]}の ${PREP_JA[p]}`;            // 「つくえの 上《うえ》」
const thingJa = (o: Obj, p: Prep, c: Cont) => `${posJa(p, c)}の ${OBJ_JA[o]}`;  // 「つくえの 上《うえ》の ねこ」
const sent = (o: Obj, p: Prep, c: Cont) => `The ${o} is ${p} the ${c}.`;
```
絵の選択肢は `{ figure: { kind: 'illust', id: il(...) }, label: ... }`。`layout` は付けない（既定 row）。

#### 1.7.1 prep 練習（level 0、12問、形式 `pos`）
- prompt: `どこに ある？ 聞《き》こえた 文《ぶん》に あう 絵《え》を えらぼう。`
- audio: `en('where', sent(o,p,c))`
- options: 同じ o・c で in・on・under の3枚。label は `posJa(p', c)`。正答は p。誤りは `pairMis(p, p')`。
- hints:
  1. `文《ぶん》の まんなかに、ばしょの ようすを あらわす ことばが あるよ。`
  2. `その ことばは「中《なか》」「上《うえ》」「下《した》」の どれかだよ。`
  3. `その ことばが みじかいか、すこし ながいかを 聞《き》きくらべよう。`
- explain: `${OBJ_JA[o]}は ${posJa(p,c)}に あります。`（例「ボールは つくえの 下《した》に あります。」）
- explainFigure: `{ kind: 'column', items: [{ kind: 'illust', id: il(o,p,c) }, enText(sent(o,p,c), 'm')] }`
- identity: `pos:${slugOf(sent)}`

| # | 英文 | 正答の絵 |
|---|---|---|
| 1 | The ball is under the desk. | en56-ball-under-desk |
| 2 | The ball is on the bed. | en56-ball-on-bed |
| 3 | The cat is on the desk. | en56-cat-on-desk |
| 4 | The cat is in the bed. | en56-cat-in-bed |
| 5 | The cap is in the desk. | en56-cap-in-desk |
| 6 | The cap is under the bed. | en56-cap-under-bed |
| 7 | The book is in the desk. | en56-book-in-desk |
| 8 | The book is under the bed. | en56-book-under-bed |
| 9 | The ball is in the desk. | en56-ball-in-desk |
| 10 | The cat is under the bed. | en56-cat-under-bed |
| 11 | The cap is on the bed. | en56-cap-on-bed |
| 12 | The book is on the bed. | en56-book-on-bed |

（in・on・under 各4問。8場面すべてを1回以上使う。）

#### 1.7.2 prep 別例（level 0、6問、`alt: true`）
**(a) ことばだけ（形式 `word`、3問）**: 音声は1語。選択肢は絵なしの文字だけ。
- prompt: `聞《き》こえた ことばの いみは どれ？`
- audio: `en('where', w)`（w = `in` / `on` / `under`）
- options: `中《なか》`・`上《うえ》`・`下《した》`（正答は w の意味、誤りは `pairMis`）。`fixedOrder: true`（中・上・下 の順）。
- hints: 1 `ばしょの ようすを あらわす ことばだよ。` 2 `「中《なか》」「上《うえ》」「下《した》」の どれかだよ。` 3 `みじかい ことばか、すこし ながい ことばかを 聞《き》きわけよう。`
- explain: `「${PREP_JA[w]}」と いう いみです。`、explainFigure: `enText(w, 'xl')`
- identity: `word:${w}`

**(b) ばしょの まとまり（形式 `phrase`、3問）**: 音声は「ようす＋ばしょ」の句。選択肢は絵なしの文字だけ。
- prompt: `聞《き》こえた ことばの いみは どれ？`
- hints: 1 `はじめに ようすの ことば、さいごに ものの なまえが くるよ。` 2 `さいごの ことばは、つくえか ベッドだよ。` 3 `はじめの ことばが みじかいか、すこし ながいかを 聞《き》こう。`
- explain: `「${posJa(p,c)}」と いう いみです。`、explainFigure: `enText(句, 'xl')`
- identity: `phrase:${slugOf(句)}`

| 句（音声） | 正答 | 誤り1 | 誤り2 |
|---|---|---|---|
| under the desk | つくえの 下《した》 | つくえの 上《うえ》 `on-under` | ベッドの 下《した》 `place-mix` |
| in the bed | ベッドの 中《なか》 | ベッドの 上《うえ》 `in-on` | ベッドの 下《した》 `in-under` |
| on the desk | つくえの 上《うえ》 | つくえの 中《なか》 `in-on` | ベッドの 上《うえ》 `place-mix` |

#### 1.7.3 thing 練習（level 1、8問、形式 `thing`）
- prompt: `なにが どこに ある？ 聞《き》こえた 文《ぶん》に あう 絵《え》を えらぼう。`
- audio: `en('where', sent(o,p,c))`
- options: 正答 `(o,p,c)`、`(o',p,c)` → `thing-mix`、`(o,p,c')` → `place-mix`。label は `thingJa`。
- hints:
  1. `はじめの ほうに「なにが」、さいごに「どこ」が あるよ。`
  2. `えらぶ 絵《え》は、ものか、つくえ・ベッドかが ちがうよ。`
  3. `ものの なまえと さいごの ことばを 聞《き》いて、2つに あう 絵《え》を えらぼう。`
- explain: `${OBJ_JA[o]}は ${posJa(p,c)}に あります。もの・ばしょ・ようすの 3つが あう 絵《え》です。`
- explainFigure: illust＋enText（pos と同じ形）
- identity: `thing:${slugOf(sent)}`

| # | 英文 | 正答 | thing-mix | place-mix |
|---|---|---|---|---|
| 1 | The ball is on the desk. | ball-on-desk | book-on-desk | ball-on-bed |
| 2 | The ball is under the bed. | ball-under-bed | cat-under-bed | ball-under-desk |
| 3 | The cat is under the desk. | cat-under-desk | cap-under-desk | cat-under-bed |
| 4 | The cat is on the bed. | cat-on-bed | cap-on-bed | cat-on-desk |
| 5 | The cap is on the desk. | cap-on-desk | book-on-desk | cap-on-bed |
| 6 | The cap is under the desk. | cap-under-desk | ball-under-desk | cap-under-bed |
| 7 | The book is on the desk. | book-on-desk | cap-on-desk | book-on-bed |
| 8 | The book is under the desk. | book-under-desk | cat-under-desk | book-under-bed |

（表の id は `en56-` を省いた。練習の英文 20 は自然な組の全部で、pos と thing で重ならない。）

#### 1.7.4 thing 別例（level 1、4問、`alt: true`、形式 `pic`）: 絵を見て、3つの文から合う文を選ぶ
- figure（問題の図）: `{ kind: 'illust', id: 絵 }`
- prompt: `絵《え》を 見《み》てから、3つの 文《ぶん》を 聞《き》こう。絵《え》に あう 文《ぶん》は なんばんめ？`
- audio: 3文を `en('where', …)` で順に。`gapMs: 900`。
- options: `ordinalOptions(3, 正答の位置, (i) => 誤りの文の誤概念)`、`fixedOrder: true`。
- hints: 1 `絵《え》を 見《み》て、なにが どこに あるか たしかめよう。` 2 `3つの 文《ぶん》は、ものの なまえか ばしょの ことばが すこしずつ ちがうよ。` 3 `絵《え》に あう ことばが ぜんぶ そろって いる 文《ぶん》を さがそう。`
- explain: `${n}ばんめの 文《ぶん》が 絵《え》と あいます。`
- explainFigure: 3文の `enText(…, 'm')` を column で。
- identity: `pic:${絵のid}`

| 絵 | 1ばんめ | 2ばんめ | 3ばんめ |
|---|---|---|---|
| en56-cat-under-bed | The cat is on the bed. `on-under` | **The cat is under the bed.** | The ball is under the bed. `thing-mix` |
| en56-ball-in-desk | **The ball is in the desk.** | The ball is under the desk. `in-under` | The book is in the desk. `thing-mix` |
| en56-cap-on-bed | The cap is on the desk. `place-mix` | **The cap is on the bed.** | The cap is under the bed. `on-under` |
| en56-book-on-desk | The cat is on the desk. `thing-mix` | The book is in the desk. `in-on` | **The book is on the desk.** |

（太字が正答。）

#### 1.7.5 ask 練習（level 2、8問、形式 `ask`）
- prompt: `「どこ？」と たずねて、こたえて いるよ。たずねた ものは どこに ある？`
- audio: `[en('where', 問い), en('where', こたえ)]`、`gapMs: 800`
- options: 正答 `(o,p,c)`、ようすだけ違う `(o,p',c)` → `pairMis(p,p')`、ものだけ違う `(o',p,c)` → `it-mix`。label は `thingJa`。
- hints:
  1. `1つめは「〜は どこ？」と たずねる 文《ぶん》だよ。なにを さがして いるかな。`
  2. `こたえの 文《ぶん》の はじめの ことばは、たずねた ものの ことだよ。`
  3. `こたえの まんなかと さいごの ことばで、ばしょが わかるよ。`
- explain: `たずねた ${OBJ_JA[o]}は、${posJa(p,c)}に あります。`
- explainFigure: `{ kind: 'column', items: [{ kind: 'illust', id }, enText(問い, 'm'), enText(こたえ, 'm')] }`
- identity: `ask:${slugOf(問い)}:${slugOf(こたえ)}`

| # | 問い | こたえ | 正答 | ようす違い | it-mix |
|---|---|---|---|---|---|
| 1 | Where is my cap? | It's under the desk. | cap-under-desk | cap-on-desk `on-under` | ball-under-desk |
| 2 | Where is the cat? | It's on the desk. | cat-on-desk | cat-under-desk `on-under` | book-on-desk |
| 3 | Where is my ball? | It's in the desk. | ball-in-desk | ball-on-desk `in-on` | cap-in-desk |
| 4 | Where is my book? | It's on the bed. | book-on-bed | book-under-bed `on-under` | cap-on-bed |
| 5 | Where is the cat? | It's in the bed. | cat-in-bed | cat-under-bed `in-under` | ball-in-bed |
| 6 | Where is my ball? | It's under the bed. | ball-under-bed | ball-on-bed `on-under` | cat-under-bed |
| 7 | Where is my cap? | It's in the desk. | cap-in-desk | cap-under-desk `in-under` | book-in-desk |
| 8 | Where is my book? | It's under the desk. | book-under-desk | book-in-desk `in-under` | ball-under-desk |

（5 の it-mix の絵 ball-in-bed は不自然な組だが、誤答の絵として使うだけ。テスト 4 は音声の文だけを見る。）

#### 1.7.6 ask 別例（level 2、4問、`alt: true`、形式 `not`）: 「ない」ばしょと「ある」ばしょ
- prompt: `たずねた ものは どこに ある？ 「ない」ばしょも いって いるよ。`
- audio: `[en('where', 問い), en('where', こたえ2文)]`、`gapMs: 800`
- hints: 1 `こたえには 2つの 文《ぶん》が あるよ。` 2 `1つめの こたえは「そこには ない」と いう いみだよ。` 3 `2つめの こたえの ばしょを 聞《き》こう。`
- explain: `${posJa(ない)}には なくて、${posJa(ある)}に あります。`（例「ベッドの 上《うえ》には なくて、ベッドの 下《した》に あります。」）
- explainFigure: illust＋問い＋こたえ（ask と同じ形）
- identity: `not:${slugOf(問い)}:${slugOf(こたえ)}`

| # | 問い | こたえ（1つの音声） | 正答 | not-heard | もう1つ |
|---|---|---|---|---|---|
| 1 | Where is my ball? | It's not on the bed. It's under the bed. | ball-under-bed | ball-on-bed | ball-under-desk `place-mix` |
| 2 | Where is the cat? | It's not under the desk. It's on the desk. | cat-on-desk | cat-under-desk | cat-on-bed `place-mix` |
| 3 | Where is my book? | It's not in the desk. It's on the desk. | book-on-desk | book-in-desk | book-on-bed `place-mix` |
| 4 | Where is my cap? | It's not on the bed. It's on the desk. | cap-on-desk | cap-on-bed | cap-under-desk `on-under` |

（not-heard の誤答は「ない」と言った ばしょの絵。テスト 5 の「1点だけ違う」は not の問題も満たす。）

### 1.8 到達項目ごとの数
| 到達項目 | 練習（異なるキー） | 別例 |
|---|---|---|
| prep | 12（pos） | 6（word 3・phrase 3） |
| thing | 8（thing） | 4（pic） |
| ask | 8（ask） | 4（not） |
| 計 | 42 → Q 1.40 | |

---

## 2. g6.en.future 「したい こと・なりたい ものを 聞《き》こう」

| 項目 | 値 |
|---|---|
| 単元ID | `g6.en.future` |
| title | `したい こと・なりたい ものを 聞《き》こう` |
| stage / 領域 | `g6` / `en` |
| エンジン | listen |
| 前提 prereq | `['g6.en.past']` |
| basis | `小学校学習指導要領（平成29年告示）外国語 第5・6学年 聞くこと（日常生活に関する身近で簡単な事柄について、具体的な情報を聞き取る／短い話の概要を捉える）。将来の夢・中学校でしたいこと（I want to 〜.）` |
| gradeIsAppProposal | true |
| 場面（場8） | 発表 8 本（将来の夢 5・中学校でしたいこと 3。2.10 の表） |

人名は出さない（「この 人《ひと》」）。性別を思わせる語を使わない（職業・好きなものの組で性役割を固定しない）。国名は一般の国名だけ（団体・商品名なし）。

### 2.1 到達項目
| id | title |
|---|---|
| `be` | `なりたい もの（しごと）を 聞《き》きとる` |
| `want` | `したい こと（行《い》きたい・見《み》たい・食《た》べたい など）を 聞《き》きとる` |
| `dream` | `ゆめや 中学校《ちゅうがっこう》で したい ことの 発表《はっぴょう》が わかる` |

### 2.2 段階 levels
`[{ label: 'なりたい もの', chance: 0.05 }, { label: 'したい こと', chance: 0.05 }, { label: 'みじかい 発表《はっぴょう》', chance: 0.05 }]`（be=0、want=1、dream=2）

### 2.3 誤概念
| id | explain |
|---|---|
| `job-near` | `にて いる しごとと とりちがえたのかな。文《ぶん》の さいごの しごとの なまえを もういちど 聞《き》こう。` |
| `job-mix` | `ちがう しごとを えらんだのかな。「〜に なりたい」の あとの ことばを 聞《き》こう。` |
| `verb-mix` | `「なにを するか」の ことば（行《い》く・見《み》る・食《た》べる など）を とりちがえたのかな。「〜したい」の すぐ あとの ことばを 聞《き》こう。` |
| `word-mix` | `ものや ばしょの ことばを とりちがえたのかな。さいごの ほうの ことばを もういちど 聞《き》こう。` |
| `like-want` | `「すき」と「したい」を とりちがえたのかな。「すき」の 文《ぶん》と「したい」の 文《ぶん》を わけて 聞《き》こう。` |
| `reason-mix` | `わけ（どうして）を とりちがえたのかな。「〜が すき」と いって いる 文《ぶん》を 聞《き》こう。` |
| `detail-what` | `ものを とりちがえたのかな。その ぶぶんの 文《ぶん》を もういちど 聞《き》こう。` |
| `detail-who` | `だれの ためかを とりちがえたのかな。文《ぶん》の さいごの ことばを 聞《き》こう。` |
| `detail-place` | `ばしょを とりちがえたのかな。「どこ」を いう ことばを もういちど 聞《き》こう。` |
| `gist-part` | `発表《はっぴょう》の 一部《いちぶ》だけ、または 発表《はっぴょう》に ない ことで えらんだのかな。ぜんぶの 文《ぶん》に あうか たしかめよう。` |

### 2.4 導入 intro
1. text: `「〜に なりたい」は、将来《しょうらい》の ゆめを つたえる 言《い》い方《かた》だよ。`
   figure: `{ kind: 'column', items: [enText('I want to be a pilot.', 'l')] }`
2. text: `「〜したい」の あとに、する こと（行《い》く・見《み》る・食《た》べる など）が くるよ。`
   figure: `{ kind: 'column', items: [enText('I want to go to Canada.', 'l'), enText('I want to eat pizza.', 'l')] }`

### 2.5 しごと（be で使う）
| 英語（冠詞つき） | 日本語 label | 絵（既存） | なかま |
|---|---|---|---|
| a doctor | 医者《いしゃ》 | life-hospital | heal |
| a vet | じゅうい | dog | heal |
| a baker | パンやさん | life-bakery | shop |
| a florist | 花《はな》やさん | life-flowershop | shop |
| a pilot | パイロット | airplane | sky |
| an astronaut | 宇宙《うちゅう》飛行士《ひこうし》 | rocket | sky |
| a firefighter | 消防士《しょうぼうし》 | life-firestation | safe |
| a police officer | 警察官《けいさつかん》 | life-police | safe |
| a singer | 歌手《かしゅ》 | music-note | stage |
| a soccer player | サッカー選手《せんしゅ》 | ball | stage |

なかまのヒント（ヒント③）:
- heal: `びょうきや けがを なおす しごとだよ。`
- shop: `お店《みせ》で ものを うる しごとだよ。`
- sky: `空《そら》を とぶ ものに のる しごとだよ。`
- safe: `町《まち》の 人《ひと》の あんぜんを まもる しごとだよ。`
- stage: `大《おお》ぜいの 人《ひと》の 前《まえ》で かつやくする しごとだよ。`
（life-* の絵は life-g12 の絵。既存テストの `known()` が life-g12 を見る。）

### 2.6 be 練習（level 0、10問、形式 `be`）
- prompt: `この 人《ひと》が なりたい ものは どれ？`
- audio: `en('future', \`I want to be ${冠詞つき}.\`)`
- options: 正答、同じなかまのもう1つ → `job-near`、表の「ほか」→ `job-mix`。figure は 2.5 の絵、label は日本語。
- hints:
  1. `「〜に なりたい」と いう いみの ことばの あとに、しごとの なまえが くるよ。`
  2. `しごとの なまえは、文《ぶん》の さいごの ことばだよ。`
  3. なかまのヒント（2.5）。正答と job-near の両方に当てはまるので、答えは決まらない。
- explain: `「${日本語}に なりたい」と いって います。`
- explainFigure: `enText(英文)`
- identity: `be:${slugOf(英文)}`

| 正答 | job-near | job-mix（ほか） |
|---|---|---|
| doctor | vet | pilot |
| vet | doctor | baker |
| baker | florist | firefighter |
| florist | baker | singer |
| pilot | astronaut | police officer |
| astronaut | pilot | doctor |
| firefighter | police officer | florist |
| police officer | firefighter | soccer player |
| singer | soccer player | vet |
| soccer player | singer | astronaut |

### 2.7 be 別例（level 0、4問、`alt: true`、形式 `desc`）: せつめいを読んで、3つの文から選ぶ
- figure: `{ kind: 'text', text: せつめい, size: 'm' }`
- prompt: `3つの 文《ぶん》を 聞《き》こう。書《か》かれて いる しごとに なりたい 人《ひと》は なんばんめ？`
- audio: 3文を `en('future', …)` で順に、`gapMs: 900`。options: `ordinalOptions(3, 正答の位置, …)`、`fixedOrder: true`。
- hints: 1 `3つの 文《ぶん》は、さいごの しごとの なまえだけが ちがうよ。` 2 `書《か》かれて いる しごとの なまえを、英語《えいご》で 思《おも》い出《だ》そう。` 3 `1つずつ 聞《き》いて、しごとの なまえが あう 文《ぶん》を さがそう。`
- explain: `${n}ばんめの 文《ぶん》が「${日本語}に なりたい」です。`
- explainFigure: 3文の column（'m'）
- identity: `desc:${slugOf(正答の英文)}`

| せつめい（figure） | 1ばんめ | 2ばんめ | 3ばんめ |
|---|---|---|---|
| `子《こ》どもたちに 勉強《べんきょう》を 教《おし》える 人《ひと》` | I want to be a doctor. `job-mix` | **I want to be a teacher.**（先生《せんせい》） | I want to be a singer. `job-mix` |
| `動物《どうぶつ》の びょうきや けがを なおす 人《ひと》` | **I want to be a vet.**（じゅうい） | I want to be a doctor. `job-near` | I want to be a florist. `job-mix` |
| `ひこうきを うごかす 人《ひと》` | I want to be an astronaut. `job-near` | I want to be a baker. `job-mix` | **I want to be a pilot.**（パイロット） |
| `火事《かじ》を 消《け》す 人《ひと》` | **I want to be a firefighter.**（消防士《しょうぼうし》） | I want to be a police officer. `job-near` | I want to be a singer. `job-mix` |

（`I want to be a doctor.` などは be 練習と同じ英文で、台本の key も同じになる。種類 'future' で同じ文なので衝突しない。）

### 2.8 want 練習（level 1、10問、形式 `want`）
- prompt: `この 人《ひと》が したい ことは どれ？`
- audio: `en('future', 英文)`
- options: 正答、`verb-mix`（同じものに別の動き）、`word-mix`（同じ動きで別のもの）。絵なし。
- hints:
  1. `「〜したい」と いう いみの ことばの あとに、する ことが くるよ。`
  2. `すぐ あとの ことばが「なにを するか」（行《い》く・見《み》る・食《た》べる など）だよ。`
  3. `さいごの ほうの ことばが「なにを・どこで」だよ。2つを あわせよう。`
- explain: `「${正答}」と いって います。`、explainFigure: `enText(英文)`
- identity: `want:${slugOf(英文)}`

| # | 英文 | 正答 | verb-mix | word-mix |
|---|---|---|---|---|
| 1 | I want to eat pizza. | ピザを 食《た》べたい | ピザを 作《つく》りたい | カレーを 食《た》べたい |
| 2 | I want to make a cake. | ケーキを 作《つく》りたい | ケーキを 食《た》べたい | クッキーを 作《つく》りたい |
| 3 | I want to see pandas. | パンダを 見《み》たい | パンダの 絵《え》を かきたい | コアラを 見《み》たい |
| 4 | I want to go to Canada. | カナダに 行《い》きたい | カナダの 本《ほん》を 読《よ》みたい | ケニアに 行《い》きたい |
| 5 | I want to play the guitar. | ギターを ひきたい | ギターを 買《か》いたい | ピアノを ひきたい |
| 6 | I want to swim in the sea. | 海《うみ》で およぎたい | 海《うみ》を 見《み》たい | 川《かわ》で およぎたい |
| 7 | I want to read many books. | 本《ほん》を たくさん 読《よ》みたい | 本《ほん》を たくさん 買《か》いたい | 手紙《てがみ》を たくさん 読《よ》みたい |
| 8 | I want to climb a big mountain. | 大《おお》きな 山《やま》に 登《のぼ》りたい | 大《おお》きな 山《やま》を 見《み》たい | 大《おお》きな 木《き》に 登《のぼ》りたい |
| 9 | I want to join the soccer team. | サッカー部《ぶ》に 入《はい》りたい | サッカーの しあいを 見《み》たい | 野球部《やきゅうぶ》に 入《はい》りたい |
| 10 | I want to study science. | 理科《りか》を 勉強《べんきょう》したい | 理科《りか》を 教《おし》えたい | 算数《さんすう》を 勉強《べんきょう》したい |

### 2.9 want 別例（level 1、4問、`alt: true`、形式 `likewant`）: 「すき」と「したい」
- prompt: `この 人《ひと》が したい ことは どれ？ すきな ことも いって いるよ。`
- audio: `en('future', 2文)`（1つの音声）
- hints: 1 `2つの 文《ぶん》が あるよ。1つは「すき」、もう1つは「したい」。` 2 `2つめの 文《ぶん》が「〜したい」の 文《ぶん》だよ。` 3 `2つめの 文《ぶん》の まんなかと さいごを 聞《き》こう。`
- explain: `${すき}が すきで、「${正答}」と いって います。`
- explainFigure: `enText(2文, 'm')`
- identity: `likewant:${slugOf(2文)}`

| 2文（1つの音声） | すき（解説用） | 正答 | like-want | verb-mix |
|---|---|---|---|---|
| I like soccer. I want to play baseball. | サッカー | 野球《やきゅう》を したい | サッカーを したい | 野球《やきゅう》を 見《み》たい |
| I like cats. I want to see pandas. | ねこ | パンダを 見《み》たい | ねこを 見《み》たい | パンダの 絵《え》を かきたい |
| I like music. I want to play the drums. | 音楽《おんがく》 | ドラムを たたきたい | 音楽《おんがく》を 聞《き》きたい | ドラムを 買《か》いたい |
| I like Italy. I want to go to France. | イタリア | フランスに 行《い》きたい | イタリアに 行《い》きたい | フランスの 料理《りょうり》を 食《た》べたい |

（解説の例:「サッカーが すきで、「野球《やきゅう》を したい」と いって います。」）

### 2.10 dream（level 2）: 発表 8 本（場8）
各発表に 練習1問（形式 `dream`）と あらまし1問（形式 `gist`、`alt: true`）。audio は 3文を `en('dream', 文)` で順に、`gapMs: 700`。

**練習 `dream`**
- prompt: `みじかい 発表《はっぴょう》を 聞《き》こう。${問い}`
- options: 正答＋誤り2（表の誤概念）
- hints: 1 `発表《はっぴょう》は 3つの 文《ぶん》で できて いるよ。` 2 `${at}つめの 文《ぶん》に こたえが あるよ。` 3 `${at}つめの 文《ぶん》の さいごの ほうを よく 聞《き》こう。`
- explain: `${at}つめの 文《ぶん》から、こたえは「${正答}」です。`
- explainFigure: 3文の column（'m'）
- identity: `dream:${id}`

**あらまし `gist`（alt）**
- prompt: `みじかい 発表《はっぴょう》を 聞《き》こう。どんな 話《はなし》だった？`、`layout: 'column'`
- 誤り2つは `gist-part`
- hints: 1 `1つめの 文《ぶん》で、なにを したいかが わかるよ。` 2 `2つめ・3つめの 文《ぶん》で、わけや くわしい ことが わかるよ。` 3 `ぜんぶの 文《ぶん》に あう ものを えらぼう。`
- explain: `「${正答}」です。`
- explainFigure: 3文の column
- identity: `gist:${id}`

| id | 3文 | 問い | at | 正答 | 誤り（誤概念） | あらまし 正答 | あらまし 誤り（gist-part） |
|---|---|---|---|---|---|---|---|
| vet | My dream is to be a vet. / I like animals. / I want to help sick animals. | どうして その しごとを したいの？ | 2 | 動物《どうぶつ》が すきだから | 花《はな》が すきだから `reason-mix`／お店《みせ》を したいから `reason-mix` | じゅういに なって 動物《どうぶつ》を たすけたい 話《はなし》 | 動物《どうぶつ》を たくさん かいたい 話《はなし》／医者《いしゃ》に なって 人《ひと》を たすけたい 話《はなし》 |
| pilot | My dream is to be a pilot. / I like airplanes. / I want to go to many countries. | なにに なりたい？ | 1 | パイロット | 宇宙《うちゅう》飛行士《ひこうし》 `job-near`／先生《せんせい》 `job-mix` | パイロットに なって いろいろな 国《くに》へ 行《い》きたい 話《はなし》 | ひこうきを 作《つく》りたい 話《はなし》／いろいろな 国《くに》の 料理《りょうり》を 食《た》べたい 話《はなし》 |
| band | In junior high school, I want to join the brass band. / I like music. / I want to play the trumpet. | なんの 楽器《がっき》を えんそうしたい？ | 3 | トランペット | ピアノ `detail-what`／ギター `detail-what` | 中学校《ちゅうがっこう》で すいそうがく部《ぶ》に 入《はい》りたい 話《はなし》 | 音楽《おんがく》の 先生《せんせい》に なりたい 話《はなし》／トランペットを 買《か》いたい 話《はなし》 |
| baker | My dream is to be a baker. / I like bread. / I want to make delicious bread for my town. | だれの ために パンを 作《つく》りたい？ | 3 | 町《まち》の 人《ひと》 | かぞく `detail-who`／ともだち `detail-who` | パンやさんに なって 町《まち》の ために パンを 作《つく》りたい 話《はなし》 | パンを たくさん 食《た》べたい 話《はなし》／ケーキやさんに なりたい 話《はなし》 |
| soccer | In junior high school, I want to join the soccer team. / I want to run fast. / I also want to make many friends. | どの 部《ぶ》に 入《はい》りたい？ | 1 | サッカー部《ぶ》 | 野球部《やきゅうぶ》 `detail-what`／陸上部《りくじょうぶ》 `detail-what` | 中学校《ちゅうがっこう》で サッカー部《ぶ》に 入《はい》って がんばりたい 話《はなし》 | 友《とも》だちと サッカーを 見《み》に 行《い》く 話《はなし》／中学校《ちゅうがっこう》の 友《とも》だちを しょうかいする 話《はなし》 |
| teacher | My dream is to be a teacher. / I like children. / I want to teach math. | なにを 教《おし》えたい？ | 3 | 算数《さんすう》 | 英語《えいご》 `detail-what`／音楽《おんがく》 `detail-what` | 先生《せんせい》に なって 算数《さんすう》を 教《おし》えたい 話《はなし》 | 子《こ》どもと あそびたい 話《はなし》／算数《さんすう》を 勉強《べんきょう》したい 話《はなし》 |
| singer | My dream is to be a singer. / I like singing. / I want to sing on a big stage. | どこで 歌《うた》いたい？ | 3 | 大《おお》きな ステージ | 学校《がっこう》の 教室《きょうしつ》 `detail-place`／大《おお》きな 公園《こうえん》 `detail-place` | 歌手《かしゅ》に なって 大《おお》きな ステージで 歌《うた》いたい 話《はなし》 | 歌《うた》を 聞《き》くのが すきな 話《はなし》／ステージを 作《つく》りたい 話《はなし》 |
| english | In junior high school, I want to study English hard. / I want to go to Australia. / I want to see koalas. | どこへ 行《い》きたい？ | 2 | オーストラリア | カナダ `detail-place`／アメリカ `detail-place` | 英語《えいご》を がんばって オーストラリアへ 行《い》きたい 話《はなし》 | オーストラリアの 先生《せんせい》の 話《はなし》／どうぶつえんで コアラを 見《み》た 話《はなし》 |

注意:
- 「中学校で〜」の文は `In junior high school,` を文頭に置く（ヒント③「Nつめの 文の さいごの ほう」が答えの語に当たるように）。
- band の誤り「ピアノ」「ギター」、soccer の「陸上部（run fast にひっかかる）」、singer の「大きな 公園（big にひっかかる）」は、聞こえた語の一部にひっかける誤答として選んだ。
- vet の at は 2（「I like animals.」）。3つめの文「病気の動物を助けたい」もわけになるが、正答「動物が すきだから」は2つめの文、誤り2つ（花・お店）はどちらの文にも無いので正答は1つ。

### 2.11 到達項目ごとの数
| 到達項目 | 練習 | 別例 |
|---|---|---|
| be | 10（be） | 4（desc） |
| want | 10（want） | 4（likewant） |
| dream | 8（dream） | 8（gist） |
| 計 | 44 → Q 1.47 | |

---

## 3. 内容の確かめ（設計で行ったこと）
- 英文: 文法・冠詞（an astronaut）・語の自然さを確かめた。`in the desk` は「物入れのある学校の机の中」として自然に使える言い方。`in the bed` は ねこ（ふとんに入っている）だけを問う（ボール・ぼうし・本は誤答の絵だけ）。`cat is in the desk` も問わない。
- 学年の漢字: g5 の文は 中・上・下・文・聞・音・絵・見・本・物 など（すべて1〜3年）。「机」（6年）は使わない。g6 の文は 医・者・宇・宙・飛・行・士・消・防・警・察・官・選・手・歌・将・来・勉・強・教・理・科・算・数・登・陸・器・楽・野・球・部・紙・料・公・園・室・発・表・友・店・火・事・動・物 など（すべて6年以下）。実装後に既存テストの「学年より上の漢字」検査で再確認する。
- 人名・団体・商品名なし。国名は一般名（カナダ・ケニア・イタリア・フランス・オーストラリア・アメリカ）。
- 性役割: 話し手は「この 人」だけで、性別を示す語が無い。

## 4. 実装の順と確認
1. `src/illust/content/en-g56.tsx`（24点）→ gallery で目視。
2. `where.ts`・`future.ts` → `index.ts` に追加。
3. テストを足す（0.3）→ `script-en.json` を作り直す（0.4）。
4. `npx vitest run src/packs/en-g56`、`npx tsc -b`、`npx eslint src/packs/en-g56 src/illust/content/en-g56.tsx`、`npm run check:design`、最後に `npm run build:unit-index`。
5. 報告: 単元ごとの Q・C・問題数・誤概念数・汎用誤答、作った絵の id、未確認のこと（絵の見え方など）。

## 5. 統括への申し送り（設計者から）
- curriculum-matrix の 3.8 g5.en.where・3.9 g6.en.future の「状」は、実装後に統括が更新する（担当は matrix を編集しない）。P2 で「導→基→応」が「−」なので、段階は本設計で決めた（where: ことば → なにが どこに → たずねて こたえる、future: なりたい もの → したい こと → 発表）。
- 絵 24 点（en56-*）は registry の自動読み込み（content/*.tsx）で入る。登録の作業は要らないはず。gallery の一覧に 24 点が増える。
- 音声の台本は `script-en.json` に入る（where 約 58 本・future/dream 約 60 本の見込み）。mp3 の生成は統括。
