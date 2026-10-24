/**
 * g2.math.triangles-quads 三角形・四角形、長方形・正方形・直角三角形（curriculum-matrix 3.5）。
 * 点をつなぐ → 辺と頂点で仲間分け → 直角を見つける。
 *
 * エンジン: geometry（pick・draw）、sort（仲間分け）、number（辺・頂点の数）。
 * 正方形を長方形に含めるかは2年では扱わない（長方形を選ぶ問題に正方形を入れない）。
 * 同一性キー: 問う形 × 選択肢の形の組（順不同）／かく形と辺の長さ。形の向き・位置は同じとみる（1.4）。
 */
import type { Rng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { GeoOption, GeometryItem, Pt } from '../../engines/geometry/geometry';
import type { SortItem } from '../../engines/sort/sort';
import type { Item, NumberItem, UnitSpec } from '../../curriculum/types';
import { pickObj, wrongList } from './util';

type Obj = 'name' | 'parts' | 'right' | 'rectsq' | 'draw';
type Kind = 'tri' | 'quad' | 'open' | 'penta' | 'circle';

interface Shape {
  id: string;
  kind: Kind;
  points: Pt[];
}

/** 形の一覧（格子の座標。向き・位置は問わない） */
const SHAPES: Shape[] = [
  {
    id: 't1',
    kind: 'tri',
    points: [
      [0, 0],
      [4, 0],
      [2, 3],
    ],
  },
  {
    id: 't2',
    kind: 'tri',
    points: [
      [0, 0],
      [4, 0],
      [0, 3],
    ],
  },
  {
    // 直角に みえやすい かど（90°から 12°より ちかい かど）を つくらない（直角を さがす問題で まぎらわしい）
    id: 't3',
    kind: 'tri',
    points: [
      [0, 4],
      [1, 0],
      [5, 2],
    ],
  },
  {
    id: 't4',
    kind: 'tri',
    points: [
      [0, 0],
      [3, 0],
      [3, 4],
    ],
  },
  {
    id: 't5',
    kind: 'tri',
    points: [
      [1, 0],
      [4, 3],
      [0, 4],
    ],
  },
  {
    id: 't6',
    kind: 'tri',
    points: [
      [0, 0],
      [5, 1],
      [2, 3],
    ],
  },
  {
    id: 't7',
    kind: 'tri',
    points: [
      [0, 0],
      [0, 4],
      [2, 0],
    ],
  },
  {
    id: 't8',
    kind: 'tri',
    points: [
      [0, 0],
      [2, 0],
      [1, 4],
    ],
  },
  {
    id: 't9',
    kind: 'tri',
    points: [
      [0, 0],
      [5, 0],
      [5, 2],
    ],
  },
  {
    id: 't10',
    kind: 'tri',
    points: [
      [0, 0],
      [4, 0],
      [1, 3],
    ],
  },
  {
    id: 'q1',
    kind: 'quad',
    points: [
      [0, 0],
      [5, 0],
      [5, 3],
      [0, 3],
    ],
  },
  {
    id: 'q2',
    kind: 'quad',
    points: [
      [0, 0],
      [3, 0],
      [3, 3],
      [0, 3],
    ],
  },
  {
    id: 'q3',
    kind: 'quad',
    points: [
      [0, 0],
      [4, 0],
      [5, 3],
      [1, 3],
    ],
  },
  {
    id: 'q4',
    kind: 'quad',
    points: [
      [0, 0],
      [5, 0],
      [4, 3],
      [1, 3],
    ],
  },
  {
    id: 'q5',
    kind: 'quad',
    points: [
      [0, 1],
      [3, 0],
      [6, 4],
      [1, 4],
    ],
  },
  {
    id: 'q6',
    kind: 'quad',
    points: [
      [0, 0],
      [2, 0],
      [2, 4],
      [0, 4],
    ],
  },
  {
    id: 'q7',
    kind: 'quad',
    points: [
      [0, 0],
      [5, 1],
      [3, 4],
      [0, 3],
    ],
  },
  {
    id: 'q8',
    kind: 'quad',
    points: [
      [0, 0],
      [6, 0],
      [6, 2],
      [0, 2],
    ],
  },
  {
    id: 'q9',
    kind: 'quad',
    points: [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ],
  },
  {
    id: 'q10',
    kind: 'quad',
    points: [
      [2, 0],
      [4, 3],
      [2, 6],
      [0, 3],
    ],
  },
  {
    id: 'q11',
    kind: 'quad',
    points: [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ],
  },
  {
    id: 'q12',
    kind: 'quad',
    points: [
      [0, 0],
      [5, 0],
      [5, 3],
      [0, 4],
    ],
  },
  {
    id: 'o1',
    kind: 'open',
    points: [
      [0, 3],
      [2, 0],
      [4, 3],
    ],
  },
  {
    id: 'o2',
    kind: 'open',
    points: [
      [0, 0],
      [4, 0],
      [4, 3],
      [0, 3],
    ],
  },
  {
    id: 'o3',
    kind: 'open',
    points: [
      [0, 0],
      [4, 0],
      [1, 3],
    ],
  },
  {
    id: 'p1',
    kind: 'penta',
    points: [
      [2, 0],
      [4, 1.5],
      [3.2, 4],
      [0.8, 4],
      [0, 1.5],
    ],
  },
  {
    id: 'p2',
    kind: 'penta',
    points: [
      [0, 0],
      [4, 0],
      [4, 2],
      [2, 4],
      [0, 2],
    ],
  },
  { id: 'c1', kind: 'circle', points: [] },
];

const byKind = (k: Kind) => SHAPES.filter((s) => s.kind === k);
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const len2 = (a: Pt, b: Pt) => dot(sub(a, b), sub(a, b));

function rightCorners(ps: Pt[]): number {
  let n = 0;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]!;
    const a = ps[(i - 1 + ps.length) % ps.length]!;
    const b = ps[(i + 1) % ps.length]!;
    if (dot(sub(a, p), sub(b, p)) === 0) n++;
  }
  return n;
}
const isRect = (s: Shape) => s.kind === 'quad' && rightCorners(s.points) === 4;
const isSquare = (s: Shape) =>
  isRect(s) && len2(s.points[0]!, s.points[1]!) === len2(s.points[1]!, s.points[2]!);
