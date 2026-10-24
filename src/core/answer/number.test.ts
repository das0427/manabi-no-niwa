import { describe, expect, it } from 'vitest';
import { judgeNumber, normalizeInput, parseNumberInput } from './number';

describe('入力の正規化と読み取り', () => {
  it('全角・カンマ・空白', () => {
    expect(normalizeInput('１，２３４')).toBe('1234');
    expect(normalizeInput(' ３／４ ')).toBe('3/4');
  });
  it('形式の判別', () => {
    expect(parseNumberInput('12')?.form).toBe('int');
    expect(parseNumberInput('.5')).toMatchObject({ form: 'decimal', value: { n: 1, d: 2 } });
    expect(parseNumberInput('0.50')).toMatchObject({
      form: 'decimal',
      places: 2,
      value: { n: 1, d: 2 },
    });
    expect(parseNumberInput('2/4')).toMatchObject({
      form: 'fraction',
      raw: { n: 2, d: 4 },
      value: { n: 1, d: 2 },
    });
    expect(parseNumberInput('2 1/3')).toMatchObject({ form: 'mixed', value: { n: 7, d: 3 } });
    expect(parseNumberInput('2と1/3')).toMatchObject({ form: 'mixed', value: { n: 7, d: 3 } });
    expect(parseNumberInput('1/0')).toBeNull();
    expect(parseNumberInput('abc')).toBeNull();
    expect(parseNumberInput('')).toBeNull();
  });
});

describe('judgeNumber', () => {
  it('整数', () => {
    expect(judgeNumber({ kind: 'int', value: 12 }, '１２').result).toBe('correct');
    expect(judgeNumber({ kind: 'int', value: 12 }, '012').result).toBe('correct');
    expect(judgeNumber({ kind: 'int', value: 12 }, '13').result).toBe('wrong');
    expect(judgeNumber({ kind: 'int', value: 12 }, 'x')).toEqual({
      result: 'retry',
      reason: 'unreadable',
    });
  });
  it('小数: 0.5 = .5 = 0.50。浮動小数点の誤差に負けない', () => {
    const a = { kind: 'decimal', value: 0.3 } as const;
    expect(judgeNumber(a, '0.3').result).toBe('correct');
    expect(judgeNumber(a, '.30').result).toBe('correct');
    expect(judgeNumber({ kind: 'decimal', value: 0.1 + 0.2 }, '0.3').result).toBe('correct');
    expect(judgeNumber(a, '3/10')).toEqual({ result: 'retry', reason: 'form' });
    expect(judgeNumber(a, '0.4').result).toBe('wrong');
  });
  it('小数の桁数の指定: 3.0 と書く単元では 3 は「もう一度」（誤答にしない）', () => {
    const a = { kind: 'decimal', value: 3, places: 1 } as const;
    expect(judgeNumber(a, '3.0').result).toBe('correct');
    expect(judgeNumber(a, '3')).toEqual({ result: 'retry', reason: 'form' });
    expect(judgeNumber(a, '3.00')).toEqual({ result: 'retry', reason: 'form' });
    expect(judgeNumber(a, '3.1').result).toBe('wrong');
  });
  it('分数: 等価なら正解。約分が目標なら「もう少し」', () => {
    const a = { kind: 'fraction', num: 1, den: 2 } as const;
    expect(judgeNumber(a, '1/2').result).toBe('correct');
    expect(judgeNumber(a, '2/4').result).toBe('correct');
    expect(judgeNumber({ ...a, mustReduce: true }, '2/4')).toEqual({
      result: 'retry',
      reason: 'reduce',
    });
    expect(judgeNumber(a, '0.5')).toEqual({ result: 'retry', reason: 'form' });
    expect(judgeNumber({ ...a, allowDecimal: true }, '0.5').result).toBe('correct');
    expect(judgeNumber(a, '1/3').result).toBe('wrong');
  });
  it('仮分数と帯分数', () => {
    const a = { kind: 'fraction', num: 7, den: 3 } as const;
    expect(judgeNumber(a, '7/3').result).toBe('correct');
    expect(judgeNumber(a, '2 1/3').result).toBe('correct');
    expect(judgeNumber({ ...a, allowMixed: false }, '2 1/3')).toEqual({
      result: 'retry',
      reason: 'form',
    });
    expect(judgeNumber({ ...a, allowImproper: false }, '7/3')).toEqual({
      result: 'retry',
      reason: 'form',
    });
    expect(judgeNumber({ ...a, mustReduce: true }, '2 2/6')).toEqual({
      result: 'retry',
      reason: 'reduce',
    });
    expect(judgeNumber({ ...a, mustReduce: true }, '2 1/3').result).toBe('correct');
  });
  it('整数になる分数は整数で答えてよい', () => {
    expect(judgeNumber({ kind: 'fraction', num: 4, den: 2 }, '2').result).toBe('correct');
  });
  it('量: 単位の換算と許容誤差', () => {
    const a = {
      kind: 'quantity',
      value: 150,
      unit: 'cm',
      acceptUnits: [{ unit: 'm', factor: 100 }],
    } as const;
    expect(judgeNumber(a, '150').result).toBe('correct');
    expect(judgeNumber(a, '150', 'cm').result).toBe('correct');
    expect(judgeNumber(a, '1.5', 'm').result).toBe('correct');
    expect(judgeNumber(a, '1.5', 'km')).toEqual({ result: 'retry', reason: 'unit' });
    expect(judgeNumber(a, '15', 'cm').result).toBe('wrong');
    const t = { kind: 'quantity', value: 37, unit: '度', tolerance: 2 } as const;
    expect(judgeNumber(t, '39').result).toBe('correct');
    expect(judgeNumber(t, '40').result).toBe('wrong');
  });
});
