import { describe, expect, it } from 'vitest';
import {
  checkGeometry,
  geometryAnswerText,
  judgeGeometry,
  type GeometryItem,
  type GeoTask,
  type Pt,
} from './geometry';
import { geometrySamples } from './geometry.samples';
import { isSimple, normalizePolygon, sameCycle, shapeClasses, similarCycle } from './shapes';

const base = {
  id: 't',
  objective: 'o',
  level: 0,
  prompt: 'p',
  hints: ['a', 'b', 'c'],
  explain: 'e',
  identity: 'k',
};
const mk = (task: GeoTask): GeometryItem => ({
  ...base,
  engine: 'geometry',
  task,
  misconceptions: {
    translated: 'tr',
    sameSize: 'same',
    wrongSides: 'sides',
    wrongClass: 'cls',
    swapPerpPar: 'swap',
    notThrough: 'through',
    otherScale: 'other',
    reflexComplement: 'reflex',
  },
});
const grid = { w: 10, h: 8 };
const draw = (target: Extract<GeoTask, { kind: 'draw' }>['target']) =>
  mk({ kind: 'draw', grid, target });
const closed = (path: Pt[]) => ({ path, closed: true });

describe('shapes', () => {
  it('始点・向き・辺の途中の点を同一視', () => {
    const sq: Pt[] = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ];
    expect(
      sameCycle(sq, [
        [2, 2],
        [2, 0],
        [0, 0],
        [0, 2],
      ]),
    ).toBe(true);
    expect(
      normalizePolygon([
        [0, 0],
        [1, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ]),
    ).toHaveLength(4);
    expect(
      isSimple([
        [0, 0],
        [2, 2],
        [2, 0],
        [0, 2],
      ]),
    ).toBe(false);
    expect(
      similarCycle(
        sq,
        [
          [5, 5],
          [5, 7],
          [3, 7],
          [3, 5],
        ],
        1,
      ),
    ).toBe(true);
  });
  it('形の仲間（性質）', () => {
    expect([
      ...shapeClasses([
        [0, 0],
        [3, 0],
        [3, 3],
        [0, 3],
      ]),
    ]).toEqual(
      expect.arrayContaining(['square', 'rectangle', 'rhombus', 'parallelogram', 'trapezoid']),
    );
    expect(
      shapeClasses([
        [0, 0],
        [4, 0],
        [3, 2],
        [1, 2],
      ]).has('trapezoid'),
    ).toBe(true);
    expect(
      shapeClasses([
        [0, 0],
        [4, 0],
        [3, 2],
        [1, 2],
      ]).has('parallelogram'),
    ).toBe(false);
    expect(
      shapeClasses([
        [0, 0],
        [0, 3],
        [4, 3],
      ]).has('right-triangle'),
    ).toBe(true);
    expect(
      shapeClasses([
        [0, 3],
        [2, 0],
        [4, 3],
      ]).has('isosceles-triangle'),
    ).toBe(true);
  });
});

