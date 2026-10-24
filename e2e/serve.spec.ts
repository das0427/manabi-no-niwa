import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { prepareDist } from './helpers/dist';
import type { PreparedDist } from './helpers/dist';
import { getFreePort, httpRequest, spawnServe, startServe } from './helpers/serve';
import type { ServeHandle } from './helpers/serve';

// E-20: deploy/zorin/serve.py（IN-03）
test.describe.configure({ mode: 'serial' });

let dist: PreparedDist;
let server: ServeHandle;
let assetJs: string;
let assetCss: string;
let mp3: string | undefined;

test.beforeAll(async () => {
  dist = await prepareDist({ harness: false });
  server = await startServe(dist.dir);
  const assets = readdirSync(path.join(dist.dir, 'assets'));
  assetJs = assets.find((f) => f.endsWith('.js')) ?? '';
  assetCss = assets.find((f) => f.endsWith('.css')) ?? '';
  mp3 = readdirSync(path.join(dist.dir, 'audio')).find((f) => f.endsWith('.mp3'));
});

test.afterAll(async () => {
  await server?.stop();
  await dist?.cleanup();
});

function header(h: Record<string, string | string[] | undefined>, name: string): string {
  const v = h[name];
  return Array.isArray(v) ? v.join(', ') : (v ?? '');
}

test('MIME: .webmanifest .woff2 .mp3 .js .json .svg など', async () => {
  const cases: [string, string][] = [
    ['/', 'text/html'],
    ['/index.html', 'text/html'],
    ['/manifest.webmanifest', 'application/manifest+json'],
    ['/fonts/klee-one-400.woff2', 'font/woff2'],
    ['/sw.js', 'text/javascript'],
    [`/assets/${assetJs}`, 'text/javascript'],
    [`/assets/${assetCss}`, 'text/css'],
    ['/version.json', 'application/json'],
    ['/icons/icon.svg', 'image/svg+xml'],
    ['/icons/icon-192.png', 'image/png'],
  ];
  if (mp3) cases.push([`/audio/${mp3}`, 'audio/mpeg']);
  for (const [urlPath, type] of cases) {
    const r = await httpRequest(server.port, urlPath);
    expect(r.status, urlPath).toBe(200);
    expect(header(r.headers, 'content-type'), urlPath).toContain(type);
  }
});

test('Cache-Control: 版に関わるファイルは no-cache、assets/ は長期キャッシュ', async () => {
  for (const urlPath of ['/', '/index.html', '/sw.js', '/version.json', '/manifest.webmanifest']) {
    const r = await httpRequest(server.port, urlPath);
    expect(header(r.headers, 'cache-control'), urlPath).toBe('no-cache');
  }
  for (const urlPath of [`/assets/${assetJs}`, `/assets/${assetCss}`]) {
    const r = await httpRequest(server.port, urlPath);
    const cc = header(r.headers, 'cache-control');
    expect(cc, urlPath).toContain('max-age=31536000');
    expect(cc, urlPath).toContain('immutable');
  }
  // 存在しない assets/ のファイルを長期キャッシュさせない
  const missing = await httpRequest(server.port, '/assets/nothing-here.js');
  expect(missing.status).toBe(404);
  expect(header(missing.headers, 'cache-control')).toBe('no-cache');
});

test('版に関わるファイルは条件付き要求にも 200 で答える（更新の見落とし防止）、assets/ は 304 を返せる', async () => {
  const future = new Date(Date.now() + 86_400_000).toUTCString();
  for (const urlPath of ['/sw.js', '/index.html', '/version.json', '/manifest.webmanifest']) {
    const r = await httpRequest(server.port, urlPath, { headers: { 'If-Modified-Since': future } });
    expect(r.status, urlPath).toBe(200);
    expect(r.body.length, urlPath).toBeGreaterThan(0);
  }
  const asset = await httpRequest(server.port, `/assets/${assetJs}`, {
    headers: { 'If-Modified-Since': future },
  });
  expect(asset.status).toBe(304);
});

test('/__manabi/health が自分のアプリと版を返す', async () => {
  const r = await httpRequest(server.port, '/__manabi/health');
  expect(r.status).toBe(200);
  expect(header(r.headers, 'content-type')).toContain('application/json');
  const body = JSON.parse(r.body.toString('utf8')) as { app: string; version: string | null };
  const versionJson = JSON.parse(readFileSync(path.join(dist.dir, 'version.json'), 'utf8')) as {
    version: string;
  };
  expect(body).toEqual({ app: 'manabi-no-niwa', version: versionJson.version });
  expect(body.version).toBe(dist.version);
});

test('ディレクトリ一覧を出さない・パスの外へ出られない', async () => {
  for (const urlPath of ['/assets/', '/fonts/', '/audio/', '/icons/']) {
    const r = await httpRequest(server.port, urlPath);
    expect(r.status, urlPath).toBe(404);
    const text = r.body.toString('utf8');
    expect(text).not.toContain('Directory listing');
    expect(text).not.toContain(assetJs);
  }
  // 末尾の / なしでも一覧には行き着かない
  const redirect = await httpRequest(server.port, '/assets');
  if (redirect.status >= 300 && redirect.status < 400) {
    const to = new URL(header(redirect.headers, 'location'), server.url);
    expect((await httpRequest(server.port, to.pathname)).status).toBe(404);
  } else {
    expect(redirect.status).toBe(404);
  }
  for (const urlPath of [
    '/../package.json',
    '/%2e%2e/package.json',
    '/..%2fpackage.json',
    '/assets/../../package.json',
  ]) {
    const r = await httpRequest(server.port, urlPath);
    expect(r.status, urlPath).not.toBe(200);
    expect(r.body.toString('utf8')).not.toContain('"name": "manabi-no-niwa"');
  }
  expect((await httpRequest(server.port, '/no-such-file.txt')).status).toBe(404);
});

