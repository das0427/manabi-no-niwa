import { expect, test, type Page } from '@playwright/test';
import { activeProfileId, gotoApp, idbGetAll, idbPutMany } from './helpers/app';

/**
 * さくひん（作品の一覧）の一つのスクロール（text-layout-fixes「アプリの画面」A7）。
 * おえかきの作品 18 枚＋なぞり・みち の作品 5 枚で、スクロールの印（小学生の ▼）か札（幼児の ▲▼）があり、
 * 全部の札に届くこと。4 列の札の幅は、右の余白（幼児 7u・小学生 3.6u）の分だけ詰まり、16u 以上を保つこと。
 */
test.skip(({ browserName }) => browserName !== 'chromium', '配置の計測は Chromium で行う');

const SIZES = [
  { w: 1280, h: 720 },
  { w: 1920, h: 1080 },
  { w: 1280, h: 620 },
  { w: 1536, h: 864 },
];
const VIEWERS = [
  { id: 'p4', audience: null as string | null, grade: null as number | null, gutter: 7 },
  { id: 'g3', audience: 'g3', grade: 3, gutter: 3.6 },
];
const N_ARTS = 18;
const N_OLDS = 5;

/** 作品 N_ARTS 枚（縮小画像つき）と、なぞりの作品 N_OLDS 枚を入れる */
async function seed(page: Page, profileId: string): Promise<void> {
  const arts = await page.evaluate(
    async ({ profileId, n }) => {
      const c = new OffscreenCanvas(320, 200);
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#FFFDF8';
      ctx.fillRect(0, 0, 320, 200);
      ctx.strokeStyle = '#2F6FC0';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(20, 30);
      ctx.lineTo(300, 170);
      ctx.stroke();
      const thumb = await c.convertToBlob({ type: 'image/png' });
      const db: IDBDatabase = await new Promise((res, rej) => {
        const o = indexedDB.open('manabi-no-niwa');
        o.onsuccess = () => res(o.result);
        o.onerror = () => rej(o.error);
      });
      const now = Date.now();
      await new Promise<void>((res, rej) => {
        const tx = db.transaction(['artworks', 'artworkBlobs'], 'readwrite');
        for (let i = 0; i < n; i++) {
          const id = `gs-${i}`;
          tx.objectStore('artworks').put({
            id,
            profileId,
            title: 'おえかき',
            createdAt: now - i * 60000,
            updatedAt: now - i * 60000,
            doc: {
              version: 2,
              width: 1600,
              height: 1000,
              background: { kind: 'color', color: '#FFFDF8' },
              base: null,
              origin: { kind: 'free' },
              items: [],
              assets: {},
            },
          });
          tx.objectStore('artworkBlobs').put({
            key: `${id}:thumb`,
            artId: id,
            profileId,
            kind: 'thumb',
            blob: thumb,
          });
        }
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
      return n;
    },
    { profileId, n: N_ARTS },
  );
  expect(arts).toBe(N_ARTS);
  await idbPutMany(
    page,
    'works',
    Array.from({ length: N_OLDS }, (_, i) => ({
      id: `gs-w-${i}`,
      profileId,
      modeId: 'trace',
      kind: 'trace',
      title: 'し',
      createdAt: Date.now() - 1000 * (i + 1),
      data: {},
    })),
  );
}

for (const v of VIEWERS) {
  for (const s of SIZES) {
    test(`さくひん 18枚＋なぞり5枚: ${v.id} ${s.w}x${s.h} で印か札があり、全部の札に届く`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: s.w, height: s.h });
      await gotoApp(page);
      const pid = await activeProfileId(page);
      if (v.audience) {
        const profile = (await idbGetAll<Record<string, unknown>>(page, 'profiles')).find(
          (p) => p.id === pid,
        )!;
        await idbPutMany(page, 'profiles', [
          { ...profile, audience: v.audience, enrolledGrade: v.grade },
        ]);
      }
      await seed(page, pid);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('start-button')).toBeEnabled();
      await page.getByTestId('start-button').click();
      await page.evaluate(() => (location.hash = '#/gallery'));
      await expect(page.getByTestId('gallery-grid')).toHaveAttribute('data-count', String(N_ARTS));
      await expect(page.getByTestId('gallery-card')).toHaveCount(N_ARTS);
      await expect(page.getByTestId('gallery-old')).toHaveCount(N_OLDS);

      const region = page.getByTestId('gallery-scroll');
      await expect(region).toHaveAttribute('data-scroll-region', 'list');
      // 目印（既存の e2e が使う）: 作品の格子は一覧の枠の中にあり、数を持つ
      await expect(region.getByTestId('gallery-grid')).toBeVisible();

      const geo = await page.evaluate(() => {
        const r = (el: Element) => el.getBoundingClientRect();
        const screen = document.querySelector('[data-testid=gallery]')!;
        const sr = r(screen);
        const u = sr.width / 100;
        const reg = document.querySelector('[data-testid=gallery-scroll]') as HTMLElement;
        const rr = r(reg);
        const cards = [
          ...document.querySelectorAll('[data-testid=gallery-card],[data-testid=gallery-old]'),
        ];
        const w = cards.map((c) => r(c).width / u);
        return {
          u,
          stageW: sr.width,
          stageH: sr.height,
          stageTop: sr.top,
          stageLeft: sr.left,
          region: { l: rr.left, r: rr.right, t: rr.top, b: rr.bottom },
          overflow: reg.scrollHeight > reg.clientHeight + 1,
          minW: Math.min(...w),
          maxW: Math.max(...w),
          cardRight: Math.max(...cards.map((c) => r(c).right)),
          cardLeft: Math.min(...cards.map((c) => r(c).left)),
          count: cards.length,
        };
      });
      expect(geo.count).toBe(N_ARTS + N_OLDS);
      // 一覧の枠は舞台の中。下の余白は 2u
      expect(geo.region.b).toBeLessThanOrEqual(geo.stageTop + geo.stageH - geo.u * 2 + 1);
      expect(geo.region.b).toBeGreaterThanOrEqual(geo.stageTop + geo.stageH - geo.u * 2 - 1);
      // 札は 16u 以上、右の余白の手前で止まる（幼児 7u・小学生 3.6u）
      expect(geo.minW).toBeGreaterThanOrEqual(16);
      expect(geo.maxW).toBeLessThanOrEqual(22);
      expect(geo.cardRight - geo.stageLeft).toBeLessThanOrEqual(
        geo.stageW - v.gutter * geo.u - geo.u * 2 + 1,
      );
      expect(geo.cardLeft - geo.stageLeft).toBeGreaterThanOrEqual(geo.u * 2 - 1);
      // 23 枚は 1 画面に入らない
      expect(geo.overflow).toBe(true);

      // 印か札: 上にいるあいだ、小学生は ▼ の印（data-scroll-cue と .scroll-list__cue）、幼児は ▼ の札だけ
      const up = page.getByTestId('gallery-scroll-up');
      const down = page.getByTestId('gallery-scroll-down');
      if (v.audience) {
        await expect(region).toHaveAttribute('data-scroll-cue', '');
        await expect(page.locator('.scroll-list__cue')).toBeVisible();
        await expect(down).toHaveCount(0);
      } else {
        await expect(down).toBeVisible();
        await expect(up).toBeHidden();
      }

      // 全部の札に届く: 下へ動かしながら、枠の中に全体が見えた札を数える
      const seen = new Set<string>();
      const collect = async () => {
        const ids = await page.evaluate(() => {
          const reg = document
            .querySelector('[data-testid=gallery-scroll]')!
            .getBoundingClientRect();
          const out: string[] = [];
          for (const c of document.querySelectorAll(
            '[data-testid=gallery-card],[data-testid=gallery-old]',
          )) {
            const b = c.getBoundingClientRect();
            if (b.top >= reg.top - 1 && b.bottom <= reg.bottom + 1)
              out.push(c.getAttribute('data-id')!);
          }
          return out;
        });
        for (const id of ids) seen.add(id);
      };
      await collect();
      for (let i = 0; i < 20; i++) {
        if (v.audience) {
          // 小学生: 指（ホイール）でのスクロール
          await region.hover();
          await page.mouse.wheel(0, 300);
          await page.waitForTimeout(150);
        } else {
          if (!(await down.isVisible())) break;
          await down.click();
          await page.waitForTimeout(450);
        }
        await collect();
        const atEnd = await region.evaluate(
          (e) => e.scrollTop + e.clientHeight >= e.scrollHeight - 2,
        );
        if (atEnd) break;
      }
      expect(seen.size).toBe(N_ARTS + N_OLDS);

      // 一番下では、小学生の ▼ の印は消え、幼児の ▼ の札は隠れて ▲ の札が出る
      if (v.audience) {
        await expect(region).not.toHaveAttribute('data-scroll-cue', '');
      } else {
        await expect(down).toBeHidden();
        await expect(up).toBeVisible();
        // ▲ の札は舞台の中にあり、右上の「あたらしく かく」とも、札（作品）とも重ならない
        const btn = await page.evaluate(() => {
          const r = (id: string) =>
            document.querySelector(`[data-testid=${id}]`)!.getBoundingClientRect();
          const cards = [
            ...document.querySelectorAll('[data-testid=gallery-card],[data-testid=gallery-old]'),
          ].map((c) => c.getBoundingClientRect());
          const upR = r('gallery-scroll-up');
          const newR = r('gallery-new');
          return {
            stageRight: r('gallery').right,
            upRight: upR.right,
            upTop: upR.top,
            newBottom: newR.bottom,
            cardMaxRight: Math.max(...cards.map((c) => c.right)),
            upLeft: upR.left,
          };
        });
        expect(btn.upTop).toBeGreaterThan(btn.newBottom);
        expect(btn.upRight).toBeLessThanOrEqual(btn.stageRight);
        expect(btn.cardMaxRight).toBeLessThan(btn.upLeft);
        // ▲ で戻れる
        const end = await region.evaluate((e) => e.scrollTop);
        await up.click();
        await expect.poll(() => region.evaluate((e) => e.scrollTop)).toBeLessThan(end);
      }
    });
  }
}
