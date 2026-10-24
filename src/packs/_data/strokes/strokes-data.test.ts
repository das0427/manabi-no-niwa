// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { KANJI_BY_GRADE } from '../../../text/kanji-grades';

interface StrokeFile {
  source: string;
  license: string;
  version: string;
  size: number;
  set: string;
  chars: Record<string, { strokes: number[][][] }>;
}

const DIR = fileURLToPath(new URL('.', import.meta.url));
const load = (name: string): StrokeFile =>
  JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf-8')) as StrokeFile;

const range = (from: number, to: number): string[] => {
  const out: string[] = [];
  for (let c = from; c <= to; c++) out.push(String.fromCodePoint(c));
  return out;
};

const GRADES = [1, 2, 3, 4, 5, 6] as const;
const NAMES = ['kana', ...GRADES.map((g) => `kanji-g${g}`)];

describe('書き順データ（KanjiVG 由来）', () => {
  for (const name of NAMES) {
    describe(name, () => {
      const f = load(name);

      it('出典・ライセンス・版・座標系を持つ', () => {
        expect(f.source).toBe('KanjiVG');
        expect(f.license).toBe('CC BY-SA 3.0');
        expect(f.version).toMatch(/^r\d{8}$/);
        expect(f.size).toBe(1000);
        expect(f.set).toBe(name);
      });

      it('すべての字が 1 画以上で、各画は 2 点以上・座標は 0〜1000 の整数', () => {
        const entries = Object.entries(f.chars);
        expect(entries.length).toBeGreaterThan(0);
        for (const [ch, v] of entries) {
          expect(v.strokes.length, ch).toBeGreaterThanOrEqual(1);
          for (const [i, st] of v.strokes.entries()) {
            expect(st.length, `${ch} 第${i + 1}画の点数`).toBeGreaterThanOrEqual(2);
            for (const p of st) {
              expect(p.length).toBe(2);
              for (const x of p) {
                expect(Number.isInteger(x), `${ch} 第${i + 1}画 ${x}`).toBe(true);
                expect(x).toBeGreaterThanOrEqual(0);
                expect(x).toBeLessThanOrEqual(1000);
              }
            }
          }
        }
      });
    });
  }

  it('kana: ひらがな（ぁ〜ゔ）・カタカナ（ァ〜ヶ）・長音記号がそろっている', () => {
    const f = load('kana');
    const want = [...range(0x3041, 0x3094), ...range(0x30a1, 0x30f6), 'ー'];
    expect(want.filter((c) => !(c in f.chars))).toEqual([]);
    // 既存の trace モードの 15 字と画数が食い違わない（同じ KanjiVG から作っている）
    const strokes: Record<string, number> = { し: 1, こ: 2, い: 2, り: 2, う: 2, ち: 2, そ: 1 };
    for (const [ch, n] of Object.entries(strokes)) expect(f.chars[ch]?.strokes.length, ch).toBe(n);
  });

  it('kanji-g1〜g6: 各学年の配当漢字とちょうど同じ字（過不足なし）で、学年間の重複もない', () => {
    const seen = new Set<string>();
    for (const g of GRADES) {
      const f = load(`kanji-g${g}`);
      const have = Object.keys(f.chars).sort();
      const want = [...KANJI_BY_GRADE[g]].sort();
      expect(have, `第${g}学年`).toEqual(want);
      for (const ch of have) {
        expect(seen.has(ch), ch).toBe(false);
        seen.add(ch);
      }
    }
    expect(seen.size).toBe(1026);
  });

  it('画数の目安: 一=1画・三=3画・森=12画・鏡=19画・論=15画', () => {
    const n = (g: number, ch: string) => load(`kanji-g${g}`).chars[ch]?.strokes.length;
    expect(n(1, '一')).toBe(1);
    expect(n(1, '森')).toBe(12);
    expect(n(1, '三')).toBe(3);
    expect(n(4, '鏡')).toBe(19);
    expect(n(6, '論')).toBe(15);
  });
});
