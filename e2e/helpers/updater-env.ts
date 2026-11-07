import { execFileSync, spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { FakeGitHub } from './fake-github.ts';
import { pickFreePort, releasePort } from './ports.ts';
import { writeInstalledApp } from './release-fixture.ts';
import type { Release } from './release-fixture.ts';
import { findPython } from './serve.ts';

/**
 * 更新の通し試験（e2e/update.spec.ts）の環境: 一時フォルダの中に HOME を作り、導入された置き場
 * （<DATA>/manabi-no-niwa/app）を作って、本物の serve.py を 127.0.0.1 の 4800〜4999 の空きポートで動かす。
 * 取得先は偽の GitHub（MANABI_UPDATE_TEST_ORIGIN）。本物の GitHub にはつながない。
 */

// ---------------------------------------------------------------- 置き場（一時フォルダ）

export interface Sandbox {
  root: string;
  home: string;
  data: string;
  config: string;
  state: string;
  /** <DATA>/manabi-no-niwa */
  base: string;
  app: string;
  appNext: string;
  appPrev: string;
  updateDir: string;
  downloads: string;
  stateFile: string;
  configFile: string;
  /** serve.py の標準出力・標準エラー（置き場の外） */
  logFile: string;
  /** 空きの数を差し替えるファイル（置き場の外。fakeDisk のとき serve.py が読む） */
  freeFile: string;
}

export async function createSandbox(): Promise<Sandbox> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mnwupd-'));
  const home = path.join(root, 'home');
  const data = path.join(root, 'data');
  const config = path.join(root, 'config');
  const state = path.join(root, 'state');
  for (const dir of [home, data, config, state]) await mkdir(dir, { recursive: true });
  const base = path.join(data, 'manabi-no-niwa');
  const updateDir = path.join(base, 'update');
  return {
    root,
    home,
    data,
    config,
    state,
    base,
    app: path.join(base, 'app'),
    appNext: path.join(base, 'app.next'),
    appPrev: path.join(base, 'app.prev'),
    updateDir,
    downloads: path.join(updateDir, 'downloads'),
    stateFile: path.join(updateDir, 'state.json'),
    configFile: path.join(config, 'manabi-no-niwa', 'updater.json'),
    logFile: path.join(root, 'serve.log'),
    freeFile: path.join(root, 'free-bytes.txt'),
  };
}

/** path の下の全ファイルの相対パス（/ 区切り・パス順）。無ければ [] */
export function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string, rel: string): void => {
    let items: string[];
    try {
      items = readdirSync(current);
    } catch {
      return;
    }
    for (const name of items) {
      const p = path.join(current, name);
      const r = rel === '' ? name : `${rel}/${name}`;
      if (statSync(p).isDirectory()) walk(p, r);
      else out.push(r);
    }
  };
  if (existsSync(dir)) walk(dir, '');
  return out.sort();
}

/** フォルダの中身全部（パスと内容）の指紋。入れ替えのあとも元のままかを比べる */
export function treeDigest(dir: string): string {
  const h = createHash('sha256');
  for (const rel of listFiles(dir)) {
    h.update(
      `${rel}\0${createHash('sha256')
        .update(readFileSync(path.join(dir, rel)))
        .digest('hex')}\n`,
    );
  }
  return h.digest('hex');
}

/** 置き場の app/parts/main.json の version（無ければ null） */
export function installedVersion(appDir: string): string | null {
  try {
    const mark = JSON.parse(readFileSync(path.join(appDir, 'parts', 'main.json'), 'utf8')) as {
      version?: unknown;
    };
    return typeof mark.version === 'string' ? mark.version : null;
  } catch {
    return null;
  }
}

/**
 * フォルダが現れて消えるのを、短い間隔で見張る（入れ替えの直後に前の版が app.prev に残り、新しい serve.py が
 * 確かめたら消える、という「控え」の動きを見るため）。現れたとき、probe（相対パス）の JSON の version を読む。
 */
