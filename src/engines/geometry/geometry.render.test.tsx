/**
 * 描く問題の解説（revealed）の見本の形の画面の煙テスト。
 * 何も描かずに解説へ進んだとき、目標の種類ごとに見本の形（点線 .geo-answer）が格子に出ること。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { audienceUx } from '../../audience/audience';
import type { RenderCtx } from '../types';
import { geometryEngine, type GeometryItem, type GeoTarget, type Pt } from './geometry';

afterEach(cleanup);

const ctx: RenderCtx = {
  packId: 'test',
  readAloud: 'off',
  furigana: 'unlearned',
  learnerGrade: 0,
  preschool: true,
  textScale: 1,
  ux: audienceUx('p5'),
};

const tri: Pt[] = [
  [0, 0],
  [3, 0],
  [0, 2],
];
const small: Pt[] = [
  [0, 0],
  [1, 0],
  [0, 1],
];
const item = (target: GeoTarget, given?: Pt[][]): GeometryItem => ({
  id: 't',
  engine: 'geometry',
  objective: 'o',
  level: 0,
  prompt: 'p',
  hints: ['a', 'b'],
  explain: 'e',
  identity: 'k',
  task: {
    kind: 'draw',
    grid: { w: 7, h: 3 },
    ...(given ? { given: given.map((points) => ({ points })) } : {}),
    target,
  },
});

const kinds: [string, GeometryItem, 'polygon' | 'line'][] = [
  ['exact', item({ kind: 'exact', points: tri }), 'polygon'],
  [
    'reflect',
    item({
      kind: 'reflect',
      points: tri,
      axis: [
        [3, 0],
        [3, 3],
      ],
    }),
    'polygon',
  ],
  ['rotate180', item({ kind: 'rotate180', points: tri, center: [3, 1] }), 'polygon'],
  ['congruent', item({ kind: 'congruent', points: tri }, [tri]), 'polygon'],
  ['similar', item({ kind: 'similar', points: small, ratio: 2 }, [small]), 'polygon'],
  ['shape（ましかく）', item({ kind: 'shape', shape: 'square' }), 'polygon'],
  ['shape（ながしかく）', item({ kind: 'shape', shape: 'rectangle', exclusive: true }), 'polygon'],
  ['shape（さんかく）', item({ kind: 'shape', shape: 'triangle' }), 'polygon'],
  [
    'perpendicular',
    item({
      kind: 'perpendicular',
      to: [
        [0, 1],
        [4, 1],
      ],
      through: [2, 3],
    }),
    'line',
  ],
  [
    'parallel',
    item({
      kind: 'parallel',
      to: [
        [0, 1],
        [4, 1],
      ],
    }),
    'line',
  ],
];

const view = (it: GeometryItem, revealed: boolean) => {
  const Comp = geometryEngine.Component;
  return render(
    <Comp
      item={it}
      ctx={ctx}
      revealed={revealed}
      wrongMark={null}
      disabled={revealed}
      submit={vi.fn()}
    />,
  );
};

describe('描く問題の解説の見本', () => {
  it.each(kinds)('%s: 何も描かずに解説へ進むと見本の形が出る', (_n, it, shape) => {
    const { container } = view(it, true);
    const ex = container.querySelector('[data-testid="geo-example"]');
    expect(ex).not.toBeNull();
    const el = ex!.querySelector('.geo-answer');
    expect(el).not.toBeNull();
    expect(el!.tagName).toBe(shape === 'line' ? 'line' : 'polygon');
  });
  it.each(kinds)('%s: 答える前は見本を出さない', (_n, it) => {
    const { container } = view(it, false);
    expect(container.querySelector('[data-testid="geo-example"]')).toBeNull();
    expect(container.querySelector('.geo-answer')).toBeNull();
  });
});
