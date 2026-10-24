/**
 * p4.think.road みちを つくろう（curriculum-matrix 3.2・4.1）。
 * v1 のモード（road）をそのまま使う単元。進度は v1 の同じスキルの記録をそのまま読む（変換しない: 統括の判断6）。
 * 中身・検査は v1 のモードとそのテストが受け持つ（この単元は参照の正しさだけを検査する）。
 */
import type { UnitSpec } from '../../curriculum/types';

export const roadUnit: UnitSpec = {
  id: 'p4.think.road',
  title: 'みちを つくろう',
  stage: 'p4',
  subject: 'think',
  domain: 'play',
  kind: 'play',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-road',
  prereq: [],
  objectives: [
    { id: 'R12', title: '1〜3かしょを うめる' },
    { id: 'R3', title: 'いわを よける' },
    { id: 'R4', title: 'わかれみち（めやす 5さい）' },
  ],
  misconceptions: [],
  levels: [
    { label: 'R1 1かしょを うめる', chance: 0.1 },
    { label: 'R2 2〜3かしょを うめる', chance: 0.02 },
    { label: 'R3 いわを よける（めやす 5さい）', chance: 0.01 },
    { label: 'R4 わかれみち（めやす 5さい）', chance: 0.01 },
  ],
  intro: [],
  source: { kind: 'legacy', legacy: { modeId: 'road' } },
  review: 'none',
  basis:
    '幼稚園教育要領 環境（試す・工夫する）、curriculum-matrix 3.2・4.1（road の R1〜R4・じゆう をそのまま）',
  revised: '2026-10-24',
};
