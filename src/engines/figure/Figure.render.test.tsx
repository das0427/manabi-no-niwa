/** 図の画面（X4）: 数直線の印のラベルは svg の上（▼ の真上）・折れ線の単位は縦軸の上（図の左上） */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RenderCtx } from '../types';
import { Figure } from './Figure';

afterEach(cleanup);

const ctx: Pick<RenderCtx, 'furigana' | 'learnerGrade'> = {
  furigana: 'unlearned',
  learnerGrade: 4,
};

describe('Figure（X4）', () => {
  it('数直線: 印のラベルの箱は svg より前（上）にあり、viewBox の下の空きを詰める', () => {
    const { container } = render(
      <Figure
        fig={{
          kind: 'numberline',
          min: 0,
          max: 2,
          step: 1 / 3,
          labelEvery: 3,
          marks: [{ at: 2 / 3, label: '[[2/3]]' }],
        }}
        ctx={ctx}
      />,
    );
    const nl = container.querySelector('.fig-nl')!;
    const kids = Array.from(nl.children);
    const labels = nl.querySelector('.fig-nl__labels')!;
    const svg = nl.querySelector('svg')!;
    expect(kids.indexOf(labels)).toBeLessThan(kids.indexOf(svg));
    expect(labels.querySelectorAll(':scope > span').length).toBe(1);
    // 0 150 → 10 120 の範囲（▼ とジャンプの弧の少し上〜目もりの数の下）。高さは 150 より小さい
    const vb = svg.getAttribute('viewBox')!.split(' ').map(Number);
    expect(vb[1]).toBe(10);
    expect(vb[3]).toBe(110);
  });
  it('数直線: ラベルの無い印だけなら箱を作らない', () => {
    const { container } = render(
      <Figure
        fig={{ kind: 'numberline', min: 0, max: 10, step: 1, marks: [{ at: 3, tone: 'focus' }] }}
        ctx={ctx}
      />,
    );
    expect(container.querySelector('.fig-nl__labels')).toBeNull();
  });
  it('折れ線: 単位の札は svg の前（縦軸の上）にあり、横軸の札の下には出ない', () => {
    const { container } = render(
      <Figure
        fig={{
          kind: 'line',
          labels: ['9時', '10時', '11時'],
          values: [16, 18, 20],
          scaleStep: 2,
          min: 10,
          unit: '℃',
        }}
        ctx={ctx}
      />,
    );
    const chart = container.querySelector('.fig-chart')!;
    const kids = Array.from(chart.children);
    const unit = chart.querySelector('.fig-chart__unit')!;
    const svg = chart.querySelector('svg')!;
    const labels = chart.querySelector('.fig-chart__labels')!;
    expect(unit.textContent).toBe('（℃）');
    expect(kids.indexOf(unit)).toBeLessThan(kids.indexOf(svg));
    expect(kids.indexOf(unit)).toBeLessThan(kids.indexOf(labels));
    expect(kids[kids.length - 1]).toBe(labels);
  });
  it('棒グラフ: 単位が無ければ単位の札を出さない', () => {
    const { container } = render(
      <Figure fig={{ kind: 'bar', labels: ['A', 'B'], values: [3, 5], scaleStep: 1 }} ctx={ctx} />,
    );
    expect(container.querySelector('.fig-chart__unit')).toBeNull();
  });
});
