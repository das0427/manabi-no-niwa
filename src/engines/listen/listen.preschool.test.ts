import { act, cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audienceUx } from '../../audience/audience';
import { audio } from '../../core/audio/index';
import type { RenderCtx } from '../types';
import { checkListen, listenEngine, type ListenItem } from './listen';

/**
 * 幼児の英語のための listen の拡張（nameBack・replay・revealAudio。docs/expansion/p2-design/preschool-english.md 4章）。
 * 拡張を使わない問題の動きは listen.test.ts が受け持つ。
 */
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

const dog = { text: 'Dog.', key: 'en/en-pre.word.dog' };
const cat = { text: 'Cat.', key: 'en/en-pre.word.cat' };

const base = (over: Partial<ListenItem> = {}): ListenItem => ({
  id: 't',
  engine: 'listen',
  objective: 'o',
  level: 0,
  prompt: 'えいごを きいてね。どれかな？',
  audio: [dog, dog],
  gapMs: 700,
  hideTranscript: true,
  nameBack: true,
  options: [
    { label: 'いぬ', correct: true, sound: dog },
    { label: 'ねこ', misconception: 'm1', sound: cat },
  ],
  hints: ['a', 'b'],
  explain: 'e',
  identity: 'k',
  ...over,
});

describe('listen の拡張: 検査', () => {
  it('正しい nameBack は誤りなし', () => {
    expect(checkListen(base())).toEqual([]);
  });
  it('sound の無い選択肢はエラー', () => {
    const it1 = base({
      options: [{ label: 'いぬ', correct: true, sound: dog }, { label: 'ねこ' }],
    });
    expect(checkListen(it1).join()).toMatch(/sound が無い/);
  });
  it('multi と併用できない', () => {
    expect(checkListen(base({ multi: true })).join()).toMatch(/multi/);
  });
  it('英字の sound に key が無いとエラー・使えない key もエラー', () => {
    const noKey = base({
      options: [
        { label: 'いぬ', correct: true, sound: { text: 'Dog.' } },
        { label: 'ねこ', sound: cat },
      ],
    });
    expect(checkListen(noKey).join()).toMatch(/key/);
    const badKey = base({
      options: [
        { label: 'いぬ', correct: true, sound: { text: 'Dog.', key: 'EN/Dog' } },
        { label: 'ねこ', sound: cat },
      ],
    });
    expect(checkListen(badKey).join()).toMatch(/使えない文字/);
  });
  it('revealAudio: 英字で key の無い音声はエラー。日本語の文は key なしでよい', () => {
    expect(checkListen(base({ revealAudio: [{ text: 'Dog.' }] })).join()).toMatch(/key/);
    expect(
      checkListen(base({ revealAudio: [{ text: 'いっしょに やって みよう。' }, dog] })),
    ).toEqual([]);
  });
  it('nameBack でない問題は sound が無くてよい', () => {
    expect(
      checkListen(
        base({
          nameBack: undefined,
          options: [{ label: 'いぬ', correct: true }, { label: 'ねこ' }],
        }),
      ),
    ).toEqual([]);
  });
});