describe('draw（多角形）', () => {
  it('exact: 始点・向きは問わない、閉じていなければ もう一度', () => {
    const it1 = draw({
      kind: 'exact',
      points: [
        [1, 1],
        [4, 1],
        [4, 3],
      ],
    });
    expect(
      judgeGeometry(
        it1,
        closed([
          [4, 3],
          [4, 1],
          [1, 1],
        ]),
      ).result,
    ).toBe('correct');
    expect(
      judgeGeometry(it1, {
        path: [
          [1, 1],
          [4, 1],
          [4, 3],
        ],
        closed: false,
      }).result,
    ).toBe('retry');
    expect(
      judgeGeometry(
        it1,
        closed([
          [1, 1],
          [4, 1],
          [4, 4],
        ]),
      ).result,
    ).toBe('wrong');
  });
  it('shape: 仲間と辺の長さ、exclusive', () => {
    const it1 = draw({ kind: 'shape', shape: 'rectangle', sides: [3, 5, 3, 5] });
    expect(
      judgeGeometry(
        it1,
        closed([
          [0, 0],
          [5, 0],
          [5, 3],
          [0, 3],
        ]),
      ).result,
    ).toBe('correct');
    expect(
      judgeGeometry(
        it1,
        closed([
          [2, 2],
          [2, 7],
          [5, 7],
          [5, 2],
        ]),
      ).result,
    ).toBe('correct');
    expect(
      judgeGeometry(
        it1,
        closed([
          [0, 0],
          [4, 0],
          [4, 3],
          [0, 3],
        ]),
      ),
    ).toMatchObject({ misconception: 'sides' });
    expect(
      judgeGeometry(
        it1,
        closed([
          [0, 0],
          [5, 0],
          [6, 3],
          [1, 3],
        ]),
      ),
    ).toMatchObject({ misconception: 'cls' });
    const it2 = draw({ kind: 'shape', shape: 'rectangle', exclusive: true });
    expect(
      judgeGeometry(
        it2,
        closed([
          [0, 0],
          [3, 0],
          [3, 3],
          [0, 3],
        ]),
      ).result,
    ).toBe('wrong');
    const it3 = draw({ kind: 'shape', shape: 'rectangle' });
    expect(
      judgeGeometry(
        it3,
        closed([
          [0, 0],
          [3, 0],
          [3, 3],
          [0, 3],
        ]),
      ).result,
    ).toBe('correct');
  });
  it('ねじれた四角形は誤り', () => {
    const it1 = draw({ kind: 'shape', shape: 'quadrilateral' });
    expect(
      judgeGeometry(
        it1,
        closed([
          [0, 0],
          [2, 2],
          [2, 0],
          [0, 2],
        ]),
      ).result,
    ).toBe('wrong');
  });
  it('congruent: 回転・裏返しを同一視（allowFlip: false なら裏返しは別）', () => {
    const tri: Pt[] = [
      [0, 0],
      [3, 0],
      [0, 2],
    ];
    expect(
      judgeGeometry(
        draw({ kind: 'congruent', points: tri }),
        closed([
          [5, 5],
          [5, 2],
          [3, 5],
        ]),
      ).result,
    ).toBe('correct');
    // 裏返し（x を反転）
    const flipped: Pt[] = [
      [6, 0],
      [3, 0],
      [6, 2],
    ];
    expect(judgeGeometry(draw({ kind: 'congruent', points: tri }), closed(flipped)).result).toBe(
      'correct',
    );
    expect(
      judgeGeometry(draw({ kind: 'congruent', points: tri, allowFlip: false }), closed(flipped))
        .result,
    ).toBe('wrong');
  });
  it('similar: 2倍の拡大図・同じ大きさの誤り', () => {
    const it1 = draw({
      kind: 'similar',
      points: [
        [0, 0],
        [2, 0],
        [2, 1],
      ],
      ratio: 2,
    });
    expect(
      judgeGeometry(
        it1,
        closed([
          [1, 1],
          [5, 1],
          [5, 3],
        ]),
      ).result,
    ).toBe('correct');
    expect(
      judgeGeometry(
        it1,
        closed([
          [1, 1],
          [3, 1],
          [3, 2],
        ]),
      ),
    ).toMatchObject({ misconception: 'same' });
  });
  it('reflect / rotate180: ずらしただけの誤り', () => {
    const src: Pt[] = [
      [1, 1],
      [4, 1],
      [4, 5],
      [2, 4],
    ];
    const it1 = draw({
      kind: 'reflect',
      points: src,
      axis: [
        [5, 0],
        [5, 6],
      ],
    });
    expect(
      judgeGeometry(
        it1,
        closed([
          [9, 1],
          [6, 1],
          [6, 5],
          [8, 4],
        ]),
      ).result,
    ).toBe('correct');
    expect(
      judgeGeometry(
        it1,
        closed([
          [6, 1],
          [9, 1],
          [9, 5],
          [7, 4],
        ]),
      ),
    ).toMatchObject({ misconception: 'tr' });
    const it2 = draw({
      kind: 'rotate180',
      points: [
        [1, 1],
        [3, 1],
        [1, 2],
      ],
      center: [4, 3],
    });
    expect(
      judgeGeometry(
        it2,
        closed([
          [7, 5],
          [5, 5],
          [7, 4],
        ]),
      ).result,
    ).toBe('correct');
    expect(geometryAnswerText(it2)).toBe('(7,5)→(5,5)→(7,4)');
  });
});

