import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHANNEL_NAME,
  INSTANCE_TIMING as T,
  LOCK_NAME,
  LOCK_WATCH_TIMING as W,
  MULTI_WINDOW_FLAG,
  RETIRED_TITLE,
  RETIRED_URL,
  browserEnv,
  claimInstance,
  watchLockFree,
  type ChannelLike,
  type InstanceClaim,
  type InstanceEnv,
  type InstanceInfo,
  type LockManagerLike,
} from './instance';

// ---- 偽の Web Locks（1つのブラウザで共有）。ifAvailable・steal・奪われた側の AbortError を再現する
type LockOptions = { ifAvailable?: boolean; steal?: boolean };
class FakeLocks implements LockManagerLike {
  held: { abort: (err: unknown) => void } | null = null;
  names: string[] = [];
  options: LockOptions[] = [];

  request(name: string, options: LockOptions, callback: (lock: unknown) => unknown) {
    this.names.push(name);
    this.options.push(options);
    return new Promise<unknown>((resolve, reject) => {
      if (this.held) {
        if (options.steal) {
          this.held.abort(new DOMException('stolen', 'AbortError'));
          this.held = null;
        } else {
          // ifAvailable で取れなかった: callback は null で呼ばれる
          Promise.resolve(callback(null)).then(resolve, reject);
          return;
        }
      }
      const entry = { abort: reject };
      this.held = entry;
      void Promise.resolve(callback({ name })).then((v) => {
        if (this.held === entry) this.held = null;
        resolve(v);
      }, reject);
    });
  }

  /** 前の文書がなくなって鍵が外れた */
  release(): void {
    this.held = null;
  }

  /** navigator.locks.query()（いまの鍵の持ち主）。queryFails のときは失敗する */
  queryFails = false;
  queries = 0;
  async query(): Promise<{ held: { name: string }[] }> {
    this.queries++;
    if (this.queryFails) throw new Error('query failed');
    return { held: this.held ? [{ name: LOCK_NAME }] : [] };
  }
}

// ---- 偽の BroadcastChannel（同じ名前のほかの窓へ非同期に届く。自分には届かない）
type Listener = (e: { data: unknown }) => void;
class FakeBus {
  channels = new Set<FakeChannel>();
  log: unknown[] = [];
  names: string[] = [];
  open(name: string): FakeChannel {
    this.names.push(name);
    const ch = new FakeChannel(this);
    this.channels.add(ch);
    return ch;
  }
}
class FakeChannel implements ChannelLike {
  listeners = new Set<Listener>();
  constructor(private bus: FakeBus) {}
  postMessage(message: unknown): void {
    this.bus.log.push(message);
    for (const other of this.bus.channels) {
      if (other === this) continue;
      for (const l of other.listeners) void Promise.resolve().then(() => l({ data: message }));
    }
  }
  addEventListener(_type: 'message', listener: Listener): void {
    this.listeners.add(listener);
  }
  removeEventListener(_type: 'message', listener: Listener): void {
    this.listeners.delete(listener);
  }
  close(): void {
    this.bus.channels.delete(this);
  }
}

interface World {
  locks: FakeLocks;
  bus: FakeBus;
}
const newWorld = (): World => ({ locks: new FakeLocks(), bus: new FakeBus() });

interface Page {
  env: Partial<InstanceEnv>;
  titles: string[];
  closed: number;
  replaced: string[];
  reloaded: number;
  exposed: InstanceInfo[];
  pageshow: ((persisted: boolean) => void)[];
  pagehide: (() => void)[];
}
let idSeq = 0;
function newPage(world: World, overrides: Partial<InstanceEnv> = {}): Page {
  const page: Page = {
    env: {},
    titles: [],
    closed: 0,
    replaced: [],
    reloaded: 0,
    exposed: [],
    pageshow: [],
    pagehide: [],
  };
  page.env = {
    locks: world.locks,
    openChannel: (name) => world.bus.open(name),
    newId: () => `page-${++idSeq}`,
    search: '',
    testFlagOn: () => false,
    navigationType: () => 'navigate',
    framed: () => false,
    setTitle: (t) => page.titles.push(t),
    close: () => {
      page.closed++;
    },
    replace: (u) => page.replaced.push(u),
    reload: () => {
      page.reloaded++;
    },
    onPageShow: (cb) => page.pageshow.push(cb),
    onPageHide: (cb) => page.pagehide.push(cb),
    expose: (info) => page.exposed.push(info),
    ...overrides,
  };
  return page;
}

