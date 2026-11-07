import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * 保護者画面「このアプリについて」の「素材のクレジット」（公開の前の点検 P3・P4）。
 * 実行時に同梱する React・react-dom・scheduler（MIT）と、英語の音声（Kokoro）の表記が出ていること。
 * 全文は licenses/ にある（配布 zip に入る）ので、その名前の食い違いも見る。
 */
vi.mock('../core/offline/index', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../core/offline/index')>()),
  isPageControlled: () => true,
  useOfflineState: () => ({
    supported: true,
    status: 'ready',
    progress: null,
    updateReady: false,
    version: 'v1',
    error: null,
  }),
}));
vi.mock('../core/offline/updater', () => ({
  useUpdater: () => ({
    available: false,
    status: null,
    flow: 'none',
    flowError: null,
    swProgress: null,
    packs: null,
  }),
  requestApply: vi.fn(),
  requestCancel: vi.fn(),
  requestCheck: vi.fn(),
  setAutoCheck: vi.fn(),
  startUpdater: vi.fn(),
}));

const { AboutTab } = await import('./AboutTab');

afterEach(cleanup);

function creditRows(): Map<string, string> {
  const { getByTestId } = render(<AboutTab />);
  const rows = new Map<string, string>();
  for (const tr of Array.from(getByTestId('credits').querySelectorAll('tr'))) {
    rows.set(tr.querySelector('th')?.textContent ?? '', tr.querySelector('td')?.textContent ?? '');
  }
  return rows;
}

describe('素材のクレジット', () => {
  it('React・react-dom・scheduler（MIT）を出す', () => {
    const v = creditRows().get('プログラム');
    expect(v).toBeDefined();
    for (const name of [
      'React',
      'react-dom',
      'scheduler',
      'MIT',
      'Meta Platforms, Inc. and affiliates',
    ]) {
      expect(v).toContain(name);
    }
  });

  it('英語の音声（Kokoro-82M・kokoro-onnx）を出す', () => {
    const v = creditRows().get('英語の音声');
    expect(v).toBeDefined();
    for (const name of ['Kokoro-82M', 'Apache 2.0', 'kokoro-onnx', 'MIT']) {
      expect(v).toContain(name);
    }
  });

  it('これまでの表記（音声・フォント・書き順データ・イラスト）も残る', () => {
    const rows = creditRows();
    for (const k of ['音声', 'フォント', '書き順データ', 'イラスト']) {
      expect(rows.has(k)).toBe(true);
    }
  });

  it('licenses/ に、3つの部品の MIT の全文と著作権の行がある（配布 zip に入る）', () => {
    const text = readFileSync('licenses/MIT-React.txt', 'utf8');
    for (const name of ['react', 'react-dom', 'scheduler']) {
      expect(text).toContain(name);
    }
    expect(text).toContain('Copyright (c) Meta Platforms, Inc. and affiliates.');
    expect(text).toContain('Permission is hereby granted, free of charge');
    expect(text).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
  });
});
