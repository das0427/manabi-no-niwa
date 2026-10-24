/**
 * life-g12 の画面の煙テストと、正答・誤答の判定の確かめ。
 * 各単元の問題（段階ごとに数問）を、そのエンジンの画面と図で描いて例外が出ないこと。
 * 全問題について、正答で「正解」、誤りの例（誤りの選択肢・誤答例・誤りの順など）で「誤り」＋誤概念が返ること。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { audienceUx } from '../../audience/audience';
import { buildRound } from '../../curriculum/round';
import type { Item } from '../../curriculum/types';
import { Figure } from '../../engines/figure/Figure';
import { engineOf } from '../../engines/registry';
import type { RenderCtx } from '../../engines/types';
import pack from './index';

afterEach(cleanup);

const ctxFor = (stage: string): RenderCtx => ({
  packId: 'life-g12',
  readAloud: 'off',
  furigana: 'unlearned',
  learnerGrade: Number(stage.slice(1)),
  preschool: false,
  textScale: 1,
  ux: audienceUx(stage as 'g1'),
});

describe('life-g12 の画面', () => {
  for (const unit of pack.units) {
    it(`${unit.id}: 問題と図を描ける`, () => {
      const ctx = ctxFor(unit.stage);
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
          expect(def.answerText(it), it.id).not.toBe('');
        }
      }
      for (const step of unit.intro)
        if (step.figure) render(<Figure fig={step.figure} ctx={ctx} />).unmount();
    });
  }
});

/** 正答と誤りの例を、判定に通す */
function check(it: Item): string[] {
  const errs: string[] = [];
  const eng = engineOf(it);
  const judge = (res: unknown) => eng.judge(it, res as never);
  switch (it.engine) {
    case 'choice': {
      const right = it.options.flatMap((o, i) => (o.correct ? [i] : []));
      if (judge(right).result !== 'correct') errs.push('正解の選択肢で正解にならない');
      it.options.forEach((o, i) => {
        if (o.correct) return;
        const j = judge([i]);
        if (j.result !== 'wrong') errs.push(`誤りの選択肢 ${i} が誤りにならない`);
        else if (o.misconception && j.misconception !== o.misconception)
          errs.push(`誤りの選択肢 ${i} の誤概念が ${j.misconception}`);
      });
      break;
    }
    case 'number': {
      const ans = it.fields.map((f) => String((f.answer as { value: number }).value));
      if (judge(ans).result !== 'correct') errs.push('正答で正解にならない');
      for (const w of it.wrongAnswers ?? []) {
        const j = judge(w.value.split('|'));
        if (j.result !== 'wrong' || j.misconception !== w.misconception)
          errs.push(`誤答例 ${w.value} が誤概念 ${w.misconception} にならない`);
      }
      break;
    }
    case 'order': {
      const n = it.cards.length;
      const id = Array.from({ length: n }, (_, i) => i);
      if (judge(id).result !== 'correct') errs.push('正しい順で正解にならない');
      for (const a of it.alsoAccept ?? [])
        if (judge(a).result !== 'correct') errs.push(`別の正しい順 ${a} が正解にならない`);
      for (const w of it.wrongOrders ?? []) {
        const j = judge(w.order);
        if (j.result !== 'wrong') errs.push(`誤りの順 ${w.order} が誤りにならない`);
        else if (j.misconception !== w.misconception)
          errs.push(`誤りの順 ${w.order} の誤概念が ${j.misconception}`);
      }
      if (it.reverseMisconception && (it.alsoAccept ?? []).length === 0) {
        const j = judge([...id].reverse());
        if (j.result !== 'wrong') errs.push('逆の順が誤りにならない');
      }
      break;
    }
    case 'sort': {
      const res = it.cards.map((c) => (Array.isArray(c.box) ? c.box[0]! : c.box));
      if (judge(res).result !== 'correct') errs.push('正しい箱で正解にならない');
      break;
    }
    case 'match': {
      if (judge(it.pairs).result !== 'correct') errs.push('正しい組で正解にならない');
      break;
    }
    case 'fill': {
      if (judge(it.blanks.map((b) => b.answers[0]!)).result !== 'correct')
        errs.push('正答で正解にならない');
      break;
    }
    case 'explain': {
      const res = { lines: [[]], aspect: 4 / 3, reasons: [0] };
      if (judge(res).result !== 'correct') errs.push('記録で「できた」にならない');
      if (it.canvas && judge({ ...res, lines: [] }).result === 'correct')
        errs.push('何もかかずに「できた」になる');
      break;
    }
    default:
      break;
  }
  return errs;
}

describe('life-g12 の判定', () => {
  for (const unit of pack.units) {
    it(`${unit.id}: 正答は正解、誤りの例は誤り`, () => {
      if (unit.source.kind !== 'items') return;
      const errs = unit.source.items.flatMap((it) => check(it).map((e) => `${it.id}: ${e}`));
      expect(errs).toEqual([]);
    });
  }
});
