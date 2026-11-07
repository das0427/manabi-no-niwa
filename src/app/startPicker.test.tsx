import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as db from '../core/storage/index';
import { AppStateProvider, useApp } from './AppState';
import { StartScreen } from './StartScreen';

/**
 * 保護者画面から「こどもの画面へ」で戻ったとき（app.choosePlayer）は、起動画面の「はじめる」を飛ばして
 * 「だれが あそぶ？」から始める（FX09）。選ぶと、その人が遊ぶ人になってホームへ進む。
 */

/** 旗（choosePlayer・started）を立ててから起動画面を出す（保護者画面から戻った状態） */
function Harness({ choosePlayer, started = true }: { choosePlayer: boolean; started?: boolean }) {
  const app = useApp();
  const [go, setGo] = useState(false);
  const { ready, setStarted, setChoosePlayer } = app;
  useEffect(() => {
    if (!ready) return;
    setStarted(started);
    setChoosePlayer(choosePlayer);
    setGo(true);
  }, [ready, started, choosePlayer, setStarted, setChoosePlayer]);
  return (
    <>
      <p data-testid="flag">{String(app.choosePlayer)}</p>
      {go ? <StartScreen /> : null}
    </>
  );
}

function mount(props: { choosePlayer: boolean; started?: boolean }) {
  return render(
    <AppStateProvider>
      <Harness {...props} />
    </AppStateProvider>,
  );
}

const activeId = async () => (await db.getAppRecord()).activeProfileId;

beforeEach(async () => {
  await db.openStorage();
  await db.deleteAllData();
  location.hash = '#/';
});
afterEach(cleanup);

describe('保護者画面から戻ったときの起動画面', () => {
  it('2人以上: 「はじめる」を飛ばして「だれが あそぶ？」。旗は読んだらすぐ下ろす', async () => {
    const a = await db.createProfile('はな', 'cat');
    await db.createProfile('たろう', 'dog');
    await db.saveAppRecord({ ...(await db.getAppRecord()), activeProfileId: a.id });
    mount({ choosePlayer: true });
    expect(await screen.findByTestId('profile-picker')).toBeTruthy();
    expect(screen.queryByTestId('start-button')).toBeNull();
    expect(screen.getByText('だれが あそぶ？')).toBeTruthy();
    // 並びは作った時刻の順。同じミリ秒に作ると順が決まらないので、並びは見ない
    expect(
      screen
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label'))
        .sort(),
    ).toEqual(['たろう', 'はな'].sort());
    await waitFor(() => expect(screen.getByTestId('flag').textContent).toBe('false'));
    // 旗を下ろしても、選ぶ画面はそのまま
    expect(screen.getByTestId('profile-picker')).toBeTruthy();
  });

  it('選んだ人が遊ぶ人になり、ホームへ進む（選ぶまで遊ぶ人は替わらない）', async () => {
    const a = await db.createProfile('はな', 'cat');
    const b = await db.createProfile('たろう', 'dog');
    await db.saveAppRecord({ ...(await db.getAppRecord()), activeProfileId: a.id });
    mount({ choosePlayer: true });
    await screen.findByTestId('profile-picker');
    expect(await activeId()).toBe(a.id);
    fireEvent.click(screen.getByRole('button', { name: 'たろう' }));
    await waitFor(() => expect(location.hash).toBe('#/home'));
    expect(await activeId()).toBe(b.id);
  });

  it('旗が無ければ、これまでどおり「はじめる」から', async () => {
    await db.createProfile('はな', 'cat');
    await db.createProfile('たろう', 'dog');
    mount({ choosePlayer: false });
    expect(await screen.findByTestId('start-button')).toBeTruthy();
    expect(screen.queryByTestId('profile-picker')).toBeNull();
  });

  it('1人だけなら、旗があっても選ぶ画面は出さない', async () => {
    await db.createProfile('はな', 'cat');
    mount({ choosePlayer: true });
    expect(await screen.findByTestId('start-button')).toBeTruthy();
    expect(screen.queryByTestId('profile-picker')).toBeNull();
  });

  it('音声がまだ有効でない（再読み込み直後など）なら、旗があっても「はじめる」から', async () => {
    await db.createProfile('はな', 'cat');
    await db.createProfile('たろう', 'dog');
    mount({ choosePlayer: true, started: false });
    expect(await screen.findByTestId('start-button')).toBeTruthy();
    expect(screen.queryByTestId('profile-picker')).toBeNull();
  });
});
