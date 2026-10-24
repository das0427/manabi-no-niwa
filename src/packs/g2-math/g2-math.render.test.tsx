/**
 * g2-math の画面の煙テスト: 各単元の問題（段階ごとに数問）を、そのエンジンの画面と図で描いて例外が出ないこと。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { audienceUx } from '../../audience/audience';
import { buildRound } from '../../curriculum/round';
import { Figure } from '../../engines/figure/Figure';
import { engineOf } from '../../engines/registry';
import type { RenderCtx } from '../../engines/types';
import pack from './index';

afterEach(cleanup);

const ctx: RenderCtx = {
  packId: 'g2-math',
  readAloud: 'off',
  furigana: 'unlearned',
  learnerGrade: 2,
  preschool: false,
  textScale: 1,
  ux: audienceUx('g2'),
};

describe('g2-math の画面', () => {
  for (const unit of pack.units) {
    it(`${unit.id}: 問題と図を描ける`, () => {
      for (let level = 0; level < unit.levels.length; level++) {
        for (const it of buildRound(unit, { level, seed: 3, count: 6 })) {
          const def = engineOf(it);
          const Comp = def.Component;
          const { unmount } = render(
            <>
              {it.figure ? <Figure fig={it.figure} ctx={ctx} /> : null}
              <Comp
                item={it}
                ctx={ctx}
                revealed={false}
                wrongMark={null}
                disabled={false}
                submit={vi.fn()}
              />
              {it.explainFigure ? <Figure fig={it.explainFigure} ctx={ctx} /> : null}
            </>,
          );
          unmount();
          const r2 = render(
            <Comp item={it} ctx={ctx} revealed wrongMark={null} disabled submit={vi.fn()} />,
          );
          r2.unmount();
          // 図だけの選択肢（分数の図を選ぶ）は answerText が空になる（エンジンの仕様。報告に記載）
          const figureOnly =
            it.engine === 'choice' && it.options.some((o) => o.correct && o.label === undefined);
          if (!figureOnly) expect(def.answerText(it)).not.toBe('');
        }
      }
      for (const step of unit.intro)
        if (step.figure) render(<Figure fig={step.figure} ctx={ctx} />).unmount();
      for (const m of unit.misconceptions)
        if (m.figure) render(<Figure fig={m.figure} ctx={ctx} />).unmount();
    });
  }
});
