// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CORE_PACK_IDS,
  CSP,
  computeVersion,
  finalizeDist,
  isCorePack,
  isExcluded,
  listDistFiles,
  precachePlugin,
  readAppVersion,
  transpileServiceWorker,
} from './vite-plugin-precache.ts';

let dir: string;
/** テストの中で作ったジャンクション。後片づけでリンクを外してから、一時フォルダを消す */
const links: string[] = [];
/** ジャンクションのつなぎ先に使う別の一時フォルダ */
let targetDir: string | null = null;

async function put(rel: string, content: string): Promise<void> {
  const file = path.join(dir, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, 'utf8');
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'mnw-precache-'));
  await put('index.html', '<html></html>');
  await put('assets/app-abc.js', 'console.log(1)');
  await put('fonts/a.woff2', 'font');
});

afterEach(async () => {
  for (const link of links.splice(0)) await unlink(link).catch(() => undefined);
  await rm(dir, { recursive: true, force: true });
  if (targetDir) await rm(targetDir, { recursive: true, force: true });
  targetDir = null;
});

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

describe('コアに同梱するパック', () => {
  it('幼児のパック（p23・p4・p5）と幼児の英語（en-pre）はコア。小学生のパックは違う', () => {
    for (const id of ['p23', 'p4', 'p5', 'en-pre']) {
      expect(CORE_PACK_IDS).toContain(id);
      expect(isCorePack(id)).toBe(true);
    }
    expect(isCorePack('en-g34')).toBe(false);
    expect(isCorePack('g3-math')).toBe(false);
  });
});

describe('listDistFiles', () => {
  it('sw.js・.map・version.json・隠しファイルを含めず、パス順で返す', async () => {
    await put('sw.js', 'old sw');
    await put('assets/app-abc.js.map', '{}');
    await put('version.json', '{}');
    await put('.DS_Store', 'x');
    const list = await listDistFiles(dir);
    expect(list.map((e) => e.path)).toEqual(['assets/app-abc.js', 'fonts/a.woff2', 'index.html']);
    expect(isExcluded('sw.js')).toBe(true);
    expect(isExcluded('assets/x.js.map')).toBe(true);
    expect(isExcluded('assets/sw.js')).toBe(false);
  });

  /** dist の外に audio/p1/a.mp3 を作り、dist/audio/p1 からジャンクションでつなぐ */
  async function linkAudio(): Promise<string> {
    targetDir = await mkdtemp(path.join(os.tmpdir(), 'mnw-precache-target-'));
    await mkdir(path.join(targetDir, 'p1'), { recursive: true });
    await writeFile(path.join(targetDir, 'p1', 'a.mp3'), 'audio-a', 'utf8');
    await mkdir(path.join(dir, 'audio'), { recursive: true });
    const link = path.join(dir, 'audio', 'p1');
    await symlink(path.join(targetDir, 'p1'), link, 'junction');
    links.push(link);
    return path.join(targetDir, 'p1');
  }

  it('followLinks を渡さなければ、リンクの先は数えない（ビルドと同じ）', async () => {
    await linkAudio();
    const list = await listDistFiles(dir);
    expect(list.map((e) => e.path)).toEqual(['assets/app-abc.js', 'fonts/a.woff2', 'index.html']);
  });

  it('followLinks を渡すと、ジャンクションでつないだフォルダの中のファイルも、リンクの先の内容の hash で入る', async () => {
    const real = await linkAudio();
    const list = await listDistFiles(dir, undefined, { allow: [real] });
    expect(list.map((e) => e.path)).toEqual([
      'assets/app-abc.js',
      'audio/p1/a.mp3',
      'fonts/a.woff2',
      'index.html',
    ]);
    expect(list.find((e) => e.path === 'audio/p1/a.mp3')).toEqual({
      path: 'audio/p1/a.mp3',
      size: 'audio-a'.length,
      hash: sha256('audio-a'),
    });
  });

  it('followLinks: dist の中へ戻るループのリンクがあっても止まる', async () => {
    await mkdir(path.join(dir, 'sub'), { recursive: true });
    await put('sub/b.txt', 'b');
    const loop = path.join(dir, 'sub', 'loop');
    await symlink(dir, loop, 'junction');
    links.push(loop);
    const list = await listDistFiles(dir, undefined, {});
    expect(list.map((e) => e.path)).toEqual([
      'assets/app-abc.js',
      'fonts/a.woff2',
      'index.html',
      'sub/b.txt',
    ]);
  });

  it('followLinks: dist の外を指すリンクは（allow に無ければ）エラーにする', async () => {
    await linkAudio();
    await expect(listDistFiles(dir, undefined, {})).rejects.toThrow('dist の外を指すリンク');
  });

  it('known にあるファイルは読まずにその値を使い、無いファイルは今までどおり読む', async () => {
    const known = new Map([
      ['fonts/a.woff2', { path: 'fonts/a.woff2', size: 999, hash: 'わざと違う hash' }],
    ]);
    const list = await listDistFiles(dir, known);
    expect(list.find((e) => e.path === 'fonts/a.woff2')).toEqual({
      path: 'fonts/a.woff2',
      size: 999,
      hash: 'わざと違う hash',
    });
    expect(list.find((e) => e.path === 'index.html')).toEqual({
      path: 'index.html',
      size: '<html></html>'.length,
      hash: sha256('<html></html>'),
    });
  });
});

