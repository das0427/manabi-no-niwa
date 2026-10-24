import { describe, expect, it } from 'vitest';
import { displayOrder, displayPosition } from './order';

const all = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('選択肢を並べる順（choice・geometry・graph・fill 共通）', () => {
  it('同じ問題は毎回同じ順・中身は同じ', () => {
    const item = { id: 'x:1' };
    const a = displayOrder(item, all(4));
    expect(displayOrder(item, all(4))).toEqual(a);
    expect([...a].sort()).toEqual(all(4));
  });
  it('正解を先頭に書いた問題でも、先頭に出るのは偏らない', () => {
    let first = 0;
    for (let k = 0; k < 600; k++) if (displayOrder({ id: `q:${k}` }, all(3))[0] === 0) first++;
    expect(first / 600).toBeGreaterThan(0.22);
    expect(first / 600).toBeLessThan(0.45);
  });
  it('fixedOrder・「1ばん」と位置で指す文・記号だけの選択肢は並べ替えない', () => {
    expect(displayOrder({ id: 'q', fixedOrder: true }, all(3))).toEqual(all(3));
    expect(displayOrder({ id: 'q', explain: '1ばんと 3ばんは ちょっかく' }, all(3))).toEqual(
      all(3),
    );
    expect(displayOrder({ id: 'q', hints: ['2ばんめの え'] }, all(3))).toEqual(all(3));
    expect(displayOrder({ id: 'q' }, all(3), ['あ', 'い', 'う'])).toEqual(all(3));
  });
  it('表示の何番目かを、並べ替えたあとの位置で返す', () => {
    const item = { id: 'pos:7' };
    const order = displayOrder(item, all(4));
    for (let i = 0; i < 4; i++) expect(displayPosition(item, 4, i)).toBe(order.indexOf(i) + 1);
  });
});
