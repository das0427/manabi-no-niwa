/**
 * g1.prog.sequence 順序: 手順の札を並べて動かす（curriculum-matrix 3.4、手引: 順序）。
 *
 * 到達項目:
 *   daily  … 生活の手順を順に並べる（order）。別例 = 「いちばん さいしょは？」と選ぶ（choice）
 *   move   … 札（すすむ・みぎを むく・ひだりを むく）を並べてキャラを動かす（program）。別例 = どこに着くかを選ぶ
 *   change … 札の順番を変えると結果が変わる（choice）。別例 = 札を並べかえてゴールに着かせる（order）
 * 同一性キー: 問題の id（場面・地図ごと）。
 * 定義域: 手作り（地図と場面を1つずつ作った）ので、基準は手作りの 30。
 */
import type { ChoiceItem, Item, OrderItem, UnitSpec } from '../../curriculum/types';
import {
  baseUnit,
  BASE_MIS,
  choiceItem,
  gridFigure,
  landingItem,
  layout,
  orderItem,
  puzzle,
  reaches,
  shortest,
  type Cmd,
  type Dir,
  type ProgMis,
} from './kit';

const MIS: ProgMis = { bump: 'bump', short: 'short', turn: 'turn' };
const WHY = 'ふだの じゅんばんを かえると、つく ばしょも かわるよ。';

// ---- daily: 生活の手順を並べる ----
interface Daily {
  id: string;
  level: number;
  prompt: string;
  cards: string[];
  hints: [string, string, string];
  explain: string;
  alsoAccept?: number[][];
}
const DAILY: Daily[] = [
  {
    id: 'asa',
    level: 0,
    prompt: 'あさの じゅんばんに ならべよう。',
    cards: ['おきる', 'きがえる', 'がっこうへ いく'],
    hints: [
      'じぶんの あさの ようすを おもいだして みよう。',
      'いちばん はじめは、ねむい ところから はじまるね。',
      '「おきる」の つぎは、すがたを ととのえる ことが くるよ。',
    ],
    explain:
      'おきる、きがえる、がっこうへ いく の じゅんだよ。きがえる まえに でかける ことは できないね。',
  },
  {
    id: 'kutsu',
    level: 0,
    prompt: 'そとへ でかける じゅんばんに ならべよう。',
    cards: ['げんかんへ いく', 'くつを はく', 'そとへ でる'],
    hints: [
      'でかける ときの うごきを じゅんに おもいうかべよう。',
      'そとへ でる のは、さいごの うごきだよ。',
      '「げんかんへ いく」の つぎに、あしに つける ものを かんがえよう。',
    ],
    explain:
      'げんかんへ いって、くつを はいてから、そとへ でるよ。はだしでは そとへ でられないね。',
  },
  {
    id: 'hamigaki',
    level: 1,
    prompt: 'はを みがく じゅんばんに ならべよう。',
    cards: ['はぶらしに はみがきこを つける', 'はを みがく', 'みずで くちを ゆすぐ'],
    hints: [
      'はを みがく まえの じゅんびから かんがえよう。',
      '「みがく」のは まんなかの ふだだよ。',
      'はぶらしに ものを つけてから みがく。みがいた あとは どうするかな。',
    ],
    explain:
      'はぶらしに はみがきこを つけて、はを みがいて、くちを ゆすぐ じゅんだよ。みがく まえに つけるから、きれいに なるんだね。',
  },
  {
    id: 'bento',
    level: 1,
    prompt: 'おべんとうの じかんの じゅんばんに ならべよう。',
    cards: ['てを あらう', 'いただきますと いう', 'たべる', 'ごちそうさまと いう'],
    hints: [
      'おべんとうを たべる まえと あとに することを わけてみよう。',
      'たべる ふだは、まんなかに くるよ。',
      'たべる まえには、てと ことばの じゅんびが あるよ。',
    ],
    explain:
      'てを あらい、いただきますと いって、たべて、ごちそうさまと いう じゅんだよ。たべる ふだが まんなかに くるよ。',
  },
  {
    id: 'tearai',
    level: 2,
    prompt: 'てを あらう じゅんばんに ならべよう。',
    cards: ['てを ぬらす', 'せっけんを つける', 'こする', 'みずで ながす', 'ふく'],
    hints: [
      'てを あらい はじめる ふだから、ふく ふだまで じゅんに かんがえよう。',
      'せっけんは、てを ぬらしてから つけるよ。',
      'こすった あとに、せっけんを どうするかな。ふくのは いちばん さいごだよ。',
    ],
    explain:
      'ぬらして、せっけんを つけて、こすって、ながして、ふく じゅんだよ。ながす まえに ふくと、せっけんが のこってしまうね。',
  },
  {
    id: 'neru',
    level: 2,
    prompt: 'ねる まえの じゅんばんに ならべよう。',
    cards: ['パジャマに きがえる', 'はを みがく', 'ふとんに はいる', 'ねる'],
    alsoAccept: [[1, 0, 2, 3]],
    hints: [
      'ねる まえに することを じゅんに おもいだそう。',
      'はを みがく のと きがえる のは、どちらが さきでも いいよ。',
      '「ふとんに はいる」と「ねる」は さいごの ふたつだよ。',
    ],
    explain:
      'パジャマに きがえる ことと はを みがく ことは、どちらが さきでも いいよ。そのあと ふとんに はいって ねるよ。',
  },
];

