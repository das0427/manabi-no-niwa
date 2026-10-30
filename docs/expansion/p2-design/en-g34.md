# en-g34 の P2 単元の設計書（docs/expansion/p2-design/en-g34.md）

版 1（2026-10-30）／設計: Opus／実装: 別のモデル（この文書のとおりに書く）
対象: `g3.en.likes`・`g4.en.want`・`g4.en.directions`（curriculum-matrix 3.6・3.7 の P2 行）

この文書だけで実装できるように、英文・日本語の文・選択肢・正答・誤概念・ヒント・解説を全部書く。
**内容（英文・語・正答）を実装で変えない**。足りない・おかしいと思ったら変えずに報告に書く。

---

## 0. 共通（3単元とも）

### 0.1 置き場所・編集してよいファイル
- 新しいファイル: `src/packs/en-g34/likes.ts`・`want.ts`・`directions.ts`（1ファイル1単元）。
- 変えるファイル: `src/packs/en-g34/index.ts`（units の末尾に `likes, want, directions` を足す）、`lib.ts`（0.4 の `figure` を足すだけ）、`en-g34.test.ts`（各単元の 「テストで確かめること」を足す）、`script-en.json`（0.6 で作り直す）。
- 新しい絵は**作らない**（既存の絵と `figure: { kind: 'svg' }` で足りる）。`src/illust/content/en-g34.tsx` は変えない。
- 他のパックを import しない。値で import してよい本体のモジュールは pack-brief のとおり。

### 0.2 書き方は既存の P1（greetings.ts・time-days.ts）にそろえる
- 問題は `lib.ts` の `listen({...})` で作る（engine は全部 `listen`）。
- `kind: 'knowledge'`、`domain: 'en'`、`subject: 'en'`、`priority: 'P2'`、`status: 'ready'`、`review: 'objective'`（matrix の復習欄が SR観）、`gradeIsAppProposal: true`、`revised: '2026-10-30'`。
- 段階 `levels` の `chance` は 0.05（3択。P1 と同じ）。
- `id` と `identity` は同じ文字列にする（P1 と同じ。形式の接頭辞 × 英文のスラッグ／場面ID）。
- **問題文・ヒント・解説・誤概念の説明・導入の文に英字を入れない**（日本語の音声で読むため。テスト `問題文・導入に英字` が prompt と intro を検査する。ヒント・解説も同じ方針で英字を書かない）。英語は 音声（audio）・選択肢・図（`enText`）にだけ置く。
- 漢字は必ず `漢字《よみ》`。g3 単元は3年までの字、g4 単元は4年までの字だけ（この文書の文はその範囲で書いてある）。
- 選択肢は3つ（小3・小4 の上限は4。地図の問題だけ4つ）。誤りの選択肢には**全部**誤概念IDを付ける（汎用誤答 0%）。
- ヒントは3段。③は「誤りを1つ消す」か「途中まで言う」形で、**正答の選択肢が1つに決まらない**ようにする（各表の ③ はそうなるように選んである）。
- ヒント③で誤りを消すときは `notHint(label)`（lib.ts）を使う。`notHint` に渡す選択肢を各表で「③で消す」と書いた。
- 選択肢が絵のときは `{ figure: { kind: 'illust', id }, label: 'ひらがなの名前' }`（greetings の `faceOpt` と同じ形。label は ③ の `notHint` に使う）。

### 0.3 音声キー（`en(cat, text)`）
| cat | 使う単元 | 例 |
|---|---|---|
| `like` | likes | `I like apples.`・`I don't like carrots.`・`What do you like?` |
| `likeq` | likes | `Do you like elephants?` |
| `reply` | likes | `Yes, I do.`・`No, I don't.` |
| `want` | want | `I want a banana.`・`I want two apples and three bananas.` |
| `shop` | want | `What do you want?`・`How many?`・`Apples, please.`・`Six, please.`・`How many tomatoes do you want?` |
| `place` | directions | `Where is the station?`・`Let's go to the library.` |
| `dir` | directions | `Go straight.`・`Turn right.`・`Turn left.`・`Stop.`・`It's on your right.`・`It's on your left.` |

- 同じ英文は同じキーになる（例 `I want a banana.` を2つの問題で使う）。同じキーに違う文が無いことは既存のテストが見る。
- 既存の cat（abc・num・color・day・time・plan・ask・phrase・feel など）と名前を重ねない（上の表は重ならない）。
- 複数の音（やりとり・道順）は配列にして `gapMs` を付ける（やりとり 800、道順 600）。

### 0.4 lib.ts の変更（1か所だけ）
`ListenSpec` に `figure?: Figure` を足し、`listen()` で `...(s.figure ? { figure: s.figure } : {})` を返す。
（directions の「地図で 場所を 見つける」で、地図を問題の図として出すため。UnitRunner が `item.figure` を問題文の下に描く。既存の単元には影響しない）

### 0.5 解説の図
各問題の `explainFigure` は、聞いた英語を `enText(英文)`（複数の音は `' → '` でつなぎ `'m'`）で見せる。directions の地図の問題だけは 道順を描いた地図（3.6）。

### 0.6 script-en.json の作り直し
単元を足したら、`englishScript(pack)` の結果で `script-en.json` の `entries` を置き換える（`version` と `defaults` はそのまま）。例（作業ツリーの根で。ファイルは作らずに1回だけ実行）:
```
npx tsx --tsconfig tsconfig.app.json -e "import fs from 'node:fs'; import pack from './src/packs/en-g34/index.ts'; import { englishScript } from './src/packs/en-g34/voice.ts'; const f='src/packs/en-g34/script-en.json'; const j=JSON.parse(fs.readFileSync(f,'utf8')); j.entries=englishScript(pack).entries; fs.writeFileSync(f, JSON.stringify(j,null,2)+'\n');"
```
その後 `npx prettier --check src/packs/en-g34/script-en.json`（崩れていたら `--write`）。**音声ファイル（mp3）は作らない**（統括が台本から作る）。

### 0.7 赤と緑
同じ問題の選択肢に、赤い物（りんご・いちご・トマト・赤い車）と緑の物（かえる・かめ・きゅうり・ピーマン）を一緒に並べない（DESINGN 3.1。下の表はそうなっている）。どの問題も色ではなく形・数・文字で区別する。

### 0.8 使う絵（すべて既存。新しい絵なし）
| ID | 名前 | ID | 名前 | ID | 名前 |
|---|---|---|---|---|---|
| apple | りんご | banana | バナナ | strawberry | いちご |
| peach | もも | tomato | トマト | carrot | にんじん |
| lemon | レモン | egg | たまご | bread | パン |
| cucumber | きゅうり | eggplant | なす | green-pepper | ピーマン |
| onigiri | おにぎり | p5-cake | ケーキ | dog | いぬ |
| cat | ねこ | rabbit | うさぎ | bear | くま |
| monkey | さる | elephant | ぞう | frog | かえる |
| fox | きつね | bird | とり | cow | うし |
| ant | あり | turtle | かめ | p23-duck | あひる |
| p23-pig | ぶた | p23-sheep | ひつじ | train | でんしゃ |
| airplane | ひこうき | ship | ふね | car-red | くるま |
| p5-book | ほん | p5-rocket | ロケット | p5-ribbon | リボン |
| pencil | えんぴつ | flower | はな | | |
| life-station | えき | life-firestation | しょうぼうしょ | life-hospital | びょういん |
| life-library | としょかん | life-police | こうばん | life-bakery | パンやさん |
| life-flowershop | おはなやさん | life-vegeshop | やおやさん | | |
| strawberry（アイコン） | likes の icon | mode-shopping | want の icon | mode-road | directions の icon |

life-* は `src/illust/content/life-g12.tsx`（自動で登録される）。テストの「つかって いる 絵は すべて ある」は `getIllust` で見つかる。

---

## 1. g3.en.likes すきな もの（I like 〜. Do you like 〜?）

