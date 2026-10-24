/**
 * p5.prog.steps てじゅんカード（curriculum-matrix 3.3・4.1）: ふだを ならべて キャラクターを うごかす。
 * 幼児の ふだは 方向（うえ・した・ひだり・みぎ）で うごく（engines.md: 幼児は up/down/left/right。
 * 対応表の「前・回る」は 向きで動く札だが、5歳には方向の札にした）。
 * 段階0: 1つの むきだけ 2〜4まい。段階1: まがる ところを ふくむ 3〜4まい。段階2: ならべた ふだの まちがいを 1まい なおす。
 * 別例: たての いどう（段階0）、いわを よける（段階1）、ふだが 1まい おおい（段階2）。
 * 同一性キー: 盤の大きさ・はじめ・ゴール・かべ（＋なおす列）。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import type { Cell, Command, ProgramItem } from '../../engines/program/program';

type Dir = 'up' | 'down' | 'left' | 'right';
const NAME: Record<Dir, string> = { up: 'うえ', down: 'した', left: 'ひだり', right: 'みぎ' };
const PAL: Dir[] = ['up', 'down', 'left', 'right'];
const MIS = { bump: 'bump', short: 'short', turn: 'lr-mix', tooMany: 'too-many' };
const CHARS: [string, string, string][] = [
  ['rabbit', 'carrot', 'にんじん'],
  ['bear', 'apple', 'りんご'],
  ['monkey', 'banana', 'バナナ'],
  ['chick', 'flower', 'はな'],
];
const CHAR_NAME: Record<string, string> = {
  rabbit: 'うさぎ',
  bear: 'くま',
  monkey: 'さる',
  chick: 'ひよこ',
};

/** よこ → たて の じゅんに すすむ 列 */
function pathOf(from: Cell, to: Cell): Dir[] {
  const out: Dir[] = [];
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  for (let i = 0; i < Math.abs(dx); i++) out.push(dx > 0 ? 'right' : 'left');
  for (let i = 0; i < Math.abs(dy); i++) out.push(dy > 0 ? 'down' : 'up');
  return out;
}
const cmd = (ds: Dir[]): Command[] => ds.map((op) => ({ op }));
const sayList = (ds: Dir[]) => ds.map((d) => NAME[d]).join('、');

interface Board {
  w: number;
  h: number;
  from: Cell;
  to: Cell;
  walls?: Cell[];
  /** 別の道（かべで ふさいだ ときの 正答） */
  sol?: Dir[];
}

function item(
  b: Board,
  objective: string,
  level: number,
  n: number,
  alt: boolean,
  initial?: Dir[],
): ProgramItem {
  const sol = b.sol ?? pathOf(b.from, b.to);
  const [ch, goal, goalName] = CHARS[n % CHARS.length]!;
  const key = `${b.w}x${b.h}:${b.from.join(',')}>${b.to.join(',')}${b.walls ? `:w${b.walls.map((c) => c.join(',')).join('/')}` : ''}${initial ? `:fix${initial.join('-')}` : ''}`;
  return {
    engine: 'program',
    id: `${objective}:${key}`,
    objective,
    level,
    alt,
    prompt: initial
      ? alt
        ? `${CHAR_NAME[ch]}が よりみちを して しまうよ。いらない ふだを 1まい とろう。`
        : `${CHAR_NAME[ch]}が ${goalName}に つかないよ。ふだを 1まい なおそう。`
      : `${CHAR_NAME[ch]}を ${goalName}まで つれて いこう。ふだを ならべてね。`,
    grid: { w: b.w, h: b.h, ...(b.walls ? { walls: b.walls } : {}) },
    start: { at: b.from, dir: 'right' },
    goal: b.to,
    palette: PAL,
    solution: cmd(sol),
    ...(initial ? { initial: cmd(initial) } : {}),
    maxCards: sol.length + 2,
    misconceptionIds: MIS,
    character: ch,
    goalIllust: goal,
    hints: initial
      ? ['うごかして、どこで ちがう ほうへ いくか みよう。', 'まがる ところの ふだを よく みよう。']
      : [`${goalName}は どっちに あるかな。`, `まず ${NAME[sol[0]!]}に いくつ すすむかな。`],
    explain: `${sayList(sol)} で ${goalName}に ついたね。`,
    identity: key,
  };
}

