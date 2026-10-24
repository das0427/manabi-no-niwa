/**
 * g2.prog.debug バグ探し: 動かない手順の まちがいを見つけて直す（curriculum-matrix 3.4、手引: 誤りを考えて修正）。
 *
 * 到達項目:
 *   one-card … 1まい まちがっている札を直す（program）。別例 = どの札が まちがいか選ぶ（choice）
 *   order    … 札の順番がちがう手順を直す（program）。別例 = どの2まいを入れかえるか選ぶ
 *   count    … くりかえしの回数がちがう手順を直す（program）。別例 = どの札が まちがいか選ぶ
 * 最初から並んでいる誤った列（initial）は、正しい手順から1か所だけ変えて作った（変えた場所は自動で求め、
 * 本当に ゴールに着かなくなることを検査する）。
 * 同一性キー: 問題の id。
 */
import type { ChoiceItem, Item, UnitSpec } from '../../curriculum/types';
import {
  baseUnit,
  BASE_MIS,
  cmdText,
  F,
  gridFigure,
  letterChoice,
  stripFigure,
  stripsColumn,
  L,
  layout,
  puzzle,
  R,
  reaches,
  rep,
  shortest,
  type Cmd,
  type Dir,
  type ProgMis,
} from './kit';

const MIS: ProgMis = {
  bump: 'bump',
  short: 'short',
  turn: 'turn',
  repeatCount: 'repeat-count',
};

type Kind = 'turn' | 'drop' | 'extra';

/** 正しい手順を1か所だけ変える */
function mutateOne(sol: Cmd[], kind: Kind, idx: number): { prog: Cmd[]; at: number } {
  const q = [...sol];
  if (kind === 'turn') {
    const c = q[idx]!;
    if (c.op !== 'turnRight' && c.op !== 'turnLeft') throw new Error('turn は まがる札に');
    q[idx] = c.op === 'turnRight' ? L : R;
    return { prog: q, at: idx };
  }
  if (kind === 'drop') {
    if (q[idx]!.op !== 'forward') throw new Error('drop は すすむ札に');
    q.splice(idx, 1);
    return { prog: q, at: idx };
  }
  q.splice(idx, 0, F);
  return { prog: q, at: idx };
}

// ---- one-card ----
type O = [id: string, level: number, dir: Dir, rows: string[], kind: Kind, idx: number];
const ONES: O[] = [
  ['o1', 0, 'right', ['S...', '...G'], 'turn', 3],
  ['o2', 0, 'down', ['S.', '..', '.G'], 'drop', 1],
  ['o3', 0, 'right', ['..G', '...', 'S..'], 'extra', 1],
  ['o4', 1, 'down', ['S#G', '...'], 'turn', 1],
  ['o5', 1, 'up', ['G..', '...', '..S'], 'drop', 3],
  ['o6', 1, 'up', ['.#G', 'S..'], 'extra', 2],
  ['o7', 2, 'right', ['S...#', '.##.G'], 'turn', 5],
  ['o8', 2, 'right', ['G..', '##.', 'S..'], 'drop', 4],
];

const HINT_ONE: Record<Kind, [string, string, string]> = {
  turn: [
    'うごかして、キャラクターが どこで ゴールから はなれるか みよう。',
    'まがる ふだを ひとつずつ みよう。みぎと ひだりは あっているかな。',
    'ゴールへ ちかづく ほうに むいて いるか、まがる ふだの まえと あとで たしかめよう。',
  ],
  drop: [
    'うごかして、キャラクターが どこで とまるか みよう。',
    'ゴールまで マスが あと いくつ のこっているか かぞえよう。',
    'すすむ ふだが たりないよ。どの ならびに あと ひとつ ふやすと いいかな。',
  ],
  extra: [
    'うごかして、キャラクターが どこで ぶつかるか みよう。',
    'ゴールを すぎて すすんで いないかな。',
    'すすむ ふだが ひとつ おおいよ。どの ならびから ひとつ へらすと いいかな。',
  ],
};
const WHY_ONE: Record<Kind, string> = {
  turn: 'みぎと ひだりを まちがえて いたよ。まがる ふだを なおすと ゴールに つくね。',
  drop: 'すすむ ふだが ひとつ たりなかったよ。ふだを ふやすと ゴールに つくね。',
  extra: 'すすむ ふだが ひとつ おおかったよ。ふだを へらすと ゴールに つくね。',
};
const LEAD = 'ゴールに つかないよ。なおして いこう。';

