import { describe, expect, it } from 'vitest';
import type { PackContent } from './types';
import { buildIndex, UNIT_INDEX } from './unitIndex';

const modules = import.meta.glob<{ default: PackContent }>(
  ['../packs/*/index.ts', '!../packs/_*/index.ts'],
  {
    eager: true,
  },
);

describe('単元の索引', () => {
  it('unit-index.json がパックの定義と一致する（古ければ npm run build:unit-index）', () => {
    const packs = Object.values(modules).map((m) => m.default);
    expect(UNIT_INDEX).toEqual(buildIndex(packs));
  });
  it('単元IDが重複しない・前提の単元IDの形が正しい', () => {
    const ids = UNIT_INDEX.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const u of UNIT_INDEX)
      for (const p of u.prereq) expect(p).toMatch(/^(p23|p4|p5|g[1-6])\.[a-z]+\.[a-z0-9-]+$/);
  });
});
