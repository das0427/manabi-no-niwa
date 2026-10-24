/**
 * g2.prog.repeat くりかえし: 同じ動きをまとめる（curriculum-matrix 3.4、手引: 反復）。
 *
 * 到達項目:
 *   find    … 長い手順の中の「くりかえし」を見つけて、短い手順に言いかえる（choice）。別例 = ふだの数を数える（number）
 *   line    … 同じ札が続くところを「n かい くりかえす」にして、札の数を減らして動かす（program）。別例 = どこに着くか選ぶ
 *   pattern … いくつかの札の組を くりかえす（かいだん・ジグザグ）（program）。別例 = くりかえす中身を選ぶ
 * 同一性キー: 問題の id。札の数の上限（maxCards）で、くりかえしを使わないと解けないようにした。
 * 模様をかく問題は program エンジンにかく機能がないため作っていない（道をたどる形で代えた）。
 */
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import {
  baseUnit,
  BASE_MIS,
  cardCount,
  cmdText,
  F,
  flat,
  gridFigure,
  landingItem,
  layout,
  L,
  puzzle,
  R,
  rep,
  reaches,
  shortest,
  stripChoice,
  stripFigure,
  type Cmd,
  type Dir,
  type ProgMis,
} from './kit';

const MIS: ProgMis = {
  bump: 'bump',
  short: 'short',
  turn: 'turn',
  repeatCount: 'repeat-count',
  tooMany: 'too-many',
};

// ---- find: 同じ動きの短い手順を選ぶ ----
interface Fd {
  id: string;
  level: number;
  long: Cmd[];
  right: Cmd[];
  wrongs: [Cmd[], string][];
  hint3: string;
}
const FINDS: Fd[] = [
  {
    id: 'f1',
    level: 0,
    long: [F, F, F],
    right: [rep(3, F)],
    wrongs: [
      [[rep(2, F)], 'repeat-count'],
      [[rep(3, R)], 'repeat-body'],
    ],
    hint3: '「すすむ」が なんかい つづいて いるか かぞえよう。',
  },
  {
    id: 'f2',
    level: 0,
    long: [F, F, F, F],
    right: [rep(4, F)],
    wrongs: [
      [[rep(3, F)], 'repeat-count'],
      [[rep(4, L)], 'repeat-body'],
    ],
    hint3: '「すすむ」が ぜんぶで なんこ ならんでいるかな。',
  },
  {
    id: 'f3',
    level: 0,
    long: [F, R, F, R],
    right: [rep(2, F, R)],
    wrongs: [
      [[rep(2, F)], 'repeat-body'],
      [[rep(3, F, R)], 'repeat-count'],
    ],
    hint3: '「すすむ、みぎを むく」の ならびが なんかい でてくるかな。',
  },
  {
    id: 'f4',
    level: 1,
    long: [F, F, R, F, F, R],
    right: [rep(2, F, F, R)],
    wrongs: [
      [[rep(2, F, R)], 'repeat-body'],
      [[rep(3, F, F, R)], 'repeat-count'],
    ],
    hint3: 'おなじ ならびが ふたつ ならんでいるよ。ならびの なかには ふだが いくつ あるかな。',
  },
  {
    id: 'f5',
    level: 1,
    long: [L, F, L, F, L, F],
    right: [rep(3, L, F)],
    wrongs: [
      [[rep(3, F, L)], 'repeat-body'],
      [[rep(2, L, F)], 'repeat-count'],
    ],
    hint3: 'さいしょの ふだは「ひだりを むく」だよ。つぎの ふだと ふたつで ひとくみ。',
  },
  {
    id: 'f6',
    level: 2,
    long: [F, F, F, F, F],
    right: [rep(5, F)],
    wrongs: [
      [[rep(4, F)], 'repeat-count'],
      [[rep(5, L)], 'repeat-body'],
    ],
    hint3: '「すすむ」を ひとつずつ かぞえて みよう。',
  },
];
const findItems: ChoiceItem[] = FINDS.map((q) => {
  const long = flat(q.long);
  if (flat(q.right).join() !== long.join()) throw new Error(`${q.id}: 正解が同じ動きでない`);
  for (const [w] of q.wrongs)
    if (flat(w).join() === long.join()) throw new Error(`${q.id}: 誤りが同じ動き`);
  return stripChoice({
    id: `find-${q.id}`,
    obj: 'find',
    level: q.level,
    prompt: 'うえの てじゅんと おなじ うごきに なるのは どれかな。',
    given: q.long,
    right: q.right,
    wrongs: q.wrongs,
    hints: [
      'おなじ ふだが つづいて いるところや、おなじ ならびが でてくる ところを さがそう。',
      '「くりかえす」の ふだは、なかの ふだを なんかい うごかすかを きめる ふだだよ。',
      q.hint3,
    ],
    explain: `「${cmdText(q.long)}」は「${cmdText(q.right)}」と おなじ うごきだよ。おなじ ならびは「くりかえす」で まとめられるよ。`,
  });
});

