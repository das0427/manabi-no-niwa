import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformWithOxc } from 'vite';
import type { Plugin, ResolvedConfig } from 'vite';

/**
 * プリキャッシュと Service Worker の生成（docs/architecture.md 7章、docs/expansion/architecture.md 6章）。
 *
 * ビルド後に dist/ のファイル（sw.js 自身・.map・version.json・隠しファイルを除く）を
 * 「コア」と「小学生の教材パック」に分け、
 *  - dist/packs.json: { [packId]: { files, bytes, hash } }（パックごとの取得単位。コアに含める）
 *  - dist/sw.js: src/sw/sw.ts を変換し、先頭にコアの版IDとコアのファイル一覧を埋め込んだもの
 *  - dist/version.json
 * を出力する。版ID はコアのファイル（packs.json を含む）だけから作り、パックのファイルの内容は含めない。
 * あわせて本番ビルドの index.html に CSP を入れる。
 *
 * パックの分け方（R#5）:
 *  - Vite の manifest（dist/.vite/manifest.json）の import のつながりから、各パックの入口
 *    `src/packs/<packId>/index.ts` から辿れて、コアの入口（index.html）から辿れないファイルをパックに入れる。
 *  - `public/audio/<packId>/**`（dist の audio/<packId>/）はそのパックに入れる。
 *  - 幼児のパック（CORE_PACK_IDS）はコアに同梱する（R#20）。
 *  - 共有データ（src/packs/_data/**）は 1 ファイル 1 チャンク（assets/packs/_data/…）。コアから辿れればコア、
 *    そうでなければ、それを使うすべてのパックの files に入る（各パックのキャッシュに重複して入る）。
 */

// ---------------------------------------------------------------- 教材パック（定数と分割の規則）

/** 教材パックのソースの置き場所（src からの相対） */
export const PACKS_DIR = 'src/packs';
/** パックの一覧（dist からの相対）。コアに含める */
export const PACKS_FILE = 'packs.json';
/** Vite の build manifest（dist からの相対。build.manifest: true） */
export const MANIFEST_FILE = '.vite/manifest.json';
/** コアに同梱するパック（幼児: R#20）と、コア扱いの見本パック */
export const CORE_PACK_IDS: readonly string[] = ['p23', 'p4', 'p5', '_sample-core'];
/** 共有データのディレクトリ名（src/packs/_data） */
export const SHARED_DATA_DIR = '_data';
/** 見本パック（VITE_MNW_SAMPLE_PACKS=1 のときだけビルドに入る）の接頭辞 */
export const SAMPLE_PACK_PREFIX = '_sample-';
/** packId の形式。英小文字・数字・ハイフン（'@' と '/' を含まない）。先頭の '_' は見本パックだけ */
export const PACK_ID_RE = /^_?[a-z0-9][a-z0-9-]*$/;

export function isCorePack(packId: string): boolean {
  return CORE_PACK_IDS.includes(packId);
}

function toPosix(p: string): string {
  return p.replaceAll('\\', '/');
}

/**
 * codeSplitting（旧 manualChunks）の名前の関数。モジュール ID から、パックのチャンク名を返す（対象外は null）。
 *  - src/packs/<packId>/**            → packs/<packId>/<packId>   （出力: assets/packs/<packId>/<packId>-<hash>.js）
 *  - src/packs/_data/<path>.<ext>     → packs/_data/<path>         （1 ファイル 1 チャンク）
 *  - src/packs/loader.ts など直下のファイル → null（コア）
 */
export function packChunkName(moduleId: string): string | null {
  if (moduleId.startsWith('\0')) return null;
  const id = toPosix(moduleId.split('?')[0] ?? moduleId);
  const m = /\/src\/packs\/([^/]+)\/(.+)$/.exec(id);
  if (!m) return null;
  const dir = m[1]!;
  const rest = m[2]!;
  if (dir === SHARED_DATA_DIR) return `packs/${SHARED_DATA_DIR}/${rest.replace(/\.[^./]+$/, '')}`;
  return `packs/${dir}/${dir}`;
}

export interface ManifestChunk {
  file: string;
  src?: string;
  name?: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
  css?: string[];
  assets?: string[];
}
export type ViteManifest = Record<string, ManifestChunk>;

export interface PackIndexEntry {
  /** dist からの相対パス（パス順） */
  files: string[];
  bytes: number;
  /** パックの内容のハッシュ（16桁の16進）。packHash() */
  hash: string;
}
export type PackIndex = Record<string, PackIndexEntry>;

