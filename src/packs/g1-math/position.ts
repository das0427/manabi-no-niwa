/**
 * g1.math.position いちと じゅんばん（前後・左右・上下、なんばんめ）（curriculum-matrix 3.4）。
 * map エンジンは無いので choice で作る（図は絵を並べた列・たな、まるの列）。
 *
 * 到達項目: まえ・うしろ（なんばんめ）・みぎ・ひだり・うえ・した（たなの だんと ばんめ）・なんこと なんばんめ。
 * 同一性キー: 「並び（たな）× 問い」。数えはじめ・数が違えば別。
 * 左右は「じぶんから みて」（絵の向きでなく、画面を見る子から見た左右）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { ChoiceItem, ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import { opts, REVISED, type Wrong } from './util';

type Obj = 'zengo' | 'sayuu' | 'jouge' | 'nanko';
interface Thing {
  id: string;
  name: string;
}

const ANIMALS: Thing[] = [
  { id: 'dog', name: 'いぬ' },
  { id: 'cat', name: 'ねこ' },
  { id: 'rabbit', name: 'うさぎ' },
  { id: 'bear', name: 'くま' },
  { id: 'monkey', name: 'さる' },
  { id: 'elephant', name: 'ぞう' },
  { id: 'fox', name: 'きつね' },
  { id: 'frog', name: 'かえる' },
  { id: 'turtle', name: 'かめ' },
  { id: 'chick', name: 'ひよこ' },
  { id: 'cow', name: 'うし' },
  { id: 'bird', name: 'とり' },
];
const THINGS: Thing[] = [
  { id: 'apple', name: 'りんご' },
  { id: 'banana', name: 'バナナ' },
  { id: 'mikan', name: 'みかん' },
  { id: 'strawberry', name: 'いちご' },
  { id: 'peach', name: 'もも' },
  { id: 'lemon', name: 'レモン' },
  { id: 'tomato', name: 'トマト' },
  { id: 'carrot', name: 'にんじん' },
  { id: 'ball', name: 'ボール' },
  { id: 'pencil', name: 'えんぴつ' },
  { id: 'umbrella', name: 'かさ' },
  { id: 'scissors', name: 'はさみ' },
  { id: 'flower', name: 'はな' },
  { id: 'egg', name: 'たまご' },
  { id: 'onigiri', name: 'おにぎり' },
  { id: 'bread', name: 'パン' },
];

const ill = (id: string): Figure => ({ kind: 'illust', id });
const ids = (ts: Thing[]) => ts.map((t) => t.id).join(',');

function choice(
  obj: Obj,
  level: number,
  key: string,
  alt: boolean,
  prompt: string,
  figure: Figure | undefined,
  options: ChoiceOption[],
  hints: [string, string, string],
  explain: string,
): ChoiceItem {
  return {
    engine: 'choice',
    id: key,
    objective: obj,
    level,
    alt,
    prompt,
    figure,
    options,
    hints,
    explain,
    identity: key,
  };
}

// ---- まえ・うしろ ----
/** 列の図: 左が まえ（せんとう） */
const lineFig = (ts: Thing[]): Figure => ({
  kind: 'row',
  items: [
    { kind: 'text', text: 'まえ', size: 'm' },
    ...ts.map((t) => ill(t.id)),
    { kind: 'text', text: 'うしろ', size: 'm' },
  ],
  gap: 1,
});

