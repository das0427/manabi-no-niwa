/**
 * p23.think.road みち（curriculum-matrix 3.1。設計書 docs/expansion/p2-design/p23.md 4章）。
 * うさぎの いえから にんじんまでの みちの あいた 1マスに はいる みちを 2つから えらぶ（段階0のみ）。
 * 盤は経路（マスの並び）から描く。マスの形は前後への向きから計算する。色は CSS 変数だけ。
 * 同一性キー: 盤 ＋ 空きマス（別例は 盤 ＋ 差し替えるマス）。
 */
import type { Item, UnitSpec } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { choiceItem } from './lib';

type XY = [number, number];
type Dir = 'N' | 'E' | 'S' | 'W';
/** マスの形: 向きの組（N E S W の順に並べる）。EW よこ・NS たて・NE ES SW NW まがりかど */
export type Tile = 'EW' | 'NS' | 'NE' | 'ES' | 'SW' | 'NW';

const COLS = 4;
const ROWS = 3;
const CELL = 40;
const ROAD_W = 16;

export const BOARDS: Record<string, XY[]> = {
  B1: [
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
  ],
  B2: [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
    [2, 2],
    [3, 2],
  ],
  B3: [
    [0, 2],
    [1, 2],
    [1, 1],
    [1, 0],
    [2, 0],
    [3, 0],
  ],
  B4: [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
    [2, 2],
    [3, 2],
  ],
  B5: [
    [0, 1],
    [1, 1],
    [1, 0],
    [2, 0],
    [2, 1],
    [2, 2],
    [3, 2],
  ],
  B6: [
    [3, 0],
    [2, 0],
    [1, 0],
    [1, 1],
    [1, 2],
    [0, 2],
  ],
  B7: [
    [0, 2],
    [1, 2],
    [2, 2],
    [2, 1],
    [3, 1],
    [3, 0],
  ],
  B8: [
    [3, 2],
    [3, 1],
    [2, 1],
    [1, 1],
    [0, 1],
    [0, 0],
  ],
};

const DIR_OF = (from: XY, to: XY): Dir =>
  to[0] > from[0] ? 'E' : to[0] < from[0] ? 'W' : to[1] > from[1] ? 'S' : 'N';
const ORDER: Dir[] = ['N', 'E', 'S', 'W'];
const tileOf = (dirs: Dir[]): Tile => ORDER.filter((d) => dirs.includes(d)).join('') as Tile;

/** 途中のマス i の向き（前後への向き）。始点・終点は向きが1つ */
export function dirsAt(path: XY[], i: number): Dir[] {
  const out: Dir[] = [];
  if (i > 0) out.push(DIR_OF(path[i]!, path[i - 1]!));
  if (i < path.length - 1) out.push(DIR_OF(path[i]!, path[i + 1]!));
  return out;
}
/** 途中のマスの正しい形（経路から計算） */
export const tileAt = (path: XY[], i: number): Tile => tileOf(dirsAt(path, i));
export const tileAtXY = (path: XY[], at: XY): Tile =>
  tileAt(
    path,
    path.findIndex((c) => c[0] === at[0] && c[1] === at[1]),
  );

const armRect = (cx: number, cy: number, d: Dir): string => {
  const h = ROAD_W / 2;
  const r =
    d === 'N'
      ? [cx - h, cy - CELL / 2, ROAD_W, CELL / 2]
      : d === 'S'
        ? [cx - h, cy, ROAD_W, CELL / 2]
        : d === 'W'
          ? [cx - CELL / 2, cy - h, CELL / 2, ROAD_W]
          : [cx, cy - h, CELL / 2, ROAD_W];
  return r.join(' ');
};

/** 道の帯（中心の四角＋向きごとの半分の帯）。[x y w h] の並び */
function roadRects(cx: number, cy: number, dirs: Dir[]): string[] {
  const h = ROAD_W / 2;
  return [[cx - h, cy - h, ROAD_W, ROAD_W].join(' '), ...dirs.map((d) => armRect(cx, cy, d))];
}

