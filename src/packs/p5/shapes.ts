/**
 * p5.math.shapes かたち（curriculum-matrix 3.3・4.1）: 外形だけで置く（K5）、形の組み合わせ、つみきの形。
 * - copy: 見本と同じ形を点をつないで かく（geometry の作図。K5「見本を見て作る」に当たる。図はエンジンが描く）
 * - compose: 2〜4まいの形を あわせて できる形（choice）
 * - solid: ころがる・つみあげる（choice、別例は sort）
 * v1 の かたち（K5）から分けた単元なので、進度は新しく始める（統括の判断6）。
 * 同一性キー: copy:形、draw:形の仲間、compose:組、solid:問い×正答×誤り。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import type { GeometryItem, Pt } from '../../engines/geometry/geometry';
import type { SortItem } from '../../engines/sort/sort';
import { choiceItem, ill, mix } from './lib';

// ---- copy（作図） ----
const COPY: { id: string; name: string; pts: Pt[] }[] = [
  {
    id: 'square',
    name: 'しかく',
    pts: [
      [0, 1],
      [2, 1],
      [2, 3],
      [0, 3],
    ],
  },
  {
    id: 'rect',
    name: 'ながしかく',
    pts: [
      [0, 2],
      [3, 2],
      [3, 3],
      [0, 3],
    ],
  },
  {
    id: 'right-tri',
    name: 'さんかく',
    pts: [
      [0, 1],
      [2, 3],
      [0, 3],
    ],
  },
  {
    id: 'tri',
    name: 'やまの さんかく',
    pts: [
      [0, 3],
      [1, 1],
      [2, 3],
    ],
  },
  {
    id: 'house',
    name: 'いえの かたち',
    pts: [
      [0, 2],
      [1, 1],
      [2, 2],
      [2, 3],
      [0, 3],
    ],
  },
  {
    id: 'l-shape',
    name: 'かぎの かたち',
    pts: [
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 2],
      [2, 3],
      [0, 3],
    ],
  },
  {
    id: 'kite',
    name: 'たこの かたち',
    pts: [
      [1, 0],
      [2, 1],
      [1, 3],
      [0, 1],
    ],
  },
];
const GEO_MIS = { wrongSides: 'size-diff', wrongClass: 'other-shape' } as const;

function copyItem(c: (typeof COPY)[number]): GeometryItem {
  return {
    engine: 'geometry',
    id: `copy:${c.id}`,
    objective: 'copy',
    level: 0,
    prompt: `ひだりの みほんと おなじ ${c.name}を、みぎに かこう。てんを じゅんに タップしてね。`,
    hints: [
      'みほんの かどの てんを かぞえよう。',
      'よこに いくつ、たてに いくつ すすむか みほんで たしかめよう。',
    ],
    explain: `みほんと おなじ おおきさの ${c.name}が かけたね。`,
    identity: `copy:${c.id}`,
    task: {
      kind: 'draw',
      grid: { w: 7, h: 3 },
      given: [{ points: c.pts }],
      target: { kind: 'congruent', points: c.pts },
    },
    misconceptions: GEO_MIS,
  };
}

/** 別例: なまえだけで かく（見本なし） */
const DRAW: { id: string; name: string; shape: 'triangle' | 'square' | 'rectangle' }[] = [
  { id: 'triangle', name: 'さんかく', shape: 'triangle' },
  { id: 'square', name: 'ましかく', shape: 'square' },
  { id: 'rectangle', name: 'ながしかく', shape: 'rectangle' },
];
function drawItem(d: (typeof DRAW)[number]): GeometryItem {
  return {
    engine: 'geometry',
    id: `draw:${d.id}`,
    objective: 'copy',
    level: 0,
    alt: true,
    prompt: `${d.name}を かこう。てんを じゅんに タップして、さいごに はじめの てんに もどろう。`,
    hints: [
      d.shape === 'triangle' ? 'かどは 3つ だよ。' : 'かどは 4つ だよ。',
      d.shape === 'square'
        ? 'たても よこも おなじ ながさに しよう。'
        : d.shape === 'rectangle'
          ? 'たてより よこを ながく しよう。'
          : 'てんを 3つ えらんで つなごう。',
    ],
    explain: `${d.name}が かけたね。`,
    identity: `draw:${d.id}`,
    task: {
      kind: 'draw',
      grid: { w: 5, h: 3 },
      target: {
        kind: 'shape',
        shape: d.shape,
        ...(d.shape === 'rectangle' ? { exclusive: true } : {}),
      },
    },
    misconceptions: GEO_MIS,
  };
}

