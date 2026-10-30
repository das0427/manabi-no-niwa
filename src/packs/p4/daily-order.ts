/**
 * p4.env.daily-order くらしの じゅんばん（P2。curriculum-matrix 3.2・4.2。設計: docs/expansion/p2-design/p4.md 3章）。
 * 場面の手順表（SCENES）が唯一の正本。3まいの じゅんばん → 4まいの じゅんばん。
 * 家庭によって順が変わる場面は使わない（前の手順をしないと次ができない場面か、ほぼどの家庭でも同じ順の場面だけ）。
 * 同一性キー: order:場面 / next:場面 / first:場面 / last:場面。
 */
import type { ChoiceItem, Item, UnitSpec } from '../../curriculum/types';
import type { OrderItem } from '../../engines/order/order';
import { choiceItem, ill } from './lib';

export interface Step {
  /** 手順の文（カードの文） */
  text: string;
  illust: string;
}
export interface Scene {
  id: string;
  prompt: string;
  steps: Step[];
  why: string;
}
const S = (text: string, illust: string): Step => ({ text, illust });

export const SCENES: Scene[] = [
  {
    id: 'asa',
    prompt: 'あさ おきてから。',
    steps: [
      S('おきる', 'p23-pillow'),
      S('あさごはんを たべる', 'onigiri'),
      S('でかける', 'p23-shoe'),
    ],
    why: 'ごはんを たべてから でかけるね。',
  },
  {
    id: 'gohan',
    prompt: 'ごはんの じかん。',
    steps: [
      S('てを あらう', 'p23-soap'),
      S('ごはんを たべる', 'p23-spoon'),
      S('はを みがく', 'p23-toothbrush'),
    ],
    why: 'きれいな てで たべて、たべた あとに はを みがくね。',
  },
  {
    id: 'mizu',
    prompt: 'みずを のもう。',
    steps: [
      S('コップを だす', 'p23-cup'),
      S('みずを いれる', 'p4-faucet'),
      S('みずを のむ', 'p23-cup'),
    ],
    why: 'コップに みずを いれないと のめないね。',
  },
  {
    id: 'ame',
    prompt: 'あめの ひの かえりみち。',
    steps: [
      S('あめが ふって きた', 'p4-rain'),
      S('かさを さす', 'umbrella'),
      S('いえに つく', 'house'),
    ],
    why: 'あめが ふったから かさを さしたね。',
  },
  {
    id: 'ofuro',
    prompt: 'おふろに はいろう。',
    steps: [
      S('ふくを ぬぐ', 'p4-shirt'),
      S('おふろに はいる', 'p4-bath'),
      S('タオルで ふく', 'p23-towel'),
    ],
    why: 'ふくを ぬがないと おふろに はいれないね。',
  },
  {
    id: 'neru',
    prompt: 'よるの じかん。',
    steps: [
      S('はを みがく', 'p23-toothbrush'),
      S('ふとんに はいる', 'p23-pillow'),
      S('ねむる', 'p5-moon'),
    ],
    why: 'ふとんに はいってから ねむるね。',
  },
  {
    id: 'kutsu',
    prompt: 'そとへ あそびに いこう。',
    steps: [
      S('くつしたを はく', 'p4-sock'),
      S('くつを はく', 'p23-shoe'),
      S('そとで あそぶ', 'ball'),
    ],
    why: 'くつしたは、くつより さきに はくね。',
  },
  {
    id: 'oekaki',
    prompt: 'おえかきを しよう。',
    steps: [
      S('かみを だす', 'p4-paper'),
      S('えを かく', 'pencil'),
      S('えんぴつを かたづける', 'p5-box'),
    ],
    why: 'かき おわったら かたづけるね。',
  },
  {
    id: 'tearai',
    prompt: 'てを あらおう。',
    steps: [
      S('てを みずで ぬらす', 'p4-faucet'),
      S('せっけんで あらう', 'p23-soap'),
      S('みずで ながす', 'p4-faucet'),
      S('タオルで ふく', 'p23-towel'),
    ],
    why: 'せっけんを ながしてから、タオルで ふくね。',
  },
  {
    id: 'hana',
    prompt: 'はなを そだてよう。',
    steps: [
      S('たねを まく', 'life-seed'),
      S('みずを やる', 'life-watering-can'),
      S('めが でる', 'life-sprout'),
      S('はなが さく', 'flower'),
    ],
    why: 'たねから めが でて、はなが さくね。',
  },
  {
    id: 'tamago',
    prompt: 'たまごやきを つくろう。',
    steps: [
      S('たまごを わる', 'egg'),
      S('おわんで まぜる', 'p4-bowl'),
      S('フライパンで やく', 'p4-pan'),
      S('おさらに のせる', 'p4-plate'),
    ],
    why: 'わって、まぜて、やいてから おさらに のせるね。',
  },
  {
    id: 'shokuji',
    prompt: 'ごはんの よういと かたづけ。',
    steps: [
      S('テーブルを ふく', 'p23-towel'),
      S('おさらを ならべる', 'p4-plate'),
      S('ごはんを たべる', 'p23-spoon'),
      S('おさらを かたづける', 'p4-plate'),
    ],
    why: 'ふいてから ならべて、たべた あとに かたづけるね。',
  },
  {
    id: 'onigiri',
    prompt: 'おにぎりを つくろう。',
    steps: [
      S('てを あらう', 'p23-soap'),
      S('ごはんを てに のせる', 'p4-bowl'),
      S('ぎゅっと にぎる', 'onigiri'),
      S('のりを まく', 'onigiri'),
    ],
    why: 'にぎって かたちが できてから のりを まくね。',
  },
  {
    id: 'kouen',
    prompt: 'こうえんへ いこう。',
    steps: [
      S('くつしたを はく', 'p4-sock'),
      S('くつを はく', 'p23-shoe'),
      S('こうえんで あそぶ', 'ball'),
      S('かえって てを あらう', 'p23-soap'),
    ],
    why: 'あそんで かえったら、てを あらうね。',
  },
];
export const scene = (id: string): Scene => SCENES.find((s) => s.id === id)!;

