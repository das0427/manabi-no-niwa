/**
 * g4.en.directions 道《みち》あんない（curriculum-matrix 3.7。外活34 聞く）。設計書 docs/expansion/p2-design/en-g34.md の 3章。
 *   place: 場所の ことば／move: 道あんないの ことば／route: つづけて いう 道じゅん／goal: 地図で 場所を 見つける
 * 地図・道じゅんの 絵は listen の figure（svg）で 描く（map エンジンは 音声と 道じゅんに 使えないため。設計書 3.9）。
 * 同一性キー: 形式 × 英文（道じゅん・場面コード）。
 */
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { en, enText, listen, notHint, slugOf } from './lib';
import { NAMES } from './names';

const nm = (id: string): string => NAMES[id]!;
const pic = (id: string): ChoiceOption => ({ figure: { kind: 'illust', id }, label: nm(id) });

// ---------------------------------------------------------------- 図

export type MoveKind = 'straight' | 'right' | 'left' | 'stop' | 'on-right' | 'on-left';
export type Step = 'S' | 'R' | 'L';

const SVG_NS = 'xmlns="http://www.w3.org/2000/svg"';
const STROKE_ARROW = 'stroke="var(--sky-dark)" stroke-width="7" stroke-linecap="round" fill="none"';
const HEAD = 'fill="var(--sky-dark)"';

/** 1つの指示の絵（設計書 3.6 (1)） */
export function moveSvg(kind: MoveKind): Figure {
  const road =
    '<rect x="0" y="0" width="120" height="120" rx="12" fill="var(--paper-2)"/>' +
    '<rect x="45" y="0" width="30" height="120" fill="var(--white)"/>' +
    '<rect x="0" y="35" width="120" height="30" fill="var(--white)"/>';
  const start =
    '<polygon points="60,96 51,114 69,114" fill="var(--sun)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/>';
  const straight =
    `<polyline points="60,94 60,16" ${STROKE_ARROW}/>` +
    `<polygon points="60,4 51,18 69,18" ${HEAD}/>`;
  const building = (x: number) =>
    `<rect x="${x}" y="72" width="30" height="30" rx="4" fill="var(--sun)" stroke="var(--ink)" stroke-width="3"/>`;
  let arrow = '';
  let label = '';
  switch (kind) {
    case 'straight':
      arrow = straight;
      label = 'まっすぐ すすむ やじるし';
      break;
    case 'right':
      arrow =
        `<polyline points="60,94 60,50 102,50" ${STROKE_ARROW}/>` +
        `<polygon points="116,50 102,41 102,59" ${HEAD}/>`;
      label = '右《みぎ》に 曲《ま》がる やじるし';
      break;
    case 'left':
      arrow =
        `<polyline points="60,94 60,50 18,50" ${STROKE_ARROW}/>` +
        `<polygon points="4,50 18,41 18,59" ${HEAD}/>`;
      label = '左《ひだり》に 曲《ま》がる やじるし';
      break;
    case 'stop':
      arrow =
        `<polyline points="60,94 60,66" ${STROKE_ARROW}/>` +
        '<line x1="40" y1="58" x2="80" y2="58" stroke="var(--ink)" stroke-width="8" stroke-linecap="round"/>';
      label = 'とまる しるし';
      break;
    case 'on-right':
      arrow = straight + building(82);
      label = '右《みぎ》がわに ある たてもの';
      break;
    case 'on-left':
      arrow = straight + building(8);
      label = '左《ひだり》がわに ある たてもの';
      break;
  }
  return {
    kind: 'svg',
    markup: `<svg viewBox="0 0 120 120" ${SVG_NS}>${road}${arrow}${start}</svg>`,
    label,
  };
}

/** 交点 (i, j)。i=0..4, j=0..3 */
export type Cross = [i: number, j: number];
const DIRS: Cross[] = [
  [0, -1], // 上
  [1, 0], // 右
  [0, 1], // 下
  [-1, 0], // 左
];

