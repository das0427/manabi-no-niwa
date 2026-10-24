import { describe, expect, it } from 'vitest';
import { counterReading, speechYomi } from './yomi';

describe('数＋助数詞の読み', () => {
  it.each([
    [1, 'こ', 'いっこ'],
    [3, 'こ', 'さんこ'],
    [6, 'こ', 'ろっこ'],
    [10, 'こ', 'じゅっこ'],
    [11, 'こ', 'じゅういっこ'],
    [20, 'こ', 'にじゅっこ'],
    [1, 'ひき', 'いっぴき'],
    [3, 'ひき', 'さんびき'],
    [4, 'ひき', 'よんひき'],
    [23, 'ひき', 'にじゅうさんびき'],
    [1, 'にん', 'ひとり'],
    [2, 'にん', 'ふたり'],
    [5, 'にん', 'ごにん'],
    [3, 'ふん', 'さんぷん'],
    [4, 'じ', 'よじ'],
    [9, 'じ', 'くじ'],
    [100, 'こ', 'ひゃくこ'],
  ])('%i%s → %s', (n, c, want) => {
    expect(counterReading(n, c)).toBe(want);
  });
});

describe('speechYomi', () => {
  it('式・空欄・ふりがな・分数', () => {
    expect(speechYomi('3 ＋ 5 ＝ {{}}')).toBe('さん たす ご は なに');
    expect(speechYomi('大《おお》きい[[1/2]]')).toBe('おおきいにぶんの いち');
    expect(speechYomi('りんごが 1こ')).toBe('りんごが いっこ');
    expect(speechYomi('0.5')).toBe('ぜろてんご');
  });
});