describe('draw（直線）', () => {
  it('垂直・平行・通る点', () => {
    const it1 = draw({
      kind: 'perpendicular',
      to: [
        [0, 2],
        [6, 2],
      ],
      through: [3, 5],
    });
    expect(
      judgeGeometry(it1, {
        path: [
          [3, 0],
          [3, 7],
        ],
        closed: false,
      }).result,
    ).toBe('correct');
    expect(
      judgeGeometry(it1, {
        path: [
          [4, 0],
          [4, 7],
        ],
        closed: false,
      }),
    ).toMatchObject({ misconception: 'through' });
    expect(
      judgeGeometry(it1, {
        path: [
          [0, 5],
          [6, 5],
        ],
        closed: false,
      }),
    ).toMatchObject({ misconception: 'swap' });
    expect(judgeGeometry(it1, { path: [[3, 0]], closed: false }).result).toBe('retry');
    const it2 = draw({
      kind: 'parallel',
      to: [
        [0, 0],
        [2, 1],
      ],
    });
    expect(
      judgeGeometry(it2, {
        path: [
          [0, 3],
          [4, 5],
        ],
        closed: false,
      }).result,
    ).toBe('correct');
    expect(
      judgeGeometry(it2, {
        path: [
          [4, 2],
          [6, 3],
        ],
        closed: false,
      }).result,
    ).toBe('wrong'); // 同じ直線
  });
});

describe('angle（分度器）', () => {
  it('±2度・反対の目盛り・180度より大きい角', () => {
    const it1 = mk({ kind: 'angle', degrees: 130 });
    expect(judgeGeometry(it1, { fields: ['130'] }).result).toBe('correct');
    expect(judgeGeometry(it1, { fields: ['132'] }).result).toBe('correct');
    expect(judgeGeometry(it1, { fields: ['133'] }).result).toBe('wrong');
    expect(judgeGeometry(it1, { fields: ['50'] })).toMatchObject({ misconception: 'other' });
    expect(judgeGeometry(it1, { fields: ['ど'] }).result).toBe('retry');
    const it2 = mk({ kind: 'angle', degrees: 240, tolerance: 1 });
    expect(judgeGeometry(it2, { fields: ['120'] })).toMatchObject({ misconception: 'reflex' });
    expect(judgeGeometry(it2, { fields: ['241'] }).result).toBe('correct');
  });
});

describe('check', () => {
  it('問題データの誤り', () => {
    expect(
      checkGeometry(
        draw({
          kind: 'reflect',
          points: [
            [1, 1],
            [4, 1],
            [4, 5],
          ],
          axis: [
            [8, 0],
            [8, 6],
          ],
        }),
      ).join(),
    ).toMatch('格子の外');
    expect(checkGeometry(draw({ kind: 'shape', shape: 'equilateral-triangle' })).join()).toMatch(
      '正三角形',
    );
    expect(
      checkGeometry(draw({ kind: 'shape', shape: 'rectangle', sides: [3, 5, 3] })).join(),
    ).toMatch('辺の数');
    expect(
      checkGeometry(
        draw({
          kind: 'parallel',
          to: [
            [0, 0],
            [2, 1],
          ],
          through: [4, 2],
        }),
      ).join(),
    ).toMatch('直線の上');
    expect(
      checkGeometry(
        draw({
          kind: 'similar',
          points: [
            [0, 0],
            [2, 0],
            [2, 1],
          ],
          ratio: 1,
        }),
      ).join(),
    ).toMatch('比が 1');
    expect(checkGeometry(mk({ kind: 'angle', degrees: 181 })).join()).toMatch('180度に近すぎる');
    expect(
      checkGeometry(
        mk({
          kind: 'pick',
          options: [
            { label: 'a', correct: true },
            { label: 'b', correct: true },
          ],
        }),
      ).join(),
    ).toMatch('正解が1つではない');
  });
  it('見本の問題に誤りが無い', () => {
    for (const s of geometrySamples) expect(checkGeometry(s), s.id).toEqual([]);
  });
});
