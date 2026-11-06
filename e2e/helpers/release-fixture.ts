import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { appendFile, cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import { finalizeDist } from '../../scripts/vite-plugin-precache.ts';
import type { PackIndex } from '../../scripts/vite-plugin-precache.ts';
import {
  MAIN_KIND,
  TOP,
  audioGroupOf,
  audioPackIdOf,
  buildManifest,
  packPart,
  toJsonText,
} from '../../scripts/release-lib.ts';
import type {
  ManifestPart,
  PackedPart,
  UpdateManifest,
  ZipEntry,
} from '../../scripts/release-lib.ts';

/**
 * 更新の通し試験（e2e/update.spec.ts）の材料: 小さな偽のリリースを作る（設計 11.3 節）。
 *
 * - アプリ本体は本物のビルド（見本パック入り: VITE_MNW_SAMPLE_PACKS=1）を、アプリの版だけ変えて2回作る
 *   （古い版 2.1.0・新しい版 2.2.0）。版は import.meta.env.VITE_APP_VERSION を define で上書きして埋め込む
 *   （package.json の版には依存しない）。
 * - 小さくするため、おうち用の音声（public/audio の *.mp3 と num/）は入れない（public/ を写すときに外す）。
 *   見本パックの音声（audio/_sample-*）は残す。
 * - 新しい版は、見本パック _sample-a のチャンクを書き換えて（パックの版 hash が変わる = 取得済みなら
 *   「版が古い」になる）、音声の部品は変えない（変わらない zip を取り直さないことを見るため）。
 *   nextAudio は音声の部品も変える。
 * - zip・部品の印・版の情報は scripts/release-lib.ts の関数で作る（scripts/package-release.ts と同じ分け方）。
 *   中身の deploy/zorin/ は、この作業ツリーの本物の serve.py と mnwupdate/。
 */

const ROOT = path.resolve(import.meta.dirname, '../..');

export const OLD_VERSION = '2.1.0';
export const NEW_VERSION = '2.2.0';
export const RELEASE_DATE = '2026-11-20';
export const DEFAULT_NOTES = ['小学4年の算数に「がい数」を足しました'];
export const SAMPLE_PACK = '_sample-a';

export interface ReleasePart {
  packed: PackedPart;
  /** 中身（部品の印は含まない。名前は manabi-no-niwa/… で始まる） */
  entries: ZipEntry[];
}

export interface Release {
  version: string;
  /** finalizeDist 済みの dist */
  distDir: string;
  /** dist/packs.json（パックごとの版 hash） */
  packs: PackIndex;
  parts: Map<string, ReleasePart>;
  manifest: UpdateManifest;
  manifestBytes: Buffer;
  /** zip の名前 → 中身 */
  zips: Map<string, Buffer>;
  /** dist/version.json の version（Service Worker の版ID） */
  swVersion: string;
}

export interface Fixture {
  old: Release;
  next: Release;
  /** 音声の部品も変わる新しい版（使うときに作る） */
  nextAudio(): Promise<Release>;
  /** 新しい版の serve.py が壊れている版（--self-test が通らない。使うときに作る） */
  brokenServe(): Promise<Release>;
  cleanup(): Promise<void>;
}

// ---------------------------------------------------------------- ビルド

/** 見本パック入りのビルドを、アプリの版を version にして outDir に作る */
async function buildApp(version: string, outDir: string, publicDir: string): Promise<void> {
  await build({
    root: ROOT,
    configFile: path.join(ROOT, 'vite.config.ts'),
    logLevel: 'silent',
    publicDir,
    define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(version) },
    build: { outDir, emptyOutDir: true },
  });
  // プラグインが書いた dist/version.json の appVersion（package.json の版）を、この版に直す
  // （プリキャッシュの版ID は appVersion を含まないので、sw.js は変わらない）
  const file = path.join(outDir, 'version.json');
  const info = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
  info.appVersion = version;
  await writeFile(file, `${JSON.stringify(info, null, 2)}\n`, 'utf8');
}

/** public/ から、おうち用の音声を外した写しを作る（見本パックの音声 audio/_sample-* は残す） */
async function copySmallPublic(dest: string): Promise<void> {
  const audio = path.join(ROOT, 'public', 'audio');
  await cp(path.join(ROOT, 'public'), dest, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(audio, src);
      if (rel === '' || rel.startsWith('..')) return true; // audio の外、audio そのもの
      return rel.startsWith('_sample-');
    },
  });
}

