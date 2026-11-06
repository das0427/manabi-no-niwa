import net from 'node:net';

/**
 * 更新の通し試験（e2e/update.spec.ts）で使うポート。試験のサーバーは 127.0.0.1 の 4800〜4999 の
 * 空きポートだけを使う（8765・4299 など、ほかの用途のポートは使わない）。
 */
export const PORT_LOW = 4800;
export const PORT_HIGH = 4999;

/** このワーカーが、いま使っているポート（同じ範囲を何度も試さないため。取り合いは bind の失敗で見分ける） */
const taken = new Set<number>();

/** 範囲の中の空きポートで listen する（先頭はばらけさせる）。使ったポートを返す */
export async function listenInRange(server: net.Server): Promise<number> {
  const span = PORT_HIGH - PORT_LOW + 1;
  const first = Math.floor(Math.random() * span);
  for (let i = 0; i < span; i++) {
    const port = PORT_LOW + ((first + i) % span);
    if (taken.has(port)) continue;
    const ok = await new Promise<boolean>((resolve) => {
      const onError = (): void => resolve(false);
      server.once('error', onError);
      server.listen(port, '127.0.0.1', () => {
        server.off('error', onError);
        resolve(true);
      });
    });
    if (ok) {
      taken.add(port);
      server.once('close', () => taken.delete(port));
      return port;
    }
  }
  throw new Error(`${PORT_LOW}〜${PORT_HIGH} に空きポートがありません`);
}

/**
 * 外のプロセス（serve.py）に渡すための空きポートを選ぶ。いったん listen して閉じるので、
 * 渡すまでのあいだに取られることがある（serve.py が終了コード 3 で終わったら選び直す）。
 */
export async function pickFreePort(): Promise<number> {
  const probe = net.createServer();
  const port = await listenInRange(probe);
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  taken.add(port); // 渡した先で使い終わるまで、このワーカーでは選び直さない
  return port;
}

/** pickFreePort で選んだポートを、使い終わったので返す */
export function releasePort(port: number): void {
  taken.delete(port);
}
