import { describe, expect, it } from 'vitest';
import { canonicalRomaji, judgeRomaji } from './romaji';

describe('告示のつづり（手本）', () => {
  it.each([
    ['すし', 'sushi'],
    ['ちず', 'chizu'],
    ['つくえ', 'tsukue'],
    ['ふね', 'fune'],
    ['じかん', 'jikan'],
    ['しゃしん', 'shashin'],
    ['ちゃわん', 'chawan'],
    ['きって', 'kitte'],
    ['まっちゃ', 'maccha'],
    ['しんぶん', 'shinbun'],
    ['さんぽ', 'sanpo'],
    ['こうえん', 'kōen'],
    ['おおきい', 'ōkii'],
    ['ゆうき', 'yūki'],
    ['おねえさん', 'onēsan'],
    ['とけい', 'tokei'],
    ['おじいさん', 'ojiisan'],
    ['きんえん', "kin'en"],
    ['ケーキ', 'kēki'],
    ['ぎゅうにゅう', 'gyūnyū'],
  ])('%s → %s', (kana, want) => {
    expect(canonicalRomaji(kana)).toBe(want);
  });
});

describe('judgeRomaji', () => {
  it('長音の書き方の揺れは正解', () => {
    for (const v of ['kōen', 'kôen', 'kouen', 'KOUEN', 'Kōen'])
      expect(judgeRomaji('こうえん', v).result).toBe('correct');
    for (const v of ['ōkii', 'ookii']) expect(judgeRomaji('おおきい', v).result).toBe('correct');
    expect(judgeRomaji('ケーキ', 'keeki').result).toBe('correct');
  });
  it("ん は n（b/m/p の前でも）。母音の前は n' も可", () => {
    expect(judgeRomaji('しんぶん', 'shinbun').result).toBe('correct');
    expect(judgeRomaji('しんぶん', 'shimbun').result).toBe('wrong');
    expect(judgeRomaji('きんえん', "kin'en").result).toBe('correct');
    expect(judgeRomaji('きんえん', 'kinen').result).toBe('correct');
  });
  it('訓令式は「もう一度」と手本', () => {
    expect(judgeRomaji('すし', 'susi')).toEqual({
      result: 'retry',
      reason: 'kunrei',
      canonical: 'sushi',
    });
    expect(judgeRomaji('ちゃわん', 'tyawan')).toMatchObject({ result: 'retry', reason: 'kunrei' });
    expect(judgeRomaji('まっちゃ', 'mattya')).toMatchObject({ result: 'retry', reason: 'kunrei' });
    expect(judgeRomaji('ふね', 'hune')).toMatchObject({ result: 'retry' });
  });
  it('促音は子音を重ねる（ch の前は c）', () => {
    expect(judgeRomaji('まっちゃ', 'maccha').result).toBe('correct');
    expect(judgeRomaji('まっちゃ', 'matcha').result).toBe('wrong');
    expect(judgeRomaji('きって', 'kite').result).toBe('wrong');
  });
  it('ちがう語は誤答（手本つき）', () => {
    expect(judgeRomaji('いぬ', 'neko')).toEqual({ result: 'wrong', canonical: 'inu' });
    expect(judgeRomaji('いぬ', '')).toMatchObject({ result: 'wrong' });
  });
  it('未対応のかなは教材データの誤りとして例外', () => {
    expect(() => canonicalRomaji('ゔ')).toThrow();
  });
});
