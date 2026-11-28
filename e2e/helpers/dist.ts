import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, rmSync, statSync, unlinkSync } from 'node:fs';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import { finalizeDist, isExcluded, isInsideDir } from '../../scripts/vite-plugin-precache.ts';
import type { PrecacheEntry } from '../../scripts/vite-plugin-precache.ts';

/**
 * E2E 用の dist の写し（音声は写さずにつなぐ）。
 *
 * 音声入りの dist は約12万ファイルあり、まるごと写すと1回に約131〜324秒かかる（2.1.0 の記録と 2026-11-28 の測定）。
 * そこで音声のフォルダ（audio/<名前>/）は写さず、元の実体へジャンクション（Linux ではシンボリックリンク）でつなぐ。
 * ほかのファイル（約3千）は今までどおり写す。つないだ音声の size と hash は、一時フォルダ（mnw-e2e-hash-cache）に覚えて
 * ワーカーと実行をまたいで使い、finalizeDist に渡して読み直さない。
 *
 * 気をつけること: つないだフォルダの中を消す・書くと、つなぎ先（元の dist・本体の音声）が変わってしまう。
 * 写しの中のパスを変えるときは、assertOutsideLinks を通す。
 */

const ROOT = path.resolve(import.meta.dirname, '../..');
export const DIST = path.join(ROOT, 'dist');

/**
 * 準備だけの時間の上限（test.beforeAll 用）。各テストの制限ではない。
 * 実測（1ワーカー）: 音声の hash は初回 28.9 秒・全件の読み直しの最悪 138 秒、写しは 3〜4 秒、
 * 見本パック入りの組み立ては 8.2 秒。最悪の読み直しに写しを足して余裕を見て 180 秒にした。
 */
export const PREPARE_TIMEOUT = 180_000;

const AUDIO_DIR = 'audio';
/** 見本パックの音声はテストが中身を消す・変えるので、写す（つながない） */
const SAMPLE_PREFIX = '_sample-';
/** 写しの一時フォルダの接頭辞。強制終了の残りを探すときに使う */
const LINKED_PREFIX = 'mnw-e2e-linked-';
/** この時間（ミリ秒）より古い残りだけを片づける */
const STALE_MS = 12 * 60 * 60 * 1000;

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

/**
 * 全件の事前保存の待ちの見積もり（1ファイルあたりのミリ秒）。
 * 待つのは写しの時間ではなく、アプリ（Service Worker）が実データで行う事前保存の時間。
 * 実測（2026-11-28・1ワーカー・この開発機）: 音声入りのコア 10,577 ファイルの事前保存に Chromium 40.4 秒・Firefox 57.7 秒。
 * Firefox の値は SW の寿命（dom.serviceWorkers.idle_extended_timeout）を延ばして測ったもの。既定の設定（30 秒）では、
 * install の途中の SW が約60秒で止められ、終わらないことがある（テストでは延ばさない。依頼者の判断（2026-11-28）で対応しない）。
 * 実際に効くのは Chromium の 40.4 秒 ÷ 10,577 ファイル ≒ 3.8 ミリ秒/ファイルで、約2.6倍の余裕を見て 10 ミリ秒にした。音声を置かないビルド（約2,300ファイル）では floor のまま。
 */
export const PRECACHE_MS_PER_FILE = 10;

/** 全件の事前保存を待つ時間（ミリ秒）。小さな dist では floor（今までの待ち）のまま */
export function precacheWait(fileCount: number, floor: number): number {
  return Math.max(floor, fileCount * PRECACHE_MS_PER_FILE);
}

/** 全件の事前保存を times 回行うテストの制限に足す時間（ミリ秒）。小さな dist では 0 */
export function precacheExtra(fileCount: number, times: number, floor: number): number {
  return times * (precacheWait(fileCount, floor) - floor);
}

/** 写さずにつなぐ音声のフォルダ（<root>/audio/<名前>/）の名前を、名前順で返す。見本パック（_sample-*）は入れない */
export function linkableAudioDirs(root: string): string[] {
  const audio = path.join(root, AUDIO_DIR);
  if (!existsSync(audio)) return [];
  const names: string[] = [];
  for (const item of readdirSync(audio, { withFileTypes: true })) {
    if (item.name.startsWith(SAMPLE_PREFIX)) continue;
    // 作業ツリーの public/audio/<パック> はジャンクション。Dirent では isDirectory() が false になるので stat する
    const isDir = item.isSymbolicLink()
      ? statSync(path.join(audio, item.name), { throwIfNoEntry: false })?.isDirectory() === true
      : item.isDirectory();
    if (isDir) names.push(item.name);
  }
  return names.sort();
}