function build(): Item[] {
  const items: Item[] = [];
  let n = 0;
  // 段階0: 1つの むき
  const STRAIGHT: Board[] = [
    { w: 3, h: 1, from: [0, 0], to: [2, 0] },
    { w: 4, h: 1, from: [0, 0], to: [3, 0] },
    { w: 3, h: 1, from: [2, 0], to: [0, 0] },
    { w: 4, h: 1, from: [3, 0], to: [0, 0] },
    { w: 4, h: 2, from: [1, 1], to: [3, 1] },
    { w: 4, h: 2, from: [2, 0], to: [0, 0] },
    { w: 5, h: 1, from: [1, 0], to: [4, 0] },
  ];
  for (const b of STRAIGHT) items.push(item(b, 'straight', 0, n++, false));
  const VERTICAL: Board[] = [
    { w: 2, h: 3, from: [0, 2], to: [0, 0] },
    { w: 2, h: 4, from: [1, 0], to: [1, 3] },
    { w: 2, h: 3, from: [1, 0], to: [1, 2] },
  ];
  for (const b of VERTICAL) items.push(item(b, 'straight', 0, n++, true));
  // 段階1: まがる
  const TURN: Board[] = [
    { w: 3, h: 2, from: [0, 0], to: [2, 1] },
    { w: 3, h: 3, from: [0, 0], to: [1, 2] },
    { w: 3, h: 3, from: [0, 0], to: [2, 2] },
    { w: 4, h: 2, from: [0, 1], to: [3, 0] },
    { w: 3, h: 3, from: [2, 0], to: [0, 1] },
    { w: 3, h: 3, from: [2, 2], to: [1, 0] },
    { w: 4, h: 3, from: [3, 0], to: [1, 2] },
    { w: 3, h: 4, from: [0, 3], to: [1, 0] },
  ];
  for (const b of TURN) items.push(item(b, 'turn', 1, n++, false));
  const ROCKS: Board[] = [
    { w: 3, h: 2, from: [0, 0], to: [2, 1], walls: [[1, 0]], sol: ['down', 'right', 'right'] },
    {
      w: 3,
      h: 3,
      from: [0, 0],
      to: [2, 2],
      walls: [
        [1, 0],
        [2, 0],
      ],
      sol: ['down', 'down', 'right', 'right'],
    },
    {
      w: 4,
      h: 2,
      from: [0, 1],
      to: [3, 1],
      walls: [
        [1, 1],
        [2, 1],
      ],
      sol: ['up', 'right', 'right', 'right', 'down'],
    },
  ];
  for (const b of ROCKS) items.push(item(b, 'turn', 1, n++, true));
  // 段階2: なおす
  const FIX: [Board, Dir[]][] = [
    [{ w: 3, h: 2, from: [0, 0], to: [2, 1] }, ['right', 'right', 'up']],
    [{ w: 3, h: 3, from: [0, 0], to: [2, 2] }, ['right', 'left', 'down', 'down']],
    [{ w: 4, h: 1, from: [0, 0], to: [3, 0] }, ['right', 'right', 'left']],
    [{ w: 3, h: 3, from: [2, 0], to: [0, 1] }, ['left', 'right', 'down']],
    [{ w: 3, h: 3, from: [0, 2], to: [2, 0] }, ['right', 'right', 'down', 'up']],
    [{ w: 2, h: 3, from: [0, 0], to: [0, 2] }, ['down', 'up']],
  ];
  for (const [b, init] of FIX) items.push(item(b, 'debug', 2, n++, false, init));
  const FIX_MORE: [Board, Dir[]][] = [
    [{ w: 3, h: 2, from: [0, 0], to: [2, 0] }, ['right', 'down', 'right']],
    [{ w: 3, h: 2, from: [0, 1], to: [2, 1] }, ['right', 'up', 'right']],
    [{ w: 2, h: 3, from: [0, 2], to: [0, 0] }, ['up', 'right', 'up']],
  ];
  for (const [b, init] of FIX_MORE) items.push(item(b, 'debug', 2, n++, true, init));
  return items;
}

export const stepsUnit: UnitSpec = {
  id: 'p5.prog.steps',
  title: 'てじゅんカード',
  stage: 'p5',
  subject: 'prog',
  domain: 'play',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-program',
  prereq: ['p4.think.road'],
  objectives: [
    { id: 'straight', title: 'ひとつの むきに すすむ' },
    { id: 'turn', title: 'まがって すすむ' },
    { id: 'debug', title: 'まちがいを 1まい なおす' },
  ],
  misconceptions: [
    { id: 'bump', explain: 'かべや はしに ぶつかったね。どこで まがるか かんがえよう。' },
    { id: 'short', explain: 'もうすこしで つくね。あと なんこ すすむかな。' },
    {
      id: 'lr-mix',
      explain: 'みぎと ひだりが いれかわったかな。おはしを もつ てが どっちか おもいだそう。',
    },
    { id: 'too-many', explain: 'ふだが おおすぎるね。すすみすぎて いないかな。' },
  ],
  levels: [
    { label: 'ひとつの むき（2〜4まい）', chance: 0.05 },
    { label: 'まがる（3〜5まい）', chance: 0.02 },
    { label: 'まちがいを なおす', chance: 0.1 },
  ],
  intro: [
    {
      text: 'ふだを ならべると、その じゅんに うごくよ。「みぎ」「みぎ」で みぎへ 2つ。',
      figure: { kind: 'text', text: 'みぎ → みぎ', size: 'l' },
    },
  ],
  source: { kind: 'items', items: build() },
  review: 'view',
  basis:
    '幼稚園教育要領 環境（試す・工夫する）、小学校プログラミング教育の手引（第三版）へ接続、curriculum-matrix 3.3・4.1',
  gradeIsAppProposal: true,
  revised: '2026-10-24',
};
