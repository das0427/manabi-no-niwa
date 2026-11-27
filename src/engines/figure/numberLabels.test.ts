import { describe, expect, it } from 'vitest';
import { thinNumberLabels } from './numberLabels';

const range = (from: number, to: number, step: number) => {
  const out: number[] = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
};

describe('thinNumberLabels（W8: 数直線の数を間引く）', () => {
  it('入るときは全部書く', () => {
    const all = range(0, 10, 1);
    expect(thinNumberLabels(all, all, [], 30)).toEqual(all);
  });
  it('6 けたの数が 11 個（g4.math.rounding/7）は、両端・印・5 本ごと', () => {
    const all = range(460000, 470000, 1000);
    expect(thinNumberLabels(all, all, [{ at: 466000 }], 30)).toEqual([
      460000, 465000, 466000, 470000,
    ]);
  });
  it('字が大きいほど間引く', () => {
    const all = range(0, 20, 1);
    const wide = thinNumberLabels(all, all, [], 60);
    expect(wide.length).toBeLessThan(all.length);
    expect(wide[0]).toBe(0);
    expect(wide[wide.length - 1]).toBe(20);
  });
});
