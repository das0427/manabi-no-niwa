/**
 * p4.think.memory おぼえて さがす（curriculum-matrix 3.2・4.1）。
 * v1 のモード（memory）をそのまま使う単元。進度は v1 の同じスキルの記録をそのまま読む（変換しない: 統括の判断6）。
 * 中身・検査は v1 のモードとそのテストが受け持つ（この単元は参照の正しさだけを検査する）。
 */
import type { UnitSpec } from '../../curriculum/types';

export const memoryUnit: UnitSpec = {
  id: 'p4.think.memory',
  title: 'おぼえて さがす',
  stage: 'p4',
  subject: 'think',
  domain: 'play',
  kind: 'play',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-memory',
  prereq: [],
  objectives: [
    { id: 'B12', title: '1まいを おぼえて えらぶ' },
    { id: 'B34', title: 'ばしょを おぼえる' },
    { id: 'B56', title: 'じゅんばんを おぼえる' },
  ],
  misconceptions: [],
  levels: [
    { label: 'B1 1まいを おぼえて 2たく', chance: 0.5 },
    { label: 'B2 1まいを おぼえて 3たく', chance: 1 / 3 },
    { label: 'B3 2まいを おぼえて 4まいから', chance: 1 / 6 },
    { label: 'B4 ばしょを おぼえる', chance: 1 / 3 },
    { label: 'B5 2まいの じゅんばん', chance: 0.5 },
    { label: 'B6 3まいの じゅんばん', chance: 1 / 6 },
  ],
  intro: [],
  source: { kind: 'legacy', legacy: { modeId: 'memory' } },
  review: 'none',
  basis:
    '本アプリ独自（記憶力の向上はうたわない）、curriculum-matrix 3.2・4.1（memory の B1〜B6 をそのまま）',
  revised: '2026-10-24',
};
