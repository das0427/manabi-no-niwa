import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseItemErrors, ctxFor } from '../order/testkit';
import { answerTextOfFill, checkFill, fillEngine, judgeFill, type FillItem } from './fill';
import { fillSamples } from './fill.samples';

afterEach(cleanup);

const item = (over: Partial<FillItem> = {}): FillItem => ({
  engine: 'fill',
  id: 't',
  objective: 'o',
  level: 0,
  prompt: 'いれよう',
  hints: ['a', 'b', 'c'],
  explain: 'e',
  identity: 't',
  text: 'ぼく{{}} がっこう{{}} いく。',
  options: ['は', 'わ', 'へ', 'え'],
  blanks: [
    { answers: ['は'], wrong: [{ value: 'わ', misconception: 'ha-wa' }] },
    { answers: ['へ'], wrong: [{ value: 'え', misconception: 'he-e' }] },
  ],
  ...over,
});

describe('judgeFill', () => {
  it('空欄ごとに正しければ正解', () => {
    expect(judgeFill(item(), ['は', 'へ'])).toEqual({ result: 'correct' });
  });
  it('誤りの空欄に印、誤概念', () => {
    expect(judgeFill(item(), ['は', 'え'])).toEqual({
      result: 'wrong',
      misconception: 'he-e',
      mark: [1],
    });
    expect(judgeFill(item(), ['へ', 'は'])).toEqual({
      result: 'wrong',
      misconception: undefined,
      mark: [0, 1],
    });
  });
  it('表記ゆれ（ふりがな・全角半角・空白）を同じとみなす', () => {
    const it2 = item({
      text: '{{}}を たべる。{{}}こ',
      options: ['ご飯《はん》', 'パン', '５', '6'],
      blanks: [{ answers: ['ご飯《はん》', 'ごはん'] }, { answers: ['5'] }],
    });
    expect(judgeFill(it2, ['ご飯', '５']).result).toBe('correct');
    expect(judgeFill(it2, ['ごはん', ' 5 ']).result).toBe('correct');
  });
  it('空いている空欄があると「もう一度」', () => {
    expect(judgeFill(item(), ['は', null]).result).toBe('retry');
    expect(judgeFill(item(), ['は']).result).toBe('retry');
  });
});

describe('checkFill', () => {
  it('正しいデータは誤りなし', () => {
    expect(checkFill(item())).toEqual([]);
  });
  it('データの誤りを見つける', () => {
    expect(checkFill(item({ text: 'ぼく{{}} いく。' })).join()).toMatch('空欄の数');
    expect(checkFill(item({ blanks: [{ answers: ['を'] }, { answers: ['へ'] }] })).join()).toMatch(
      '正解が選択肢の中に無い',
    );
    expect(
      checkFill(
        item({
          blanks: [
            { answers: ['は'], wrong: [{ value: 'は', misconception: 'x' }] },
            { answers: ['へ'] },
          ],
        }),
      ).join(),
    ).toMatch('正解と同じ');
    expect(
      checkFill(item({ blanks: [{ answers: ['は', 'わ'] }, { answers: ['へ'] }] })).join(),
    ).toMatch('正解が2つ以上');
    expect(checkFill(item({ options: ['は', 'は', 'へ'] })).join()).toMatch('重複');
    expect(
      checkFill(item({ useOnce: true, blanks: [{ answers: ['は'] }, { answers: ['は'] }] })).join(),
    ).toMatch('1回だけ');
    expect(checkFill(item({ text: '山{{}} {{}}' })).join()).toMatch('よみの無い漢字');
    expect(checkFill(item({ text: '**ぼく{{}}** がっこう{{}}' })).join()).toMatch('強調');
  });
  it('解説用の正答の文', () => {
    expect(answerTextOfFill(item())).toBe('ぼく**は** がっこう**へ** いく。');
  });
});

describe('見本', () => {
  it('checkFill と共通項目に誤りが無い', () => {
    for (const s of fillSamples) {
      expect(checkFill(s), s.id).toEqual([]);
      expect(baseItemErrors(s, false), s.id).toEqual([]);
    }
  });
});

describe('画面', () => {
  const props = (it2 = item()) => ({
    item: it2,
    ctx: ctxFor('g1'),
    revealed: false,
    wrongMark: null,
    disabled: false,
    submit: vi.fn(),
  });
  it('選択肢をタップすると えらんでいる空欄に入り、次の空欄へ進む', () => {
    const p = props();
    render(createElement(fillEngine.Component, p));
    fireEvent.click(screen.getByTestId('opt-1')); // わ → 空欄0
    fireEvent.click(screen.getByTestId('opt-3')); // え → 空欄1
    fireEvent.click(screen.getByTestId('blank-0'));
    fireEvent.click(screen.getByTestId('opt-0')); // は → 空欄0
    fireEvent.click(screen.getByTestId('blank-1'));
    fireEvent.click(screen.getByTestId('blank-1')); // えらんでいる空欄をもう一度で外す
    expect((screen.getByTestId('check') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('opt-2')); // へ → 空欄1
    fireEvent.click(screen.getByTestId('check'));
    expect(p.submit).toHaveBeenCalledWith(['は', 'へ']);
  });
  it('1回だけ使う選択肢は、ほかの空欄で使うと押せない', () => {
    const p = props(fillSamples[2]!);
    render(createElement(fillEngine.Component, p));
    fireEvent.click(screen.getByTestId('opt-0'));
    expect((screen.getByTestId('opt-0') as HTMLButtonElement).disabled).toBe(true);
  });
  it('revealed のときは正答を見せる', () => {
    render(createElement(fillEngine.Component, { ...props(), revealed: true }));
    expect(screen.getByTestId('blank-0').textContent).toContain('は');
    expect(screen.getByTestId('blank-1').textContent).toContain('へ');
  });
});
