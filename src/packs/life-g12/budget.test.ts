/**
 * 画面の高さの見積もり（作業領域に入るか）。画面は 100u × 56.25u の固定の舞台（--u）で、
 * 問題文（上）・作業領域（まんなか）・ヒントの帯（下 14u）が重ならないようにする必要がある。
 * 実際の画面（ブラウザ）で測った値に合わせた おおざっぱな見積もりで、あふれが大きい問題を見つける。
 *   問題文: 1行 4.8u（最低 7u）、1行は かな 30字ほど。作業領域は 問題文の下 1u から 下の帯の上まで。
 *   選択肢: 最低 10u・字は 3.2u・よこ幅 92u・すきま 2.4u。数の入力: 数字キーが 25u。
 */
import { describe, expect, it } from 'vitest';
import type { Item } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { plainText } from '../../text/rich';
import pack from './index';

const STAGE_H = 56.25;
const BAND = 14;
const PROMPT_TOP = 8;

const len = (s: string) => plainText(s).length;

function promptLines(prompt: string): number {
  return prompt.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(len(l) / 30)), 0);
}

function figureH(f: Figure | undefined): number {
  if (!f) return 0;
  switch (f.kind) {
    case 'svg': {
      const m = /height:calc\(var\(--u\) \* ([\d.]+)\)/.exec(f.markup);
      return m ? Number(m[1]) : 14;
    }
    case 'text':
      return (
        (f.size === 'xl' ? 9 : f.size === 'l' ? 6.5 : 4.8) *
        Math.max(1, Math.ceil(len(f.text) / (f.size === 'xl' ? 12 : f.size === 'l' ? 17 : 25)))
      );
    case 'table':
      return (f.rows.length + 1) * 5.4;
    case 'illust':
      return 9;
    case 'row':
      return Math.max(...f.items.map(figureH), 0);
    case 'column':
      return f.items.reduce((s, x) => s + figureH(x), 0) + 2 * Math.max(0, f.items.length - 1);
    default:
      return 14;
  }
}

function optionsH(item: Item & { engine: 'choice' }, shown: number): number {
  const opts = item.options.slice(0, shown);
  const cells = opts.map((o) => {
    const n = o.label ? len(o.label) : 3;
    const w = Math.min(92, Math.max(14, n * 3.2 + 4.8));
    const lines = Math.ceil((n * 3.2) / (w - 4.8));
    return { w, h: Math.max(10, lines * 4.2 + 2.4) + (o.figure ? figureH(o.figure) : 0) };
  });
  if ((item.layout ?? 'row') === 'column')
    return cells.reduce((s, c) => s + c.h, 0) + 2.4 * (cells.length - 1);
  // よこに ならべて、あふれたら つぎの行
  let rowW = 0;
  let rowH = 0;
  let total = 0;
  for (const c of cells) {
    if (rowW > 0 && rowW + 2.4 + c.w > 92) {
      total += rowH + 2.4;
      rowW = 0;
      rowH = 0;
    }
    rowW += (rowW > 0 ? 2.4 : 0) + c.w;
    rowH = Math.max(rowH, c.h);
  }
  return total + rowH;
}

/** 作業領域の高さの見積もり: [必要, 使える] */
function estimate(item: Item): [number, number] | null {
  const lines = promptLines(item.prompt);
  const promptBottom = PROMPT_TOP + Math.max(7, lines * 4.8);
  const avail = STAGE_H - BAND - Math.max(15, promptBottom + 1);
  const fig = figureH(item.figure);
  const figGap = fig > 0 ? 2 : 0;
  switch (item.engine) {
    case 'choice':
      return [fig + figGap + optionsH(item, 4), avail];
    case 'number':
      return [Math.max(25, fig + 2 + 6.5), avail];
    case 'order':
      return [fig + figGap + (item.ends ? 18 : 16.4), avail];
    default:
      return null;
  }
}

function item_longLabel(it: Item): boolean {
  if (it.engine === 'sort' && promptLines(it.prompt) > 1) return true;
  return it.engine === 'choice' && it.options.some((o) => (o.label ? len(o.label) : 0) > 28);
}

describe('life-g12 の画面の高さ（見積もり）', () => {
  for (const unit of pack.units) {
    it(`${unit.id}: 作業領域に おさまる（あふれは 3u まで）`, () => {
      if (unit.source.kind !== 'items') return;
      const bad: string[] = [];
      for (const it of unit.source.items) {
        const e = estimate(it);
        if (item_longLabel(it)) bad.push(`${it.id}: ラベルが 28字より長い`);
        if (!e) continue;
        if (e[0] - e[1] > 3)
          bad.push(
            `${it.id}: 必要 ${e[0].toFixed(1)}u ／ 使える ${e[1].toFixed(1)}u（問題文 ${promptLines(it.prompt)}行）`,
          );
      }
      if (bad.length) console.info(`[budget] ${unit.id}\n${bad.join('\n')}`);
      expect(bad).toEqual([]);
    });
  }
});
