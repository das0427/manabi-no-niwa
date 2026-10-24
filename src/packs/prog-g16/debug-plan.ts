/**
 * g5.prog.debug-plan 手順の改善: 短くする・誤りを直す・くらべる（curriculum-matrix 3.7、手引）。
 *
 * 到達項目:
 *   shorten … ゴールに着くけれど札が多い手順を、くりかえしで短くする（program: 札の数の上限つき）。別例 = 同じ動きの短い書き方を選ぶ
 *   fix     … くりかえし・もし を使った手順の誤りを直す（program）。別例 = なおし方を選ぶ
 *   compare … ゴールに着く手順をくらべる（札の数・すすむマスの数）（choice）。別例 = 数を数える（number）
 * 同一性キー: 問題の id。
 */
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import {
  baseUnit,
  BASE_MIS,
  bestChoice,
  cardCount,
  fasterChoice,
  stripChoice,
  stripFigure,
  F,
  flat,
  gridFigure,
  iff,
  L,
  layout,
  fixChoice,
  puzzle,
  R,
  rep,
  run,
  shortest,
  times,
  type Cmd,
  type Dir,
  type ProgMis,
} from './kit';
import { bugged, PALETTE, rule, sp, TIMES, type Bug, type Mp } from './condition-combo';
import { stair } from './repeat';

const MIS: ProgMis = {
  bump: 'bump',
  short: 'short',
  turn: 'turn',
  repeatCount: 'repeat-count',
  tooMany: 'too-many',
};
const REP_PALETTE: ('forward' | 'turnRight' | 'turnLeft' | 'repeat')[] = [
  'forward',
  'turnRight',
  'turnLeft',
  'repeat',
];

// ---- shorten ----
interface Sh {
  id: string;
  level: number;
  rows: string[];
  dir: Dir;
  sol: Cmd[];
  max: number;
  times?: (number | 'goal')[];
  withIf?: boolean;
}
const st3 = stair(3, 1, 1);
const st4 = stair(4, 1, 1);
const st32 = stair(3, 2, 1);
const st3v = stair(3, 1, 1, true);
const SHORTEN: Sh[] = [
  { id: 'h1', level: 0, rows: ['S......G'], dir: 'right', sol: [rep(7, F)], max: 3 },
  { id: 'h2', level: 0, rows: ['S....', '....G'], dir: 'right', sol: [rep(4, F), R, F], max: 4 },
  { id: 'h3', level: 0, rows: ['S...', '###.', '###G'], dir: 'right', sol: [rep(3, F), R, rep(2, F)], max: 5 },
  { id: 'h4', level: 1, rows: st3.rows, dir: st3.dir, sol: st3.sol, max: 5 },
  { id: 'h5', level: 1, rows: st3v.rows, dir: st3v.dir, sol: st3v.sol, max: 5 },
  { id: 'h6', level: 1, rows: st4.rows, dir: st4.dir, sol: st4.sol, max: 5 },
  { id: 'h7', level: 2, rows: st32.rows, dir: st32.dir, sol: st32.sol, max: 6 },
  { id: 'h8', level: 2, rows: sp(4, 3).rows, dir: 'right', sol: rule('R'), max: 4, withIf: true },
];
const shortenItems = SHORTEN.map((s) => {
  const l = layout(s.rows, s.dir);
  const long = shortest(l)!;
  return puzzle({
    id: `shorten-${s.id}`,
    obj: 'shorten',
    level: s.level,
    rows: s.rows,
    dir: s.dir,
    solution: s.sol,
    initial: long,
    palette: s.withIf ? PALETTE : REP_PALETTE,
    repeatTimes: s.withIf ? TIMES : [2, 3, 4, 5, 6, 7],
    ...(s.withIf ? { conds: ['wall-ahead', 'open-ahead'] as ('wall-ahead' | 'open-ahead')[] } : {}),
    maxCards: s.max,
    lead: `ふだが おおすぎるよ。${s.withIf ? '「くりかえす」と「もし」で' : '「くりかえす」で'} へらそう。`,
    hints: [
      'おなじ ふだが つづく ところや、おなじ ならびが でてくる ところを さがそう。',
      `ふだは ${s.max}まい いかだよ。「くりかえす」の ふだも 1まいと 数《かぞ》えるよ。まず ならんでいる ふだを はずそう。`,
      s.withIf
        ? 'かべの まえで まがる ことを くりかえす きまりが あるよ。「ずっと くりかえす」の なかに「もし」を いれよう。'
        : 'はじめの おなじ ふだの ならびを「くりかえす」の なかに いれて、かいすうを きめよう。',
    ],
    why: 'おなじ ならびは「くりかえす」で まとめると、手順《てじゅん》が みじかく なって、まちがいも へるよ。',
    mis: MIS,
  });
});

