// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { KANJI_BY_GRADE } from '../src/text/kanji-grades.ts';
import { collectElementaryKanji, stripComments } from './fonts/chars-lib.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const committed = readFileSync(path.join(root, 'scripts/fonts/used-chars-elementary.txt'), 'utf8');

describe('小学生用フォントの字の絞り込み（review-1 #22）', () => {
  const computed = collectElementaryKanji(root);

  it('配当漢字 1026 字がすべて入っている（欠けがない）', () => {
    const all = Object.values(KANJI_BY_GRADE).join('');
    expect([...all]).toHaveLength(1026);
    const have = new Set(computed);
    expect([...all].filter((c) => !have.has(c))).toEqual([]);
  });

  it('教材パックの漢字も入っている（src/packs の .ts）', () => {
    const have = new Set(computed);
    const packFiles = [
      'src/packs/g3-ja/read-character.ts',
      'src/packs/kanji-g12/data/homophone.ts',
    ];
    for (const f of packFiles) {
      const text = stripComments(readFileSync(path.join(root, f), 'utf8'));
      const missing = [...text].filter(
        (c) => /[一-龥]/.test(c) && c !== '鿿' && c !== '㐀' && !have.has(c),
      );
      expect(missing, f).toEqual([]);
    }
  });

  it('漢字だけで、正規表現の範囲の端の字は含まない', () => {
    for (const c of computed) {
      expect(/[㐀-鿿]/.test(c)).toBe(true);
    }
    expect(computed).not.toContain('鿿');
    expect(computed).not.toContain('䶿');
  });

  it('コミット済みの used-chars-elementary.txt は最新（古ければ npm run chars）', () => {
    expect(committed).toBe(computed.join(''));
  });
});
