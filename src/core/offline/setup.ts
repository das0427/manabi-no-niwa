/**
 * 初回のオフライン準備の2段階（R#20、X-OF-01）: 「コア → そのプロフィールの区分の既定パック」。
 * 両方そろうまで準備完了にしない。幼児のプロフィールは既定パックが無い（[]）ので、コアだけで完了。
 *
 * 区分 → 既定パックの対応（例 g3 → g3-math, g3-ja, …）は curriculum 側（src/curriculum/defaultPacks.ts）が決めて
 * packIds に渡す。起動画面（src/app/StartScreen.tsx）が usePackSetup(packIds) を使い、setupView() の形で子供に見せる。
 *
 * 決めたこと（DESINGN.md 24章、docs/expansion/handover.md C 欄「初回準備の2段階」）:
 *  - 準備は待たせない。取得中・失敗でも「はじめる」は押せる（取得は画面を離れても続く）。準備完了の表示だけを遅らせる。
 *  - 版が古い（outdated）パックも「そろっていない」として自動で取り直す。取り直すまで、その単元は開かない（R#4）。
 *  - オフラインで配信につながらないときは失敗として止め、ネットワークがつながったら（online）自動で取り直す。
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useOfflineState, type OfflineState } from './index';
import {
  computePackStatuses,
  downloadPackList,
  getPackProgress,
  getPacksSeq,
  subscribePacks,
  type PackDownloadFailure,
  type PackStatus,
} from './packs';

/**
 *  - 'core'   : コアの準備中（progress はファイル数）
 *  - 'packs'  : 既定パックの取得中（progress はバイト数）。failures があり downloading でなければ止まっている（retry で再開）
 *  - 'ready'  : 両方そろった（または、この環境ではオフライン準備ができない 'unsupported'）
 *  - 'error'  : コアの準備に失敗（OfflineState.error を見る）
 */
export type SetupStage = 'core' | 'packs' | 'ready' | 'error';

export type SetupFailureReason = PackDownloadFailure | 'unavailable';

export interface SetupState {
  stage: SetupStage;
  progress: { done: number; total: number } | null;
  /** 既定パックのうち、そろっていないもの */
  missing: string[];
  /** missing のうち、版が古い（取得済みだがアプリの版と合わない）もの */
  outdated: string[];
  /** 既定パックの取得の失敗（packId と理由）。そろったパックの失敗は含めない */
  failures: { packId: string; reason: SetupFailureReason }[];
  /** missing のどれかを取得中 */
  downloading: boolean;
  /** コアはそろったが、パックの状態をまだ読み終えていない（表示しない） */
  checking: boolean;
  /** オフラインの準備ができない環境（file://、SW 非対応など）。stage は 'ready' */
  unsupported: boolean;
}

const BASE = {
  progress: null,
  missing: [],
  outdated: [],
  failures: [],
  downloading: false,
  checking: false,
  unsupported: false,
} satisfies Omit<SetupState, 'stage'>;

/**
 * コアの状態とパックの状態から、準備の段階をまとめる（純関数。取得中の進み具合は packs.ts から読む）。
 * planned はこの回に取得すると決めたパック。渡すと、取得し終えたパックの分も進み具合に数える
 * （1つ終わるたびに割合が戻らないように）。
 * netDown はネットワークにつながっていない（navigator.onLine === false）。packs.json を読めない理由を
 * 'offline' として扱い、つながったら自動で続ける対象にする。
 */
export function summarizeSetup(
  off: Pick<OfflineState, 'status' | 'progress'>,
  packIds: readonly string[],
  statuses: readonly PackStatus[] | null,
  failures: SetupState['failures'] = [],
  planned: readonly string[] = [],
  netDown = false,
): SetupState {
  if (off.status === 'unsupported') {
    return { ...BASE, stage: 'ready', unsupported: true };
  }
  if (off.status === 'error') {
    return { ...BASE, stage: 'error', missing: [...packIds], failures };
  }
  if (off.status !== 'ready') {
    return { ...BASE, stage: 'core', progress: off.progress, missing: [...packIds] };
  }
  const byId = new Map((statuses ?? []).map((s) => [s.packId, s]));
  const missing = packIds.filter((id) => {
    const s = byId.get(id);
    return !s || (s.state !== 'ready' && s.state !== 'core');
  });
  if (missing.length === 0) {
    return { ...BASE, stage: 'ready' };
  }
  const missingSet = new Set(missing);
  const counted = [...new Set([...planned.filter((id) => packIds.includes(id)), ...missing])];
  let done = 0;
  let total = 0;
  let downloading = false;
  for (const id of counted) {
    const s = byId.get(id);
    const p = getPackProgress(id);
    if (p) downloading = true;
    const bytes = p?.totalBytes || s?.bytes || 0;
    total += bytes;
    done += missingSet.has(id) ? (p?.doneBytes ?? 0) : bytes;
  }
  // 状態を読み終える前（statuses が null）は失敗扱いにしない
  const unavailable = (statuses === null ? [] : missing)
    .filter((id) => !byId.get(id) || byId.get(id)?.state === 'unavailable')
    .map((packId): SetupState['failures'][number] => ({
      packId,
      reason: netDown ? 'offline' : 'unavailable',
    }));
  const kept = failures.filter((f) => missingSet.has(f.packId));
  return {
    ...BASE,
    stage: 'packs',
    progress: { done: Math.min(done, total), total },
    missing,
    outdated: missing.filter((id) => byId.get(id)?.state === 'outdated'),
    failures: [...kept, ...unavailable.filter((u) => !kept.some((f) => f.packId === u.packId))],
    downloading,
    checking: statuses === null,
  };
}