/** スタート (2,3)・上向きから steps を歩いたときに通る交点の列（スタートを含む） */
export function walk(steps: Step[]): Cross[] {
  let [i, j]: Cross = [2, 3];
  let d = 0;
  const out: Cross[] = [[i, j]];
  for (const s of steps) {
    if (s === 'R') d = (d + 1) % 4;
    else if (s === 'L') d = (d + 3) % 4;
    i += DIRS[d]![0];
    j += DIRS[d]![1];
    out.push([i, j]);
  }
  return out;
}

/** 道じゅんの絵（設計書 3.6 (2)） */
export function routeSvg(steps: Step[]): Figure {
  const X = (i: number) => 20 + 50 * i;
  const Y = (j: number) => 20 + 50 * j;
  let roads = '';
  for (let i = 0; i <= 4; i++) roads += `<line x1="${X(i)}" y1="20" x2="${X(i)}" y2="170"/>`;
  for (let j = 0; j <= 3; j++) roads += `<line x1="20" y1="${Y(j)}" x2="220" y2="${Y(j)}"/>`;
  const pts = walk(steps);
  const poly = pts.map(([i, j]) => `${X(i)},${Y(j)}`).join(' ');
  const last = pts[pts.length - 1]!;
  const prev = pts[pts.length - 2]!;
  const dx = Math.sign(last[0] - prev[0]);
  const dy = Math.sign(last[1] - prev[1]);
  const tx = X(last[0]);
  const ty = Y(last[1]);
  const bx = tx - dx * 14;
  const by = ty - dy * 14;
  const head = `${tx},${ty} ${bx + dy * 8},${by + dx * 8} ${bx - dy * 8},${by - dx * 8}`;
  return {
    kind: 'svg',
    markup:
      `<svg viewBox="0 0 240 190" ${SVG_NS}>` +
      '<rect x="0" y="0" width="240" height="190" rx="12" fill="var(--paper-2)"/>' +
      `<g stroke="var(--white)" stroke-width="14" stroke-linecap="round">${roads}</g>` +
      `<polyline points="${poly}" ${STROKE_ARROW} stroke-linejoin="round"/>` +
      `<polygon points="${head}" ${HEAD}/>` +
      '<polygon points="120,158 111,176 129,176" fill="var(--sun)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/>' +
      '</svg>',
    label: '道《みち》じゅんの 図《ず》',
  };
}

export type PlaceCode = 'WN' | 'WS' | 'EN' | 'ES' | 'SW' | 'SE';
const PLACE_CENTER: Record<PlaceCode, [number, number]> = {
  WN: [40, 30],
  WS: [40, 140],
  EN: [280, 30],
  ES: [280, 140],
  SW: [105, 220],
  SE: [215, 220],
};
const turnPt = ([x, y]: [number, number]): [number, number] => [320 - x, 340 - y];

/** 画面での中心（turned なら 逆さの地図） */
export function placeCenter(code: PlaceCode, turned = false): [number, number] {
  const c = PLACE_CENTER[code];
  return turned ? turnPt(c) : c;
}

/** 4つの場所に A〜D を割り当てる（画面での y の小さい順、同じ y なら x の小さい順） */
export function townLetters(codes: PlaceCode[], turned = false): Record<string, string> {
  const sorted = [...codes].sort((p, q) => {
    const a = placeCenter(p, turned);
    const b = placeCenter(q, turned);
    return a[1] - b[1] || a[0] - b[0];
  });
  const out: Record<string, string> = {};
  sorted.forEach((c, k) => {
    out[c] = 'ABCD'[k]!;
  });
  return out;
}

export interface TownOpts {
  turned?: boolean;
  /** 解説の図: 道じゅんの 線を 描く 先の 場所 */
  route?: PlaceCode;
}

