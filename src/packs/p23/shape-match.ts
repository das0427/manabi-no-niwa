/**
 * p23.math.shape-match かたちあわせ（curriculum-matrix 3.1）。
 * L2（段階0）: まる・しかく・さんかく の2択。L3（段階1）: 8つの形の3択。L3（段階2）: 向きの違う穴。
 * 同一性キー: 形の組（何を問い、何と並べたか）と穴の向き。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { choiceItem, ill, others } from './lib';

type ShapeId = 'circle' | 'square' | 'triangle' | 'star' | 'heart' | 'rect' | 'diamond' | 'half';

const NAME: Record<ShapeId, string> = {
  circle: 'まる',
  square: 'しかく',
  triangle: 'さんかく',
  star: 'ほし',
  heart: 'ハート',
  rect: 'ながしかく',
  diamond: 'ひしがた',
  half: 'はんぶんの まる',
};

function starPts(): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 48 : 20;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([Math.round(50 + r * Math.cos(a)), Math.round(52 + r * Math.sin(a))]);
  }
  return pts;
}
const HEART: [number, number][] = [
  [50, 92],
  [12, 54],
  [4, 34],
  [10, 16],
  [26, 8],
  [42, 14],
  [50, 26],
  [58, 14],
  [74, 8],
  [90, 16],
  [96, 34],
  [88, 54],
];
const HALF: [number, number][] = (() => {
  const p: [number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI + (i * Math.PI) / 12;
    p.push([Math.round(50 + 46 * Math.cos(a)), Math.round(72 + 46 * Math.sin(a))]);
  }
  return p;
})();

const rot = (pts: [number, number][], deg: number): [number, number][] => {
  const a = (deg * Math.PI) / 180;
  return pts.map(([x, y]) => [
    Math.round(50 + (x - 50) * Math.cos(a) - (y - 50) * Math.sin(a)),
    Math.round(50 + (x - 50) * Math.sin(a) + (y - 50) * Math.cos(a)),
  ]);
};

function shapeFig(s: ShapeId, tone: 'plain' | 'muted' | 'a' = 'a', deg = 0): Figure {
  switch (s) {
    case 'circle':
      return { kind: 'shape', shape: 'circle', tone };
    case 'square':
      return deg % 90 === 0
        ? { kind: 'shape', shape: 'square', tone }
        : {
            kind: 'shape',
            shape: 'polygon',
            points: rot(
              [
                [6, 6],
                [94, 6],
                [94, 94],
                [6, 94],
              ],
              deg,
            ),
            tone,
          };
    case 'rect':
      return deg === 90
        ? { kind: 'shape', shape: 'rect', w: 60, h: 110, tone }
        : { kind: 'shape', shape: 'rect', w: 110, h: 60, tone };
    case 'triangle':
      return deg === 0
        ? { kind: 'shape', shape: 'triangle', tone }
        : {
            kind: 'shape',
            shape: 'polygon',
            points: rot(
              [
                [50, 4],
                [96, 92],
                [4, 92],
              ],
              deg,
            ),
            tone,
          };
    case 'star':
      return { kind: 'shape', shape: 'polygon', points: rot(starPts(), deg), tone };
    case 'heart':
      return { kind: 'shape', shape: 'polygon', points: rot(HEART, deg), tone };
    case 'diamond':
      // たてに ほそながい ひしがた（よこ幅を たての 6割に。正方形を 45度 まわした形だと
      // 「しかく」と 見分けられず、L2 の「まわった しかくの あな」とも 同じ形になる）
      return {
        kind: 'shape',
        shape: 'polygon',
        points: rot(
          [
            [50, 4],
            [78, 50],
            [50, 96],
            [22, 50],
          ],
          deg,
        ),
        tone,
      };
    case 'half':
      return { kind: 'shape', shape: 'polygon', points: rot(HALF, deg), tone };
  }
}

const opt = (s: ShapeId): ChoiceOption => ({
  label: NAME[s],
  figure: shapeFig(s),
  misconception: 'other-shape',
});

const BASIC: ShapeId[] = ['circle', 'square', 'triangle'];
const ALL: ShapeId[] = ['circle', 'square', 'triangle', 'star', 'heart', 'rect', 'diamond', 'half'];

/** 形が似ている組（3択の誤りに入れると「にているけど ちがう」の誤概念） */
const SIMILAR: Partial<Record<ShapeId, ShapeId>> = {
  square: 'rect',
  rect: 'square',
  diamond: 'square',
  circle: 'half',
  half: 'circle',
  star: 'heart',
  heart: 'star',
  triangle: 'diamond',
};

