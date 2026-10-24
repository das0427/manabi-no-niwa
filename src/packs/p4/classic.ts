/**
 * 初期版（v1）の「ひらがな」「さんすう」「もじの なぞり」を、4歳のホームから そのまま遊べるように残す単元。
 * 4歳のホームを新しい単元へつないだとき、これらの v1 のモードに入る道が無くなり、
 * 初期版で遊んでいた子供の続き（v1 の記録）に戻れなくなった（統括の判断: 初期版の遊びは減らさない）。
 * 中身・検査は v1 のモードとそのテストが受け持つ。進度は v1 の記録をそのまま読む（変換しない）。
 */
import type { UnitSpec } from '../../curriculum/types';

const common = {
  stage: 'p4',
  domain: 'play',
  kind: 'play',
  priority: 'P1',
  status: 'ready',
  misconceptions: [],
  intro: [],
  review: 'view',
  revised: '2026-10-24',
} as const;

export const hiraganaClassic: UnitSpec = {
  ...common,
  id: 'p4.ja.hiragana-classic',
  title: 'ひらがな あそび',
  subject: 'ja',
  icon: 'mode-hiragana',
  prereq: [],
  objectives: [
    { id: 'H1', title: 'おとを きいて えらぶ' },
    { id: 'H3', title: 'はじめの おと' },
    { id: 'H4', title: 'ことばを つくる' },
  ],
  levels: [
    { label: 'H1 おとを きいて 2つから', chance: 0.5 },
    { label: 'H2 おとを きいて 3つから', chance: 1 / 3 },
    { label: 'H3 はじめの おと', chance: 0.5 },
    { label: 'H4 2もじの ことば', chance: 1 / 6 },
    { label: 'H5 3もじの ことば', chance: 1 / 24 },
  ],
  source: { kind: 'legacy', legacy: { modeId: 'hiragana' } },
  basis: '初期版の hiragana（H1〜H5）をそのまま。4歳ホームの「ひらがな」の札から開く',
};

export const mathClassic: UnitSpec = {
  ...common,
  id: 'p4.math.classic',
  title: 'たす・ひく・わける',
  subject: 'math',
  icon: 'mode-math',
  prereq: [],
  objectives: [
    { id: 'add', title: 'えで たす' },
    { id: 'sub', title: 'えで ひく' },
    { id: 'split', title: 'わける' },
  ],
  levels: [{ label: 'しょかいの さんすう（あそびかたは なかで えらぶ）', chance: 1 / 3 }],
  source: { kind: 'legacy', legacy: { modeId: 'math' } },
  basis: '初期版の math（たす・ひく・わける・しき）をそのまま。4歳ホームの「さんすう」の札から開く',
};

export const lettersClassic: UnitSpec = {
  ...common,
  id: 'p4.hand.letters-classic',
  title: 'もじを なぞる',
  subject: 'hand',
  kind: 'writing',
  icon: 'trace-letters',
  prereq: ['p4.hand.lines'],
  objectives: [{ id: 'T5', title: 'ひらがなを なぞる' }],
  levels: [{ label: 'T5〜T7 もじ', chance: 0 }],
  source: { kind: 'legacy', legacy: { modeId: 'trace', variants: ['letters'] } },
  review: 'none',
  basis: '初期版の trace の もじ（T5〜T7）をそのまま。4歳ホームの「なぞって あそぼう」の札から開く',
};
