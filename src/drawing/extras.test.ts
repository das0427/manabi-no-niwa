/**
 * 2.1.0 で足したおえかきの機能（純粋な部分）: かみ（テンプレートの背景）・ドラッグで大きさを決める図形・
 * 虫めがねの表示位置・保存できないときの案内・なぞり／みちの作品の一覧。
 */
import { describe, expect, it } from 'vitest';
import type { WorkRecord } from '../core/types';
import { PALETTE_VALUES } from '../illust/palette';
import { canvasPlacement } from './CanvasView';
import { DOC_H, DOC_W, emptyDoc, parseDoc } from './model';
import { viewableWorks } from './oldWorks';
import { saveHelp } from './saveHelp';
import { PAPER_TEMPLATES, backgroundFor, getTemplate, sameBackground } from './templates';
import { MAX_SIZE, MIN_SIZE, shapeFromDrag } from './tools';

describe('かみ（テンプレートの背景）', () => {
  it('ID が重ならず、名前はひらがな、絵は 1600×1000 の SVG で文字・スクリプト・外部参照・グラデーションが無い', () => {
    expect(PAPER_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    expect(new Set(PAPER_TEMPLATES.map((t) => t.id)).size).toBe(PAPER_TEMPLATES.length);
    for (const t of PAPER_TEMPLATES) {
      expect(t.id).toMatch(/^[a-z0-9-]{1,40}$/);
      expect(t.name).toMatch(/^[ぁ-ゖー ]+$/);
      expect(t.svg.startsWith('<svg')).toBe(true);
      expect(t.svg).toContain(`width="${DOC_W}" height="${DOC_H}"`);
      expect(t.svg).not.toMatch(/<text|<script|href=|on[a-z]+=|Gradient|<filter/i);
    }
  });

  it('色はイラストのパレットだけ（DESINGN.md 6.1）', () => {
    for (const t of PAPER_TEMPLATES) {
      for (const m of t.svg.matchAll(/#[0-9A-Fa-f]{6}/g)) {
        expect(PALETTE_VALUES).toContain(m[0].toUpperCase());
      }
    }
  });

  it('背景つきの文書は保存して読み直せる。白い紙・知らない ID は色の背景', () => {
    const doc = { ...emptyDoc(), background: backgroundFor('sea') };
    expect(doc.background).toMatchObject({ kind: 'template', templateId: 'sea' });
    expect(parseDoc(JSON.parse(JSON.stringify(doc)))?.background).toEqual(doc.background);
    expect(backgroundFor(null).kind).toBe('color');
    expect(backgroundFor('nope').kind).toBe('color');
    expect(getTemplate('nope')).toBeNull();
  });

  it('同じかみかどうか', () => {
    expect(sameBackground(backgroundFor(null), backgroundFor(undefined))).toBe(true);
    expect(sameBackground(backgroundFor('sea'), backgroundFor('sea'))).toBe(true);
    expect(sameBackground(backgroundFor('sea'), backgroundFor('field'))).toBe(false);
    expect(sameBackground(backgroundFor(null), backgroundFor('sea'))).toBe(false);
  });
});

describe('ドラッグで大きさを決める図形（X-SH-03）', () => {
  it('しかく: 押した所と離した所を対角にする（逆向きのドラッグも）', () => {
    expect(shapeFromDrag('rect', { x: 100, y: 100 }, { x: 500, y: 300 })).toEqual({
      x: 300,
      y: 200,
      w: 400,
      h: 200,
      rotation: 0,
    });
    expect(shapeFromDrag('rect', { x: 500, y: 300 }, { x: 100, y: 100 })).toMatchObject({
      x: 300,
      y: 200,
      w: 400,
      h: 200,
    });
  });

  it('まる: 長い方の正方形', () => {
    const r = shapeFromDrag('circle', { x: 100, y: 100 }, { x: 400, y: 200 });
    expect(r.w).toBe(300);
    expect(r.h).toBe(300);
    expect(r).toMatchObject({ x: 250, y: 250 });
  });

  it('せん: 押した所から離した所への線（長さと向き）', () => {
    const r = shapeFromDrag('line', { x: 100, y: 100 }, { x: 100, y: 500 });
    expect(r).toMatchObject({ x: 100, y: 300, w: 400, rotation: 90 });
    const l = shapeFromDrag('line', { x: 500, y: 100 }, { x: 100, y: 100 });
    expect(l).toMatchObject({ x: 300, y: 100, w: 400, rotation: 180 });
  });

  it('大きさは下限・上限の中、中心は紙の中', () => {
    const tiny = shapeFromDrag('rect', { x: 10, y: 10 }, { x: 12, y: 11 });
    expect(tiny.w).toBe(MIN_SIZE);
    expect(tiny.h).toBe(MIN_SIZE);
    const huge = shapeFromDrag('ellipse', { x: 0, y: 0 }, { x: 9000, y: 9000 });
    expect(huge.w).toBe(MAX_SIZE);
    expect(huge.x).toBeLessThanOrEqual(DOC_W);
    expect(huge.y).toBeLessThanOrEqual(DOC_H);
  });
});

describe('虫めがねの表示位置（くわしく）', () => {
  it('虫めがねなし: 置き場に 16:10 で最大・真ん中', () => {
    expect(canvasPlacement(1000, 500, null)).toEqual({
      left: 100,
      top: 0,
      width: 800,
      height: 500,
    });
  });

  it('2倍: 選んだ所を真ん中に寄せ、紙の端より外は見せない', () => {
    const mid = canvasPlacement(800, 500, { scale: 2, cx: 800, cy: 500 });
    expect(mid).toEqual({ left: -400, top: -250, width: 1600, height: 1000 });
    const corner = canvasPlacement(800, 500, { scale: 2, cx: 0, cy: 0 });
    expect(corner).toMatchObject({ left: 0, top: 0 });
    const far = canvasPlacement(800, 500, { scale: 2, cx: DOC_W, cy: DOC_H });
    expect(far).toMatchObject({ left: -800, top: -500 });
  });
});

describe('保存できないときの保護者向けの案内（X-SV-03）', () => {
  it('容量不足・保存が使えない・そのほかで案内を分け、どれも絵を画像で残す方法を書く', () => {
    const full = saveHelp('full', false);
    expect(full.title).toContain('容量');
    expect(full.steps.join('')).toContain('データ');
    const un = saveHelp('ok', true);
    expect(un.title).toContain('保存できない');
    const err = saveHelp('error', false);
    for (const h of [full, un, err]) expect(h.steps[0]).toContain('がぞうに する');
  });
});

describe('なぞり・みち の作品を一覧に出す（X-SV-05）', () => {
  const w = (id: string, createdAt: number, data: unknown = {}): WorkRecord => ({
    id,
    profileId: 'p-test',
    modeId: 'trace',
    kind: 'trace',
    title: 'し',
    createdAt,
    data,
  });
  it('下書きは出さず、新しい順', () => {
    const list = viewableWorks([w('a', 1), w('b', 3), w('c', 2, { draft: true })]);
    expect(list.map((x) => x.id)).toEqual(['b', 'a']);
  });
});