### 1.1 単元の情報
| 項目 | 値 |
|---|---|
| id | `g3.en.likes` |
| title | `すきな もの` |
| stage | g3 |
| icon | `strawberry` |
| prereq | `['g3.en.greetings']` |
| 使うエンジン | listen |
| basis | `小学校学習指導要領（平成29年告示）外国語活動 第3・4学年 聞くこと（身近で簡単な事柄に関する基本的な表現の意味が分かる）・話すこと［やり取り］（質問をしたり質問に答えたりする。本アプリは聞き取りだけを扱い、話すことは評価しない）。好みを伝え合う表現` |
| gradeIsAppProposal | true（外国語活動は3・4年のまとまり。3年に置くのは本アプリの案） |
| 種・量 | 知（場8: 1.5 の「たずねる・こたえる」の8場面）。手作り。基準 M=30 |

### 1.2 到達項目
| id | title |
|---|---|
| `like` | `すきな ものを 聞《き》きとる` |
| `not` | `すき・すきではないを 聞《き》きわける` |
| `ask` | `すきか たずねる・こたえる やりとりが わかる` |

levels: `[{ label: 'すきな もの' }, { label: 'すき・すきではない' }, { label: 'たずねる・こたえる' }]`（chance 0.05）。
段階: like の問題は level 0、not は level 1（2つの文の問題も 1）、ask は level 2。別例（alt）も同じ段階。

### 1.3 誤概念
| id | explain |
|---|---|
| `same-start` | `はじめの 音《おと》が にている ことばと おなじだと かんがえたのかな。ことばの さいごまで 聞《き》こう。` |
| `same-group` | `おなじ なかま（たべもの・どうぶつ・のりもの）なら おなじだと かんがえたのかな。聞《き》こえた ことばの 音《おと》を たしかめよう。` |
| `dont-mix` | `「すき」と「すきではない」を おなじだと かんがえたのかな。「すき」の ことばの まえに、もう ひとつ 音《おと》が あったか 聞《き》こう。` |
| `yes-no` | `「はい」と「いいえ」の こたえを 反対《はんたい》に かんがえたのかな。こたえの さいしょの ことばを よく 聞《き》こう。` |
| `ask-tell` | `たずねて いる 文《ぶん》を、「すきだ」と いって いる 文《ぶん》だと かんがえたのかな。はじめの ことばと、さいごの 音《おと》の 上《あ》がりかたを 聞《き》こう。` |

### 1.4 導入（intro）
1. text `すきな ものを いう 文《ぶん》を 聞《き》いて、えらぶよ。` figure `enText('I like bananas.', 'xl')`
2. text `さいごの ことばが すきな もの。これは「バナナが すき」と いう いみだよ。` figure `{ kind: 'illust', id: 'banana' }`
3. text `すきではない ときは、すきの まえに ことばが 1つ ふえるよ。聞《き》いたら まねして いって みよう（こたえあわせは しないよ）。` figure `enText("I don't like bananas.", 'l')`

### 1.5 問題

#### (a) like（level 0）: 「I like 〜.」を聞いて絵を選ぶ — 16問
- id/identity: `like:<slugOf(英文)>`（例 `like:i-like-apples`）
- prompt: `聞《き》こえた 人《ひと》の すきな ものは どれ？`
- audio: `en('like', 英文)`
- options: 正答の絵 ＋ 誤り2つ（絵＋ひらがなの名前。0.2）
- hints:
  ① `さいごの ことばが すきな ものだよ。「もういちど きく」で なんども 聞《き》けるよ。`
  ② `はじめの 音《おと》が にている ものが あるよ。ことばの うしろの ほうも 聞《き》こう。`
  ③ `notHint(誤り1 の名前)`
- explain: `「${正答の名前}が すき」と いって います。`

| # | 英文 | 正答（絵 / 名前） | 誤り1（③で消す） | 誤り2 |
|---|---|---|---|---|
| 1 | I like apples. | apple / りんご | airplane / ひこうき・same-start | ant / あり・same-start |
| 2 | I like bananas. | banana / バナナ | bear / くま・same-start | p5-book / ほん・same-start |
| 3 | I like strawberries. | strawberry / いちご | p23-sheep / ひつじ・same-start | ship / ふね・same-start |
| 4 | I like peaches. | peach / もも | p23-pig / ぶた・same-start | pencil / えんぴつ・same-start |
| 5 | I like tomatoes. | tomato / トマト | train / でんしゃ・same-start | peach / もも・same-group |
| 6 | I like carrots. | carrot / にんじん | cat / ねこ・same-start | car-red / くるま・same-start |
| 7 | I like cake. | p5-cake / ケーキ | cow / うし・same-start | cat / ねこ・same-start |
| 8 | I like eggs. | egg / たまご | elephant / ぞう・same-start | bread / パン・same-group |
| 9 | I like dogs. | dog / いぬ | p23-duck / あひる・same-start | cat / ねこ・same-group |
| 10 | I like cats. | cat / ねこ | carrot / にんじん・same-start | cow / うし・same-start |
| 11 | I like rabbits. | rabbit / うさぎ | p5-rocket / ロケット・same-start | p5-ribbon / リボン・same-start |
| 12 | I like bears. | bear / くま | banana / バナナ・same-start | bird / とり・same-start |
| 13 | I like elephants. | elephant / ぞう | egg / たまご・same-start | monkey / さる・same-group |
| 14 | I like frogs. | frog / かえる | fox / きつね・same-start | rabbit / うさぎ・same-group |
| 15 | I like trains. | train / でんしゃ | turtle / かめ・same-start | airplane / ひこうき・same-group |
| 16 | I like flowers. | flower / はな | fox / きつね・same-start | frog / かえる・same-start |

#### (b) like の別例（alt, level 0）: やりとりの中で聞いて、ことばを選ぶ — 5問
- id/identity: `like-qa:<slugOf(こたえの英文)>`
- prompt: `すきな ものを たずねて、こたえて いるよ。こたえた 人《ひと》の すきな ものは どれ？`
- audio: `[en('like', 'What do you like?'), en('like', こたえ)]`、`gapMs: 800`
- options: **ことばだけ**（label のみ。絵なし）
- hints: ① `あとの ほうの こたえを よく 聞《き》こう。` ② `こたえの さいごの ことばが すきな ものだよ。` ③ `notHint(誤り1)`
- explain: `「なにが すき？」と たずねて、「${正答}が すき」と こたえて います。`
- explainFigure: `enText('What do you like?  →  ' + こたえ, 'm')`

| # | こたえの英文 | 正答 | 誤り1（③） | 誤り2 |
|---|---|---|---|---|
| 1 | I like rabbits. | うさぎ | ロケット・same-start | リボン・same-start |
| 2 | I like peaches. | もも | ぶた・same-start | えんぴつ・same-start |
| 3 | I like trains. | でんしゃ | かめ・same-start | ひこうき・same-group |
| 4 | I like carrots. | にんじん | ねこ・same-start | くるま・same-start |
| 5 | I like bears. | くま | バナナ・same-start | とり・same-start |

#### (c) not（level 1）: すき・すきではない — 10問
1〜8: 1文を聞いて、ことばの選択肢（label のみ）から選ぶ。
- id/identity: `not:<slugOf(英文)>`
- prompt: `聞《き》こえた 文《ぶん》の いみは どれ？`
- audio: `en('like', 英文)`
- hints:
  ① `さいごの ことばで「なにが」、まえの ほうで「すきか どうか」が わかるよ。`
  ② `すきではない ときは、「すき」の ことばの まえに もう ひとつ ことばが 入《はい》るよ。`
  ③ `notHint(誤り same-start の label)`
- explain（すき）: `「${名前}が すき」と いって います。`
- explain（すきではない）: `「すき」の まえに ことばが 1つ あるので、「${名前}が すきではない」と いう いみです。`

| # | 英文 | 正答 | dont-mix の誤り | same-start の誤り（③） |
|---|---|---|---|---|
| 1 | I don't like carrots. | にんじんが すきではない | にんじんが すき | ねこが すきではない |
| 2 | I like peaches. | ももが すき | ももが すきではない | ぶたが すき |
| 3 | I don't like frogs. | かえるが すきではない | かえるが すき | きつねが すきではない |
| 4 | I like strawberries. | いちごが すき | いちごが すきではない | ひつじが すき |
| 5 | I don't like tomatoes. | トマトが すきではない | トマトが すき | でんしゃが すきではない |
| 6 | I like cats. | ねこが すき | ねこが すきではない | にんじんが すき |
| 7 | I don't like bears. | くまが すきではない | くまが すき | バナナが すきではない |
| 8 | I don't like eggs. | たまごが すきではない | たまごが すき | ぞうが すきではない |