/** 結果が出たかを見張る */
function track(p: Promise<InstanceClaim>): { claim: () => InstanceClaim | null } {
  let result: InstanceClaim | null = null;
  void p.then((c) => {
    result = c;
  });
  return { claim: () => result };
}

function primary(claim: InstanceClaim | null) {
  if (!claim || claim.role !== 'primary') throw new Error(`primary ではない: ${claim?.role}`);
  return claim;
}

/** rawHolder の ID（pong・retired の from） */
const RAW_ID = 'raw-holder';

/** 鍵を持って「いる？」に答えるだけの画面（引き下がりの手順を持たない相手役）。answerAfterMs で返事を遅らせられる */
function rawHolder(world: World, answer: boolean, answerAfterMs = 0): ChannelLike {
  const ch = world.bus.open(CHANNEL_NAME);
  // 鍵を奪われたら、本物の画面と同じに、もう返事をしない
  let stolen = false;
  void world.locks
    .request(LOCK_NAME, { ifAvailable: true }, () => new Promise(() => {}))
    .catch(() => {
      stolen = true;
    });
  if (answer) {
    ch.addEventListener('message', (e) => {
      const m = e.data as { t?: string; from?: string };
      if (m.t !== 'ping' || stolen) return;
      const reply = (): void => ch.postMessage({ t: 'pong', to: m.from, from: RAW_ID });
      if (answerAfterMs > 0) setTimeout(reply, answerAfterMs);
      else reply();
    });
  }
  return ch;
}

const pings = (bus: FakeBus) => bus.log.filter((m) => (m as { t: string }).t === 'ping');
const retiredMessages = (bus: FakeBus) =>
  bus.log.filter((m) => (m as { t: string }).t === 'retired');

beforeEach(() => {
  vi.useFakeTimers();
  idSeq = 0;
});
afterEach(() => {
  vi.useRealTimers();
});