// ---- compose（形をあわせる） ----
const ST = 'stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"';
type Poly = [number, number][];
const poly = (p: Poly, fill: string) =>
  `<polygon points="${p.map((q) => q.join(',')).join(' ')}" fill="${fill}" ${ST}/>`;
const svgOf = (label: string, w: number, h: number, body: string): Figure => ({
  kind: 'svg',
  label,
  markup: `<svg viewBox="-4 -4 ${w + 8} ${h + 8}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`,
});
const halfCircle = (x: number, y: number, flip: boolean, fill: string) =>
  `<path d="M${x} ${y} A30 30 0 0 ${flip ? 0 : 1} ${x + 60} ${y} Z" fill="${fill}" ${ST}/>`;

/** できあがりの形（選択肢） */
const OUT: Record<string, { label: string; fig: Figure }> = {
  square: {
    label: 'しかく',
    fig: svgOf(
      'しかく',
      60,
      60,
      poly(
        [
          [0, 0],
          [60, 0],
          [60, 60],
          [0, 60],
        ],
        'var(--sky)',
      ),
    ),
  },
  bigsquare: {
    label: 'おおきな しかく',
    fig: svgOf(
      'おおきな しかく',
      80,
      80,
      poly(
        [
          [0, 0],
          [80, 0],
          [80, 80],
          [0, 80],
        ],
        'var(--sky)',
      ),
    ),
  },
  rect: {
    label: 'ながしかく',
    fig: svgOf(
      'ながしかく',
      100,
      50,
      poly(
        [
          [0, 0],
          [100, 0],
          [100, 50],
          [0, 50],
        ],
        'var(--sky)',
      ),
    ),
  },
  longrect: {
    label: 'ほそながい しかく',
    fig: svgOf(
      'ほそながい しかく',
      120,
      30,
      poly(
        [
          [0, 0],
          [120, 0],
          [120, 30],
          [0, 30],
        ],
        'var(--sky)',
      ),
    ),
  },
  bigtri: {
    label: 'おおきな さんかく',
    fig: svgOf(
      'おおきな さんかく',
      100,
      50,
      poly(
        [
          [0, 50],
          [50, 0],
          [100, 50],
        ],
        'var(--sky)',
      ),
    ),
  },
  circle: {
    label: 'まる',
    fig: svgOf(
      'まる',
      60,
      60,
      '<circle cx="30" cy="30" r="30" fill="var(--sky)" stroke="var(--ink)" stroke-width="3"/>',
    ),
  },
  house: {
    label: 'いえの かたち',
    fig: svgOf(
      'いえの かたち',
      60,
      90,
      poly(
        [
          [0, 30],
          [30, 0],
          [60, 30],
          [60, 90],
          [0, 90],
        ],
        'var(--sky)',
      ),
    ),
  },
  hexagon: {
    label: 'かどが 6つの かたち',
    fig: svgOf(
      'かどが 6つの かたち',
      70,
      60,
      poly(
        [
          [18, 0],
          [52, 0],
          [70, 30],
          [52, 60],
          [18, 60],
          [0, 30],
        ],
        'var(--sky)',
      ),
    ),
  },
  trapezoid: {
    label: 'うえが みじかい しかく',
    fig: svgOf(
      'うえが みじかい しかく',
      90,
      40,
      poly(
        [
          [22, 0],
          [68, 0],
          [90, 40],
          [0, 40],
        ],
        'var(--sky)',
      ),
    ),
  },
  triangle: {
    label: 'さんかく',
    fig: svgOf(
      'さんかく',
      60,
      52,
      poly(
        [
          [0, 52],
          [30, 0],
          [60, 52],
        ],
        'var(--sky)',
      ),
    ),
  },
};

