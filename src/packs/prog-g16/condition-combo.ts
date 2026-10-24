/**
 * g3.prog.condition-combo 条件と繰り返しの組み合わせ（curriculum-matrix 3.5、手引: 順序・分岐・繰り返し）。
 *
 * 決まり: 「ずっと くりかえす: もし まえが かべなら みぎ（ひだり）を むく、すすむ」
 *   札の数の上限（4まい）で、この決まりを使わないと解けない地図にした（うずまきの道・行き止まりの出っぱり付き）。
 *
 * 到達項目:
 *   wall-turn … 「かべなら まがる」を くりかえしの中で使う（program）。別例 = ゴールに着く手順を選ぶ（choice）
 *   loop-if   … くりかえしの中の「もし」の まちがいを直す（program: 条件・むき・かいすう・すすむ札）。別例 = どこに着くか選ぶ
 *   maze      … 大きな迷路を ひとつの手順で ぬける（program）。別例 = どこに着くか選ぶ
 * 同一性キー: 問題の id。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import {
  addDecoys,
  baseUnit,
  BASE_MIS,
  choiceItem,
  F,
  gridFigure,
  iff,
  landingItem,
  L,
  layout,
  mirrorH,
  puzzle,
  R,
  rep,
  spiral,
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

const TURN = { R, L };
/** ずっと くりかえす: もし まえが かべなら (むき) を むく、すすむ */
export const rule = (t: 'R' | 'L'): Cmd[] => [rep('goal', iff('wall-ahead', TURN[t]), F)];
export const TIMES: (number | 'goal')[] = ['goal', 2, 3, 4, 5, 6];
export const PALETTE: ('forward' | 'turnRight' | 'turnLeft' | 'repeat' | 'if')[] = [
  'forward',
  'turnRight',
  'turnLeft',
  'repeat',
  'if',
];

/** 地図（右まわり R か 左まわり L） */
export interface Mp {
  rows: string[];
  dir: Dir;
  t: 'R' | 'L';
}
const right = (rows: string[]): Mp => ({ rows, dir: 'right', t: 'R' });
const left = (rows: string[]): Mp => ({ rows: mirrorH(rows), dir: 'left', t: 'L' });
export const sp = (w: number, h: number, mirror = false): Mp =>
  mirror ? left(spiral(w, h)) : right(spiral(w, h));
const maze = (w: number, h: number, mirror: boolean, seed: string, decoys: number): Mp => {
  const base = spiral(w, h);
  const m = mirror ? left(base) : right(base);
  return { ...m, rows: addDecoys(m.rows, m.dir, rule(m.t), seed, decoys) };
};

const hintsWall: [string, string, string] = [
  'ずっと すすんで、かべに ぶつかりそうな ときだけ まがりたいね。',
  '「ずっと くりかえす」の なかに、「もし まえが かべなら まがる」と「すすむ」を いれるよ。',
  'みちが みぎと ひだり、どちらに まがっているか みて、まがる むきを えらぼう。',
];
const hintsMaze: [string, string, string] = [
  'みちは どちらの むきに まがっているかな。ぜんぶ おなじ むきかな。',
  'どの かどでも おなじ きまりで すすめるか かんがえよう。',
  'ふだは 4まい いかだよ。「ずっと くりかえす」「もし かべなら まがる」「まがる むき」「すすむ」の 4つだね。',
];
const WHY =
  '「ずっと くりかえす」の なかで「もし まえが かべなら まがる」と「すすむ」を つかうと、どんな みちでも すこしの ふだで すすめるよ。';

function main(
  id: string,
  obj: string,
  level: number,
  m: Mp,
  hints: [string, string, string],
  initial?: Cmd[],
) {
  return puzzle({
    id,
    obj,
    level,
    rows: m.rows,
    dir: m.dir,
    solution: rule(m.t),
    palette: PALETTE,
    repeatTimes: TIMES,
    conds: ['wall-ahead', 'open-ahead'],
    maxCards: 4,
    ...(initial
      ? {
          initial,
          lead: 'うまく いかない ふだを なおして、ゴールへ いこう。',
        }
      : {}),
    hints,
    why: WHY,
    mis: MIS,
  });
}

// ---- wall-turn ----
const t1 = right(['S...', '###.', '###G']);
const t2 = right(['S...', '###.', 'G...']);
const t3 = left(['S...', '###.', '###G']);
const WALL: [string, number, Mp][] = [
  ['t1', 0, t1],
  ['t2', 0, t2],
  ['t3', 0, t3],
  ['t4', 1, sp(4, 3)],
  ['t5', 1, sp(5, 3, true)],
  ['t6', 1, sp(4, 4)],
  ['t7', 1, sp(5, 4, true)],
];
const wallItems = WALL.map(([id, level, m]) =>
  main(`wall-${id}`, 'wall-turn', level, m, hintsWall),
);