function debugPuzzle(
  id: string,
  obj: string,
  level: number,
  rows: string[],
  dir: Dir,
  sol: Cmd[],
  initial: Cmd[],
  hints: [string, string, string],
  why: string,
  times?: number[],
) {
  const l = layout(rows, dir);
  if (!reaches(l, sol)) throw new Error(`${id}: 正しい手順がゴールに着かない`);
  if (reaches(l, initial)) throw new Error(`${id}: 誤った列が正しく動いてしまう`);
  return puzzle({
    id,
    obj,
    level,
    rows,
    dir,
    solution: sol,
    initial,
    palette: times ? ['forward', 'turnRight', 'turnLeft', 'repeat'] : undefined,
    repeatTimes: times,
    lead: LEAD,
    hints,
    why,
    mis: MIS,
  });
}

const oneItems = ONES.map(([id, level, dir, rows, kind, idx]) => {
  const l = layout(rows, dir);
  const sol = shortest(l)!;
  const { prog } = mutateOne(sol, kind, idx);
  return debugPuzzle(`one-${id}`, 'one-card', level, rows, dir, sol, prog, HINT_ONE[kind], WHY_ONE[kind]);
});

// ---- order ----
type D = [id: string, level: number, dir: Dir, rows: string[], swapAt: number];
const ORDERS: D[] = [
  ['d1', 0, 'right', ['S..', '..G'], 2],
  ['d2', 1, 'down', ['S#G', '...'], 0],
  ['d3', 1, 'right', ['..G', '...', 'S..'], 1],
  ['d4', 2, 'up', ['.#G', 'S..'], 0],
  ['d5', 2, 'right', ['S...#', '.##.G'], 2],
  ['d6', 2, 'right', ['G..', '##.', 'S..'], 1],
  ['d7', 2, 'up', ['G..', '...', '..S'], 1],
];
const orderItems = ORDERS.map(([id, level, dir, rows, at]) => {
  const l = layout(rows, dir);
  const sol = shortest(l)!;
  // となりあう違う札を入れかえる（at 以降で最初の組）
  let i = at;
  while (i + 1 < sol.length && sol[i]!.op === sol[i + 1]!.op) i++;
  const q = [...sol];
  [q[i], q[i + 1]] = [q[i + 1]!, q[i]!];
  return debugPuzzle(
    `order-${id}`,
    'order',
    level,
    rows,
    dir,
    sol,
    q,
    [
      'うごかして、キャラクターが どこで ゴールから はなれるか みよう。',
      'ふだの ならんでいる じゅんばんを、さいしょから ゆびで たどって みよう。',
      'まがる ふだが はやすぎたり おそすぎたり しないかな。となりどうしの ふだを いれかえて みよう。',
    ],
    'ふだの じゅんばんが ちがっていたよ。となりあう ふだを いれかえると ゴールに つくね。',
  );
});

// ---- count ----
const T7 = [2, 3, 4, 5, 6, 7];
function stairs(n: number) {
  const body: Cmd[] = [F, R, F, L];
  const rows: string[] = [];
  const w = n + 1;
  for (let y = 0; y < w; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      const onPath = (y === x && x <= n) || (y === x - 1 && x >= 1);
      row += x === 0 && y === 0 ? 'S' : x === n && y === n ? 'G' : onPath ? '.' : '#';
    }
    rows.push(row);
  }
  return { rows, body };
}
interface Cn {
  id: string;
  level: number;
  dir: Dir;
  rows: string[];
  sol: Cmd[];
  bad: Cmd[];
}
const s4 = stairs(4);
const s3 = stairs(3);
const COUNTS: Cn[] = [
  { id: 'c1', level: 1, dir: 'right', rows: ['S....G'], sol: [rep(5, F)], bad: [rep(4, F)] },
  { id: 'c2', level: 1, dir: 'down', rows: ['S.', '..', '..', 'G.'], sol: [rep(3, F)], bad: [rep(2, F)] },
  { id: 'c3', level: 2, dir: 'right', rows: ['S....', '....G'], sol: [rep(4, F), R, F], bad: [rep(3, F), R, F] },
  { id: 'c4', level: 2, dir: 'right', rows: s3.rows, sol: [rep(3, ...s3.body)], bad: [rep(2, ...s3.body)] },
  { id: 'c5', level: 2, dir: 'right', rows: s4.rows, sol: [rep(4, ...s4.body)], bad: [rep(3, ...s4.body)] },
  { id: 'c6', level: 2, dir: 'left', rows: ['G.....S'], sol: [rep(6, F)], bad: [rep(5, F)] },
  {
    id: 'c7',
    level: 2,
    dir: 'up',
    rows: ['....G', '.....', 'S....'],
    sol: [rep(2, F), R, rep(4, F)],
    bad: [rep(2, F), R, rep(3, F)],
  },
];
const countItems = COUNTS.map((q) =>
  debugPuzzle(
    `count-${q.id}`,
    'count',
    q.level,
    q.rows,
    q.dir,
    q.sol,
    q.bad,
    [
      'うごかして、キャラクターが ゴールの てまえで とまるか、すぎるか みよう。',
      '「くりかえす」の ふだの みぎの ちいさな ふだを おすと、かいすうが かわるよ。',
      'ゴールまで マスを かぞえて、「くりかえす」の かいすうと くらべよう。',
    ],
    'くりかえす かいすうが ちがっていたよ。マスの かずを かぞえて かいすうを なおすと ゴールに つくね。',
    T7,
  ),
);

