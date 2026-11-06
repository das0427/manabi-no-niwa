import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { MANIFEST_NAME } from '../../scripts/release-lib.ts';
import { listenInRange } from './ports.ts';

/**
 * 偽の GitHub（更新の通し試験用。docs/expansion/updater-design.md 11.3 節）。
 * 127.0.0.1 の 4800〜4999 の空きポートで、版の情報の JSON と zip を配る。github.com と同じく、
 * `releases/latest/download/<名前>` と `releases/download/<tag>/<名前>` は 302 で配布用の場所へ転送する
 * （転送は hops 回。本番の許可リストの代わりに、serve.py は試験用の origin だけを許可する）。
 * Range（206）・接続の切断・壊れた中身・遅い配信・許可外のホストへの転送・任意の状態を再現でき、
 * 来た要求を全部 log に残す（User-Agent・Cookie・Range・書いたバイト数）。
 *
 * 配る場所:
 *   /das0427/manabi-no-niwa/releases/latest/download/manabi-no-niwa-update.json  → 302 → /hop1/manifest → … → /blob/manifest
 *   /das0427/manabi-no-niwa/releases/download/<tag>/<zip 名>                      → 302 → /hop1/<zip 名> → … → /blob/<zip 名>
 */

export const REPO_PATH = '/das0427/manabi-no-niwa/releases';
export const MANIFEST_PATH = `${REPO_PATH}/latest/download/${MANIFEST_NAME}`;
/** blob の名前（版の情報は zip の名前と重ならないよう、この名前で配る） */
const MANIFEST_BLOB = 'manifest';

/** 配るリリース（release-fixture.ts の Release が満たす形） */
export interface ServedRelease {
  version: string;
  manifestBytes: Buffer;
  zips: ReadonlyMap<string, Buffer>;
}

export interface RequestLog {
  method: string;
  /** クエリを含むパス */
  path: string;
  range: string | null;
  ua: string | null;
  cookie: string | null;
  authorization: string | null;
  /** 返した HTTP の状態 */
  status: number;
  /** 本文として書いたバイト数 */
  sent: number;
}

