# 拡張 アーキテクチャ（docs/expansion/architecture.md）

版 2.0-draft（2026-10-24） / 責任: Opus（統括）
前提: 初期版 docs/architecture.md の構成（Vite + React + TS、自前 Service Worker、IndexedDB、Web Audio、ハッシュルーター、ModeRunner）を**活用**し、全面書き直しはしない（X-NF-01）。本書は追加・変更点を定める。

---

## 1. 全体像

```
src/
├─ core/            （既存）audio / storage / progress / session / offline / util
├─ audience/        対象区分・支援設定・画面表現（新）
├─ curriculum/      単元の索引（軽いメタデータ）・前提関係・おすすめ・復習（新）
├─ text/            ふりがな付きの文・数式の表記（RichText）と描画（新）
├─ engines/         共通の問題形式エンジン（choice, number, order, … ）（新）
├─ units/           UnitRunner（単元の実行枠）・UnitMap（単元の地図）（新）
├─ packs/<packId>/  教材パック（区分×教科）。各単元の問題データ・生成器・台本（新、遅延読み込み）
├─ modes/           （既存）幼児のモード部品。再設計後も使うものは legacy エンジンとして呼ぶ
├─ drawing/         おえかき（文書モデル・描画・道具・保存・作品一覧）（新）
├─ illust/          （既存）イラスト。はんこ素材を追加
├─ parent/          （既存）保護者画面。教材パック・単元・作品タブを追加
└─ app/             （既存）起動・ホーム。区分別ホームに分ける
```