export function observeDirectory(
  dir: string,
  probe: string,
): { stop(): { seen: boolean; version: string | null } } {
  let seen = false;
  let version: string | null = null;
  const timer = setInterval(() => {
    if (!existsSync(dir)) return;
    seen = true;
    if (version === null) {
      try {
        const json = JSON.parse(readFileSync(path.join(dir, probe), 'utf8')) as {
          version?: unknown;
        };
        if (typeof json.version === 'string') version = json.version;
      } catch {
        // 消えかけ・書きかけ。次の周期でもう一度読む
      }
    }
  }, 5);
  return {
    stop() {
      clearInterval(timer);
      return { seen, version };
    },
  };
}

// ---------------------------------------------------------------- 窓口を使う側（アプリと同じ見出しを付ける）

export interface RawResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

/** 127.0.0.1 へ直接 HTTP 要求する（プロキシ・Cookie なし。Host は 127.0.0.1:<port>） */
export function rawRequest(
  port: number,
  method: string,
  urlPath: string,
  options: { headers?: Record<string, string>; body?: string } = {},
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: urlPath, method, headers: options.headers, agent: false },
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
    req.setTimeout(10_000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (options.body !== undefined) req.write(options.body);
    req.end();
  });
}

/** 窓口の状態（GET /__manabi/update/status）のうち、試験が見る欄 */
export interface StatusJson {
  schema: number;
  supported: boolean;
  reason: string | null;
  token: string;
  server: { pid: number; startedAt: string };
  current: { version: string };
  settings: { autoCheck: boolean };
  disk: { freeBytes: number };
  check: {
    state: string;
    at: string | null;
    error: { code: string; detail: string } | null;
  };
  latest: {
    version: string;
    date: string;
    notes: string[];
    newer: boolean;
    installable: boolean;
    blockedReason: string | null;
    downloadBytes: number;
    needBytes: number;
    parts: { kind: string; bytes: number; changed: boolean }[];
  } | null;
  update: {
    phase: string;
    targetVersion: string | null;
    progress: { doneBytes: number; totalBytes: number; part: string } | null;
    error: { code: string; detail: string; needBytes?: number } | null;
    startedAt: string | null;
    finishedAt: string | null;
  };
  lastApplied: { version: string; from: string; at: string } | null;
}

export interface PostResult {
  status: number;
  json: { ok?: boolean; error?: { code: string; detail: string }; status?: StatusJson };
}

// ---------------------------------------------------------------- 本物の serve.py

const SITECUSTOMIZE_DIR = path.resolve(import.meta.dirname, 'py');

export interface ServeOptions {
  fakeOrigin: string;
  /** true なら、空きの数を sandbox.freeFile で差し替えられる（e2e/helpers/py/sitecustomize.py） */
  fakeDisk?: boolean;
  env?: Record<string, string>;
}

export class InstalledServe {
  port: number;
  private proc: ChildProcess | null = null;

  private constructor(
    readonly sandbox: Sandbox,
    private readonly options: ServeOptions,
    port: number,
  ) {
    this.port = port;
  }

  static async start(sandbox: Sandbox, options: ServeOptions): Promise<InstalledServe> {
    let lastError = '';
    for (let attempt = 0; attempt < 4; attempt++) {
      const serve = new InstalledServe(sandbox, options, await pickFreePort());
      try {
        await serve.launch();
        return serve;
      } catch (e) {
        lastError = (e as Error).message;
        await serve.kill();
        releasePort(serve.port);
        // ポートを取られた（終了コード 3）なら選び直す。それ以外は、そのまま失敗にする
        if (!/終了コード 3/.test(lastError)) throw e;
      }
    }
    throw new Error(`serve.py を起動できません: ${lastError}`);
  }

  get url(): string {
    return `http://127.0.0.1:${this.port}/`;
  }
  get origin(): string {
    return `http://127.0.0.1:${this.port}`;
  }
  get serveScript(): string {
    return path.join(this.sandbox.app, 'deploy', 'zorin', 'serve.py');
  }

  /** serve.py のログ（標準出力・標準エラー） */
  log(): string {
    try {
      return readFileSync(this.sandbox.logFile, 'utf8');
    } catch {
      return '';
    }
  }

