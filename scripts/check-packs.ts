/**
 * 教材パックの分離の機械検査（`npm run check:packs`。先に `npm run build` が必要）。
 * docs/expansion/architecture.md 6.2、design-review-1 #5。違反があれば一覧を出して exit 1。
 *
 * 検査すること:
 *  1. 各パックのチャンクから辿れる（import / 動的 import）ファイルが「コア」か「そのパック自身」
 *     （assets/packs/<packId>/ と、そのパックの files に入る共有データ assets/packs/_data/）だけ
 *  2. コアの入口から静的 import で辿れるファイルに、小学生のパックのファイルが無い
 *  3. コアのプリキャッシュ（sw.js の __MNW_FILES__）に、小学生のパックのファイル・音声（audio/<packId>/）が無い
 *  4. dist/packs.json が manifest から求めた分け方と一致し、bytes・hash が実際のファイルと合う
 *  5. packId の形式（英小文字・数字・ハイフン、'@' なし）。見本パックは本番の packs.json に出ない
 *     （VITE_MNW_SAMPLE_PACKS=1 のビルド、または --allow-samples のときだけ許す）
 *  6. ソース: src/packs/<packId>/ が他のパックを import しない（共有データ src/packs/_data/ は可）
 *
 * 使い方: tsx scripts/check-packs.ts [distDir] [--allow-samples]
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PACK_ID_RE,
  PACKS_FILE,
  SAMPLE_PACK_PREFIX,
  SHARED_DATA_DIR,
  SW_FILE,
  buildPackIndex,
  isCorePack,
  isSharedDataFile,
  listDistFiles,
  manifestClosure,
  partitionPacks,
  readManifest,
  type PackIndex,
} from './vite-plugin-precache.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export interface CheckResult {
  problems: string[];
  summary: string[];
}

function readSwFiles(distDir: string): string[] {
  const sw = readFileSync(path.join(distDir, SW_FILE), 'utf8');
  const m = /const __MNW_FILES__ = (\[.*\]);/.exec(sw);
  if (!m) throw new Error('sw.js に __MNW_FILES__ がありません');
  return JSON.parse(m[1]!) as string[];
}

/** ビルド結果（dist）の検査 */
export async function checkDist(
  distDir: string,
  options: { allowSamples?: boolean } = {},
): Promise<CheckResult> {
  const problems: string[] = [];
  const summary: string[] = [];
  const manifest = await readManifest(distDir);
  if (!manifest) {
    return {
      problems: [`${distDir}/.vite/manifest.json がありません（vite.config.ts の build.manifest）`],
      summary,
    };
  }
  if (!existsSync(path.join(distDir, PACKS_FILE))) {
    return { problems: [`${distDir}/${PACKS_FILE} がありません`], summary };
  }
  const index = JSON.parse(readFileSync(path.join(distDir, PACKS_FILE), 'utf8')) as PackIndex;
  const coreFiles = new Set(readSwFiles(distDir));
  const all = await listDistFiles(distDir);
  const allPaths = all.map((e) => e.path);
  const partition = partitionPacks(manifest, allPaths);

  // 5. packId
  for (const id of partition.chunks.keys()) {
    if (!PACK_ID_RE.test(id) || id.includes('@')) problems.push(`packId の形式が不正: ${id}`);
    if (id.startsWith('_') && !id.startsWith(SAMPLE_PACK_PREFIX))
      problems.push(`'_' で始まる packId は見本パックだけ: ${id}`);
  }
  if (!options.allowSamples) {
    for (const id of Object.keys(index)) {
      if (id.startsWith(SAMPLE_PACK_PREFIX))
        problems.push(`見本パック ${id} が packs.json にある（本番のビルドに入れない）`);
    }
    for (const p of allPaths) {
      if (p.startsWith(`audio/${SAMPLE_PACK_PREFIX}`) || p.includes(`/packs/${SAMPLE_PACK_PREFIX}`))
        problems.push(`見本パックのファイルが dist にある: ${p}`);
    }
  }

  // 1. パックから辿れるもの
  const separateIds = [...partition.chunks.keys()].filter((id) => !isCorePack(id));
  for (const [id, keys] of partition.chunks) {
    const reach = manifestClosure(manifest, keys).files;
    const own = new Set(index[id]?.files ?? []);
    for (const f of reach) {
      if (coreFiles.has(f)) continue;
      if (isCorePack(id)) {
        problems.push(`コア同梱のパック ${id} から、コアに無いファイル ${f} を読み込む`);
        continue;
      }
      if (f.startsWith(`assets/packs/${id}/`) && own.has(f)) continue;
      if (isSharedDataFile(f) && own.has(f)) continue;
      const other = separateIds.find((q) => q !== id && f.startsWith(`assets/packs/${q}/`));
      problems.push(
        other
          ? `パック ${id} が別のパック ${other} のチャンク ${f} を読み込む（パック同士で import しない）`
          : `パック ${id} が、コアにも自分にも属さないチャンク ${f} を読み込む（共有するコードは src/engines・src/core に置き、コアから使う）`,
      );
    }
  }

  // 2. コアの静的な読み込みにパックが混ざらない
  const entryKeys = Object.keys(manifest).filter((k) => manifest[k]?.isEntry);
  const staticCore = new Set<string>();
  const queue = [...entryKeys];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const k = queue.pop()!;
    if (seen.has(k)) continue;
    seen.add(k);
    const c = manifest[k];
    if (!c) continue;
    staticCore.add(c.file);
    for (const n of c.imports ?? []) queue.push(n);
  }
  for (const id of separateIds) {
    for (const f of index[id]?.files ?? []) {
      if (staticCore.has(f))
        problems.push(`コアが小学生のパック ${id} のファイル ${f} を静的に import している`);
    }
  }

  // 3. コアのプリキャッシュにパックのファイルが無い
  for (const f of coreFiles) {
    const owner = separateIds.find(
      (id) => f.startsWith(`assets/packs/${id}/`) || f.startsWith(`audio/${id}/`),
    );
    if (owner)
      problems.push(`コアのプリキャッシュに小学生のパック ${owner} のファイル ${f} がある`);
    if (Object.values(index).some((p) => p.files.includes(f)))
      problems.push(`コアのプリキャッシュと packs.json の両方に ${f} がある`);
  }
  if (!coreFiles.has(PACKS_FILE)) problems.push(`コアのプリキャッシュに ${PACKS_FILE} が無い`);

  // 4. packs.json の内容
  const expected = buildPackIndex(partition, all);
  const ids = new Set([...Object.keys(expected), ...Object.keys(index)]);
  for (const id of ids) {
    const want = expected[id];
    const got = index[id];
    if (!want || !got) {
      problems.push(
        `packs.json のパック ${id} が manifest と合わない（${want ? '無い' : '余分'}）`,
      );
      continue;
    }
    if (JSON.stringify(want.files) !== JSON.stringify(got.files))
      problems.push(`packs.json の ${id}.files が manifest から求めたものと違う`);
    if (want.bytes !== got.bytes) problems.push(`packs.json の ${id}.bytes が実際と違う`);
    if (want.hash !== got.hash) problems.push(`packs.json の ${id}.hash が実際の内容と違う`);
    summary.push(
      `${id}@${got.hash}: ${got.files.length} files, ${(got.bytes / 1024).toFixed(1)} KiB`,
    );
  }
  const corePacks = [...partition.chunks.keys()].filter(isCorePack);
  summary.push(`コア: ${coreFiles.size} files（同梱のパック: ${corePacks.join(', ') || 'なし'}）`);
  return { problems, summary };
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

