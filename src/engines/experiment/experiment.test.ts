import { describe, expect, it } from 'vitest';
import {
  checkExperiment,
  experimentAnswerText,
  experimentTexts,
  judgeExperiment,
  reachExample,
  type ExperimentItem,
  type ExpSetup,
  type ExpTask,
} from './experiment';
import { experimentSamples } from './experiment.samples';
import {
  allConds,
  circuitCurrent,
  diffFactors,
  initialCond,
  pendulumPeriod,
  resultOf,
} from './model';
import { findBareKanji } from '../../text/rich';

const base = {
  id: 't',
  objective: 'o',
  level: 0,
  prompt: 'p',
  hints: ['a', 'b', 'c'],
  explain: 'e',
  identity: 'k',
};
const MIS = {
  weightOnly: 'w',
  distanceOnly: 'd',
  seriesParallel: 'sp',
  changedMany: 'many',
  notChanged: 'none',
};
const mk = (
  setup: ExpSetup,
  task: ExpTask,
  extra: Partial<ExperimentItem> = {},
): ExperimentItem => ({
  ...base,
  engine: 'experiment',
  setup,
  task,
  misconceptions: MIS,
  ...extra,
});
const pend: ExpSetup = {
  kind: 'pendulum',
  length: [25, 50, 100],
  weight: [10, 20],
  amplitude: [10, 30],
};
const lever: ExpSetup = {
  kind: 'lever',
  leftPos: [2],
  leftWeight: [30],
  rightPos: [1, 2, 3, 6],
  rightWeight: [10, 20, 30, 60],
};
const circuit: ExpSetup = {
  kind: 'circuit',
  device: 'bulb',
  cells: [1, 2],
  connection: ['series', 'parallel'],
};

describe('model', () => {
  it('ふりこ: 周期は長さで決まり、重さ・振れ幅では変わらない', () => {
    expect(pendulumPeriod(100)).toBe(2);
    expect(pendulumPeriod(25)).toBe(1);
    expect(pendulumPeriod(50)).toBe(1.4);
    const a = resultOf(pend, { length: 50, weight: 10, amplitude: 10 });
    const b = resultOf(pend, { length: 50, weight: 20, amplitude: 30 });
    expect(a).toEqual(b);
    expect(a?.key).toBe('1.4');
    expect(resultOf(pend, { length: 100, weight: 10, amplitude: 10 })?.text).toBe('2.0びょう');
  });
  it('てこ: 位置×重さ', () => {
    expect(resultOf(lever, { leftPos: 2, leftWeight: 30, rightPos: 3, rightWeight: 20 })?.key).toBe(
      'balance',
    );
    expect(resultOf(lever, { leftPos: 2, leftWeight: 30, rightPos: 3, rightWeight: 30 })?.key).toBe(
      'right',
    );
    expect(resultOf(lever, { leftPos: 2, leftWeight: 30, rightPos: 1, rightWeight: 30 })?.key).toBe(
      'left',
    );
  });
  it('回路: 直列2個は強く、並列2個は1個と同じ。1個のときつなぎ方は意味を持たない', () => {
    expect(circuitCurrent({ cells: 1, connection: 'series' })).toBe(1);
    expect(circuitCurrent({ cells: 2, connection: 'series' })).toBe(2);
    expect(circuitCurrent({ cells: 2, connection: 'parallel' })).toBe(1);
    expect(resultOf(circuit, { cells: 2, connection: 'series' })?.key).toBe('bright');
    expect(allConds(circuit)).toHaveLength(3);
    expect(
      diffFactors(
        circuit,
        { cells: 1, connection: 'series' },
        { cells: 1, connection: 'parallel' },
      ),
    ).toEqual([]);
    const motor: ExpSetup = { ...circuit, device: 'motor', direction: ['forward', 'reverse'] };
    expect(resultOf(motor, { cells: 2, connection: 'series', direction: 'reverse' })?.key).toBe(
      'fast-ccw',
    );
    expect(resultOf(motor, { cells: 1, connection: 'series', direction: 'forward' })?.key).toBe(
      'normal-cw',
    );
  });
  it('はじめの条件', () => {
    expect(initialCond(pend)).toEqual({ length: 25, weight: 10, amplitude: 10 });
    expect(initialCond(pend, { length: 100 })).toMatchObject({ length: 100 });
  });
});

