/**
 * 初回のオフライン準備の2段階（R#20、X-OF-01）: 「コア → そのプロフィールの区分の既定パック」。
 * 両方そろうまで準備完了にしない。幼児のプロフィールは既定パックが無い（[]）ので、コアだけで完了。
 *
 * 区分 → 既定パックの対応（例 g3 → g3-kokugo, g3-sansu, …）は curriculum 側が決めて packIds に渡す。
 * 画面（起動画面など）は usePackSetup(packIds) の stage と progress を表示する。
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
 *  - 'packs'  : 既定パックの取得中（progress はバイト数）。error があれば失敗（retry で再開）
 *  - 'ready'  : 両方そろった（または、この環境ではオフライン準備ができない 'unsupported'）
 *  - 'error'  : コアの準備に失敗（OfflineState.error を見る）
 */
export type SetupStage = 'core' | 'packs' | 'ready' | 'error';

export interface SetupState {
  stage: SetupStage;
  progress: { done: number; total: number } | null;
  /** 既定パックのうち、そろっていないもの */
  missing: string[];
  /** 既定パックの取得の失敗（packId と理由） */
  failures: { packId: string; reason: PackDownloadFailure | 'unavailable' }[];
  /** オフラインの準備ができない環境（file://、SW 非対応など）。stage は 'ready' */
  unsupported: boolean;
}

/** コアの状態とパックの状態から、準備の段階をまとめる（純関数） */
export function summarizeSetup(
  off: Pick<OfflineState, 'status' | 'progress'>,
  packIds: readonly string[],
  statuses: readonly PackStatus[] | null,
  failures: SetupState['failures'] = [],
): SetupState {
  if (off.status === 'unsupported') {
    return { stage: 'ready', progress: null, missing: [], failures: [], unsupported: true };
  }
  if (off.status === 'error') {
    return { stage: 'error', progress: null, missing: [...packIds], failures, unsupported: false };
  }
  if (off.status !== 'ready') {
    return {
      stage: 'core',
      progress: off.progress,
      missing: [...packIds],
      failures: [],
      unsupported: false,
    };
  }
  const byId = new Map((statuses ?? []).map((s) => [s.packId, s]));
  const missing = packIds.filter((id) => {
    const s = byId.get(id);
    return !s || (s.state !== 'ready' && s.state !== 'core');
  });
  if (missing.length === 0) {
    return { stage: 'ready', progress: null, missing: [], failures: [], unsupported: false };
  }
  let done = 0;
  let total = 0;
  for (const id of missing) {
    const s = byId.get(id);
    const p = getPackProgress(id);
    total += p?.totalBytes ?? s?.bytes ?? 0;
    done += p?.doneBytes ?? 0;
  }
  // 状態を読み終える前（statuses が null）は失敗扱いにしない
  const unavailable = (statuses === null ? [] : missing)
    .filter((id) => !byId.get(id) || byId.get(id)?.state === 'unavailable')
    .map((packId) => ({ packId, reason: 'unavailable' as const }));
  return {
    stage: 'packs',
    progress: { done, total },
    missing,
    failures: [
      ...failures,
      ...unavailable.filter((u) => !failures.some((f) => f.packId === u.packId)),
    ],
    unsupported: false,
  };
}

/**
 * 初回準備の2段階を進めて状態を返す。コアがそろったら、packIds のうち未取得・版違いのものを自動で取得する。
 * retry() で失敗したものを取り直す。
 */
export function usePackSetup(packIds: readonly string[]): SetupState & { retry: () => void } {
  const off = useOfflineState();
  const seq = useSyncExternalStore(subscribePacks, getPacksSeq, getPacksSeq);
  const [statuses, setStatuses] = useState<PackStatus[] | null>(null);
  const [failures, setFailures] = useState<SetupState['failures']>([]);
  const [attempt, setAttempt] = useState(0);
  const key = packIds.join(',');
  const coreReady = off.status === 'ready';

  useEffect(() => {
    if (!coreReady || key === '') return;
    let alive = true;
    const timer = setTimeout(() => {
      void computePackStatuses(key.split(',')).then((s) => {
        if (alive) setStatuses(s);
      });
    }, 150);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [coreReady, key, seq]);

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
      if (todo.length === 0) return;
      const failed = await downloadPackList(todo);
      if (alive) setFailures(failed);
    })();
    return () => {
      alive = false;
    };
  }, [coreReady, key, attempt]);

  const state = summarizeSetup(off, packIds, coreReady ? statuses : null, failures);
  return {
    ...state,
    retry: () => {
      setFailures([]);
      setAttempt((n) => n + 1);
    },
  };
}
