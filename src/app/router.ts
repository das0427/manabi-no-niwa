/**
 * 小さなハッシュルーター（architecture.md 3章）。
 * 画面を変えるときは前の音声を止める（VO-04）。連続の遷移は 400ms 以内なら無視する（OP-05）。
 */
import { useSyncExternalStore } from 'react';
import { audio } from '../core/audio/index';
import { MODE_IDS, type ModeId } from '../core/types';
import type { VoiceSeq } from '../voice/catalog/index';

export type Route =
  | { name: 'start' }
  | { name: 'home' }
  | { name: 'mode'; modeId: ModeId; variantId?: string }
  | { name: 'notebook' }
  | { name: 'parent'; tab: string }
  /** 教科の単元の地図（grade: 表示する学年。省略時はプロフィールの学年） */
  | { name: 'subject'; subject: string; grade?: string }
  /** 単元の学習（UnitRunner） */
  | { name: 'unit'; unitId: string };

const UNIT_ID = /^(p23|p4|p5|g[1-6])\.[a-z]+\.[a-z0-9-]+$/;

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [a, b, c] = parts;
  if (a === 'home') return { name: 'home' };
  if (a === 'notebook') return { name: 'notebook' };
  if (a === 'parent') return { name: 'parent', tab: b ?? 'records' };
  if (a === 'unit' && b && UNIT_ID.test(b)) return { name: 'unit', unitId: b };
  if (a === 'subject' && b && /^[a-z]+$/.test(b))
    return c && /^(p23|p4|p5|g[1-6])$/.test(c)
      ? { name: 'subject', subject: b, grade: c }
      : { name: 'subject', subject: b };
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
    case 'subject':
      return r.grade ? `#/subject/${r.subject}/${r.grade}` : `#/subject/${r.subject}`;
    case 'unit':
      return `#/unit/${r.unitId}`;
  }
}

let last = 0;
/** 遷移した後に読み上げる声（遷移で前の声を止めてから再生する。止めた直後に消えないように） */
let pendingSay: VoiceSeq | null = null;

export function navigate(
  r: Route,
  opts: { replace?: boolean; force?: boolean; say?: VoiceSeq } = {},
): void {
  const now = Date.now();
  if (!opts.force && now - last < 400) return;
  last = now;
  audio.stop();
  const hash = routeToHash(r);
  if (location.hash === hash) {
    if (opts.say) void audio.play(opts.say);
    return;
  }
  pendingSay = opts.say ?? null;
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
    const say = pendingSay;
    pendingSay = null;
    if (say) void audio.play(say);
    cb();
  };
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash);
  return parseHash(hash);
}
