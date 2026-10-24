import { describe, expect, it } from 'vitest';
import { ratText, toRational } from './kit';
import {
  checkNumberline,
  judgeNumberline,
  numberlineAnswerText,
  type NumberlineItem,
} from './numberline';
import { numberlineSamples } from './numberline.samples';

const base = {
  id: 't',
  objective: 'o',
  level: 0,
  prompt: 'p',
  hints: ['a', 'b', 'c'],
  explain: 'e',
  identity: 'k',
};

const read = (over: Partial<NumberlineItem> = {}): NumberlineItem => ({
  ...base,
  engine: 'numberline',
  line: { min: 0, max: 20, minor: 1, majorEvery: 10 },
  task: { kind: 'read', at: 13 },
  ...over,
});

describe('kit', () => {
  it('数の読み取りと表記', () => {
    expect(toRational('2/4')).toEqual({ n: 1, d: 2 });
    expect(toRational(0.1)).toEqual({ n: 1, d: 10 });
    expect(toRational('1 1/3')).toEqual({ n: 4, d: 3 });
    expect(ratText({ n: 3, d: 5 }, 'auto')).toBe('0.6');
    expect(ratText({ n: 3, d: 5 }, 'fraction')).toBe('[[3/5]]');
    expect(ratText({ n: 1, d: 3 }, 'auto')).toBe('[[1/3]]');
    expect(ratText({ n: 7, d: 10 }, 'auto')).toBe('0.7');
    expect(ratText({ n: 4, d: 3 }, 'mixed')).toBe('[[1 1/3]]');
  });
});

describe('read', () => {
  it('正答・表記ゆれ（全角）・読めない入力', () => {
    expect(judgeNumberline(read(), { fields: ['13'] }).result).toBe('correct');
    expect(judgeNumberline(read(), { fields: ['１３'] }).result).toBe('correct');
    expect(judgeNumberline(read(), { fields: ['あ'] }).result).toBe('retry');
  });
  it('となりの目盛り・決まった誤答の誤概念', () => {
    const it1 = read({ misconceptions: { neighborTick: 'nb' } });
    expect(judgeNumberline(it1, { fields: ['12'] })).toMatchObject({
      result: 'wrong',
      misconception: 'nb',
    });
    expect(judgeNumberline(it1, { fields: ['15'] })).toMatchObject({
      result: 'wrong',
      misconception: undefined,
    });
    const it2 = read({ wrongAnswers: [{ value: 15, misconception: 'w' }] });
    expect(judgeNumberline(it2, { fields: ['15'] })).toMatchObject({ misconception: 'w' });
  });
  it('分数の目盛り: 分数は正、小数は形式の違い（もう一度）', () => {
    const it1 = read({
      line: { min: 0, max: 1, minor: '1/5', majorEvery: 5 },
      task: { kind: 'read', at: '3/5', keys: ['fraction'] },
    });
    expect(checkNumberline(it1)).toEqual([]);
    expect(judgeNumberline(it1, { fields: ['3/5'] }).result).toBe('correct');
    expect(judgeNumberline(it1, { fields: ['6/10'] }).result).toBe('correct');
    expect(judgeNumberline(it1, { fields: ['0.6'] }).result).toBe('retry');
    expect(numberlineAnswerText(it1)).toBe('[[3/5]]');
  });
  it('最小目盛りを1とみた誤り（0.1 の目盛り）', () => {
    const it1 = read({
      line: { min: 0, max: 1, minor: 0.1, majorEvery: 10 },
      task: { kind: 'read', at: 0.4, keys: ['decimal'] },
      misconceptions: { minorAsOne: 'one' },
    });
    expect(judgeNumberline(it1, { fields: ['0.4'] }).result).toBe('correct');
    expect(judgeNumberline(it1, { fields: ['4'] })).toMatchObject({
      result: 'wrong',
      misconception: 'one',
    });
  });
});

describe('place', () => {
  const place = (over: Partial<NumberlineItem> = {}): NumberlineItem => ({
    ...base,
    engine: 'numberline',
    line: { min: 0, max: 2, minor: 0.1, majorEvery: 10 },
    task: { kind: 'place', target: 0.7 },
    misconceptions: { minorAsOne: 'one', neighborTick: 'nb' },
    ...over,
  });
  it('目盛りの番号で判定（吸着後）', () => {
    expect(judgeNumberline(place(), { tick: 7 }).result).toBe('correct');
    expect(judgeNumberline(place(), { tick: 8 })).toMatchObject({
      result: 'wrong',
      misconception: 'nb',
      mark: 8,
    });
    expect(judgeNumberline(place(), { tick: 15 }).result).toBe('wrong');
    expect(judgeNumberline(place(), { tick: 99 }).result).toBe('retry');
  });
  it('許容誤差', () => {
    const it1 = place({
      line: { min: 0, max: 100, minor: 1, majorEvery: 10 },
      task: { kind: 'place', target: 37, tolerance: 1 },
      misconceptions: undefined,
    });
    expect(judgeNumberline(it1, { tick: 36 }).result).toBe('correct');
    expect(judgeNumberline(it1, { tick: 38 }).result).toBe('correct');
    expect(judgeNumberline(it1, { tick: 39 }).result).toBe('wrong');
  });
  it('目盛りを1とみた誤り（10 の目盛り）', () => {
    const it1 = place({
      line: { min: 0, max: 1000, minor: 10, majorEvery: 10 },
      task: { kind: 'place', target: 30 },
    });
    expect(judgeNumberline(it1, { tick: 3 }).result).toBe('correct');
    expect(judgeNumberline(it1, { tick: 30 })).toMatchObject({ misconception: 'one' });
  });
});

describe('check', () => {
  it('問題データの誤り', () => {
    expect(
      checkNumberline(read({ line: { min: 0, max: 10, minor: 3, majorEvery: 1 } }))[0],
    ).toMatch('割り切れない');
    expect(checkNumberline(read({ task: { kind: 'read', at: 25 } }))).toContain(
      '指す値 25 が目盛りの上にない',
    );
    expect(checkNumberline(read({ task: { kind: 'read', at: 10 } })).join()).toMatch(
      '答えが見える',
    );
    expect(
      checkNumberline(read({ task: { kind: 'read', at: 13, answer: { kind: 'int', value: 12 } } })),
    ).toContain('答えの値が指す値と一致しない');
    expect(
      checkNumberline(
        read({
          line: { min: 0, max: 1, minor: 0.1, majorEvery: 10 },
          task: { kind: 'read', at: 0.3 },
        }),
      ),
    ).toContain('小数の答えなのに小数点キーが無い');
    expect(checkNumberline(read({ task: { kind: 'place', target: 25 } })).join()).toMatch(
      '数直線の外',
    );
    expect(checkNumberline(read({ task: { kind: 'place', target: 2.5 } })).join()).toMatch(
      '届かない',
    );
    expect(checkNumberline(read({ task: { kind: 'place', target: 2.5, tolerance: 0.5 } }))).toEqual(
      [],
    );
    expect(checkNumberline(read({ wrongAnswers: [{ value: 13, misconception: 'x' }] }))).toContain(
      '誤答の例 13 が正答と同じ',
    );
  });
  it('見本の問題に誤りが無い', () => {
    for (const s of numberlineSamples) expect(checkNumberline(s), s.id).toEqual([]);
  });
});
