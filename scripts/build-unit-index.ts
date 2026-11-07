/**
 * 単元の索引 src/curriculum/unit-index.json を、各パック（src/packs/<packId>/index.ts）から作る。
 * 並びは、段階・教科ごとに単元対応表（docs/expansion/curriculum-matrix.md）の行の順で、前提を先にする
 * （src/curriculum/unitOrder.ts。FX07）。
 * 実行: npm run build:unit-index（tsx）
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildIndex } from '../src/curriculum/unitIndex';
import type { PackContent } from '../src/curriculum/types';
import { parseMatrixOrder } from '../src/curriculum/unitOrder';

const root = join(import.meta.dirname, '..', 'src', 'packs');
const packs: PackContent[] = [];
for (const name of readdirSync(root, { withFileTypes: true })) {
  if (!name.isDirectory() || name.name.startsWith('_')) continue;
  // 作業中で index.ts がまだ無いパックは飛ばす
  if (!existsSync(join(root, name.name, 'index.ts'))) {
    console.warn(`skip: src/packs/${name.name}（index.ts が無い）`);
    continue;
  }
  const mod = (await import(pathToFileURL(join(root, name.name, 'index.ts')).href)) as {
    default: PackContent;
  };
  if (mod.default.packId !== name.name)
    throw new Error(`packId ${mod.default.packId} がディレクトリ名 ${name.name} と違う`);
  packs.push(mod.default);
}
const matrix = readFileSync(
  join(import.meta.dirname, '..', 'docs', 'expansion', 'curriculum-matrix.md'),
  'utf8',
);
const index = buildIndex(packs, parseMatrixOrder(matrix));
const out = join(import.meta.dirname, '..', 'src', 'curriculum', 'unit-index.json');
writeFileSync(out, JSON.stringify(index, null, 2) + '\n');
console.log(`unit-index.json: ${index.length} 単元（${packs.length} パック）`);