function zengo(level: number, rng: Rng, alt: boolean): ChoiceItem {
  const n = rng.int(5, 7);
  const ts = rng.sample(ANIMALS, n);
  const fromBack = rng.next() < 0.5;
  const end = fromBack ? 'うしろ' : 'まえ';
  const other = fromBack ? 'まえ' : 'うしろ';
  const k = rng.int(2, n - 1); // 何番目（1番目と最後は やさしすぎるので出さない）
  const at = (kk: number, back: boolean) => ts[back ? n - kk : kk - 1]!;
  const target = at(k, fromBack);
  if (!alt) {
    const key = `zengo:${ids(ts)}:${end}:${k}`;
    const wrongs: Wrong[] = [
      [at(k, !fromBack).name, 'end-swap'],
      [at(k + 1, fromBack).name, 'count-off'],
      [at(k - 1, fromBack).name, 'count-off'],
    ];
    return choice(
      'zengo',
      level,
      key,
      false,
      `${end}から ${k}ばんめは だれ？`,
      lineFig(ts),
      opts(target.name, wrongs),
      [
        `「${end}」は どちらの はしかな。`,
        `${end}の はしに いる ${at(1, fromBack).name}が 1ばんめ だよ。`,
        `${at(1, fromBack).name}、${at(2, fromBack).name}、… と ${k}まで かぞえよう。`,
      ],
      `${end}から 1ばんめ、2ばんめ、… と かぞえると、${k}ばんめは ${target.name}だよ。`,
    );
  }
  const key = `zengo-alt:${ids(ts)}:${end}:${k}`;
  const otherK = n + 1 - k;
  const wrongs: Wrong[] = [
    [`${otherK}ばんめ`, 'end-swap'],
    [`${k + 1}ばんめ`, 'count-off'],
    [`${k - 1}ばんめ`, 'count-off'],
  ];
  return choice(
    'zengo',
    level,
    key,
    true,
    `${target.name}は ${end}から なんばんめ？`,
    lineFig(ts),
    opts(`${k}ばんめ`, wrongs),
    [
      `${end}の はしから かぞえるよ。${other}からでは ないよ。`,
      `${end}の はしに いる ${at(1, fromBack).name}が 1ばんめ。`,
      `1ばんめ、2ばんめ、… と ${target.name}まで かぞえよう。`,
    ],
    `${end}から かぞえると、${target.name}は ${k}ばんめ だよ。`,
  );
}

// ---- みぎ・ひだり ----
function sayuu(level: number, rng: Rng, alt: boolean): ChoiceItem {
  const n = rng.int(4, 5);
  const ts = rng.sample(THINGS, n);
  const fig: Figure = { kind: 'row', items: ts.map((t) => ill(t.id)), gap: 2 };
  const lrHint =
    'えの まえに すわって いる つもりで、じぶんから みて かんがえよう。じぶんの みぎての がわが みぎだよ。';
  if (alt) {
    // 2つの物の位置関係: X は Y の みぎ？ ひだり？
    const [i, j] = rng.sample([...Array(n).keys()], 2) as [number, number];
    const x = ts[i]!;
    const y = ts[j]!;
    const ans = i > j ? 'みぎ' : 'ひだり';
    const key = `sayuu-alt:${ids(ts)}:${x.id}-${y.id}`;
    return choice(
      'sayuu',
      level,
      key,
      true,
      `${x.name}は ${y.name}の みぎ？ ひだり？`,
      fig,
      opts(ans, [[ans === 'みぎ' ? 'ひだり' : 'みぎ', 'lr-swap']]),
      [
        lrHint,
        `まず ${y.name}を みつけよう。`,
        `${y.name}から みて、${x.name}は どちらの てが わに あるかな。`,
      ],
      `じぶんから みて、${x.name}は ${y.name}の ${ans}に あるよ。`,
    );
  }
  if (rng.next() < 0.5) {
    // すぐ となり
    const i = rng.int(1, n - 2);
    const dir = rng.next() < 0.5 ? 'みぎ' : 'ひだり';
    const d = dir === 'みぎ' ? 1 : -1;
    const ans = ts[i + d]!;
    const key = `sayuu:${ids(ts)}:${ts[i]!.id}:${dir}`;
    const wrongs: Wrong[] = [[ts[i - d]!.name, 'lr-swap']];
    const far = ts[i + 2 * d];
    if (far) wrongs.push([far.name, 'count-off']);
    else wrongs.push([ts[i]!.name, 'count-off']);
    return choice(
      'sayuu',
      level,
      key,
      false,
      `${ts[i]!.name}の すぐ ${dir}に ある ものは どれ？`,
      fig,
      opts(ans.name, wrongs),
      [
        lrHint,
        `まず ${ts[i]!.name}を みつけよう。`,
        `${ts[i]!.name}の となりは 2つ。${dir}の ほうは どちらかな。`,
      ],
      `${ts[i]!.name}の すぐ ${dir}は ${ans.name}だよ。`,
    );
  }
  // ひだり／みぎから なんばんめ
  const fromRight = rng.next() < 0.5;
  const side = fromRight ? 'みぎ' : 'ひだり';
  const k = rng.int(2, n - 1);
  const at = (kk: number, r: boolean) => ts[r ? n - kk : kk - 1]!;
  const key = `sayuu:${ids(ts)}:${side}:${k}`;
  return choice(
    'sayuu',
    level,
    key,
    false,
    `${side}から ${k}ばんめに ある ものは どれ？`,
    fig,
    opts(at(k, fromRight).name, [
      [at(k, !fromRight).name, 'lr-swap'],
      [at(k + 1, fromRight).name, 'count-off'],
      [at(k - 1, fromRight).name, 'count-off'],
    ]),
    [
      lrHint,
      `${side}の はしに ある ${at(1, fromRight).name}が 1ばんめ だよ。`,
      `${at(1, fromRight).name}、${at(2, fromRight).name}、… と かぞえよう。`,
    ],
    `${side}から かぞえて ${k}ばんめは ${at(k, fromRight).name}だよ。`,
  );
}

