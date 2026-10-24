# 教材パック実装の共通の依頼（docs/expansion/pack-brief.md）

統括（Opus）が書いた、教材パック担当への共通の前提。個別の依頼文はこのファイルを読む前提で書く。

## 目的
curriculum-matrix.md の自分の担当の単元を、**子供が実際に学べる質と量**で作る。P1 はすべて「実装済み」（1.1）を目指す。量が足りない単元は正直に partial にする（P1 を P2 に落として数を合わせない）。

## 必ず読むもの（この順）
1. `docs/expansion/curriculum-matrix.md` の 0〜2章（受入条件・横断の規則）、自分の単元の行、5.2（前提の鎖）、7章（パックの依存）
2. `docs/expansion/engines.md`（各エンジンの問題データの書き方。統括が作成）と `src/curriculum/types.ts`（単元・問題の型）
3. **見本の単元** `src/packs/g1-math/add-basic.ts` とそのテスト `src/packs/g1-math/g1-math.test.ts`（書き方の手本: 到達項目・同一性キー・誤概念・3段のヒント・解説・別例・定義域から均等に生成）
4. `src/curriculum/qa.ts`（自動検査。あなたのテストから `checkUnit` を呼ぶ）
5. `docs/expansion/ux-by-age.md`（年齢別の量・操作・選択肢の数）、`DESINGN.md` 4章・17章（文字・ふりがな）

## 置き場所と形
- `src/packs/<packId>/index.ts` が `PackContent = { packId, units: UnitSpec[] }` を default export。単元は1ファイル1単元（`<単元名>.ts`）。
- テスト `src/packs/<packId>/<packId>.test.ts`: 全単元に `checkUnit` を呼び、`errors` が空であること。`status: 'ready'` と書いた単元は `isReady` が true であること（見本のテストをそのまま写してよい）。
- **パックは他のパックを import しない**。本体のモジュールを値で import してよいのは core/util/rng・text/kanji-grades・text/rich・core/answer/number だけ（pack-runtime。型の import は自由）。共有のコード（生成の部品など）が要るときは統括に提案する。編集してよいのは `src/packs/<自分のpackId>/**` と、新しい絵を描くときの `src/illust/content/<packId>.tsx`（下記）だけ。
- 単元の `domain` は `src/curriculum/subjects.ts` の領域ID（算数 A-number / B-shape / C-measure / D-data、国語 kotoba / kanji / yomu / kaku、など）。幼児は自由（例 'play'）。