describe('listen の拡張: 画面', () => {
  const ctx: RenderCtx = {
    packId: 'pk',
    readAloud: 'always',
    furigana: 'unlearned',
    learnerGrade: 0,
    preschool: true,
    textScale: 1,
    ux: audienceUx('p4'),
  };
  const props = (it: ListenItem, over: Record<string, unknown> = {}) => ({
    item: it,
    ctx,
    revealed: false,
    wrongMark: null,
    disabled: false,
    submit: () => undefined,
    ...over,
  });
  const playMock = vi.mocked(audio.play);

  beforeEach(() => {
    vi.useFakeTimers();
    h.resolvers.length = 0;
    h.state.unlocked = true;
    playMock.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    h.state.unlocked = true;
  });

  /** 最初の再生が終わって、選択肢を押せる状態にする */
  async function heardFirst() {
    await act(async () => {
      vi.runAllTimers();
    });
    await act(async () => {
      h.resolvers[0]!('done');
    });
  }

  it('nameBack: 触ると名前を鳴らし、鳴り終わってから1回だけ答える。再生中は他を押せない', async () => {
    const submit = vi.fn();
    render(createElement(listenEngine.Component, props(base(), { submit })));
    await heardFirst();
    expect(h.resolvers.length).toBe(1);
    act(() => screen.getByTestId('opt-1').click());
    // 名前（Cat.）が鳴り始めた。まだ答えていない。押した選択肢は選択中の見た目
    expect(h.resolvers.length).toBe(2);
    expect(playMock.mock.calls[1]![0]).toEqual(['en/en-pre.word.cat']);
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByTestId('opt-1').className).toMatch(/selected/);
    // 再生中に別の選択肢を押しても何も起きない
    expect((screen.getByTestId('opt-0') as HTMLButtonElement).disabled).toBe(true);
    act(() => screen.getByTestId('opt-0').click());
    expect(h.resolvers.length).toBe(2);
    await act(async () => {
      h.resolvers[1]!('done');
    });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith([1]);
  });

  it('nameBack: 音が出ない環境では 1500ms 以内に答える', async () => {
    h.state.unlocked = false;
    const submit = vi.fn();
    render(createElement(listenEngine.Component, props(base(), { submit })));
    await act(async () => {
      vi.runOnlyPendingTimers();
    });
    // 音が出せないので、最初の再生が終わらなくても押せる
    await act(async () => {
      h.resolvers[0]!('stopped');
    });
    act(() => screen.getByTestId('opt-0').click());
    expect(submit).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith([0]);
  });

  it('nameBack でない問題は、触るとすぐ答える（今までどおり）', async () => {
    const submit = vi.fn();
    render(createElement(listenEngine.Component, props(base({ nameBack: undefined }), { submit })));
    await heardFirst();
    act(() => screen.getByTestId('opt-1').click());
    expect(submit).toHaveBeenCalledWith([1]);
    expect(h.resolvers.length).toBe(1);
  });

  it('replay.afterWrong: 不正解の印が付くと問題の音声をもう一度鳴らす（同じ変化で2回鳴らさない）', async () => {
    const it1 = base({ replay: { afterWrong: true, onHint: true } });
    const view = render(createElement(listenEngine.Component, props(it1)));
    await heardFirst();
    expect(h.resolvers.length).toBe(1);
    // 不正解は同時にヒントの段も進める（実行枠の流れ）が、同じ変化で2回は鳴らさない
    view.rerender(
      createElement(listenEngine.Component, props(it1, { wrongMark: [1], hintsShown: 1 })),
    );
    await act(async () => {
      vi.runAllTimers();
    });
    expect(h.resolvers.length).toBe(2);
  });

  it('replay.onHint: ヒントの段が増えると鳴らす', async () => {
    const it1 = base({ replay: { onHint: true } });
    const view = render(createElement(listenEngine.Component, props(it1)));
    await heardFirst();
    view.rerender(createElement(listenEngine.Component, props(it1, { hintsShown: 1 })));
    await act(async () => {
      vi.runAllTimers();
    });
    expect(h.resolvers.length).toBe(2);
  });

  it('replay が無い問題は、不正解でもヒントでも鳴らし直さない', async () => {
    const it1 = base();
    const view = render(createElement(listenEngine.Component, props(it1)));
    await heardFirst();
    view.rerender(
      createElement(listenEngine.Component, props(it1, { wrongMark: [1], hintsShown: 1 })),
    );
    await act(async () => {
      vi.runAllTimers();
    });
    expect(h.resolvers.length).toBe(1);
  });

  it('revealAudio: 答えを見せるとき1回だけ鳴らす（再レンダーで鳴らし直さない）', async () => {
    const it1 = base({ revealAudio: [{ text: 'いっしょに やって みよう。' }, dog] });
    const view = render(createElement(listenEngine.Component, props(it1)));
    await heardFirst();
    expect(h.resolvers.length).toBe(1);
    view.rerender(createElement(listenEngine.Component, props(it1, { revealed: true })));
    await act(async () => {
      vi.runAllTimers();
    });
    expect(h.resolvers.length).toBe(2);
    view.rerender(createElement(listenEngine.Component, props(it1, { revealed: true })));
    await act(async () => {
      vi.runAllTimers();
    });
    expect(h.resolvers.length).toBe(2);
    // 日本語の文のあと間（gapMs）をおいて英語の key が鳴る
    const seq = playMock.mock.calls[1]![0] as (string | number)[];
    expect(seq[seq.length - 1]).toBe('en/en-pre.word.dog');
    expect(seq).toContain(700);
  });
});
