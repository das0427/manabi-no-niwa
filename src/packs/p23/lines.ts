/**
 * p23.hand.lines ゆびで せん（L3 のみ。curriculum-matrix 3.1・4.1）。
 * v1 の「なぞって あそぼう」の「せん」を T1・T2（v1 の trace スキルの段階 0〜1）に絞って使う。
 * 進度は v1 の trace スキルの記録をそのまま読む（変換しない: 統括の判断6）。
 * 2歳段階では出さない（なぞりなし: 4.3。ホームの 2歳段階の札に入れない）。
 */
import type { UnitSpec } from '../../curriculum/types';

export const linesUnit: UnitSpec = {
  id: 'p23.hand.lines',
  title: 'ゆびで せん',
  stage: 'p23',
  subject: 'hand',
  domain: 'play',
  kind: 'writing',
  priority: 'P1',
  status: 'ready',
  icon: 'trace-lines',
  prereq: [],
  objectives: [
    { id: 'T1', title: 'ふとく みじかい まっすぐな せん' },
    { id: 'T2', title: 'ながい せん・ゆるい まがった せん' },
  ],
  misconceptions: [],
  levels: [
    { label: 'T1 ふとく みじかい せん', chance: 0 },
    { label: 'T2 ながい せん・ゆるい きょくせん', chance: 0 },
  ],
  intro: [],
  source: { kind: 'legacy', legacy: { modeId: 'trace', variants: ['lines'], levelRange: [0, 1] } },
  review: 'none',
  basis: '研R2/R3（2歳のドラッグは結果が不一致のため L3 のみ）、curriculum-matrix 3.1・4.1',
  revised: '2026-10-24',
};
