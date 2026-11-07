import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 保護者ゲートのキーボード操作（FX11）: 数字（テンキーも）・Backspace・Enter・Esc、Tab の回り方。
 * ボタンを押す操作と同じ道を通ること、ボタンにフォーカスがあっても Enter でそのボタンを押したことにならないことを見る。
 */
const m = vi.hoisted(() => ({
  pinHash: null as string | null,
  unlocked: vi.fn(),
}));
vi.mock('../core/framed', () => ({ isFramed: () => false }));
vi.mock('../core/storage/index', () => ({
  getAppRecord: () => Promise.resolve({ parentPinHash: m.pinHash }),
}));
vi.mock('./AppState', () => ({ useApp: () => ({ setParentUnlocked: m.unlocked }) }));
// 暗証番号の照合は、保存した文字列と同じ数字かどうかだけにする（SHA-256 は jsdom では使わない）
vi.mock('./pin', () => ({
  checkPin: (pin: string, stored: string) => Promise.resolve(pin === stored),
}));

const { ParentGateButton } = await import('./ParentGate');

beforeEach(() => {
  vi.useFakeTimers();
  m.pinHash = null;
  m.unlocked.mockClear();
  location.hash = '#/home';
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function openGate(): Promise<void> {
  render(<ParentGateButton />);
  fireEvent.pointerDown(screen.getByTestId('parent-key'));
  await act(async () => {
    vi.advanceTimersByTime(2100);
    await Promise.resolve();
  });
  expect(screen.getByTestId('parent-gate')).toBeTruthy();
}

const typed = () => document.querySelector('.gate-input')?.textContent?.trim() ?? '';
const key = (k: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(window, { key: k, ...init });

/** 計算問題「a ＋ b は？」の答え */
function answer(): string {
  const t = screen.getByTestId('gate-question').textContent ?? '';
  const mm = /(\d+)\s*＋\s*(\d+)/.exec(t);
  expect(mm).not.toBeNull();
  return String(Number(mm![1]) + Number(mm![2]));
}

describe('保護者ゲートのキーボード', () => {
  it('数字で答えを入れ、Enter で開く', async () => {
    await openGate();
    for (const ch of answer()) key(ch);
    expect(typed()).toBe(answer());
    key('Enter');
    await act(async () => {
      await Promise.resolve();
    });
    expect(m.unlocked).toHaveBeenCalledWith(true);
    expect(location.hash).toBe('#/parent/records');
    expect(screen.queryByTestId('parent-gate')).toBeNull();
  });

  it('テンキー（Numpad）と IME が先に取った数字キーも入る', async () => {
    await openGate();
    key('7', { code: 'Numpad7' });
    key('Process', { code: 'Digit8' });
    expect(typed()).toBe('78');
  });

  it('Backspace は1字だけ消す（「けす」は全部）', async () => {
    await openGate();
    key('1');
    key('2');
    key('3');
    key('Backspace');
    expect(typed()).toBe('12');
    fireEvent.click(screen.getByTestId('gate-key-けす'));
    expect(typed()).toBe('');
  });

  it('まちがった答えで Enter: 「ちがいます」を出して入力を空にする。開かない', async () => {
    await openGate();
    const wrong = String(Number(answer()) + 1);
    for (const ch of wrong) key(ch);
    key('Enter');
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('ちがいます。もう一度どうぞ。')).toBeTruthy();
    expect(typed()).toBe('');
    expect(m.unlocked).not.toHaveBeenCalled();
    expect(location.hash).toBe('#/home');
    // 打ち直すと「ちがいます」は消える
    key('1');
    expect(screen.queryByText('ちがいます。もう一度どうぞ。')).toBeNull();
  });

  it('Esc で閉じる', async () => {
    await openGate();
    key('Escape');
    expect(screen.queryByTestId('parent-gate')).toBeNull();
    expect(m.unlocked).not.toHaveBeenCalled();
  });

  it('入力は6桁まで。押しっぱなし（repeat）は1回として数える', async () => {
    await openGate();
    for (const ch of '12345678') key(ch);
    expect(typed()).toBe('123456');
    key('Backspace');
    key('Backspace');
    key('9', { repeat: true });
    key('9', { repeat: true });
    expect(typed()).toBe('1234');
  });

  it('Ctrl・Alt・Meta を押しながらのキーは受けない（ブラウザの操作を取らない）', async () => {
    await openGate();
    key('1', { ctrlKey: true });
    key('1', { altKey: true });
    key('1', { metaKey: true });
    key('Escape', { ctrlKey: true });
    expect(typed()).toBe('');
    expect(screen.getByTestId('parent-gate')).toBeTruthy();
  });

  it('ボタンにフォーカスがあっても、Enter はそのボタンを押さず、OK として働く', async () => {
    await openGate();
    const five = screen.getByTestId('gate-key-5');
    five.focus();
    key('5');
    // Enter の既定の動作（フォーカス中のボタンのクリック）を止めている
    const notCancelled = fireEvent.keyDown(five, { key: 'Enter' });
    expect(notCancelled).toBe(false);
    // OK として働いた（答えは5ではないので「ちがいます」。入力は空に戻る）
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('ちがいます。もう一度どうぞ。')).toBeTruthy();
    expect(typed()).toBe('');
  });

  it('「もどる」にフォーカスがあるときの Enter は「もどる」（答えを送らない）', async () => {
    await openGate();
    for (const ch of answer()) key(ch);
    screen.getByTestId('gate-cancel').focus();
    const notCancelled = fireEvent.keyDown(screen.getByTestId('gate-cancel'), { key: 'Enter' });
    expect(notCancelled).toBe(false);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId('parent-gate')).toBeNull();
    expect(m.unlocked).not.toHaveBeenCalled();
  });

  it('開いたら板にフォーカスが移り、閉じたら鍵のボタンへ戻る', async () => {
    render(<ParentGateButton />);
    const keyBtn = screen.getByTestId('parent-key');
    keyBtn.focus();
    fireEvent.pointerDown(keyBtn);
    await act(async () => {
      vi.advanceTimersByTime(2100);
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(document.querySelector('.gate-panel'));
    key('Escape');
    expect(document.activeElement).toBe(keyBtn);
  });

  it('Tab は板の中のボタンの間だけを回る', async () => {
    await openGate();
    const first = screen.getByTestId('gate-key-1');
    const last = screen.getByTestId('gate-cancel');
    last.focus();
    const forward = fireEvent.keyDown(last, { key: 'Tab' });
    expect(forward).toBe(false);
    expect(document.activeElement).toBe(first);
    const backward = fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(backward).toBe(false);
    expect(document.activeElement).toBe(last);
    // 板の外（ホームの側）にフォーカスがあっても、板の中へ戻す
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(document.body, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    // 途中のボタンでは、ブラウザの通常の Tab に任せる
    screen.getByTestId('gate-key-5').focus();
    expect(fireEvent.keyDown(screen.getByTestId('gate-key-5'), { key: 'Tab' })).toBe(true);
  });

  it('開いた直後（板そのものにフォーカス）の Shift+Tab は、板の中の最後のボタンへ（後ろのホームに出ない）', async () => {
    await openGate();
    const panel = document.querySelector<HTMLElement>('.gate-panel')!;
    expect(document.activeElement).toBe(panel);
    const backward = fireEvent.keyDown(panel, { key: 'Tab', shiftKey: true });
    expect(backward).toBe(false);
    expect(document.activeElement).toBe(screen.getByTestId('gate-cancel'));
    // 前へ（Tab）も同じく、板そのものからは最初のボタンへ
    panel.focus();
    expect(fireEvent.keyDown(panel, { key: 'Tab' })).toBe(false);
    expect(document.activeElement).toBe(screen.getByTestId('gate-key-1'));
  });

  it('暗証番号があるときも同じ操作で入れる（入力は ● で隠れる）', async () => {
    m.pinHash = '4321';
    await openGate();
    for (const ch of '4321') key(ch);
    expect(typed()).toBe('●●●●');
    key('Enter');
    await act(async () => {
      await Promise.resolve();
    });
    expect(m.unlocked).toHaveBeenCalledWith(true);
    expect(location.hash).toBe('#/parent/records');
  });

  it('板が閉じたあとは、数字キーを受けない', async () => {
    await openGate();
    key('Escape');
    key('1');
    // 後ろの画面に何も起きない（リスナーが外れている）。再び開くと入力は空から
    fireEvent.pointerUp(screen.getByTestId('parent-key'));
    fireEvent.pointerDown(screen.getByTestId('parent-key'));
    await act(async () => {
      vi.advanceTimersByTime(2100);
      await Promise.resolve();
    });
    expect(typed()).toBe('');
  });
});