/** 6. ソースの検査: パックが他のパックを import しない */
export function checkSources(packsDir: string = path.join(root, 'src/packs')): string[] {
  const problems: string[] = [];
  if (!existsSync(packsDir)) return problems;
  for (const dir of readdirSync(packsDir)) {
    const full = path.join(packsDir, dir);
    if (!statSync(full).isDirectory() || dir === SHARED_DATA_DIR) continue;
    if (!PACK_ID_RE.test(dir)) problems.push(`src/packs/${dir}: packId の形式が不正`);
    for (const file of walk(full)) {
      const text = readFileSync(file, 'utf8');
      const specs = [
        ...text.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]/g),
        ...text.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
        ...text.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm),
      ].map((m) => m[1]!);
      for (const spec of specs) {
        if (!spec.startsWith('.')) continue;
        const target = path.resolve(path.dirname(file), spec);
        const rel = path.relative(packsDir, target).replaceAll('\\', '/');
        if (rel.startsWith('..')) continue; // パックの外（engines・core など）
        const top = rel.split('/')[0]!;
        // src/packs 直下のファイル（loader.ts）は型の import だけを想定（値の import も実害はない: コア）
        if (!rel.includes('/')) continue;
        if (top !== dir && top !== SHARED_DATA_DIR) {
          problems.push(
            `${path.relative(root, file).replaceAll('\\', '/')}: 別のパック ${top} を import している（${spec}）`,
          );
        }
      }
    }
  }
  return problems;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const distDir = path.resolve(root, args.find((a) => !a.startsWith('--')) ?? 'dist');
  const allowSamples =
    args.includes('--allow-samples') || process.env.VITE_MNW_SAMPLE_PACKS === '1';
  if (!existsSync(path.join(distDir, 'index.html'))) {
    console.error(`${distDir} にビルド結果がありません。先に npm run build を実行してください。`);
    process.exit(1);
  }
  const { problems, summary } = await checkDist(distDir, { allowSamples });
  problems.push(...checkSources());
  if (problems.length > 0) {
    console.error(`教材パックの分離の違反 ${problems.length} 件:`);
    for (const p of problems) console.error(`- ${p}`);
    process.exit(1);
  }
  for (const s of summary) console.log(`  ${s}`);
  console.log('OK: 教材パックの分離に違反はありません');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
