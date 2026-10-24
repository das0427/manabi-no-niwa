/**
 * g3.prog.decompose 分解: 大きな仕事を小さな手順に分ける（curriculum-matrix 3.5、手引: 分解・EOS 7.2）。
 *
 * 到達項目:
 *   split-daily … 生活の大きな仕事を、まとまりに分ける（sort）。別例 = まとまりを順に並べる（order）
 *   split-route … 長い道のりを、まがりかどで区切った「ぶぶんの道」の手順を作る（program）。別例 = ぶぶんの手順を選ぶ（choice）
 *   join        … ぶぶんごとに考えた手順をつなげて、道のりぜんぶを1つの手順にする（program）。別例 = つなげた手順でどこに着くか
 * 同一性キー: 問題の id。
 * ぶぶんの道は、全体の道を同じ地図のまま、はじめとゴールだけを区切りの場所に置きかえて作る
 * （前のぶぶんの終わりの向きを、次のぶぶんの はじめの向きにする）。
 */
import type { Item, NumberItem, OrderItem, SortItem, UnitSpec } from '../../curriculum/types';
import {
  baseUnit,
  BASE_MIS,
  cardCount,
  compressRuns,
  F,
  gridFigure,
  landingItem,
  layout,
  mirrorH,
  puzzle,
  R,
  rep,
  L,
  run,
  shortest,
  type Cell,
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

// ---- split-daily ----
interface Sd {
  id: string;
  level: number;
  topic: string;
  boxes: [string, string, string];
  cards: [string, string][]; // [カード, 箱の番号(0..2) の文字]
}
const SORTS: Sd[] = [
  {
    id: 'sandwich',
    level: 0,
    topic: 'サンドイッチを つくる',
    boxes: ['じゅんび', 'つくる', 'かたづけ'],
    cards: [
      ['てを あらう', '0'],
      ['ざいりょうを だす', '0'],
      ['パンに ぐを のせる', '1'],
      ['パンを かさねる', '1'],
      ['おさらを あらう', '2'],
      ['ざいりょうを しまう', '2'],
    ],
  },
  {
    id: 'souji',
    level: 0,
    topic: 'へやを そうじする',
    boxes: ['じゅんび', 'そうじ', 'かたづけ'],
    cards: [
      ['まどを あける', '0'],
      ['ものを ゆかから ひろう', '0'],
      ['ほうきで はく', '1'],
      ['ぞうきんで ふく', '1'],
      ['ごみを すてる', '2'],
      ['ほうきを しまう', '2'],
    ],
  },
  {
    id: 'ensoku',
    level: 0,
    topic: 'えんそくに いく',
    boxes: ['まえの ひ', 'あさ', 'かえってから'],
    cards: [
      ['てんきを しらべる', '0'],
      ['もちものを そろえる', '0'],
      ['おべんとうを もつ', '1'],
      ['ぼうしを かぶる', '1'],
      ['てを あらう', '2'],
      ['にもつを かたづける', '2'],
    ],
  },
  {
    id: 'uekibachi',
    level: 1,
    topic: 'はなを うえる',
    boxes: ['じゅんび', 'うえる', 'せわ'],
    cards: [
      ['うえきばちを よういする', '0'],
      ['つちを よういする', '0'],
      ['つちを いれる', '1'],
      ['なえを うえる', '1'],
      ['みずを やる', '2'],
      ['ひなたに おく', '2'],
    ],
  },
  {
    id: 'kamishibai',
    level: 1,
    topic: 'かみしばいを つくる',
    boxes: ['かんがえる', 'かく', 'しあげ'],
    cards: [
      ['おはなしを かんがえる', '0'],
      ['えの かずを きめる', '0'],
      ['えを かく', '1'],
      ['いろを ぬる', '1'],
      ['じゅんばんに ならべる', '2'],
      ['みんなに みせる', '2'],
    ],
  },
  {
    id: 'asobu',
    level: 1,
    topic: 'ともだちと あそぶ',
    boxes: ['まえ', 'あそぶ', 'おわり'],
    cards: [
      ['いつ あそぶか きめる', '0'],
      ['おうちの ひとに つたえる', '0'],
      ['ルールを きめる', '1'],
      ['なかよく あそぶ', '1'],
      ['おもちゃを かたづける', '2'],
      ['「ありがとう」と いう', '2'],
    ],
  },
];
/** 画面に入るよう、カードは 4枚（どの まとまりにも 1枚は ある）。文字の 少ないものを えらぶ */
function shownCards(cards: [string, string][]): [string, string][] {
  const need = new Set<number>();
  [0, 1, 2].forEach((b) => {
    const at = cards
      .map((c, i) => ({ i, c }))
      .filter((x) => Number(x.c[1]) === b)
      .sort((p, q) => p.c[0].length - q.c[0].length)[0];
    if (at) need.add(at.i);
  });
  const rest = cards
    .map((c, i) => ({ i, c }))
    .filter((x) => !need.has(x.i))
    .sort((p, q) => p.c[0].length - q.c[0].length);
  while (need.size < 4 && rest.length) need.add(rest.shift()!.i);
  return cards.filter((_, i) => need.has(i));
}
const sortItems = SORTS.map(
  (s0): SortItem => {
    const s = { ...s0, cards: shownCards(s0.cards as [string, string][]) };
    return {
    engine: 'sort',
    id: `daily-${s.id}`,
    objective: 'split-daily',
    level: s.level,
    prompt: `「${s.topic}」を 3つに わけよう。`,
    boxes: s.boxes.map((label) => ({ label })),
    cards: s.cards.map(([label, b]) => {
      const box = Number(b);
      return {
        label,
        box,
        wrongBoxes: [0, 1, 2]
          .filter((x) => x !== box)
          .map((x) => ({ box: x, misconception: 'split-mix' })),
      };
    }),
    hints: [
      `「${s.topic}」を はじめから おわりまで じゅんに おもいうかべよう。`,
      'おなじ ねらいの しごとを ひとつの まとまりに しよう。',
      `「${s.boxes[0]}」は はじめの まとまり、「${s.boxes[1]}」は まんなか、「${s.boxes[2]}」は さいごの まとまりだよ。`,
    ],
    explain: `${s.boxes.map((b, i) => `「${b}」は ${s.cards.filter(([, x]) => Number(x) === i).map(([c]) => c).join('、')}`).join('。')}。おおきな しごとは、ちいさな まとまりに わけると かんがえやすいね。`,
    identity: `daily-${s.id}`,
    };
  },
);

interface Od {
  id: string;
  level: number;
  topic: string;
  parts: [string, string, string, string];
  hints: [string, string, string];
}
const ORDERS: Od[] = [
  {
    id: 'bento',
    level: 0,
    topic: 'おべんとうを つくる',
    parts: ['ざいりょうを じゅんびする', 'おかずを つくる', 'ごはんと おかずを つめる', 'かたづける'],
    hints: [
      'おおきな しごとの はじまりは なにかな。',
      'つめる まえに、おかずが できて いないと いけないね。',
      'ざいりょうが ないと、おかずは つくれないね。さいごは おわりの しごとだよ。',
    ],
  },
  {
    id: 'party',
    level: 0,
    topic: 'おたんじょうかいを ひらく',
    parts: ['なにを するか かんがえる', 'かざりと おやつを よういする', 'みんなで たのしむ', 'かたづける'],
    hints: [
      'パーティーの まえと あとに することを わけて みよう。',
      'たのしむ のは、よういが おわって からだね。',
      'まず かんがえて、つぎに よういする。さいごは おわりの しごとだよ。',
    ],
  },
  {
    id: 'hakase',
    level: 1,
    topic: 'しらべた ことを はっぴょうする',
    parts: ['しらべる', 'まとめる', 'はっぴょうの じゅんびを する', 'はっぴょうする'],
    hints: [
      'しらべて いない ことは、まとめられないね。',
      'はっぴょうする のは、じゅんびが できて からだよ。',
      'しらべる、まとめる、の つぎに じゅんびを する。いちばん さいごは みんなに つたえる ときだよ。',
    ],
  },
];
const orderItems = ORDERS.map(
  (o): OrderItem => ({
    engine: 'order',
    id: `daily-alt-${o.id}`,
    objective: 'split-daily',
    level: o.level,
    alt: true,
    prompt: `「${o.topic}」を 4つの まとまりに わけたよ。じゅんばんに ならべよう。`,
    cards: o.parts.map((label) => ({ label })),
    layout: 'column',
    ends: ['はじめ', 'おわり'],
    reverseMisconception: 'order',
    hints: o.hints,
    explain: `${o.parts.join('、')}の じゅんだよ。まとまりごとに じゅんばんを かんがえると、おおきな しごとも すすめやすいね。`,
    identity: `daily-alt-${o.id}`,
  }),
);

// ---- 道のり ----
interface Route {
  id: string;
  dir: Dir;
  rows: string[];
  /** 区切りの場所（はじめとゴールの間） */
  marks: Cell[];
}
const ROUTES: Route[] = [
  { id: 'ra', dir: 'right', rows: ['S....', '####.', 'G....'], marks: [[4, 0], [4, 2]] },
  { id: 'rb', dir: 'right', rows: ['S.....', '#####.', '.....G'], marks: [[5, 0]] },
  { id: 'rc', dir: 'right', rows: ['S..###', '##.###', '##...G'], marks: [[2, 0], [2, 2]] },
  { id: 'rd', dir: 'right', rows: ['G....', '####.', 'S....'], marks: [[4, 2], [4, 0]] },
];

function put(rows: readonly string[], at: Cell, ch: string): string[] {
  return rows.map((r, y) => (y === at[1] ? r.slice(0, at[0]) + ch + r.slice(at[0] + 1) : r));
}

/** 全体の地図から、S と G を取りのぞいた床と壁だけの地図 */
function floor(rows: readonly string[]): string[] {
  return rows.map((r) => r.replace(/[SG]/g, '.'));
}
function cellOf(rows: readonly string[], ch: string): Cell {
  for (let y = 0; y < rows.length; y++) {
    const x = rows[y]!.indexOf(ch);
    if (x >= 0) return [x, y];
  }
  throw new Error('地図に印が無い');
}

interface Seg {
  rows: string[];
  dir: Dir;
  from: Cell;
  to: Cell;
}
function segments(r: Route): Seg[] {
  const start = cellOf(r.rows, 'S');
  const goal = cellOf(r.rows, 'G');
  const pts = [start, ...r.marks, goal];
  const out: Seg[] = [];
  let dir = r.dir;
  for (let i = 0; i + 1 < pts.length; i++) {
    const rows = put(put(floor(r.rows), pts[i]!, 'S'), pts[i + 1]!, 'G');
    const sol = shortest(layout(rows, dir));
    if (!sol) throw new Error(`${r.id}: ${i + 1}つめのぶぶんに道が無い`);
    out.push({ rows, dir, from: pts[i]!, to: pts[i + 1]! });
    dir = run(layout(rows, dir), sol).dir;
  }
  return out;
}

const NTH = ['1つめ', '2つめ', '3つめ'];
const routeItems = ROUTES.flatMap((r, ri) => {
  const segs = segments(r);
  return segs.map((s, i) =>
    puzzle({
      id: `route-${r.id}-${i + 1}`,
      obj: 'split-route',
      level: ri < 2 ? 1 : 2,
      rows: s.rows,
      dir: s.dir,
      lead: `${segs.length}つの ぶぶんの ${NTH[i]}の ぶぶん。ほしまで いこう。`,
      hints: [
        'ほしの ところまで だけを かんがえよう。ぜんぶの みちは かんがえなくて いいよ。',
        'まっすぐ すすむ ところと、まがる ところに わけて みよう。',
        i === 0
          ? 'はじめの ぶぶんは、いまの むきから かんがえよう。'
          : 'まえの ぶぶんが おわった ときの むきから、はじまるよ。',
      ],
      why: 'ながい みちも、まがりかどで ぶぶんに わけると、ひとつずつ かんがえやすいね。',
      mis: MIS,
    }),
  );
});

// 別例: ぶぶんの みちで「すすむ」が なんかい いるか数える
function partCount(id: string, level: number, r: Route, upTo: number): NumberItem {
  const start = cellOf(r.rows, 'S');
  const target = r.marks[upTo]!;
  const rows = put(put(floor(r.rows), start, 'S'), target, 'G');
  const l = layout(rows, r.dir);
  const sol = shortest(l)!;
  const forwards = sol.filter((c) => c.op === 'forward').length;
  return {
    engine: 'number',
    id: `route-alt-${id}`,
    objective: 'split-route',
    level,
    alt: true,
    prompt: 'みちを ふたつに わけたよ。はじめから ほしの ところまで、「すすむ」の ふだは ぜんぶで なんかい いるかな。',
    figure: gridFigure(l, { label: 'ますの ず。ほしが ゴール', hU: 9 }),
    fields: [{ label: 'かい', answer: { kind: 'int', value: forwards } }],
    wrongAnswers: [
      { value: String(sol.length), misconception: 'count-turn' },
      { value: String(forwards - 1), misconception: 'count-miss' },
      { value: String(forwards + 1), misconception: 'count-miss' },
    ].filter((w, i, a) => w.value !== String(forwards) && a.findIndex((x) => x.value === w.value) === i),
    hints: [
      'はじめの やじるしから、ほしまで ゆびで たどろう。',
      'マスを ひとつ すすむ ごとに「すすむ」を 1かい つかうよ。まがる ところは すすまないよ。',
      'まがりかどで わけて、まっすぐな ぶぶんごとに マスを 数《かぞ》えて たそう。',
    ],
    explain: `ほしまで ${forwards}マス すすむから「すすむ」は ${forwards}かい。まがる ふだは マスを すすまないから、かぞえないよ。`,
    identity: `route-alt-${id}`,
  };
}
const partAlts = [
  partCount('a1', 1, ROUTES[0]!, 1),
  partCount('a2', 2, ROUTES[2]!, 1),
  partCount('a3', 2, ROUTES[3]!, 1),
];
// ---- join ----
const JOINS: { id: string; dir: Dir; rows: string[] }[] = [
  { id: 'j1', dir: 'right', rows: ['S....', '####.', 'G....'] },
  { id: 'j2', dir: 'right', rows: ['S.....', '#####.', '.....G'] },
  { id: 'j3', dir: 'right', rows: ['S..###', '##.###', '##...G'] },
  { id: 'j4', dir: 'right', rows: ['G....', '####.', 'S....'] },
  { id: 'j5', dir: 'left', rows: mirrorH(['S....', '####.', 'G....']) },
  { id: 'j6', dir: 'right', rows: ['S....', '####.', '.....', '.####', '....G'] },
  { id: 'j7', dir: 'right', rows: ['S.###', '#..##', '##..G'] },
];
const joinItems = JOINS.map((j) => {
  const l = layout(j.rows, j.dir);
  const raw = shortest(l)!;
  const sol = compressRuns(raw);
  const parts = raw.filter((c) => c.op !== 'forward').length + 1;
  const maxCards = cardCount(sol);
  return puzzle({
    id: `join-${j.id}`,
    obj: 'join',
    level: 2,
    rows: j.rows,
    dir: j.dir,
    solution: sol,
    palette: ['forward', 'turnRight', 'turnLeft', 'repeat'],
    repeatTimes: [2, 3, 4, 5, 6],
    maxCards,
    lead: 'にもつを ぜんぶ とどけよう。ぶぶんを つなげよう。',
    hints: [
      'まがりかどで みちを ぶぶんに わけて みよう。',
      `この みちは ${parts}つの ぶぶんに わけられるよ。まっすぐ すすむ ぶぶんは「くりかえす」で まとめよう。`,
      'ぶぶんの てじゅんを、はじめの ほうから じゅんに つなげて ならべよう。',
    ],
    why: 'ぶぶんごとに かんがえた てじゅんを つなげると、ながい みちも ひとつの てじゅんで いけるよ。',
    mis: MIS,
  });
});

// 別例: つなげた手順でどこに着くか
function joinLanding(
  id: string,
  level: number,
  dir: Dir,
  rows: string[],
  parts: Cmd[][],
) {
  return landingItem({
    id: `join-alt-${id}`,
    obj: 'join',
    level,
    alt: true,
    rows,
    dir,
    prog: parts.flat(),
    promptHead: `${parts.length}つの てじゅんを つなげたよ。どこに つくかな。`,
    mis: { turn: 'forget-turn', short: 'short', count: 'repeat-count' },
    hints: [
      'てじゅん A から じゅんに たどろう。',
      'てじゅんと てじゅんの つなぎめで、キャラクターの むきが かわって いることに きを つけよう。',
      'ひとつの てじゅんが おわった ところから、つぎの てじゅんが はじまるよ。',
    ],
  });
}
const joinAlts = [
  joinLanding('a1', 0, 'right', ['......', '......', 'S.....', '......', '......'], [[rep(3, F)], [R], [F, F]]),
  joinLanding('a2', 1, 'up', ['.....', '.....', '.....', '.....', 'S....'], [[rep(2, F)], [R], [rep(3, F)]]),
  joinLanding('a3', 2, 'right', ['......', 'S.....', '......', '......'], [[F, F], [R], [F, F], [L], [F]]),
];

const items: Item[] = [
  ...sortItems,
  ...orderItems,
  ...routeItems,
  ...partAlts,
  ...joinItems,
  ...joinAlts,
];

const introRoute = gridFigure(layout(['S....', '####.', 'G....'], 'right'), {
  label: 'ますの ず。ほしが ゴール。みちは 3つの ぶぶんに わけられる',
});

export const decompose: UnitSpec = {
  ...baseUnit('g3.prog.decompose', 'g3'),
  title: 'ちいさく わけよう',
  prereq: ['g2.prog.debug'],
  objectives: [
    { id: 'split-daily', title: 'おおきな しごとを まとまりに わける' },
    { id: 'split-route', title: 'ながい みちを ぶぶんに わけて てじゅんを つくる' },
    { id: 'join', title: 'ぶぶんの てじゅんを つなげる' },
  ],
  misconceptions: [
    ...BASE_MIS,
    {
      id: 'split-mix',
      explain:
        'べつの まとまりに いれたのかな。おなじ ねらいの しごとを あつめて、はじめ・まんなか・おわりの まとまりに わけよう。',
    },
    {
      id: 'order',
      explain:
        'じゅんばんが ちがったのかな。まえの まとまりが おわってから、つぎの まとまりを するよ。',
    },
    {
      id: 'count-turn',
      explain:
        'まがる ふだも かぞえたのかな。「すすむ」の ふだだけを かぞえよう。まがる ふだは マスを すすまないよ。',
    },
    {
      id: 'count-miss',
      explain:
        'マスの 数《かず》を かぞえまちがえたのかな。やじるしから ゆびで ひとつずつ たどって、かぞえなおそう。',
    },
    {
      id: 'forget-turn',
      explain:
        'ぶぶんと ぶぶんの つなぎめで、むきが かわる ことを わすれたのかな。まえの てじゅんが おわった ときの むきから、つぎが はじまるよ。',
    },
    {
      id: 'repeat-count',
      explain: '「くりかえす」の かいすうを かぞえまちがえたのかな。マスを ひとつずつ たどって たしかめよう。',
    },
    {
      id: 'too-many',
      explain:
        'ふだが おおすぎたのかな。まっすぐ すすむ ぶぶんを「くりかえす」で まとめると、ふだが へるよ。',
    },
  ],
  levels: [
    { label: 'せいかつの しごとを わける', chance: 0.1 },
    { label: 'みちを ぶぶんに わける', chance: 0.1 },
    { label: 'ぶぶんを つなげる', chance: 0.1 },
  ],
  intro: [
    {
      text: 'おおきな しごとは、ちいさな まとまりに わけると かんがえやすいよ。「サンドイッチを つくる」は、じゅんび・つくる・かたづけ、に わけられるね。',
      figure: { kind: 'text', text: 'じゅんび → つくる → かたづけ', size: 'l' },
    },
    {
      text: 'ながい みちも、まがりかどで 3つの ぶぶんに わけて かんがえよう。',
      figure: introRoute,
    },
    {
      text: 'ぶぶんごとに てじゅんを つくって、さいごに つなげると、ぜんぶの みちを いけるよ。',
    },
  ],
  source: { kind: 'items', items },
  basis:
    '小学校学習指導要領（平成29年告示）総則 第3の1(3)イ、小学校プログラミング教育の手引（第三版）プログラミング的思考（動きの分割・組合せ）。学年の割当は本アプリの案',
  gradeIsAppProposal: true,
};