9〜10: 2つの文を聞いて、すきな ものの絵を選ぶ（level 1）。
- id/identity: `not-two:<slugOf(1文目)>`
- prompt: `2つの 文《ぶん》を 聞《き》こう。この 人《ひと》が すきな ものは どれ？`
- audio: 2文の配列、`gapMs: 800`
- options: 絵＋名前
- hints: ① `2つの 文《ぶん》の、どちらが「すき」で どちらが「すきではない」かを 聞《き》こう。` ② `「すき」の まえに ことばが ある 文《ぶん》は、すきではない ものだよ。` ③ `notHint(same-start の名前)`
- explain: `「${A}が すき」「${B}が すきではない」と いって います。すきな ものは ${A}です。`（A=すきな物、B=すきではない物）
- explainFigure: `enText(1文目 + '  ' + 2文目, 'm')`

| # | 音声 | 正答 | dont-mix | same-start（③） |
|---|---|---|---|---|
| 9 | I like dogs. / I don't like cats. | dog / いぬ | cat / ねこ | p23-duck / あひる |
| 10 | I don't like tomatoes. / I like carrots. | carrot / にんじん | tomato / トマト | cat / ねこ |

#### (d) not の別例（alt, level 1）: ○と×の絵で選ぶ — 4問
- id/identity: `not-mark:<slugOf(英文)>`
- prompt: `すきな ものに ○、すきではない ものに × が ついて いるよ。聞《き》こえた 文《ぶん》に あうのは どれ？`
- audio: `en('like', 英文)`
- options: `{ figure: { kind: 'illust', id }, label: '<名前> ○' または '<名前> ×' }`（○・× は全角の記号。label の名前と記号の間は半角空白1つ）
- hints: ① `さいごの ことばで「なにが」が わかるよ。` ② `「すき」の ことばの まえに、もう ひとつ 音《おと》が あったかな。` ③ `notHint(same-start の label)`
- explain: すき → `「${名前}が すき」なので ○ です。`／すきではない → `「${名前}が すきではない」なので × です。`

| # | 英文 | 正答 | dont-mix | same-start（③） |
|---|---|---|---|---|
| 1 | I don't like rabbits. | rabbit・うさぎ × | rabbit・うさぎ ○ | p5-rocket・ロケット × |
| 2 | I like bananas. | banana・バナナ ○ | banana・バナナ × | bear・くま ○ |
| 3 | I don't like dogs. | dog・いぬ × | dog・いぬ ○ | p23-duck・あひる × |
| 4 | I like apples. | apple・りんご ○ | apple・りんご × | airplane・ひこうき ○ |

#### (e) ask（level 2）: たずねる・こたえる（8場面）— 8問
- id/identity: `ask:<場面ID>`
- prompt: `${場面}で 話《はな》して いるよ。こたえた 人《ひと》は どう おもって いる？`
- audio: `[en('likeq', 問い), en('reply', こたえ)]`、`gapMs: 800`
- options: ことば（label のみ）
- hints:
  ① `さいしょは たずねる 文《ぶん》、あとが こたえだよ。`
  ② `たずねる 文《ぶん》の さいごの ことばが「なにが」だよ。こたえの さいしょの ことばが「はい」か「いいえ」だよ。`
  ③ `notHint(same-start の label)`
- explain（Yes）: `「${名前}が すきですか」と たずねて、「はい、すきです」と こたえて います。`
- explain（No）: `「${名前}が すきですか」と たずねて、「いいえ、すきではありません」と こたえて います。`
- explainFigure: `enText(問い + '  →  ' + こたえ, 'm')`

| # | 場面ID | 場面（prompt に入れる） | 問い | こたえ | 正答 | yes-no の誤り | same-start（③） |
|---|---|---|---|---|---|---|---|
| 1 | zoo | どうぶつえん | Do you like elephants? | Yes, I do. | ぞうが すき | ぞうが すきではない | たまごが すき |
| 2 | fruit-shop | くだものやさん | Do you like peaches? | No, I don't. | ももが すきではない | ももが すき | ぶたが すきではない |
| 3 | lunch | きゅうしょくの 時間《じかん》 | Do you like carrots? | No, I don't. | にんじんが すきではない | にんじんが すき | ねこが すきではない |
| 4 | park | こうえん | Do you like dogs? | Yes, I do. | いぬが すき | いぬが すきではない | あひるが すき |
| 5 | station | えき | Do you like trains? | Yes, I do. | でんしゃが すき | でんしゃが すきではない | かめが すき |
| 6 | birthday | たんじょう日《び》の パーティー | Do you like cake? | Yes, I do. | ケーキが すき | ケーキが すきではない | うしが すき |
| 7 | flower-field | はなばたけ | Do you like flowers? | No, I don't. | はなが すきではない | はなが すき | きつねが すきではない |
| 8 | pond | いけの そば | Do you like frogs? | No, I don't. | かえるが すきではない | かえるが すき | きつねが すきではない |

#### (f) ask の別例（alt, level 2）: 問いだけを聞いて、文の種類を選ぶ — 4問
- id/identity: `ask-q:<slugOf(問い)>`
- prompt: `聞《き》こえた 文《ぶん》は どんな 文《ぶん》？`
- audio: `en('likeq', 問い)`
- hints: ① `はじめの ことばを よく 聞《き》こう。` ② `たずねる 文《ぶん》は、はじめの ことばと、さいごの 音《おと》の 上《あ》がりかたで わかるよ。` ③ `notHint(same-start の label)`
- explain: `「${名前}が すきですか」と たずねる 文《ぶん》です。こたえる ときは「はい」か「いいえ」で いうよ。`

| # | 問い | 正答 | ask-tell の誤り | same-start（③） |
|---|---|---|---|---|
| 1 | Do you like apples? | りんごが すき？と きいた | りんごが すきと いった | ひこうきが すき？と きいた |
| 2 | Do you like cats? | ねこが すき？と きいた | ねこが すきと いった | にんじんが すき？と きいた |
| 3 | Do you like bananas? | バナナが すき？と きいた | バナナが すきと いった | くまが すき？と きいた |
| 4 | Do you like rabbits? | うさぎが すき？と きいた | うさぎが すきと いった | ロケットが すき？と きいた |

### 1.6 量の見込み
| 到達項目 | 練習（異なるキー） | 別例 alt | ≥6・≥3 |
|---|---|---|---|
| like | 16 | 5 | ○ |
| not | 10 | 4 | ○ |
| ask | 8 | 4 | ○ |
異なる問題 47 ÷ M 30 → **Q 1.57 / C 3/3**。誤概念 5。汎用誤答 0%。

### 1.7 テストで確かめること（en-g34.test.ts に足す）
- 既存の全単元の検査（checkUnit・extraChecks・絵・台本・誤概念ID）がこの単元にも通る。`isReady` が true。
- `not:`・`ask:`・`not-mark:` の問題: 音声に `don't`（ask はこたえの `No, I don't.`）が**ある**とき、かつそのときだけ、正答の label が `すきではない` か `×` で終わる。
- `dont-mix`・`yes-no`・`ask-tell` の誤りの label は、正答と同じ物の名前で始まる（物は同じで、すき／すきではない・問い／言明だけが違う）。
- `like:` の各問題で、正答の絵の名前が 0.8 の表の名前と一致する（絵の取り違え防止。単元から `LIKE_WORDS` のような表を export してテストで照合してよい）。

---

## 2. g4.en.want ほしい もの（かいもの）

### 2.1 単元の情報
| 項目 | 値 |
|---|---|
| id | `g4.en.want` |
| title | `ほしい もの（かいもの）` |
| stage | g4 |
| icon | `mode-shopping` |
| prereq | `['g3.en.likes']` |
| 使うエンジン | listen |
| basis | `小学校学習指導要領（平成29年告示）外国語活動 第3・4学年 聞くこと（身近で簡単な事柄に関する基本的な表現の意味が分かる）。言語の使用場面の例「買物」。数（1〜10）は g3.en.numbers-colors で学んだ範囲` |
| gradeIsAppProposal | true |
| 種・量 | 知（場8: 2.5(e) の8場面）。手作り。基準 M=30 |

