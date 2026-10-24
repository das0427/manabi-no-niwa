/**
 * 幼児ホームの札（ux-by-age 2.1、curriculum-matrix 4章・6.2）。区分ごとに最大9枚（3×3。位置は固定）。
 * 札は1つ以上の単元につながる。単元が1つなら直接開き、2つ以上なら選ぶ画面を出す。
 * 2歳段階（toddlerStage 2）は stage2Cards の札だけ（最大4枚、review-1 #23）。
 * 中身（どの札にどの単元）は幼児の教材の担当が書く。札が無い区分は v1 のホームを出す。
 */
import type { StageId } from './types';

export interface HomeCard {
  id: string;
  /** 札の名前（ひらがな。空白で2行に分ける） */
  title: string;
  /** 絵（IllustId） */
  icon: string;
  /** つながる単元ID（並び順＝選ぶ画面の順） */
  units: string[];
  /** 札を押したときの読み上げ（音声キー。省略時は読み上げない） */
  titleVoice?: string;
}

export interface PreschoolHomeDef {
  stage: Extract<StageId, 'p23' | 'p4' | 'p5'>;
  cards: HomeCard[];
  /** 2歳段階で出す札の id（p23 のみ） */
  stage2Cards?: string[];
}

export const PRESCHOOL_HOMES: Partial<Record<'p23' | 'p4' | 'p5', PreschoolHomeDef>> = {};

export function preschoolStageOf(audience: string): 'p23' | 'p4' | 'p5' | null {
  if (audience === 'toddler') return 'p23';
  if (audience === 'p4' || audience === 'p5') return audience;
  return null;
}
