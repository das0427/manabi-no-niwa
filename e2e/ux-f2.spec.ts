/**
 * 使いやすさの直し（F2 幼児の入口と数字キー）の操作の流れ。
 *  - FX02: 札・遊び方の名前の声が、鳴り始める前に止められない（AudioBufferSourceNode.start の記録で見る）。
 *  - FX16: 保存に問題があるとき、幼児ホームに v1 のホームと同じ「!」が鍵の左に出る。
 *  - FX05: 共有の数字キーが 4 つの画面サイズで 6u 以上、作業領域に収まる（スクロールの枠・はみ出しなし）。
 */
import { expect, test, type Page } from '@playwright/test';
import { activeProfileId, clickUntil, gotoApp, idbGetAll, idbPutMany, start } from './helpers/app';

// ---------------------------------------------------------------- FX02: 声

/** 鳴り始めた声のキー（mp3 の名前）を window.__voices に残す。音は鳴らさず、再生の記録だけ取る */
async function recordVoices(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __voices: string[] };
    w.__voices = [];
    const abKey = new WeakMap<object, string>();
    const bufKey = new WeakMap<object, string>();
    const of = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const res = await of(input, init);
      if (/\/audio\//.test(url)) {
        const key = decodeURIComponent(url.replace(/^.*\/audio\//, '').replace(/\.mp3.*$/, ''));
        const oab = res.arrayBuffer.bind(res);
        res.arrayBuffer = async () => {
          const ab = await oab();
          abKey.set(ab, key);
          return ab;
        };
      }
      return res;
    };
    const BAC = window.BaseAudioContext;
    const odec = BAC.prototype.decodeAudioData;
    BAC.prototype.decodeAudioData = function (this: BaseAudioContext, ab: ArrayBuffer) {
      const key = abKey.get(ab);
      return odec.call(this, ab).then((buf: AudioBuffer) => {
        if (key) bufKey.set(buf, key);
        return buf;
      });
    } as typeof odec;
    const S = AudioBufferSourceNode.prototype;
    const ostart = S.start;
    S.start = function (this: AudioBufferSourceNode, ...a: [number?, number?, number?]) {
      w.__voices.push(this.buffer ? (bufKey.get(this.buffer) ?? '?') : '?');
      return ostart.apply(this, a);
    };
  });
}

const voices = (page: Page) =>
  page.evaluate(() => (window as unknown as { __voices: string[] }).__voices);

test.describe('FX02: 札・遊び方の名前の声', () => {
  test('4歳のホームの札（おかいもの ごっこ）を押すと、名前の声が鳴り始める', async ({ page }) => {
    await recordVoices(page);
    await gotoApp(page);
    await start(page);
    // 遷移は直前の遷移から 400ms 以内だと無視される（OP-05）。ホームに入った直後を避ける
    await page.waitForTimeout(600);
    await page.getByTestId('home-mode-shopping').click();
    // 前は、ここで鳴らした声が navigate の audio.stop で止まり、一度も鳴り始めなかった
    await expect.poll(() => voices(page), { timeout: 10_000 }).toContain('title.shopping');
  });

  test('4歳の さんすう →（選ぶ画面）→ たす: 遊び方の名前の声が鳴り始める', async ({ page }) => {
    await recordVoices(page);
    await gotoApp(page);
    await start(page);
    await clickUntil(
      page,
      page.getByTestId('home-mode-math'),
      page.getByTestId('card-chooser-math'),
    );
    await expect.poll(() => voices(page), { timeout: 10_000 }).toContain('title.math');
    await clickUntil(
      page,
      page.getByTestId('card-unit-p4.math.classic'),
      page.getByTestId('variant-picker'),
    );
    // 遊び方を選ぶ画面を開いただけでは、遊び方の名前の声は鳴らない
    expect(await voices(page)).not.toContain('math.variant.add');
    await page.waitForTimeout(600);
    await page.getByTestId('variant-add').click();
    await expect.poll(() => voices(page), { timeout: 10_000 }).toContain('math.variant.add');
  });
});

// ---------------------------------------------------------------- FX16: 「!」

/** 1u（舞台の幅の 1/100。--u0）の px */
const u0 = (page: Page) =>
  page.evaluate(() => {
    const p = document.createElement('div');
    p.style.cssText = 'position:absolute;visibility:hidden;width:var(--u0)';
    document.querySelector('.screen')!.appendChild(p);
    const x = p.getBoundingClientRect().width;
    p.remove();
    return x;
  });

