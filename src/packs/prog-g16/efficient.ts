/**
 * g6.prog.efficient よりよい手順: 手順の比較・並べ替えの手順（curriculum-matrix 3.8、手引）。
 *
 * 到達項目:
 *   fewer-cards … 札の数が少ない手順で動かす。くりかえしの中のくりかえしも使う（program: 札の数の上限は ぎりぎり）。
 *                 別例 = 同じ動きの短い書き方を選ぶ（choice）
 *   fewer-moves … ゴールに着く手順を、札の数・すすむマスの数でくらべて、よりよいものを選ぶ（choice）。別例 = 数を数える（number）
 *   sort-steps  … カードを小さい順に並べる2つの手順の「くらべる回数」をくらべる（choice。回数は手順どおりに計算して決める）。
 *                 別例 = 手順の文を正しい順に並べる（order）
 * 同一性キー: 問題の id。
 */
import type { ChoiceItem, Item, NumberItem, OrderItem, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import {
  baseUnit,
  BASE_MIS,
  bestChoice,
  cardCount,
  fasterChoice,
  choiceItem,
  stripChoice,
  stripFigure,
  F,
  flat,
  gridFigure,
  L,
  layout,
  puzzle,
  R,
  rep,
  run,
  shortest,
  type Cmd,
  type Dir,
  type ProgMis,
} from './kit';
import { PALETTE, rule, sp, TIMES } from './condition-combo';
import { stair } from './repeat';

const MIS: ProgMis = {
  bump: 'bump',
  short: 'short',
  turn: 'turn',
  repeatCount: 'repeat-count',
  tooMany: 'too-many',
};

// ---- fewer-cards ----
/** 行ったり来たりの道（k+1 マスのよこ線を lines 本。つなぎは たて 2 マス） */
function serpentine(k: number, lines: number) {
  const w = k + 1;
  const h = (lines - 1) * 2 + 1;
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    if (y % 2 === 0) {
      let row = '.'.repeat(w);
      if (y === 0) row = 'S' + row.slice(1);
      if (y === h - 1) {
        const goalX = (lines - 1) % 2 === 0 ? w - 1 : 0;
        row = row.slice(0, goalX) + 'G' + row.slice(goalX + 1);
      }
      rows.push(row);
    } else {
      const openX = ((y - 1) / 2) % 2 === 0 ? w - 1 : 0;
      rows.push([...'#'.repeat(w)].map((c, x) => (x === openX ? '.' : c)).join(''));
    }
  }
  return rows;
}
interface Fc {
  id: string;
  level: number;
  rows: string[];
  dir: Dir;
  sol: Cmd[];
  times?: (number | 'goal')[];
  withIf?: boolean;
}
const st5 = stair(5, 1, 1);
const st3b = stair(3, 2, 1);
const st3c = stair(3, 1, 2, true);
const st5v = stair(5, 1, 1, true);
const zig = serpentine(3, 4);
const FC: Fc[] = [
  { id: 'e1', level: 0, rows: st5.rows, dir: st5.dir, sol: st5.sol },
  { id: 'e2', level: 0, rows: ['S.......'.slice(0, 7) + 'G'], dir: 'right', sol: [rep(7, F)] },
  {
    id: 'e3',
    level: 0,
    rows: ['S.....', '#####.', '#####.', '#####G'],
    dir: 'right',
    sol: [rep(5, F), R, rep(3, F)],
  },
  { id: 'e4', level: 1, rows: st3b.rows, dir: st3b.dir, sol: st3b.sol },
  { id: 'e5', level: 1, rows: st3c.rows, dir: st3c.dir, sol: st3c.sol },
  { id: 'e6', level: 2, rows: sp(7, 7).rows, dir: 'right', sol: rule('R'), times: TIMES, withIf: true },
  { id: 'e7', level: 2, rows: sp(8, 6, true).rows, dir: 'left', sol: rule('L'), times: TIMES, withIf: true },
  { id: 'e8', level: 2, rows: st5v.rows, dir: st5v.dir, sol: st5v.sol },
  {
    id: 'e9',
    level: 2,
    rows: zig,
    dir: 'right',
    sol: [rep(2, rep(3, F), R, F, F, R, rep(3, F), L, F, F, L)],
  },
];
const fcItems = FC.map((f) => {
  const l = layout(f.rows, f.dir);
  const raw = shortest(l)!;
  const max = cardCount(f.sol);
  if (raw.length <= max) throw new Error(`${f.id}: くりかえしを使わなくても解ける`);
  return puzzle({
    id: `cards-${f.id}`,
    obj: 'fewer-cards',
    level: f.level,
    rows: f.rows,
    dir: f.dir,
    solution: f.sol,
    palette: f.withIf ? PALETTE : ['forward', 'turnRight', 'turnLeft', 'repeat'],
    repeatTimes: f.times ?? [2, 3, 4, 5, 6, 7],
    ...(f.withIf ? { conds: ['wall-ahead', 'open-ahead'] as ('wall-ahead' | 'open-ahead')[] } : {}),
    maxCards: max,
    hints: [
      'おなじ ならびが なんかい でてくるか さがそう。「くりかえす」の 中《なか》に「くりかえす」を 入《い》れても いいよ。',
      `ふだは ${max}まい ぴったりまで。「くりかえす」も 1まいと 数《かぞ》えるよ。さいしょの かたまりが どこまで か 考《かんが》えよう。`,
      f.withIf
        ? 'かべの まえで まがる ことを ずっと くりかえす きまりを つかうと、4まいで いけるよ。'
        : '何《なん》かい くりかえす ひとまとまりを、みちから みつけよう。',
    ],
    why: 'くりかえしの 中《なか》に くりかえしを 入《い》れたり、「もし」を つかったりすると、もっと すくない ふだで 手順《てじゅん》を かけるよ。',
    mis: MIS,
  });
});

