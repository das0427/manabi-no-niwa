import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppStateProvider } from '../app/AppState';
import { defaultSupport } from '../audience/audience';
import * as db from '../core/storage/index';
import ParentApp from './index';

/**
 * FX10: 保護者画面「プロフィール」。新しいプロフィールと、区分を変えて「おすすめにする」を選んだときだけ、
 * 区分の既定の利用時間の目安を入れる。選ばなければ、保護者が決めた値は変わらない。
 */

beforeEach(async () => {
  await db.openStorage();
  await db.deleteAllData();
});
afterEach(() => cleanup());

async function showProfiles() {
  render(
    <AppStateProvider>
      <ParentApp tab="profiles" />
    </AppStateProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('tab-profiles')).toBeTruthy());
}

const change = (id: string, value: string) =>
  fireEvent.change(screen.getByTestId(id), { target: { value } });

describe('プロフィールを追加する', () => {
  it('追加した区分の既定の目安が入る（小学5年は 20 分）', async () => {
    await db.createProfile('はな', 'cat');
    await showProfiles();
    change('profile-name-new', 'たろう');
    change('profile-new-audience', 'g5');
    fireEvent.click(screen.getByTestId('profile-add'));
    await waitFor(async () => expect((await db.listProfiles()).length).toBe(2));
    const added = (await db.listProfiles()).find((p) => p.name === 'たろう')!;
    expect(added.audience).toBe('g5');
    expect((await db.getSettings(added.id)).sessionMinutes).toBe(20);
  });

  it('2〜3歳の2歳の段階は 5 分、3歳の段階は 8 分', async () => {
    await db.createProfile('はな', 'cat');
    await showProfiles();
    change('profile-name-new', 'ちび');
    change('profile-new-audience', 'toddler');
    fireEvent.click(screen.getByTestId('profile-new-stage-2'));
    fireEvent.click(screen.getByTestId('profile-add'));
    await waitFor(async () => expect((await db.listProfiles()).length).toBe(2));
    const toddler2 = (await db.listProfiles()).find((p) => p.name === 'ちび')!;
    expect(toddler2.toddlerStage).toBe(2);
    expect((await db.getSettings(toddler2.id)).sessionMinutes).toBe(5);
  });
});

describe('区分を変える', () => {
  async function openEdit(p: { id: string }) {
    await showProfiles();
    await waitFor(() => expect(screen.getByTestId(`profile-edit-${p.id}`)).toBeTruthy());
    fireEvent.click(screen.getByTestId(`profile-edit-${p.id}`));
    change(`profile-${p.id}-audience`, 'g3');
  }

  it('「おすすめにする」（初期は選んだ状態）で保存すると、新しい区分の目安（20 分）になる', async () => {
    const p = await db.createProfile('はな', 'cat');
    await db.saveSettings({ ...(await db.getSettings(p.id)), sessionMinutes: 7 });
    await openEdit(p);
    expect((screen.getByTestId(`profile-apply-support-${p.id}`) as HTMLInputElement).checked).toBe(
      true,
    );
    fireEvent.click(screen.getByTestId(`profile-save-${p.id}`));
    await waitFor(async () => expect((await db.getSettings(p.id)).sessionMinutes).toBe(20));
    // 支援の設定も同じ区分のおすすめ（これまでどおり）
    expect((await db.getSettings(p.id)).support).toEqual(defaultSupport('g3'));
  });

  it('「おすすめにする」を外して保存すると、保護者が決めた目安は変わらない', async () => {
    const p = await db.createProfile('はな', 'cat');
    await db.saveSettings({ ...(await db.getSettings(p.id)), sessionMinutes: 7 });
    await openEdit(p);
    fireEvent.click(screen.getByTestId(`profile-apply-support-${p.id}`));
    fireEvent.click(screen.getByTestId(`profile-save-${p.id}`));
    await waitFor(async () => expect((await db.listProfiles())[0]!.audience).toBe('g3'));
    expect((await db.getSettings(p.id)).sessionMinutes).toBe(7);
  });

  it('区分を変えずに名前だけ直したときは、目安に触らない', async () => {
    const p = await db.createProfile('はな', 'cat');
    await db.saveSettings({ ...(await db.getSettings(p.id)), sessionMinutes: 7 });
    await showProfiles();
    await waitFor(() => expect(screen.getByTestId(`profile-edit-${p.id}`)).toBeTruthy());
    fireEvent.click(screen.getByTestId(`profile-edit-${p.id}`));
    change(`profile-name-${p.id}`, 'はなこ');
    fireEvent.click(screen.getByTestId(`profile-save-${p.id}`));
    await waitFor(async () => expect((await db.listProfiles())[0]!.name).toBe('はなこ'));
    expect((await db.getSettings(p.id)).sessionMinutes).toBe(7);
  });
});
