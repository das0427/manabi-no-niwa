# 幼児向けの英語（調査メモ）（docs/expansion/research/preschool-english.md）

版 0.1（2026-10-30） / 責任: 設計担当（統括の代理、Opus） / 宛先: 統括、実装担当
目的: 依頼「どういうモードや機能、遊び方が知育的にいいかを Web リサーチしたうえで、幼児向けの英語系のモードを足して」「Kokoro って自然な発音？」に答えるための根拠をまとめる。設計は docs/expansion/p2-design/preschool-english.md。

## 0. 調べ方と根拠の強さ

- 2026-10 に Web 検索で調べた。一次資料の全文まで読めたのは文部科学省の Q&A だけ。PMC・文科省 PDF・WHO PDF の本文は取得できず、多くの数値は**抄録・自治体資料・報道による二次要約**に基づく。原文で確かめていない点は「未確認」と書く。
- 根拠の強さ:
  - **強** = 査読つき実験・大規模レビュー・メタ分析
  - **中** = 小規模研究・学会抄録・公的機関の二次資料
  - **弱** = 解説記事・利用者の意見・推測
- 「事実」は出典に書いてあること、「推測」はそこから本アプリが引き出したこと。推測は推測と書く。
- 他社の教材・アプリ・番組の問題、絵、キャラクター、歌、音声は**型（遊び方の形）だけ**を参考にし、中身は写さない。

## 1. 調べた事実

### 1.1 画面から学ぶことの限界（ビデオ欠損）

| 事実 | 強さ | 出典 |
|---|---|---|
| 9か月児に中国語を聞かせた実験（25分×12回）。生身の話者から聞いた群だけが音の区別を学んだ。同じ内容の映像・音声だけでは学ばなかった | 強（実験・小標本） | Kuhl, Tsao & Liu 2003, PNAS |
| タッチ画面の映像でも、ほかの乳児が一緒にいると学習が改善した | 強（実験） | Lytle, Garcia-Sierra & Kuhl 2018, PNAS |
| 「ビデオ欠損」は年齢や課題を問わず報告されるが普遍的ではなく、年齢が上がるほど・繰り返すほど小さくなる | 強（レビュー） | Frontiers in Psychology 2018・2019 のレビュー |
| 24〜36か月児は、**画面上の正しい対象を触ることを求める（随伴的な）タッチ**のときだけ映像から単語を学んだ。どこを触っても進む操作では学ばなかった。32〜36か月では操作させるとかえって学習が妨げられたとも伝えられる（後者は二次資料、原文未確認） | 中〜強 | Kirkorian, Choi & Pempek 2016, Child Development 87 |
| 24〜40か月（162人）。自分でタップして選ぶ群より、見て聞くだけの群が2択テストで高得点。著者は「学びの差ではなくテスト時の成績の差」と解釈し、タップの癖・「選ぶ」から「当てる」への切り替えの難しさを挙げる | 強（実験） | PLoS One 2020（ゲッティンゲン） |
| 0〜5歳のタッチ画面学習のメタ分析（36研究）。全体の効果は d=0.46（中程度）。年齢による違いは本文が読めず未確認 | 強（メタ分析） | Xie ら 2018, Frontiers in Psychology |
| 画面時間が長いほど言語力が低い傾向（r≈−0.14）。教育的な内容と大人との共視聴は言語力と正の関連。観察研究で因果ではない | 中（観察研究のメタ分析） | Madigan ら 2020, JAMA Pediatrics |

### 1.2 学べるアプリの条件

