import { useSyncExternalStore } from 'react';

/**
 * Service Worker の登録とオフライン準備の状態（docs/architecture.md 7章）。
 *
 * status の意味:
 *  - 'unsupported' : このブラウザ・この開き方では Service Worker が使えない
 *                    （file:// で開いた場合、http の非ローカルな場所、一部のプライベート窓など。OF-08）
 *  - 'idle'        : まだ登録していない（開発サーバー、または startOffline() の前）
 *  - 'installing'  : 初回の準備中。progress に件数が入る
 *  - 'ready'       : オフラインの準備ができている。
 *                    現在のページを制御している SW の版、または install が完了した SW の版のキャッシュが揃っている。
 *                    初回訪問では SW はまだページを制御していない（再読み込みか次回起動から制御される）。
 *                    その区別は isPageControlled() で分かる。
 *                    更新の準備中は status が 'ready' のまま progress に件数が入る（学習を中断させない）。
 *  - 'error'       : 初回の準備に失敗した（error に説明）。更新の準備に失敗した場合は status は 'ready' のまま
 *                    error に説明が入る（現在の版は使い続けられる）。
 */
export interface OfflineState {
  supported: boolean;
  status: 'unsupported' | 'idle' | 'installing' | 'ready' | 'error';
  progress: { done: number; total: number } | null;
  updateReady: boolean;
  version: string | null;
  error: string | null;
}

const SW_URL = './sw.js';
const SW_SCOPE = './';
const UPDATE_CHECK_MIN_INTERVAL_MS = 5 * 60 * 1000;
const APPLY_TIMEOUT_MS = 8000;

function isSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

let state: OfflineState = {
  supported: isSupported(),
  status: isSupported() ? 'idle' : 'unsupported',
  progress: null,
  updateReady: false,
  version: null,
  error: null,
};

const listeners = new Set<(s: OfflineState) => void>();

function sameProgress(a: OfflineState['progress'], b: OfflineState['progress']): boolean {
  return a === b || (a !== null && b !== null && a.done === b.done && a.total === b.total);
}

function setState(patch: Partial<OfflineState>): void {
  const keys = Object.keys(patch) as (keyof OfflineState)[];
  const changed = keys.some((k) =>
    k === 'progress'
      ? !sameProgress(state.progress, patch.progress ?? null)
      : patch[k] !== state[k],
  );
  if (!changed) return;
  state = { ...state, ...patch };
  for (const cb of [...listeners]) cb(state);
}
export function getOfflineState(): OfflineState {
  return state;
}

