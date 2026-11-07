import { isFramed } from '../framed';

/**
 * 画面は常に1つ（二重起動の防止。アプリの中の保険）。
 * 設計: docs/expansion/single-instance-design.md 2.3 節。同じブラウザ・同じプロファイルで動く画面を Web Locks で1つにする。
 *
 * - 鍵 `manabi-no-niwa:main` を持つ画面が「書く画面」（primary）。ほかの画面が開いたら、新しい画面が鍵を奪い、
 *   前の画面は保存を済ませて自分を閉じる（引き継ぎ。takeover）。
 * - 閉じられなかった前の画面は `./?retired=1` に置き換わる（「べつの まどで ひらいています」だけを出す）。
 * - 窓を前に出す・全画面にするのは OS の側（起動スクリプト）の仕事で、ここでは扱わない。
 *
 * React に依存しない。`navigator.locks`・`BroadcastChannel`・時計・`window.close`・`location.replace` は
 * InstanceEnv で差し替えられる（試験のため）。
 */

/** Web Locks の鍵の名前 */
export const LOCK_NAME = 'manabi-no-niwa:main';
/** 画面同士の知らせ（BroadcastChannel）の名前 */
export const CHANNEL_NAME = 'manabi-no-niwa:instance';
/** 試験の旗。'1' のとき、この仕組みを止める（2つのタブを同時に使う e2e のためだけ。製品では使わない） */
export const MULTI_WINDOW_FLAG = 'mnw:test:multiWindow';
/** 引き下がった画面の題名。起動スクリプトが「まなびのにわ」の窓と見まちがえて前に出さないように変える */
export const RETIRED_TITLE = 'とじた がめん（まなびのにわ）';
/** 閉じられなかった画面の置き換え先 */
export const RETIRED_URL = './?retired=1';

/**
 * 時間の定数（ミリ秒）。意味は docs/expansion/single-instance-design.md 2.3.1 の表。
 * retiredWaitMs は cleanupMaxMs より長くする（新しい画面が、前の画面の保存の待ちより先に待ちきれないように）。
 */
export const INSTANCE_TIMING = {
  /** 鍵が取れなかったときのやり直しの回数（読み込み直しの直後は、前の文書の鍵が外れるのが少し遅れる） */
  acquireRetries: 3,
  acquireRetryMs: 100,
  /** 「いる？」への返事を待つ。手元が少しふさがっているだけの画面を、凍結した画面と見まちがえないよう長めにする */
  pingMs: 1000,
  /** 読み込み直しのとき（前の文書は返事をしない）は、短く待つ */
  pingReloadMs: 400,
  /** 鍵を奪ってから、前の画面の「終わった」を待つ */
  retiredWaitMs: 5000,
  /** 引き下がるときの後片付け（片付けの関数＋終わっていない保存の待ち）の上限 */
  cleanupMaxMs: 4000,
  /** 片付けの関数のあと、送りっぱなしの書き込み（回の終わりの時刻など）が終わるのを待つ */
  afterCleanupMs: 300,
  /** window.close() の結果を待つ */
  closeCheckMs: 300,
} as const;

/** 引き下がった画面が、鍵が空いたかを見張る間隔（ミリ秒） */
export const LOCK_WATCH_TIMING = {
  /** 調べる間隔 */
  intervalMs: 2000,
  /** 続けて調べる間の最短（見えるようになったときの調べが、前の調べのすぐ後に重ならないように） */
  minGapMs: 1500,
  /** 「空いている」が続けて何回出たら戻るか（更新の読み込み直しで一瞬空くのに反応しない） */
  confirms: 2,
} as const;

export interface LockManagerLike {
  request(
    name: string,
    options: { ifAvailable?: boolean; steal?: boolean },
    callback: (lock: unknown) => unknown,
  ): Promise<unknown>;
  /** いまの鍵の持ち主の一覧（無いブラウザもある） */
  query?(): Promise<{ held?: { name?: string }[] } | undefined>;
}

export interface ChannelLike {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (e: { data: unknown }) => void): void;
  removeEventListener(type: 'message', listener: (e: { data: unknown }) => void): void;
  close(): void;
}

