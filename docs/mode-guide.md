# モードの作り方（mode-guide.md）

全9モードの体験をそろえるための実装ガイド。手本は **src/modes/shopping/**（おかいものごっこ）。
新しいモードを作る・直すときは、まず shopping の index.tsx / logic.ts / logic.test.ts / voice.ts を読むこと。

## 1. ファイル構成（NF-04）

```
src/modes/<mode>/
  logic.ts        生成（seed → 問題）・判定・ヒント選択。純粋関数のみ（React も DOM も使わない）
  logic.test.ts   seed 1..200 × 全段階で生成を検査。判定の境界値。失敗時は seed と段階をメッセージに出す
  content.ts      手で作る教材（盤面・図形・線など）。必要なときだけ
  voice.ts        このモードの音声台本（`export const voice = {...} satisfies VoiceEntries`）
  index.tsx       UI（default export。props は ModePlayProps）
  <mode>.css      モード固有のスタイル（クラス名は <mode>- で始める）
```
- 1ファイル400行以内を目安に分割（UI が大きければ部品を別ファイルに）。
- 編集してよいのは自分のモードのフォルダだけ。共有ファイル（src/core, src/ui, src/app, src/modes/registry.ts, src/content/vocab.ts, src/voice/catalog/*）は編集しない。足りない機能は報告する。

## 2. 実行枠から受け取るもの（src/core/session/types.ts の ModeSession）

- `session.level`（0始まり。registry.ts の SKILLS の段階の順）, `session.roundSize`（この回の問題数・盤面数・題数。読み替え済み）, `session.seed`
- `session.prompt(seq, display?)`: 問題文を再生し、画面上部の文と「もういちど きく」の対象にする。最初の問題だけ説明を足す場合は `prompt([説明, ...問題], 問題)`
- `session.say(seq)`: 一時的な声（ヒント・数の読み上げ・正解の声）
- `session.sfx('tap'|'correct'|'wrong'|'complete'|'place'|'remove')`
- `session.record({...})`: 1問の結果。outcome は useQuestion が決めた値をそのまま渡す
- `session.saveDraft(state)`: 中断に備えた保存。**問題の確定時に加え、操作のたびに**（置いた・入れた等）保存する。再開時は `session.resume` に入って戻ってくる
- `session.finish({ illusts | showcase, praise, before, caption })`: 回の終わり。完了画面は実行枠が出す
- `session.saveWork({kind, title, data, id?, draft?})`: 作品（なぞり・みち）
- `session.expose(data)`: E2E テストが正解を計算できるだけの問題データを渡す（毎問）
- ヘッダー（おうち・問題文・もういちど きく）は実行枠が描く。モードは描かない。モードの描画領域は舞台の上 8u を除いた 100u × 48.25u。

## 3. 1問の流れ（useQuestion。src/core/session/useQuestion.ts）

```ts
const q = useQuestion();
// 選択したとき
if (!q.tap()) return;            // 確定済み・ロック中は無視。連打は operationIssue に記録される
if (isCorrect) {
  const s = q.correct();          // s.outcome が決まる
  session.sfx('correct'); session.record({ itemKey, outcome: s.outcome!, wrongTries: s.wrongTries, hintsUsed: s.hintsUsed, reviewsUsed: s.reviewsUsed, operationIssue: s.operationIssue });
} else {
  const s = q.wrong();            // s.hintLevel が 1 → 注目のヒント、2 → 具体的なヒント。s.canSkip で「つぎへ」を出す
}
q.hint();   // 「ヒント」ボタン
q.review(); // 「もういちど みる」「えで みる」
q.skip();   // 「つぎへ」→ 正解を見せてから次へ（outcome = skipped）
q.reset();  // 次の問題へ
```
- 結果の種類の決まり方は docs/architecture.md 4.3 の状態表。自分で outcome を決めない。
- 「1問」の単位と independent の条件は docs/learning-design.md 0.3 の表のとおり（盤面型は盤面全体で1問、置き間違いを wrongTries に数える）。
- 判定中・演出中は `busy` 状態で入力を無視する（OP-05）。次の問題へは約1.5秒の演出の後に進む。

## 4. ヒント・声かけ・表示（DESINGN.md 8章・learning-design.md 0.2, 0.5）

- ヒント1（声＋吹き出し）: 注目点を言う。ヒント2: 該当部分を `is-hint` クラス（破線＋薄い黄色）で囲む等。**答えを押させるだけの表示にしない**。
- 吹き出しは `<Bubble text={...} />`（src/ui/Bubble.tsx）。文は `textOf(seq)`（src/app/voiceText.ts）で音声と同じ文にする。
- 選択肢は `<Choice>`（src/ui/Choice.tsx）、木の札は `<Tap>`（src/ui/Tap.tsx）。状態は `state="selected" | "correct" | "wrong" | "hint"`（色だけでなく印が付く）。
- 左下に「ヒント」（`<Tap label="ヒント" icon="hint" size="aux" variant="white" />`）、右下に主操作、ヒント2の後は「つぎへ」（`icon="next"`）。
- 正解の声は「そうだね」（`app.ok`）「あってるね」（`app.right`）など事実の言葉。完了画面の `praise` は行動に基づく声かけキー（`praise.*`）か省略（＝さいごまで できたね）。
- 課題中にループする動きを置かない。動きは `session.reduceMotion` が true なら止める（CSS は .reduce-motion で自動的に止まる）。

## 5. 寸法（DESINGN.md 2章）

- すべて `calc(var(--u) * n)` で書く。主操作 6u 以上、補助 5.5u 以上、主操作どうしの間隔 1.6u 以上。
- 色はトークン（`var(--leaf)` 等）だけ。グラデーション・ぼかし影・#000/#fff 禁止。
- 絵は `<Illust id="apple" />`（src/illust/Illust.tsx）。ID は src/content/vocab.ts と src/illust/*。新しい絵が必要なら報告（勝手に描かない）。
- 子供に見える文字はひらがな（固有の品物名のカタカナは可）。漢字・英語は使わない。

## 6. 音声

- キーはモードの接頭辞で始める: shop / kana / sort / shape / mem / cmp / road / trace / math。共通のキー（app.* praise.* num.* count.* item.*）は src/voice/catalog/common.ts にある。
- 数字＋助数詞はひらがなで書く（「3こ」ではなく「さんこ」）。Open JTalk の読み誤りを避けるため。
- 台本を足したら `npm run voice:script` → `npm run voice:build` → `npm run check:audio` で音声を作り、合っているか確認する（生成は数秒）。
- src/voice/voice-keys.test.ts が、ソース中の音声キーがすべて台本にあることを検査する。

## 6.5 レビュー後の共通ルール（T21 で決定。全モード必須）

| # | ルール |
|---|---|
| L1 | **下の帯の位置**: 「ヒント」は左下（`<div className="bottom-left">`）、「つぎへ」は右下の角（`<div className="bottom-right">` の最後。`<Tap label="つぎへ" icon="next" size="aux" />` 文字なし）。主操作（しゅっぱつ・おねがいします・おぼえた・できた 等）は bottom-right の中で つぎへ の左（間隔 3u は .bottom-right が持つ）。下・左右の余白は `var(--edge)`（2u）。独自の bottom: 1.5u をやめる |
| L2 | **ヒントの札**は全モード `<Tap label="ヒント" icon="hint" size="aux" variant="white" />`（文字なし）。「ヒント」「みる」など子供画面にカタカナ・説明文の札を出さない |
| L3 | **ことば**: 「タップ」を使わない（「ゆびで さわって」「おして」）。画面上部の問題文は16文字以内、吹き出しは20文字以内（2行まで） |
| L4 | **答えを押させるヒントにしない**: ヒント2は答えの場所を直接囲まない（例外は learning-design 0.2 に明記したものだけ）。属性を言う・手がかりを足す・見直しを勧める |
| L5 | **記録と下書き**: `session.record()` と同じ処理の中で、次の問題の下書きを保存する（最後の問題なら `session.clearDraft()`）。「ヒント」ボタンを押したときも下書きを保存する。再開時に wrongTries・hint・review が初期化されて自力扱いになる抜け道を作らない |
| L6 | **完了画面の声かけ**: 自分で解いた問題が0（全部「つぎへ」）の回は `praise.watched`（いっしょに さいごまで みたね）。「ひとつずつ かぞえられたね」は、数える対象を**全部**数えたときだけ |
| L7 | **誤答の表示**: 選んだ札・置いた物に `state="wrong"`（中身が薄くなり、？の吹き出しの印が付く）。共通 CSS が処理する |
| L8 | **操作のとまどい**: `q.tap()` は「選択・判定」の操作でだけ呼ぶ（正しく速く操作しただけで operationIssue にしない） |

## 7. テストと完了条件

- `npx vitest run src/modes/<mode>`、`npx tsc -b`、`npx eslint src/modes/<mode>`、`npx prettier --check src/modes/<mode>` が成功。
- 生成問題は seed 1..200 × 全段階で: 正解が存在する、範囲を満たす、1回の中で重複しない、正解位置が偏らない（balancedPositions）。
- ブラウザで実際に遊んで確認する（開発サーバー: `npx vite --host 127.0.0.1 --port <自分のポート> --strictPort`）。localStorage に `mnw:test=1` を入れると `window.__mnw.current` に expose したデータが出る。「はじめる」→ホーム→自分のモード、を1回最後まで遊び、完了画面まで出ること。スクリーンショット（Playwright で 1280×720）を撮って Read で見て、DESINGN.md の規約に照らして直す。
- E2E 用に、正解の操作に必要な要素へ `data-testid` を付ける（例: `choice-0`, `shelf-apple`, `cell-2-1`）。
