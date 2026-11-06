/**
 * アプリの自動更新（アプリ側。設計: docs/expansion/updater-design.md 6章）。
 *
 * 配信（deploy/zorin/serve.py）の窓口 `./__manabi/update/…`（同じオリジン）とだけ話す。アプリ（ブラウザ）から
 * 外へは通信しない（CSP の connect-src 'self' のまま。GitHub との通信は serve.py が行う）。
 *
 * - 窓口があるか: fetchUpdaterStatus() が状態を読めれば「あり」。vite preview の index.html、ほかの静的サーバー、
 *   2.0.x の serve.py（404）などは「なし」（null）で、このモジュールは何もしない（今までどおりの表示）。
 * - 押したあとの流れ（requestApply）はこのモジュールが持つ。保護者が別のタブへ移っても続く:
 *     server（配信が取得・確かめ・切り替え）→ waiting-server（配信の起動し直し）→ sw（Service Worker の
 *     新しい版の準備）→ reloading（読み込み直し）。読み込み直したあと、packs（取得済みの教材パックの取り直し）。
 * - 起動したとき（startUpdater）: 配信の版がアプリの版より新しければ sw の流れを自動で始める。同じなら、版が古い
 *   教材パックだけを取り直す。配信が作業中なら server の流れの続きから。
 * - 読み込み直してよいのは、起動画面か保護者画面のときだけ（子供が遊んでいるあいだは読み込み直さない）。
 *
 * 状態を読む間隔: 作業中 1 秒、作業が無く保護者画面を開いているあいだ 30 秒、それ以外は起動時の 1 回だけ。
 */
import { useSyncExternalStore } from 'react';
import { applyUpdate, checkForUpdateNow, getOfflineState, subscribeOffline } from './index';
import { computePackStatuses, downloadPackList, getPackIndex } from './packs';

// ---------------------------------------------------------------- 窓口の状態の形（設計 5.3 節）

export type UpdaterPhase =
  | 'idle'
  | 'downloading'
  | 'extracting'
  | 'testing'
  | 'switching'
  | 'restarting'
  | 'done'
  | 'failed'
  | 'cancelled';

export type UpdaterCheckState = 'never' | 'checking' | 'ok' | 'offline' | 'error';

export interface UpdaterErrorInfo {
  code: string;
  detail: string;
  /** disk-full のとき: 必要な大きさ（バイト） */
  needBytes?: number;
}

export interface UpdaterPart {
  kind: string;
  bytes: number;
  changed: boolean;
}

export interface UpdaterLatest {
  version: string;
  date: string;
  notes: string[];
  newer: boolean;
  installable: boolean;
  blockedReason: string | null;
  downloadBytes: number;
  needBytes: number;
  parts: UpdaterPart[];
}

export interface UpdaterProgress {
  doneBytes: number;
  totalBytes: number;
  part: string;
  partIndex: number;
  partCount: number;
}

export interface UpdaterStatus {
  schema: 1;
  supported: true;
  /** POST の見出し X-Manabi-Token に付ける合言葉（配信を起動し直すと変わる） */
  token: string;
  server: { pid: number; startedAt: string };
  current: { version: string };
  settings: { autoCheck: boolean };
  disk: { freeBytes: number };
  check: {
    state: UpdaterCheckState;
    at: string | null;
    error: { code: string; detail: string } | null;
  };
  latest: UpdaterLatest | null;
  update: {
    phase: UpdaterPhase;
    targetVersion: string | null;
    progress: UpdaterProgress | null;
    error: UpdaterErrorInfo | null;
    startedAt: string | null;
    finishedAt: string | null;
  };
  lastApplied: { version: string; from: string; at: string } | null;
}

// ---------------------------------------------------------------- 状態の読み取り

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isStrOrNull = (v: unknown): v is string | null => v === null || isStr(v);

const PHASES: readonly string[] = [
  'idle',
  'downloading',
  'extracting',
  'testing',
  'switching',
  'restarting',
  'done',
  'failed',
  'cancelled',
];
const CHECK_STATES: readonly string[] = ['never', 'checking', 'ok', 'offline', 'error'];

