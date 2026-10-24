import { describe, expect, it } from 'vitest';
import {
  AUDIENCE_IDS,
  audienceForGrade,
  audienceUx,
  defaultSupport,
  gradeOf,
  isPreschool,
  showFurigana,
} from './audience';

describe('区分', () => {
  it('2〜3歳は内部で2段階', () => {
    expect(audienceUx('toddler', 2)).toMatchObject({
      maxChoices: 2,
      softJudgement: true,
      recordMastery: false,
      judgedTrace: false,
      sessionMinutes: 5,
      withAdult: true,
    });
    expect(audienceUx('toddler', 3).maxChoices).toBe(3);
    expect(audienceUx('toddler').recordMastery).toBe(true);
  });
  it('全区分に設計値と既定の支援設定がある', () => {
    for (const a of AUDIENCE_IDS) {
      expect(audienceUx(a).roundSize).toBeGreaterThan(0);
      expect(defaultSupport(a).furigana).toBe('unlearned');
    }
  });
  it('読み上げ: 小1〜2は自動、小3以上はボタン', () => {
    expect(defaultSupport('g2').readAloud).toBe('always');
    expect(defaultSupport('g3').readAloud).toBe('button');
    expect(defaultSupport('g6').style).toBe('calm');
  });
  it('学年', () => {
    expect(gradeOf('g4')).toBe(4);
    expect(gradeOf('p5')).toBe(0);
    expect(isPreschool('toddler')).toBe(true);
    expect(audienceForGrade(3)).toBe('g3');
    expect(audienceForGrade(null)).toBeNull();
  });
});

describe('ふりがな（がくねんに あわせる）', () => {
  it('その学年以上の配当漢字に付け、前の学年までは付けない', () => {
    expect(showFurigana('unlearned', 3, 3)).toBe(true);
    expect(showFurigana('unlearned', 4, 3)).toBe(true);
    expect(showFurigana('unlearned', 2, 3)).toBe(false);
  });
  it('就学前と配当外は全部に付ける', () => {
    expect(showFurigana('unlearned', 1, 0)).toBe(true);
    expect(showFurigana('unlearned', null, 6)).toBe(true);
  });
  it('すべて／なし', () => {
    expect(showFurigana('all', 1, 6)).toBe(true);
    // なし: 習った学年までの字には付けない。上の学年の字・就学前には付ける
    expect(showFurigana('none', 3, 3)).toBe(false);
    expect(showFurigana('none', 1, 6)).toBe(false);
    expect(showFurigana('none', 6, 1)).toBe(true);
    expect(showFurigana('none', 1, 0)).toBe(true);
  });
});