// 別例: 同じ動きの短い書き方を選ぶ
interface Eq {
  id: string;
  level: number;
  long: Cmd[];
  right: Cmd;
  wrongs: [Cmd, string][];
}
const EQ: Eq[] = [
  {
    id: 'a1',
    level: 0,
    long: [F, F, R, F, F, R, F, F, R, F, F, R],
    right: rep(4, F, F, R),
    wrongs: [
      [rep(3, F, F, R), 'repeat-count'],
      [rep(4, F, R), 'repeat-body'],
    ],
  },
  {
    id: 'a2',
    level: 0,
    long: [F, F, F, R, F, F, F, R],
    right: rep(2, rep(3, F), R),
    wrongs: [
      [rep(3, rep(2, F), R), 'repeat-body'],
      [rep(2, rep(3, F)), 'repeat-body'],
    ],
  },
  {
    id: 'a3',
    level: 1,
    long: [L, F, F, L, F, F, L, F, F],
    right: rep(3, L, F, F),
    wrongs: [
      [rep(3, F, F, L), 'repeat-body'],
      [rep(2, L, F, F), 'repeat-count'],
    ],
  },
];
const eqItems: ChoiceItem[] = EQ.map((q) => {
  if (flat([q.right]).join() !== flat(q.long).join()) throw new Error(`${q.id}: 正解が同じ動きでない`);
  for (const [w] of q.wrongs)
    if (flat([w]).join() === flat(q.long).join()) throw new Error(`${q.id}: 誤りが同じ動き`);
  const text = (c: Cmd) => cmdTextOf([c]);
  return stripChoice({
    id: `shorten-alt-${q.id}`,
    obj: 'shorten',
    level: q.level,
    alt: true,
    prompt: 'おなじ うごきに なる、みじかい てじゅんは どれ？',
    given: q.long,
    right: [q.right],
    wrongs: q.wrongs.map(([w, m]) => [[w], m] as [Cmd[], string]),
    hints: [
      'おなじ ならびが なんかい でてくるか 数《かぞ》えよう。',
      '「くりかえす」の なかに 入《い》れる ならびを さがそう。',
      'ならびの 中《なか》の ふだの じゅんばんも、もとの 手順《てじゅん》と おなじか たしかめよう。',
    ],
    explain: `「${text(q.right)}」を ひらくと、もとの 手順《てじゅん》と おなじ うごきに なるよ。`,
  });
});