### 2.2 到達項目
| id | title |
|---|---|
| `want` | `ほしい ものを 聞《き》きとる` |
| `count` | `ほしい かずと ものを 聞《き》きとる` |
| `shop` | `かいものの やりとりが わかる` |

levels: `[{ label: 'ほしい もの' }, { label: 'かずと もの' }, { label: 'かいものの やりとり' }]`。want は level 0、count は level 1、shop は level 2（alt も同じ）。

### 2.3 誤概念
| id | explain |
|---|---|
| `same-start` | `はじめの 音《おと》が にている ことばと おなじだと かんがえたのかな。ことばの さいごまで 聞《き》こう。` |
| `same-group` | `おなじ なかまの たべものなら おなじだと かんがえたのかな。聞《き》こえた ことばの 音《おと》を たしかめよう。` |
| `like-want` | `「すき」と「ほしい」を おなじだと かんがえたのかな。まんなかの ことばが ちがうよ。` |
| `num-sound` | `音《おと》が にている かずと おなじだと かんがえたのかな。かずの ことばを もういちど 聞《き》こう。` |
| `item-mix` | `かずは あって いるね。ものの ことばも おなじだと かんがえたのかな。ほしい ものの ことばを 聞《き》こう。` |
| `swap-count` | `かずと ものの くみあわせを 入《い》れかえて かんがえたのかな。かずの すぐ あとの ことばが、その かずの ものだよ。` |

### 2.4 導入
1. text `ほしい ものを いう 文《ぶん》を 聞《き》いて えらぶよ。` figure `enText('I want two apples.', 'xl')`
2. text `かずの ことばの あとに、ほしい ものが くるよ。これは「りんごが 2こ ほしい」。` figure `{ kind: 'illust', id: 'apple', count: 2 }`
3. text `おみせでは、ほしい ものと かずを たずねられるよ。聞《き》いたら まねして いって みよう（こたえあわせは しないよ）。` figure `enText('What do you want?  →  Apples, please.', 'm')`

### 2.5 問題

#### (a) want（level 0）: 「I want a 〜.」を聞いて絵を選ぶ — 8問
- id/identity: `want:<slugOf(英文)>`
- prompt: `聞《き》こえた 人《ひと》が ほしい ものは どれ？`
- audio: `en('want', 英文)`
- options: 絵（`{ kind: 'illust', id }`、count なし）＋名前
- hints: ① `さいごの ことばが「ほしい もの」だよ。` ② `はじめの 音《おと》が にている もの、おなじ なかまの ものが あるよ。` ③ `notHint(誤り1)`
- explain: `「${名前}が 1つ ほしい」と いって います。`

| # | 英文 | 正答 | 誤り1（③） | 誤り2 |
|---|---|---|---|---|
| 1 | I want a banana. | banana / バナナ | bread / パン・same-start | lemon / レモン・same-group |
| 2 | I want an apple. | apple / りんご | peach / もも・same-group | banana / バナナ・same-group |
| 3 | I want a peach. | peach / もも | green-pepper / ピーマン・same-start | apple / りんご・same-group |
| 4 | I want a lemon. | lemon / レモン | peach / もも・same-group | banana / バナナ・same-group |
| 5 | I want a tomato. | tomato / トマト | eggplant / なす・same-group | carrot / にんじん・same-group |
| 6 | I want a carrot. | carrot / にんじん | cucumber / きゅうり・same-start | p5-cake / ケーキ・same-start |
| 7 | I want a cucumber. | cucumber / きゅうり | carrot / にんじん・same-start | eggplant / なす・same-group |
| 8 | I want an egg. | egg / たまご | eggplant / なす・same-start | onigiri / おにぎり・same-group |

#### (b) want の別例（alt, level 0）: 「すき」と「ほしい」を聞きわける（ことばで選ぶ）— 4問
- id/identity: `want-word:<slugOf(英文)>`
- prompt: `聞《き》こえた 文《ぶん》の いみは どれ？`
- audio: `en('want', 英文)`（(a) と同じキー）
- hints: ① `まんなかの ことばが「すき」か「ほしい」かを 聞《き》こう。` ② `さいごの ことばが「なにが」だよ。` ③ `notHint(same-start の label)`
- explain: `「${名前}が ほしい」と いって います。「すき」と いう ときの ことばとは ちがうね。`

| # | 英文 | 正答 | like-want の誤り | same-start（③） |
|---|---|---|---|---|
| 1 | I want a banana. | バナナが ほしい | バナナが すき | パンが ほしい |
| 2 | I want a carrot. | にんじんが ほしい | にんじんが すき | きゅうりが ほしい |
| 3 | I want an egg. | たまごが ほしい | たまごが すき | なすが ほしい |
| 4 | I want a peach. | ももが ほしい | ももが すき | ピーマンが ほしい |

#### (c) count（level 1）: かずと ものを聞いて、その数の絵を選ぶ — 10問
- id/identity: `count:<slugOf(英文)>`
- prompt: `聞《き》こえた 人《ひと》が ほしい ものは どれ？ かずも 聞《き》こう。`
- audio: `en('want', 英文)`
- options: `{ figure: { kind: 'illust', id, count: n } }`（**label なし**。数えることが学習内容なので名前も数も文字で出さない）、`layout: 'column'`（numbers-colors の `num-pic` と同じ）
- hints: ① `まんなかの かずの ことばを よく 聞《き》こう。` ② `かずの ことばの あとに、ものの ことばが あるよ。` ③ `「${item-mix の物の名前}」の 絵《え》では ないよ。かずを もういちど 聞《き》こう。`
- explain: `「${名前}が ${n}こ ほしい」と いって います。`

| # | 英文 | 正答 | num-sound の誤り | item-mix の誤り（③） |
|---|---|---|---|---|
| 1 | I want two bananas. | banana×2 | banana×3 | lemon×2（レモン） |
| 2 | I want three apples. | apple×3 | apple×2 | peach×3（もも） |
| 3 | I want four tomatoes. | tomato×4 | tomato×5 | eggplant×4（なす） |
| 4 | I want five lemons. | lemon×5 | lemon×4 | banana×5（バナナ） |
| 5 | I want six carrots. | carrot×6 | carrot×7 | cucumber×6（きゅうり） |
| 6 | I want seven strawberries. | strawberry×7 | strawberry×6 | peach×7（もも） |
| 7 | I want eight eggs. | egg×8 | egg×6 | lemon×8（レモン） |
| 8 | I want nine peaches. | peach×9 | peach×5 | apple×9（りんご） |
| 9 | I want ten cucumbers. | cucumber×10 | cucumber×2 | carrot×10（にんじん） |
| 10 | I want two eggplants. | eggplant×2 | eggplant×3 | tomato×2（トマト） |

num-sound の数は numbers-colors の `SAME_START`（2→3, 3→2, 4→5, 5→4, 6→7, 7→6, 8→6, 9→5, 10→2）に合わせてある。

#### (d) count の別例（alt, level 1）: ことばと数字で選ぶ — 4問
- id/identity: `count-word:<slugOf(英文)>`
- prompt: `聞《き》こえた 文《ぶん》に あうのは どれ？`
- audio: `en('want', 英文)`（(c) と同じキーでよい）
- options: label のみ（`<名前> <数字>こ`。数字は半角）
- hints: ① `かずの ことばと、ものの ことばを 聞《き》こう。` ② `かずの すぐ あとの ことばが、ほしい ものだよ。` ③ `notHint(item-mix の label)`
- explain: `「${名前}が ${n}こ ほしい」と いって います。`

| # | 英文 | 正答 | num-sound | item-mix（③） |
|---|---|---|---|---|
| 1 | I want four tomatoes. | トマト 4こ | トマト 5こ | なす 4こ |
| 2 | I want six carrots. | にんじん 6こ | にんじん 7こ | きゅうり 6こ |
| 3 | I want eight eggs. | たまご 8こ | たまご 6こ | レモン 8こ |
| 4 | I want three peaches. | もも 3こ | もも 2こ | りんご 3こ |

（「にんじん 6ぽん」のような数え方の違いは学習内容でないので、全部「こ」でそろえる）

