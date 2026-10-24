import { describe, expect, it } from 'vitest';
import {
  checkClock,
  clockAnswerText,
  dialOf,
  durationOf,
  judgeClock,
  timeText,
  type ClockItem,
  type ClockTask,
} from './clock';
import { clockSamples } from './clock.samples';

const base = {
  id: 't',
  objective: 'o',
  level: 0,
  prompt: 'p',
  hints: ['a', 'b', 'c'],
  explain: 'e',
  identity: 'k',
};
const mk = (task: ClockTask, over: Partial<ClockItem> = {}): ClockItem => ({
  ...base,
  engine: 'clock',
  task,
  misconceptions: {
    swapHands: 'swap',
    hourNext: 'next',
    hourPrev: 'prev',
    minuteNumeral: 'numeral',
    noCarry: 'carry',
    base100: 'b100',
  },
  ...over,
});

describe('時刻の文', () => {
  it('ふん／ぷん・はん・ごぜん／ごご', () => {
    expect(timeText({ h: 3, m: 0 })).toBe('3じ');
    expect(timeText({ h: 15, m: 20 })).toBe('3じ20ぷん');
    expect(timeText({ h: 3, m: 15 })).toBe('3じ15ふん');
    expect(timeText({ h: 0, m: 30 }, { halfWord: true })).toBe('12じはん');
    expect(timeText({ h: 13, m: 5 }, { dayHalf: true })).toBe('ごご1じ5ふん');
    expect(durationOf({ h: 9, m: 50 }, { h: 10, m: 25 })).toBe(35);
    expect(durationOf({ h: 23, m: 30 }, { h: 0, m: 10 })).toBe(40);
    expect(dialOf({ h: 15, m: 0 })).toBe(dialOf({ h: 3, m: 0 }));
  });
});

describe('read（数字キー）', () => {
  const it1 = mk({ kind: 'read', time: { h: 7, m: 45 }, answerBy: 'input' });
  it('正答・12時間と24時間・全角', () => {
    expect(judgeClock(it1, { fields: ['7', '45'] }).result).toBe('correct');
    expect(judgeClock(it1, { fields: ['19', '45'] }).result).toBe('correct');
    expect(judgeClock(it1, { fields: ['７', '４５'] }).result).toBe('correct');
    expect(judgeClock(it1, { fields: ['7', ''] }).result).toBe('retry');
  });
  it('誤概念: 次の時・長針の数字・針の取り違え', () => {
    expect(judgeClock(it1, { fields: ['8', '45'] })).toMatchObject({ misconception: 'next' });
    expect(judgeClock(it1, { fields: ['6', '45'] })).toMatchObject({ misconception: 'prev' });
    expect(judgeClock(it1, { fields: ['7', '9'] })).toMatchObject({ misconception: 'numeral' });
    const it2 = mk({ kind: 'read', time: { h: 3, m: 0 }, answerBy: 'input' });
    expect(judgeClock(it2, { fields: ['12', '15'] })).toMatchObject({ misconception: 'swap' });
    expect(judgeClock(it2, { fields: ['3', '1'] })).toMatchObject({ misconception: undefined });
  });
  it('「□じ」だけ', () => {
    const it2 = mk({ kind: 'read', time: { h: 12, m: 0 }, answerBy: 'input', hourOnly: true });
    expect(judgeClock(it2, { fields: ['12'] }).result).toBe('correct');
    expect(judgeClock(it2, { fields: ['0'] }).result).toBe('correct');
  });
});

describe('read（選ぶ）・pick', () => {
  it('選んだ番号で判定し、誤りの番号に印', () => {
    const it1 = mk({
      kind: 'read',
      time: { h: 7, m: 30 },
      answerBy: 'choice',
      halfWord: true,
      options: [
        { h: 7, m: 30 },
        { h: 8, m: 30 },
        { h: 7, m: 6 },
      ],
    });
    expect(checkClock(it1)).toEqual([]);
    expect(judgeClock(it1, { pick: 0 }).result).toBe('correct');
    expect(judgeClock(it1, { pick: 1 })).toMatchObject({ misconception: 'next', mark: [1] });
    expect(judgeClock(it1, { pick: 2 })).toMatchObject({ misconception: 'numeral' });
    expect(clockAnswerText(it1)).toBe('7じはん');
  });
});

