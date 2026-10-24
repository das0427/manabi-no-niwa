/**
 * p4.math.shop おかいもの ごっこ（curriculum-matrix 3.2・4.1）。
 * v1 のモード（shopping）をそのまま使う単元。進度は v1 の同じスキルの記録をそのまま読む（変換しない: 統括の判断6）。
 * 中身・検査は v1 のモードとそのテストが受け持つ（この単元は参照の正しさだけを検査する）。
 */
import type { UnitSpec } from '../../curriculum/types';

export const shopUnit: UnitSpec = {
  id: 'p4.math.shop',
  title: 'おかいもの ごっこ',
  stage: 'p4',
  subject: 'math',
  domain: 'play',
  kind: 'play',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-shopping',
  prereq: ['p23.math.shop'],
  objectives: [
    { id: 'S1', title: 'なまえを きいて 1つ えらぶ' },
    { id: 'S2', title: 'おなじ しなものを 1〜3こ' },
    { id: 'S3', title: 'おなじ しなものを 1〜5こ' },
    { id: 'S4', title: '2しゅるいの ちゅうもん' },
  ],
  misconceptions: [],
  levels: [
    { label: 'S1 なまえを きいて 1つ えらぶ', chance: 0.25 },
    { label: 'S2 おなじ しなものを 1〜3こ', chance: 0.1 },
    { label: 'S3 おなじ しなものを 1〜5こ', chance: 0.05 },
    { label: 'S4 2しゅるいの ちゅうもん', chance: 0.02 },
  ],
  intro: [],
  source: { kind: 'legacy', legacy: { modeId: 'shopping' } },
  review: 'view',
  basis:
    '幼稚園教育要領 環境（数量）、研R8、curriculum-matrix 3.2・4.1（shop の S1〜S4 をそのまま）',
  revised: '2026-10-24',
};
