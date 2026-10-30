# 幼児向けの英語（えいご あそび）設計書（docs/expansion/p2-design/preschool-english.md）

版 0.2（2026-10-31） / 責任: 設計担当（統括の代理、Opus） / 宛先: 統括、実装担当（Sonnet）
版 0.2 の変更: (1) P1 の p4.en.move（到達項目 touch の異なる問題が5）と p4.en.hello（greet 5・feel 4）が P1 の基準（到達項目ごとに練習6以上・別例3以上）に届くよう、語と問題を足した（5.5・5.6・6.4・6.8）。(2) P2 の5単元（p23.en.move・p4.en.where・p5.en.picture-book・p5.en.first-sound・p5.en.abc）を実装できる具体さで書いた（5.2・5.8・5.11〜5.13）。(3) 英語の文を見直した（7.6）。(4) curriculum-matrix.md との整合を確かめ、直す行と統括の判断が要る点をまとめた（10.5・13章）。
根拠: docs/expansion/research/preschool-english.md（以下「調査」。節番号を〔調査 2-5〕のように書く）
正本との関係: 見た目は DESINGN.md、区分ごとの出し分けは ux-by-age.md、単元は curriculum-matrix.md が正本。本書は「幼児の英語」を足すための変更案で、採用したら 10章のとおり正本を直す。

---

## 0. 要約

- 2〜3歳・4歳・5歳に「えいご」の遊びを足す。目標は**英語の音に親しむ・日本語との音の違いに気づく・ちがう ことばに興味を持つ**こと。英語力の習得はうたわない〔調査 2-1〕。
- 主力は「**英語を2回聞く → 聞いた語の絵を1つ触る → 触った物の英語の名前が返ってくる**」（随伴的なタッチ＋名前を返すフィードバック〔調査 2-2・2-3・2-5〕）。ほかに、からだを動かす（TPR）、オリジナルの短い絵本のくり返し、あいさつ、5歳の おみせやさん ごっこ。
- **画面の文字は日本語（ひらがな）だけ。英語は音声だけ**。幼児区分の「英語なし」の規則（DESINGN 4章）は崩さない。例外は 5歳の「ABC」単元（P2、保護者が開いたときだけ）の大文字だけ。
- 新しいパック **en-pre**（コア同梱。既存の p23 / p4 / p5 パックには触らない）。単元は P1 が8、P2 が5。
- エンジンは既存の **listen を小さく拡張**する（名前を返す・聞き直し・答えの後の音声）。新しいエンジンは作らない。
- ホームの入口は、幼児ホームの右の列の一番下の札を「えいご」にし、「ほかの がくねん」を上の帯へ移す。**2歳段階のホームには出さない**（札4枚の決まりを守る）。
- 英語の音声は Kokoro（af_heart）で事前生成。単語1語が苦手なので、**大文字＋句点の書き方・同じ語を2回・キャリア文・文字の名前は IPA で固定・全件試聴**で品質を確かめる。

---

## 1. 方針（調査から決めたこと）

| # | 方針 | 根拠 |
|---|---|---|
| 1 | 目標は「親しむ・気づく・興味」。保護者向けの説明で「英語ができるようになる」「早く始めるほど良い」と書かない | 調査 1.5・1.7・2-1 |
| 2 | 操作は「聞いた語の絵を触ったときだけ答えになる」随伴的なタッチ。どこを触っても進む画面を作らない | 調査 1.1（Kirkorian 2016） |
| 3 | 最初に同じ語を2回聞かせ、聞き終わるまで選べない（listen の既存の規則） | 調査 1.1（PLoS One 2020） |
| 4 | 選択肢は 2歳段階2・3歳段階2〜3・4歳3〜4・5歳4（ux-by-age の上限の範囲内） | 調査 2-4、ux-by-age 1章 |
| 5 | 触った物の英語の名前を必ず返す（正解でも不正解でも）。不正解の効果音を鳴らさない。不正解のあと目当ての語をもう一度聞かせる | 調査 1.2（Harvard・UCI）、2-5 |
| 6 | 同じ骨格のくり返し。語は少数を複数の遊びで何度も出す。オリジナルの短い絵本は同じ形で何度も | 調査 1.3（Horst 2011）、2-6 |
| 7 | からだを動かす遊び（TPR）は「聞いて動きの絵を選ぶ → 親子で体を動かす」。体の動きは判定しない | 調査 1.3、2-7 |
| 8 | 親子で使う前提の声かけ（「おうちの ひとと いっしょに」）と保護者画面の遊び方の説明 | 調査 1.2（JME）、2-8 |
| 9 | 1回は既存の量（2〜3歳3問、4歳4問、5歳5問）。英語を「きょうの おすすめ」に出さない（日本語の遊びを押しのけない） | 調査 1.6、2-9・2-10 |
| 10 | 指示・ヒント・解説は日本語（ひらがな）。英語は音声だけ。日本語の訳は答えた後の解説で出す | 調査 2-10、DESINGN 4章 |
| 11 | 文字は出さない。例外は5歳の ABC（P2・既定で非表示）の大文字と文字の名前だけ。フォニックス・書く練習はしない | 調査 1.7、2-11 |
| 12 | 歌は入れない（著作権のある童謡を使わない。合成音声は歌えない）。チャンツは試聴で判断する将来の候補 | 調査 2-13 |
| 13 | マイクを使わない。発音の評価・録音をしない | 制約、調査 2-14 |

---

## 2. 単元の一覧

単元IDは `{段階}.en.{名前}`（curriculum-matrix 0.5 の形。router の UNIT_ID の正規表現にそのまま合う）。教科 `en` を幼児の段階でも使う（3章）。
種別はすべて **遊**（curriculum-matrix 1.3: 段階ごとに異なる問題 12 以上、2歳段階の段階0は 8 以上、定義域が小さければ全件）。復習は幼児なので **−**（間隔反復しない。curriculum-matrix 1.6）。

| ID | 札の名前（ひらがな） | 段階0 → 段階1 → 段階2 | 優 | 年齢の札 |
|---|---|---|---|---|
| p23.en.words | えいごで タッチ | L2: どうぶつ・たべもの 2択 → L3: のりもの・もの を足して 3択 | **P1** | 2〜3歳 |
| p23.en.move | うごいて みよう | 動き 2択 → 動き・からだを さわる 3択 | P2 | 2〜3歳 |
| p4.en.words | えいごで タッチ | 1語を2回・3択 → 「Where is the 〜?」3択 → いろいろな なかま 4択 | **P1** | 4歳 |
| p4.en.colors-numbers | いろと かず | いろ 3択 → かず 1〜5 3択 → まぜて 4択 | **P1** | 4歳 |
| p4.en.move | うごいて みよう | からだ全体の動き 3択 → からだを さわる 3択 → まぜて 4択 | **P1** | 4歳・5歳 |
| p4.en.hello | あいさつ | あいさつ 3択 → きもち 3択 → まぜて 4択 | **P1** | 4歳・5歳 |
| p4.en.picture-book | えいごの えほん | お話の後に聞こえた ページ 2択 → 3択 → さいしょの ページ 3択（絵の帯なし） | **P1** | 4歳・5歳 |
| p4.en.where | かくれんぼ | in / on / under 3択 → だれが どこ 4択（4歳の選択肢は3〜4のため、0.1 の「2択 → 3択」を改めた） | P2 | 4歳 |
| p5.en.phrases | かずと いろと もの | 1語 4択 → かず＋もの（three apples）4択 → かず＋いろ＋ボール 4択 | **P1** | 5歳 |
| p5.en.shop | おみせやさん | 「An apple, please.」4択 → 「Two bananas, please.」4択 → まぜて 4択 | **P1** | 5歳 |
| p5.en.picture-book | えいごの えほん（ながい） | 1ページを聞いて 4択 → 6ページのお話の後に聞こえた ページ 4択 → さいしょ・さいご 4択 | P2 | 5歳 |
| p5.en.first-sound | おなじ おと | なまえを聞いて比べる 3択 → なまえを思い出して 3択（聞くだけ中心） | P2 | 5歳 |
| p5.en.abc | えいごの もじ（ABC） | 文字の名前を聞いて大文字 3択 → 形・音の似た字を混ぜて 4択（**hiddenByDefault**） | P2 | 5歳 |

- 5歳の札には p4 の move・hello・picture-book もつなぐ（単元はどの札からでもつなげる。5歳から英語を始める子が「からだ」「あいさつ」「えほん」で遊べるように）。
- 進度は単元ごと。2歳段階は既存の規則どおり常に段階0・習熟を記録しない（UnitRunner の roundLevel・recordMastery）。

### 2.1 年齢に合う遊び方（共通の決まり）

| 項目 | 2歳段階（p23 L2） | 3歳段階（p23 L3） | 4歳 | 5歳 |
|---|---|---|---|---|
| 音声 | 1語を2回（間 700ms） | 1語を2回、または短い文1つ | 1語を2回、文1つ | 句・文1つ（2回まで） |
| 選択肢 | 2 | 2〜3 | 3〜4 | 4 |
| 選択肢の中身 | 絵だけ（文字なし） | 絵だけ | 絵だけ | 絵だけ（ABC だけ大文字の図） |
| 触った後 | 触った物の英語の名前を返す | 同左 | 同左 | 同左 |
| 不正解 | 既存の 2歳段階の扱い（印・音なし、「もういちど みてみよう」）＋名前を返す＋目当ての語をもう一度 | 名前を返す＋やさしい説明＋もう一度聞かせる。不正解の効果音なし | 同左 | 同左 |
| 答えの後 | 解説に日本語の意味（「いぬ だね」）。英語をもう一度 | 同左 | 同左＋（move・shop・hello）親子で言う・動く声かけ | 同左 |
| 1回の量 | 3問（区分の既定） | 3問 | 4問 | 5問 |

- 「名前を返す」は listen の拡張 E1（4章）。正解のときも「Dog!」と返してから、正解の音（2歳段階は置いた音）になる。
- 不正解の効果音を鳴らさないのは、単元の印 `gentleJudgement`（4章 E4）。○／？の印と位置の意味は全区分で同じまま（ux-by-age 4章）。
- 日本語の訳は**答えた後の解説の文**で出す（問題文やヒントで意味を言うと、聞かずに答えが決まるため）。

### 2.2 問題文・ヒント・解説・導入（日本語の決まり）

- 問題文（実行枠が日本語で読み上げ、その後で英語が鳴る）: 単元ごとに1〜2種類に固定する（くり返しで子が覚える）。
  - words・colors-numbers・phrases: 「えいごを きいてね。どれかな？」
  - move: 「えいごを きいてね。どの うごきかな？」
  - hello: 「えいごを きいてね。どの ばめんかな？」
  - picture-book: 「えいごの えほんを きこう。さいごに きこえた ページは どれ？」（段階2「さいしょの ページは どれ？」）
  - shop: 「おきゃくさんの えいごを きいてね。どれを わたす？」
- ヒント（幼児2段。どちらも答えを言わない。押すと日本語で読んだ後に英語をもう一度鳴らす: E2）:
  - ①「もういちど よく きいてね。」
  - ②「おうちの ひとと いっしょに、まねして いって みよう。」（move は「おうちの ひとと いっしょに、うごきながら きいて みよう。」）
- 解説（答えの後。日本語の意味。英字を書かない）: 「『いぬ』の ことだよ。」「『ジャンプ』は ぴょんと とぶ ことだよ。いっしょに やって みよう！」のように、語の意味を1文で。カタカナは 6章の語の日本語の名前（絵の label と同じ）だけ。
- 誤概念の説明（責めない・短い）: 「にている おとだったね。もういちど きいて みよう。」など（単元ごとに 2〜3。5章）。
- 導入（はじめての回だけ。おてほん）: 2場面。
  1. 「えいごの ことばを きいて、えを えらぶ あそびだよ。」（図: その単元の代表の絵）
  2. 「おうちの ひとと いっしょに、まねして いって みよう。」（図: `enpre-icon`）
- 文字の検査: 子供に見える文字（単元名・到達項目名・導入・問題文・ヒント・解説・誤概念の説明・選択肢の label）に英字・漢字・絵文字を入れない（パックのテストで検査。8章）。

---

## 3. 本体の変更点

### 3.1 教科 'en' を幼児の段階で使う

- `SubjectId` にはすでに `'en'` がある（src/curriculum/types.ts）。型の変更は要らない。
- `src/curriculum/subjects.ts` の `SUBJECTS` は小学生の教科の札の定義なので**変えない**（幼児ホームは教科の札を出さない）。
- 単元の索引（`npm run build:unit-index`）は stage と subject をそのまま写すので変更なし。`pack` は `'en-pre'`。
- `scripts/curriculum-report.ts` は ID の正規表現 `(p23|p4|p5|g[1-6])\.[a-z]+\.` で拾うので変更なし。

### 3.2 パックの置き場所と同梱

- 新しいパック `src/packs/en-pre/`（既存の p23・p4・p5 のファイルには一切触らない）。
- `scripts/vite-plugin-precache.ts` の `CORE_PACK_IDS` に `'en-pre'` を足す（幼児の教材はコアに同梱: architecture.md 6.1 R#20）。同じ定数のテスト（`vite-plugin-precache.test.ts`）があれば期待値を直す。
- 英語の mp3 は既存どおり `public/audio/en/en-pre.<種類>.<スラッグ>.mp3`（`audio/en/` はパックの音声ではないのでコアに入る。en-g34 と同じ扱い）。日本語の文の音声は `voice:packs` が `voice/packs/en-pre.json` を作り、`public/audio/en-pre/` に生成する（他の幼児パックと同じ）。
- architecture.md 6.1 の「幼児の教材はコアに同梱」の一覧に en-pre を書き足す（10章）。

### 3.3 単元の型の追加（小さく・省略可）

`src/curriculum/types.ts`:

```ts
export interface ChoiceOption {
  // …既存…
  /** listen の nameBack で、触ったときに返す名前の音声（英語は key 必須）。choice エンジンは使わない */
  sound?: { text: RichText; key?: string };
}

export interface UnitSpec {
  // …既存…
  /** 不正解の効果音を鳴らさない（正誤の印・説明・記録は今までどおり）。幼児の英語で使う */
  gentleJudgement?: boolean;
  /** 保護者画面に出す遊び方の一言（漢字かな交じり可。子供画面には出さない） */
  parentNote?: string;
}

export interface UnitMeta {
  // …既存…
  parentNote?: string; // build-unit-index が UnitSpec から写す
}
```

- `ChoiceOption.sound` の型は listen の `ListenSound` と同じ形（`{ text, key? }`）。types.ts から listen を値で import しないよう、形をそのまま書く。
- `scripts/build-unit-index.ts` で `parentNote` を写す（`hiddenByDefault` と同じ書き方）。

### 3.4 保護者の設定（えいごの入口を出すか）

- `ChildSettings`（src/core/types.ts）に `showPreschoolEnglish?: boolean` を足す。**省略時は true**（データ移行なし。`defaultSettings` には書かない）。
- 保護者画面「せってい」→「ホームの表示」の Section に「幼児ホームに『えいご』の札を出す」のチェックを足す（data-testid `setting-preschool-english`）。説明: 「2〜3歳の2歳の段階では、この設定にかかわらず出しません。『ほかの がくねん』からは入れます。」

---

## 4. エンジン（listen の小さな拡張）

方針: 新しいエンジンは作らない。listen（src/engines/listen/listen.tsx・options.tsx）に**省略可の項目**を足し、今までの問題はそのまま動く。choice・reading は変えない。

### E1 名前を返す（nameBack）

```ts
export interface ListenItem extends ItemBase {
  // …既存…
  /** 選択肢を触ると、その選択肢の sound を鳴らしてから答える（幼児の英語） */
  nameBack?: boolean;
}
```

- 動き: 選択肢を押す → すべての選択肢を押せなくする（連打防止）→ その選択肢の `sound` を `soundSeq()` で鳴らす → 鳴り終わったら（`audio.play` が返ったら。音が出ない環境では 1500ms で打ち切り）`submit([i])`。
- 押した選択肢は鳴っている間 `selected` の見た目（太い輪郭）にする（DESINGN 8章。何を触ったかが分かる）。
- `options.tsx` の `ChoiceOptions` に省略可の `onPress?: (i: number, submit: (r: ChoiceResponse) => void) => void` を足し、listen だけがそれを渡す（reading は今までどおり）。
- `checkListen` に足す検査: `nameBack` のときは `multi` を使えない／すべての選択肢に `sound` がある／`sound.text` に英字があれば `key` 必須（既存の audio と同じ規則）。

### E2 聞き直し（replay）

```ts
  /** 不正解の後・ヒントを出した後に、問題の音声をもう一度鳴らす */
  replay?: { afterWrong?: boolean; onHint?: boolean };
```

- `afterWrong`: `wrongMark` が新しく付いたら、実行枠の日本語（誤概念の説明・「もういちど みてみよう」）が終わるのを `whenQuiet` で待ってから `play()`。
- `onHint`: `hintsShown` が増えたら、ヒントの読み上げが終わるのを待ってから `play()`。
- どちらも「もういちど きく」と同じ再生（止めてから最初から）。再生中も選択肢は押せる（最初の1回だけ押せない、の既存の規則は変えない）。

