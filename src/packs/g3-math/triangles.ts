/**
 * g3.math.triangles 二等辺三角形・正三角形、角（curriculum-matrix 3.6）。
 * 辺の長さで仲間分け → 角の大小 → 円を使ってかく（半径が等しいことを使う）。
 *
 * エンジン: choice（辺の長さから仲間を判断・角の性質）、geometry（形を選ぶ・方眼にかく・角の大小）、number（辺の長さ）。
 * 回転・裏返し・大きさは この単元の学習内容でないので同一性キーに含めない（形の比と辺の長さの組で数える）。
 */
import type { Rng } from '../../core/util/rng';
import type { GeometryItem, Pt } from '../../engines/geometry/geometry';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { pickObj, pickOne, wrongList } from './util';

type Obj = 'classify' | 'angle' | 'circle' | 'sides';

const ISO = '二等辺三角形《にとうへんさんかくけい》';
const EQ = '正三角形《せいさんかくけい》';
const NEITHER = 'どちらでもない';

/** 点の列を 回転（90度きざみ）・平行移動（見た目だけ） */
function turn(ps: Pt[], k: number): Pt[] {
  let q = ps;
  for (let i = 0; i < k; i++) q = q.map(([x, y]) => [-y, x] as Pt);
  const mx = Math.min(...q.map((p) => p[0]));
  const my = Math.min(...q.map((p) => p[1]));
  return q.map(([x, y]) => [x - mx, y - my] as Pt);
}