function orderItem(sc: Scene): OrderItem {
  const n = sc.steps.length;
  const id = `order:${sc.id}`;
  return {
    engine: 'order',
    id,
    objective: n === 3 ? 'three' : 'four',
    level: n === 3 ? 0 : 1,
    prompt: `${sc.prompt} じゅんばんに ならべよう。`,
    cards: sc.steps.map((s) => ({ label: s.text, figure: ill(s.illust) })),
    ends: ['はじめ', 'おわり'],
    reverseMisconception: 'order-reverse',
    wrongOrders: (n === 3
      ? [
          [1, 0, 2],
          [0, 2, 1],
        ]
      : [
          [1, 0, 2, 3],
          [0, 2, 1, 3],
          [0, 1, 3, 2],
        ]
    ).map((order) => ({ order, misconception: 'order-swap' })),
    hints: [
      'いちばん はじめに する ことは どれかな。',
      `はじめは「${sc.steps[0]!.text}」。その つぎは なにかな。`,
    ],
    explain: `${sc.steps.map((s) => s.text).join(' → ')}。${sc.why}`,
    identity: id,
  };
}

type Kind = 'next' | 'first' | 'last';
interface Pick {
  text: string;
  illust: string;
  mis?: string;
}
const P = (text: string, illust: string, mis?: string): Pick =>
  mis ? { text, illust, mis } : { text, illust };
export interface Alt {
  kind: Kind;
  scene: string;
  /** 「つぎ」のとき、直前にした手順の絵 */
  figure?: string;
  prompt: string;
  right: Pick;
  wrong: [Pick, Pick];
  hints: [string, string];
  explain: string;
}
export const ALTS: Alt[] = [
  {
    kind: 'next',
    scene: 'ofuro',
    figure: 'p4-shirt',
    prompt: 'ふくを ぬいだよ。つぎに するのは どれ？',
    right: P('おふろに はいる', 'p4-bath'),
    wrong: [
      P('タオルで ふく', 'p23-towel', 'order-skip'),
      P('かさを さす', 'umbrella', 'other-scene'),
    ],
    hints: ['いまは おふろの じゅんびだね。', 'ふくを ぬいだ すぐ あとに する ことだよ。'],
    explain: 'おふろに はいるね。ふくを ぬいだら おふろ、それから タオルだよ。',
  },
  {
    kind: 'next',
    scene: 'kutsu',
    figure: 'p4-sock',
    prompt: 'くつしたを はいたよ。つぎに するのは どれ？',
    right: P('くつを はく', 'p23-shoe'),
    wrong: [
      P('そとで あそぶ', 'ball', 'order-skip'),
      P('はを みがく', 'p23-toothbrush', 'other-scene'),
    ],
    hints: ['そとへ いく じゅんびだね。', 'くつしたの うえに はく ものは なにかな。'],
    explain: 'くつを はくね。くつを はいたら そとで あそべるよ。',
  },
  {
    kind: 'first',
    scene: 'gohan',
    prompt: 'ごはんの じかん。いちばん はじめに するのは どれ？',
    right: P('てを あらう', 'p23-soap'),
    wrong: [
      P('はを みがく', 'p23-toothbrush', 'order-reverse'),
      P('ごはんを たべる', 'p23-spoon', 'order-swap'),
    ],
    hints: ['たべる まえに する ことは なにかな。', 'きたない てで たべないように するよ。'],
    explain: 'てを あらうのが はじめ。それから たべて、はを みがくね。',
  },
  {
    kind: 'last',
    scene: 'oekaki',
    prompt: 'おえかきを するよ。さいごに するのは どれ？',
    right: P('えんぴつを かたづける', 'p5-box'),
    wrong: [P('かみを だす', 'p4-paper', 'order-reverse'), P('えを かく', 'pencil', 'order-swap')],
    hints: ['おえかきが おわったら どう するかな。', 'つかった ものを どう するかな。'],
    explain: 'さいごは かたづけるね。',
  },
  {
    kind: 'last',
    scene: 'tearai',
    prompt: 'てを あらうよ。さいごに するのは どれ？',
    right: P('タオルで ふく', 'p23-towel'),
    wrong: [
      P('てを みずで ぬらす', 'p4-faucet', 'order-reverse'),
      P('せっけんで あらう', 'p23-soap', 'order-swap'),
    ],
    hints: ['あらい おわった ては ぬれて いるね。', 'ぬれた てを どう するかな。'],
    explain: 'さいごは タオルで ふくね。',
  },
  {
    kind: 'next',
    scene: 'tamago',
    figure: 'p4-bowl',
    prompt: 'たまごを わって まぜたよ。つぎに するのは どれ？',
    right: P('フライパンで やく', 'p4-pan'),
    wrong: [
      P('おさらに のせる', 'p4-plate', 'order-skip'),
      P('たまごを わる', 'egg', 'order-before'),
    ],
    hints: ['まぜた たまごは、まだ やいて いないね。', 'ひを つかう ことだよ。'],
    explain: 'フライパンで やくね。やいてから おさらに のせるよ。',
  },
  {
    kind: 'first',
    scene: 'shokuji',
    prompt: 'ごはんの よういを するよ。いちばん はじめに するのは どれ？',
    right: P('テーブルを ふく', 'p23-towel'),
    wrong: [
      P('ごはんを たべる', 'p23-spoon', 'order-skip'),
      P('おさらを かたづける', 'p4-plate', 'order-reverse'),
    ],
    hints: ['おさらを ならべる まえに する ことは なにかな。', 'テーブルを きれいに するよ。'],
    explain: 'はじめに テーブルを ふくね。それから おさらを ならべるよ。',
  },
  {
    kind: 'last',
    scene: 'onigiri',
    prompt: 'おにぎりを つくるよ。さいごに するのは どれ？',
    right: P('のりを まく', 'onigiri'),
    wrong: [
      P('てを あらう', 'p23-soap', 'order-reverse'),
      P('ごはんを てに のせる', 'p4-bowl', 'order-swap'),
    ],
    hints: ['かたちが できた おにぎりに なにを するかな。', 'くろくて うすい ものを つけるよ。'],
    explain: 'さいごに のりを まくね。',
  },
];