describe('consider（考察）', () => {
  const item = mk(pend, {
    kind: 'consider',
    options: [
      { label: 'ながさ', correct: true },
      { label: 'おもさ', misconception: 'mw' },
    ],
  });
  it('choice と同じ判定', () => {
    expect(judgeExperiment(item, { pick: [0] })).toEqual({ result: 'correct' });
    expect(judgeExperiment(item, { pick: [1] })).toEqual({
      result: 'wrong',
      misconception: 'mw',
      mark: [1],
    });
    expect(judgeExperiment(item, { pick: [] })).toMatchObject({ result: 'retry' });
    expect(checkExperiment(item)).toEqual([]);
    expect(experimentAnswerText(item)).toBe('ながさ');
  });
  it('すべて選ぶ', () => {
    const m = mk(pend, {
      kind: 'consider',
      multi: true,
      options: [
        { label: 'あ', correct: true },
        { label: 'い', correct: true },
        { label: 'う', misconception: 'x' },
      ],
    });
    expect(judgeExperiment(m, { pick: [1, 0] })).toEqual({ result: 'correct' });
    expect(judgeExperiment(m, { pick: [0, 2] })).toMatchObject({ misconception: 'x', mark: [2] });
  });
  it('check: 正解が無い・minTrials が多すぎる', () => {
    expect(
      checkExperiment(mk(pend, { kind: 'consider', options: [{ label: 'a' }, { label: 'b' }] })),
    ).toContain('正解の選択肢が無い');
    expect(
      checkExperiment(
        mk(pend, {
          kind: 'consider',
          minTrials: 99,
          options: [{ label: 'a', correct: true }, { label: 'b' }],
        }),
      ).join(),
    ).toMatch('minTrials');
  });
});

describe('reach（条件を当てる）', () => {
  const item = mk(lever, { kind: 'reach', target: 'balance' });
  it('つり合う組は正解（位置×重さ）', () => {
    expect(
      judgeExperiment(item, { cond: { leftPos: 2, leftWeight: 30, rightPos: 3, rightWeight: 20 } }),
    ).toEqual({
      result: 'correct',
    });
    expect(
      judgeExperiment(item, { cond: { leftPos: 2, leftWeight: 30, rightPos: 1, rightWeight: 60 } }),
    ).toEqual({
      result: 'correct',
    });
  });
  it('重さだけそろえた・位置だけそろえた', () => {
    expect(
      judgeExperiment(item, { cond: { leftPos: 2, leftWeight: 30, rightPos: 3, rightWeight: 30 } }),
    ).toMatchObject({ result: 'wrong', misconception: 'w' });
    expect(
      judgeExperiment(item, { cond: { leftPos: 2, leftWeight: 30, rightPos: 2, rightWeight: 60 } }),
    ).toMatchObject({ result: 'wrong', misconception: 'd' });
    expect(judgeExperiment(item, { pick: [0] })).toMatchObject({ result: 'retry' });
  });
  it('wrongConditions が先', () => {
    const w = mk(
      lever,
      { kind: 'reach', target: 'balance' },
      {
        wrongConditions: [{ when: { rightPos: 6, rightWeight: 30 }, misconception: 'far' }],
      },
    );
    expect(
      judgeExperiment(w, { cond: { leftPos: 2, leftWeight: 30, rightPos: 6, rightWeight: 30 } }),
    ).toMatchObject({ misconception: 'far' });
    expect(checkExperiment(w)).toEqual([]);
    const bad = mk(
      lever,
      { kind: 'reach', target: 'balance' },
      {
        wrongConditions: [{ when: { rightPos: 3 }, misconception: 'x' }],
      },
    );
    expect(checkExperiment(bad).join()).toMatch('正解の組が含まれる');
  });
  it('回路: 並列と直列の取り違え', () => {
    const c = mk(circuit, { kind: 'reach', target: 'bright' });
    expect(judgeExperiment(c, { cond: { cells: 2, connection: 'series' } })).toEqual({
      result: 'correct',
    });
    expect(judgeExperiment(c, { cond: { cells: 2, connection: 'parallel' } })).toMatchObject({
      misconception: 'sp',
    });
    expect(checkExperiment(c)).toEqual([]);
    expect(reachExample(c)).toMatchObject({ cells: 2, connection: 'series' });
  });
  it('check: 作れない結果・はじめから正解', () => {
    expect(checkExperiment(mk(lever, { kind: 'reach', target: 'up' })).join()).toMatch(
      '条件が無い',
    );
    expect(
      checkExperiment(
        mk(
          lever,
          { kind: 'reach', target: 'balance' },
          { initial: { rightPos: 3, rightWeight: 20 } },
        ),
      ).join(),
    ).toMatch('はじめの条件で');
    expect(
      checkExperiment(
        mk(lever, { kind: 'reach', target: 'balance' }, { initial: { rightPos: 5 } }),
      ).join(),
    ).toMatch('候補に無い');
  });
});

