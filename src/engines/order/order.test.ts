import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkOrder,
  judgeOrder,
  orderEngine,
  orderVisible,
  poolOrder,
  type OrderItem,
} from './order';
import { orderSamples } from './order.samples';
import { baseItemErrors, ctxFor } from './testkit';
import { spreadPick } from './shared';
import { audio } from '../../core/audio/index';

vi.mock('../../core/audio/index', () => ({
  audio: { play: vi.fn(() => Promise.resolve('done')) },
}));

afterEach(cleanup);

describe('読み上げ（文字が読めない区分）', () => {
  it('絵のカードを押すと名前を読む。読み上げ off・小学生では読まない', () => {
    const play = vi.mocked(audio.play);
    const egg = orderSamples[1]!;
    const run = (ctx: ReturnType<typeof ctxFor>) => {
      render(
        createElement(orderEngine.Component, {
          item: egg,
          ctx,
          revealed: false,
          wrongMark: null,
          disabled: false,
          submit: vi.fn(),
        }),
      );
      fireEvent.click(screen.getByTestId('card-0'));
      cleanup();
    };
    play.mockClear();
    run({ ...ctxFor('p4'), readAloud: 'always' });
    expect(play).toHaveBeenCalledTimes(1);
    play.mockClear();
    run(ctxFor('p4'));
    run({ ...ctxFor('g1'), readAloud: 'always' });
    expect(play).not.toHaveBeenCalled();
  });
});

const base = {
  engine: 'order' as const,
  id: 't',
  objective: 'o',
  level: 0,
  prompt: 'ならべよう',
  hints: ['a', 'b', 'c'],
  explain: 'e',
  identity: 't',
};
const item = (over: Partial<OrderItem> = {}): OrderItem => ({
  ...base,
  cards: [{ label: '1' }, { label: '2' }, { label: '3' }, { label: '4' }],
  ...over,
});

describe('judgeOrder', () => {
  it('正しい順は正解', () => {
    expect(judgeOrder(item(), [0, 1, 2, 3])).toEqual({ result: 'correct' });
  });
  it('alsoAccept の順も正解', () => {
    const it2 = item({ alsoAccept: [[1, 0, 2, 3]] });
    expect(judgeOrder(it2, [1, 0, 2, 3]).result).toBe('correct');
    expect(judgeOrder(it2, [0, 1, 3, 2]).result).toBe('wrong');
  });
  it('同じ見た目のカードは入れ替えても正解', () => {
    const it2 = item({ cards: [{ label: '1' }, { label: '3' }, { label: '3' }, { label: '5' }] });
    expect(judgeOrder(it2, [0, 2, 1, 3]).result).toBe('correct');
  });
  it('誤りは合っていない位置に印', () => {
    expect(judgeOrder(item(), [0, 2, 1, 3])).toEqual({
      result: 'wrong',
      misconception: undefined,
      mark: [1, 2],
    });
  });
  it('印は一番近い正しい順と比べる', () => {
    const j = judgeOrder(item({ alsoAccept: [[3, 2, 1, 0]] }), [3, 2, 0, 1]);
    expect(j).toMatchObject({ result: 'wrong', mark: [2, 3] });
  });
  it('逆順の誤概念・誤りの順の誤概念', () => {
    expect(judgeOrder(item({ reverseMisconception: 'rev' }), [3, 2, 1, 0])).toMatchObject({
      result: 'wrong',
      misconception: 'rev',
    });
    const it2 = item({ wrongOrders: [{ order: [1, 0, 2, 3], misconception: 'swap' }] });
    expect(judgeOrder(it2, [1, 0, 2, 3])).toMatchObject({ misconception: 'swap' });
    expect(judgeOrder(it2, [0, 1, 3, 2])).toMatchObject({ misconception: undefined });
  });
  it('並べ終わっていない・重複は「もう一度」', () => {
    expect(judgeOrder(item(), [0, 1, 2]).result).toBe('retry');
    expect(judgeOrder(item(), [0, 1, 1, 3]).result).toBe('retry');
    expect(judgeOrder(item(), []).result).toBe('retry');
  });
  it('2〜3歳の少ない枚数（はじめと おわりを含む組）だけを判定する', () => {
    expect(orderVisible(item(), 2)).toEqual([0, 3]);
    expect(judgeOrder(item(), [0, 3]).result).toBe('correct');
    expect(judgeOrder(item(), [3, 0]).result).toBe('wrong');
    // 決まった組でない2枚は「もう一度」
    expect(judgeOrder(item(), [0, 1]).result).toBe('retry');
    expect(spreadPick(5, 3)).toEqual([0, 2, 4]);
  });
});