#### (e) shop（level 2）: かいものの やりとり（8場面）— 8問
- id/identity: `shop:<場面ID>`
- prompt: `${場面}で かいものを して いるよ。おきゃくさんが かう ものは どれ？`
- audio: 下の表の順の配列（`en('shop', …)` か `en('want', …)`。`I want 〜.` で始まる文は `want`、それ以外は `shop`）、`gapMs: 800`
- options: 数の絵（label なし。(c) と同じ）、`layout: 'column'`
- hints: ① `おみせの 人《ひと》の しつもんと、おきゃくさんの こたえを 聞《き》こう。` ② `なにが ほしいかと、いくつ ほしいかの 2つを 聞《き》きとろう。` ③ `「${item-mix の物の名前}」の 絵《え》では ないよ。かずを もういちど 聞《き》こう。`
- explain: `おきゃくさんは「${名前}を ${n}こ ください」と いって います。`
- explainFigure: `enText(音声を ' → ' でつないだ文, 'm')`

| # | 場面ID | 場面 | 音声（順に） | 正答 | num-sound | item-mix（③） |
|---|---|---|---|---|---|---|
| 1 | fruit-shop | くだものやさん | What do you want? / Apples, please. / How many? / Six, please. | apple×6 | apple×7 | peach×6（もも） |
| 2 | vegetable-shop | やおやさん | What do you want? / Carrots, please. / How many? / Three, please. | carrot×3 | carrot×2 | cucumber×3（きゅうり） |
| 3 | supermarket | スーパー | How many tomatoes do you want? / Two, please. | tomato×2 | tomato×3 | eggplant×2（なす） |
| 4 | morning-market | あさいち | What do you want? / I want seven bananas. | banana×7 | banana×6 | lemon×7（レモン） |
| 5 | pretend-shop | おみせやさんごっこ | What do you want? / I want ten eggs. | egg×10 | egg×2 | eggplant×10（なす） |
| 6 | fruit-stand | くだものの やたい | How many lemons do you want? / Nine, please. | lemon×9 | lemon×5 | banana×9（バナナ） |
| 7 | station-shop | えきまえの おみせ | What do you want? / Peaches, please. / How many? / Five, please. | peach×5 | peach×4 | apple×5（りんご） |
| 8 | farm-stand | はたけの そばの おみせ | How many cucumbers do you want? / Four, please. | cucumber×4 | cucumber×5 | carrot×4（にんじん） |

#### (f) shop の別例（alt, level 2）: 2しゅるいを たのむ — 4問
- id/identity: `shop-two:<slugOf(英文)>`
- prompt: `おきゃくさんが 2しゅるいの ものを たのんで いるよ。かう ものは どれ？`
- audio: `en('want', 英文)`
- options: `{ figure: { kind: 'row', items: [{ kind: 'illust', id: A, count: a }, { kind: 'illust', id: B, count: b }] } }`（label なし）、`layout: 'column'`
- hints: ① `「と」に あたる ことばの まえと あとで、2つの ものを いって いるよ。` ② `かずの すぐ あとの ことばが、その かずの ものだよ。` ③ `${Aの名前}は ${a}こ だよ。もう 1つの ものを 聞《き》こう。`
- explain: `「${Aの名前}を ${a}こと、${Bの名前}を ${b}こ ほしい」と いって います。`

| # | 英文 | 正答 | swap-count の誤り | item-mix の誤り |
|---|---|---|---|---|
| 1 | I want two apples and three bananas. | apple×2 ＋ banana×3 | apple×3 ＋ banana×2 | apple×2 ＋ lemon×3 |
| 2 | I want four tomatoes and two carrots. | tomato×4 ＋ carrot×2 | tomato×2 ＋ carrot×4 | tomato×4 ＋ eggplant×2 |
| 3 | I want five eggs and one lemon. | egg×5 ＋ lemon×1 | egg×1 ＋ lemon×5 | egg×5 ＋ banana×1 |
| 4 | I want three peaches and six strawberries. | peach×3 ＋ strawberry×6 | peach×6 ＋ strawberry×3 | peach×3 ＋ apple×6 |

（③で「Aは a こ」と言うと swap-count が消え、正答と item-mix の2つが残る）

### 2.6 量の見込み
| 到達項目 | 練習 | 別例 alt |
|---|---|---|
| want | 8 | 4 |
| count | 10 | 4 |
| shop | 8 | 4 |
異なる問題 38 ÷ 30 → **Q 1.27 / C 3/3**。誤概念 6。汎用誤答 0%。

### 2.7 テストで確かめること
- 既存の全単元の検査が通る。`isReady` が true。
- `count:`・`count-word:`・`shop:`・`shop-two:` で、英文の数の語（one〜ten。`a`/`an` は 1）と、正答の絵の count（label の数字）が一致する。
- `num-sound` の誤りは 正答と同じ絵で数だけ違い、その数は `SAME_START`（numbers-colors.ts を同じパックの中から import してよい。export されていなければ export を足す）の組に入っている。
- `item-mix` の誤りは 正答と同じ数で絵だけ違う。`swap-count` は2つの数が入れかわっている。
- 赤い物（apple・strawberry・tomato）と緑の物（cucumber・green-pepper）が同じ問題の選択肢に並ばない。

---

## 3. g4.en.directions 道《みち》あんない

### 3.1 単元の情報
| 項目 | 値 |
|---|---|
| id | `g4.en.directions` |
| title | `道《みち》あんない` |
| stage | g4 |
| icon | `mode-road` |
| prereq | `['g4.en.time-days']` |
| 使うエンジン | listen（地図は `figure: { kind: 'svg' }`）。**matrix の「listen, map」から変える**（3.9） |
| basis | `小学校学習指導要領（平成29年告示）外国語活動 第3・4学年 聞くこと（身近で簡単な事柄に関する基本的な表現の意味が分かる）。言語の使用場面の例「道案内」` |
| gradeIsAppProposal | true |
| 種・量 | 知（場8 相当: 場所の語7・指示の語6・道順8・地図の場面6）。手作り。基準 M=30 |

### 3.2 到達項目
| id | title |
|---|---|
| `place` | `場所《ばしょ》の ことばが わかる` |
| `move` | `道《みち》あんないの ことばが わかる` |
| `route` | `つづけて いう 道《みち》じゅんが わかる` |
| `goal` | `道《みち》あんないを 聞《き》いて 地図《ちず》で 場所《ばしょ》を 見《み》つける` |

levels: `[{ label: '場所《ばしょ》と 道《みち》の ことば' }, { label: '道《みち》じゅん' }, { label: '地図《ちず》で さがす' }]`。
place・move は level 0、route は level 1、goal は level 2（alt も同じ）。

### 3.3 このアプリの道あんないの決まり（導入と解説で示す。図もこの決まりで描く）
- ▲ が スタート。とがった ほうを むいて いる。
- 「Go straight.」= 1区画（つぎの かどまで）まっすぐ すすむ。
- 「Turn right. / Turn left.」= あるく 人《ひと》から 見た 右・左に 曲がって、1区画 すすむ。
- 「It's on your right. / left.」= **さいごに あるいた 道**の、あるく 人から 見た 右がわ・左がわ。
- 「Stop.」= とまる。

### 3.4 誤概念
| id | explain |
|---|---|
| `place-word` | `ほかの 場所《ばしょ》の ことばと おなじだと かんがえたのかな。さいごの ことばを もういちど 聞《き》こう。` |
| `part-word` | `ことばの 一部《いちぶ》が おなじなら おなじ 場所《ばしょ》だと かんがえたのかな。ことばの はじめから おわりまで 聞《き》こう。` |
| `same-start` | `はじめの 音《おと》が にている ことばと おなじだと かんがえたのかな。ことばの さいごまで 聞《き》こう。` |
| `lr-swap` | `右《みぎ》と 左《ひだり》を 反対《はんたい》に かんがえたのかな。右《みぎ》と 左《ひだり》の ことばを もういちど 聞《き》こう。` |
| `turn-side` | `「曲《ま》がる」と「〜がわに ある」を おなじだと かんがえたのかな。はじめの ことばで、曲《ま》がるのか、場所《ばしょ》を いって いるのかが わかるよ。` |
| `stop-go` | `「とまる」と「すすむ」を おなじだと かんがえたのかな。みじかい ことばか、2つの ことばかを 聞《き》こう。` |
| `turn-missed` | `曲《ま》がる ことばが あったか なかったかを とりちがえたのかな。ことばを 1つずつ かぞえて 聞《き》こう。` |
| `order-swap` | `ことばの じゅんばんを 入《い》れかえて かんがえたのかな。聞《き》こえた じゅんに すすもう。` |
| `step-missed` | `とちゅうの ことばを 聞《き》きのがしたのかな。ことばは いくつ あったかな。` |
| `side-lr` | `道《みち》の 右《みぎ》がわと 左《ひだり》がわを 反対《はんたい》に かんがえたのかな。さいごに あるいた むきで、右《みぎ》・左《ひだり》を きめよう。` |
| `screen-view` | `画面《がめん》の 右《みぎ》・左《ひだり》で かんがえたのかな。あるく 人《ひと》が むいて いる ほうで、右《みぎ》・左《ひだり》を きめよう。` |