/** あわせる まえの ピース（並べて 離して描く） */
const PIECES: Record<string, { label: string; svg: Figure }> = {
  tri2: {
    label: 'さんかく 2まい',
    svg: svgOf(
      'さんかく 2まい',
      130,
      50,
      poly(
        [
          [0, 0],
          [50, 50],
          [0, 50],
        ],
        'var(--sun)',
      ) +
        poly(
          [
            [80, 0],
            [130, 0],
            [130, 50],
          ],
          'var(--sun)',
        ),
    ),
  },
  sq2: {
    label: 'しかく 2まい',
    svg: svgOf(
      'しかく 2まい',
      130,
      50,
      poly(
        [
          [0, 0],
          [50, 0],
          [50, 50],
          [0, 50],
        ],
        'var(--sun)',
      ) +
        poly(
          [
            [80, 0],
            [130, 0],
            [130, 50],
            [80, 50],
          ],
          'var(--sun)',
        ),
    ),
  },
  sq4: {
    label: 'しかく 4まい',
    svg: svgOf(
      'しかく 4まい',
      190,
      40,
      [0, 50, 100, 150]
        .map((x) =>
          poly(
            [
              [x, 0],
              [x + 40, 0],
              [x + 40, 40],
              [x, 40],
            ],
            'var(--sun)',
          ),
        )
        .join(''),
    ),
  },
  half2: {
    label: 'はんぶんの まる 2まい',
    svg: svgOf(
      'はんぶんの まる 2まい',
      150,
      40,
      halfCircle(0, 32, false, 'var(--sun)') + halfCircle(90, 4, true, 'var(--sun)'),
    ),
  },
  rect2: {
    label: 'ながしかく 2まい',
    svg: svgOf(
      'ながしかく 2まい',
      140,
      60,
      poly(
        [
          [0, 0],
          [30, 0],
          [30, 60],
          [0, 60],
        ],
        'var(--sun)',
      ) +
        poly(
          [
            [60, 15],
            [120, 15],
            [120, 45],
            [60, 45],
          ],
          'var(--sun)',
        ),
    ),
  },
  sqtri: {
    label: 'しかくと さんかく',
    svg: svgOf(
      'しかくと さんかく',
      140,
      60,
      poly(
        [
          [0, 0],
          [60, 0],
          [60, 60],
          [0, 60],
        ],
        'var(--sun)',
      ) +
        poly(
          [
            [80, 60],
            [110, 30],
            [140, 60],
          ],
          'var(--sun)',
        ),
    ),
  },
  tri3: {
    label: 'さんかく 3まい',
    svg: svgOf(
      'さんかく 3まい',
      170,
      40,
      [0, 60, 120]
        .map((x) =>
          poly(
            [
              [x, 40],
              [x + 23, 0],
              [x + 46, 40],
            ],
            'var(--sun)',
          ),
        )
        .join(''),
    ),
  },
};

const COMPOSE: {
  id: string;
  pieces: string;
  right: string;
  wrong: [string, string];
  hint: string;
}[] = [
  {
    id: 'tri2-square',
    pieces: 'tri2',
    right: 'square',
    wrong: ['circle', 'longrect'],
    hint: 'ながい へんどうしを くっつけて みよう。',
  },
  {
    id: 'tri2-bigtri',
    pieces: 'tri2',
    right: 'bigtri',
    wrong: ['circle', 'hexagon'],
    hint: 'みじかい へんどうしを くっつけて みよう。',
  },
  {
    id: 'sq2-rect',
    pieces: 'sq2',
    right: 'rect',
    wrong: ['bigsquare', 'triangle'],
    hint: 'よこに ならべて みよう。',
  },
  {
    id: 'sq4-bigsquare',
    pieces: 'sq4',
    right: 'bigsquare',
    wrong: ['triangle', 'circle'],
    hint: '2まいずつ 2だんに かさねて みよう。',
  },
  {
    id: 'half2-circle',
    pieces: 'half2',
    right: 'circle',
    wrong: ['square', 'triangle'],
    hint: 'まっすぐな ところを くっつけて みよう。',
  },
  {
    id: 'rect2-square',
    pieces: 'rect2',
    right: 'square',
    wrong: ['circle', 'triangle'],
    hint: '2まいを となりに ならべて みよう。',
  },
  {
    id: 'sqtri-house',
    pieces: 'sqtri',
    right: 'house',
    wrong: ['circle', 'hexagon'],
    hint: 'さんかくを しかくの うえに のせて みよう。',
  },
  {
    id: 'tri3-trapezoid',
    pieces: 'tri3',
    right: 'trapezoid',
    wrong: ['circle', 'square'],
    hint: 'まんなかの さんかくを さかさに して みよう。',
  },
];