### E3 答えの後の音声（revealAudio）

```ts
  /** 正答を見せるとき（解説）に1回だけ鳴らす音声。日本語の文（key なし）と英語（key あり）を混ぜてよい */
  revealAudio?: ListenSound[];
```

- `revealed` が true になったら `whenQuiet` で待って、`gapMs` の間をあけて順に鳴らす（`listenSeq` と同じ組み立て）。
- 使い方: move「いっしょに やって みよう。」→「Jump! Jump! Jump!」、shop「Here you are.」→「Thank you!」、words は英語の語をもう一度。
- 「つぎへ」を押したら止まる（navigate・次の問題で既存どおり `audio.stop`）。

### E4 不正解の効果音を鳴らさない（UnitRunner）

- `src/units/UnitRunner.tsx` の submit: `const quietWrong = ux.softJudgement || unit.gentleJudgement;` とし、不正解の効果音（`audio.sfx('wrong')`）を `quietWrong` のとき鳴らさない。それ以外（○／？の印・誤概念の説明・ヒント・記録・段階の判定）は変えない。2歳段階の扱い（softJudgement）は今までどおり。

### 採らなかった案（記録）

- **ページをめくる絵本のエンジン（scenes）**: 絵と音声を1ページずつ同期して出す拡張。今回は「4コマの絵の帯（figure の row）＋ページの文を順に鳴らす」で代える（エンジンを増やさない）。5歳の長い絵本（P2）を作るときに、帯で見づらければ統括に提案する。
- **ゆっくり版の音声**: 0.7 未満の話速は不自然になりやすい〔調査 4.3〕。ゆっくりは「2回・間をあける」で作る。
- **カードの名前の読み上げ（英語）を choice に足す**: listen だけで足りる。

---

## 5. 単元の仕様（実装担当がそのまま書ける形）

共通:
- 単元の項目: `stage`（p23/p4/p5）、`subject: 'en'`、`domain: 'en'`、`kind: 'play'`、`review: 'none'`、`icon`（各単元の代表の絵）、`gentleJudgement: true`、`parentNote`（5.x に書く）、`basis`（下の文）、`gradeIsAppProposal: true`、`revised`。
- `basis`: 「幼稚園教育要領 言葉（言葉の響きやリズム）・環境（異なる文化に触れる）、保育所保育指針（文化の違いを認める）。小学校 外国語活動（3・4年）『聞くこと』へ接続（慣れ親しむ）。本アプリの案」
- すべての問題は listen。`hideTranscript: true`（正答の表示で英字を出さない）、`nameBack: true`、`replay: { afterWrong: true, onHint: true }`、`gapMs: 700`。
- 段階（`levels`）: `{ label, chance }` は p23・p4 の既存の書き方に合わせる（2択は chance 0.5、3択 0.33、4択 0.25 を目安）。
- 同一性キー: `<形式>:<目当ての語>`（例 `hear:dog`、`where:dog`、`num:3-apple`）。正解の位置・誤りの選択肢の組み合わせは同じとみなす（curriculum-matrix 1.4）。
- 問題の id も同一性キーと同じ文字列でよい（保護者画面の「問題」の欄に出るので、英語の語が見える形にする）。
- 誤りの選択肢はすべて誤概念ID付き（汎用の誤答 0%）。
- 赤と緑を同じ問題に並べない（DESINGN 3.1）。
- パックは他のパックを import しない。en-g34 の `lib.ts`・`voice.ts` と同じ形の部品を en-pre の中に書く（コピーしてよい）。

### 5.1 p23.en.words えいごで タッチ（P1）

- 到達項目: `animal-food`（どうぶつ・たべもの）、`more`（のりもの・もの）。
- 段階0（L2・2択）: 語は 6章の「どうぶつ」6語＋「たべもの」6語＝12語。音声は `[word, 700ms, word]`（同じ key を2回）。誤りの選択肢は**同じなかま**から1つ。
- 段階1（L3・3択）: 24語（段階0の12語＋のりもの6＋もの6）。誤りは同じなかまから2つ。
- 別例（`alt: true`）: キャリア文「It's a dog.」（`it` の音声）を1回鳴らす形。各到達項目に 4 問以上。
- 誤概念: `same-group`（「にている なかまの ことばだね。もういちど きいて みよう。」）、`same-start`（はじめの音が同じ: bear/bird、bus/banana、car/cat など。「はじめの おとが にて いたね。さいごまで きいて みよう。」）。`same-start` の組は 6章の表に印。
- revealAudio: `[word]`（英語をもう一度）。
- 解説: 「『〈日本語の名前〉』の ことだよ。」
- 量: 段階0 12（≥8）、段階1 24（≥12）。
- 札の絵: `enpre-icon`。単元の icon: `dog`。
- parentNote: 「英語を聞いて絵を選ぶ遊びです。お子さんが絵を指さしたら、いっしょに英語で言ってみてください（正しく言えたかは気にしなくて大丈夫です）。」

### 5.2 p23.en.move うごいて みよう（P2・3歳段階。版 0.2 で詳細化）

ファイル `src/packs/en-pre/move-p23.ts`（`export const p23Move`）。p4.en.move（move.ts）と**同じ合図の音声・同じ絵**を使う（新しい英語の音声・絵は無い）。合図の表（WHOLE・TOUCH_PARTS）は `vocab.ts` に移して両方の単元から import する（5.5）。

- 単元: id `p23.en.move`、title「うごいて みよう」、stage `p23`、icon `enpre-act-jump`、priority `P2`、prereq `['p23.en.words']`（おすすめの順に使うだけ。開けなくはしない）。
- intro: `intro(ill('enpre-act-jump'), 'えいごの あいずを きいて、うごきの えを えらぶ あそびだよ。')`。
- 到達項目（2）:
  - `move` 「うごきの えいごを きく」: 6.5 の 8種（jump・clap・stand・sit・turn・stomp・wave・handsup）。
  - `touch` 「からだを さわる えいごを きく」: 6.4 の さわる部分のうち 6（nose・head・ears・mouth・tummy・toes）。knees・shoulders は4歳から。
- 段階（levels）: `[{ label: 'うごき（2たく）', chance: 0.5 }, { label: 'うごき・からだ（3たく）', chance: 1/3 }]`。2歳段階は常に段階0（既存の規則）。
- 問題の全件（すべて `listen()`。hints は `HINTS_MOVE`、prompt は「えいごを きいてね。どの うごきかな？」）:

| 段階 | 到達項目 | 形 | 同一性キー（= id。段階1の同じキーは `:1` を付ける） | 音声 | 選択肢 | 件数 |
|---|---|---|---|---|---|---|
| 0 | move | 合図 | `cmd:<動き>` | `twice(cmd)` | 2: 正解＋**似ていない**動き1（`other-move`。下の similar の組を除いて `pickN`） | 8 |
| 0 | move | 別例 | `lets:<動き>`（alt） | `[lets]` | 2: 同上 | 8 |
| 1 | move | 合図 | `cmd:<動き>`（id `cmd:<動き>:1`） | `twice(cmd)` | 3: 正解＋似た動き（あれば。`similar-move`）＋ほか（`other-move`） | 8 |
| 1 | touch | 合図 | `touch:<部分>` | `twice(touch)` | 3: 正解＋近い部分（あれば。`body-near`）＋ほか（`other-move`）。誤りは touch の6から | 6 |
| 1 | touch | 別例 | `letstouch:<部分>`（alt） | `[letstouch]` | 3: 同上 | 6 |

  - 合計 36問。異なる同一性キー 28（move 8＋別例 8、touch 6＋別例 6）。Q = 28 ÷ 12 ≈ 2.3。C 2/2（move 8・alt 8、touch 6・alt 6）。段階0の異なるキー 16（≥8）。
  - 似た動き（similar-move）: jump↔stomp、clap↔wave、stand↔sit（6.5）。近い部分（body-near）: nose↔mouth、head↔ears（p23 の6部分の中）。
- revealAudio: `[{ text: 'いっしょに やって みよう。' }, cmd, cmd]`（別例も cmd。p4 と同じ）。
- 解説: p4.en.move と同じ文（6.5・6.4 の「解説の日本語」。例「『ジャンプ』は ぴょんと とぶ ことだよ。いっしょに やって みよう！」「『おなか』を さわる ことだよ。いっしょに やって みよう！」）。
- 誤概念: `other-move`（「ちがう うごきだったね。もういちど きいて みよう。」）、`similar-move`（「にている うごきだね。もういちど きいて みよう。」）、`body-near`（「ちかくの ところだね。もういちど きいて みよう。」）。
- 2歳段階のホームには札が出ない（8.2）が、「ほかの がくねん」から開くと段階0（2択）だけになる。
- parentNote: 「英語の合図を聞いて、いっしょに体を動かしてみてください。大人がまねして見せると、子どもも動きやすくなります。」
- テスト（11.1 に追加）: 段階0の選択肢が2で similar-move の組を含まない／段階1の touch の誤りに whole の絵が無い／音声の key がすべて p4.en.move の台本にもある（p23 だけの英語の音声が無い）。

### 5.3 p4.en.words えいごで タッチ（P1）

- 到達項目: `animal`、`food`、`ride-thing`（のりもの・もの）、`body`（からだ）。
- 段階0（3択）: 1語を2回。誤りは同じなかまから2つ（`same-start` の組があれば1つはそれ）。
- 段階1（3択）: キャリア文「Where is the dog?」（`where` の音声。1回）。
- 段階2（4択）: 1語を2回。誤りはちがう なかまを混ぜる（なかまの手がかりが使えない）。
- 別例（`alt`）: 「It's a dog.」の形（各到達項目 3 問以上）。
- からだ（body）の語: nose・head・ears・mouth・toes・hands（6章）。絵は `enpre-touch-*`（うさぎがその部分をさわっている絵）。日本語の名前は「はな（かお）」のように、ほかの語とまぎれない書き方にする（「はな」は花と同じ音のため）。
- 誤概念: `same-group`、`same-start`、`body-near`（からだの近い部分: nose/mouth、head/ears。「ちかくの ところだね。」）。
- revealAudio: `[word]`。量: 各段階 30 語以上（全件。6章）。
- parentNote: 「『Where is the dog?（いぬはどこ？）』のような短い文も出てきます。絵本や散歩のときに、同じ言葉を英語で言ってみるのもおすすめです。」

### 5.4 p4.en.colors-numbers いろと かず（P1）

- 到達項目: `color`、`number`。
- 段階0 いろ（3択）: 8色（6章）。選択肢の図は `{ kind: 'row', items: [ボールの絵 enpre-ball-<色>, 代表の物の絵] }`（DESINGN 3.1: 色見本に代表の絵を併記。色の名前の文字は幼児では出さない。模様は出さない）。赤と緑を同じ問題に出さない。
- 段階1 かず（3択）: 1〜5。図は `{ kind: 'illust', id: <物>, count: n }`（物は apple・ball・flower・p23-star・car-red を順に）。音声は数の語を2回。誤りは ±1 の数（`near-number`）と、はじめの音が同じ数（four/five、two/three は ±1 なので near-number として扱う）。
- 段階2（4択）: いろ・かずを混ぜる（1問の中では一方だけ）。
- 別例: いろ「It's red.」、かず「Two apples.」（キャリア）。
- 誤概念: `near-number`（「ひとつ ちがいだね。いっしょに かぞえて みよう。」）、`other-color`（「ちがう いろだね。」）、`same-start`（blue/black は使わない語なので無し。pink/purple、green/gray は gray を使わないので pink/purple だけ）。
- revealAudio: `[word]`。量: 段階0 8×（誤りの組で）12 以上、段階1 5（全件）＋別例、段階2 12 以上。
- parentNote: 「色や数を英語で言う遊びです。おやつのときに『One, two, three!』といっしょに数えるなど、生活の中でも使ってみてください。」

### 5.5 p4.en.move うごいて みよう（P1）

- 到達項目: `whole`（からだ全体の動き 8種）、`touch`（からだを さわる **8種**: Touch your nose / head / ears / mouth / toes / **tummy / knees / shoulders**）。
- 段階0（3択）whole、段階1（3択）touch、段階2（4択）まぜて。
- 音声: `[cmd, 700ms, cmd]`。選択肢は `enpre-act-*`・`enpre-touch-*`。
- revealAudio: `[{ text: 'いっしょに やって みよう。' }, cmd, cmd]`（「Jump!」を2回。子と大人が動く時間）。
- 解説: 「『ジャンプ』は ぴょんと とぶ ことだよ。」（動きの日本語。6章）
- 誤概念: `other-move`、`similar-move`（stand/sit、jump/stomp、clap/wave）、`body-near`（touch の部分の取り違え）。
- 別例: 「Let's jump!」の形（`lets` の音声）を各到達項目 3 問以上。
- 量: 段階0 8（全件）＋別例、段階1 8（全件）＋別例、段階2 16。

**版 0.2 の補い（実装中の move.ts の直し方）**

- 不足: 版 0.1 の touch は5部分で、到達項目 touch の異なる問題が5（基準は6）。C 1/2。
- 直し方: さわる部分を 3 足して 8 にする。足す語は幼児の TPR で広く使われ、絵で区別しやすく、目に触れない部分に限る（Touch your eyes は使わない: 6.4）。
  | 英語 | 合図（touch） | 別例（lets） | 日本語（label・解説） | 絵（新・P1） | 近い部分（body-near） |
  |---|---|---|---|---|---|
  | tummy | Touch your tummy. | Let's touch our tummies. | おなか | enpre-touch-tummy | −（なし） |
  | knees | Touch your knees. | Let's touch our knees. | ひざ | enpre-touch-knees | toes |
  | shoulders | Touch your shoulders. | Let's touch our shoulders. | かた | enpre-touch-shoulders | head |
  - `tummy` は幼児に向けた普通の言い方（belly より柔らかい）。`knees`・`shoulders` は両側にあるので複数形。
  - 4つの部分（head・shoulders・knees・toes）をこの順で続けて出さない（よく知られた歌の並びに似せない。各問題は1部分だけなので、問題の並びも `mix` のまま）。
- 表の置き場所: いまの move.ts は TOUCH を `WORD_BY_ID`（p4.en.words の語）から作る。tummy・knees・shoulders は p4.en.words に足さない（words の台本・量を変えない）ので、`vocab.ts` に `TOUCH_PARTS: TouchPart[]`（id・ja・illust・near?）を新しく置き、move.ts と move-p23.ts（5.2）がそこから作る。nose〜toes の ja・illust は BODY と同じ値。
- 近い部分は**両向き**で引く: `NEAR_TOUCH_PAIRS = [['nose','mouth'], ['head','ears'], ['toes','knees'], ['head','shoulders']]`。`misOf` は「組に入っていれば body-near」（今の `m.near === x.id` の片向きだと、head が正解で shoulders を誤りに出したときに other-move になる）。head のように近い部分が2つあるときは、`mix` の順で1つを先に入れる。
- 別例の英文を直す（7.6-1）: `Let's touch our ${id}.` は一人ひとりが自分の部分をさわる言い方なので、複数形にする: noses・heads・ears・mouths・toes・tummies・knees・shoulders。表で持つ（`lets: "Let's touch our noses."`）。英語の音声はまだ作っていないので、key が変わっても困らない。
- 異なる問題（同一性キー）: whole 8（別例 8）、touch 8（別例 8）→ C 2/2。全体 32（Q ≈ 2.7）。段階2 は 16問（`cmd:*:2`・`touch:*:2` の id）。
- 新しい英語の音声: touch 3・lets 3（tummies・knees・shoulders）＋文を直した lets 3（noses・heads・mouths）。旧 key（`lets-touch-our-nose` など）は台本から消える。
- テスト（11.1 に追加）: touch の異なる同一性キーが 8、body-near の付いた誤りが NEAR_TOUCH_PAIRS の組だけ、touch の別例の英文が `/^Let's touch our [a-z]+s\.$/`。
- parentNote: 「英語の合図に合わせて、いっしょに体を動かしてください。画面は答えを選ぶだけで、動きの判定はしません。」

### 5.6 p4.en.hello あいさつ（P1）

