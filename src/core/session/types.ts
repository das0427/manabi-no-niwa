/**
 * モード本体と実行枠（ModeRunner）の間の約束。全9モードがこれだけを使う。
 * 仕様: docs/architecture.md 4.2〜4.3。
 */
import type { ReactNode } from 'react';
import type { VoiceSeq } from '../../voice/catalog/index';
import type { ChildSettings, InputKind, ModeId, Outcome, SkillId, WorkKind } from '../types';

export interface AttemptInput {
  /** 保護者画面で読める問題の内容（例「りんご×3」「あ」「2+1」） */
  itemKey: string;
  outcome: Outcome;
  wrongTries: number;
  hintsUsed: number;
  reviewsUsed?: number;
  operationIssue?: boolean;
  inputKind?: InputKind;
  detail?: Record<string, string | number | boolean>;
}

export interface WorkInput {
  /** 既存の作品を上書きする場合（つくりかけの続き） */
  id?: string;
  kind: WorkKind;
  title: string;
  data: unknown;
  /** つくりかけ（未完成）。作品一覧では「つくりかけ」と表示 */
  draft?: boolean;
}

export interface RoundSummary {
  /** 完了画面に並べる絵（IllustId、最大5） */
  illusts?: string[];
  /** 絵の代わりにモードが描く内容（例: かごと「ぜんぶで 3こ」） */
  showcase?: ReactNode;
  /** 行動に基づく声かけ（learning-design.md 0.5）。省略時は praise.finished */
  praise?: string;
  /** 声かけの前に読む文（例: 注文の復唱） */
  before?: VoiceSeq;
  /** 完了画面に出す短い文（ひらがな。省略時は声かけの文） */
  caption?: string;
}

export interface ModeSession {
  profileId: string;
  modeId: ModeId;
  variantId: string;
  /** 進度の対象スキル（じゆうに つくる など進度のない遊びは null） */
  skillId: SkillId | null;
  /** 今回遊ぶ段階（0始まり。遊び方の範囲に収めた値） */
  level: number;
  levelCount: number;
  /** この回の問題数（モードの単位に読み替え済み） */
  roundSize: number;
  seed: number;
  settings: ChildSettings;
  /** 動きを減らす（保護者設定または OS 設定） */
  reduceMotion: boolean;
  /** 中断からの再開時、前回 saveDraft した状態。新しく始めた場合は null */
  resume: unknown;

  /**
   * 問題文を設定して再生する（右上の「もういちど きく」の対象になる）。
   * display を渡すと、画面上部の文と「もういちど きく」はその列だけになる（最初の説明を除く等）。
   */
  prompt(seq: VoiceSeq, display?: VoiceSeq): Promise<'done' | 'stopped'>;
  /** 一時的な声かけ（問題文にはしない） */
  say(seq: VoiceSeq): Promise<'done' | 'stopped'>;
  sfx(name: 'tap' | 'correct' | 'wrong' | 'complete' | 'place' | 'remove'): void;
  /** 1問の結果を保存（進度の窓にも反映。段階の変更は回の終わりだけ） */
  record(a: AttemptInput): void;
  /** 中断に備えて今の状態を保存（各問題の確定時や、作業の区切りで呼ぶ） */
  saveDraft(state: unknown): void;
  clearDraft(): void;
  saveWork(w: WorkInput): Promise<string>;
  /** 回の終わり。完了画面を出す */
  finish(summary: RoundSummary): void;
  /** E2E テスト用に今の問題データを公開（テストフラグがないときは何もしない） */
  expose(data: unknown): void;
}

export interface ModePlayProps {
  session: ModeSession;
}
