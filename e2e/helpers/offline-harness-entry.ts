/// <reference types="vite/client" />
/**
 * E2E 専用のハーネス。src/core/offline をそのまま 1 本の JS にまとめ、
 * window.__mnwOffline に公開して startOffline() を呼ぶ（アプリ本体の main.tsx に依存せずに検証するため）。
 * e2e/helpers/dist.ts がビルドして、テスト用の dist のコピーにだけ差し込む。
 */
import * as offline from '../../src/core/offline/index';

declare global {
  interface Window {
    __mnwOffline?: typeof offline;
  }
}

window.__mnwOffline = offline;
offline.startOffline();