// ---- alt: どの札がまちがいか選ぶ ----
// 札の列を番号つきの絵で見せ、「1ばんめ」「2ばんめ」…のボタンから選ぶ（地図は小さく添える）。
function spotItem(opt: {
  id: string;
  obj: string;
  level: number;
  rows: string[];
  dir: Dir;
  bad: Cmd[];
  good: Cmd[];
  /** 正解の番号（0 始まり） */
  at: number;
  /** order: 入れかえる2まいの組 */
  pair?: boolean;
}): ChoiceItem {
  const l = layout(opt.rows, opt.dir);
  const n = opt.bad.length;
  const label = (i: number) => (opt.pair ? `${i + 1}と${i + 2}` : `${i + 1}ばんめ`);
  const max = opt.pair ? n - 1 : n;
  const picks = [opt.at];
  for (const d of [1, -1, 2, -2, 3, -3]) {
    const j = opt.at + d;
    if (j >= 0 && j < max && !picks.includes(j) && picks.length < 3) picks.push(j);
  }
  if (picks.length < 3) throw new Error(`${opt.id}: 選択肢が足りない`);
  picks.sort((a, b) => a - b);
  return letterChoice({
    id: opt.id,
    obj: opt.obj,
    level: opt.level,
    alt: true,
    prompt: opt.pair
      ? 'ロボットが ゴールに つかないよ。どの ふだを いれかえると なおるかな。'
      : 'ロボットが ゴールに つかないよ。まちがって いる ふだは どれかな。',
    figure: stripsColumn(
      [
        gridFigure(l, { label: 'ますの ず。ほしが ゴール', hU: 5.5 }),
        stripFigure(opt.bad, { label: `うまく いかない てじゅん: ${cmdText(opt.bad)}`, hU: 5, numbered: true }),
      ],
      0.8,
    ),
    letters: picks.map(label),
    correct: picks.indexOf(opt.at),
    mis: picks.map(() => 'wrong-spot'),
    hints: [
      'ふだを さいしょから じゅんに ゆびで たどって、ゴールと くらべよう。',
      'キャラクターが ゴールから はなれはじめるのは、どの ふだの あとかな。',
      'まがる ふだの むきや、ふだの かず、じゅんばんを たしかめよう。',
    ],
    explain: `まちがいは ${label(opt.at)}だったよ。ただしい てじゅんは「${cmdText(opt.good)}」。うごかして ゴールと くらべると、まちがいが みつかるよ。`,
  });
}
function altOne(id: string, level: number, rows: string[], dir: Dir, kind: Kind, idx: number) {
  const l = layout(rows, dir);
  const good = shortest(l)!;
  const { prog, at } = mutateOne(good, kind, idx);
  if (reaches(l, prog)) throw new Error(`${id}: 誤った列が動いてしまう`);
  // drop は「ふだが たりない」ので、足りない場所のとなりの札を答えにする
  return spotItem({ id, obj: 'one-card', level, rows, dir, bad: prog, good, at: Math.min(at, prog.length - 1) });
}
const altOnes = [
  altOne('one-alt-a1', 0, ['S..', '..G'], 'right', 'turn', 2),
  altOne('one-alt-a2', 0, ['S.', '..', '.G'], 'down', 'turn', 2),
  altOne('one-alt-a3', 1, ['..G', '...', 'S..'], 'right', 'turn', 2),
];

