import { describe, expect, it } from 'vitest';
import {
  MAX_INK,
  bringInside,
  clampCenter,
  emptyDoc,
  moveZ,
  parseDoc,
  planInkTarget,
  pruneAssets,
  withoutIds,
  type ArtItem,
  type ShapeItem,
  type StampItem,
} from './model';

const ink = (id: string): ArtItem => ({ id, kind: 'ink', raster: null });
const stamp = (id: string, x = 100, y = 100): StampItem => ({
  id,
  kind: 'stamp',
  asset: 'cat@1',
  x,
  y,
  size: 200,
  rotation: 0,
  flipX: false,
});
const shape = (id: string): ShapeItem => ({
  id,
  kind: 'shape',
  shape: 'circle',
  x: 500,
  y: 500,
  w: 200,
  h: 200,
  rotation: 0,
  stroke: '#D9433A',
  strokeWidth: 10,
  fill: null,
});

describe('インクの層の書き込み先（review-1 #1）', () => {
  it('空の文書: 新しい層を作る', () => {
    expect(planInkTarget([])).toEqual({ kind: 'new', bake: null });
  });

  it('一番上がインクの層ならそこへ描く', () => {
    expect(planInkTarget([stamp('s1'), ink('L1')])).toEqual({ kind: 'existing', id: 'L1' });
  });

  it('線 → はんこ → 線: 2本目の線は、はんこの上の新しい層になる', () => {
    let items: ArtItem[] = [];
    const t1 = planInkTarget(items);
    expect(t1.kind).toBe('new');
    items = [ink('L1')];
    items = [...items, stamp('s1')];
    const t2 = planInkTarget(items);
    expect(t2).toEqual({ kind: 'new', bake: null });
    items = [...items, ink('L2')];
    // 重なり順: L1（奥）→ s1 → L2（手前）
    expect(items.map((i) => i.id)).toEqual(['L1', 's1', 'L2']);
  });

  it(`インクの層が ${MAX_INK} 枚あるときは、一番下の層とその下の物を焼き付ける`, () => {
    const items: ArtItem[] = [stamp('s0')];
    for (let i = 1; i <= MAX_INK; i++) items.push(ink(`L${i}`), stamp(`s${i}`));
    const t = planInkTarget(items);
    expect(t).toEqual({ kind: 'new', bake: { ids: ['s0', 'L1'] } });
    if (t.kind !== 'new' || !t.bake) return;
    const after = withoutIds(items, t.bake.ids);
    expect(after.filter((i) => i.kind === 'ink')).toHaveLength(MAX_INK - 1);
    expect(after[0]!.id).toBe('s1');
  });

  it('一番上がインクの層なら6枚でも焼き付けない', () => {
    const items: ArtItem[] = [];
    for (let i = 1; i <= MAX_INK; i++) items.push(stamp(`s${i}`), ink(`L${i}`));
    expect(planInkTarget(items)).toEqual({ kind: 'existing', id: `L${MAX_INK}` });
  });
});

describe('重なり順（てまえへ／おくへ）', () => {
  const items: ArtItem[] = [ink('L1'), stamp('a'), stamp('b'), shape('c')];
  it('1つずつ動く（インクの層も数える）', () => {
    expect(moveZ(items, 'a', 'forward').map((i) => i.id)).toEqual(['L1', 'b', 'a', 'c']);
    expect(moveZ(items, 'a', 'backward').map((i) => i.id)).toEqual(['a', 'L1', 'b', 'c']);
    expect(moveZ(items, 'b', 'front').map((i) => i.id)).toEqual(['L1', 'a', 'c', 'b']);
    expect(moveZ(items, 'c', 'back').map((i) => i.id)).toEqual(['c', 'L1', 'a', 'b']);
  });
  it('端では変わらない（同じ配列）', () => {
    expect(moveZ(items, 'c', 'forward')).toBe(items);
    expect(moveZ(items, 'L1', 'backward')).toBe(items);
    expect(moveZ(items, 'zz', 'front')).toBe(items);
  });
});

describe('画面の外', () => {
  it('中心はキャンバスの中に制限する', () => {
    expect(clampCenter(-50, 2000)).toEqual({ x: 0, y: 1000 });
  });
  it('「みつける」で端の物を内側へ寄せる', () => {
    const out = bringInside([stamp('a', 0, 999), stamp('b', 800, 500)]);
    expect(out[0]).toMatchObject({ x: 80, y: 920 });
    expect((out[1] as StampItem).x).toBe(800);
  });
});

describe('文書の検証', () => {
  it('保存した文書を読み戻せる', () => {
    const doc = emptyDoc();
    doc.items = [{ id: 'L1', kind: 'ink', raster: 'ink:L1' }, stamp('s1'), shape('h1')];
    doc.assets = { 'cat@1': '<svg width="100" height="100"></svg>', 'dog@1': '<svg></svg>' };
    const back = parseDoc(JSON.parse(JSON.stringify(doc)));
    expect(back).toEqual(doc);
    expect(pruneAssets(doc)).toEqual({ 'cat@1': doc.assets['cat@1'] });
  });

  it('学習連携の origin を持てる（X-DL）', () => {
    const doc = emptyDoc({ kind: 'lesson', unitId: 'g1.kokugo.e', itemId: 'q1' });
    expect(parseDoc(JSON.parse(JSON.stringify(doc)))?.origin).toEqual(doc.origin);
  });

  it('不正な文書は null', () => {
    const ok = emptyDoc();
    expect(parseDoc({ ...ok, version: 1 })).toBeNull();
    expect(parseDoc({ ...ok, width: 1920 })).toBeNull();
    expect(parseDoc({ ...ok, items: [stamp('s1')] })).toBeNull(); // 素材が無い
    expect(parseDoc({ ...ok, items: [{ id: 'L1', kind: 'ink', raster: 'ink:other' }] })).toBeNull();
    expect(parseDoc({ ...ok, items: [ink('a/b')] })).toBeNull();
    const tooMany = Array.from({ length: MAX_INK + 1 }, (_, i) => ink(`L${i}`));
    expect(parseDoc({ ...ok, items: tooMany })).toBeNull();
    expect(parseDoc({ ...ok, items: [ink('x'), ink('x')] })).toBeNull();
  });
});