describe('set（針を合わせる）', () => {
  const it1 = mk({ kind: 'set', target: { h: 7, m: 30 }, step: 5 });
  it('分単位で一致', () => {
    expect(judgeClock(it1, { total: 7 * 60 + 30 }).result).toBe('correct');
    expect(judgeClock(it1, { total: 7 * 60 + 35 })).toMatchObject({ result: 'wrong', mark: 455 });
    expect(judgeClock(it1, { total: 8 * 60 + 30 })).toMatchObject({ misconception: 'next' });
    expect(judgeClock(it1, { total: 1.5 }).result).toBe('retry');
  });
  it('検査: きざみ・最初から正答', () => {
    expect(checkClock(mk({ kind: 'set', target: { h: 7, m: 32 }, step: 5 })).join()).toMatch(
      '5分きざみ',
    );
    expect(checkClock(mk({ kind: 'set', target: { h: 12, m: 0 } })).join()).toMatch('最初から');
    expect(checkClock(mk({ kind: 'set', target: { h: 25, m: 0 } })).join()).toMatch('範囲外');
  });
});

describe('elapsed（時間の経過）', () => {
  it('かかった時間（分）と100進法の誤り', () => {
    const it1 = mk({
      kind: 'elapsed',
      start: { h: 9, m: 50 },
      end: { h: 10, m: 25 },
      ask: 'duration',
    });
    expect(judgeClock(it1, { fields: ['35'] }).result).toBe('correct');
    expect(judgeClock(it1, { fields: ['75'] })).toMatchObject({ misconception: 'b100' });
    expect(clockAnswerText(it1)).toBe('35ふん');
  });
  it('かかった時間（じかん・ふん）: 75ふん と書いたら形式の違い', () => {
    const it1 = mk({
      kind: 'elapsed',
      start: { h: 9, m: 0 },
      end: { h: 10, m: 15 },
      ask: 'duration',
      unit: 'hm',
    });
    expect(judgeClock(it1, { fields: ['1', '15'] }).result).toBe('correct');
    expect(judgeClock(it1, { fields: ['0', '75'] }).result).toBe('retry');
    expect(clockAnswerText(it1)).toBe('1じかん15ふん');
  });
  it('おわりの時刻: 繰り上げない誤り', () => {
    const it1 = mk({
      kind: 'elapsed',
      start: { h: 8, m: 40 },
      end: { h: 9, m: 10 },
      ask: 'end',
      answerBy: 'input',
    });
    expect(judgeClock(it1, { fields: ['9', '10'] }).result).toBe('correct');
    expect(judgeClock(it1, { fields: ['8', '70'] })).toMatchObject({ misconception: 'carry' });
  });
  it('おわりの時刻を針で', () => {
    const it1 = mk({
      kind: 'elapsed',
      start: { h: 8, m: 40 },
      end: { h: 9, m: 10 },
      ask: 'end',
      answerBy: 'set',
      step: 5,
    });
    expect(judgeClock(it1, { total: 9 * 60 + 10 }).result).toBe('correct');
    expect(judgeClock(it1, { total: 8 * 60 + 10 })).toMatchObject({ misconception: 'prev' });
  });
});

describe('check', () => {
  it('選択肢の誤り', () => {
    const t: ClockTask = {
      kind: 'pick',
      time: { h: 3, m: 0 },
      options: [
        { h: 3, m: 0 },
        { h: 15, m: 0 },
      ],
    };
    const errs = checkClock(mk(t)).join();
    expect(errs).toMatch('正答の時刻の選択肢が2つ');
    expect(errs).toMatch('重複');
    expect(
      checkClock(
        mk({
          kind: 'pick',
          time: { h: 3, m: 0 },
          options: [
            { h: 4, m: 0 },
            { h: 5, m: 0 },
          ],
        }),
      ).join(),
    ).toMatch('0つ');
  });
  it('誤答の例が正答と同じ', () => {
    const it1 = mk(
      { kind: 'read', time: { h: 3, m: 0 }, answerBy: 'input' },
      { wrongAnswers: [{ time: { h: 3, m: 0 }, misconception: 'x' }] },
    );
    expect(checkClock(it1).join()).toMatch('正答と同じ');
  });
  it('見本の問題に誤りが無い', () => {
    for (const s of clockSamples) expect(checkClock(s), s.id).toEqual([]);
  });
});