export interface InstanceInfo {
  role: InstanceClaim['role'];
  takeover: boolean;
}

declare global {
  interface Window {
    /** 試験用（localStorage['mnw:test'] === '1' のときだけ置く） */
    __mnwInstance?: InstanceInfo;
  }
}

export interface InstanceEnv {
  /** navigator.locks。無ければ null */
  locks: LockManagerLike | null;
  /** BroadcastChannel を開く。使えなければ null */
  openChannel: (name: string) => ChannelLike | null;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
  newId: () => string;
  /** location.search */
  search: string;
  /** 試験の旗が立っているか */
  testFlagOn: () => boolean;
  /** この文書の開かれ方（PerformanceNavigationTiming.type。'navigate'・'reload'・'back_forward'・'prerender'）。分からなければ 'navigate' */
  navigationType: () => string;
  /** ほかのページの枠の中か（枠の中では守りに加わらない） */
  framed: () => boolean;
  setTitle: (title: string) => void;
  close: () => void;
  replace: (url: string) => void;
  reload: () => void;
  /** pageshow を聞く。persisted は戻る・進むのキャッシュから戻ったか */
  onPageShow: (cb: (persisted: boolean) => void) => void;
  /** pagehide を聞く（画面を離れる最中は「いる？」に答えない） */
  onPageHide: (cb: () => void) => void;
  /** 試験用の公開 */
  expose: (info: InstanceInfo) => void;
}

/** 奪われたときの後片付け（音を止める・画面を片付ける）。保存の後片付けが走るのを待てるよう Promise も返せる */
export type RetireCleanup = () => void | Promise<void>;

export type InstanceClaim =
  /** 書く画面。takeover は、生きている前の画面から引き継いだとき true */
  | { role: 'primary'; takeover: boolean; onRetire: (cleanup: RetireCleanup) => void }
  /** `?retired=1` で開かれた（閉じきれなかった前の画面） */
  | { role: 'retired' }
  /** Web Locks が使えない・試験の旗・枠の中。今までどおり始める（守りなし） */
  | { role: 'unsupported' }
  /** 始める前にさらに新しい画面に奪われた。この画面は始めずに引き下がる */
  | { role: 'superseded' };

/**
 * 画面同士の知らせ。pong と retired には送り主（from）を付ける。
 * 引き継ぎを待つ画面は、自分の ping に答えた画面からの retired だけを受ける（関係ない画面の「終わった」で早く始めない）。
 */
type Message =
  | { t: 'ping'; from: string }
  | { t: 'pong'; to: string; from: string }
  | { t: 'retired'; from: string };

function parseMessage(data: unknown): Message | null {
  if (typeof data !== 'object' || data === null) return null;
  const m = data as Record<string, unknown>;
  const from = m['from'];
  if (m['t'] === 'ping' && typeof from === 'string') return { t: 'ping', from };
  if (m['t'] === 'pong' && typeof m['to'] === 'string' && typeof from === 'string')
    return { t: 'pong', to: m['to'], from };
  if (m['t'] === 'retired' && typeof from === 'string') return { t: 'retired', from };
  return null;
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'
  );
}

/** 本物のブラウザの環境 */
export function browserEnv(): InstanceEnv {
  return {
    locks:
      typeof navigator !== 'undefined' && navigator.locks
        ? (navigator.locks as unknown as LockManagerLike)
        : null,
    openChannel: (name) => {
      try {
        return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(name);
      } catch {
        return null;
      }
    },
    // 呼ぶたびに globalThis から引く（試験の偽の時計に追随できるように）
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
    newId: () =>
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    search: location.search,
    // 旗は sessionStorage から読む（localStorage だと、消し忘れが家庭のパソコンに残り続けて守りが黙って切れるため）
    testFlagOn: () => {
      try {
        return sessionStorage.getItem(MULTI_WINDOW_FLAG) === '1';
      } catch {
        return false;
      }
    },
    navigationType: () => {
      try {
        const nav = performance.getEntriesByType('navigation')[0] as
          PerformanceNavigationTiming | undefined;
        return nav?.type ?? 'navigate';
      } catch {
        return 'navigate';
      }
    },
    framed: () => isFramed(),
    setTitle: (title) => {
      document.title = title;
    },
    close: () => window.close(),
    replace: (url) => location.replace(url),
    reload: () => location.reload(),
    onPageShow: (cb) => window.addEventListener('pageshow', (e) => cb(e.persisted)),
    onPageHide: (cb) => window.addEventListener('pagehide', () => cb()),
    expose: (info) => {
      try {
        if (localStorage.getItem('mnw:test') === '1') window.__mnwInstance = info;
      } catch {
        // 読めなければ公開しない
      }
    },
  };
}

