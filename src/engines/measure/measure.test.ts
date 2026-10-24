import { describe, expect, it } from 'vitest';
import { checkMeasure, judgeMeasure, measureAnswerText, type MeasureItem } from './measure';
import { measureSamples } from './measure.samples';

const base = {
  id: 't',
  objective: 'o',
  level: 0,
  prompt: 'p',
  hints: ['a', 'b', 'c'],
  explain: 'e',
  identity: 'k',
};
const ruler = (over: Partial<MeasureItem> = {}): MeasureItem => ({
  ...base,
  engine: 'measure',
  instrument: 'ruler',
  scale: { unit: 'mm', max: 120, minor: 1, mid: 5, major: 10, labelFactor: 10, labelUnit: 'cm' },
  task: 'read',
  value: 35,
  fields: [
    { unit: 'cm', factor: 10 },
    { unit: 'mm', factor: 1 },
  ],
  misconceptions: { fromEnd: 'end', fieldSwap: 'swap', minorAsOne: 'one' },
  ...over,
});

describe('read（□cm□mm）', () => {
  it('正答・全角・欄の分け方の違いは もう一度', () => {
    expect(judgeMeasure(ruler(), { fields: ['3', '5'] }).result).toBe('correct');
    expect(judgeMeasure(ruler(), { fields: ['３', '５'] }).result).toBe('correct');
    expect(judgeMeasure(ruler(), { fields: ['2', '15'] }).result).toBe('retry');
    expect(judgeMeasure(ruler(), { fields: ['3', ''] }).result).toBe('retry');
    expect(judgeMeasure(ruler(), { fields: ['3', '1/2'] }).result).toBe('retry');
  });
  it('誤概念: 欄の取り違え・右はしを読む', () => {
    expect(judgeMeasure(ruler(), { fields: ['5', '3'] })).toMatchObject({ misconception: 'swap' });
    const it1 = ruler({ from: 20 });
    expect(checkMeasure(it1)).toEqual([]);
    expect(judgeMeasure(it1, { fields: ['5', '5'] })).toMatchObject({ misconception: 'end' });
    expect(judgeMeasure(it1, { fields: ['3', '5'] }).result).toBe('correct');
  });
  it('1つの欄で小数（cm）・単位の換算', () => {
    const it1 = ruler({ fields: [{ unit: 'cm', factor: 10 }], keys: ['decimal'] });
    expect(checkMeasure(it1)).toEqual([]);
    expect(judgeMeasure(it1, { fields: ['3.5'] }).result).toBe('correct');
    expect(judgeMeasure(it1, { fields: ['3.50'] }).result).toBe('correct');
    expect(judgeMeasure(it1, { fields: ['35'] }).result).toBe('wrong');
    expect(measureAnswerText(it1)).toBe('3.5cm');
    expect(measureAnswerText(ruler())).toBe('3cm5mm');
    expect(measureAnswerText(ruler({ value: 30 }))).toBe('3cm');
  });
  it('はかり: 1目盛りを1とみた誤り', () => {
    const it1: MeasureItem = {
      ...base,
      engine: 'measure',
      instrument: 'scale',
      scale: { unit: 'g', max: 1000, minor: 20, major: 100 },
      task: 'read',
      value: 340,
      misconceptions: { minorAsOne: 'one' },
      wrongAnswers: [{ value: 320, misconception: 'w' }],
    };
    expect(checkMeasure(it1)).toEqual([]);
    expect(judgeMeasure(it1, { fields: ['340'] }).result).toBe('correct');
    expect(judgeMeasure(it1, { fields: ['17'] })).toMatchObject({ misconception: 'one' });
    expect(judgeMeasure(it1, { fields: ['320'] })).toMatchObject({ misconception: 'w' });
  });
});

describe('set（目盛りに合わせる）', () => {
  it('目盛りの番号で判定・許容誤差・はしからの位置', () => {
    const it1 = ruler({ task: 'set', value: 73, fields: undefined });
    expect(judgeMeasure(it1, { tick: 73 }).result).toBe('correct');
    expect(judgeMeasure(it1, { tick: 72 })).toMatchObject({ result: 'wrong', mark: 72 });
    expect(judgeMeasure(it1, { tick: 500 }).result).toBe('retry');
    const it2 = ruler({ task: 'set', value: 73, tolerance: 1 });
    expect(judgeMeasure(it2, { tick: 72 }).result).toBe('correct');
    const it3 = ruler({ task: 'set', value: 30, from: 20 });
    expect(judgeMeasure(it3, { tick: 50 }).result).toBe('correct');
    expect(judgeMeasure(it3, { tick: 30 }).result).toBe('wrong');
  });
  it('ます（dL を 0.1 きざみ）: 小数の目盛りでも正確', () => {
    const it1: MeasureItem = {
      ...base,
      engine: 'measure',
      instrument: 'masu',
      scale: { unit: 'dL', max: 1, minor: 0.1, major: 0.5 },
      task: 'set',
      value: 0.7,
    };
    expect(checkMeasure(it1)).toEqual([]);
    expect(judgeMeasure(it1, { tick: 7 }).result).toBe('correct');
    expect(judgeMeasure(it1, { tick: 6 }).result).toBe('wrong');
  });
});

describe('check', () => {
  it('問題データの誤り', () => {
    expect(checkMeasure(ruler({ value: 130 })).join()).toMatch('はみ出す');
    expect(checkMeasure(ruler({ value: 35.5 })).join()).toMatch('目盛りの上にない');
    expect(
      checkMeasure(
        ruler({
          fields: [
            { unit: 'mm', factor: 1 },
            { unit: 'cm', factor: 10 },
          ],
        }),
      ).join(),
    ).toMatch('大きい単位から');
    expect(checkMeasure(ruler({ fields: [{ unit: 'cm', factor: 10 }] })).join()).toMatch(
      '小数点キー',
    );
    expect(
      checkMeasure(ruler({ scale: { unit: 'mm', max: 100, minor: 3, major: 10 } })).join(),
    ).toMatch('割り切れない');
    expect(
      checkMeasure(ruler({ wrongAnswers: [{ value: 35, misconception: 'x' }] })).join(),
    ).toMatch('正答と同じ');
  });
  it('見本の問題に誤りが無い', () => {
    for (const s of measureSamples) expect(checkMeasure(s), s.id).toEqual([]);
  });
});