// 別例: 同じ動きの短い書き方を選ぶ
const text = (c: Cmd): string => {
  if (c.op === 'repeat') return `くりかえす ${c.times}かい（${c.body.map(text).join('、')}）`;
  return c.op === 'forward' ? 'すすむ' : c.op === 'turnRight' ? 'みぎを むく' : c.op === 'turnLeft' ? 'ひだりを むく' : c.op;
};
interface Eq {
  id: string;
  level: number;
  long: Cmd[];
  right: Cmd[];
  wrongs: [Cmd[], string][];
}
const EQ: Eq[] = [
  {
    id: 'a1',
    level: 0,
    long: [F, F, F, R, F, F, F, R, F, F, F, R],
    right: [rep(3, rep(3, F), R)],
    wrongs: [
      [[rep(3, rep(2, F), R)], 'repeat-body'],
      [[rep(4, rep(3, F), R)], 'repeat-count'],
    ],
  },
  {
    id: 'a2',
    level: 1,
    long: [F, R, F, R, F, R, F, R, F, R, F, R],
    right: [rep(2, rep(3, F, R))],
    wrongs: [
      [[rep(2, rep(3, F), R)], 'repeat-body'],
      [[rep(2, rep(2, F, R))], 'repeat-count'],
    ],
  },
  {
    id: 'a3',
    level: 2,
    long: [F, F, L, F, F, L, F, F, R, F, F, R],
    right: [rep(2, F, F, L), rep(2, F, F, R)],
    wrongs: [
      [[rep(2, F, F, R), rep(2, F, F, L)], 'repeat-body'],
      [[rep(2, F, F, L), rep(2, F, R)], 'repeat-body'],
    ],
  },
];
const eqItems: ChoiceItem[] = EQ.map((q) => {
  const lf = flat(q.long).join();
  if (flat(q.right).join() !== lf) throw new Error(`${q.id}: 正解が同じ動きでない`);
  for (const [w] of q.wrongs) if (flat(w).join() === lf) throw new Error(`${q.id}: 誤りが同じ動き`);
  const tx = (p: Cmd[]) => p.map(text).join('、');
  return stripChoice({
    id: `cards-alt-${q.id}`,
    obj: 'fewer-cards',
    level: q.level,
    alt: true,
    prompt: 'おなじ うごきに なる、いちばん みじかい てじゅんは？',
    given: q.long,
    right: q.right,
    wrongs: q.wrongs,
    hints: [
      'おなじ ならびが なんかい でてくるか 数《かぞ》えよう。',
      'そのなかで、さらに おなじ ならびが つづく ところが あるよ。',
      '外《そと》の「くりかえす」と、中《なか》の「くりかえす」の かいすうを かけて、ぜんぶの 数《かず》に なるか たしかめよう。',
    ],
    explain: `「${tx(q.right)}」を ひらくと、もとの 手順《てじゅん》と おなじ うごきに なるよ。`,
  });
});// ---- fewer-moves ----
/** 上のまっすぐな道・まんなかの道・下の道が ある地図（よこ w マス、たて 5 マス）。A・B・C の 3つの みち */
function around3(w: number): string[] {
  return [
    'S' + '.'.repeat(w - 2) + 'G',
    '.' + '#'.repeat(w - 2) + '.',
    '.'.repeat(w),
    '.' + '#'.repeat(w - 2) + '.',
    '.'.repeat(w),
  ];
}
const routes3 = (w: number) => ({
  top: [rep(w - 1, F)] as Cmd[],
  mid: [R, rep(2, F), L, rep(w - 1, F), L, rep(2, F)] as Cmd[],
  low: [R, rep(4, F), L, rep(w - 1, F), L, rep(4, F)] as Cmd[],
});
const st2 = stair(2, 1, 1);
const U = ['S.....', '#####.', '#####.', '#####G'];
const fmMoves: ChoiceItem[] = [
  { id: 'v1', level: 1, w: 5, order: ['mid', 'top', 'low'] },
  { id: 'v2', level: 1, w: 6, order: ['top', 'low', 'mid'] },
  { id: 'v3', level: 2, w: 7, order: ['low', 'mid', 'top'] },
  { id: 'v4', level: 2, w: 8, order: ['mid', 'low', 'top'] },
].map((c) => {
  const r = routes3(c.w);
  return fasterChoice({
    id: `moves-${c.id}`,
    obj: 'fewer-moves',
    level: c.level,
    rows: around3(c.w),
    dir: 'right',
    progs: (c.order as ('top' | 'mid' | 'low')[]).map((k) => ({ prog: r[k], mis: 'not-fastest' })),
  });
});
const fmCards: ChoiceItem[] = [
  bestChoice({
    id: 'moves-v5',
    obj: 'fewer-moves',
    level: 1,
    rows: st2.rows,
    dir: st2.dir,
    progs: [
      { prog: st2.sol, mis: '' },
      { prog: shortest(layout(st2.rows, st2.dir))!, mis: 'not-shortest' },
    ],
  }),
  bestChoice({
    id: 'moves-v6',
    obj: 'fewer-moves',
    level: 2,
    rows: U,
    dir: 'right',
    progs: [
      { prog: shortest(layout(U, 'right'))!, mis: 'not-shortest' },
      { prog: [rep(5, F), R, rep(3, F)], mis: '' },
    ],
  }),
  bestChoice({
    id: 'moves-v7',
    obj: 'fewer-moves',
    level: 2,
    rows: sp(4, 3).rows,
    dir: 'right',
    progs: [
      { prog: rule('R'), mis: '' },
      { prog: shortest(layout(sp(4, 3).rows, 'right'))!, mis: 'not-shortest' },
    ],
  }),
];
const fmItems: ChoiceItem[] = [...fmMoves, ...fmCards];
// 別例: 数を数える
const cmdTextOf = (p: Cmd[]) => p.map(text).join('、');
function countAlt(opt: {
  id: string;
  level: number;
  prog: Cmd[];
  kind: 'cards' | 'moves';
  rows?: string[];
  dir?: Dir;
}): NumberItem {
  const l = opt.rows ? layout(opt.rows, opt.dir ?? 'right') : null;
  const answer = opt.kind === 'cards' ? cardCount(opt.prog) : run(l!, opt.prog).trail.length - 1;
  const moves = flat(opt.prog).filter((o) => o === 'forward').length;
  return {
    engine: 'number',
    id: opt.id,
    objective: 'fewer-moves',
    level: opt.level,
    alt: true,
    prompt:
      opt.kind === 'cards'
        ? 'ふだは ぜんぶで なんまい？\n（「くりかえす」の ふだも 1まい）'
        : 'キャラクターは ぜんぶで なんマス すすむ？',
    figure: stripFigure(opt.prog, { label: `てじゅんの ふだ: ${cmdTextOf(opt.prog)}`, hU: 6 }),
    fields: [{ label: opt.kind === 'cards' ? 'まい' : 'マス', answer: { kind: 'int', value: answer } }],
    wrongAnswers: (opt.kind === 'cards'
      ? [
          [moves, 'count-card'],
          [answer - 1, 'count-card'],
          [answer + 1, 'count-card'],
        ]
      : [
          [opt.prog.length, 'count-move'],
          [answer - 1, 'count-move'],
          [answer + 1, 'count-move'],
        ]
    )
      .filter(([v]) => v !== answer)
      .map(([v, m]) => ({ value: String(v), misconception: String(m) })),
    hints:
      opt.kind === 'cards'
        ? [
            '「くりかえす」の ふだは 1まいだよ。外《そと》の「くりかえす」も 中《なか》の「くりかえす」も 1まいずつ。',
            '中《なか》の ふだを ひとつずつ 数《かぞ》えて、「くりかえす」の ふだを たそう。',
            '外《そと》から じゅんに、「くりかえす」の ふだ、中《なか》の ふだ、と 数《かぞ》えよう。',
          ]
        : [
            '「すすむ」の ふだだけ 数《かぞ》えよう。「まがる」は マスを すすまないよ。',
            '「くりかえす」の 中《なか》の「すすむ」は、かいすう ぶん うごくよ。',
            '中《なか》の「すすむ」の 数《かず》に、くりかえす かいすうを かけよう。',
          ],
    explain:
      opt.kind === 'cards'
        ? `ふだは ぜんぶで ${answer}まい。「くりかえす」の ふだは 1まいずつ 数《かぞ》えて、中《なか》の ふだを たしたよ。`
        : `「すすむ」で うごく マスの 数《かず》を ぜんぶ たすと ${answer}マス。「くりかえす」の 中《なか》は かいすう ぶん かけるよ。`,
    identity: opt.id,
  };
}
const fmAlts: NumberItem[] = [
  countAlt({ id: 'moves-alt-a1', level: 0, kind: 'cards', prog: [rep(3, rep(3, F), R)] }),
  countAlt({
    id: 'moves-alt-a2',
    level: 2,
    kind: 'moves',
    rows: ['S.......', '........', '........', '........', '........'],
    dir: 'right',
    prog: [rep(2, rep(3, F), R, F, L)],
  }),
  countAlt({ id: 'moves-alt-a3', level: 2, kind: 'cards', prog: [rep(2, rep(3, F, R), L)] }),
];

