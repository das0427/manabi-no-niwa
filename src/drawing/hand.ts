/**
 * おえかきで描く手（道具欄を置く側）。2.1.0 から子供の設定（ChildSettings.drawingHand）に持ち、
 * 保護者画面の設定とバックアップ（書き出し・読み込み）の対象にする。
 * 2.0 までは端末内（localStorage の `mnw:draw:hand:<profileId>`）に持っていたので、初めて開いたときに移す。
 */
import type { ChildSettings, DrawingHand } from '../core/types';

export const legacyHandKey = (profileId: string): string => `mnw:draw:hand:${profileId}`;

export function handOf(settings: Pick<ChildSettings, 'drawingHand'>): DrawingHand {
  return settings.drawingHand === 'left' ? 'left' : 'right';
}

type KeyStore = Pick<Storage, 'getItem' | 'removeItem'>;

/**
 * 端末内の古い値を設定へ移す。移す必要があれば新しい設定を返す（無ければ null）。
 * - 設定に値があれば設定を正とする（端末内の古い値は消すだけ）
 * - 端末内の値が 'left' のときだけ設定に入れる（'right' は既定と同じ）
 * - 端末内の保存が使えなくても失敗しない
 */
export function migrateLegacyHand(
  settings: ChildSettings,
  store: KeyStore | null,
): { next: ChildSettings | null; clear: boolean } {
  if (!store) return { next: null, clear: false };
  let old: string | null;
  try {
    old = store.getItem(legacyHandKey(settings.profileId));
  } catch {
    return { next: null, clear: false };
  }
  if (old === null) return { next: null, clear: false };
  if (settings.drawingHand !== undefined || old !== 'left') return { next: null, clear: true };
  return { next: { ...settings, drawingHand: 'left' }, clear: true };
}

/** 移したあと、端末内の古い値を消す */
export function clearLegacyHand(profileId: string, store: KeyStore | null): void {
  try {
    store?.removeItem(legacyHandKey(profileId));
  } catch {
    /* 消せなくても、設定に値があれば設定が正 */
  }
}

/** localStorage（使えないときは null） */
export function localKeyStore(): KeyStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