// ---- fix ----
interface Fx {
  id: string;
  level: number;
  rows: string[];
  dir: Dir;
  sol: Cmd[];
  bad: Cmd[];
  max: number;
  kind: string;
  hints?: [string, string, string];
  withIf?: boolean;
}
const st2w = stair(2, 2, 1);
const st4v = stair(4, 1, 1, true);
const mapFix = (id: string, level: number, m: Mp, bug: Bug, n: number): Fx => ({
  id,
  level,
  rows: m.rows,
  dir: m.dir,
  sol: rule(m.t),
  bad: bugged(m.t, bug, n),
  max: 4,
  kind: bug,
  withIf: true,
});
const FIXES: Fx[] = [
  {
    id: 'x1',
    level: 1,
    rows: st3.rows,
    dir: st3.dir,
    sol: st3.sol,
    bad: [rep(3, F, L, F, R)],
    max: 5,
    kind: 'turn-order',
  },
  {
    id: 'x2',
    level: 1,
    rows: st4v.rows,
    dir: st4v.dir,
    sol: st4v.sol,
    bad: [rep(3, F, L, F, R)],
    max: 5,
    kind: 'count',
  },
  {
    id: 'x3',
    level: 1,
    rows: st2w.rows,
    dir: st2w.dir,
    sol: st2w.sol,
    bad: [rep(2, F, R, F, L)],
    max: 6,
    kind: 'drop',
  },
  {
    id: 'x4',
    level: 1,
    rows: ['S...', '###.', '###G'],
    dir: 'right',
    sol: [rep(3, F), R, rep(2, F)],
    bad: [rep(2, F), R, rep(2, F)],
    max: 5,
    kind: 'count',
  },
  mapFix('x5', 2, sp(5, 4), 'cond', 0),
  mapFix('x6', 2, sp(6, 4, true), 'turn', 0),
  mapFix('x7', 2, sp(5, 5), 'nof', 0),
  mapFix('x8', 2, sp(6, 5), 'count', 6),
];
const FIX_HINTS: Record<string, [string, string, string]> = {
  'turn-order': [
    'うごかして、どこで みちから はずれるか みよう。',
    'かいだんは「すすむ、みぎ、すすむ、ひだり」の くりかえしだよ。ふだの じゅんばんを みよう。',
    'ふたつの まがる ふだの むきが、みちと あっているか たしかめよう。',
  ],
  count: [
    'うごかして、ゴールの てまえで とまらないか みよう。',
    '「くりかえす」の かいすうが たりないよ。',
    'みちの だんの 数《かず》や 長《なが》さを 数《かぞ》えて、かいすうを なおそう。',
  ],
  drop: [
    'うごかして、ゴールの てまえで ぶつからないか みよう。',
    '1つの だんは「すすむ」が 2かい つづくよ。くりかえす なかの ふだを みよう。',
    'くりかえす なかの「すすむ」の 数《かず》が たりないよ。',
  ],
  cond: [
    'うごかして、キャラクターが どこで うまく いかないか みよう。',
    '「もし」の じょうけんを 読《よ》もう。かべの まえで だけ まがりたいよね。',
    '「まえが かべなら」と「まえが あいていたら」、どちらが あっているかな。',
  ],
  turn: [
    'うごかして、どこで かべに ぶつかるか みよう。',
    'みちは みぎと ひだり、どちらに まがっているかな。',
    '「もし」の なかの まがる むきを みちに あわせよう。',
  ],
  nof: [
    'うごかして、キャラクターが うごいているか みよう。',
    '「もし」だけでは、すすむ ふだが ないよ。',
    'かべが ない ときは まっすぐ すすみたいね。くりかえす なかに ふだを あと ひとつ たそう。',
  ],
};
const fixItems = FIXES.map((f) =>
  puzzle({
    id: `fix-${f.id}`,
    obj: 'fix',
    level: f.level,
    rows: f.rows,
    dir: f.dir,
    solution: f.sol,
    initial: f.bad,
    palette: f.withIf ? PALETTE : REP_PALETTE,
    repeatTimes: f.withIf ? TIMES : [2, 3, 4, 5],
    ...(f.withIf ? { conds: ['wall-ahead', 'open-ahead'] as ('wall-ahead' | 'open-ahead')[] } : {}),
    maxCards: f.max,
    lead: 'うまく うごかないよ。なおして ゴールへ いこう。',
    hints: FIX_HINTS[f.kind]!,
    why: 'うごかして みると、どこで まちがえたか みつかるよ。まちがいを ひとつずつ なおすと、手順《てじゅん》が よくなるね。',
    mis: MIS,
  }),
);