- 到達項目: `greet`（あいさつ 5: Hello. / Good morning. / Good night. / Thank you. / Bye-bye.）、`feel`（きもち 4: I'm happy. / I'm sad. / I'm sleepy. / I'm hungry.）。
- 図: Hello＝`enpre-meet`、Good morning＝`p23-sun`、Good night＝`p5-moon`、Thank you＝`enpre-gift`、Bye-bye＝`enpre-bye`。きもちは既存の `eng34-face-happy`・`-sad`・`-sleepy`・`-hungry`（en-g34 の絵。id で参照するだけなので import はしない）。
- 段階0（3択）greet、段階1（3択）feel、段階2（4択）まぜて。Hello と Bye-bye は同じ問題に並べない（どちらも手をふる場面のため）。
- 音声は文を1回＋700ms＋もう1回。
- revealAudio: `[{ text: 'おうちの ひとと いって みよう。' }, 文]`。
- 誤概念: `other-scene`（「ちがう ばめんの ことばだね。」）、`same-start`（Good morning / Good night。「はじめが おなじ ことばだね。さいごまで きいて みよう。」）、`other-feel`。
- 量: 定義域が小さいので全件（greet 5・feel 4）＋別例（greet は「Hello, rabbit!」のように動物の名前を付けた形、feel は「I'm happy!」の感嘆）で段階ごと 12 以上にする。
- parentNote: 「朝の『Good morning』、寝る前の『Good night』など、毎日の決まった場面で英語のあいさつを言い合うと、楽しく続けられます。」

**版 0.2 の補い（上の到達項目・量を次のとおり改める）**

- 不足: greet 5・feel 4 で、どちらも異なる問題が6に届かない（C 0/2）。
- 到達項目（名前を改める）:
  - `greet` 「あいさつの えいごを きく」: **7**（Hello! / Good morning! / Good night! / Bye-bye! / Thank you! / **I'm sorry.** / **Happy birthday!**）。ありがとう・ごめんね・おめでとうは、幼稚園の生活で「あいさつ」としてまとめて扱われる言葉なので同じ到達項目に入れる。
  - `feel` 「きもちや からだの ようすの えいごを きく」: **8**（I'm happy. / I'm sad. / **I'm angry.** / I'm sleepy. / I'm hungry. / **I'm thirsty.** / **I'm hot.** / **I'm cold.**）。絵はすべて既存の en-g34 の顔（`eng34-face-angry`・`-thirsty`・`-hot`・`-cold`）。scared（こわい）は絵が無く、表情だけで sad と区別しにくいので入れない。tired は sleepy と絵が近いので入れない。
- 足す行（6.8 の表にも足す）:
  | id | 台本（sound） | 別例（altSound） | 日本語（label） | 解説 | 絵 |
  |---|---|---|---|---|---|
  | sorry | I'm sorry. | I'm sorry, bear. | ごめんね | 「ごめんね」の ばめんだよ。 | 新 enpre-sorry |
  | birthday | Happy birthday! | Happy birthday, rabbit! | おめでとう | 「おたんじょうび おめでとう」の ばめんだよ。 | 新 enpre-birthday |
  | angry | I'm angry. | I'm angry! | おこった | 「おこった」の きもちだよ。 | eng34-face-angry |
  | thirsty | I'm thirsty. | I'm thirsty! | のどが かわいた | 「のどが かわいた」の ようすだよ。 | eng34-face-thirsty |
  | hot | I'm hot. | I'm hot! | あつい | 「あつい」の ようすだよ。 | eng34-face-hot |
  | cold | I'm cold. | I'm cold! | さむい | 「さむい」の ようすだよ。 | eng34-face-cold |
  - key: sorry は `enKey('hello', 'im-sorry', …)`・別例 `enKey('hello', 'im-sorry-bear', …)`、birthday は `'happy-birthday'`・`'happy-birthday-rabbit'`。きもちは今の `F()` のまま（`feel.im-<id>`・`feelx.im-<id>`）。
  - 既存の4つ（happy・sad・sleepy・hungry）の解説は「〜の きもちだよ。」のまま。hungry は「おなかが すいた」の ようす だが、今の文のままでよい（直すなら thirsty と同じ「ようす」にそろえる）。
- 同じ問題に並べない組（`clash`。今の hello・bye に足す）:
  - hello と bye（どちらも手をふる場面。今のまま）
  - birthday と happy（どちらにも happy の音がある。4歳には区別の負担が大きい）
  - sorry と sad（「I'm s…」で始まり、最後の語の頭の音も同じ）
  - morning と hot（どちらの絵にも おひさま がある）
- 誤概念（今の3つに1つ足す。説明はどれも短く責めない）:
  - `other-scene`、`same-start`（Good morning ↔ Good night に加え、**greet の I'm sorry ↔ feel の I'm 〜**も「はじめが おなじ ことば」。段階2で出る）、`other-feel`
  - `pair-feel`（hungry ↔ thirsty、hot ↔ cold。「よく にた ようすだね。さいごまで きいて みよう。」）。`misOf` は sameStart → pair-feel → other-feel／other-scene の順。
- 段階: 段階0 greet 3択（7）、段階1 feel 3択（8）、段階2 まぜて 4択（15）。段階0では morning と night を同じ問題に入れる今の作り（sameStart を先に入れる）を続ける。段階1では pair-feel の組を先に入れる（hungry の問題に thirsty、hot に cold）。
- 量: 異なる同一性キー greet 7＋別例 7、feel 8＋別例 8 → C 2/2。全体 30（Q 2.5）。問題 45（段階0 14・段階1 16・段階2 15）。
- 新しい絵（P1。6.11）: `enpre-sorry`（うさぎが たおれた コップの そばで ぺこりと あたまを さげる。くまが みている）、`enpre-birthday`（ろうそくを たてた ケーキの まえで とんがりぼうしの くまが わらう。プレゼントの はこは描かない: thanks の絵と分けるため。文字・数字を描かない）。
- 新しい英語の音声: hello 4（I'm sorry. / I'm sorry, bear. / Happy birthday! / Happy birthday, rabbit!）、feel 4、feelx 4 の 12本。
- revealAudio・hints・prompt は今のまま。
- テスト（11.1 に追加）: 上の clash の組が同じ問題に無い／pair-feel の誤りが組どうしだけ／greet 7・feel 8 の異なる同一性キー。

### 5.7 p4.en.picture-book えいごの えほん（P1）

- 本はすべて本アプリのオリジナル（7.4 の6冊）。1冊4ページ、ページごとに絵1つと英文1つ。くり返しの形（「Hello, 〜!」「〜. Yummy!」など）にする。
- 図: 4ページの絵の帯 `{ kind: 'row', items: pages.map(p => ({ kind: 'illust', id: p.illust })), gap: 1.6 }`（`item.figure`）。絵 1枚 11u 程度。作業領域に入るか E2E で確かめる（8章）。
- 段階0（2択）: 音声 = 4ページの文を順に（間 900ms）→ 1200ms → 1〜3ページのどれか1つの文をもう一度。問題「さいごに きこえた ページは どれ？」選択肢は そのページの絵と、同じ本のほかのページの絵1つ。
- 段階1（3択）: 同じで選択肢3。
- 段階2（3択）: 帯の図を出さない。音声は4ページの文だけ。問題「さいしょの ページは どれ？」選択肢は1ページ目の絵と、2〜4ページの絵から2つ。
- revealAudio: `[target の文]`。
- 誤概念: `other-page`（「おなじ えほんの ちがう ページだね。もういちど きいて みよう。」）、`last-page`（段階2で4ページ目を選んだ。「さいごの ページだね。さいしょは どれかな。」）、`middle-page`。
- 量: 6冊×3ページ＝18（段階0・1）、段階2 6（全件）＋別例（段階2の別例: 「さいごの ページは どれ？」6）。
- 解説: 本の日本語の題とページの意味（例「『こんにちは、ねこさん』の ページだよ。」）。
- parentNote: 「同じお話を何度もくり返し聞くことで、言葉に親しめます。お子さんが気に入ったお話は、ページの絵を指さしながら、いっしょに英語を言ってみてください。」

### 5.8 p4.en.where かくれんぼ（P2）

ファイル `src/packs/en-pre/where.ts`（`export const p4Where`）。

- 版 0.1 の「箱（box）」を**ベッド（bed）**に改める。理由: 「under the box」は箱が動物にかぶさる絵になり、「in the box」（箱から顔を出す）と見分けにくい。ベッドなら in（ふとんに入って まくらに頭）・on（ふとんの上に すわる）・under（ベッドの下、脚の間に全身）がはっきり分かれ、3つの絵が同じベッドの形で描ける。
- 単元: id `p4.en.where`、title「かくれんぼ」、stage `p4`、icon `enpre-where-cat-under`、priority `P2`、prereq `['p4.en.words']`。
- intro: `intro(ill('enpre-where-cat-in'), 'えいごを きいて、どうぶつが どこに いるか えらぶ あそびだよ。')`。
- 語: どうぶつ3（cat・dog・rabbit。p4.en.words の既習語）× ばしょ3（in・on・under）＝ 9場面。
- 絵（新・P2、9枚）: `enpre-where-<animal>-<pos>`（animal = cat・dog・rabbit、pos = in・on・under）。どれも同じベッド（木の枠・脚4本・白い ふとん・まくら。画面の中の位置も同じ）に、既存の cat・dog・rabbit と同じ顔の動物を置く。
  - in: ふとんを かけて ねている。顔と耳だけが まくらの上に出る。
  - on: ふとんの上に すわっている（全身が見える）。
  - under: ベッドの下の床に ふせている（脚の間に全身が見える。ベッドの上は空）。
  - label: 「ベッドの なかの ねこ」「ベッドの うえの ねこ」「ベッドの したの ねこ」（いぬ・うさぎ も同じ形）。
- 英語（台本。新しい key は `pos` の種類）:
  | 場面 | 文（sound） | 答えだけ（別例の後半） |
  |---|---|---|
  | in | The cat is in the bed. / The dog is in the bed. / The rabbit is in the bed. | In the bed. |
  | on | The cat is on the bed. / The dog is on the bed. / The rabbit is on the bed. | On the bed. |
  | under | The cat is under the bed. / The dog is under the bed. / The rabbit is under the bed. | Under the bed. |
  - 別例の前半の問いは p4.en.words の `where` の音声（Where is the cat? / Where is the dog? / Where is the rabbit?）をそのまま使う（新しい音声にしない）。
  - 新しい英語の音声は 12本（文 9・答え 3）。key 例 `en/en-pre.pos.the-cat-is-in-the-bed`、`en/en-pre.pos.in-the-bed`。
- 到達項目（2）:
  - `pos` 「どこに いるかの えいごを きく」: 同じ動物で ばしょだけが違う（in / on / under の聞き分け）。
  - `who-pos` 「だれが どこに いるかを きく」: 動物も ばしょも違う選択肢から選ぶ（2つの語を最後まで聞く）。
- 段階（levels）: `[{ label: 'どこかな（3たく）', chance: 1/3 }, { label: 'だれが どこ（4たく）', chance: 0.25 }]`。
- 問題の全件（prompt「えいごを きいてね。どこに いるかな？」、hints `HINTS`、gapMs 700）:

| 段階 | 到達項目 | 形 | 同一性キー（= id） | 音声 | 選択肢（正解＋誤り） | 件数 |
|---|---|---|---|---|---|---|
| 0 | pos | 文 | `pos:<animal>-<pos>` | `twice(文)` | 3: 同じ動物の3つの ばしょ（誤りは in↔on なら `in-on`、under が絡めば `other-place`） | 9 |
| 0 | pos | 別例（問いと答え） | `posqa:<animal>-<pos>`（alt） | `[Where is the <animal>?, 答えだけ]` | 3: 同上 | 9 |
| 1 | who-pos | 文 | `whopos:<animal>-<pos>` | `twice(文)` | 4: 同じ動物の別の ばしょ1（`in-on` か `other-place`）・別の動物の同じ ばしょ1（`other-animal`）・別の動物の別の ばしょ1（`both`）。別の動物・別の ばしょは `mix` の決まった順 | 9 |
| 1 | who-pos | 別例（問いと答え） | `whoposqa:<animal>-<pos>`（alt） | `[Where is the <animal>?, 答えだけ]` | 4: 同上 | 9 |

  - 合計 36問・異なる同一性キー 36（各到達項目 9＋別例 9）。Q = 3.0、C 2/2。
  - 段階1の「同じ動物の別の ばしょ」は、in・on が正解なら もう一方（in-on）、under が正解なら in か on（other-place）を `mix` で選ぶ。
- 選択肢: `opt({ label, figure: ill('enpre-where-<animal>-<pos>'), sound: 文の音声 })`（nameBack で「The dog is under the bed.」が返る）。
- revealAudio: `[文]`（別例も、答えの後は完全な文を1回）。
- 解説: 「<動物の日本語>が ベッドの <なか／うえ／した>に いるね。」（例「ねこが ベッドの したに いるね。」）。
- 誤概念:
  - `in-on`: 「にて いる おとだね。さいごまで よく きいて みよう。」（in と on は短く似た音）
  - `other-place`: 「ばしょの ことばを よく きいて みよう。」
  - `other-animal`: 「ばしょは あって いたね。どうぶつの なまえも きいて みよう。」
  - `both`: 「どうぶつも ばしょも ちがったね。もういちど さいごまで きいて みよう。」
- 赤と緑: 絵に赤・緑の大きな面を使わない（ふとんは白、枠は木の色）。
- カタカナ: 「ベッド」をパックのテストの KATAKANA_OK に足す（物の名前）。
- parentNote: 「『in（なか）』『on（うえ）』『under（した）』を聞き分ける遊びです。おもちゃを箱やいすの上・下に置いて、英語で言い合ってみてください。」
- テスト（11.1 に追加）: 段階0の選択肢がすべて同じ動物／段階1の誤りが other-animal・both・(in-on か other-place) を1つずつ／9枚の絵がある。

### 5.9 p5.en.phrases かずと いろと もの（P1）

- 到達項目: `word`（1語。p4.en.words の語から）、`number-noun`（かず＋もの）、`color-number`（かず＋いろ＋ボール）。
- 段階0（4択）: 1語を2回。ちがう なかまを混ぜる。
- 段階1（4択）: 「Three apples.」。数 1〜10 × もの（apple・ball・flower・p23-star・car-red・dog）。選択肢は「数ちがい（±1）・ものちがい・両方ちがい」の3つ＋正解。図は `{ kind:'illust', id, count }`。
- 段階2（4択）: 「Two blue balls.」。数 1〜5 × 色（8色。赤緑を同時に出さない）。選択肢は「数ちがい・色ちがい・両方ちがい」＋正解。図は `{ kind:'illust', id: 'enpre-ball-<色>', count }`。
- 誤概念: `near-number`、`other-noun`（「かずは あって いたね。ものの なまえを きいて みよう。」）、`other-color`、`both`（「もういちど さいごまで きいて みよう。」）。
- 量: 段階0 30 以上、段階1 60、段階2 40（赤緑の組を除く）。
- 単数は「One apple.」（冠詞 a ではなく one で数を明示）。複数の s を正しく（six flowers、two stars、three dogs、four cars、five balls）。
- revealAudio: `[句]`。
- parentNote: 「『Three apples（りんご3こ）』のように、数と物を組み合わせた言い方を聞く遊びです。」

### 5.10 p5.en.shop おみせやさん（P1）

- 到達項目: `item`（「An apple, please.」）、`number`（「Two bananas, please.」）。
- 品物: 6章「たべもの」の 10 品（apple・banana・strawberry・bread・egg・carrot・tomato・peach・lemon・cake）。
- 段階0（4択）: 棚の品物から1つ。図なし、選択肢は品物の絵。
- 段階1（4択）: 数 1〜5。選択肢は「数ちがい・品物ちがい・両方ちがい」＋正解（`{ kind:'illust', id, count }`）。
- 段階2（4択）: まぜて。別例は「Can I have an apple, please?」（`canihave` の音声）。
- revealAudio: `[here-you-are, thank-you]`（「Here you are.」「Thank you!」）。解説「『はい どうぞ』『ありがとう』。おうちの ひとと やりとり して みよう。」
- 誤概念: `near-number`、`other-item`、`both`。
- 量: 段階0 10×3 以上（品物×誤りの組で 30）、段階1 50、段階2 30。
- parentNote: 「お店屋さんごっこの英語です。大人がお客さん（『An apple, please.』）、お子さんがお店の人（『Here you are.』）になって、画面の外でもやりとりしてみてください。」

### 5.11 p5.en.picture-book えいごの えほん（ながい）（P2。版 0.2 で詳細化）

ファイル `src/packs/en-pre/picture-book-p5.ts`（`export const p5PictureBook`、本の表は `export const BOOKS5`）。組み立ては p4 の picture-book.ts と同じ部品（`enKey('book', …)`・`pageOpt`）を使う。共通にしたい関数は picture-book.ts から export してよい（同じパックの中）。

- 単元: id `p5.en.picture-book`、title「ながい えいごの えほん」（2章の表の「えいごの えほん（ながい）」は説明の書き方。単元名にかっこを入れない）、stage `p5`、icon `p5-book`、priority `P2`、prereq `['p4.en.picture-book']`。
- intro: `intro(ill('p5-book'), 'えいごの おはなしを きいて、ページの えを えらぶ あそびだよ。')`。
- 本: 4冊 × 6ページ。すべて本アプリのオリジナル。1ページに絵1つと英文1つ。どの本も「同じ形のくり返し → 少しの変化 → おしまい」の形にし、6ページの順に意味の流れがある（あさの順・きせつの順・そだつ順・かずの順）ので、「さいしょ」「さいご」を考える手がかりになる。新しい絵は無い（既存の絵だけ）。