## 書き方の規則（すべて自動検査か統括のレビューで確かめる）
- **オリジナル**: 他社の教材・教科書・テストの問題、文章、紙面、図、キャラクター、音声を写さない（似せた言い換えもしない）。読解の本文は自作。昔話・古典は著作権の切れた原典から自分で再話する。実在の人物・団体・商品名を出さない（歴史の人物は学習指導要領に例示された人物だけ）。
- **漢字**: 教材の文の漢字は必ず `漢字《よみ》`。単元の学年より上の学年の字は原則ひらがな（教科の用語で必要なものだけ《よみ》付き。curriculum-matrix 2.1）。読み問題の答えの字は `漢字《!よみ》`（ふりがなを出さない）。書き問題では答えの字を問題文・ヒントに出さない。
- **小1・小2**の問題文は分かち書き（文節で空白）。幼児はひらがなだけ（カタカナは身近な語のみ）。
- **ヒント**: 幼児2段、小学生3段（①何を見るか ②図・途中式の一部 ③最後の一手を残した途中まで）。どの段も答えそのものを書かない。
- **解説**: 問題ごと（生成ならテンプレートごと）。答えと理由。責めない文。
- **誤概念**: 計算・概念の単元は3つ以上、他は2つ以上。誤りの選択肢・入力に誤概念IDを付ける（付いていない誤りの選択肢は全体の20%以下）。説明は「〜と かんがえたのかな」の調子で、正しい考え方へ導く。
- **到達項目**: 2〜8。各到達項目に、練習の異なる問題 6 以上と、表し方を変えた問題（`alt: true`）3 以上。
- **同一性キー**（curriculum-matrix 1.4）: 数値だけ違う文章題は同じ場面、交換しただけの式は（学習内容でなければ）同じ。生成器は**定義域から均等に**選ぶ（生成のあとで数をずらすと偏る。見本の `pickPair` を参照）。
- **量**（1.3）: 計算 100（定義域が小さければ全件。`domainSize` を書く）、概念 生成60/手作り30、読解 本文6本以上（目標8）・設問30以上、知識 全件・1項目2問以上、探究 場面6・設問24、遊び 12（2歳段階は8）。
- **正答の定義**（2.4）: 表記ゆれ・等価・許容誤差・順不同を問題データに持たせる。形式だけの違いは誤答にしない。
- **年齢**: 選択肢の数は ux-by-age の上限まで。2〜3歳はタップだけ・選択肢2（2歳段階）。
- **色**: 色だけで区別する問題にしない。赤と緑を同時に区別させない（DESINGN 3.1）。
- **絵**: 既存の絵（`src/illust/` のID。`npm run dev` で `/gallery.html` を開くと一覧）を使う。足りない絵は `src/illust/content/<packId>.tsx` に既存と同じ画風（輪郭 #4A3B32・太さ 3.5・平塗り・`palette.ts` の色だけ・文字を描き込まない）で描き、`export const <packId>Illust: IllustGroup` として公開する（登録は統括）。図（数・図形・表・グラフ）は `figure`（src/engines/figure/types.ts）で書く。
- **根拠**: 各単元の `basis` に学習指導要領の該当（例「算数 第1学年 A(2)」）、学年の割当が本アプリの案なら `gradeIsAppProposal: true`。

## 第1陣で分かった注意（2026-10-24 追記）
- **問題文は自動で読み上げられる**（小1・小2は既定で自動）。読む力を見る問題（字・語・文を読ませる）は、読ませたい字・語・文を問題文に書かず、図（`figure: { kind: 'text', … }`）か選択肢に出す。選択肢は自動では読み上げない。
- **算数の図のエンジン（clock・measure・numberline・graph・geometry）には `figure` を付けない**（図はエンジンが描く）。
- 単元ごとのテストに、学年より上の漢字を使っていないか・選択肢の数が上限以内か・id が重複しないか、の検査を足すとよい（g1-ja・g2-ja のテストを参照）。
- 計算の単元は、正答で正解・誤答例で誤概念どおりに誤り、を全段階で確かめるテストを足す（g1-math のテストを参照）。
- 定義域の大きさ（`domainSize`）は、同一性キーの数え方（交換を同じとみるか）と一致させる。学習内容によって交換を別の問題とする判断は、理由を basis かコメントに書く（g1-math add-carry の例）。
- 書いた文は自分で一通り読み直す（「さらに」→「おさらに」のような誤りが見つかる）。
- 単元を作り終えたら `npm run build:unit-index` を実行する（index.ts の無い作業中のパックは飛ばす）。

## 検査とコマンド（Windows PowerShell。各コマンドの前に PATH の設定）
```
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
npx vitest run src/packs/<packId>
npx tsc -b
npx eslint src/packs/<packId>
npm run build:unit-index   # 単元を足したら索引を作り直す（src/curriculum/unit-index.json）
npm run check:design
```
他の担当が作業中のファイルの誤りは無視してよい（自分のファイルの誤りは0にする）。git のコミットはしない（統括が行う）。`unit-index.json` は複数の担当が同時に作り直すので、最後に必ず `npm run build:unit-index` をもう一度実行する。

## 報告
- 単元ごとの表: 単元ID・状態（ready / partial と理由）・Q・C（到達項目）・問題数・誤概念の数・汎用誤答の割合（`checkUnit` の値）。
- 作った絵（ID）、エンジンへの要望、curriculum-matrix と違う判断（理由）、未確認のこと（内容の正しさで自信がないもの）。
