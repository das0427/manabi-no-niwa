/**
 * g6.math.approx-area およその形と面積（curriculum-matrix 3.9。設計: docs/expansion/p2-design/math-g56.md 2章）。
 * 身の回りの形を 台形・円などと みて、公式で およその 面積を 求める。方眼で 数える。がい数で 見積もる。
 *
 * 手作り 48問（概念の基準 30）。エンジンは geometry（shape の pick）と choice・number（本体の 図つき。circle-area と同じ扱い）。
 * 円周率は 3.14。図の SVG の文字は 数字・英字だけ（A・B は 英字）。色は 線の種類と 文字でも 区別する。
 * 同一性キー: 到達項目 × 物（または 問題の名前）。
 */
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import type { GeometryItem } from '../../engines/geometry/geometry';
import type { Figure } from '../../engines/figure/types';
import { finishUnit, opts, r1, REVISED, STROKE, svg, svgText } from './util';

type ObjId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
type Overlay = 'fit' | 'big' | 'small' | 'wrong' | 'none';

const DASH = 'fill="none" stroke="var(--ink)" stroke-width="3" stroke-dasharray="8 5"';
const DOTS = 'fill="none" stroke="var(--ink)" stroke-width="3.5" stroke-dasharray="2 6"';
const AUX = 'stroke="var(--ink)" stroke-width="2" stroke-dasharray="3 4"';

type Draw = (style: string) => string;
const polygon =
  (pts: string): Draw =>
  (st) =>
    `<polygon points="${pts}" ${st}/>`;
const circle =
  (cx: number, cy: number, r: number): Draw =>
  (st) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" ${st}/>`;
const rectD =
  (x0: number, y0: number, x1: number, y1: number): Draw =>
  (st) =>
    `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" ${st}/>`;
