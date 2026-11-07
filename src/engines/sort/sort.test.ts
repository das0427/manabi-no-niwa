import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseItemErrors, ctxFor } from '../order/testkit';
import { checkSort, judgeSort, sortEngine, sortVisible, type SortItem } from './sort';
import { sortSamples } from './sort.samples';

afterEach(cleanup);

const item = (over: Partial<SortItem> = {}): SortItem => ({
  engine: 'sort',
  id: 't',
  objective: 'o',
  level: 0,
  prompt: 'わけよう',
  hints: ['a', 'b', 'c'],
  explain: 'e',
  identity: 't',
  boxes: [{ label: 'ぐう' }, { label: 'き' }],
  cards: [
    { label: '2', box: 0 },
    { label: '3', box: 1, wrongBoxes: [{ box: 0, misconception: 'mis-3' }] },
    { label: '4', box: 0 },
    { label: '5', box: 1 },
  ],
  ...over,
});

describe('judgeSort', () => {
  it('すべて正しい箱なら正解', () => {
    expect(judgeSort(item(), [0, 1, 0, 1])).toEqual({ result: 'correct' });
  });
  it('誤りのカードに印、入れがちな誤りの箱の誤概念', () => {
    expect(judgeSort(item(), [0, 0, 0, 0])).toEqual({
      result: 'wrong',
      misconception: 'mis-3',
      mark: [1, 3],
    });
    expect(judgeSort(item(), [1, 1, 0, 1])).toEqual({
      result: 'wrong',
      misconception: undefined,
      mark: [0],
    });
  });
  it('どちらの箱でも正しいカード', () => {
    const it2 = item({ cards: [...item().cards, { label: '9', box: [0, 1] }] });
    expect(judgeSort(it2, [0, 1, 0, 1, 0]).result).toBe('correct');
    expect(judgeSort(it2, [0, 1, 0, 1, 1]).result).toBe('correct');
  });
  it('入れていないカードがあると「もう一度」', () => {
    expect(judgeSort(item(), [0, 1, null, 1]).result).toBe('retry');
    expect(judgeSort(item(), []).result).toBe('retry');
  });
  it('2〜3歳: 箱ごとに1枚ずつ選んだ少ない枚数で判定', () => {
    expect(sortVisible(item(), 2)).toEqual([0, 1]);
    expect(sortVisible(item(), 3)).toEqual([0, 1, 2]);
    expect(judgeSort(item(), [0, 1, null, null]).result).toBe('correct');
    expect(judgeSort(item(), [null, null, 0, 1]).result).toBe('retry');
  });
});

describe('checkSort', () => {
  it('正しいデータは誤りなし', () => {
    expect(checkSort(item())).toEqual([]);
  });
  it('データの誤りを見つける', () => {
    expect(checkSort(item({ boxes: [{ label: 'a' }] })).join()).toMatch('箱が2つ未満');
    expect(
      checkSort(
        item({
          cards: [
            { label: '1', box: 2 },
            { label: '2', box: 0 },
          ],
        }),
      ).join(),
    ).toMatch('範囲外');
    expect(
      checkSort(
        item({
          cards: [
            { label: '1', box: 0, wrongBoxes: [{ box: 0, misconception: 'x' }] },
            { label: '2', box: 1 },
          ],
        }),
      ).join(),
    ).toMatch('正しい箱と同じ');
    expect(
      checkSort(
        item({
          cards: [
            { label: '1', box: 0 },
            { label: '1', box: 1 },
          ],
        }),
      ).join(),
    ).toMatch('別の箱');
    expect(
      checkSort(
        item({
          cards: [
            { label: '1', box: 0 },
            { label: '2', box: 0 },
          ],
        }),
      ).join(),
    ).toMatch('すべてのカードが同じ箱');
    expect(
      checkSort(
        item({
          cards: [
            { label: '1', box: [0, 1] },
            { label: '2', box: 0 },
          ],
        }),
      ).join(),
    ).toMatch('どの箱でも正解');
    expect(checkSort(item({ boxes: [{ label: '山' }, { label: 'b' }] })).join()).toMatch(
      'よみの無い漢字',
    );
  });
});

