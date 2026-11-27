/**
 * 地図の札の絵（FX15・E-15）: 子供の画面に出る単元の絵が、登録済みで完成品（status: 'final'）であること。
 * 未登録・draft の絵は、本番では赤い破線の仮の枠になる（Illust.tsx。DESINGN.md 6.1「仮の素材を完成品に残さない」）。
 */
import { render } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { getIllust } from '../illust/registry';
import { HIGHLIGHT, INK, STROKE } from '../illust/types';
import { UNIT_INDEX, visibleUnits } from './unitIndex';

describe('単元の絵', () => {
  it('子供の画面に出る単元（小学生の地図・幼児。保護者が開く単元も）の絵は、すべて登録済みの完成品', () => {
    const hidden = UNIT_INDEX.filter((u) => u.hiddenByDefault).map((u) => u.id);
    expect(visibleUnits({}, hidden).length).toBeGreaterThan(visibleUnits().length);
    const bad = visibleUnits({}, hidden)
      .filter((u) => getIllust(u.icon)?.status !== 'final')
      .map((u) => `${u.id}（${u.icon}）`);
    expect(bad).toEqual([]);
  });

  // FX15 で描いた絵（ja-g16.tsx）の画風（DESINGN.md 6.1）: 輪郭は INK・太さ 3.5、
  // 輪郭のほかの色は 2〜4 色、ハイライトは 1 つまで、文字（text）を描かない
  it.each(['book', 'music-note'])(
    '%s の絵は画風の決まりに合う（色は 2〜4 色・輪郭・文字なし）',
    (id) => {
      const def = getIllust(id)!;
      const { container } = render(createElement('svg', { viewBox: '0 0 100 100' }, def.draw()));
      const shapes = [...container.querySelectorAll('path, rect, ellipse, circle, polygon, line')];
      expect(shapes.length).toBeGreaterThan(0);
      const colors = new Set<string>();
      let highlights = 0;
      for (const s of shapes) {
        const fill = (s.getAttribute('fill') ?? 'none').toUpperCase();
        if (fill === HIGHLIGHT.toUpperCase()) {
          highlights++;
          continue;
        }
        expect(s.getAttribute('stroke'), `${s.tagName} の輪郭`).toBe(INK);
        expect(Number(s.getAttribute('stroke-width')), `${s.tagName} の太さ`).toBe(STROKE);
        if (fill !== 'NONE' && fill !== INK.toUpperCase()) colors.add(fill);
      }
      expect(colors.size, [...colors].join(',')).toBeGreaterThanOrEqual(2);
      expect(colors.size, [...colors].join(',')).toBeLessThanOrEqual(4);
      expect(highlights).toBeLessThanOrEqual(1);
      expect(container.querySelector('text')).toBeNull();
    },
  );
});
