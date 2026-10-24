import { describe, expect, it } from 'vitest';
import { displayOrder, visibleOptionIndices } from './choice';

describe('選択肢の並び', () => {
  const opts = (labels: string[]) => labels.map((label, i) => ({ label, correct: i === 0 }));
  it('同じ問題は毎回同じ順・中身は同じ', () => {
    const item = { id: 'x:1', options: opts(['1', '2', '3', '4']) };
    const a = displayOrder(item, [0, 1, 2, 3]);
    expect(displayOrder(item, [0, 1, 2, 3])).toEqual(a);
    expect([...a].sort()).toEqual([0, 1, 2, 3]);
  });
  it('正解が先頭に書かれた問題でも、多くの問題で先頭以外に出る', () => {
    let first = 0;
    for (let k = 0; k < 400; k++)
      if (displayOrder({ id: `q:${k}`, options: opts(['a', 'b', 'c']) }, [0, 1, 2])[0] === 0)
        first++;
    expect(first / 400).toBeGreaterThan(0.2);
    expect(first / 400).toBeLessThan(0.47);
  });
  it('絵だけの選択肢は、解説・ヒントが「1ばん」と位置で指すときだけ並べ替えない', () => {
    const options = [{ correct: true }, {}, {}];
    expect(
      displayOrder({ id: 'q:1', options, explain: '1ばんの えが ただしい' }, [0, 1, 2]),
    ).toEqual([0, 1, 2]);
    let moved = 0;
    for (let k = 0; k < 50; k++)
      if (displayOrder({ id: `p:${k}`, options }, [0, 1, 2])[0] !== 0) moved++;
    expect(moved).toBeGreaterThan(20);
  });
  it('fixedOrder と「あ・い」は並べ替えない', () => {
    expect(
      displayOrder({ id: 'q', fixedOrder: true, options: opts(['3', '2', '1']) }, [0, 1, 2]),
    ).toEqual([0, 1, 2]);
    expect(displayOrder({ id: 'q', options: opts(['あ', 'い', 'う']) }, [0, 1, 2])).toEqual([
      0, 1, 2,
    ]);
  });
});

describe('選択肢を減らすとき正解を残す（コードレビュー #3）', () => {
  it('正解が後ろにあっても残る', () => {
    expect(visibleOptionIndices([{}, {}, { correct: true }], 2)).toEqual([0, 2]);
  });
  it('上限以内ならそのまま・元の順', () => {
    expect(visibleOptionIndices([{ correct: true }, {}, {}], 3)).toEqual([0, 1, 2]);
    expect(visibleOptionIndices([{}, { correct: true }, {}, {}], 2)).toEqual([0, 1]);
  });
});
