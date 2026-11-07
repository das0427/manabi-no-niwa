import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FullscreenSection } from './SettingsTab';

function setPageFullscreen(el: Element | null): void {
  Object.defineProperty(document, 'fullscreenElement', { value: el, configurable: true });
}
function setDisplayModeFullscreen(on: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: query === '(display-mode: fullscreen)' && on,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
  setPageFullscreen(null);
  // jsdom には matchMedia が無い
  Reflect.deleteProperty(window, 'matchMedia');
  vi.restoreAllMocks();
});

describe('保護者画面「せってい」の全画面の節（docs/expansion/single-instance-design.md 2.4.4）', () => {
  it('ふつうの窓: ［全画面にする］と注記', () => {
    render(<FullscreenSection />);
    expect(screen.getByTestId('fullscreen-toggle').textContent).toBe('全画面にする');
    expect(screen.queryByTestId('fullscreen-window')).toBeNull();
    const note = document.querySelector('.p-note')?.textContent ?? '';
    expect(note).toBe(
      'まなびのにわを開いているときにアイコンをもう一度押すと、その窓を前に出して全画面にします。前に出せないときは、新しい窓で開き直して、「はじめる」を押したときに全画面にします。F11 キーを押すと、いつでも元に戻ります。このボタンで全画面にしたときは、Esc キーでも戻ります。',
    );
    expect(note).toContain('アイコンをもう一度押すと');
    expect(note).toContain('前に出せないときは');
    expect(note).toContain('F11 キー');
    expect(note).toContain('Esc キー');
    expect(note).not.toContain('強制しません');
    // 折り返しで途中で切りたくない語は、1つにまとめて包む（文の字面は変わらない）
    const kept = Array.from(document.querySelectorAll('.p-note .p-keep')).map((e) => e.textContent);
    expect(kept).toEqual(['アイコン', '「はじめる」', 'F11 キー', 'Esc キー']);
  });

  it('ページの全画面: ［全画面をやめる］', () => {
    setPageFullscreen(document.documentElement);
    render(<FullscreenSection />);
    expect(screen.getByTestId('fullscreen-toggle').textContent).toBe('全画面をやめる');
  });

  it('ブラウザの全画面（窓の全画面）: ボタンを出さず、F11 を案内する', () => {
    setDisplayModeFullscreen(true);
    render(<FullscreenSection />);
    expect(screen.queryByTestId('fullscreen-toggle')).toBeNull();
    const text = screen.getByTestId('fullscreen-window').textContent ?? '';
    expect(text).toContain('いまは全画面で表示しています');
    expect(text).toContain('F11 キー');
  });

  it('窓の大きさが変わる（F11 で出入りする）と表示が切り替わる', () => {
    render(<FullscreenSection />);
    expect(screen.getByTestId('fullscreen-toggle')).toBeTruthy();
    act(() => {
      setDisplayModeFullscreen(true);
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.queryByTestId('fullscreen-toggle')).toBeNull();
    expect(screen.getByTestId('fullscreen-window')).toBeTruthy();
    act(() => {
      setDisplayModeFullscreen(false);
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('fullscreen-toggle')).toBeTruthy();
  });

  it('［全画面にする］で requestFullscreen を呼び、失敗したら文を出す', async () => {
    const spy = vi.fn(() => Promise.reject(new TypeError('denied')));
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      value: spy,
      configurable: true,
    });
    render(<FullscreenSection />);
    await act(async () => {
      screen.getByTestId('fullscreen-toggle').click();
      await Promise.resolve();
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status').textContent).toBe(
      'このブラウザでは全画面にできませんでした。',
    );
  });
});
