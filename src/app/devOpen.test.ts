import { afterEach, describe, expect, it, vi } from 'vitest';

/** devOpen.ts はモジュールを読み込んだときの URL で決まるので、URL を決めてから読み込み直す */
async function load(url: string, dev = true) {
  vi.resetModules();
  vi.stubEnv('DEV', dev);
  window.history.replaceState(null, '', url);
  return import('./devOpen');
}

afterEach(() => {
  vi.unstubAllEnvs();
  window.history.replaceState(null, '', '/');
});

describe('開発用の ?dev-open', () => {
  it('指定が無いときは false（起動画面とゲートは今までどおり）', async () => {
    const m = await load('/#/parent/settings');
    expect(m.DEV_OPEN).toBe(false);
    expect(m.devOpenParent()).toBe(false);
  });

  it('別の指定（?dev-setup など）だけでは false', async () => {
    const m = await load('/?dev-setup=failed#/home');
    expect(m.DEV_OPEN).toBe(false);
  });

  it('?dev-open で true。保護者画面の hash のときだけゲートも開く', async () => {
    const home = await load('/?dev-open#/home');
    expect(home.DEV_OPEN).toBe(true);
    expect(home.devOpenParent()).toBe(false);
    const parent = await load('/?dev-open#/parent/settings');
    expect(parent.DEV_OPEN).toBe(true);
    expect(parent.devOpenParent()).toBe(true);
  });

  it('開発サーバーでなければ（本番ビルド）、指定があっても false', async () => {
    const m = await load('/?dev-open#/parent/records', false);
    expect(m.DEV_OPEN).toBe(false);
    expect(m.devOpenParent()).toBe(false);
  });
});