async function readPackIndex(distDir: string): Promise<PackIndex> {
  return JSON.parse(await readFile(path.join(distDir, 'packs.json'), 'utf8')) as PackIndex;
}

/** base をコピーして mutate で書き換え、dist の整合（sw.js・packs.json・version.json）を作り直す */
async function deriveDist(
  base: string,
  parent: string,
  version: string,
  mutate: (dir: string, index: PackIndex) => Promise<void>,
): Promise<string> {
  const dir = await mkdtemp(path.join(parent, 'dist-'));
  await cp(base, dir, { recursive: true });
  const index = await readPackIndex(dir);
  await mutate(dir, index);
  await finalizeDist(dir, { appVersion: version });
  return dir;
}

// ---------------------------------------------------------------- リリース（zip・部品の印・版の情報）

function walk(dir: string, base: string, out: [string, string][] = []): [string, string][] {
  for (const name of readdirSync(dir)) {
    if (name === '__pycache__' || name === '.DS_Store' || name.endsWith('.pyc')) continue;
    const p = path.join(dir, name);
    const rel = `${base}/${name}`;
    if (statSync(p).isDirectory()) walk(p, rel, out);
    else out.push([p, rel]);
  }
  return out;
}

/** dist から、リリース（zip 4つまでと版の情報）を作る。分け方は scripts/package-release.ts と同じ */
export async function buildRelease(
  distDir: string,
  version: string,
  options: {
    notes?: readonly string[];
    minVersion?: string;
    /** 中身のファイルを zip に入れる前に書き換える（壊れた版を作るため）。name は manabi-no-niwa/… で始まる */
    tamper?: (name: string, data: Buffer) => Buffer;
  } = {},
): Promise<Release> {
  const packs = await readPackIndex(distDir);
  const packIds = Object.keys(packs);
  const files: [string, string][] = [
    ...walk(distDir, `${TOP}/dist`),
    ...walk(path.join(ROOT, 'deploy/zorin'), `${TOP}/deploy/zorin`),
    ...walk(path.join(ROOT, 'licenses'), `${TOP}/licenses`),
    [path.join(ROOT, 'README.md'), `${TOP}/README.md`],
    [path.join(ROOT, 'LICENSE'), `${TOP}/LICENSE`],
    [path.join(ROOT, 'DESINGN.md'), `${TOP}/DESINGN.md`],
  ];
  const checklist = path.join(ROOT, 'docs/device-checklist.md');
  if (existsSync(checklist)) files.push([checklist, `${TOP}/docs/device-checklist.md`]);

  const groups = new Map<string, [string, string][]>([[MAIN_KIND, []]]);
  for (const f of files) {
    const g = audioGroupOf(f[1], packIds) ?? MAIN_KIND;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(f);
  }

  const parts = new Map<string, ReleasePart>();
  const zips = new Map<string, Buffer>();
  for (const [kind, list] of groups) {
    const entries: ZipEntry[] = list.map(([src, name]) => {
      const data = readFileSync(src);
      return { name, data: options.tamper ? options.tamper(name, data) : data };
    });
    const roots = [
      ...new Set(
        list.flatMap(([, name]) => {
          const id = audioPackIdOf(name, packIds);
          return id === null ? [] : [`dist/audio/${id}`];
        }),
      ),
    ].sort();
    const packed = packPart({ version, kind, entries, roots });
    parts.set(kind, { packed, entries });
    zips.set(packed.name, packed.zip);
  }

  const manifest = buildManifest({
    version,
    date: RELEASE_DATE,
    minVersion: options.minVersion ?? OLD_VERSION,
    notes: options.notes ?? DEFAULT_NOTES,
    parts: [...parts.values()].map((p) => toManifestPart(p.packed)),
  });
  const versionJson = JSON.parse(await readFile(path.join(distDir, 'version.json'), 'utf8')) as {
    version: string;
  };
  return {
    version,
    distDir,
    packs,
    parts,
    manifest,
    manifestBytes: Buffer.from(toJsonText(manifest), 'utf8'),
    zips,
    swVersion: versionJson.version,
  };
}

function toManifestPart(p: PackedPart): ManifestPart {
  return {
    kind: p.kind,
    name: p.name,
    bytes: p.bytes,
    sha256: p.sha256,
    contentId: p.contentId,
    files: p.files,
    unpackedBytes: p.unpackedBytes,
  };
}

