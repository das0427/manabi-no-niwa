import { act, cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audienceUx } from '../../audience/audience';
import type { RenderCtx } from '../types';
import {
  checkProgram,
  EMPTY_PROGRAM,
  judgeProgram,
  programAnswerText,
  programEngine,
  type ProgramItem,
} from './program';
import { PROGRAM_SAMPLES } from './program.samples';
import {
  cardCount,
  MAX_STEPS,
  removeAt,
  repeatVariants,
  run,
  swapLeftRight,
  updateContainer,
  type Command,
  type World,
} from './world';

const F: Command = { op: 'forward' };
const R: Command = { op: 'turnRight' };
const L: Command = { op: 'turnLeft' };
const rep = (times: number | 'goal', ...body: Command[]): Command => ({
  op: 'repeat',
  times,
  body,
});

const world: World = {
  w: 3,
  h: 3,
  start: { at: [0, 2], dir: 'up' },
  goal: [2, 0],
  walls: [[1, 1]],
};

describe('program: 実行', () => {
  it('すすむ・むく・ゴールで止まる', () => {
    const r = run(world, [F, F, R, F, F, F, F]);
    expect(r.outcome).toBe('goal');
    expect(r.at).toEqual([2, 0]);
    // ゴールに着いたら残りの札は動かさない
    expect(r.steps.length).toBe(5);
  });
  it('かべ・格子の外にぶつかる', () => {
    expect(run(world, [R, F, L, F]).outcome).toBe('bump'); // (1,2) から上は かべ (1,1)
    expect(run(world, [L, F]).outcome).toBe('bump'); // 外
  });
  it('ゴールの手前で終わる', () => {
    expect(run(world, [F]).outcome).toBe('short');
  });
  it('方向で動く札（幼児）', () => {
    const w: World = { w: 3, h: 1, start: { at: [0, 0], dir: 'right' }, goal: [2, 0] };
    expect(run(w, [{ op: 'right' }, { op: 'right' }]).outcome).toBe('goal');
    expect(run(w, [{ op: 'left' }]).outcome).toBe('bump');
  });
  it('くりかえす・もし・つくまで くりかえす', () => {
    expect(run(world, [rep(2, F), R, rep(2, F)]).outcome).toBe('goal');
    const until: Command[] = [rep('goal', { op: 'if', cond: 'wall-ahead', body: [R] }, F)];
    expect(run(world, until).outcome).toBe('goal');
    // 着かない「つくまで」は止まる
    expect(run(world, [rep('goal', R)]).outcome).toBe('loop');
    expect(run(world, [rep(999, R)]).steps.length).toBe(MAX_STEPS);
  });
  it('もし まえが あいていたら', () => {
    const w: World = { w: 2, h: 2, start: { at: [0, 1], dir: 'up' }, goal: [1, 0] };
    const p: Command[] = [{ op: 'if', cond: 'open-ahead', body: [F] }, R, F];
    expect(run(w, p).outcome).toBe('goal');
  });
});

describe('program: 札の操作（純粋関数）', () => {
  it('札の数・入れ物への追加・外す', () => {
    const p = [F, rep(3, F, R)];
    expect(cardCount(p)).toBe(4);
    expect(updateContainer(p, [1], (b) => [...b, L])).toEqual([F, rep(3, F, R, L)]);
    expect(removeAt(p, [1, 0])).toEqual([F, rep(3, R)]);
    expect(removeAt(p, [1])).toEqual([F]);
  });
  it('左右の入れ替え・回数の ±1', () => {
    expect(swapLeftRight([R, { op: 'left' }, rep(2, L)])).toEqual([L, { op: 'right' }, rep(2, R)]);
    expect(repeatVariants([rep(1, F), rep(3, R)])).toEqual([
      [rep(2, F), rep(3, R)],
      [rep(1, F), rep(2, R)],
      [rep(1, F), rep(4, R)],
    ]);
  });
});

const base = (over: Partial<ProgramItem> = {}): ProgramItem => ({
  id: 't',
  engine: 'program',
  objective: 'o',
  level: 0,
  prompt: 'p',
  grid: { w: 3, h: 3, walls: [[1, 1]] },
  start: { at: [0, 2], dir: 'up' },
  goal: [2, 0],
  palette: ['forward', 'turnRight', 'turnLeft', 'repeat'],
  solution: [rep(2, F), R, rep(2, F)],
  misconceptionIds: {
    bump: 'm-bump',
    short: 'm-short',
    turn: 'm-lr',
    repeatCount: 'm-rc',
    tooMany: 'm-many',
  },
  hints: ['a', 'b', 'c'],
  explain: 'e',
  identity: 'k',
  ...over,
});