| 事実 | 強さ | 出典 |
|---|---|---|
| 学べるアプリの4本柱: 頭を使う（タップの量ではない）・学習と関係のない演出で気をそらさない・子どもの生活と結びつく・人との関わりがある。加えて明確な学習目標 | 強（総説） | Hirsh-Pasek ら 2015, Psychological Science in the Public Interest |
| 保護者が一緒に関わる「共同メディア関与（JME）」で学びが増えるという証拠が積み上がっている | 中（総説） | Lovato & Waxman 2016、Joan Ganz Cooney Center「The New Coviewing」2011 |
| 幼児は親の介入を嫌がることもある。幼児向けには実物を使う遊び、見ているだけの参加から加われる形がよい | 中 | Joan Ganz Cooney Center の開発者向け指針 |
| 幼児アプリ171本の分析。多くが「褒めるだけ」「やり直しだけ」のフィードバックで、内発的動機を損ねるおそれ | 中 | UC Irvine（Callaghan & Reich） |
| 4〜5歳240人。**選んだ物の名前を言い返すフィードバック**（例「みどりの○○を選んだね」）がいちばん正確さを高めた。効果音だけだと答えが速くなった。難しさは段階的に上げる方がランダムより速く正確 | 中（学会抄録） | Harvard GSE Reach Every Reader |
| 「正誤をまったく出さない」設計を直接検証した研究は見つからなかった | − | （推測の余地あり） |

### 1.3 何が語彙の学びに効くか

| 事実 | 強さ | 出典 |
|---|---|---|
| 3歳児に1週間で3回読み聞かせ。**同じ絵本を3回**聞いた群は新しい単語を保持し、毎回ちがう本の群は保持しなかった。同じ文・同じ絵のくり返しが注意の負担を下げる | 強（実験） | Horst ら 2011, Frontiers in Psychology／Horst 2013 |
| 英語学習者への絵本の共有読みのメタ分析（54研究・約4,000人、主に米国のスペイン語話者）。多様な形の読み聞かせで言語が伸びた | 強（メタ分析。対象が違う） | FSU の研究（Education Week 報道） |
| 教えた語彙は伸びたが、標準化された語彙テストでは効果が出なかった | 強（RCT） | Pollard-Durodola ら 2016 |
| 家庭での母語の読み聞かせは、英語の読み聞かせと同等以上に英語語彙の獲得に役立った | 中 | Roberts 2008 |
| 歌・身振り・TPR（聞いて体を動かす）は幼児の英語語彙に有効という報告（タイ・スロベニア・ポルトガル・インドネシアなど）。大規模 RCT・メタ分析は見つからない。**示唆の段階** | 中〜弱（小規模・事例） | Thai TESOL Journal、TEYLIN（3歳児1人の事例）ほか |
| 歌って覚えた群は逐語の想起・発音・訳で上回り、6か月後も差が残った（9〜13歳、38人）。歌の構造そのものが効くかには異論 | 中 | Good, Russo & Sullivan 2015, Psychology of Music |

### 1.4 音あそび・文字の発達段階

| 事実 | 強さ | 出典 |
|---|---|---|
| 4歳で80〜90%の子が韻・頭韻をまねして楽しめる。5歳で韻の判別・仲間はずれ探し。韻を自分で作るのは5歳で61%。音素の分解は就学前の5歳で7%程度 | 中 | Reading Rockets の発達表（Paulson 2004 ほか） |
| 頭子音とライム（onset-rime）の気づきは4歳ごろから | 中 | Frontiers in Psychology 2019 |
| アルファベットの知識と音韻意識は後の読みの強い予測因子（英語を母語とする米国の子）。組み合わせた介入の効果量 0.37、音韻意識の訓練だけでは 0.04。**日本の幼児の外国語には当てはめられない** | 強（メタ分析。対象が違う） | NELP 2008（Teale ら 2010 の論評） |
| 音韻意識は言語を越えて移る（中国語↔英語、韓国語↔英語）。韓国の英語学習児では頭子音と韻の意識が最も強い予測因子。日本語↔英語の幼児の直接の証拠は見つからない | 中 | 韓国国会図書館所蔵論文ほか |

### 1.5 開始年齢と母語への影響

