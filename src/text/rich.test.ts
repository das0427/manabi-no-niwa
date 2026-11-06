import { describe, expect, it } from 'vitest';
import {
  findBareKanji,
  findOrphanReading,
  numberReading,
  parseRich,
  plainText,
  spacedLabel,
  spokenReading,
} from './rich';

describe('parseRich', () => {
  it('よみ付きの語', () => {
    expect(parseRich('大《おお》きな犬《いぬ》だ')).toEqual([
      { t: 'ruby', base: '大', reading: 'おお' },
      { t: 'text', s: 'きな' },
      { t: 'ruby', base: '犬', reading: 'いぬ' },
      { t: 'text', s: 'だ' },
    ]);
  });
  it('複数の漢字の語', () => {
    expect(parseRich('学校《がっこう》へ')).toEqual([
      { t: 'ruby', base: '学校', reading: 'がっこう' },
      { t: 'text', s: 'へ' },
    ]);
  });
  it('分数・帯分数・強調・空欄', () => {
    expect(parseRich('[[3/4]]と[[2 1/3]]')).toEqual([
      { t: 'frac', num: 3, den: 4, whole: undefined },
      { t: 'text', s: 'と' },
      { t: 'frac', whole: 2, num: 1, den: 3 },
    ]);
    expect(parseRich('**ここ**に{{}}')).toEqual([
      { t: 'strong', children: [{ t: 'text', s: 'ここ' }] },
      { t: 'text', s: 'に' },
      { t: 'blank' },
    ]);
  });
  it('分数の分子・分母に □○△ を置ける', () => {
    expect(parseRich('[[□/10]]')).toEqual([{ t: 'frac', num: '□', den: 10, whole: undefined }]);
    expect(parseRich('[[3/□]]')).toEqual([{ t: 'frac', num: 3, den: '□', whole: undefined }]);
    expect(parseRich('[[□/○]]')).toEqual([{ t: 'frac', num: '□', den: '○', whole: undefined }]);
    expect(spokenReading('[[□/10]]')).toBe('10ぶんの しかく'.replace('10', numberReading(10)));
    expect(spokenReading('[[□/○]]')).toBe('まるぶんの しかく');
    expect(plainText('[[3/□]]')).toBe('3/□');
  });
  it('《!よみ》は表示しないよみ（学習対象の字）', () => {
    expect(parseRich('山《!やま》')).toEqual([
      { t: 'ruby', base: '山', reading: 'やま', hide: true },
    ]);
    expect(spokenReading('山《!やま》')).toBe('やま');
    expect(plainText('山《!やま》')).toBe('山');
    expect(findBareKanji('山《!やま》')).toEqual([]);
  });
  it('閉じていない記号は文字のまま', () => {
    expect(plainText('a**b')).toBe('a**b');
    expect(plainText('[[x]]')).toBe('[[x]]');
  });
});

describe('findBareKanji（ふりがなの規則の検査）', () => {
  it('よみの無い漢字を見つける', () => {
    expect(findBareKanji('犬《いぬ》と猫がいる')).toEqual(['猫']);
    expect(findBareKanji('**大**きい')).toEqual(['大']);
    expect(findBareKanji('ひらがなと123')).toEqual([]);
  });
});

describe('findOrphanReading（親字の無い《》。C18）', () => {
  it('記号・英字・かなの後ろの《》を見つける（画面に字のまま出る）', () => {
    expect(findOrphanReading('×《ばつ》は ばつ')).toEqual(['《ばつ》']);
    expect(findOrphanReading('Y《ワイ》と X《エックス》')).toEqual(['《ワイ》', '《エックス》']);
    expect(findOrphanReading('**×《ばつ》**')).toEqual(['《ばつ》']);
  });
  it('漢字の後ろの《》は親字があるので誤りにしない', () => {
    expect(findOrphanReading('犬《いぬ》と**山《!やま》**')).toEqual([]);
    expect(findOrphanReading('ひらがなと123')).toEqual([]);
  });
});

describe('読み上げ', () => {
  it('漢字は《》のよみ、分数は「〜ぶんの〜」', () => {
    expect(spokenReading('大《おお》きな[[3/4]]')).toBe('おおきなよんぶんの さん');
    expect(spokenReading('[[1 2/5]]')).toBe('いちと ごぶんの に');
  });
  it('数のよみ（音便）', () => {
    expect(numberReading(300)).toBe('さんびゃく');
    expect(numberReading(600)).toBe('ろっぴゃく');
    expect(numberReading(800)).toBe('はっぴゃく');
    expect(numberReading(3000)).toBe('さんぜん');
    expect(numberReading(8000)).toBe('はっせん');
    expect(numberReading(1234)).toBe('せんにひゃくさんじゅうよん');
    expect(numberReading(10)).toBe('じゅう');
    expect(numberReading(0)).toBe('ぜろ');
  });
});

describe('spacedLabel（空白で区切って書いたラベルは空白でだけ折る。第6回 W2 のレビュー）', () => {
  it('空白の数 × 12 ≧ 字数なら空白で区切ったラベル', () => {
    expect(spacedLabel('南東《なんとう》より 南《みなみ》に よった 所《ところ》')).toBe(true);
    expect(spacedLabel('東の 方から 南を 通って 西の 方へ')).toBe(true);
  });
  it('名前の空白が 1 つあるだけの文・空白の無い文・ラベルの無い札は違う', () => {
    expect(spacedLabel('森川 はるかさんは図書館で本を三さつかりました')).toBe(false);
    expect(spacedLabel('きれいな花')).toBe(false);
    expect(spacedLabel(undefined)).toBe(false);
  });
});
