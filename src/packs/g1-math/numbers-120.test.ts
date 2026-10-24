import { describe, expect, it } from 'vitest';
import { kanaOf } from './numbers-120';

describe('100より大きい数の読み', () => {
  it('1〜99 を ひらがなで読む', () => {
    expect(kanaOf(1)).toBe('いち');
    expect(kanaOf(10)).toBe('じゅう');
    expect(kanaOf(15)).toBe('じゅうご');
    expect(kanaOf(20)).toBe('にじゅう');
    expect(kanaOf(47)).toBe('よんじゅうなな');
    expect(kanaOf(99)).toBe('きゅうじゅうきゅう');
  });
});