| 事実 | 強さ | 出典 |
|---|---|---|
| 授業時間の限られた学校環境では年齢が高い学習者のほうが速く伸びる。同じ量のインプットの後では開始年齢は成果を予測しない。早い開始が報われるのは大量で没入的なインプットがある場合 | 強（縦断研究） | Muñoz（バルセロナ年齢要因プロジェクト）、ACTFL の整理 |
| 日本で週数時間の英語接触が日本語の発達を損なうことを示す実証研究は、今回の検索では見つからなかった。懸念の多くは意見・コラム | 弱（見つからなかったという事実） | インターエデュの記事など |

### 1.6 利用時間の目安（公的機関。専門家合意で、効果を直接示したものではない）

| 事実 | 出典 |
|---|---|
| 1歳は座ったままの画面時間を推奨しない。2〜4歳は1日1時間まで、少ないほど良い。座っている時間は養育者との読み聞かせ・お話を推奨 | WHO 2019 ガイドライン（5歳未満） |
| 18か月未満はビデオ通話以外を避ける。18〜24か月は大人と一緒に。2〜5歳は質の高い内容を1日1時間程度、共視聴と現実への橋渡し。寝る1時間前と食事中は画面なし | AAP 2016「Media and Young Minds」（二次資料で確認） |
| 2歳まではテレビ・ビデオを控える。メディア接触は合計1日2時間まで、ゲームは30分まで | 日本小児科医会 2004 の提言（自治体資料の転載で確認。原文未確認） |

### 1.7 日本の制度での位置づけ

| 事実 | 出典 |
|---|---|
| 幼稚園教育要領は「健康・人間関係・環境・言葉・表現」の5領域。英語は独立した項目ではない。解説に「異なる文化に触れる活動」を通じて国際理解の芽生えを養う趣旨（文科省資料の要約経由、本文未取得） | 幼稚園教育要領・解説 |
| 保育所保育指針は国籍や文化の違いを認め互いに尊重する心に触れる。英語指導の規定ではない | 保育所保育指針解説 |
| 小学校の外国語活動（3・4年）は「聞くこと」「話すこと」が中心で、慣れ親しむことと動機づけがねらい。「日本語と外国語の音声の違い等に気付く」 | 小学校学習指導要領（平成29年告示）、大阪府教育センター資料 |
| 中学年の「聞くこと」の目標「文字の読み方が発音されるのを聞いて、どの文字か分かる」の「読み方」は**文字の名前**（B を「ビー」）で、文字が表す音ではない。文字は音声の補助。読む・書くは高学年から | 山形大学の論文、東京都教職員研修センター資料 |
| 2008年版 Q&A: 外国語活動は音声中心。文字は活字体の大文字・小文字に「触れる段階にとどめる」 | 文部科学省 Q&A（全文確認済み） |

### 1.8 国内外の幼児英語の実践の傾向（型だけ。中身は写さない）

- NHK「えいごであそぼ」系（1990年〜）: 歌・体操・ゲーム・お話で英語に触れる構成。目的は「英語は楽しい」と感じてもらうことと紹介されている（紹介記事。公式の文言は未確認）【弱】
- 国内の幼児英語アプリの紹介記事に共通する点: 2〜3歳は勉強形式だとすぐ飽きる・絵本や歌と組み合わせる・保護者がときどき一緒に使う・結果を急がず英語を好きになることを優先【弱】
- British Council の幼児クラス: 歌・決まった流れ（ルーティン）・テーマ別語彙・お話・体を動かす活動・工作。保護者には「絵本の時間」「決まった英語の時間」を勧める【中】

## 2. このアプリへの示唆（推測を含む）