/** null は正しい「なし」、undefined は形の誤り */
function parseErrorInfo(v: unknown): UpdaterErrorInfo | null | undefined {
  if (v === null) return null;
  if (!isRec(v) || !isStr(v.code) || !isStr(v.detail)) return undefined;
  if (v.needBytes !== undefined && !isNum(v.needBytes)) return undefined;
  return v.needBytes === undefined
    ? { code: v.code, detail: v.detail }
    : { code: v.code, detail: v.detail, needBytes: v.needBytes };
}

function parseLatest(v: unknown): UpdaterLatest | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  if (!isStr(v.version) || !isStr(v.date)) return undefined;
  if (!Array.isArray(v.notes) || !v.notes.every(isStr)) return undefined;
  if (!isBool(v.newer) || !isBool(v.installable)) return undefined;
  if (!isStrOrNull(v.blockedReason)) return undefined;
  if (!isNum(v.downloadBytes) || !isNum(v.needBytes)) return undefined;
  if (!Array.isArray(v.parts)) return undefined;
  const parts: UpdaterPart[] = [];
  for (const p of v.parts as unknown[]) {
    if (!isRec(p) || !isStr(p.kind) || !isNum(p.bytes) || !isBool(p.changed)) return undefined;
    parts.push({ kind: p.kind, bytes: p.bytes, changed: p.changed });
  }
  return {
    version: v.version,
    date: v.date,
    notes: [...(v.notes as string[])],
    newer: v.newer,
    installable: v.installable,
    blockedReason: v.blockedReason,
    downloadBytes: v.downloadBytes,
    needBytes: v.needBytes,
    parts,
  };
}

function parseProgress(v: unknown): UpdaterProgress | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  if (!isNum(v.doneBytes) || !isNum(v.totalBytes) || !isStr(v.part)) return undefined;
  if (!isNum(v.partIndex) || !isNum(v.partCount)) return undefined;
  return {
    doneBytes: v.doneBytes,
    totalBytes: v.totalBytes,
    part: v.part,
    partIndex: v.partIndex,
    partCount: v.partCount,
  };
}

/**
 * 窓口の状態（GET /__manabi/update/status の本文）を読む。schema が 1 でない・supported が true でない・
 * 欄の形が違うときは null（=「窓口なし」と同じ扱い）。知らない欄は無視する。
 */
export function parseUpdaterStatus(json: unknown): UpdaterStatus | null {
  if (!isRec(json) || json.schema !== 1 || json.supported !== true) return null;
  const { token, server, current, settings, disk, check, update, lastApplied } = json;
  if (!isStr(token) || token === '') return null;
  if (!isRec(server) || !isNum(server.pid) || !isStr(server.startedAt)) return null;
  if (!isRec(current) || !isStr(current.version) || current.version === '') return null;
  if (!isRec(settings) || !isBool(settings.autoCheck)) return null;
  if (!isRec(disk) || !isNum(disk.freeBytes)) return null;

  if (!isRec(check) || !isStr(check.state) || !CHECK_STATES.includes(check.state)) return null;
  if (!isStrOrNull(check.at)) return null;
  const checkError = parseErrorInfo(check.error);
  if (checkError === undefined) return null;

  const latest = parseLatest(json.latest);
  if (latest === undefined) return null;

  if (!isRec(update) || !isStr(update.phase) || !PHASES.includes(update.phase)) return null;
  if (!isStrOrNull(update.targetVersion)) return null;
  const progress = parseProgress(update.progress);
  if (progress === undefined) return null;
  const updateError = parseErrorInfo(update.error);
  if (updateError === undefined) return null;
  if (!isStrOrNull(update.startedAt) || !isStrOrNull(update.finishedAt)) return null;

  let applied: UpdaterStatus['lastApplied'] = null;
  if (lastApplied !== null) {
    if (!isRec(lastApplied) || !isStr(lastApplied.version) || !isStr(lastApplied.at)) return null;
    if (!isStr(lastApplied.from)) return null;
    applied = { version: lastApplied.version, from: lastApplied.from, at: lastApplied.at };
  }

  return {
    schema: 1,
    supported: true,
    token,
    server: { pid: server.pid, startedAt: server.startedAt },
    current: { version: current.version },
    settings: { autoCheck: settings.autoCheck },
    disk: { freeBytes: disk.freeBytes },
    check: {
      state: check.state as UpdaterCheckState,
      at: check.at,
      error: checkError === null ? null : { code: checkError.code, detail: checkError.detail },
    },
    latest,
    update: {
      phase: update.phase as UpdaterPhase,
      targetVersion: update.targetVersion,
      progress,
      error: updateError,
      startedAt: update.startedAt,
      finishedAt: update.finishedAt,
    },
    lastApplied: applied,
  };
}

