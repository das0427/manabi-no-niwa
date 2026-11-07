/**
 * 図の時計の読み上げ用の名前（aria-label）。分の読みは、1・3・4・6・8・0 で終わる数が「ぷん」、
 * それ以外が「ふん」（clock.tsx の timeText・durationText と同じ規則。2.1.0 の文言の点検 A8）。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Clock } from './Figure';

afterEach(cleanup);

const label = (h: number, m: number): string | null => {
  const { container } = render(<Clock h={h} m={m} />);
  return container.querySelector('svg')?.getAttribute('aria-label') ?? null;
};

describe('図の時計の読み上げ用の名前', () => {
  it('ちょうどの時刻は「〜じ」だけ', () => {
    expect(label(3, 0)).toBe('3じ');
  });
  it('分の読み: ぷん（0・1・3・4・6・8 で終わる）と ふん（2・5・7・9 で終わる）', () => {
    expect(label(3, 5)).toBe('3じ5ふん');
    expect(label(3, 10)).toBe('3じ10ぷん');
    expect(label(3, 15)).toBe('3じ15ふん');
    expect(label(3, 30)).toBe('3じ30ぷん');
    expect(label(3, 40)).toBe('3じ40ぷん');
    expect(label(3, 45)).toBe('3じ45ふん');
    expect(label(3, 8)).toBe('3じ8ぷん');
    expect(label(3, 7)).toBe('3じ7ふん');
  });
});