1. **目標の置き方**: 英語力を身につけさせることではなく、「英語の音に親しむ」「日本語との音の違いに気づく」「ちがう ことばや 文化に興味を持つ」を目標にする（幼要・保指・小3外国語活動の目標・Muñoz と一致）。保護者向けの説明でも効果を盛らない。「早く始めると英語ができるようになる」とは書かない。
2. **随伴的な操作を主力にする**: 「聞く → 聞いた語に合う絵を1つ触る」だけが反応する形（Kirkorian 2016）。どこを触っても進む操作にしない。
3. **まずラベルをはっきり聞かせる**: いきなり選ばせない。最初の再生を2回にして（同じ語を間をあけて2回）、聞き終わってから選べるようにする（PLoS One 2020・Kirkorian 2016）。
4. **選択肢の数を年齢で変える**: 2歳段階 2択、3歳段階 2〜3択、4歳 3〜4択、5歳 4択（研究の傾向と ux-by-age の上限に合わせる）。
5. **正誤より「名前を返す」**: 触れた物の英語の名前を音声で言い返す（正解でも不正解でも）。違う物でも×や大きな不正解音を出さない。目当ての語をもう一度聞かせる（Harvard の結果を、正誤を強調しない方向に寄せる。UCI の指摘）。
6. **くり返しと少しの新しさ**: 同じ骨格（文型・絵）を何度も使い、語を1〜2語ずつ差し替える。オリジナルの短い絵本（4ページ程度）を同じ形でくり返す（Horst 2011）。同じ語を複数の遊び（タッチ・からだ・えほん・おみせ）で出す。
7. **からだを動かす（TPR）**: 「Jump!」「Clap your hands.」を聞いて動きの絵を選び、そのあと親子で体を動かす。体の動きは判定しない（判定はできないし、しない）。根拠は示唆の段階なので「効く」とは書かない。
8. **親子で使う前提**: 画面に「おうちの ひとと いっしょに まねして いって みよう」を入れる。保護者画面に遊び方の一言（いっしょに指さして英語で言う、など）を出す。2歳段階は大人と一緒が前提（WHO・AAP・日本小児科医会）。
9. **短く区切る**: 1回は 3〜5 問・数分で終わる（既存の区分ごとの1回の量と利用時間の目安を使う）。英語をおすすめ欄に出して日本語の遊びを押しのけない。
10. **日本語を置き換えない**: 指示・ヒント・解説は日本語（ひらがな）。英語は音声だけ。保護者には日本語の読み聞かせ・会話を減らさないよう一文を添える（母語への害の実証はないが、関わりの時間が公的な推奨のため）。
11. **文字は原則出さない**: 5歳でも必須にしない。出すなら「大文字を見て、文字の名前（エー、ビー）を聞いて選ぶ」まで、保護者が開いたときだけ（小3の目標「文字の名前を聞いて文字が分かる」の前段階）。フォニックス・書く練習は入れない。
12. **音あそびは5歳から・聞くだけ中心**: 4歳は同じ音で始まる語を聞いて楽しむ程度、5歳で「同じ音で始まる絵を選ぶ」まで。音素の分解は入れない（日本の幼児は英語の語彙がまだ少ないので優先度は低い）。
13. **歌**: 著作権のある童謡・歌詞は使わない。合成音声（Kokoro）は歌えないので、歌は入れない。リズムのある短い言葉（チャンツ）は、合成音声でリズムが崩れやすいので後回し（P2 以降、試聴で判断）。
14. **発音の評価をしない**: マイクを使わない。子が声を出すことは促すが、聞き取りも点数化もしない（制約どおり）。

## 3. 年齢別のまとめ（研究と実践資料からの推測）

| 段階 | 語・表現 | 遊び方 | 選択肢 |
|---|---|---|---|
| 2歳段階 | 1語の名詞（動物・食べ物） | 聞いて1つ触る。毎回ほぼ同じ構成。大人と一緒 | 2 |
| 3歳段階 | ＋乗り物・身の回りの物、色、簡単な動作の指示 | 聞いて触る、聞いて動きの絵を選び体を動かす | 2〜3 |
| 4歳 | ＋からだ・数1〜5・あいさつ・気持ち、短いお話 | 聞いて触る・TPR・オリジナルの絵本のくり返し | 3〜4 |
| 5歳 | 2語の句（three apples、a blue ball）、おみせごっこの決まった言い方、（任意）大文字の名前 | 句を聞いて絵を選ぶ、ごっこ遊びの言い方を聞いて親子で言い合う | 4 |