// 別例: なおす ところを選ぶ
const fixAlts: ChoiceItem[] = [
  fixChoice({
    id: 'fix-alt-a1',
    obj: 'fix',
    level: 1,
    alt: true,
    rows: st3.rows,
    dir: st3.dir,
    bad: [rep(3, F, L, F, R)],
    fixes: [
      { label: 'まがる むき', prog: [rep(3, F, R, F, L)] },
      { label: 'くりかえす かいすう', prog: [rep(4, F, L, F, R)], mis: 'repeat-count' },
      { label: 'すすむ ふだの かず', prog: [rep(3, F, F, L, F, R)], mis: 'wrong-spot' },
    ],
    explain:
      'かいだんは「すすむ、みぎ、すすむ、ひだり」の くりかえし。みぎと ひだりの むきが ぎゃくだったから、まがる むきを なおすと ゴールに つくよ。',
  }),
  fixChoice({
    id: 'fix-alt-a2',
    obj: 'fix',
    level: 2,
    alt: true,
    rows: sp(5, 4).rows,
    dir: 'right',
    bad: [rep('goal', iff('open-ahead', R), F)],
    fixes: [
      { label: 'じょうけん', prog: rule('R') },
      { label: 'まがる むき', prog: [rep('goal', iff('open-ahead', L), F)], mis: 'turn' },
      { label: 'くりかえす かいすう', prog: [rep(5, iff('open-ahead', R), F)], mis: 'repeat-count' },
    ],
    explain:
      'かべに ぶつかりそうな ときだけ まがりたいから、じょうけんは「まえが かべなら」だよ。「あいていたら」だと すすめる ときも まがって しまうね。',
  }),
  fixChoice({
    id: 'fix-alt-a3',
    obj: 'fix',
    level: 2,
    alt: true,
    rows: ['S...', '###.', '###G'],
    dir: 'right',
    bad: [rep(2, F), R, rep(2, F)],
    fixes: [
      { label: 'ひとつめの かいすう', prog: [rep(3, F), R, rep(2, F)] },
      { label: 'ふたつめの かいすう', prog: [rep(2, F), R, rep(3, F)], mis: 'wrong-spot' },
      { label: 'まがる むき', prog: [rep(2, F), L, rep(2, F)], mis: 'turn' },
    ],
    explain:
      'みちは よこに 3マス すすんでから まがるよ。ひとつめの かいすうが 2かいだと、まがる ばしょが 1マス てまえに なって しまうね。',
  }),
];

