// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CSP,
  computeVersion,
  finalizeDist,
  isExcluded,
  listDistFiles,
  precachePlugin,
  transpileServiceWorker,
} from './vite-plugin-precache.ts';

let dir: string;

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
  await rm(dir, { recursive: true, force: true });
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

    expect(version).toEqual(info);
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
