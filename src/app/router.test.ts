import { describe, expect, it } from 'vitest';
import { parseHash, routeToHash } from './router';

describe('ハッシュの道すじ', () => {
  it('v1 のモードを使う単元: 遊び方の id に _ があっても読める（formula_add）', () => {
    const r = { name: 'legacy', unitId: 'p4.math.classic', variantId: 'formula_add' } as const;
    expect(parseHash(routeToHash(r))).toEqual(r);
  });
  it('札の選ぶ画面・単元', () => {
    expect(parseHash('#/card/p4/math')).toEqual({ name: 'card', stage: 'p4', cardId: 'math' });
    expect(parseHash('#/unit/g1.math.add-basic')).toEqual({
      name: 'unit',
      unitId: 'g1.math.add-basic',
    });
  });
  it('おえかき: 新しい紙をかみ（テンプレート）つきで開く', () => {
    const r = { name: 'draw', artId: 'new', template: 'sea' } as const;
    expect(routeToHash(r)).toBe('#/draw/new/sea');
    expect(parseHash('#/draw/new/sea')).toEqual(r);
    // かみは 'new' のときだけ。不正な ID は無視して白い紙
    expect(parseHash('#/draw/abc/sea')).toEqual({ name: 'draw', artId: 'abc' });
    expect(parseHash('#/draw/new/Sea!')).toEqual({ name: 'draw', artId: 'new' });
  });
});
