/**
 * 単元の索引 src/curriculum/unit-index.json を、各パック（src/packs/<packId>/index.ts）から作る。
 * 実行: npm run build:unit-index（tsx）
 */
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildIndex } from '../src/curriculum/unitIndex';
import type { PackContent } from '../src/curriculum/types';

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
const index = buildIndex(packs);
const out = join(import.meta.dirname, '..', 'src', 'curriculum', 'unit-index.json');
writeFileSync(out, JSON.stringify(index, null, 2) + '\n');
console.log(`unit-index.json: ${index.length} 単元（${packs.length} パック）`);