describe('computeVersion', () => {
  it('同じ内容なら同じ版ID、内容が変わると変わる', async () => {
    const a1 = computeVersion(await listDistFiles(dir), 'sw');
    const a2 = computeVersion(await listDistFiles(dir), 'sw');
    expect(a1).toBe(a2);
    expect(a1).toMatch(/^[0-9a-f]{12}$/);

    await put('assets/app-abc.js', 'console.log(2)');
    const b = computeVersion(await listDistFiles(dir), 'sw');
    expect(b).not.toBe(a1);
  });

  it('ファイルの追加・SW ソースの変更でも変わる', async () => {
    const base = computeVersion(await listDistFiles(dir), 'sw');
    expect(computeVersion(await listDistFiles(dir), 'sw2')).not.toBe(base);
    await put('extra.txt', 'x');
    const added = computeVersion(await listDistFiles(dir), 'sw');
    expect(added).not.toBe(base);
  });

  it('同じ内容でもパスが違えば版ID が変わる', async () => {
    const base = computeVersion(await listDistFiles(dir), 'sw');
    await rm(path.join(dir, 'fonts/a.woff2'));
    await put('fonts/b.woff2', 'font');
    expect(computeVersion(await listDistFiles(dir), 'sw')).not.toBe(base);
  });

  it('sw.js・.map の中身は版ID に影響しない', async () => {
    const base = computeVersion(await listDistFiles(dir), 'sw');
    await put('sw.js', 'something');
    await put('assets/app-abc.js.map', '{"v":1}');
    expect(computeVersion(await listDistFiles(dir), 'sw')).toBe(base);
  });
});

