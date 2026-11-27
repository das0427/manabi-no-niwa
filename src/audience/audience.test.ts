import { describe, expect, it } from 'vitest';
import {
  AUDIENCE_IDS,
  audienceForGrade,
  audienceUx,
  defaultSupport,
  gradeOf,
  isPreschool,
  SESSION_MINUTE_CHOICES,
  sessionMinuteChoices,
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

describe('利用時間の目安の選択肢（保護者画面「せってい」）', () => {
  it('区分の既定（2歳段階・3歳段階を含む）は、すべて選択肢にある', () => {
    const defaults = [
      audienceUx('toddler', 2).sessionMinutes,
      audienceUx('toddler', 3).sessionMinutes,
      ...AUDIENCE_IDS.map((a) => audienceUx(a).sessionMinutes),
    ];
    for (const m of defaults) expect(SESSION_MINUTE_CHOICES).toContain(m);
    // FX10 の既定（ux-by-age 1章の表）。3歳段階の 8 分が選べなかった
    expect(new Set(defaults)).toEqual(new Set([5, 8, 10, 15, 20]));
  });
  it('選択肢は小さい順で、重なりがない', () => {
    expect([...SESSION_MINUTE_CHOICES]).toEqual([5, 8, 10, 15, 20, 30]);
  });
  it('今の値が選択肢に無いとき（読み込んだ記録など）は、その値も小さい順に並べる', () => {
    expect(sessionMinuteChoices(8)).toEqual([5, 8, 10, 15, 20, 30]);
    expect(sessionMinuteChoices(0)).toEqual([5, 8, 10, 15, 20, 30]);
    expect(sessionMinuteChoices(12)).toEqual([5, 8, 10, 12, 15, 20, 30]);
    expect(sessionMinuteChoices(45)).toEqual([5, 8, 10, 15, 20, 30, 45]);
  });
});

describe('ふりがな（学年に合わせる）', () => {
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
