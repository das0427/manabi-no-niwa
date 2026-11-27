import { describe, expect, it } from 'vitest';
import { exampleFor, type DrawTask, type Example } from './example';
import {
  judgeGeometry,
  needsExample,
  type GeometryItem,
  type GeoTarget,
  type Pt,
} from './geometry';
import { similarCycle } from './shapes';

const base = {
  id: 't',
  objective: 'o',
  level: 0,
  prompt: 'p',
  hints: ['a', 'b', 'c'],
  explain: 'e',
  identity: 'k',
};
const item = (task: DrawTask): GeometryItem => ({ ...base, engine: 'geometry', task });
const draw = (
  target: GeoTarget,
  grid = { w: 8, h: 6 },
  given?: Pt[][],
): { task: DrawTask; it: GeometryItem } => {
  const task: DrawTask = {
    kind: 'draw',
    grid,
    target,
    ...(given ? { given: given.map((points) => ({ points })) } : {}),
  };
  return { task, it: item(task) };
};

/** 見本を子供が描いた図とみなして、判定が正解にすること（見本は正答と同じ基準で作る） */
const judged = (it: GeometryItem, ex: Example) =>
  judgeGeometry(it, { path: ex.points, closed: ex.kind === 'polygon' }).result;

const bbox = (ps: Pt[]) => ({
  x0: Math.min(...ps.map((p) => p[0])),
  x1: Math.max(...ps.map((p) => p[0])),
  y0: Math.min(...ps.map((p) => p[1])),
  y1: Math.max(...ps.map((p) => p[1])),
});
/** 2つの形の枠のすき間（0 以上: 重ならない、1 以上: 間に 1 ます以上あく） */
const gap = (a: Pt[], b: Pt[]) => {
  const p = bbox(a);
  const q = bbox(b);
  return Math.max(q.x0 - p.x1, p.x0 - q.x1, q.y0 - p.y1, p.y0 - q.y1);
};
const inGrid = (ps: Pt[], g: { w: number; h: number }) =>
  ps.every(
    (p) =>
      Number.isInteger(p[0]) &&
      Number.isInteger(p[1]) &&
      p[0] >= 0 &&
      p[1] >= 0 &&
      p[0] <= g.w &&
      p[1] <= g.h,
  );
const tri: Pt[] = [
  [0, 0],
  [3, 0],
  [0, 2],
];

