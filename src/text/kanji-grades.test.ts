import { describe, expect, it } from 'vitest';
import { KANJI_BY_GRADE, kanjiGrade } from './kanji-grades';

const COUNTS = { 1: 80, 2: 160, 3: 200, 4: 202, 5: 193, 6: 191 } as const;
const GRADES = [1, 2, 3, 4, 5, 6] as const;

describe('学年別漢字配当表', () => {
  it('各学年の字数が学習指導要領（平成29年告示）の別表のとおり', () => {
    for (const g of GRADES) {
      expect([...KANJI_BY_GRADE[g]].length, `第${g}学年`).toBe(COUNTS[g]);
    }
  });

  it('合計 1026 字で、学年内にも学年間にも重複が無い', () => {
    const all = GRADES.flatMap((g) => [...KANJI_BY_GRADE[g]]);
    expect(all.length).toBe(1026);
    expect(new Set(all).size).toBe(1026);
  });

  it('すべて CJK 統合漢字（かなや記号が混じっていない）', () => {
    for (const g of GRADES) {
      for (const ch of KANJI_BY_GRADE[g]) {
        expect(/^[一-鿿]$/u.test(ch), `${ch}（第${g}学年）`).toBe(true);
      }
    }
  });

  it('2020 年度の改訂（都道府県名の漢字・学年の移行）が反映されている', () => {
    // 4 年に都道府県名の漢字 25 字
    for (const ch of '茨媛岡潟岐熊香佐埼崎滋鹿縄井沖栃奈梨阪阜賀群徳富城') {
      expect(kanjiGrade(ch), ch).toBe(4);
    }
  });

  it('kanjiGrade: 各学年の代表字と配当外', () => {
    expect(kanjiGrade('一')).toBe(1);
    expect(kanjiGrade('林')).toBe(1);
    expect(kanjiGrade('話')).toBe(2);
    expect(kanjiGrade('島')).toBe(3);
    expect(kanjiGrade('労')).toBe(4);
    expect(kanjiGrade('歴')).toBe(5);
    expect(kanjiGrade('論')).toBe(6);
    // 中学校以降の漢字（第 7 = 配当外）
    expect(kanjiGrade('猫')).toBe(7);
    expect(kanjiGrade('鬱')).toBe(7);
    // 漢字でない字・空文字・2 字以上
    expect(kanjiGrade('あ')).toBe(7);
    expect(kanjiGrade('1')).toBe(7);
    expect(kanjiGrade('')).toBe(7);
    expect(kanjiGrade('山川')).toBe(1);
  });

  it('kanjiGrade は KANJI_BY_GRADE と食い違わない', () => {
    for (const g of GRADES) {
      for (const ch of KANJI_BY_GRADE[g]) expect(kanjiGrade(ch)).toBe(g);
    }
  });
});