  private env(): NodeJS.ProcessEnv {
    const s = this.sandbox;
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: s.home,
      USERPROFILE: s.home,
      XDG_DATA_HOME: s.data,
      XDG_CONFIG_HOME: s.config,
      XDG_STATE_HOME: s.state,
      MANABI_UPDATE_TEST_ORIGIN: this.options.fakeOrigin,
      PYTHONIOENCODING: 'utf-8',
      ...this.options.env,
    };
    if (this.options.fakeDisk) {
      env.PYTHONPATH = [SITECUSTOMIZE_DIR, process.env.PYTHONPATH]
        .filter(Boolean)
        .join(path.delimiter);
      env.MNW_E2E_FREE_BYTES_FILE = s.freeFile;
    }
    return env;
  }

  /** serve.py を起動して、窓口が答えるまで待つ */
  async launch(): Promise<void> {
    const fd = openSync(this.sandbox.logFile, 'a');
    let proc: ChildProcess;
    try {
      proc = spawn(findPython(), ['-u', '-B', this.serveScript, '--port', String(this.port)], {
        stdio: ['ignore', fd, fd],
        windowsHide: true,
        env: this.env(),
      });
    } finally {
      closeSync(fd);
    }
    this.proc = proc;
    let exited: number | null | undefined;
    proc.once('exit', (code) => {
      exited = code;
    });
    const start = Date.now();
    while (Date.now() - start < 30_000) {
      // 更新の仕組みが動かないとき（supported:false）は、起動できていても試験にならないので失敗にする
      try {
        const s = await this.rawStatus();
        if (s.supported) return;
        throw new Error(`更新の仕組みが動いていません: ${s.reason ?? '?'}`);
      } catch (e) {
        if ((e as Error).message.startsWith('更新の仕組みが')) throw e;
      }
      if (exited !== undefined && exited !== null && exited !== 0) {
        throw new Error(`serve.py が終了しました（終了コード ${exited}）: ${this.log()}`);
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`serve.py の起動を待ちましたが応答がありません: ${this.log()}`);
  }

  private async rawStatus(): Promise<StatusJson> {
    const res = await rawRequest(this.port, 'GET', '/__manabi/update/status', {
      headers: { 'Sec-Fetch-Site': 'same-origin' },
    });
    if (res.status !== 200) throw new Error(`status HTTP ${res.status}`);
    return JSON.parse(res.body.toString('utf8')) as StatusJson;
  }

  /** 窓口の状態（アプリと同じ見出しで GET） */
  status(): Promise<StatusJson> {
    return this.rawStatus();
  }

  /** 窓口へ POST する（アプリと同じ見出し: Origin・Sec-Fetch-Site・JSON・合言葉） */
  async post(
    name: string,
    body: unknown = {},
    options: { token?: string; headers?: Record<string, string> } = {},
  ): Promise<PostResult> {
    const token = options.token ?? (await this.rawStatus()).token;
    const text = JSON.stringify(body);
    const res = await rawRequest(this.port, 'POST', `/__manabi/update/${name}`, {
      headers: {
        'Sec-Fetch-Site': 'same-origin',
        Origin: this.origin,
        'Content-Type': 'application/json',
        'X-Manabi-Token': token,
        'Content-Length': String(Buffer.byteLength(text)),
        ...options.headers,
      },
      body: text,
    });
    return { status: res.status, json: JSON.parse(res.body.toString('utf8') || '{}') };
  }

  /** 条件に合う状態になるまで待つ（起動し直しているあいだの接続の失敗は無視する） */
  async waitStatus(
    predicate: (s: StatusJson) => boolean,
    timeoutMs: number,
    message: string,
  ): Promise<StatusJson> {
    const start = Date.now();
    let last: StatusJson | null = null;
    while (Date.now() - start < timeoutMs) {
      try {
        last = await this.rawStatus();
        if (predicate(last)) return last;
      } catch {
        // 起動し直している
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(
      `${message}（${timeoutMs}ms 待ちました）\n最後の状態: ${JSON.stringify(last?.update)} ${JSON.stringify(last?.check)}\n${this.log()}`,
    );
  }

  /** serve.py（起動し直したあとのものを含む）を全部止める */
  async kill(): Promise<void> {
    const marker = this.sandbox.root;
    try {
      const pid = (await this.rawStatus()).server.pid;
      process.kill(pid);
    } catch {
      // 答えない（止まっている・起動し直している最中）
    }
    if (this.proc && this.proc.exitCode === null && this.proc.signalCode === null) {
      try {
        this.proc.kill();
      } catch {
        // すでに終わっている
      }
    }
    // 起動し直している最中のもの・自己検査の子プロセスも含めて、この置き場を指すプロセスを止める
    killByCommandLine(marker);
    for (let i = 0; i < 50; i++) {
      try {
        await this.rawStatus();
      } catch {
        return; // 答えなくなった
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  /** 止めて、同じポートで起動し直す（設定が残るかを見るため） */
  async restart(): Promise<void> {
    await this.kill();
    await this.launch();
  }

  async stop(): Promise<void> {
    await this.kill();
    releasePort(this.port);
  }
}

/** コマンドラインに marker を含むプロセスを止める（試験の後片付け。PID の使い回しで別のプロセスを止めない） */
function killByCommandLine(marker: string): void {
  try {
    if (process.platform === 'win32') {
      execFileSync(
        'powershell',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          '$m = $env:MNW_KILL_MARK; Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.Contains($m) } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }',
        ],
        {
          env: { ...process.env, MNW_KILL_MARK: marker },
          windowsHide: true,
          timeout: 30_000,
          stdio: 'ignore',
        },
      );
    } else {
      execFileSync('pkill', ['-f', marker], { stdio: 'ignore' });
    }
  } catch {
    // 止めるものが無かった
  }
}

// ---------------------------------------------------------------- 環境一式

export interface UpdateEnv {
  sandbox: Sandbox;
  fake: FakeGitHub;
  serve: InstalledServe;
  /** 例: http://127.0.0.1:4871/ */
  url: string;
  origin: string;
  /** 空きの数を差し替える（null で本物に戻す）。fakeDisk: true で作ったときだけ */
  setFreeBytes(bytes: number | null): Promise<void>;
  close(): Promise<void>;
}

export interface EnvOptions {
  /** 導入されている版（置き場に書く） */
  installed: Release;
  /** 偽の GitHub が配る版 */
  served: { manifestBytes: Buffer; zips: ReadonlyMap<string, Buffer> } | null;
  fakeDisk?: boolean;
  /** serve.py を起動するときに、偽の GitHub を設定してから（配るリリースを入れてから）始める */
  configureFake?: (fake: FakeGitHub) => void;
}

export async function createEnv(options: EnvOptions): Promise<UpdateEnv> {
  const sandbox = await createSandbox();
  const fake = await FakeGitHub.start();
  let serve: InstalledServe | null = null;
  const close = async (): Promise<void> => {
    await serve?.stop().catch(() => undefined);
    await fake.stop().catch(() => undefined);
    await rm(sandbox.root, { recursive: true, force: true, maxRetries: 30, retryDelay: 250 }).catch(
      () => undefined,
    );
  };
  try {
    writeInstalledApp(sandbox.app, options.installed);
    if (options.served) {
      fake.manifest = options.served.manifestBytes;
      for (const [name, data] of options.served.zips) fake.blobs.set(name, data);
    }
    options.configureFake?.(fake);
    serve = await InstalledServe.start(sandbox, {
      fakeOrigin: fake.origin,
      fakeDisk: options.fakeDisk,
    });
  } catch (e) {
    await close();
    throw e;
  }
  const started = serve;
  return {
    sandbox,
    fake,
    serve: started,
    url: started.url,
    origin: started.origin,
    async setFreeBytes(bytes) {
      if (bytes === null) await rm(sandbox.freeFile, { force: true });
      else await writeFile(sandbox.freeFile, String(bytes), 'ascii');
    },
    close,
  };
}
