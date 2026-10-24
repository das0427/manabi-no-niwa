/**
 * map・experiment の画面の煙テスト（見本の問題を描いて、主な札を押して答えを出せること。正答の表示で例外が出ないこと）。
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { audienceUx } from '../../audience/audience';
import { findBareKanji } from '../../text/rich';
import { experimentEngine, experimentTexts } from '../experiment/experiment';
import { experimentSamples } from '../experiment/experiment.samples';
import type { KitEngineDef } from '../numberline/kit';
import type { RenderCtx } from '../types';
import { mapEngine, mapTexts } from './map';
import { mapSamples } from './map.samples';

afterEach(cleanup);

const ctx: RenderCtx = {
  packId: 'test',
  readAloud: 'off',
  furigana: 'unlearned',
  learnerGrade: 4,
  preschool: false,
  textScale: 1,
  ux: audienceUx('g4'),
};

type AnyDef = KitEngineDef<never, never>;
const sets: [
  string,
  AnyDef,
  { id: string; prompt: string; explain: string; hints: string[] }[],
  (it: never) => string[],
][] = [
  ['map', mapEngine as unknown as AnyDef, mapSamples, mapTexts as never],
  [
    'experiment',
    experimentEngine as unknown as AnyDef,
    experimentSamples,
    experimentTexts as never,
  ],
];

describe.each(sets)('%s の画面', (name, def, samples, texts) => {
  it.each(samples.map((s) => [s.id, s] as const))('%s を描いて答えを出せる', (_id, s) => {
    const Comp = def.Component;
    const submit = vi.fn();
    const { container, rerender } = render(
      <Comp
        item={s as never}
        ctx={ctx}
        revealed={false}
        wrongMark={null}
        disabled={false}
        submit={submit}
      />,
    );
    for (const svg of Array.from(container.querySelectorAll('svg'))) fireEvent.click(svg);
    // 実験: 2つめの値を選んで やってみる を数回
    const tryBtn = screen.queryByTestId('try');
    if (tryBtn) {
      for (let k = 0; k < 3; k++) {
        const vals = Array.from(
          container.querySelectorAll('[data-testid^="val-"], [data-testid^="next-"]'),
        );
        const v = vals[k % Math.max(1, vals.length)];
        if (v) fireEvent.click(v);
        fireEvent.click(tryBtn);
      }
      expect(container.querySelectorAll('.exp-table tbody tr').length).toBeGreaterThan(0);
      expect(screen.getByTestId('exp-note').textContent).toContain('この アプリの せっていでは');
      const toAnswer = screen.queryByTestId('to-answer');
      if (toAnswer) fireEvent.click(toAnswer);
    }
    // かなのタイル
    const tile = screen.queryByTestId('tile-0');
    if (tile) fireEvent.click(tile);
    const check = screen.queryByTestId('check');
    const opt =
      screen.queryByTestId('opt-0') ??
      container.querySelector('[data-testid^="dir-"]:not(:disabled)');
    if (check && !(check as HTMLButtonElement).disabled) fireEvent.click(check);
    else if (opt) fireEvent.click(opt);
    // 地図をタップする問題は jsdom では位置が 0 で選べないことがある
    if (!(name === 'map' && ['find', 'town'].some((k) => _id.includes(k))))
      expect(submit).toHaveBeenCalled();
    for (const call of submit.mock.calls)
      expect(() => def.judge(s as never, call[0] as never)).not.toThrow();
    rerender(
      <Comp item={s as never} ctx={ctx} revealed wrongMark={[0]} disabled submit={submit} />,
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