/**
 * 画面の役割を決める。main.tsx の最初（Service Worker の登録・IndexedDB・描画より前）で待つ。
 * 手順は docs/expansion/single-instance-design.md 2.3.1。
 */
export async function claimInstance(overrides: Partial<InstanceEnv> = {}): Promise<InstanceClaim> {
  const env: InstanceEnv = { ...browserEnv(), ...overrides };
  const done = (claim: InstanceClaim): InstanceClaim => {
    env.expose({ role: claim.role, takeover: claim.role === 'primary' && claim.takeover });
    return claim;
  };

  if (new URLSearchParams(env.search).has('retired')) {
    env.setTitle(RETIRED_TITLE);
    return done({ role: 'retired' });
  }
  const locks = env.locks;
  if (!locks || env.testFlagOn() || env.framed()) return done({ role: 'unsupported' });
  try {
    return done(await runClaim(env, locks));
  } catch {
    // SecurityError など。鍵が使えないなら守りなしで始める
    return done({ role: 'unsupported' });
  }
}

interface Delay {
  promise: Promise<void>;
  cancel: () => void;
}

async function runClaim(env: InstanceEnv, locks: LockManagerLike): Promise<InstanceClaim> {
  const T = INSTANCE_TIMING;
  const id = env.newId();
  let channel: ChannelLike | null = null;
  let cleanup: RetireCleanup | null = null;
  // 鍵を持っている
  let holding = false;
  // 鍵を奪われて引き下がり中
  let retiring = false;
  // 画面を離れる最中（pagehide）
  let leaving = false;
  let sawRetired = false;
  // 前の画面の「終わった」を待っている最中の Promise（引き継ぎ待ち）。待ちが終わるまで、自分の「終わった」は送らない
  let retiredWait: Promise<boolean> | null = null;
  const waiters: { pong?: () => void; retired?: () => void } = {};

  const delay = (ms: number): Delay => {
    let timer: unknown;
    const promise = new Promise<void>((resolve) => {
      timer = env.setTimeout(resolve, ms);
    });
    return { promise, cancel: () => env.clearTimeout(timer) };
  };
  const sleep = (ms: number): Promise<void> => delay(ms).promise;
  /** event を待つ。ms たっても来なければ false */
  const waitEvent = async (
    key: 'pong' | 'retired',
    ms: number,
    alreadyHappened: () => boolean,
  ): Promise<boolean> => {
    if (alreadyHappened()) return true;
    const timer = delay(ms);
    let happened = false;
    const event = new Promise<void>((resolve) => {
      waiters[key] = () => {
        happened = true;
        resolve();
      };
    });
    await Promise.race([event, timer.promise]);
    timer.cancel();
    delete waiters[key];
    return happened || alreadyHappened();
  };

  let sawPong = false;
  // 自分の ping に答えた画面の ID（その画面からの「終わった」だけを待つ）
  let ponger: string | null = null;
  const onMessage = (e: { data: unknown }): void => {
    const m = parseMessage(e.data);
    if (!m) return;
    if (m.t === 'ping') {
      // 鍵を持つ生きている画面だけが答える（引き下がり中・離れる最中は答えない）
      if (holding && !retiring && !leaving)
        channel?.postMessage({ t: 'pong', to: m.from, from: id });
    } else if (m.t === 'pong') {
      if (m.to === id) {
        sawPong = true;
        if (ponger === null) ponger = m.from;
        waiters.pong?.();
      }
    } else if (ponger !== null && m.from === ponger) {
      sawRetired = true;
      waiters.retired?.();
    }
  };
  const ensureChannel = (): ChannelLike | null => {
    if (!channel) {
      channel = env.openChannel(CHANNEL_NAME);
      channel?.addEventListener('message', onMessage);
    }
    return channel;
  };

  /** 奪われたときの順番（docs/expansion/single-instance-design.md 2.3.3） */
  const retire = async (): Promise<void> => {
    env.setTitle(RETIRED_TITLE);
    // 引き継ぎ待ちの途中で奪われたら（3つ目の画面が来た）、待ちを打ち切らない。
    // 前の画面の片付けが終わる（または待ちが時間切れになる）まで待ってから、自分の「終わった」を送る。
    // 先に送ると、3つ目の画面が前の画面の片付けの書き込みと重なって始まってしまう
    if (retiredWait) await retiredWait;
    const fn = cleanup;
    if (fn) {
      const work = (async () => {
        try {
          await fn();
        } catch {
          // 片付けの失敗で閉じるのをやめない
        }
        await sleep(T.afterCleanupMs);
      })();
      const cap = delay(T.cleanupMaxMs);
      await Promise.race([work, cap.promise]);
      cap.cancel();
    }
    channel?.postMessage({ t: 'retired', from: id });
    env.close();
    await sleep(T.closeCheckMs);
    // 閉じられなかった（履歴が2件以上など）。文書ごと入れ替えて、動いているものを全部止める
    env.replace(RETIRED_URL);
  };
  const onStolen = (): void => {
    if (retiring) return;
    retiring = true;
    void retire();
  };

  /** 鍵を取る。ifAvailable は取れなければ false。steal は必ず取る。例外（SecurityError など）はそのまま投げる */
  const request = (mode: 'ifAvailable' | 'steal'): Promise<boolean> =>
    new Promise<boolean>((resolve, reject) => {
      let granted = false;
      const options = mode === 'steal' ? { steal: true } : { ifAvailable: true };
      let p: Promise<unknown>;
      try {
        p = locks.request(LOCK_NAME, options, (lock) => {
          if (!lock) {
            resolve(false);
            return undefined;
          }
          granted = true;
          holding = true;
          resolve(true);
          // 画面が閉じるまで鍵を持ち続ける
          return new Promise<void>(() => {});
        });
      } catch (err) {
        reject(err);
        return;
      }
      p.then(
        () => {},
        (err: unknown) => {
          if (!granted) {
            reject(err);
            return;
          }
          // 鍵を持ったあとの AbortError は、奪われたということ
          if (isAbortError(err)) onStolen();
        },
      );
    });

  let hooked = false;
  const primary = (takeover: boolean): InstanceClaim => {
    if (!hooked) {
      hooked = true;
      // キャッシュから戻った画面は、鍵が外れていたかもしれない。読み込み直して取り直す
      env.onPageShow((persisted) => {
        if (persisted) env.reload();
      });
      env.onPageHide(() => {
        leaving = true;
      });
    }
    return {
      role: 'primary',
      takeover,
      onRetire: (fn) => {
        cleanup = fn;
        // 登録の前にもう奪われていた（ほぼ同時に2つ開いた）。片付けの順番は進んでいるので、片付けだけ今する
        if (retiring)
          void Promise.resolve()
            .then(fn)
            .catch(() => {});
      },
    };
  };

  // 1. 空いていれば取る。読み込み直しの直後は、前の文書の鍵が外れるのが少し遅れることがあるのでやり直す
  let got = await request('ifAvailable');
  for (let i = 0; !got && i < T.acquireRetries; i++) {
    await sleep(T.acquireRetryMs);
    got = await request('ifAvailable');
  }
  if (got) {
    ensureChannel();
    return primary(false);
  }

  // 2. ほかの画面が持っている。生きているか聞く
  const ch = ensureChannel();
  // 知らせを送れないなら、前の画面に頼めない。守りなしで始める
  if (!ch) return { role: 'unsupported' };
  ch.postMessage({ t: 'ping', from: id });
  const navType = env.navigationType();
  // 読み込み直しのときは、前の文書は返事をしない。短く待つ。それ以外は、手元が少しふさがっている画面の返事を待てるよう長めに待つ
  const alive = await waitEvent(
    'pong',
    navType === 'reload' ? T.pingReloadMs : T.pingMs,
    () => sawPong,
  );
  // 「戻る」「進む」で古い項目を読み込み直しただけで、使っている画面を追い出さない。この窓が引き下がる
  if (alive && navType === 'back_forward') {
    env.setTitle(RETIRED_TITLE);
    ch.removeEventListener('message', onMessage);
    ch.close();
    return { role: 'retired' };
  }

  // 3. 奪う。生きている画面からは、「終わった」を待ってから始める
  sawRetired = false;
  await request('steal');
  if (alive) {
    retiredWait = waitEvent('retired', T.retiredWaitMs, () => sawRetired);
    await retiredWait;
  }
  if (retiring) return { role: 'superseded' };
  return primary(alive);
}

