/**
 * 教材パックの読み込み（UnitRunner などから使う公開 API。docs/expansion/architecture.md 6章）。
 *
 * - パックは `src/packs/<packId>/index.ts`（PackContent を default export）。ここから動的 import する。
 *   ビルドでは assets/packs/<packId>/ のチャンクになる（vite.config.ts の codeSplitting）。
 * - 小学生のパックは dist/packs.json に載り、保護者画面から取得する（キャッシュ `mnw-pack/<packId>@<hash>`）。
 *   幼児のパック（p23 / p4 / p5）は packs.json に載らず、コアと一緒にそろう。
 * - 本番ビルドで、取得していない・版が違うパックは開かない（PackUnavailableError）。
 * - 見本パック（src/packs/_sample-*）は VITE_MNW_SAMPLE_PACKS=1 のビルドだけに入る（E2E 用）。
 */
import {
  computePackStatuses,
  deletePackFiles,
  downloadPackFiles,
  downloadPackList,
  getPackIndex,
  PACK_DOWNLOAD_HEADER,
  packFileUrl,
  type PackDownloadFailure,
  type PackProgress,
  type PackStatus,
} from '../core/offline/packs';

export type { PackProgress, PackStatus, PackState } from '../core/offline/packs';
export { PackDownloadError } from '../core/offline/packs';

import type { PackContent } from '../curriculum/types';

/** パックの中身（単元の定義の一覧）。正本は src/curriculum/types.ts */
export type { PackContent };

/** 見本パック（E2E 用。src/packs/_sample-*）の中身。教材ではないので単元の型に従わない */
export type SamplePackContent = { units: Record<string, unknown> };

type PackModule = { default: PackContent };
type Importer = () => Promise<PackModule>;

/** 本番のパック（'_' で始まるディレクトリ = 共有データ・見本を除く） */
const REGULAR = import.meta.glob<PackModule>(['./*/index.ts', '!./_*/index.ts']);
/** 見本パック（E2E 用のビルドだけ） */
const SAMPLES: Record<string, Importer> =
  import.meta.env.VITE_MNW_SAMPLE_PACKS === '1'
    ? import.meta.glob<PackModule>('./_sample-*/index.ts')
    : {};

function idOfPath(p: string): string {
  return /^\.\/([^/]+)\/index\.ts$/.exec(p)?.[1] ?? p;
}

const IMPORTERS: ReadonlyMap<string, Importer> = new Map(
  Object.entries({ ...REGULAR, ...SAMPLES }).map(([p, fn]) => [idOfPath(p), fn]),
);

/** このビルドに入っているパックの ID（コア同梱を含む） */
export function knownPackIds(): string[] {
  return [...IMPORTERS.keys()].sort();
}

/**
 * パックを開けない理由:
 *  - 'not-downloaded' : 取得していない（保護者画面で取得）
 *  - 'outdated'       : 取得した版がアプリの版と合わない（保護者画面で一括再取得）
 *  - 'offline'        : 配信につながらず読み込めなかった（取得済みでもキャッシュが欠けている、準備前など）
 */
export type PackUnavailableReason = 'not-downloaded' | 'outdated' | 'offline';

export class PackUnavailableError extends Error {
  readonly packId: string;
  readonly reason: PackUnavailableReason;
  constructor(packId: string, reason: PackUnavailableReason, options?: { cause?: unknown }) {
    super(`教材パック ${packId} を開けません（${reason}）`, options);
    this.name = 'PackUnavailableError';
    this.packId = packId;
    this.reason = reason;
  }
}

/** 子供向けの文言（ひらがな。保護者画面への案内）。R#4、X-OF-02 */
export const PACK_UNAVAILABLE_CHILD_TEXT: Record<PackUnavailableReason, string> = {
  'not-downloaded': 'おうちの ひとに ダウンロードを たのんでね',
  outdated: 'あたらしい きょうざいを とってきてね',
  offline: 'いまは ひらけないよ。おうちの ひとに みてもらってね',
};

/** 保護者向けの説明（漢字かな交じり） */
export const PACK_UNAVAILABLE_PARENT_TEXT: Record<PackUnavailableReason, string> = {
  'not-downloaded':
    'この教材はまだ取得していません。保護者の画面の「きょうざい」タブから取得してください。',
  outdated:
    'アプリが更新され、この教材の取得し直しが必要です。保護者の画面の「きょうざい」タブで「まとめて取得し直す」を押してください。',
  offline:
    '教材を読み込めませんでした。ネットワークにつないで、保護者の画面の「きょうざい」タブを確認してください。',
};

function isUnknownPack(packId: string): boolean {
  return !IMPORTERS.has(packId);
}