const dailyItem = (d: Daily): OrderItem => ({
  engine: 'order',
  id: `daily-${d.id}`,
  objective: 'daily',
  level: d.level,
  prompt: d.prompt,
  cards: d.cards.map((label) => ({ label })),
  ...(d.alsoAccept ? { alsoAccept: d.alsoAccept } : {}),
  ends: ['はじめ', 'おわり'],
  layout: d.cards.length <= 4 && d.cards.some((c) => c.length > 9) ? 'column' : 'row',
  reverseMisconception: 'order',
  hints: d.hints,
  explain: d.explain,
  identity: `daily-${d.id}`,
});

const DAILY_ALT: ChoiceItem[] = [
  choiceItem({
    id: 'daily-alt-tearai-first',
    obj: 'daily',
    level: 1,
    alt: true,
    prompt: 'てを あらう とき、いちばん はじめに する ことは どれかな。',
    right: 'みずで てを ぬらす',
    wrongs: [
      ['タオルで ふく', 'order'],
      ['みずで ながす', 'order'],
    ],
    hints: [
      'てを あらう ところを おもいうかべよう。',
      'せっけんを つける まえに、てを どうするかな。',
      'ふく ことと ながす ことは、あとの ほうの ふだだよ。',
    ],
    explain:
      'てを あらう ときは、はじめに みずで てを ぬらすよ。ふくのは さいご、ながすのは せっけんの あとだね。',
  }),
  choiceItem({
    id: 'daily-alt-hamigaki-mae',
    obj: 'daily',
    level: 1,
    alt: true,
    prompt: 'はぶらしに はみがきこを つけるのは、はを みがく まえかな、あとかな。',
    right: 'みがく まえ',
    wrongs: [['みがいた あと', 'order']],
    hints: [
      'はを みがく とき、はぶらしは なにを つけて いるかな。',
      'みがきながら つける ことは むずかしいね。',
      'はみがきこを つけてから、はぶらしを はに あてるよ。',
    ],
    explain:
      'はぶらしに はみがきこを つけてから、はを みがくよ。つけてから みがくから、はが きれいに なるんだね。',
  }),
  choiceItem({
    id: 'daily-alt-kutsu-mae',
    obj: 'daily',
    level: 0,
    alt: true,
    prompt: 'そとへ でる まえに することは どれかな。',
    right: 'くつを はく',
    wrongs: [
      ['そとから かえる', 'order'],
      ['そとで あそぶ', 'order'],
    ],
    hints: [
      'そとへ でる ところを おもいうかべよう。',
      'そとへ でる まえに、あしに つける ものが あるね。',
      'いえの なかで できる ことは どれかな。',
    ],
    explain: 'そとへ でる まえに、くつを はくよ。そとへ でた あとの ことは、あとで おこるね。',
  }),
];

