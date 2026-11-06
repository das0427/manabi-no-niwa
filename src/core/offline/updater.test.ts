import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * アプリの自動更新（アプリ側）の流れ。配信の窓口（./__manabi/update/…）・Service Worker の状態（./index）・
 * 教材パック（./packs）は差し替える。時計は偽物（vi.useFakeTimers）で進める。
 */
interface FakeOffline {
  supported: boolean;
  status: 'unsupported' | 'idle' | 'installing' | 'ready' | 'error';
  progress: { done: number; total: number } | null;
  updateReady: boolean;
  version: string | null;
  error: string | null;
}

interface FakePackStatus {
  packId: string;
  state: 'core' | 'ready' | 'outdated' | 'not-downloaded' | 'unavailable';
  bytes: number;
}

const m = vi.hoisted(() => ({
  off: {
    supported: true,
    status: 'ready',
    progress: null,
    updateReady: false,
    version: 'v1',
    error: null,
  } as FakeOffline,
  listeners: new Set<() => void>(),
  applyUpdate: vi.fn(() => Promise.resolve()),
  checkForUpdateNow: vi.fn(),
  index: {} as Record<string, unknown> | null,
  statuses: [] as FakePackStatus[],
  downloadedLists: [] as string[][],
  downloadFailures: [] as { packId: string; reason: string }[],
  downloadGate: null as Promise<void> | null,
  framed: false,
}));

vi.mock('../framed', () => ({ isFramed: () => m.framed }));

vi.mock('./index', () => ({
  getOfflineState: () => m.off,
  subscribeOffline: (cb: () => void) => {
    m.listeners.add(cb);
    return () => {
      m.listeners.delete(cb);
    };
  },
  applyUpdate: m.applyUpdate,
  checkForUpdateNow: m.checkForUpdateNow,
}));

vi.mock('./packs', () => ({
  getPackIndex: () => Promise.resolve(m.index),
  computePackStatuses: () => Promise.resolve(m.statuses),
  downloadPackList: async (
    ids: string[],
    onProgress: (p: { doneBytes: number }, i: number, n: number) => void,
  ) => {
    m.downloadedLists.push([...ids]);
    if (m.downloadGate) await m.downloadGate;
    ids.forEach((_id, i) => onProgress({ doneBytes: 10 }, i, ids.length));
    return m.downloadFailures;
  },
}));

const {
  __testing,
  compareVersions,
  fetchUpdaterStatus,
  getUpdaterView,
  parseUpdaterStatus,
  refreshUpdaterStatus,
  requestApply,
  requestCancel,
  requestCheck,
  setAutoCheck,
  startUpdater,
} = await import('./updater');

// ---------------------------------------------------------------- 道具

type Json = Record<string, unknown>;

function baseStatus(): Json {
  return {
    schema: 1,
    supported: true,
    reason: null,
    token: 'a'.repeat(32),
    server: { pid: 123, startedAt: '2026-11-20T01:23:45Z' },
    current: { version: '2.1.0' },
    settings: { autoCheck: true },
    disk: { freeBytes: 50_000_000_000 },
    check: { state: 'ok', at: '2026-11-20T01:24:00Z', error: null },
    latest: {
      version: '2.2.0',
      date: '2026-11-20',
      notes: ['小学4年の算数に「がい数」を足しました'],
      newer: true,
      installable: true,
      blockedReason: null,
      downloadBytes: 178257920,
      needBytes: 636870912,
      parts: [
        { kind: 'main', bytes: 178257920, changed: true },
        { kind: 'audio-g1-g2', bytes: 345000000, changed: false },
      ],
    },
    update: {
      phase: 'idle',
      targetVersion: null,
      progress: null,
      error: null,
      startedAt: null,
      finishedAt: null,
    },
    lastApplied: null,
  };
}

function json(body: unknown, status = 200, type = 'application/json; charset=utf-8'): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': type },
  });
}

interface Posted {
  path: string;
  headers: Record<string, string>;
  body: unknown;
}

