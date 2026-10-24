import { describe, expect, it } from 'vitest';
import {
  hitCandidates,
  hitsItem,
  itemBounds,
  pickItem,
  shapePoints,
  toLocal,
  type HitOptions,
} from './geometry';
import { SHAPE_KINDS, type ArtItem, type ShapeItem, type StampItem } from './model';

const U = 10; // 1u = 論理 10
const stamp = (id: string, x: number, y: number, size = 200): StampItem => ({
  id,
  kind: 'stamp',
  asset: 'cat@1',
  x,
  y,
  size,
  rotation: 0,
  flipX: false,
});
const shape = (id: string, over: Partial<ShapeItem> = {}): ShapeItem => ({
  id,
  kind: 'shape',
  shape: 'rect',
  x: 500,
  y: 500,
  w: 200,
  h: 100,
  rotation: 0,
  stroke: '#2E2622',
  strokeWidth: 10,
  fill: null,
  ...over,
});

/** はんこの絵: 左半分だけ不透明（局所 0〜100 の x < 50） */
const leftHalf: HitOptions['stampAlpha'] = (_it, lx) => (lx < 50 ? 255 : 0);
const opt = (o: Partial<HitOptions> = {}): HitOptions => ({ u: U, stampAlpha: leftHalf, ...o });

describe('図形の形', () => {
  it('7種すべてが箱（w×h）に収まる', () => {
    for (const k of SHAPE_KINDS) {
      const pts = shapePoints(k, 200, 100);
      for (const p of pts) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(100.001);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(50.001);
      }
    }
    // 星・ハートは上下の端が箱の端に合う
    const star = shapePoints('star', 200, 200);
    expect(Math.min(...star.map((p) => p.y))).toBeCloseTo(-100, 0);
    expect(Math.max(...star.map((p) => p.y))).toBeCloseTo(100, 0);
  });

  it('回転・反転を戻した局所座標', () => {
    const it = { ...stamp('a', 100, 100), rotation: 90 };
    const l = toLocal(it, { x: 100, y: 150 });
    expect(l.x).toBeCloseTo(50);
    expect(l.y).toBeCloseTo(0);
    expect(toLocal({ ...stamp('b', 0, 0), flipX: true }, { x: 30, y: 0 }).x).toBeCloseTo(-30);
  });

  it('回転した外接矩形', () => {
    const b = itemBounds({ ...shape('r'), rotation: 90, strokeWidth: 0 });
    expect(b.x1 - b.x0).toBeCloseTo(100 + 4);
    expect(b.y1 - b.y0).toBeCloseTo(200 + 4);
  });
});

describe('当たり判定（review-1 #11: 不透明な画素 / 中心から 2.75u / 線から 2u）', () => {
  it('はんこ: 不透明な画素には当たり、透明な部分は通り抜ける', () => {
    const s = stamp('s', 500, 500); // 400..600
    expect(hitsItem(s, { x: 430, y: 430 }, opt())).toBe(true); // 左半分
    expect(hitsItem(s, { x: 580, y: 430 }, opt())).toBe(false); // 右半分（透明）
  });

  it('はんこ: 透明でも中心から 2.75u 以内は当たる', () => {
    const s = stamp('s', 500, 500);
    expect(hitsItem(s, { x: 527, y: 500 }, opt())).toBe(true);
    expect(hitsItem(s, { x: 529, y: 500 }, opt())).toBe(false);
  });

  it('図形の輪郭だけ: 中は透明（中心付近以外は通り抜ける）、線から 2u までは当たる', () => {
    const r = shape('r'); // 400..600 × 450..550、線の太さ 10
    expect(hitsItem(r, { x: 430, y: 500 }, opt())).toBe(false); // 中（線から 25 離れている）
    expect(hitsItem(r, { x: 410, y: 500 }, opt())).toBe(true); // 線から 10（5 は線の半分）
    expect(hitsItem(r, { x: 380, y: 500 }, opt())).toBe(true); // 外側 20 = 線の半分 5 + 15 ≤ 5+20
    expect(hitsItem(r, { x: 370, y: 500 }, opt())).toBe(false);
  });

  it('細い直線にも当たる（線から 2u）', () => {
    const l = shape('l', { shape: 'line', w: 300, h: 4, strokeWidth: 4 });
    expect(hitsItem(l, { x: 400, y: 518 }, opt())).toBe(true);
    expect(hitsItem(l, { x: 400, y: 525 }, opt())).toBe(false);
  });

  it('塗った図形は中も当たる', () => {
    expect(hitsItem(shape('f', { fill: '#D9433A' }), { x: 430, y: 500 }, opt())).toBe(true);
  });
});

describe('重なったときの選び方（X-ED-02）', () => {
  const back = stamp('back', 500, 500, 300);
  const front = stamp('front', 500, 500, 200);
  const items: ArtItem[] = [back, { id: 'L1', kind: 'ink', raster: null }, front];

  it('手前から順に候補を出す（インクの層は選ばない）', () => {
    expect(hitCandidates(items, { x: 450, y: 500 }, opt()).map((i) => i.id)).toEqual([
      'front',
      'back',
    ]);
  });

  it('かんたん: 何度タップしても最前面', () => {
    const p = { x: 450, y: 500 };
    expect(pickItem(items, p, opt())!.id).toBe('front');
    expect(pickItem(items, p, opt())!.id).toBe('front');
  });

  it('くわしく: 同じ所を続けてタップすると奥へ、最後は手前に戻る', () => {
    const p = { x: 450, y: 500 };
    const first = pickItem(items, p, opt({ cycle: null }))!;
    expect(first.id).toBe('front');
    const second = pickItem(items, { x: 452, y: 501 }, opt({ cycle: { id: first.id, at: p } }))!;
    expect(second.id).toBe('back');
    const third = pickItem(items, p, opt({ cycle: { id: second.id, at: p } }))!;
    expect(third.id).toBe('front');
    // 離れた所なら最前面から
    const far = pickItem(items, { x: 420, y: 520 }, opt({ cycle: { id: first.id, at: p } }))!;
    expect(far.id).toBe('front');
  });

  it('手前の透明な部分を通り抜けて、奥の物を選ぶ', () => {
    // front は右半分が透明。front の右側（back の左半分ではない所）は通り抜けて何も無い
    const p = { x: 580, y: 500 };
    expect(pickItem(items, p, opt())).toBeNull();
    // back の左半分（front の外）
    expect(pickItem(items, { x: 370, y: 500 }, opt())!.id).toBe('back');
  });
});
