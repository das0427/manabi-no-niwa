import { act, cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audienceUx } from '../../audience/audience';
import type { RenderCtx } from '../types';
import {
  checkListen,
  DEFAULT_GAP_MS,
  judgeListen,
  listenEngine,
  listenSeq,
  type ListenItem,
} from './listen';
import { LISTEN_SAMPLES } from './listen.samples';

// 音声は偽物（再生の終わりをテストから決める）
const h = vi.hoisted(() => ({
  resolvers: [] as ((r: 'done' | 'stopped') => void)[],
  state: { unlocked: true, speaking: false, health: 'ok' as const, currentKeys: [] as string[] },
}));
vi.mock('../../core/audio/index', () => ({
  audio: {
    play: vi.fn(() => new Promise<'done' | 'stopped'>((res) => h.resolvers.push(res))),
    stop: vi.fn(),
    getState: () => h.state,
    subscribe: () => () => undefined,
  },
}));

const base = (over: Partial<ListenItem> = {}): ListenItem => ({
  id: 't',
  engine: 'listen',
  objective: 'o',
  level: 0,
  prompt: 'きこえた ものは どれ',
  audio: { text: 'いぬ' },
  options: [
    { label: 'いぬ', correct: true },
    { label: 'ねこ', misconception: 'm1' },
    { label: 'とり' },
  ],
  hints: ['a', 'b'],
  explain: 'e',
  identity: 'k',
  ...over,
});

describe('listen: 判定', () => {
  it('正解の選択肢', () => {
    expect(judgeListen(base(), [0])).toEqual({ result: 'correct' });
  });
  it('誤りの選択肢は誤概念と印', () => {
    expect(judgeListen(base(), [1])).toEqual({ result: 'wrong', misconception: 'm1', mark: [1] });
    expect(judgeListen(base(), [2])).toEqual({
      result: 'wrong',
      misconception: undefined,
      mark: [2],
    });
  });
  it('範囲外・空は誤り（印なし）', () => {
    expect(judgeListen(base(), [9])).toEqual({ result: 'wrong', mark: [] });
    expect(judgeListen(base(), [])).toEqual({ result: 'wrong', mark: [] });
  });
  it('すべて選ぶ: 順不同の集合一致', () => {
    const it2 = base({
      multi: true,
      options: [{ label: 'あ', correct: true }, { label: 'い' }, { label: 'う', correct: true }],
    });
    expect(judgeListen(it2, [2, 0])).toEqual({ result: 'correct' });
    expect(judgeListen(it2, [0, 0, 2])).toEqual({ result: 'correct' });
    expect(judgeListen(it2, [0]).result).toBe('wrong');
    expect(judgeListen(it2, [0, 1, 2]).result).toBe('wrong');
  });
});

describe('listen: 検査', () => {
  it('見本は誤りなし', () => {
    for (const s of LISTEN_SAMPLES) expect(checkListen(s), s.id).toEqual([]);
  });
  it('英字の音声は key（録音）が必須', () => {
    expect(checkListen(base({ audio: { text: 'dog' } })).join()).toMatch(/key/);
    expect(checkListen(base({ audio: { text: 'dog', key: 'en-g5/dog' } }))).toEqual([]);
  });
  it('音声キーの文字・空の文・音声なし・間の範囲', () => {
    expect(checkListen(base({ audio: { text: 'dog', key: 'EN/Dog' } })).join()).toMatch(
      /使えない文字/,
    );
    expect(checkListen(base({ audio: { text: ' ' } })).join()).toMatch(/空/);
    expect(checkListen(base({ audio: [] })).join()).toMatch(/音声が無い/);
    expect(checkListen(base({ gapMs: -1 })).join()).toMatch(/gapMs/);
  });
  it('選択肢の誤り（choice と同じ検査）', () => {
    expect(checkListen(base({ options: [{ label: 'あ' }, { label: 'い' }] }))).toContain(
      '正解の選択肢が無い',
    );
    expect(
      checkListen(base({ options: [{ label: 'あ', correct: true }, { label: 'あ' }] })),
    ).toContain('同じ選択肢が重複している');
  });
});

describe('listen: 再生の列', () => {
  it('文から音声キーを作り、複数の音の間に無音をはさむ', () => {
    const seq = listenSeq({ audio: [{ text: 'た' }, { text: 'い' }] }, 'pk') as (string | number)[];
    expect(seq.length).toBe(3);
    expect(String(seq[0])).toMatch(/^pk\//);
    expect(seq[1]).toBe(DEFAULT_GAP_MS);
  });
  it('key はそのまま使う', () => {
    expect(listenSeq({ audio: { text: 'apple', key: 'en/apple' }, gapMs: 0 }, 'pk')).toEqual([
      'en/apple',
    ]);
  });
});

describe('listen: 画面', () => {
  const ctx: RenderCtx = {
    packId: 'pk',
    readAloud: 'always',
    furigana: 'unlearned',
    learnerGrade: 0,
    preschool: true,
    textScale: 1,
    ux: audienceUx('p4'),
  };
  beforeEach(() => {
    vi.useFakeTimers();
    h.resolvers.length = 0;
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('最初の再生が終わるまで選択肢を押せない。終わったら押せる', async () => {
    const submit = vi.fn();
    render(
      createElement(listenEngine.Component, {
        item: base(),
        ctx,
        revealed: false,
        wrongMark: null,
        disabled: false,
        submit,
      }),
    );
    expect((screen.getByTestId('opt-0') as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      vi.runAllTimers();
    });
    expect(h.resolvers.length).toBe(1);
    // もういちど きく は再生中でも押せる
    expect((screen.getByTestId('listen-button') as HTMLButtonElement).disabled).toBe(false);
    await act(async () => {
      h.resolvers[0]!('done');
    });
    expect((screen.getByTestId('opt-0') as HTMLButtonElement).disabled).toBe(false);
    act(() => screen.getByTestId('opt-1').click());
    expect(submit).toHaveBeenCalledWith([1]);
  });

  it('途中で止められた再生では押せるようにしない（もういちど きくで聞ける）', async () => {
    render(
      createElement(listenEngine.Component, {
        item: base(),
        ctx,
        revealed: false,
        wrongMark: null,
        disabled: false,
        submit: () => undefined,
      }),
    );
    await act(async () => {
      vi.runAllTimers();
    });
    await act(async () => {
      h.resolvers[0]!('stopped');
    });
    expect((screen.getByTestId('opt-0') as HTMLButtonElement).disabled).toBe(true);
    act(() => screen.getByTestId('listen-button').click());
    await act(async () => {
      h.resolvers[1]!('done');
    });
    expect((screen.getByTestId('opt-0') as HTMLButtonElement).disabled).toBe(false);
  });

  it('正答を見せるときは音声の文を出す', () => {
    render(
      createElement(listenEngine.Component, {
        item: base(),
        ctx,
        revealed: true,
        wrongMark: null,
        disabled: true,
        submit: () => undefined,
      }),
    );
    expect(screen.getByTestId('listen-transcript').textContent).toContain('いぬ');
  });
});