/** hash の覚え（ディスク）の置き場所。ワーカーや実行をまたいで使う */
const HASH_CACHE_DIR = path.join(os.tmpdir(), 'mnw-e2e-hash-cache');

type CacheFiles = Record<string, [number, number, string]>;

/**
 * フォルダの中のファイルを（リンクのフォルダにも入って）集める。相対パスは '/' 区切り。
 * リンクの先は realpath を道すじに覚え、戻ってくるループは飛ばす。root の外を指すリンクは投げる。
 */
async function walkFiles(
  root: string,
  dir: string,
  rel: string,
  out: string[],
  chain: readonly string[] = [],
): Promise<void> {
  const here = [...chain, await realpath(path.join(dir, rel))];
  for (const item of await readdir(path.join(dir, rel), { withFileTypes: true })) {
    const relPath = rel === '' ? item.name : `${rel}/${item.name}`;
    let isDir = item.isDirectory();
    let isFile = item.isFile();
    if (item.isSymbolicLink()) {
      const real = await realpath(path.join(dir, relPath));
      if (!isInsideDir(root, real)) {
        throw new Error(
          `音声のフォルダの外を指すリンクはたどれません: ${path.join(dir, relPath)} -> ${real}`,
        );
      }
      if (here.some((c) => path.relative(c, real) === '')) continue;
      const target = await stat(path.join(dir, relPath));
      isDir = target.isDirectory();
      isFile = target.isFile();
    }
    if (isDir) await walkFiles(root, dir, relPath, out, here);
    else if (isFile && !isExcluded(relPath)) out.push(relPath);
  }
}

/**
 * 実体のフォルダのファイルの size と hash を求める。ディスクの覚え（size と mtimeMs が同じなら hash を使う）を
 * 使い、読み直したものがあれば覚えを書き直す。覚えが読めなくても・書けなくても失敗にしない。
 */
async function hashFolder(real: string): Promise<PrecacheEntry[]> {
  const key = createHash('sha256').update(real).digest('hex').slice(0, 16);
  const cacheFile = path.join(HASH_CACHE_DIR, `${key}.json`);
  let old: CacheFiles = {};
  try {
    const saved = JSON.parse(await readFile(cacheFile, 'utf8')) as {
      real?: unknown;
      files?: unknown;
    };
    if (saved.real === real && saved.files && typeof saved.files === 'object') {
      old = saved.files as CacheFiles;
    }
  } catch {
    // 無い・壊れている: 全部読む
  }
  const rels: string[] = [];
  await walkFiles(real, real, '', rels);
  const files: CacheFiles = {};
  const entries: PrecacheEntry[] = [];
  let changed = rels.length !== Object.keys(old).length;
  for (const rel of rels.sort()) {
    const st = await stat(path.join(real, rel));
    const prev = old[rel];
    let hash: string;
    // 覚えの hash が64桁の16進でなければ使わず、読み直す
    if (
      Array.isArray(prev) &&
      prev[0] === st.size &&
      prev[1] === st.mtimeMs &&
      typeof prev[2] === 'string' &&
      /^[0-9a-f]{64}$/.test(prev[2])
    ) {
      hash = prev[2];
    } else {
      hash = createHash('sha256')
        .update(await readFile(path.join(real, rel)))
        .digest('hex');
      changed = true;
    }
    files[rel] = [st.size, st.mtimeMs, hash];
    entries.push({ path: rel, size: st.size, hash });
  }
  if (changed) {
    const tmp = path.join(
      HASH_CACHE_DIR,
      `.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`,
    );
    try {
      await mkdir(HASH_CACHE_DIR, { recursive: true });
      await writeFile(tmp, JSON.stringify({ real, files }), 'utf8');
      await rename(tmp, cacheFile);
    } catch {
      await rm(tmp, { force: true }).catch(() => undefined);
    }
  }
  return entries;
}