function classify(level: number, rng: Rng, alt: boolean): ChoiceItem | GeometryItem {
  if (alt) {
    if (rng.next() < 0.5) {
      // 方眼に 二等辺三角形を かく（底辺の長さを かえる）
      const b = pickOne(rng, [2, 4, 6, 8]);
      return {
        engine: 'geometry',
        id: `classify-alt:draw:${b}`,
        objective: 'classify',
        level,
        prompt: `ます目《め》の 点《てん》を つないで、1つの 辺《へん》が よこに ${b}ますの ${ISO}を かこう。`,
        hints: [
          '2つの 辺《へん》の 長《なが》さが 等《ひと》しい 三角形《さんかくけい》だよ。',
          `よこに ${b}ますの 辺《へん》を かいたら、その まん中《なか》の 真上《まうえ》に ちょう点《てん》を おこう。`,
          'さいごに はじめの 点《てん》を もう一度《いちど》 タップして とじよう。',
        ],
        explain: `よこの 辺《へん》の まん中《なか》の 真上《まうえ》に ちょう点《てん》を とると、のこりの 2つの 辺《へん》の 長《なが》さが 等《ひと》しく なり、${ISO}に なります。`,
        identity: `draw:${b}`,
        alt: true,
        task: {
          kind: 'draw',
          grid: { w: 10, h: 5 },
          target: { kind: 'shape', shape: 'isosceles-triangle' },
        },
        misconceptions: { wrongClass: 'not-iso' },
      };
    }
    // 形を えらぶ
    const b = pickOne(rng, [2, 4, 6]);
    const h = rng.int(2, 5);
    const iso: Pt[] = [
      [0, 0],
      [b, 0],
      [b / 2, h],
    ];
    const sc1: Pt[] = [
      [0, 0],
      [b + 1, 0],
      [b + 2, h],
    ];
    const sc2: Pt[] = [
      [0, 0],
      [b, 0],
      [0, h + 1],
    ];
    return {
      engine: 'geometry',
      id: `classify-alt:pick:${b}x${h}`,
      objective: 'classify',
      level,
      prompt: `${ISO}は どれ？`,
      hints: [
        '3つの 辺《へん》の 長《なが》さを くらべよう。',
        'コンパスや 紙《かみ》の はしで 長《なが》さを うつすと くらべやすいよ。',
        '2つの 辺《へん》の 長《なが》さが 等《ひと》しいのは どれかな。',
      ],
      explain: `${ISO}は、2つの 辺《へん》の 長《なが》さが 等《ひと》しい 三角形《さんかくけい》です。向《む》きが かわっても ${ISO}です。`,
      identity: `pick:${b}x${h}`,
      alt: true,
      task: {
        kind: 'pick',
        options: [
          { shape: { points: turn(iso, rng.int(0, 3)) }, correct: true },
          { shape: { points: turn(sc1, rng.int(0, 3)) }, misconception: 'not-iso' },
          { shape: { points: turn(sc2, rng.int(0, 3)) }, misconception: 'not-iso' },
        ],
      },
    };
  }
  // 辺の長さから 仲間を 判断する
  const kind = pickOne(rng, ['iso', 'eq', 'none'] as const);
  let s: [number, number, number];
  if (kind === 'eq') {
    const a = rng.int(2, 12);
    s = [a, a, a];
  } else if (kind === 'iso') {
    const a = rng.int(2, 12);
    let b = rng.int(1, 2 * a - 1);
    if (b === a) b = a + 1 < 2 * a ? a + 1 : a - 1;
    s = [a, a, b];
  } else {
    let a: number;
    let b: number;
    let c: number;
    do {
      a = rng.int(2, 12);
      b = rng.int(2, 12);
      c = rng.int(2, 12);
    } while (a === b || b === c || a === c || a + b <= c || b + c <= a || a + c <= b);
    s = [a, b, c];
  }
  const shown = rng.shuffle(s);
  const sorted = [...s].sort((x, y) => x - y).join('-');
  return {
    engine: 'choice',
    id: `classify:${sorted}`,
    objective: 'classify',
    level,
    prompt: `3つの 辺《へん》の 長《なが》さが ${shown.join('cm、')}cmの 三角形《さんかくけい》は 何《なん》と いう 三角形《さんかくけい》ですか。`,
    hints: [
      '3つの 辺《へん》の 長《なが》さを くらべよう。',
      '等《ひと》しい 長《なが》さの 辺《へん》は いくつ あるかな。',
      `2つ 等《ひと》しい → ${ISO}、3つとも 等《ひと》しい → ${EQ}。`,
    ],
    explain:
      kind === 'iso'
        ? `${s[0]}cmの 辺《へん》が 2つ あるので ${ISO}です。`
        : kind === 'eq'
          ? `3つの 辺《へん》が みんな ${s[0]}cmなので ${EQ}です。`
          : '等《ひと》しい 長《なが》さの 辺《へん》が ないので、どちらでも ありません。',
    identity: `sides:${sorted}`,
    alt: false,
    fixedOrder: true,
    options: [
      {
        label: ISO,
        ...(kind === 'iso'
          ? { correct: true }
          : { misconception: kind === 'eq' ? 'iso-vs-equi' : 'not-iso' }),
      },
      { label: EQ, ...(kind === 'eq' ? { correct: true } : { misconception: 'iso-vs-equi' }) },
      { label: NEITHER, ...(kind === 'none' ? { correct: true } : { misconception: 'not-iso' }) },
    ],
  };
}

/** 角（2本の辺）: 頂点 (0,0)、辺の長さ L、開き deg */
function angleShape(deg: number, L: number, k: number): Pt[] {
  const rad = (deg * Math.PI) / 180;
  const p: Pt[] = [
    [L, 0],
    [0, 0],
    [Math.round(L * Math.cos(rad) * 100) / 100, Math.round(L * Math.sin(rad) * 100) / 100],
  ];
  // 向きを かえる（見た目だけ）
  const t = (k * 90 * Math.PI) / 180;
  return p.map(
    ([x, y]) =>
      [
        Math.round((x * Math.cos(t) - y * Math.sin(t)) * 100) / 100,
        Math.round((x * Math.sin(t) + y * Math.cos(t)) * 100) / 100,
      ] as Pt,
  );
}

