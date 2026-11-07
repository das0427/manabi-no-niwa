import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RetiredScreen } from './RetiredScreen';

afterEach(cleanup);

/** 本物の見張り（navigator.locks.query）を動かさない */
const noWatch = (): (() => void) => () => {};

describe('RetiredScreen（べつの まどで ひらいています）', () => {
  it('子供向けの大きな文字と、保護者向けの案内・ボタンを出す', () => {
    render(<RetiredScreen watch={noWatch} />);
    expect(screen.getByTestId('instance-retired')).toBeTruthy();
    expect(screen.getByRole('heading').textContent).toBe('べつの まどで ひらいています');
    const note = screen.getByText(/保護者の方へ/);
    expect(note.textContent).toBe(
      '（保護者の方へ）まなびのにわは、ほかの窓で開いています。この窓は閉じてかまいません。',
    );
    expect(screen.getByTestId('instance-reopen').textContent).toBe('この まどで ひらく');
  });

  it('［この まどで ひらく］を押すと onReopen が1回呼ばれる', () => {
    const onReopen = vi.fn();
    render(<RetiredScreen onReopen={onReopen} watch={noWatch} />);
    fireEvent.click(screen.getByTestId('instance-reopen'));
    expect(onReopen).toHaveBeenCalledTimes(1);
  });

  it('鍵が空いたと見張りが知らせたら、自分で始め直す（onReopen）。閉じたら見張りを止める', () => {
    const onReopen = vi.fn();
    const stop = vi.fn();
    let fire: (() => void) | null = null;
    const watch = (onFree: () => void): (() => void) => {
      fire = onFree;
      return stop;
    };
    const { unmount } = render(<RetiredScreen onReopen={onReopen} watch={watch} />);
    expect(onReopen).not.toHaveBeenCalled();
    fire!();
    expect(onReopen).toHaveBeenCalledTimes(1);
    unmount();
    expect(stop).toHaveBeenCalled();
  });

  it('読み込む部品は絵と CSS だけ（AppState・音・オフライン・記録に触れない）', async () => {
    const src = await import('./RetiredScreen?raw');
    const text = (src as { default: string }).default;
    const imports = [...text.matchAll(/^import .* from '([^']+)'|^import '([^']+)'/gm)].map(
      (m) => m[1] ?? m[2],
    );
    expect(imports.filter((p) => p !== 'react')).toEqual([
      '../core/instance/instance',
      '../illust/Illust',
      './retired.css',
    ]);
  });
});
