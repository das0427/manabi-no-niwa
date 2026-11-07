import { cleanup, render, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SetupState } from '../core/offline/setup';

/**
 * 起動画面の保護者向けの「オフライン」の文と、保護者画面「このアプリについて」の文が食い違わない（FX13）。
 * 準備ができても、ページがまだ Service Worker に制御されていない（初めて開いた画面。開き直す前）間は、
 * どちらも「いちど開き直すと使えます」と案内する。
 */
const m = vi.hoisted(() => ({ controlled: false }));

vi.mock('../core/offline/index', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../core/offline/index')>()),
  isPageControlled: () => m.controlled,
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

const { AppStateProvider } = await import('./AppState');
const { StartScreen } = await import('./StartScreen');
const { OFFLINE_REOPEN_NOTE, setupParentNote } = await import('./PackSetupStatus');
const { AboutTab } = await import('../parent/AboutTab');

const ready: SetupState = {
  stage: 'ready',
  progress: null,
  missing: [],
  outdated: [],
  failures: [],
  downloading: false,
  checking: false,
  unsupported: false,
};

beforeEach(() => {
  m.controlled = false;
});
afterEach(cleanup);

/** 起動画面の保護者向けの表示（offline-status）の文 */
async function startNote(): Promise<string> {
  const { container } = render(
    <AppStateProvider>
      <StartScreen />
    </AppStateProvider>,
  );
  const el = await within(container).findByTestId('offline-status');
  return el.textContent ?? '';
}

function aboutNote(): string {
  const { container } = render(<AboutTab />);
  return within(container).getByTestId('offline-status').textContent ?? '';
}

/** 「いま、オフラインで使える」と言い切っている文か（開き直しの案内がある文は言い切りではない） */
const claimsUsable = (t: string): boolean => /つかえます|使えます/.test(t) && !/開き直/.test(t);

describe('setupParentNote（開き直す前かどうか）', () => {
  it('準備ができても、開き直す前は「使えます」と言い切らず、開き直しを案内する', () => {
    expect(setupParentNote(ready, false)).toBe(OFFLINE_REOPEN_NOTE);
    expect(OFFLINE_REOPEN_NOTE).toContain('開き直す');
    expect(OFFLINE_REOPEN_NOTE).not.toContain('つかえます');
    expect(claimsUsable(OFFLINE_REOPEN_NOTE)).toBe(false);
  });

  it('開き直したあと（制御されている）は「オフラインで使えます」', () => {
    expect(setupParentNote(ready, true)).toBe('オフラインで使えます');
    // 引数を省いたときも同じ（開き直したあと）
    expect(setupParentNote(ready)).toBe('オフラインで使えます');
  });

  it('準備中・失敗・使えない環境の文は、開き直す前かどうかで変わらない', () => {
    const core: SetupState = { ...ready, stage: 'core', progress: { done: 1, total: 4 } };
    expect(setupParentNote(core, false)).toBe(setupParentNote(core, true));
    expect(setupParentNote({ ...ready, stage: 'error' }, false)).toContain('失敗');
    expect(setupParentNote({ ...ready, unsupported: true }, false)).toBeNull();
  });
});

describe('起動画面と「このアプリについて」の食い違い', () => {
  it('開き直す前: どちらも同じ文で、まだ使えるとは言わない', async () => {
    m.controlled = false;
    const start = await startNote();
    expect(start).toBe(OFFLINE_REOPEN_NOTE);
    const about = aboutNote();
    expect(about).toBe(OFFLINE_REOPEN_NOTE);
    expect(claimsUsable(start)).toBe(false);
    expect(claimsUsable(start)).toBe(claimsUsable(about));
  });

  it('開き直したあと: どちらも使えると言う', async () => {
    m.controlled = true;
    const start = await startNote();
    await waitFor(() => expect(start).toBe('オフラインで使えます'));
    const about = aboutNote();
    expect(about).toBe('オフラインで使えます');
    expect(claimsUsable(start)).toBe(true);
    expect(claimsUsable(start)).toBe(claimsUsable(about));
  });
});