describe('見本の形（目標の種類ごと）', () => {
  it('exact・reflect・rotate180: 目標の頂点そのもの', () => {
    const pts: Pt[] = [
      [1, 1],
      [4, 1],
      [4, 3],
    ];
    const a = draw({ kind: 'exact', points: pts });
    expect(exampleFor(a.task)).toEqual({ kind: 'polygon', points: pts });
    const r = draw({
      kind: 'reflect',
      points: pts,
      axis: [
        [5, 0],
        [5, 6],
      ],
    });
    expect(exampleFor(r.task)).toEqual({
      kind: 'polygon',
      points: [
        [9, 1],
        [6, 1],
        [6, 3],
      ],
    });
    const c = draw({ kind: 'rotate180', points: pts, center: [4, 4] });
    expect(exampleFor(c.task)).toEqual({
      kind: 'polygon',
      points: [
        [7, 7],
        [4, 7],
        [4, 5],
      ],
    });
  });

  it('congruent: given の形を、given と重ならない空いている所へずらす', () => {
    const grid = { w: 7, h: 3 };
    const { task, it: i } = draw({ kind: 'congruent', points: tri }, grid, [tri]);
    const ex = exampleFor(task);
    expect(ex?.kind).toBe('polygon');
    const ps = ex!.points;
    expect(judged(i, ex!)).toBe('correct');
    expect(similarCycle(tri, ps, 1)).toBe(true);
    expect(inGrid(ps, grid)).toBe(true);
    // given とは重ならず、間に 1 ます以上あく
    expect(gap(ps, tri)).toBeGreaterThanOrEqual(1);
    // 今の位置のままではない
    expect(ps).not.toEqual(tri);
  });

  it('congruent: given が複数でも、どれとも重ならない所に置く', () => {
    const grid = { w: 12, h: 6 };
    const a: Pt[] = [
      [0, 0],
      [3, 0],
      [3, 2],
    ];
    const b: Pt[] = [
      [5, 0],
      [8, 0],
      [8, 2],
    ];
    const { task, it: i } = draw({ kind: 'congruent', points: a }, grid, [a, b]);
    const ex = exampleFor(task)!;
    expect(judged(i, ex)).toBe('correct');
    expect(gap(ex.points, a)).toBeGreaterThanOrEqual(1);
    expect(gap(ex.points, b)).toBeGreaterThanOrEqual(1);
    expect(inGrid(ex.points, grid)).toBe(true);
  });

  it('similar: given を ratio 倍して、空いている所に置く（拡大・縮図）', () => {
    const grid = { w: 15, h: 10 };
    const src: Pt[] = [
      [0, 0],
      [2, 0],
      [2, 1],
    ];
    const big = draw({ kind: 'similar', points: src, ratio: 2 }, grid, [src]);
    const exBig = exampleFor(big.task)!;
    expect(judged(big.it, exBig)).toBe('correct');
    expect(similarCycle(exBig.points, src, 4)).toBe(true);
    expect(bbox(exBig.points).x1 - bbox(exBig.points).x0).toBe(4);
    expect(gap(exBig.points, src)).toBeGreaterThanOrEqual(1);
    expect(inGrid(exBig.points, grid)).toBe(true);

    const src2: Pt[] = [
      [2, 2],
      [6, 2],
      [6, 4],
      [2, 4],
    ];
    const small = draw({ kind: 'similar', points: src2, ratio: 0.5 }, grid, [src2]);
    const exSmall = exampleFor(small.task)!;
    expect(judged(small.it, exSmall)).toBe('correct');
    expect(bbox(exSmall.points).x1 - bbox(exSmall.points).x0).toBe(2);
    expect(gap(exSmall.points, src2)).toBeGreaterThanOrEqual(1);
    expect(inGrid(exSmall.points, grid)).toBe(true);
  });

  it('similar・congruent: 格子に入らなければ見本を出さない（はみ出す形は描かない）', () => {
    const big: Pt[] = [
      [0, 0],
      [4, 0],
      [4, 4],
    ];
    expect(
      exampleFor(draw({ kind: 'similar', points: big, ratio: 2 }, { w: 5, h: 5 }, [big]).task),
    ).toBeNull();
  });

  describe('shape: 種類と辺から作り、格子の中ほどに置く', () => {
    const cases: [string, GeoTarget, { w: number; h: number }][] = [
      ['ましかく', { kind: 'shape', shape: 'square' }, { w: 5, h: 3 }],
      ['ながしかく', { kind: 'shape', shape: 'rectangle', exclusive: true }, { w: 5, h: 3 }],
      ['さんかく', { kind: 'shape', shape: 'triangle' }, { w: 5, h: 3 }],
      ['二等辺三角形', { kind: 'shape', shape: 'isosceles-triangle' }, { w: 10, h: 5 }],
      ['直角三角形', { kind: 'shape', shape: 'right-triangle' }, { w: 8, h: 4 }],
      ['台形', { kind: 'shape', shape: 'trapezoid', exclusive: true }, { w: 8, h: 6 }],
      ['平行四辺形', { kind: 'shape', shape: 'parallelogram', exclusive: true }, { w: 8, h: 6 }],
      ['ひし形', { kind: 'shape', shape: 'rhombus', exclusive: true }, { w: 8, h: 6 }],
      ['四角形', { kind: 'shape', shape: 'quadrilateral', exclusive: true }, { w: 8, h: 6 }],
      [
        '2×2 の格子の長方形',
        { kind: 'shape', shape: 'rectangle', exclusive: true },
        { w: 2, h: 2 },
      ],
    ];
    it.each(cases)('%s（辺の指定なし）', (_n, target, grid) => {
      const { task, it: i } = draw(target, grid);
      const ex = exampleFor(task);
      expect(ex?.kind).toBe('polygon');
      expect(judged(i, ex!)).toBe('correct');
      expect(inGrid(ex!.points, grid)).toBe(true);
    });

    it('ましかく 2×2・ながしかく 3×2 を格子の中ほどに置く', () => {
      const grid = { w: 5, h: 3 };
      const sq = exampleFor(draw({ kind: 'shape', shape: 'square' }, grid).task)!;
      expect(bbox(sq.points)).toEqual({ x0: 2, x1: 4, y0: 1, y1: 3 });
      const rc = exampleFor(
        draw({ kind: 'shape', shape: 'rectangle', exclusive: true }, grid).task,
      )!;
      expect(bbox(rc.points)).toEqual({ x0: 1, x1: 4, y0: 1, y1: 3 });
    });

    it('辺（sides）の長さに合わせる（正方形・長方形・直角三角形）', () => {
      const sq = draw({ kind: 'shape', shape: 'square', sides: [4, 4, 4, 4] }, { w: 8, h: 4 });
      const exSq = exampleFor(sq.task)!;
      expect(judged(sq.it, exSq)).toBe('correct');
      expect(bbox(exSq.points)).toEqual({ x0: 2, x1: 6, y0: 0, y1: 4 });

      const rc = draw(
        { kind: 'shape', shape: 'rectangle', sides: [4, 1, 4, 1], exclusive: true },
        { w: 11, h: 4 },
      );
      const exRc = exampleFor(rc.task)!;
      expect(judged(rc.it, exRc)).toBe('correct');
      const b = bbox(exRc.points);
      expect([b.x1 - b.x0, b.y1 - b.y0]).toEqual([4, 1]);

      const hyp = Math.hypot(7, 4);
      const rt = draw(
        { kind: 'shape', shape: 'right-triangle', sides: [7, 4, hyp] },
        { w: 8, h: 4 },
      );
      const exRt = exampleFor(rt.task)!;
      expect(judged(rt.it, exRt)).toBe('correct');
      expect(inGrid(exRt.points, { w: 8, h: 4 })).toBe(true);
    });

    it('辺の長さを格子の向きに合わせて入れる（たて長の格子には たて長に）', () => {
      const rc = draw(
        { kind: 'shape', shape: 'rectangle', sides: [5, 2, 5, 2], exclusive: true },
        { w: 3, h: 6 },
      );
      const ex = exampleFor(rc.task)!;
      expect(judged(rc.it, ex)).toBe('correct');
      expect(inGrid(ex.points, { w: 3, h: 6 })).toBe(true);
    });

    it('辺の長さだけで決まる三角形・ひし形を探す', () => {
      const scalene = draw({ kind: 'shape', shape: 'triangle', sides: [3, 4, 5] }, { w: 8, h: 6 });
      const exS = exampleFor(scalene.task)!;
      expect(judged(scalene.it, exS)).toBe('correct');
      const rh = draw(
        { kind: 'shape', shape: 'rhombus', sides: [5, 5, 5, 5], exclusive: true },
        { w: 8, h: 6 },
      );
      const exR = exampleFor(rh.task)!;
      expect(judged(rh.it, exR)).toBe('correct');
    });

    it('given があるときは、重ならない所に置く', () => {
      const grid = { w: 11, h: 4 };
      const given: Pt[] = [
        [0, 0],
        [4, 0],
        [4, 3],
        [0, 3],
      ];
      const { task, it: i } = draw(
        { kind: 'shape', shape: 'rectangle', sides: [4, 3, 4, 3], exclusive: true },
        grid,
        [given],
      );
      const ex = exampleFor(task)!;
      expect(judged(i, ex)).toBe('correct');
      expect(gap(ex.points, given)).toBeGreaterThanOrEqual(1);
      expect(inGrid(ex.points, grid)).toBe(true);
    });

    it('作れない形は null（正三角形は格子の点では描けない）', () => {
      expect(exampleFor(draw({ kind: 'shape', shape: 'equilateral-triangle' }).task)).toBeNull();
    });
  });

  describe('perpendicular・parallel: through（無ければ格子の中ほど）を通る直線', () => {
    const to: [Pt, Pt] = [
      [0, 1],
      [4, 3],
    ];
    it('through を通る', () => {
      for (const kind of ['perpendicular', 'parallel'] as const) {
        const through: Pt = [3, 5];
        const { task, it: i } = draw({ kind, to, through });
        const ex = exampleFor(task)!;
        expect(ex.kind).toBe('line');
        expect(judged(i, ex)).toBe('correct');
        expect(ex.points.some((p) => p[0] === 3 && p[1] === 5)).toBe(true);
        expect(inGrid(ex.points, { w: 8, h: 6 })).toBe(true);
      }
    });
    it('through が格子のはしにあっても、格子の中の点をもう 1 つ取る', () => {
      const diagonal: [Pt, Pt] = [
        [0, 0],
        [4, 4],
      ];
      const { task, it: i } = draw({ kind: 'perpendicular', to: diagonal, through: [8, 0] });
      const ex = exampleFor(task)!;
      expect(judged(i, ex)).toBe('correct');
      expect(inGrid(ex.points, { w: 8, h: 6 })).toBe(true);
      // 格子の点をもう 1 つ取れない（答えの直線をかけない）問題には出さない
      const stuck = draw({ kind: 'perpendicular', to, through: [8, 6] });
      expect(exampleFor(stuck.task)).toBeNull();
    });
    it('through が無ければ格子の中ほどを通る（平行は基準の直線の上を避ける）', () => {
      const horizontal: [Pt, Pt] = [
        [0, 3],
        [8, 3],
      ];
      const perp = exampleFor(draw({ kind: 'perpendicular', to: horizontal }).task)!;
      expect(perp.points.map((p) => p[0])).toEqual([4, 4]);
      const par = draw({ kind: 'parallel', to: horizontal });
      const exPar = exampleFor(par.task)!;
      expect(judged(par.it, exPar)).toBe('correct');
      // 基準の直線（y=3）と同じ高さではない
      expect(exPar.points.every((p) => p[1] === exPar.points[0]![1])).toBe(true);
      expect(exPar.points[0]![1]).not.toBe(3);
    });
  });
});

