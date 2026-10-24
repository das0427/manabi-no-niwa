# 拡張 アーキテクチャ（docs/expansion/architecture.md）

版 2.1-draft（2026-10-24, review-1 反映。前版 2.0-draft） / 責任: Opus（統括）
design-review-1.md（docs/expansion/reviews/）の判断を反映。判断の正本はレビュー表で、本書の該当箇所に `（R#n）` を付ける。
前提: 初期版 docs/architecture.md の構成（Vite + React + TS、自前 Service Worker、IndexedDB、Web Audio、ハッシュルーター、ModeRunner）を**活用**し、全面書き直しはしない（X-NF-01）。本書は追加・変更点を定める。

---

## 1. 全体像

```
src/
├─ core/            （既存）audio / storage / progress / session / offline / util / answer（数・ローマ字の判定）
├─ audience/        対象区分・支援設定・画面表現（新）
├─ curriculum/      単元の索引（軽いメタデータ）・前提関係・おすすめ・復習（新）
├─ text/            ふりがな付きの文・数式の表記（RichText）と描画（新）
├─ engines/         共通の問題形式エンジン（choice, number, order, … ）（新）
├─ units/           UnitRunner（単元の実行枠）・UnitMap（単元の地図）（新）
├─ packs/<packId>/  小学生の教材パック（学年×教科）。各単元の問題データ・生成器・台本（新、遅延読み込み）
├─ modes/           （既存）幼児のモード部品。再設計後も使うものは legacy エンジンとして呼ぶ
├─ drawing/         おえかき（文書モデル・描画・道具・保存・作品一覧）（新）
├─ illust/          （既存）イラスト。はんこ素材を追加
├─ parent/          （既存）保護者画面。教材パック・単元・作品タブを追加
└─ app/             （既存）起動・ホーム。区分別ホームに分ける
```