describe('finalizeDist', () => {
  it('sw.js と version.json を出力し、一覧に sw.js と .map を含めない', async () => {
    await put('assets/app-abc.js.map', '{}');
    const info = await finalizeDist(dir);
    const sw = await readFile(path.join(dir, 'sw.js'), 'utf8');
    const version = JSON.parse(
      await readFile(path.join(dir, 'version.json'), 'utf8'),
    ) as typeof info;

    // appVersion を渡していないので、version.json に appVersion の欄は出ない
    expect(version).toEqual({
      version: info.version,
      fileCount: 3,
      totalBytes: 'console.log(1)'.length + 'font'.length + '<html></html>'.length,
    });
    expect(Object.keys(version)).toEqual(['version', 'fileCount', 'totalBytes']);
    expect(info).toEqual(version);
    expect(info.fileCount).toBe(3);
    expect(info.totalBytes).toBe('<html></html>'.length + 'console.log(1)'.length + 'font'.length);
    expect(sw).toContain(`const __MNW_VERSION__ = "${info.version}"`);

    const m = /const __MNW_FILES__ = (\[.*\]);/.exec(sw);
    const files = JSON.parse(m?.[1] ?? '[]') as string[];
    expect(files).toEqual(['assets/app-abc.js', 'fonts/a.woff2', 'index.html']);
    expect(files).not.toContain('sw.js');
    expect(files.some((f) => f.endsWith('.map'))).toBe(false);
    // classic script として登録するため import / export を含まない
    expect(sw).not.toMatch(/^\s*(import|export)\b/m);
    expect(sw).toContain('precache-progress');
    expect(sw).toContain('SKIP_WAITING');
  });

  it('再生成しても（sw.js が既にあっても）同じ版ID。内容を変えて再生成すると変わる', async () => {
    const first = await finalizeDist(dir);
    const again = await finalizeDist(dir);
    expect(again.version).toBe(first.version);
    await put('assets/app-abc.js', 'changed');
    const changed = await finalizeDist(dir);
    expect(changed.version).not.toBe(first.version);
  });

  it('正しい knownEntries を渡しても、渡さないときと同じ版ID・同じ sw.js になる', async () => {
    const plain = await finalizeDist(dir);
    const swPlain = await readFile(path.join(dir, 'sw.js'), 'utf8');
    const knownEntries = new Map(
      (await listDistFiles(dir)).filter((e) => e.path !== 'index.html').map((e) => [e.path, e]),
    );
    const withKnown = await finalizeDist(dir, { knownEntries });
    const swKnown = await readFile(path.join(dir, 'sw.js'), 'utf8');
    expect(withKnown).toEqual(plain);
    expect(swKnown).toBe(swPlain);
  });

  it('appVersion を渡すと、version.json にだけ appVersion（アプリの版の番号）が入る', async () => {
    const info = await finalizeDist(dir, { appVersion: '2.1.0' });
    const version = JSON.parse(await readFile(path.join(dir, 'version.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    expect(version).toEqual({
      version: info.version,
      fileCount: 3,
      totalBytes: 'console.log(1)'.length + 'font'.length + '<html></html>'.length,
      appVersion: '2.1.0',
    });
    expect(info.appVersion).toBe('2.1.0');
    // 版IDの "version" は Service Worker の版ID（12 桁の16進）のまま。版の番号とは別
    expect(info.version).toMatch(/^[0-9a-f]{12}$/);
  });

  it('appVersion は SW の版ID・sw.js・プリキャッシュの一覧に影響しない（version.json はプリキャッシュに入らない）', async () => {
    const without = await finalizeDist(dir);
    const swWithout = await readFile(path.join(dir, 'sw.js'), 'utf8');
    const withA = await finalizeDist(dir, { appVersion: '2.1.0' });
    const swA = await readFile(path.join(dir, 'sw.js'), 'utf8');
    const withB = await finalizeDist(dir, { appVersion: '9.9.9' });
    const swB = await readFile(path.join(dir, 'sw.js'), 'utf8');
    expect(withA.version).toBe(without.version);
    expect(withB.version).toBe(without.version);
    expect(swA).toBe(swWithout);
    expect(swB).toBe(swWithout);
    expect(withB.fileCount).toBe(without.fileCount);
    expect(withB.totalBytes).toBe(without.totalBytes);
  });

  it('appVersion を付けずに作り直すと、前の appVersion は残らない', async () => {
    await finalizeDist(dir, { appVersion: '2.1.0' });
    await finalizeDist(dir);
    const version = JSON.parse(await readFile(path.join(dir, 'version.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    expect('appVersion' in version).toBe(false);
  });

  it('SW ソースを変えると版ID が変わる', async () => {
    const first = await finalizeDist(dir);
    const alt = path.join(dir, '..', `alt-sw-${path.basename(dir)}.ts`);
    await writeFile(
      alt,
      'declare const __MNW_VERSION__: string;\nconsole.log(__MNW_VERSION__);\n',
      'utf8',
    );
    try {
      const second = await finalizeDist(dir, { swSourcePath: alt });
      expect(second.version).not.toBe(first.version);
    } finally {
      await rm(alt, { force: true });
    }
  });
});

describe('readAppVersion', () => {
  it('package.json の version（文字列）を返す', async () => {
    await put('package.json', JSON.stringify({ name: 'x', version: '2.1.0' }));
    expect(await readAppVersion(dir)).toBe('2.1.0');
  });

  it('version が無い・文字列でない・package.json が無いときは例外', async () => {
    await put('package.json', JSON.stringify({ name: 'x' }));
    await expect(readAppVersion(dir)).rejects.toThrow(/version/);
    await put('package.json', JSON.stringify({ version: 2 }));
    await expect(readAppVersion(dir)).rejects.toThrow(/version/);
    await put('package.json', JSON.stringify({ version: '' }));
    await expect(readAppVersion(dir)).rejects.toThrow(/version/);
    await rm(path.join(dir, 'package.json'));
    await expect(readAppVersion(dir)).rejects.toThrow();
  });

  it('このリポジトリの package.json の版は X.Y.Z の形', async () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    expect(await readAppVersion(root)).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('transpileServiceWorker', () => {
  it('実際の src/sw/sw.ts が単独の JS になる', async () => {
    const code = await transpileServiceWorker();
    expect(code).toContain('addEventListener("install"');
    expect(code).toContain('addEventListener("fetch"');
    expect(code).not.toContain('clients.claim');
    expect(code).not.toMatch(/^\s*(import|export)\b/m);
  });
});

describe('precachePlugin', () => {
  it('CSP を挿入するプラグインと SW を作るプラグインを返し、どちらも build 専用', () => {
    const plugins = precachePlugin();
    expect(plugins.map((p) => p.name)).toEqual(['mnw-csp', 'mnw-precache']);
    expect(plugins.every((p) => p.apply === 'build')).toBe(true);
    expect(CSP).toContain("default-src 'self'");
    expect(CSP).toContain("object-src 'none'");
  });
});
