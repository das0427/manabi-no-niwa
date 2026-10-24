import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformWithOxc } from 'vite';
import type { Plugin, ResolvedConfig } from 'vite';

/**
 * プリキャッシュと Service Worker の生成（docs/architecture.md 7章）。
 *
 * ビルド後に dist/ の全ファイル（sw.js 自身・.map・version.json を除く）の一覧と内容ハッシュから
 * 版ID を作り、src/sw/sw.ts を変換した dist/sw.js（先頭に版IDと一覧を埋め込む）と
 * dist/version.json を出力する。あわせて本番ビルドの index.html に CSP を入れる。
 */

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

/** プリキャッシュに含めない（sw.js 自身、ソースマップ、版情報、隠しファイル） */
export function isExcluded(relPath: string): boolean {
  const base = relPath.split('/').pop() ?? relPath;
  return (
    relPath === SW_FILE ||
    relPath === VERSION_FILE ||
    relPath.endsWith('.map') ||
    base.startsWith('.')
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

/**
 * dist/ を走査して dist/sw.js と dist/version.json を（再）生成する。
 * ビルド後のほか、テストで dist のコピーを加工したあとの再生成にも使う。
 */
export async function finalizeDist(
  distDir: string,
  options: FinalizeOptions = {},
): Promise<VersionInfo> {
  if (!existsSync(distDir)) throw new Error(`dist が見つかりません: ${distDir}`);
  const swTemplate = await transpileServiceWorker(options.swSourcePath);
  const entries = await listDistFiles(distDir);
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
      },
    },
  };
}

export function precachePlugin(): Plugin[] {
  return [cspPlugin(), swPlugin()];
}