function holeItem(level: number, t: ShapeId, wrong: ShapeId[], deg = 0, alt = false): Item {
  const id = `hole:${t}:${wrong.join('-')}:${deg}`;
  return choiceItem({
    id,
    objective: 'hole',
    level,
    prompt: deg
      ? 'あなが くるっと まわって いるよ。はいるのは どれ？'
      : 'この あなに はいるのは どれ？',
    figure: shapeFig(t, 'muted', deg),
    hints: [
      'あなの かたちを ゆびで なぞって みよう。',
      deg ? 'くるっと まわしても、かたちは おなじだよ。' : 'かどが あるかな。まるいかな。',
    ],
    explain: `${NAME[t]}の あなには ${NAME[t]}が ぴったり。`,
    identity: id,
    alt,
    correct: { label: NAME[t], figure: shapeFig(t) },
    wrong: wrong.map((w) => ({
      ...opt(w),
      misconception: SIMILAR[t] === w ? 'similar-shape' : deg ? 'turned' : 'other-shape',
    })),
  });
}

function nameItem(level: number, t: ShapeId, wrong: ShapeId[]): Item {
  const id = `name:${t}:${wrong.join('-')}`;
  return choiceItem({
    id,
    objective: 'name',
    level,
    prompt: `${NAME[t]}は どれ？`,
    hints: [
      `「${NAME[t]}」を さがそう。`,
      t === 'circle' ? 'かどが ない かたちだよ。' : 'かどの かずを みて みよう。',
    ],
    explain: `これが ${NAME[t]}だよ。`,
    identity: id,
    correct: { label: NAME[t], figure: shapeFig(t) },
    wrong: wrong.map((w) => ({
      ...opt(w),
      misconception: SIMILAR[t] === w ? 'similar-shape' : 'other-shape',
    })),
  });
}

/** 身の回りの物（表し方を変えた問題: 形 → 物、物 → 形） */
const THINGS: { illust: string; name: string; shape: ShapeId }[] = [
  { illust: 'ball', name: 'ボール', shape: 'circle' },
  { illust: 'mikan', name: 'みかん', shape: 'circle' },
  { illust: 'p23-book', name: 'えほん', shape: 'square' },
  { illust: 'onigiri', name: 'おにぎり', shape: 'triangle' },
  { illust: 'p23-star', name: 'ほし', shape: 'star' },
];

function thingToShape(level: number, th: (typeof THINGS)[number], wrong: ShapeId): Item {
  const id = `thing:${th.illust}:${wrong}`;
  return choiceItem({
    id,
    objective: 'name',
    level,
    alt: true,
    prompt: `${th.name}と おなじ かたちは どれ？`,
    figure: ill(th.illust),
    hints: [`${th.name}の まわりを ゆびで なぞって みよう。`, 'かどが あるかな。'],
    explain: `${th.name}は ${NAME[th.shape]}の かたちだね。`,
    identity: id,
    correct: { label: NAME[th.shape], figure: shapeFig(th.shape) },
    wrong: [{ ...opt(wrong), misconception: 'other-shape' }],
  });
}

