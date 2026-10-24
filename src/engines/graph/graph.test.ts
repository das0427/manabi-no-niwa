import { describe, expect, it } from 'vitest';
import { checkGraph, graphAnswerText, judgeGraph, type GraphItem } from './graph';
import { graphSamples } from './graph.samples';

const base = {
  id: 't',
  objective: 'o',
  level: 0,
  prompt: 'p',
  hints: ['a', 'b', 'c'],
  explain: 'e',
  identity: 'k',
};
const bar = (over: Partial<GraphItem> = {}): GraphItem => ({
  ...base,
  engine: 'graph',
  data: { kind: 'bar', labels: ['a', 'b', 'c'], values: [8, 6, 4], scaleStep: 2, max: 12 },
  task: { kind: 'make' },
  misconceptions: { scaleAsOne: 'one' },
  ...over,
});

describe('make（作る）', () => {
  it('値がすべて一致で正答・違う列に印', () => {
    expect(judgeGraph(bar(), { values: [8, 6, 4] }).result).toBe('correct');
    expect(judgeGraph(bar(), { values: [8, 8, 4] })).toMatchObject({ result: 'wrong', mark: [1] });
  });
  it('1目盛りを1とみた誤り（4・3・2 や 16・12・8）', () => {
    expect(judgeGraph(bar(), { values: [4, 3, 2] })).toMatchObject({ misconception: 'one' });
    expect(
      judgeGraph(bar({ data: { ...bar().data, max: 20 } }), { values: [16, 12, 8] }),
    ).toMatchObject({
      misconception: 'one',
    });
    expect(judgeGraph(bar(), { values: [4, 6, 2] })).toMatchObject({
      misconception: 'one',
      mark: [0, 2],
    });
  });
  it('折れ線: 点を打っていない所があると もう一度', () => {
    const it1 = bar({
      data: { kind: 'line', labels: ['1', '2'], values: [10, 15], scaleStep: 5, max: 20 },
    });
    expect(judgeGraph(it1, { values: [10, null] }).result).toBe('retry');
    expect(judgeGraph(it1, { values: [10, 15] }).result).toBe('correct');
  });
  it('小数の目盛りでも浮動小数点の誤差で誤答にしない', () => {
    const it1 = bar({
      data: { kind: 'line', labels: ['1', '2'], values: [0.3, 0.7], scaleStep: 0.1, max: 1 },
    });
    expect(checkGraph(it1)).toEqual([]);
    expect(judgeGraph(it1, { values: [0.1 + 0.2, 0.7] }).result).toBe('correct');
  });
});

describe('read（読む）', () => {
  it('number: 表記ゆれと誤答の例', () => {
    const it1 = bar({
      task: {
        kind: 'number',
        fields: [{ answer: { kind: 'int', value: 25 } }],
        wrongAnswers: [{ value: '5', misconception: 'w' }],
      },
    });
    expect(judgeGraph(it1, { fields: ['２５'] }).result).toBe('correct');
    expect(judgeGraph(it1, { fields: ['5'] })).toMatchObject({ misconception: 'w' });
    expect(judgeGraph(it1, { fields: ['x'] }).result).toBe('retry');
    expect(graphAnswerText(it1)).toBe('25');
  });
  it('choice: 1つ・すべて', () => {
    const it1 = bar({
      task: {
        kind: 'choice',
        options: [
          { label: 'a', correct: true },
          { label: 'b', misconception: 'm' },
        ],
      },
    });
    expect(judgeGraph(it1, { pick: [0] }).result).toBe('correct');
    expect(judgeGraph(it1, { pick: [1] })).toMatchObject({ misconception: 'm', mark: [1] });
    const it2 = bar({
      task: {
        kind: 'choice',
        multi: true,
        options: [{ label: 'a', correct: true }, { label: 'b', correct: true }, { label: 'c' }],
      },
    });
    expect(judgeGraph(it2, { pick: [1, 0] }).result).toBe('correct');
    expect(judgeGraph(it2, { pick: [0] }).result).toBe('wrong');
  });
});

describe('check', () => {
  it('問題データの誤り', () => {
    expect(
      checkGraph(bar({ data: { kind: 'bar', labels: ['a'], values: [1, 2], max: 4 } })).join(),
    ).toMatch('数が違う');
    expect(
      checkGraph(bar({ data: { kind: 'pie', labels: ['a', 'b'], values: [50, 40] } })).join(),
    ).toMatch('100');
    expect(
      checkGraph(
        bar({ data: { kind: 'bar', labels: ['a'], values: [7], scaleStep: 2, max: 12 } }),
      ).join(),
    ).toMatch('snap');
    expect(
      checkGraph(bar({ data: { kind: 'bar', labels: ['a'], values: [8], scaleStep: 2 } })).join(),
    ).toMatch('max');
    expect(checkGraph(bar({ task: { kind: 'make', initial: [8, 6, 4] } })).join()).toMatch(
      'はじめから',
    );
    expect(
      checkGraph(
        bar({ data: { kind: 'bar', labels: ['a'], values: [80], scaleStep: 1, max: 100 } }),
      ).join(),
    ).toMatch('多すぎる');
    expect(
      checkGraph(
        bar({ task: { kind: 'choice', options: [{ label: 'a', correct: true }, { label: 'a' }] } }),
      ).join(),
    ).toMatch('重複');
  });
  it('2本の折れ線（series2）の検査', () => {
    const line2 = (over: Partial<GraphItem['data']>, task?: GraphItem['task']) =>
      checkGraph(
        bar({
          data: {
            kind: 'line',
            labels: ['a', 'b'],
            values: [10, 15],
            scaleStep: 5,
            max: 20,
            name: 'x',
            series2: { name: 'y', values: [5, 10] },
            ...over,
          },
          task: task ?? { kind: 'number', fields: [{ answer: { kind: 'int', value: 5 } }] },
        }),
      ).join();
    expect(line2({})).toBe('');
    expect(line2({ name: undefined })).toMatch('name');
    expect(line2({ series2: { name: 'x', values: [5, 10] } })).toMatch('同じ');
    expect(line2({ series2: { name: 'y', values: [5] } })).toMatch('2本目の値の数');
    expect(line2({ series2: { name: 'y', values: [5, 25] } })).toMatch('範囲の外');
    expect(line2({ kind: 'bar' })).toMatch('折れ線');
    expect(line2({}, { kind: 'make' })).toMatch('作る問題');
  });
  it('欄の後ろの単位: 正答の文に付け、quantity の単位と重ねない', () => {
    const it1 = bar({
      task: {
        kind: 'number',
        fields: [{ label: 'あ', answer: { kind: 'quantity', value: 25, unit: '%' }, unit: '%' }],
      },
    });
    expect(graphAnswerText(it1)).toBe('あ 25 %');
    expect(judgeGraph(it1, { fields: ['25'] }).result).toBe('correct');
  });
  it('見本の問題に誤りが無い', () => {
    for (const s of graphSamples) expect(checkGraph(s), s.id).toEqual([]);
  });
});