const hasRight = (s: Shape) =>
  (s.kind === 'tri' || s.kind === 'quad') && rightCorners(s.points) > 0;

/** 図の形（Figure）: 0〜100 の枠に 縦横比を保って */
function shapeFig(s: Shape): Figure {
  if (s.kind === 'circle') return { kind: 'shape', shape: 'circle' };
  const xs = s.points.map((p) => p[0]);
  const ys = s.points.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  const k = 90 / Math.max(w, h);
  const pts = s.points.map(
    (p) =>
      [
        5 + (p[0] - Math.min(...xs)) * k + (90 - w * k) / 2,
        5 + (p[1] - Math.min(...ys)) * k + (90 - h * k) / 2,
      ] as [number, number],
  );
  if (s.kind === 'open') {
    const d = pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
      .join(' ');
    return {
      kind: 'svg',
      label: 'とじて いない せん',
      markup: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="${d}" fill="none" stroke="var(--ink)" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`,
    };
  }
  return { kind: 'shape', shape: 'polygon', points: pts };
}

function geoOption(s: Shape, correct: boolean, mis: string): GeoOption {
  const o: GeoOption =
    s.kind === 'circle' || s.kind === 'open'
      ? { figure: shapeFig(s) }
      : { shape: { points: s.points } };
  return correct ? { ...o, correct: true } : { ...o, misconception: mis };
}

/** 三角形・四角形を ぜんぶ選ぶ（alt: なかま分け） */
function name(level: number, rng: Rng, alt: boolean): GeometryItem | SortItem {
  const target: 'tri' | 'quad' = rng.next() < 0.5 ? 'tri' : 'quad';
  const tName = target === 'tri' ? 'さんかくけい' : 'しかくけい';
  const other: 'tri' | 'quad' = target === 'tri' ? 'quad' : 'tri';
  if (alt) {
    const cards = [
      ...rng.sample(byKind('tri'), 2),
      ...rng.sample(byKind('quad'), 2),
      rng.pick([...byKind('open'), ...byKind('penta'), ...byKind('circle')]),
    ];
    const ids = cards.map((c) => c.id).sort();
    return {
      engine: 'sort',
      id: `name-alt:${ids.join('-')}`,
      objective: 'name',
      level,
      prompt: 'さんかくけい・しかくけい・どちらでも ない に わけよう。',
      boxes: [{ label: 'さんかくけい' }, { label: 'しかくけい' }, { label: 'どちらでも ない' }],
      cards: cards.map((c, i) => ({
        figure: shapeFig(c),
        name: `かたち${i + 1}`,
        box: c.kind === 'tri' ? 0 : c.kind === 'quad' ? 1 : 2,
        wrongBoxes:
          c.kind === 'open'
            ? [
                { box: 0, misconception: 'not-closed' },
                { box: 1, misconception: 'not-closed' },
              ]
            : c.kind === 'circle'
              ? [{ box: 0, misconception: 'curved' }]
              : c.kind === 'penta'
                ? [{ box: 1, misconception: 'wrong-sides' }]
                : [{ box: c.kind === 'tri' ? 1 : 0, misconception: 'wrong-sides' }],
      })),
      hints: [
        'まっすぐな せんで かこまれて いるか、へんは いくつか を みよう。',
        '3つの まっすぐな せんで かこまれた かたちが さんかくけい、4つなら しかくけい。',
        'とじて いない かたちや、まるい ところが ある かたちは どちらでも ない。',
      ],
      explain:
        '3つの まっすぐな せん（へん）で かこまれた かたちが さんかくけい、4つで かこまれた かたちが しかくけい です。',
      identity: `name-sort:${ids.join('-')}`,
      alt: true,
    };
  }
  const nCorrect = rng.int(1, 2);
  const right = rng.sample(byKind(target), nCorrect);
  const pool = [...byKind(other), ...byKind('open'), ...byKind('penta'), ...byKind('circle')];
  const wrong = rng.sample(pool, 4 - nCorrect);
  const all = [...right, ...wrong];
  const ids = all.map((s) => s.id).sort();
  const misOf = (s: Shape) =>
    s.kind === 'open' ? 'not-closed' : s.kind === 'circle' ? 'curved' : 'wrong-sides';
  return {
    engine: 'geometry',
    id: `name:${target}:${ids.join('-')}`,
    objective: 'name',
    level,
    prompt: `${tName}を ぜんぶ えらぼう。`,
    hints: [
      'まっすぐな せんで ぐるりと かこまれて いるかな。',
      `${tName}は まっすぐな せん（へん）が ${target === 'tri' ? 3 : 4}つ。`,
      'へんの かずを かぞえて、とじて いるかも たしかめよう。',
    ],
    explain: `${target === 'tri' ? '3' : '4'}つの まっすぐな せんで かこまれた かたちが ${tName}です。とじて いない ものや まるい ものは ちがいます。`,
    identity: `name:${target}:${ids.join('-')}`,
    alt: false,
    task: {
      kind: 'pick',
      multi: true,
      options: all.map((s) => geoOption(s, right.includes(s), misOf(s))),
    },
  };
}

/** へん・ちょうてんの数（alt: 文で いくつかの 形の 数を あわせる） */
function parts(level: number, rng: Rng, alt: boolean): NumberItem {
  if (alt) {
    const kind = rng.next() < 0.5 ? 'tri' : 'quad';
    const k = rng.int(2, 5);
    const what = rng.next() < 0.5 ? 'へん' : 'ちょうてん';
    const n = kind === 'tri' ? 3 : 4;
    const nm = kind === 'tri' ? 'さんかくけい' : 'しかくけい';
    return {
      engine: 'number',
      id: `parts-alt:${kind}:${k}:${what}`,
      objective: 'parts',
      level,
      prompt: `${nm}が ${k}つ あります。${what}は ぜんぶで いくつ ありますか。`,
      fields: [{ answer: { kind: 'int', value: n * k } }],
      hints: [
        `${nm}の ${what}は いくつ かな。`,
        `1つの ${nm}に ${what}は ${n}つ。`,
        `${n}を ${k}かい たそう。`,
      ],
      // かけ算は この単元の前に習うとは かぎらないので、たし算で 説明する
      explain: `${nm} 1つに ${what}は ${n}つ。${Array.from({ length: k }, () => n).join(' ＋ ')} ＝ ${n * k}で ${n * k}こ です。`,
      identity: `parts-total:${kind}:${k}:${what}`,
      alt: true,
      wrongAnswers: wrongList(String(n * k), 1, [
        [n + k, 'count-skip'],
        [(7 - n) * k, 'wrong-sides'],
      ]),
    };
  }
  const s = rng.pick([...byKind('tri'), ...byKind('quad')]);
  const what = rng.next() < 0.5 ? 'へん' : 'ちょうてん';
  const n = s.points.length;
  return {
    engine: 'number',
    id: `parts:${s.id}:${what}`,
    objective: 'parts',
    level,
    prompt: `この かたちの ${what}は いくつ？`,
    figure: shapeFig(s),
    fields: [{ answer: { kind: 'int', value: n } }],
    hints: [
      what === 'へん'
        ? 'まっすぐな せんの ところが へん だよ。'
        : 'かどの てんが ちょうてん だよ。',
      `1つ かぞえたら しるしを つけて、ぐるりと 1しゅう しよう。`,
      'さいしょに かぞえた ところに もどったら おしまい。',
    ],
    explain: `${n === 3 ? 'さんかくけい' : 'しかくけい'}なので、${what}は ${n}つ です。`,
    identity: `parts:${s.id}:${what}`,
    alt: false,
    wrongAnswers: wrongList(String(n), 1, [
      [n + 1, 'count-again'],
      [n - 1, 'count-skip'],
    ]),
  };
}

/** 直角のある形 */
function right(level: number, rng: Rng, alt: boolean): GeometryItem {
  const cand = [...byKind('tri'), ...byKind('quad')];
  if (alt) {
    // 直角三角形を1つ選ぶ
    const yes = rng.pick(byKind('tri').filter(hasRight));
    const no = rng.sample(
      byKind('tri').filter((s) => !hasRight(s)),
      2,
    );
    const quad = rng.pick(byKind('quad').filter(isRect));
    const all = [yes, ...no, quad];
    const ids = all.map((s) => s.id).sort();
    return {
      engine: 'geometry',
      id: `right-alt:${ids.join('-')}`,
      objective: 'right',
      level,
      prompt: 'ちょっかくさんかくけいは どれ？',
      hints: [
        'さんかくじょうぎの ちょっかくの かどを あてて みよう。',
        'ちょっかくさんかくけいは、ちょっかくの かどが ある さんかくけい。',
        // 傾いた 直角三角形（t6）も あるので「たてと よこ」とは 言わない
        'さんかくけいの かどに、さんかくじょうぎを まわして あてて みよう。かたむいて いる かどにも あるよ。',
      ],
      explain: 'ちょっかくの かどが ある さんかくけいを ちょっかくさんかくけい と いいます。',
      identity: `right-one:${ids.join('-')}`,
      alt: true,
      task: {
        kind: 'pick',
        options: all.map((s) =>
          geoOption(s, s === yes, s.kind === 'quad' ? 'wrong-sides' : 'looks-right'),
        ),
      },
    };
  }
  let all: Shape[];
  do all = rng.sample(cand, 4);
  while (!all.some(hasRight) || all.every(hasRight));
  const ids = all.map((s) => s.id).sort();
  return {
    engine: 'geometry',
    id: `right:${ids.join('-')}`,
    objective: 'right',
    level,
    prompt: 'ちょっかくの かどが ある かたちを ぜんぶ えらぼう。',
    hints: [
      'おりがみを 2かい おって できる かどが ちょっかく だよ。',
      'かどに さんかくじょうぎの ちょっかくを あてて、ぴったりか たしかめよう。',
      // 傾いた 直角（t6・q5）も あるので「たてと よこ」とは 言わない
      'かたむいて いる かどにも、さんかくじょうぎを まわして あてて みよう。',
    ],
    explain: 'さんかくじょうぎの ちょっかくと ぴったり かさなる かどが ちょっかく です。',
    identity: `right:${ids.join('-')}`,
    alt: false,
    task: {
      kind: 'pick',
      multi: true,
      options: all.map((s) => geoOption(s, hasRight(s), 'looks-right')),
    },
  };
}

/** 長方形・正方形（alt: なかま分け） */
function rectsq(level: number, rng: Rng, alt: boolean): GeometryItem | SortItem {
  const sq = rng.next() < 0.5;
  const quads = byKind('quad');
  const rects = quads.filter((s) => isRect(s) && !isSquare(s));
  const squares = quads.filter(isSquare);
  const others = quads.filter((s) => !isRect(s));
  if (alt) {
    const cards = sq
      ? [...rng.sample(squares, 2), ...rng.sample(rects, 1), ...rng.sample(others, 2)]
      : [
          ...rng.sample(rects, 2),
          ...rng.sample(others, 2),
          rng.pick(byKind('tri').filter(hasRight)),
        ];
    const ids = cards.map((c) => c.id).sort();
    const nm = sq ? 'せいほうけい' : 'ちょうほうけい';
    return {
      engine: 'sort',
      id: `rectsq-alt:${sq ? 'sq' : 'rect'}:${ids.join('-')}`,
      objective: 'rectsq',
      level,
      prompt: `${nm}と、そうで ない かたちに わけよう。`,
      boxes: [{ label: nm }, { label: `${nm}で ない` }],
      cards: cards.map((c, i) => {
        const yes = sq ? isSquare(c) : isRect(c) && !isSquare(c);
        return {
          figure: shapeFig(c),
          name: `かたち${i + 1}`,
          box: yes ? 0 : 1,
          wrongBoxes: yes
            ? []
            : [
                {
                  box: 0,
                  misconception: isRect(c)
                    ? 'not-equal-sides'
                    : c.kind === 'tri'
                      ? 'wrong-sides'
                      : 'not-right-angle',
                },
              ],
        };
      }),
      hints: [
        'かどが みんな ちょっかくか しらべよう。',
        sq
          ? 'せいほうけいは、かどが みんな ちょっかくで、へんの ながさが みんな おなじ。'
          : 'ちょうほうけいは、4つの かどが みんな ちょっかくの しかくけい。',
        sq ? 'へんの ながさも くらべよう。' : 'かたむいた かどが ある しかくけいは ちがうよ。',
      ],
      explain: sq
        ? '4つの かどが みんな ちょっかくで、4つの へんの ながさが みんな おなじ しかくけいが せいほうけい です。'
        : '4つの かどが みんな ちょっかくの しかくけいが ちょうほうけい です。',
      identity: `rectsq-sort:${sq ? 'sq' : 'rect'}:${ids.join('-')}`,
      alt: true,
    };
  }
  const nCorrect = rng.int(1, 2);
  const yes = rng.sample(sq ? squares : rects, nCorrect);
  const pool = sq ? [...rects, ...others] : others;
  const no = rng.sample(pool, 4 - nCorrect);
  const all = [...yes, ...no];
  const ids = all.map((s) => s.id).sort();
  const nm = sq ? 'せいほうけい' : 'ちょうほうけい';
  return {
    engine: 'geometry',
    id: `rectsq:${sq ? 'sq' : 'rect'}:${ids.join('-')}`,
    objective: 'rectsq',
    level,
    prompt: `${nm}を ぜんぶ えらぼう。`,
    hints: [
      'かどが みんな ちょっかくか しらべよう。',
      sq
        ? 'せいほうけいは へんの ながさも みんな おなじ。'
        : 'ちょうほうけいは 4つの かどが みんな ちょっかく。',
      sq
        ? 'かどが みんな ちょっかくで、たてと よこの ながさが おなじ かたちを さがそう。'
        : 'かたむいた へんが ある かたちは ちがうよ。',
    ],
    explain: sq
      ? '4つの かどが みんな ちょっかくで、4つの へんが みんな おなじ ながさの しかくけいが せいほうけい です。'
      : '4つの かどが みんな ちょっかくの しかくけいが ちょうほうけい です。',
    identity: `rectsq:${sq ? 'sq' : 'rect'}:${ids.join('-')}`,
    alt: false,
    task: {
      kind: 'pick',
      multi: true,
      options: all.map((s) =>
        geoOption(s, yes.includes(s), isRect(s) ? 'not-equal-sides' : 'not-right-angle'),
      ),
    },
  };
}

/** 方眼に かく（alt: 名前を言わずに 性質で） */
function draw(level: number, rng: Rng, alt: boolean): GeometryItem {
  const kind = rng.int(0, 2);
  const grid = { w: 8, h: 4 };
  const mis = { wrongSides: 'draw-sides', wrongClass: 'not-right-angle' };
  if (kind === 0) {
    let w: number;
    let h: number;
    do {
      w = rng.int(2, 7);
      h = rng.int(1, 4);
    } while (w === h);
    return {
      engine: 'geometry',
      id: `draw${alt ? '-alt' : ''}:rect:${w}x${h}`,
      objective: 'draw',
      level,
      prompt: alt
        ? `4つの かどが みんな ちょっかくで、たて ${h}ます、よこ ${w}ますの しかくけいを かこう。`
        : `たて ${h}ます、よこ ${w}ますの ちょうほうけいを かこう。`,
      hints: [
        'てんを じゅんに タップして、さいごに さいしょの てんを タップしよう。',
        `よこに ${w}ます、たてに ${h}ます。`,
        'かどは みんな ちょっかく。ますの せんに そって かこう。',
      ],
      explain: `たて ${h}ます、よこ ${w}ますで、かどが みんな ちょっかくの しかくけい（ちょうほうけい）です。`,
      identity: `draw:rect:${Math.max(w, h)}x${Math.min(w, h)}`,
      alt,
      task: {
        kind: 'draw',
        grid,
        target: { kind: 'shape', shape: 'rectangle', sides: [h, w, h, w], exclusive: true },
      },
      misconceptions: mis,
    };
  }
  if (kind === 1) {
    const a = rng.int(1, 4);
    return {
      engine: 'geometry',
      id: `draw${alt ? '-alt' : ''}:square:${a}`,
      objective: 'draw',
      level,
      prompt: alt
        ? `4つの かどが みんな ちょっかくで、4つの へんが みんな ${a}ますの しかくけいを かこう。`
        : `1つの へんが ${a}ますの せいほうけいを かこう。`,
      hints: [
        'てんを じゅんに タップして、さいごに さいしょの てんを タップしよう。',
        `たても よこも ${a}ます。`,
        'かどは みんな ちょっかく。ますの せんに そって かこう。',
      ],
      explain: `4つの へんが みんな ${a}ますで、かどが みんな ちょっかくの しかくけい（せいほうけい）です。`,
      identity: `draw:square:${a}`,
      alt,
      task: { kind: 'draw', grid, target: { kind: 'shape', shape: 'square', sides: [a, a, a, a] } },
      misconceptions: mis,
    };
  }
  const a = rng.int(1, 7);
  const b = rng.int(1, 4);
  return {
    engine: 'geometry',
    id: `draw${alt ? '-alt' : ''}:righttri:${a}x${b}`,
    objective: 'draw',
    level,
    prompt: alt
      ? `ちょっかくの かどが あって、その かどを はさむ へんが よこ ${a}ます・たて ${b}ますの さんかくけいを かこう。`
      : `ちょっかくを はさむ へんが よこ ${a}ます、たて ${b}ますの ちょっかくさんかくけいを かこう。`,
    hints: [
      'さきに ちょっかくの かどに なる てんを きめよう。',
      `そこから よこに ${a}ます、たてに ${b}ます の てんを うとう。`,
      '3つの てんを むすんで、さいしょの てんに もどろう。',
    ],
    explain: `ちょっかくを はさむ へんが ${a}ますと ${b}ますの ちょっかくさんかくけい です。`,
    identity: `draw:righttri:${a}x${b}`,
    alt,
    task: {
      kind: 'draw',
      grid,
      target: { kind: 'shape', shape: 'right-triangle', sides: [a, b, Math.hypot(a, b)] },
    },
    misconceptions: mis,
  };
}

const LEVELS: { objs: Obj[] }[] = [
  { objs: ['name', 'parts'] },
  { objs: ['name', 'parts', 'right', 'rectsq'] },
  { objs: ['right', 'rectsq', 'draw', 'parts'] },
];

export function generateTrianglesQuads(level: number, rng: Rng, index: number): Item {
  const lv = LEVELS[Math.min(level, LEVELS.length - 1)]!;
  const obj = pickObj(rng, lv.objs, index);
  const alt = rng.next() < 0.3;
  switch (obj) {
    case 'name':
      return name(level, rng, alt);
    case 'parts':
      return parts(level, rng, alt);
    case 'right':
      return right(level, rng, alt);
    case 'rectsq':
      return rectsq(level, rng, alt);
    case 'draw':
      return draw(level, rng, alt);
  }
}

export const trianglesQuads: UnitSpec = {
  id: 'g2.math.triangles-quads',
  title: '三角形《さんかくけい》と 四角形《しかくけい》',
  stage: 'g2',
  subject: 'math',
  domain: 'B-shape',
  kind: 'concept',
  priority: 'P1',
  status: 'ready',
  icon: 'mode-shapes',
  prereq: ['g1.math.shapes'],
  objectives: [
    { id: 'name', title: 'さんかくけい・しかくけいを みわける' },
    { id: 'parts', title: 'へんと ちょうてんの かず' },
    { id: 'right', title: 'ちょっかくを みつける' },
    { id: 'rectsq', title: 'ちょうほうけい・せいほうけい' },
    { id: 'draw', title: 'ほうがんに かく' },
  ],
  misconceptions: [
    {
      id: 'not-closed',
      explain:
        'せんが とじて いないのに きづいたかな。まわりが ぐるりと つながって いる かたちだけが なかま だよ。',
    },
    {
      id: 'curved',
      explain:
        'まるい せんが あるね。さんかくけいや しかくけいは まっすぐな せんだけで かこまれて いるよ。',
    },
    {
      id: 'wrong-sides',
      explain: 'へんの かずを かぞえて みよう。3つなら さんかくけい、4つなら しかくけい だよ。',
    },
    {
      id: 'looks-right',
      explain:
        'ちょっかくに みえたのかな。さんかくじょうぎの ちょっかくを あてると、すこし ずれて いるよ。',
    },
    {
      id: 'not-right-angle',
      explain:
        'ちょっかくで ない かどが あるよ。4つの かど ぜんぶに さんかくじょうぎを あてて みよう。',
    },
    {
      id: 'not-equal-sides',
      explain:
        'かどは みんな ちょっかく だけど、へんの ながさが ちがうね。せいほうけいは 4つの へんが みんな おなじ ながさ。',
    },
    {
      id: 'count-again',
      explain: 'さいしょの ところを 2かい かぞえたのかな。かぞえた ところに しるしを つけよう。',
    },
    {
      id: 'count-skip',
      explain: 'かぞえわすれが あるのかな。1つずつ ゆびで おさえて かぞえよう。',
    },
    {
      id: 'draw-sides',
      explain: 'かたちは あって いるけれど、へんの ながさが ちがうよ。ますを かぞえなおそう。',
    },
  ],
  levels: [
    { label: 'さんかくけい・しかくけい', chance: 0.1 },
    { label: 'ちょっかく・ちょうほうけい', chance: 0.1 },
    { label: 'ほうがんに かく', chance: 0.05 },
  ],
  intro: [
    {
      text: '3つの てんを まっすぐな せんで つなぐと さんかくけい。4つの てんで しかくけい。',
      figure: { kind: 'row', items: [shapeFig(SHAPES[0]!), shapeFig(SHAPES[10]!)] },
    },
    {
      text: 'まわりの まっすぐな せんを へん、かどの てんを ちょうてん と いいます。',
      figure: shapeFig(SHAPES[2]!),
    },
    {
      text: 'おりがみを 2かい おって できる かどを ちょっかく と いいます。4つの かどが みんな ちょっかくの しかくけいが ちょうほうけい です。',
      figure: shapeFig(SHAPES.find((s) => s.id === 'q8')!),
    },
  ],
  source: {
    kind: 'generator',
    generate: ({ level, rng, index }) => generateTrianglesQuads(level, rng, index),
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第2学年 B(1) 三角形・四角形、正方形・長方形・直角三角形',
  revised: '2026-10-24',
};