/** 地図（T字路。設計書 3.6 (3)） */
export function townSvg(codes: PlaceCode[], opts: TownOpts = {}): Figure {
  const turned = !!opts.turned;
  const rect = (x: number, y: number, w: number, h: number) => {
    const [rx, ry] = turned ? [320 - x - w, 340 - y - h] : [x, y];
    return `<rect x="${rx}" y="${ry}" width="${w}" height="${h}" fill="var(--white)"/>`;
  };
  const letters = townLetters(codes, turned);
  let s =
    '<svg viewBox="0 0 320 340" ' +
    SVG_NS +
    '>' +
    '<rect x="0" y="0" width="320" height="340" rx="12" fill="var(--paper-2)"/>' +
    rect(0, 60, 320, 50) +
    rect(135, 60, 50, 280);
  if (opts.route) {
    const goal = opts.route;
    const path: [number, number][] =
      goal === 'SW' || goal === 'SE'
        ? [
            [160, 300],
            [160, 220],
          ]
        : [[160, 300], [160, 85], goal[0] === 'W' ? [40, 85] : [280, 85]];
    const q = path.map((p) => (turned ? turnPt(p) : p));
    const a = q[q.length - 2]!;
    const b = q[q.length - 1]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / len;
    const uy = (b[1] - a[1]) / len;
    const bx = b[0] - ux * 16;
    const by = b[1] - uy * 16;
    const head = `${b[0]},${b[1]} ${bx - uy * 9},${by + ux * 9} ${bx + uy * 9},${by - ux * 9}`;
    s +=
      `<polyline points="${q.map((p) => p.join(',')).join(' ')}" fill="none" stroke="var(--sky-dark)" stroke-width="6" stroke-linejoin="round" stroke-dasharray="10 8"/>` +
      `<polygon points="${head}" ${HEAD}/>`;
  }
  for (const c of codes) {
    const [cx, cy] = placeCenter(c, turned);
    s +=
      `<rect x="${cx - 22}" y="${cy - 22}" width="44" height="44" rx="6" fill="var(--sun)" stroke="var(--ink)" stroke-width="3"/>` +
      `<text x="${cx}" y="${cy}" font-size="26" font-weight="700" fill="var(--ink)" text-anchor="middle" dominant-baseline="central">${letters[c]}</text>`;
  }
  // スタートの ▲（ふつうは 上向き、逆さの地図では 下向き）
  const tri = turned ? '160,50 172,24 148,24' : '160,290 148,316 172,316';
  const ty = turned ? 42 : 308;
  s +=
    `<polygon points="${tri}" fill="var(--sky-dark)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<text x="180" y="${ty}" font-size="16" font-weight="700" fill="var(--ink)" text-anchor="start">スタート</text>` +
    '</svg>';
  return {
    kind: 'svg',
    markup: s,
    label: '道《みち》の 地図《ちず》。スタートの しるしと、4つの 場所《ばしょ》が ある',
  };
}

// ---------------------------------------------------------------- 場所（place）

type PlaceRow = [text: string, c: string, w1: string, m1: string, w2: string, m2: string];
const PLACE_ROWS: PlaceRow[] = [
  [
    'Where is the station?',
    'life-station',
    'life-library',
    'place-word',
    'life-firestation',
    'part-word',
  ],
  [
    'Where is the fire station?',
    'life-firestation',
    'life-flowershop',
    'same-start',
    'life-station',
    'part-word',
  ],
  [
    'Where is the hospital?',
    'life-hospital',
    'life-police',
    'place-word',
    'life-library',
    'place-word',
  ],
  [
    'Where is the library?',
    'life-library',
    'life-hospital',
    'place-word',
    'life-bakery',
    'place-word',
  ],
  [
    'Where is the police box?',
    'life-police',
    'life-firestation',
    'place-word',
    'life-hospital',
    'place-word',
  ],
  [
    'Where is the bakery?',
    'life-bakery',
    'life-flowershop',
    'place-word',
    'life-library',
    'place-word',
  ],
  [
    'Where is the flower shop?',
    'life-flowershop',
    'life-firestation',
    'same-start',
    'life-vegeshop',
    'part-word',
  ],
];

function placeItems(): Item[] {
  return PLACE_ROWS.map(([text, c, w1, m1, w2, m2]) =>
    listen({
      id: `place:${slugOf(text)}`,
      objective: 'place',
      level: 0,
      prompt: 'たずねて いる 場所《ばしょ》は どれ？',
      audio: en('place', text),
      options: [
        { ...pic(c), correct: true },
        { ...pic(w1), misconception: m1 },
        { ...pic(w2), misconception: m2 },
      ],
      hints: [
        'さいごの ことばが 場所《ばしょ》の なまえだよ。',
        'ことばの はじめから おわりまで 聞《き》こう。にている ことばが あるよ。',
        notHint(nm(w1)),
      ],
      explain: `「${nm(c)}は どこですか」と たずねて います。`,
      explainFigure: enText(text),
      identity: `place:${slugOf(text)}`,
    }),
  );
}