// ---- sort-steps ----
/** 手順A: となりどうしを くらべて入れかえる（1しゅう）。入れかえが無くなるまで 1しゅうをくりかえす */
function stepsA(a: number[]): number {
  const x = [...a];
  let count = 0;
  for (;;) {
    let swapped = false;
    for (let i = 0; i + 1 < x.length; i++) {
      count += 1;
      if (x[i]! > x[i + 1]!) {
        [x[i], x[i + 1]] = [x[i + 1]!, x[i]!];
        swapped = true;
      }
    }
    if (!swapped) return count;
  }
}
/** 手順B: のこりぜんぶを くらべて いちばん小さいものを左に置く。のこりが1まいになるまで */
function stepsB(a: number[]): number {
  let count = 0;
  for (let k = a.length; k >= 2; k--) count += k - 1;
  return count;
}
const SORTS: { id: string; level: number; cards: number[] }[] = [
  { id: 'q1', level: 1, cards: [1, 2, 3, 5, 4] },
  { id: 'q2', level: 1, cards: [5, 4, 3, 2, 1] },
  { id: 'q3', level: 2, cards: [2, 1, 3, 4, 5] },
  { id: 'q4', level: 2, cards: [6, 5, 4, 3, 2, 1] },
  { id: 'q5', level: 2, cards: [1, 2, 3, 4, 5, 6] },
  { id: 'q6', level: 2, cards: [3, 1, 2, 5, 4, 6] },
];
/** 2つの手順の言い方（図の中の文字は ひらがな）。くわしい説明は intro に書く */
const STEP_DEFS: Figure = {
  kind: 'svg',
  label:
    '手順《てじゅん》A は となりどうしを くらべて いれかえる 1しゅうを くりかえす。手順《てじゅん》B は いちばん 小《ちい》さい カードを さがして 左《ひだり》に おく ことを くりかえす',
  markup:
    '<svg viewBox="0 0 460 46" style="height:calc(var(--u) * 9)" xmlns="http://www.w3.org/2000/svg">' +
    '<text x="6" y="18" font-size="15" font-weight="700" fill="var(--ink)">A：となりどうしを くらべて いれかえる 1しゅうを くりかえす</text>' +
    '<text x="6" y="40" font-size="15" font-weight="700" fill="var(--ink)">B：いちばん ちいさい カードを さがして ひだりへ おく</text>' +
    '</svg>',
};
const sortItems: ChoiceItem[] = SORTS.map((s) => {
  const a = stepsA(s.cards);
  const b = stepsB(s.cards);
  if (a === b) throw new Error(`${s.id}: AとBが同じ回数《かいすう》`);
  const rightLabel = a < b ? '手順《てじゅん》A' : '手順《てじゅん》B';
  const other = a < b ? '手順《てじゅん》B' : '手順《てじゅん》A';
  return choiceItem({
    id: `sort-${s.id}`,
    obj: 'sort-steps',
    level: s.level,
    prompt: 'くらべる 回数《かいすう》が 少《すく》ない 手順《てじゅん》は どれ？',
    figure: { kind: 'column', items: [{ kind: 'text', text: s.cards.join('　'), size: 'm' }, STEP_DEFS], gap: 0.8 },
    right: rightLabel,
    wrongs: [
      [other, 'sort-wrong'],
      ['おなじ', 'sort-same'],
    ],
    layout: 'row',
    hints: [
      'どちらの 手順《てじゅん》も、くらべる 回数《かいすう》を 数《かぞ》えて くらべよう。',
      `手順《てじゅん》Bは のこりの 数《かず》から 1を ひいた 回数《かいすう》ずつ くらべるよ。${s.cards.length}まいなら、${s.cards.length - 1}回《かい》、${s.cards.length - 2}回《かい》、…と へっていくよ。`,
      '手順《てじゅん》Aは 1しゅうで なんかい くらべるか 数《かぞ》えて、いれかえが なくなるまで 何《なん》しゅう するか たしかめよう。',
    ],
    explain: `手順《てじゅん》Aは ${a}回《かい》、手順《てじゅん》Bは ${b}回《かい》 くらべるよ。${rightLabel}の ほうが 少《すく》ないね。カードの ならびによって、どちらが 少《すく》ないかは かわるよ。`,
  });
});