境界（X-NF-02）: 対象（audience）・UI（engines/app）・スキル（curriculum）・教材（packs）・問題形式（engines）・判定（engines/*/judge.ts と packs の生成器）・進度（core/progress）・作品（drawing, core/storage）・素材（illust, public/audio）を分ける。教材パックは UI を持たず、データと生成器と台本だけを持つ。
- パック間で共有するコードは `engines/`・`core/` に置き、コアに含める（パック同士で import しない。R#5、6章）。

## 2. 対象区分とプロフィール（audience/）

```ts
type AudienceId = 'toddler' | 'p4' | 'p5' | 'g1' | 'g2' | 'g3' | 'g4' | 'g5' | 'g6';
// toddler = 2〜3歳（内部段階 toddlerStage: 2 | 3）

interface LearnerProfileV2 {
  // v1 Profile（id, name, avatar, createdAt）に追加
  audience: AudienceId;          // 「いま主に使う区分」（ホームと既定の教材）
  toddlerStage?: 2 | 3;
  enrolledGrade?: 1 | 2 | 3 | 4 | 5 | 6 | null; // 在籍学年（就学前は null）
  ageGuide?: string;             // 年齢の目安（自由記述ではなく 'y2'..'y12' の選択。生年月日は保存しない）
}
interface SupportSettings {      // ChildSettings に追加
  furigana: 'unlearned' | 'all' | 'none';   // がくねんに あわせる／すべて／なし（4章）
  readAloud: 'always' | 'button' | 'off';
  textScale: 1 | 1.15 | 1.3;
  instruction: 'short' | 'normal';
  style: 'gentle' | 'standard' | 'calm';    // 画面表現
  drawingTools: 'simple' | 'detailed';
  effects: 'on' | 'quiet' | 'off';          // 効果音・演出
}
```
- 習熟度は単元ごとの進度（core/progress）で持ち、上の項目とは独立（X-TG-02）。
- 区分を変えても、記録・作品・習熟度は変えない（X-TG-04）。区分変更時は `style` などの初期値を**提案**するだけ（保護者が決定）。
- 既定値（実装: `src/audience/audience.ts` の `defaultSupport`）: toddler/p4/p5 → gentle・always・simple・effects on・instruction short、g1–g2 → standard・always・simple・on、g3–g4 → standard・button・detailed・quiet、g5–g6 → calm・button・detailed・off。
- 区分の設計値（選択肢の上限・1回の問題数・残り量・利用時間の目安・`recordMastery` 等）は `audienceUx()`。値の正本は ux-by-age.md 1章。
- **2歳段階**（toddlerStage=2。R#8、progress.md 統括の判断1）: `recordMastery=false`（実装済み）。進度の判定 `evaluate` を呼ばない（段階は保護者が固定、既定は最初の段階）。attempts は記録するが、保護者画面では「あそんだ内容」としてだけ見せる（正誤・ヒント数・「むずかしそう」を出さない）。利用時間の目安の既定 5分。正誤の効果音を鳴らさず、行動の実況（「おいたね」）だけ（R#34）。

## 3. 単元・スキル（curriculum/）

```ts
interface UnitMeta {
  id: string;                 // 'g3.math.division-basic'（curriculum-matrix の単元ID）
  audiences: AudienceId[];    // 主な対象（先取り・さかのぼりは全区分から開ける）
  subject: SubjectId;         // 'kokugo' | 'sansu' | 'seikatsu' | 'rika' | 'shakai' | 'eigo' | 'program' | 'play'（幼児）
  domain: string;             // 'A-number' 等
  title: RichText;            // ふりがな付き
  icon: string;               // IllustId
  engine: EngineId;
  levels: LevelDef[];         // v1 と同じ（chance つき）
  prereq: string[];           // 単元ID
  pack: PackId | 'core';      // 'g3-sansu' 等。幼児（toddler/p4/p5）の単元は 'core'（6章、R#20）
  status: 'ready' | 'partial' | 'planned';  // 'planned' は子供画面に出さない
}
```
- 単元の索引（全単元の UnitMeta）は軽量な JSON として本体に同梱し、起動時に読む（数百件・数十KB）。小学生の問題データは教材パックにあり、単元を開くときに読み込む（X-OF-04）。
- スキルID = 単元ID（文字列）。v1 の SkillId（'shop' 等）は幼児の legacy 単元のIDとしてそのまま使う（§9 移行）。
- 進度と復習（実装: `src/curriculum/review.ts`、ストア `unitProgress`、キー `[profileId, unitId]`）:
  ```ts
  interface ReviewState {
    stage: 'none' | 'learning' | 'learned' | 'secured';  // まだ／とりくみちゅう／できた／しっかりできた
    reviewDue: number | null;   // 次の復習の時刻
    reviewStep: number;         // 通過した復習の回数 0〜3 → 次まで 1日, 3日, 7日, 21日
    lastReviewAt: number | null;
  }
  ```
  - `learned`: 最上段で mastered（v1 の進む規則）に達した。`reviewDue = now + 1日`。
  - 復習（1回 3問程度、**別の seed／別の表現**で出す）で自力2/3以上 → reviewStep+1。3回目の復習を通過 → `secured`。復習で支援が多い → `learning` に戻し翌日にもう一度復習（段階は下げない）。
  - 復習は「きょうの おすすめ」に出す（強制しない）。
- **復習の優先順位と滞留**（R#14）:
  - 優先度 ＝ 超過日数 ×（後続単元の数 ＋ 1）。後続単元＝その単元を prereq に持つ単元。
  - おすすめに出す復習は**同じ教科で1日1件まで**。残りは単元の地図の時計の印（ふくしゅう まち）で示す。
  - 超過が間隔（REVIEW_INTERVAL_DAYS[reviewStep]）の **2倍以上**なら reviewStep を1つ戻す（stage は下げない）。
  - 復習用に「別の表現の問題 ≥2 種」を単元の ready 条件に含める（acceptance.md 2章）。

## 4. 文の表記（text/）

- RichText は文字列の小さな記法（実装: `src/text/rich.ts`）: `漢字《かんじ》`（ふりがな）、`漢字《!かんじ》`（学習対象の字。よみは音声に使い、ふりがなは表示しない。R#12）、`[[3/4]]`（分数）、`[[2 1/3]]`（帯分数）、`**強調**`、`{{空欄}}`。
- 描画（`<Rt text=… />`）はプロフィールの `furigana` と在籍学年から、語ごとにふりがなを出すか決める（R#12、progress.md 統括の判断3）:

| 設定 | 配当学年 ≥ 在籍学年 の字（その学年で習う途中の字・上の学年の字） | 配当学年 < 在籍学年 の字（前の学年までに習った字） |
|---|---|---|
| 'unlearned'（保護者画面「がくねんに あわせる」、既定） | 付ける | 付けない |
| 'all'（すべて） | 付ける | 付ける |
| 'none'（なし） | 配当学年 = 在籍学年 の字は付けない。配当学年 > 在籍学年 の字は**常に付ける** | 付けない |

  - 就学前（在籍学年 null）と配当外の漢字は「配当学年 > 在籍学年」と同じ扱い（v2.0-draft の「就学前・配当外は全部」を維持）。
  - `《!…》` の語は設定にかかわらずふりがなを出さない（読み単元の答えの漢字に使う）。読み単元の答えの漢字が `《!…》` で抑制されていることを単体テストで検査。
- 漢字の配当学年表 `text/kanji-grades.ts`（学年別漢字配当表 1026字。学習指導要領 別表。事実のデータ）。
- **規則（検査）**: 教材の文中の漢字は、必ず `《》` でよみを付けた語の中にある（ふりがなを付けるかは表示側が決める）。例外は数字。`findBareKanji` で全教材を単体テストで検査。
- 音声: 台本の読み（yomi）は RichText の《》から作る（`spokenReading`。漢字の読み誤りを防ぐ）。`《!…》` のよみも音声には使う。

## 5. 問題形式エンジン（engines/）

curriculum-matrix.md のエンジン ID（choice, number, order, match, sort, fill, build, trace, clock, measure, numberline, graph, geometry, map, reading, listen, program, experiment, explain, legacy）。

```ts
interface ItemBase {
  id: string;            // パック内で一意（生成問題は 'gen:<seed>:<index>'）
  unitId: string;
  level: number;
  engine: EngineId;
  prompt: RichText;      // 問題文（画面上部）
  voice?: string[];      // 台本キー（無ければ prompt の読みを使う）
  hints: [RichText, RichText];
  explanation: RichText;           // 解説（正解・つぎへ の後）
  misconceptions?: { when: unknown; explain: RichText }[];  // 典型的な誤りへの説明
  basis?: string;        // 根拠（学習指導要領の該当等）
  revised: string;       // 'YYYY-MM-DD'
}
// 各エンジンが ItemBase を拡張（例: NumberItem { answer: NumberAnswer; unit?: string }）
```
- エンジンは React 部品＋純粋な判定関数（`judge(item, response) → { correct, misconception? }`）。判定は単体テストする。
- 共通の画面の区画（X-UX-05）: 上＝問題文（RichText）、中央＝作業領域（図・操作）、下＝回答欄・選択肢、左下＝ヒント、右下＝つぎへ／こたえあわせ。解説は回答欄の上に開く。数の入力の単元は作業領域の右 1/3 に数字キーの区画を置く（DESINGN.md 18章、R#21）。

### 5.1 数の答えの判定（X-QA-03）
実装: `src/core/answer/number.ts`。値は有理数（整数の分子・分母）で正確に比べ、浮動小数点で比べない（R#13、実装済み）。
```ts
type NumberAnswer =
  | { kind: 'int'; value: number }
  | { kind: 'decimal'; value: number; places?: number }     // places 指定時はその桁まで
  | { kind: 'fraction'; num: number; den: number; mustReduce?: boolean;
      allowImproper?: boolean; allowMixed?: boolean; allowDecimal?: boolean }
  | { kind: 'quantity'; value: number; unit: string; acceptUnits?: { unit: string; factor: number }[]; tolerance?: number }
  // 追加（R#13。未実装。フィールドの細部は実装時に確定）
  | { kind: 'quotientRemainder'; quotient: number; remainder: number }   // 「商 あまり」を別の欄で入力
  | { kind: 'ratio'; a: number; b: number; mustSimplest?: boolean }      // 比。mustSimplest で最も簡単な比を目標にする
  | { kind: 'set'; values: NumberAnswer[] }                              // 複数の答え（順序を問わない）
type Verdict =
  | { result: 'correct' }
  | { result: 'wrong'; misconception?: string }
  | { result: 'retry'; reason: 'reduce' | 'form' | 'unit' | 'unreadable' };  // 誤答にせず、もう一度
```
- 分数: 値が等しければ正解（2/4 と 1/2）。`mustReduce`（約分が目標の単元）のときだけ約分していないものを `retry`（「約分できるよ」）にする。仮分数⇔帯分数も目標でなければ等価として受け入れる。
- 小数と分数: `allowDecimal` の単元だけ等価（0.5 と 1/2）。
- 単位: 単位換算が目標でない限り、換算後の値が等しければ正解。許容誤差は概数・測定の単元だけ（`tolerance`）。
- 入力形式だけの誤り（全角・余分な0）は正規化してから判定。
- **中立の「もう一度」**（R#13）: questionFlow（core/session）に `nudge()` を追加する。`retry` の判定で呼び、wrongTries を増やさず短い声（例「やくぶん できるよ」）を返す。同じ問題で2回まで。3回目の `retry` は wrong として扱う。

### 5.2 legacy エンジン
初期版のモード部品（src/modes/*）は `legacy` エンジンとして UnitRunner から呼ぶか、ModeRunner のまま幼児ホームから呼ぶ。再設計の判断は curriculum-matrix.md 4章。

### 5.3 UnitRunner の中断と再現（R#31）
- 中断データのキーは `[profileId, unitId]`（v1 の drafts の `[profileId, modeId, variantId]` とは別）。
- 生成問題は seed と番号（`gen:<seed>:<index>`）で再現する。手作り問題の並びも seed で決める（再開時に同じ順で続く）。
- 学習連携の作品（7.1 の `origin.kind='lesson'`）は attempts を作らない。UnitRunner では「描いた＝完了」として扱う（R#35）。

## 6. 教材パック（packs/）と取得（X-OF-01〜04）

### 6.1 パックの範囲（R#20）
- **幼児（toddler/p4/p5）の教材はコアに同梱**する（パックにしない）。初回のオフライン準備で必ずそろう。
- 小学生の教材だけをパックにする。パック = 学年×教科（例 `g3-sansu`, `g3-kokugo`）。packId に '@' を使わない（R#26）。
- `packs/<packId>/index.ts` が `PackContent = { units: Record<unitId, UnitContent> }` を default export。UnitContent は手作り問題の配列か、生成器（`generate(level, seed, count) → Item[]`）。

### 6.2 ビルド（R#5）
- 遅延読み込み: `import(\`../packs/${id}/index.ts\`)`。Vite の `manualChunks` でパック配下のモジュールを `packs/<id>/` のチャンクに閉じ込める。
- パック間で共有するコードは `engines/`・`core/` に置いてコアに含める規約（1章）。
- `npm run check:packs`: 「各パックの入口から辿れるチャンクが、コアかそのパック自身だけ」であることを build manifest から機械検査する。
- precache プラグイン（scripts/vite-plugin-precache.ts）: `assets/packs/**` と `audio/<packId>/**` をコアの `__MNW_FILES__` から除外し、`dist/packs.json` を出力する: `{ [packId]: { files: string[], bytes: number, hash: string } }`。**コアの版ID（`__MNW_VERSION__`）にパックの内容を含めない**（パックだけの更新でコアを入れ直さない）。`packs.json` 自体はコアに含める。
- 音声は `public/audio/<packId>/*.mp3`。

### 6.3 取得とキャッシュ（Service Worker と保護者画面。R#4、R#26）
- コアのキャッシュ `mnw-<版ID>`: アプリ本体・フォント（11章）・共通音声・単元の索引・幼児の教材・`packs.json`。従来どおり一括。**install はコアだけで完了**する（パックの取得に結び付けない）。
- パックのキャッシュ `mnw-pack/<packId>@<hash>`（例 `mnw-pack/g3-sansu@<hash>`。'@' で packId と hash に分解）。
  - cleanupCaches の対象外。現行の cleanupCaches は `mnw-` で始まる名前を対象にするため、`mnw-pack/` で始まる名前を**明示的に除外**する。
  - 取得はページから Cache API（`addAll` 相当）で行い、取得した hash・bytes・時刻を IndexedDB の `packsMeta`（キー packId）に記録する。
- 初回準備（小学生のプロフィール）: 「コア → そのプロフィールの区分の既定パック（例 g3 なら g3-kokugo, g3-sansu, …）」の2段階で進め、**両方そろうまで準備完了にしない**（R#20）。幼児のプロフィールはコアだけで準備完了。他の学年のパックは保護者画面から必要に応じて取得。
- 起動時の版の照合: コアの `packs.json` の hash と `packsMeta` の hash を比べる。
  - hash が違うパックの単元は**開かない**。子供には「あたらしい きょうざいを とってきてね」、保護者画面に一括再取得の札を出す。
  - 再取得はバックグラウンドで進め、進捗を表示する。失敗しても旧パックのキャッシュは消さず、学習全体は止めない（ただし版の違うパックの単元は開かない）。成功したら新しい名前のキャッシュを作り、`packsMeta` を更新してから旧キャッシュを消す。
  - `packs.json` に無いパックのキャッシュは削除し、`packsMeta` からも消す。
- fetch: コア → 直前のコア → パックのキャッシュ（`packsMeta` の hash に一致する `mnw-pack/<packId>@<hash>` だけ）→ ネットワーク。
- 削除: 保護者画面でパックのキャッシュだけを消す。記録（IndexedDB）は消さない（教材の削除と記録の削除を分ける）。
- 未取得の単元を開いたとき: 「おうちの ひとに ダウンロードを たのんでね」と保護者向けの説明（配信に接続できれば、その場で取得も可能）。

## 7. おえかき（drawing/）

### 7.1 文書モデル（R#1, R#2, R#3, R#10, R#11, R#35）
```ts
interface ArtDoc {
  id: string; profileId: string; version: 2;
  width: 1600; height: 1000;        // 論理サイズ固定（16:10）。表示は画面に合わせて拡大縮小
  background: { kind: 'color'; color: string } | { kind: 'template'; templateId: string; svg: string };
  base: RasterRef | null;           // 背景に焼き付けた絵（インクの層の上限を超えたとき。下記）
  items: ArtItem[];                 // 重なり順（配列の先頭＝いちばん奥、末尾＝いちばん手前）
  assets: Record<string, string>;   // キー "<stampId>@<ver>" → はんこの SVG（width/height=100 付き）
  createdAt: number; updatedAt: number; title: string;
  origin?: { kind: 'free' } | { kind: 'lesson'; unitId: string; itemId: string };  // 学習連携（X-DL）
}
type ArtItem =
  | { id; kind: 'ink'; raster: RasterRef }                    // インクの層（手描きの線・塗りつぶし）
  | { id; kind: 'stamp'; asset: string /* "<stampId>@<ver>" */;
      x; y; size; rotation; flipX: boolean }
  | { id; kind: 'shape'; shape: 'circle'|'ellipse'|'triangle'|'rect'|'star'|'heart'|'line';
      x; y; w; h; rotation; stroke: string; strokeWidth: number; fill: string | null };
