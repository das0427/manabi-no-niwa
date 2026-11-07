import { describe, expect, it } from 'vitest';
import { getIllust } from '../illust/registry';
import type { PackContent } from './types';
import { buildIndex, UNIT_INDEX } from './unitIndex';
import { parseMatrixOrder } from './unitOrder';
// 並びの正本（段階・教科ごとの行の順）。build:unit-index も同じ表を読む
import matrixMd from '../../docs/expansion/curriculum-matrix.md?raw';

const modules = import.meta.glob<{ default: PackContent }>(
  ['../packs/*/index.ts', '!../packs/_*/index.ts'],
  {
    eager: true,
  },
);

describe('単元の索引', () => {
  it('unit-index.json がパックの定義と一致する（古ければ npm run build:unit-index）', () => {
    const packs = Object.values(modules).map((m) => m.default);
    expect(UNIT_INDEX).toEqual(buildIndex(packs, parseMatrixOrder(matrixMd)));
  });
  it('単元IDが重複しない・前提の単元IDの形が正しい', () => {
    const ids = UNIT_INDEX.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const u of UNIT_INDEX)
      for (const p of u.prereq) expect(p).toMatch(/^(p23|p4|p5|g[1-6])\.[a-z]+\.[a-z0-9-]+$/);
  });
  it('単元の絵（icon）は登録済みで final（本番で赤い破線の枠を出さない）', () => {
    const bad = UNIT_INDEX.filter((u) => getIllust(u.icon)?.status !== 'final').map(
      (u) => `${u.id}（${u.icon}）`,
    );
    expect(bad).toEqual([]);
  });
});
