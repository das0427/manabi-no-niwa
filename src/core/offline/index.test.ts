import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __testing,
  applyUpdate,
  getOfflineState,
  isPageControlled,
  onChunkLoadError,
  subscribeOffline,
} from './index';

type Listener = (e: unknown) => void;

class FakeWorker {
  state: ServiceWorkerState;
  version: string;
  posted: unknown[] = [];
  private listeners = new Map<string, Listener[]>();
  constructor(state: ServiceWorkerState, version: string) {
    this.state = state;
    this.version = version;
  }
  addEventListener(type: string, fn: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  removeEventListener(): void {}
  postMessage(msg: { type?: string }, transfer?: MessagePort[]): void {
    this.posted.push(msg);
    if (msg.type === 'GET_VERSION' && transfer?.[0]) {
      transfer[0].postMessage({ type: 'version', version: this.version });
    }
  }
  setState(state: ServiceWorkerState): void {
    this.state = state;
    for (const fn of this.listeners.get('statechange') ?? []) fn({});
  }
}

class FakeRegistration {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
  active: FakeWorker | null = null;
  private listeners = new Map<string, Listener[]>();
  addEventListener(type: string, fn: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  fire(type: string): void {
    for (const fn of this.listeners.get(type) ?? []) fn({});
  }
  update = vi.fn(() => Promise.resolve());
}

class FakeContainer {
  controller: FakeWorker | null = null;
  reg = new FakeRegistration();
  private listeners = new Map<string, Listener[]>();
  register = vi.fn(() => Promise.resolve(this.reg));
  addEventListener(type: string, fn: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  removeEventListener(): void {}
  emit(type: string, e: unknown = {}): void {
    for (const fn of this.listeners.get(type) ?? []) fn(e);
  }
}

let container: FakeContainer;

async function flush(): Promise<void> {
  await new Promise((r) => setTimeout(r, 20));
}

beforeEach(() => {
  container = new FakeContainer();
  Object.defineProperty(navigator, 'serviceWorker', { value: container, configurable: true });
  __testing.reset();
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker');
  __testing.reset();
});

describe('OfflineState', () => {
  it('初回: installing（進捗つき）→ ready（版つき）。ページはまだ制御されていない', async () => {
    const w = new FakeWorker('installing', 'v1');
    container.reg.installing = w;
    const seen: string[] = [];
    subscribeOffline((s) => seen.push(s.status));

    await __testing.start();
    expect(getOfflineState().status).toBe('installing');

    container.emit('message', { data: { type: 'precache-progress', done: 3, total: 10 } });
    expect(getOfflineState().progress).toEqual({ done: 3, total: 10 });

    container.reg.installing = null;
    container.reg.waiting = w;
    w.setState('installed');
    await flush();
    expect(getOfflineState()).toMatchObject({
      status: 'ready',
      progress: null,
      updateReady: false,
      version: 'v1',
    });
    expect(isPageControlled()).toBe(false);

    container.reg.waiting = null;
    container.reg.active = w;
    w.setState('activated');
    expect(getOfflineState().status).toBe('ready');
    expect(seen).toContain('installing');
    expect(seen).toContain('ready');
  });

  it('更新: 現在の版を使ったまま ready。新版が揃うと updateReady になる', async () => {
    const v1 = new FakeWorker('activated', 'v1');
    container.reg.active = v1;
    container.controller = v1;
    await __testing.start();
    await flush();
    expect(getOfflineState()).toMatchObject({ status: 'ready', updateReady: false, version: 'v1' });
    expect(isPageControlled()).toBe(true);

    const v2 = new FakeWorker('installing', 'v2');
    container.reg.installing = v2;
    container.reg.fire('updatefound');
    container.emit('message', { data: { type: 'precache-progress', done: 1, total: 4 } });
    expect(getOfflineState()).toMatchObject({
      status: 'ready',
      updateReady: false,
      progress: { done: 1, total: 4 },
    });

    container.reg.installing = null;
    container.reg.waiting = v2;
    v2.setState('installed');
    await flush();
    expect(getOfflineState()).toMatchObject({
      status: 'ready',
      updateReady: true,
      progress: null,
      version: 'v1',
    });
  });

  it('更新の準備に失敗しても、現在の版は ready のまま error が入る', async () => {
    const v1 = new FakeWorker('activated', 'v1');
    container.reg.active = v1;
    container.controller = v1;
    await __testing.start();
    const v2 = new FakeWorker('installing', 'v2');
    container.reg.installing = v2;
    container.reg.fire('updatefound');
    container.reg.installing = null;
    v2.setState('redundant');
    expect(getOfflineState().status).toBe('ready');
    expect(getOfflineState().updateReady).toBe(false);
    expect(getOfflineState().error).not.toBeNull();
  });

  it('初回の準備に失敗したら error', async () => {
    const w = new FakeWorker('installing', 'v1');
    container.reg.installing = w;
    await __testing.start();
    container.reg.installing = null;
    w.setState('redundant');
    expect(getOfflineState()).toMatchObject({ status: 'error', progress: null });
    expect(getOfflineState().error).not.toBeNull();
  });

  it('登録に失敗したら error', async () => {
    container.register.mockRejectedValueOnce(new DOMException('insecure', 'SecurityError'));
    await __testing.start();
    expect(getOfflineState().status).toBe('error');
    expect(getOfflineState().error).toContain('SecurityError');
  });

  it('applyUpdate: waiting に SKIP_WAITING を送り、切り替わったら再読み込みする', async () => {
    const v1 = new FakeWorker('activated', 'v1');
    const v2 = new FakeWorker('installed', 'v2');
    container.reg.active = v1;
    container.reg.waiting = v2;
    container.controller = v1;
    const reload = vi.fn();
    __testing.setReload(reload);
    await __testing.start();
    expect(getOfflineState().updateReady).toBe(true);

    const done = applyUpdate();
    expect(v2.posted).toContainEqual({ type: 'SKIP_WAITING' });
    expect(reload).not.toHaveBeenCalled();
    container.emit('controllerchange');
    await done;
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('applyUpdate: 待機中の版がなければ何もしない', async () => {
    const reload = vi.fn();
    __testing.setReload(reload);
    await __testing.start();
    await applyUpdate();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('Service Worker が使えないとき', () => {
  it('unsupported', async () => {
    Reflect.deleteProperty(navigator, 'serviceWorker');
    __testing.reset();
    await __testing.start();
    expect(getOfflineState()).toMatchObject({ supported: false, status: 'unsupported' });
  });
});

describe('onChunkLoadError', () => {
  it('遅延読み込みの失敗（各ブラウザの文言）を判定する', () => {
    expect(
      onChunkLoadError(
        new TypeError('Failed to fetch dynamically imported module: http://x/assets/a.js'),
      ),
    ).toBe(true);
    expect(
      onChunkLoadError(new TypeError('error loading dynamically imported module: http://x/a.js')),
    ).toBe(true);
    expect(onChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(onChunkLoadError(new Error('Unable to preload CSS for /assets/a.css'))).toBe(true);
    expect(onChunkLoadError({ name: 'ChunkLoadError', message: '' })).toBe(true);
    expect(
      onChunkLoadError({ reason: new TypeError('Failed to fetch dynamically imported module') }),
    ).toBe(true);
  });
  it('それ以外のエラーは false', () => {
    expect(onChunkLoadError(new Error('boom'))).toBe(false);
    expect(onChunkLoadError(null)).toBe(false);
    expect(onChunkLoadError(undefined)).toBe(false);
    expect(onChunkLoadError(42)).toBe(false);
  });
});