// 別例: 「すすむ」の数を数える
interface Cn {
  id: string;
  level: number;
  prog: Cmd[];
  total: number;
  inBody: number;
  times: number;
}
const COUNTS: Cn[] = [
  { id: 'n1', level: 0, prog: [rep(3, F, F)], total: 6, inBody: 2, times: 3 },
  { id: 'n2', level: 1, prog: [rep(3, F, R, F)], total: 6, inBody: 2, times: 3 },
  { id: 'n3', level: 2, prog: [rep(4, F, R, F)], total: 8, inBody: 2, times: 4 },
];
const countItems: NumberItem[] = COUNTS.map((c) => {
  const flatForward = flat(c.prog).filter((o) => o === 'forward').length;
  if (flatForward !== c.total) throw new Error(`${c.id}: すすむ の数が合わない`);
  return {
    engine: 'number',
    id: `find-alt-${c.id}`,
    objective: 'find',
    level: c.level,
    alt: true,
    prompt: 'この てじゅんで「すすむ」は ぜんぶで なんかい うごくかな。',
    figure: stripFigure(c.prog, { label: `てじゅん: ${cmdText(c.prog)}`, hU: 6 }),
    fields: [{ label: 'かい', answer: { kind: 'int', value: c.total } }],
    wrongAnswers: [
      { value: String(c.inBody), misconception: 'forget-repeat' },
      { value: String(c.times), misconception: 'forget-body' },
    ],
    hints: [
      '「くりかえす」の なかに ある ふだを みよう。',
      `なかの「すすむ」は ${c.inBody}まい。それを なんかい くりかえすかな。`,
      `${c.times}かい くりかえすから、なかの うごきが ${c.times}かい あるよ。かけざんを つかおう。`,
    ],
    explain: `なかに「すすむ」が ${c.inBody}まい あって、${c.times}かい くりかえすから、${c.inBody} × ${c.times} ＝ ${c.total}。ぜんぶで ${c.total}かい うごくよ。`,
    identity: `find-alt-${c.id}`,
  };
});

// ---- line: 同じ札が続くところをまとめる ----
interface Ln {
  id: string;
  level: number;
  dir: Dir;
  rows: string[];
  sol: Cmd[];
  times: number[];
}
const T6 = [2, 3, 4, 5, 6];
const LINES: Ln[] = [
  { id: 'l1', level: 0, dir: 'right', rows: ['S.....G'], sol: [rep(6, F)], times: T6 },
  { id: 'l2', level: 0, dir: 'down', rows: ['S.', '..', '..', '..', 'G.'], sol: [rep(4, F)], times: T6 },
  { id: 'l3', level: 0, dir: 'left', rows: ['G.....S'], sol: [rep(6, F)], times: T6 },
  { id: 'l4', level: 1, dir: 'right', rows: ['S....', '....G'], sol: [rep(4, F), R, F], times: T6 },
  { id: 'l5', level: 1, dir: 'down', rows: ['S.', '..', '..', '.G'], sol: [rep(3, F), L, F], times: T6 },
  { id: 'l6', level: 1, dir: 'up', rows: ['....G', '.....', 'S....'], sol: [rep(2, F), R, rep(4, F)], times: T6 },
  { id: 'l7', level: 2, dir: 'right', rows: ['S...', '###.', 'G...'], sol: [rep(3, F), R, rep(2, F), R, rep(3, F)], times: T6 },
  { id: 'l8', level: 2, dir: 'right', rows: ['S...', '###.', '###G'], sol: [rep(3, F), R, rep(2, F)], times: T6 },
];

