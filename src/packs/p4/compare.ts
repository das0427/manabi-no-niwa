/**
 * p4.math.compare くらべっこ（curriculum-matrix 3.2・4.1）。
 * v1 のモード（compare）をそのまま使う単元。進度は v1 の同じスキルの記録をそのまま読む（変換しない: 統括の判断6）。
 * 中身・検査は v1 のモードとそのテストが受け持つ（この単元は参照の正しさだけを検査する）。
 */
import type { UnitSpec } from '../../curriculum/types';

export const compareUnit: UnitSpec = {
  id: 'p4.math.compare',
  title: 'くらべっこ',
  stage: 'p4',
  subject: 'math',
  domain: 'play',
  kind: 'play',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-compare',
  prereq: ['p23.math.compare'],
  objectives: [
    { id: 'P1', title: 'おおきさ' },
    { id: 'P2', title: 'ながさ' },
    { id: 'P3', title: 'かず' },
    { id: 'P4', title: '「おなじ」を ふくむ 3たく' },
    { id: 'P5', title: '3つを じゅんに ならべる' },
  ],
  misconceptions: [],
  levels: [
    { label: 'P1 おおきさ（2たく）', chance: 0.5 },
    { label: 'P2 ながさ（2たく）', chance: 0.5 },
    { label: 'P3 かず（2たく）', chance: 0.5 },
    { label: 'P4 「おなじ」を ふくむ 3たく', chance: 1 / 3 },
    { label: 'P5 3つを じゅんに ならべる', chance: 1 / 6 },
  ],
  intro: [],
  source: { kind: 'legacy', legacy: { modeId: 'compare' } },
  review: 'view',
  basis:
    '保育所保育指針 3歳以上児 環境、curriculum-matrix 3.2・4.1（compare の P1〜P5 をそのまま）',
  revised: '2026-10-24',
};
