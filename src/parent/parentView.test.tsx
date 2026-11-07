import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStateProvider, useApp } from '../app/AppState';
import { audio } from '../core/audio/index';
import * as db from '../core/storage/index';
import ParentApp from './index';

/**
 * 保護者画面で「見るプロフィール」を替えても、遊ぶ人（子供の画面のプロフィール。保存の activeProfileId）は
 * 替わらない（FX09）。「こどもの画面へ」は、2人以上なら起動画面の「だれが あそぶ？」へ向かう。
 */

/** 子供の画面が見る人（保護者画面の外。AppStateProvider の値をそのまま読む） */
function Probe() {
  const app = useApp();
  return (
    <>
      <p data-testid="playing">{app.profile?.name}</p>
      <p data-testid="choose-player">{String(app.choosePlayer)}</p>
    </>
  );
}

async function setup(tab = 'records') {
  const a = await db.createProfile('はな', 'cat');
  const b = await db.createProfile('たろう', 'dog');
  await db.saveAppRecord({ ...(await db.getAppRecord()), activeProfileId: a.id });
  render(
    <AppStateProvider>
      <Probe />
      <ParentApp tab={tab} />
    </AppStateProvider>,
  );
  await waitFor(() => expect(screen.getByTestId(`tab-${tab}`)).toBeTruthy());
  return { a, b };
}

const activeId = async () => (await db.getAppRecord()).activeProfileId;
const select = () => screen.getByTestId('parent-profile-select') as HTMLSelectElement;

beforeEach(async () => {
  await db.openStorage();
  await db.deleteAllData();
  location.hash = '#/parent/records';
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('見ているプロフィールと遊ぶ人', () => {
  it('はじめは遊ぶ人を見ている。見る人を替えても、遊ぶ人は替わらない', async () => {
    const { a, b } = await setup();
    expect(select().value).toBe(a.id);
    expect(screen.getByTestId('playing').textContent).toBe('はな');

    fireEvent.change(select(), { target: { value: b.id } });
    await waitFor(() => expect(select().value).toBe(b.id));
    await waitFor(() => expect(screen.getByTestId('tab-records')).toBeTruthy());

    // 遊ぶ人は「はな」のまま。保存の遊ぶ人も書き換えていない
    expect(screen.getByTestId('playing').textContent).toBe('はな');
    expect(await activeId()).toBe(a.id);
  });

  it('見ているプロフィールの記録が出る（遊ぶ人の記録ではなく）', async () => {
    const a = await db.createProfile('はな', 'cat');
    const b = await db.createProfile('たろう', 'dog');
    await db.saveAppRecord({ ...(await db.getAppRecord()), activeProfileId: a.id });
    const at = (profileId: string, itemKey: string) => ({
      profileId,
      modeId: 'shopping' as const,
      variantId: 'main',
      skillId: 'shop' as const,
      level: 0,
      itemKey,
      outcome: 'independent' as const,
      wrongTries: 0,
      hintsUsed: 0,
      reviewsUsed: 0,
      operationIssue: false,
      inputKind: 'mouse' as const,
      at: Date.now(),
    });
    await db.addAttempt(at(a.id, 'りんご×1'));
    await db.addAttempt(at(b.id, 'ばなな×2'));
    render(
      <AppStateProvider>
        <Probe />
        <ParentApp tab="records" />
      </AppStateProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('recent-table')).toBeTruthy());
    expect(screen.getByTestId('recent-table').textContent).toContain('りんご×1');

    fireEvent.change(select(), { target: { value: b.id } });
    await waitFor(() =>
      expect(screen.getByTestId('recent-table').textContent).toContain('ばなな×2'),
    );
    expect(screen.getByTestId('recent-table').textContent).not.toContain('りんご×1');
    expect(await activeId()).toBe(a.id);
  });

  it('せっていの変更は、見ているプロフィールにだけ入る（遊ぶ人の設定は変わらない）', async () => {
    const { a, b } = await setup('settings');
    const sfx = async () => (await screen.findByTestId('setting-sfx')) as HTMLInputElement;
    expect((await sfx()).checked).toBe(true);

    fireEvent.change(select(), { target: { value: b.id } });
    await waitFor(() => expect(select().value).toBe(b.id));
    await waitFor(async () => expect((await sfx()).checked).toBe(true));
    fireEvent.click(await sfx());

    await waitFor(async () => expect((await db.getSettings(b.id)).sfx).toBe(false));
    expect((await db.getSettings(a.id)).sfx).toBe(true);
    expect(await activeId()).toBe(a.id);
    // 画面にも見ている人の値が出る
    await waitFor(async () => expect((await sfx()).checked).toBe(false));
    // 遊ぶ人の「はな」に戻すと、はなの値（変えていない）が出る
    fireEvent.change(select(), { target: { value: a.id } });
    await waitFor(async () => expect((await sfx()).checked).toBe(true));
  });

  it('音は見ている人の設定で鳴らし、保護者画面を出るときに遊ぶ人の設定へ戻す', async () => {
    const volume = vi.spyOn(audio, 'setVolume');
    const a = await db.createProfile('はな', 'cat');
    const b = await db.createProfile('たろう', 'dog');
    await db.saveAppRecord({ ...(await db.getAppRecord()), activeProfileId: a.id });
    await db.saveSettings({ ...(await db.getSettings(a.id)), volume: 0.8 });
    await db.saveSettings({ ...(await db.getSettings(b.id)), volume: 0.3 });
    const { unmount } = render(
      <AppStateProvider>
        <Probe />
        <ParentApp tab="settings" />
      </AppStateProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('tab-settings')).toBeTruthy());
    fireEvent.change(select(), { target: { value: b.id } });
    await waitFor(() => expect(volume).toHaveBeenLastCalledWith(0.3));
    expect(await activeId()).toBe(a.id);
    unmount();
    expect(volume).toHaveBeenLastCalledWith(0.8);
  });

  it('見ているプロフィールを削除したら、遊ぶ人に戻る', async () => {
    const { a, b } = await setup('profiles');
    fireEvent.change(select(), { target: { value: b.id } });
    await waitFor(() => expect(select().value).toBe(b.id));
    fireEvent.click(await screen.findByTestId(`profile-delete-${b.id}`));
    fireEvent.change(screen.getByTestId('confirm-input'), { target: { value: 'たろう' } });
    fireEvent.click(screen.getByTestId('confirm-ok'));
    await waitFor(async () => expect((await db.listProfiles()).map((p) => p.id)).toEqual([a.id]));
    await waitFor(() => expect(select().value).toBe(a.id));
    expect(screen.getByTestId('playing').textContent).toBe('はな');
  });
});

describe('「こどもの画面へ」', () => {
  it('2人以上: 起動画面（だれが あそぶ？）へ向かい、旗を立てる', async () => {
    await setup();
    expect(screen.getByTestId('choose-player').textContent).toBe('false');
    fireEvent.click(screen.getByTestId('parent-to-child'));
    expect(location.hash).toBe('#/');
    expect(screen.getByTestId('choose-player').textContent).toBe('true');
  });

  it('1人だけ: そのままホームへ。旗は立てない', async () => {
    await db.createProfile('はな', 'cat');
    render(
      <AppStateProvider>
        <Probe />
        <ParentApp tab="records" />
      </AppStateProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('tab-records')).toBeTruthy());
    fireEvent.click(screen.getByTestId('parent-to-child'));
    expect(location.hash).toBe('#/home');
    expect(screen.getByTestId('choose-player').textContent).toBe('false');
  });
});