### 3.5 導入
1. text `道《みち》あんないの ことばを 聞《き》いて、すすむ 道《みち》を えらぶよ。` figure `enText('Go straight.', 'xl')`
2. text `▲が スタート。とがった ほうを むいて いるよ。曲《ま》がったら、つぎの かどまで すすむよ。` figure `routeSvg(['S', 'R'])`（3.6）
3. text `「〜がわに ある」は、さいごに あるいた 道《みち》の、あるく 人《ひと》から 見《み》た 右《みぎ》・左《ひだり》だよ。` figure `moveSvg('on-right')`（3.6）

### 3.6 図（`figure: { kind: 'svg', markup, label }`）
共通: `<svg viewBox="…" xmlns="http://www.w3.org/2000/svg">`。色は CSS 変数だけ（`var(--paper-2)`・`var(--white)`・`var(--ink)`・`var(--sky-dark)`・`var(--sun)`）。赤（berry）と緑（leaf）は使わない。`<image>`・`href`・`on*` は使わない（qa の検査）。文字は `<text>`（font-weight 700、fill `var(--ink)`）。

**(1) moveSvg(kind)** — 1つの指示の絵。viewBox `0 0 120 120`。
- 地: `rect 0,0,120,120 rx 12 fill var(--paper-2)`。道（十字）: `rect x45 y0 w30 h120` と `rect x0 y35 w120 h30`、fill `var(--white)`。
- スタート ▲: `polygon 60,96 51,114 69,114`、fill `var(--sun)`、stroke `var(--ink)` 2.5。
- 矢印: 線 stroke `var(--sky-dark)` 幅 7、round。矢じりは同じ色の三角。
  - `straight`: 線 60,94 → 60,16、矢じり `60,4 51,18 69,18`
  - `right`: 線 60,94 → 60,50 → 102,50、矢じり `116,50 102,41 102,59`
  - `left`: 線 60,94 → 60,50 → 18,50、矢じり `4,50 18,41 18,59`
  - `stop`: 線 60,94 → 60,66、とまる線 `line 40,58 → 80,58` stroke `var(--ink)` 幅 8
  - `on-right`: straight の矢印 ＋ 建物 `rect x82 y72 w30 h30 rx 4 fill var(--sun) stroke var(--ink) 3`
  - `on-left`: straight の矢印 ＋ 建物 `rect x8 y72 w30 h30 …`（同じ）
- label（aria）: straight `まっすぐ すすむ やじるし`／right `右《みぎ》に 曲《ま》がる やじるし`／left `左《ひだり》に 曲《ま》がる やじるし`／stop `とまる しるし`／on-right `右《みぎ》がわに ある たてもの`／on-left `左《ひだり》がわに ある たてもの`

**(2) routeSvg(steps)** — 道順の絵。steps は `'S' | 'R' | 'L'` の配列。viewBox `0 0 240 190`。
- 地 `rect 0,0,240,190 fill var(--paper-2)`。道: 交点 (i, j)（i=0..4, j=0..3）の座標は `x = 20 + 50i`, `y = 20 + 50j`。縦の道 i=0..4（y 20→170）、横の道 j=0..3（x 20→220）を `line` stroke `var(--white)` 幅 14 round。
- 歩き方: スタート (2, 3)、向き 上。S=向きそのまま、R=時計回りに90度、L=反時計回りに90度回ってから 1区画すすむ。
- 道順: スタートから通る交点を結ぶ `polyline` stroke `var(--sky-dark)` 幅 7 round、fill none。終わりに最後の区画の向きの矢じり（大きさ 14 程度）。
- スタート ▲（上向き）を (120, 170) に最後に描く: `polygon 120,158 111,176 129,176` fill `var(--sun)` stroke `var(--ink)` 2.5。
- label: `道《みち》じゅんの 図《ず》`（どの絵も同じ。正答を aria で言わない）。
- このパックで使う steps は全部、交点 0..4 × 0..3 の中に収まる（テストで確かめる）。

**(3) townSvg(places, opts)** — 地図（T字路）。viewBox `0 0 320 340`。
- 地 `rect 0,0,320,340 fill var(--paper-2)`。
- 道（ふつうの向き）: 横 `rect x0 y60 w320 h50`、縦 `rect x135 y60 w50 h280`。fill `var(--white)`。
- 場所（位置コード → 四角の中心。四角は 44×44、rx 6、fill `var(--sun)`、stroke `var(--ink)` 3、中央に文字 A〜D を font-size 26、text-anchor middle、dominant-baseline central）:

| コード | 意味（ふつうの向きで） | 中心 |
|---|---|---|
| `WN` | 左の道の上がわ | (40, 30) |
| `WS` | 左の道の下がわ | (40, 140) |
| `EN` | 右の道の上がわ | (280, 30) |
| `ES` | 右の道の下がわ | (280, 140) |
| `SW` | スタートの道の左がわ | (105, 220) |
| `SE` | スタートの道の右がわ | (215, 220) |

- スタート ▲（上向き）を (160, 305) 中心: `polygon 160,290 148,316 172,316`、fill `var(--sky-dark)`、stroke `var(--ink)` 2.5。その右に `<text x="180" y="308" font-size="16">スタート</text>`（text-anchor start）。
- **逆さの地図**（`opts.turned: true`。goal の別例）: 道・場所・▲の座標を全部 `(x, y) → (320 − x, 340 − y)` に移す（▲は下向きになる）。**文字（A〜D・スタート）は回さない**（正立のまま、移した中心に置く）。「スタート」の文字は ▲ の右（▲の中心 x ＋ 20、text-anchor start）。
- 道順の線（`opts.route`。解説の図だけ）: スタート (160, 300) → かど (160, 85) → 曲がった先 (40, 85) か (280, 85)。曲がらない問題（SW・SE）は (160, 300) → (160, 220)。`polyline` stroke `var(--sky-dark)` 幅 6、`stroke-dasharray="10 8"`、終わりに矢じり。逆さの地図では同じ変換をする。
- 文字 A〜D の割り当て: その問題の4つの場所を、**画面での中心の y の小さい順、同じ y なら x の小さい順**に A・B・C・D（逆さの地図では変換後の座標で並べる）。
- label: `道《みち》の 地図《ちず》。スタートの しるしと、4つの 場所《ばしょ》が ある`

### 3.7 問題

#### (a) place（level 0）: 「Where is the 〜?」を聞いて、場所の絵を選ぶ — 7問
- id/identity: `place:<slugOf(英文)>`
- prompt: `たずねて いる 場所《ばしょ》は どれ？`
- audio: `en('place', 英文)`
- options: 絵＋名前
- hints: ① `さいごの ことばが 場所《ばしょ》の なまえだよ。` ② `ことばの はじめから おわりまで 聞《き》こう。にている ことばが あるよ。` ③ `notHint(誤り1)`
- explain: `「${名前}は どこですか」と たずねて います。`

| # | 英文 | 正答 | 誤り1（③） | 誤り2 |
|---|---|---|---|---|
| 1 | Where is the station? | life-station / えき | life-library / としょかん・place-word | life-firestation / しょうぼうしょ・part-word |
| 2 | Where is the fire station? | life-firestation / しょうぼうしょ | life-flowershop / おはなやさん・same-start | life-station / えき・part-word |
| 3 | Where is the hospital? | life-hospital / びょういん | life-police / こうばん・place-word | life-library / としょかん・place-word |
| 4 | Where is the library? | life-library / としょかん | life-hospital / びょういん・place-word | life-bakery / パンやさん・place-word |
| 5 | Where is the police box? | life-police / こうばん | life-firestation / しょうぼうしょ・place-word | life-hospital / びょういん・place-word |
| 6 | Where is the bakery? | life-bakery / パンやさん | life-flowershop / おはなやさん・place-word | life-library / としょかん・place-word |
| 7 | Where is the flower shop? | life-flowershop / おはなやさん | life-firestation / しょうぼうしょ・same-start | life-vegeshop / やおやさん・part-word |