// 別例: 手順の文を正しい順に並べる
interface Os {
  id: string;
  level: number;
  prompt: string;
  steps: string[];
  hints: [string, string, string];
  explain: string;
}
const OS: Os[] = [
  {
    id: 'o1',
    level: 1,
    prompt: 'いちばん 小《ちい》さい カードを みつける 手順《てじゅん》は？',
    steps: [
      '左《ひだり》の カードを「いまの」に する',
      'つぎの カードと くらべる',
      '小《ちい》さければ「いまの」を かえる',
      'さいごまで くりかえす',
    ],
    hints: [
      'はじめに きめて おくことが あるよ。',
      'くらべてから、かえるか どうかを きめるよ。',
      'くりかえすのは、さいごの ふだだよ。',
    ],
    explain:
      'まず「いまの 小《ちい》さい」を きめて、くらべて、小《ちい》さければ かえる。これを さいごまで くりかえすと、いちばん 小《ちい》さい カードが わかるよ。',
  },
  {
    id: 'o2',
    level: 2,
    prompt: 'となりどうしを くらべて いれかえる 1しゅうの 手順《てじゅん》を ならべよう。',
    steps: [
      '左《ひだり》から 2まいを くらべる',
      '左《ひだり》が 大《おお》きければ いれかえる',
      'ひとつ 右《みぎ》へ すすむ',
      '右《みぎ》の はしまで くりかえす',
    ],
    hints: [
      'くらべる カードを えらぶ ところから はじまるよ。',
      'くらべた あとで、いれかえるか きめるよ。',
      'すすんでから、また くらべるために くりかえすよ。',
    ],
    explain: 'くらべて、いれかえて、ひとつ すすむ。これを 右《みぎ》の はしまで くりかえすと 1しゅうだよ。',
  },
  {
    id: 'o3',
    level: 2,
    prompt: '1から 100までの 数《かず》を 当《あ》てる ゲームで、はやく 当《あ》てる 手順《てじゅん》を ならべよう。',
    steps: [
      'まんなかの 数《かず》を 言《い》う',
      '大《おお》きいか 小《ちい》さいかを きく',
      '当《あ》てる はんいを はんぶんに する',
      '当《あ》たるまで くりかえす',
    ],
    hints: [
      'さいしょは、はんいの まんなかを 言《い》うよ。',
      'きいてから、はんいを かえるよ。',
      '当《あ》たるまで くりかえすのは、さいごだよ。',
    ],
    explain:
      'まんなかを 言《い》って、大《おお》きいか 小《ちい》さいかを きいて、はんぶんに する。くりかえすと、100この なかからでも すこしの かいすうで 当《あ》たるよ。',
  },
];
const osItems: OrderItem[] = OS.map((o) => ({
  engine: 'order',
  id: `sort-alt-${o.id}`,
  objective: 'sort-steps',
  level: o.level,
  alt: true,
  prompt: o.prompt,
  cards: o.steps.map((label) => ({ label })),
  layout: 'column',
  ends: ['はじめ', 'おわり'],
  reverseMisconception: 'sort-order',
  hints: o.hints,
  explain: o.explain,
  identity: `sort-alt-${o.id}`,
}));

