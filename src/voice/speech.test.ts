import { describe, expect, it } from 'vitest';
import { allNumberParts, integerParts, speechParts } from './speech';

describe('数の読みの部品', () => {
  it.each([
    [0, null, ['ぜろ']],
    [7, null, ['なな']],
    [345, null, ['さんびゃく', 'よんじゅう', 'ご']],
    [1, 'こ', ['いっこ']],
    [20, 'こ', ['にじゅっこ']],
    [23, 'ひき', ['にじゅう', 'さんびき']],
    [300, 'こ', ['さんびゃくこ']],
    [12000, null, ['いち', 'まん', 'にせん']],
    [10000, 'こ', ['いち', 'まんこ']],
  ] as const)('%i %s', (n, c, want) => {
    expect(integerParts(n, c)).toEqual(want);
  });
  it('すべての部品が部品一覧に含まれる（音声を作り漏らさない）', () => {
    const all = new Set(allNumberParts());
    for (let n = 0; n <= 20000; n += 7)
      for (const c of [null, 'こ', 'ひき', 'にん', 'えん'])
        for (const p of integerParts(n, c)) expect(all.has(p), `${n}${c ?? ''}: ${p}`).toBe(true);
    expect(all.size).toBeLessThan(800);
  });
});

describe('文の部品分け', () => {
  it('数字の無い文はまるごと1本', () => {
    const p = speechParts('g1-math', 'あわせて いくつ？');
    expect(p).toHaveLength(1);
    expect(p[0]!.key.startsWith('g1-math/')).toBe(true);
  });
  it('数字は共通の数の部品、助数詞は数に付く', () => {
    const p = speechParts('g1-math', 'りんごが 1こ、みかんが 23こ。');
    expect(p.map((x) => x.yomi)).toEqual([
      'りんごが',
      'いっこ',
      '、みかんが',
      'にじゅう',
      'さんこ',
      '。',
    ]);
    expect(p[1]!.key.startsWith('num/')).toBe(true);
  });
  it('同じ言い回しは数が違っても同じキー（台本が増えない）', () => {
    const a = speechParts('g1-math', '3 ＋ 5 ＝ {{}}').map((x) => x.key);
    const b = speechParts('g1-math', '4 ＋ 2 ＝ {{}}').map((x) => x.key);
    expect(a[1]).toBe(b[1]); // 「たす」
    expect(a[3]).toBe(b[3]); // 「は なに」
  });
});
