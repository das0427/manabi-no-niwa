/** graph の画面: 2本の折れ線の凡例・円グラフの割合を答える欄の単位 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { audienceUx } from '../../audience/audience';
import type { RenderCtx } from '../types';
import { graphEngine } from './graph';
import { graphSamples } from './graph.samples';

afterEach(cleanup);

const ctx: RenderCtx = {
  packId: 'test',
  readAloud: 'off',
  furigana: 'unlearned',
  learnerGrade: 4,
  preschool: false,
  textScale: 1,
  ux: audienceUx('g4'),
};
const sample = (id: string) => graphSamples.find((s) => s.id === `graph-sample:${id}`)!;
const Comp = graphEngine.Component;

describe('graph の画面（追加分）', () => {
  it('2本の折れ線: 凡例に2つ。2本目は破線と ■（点の数 = 項目の数）', () => {
    const s = sample('line2-diff');
    const { container } = render(
      <Comp item={s} ctx={ctx} revealed={false} wrongMark={null} disabled={false} submit={vi.fn()} />,
    );
    const legend = screen.getByTestId('series-legend');
    expect(legend.querySelectorAll('li').length).toBe(2);
    expect(legend.textContent).toContain('なは');
    expect(legend.textContent).toContain('さっぽろ');
    expect(screen.getByTestId('series2').querySelectorAll('rect.gr-dot2').length).toBe(6);
    expect(container.querySelectorAll('.gr-line--2').length).toBeGreaterThan(0);
    // 欄の後ろの単位
    expect(screen.getByTestId('field-0').nextElementSibling?.textContent).toBe('ど');
  });
  it('円グラフ: 割合を入れて答える（単位 % は欄の後ろ）', () => {
    const s = sample('pie-percent');
    const submit = vi.fn();
    render(<Comp item={s} ctx={ctx} revealed={false} wrongMark={null} disabled={false} submit={submit} />);
    expect(screen.getByTestId('field-0').nextElementSibling?.textContent).toBe('%');
    fireEvent.click(screen.getByTestId('key-2'));
    fireEvent.click(screen.getByTestId('key-5'));
    fireEvent.click(screen.getByTestId('check'));
    expect(submit).toHaveBeenCalledWith({ fields: ['25'] });
    expect(graphEngine.judge(s, { fields: ['25'] }).result).toBe('correct');
    expect(graphEngine.judge(s, { fields: ['65'] })).toMatchObject({
      misconception: 'mis-read-cumulative',
    });
  });
  it('帯グラフ: いちばん多い項目を選ぶ', () => {
    const s = sample('band-most');
    const submit = vi.fn();
    render(<Comp item={s} ctx={ctx} revealed={false} wrongMark={null} disabled={false} submit={submit} />);
    fireEvent.click(screen.getByTestId('opt-0'));
    expect(submit).toHaveBeenCalledWith({ pick: [0] });
    expect(graphEngine.judge(s, { pick: [0] }).result).toBe('correct');
  });
});
