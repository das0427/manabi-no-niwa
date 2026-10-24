import { describe, expect, it } from 'vitest';
import {
  STAMP_CATEGORIES,
  STAMP_LIST,
  STAMP_MIN_CATEGORIES,
  STAMP_MIN_COUNT,
} from '../illust/stamps/catalog';
import { placeCards } from './layout';
import { STAMPS } from './stamps';
import { TILE, TileRecorder, applyTiles, tilesBytes, type PixelCtx } from './tiles';
import {
  COLORS_24,
  COLORS_6,
  COLORS_8,
  PEN_GUARD_MS,
  ignorePointerDown,
  palette,
  widths,
} from './tools';

describe('操作札の置き場所（枠の下 → 上 → 道具欄）', () => {
  const area = { x0: 20, y0: 80, x1: 980, y1: 540 };
  const base = { rowW: 300, rowH: 60, gap: 10, area };
  it('下に入るなら下', () => {
    const p = placeCards({ ...base, box: { x0: 400, y0: 200, x1: 500, y1: 300 } });
    expect(p).toEqual({ where: 'below', x: 300, y: 310 });
  });
  it('下に入らなければ上', () => {
    const p = placeCards({ ...base, box: { x0: 400, y0: 300, x1: 500, y1: 500 } });
    expect(p.where).toBe('above');
    expect(p.y).toBe(230);
  });
  it('上にも入らなければ道具欄', () => {
    expect(placeCards({ ...base, box: { x0: 400, y0: 100, x1: 500, y1: 500 } }).where).toBe('dock');
  });
  it('左右は画面の中に寄せる', () => {
    const p = placeCards({ ...base, box: { x0: 0, y0: 200, x1: 40, y1: 300 } });
    expect(p.x).toBe(20);
    const q = placeCards({ ...base, box: { x0: 960, y0: 200, x1: 1000, y1: 300 } });
    expect(q.x).toBe(680);
  });
});

describe('入力の判定（R#7）', () => {
  const e = (o: Partial<{ isPrimary: boolean; pointerType: string; button: number }>) => ({
    isPrimary: true,
    pointerType: 'touch',
    button: 0,
    ...o,
  });
  it('isPrimary 以外（2本目の指）は無視', () => {
    expect(ignorePointerDown(e({ isPrimary: false }), 0, -Infinity)).toBe(true);
    expect(ignorePointerDown(e({}), 0, -Infinity)).toBe(false);
  });
  it('マウスの右ボタンは無視', () => {
    expect(ignorePointerDown(e({ pointerType: 'mouse', button: 2 }), 0, -Infinity)).toBe(true);
  });
  it('ペンを使ってから 1 秒は指を使わない', () => {
    expect(ignorePointerDown(e({}), 5000, 5000 - PEN_GUARD_MS + 1)).toBe(true);
    expect(ignorePointerDown(e({}), 5000, 5000 - PEN_GUARD_MS)).toBe(false);
    expect(ignorePointerDown(e({ pointerType: 'pen' }), 5000, 4999)).toBe(false);
  });
});

describe('色数・太さ（ux-by-age 1章、review-1 #29）', () => {
  it('かんたん 2〜3歳: 色6・太さ2 ／ 4歳以上: 色8・太さ3 ／ くわしく: 色24・太さ5', () => {
    expect(palette('simple', true)).toHaveLength(6);
    expect(widths('simple', true)).toHaveLength(2);
    expect(palette('simple', false)).toHaveLength(8);
    expect(widths('simple', false)).toHaveLength(3);
    expect(palette('detailed', false)).toHaveLength(24);
    expect(widths('detailed', true)).toHaveLength(5);
  });
  it('色の ID と名前は重ならない。真っ黒・名前の無い色はない', () => {
    for (const list of [COLORS_6, COLORS_8, COLORS_24]) {
      expect(new Set(list.map((c) => c.id)).size).toBe(list.length);
      expect(new Set(list.map((c) => c.name)).size).toBe(list.length);
      for (const c of list) {
        expect(c.hex).toMatch(/^#[0-9A-F]{6}$/);
        expect(c.hex).not.toBe('#000000');
        expect(c.name).toMatch(/^[ぁ-ん]+$/);
      }
    }
  });
});

describe('はんこ（X-ST-01）', () => {
  it(`${STAMP_MIN_COUNT} 種以上・${STAMP_MIN_CATEGORIES} カテゴリ以上。生成物は一覧と一致`, () => {
    expect(STAMPS.length).toBeGreaterThanOrEqual(STAMP_MIN_COUNT);
    expect(new Set(STAMPS.map((s) => s.category)).size).toBeGreaterThanOrEqual(
      STAMP_MIN_CATEGORIES,
    );
    expect(STAMPS.map((s) => `${s.id}@${s.version}`)).toEqual(
      STAMP_LIST.map((s) => `${s.id}@${s.version}`),
    );
    for (const c of STAMP_CATEGORIES) {
      expect(STAMPS.filter((s) => s.category === c.id).length).toBeGreaterThan(0);
    }
    for (const s of STAMPS) expect(s.svg).toMatch(/^<svg [^>]*width="100" height="100"/);
  });
});

describe('画素の差分（タイル）', () => {
  /** 1チャンネルだけの偽のキャンバス */
  function fakeCtx(w: number, h: number) {
    const px = new Uint8ClampedArray(w * h * 4);
    const ctx: PixelCtx = {
      getImageData(x, y, cw, ch) {
        const data = new Uint8ClampedArray(cw * ch * 4);
        for (let yy = 0; yy < ch; yy++) {
          data.set(px.subarray(((y + yy) * w + x) * 4, ((y + yy) * w + x + cw) * 4), yy * cw * 4);
        }
        return { data, width: cw, height: ch, colorSpace: 'srgb' } as ImageData;
      },
      putImageData(d, x, y) {
        for (let yy = 0; yy < d.height; yy++) {
          px.set(d.data.subarray(yy * d.width * 4, (yy + 1) * d.width * 4), ((y + yy) * w + x) * 4);
        }
      },
    };
    return { px, ctx };
  }

  it('触ったタイルだけを持ち、前後に戻せる', () => {
    const W = TILE * 3;
    const H = TILE * 2;
    const { px, ctx } = fakeCtx(W, H);
    const rec = new TileRecorder(() => ctx, W, H);
    rec.touch('L1', 10, 10, 20, 20);
    rec.touch('L1', 15, 15, TILE + 5, 20); // 隣のタイルにまたがる
    expect(rec.size).toBe(2);
    px[(12 * W + 12) * 4 + 3] = 255;
    px[(12 * W + TILE + 2) * 4 + 3] = 200;
    const tiles = rec.finish();
    expect(tilesBytes(tiles)).toBe(2 * 2 * TILE * TILE * 4);
    applyTiles(tiles, 'before', () => ctx);
    expect(px[(12 * W + 12) * 4 + 3]).toBe(0);
    applyTiles(tiles, 'after', () => ctx);
    expect(px[(12 * W + TILE + 2) * 4 + 3]).toBe(200);
  });

  it('端のタイルは画像の大きさで切る', () => {
    const { ctx } = fakeCtx(200, 150);
    const rec = new TileRecorder(() => ctx, 200, 150);
    rec.touch('L', 190, 140, 400, 400);
    const [t] = rec.finish();
    expect([t!.x, t!.y, t!.before.width, t!.before.height]).toEqual([128, 128, 72, 22]);
  });
});
