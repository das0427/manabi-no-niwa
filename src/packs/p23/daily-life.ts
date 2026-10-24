/**
 * p23.env.daily-life くらしの どうぐ・じゅんばん（curriculum-matrix 3.1）。
 * L2（段階0）: 場面に つかう もの（2択）。L3（段階1）: 2つの じゅんばん（order 2まい）と、つかいかたで えらぶ（3択）。
 * 同一性キー: 場面（＋問い方）、順番は 2つの行動の組。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import type { OrderItem } from '../../engines/order/order';
import { choiceItem, ill, others } from './lib';

interface Tool {
  illust: string;
  name: string;
  /** 場面（「〜よ。つかうのは どっち？」） */
  scene: string;
  /** つかいかた（別例: 「〜のは どれ？」） */
  use: string;
}
const TOOLS: Tool[] = [
  { illust: 'umbrella', name: 'かさ', scene: 'あめが ふって きたよ。', use: 'あめの ひに さす' },
  { illust: 'pencil', name: 'えんぴつ', scene: 'おえかきを するよ。', use: 'えを かく' },
  { illust: 'p23-shoe', name: 'くつ', scene: 'おそとへ いくよ。', use: 'あしに はく' },
  { illust: 'p23-hat', name: 'ぼうし', scene: 'おひさまが まぶしいよ。', use: 'あたまに かぶる' },
  {
    illust: 'p23-book',
    name: 'えほん',
    scene: 'おはなしを よんで もらうよ。',
    use: 'おはなしを よむ',
  },
  { illust: 'p23-toothbrush', name: 'はぶらし', scene: 'はを みがくよ。', use: 'はを みがく' },
  { illust: 'p23-soap', name: 'せっけん', scene: 'てを あらうよ。', use: 'てを あわあわに する' },
  { illust: 'p23-spoon', name: 'スプーン', scene: 'ごはんを たべるよ。', use: 'ごはんを すくう' },
  { illust: 'p23-towel', name: 'タオル', scene: 'てが ぬれたよ。', use: 'ぬれた てを ふく' },
  { illust: 'p23-cup', name: 'コップ', scene: 'のどが かわいたよ。', use: 'みずを のむ' },
  {
    illust: 'p23-pillow',
    name: 'まくら',
    scene: 'おやすみの じかんだよ。',
    use: 'あたまを のせて ねる',
  },
  { illust: 'ball', name: 'ボール', scene: 'こうえんで あそぶよ。', use: 'ころがして あそぶ' },
];
const T = (illust: string) => TOOLS.find((t) => t.illust === illust)!;

function toolItem(t: Tool, alt: boolean): Item {
  const wrong = others(`tool:${t.illust}:${alt}`, TOOLS, t, alt ? 2 : 1);
  const id = `${alt ? 'use' : 'scene'}:${t.illust}`;
  return choiceItem({
    id,
    objective: 'tool',
    level: alt ? 1 : 0,
    alt,
    prompt: alt ? `${t.use}のは どれ？` : `${t.scene} つかうのは どっち？`,
    hints: ['いつも どれを つかって いるかな。', `${t.use} ものだよ。`],
    explain: `${t.name}を つかうね。`,
    identity: id,
    correct: { label: t.name, figure: ill(t.illust) },
    wrong: wrong.map((w) => ({
      label: w.name,
      figure: ill(w.illust),
      misconception: 'other-tool',
    })),
  });
}

/** 2つの順番（はじめ → つぎ） */
const STEPS: { id: string; first: [string, string]; next: [string, string] }[] = [
  { id: 'wash-eat', first: ['p23-soap', 'てを あらう'], next: ['p23-spoon', 'ごはんを たべる'] },
  {
    id: 'eat-brush',
    first: ['p23-spoon', 'ごはんを たべる'],
    next: ['p23-toothbrush', 'はを みがく'],
  },
  { id: 'brush-sleep', first: ['p23-toothbrush', 'はを みがく'], next: ['p23-pillow', 'ねる'] },
  { id: 'shoe-play', first: ['p23-shoe', 'くつを はく'], next: ['ball', 'こうえんで あそぶ'] },
  { id: 'wash-wipe', first: ['p23-soap', 'てを あらう'], next: ['p23-towel', 'てを ふく'] },
  { id: 'book-sleep', first: ['p23-book', 'えほんを よむ'], next: ['p23-pillow', 'ねる'] },
];