type GoRow = [text: string, c: string, w1: string, m1: string, w2: string, m2: string];
const GO_ROWS: GoRow[] = [
  [
    "Let's go to the library.",
    'life-library',
    'life-hospital',
    'place-word',
    'life-bakery',
    'place-word',
  ],
  [
    "Let's go to the hospital.",
    'life-hospital',
    'life-police',
    'place-word',
    'life-library',
    'place-word',
  ],
  [
    "Let's go to the station.",
    'life-station',
    'life-police',
    'place-word',
    'life-firestation',
    'part-word',
  ],
  [
    "Let's go to the flower shop.",
    'life-flowershop',
    'life-firestation',
    'same-start',
    'life-vegeshop',
    'part-word',
  ],
];

function placeGoItems(): Item[] {
  return GO_ROWS.map(([text, c, w1, m1, w2, m2]) =>
    listen({
      id: `place-go:${slugOf(text)}`,
      objective: 'place',
      level: 0,
      prompt: 'いっしょに いこうと さそって いるよ。いく 場所《ばしょ》は どれ？',
      audio: en('place', text),
      options: [
        { label: nm(c), correct: true },
        { label: nm(w1), misconception: m1 },
        { label: nm(w2), misconception: m2 },
      ],
      hints: [
        'さいごの ことばが いく 場所《ばしょ》だよ。',
        'ことばの はじめから おわりまで 聞《き》こう。',
        notHint(nm(w1)),
      ],
      explain: `「${nm(c)}へ いこう」と いって います。`,
      explainFigure: enText(text),
      identity: `place-go:${slugOf(text)}`,
      alt: true,
    }),
  );
}

// ---------------------------------------------------------------- 指示（move）

const DIR_TEXT: Record<MoveKind, string> = {
  straight: 'Go straight.',
  right: 'Turn right.',
  left: 'Turn left.',
  stop: 'Stop.',
  'on-right': "It's on your right.",
  'on-left': "It's on your left.",
};
const MOVE_LABEL: Record<MoveKind, string> = {
  straight: 'まっすぐ すすむ',
  right: '右《みぎ》に 曲《ま》がる',
  left: '左《ひだり》に 曲《ま》がる',
  stop: 'とまる',
  'on-right': '右《みぎ》がわに ある',
  'on-left': '左《ひだり》がわに ある',
};
const H3_ONE =
  '曲《ま》がる ことばは 聞《き》こえなかったね。ことばが 1つか 2つかを 聞《き》きわけよう。';
const H3_TURN = '曲《ま》がる ことばだよ。右《みぎ》か 左《ひだり》かを 聞《き》きわけよう。';
const H3_SIDE =
  '場所《ばしょ》が どちらがわに あるかを いう ことばだよ。右《みぎ》か 左《ひだり》かを 聞《き》きわけよう。';

const MOVE_ROWS: [
  kind: MoveKind,
  w1: MoveKind,
  m1: string,
  w2: MoveKind,
  m2: string,
  h3: string,
  explain: string,
][] = [
  ['straight', 'stop', 'stop-go', 'right', 'turn-missed', H3_ONE, 'まっすぐ すすむ ことです。'],
  [
    'right',
    'left',
    'lr-swap',
    'on-right',
    'turn-side',
    H3_TURN,
    '右《みぎ》に 曲《ま》がる ことです。',
  ],
  [
    'left',
    'right',
    'lr-swap',
    'on-left',
    'turn-side',
    H3_TURN,
    '左《ひだり》に 曲《ま》がる ことです。',
  ],
  ['stop', 'straight', 'stop-go', 'left', 'turn-missed', H3_ONE, 'とまる ことです。'],
  [
    'on-right',
    'on-left',
    'lr-swap',
    'right',
    'turn-side',
    H3_SIDE,
    '右《みぎ》がわに ある ことです。',
  ],
  [
    'on-left',
    'on-right',
    'lr-swap',
    'left',
    'turn-side',
    H3_SIDE,
    '左《ひだり》がわに ある ことです。',
  ],
];

