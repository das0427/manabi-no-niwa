/** 保護者画面の共通部品（表示用の整形・ダウンロード・読み込み） */
import { useCallback, useEffect, useState } from 'react';
import type { ModeId, Outcome } from '../core/types';
import { MODES } from '../modes/registry';

/**
 * アプリの版。package.json の version をビルド時に埋め込む（vite.config.ts の define）。
 * 以前は手で書いていたため、2.0.0・2.0.1 でも「1.0.0」と表示していた。
 */
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION || 'dev';

export const OUTCOME_LABEL: Record<Outcome, string> = {
  independent: '自力でできた',
  self_corrected: 'もういちど（ヒント1の後に自分で選び直して正解）',
  after_hint: 'ヒント後（具体的なヒントの後に正解）',
  after_review: '見直し後（見直しを使って正解）',
  skipped: 'スキップ（正解を見て次へ）',
  abandoned: '途中でやめた',
};

export function modeTitle(id: ModeId | 'unit', unitId?: string): string {
  if (id === 'unit') return unitId ?? 'たんげん';
  return MODES.find((m) => m.id === id)?.title.replace(/\s+/g, '') ?? id;
}

const pad = (n: number): string => String(n).padStart(2, '0');

export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function todayString(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function startOfToday(now = new Date()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** manabi-backup-YYYYMMDD-HHmm.json */
export function backupFileName(now = new Date()): string {
  return `manabi-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

/** Blob と <a download> でファイルとして保存する */
export function downloadText(text: string, fileName: string): number {
  return downloadBlob(new Blob([text], { type: 'application/json' }), fileName);
}

/** Blob をファイルとして保存させる（端末内。外部へ送らない） */
export function downloadBlob(blob: Blob, fileName: string): number {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return blob.size;
}

export function readFileText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : '');
    fr.onerror = () => reject(fr.error ?? new Error('read failed'));
    fr.readAsText(file);
  });
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** 非同期の読み込み。fn は useCallback で包んで渡す。reload() で再読み込み */
export function useLoad<T>(fn: () => Promise<T>): { data: T | undefined; reload: () => void } {
  const [data, setData] = useState<T | undefined>(undefined);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    void fn().then((v) => {
      if (alive) setData(v);
    });
    return () => {
      alive = false;
    };
  }, [fn, n]);
  const reload = useCallback(() => setN((x) => x + 1), []);
  return { data, reload };
}

export const AVATARS = ['rabbit', 'dog', 'cat', 'bear', 'monkey', 'fox', 'chick', 'frog'] as const;
export const AVATAR_LABEL: Record<(typeof AVATARS)[number], string> = {
  rabbit: 'うさぎ',
  dog: 'いぬ',
  cat: 'ねこ',
  bear: 'くま',
  monkey: 'さる',
  fox: 'きつね',
  chick: 'ひよこ',
  frog: 'かえる',
};