/** 偽の配信（窓口）。status を書き換えて、状態の変わり方を作る */
class FakeServer {
  status: Json = baseStatus();
  /** true のあいだは通信が失敗する（配信が起動し直している） */
  down = false;
  posts: Posted[] = [];
  gets = 0;
  /** POST の応答を差し替える（path → 応答）。既定は apply だけ「受け付けた」にする */
  respond: Partial<Record<string, () => Response>> = {};
  fetch = vi.fn(async (input: string, init?: RequestInit): Promise<Response> => {
    if (this.down) throw new TypeError('Failed to fetch');
    const path = String(input).replace(/^.*__manabi\/update\//, '');
    if (!init || init.method !== 'POST') {
      this.gets++;
      return json(this.status);
    }
    const headers = init.headers as Record<string, string>;
    if (headers['X-Manabi-Token'] !== this.status.token) {
      return json({ ok: false, error: { code: 'forbidden', detail: 'token' } }, 403);
    }
    this.posts.push({ path, headers, body: JSON.parse(String(init.body)) as unknown });
    const custom = this.respond[path];
    if (custom) return custom();
    if (path === 'apply') {
      this.update({
        phase: 'downloading',
        targetVersion: '2.2.0',
        startedAt: '2026-11-20T01:30:00Z',
        progress: { doneBytes: 0, totalBytes: 100, part: 'main', partIndex: 1, partCount: 1 },
      });
      return json({ ok: true, status: this.status }, 202);
    }
    return json({ ok: true, status: this.status }, path === 'settings' ? 200 : 202);
  });

  update(patch: Json): void {
    this.status = {
      ...this.status,
      update: { ...(this.status.update as Json), ...patch },
    };
  }
}

let server: FakeServer;

function setOff(patch: Partial<FakeOffline>): void {
  m.off = { ...m.off, ...patch };
  for (const cb of [...m.listeners]) cb();
}

function setHash(hash: string): void {
  history.replaceState(null, '', hash === '' ? location.pathname : hash);
}

async function settle(ms = 0): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

beforeEach(() => {
  vi.useFakeTimers();
  __testing.reset();
  server = new FakeServer();
  __testing.setFetch(server.fetch);
  __testing.setAppVersion('2.1.0');
  m.off = {
    supported: true,
    status: 'ready',
    progress: null,
    updateReady: false,
    version: 'v1',
    error: null,
  };
  m.listeners.clear();
  m.applyUpdate.mockClear();
  m.checkForUpdateNow.mockClear();
  m.index = {};
  m.statuses = [];
  m.downloadedLists = [];
  m.downloadFailures = [];
  m.downloadGate = null;
  setHash('#/parent/about');
  try {
    sessionStorage.clear();
  } catch {
    /* 無くてもよい */
  }
});

afterEach(() => {
  __testing.reset();
  vi.useRealTimers();
});

// ---------------------------------------------------------------- 状態の読み取り

describe('parseUpdaterStatus', () => {
  it('正しい状態を読む', () => {
    const s = parseUpdaterStatus(baseStatus());
    expect(s).toMatchObject({
      token: 'a'.repeat(32),
      current: { version: '2.1.0' },
      settings: { autoCheck: true },
      latest: { version: '2.2.0', newer: true, installable: true },
      update: { phase: 'idle', progress: null },
      lastApplied: null,
    });
    expect(s?.latest?.parts).toHaveLength(2);
  });

  it('latest が null、作業の進み具合・失敗・最後に入れた版つきの状態も読む', () => {
    const body = baseStatus();
    body.latest = null;
    body.update = {
      phase: 'failed',
      targetVersion: '2.2.0',
      progress: { doneBytes: 1, totalBytes: 2, part: 'main', partIndex: 1, partCount: 1 },
      error: { code: 'disk-full', detail: 'x', needBytes: 1000 },
      startedAt: '2026-11-20T01:30:00Z',
      finishedAt: '2026-11-20T01:31:00Z',
    };
    body.lastApplied = { version: '2.1.0', from: '2.0.2', at: '2026-11-01T10:00:00Z' };
    const s = parseUpdaterStatus(body);
    expect(s?.latest).toBeNull();
    expect(s?.update.error).toEqual({ code: 'disk-full', detail: 'x', needBytes: 1000 });
    expect(s?.lastApplied?.from).toBe('2.0.2');
  });

  it('知らない欄は無視する', () => {
    expect(parseUpdaterStatus({ ...baseStatus(), future: { a: 1 } })).not.toBeNull();
  });

  const bad: [string, (b: Json) => void][] = [
    ['schema が 1 でない', (b) => void (b.schema = 2)],
    ['supported が false', (b) => void (b.supported = false)],
    ['supported が無い', (b) => void delete b.supported],
    ['token が無い', (b) => void delete b.token],
    ['token が空', (b) => void (b.token = '')],
    ['server の形の誤り', (b) => void (b.server = { pid: 'x', startedAt: 'y' })],
    ['current.version が数', (b) => void (b.current = { version: 2 })],
    ['settings.autoCheck が文字', (b) => void (b.settings = { autoCheck: 'true' })],
    ['disk.freeBytes が文字', (b) => void (b.disk = { freeBytes: '1' })],
    ['check.state が知らない値', (b) => void (b.check = { state: 'weird', at: null, error: null })],
    ['check.error の形の誤り', (b) => void (b.check = { state: 'error', at: null, error: 'x' })],
    ['latest.newer が文字', (b) => void ((b.latest as Json).newer = 'yes')],
    ['latest.notes が文字の配列でない', (b) => void ((b.latest as Json).notes = [1])],
    ['latest.parts の要素の誤り', (b) => void ((b.latest as Json).parts = [{ kind: 'main' }])],
    ['latest が欠けている', (b) => void delete b.latest],
    ['update.phase が知らない値', (b) => void ((b.update as Json).phase = 'zzz')],
    [
      'update.progress の欄が欠けている',
      (b) => void ((b.update as Json).progress = { doneBytes: 1 }),
    ],
    ['update.error の形の誤り', (b) => void ((b.update as Json).error = { code: 1 })],
    ['lastApplied の形の誤り', (b) => void (b.lastApplied = { version: '2.1.0' })],
  ];
  it.each(bad)('欄の形の誤りは null: %s', (_name, mutate) => {
    const body = baseStatus();
    mutate(body);
    expect(parseUpdaterStatus(body)).toBeNull();
  });

  it('オブジェクトでないものは null', () => {
    for (const v of [null, undefined, 'x', 5, [], true]) expect(parseUpdaterStatus(v)).toBeNull();
  });
});

describe('fetchUpdaterStatus（窓口があるかの判定）', () => {
  it('窓口の状態を cache:no-store で読む', async () => {
    const s = await fetchUpdaterStatus();
    expect(s?.current.version).toBe('2.1.0');
    expect(server.fetch).toHaveBeenCalledWith('./__manabi/update/status', { cache: 'no-store' });
  });

  it('Content-Type が application/json でなければ「窓口なし」（vite preview の index.html など）', async () => {
    __testing.setFetch(async () =>
      json('<!doctype html><title>x</title>', 200, 'text/html; charset=utf-8'),
    );
    expect(await fetchUpdaterStatus()).toBeNull();
    __testing.setFetch(async () => new Response(JSON.stringify(baseStatus()), { status: 200 }));
    expect(await fetchUpdaterStatus()).toBeNull();
  });

  it('404（2.0.x の serve.py）・500・通信の失敗・JSON でない本文・supported:false は「窓口なし」', async () => {
    __testing.setFetch(async () => json({ error: 'not found' }, 404));
    expect(await fetchUpdaterStatus()).toBeNull();
    __testing.setFetch(async () => json(baseStatus(), 500));
    expect(await fetchUpdaterStatus()).toBeNull();
    __testing.setFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await fetchUpdaterStatus()).toBeNull();
    __testing.setFetch(async () => json('これは JSON ではありません'));
    expect(await fetchUpdaterStatus()).toBeNull();
    __testing.setFetch(async () => json({ schema: 1, supported: false, reason: 'not-installed' }));
    expect(await fetchUpdaterStatus()).toBeNull();
  });

  it('欄の形が誤っていれば「窓口なし」', async () => {
    const body = baseStatus();
    body.check = { state: 'weird', at: null, error: null };
    __testing.setFetch(async () => json(body));
    expect(await fetchUpdaterStatus()).toBeNull();
  });
});