```
- **重なり順**（X-ED-01）: 背景（color/template）→ `base` → `items` を先頭から順に。手描きの線は「インクの層」として、はんこ・図形と同じ列に入る。
- **線を描き始めたとき**: `items` の末尾（一番上）がインクの層ならそこへ描く。そうでなければ新しいインクの層を末尾に作って描く。これで常に「後から描いたものが上」になる。`under`/`over` の2層と「うえに かく」は**廃止**（v2.0-draft から変更）。
- **インクの層の上限は 6 枚**。7枚目が必要になったら、一番下のインクの層と、それより下（奥）のオブジェクトを `base` に焼き付けてから新しい層を作る。焼き付いたものは選択・移動できない（保護者向けの説明に記載）。焼き付けないかぎり、はんこ・図形は保存・再起動後も選択・移動・変形・削除できる（X-ED-06）。
- **はんこの素材**（R#10, X-SV-08）: ビルド時に illust を `renderToStaticMarkup` で SVG 文字列にし、`stamps.json`（`{ id, version, category, svg }`、svg に width/height=100 を付与）を生成する。`check:design` で 60種以上・6カテゴリ以上を検査。作品には使ったはんこの SVG を `assets` に1回だけ持ち、オブジェクトはキーで参照する（同じはんこを何度押しても SVG は1つ）。素材の差し替え・削除後も作品内の SVG で描ける。画像化（SVG → 画像）は（キー, 表示サイズの段階）でキャッシュする。
- **塗りつぶし**（R#2）: 境界は「背景＋`base`＋全アイテムの合成結果」で判定する（はんこ・図形の輪郭も境界になる。図形の中を塗っても外へ流れない）。書き込み先はペンと同じ規則（列の一番上がインクの層ならそこ、違えば新しいインクの層を一番上に作る。統括の判断 2026-10-24）。境界判定は色の差の許容つき（線のふちのアンチエイリアスを越えない）。塗った範囲を1画素広げてすき間を防ぐ。合成の読み取り用キャンバスは `getContext('2d', { willReadFrequently: true })`。
- **消しゴム**（R#3, X-ED-05）: 線は、触れた位置の**すべてのインクの層と `base`** の画素を透明にする（見た目どおりに消える。統括の判断 2026-10-24）。焼き付けも undo の1手（`base` の変化した範囲の差分）として記録し、履歴は切らない。オブジェクトについては:
  - かんたん: 消しゴムで触れたはんこ・図形をそのまま消す（短い音と縮む演出。undo できる）。
  - くわしく: 触れたはんこ・図形を選択状態にして「けす」札を出す（押すと消える）。
- **選択**（R#11, X-ED-02）:
  - 当たり判定: 「描いた結果の不透明な画素」**または**「中心から 2.75u 以内」**または**「図形の線から 2u 以内」。u は表示上の単位（DESINGN.md 2章）。
  - 重なっているとき: かんたん は常に最前面を選ぶ。くわしく だけ、同じ所を続けてタップすると次に奥の対象（循環選択）。
  - 移動: かんたん は「選択中に空いた所をタップ → そこへ移動」を既定とする（ドラッグも可だが必須にしない）。くわしく は加えて矢印札で少しずつ動かせる。
  - 操作札（まわす・おおきく・ちいさく 等）は選択枠の下に出し、画面に入らなければ枠の上 → 道具欄の順に退避する（DESINGN.md 19章）。
- 画面外: オブジェクトの中心はキャンバス内に制限。「みつける」で全オブジェクトを内側へ寄せる（X-ED-04）。
- 学習連携の作品は `artworks` に `origin` 付きで保存し、attempts を作らない（R#35、5.3）。

### 7.2 描画と入力（R#7）
- 表示用の Canvas を1枚（背景＋base＋items の合成）と、選択枠・ハンドル・置く前の見本は DOM/SVG のオーバーレイ（PNG 書き出しに入らない: X-SV-07）。
- インクの層ごとにオフスクリーン Canvas（1600×1000）。合成は変更時のみ（requestAnimationFrame）。塗りつぶしの境界判定用に読み取り用の合成キャンバスを別に持つ（7.1）。
- 入力: Pointer Events、`getCoalescedEvents()`、描画領域だけ `touch-action: none`、`pointerType` で ペン／指／マウスを区別。ペンを使っている間（最後のペン入力から 1 秒）は指の入力を描画に使わない設定（パームリジェクションの代わり。OS・ブラウザの制約は README に記載）。
- **`isPrimary` 以外のポインタは無視する**（描いている線はそのまま続ける）。2本指の判定は持たない（手を置く幼児の線を消さないため。v2.0-draft の「2本目の指で線を取り消す」は廃止）。
- `pointercancel` を受けても、それまでに描いた分を確定する。
- 拡大表示は「くわしく」の虫めがねボタンだけ（ピンチは使わない）。
- 画面サイズの変更・回転: 文書の論理サイズは不変なので作品は消えない。表示の縮尺だけ再計算。

### 7.3 取り消し（X-SV-09）
- コマンド履歴: 線（変化した範囲の前後の画素の差分）、塗りつぶし、消しゴム（線・オブジェクト）、インクの層の追加、オブジェクトの追加・移動・変形・削除・重なり順。
- 上限: 50手かつ合計 64MB（差分の画素数で計算）。超えたら古い手から捨てる。
- 再起動後の undo は持たない（作品は保存済み）。

### 7.4 保存（X-SV。R#9, R#16, R#33）
- IndexedDB（スキーマ2、実装済み）の `artworks`（メタ・文書 JSON）と `artworkBlobs`（キー `${artId}:${kind}`、索引 profileId・artId）。画像は base・各インクの層の PNG、閲覧用 PNG、縮小 PNG。v1 の `works`（なぞり・みち）はそのまま残す。
  - 注: 現行コードの `ARTWORK_BLOB_KINDS` は `under`/`over`/`full`/`thumb`。新しい文書モデルに合わせ、base とインクの層ごとの種類に改める（実装時）。
- **自動保存は操作の区切りごと**（線を描き終えた・はんこを置いた 等）の **1.5 秒後を正**とする。待機中に PNG を先に作って保持しておく。保存中の表示（くも→○）。
- `pagehide`・`visibilitychange(hidden)` では、アイテムの JSON とダーティ印だけを書く（PNG の生成を待たない）。再開時にダーティ印があれば「つくりかけ」として開く。
- 初回のおえかき保存時に `navigator.storage.persist()` を要求する（既存の `requestPersist` を使う）。
- 同じ作品を2つのタブで開いたとき: 保存前に `updatedAt` を比べ、古い方のタブの保存を止めて「べつの がめんで かいています」と表示する（R#33）。
- PNG 書き出し（R#30）: 論理 1600×1000 の合成から、背景色を含めて（透明にしない）作る。選択枠なし。`toBlob` で保存（`<a download>`）。寸法を E2E で検査。
- バックアップ（9章）: 作品の画像は JSON に入れず zip の別ファイルにする。
- 容量: 1作品あたりおよそ 0.3〜3MB（調査メモの計測。インクの層が増えると増える）。保護者画面に作品の合計容量を表示。

## 8. 画面（app/）

- 起動 → プロフィール選択 → **区分別ホーム**:
  - 幼児ホーム（toddler/p4/p5）: 絵のあそび札（3歳段階・4歳・5歳は最大9）＋おえかき＋がんばりノート＋おすすめ。
  - 2歳段階: 札 4 枚（2×2）＋おえかき。おすすめは出さない。起動ごとに保護者向けの短い案内（1タップで閉じる）（R#23）。
  - 小学生ホーム（g1–g6）: 教科の札（国・算・生/理・社・英・プログラミング）＋きょうの おすすめ（復習を含む2〜3件。3章の優先順位）＋おえかき＋がんばりノート。
- 教科 → **単元の地図**（領域ごとの単元の並び。状態の印。「ほかの がくねん」）→ 単元 → UnitRunner。
  - 「ほかの がくねん」の ±1 は表示の初期範囲。学年タブで全学年へ行ける。出さないのは保護者が閉じた単元だけ（R#32）。
- ハッシュ: `#/home`, `#/subject/<subject>`, `#/unit/<unitId>`, `#/draw`, `#/draw/<artId>`, `#/gallery`, 既存の `#/play/<mode>` は幼児の legacy として残す。