describe('claimInstance: 役割の決め方', () => {
  it('鍵が空いている → primary・takeover:false。ping を送らない', async () => {
    const world = newWorld();
    const page = newPage(world);
    const claim = primary(await claimInstance(page.env));
    expect(claim.takeover).toBe(false);
    expect(pings(world.bus)).toEqual([]);
    expect(world.locks.names).toEqual([LOCK_NAME]);
    expect(world.locks.options).toEqual([{ ifAvailable: true }]);
    expect(page.exposed).toEqual([{ role: 'primary', takeover: false }]);
    expect(page.titles).toEqual([]);
  });

  it('読み込み直しの直後: 2回取れずに3回目で取れる → ping を送らず takeover:false', async () => {
    const world = newWorld();
    world.locks.held = { abort: () => {} }; // 前の文書の鍵がまだ外れていない
    setTimeout(() => world.locks.release(), 150);
    const page = newPage(world);
    const p = track(claimInstance(page.env));
    await vi.advanceTimersByTimeAsync(T.acquireRetryMs * 2 + 1);
    expect(primary(p.claim()).takeover).toBe(false);
    expect(world.locks.options).toEqual([
      { ifAvailable: true },
      { ifAvailable: true },
      { ifAvailable: true },
    ]);
    expect(pings(world.bus)).toEqual([]);
  });

  it('生きている画面が返事 → 鍵を奪い、前の画面の「終わった」を待って takeover:true', async () => {
    const world = newWorld();
    const a = newPage(world);
    const claimA = primary(await claimInstance(a.env));
    const cleanupA = vi.fn();
    claimA.onRetire(cleanupA);

    const b = newPage(world);
    const pb = track(claimInstance(b.env));
    // 4回目（最初＋やり直し3回）が取れなかったあと、ping → pong → steal
    await vi.advanceTimersByTimeAsync(T.acquireRetryMs * T.acquireRetries + 1);
    expect(pings(world.bus)).toHaveLength(1);
    expect(world.locks.options.at(-1)).toEqual({ steal: true });
    expect(cleanupA).toHaveBeenCalledTimes(1);
    expect(a.titles).toEqual([RETIRED_TITLE]);
    expect(pb.claim()).toBeNull(); // 前の画面の後片付けが終わるまで始めない

    await vi.advanceTimersByTimeAsync(T.afterCleanupMs - 5);
    expect(retiredMessages(world.bus)).toHaveLength(0);
    expect(pb.claim()).toBeNull();
    await vi.advanceTimersByTimeAsync(10);
    expect(retiredMessages(world.bus)).toHaveLength(1);
    expect(a.closed).toBe(1);
    expect(primary(pb.claim()).takeover).toBe(true);
    expect(b.exposed).toEqual([{ role: 'primary', takeover: true }]);
  });

  it('「終わった」が来ない → 鍵を奪って、待ちが時間切れになったら始める', async () => {
    const world = newWorld();
    rawHolder(world, true); // 返事はするが、引き下がらない
    const b = newPage(world);
    const pb = track(claimInstance(b.env));
    await vi.advanceTimersByTimeAsync(T.acquireRetryMs * T.acquireRetries + 1);
    expect(world.locks.options.at(-1)).toEqual({ steal: true });
    await vi.advanceTimersByTimeAsync(T.retiredWaitMs - 10);
    expect(pb.claim()).toBeNull();
    await vi.advanceTimersByTimeAsync(20);
    expect(primary(pb.claim()).takeover).toBe(true);
  });

  it('返事がない（凍結した画面）→ 鍵を奪い、待たずに始める。takeover:false', async () => {
    const world = newWorld();
    rawHolder(world, false);
    const b = newPage(world);
    const pb = track(claimInstance(b.env));
    await vi.advanceTimersByTimeAsync(T.acquireRetryMs * T.acquireRetries + T.pingMs - 10);
    expect(pb.claim()).toBeNull();
    await vi.advanceTimersByTimeAsync(20);
    expect(world.locks.options.at(-1)).toEqual({ steal: true });
    expect(primary(pb.claim()).takeover).toBe(false);
  });

  it('離れる最中の画面（pagehide のあと）は返事をしない → 引き継ぎにならない', async () => {
    const world = newWorld();
    const a = newPage(world);
    primary(await claimInstance(a.env));
    for (const cb of a.pagehide) cb();

    const b = newPage(world);
    const pb = track(claimInstance(b.env));
    await vi.advanceTimersByTimeAsync(T.acquireRetryMs * T.acquireRetries + T.pingMs + 10);
    expect(primary(pb.claim()).takeover).toBe(false);
  });

  it('?retired があれば retired（鍵に触れない）。題名を変える', async () => {
    const world = newWorld();
    const page = newPage(world, { search: '?retired=1' });
    const claim = await claimInstance(page.env);
    expect(claim.role).toBe('retired');
    expect(page.titles).toEqual([RETIRED_TITLE]);
    expect(world.locks.names).toEqual([]);
    expect(page.exposed).toEqual([{ role: 'retired', takeover: false }]);
  });
});

