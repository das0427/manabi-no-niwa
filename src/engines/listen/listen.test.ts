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
  transcriptSep,
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

  it('書き起こしは作業領域の幅の段で、スクロールの枠（data-scroll-region）として出る（R3）', () => {
    const { container } = render(
      createElement(listenEngine.Component, {
        item: base(),
        ctx,
        revealed: true,
        wrongMark: null,
        disabled: true,
        submit: () => undefined,
      }),
    );
    const box = screen.getByTestId('listen-transcript');
    expect(box.getAttribute('data-scroll-region')).toBe('transcript');
    // 「きく」の札の下の細い列に入れず、選択肢の上の段（札の隣）に置く
    const root = container.querySelector('.eng-listen')!;
    expect(box.closest('.eng-listen__ear')).toBeNull();
    const head = box.closest('.eng-listen__head');
    expect(head?.parentElement).toBe(root);
    expect(head?.querySelector('.eng-listen__ear')).not.toBeNull();
  });

  it('選択肢に絵があるときは「きく」の札を上の段に置く印（eng-listen--pics）を付ける（R3）', () => {
    const fig = (n: number) => ({ kind: 'illust' as const, id: 'cat', count: n });
    const { container } = render(
      createElement(listenEngine.Component, {
        item: base({
          options: [{ figure: fig(1), correct: true }, { figure: fig(2) }, { figure: fig(3) }],
        }),
        ctx,
        revealed: false,
        wrongMark: null,
        disabled: false,
        submit: () => undefined,
      }),
    );
    expect(container.querySelector('.eng-listen--pics')).not.toBeNull();
    const list = container.querySelector('.eng-opts__list') as HTMLElement;
    expect(list.className).toContain('is-pics');
    expect(list.style.getPropertyValue('--pics-n')).toBe('3');
    expect(list.style.getPropertyValue('--pics-total')).toBe('6');
  });

  it('語のラベルには data-word と --len を付け、文のラベルには付けない（V2 1）', () => {
    const { container } = render(
      createElement(listenEngine.Component, {
        item: base({
          options: [
            { label: 'じてんしゃ', correct: true },
            { label: 'つくえの 中' },
            { label: 'はな（くさばな）' },
            { label: 'いろえんぴつ' },
          ],
        }),
        ctx,
        revealed: false,
        wrongMark: null,
        disabled: false,
        submit: () => undefined,
      }),
    );
    const cards = [...container.querySelectorAll<HTMLElement>('.eng-opts__opt')];
    expect(cards).toHaveLength(4);
    const word = (i: number) => cards[i]!.querySelector('[data-word]');
    expect(word(0)?.getAttribute('data-word')).toBe('word');
    expect(cards[0]!.style.getPropertyValue('--len')).toBe('5');
    expect(cards[0]!.className).toContain('has-word');
    expect(word(1)?.getAttribute('data-word')).toBe('phrase');
    expect(cards[1]!.style.getPropertyValue('--len')).toBe('6');
    // 括弧の中は nowrap の span（括弧の前でだけ折る）
    expect(word(2)?.getAttribute('data-word')).toBe('paren');
    expect(word(2)?.querySelector('.opt-nobr')?.textContent).toBe('（くさばな）');
    expect(word(3)?.getAttribute('data-word')).toBe('word');
  });

  it('12字を超える文があるときは、語のラベルにも data-word を付けず今までどおり折り返す（V2 1）', () => {
    const { container } = render(
      createElement(listenEngine.Component, {
        item: base({
          options: [
            { label: 'いぬ', correct: true },
            { label: 'これは ながい ぶんしょうの せんたくしです' },
          ],
        }),
        ctx,
        revealed: false,
        wrongMark: null,
        disabled: false,
        submit: () => undefined,
      }),
    );
    expect(container.querySelector('[data-word]')).toBeNull();
    expect(container.querySelector('.has-word')).toBeNull();
    expect(container.querySelector('.eng-opts__list')?.hasAttribute('data-long')).toBe(true);
  });

  it('文字だけの4つで9字以下は横1行の印（data-row4）を付け、9字の語も語として扱う（V2 3）', () => {
    const { container } = render(
      createElement(listenEngine.Component, {
        item: base({
          options: [
            { label: '北アメリカ大陸', correct: true },
            { label: 'アフリカ大陸' },
            { label: 'ユーラシア大陸' },
            { label: 'オーストラリア大陸' },
          ],
        }),
        ctx,
        revealed: false,
        wrongMark: null,
        disabled: false,
        submit: () => undefined,
      }),
    );
    const list = container.querySelector('.eng-opts__list') as HTMLElement;
    expect(list.hasAttribute('data-row4')).toBe(true);
    const last = container.querySelectorAll<HTMLElement>('.eng-opts__opt')[3]!;
    expect(last.querySelector('[data-word]')?.getAttribute('data-word')).toBe('word');
    expect(last.style.getPropertyValue('--len')).toBe('9');
  });

  it('「きく」の札は「きいてね」と「もういちど きく」を重ねて置き、再生の前後で幅が変わらない（第8回 Y1 の 1.）', async () => {
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
    const lines = () =>
      Array.from(
        screen.getByTestId('listen-button').querySelectorAll<HTMLElement>('.eng-listen__ear-line'),
      );
    // 2 つの文が同じ札の中にいつもある（長いほうの幅をはじめから取る）。見えるのは 1 つ、もう 1 つは支援技術にも渡さない
    expect(lines().map((l) => l.textContent)).toEqual(['きいてね', 'もういちど きく']);
    expect(lines().map((l) => l.hasAttribute('data-on'))).toEqual([true, false]);
    expect(lines().map((l) => l.getAttribute('aria-hidden'))).toEqual([null, 'true']);
    // 最初の再生が終わると、見える文が替わる（2 つとも残る）
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5);
    });
    await act(async () => {
      h.resolvers[0]?.('done');
      await Promise.resolve();
    });
    expect(lines().map((l) => l.textContent)).toEqual(['きいてね', 'もういちど きく']);
    expect(lines().map((l) => l.hasAttribute('data-on'))).toEqual([false, true]);
    expect(lines().map((l) => l.getAttribute('aria-hidden'))).toEqual(['true', null]);
  });

  it('書き起こしの区切り: 文の終わりの記号の後は「・」を置かず、語の並びは「・」（第8回 Y1 の 6.）', () => {
    // 日本語の文（。！？）の後は何も置かない／英語の文（.!?）の後は空白／閉じ括弧が付いても同じ／語どうしは「・」
    expect(transcriptSep('ぶたが いました。')).toBe('');
    expect(transcriptSep('すごい！')).toBe('');
    expect(transcriptSep('なあに？ ')).toBe('');
    expect(transcriptSep('「いました。」')).toBe('');
    expect(transcriptSep('How are you?')).toBe(' ');
    expect(transcriptSep('I am fine.')).toBe(' ');
    expect(transcriptSep('Wow!')).toBe(' ');
    expect(transcriptSep('"Hello."')).toBe(' ');
    expect(transcriptSep('さる')).toBe('・');
    expect(transcriptSep('apple')).toBe('・');
    expect(transcriptSep('かんじ、')).toBe('・');
    const transcriptOf = (sounds: { text: string; key?: string }[]) => {
      render(
        createElement(listenEngine.Component, {
          item: base({ audio: sounds }),
          ctx,
          revealed: true,
          wrongMark: null,
          disabled: true,
          submit: () => undefined,
        }),
      );
      const t = screen.getByTestId('listen-transcript').textContent;
      cleanup();
      return t;
    };
    expect(transcriptOf([{ text: 'いぬが いました。' }, { text: 'まいにち あそびます。' }])).toBe(
      'いぬが いました。まいにち あそびます。',
    );
    expect(transcriptOf([{ text: 'さる' }, { text: 'いぬ' }, { text: 'とり' }])).toBe(
      'さる・いぬ・とり',
    );
    expect(
      transcriptOf([
        { text: 'How are you?', key: 'k/a' },
        { text: "I'm fine.", key: 'k/b' },
      ]),
    ).toBe("How are you? I'm fine.");
  });

  it('絵・図の選択肢と並べる解説は書き起こしを 2 行まで、ほかは 3 行まで（第8回 Y1 の 3.）', () => {
    const fig = { kind: 'illust' as const, id: 'cat' };
    const linesOf = (item: ListenItem) => {
      const { container } = render(
        createElement(listenEngine.Component, {
          item,
          ctx,
          revealed: true,
          wrongMark: null,
          disabled: true,
          submit: () => undefined,
        }),
      );
      const wrap = container.querySelector<HTMLElement>('.eng-listen__transcript-wrap')!;
      const n = wrap.style.getPropertyValue('--tr-lines');
      cleanup();
      return n;
    };
    expect(linesOf(base())).toBe('3');
    expect(
      linesOf(
        base({
          options: [
            { figure: fig, label: 'ねこ', correct: true },
            { figure: { ...fig, id: 'dog' }, label: 'いぬ' },
          ],
        }),
      ),
    ).toBe('2');
    // 「きく」の札を左に置く図の選択肢（絵が 3 つ以下で 1 つに 1 つずつ）も 2 行まで
    expect(
      linesOf(
        base({
          options: [
            { figure: { kind: 'illust', id: 'cat' }, label: 'ねこ', correct: true },
            { figure: { kind: 'illust', id: 'dog' }, label: 'いぬ' },
            { figure: { kind: 'illust', id: 'bird' }, label: 'とり' },
          ],
        }),
      ),
    ).toBe('2');
  });
});
