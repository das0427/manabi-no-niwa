/**
 * p4.hand.lines せん・かたち・めいろ（curriculum-matrix 3.2・4.1）。
 * v1 のモード（trace）をそのまま使う単元。進度は v1 の同じスキルの記録をそのまま読む（変換しない: 統括の判断6）。
 * 中身・検査は v1 のモードとそのテストが受け持つ（この単元は参照の正しさだけを検査する）。
 */
import type { UnitSpec } from '../../curriculum/types';

export const linesUnit: UnitSpec = {
  id: 'p4.hand.lines',
  title: 'せん・かたち・めいろ',
  stage: 'p4',
  subject: 'hand',
  domain: 'play',
  kind: 'writing',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-trace',
  prereq: ['p23.hand.lines'],
  objectives: [
    { id: 'T1', title: 'ふとく みじかい せん' },
    { id: 'T2', title: 'ながい せん・ゆるい まがった せん' },
    { id: 'T3', title: 'おれせん・かたち' },
    { id: 'T4', title: 'かんたんな めいろ' },
  ],
  misconceptions: [],
  levels: [
    { label: 'T1 ふとく みじかい せん', chance: 0 },
    { label: 'T2 ながい せん・ゆるい きょくせん', chance: 0 },
    { label: 'T3 おれせん・かたち', chance: 0 },
    { label: 'T4 かんたんな めいろ', chance: 0 },
  ],
  intro: [],
  source: {
    kind: 'legacy',
    legacy: { modeId: 'trace', variants: ['lines', 'maze'], levelRange: [0, 3] },
  },
  review: 'none',
  basis: 'curriculum-matrix 3.2・4.1（trace の T1〜T4。もじの T5〜T7 は p5.hand.kana-trace）',
  revised: '2026-10-24',
};
