/**
 * p4.hand.kana-trace-early もじなぞり（P2。curriculum-matrix 3.2）: 1画の ひらがな 6字（v1 の T5 の字）。
 * 保護者が開いたときだけ表示（hiddenByDefault）。字形の正誤は採点しない（書き順の線に沿うかだけ）。
 * 同一性キー: trace:字、free:字（別例: お手本と見比べる自由書き。採点しない）。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import type { TraceItem } from '../../engines/trace/trace';

const CHARS = 'しくつへのて';

function item(c: string, free: boolean): TraceItem {
  return {
    engine: 'trace',
    id: `${free ? 'free' : 'trace'}:${c}`,
    objective: 'one-stroke',
    level: 0,
    alt: free,
    prompt: free
      ? `「${c}」を じぶんで かいて、おてほんと くらべよう。`
      : `「${c}」を なぞろう。みどりの まるから かこう。`,
    char: c,
    mode: free ? 'free' : 'trace',
    ...(free ? {} : { misconceptionIds: { order: 'stroke-order', direction: 'stroke-direction' } }),
    hints: free
      ? ['おてほんを よく みてから かこう。', 'かいたら、おてほんと かさねて くらべよう。']
      : ['おてほんの うごきを みてから かこう。', 'みどりの まるから、とめないで かこう。'],
    explain: free
      ? 'おてほんと くらべて、にて いる ところを みつけよう。'
      : `「${c}」が かけたね。`,
    identity: `${free ? 'free' : 'trace'}:${c}`,
  };
}

function build(): Item[] {
  return [
    ...[...CHARS].map((c) => item(c, false)),
    ...['し', 'つ', 'の'].map((c) => item(c, true)),
  ];
}

export const kanaTraceEarly: UnitSpec = {
  id: 'p4.hand.kana-trace-early',
  title: 'もじなぞり',
  stage: 'p4',
  subject: 'hand',
  domain: 'play',
  kind: 'writing',
  priority: 'P2',
  status: 'ready',
  icon: 'trace-letters',
  prereq: ['p4.hand.lines'],
  objectives: [{ id: 'one-stroke', title: '1かくの ひらがな（し く つ へ の て）' }],
  misconceptions: [
    { id: 'stroke-order', explain: 'かく じゅんばんが ちがったかな。みどりの まるから かこう。' },
    { id: 'stroke-direction', explain: 'かく むきが はんたいかな。みどりの まるから はじめよう。' },
  ],
  levels: [{ label: 'T5 1かくの じ', chance: 0 }],
  intro: [
    {
      text: 'みどりの まるから、やじるしの ほうへ ゆびで なぞろう。',
      figure: { kind: 'text', text: 'し', size: 'xl' },
    },
  ],
  source: { kind: 'items', items: build() },
  review: 'none',
  basis: '教材会社の目安（教C1）、curriculum-matrix 3.2',
  hiddenByDefault: true,
  revised: '2026-10-24',
};