**本の全文**（key は `en/en-pre.book.<本>-<ページ>`。p4 の本の id（hello・yummy・jump・sky・beep・clap）と重ならない）

1. `morning`「あさの じゅんび」
   | ページ | 英文 | 絵 | 日本語（label） |
   |---|---|---|---|
   | 1 | Good morning, sun! | p23-sun | おひさま |
   | 2 | Brush, brush, brush! | p23-toothbrush | はみがき |
   | 3 | Wash, wash, wash! | p23-soap | てを あらう |
   | 4 | Yum, yum, yum! | bread | あさごはん |
   | 5 | Shoes on! | p23-shoe | くつ |
   | 6 | Hat on! Let's go! | p23-hat | ぼうし |
2. `seasons`「きせつ」
   | ページ | 英文 | 絵 | 日本語（label） |
   |---|---|---|---|
   | 1 | Hello, spring! | p4-spring | はる |
   | 2 | Hello, summer! | p4-summer | なつ |
   | 3 | Hello, fall! | p4-autumn | あき |
   | 4 | Hello, winter! | p4-winter | ふゆ |
   | 5 | A big snowman! | life-snowman | ゆきだるま |
   | 6 | Hello again, spring! | life-cherry | また はる |
3. `garden`「たね」
   | ページ | 英文 | 絵 | 日本語（label） |
   |---|---|---|---|
   | 1 | Here is a little seed. | life-seed | たね |
   | 2 | Water, please! | life-watering-can | みずを あげる |
   | 3 | Sunshine, please! | p23-sun | おひさま |
   | 4 | Look! A sprout! | life-sprout | めが でた |
   | 5 | Look! A bud! | life-bud | つぼみ |
   | 6 | Look! A flower! | flower | おはな |
4. `animals`「なんびき いるかな」
   | ページ | 英文 | 絵 | 日本語（label） |
   |---|---|---|---|
   | 1 | One frog. Ribbit, ribbit! | frog ×1 | かえる |
   | 2 | Two ducks. Quack, quack! | p23-duck ×2 | あひる |
   | 3 | Three birds. Tweet, tweet! | bird ×3 | とり |
   | 4 | Four cats. Meow, meow! | cat ×4 | ねこ |
   | 5 | Five dogs. Woof, woof! | dog ×5 | いぬ |
   | 6 | Hello, friends! | enpre-meet | みんな |

- 「×n」は `ill(id, n)`。同じ本の中で同じ絵を2回使わない（p23-sun は morning と garden で1回ずつ）。
- 秋は en-us の声に合わせて fall（調べた範囲では autumn・fall のどちらも正しい。小学校の教材で autumn を使うものもあるので、統括が en-g34 の語とそろえたいなら `Hello, autumn!` に替えてよい）。
- 似せない: 色＋動物を「〜が見える」でつなぐ有名な絵本、月や部屋の物に順におやすみを言う絵本、食べ物を曜日ごとに食べる絵本、ぼうしを探して動物にたずねる絵本、数えた動物が1匹ずついなくなる歌、の形にしていない（調べて確かめた範囲。7.6）。
- 動物の鳴き声（ribbit・quack・tweet・meow・woof）は日本語（けろけろ・があがあ・ぴよぴよ・にゃあ・わんわん）とのちがいに気づく材料（目標の「日本語との音の違いに気づく」）。解説では鳴き声を書かない（カタカナ・英字を増やさない）。

**問題**（すべて4択。帯の図（figure）は出さない: 6枚の帯は 1枚 9u ほどに縮み、4択の札と合わせると作業領域が窮屈になる。scenes エンジンは採らない（4章）。選択肢の4枚の絵がページの手がかりになる）

| 段階 | 到達項目 | 形 | 同一性キー | prompt | 音声（gapMs 900） | 選択肢（正解＋誤り3。すべて同じ本） | 件数 |
|---|---|---|---|---|---|---|---|
| 0 | heard | 1ページ（別例） | `page:<本>-<n>`（alt） | 「えいごを きいてね。どの ページかな？」 | `[page n, page n]` | 誤りは同じ本のほかのページから `mix` で3（`other-page`） | 24（4冊×6） |
| 1 | heard | お話の後 | `last:<本>-<n>`（n = 1〜5） | 「えいごの えほんを きこう。さいごに きこえた ページは どれ？」 | `[page1 … page6, page n]` | 6ページ目を必ず1つ（`story-end`）＋ほか2（`other-page`） | 20（4冊×5） |
| 2 | order | さいしょ | `first:<本>` | 「えいごの えほんを きこう。さいしょの ページは どれ？」 | `[page1 … page6]` | 6ページ目（`last-page`）＋2〜5ページから2（`middle-page`） | 4 |
| 2 | order | さいご | `end:<本>` | 「えいごの えほんを きこう。さいごの ページは どれ？」 | `[page1 … page6]` | 1ページ目（`first-page`）＋2〜5ページから2（`middle-page`） | 4 |
| 2 | order | にばんめ（別例） | `second:<本>`（alt） | 「えいごの えほんを きこう。にばんめの ページは どれ？」 | `[page1 … page6]` | 1ページ目（`first-page`）・3ページ目（`next-page`）・4〜6ページから1（`middle-page`。6なら `last-page`） | 4 |

  - id は同一性キーと同じ（同じキーを2つの段階に出さないので `:<段階>` は要らない）。
  - 合計 56問。異なる同一性キー 56。到達項目 heard: 練習 20・別例 24、order: 練習 8・別例 4 → C 2/2。Q = 56 ÷ 12 ≈ 4.7。
  - 段階1の音声は6ページ＋1で約 15〜20秒。5歳の1回5問のうちに長い問題が続かないよう、ふだんの出題の順（既存の UnitRunner）に任せる。長すぎると実機で感じたら、段階1を「4ページ目までで止めてから もう一度」に縮める案を統括に出す（11.3）。
- 単元の項目: objectives `[{ id: 'heard', title: 'きこえた ページを えらぶ' }, { id: 'order', title: 'さいしょと さいごの ページを えらぶ' }]`、levels `[{ label: 'ページを きく（4たく）', chance: 0.25 }, { label: 'おはなしの あとで（4たく）', chance: 0.25 }, { label: 'さいしょ・さいご（4たく）', chance: 0.25 }]`。
- revealAudio: `[正解のページの音声]`。
- 解説: heard・page「「<ページの日本語>」の ページだよ。」、first「さいしょは 「<日本語>」の ページだよ。」、end「さいごは 「<日本語>」の ページだよ。」、second「にばんめは 「<日本語>」の ページだよ。」。
- 誤概念（6）:
  - `other-page`: 「おなじ えほんの ちがう ページだね。もういちど きいて みよう。」
  - `story-end`: 「おはなしの さいごの ページだね。その あとに もういちど きこえたのは どれかな。」
  - `first-page`: 「さいしょの ページだね。もういちど きいて みよう。」
  - `last-page`: 「さいごの ページだね。さいしょは どれかな。」
  - `middle-page`: 「まんなかの ページだね。もういちど きいて みよう。」
  - `next-page`: 「ひとつ あとの ページだね。もういちど きいて みよう。」
- parentNote: 「6ページの短いお話です。同じお話を何度も聞くうちに、言葉や順番を覚えていきます。動物の鳴き声が日本語とちがうことなど、気づいたことを話してみてください。」
- 新しい英語の音声: 24本（`book.morning-1` 〜 `book.animals-6`）。試聴で気をつける語: Ribbit・Quack・Tweet・Meow・Woof・Yum（擬音語は誤読しやすい。7.6）。
- テスト（11.1 に追加）: 本の id が p4 の本と重ならない／同じ本で同じ絵を2回使わない／どの問題にも figure が無い／段階1の誤りに必ず6ページ目／ページの日本語にカタカナ・漢字が無い。

### 5.12 p5.en.first-sound おなじ おと（P2。版 0.2 で詳細化）

ファイル `src/packs/en-pre/first-sound.ts`（`export const p5FirstSound`）。語はすべて p4.en.words の既習語（vocab.ts）で、**新しい英語の音声・絵は無い**（`word.*` の音声と既存の絵だけ）。

- ねらい: 英語の語の「はじめの音」が同じ・ちがうに気づく（頭韻。5歳で判別ができる子が多い〔調査 1.4〕）。音素に分ける・文字と結ぶ（フォニックス）はしない。日本語の名前の はじめの音（くま・くるま）と英語の はじめの音（bear・car）がちがうことに気づく問題を入れる（目標「日本語との音の違いに気づく」）。
- 単元: id `p5.en.first-sound`、title「おなじ おと」、stage `p5`、icon `ball`、priority `P2`、prereq `['p4.en.words']`。
- intro: `intro(ill('ball'), 'えいごの ことばの はじめの おとを くらべる あそびだよ。')`。
- 選択肢は**3**（5歳の上限4より少なくする: 音を比べる負担が大きいため。11.1-7 の検査に例外を足す）。
- 到達項目（3。どれも語の組で分ける）:
  - `b-sound` 「ボールと おなじ おとで はじまる ことば」: bear・bird・banana・bread・bus・bike・ball・book（8）
  - `k-sound` 「くるまと おなじ おとで はじまる ことば」: cat・cow・carrot・cake・car・cup（6）。※ vocab.ts の `start: 'k'` に cup が無いが、cup も /k/ で始まる。この単元は下の表を正とし、vocab の `start` は使わない（p4.en.words の same-start の組は変えなくてよい）。
  - `other-sound` 「いろいろな おとで はじまる ことば」: hat・head・hands（/h/）、tomato・turtle・toes（/t/）、ship・shoe（/ʃ/）、dog・duck（/d/）、pig・peach（/p/）、monkey・mouth（/m/）（14）
- 段階（levels）: `[{ label: 'なまえを きいて くらべる（3たく）', chance: 1/3 }, { label: 'なまえを おもいだして（3たく）', chance: 1/3 }]`。
- 問題の形:
  | 段階 | 形 | 同一性キー | prompt | figure | 音声 | 選択肢 |
  |---|---|---|---|---|---|---|
  | 0 | おなじ（なまえつき） | `same:<目当て>` | 「えいごを きいてね。さいしょの ことばと おなじ おとで はじまるのは どれ？」 | 目当ての絵 | `[目当て, 選択肢1, 選択肢2, 選択肢3]`（gapMs 900。選択肢は**画面の並び順**に鳴らす） | 3: 正解＋遠い語2（`other-sound`） |
  | 0 | ひとつ ちがう（別例） | `odd:<組>-<ちがう語>`（alt） | 「えいごを きいてね。ひとつだけ ちがう おとで はじまるのは どれ？」 | なし | `[選択肢1, 選択肢2, 選択肢3]`（gapMs 900。並び順に） | 3: ちがう語（正解）＋同じ音の2語（`same-pair`） |
  | 1 | おなじ（なまえなし） | `same:<目当て>`（id `same:<目当て>:1`） | 「えいごを きいてね。おなじ おとで はじまるのは どれ？」 | 目当ての絵 | `twice(目当て)`（gapMs 700） | 3: 正解＋わな1（下の表の誤概念）＋遠い語1（`other-sound`） |
  - 並び順に鳴らすため、`lib.ts` の `ListenSpec` に `keepOrder?: boolean` を足す（true なら `listen()` は options を混ぜない）。単元の側で `mix(id, options)` してから、その順で音声を作る。
  - 目当ての絵を figure に出す（何の語を聞いたかが分かる。段階1は名前を言わないので、子は絵から英語の名前を思い出す）。
- 正解（同じ音の相手）と段階1のわな（全件）:
  | 目当て | 正解 | 段階1のわな | わなの誤概念 | わなの理由 |
  |---|---|---|---|---|
  | bear | bus | car | `ja-start` | くま／くるま（日本語は同じ「く」） |
  | bird | book | tomato | `ja-start` | とり／トマト |
  | banana | ball | peach | `near-sound` | b と p は口の形が同じ |
  | bread | bike | head | `same-end` | bread／head は おわりが同じ |
  | bus | bear | pig | `near-sound` | b／p |
  | bike | banana | train | `same-group` | どちらも のりもの |
  | ball | bird | hat | `ja-start` | ボール／ぼうし |
  | book | bread | star | `ja-start` | ほん／ほし |
  | cat | cup | hat | `same-end` | cat／hat |
  | cow | cake | rabbit | `ja-start` | うし／うさぎ |
  | carrot | car | tomato | `same-group` | どちらも たべもの |
  | cake | cow | strawberry | `same-group` | どちらも たべもの |
  | car | cat | star | `same-end` | car／star |
  | cup | carrot | book | `same-group` | どちらも もの |
  | hat | hands | ball | `ja-start` | ぼうし／ボール |
  | head | hat | duck | `ja-start` | あたま／あひる |
  | hands | head | nose | `same-group` | どちらも からだ |
  | tomato | turtle | bird | `ja-start` | トマト／とり |
  | turtle | toes | umbrella | `ja-start` | かめ／かさ |
  | toes | tomato | nose | `same-end` | toes／nose |
  | ship | shoe | star | `near-sound` | sh と s |
  | shoe | ship | car | `ja-start` | くつ／くるま |
  | dog | duck | strawberry | `ja-start` | いぬ／いちご |
  | duck | dog | head | `ja-start` | あひる／あたま |
  | pig | peach | bus | `near-sound` | p／b |
  | peach | pig | banana | `near-sound` | p／b |
  | monkey | mouth | nose | `near-sound` | m と n |
  | mouth | monkey | bear | `ja-start` | くち／くま |
  - 正解の相手は「目当てと同じ到達項目の中の別の語」。同じ語が別の目当ての正解にもなる（組は同じとみなさない: 目当ての語がちがえば別の問題）。
- 遠い語（`other-sound`）: `FAR = [apple, egg, elephant, umbrella, airplane, lemon, rabbit, frog, train]` から、次を除いて `mix(id)` の順で取る: 目当てと同じ なかま（group）の語、その問題のわな、目当てが cow なら rabbit（うし／うさぎ）、turtle なら umbrella・frog（かめ／かさ・かえる）、目当てが /t/・/d/ の語（tomato・turtle・toes・dog・duck）なら train（/tɹ/ が近い）。
- 別例（ひとつ ちがう）の全件（12。選択肢の並びは `mix`、正解は「ちがう語」）:
  | 到達項目 | 同じ音の2語 | ちがう語 |
  |---|---|---|
  | b-sound | bear・ball | cat |
  | b-sound | bus・book | egg |
  | b-sound | banana・bird | lemon |
  | b-sound | bike・bread | frog |
  | k-sound | cat・cake | dog |
  | k-sound | car・cup | ship |
  | k-sound | cow・carrot | train |
  | other-sound | hat・head | apple |
  | other-sound | toes・turtle | monkey |
  | other-sound | pig・peach | duck |
  | other-sound | ship・shoe | cake |
  | other-sound | dog・duck | umbrella |
  - 同一性キー例 `odd:bear-ball-cat`。
- 量: 問題 68（段階0 28＋別例 12、段階1 28）。異なる同一性キー 40。到達項目 b-sound 8＋別例 4、k-sound 6＋別例 3、other-sound 14＋別例 5 → C 3/3。Q = 40 ÷ 12 ≈ 3.3。
- hints（この単元では②を替える。どちらも答えを言わない）: 「もういちど よく きいてね。」「おうちの ひとと いっしょに、はじめの おとを ゆっくり いって みよう。」
- revealAudio: おなじ `[目当て, 正解]`（2語を続けて聞き、同じ はじめの音を確かめる）、ひとつ ちがう `[同じ音の語1, 同じ音の語2, ちがう語]`。
- 解説: おなじ「「<目当ての日本語>」と 「<正解の日本語>」は、えいごでは おなじ おとで はじまるよ。」、ひとつ ちがう「「<ちがう語の日本語>」だけ、えいごでは はじまりの おとが ちがうよ。」。日本語の名前は vocab の `ja`。
- 誤概念（6）:
  - `other-sound`: 「ちがう おとで はじまる ことばだね。もういちど きいて みよう。」
  - `ja-start`: 「にほんごの なまえは にて いるけど、えいごでは はじまりの おとが ちがうね。もういちど きいて みよう。」
  - `same-end`: 「おわりの おとが おなじ ことばだね。はじめの おとを きいて みよう。」
  - `near-sound`: 「にて いる おとだね。くちの かたちを まねして みよう。」
  - `same-group`: 「おなじ なかまの ことばだね。はじめの おとを くらべて みよう。」
  - `same-pair`: 「この ことばは、ほかの ひとつと おなじ おとで はじまるね。のこりの ひとつは どれかな。」
- parentNote: 「英語の言葉の『はじめの音』をくらべる遊びです。『bear（くま）』と『car（くるま）』のように、日本語では似ていても英語ではちがう音で始まることがあります。文字は使いません。」
- 4歳には出さない（5歳の札だけ。8.3 の p5 の札に足す: 下の 8.3 の追記）。
- テスト（11.1 に追加）: おなじ の正解が目当てと同じ到達項目の語／遠い語が目当てと同じ はじめの音でない（上の表の音で照らす）／段階0の音声の2〜4番目の key が選択肢の並び順の sound と一致／選択肢が3。

