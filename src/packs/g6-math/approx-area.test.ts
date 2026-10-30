import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems } from '../../curriculum/qa';
import type { ChoiceItem, NumberItem } from '../../curriculum/types';
import type { GeometryItem } from '../../engines/geometry/geometry';
import { engineOf } from '../../engines/registry';
import { approxArea, countCells, GRID_TABLE, ITEMS, polyArea } from './approx-area';

const items = () => sampleItems(approxArea, 100);

describe('g6.math.approx-area', () => {
  it('48問、id = identity で重ならず、到達項目ごとに 非 alt 8・alt 4', () => {
    expect(ITEMS.length).toBe(48);
    expect(new Set(ITEMS.map((i) => i.identity)).size).toBe(48);
    for (const it of ITEMS) expect(it.id).toBe(it.identity);
    for (const o of ['shape', 'formula', 'estimate', 'compare']) {
      const mine = ITEMS.filter((i) => i.objective === o);
      expect(mine.filter((i) => !i.alt).length, o).toBe(8);
      expect(mine.filter((i) => i.alt).length, o).toBe(4);
    }
  });

  it('estimate の値と誤答（許容の外・誤概念つき）', () => {
    const table: Record<string, [number, number]> = {
      A: [900, 90],
      B: [30, 3],
      C: [314, 31],
      D: [2800, 280],
      E: [1500, 150],
      F: [24, 2.4],
      G: [1114, 111],
      H: [28.26, 2.8],
    };
    for (const [k, [v, tol]] of Object.entries(table)) {
      const it = ITEMS.find((i) => i.id === `estimate:${k}`) as NumberItem;
      const a = it.fields[0]!.answer;
      expect(a.kind).toBe('quantity');
      if (a.kind === 'quantity') {
        expect(a.value).toBe(v);
        expect(a.tolerance).toBe(tol);
        for (const w of it.wrongAnswers ?? [])
          expect(Math.abs(Number(w.value) - v), `${k} ${w.value}`).toBeGreaterThan(tol);
      }
      expect((it.wrongAnswers ?? []).length).toBeGreaterThanOrEqual(2);
      expect(engineOf(it).judge(it, [String(v)]).result).toBe('correct');
      expect(engineOf(it).judge(it, [String(v + tol / 2)]).result).toBe('correct');
    }
  });

  it('方眼の数え方・正答・許容', () => {
    const expected: Record<string, [number, number]> = {
      g1: [12, 12],
      g2: [16, 24],
      g3: [12, 19],
      g4: [18, 21],
    };
    for (const g of GRID_TABLE) {
      const { F, P } = countCells(g.poly);
      expect([F, P], g.id).toEqual(expected[g.id]);
      const it = ITEMS.find((i) => i.id === `estimate-alt:${g.id}`) as NumberItem;
      const a = it.fields[0]!.answer;
      if (a.kind !== 'quantity') throw new Error('quantity');
      expect(a.value).toBe(F + P / 2);
      expect(a.tolerance).toBe(P / 4);
      const tol = a.tolerance ?? 0;
      const real = polyArea(g.poly);
      expect(Math.abs(real - a.value)).toBeLessThanOrEqual(tol + 1e-9);
      expect(Math.abs(F - a.value)).toBeGreaterThan(tol);
      expect(Math.abs(F + P - a.value)).toBeGreaterThan(tol);
    }
  });

  it('shape は geometry の pick（選択肢4・正解1・誤りに誤概念・figure なし）', () => {
    const shapes = ITEMS.filter((i) => i.id.startsWith('shape:')) as GeometryItem[];
    expect(shapes.length).toBe(8);
    for (const it of shapes) {
      expect(it.engine).toBe('geometry');
      expect('figure' in it && it.figure).toBeFalsy();
      if (it.task.kind !== 'pick') throw new Error('pick');
      expect(it.task.options.length).toBe(4);
      expect(it.task.options.filter((o) => o.correct).length).toBe(1);
      for (const o of it.task.options) if (!o.correct) expect(o.misconception).toBeTruthy();
    }
  });

  it('図の SVG の文字に かな・漢字が無い', () => {
    for (const it of items())
      for (const m of JSON.stringify(it).matchAll(/<text[^>]*>([^<]*)<\/text>/g))
        expect(/[ぁ-ゖァ-ヺ一-鿿]/.test(m[1]!), it.id).toBe(false);
  });

  it('compare の c5〜c8 は 正答が A と B の両方にある', () => {
    const cs = ['c5', 'c6', 'c7', 'c8'].map(
      (k) => ITEMS.find((i) => i.id === `compare:${k}`) as ChoiceItem,
    );
    const labels = cs.map((c) => String(c.options.find((o) => o.correct)!.label));
    expect(labels.some((l) => l.startsWith('Aの'))).toBe(true);
    expect(labels.some((l) => l.startsWith('Bの'))).toBe(true);
  });

  it('検査の誤りなし・ready', () => {
    const r = checkUnit(approxArea);
    expect(r.errors).toEqual([]);
    expect(isReady(r)).toBe(true);
  });
});