// 別例: かべの前で どちらに まがるか選ぶ
function altWall(id: string, level: number, m: Mp) {
  const l = layout(m.rows, m.dir);
  const right = m.t === 'R' ? 'みぎを むく' : 'ひだりを むく';
  const wrong = m.t === 'R' ? 'ひだりを むく' : 'みぎを むく';
  return choiceItem({
    id: `wall-alt-${id}`,
    obj: 'wall-turn',
    level,
    alt: true,
    prompt: 'ロボットを ゴールまで うごかすよ。かべの まえで、どちらに まがれば いいかな。',
    figure: gridFigure(l, { label: 'ますの ず。やじるしが ロボット、ほしが ゴール', hU: 12 }),
    right,
    wrongs: [[wrong, 'turn']],
    layout: 'row',
    hints: [
      'ロボットの やじるしの むきから、みちを たどって みよう。',
      'かべに ぶつかりそうに なる ところで、みちは どちらへ つづいて いるかな。',
      'どの かどでも、おなじ むきに まがる みちだよ。',
    ],
    explain: `みちは ずっと ${m.t === 'R' ? 'みぎ' : 'ひだり'}へ まがって いるよ。だから「もし まえが かべなら ${right}」を くりかえすと ゴールに つくよ。`,
  });
}
const wallAlts = [
  altWall('a1', 0, t1),
  altWall('a2', 0, sp(5, 3, true)),
  altWall('a3', 1, sp(4, 4)),
];
// ---- loop-if ----
export type Bug = 'cond' | 'turn' | 'count' | 'nof';
export function bugged(t: 'R' | 'L', bug: Bug, count: number): Cmd[] {
  const ok = TURN[t];
  const bad = t === 'R' ? L : R;
  switch (bug) {
    case 'cond':
      return [rep('goal', iff('open-ahead', ok), F)];
    case 'turn':
      return [rep('goal', iff('wall-ahead', bad), F)];
    case 'count':
      return [rep(count, iff('wall-ahead', ok), F)];
    case 'nof':
      return [rep('goal', iff('wall-ahead', ok))];
  }
}
const BUG_HINTS: Record<Bug, [string, string, string]> = {
  cond: [
    'うごかして、キャラクターが どこで うまく いかないか みよう。',
    '「もし」の じょうけんを よもう。かべの まえで だけ まがりたいよね。',
    '「まえが かべなら」と「まえが あいていたら」、どちらが あっているかな。',
  ],
  turn: [
    'うごかして、キャラクターが どこで かべに ぶつかるか みよう。',
    'みちは みぎと ひだり、どちらに まがっているかな。',
    '「もし」の なかの まがる むきを、みちの まがる むきに あわせよう。',
  ],
  count: [
    'うごかして、キャラクターが ゴールの てまえで とまらないか みよう。',
    '「くりかえす」の かいすうが たりないよ。みちは ながいね。',
    'かいすうを かぞえるのは たいへん。「つくまで」に かえると どうなるかな。',
  ],
  nof: [
    'うごかして、キャラクターが うごいて いるか みよう。',
    '「もし」の ふだが ならんでいるだけで、すすむ ふだが ないよ。',
    'かべが ない ときは まっすぐ すすみたいね。くりかえす の なかに あと ひとつ ふだが いるよ。',
  ],
};
const LOOPS: [string, number, Mp, Bug, number][] = [
  ['b1', 1, sp(4, 4), 'cond', 0],
  ['b2', 1, sp(5, 3, true), 'turn', 0],
  ['b3', 1, sp(5, 4), 'count', 6],
  ['b4', 1, sp(4, 3, true), 'nof', 0],
  ['b5', 2, sp(5, 5), 'cond', 0],
  ['b6', 2, sp(6, 4, true), 'turn', 0],
  ['b7', 2, sp(6, 5), 'count', 4],
  ['b8', 2, sp(5, 5, true), 'nof', 0],
];
const loopItems = LOOPS.map(([id, level, m, bug, n]) =>
  main(`loop-${id}`, 'loop-if', level, m, BUG_HINTS[bug], bugged(m.t, bug, n)),
);