/**
 * 起動画面で子供に見せる形（純関数）:
 *  - 'hidden'    : 出さない（準備の必要がない・コアの準備中・状態の読み込み中・完了）
 *  - 'preparing' : 取得中。percent は 0〜99（そろうまで 100 にしない）。renewing は版が古いものの取り直しを含む
 *  - 'failed'    : 止まっている。offline はネットワークにつながらないのが理由（つながれば自動で続ける）
 */
export type SetupView =
  | { kind: 'hidden' }
  | { kind: 'preparing'; percent: number; renewing: boolean }
  | { kind: 'failed'; offline: boolean };

export function setupView(s: SetupState): SetupView {
  if (s.stage !== 'packs' || s.checking) return { kind: 'hidden' };
  if (s.failures.length > 0 && !s.downloading) {
    return { kind: 'failed', offline: s.failures.every((f) => f.reason === 'offline') };
  }
  const p = s.progress;
  const percent = p && p.total > 0 ? Math.min(99, Math.floor((p.done / p.total) * 100)) : 0;
  return { kind: 'preparing', percent, renewing: s.outdated.length > 0 };
}

function subscribeNet(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

function getNetDown(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * 初回準備の2段階を進めて状態を返す。コアがそろったら、packIds のうち未取得・版違いのものを自動で取得する。
 * retry() で失敗したものを取り直す。オフラインで失敗したときは、ネットワークがつながったら自動で取り直す。
 * 取得は画面（このフックを使う部品）を離れても続く（packs.ts が持つ）。
 */
export function usePackSetup(packIds: readonly string[]): SetupState & { retry: () => void } {
  const off = useOfflineState();
  const seq = useSyncExternalStore(subscribePacks, getPacksSeq, getPacksSeq);
  const netDown = useSyncExternalStore(subscribeNet, getNetDown, () => false);
  const key = packIds.join(',');
  const [read, setRead] = useState<{ key: string; statuses: PackStatus[] } | null>(null);
  const [failures, setFailures] = useState<SetupState['failures']>([]);
  const [planned, setPlanned] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const coreReady = off.status === 'ready';

  useEffect(() => {
    if (!coreReady || key === '') return;
    let alive = true;
    const timer = setTimeout(() => {
      void computePackStatuses(key.split(',')).then((s) => {
        if (alive) setRead({ key, statuses: s });
      });
    }, 150);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // attempt: 取り直しのときは状態も読み直す（packs.json を読めなかった 'unavailable' のままにしない）
  }, [coreReady, key, seq, attempt]);

  useEffect(() => {
    if (!coreReady || key === '') return;
    let alive = true;
    void (async () => {
      const ids = key.split(',');
      const now = await computePackStatuses(ids);
      const todo = ids.filter((id) => {
        const s = now.find((x) => x.packId === id);
        return s && (s.state === 'not-downloaded' || s.state === 'outdated');
      });
      if (!alive) return;
      setPlanned(todo);
      if (todo.length === 0) return;
      const failed = await downloadPackList(todo);
      if (alive) setFailures(failed);
    })();
    return () => {
      alive = false;
    };
  }, [coreReady, key, attempt]);

  const retry = (): void => {
    setFailures([]);
    setAttempt((n) => n + 1);
  };

  const statuses = coreReady && read?.key === key ? read.statuses : null;
  const state = summarizeSetup(off, packIds, statuses, failures, planned, netDown);

  // オフラインで止まったら（packs.json を読めなかったときを含む）、つながったときに自動で取り直す
  const waitingOnline = state.failures.some((f) => f.reason === 'offline');
  useEffect(() => {
    if (!waitingOnline || typeof window === 'undefined') return;
    const onOnline = (): void => {
      setFailures([]);
      setAttempt((n) => n + 1);
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [waitingOnline]);

  return { ...state, retry };
}
