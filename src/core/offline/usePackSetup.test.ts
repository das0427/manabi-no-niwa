import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PackDownloadFailure, PackStatus } from './packs';

/** usePackSetup（起動画面の初回準備の2段目）の流れ。packs.ts と本体の準備は差し替える（架空のパック） */
const m = vi.hoisted(() => ({
  statuses: [] as PackStatus[],
  failures: [] as { packId: string; reason: PackDownloadFailure }[],
  downloaded: [] as string[][],
}));

vi.mock('./index', () => ({
  useOfflineState: () => ({ status: 'ready', progress: null }),
}));

vi.mock('./packs', () => ({
  computePackStatuses: vi.fn(() => Promise.resolve(m.statuses)),
  downloadPackList: vi.fn((ids: string[]) => {
    m.downloaded.push([...ids]);
    return Promise.resolve(m.failures);
  }),
  getPackProgress: () => null,
  getPacksSeq: () => 0,
  subscribePacks: () => () => undefined,
}));

const { setupView, usePackSetup } = await import('./setup');

const st = (packId: string, state: PackStatus['state']): PackStatus => ({
  packId,
  state,
  bytes: 100,
  fileCount: 1,
  hash: state === 'unavailable' ? null : `h-${packId}`,
  downloaded: null,
});

const setOnLine = (v: boolean): void => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => v });
};

beforeEach(() => {
  m.statuses = [];
  m.failures = [];
  m.downloaded = [];
  setOnLine(true);
});

afterEach(() => {
  cleanup();
  setOnLine(true);
});

describe('usePackSetup', () => {
  it('未取得と版の古いパックだけを取得する（そろったものは取らない）', async () => {
    m.statuses = [st('g3-math', 'not-downloaded'), st('g3-ja', 'outdated'), st('en-g34', 'ready')];
    const { result } = renderHook(() => usePackSetup(['en-g34', 'g3-ja', 'g3-math']));
    await waitFor(() => expect(m.downloaded).toEqual([['g3-ja', 'g3-math']]));
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(result.current.outdated).toEqual(['g3-ja']);
    expect(setupView(result.current)).toEqual({ kind: 'preparing', percent: 0, renewing: true });
  });

  it('オフラインで失敗したら止まり、つながったら（online）自動で取り直す', async () => {
    m.statuses = [st('g3-math', 'not-downloaded')];
    m.failures = [{ packId: 'g3-math', reason: 'offline' }];
    const { result } = renderHook(() => usePackSetup(['g3-math']));
    await waitFor(() =>
      expect(setupView(result.current)).toEqual({ kind: 'failed', offline: true }),
    );
    expect(m.downloaded).toHaveLength(1);

    m.failures = [];
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(m.downloaded).toHaveLength(2));
    await waitFor(() => expect(setupView(result.current).kind).toBe('preparing'));
  });

  it('つながっていないため一覧（packs.json）を読めないときもオフラインの案内にし、つながったら読み直す', async () => {
    setOnLine(false);
    m.statuses = [st('g3-math', 'unavailable')];
    const { result } = renderHook(() => usePackSetup(['g3-math']));
    await waitFor(() =>
      expect(setupView(result.current)).toEqual({ kind: 'failed', offline: true }),
    );
    expect(m.downloaded).toHaveLength(0);

    m.statuses = [st('g3-math', 'not-downloaded')];
    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(m.downloaded).toEqual([['g3-math']]));
  });

  it('つながっていて一覧を読めないときは、おうちの ひとへの案内（自動では取り直さない）', async () => {
    m.statuses = [st('g3-math', 'unavailable')];
    const { result } = renderHook(() => usePackSetup(['g3-math']));
    await waitFor(() =>
      expect(setupView(result.current)).toEqual({ kind: 'failed', offline: false }),
    );
    expect(result.current.failures).toEqual([{ packId: 'g3-math', reason: 'unavailable' }]);
  });

  it('retry で失敗を消して取り直す', async () => {
    m.statuses = [st('g3-math', 'not-downloaded')];
    m.failures = [{ packId: 'g3-math', reason: 'quota' }];
    const { result } = renderHook(() => usePackSetup(['g3-math']));
    await waitFor(() => expect(setupView(result.current).kind).toBe('failed'));
    m.failures = [];
    act(() => result.current.retry());
    await waitFor(() => expect(m.downloaded).toHaveLength(2));
    await waitFor(() => expect(setupView(result.current).kind).toBe('preparing'));
  });

  it('既定パックが無い（幼児だけ）ときは何も取得せず、すぐ準備完了', async () => {
    const { result } = renderHook(() => usePackSetup([]));
    expect(result.current.stage).toBe('ready');
    await Promise.resolve();
    expect(m.downloaded).toHaveLength(0);
  });
});