function repeatHints(sol: Cmd[], maxCards: number): [string, string, string] {
  const first = sol.find((c) => c.op === 'repeat');
  return [
    'おなじ ふだが つづく ところや、おなじ ならびが でてくる ところを さがそう。',
    `ふだは ${maxCards}まい いかだよ。「くりかえす」の ふだも ふだ 1まいと かぞえるよ。`,
    first && first.op === 'repeat'
      ? `はじめの かたまりは「${cmdText(first.body)}」を くりかえすよ。なんかい くりかえすかは かぞえてみよう。`
      : 'ふだを ならべたら「うごかす」を おして たしかめよう。',
  ];
}

function repeatPuzzle(
  id: string,
  obj: string,
  level: number,
  rows: string[],
  dir: Dir,
  sol: Cmd[],
  times: number[],
  why: string,
) {
  const l = layout(rows, dir);
  const raw = shortest(l)!;
  const maxCards = Math.min(cardCount(sol) + (cardCount(sol) >= 5 ? 0 : 1), raw.length - 1);
  if (raw.length <= maxCards || maxCards < cardCount(sol)) throw new Error(`${id}: くりかえしを使わなくても解ける（${raw.length} ≦ ${maxCards}）`);
  if (!reaches(l, sol)) throw new Error(`${id}: 正答の例がゴールに着かない`);
  return puzzle({
    id,
    obj,
    level,
    rows,
    dir,
    solution: sol,
    palette: ['forward', 'turnRight', 'turnLeft', 'repeat'],
    repeatTimes: times,
    maxCards,
    hints: repeatHints(sol, maxCards),
    why,
    mis: MIS,
  });
}

const lineItems = LINES.map((q) =>
  repeatPuzzle(
    `line-${q.id}`,
    'line',
    q.level,
    q.rows,
    q.dir,
    q.sol,
    q.times,
    'おなじ ふだが つづく ところは「くりかえす」で まとめると、ふだが すくなく なるよ。',
  ),
);

// 別例: くりかえしを使った手順でどこに着くか
const lineLandings = [
  landingItem({
    id: 'line-alt-ln1',
    obj: 'line',
    level: 0,
    alt: true,
    rows: ['.......', 'S......', '.......'],
    dir: 'right',
    prog: [rep(3, F), R, F],
    mis: { turn: 'turn', short: 'short', count: 'repeat-count' },
  }),
  landingItem({
    id: 'line-alt-ln2',
    obj: 'line',
    level: 1,
    alt: true,
    rows: ['.....', '.....', '.....', '.....', 'S....'],
    dir: 'up',
    prog: [rep(2, F), R, rep(2, F)],
    mis: { turn: 'turn', short: 'short', count: 'repeat-count' },
  }),
  landingItem({
    id: 'line-alt-ln3',
    obj: 'line',
    level: 2,
    alt: true,
    rows: ['......', '......', '......', 'S.....'],
    dir: 'right',
    prog: [rep(2, F), L, rep(2, F), R, F],
    mis: { turn: 'turn', short: 'short', count: 'repeat-count' },
  }),
];