function composeItem(c: (typeof COMPOSE)[number]): Item {
  const p = PIECES[c.pieces]!;
  return choiceItem({
    id: `compose:${c.id}`,
    objective: 'compose',
    level: 1,
    prompt: `${p.label}を あわせると、どの かたちが できる？`,
    figure: p.svg,
    hints: ['あたまの なかで うごかして みよう。', c.hint],
    explain: `${p.label}で ${OUT[c.right]!.label}が できるね。`,
    identity: `compose:${c.id}`,
    correct: { label: OUT[c.right]!.label, figure: OUT[c.right]!.fig },
    wrong: c.wrong.map((w) => ({
      label: OUT[w]!.label,
      figure: OUT[w]!.fig,
      misconception: w === 'circle' ? 'curve-straight' : 'piece-count',
    })),
  });
}

/** 別例: できた形から、ピースを選ぶ */
const SPLIT: { id: string; shape: string; right: string; wrong: string[] }[] = [
  { id: 'square', shape: 'square', right: 'tri2', wrong: ['half2', 'tri3'] },
  { id: 'house', shape: 'house', right: 'sqtri', wrong: ['half2', 'sq4'] },
  { id: 'circle', shape: 'circle', right: 'half2', wrong: ['tri2', 'sq2'] },
];
function splitItem(s: (typeof SPLIT)[number]): Item {
  return choiceItem({
    id: `split:${s.id}`,
    objective: 'compose',
    level: 1,
    alt: true,
    prompt: `この ${OUT[s.shape]!.label}は、どの ピースで できる？`,
    figure: OUT[s.shape]!.fig,
    hints: [
      'かたちの へんが まっすぐか、まるいか みよう。',
      'ピースを あたまの なかで くっつけて みよう。',
    ],
    explain: `${PIECES[s.right]!.label}で できるね。`,
    identity: `split:${s.id}`,
    layout: 'column',
    correct: { label: PIECES[s.right]!.label, figure: PIECES[s.right]!.svg },
    wrong: s.wrong.map((w) => ({
      label: PIECES[w]!.label,
      figure: PIECES[w]!.svg,
      misconception: w === 'half2' || s.shape === 'circle' ? 'curve-straight' : 'piece-count',
    })),
  });
}

// ---- solid（つみきの形） ----
const OBJ = {
  ball: { illust: 'ball', name: 'ボール', kind: 'sphere' },
  mikan: { illust: 'mikan', name: 'みかん', kind: 'sphere' },
  watermelon: { illust: 'watermelon', name: 'すいか', kind: 'sphere' },
  box: { illust: 'p5-box', name: 'はこ', kind: 'box' },
  book: { illust: 'p5-book', name: 'えほん', kind: 'box' },
  can: { illust: 'p5-can', name: 'つつ', kind: 'cylinder' },
} as const;
type ObjKey = keyof typeof OBJ;
const Q = {
  roll: {
    text: 'どの むきでも ころころ ころがるのは どれ？',
    kind: 'sphere',
    hint: 'たいらな ところが ない かたちだよ。',
  },
  stack: {
    text: 'たかく つみあげやすいのは どれ？',
    kind: 'box',
    hint: 'うえも したも たいらな かたちだよ。',
  },
  can: {
    text: 'よこに すると ころがって、たてに すると たつのは どれ？',
    kind: 'cylinder',
    hint: 'まるい ところと たいらな ところが ある かたちだよ。',
  },
} as const;
const SOLID: [keyof typeof Q, ObjKey, ObjKey, ObjKey][] = [
  ['roll', 'ball', 'box', 'can'],
  ['roll', 'mikan', 'book', 'can'],
  ['roll', 'watermelon', 'box', 'book'],
  ['stack', 'box', 'ball', 'watermelon'],
  ['stack', 'book', 'ball', 'mikan'],
  // つつは たてに すれば つみあげられるので、「つみあげやすい」の誤答には 入れない
  ['stack', 'box', 'mikan', 'ball'],
  ['can', 'can', 'ball', 'box'],
  ['can', 'can', 'mikan', 'book'],
];
const solidMis = (q: keyof typeof Q, w: ObjKey) =>
  q === 'roll' && OBJ[w].kind === 'cylinder'
    ? 'roll-one-way'
    : q === 'stack' && OBJ[w].kind === 'cylinder'
      ? 'roll-one-way'
      : 'flat-round';