function altOrder(id: string, level: number, rows: string[], dir: Dir, from: number) {
  const l = layout(rows, dir);
  const good = shortest(l)!;
  let i = from;
  while (i + 1 < good.length && good[i]!.op === good[i + 1]!.op) i++;
  const bad = [...good];
  [bad[i], bad[i + 1]] = [bad[i + 1]!, bad[i]!];
  if (reaches(l, bad)) throw new Error(`${id}: 入れかえても動いてしまう`);
  return spotItem({ id, obj: 'order', level, rows, dir, bad, good, at: i, pair: true });
}
const altOrders = [
  altOrder('order-alt-a1', 1, ['S..', '..G'], 'right', 1),
  altOrder('order-alt-a2', 1, ['S#G', '...'], 'down', 1),
  altOrder('order-alt-a3', 2, ['S...#', '.##.G'], 'right', 3),
];

function altCount(id: string, level: number, rows: string[], dir: Dir, good: Cmd[], bad: Cmd[], at: number) {
  const l = layout(rows, dir);
  if (!reaches(l, good) || reaches(l, bad)) throw new Error(`${id}: 手順の正誤が合わない`);
  return spotItem({ id, obj: 'count', level, rows, dir, bad, good, at });
}
const altCounts = [
  altCount('count-alt-a1', 1, ['S....', '....G'], 'right', [rep(4, F), R, F], [rep(3, F), R, F], 0),
  altCount(
    'count-alt-a2',
    2,
    ['....G', '.....', 'S....'],
    'up',
    [rep(2, F), R, rep(4, F)],
    [rep(2, F), R, rep(3, F)],
    2,
  ),
  altCount(
    'count-alt-a3',
    2,
    ['S...', '###.', '###G'],
    'right',
    [rep(3, F), R, rep(2, F)],
    [rep(2, F), R, rep(2, F)],
    0,
  ),
];

const items: Item[] = [
  ...oneItems,
  ...altOnes,
  ...orderItems,
  ...altOrders,
  ...countItems,
  ...altCounts,
];

export const debug: UnitSpec = {
  ...baseUnit('g2.prog.debug', 'g2'),
  title: 'まちがいを なおそう',
  prereq: ['g1.prog.sequence'],
  objectives: [
    { id: 'one-card', title: 'ひとつ まちがっている ふだを みつけて なおす' },
    { id: 'order', title: 'ふだの じゅんばんの まちがいを なおす' },
    { id: 'count', title: '「くりかえす」の かいすうの まちがいを なおす' },
  ],
  misconceptions: [
    ...BASE_MIS,
    {
      id: 'repeat-count',
      explain:
        'くりかえす かいすうを かぞえまちがえたのかな。ゴールまで マスを かぞえて、かいすうを なおそう。',
    },
    {
      id: 'wrong-spot',
      explain:
        'べつの ふだが まちがいだと おもったのかな。うごかして、ゴールから はなれはじめる ところを さがしてみよう。',
    },
  ],
  levels: [
    { label: 'ひとつ ちがう', chance: 0.1 },
    { label: 'じゅんばんと かいすう', chance: 0.1 },
    { label: 'ながい てじゅん', chance: 0.1 },
  ],
  intro: [
    {
      text: 'プログラムが うまく うごかない ことを「バグ」と いうよ。バグは だれにでも あるよ。',
    },
    {
      text: 'うごかして みると、どこで まちがえたか みつかるよ。キャラクターが ゴールから はなれはじめる ところを さがそう。',
      figure: { kind: 'text', text: 'うごかす → みる → なおす', size: 'l' },
    },
    {
      text: 'みぎと ひだりの まちがい、ふだの たりない・おおい、じゅんばん、くりかえす かいすう。まちがいには いろいろな しゅるいが あるよ。',
    },
  ],
  source: { kind: 'items', items },
  basis:
    '小学校学習指導要領（平成29年告示）総則 第3の1(3)イ、小学校プログラミング教育の手引（第三版）プログラミング的思考（誤りを考え、修正する）。学年の割当は本アプリの案',
  gradeIsAppProposal: true,
};


