import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../types';
import { normalizeSettings } from './validate';

describe('設定: showPreschoolEnglish（幼児ホームの「えいご」の札。省略時は出す）', () => {
  const base = () => defaultSettings('p1', 'p4');

  it('省略した設定は項目を作らない（データ移行なし。defaultSettings にも無い）', () => {
    expect('showPreschoolEnglish' in base()).toBe(false);
    const s = normalizeSettings(base(), 'p1', true)!;
    expect('showPreschoolEnglish' in s).toBe(false);
  });

  it('true・false はそのまま残る', () => {
    for (const v of [true, false]) {
      const s = normalizeSettings({ ...base(), showPreschoolEnglish: v }, 'p1', true)!;
      expect(s.showPreschoolEnglish).toBe(v);
    }
  });

  it('真偽値でない値は、厳密な読み込みでは不正（null）、ゆるい読み込みでは項目を作らない', () => {
    const bad = { ...base(), showPreschoolEnglish: 'yes' };
    expect(normalizeSettings(bad, 'p1', true)).toBeNull();
    const loose = normalizeSettings(bad, 'p1', false)!;
    expect('showPreschoolEnglish' in loose).toBe(false);
  });
});