// ---- 引き下がった画面が、鍵が空いたら戻る仕組み -------------------------------------------------

export interface LockWatchEnv {
  /** navigator.locks.query。無ければ null（見張らない） */
  query: (() => Promise<{ held?: { name?: string }[] } | undefined>) | null;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
  now: () => number;
  /** 画面が見えるようになったときに呼ぶ。外す関数を返す */
  onVisible: (cb: () => void) => () => void;
}

function browserLockWatchEnv(): LockWatchEnv {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  return {
    query: locks && typeof locks.query === 'function' ? () => locks.query() : null,
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
    now: () => Date.now(),
    onVisible: (cb) => {
      const on = (): void => {
        if (document.visibilityState === 'visible') cb();
      };
      document.addEventListener('visibilitychange', on);
      return () => document.removeEventListener('visibilitychange', on);
    },
  };
}

/**
 * 引き下がった画面（「べつの まどで ひらいています」）が、使っている窓が閉じられて鍵が空いたら、
 * 自分で始め直すための見張り。いつまでも「ほかの窓で開いています」だけが残るのを防ぐ。
 *
 * - LOCK_WATCH_TIMING.intervalMs おきに navigator.locks.query() で鍵の持ち主を見る。画面が見えるようになったときも見る。
 * - 「空いている」が続けて LOCK_WATCH_TIMING.confirms 回出たら onFree を1回呼んで止まる
 *   （更新の読み込み直しで鍵が一瞬だけ空くのに反応しない）。
 * - 調べられないとき（query が無い・失敗）は「空いた」と見なさない。
 * - 戻り値は見張りを止める関数。
 */