describe('checkOrder', () => {
  it('正しいデータは誤りなし', () => {
    expect(checkOrder(item({ ends: ['ちいさい', 'おおきい'] }))).toEqual([]);
  });
  it('データの誤りを見つける', () => {
    expect(checkOrder(item({ cards: [{ label: '1' }] }))).toContain('並べるものが2つ未満');
    expect(checkOrder(item({ cards: [{ label: 'a' }, { label: 'a' }] }))).toContain(
      'すべて同じカードで、順が決まらない',
    );
    expect(checkOrder(item({ alsoAccept: [[0, 1, 2]] })).join()).toMatch('並べ替えでない');
    expect(checkOrder(item({ alsoAccept: [[0, 1, 2, 3]] })).join()).toMatch('ほかの正しい順と同じ');
    expect(
      checkOrder(item({ wrongOrders: [{ order: [0, 1, 2, 3], misconception: 'x' }] })).join(),
    ).toMatch('正しい順と同じ');
    expect(
      checkOrder(item({ alsoAccept: [[3, 2, 1, 0]], reverseMisconception: 'r' })).join(),
    ).toMatch('逆の順も正しい');
    expect(checkOrder(item({ initial: [0, 1, 2, 3] })).join()).toMatch('initial');
    expect(checkOrder(item({ cards: [{ label: '山' }, { label: 'b' }] })).join()).toMatch(
      'よみの無い漢字「山」',
    );
    expect(checkOrder(item({ cards: [{}, { label: 'b' }] })).join()).toMatch('文も図も無い');
    expect(
      checkOrder(
        item({ layout: 'column', cards: ['a', 'b', 'c', 'd', 'e'].map((l) => ({ label: l })) }),
      ).join(),
    ).toMatch('4つまで');
  });
});

describe('poolOrder', () => {
  it('最初の並びが正しい順にならない', () => {
    for (let s = 0; s < 50; s++) {
      const it2 = item({ id: `p${s}` });
      expect(poolOrder(it2, [0, 1, 2, 3])).not.toEqual([0, 1, 2, 3]);
      expect(poolOrder(it2, [0, 3])).not.toEqual([0, 3]);
    }
  });
});

describe('見本', () => {
  it('checkOrder と共通項目に誤りが無い', () => {
    for (const s of orderSamples) {
      expect(checkOrder(s), s.id).toEqual([]);
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
  const props = (it2: OrderItem, ctx = ctxFor('g1')) => ({
    item: it2,
    ctx,
    revealed: false,
    wrongMark: null,
    disabled: false,
    submit: vi.fn(),
  });
  it('タップした順に並び、外せて、こたえあわせで答える', () => {
    const p = props(item());
    render(createElement(orderEngine.Component, p));
    const check = screen.getByTestId('check') as HTMLButtonElement;
    expect(check.disabled).toBe(true);
    for (const c of [0, 2, 1]) fireEvent.click(screen.getByTestId(`card-${c}`));
    fireEvent.click(screen.getByTestId('slot-1')); // 2番目に置いた（カード2）を外す
    fireEvent.click(screen.getByTestId('card-2')); // 空いた所（2番目）に入る
    fireEvent.click(screen.getByTestId('card-3'));
    expect(check.disabled).toBe(false);
    fireEvent.click(check);
    expect(p.submit).toHaveBeenCalledWith([0, 2, 1, 3]);
  });
  it('2〜3歳: 少ない枚数で、置き終わると自動で答える', () => {
    const p = props(item(), ctxFor('toddler2'));
    render(createElement(orderEngine.Component, p));
    expect(screen.queryByTestId('check')).toBeNull();
    expect(screen.queryByTestId('card-1')).toBeNull();
    fireEvent.click(screen.getByTestId('card-0'));
    fireEvent.click(screen.getByTestId('card-3'));
    expect(p.submit).toHaveBeenCalledWith([0, 3]);
  });
  it('disabled のときは置けない', () => {
    const p = { ...props(item()), disabled: true };
    render(createElement(orderEngine.Component, p));
    fireEvent.click(screen.getByTestId('card-0'));
    expect(screen.getByTestId('slot-0').tagName).toBe('SPAN');
  });
});