describe('program: 判定', () => {
  it('ゴールに着けば正解（列の違いは問わない）', () => {
    expect(judgeProgram(base(), [F, F, R, F, F])).toEqual({ result: 'correct' });
    expect(judgeProgram(base(), [rep(2, F), R, rep(2, F)])).toEqual({ result: 'correct' });
  });
  it('空の列は誤答にせず もう一度', () => {
    expect(judgeProgram(base(), [])).toEqual({ result: 'retry', message: EMPTY_PROGRAM });
  });
  it('みぎ・ひだりの取り違え', () => {
    expect(judgeProgram(base(), [F, F, L, F, F])).toMatchObject({
      result: 'wrong',
      misconception: 'm-lr',
    });
  });
  it('くりかえしの回数の数え違い', () => {
    expect(judgeProgram(base(), [rep(2, F), R, rep(1, F)])).toMatchObject({
      result: 'wrong',
      misconception: 'm-rc',
    });
  });
  it('ぶつかった・手前で終わった', () => {
    expect(judgeProgram(base(), [R, F, L, F])).toMatchObject({
      result: 'wrong',
      misconception: 'm-bump',
    });
    expect(judgeProgram(base(), [F])).toMatchObject({ result: 'wrong', misconception: 'm-short' });
  });
  it('札の数の上限を超えた正しい列は誤り（上限の誤概念）', () => {
    expect(judgeProgram(base({ maxCards: 5 }), [F, F, R, F, F])).toEqual({ result: 'correct' });
    expect(judgeProgram(base({ maxCards: 4 }), [F, F, R, F, F])).toMatchObject({
      result: 'wrong',
      misconception: 'm-many',
    });
  });
  it('答えの文', () => {
    expect(programAnswerText(base())).toBe(
      'たとえば くりかえす 2かい（すすむ）、みぎを むく、くりかえす 2かい（すすむ）',
    );
  });
});

describe('program: 検査', () => {
  it('見本は誤りなし', () => {
    for (const s of PROGRAM_SAMPLES) expect(checkProgram(s), s.id).toEqual([]);
  });
  it('正答の例が着かない・使えない札・回数', () => {
    expect(checkProgram(base({ solution: [F] })).join()).toMatch(/正答の例でゴールに着かない/);
    expect(checkProgram(base({ palette: ['forward', 'turnRight', 'turnLeft'] })).join()).toMatch(
      /使えない札 repeat/,
    );
    expect(checkProgram(base({ repeatTimes: [3] })).join()).toMatch(/回数 2 が選べない/);
    expect(checkProgram(base({ maxCards: 3 })).join()).toMatch(/多すぎる/);
  });
  it('デバッグの列が最初から正答', () => {
    expect(checkProgram(base({ initial: [F, F, R, F, F] })).join()).toMatch(/最初から正答/);
    expect(checkProgram(base({ initial: [F, F, L, F, F] }))).toEqual([]);
  });
  it('格子・位置・札の混在', () => {
    expect(checkProgram(base({ goal: [5, 0] })).join()).toMatch(/ゴールが格子の外/);
    expect(checkProgram(base({ grid: { w: 3, h: 3, walls: [[2, 0]] } })).join()).toMatch(/重なる/);
    expect(
      checkProgram(base({ palette: ['forward', 'up', 'turnRight', 'repeat'] })).join(),
    ).toMatch(/混ぜない/);
    expect(checkProgram(base({ start: { at: [2, 0], dir: 'up' } })).join()).toMatch(/同じ/);
  });
});

describe('program: 画面（タップだけ）', () => {
  const ctx: RenderCtx = {
    packId: 'pk',
    readAloud: 'always',
    furigana: 'unlearned',
    learnerGrade: 3,
    preschool: false,
    textScale: 1,
    ux: audienceUx('g3'),
  };
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });
  const show = (it: ProgramItem, submit = vi.fn()) => {
    render(
      createElement(programEngine.Component, {
        item: it,
        ctx,
        revealed: false,
        wrongMark: null,
        disabled: false,
        submit,
      }),
    );
    return submit;
  };
  const tap = (id: string) => act(() => screen.getByTestId(id).click());

  it('札を足して、くりかえすの中に入れ、回数を変え、うごかすと 1手ずつ動いてから判定に出す', async () => {
    const submit = show(base());
    tap('palette-repeat'); // くりかえす 2かい（中に入れる所が選ばれる）
    tap('palette-forward');
    tap('slot-top');
    tap('palette-turnRight');
    tap('palette-repeat');
    tap('palette-forward');
    tap('param-2'); // 2かい → 3かい
    tap('param-2'); // 3かい → 4かい
    tap('param-2'); // 4かい → 2かい
    expect(screen.getByTestId('prog-strip').textContent).toContain('2かい');
    tap('run-button');
    expect((screen.getByTestId('palette-forward') as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(450 * 8);
    });
    expect(submit).toHaveBeenCalledWith([rep(2, F), R, rep(2, F)]);
    expect(screen.getByTestId('prog-board').dataset.at).toBe('2,0');
  });

  it('並べた札をタップで外す・ひとつ もどす・デバッグは最初から並ぶ', () => {
    show(PROGRAM_SAMPLES[2]!);
    expect(screen.getByTestId('card-3')).toBeTruthy();
    tap('card-3'); // みぎを むく を外す
    expect(screen.queryByTestId('card-5')).toBeNull();
    tap('palette-turnLeft');
    expect(screen.getByTestId('card-5').getAttribute('aria-label')).toContain('ひだりを むく');
    tap('undo-button');
    expect(screen.queryByTestId('card-5')).toBeNull();
  });

  it('札の上限で、使える札が押せなくなる', () => {
    show(PROGRAM_SAMPLES[0]!);
    for (let i = 0; i < 4; i++) tap('palette-right');
    expect((screen.getByTestId('palette-down') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('prog-count').textContent).toContain('0まい');
  });
});