### 5.13 p5.en.abc えいごの もじ（P2。既定で隠す。版 0.2 で詳細化）

ファイル `src/packs/en-pre/abc.ts`（`export const p5Abc`）。**幼児の画面に英字を出す唯一の単元**。保護者が「はじめは かくれている単元」で開いたときだけ子供に見える。

- ねらい: 大文字を見て、文字の名前（エー・ビー…の英語の言い方）を聞いて分かる（小3の外国語活動「文字の読み方が発音されるのを聞いて、どの文字か分かる」の前段階〔調査 1.7〕）。文字が表す音（フォニックス）・小文字・書く練習はしない。
- 単元: id `p5.en.abc`、title「えいごの もじ」、stage `p5`、icon `enpre-blocks`（新・P2: つみき3つ。面には ○・△・□ の形だけで、文字を描かない）、priority `P2`、prereq `[]`、**`hiddenByDefault: true`**、**kind `knowledge`**（curriculum-matrix の「知 項26」に合わせる。`preUnit` に省略可の `kind` を足す。量の基準は 30）。
- intro: `[{ text: 'えいごの もじの なまえを きいて、もじを えらぶ あそびだよ。', figure: { kind: 'text', text: 'A', size: 'xl' } }, { text: 'おうちの ひとと いっしょに、まねして いって みよう。', figure: ill('enpre-icon') }]`。
- 選択肢: `{ figure: { kind: 'text', text: '<大文字>', size: 'xl' }, sound: <文字の名前の音声>, correct?/misconception? }`。**label は付けない**（英字もカタカナの読み（エー・ビー）も書かない。カタカナの読みは英語の名前とずれる字がある: V・Z など）。`opt()` は label 必須なので、ChoiceOption を直接書く（読み上げの名前は既存どおり「1ばん」「2ばん」…）。
- 文字の名前の音声: key `en/en-pre.abc.<小文字>`、台本の text は `'B.'` の形（大文字＋句点）、**PRONOUNCE に phonemes を必ず書く**（7.3。下の表の強勢つき）。音声は `twice(letter)`。
- 到達項目（3）: `first` 「はじめの ほうの もじ」（A〜I の9）、`middle` 「まんなかの もじ」（J〜R の9）、`last` 「おわりの ほうの もじ」（S〜Z の8）。
- 段階（levels）: `[{ label: 'もじ（3たく）', chance: 1/3 }, { label: 'にた もじも（4たく）', chance: 0.25 }]`。
- 問題（prompt「えいごを きいてね。どの もじかな？」、hints `HINTS`）:
  | 段階 | 形 | 同一性キー | 音声 | 選択肢 | 件数 |
  |---|---|---|---|---|---|
  | 0 | 文字の名前 | `abc:<x>` | `twice(letter)` | 3: 正解＋遠い字2（`other-letter`） | 26 |
  | 0 | 別例「Find the letter B.」 | `find:<x>`（alt） | `[find]` | 3: 同上（`mix` の種を変える: `${id}:w`） | 26 |
  | 1 | 文字の名前 | `abc:<x>`（id `abc:<x>:1`） | `twice(letter)` | 4: 正解＋下の表の3 | 26 |
  - 遠い字: 下の「音のなかま」が同じでなく、「形の組」にも入らない字から `mix` の順で2つ。
  - 音のなかま（文字の名前の母音）: いー〔B C D E G P T V Z〕、えい〔A H J K〕、えー〔F L M N S X〕、あい〔I Y〕、ゆー〔Q U W〕、おう〔O〕、あー〔R〕。
  - 形の組: B-P・B-R・B-D・P-R・C-G・C-O・D-O・O-Q・G-Q・E-F・E-B・I-L・I-T・I-J・J-L・K-X・K-R・M-N・M-W・N-H・N-Z・U-V・V-W・V-Y・X-Y・S-Z・A-H。
  - 量: 問題 78。異なる同一性キー 52（各文字に2問: 1.3 の「知 1項目2問以上」）。到達項目 first 9＋別例 9、middle 9＋別例 9、last 8＋別例 8 → C 3/3。Q = 52 ÷ 30 ≈ 1.7。
- 段階1の誤り（全件。誤概念 `shape`＝形が似る、`sound`＝名前の音が似る、`other-letter`）:
  | 字 | 誤り1 | 誤り2 | 誤り3 |
  |---|---|---|---|
  | A | H（sound） | K（sound） | R（other-letter） |
  | B | P（shape） | D（sound） | V（sound） |
  | C | G（shape） | O（shape） | Z（sound） |
  | D | B（sound） | O（shape） | T（sound） |
  | E | F（shape） | B（sound） | T（sound） |
  | F | E（shape） | S（sound） | X（sound） |
  | G | C（shape） | Z（sound） | J（sound） |
  | H | N（shape） | A（sound） | K（sound） |
  | I | L（shape） | T（shape） | Y（sound） |
  | J | L（shape） | G（sound） | K（sound） |
  | K | X（shape） | A（sound） | Q（sound） |
  | L | J（shape） | M（sound） | N（sound） |
  | M | N（sound） | W（shape） | L（sound） |
  | N | M（sound） | H（shape） | Z（shape） |
  | O | Q（shape） | C（shape） | D（shape） |
  | P | R（shape） | B（sound） | T（sound） |
  | Q | O（shape） | G（shape） | U（sound） |
  | R | P（shape） | K（shape） | L（other-letter） |
  | S | F（sound） | X（sound） | Z（shape） |
  | T | I（shape） | D（sound） | P（sound） |
  | U | V（shape） | Q（sound） | W（sound） |
  | V | B（sound） | U（shape） | Y（shape） |
  | W | M（shape） | V（shape） | U（sound） |
  | X | K（shape） | Y（shape） | S（sound） |
  | Y | V（shape） | X（shape） | I（sound） |
  | Z | N（shape） | G（sound） | C（sound） |
  - 形も音も似る字（B と P、M と N など）は、日本の子が取り違えやすい方に寄せて1つに決めた（表のとおり）。
  - R と L: 日本語の話者には r・l の聞き分けが難しいが、文字の名前（ɑːɹ と ɛl）は母音から大きくちがうので sound にしない（other-letter）。
  - V と B: 名前（viː と biː）のちがいは日本語に無い音なので sound。
- 文字の名前の IPA（7.3 を強勢つきに改める。phonemes にそのまま書く）:
  A ˈeɪ、B bˈiː、C sˈiː、D dˈiː、E ˈiː、F ˈɛf、G dʒˈiː、H ˈeɪtʃ、I ˈaɪ、J dʒˈeɪ、K kˈeɪ、L ˈɛl、M ˈɛm、N ˈɛn、O ˈoʊ、P pˈiː、Q kjˈuː、R ˈɑːɹ、S ˈɛs、T tˈiː、U jˈuː、V vˈiː、W dˈʌbəljˌuː、X ˈɛks、Y wˈaɪ、Z zˈiː。
  - 別例の文: text `Find the letter B.`、phonemes `fˈaɪnd ðə lˈɛɾɚ ` ＋ 上の字の IPA ＋ `.`（例 `fˈaɪnd ðə lˈɛɾɚ bˈiː.`）。文の中でも A が冠詞 /ə/ と読まれないよう、文全体を phonemes で固定する。key `en/en-pre.find.find-the-letter-b`。
  - PRONOUNCE の 52 件は表から作る（`for (const L of LETTERS) { PRONOUNCE['en-pre.abc.' + l] = { phonemes: IPA[L] }; … }`）。
  - 注意（試聴で決める）: 生成スクリプトは phonemes を `is_phonemes=True` でそのまま Kokoro に渡す。Kokoro の学習時の音素（misaki）は二重母音を1字で書く（eɪ→A、aɪ→I、oʊ→O、dʒ→ʤ、tʃ→ʧ）。上の espeak 風の書き方で崩れる字があれば、その字だけ misaki の書き方（例 A `ˈA`、G `ʤˈiː`、H `ˈAʧ`）で試し、良い方を listening.md に残す。
- revealAudio: `[{ text: 'いっしょに いって みよう。' }, letter, letter]`。
- 解説: 「この もじの なまえだよ。いっしょに いって みよう。」＋ `explainFigure: { kind: 'text', text: '<大文字>', size: 'xl' }`（解説の文に字の名前を書かない。図で字を見せ、音声で名前を聞かせる）。
- 誤概念（3）:
  - `shape`: 「かたちが にて いる もじだね。もういちど きいて みよう。」
  - `sound`: 「なまえの おとが にて いる もじだね。さいごまで よく きいて みよう。」
  - `other-letter`: 「ちがう もじだったね。もういちど きいて みよう。」
- 文字の見た目: Zen Maru Gothic 700（DESINGN 4章への追記 10.1-1）、`size: 'xl'`。小文字・筆順・書き方は出さない。
- parentNote: 「英語の大文字と、その名前（エー、ビー…）を聞いて選ぶ遊びです。小学3年の英語で、文字の名前を聞いて分かることを学びます。その前の親しみとして、興味があるときだけ開いてください。文字の音（フォニックス）や書く練習はしません。」
- 新しい英語の音声: abc 26・find 26。
- テスト（11.1 に追加）: hiddenByDefault が true／kind が knowledge／選択肢に label が無く figure が `kind: 'text'` の大文字1字／段階0の遠い字が音のなかま・形の組に入らない／段階1の誤りが表のとおり／PRONOUNCE に abc・find の 52 件がある／この単元の外に `kind: 'text'` の英字の図が無い。

---

## 6. 語彙（全件）

- 「絵」は src/illust の ID。**新**は en-pre が描く新しい絵（7.5）。
- 「日本語」は解説・保護者画面に出す名前（絵の `label` と同じにする。カタカナは物の名前だけ）。
- 「台本の英文」は script-en.json の text（7章の書き方の規則）。
- ◆ = `same-start` の組に使う語（はじめの音が同じ）。

### 6.1 どうぶつ（p23 L2 から）

| 英語 | 台本の英文 | 日本語 | 絵 | 使う単元 |
|---|---|---|---|---|
| dog | Dog. | いぬ | dog | p23・p4・p5 words、book、phrases |
| cat ◆ | Cat. | ねこ | cat | words、book、where(P2) |
| rabbit | Rabbit. | うさぎ | rabbit | words、book |
| bear ◆ | Bear. | くま | bear | words |
| elephant | Elephant. | ぞう | elephant | words |
| monkey | Monkey. | さる | monkey | words、book |
| bird ◆ | Bird. | とり | bird | words、book、いろ（あおの代表） |
| frog | Frog. | かえる | frog | words（p4 から）、book |
| pig | Pig. | ぶた | p23-pig | words（p4 から） |
| cow ◆ | Cow. | うし | cow | words（p4 から） |
| duck | Duck. | あひる | p23-duck | words（p4 から） |
| turtle | Turtle. | かめ | turtle | words（p4 から） |

- p23（L2・L3）の 6語: dog・cat・rabbit・bear・elephant・monkey。残りは p4 から。

### 6.2 たべもの（p23 L2 から）

| 英語 | 台本の英文 | 日本語 | 絵 | 使う単元 |
|---|---|---|---|---|
| apple | Apple. | りんご | apple | words、book、かず、phrases、shop |
| banana ◆ | Banana. | バナナ | banana | words、book、いろ（きいろの代表）、shop |
| strawberry | Strawberry. | いちご | strawberry | words、book、shop |
| bread ◆ | Bread. | パン | bread | words、shop |
| egg | Egg. | たまご | egg | words、いろ（しろの代表）、shop |
| carrot ◆ | Carrot. | にんじん | carrot | words、shop |
| tomato | Tomato. | トマト | tomato | words（p4 から）、いろ（あかの代表）、shop |
| peach | Peach. | もも | peach | words（p4 から）、いろ（ピンクの代表）、shop |
| lemon | Lemon. | レモン | lemon | words（p4 から）、shop |
| cake ◆ | Cake. | ケーキ | p5-cake | words（p4 から）、shop |

- p23（L2・L3）の 6語: apple・banana・strawberry・bread・egg・carrot。残りは p4 から。
- 語の数の合計: どうぶつ12・たべもの10・のりもの もの14・からだ6＝p4.en.words は 42語。
- shop の台本は別に「An apple, please.」「A banana, please.」…と数の形（7.4）。

### 6.3 のりもの・もの（p23 L3 から）

| 英語 | 台本の英文 | 日本語 | 絵 |
|---|---|---|---|
| car ◆ | Car. | くるま | car-red |
| bus ◆ | Bus. | バス | bus-yellow |
| train | Train. | でんしゃ | train |
| airplane | Airplane. | ひこうき | airplane |
| ship | Ship. | ふね | ship |
| bike ◆ | Bike. | じてんしゃ | bicycle |
| ball ◆ | Ball. | ボール | ball |
| flower | Flower. | はな（くさばな） | flower |
| hat | Hat. | ぼうし | p23-hat |
| shoe | Shoe. | くつ | p23-shoe |
| book ◆ | Book. | ほん | p23-book |
| cup | Cup. | コップ | p23-cup |
| umbrella | Umbrella. | かさ | umbrella |
| star | Star. | ほし | p23-star |

- p23 L3 で足すのは car・bus・train・airplane・ball・flower・hat・shoe・book・cup・star・ship のうち、のりもの6（car・bus・train・airplane・ship・bike）・もの6（ball・flower・hat・shoe・book・cup）。umbrella・star は p4 から。
- `same-start` の組（例）: bear/bird、bus/banana/bike/ball/book/bread、car/cat/cake/carrot/cow。1問に1つまで。

### 6.4 からだ（p4 から。move の touch と共通）

| 英語 | words の台本 | move の台本 | 日本語 | 絵 |
|---|---|---|---|---|
| nose | Nose. | Touch your nose. | はな（かお） | 新 enpre-touch-nose |
| head | Head. | Touch your head. | あたま | 新 enpre-touch-head |
| ears | Ears. | Touch your ears. | みみ | 新 enpre-touch-ears |
| mouth | Mouth. | Touch your mouth. | くち | 新 enpre-touch-mouth |
| toes | Toes. | Touch your toes. | あしの ゆび | 新 enpre-touch-toes |
| hands | Hands. | （clap と共通にしない。words のみ） | て | 新 enpre-touch-hands（うさぎが両手を前に出す） |
| tummy（版 0.2） | （words に入れない） | Touch your tummy. | おなか | 新 enpre-touch-tummy |
| knees（版 0.2） | （words に入れない） | Touch your knees. | ひざ | 新 enpre-touch-knees |
| shoulders（版 0.2） | （words に入れない） | Touch your shoulders. | かた | 新 enpre-touch-shoulders |

- 目に触れる動き（Touch your eyes）は安全のため使わない。
- move の別例（lets）は複数形: Let's touch our noses / heads / ears / mouths / toes / tummies / knees / shoulders.（5.5・7.6）
- 表は vocab.ts の `TOUCH_PARTS`（move・p23 move が使う）。words の `BODY` は今の6語のまま。

### 6.5 うごき（move）

| 英語 | 台本（cmd） | 台本（lets。別例） | 解説の日本語 | 絵（新） | 似た動き（similar-move） |
|---|---|---|---|---|---|
| jump | Jump! | Let's jump! | ぴょんと とぶ | enpre-act-jump | stomp |
| clap | Clap your hands! | Let's clap! | てを たたく | enpre-act-clap | wave |
| stand | Stand up! | Let's stand up! | たつ | enpre-act-stand | sit |
| sit | Sit down! | Let's sit down! | すわる | enpre-act-sit | stand |
| turn | Turn around! | Let's turn around! | くるっと まわる | enpre-act-turn | − |
| stomp | Stomp your feet! | Let's stomp! | あしで どんどん | enpre-act-stomp | jump |
| wave | Wave your hand! | Let's wave! | てを ふる | enpre-act-wave | clap |
| hands-up | Hands up! | Let's put our hands up! | てを うえに あげる | enpre-act-handsup | − |

### 6.6 いろ（p4 から）

| 英語 | 台本 | 日本語 | ボールの絵（新） | 代表の物の絵 |
|---|---|---|---|---|
| red | Red. | あか | enpre-ball-red | tomato |
| blue | Blue. | あお | enpre-ball-blue | bird |
| yellow | Yellow. | きいろ | enpre-ball-yellow | banana |
| green | Green. | みどり | enpre-ball-green | frog |
| pink ◆ | Pink. | ピンク | enpre-ball-pink | peach |
| orange | Orange. | オレンジ | enpre-ball-orange | mikan |
| purple ◆ | Purple. | むらさき | enpre-ball-purple | eggplant |
| white | White. | しろ | enpre-ball-white | egg |

- 赤（red）と緑（green）を同じ問題に出さない。
- キャリア（別例）: 「It's red.」…（`itis` の音声）。

