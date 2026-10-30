// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { contrast, isLargeText, requiredRatio, uToPx } from './contrast.ts';

describe('コントラスト比と大きな文字の判定（review-1 #18、DESINGN.md 3.1）', () => {
  it('DESINGN.md 3.1 の表の値と合う', () => {
    expect(contrast('#4A3B32', '#FBF5E9')).toBeCloseTo(9.85, 1);
    expect(contrast('#665649', '#F3E8D2')).toBeCloseTo(5.78, 1);
    expect(contrast('#FFFDF8', '#3B7243')).toBeCloseTo(5.62, 1);
  });

  it('太さ 700 は 18.67px 以上、500 以下は 24px 以上が大きな文字', () => {
    expect(isLargeText(18.67, 700)).toBe(true);
    expect(isLargeText(18.66, 700)).toBe(false);
    expect(isLargeText(23.9, 500)).toBe(false);
    expect(isLargeText(24, 400)).toBe(true);
  });

  it('u を想定の最小 12.8px で換算する（1.7u の 700 は 21.76px = 大きな文字）', () => {
    expect(uToPx(1.7)).toBeCloseTo(21.76, 2);
    expect(isLargeText(uToPx(1.4), 700)).toBe(false); // 17.92px
    expect(isLargeText(uToPx(1.5), 700)).toBe(true); // 19.2px
  });

  it('ふりがな・補助の文字は大きさにかかわらず 4.5', () => {
    expect(requiredRatio({ px: uToPx(1.7), weight: 700 })).toBe(3);
    expect(requiredRatio({ px: uToPx(1.7), weight: 700, alwaysNormal: true })).toBe(4.5);
  });
});