// ---- pattern: かいだん・ジグザグ（札の組をくりかえす） ----
/** かいだんの道。a マス進んで b マス下がる、を n 回。flipV: 下から上へ、flipH: 右から左へ */
export function stair(n: number, a: number, b: number, flipV = false, flipH = false) {
  const path: [number, number][] = [[0, 0]];
  let x = 0;
  let y = 0;
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < a; i++) path.push([++x, y]);
    for (let j = 0; j < b; j++) path.push([x, ++y]);
  }
  const w = x + 1;
  const h = y + 1;
  let rows: string[] = [];
  for (let yy = 0; yy < h; yy++) {
    let row = '';
    for (let xx = 0; xx < w; xx++) {
      const onPath = path.some((p) => p[0] === xx && p[1] === yy);
      row += xx === 0 && yy === 0 ? 'S' : xx === x && yy === y ? 'G' : onPath ? '.' : '#';
    }
    rows.push(row);
  }
  if (flipV) rows = rows.reverse();
  if (flipH) rows = rows.map((r) => [...r].reverse().join(''));
  const turnFirst = flipV !== flipH ? L : R;
  const turnBack = flipV !== flipH ? R : L;
  const body: Cmd[] = [...Array<Cmd>(a).fill(F), turnFirst, ...Array<Cmd>(b).fill(F), turnBack];
  return { rows, dir: (flipH ? 'left' : 'right') as Dir, sol: [rep(n, ...body)], body, n };
}
interface Pt {
  id: string;
  level: number;
  n: number;
  a: number;
  b: number;
  flipV?: boolean;
  flipH?: boolean;
}
const PATTERNS: Pt[] = [
  { id: 'p1', level: 1, n: 2, a: 1, b: 1 },
  { id: 'p2', level: 1, n: 3, a: 1, b: 1 },
  { id: 'p3', level: 1, n: 3, a: 1, b: 1, flipV: true },
  { id: 'p4', level: 2, n: 3, a: 1, b: 1, flipH: true },
  { id: 'p5', level: 2, n: 4, a: 1, b: 1 },
  { id: 'p6', level: 2, n: 2, a: 2, b: 1 },
  { id: 'p7', level: 2, n: 2, a: 1, b: 2, flipV: true },
  { id: 'p8', level: 2, n: 2, a: 2, b: 2 },
];
const patternItems = PATTERNS.map((q) => {
  const s = stair(q.n, q.a, q.b, q.flipV, q.flipH);
  return repeatPuzzle(
    `pattern-${q.id}`,
    'pattern',
    q.level,
    s.rows,
    s.dir,
    s.sol,
    [2, 3, 4, 5],
    'ひとくみの ふだを「くりかえす」の なかに いれると、かいだんも すこしの ふだで のぼれるよ。',
  );
});

/** 同じ値の誤答例が2つ以上あるときは、先のものだけ残す */
const uniq = <T extends { value: string }>(xs: T[]): T[] => xs.filter((x, i) => xs.findIndex((y) => y.value === x.value) === i);

// 別例: くりかえす中身のふだの数をこたえる
interface Bc {
  id: string;
  level: number;
  n: number;
  a: number;
  b: number;
  flipV?: boolean;
  flipH?: boolean;
}
const BODIES: Bc[] = [
  { id: 'b1', level: 1, n: 3, a: 1, b: 1 },
  { id: 'b2', level: 2, n: 2, a: 2, b: 1, flipV: true },
  { id: 'b3', level: 2, n: 3, a: 1, b: 1, flipH: true },
];
const bodyItems: NumberItem[] = BODIES.map((q) => {
  const s = stair(q.n, q.a, q.b, q.flipV, q.flipH);
  const l = layout(s.rows, s.dir);
  const len = s.body.length;
  return {
    engine: 'number',
    id: `pattern-alt-${q.id}`,
    objective: 'pattern',
    level: q.level,
    alt: true,
    prompt: `かいだんを のぼる てじゅんを つくるよ。「くりかえす ${q.n}かい」の なかには、ふだが なんまい はいるかな。`,
    figure: gridFigure(l, { label: 'ますの ず。かいだんの ような みち。ほしが ゴール', hU: 10 }),
    fields: [{ label: 'まい', answer: { kind: 'int', value: len } }],
    wrongAnswers: uniq([
      { value: String(q.n), misconception: 'repeat-count' },
      { value: String(len - 1), misconception: 'repeat-body' },
      { value: String(len + 1), misconception: 'repeat-body' },
      { value: String(len * q.n), misconception: 'forget-body' },
    ]).filter((w) => w.value !== String(len)),
    hints: [
      'かいだんの ひとだんを のぼる ふだを かんがえよう。',
      'みちは「すすんで、まがって、すすんで、もとの むきに もどる」の くりかえしだよ。',
      'ひとだん ぶんの ふだの 数《かず》を かぞえよう。すすむ・まがる・すすむ・まがる、のように。',
    ],
    explain: `ひとだんを のぼる ふだは「${cmdText(s.body)}」の ${len}まい。これを ${q.n}かい くりかえすと、かいだんを のぼれるよ。`,
    identity: `pattern-alt-${q.id}`,
  };
});
const items: Item[] = [
  ...findItems,
  ...countItems,
  ...lineItems,
  ...lineLandings,
  ...patternItems,
  ...bodyItems,
];

