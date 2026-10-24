import { describe, expect, it } from 'vitest';
import { History, MAX_BYTES, MAX_STEPS, type Command } from './history';

function cmd(log: string[], name: string, bytes = 100, disposed?: string[]): Command {
  return {
    label: name,
    bytes,
    undo: () => log.push(`undo ${name}`),
    redo: () => log.push(`redo ${name}`),
    dispose: () => disposed?.push(name),
  };
}

describe('取り消しの履歴（X-SV-09）', () => {
  it('undo / redo の順序', () => {
    const log: string[] = [];
    const h = new History();
    h.push(cmd(log, 'a'));
    h.push(cmd(log, 'b'));
    h.undo();
    h.undo();
    expect(h.undo()).toBeNull();
    h.redo();
    expect(log).toEqual(['undo b', 'undo a', 'redo a']);
    expect(h.canRedo).toBe(true);
  });

  it('新しい操作をしたら やり直しの枝は捨てる（資源も放す）', () => {
    const log: string[] = [];
    const disposed: string[] = [];
    const h = new History();
    h.push(cmd(log, 'a', 100, disposed));
    h.push(cmd(log, 'b', 100, disposed));
    h.undo();
    h.push(cmd(log, 'c', 100, disposed));
    expect(h.canRedo).toBe(false);
    expect(disposed).toEqual(['b']);
    expect(h.bytes).toBe(200);
  });

  it(`手数の上限 ${MAX_STEPS}: 古い手から捨てる`, () => {
    const log: string[] = [];
    const disposed: string[] = [];
    const h = new History();
    for (let i = 0; i < MAX_STEPS + 5; i++) h.push(cmd(log, `s${i}`, 10, disposed));
    expect(h.steps).toBe(MAX_STEPS);
    expect(disposed).toEqual(['s0', 's1', 's2', 's3', 's4']);
    let n = 0;
    while (h.undo()) n++;
    expect(n).toBe(MAX_STEPS);
    expect(log[log.length - 1]).toBe('undo s5');
  });

  it('合計 64MB の上限: 差分のバイト数で古い手から捨てる', () => {
    const h = new History();
    const log: string[] = [];
    const big = 20 * 1024 * 1024;
    for (let i = 0; i < 5; i++) h.push(cmd(log, `b${i}`, big));
    // 20MB × 3 = 60MB までは持てる（4つで 80MB を超える）
    expect(h.steps).toBe(3);
    expect(h.bytes).toBeLessThanOrEqual(MAX_BYTES);
  });

  it('上限より大きい1手でも、最新の1手は残す', () => {
    const h = new History(50, 1000);
    h.push(cmd([], 'small', 10));
    h.push(cmd([], 'huge', 5000));
    expect(h.steps).toBe(1);
    expect(h.canUndo).toBe(true);
  });

  it('やり直しの分もバイト数に数える', () => {
    const h = new History(50, 250);
    const log: string[] = [];
    h.push(cmd(log, 'a', 100));
    h.push(cmd(log, 'b', 100));
    h.undo(); // b はやり直し側に残る（200）
    h.push(cmd(log, 'c', 100)); // b を捨てる → a + c = 200
    expect(h.bytes).toBe(200);
    expect(h.steps).toBe(2);
  });
});
