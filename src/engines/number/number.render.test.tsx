/**
 * number の画面: 単位・兆の数・筆算（ますに入れて答えを出す・メモは採点しない）。
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { audienceUx } from '../../audience/audience';
import { findBareKanji } from '../../text/rich';
import type { RenderCtx } from '../types';
import { numberEngine } from './number';
import { numberSamples } from './number.samples';

afterEach(cleanup);

const ctx: RenderCtx = {
  packId: 'test',
  readAloud: 'off',
  furigana: 'unlearned',
  learnerGrade: 3,
  preschool: false,
  textScale: 1,
  ux: audienceUx('g3'),
};
const sample = (id: string) => numberSamples.find((s) => s.id === `number-sample:${id}`)!;
const Comp = numberEngine.Component;
const press = (...keys: string[]) => {
  for (const k of keys) fireEvent.click(screen.getByTestId(k === 'back' ? 'key-back' : `key-${k}`));
};

describe('number の画面', () => {
  it('単位を欄の後ろに出す', () => {
    const submit = vi.fn();
    render(<Comp item={sample('unit')} ctx={ctx} revealed={false} wrongMark={null} disabled={false} submit={submit} />);
    expect(screen.getByTestId('unit-0').textContent).toBe('cm');
    const field = screen.getByTestId('field-0');
    expect(field.nextElementSibling).toBe(screen.getByTestId('unit-0'));
    press('1', '0', '0');
    fireEvent.click(screen.getByTestId('check'));
    expect(submit).toHaveBeenCalledWith(['100']);
  });

  it('兆の数（13けた）が入る。区切りは表示だけ', () => {
    const submit = vi.fn();
    render(<Comp item={sample('big')} ctx={ctx} revealed={false} wrongMark={null} disabled={false} submit={submit} />);
    press('3', ...Array.from({ length: 12 }, () => '0'));
    expect(screen.getByTestId('field-0').textContent).toBe('3000000000000');
    expect(screen.getByTestId('field-0').querySelectorAll('.num-group__g--sep').length).toBe(3);
    fireEvent.click(screen.getByTestId('check'));
    expect(submit).toHaveBeenCalledWith(['3000000000000']);
    expect(numberEngine.judge(sample('big'), submit.mock.calls[0]![0] as string[]).result).toBe(
      'correct',
    );
  });

  it('筆算のたし算: 一の位から左へ入る。メモは答えに入らない', () => {
    const submit = vi.fn();
    const it1 = sample('col-add');
    render(<Comp item={it1} ctx={ctx} revealed={false} wrongMark={null} disabled={false} submit={submit} />);
    expect(screen.getByTestId('column')).toBeTruthy();
    // メモに 1 を入れる
    fireEvent.click(screen.getByTestId('memo-0'));
    press('1', '1');
    expect(screen.getByTestId('memo-0').textContent).toBe('11');
    // 答えの一の位（いちばん右のます）から 3 → 4 → 8
    fireEvent.click(screen.getByTestId('cell-0-3'));
    press('3', '4', '8');
    expect(screen.getByTestId('cell-0-1').textContent).toBe('8');
    expect(screen.getByTestId('cell-0-3').textContent).toBe('3');
    // けす: いまの ますを消す。空なら 1つ前（右）の ますを消して そこへ
    press('9', 'back');
    expect(screen.getByTestId('cell-0-0').textContent).toBe('');
    press('back');
    expect(screen.getByTestId('cell-0-1').textContent).toBe('');
    press('8');
    expect(screen.getByTestId('cell-0-1').textContent).toBe('8');
    fireEvent.click(screen.getByTestId('check'));
    expect(submit).toHaveBeenCalledWith(['843']);
    expect(numberEngine.judge(it1, ['843']).result).toBe('correct');
  });

  it('筆算のかけ算（部分積）・わり算: 欄ごとの値で答える。正答の表示', () => {
    const submit = vi.fn();
    const mul = sample('col-mul2');
    const { rerender } = render(
      <Comp item={mul} ctx={ctx} revealed={false} wrongMark={null} disabled={false} submit={submit} />,
    );
    // 1だんめ 115（3ます）・2だんめ 92（3ます: 一の位の列には無い）・答え 1035（4ます）
    expect(screen.queryByTestId('cell-0-3')).toBeNull();
    expect(screen.queryByTestId('cell-1-3')).toBeNull();
    fireEvent.click(screen.getByTestId('cell-0-2'));
    press('5', '1', '1');
    fireEvent.click(screen.getByTestId('cell-1-2'));
    press('2', '9');
    expect((screen.getByTestId('check') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('cell-2-3'));
    press('5', '3', '0', '1');
    fireEvent.click(screen.getByTestId('check'));
    expect(submit).toHaveBeenLastCalledWith(['115', '92', '1035']);
    rerender(<Comp item={mul} ctx={ctx} revealed wrongMark={true} disabled submit={submit} />);
    expect(screen.getByTestId('cell-1-1').textContent).toBe('9');

    cleanup();
    const div = sample('col-div');
    render(<Comp item={div} ctx={ctx} revealed={false} wrongMark={null} disabled={false} submit={submit} />);
    // わり算は左から右へ。商は 一の位の上（2つめのます）
    fireEvent.click(screen.getByTestId('cell-0-1'));
    press('9');
    fireEvent.click(screen.getByTestId('cell-1-0'));
    press('7', '2');
    fireEvent.click(screen.getByTestId('cell-2-1'));
    press('3');
    fireEvent.click(screen.getByTestId('check'));
    expect(submit).toHaveBeenLastCalledWith(['9', '72', '3']);
    expect(numberEngine.judge(div, ['9', '72', '3']).result).toBe('correct');
  });

  it('全部の見本を描ける（正答の表示・誤りの印）。見本の文に よみの無い漢字が無い', () => {
    for (const s of numberSamples) {
      const { unmount } = render(
        <Comp item={s} ctx={ctx} revealed wrongMark={true} disabled submit={vi.fn()} />,
      );
      unmount();
      for (const t of [s.prompt, s.explain, ...s.hints]) expect(findBareKanji(t), `${s.id}: ${t}`).toEqual([]);
    }
  });
});
