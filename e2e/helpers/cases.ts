import { gotoApp, prepare, start } from './app';
import type { Page } from '@playwright/test';
import type { SkillId } from '../../src/core/types';
export interface Case {
  name: string;
  mode: string;
  variant?: string;
  /** 固定する段階（スキル→0始まりの段階） */
  levels: Partial<Record<SkillId, number>>;
  attempted?: SkillId[];
  seed?: number;
}

export const CASES: Case[] = [
  { name: 'shopping S1', mode: 'shopping', levels: { shop: 0 } },
  { name: 'shopping S4(最上段)', mode: 'shopping', levels: { shop: 3 } },
  { name: 'hiragana H1', mode: 'hiragana', levels: { kana: 0 } },
  { name: 'hiragana H3(はじめの音)', mode: 'hiragana', levels: { kana: 2 } },
  { name: 'hiragana H4(2もじ)', mode: 'hiragana', levels: { kana: 3 } },
  { name: 'hiragana H5(最上段)', mode: 'hiragana', levels: { kana: 4 } },
  { name: 'sorting N1', mode: 'sorting', levels: { sort: 0 } },
  { name: 'sorting N4(最上段・分け直し)', mode: 'sorting', levels: { sort: 3 } },
  { name: 'shapes K1', mode: 'shapes', levels: { shape: 0 } },
  { name: 'shapes K4(まわす)', mode: 'shapes', levels: { shape: 3 } },
  { name: 'shapes K5(最上段・みほん)', mode: 'shapes', levels: { shape: 4 } },
  { name: 'memory B1', mode: 'memory', levels: { memory: 0 } },
  { name: 'memory B4(場所)', mode: 'memory', levels: { memory: 3 } },
  { name: 'memory B5(順番)', mode: 'memory', levels: { memory: 4 } },
  { name: 'memory B6(最上段)', mode: 'memory', levels: { memory: 5 } },
  { name: 'compare P1', mode: 'compare', levels: { compare: 0 } },
  { name: 'compare P3(数)', mode: 'compare', levels: { compare: 2 } },
  { name: 'compare P4(おなじ)', mode: 'compare', levels: { compare: 3 } },
  { name: 'compare P5(最上段・ならべる)', mode: 'compare', levels: { compare: 4 } },
  { name: 'road R1', mode: 'road', variant: 'puzzle', levels: { road: 0 } },
  { name: 'road R4(最上段)', mode: 'road', variant: 'puzzle', levels: { road: 3 } },
  { name: 'trace T1(せん)', mode: 'trace', variant: 'lines', levels: { trace: 0 } },
  { name: 'trace T3(おれせん・かたち)', mode: 'trace', variant: 'lines', levels: { trace: 2 } },
  { name: 'trace T4(めいろ)', mode: 'trace', variant: 'maze', levels: { trace: 3 } },
  { name: 'trace T5(もじ)', mode: 'trace', variant: 'letters', levels: { trace: 4 } },
  { name: 'trace T7(最上段・もじ)', mode: 'trace', variant: 'letters', levels: { trace: 6 } },
  { name: 'math A(たす)', mode: 'math', variant: 'add', levels: { add: 0 } },
  { name: 'math B3(たす0)', mode: 'math', variant: 'add', levels: { add: 3 } },
  { name: 'math C1(ひく)', mode: 'math', variant: 'sub', levels: { sub: 0 } },
  { name: 'math C3(ひく・最上段)', mode: 'math', variant: 'sub', levels: { sub: 2 } },
  { name: 'math D1(わける)', mode: 'math', variant: 'split', levels: { split: 0 } },
  { name: 'math D2(わける・最上段)', mode: 'math', variant: 'split', levels: { split: 1 } },
  {
    name: 'math E1(しき・たす)',
    mode: 'math',
    variant: 'formula_add',
    levels: { formula_add: 0 },
    attempted: ['formula_add'],
  },
  {
    name: 'math E2(しき・ひく)',
    mode: 'math',
    variant: 'formula_sub',
    levels: { formula_sub: 0 },
    attempted: ['formula_sub'],
  },
];

/** 段階を設定して起動し、モードを開いて1回分を解く（共通の流れ） */
export async function bootWith(
  page: Page,
  c: Pick<Case, 'levels' | 'attempted' | 'seed'>,
  settings?: Record<string, unknown>,
): Promise<void> {
  await gotoApp(page, { seed: c.seed ?? 1 });
  await prepare(page, { levels: c.levels, attempted: c.attempted, settings });
  await start(page);
}
