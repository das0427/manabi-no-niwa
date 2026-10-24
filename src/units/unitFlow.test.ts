import { describe, expect, it } from 'vitest';
import type { Item } from '../curriculum/types';
import {
  canSkip,
  draftOf,
  flowReducer,
  initialFlow,
  restoreFlow,
  type FlowDraft,
} from './unitFlow';

const item = (id: string): Item => ({
  engine: 'number',
  id,
  objective: 'o',
  level: 0,
  prompt: 'p',
  hints: ['h1', 'h2', 'h3'],
  explain: 'e',
  identity: id,
  fields: [{ answer: { kind: 'int', value: 1 } }],
});

describe('単元の流れ', () => {
  it('導入 → 問題 → 正解 → 解説 → 次 → 終わり', () => {
    let s = initialFlow([item('a'), item('b')], true);
    expect(s.phase).toBe('intro');
    s = flowReducer(s, { type: 'intro-next', introLength: 2 });
    expect(s).toMatchObject({ phase: 'intro', introStep: 1 });
    s = flowReducer(s, { type: 'intro-next', introLength: 2 });
    expect(s.phase).toBe('question');
    s = flowReducer(s, { type: 'judged', j: { result: 'correct' } });
    expect(s.phase).toBe('explain');
    expect(s.results[0]!.outcome).toBe('independent');
    s = flowReducer(s, { type: 'next' });
    expect(s).toMatchObject({ phase: 'question', index: 1, hintsShown: 0 });
    s = flowReducer(s, { type: 'judged', j: { result: 'correct' } });
    s = flowReducer(s, { type: 'next' });
    expect(s.phase).toBe('done');
  });

  it('誤答: 誤概念の説明を出し、ヒントを1段進め、2回目で「つぎへ」', () => {
    let s = initialFlow([item('a')], false);
    s = flowReducer(s, {
      type: 'judged',
      j: { result: 'wrong', misconception: 'm1', mark: true },
      misconceptionText: 'せつめい',
    });
    expect(s.message).toEqual({ kind: 'misconception', text: 'せつめい' });
    expect(s.hintsShown).toBe(1);
    expect(canSkip(s)).toBe(false);
    s = flowReducer(s, { type: 'judged', j: { result: 'wrong' } });
    expect(s.message?.kind).toBe('generic-wrong');
    expect(canSkip(s)).toBe(true);
    s = flowReducer(s, { type: 'skip' });
    expect(s.results[0]).toMatchObject({ outcome: 'skipped', misconception: 'm1' });
    expect(s.phase).toBe('explain');
  });

  it('もう一度（形の違い）は誤答に数えない。3回目で誤答', () => {
    let s = initialFlow([item('a')], false);
    s = flowReducer(s, { type: 'judged', j: { result: 'retry', message: 'やくぶん' } });
    expect(s.message).toEqual({ kind: 'retry', text: 'やくぶん' });
    expect(s.q.wrongTries).toBe(0);
    s = flowReducer(s, { type: 'judged', j: { result: 'retry', message: 'やくぶん' } });
    s = flowReducer(s, { type: 'judged', j: { result: 'retry', message: 'やくぶん' } });
    expect(s.q.wrongTries).toBe(1);
    s = flowReducer(s, { type: 'judged', j: { result: 'correct' } });
    expect(s.results[0]!.outcome).toBe('self_corrected');
  });

  it('ヒントは3段まで。最後の段を見たら「つぎへ」。ヒント後の正解は after_hint', () => {
    let s = initialFlow([item('a')], false);
    for (let i = 0; i < 5; i++) s = flowReducer(s, { type: 'hint' });
    expect(s.hintsShown).toBe(3);
    expect(canSkip(s)).toBe(true);
    s = flowReducer(s, { type: 'judged', j: { result: 'correct' } });
    expect(s.results[0]!.outcome).toBe('after_hint');
  });

  it('中断データから、終えた問題の次から再開する', () => {
    const items = [item('a'), item('b'), item('c')];
    let s = initialFlow(items, true);
    s = flowReducer(s, { type: 'intro-next', introLength: 1 });
    s = flowReducer(s, { type: 'judged', j: { result: 'correct' } });
    const d = JSON.parse(JSON.stringify(draftOf(s))) as FlowDraft;
    const r = restoreFlow(items, d);
    expect(r).toMatchObject({ phase: 'question', index: 1 });
    expect(r.results.map((x) => [x.item.id, x.outcome])).toEqual([['a', 'independent']]);
    expect(restoreFlow(items, { done: [...d.done, ...d.done, ...d.done] }).phase).toBe('done');
  });
  it('解説中・終わった後の操作は無視', () => {
    let s = initialFlow([item('a')], false);
    s = flowReducer(s, { type: 'judged', j: { result: 'correct' } });
    expect(flowReducer(s, { type: 'judged', j: { result: 'wrong' } })).toBe(s);
    expect(flowReducer(s, { type: 'hint' })).toBe(s);
  });
});