## 4. Kokoro（英語の合成音声）の評価

### 4.1 調べた事実

| 事実 | 強さ | 出典 |
|---|---|---|
| Kokoro-82M: Apache-2.0、82M パラメータ。学習データは数百時間（パブリックドメイン・Apache/MIT の音声、クローズドな TTS の合成音声）。v1.0 は 8言語・54声。G2P は misaki | 強（公式） | hexgrad/Kokoro-82M モデルカード |
| 声の評価: af_heart A（最上位）、af_bella A-、af_nicole・bf_emma B-、男声はほとんど C+ 以下（am_adam F+） | 中（公式の主観評価） | Kokoro-82M VOICES.md |
| v0.19 は公開前に TTS Spaces Arena の single-voice 部門で1位と報じられた。TTS Arena V2 は現在停止中で順位を確認できない | 弱〜中 | 二次情報、Hugging Face |
| Artificial Analysis Speech Arena の Elo は約1057〜1062。全体順位は資料によって 32/74 位、52 位など（商用の大きなモデルを含む）。「ブラウザで動くモデルでは1位」とする二次資料もある | 中 | Artificial Analysis、benchmarklist、offlinetts.com |
| 利用者の評価（2026年3月）: 「このサイズで最も自然」「男声が弱い」。一方「単語1〜2語を読ませるのが苦手」「six が ah-six-ah になる」。回避策として「The word is: six」のように文で読ませて切り出す | 弱〜中（利用者の意見） | Hacker News（ariya.io の記事のスレッド） |
| 新しい候補（Qwen3-TTS・Chatterbox・Kyutai Pocket TTS 等）と比べると、抑揚・表現力では一歩劣るという声が多い | 弱〜中 | 同上 |
| kokoro-onnx（本アプリが使う。MIT）は v1.0 から misaki の G2P を推奨。本アプリの generate_en.py は espeak-ng で音素に変換している（コードで確認） | 強（README とコード） | thewh1teagle/kokoro-onnx、scripts/voice/generate_en.py |
| misaki は辞書にない語を espeak に任せる。`[word](/IPA/)` で発音を上書きできる。数字は num2words で単語にする | 強（README） | hexgrad/misaki |
| 単語ごとのタイムスタンプは公式の kokoro（KPipeline）の英語で取れる（コミュニティのコードで確認。公式文書には無い）。kokoro-onnx の README には無い | 中 | Hugging Face Space の app.py |
| 文字の名前（A、B…）・数字の連続で Kokoro 固有の不具合報告は見つからなかった（未確認） | − | − |

他のオフライン英語 TTS（事前生成の候補として。ライセンスは要再確認）:

| モデル | ライセンス | 所見 |
|---|---|---|
| Piper | 本体は GPL-3.0（piper1-gpl。旧 rhasspy/piper は MIT でアーカイブ）、声ごとに別 | 軽いが自然さは Kokoro より下という評価が一般的（推測寄り） |
| Qwen3-TTS | Apache-2.0（重みも） | 0.6B/1.7B。表現力は高いが重い。事前生成なら候補 |
| Kitten TTS | コード Apache-2.0、重みは版ごと（KittenTTS 2 は商用に制限） | 軽い。品質は Kokoro より下と見られる |
| F5-TTS | コード MIT、重み CC-BY-NC-4.0（二次情報） | 非商用に限られるので避ける |
| Chatterbox | MIT、生成音声に透かし | − |
| Kyutai Pocket TTS | MIT とされる（二次情報のみ、未確認） | 「Kokoro より抑揚が良い」という声 |

### 4.2 結論（「Kokoro って自然な発音？」への答え）