### 6.7 かず

| 数 | 台本 | 使う単元 |
|---|---|---|
| 1〜5 | One. Two. Three. Four. Five. | p4 colors-numbers（1語を2回） |
| 1〜10 | One. … Ten. | p5 phrases（句の中） |

- 句（p5 phrases）: 「One apple.」「Two apples.」…「Ten apples.」、ball(s)・flower(s)・star(s)・car(s)・dog(s)。「Two blue balls.」…（1〜5 × 8色）。
- 台本では数字を使わず単語で書く（"6" ではなく "six"）。

### 6.8 あいさつ・きもち（p4.en.hello）

| 台本 | 日本語（解説） | 絵 |
|---|---|---|
| Hello! | こんにちは | 新 enpre-meet（2ひきが向かい合って手をあげる） |
| Good morning! | おはよう | p23-sun |
| Good night! | おやすみ | p5-moon |
| Thank you! | ありがとう | 新 enpre-gift（プレゼントの箱。文字なし） |
| Bye-bye! | ばいばい | 新 enpre-bye（ふり返って手をふる） |
| I'm happy! | うれしい | eng34-face-happy |
| I'm sad. | かなしい | eng34-face-sad |
| I'm sleepy. | ねむい | eng34-face-sleepy |
| I'm hungry! | おなかが すいた | eng34-face-hungry |
| Hello, rabbit! など（別例） | こんにちは、うさぎさん | enpre-meet |
| I'm sorry.（版 0.2） | ごめんね | 新 enpre-sorry |
| Happy birthday!（版 0.2） | おたんじょうび おめでとう | 新 enpre-birthday |
| I'm angry.（版 0.2） | おこった | eng34-face-angry |
| I'm thirsty.（版 0.2） | のどが かわいた | eng34-face-thirsty |
| I'm hot.（版 0.2） | あつい | eng34-face-hot |
| I'm cold.（版 0.2） | さむい | eng34-face-cold |

### 6.9 おみせ（p5.en.shop）

- 「An apple, please.」「A banana, please.」「A strawberry, please.」「Some bread, please.」（bread は数えない。数の問題に使わない）、「An egg, please.」「A carrot, please.」「A tomato, please.」「A peach, please.」「A lemon, please.」「A cake, please.」
- 数: 「Two apples, please.」… 1〜5（bread を除く 9品。複数形 strawberries・peaches・tomatoes に注意）。
- 別例: 「Can I have an apple, please?」（10品）。
- 返し: 「Here you are.」「Thank you!」

### 6.10 えほん（p4.en.picture-book。すべて本アプリのオリジナル）

| 本（id・日本語の題） | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| hello「こんにちは」 | Hello, dog!（dog） | Hello, cat!（cat） | Hello, bird!（bird） | Hello, everyone!（enpre-meet） |
| yummy「おいしい」 | An apple. Yummy!（apple） | A banana. Yummy!（banana） | A strawberry. Yummy!（strawberry） | I'm full!（eng34-face-happy） |
| jump「ぴょん」 | Jump, frog!（frog） | Jump, rabbit!（rabbit） | Jump, monkey!（monkey） | Jump, jump, jump!（enpre-act-jump） |
| sky「おそら」（版 0.2: 実装に合わせて 0.1 の stars を改めた） | A little star.（p23-star） | A big moon.（p5-moon） | A warm sun.（p23-sun） | Good night!（eng34-face-sleepy） |
| beep「ぶっぶー」 | A red car. Beep, beep!（car-red） | A yellow bus. Beep, beep!（bus-yellow） | A big ship. Toot, toot!（ship） | Bye-bye!（enpre-bye） |
| clap「てを たたこう」 | Clap your hands!（enpre-act-clap） | Stomp your feet!（enpre-act-stomp） | Turn around!（enpre-act-turn） | Sit down!（enpre-act-sit） |

- 有名な絵本の題・決まり文句（例: 色の名前をたずねる動物のくり返しの絵本、月におやすみを言う絵本）に似せない。上の文はどれも短い一般的な言い方。
- ページの絵の「×n」は `{ kind:'illust', id, count:n }`。

### 6.11 新しい絵の一覧（`src/illust/content/en-pre.tsx`、`export const enPreIllust: IllustGroup`）

| ID | 内容 | 優 |
|---|---|---|
| enpre-icon | 札の絵: 白い吹き出しの中に、手をふる手（文字・アルファベットを描かない） | P1 |
| enpre-act-jump / -clap / -stand / -sit / -turn / -stomp / -wave / -handsup | うさぎ（既存の rabbit と同じ顔・色）がその動きをしている全身の絵。動きは線（短い弧）で示す。8枚 | P1 |
| enpre-touch-nose / -head / -ears / -mouth / -toes / -hands | うさぎがその部分を手でさわっている絵。さわっている部分の後ろに `sun` の丸（目立たせる。色だけに頼らず丸の形で） | P1 |
| enpre-ball-red / -blue / -yellow / -green / -pink / -orange / -purple / -white | ボールの絵を1つの関数で色だけ変えて作る（`P.red`・`P.blue`・`P.yellow`・`P.green`・`P.pink`・`P.orange`・`P.purple`・`P.white`。白は ink の輪郭がはっきり見えること）。8枚 | P1 |
| enpre-meet | うさぎとくまが向かい合って片手をあげる | P1 |
| enpre-bye | うさぎがふり返って手をふる（遠ざかる足あと） | P1 |
| enpre-gift | リボンのついた箱を両手でさし出す手 | P1 |
| enpre-touch-tummy / -knees / -shoulders（版 0.2） | 既存の enpre-touch-* と同じ形（うさぎがその部分を両手でさわる。部分の後ろに sun の丸）。knees は すこし かがんで両ひざ、shoulders は両手を両肩に | P1 |
| enpre-sorry（版 0.2） | うさぎが たおれた コップの そばで ぺこりと あたまを さげる。くまが みている | P1 |
| enpre-birthday（版 0.2） | ろうそくを たてた ケーキの まえで、とんがりぼうしの くまが わらう（プレゼントの はこ・文字・数字は描かない） | P1 |
| enpre-where-cat-in / -on / -under、enpre-where-dog-*、enpre-where-rabbit-*（版 0.2。0.1 の enpre-cat-in などを改める） | 同じベッド（木の枠・脚4本・白い ふとん・まくら）と動物の位置（5.8）。9枚 | P2 |
| enpre-blocks（版 0.2） | つみき3つ（面に ○・△・□。文字を描かない）。p5.en.abc の icon | P2 |

- 画風は DESINGN 6章（輪郭 ink・太さ 3.5・平塗り・palette の色だけ・文字なし・`status: 'final'`）。`check:design` のイラストの検査に通すこと。
- registry は content を自動で読み込む。パックのテストでは en-g34 と同じく、モジュールから直接 ID の存在を確かめる（`enPreIllust`）。

---

## 7. 英語の音声の台本と生成（Kokoro の改善策を反映）

### 7.1 key と台本の作り方

- key: `en/en-pre.<種類>.<スラッグ>`（listen の `ListenSound.key`）。台本の key は先頭の `en/` を除いた `en-pre.<種類>.<スラッグ>`。mp3 は `public/audio/en/en-pre.<種類>.<スラッグ>.mp3`。
- 種類: `word`（1語）、`it`（It's a 〜.）、`where`（Where is the 〜?）、`cmd`（動きの合図）、`lets`（Let's 〜!）、`touch`（Touch your 〜.）、`color`、`itis`（It's red.）、`num`（One. …）、`np`（Three apples.）、`hello`、`feel`、`book`（`book.<本>-<ページ>`）、`shop`、`reply`（Here you are. / Thank you!）、`abc`（P2）、`pos`（P2 where の文・答え）、`find`（P2 abc の別例 Find the letter B.）。p5 の本も種類は `book`（本の id で p4 と分ける）。
- `src/packs/en-pre/lib.ts` の `en(cat, text)` は en-g34 と同じ（スラッグは `slugOf`）。
- `src/packs/en-pre/voice.ts` の `englishScript(pack)` は en-g34 と同じく問題データ（audio・options の sound・revealAudio）から英語の音声を集める（`key` が `en/` で始まるものだけ。日本語の文は除く）。**options の sound と revealAudio も拾う**（walk が再帰で拾うので en-g34 の walk をそのまま使えばよい）。
- 発音の上書きは問題データに入れず、パックの表 `src/packs/en-pre/pronounce.ts` に置く:
  ```ts
  /** 台本の key（en/ を除く）→ 生成の上書き。試聴で直したものだけ書く */
  export const PRONOUNCE: Record<string, { say?: string; phonemes?: string; speed?: number }> = {
    // 例: 'en-pre.word.toes': { say: 'Toes.' },
  };
  ```
  `englishScript` は entries に `PRONOUNCE[key]` を混ぜて返す（`{ key, text, say?, phonemes?, speed? }`）。テストで「PRONOUNCE の key がすべて台本にある」ことを確かめる。
- `src/packs/en-pre/script-en.json` は `englishScript` の出力（テストで一致を確かめる。en-g34 と同じ）。冒頭の `defaults` は en-g34 と同じ（`speed 0.85`・`voice af_heart`・`lang en-us`）。
- **`voice/script-en.json`（生成スクリプトが読む台本）へは、en-g34・en-g56・en-pre の entries を key の昇順で合わせて書く**。en-pre だけの台本で `generate_en.py` を走らせない（manifest にないキーの mp3 を消すため、en-g34・en-g56 の音声が消える）。

### 7.2 書き方の規則（単語1語に弱い点への対策）

1. 単語は**先頭を大文字にして句点**を付ける（`Dog.`）。感嘆の合図は `!`（`Jump!`）。
2. 数は単語で書く（`six`）。数字・時刻・序数の表記は台本に入れない。
3. 同じ語を2回聞かせるのは**同じ mp3 を2回鳴らす**（listen の audio に同じ key を2つ、間 700ms）。「Dog. Dog.」の1本は作らない（2回目の抑揚が変わるため）。
4. キャリア文（It's a dog. / Where is the dog? / Let's jump!）は文のまま使う。単語の切り出しはしない。
5. 話速: 基準 0.85 × 倍率 1.0（実効 0.85）。文（7語以上）は倍率 0.95 まで。**0.7 未満にしない**。ゆっくりは「2回・間」で作る。
6. 声: af_heart に統一。男声は使わない。

### 7.3 文字の名前（p5.en.abc。P2。en-g34 の聞き直しにも使う）

`PRONOUNCE` に IPA で書く（espeak-ng 風の IPA。生成スクリプトの `phonemes`）: A eɪ、B biː、C siː、D diː、E iː、F ɛf、G dʒiː、H eɪtʃ、I aɪ、J dʒeɪ、K keɪ、L ɛl、M ɛm、N ɛn、O oʊ、P piː、Q kjuː、R ɑːɹ、S ɛs、T tiː、U juː、V viː、W dʌbəljuː、X ɛks、Y waɪ、Z ziː。
（en-g34 の `abc.*` は text が "A" などのまま。冠詞 /ə/ と読まれていないかを試聴で確かめ、問題があれば en-g34 にも同じ上書きを提案する。en-g34 の変更は別の作業）
版 0.2: phonemes に書くのは 5.13 の**強勢つき**の形（例 B `bˈiː`）。別例の文「Find the letter B.」も文全体を phonemes で固定する（5.13）。

### 7.4 生成と試聴の手順

1. `npx vitest run src/packs/en-pre`（台本と script-en.json の一致）。
2. `voice/script-en.json` に合わせて書く（7.1）。
3. `.\scripts\voice\build_en.ps1 --dry-run` で生成数を確かめてから、`.\scripts\voice\build_en.ps1`。
4. `python scripts\voice\verify.py --dir public\audio\en`（長さ・無音・音量）。
5. **全件を試聴**（約 250 本の見込み）し、`docs/expansion/reviews/en-pre-listening.md` に表で記録する: key・英文・判定（OK／前後に余計な母音／抑揚／誤読／速すぎ）・直し方（say・phonemes・speed）・直した後の判定。
6. 直したものを `PRONOUNCE` に書いて 1〜5 をくり返す。
7. 単元を `ready` にするのは、その単元の音声が全件 OK になってから（architecture.md 10章の規則）。それまでは `partial`。
8. 声の比較（任意・1回）: 6.1〜6.2 から10語を af_heart と af_bella で生成し（`--voice af_bella --out scripts/voice/samples/en`。samples は git に入れない）、聞き比べを listening.md に残す。変えるなら全件そろえる。
9. G2P を misaki に替える検討は別の作業（全英語音声の作り直しになる。研究メモ 4.3-8）。

### 7.5 日本語の音声

- 問題文・ヒント・解説・誤概念の説明・導入・revealAudio の日本語は `npm run voice:packs` で `voice/packs/en-pre.json` に集まる（かな・漢字を含む文字列を再帰で拾う。英文は拾わない）。生成は既存の日本語パイプライン（`npm run voice:build`）。

### 7.6 英語の見直し（版 0.2。設計担当が確かめたこと）

台本（src/packs/en-pre/script-en.json の 383 本、2026-10-31 時点）と版 0.2 で足す文を読み直した。

1. **直す**: `Let's touch our nose.`（head・mouth も）。「みんなで自分の鼻をさわろう」は our ＋複数形が文法どおり（`Let's touch our noses.`）。単数のままでも口語では通じるが、教材の手本としては複数形にそろえる（ears・toes はもとから複数形）。5.5 の表で直す。
2. **このままでよい**: `It's bread.`（数えない名詞に a を付けていない）、`Some bread, please.`、`Can I have some bread, please?`、`Two peaches / tomatoes / strawberries`（複数形の綴り）、`These are my ears.`、`Where are the toes?`、`One apple.`（数をはっきり言う形。6.7）、`Hello, everyone!`、`I'm full!`、`A big ship. Toot, toot!`、`Wave your hand!`（片手で手をふる絵）、`Let's put our hands up!`、`Hands up!`。
3. **気をつけて使う**: `Where is the nose?` など からだの where 文。うさぎの絵の部分をたずねる言い方としては正しい。子に向けた会話では `Where is your nose?` が普通なので、保護者が画面の外で言い合うときはそちらでよい（parentNote には書かない）。
4. **版 0.2 で足す文**（どれも短い一般的な言い方。確かめた）:
   - あいさつ: `I'm sorry.`、`I'm sorry, bear.`、`Happy birthday!`、`Happy birthday, rabbit!`。
   - きもち: `I'm angry.`、`I'm thirsty.`、`I'm hot.`、`I'm cold.`（＋感嘆の別例）。
   - からだ: `Touch your tummy.`（幼児に向けた普通の語）、`Touch your knees.`、`Touch your shoulders.`。
   - where: `The cat is in / on / under the bed.`、`In the bed.` など（問いへの答えは前置詞句だけで自然）。
   - 本: 5.11 の24文。`Hello, fall!` は en-us の声に合わせた（autumn も正しい）。`Hello again, spring!` は「また会ったね、春」の自然な言い方。`Yum, yum, yum!`・`Ribbit, ribbit!`・`Quack, quack!`・`Tweet, tweet!`・`Meow, meow!`・`Woof, woof!` は英語圏の幼児向けの普通の擬音語。
   - abc: `Find the letter B.`（文全体を phonemes で固定）。
5. **似せていないか**: 本・あいさつ・動きの文はどれも一般的な短い言い方の組み合わせで、特定の絵本・歌の決まった文や並び（色と動物を「何が見える」でつなぐ、月におやすみを言う、頭・肩・ひざ・つま先を続けて言う、など）を写していない。
6. **試聴で特に気をつける key**（7.4 の全件試聴で印を付ける）: 擬音語（ribbit・quack・tweet・meow・woof・yum・beep・toot）、1語の短い語（Ears.・Toes.・Egg.・Cup.）、tummy、文字の名前 26・find 26（phonemes の書き方: 5.13）。
7. 生成の本数の見込み: 版 0.1 の P1 383 本 → 版 0.2 の P1 は 401 本（足す 21・消える 3）→ P2 を足して 約 489 本（where 12・本 24・abc 26・find 26）。7.4-5 の「約 250 本」は「約 400 本（P1）・約 490 本（P2 まで）」に読み替える。

---

## 8. ホームでの入口

### 8.1 どこに置くか

- 幼児ホーム（src/app/PreschoolHome.tsx）の**右の列の一番下**（いまの「ほかの がくねん」の札の位置。30u × 8.6u の白い札）を「えいご」の札にする。絵は `enpre-icon`、名前「えいご」。
- 「ほかの がくねん」は**上の帯の右、鍵の左**へ移す（5.5u の補助操作の札。絵 `explore`＋「ほかの がくねん」の文字 2.2u・1行。鍵との間は 3u 以上）。data-testid `home-explore` は変えない（既存の E2E を壊さない）。
- 理由: 左の 3×3 は 4歳・5歳で9枚埋まっていて位置を変えられない（DESINGN 5.2「位置は固定」）。右の列の高さは、おすすめ2枚＋おえかき・ノートの段＋一番下の札で舞台（56.25u）にほぼいっぱいで、札を増やせない。英語は子供が自分で選ぶ遊びなので主操作の寸法の札にし、「ほかの がくねん」（のぞきに行く入口）を補助操作へ移す。
- 2〜3歳の9番目の空き（p23 は札が8枚）は使わない（p23 の担当が使う余地を残す。区分で位置を変えない）。