describe('claimInstance: 守りなし（unsupported）', () => {
  it('navigator.locks が無い', async () => {
    const page = newPage(newWorld(), { locks: null });
    expect((await claimInstance(page.env)).role).toBe('unsupported');
  });

  it('試験の旗が立っている', async () => {
    const world = newWorld();
    const page = newPage(world, { testFlagOn: () => true });
    expect((await claimInstance(page.env)).role).toBe('unsupported');
    expect(world.locks.names).toEqual([]);
  });

  it('ほかのページの枠の中', async () => {
    const world = newWorld();
    const page = newPage(world, { framed: () => true });
    expect((await claimInstance(page.env)).role).toBe('unsupported');
    expect(world.locks.names).toEqual([]);
  });

  it('request が例外を投げる（同期）', async () => {
    const locks: LockManagerLike = {
      request: () => {
        throw new DOMException('denied', 'SecurityError');
      },
    };
    const page = newPage(newWorld(), { locks });
    expect((await claimInstance(page.env)).role).toBe('unsupported');
  });

  it('request が失敗で返る（SecurityError）', async () => {
    const locks: LockManagerLike = {
      request: () => Promise.reject(new DOMException('denied', 'SecurityError')),
    };
    const page = newPage(newWorld(), { locks });
    expect((await claimInstance(page.env)).role).toBe('unsupported');
  });

  it('ほかの画面が鍵を持っていて、知らせの口（BroadcastChannel）が無い', async () => {
    const world = newWorld();
    world.locks.held = { abort: () => {} };
    const page = newPage(world, { openChannel: () => null });
    const p = track(claimInstance(page.env));
    await vi.advanceTimersByTimeAsync(T.acquireRetryMs * T.acquireRetries + 1);
    expect(p.claim()?.role).toBe('unsupported');
    expect(world.locks.options.every((o) => o.ifAvailable)).toBe(true);
  });

  it('鍵が空いていれば、知らせの口が無くても primary', async () => {
    const page = newPage(newWorld(), { openChannel: () => null });
    expect(primary(await claimInstance(page.env)).takeover).toBe(false);
  });

  it('ブラウザの既定の環境（jsdom には navigator.locks が無い）でも落ちない', async () => {
    expect((await claimInstance()).role).toBe('unsupported');
  });

  it('旗のキーは mnw:test:multiWindow', () => {
    expect(MULTI_WINDOW_FLAG).toBe('mnw:test:multiWindow');
  });
});

