import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** 保護者画面の入口: ほかのページの枠（iframe）の中では開かない（クリックジャッキング） */
const m = vi.hoisted(() => ({ framed: false }));
vi.mock('../core/framed', () => ({ isFramed: () => m.framed }));
vi.mock('../core/storage/index', () => ({
  getAppRecord: () => Promise.resolve({ parentPinHash: null }),
}));
vi.mock('./AppState', () => ({ useApp: () => ({ setParentUnlocked: vi.fn() }) }));

const { ParentGateButton } = await import('./ParentGate');

beforeEach(() => {
  vi.useFakeTimers();
  m.framed = false;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function holdKey(): Promise<void> {
  fireEvent.pointerDown(screen.getByTestId('parent-key'));
  await act(async () => {
    vi.advanceTimersByTime(2100);
    await Promise.resolve();
  });
}

describe('ParentGateButton', () => {
  it('2 秒の長押しで確認の画面が開く', async () => {
    render(<ParentGateButton />);
    await holdKey();
    expect(screen.getByTestId('parent-gate')).toBeTruthy();
  });

  it('ほかのページの枠の中では、長押ししても開かない', async () => {
    m.framed = true;
    render(<ParentGateButton />);
    await holdKey();
    expect(screen.queryByTestId('parent-gate')).toBeNull();
    expect(screen.getByTestId('parent-key').className).not.toContain('gate-key--holding');
  });
});