/** つなぎ先の実体（realpath）ごとの、ファイルの size と hash（ワーカーごとに1回だけ求める） */
const audioListings = new Map<string, Promise<PrecacheEntry[]>>();

/**
 * つないだ音声のファイルの PrecacheEntry を返す（キーは 'audio/<名前>/…'）。
 * 同じ実体は一度しか読まない。finalizeDist の knownEntries に渡す。
 */
export async function linkedAudioEntries(root: string): Promise<Map<string, PrecacheEntry>> {
  const out = new Map<string, PrecacheEntry>();
  await Promise.all(
    linkableAudioDirs(root).map(async (name) => {
      const dir = path.join(root, AUDIO_DIR, name);
      const real = await realpath(dir);
      let listing = audioListings.get(real);
      if (!listing) {
        listing = hashFolder(real);
        audioListings.set(real, listing);
      }
      for (const e of await listing) {
        const rel = `${AUDIO_DIR}/${name}/${e.path}`;
        out.set(rel, { ...e, path: rel });
      }
    }),
  );
  return out;
}

export interface LinkedCopy {
  dir: string;
  /** つないだ音声のフォルダの名前（audio/<名前>/） */
  linked: string[];
  remove(): Promise<void>;
  removeSync(): void;
}

/** つないだリンクを先に外してから、フォルダを消す（リンクの先は消さない） */
export async function removeLinked(dir: string, linked: readonly string[]): Promise<void> {
  for (const name of linked) {
    await unlink(path.join(dir, AUDIO_DIR, name)).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== 'ENOENT') throw e;
    });
  }
  await rm(dir, { recursive: true, force: true });
}