describe('奪われた画面の引き下がり', () => {
  async function primaryPage(world: World, cleanup: () => void | Promise<void>) {
    const page = newPage(world);
    primary(await claimInstance(page.env)).onRetire(cleanup);
    return page;
  }
  /** 新しい画面が鍵を奪ったことにする */
  function stealFrom(world: World): void {
    void world.locks.request(LOCK_NAME, { steal: true }, () => new Promise(() => {}));
  }

  it('片付け → afterCleanupMs → 「終わった」→ window.close()。閉じなければ 0.3 秒後に ./?retired=1 へ置き換え', async () => {
    const world = newWorld();
    const cleanup = vi.fn();
    const page = await primaryPage(world, cleanup);

    stealFrom(world);
    await vi.advanceTimersByTimeAsync(0);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(page.titles).toEqual([RETIRED_TITLE]);
    expect(page.closed).toBe(0);

    await vi.advanceTimersByTimeAsync(T.afterCleanupMs - 1);
    expect(page.closed).toBe(0);
    expect(retiredMessages(world.bus)).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(retiredMessages(world.bus)).toHaveLength(1);
    expect(page.closed).toBe(1);
    expect(page.replaced).toEqual([]);

    await vi.advanceTimersByTimeAsync(T.closeCheckMs - 1);
    expect(page.replaced).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(page.replaced).toEqual([RETIRED_URL]);
    expect(RETIRED_URL).toBe('./?retired=1');
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('片付けが Promise を返すなら、それが終わってから afterCleanupMs 待つ', async () => {
    const world = newWorld();
    let finish!: () => void;
    const cleanup = () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      });
    const page = await primaryPage(world, cleanup);
    stealFrom(world);
    await vi.advanceTimersByTimeAsync(300);
    expect(page.closed).toBe(0);
    finish();
    await vi.advanceTimersByTimeAsync(T.afterCleanupMs - 1);
    expect(page.closed).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(page.closed).toBe(1);
  });

  it('片付けが固まる → cleanupMaxMs（4 秒）で打ち切って閉じる', async () => {
    const world = newWorld();
    const page = await primaryPage(world, () => new Promise<void>(() => {}));
    stealFrom(world);
    await vi.advanceTimersByTimeAsync(T.cleanupMaxMs - 1);
    expect(page.closed).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(page.closed).toBe(1);
  });

  it('片付けが失敗しても閉じる', async () => {
    const world = newWorld();
    const page = await primaryPage(world, () => {
      throw new Error('boom');
    });
    stealFrom(world);
    await vi.advanceTimersByTimeAsync(T.afterCleanupMs);
    expect(page.closed).toBe(1);
  });

  it('引き下がり中は pong を返さない', async () => {
    const world = newWorld();
    await primaryPage(world, () => {});
    const third = world.bus.open(CHANNEL_NAME);
    const heard: unknown[] = [];
    third.addEventListener('message', (e) => heard.push(e.data));

    stealFrom(world);
    await vi.advanceTimersByTimeAsync(10);
    third.postMessage({ t: 'ping', from: 'someone' });
    await vi.advanceTimersByTimeAsync(10);
    expect(heard.filter((m) => (m as { t: string }).t === 'pong')).toEqual([]);
  });

  it('片付けの登録より先に奪われた（ほぼ同時に2つ開いた）→ 登録されたときに片付けだけ今する', async () => {
    const world = newWorld();
    const page = newPage(world);
    const claim = primary(await claimInstance(page.env));
    stealFrom(world);
    await vi.advanceTimersByTimeAsync(10);
    const cleanup = vi.fn();
    claim.onRetire(cleanup);
    await vi.advanceTimersByTimeAsync(0);
    expect(cleanup).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(T.closeCheckMs + 10);
    expect(page.closed).toBe(1);
  });

  describe('始める前（引き継ぎ待ちのあいだ）にさらに新しい画面に奪われた', () => {
    /**
     * a（最初の画面。引き下がらない相手役）→ b（a から引き継ぎ待ち）→ c（b から奪う）の順に開く。
     * c が鍵を奪って b が引き下がり始めるところまで進める。a の channel を返す（「終わった」を送らせるため）
     */
    async function threeScreens(world: World) {
      const a = rawHolder(world, true);
      const b = newPage(world);
      const pb = track(claimInstance(b.env));
      await vi.advanceTimersByTimeAsync(T.acquireRetryMs * T.acquireRetries + 1);
      expect(world.locks.options.at(-1)).toEqual({ steal: true }); // b は鍵を奪って待っている
      expect(pb.claim()).toBeNull();

      await vi.advanceTimersByTimeAsync(200);
      const c = newPage(world);
      const pc = track(claimInstance(c.env));
      await vi.advanceTimersByTimeAsync(T.acquireRetryMs * T.acquireRetries + 1);
      return { a, b, c, pb, pc };
    }

    it('b は a の片付けが終わる前に「終わった」を送らない。c も a の「終わった」まで始めない', async () => {
      const world = newWorld();
      const { a, b, c, pb, pc } = await threeScreens(world);

      // c が b から鍵を奪った。a の「終わった」はまだ来ていない
      expect(b.titles).toEqual([RETIRED_TITLE]);
      await vi.advanceTimersByTimeAsync(500);
      expect(retiredMessages(world.bus)).toHaveLength(0);
      expect(pb.claim()).toBeNull();
      expect(b.closed).toBe(0);
      expect(pc.claim()).toBeNull();

      // a の片付けが終わった
      a.postMessage({ t: 'retired', from: RAW_ID });
      await vi.advanceTimersByTimeAsync(0);
      expect(pb.claim()?.role).toBe('superseded');
      expect(b.closed).toBe(1);
      expect(b.exposed).toEqual([{ role: 'superseded', takeover: false }]);
      expect(primary(pc.claim()).takeover).toBe(true);
      expect(c.exposed).toEqual([{ role: 'primary', takeover: true }]);
      // 閉じられなければ、置き換わる
      await vi.advanceTimersByTimeAsync(T.closeCheckMs + 1);
      expect(b.replaced).toEqual([RETIRED_URL]);
    });

    it('a の「終わった」が来ない → b の待ちが時間切れになるまで、b は送らず、c も始めない', async () => {
      const world = newWorld();
      const { b, pb, pc } = await threeScreens(world);
      // b は 300ms（やり直し3回のあと）に鍵を奪って待ち始めた。待ちの終わりは 300 + retiredWaitMs。
      // threeScreens の終わりは、そこから 1 + 200 + 300 + 1 ms あとで、b の待ちの終わりの 10ms 手前まで進める
      const bWaitEnds = T.acquireRetryMs * T.acquireRetries + T.retiredWaitMs;
      const now = T.acquireRetryMs * T.acquireRetries * 2 + 2 + 200;
      await vi.advanceTimersByTimeAsync(bWaitEnds - now - 10);
      expect(retiredMessages(world.bus)).toHaveLength(0);
      expect(pb.claim()).toBeNull();
      expect(pc.claim()).toBeNull();
      expect(b.closed).toBe(0);

      await vi.advanceTimersByTimeAsync(20);
      expect(pb.claim()?.role).toBe('superseded');
      expect(b.closed).toBe(1);
      expect(retiredMessages(world.bus)).toHaveLength(1);
      expect(primary(pc.claim()).takeover).toBe(true);
    });
  });
});