const items: Item[] = [
  ...fcItems,
  ...eqItems,
  ...fmItems,
  ...fmAlts,
  ...sortItems,
  ...osItems,
];

const introGrid = gridFigure(layout(st5.rows, st5.dir), { label: 'ますの ず。大《おお》きな かいだん' });

export const efficient: UnitSpec = {
  ...baseUnit('g6.prog.efficient', 'g6'),
  title: 'よりよい 手順《てじゅん》',
  prereq: ['g5.prog.debug-plan'],
  objectives: [
    { id: 'fewer-cards', title: '少《すく》ない ふだで 動《うご》かす' },
    { id: 'fewer-moves', title: '手順《てじゅん》を くらべて、よりよい ものを えらぶ' },
    { id: 'sort-steps', title: '並《なら》べかえの 手順《てじゅん》を くらべる' },
  ],
  misconceptions: [
    ...BASE_MIS,
    {
      id: 'repeat-count',
      explain: 'くりかえす かいすうを 数《かぞ》えまちがえたのかな。みちの 長《なが》さや だんの 数《かず》を 数《かぞ》えて きめよう。',
    },
    {
      id: 'repeat-body',
      explain: '「くりかえす」の 中《なか》の ふだが ちがうのかな。外《そと》と 中《なか》の くりかえしを わけて 考《かんが》えよう。',
    },
    {
      id: 'too-many',
      explain: '札《ふだ》が おおすぎたのかな。「くりかえす」の 中《なか》に「くりかえす」を 入《い》れると へらせるよ。',
    },
    {
      id: 'not-shortest',
      explain: 'もっと ふだが 少《すく》ない 手順《てじゅん》が あるよ。「くりかえす」の ふだも 1まいと 数《かぞ》えて くらべよう。',
    },
    {
      id: 'not-fastest',
      explain: 'ゴールまで すすむ マスの 数《かず》が 多《おお》い 手順《てじゅん》だよ。まわりみちや、むだな うごきが ないか たどってみよう。',
    },
    {
      id: 'count-card',
      explain: '札《ふだ》の 数《かぞ》え方《かた》を まちがえたのかな。外《そと》と 中《なか》の「くりかえす」を 1まいずつ 数《かぞ》えて、中《なか》の ふだを たそう。',
    },
    {
      id: 'count-move',
      explain: 'すすむ マスの 数《かず》の 数《かぞ》え方《かた》を まちがえたのかな。「すすむ」の 数《かず》に、くりかえす かいすうを かけよう。',
    },
    {
      id: 'sort-wrong',
      explain: 'くらべる 回数《かいすう》を 数《かぞ》えまちがえたのかな。1しゅうで くらべる 回数《かいすう》と、しゅう数《すう》を かけて 数《かぞ》えよう。',
    },
    {
      id: 'sort-same',
      explain: 'ならべる カードの ならびによって、くらべる 回数《かいすう》は かわるよ。ひとつずつ 数《かぞ》えて たしかめよう。',
    },
    {
      id: 'sort-order',
      explain: '手順《てじゅん》の じゅんばんが ぎゃくだったのかな。さきに きめる こと、そのあと くらべる こと、さいごに くりかえす ことを 考《かんが》えよう。',
    },
  ],
  levels: [
    { label: 'ふだを へらす', chance: 0.05 },
    { label: 'くらべて えらぶ', chance: 0.1 },
    { label: 'くふうした 手順《てじゅん》', chance: 0.05 },
  ],
  intro: [
    {
      text: '同《おな》じ 結果《けっか》に なる 手順《てじゅん》でも、ふだの 数《かず》や、うごく 数《かず》は ちがうことが あるよ。',
      figure: introGrid,
    },
    {
      text: '「くりかえす」の 中《なか》に「くりかえす」を 入《い》れると、もっと みじかく 書《か》けるよ。',
      figure: { kind: 'text', text: 'くりかえす 3かい（くりかえす 3かい（すすむ）、みぎを むく）', size: 'm' },
    },
    {
      text: 'カードを 小《ちい》さい じゅんに ならべる 手順《てじゅん》にも、くらべる 回数《かいすう》が 少《すく》ない 手順《てじゅん》と 多《おお》い 手順《てじゅん》が あるよ。',
    },
    {
      text: '手順《てじゅん》A は、となりどうしの カードを くらべて、左《ひだり》が 大《おお》きければ いれかえる。これを 左《ひだり》から 右《みぎ》まで 1しゅう して、いれかえが なくなるまで 1しゅうを くりかえすよ。',
    },
    {
      text: '手順《てじゅん》B は、のこりの カードを ぜんぶ くらべて、いちばん 小《ちい》さい カードを みつけて 左《ひだり》に おくよ。のこりが 1まいに なるまで くりかえすよ。',
    },
  ],
  source: { kind: 'items', items },
  basis:
    '小学校学習指導要領（平成29年告示）総則 第3の1(3)イ、小学校プログラミング教育の手引（第三版）（よりよい手順《てじゅん》を考える）。学年の割当は本アプリの案',
  gradeIsAppProposal: true,
};