function angle(level: number, rng: Rng, alt: boolean): GeometryItem | ChoiceItem {
  if (alt && rng.next() < 0.5) {
    // いちばん 小さい 角を えらぶ（辺の 長さに まどわされない）
    const degs = rng.sample([30, 45, 60, 90, 120, 135], 3).sort((a, b) => a - b);
    const [small, mid, big] = degs as [number, number, number];
    const k = rng.int(0, 3);
    return {
      engine: 'geometry',
      id: `angle-alt:min:${degs.join('-')}`,
      objective: 'angle',
      level,
      prompt: 'いちばん 小《ちい》さい 角《かく》は どれ？',
      hints: [
        '角《かく》の 大《おお》きさは、辺《へん》の 長《なが》さでは きまらないよ。',
        '2つの 辺《へん》の 開《ひら》きぐあいを くらべよう。',
        'いちばん 開《ひら》きが 小《ちい》さいのは どれかな。',
      ],
      explain:
        '辺《へん》が 長《なが》くても、開《ひら》きが いちばん 小《ちい》さい 角《かく》が いちばん 小《ちい》さい 角《かく》です。',
      identity: `angle-min:${degs.join('-')}`,
      alt: true,
      task: {
        kind: 'pick',
        options: [
          { shape: { points: angleShape(small, 2, k), closed: false }, correct: true },
          {
            shape: { points: angleShape(big, 6, k), closed: false },
            misconception: 'angle-by-side-length',
          },
          {
            shape: { points: angleShape(mid, 4, k), closed: false },
            misconception: 'angle-compare',
          },
        ],
      },
    };
  }
  if (alt) {
    const q = pickOne(rng, ['eq', 'iso', 'big'] as const);
    if (q === 'big') {
      // 三角じょうぎの 角
      return {
        engine: 'choice',
        id: 'angle-alt:set-square',
        objective: 'angle',
        level,
        prompt:
          '1組《くみ》の 三角《さんかく》じょうぎの 角《かど》の うち、いちばん 大《おお》きい 角《かく》は どれ？',
        hints: [
          '角《かく》の 大《おお》きさは、辺《へん》の 開《ひら》きぐあいで きまるよ。',
          '重《かさ》ねて くらべて みよう。',
          '直角《ちょっかく》は どれかな。',
        ],
        explain:
          '三角《さんかく》じょうぎの いちばん 大《おお》きい 角《かく》は 直角《ちょっかく》です。辺《へん》の 長《なが》さでは なく、開《ひら》きぐあいで くらべます。',
        identity: 'angle:set-square',
        alt: true,
        options: [
          { label: '直角《ちょっかく》の 角《かく》', correct: true },
          {
            label: 'いちばん 長《なが》い 辺《へん》の はしの 角《かく》',
            misconception: 'angle-by-side-length',
          },
          { label: 'いちばん とがった 角《かく》', misconception: 'angle-compare' },
        ],
      };
    }
    return {
      engine: 'choice',
      id: `angle-alt:${q}`,
      objective: 'angle',
      level,
      prompt:
        q === 'eq'
          ? `${EQ}の 3つの 角《かく》の 大《おお》きさは どう なって いますか。`
          : `${ISO}の 角《かく》の 大《おお》きさは どう なって いますか。`,
      hints: [
        '紙《かみ》で 作《つく》って、2つに おって 重《かさ》ねて みよう。',
        '重《かさ》なった 角《かく》は 大《おお》きさが 等《ひと》しいよ。',
        q === 'eq'
          ? '3つの 辺《へん》が 等《ひと》しいと、角《かく》は？'
          : '等《ひと》しい 2つの 辺《へん》の はしの 角《かく》を くらべよう。',
      ],
      explain:
        q === 'eq'
          ? `${EQ}は 3つの 角《かく》の 大《おお》きさが みんな 等《ひと》しいです。`
          : `${ISO}は 2つの 角《かく》の 大《おお》きさが 等《ひと》しいです。`,
      identity: `angle:prop:${q}`,
      alt: true,
      options:
        q === 'eq'
          ? [
              { label: '3つとも 等《ひと》しい', correct: true },
              { label: '2つだけ 等《ひと》しい', misconception: 'iso-vs-equi' },
              { label: 'みんな ちがう', misconception: 'angle-compare' },
            ]
          : [
              { label: '2つの 角《かく》が 等《ひと》しい', correct: true },
              { label: '3つとも 等《ひと》しい', misconception: 'iso-vs-equi' },
              { label: 'みんな ちがう', misconception: 'angle-compare' },
            ],
    };
  }
  // 角の大小（辺の長さに まどわされない）
  const degs = rng.sample([30, 45, 60, 90, 120, 135], 3).sort((a, b) => a - b);
  const [small, mid, big] = degs as [number, number, number];
  const k = rng.int(0, 3);
  return {
    engine: 'geometry',
    id: `angle:${degs.join('-')}`,
    objective: 'angle',
    level,
    prompt: 'いちばん 大《おお》きい 角《かく》は どれ？',
    hints: [
      '角《かく》の 大《おお》きさは、辺《へん》の 長《なが》さでは きまらないよ。',
      '2つの 辺《へん》の 開《ひら》きぐあいを くらべよう。',
      'いちばん 大《おお》きく 開《ひら》いて いるのは どれかな。',
    ],
    explain: `角《かく》の 大《おお》きさは 辺《へん》の 開《ひら》きぐあいで きまります。辺《へん》が 短《みじか》くても、いちばん 開《ひら》いて いる 角《かく》が いちばん 大《おお》きい 角《かく》です。`,
    identity: `angle:${degs.join('-')}`,
    alt: false,
    task: {
      kind: 'pick',
      options: [
        { shape: { points: angleShape(big, 2, k), closed: false }, correct: true },
        {
          shape: { points: angleShape(small, 6, k), closed: false },
          misconception: 'angle-by-side-length',
        },
        { shape: { points: angleShape(mid, 4, k), closed: false }, misconception: 'angle-compare' },
      ],
    },
  };
}

