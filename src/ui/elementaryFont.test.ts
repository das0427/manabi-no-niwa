import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ELEMENTARY_FONT_FILES,
  loadElementaryFont,
  needsElementaryFont,
  resetElementaryFontForTest,
} from './elementaryFont';

afterEach(() => {
  vi.unstubAllGlobals();
  resetElementaryFontForTest();
});

describe('小学生用フォント', () => {
  it('小学生の区分だけが使う（幼児は使わない）', () => {
    expect(needsElementaryFont('g1')).toBe(true);
    expect(needsElementaryFont('g6')).toBe(true);
    expect(needsElementaryFont('toddler')).toBe(false);
    expect(needsElementaryFont('p4')).toBe(false);
    expect(needsElementaryFont('p5')).toBe(false);
  });

  it('FontFace が無い環境では何もしない', () => {
    vi.stubGlobal('FontFace', undefined);
    expect(() => loadElementaryFont('/')).not.toThrow();
  });

  it('太さごとに FontFace を作り、漢字の範囲で読み込む。2回目は作らない', () => {
    const made: { family: string; src: string; desc: Record<string, string> }[] = [];
    class FakeFace {
      constructor(family: string, src: string, desc: Record<string, string>) {
        made.push({ family, src, desc });
      }
      load() {
        return Promise.resolve(this);
      }
    }
    const add = vi.fn();
    vi.stubGlobal('FontFace', FakeFace);
    Object.defineProperty(document, 'fonts', { value: { add }, configurable: true });
    loadElementaryFont('/');
    loadElementaryFont('/');
    expect(made).toHaveLength(ELEMENTARY_FONT_FILES.length);
    expect(made[0]!.family).toBe('Zen Maru Gothic');
    expect(made[0]!.src).toContain('/fonts/zen-maru-gothic-kanji-400.woff2');
    expect(made[1]!.desc.weight).toBe('700');
    expect(made[0]!.desc.unicodeRange).toContain('U+4E00-9FFF');
  });
});