// ---- move: 札を並べてキャラを動かす ----
type M = [id: string, level: number, dir: Dir, rows: string[]];
const MOVES: M[] = [
  ['m1', 0, 'right', ['S...G']],
  ['m2', 0, 'down', ['S.', '..', 'G.']],
  ['m3', 0, 'right', ['S..', '..G']],
  ['m9', 0, 'up', ['S..G']],
  ['m4', 1, 'up', ['...G', '....', 'S...']],
  ['m5', 1, 'up', ['G..', '...', '..S']],
  ['m7', 1, 'up', ['.#G', 'S..']],
  ['m6', 2, 'down', ['S#G', '...']],
  ['m8', 2, 'right', ['S...#', '.##.G']],
  ['m10', 2, 'right', ['G..', '##.', 'S..']],
];
const moveItems = MOVES.map(([id, level, dir, rows]) =>
  puzzle({ id: `move-${id}`, obj: 'move', level, rows, dir, mis: MIS, why: WHY }),
);

// 別例: どこに つくかを選ぶ
const LANDING = [
  landingItem({
    id: 'move-alt-ln1',
    obj: 'move',
    level: 0,
    alt: true,
    rows: ['S...', '....', '....'],
    dir: 'right',
    prog: [{ op: 'forward' }, { op: 'forward' }, { op: 'turnRight' }, { op: 'forward' }],
    mis: { turn: 'turn', short: 'short', count: 'miscount' },
  }),
  landingItem({
    id: 'move-alt-ln2',
    obj: 'move',
    level: 1,
    alt: true,
    rows: ['....', '....', 'S...'],
    dir: 'up',
    prog: [
      { op: 'forward' },
      { op: 'forward' },
      { op: 'turnRight' },
      { op: 'forward' },
      { op: 'forward' },
    ],
    mis: { turn: 'turn', short: 'short', count: 'miscount' },
  }),
  landingItem({
    id: 'move-alt-ln3',
    obj: 'move',
    level: 2,
    alt: true,
    rows: ['....', 'S...', '....', '....'],
    dir: 'right',
    prog: [
      { op: 'forward' },
      { op: 'turnRight' },
      { op: 'forward' },
      { op: 'forward' },
      { op: 'turnLeft' },
      { op: 'forward' },
    ],
    mis: { turn: 'turn', short: 'short', count: 'miscount' },
  }),
];