/** 円を使って かいた 三角形（中心と まわりの 2点） */
function circleTri(level: number, rng: Rng, alt: boolean): ChoiceItem | NumberItem {
  const r = rng.int(2, 9);
  let c = rng.int(1, 2 * r - 1);
  if (alt) {
    return {
      engine: 'number',
      id: `circle-alt:${r}:${c}`,
      objective: 'circle',
      level,
      prompt: `半径《はんけい》${r}cmの 円《えん》の 中心《ちゅうしん》アと、円《えん》の まわりの 点《てん》イ・ウを むすんで 三角形《さんかくけい》を かきました。辺《へん》イウは ${c}cmです。まわりの 長《なが》さは 何《なん》cmですか。`,
      hints: [
        '辺《へん》アイと 辺《へん》アウは、円《えん》の 何《なに》かな。',
        `どちらも 半径《はんけい》なので ${r}cm。`,
        `${r} ＋ ${r} ＋ ${c} を 計算《けいさん》しよう。`,
      ],
      explain: `辺《へん》アイと 辺《へん》アウは 半径《はんけい》で ${r}cm。まわりの 長《なが》さは ${r} ＋ ${r} ＋ ${c} ＝ ${2 * r + c}で ${2 * r + c}cmです。`,
      identity: `circle-len:${r}:${c}`,
      alt: true,
      fields: [{ label: 'cm', answer: { kind: 'int', value: 2 * r + c } }],
      wrongAnswers: wrongList(String(2 * r + c), 1, [
        [r + c, 'radius-equal'],
        [4 * r + c, 'radius-equal'],
      ]),
    };
  }
  if (rng.next() < 0.35) c = r;
  const kind = c === r ? 'eq' : 'iso';
  return {
    engine: 'choice',
    id: `circle:${r}:${c}`,
    objective: 'circle',
    level,
    prompt: `半径《はんけい》${r}cmの 円《えん》の 中心《ちゅうしん》と、円《えん》の まわりの 2つの 点《てん》を むすびました。2つの 点《てん》の あいだは ${c}cmです。できた 三角形《さんかくけい》は 何《なん》と いう 三角形《さんかくけい》ですか。`,
    hints: [
      '中心《ちゅうしん》から まわりの 点《てん》までの 長《なが》さは、どちらも 半径《はんけい》。',
      `2つの 辺《へん》が ${r}cm、のこりの 辺《へん》が ${c}cm。`,
      '等《ひと》しい 辺《へん》は いくつかな。',
    ],
    explain:
      kind === 'eq'
        ? `2つの 辺《へん》は 半径《はんけい》で ${r}cm、のこりも ${c}cm。3つの 辺《へん》が 等《ひと》しいので ${EQ}です。`
        : `2つの 辺《へん》が 半径《はんけい》で ${r}cmずつ 等《ひと》しいので ${ISO}です。`,
    identity: `circle:${r}:${c}`,
    alt: false,
    fixedOrder: true,
    options: [
      { label: ISO, ...(kind === 'iso' ? { correct: true } : { misconception: 'iso-vs-equi' }) },
      { label: EQ, ...(kind === 'eq' ? { correct: true } : { misconception: 'iso-vs-equi' }) },
      { label: NEITHER, misconception: 'radius-equal' },
    ],
  };
}