- **文や短い句を読ませるなら、オフラインで CPU で動く軽いモデルとしては今もかなり自然な部類**（根拠: 中〜強）。ただし、2026年の大きな最新モデルと比べると抑揚・表現力は一歩劣る（根拠: 中）。
- **幼児モードで多い「単語1語」「文字の名前」は Kokoro の苦手な形**で、前後に余計な母音が付く・抑揚が不自然になることがある（根拠: 中、利用者報告）。いまの台本は文字 "A" を text のまま espeak-ng に渡しているので、冠詞の /ə/ と読まれる危険がある（推測）。
- ライセンス（Apache/MIT）・オフライン事前生成・CPU で動くことを合わせると、Kokoro を続けるのが妥当（推測）。品質をさらに上げたい場合だけ、Qwen3-TTS（Apache-2.0）で幼児の語だけを事前生成して聞き比べる。Piper（GPL）・F5-TTS（重みが NC）・KittenTTS 2（商用制限）は避ける。

### 4.3 改善策（設計書 7章で具体化）

1. **全件を耳で確かめる**: 幼児の英語は約250本なので全部聞ける。語尾に余計な母音・抑揚の崩れ・誤読に印を付け、直したものだけ ready にする（architecture.md 10章「聴感は未確認のため、試聴して問題が無いものだけ ready」と同じ）。
2. **単語は文の形で書く**: `Dog.` のように先頭を大文字にし句点を付ける。それでも崩れる語は `say`（綴りの言い換え）か `phonemes`（IPA）で固定する。生成スクリプトは `say`・`phonemes` に対応済み。
3. **キャリア文を使う**: 「It's a dog.」「Where is the dog?」は文のまま使う（幼児への語りかけとして自然）。単語だけを切り出す処理はしない（kokoro-onnx に単語の時刻が無いため）。
4. **文字の名前は IPA で固定**: A=eɪ、B=biː…、W=dʌbəljuː、Z=ziː。既存の en-g34 の文字の音声もついでに聞き直す。
5. **数は単語で書く**: "6" ではなく "six"。"1st"・"3:00" のような表記は台本に入れない。
6. **ゆっくりは「間」で作る**: 話速は基準 0.85 のまま（倍率 1.0、文は 0.95 まで）。0.7 未満は音が伸びて不自然になりやすい。聞き取りやすさは「同じ語を2回、間を 700ms」のくり返しで作る。
7. **声は af_heart に統一**: af_bella と10語ほど聞き比べて記録する（変えるなら全件そろえる）。男声は使わない。
8. **G2P を misaki に替えるかは別の作業**: 替えると英語の全音声（en-g34・en-g56 を含む）の作り直しになる（`EN_PIPELINE_VERSION` を上げる）。まず幼児の語で聞き比べてから判断する。

## 5. 出典

