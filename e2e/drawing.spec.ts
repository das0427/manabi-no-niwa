/**
 * おえかきの受入条件（docs/expansion/acceptance.md 3章、review-1 で足した項目）。
 * - 指（タッチ模擬は Chromium の CDP だけ）とマウスで線・消しゴム・塗りつぶし
 * - はんこ・図形・重なり・選択・undo/redo・保存と再編集・中断からの復元・画面サイズ変更・PNG 書き出し・2タブ
 * 画素の確認は、テスト用フラグ（mnw:test）のときだけ公開される window.__mnwDraw の合成（論理座標）で行う。
 */
import { expect, test, type Page } from '@playwright/test';
import { defaultSupport } from '../src/audience/audience';
import { boot, clickUntil, gotoApp, prepare, start } from './helpers/app';

type RGBA = [number, number, number, number];
type ItemRow = {
  id: string;
  kind: string;
  x?: number;
  y?: number;
  size?: number;
  rotation?: number;
  flipX?: boolean;
  w?: number;
  shape?: string;
  fill?: string | null;
};

const PAPER: RGBA = [255, 253, 248, 255];

async function openDraw(page: Page, mode: 'simple' | 'detailed' = 'simple'): Promise<void> {
  await gotoApp(page);
  await prepare(page, { settings: { support: { ...defaultSupport('p4'), drawingTools: mode } } });
  await start(page);
  await gotoDraw(page);
}

async function gotoDraw(page: Page, hash = '#/draw'): Promise<void> {
  await page.evaluate((h) => (location.hash = h), hash);
  await expect(page.getByTestId('draw-screen')).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!window.__mnwDraw)).toBe(true);
}

/** 論理座標（1600×1000）→ 画面の座標 */
async function toScreen(page: Page, x: number, y: number): Promise<[number, number]> {
  const b = (await page.getByTestId('draw-canvas').boundingBox())!;
  return [b.x + (x / 1600) * b.width, b.y + (y / 1000) * b.height];
}

async function mouseLine(page: Page, pts: [number, number][], steps = 8): Promise<void> {
  const s = await Promise.all(pts.map(([x, y]) => toScreen(page, x, y)));
  await page.mouse.move(s[0]![0], s[0]![1]);
  await page.mouse.down();
  for (const p of s.slice(1)) await page.mouse.move(p[0], p[1], { steps });
  await page.mouse.up();
}

async function tapAt(page: Page, x: number, y: number): Promise<void> {
  const [sx, sy] = await toScreen(page, x, y);
  await page.mouse.click(sx, sy);
}

function sample(page: Page, x: number, y: number): Promise<RGBA> {
  return page.evaluate(([px, py]) => window.__mnwDraw!.engine.sample(px!, py!), [x, y]);
}

function items(page: Page): Promise<ItemRow[]> {
  return page.evaluate(
    () => JSON.parse(JSON.stringify(window.__mnwDraw!.engine.doc.items)) as ItemRow[],
  );
}

const near = (a: RGBA, b: RGBA, tol = 24) => a.every((v, i) => Math.abs(v - b[i]!) <= tol);
const isPaper = (c: RGBA) => near(c, PAPER, 6);

async function tool(page: Page, id: string): Promise<void> {
  await page.getByTestId(`tool-${id}`).click();
}

async function chooseStamp(page: Page, category: string, id: string): Promise<void> {
  await tool(page, 'stamp');
  await expect(page.getByTestId('stamp-panel')).toBeVisible();
  await page.getByTestId(`stamp-tab-${category}`).click();
  await page.getByTestId(`stamp-${id}`).click();
  await page.getByTestId('panel-ok').click();
  await expect(page.getByTestId('stamp-panel')).toBeHidden();
}

async function waitSaved(page: Page): Promise<void> {
  await expect(page.getByTestId('draw-screen')).toHaveAttribute('data-save-state', 'saved', {
    timeout: 10_000,
  });
}

const RED: RGBA = [0xd9, 0x43, 0x3a, 255];
const BLUE: RGBA = [0x2f, 0x6f, 0xc0, 255];
const YELLOW: RGBA = [0xf2, 0xc2, 0x30, 255];