// ---- たな（うえ・した、だんと ばんめ） ----
const ROWS = 3;
const COLS = 4;
function shelfFig(grid: Thing[][]): Figure {
  return {
    kind: 'column',
    items: grid.map((row) => ({ kind: 'row', items: row.map((t) => ill(t.id)), gap: 3 })),
    gap: 2,
  };
}
const posText = (r: number, c: number) => `うえから ${r}だんめ、ひだりから ${c}ばんめ`;

function jouge(level: number, rng: Rng, alt: boolean): ChoiceItem {
  const flat = rng.sample(THINGS, ROWS * COLS);
  const grid = Array.from({ length: ROWS }, (_, r) => flat.slice(r * COLS, r * COLS + COLS));
  const r = rng.int(1, ROWS);
  const c = rng.int(1, COLS);
  const at = (rr: number, cc: number) => grid[rr - 1]?.[cc - 1];
  const target = at(r, c)!;
  const fig = shelfFig(grid);
  const hints: [string, string, string] = [
    'うえから かぞえる「だん」と、ひだりから かぞえる「ばんめ」に わけて かんがえよう。',
    `まず、うえから ${r}だんめの たなを ゆびで おさえよう。`,
    `その だんで、ひだりから 1ばんめ、2ばんめ、… と かぞえよう。`,
  ];
  if (!alt) {
    const key = `jouge:${ids(flat)}:${r}-${c}`;
    const wrongs: Wrong[] = [];
    const swap = at(c, r);
    if (swap) wrongs.push([swap.name, 'row-col']);
    wrongs.push([at(ROWS + 1 - r, c)!.name, 'end-swap']);
    wrongs.push([at(r, COLS + 1 - c)!.name, 'lr-swap']);
    wrongs.push([at(r, c === COLS ? c - 1 : c + 1)!.name, 'count-off']);
    return choice(
      'jouge',
      level,
      key,
      false,
      `${posText(r, c)}に ある ものは どれ？`,
      fig,
      opts(target.name, wrongs),
      hints,
      `うえから ${r}だんめの たなの、ひだりから ${c}ばんめに ${target.name}が あるよ。`,
    );
  }
  const key = `jouge-alt:${ids(flat)}:${r}-${c}`;
  const wrongs: Wrong[] = [];
  if (c <= ROWS && r <= COLS && r !== c) wrongs.push([posText(c, r), 'row-col']);
  if (ROWS + 1 - r !== r) wrongs.push([posText(ROWS + 1 - r, c), 'end-swap']);
  if (COLS + 1 - c !== c) wrongs.push([posText(r, COLS + 1 - c), 'lr-swap']);
  wrongs.push([posText(r, c === COLS ? c - 1 : c + 1), 'count-off']);
  return choice(
    'jouge',
    level,
    key,
    true,
    `${target.name}は どこに ある？`,
    fig,
    opts(posText(r, c), wrongs),
    [
      `まず ${target.name}を みつけよう。`,
      `${target.name}の だんは、うえから かぞえて なんだんめかな。`,
      `つぎに、その だんで ひだりから かぞえよう。1ばんめ、2ばんめ、…`,
    ],
    `${target.name}は ${posText(r, c)}に あるよ。`,
  );
}

