/**
 * Service Worker と画面（src/core/offline）の間のメッセージ定義。
 * 型だけを持つ（sw.ts は単独の 1 ファイルとして変換されるため、値は共有しない）。
 */

/** 画面 → SW */
export type ClientToSwMessage = { type: 'SKIP_WAITING' } | { type: 'GET_VERSION' };

/** SW → 画面（clients.matchAll で全画面へ） */
export interface PrecacheProgressMessage {
  type: 'precache-progress';
  done: number;
  total: number;
}

/** SW → 画面（GET_VERSION への返信。MessageChannel のポートで返す） */
export interface VersionReplyMessage {
  type: 'version';
  version: string;
}