function altItem(a: Alt): ChoiceItem {
  const id = `${a.kind}:${a.scene}`;
  const n = scene(a.scene).steps.length;
  const opt = (p: Pick) => ({ label: p.text, figure: ill(p.illust) });
  return choiceItem({
    id,
    objective: n === 3 ? 'three' : 'four',
    level: n === 3 ? 0 : 1,
    alt: true,
    prompt: a.prompt,
    ...(a.figure ? { figure: ill(a.figure) } : {}),
    layout: 'row',
    hints: a.hints,
    explain: a.explain,
    identity: id,
    correct: opt(a.right),
    wrong: a.wrong.map((w) => ({ ...opt(w), misconception: w.mis })),
  });
}

function build(): Item[] {
  return [...SCENES.map(orderItem), ...ALTS.map(altItem)];
}

export const dailyOrder: UnitSpec = {
  id: 'p4.env.daily-order',
  title: 'くらしの じゅんばん',
  stage: 'p4',
  subject: 'env',
  domain: 'play',
  kind: 'play',
  priority: 'P2',
  status: 'ready',
  icon: 'p23-clock',
  prereq: ['p23.env.daily-life'],
  objectives: [
    { id: 'three', title: '3つの じゅんばん' },
    { id: 'four', title: '4つの じゅんばん' },
  ],
  misconceptions: [
    {
      id: 'order-reverse',
      explain: 'さいごから ならべたのかな。いちばん はじめに する ことから ならべよう。',
    },
    {
      id: 'order-swap',
      explain:
        'となりどうしが いれかわったのかな。どっちを さきに しないと できないか かんがえよう。',
    },
    { id: 'order-skip', explain: 'ひとつ とばしたのかな。その まえに する ことが あるよ。' },
    {
      id: 'order-before',
      explain: 'もう した ことを えらんだのかな。その あとに する ことを さがそう。',
    },
    {
      id: 'other-scene',
      explain: 'ちがう ときに する ことだと おもうよ。いまは なにを して いるかな。',
    },
  ],
  levels: [
    { label: '3まいの じゅんばん', chance: 1 / 6 },
    { label: '4まいの じゅんばん', chance: 1 / 24 },
  ],
  intro: [
    {
      text: 'てを あらって、ごはんを たべて、はを みがく。する じゅんばんが あるね。',
      figure: {
        kind: 'row',
        items: [ill('p23-soap'), ill('p23-spoon'), ill('p23-toothbrush')],
      },
    },
  ],
  source: { kind: 'items', items: build() },
  review: 'none',
  basis:
    '幼稚園教育要領 第2章 健康 内容(6)（健康な生活のリズム）・(7)（身の回りを清潔にし、衣服の着脱、食事などを自分でする）・(8)（見通しをもって行動する）、curriculum-matrix 3.2・4.2（3つ → 4つの順）',
  gradeIsAppProposal: true,
  revised: '2026-10-30',
};