describe('compareVersions', () => {
  it('X.Y.Z を数として比べる。X.Y.Z でなければ null', () => {
    expect(compareVersions('2.10.0', '2.9.9')).toBeGreaterThan(0);
    expect(compareVersions('2.1.0', '2.1.0')).toBe(0);
    expect(compareVersions('2.0.2', '2.1.0')).toBeLessThan(0);
    expect(compareVersions('dev', '2.1.0')).toBeNull();
    expect(compareVersions('2.1.0-beta.1', '2.1.0')).toBeNull();
    expect(compareVersions('', '2.1.0')).toBeNull();
  });
});

// ---------------------------------------------------------------- POST

describe('POST（見出しと合言葉）', () => {
  it('Content-Type: application/json と X-Manabi-Token を付ける。本文は仕様どおり', async () => {
    await refreshUpdaterStatus();
    await requestCheck();
    await setAutoCheck(false);
    await requestCancel();
    expect(server.posts.map((p) => p.path)).toEqual(['check', 'settings', 'cancel']);
    for (const p of server.posts) {
      expect(p.headers['Content-Type']).toBe('application/json');
      expect(p.headers['X-Manabi-Token']).toBe('a'.repeat(32));
    }
    expect(server.posts.map((p) => p.body)).toEqual([{}, { autoCheck: false }, {}]);
    expect(server.fetch.mock.calls.find(([u]) => String(u).endsWith('/check'))?.[1]).toMatchObject({
      method: 'POST',
    });
  });

  it('状態を読んでいなくても、先に読んで合言葉を得てから送る', async () => {
    const r = await requestCheck();
    expect(r).toEqual({ ok: true });
    expect(server.gets).toBe(1);
    expect(server.posts).toHaveLength(1);
    expect(getUpdaterView().available).toBe(true);
  });

  it('403（合言葉が古い）なら、状態を読み直して 1 回だけ送り直す', async () => {
    await refreshUpdaterStatus();
    server.status = { ...server.status, token: 'b'.repeat(32) }; // 配信が起動し直した
    const getsBefore = server.gets;
    const r = await requestCheck();
    expect(r.ok).toBe(true);
    expect(server.gets).toBe(getsBefore + 1);
    expect(server.posts).toHaveLength(1);
    expect(server.posts[0]!.headers['X-Manabi-Token']).toBe('b'.repeat(32));
    expect(getUpdaterView().status?.token).toBe('b'.repeat(32));
  });

  it('送り直しても 403 なら、それ以上は送らない', async () => {
    await refreshUpdaterStatus();
    // 窓口が 403 を返し続ける
    const calls: string[] = [];
    __testing.setFetch(async (input, init) => {
      if (init?.method === 'POST') {
        calls.push(String(input));
        return json({ ok: false, error: { code: 'forbidden', detail: 'x' } }, 403);
      }
      return json(server.status);
    });
    const r = await requestCheck();
    expect(r).toMatchObject({ ok: false, code: 'forbidden' });
    expect(calls).toHaveLength(2);
  });

  it('失敗の本文のコードを返す。配信に届かなければ unreachable', async () => {
    await refreshUpdaterStatus();
    server.respond.check = () =>
      json({ ok: false, error: { code: 'busy', detail: 'working' } }, 409);
    expect(await requestCheck()).toEqual({ ok: false, code: 'busy', detail: 'working' });
    server.down = true;
    expect(await requestCancel()).toMatchObject({ ok: false, code: 'unreachable' });
  });

  it('ほかのページの枠（iframe）の中では送らない（framed）', async () => {
    await refreshUpdaterStatus();
    m.framed = true;
    try {
      expect(await requestCheck()).toMatchObject({ ok: false, code: 'framed' });
      expect(await setAutoCheck(false)).toMatchObject({ ok: false, code: 'framed' });
      expect(await requestApply('2.2.0')).toMatchObject({ ok: false, code: 'framed' });
      expect(server.posts).toEqual([]);
    } finally {
      m.framed = false;
    }
  });

  it('成功の応答の状態を保存する（settings）', async () => {
    await refreshUpdaterStatus();
    server.respond.settings = () => {
      server.status = { ...server.status, settings: { autoCheck: false } };
      return json({ ok: true, status: server.status }, 200);
    };
    await setAutoCheck(false);
    expect(getUpdaterView().status?.settings.autoCheck).toBe(false);
  });
});