境界（X-NF-02）: 対象（audience）・UI（engines/app）・スキル（curriculum）・教材（packs）・問題形式（engines）・判定（engines/*/judge.ts と packs の生成器）・進度（core/progress）・作品（drawing, core/storage）・素材（illust, public/audio）を分ける。教材パックは UI を持たず、データと生成器と台本だけを持つ。

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
  furigana: 'unlearned' | 'all' | 'none';   // 未習漢字のみ／全部／なし
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
- 既定値: toddler/p4/p5 → gentle・always・simple、g1–g2 → standard・always・simple、g3–g4 → standard・button・detailed、g5–g6 → calm・button・detailed。

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
  pack: PackId;               // 'g3-sansu' 等
  status: 'ready' | 'partial' | 'planned';  // 'planned' は子供画面に出さない
}
```
- 単元の索引（全単元の UnitMeta）は軽量な JSON として本体に同梱し、起動時に読む（数百件・数十KB）。問題データは教材パックにあり、単元を開くときに読み込む（X-OF-04）。
- スキルID = 単元ID（文字列）。v1 の SkillId（'shop' 等）は幼児の legacy 単元のIDとしてそのまま使う（§9 移行）。
- 進度（SkillProgress）に復習を追加:
  ```ts
  interface SkillProgressV2 extends SkillProgress {
    stage: 'none' | 'learning' | 'learned' | 'secured';  // まだ／とりくみちゅう／できた／しっかりできた
    reviewDue: number | null;   // 次の復習の時刻
    reviewStep: number;         // 0,1,2,3 → 1日, 3日, 7日, 21日
  }
  ```
  - `learned`: 最上段で mastered（v1 の進む規則）に達した。`reviewDue = now + 1日`。
  - 復習（1回 3問程度、**別の seed／別の表現**で出す）で自力2/3以上 → reviewStep+1。3回目の復習を通過 → `secured`。復習で支援が多い → `learning` に戻す（段階は下げない）。
  - 復習は「きょうの おすすめ」に出す（強制しない）。

## 4. 文の表記（text/）

- RichText は文字列の小さな記法: `漢字《かんじ》`（ふりがな）、`[[3/4]]`（分数）、`[[2 1/3]]`（帯分数）、`**強調**`、`{{空欄}}`。
- 描画（`<Rt text=… />`）はプロフィールの `furigana` と単元の学年から、ふりがなを出すか決める:
  - 'unlearned'（保護者画面の表示「がくねんに あわせる」）: その漢字の配当学年 ≥ プロフィールの在籍学年（その学年で習う途中の漢字にも付ける。就学前・配当外は全部）なら表示（progress.md 統括の判断3）
  - 'all' / 'none'
- 漢字の配当学年表 `text/kanji-grades.ts`（学年別漢字配当表 1026字。学習指導要領 別表。事実のデータ）。
- **規則（検査）**: 教材の文中の漢字は、必ず `《》` でよみを付けた語の中にある（ふりがなを付けるかは表示側が決める）。例外は数字。単体テストで全教材を検査。
- 音声: 台本の読み（yomi）は RichText の《》から作る（漢字の読み誤りを防ぐ）。

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
// 各エンジンが ItemBase を拡張（例: NumberItem { answer: NumberAnswer; unit?: string; tolerance?: number }）
```
- エンジンは React 部品＋純粋な判定関数（`judge(item, response) → { correct, misconception? }`）。判定は単体テストする。
- 共通の画面の区画（X-UX-05）: 上＝問題文（RichText）、中央＝作業領域（図・操作）、下＝回答欄・選択肢、左下＝ヒント、右下＝つぎへ／こたえあわせ。解説は回答欄の上に開く。

### 5.1 数の答えの判定（X-QA-03）
```ts
type NumberAnswer =
  | { kind: 'int'; value: number }
  | { kind: 'decimal'; value: number; places?: number }     // places 指定時はその桁まで
  | { kind: 'fraction'; num: number; den: number; mustReduce?: boolean; allowImproper?: boolean; allowMixed?: boolean }
  | { kind: 'quantity'; value: number; unit: string; acceptUnits?: { unit: string; factor: number }[]; tolerance?: number }
```
- 分数: 値が等しければ正解（2/4 と 1/2）。`mustReduce`（約分が目標の単元）のときだけ約分していないものを「もう少し（約分できるよ）」として誤答にせず再入力を促す。仮分数⇔帯分数も目標でなければ等価として受け入れる。
- 小数と分数: 単元が許す場合は等価（0.5 と 1/2）。
- 単位: 単位換算が目標でない限り、換算後の値が等しければ正解。許容誤差は概数・測定の単元だけ（`tolerance`）。
- 入力形式だけの誤り（全角・余分な0）は正規化してから判定。

### 5.2 legacy エンジン
初期版のモード部品（src/modes/*）は `legacy` エンジンとして UnitRunner から呼ぶか、ModeRunner のまま幼児ホームから呼ぶ。再設計の判断は curriculum-matrix.md 4章。

## 6. 教材パック（packs/）と取得（X-OF-01〜04）

- パック = 区分×教科（例 `g3-sansu`, `g3-kokugo`, `pre-play`）。`packs/<packId>/index.ts` が `PackContent = { units: Record<unitId, UnitContent> }` を default export。UnitContent は手作り問題の配列か、生成器（`generate(level, seed, count) → Item[]`）。
- 遅延読み込み: `import(\`../packs/${id}/index.ts\`)` で Rollup がパックごとのチャンクに分ける。音声は `public/audio/<packId>/*.mp3`。
- ビルド時に `dist/packs.json` を生成: `{ [packId]: { files: string[], bytes: number, hash: string } }`（Vite の build manifest からパックの入口チャンクと、そのチャンクだけが使うチャンク・音声を集める）。
- 取得の仕組み（Service Worker）:
  - 本体（コア）キャッシュ `mnw-<版>`: アプリ本体・フォント・共通音声・単元の索引。従来どおり一括。
  - パックのキャッシュ `mnw-pack-<packId>-<hash>`: 保護者画面の「ダウンロード」で取得（ページから Cache API で `addAll`）。取得の進捗を表示。
  - 既定の取得: 初回準備時に、そのプロフィールの区分のパック（例 g3 なら g3-kokugo, g3-sansu, …）を自動で取得（保護者に表示）。他の区分は必要に応じて。
  - fetch: コア → 直前のコア → パックのキャッシュ（caches.match）→ ネットワーク。
  - 版の整合（X-OF-03）: 新しいコアの install 時に、取得済みのパック（キャッシュ名から判別）のうち hash が変わったものを新しい名前で取り直してから install 完了とする。activate で古いパックのキャッシュを削除。これにより「新しい画面と古い教材」が混ざらない。取り直しに失敗したら install 失敗（旧版のまま動く）。
  - 削除: 保護者画面でパックのキャッシュだけを消す。記録（IndexedDB）は消さない（教材の削除と記録の削除を分ける）。
  - 未取得の単元を開いたとき: 「おうちの ひとに ダウンロードを たのんでね」と保護者向けの説明（配信に接続できれば、その場で取得も可能）。

## 7. おえかき（drawing/）

### 7.1 文書モデル
```ts
interface ArtDoc {
  id: string; profileId: string; version: 2;
  width: 1600; height: 1000;        // 論理サイズ固定（16:10）。表示は画面に合わせて拡大縮小
  background: { kind: 'color'; color: string } | { kind: 'template'; templateId: string; svg: string };
  layers: { under: RasterRef; over: RasterRef };   // 手描きの線の層（2枚）
  objects: ArtObject[];             // はんこ・図形（配列の順＝重なり順。後ろほど手前）
  createdAt: number; updatedAt: number; title: string;
  origin?: { kind: 'free' } | { kind: 'lesson'; unitId: string; itemId: string };  // 学習連携（X-DL）
}
type ArtObject =
  | { id; kind: 'stamp'; stampId: string; stampVersion: number; svg: string;  // 素材の SVG を埋め込む（X-SV-08）
      x; y; size; rotation; flipX: boolean }
  | { id; kind: 'shape'; shape: 'circle'|'ellipse'|'triangle'|'rect'|'star'|'heart'|'line';
      x; y; w; h; rotation; stroke: string; strokeWidth: number; fill: string | null };
```
- **重なり順**（X-ED-01）: 背景 → `under` 層（ふつうの ペン・塗りつぶし・消しゴムはここ）→ オブジェクト（置いた順。てまえへ／おくへ で入れ替え）→ `over` 層（「はんこの うえに かく」を選んだときのペン）。
  - 既定は `under`（はんこの下に描く）。幼児の「かんたん」では over を出さない。
- **はんこ・図形は常にオブジェクト**のまま保存し、再起動後も選択・移動・変形・削除できる（X-ED-06。調査メモの「焼き付け」案は採らない）。
- **消しゴム**は今の層（under または over）の線だけを消す。オブジェクトは消さない（X-ED-05）。オブジェクトを消すのは選択して「けす」。
- **塗りつぶし**は今の層の画素を境界として塗る（オブジェクトは境界にしない）。境界判定は色の差の許容つき（線のふちのアンチエイリアスを越えない）。描画は塗った範囲を1画素広げてすき間を防ぐ。
- **選択**（X-ED-02）: タップ位置に絵が描かれている最前面のオブジェクト（図形は形の内側または線の近く、はんこは SVG を描いた結果の不透明な画素で判定）。同じ所を続けてタップすると次に奥の対象。
- 画面外: オブジェクトの中心はキャンバス内に制限。「みつける」で全オブジェクトを内側へ寄せる（X-ED-04）。

### 7.2 描画と入力
- 表示用の Canvas を1枚（背景＋under＋オブジェクト＋over を合成）と、選択枠・ハンドル・置く前の見本は DOM/SVG のオーバーレイ（PNG 書き出しに入らない: X-SV-07）。
- 層ごとにオフスクリーン Canvas（1600×1000）。合成は変更時のみ（requestAnimationFrame）。
- 入力: Pointer Events、`getCoalescedEvents()`、描画領域だけ `touch-action: none`、`pointerType` で ペン／指／マウスを区別。ペンを使っている間（最後のペン入力から 1 秒）は指の入力を描画に使わない設定（パームリジェクションの代わり。OS・ブラウザの制約は README に記載）。
- 拡大縮小と描画の誤認防止: 2本指の操作は描画しない（2本目の指が触れたらその線を取り消す）。拡大表示は「くわしく」の虫めがねボタンだけ（ピンチは使わない）。
- 画面サイズの変更・回転: 文書の論理サイズは不変なので作品は消えない。表示の縮尺だけ再計算。

### 7.3 取り消し（X-SV-09）
- コマンド履歴: 線（変化した範囲の前後の画素の差分）、塗りつぶし、消しゴム、オブジェクトの追加・移動・変形・削除・重なり順。
- 上限: 50手かつ合計 64MB（差分の画素数で計算）。超えたら古い手から捨てる。
- 再起動後の undo は持たない（作品は保存済み）。

### 7.4 保存（X-SV）
- IndexedDB の新ストア `artworks`（メタ・文書 JSON）と `artworkBlobs`（under/over の PNG、閲覧用 PNG、縮小 PNG）。v1 の `works`（なぞり・みち）はそのまま残す。
- 自動保存: 操作の区切り（線を描き終えた・はんこを置いた 等）から 1.5 秒後と、`pagehide`・`visibilitychange(hidden)` のとき。保存中の表示（くも→チェック）。
- 書き出し（PNG）: 合成結果だけ（選択枠なし）を `toBlob` で保存（`<a download>`）。
- 容量: 1作品あたりおよそ 0.3〜3MB（調査メモの計測）。保護者画面に作品の合計容量を表示。

## 8. 画面（app/）

- 起動 → プロフィール選択 → **区分別ホーム**:
  - 幼児ホーム（toddler/p4/p5）: 絵のあそび札（最大9、区分ごとの構成）＋おえかき＋がんばりノート＋おすすめ。
  - 小学生ホーム（g1–g6）: 教科の札（国・算・生/理・社・英・プログラミング）＋きょうの おすすめ（復習を含む2〜3件）＋おえかき＋がんばりノート。
- 教科 → **単元の地図**（領域ごとの単元の並び。状態の印。「ほかの がくねん」の切り替え）→ 単元 → UnitRunner。
- ハッシュ: `#/home`, `#/subject/<subject>`, `#/unit/<unitId>`, `#/draw`, `#/draw/<artId>`, `#/gallery`, 既存の `#/play/<mode>` は幼児の legacy として残す。

## 9. データ移行（X-DA）

- IndexedDB スキーマ 2（`UPGRADES[2]`）:
  - ストア追加: `artworks`, `artworkBlobs`, `packsMeta`（取得したパックの記録）
  - profiles に `audience: 'p4'`（v1 のプロフィールは4歳向けで作られたため）を付与。settings に SupportSettings の既定値を付与。
  - progress: v1 の SkillId（shop, kana, …, formula_sub）は、curriculum-matrix.md 4章の「対応付けが確実」なものだけ新単元IDへ写す（例: 内容が同じ legacy 単元はIDを変えない＝そのまま）。不確かなものは `legacy` フラグを付け、保護者画面の「旧記録」に表示（新単元の習得済みにしない）。
  - attempts・rounds・works（なぞり・みち）は変更しない（旧記録として閲覧）。
- バックアップファイル: `schemaVersion: 2`。v1 のファイルは migrateBackup で同じ変換をして読み込む。
- テスト: v1 の DB（fake-indexeddb で v1 スキーマを作り、データを入れる）→ v2 で開く → 記録・作品・設定が残る・legacy の扱いが正しい。途中失敗で元が残る。

## 10. 音声（X-VO）

- 台本は区分×教科のパックごと（`packs/<id>/voice.ts`）。キーの接頭辞はパックID。生成した mp3 は `public/audio/<packId>/`、マニフェストもパックごと。
- 読み: RichText の《》から作る。数式は読み上げ用の規則（「3/4」→「よんぶんの さん」）。
- 英語: オフラインの英語音声合成で生成（手段とライセンスは実装時に確定し、docs/assets-pipeline.md と licenses/ に記録。A-4）。
- 読み上げ設定: always（問題を開くと読む）／button（「よむ」を押したとき）／off（音声を出さない。効果音も設定に従う）。

## 11. 性能（X-NF-04）

- 起動時に読むもの: 本体 JS（目標 gzip 150KB 以下）、単元の索引、フォント（ひらがな・カタカナ・使う漢字のサブセット。漢字の教材が増えるため、教材用の漢字はパックごとのサブセットフォントを検討）。
- 教材・画像・音声は単元を開いたときに読み込む。
- おえかき: 1600×1000 の層2枚＋合成1枚＋undo 差分。メモリの目安 100MB 以内。