export function removeLinkedSync(dir: string, linked: readonly string[]): void {
  for (const name of linked) {
    try {
      unlinkSync(path.join(dir, AUDIO_DIR, name));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  }
  rmSync(dir, { recursive: true, force: true });
}

let staleSwept = false;

/** 強制終了で残った古い写し（12時間より前）を片づける。リンクを外してから消す。失敗は無視 */
function sweepStaleCopies(): void {
  if (staleSwept) return;
  staleSwept = true;
  try {
    for (const name of readdirSync(os.tmpdir())) {
      if (!name.startsWith(LINKED_PREFIX)) continue;
      const dir = path.join(os.tmpdir(), name);
      try {
        if (Date.now() - statSync(dir).mtimeMs < STALE_MS) continue;
        const audio = path.join(dir, AUDIO_DIR);
        if (existsSync(audio)) {
          for (const item of readdirSync(audio)) {
            const link = path.join(audio, item);
            if (lstatSync(link).isSymbolicLink()) unlinkSync(link);
          }
        }
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // ほかの実行が使っているかもしれない。無視する
      }
    }
  } catch {
    // 一時フォルダが読めなくても続ける
  }
}

/**
 * src（dist の形のフォルダ）を、すでにあるフォルダ dir へ写す。audio/<つなぐ名前>/ は写さず、
 * linkFrom（既定は src）の実体（realpath）へジャンクションでつなぐ。つなぐ名前は src の audio/ の名前。つないだ名前を返す。失敗したら作ったリンクを外して投げ直す。
 */
export async function copyIntoLinkingAudio(
  src: string,
  dir: string,
  linkFrom: string = src,
): Promise<string[]> {
  const names = linkableAudioDirs(src);
  for (const name of names) {
    if (!existsSync(path.join(linkFrom, AUDIO_DIR, name))) {
      throw new Error(
        `dist が古い（${AUDIO_DIR}/${name} が ${linkFrom} にありません）。npm run build をやり直してください。`,
      );
    }
  }
  const skip = new Set(names.map((n) => path.resolve(src, AUDIO_DIR, n)));
  const made: string[] = [];
  const linkFromReal = await realpath(linkFrom);
  try {
    await cp(src, dir, { recursive: true, filter: (from) => !skip.has(path.resolve(from)) });
    if (names.length > 0) await mkdir(path.join(dir, AUDIO_DIR), { recursive: true });
    for (const name of names) {
      const target = await realpath(path.join(linkFrom, AUDIO_DIR, name));
      // つなぎ先が linkFrom の外（本体の public/audio など）なら、つながずに止める
      if (!target.startsWith(`${linkFromReal}${path.sep}`)) {
        throw new Error(`つなぎ先が ${linkFrom} の外です: ${AUDIO_DIR}/${name} -> ${target}`);
      }
      await symlink(target, path.join(dir, AUDIO_DIR, name), 'junction');
      made.push(name);
    }
  } catch (e) {
    for (const name of made) await unlink(path.join(dir, AUDIO_DIR, name)).catch(() => undefined);
    throw e;
  }
  return names;
}

/**
 * 写しの中のつないだ音声のつなぎ先（realpath）。finalizeDist の followLinks.allow に渡す
 * （リンクをたどるのは、写しの dist の中とこの場所だけ）。
 */
export async function linkedTargets(dir: string, linked: readonly string[]): Promise<string[]> {
  return Promise.all(linked.map((name) => realpath(path.join(dir, AUDIO_DIR, name))));
}

/** src を新しい一時フォルダへ写す。音声はつなぐ（copyIntoLinkingAudio） */
export async function copyLinkingAudio(
  src: string,
  prefix = LINKED_PREFIX,
  linkFrom: string = src,
): Promise<LinkedCopy> {
  sweepStaleCopies();
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  let linked: string[];
  try {
    linked = await copyIntoLinkingAudio(src, dir, linkFrom);
  } catch (e) {
    await rm(dir, { recursive: true, force: true });
    throw e;
  }
  return {
    dir,
    linked,
    remove: () => removeLinked(dir, linked),
    removeSync: () => removeLinkedSync(dir, linked),
  };
}

/** 相対パスがつないだフォルダの下なら投げる（消す・書くと、つなぎ先＝元の dist・本体の音声が変わるため） */
export function assertOutsideLinks(copy: LinkedCopy, rel: string): void {
  let norm = path.posix.normalize(rel.split('\\').join('/'));
  // 写しの外を指すパス（.. で始まる・絶対パス）も変えさせない
  if (
    norm === '..' ||
    norm.startsWith('../') ||
    path.isAbsolute(rel) ||
    path.posix.isAbsolute(norm)
  ) {
    throw new Error(`写しの外のパスは変えられません: ${rel}`);
  }
  // Windows では大文字小文字を区別しないので、小文字にそろえて比べる
  const fold = (t: string): string => (process.platform === 'win32' ? t.toLowerCase() : t);
  norm = fold(norm);
  for (const linkedName of copy.linked) {
    const base = `${AUDIO_DIR}/${fold(linkedName)}`;
    if (norm === base || norm.startsWith(`${base}/`)) {
      throw new Error(`つないだ音声のフォルダの中は変えられません: ${rel}`);
    }
  }
}

/** 音声の hash・ハーネスなどの重い準備を、テストの時間の外で前もって済ませる（spec の test.beforeAll 用） */
export async function warmDist(options: { harness?: boolean } = {}): Promise<void> {
  if (!existsSync(path.join(DIST, 'index.html'))) {
    throw new Error('dist がありません。先に npm run build を実行してください。');
  }
  await linkedAudioEntries(DIST);
  if (options.harness !== false) await buildHarness();
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
 * 音声は写さずにつなぐ（ファイルの先頭のコメント）。
 * dist がまだ無いときはエラー（npm run build が先に必要）。
 */
export async function prepareDist(options: PrepareOptions = {}): Promise<PreparedDist> {
  if (!existsSync(path.join(DIST, 'index.html'))) {
    throw new Error('dist がありません。先に npm run build を実行してください。');
  }
  const copy = await copyLinkingAudio(DIST, LINKED_PREFIX);
  const dir = copy.dir;
  try {
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
      assertOutsideLinks(copy, rel);
      await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
      await writeFile(path.join(dir, rel), content, 'utf8');
    }
    for (const rel of options.removeFiles ?? []) {
      assertOutsideLinks(copy, rel);
      await rm(path.join(dir, rel), { force: true });
    }

    const info = await finalizeDist(dir, {
      knownEntries: await linkedAudioEntries(DIST),
      followLinks: { allow: await linkedTargets(dir, copy.linked) },
    });
    for (const rel of options.breakFiles ?? []) {
      assertOutsideLinks(copy, rel);
      await rm(path.join(dir, rel), { force: true });
    }

    return { dir, version: info.version, fileCount: info.fileCount, cleanup: () => copy.remove() };
  } catch (e) {
    await copy.remove();
    throw e;
  }
}