// ---- compare ----
const st2 = stair(2, 1, 1);
const around = (w: number) => [
  'S' + '.'.repeat(w - 2) + 'G',
  '.' + '#'.repeat(w - 2) + '.',
  '.'.repeat(w),
];
const aroundProgs = (w: number) => ({
  direct: [rep(w - 1, F)] as Cmd[],
  around: [R, rep(2, F), L, rep(w - 1, F), L, rep(2, F)] as Cmd[],
});
const cardsItems: ChoiceItem[] = [
  bestChoice({
    id: 'compare-m1',
    obj: 'compare',
    level: 1,
    rows: st2.rows,
    dir: st2.dir,
    progs: [
      { prog: shortest(layout(st2.rows, st2.dir))!, mis: 'not-shortest' },
      { prog: st2.sol, mis: '' },
    ],
  }),
  bestChoice({
    id: 'compare-m2',
    obj: 'compare',
    level: 1,
    rows: ['S......G'],
    dir: 'right',
    progs: [
      { prog: [rep(7, F)], mis: '' },
      { prog: times(7, F), mis: 'not-shortest' },
    ],
  }),
  bestChoice({
    id: 'compare-m3',
    obj: 'compare',
    level: 2,
    rows: ['S....', '....G'],
    dir: 'right',
    progs: [
      { prog: [F, F, F, F, R, F], mis: 'not-shortest' },
      { prog: [rep(4, F), R, F], mis: '' },
    ],
  }),
];
const movesItems: ChoiceItem[] = [
  { id: 'compare-m4', level: 2, w: 5, order: 'ad' },
  { id: 'compare-m5', level: 2, w: 6, order: 'da' },
  { id: 'compare-m6', level: 2, w: 7, order: 'ad' },
].map((c) => {
  const p = aroundProgs(c.w);
  return fasterChoice({
    id: c.id,
    obj: 'compare',
    level: c.level,
    rows: around(c.w),
    dir: 'right',
    progs:
      c.order === 'ad'
        ? [
            { prog: p.around, mis: 'not-fastest' },
            { prog: p.direct, mis: 'not-fastest' },
          ]
        : [
            { prog: p.direct, mis: 'not-fastest' },
            { prog: p.around, mis: 'not-fastest' },
          ],
  });
});
const compareItems: ChoiceItem[] = [...cardsItems, ...movesItems];
// 別例: 数を数える
function countAlt(opt: {
  id: string;
  level: number;
  prog: Cmd[];
  kind: 'cards' | 'moves';
  rows?: string[];
  dir?: Dir;
  wrongs: [number, string][];
}): NumberItem {
  const l = opt.rows ? layout(opt.rows, opt.dir ?? 'right') : null;
  const answer = opt.kind === 'cards' ? cardCount(opt.prog) : run(l!, opt.prog).trail.length - 1;
  return {
    engine: 'number',
    id: opt.id,
    objective: 'compare',
    level: opt.level,
    alt: true,
    prompt:
      opt.kind === 'cards'
        ? 'ふだは ぜんぶで なんまい？\n（「くりかえす」の ふだも 1まい）'
        : 'キャラクターは ぜんぶで なんマス すすむ？',
    figure: stripFigure(opt.prog, { label: `てじゅんの ふだ: ${cmdTextOf(opt.prog)}`, hU: 6 }),
    fields: [{ label: opt.kind === 'cards' ? 'まい' : 'マス', answer: { kind: 'int', value: answer } }],
    wrongAnswers: opt.wrongs.filter(([v]) => v !== answer).map(([v, m]) => ({ value: String(v), misconception: m })),
    hints:
      opt.kind === 'cards'
        ? [
            '「くりかえす」の ふだは 1まいだよ。',
            'くりかえす の なかの ふだを、ひとつずつ 数《かぞ》えよう。',
            'なかの ふだが なんまいか 数《かぞ》えて、「くりかえす」の 1まいを たそう。',
          ]
        : [
            '「すすむ」の ふだだけ 数《かぞ》えよう。「みぎを むく」は マスを すすまないよ。',
            '「くりかえす」の なかの「すすむ」は、かいすう ぶん うごくよ。',
            'なかの「すすむ」の 数《かず》に、くりかえす かいすうを かけよう。',
          ],
    explain:
      opt.kind === 'cards'
        ? `ふだは ぜんぶで ${answer}まい。「くりかえす」の ふだを 1まいと 数《かぞ》えて、なかの ふだを たしたよ。`
        : `「すすむ」で うごく マスを ぜんぶ たして ${answer}マス。「くりかえす」の なかの「すすむ」は、かいすう ぶん うごくよ。`,
    identity: opt.id,
  };
}
function cmdTextOf(p: Cmd[]): string {
  const t = (c: Cmd): string =>
    c.op === 'repeat'
      ? `くりかえす ${c.times}かい（${c.body.map(t).join('、')}）`
      : c.op === 'forward'
        ? 'すすむ'
        : c.op === 'turnRight'
          ? 'みぎを むく'
          : c.op === 'turnLeft'
            ? 'ひだりを むく'
            : c.op;
  return p.map(t).join('、');
}
const countAlts: NumberItem[] = [
  countAlt({
    id: 'compare-alt-a1',
    level: 1,
    kind: 'cards',
    prog: [rep(3, F, R, F, L)],
    wrongs: [
      [4, 'count-card'],
      [12, 'count-card'],
      [3, 'count-card'],
    ],
  }),
  countAlt({
    id: 'compare-alt-a2',
    level: 2,
    kind: 'moves',
    rows: ['S......', '.......', '.......', '.......'],
    dir: 'right',
    prog: [rep(3, F, F, R, F, L)],
    wrongs: [
      [3, 'count-move'],
      [2, 'count-move'],
      [9, 'count-move'],
    ],
  }),
  countAlt({
    id: 'compare-alt-a3',
    level: 2,
    kind: 'cards',
    prog: [rep(2, rep(3, F), R)],
    wrongs: [
      [3, 'count-card'],
      [8, 'count-card'],
      [2, 'count-card'],
    ],
  }),
];