describe('control（条件制御）', () => {
  const item = mk(pend, { kind: 'control', factor: 'length' });
  const c = (length: number, weight: number, amplitude: number) => ({ length, weight, amplitude });
  it('長さだけを変えた2回があれば正解', () => {
    expect(judgeExperiment(item, { trials: [c(25, 10, 10), c(100, 10, 10)] })).toEqual({
      result: 'correct',
    });
    expect(
      judgeExperiment(item, { trials: [c(25, 20, 10), c(25, 10, 30), c(100, 10, 30)] }),
    ).toEqual({
      result: 'correct',
    });
  });
  it('2つを同時に変えた・変えていない・1回だけ', () => {
    expect(judgeExperiment(item, { trials: [c(25, 10, 10), c(100, 20, 10)] })).toMatchObject({
      result: 'wrong',
      misconception: 'many',
    });
    expect(judgeExperiment(item, { trials: [c(25, 10, 10), c(25, 20, 10)] })).toMatchObject({
      result: 'wrong',
      misconception: 'none',
    });
    expect(judgeExperiment(item, { trials: [c(25, 10, 10)] })).toMatchObject({ result: 'retry' });
  });
  it('check: 変えられない因子', () => {
    expect(checkExperiment(item)).toEqual([]);
    const fixed: ExpSetup = { kind: 'pendulum', length: [50], weight: [10, 20], amplitude: [10] };
    expect(checkExperiment(mk(fixed, { kind: 'control', factor: 'length' })).join()).toMatch(
      '1つしかない',
    );
    expect(checkExperiment(mk(pend, { kind: 'control', factor: 'color' })).join()).toMatch('無い');
  });
});

describe('table（固定表）と設定の検査', () => {
  it('組の行が無い・重複', () => {
    const t: ExpSetup = {
      kind: 'table',
      factors: [
        {
          id: 'a',
          label: 'もの',
          values: [
            { id: 'x', label: 'x' },
            { id: 'y', label: 'y' },
          ],
        },
      ],
      output: 'けっか',
      rows: [{ when: { a: 'x' }, result: 'つく' }],
    };
    const item = mk(t, {
      kind: 'consider',
      minTrials: 0,
      options: [{ label: 'a', correct: true }, { label: 'b' }],
    });
    expect(checkExperiment(item).join()).toMatch('行が無い');
    expect(resultOf(t, { a: 'y' })).toBeNull();
  });
  it('範囲外の値', () => {
    const bad: ExpSetup = {
      kind: 'lever',
      leftPos: [7],
      leftWeight: [10],
      rightPos: [1],
      rightWeight: [10, 20],
    };
    expect(checkExperiment(mk(bad, { kind: 'reach', target: 'balance' })).join()).toMatch('範囲外');
  });
});

describe('見本', () => {
  it('checkExperiment が誤りを返さない・文はよみ付き', () => {
    for (const s of experimentSamples) {
      expect(checkExperiment(s), s.id).toEqual([]);
      expect(experimentAnswerText(s), s.id).not.toBe('');
      for (const t of experimentTexts(s)) expect(findBareKanji(t), t).toEqual([]);
    }
  });
});