function orderItem(s: (typeof STEPS)[number]): OrderItem {
  return {
    engine: 'order',
    id: `order:${s.id}`,
    objective: 'order',
    level: 1,
    prompt: 'どっちが さき？ じゅんばんに ならべよう。',
    cards: [
      { figure: ill(s.first[0]), label: s.first[1] },
      { figure: ill(s.next[0]), label: s.next[1] },
    ],
    ends: ['はじめ', 'つぎ'],
    reverseMisconception: 'order-reverse',
    hints: [
      'いつも どっちを さきに するかな。',
      `${s.first[1]}の あとで ${s.next[1]}かな、それとも はんたいかな。`,
    ],
    explain: `${s.first[1]}、それから ${s.next[1]}。`,
    identity: `order:${s.id}`,
  };
}

/** 別例: 「〜の まえに するのは どっち？」（並べずに選ぶ） */
const BEFORE: { id: string; after: string; right: string; wrong: string }[] = [
  { id: 'before-eat', after: 'ごはんの まえに', right: 'p23-soap', wrong: 'p23-pillow' },
  { id: 'before-sleep', after: 'ねる まえに', right: 'p23-toothbrush', wrong: 'ball' },
  { id: 'before-out', after: 'おそとに でる まえに', right: 'p23-shoe', wrong: 'p23-spoon' },
];
function beforeItem(b: (typeof BEFORE)[number]): Item {
  const r = T(b.right);
  const w = T(b.wrong);
  return choiceItem({
    id: `before:${b.id}`,
    objective: 'order',
    level: 1,
    alt: true,
    prompt: `${b.after} つかうのは どっち？`,
    hints: ['いつも どうして いるか おもいだそう。', `${r.use} ものかな。`],
    explain: `${b.after} ${r.name}を つかうね。`,
    identity: `before:${b.id}`,
    correct: { label: r.name, figure: ill(r.illust) },
    wrong: [{ label: w.name, figure: ill(w.illust), misconception: 'order-reverse' }],
  });
}

function build(): Item[] {
  const items: Item[] = [];
  for (const t of TOOLS) items.push(toolItem(t, false));
  for (const i of [0, 3, 6, 9]) items.push(toolItem(TOOLS[i]!, true));
  for (const s of STEPS) items.push(orderItem(s));
  for (const b of BEFORE) items.push(beforeItem(b));
  return items;
}

export const dailyLife: UnitSpec = {
  id: 'p23.env.daily-life',
  title: 'くらしの どうぐ',
  stage: 'p23',
  subject: 'env',
  domain: 'play',
  kind: 'play',
  priority: 'P1',
  status: 'ready',
  icon: 'p23-spoon',
  prereq: [],
  objectives: [
    { id: 'tool', title: 'ばめんに つかう もの' },
    { id: 'order', title: 'ふたつの じゅんばん' },
  ],
  misconceptions: [
    {
      id: 'other-tool',
      explain: 'それは ほかの ときに つかう ものだね。いまは なにを するのかな。',
    },
    {
      id: 'order-reverse',
      explain: 'じゅんばんが はんたいかな。いつも どっちを さきに するか おもいだそう。',
    },
  ],
  levels: [
    { label: '2さいの だんかい: つかう もの（2つから）', chance: 0.5 },
    { label: '3さいの だんかい: ふたつの じゅんばん', chance: 0.5 },
  ],
  intro: [{ text: 'ごはんを たべる ときは、スプーンを つかうね。', figure: ill('p23-spoon') }],
  source: { kind: 'items', items: build() },
  review: 'none',
  basis:
    '保育所保育指針 1歳以上3歳未満児 健康（生活の習慣）、curriculum-matrix 3.1（1ステップの順序まで）',
  revised: '2026-10-24',
};
