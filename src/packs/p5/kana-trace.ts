/**
 * p5.hand.kana-trace ひらがなを なぞる（書字の準備。curriculum-matrix 3.3・4.1）: 46字。
 * なぞり（書き順の線に沿う。v1 と同じ判定）と、お手本と見比べる自由書き（採点しない）。字形の正誤は採点しない。
 * 段階0: 1画の字（v1 の T5）。段階1: 2画の字（T6）。段階2: 3画以上・曲線の多い字（T7 を含む）。
 * v1 の なぞり（T5〜T7）から分けた単元なので、進度は新しく始める（判断6）。v1 の作品は v1 に残る。
 * 同一性キー: trace:字、free:字（別例）。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import type { TraceItem } from '../../engines/trace/trace';

const ONE = 'しくつてのへひそるろん';
const TWO = 'いうえこりちとぬねめゆれわよらす';
const ALL =
  'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
const MANY = [...ALL].filter((c) => !ONE.includes(c) && !TWO.includes(c)).join('');

const groupOf = (c: string) => (ONE.includes(c) ? 'one' : TWO.includes(c) ? 'two' : 'many');
const levelOf = (c: string) => (ONE.includes(c) ? 0 : TWO.includes(c) ? 1 : 2);

function traceItem(c: string): TraceItem {
  return {
    engine: 'trace',
    id: `trace:${c}`,
    objective: groupOf(c),
    level: levelOf(c),
    prompt: `「${c}」を なぞろう。みどりの まるから かこう。`,
    char: c,
    mode: 'trace',
    misconceptionIds: { order: 'stroke-order', direction: 'stroke-direction' },
    hints: [
      'おてほんの うごきを みてから かこう。',
      'ばんごうの じゅんに、みどりの まるから かこう。',
    ],
    explain: `「${c}」が かけたね。`,
    identity: `trace:${c}`,
  };
}

function freeItem(c: string): TraceItem {
  return {
    engine: 'trace',
    id: `free:${c}`,
    objective: groupOf(c),
    level: levelOf(c),
    alt: true,
    prompt: `「${c}」を じぶんで かいて、おてほんと くらべよう。`,
    char: c,
    mode: 'free',
    hints: ['おてほんを よく みてから かこう。', 'かいたら、おてほんと かさねて くらべよう。'],
    explain: 'おてほんと くらべて、にて いる ところを みつけよう。',
    identity: `free:${c}`,
  };
}

function build(): Item[] {
  const items: Item[] = [];
  for (const g of [ONE, TWO, MANY]) {
    [...g].forEach((c, i) => {
      items.push(traceItem(c));
      if (i % 3 === 0) items.push(freeItem(c));
    });
  }
  return items;
}

export const kanaTrace: UnitSpec = {
  id: 'p5.hand.kana-trace',
  title: 'ひらがなを なぞる',
  stage: 'p5',
  subject: 'hand',
  domain: 'play',
  kind: 'writing',
  priority: 'P1',
  status: 'ready',
  icon: 'trace-letters',
  prereq: ['p4.hand.lines'],
  objectives: [
    { id: 'one', title: '1かくの じ' },
    { id: 'two', title: '2かくの じ' },
    { id: 'many', title: '3かく いじょう・まがる じ' },
  ],
  misconceptions: [
    { id: 'stroke-order', explain: 'かく じゅんばんが ちがったかな。ばんごうの じゅんに かこう。' },
    { id: 'stroke-direction', explain: 'かく むきが はんたいかな。みどりの まるから はじめよう。' },
  ],
  levels: [
    { label: '1かくの じ（T5）', chance: 0 },
    { label: '2かくの じ（T6）', chance: 0 },
    { label: '3かく いじょう（T7 ほか）', chance: 0 },
  ],
  intro: [
    {
      text: 'みどりの まるから、やじるしの ほうへ ゆびで なぞろう。',
      figure: { kind: 'text', text: 'し', size: 'xl' },
    },
  ],
  source: { kind: 'items', items: build() },
  review: 'view',
  basis:
    '教材会社の目安（教C1/C2）、幼稚園教育要領解説（書くことはまだ難しい）、curriculum-matrix 3.3・4.1',
  revised: '2026-10-24',
};
