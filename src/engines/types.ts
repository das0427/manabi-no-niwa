/**
 * 問題形式エンジンと実行枠（UnitRunner）の約束（architecture.md 5章）。
 * エンジン = 画面の部品（作業領域・回答欄）＋ 純粋な判定関数 ＋ 問題データの自動検査。
 * 誤答・ヒント・解説・つぎへ・記録・進度は UnitRunner が全エンジン共通で受け持つ。
 */
import type { ReactNode } from 'react';
import type { AudienceUx, SupportSettings } from '../audience/audience';
import type { Item, RichText } from '../curriculum/types';

/** 表示に必要な学習者の情報（ふりがな・文字の大きさ・選択肢の数） */
export interface RenderCtx {
  furigana: SupportSettings['furigana'];
  /** 在籍学年（就学前は 0） */
  learnerGrade: number;
  preschool: boolean;
  textScale: SupportSettings['textScale'];
  ux: AudienceUx;
}

export type Judgement =
  | { result: 'correct' }
  /** mark: エンジンが誤りの印を付けるための情報（例: 選んだ選択肢の番号） */
  | { result: 'wrong'; misconception?: string; mark?: unknown }
  /** 誤答にしない「もう一度」（questionFlow.nudge）。message は子供に見せる文 */
  | { result: 'retry'; message: RichText };

export interface EngineProps<I extends Item, R> {
  item: I;
  ctx: RenderCtx;
  /** 正解・つぎへ で確定した後。正答を見せる */
  revealed: boolean;
  /** 直前の誤答の印（judge が返した mark） */
  wrongMark: unknown;
  /** 判定中・音声で手がかりを出している間など、操作を受け付けない */
  disabled: boolean;
  /** 答えを出す（UnitRunner が judge を呼んで流れを進める） */
  submit(response: R): void;
}

export interface EngineDef<I extends Item = Item, R = unknown> {
  id: I['engine'];
  Component: (props: EngineProps<I, R>) => ReactNode;
  judge(item: I, response: R): Judgement;
  /** 問題データの自動検査（curriculum-matrix 1.8）。誤りを日本語で返す（無ければ空） */
  check(item: I): string[];
  /** 正答を文で（解説・保護者画面） */
  answerText(item: I): RichText;
}