const items: Item[] = [
  ...shortenItems,
  ...eqItems,
  ...fixItems,
  ...fixAlts,
  ...compareItems,
  ...countAlts,
];

const introGrid = gridFigure(layout(st3.rows, st3.dir), { label: 'ますの ず。かいだんの ような みち' });

export const debugPlan: UnitSpec = {
  ...baseUnit('g5.prog.debug-plan', 'g5'),
  title: '手順《てじゅん》を よくしよう',
  prereq: ['g3.prog.decompose'],
  objectives: [
    { id: 'shorten', title: '手順《てじゅん》を みじかく する' },
    { id: 'fix', title: 'くりかえし・もし の まちがいを なおす' },
    { id: 'compare', title: 'ゴールに つく 手順《てじゅん》を くらべる' },
  ],
  misconceptions: [
    ...BASE_MIS,
    {
      id: 'repeat-count',
      explain:
        'くりかえす かいすうを 数《かぞ》えまちがえたのかな。みちの 長《なが》さや だんの 数《かず》を 数《かぞ》えて かいすうを きめよう。',
    },
    {
      id: 'repeat-body',
      explain: '「くりかえす」の なかの ふだが ちがうのかな。くりかえす ひとまとまりを もう一度《いちど》 よく 見《み》よう。',
    },
    {
      id: 'too-many',
      explain: '札《ふだ》が おおすぎたのかな。おなじ ならびを「くりかえす」で まとめると へらせるよ。',
    },
    {
      id: 'wrong-spot',
      explain: '別《べつ》の ところが まちがいだと 思《おも》ったのかな。うごかして、ゴールから はなれはじめる ところを さがしてみよう。',
    },
    {
      id: 'not-shortest',
      explain: 'もっと ふだが すくない 手順《てじゅん》が あるよ。「くりかえす」の ふだも 1まいと 数《かぞ》えて くらべよう。',
    },
    {
      id: 'not-fastest',
      explain: 'ゴールまで すすむ マスの 数《かず》が 多《おお》い 手順《てじゅん》だよ。まわりみちや、むだな うごきが ないか 地図《ちず》で たどってみよう。',
    },
    {
      id: 'count-card',
      explain: '札《ふだ》の 数《かぞ》え方《かた》を まちがえたのかな。「くりかえす」の ふだ 1まいと、なかの ふだを たそう。',
    },
    {
      id: 'count-move',
      explain: 'すすむ マスの 数《かず》の 数《かぞ》え方《かた》を まちがえたのかな。「すすむ」の 数《かず》に、くりかえす かいすうを かけよう。',
    },
  ],
  levels: [
    { label: 'みじかく する', chance: 0.05 },
    { label: 'まちがいを なおす', chance: 0.05 },
    { label: 'くらべて えらぶ', chance: 0.05 },
  ],
  intro: [
    {
      text: '同《おな》じ ならびを「くりかえす」で まとめると、手順《てじゅん》が みじかくなるよ。',
      figure: introGrid,
    },
    {
      text: 'うごかして みて、ゴールに つかない ときは、どこで ずれるか 見《み》て なおそう。',
      figure: { kind: 'text', text: 'うごかす → 見《み》る → なおす', size: 'l' },
    },
    {
      text: '手順《てじゅん》は、ふだの 数《かず》や うごく マスの 数《かず》で くらべて、よりよい ものを えらべるよ。',
    },
  ],
  source: { kind: 'items', items },
  basis:
    '小学校学習指導要領（平成29年告示）総則 第3の1(3)イ、小学校プログラミング教育の手引（第三版）（手順の改善・誤りの修正）。学年の割当は本アプリの案',
  gradeIsAppProposal: true,
};



