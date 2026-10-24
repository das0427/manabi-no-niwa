/**
 * p4.think.sort なかまわけ（curriculum-matrix 3.2・4.1）。
 * v1 のモード（sorting）をそのまま使う単元。進度は v1 の同じスキルの記録をそのまま読む（変換しない: 統括の判断6）。
 * 中身・検査は v1 のモードとそのテストが受け持つ（この単元は参照の正しさだけを検査する）。
 */
import type { UnitSpec } from '../../curriculum/types';

export const sortUnit: UnitSpec = {
  id: 'p4.think.sort',
  title: 'なかまわけ',
  stage: 'p4',
  subject: 'think',
  domain: 'play',
  kind: 'play',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-sorting',
  prereq: ['p23.think.sort'],
  objectives: [
    { id: 'N1', title: 'いろで 2つに わける' },
    { id: 'N2', title: 'しゅるいで 2つに わける' },
    { id: 'N3', title: 'しゅるいで 3つに わける' },
    { id: 'N4', title: 'わけかたを かえて わけなおす' },
  ],
  misconceptions: [],
  levels: [
    { label: 'N1 いろで 2つに', chance: 1 / 16 },
    { label: 'N2 しゅるいで 2つに', chance: 1 / 16 },
    { label: 'N3 しゅるいで 3つに', chance: 0.01 },
    { label: 'N4 わけかたを かえる', chance: 0.01 },
  ],
  intro: [],
  source: { kind: 'legacy', legacy: { modeId: 'sorting' } },
  review: 'view',
  basis: 'curriculum-matrix 3.2・4.1（sort の N1〜N4 をそのまま。規則の切り替え）',
  revised: '2026-10-24',
};
