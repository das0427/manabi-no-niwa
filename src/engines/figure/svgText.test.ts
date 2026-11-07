import { describe, expect, it } from 'vitest';
import { LABEL_GAP_EM, labelFitRatio, slotGapPx } from './svgText';

describe('labelFitRatio（X4: 横軸の札と札のすき間）', () => {
  it('札の中身の幅 ＋ 字の 0.4 倍 を枠の幅で割る（1 以下なら入る）', () => {
    expect(LABEL_GAP_EM).toBe(0.4);
    // 字 20px・中身 60px・枠 80px: (60 + 8) / 80 = 0.85
    expect(labelFitRatio(60, 20, 80)).toBeCloseTo(0.85, 6);
    // 中身が枠に収まるだけでも（枠の 100%）、すき間が取れなければ入らない（g4.sci.weather の「10時」「11時」）
    expect(labelFitRatio(80, 20, 80)).toBeGreaterThan(1);
  });
  it('字を比 r で縮めると、中身もすき間も同じ比で縮んで入る（chrome が 0 のとき）', () => {
    const r = labelFitRatio(88, 20, 80);
    expect(r).toBeGreaterThan(1);
    const k = 1 / r;
    expect(labelFitRatio(88 * k, 20 * k, 80)).toBeCloseTo(1, 6);
  });
  it('枠のあるボタンの札は、枠線・余白の分をすき間から引く（引ききれば中身の幅だけ）', () => {
    // 字 20px: すき間 8px。枠・余白 5px なら 3px、10px なら 0
    expect(labelFitRatio(60, 20, 80, 5)).toBeCloseTo(63 / 80, 6);
    expect(labelFitRatio(60, 20, 80, 10)).toBeCloseTo(60 / 80, 6);
  });
  it('列のすき間（spare）がすき間の下限を受け持つなら、2 段にしない（絵グラフの札。すき間 1.2u）', () => {
    // 字 25.6px・中身 128px・枠 143px・列のすき間 15.4px: すき間 10.2px は列のすき間で足りる → 128 / 143
    expect(labelFitRatio(128, 25.6, 143, 15.4)).toBeCloseTo(128 / 143, 6);
    expect(labelFitRatio(128, 25.6, 143)).toBeCloseTo((128 + 10.24) / 143, 6);
  });
  it('枠の幅が 0 以下（まだ測れない）なら 0', () => {
    expect(labelFitRatio(60, 20, 0)).toBe(0);
  });
});

describe('slotGapPx（横に並んだ札の枠どうしのすき間）', () => {
  const box = (left: number, right: number): HTMLElement => {
    const el = document.createElement('span');
    el.getBoundingClientRect = () => ({ left, right }) as DOMRect;
    return el;
  };
  it('1 つ目の右はしと 2 つ目の左はしの間（負にならない）', () => {
    expect(slotGapPx([box(0, 100), box(115, 215), box(230, 330)])).toBe(15);
    expect(slotGapPx([box(0, 100), box(100, 200)])).toBe(0);
    expect(slotGapPx([box(0, 100), box(90, 190)])).toBe(0);
  });
  it('札が 1 つだけなら 0', () => {
    expect(slotGapPx([box(0, 100)])).toBe(0);
    expect(slotGapPx([])).toBe(0);
  });
});
