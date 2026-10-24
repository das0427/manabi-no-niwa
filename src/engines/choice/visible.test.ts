import { describe, expect, it } from 'vitest';
import { visibleOptionIndices } from './choice';

describe('選択肢を減らすとき正解を残す（コードレビュー #3）', () => {
  it('正解が後ろにあっても残る', () => {
    expect(visibleOptionIndices([{}, {}, { correct: true }], 2)).toEqual([0, 2]);
  });
  it('上限以内ならそのまま・元の順', () => {
    expect(visibleOptionIndices([{ correct: true }, {}, {}], 3)).toEqual([0, 1, 2]);
    expect(visibleOptionIndices([{}, { correct: true }, {}, {}], 2)).toEqual([0, 1]);
  });
});
