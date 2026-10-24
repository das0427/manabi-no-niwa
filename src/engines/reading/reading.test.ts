import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { audienceUx } from '../../audience/audience';
import type { RenderCtx } from '../types';
import {
  checkReading,
  judgeReading,
  locHas,
  passageSeq,
  readingEngine,
  type ReadingItem,
} from './reading';
import { READING_SAMPLES } from './reading.samples';

const item = (over: Partial<ReadingItem> = {}): ReadingItem => ({
  ...READING_SAMPLES[0]!,
  ...over,
});

describe('reading: 判定', () => {
  it('正解・誤概念', () => {
    expect(judgeReading(item(), [0])).toEqual({ result: 'correct' });
    expect(judgeReading(item(), [1])).toEqual({
      result: 'wrong',
      misconception: 'm-order-skip',
      mark: [1],
    });
  });
});

describe('reading: 検査', () => {
  it('見本は誤りなし', () => {
    for (const s of READING_SAMPLES) expect(checkReading(s), s.id).toEqual([]);
  });
  it('ヒント・根拠の場所が本文に無い', () => {
    expect(checkReading(item({ evidence: [{ p: 9 }] })).join()).toMatch(/段落 9 が無い/);
    expect(checkReading(item({ evidence: [{ p: 2, s: 5 }] })).join()).toMatch(/文 5 が無い/);
    expect(checkReading(item({ hintFocus: [[{ p: 0 }]] })).join()).toMatch(/ヒント1/);
    expect(checkReading(item({ hintFocus: [null, null, null, null] })).join()).toMatch(
      /ヒントの数より多い/,
    );
  });
  it('本文・選択肢のよみの無い漢字、空の本文', () => {
    const p = { ...item().passage, paragraphs: [['山に のぼる']] };
    expect(checkReading(item({ passage: p, evidence: [], hintFocus: [] })).join()).toMatch(
      /本文: よみの無い漢字「山」/,
    );
    expect(
      checkReading(item({ options: [{ label: '川', correct: true }, { label: 'たね' }] })).join(),
    ).toMatch(/選択肢: よみの無い漢字「川」/);
    const empty = { ...item().passage, paragraphs: [] };
    expect(checkReading(item({ passage: empty, evidence: [], hintFocus: [] }))).toContain(
      '本文が無い',
    );
  });
});

describe('reading: 場所', () => {
  it('段落全体と文', () => {
    expect(locHas([{ p: 2 }], 2, 3)).toBe(true);
    expect(locHas([{ p: 2, s: 1 }], 2, 1)).toBe(true);
    expect(locHas([{ p: 2, s: 1 }], 2, 2)).toBe(false);
    expect(locHas(null, 1, 1)).toBe(false);
  });
  it('本文の読み上げの列: 題のあと・段落の間に無音', () => {
    const seq = passageSeq(item().passage, 'pk') as (string | number)[];
    expect(seq.filter((x) => typeof x === 'number')).toEqual([500, 400, 400]);
  });
});

describe('reading: 画面', () => {
  afterEach(cleanup);
  const ctx = (over: Partial<RenderCtx> = {}): RenderCtx => ({
    packId: 'pk',
    readAloud: 'button',
    furigana: 'unlearned',
    learnerGrade: 2,
    preschool: false,
    textScale: 1,
    ux: audienceUx('g2'),
    ...over,
  });
  const props = (over: Record<string, unknown> = {}) => ({
    item: item(),
    ctx: ctx(),
    revealed: false,
    wrongMark: null,
    disabled: false,
    submit: () => undefined,
    ...over,
  });
  it('ヒントの場所を囲み、正答を見せるときは根拠に印', () => {
    const { rerender } = render(createElement(readingEngine.Component, props()));
    expect(screen.getByTestId('s-2-1').dataset.mark).toBeUndefined();
    rerender(createElement(readingEngine.Component, props({ hintsShown: 1 })));
    expect(screen.getByTestId('s-2-1').dataset.mark).toBe('focus');
    expect(screen.getByTestId('s-2-2').dataset.mark).toBe('focus');
    rerender(createElement(readingEngine.Component, props({ hintsShown: 2 })));
    expect(screen.getByTestId('s-2-2').dataset.mark).toBeUndefined();
    rerender(createElement(readingEngine.Component, props({ revealed: true, disabled: true })));
    expect(screen.getByTestId('s-2-1').dataset.mark).toBe('evidence');
  });
  it('読み上げの設定が off のときは本文を聞く札を出さない', () => {
    render(createElement(readingEngine.Component, props({ ctx: ctx({ readAloud: 'off' }) })));
    expect(screen.queryByTestId('read-passage')).toBeNull();
  });
});