function moveItems(): Item[] {
  return MOVE_ROWS.map(([k, w1, m1, w2, m2, h3, ex]) => {
    const text = DIR_TEXT[k];
    return listen({
      id: `move:${slugOf(text)}`,
      objective: 'move',
      level: 0,
      prompt: '聞《き》こえた 道《みち》あんないに あう 絵《え》は どれ？',
      audio: en('dir', text),
      options: [
        { figure: moveSvg(k), correct: true },
        { figure: moveSvg(w1), misconception: m1 },
        { figure: moveSvg(w2), misconception: m2 },
      ],
      hints: [
        'あるく 人《ひと》に なった つもりで 聞《き》こう。',
        'はじめの ほうの ことばで「なにを するか」、さいごの ことばで「むき」が わかるよ。',
        h3,
      ],
      explain: ex,
      explainFigure: enText(text),
      identity: `move:${slugOf(text)}`,
    });
  });
}

function moveWordItems(): Item[] {
  return MOVE_ROWS.map(([k, w1, m1, w2, m2, h3, ex]) => {
    const text = DIR_TEXT[k];
    return listen({
      id: `move-word:${slugOf(text)}`,
      objective: 'move',
      level: 0,
      prompt: '聞《き》こえた 道《みち》あんないの いみは どれ？',
      audio: en('dir', text),
      options: [
        { label: MOVE_LABEL[k], correct: true },
        { label: MOVE_LABEL[w1], misconception: m1 },
        { label: MOVE_LABEL[w2], misconception: m2 },
      ],
      hints: [
        'あるく 人《ひと》に なった つもりで 聞《き》こう。',
        'はじめの ほうの ことばで「なにを するか」、さいごの ことばで「むき」が わかるよ。',
        h3,
      ],
      explain: ex,
      explainFigure: enText(text),
      identity: `move-word:${slugOf(text)}`,
      alt: true,
    });
  });
}

// ---------------------------------------------------------------- 道じゅん（route）

const STEP_TEXT: Record<Step, string> = { S: 'Go straight.', R: 'Turn right.', L: 'Turn left.' };
const STEP_JA: Record<Step, string> = {
  S: 'まっすぐ',
  R: '右《みぎ》に 曲《ま》がる',
  L: '左《ひだり》に 曲《ま》がる',
};
const STEP_SHORT: Record<Step, string> = {
  S: 'まっすぐ',
  R: '右《みぎ》',
  L: '左《ひだり》',
};

const sp = (s: string): Step[] => s.split('') as Step[];

/** [正答, lr-swap の誤り, もう1つの誤り, その誤概念, ヒント③] */
export const ROUTE_ROWS: [string, string, string, string, string][] = [
  ['SR', 'SL', 'RS', 'order-swap', '1つめは「まっすぐ」だよ。'],
  ['SL', 'SR', 'LS', 'order-swap', '1つめは「まっすぐ」だよ。'],
  ['RL', 'LR', 'R', 'step-missed', '1つめは「右《みぎ》に 曲《ま》がる」だよ。'],
  ['LR', 'RL', 'L', 'step-missed', '1つめは「左《ひだり》に 曲《ま》がる」だよ。'],
  ['RS', 'LS', 'SR', 'order-swap', '2つめは「まっすぐ」だよ。'],
  ['LS', 'RS', 'SL', 'order-swap', '2つめは「まっすぐ」だよ。'],
  ['SRL', 'SLR', 'SR', 'step-missed', '2つめは「右《みぎ》に 曲《ま》がる」だよ。'],
  ['SLR', 'SRL', 'SL', 'step-missed', '2つめは「左《ひだり》に 曲《ま》がる」だよ。'],
];

const routeEn = (s: string) => sp(s).map((x) => STEP_TEXT[x]);
const routeJa = (s: string) =>
  sp(s)
    .map((x) => STEP_JA[x])
    .join('、');
const routeShort = (s: string) =>
  sp(s)
    .map((x) => STEP_SHORT[x])
    .join(' → ');
const ROUTE_H1 = '▲から、あるく 人《ひと》に なった つもりで すすもう。';
const ROUTE_H2 =
  '曲《ま》がる ときは、あるく 人《ひと》から 見《み》た 右《みぎ》・左《ひだり》だよ。ことばは いくつ あったかな。';