#### (b) place の別例（alt, level 0）: 「Let's go to the 〜.」を聞いて、ことばで選ぶ — 4問
- id/identity: `place-go:<slugOf(英文)>`
- prompt: `いっしょに いこうと さそって いるよ。いく 場所《ばしょ》は どれ？`
- audio: `en('place', 英文)`
- options: label のみ
- hints: ① `さいごの ことばが いく 場所《ばしょ》だよ。` ② `ことばの はじめから おわりまで 聞《き》こう。` ③ `notHint(誤り1)`
- explain: `「${名前}へ いこう」と いって います。`

| # | 英文 | 正答 | 誤り1（③） | 誤り2 |
|---|---|---|---|---|
| 1 | Let's go to the library. | としょかん | びょういん・place-word | パンやさん・place-word |
| 2 | Let's go to the hospital. | びょういん | こうばん・place-word | としょかん・place-word |
| 3 | Let's go to the station. | えき | こうばん・place-word | しょうぼうしょ・part-word |
| 4 | Let's go to the flower shop. | おはなやさん | しょうぼうしょ・same-start | やおやさん・part-word |

#### (c) move（level 0）: 1つの指示を聞いて、矢印の絵を選ぶ — 6問
- id/identity: `move:<slugOf(英文)>`
- prompt: `聞《き》こえた 道《みち》あんないに あう 絵《え》は どれ？`
- audio: `en('dir', 英文)`
- options: `{ figure: moveSvg(kind) }`（label なし）
- hints: ① `あるく 人《ひと》に なった つもりで 聞《き》こう。` ② `はじめの ほうの ことばで「なにを するか」、さいごの ことばで「むき」が わかるよ。` ③ 表の文
- explain: 表の文。explainFigure `enText(英文)`

| # | 英文 | 正答 | 誤り | 誤り | ③ | explain |
|---|---|---|---|---|---|---|
| 1 | Go straight. | straight | stop・stop-go | right・turn-missed | `曲《ま》がる ことばは 聞《き》こえなかったね。ことばが 1つか 2つかを 聞《き》きわけよう。`（③に選択肢の label「とまる」「まっすぐ すすむ」をそのまま書かない。既存テスト「ヒント③が 正答の 選択肢を そのまま いわない」） | `まっすぐ すすむ ことです。` |
| 2 | Turn right. | right | left・lr-swap | on-right・turn-side | `曲《ま》がる ことばだよ。右《みぎ》か 左《ひだり》かを 聞《き》きわけよう。` | `右《みぎ》に 曲《ま》がる ことです。` |
| 3 | Turn left. | left | right・lr-swap | on-left・turn-side | （2と同じ） | `左《ひだり》に 曲《ま》がる ことです。` |
| 4 | Stop. | stop | straight・stop-go | left・turn-missed | （1と同じ） | `とまる ことです。` |
| 5 | It's on your right. | on-right | on-left・lr-swap | right・turn-side | `場所《ばしょ》が どちらがわに あるかを いう ことばだよ。右《みぎ》か 左《ひだり》かを 聞《き》きわけよう。` | `右《みぎ》がわに ある ことです。` |
| 6 | It's on your left. | on-left | on-right・lr-swap | left・turn-side | （5と同じ） | `左《ひだり》がわに ある ことです。` |

#### (d) move の別例（alt, level 0）: ことばで選ぶ — 6問
- id/identity: `move-word:<slugOf(英文)>`。audio・誤概念・③・explain は (c) と同じ。
- prompt: `聞《き》こえた 道《みち》あんないの いみは どれ？`
- options: label のみ。kind → label: straight `まっすぐ すすむ`／right `右《みぎ》に 曲《ま》がる`／left `左《ひだり》に 曲《ま》がる`／stop `とまる`／on-right `右《みぎ》がわに ある`／on-left `左《ひだり》がわに ある`
- 正答・誤りの組は (c) の表と同じ（6問とも）。

#### (e) route（level 1）: 2〜3つの指示を聞いて、道順の絵を選ぶ — 8問
- id/identity: `route:<steps を連結した文字列>`（例 `route:SR`）
- prompt: `道《みち》あんないを さいごまで 聞《き》こう。すすむ 道《みち》じゅんは どれ？`
- audio: steps の順に `en('dir', …)`（S=`Go straight.`、R=`Turn right.`、L=`Turn left.`）、`gapMs: 600`
- options: `{ figure: routeSvg(steps) }`（label なし）
- hints: ① `▲から、あるく 人《ひと》に なった つもりで すすもう。` ② `曲《ま》がる ときは、あるく 人《ひと》から 見《み》た 右《みぎ》・左《ひだり》だよ。ことばは いくつ あったかな。` ③ 表の文（正答と誤り1つが残る）
- explain: `「${steps を日本語で '、' でつなぐ}」の じゅんに すすみます。`（S=`まっすぐ`、R=`右《みぎ》に 曲《ま》がる`、L=`左《ひだり》に 曲《ま》がる`）
- explainFigure: `enText(英文を ' ' でつなぐ, 'm')`

| # | 正答 steps | lr-swap の誤り | もう1つの誤り | ③ |
|---|---|---|---|---|
| 1 | S R | S L | R S・order-swap | `1つめは「まっすぐ」だよ。` |
| 2 | S L | S R | L S・order-swap | `1つめは「まっすぐ」だよ。` |
| 3 | R L | L R | R・step-missed | `1つめは「右《みぎ》に 曲《ま》がる」だよ。` |
| 4 | L R | R L | L・step-missed | `1つめは「左《ひだり》に 曲《ま》がる」だよ。` |
| 5 | R S | L S | S R・order-swap | `2つめは「まっすぐ」だよ。` |
| 6 | L S | R S | S L・order-swap | `2つめは「まっすぐ」だよ。` |
| 7 | S R L | S L R | S R・step-missed | `2つめは「右《みぎ》に 曲《ま》がる」だよ。` |
| 8 | S L R | S R L | S L・step-missed | `2つめは「左《ひだり》に 曲《ま》がる」だよ。` |

（7・8 は3つの指示。level 1 のままでよい）

#### (f) route の別例（alt, level 1）: ことばの順で選ぶ — 4問
- id/identity: `route-word:<steps>`。audio・誤概念・explain は (e) の同じ steps と同じ。
- prompt: `聞《き》こえた 道《みち》じゅんは どれ？`
- options: label のみ。steps を `まっすぐ`・`右《みぎ》`・`左《ひだり》` に置きかえ、`' → '` でつなぐ（例 `まっすぐ → 右《みぎ》`）
- hints: ①② は (e) と同じ。③ `notHint(lr-swap の label)`

| # | 正答 | lr-swap（③） | もう1つ |
|---|---|---|---|
| 1 | まっすぐ → 右 | まっすぐ → 左 | 右 → まっすぐ・order-swap |
| 2 | 左 → 右 | 右 → 左 | 左・step-missed |
| 3 | 右 → まっすぐ | 左 → まっすぐ | まっすぐ → 右・order-swap |
| 4 | まっすぐ → 左 → 右 | まっすぐ → 右 → 左 | まっすぐ → 左・step-missed |

（右・左は label では `右《みぎ》`・`左《ひだり》`）

#### (g) goal（level 2）: 地図で、つく 場所を選ぶ（ふつうの向き）— 6問
- id/identity: `goal:<コード>`
- prompt: `道《みち》あんないを 聞《き》こう。つく 場所《ばしょ》は 地図《ちず》の どれ？`
- figure: `townSvg(4つの場所)`（item の `figure`。0.4）
- audio: 指示を順に `en('dir', …)`、`gapMs: 600`
- options: label `A`・`B`・`C`・`D`（`fixedOrder: true`、`layout: 'row'`）。各 label の場所の誤概念は表のとおり
- hints:
  ① `▲の むきに あるく 人《ひと》に なって かんがえよう。`
  ② 曲がらない問題（1・2）: `ことばは 2つ。曲《ま》がる ことばは あったかな。`／曲がる問題（3〜6）: `まっすぐ すすむと かどに つくよ。そこで 曲《ま》がる むきを 聞《き》こう。`
  ③ 曲がらない問題: `あとは、道《みち》の 右《みぎ》がわか 左《ひだり》がわかを 聞《き》きわけよう。`／曲がる問題: `かどで ${右《みぎ》|左《ひだり》}に 曲《ま》がるよ。さいごの ことばで、道《みち》の どちらがわかを きめよう。`