describe('キャッシュから戻ったとき', () => {
  it('pageshow(persisted) → 読み込み直す。persisted でなければ何もしない', async () => {
    const world = newWorld();
    const page = newPage(world);
    primary(await claimInstance(page.env));
    expect(page.pageshow).toHaveLength(1);
    page.pageshow[0]!(false);
    expect(page.reloaded).toBe(0);
    page.pageshow[0]!(true);
    expect(page.reloaded).toBe(1);
  });
});

describe('claimInstance: 返事の待ちと開かれ方', () => {
  const settle = T.acquireRetryMs * T.acquireRetries;

  it('手元が少しふさがって返事が 0.7 秒遅れた画面は、凍結とは見なさない → 引き継ぎ（takeover:true）', async () => {
    const world = newWorld();
    rawHolder(world, true, 700);
    const b = newPage(world);
    const pb = track(claimInstance(b.env));
    await vi.advanceTimersByTimeAsync(settle + 800);
    expect(world.locks.options.at(-1)).toEqual({ steal: true });
    expect(pb.claim()).toBeNull(); // 前の画面の「終わった」を待っている
    await vi.advanceTimersByTimeAsync(T.retiredWaitMs + 10);
    expect(primary(pb.claim()).takeover).toBe(true);
  });

  it('読み込み直し（reload）は pingReloadMs だけ待つ。返事がなければ凍結と見なして奪う', async () => {
    const world = newWorld();
    rawHolder(world, false);
    const b = newPage(world, { navigationType: () => 'reload' });
    const pb = track(claimInstance(b.env));
    await vi.advanceTimersByTimeAsync(settle + T.pingReloadMs - 10);
    expect(pb.claim()).toBeNull();
    await vi.advanceTimersByTimeAsync(20);
    expect(world.locks.options.at(-1)).toEqual({ steal: true });
    expect(primary(pb.claim()).takeover).toBe(false);
    expect(T.pingReloadMs).toBeLessThan(T.pingMs);
  });

  it('「戻る」「進む」の読み込み（back_forward）で、生きている画面がいたら、奪わずに引き下がる', async () => {
    const world = newWorld();
    const a = newPage(world);
    const claimA = primary(await claimInstance(a.env));
    const cleanupA = vi.fn();
    claimA.onRetire(cleanupA);

    const b = newPage(world, { navigationType: () => 'back_forward' });
    const pb = track(claimInstance(b.env));
    await vi.advanceTimersByTimeAsync(settle + 10);
    expect(pb.claim()).toEqual({ role: 'retired' });
    expect(b.titles).toEqual([RETIRED_TITLE]);
    expect(b.exposed).toEqual([{ role: 'retired', takeover: false }]);
    expect(world.locks.options.some((o) => o.steal)).toBe(false);
    expect(cleanupA).not.toHaveBeenCalled();
    expect(a.closed).toBe(0);
    expect(a.titles).toEqual([]);
  });

  it('back_forward でも、返事がなければ（凍結した画面）今までどおり奪う', async () => {
    const world = newWorld();
    rawHolder(world, false);
    const b = newPage(world, { navigationType: () => 'back_forward' });
    const pb = track(claimInstance(b.env));
    await vi.advanceTimersByTimeAsync(settle + T.pingMs + 10);
    expect(world.locks.options.at(-1)).toEqual({ steal: true });
    expect(primary(pb.claim()).takeover).toBe(false);
  });

  it('自分の ping に答えた画面の「終わった」だけを待つ。関係ない画面の「終わった」では始めない', async () => {
    const world = newWorld();
    const a = rawHolder(world, true);
    const b = newPage(world);
    const pb = track(claimInstance(b.env));
    await vi.advanceTimersByTimeAsync(settle + 10);
    expect(world.locks.options.at(-1)).toEqual({ steal: true });

    const other = world.bus.open(CHANNEL_NAME);
    other.postMessage({ t: 'retired', from: 'someone-else' });
    other.postMessage({ t: 'retired' }); // 送り主なし
    await vi.advanceTimersByTimeAsync(50);
    expect(pb.claim()).toBeNull();

    a.postMessage({ t: 'retired', from: RAW_ID });
    await vi.advanceTimersByTimeAsync(0);
    expect(primary(pb.claim()).takeover).toBe(true);
  });

  it('送り主の無い pong は、返事と見なさない（凍結した画面と同じ扱い）', async () => {
    const world = newWorld();
    const holder = rawHolder(world, false);
    holder.addEventListener('message', (e) => {
      const m = e.data as { t?: string; from?: string };
      if (m.t === 'ping') holder.postMessage({ t: 'pong', to: m.from });
    });
    const b = newPage(world);
    const pb = track(claimInstance(b.env));
    await vi.advanceTimersByTimeAsync(settle + T.pingMs + 10);
    expect(primary(pb.claim()).takeover).toBe(false);
  });

  it('新しい画面の待ち（retiredWaitMs）は、前の画面の後片付けの上限（cleanupMaxMs）より長い', () => {
    expect(T.retiredWaitMs).toBeGreaterThan(T.cleanupMaxMs + T.afterCleanupMs);
  });
});