function routeItems(): Item[] {
  return ROUTE_ROWS.map(([c, w1, w2, m2, h3]) =>
    listen({
      id: `route:${c}`,
      objective: 'route',
      level: 1,
      prompt: '道《みち》あんないを さいごまで 聞《き》こう。すすむ 道《みち》じゅんは どれ？',
      audio: routeEn(c).map((t) => en('dir', t)),
      gapMs: 600,
      options: [
        { figure: routeSvg(sp(c)), correct: true },
        { figure: routeSvg(sp(w1)), misconception: 'lr-swap' },
        { figure: routeSvg(sp(w2)), misconception: m2 },
      ],
      hints: [ROUTE_H1, ROUTE_H2, h3],
      explain: `「${routeJa(c)}」の じゅんに すすみます。`,
      explainFigure: enText(routeEn(c).join(' '), 'm'),
      identity: `route:${c}`,
    }),
  );
}

function routeWordItems(): Item[] {
  return ['SR', 'LR', 'RS', 'SLR'].map((c) => {
    const [, w1, w2, m2] = ROUTE_ROWS.find((r) => r[0] === c)!;
    return listen({
      id: `route-word:${c}`,
      objective: 'route',
      level: 1,
      prompt: '聞《き》こえた 道《みち》じゅんは どれ？',
      audio: routeEn(c).map((t) => en('dir', t)),
      gapMs: 600,
      options: [
        { label: routeShort(c), correct: true },
        { label: routeShort(w1!), misconception: 'lr-swap' },
        { label: routeShort(w2!), misconception: m2! },
      ],
      hints: [ROUTE_H1, ROUTE_H2, notHint(routeShort(w1!))],
      explain: `「${routeJa(c)}」の じゅんに すすみます。`,
      explainFigure: enText(routeEn(c).join(' '), 'm'),
      identity: `route-word:${c}`,
      alt: true,
    });
  });
}

// ---------------------------------------------------------------- 地図（goal）

export type GoalDir = Step | 'on-right' | 'on-left';
const GOAL_TEXT: Record<GoalDir, string> = {
  ...STEP_TEXT,
  'on-right': DIR_TEXT['on-right'],
  'on-left': DIR_TEXT['on-left'],
};

/** 音声の 指示（Step と 側）から ついた 場所を 決める（設計書 3.7 (g) の決め方） */
export function goalPos(dirs: GoalDir[]): PlaceCode {
  const turn = dirs.includes('R') ? 'R' : dirs.includes('L') ? 'L' : 'S';
  const right = dirs[dirs.length - 1] === 'on-right';
  if (turn === 'S') return right ? 'SE' : 'SW';
  if (turn === 'R') return right ? 'ES' : 'EN';
  return right ? 'WN' : 'WS';
}

interface GoalRow {
  code: string;
  dirs: GoalDir[];
  /** 誤り（場所・誤概念）。lr-swap の所は goal-turn では screen-view */
  wrong: [PlaceCode, 'side-lr' | 'lr-swap' | 'turn-missed'][];
}
export const GOAL_ROWS: GoalRow[] = [
  {
    code: 's-right',
    dirs: ['S', 'on-right'],
    wrong: [
      ['SW', 'side-lr'],
      ['ES', 'turn-missed'],
      ['WN', 'turn-missed'],
    ],
  },
  {
    code: 's-left',
    dirs: ['S', 'on-left'],
    wrong: [
      ['SE', 'side-lr'],
      ['WS', 'turn-missed'],
      ['EN', 'turn-missed'],
    ],
  },
  {
    code: 'sr-right',
    dirs: ['S', 'R', 'on-right'],
    wrong: [
      ['EN', 'side-lr'],
      ['WN', 'lr-swap'],
      ['SE', 'turn-missed'],
    ],
  },
  {
    code: 'sr-left',
    dirs: ['S', 'R', 'on-left'],
    wrong: [
      ['ES', 'side-lr'],
      ['WS', 'lr-swap'],
      ['SW', 'turn-missed'],
    ],
  },
  {
    code: 'sl-right',
    dirs: ['S', 'L', 'on-right'],
    wrong: [
      ['WS', 'side-lr'],
      ['ES', 'lr-swap'],
      ['SE', 'turn-missed'],
    ],
  },
  {
    code: 'sl-left',
    dirs: ['S', 'L', 'on-left'],
    wrong: [
      ['WN', 'side-lr'],
      ['EN', 'lr-swap'],
      ['SW', 'turn-missed'],
    ],
  },
];
/** 別例（逆さの地図）に 使う 4つの コード */
export const GOAL_TURN_CODES = ['sr-right', 'sr-left', 'sl-right', 'sl-left'];

