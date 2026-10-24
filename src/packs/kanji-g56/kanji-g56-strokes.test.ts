// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { KANJI_BY_GRADE } from '../../text/kanji-grades';
import { FIRST_STROKE_OF, STROKES_OF } from './data/strokes';

interface StrokeFile {
  chars: Record<string, { strokes: number[][][] }>;
}

const DIR = fileURLToPath(new URL('../_data/strokes/', import.meta.url));
const load = (g: 4 | 5 | 6): StrokeFile =>
  JSON.parse(readFileSync(join(DIR, `kanji-g${g}.json`), 'utf-8')) as StrokeFile;

describe('画数の表と書き順データ（KanjiVG）の突き合わせ', () => {
  for (const g of [4, 5, 6] as const) {
    it(`${g}年の全字: 表の画数（人が書き出した標準の画数）と書き順データの画の数が一致する`, () => {
      const f = load(g);
      const bad: string[] = [];
      for (const ch of KANJI_BY_GRADE[g]) {
        const mine = STROKES_OF.get(ch);
        const kv = f.chars[ch]?.strokes.length;
        if (mine !== kv) bad.push(`${ch}: 表 ${mine} / データ ${kv}`);
      }
      expect(bad).toEqual([]);
    });
  }
});

/** 1画目の始点から終点へのむき（書き順データ）。点は短い（どの点も 160 未満） */
describe('1画目の種類の表と書き順データの突き合わせ（4〜6年の字）', () => {
  for (const g of [4, 5, 6] as const) {
    it(`${g}年の字: 1画目の種類が、書き順データの1画目の長さ・向きと食い違わない`, () => {
      const f = load(g);
      const bad: string[] = [];
      for (const ch of KANJI_BY_GRADE[g]) {
        const want = FIRST_STROKE_OF.get(ch);
        if (!want) continue;
        const st = f.chars[ch]!.strokes[0]!;
        const [x0, y0] = st[0]!;
        const [x1, y1] = st[st.length - 1]!;
        const dx = x1! - x0!;
        const dy = y1! - y0!;
        let len = 0;
        for (let i = 1; i < st.length; i++)
          len += Math.hypot(st[i]![0]! - st[i - 1]![0]!, st[i]![1]! - st[i - 1]![1]!);
        const ok =
          want === 'ten'
            ? len < 160
            : want === 'yoko'
              ? dx > 0 && Math.abs(dx) > Math.abs(dy)
              : want === 'tate'
                ? dy > 0 && Math.abs(dy) > Math.abs(dx)
                : dx < 0 && dy > 0;
        if (!ok) bad.push(`${ch}: ${want} / 始点→終点 (${dx},${dy}) 長さ ${Math.round(len)}`);
      }
      expect(bad).toEqual([]);
    });
  }
});