/**
 * 出力ファイルがパック自身のチャンクなら packId を返す（assets/packs/<packId>/…。共有データは除く）。
 * パックの入口のモジュールは codeSplitting のグループに入るため、manifest のキーはソースのパスではなく
 * チャンク名（例 `_g1-math-<hash>.js`）になる。そのため出力ファイルの場所で判定する。
 */
export function packIdOfFile(file: string): string | null {
  const m = /^assets\/packs\/([^/]+)\//.exec(toPosix(file));
  if (!m || m[1] === SHARED_DATA_DIR) return null;
  return m[1]!;
}

/** 共有データのチャンクか（assets/packs/_data/…） */
export function isSharedDataFile(file: string): boolean {
  return toPosix(file).startsWith(`assets/packs/${SHARED_DATA_DIR}/`);
}

/** manifest の、パックごとのチャンクのキー（コア同梱を含む） */
export function packChunkKeys(manifest: ViteManifest): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [key, chunk] of Object.entries(manifest)) {
    const id = packIdOfFile(chunk.file);
    if (!id || !chunk.file.endsWith('.js')) continue;
    out.set(id, [...(out.get(id) ?? []), key]);
  }
  return out;
}

function chunkFiles(c: ManifestChunk): string[] {
  return [c.file, ...(c.css ?? []), ...(c.assets ?? [])];
}

/** start から imports / dynamicImports を辿る（stop が true のキーには入らない） */
export function manifestClosure(
  manifest: ViteManifest,
  start: readonly string[],
  stop: (key: string) => boolean = () => false,
): { keys: Set<string>; files: Set<string> } {
  const keys = new Set<string>();
  const files = new Set<string>();
  const queue = [...start];
  while (queue.length > 0) {
    const key = queue.pop()!;
    if (keys.has(key)) continue;
    const chunk = manifest[key];
    if (!chunk) continue;
    keys.add(key);
    for (const f of chunkFiles(chunk)) files.add(f);
    for (const next of [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])]) {
      if (!keys.has(next) && !stop(next)) queue.push(next);
    }
  }
  return { keys, files };
}

export interface PackPartition {
  /** 分離するパック（小学生）の packId → ファイル（dist からの相対） */
  packs: Map<string, Set<string>>;
  /** コアの入口から辿れるファイル（分離するパックのチャンクには入らない） */
  coreReach: Set<string>;
  /** manifest にあるパックのチャンクのキー（コア同梱を含む） */
  chunks: Map<string, string[]>;
}

/**
 * manifest と dist のファイル一覧から、分離するパックのファイルを決める。
 * コアの入口から辿れるものはコア。パックのチャンクから辿れて、コアから辿れないものはそのパック
 * （共有データは、それを使うすべてのパック）。audio/<packId>/** はそのパック。
 */
export function partitionPacks(
  manifest: ViteManifest,
  distPaths: readonly string[],
): PackPartition {
  const chunks = packChunkKeys(manifest);
  const separateKeys = new Set(
    [...chunks].filter(([id]) => !isCorePack(id)).flatMap(([, keys]) => keys),
  );
  const coreStart = Object.keys(manifest).filter((k) => manifest[k]?.isEntry);
  const coreReach = manifestClosure(manifest, coreStart, (k) => separateKeys.has(k)).files;

  const packs = new Map<string, Set<string>>();
  for (const [id, keys] of chunks) {
    if (isCorePack(id)) continue;
    const own = new Set(keys);
    const reach = manifestClosure(manifest, keys, (k) => !own.has(k) && separateKeys.has(k));
    const files = new Set([...reach.files].filter((f) => !coreReach.has(f)));
    for (const p of distPaths) if (p.startsWith(`audio/${id}/`)) files.add(p);
    packs.set(id, files);
  }
  return { packs, coreReach, chunks };
}