const line = (x1: number, y1: number, x2: number, y2: number) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${AUX}/>`;

interface Obj {
  name: string;
  /** あてはめる 形の 名前 */
  fitName: string;
  outline: string;
  /** 輪郭に 足す 線（葉の 柄） */
  stem?: string;
  fit: Draw;
  /** 輪郭を 囲む 長方形（x0, y0, x1, y1） */
  bbox: [number, number, number, number];
  wrong: Draw;
  /** 長さの 補助線（lines）と 文字（labels）。ds は 単位つきの 文字の 配列 */
  dims: (ds: string[]) => Dims;
}

/**
 * 長さの 文字: [x, y, 文字, anchor, dx, dy]。x・y は 形の 座標（縮めた 形の 上の 位置）、dx・dy は 縮めたあとの 画面の 座標での ずれ。
 * 文字は 形の 縮め（SHRINK）の 外に 置く（字は 縮めない）。
 */
type Lab = [number, number, string, ('start' | 'middle')?, number?, number?];
interface Dims {
  lines: string;
  labels: Lab[];
}

export const OBJS: Record<ObjId, Obj> = {
  A: {
    name: '池',
    fitName: '台形',
    outline:
      'M 112 44 C 140 32 182 34 206 42 C 232 86 244 136 258 186 C 196 200 122 196 62 188 C 76 136 90 88 112 44 Z',
    fit: polygon('110,40 210,40 260,190 60,190'),
    bbox: [58, 34, 262, 196],
    wrong: circle(160, 115, 70),
    dims: (d) => ({
      lines: line(160, 40, 160, 190),
      labels: [
        [160, 40, d[0]!, 'middle', 0, -21],
        [160, 190, d[1]!, 'middle', 0, 21],
        [160, 115, d[2]!, 'start', 6, 0],
      ],
    }),
  },
  B: {
    name: '葉',
    fitName: 'ひし形',
    outline:
      'M 160 32 C 170 50 196 86 198 110 C 196 134 172 168 160 188 C 148 168 124 134 122 110 C 124 86 150 50 160 32 Z',
    stem: `<path d="M 160 188 L 160 208" fill="none" ${STROKE}/>`,
    fit: polygon('160,35 205,110 160,185 115,110'),
    bbox: [122, 32, 198, 188],
    wrong: polygon('160,35 210,188 110,188'),
    dims: (d) => ({
      lines: line(115, 110, 205, 110) + line(160, 35, 160, 185),
      labels: [
        [205, 110, d[0]!, 'start', 8, 0],
        [160, 35, d[1]!, 'start', 8, -6],
      ],
    }),
  },
  C: {
    name: '広場',
    fitName: '円',
    outline:
      'M 160 28 C 212 28 244 62 242 112 C 240 162 206 192 158 192 C 110 192 78 160 78 110 C 78 60 110 28 160 28 Z',
    fit: circle(160, 110, 80),
    bbox: [78, 28, 242, 192],
    wrong: polygon('160,30 240,190 80,190'),
    dims: (d) => ({
      lines: `<circle cx="160" cy="110" r="3" fill="var(--ink)"/>` + line(160, 110, 240, 110),
      labels: [[200, 110, d[0]!, 'middle', 0, -14]],
    }),
  },
  D: {
    name: '公園',
    fitName: '長方形',
    outline: 'M 60 54 L 150 46 L 262 52 L 268 118 L 262 170 L 160 176 L 54 168 L 50 112 Z',
    fit: rectD(55, 50, 265, 170),
    bbox: [50, 46, 268, 176],
    wrong: polygon('160,48 266,172 54,172'),
    dims: (d) => ({
      lines: '',
      labels: [
        [160, 176, d[0]!, 'middle', 0, 21],
        [268, 110, d[1]!, 'start', 8, 0],
      ],
    }),
  },
  E: {
    name: '畑',
    fitName: '平行四辺形',
    outline: 'M 92 54 L 192 46 L 286 50 L 260 112 L 230 172 L 128 166 L 32 168 L 62 108 Z',
    fit: polygon('90,50 290,50 230,170 30,170'),
    bbox: [32, 46, 286, 172],
    wrong: circle(160, 110, 60),
    dims: (d) => ({
      lines: line(90, 50, 90, 170),
      labels: [
        [130, 172, d[0]!, 'middle', 0, 21],
        [90, 110, d[1]!, 'start', 6, 0],
        ...(d[2] ? [[262, 108, d[2], 'start', 10, 0] as Lab] : []),
      ],
    }),
  },
  F: {
    name: '島',
    fitName: '三角形',
    outline: 'M 168 34 C 192 72 234 128 262 182 C 200 196 120 192 58 186 C 92 140 130 84 168 34 Z',
    fit: polygon('170,35 260,185 60,185'),
    bbox: [58, 34, 262, 196],
    wrong: circle(160, 120, 70),
    dims: (d) => ({
      lines: line(170, 35, 170, 185),
      labels: [
        [160, 190, d[0]!, 'middle', 0, 21],
        [170, 150, d[1]!, 'start', 6, 0],
      ],
    }),
  },
  G: {
    name: 'スケートリンク',
    fitName: '長方形と 半円 2つ',
    outline:
      'M 102 66 C 150 72 180 64 222 68 C 252 70 264 92 262 112 C 260 134 246 152 218 152 C 170 148 140 156 98 152 C 72 150 58 130 58 110 C 58 88 74 66 102 66 Z',
    fit: (st) =>
      `<path d="M 100 70 L 220 70 A 40 40 0 0 1 220 150 L 100 150 A 40 40 0 0 1 100 70 Z" ${st}/>`,
    bbox: [58, 64, 264, 156],
    wrong: polygon('160,60 262,156 58,156'),
    dims: (d) => ({
      lines: line(100, 70, 100, 150) + line(220, 70, 220, 150),
      labels: [
        [160, 154, d[0]!, 'middle', 0, 21],
        [100, 110, d[1]!, 'start', 6, 0],
      ],
    }),
  },
  H: {
    name: '湖',
    fitName: '円',
    outline:
      'M 156 30 C 204 26 246 66 240 116 C 236 160 200 194 152 190 C 108 188 76 154 80 108 C 82 62 114 32 156 30 Z',
    fit: circle(160, 110, 80),
    bbox: [76, 26, 246, 194],
    wrong: polygon('160,30 240,190 80,190'),
    dims: (d) => ({
      lines: line(80, 110, 240, 110),
      labels: [[160, 110, d[0]!, 'middle', 0, -14]],
    }),
  },
};

const outlineOf = (o: Obj) =>
  `<path d="${o.outline}" fill="var(--sky)" fill-opacity="0.6" ${STROKE}/>${o.stem ?? ''}`;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 重ねる 形（あてはめる 形・大きすぎる 形・小さすぎる 形・ちがう 種類の 形） */
function overlayOf(o: Obj, kind: Overlay): string {
  const [x0, y0, x1, y1] = o.bbox;
  switch (kind) {
    case 'fit':
      return o.fit(DASH);
    case 'big':
      return rectD(
        clamp(x0 - 20, 0, 320),
        clamp(y0 - 15, 0, 220),
        clamp(x1 + 20, 0, 320),
        clamp(y1 + 15, 0, 220),
      )(DASH);
    case 'small': {
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const w = (x1 - x0) * 0.45;
      const h = (y1 - y0) * 0.45;
      return rectD(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)(DASH);
    }
    case 'wrong':
      return o.wrong(DASH);
    default:
      return '';
  }
}

/** 長さの 文字を 入れる 図で、形を 縮める 割合（字を 最小に 保ちながら、図の 段の 高さに 入れる ため） */
const SHRINK = 0.8;
/** 長さの 文字を 入れる 図の 画布（x0, y0, x1, y1。縮めた 形と 字が 入る 大きさ） */
const CANVAS = [28, 16, 292, 212] as const;
/** 長さの 文字の 大きさ（viewBox の 単位） */
const DIM_FS = 22;

/**
 * 物の 図（輪郭、重ねる 形、長さ）。dims: null なら 長さを 描かない。
 * 長さを 描く ときは、形と 補助線を 縮めて（SHRINK）、字は 縮めずに 形の まわりに 置く。viewBox は 形と 字の 外接に 合わせる。
 */
function objFig(
  id: ObjId,
  opt: { overlay?: Overlay; dims?: string[] | null; label?: string } = {},
): Figure {
  const o = OBJS[id];
  const overlay = opt.overlay ?? 'fit';
  const shapes = outlineOf(o) + overlayOf(o, overlay);
  const label =
    opt.label ??
    (overlay === 'fit'
      ? `${o.name}の 形と、${o.fitName}と みた 形`
      : overlay === 'none'
        ? `${o.name}の 形`
        : `${o.name}の 形に 重ねた 図形`);
  const [bx0, by0, bx1, by1] = o.bbox;
  if (!opt.dims) {
    // 重ねる 形が 輪郭の まわりに はみ出す ぶん（big: 左右 20・上下 15）を 見込む。選択肢の どの 図も 同じ 大きさに する
    const pad = 6;
    let x0 = clamp(bx0 - 20, 0, 320) - pad;
    const y0 = clamp(by0 - 15, 0, 220) - pad;
    let x1 = clamp(bx1 + 20, 0, 320) + pad;
    const y1 = clamp(by1 + 15, 0, 220) + pad;
    // 細長い 形（葉など）は 選択肢の 札の 中で 縦に のびて 作業領域に 入らない。横に 余白を 足して、縦横の 比を 0.9 以上にする
    const minW = (y1 - y0) * 0.9;
    if (x1 - x0 < minW) {
      const d = (minW - (x1 - x0)) / 2;
      x0 -= d;
      x1 += d;
    }
    return svg(
      r1(x1 - x0),
      r1(y1 - y0),
      `<g transform="translate(${r1(-x0)} ${r1(-y0)})">${shapes}</g>`,
      label,
    );
  }
  const { lines, labels } = o.dims(opt.dims);
  const k = SHRINK;
  const mx = (x: number) => 160 + (x - 160) * k;
  const my = (y: number) => 110 + (y - 110) * k;
  // どの 物の 図も 同じ 大きさの 画布に する（2つ 並べても、同じ 縮尺で 見える）。字が はみ出す ときだけ 広げる
  let box: [number, number, number, number] = [
    Math.min(CANVAS[0], mx(bx0) - 4),
    Math.min(CANVAS[1], my(by0) - 4),
    Math.max(CANVAS[2], mx(bx1) + 4),
    Math.max(CANVAS[3], my(by1) + 4),
  ];
  let text = '';
  for (const [x, y, t, anchor = 'middle', dx = 0, dy = 0] of labels) {
    const tx = mx(x) + dx;
    const ty = my(y) + dy;
    text += svgText(tx, ty, t, DIM_FS, anchor);
    // 字の 外接（1字 ＝ 字の 大きさの 0.62）
    const tw = t.length * DIM_FS * 0.62;
    const x0 = anchor === 'start' ? tx : tx - tw / 2;
    const x1 = anchor === 'start' ? tx + tw : tx + tw / 2;
    box = [
      Math.min(box[0], x0 - 2),
      Math.min(box[1], ty - DIM_FS * 0.6),
      Math.max(box[2], x1 + 2),
      Math.max(box[3], ty + DIM_FS * 0.6),
    ];
  }
  const w = box[2] - box[0];
  const h = box[3] - box[1];
  const body =
    `<g transform="translate(${r1(-box[0])} ${r1(-box[1])})">` +
    `<g transform="translate(160 110) scale(${k}) translate(-160 -110)">${shapes}${lines}</g>` +
    `${text}</g>`;
  return svg(r1(w), r1(h), body, label);
}

/** 2つの 形 A・B を 重ねた 図（compare の c5〜c8） */
function twoFig(
  id: ObjId,
  a: { draw: Draw; at: [number, number] },
  b: { draw: Draw; at: [number, number] },
  label: string,
): Figure {
  const o = OBJS[id];
  const body =
    outlineOf(o) +
    a.draw(DASH) +
    b.draw(DOTS) +
    svgText(a.at[0], a.at[1], 'A', 18) +
    svgText(b.at[0], b.at[1], 'B', 18);
  return svg(320, 220, body, label);
}

// ---- 方眼 ----
type Pt = [number, number];
const inside = (pt: Pt, poly: Pt[]): boolean => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
/** 方眼 8×6 の ますを 数える。F: 全部 入る ます、P: かかる ます（各ますを 40×40 の点で 調べる） */
export function countCells(poly: Pt[]): { F: number; P: number } {
  let F = 0;
  let P = 0;
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 6; j++) {
      let n = 0;
      for (let u = 0; u < 40; u++)
        for (let v = 0; v < 40; v++)
          if (inside([i + (u + 0.5) / 40, j + (v + 0.5) / 40], poly)) n++;
      const f = n / 1600;
      if (f >= 0.999) F++;
      else if (f > 0) P++;
    }
  return { F, P };
}
/** 多角形の 面積（座標の 公式） */
export function polyArea(poly: Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]!;
    const [x2, y2] = poly[(i + 1) % poly.length]!;
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

function gridFig(poly: Pt[], label: string): Figure {
  let body = '';
  for (let i = 0; i <= 8; i++)
    body += `<line x1="${10 + i * 40}" y1="10" x2="${10 + i * 40}" y2="250" stroke="var(--ink)" stroke-width="${i === 0 || i === 8 ? 2 : 1}" stroke-opacity="${i === 0 || i === 8 ? 1 : 0.6}"/>`;
  for (let j = 0; j <= 6; j++)
    body += `<line x1="10" y1="${10 + j * 40}" x2="330" y2="${10 + j * 40}" stroke="var(--ink)" stroke-width="${j === 0 || j === 6 ? 2 : 1}" stroke-opacity="${j === 0 || j === 6 ? 1 : 0.6}"/>`;
  const pts = poly.map(([x, y]) => `${10 + x * 40},${10 + y * 40}`).join(' ');
  body += `<polygon points="${pts}" fill="var(--sky)" fill-opacity="0.6" ${STROKE}/>`;
  return svg(340, 260, body, label);
}

// ---- 問題の 部品 ----
const FORMULA_TEXT: Record<string, string> = {
  台形: '台形の 面積 ＝ (上底 ＋ 下底) × 高さ ÷ 2',
  ひし形: 'ひし形の 面積 ＝ 対角線 × 対角線 ÷ 2',
  円: '円の 面積 ＝ 半径 × 半径 × 3.14',
  長方形: '長方形の 面積 ＝ たて × 横',
  平行四辺形: '平行四辺形の 面積 ＝ 底辺 × 高さ',
  三角形: '三角形の 面積 ＝ 底辺 × 高さ ÷ 2',
};

type Base = {
  id: string;
  level: number;
  alt: boolean;
  objective: string;
  prompt: string;
  hints: [string, string, string];
  explain: string;
};
const mkBase = (b: Base) => ({
  id: b.id,
  identity: b.id,
  objective: b.objective,
  level: b.level,
  alt: b.alt,
  prompt: b.prompt,
  hints: b.hints,
  explain: b.explain,
});

const NAME_OF = (id: ObjId) => OBJS[id].name;

// ---- (1) shape: どの 図形と みるか（geometry の pick） ----
const SHAPE_HINT3: Record<ObjId, string> = {
  A: '上が せまく、下が 広い 形だね。',
  B: '上と 下が とがって いて、まん中が 広い 形だね。',
  C: 'かどが なく、まるい 形だね。',
  D: 'かどが 4つ あって、向かい合う 辺が 平行に 近い 形だね。',
  E: '上と 下の 辺が 平行で、横に ずれた 形だね。',
  F: '上が とがって いて、下が 広い 形だね。',
  G: 'まん中は まっすぐで、両はしが まるい 形だね。',
  H: 'かどが なく、まるい 形だね。',
};
const SHAPE_EXPLAIN: Record<ObjId, string> = {
  A: '池は 上が せまく 下が 広いので、台形と みると、はみ出す 部分と 足りない 部分が 同じ くらいに なります。',
  B: '葉は 上と 下が とがって いるので、ひし形と みると よく 合います。',
  C: '広場は まるいので、円と みると よく 合います。',
  D: '公園は 長方形に 近い 形です。大きな 長方形では はみ出す 部分が 多く なります。',
  E: '畑は 平行四辺形と みると よく 合います。',
  F: '島は 三角形と みると よく 合います。',
  G: '長方形と、両はしの 半円 2つを 合わせた 形と みると よく 合います。',
  H: '湖は 円と みると よく 合います。',
};
const SHAPE_ORDER: ObjId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/** shape の 選択肢の 図の 名前（どの 選択肢も 重ねた 形を そのまま 言う） */
const WRONG_NAME: Record<ObjId, string> = {
  A: '円',
  B: '三角形',
  C: '三角形',
  D: '三角形',
  E: '円',
  F: '円',
  G: '三角形',
  H: '三角形',
};
const shapeItems: GeometryItem[] = SHAPE_ORDER.map((id, n) => {
  const name = NAME_OF(id);
  const lab: Record<Overlay, string> = {
    fit: `${name}の 形に ${OBJS[id].fitName}を 重ねた 図`,
    big: `${name}の 形に 大きな 長方形を 重ねた 図`,
    small: `${name}の 形に 小さな 長方形を 重ねた 図`,
    wrong: `${name}の 形に ${WRONG_NAME[id]}を 重ねた 図`,
    none: `${name}の 形`,
  };
  const mk = (overlay: Overlay) => objFig(id, { overlay, dims: null, label: lab[overlay] });
  const options = [
    { figure: mk('big'), misconception: 'fit-big' },
    { figure: mk('small'), misconception: 'fit-small' },
    { figure: mk('wrong'), misconception: 'fit-shape' },
  ] as { figure: Figure; correct?: boolean; misconception?: string }[];
  // 正解の位置を 問題ごとに ずらす
  options.splice(n % 4, 0, { figure: mk('fit'), correct: true });
  return {
    engine: 'geometry',
    ...mkBase({
      id: `shape:${id}`,
      objective: 'shape',
      level: 0,
      alt: false,
      prompt: `${NAME_OF(id)}の 形を、どの 図形と みると よいですか。いちばん 合う ものを 選ぼう。`,
      hints: [
        '形の まわりの 線を よく 見よう。',
        'はみ出す 部分と 足りない 部分が 同じ くらいに なる 形が よいよ。',
        SHAPE_HINT3[id],
      ],
      explain: SHAPE_EXPLAIN[id],
    }),
    task: { kind: 'pick', options },
  };
});

// ---- (2) shape-alt: 言葉で 選ぶ ----
const SHAPE_ALT: [ObjId, string, [string, string][]][] = [
  [
    'C',
    '円',
    [
      ['三角形', 'fit-shape'],
      ['長方形', 'fit-shape'],
      ['ひし形', 'fit-shape'],
    ],
  ],
  [
    'F',
    '三角形',
    [
      ['円', 'fit-shape'],
      ['長方形', 'fit-shape'],
      ['平行四辺形', 'fit-shape'],
    ],
  ],
  [
    'B',
    'ひし形',
    [
      ['長方形', 'fit-shape'],
      ['円', 'fit-shape'],
      ['三角形', 'fit-shape'],
    ],
  ],
  [
    'G',
    '長方形と 半円 2つ',
    [
      ['長方形', 'combo-miss'],
      ['円', 'fit-shape'],
      ['三角形', 'fit-shape'],
    ],
  ],
];
const shapeAltItems: ChoiceItem[] = SHAPE_ALT.map(([id, right, wrongs]) => ({
  engine: 'choice',
  ...mkBase({
    id: `shape-alt:${id}`,
    objective: 'shape',
    level: 0,
    alt: true,
    prompt: `図の ${NAME_OF(id)}の 形は、どの 図形と みると、およその 面積を 求めやすいですか。`,
    hints: [
      '形の まわりの 線を よく 見よう。',
      'はみ出す 部分と 足りない 部分が 同じ くらいに なる 形が よいよ。',
      SHAPE_HINT3[id],
    ],
    explain: SHAPE_EXPLAIN[id],
  }),
  figure: objFig(id, { overlay: 'none', dims: null }),
  options: opts(right, wrongs),
}));

// ---- (3) formula ----
interface FormulaRow {
  id: ObjId;
  shape: string;
  dims: string[];
  right: string;
  wrongs: [string, string][];
  hint3: string;
}
const FORMULAS: FormulaRow[] = [
  {
    id: 'A',
    shape: '台形',
    dims: ['20m', '40m', '30m'],
    right: '(20 ＋ 40) × 30 ÷ 2',
    wrongs: [
      ['(20 ＋ 40) × 30', 'half-forgot'],
      ['20 × 40 × 30 ÷ 2', 'formula-mix'],
      ['20 ＋ 40 ＋ 30', 'perimeter'],
    ],
    hint3: '上底と 下底を たして、高さを かけて、…',
  },
  {
    id: 'B',
    shape: 'ひし形',
    dims: ['6cm', '10cm'],
    right: '6 × 10 ÷ 2',
    wrongs: [
      ['6 × 10', 'half-forgot'],
      ['6 ＋ 10', 'perimeter'],
      ['(6 ＋ 10) × 2', 'perimeter'],
    ],
    hint3: '2本の 対角線を かけて、…',
  },
  {
    id: 'C',
    shape: '円',
    dims: ['10m'],
    right: '10 × 10 × 3.14',
    wrongs: [
      ['10 × 2 × 3.14', 'circle-r2'],
      ['20 × 20 × 3.14', 'radius-diam'],
      ['10 × 10', 'formula-mix'],
    ],
    hint3: '半径 × 半径 × 3.14 に 10を あてはめよう。',
  },
  {
    id: 'D',
    shape: '長方形',
    dims: ['70m', '40m'],
    right: '40 × 70',
    wrongs: [
      ['40 ＋ 70', 'perimeter'],
      ['(40 ＋ 70) × 2', 'perimeter'],
      ['40 × 70 ÷ 2', 'formula-mix'],
    ],
    hint3: 'たてと 横を どう 計算するかな。',
  },
  {
    id: 'E',
    shape: '平行四辺形',
    dims: ['50m', '30m', '34m'],
    right: '50 × 30',
    wrongs: [
      ['50 × 34', 'slant-height'],
      ['50 × 30 ÷ 2', 'formula-mix'],
      ['(50 ＋ 34) × 2', 'perimeter'],
    ],
    hint3: '底辺と、底辺に 垂直な 高さを 使おう。',
  },
  {
    id: 'F',
    shape: '三角形',
    dims: ['8km', '6km'],
    right: '8 × 6 ÷ 2',
    wrongs: [
      ['8 × 6', 'half-forgot'],
      ['8 ＋ 6', 'perimeter'],
      ['(8 ＋ 6) × 6 ÷ 2', 'formula-mix'],
    ],
    hint3: '底辺 × 高さ を したあと、…',
  },
  {
    id: 'G',
    shape: '円',
    dims: ['40m', '20m'],
    right: '10 × 10 × 3.14',
    wrongs: [
      ['20 × 20 × 3.14', 'radius-diam'],
      ['10 × 10 × 3.14 × 2', 'semicircle'],
      ['10 × 10 × 3.14 ÷ 2', 'combo-miss'],
    ],
    hint3: '半円 2つを 合わせると 円 1つ。その 円の 半径は いくつかな。',
  },
  {
    id: 'H',
    shape: '円',
    dims: ['6km'],
    right: '3 × 3 × 3.14',
    wrongs: [
      ['6 × 6 × 3.14', 'radius-diam'],
      ['3 × 2 × 3.14', 'circle-r2'],
      ['6 × 3.14', 'circle-r2'],
    ],
    hint3: '半径は 直径の 半分。半径 × 半径 × 3.14 に あてはめよう。',
  },
];

const formulaItems: ChoiceItem[] = FORMULAS.map((r) => ({
  engine: 'choice',
  ...mkBase({
    id: `formula:${r.id}`,
    objective: 'formula',
    level: 0,
    alt: false,
    prompt:
      r.id === 'G'
        ? '図のように、スケートリンクを 長方形と 両はしの 半円 2つと みます。半円 2つ分の 面積を 求める 式は どれですか。'
        : `図のように、${NAME_OF(r.id)}を ${r.shape}と みます。およその 面積を 求める 式は どれですか。`,
    hints: ['何の 図形と みて いるかを 確かめよう。', FORMULA_TEXT[r.shape]!, r.hint3],
    explain:
      r.id === 'G'
        ? '半円 2つで 半径 10mの 円 1つ分。10 × 10 × 3.14 です。'
        : r.id === 'H'
          ? '半径は 6 ÷ 2 ＝ 3。3 × 3 × 3.14 です。'
          : `${r.shape}の 面積の 公式に あてはめると ${r.right} です。`,
  }),
  figure: objFig(r.id, { overlay: 'fit', dims: r.dims }),
  options: opts(r.right, r.wrongs),
  layout: 'column',
}));

// ---- (4) formula-alt ----
const FORMULA_ALT: {
  id: ObjId;
  prompt: string;
  shape: string;
  right: string;
  wrongs: [string, string][];
  hint3: string;
  explain: string;
}[] = [
  {
    id: 'A',
    prompt:
      '池を、上底 30m、下底 50m、高さ 40mの 台形と みます。およその 面積を 求める 式は どれですか。',
    shape: '台形',
    right: '(30 ＋ 50) × 40 ÷ 2',
    wrongs: [
      ['(30 ＋ 50) × 40', 'half-forgot'],
      ['30 × 50 × 40 ÷ 2', 'formula-mix'],
      ['30 ＋ 50 ＋ 40', 'perimeter'],
    ],
    hint3: '上底と 下底を たして、高さを かけて、…',
    explain: '台形の 面積の 公式に あてはめると (30 ＋ 50) × 40 ÷ 2 です。',
  },
  {
    id: 'B',
    prompt: '葉を、対角線が 8cmと 12cmの ひし形と みます。およその 面積を 求める 式は どれですか。',
    shape: 'ひし形',
    right: '8 × 12 ÷ 2',
    wrongs: [
      ['8 × 12', 'half-forgot'],
      ['8 ＋ 12', 'perimeter'],
      ['(8 ＋ 12) × 2', 'perimeter'],
    ],
    hint3: '2本の 対角線を かけて、…',
    explain: 'ひし形の 面積の 公式に あてはめると 8 × 12 ÷ 2 です。',
  },
  {
    id: 'F',
    prompt: '島を、底辺 10km、高さ 7kmの 三角形と みます。およその 面積を 求める 式は どれですか。',
    shape: '三角形',
    right: '10 × 7 ÷ 2',
    wrongs: [
      ['10 × 7', 'half-forgot'],
      ['10 ＋ 7', 'perimeter'],
      ['(10 ＋ 7) × 7 ÷ 2', 'formula-mix'],
    ],
    hint3: '底辺 × 高さ を したあと、…',
    explain: '三角形の 面積の 公式に あてはめると 10 × 7 ÷ 2 です。',
  },
  {
    id: 'H',
    prompt: '湖を、直径 8kmの 円と みます。およその 面積を 求める 式は どれですか。',
    shape: '円',
    right: '4 × 4 × 3.14',
    wrongs: [
      ['8 × 8 × 3.14', 'radius-diam'],
      ['4 × 2 × 3.14', 'circle-r2'],
      ['8 × 3.14', 'circle-r2'],
    ],
    hint3: '半径は 直径の 半分。半径 × 半径 × 3.14 に あてはめよう。',
    explain: '半径は 8 ÷ 2 ＝ 4。4 × 4 × 3.14 です。',
  },
];
const formulaAltItems: ChoiceItem[] = FORMULA_ALT.map((r) => ({
  engine: 'choice',
  ...mkBase({
    id: `formula-alt:${r.id}`,
    objective: 'formula',
    level: 0,
    alt: true,
    prompt: r.prompt,
    hints: ['何の 図形と みて いるかを 確かめよう。', FORMULA_TEXT[r.shape]!, r.hint3],
    explain: r.explain,
  }),
  options: opts(r.right, r.wrongs),
  layout: 'column',
}));

// ---- (5) estimate ----
const NOTE = 'およその 面積なので、少し ちがっても よいよ。';
interface EstRow {
  id: ObjId;
  unit: string;
  value: number;
  tol: number;
  dims: string[];
  shape: string;
  expl: string;
  hint2?: string;
  hint3: string;
  wrongs: [number, string][];
  pi?: boolean;
}
const ESTIMATES: EstRow[] = [
  {
    id: 'A',
    unit: 'm²',
    value: 900,
    tol: 90,
    dims: ['20m', '40m', '30m'],
    shape: '台形',
    expl: '(20 ＋ 40) × 30 ÷ 2 ＝ 900。池の 面積は 約 900m²です。',
    hint3: '(20 ＋ 40) × 30 ＝ 1800。この あとは？',
    wrongs: [
      [1800, 'half-forgot'],
      [90, 'perimeter'],
      [12000, 'formula-mix'],
    ],
  },
  {
    id: 'B',
    unit: 'cm²',
    value: 30,
    tol: 3,
    dims: ['6cm', '10cm'],
    shape: 'ひし形',
    expl: '6 × 10 ÷ 2 ＝ 30。葉の 面積は 約 30cm²です。',
    hint3: '6 × 10 ＝ 60。この あとは？',
    wrongs: [
      [60, 'half-forgot'],
      [16, 'perimeter'],
    ],
  },
  {
    id: 'C',
    unit: 'm²',
    value: 314,
    tol: 31,
    dims: ['10m'],
    shape: '円',
    expl: '10 × 10 × 3.14 ＝ 314。広場の 面積は 約 314m²です。',
    hint3: '10 × 10 ＝ 100。これに 何《なに》を かけるかな。',
    wrongs: [
      [62.8, 'circle-r2'],
      [1256, 'radius-diam'],
      [100, 'formula-mix'],
    ],
    pi: true,
  },
  {
    id: 'D',
    unit: 'm²',
    value: 2800,
    tol: 280,
    dims: ['70m', '40m'],
    shape: '長方形',
    expl: '40 × 70 ＝ 2800。公園の 面積は 約 2800m²です。',
    hint3: 'たて 40m、横 70m を あてはめよう。',
    wrongs: [
      [110, 'perimeter'],
      [220, 'perimeter'],
      [1400, 'formula-mix'],
    ],
  },
  {
    id: 'E',
    unit: 'm²',
    value: 1500,
    tol: 150,
    dims: ['50m', '30m', '34m'],
    shape: '平行四辺形',
    expl: '50 × 30 ＝ 1500。畑の 面積は 約 1500m²です。',
    hint3: '34m は ななめの 辺。高さは 30m だよ。',
    wrongs: [
      [1700, 'slant-height'],
      [750, 'formula-mix'],
      [168, 'perimeter'],
    ],
  },
  {
    id: 'F',
    unit: 'km²',
    value: 24,
    tol: 2.4,
    dims: ['8km', '6km'],
    shape: '三角形',
    expl: '8 × 6 ÷ 2 ＝ 24。島の 面積は 約 24km²です。',
    hint3: '8 × 6 ＝ 48。この あとは？',
    wrongs: [
      [48, 'half-forgot'],
      [14, 'perimeter'],
    ],
  },
  {
    id: 'G',
    unit: 'm²',
    value: 1114,
    tol: 111,
    dims: ['40m', '20m'],
    shape: '長方形と 両はしの 半円 2つ',
    expl: '20 × 40 ＋ 10 × 10 × 3.14 ＝ 800 ＋ 314 ＝ 1114。約 1114m²です。',
    hint2: '長方形の 面積 ＝ たて × 横、円の 面積 ＝ 半径 × 半径 × 3.14',
    hint3: '長方形は 20 × 40 ＝ 800。半円 2つで 半径 10mの 円 1つ分。',
    wrongs: [
      [800, 'combo-miss'],
      [957, 'combo-miss'],
      [1428, 'semicircle'],
      [2056, 'radius-diam'],
    ],
    pi: true,
  },
  {
    id: 'H',
    unit: 'km²',
    value: 28.26,
    tol: 2.8,
    dims: ['6km'],
    shape: '円',
    expl: '半径は 6 ÷ 2 ＝ 3。3 × 3 × 3.14 ＝ 28.26。湖の 面積は 約 28.26km²です。',
    hint3: '半径は 6 ÷ 2 ＝ 3。3 × 3 ＝ 9。これに …',
    wrongs: [
      [113.04, 'radius-diam'],
      [18.84, 'circle-r2'],
    ],
    pi: true,
  },
];

/** 許容の 外で、答えと ちがい、重ならない 誤答だけ 残す */
function outsideWrong(value: number, tol: number, cands: [number, string][]) {
  const out: { value: string; misconception: string }[] = [];
  for (const [v, m] of cands) {
    if (Math.abs(v - value) <= tol + 1e-9) continue;
    if (out.some((w) => Number(w.value) === v)) continue;
    out.push({ value: String(v), misconception: m });
  }
  return out;
}

function estItem(
  o: Omit<NumberItem, 'engine' | 'fields' | 'keys'> & {
    unit: string;
    value: number;
    tol: number;
    wrongs: [number, string][];
  },
): NumberItem {
  const { unit, value, tol, wrongs, ...rest } = o;
  return {
    engine: 'number',
    ...rest,
    fields: [{ label: '約', unit, answer: { kind: 'quantity', value, unit, tolerance: tol } }],
    keys: ['decimal'],
    wrongAnswers: outsideWrong(value, tol, wrongs),
  };
}

const estimateItems: NumberItem[] = ESTIMATES.map((r) =>
  estItem({
    ...mkBase({
      id: `estimate:${r.id}`,
      objective: 'estimate',
      level: 1,
      alt: false,
      prompt: `図のように、${NAME_OF(r.id)}を ${r.shape}と みて、およその 面積を 求めよう。${r.pi ? '円周率は 3.14と します。' : ''}`,
      hints: ['どの 図形と みたかを 確かめよう。', r.hint2 ?? FORMULA_TEXT[r.shape]!, r.hint3],
      explain: r.expl + NOTE,
    }),
    figure: objFig(r.id, { overlay: 'fit', dims: r.dims }),
    unit: r.unit,
    value: r.value,
    tol: r.tol,
    wrongs: r.wrongs,
  }),
);

// ---- (6) estimate-alt: 方眼で 数える ----
const GRIDS: { id: string; name: string; poly: Pt[]; F: number; P: number }[] = [
  {
    id: 'g1',
    name: '葉',
    poly: [
      [4, 0.4],
      [5.6, 1.4],
      [6.6, 3],
      [5.6, 4.6],
      [4, 5.6],
      [2.4, 4.6],
      [1.4, 3],
      [2.4, 1.4],
    ],
    F: 12,
    P: 12,
  },
  {
    id: 'g2',
    name: '池',
    poly: [
      [2, 0.5],
      [6, 0.5],
      [7.5, 3],
      [6, 5.5],
      [2, 5.5],
      [0.5, 3],
    ],
    F: 16,
    P: 24,
  },
  {
    id: 'g3',
    name: '島',
    poly: [
      [3.5, 0.5],
      [5.5, 2.5],
      [7.5, 5.5],
      [0.5, 5.5],
      [1.5, 2.5],
    ],
    F: 12,
    P: 19,
  },
  {
    id: 'g4',
    name: '水たまり',
    poly: [
      [1.5, 0.5],
      [4.5, 0.5],
      [7.5, 2.5],
      [7.5, 4.5],
      [5.5, 5.5],
      [2.5, 5.5],
      [0.5, 3.5],
    ],
    F: 18,
    P: 21,
  },
];

/** 設計で 数えた 値（テストで countCells と 一致を 確かめる） */
export const GRID_TABLE = GRIDS.map((g) => ({ id: g.id, F: g.F, P: g.P, poly: g.poly }));

const estimateAltItems: NumberItem[] = GRIDS.map((g) => {
  const { F, P } = countCells(g.poly);
  const value = F + P / 2;
  return estItem({
    ...mkBase({
      id: `estimate-alt:${g.id}`,
      objective: 'estimate',
      level: 1,
      alt: true,
      prompt: `図は ${g.name}の 形を 方眼に かいた ものです。方眼の 1ますは 1cm²です。形の 中に 全部 入って いる ますは 1、形に かかって いる ますは 0.5と して、およその 面積を 求めよう。`,
      hints: [
        '形の 中に 全部 入って いる ますを 数えよう。',
        `全部 入って いる ますは ${F}こ、形に かかって いる ますは ${P}こ だよ。`,
        `${F} ＋ ${P} × 0.5 を 計算しよう。`,
      ],
      explain: `全部 入って いる ます ${F}こで ${F}cm²、かかって いる ます ${P}こで ${P / 2}cm²。合わせて 約 ${value}cm²です。数《かぞ》え方《かた》で 少し ちがっても よいよ。`,
    }),
    figure: gridFig(g.poly, `${g.name}の 形を 方眼に かいた 図`),
    unit: 'cm²',
    value,
    tol: P / 4,
    wrongs: [
      [F, 'grid-full-only'],
      [F + P, 'grid-partial-full'],
    ],
  });
});

// ---- (7) compare ----
const rowFig = (a: Figure, b: Figure): Figure => ({ kind: 'row', items: [a, b] });

const compareItems: ChoiceItem[] = [
  {
    engine: 'choice',
    ...mkBase({
      id: 'compare:c1',
      objective: 'compare',
      level: 2,
      alt: false,
      prompt:
        '池は 上底 20m、下底 40m、高さ 30mの 台形、畑は 底辺 40m、高さ 30mの 平行四辺形と みます。広いのは どちらですか。',
      hints: ['2つの 面積を それぞれ 求めよう。', '池: (20 ＋ 40) × 30 ÷ 2', '畑: 40 × 30'],
      explain:
        '池は (20 ＋ 40) × 30 ÷ 2 ＝ 900、畑は 40 × 30 ＝ 1200。900m²より 1200m²の ほうが 大きいので、畑の ほうが 広いです。',
    }),
    figure: rowFig(
      objFig('A', { overlay: 'fit', dims: ['20m', '40m', '30m'] }),
      objFig('E', { overlay: 'fit', dims: ['40m', '30m'] }),
    ),
    options: opts('畑', [
      ['池', 'half-forgot'],
      ['同じ くらい', 'same-approx'],
    ]),
  },
  {
    engine: 'choice',
    ...mkBase({
      id: 'compare:c2',
      objective: 'compare',
      level: 2,
      alt: false,
      prompt:
        '広場は 半径 10mの 円、公園は たて 15m、横 25mの 長方形と みます。広いのは どちらですか。',
      hints: ['2つの 面積を それぞれ 求めよう。', '広場: 10 × 10 × 3.14', '公園: 15 × 25'],
      explain:
        '広場は 10 × 10 × 3.14 ＝ 314、公園は 15 × 25 ＝ 375。314m²より 375m²の ほうが 大きいので、公園の ほうが 広いです。',
    }),
    figure: rowFig(
      objFig('C', { overlay: 'fit', dims: ['10m'] }),
      objFig('D', { overlay: 'fit', dims: ['25m', '15m'] }),
    ),
    options: opts('公園', [
      ['広場', 'radius-diam'],
      ['同じ くらい', 'same-approx'],
    ]),
  },
  {
    engine: 'choice',
    ...mkBase({
      id: 'compare:c3',
      objective: 'compare',
      level: 2,
      alt: false,
      prompt:
        '島は 底辺 8km、高さ 6kmの 三角形、湖は 直径 6kmの 円と みます。広いのは どちらですか。',
      hints: ['2つの 面積を それぞれ 求めよう。', '島: 8 × 6 ÷ 2', '湖: 3 × 3 × 3.14'],
      explain:
        '島は 8 × 6 ÷ 2 ＝ 24、湖は 3 × 3 × 3.14 ＝ 28.26。24km²より 28.26km²の ほうが 大きいので、湖の ほうが 広いです。',
    }),
    figure: rowFig(
      objFig('F', { overlay: 'fit', dims: ['8km', '6km'] }),
      objFig('H', { overlay: 'fit', dims: ['6km'] }),
    ),
    options: opts('湖', [
      ['島', 'half-forgot'],
      ['同じ くらい', 'same-approx'],
    ]),
  },
  {
    engine: 'choice',
    ...mkBase({
      id: 'compare:c4',
      objective: 'compare',
      level: 2,
      alt: false,
      prompt:
        'ひし形に 近い 葉は 対角線が 6cmと 10cm、三角形に 近い 葉は 底辺 12cm、高さ 9cmです。広いのは どちらですか。',
      hints: [
        '2つの 面積を それぞれ 求めよう。',
        'ひし形に 近い 葉: 6 × 10 ÷ 2',
        '三角形に 近い 葉: 12 × 9 ÷ 2',
      ],
      explain:
        'ひし形に 近い 葉は 6 × 10 ÷ 2 ＝ 30、三角形に 近い 葉は 12 × 9 ÷ 2 ＝ 54。54cm²の ほうが 大きいので、三角形に 近い 葉の ほうが 広いです。',
    }),
    figure: rowFig(
      objFig('B', { overlay: 'fit', dims: ['6cm', '10cm'] }),
      objFig('F', { overlay: 'fit', dims: ['12cm', '9cm'] }),
    ),
    options: opts('三角形に 近い 葉の ほうが 広い', [
      ['ひし形に 近い 葉の ほうが 広い', 'half-forgot'],
      ['同じ くらい', 'same-approx'],
    ]),
  },
  {
    engine: 'choice',
    ...mkBase({
      id: 'compare:c5',
      objective: 'compare',
      level: 2,
      alt: false,
      prompt:
        '広場の 形を、Aは 半径 10mの 円、Bは 1辺 20mの 正方形と みました。本当の 広さに 近いのは どちらですか。',
      hints: [
        '形の 外に はみ出す 部分と、形の 中で 足りない 部分を 見よう。',
        '長方形や 正方形は、かどの 所で 大きく はみ出して いるね。',
        '2つの 面積を 求めると、円は 314m²、正方形は 400m²。',
      ],
      explain:
        '円は はみ出す 部分と 足りない 部分が 同じ くらいです。正方形は はみ出す 部分が 多いので、本当より 大きく なります。',
    }),
    figure: twoFig(
      'C',
      { draw: circle(160, 110, 80), at: [160, 24] },
      { draw: rectD(80, 30, 240, 190), at: [250, 30] },
      '広場の 形に、Aの 円と Bの 正方形を 重ねた 図',
    ),
    options: opts('Aの 円', [
      ['Bの 正方形', 'fit-big'],
      ['どちらも 同じ', 'same-approx'],
    ]),
  },
  {
    engine: 'choice',
    ...mkBase({
      id: 'compare:c6',
      objective: 'compare',
      level: 2,
      alt: false,
      prompt:
        '池の 形を、Aは たて 30m、横 40mの 長方形、Bは 上底 20m、下底 40m、高さ 30mの 台形と みました。本当の 広さに 近いのは どちらですか。',
      hints: [
        '形の 外に はみ出す 部分と、形の 中で 足りない 部分を 見よう。',
        '長方形や 正方形は、かどの 所で 大きく はみ出して いるね。',
        '2つの 面積を 求めると、台形は 900m²、長方形は 1200m²。',
      ],
      explain:
        '台形は はみ出す 部分と 足りない 部分が 同じ くらいです。長方形は はみ出す 部分が 多いので、本当より 大きく なります。',
    }),
    figure: twoFig(
      'A',
      { draw: rectD(60, 40, 260, 190), at: [272, 40] },
      { draw: polygon('110,40 210,40 260,190 60,190'), at: [160, 56] },
      '池の 形に、Aの 長方形と Bの 台形を 重ねた 図',
    ),
    options: opts('Bの 台形', [
      ['Aの 長方形', 'fit-big'],
      ['どちらも 同じ', 'same-approx'],
    ]),
  },
  {
    engine: 'choice',
    ...mkBase({
      id: 'compare:c7',
      objective: 'compare',
      level: 2,
      alt: false,
      prompt:
        '島の 形を、Aは 底辺 8km、高さ 6kmの 三角形、Bは たて 6km、横 8kmの 長方形と みました。本当の 広さに 近いのは どちらですか。',
      hints: [
        '形の 外に はみ出す 部分と、形の 中で 足りない 部分を 見よう。',
        '長方形や 正方形は、かどの 所で 大きく はみ出して いるね。',
        '2つの 面積を 求めると、三角形は 24km²、長方形は 48km²。',
      ],
      explain:
        '三角形は はみ出す 部分と 足りない 部分が 同じ くらいです。長方形は はみ出す 部分が 多いので、本当より 大きく なります。',
    }),
    figure: twoFig(
      'F',
      { draw: polygon('170,35 260,185 60,185'), at: [170, 100] },
      { draw: rectD(60, 35, 260, 185), at: [272, 35] },
      '島の 形に、Aの 三角形と Bの 長方形を 重ねた 図',
    ),
    options: opts('Aの 三角形', [
      ['Bの 長方形', 'fit-big'],
      ['どちらも 同じ', 'same-approx'],
    ]),
  },
  {
    engine: 'choice',
    ...mkBase({
      id: 'compare:c8',
      objective: 'compare',
      level: 2,
      alt: false,
      prompt:
        '葉の 形を、Aは たて 10cm、横 6cmの 長方形、Bは 対角線が 10cmと 6cmの ひし形と みました。本当の 広さに 近いのは どちらですか。',
      hints: [
        '形の 外に はみ出す 部分と、形の 中で 足りない 部分を 見よう。',
        '長方形や 正方形は、かどの 所で 大きく はみ出して いるね。',
        '2つの 面積を 求めると、ひし形は 30cm²、長方形は 60cm²。',
      ],
      explain:
        'ひし形は はみ出す 部分と 足りない 部分が 同じ くらいです。長方形は はみ出す 部分が 多いので、本当より 大きく なります。',
    }),
    figure: twoFig(
      'B',
      { draw: rectD(115, 35, 205, 185), at: [222, 40] },
      { draw: polygon('160,35 205,110 160,185 115,110'), at: [160, 120] },
      '葉の 形に、Aの 長方形と Bの ひし形を 重ねた 図',
    ),
    options: opts('Bの ひし形', [
      ['Aの 長方形', 'fit-big'],
      ['どちらも 同じ', 'same-approx'],
    ]),
  },
];

// ---- (8) compare-alt: がい数で 見積もる ----
const COMPARE_ALT: {
  id: string;
  prompt: string;
  right: string;
  wrongs: [string, string][];
  hints: [string, string, string];
  explain: string;
}[] = [
  {
    id: 'a1',
    prompt:
      '公園は、たて 約 48m、横 約 71mの 長方形に 近い 形です。がい数に して 見積もると、面積は どれくらいですか。',
    right: '約 3500m²',
    wrongs: [
      ['約 350m²', 'place-value'],
      ['約 35000m²', 'place-value'],
      ['約 120m²', 'perimeter'],
    ],
    hints: [
      '長さを 上から 1けたの がい数に しよう。',
      '48 → 50、71 → 70',
      '50 × 70 を 計算しよう。',
    ],
    explain: '50 × 70 ＝ 3500 なので、約 3500m²です。',
  },
  {
    id: 'a2',
    prompt:
      '島は、底辺 約 7.9km、高さ 約 6.1kmの 三角形に 近い 形です。がい数に して 見積もると、面積は どれくらいですか。',
    right: '約 24km²',
    wrongs: [
      ['約 48km²', 'half-forgot'],
      ['約 14km²', 'perimeter'],
      ['約 240km²', 'place-value'],
    ],
    hints: [
      '長さを 上から 1けたの がい数に しよう。',
      '7.9 → 8、6.1 → 6',
      '8 × 6 ÷ 2 を 計算しよう。',
    ],
    explain: '8 × 6 ÷ 2 ＝ 24 なので、約 24km²です。',
  },
  {
    id: 'a3',
    prompt:
      '広場は、半径 約 9.8mの 円に 近い 形です。がい数に して 見積もると、面積は どれくらいですか。',
    right: '約 300m²',
    wrongs: [
      ['約 60m²', 'circle-r2'],
      ['約 1200m²', 'radius-diam'],
      ['約 30m²', 'place-value'],
    ],
    hints: [
      '長さを 上から 1けたの がい数に しよう。',
      '9.8 → 10',
      '10 × 10 × 3.14 を 計算しよう。',
    ],
    explain: '10 × 10 × 3.14 ＝ 314 なので、約 300m²です。',
  },
  {
    id: 'a4',
    prompt:
      '池は、上底 約 19m、下底 約 41m、高さ 約 30mの 台形に 近い 形です。がい数に して 見積もると、面積は どれくらいですか。',
    right: '約 900m²',
    wrongs: [
      ['約 1800m²', 'half-forgot'],
      ['約 90m²', 'perimeter'],
      ['約 9000m²', 'place-value'],
    ],
    hints: [
      '長さを きりの よい 数に しよう。',
      '19 → 20、41 → 40、30 は そのまま',
      '(20 ＋ 40) × 30 ÷ 2 を 計算しよう。',
    ],
    explain: '(20 ＋ 40) × 30 ÷ 2 ＝ 900 なので、約 900m²です。',
  },
];
const compareAltItems: ChoiceItem[] = COMPARE_ALT.map((r) => ({
  engine: 'choice',
  ...mkBase({
    id: `compare-alt:${r.id}`,
    objective: 'compare',
    level: 2,
    alt: true,
    prompt: r.prompt,
    hints: r.hints,
    explain: r.explain,
  }),
  options: opts(r.right, r.wrongs),
  layout: 'column',
}));

export const ITEMS: Item[] = [
  ...shapeItems,
  ...shapeAltItems,
  ...formulaItems,
  ...formulaAltItems,
  ...estimateItems,
  ...estimateAltItems,
  ...compareItems,
  ...compareAltItems,
];

export const approxArea: UnitSpec = finishUnit({
  id: 'g6.math.approx-area',
  title: 'およその 形と 面積',
  stage: 'g6',
  subject: 'math',
  domain: 'B-shape',
  kind: 'concept',
  priority: 'P2',
  status: 'ready',
  icon: 'leaf',
  prereq: ['g6.math.circle-area'],
  objectives: [
    { id: 'shape', title: '身の まわりの 形を どの 図形と みるか' },
    { id: 'formula', title: 'みた 図形の 面積の 式' },
    { id: 'estimate', title: 'およその 面積を 求める' },
    { id: 'compare', title: 'およその 面積で 比べる・確かめる' },
  ],
  misconceptions: [
    {
      id: 'fit-big',
      explain:
        'もとの 形より ずっと 大きい 形を 選んだのかな。はみ出す 部分が 少ない 形の ほうが、本当の 面積に 近く なるよ。',
    },
    {
      id: 'fit-small',
      explain:
        '形の 一部しか おおって いない 形を 選んだのかな。はみ出す 部分と 足りない 部分が 同じ くらいに なる 形を 選ぼう。',
    },
    {
      id: 'fit-shape',
      explain:
        '形の 種類が 合って いないのかな。まわりの 線の 曲がり方や かどの 数を 見て、近い 図形を 選ぼう。',
    },
    { id: 'half-forgot', explain: '三角形・台形・ひし形の 面積の「÷ 2」を わすれたのかな。' },
    {
      id: 'perimeter',
      explain:
        '面積を 求めるのに、長さを たしたのかな。たし算では まわりの 長さに なって しまうよ。',
    },
    {
      id: 'formula-mix',
      explain:
        'ほかの 図形の 公式と まぜたのかな。どの 図形と みたかを 確かめて、その 図形の 公式を 使おう。',
    },
    {
      id: 'radius-diam',
      explain:
        '直径を 半径と して 計算したのかな。円の 面積は 半径 × 半径 × 3.14。半径は 直径の 半分だよ。',
    },
    {
      id: 'circle-r2',
      explain: '半径 × 2 × 3.14 は 円周の 長さだよ。円の 面積は 半径 × 半径 × 3.14 だね。',
    },
    {
      id: 'slant-height',
      explain: 'ななめの 辺を 高さに したのかな。高さは 底辺に 垂直な 長さだよ。',
    },
    {
      id: 'combo-miss',
      explain: '組み合わせた 形の 一部を わすれたのかな。分けた 形の 面積を 全部 たそう。',
    },
    {
      id: 'semicircle',
      explain: '半円を 円 1つ分と して 計算したのかな。半円 2つで 円 1つ分だよ。',
    },
    {
      id: 'grid-full-only',
      explain:
        '形に かかって いる ますを 数えなかったのかな。かかって いる ますは 1つを 0.5と して 数えよう。',
    },
    {
      id: 'grid-partial-full',
      explain:
        '形に かかって いる ますを 1と して 数えたのかな。かかって いる ますは 0.5と して 数えよう。',
    },
    {
      id: 'same-approx',
      explain:
        'どの 形と みても 同じ 面積に なると 考えたのかな。形に よって、はみ出す 部分が ちがうよ。',
    },
    {
      id: 'place-value',
      explain: '位を まちがえたのかな。がい数に した 数で 計算して、答えの 大きさを 確かめよう。',
    },
  ],
  levels: [
    { label: 'どの 形と みるか・式', chance: 0.25 },
    { label: 'およその 面積', chance: 0.05 },
    { label: '比べる・確かめる', chance: 0.25 },
  ],
  intro: [
    {
      text: '池の 形は 曲がって いて、公式で 面積を 求める ことが できません。',
      figure: objFig('A', { overlay: 'none', dims: null }),
    },
    {
      text: '池の 形を、台形と みます。はみ出す 部分と 足りない 部分が 同じ くらいに なる 形を 選ぶのが こつです。',
      figure: objFig('A', { overlay: 'fit', dims: null }),
    },
    {
      text: '台形の 面積は (20 ＋ 40) × 30 ÷ 2 ＝ 900。池の 面積は、約 900m²と 考えられます。',
      figure: objFig('A', { overlay: 'fit', dims: ['20m', '40m', '30m'] }),
    },
  ],
  source: { kind: 'items', items: ITEMS },
  review: 'objective',
  basis:
    '小学校学習指導要領（平成29年告示）算数 第6学年 B(2) 概形とおよその面積（身の回りにある形の概形をとらえ、およその面積を求める）',
  revised: REVISED,
});