describe('見本を出すか（子供の図が目標を満たしていないとき）', () => {
  const sq = draw({ kind: 'shape', shape: 'square' }, { w: 5, h: 3 });
  const line = draw({
    kind: 'parallel',
    to: [
      [0, 1],
      [4, 1],
    ],
    through: [2, 3],
  });
  it('何も描いていなければ出す', () => {
    expect(needsExample(sq.it, [], false)).toBe(true);
    expect(needsExample(line.it, [], false)).toBe(true);
  });
  it('閉じていない・目標に合わない図なら出す', () => {
    const open: Pt[] = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ];
    expect(needsExample(sq.it, open, false)).toBe(true);
    const wrong: Pt[] = [
      [0, 0],
      [3, 0],
      [0, 2],
    ];
    expect(needsExample(sq.it, wrong, true)).toBe(true);
    expect(
      needsExample(
        line.it,
        [
          [0, 2],
          [4, 2],
        ],
        false,
      ),
    ).toBe(true);
  });
  it('正しく描けていれば出さない', () => {
    const ok: Pt[] = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ];
    expect(needsExample(sq.it, ok, true)).toBe(false);
    expect(
      needsExample(
        line.it,
        [
          [0, 3],
          [4, 3],
        ],
        false,
      ),
    ).toBe(false);
  });
  it('描く問題でなければ出さない', () => {
    expect(
      needsExample(
        { ...base, engine: 'geometry', task: { kind: 'angle', degrees: 90 } },
        [],
        false,
      ),
    ).toBe(false);
  });
});