export function subscribeOffline(cb: (s: OfflineState) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useOfflineState(): OfflineState {
  return useSyncExternalStore(subscribeOffline_, getOfflineState, getOfflineState);
}

// useSyncExternalStore 用（コールバックの型が違うため薄く包む）
function subscribeOffline_(onChange: () => void): () => void {
  return subscribeOffline(() => onChange());
}

/** このページが Service Worker に制御されているか（初回訪問では false。保護者向けの案内に使う） */
export function isPageControlled(): boolean {
  return isSupported() && navigator.serviceWorker.controller !== null;
}

let registration: ServiceWorkerRegistration | null = null;
let started = false;
let lastProgress: { done: number; total: number } | null = null;
let lastUpdateCheck = 0;
let reloadPage: () => void = () => {
  window.location.reload();
};
let versionSeq = 0;
const versionCache = new WeakMap<ServiceWorker, string>();
const watchedWorkers = new WeakSet<ServiceWorker>();
/** install を完了したことを確認できた SW（redundant になったとき「失敗」と「置き換え」を区別する） */
const installedWorkers = new WeakSet<ServiceWorker>();

function askVersion(worker: ServiceWorker): Promise<string | null> {
  const known = versionCache.get(worker);
  if (known) return Promise.resolve(known);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 3000);
    channel.port1.onmessage = (e: MessageEvent) => {
      clearTimeout(timer);
      const data = e.data as { type?: unknown; version?: unknown } | null;
      if (data && data.type === 'version' && typeof data.version === 'string') {
        versionCache.set(worker, data.version);
        resolve(data.version);
      } else {
        resolve(null);
      }
    };
    try {
      worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/** registration の現状から OfflineState を組み立てる */
function sync(): void {
  const reg = registration;
  if (!reg) return;
  const hasActive = reg.active !== null;
  const installing = reg.installing;
  const waiting = reg.waiting;
  // 初回: active も waiting もなければ準備中。waiting だけある（install 完了・未起動）も準備完了
  const ready = hasActive || waiting !== null;
  const installingNow = installing !== null && installing.state !== 'redundant';

  if (ready) {
    setState({
      supported: true,
      status: 'ready',
      progress: installingNow ? (lastProgress ?? { done: 0, total: 0 }) : null,
      updateReady: hasActive && waiting !== null,
      error: state.status === 'error' ? null : state.error,
    });
    const current = reg.active ?? waiting;
    if (current) {
      const seq = ++versionSeq;
      void askVersion(current).then((v) => {
        // 取得中にさらに状態が変わっていたら、新しい方の結果だけを使う
        if (v && seq === versionSeq) setState({ version: v });
      });
    }
  } else if (installingNow) {
    setState({
      supported: true,
      status: 'installing',
      progress: lastProgress ?? { done: 0, total: 0 },
      updateReady: false,
    });
  }
}

function watchWorker(worker: ServiceWorker): void {
  if (watchedWorkers.has(worker)) return;
  watchedWorkers.add(worker);
  if (worker.state !== 'installing' && worker.state !== 'redundant') installedWorkers.add(worker);
  worker.addEventListener('statechange', () => {
    if (worker.state === 'redundant') {
      if (!installedWorkers.has(worker)) {
        // install が完了しないまま redundant になった = 準備に失敗した
        const reg = registration;
        const stillUseful = reg !== null && (reg.active !== null || reg.waiting !== null);
        if (stillUseful) {
          setState({
            error:
              'あたらしい ばーじょんの じゅんびに しっぱいしました（いまの ばーじょんは そのまま つかえます）',
          });
        } else if (reg?.installing === null) {
          setState({
            status: 'error',
            progress: null,
            error:
              'オフラインの じゅんびに しっぱいしました。ネットワークに つないで もういちど ひらいてください。',
          });
        }
      }
    } else if (worker.state !== 'installing') {
      installedWorkers.add(worker);
      if (worker.state === 'installed') {
        lastProgress = null;
        if (state.error !== null && state.status === 'ready') setState({ error: null });
      }
    }
    sync();
  });
}

function onUpdateFound(): void {
  const worker = registration?.installing;
  if (!worker) return;
  lastProgress = null;
  watchWorker(worker);
  sync();
}

function handleMessage(event: MessageEvent): void {
  const data = event.data as { type?: unknown; done?: unknown; total?: unknown } | null;
  if (!data || data.type !== 'precache-progress') return;
  if (typeof data.done !== 'number' || typeof data.total !== 'number') return;
  lastProgress = { done: data.done, total: data.total };
  if (state.status === 'installing' || registration?.installing)
    setState({ progress: lastProgress });
}

function checkForUpdate(force = false): void {
  const reg = registration;
  if (!reg) return;
  const now = Date.now();
  if (!force && now - lastUpdateCheck < UPDATE_CHECK_MIN_INTERVAL_MS) return;
  lastUpdateCheck = now;
  // オフラインや配信停止中は失敗するが、それは正常（現在の版を使い続ける）
  reg.update().catch(() => undefined);
}

async function start(): Promise<void> {
  if (started) return;
  started = true;
  if (!isSupported()) {
    setState({ supported: false, status: 'unsupported' });
    return;
  }
  setState({ supported: true });
  const container = navigator.serviceWorker;
  container.addEventListener('message', handleMessage);
  container.addEventListener('controllerchange', () => sync());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
  try {
    const reg = await container.register(SW_URL, { scope: SW_SCOPE, updateViaCache: 'none' });
    registration = reg;
    reg.addEventListener('updatefound', onUpdateFound);
    for (const w of [reg.installing, reg.waiting, reg.active]) if (w) watchWorker(w);
    if (reg.installing) setState({ status: 'installing', progress: { done: 0, total: 0 } });
    sync();
    lastUpdateCheck = Date.now();
  } catch (error) {
    const name = (error as { name?: unknown } | null)?.name;
    setState({
      status: 'error',
      progress: null,
      error:
        typeof name === 'string'
          ? `オフラインの じゅんびを はじめられませんでした（${name}）`
          : 'オフラインの じゅんびを はじめられませんでした',
    });
  }
}

/** main.tsx から 1 回呼ぶ。本番ビルドのみ Service Worker を登録する（開発サーバーでは登録しない） */
export function startOffline(): void {
  if (!import.meta.env.PROD) return;
  void start();
}

/** 待機中の新版を適用する。SKIP_WAITING を送り、切り替わったら再読み込みする */
export async function applyUpdate(): Promise<void> {
  const waiting = registration?.waiting;
  if (!waiting) return;
  await new Promise<void>((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      navigator.serviceWorker.removeEventListener('controllerchange', finish);
      resolve();
    };
    const timer = setTimeout(finish, APPLY_TIMEOUT_MS);
    navigator.serviceWorker.addEventListener('controllerchange', finish);
    // ページが制御されていないとき（強制再読み込み後など）は controllerchange が来ないため、activated も待つ
    waiting.addEventListener('statechange', () => {
      if (waiting.state === 'activated') finish();
    });
    waiting.postMessage({ type: 'SKIP_WAITING' });
  });
  reloadPage();
}

const CHUNK_ERROR_PATTERNS: readonly RegExp[] = [
  /Failed to fetch dynamically imported module/i, // Chromium
  /error loading dynamically imported module/i, // Firefox
  /Importing a module script failed/i, // Safari
  /Failed to load module script/i,
  /Unable to preload CSS/i, // Vite
  /Loading chunk [\w-]+ failed/i,
  /Loading CSS chunk [\w-]+ failed/i,
];

/**
 * 遅延読み込み（import()）の失敗か。旧版の部品が見つからない場合などに true。
 * true のときは子供画面に「おうち」だけを出し、保護者向けに「再読み込みしてください」を案内する。
 */
export function onChunkLoadError(err: unknown): boolean {
  if (err === null || err === undefined) return false;
  let name = '';
  let message = '';
  if (typeof err === 'string') {
    message = err;
  } else if (typeof err === 'object') {
    const e = err as { name?: unknown; message?: unknown; reason?: unknown };
    if (typeof e.name === 'string') name = e.name;
    if (typeof e.message === 'string') message = e.message;
    if (message === '' && e.reason !== undefined) return onChunkLoadError(e.reason);
  }
  if (name === 'ChunkLoadError') return true;
  return CHUNK_ERROR_PATTERNS.some((p) => p.test(message));
}

/** テスト専用（画面側では使わない） */
export const __testing = {
  reset(): void {
    registration = null;
    started = false;
    lastProgress = null;
    lastUpdateCheck = 0;
    reloadPage = () => {
      window.location.reload();
    };
    state = {
      supported: isSupported(),
      status: isSupported() ? 'idle' : 'unsupported',
      progress: null,
      updateReady: false,
      version: null,
      error: null,
    };
    listeners.clear();
  },
  start,
  setReload(fn: () => void): void {
    reloadPage = fn;
  },
};