const JA_SIDE = { R: '右《みぎ》', L: '左《ひだり》' } as const;

function goalItems(turned: boolean): Item[] {
  const rows = turned ? GOAL_ROWS.filter((r) => GOAL_TURN_CODES.includes(r.code)) : GOAL_ROWS;
  return rows.map((r) => {
    const correct = goalPos(r.dirs);
    const codes = [correct, ...r.wrong.map((w) => w[0])];
    const letters = townLetters(codes, turned);
    const turnDir = r.dirs.includes('R') ? 'R' : r.dirs.includes('L') ? 'L' : null;
    const side = r.dirs[r.dirs.length - 1] === 'on-right' ? 'R' : 'L';
    const options: ChoiceOption[] = codes.map((c, k) =>
      k === 0
        ? { label: letters[c]!, correct: true }
        : {
            label: letters[c]!,
            misconception:
              turned && r.wrong[k - 1]![1] === 'lr-swap' ? 'screen-view' : r.wrong[k - 1]![1],
          },
    );
    // 表の並び（A〜D の順）に そろえる
    options.sort((a, b) => a.label!.localeCompare(b.label!));
    const hint1 = turned
      ? 'スタートの ▲は 下《した》を むいて いるよ。あるく 人《ひと》に なった つもりで かんがえよう。'
      : '▲の むきに あるく 人《ひと》に なって かんがえよう。';
    const hint2 = turned
      ? '下《した》を むいて あるくと、あるく 人《ひと》の 右《みぎ》は 画面《がめん》の 左《ひだり》に なるよ。'
      : turnDir
        ? 'まっすぐ すすむと かどに つくよ。そこで 曲《ま》がる むきを 聞《き》こう。'
        : 'ことばは 2つ。曲《ま》がる ことばは あったかな。';
    const hint3 = turnDir
      ? `かどで ${JA_SIDE[turnDir]}に 曲《ま》がるよ。さいごの ことばで、道《みち》の どちらがわかを きめよう。`
      : 'あとは、道《みち》の 右《みぎ》がわか 左《ひだり》がわかを 聞《き》きわけよう。';
    const explain = turnDir
      ? `まっすぐ すすんで、かどを ${JA_SIDE[turnDir]}に 曲《ま》がると、${JA_SIDE[side]}がわに ある 場所《ばしょ》です。`
      : `まっすぐ すすむと、${JA_SIDE[side]}がわに ある 場所《ばしょ》です。`;
    return listen({
      id: `${turned ? 'goal-turn' : 'goal'}:${r.code}`,
      objective: 'goal',
      level: 2,
      prompt: turned
        ? 'こんどは ▲が 下《した》を むいて いるよ。つく 場所《ばしょ》は 地図《ちず》の どれ？'
        : '道《みち》あんないを 聞《き》こう。つく 場所《ばしょ》は 地図《ちず》の どれ？',
      figure: townSvg(codes, { turned }),
      audio: r.dirs.map((d) => en('dir', GOAL_TEXT[d])),
      gapMs: 600,
      options,
      fixedOrder: true,
      layout: 'row',
      hints: [hint1, hint2, hint3],
      explain,
      explainFigure: townSvg(codes, { turned, route: correct }),
      identity: `${turned ? 'goal-turn' : 'goal'}:${r.code}`,
      ...(turned ? { alt: true } : {}),
    });
  });
}