export function watchLockFree(
  onFree: () => void,
  overrides: Partial<LockWatchEnv> = {},
): () => void {
  const env: LockWatchEnv = { ...browserLockWatchEnv(), ...overrides };
  const query = env.query;
  if (!query) return () => {};
  const W = LOCK_WATCH_TIMING;
  let stopped = false;
  let checking = false;
  let streak = 0;
  let lastAt = Number.NEGATIVE_INFINITY;
  let timer: unknown = null;
  let offVisible: (() => void) | null = null;

  const stop = (): void => {
    stopped = true;
    if (timer !== null) env.clearTimeout(timer);
    timer = null;
    offVisible?.();
    offVisible = null;
  };

  const check = async (): Promise<void> => {
    if (stopped || checking) return;
    const at = env.now();
    if (at - lastAt < W.minGapMs) return;
    lastAt = at;
    checking = true;
    let free: boolean;
    try {
      const snapshot = await query();
      free = !!snapshot && !(snapshot.held ?? []).some((l) => l?.name === LOCK_NAME);
    } catch {
      free = false;
    } finally {
      checking = false;
    }
    if (stopped) return;
    streak = free ? streak + 1 : 0;
    if (streak >= W.confirms) {
      stop();
      onFree();
    }
  };

  const schedule = (): void => {
    if (stopped) return;
    timer = env.setTimeout(() => {
      timer = null;
      void check().then(schedule);
    }, W.intervalMs);
  };

  offVisible = env.onVisible(() => {
    void check();
  });
  schedule();
  return stop;
}
