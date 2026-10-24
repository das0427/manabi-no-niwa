import { existsSync, rmSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import { finalizeDist } from '../../scripts/vite-plugin-precache.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
export const DIST = path.join(ROOT, 'dist');

let harnessPromise: Promise<string> | null = null;

/** src/core/offline を IIFE にまとめたハーネスを作る（ワーカーごとに 1 回） */
export function buildHarness(): Promise<string> {
  harnessPromise ??= (async () => {
    const outDir = await mkdtemp(path.join(os.tmpdir(), 'mnw-harness-'));
    await build({
      configFile: false,
      root: ROOT,
      logLevel: 'silent',
      publicDir: false,
      define: { 'process.env.NODE_ENV': '"production"' },
      build: {
        outDir,
        emptyOutDir: true,
        minify: false,
        target: 'es2022',
        lib: {
          entry: path.join(ROOT, 'e2e/helpers/offline-harness-entry.ts'),
          formats: ['iife'],
          name: 'MnwHarness',
          fileName: () => 'harness.js',
        },
      },
    });
    process.once('exit', () => rmSync(outDir, { recursive: true, force: true }));
    return path.join(outDir, 'harness.js');
  })();
  return harnessPromise;
}

export interface PrepareOptions {
  /** 追加するファイル（dist からの相対パス → 内容） */
  addFiles?: Record<string, string>;
  /** sw.js を作る前に削除するファイル（この版には存在しない部品の再現用） */
  removeFiles?: string[];
  /** sw.js を作った後に削除するファイル（一覧にあるのに取得できない = install 失敗の再現用） */
  breakFiles?: string[];
  /** index.html に入れる印（版ID を変えるために使う） */
  tag?: string;
  /** window.__mnwOffline（src/core/offline）を差し込む。既定 true */
  harness?: boolean;
}

export interface PreparedDist {
  dir: string;
  version: string;
  fileCount: number;
  cleanup(): Promise<void>;
}

/**
 * ビルド済みの dist をコピーして加工し、sw.js / version.json を作り直す（版を変えたビルドの再現）。
 * dist がまだ無いときはエラー（npm run build が先に必要）。
 */
export async function prepareDist(options: PrepareOptions = {}): Promise<PreparedDist> {
  if (!existsSync(path.join(DIST, 'index.html'))) {
    throw new Error('dist がありません。先に npm run build を実行してください。');
  }
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mnw-dist-'));
  await cp(DIST, dir, { recursive: true });

  let html = await readFile(path.join(dir, 'index.html'), 'utf8');
  if (options.harness !== false) {
    const harnessSrc = await buildHarness();
    await mkdir(path.join(dir, '__test'), { recursive: true });
    await cp(harnessSrc, path.join(dir, '__test/harness.js'));
    html = html.replace('</head>', '<script src="./__test/harness.js"></script></head>');
  }
  if (options.tag) html = html.replace('</body>', `<!-- ${options.tag} --></body>`);
  await writeFile(path.join(dir, 'index.html'), html, 'utf8');

  for (const [rel, content] of Object.entries(options.addFiles ?? {})) {
    await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
    await writeFile(path.join(dir, rel), content, 'utf8');
  }
  for (const rel of options.removeFiles ?? []) await rm(path.join(dir, rel), { force: true });

  const info = await finalizeDist(dir);
  for (const rel of options.breakFiles ?? []) await rm(path.join(dir, rel), { force: true });

  return {
    dir,
    version: info.version,
    fileCount: info.fileCount,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}
