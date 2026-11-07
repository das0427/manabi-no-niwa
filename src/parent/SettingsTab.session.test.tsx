import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppStateProvider } from '../app/AppState';
import * as db from '../core/storage/index';
import ParentApp from './index';

/**
 * 保護者画面「せってい」の利用時間の目安。区分の既定（FX10。3歳段階は 8 分）を、選ぶ欄がそのまま見せる。
 * 以前は選択肢に 8 分が無く、3歳段階のプロフィールで欄が別の値（なし）を見せていた。
 */

beforeEach(async () => {
  await db.openStorage();
  await db.deleteAllData();
});
afterEach(() => cleanup());

async function showSettings(sessionMinutes: number) {
  const p = await db.createProfile('はな', 'cat');
  await db.saveAppRecord({ ...(await db.getAppRecord()), activeProfileId: p.id });
  await db.saveSettings({ ...(await db.getSettings(p.id)), sessionMinutes });
  render(
    <AppStateProvider>
      <ParentApp tab="settings" />
    </AppStateProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('tab-settings')).toBeTruthy());
  const sel = screen.getByTestId('setting-sessionMinutes') as HTMLSelectElement;
  await waitFor(() => expect(sel.value).toBe(String(sessionMinutes)));
  return sel;
}

const optionTexts = (sel: HTMLSelectElement) => [...sel.options].map((o) => o.textContent);

describe('利用時間の目安の選ぶ欄', () => {
  it('3歳段階の既定の 8 分を選んだ状態で見せる', async () => {
    const sel = await showSettings(8);
    expect(sel.selectedOptions[0]?.textContent).toBe('8分');
    expect(optionTexts(sel)).toEqual(['なし', '5分', '8分', '10分', '15分', '20分', '30分']);
  });

  it('選択肢に無い値（読み込んだ記録など）も、その値のまま見せる', async () => {
    const sel = await showSettings(12);
    expect(sel.selectedOptions[0]?.textContent).toBe('12分');
  });
});
