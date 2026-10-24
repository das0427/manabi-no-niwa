import { act, cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { audienceUx } from '../../audience/audience';
import type { RenderCtx } from '../types';
import { simplify } from './DrawPad';
import {
  checkExplain,
  explainEngine,
  judgeExplain,
  NEED_DRAWING,
  NEED_REASON,
  type ExplainItem,
} from './explain';
import { EXPLAIN_SAMPLES } from './explain.samples';

const item = (over: Partial<ExplainItem> = {}): ExplainItem => ({
  id: 't',
  engine: 'explain',
  objective: 'o',
  level: 0,
  prompt: 'かいてみよう',
  canvas: {},
  hints: ['a', 'b'],
  explain: 'e',
  identity: 'k',
  ...over,
});
const line = { c: 'ink' as const, p: [[10, 10] as [number, number]] };

describe('explain: 判定（採点しない。答えは常に できた）', () => {
  it('描いていれば正解', () => {
    expect(judgeExplain(item(), { lines: [line], aspect: 1, reasons: [] })).toEqual({
      result: 'correct',
    });
  });
  it('何も描かずに できた → 誤答にせず「もう一度」', () => {
    expect(judgeExplain(item(), { lines: [], aspect: 1, reasons: [] })).toEqual({
      result: 'retry',
      message: NEED_DRAWING,
    });
  });
  it('理由を求める問題で理由を選んでいない → もう一度。選べばどれでも正解', () => {
    const it2 = item({
      reasons: [{ label: 'あ' }, { label: 'い' }],
      require: { reason: true, drawing: false },
    });
    expect(judgeExplain(it2, { lines: [], aspect: 1, reasons: [] })).toEqual({
      result: 'retry',
      message: NEED_REASON,
    });
    expect(judgeExplain(it2, { lines: [], aspect: 1, reasons: [1] }).result).toBe('correct');
    expect(judgeExplain(it2, { lines: [], aspect: 1, reasons: [0, 1] }).result).toBe('correct');
  });
  it('求めない指定なら空でも正解', () => {
    expect(
      judgeExplain(item({ require: { drawing: false } }), { lines: [], aspect: 1, reasons: [] })
        .result,
    ).toBe('correct');
  });
});

describe('explain: 検査', () => {
  it('見本は誤りなし', () => {
    for (const s of EXPLAIN_SAMPLES) expect(checkExplain(s), s.id).toEqual([]);
  });
  it('盤も理由もない・理由が1つ・重複・よみの無い漢字・aspect', () => {
    expect(checkExplain(item({ canvas: undefined }))).toContain('描く盤も理由の選択肢も無い');
    expect(checkExplain(item({ reasons: [{ label: 'あ' }] }))).toContain('理由の選択肢が2つ未満');
    expect(checkExplain(item({ reasons: [{ label: 'あ' }, { label: 'あ' }] }))).toContain(
      '同じ理由が重複している',
    );
    expect(checkExplain(item({ reasons: [{ label: '雨' }, { label: 'あ' }] })).join()).toMatch(
      /よみの無い漢字「雨」/,
    );
    expect(checkExplain(item({ canvas: { aspect: 9 } })).join()).toMatch(/aspect/);
    expect(
      checkExplain(
        item({
          canvas: undefined,
          reasons: [{ label: 'あ' }, { label: 'い' }],
          require: { drawing: true },
        }),
      ).join(),
    ).toMatch(/盤が無い/);
  });
});

describe('explain: 盤のデータ', () => {
  it('線を整数にして近すぎる点を間引き、範囲に収める', () => {
    expect(
      simplify(
        [
          [10.4, 10.6],
          [11, 11],
          [2000, -5],
        ],
        750,
      ),
    ).toEqual([
      [10, 11],
      [1000, 0],
    ]);
  });
});

describe('explain: 画面', () => {
  afterEach(cleanup);
  const ctx: RenderCtx = {
    packId: 'pk',
    readAloud: 'always',
    furigana: 'unlearned',
    learnerGrade: 1,
    preschool: false,
    textScale: 1,
    ux: audienceUx('g1'),
  };
  it('理由を選ぶまで できた は押せない。押すと選んだ理由を返す', () => {
    const submit = vi.fn();
    render(
      createElement(explainEngine.Component, {
        item: EXPLAIN_SAMPLES[1]!,
        ctx,
        revealed: false,
        wrongMark: null,
        disabled: false,
        submit,
      }),
    );
    const done = screen.getByTestId('done-button') as HTMLButtonElement;
    expect(done.disabled).toBe(true);
    act(() => screen.getByTestId('reason-2').click());
    act(() => screen.getByTestId('reason-0').click());
    expect(done.disabled).toBe(false);
    act(() => done.click());
    expect(submit).toHaveBeenCalledWith({ lines: [], aspect: 4 / 3, reasons: [2, 0] });
  });
});