test.describe('FX16: 保存の問題の「!」', () => {
  for (const [w, h] of [
    [1280, 620],
    [1920, 1080],
  ] as const) {
    test(`${w}x${h}: 幼児ホームに「!」が出る。鍵の左、ほかの がくねん の右。直前までは出ない`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: w, height: h });
      await gotoApp(page);
      // 保存の読み書きを失敗させられるようにする（容量不足の例外。印が出る場面を作るためのテスト専用の差し込み）
      await page.evaluate(() => {
        const w = window as unknown as { __failDb: boolean };
        w.__failDb = false;
        const orig = IDBDatabase.prototype.transaction;
        IDBDatabase.prototype.transaction = function (
          this: IDBDatabase,
          ...a: Parameters<IDBDatabase['transaction']>
        ) {
          if (w.__failDb) throw new DOMException('quota', 'QuotaExceededError');
          return orig.apply(this, a);
        } as typeof orig;
      });
      await start(page);
      await expect(page.getByTestId('home')).toHaveAttribute('data-stage', 'p4');
      await expect(page.getByTestId('home-health')).toHaveCount(0);

      // ほかの がくねん を開いて戻る（ホームを開き直すとき、記録の読み込みが失敗して印が出る）
      await page.evaluate(() => {
        (window as unknown as { __failDb: boolean }).__failDb = true;
      });
      await clickUntil(page, page.getByTestId('home-explore'), page.getByTestId('explore'));
      await clickUntil(page, page.getByTestId('home-button'), page.getByTestId('home'));
      const mark = page.getByTestId('home-health');
      await expect(mark).toBeVisible();
      await expect(mark).toHaveAttribute('role', 'img');
      await expect(mark).toHaveText('!');

      const unit = await u0(page);
      const m = (await mark.boundingBox())!;
      const key = (await page.getByTestId('parent-key').boundingBox())!;
      const explore = (await page.getByTestId('home-explore').boundingBox())!;
      const top = (await page.locator('.home-top').boundingBox())!;
      // 大きさ 3u × 3u（v1 のホームの「!」と同じ）
      expect(m.width / unit).toBeCloseTo(3, 1);
      expect(m.height / unit).toBeCloseTo(3, 1);
      // 並び: ほかの がくねん → ! → 鍵（鍵との間は 0.8u。ほかの がくねん との間は 3u 以上）
      expect(key.x - (m.x + m.width)).toBeGreaterThan(0.6 * unit);
      expect(key.x - (m.x + m.width)).toBeLessThan(1.0 * unit);
      expect(m.x - (explore.x + explore.width)).toBeGreaterThanOrEqual(2.9 * unit);
      // 上の帯の中、縦は鍵とほぼ同じ高さの中心
      expect(m.y).toBeGreaterThanOrEqual(top.y - 1);
      expect(m.y + m.height).toBeLessThanOrEqual(top.y + top.height + 1);
      expect(Math.abs(m.y + m.height / 2 - (key.y + key.height / 2))).toBeLessThan(0.6 * unit);
      // 押せる物ではない（押しても画面は変わらない）
      await mark.click({ force: true });
      await expect(page.getByTestId('home')).toBeVisible();
    });
  }
});

// ---------------------------------------------------------------- FX05: 数字キー

const SIZES: [number, number][] = [
  [1280, 620],
  [1280, 720],
  [1536, 864],
  [1920, 1080],
];

/** 小学生（3年）にして、単元を開き、数字キーが出る問題まで進める */
async function openNumpadUnit(page: Page, unitId: string): Promise<void> {
  await gotoApp(page);
  const pid = await activeProfileId(page);
  const profile = (await idbGetAll<Record<string, unknown>>(page, 'profiles')).find(
    (p) => p.id === pid,
  )!;
  await idbPutMany(page, 'profiles', [{ ...profile, audience: 'g3', enrolledGrade: 3 }]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('start-button')).toBeEnabled();
  await clickUntil(page, page.getByTestId('start-button'), page.getByTestId('school-home'));
  await page.evaluate((h) => (location.hash = h), `#/unit/${unitId}`);
  const key = page.getByTestId('key-7');
  await expect(async () => {
    const next = page.getByTestId('intro-next');
    if (await next.isVisible()) await next.click();
    await expect(key).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 45_000, intervals: [300, 500, 800] });
  await page.waitForTimeout(500);
}

for (const unitId of ['g3.math.bar-graph', 'g2.math.length']) {
  for (const [w, h] of SIZES) {
    test(`${unitId} ${w}x${h}: 数字キーは 6u 以上で、作業領域に収まる`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await openNumpadUnit(page, unitId);
      const r = await page.evaluate(() => {
        const p = document.createElement('div');
        p.style.cssText = 'position:absolute;visibility:hidden;width:var(--u0)';
        document.querySelector('.screen')!.appendChild(p);
        const u = p.getBoundingClientRect().width;
        p.remove();
        const work = document.querySelector('.unit__work') as HTMLElement;
        const wr = work.getBoundingClientRect();
        const keys = [...document.querySelectorAll('.mnp-key')].map((k) => {
          const b = k.getBoundingClientRect();
          return {
            id: k.getAttribute('data-testid'),
            w: b.width / u,
            h: b.height / u,
            bottom: b.bottom,
          };
        });
        return {
          keys,
          scrollRegion: work.getAttribute('data-scroll-region'),
          // キーの下端が作業領域の下端を 0.5u（スクロールの枠にしない許容）より超えない
          over: Math.max(...keys.map((k) => k.bottom - wr.bottom)) / u,
          hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
      expect(r.keys.length).toBeGreaterThanOrEqual(12);
      // 主操作の寸法（規約 6u）。前は fit（0.87〜）で 5.2〜5.6u に縮んでいた
      for (const k of r.keys) {
        expect(k.w, `${k.id} の幅`).toBeGreaterThanOrEqual(5.99);
        expect(k.h, `${k.id} の高さ`).toBeGreaterThanOrEqual(5.99);
      }
      expect(r.scrollRegion).toBeNull();
      expect(r.over).toBeLessThanOrEqual(0.5);
      expect(r.hscroll).toBe(false);
    });
  }
}