/** 配信元にこのパックのファイルがあるか（未取得のパックをネットワークから直接読めるか） */
async function reachable(file: string | undefined): Promise<boolean> {
  if (!file) return false;
  try {
    const res = await fetch(packFileUrl(file), {
      method: 'HEAD',
      cache: 'no-store',
      headers: { [PACK_DOWNLOAD_HEADER]: '1' },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface LoadPackOptions {
  /**
   * 未取得のパックを、配信につながっていればネットワークから直接読む（キャッシュには入れない）。既定 true。
   * つながらなければ PackUnavailableError('not-downloaded')。
   */
  allowNetwork?: boolean;
}

/**
 * パックを読み込む（動的 import）。
 * 本番ビルドでは、packs.json に載るパック（小学生）は
 *  - 取得済みで版が合う → キャッシュから読む
 *  - 版が違う → PackUnavailableError('outdated')（配信につながっていても開かない: R#4）
 *  - 未取得 → 配信につながればネットワークから読む。つながらなければ PackUnavailableError('not-downloaded')
 * 読み込みに失敗したとき（取得済みのキャッシュが欠けた、準備前でオフライン等）は PackUnavailableError('offline')。
 * このビルドに無い packId は Error。
 */
export async function loadPack(
  packId: string,
  options: LoadPackOptions = {},
): Promise<PackContent> {
  const importer = IMPORTERS.get(packId);
  if (!importer) throw new Error(`教材パック ${packId} はこのアプリにありません`);
  if (import.meta.env.PROD) {
    const index = await getPackIndex();
    const entry = index?.[packId];
    if (entry) {
      const [status] = (await computePackStatuses([packId])).filter((s) => s.packId === packId);
      if (status?.state === 'outdated') throw new PackUnavailableError(packId, 'outdated');
      if (status?.state === 'not-downloaded') {
        // 失敗した import はブラウザが覚えていることがあるため、先に配信元を確かめてから読む
        if (options.allowNetwork === false || !(await reachable(entry.files[0]))) {
          throw new PackUnavailableError(packId, 'not-downloaded');
        }
      }
    }
  }
  try {
    return (await importer()).default;
  } catch (e) {
    throw new PackUnavailableError(packId, 'offline', { cause: e });
  }
}

/** 1つのパックの状態 */
export async function packStatus(packId: string): Promise<PackStatus> {
  if (isUnknownPack(packId)) throw new Error(`教材パック ${packId} はこのアプリにありません`);
  const all = await computePackStatuses([packId]);
  const found = all.find((s) => s.packId === packId);
  if (!found) throw new Error(`教材パック ${packId} の状態を求められません`);
  return found;
}

/** このビルドのすべてのパックの状態（packs.json の順ではなく packId の順） */
export function listPackStatus(): Promise<PackStatus[]> {
  return computePackStatuses(knownPackIds());
}

/**
 * パックを取得する（packs.json に載るパックだけ）。進み具合を onProgress で知らせる。
 * 失敗は PackDownloadError（reason: 'offline' | 'not-found' | 'mismatch' | 'quota' | …）。旧パックは残る。
 */
export function downloadPack(
  packId: string,
  onProgress?: (p: PackProgress) => void,
): Promise<void> {
  if (isUnknownPack(packId))
    return Promise.reject(new Error(`教材パック ${packId} はこのアプリにありません`));
  return downloadPackFiles(packId, onProgress);
}

/** 複数のパックを順に取得する（一括再取得・初回準備）。失敗した packId と理由を返す */
export function downloadPacks(
  packIds: readonly string[],
  onProgress?: (p: PackProgress, index: number, count: number) => void,
): Promise<{ packId: string; reason: PackDownloadFailure }[]> {
  return downloadPackList(
    packIds.filter((id) => !isUnknownPack(id)),
    onProgress,
  );
}

/** 版が古い（outdated）パックをまとめて取得し直す */
export async function redownloadOutdated(
  onProgress?: (p: PackProgress, index: number, count: number) => void,
): Promise<{ packId: string; reason: PackDownloadFailure }[]> {
  const ids = (await listPackStatus()).filter((s) => s.state === 'outdated').map((s) => s.packId);
  return downloadPacks(ids, onProgress);
}

/** パックの教材を消す（学習の記録は消さない） */
export function deletePack(packId: string): Promise<void> {
  return deletePackFiles(packId);
}

// E2E 用のビルド（見本パック入り）だけ、テストから呼べるようにする
if (import.meta.env.VITE_MNW_SAMPLE_PACKS === '1' && typeof window !== 'undefined') {
  (window as unknown as { __mnwPacks?: unknown }).__mnwPacks = {
    loadPack,
    packStatus,
    listPackStatus,
    downloadPack,
    downloadPacks,
    redownloadOutdated,
    deletePack,
    knownPackIds,
  };
}
