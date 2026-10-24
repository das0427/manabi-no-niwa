import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseItemErrors, ctxFor } from '../order/testkit';
import { checkMatch, judgeMatch, matchEngine, rightOrder, type MatchItem } from './match';
import { matchSamples } from './match.samples';

afterEach(cleanup);

const item = (over: Partial<MatchItem> = {}): MatchItem => ({
  engine: 'match',
  id: 't',
  objective: 'o',
  level: 0,
  prompt: 'むすぼう',
  hints: ['a', 'b', 'c'],
  explain: 'e',
  identity: 't',
  left: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
  right: [{ label: 'c' }, { label: 'a' }, { label: 'b' }, { label: 'd' }],
  pairs: [
    [0, 1],
    [1, 2],
    [2, 0],
  ],
  wrongPairs: [{ pair: [1, 3], misconception: 'mis-bd' }],
  ...over,
});

describe('judgeMatch', () => {
  it('組の集合が一致すれば正解（順不同）', () => {
    expect(
      judgeMatch(item(), [
        [2, 0],
        [0, 1],
        [1, 2],
      ]),
    ).toEqual({ result: 'correct' });
  });
  it('誤りの組の左に印、誤概念', () => {
    expect(
      judgeMatch(item(), [
        [0, 1],
        [1, 3],
        [2, 2],
      ]),
    ).toEqual({ result: 'wrong', misconception: 'mis-bd', mark: [1, 2] });
  });
  it('むすんでいない左・同じ右を2回は「もう一度」', () => {
    expect(
      judgeMatch(item(), [
        [0, 1],
        [1, 2],
      ]).result,
    ).toBe('retry');
    expect(
      judgeMatch(item(), [
        [0, 1],
        [1, 1],
        [2, 0],
      ]).result,
    ).toBe('retry');
  });
  it('2〜3歳: 少ない組（はじめと おわり）で判定', () => {
    expect(
      judgeMatch(item(), [
        [0, 1],
        [2, 0],
      ]).result,
    ).toBe('correct');
    expect(
      judgeMatch(item(), [
        [0, 1],
        [1, 2],
      ]).result,
    ).toBe('retry');
  });
});

describe('checkMatch', () => {
  it('正しいデータは誤りなし', () => {
    expect(checkMatch(item())).toEqual([]);
  });
  it('データの誤りを見つける', () => {
    expect(
      checkMatch(
        item({
          pairs: [
            [0, 1],
            [1, 2],
          ],
        }),
      ).join(),
    ).toMatch('上の段の3に正しい組が無い');
    expect(
      checkMatch(
        item({
          pairs: [
            [0, 1],
            [1, 1],
            [2, 0],
          ],
        }),
      ).join(),
    ).toMatch('2つの組');
    expect(
      checkMatch(
        item({
          pairs: [
            [0, 9],
            [1, 2],
            [2, 0],
          ],
        }),
      ).join(),
    ).toMatch('範囲外');
    expect(checkMatch(item({ wrongPairs: [{ pair: [0, 1], misconception: 'x' }] })).join()).toMatch(
      '正しい組と同じ',
    );
    expect(checkMatch(item({ right: [{ label: 'c' }, { label: 'a' }] })).join()).toMatch('少ない');
    expect(
      checkMatch(item({ right: [{ label: 'a' }, { label: 'a' }, { label: 'b' }] })).join(),
    ).toMatch('重複');
  });
});

describe('rightOrder', () => {
  it('下の段が上の段とそのまま縦にそろわない', () => {
    for (let s = 0; s < 50; s++) {
      const it2 = item({
        id: `r${s}`,
        right: [{ label: 'a' }, { label: 'b' }, { label: 'c' }],
        pairs: [
          [0, 0],
          [1, 1],
          [2, 2],
        ],
        wrongPairs: [],
      });
      expect(rightOrder(it2, [0, 1, 2], [0, 1, 2])).not.toEqual([0, 1, 2]);
    }
  });
});

describe('見本', () => {
  it('checkMatch と共通項目に誤りが無い', () => {
    for (const s of matchSamples) {
      expect(checkMatch(s), s.id).toEqual([]);
      expect(
        baseItemErrors(
          s,
          s.left.some((c) => c.figure),
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
  it('上→下、下→上 のどちらでもむすべて、むすび直せる', () => {
    const p = props();
    render(createElement(matchEngine.Component, p));
    fireEvent.click(screen.getByTestId('left-0'));
    fireEvent.click(screen.getByTestId('right-1'));
    fireEvent.click(screen.getByTestId('right-3'));
    fireEvent.click(screen.getByTestId('left-1'));
    fireEvent.click(screen.getByTestId('left-2'));
    fireEvent.click(screen.getByTestId('right-0'));
    // 1-3 を外して 1-2 にむすび直す
    fireEvent.click(screen.getByTestId('left-1'));
    fireEvent.click(screen.getByTestId('right-2'));
    fireEvent.click(screen.getByTestId('check'));
    expect(p.submit).toHaveBeenCalledWith([
      [0, 1],
      [1, 2],
      [2, 0],
    ]);
  });
  it('2〜3歳: 少ない組で、組み終わると自動で答える', () => {
    const p = props(ctxFor('toddler3'));
    // toddler3 の上限は3組。2組の問題で試す
    render(
      createElement(matchEngine.Component, {
        ...p,
        item: item({
          left: [{ label: 'A' }, { label: 'B' }],
          pairs: [
            [0, 1],
            [1, 2],
          ],
          wrongPairs: [],
        }),
      }),
    );
    expect(screen.queryByTestId('right-3')).toBeNull();
    fireEvent.click(screen.getByTestId('left-0'));
    fireEvent.click(screen.getByTestId('right-1'));
    fireEvent.click(screen.getByTestId('left-1'));
    fireEvent.click(screen.getByTestId('right-2'));
    expect(p.submit).toHaveBeenCalledWith([
      [0, 1],
      [1, 2],
    ]);
  });
});
