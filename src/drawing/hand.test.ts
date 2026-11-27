import { describe, expect, it } from 'vitest';
import { normalizeSettings } from '../core/storage/validate';
import { defaultSettings } from '../core/types';
import { clearLegacyHand, handOf, hasLegacyHand, legacyHandKey, migrateLegacyHand } from './hand';

/** 架空のプロフィール ID の端末内保存 */
function memStore(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    removeItem: (k: string) => void m.delete(k),
  };
}

describe('おえかきの描く手（設定・バックアップへ移す）', () => {
  const pid = 'p-test-1';

  it('設定に無いときは右手。左手の設定なら左手', () => {
    expect(handOf(defaultSettings(pid))).toBe('right');
    expect(handOf({ ...defaultSettings(pid), drawingHand: 'left' })).toBe('left');
  });

  it('端末内の古い値「left」を設定へ移し、古い値を消す', () => {
    const st = memStore({ [legacyHandKey(pid)]: 'left' });
    const r = migrateLegacyHand(defaultSettings(pid), st);
    expect(r.next?.drawingHand).toBe('left');
    expect(r.clear).toBe(true);
    clearLegacyHand(pid, st);
    expect(st.m.has(legacyHandKey(pid))).toBe(false);
  });

  it('古い値が right なら設定は変えない（既定と同じ）。消すだけ', () => {
    const r = migrateLegacyHand(defaultSettings(pid), memStore({ [legacyHandKey(pid)]: 'right' }));
    expect(r).toEqual({ next: null, clear: true });
  });

  it('設定に値があれば設定が正（古い値で上書きしない）', () => {
    const s = { ...defaultSettings(pid), drawingHand: 'right' as const };
    const r = migrateLegacyHand(s, memStore({ [legacyHandKey(pid)]: 'left' }));
    expect(r).toEqual({ next: null, clear: true });
  });

  it('古い値が無い・端末内保存が使えない・読むと例外でも失敗しない', () => {
    expect(migrateLegacyHand(defaultSettings(pid), memStore())).toEqual({
      next: null,
      clear: false,
    });
    expect(migrateLegacyHand(defaultSettings(pid), null)).toEqual({ next: null, clear: false });
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(migrateLegacyHand(defaultSettings(pid), broken)).toEqual({ next: null, clear: false });
    expect(() => clearLegacyHand(pid, broken)).not.toThrow();
    expect(hasLegacyHand(pid, broken)).toBe(false);
  });

  it('古い値があるプロフィールだけを移す対象にする（選んでいないプロフィールも）', () => {
    const st = memStore({ [legacyHandKey('p-test-2')]: 'right' });
    expect(hasLegacyHand('p-test-2', st)).toBe(true);
    expect(hasLegacyHand(pid, st)).toBe(false);
    expect(hasLegacyHand(pid, null)).toBe(false);
  });

  it('設定の検証: 書き出した値が読み込みで戻る。不正な値は厳密な読み込みで拒否', () => {
    const s = { ...defaultSettings(pid), drawingHand: 'left' as const };
    const back = normalizeSettings(JSON.parse(JSON.stringify(s)), pid, true);
    expect(back?.drawingHand).toBe('left');
    // 2.0 までの設定（項目なし）はそのまま読める（右手として扱う）
    const old = normalizeSettings(defaultSettings(pid), pid, true);
    expect(old).not.toBeNull();
    expect(old?.drawingHand).toBeUndefined();
    expect(normalizeSettings({ ...s, drawingHand: 'up' }, pid, true)).toBeNull();
    expect(normalizeSettings({ ...s, drawingHand: 'up' }, pid, false)?.drawingHand).toBeUndefined();
  });
});