const rectTag = (spec: string, attrs: string): string => {
  const [x, y, w, h] = spec.split(' ');
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${attrs}/>`;
};

/** 道の帯をまとめて描く（輪郭 → 中身の順で、つなぎ目の線が出ない） */
function roads(specs: string[]): string {
  return (
    specs
      .map((s) =>
        rectTag(
          s,
          'fill="var(--ink)" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round"',
        ),
      )
      .join('') + specs.map((s) => rectTag(s, 'fill="var(--wood)"')).join('')
  );
}

function ground(w: number, h: number): string {
  let g = '';
  for (let x = 0; x < w / CELL; x++)
    for (let y = 0; y < h / CELL; y++)
      g += `<rect x="${x * CELL}" y="${y * CELL}" width="${CELL}" height="${CELL}" fill="var(--paper)" stroke="var(--ink-soft)" stroke-width="1"/>`;
  return g;
}

function house(cx: number, cy: number): string {
  return (
    `<rect x="${cx - 8}" y="${cy - 3}" width="16" height="12" fill="var(--white)" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>` +
    `<polygon points="${cx - 11},${cy - 3} ${cx},${cy - 13} ${cx + 11},${cy - 3}" fill="var(--berry)" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>`
  );
}
function carrot(cx: number, cy: number): string {
  return (
    `<polygon points="${cx - 6},${cy - 7} ${cx + 6},${cy - 7} ${cx},${cy + 11}" fill="var(--berry)" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>` +
    [-5, 0, 5]
      .map(
        (dx) =>
          `<ellipse cx="${cx + dx}" cy="${cy - 11}" rx="2.5" ry="5" fill="var(--leaf)" stroke="var(--ink)" stroke-width="1.5"/>`,
      )
      .join('')
  );
}

export interface BoardOpts {
  /** そのマスを空ける */
  gap?: XY;
  /** そのマスの形を差し替える（別例の誤り） */
  replace?: { at: XY; tile: Tile };
}

const centre = (c: XY): XY => [c[0] * CELL + CELL / 2, c[1] * CELL + CELL / 2];
const same = (a: XY, b: XY) => a[0] === b[0] && a[1] === b[1];

export function boardFig(path: XY[], opts: BoardOpts = {}): Figure {
  const W = COLS * CELL;
  const H = ROWS * CELL;
  const rects: string[] = [];
  let top = '';
  let gapSvg = '';
  path.forEach((c, i) => {
    const [cx, cy] = centre(c);
    if (opts.gap && same(opts.gap, c)) {
      gapSvg += `<rect x="${c[0] * CELL + 4}" y="${c[1] * CELL + 4}" width="32" height="32" fill="var(--white)" stroke="var(--ink)" stroke-width="2" stroke-dasharray="4 4"/>`;
      return;
    }
    let dirs = dirsAt(path, i);
    if (opts.replace && same(opts.replace.at, c)) dirs = opts.replace.tile.split('') as Dir[];
    rects.push(...roadRects(cx, cy, dirs));
    if (i === 0) top += house(cx, cy);
    if (i === path.length - 1) top += carrot(cx, cy);
  });
  const label =
    'うさぎの いえから にんじんまでの みち。' +
    (opts.gap ? 'あいて いる ところが ひとつ ある。' : '');
  return {
    kind: 'svg',
    markup: `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${ground(W, H)}${roads(rects)}${gapSvg}${top}</svg>`,
    label,
  };
}

const TILE_LABEL: Record<Tile, string> = {
  EW: 'まっすぐ よこの みち',
  NS: 'まっすぐ たての みち',
  NE: 'まがる みち',
  ES: 'まがる みち',
  SW: 'まがる みち',
  NW: 'まがる みち',
};
export function tileFig(tile: Tile): Figure {
  const c = CELL / 2;
  return {
    kind: 'svg',
    markup: `<svg viewBox="0 0 ${CELL} ${CELL}" xmlns="http://www.w3.org/2000/svg">${ground(CELL, CELL)}${roads(roadRects(c, c, tile.split('') as Dir[]))}</svg>`,
    label: TILE_LABEL[tile],
  };
}

type Mis = 'rotated' | 'turn-instead' | 'straight-instead';
const HINTS_GAP: [string, string] = [
  'うさぎさんの いえから、みちを ゆびで たどって みよう。',
  'あいて いる ところの まえと うしろを みてね。みちは まっすぐかな、まがるかな。',
];

function gapItem(obj: 'straight' | 'turn', b: string, gap: XY, wrong: Tile, mis: Mis): Item {
  const path = BOARDS[b]!;
  const right = tileAtXY(path, gap);
  const id = `gap:${b}:${gap[0]}-${gap[1]}`;
  return choiceItem({
    id,
    identity: id,
    objective: obj,
    level: 0,
    prompt: 'あいて いる ところに はいるのは どっち？',
    figure: boardFig(path, { gap }),
    hints: HINTS_GAP,
    explain: `${obj === 'straight' ? 'まっすぐの' : 'まがる'} みちで つながったね。うさぎさんが にんじんまで いけるよ。`,
    explainFigure: boardFig(path),
    correct: { figure: tileFig(right) },
    wrong: [{ figure: tileFig(wrong), misconception: mis }],
  });
}

function wholeItem(obj: 'straight' | 'turn', b: string, at: XY, wrong: Tile, mis: Mis): Item {
  const path = BOARDS[b]!;
  const id = `whole:${b}:${at[0]}-${at[1]}`;
  return choiceItem({
    id,
    identity: id,
    objective: obj,
    level: 0,
    alt: true,
    prompt: 'にんじんまで いけるのは どっち？',
    hints: [
      'うさぎさんの いえから、みちを ゆびで たどって みよう。',
      'みちが とぎれて いる ところは ないかな。',
    ],
    explain: 'ぜんぶ つながって いるね。こっちなら にんじんまで いけるよ。',
    correct: { figure: boardFig(path) },
    wrong: [{ figure: boardFig(path, { replace: { at, tile: wrong } }), misconception: mis }],
  });
}

function build(): Item[] {
  return [
    gapItem('straight', 'B1', [1, 1], 'NS', 'rotated'),
    gapItem('straight', 'B2', [2, 1], 'NE', 'turn-instead'),
    gapItem('straight', 'B3', [1, 1], 'EW', 'rotated'),
    gapItem('straight', 'B4', [1, 2], 'NW', 'turn-instead'),
    gapItem('straight', 'B5', [2, 1], 'EW', 'rotated'),
    gapItem('straight', 'B6', [2, 0], 'NE', 'turn-instead'),
    gapItem('straight', 'B7', [1, 2], 'NS', 'rotated'),
    gapItem('straight', 'B8', [2, 1], 'SW', 'turn-instead'),
    gapItem('turn', 'B2', [2, 0], 'EW', 'straight-instead'),
    gapItem('turn', 'B3', [1, 0], 'NW', 'rotated'),
    gapItem('turn', 'B4', [0, 2], 'EW', 'straight-instead'),
    gapItem('turn', 'B5', [1, 1], 'ES', 'rotated'),
    gapItem('turn', 'B6', [1, 2], 'EW', 'straight-instead'),
    gapItem('turn', 'B7', [2, 1], 'NW', 'rotated'),
    gapItem('turn', 'B8', [0, 1], 'EW', 'straight-instead'),
    gapItem('turn', 'B5', [2, 0], 'NE', 'rotated'),
    wholeItem('straight', 'B1', [2, 1], 'NS', 'rotated'),
    wholeItem('straight', 'B4', [2, 2], 'NE', 'turn-instead'),
    wholeItem('straight', 'B6', [1, 1], 'EW', 'rotated'),
    wholeItem('turn', 'B3', [1, 2], 'EW', 'straight-instead'),
    wholeItem('turn', 'B7', [3, 1], 'ES', 'rotated'),
    wholeItem('turn', 'B8', [3, 1], 'NS', 'straight-instead'),
  ];
}

export const roadUnit: UnitSpec = {
  id: 'p23.think.road',
  title: 'みち',
  stage: 'p23',
  subject: 'think',
  domain: 'play',
  kind: 'play',
  priority: 'P2',
  status: 'ready',
  icon: 'mode-road',
  prereq: [],
  objectives: [
    { id: 'straight', title: 'まっすぐの みちで つなぐ' },
    { id: 'turn', title: 'まがる みちで つなぐ' },
  ],
  misconceptions: [
    {
      id: 'rotated',
      explain:
        'おなじ かたちの みちなら いいと かんがえたのかな。むきが ちがうと つながらないよ。となりの みちと くっつくか みて みよう。',
    },
    {
      id: 'straight-instead',
      explain:
        'まっすぐ いけば いいと かんがえたのかな。まえと うしろの みちを みると、ここで みちが まがるよ。',
    },
    {
      id: 'turn-instead',
      explain:
        'まがる みちで いいと かんがえたのかな。まえと うしろの みちを みると、ここは まっすぐ つなぐ ところだよ。',
    },
  ],
  levels: [{ label: '3さいの だんかい: 1マスを うめる（2つから）', chance: 0.5 }],
  intro: [
    {
      text: 'あいて いる ところに みちを いれると、うさぎさんが にんじんまで いけるよ。',
      figure: boardFig(BOARDS.B1!),
    },
  ],
  source: { kind: 'items', items: build() },
  review: 'none',
  basis:
    '本アプリ独自（試して つなぐ遊び）、curriculum-matrix 3.1・4.1（road の R1 を2〜3歳向けに縮小。道具と回転の代わりに2つの みちから選ぶ）',
  revised: '2026-10-30',
};