/** パックのハッシュ: パス順の「パス \0 内容の sha256」の並びの sha256（16桁）。画面側の検証と同じ計算 */
export function packHash(files: readonly { path: string; hash: string }[]): string {
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const text = sorted.map((f) => `${f.path}\0${f.hash}\n`).join('');
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/** パックごとの files / bytes / hash を作る */
export function buildPackIndex(
  partition: PackPartition,
  entries: readonly PrecacheEntry[],
): PackIndex {
  const byPath = new Map(entries.map((e) => [e.path, e]));
  const index: PackIndex = {};
  for (const id of [...partition.packs.keys()].sort()) {
    const list = [...(partition.packs.get(id) ?? [])]
      .map((p) => byPath.get(p))
      .filter((e): e is PrecacheEntry => e !== undefined)
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    index[id] = {
      files: list.map((e) => e.path),
      bytes: list.reduce((s, e) => s + e.size, 0),
      hash: packHash(list),
    };
  }
  return index;
}

export interface PrecacheEntry {
  /** dist からの相対パス（"/" 区切り） */
  path: string;
  size: number;
  /** 内容の sha256（16進） */
  hash: string;
}

export interface VersionInfo {
  version: string;
  fileCount: number;
  totalBytes: number;
}

export const SW_FILE = 'sw.js';
export const VERSION_FILE = 'version.json';
const SW_SOURCE = fileURLToPath(new URL('../src/sw/sw.ts', import.meta.url));

/** プリキャッシュに含めない（sw.js 自身、ソースマップ、版情報、隠しファイル・隠しディレクトリ（.vite/ の manifest など）） */
export function isExcluded(relPath: string): boolean {
  return (
    relPath === SW_FILE ||
    relPath === VERSION_FILE ||
    relPath.endsWith('.map') ||
    relPath.split('/').some((seg) => seg.startsWith('.'))
  );
}

async function walk(dir: string, rel: string, out: PrecacheEntry[]): Promise<void> {
  const items = await readdir(path.join(dir, rel), { withFileTypes: true });
  for (const item of items) {
    const relPath = rel === '' ? item.name : `${rel}/${item.name}`;
    if (item.isDirectory()) {
      await walk(dir, relPath, out);
    } else if (item.isFile() && !isExcluded(relPath)) {
      const buf = await readFile(path.join(dir, relPath));
      out.push({
        path: relPath,
        size: (await stat(path.join(dir, relPath))).size,
        hash: createHash('sha256').update(buf).digest('hex'),
      });
    }
  }
}

/** dist のプリキャッシュ対象を、パス順で返す */
export async function listDistFiles(distDir: string): Promise<PrecacheEntry[]> {
  const out: PrecacheEntry[] = [];
  await walk(distDir, '', out);
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** 版ID: ファイル一覧（パスと内容ハッシュ）と SW ソースの変換結果から 12 桁の16進を作る */
export function computeVersion(entries: readonly PrecacheEntry[], swTemplate: string): string {
  const h = createHash('sha256');
  h.update(createHash('sha256').update(swTemplate).digest('hex'));
  for (const e of [...entries].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    h.update(`\n${e.path}\0${e.hash}`);
  }
  return h.digest('hex').slice(0, 12);
}

/** 変換済みの SW 本体の先頭に、版IDと一覧を付ける */
export function renderServiceWorker(
  swTemplate: string,
  version: string,
  files: readonly string[],
): string {
  return (
    `/* manabi-no-niwa service worker / version ${version} (generated) */\n` +
    `const __MNW_VERSION__ = ${JSON.stringify(version)};\n` +
    `const __MNW_FILES__ = ${JSON.stringify(files)};\n` +
    swTemplate
  );
}

/** src/sw/sw.ts を、単独で動く 1 ファイルの JS にする */
export async function transpileServiceWorker(sourcePath: string = SW_SOURCE): Promise<string> {
  const source = await readFile(sourcePath, 'utf8');
  const result = await transformWithOxc(source, sourcePath, { lang: 'ts', target: 'es2022' });
  // 型の import だけでモジュール扱いにしているため、変換結果に空の `export {}` が残る。classic script では不要
  const code = result.code.replace(/^export\s*\{\s*\};?\s*$/gm, '');
  if (/^\s*(import|export)\b/m.test(code)) {
    throw new Error(
      'sw.ts は import / export を含められません（単独の 1 ファイルとして動かすため）',
    );
  }
  return code;
}

export interface FinalizeOptions {
  /** SW のソース（テスト用に差し替え可能） */
  swSourcePath?: string;
}

/** dist の manifest を読む（無ければ null。Vite 以外で作った dist やテスト用の dist） */
export async function readManifest(distDir: string): Promise<ViteManifest | null> {
  const file = path.join(distDir, MANIFEST_FILE);
  if (!existsSync(file)) return null;
  return JSON.parse(await readFile(file, 'utf8')) as ViteManifest;
}

/**
 * ビルドに入っていない見本パックの音声（dist/audio/_sample-*）を消す。
 * public/ は常に dist にコピーされるため、見本を入れないビルドでは本番の dist に残さない。
 */
async function removeUnbuiltSampleAudio(
  distDir: string,
  built: ReadonlySet<string>,
): Promise<void> {
  const audioDir = path.join(distDir, 'audio');
  if (!existsSync(audioDir)) return;
  for (const item of await readdir(audioDir, { withFileTypes: true })) {
    if (item.isDirectory() && item.name.startsWith(SAMPLE_PACK_PREFIX) && !built.has(item.name)) {
      await rm(path.join(audioDir, item.name), { recursive: true, force: true });
    }
  }
}

/**
 * dist/ を走査して dist/packs.json・dist/sw.js・dist/version.json を（再）生成する。
 * ビルド後のほか、テストで dist のコピーを加工したあとの再生成にも使う。
 * manifest（.vite/manifest.json）が無い dist では、パックの分離をせず packs.json も作らない（従来どおり）。
 */
export async function finalizeDist(
  distDir: string,
  options: FinalizeOptions = {},
): Promise<VersionInfo> {
  if (!existsSync(distDir)) throw new Error(`dist が見つかりません: ${distDir}`);
  const swTemplate = await transpileServiceWorker(options.swSourcePath);
  const manifest = await readManifest(distDir);
  let packFiles = new Set<string>();
  if (manifest) {
    const builtPacks = new Set(packChunkKeys(manifest).keys());
    await removeUnbuiltSampleAudio(distDir, builtPacks);
    await rm(path.join(distDir, PACKS_FILE), { force: true });
    const all = await listDistFiles(distDir);
    const partition = partitionPacks(
      manifest,
      all.map((e) => e.path),
    );
    const index = buildPackIndex(partition, all);
    packFiles = new Set(Object.values(index).flatMap((p) => p.files));
    await writeFile(path.join(distDir, PACKS_FILE), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  }
  const entries = (await listDistFiles(distDir)).filter((e) => !packFiles.has(e.path));
  if (entries.length === 0) throw new Error('プリキャッシュ対象のファイルがありません');
  const version = computeVersion(entries, swTemplate);
  const totalBytes = entries.reduce((sum, e) => sum + e.size, 0);
  await writeFile(
    path.join(distDir, SW_FILE),
    renderServiceWorker(
      swTemplate,
      version,
      entries.map((e) => e.path),
    ),
    'utf8',
  );
  const info: VersionInfo = { version, fileCount: entries.length, totalBytes };
  await writeFile(path.join(distDir, VERSION_FILE), `${JSON.stringify(info, null, 2)}\n`, 'utf8');
  return info;
}

/** 本番ビルドの CSP（docs/architecture.md 11章）。style-src の unsafe-inline は React の style 属性のため */
export const CSP =
  "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; " +
  "media-src 'self' blob: data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; " +
  "font-src 'self'; object-src 'none'; base-uri 'self'";

function cspPlugin(): Plugin {
  return {
    name: 'mnw-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler() {
        return [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  };
}

function swPlugin(): Plugin {
  let config: ResolvedConfig | null = null;
  let written = false;
  return {
    name: 'mnw-precache',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    buildStart() {
      written = false;
    },
    writeBundle() {
      written = true;
    },
    closeBundle: {
      order: 'post',
      sequential: true,
      async handler() {
        if (!config || !written) return;
        const distDir = path.resolve(config.root, config.build.outDir);
        const info = await finalizeDist(distDir);
        config.logger.info(
          `[mnw-precache] version ${info.version}: ${info.fileCount} files, ${(info.totalBytes / 1024).toFixed(1)} KiB`,
        );
        const manifest = await readManifest(distDir);
        if (manifest) {
          const index = JSON.parse(
            await readFile(path.join(distDir, PACKS_FILE), 'utf8'),
          ) as PackIndex;
          for (const [id, p] of Object.entries(index)) {
            config.logger.info(
              `[mnw-precache] pack ${id}@${p.hash}: ${p.files.length} files, ${(p.bytes / 1024).toFixed(1)} KiB`,
            );
          }
        }
      },
    },
  };
}

export function precachePlugin(): Plugin[] {
  return [cspPlugin(), swPlugin()];
}
