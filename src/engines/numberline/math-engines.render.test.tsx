/**
 * clock・measure・numberline・graph・geometry の画面の煙テスト（見本の問題を描いて、主な札を押して答えを出せること）。
 * 見本の文のよみ（裸の漢字が無いこと）とヒントの段数も確かめる。
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { audienceUx } from '../../audience/audience';
import { findBareKanji } from '../../text/rich';
import { clockEngine } from '../clock/clock';
import { clockSamples } from '../clock/clock.samples';
import { geometryEngine, geometryTexts } from '../geometry/geometry';
import { geometrySamples } from '../geometry/geometry.samples';
import { graphEngine, graphTexts } from '../graph/graph';
import { graphSamples } from '../graph/graph.samples';
import { measureEngine } from '../measure/measure';
import { measureSamples } from '../measure/measure.samples';
import type { RenderCtx } from '../types';
import type { KitEngineDef } from './kit';
import { numberlineEngine, numberlineTexts } from './numberline';
import { numberlineSamples } from './numberline.samples';

afterEach(cleanup);

const ctx = (preschool: boolean): RenderCtx => ({
  packId: 'test',
  readAloud: 'off',
  furigana: 'unlearned',
  learnerGrade: preschool ? 0 : 3,
  preschool,
  textScale: 1,
  ux: preschool ? audienceUx('p5') : audienceUx('g3'),
});

type AnyDef = KitEngineDef<never, never>;
const sets: [
  string,
  AnyDef,
  { id: string; prompt: string; explain: string; hints: string[] }[],
  (it: never) => string[],
][] = [
  ['clock', clockEngine as unknown as AnyDef, clockSamples, () => []],
  ['measure', measureEngine as unknown as AnyDef, measureSamples, () => []],
  [
    'numberline',
    numberlineEngine as unknown as AnyDef,
    numberlineSamples,
    numberlineTexts as never,
  ],
  ['graph', graphEngine as unknown as AnyDef, graphSamples, graphTexts as never],
  ['geometry', geometryEngine as unknown as AnyDef, geometrySamples, geometryTexts as never],
];

describe.each(sets)('%s の画面', (_name, def, samples, texts) => {
  it.each(samples.map((s) => [s.id, s] as const))('%s を描いて答えを出せる', (_id, s) => {
    const Comp = def.Component;
    const submit = vi.fn();
    const pre = s.hints.length === 2;
    const { container, rerender } = render(
      <Comp
        item={s as never}
        ctx={ctx(pre)}
        revealed={false}
        wrongMark={null}
        disabled={false}
        submit={submit}
      />,
    );
    // 図をタップ（jsdom では位置が 0 になるが、例外が出ないこと）
    for (const svg of Array.from(container.querySelectorAll('svg'))) fireEvent.click(svg);
    // 数字キーがあれば 1 を入れる
    const k1 = screen.queryByTestId('key-1');
    if (k1) {
      for (const f of Array.from(container.querySelectorAll('[data-testid^="field-"]'))) {
        fireEvent.click(f);
        fireEvent.click(k1);
      }
    }
    const check = screen.queryByTestId('check');
    const opt = screen.queryByTestId('opt-0');
    if (check && (check as HTMLButtonElement).disabled && opt) fireEvent.click(opt);
    if (check && !(check as HTMLButtonElement).disabled) fireEvent.click(check);
    else if (opt) fireEvent.click(opt);
    // 作図・線は答えられる状態にならないことがある（タップ位置が 0）。その他は submit される
    if (!['geometry'].includes(_name)) expect(submit).toHaveBeenCalled();
    for (const call of submit.mock.calls)
      expect(() => def.judge(s as never, call[0] as never)).not.toThrow();
    // 正答の表示・誤りの印
    rerender(
      <Comp item={s as never} ctx={ctx(pre)} revealed wrongMark={[0]} disabled submit={submit} />,
    );
    expect(def.answerText(s as never)).not.toBe('');
  });
  it('見本の文に よみの無い漢字が無い', () => {
    for (const s of samples) {
      const all = [s.prompt, s.explain, ...s.hints, ...texts(s as never)];
      for (const t of all) expect(findBareKanji(t), `${s.id}: ${t}`).toEqual([]);
      expect([2, 3]).toContain(s.hints.length);
    }
  });
});