// ---------------------------------------------------------------- 版

const SEMVER = /^(\d{1,4})\.(\d{1,4})\.(\d{1,6})$/;

function parseVersion(v: string): [number, number, number] | null {
  const m = SEMVER.exec(v);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** X.Y.Z どうしの比較（a が新しければ正）。どちらかが X.Y.Z でなければ null */
export function compareVersions(a: string, b: string): number | null {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return null;
  for (let i = 0; i < 3; i++) {
    const d = x[i]! - y[i]!;
    if (d !== 0) return d;
  }
  return 0;
}

/** このアプリ（ブラウザで動いているコード）の版。ビルドのとき package.json の版が入る */
function readAppVersion(): string {
  const v: unknown = import.meta.env.VITE_APP_VERSION;
  return typeof v === 'string' ? v : '';
}
let appVersion = readAppVersion();

// ---------------------------------------------------------------- 取得（窓口との通信）

const API_BASE = './__manabi/update/';
const STATUS_URL = `${API_BASE}status`;

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;
const defaultFetch: FetchFn = (input, init) => fetch(input, init);
let fetchImpl: FetchFn = defaultFetch;

/**
 * 窓口の状態を読む。通信の失敗・200 以外・Content-Type が application/json でない（SPA の代わりの index.html、
 * ほかの静的サーバーや 2.0.x の serve.py の 404）・JSON でない・形が違う、のどれでも null（=窓口なし）。
 */
export async function fetchUpdaterStatus(): Promise<UpdaterStatus | null> {
  try {
    const res = await fetchImpl(STATUS_URL, { cache: 'no-store' });
    if (res.status !== 200) return null;
    const type = (res.headers.get('content-type') ?? '').trim().toLowerCase();
    if (!/^application\/json(\s*;|$)/.test(type)) return null;
    return parseUpdaterStatus(await res.json());
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- 画面に見せる状態

/**
 * 押したあとの流れ:
 *  - 'none'           : 流れは無い
 *  - 'server'         : 配信が取得・確かめ・切り替えをしている（status.update.phase を見る）
 *  - 'waiting-server' : 配信が起動し直している（読めないあいだも）
 *  - 'sw'             : Service Worker の新しい版を準備している（swProgress）
 *  - 'reloading'      : 読み込み直す
 *  - 'packs'          : 取得済みの教材パックのうち、版が古いものを取り直している（packs）
 *  - 'failed'         : 失敗した（flowError に理由のコード）
 */
export type UpdaterFlow =
  'none' | 'server' | 'waiting-server' | 'sw' | 'reloading' | 'packs' | 'failed';

export interface UpdaterView {
  /** 窓口がある（状態を読めた） */
  available: boolean;
  status: UpdaterStatus | null;
  flow: UpdaterFlow;
  /** flow が 'failed' のときの理由のコード（配信の update.error.code か、アプリ側の server-timeout・sw-failed・sw-mismatch など） */
  flowError: string | null;
  swProgress: { done: number; total: number } | null;
  /** done: 取り直しを終えた数、total: 取り直す数。doneBytes / totalBytes は進み具合の棒用 */
  packs: { done: number; total: number; doneBytes: number; totalBytes: number } | null;
}

const INITIAL_VIEW: UpdaterView = {
  available: false,
  status: null,
  flow: 'none',
  flowError: null,
  swProgress: null,
  packs: null,
};

let view: UpdaterView = INITIAL_VIEW;
const listeners = new Set<() => void>();

function same(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

function setView(patch: Partial<UpdaterView>): void {
  const next: UpdaterView = { ...view, ...patch };
  const unchanged =
    next.available === view.available &&
    next.flow === view.flow &&
    next.flowError === view.flowError &&
    same(next.status, view.status) &&
    same(next.swProgress, view.swProgress) &&
    same(next.packs, view.packs);
  if (unchanged) return;
  view = next;
  for (const cb of [...listeners]) cb();
}

export function getUpdaterView(): UpdaterView {
  return view;
}

export function subscribeUpdater(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** 窓口の状態と、押したあとの流れ（保護者画面の表示用） */
export function useUpdater(): UpdaterView {
  return useSyncExternalStore(subscribeUpdater, getUpdaterView, getUpdaterView);
}

// ---------------------------------------------------------------- 内部の状態

const POLL_WORK_MS = 1000;
const POLL_IDLE_MS = 30_000;
/** 配信が読めない（起動し直している）のを待つ上限 */
const SERVER_WAIT_LIMIT_MS = 120_000;
/** 押したのに配信が何も始めない（idle のまま）のを待つ上限 */
const SERVER_IDLE_LIMIT_MS = 30_000;
/** Service Worker の新しい版の準備を待つ上限 */
const SW_LIMIT_MS = 10 * 60 * 1000;
/** 準備が始まっていないとき、Service Worker の更新の確認をやり直す間隔 */
const SW_RETRY_MS = 15_000;
/** applyUpdate のあと、読み込み直しが起きなかったと判断するまで */
const RELOAD_GRACE_MS = 15_000;
const RELOADED_KEY = 'mnw:update:reloaded';

const SERVER_WORKING: ReadonlySet<UpdaterPhase> = new Set([
  'downloading',
  'extracting',
  'testing',
  'switching',
  'restarting',
]);
const ACTIVE_FLOWS: ReadonlySet<UpdaterFlow> = new Set([
  'server',
  'waiting-server',
  'sw',
  'reloading',
  'packs',
]);

/** 押した（または続きの）版 */
let target: string | null = null;
/** 起動時に自動で始めた流れか（読み込み直しの繰り返しの防止に使う） */
let auto = false;
let waitSince: number | null = null;
let idleSince: number | null = null;
/** 押す前から残っていた failed / cancelled / done の startedAt（前回の結果を今回の結果と取り違えない） */
let staleStartedAt: string | null = null;
let reloadStarted = false;
let swCleanup: (() => void) | null = null;
let reloadFallbackTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let ticking = false;
let bootStarted = false;
let packsStarted = false;
let hashListening = false;
let fetchSeq = 0;
let appliedSeq = 0;

function flowActive(): boolean {
  return ACTIVE_FLOWS.has(view.flow);
}

function isParentScreen(): boolean {
  return typeof location !== 'undefined' && location.hash.startsWith('#/parent');
}

/** 読み込み直してよい画面か（起動画面・保護者画面。子供が遊んでいるあいだは読み込み直さない） */
function canReloadNow(): boolean {
  if (typeof location === 'undefined') return true;
  const h = location.hash;
  return h === '' || h === '#' || h === '#/' || h === '#/start' || h.startsWith('#/parent');
}

function readReloaded(): string | null {
  try {
    return sessionStorage.getItem(RELOADED_KEY);
  } catch {
    return null;
  }
}

function writeReloaded(version: string): boolean {
  try {
    sessionStorage.setItem(RELOADED_KEY, version);
    return sessionStorage.getItem(RELOADED_KEY) === version;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- 状態を読む間隔

function desiredInterval(): number | null {
  if (!view.available) return null;
  if (view.flow === 'server' || view.flow === 'waiting-server') return POLL_WORK_MS;
  if (!isParentScreen()) return null;
  if (view.status?.check.state === 'checking') return POLL_WORK_MS;
  return POLL_IDLE_MS;
}

function clearPoll(): void {
  if (pollTimer !== null) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function reschedule(): void {
  clearPoll();
  const ms = desiredInterval();
  if (ms === null) return;
  pollTimer = setTimeout(() => {
    pollTimer = null;
    void tick();
  }, ms);
}

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const s = await refreshUpdaterStatus();
    if (view.flow === 'server' || view.flow === 'waiting-server') onServerRead(s);
  } finally {
    ticking = false;
    reschedule();
  }
}

function applyStatus(s: UpdaterStatus): void {
  setView({ available: true, status: s });
}

/** 窓口の状態を読み直して保存する。読めなければ null（前の状態はそのまま） */
export async function refreshUpdaterStatus(): Promise<UpdaterStatus | null> {
  const seq = ++fetchSeq;
  const s = await fetchUpdaterStatus();
  // 後から始めた読み取りの結果が先に着いていたら、古い結果で上書きしない
  if (s && seq > appliedSeq) {
    appliedSeq = seq;
    applyStatus(s);
  }
  return s;
}

function ensureHashListener(): void {
  if (hashListening || typeof window === 'undefined') return;
  hashListening = true;
  window.addEventListener('hashchange', onHashChange);
}

function onHashChange(): void {
  if (view.flow === 'sw') evaluateSw();
  if (view.available && isParentScreen() && !flowActive()) void refreshUpdaterStatus();
  reschedule();
}

// ---------------------------------------------------------------- 流れ: 配信（server / waiting-server）

function now(): number {
  return Date.now();
}

function resetFlowInternals(): void {
  waitSince = null;
  idleSince = null;
  reloadStarted = false;
}

function leaveSw(): void {
  if (swCleanup) {
    const cleanup = swCleanup;
    swCleanup = null;
    cleanup();
  }
}

function clearReloadFallback(): void {
  if (reloadFallbackTimer !== null) {
    clearTimeout(reloadFallbackTimer);
    reloadFallbackTimer = null;
  }
}

function fail(code: string): void {
  leaveSw();
  clearReloadFallback();
  resetFlowInternals();
  setView({ flow: 'failed', flowError: code, swProgress: null, packs: null });
  reschedule();
}

function endFlow(): void {
  leaveSw();
  clearReloadFallback();
  resetFlowInternals();
  setView({ flow: 'none', flowError: null, swProgress: null, packs: null });
  reschedule();
}

/** 配信の状態を読んだ結果（null は読めない）から、server の流れを進める */
function onServerRead(s: UpdaterStatus | null): void {
  const t = now();
  if (s === null || s.update.phase === 'restarting') {
    // 起動し直している（読めない）あいだ
    if (waitSince === null) waitSince = t;
    idleSince = null;
    if (view.flow !== 'waiting-server') setView({ flow: 'waiting-server' });
    if (t - waitSince >= SERVER_WAIT_LIMIT_MS) fail('server-timeout');
    return;
  }
  waitSince = null;
  const phase = s.update.phase;

  // 配信が新しい版になった（作業中の段階を終えている）
  if (target !== null && s.current.version === target && !SERVER_WORKING.has(phase)) {
    startSw(target, false);
    return;
  }
  const stale = s.update.startedAt !== null && s.update.startedAt === staleStartedAt;
  if (phase === 'failed' && !stale) {
    fail(s.update.error?.code ?? 'unknown');
    return;
  }
  if (phase === 'cancelled' && !stale) {
    endFlow();
    return;
  }
  if (SERVER_WORKING.has(phase)) {
    idleSince = null;
    if (view.flow !== 'server') setView({ flow: 'server' });
    return;
  }
  // idle / done（別の版）/ 前回の結果: 始まるのを少し待つ
  if (idleSince === null) idleSince = t;
  if (t - idleSince >= SERVER_IDLE_LIMIT_MS) fail('interrupted');
}

export interface UpdaterActionResult {
  ok: boolean;
  /** 失敗のとき: 窓口のコード（busy・not-newer・blocked・forbidden など）か、unreachable（配信に届かない） */
  code?: string;
  detail?: string;
}

async function readPostResponse(res: Response): Promise<UpdaterActionResult> {
  const json: unknown = await res.json().catch(() => null);
  if (res.ok && isRec(json) && json.ok === true) {
    const s = parseUpdaterStatus(json.status);
    if (s) {
      // これより前に始めた読み取りの結果で上書きしない
      appliedSeq = ++fetchSeq;
      applyStatus(s);
    } else void refreshUpdaterStatus();
    return { ok: true };
  }
  const err = isRec(json) && isRec(json.error) ? json.error : null;
  return {
    ok: false,
    code: err && isStr(err.code) ? err.code : `http-${res.status}`,
    detail: err && isStr(err.detail) ? err.detail : '',
  };
}

type PostPath = 'check' | 'apply' | 'cancel' | 'settings';

/**
 * 窓口へ POST する。見出しは Content-Type: application/json と X-Manabi-Token。
 * 403（合言葉が古い。配信が起動し直した）なら、状態を読み直して 1 回だけ送り直す。
 */
async function post(path: PostPath, body: unknown): Promise<UpdaterActionResult> {
  let token = view.status?.token ?? null;
  if (token === null) token = (await refreshUpdaterStatus())?.token ?? null;
  if (token === null) return { ok: false, code: 'unreachable', detail: 'status unavailable' };
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetchImpl(`${API_BASE}${path}`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-Manabi-Token': token },
        body: JSON.stringify(body),
      });
    } catch {
      return { ok: false, code: 'unreachable', detail: 'network error' };
    }
    if (res.status === 403 && attempt === 0) {
      const fresh = await refreshUpdaterStatus();
      if (!fresh) return { ok: false, code: 'unreachable', detail: 'status unavailable' };
      token = fresh.token;
      continue;
    }
    return readPostResponse(res);
  }
  return { ok: false, code: 'forbidden', detail: '' };
}

/** 新しい版があるか、配信に確かめさせる（結果は状態の check に出る） */
export async function requestCheck(): Promise<UpdaterActionResult> {
  const r = await post('check', {});
  reschedule();
  return r;
}

/** 取得・展開の中止（downloading・extracting のときだけ受け付けられる） */
export async function requestCancel(): Promise<UpdaterActionResult> {
  const r = await post('cancel', {});
  reschedule();
  return r;
}

/** 起動したときの自動の確認のオン・オフ */
export async function setAutoCheck(on: boolean): Promise<UpdaterActionResult> {
  return post('settings', { autoCheck: on });
}

/**
 * 「更新する」: 配信に version への更新を頼み、あとは自動で進める（取得 → 確かめ → 切り替え → 配信の
 * 起動し直し → アプリの新しい版の準備 → 読み込み直し → 教材の取り直し）。
 * すでに配信がその版になっているとき（アプリの準備だけが残っているとき）は、頼まずにアプリの準備から始める。
 */
export async function requestApply(version: string): Promise<UpdaterActionResult> {
  if (flowActive()) return { ok: false, code: 'busy', detail: 'update in progress' };
  ensureHashListener();
  clearPoll();
  leaveSw();
  clearReloadFallback();
  resetFlowInternals();
  target = version;
  auto = false;
  const prev = view.status?.update;
  staleStartedAt =
    prev && ['failed', 'cancelled', 'done'].includes(prev.phase) ? prev.startedAt : null;
  setView({ flow: 'server', flowError: null, swProgress: null, packs: null });

  const cached = view.status;
  if (cached && cached.current.version === version && !SERVER_WORKING.has(cached.update.phase)) {
    startSw(version, false);
    return { ok: true };
  }
  const res = await post('apply', { version });
  if (!res.ok) {
    if (res.code === 'not-newer') {
      // すでに配信がその版になっている（別の画面で終えた、など）ならアプリの準備から
      const s = await refreshUpdaterStatus();
      if (s && s.current.version === version) {
        startSw(version, false);
        return { ok: true };
      }
    }
    fail(res.code ?? 'unreachable');
    return res;
  }
  if (view.status) onServerRead(view.status);
  if (view.flow === 'server' || view.flow === 'waiting-server') reschedule();
  return { ok: true };
}

// ---------------------------------------------------------------- 流れ: アプリの新しい版（sw / reloading）

/** Service Worker の新しい版を準備し、できたら（読み込み直してよいとき）読み込み直す */
function startSw(version: string, isAuto: boolean): void {
  leaveSw();
  clearReloadFallback();
  resetFlowInternals();
  target = version;
  auto = isAuto;
  setView({ flow: 'sw', flowError: null, packs: null });
  const unsubscribe = subscribeOffline(() => evaluateSw());
  const limit = setTimeout(() => {
    if (view.flow === 'sw' && !getOfflineState().updateReady) fail('sw-failed');
  }, SW_LIMIT_MS);
  // 準備が始まっていないあいだは、確認をやり直す（配信の起動し直しの直後など、1 回で見つからないことがある）
  const retry = setInterval(() => {
    const off = getOfflineState();
    if (view.flow === 'sw' && off.progress === null && !off.updateReady) checkForUpdateNow();
  }, SW_RETRY_MS);
  swCleanup = () => {
    unsubscribe();
    clearTimeout(limit);
    clearInterval(retry);
  };
  checkForUpdateNow();
  evaluateSw();
  reschedule();
}

function evaluateSw(): void {
  if (view.flow !== 'sw') return;
  const off = getOfflineState();
  // 準備に失敗した、または Service Worker が使えない（新しい版を準備できない）
  if (off.status === 'error' || off.status === 'unsupported' || off.error !== null) {
    fail('sw-failed');
    return;
  }
  setView({
    swProgress: off.progress ? { done: off.progress.done, total: off.progress.total } : null,
  });
  if (!off.updateReady) return;
  if (!canReloadNow()) return; // 子供が遊んでいるあいだは待つ（hashchange で見直す）
  reloadNow();
}

function reloadNow(): void {
  if (reloadStarted) return;
  reloadStarted = true;
  const version = target ?? '';
  // 読み込み直しても版が合わないとき、同じ読み込み直しを繰り返さないための印
  if (!writeReloaded(version) && auto) {
    fail('sw-mismatch');
    return;
  }
  leaveSw();
  setView({ flow: 'reloading', swProgress: null });
  void Promise.resolve(applyUpdate()).then(() => {
    // 読み込み直しが起きなかったとき（待機中の版が無くなった、など）に止まったままにしない
    reloadFallbackTimer = setTimeout(() => {
      reloadFallbackTimer = null;
      if (view.flow === 'reloading') fail('sw-mismatch');
    }, RELOAD_GRACE_MS);
  });
}

// ---------------------------------------------------------------- 起動したとき

/** コアのオフライン準備が終わるのを待つ。そろったら true、できない（エラー・非対応）なら false */
function waitForCore(): Promise<boolean> {
  return new Promise((resolve) => {
    let unsubscribe: (() => void) | null = null;
    let finished = false;
    const check = (): void => {
      if (finished) return;
      const status = getOfflineState().status;
      if (status !== 'ready' && status !== 'error' && status !== 'unsupported') return;
      finished = true;
      unsubscribe?.();
      resolve(status === 'ready');
    };
    unsubscribe = subscribeOffline(check);
    check();
  });
}

/**
 * 取得済みの教材パックのうち、版が古いもの（outdated）だけを取り直す。1 回の起動で 1 回だけ。
 * 失敗しても繰り返さない（保護者画面「きょうざい」の「まとめて取得し直す」で取り直せる）。
 * 未取得のパック・学習の記録には触らない。
 */
async function refreshStalePacks(reconciled: Promise<unknown> | undefined): Promise<void> {
  if (packsStarted) return;
  packsStarted = true;
  try {
    await reconciled;
  } catch {
    /* 整理の失敗は取り直しを止めない */
  }
  if (!(await waitForCore())) return;
  try {
    const index = await getPackIndex();
    if (!index) return;
    const outdated = (await computePackStatuses(Object.keys(index))).filter(
      (s) => s.state === 'outdated',
    );
    if (outdated.length === 0 || view.flow !== 'none') return;
    const ids = outdated.map((s) => s.packId);
    const sizes = new Map(outdated.map((s) => [s.packId, s.bytes]));
    const totalBytes = outdated.reduce((sum, s) => sum + s.bytes, 0);
    setView({
      flow: 'packs',
      flowError: null,
      packs: { done: 0, total: ids.length, doneBytes: 0, totalBytes },
    });
    await downloadPackList(ids, (p, i, n) => {
      const finished = ids.slice(0, i).reduce((sum, id) => sum + (sizes.get(id) ?? 0), 0);
      setView({
        packs: {
          done: i,
          total: n,
          doneBytes: Math.min(totalBytes, finished + p.doneBytes),
          totalBytes,
        },
      });
    });
  } catch {
    /* 取り直せなかった分は「きょうざい」タブで取り直せる */
  }
  if (view.flow === 'packs') setView({ flow: 'none', packs: null });
}

async function boot(reconciled: Promise<unknown> | undefined): Promise<void> {
  const s = await refreshUpdaterStatus();
  if (!s) return; // 窓口なし: 何もしない
  ensureHashListener();
  const phase = s.update.phase;
  if (SERVER_WORKING.has(phase) && s.update.targetVersion !== null) {
    // 配信が作業中（読み込み直したら作業中だった、など）: 流れの続きから
    resetFlowInternals();
    target = s.update.targetVersion;
    auto = false;
    staleStartedAt = null;
    setView({ flow: phase === 'restarting' ? 'waiting-server' : 'server', flowError: null });
    onServerRead(s);
    reschedule();
    return;
  }
  const cmp = compareVersions(s.current.version, appVersion);
  if (cmp === null) {
    reschedule();
    return;
  }
  if (cmp > 0) {
    // 配信の版がアプリの版より新しい: アプリの新しい版の準備から自動で始める
    if (readReloaded() === s.current.version) fail('sw-mismatch');
    else startSw(s.current.version, true);
    return;
  }
  if (cmp === 0) void refreshStalePacks(reconciled);
  reschedule();
}

/**
 * 起動時に 1 回呼ぶ（startOffline から。本番のビルドだけ）。窓口が無ければ何もしない。
 * reconciled: 教材パックの整理（reconcilePacks）が終わったら解決する Promise。教材の取り直しはそのあとに行う。
 */
export function startUpdater(reconciled?: Promise<unknown>): void {
  if (bootStarted) return;
  bootStarted = true;
  void boot(reconciled);
}

/** テスト専用（画面側では使わない） */
export const __testing = {
  reset(): void {
    clearPoll();
    leaveSw();
    clearReloadFallback();
    if (hashListening && typeof window !== 'undefined') {
      window.removeEventListener('hashchange', onHashChange);
    }
    hashListening = false;
    view = INITIAL_VIEW;
    listeners.clear();
    target = null;
    auto = false;
    waitSince = null;
    idleSince = null;
    staleStartedAt = null;
    reloadStarted = false;
    ticking = false;
    bootStarted = false;
    packsStarted = false;
    fetchSeq = 0;
    appliedSeq = 0;
    fetchImpl = defaultFetch;
    appVersion = readAppVersion();
  },
  setFetch(fn: FetchFn | null): void {
    fetchImpl = fn ?? defaultFetch;
  },
  setAppVersion(v: string): void {
    appVersion = v;
  },
};