describe('引き下がるときに、時間のかかる保存を待つ', () => {
  it('3 秒かかる保存が終わるまで「終わった」を送らず、閉じない。終わったら afterCleanupMs のあとで閉じる', async () => {
    const world = newWorld();
    const page = newPage(world);
    const claim = primary(await claimInstance(page.env));
    claim.onRetire(() => new Promise<void>((resolve) => setTimeout(resolve, 3000)));
    void world.locks.request(LOCK_NAME, { steal: true }, () => new Promise(() => {}));

    await vi.advanceTimersByTimeAsync(2999);
    expect(retiredMessages(world.bus)).toHaveLength(0);
    expect(page.closed).toBe(0);
    await vi.advanceTimersByTimeAsync(1 + T.afterCleanupMs - 1);
    expect(page.closed).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(retiredMessages(world.bus)).toEqual([{ t: 'retired', from: 'page-1' }]);
    expect(page.closed).toBe(1);
  });
});

describe('browserEnv', () => {
  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('試験の旗は sessionStorage から読む（localStorage に消し忘れが残っていても守りは切れない）', () => {
    const env = browserEnv();
    localStorage.setItem(MULTI_WINDOW_FLAG, '1');
    expect(env.testFlagOn()).toBe(false);
    sessionStorage.setItem(MULTI_WINDOW_FLAG, '1');
    expect(env.testFlagOn()).toBe(true);
  });

  it('開かれ方が分からなければ navigate', () => {
    expect(browserEnv().navigationType()).toBe('navigate');
  });
});