export const directions: UnitSpec = {
  id: 'g4.en.directions',
  title: '道《みち》あんない',
  stage: 'g4',
  subject: 'en',
  domain: 'en',
  kind: 'knowledge',
  priority: 'P2',
  status: 'ready',
  icon: 'mode-road',
  prereq: ['g4.en.time-days'],
  objectives: [
    { id: 'place', title: '場所《ばしょ》の ことばが わかる' },
    { id: 'move', title: '道《みち》あんないの ことばが わかる' },
    { id: 'route', title: 'つづけて いう 道《みち》じゅんが わかる' },
    {
      id: 'goal',
      title: '道《みち》あんないを 聞《き》いて 地図《ちず》で 場所《ばしょ》を 見《み》つける',
    },
  ],
  misconceptions: [
    {
      id: 'place-word',
      explain:
        'ほかの 場所《ばしょ》の ことばと おなじだと かんがえたのかな。さいごの ことばを もういちど 聞《き》こう。',
    },
    {
      id: 'part-word',
      explain:
        'ことばの 一部《いちぶ》が おなじなら おなじ 場所《ばしょ》だと かんがえたのかな。ことばの はじめから おわりまで 聞《き》こう。',
    },
    {
      id: 'same-start',
      explain:
        'はじめの 音《おと》が にている ことばと おなじだと かんがえたのかな。ことばの さいごまで 聞《き》こう。',
    },
    {
      id: 'lr-swap',
      explain:
        '右《みぎ》と 左《ひだり》を 反対《はんたい》に かんがえたのかな。右《みぎ》と 左《ひだり》の ことばを もういちど 聞《き》こう。',
    },
    {
      id: 'turn-side',
      explain:
        '「曲《ま》がる」と「〜がわに ある」を おなじだと かんがえたのかな。はじめの ことばで、曲《ま》がるのか、場所《ばしょ》を いって いるのかが わかるよ。',
    },
    {
      id: 'stop-go',
      explain:
        '「とまる」と「すすむ」を おなじだと かんがえたのかな。みじかい ことばか、2つの ことばかを 聞《き》こう。',
    },
    {
      id: 'turn-missed',
      explain:
        '曲《ま》がる ことばが あったか なかったかを とりちがえたのかな。ことばを 1つずつ かぞえて 聞《き》こう。',
    },
    {
      id: 'order-swap',
      explain:
        'ことばの じゅんばんを 入《い》れかえて かんがえたのかな。聞《き》こえた じゅんに すすもう。',
    },
    {
      id: 'step-missed',
      explain: 'とちゅうの ことばを 聞《き》きのがしたのかな。ことばは いくつ あったかな。',
    },
    {
      id: 'side-lr',
      explain:
        '道《みち》の 右《みぎ》がわと 左《ひだり》がわを 反対《はんたい》に かんがえたのかな。さいごに あるいた むきで、右《みぎ》・左《ひだり》を きめよう。',
    },
    {
      id: 'screen-view',
      explain:
        '画面《がめん》の 右《みぎ》・左《ひだり》で かんがえたのかな。あるく 人《ひと》が むいて いる ほうで、右《みぎ》・左《ひだり》を きめよう。',
    },
  ],
  levels: [
    { label: '場所《ばしょ》と 道《みち》の ことば', chance: 0.05 },
    { label: '道《みち》じゅん', chance: 0.05 },
    { label: '地図《ちず》で さがす', chance: 0.05 },
  ],
  intro: [
    {
      text: '道《みち》あんないの ことばを 聞《き》いて、すすむ 道《みち》を えらぶよ。',
      figure: enText('Go straight.', 'xl'),
    },
    {
      text: '▲が スタート。とがった ほうを むいて いるよ。曲《ま》がったら、つぎの かどまで すすむよ。',
      figure: routeSvg(['S', 'R']),
    },
    {
      text: '「〜がわに ある」は、さいごに あるいた 道《みち》の、あるく 人《ひと》から 見《み》た 右《みぎ》・左《ひだり》だよ。',
      figure: moveSvg('on-right'),
    },
  ],
  source: {
    kind: 'items',
    items: [
      ...placeItems(),
      ...placeGoItems(),
      ...moveItems(),
      ...moveWordItems(),
      ...routeItems(),
      ...routeWordItems(),
      ...goalItems(false),
      ...goalItems(true),
    ],
  },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）外国語活動 第3・4学年 聞くこと（身近で簡単な事柄に関する基本的な表現の意味が分かる）。言語の使用場面の例「道案内」',
  gradeIsAppProposal: true,
  revised: '2026-10-30',
};