test.describe('おえかき（マウス）', () => {
  test('ペン: 細い／太い／速い線、キャンバスの端、色', async ({ page }) => {
    await openDraw(page);
    await expect(page.getByTestId('draw-state')).toContainText('かく');
    // 細い線（赤）
    await page.getByTestId('width-0').click();
    await mouseLine(page, [
      [200, 200],
      [600, 200],
    ]);
    expect(near(await sample(page, 400, 200), RED)).toBe(true);
    expect(isPaper(await sample(page, 400, 215))).toBe(true);
    // 太い線（青）
    await page.getByTestId('color-blue').click();
    await page.getByTestId('width-2').click();
    await mouseLine(page, [
      [200, 400],
      [600, 400],
    ]);
    expect(near(await sample(page, 400, 412), BLUE)).toBe(true);
    // 速い線（間の点が少なくても途切れない）
    await mouseLine(
      page,
      [
        [100, 700],
        [1500, 900],
      ],
      1,
    );
    expect(near(await sample(page, 800, 800), BLUE)).toBe(true);
    // 端まで（キャンバスの外へ出ても端まで描ける）
    await page.getByTestId('width-1').click();
    const [x0, y0] = await toScreen(page, 1400, 100);
    const [x1, y1] = await toScreen(page, 1700, 100);
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    await page.mouse.move(x1, y1, { steps: 10 });
    await page.mouse.up();
    expect(near(await sample(page, 1598, 100), BLUE)).toBe(true);
    // 線を描き始めたときに一番上がインクの層なら、同じ層へ描く
    expect((await items(page)).map((i) => i.kind)).toEqual(['ink']);
  });

  test('消しゴム: 線を消す。かんたん では触れた はんこ をそのまま消す（undo で戻る）', async ({
    page,
  }) => {
    await openDraw(page);
    await page.getByTestId('width-2').click();
    await mouseLine(page, [
      [200, 300],
      [1400, 300],
    ]);
    await chooseStamp(page, 'food', 'apple');
    await tapAt(page, 800, 700);
    expect((await items(page)).map((i) => i.kind)).toEqual(['ink', 'stamp']);
    await tool(page, 'eraser');
    await expect(page.getByTestId('draw-state')).toContainText('けす');
    await page.getByTestId('width-2').click();
    await mouseLine(page, [
      [700, 250],
      [700, 350],
    ]);
    expect(isPaper(await sample(page, 700, 300))).toBe(true);
    expect(near(await sample(page, 400, 300), RED)).toBe(true);
    // はんこに触れる → 消える
    await mouseLine(page, [
      [790, 690],
      [810, 710],
    ]);
    expect((await items(page)).map((i) => i.kind)).toEqual(['ink']);
    // もどす: はんこが戻る
    await tool(page, 'undo');
    expect((await items(page)).map((i) => i.kind)).toEqual(['ink', 'stamp']);
  });

  test('消しゴム: くわしく では触れた物を選び「けす」札を出す', async ({ page }) => {
    await openDraw(page, 'detailed');
    await chooseStamp(page, 'food', 'apple');
    await tapAt(page, 800, 500);
    await tool(page, 'eraser');
    await mouseLine(page, [
      [790, 490],
      [810, 510],
    ]);
    expect((await items(page)).map((i) => i.kind)).toEqual(['stamp']);
    await expect(page.getByTestId('draw-selection')).toBeVisible();
    await page.getByTestId('act-delete').click();
    expect(await items(page)).toEqual([]);
  });

  test('塗りつぶし: 閉じた形の中（図形の中を塗っても外へ流れない・すき間なし）', async ({
    page,
  }) => {
    await openDraw(page);
    // 輪郭だけの丸（既定: 赤・ふつうの太さ 14）
    await tool(page, 'shape');
    await page.getByTestId('shape-circle').click();
    await page.getByTestId('shape-outline').click();
    await page.getByTestId('panel-ok').click();
    await tapAt(page, 800, 500);
    expect((await items(page)).map((i) => i.kind)).toEqual(['shape']);
    // 図形の中を青で塗る
    await tool(page, 'fill');
    await expect(page.getByTestId('draw-state')).toContainText('ぬる');
    await page.getByTestId('color-blue').click();
    await tapAt(page, 800, 500);
    expect(near(await sample(page, 800, 500), BLUE)).toBe(true);
    // 線のすぐ内側（半径 120 - 線の半分 7 - 1）まで塗れている
    expect(near(await sample(page, 800 + 112, 500), BLUE, 40)).toBe(true);
    // 外へは流れない
    expect(isPaper(await sample(page, 800 + 140, 500))).toBe(true);
    expect(isPaper(await sample(page, 100, 100))).toBe(true);
    // 塗りは新しいインクの層（図形の上）に入る
    expect((await items(page)).map((i) => i.kind)).toEqual(['shape', 'ink']);
    // 線で閉じた形の中も塗れる
    await tool(page, 'pen');
    await page.getByTestId('color-black').click();
    await mouseLine(page, [
      [100, 100],
      [400, 100],
      [400, 300],
      [100, 300],
      [100, 100],
    ]);
    await tool(page, 'fill');
    await page.getByTestId('color-yellow').click();
    await tapAt(page, 250, 200);
    expect(near(await sample(page, 250, 200), YELLOW)).toBe(true);
    expect(isPaper(await sample(page, 450, 200))).toBe(true);
  });

  test('重なり: 線 → はんこ → 線 の見た目の順序（後から描いたものが上）', async ({ page }) => {
    await openDraw(page);
    await page.getByTestId('color-blue').click();
    await page.getByTestId('width-2').click();
    await mouseLine(page, [
      [500, 500],
      [1100, 500],
    ]);
    await chooseStamp(page, 'food', 'apple');
    await page.getByTestId('side-stamp-size-2').click();
    await tapAt(page, 800, 520);
    await tool(page, 'pen');
    await page.getByTestId('color-yellow').click();
    await mouseLine(page, [
      [800, 300],
      [800, 700],
    ]);
    // はんこの下に1本目の線（青）は見えない。2本目（黄）は はんこの上
    const under = await sample(page, 740, 500);
    expect(near(under, BLUE)).toBe(false);
    expect(near(await sample(page, 800, 500), YELLOW)).toBe(true);
    expect(near(await sample(page, 550, 500), BLUE)).toBe(true);
    expect((await items(page)).map((i) => i.kind)).toEqual(['ink', 'stamp', 'ink']);
  });

  test('はんこ: 選ぶ→見本と大きさ→タップで配置→連続→押す前の反転・回転・大きさ→配置後の編集', async ({
    page,
  }) => {
    await openDraw(page);
    await tool(page, 'stamp');
    await expect(page.getByTestId('stamp-panel')).toBeVisible();
    // 選んだだけでは置かない
    await page.getByTestId('stamp-tab-animal').click();
    await page.getByTestId('stamp-cat').click();
    expect(await items(page)).toEqual([]);
    // 見本と大きさ（hover なしで見える）
    await page.getByTestId('stamp-size-2').click();
    await expect(
      page.getByTestId('stamp-panel').getByTestId('stamp-preview').locator('img'),
    ).toHaveAttribute('data-size', '2');
    await page.getByTestId('stamp-flip').click();
    await page.getByTestId('stamp-rotate').click();
    await expect(
      page.getByTestId('stamp-panel').getByTestId('stamp-preview').locator('img'),
    ).toHaveAttribute('data-flip', '1');
    await expect(
      page.getByTestId('stamp-panel').getByTestId('stamp-preview').locator('img'),
    ).toHaveAttribute('data-rotation', '45');
    await page.getByTestId('panel-ok').click();
    await expect(page.getByTestId('draw-state')).toContainText('おす');
    // 連続で押す
    await tapAt(page, 300, 300);
    await tapAt(page, 700, 300);
    await tapAt(page, 1100, 300);
    let list = await items(page);
    expect(list).toHaveLength(3);
    expect(list[0]).toMatchObject({ kind: 'stamp', size: 320, rotation: 45, flipX: true });
    // 押す前の大きさを道具欄で変えて押す
    await page.getByTestId('side-stamp-size-0').click();
    await page.getByTestId('side-stamp-flip').click();
    await tapAt(page, 300, 750);
    list = await items(page);
    expect(list[3]).toMatchObject({ size: 120, flipX: false });
    // 配置後: えらぶ → 移動（空いた所をタップ）・大きさ・回転・はんてん・削除
    await tool(page, 'select');
    await expect(page.getByTestId('draw-state')).toContainText('うごかす');
    await tapAt(page, 700, 300);
    await expect(page.getByTestId('draw-selection')).toBeVisible();
    const id = await page.getByTestId('draw-selection').getAttribute('data-item');
    expect(id).toBe(list[1]!.id);
    // 空いた所（操作札・ハンドルの無い所）をタップ → そこへ移動
    await tapAt(page, 1450, 880);
    const moved = (await items(page)).find((i) => i.id === id)!;
    expect(moved).toMatchObject({ x: expect.closeTo(1450, -1), y: expect.closeTo(880, -1) });
    await page.getByTestId('act-bigger').click();
    await page.getByTestId('act-rotate').click();
    await page.getByTestId('act-flip').click();
    const changed = (await items(page)).find((i) => i.id === id)!;
    expect(changed).toMatchObject({ size: 400, rotation: 90, flipX: false });
    await page.getByTestId('act-smaller').click();
    expect((await items(page)).find((i) => i.id === id)!.size).toBe(320);
    // ドラッグでも動かせる
    const [sx, sy] = await toScreen(page, 1450, 880);
    const [ex, ey] = await toScreen(page, 1200, 600);
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(ex, ey, { steps: 6 });
    await page.mouse.up();
    expect((await items(page)).find((i) => i.id === id)).toMatchObject({
      x: expect.closeTo(1200, -1),
      y: expect.closeTo(600, -1),
    });
    await page.getByTestId('act-delete').click();
    expect((await items(page)).find((i) => i.id === id)).toBeUndefined();
    expect(await items(page)).toHaveLength(3);
  });

  test('図形: 7種・輪郭／塗り・輪郭の太さ・色・タップで配置・大きさ・回転・選択・移動・削除', async ({
    page,
  }) => {
    await openDraw(page);
    const kinds = ['circle', 'ellipse', 'triangle', 'rect', 'star', 'heart', 'line'];
    for (const [i, k] of kinds.entries()) {
      await tool(page, 'shape');
      await page.getByTestId(`shape-${k}`).click();
      await page.getByTestId(i % 2 ? 'shape-filled' : 'shape-outline').click();
      await page.getByTestId(`shape-stroke-${i % 3}`).click();
      await page.getByTestId(`shape-color-${i % 2 ? 'green' : 'blue'}`).click();
      await page.getByTestId('panel-ok').click();
      await tapAt(page, 200 + (i % 4) * 400, 250 + Math.floor(i / 4) * 450);
    }
    const list = await items(page);
    expect(list.map((i) => i.shape)).toEqual(kinds);
    expect(list[1]).toMatchObject({ fill: '#4E9A3E' });
    expect(list[0]).toMatchObject({ fill: null });
    // 塗った楕円の中は緑
    expect(near(await sample(page, 600, 250), [0x4e, 0x9a, 0x3e, 255])).toBe(true);
    // 選ぶ → 大きさ・回転 → 移動 → 削除
    await tool(page, 'select');
    await tapAt(page, 1000, 250); // 三角
    await expect(page.getByTestId('draw-selection')).toHaveAttribute('data-item', list[2]!.id);
    await page.getByTestId('act-bigger').click();
    await page.getByTestId('act-rotate').click();
    let tri = (await items(page)).find((i) => i.id === list[2]!.id)!;
    expect(tri).toMatchObject({ w: 300, rotation: 45 });
    await tapAt(page, 1150, 560);
    tri = (await items(page)).find((i) => i.id === list[2]!.id)!;
    expect(tri).toMatchObject({ x: expect.closeTo(1150, -1), y: expect.closeTo(560, -1) });
    await page.getByTestId('act-delete').click();
    expect(await items(page)).toHaveLength(6);
  });

  test('くわしく: てまえへ／おくへ、同じ所を続けてタップで奥へ、透明部分を通り抜ける', async ({
    page,
  }) => {
    await openDraw(page, 'detailed');
    await tool(page, 'shape');
    await page.getByTestId('shape-rect').click();
    await page.getByTestId('shape-filled').click();
    await page.getByTestId('panel-ok').click();
    await tapAt(page, 800, 500); // 奥: 塗った四角
    await chooseStamp(page, 'nature', 'moon');
    await page.getByTestId('side-stamp-size-2').click();
    await tapAt(page, 800, 500); // 手前: 月（三日月の外側は透明）
    const [rect, moon] = await items(page);
    await tool(page, 'select');
    // 月の透明な所（右側の欠けた部分）をタップ → 通り抜けて奥の四角
    await tapAt(page, 900, 500);
    await expect(page.getByTestId('draw-selection')).toHaveAttribute('data-item', rect!.id);
    await page.getByTestId('act-done').click();
    // 重なった所（月の絵の上）: 手前の月 → 続けてタップで奥の四角 → また月
    await tapAt(page, 780, 500);
    await expect(page.getByTestId('draw-selection')).toHaveAttribute('data-item', moon!.id);
    await tapAt(page, 781, 501);
    await expect(page.getByTestId('draw-selection')).toHaveAttribute('data-item', rect!.id);
    await tapAt(page, 780, 500);
    await expect(page.getByTestId('draw-selection')).toHaveAttribute('data-item', moon!.id);
    // おくへ / てまえへ
    await page.getByTestId('act-back').click();
    expect((await items(page)).map((i) => i.id)).toEqual([moon!.id, rect!.id]);
    await page.getByTestId('act-front').click();
    expect((await items(page)).map((i) => i.id)).toEqual([rect!.id, moon!.id]);
    // 矢印札で少し動かす
    await page.getByTestId('act-right').click();
    expect((await items(page))[1]!.x).toBeCloseTo(840, -1);
  });

  test('undo／redo（線・塗り・消し・はんこ・図形・移動・変形・削除）', async ({ page }) => {
    await openDraw(page);
    const snap = async () =>
      JSON.stringify([
        await items(page),
        await sample(page, 300, 300),
        await sample(page, 250, 250),
      ]);
    const states: string[] = [await snap()];
    // 線（四角く囲む）
    await page.getByTestId('color-black').click();
    await mouseLine(page, [
      [200, 200],
      [400, 200],
      [400, 400],
      [200, 400],
      [200, 200],
    ]);
    states.push(await snap());
    await tool(page, 'fill');
    await page.getByTestId('color-blue').click();
    await tapAt(page, 300, 300);
    states.push(await snap());
    await tool(page, 'eraser');
    await mouseLine(page, [
      [250, 250],
      [260, 260],
    ]);
    states.push(await snap());
    await chooseStamp(page, 'animal', 'dog');
    await tapAt(page, 900, 500);
    states.push(await snap());
    await tool(page, 'shape');
    await page.getByTestId('panel-ok').click();
    await tapAt(page, 1300, 500);
    states.push(await snap());
    await tool(page, 'select');
    await tapAt(page, 900, 500);
    await tapAt(page, 1500, 150); // 移動（操作札の無い所）
    states.push(await snap());
    await page.getByTestId('act-bigger').click(); // 変形
    states.push(await snap());
    await page.getByTestId('act-delete').click(); // 削除
    states.push(await snap());
    for (let i = states.length - 2; i >= 0; i--) {
      await tool(page, 'undo');
      expect(await snap(), `undo → 状態 ${i}`).toBe(states[i]);
    }
    await expect(page.getByTestId('tool-undo')).toBeDisabled();
    for (let i = 1; i < states.length; i++) {
      await tool(page, 'redo');
      expect(await snap(), `redo → 状態 ${i}`).toBe(states[i]);
    }
  });

  test('保存 → アプリを閉じる → 開く → 再編集（はんこ・図形が動かせる）', async ({ page }) => {
    await openDraw(page);
    await mouseLine(page, [
      [200, 800],
      [600, 800],
    ]);
    await chooseStamp(page, 'animal', 'bear');
    await tapAt(page, 800, 400);
    await tool(page, 'shape');
    await page.getByTestId('shape-star').click();
    await page.getByTestId('shape-filled').click();
    await page.getByTestId('panel-ok').click();
    await tapAt(page, 1200, 400);
    await waitSaved(page);
    await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-state', 'saved');
    const before = await items(page);
    // アプリを閉じて開き直す
    await page.reload();
    await expect(page.getByTestId('start-button')).toBeEnabled();
    await start(page);
    await page.evaluate(() => (location.hash = '#/gallery'));
    await expect(page.getByTestId('gallery-card')).toHaveCount(1);
    await clickUntil(page, page.getByTestId('gallery-open'), page.getByTestId('draw-screen'));
    await expect.poll(async () => (await items(page)).length).toBe(3);
    expect((await items(page)).map((i) => i.kind)).toEqual(before.map((i) => i.kind));
    expect(near(await sample(page, 400, 800), RED)).toBe(true);
    // はんこ・図形が動かせる
    await tool(page, 'select');
    await tapAt(page, 800, 400);
    await tapAt(page, 300, 300);
    await tapAt(page, 1200, 400);
    await tapAt(page, 1450, 150);
    const after = await items(page);
    expect(after[1]).toMatchObject({ x: expect.closeTo(300, -1), y: expect.closeTo(300, -1) });
    expect(after[2]).toMatchObject({ x: expect.closeTo(1450, -1), y: expect.closeTo(150, -1) });
    await waitSaved(page);
    const recs = await page.evaluate(
      () =>
        new Promise<number>((res) => {
          const o = indexedDB.open('manabi-no-niwa');
          o.onsuccess = () => {
            const r = o.result.transaction('artworks').objectStore('artworks').count();
            r.onsuccess = () => res(r.result);
          };
        }),
    );
    expect(recs).toBe(1);
  });

  test('中断（ページを閉じる）→ 再開で「つくりかけ」として復元', async ({ page }) => {
    await openDraw(page);
    await page.getByTestId('width-2').click();
    await mouseLine(page, [
      [300, 500],
      [1300, 500],
    ]);
    await chooseStamp(page, 'vehicle', 'bus-yellow');
    await tapAt(page, 800, 250);
    // 1.5 秒の保存を待たずにページを離れる（画像は先に作り終えている）
    await page.waitForTimeout(500);
    expect(await page.getByTestId('draw-screen').getAttribute('data-save-state')).not.toBe('saved');
    await page.goto('about:blank');
    await gotoApp(page);
    await start(page);
    await gotoDraw(page);
    await expect.poll(async () => (await items(page)).length).toBe(2);
    expect(near(await sample(page, 500, 500), RED)).toBe(true);
    // 開いたあとは保存し直して「つくりかけ」の印を消す
    await waitSaved(page);
    await page.evaluate(() => (location.hash = '#/gallery'));
    await expect(page.getByTestId('gallery-card')).toHaveCount(1);
    await expect(page.getByTestId('gallery-wip')).toHaveCount(0);
  });

  test('画面サイズを変えても作品が消えない', async ({ page }) => {
    await openDraw(page);
    await page.getByTestId('width-2').click();
    await mouseLine(page, [
      [200, 500],
      [1400, 500],
    ]);
    const displayed = () =>
      page.evaluate(() => {
        const c = document.querySelector<HTMLCanvasElement>('[data-testid=draw-canvas]')!;
        const d = c
          .getContext('2d')!
          .getImageData(Math.round(c.width / 2), Math.round(c.height / 2), 1, 1).data;
        return [...d];
      });
    await expect.poll(async () => near((await displayed()) as RGBA, RED)).toBe(true);
    for (const size of [
      { width: 800, height: 600 },
      { width: 1600, height: 900 },
      { width: 1024, height: 700 },
    ]) {
      await page.setViewportSize(size);
      await expect.poll(async () => near((await displayed()) as RGBA, RED)).toBe(true);
      expect(near(await sample(page, 800, 500), RED)).toBe(true);
    }
  });

  test('PNG 書き出し: 1600×1000、背景色を含む、選択枠が入らない', async ({ page }) => {
    await openDraw(page);
    await chooseStamp(page, 'animal', 'rabbit');
    await tapAt(page, 800, 500);
    await tool(page, 'select');
    await tapAt(page, 800, 500);
    await expect(page.getByTestId('draw-selection')).toBeVisible();
    const dl = page.waitForEvent('download');
    await page.getByTestId('export-png').click();
    const file = await (await dl).createReadStream();
    const chunks: Buffer[] = [];
    for await (const c of file) chunks.push(c as Buffer);
    const png = Buffer.concat(chunks);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.readUInt32BE(16)).toBe(1600);
    expect(png.readUInt32BE(20)).toBe(1000);
    // 画素: 角は紙の色（透明でない）、選択枠の位置（はんこの外側 1.5u）にも枠の色が無い
    const px = await page.evaluate(async (b64) => {
      const bin = atob(b64);
      const u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const bmp = await createImageBitmap(new Blob([u], { type: 'image/png' }));
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(bmp, 0, 0);
      const at = (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data];
      // はんこ（200）の枠は 700..900 の外側
      return { corner: at(2, 2), frameLeft: at(690, 500), frameTop: at(800, 390) };
    }, png.toString('base64'));
    expect(near(px.corner as RGBA, PAPER, 2)).toBe(true);
    expect(near(px.frameLeft as RGBA, PAPER, 2)).toBe(true);
    expect(near(px.frameTop as RGBA, PAPER, 2)).toBe(true);
  });

  test('同じ作品を2つのタブで開いたら、古い方のタブは保存を止める', async ({ page, context }) => {
    await openDraw(page);
    await mouseLine(page, [
      [200, 200],
      [600, 200],
    ]);
    await waitSaved(page);
    const artId = await page.evaluate(() => window.__mnwDraw!.meta.id);
    const page2 = await context.newPage();
    await gotoApp(page2);
    await start(page2);
    await gotoDraw(page2, `#/draw/${artId}`);
    await expect.poll(async () => (await items(page2)).length).toBe(1);
    // タブ2 で描いて保存
    await mouseLine(page2, [
      [200, 600],
      [600, 600],
    ]);
    await waitSaved(page2);
    // タブ1（古い方）で描く → 保存を止めて知らせる
    await mouseLine(page, [
      [200, 800],
      [600, 800],
    ]);
    await expect(page.getByTestId('draw-conflict')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('draw-conflict')).toHaveText('べつの がめんで かいています');
    // 保存されているのはタブ2 の絵
    await page2.close();
  });

  test('さくひん: 一覧・うつして かく・すてる（幼児は2段階の確認）', async ({ page }) => {
    await openDraw(page);
    await mouseLine(page, [
      [200, 200],
      [600, 200],
    ]);
    await clickUntil(page, page.getByTestId('gallery-button'), page.getByTestId('gallery'));
    await expect(page.getByTestId('gallery-card')).toHaveCount(1);
    await expect(page.getByTestId('gallery-card').locator('img')).toBeVisible();
    await clickUntil(page, page.getByTestId('gallery-copy'), page.getByTestId('draw-screen'));
    await expect.poll(async () => (await items(page)).length).toBe(1);
    expect(near(await sample(page, 400, 200), RED)).toBe(true);
    await clickUntil(page, page.getByTestId('gallery-button'), page.getByTestId('gallery'));
    await expect(page.getByTestId('gallery-card')).toHaveCount(2);
    await page.getByTestId('gallery-delete').first().click();
    await expect(page.getByTestId('confirm')).toContainText('すてる？');
    await page.getByTestId('confirm-yes').click();
    await expect(page.getByTestId('confirm')).toContainText('ほんとうに？');
    await page.getByTestId('confirm-yes').click();
    await expect(page.getByTestId('gallery-card')).toHaveCount(1);
    // あたらしく かく
    await clickUntil(page, page.getByTestId('gallery-new'), page.getByTestId('draw-screen'));
    await expect.poll(async () => (await items(page)).length).toBe(0);
  });

  test('道具欄を左右に入れ替えられる（利き手）', async ({ page }) => {
    await openDraw(page);
    const side = () => page.getByTestId('draw-side').boundingBox();
    const canvas = () => page.getByTestId('draw-canvas').boundingBox();
    expect((await side())!.x).toBeLessThan((await canvas())!.x);
    await page.getByTestId('swap-hand').click();
    await expect.poll(async () => (await side())!.x > (await canvas())!.x).toBe(true);
  });
});