describe('watchLockFree: 鍵が空いたら戻る', () => {
  function setup(world: World, overrides: Parameters<typeof watchLockFree>[1] = {}) {
    const onFree = vi.fn();
    const visible = new Set<() => void>();
    const stop = watchLockFree(onFree, {
      query: () => world.locks.query(),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
      now: () => Date.now(),
      onVisible: (cb) => {
        visible.add(cb);
        return () => visible.delete(cb);
      },
      ...overrides,
    });
    return { onFree, stop, visible };
  }
  const holdLock = (world: World): void => {
    world.locks.held = { abort: () => {} };
  };

  it('鍵が持たれているあいだは、いつまでたっても戻らない', async () => {
    const world = newWorld();
    holdLock(world);
    const { onFree } = setup(world);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(world.locks.queries).toBeGreaterThan(10);
    expect(onFree).not.toHaveBeenCalled();
  });

  it('空いているのが続けて 2 回出たら、1 回だけ戻る。そのあとは調べない', async () => {
    const world = newWorld();
    const { onFree } = setup(world);
    await vi.advanceTimersByTimeAsync(W.intervalMs + 1);
    expect(onFree).not.toHaveBeenCalled(); // 1 回目の「空いている」
    await vi.advanceTimersByTimeAsync(W.intervalMs);
    expect(onFree).toHaveBeenCalledTimes(1);
    const queries = world.locks.queries;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(onFree).toHaveBeenCalledTimes(1);
    expect(world.locks.queries).toBe(queries);
  });

  it('一瞬だけ空いても（更新の読み込み直し）戻らない。持たれていれば数え直す', async () => {
    const world = newWorld();
    const { onFree } = setup(world);
    await vi.advanceTimersByTimeAsync(W.intervalMs + 1); // 空いている（1 回目）
    holdLock(world); // 新しい文書が鍵を取った
    await vi.advanceTimersByTimeAsync(W.intervalMs); // 持たれている → 数え直し
    world.locks.release();
    await vi.advanceTimersByTimeAsync(W.intervalMs); // 空いている（また 1 回目）
    expect(onFree).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(W.intervalMs);
    expect(onFree).toHaveBeenCalledTimes(1);
  });

  it('調べられないとき（query が失敗）は、空いたと見なさない', async () => {
    const world = newWorld();
    world.locks.queryFails = true;
    const { onFree } = setup(world);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(onFree).not.toHaveBeenCalled();
    expect(world.locks.queries).toBeGreaterThan(5);
  });

  it('query が無いブラウザでは何もしない', async () => {
    const world = newWorld();
    const { onFree, stop } = setup(world, { query: null });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(onFree).not.toHaveBeenCalled();
    expect(world.locks.queries).toBe(0);
    expect(() => stop()).not.toThrow();
  });

  it('見えるようになったときにも調べる。ただし直前の調べから minGapMs たたないうちは調べない', async () => {
    const world = newWorld();
    const { onFree, visible } = setup(world);
    await vi.advanceTimersByTimeAsync(W.intervalMs + 1); // 調べた（空いている 1 回目）
    expect(world.locks.queries).toBe(1);
    for (const cb of visible) cb(); // すぐに見えるようになった: 間が短いので調べない
    await vi.advanceTimersByTimeAsync(1);
    expect(world.locks.queries).toBe(1);
    await vi.advanceTimersByTimeAsync(W.minGapMs);
    for (const cb of visible) cb(); // 間が空いた: 調べる（空いている 2 回目）
    await vi.advanceTimersByTimeAsync(1);
    expect(world.locks.queries).toBe(2);
    expect(onFree).toHaveBeenCalledTimes(1);
  });

  it('止めたあとは調べず、戻りもしない。見える知らせの聞き手も外す', async () => {
    const world = newWorld();
    const { onFree, stop, visible } = setup(world);
    expect(visible.size).toBe(1);
    stop();
    expect(visible.size).toBe(0);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(world.locks.queries).toBe(0);
    expect(onFree).not.toHaveBeenCalled();
  });

  it('ほかの名前の鍵が持たれているだけなら、空いていると見なす', async () => {
    const world = newWorld();
    const { onFree } = setup(world, {
      query: async () => ({ held: [{ name: 'something-else' }] }),
    });
    await vi.advanceTimersByTimeAsync(W.intervalMs * 2 + 2);
    expect(onFree).toHaveBeenCalledTimes(1);
  });
});