- explain: 曲がらない: `まっすぐ すすむと、${右《みぎ》|左《ひだり》}がわに ある 場所《ばしょ》です。`／曲がる: `まっすぐ すすんで、かどを ${右|左}に 曲《ま》がると、${右|左}がわに ある 場所《ばしょ》です。`（右左は《よみ》付き）
- explainFigure: `townSvg(同じ4つの場所, { route: 正答 })`

| # | コード | 音声（dir の順） | 正答の位置 | 誤り（位置・誤概念） | 文字（A〜D の順） | 正答の文字 |
|---|---|---|---|---|---|---|
| 1 | s-right | Go straight. / It's on your right. | SE | SW・side-lr、ES・turn-missed、WN・turn-missed | WN, ES, SW, SE | D |
| 2 | s-left | Go straight. / It's on your left. | SW | SE・side-lr、WS・turn-missed、EN・turn-missed | EN, WS, SW, SE | C |
| 3 | sr-right | Go straight. / Turn right. / It's on your right. | ES | EN・side-lr、WN・lr-swap、SE・turn-missed | WN, EN, ES, SE | C |
| 4 | sr-left | Go straight. / Turn right. / It's on your left. | EN | ES・side-lr、WS・lr-swap、SW・turn-missed | EN, WS, ES, SW | A |
| 5 | sl-right | Go straight. / Turn left. / It's on your right. | WN | WS・side-lr、ES・lr-swap、SE・turn-missed | WN, WS, ES, SE | A |
| 6 | sl-left | Go straight. / Turn left. / It's on your left. | WS | WN・side-lr、EN・lr-swap、SW・turn-missed | WN, EN, WS, SW | C |

位置の決め方（テストで同じ計算をする）: 曲がらない → スタートの道（右がわ SE／左がわ SW）。右に曲がる → 右の道（東向きに歩くので 右がわ=ES／左がわ=EN）。左に曲がる → 左の道（西向き: 右がわ=WN／左がわ=WS）。

#### (h) goal の別例（alt, level 2）: 逆さの地図（スタートが上で 下向き）— 4問
- id/identity: `goal-turn:<コード>`
- prompt: `こんどは ▲が 下《した》を むいて いるよ。つく 場所《ばしょ》は 地図《ちず》の どれ？`（▲ は記号で英字ではない）
- figure: `townSvg(4つの場所, { turned: true })`、explainFigure は `{ turned: true, route: 正答 }`
- audio・explain は (g) の同じコードと同じ。
- hints: ① `スタートの ▲は 下《した》を むいて いるよ。あるく 人《ひと》に なった つもりで かんがえよう。` ② `下《した》を むいて あるくと、あるく 人《ひと》の 右《みぎ》は 画面《がめん》の 左《ひだり》に なるよ。` ③ (g) の曲がる問題の ③ と同じ
- 誤概念: (g) で lr-swap だった誤りは、ここでは **screen-view**（画面の右左で考えた誤り）にする。

| # | コード | 正答の位置 | 誤り（位置・誤概念） | 文字（A〜D の順。逆さの座標で並べた結果） | 正答の文字 |
|---|---|---|---|---|---|
| 1 | sr-right | ES | EN・side-lr、WN・screen-view、SE・turn-missed | SE, ES, EN, WN | B |
| 2 | sr-left | EN | ES・side-lr、WS・screen-view、SW・turn-missed | SW, ES, WS, EN | D |
| 3 | sl-right | WN | WS・side-lr、ES・screen-view、SE・turn-missed | SE, ES, WS, WN | D |
| 4 | sl-left | WS | WN・side-lr、EN・screen-view、SW・turn-missed | SW, WS, EN, WN | B |

（逆さにしたときの中心: WN→(280,310)、EN→(40,310)、WS→(280,200)、ES→(40,200)、SW→(215,120)、SE→(105,120)）

### 3.8 量の見込み
| 到達項目 | 練習 | 別例 alt |
|---|---|---|
| place | 7 | 4 |
| move | 6 | 6 |
| route | 8 | 4 |
| goal | 6 | 4 |
異なる問題 45 ÷ 30 → **Q 1.50 / C 4/4**。誤概念 11。汎用誤答 0%。

### 3.9 matrix と違う判断（報告に書く）
- matrix のエンジン欄は「listen, map」。map の `town`（絵地図）は **音声を鳴らせず**、方位（北・南）で答える形で、あるく人から見た右・左や道順を扱えない。そこで listen に地図の図（svg）を付けて作る。将来 map に「音声つき・道順」の形ができたら移す（エンジンへの要望）。
- 地図の場所は絵（life-*）を地図の中に置けない（svg 図の中に `<image>` を使えない）ので、文字 A〜D の四角で示す。場所の名前の聞き取りは place（絵）で別に扱う。

### 3.10 テストで確かめること
- 既存の全単元の検査が通る。`isReady` が true。
- 道順のシミュレーター（テストの中に書くか、directions.ts から `walk(steps)` を export）: スタート (2,3)・上向きから steps を歩いた交点の列が、交点 0..4 × 0..3 の中に収まる。route の各問題で、音声の英文から読み取った steps が正答の steps と一致し、3つの選択肢の道順（交点の列）がたがいに違う。
- 地図: goal・goal-turn の各問題で、音声の指示から 3.7(g) の決め方で求めた位置が正答の位置と一致する。4つの場所が重ならない。文字の割り当て（画面の y・x の順）で、正答の文字が表（D, C, C, A, A, C／B, D, D, B）と一致する。
- 誤概念の付け方: 同じ道の反対がわ → side-lr、反対の道 → lr-swap（goal-turn では screen-view）、曲がる・曲がらないが違う → turn-missed（全部の誤りでこの規則どおり）。
- svg の markup に `<image`・`href`・`on…=` が無い（qa の検査が見る）。`var(--berry)`・`var(--leaf)` を使っていない。

---

## 4. 実装の順と確認のコマンド
1. lib.ts に `figure` を足す（0.4）。
2. likes.ts → want.ts → directions.ts を書き、index.ts に足す。
3. en-g34.test.ts に 1.7・2.7・3.10 を足す。
4. script-en.json を作り直す（0.6）。
5. PowerShell で（各コマンドの前に PATH の設定。pack-brief のとおり）:
```
npx vitest run src/packs/en-g34
npx tsc -b
npx eslint src/packs/en-g34
npx prettier --check src/packs/en-g34
npm run build:unit-index
npm run check:design
```
6. 報告: 単元ごとに Q・C・問題数・誤概念の数・汎用誤答の割合（テストの console.info の値）、3.9 の判断、未確認のこと。

## 5. 内容の確認（設計で確かめたこと・残ること）
- 英文はすべて小学校の外国語活動で扱う基本的な表現（I like / I don't like / Do you like 〜? Yes, I do. No, I don't. / What do you like? / I want 〜. / What do you want? / How many? / 〜, please. / Where is the 〜? / Go straight. / Turn right. / Turn left. / Stop. / It's on your right. / Let's go to the 〜.）。文法・つづり（strawberries・peaches・tomatoes・an apple・an egg）を確かめた。
- 「police box」は交番の英語として使われる語。「fire station」「flower shop」「bakery」「library」「hospital」「station」は一般的な語。
- 数の語は 1〜10（g3.en.numbers-colors の範囲）だけ。
- 人名・商品名・実在の店名は出さない。問題・文・図はこの単元のために作ったもの。
- **要確認（統括へ）**: basis の「言語の使用場面の例『買物』『道案内』」は外国語活動の内容の取扱いの例示を記憶で書いた（文言は指導要領で確認してほしい）。会話の2人を同じ声で読むと区別しにくいので、台本から音声を作るときに声を分けられるなら分けてほしい（`What do you want?` などの店の人の文と、おきゃくさんの文）。
