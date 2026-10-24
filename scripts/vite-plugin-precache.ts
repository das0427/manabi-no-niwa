import type { Plugin } from 'vite';

/** 仮実装（T06 で Service Worker とプリキャッシュ一覧の生成に置き換える） */
export function precachePlugin(): Plugin {
  return { name: 'mnw-precache' };
}