function sides(level: number, rng: Rng, alt: boolean): NumberItem {
  if (alt) {
    // まわりの 長さから 正三角形の 1辺
    const a = rng.int(2, 20);
    return {
      engine: 'number',
      id: `sides-alt:${a}`,
      objective: 'sides',
      level,
      prompt: `まわりの 長《なが》さが ${3 * a}cmの ${EQ}が あります。1つの 辺《へん》の 長《なが》さは 何《なん》cmですか。`,
      hints: [
        `${EQ}は 3つの 辺《へん》の 長《なが》さが 等《ひと》しいよ。`,
        `${3 * a}cmを 3つに 等《ひと》しく 分《わ》けよう。`,
        `${3 * a} ÷ 3 を 計算《けいさん》しよう。`,
      ],
      explain: `3つの 辺《へん》が 等《ひと》しいので、${3 * a} ÷ 3 ＝ ${a}で ${a}cmです。`,
      identity: `eq-rev:${a}`,
      alt: true,
      fields: [{ label: 'cm', answer: { kind: 'int', value: a } }],
      wrongAnswers: wrongList(String(a), 1, [
        [(3 * a) % 2 === 0 ? (3 * a) / 2 : null, 'equal-sides-forget'],
        [3 * a * 3, 'equal-sides-forget'],
      ]),
    };
  }
  const eq = rng.next() < 0.35;
  const a = rng.int(2, 15);
  let b = rng.int(1, 2 * a - 1);
  if (b === a) b = a + 1;
  const ans = eq ? 3 * a : 2 * a + b;
  return {
    engine: 'number',
    id: eq ? `sides:eq:${a}` : `sides:iso:${a}:${b}`,
    objective: 'sides',
    level,
    prompt: eq
      ? `1つの 辺《へん》が ${a}cmの ${EQ}の まわりの 長《なが》さは 何《なん》cmですか。`
      : `等《ひと》しい 2つの 辺《へん》が ${a}cmずつ、のこりの 辺《へん》が ${b}cmの ${ISO}の まわりの 長《なが》さは 何《なん》cmですか。`,
    hints: [
      eq
        ? `${EQ}は 3つの 辺《へん》が 等《ひと》しいよ。`
        : `${ISO}は 2つの 辺《へん》が 等《ひと》しいよ。`,
      eq
        ? `${a}cmの 辺《へん》が 3つ。`
        : `${a}cmの 辺《へん》が 2つと、${b}cmの 辺《へん》が 1つ。`,
      eq
        ? `${a} × 3 を 計算《けいさん》しよう。`
        : `${a} ＋ ${a} ＋ ${b} を 計算《けいさん》しよう。`,
    ],
    explain: eq
      ? `${a} × 3 ＝ ${ans}で ${ans}cmです。`
      : `${a} ＋ ${a} ＋ ${b} ＝ ${ans}で ${ans}cmです。`,
    identity: eq ? `eq:${a}` : `iso:${a}:${b}`,
    alt: false,
    fields: [{ label: 'cm', answer: { kind: 'int', value: ans } }],
    wrongAnswers: wrongList(String(ans), 1, [
      [eq ? 2 * a : a + b, 'equal-sides-forget'],
      [eq ? null : a + 2 * b, 'equal-sides-forget'],
    ]),
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['classify', 'sides'] },
  { objs: ['classify', 'angle', 'sides'] },
  { objs: ['angle', 'circle', 'classify'] },
  { objs: ['classify', 'angle', 'circle', 'sides'] },
];

export function generateTriangles(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.25;
  switch (obj) {
    case 'classify':
      return classify(level, rng, alt);
    case 'angle':
      return angle(level, rng, alt);
    case 'circle':
      return circleTri(level, rng, alt);
    case 'sides':
      return sides(level, rng, alt);
  }
}