### 8.2 出す・出さない

| 区分 | えいごの札 | 理由 |
|---|---|---|
| 2〜3歳の2歳段階 | **出さない**（右の列の一番下は空ける） | 札は4枚＋おえかきの決まり（ux-by-age 2.1、review-1 #23）。日本小児科医会の「2歳まで控える」。英語の画面学習の根拠が最も弱い年齢〔調査 1.1・1.6〕。保護者と一緒に「ほかの がくねん」の 2〜3さい から入れる |
| 2〜3歳の3歳段階・4歳・5歳 | 出す（`showPreschoolEnglish` が false なら出さない） | − |
| 小学生ホーム | 変えない（3年以上は教科の札「えいご」がある） | 1・2年は「ほかの がくねん」の 5さい から幼児の英語に入れる |

- 札に出すのは、札の単元のうち子供画面に出せるもの（`cardUnits` と同じ: planned を除く、hiddenByDefault は開いたものだけ）が1つ以上あるときだけ。

### 8.3 札の定義（新しいファイル）

`src/curriculum/preschoolEnglish.ts`（`preschoolHome.ts` は他の担当が触るので分ける）:

```ts
import type { HomeCard } from './preschoolHome';

/** 幼児ホームの「えいご」の札（右の列の一番下。2歳段階は出さない） */
export const PRESCHOOL_EN_CARDS: Record<'p23' | 'p4' | 'p5', HomeCard> = {
  p23: { id: 'eigo', title: 'えいご', icon: 'enpre-icon', units: ['p23.en.words', 'p23.en.move'] },
  p4: {
    id: 'eigo',
    title: 'えいご',
    icon: 'enpre-icon',
    units: ['p4.en.words', 'p4.en.colors-numbers', 'p4.en.move', 'p4.en.hello', 'p4.en.picture-book', 'p4.en.where'],
  },
  p5: {
    id: 'eigo',
    title: 'えいご',
    icon: 'enpre-icon',
    units: ['p5.en.phrases', 'p5.en.shop', 'p4.en.move', 'p4.en.hello', 'p4.en.picture-book', 'p5.en.abc'],
  },
};

/** 札を探す（ふつうの札 → えいごの札の順）。CardChooser と Explore が使う */
export function findPreschoolCard(stage: 'p23' | 'p4' | 'p5', cardId: string): HomeCard | undefined;
```

- P2 の単元は status が planned の間は `cardUnits` で落ちるので、札に書いておいてよい。
- 版 0.2 の追記（5歳の札の枚数）: p5.en.first-sound・p5.en.picture-book を足すと、5歳の札の単元は8になり、選ぶ画面の上限6を超える。案: p5 の札を `['p5.en.phrases', 'p5.en.shop', 'p5.en.picture-book', 'p5.en.first-sound', 'p4.en.hello', 'p5.en.abc']` にする（p5.en.picture-book が ready になったら p4.en.picture-book と入れ替え。p4.en.move は4歳の札と「ほかの がくねん」の 4さい から入る）。abc は既定で隠れるので、ふだんは5枚。統括の判断（13章 #7）。p5.en.picture-book・first-sound が planned の間は、今の6つのままでよい。
- 選ぶ画面（CardChooser、src/app/UnitEntry.tsx）は札を `findPreschoolCard` で探す（今は `PRESCHOOL_HOMES[stage].cards` だけ）。選ぶ画面は 24u×22u の札を横に3枚・2段まで（最大6枚。いまの寸法で入る）。
- 札を押したとき: 単元が1つなら直接開く、2つ以上なら選ぶ画面（`navigate({ name: 'card', stage, cardId: 'eigo' })`）。router の card の正規表現 `^[a-z0-9-]+$` にそのまま合う。
- 札の名前の読み上げ（`titleVoice`）は使わない（他の幼児の札と同じく、選ぶ画面の「どれで あそぶ？」で読む）。
- **「きょうの おすすめ」に英語の札を入れない**（`recommendCards` に渡す cards に含めない）〔調査 2-9〕。
- 「ほかの がくねん」（src/app/Explore.tsx）の 2〜3さい・4さい・5さい のタブでは、ふつうの札の後に「えいご」の札を並べる（`explore-card-eigo`）。ここでは 2歳段階・`showPreschoolEnglish` にかかわらず出す（保護者と一緒にのぞく入口）。

### 8.4 寸法（DESINGN 5.2 に書き足す内容）

