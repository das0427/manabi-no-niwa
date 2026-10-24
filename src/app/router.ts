/**
 * 小さなハッシュルーター（architecture.md 3章）。
 * 画面を変えるときは前の音声を止める（VO-04）。連続の遷移は 400ms 以内なら無視する（OP-05）。
 */
import { useSyncExternalStore } from 'react';
import { audio } from '../core/audio/index';
import { MODE_IDS, type ModeId } from '../core/types';

export type Route =
  | { name: 'start' }
  | { name: 'home' }
  | { name: 'mode'; modeId: ModeId; variantId?: string }
  | { name: 'notebook' }
  | { name: 'parent'; tab: string };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [a, b, c] = parts;
  if (a === 'home') return { name: 'home' };
  if (a === 'notebook') return { name: 'notebook' };
  if (a === 'parent') return { name: 'parent', tab: b ?? 'records' };
  if (a === 'play' && b && (MODE_IDS as readonly string[]).includes(b)) {
    return c
      ? { name: 'mode', modeId: b as ModeId, variantId: c }
      : { name: 'mode', modeId: b as ModeId };
  }
  return { name: 'start' };
}

export function routeToHash(r: Route): string {
  switch (r.name) {
    case 'start':
      return '#/';
    case 'home':
      return '#/home';
    case 'notebook':
      return '#/notebook';
    case 'parent':
      return `#/parent/${r.tab}`;
    case 'mode':
      return r.variantId ? `#/play/${r.modeId}/${r.variantId}` : `#/play/${r.modeId}`;
  }
}

let last = 0;

export function navigate(r: Route, opts: { replace?: boolean; force?: boolean } = {}): void {
  const now = Date.now();
  if (!opts.force && now - last < 400) return;
  last = now;
  audio.stop();
  const hash = routeToHash(r);
  if (location.hash === hash) return;
  if (opts.replace) {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = hash;
  }
}

function subscribe(cb: () => void): () => void {
  const onChange = () => {
    audio.stop();
    cb();
  };
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash);
  return parseHash(hash);
}