// ---- change: じゅんばんを かえると けっかが かわる ----
// 札はそろっているのに順番だけがちがう手順が最初から ならんでいる。ならべかえて ゴールに つかせる。
type C = [id: string, level: number, dir: Dir, rows: string[]];
const COMPARES: C[] = [
  ['c1', 1, 'right', ['S..', '..G']],
  ['c2', 1, 'right', ['..G', '...', 'S..']],
  ['c3', 1, 'down', ['S.', '..', '.G']],
  ['c4', 2, 'left', ['..S', '...', 'G..']],
  ['c5', 2, 'down', ['S#G', '...']],
  ['c6', 2, 'up', ['.#G', 'S..']],
];
const compareItems = COMPARES.map(([id, level, dir, rows]) => {
  const l = layout(rows, dir);
  const sol = shortest(l)!;
  // となりあう違う札を入れかえて、ゴールに着かなくなる最初の組
  let initial: Cmd[] | null = null;
  for (let i = 0; i + 1 < sol.length && !initial; i++)
    if (sol[i]!.op !== sol[i + 1]!.op) {
      const q = [...sol];
      [q[i], q[i + 1]] = [q[i + 1]!, q[i]!];
      if (!reaches(l, q)) initial = q;
    }
  if (!initial) throw new Error(`change-${id}: 入れかえられる札が無い`);
  return puzzle({
    id: `change-${id}`,
    obj: 'change',
    level,
    rows,
    dir,
    solution: sol,
    initial,
    lead: 'ふだの じゅんばんが ちがう てじゅんが ならんでいるよ。ならべかえて、ゴールまで いこう。',
    hints: [
      'うごかして、どこで ゴールから はなれるか みよう。',
      'ふだは ぜんぶ そろっているよ。じゅんばんだけ ちがうよ。',
      'まがる ふだは、まがりたい ばしょに ついてから おくように ならべよう。',
    ],
    why: WHY,
    mis: MIS,
  });
});
const ORDERS = [
  orderItem({
    id: 'change-alt-o1',
    obj: 'change',
    level: 1,
    alt: true,
    rows: ['S..', '..G'],
    dir: 'right',
    mis: { order: 'order' },
  }),
  orderItem({
    id: 'change-alt-o2',
    obj: 'change',
    level: 1,
    alt: true,
    rows: ['S.', '.G'],
    dir: 'right',
    mis: { order: 'order' },
  }),
  orderItem({
    id: 'change-alt-o3',
    obj: 'change',
    level: 2,
    alt: true,
    rows: ['..G', '...', 'S..'],
    dir: 'right',
    mis: { order: 'order' },
  }),
];

const items: Item[] = [
  ...DAILY.map(dailyItem),
  ...DAILY_ALT,
  ...moveItems,
  ...LANDING,
  ...compareItems,
  ...ORDERS,
];

const introGrid = gridFigure(layout(['S..', '..G'], 'right'), {
  label: 'ますの ず。ほしが ゴール',
});

export const sequence: UnitSpec = {
  ...baseUnit('g1.prog.sequence', 'g1'),
  title: 'じゅんばんに ならべよう',
  prereq: [],
  objectives: [
    { id: 'daily', title: 'せいかつの てじゅんを じゅんばんに ならべる' },
    { id: 'move', title: 'ふだを ならべて キャラクターを うごかす' },
    { id: 'change', title: 'ふだの じゅんばんを かえると けっかが かわる' },
  ],
  misconceptions: [
    ...BASE_MIS,
    {
      id: 'order',
      explain: 'じゅんばんが ちがったのかな。さきに する ことから、じゅんに ならべて みよう。',
    },
    {
      id: 'miscount',
      explain: 'マスの かずを かぞえまちがえたのかな。ふだを ひとつずつ ゆびで たどって みよう。',
    },
  ],
  levels: [
    { label: 'まっすぐと ひとつ まがる', chance: 0.1 },
    { label: 'なんかい か まがる', chance: 0.1 },
    { label: 'かべを よけて すすむ', chance: 0.1 },
  ],
  intro: [
    {
      text: 'ふだを じゅんばんに ならべると、キャラクターが その とおりに うごくよ。',
      figure: introGrid,
    },
    {
      text: '「すすむ」は まえに ひとマス。「みぎを むく」は、その ばしょで みぎを むくだけだよ。',
      figure: { kind: 'text', text: 'すすむ、すすむ、みぎを むく、すすむ', size: 'l' },
    },
    {
      text: 'ふだの じゅんばんを かえると、つく ばしょも かわるよ。ゴールに つく じゅんばんを みつけよう。',
    },
  ],
  source: { kind: 'items', items },
  basis:
    '小学校学習指導要領（平成29年告示）総則 第3の1(3)イ（プログラミングを体験しながら論理的思考力を身に付ける学習活動）、小学校プログラミング教育の手引（第三版）プログラミング的思考（動きの組合せ＝順序）。学年の割当は本アプリの案',
  gradeIsAppProposal: true,
};
