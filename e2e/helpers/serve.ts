import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';

/** deploy/zorin/serve.py をテストから起動・停止するための補助 */

export const SERVE_PY = path.resolve(import.meta.dirname, '../../deploy/zorin/serve.py');

let pythonCache: string | null = null;

function tryPython(cmd: string | undefined): string | null {
  if (!cmd) return null;
  const r = spawnSync(cmd, ['--version'], { encoding: 'utf8', windowsHide: true });
  return r.status === 0 && /Python 3\./.test(`${r.stdout}${r.stderr}`) ? cmd : null;
}

/** Python 3 の実行ファイルを探す（環境変数 MNW_PYTHON を優先） */
export function findPython(): string {
  if (pythonCache) return pythonCache;
  const candidates = [
    process.env.MNW_PYTHON,
    'python3',
    'python',
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Python', 'Python312', 'python.exe')
      : undefined,
  ];
  for (const c of candidates) {
    const found = tryPython(c);
    if (found) {
      pythonCache = found;
      return found;
    }
  }
  throw new Error(
    'Python 3 が見つかりません。環境変数 MNW_PYTHON に python の場所を指定してください。',
  );
}

export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

export interface HttpResult {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

/** プロキシ等を通さず、127.0.0.1 へ直接 HTTP 要求する */
export function httpRequest(
  port: number,
  urlPath: string,
  options: { method?: string; headers?: Record<string, string> } = {},
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: urlPath,
        method: options.method ?? 'GET',
        headers: options.headers,
        agent: false,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          }),
        );
      },
    );
    req.setTimeout(5000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

export interface ServeHandle {
  port: number;
  /** 例: http://127.0.0.1:8799/ */
  url: string;
  proc: ChildProcess;
  /** serve.py の標準出力・標準エラー（静かに動くはずなので、通常は空） */
  output(): string;
  stop(): Promise<void>;
}

export interface SpawnedServe {
  proc: ChildProcess;
  output(): string;
  exited: Promise<number | null>;
}

export function spawnServe(dir: string, port: number): SpawnedServe {
  const proc = spawn(findPython(), ['-u', SERVE_PY, '--dir', dir, '--port', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  let out = '';
  proc.stdout?.on('data', (c: Buffer) => (out += c.toString('utf8')));
  proc.stderr?.on('data', (c: Buffer) => (out += c.toString('utf8')));
  const exited = new Promise<number | null>((resolve) =>
    proc.once('exit', (code) => resolve(code)),
  );
  return { proc, output: () => out, exited };
}

async function waitHealthy(port: number, spawned: SpawnedServe, timeoutMs = 10000): Promise<void> {
  const start = Date.now();
  let exitCode: number | null | undefined;
  void spawned.exited.then((c) => (exitCode = c));
  while (Date.now() - start < timeoutMs) {
    if (exitCode !== undefined) {
      throw new Error(`serve.py が終了しました (code ${exitCode}): ${spawned.output()}`);
    }
    try {
      const r = await httpRequest(port, '/__manabi/health');
      if (r.status === 200) return;
    } catch {
      // まだ起動していない
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  spawned.proc.kill();
  throw new Error(`serve.py の起動を待ちましたが応答がありません: ${spawned.output()}`);
}

/** serve.py を指定ポート（省略時は空きポート）で起動し、health が答えるまで待つ */
export async function startServe(
  dir: string,
  options: { port?: number } = {},
): Promise<ServeHandle> {
  const port = options.port ?? (await getFreePort());
  const spawned = spawnServe(dir, port);
  await waitHealthy(port, spawned);
  return {
    port,
    url: `http://127.0.0.1:${port}/`,
    proc: spawned.proc,
    output: spawned.output,
    async stop() {
      if (spawned.proc.exitCode === null && spawned.proc.signalCode === null) {
        spawned.proc.kill();
        await spawned.exited;
      }
    },
  };
}