export const triangles: UnitSpec = {
  id: 'g3.math.triangles',
  title: '二等辺三角形《にとうへんさんかくけい》と 正三角形《せいさんかくけい》',
  stage: 'g3',
  subject: 'math',
  domain: 'B-shape',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-shapes',
  prereq: ['g2.math.triangles-quads', 'g3.math.circle-sphere'],
  objectives: [
    { id: 'classify', title: '辺《へん》の 長《なが》さで なかま分《わ》け' },
    { id: 'angle', title: '角《かく》の 大《おお》きさ' },
    { id: 'circle', title: '円《えん》を つかって かいた 三角形《さんかくけい》' },
    { id: 'sides', title: 'まわりの 長《なが》さ' },
  ],
  misconceptions: [
    {
      id: 'iso-vs-equi',
      explain: `${ISO}と ${EQ}を とりちがえたのかな。2つの 辺《へん》が 等《ひと》しい → ${ISO}、3つの 辺《へん》が 等《ひと》しい → ${EQ}だよ。`,
    },
    {
      id: 'not-iso',
      explain:
        '辺《へん》の 長《なが》さを くらべまちがえたのかな。等《ひと》しい 長《なが》さの 辺《へん》が いくつ あるか、1つずつ たしかめよう。向《む》きが かわっても 形《かたち》の なかまは かわらないよ。',
    },
    {
      id: 'angle-by-side-length',
      explain:
        '辺《へん》が 長《なが》い ほうを 大《おお》きい 角《かく》と 考《かんが》えたのかな。角《かく》の 大《おお》きさは 辺《へん》の 長《なが》さでは なく、開《ひら》きぐあいで きまるよ。',
    },
    {
      id: 'angle-compare',
      explain:
        '開《ひら》きぐあいを くらべまちがえたのかな。2つの 角《かく》を 重《かさ》ねて みると くらべやすいよ。',
    },
    {
      id: 'radius-equal',
      explain:
        '中心《ちゅうしん》から まわりまでの 2つの 辺《へん》は、どちらも 半径《はんけい》で 長《なが》さが 等《ひと》しいよ。',
    },
    {
      id: 'equal-sides-forget',
      explain:
        '等《ひと》しい 辺《へん》の 数《かず》を まちがえたのかな。${ISO}は 2つ、${EQ}は 3つの 辺《へん》が 等《ひと》しいよ。'
          .replace('${ISO}', ISO)
          .replace('${EQ}', EQ),
    },
  ],
  levels: [
    { label: 'なかま分け・まわりの長さ', chance: 0.05 },
    { label: '角', chance: 0.05 },
    { label: '円を つかう', chance: 0.05 },
    { label: 'まとめ', chance: 0.05 },
  ],
  intro: [
    {
      text: `2つの 辺《へん》の 長《なが》さが 等《ひと》しい 三角形《さんかくけい》を ${ISO}、3つの 辺《へん》の 長《なが》さが みんな 等《ひと》しい 三角形《さんかくけい》を ${EQ}と いいます。`,
      figure: {
        kind: 'row',
        items: [
          {
            kind: 'shape',
            shape: 'polygon',
            points: [
              [10, 90],
              [90, 90],
              [50, 10],
            ],
          },
          { kind: 'shape', shape: 'triangle' },
        ],
        gap: 24,
      },
    },
    {
      text: '1つの ちょう点《てん》から 出《で》て いる 2つの 辺《へん》が つくる 形《かたち》を 角《かく》と いいます。角《かく》の 大《おお》きさは 辺《へん》の 開《ひら》きぐあいで きまり、辺《へん》の 長《なが》さでは きまりません。',
      figure: {
        kind: 'text',
        text: '開《ひら》きが 大《おお》きい ほど 大《おお》きい 角《かく》',
        size: 'l',
      },
    },
    {
      text: `円《えん》の 中心《ちゅうしん》と まわりの 2つの 点《てん》を むすぶと、2つの 辺《へん》が 半径《はんけい》に なるので ${ISO}が かけます。`,
      figure: { kind: 'shape', shape: 'circle' },
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateTriangles(level, rng, index),
  },
  review: 'objective',
  basis: '小学校学習指導要領（平成29年告示）算数 第3学年 B(1) 二等辺三角形・正三角形、角',
  revised: '2026-10-24',
};