// ---- なんこ と なんばんめ ----
function dotsFig(total: number, filled: (i: number) => boolean): Figure {
  const circles = Array.from({ length: total }, (_, i) => {
    const on = filled(i);
    return `<circle cx="${i * 40 + 20}" cy="20" r="14" fill="${on ? 'var(--sky)' : 'var(--surface)'}" stroke="var(--ink)" stroke-width="${on ? 4 : 2}"/>`;
  }).join('');
  return {
    kind: 'svg',
    markup: `<svg viewBox="0 0 ${total * 40} 40" xmlns="http://www.w3.org/2000/svg">${circles}</svg>`,
    label: `まるが ${total}こ ならんで いる`,
  };
}
const firstN = (n: number) => (i: number) => i < n;
const onlyNth = (n: number) => (i: number) => i === n - 1;
const lastN = (t: number, n: number) => (i: number) => i >= t - n;
const nthFromRight = (t: number, n: number) => (i: number) => i === t - n;

function nanko(level: number, rng: Rng, alt: boolean): ChoiceItem {
  const total = rng.int(5, 8);
  const n = rng.int(2, total - 2);
  const isCount = rng.next() < 0.5;
  const word = isCount ? `${n}こ` : `${n}ばんめ`;
  if (!alt) {
    const key = `nanko:${isCount ? 'ko' : 'banme'}:${total}:${n}`;
    const options: ChoiceOption[] = isCount
      ? [
          { figure: dotsFig(total, firstN(n)), correct: true },
          { figure: dotsFig(total, onlyNth(n)), misconception: 'nanko-nanbanme' },
          { figure: dotsFig(total, lastN(total, n)), misconception: 'lr-swap' },
          { figure: dotsFig(total, firstN(n + 1)), misconception: 'count-off' },
        ]
      : [
          { figure: dotsFig(total, onlyNth(n)), correct: true },
          { figure: dotsFig(total, firstN(n)), misconception: 'nanko-nanbanme' },
          total + 1 - n !== n
            ? { figure: dotsFig(total, nthFromRight(total, n)), misconception: 'lr-swap' }
            : { figure: dotsFig(total, onlyNth(n - 1)), misconception: 'count-off' },
          // みぎから n ばんめ が ひだりから n+1 ばんめ と同じ（total = 2n）ときは n−1 ばんめ
          total === 2 * n
            ? { figure: dotsFig(total, onlyNth(n - 1)), misconception: 'count-off' }
            : { figure: dotsFig(total, onlyNth(n + 1)), misconception: 'count-off' },
        ];
    return choice(
      'nanko',
      level,
      key,
      false,
      `ひだりから ${word}に いろを ぬった ものは どれ？`,
      undefined,
      options,
      [
        '「なんこ」と「なんばんめ」の ちがいに きを つけよう。',
        isCount
          ? `「${n}こ」は、ひだりから ${n}つ ぜんぶに いろを ぬるよ。`
          : `「${n}ばんめ」は、ひだりから かぞえて ${n}ばんめの 1つだけに いろを ぬるよ。`,
        'ひだりの はしから 1、2、… と かぞえて くらべよう。',
      ],
      isCount
        ? `ひだりから ${n}こは、ひだりから ${n}つ ぜんぶ。${n}ばんめは その なかの 1つだけ だよ。`
        : `ひだりから ${n}ばんめは 1つだけ。${n}こ だと ${n}つ ぜんぶに なるよ。`,
    );
  }
  // 別例: ぬった図を見て、ことばを選ぶ
  const key = `nanko-alt:${isCount ? 'ko' : 'banme'}:${total}:${n}`;
  const fig = dotsFig(total, isCount ? firstN(n) : onlyNth(n));
  const wrongs: Wrong[] = isCount
    ? [
        [`ひだりから ${n}ばんめ`, 'nanko-nanbanme'],
        [`みぎから ${n}こ`, 'lr-swap'],
        [`ひだりから ${n + 1}こ`, 'count-off'],
      ]
    : [
        [`ひだりから ${n}こ`, 'nanko-nanbanme'],
        total + 1 - n !== n
          ? [`みぎから ${n}ばんめ`, 'lr-swap']
          : [`ひだりから ${n - 1}ばんめ`, 'count-off'],
        [`ひだりから ${n + 1}ばんめ`, 'count-off'],
      ];
  return choice(
    'nanko',
    level,
    key,
    true,
    'いろを ぬった まるを ことばで いうと どれ？',
    fig,
    opts(`ひだりから ${word}`, wrongs),
    [
      'いろの ついた まるは 1つかな、いくつも あるかな。',
      isCount
        ? 'ひだりの はしから つながって ぬって あるね。ぜんぶで いくつかな。'
        : '1つだけ ぬって あるね。ひだりから なんばんめかな。',
      'ひだりの はしから 1、2、… と かぞえよう。',
    ],
    `ひだりから ${word}だよ。${isCount ? 'まとめて いくつかは「なんこ」' : '1つの ばしょは「なんばんめ」'}で いうよ。`,
  );
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['zengo', 'sayuu'] },
  { objs: ['nanko', 'jouge'] },
  { objs: ['zengo', 'sayuu', 'jouge', 'nanko'] },
];