export const repeat: UnitSpec = {
  ...baseUnit('g2.prog.repeat', 'g2'),
  title: 'くりかえし',
  prereq: ['g1.prog.sequence'],
  objectives: [
    { id: 'find', title: 'おなじ ならびを みつけて「くりかえす」で あらわす' },
    { id: 'line', title: '「くりかえす」で ふだを へらして うごかす' },
    { id: 'pattern', title: 'いくつかの ふだの ひとくみを くりかえす' },
  ],
  misconceptions: [
    ...BASE_MIS,
    {
      id: 'repeat-count',
      explain:
        'くりかえす かいすうを かぞえまちがえたのかな。うごかしてみて、ゴールの てまえか、ゴールを すぎたかを みて かいすうを なおそう。',
    },
    {
      id: 'repeat-body',
      explain:
        '「くりかえす」の なかの ふだが ちがったのかな。くりかえす ひとまとまりを もういちど よく みよう。',
    },
    {
      id: 'forget-repeat',
      explain:
        'なかの ふだの かずだけ かぞえたのかな。「くりかえす」は、なかの うごきを なんかいも するよ。かいすうを かけよう。',
    },
    {
      id: 'forget-body',
      explain:
        'くりかえす かいすうだけ かぞえたのかな。なかに ふだが いくつ あるかも みて、かけざんを しよう。',
    },
    {
      id: 'too-many',
      explain:
        'ふだが おおすぎたのかな。おなじ ふだが つづく ところを「くりかえす」に すると、ふだが へるよ。',
    },
  ],
  levels: [
    { label: 'まっすぐを まとめる', chance: 0.1 },
    { label: 'まがる みちを まとめる', chance: 0.1 },
    { label: 'ひとくみを くりかえす', chance: 0.1 },
  ],
  intro: [
    {
      text: '「すすむ」を 3かい ならべる かわりに、「くりかえす 3かい」の なかに「すすむ」を いれても おなじだよ。',
      figure: { kind: 'text', text: 'すすむ、すすむ、すすむ ＝ くりかえす 3かい（すすむ）', size: 'l' },
    },
    {
      text: 'ふたつ いじょうの ふだの ひとくみも くりかえせるよ。',
      figure: {
        kind: 'text',
        text: 'すすむ、みぎを むく、すすむ、みぎを むく ＝ くりかえす 2かい（すすむ、みぎを むく）',
        size: 'm',
      },
    },
    {
      text: 'ふだの かずが きまっている ときは、くりかえしを つかうと すくない ふだで いけるよ。',
    },
  ],
  source: { kind: 'items', items },
  basis:
    '小学校学習指導要領（平成29年告示）総則 第3の1(3)イ、小学校プログラミング教育の手引（第三版）プログラミング的思考（反復）。学年の割当は本アプリの案',
  gradeIsAppProposal: true,
};
