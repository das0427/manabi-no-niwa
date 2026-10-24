/**
 * p4.math.shapes かたち パズル（curriculum-matrix 3.2・4.1）。
 * v1 のモード（shapes）をそのまま使う単元。進度は v1 の同じスキルの記録をそのまま読む（変換しない: 統括の判断6）。
 * 中身・検査は v1 のモードとそのテストが受け持つ（この単元は参照の正しさだけを検査する）。
 */
import type { UnitSpec } from '../../curriculum/types';

export const shapesUnit: UnitSpec = {
  id: 'p4.math.shapes',
  title: 'かたち パズル',
  stage: 'p4',
  subject: 'math',
  domain: 'play',
  kind: 'play',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-shapes',
  prereq: ['p23.math.shape-match'],
  objectives: [
    { id: 'K1', title: 'おなじ かたちを えらぶ' },
    { id: 'K2', title: '2〜3ピースで つくる' },
    { id: 'K3', title: '4ピースで つくる' },
    { id: 'K4', title: 'むきを かえて いれる' },
  ],
  misconceptions: [],
  levels: [
    { label: 'K1 おなじ かたちを えらぶ', chance: 1 / 3 },
    { label: 'K2 2〜3ピースで つくる', chance: 1 / 6 },
    { label: 'K3 4ピースで つくる', chance: 0.05 },
    { label: 'K4 むきを かえて いれる', chance: 0.05 },
  ],
  intro: [],
  source: { kind: 'legacy', legacy: { modeId: 'shapes', levelRange: [0, 3] } },
  review: 'view',
  basis:
    '幼稚園教育要領 環境（図形）、curriculum-matrix 3.2・4.1（shape の K1〜K4。K5 は p5.math.shapes）',
  revised: '2026-10-24',
};
