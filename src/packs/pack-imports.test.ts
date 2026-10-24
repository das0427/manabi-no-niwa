/**
 * 教材パックが値として import してよい本体のモジュールは、固定名のチャンク pack-runtime に入る4つだけ
 * （vite.config.ts PACK_RUNTIME）。ほかの本体のモジュールを値で import すると、本体を更新するたびに
 * パックの版が変わり、オフラインで教材が開けなくなる（コードレビュー #2）。型の import は自由。
 */
import { describe, expect, it } from 'vitest';

const sources = import.meta.glob<string>(['./*/**/*.ts', '!./_*/**', '!./**/*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

const ALLOWED = ['core/util/rng', 'text/kanji-grades', 'text/rich', 'core/answer/number'];

describe('教材パックの import', () => {
  it('本体のモジュールを値で import するのは pack-runtime の4つだけ', () => {
    const bad: string[] = [];
    for (const [path, src] of Object.entries(sources)) {
      for (const m of src.matchAll(/^import\s+(?!type\b)[^;]*?from\s+'((?:\.\.\/)+)([^']+)'/gm)) {
        const up = m[1]!.length / 3;
        const target = m[2]!;
        // パックの中（../ が1つ = 同じパックの上の階層ではなく packs/ 直下）は対象外
        const depth = path.split('/').length - 2; // ./<pack>/<file> → 1
        if (up <= depth) continue; // パックの中
        if (target.startsWith('_data/')) continue; // 共有データ
        if (!ALLOWED.some((a) => target.replace(/\.tsx?$/, '') === a))
          bad.push(`${path}: ${target}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
