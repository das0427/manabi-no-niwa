/**
 * p5.hand.katakana-trace カタカナを なぞる（P2。curriculum-matrix 3.3・4.4）: 46字。
 * 既定で非表示（保護者が開く: 統括の判断7・9。書きは任意）。字形の正誤は採点しない。
 * 段階0: 1〜2画の字。段階1: 3画以上の字。別例: お手本と見比べる自由書き（採点しない）。
 * 同一性キー: trace:字、free:字。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import type { TraceItem } from '../../engines/trace/trace';

const ALL =
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
/** 1〜2画の字（それ以外は3画以上） */
const FEW = 'イカクケコスセソタチテトナニヌノハヒフヘマムメヤユヨラリルレロワヲン';
const ROWS: { obj: string; chars: string }[] = [
  { obj: 'a-sa', chars: 'アイウエオカキクケコサシスセソ' },
  { obj: 'ta-ha', chars: 'タチツテトナニヌネノハヒフヘホ' },
  { obj: 'ma-n', chars: 'マミムメモヤユヨラリルレロワヲン' },
];
const objOf = (c: string) => ROWS.find((r) => r.chars.includes(c))!.obj;

function item(c: string, free: boolean): TraceItem {
  return {
    engine: 'trace',
    id: `${free ? 'free' : 'trace'}:${c}`,
    objective: objOf(c),
    level: FEW.includes(c) ? 0 : 1,
    alt: free,
    prompt: free
      ? `「${c}」を じぶんで かいて、おてほんと くらべよう。`
      : `「${c}」を なぞろう。みどりの まるから かこう。`,
    char: c,
    mode: free ? 'free' : 'trace',
    ...(free ? {} : { misconceptionIds: { order: 'stroke-order', direction: 'stroke-direction' } }),
    hints: free
      ? ['おてほんを よく みてから かこう。', 'かいたら、おてほんと かさねて くらべよう。']
      : [
          'おてほんの うごきを みてから かこう。',
          'ばんごうの じゅんに、みどりの まるから かこう。',
        ],
    explain: free
      ? 'おてほんと くらべて、にて いる ところを みつけよう。'
      : `「${c}」が かけたね。`,
    identity: `${free ? 'free' : 'trace'}:${c}`,
  };
}

function build(): Item[] {
  const items: Item[] = [];
  [...ALL].forEach((c, i) => {
    items.push(item(c, false));
    if (i % 4 === 0) items.push(item(c, true));
  });
  return items;
}

export const katakanaTrace: UnitSpec = {
  id: 'p5.hand.katakana-trace',
  title: 'カタカナを なぞる',
  stage: 'p5',
  subject: 'hand',
  domain: 'play',
  kind: 'writing',
  priority: 'P2',
  status: 'ready',
  icon: 'trace-letters',
  prereq: ['p5.hand.kana-trace'],
  objectives: ROWS.map((r) => ({
    id: r.obj,
    title: `${[...r.chars][0]}〜${[...r.chars][r.chars.length - 1]}`,
  })),
  misconceptions: [
    { id: 'stroke-order', explain: 'かく じゅんばんが ちがったかな。ばんごうの じゅんに かこう。' },
    { id: 'stroke-direction', explain: 'かく むきが はんたいかな。みどりの まるから はじめよう。' },
  ],
  levels: [
    { label: '1〜2かくの じ', chance: 0 },
    { label: '3かく いじょうの じ', chance: 0 },
  ],
  intro: [
    {
      text: 'カタカナも、みどりの まるから なぞるよ。',
      figure: { kind: 'text', text: 'ノ', size: 'xl' },
    },
  ],
  source: { kind: 'items', items: build() },
  review: 'none',
  basis: '教材会社の目安（教C1。公的資料に記述なし）、curriculum-matrix 3.3・4.4',
  hiddenByDefault: true,
  revised: '2026-10-24',
};
