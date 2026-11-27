import { describe, expect, it } from 'vitest';
import { sampleItems } from '../../curriculum/qa';
import type { Item } from '../../curriculum/types';
import { congruence } from './congruence';
import { placeAngleLabels } from './angle-labels';

/**
 * 図の 字は 画面で 最小まで 引き上げられる（実測 24〜26 単位）。引き上げた 大きさで、図の 字の 箱どうしが
 * 重ならない こと（検査 check:text-layout の overlap-text と 同じ 見方: 横に 1.5 以上、縦に 外接の 高さの 3 割より 多く 重なる）。
 */
interface T {
  x: number;
  y: number;
  size: number;
  text: string;
}

function textsOf(markup: string): T[] {
  const out: T[] = [];
  for (const m of markup.matchAll(
    /<text x="([-\d.]+)" y="([-\d.]+)" font-size="([\d.]+)"[^>]*>([^<]*)<\/text>/g,
  ))
    out.push({ x: Number(m[1]), y: Number(m[2]), size: Number(m[3]), text: m[4]! });
  return out;
}

/** 字の 外接の 箱。幅は 見積もり（数字 0.52・° 0.68・英字 0.68・ほか 1。実測は 数字 0.5〜0.55）、高さは 字の 大きさの 1.44 倍（実測） */
function emBox(t: T, lifted: number) {
  const size = Math.max(t.size, lifted);
  let w = 0;
  for (const c of t.text)
    w += /\d/.test(c) ? 0.52 : c === '°' ? 0.68 : /[A-Za-z]/.test(c) ? 0.68 : 1;
  return {
    l: t.x - (w * size) / 2,
    r: t.x + (w * size) / 2,
    t: t.y - size * 0.72,
    b: t.y + size * 0.72,
    h: size * 1.44,
  };
}

const figureOf = (it: Item) =>
  'figure' in it && it.figure?.kind === 'svg' ? it.figure.markup : undefined;

describe('g5.math.congruence の 角の 字の 置き場', () => {
  it('角の 字が ある 図は、24〜26 単位に 引き上げても 字どうしが 重ならない（6 つの 三角形 すべて）', () => {
    const items = sampleItems(congruence, 400).filter((it) => /°/.test(figureOf(it) ?? ''));
    // 6 つの 元の 三角形が ぜんぶ 出ている
    const kinds = new Set(items.map((it) => it.identity.split(':')[1]));
    expect([...kinds].sort()).toEqual(['0', '1', '2', '3', '4', '5']);
    for (const it of items) {
      const ts = textsOf(figureOf(it)!);
      for (const lifted of [24, 25, 26]) {
        const bx = ts.map((t) => emBox(t, lifted));
        for (let i = 0; i < bx.length; i++)
          for (let j = i + 1; j < bx.length; j++) {
            const a = bx[i]!;
            const b = bx[j]!;
            const ow = Math.min(a.r, b.r) - Math.max(a.l, b.l);
            const oh = Math.min(a.b, b.b) - Math.max(a.t, b.t);
            const hit = ow > 1.5 && oh > 0.3 * Math.min(a.h, b.h);
            expect(hit, `${it.identity} 引き上げ ${lifted}: ${ts[i]!.text}｜${ts[j]!.text}`).toBe(
              false,
            );
          }
      }
    }
  });

  it('角の 字は 自分の 頂点の 近く（50 単位 以内）に あり、ほかの 頂点より 自分の 頂点に 近い', () => {
    for (const it of sampleItems(congruence, 400)) {
      const markup = figureOf(it);
      if (!markup || !/°/.test(markup)) continue;
      const ts = textsOf(markup);
      // 角の 字が ある のは 左の 三角形（最初の polygon）。字は 頂点 0・1・2 の じゅんに かく
      const polygon = /<polygon points="([^"]+)"/
        .exec(markup)![1]!
        .split(' ')
        .map((p) => p.split(',').map(Number) as [number, number]);
      const angles = ts.filter((t) => t.text.endsWith('°'));
      expect(angles, it.identity).toHaveLength(3);
      angles.forEach((a, k) => {
        const ds = polygon.map(([x, y]) => Math.hypot(a.x - x, a.y - y));
        const own = ds[k]!;
        // どの 角の 字か 見分けられる（ほかの 頂点の ほうが 近いと、ちがう 角の 大きさに 見える）
        expect(own, `${it.identity} ${a.text}`).toBeLessThanOrEqual(50);
        expect(Math.min(...ds), `${it.identity} ${a.text}`).toBe(own);
      });
    }
  });

  it('置く 字が 無い 頂点は 飛ばす', () => {
    const tri: [number, number][] = [
      [30, 68],
      [162, 68],
      [74, 24],
    ];
    const names: [number, number][] = [
      [16, 71],
      [176, 71],
      [68, 11],
    ];
    const r = placeAngleLabels(tri, names, ['A', 'B', 'C'], ['45°', '', '108°']);
    expect(r[0]).not.toBeNull();
    expect(r[1]).toBeNull();
    expect(r[2]).not.toBeNull();
  });
});
