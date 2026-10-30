// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { KANJI_BY_GRADE } from '../src/text/kanji-grades.ts';
import {
  collectCoreChars,
  collectElementaryKanji,
  isIdeograph,
  stripComments,
  walkSources,
} from './fonts/chars-lib.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');
const packFiles = walkSources(path.join(root, 'src/packs'), /\.(tsx?|css|json)$/);
/** 正規表現の範囲の端（[一-鿿] 等）。実在の字として使っていない */
const RANGE_BOUNDS = new Set(['㐀', '䶿', '鿿']);
const packText = (file: string) => {
  const raw = readFileSync(file, 'utf8');
  return file.endsWith('.json') ? raw : stripComments(raw);
};

describe('小学生用フォントの字の絞り込み（review-1 #22）', () => {
  const computed = collectElementaryKanji(root);
  const have = new Set(computed);

  it('配当漢字 1026 字がすべて入っている（欠けがない）', () => {
    const all = [...Object.values(KANJI_BY_GRADE).join('')];
    expect(all).toHaveLength(1026);
    expect(all.filter((c) => !have.has(c))).toEqual([]);
  });

  it('教材パック（src/packs のすべての .ts / .json）の漢字が入っている', () => {
    expect(packFiles.length).toBeGreaterThan(20);
    const missing = new Set<string>();
    for (const f of packFiles) {
      for (const c of packText(f))
        if (isIdeograph(c) && !RANGE_BOUNDS.has(c) && !have.has(c)) missing.add(c);
    }
    expect([...missing]).toEqual([]);
  });

  it('漢字だけで、正規表現の範囲の端の字は含まない', () => {
    expect(computed.filter((c) => !isIdeograph(c))).toEqual([]);
    for (const c of RANGE_BOUNDS) expect(computed).not.toContain(c);
  });

  it('コミット済みの used-chars-elementary.txt は最新（古ければ npm run chars → npm run fonts）', () => {
    expect(read('scripts/fonts/used-chars-elementary.txt')).toBe(computed.join(''));
  });
});

describe('コアのフォントの字（used-chars.txt）', () => {
  const computed = collectCoreChars(root);
  const have = new Set(computed);

  it('教材パックの漢字以外の字（記号・単位など）はコアに入る（小学生用フォントは漢字だけのため）', () => {
    const missing = new Set<string>();
    for (const f of packFiles) {
      for (const c of packText(f)) {
        if ((c.codePointAt(0) ?? 0) > 0x7f && !isIdeograph(c) && !have.has(c)) missing.add(c);
      }
    }
    expect([...missing]).toEqual([]);
    expect(have.has('℃')).toBe(true);
  });

  it('配当表の漢字はコアに入れない（小学生用フォント側）', () => {
    // kanji-grades.ts と教材パックにしか出てこない配当漢字は、コアに入っていない
    const all = [...Object.values(KANJI_BY_GRADE).join('')];
    expect(all.filter((c) => !have.has(c)).length).toBeGreaterThan(100);
  });

  it('コミット済みの used-chars.txt は最新（古ければ npm run chars → npm run fonts）', () => {
    expect(read('scripts/fonts/used-chars.txt')).toBe(computed.join(''));
  });
});