| 資料 | URL | 所見 |
|---|---|---|
| Kuhl, Tsao & Liu 2003 | https://www.pnas.org/doi/10.1073/pnas.1532872100 | 生身の話者だけで音の学習【強】 |
| Lytle ら 2018 | https://www.pnas.org/doi/10.1073/pnas.1611621115 | 仲間がいるとタッチ画面の学習が改善【強】 |
| ビデオ欠損のレビュー | https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2018.02195/full | 年齢・反復で縮小【強】 |
| Xie ら 2018 | https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6305619/ | 0〜5歳 d=0.46【強、本文未読】 |
| Kirkorian ら 2016 の紹介 | https://www.childrenandscreens.org/learn-explore/research/young-child-learning-attention-and-screen-use-heather-kirkorian-phd/ | 随伴的タッチ【中〜強】 |
| Kirkorian ら 2016 | https://www.scinapse.io/papers/2306007265 | Child Development 87 |
| PLoS One 2020 | https://pmc.ncbi.nlm.nih.gov/articles/PMC7707543/ | 見て聞くだけの群が高得点【強】 |
| Lovato & Waxman 2016 | https://childdevelopment.northwestern.edu/files/2019/05/LovatoWaxman2016Frontiers.pdf | 共同メディア関与【中】 |
| Madigan ら 2020 | https://jamanetwork.com/journals/jamapediatrics/article-abstract/2762864 | 共視聴は正の関連【中】 |
| Hirsh-Pasek ら 2015 | https://www.psychologicalscience.org/publications/educational-apps.html | 4本柱【強】 |
| Horst ら 2011 | https://www.frontiersin.org/articles/10.3389/fpsyg.2011.00017/text | 同じ絵本のくり返し【強】 |
| Horst 2013 | https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3619249/ | くり返しの説明 |
| Harvard Reach Every Reader | https://reacheveryreader.gse.harvard.edu/which-mobile-app-feedback-and-leveling-designs-best-scaffold-preschool-learning | 名前を返すフィードバック【中】 |
| UC Irvine | https://news.uci.edu/?p=36407 | 褒めるだけのフィードバックが多い |
| Joan Ganz Cooney Center | https://joanganzcooneycenter.org/publication/the-new-coviewing-designing-for-learning-through-joint-media-engagement/ | 共同メディア関与の設計 |
| 同 Playing together | https://joanganzcooneycenter.org/?p=17407 | 年齢別の親子共同プレイ |
| Reading Rockets | https://www.readingrockets.org/topics/developmental-milestones/articles/development-phonological-skills | 音韻の発達段階【中】 |
| Frontiers 2019（音韻意識） | https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2019.02072/pdf | onset-rime は4歳ごろ |
| Good ら 2015 | https://journals.sagepub.com/doi/full/10.1177/0305735614528833 | 歌の効果（9〜13歳）【中】 |
| Thai TESOL Journal | https://so05.tci-thaijo.org/index.php/thaitesoljournal/article/view/252356 | 歌と TPR【小規模】 |
| TEYLIN | https://jurnal.umk.ac.id/index.php/teylin/article/view/15332 | 3歳児の TPR 事例【弱】 |
| Education Week | https://www.edweek.org/teaching-learning/study-shared-book-reading-boosts-english-learners-language-skills/2018/08 | 読み聞かせのメタ分析の報道 |
| Pollard-Durodola ら | https://digitalscholarship.unlv.edu/ecs_fac_articles/18 | 教えた語彙には効果【RCT】 |
| Muñoz | https://www.enl.auth.gr/gala/14th/Papers/Invited%20Speakers/Munoz.pdf | 開始年齢【強】 |
| ACTFL | https://www.actfl.org/research/research-briefs/the-impact-of-early-language-learning | 早期開始の効果の条件 |
| NELP 2008 の論評 | https://www.readinghalloffame.org/sites/default/files/Teale_et_al_EdRsrchr_NELP_2010.pdf | アルファベット知識・音韻意識 |
| 韓国の onset-rime 研究 | https://dl.nanet.go.kr/detail/KINX2025232871 | 音韻意識の転移 |
| WHO 2019 | https://www.who.int/publications/i/item/9789241550536 | 2〜4歳は1時間まで |
| WHO 報道発表 | https://www.who.int/news/item/24-04-2019-to-grow-up-healthy-children-need-to-sit-less-and-play-more | 同上 |
| AAP の解説 | https://mdedge.com/content/new-screen-time-guidelines-address-rapid-changes-media-environment | 二次資料 |
| CHLA | https://www.chla.org/blog/rn-remedies/new-guidelines-screen-time-kids | 二次資料 |
| 日本小児科医会の提言（広島市の転載） | https://www.city.hiroshima.lg.jp/_res/projects/default_project/_page_/001/023/655/52598.doc | 2歳まで控える |
| 旭川小児科医会の資料 | https://www.city.asahikawa.hokkaido.jp/kurashi/218/225/227/d083675_d/fil/media.pdf | 現行の目安（二次） |
| 文科省 Q&A | https://www.mext.go.jp/a_menu/shotou/new-cs/qa/11.htm | 文字は触れる段階（全文確認） |
| 山形大学の論文 | https://yamagata.repo.nii.ac.jp/record/2000258/files/gstt-14-02460249.pdf | 「読み方」は文字の名前 |
| 東京都教職員研修センター | https://www.kyoiku-kensyu.metro.tokyo.lg.jp/09seika/reports/files/bulletin/h29/materials/h29_2_012.pdf | 文字は音声の補助 |
| 大阪府教育センター | https://www.osaka-c.ed.jp/category/forteacher/shingakushu_point/syotyu/1_10_shingakushu_point_sho_gaikokugo_gaikokugogatudou.pdf | 外国語活動のねらい |
| 文科省（幼稚園教育要領解説を引く資料） | https://www.mext.go.jp/content/20260625-mxt_youji-000050697_14.pdf | 異なる文化に触れる（本文未取得） |
| 保育所保育指針解説 関連 | https://www.mext.go.jp/content/1421517_02.pdf | 文化の違いを認める心 |
| British Council NZ | https://britishcouncil.org.nz/help-your-child-learn-english | 家庭での絵本の時間 |
| British Council France | https://www.britishcouncil.fr/sites/default/files/eng_british_council_cursus_maternelle_ps.pdf | 幼児クラスの構成 |
| デイリースポーツ | https://www.daily.co.jp/gossip/2017/02/15/0009918108.shtml | えいごであそぼ の構成（型のみ参考） |
| English Hub | https://englishhub.jp/news/nhk-english-program-for-kids.html | 紹介記事 |
| HugKum | https://hugkum.sho.jp/32013 | 国内アプリの傾向 |
| Migaku | https://migaku.com/ja/blog/language-fun/eigo-gakushu-app-kodomo-muke | 国内アプリの傾向 |
| インターエデュ | https://www.inter-edu.com/article/?p=23198 | 母語への懸念（意見） |
| Kokoro-82M モデルカード | https://huggingface.co/hexgrad/Kokoro-82M | ライセンス・学習データ |
| VOICES.md | https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md | 声の評価 |
| hexgrad/kokoro | https://github.com/hexgrad/kokoro | KPipeline |
| hexgrad/misaki | https://github.com/hexgrad/misaki | G2P・IPA の上書き |
| kokoro-onnx | https://github.com/thewh1teagle/kokoro-onnx | misaki 推奨 |
| HN スレッド | https://hn.svelte.dev/item/48821576 | 単語1語が苦手 |
| ariya.io | https://ariya.io/2026/03/local-cpu-friendly-high-quality-tts-text-to-speech-with-kokoro | CPU で実用速度 |
| Artificial Analysis | https://artificialanalysis.ai/text-to-speech/models/kokoro-82m-v1-0 | Elo |
| benchmarklist | https://benchmarklist.com/models/kokoro-82m-v1.0/ | 順位（二次） |
| offlinetts.com | https://offlinetts.com/blog/kokoro-tts-complete-guide/ | 順位（二次） |
| TTS Arena V2 | https://huggingface.co/spaces/TTS-AGI/TTS-Arena-V2 | 停止中 |
| Piper の評 | https://www.promptquorum.com/power-local-llm/piper-tts-review | GPL-3.0 |
| Qwen3-TTS | https://gigazine.net/gsc_news/en/20260123-qwen3-tts-family-opensource | Apache-2.0 |
| Qwen3-TTS ガイド | https://betterstack.com/community/guides/ai/qwen3-tts/ | 重みのライセンス |
| Kitten TTS | https://huggingface.co/KittenML/kitten-tts-nano-0.1 | 軽量 |
| kittenml（PyPI） | https://pypi.org/project/kittenml/0.9.3/ | 重みのライセンス |
| F5-TTS | https://www.promptlayer.com/models/f5-tts | 重み NC（二次） |
| MeloTTS | https://replicate.com/cjwbw/melotts | MIT |
| Chatterbox | https://www.resemble.ai/learn/models/chatterbox | 透かし |
| Pocket TTS | https://tts.ai/voices/pocket-tts/ | 二次情報のみ |
| 単語タイムスタンプの例 | https://huggingface.co/spaces/sdafd/KOKORO-TTS-1.0/blob/e78a5ff19b105629abd9cd57a1ff8cd6428bc5b2/app.py | KPipeline の利用例 |