## 9. データ移行（X-DA）

- IndexedDB スキーマ 2（`UPGRADES[2]`。実装済み: コミット a25832d。R#15）:
  - ストア追加: `unitProgress`（キー `[profileId, unitId]`）, `artworks`, `artworkBlobs`（profileId・artId の索引）, `packsMeta`（取得したパックの記録、キー packId）。
  - 新ストアを `RECORD_STORES`（unitProgress, artworks, artworkBlobs）とバックアップに追加。プロフィール削除で作品の画像も削除。
  - profiles に `audience: 'p4'`（v1 のプロフィールは4歳向けで作られたため）を付与。settings に SupportSettings の4歳の既定値を付与。
  - upgrade の中は IDB リクエストだけ（await なし）。途中で例外が出ると versionchange トランザクションごと取り消され、元のデータが残る。
  - progress（v1 のスキル進度）は**変換しない**（旧記録）。そのため v1→新単元の対応表は持たない。将来変換する場合は `curriculum/legacyMap.ts` を1つだけ持つ。
  - attempts・rounds・works（なぞり・みち）は変更しない（旧記録として閲覧）。
- バックアップファイル（R#16。zip は未実装）:
  - 書き出し: zip（無圧縮の自前実装。PNG は既に圧縮済みのため。依存を増やさない）。中身は `backup.json`（記録と作品の文書。`schemaVersion: 2`）＋ `artworks/<artId>-<kind>.png`。作品の画像は JSON に入れない。
  - 読み込み: `.json`（v1 の形式・記録のみ。migrateBackup で同じ変換）と `.zip` の両方を受け付ける。zip の上限は 500MB（.json は従来の 50MB）。
  - 注: 現行の backup.ts は作品の画像を PNG の data URL として JSON に入れている。zip への切り替えは実装時。