```
┌────────────────────────────────────────────────────────────┐
│ (プロフィールの絵) うさぎ          [ほかの がくねん] 小  [鍵]小 │ ← 6u
│ ┌──────────┐┌──────────┐┌──────────┐ │ きょうの おすすめ      │
│ │ …3×3 は今までどおり（位置固定）…  │ │ ┌──────────────────┐ │
│ │                                  │ │ │ おすすめ1          │ │
│ │                                  │ │ └──────────────────┘ │
│ │                                  │ │ ┌──────────────────┐ │
│ │                                  │ │ │ おすすめ2          │ │
│ │                                  │ │ └──────────────────┘ │
│ │                                  │ │ [おえかき][ノート]     │
│ │                                  │ │ ┌──────────────────┐ │
│ │                                  │ │ │ (絵) えいご        │ │ ← 30u×8.6u
│ └──────────────────────────────────┘ │ └──────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

- 「えいご」の札: `home-rec home-rec--note`（白い札・段差あり）、data-testid `home-eigo`、aria-label「えいご」。
- 上の帯の「ほかの がくねん」: 高さ 5.5u（補助操作の最小）、白い札、絵 4u＋文字 2.2u。鍵（4.5u、意図的に小さめ）との間 3u 以上。

---

## 9. 保護者画面での見え方

1. **せってい →「ホームの表示」**: 「幼児ホームに『えいご』の札を出す」（3.4）。
2. **せってい →「はじめは かくれている単元」**: p5.en.abc が既存のしくみで並ぶ（単元名「ABC（えいごの もじ）」は保護者画面では `title` を出す。子供画面の単元名はひらがなのみの規則なので、title は「えいごの もじ」とし、保護者画面の説明に「大文字と文字の名前（エー、ビー…）」と書く）。
3. **アプリ情報 →「幼児の英語について」**（AboutTab に Section を足す。文章は以下を基本に、漢字かな交じりで）:
   - ねらい: 「英語の音に親しみ、日本語とのちがいに気づく遊びです。英語の力を身につけることを目的にしていません。短い時間を、できるだけおうちの方と一緒に楽しんでください。」
   - 使い方のこつ: 「お子さんが絵を指さしたら英語で言ってみる」「英語のあいさつを毎日の決まった場面で言い合う」「体を動かす遊びは大人がまねして見せる」
   - 日本語を大切に: 「日本語の絵本の読み聞かせやおしゃべりの時間を減らさないでください。」
   - しくみ: 「英語の音声は合成音声（Kokoro）で作っています。発音の正しさの判定や録音はしません。マイクは使いません。」
   - 2〜3歳: 「2歳の段階ではホームに英語の札を出しません。『ほかの がくねん』から、おうちの方と一緒に遊べます。」
   - 単元ごとの一言: `UNIT_INDEX` の en-pre の単元の `parentNote` を、単元名と並べて表で出す。
4. **きろく**: 既存のまま。単元名（ひらがな）と問題（id。例 `hear:dog`）が出る。2歳段階は既存どおり「あそんだ内容」だけ。
5. **単元**: 進度・段階の固定は既存の単元と同じ。

---

## 10. 正本の文書の更新点

### 10.1 DESINGN.md

1. **4章の適用範囲の文**に追記: 「幼児の英語（パック en-pre）は、英語を**音声だけ**で出す。画面の文字は日本語（ひらがな）で、この章の規則に従う。例外は p5.en.abc（保護者が開いたときだけ）の、学ぶ対象としての大文字（選択肢の図。Zen Maru Gothic 700、8〜14u）だけ。」
2. **5.2 ホームのワイヤーフレーム**: 右の列の一番下を「えいご」（30u×8.6u、2歳段階は空ける）、「ほかの がくねん」を上の帯の鍵の左（5.5u、間 3u 以上）に描き直す（本書 8.4 の図）。
3. **8章 状態の表現**に1行: 「名前を返す（幼児の英語）: 押した選択肢を選択中の見た目にして、その名前の音声を鳴らし、鳴り終わってから判定する。」
4. **9章 音・動き・声かけ**に追記: 「幼児の英語は不正解の効果音を鳴らさない（gentleJudgement）。英語の声は af_heart に統一し、同じ語を2回（間 700ms）でゆっくりさを作る（話速を 0.7 未満にしない）。」
5. **14章・23章 自動検査**: 「子供画面の文字列」の検査の対象外（小学生区分の英語の教材パック）に en-pre を**入れない**ことを明記し、en-pre はパックのテストで英字の不在（abc の選択肢の図を除く）を検査する、と書く。
6. **22章 禁止例**に追加: 「幼児の画面に英語の文字を出す（ABC の単元を除く）」→「英語は音声、文字は日本語」／「どこを触っても進む英語の画面」→「聞いた語の絵を触ったときだけ答えになる」／「英語の不正解にブザー音・×」→「名前を返して、もう一度聞く」。

### 10.2 ux-by-age.md

1. **2.1 幼児ホーム**: 「右の列の一番下に『えいご』の札（3歳段階・4歳・5歳。保護者の設定で隠せる）。2歳段階は出さない。『ほかの がくねん』は上の帯（鍵の左）」を追記。
2. **1章の表の下**に注記: 「幼児の英語（en-pre）は区分の選択肢の数・1回の量に従う。正誤の見せ方は区分の規則のうえで、不正解の効果音を鳴らさない（gentleJudgement）。」
3. **新しい節「2.7 幼児の英語」**: 本書 2.1 の表（音声・選択肢・触った後・不正解・答えの後・1回の量）を写す。

### 10.3 curriculum-matrix.md

1. **0.5 凡例**の「教科（幼児）」に `en` えいご（音声で親しむ）を足す。
2. **2.3 英語**の表に列「幼児（えいご あそび）」を足す: 聞く＝「語・短い文の音声を聞いて絵を選ぶ（listen）。自動」、読む＝「目標に含まない（5歳の ABC は保護者が開いたとき、文字の名前と大文字だけ）」、書く＝「しない」、話す＝「評価しない。まねして言うよう声をかける（録音しない）」。表の下に「幼児の英語のねらいは親しむ・気づく・興味。英語の力の習得をうたわない（research/preschool-english.md）」。
3. **3.1・3.2・3.3 に行を足す**（下の 10.4 の行をそのまま）。
4. **5.1 系統の一覧**の「英語」の行: 2〜3歳 `words（, move）`、4歳 `words, colors-numbers, move, hello, picture-book（, where）`、5歳 `phrases, shop（, picture-book, first-sound, abc）`。
5. **7章 教材パック**の表に en-pre の行: 「en-pre | p23: words／p4: words, colors-numbers, move, hello, picture-book／p5: phrases, shop／P2: p23 move, p4 where, p5 picture-book, first-sound, abc | 8 | listen | B3（英語音声）、コア同梱」。
6. **8章 単元数**: 幼児の表に列「えいご en」を足す（p23 1／1／0、p4 5／1／0、p5 2／3／0、幼児計 8／5／0）。幼児の合計は **41／19／1（61）**、全体は **P1 259／P2 62／対象外 20（341単元）**。
7. **9章**に論点を1行: 「幼児の英語（en-pre）を足す。ホームの入口は右の列の一番下、2歳段階は出さない（p2-design/preschool-english.md）」。

### 10.4 curriculum-matrix.md に足す行

3.1（2〜3歳）:

| ID | 単元・目標 | 前提 | 導→基→応 | エンジン | 種・量 | 音ヒ解 | 復習 | 根拠 | 優 | 状 | 問題例 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| p23.en.words | えいごで タッチ: 英語の語を聞いて絵を選ぶ（音に親しむ） | − | L2 どうぶつ・たべもの 2択（1語を2回）→ L3 のりもの・もの を足して 3択 | listen | 遊 語24（L2 12） | ●●○ | − | 幼要 言葉（響き）・環境（異なる文化）、保指、研（調査 1.1） | P1 | 未 | 「Dog.（2回）」→ いぬ／ねこ の絵。触ると「Cat.」と名前が返る |
| p23.en.move | うごいて みよう: 合図を聞いて動きの絵 → 親子で体を動かす | p23.en.words（推奨のみ） | L2 動き 2択 → L3 動き・からだを さわる 3択 | listen | 遊 動き8・さわる6（問36） | ●●○ | − | 調査 1.3（TPR は示唆） | P2 | 未 | 「Jump!」→ とぶ うさぎ／すわる うさぎ |

3.2（4歳）:

| ID | 単元・目標 | 前提 | 導→基→応 | エンジン | 種・量 | 音ヒ解 | 復習 | 根拠 | 優 | 状 | 問題例 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| p4.en.words | えいごで タッチ: 語・短い文を聞いて絵を選ぶ | p23.en.words（推奨のみ） | 1語 3択 → Where is the 〜? 3択 → なかまを混ぜて 4択 | listen | 遊 語42 | ●●○ | − | 幼要 言葉・環境、調査 1.1・1.2 | P1 | 未 | 「Where is the rabbit?」→ うさぎ／くま／ぞう |
| p4.en.colors-numbers | いろと かず（1〜5）を聞いて選ぶ | − | いろ 3択 → かず 3択 → まぜて 4択 | listen | 遊 色8・数5 | ●●○ | − | 幼要 環境（数量・色）、外活34 へ接続 | P1 | 未 | 「Three.（2回）」→ りんご3こ／2こ／4こ |
| p4.en.move | うごいて みよう: 合図を聞いて動きの絵 → 親子で体を動かす | − | からだ全体 3択 → からだを さわる 3択 → まぜて 4択 | listen | 遊 動き16（全身8・さわる8） | ●●○ | − | 調査 1.3（TPR は示唆）、幼要 健康・表現 | P1 | 未 | 「Touch your nose.」→ はなを さわる うさぎ |
| p4.en.hello | あいさつ・きもちを聞いて場面を選ぶ | − | あいさつ 3択 → きもち 3択 → まぜて 4択 | listen | 遊 15（あいさつ7・きもち8。全件）＋別例 | ●●○ | − | 幼要 人間関係・言葉、外活34 へ接続 | P1 | 未 | 「Good night!」→ つき／たいよう／プレゼント |
| p4.en.picture-book | えいごの えほん: オリジナルの4ページのお話をくり返し聞く | p4.en.words（推奨のみ） | 聞こえたページ 2択 → 3択 → さいしょの ページ 3択（絵の帯なし） | listen | 遊 本6・問54（異なる30） | ●●○ | − | 研 Horst 2011（同じ本のくり返し）、幼要 言葉（絵本） | P1 | 未 | 「Hello, dog! … Hello, cat!」→ さいごに聞こえたのは ねこ |
| p4.en.where | かくれんぼ: in / on / under を聞いて動物の場所を選ぶ | p4.en.words（推奨のみ） | どこかな 3択 → だれが どこ 4択 | listen | 遊 場9・問36 | ●●○ | − | 外56 へ接続（場所） | P2 | 未 | 「The cat is under the bed.」→ ベッドの した／なか／うえ の ねこ |

3.3（5歳）:

| ID | 単元・目標 | 前提 | 導→基→応 | エンジン | 種・量 | 音ヒ解 | 復習 | 根拠 | 優 | 状 | 問題例 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| p5.en.phrases | かずと いろと もの: 2〜3語の句を聞いて絵を選ぶ | p4.en.colors-numbers（推奨のみ） | 1語 4択 → かず＋もの 4択 → かず＋いろ＋ボール 4択 | listen | 遊 生130 | ●●○ | − | 外活34 聞く へ接続、調査 3 | P1 | 未 | 「Three apples.」→ りんご3こ／2こ／ボール3こ／ボール2こ |
| p5.en.shop | おみせやさん: 注文を聞いて品物を渡す、決まった返しを親子で言う | p4.en.words（推奨のみ） | 品物 4択 → かず＋品物 4択 → まぜて（Can I have 〜?） | listen | 遊 生90 | ●●○ | − | 幼要 人間関係（ごっこ）、調査 1.2（JME） | P1 | 未 | 「Two bananas, please.」→ バナナ2本 …「Here you are.」「Thank you!」 |
| p5.en.picture-book | ながい えいごの えほん: オリジナルの6ページのお話 | p4.en.picture-book（推奨のみ） | 1ページ 4択 → お話の後に聞こえたページ 4択 → さいしょ・さいご 4択 | listen | 遊 本4・問56 | ●●○ | − | 研 Horst 2011 | P2 | 未 | 「Hello, spring! … Hello again, spring!」→ さいしょの ページは はる |
| p5.en.first-sound | おなじ おと: 同じ音で始まる絵（聞くだけ中心） | p4.en.words（推奨のみ） | 名前を聞いて比べる 3択 → 名前を思い出して 3択 | listen | 遊 語28・問68 | ●●○ | − | 調査 1.4（5歳で頭韻の判別） | P2 | 未 | 「Bear.」→ バス／くるま／りんご（くま・くるまは日本語だけ同じ音） |
| p5.en.abc | えいごの もじ（ABC）: 文字の名前を聞いて大文字を選ぶ（既定で非表示、保護者が開く） | − | 3択 → 4択（形・音の似た字） | listen | 知 項26・問78 | ●●○ | − | 外活34（文字の名前を聞いて分かる）の前段階、文科省 Q&A | P2 | 未 | 「B（2回）」→ B／D／P |

### 10.5 curriculum-matrix.md との整合（版 0.2 で確かめた結果）

p3/features の curriculum-matrix.md（3.1〜3.3 の en の行・2.3・5.1・7章・8章・9章 #14）と本書を照らした。**直すのは統括**（本書の作業は設計書だけ）。

| # | 場所（curriculum-matrix） | いまの書き方 | 本書（版 0.2） | 直し方の案 |
|---|---|---|---|---|
| 1 | 3.1 p23.en.move | 前提 p23.en.words、L3 2択 → 3択、遊 動き8 | 5.2: 前提は推奨のみ、L2 2択 → L3 3択、動き8・さわる6（問36） | 10.4 の行に差し替え |
| 2 | 3.2 p4.en.move | 遊 動き13 | 5.5: 全身8・さわる8＝16 | 「遊 動き16」 |
| 3 | 3.2 p4.en.hello | 遊 9（全件）＋別例 | 5.6: あいさつ7・きもち8＝15 | 「遊 15（全件）＋別例」 |
| 4 | 3.2 p4.en.picture-book | **読** 本6・問24 | 実装（picture-book.ts）は `kind: 'play'`（preUnit）で問54（異なる同一性キー30）。1.3 の「読解」（本文8・設問30、内容を読み取る設問）とは性質が違う（聞こえたページを選ぶ遊び） | 「遊 本6・問54」に直す（13章 #6） |
| 5 | 3.2 p4.en.where | 2択 → 3択、遊 場12、例「under the box」 | 5.8: 3択 → 4択（4歳は3〜4択: 2.1・ux-by-age）、ベッドに変更、場9・問36 | 10.4 の行に差し替え |
| 6 | 3.3 p5.en.picture-book | **読** 本4・問24 | 5.11: 遊、本4・問56。読解にすると本文6以上の基準（1.3）に届かない | 「遊 本4・問56」（13章 #6） |
| 7 | 3.3 p5.en.first-sound | 3択、遊 語20 | 5.12: 3択（2段階）、語28・問68。5歳の選択肢は4が基本なので、パックのテストの例外にする | 10.4 の行に差し替え |
| 8 | 3.3 p5.en.abc | 知 項26、例「B → B／D／P」 | 5.13: 知（kind knowledge）、項26・問78、段階1は B／P／D／V の4択 | 「知 項26・問78」。単元名は子供画面で「えいごの もじ」 |
| 9 | 2章（本書）の種別 | 「種別はすべて遊」 | abc だけ知（#8）。本書2章の文をそう読み替える | − |
| 10 | 8章 単元数 | えいご p23 1／1、p4 5／1、p5 2／3 | P1・P2 の数は変わらない | 変更なし |
| 11 | 9章 #14 | 入口と2歳段階だけ | 本書 13章は #1〜#5 に加えて #6〜#8（版 0.2） | #14 の「判断が要る理由」に「不正解の効果音を鳴らさない・ABC は P2 で既定で隠す・英語の G2P は espeak のまま」を足すか、本書 13章を参照と書く |
| 12 | 5.1 系統の一覧 | 2〜3歳 `words（, move）` ほか | 同じ | 変更なし |
| 13 | 7章 en-pre の行 | P1 8・P2 5 | 同じ | 変更なし |

- 本書の中の食い違いも直した: 6.10 の本（0.1 の stars → 実装の sky）、6.11 の where の絵の ID（enpre-cat-in → enpre-where-cat-in）、7.3 の IPA（強勢つき）。
- 実装（P1）と本書の差で、残すもの: p4.en.picture-book の段階1に「さいごの ページ」（帯つき）の別例がある（本書 5.7 は段階2の別例だけ）。実装の方が別例を多く持つだけなので直さない。

---

## 11. テストで確かめること

### 11.1 パックのテスト `src/packs/en-pre/en-pre.test.ts`（en-g34.test.ts を手本に）

1. パックの形（packId `en-pre`、単元IDが重複しない、ID が `^(p23|p4|p5)\.en\.[a-z0-9-]+$`）。
2. 全単元 `checkUnit` の errors が空。ready の単元は `isReady`（Q≥1.0・C 全部）。
3. **子供に見える文字に英字・漢字・絵文字が無い**: title・objectives の title・intro の text・prompt・hints・explain・misconceptions の explain・options の label・revealAudio の key 無しの text（`p5.en.abc` の選択肢の図 `kind: 'text'` だけ除く）。カタカナは 6章の日本語の名前（絵の label）だけ。
4. すべての問題が listen で、`hideTranscript: true`・`nameBack: true`・`replay.afterWrong`・`replay.onHint`。
5. audio・options の sound・revealAudio の英語の key がすべて `en/en-pre.` で始まる。英字を含む音声に key がある。
6. すべての選択肢に `sound` があり、その key がその選択肢の絵の語の key（例 dog の絵には `en/en-pre.word.dog`。from 表で照らす）。
7. 選択肢の数: p23 の段階0は2、p23 の段階1は3以下、p4 は 3〜4、p5 は4（`multi` なし）。
8. 赤（tomato・enpre-ball-red）と緑（frog・enpre-ball-green）が同じ問題に無い。
9. Hello と Bye-bye、Good morning と Good night 以外の `same-start` の組が、6章の ◆ の語どうしだけ（誤概念 `same-start` の付け方の検査。en-g34 の sound-alike の検査と同じ考え）。
10. 誤りの選択肢すべてに誤概念ID（汎用の誤答 0%）。
11. ヒント2段が、問題の答えの日本語の名前を含まない（答えを言わない）。
12. 量: p23.en.words の段階0の異なる同一性キー ≥8、各段階 ≥12（定義域が小さい単元は全件）。各到達項目に別例 ≥3。
13. 台本: `englishScript` に clash が無い・`script-en.json` と一致・`PRONOUNCE` の key がすべて台本にある・text に数字（0-9）が無い・単語の text が大文字で始まり `.` `!` `?` のどれかで終わる。
14. 絵: 使っている絵がすべてある（`getIllust` か `enPreIllust`）。
15. 本（picture-book）の文に、同じ本のページが同じ絵を2回使っていない。段階2の問題に `figure` が無い。

版 0.2 で足す・改める検査:

16. 7 の例外: `p5.en.first-sound` は3。`p4.en.where` は 3〜4 のまま（0.1 の2択はやめた）。
17. 3 の例外: `p5.en.abc` の選択肢の図・explainFigure・intro の図の `kind: 'text'` の大文字1字（`/^[A-Z]$/`）だけ英字を許す。ほかの単元に `kind: 'text'` の英字が無い。KATAKANA_OK に「ベッド」を足す（where）。
18. 到達項目ごとの数（`checkUnit` の objectives で）: p4.en.move touch 8・whole 8、p4.en.hello greet 7・feel 8、p23.en.move move 8・touch 6、p4.en.where pos 9・who-pos 9、p5.en.picture-book heard 20・order 8、p5.en.first-sound 8・6・14、p5.en.abc 9・9・8。別例はどれも 3 以上。
19. 同じ問題に並べない組: hello の4組（5.6）、赤と緑（8）。
20. 誤概念の付け方: body-near は NEAR_TOUCH_PAIRS の組だけ（両向き）、pair-feel は hungry・thirsty と hot・cold だけ、first-sound のわなは 5.12 の表のとおり、abc の段階1の誤りは 5.13 の表のとおり。
21. 音声の並び: `keepOrder` の問題（first-sound の段階0と別例）は、audio の key の並びが選択肢の sound の並びと一致する（段階0は先頭に目当てが1つ多い）。
22. p23.en.move の英語の key がすべて p4.en.move にもある（p23 だけの英語の音声を作らない）。first-sound の英語の key がすべて p4.en.words にもある。
23. PRONOUNCE: abc 26・find 26 の phonemes があり、key が台本にある。
24. 単元の印: p5.en.abc は `hiddenByDefault: true`・`kind: 'knowledge'`。ほかの en-pre の単元は `kind: 'play'`。
25. 本: p4・p5 の本の id が重ならない。p5 の本の段階1の誤りに必ず6ページ目がある。

### 11.2 エンジン・本体のテスト

1. `src/engines/listen/listen.test.ts`:
   - `checkListen`: nameBack で sound の無い選択肢・multi はエラー。英字の sound に key が無いとエラー。
   - 画面: nameBack で選択肢を押すと、その sound が再生され、終わってから submit される。再生中に別の選択肢を押しても2回目の submit が起きない。音声が出ない環境では 1500ms 以内に submit される。
   - replay.afterWrong: wrongMark が付くと（実行枠の読み上げの後に）audio が再生される。replay.onHint: hintsShown が増えると再生される。
   - revealAudio: revealed になると1回だけ再生される（再レンダーで2回鳴らない）。
   - 今までの listen の問題（nameBack なし）の動きが変わらない（既存のテストがそのまま通る）。
2. `src/units/unitFlow.test.ts` か UnitRunner のテスト: `gentleJudgement` の単元で不正解の効果音（`audio.sfx('wrong')`）が呼ばれない。正誤の記録・誤概念の説明は今までどおり。
3. `src/curriculum/preschoolEnglish` のテスト: `findPreschoolCard` が既存の札とえいごの札の両方を返す。えいごの札の units がすべて unit-index にある（P2 は planned でよい）。
4. `PreschoolHome`（または E2E）:
   - 3歳段階・4歳・5歳のホームに `home-eigo` がある。2歳段階には無い。`showPreschoolEnglish: false` で無い。
   - `home-explore` が上の帯にあり、押すと「ほかの がくねん」へ行く。
   - `home-eigo` を押すと `card-chooser-eigo` が開き、ready/partial の単元だけが並ぶ。
   - 「きょうの おすすめ」に えいご の札が出ない。
5. Explore: 2〜3さい・4さい・5さい のタブに `explore-card-eigo` がある（2歳段階のプロフィールでも）。
6. E2E（Playwright）: 1920×1080 の 100%・125%・150% で、4歳のホーム（おすすめ2枚）と、p4.en.picture-book の段階0の問題画面（絵の帯＋きくの札＋選択肢2）が、はみ出し・重なり・横スクロールなし。
7. `scripts/vite-plugin-precache.test.ts`: `CORE_PACK_IDS` に en-pre があり、en-pre のチャンクがコアに入る（packs.json に載らない）。
8. 既存の検査がすべて通る: `npx tsc -b`、`npx eslint .`、`npx vitest run`、`npm run check:design`、`npm run check:packs`、`npm run check:audio`、`npm run build:unit-index` の後の unitIndex のテスト。

### 11.3 人が確かめること（未確認として残す）

- 英語の音声の全件試聴（7.4。listening.md）。
- 実機（12.5インチ・タッチ）で、名前が返るまでの待ち時間が長すぎないか（目安 1.5 秒以内）、2回聞かせが冗長でないか。
- 親子で使ったときの声かけ（ヒント②・revealAudio）が自然か。
- 新しい絵（25枚）が既存の画風に合っているか（gallery.html）。
- 版 0.2: 新しい絵（P1 5枚: enpre-touch-tummy・-knees・-shoulders、enpre-sorry、enpre-birthday。P2 10枚: enpre-where-* 9・enpre-blocks）の画風と、where の in・on・under が4歳に見分けられるか。
- 版 0.2: p5.en.picture-book の段階1（6ページ＋1、約 15〜20秒）が5歳に長すぎないか。first-sound の段階1（名前を言わない）で、子が絵の英語の名前を思い出せるか（p4.en.words を遊んだ後か）。
- 版 0.2: 文字の名前の phonemes（espeak 風と misaki 風のどちらが自然か。5.13）。

---

## 12. 実装の順（実装担当向け）

1. 本体: types.ts（ChoiceOption.sound・UnitSpec.gentleJudgement・parentNote・UnitMeta.parentNote）、build-unit-index、ChildSettings.showPreschoolEnglish。
2. listen の拡張 E1〜E3 とテスト、UnitRunner の E4 とテスト。
3. 絵 `src/illust/content/en-pre.tsx`（P1 の 25枚）。
4. パック `src/packs/en-pre/`（lib.ts・voice.ts・pronounce.ts・各単元・index.ts・test・script-en.json）。P1 の 8単元。最初は `status: 'partial'`。
5. `CORE_PACK_IDS`、`npm run build:unit-index`、`npm run voice:packs`。
6. ホーム: `preschoolEnglish.ts`、PreschoolHome（えいごの札・ほかの がくねん の移動）、CardChooser、Explore、保護者画面（設定・アプリ情報）。
7. 英語の音声の生成と全件試聴（7.4）→ 問題のない単元から `ready`。
8. 正本の文書の更新（10章）。

版 0.2 の追加（P1 の補い → P2 の順）:

9. P1 の補い: vocab.ts に TOUCH_PARTS、move.ts（touch 8・両向きの近い部分・lets の複数形）、hello.ts（greet 7・feel 8・clash・pair-feel）、絵 5枚、テスト 18〜20、`script-en.json` を作り直し、`voice/script-en.json` に en-g34・en-g56 と合わせて書く（7.1）。
10. P2: lib.ts（`keepOrder`、preUnit の `kind`）→ move-p23.ts → where.ts（絵 9枚）→ picture-book-p5.ts → first-sound.ts → abc.ts（絵 enpre-blocks・PRONOUNCE 52件）→ index.ts に足す → テスト 16〜25 → `npm run build:unit-index`・`npm run voice:packs`。P2 の単元も最初は `status: 'partial'`（英語の音声の試聴の後に ready）。8.3 の p5 の札は 13章 #7 の判断の後に直す。

## 13. 統括の判断が要る点

| # | 論点 | 本書の案 | ほかの案 |
|---|---|---|---|
| 1 | ホームの入口 | 右の列の一番下を「えいご」、「ほかの がくねん」を上の帯へ | (a) 2〜3歳だけ 3×3 の9番目に置き、4歳・5歳は「ほかの がくねん」の中だけ（入口が見つけにくい）。(b) 4歳・5歳の札を1枚まとめて空ける（既存の札の位置が変わる） |
| 2 | 2歳段階 | ホームに出さない（「ほかの がくねん」から保護者と） | 保護者の設定で出せるようにする |
| 3 | 不正解の効果音 | 幼児の英語は鳴らさない（gentleJudgement）。○／？の印は残す | 4歳・5歳は区分の既定どおり鳴らす |
| 4 | 5歳の ABC | P2・既定で非表示 | 作らない（文字は小3から） |
| 5 | 音声の G2P | espeak-ng のまま、試聴で個別に直す | misaki に切り替えて英語の全音声を作り直す |
| 6 | 絵本の種別（版 0.2） | p4・p5 の picture-book は **遊**（実装どおり。聞こえたページを選ぶ遊びで、内容を読み取る読解ではない）。curriculum-matrix の「読」を「遊」に直す（10.5 #4・#6） | 「読」のままにし、p5 の本を6冊・設問30以上に増やす（1.3 の読解の基準。本文が倍になり、5歳の英語としては多すぎる） |
| 7 | 5歳の えいごの札の単元（版 0.2） | 6つまで: phrases・shop・p5.picture-book・first-sound・p4.hello・abc（p4.move は 4さい の札・ほかの がくねん から。8.3 の追記） | (a) p4.hello を外して p4.move を残す。(b) 選ぶ画面を 4×2 の8枚にする（札が小さくなる） |
| 8 | 版 0.2 で足した語・表現 | からだ tummy・knees・shoulders、あいさつ I'm sorry・Happy birthday、きもち angry・thirsty・hot・cold（5.5・5.6）。p4.en.move・p4.en.hello の英語の音声が増える（7.6-7） | 足す語を減らし、到達項目を1つにまとめる（C の基準は満たせるが、1つの到達項目に性質のちがう語が混ざる） |
| 9 | where の場所（版 0.2） | ベッド（in・on・under の絵が はっきり分かれる。5.8） | 0.1 の箱（box）。under の絵が「箱をかぶる」になり in と まぎれやすい |
| 10 | first-sound の選択肢の数（版 0.2） | 3（音を比べる負担。5歳の上限4より少ない） | 4（5歳の既定。わなと遠い語を1つずつ増やす） |