test('127.0.0.1 / localhost 以外の Host 名には答えない（DNS リバインディング対策）', async () => {
  const bad = await httpRequest(server.port, '/', { headers: { Host: 'evil.example.com' } });
  expect(bad.status).toBe(403);
  const ok = await httpRequest(server.port, '/', { headers: { Host: `localhost:${server.port}` } });
  expect(ok.status).toBe(200);
});

test('GET 以外は受け付けない・HEAD は本文なし', async () => {
  const head = await httpRequest(server.port, '/index.html', { method: 'HEAD' });
  expect(head.status).toBe(200);
  expect(head.body.length).toBe(0);
  const post = await httpRequest(server.port, '/index.html', { method: 'POST' });
  expect(post.status).toBeGreaterThanOrEqual(400);
});

/** OS の待ち受け一覧（Windows: netstat、Linux: ss）。取得できなければ空文字 */
function listeningSockets(): string {
  try {
    return process.platform === 'win32'
      ? execFileSync('netstat', ['-an', '-p', 'TCP'], { encoding: 'utf8' })
      : execFileSync('ss', ['-ltn'], { encoding: 'utf8' });
  } catch {
    return '';
  }
}

test('127.0.0.1 だけで待ち受ける（LAN 側の IP からは接続できない）', async () => {
  // 1) OS の待ち受け一覧: このポートの LISTEN は 127.0.0.1 だけ
  const listing = listeningSockets();
  if (!listing) {
    test.info().annotations.push({
      type: 'skipped-check',
      description: 'netstat / ss が使えないため待ち受け一覧は未確認',
    });
  } else {
    const listenLines = listing
      .split(/\r?\n/)
      .filter((l) => /LISTEN/i.test(l) && new RegExp(`[:.]${server.port}\\s`).test(`${l} `));
    expect(listenLines.length, `ポート ${server.port} の LISTEN 行`).toBeGreaterThan(0);
    for (const line of listenLines) {
      expect(line, '127.0.0.1 以外で待ち受けている').toMatch(
        new RegExp(`127\\.0\\.0\\.1[:.]${server.port}\\s`),
      );
    }
  }

  // 2) LAN 側の IPv4 アドレスへ接続すると拒否される（アドレスが無い PC ではこの確認だけ省略）
  const lanAddrs = Object.values(os.networkInterfaces())
    .flat()
    .filter((i): i is os.NetworkInterfaceInfo => !!i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  for (const host of lanAddrs) {
    const result = await new Promise<string>((resolve) => {
      const s = net.connect({ host, port: server.port, timeout: 3000 });
      s.once('connect', () => (s.destroy(), resolve('connected')));
      s.once('timeout', () => (s.destroy(), resolve('timeout')));
      s.once('error', (e: NodeJS.ErrnoException) => resolve(e.code ?? 'error'));
    });
    expect(result, `${host}:${server.port} へ接続できてはいけない`).not.toBe('connected');
  }
  test.info().annotations.push({
    type: 'LAN addresses checked',
    description: lanAddrs.join(', ') || '(none)',
  });
  // IPv6 のループバックでも待ち受けていない
  const v6 = await new Promise<string>((resolve) => {
    const s = net.connect({ host: '::1', port: server.port, timeout: 3000 });
    s.once('connect', () => (s.destroy(), resolve('connected')));
    s.once('timeout', () => (s.destroy(), resolve('timeout')));
    s.once('error', (e: NodeJS.ErrnoException) => resolve(e.code ?? 'error'));
  });
  expect(v6).not.toBe('connected');
});

test('ポート使用中は別ポートへ逃げず、明確なメッセージで終了する（コード 3）', async () => {
  // すでに serve.py が使っているポート
  const second = spawnServe(dist.dir, server.port);
  const code = await second.exited;
  expect(code).toBe(3);
  expect(second.output()).toContain(`127.0.0.1:${server.port}`);
  expect(second.output()).toContain('別のポートへは自動で切り替えません');
  // 元の配信は無事
  expect((await httpRequest(server.port, '/__manabi/health')).status).toBe(200);

  // 別のプログラムが使っているポート
  const port = await getFreePort();
  const blocker = net.createServer();
  await new Promise<void>((resolve) => blocker.listen(port, '127.0.0.1', resolve));
  try {
    const third = spawnServe(dist.dir, port);
    expect(await third.exited).toBe(3);
    expect(third.output()).toContain('別のポートへは自動で切り替えません');
  } finally {
    await new Promise<void>((resolve) => blocker.close(() => resolve()));
  }
});

test('index.html が無いフォルダでは起動せず終了する（コード 2）', async () => {
  const port = await getFreePort();
  const bad = spawnServe(os.tmpdir(), port);
  expect(await bad.exited).toBe(2);
  expect(bad.output()).toContain('index.html');
});

test('静か: ここまでの要求のあとも標準出力・標準エラーに何も出さない（アクセスログなし）', async () => {
  await httpRequest(server.port, '/');
  await httpRequest(server.port, '/no-such-file.txt');
  expect(server.output()).toBe('');
});