export function generatePosition(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = lv.objs[(index + rng.int(0, lv.objs.length - 1)) % lv.objs.length]!;
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'zengo':
      return zengo(level, rng, alt);
    case 'sayuu':
      return sayuu(level, rng, alt);
    case 'jouge':
      return jouge(level, rng, alt);
    case 'nanko':
      return nanko(level, rng, alt);
  }
}

export const position: UnitSpec = {
  id: 'g1.math.position',
  title: 'いちと じゅんばん',
  stage: 'g1',
  subject: 'math',
  domain: 'B-shape',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'subj-sansu',
  prereq: ['g1.math.numbers-10'],
  objectives: [
    { id: 'zengo', title: 'まえから・うしろから なんばんめ' },
    { id: 'sayuu', title: 'みぎ・ひだり' },
    { id: 'jouge', title: 'うえから なんだんめ、ひだりから なんばんめ' },
    { id: 'nanko', title: '「なんこ」と「なんばんめ」' },
  ],
  misconceptions: [
    {
      id: 'lr-swap',
      explain:
        'みぎと ひだりを とりちがえたのかな。じぶんから みて、じぶんの みぎての がわが みぎだよ。',
    },
    {
      id: 'end-swap',
      explain:
        'はんたいの はしから かぞえたのかな。「まえから」「うえから」の ことばを よく みよう。',
    },
    {
      id: 'count-off',
      explain:
        'かぞえる ときに 1つ ずれたのかな。はしの ものを 1ばんめに して、ゆびで おさえながら かぞえよう。',
    },
    {
      id: 'nanko-nanbanme',
      explain:
        '「なんこ」と「なんばんめ」を とりちがえたのかな。「3こ」は 3つ ぜんぶ、「3ばんめ」は 3ばんめの 1つだけ だよ。',
      figure: {
        kind: 'column',
        items: [dotsFig(6, firstN(3)), dotsFig(6, onlyNth(3))],
        gap: 2,
      },
    },
    {
      id: 'row-col',
      explain:
        '「だん」と「ばんめ」を とりちがえたのかな。だんは うえから したへ、ばんめは よこに かぞえるよ。',
    },
  ],
  levels: [
    { label: 'まえ・うしろ、みぎ・ひだり', chance: 0.1 },
    { label: 'なんこと なんばんめ、たなの いち', chance: 0.1 },
    { label: 'まとめ', chance: 0.1 },
  ],
  intro: [
    {
      text: 'どうぶつが ならんで います。いちばん まえの いぬが「まえから 1ばんめ」。',
      figure: lineFig([ANIMALS[0]!, ANIMALS[1]!, ANIMALS[2]!, ANIMALS[3]!, ANIMALS[4]!]),
    },
    {
      text: '「まえから 3ばんめ」は うさぎ だけ。「まえから 3びき」は いぬ・ねこ・うさぎ の 3びき ぜんぶ。',
      figure: { kind: 'column', items: [dotsFig(5, onlyNth(3)), dotsFig(5, firstN(3))], gap: 2 },
    },
    {
      text: 'たなでは「うえから なんだんめ」と「ひだりから なんばんめ」の 2つで ばしょを いうよ。みぎ・ひだりは じぶんから みて きめるよ。',
      figure: shelfFig([
        [THINGS[0]!, THINGS[1]!, THINGS[2]!],
        [THINGS[3]!, THINGS[4]!, THINGS[5]!],
      ]),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generatePosition(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第1学年 B(1) 図形（前後、左右、上下など方向や位置についての言葉を用いて、ものの位置を表すこと）、A(1) 数（順序数・集合数）',
  revised: REVISED,
};