function shapeToThing(level: number, t: ShapeId, wrongIllust: string, wrongName: string): Item {
  const th = THINGS.find((x) => x.shape === t)!;
  const id = `hole-thing:${t}:${wrongIllust}`;
  return choiceItem({
    id,
    objective: 'hole',
    level,
    alt: true,
    prompt: 'この あなに はいるのは どっち？',
    figure: shapeFig(t, 'muted'),
    hints: ['あなの かたちを よく みよう。', 'まわりの かたちが おなじ ものを さがそう。'],
    explain: `${th.name}は ${NAME[t]}。あなに ぴったりだね。`,
    identity: id,
    correct: { label: th.name, figure: ill(th.illust) },
    wrong: [{ label: wrongName, figure: ill(wrongIllust), misconception: 'other-shape' }],
  });
}

function build(): Item[] {
  const items: Item[] = [];
  // 段階0（L2）: まる・しかく・さんかくの2択（穴と名前）
  for (const t of BASIC)
    for (const w of BASIC) if (w !== t) items.push(holeItem(0, t, [w]), nameItem(0, t, [w]));
  // 段階0 の別例（物 ↔ 形。2択）
  items.push(
    thingToShape(0, THINGS[0]!, 'square'),
    thingToShape(0, THINGS[2]!, 'circle'),
    thingToShape(0, THINGS[3]!, 'square'),
    shapeToThing(0, 'circle', 'p23-book', 'えほん'),
    shapeToThing(0, 'square', 'ball', 'ボール'),
    shapeToThing(0, 'triangle', 'mikan', 'みかん'),
  );
  // 段階1（L3）: 8つの形の3択
  for (const t of ALL) {
    const sim = SIMILAR[t];
    const w1 = others(`h1:${t}`, ALL, t, 2, (x) => x !== sim);
    items.push(holeItem(1, t, w1));
    items.push(nameItem(1, t, others(`n1:${t}`, ALL, t, 2)));
  }
  items.push(thingToShape(1, THINGS[1]!, 'triangle'), thingToShape(1, THINGS[4]!, 'heart'));
  // 段階2（L3）: 向きの違う穴、似た形を混ぜる
  const TURN: [ShapeId, number][] = [
    ['triangle', 180],
    ['triangle', 90],
    ['rect', 90],
    ['star', 180],
    ['heart', 180],
    ['half', 90],
    ['half', 180],
    ['square', 45],
  ];
  for (const [t, deg] of TURN) {
    const sim = SIMILAR[t]!;
    const w = others(`t:${t}:${deg}`, ALL, t, 1, (x) => x !== sim);
    items.push(holeItem(2, t, [sim, ...w], deg));
  }
  return items;
}

export const shapeMatch: UnitSpec = {
  id: 'p23.math.shape-match',
  title: 'かたちあわせ',
  stage: 'p23',
  subject: 'math',
  domain: 'play',
  kind: 'play',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-shapes',
  prereq: [],
  objectives: [
    { id: 'hole', title: 'おなじ かたちの あなに いれる' },
    { id: 'name', title: 'かたちの なまえで えらぶ' },
  ],
  misconceptions: [
    {
      id: 'other-shape',
      explain: 'ちがう かたちだったね。あなの かたちを ゆびで なぞって みよう。',
    },
    { id: 'similar-shape', explain: 'にているけど すこし ちがうね。かどや ながさを よく みよう。' },
    { id: 'turned', explain: 'あなが まわって いても、かたちは おなじ ものが はいるよ。' },
  ],
  levels: [
    { label: '2さいの だんかい: まる・しかく・さんかく（2つから）', chance: 0.5 },
    { label: '3さいの だんかい: いろいろな かたち（3つから）', chance: 1 / 3 },
    { label: '3さいの だんかい: むきの ちがう あな', chance: 1 / 3 },
  ],
  intro: [
    { text: 'まるの あなが あるよ。', figure: shapeFig('circle', 'muted') },
    { text: 'まるを いれると、ぴったり。', figure: shapeFig('circle') },
  ],
  source: { kind: 'items', items: build() },
  review: 'none',
  basis: '保育所保育指針 1歳以上3歳未満児 環境（形・色・大きさ）、curriculum-matrix 3.1',
  revised: '2026-10-24',
};
