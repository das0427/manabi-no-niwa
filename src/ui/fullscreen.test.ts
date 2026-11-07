import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  armStartFullscreen,
  fullscreenMode,
  isPageFullscreen,
  isWindowFullscreen,
  requestAppFullscreen,
  requestStartFullscreen,
} from './fullscreen';

type FakeWindow = Parameters<typeof isWindowFullscreen>[0];

/** 窓の大きさ・全画面の状態を偽物で作る */
function fakeWindow(opts: {
  pageFullscreen?: boolean;
  displayModeFullscreen?: boolean | 'throws' | 'missing';
  inner?: [number, number];
  screen?: [number, number] | null;
}): FakeWindow {
  const { pageFullscreen = false, displayModeFullscreen = false } = opts;
  const [iw, ih] = opts.inner ?? [1280, 720];
  const screenSize = opts.screen === undefined ? ([1920, 1080] as const) : opts.screen;
  const matchMedia =
    displayModeFullscreen === 'missing'
      ? undefined
      : (query: string) => {
          if (displayModeFullscreen === 'throws') throw new Error('matchMedia');
          return { matches: query === '(display-mode: fullscreen)' && displayModeFullscreen };
        };
  return {
    document: { fullscreenElement: pageFullscreen ? ({} as Element) : null },
    innerWidth: iw,
    innerHeight: ih,
    screen: screenSize ? { width: screenSize[0], height: screenSize[1] } : undefined,
    matchMedia,
  } as unknown as FakeWindow;
}

describe('isPageFullscreen', () => {
  it('fullscreenElement があれば true', () => {
    expect(isPageFullscreen({ fullscreenElement: {} as Element })).toBe(true);
    expect(isPageFullscreen({ fullscreenElement: null })).toBe(false);
  });
});

describe('isWindowFullscreen（ページの全画面ではないが、窓が全画面）', () => {
  it('display-mode: fullscreen が真', () => {
    expect(isWindowFullscreen(fakeWindow({ displayModeFullscreen: true }))).toBe(true);
  });

  it('窓の中身が画面と同じ大きさ（1px までの丸めは同じとみなす）', () => {
    expect(isWindowFullscreen(fakeWindow({ inner: [1920, 1080] }))).toBe(true);
    expect(isWindowFullscreen(fakeWindow({ inner: [1919, 1080] }))).toBe(true);
    expect(isWindowFullscreen(fakeWindow({ inner: [1920, 1079] }))).toBe(true);
  });

  it('タイトルバーやタスクバー分だけ小さい窓は全画面ではない', () => {
    expect(isWindowFullscreen(fakeWindow({ inner: [1920, 1000] }))).toBe(false);
    expect(isWindowFullscreen(fakeWindow({ inner: [1280, 720] }))).toBe(false);
  });

  it('ページの全画面のときは「窓の全画面」ではない（display-mode も真になるため）', () => {
    expect(
      isWindowFullscreen(fakeWindow({ pageFullscreen: true, displayModeFullscreen: true })),
    ).toBe(false);
  });

  it('matchMedia が無い・投げるときは大きさの比べに進む', () => {
    expect(isWindowFullscreen(fakeWindow({ displayModeFullscreen: 'missing' }))).toBe(false);
    expect(
      isWindowFullscreen(fakeWindow({ displayModeFullscreen: 'missing', inner: [1920, 1080] })),
    ).toBe(true);
    expect(isWindowFullscreen(fakeWindow({ displayModeFullscreen: 'throws' }))).toBe(false);
  });

  it('画面の大きさが分からない・窓の大きさが 0 のときは false', () => {
    expect(isWindowFullscreen(fakeWindow({ screen: null }))).toBe(false);
    expect(isWindowFullscreen(fakeWindow({ inner: [0, 0], screen: [0, 0] }))).toBe(false);
  });
});

describe('fullscreenMode', () => {
  it('3つの状態を分ける', () => {
    expect(fullscreenMode(fakeWindow({ pageFullscreen: true }))).toBe('page');
    expect(fullscreenMode(fakeWindow({ displayModeFullscreen: true }))).toBe('window');
    expect(fullscreenMode(fakeWindow({}))).toBe('none');
  });
});

describe('requestAppFullscreen', () => {
  it('documentElement.requestFullscreen を呼び、成功なら true', async () => {
    const requestFullscreen = vi.fn(() => Promise.resolve());
    const ok = await requestAppFullscreen({ documentElement: { requestFullscreen } as never });
    expect(ok).toBe(true);
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('拒まれても例外にしない（false）', async () => {
    const requestFullscreen = vi.fn(() => Promise.reject(new TypeError('not allowed')));
    expect(await requestAppFullscreen({ documentElement: { requestFullscreen } as never })).toBe(
      false,
    );
  });

  it('同期の例外も飲み込む', async () => {
    const requestFullscreen = vi.fn(() => {
      throw new Error('boom');
    });
    expect(await requestAppFullscreen({ documentElement: { requestFullscreen } as never })).toBe(
      false,
    );
  });

  it('全画面の API が無いブラウザでは false', async () => {
    expect(await requestAppFullscreen({ documentElement: {} as never })).toBe(false);
  });
});

describe('requestStartFullscreen（引き継ぎで始まった画面の最初の「はじめる」）', () => {
  afterEach(() => {
    armStartFullscreen(false);
    vi.restoreAllMocks();
  });

  it('armStartFullscreen(true) のあとの1回だけ全画面にする', () => {
    const spy = vi.fn(() => Promise.resolve());
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      value: spy,
      configurable: true,
    });
    armStartFullscreen(true);
    expect(requestStartFullscreen()).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(requestStartFullscreen()).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('ふつうの起動（armStartFullscreen(false)）では呼ばない', () => {
    const spy = vi.fn(() => Promise.resolve());
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      value: spy,
      configurable: true,
    });
    armStartFullscreen(false);
    expect(requestStartFullscreen()).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('全画面を拒まれても、例外は出ない', async () => {
    const spy = vi.fn(() => Promise.reject(new TypeError('denied')));
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      value: spy,
      configurable: true,
    });
    armStartFullscreen(true);
    expect(() => requestStartFullscreen()).not.toThrow();
    await Promise.resolve();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