const noGoal = (rows: string[]) => rows.map((r) => r.replace('G', '.'));
const landingHints = (n: number): [string, string, string] => [
  'くりかえす の なかの ふだを、ひとつずつ ゆびで たどろう。',
  `ぜんぶで ${n}かい くりかえすよ。まがる ところと まっすぐ すすむ ところを かぞえよう。`,
  'かべの まえに ついた ときに だけ、まがる むきに むきを かえるよ。',
];
function altLanding(id: string, obj: string, level: number, m: Mp, n: number) {
  return landingItem({
    id,
    obj,
    level,
    alt: true,
    rows: noGoal(m.rows),
    dir: m.dir,
    prog: [rep(n, iff('wall-ahead', TURN[m.t]), F)],
    mis: { turn: 'turn', short: 'short', count: 'repeat-count' },
    hints: landingHints(n),
  });
}
const loopAlts = [
  altLanding('loop-alt-a1', 'loop-if', 1, sp(5, 4), 6),
  altLanding('loop-alt-a2', 'loop-if', 2, sp(5, 3, true), 5),
  altLanding('loop-alt-a3', 'loop-if', 2, sp(6, 5), 9),
];

// ---- maze ----
const MAZES: [string, number, Mp][] = [
  ['z1', 2, maze(5, 5, false, 'z1', 3)],
  ['z2', 2, maze(6, 5, true, 'z2', 4)],
  ['z3', 2, maze(7, 5, false, 'z3', 5)],
  ['z4', 2, maze(6, 6, true, 'z4', 5)],
  ['z5', 2, maze(7, 6, false, 'z5', 6)],
  ['z6', 2, maze(7, 7, true, 'z6', 6)],
  ['z7', 2, maze(8, 6, false, 'z7', 7)],
  ['z8', 2, maze(8, 7, true, 'z8', 8)],
];
const mazeItems = MAZES.map(([id, level, m]) => main(`maze-${id}`, 'maze', level, m, hintsMaze));
const mazeAlts = [
  altLanding('maze-alt-a1', 'maze', 2, sp(6, 5), 10),
  altLanding('maze-alt-a2', 'maze', 2, sp(6, 6, true), 12),
  altLanding('maze-alt-a3', 'maze', 2, sp(7, 5), 14),
];

const items: Item[] = [
  ...wallItems,
  ...wallAlts,
  ...loopItems,
  ...loopAlts,
  ...mazeItems,
  ...mazeAlts,
];

export const conditionCombo: UnitSpec = {
  ...baseUnit('g3.prog.condition-combo', 'g3'),
  title: 'じょうけんと くりかえし',
  prereq: ['g2.prog.repeat', 'g1.prog.condition'],
  objectives: [
    { id: 'wall-turn', title: '「かべなら まがる」を くりかえしの なかで つかう' },
    { id: 'loop-if', title: 'くりかえしの なかの「もし」の まちがいを なおす' },
    { id: 'maze', title: 'ひとつの てじゅんで めいろを ぬける' },
  ],
  misconceptions: [
    ...BASE_MIS,
    {
      id: 'cond-flip',
      explain:
        '「かべなら」と「あいていたら」を とりちがえたのかな。かべに ぶつかりそうな ときだけ まがるから、「まえが かべなら」だよ。',
    },
    {
      id: 'repeat-count',
      explain:
        'くりかえす かいすうが ちがったのかな。みちが ながい ときは「つくまで」を つかうと、かぞえなくて いいよ。',
    },
    {
      id: 'too-many',
      explain:
        'ふだが おおすぎたのかな。「ずっと くりかえす」の なかに「もし」を いれると、すこしの ふだで めいろを ぬけられるよ。',
    },
  ],
  levels: [
    { label: 'ひとつの かど', chance: 0.05 },
    { label: 'うずまきの みち', chance: 0.05 },
    { label: 'おおきな めいろ', chance: 0.05 },
  ],
  intro: [
    {
      text: 'かべの まえで まがる ことを くりかえすと、まがりかどが いくつ あっても ぬけられるよ。',
      figure: gridFigure(layout(['S...', '###.', 'G...'], 'right'), {
        label: 'ますの ず。ほしが ゴール',
      }),
    },
    {
      text: '「ずっと くりかえす」の なかに、「もし まえが かべなら みぎを むく」と「すすむ」を いれるよ。',
      figure: {
        kind: 'text',
        text: 'ずっと くりかえす：もし まえが かべなら みぎを むく、すすむ',
        size: 'm',
      },
    },
    {
      text: 'みちが ひだりに まがるなら「ひだりを むく」に かえるよ。ふだは 4まい だけで すむよ。',
    },
  ],
  source: { kind: 'items', items },
  basis:
    '小学校学習指導要領（平成29年告示）総則 第3の1(3)イ、小学校プログラミング教育の手引（第三版）プログラミング的思考（順序・分岐・反復の組合せ）。学年の割当は本アプリの案',
  gradeIsAppProposal: true,
};