test.describe('おえかき（タッチ模擬: Chromium）', () => {
  test.use({ hasTouch: true });
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP のタッチ模擬は Chromium だけ');

  test('指で線・2本目の指は無視して線を続ける・pointercancel でも描いた分が残る', async ({
    page,
  }) => {
    await boot(page);
    await gotoDraw(page);
    const cdp = await page.context().newCDPSession(page);
    const P = async (x: number, y: number) => {
      const [sx, sy] = await toScreen(page, x, y);
      return { x: sx, y: sy };
    };
    type TouchType = 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel';
    const touch = (type: TouchType, pts: { x: number; y: number; id: number }[]) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });

    // 1本の指で線
    await touch('touchStart', [{ ...(await P(200, 200)), id: 1 }]);
    for (let x = 250; x <= 600; x += 50)
      await touch('touchMove', [{ ...(await P(x, 200)), id: 1 }]);
    await touch('touchEnd', []);
    expect(near(await sample(page, 400, 200), RED)).toBe(true);

    // 描いている途中で2本目の指が触れる → 無視して、1本目の線を続ける
    await touch('touchStart', [{ ...(await P(200, 500)), id: 1 }]);
    await touch('touchMove', [{ ...(await P(300, 500)), id: 1 }]);
    await touch('touchStart', [
      { ...(await P(300, 500)), id: 1 },
      { ...(await P(1200, 800)), id: 2 },
    ]);
    for (let i = 1; i <= 6; i++) {
      await touch('touchMove', [
        { ...(await P(300 + i * 50, 500)), id: 1 },
        { ...(await P(1200 + i * 20, 800 - i * 30)), id: 2 },
      ]);
    }
    await touch('touchEnd', []);
    expect(near(await sample(page, 550, 500), RED)).toBe(true);
    expect(isPaper(await sample(page, 1260, 710))).toBe(true);

    // pointercancel（ブラウザが操作を取り上げた）でも、それまでの線は残る
    await touch('touchStart', [{ ...(await P(200, 800)), id: 1 }]);
    for (let x = 250; x <= 700; x += 50)
      await touch('touchMove', [{ ...(await P(x, 800)), id: 1 }]);
    await touch('touchCancel', []);
    expect(near(await sample(page, 600, 800), RED)).toBe(true);
    // 3本とも1つのインクの層に入り、undo できる
    expect((await items(page)).map((i) => i.kind)).toEqual(['ink']);
    await page.getByTestId('tool-undo').tap();
    expect(isPaper(await sample(page, 600, 800))).toBe(true);
    expect(near(await sample(page, 550, 500), RED)).toBe(true);
  });

  test('指で はんこ を押す・塗る・消す', async ({ page }) => {
    await boot(page);
    await gotoDraw(page);
    await page.getByTestId('tool-stamp').tap();
    await page.getByTestId('stamp-dog').tap();
    await page.getByTestId('panel-ok').tap();
    const [sx, sy] = await toScreen(page, 800, 500);
    await page.touchscreen.tap(sx, sy);
    const [sx2, sy2] = await toScreen(page, 300, 300);
    await page.touchscreen.tap(sx2, sy2);
    expect(await items(page)).toHaveLength(2);
    await page.getByTestId('tool-fill').tap();
    await page.getByTestId('color-green').tap();
    const [fx, fy] = await toScreen(page, 1400, 900);
    await page.touchscreen.tap(fx, fy);
    expect(near(await sample(page, 1400, 900), [0x4e, 0x9a, 0x3e, 255])).toBe(true);
  });
});

declare global {
  interface Window {
    __mnwDraw?: {
      engine: {
        sample(x: number, y: number): RGBA;
        doc: { items: unknown[] };
      };
      meta: { id: string };
    };
  }
}