// ---------------------------------------------------------------- 押したあとの流れ

describe('requestApply の流れ（偽の時計）', () => {
  it('取得 → 読めない（再起動）→ 版が変わる → Service Worker の準備 → 読み込み直し（applyUpdate は 1 回だけ）', async () => {
    await refreshUpdaterStatus();
    const r = await requestApply('2.2.0');
    expect(r.ok).toBe(true);
    expect(server.posts.at(-1)).toMatchObject({ path: 'apply', body: { version: '2.2.0' } });
    expect(getUpdaterView().flow).toBe('server');
    expect(getUpdaterView().status?.update.phase).toBe('downloading');

    // 1 秒ごとに状態を読み、進み具合が出る
    server.update({
      progress: { doneBytes: 50, totalBytes: 100, part: 'main', partIndex: 1, partCount: 1 },
    });
    await settle(1000);
    expect(getUpdaterView().status?.update.progress?.doneBytes).toBe(50);
    server.update({ phase: 'switching', progress: null });
    await settle(1000);
    expect(getUpdaterView().flow).toBe('server');
    expect(getUpdaterView().status?.update.phase).toBe('switching');

    // 配信が起動し直している（読めない）
    server.down = true;
    await settle(1000);
    expect(getUpdaterView().flow).toBe('waiting-server');
    await settle(3000);
    expect(getUpdaterView().flow).toBe('waiting-server');
    expect(m.checkForUpdateNow).not.toHaveBeenCalled();

    // 新しい配信が起動して、版が変わった
    server.down = false;
    server.status = {
      ...server.status,
      token: 'c'.repeat(32),
      current: { version: '2.2.0' },
      update: {
        ...(server.status.update as Json),
        phase: 'done',
        progress: null,
        finishedAt: '2026-11-20T01:31:00Z',
      },
    };
    await settle(1000);
    expect(getUpdaterView().flow).toBe('sw');
    expect(m.checkForUpdateNow).toHaveBeenCalledTimes(1);

    // 新しい Service Worker の準備の進み具合
    setOff({ progress: { done: 3, total: 10 } });
    expect(getUpdaterView().swProgress).toEqual({ done: 3, total: 10 });
    expect(m.applyUpdate).not.toHaveBeenCalled();

    // 準備ができた → 保護者画面なので読み込み直す
    setOff({ progress: null, updateReady: true });
    expect(getUpdaterView().flow).toBe('reloading');
    expect(m.applyUpdate).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('mnw:update:reloaded')).toBe('2.2.0');

    // 何度状態が変わっても、読み込み直しは 1 回だけ
    setOff({ version: 'v2' });
    setOff({ updateReady: true, error: null });
    await settle(5000);
    expect(m.applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('restarting のあいだも waiting-server。版が押した版になっても、作業中の段階のあいだは進めない', async () => {
    await refreshUpdaterStatus();
    await requestApply('2.2.0');
    // 古い配信が、切り替え済みの版を返しながら再起動を始めた
    server.status = {
      ...server.status,
      current: { version: '2.2.0' },
      update: { ...(server.status.update as Json), phase: 'restarting' },
    };
    await settle(1000);
    expect(getUpdaterView().flow).toBe('waiting-server');
    expect(m.checkForUpdateNow).not.toHaveBeenCalled();
    server.update({ phase: 'done' });
    await settle(1000);
    expect(getUpdaterView().flow).toBe('sw');
  });

  it('120 秒読めなければ server-timeout', async () => {
    await refreshUpdaterStatus();
    await requestApply('2.2.0');
    server.down = true;
    await settle(60_000);
    expect(getUpdaterView().flow).toBe('waiting-server');
    await settle(61_000);
    expect(getUpdaterView()).toMatchObject({ flow: 'failed', flowError: 'server-timeout' });
  });

  it('配信が failed になったら、その理由のコードで failed', async () => {
    await refreshUpdaterStatus();
    await requestApply('2.2.0');
    server.update({
      phase: 'failed',
      error: { code: 'sha256-mismatch', detail: 'x' },
      finishedAt: '2026-11-20T01:32:00Z',
    });
    await settle(1000);
    expect(getUpdaterView()).toMatchObject({ flow: 'failed', flowError: 'sha256-mismatch' });
    // 失敗のあとは、保護者画面を開いているあいだ 30 秒ごとだけ読む
    const gets = server.gets;
    await settle(5000);
    expect(server.gets).toBe(gets);
    await settle(30_000);
    expect(server.gets).toBeGreaterThan(gets);
  });

  it('cancelled なら流れを終える（none）', async () => {
    await refreshUpdaterStatus();
    await requestApply('2.2.0');
    await requestCancel();
    expect(server.posts.at(-1)?.path).toBe('cancel');
    server.update({ phase: 'cancelled', finishedAt: '2026-11-20T01:32:00Z' });
    await settle(1000);
    expect(getUpdaterView()).toMatchObject({ flow: 'none', flowError: null });
  });

  it('前回の failed が残っているだけの状態では失敗にしない（今回の結果を待つ）', async () => {
    server.update({
      phase: 'failed',
      targetVersion: '2.2.0',
      startedAt: '2026-11-19T01:00:00Z',
      error: { code: 'offline', detail: 'old' },
    });
    await refreshUpdaterStatus();
    // 受け付けたが、配信の状態はまだ前回のまま
    server.respond.apply = () => json({ ok: true, status: server.status }, 202);
    await requestApply('2.2.0');
    expect(getUpdaterView().flow).toBe('server');
    await settle(1000);
    expect(getUpdaterView().flow).toBe('server');
    // 今回の作業が始まった
    server.update({ phase: 'downloading', startedAt: '2026-11-20T01:30:00Z', error: null });
    await settle(1000);
    expect(getUpdaterView().flow).toBe('server');
    expect(getUpdaterView().status?.update.phase).toBe('downloading');
  });

  it('押したのに配信が何も始めなければ interrupted', async () => {
    await refreshUpdaterStatus();
    server.respond.apply = () => json({ ok: true, status: server.status }, 202);
    await requestApply('2.2.0');
    await settle(29_000);
    expect(getUpdaterView().flow).toBe('server');
    await settle(2000);
    expect(getUpdaterView()).toMatchObject({ flow: 'failed', flowError: 'interrupted' });
  });

  it('apply が断られたら、そのコードで failed（busy・blocked など）', async () => {
    await refreshUpdaterStatus();
    server.respond.apply = () =>
      json({ ok: false, error: { code: 'blocked', detail: 'min-version' } }, 409);
    const r = await requestApply('2.2.0');
    expect(r).toMatchObject({ ok: false, code: 'blocked' });
    expect(getUpdaterView()).toMatchObject({ flow: 'failed', flowError: 'blocked' });
  });

  it('流れの途中でもう一度押しても、送らない（busy）', async () => {
    await refreshUpdaterStatus();
    await requestApply('2.2.0');
    const posts = server.posts.length;
    const r = await requestApply('2.2.0');
    expect(r).toMatchObject({ ok: false, code: 'busy' });
    expect(server.posts).toHaveLength(posts);
    expect(getUpdaterView().flow).toBe('server');
  });

  it('失敗のあとの「もう一度ためす」: 流れを最初からやり直す', async () => {
    await refreshUpdaterStatus();
    server.respond.apply = () => json({ ok: false, error: { code: 'busy', detail: 'x' } }, 409);
    await requestApply('2.2.0');
    expect(getUpdaterView().flow).toBe('failed');
    delete server.respond.apply;
    await requestApply('2.2.0');
    expect(getUpdaterView()).toMatchObject({ flow: 'server', flowError: null });
  });

  it('配信がすでにその版なら、頼まずにアプリの準備から始める（sw-failed などのやり直し）', async () => {
    server.status = { ...server.status, current: { version: '2.2.0' } };
    await refreshUpdaterStatus();
    const r = await requestApply('2.2.0');
    expect(r.ok).toBe(true);
    expect(server.posts).toHaveLength(0);
    expect(getUpdaterView().flow).toBe('sw');
    expect(m.checkForUpdateNow).toHaveBeenCalledTimes(1);
  });

  it('not-newer で断られても、読み直したら配信がその版なら、アプリの準備から始める', async () => {
    await refreshUpdaterStatus();
    server.respond.apply = () => {
      server.status = { ...server.status, current: { version: '2.2.0' } };
      return json({ ok: false, error: { code: 'not-newer', detail: 'same' } }, 409);
    };
    const r = await requestApply('2.2.0');
    expect(r.ok).toBe(true);
    expect(getUpdaterView().flow).toBe('sw');
  });
});

describe('Service Worker の新しい版の準備（sw）', () => {
  async function toSw(): Promise<void> {
    server.status = { ...server.status, current: { version: '2.2.0' } };
    await refreshUpdaterStatus();
    await requestApply('2.2.0');
    expect(getUpdaterView().flow).toBe('sw');
  }

  it('子供が遊んでいる画面（#/home など）では読み込み直さず、保護者画面になったら読み込み直す', async () => {
    setHash('#/home');
    await toSw();
    setOff({ updateReady: true });
    expect(getUpdaterView().flow).toBe('sw');
    expect(m.applyUpdate).not.toHaveBeenCalled();

    setHash('#/play/math');
    window.dispatchEvent(new Event('hashchange'));
    expect(m.applyUpdate).not.toHaveBeenCalled();

    setHash('#/parent/about');
    window.dispatchEvent(new Event('hashchange'));
    expect(getUpdaterView().flow).toBe('reloading');
    expect(m.applyUpdate).toHaveBeenCalledTimes(1);
  });

  it.each(['', '#', '#/', '#/start', '#/parent', '#/parent/about', '#/parent/packs'])(
    '読み込み直してよい画面: %s',
    async (hash) => {
      setHash(hash);
      await toSw();
      setOff({ updateReady: true });
      expect(m.applyUpdate).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['#/home', '#/notebook', '#/play/math', '#/unit/g3.math.x', '#/draw'])(
    '読み込み直さない画面: %s',
    async (hash) => {
      setHash(hash);
      await toSw();
      setOff({ updateReady: true });
      expect(m.applyUpdate).not.toHaveBeenCalled();
    },
  );

  it('準備に失敗（OfflineState.error）したら sw-failed', async () => {
    await toSw();
    setOff({ error: 'あたらしい ばーじょんの じゅんびに しっぱいしました' });
    expect(getUpdaterView()).toMatchObject({ flow: 'failed', flowError: 'sw-failed' });
    expect(m.applyUpdate).not.toHaveBeenCalled();
  });

  it.each(['error', 'unsupported'] as const)(
    'Service Worker を準備できない環境（%s）では、待たずに sw-failed',
    async (status) => {
      setOff({ status, error: status === 'error' ? 'x' : null });
      server.status = { ...server.status, current: { version: '2.2.0' } };
      await refreshUpdaterStatus();
      await requestApply('2.2.0');
      expect(getUpdaterView()).toMatchObject({ flow: 'failed', flowError: 'sw-failed' });
    },
  );

  it('10 分で準備が終わらなければ sw-failed。準備が始まっていないあいだは確認をやり直す', async () => {
    await toSw();
    expect(m.checkForUpdateNow).toHaveBeenCalledTimes(1);
    await settle(60_000);
    expect(m.checkForUpdateNow.mock.calls.length).toBeGreaterThan(3);
    await settle(9 * 60_000 + 1000);
    expect(getUpdaterView()).toMatchObject({ flow: 'failed', flowError: 'sw-failed' });
  });

  it('準備が進んでいるあいだは、確認をやり直さない', async () => {
    await toSw();
    setOff({ progress: { done: 1, total: 5 } });
    m.checkForUpdateNow.mockClear();
    await settle(60_000);
    expect(m.checkForUpdateNow).not.toHaveBeenCalled();
  });

  it('子供の画面で待っているあいだは、10 分たっても失敗にしない（準備はできている）', async () => {
    setHash('#/home');
    await toSw();
    setOff({ updateReady: true });
    await settle(11 * 60_000);
    expect(getUpdaterView().flow).toBe('sw');
    setHash('#/parent/about');
    window.dispatchEvent(new Event('hashchange'));
    expect(m.applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('applyUpdate のあと読み込み直しが起きなければ sw-mismatch', async () => {
    await toSw();
    setOff({ updateReady: true });
    await settle(1000);
    expect(getUpdaterView().flow).toBe('reloading');
    await settle(16_000);
    expect(getUpdaterView()).toMatchObject({ flow: 'failed', flowError: 'sw-mismatch' });
  });
});

// ---------------------------------------------------------------- 起動したとき

describe('startUpdater（起動したとき）', () => {
  it('窓口なし（404）なら何もしない', async () => {
    __testing.setFetch(async () => json({ error: 'not found' }, 404));
    startUpdater();
    await settle(60_000);
    expect(getUpdaterView()).toMatchObject({ available: false, status: null, flow: 'none' });
    expect(m.checkForUpdateNow).not.toHaveBeenCalled();
    expect(m.downloadedLists).toEqual([]);
  });

  it('窓口なし（vite preview の index.html）でも何もしない。状態は 1 回しか読まない', async () => {
    const f = vi.fn(async () => json('<html></html>', 200, 'text/html'));
    __testing.setFetch(f);
    startUpdater();
    await settle(120_000);
    expect(f).toHaveBeenCalledTimes(1);
    expect(getUpdaterView().available).toBe(false);
  });

  it('配信の版がアプリの版より新しければ、Service Worker の準備を自動で始め、読み込み直す', async () => {
    server.status = { ...server.status, current: { version: '2.2.0' } };
    startUpdater();
    await settle();
    expect(getUpdaterView()).toMatchObject({ available: true, flow: 'sw' });
    expect(m.checkForUpdateNow).toHaveBeenCalledTimes(1);
    setOff({ updateReady: true });
    expect(m.applyUpdate).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('mnw:update:reloaded')).toBe('2.2.0');
  });

  it('読み込み直してもまだ違い、同じ印があれば、自動では読み込み直さず sw-mismatch', async () => {
    sessionStorage.setItem('mnw:update:reloaded', '2.2.0');
    server.status = { ...server.status, current: { version: '2.2.0' } };
    startUpdater();
    await settle();
    expect(getUpdaterView()).toMatchObject({ flow: 'failed', flowError: 'sw-mismatch' });
    expect(m.checkForUpdateNow).not.toHaveBeenCalled();
    setOff({ updateReady: true });
    expect(m.applyUpdate).not.toHaveBeenCalled();
  });

  it('印が別の版なら、自動で始める', async () => {
    sessionStorage.setItem('mnw:update:reloaded', '2.1.5');
    server.status = { ...server.status, current: { version: '2.2.0' } };
    startUpdater();
    await settle();
    expect(getUpdaterView().flow).toBe('sw');
  });

  it('sessionStorage が使えなくても、自動の読み込み直しはしない（繰り返しを防げないため）', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      server.status = { ...server.status, current: { version: '2.2.0' } };
      startUpdater();
      await settle();
      setOff({ updateReady: true });
      expect(m.applyUpdate).not.toHaveBeenCalled();
      expect(getUpdaterView()).toMatchObject({ flow: 'failed', flowError: 'sw-mismatch' });
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });

  it('版が X.Y.Z でなければ（開発中の dev など）何もしない', async () => {
    __testing.setAppVersion('dev');
    server.status = { ...server.status, current: { version: '2.2.0' } };
    m.index = { 'g3-math': {} };
    m.statuses = [{ packId: 'g3-math', state: 'outdated', bytes: 10 }];
    startUpdater();
    await settle(1000);
    expect(getUpdaterView().flow).toBe('none');
    expect(m.checkForUpdateNow).not.toHaveBeenCalled();
    expect(m.downloadedLists).toEqual([]);
  });

  it('配信が作業中なら、流れの続きから（downloading）。終わったら Service Worker の準備へ', async () => {
    server.update({
      phase: 'downloading',
      targetVersion: '2.2.0',
      startedAt: '2026-11-20T01:30:00Z',
      progress: { doneBytes: 10, totalBytes: 100, part: 'main', partIndex: 1, partCount: 1 },
    });
    startUpdater();
    await settle();
    expect(getUpdaterView().flow).toBe('server');
    server.status = { ...server.status, current: { version: '2.2.0' } };
    server.update({ phase: 'done' });
    await settle(1000);
    expect(getUpdaterView().flow).toBe('sw');
  });

  it('配信が restarting なら waiting-server から続ける', async () => {
    server.update({ phase: 'restarting', targetVersion: '2.2.0' });
    startUpdater();
    await settle();
    expect(getUpdaterView().flow).toBe('waiting-server');
  });
});

describe('startUpdater: 取得済みの教材パックの取り直し', () => {
  const statuses: FakePackStatus[] = [
    { packId: 'g3-math', state: 'outdated', bytes: 100 },
    { packId: 'g3-ja', state: 'ready', bytes: 100 },
    { packId: 'g4-math', state: 'not-downloaded', bytes: 100 },
    { packId: 'g5-math', state: 'outdated', bytes: 300 },
    { packId: 'p4', state: 'core', bytes: 0 },
  ];

  beforeEach(() => {
    m.index = { 'g3-math': {}, 'g3-ja': {}, 'g4-math': {}, 'g5-math': {} };
    m.statuses = statuses;
  });

  it('版が古い（outdated）パックだけを取り直す。未取得・取得済み・本体同梱には触らない', async () => {
    startUpdater();
    await settle();
    expect(m.downloadedLists).toEqual([['g3-math', 'g5-math']]);
    expect(getUpdaterView().flow).toBe('none'); // 取り直しが終わった
  });

  it('取り直しているあいだは flow packs と進み具合', async () => {
    let release: () => void = () => undefined;
    m.downloadGate = new Promise<void>((r) => {
      release = r;
    });
    startUpdater();
    await settle();
    expect(getUpdaterView()).toMatchObject({
      flow: 'packs',
      packs: { done: 0, total: 2, doneBytes: 0, totalBytes: 400 },
    });
    release();
    await settle();
    expect(getUpdaterView().flow).toBe('none');
    expect(getUpdaterView().packs).toBeNull();
  });

  it('outdated が無ければ何もしない', async () => {
    m.statuses = statuses.filter((s) => s.state !== 'outdated');
    startUpdater();
    await settle();
    expect(m.downloadedLists).toEqual([]);
    expect(getUpdaterView().flow).toBe('none');
  });

  it('配信の版がアプリの版と違うときは取り直さない', async () => {
    server.status = { ...server.status, current: { version: '2.0.2' } };
    startUpdater();
    await settle();
    expect(m.downloadedLists).toEqual([]);
    server.status = { ...server.status, current: { version: '2.2.0' } };
    __testing.reset();
    __testing.setFetch(server.fetch);
    __testing.setAppVersion('2.1.0');
    startUpdater();
    await settle();
    expect(m.downloadedLists).toEqual([]); // こちらは Service Worker の準備に進む
    expect(getUpdaterView().flow).toBe('sw');
  });

  it('窓口がなければ取り直さない', async () => {
    __testing.setFetch(async () => json({}, 404));
    startUpdater();
    await settle(1000);
    expect(m.downloadedLists).toEqual([]);
  });

  it('1 回の起動で 1 回だけ。失敗しても繰り返さない', async () => {
    m.downloadFailures = [{ packId: 'g3-math', reason: 'offline' }];
    startUpdater();
    startUpdater();
    await settle();
    await settle(60_000);
    expect(m.downloadedLists).toHaveLength(1);
    expect(getUpdaterView().flow).toBe('none');
  });

  it('パックの一覧が読めなければ何もしない', async () => {
    m.index = null;
    startUpdater();
    await settle();
    expect(m.downloadedLists).toEqual([]);
  });

  it('整理（reconcilePacks）が終わり、コアの準備がそろうまで待つ', async () => {
    let done: () => void = () => undefined;
    const reconciled = new Promise<void>((r) => {
      done = r;
    });
    setOff({ status: 'installing' });
    startUpdater(reconciled);
    await settle();
    expect(m.downloadedLists).toEqual([]);
    done();
    await settle();
    expect(m.downloadedLists).toEqual([]); // コアがまだ
    setOff({ status: 'ready' });
    await settle();
    expect(m.downloadedLists).toEqual([['g3-math', 'g5-math']]);
  });

  it('コアの準備に失敗したら取り直さない', async () => {
    setOff({ status: 'installing' });
    startUpdater();
    await settle();
    setOff({ status: 'error', error: 'x' });
    await settle(1000);
    expect(m.downloadedLists).toEqual([]);
  });
});

// ---------------------------------------------------------------- 状態を読む間隔

describe('状態を読む間隔', () => {
  it('保護者画面を開いているあいだは 30 秒ごと。ほかの画面では読まない', async () => {
    startUpdater();
    await settle();
    expect(server.gets).toBe(1);
    await settle(29_000);
    expect(server.gets).toBe(1);
    await settle(1500);
    expect(server.gets).toBe(2);
    await settle(30_000);
    expect(server.gets).toBe(3);

    // 子供の画面へ
    setHash('#/home');
    window.dispatchEvent(new Event('hashchange'));
    await settle(120_000);
    expect(server.gets).toBe(3);
  });

  it('保護者画面を開いたときは、すぐ読み直す', async () => {
    setHash('#/home');
    startUpdater();
    await settle();
    expect(server.gets).toBe(1);
    await settle(120_000);
    expect(server.gets).toBe(1);
    setHash('#/parent/about');
    window.dispatchEvent(new Event('hashchange'));
    await settle();
    expect(server.gets).toBe(2);
  });

  it('確認中（checking）のあいだは 1 秒ごとに読んで、結果をすぐ出す', async () => {
    startUpdater();
    await settle();
    server.status = {
      ...server.status,
      check: { state: 'checking', at: null, error: null },
    };
    await requestCheck();
    expect(getUpdaterView().status?.check.state).toBe('checking');
    server.status = {
      ...server.status,
      check: { state: 'ok', at: '2026-11-20T01:40:00Z', error: null },
    };
    await settle(1000);
    expect(getUpdaterView().status?.check.state).toBe('ok');
  });

  it('作業中は 1 秒ごと（画面がどこでも）', async () => {
    setHash('#/home');
    await refreshUpdaterStatus();
    await requestApply('2.2.0');
    const gets = server.gets;
    await settle(3000);
    expect(server.gets - gets).toBe(3);
  });
});
