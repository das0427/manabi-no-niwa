/**
 * おえかきの計測（acceptance.md 3章: 作品50件・はんこ200個の作品で、一覧と編集が操作できる）。
 * 開発PC（Chromium）での数値を記録する。実機（Yoga 720 / Zorin）は未確認。
 * 数値は標準出力と test の注釈（annotations）に出す。上限は「操作できる」ことの目安（緩め）。
 */
import { expect, test, type Page } from '@playwright/test';
import stampsJson from '../src/drawing/stamps.json' with { type: 'json' };
import { activeProfileId, clickUntil, gotoApp, start } from './helpers/app';

test.skip(({ browserName }) => browserName !== 'chromium', '計測は Chromium で行う');
test.setTimeout(240_000);

type PerfWin = {
  __mnwDraw?: {
    engine: {
      doc: { items: unknown[] };
      composeCanvas(w: number): HTMLCanvasElement;
      pick(p: { x: number; y: number }, u: number): unknown;
      fill(p: { x: number; y: number }, color: string): boolean;
      undo(): boolean;
    };
  };
};

const N_ARTS = 50;
const N_STAMPS = 200;

/** 作品50件（各1枚のインクの層＋閲覧用・縮小）と、はんこ200個の作品1件を IndexedDB に入れる */
async function seed(page: Page, profileId: string): Promise<{ bigId: string; bytes: number }> {
  const stamps = stampsJson.stamps.map((s) => ({ key: `${s.id}@${s.version}`, svg: s.svg }));
  return page.evaluate(
    async ({ profileId, stamps, nArts, nStamps }) => {
      const png = async (
        draw: (c: OffscreenCanvasRenderingContext2D, w: number, h: number) => void,
        w: number,
        h: number,
      ) => {
        const c = new OffscreenCanvas(w, h);
        draw(c.getContext('2d')!, w, h);
        return c.convertToBlob({ type: 'image/png' });
      };
      let seedN = 1;
      const rnd = () => (seedN = (seedN * 16807) % 2147483647) / 2147483647;
      const strokes = (ctx: OffscreenCanvasRenderingContext2D, w: number, h: number) => {
        ctx.lineCap = 'round';
        for (let i = 0; i < 40; i++) {
          ctx.strokeStyle = ['#D9433A', '#2F6FC0', '#4E9A3E', '#F2C230'][i % 4]!;
          ctx.lineWidth = 6 + (i % 4) * 8;
          ctx.beginPath();
          ctx.moveTo(rnd() * w, rnd() * h);
          for (let k = 0; k < 6; k++) ctx.lineTo(rnd() * w, rnd() * h);
          ctx.stroke();
        }
      };
      const ink = await png(strokes, 1600, 1000);
      const full = await png(
        (ctx, w, h) => {
          ctx.fillStyle = '#FFFDF8';
          ctx.fillRect(0, 0, w, h);
          strokes(ctx, w, h);
        },
        1600,
        1000,
      );
      const thumb = await png(
        (ctx, w, h) => {
          ctx.fillStyle = '#FFFDF8';
          ctx.fillRect(0, 0, w, h);
          strokes(ctx, w, h);
        },
        320,
        200,
      );
      const db: IDBDatabase = await new Promise((res, rej) => {
        const o = indexedDB.open('manabi-no-niwa');
        o.onsuccess = () => res(o.result);
        o.onerror = () => rej(o.error);
      });
      const put = (arts: unknown[], blobs: unknown[]) =>
        new Promise<void>((res, rej) => {
          const tx = db.transaction(['artworks', 'artworkBlobs'], 'readwrite');
          for (const a of arts) tx.objectStore('artworks').put(a);
          for (const b of blobs) tx.objectStore('artworkBlobs').put(b);
          tx.oncomplete = () => res();
          tx.onerror = () => rej(tx.error);
        });
      const now = Date.now();
      const docBase = {
        version: 2,
        width: 1600,
        height: 1000,
        background: { kind: 'color', color: '#FFFDF8' },
        base: null,
        origin: { kind: 'free' },
      };
      const blobRec = (artId: string, kind: string, blob: Blob) => ({
        key: `${artId}:${kind}`,
        artId,
        profileId,
        kind,
        blob,
      });
      for (let i = 0; i < nArts; i++) {
        const id = `perf-${i}`;
        await put(
          [
            {
              id,
              profileId,
              title: 'おえかき',
              createdAt: now - i * 60000,
              updatedAt: now - i * 60000,
              doc: { ...docBase, items: [{ id: 'L1', kind: 'ink', raster: 'ink:L1' }], assets: {} },
            },
          ],
          [blobRec(id, 'ink:L1', ink), blobRec(id, 'full', full), blobRec(id, 'thumb', thumb)],
        );
      }
      const bigId = 'perf-big';
      const items: unknown[] = [{ id: 'L1', kind: 'ink', raster: 'ink:L1' }];
      const assets: Record<string, string> = {};
      for (let i = 0; i < nStamps; i++) {
        const s = stamps[i % stamps.length]!;
        assets[s.key] = s.svg;
        items.push({
          id: `S${i}`,
          kind: 'stamp',
          asset: s.key,
          x: 60 + (i % 20) * 78,
          y: 80 + Math.floor(i / 20) * 92,
          size: 110 + (i % 3) * 30,
          rotation: (i * 15) % 360,
          flipX: i % 2 === 0,
        });
      }
      await put(
        [
          {
            id: bigId,
            profileId,
            title: 'おえかき',
            createdAt: now + 1,
            updatedAt: now + 1,
            doc: { ...docBase, items, assets },
          },
        ],
        [
          blobRec(bigId, 'ink:L1', ink),
          blobRec(bigId, 'full', full),
          blobRec(bigId, 'thumb', thumb),
        ],
      );
      db.close();
      return { bigId, bytes: ink.size + full.size + thumb.size };
    },
    { profileId, stamps, nArts: N_ARTS, nStamps: N_STAMPS },
  );
}