- テスト: v1 の DB（fake-indexeddb で v1 スキーマを作り、データを入れる）→ v2 で開く → 記録・作品・設定が残る・旧記録の扱いが正しい。途中失敗で元が残る。

## 10. 音声（X-VO）

- 台本はパックごと（`packs/<id>/voice.ts`）。幼児の台本はコア。キーの接頭辞はパックID。生成した mp3 は `public/audio/<packId>/`、マニフェストもパックごと。
- 読み: RichText の《》から作る。数式は読み上げ用の規則（「3/4」→「よんぶんの さん」）。
- 英語（R#17）: Kokoro-82M（Apache-2.0）＋ kokoro-onnx（MIT）で生成し mp3 を同梱（docs/assets-pipeline.md 5節、scripts/voice/generate_en.py）。**聴感は未確認**のため、英語単元は試聴して問題が無いものだけ ready にする。`speechSynthesis` には頼らない。
- 読み上げ設定: always（問題を開くと読む）／button（「よむ」を押したとき）／off（音声を出さない。効果音も設定に従う）。

## 11. 性能（X-NF-04）

- 起動時に読むもの: 本体 JS（目標 gzip 150KB 以下）、単元の索引、フォント（ひらがな・カタカナ・使う漢字のサブセット）。
- **小学生用フォント**（R#22）: 配当漢字 1026 字＋画面で使う漢字のサブセットを1組作り、小学生のプロフィールで `FontFace` で読み込む（コアのキャッシュに含める）。パックごとの分割はしない。容量は `fonts:build` の出力で記録する。
- 教材・画像・音声は単元を開いたときに読み込む。
- おえかき: 1600×1000 のインクの層 最大6枚＋base＋表示用の合成1枚＋読み取り用の合成1枚＋undo 差分。メモリの目安 100MB 以内（1枚あたり約 6.4MB で計算。開発PCで計測して記録し、実機は未確認）。