/**
 * 版の情報の「大きさ」だけを申告し直す（空き容量が足りないときの案内を見るため）。
 * zip の中身は変えない: serve.py は取得の前に見積もりで空きを確かめるので、zip は取得されない。
 */
export function manifestWithClaims(
  release: Release,
  claims: Record<string, { bytes: number; unpackedBytes: number }>,
): Buffer {
  const manifest = buildManifest({
    version: release.version,
    date: RELEASE_DATE,
    minVersion: release.manifest.minVersion,
    notes: release.manifest.notes,
    parts: release.manifest.parts.map((p) => ({ ...p, ...claims[p.kind] })),
  });
  return Buffer.from(toJsonText(manifest), 'utf8');
}

// ---------------------------------------------------------------- 導入の置き場に書く

/** 導入された置き場（<DATA>/manabi-no-niwa/app）に、リリースの全部品の中身と部品の印を書く（install.sh の結果と同じ形） */
export function writeInstalledApp(appDir: string, release: Release): void {
  for (const [kind, part] of release.parts) {
    for (const e of part.entries) {
      const file = path.join(appDir, ...e.name.slice(TOP.length + 1).split('/'));
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, e.data);
    }
    const marker = path.join(appDir, 'parts', `${kind}.json`);
    mkdirSync(path.dirname(marker), { recursive: true });
    writeFileSync(marker, toJsonText(part.packed.marker));
  }
}

// ---------------------------------------------------------------- 材料一式

/** 古い版・新しい版を作る（ビルド 2 回。ワーカーごとに 1 回でよい）。音声も変わる版は nextAudio() で作る */
export async function createFixture(): Promise<Fixture> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mnwupd-fixture-'));
  try {
    const publicDir = path.join(root, 'public');
    await copySmallPublic(publicDir);
    const buildOld = path.join(root, 'build-old');
    const buildNew = path.join(root, 'build-new');
    // 同じ設定で並べて作る（環境変数は 1 つなので、見本パック入りにするのは作る前に決めておく）
    const prev = process.env.VITE_MNW_SAMPLE_PACKS;
    process.env.VITE_MNW_SAMPLE_PACKS = '1';
    try {
      await Promise.all([
        buildApp(OLD_VERSION, buildOld, publicDir),
        buildApp(NEW_VERSION, buildNew, publicDir),
      ]);
    } finally {
      if (prev === undefined) delete process.env.VITE_MNW_SAMPLE_PACKS;
      else process.env.VITE_MNW_SAMPLE_PACKS = prev;
    }

    // 新しい版: 見本パック _sample-a のチャンクを書き換える（パックの版 hash が変わる）
    const changePack = async (dir: string, index: PackIndex): Promise<void> => {
      const chunk = index[SAMPLE_PACK]!.files.find((f) =>
        f.startsWith(`assets/packs/${SAMPLE_PACK}/`),
      );
      if (!chunk) throw new Error(`${SAMPLE_PACK} のチャンクが見つかりません`);
      await appendFile(path.join(dir, chunk), '\n/* mnw-e2e-pack-v2 */\n');
    };
    const nextDir = await deriveDist(buildNew, root, NEW_VERSION, changePack);
    const [old, next] = await Promise.all([
      buildRelease(buildOld, OLD_VERSION),
      buildRelease(nextDir, NEW_VERSION),
    ]);
    let nextAudio: Promise<Release> | null = null;
    let brokenServe: Promise<Release> | null = null;
    return {
      old,
      next,
      nextAudio() {
        nextAudio ??= (async () => {
          const dir = await deriveDist(buildNew, root, NEW_VERSION, async (d, index) => {
            await changePack(d, index);
            await appendFile(
              path.join(d, 'audio', SAMPLE_PACK, 'hello.mp3'),
              Buffer.from('mnw-e2e-audio-v2'),
            );
          });
          return buildRelease(dir, NEW_VERSION);
        })();
        return nextAudio;
      },
      brokenServe() {
        brokenServe ??= buildRelease(nextDir, NEW_VERSION, {
          // 新しい serve.py が Python として読めない: 取得・展開・中身の確かめは通るが、自己検査で見つかる
          tamper: (name, data) =>
            name === `${TOP}/deploy/zorin/serve.py`
              ? Buffer.from('def main(:\n    broken\n')
              : data,
        });
        return brokenServe;
      },
      cleanup: () => rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }),
    };
  } catch (e) {
    await rm(root, { recursive: true, force: true }).catch(() => undefined);
    throw e;
  }
}