test('作品50件・はんこ200個: 一覧と編集の時間（開発PC・Chromium）', async ({ page }, info) => {
  const note = (name: string, v: number | string) => {
    info.annotations.push({ type: name, description: String(v) });
    console.log(`[perf] ${name}: ${v}`);
  };
  await gotoApp(page);
  const pid = await activeProfileId(page);
  const { bigId, bytes } = await seed(page, pid);
  note('1作品の画像（ink+full+thumb）のバイト数', bytes);
  await page.reload();
  await expect(page.getByTestId('start-button')).toBeEnabled();
  await start(page);

  // ---- 一覧（51件）
  let t0 = Date.now();
  await page.evaluate(() => (location.hash = '#/gallery'));
  await expect(page.getByTestId('gallery-grid')).toHaveAttribute('data-count', String(N_ARTS + 1), {
    timeout: 30_000,
  });
  const galleryWall = Date.now() - t0;
  const galleryMs = Number(await page.evaluate(() => document.documentElement.dataset.galleryMs));
  note('一覧: 表示まで（壁時計 ms）', galleryWall);
  note('一覧: 読み込み（IndexedDB の一覧＋縮小51枚, ms）', galleryMs);
  // 一番下までスクロールできる
  const scrollMs = await page.evaluate(async () => {
    const g = document.querySelector('[data-testid=gallery-grid]')!;
    const t = performance.now();
    g.scrollTop = g.scrollHeight;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return performance.now() - t;
  });
  note('一覧: 一番下へスクロールして描くまで（ms）', Math.round(scrollMs));
  expect(galleryWall).toBeLessThan(5000);

  // ---- はんこ200個の作品を開く
  t0 = Date.now();
  await clickUntil(
    page,
    page.locator(`[data-testid=gallery-card][data-id=${bigId}] [data-testid=gallery-open]`),
    page.getByTestId('draw-screen'),
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => (window as unknown as PerfWin).__mnwDraw?.engine.doc.items.length ?? 0),
      { timeout: 30_000 },
    )
    .toBe(N_STAMPS + 1);
  const openWall = Date.now() - t0;
  note('編集: はんこ200個の作品を開くまで（壁時計 ms）', openWall);
  expect(openWall).toBeLessThan(8000);

  // ---- 描き直し・当たり判定・塗り（ページの中で計測）
  const m = await page.evaluate(async () => {
    const e = (window as unknown as PerfWin).__mnwDraw!.engine;
    const times = (n: number, f: () => void) => {
      const t = performance.now();
      for (let i = 0; i < n; i++) f();
      return (performance.now() - t) / n;
    };
    const c = document.querySelector<HTMLCanvasElement>('[data-testid=draw-canvas]')!;
    // 描いた結果を読み出して、GPU の処理の終わりまでを含める
    const compose = times(10, () =>
      e.composeCanvas(c.width).getContext('2d')!.getImageData(0, 0, 1, 1),
    );
    const pick = times(50, () => e.pick({ x: 800, y: 500 }, 25));
    const t = performance.now();
    e.fill({ x: 5, y: 995 }, '#2F6FC0');
    const fill = performance.now() - t;
    const t2 = performance.now();
    e.undo();
    const undo = performance.now() - t2;
    return { compose, pick, fill, undo, canvasPx: `${c.width}x${c.height}` };
  });
  note('編集: 表示キャンバス', m.canvasPx);
  note('編集: 全体の描き直し 1回（ms）', m.compose.toFixed(1));
  note('編集: 当たり判定 1回（ms）', m.pick.toFixed(2));
  note('編集: 塗りつぶし 1回（合成の読み取り＋塗り, ms）', m.fill.toFixed(1));
  note('編集: 塗りの undo（ms）', m.undo.toFixed(1));

  // ---- 操作の応答（タップ→選択枠、ドラッグのフレーム間隔）
  await page.getByTestId('tool-select').click();
  const box = (await page.getByTestId('draw-canvas').boundingBox())!;
  const at = (x: number, y: number) =>
    [box.x + (x / 1600) * box.width, box.y + (y / 1000) * box.height] as const;
  const [sx, sy] = at(60 + 10 * 78, 80 + 5 * 92); // S110
  t0 = Date.now();
  await page.mouse.click(sx, sy);
  await expect(page.getByTestId('draw-selection')).toBeVisible();
  note('編集: タップ → 選択枠（壁時計 ms）', Date.now() - t0);
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[] };
    w.__frames = [];
    const loop = (t: number) => {
      w.__frames.push(t);
      if (w.__frames.length < 400) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  const [ex, ey] = at(1200, 800);
  await page.mouse.move(ex, ey, { steps: 40 });
  await page.mouse.up();
  const frames = await page.evaluate(() => (window as unknown as { __frames: number[] }).__frames);
  const gaps = frames.slice(1).map((t, i) => t - frames[i]!);
  gaps.sort((a, b) => a - b);
  note(
    '編集: ドラッグ中のフレーム間隔 中央値（ms）',
    gaps[Math.floor(gaps.length / 2)]!.toFixed(1),
  );
  note(
    '編集: ドラッグ中のフレーム間隔 95%（ms）',
    gaps[Math.floor(gaps.length * 0.95)]!.toFixed(1),
  );
  // はんこをもう1つ押す
  await page.getByTestId('tool-stamp').click();
  await page.getByTestId('panel-ok').click();
  t0 = Date.now();
  const [px, py] = at(800, 950);
  await page.mouse.click(px, py);
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as PerfWin).__mnwDraw!.engine.doc.items.length),
    )
    .toBe(N_STAMPS + 2);
  note('編集: はんこを押す（壁時計 ms）', Date.now() - t0);
  // 自動保存が終わる（はんこ200個の文書と画像）
  t0 = Date.now();
  await expect(page.getByTestId('draw-screen')).toHaveAttribute('data-save-state', 'saved', {
    timeout: 30_000,
  });
  note('保存: 操作から保存済みまで（1.5秒の待ちを含む, ms）', Date.now() - t0);
});
