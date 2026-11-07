import { describe, expect, it } from 'vitest';
import { isFramed } from './framed';

describe('isFramed（ほかのページの枠の中か）', () => {
  it('ふつうに開いたときは false', () => {
    expect(isFramed()).toBe(false);
    const w = {} as Window;
    expect(isFramed({ self: w, top: w } as unknown as Window)).toBe(false);
  });

  it('枠の中（top が自分でない）なら true', () => {
    expect(isFramed({ self: {} as Window, top: {} as Window } as unknown as Window)).toBe(true);
  });

  it('top を読めない（ほかのオリジンの枠）なら true', () => {
    const w = {
      self: {} as Window,
      get top(): Window {
        throw new DOMException('blocked', 'SecurityError');
      },
    };
    expect(isFramed(w as unknown as Window)).toBe(true);
  });
});
