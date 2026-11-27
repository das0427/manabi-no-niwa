import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PackStatus } from '../core/offline/packs';

const mocks = vi.hoisted(() => ({
  statuses: [] as PackStatus[],
  deletePack: vi.fn(async () => undefined),
  downloadPack: vi.fn(async () => undefined),
  redownloadOutdated: vi.fn(async () => []),
}));

vi.mock('../packs/loader', () => ({
  listPackStatus: async () => mocks.statuses,
  deletePack: mocks.deletePack,
  downloadPack: mocks.downloadPack,
  redownloadOutdated: mocks.redownloadOutdated,
}));

const { PacksTab, packLabel } = await import('./PacksTab');

const st = (packId: string, state: PackStatus['state']): PackStatus => ({
  packId,
  state,
  bytes: 2 * 1024 * 1024,
  fileCount: 3,
  hash: 'h',
  downloaded:
    state === 'ready' || state === 'outdated'
      ? { packId, hash: 'h0', bytes: 2 * 1024 * 1024, fileCount: 3, downloadedAt: 1 }
      : null,
});

beforeEach(() => {
  mocks.deletePack.mockClear();
  mocks.downloadPack.mockClear();
  mocks.redownloadOutdated.mockClear();
});
afterEach(cleanup);

async function renderTab(statuses: PackStatus[]): Promise<void> {
  mocks.statuses = statuses;
  await act(async () => {
    render(<PacksTab />);
  });
  await screen.findByTestId('packs-total');
}

describe('PacksTab（きょうざい）', () => {
  it('一覧・大きさ・状態。バージョンが古いものがあれば一括再取得の札', async () => {
    await renderTab([
      st('g1-math', 'ready'),
      st('g3-kokugo', 'outdated'),
      st('kanji-g12', 'not-downloaded'),
      st('p4', 'core'),
    ]);
    expect(screen.getByTestId('pack-row-g1-math').textContent).toContain('小1 算数');
    expect(screen.getByTestId('pack-row-g1-math').textContent).toContain('2.0 MB');
    expect(screen.getByTestId('pack-state-g1-math').textContent).toContain('取得済み');
    expect(screen.getByTestId('pack-state-g3-kokugo').textContent).toContain('バージョンが古い');
    expect(screen.getByTestId('pack-state-kanji-g12').textContent).toBe('未取得');
    expect(screen.getByTestId('packs-core').textContent).toContain('4歳');
    expect(screen.queryByTestId('pack-row-p4')).toBeNull();

    fireEvent.click(screen.getByTestId('packs-redownload-all'));
    expect(mocks.redownloadOutdated).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('pack-download-kanji-g12'));
    expect(mocks.downloadPack).toHaveBeenCalledWith('kanji-g12');
  });

  it('幼児の英語は見出しを分け、一覧を読めないときも小学生の表に入らない', async () => {
    await renderTab([st('en-pre', 'unavailable'), st('p4', 'unavailable'), st('en-g34', 'ready')]);
    expect(screen.getByTestId('packs-core-en').textContent).toContain('幼児の英語');
    expect(screen.queryByTestId('pack-row-en-pre')).toBeNull();
    expect(screen.queryByTestId('pack-row-p4')).toBeNull();
    expect(screen.getByTestId('pack-row-en-g34').textContent).toContain('英語（小3・小4）');
  });

  it('削除は確認のあとで、記録は消えないと説明する', async () => {
    await renderTab([st('g1-math', 'ready')]);
    expect(screen.queryByTestId('packs-outdated')).toBeNull();
    fireEvent.click(screen.getByTestId('pack-delete-g1-math'));
    expect(screen.getByTestId('confirm-dialog').textContent).toContain('学習の記録は消えません');
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-ok'));
    });
    expect(mocks.deletePack).toHaveBeenCalledWith('g1-math');
    expect(screen.getByTestId('packs-message').textContent).toContain('学習の記録は残っています');
  });

  it('packLabel', () => {
    expect(packLabel('g3-sansu')).toBe('小3 算数');
    expect(packLabel('kanji-g12')).toBe('漢字（小1・小2）');
    expect(packLabel('_sample-a')).toBe('見本 A（テスト用）');
    expect(packLabel('g1-ja')).toBe('小1 国語');
    expect(packLabel('g6-math')).toBe('小6 算数');
    expect(packLabel('en-g34')).toBe('英語（小3・小4）');
    expect(packLabel('en-g56')).toBe('英語（小5・小6）');
    expect(packLabel('life-g12')).toBe('生活（小1・小2）');
    expect(packLabel('prog-g16')).toBe('プログラミング（小1〜小6）');
    expect(packLabel('sci-g34')).toBe('理科（小3・小4）');
    expect(packLabel('soc-g56')).toBe('社会（小5・小6）');
    expect(packLabel('en-pre')).toBe('幼児の英語');
    expect(packLabel('zz')).toBe('zz');
  });
});