function solidItem([q, r, w1, w2]: (typeof SOLID)[number]): Item {
  const id = `solid:${q}:${r}:${w1}-${w2}`;
  return choiceItem({
    id,
    objective: 'solid',
    level: 2,
    prompt: Q[q].text,
    hints: ['おうちに ある ものを おもいだそう。', Q[q].hint],
    explain: `${OBJ[r].name}は ${Q[q].hint.replace('かたちだよ。', 'かたちだね。')}`,
    identity: id,
    correct: { label: OBJ[r].name, figure: ill(OBJ[r].illust) },
    wrong: [w1, w2].map((w) => ({
      label: OBJ[w].name,
      figure: ill(OBJ[w].illust),
      misconception: solidMis(q, w),
    })),
  });
}

/** 別例: ころがる／ころがらない に わける */
const ROLL_SORT: ObjKey[][] = [
  ['ball', 'box', 'mikan', 'book'],
  ['watermelon', 'book', 'ball', 'box'],
  ['mikan', 'box', 'watermelon', 'book'],
];
function rollSort(objs: ObjKey[], i: number): SortItem {
  const id = `roll-sort:${i}`;
  return {
    engine: 'sort',
    id,
    objective: 'solid',
    level: 2,
    alt: true,
    prompt: 'さかみちに おいたら ころがる？ ころがらない？ わけよう。',
    boxes: [
      { figure: ill('ball'), name: 'ころがる', label: 'ころがる' },
      { figure: ill('p5-box'), name: 'ころがらない', label: 'ころがらない' },
    ],
    cards: mix(id, objs).map((k) => {
      const box = OBJ[k].kind === 'sphere' ? 0 : 1;
      return {
        figure: ill(OBJ[k].illust),
        name: OBJ[k].name,
        box,
        wrongBoxes: [{ box: 1 - box, misconception: 'flat-round' }],
      };
    }),
    hints: ['まるい ところが あるか みよう。', 'たいらな ところで おくと とまるね。'],
    explain: 'まるい ものは ころがり、たいらな ところが ある ものは とまるね。',
    identity: id,
  };
}

function build(): Item[] {
  return [
    ...COPY.map(copyItem),
    ...DRAW.map(drawItem),
    ...COMPOSE.map(composeItem),
    ...SPLIT.map(splitItem),
    ...SOLID.map(solidItem),
    ...ROLL_SORT.map(rollSort),
  ];
}

export const shapesUnit: UnitSpec = {
  id: 'p5.math.shapes',
  title: 'かたち',
  stage: 'p5',
  subject: 'math',
  domain: 'play',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-shapes',
  prereq: ['p4.math.shapes'],
  objectives: [
    { id: 'copy', title: 'みほんを みて かたちを かく' },
    { id: 'compose', title: 'かたちを あわせる' },
    { id: 'solid', title: 'つみきの かたち（ころがる・つみあげる）' },
  ],
  misconceptions: [
    {
      id: 'size-diff',
      explain: 'かたちは にて いるけど、おおきさが ちがうね。かどから かどまで てんを かぞえよう。',
    },
    { id: 'other-shape', explain: 'ちがう かたちに なったね。かどの かずを みほんと くらべよう。' },
    { id: 'curve-straight', explain: 'まるい へんは、まっすぐな ピースでは つくれないよ。' },
    {
      id: 'piece-count',
      explain: 'ピースの かずや おおきさが あわないね。ひとつずつ ならべて みよう。',
    },
    { id: 'flat-round', explain: 'たいらな ところと まるい ところを よく みよう。' },
    { id: 'roll-one-way', explain: 'つつは よこに すると ころがるけど、たてに すると たつよ。' },
  ],
  levels: [
    { label: 'みほんを みて かく（K5）', chance: 0.05 },
    { label: 'かたちを あわせる', chance: 1 / 3 },
    { label: 'つみきの かたち', chance: 1 / 3 },
  ],
  intro: [
    { text: 'さんかくを 2まい あわせると、しかくが できるよ。', figure: PIECES.tri2!.svg },
    { text: 'ほら、しかく。', figure: OUT.square!.fig },
  ],
  source: { kind: 'items', items: build() },
  review: 'view',
  basis:
    '幼稚園教育要領解説（図形の特徴を生かして組み合わせる）、小学校学習指導要領 算数 第1学年 B へ接続、curriculum-matrix 3.3・4.1',
  gradeIsAppProposal: true,
  revised: '2026-10-24',
};