export interface Throttle {
  /** 1 回に書くバイト数 */
  chunk: number;
  /** 書くたびに待つ時間（ミリ秒） */
  delayMs: number;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class FakeGitHub {
  readonly log: RequestLog[] = [];
  /** 版の情報（null なら 404 = 最新のリリースに版の情報が無い） */
  manifest: Buffer | null = null;
  /** zip の名前 → 中身 */
  readonly blobs = new Map<string, Buffer>();
  /** 転送の回数（github.com → 配布用ホストの形をまねる） */
  hops = 2;
  supportRange = true;
  /** 版の情報の最初の転送先を差し替える（許可されていないホストへ行かせる） */
  redirectManifestTo: string | null = null;
  /** zip の最初の転送先を差し替える（許可されていないホストへ行かせる） */
  redirectDownloadsTo: string | null = null;
  /** パス（クエリなし）→ 返す状態 */
  readonly forceStatus = new Map<string, number>();
  /** zip の名前 → 残り回数。その回数だけ、先頭 1 バイトを変えた中身を返す（Infinity なら、ずっと） */
  readonly corrupt = new Map<string, number>();
  /** zip の名前 → 本文を after バイト書いたところで接続を切る回数（Range の続きにも同じ数え方） */
  readonly cut = new Map<string, { after: number; times: number }>();
  /** zip の名前 → 本文を after バイト書いたところで止まる回数（接続は開いたまま。release() か、相手が切れるまで） */
  readonly stall = new Map<string, { after: number; times: number }>();
  throttle: Throttle | null = null;
  private readonly waiters = new Set<() => void>();

  readonly port: number;
  readonly origin: string;
  private readonly server: http.Server;

  private constructor(server: http.Server, port: number) {
    this.server = server;
    this.port = port;
    this.origin = `http://127.0.0.1:${port}`;
  }

  static async start(): Promise<FakeGitHub> {
    let self: FakeGitHub | null = null;
    const server = http.createServer((req, res) => {
      void self!.handle(req, res);
    });
    const port = await listenInRange(server);
    self = new FakeGitHub(server, port);
    return self;
  }

  /** 止めている応答をすべて再開する（その応答は、そこで接続を閉じる） */
  release(): void {
    for (const resume of [...this.waiters]) resume();
  }

  async stop(): Promise<void> {
    this.release();
    this.server.closeAllConnections();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  /** 配るリリースを入れ替える */
  setRelease(release: ServedRelease): void {
    this.manifest = release.manifestBytes;
    this.blobs.clear();
    for (const [name, data] of release.zips) this.blobs.set(name, data);
  }

  /** 名前（zip や版の情報）で終わる要求 */
  requestsFor(name: string): RequestLog[] {
    return this.log.filter((r) => r.path.split('?')[0]!.endsWith(`/${name}`));
  }

  /** 実際に中身を配った要求（転送の途中は含まない） */
  blobRequestsFor(name: string): RequestLog[] {
    return this.log.filter((r) => r.path.split('?')[0] === `/blob/${name}`);
  }

  /** その zip の中身として、のべ何バイト配ったか */
  bytesSentFor(name: string): number {
    return this.blobRequestsFor(name).reduce((sum, r) => sum + r.sent, 0);
  }

  manifestRequests(): RequestLog[] {
    return this.log.filter((r) => r.path.split('?')[0] === MANIFEST_PATH);
  }

  private reply(
    res: ServerResponse,
    entry: RequestLog,
    status: number,
    headers: Record<string, string | number> = {},
  ): void {
    entry.status = status;
    res.writeHead(status, { 'Content-Length': 0, ...headers });
    res.end();
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url ?? '/';
    const pathOnly = url.split('?')[0]!;
    const entry: RequestLog = {
      method: req.method ?? 'GET',
      path: url,
      range: typeof req.headers.range === 'string' ? req.headers.range : null,
      ua: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
      cookie: typeof req.headers.cookie === 'string' ? req.headers.cookie : null,
      authorization:
        typeof req.headers.authorization === 'string' ? req.headers.authorization : null,
      status: 0,
      sent: 0,
    };
    this.log.push(entry);
    try {
      const forced = this.forceStatus.get(pathOnly);
      if (forced !== undefined) return this.reply(res, entry, forced);

      const downloadPrefix = `${REPO_PATH}/download/`;
      if (pathOnly === MANIFEST_PATH || pathOnly.startsWith(downloadPrefix)) {
        const name = pathOnly === MANIFEST_PATH ? MANIFEST_BLOB : pathOnly.split('/').pop()!;
        if (name === MANIFEST_BLOB && this.manifest === null) return this.reply(res, entry, 404);
        const override =
          name === MANIFEST_BLOB ? this.redirectManifestTo : this.redirectDownloadsTo;
        return this.reply(res, entry, 302, {
          Location: override ?? (this.hops > 0 ? `/hop1/${name}` : `/blob/${name}`),
        });
      }
      const hop = /^\/hop(\d+)\/([^/]+)$/.exec(pathOnly);
      if (hop) {
        const n = Number(hop[1]);
        const name = hop[2]!;
        return this.reply(res, entry, 302, {
          Location: n < this.hops ? `/hop${n + 1}/${name}` : `/blob/${name}`,
        });
      }
      const blob = /^\/blob\/([^/]+)$/.exec(pathOnly);
      if (blob) return await this.sendBlob(req, res, entry, blob[1]!);
      return this.reply(res, entry, 404);
    } catch {
      res.destroy();
    }
  }

  private async sendBlob(
    req: IncomingMessage,
    res: ServerResponse,
    entry: RequestLog,
    name: string,
  ): Promise<void> {
    let body = name === MANIFEST_BLOB ? this.manifest : (this.blobs.get(name) ?? null);
    if (body === null) return this.reply(res, entry, 404);
    const corruptLeft = this.corrupt.get(name) ?? 0;
    if (corruptLeft > 0) {
      body = Buffer.from(body);
      body[0] = body[0]! ^ 0xff;
      if (corruptLeft !== Infinity) this.corrupt.set(name, corruptLeft - 1);
    }
    let start = 0;
    let status = 200;
    const headers: Record<string, string | number> = {
      'Content-Type': name === MANIFEST_BLOB ? 'application/json' : 'application/octet-stream',
    };
    const m = this.supportRange ? /^bytes=(\d+)-$/.exec(entry.range ?? '') : null;
    if (m) {
      start = Number(m[1]);
      if (start >= body.length) {
        return this.reply(res, entry, 416, { 'Content-Range': `bytes */${body.length}` });
      }
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${body.length - 1}/${body.length}`;
    }
    const chunk = body.subarray(start);
    headers['Content-Length'] = chunk.length;
    entry.status = status;
    res.writeHead(status, headers);

    let limit = chunk.length;
    const cut = this.cut.get(name);
    const cutNow = cut !== undefined && cut.times > 0 && cut.after < chunk.length;
    if (cutNow) {
      cut.times -= 1;
      limit = cut.after;
    }
    const stall = this.stall.get(name);
    const stallNow =
      !cutNow && stall !== undefined && stall.times > 0 && stall.after < chunk.length;
    if (stallNow) {
      stall.times -= 1;
      limit = stall.after;
    }
    const piece = this.throttle?.chunk ?? 1 << 20;
    for (let at = 0; at < limit; at += piece) {
      if (res.destroyed) return;
      const part = chunk.subarray(at, Math.min(limit, at + piece));
      await new Promise<void>((resolve) => res.write(part, () => resolve()));
      entry.sent += part.length;
      if (this.throttle && this.throttle.delayMs > 0) await sleep(this.throttle.delayMs);
    }
    if (stallNow) {
      // 本文が足りないまま止まる（相手の電源が切れた・回線が詰まった形）。相手が切れるか release() で再開する
      await new Promise<void>((resolve) => {
        const resume = (): void => {
          this.waiters.delete(resume);
          resolve();
        };
        this.waiters.add(resume);
        res.once('close', resume);
      });
    }
    if (cutNow || stallNow) {
      // 本文が足りないまま接続を閉じる（ネットが切れた形）
      res.socket?.destroy();
      return;
    }
    res.end();
  }
}

/** 全体を約 ms ミリ秒かけて配る Throttle（進み具合の表示を見るため。1 回に書く大きさは 64KiB 以上） */
export function throttleOver(totalBytes: number, ms: number, ticks = 30): Throttle {
  const chunk = Math.max(64 * 1024, Math.ceil(totalBytes / ticks));
  return {
    chunk,
    delayMs: Math.max(1, Math.round(ms / Math.max(1, Math.ceil(totalBytes / chunk)))),
  };
}