describe('見本', () => {
  it('checkSort と共通項目に誤りが無い', () => {
    for (const s of sortSamples) {
      expect(checkSort(s), s.id).toEqual([]);
      expect(
        baseItemErrors(
          s,
          s.cards.some((c) => c.figure),
        ),
        s.id,
      ).toEqual([]);
    }
  });
});

describe('画面', () => {
  const props = (ctx = ctxFor('g1')) => ({
    item: item(),
    ctx,
    revealed: false,
    wrongMark: null,
    disabled: false,
    submit: vi.fn(),
  });
  it('カード→箱 で入れ、箱の中のカードは戻せる', () => {
    const p = props();
    render(createElement(sortEngine.Component, p));
    const put = (c: number, b: number) => {
      fireEvent.click(screen.getByTestId(`card-${c}`));
      fireEvent.click(screen.getByTestId(`box-${b}`));
    };
    put(0, 0);
    put(1, 0);
    put(2, 0);
    put(3, 1);
    // カード1を戻して（えらんだ状態になる）箱1へ
    fireEvent.click(screen.getByTestId('card-1'));
    fireEvent.click(screen.getByTestId('box-1'));
    fireEvent.click(screen.getByTestId('check'));
    expect(p.submit).toHaveBeenCalledWith([0, 1, 0, 1]);
  });
  it('こたえあわせは下の帯の位置（band）。文の札は 5枚で2列・6枚以上で3列（札の列は作業領域の幅いっぱい）', () => {
    const long = (n: number): SortItem => ({
      ...item(),
      cards: Array.from({ length: n }, (_, i) => ({
        label: `とても ながい ぶんの カード ${i + 1}`,
        box: i % 2,
      })),
    });
    const poolOf = (n: number) => {
      const { container, unmount } = render(
        createElement(sortEngine.Component, { ...props(), item: long(n) }),
      );
      const pool = container.querySelector('.eng-sort__pool')!;
      const out = [...pool.classList];
      expect(container.querySelector('.tk-frame--band')).not.toBeNull();
      const check = screen.getByTestId('check');
      // unit.css の :has(.eng-check) が吹き出しの右端を避けるための印
      expect(check.classList.contains('tk-check--band')).toBe(true);
      expect(check.classList.contains('eng-check')).toBe(true);
      unmount();
      return out;
    };
    expect(poolOf(4)).not.toContain('eng-sort__pool--cols');
    expect(poolOf(5)).toContain('eng-sort__pool--cols');
    expect(poolOf(5)).not.toContain('eng-sort__pool--cols3');
    expect(poolOf(6)).toContain('eng-sort__pool--cols3');
  });
  it('解説（revealed）では、空の札置き場を出さない。問題の状態では、札を入れ終わっても高さを残す', () => {
    const p = props();
    const q = render(createElement(sortEngine.Component, p));
    expect(q.container.querySelector('.eng-sort__pool')).not.toBeNull();
    // 全部の札を箱に入れても、札置き場（高さの確保）は残る
    for (const [c, b] of [
      [0, 0],
      [1, 1],
      [2, 0],
      [3, 1],
    ] as const) {
      fireEvent.click(screen.getByTestId(`card-${c}`));
      fireEvent.click(screen.getByTestId(`box-${b}`));
    }
    expect(q.container.querySelector('.eng-sort__pool')).not.toBeNull();
    expect(q.container.querySelectorAll('.eng-sort__pool .tk-card')).toHaveLength(0);
    q.unmount();
    // 解説: 札は全部、正しい箱の中。札置き場は描かない
    const r = render(createElement(sortEngine.Component, { ...p, revealed: true }));
    expect(r.container.querySelector('.eng-sort__pool')).toBeNull();
    expect(r.container.querySelectorAll('.eng-sort__inside .tk-card')).toHaveLength(4);
  });
  it('2〜3歳: 少ない枚数で、入れ終わると自動で答える', () => {
    const p = props(ctxFor('toddler2'));
    render(createElement(sortEngine.Component, p));
    expect(screen.queryByTestId('card-2')).toBeNull();
    fireEvent.click(screen.getByTestId('card-0'));
    fireEvent.click(screen.getByTestId('box-0'));
    fireEvent.click(screen.getByTestId('card-1'));
    fireEvent.click(screen.getByTestId('box-1'));
    expect(p.submit).toHaveBeenCalledWith([0, 1, null, null]);
  });
});
