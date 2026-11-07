/**
 * 絵の札の幅と絵の大きさ（text-layout-fixes 第7回 X2）。pics.ts の計算（DOM に触らない）。
 * 寸法は 1u = 10px で組む（実機の測った値の比: 札の余白と枠 3u・絵のすき間 0.6u・札の最小の高さ 10u・札のすき間 2.4u）
 */
import { describe, expect, it } from 'vitest';
import {
  PER_ROW,
  PIC_MAX_U,
  PIC_MIN_U,
  cardHeight,
  cardWidth,
  cardWidths,
  chooseArrange,
  fits,
  illustSize,
  isCounting,
  layoutSize,
  picLines,
  picSpecOf,
  picSpecsOf,
  solveFit,
  solveS,
  type PicSpec,
  type PicsCard,
  type PicsEnv,
} from './pics';

const U = 10;
const u = (n: number) => n * U;
const ill = (count?: number) => ({ kind: 'illust', id: 'dog', ...(count ? { count } : {}) });

/** 絵 n この札（fig を渡すとその図の札）。word: 語のラベルの札（最小の幅 14u・ラベルの行ぶん高い） */
const card = (n: number, word = false, fig?: unknown): PicsCard => {
  const spec = picSpecOf(fig ?? ill(n))!;
  return {
    ...spec,
    minW: word ? u(14) : 0,
    padX: u(3),
    minH: u(10),
    below: u(2.2) + (word ? u(4.4) : 0),
  };
};
const env = (over: Partial<PicsEnv> = {}): PicsEnv => ({
  width: u(90),
  height: u(100),
  gapX: u(2.4),
  gapY: u(2.4),
  picGap: u(0.6),
  u: U,
  ...over,
});

describe('picSpecOf（札の中の図の絵の数と既定の大きさ）', () => {
  it('絵 1 種類: 数と、Figure.tsx の既定の大きさ（3 こまで 12u・10 こまで 8u・それ以上 6u）', () => {
    expect(picSpecOf(ill())).toEqual({
      n: 1,
      groups: [{ n: 1, cap: 12 }],
      gap: 0,
      cap: 12,
      minCap: 12,
    });
    expect(picSpecOf(ill(3))?.cap).toBe(12);
    expect(picSpecOf(ill(4))?.cap).toBe(8);
    expect(picSpecOf(ill(10))?.cap).toBe(8);
    expect(picSpecOf(ill(11))).toMatchObject({ n: 11, groups: [{ n: 11, cap: 6 }], cap: 6 });
    expect([1, 3, 4, 10, 11].map(illustSize)).toEqual([12, 12, 8, 8, 6]);
  });
  it('絵だけを並べた行は、まとまりごと（絵の数・既定の大きさ）と、まとまりの間のすき間（gap。既定 2u）', () => {
    const row = { kind: 'row', items: [ill(), ill()], gap: 1.2 };
    expect(picSpecOf(row)).toMatchObject({ n: 2, gap: 1.2, cap: 12, minCap: 12 });
    expect(picSpecOf(row)?.groups).toHaveLength(2);
    expect(picSpecOf({ kind: 'row', items: [ill(3), ill(6)] })).toMatchObject({
      n: 9,
      gap: 2,
      cap: 12,
      minCap: 8,
      groups: [
        { n: 3, cap: 12 },
        { n: 6, cap: 8 },
      ],
    });
  });
  it('絵のほか（時計・図・文字・表）が混じるときは対象にしない', () => {
    expect(picSpecOf({ kind: 'clock', h: 3, m: 0 })).toBeNull();
    expect(picSpecOf({ kind: 'row', items: [ill(), { kind: 'text', text: 'a' }] })).toBeNull();
    expect(picSpecOf(undefined)).toBeNull();
    expect(picSpecsOf([{ figure: ill() }, { figure: { kind: 'clock' } }])).toBeNull();
    expect(picSpecsOf([])).toBeNull();
    expect(picSpecsOf([{ figure: ill(2) }, { figure: ill() }])).toHaveLength(2);
  });
});

describe('数える札（5 こずつの行）', () => {
  const specs = (...ns: number[]): PicSpec[] => ns.map((n) => picSpecOf(ill(n))!);
  it('どれかに絵が 6 こ以上ある問題だけ数える札', () => {
    expect(isCounting(specs(5, 5, 3))).toBe(false);
    expect(isCounting(specs(5, 6, 3))).toBe(true);
    expect(PER_ROW).toBe(5);
  });
  it('6〜10 こは 5＋残り、11 こ以上は 5 のまとまり（5・5・1）の行', () => {
    const rows = (n: number, counting = true) => picLines(picSpecOf(ill(n))!, counting);
    expect(rows(3)).toEqual({ r: 3, k: 1 });
    expect(rows(5)).toEqual({ r: 5, k: 1 });
    expect(rows(6)).toEqual({ r: 5, k: 2 });
    expect(rows(10)).toEqual({ r: 5, k: 2 });
    expect(rows(11)).toEqual({ r: 5, k: 3 });
    expect(rows(15)).toEqual({ r: 5, k: 3 });
    // 数える札でない問題（どれも 5 こまで）は 1 行
    expect(rows(5, false)).toEqual({ r: 5, k: 1 });
  });
  it('絵を並べた行（kind: row）は、数える札ではまとまりを縦に積む（りんご 3 こ・バナナ 6 こ → 5 こ幅・3 行）', () => {
    const row = picSpecOf({ kind: 'row', items: [ill(3), ill(6)] })!;
    expect(picLines(row, true)).toEqual({ r: 5, k: 3 });
    // 数える札でない問題は 1 行に並べる
    expect(picLines(picSpecOf({ kind: 'row', items: [ill(2), ill(3)] })!, false)).toEqual({
      r: 5,
      k: 1,
    });
  });
});

describe('札の幅と高さ', () => {
  it('幅は 絵 r こ ＋ すき間 ＋ 余白。語のラベルの札は最小の幅以上、絵の既定の大きさより大きくならない', () => {
    // 5 こ・s = 6u: 5×6 + 4×0.6 + 3 = 35.4u
    expect(cardWidth(card(5), false, u(6), env())).toBeCloseTo(u(35.4 - 3 + 3));
    // 語の札の 1 こ: 6 + 3 = 9u < 14u なので 14u
    expect(cardWidth(card(1, true), false, u(6), env())).toBeCloseTo(u(14));
    // 4〜10 こは既定 8u: s が 15u でも 8u 止まり
    expect(cardWidth(card(5), false, u(15), env())).toBeCloseTo(u(5 * 8 + 4 * 0.6 + 3));
  });
  it('高さは 絵 k 行 ＋ すき間 ＋ 絵の下の分。札の最小の高さ（10u）以上', () => {
    expect(cardHeight(card(1), false, u(3), env())).toBeCloseTo(u(10));
    // 数える札（7 こ → 2 行）
    expect(cardHeight(card(7), true, u(6), env())).toBeCloseTo(u(2 * 6 + 0.6 + 2.2));
  });
  it('札の幅は 0.1px 単位に切り上げる（切り捨てると 1 行に並べた絵が折れる）', () => {
    const c = [card(3)];
    const w = cardWidths(c, 33.33, env())[0]!;
    expect(w * 10).toBeCloseTo(Math.round(w * 10), 6);
    expect(w).toBeGreaterThanOrEqual(cardWidth(c[0]!, false, 33.33, env()));
  });
});

describe('絵の大きさ s（幅・高さに収まる最大）', () => {
  it('p5.en.picture-book/42 の並び（いぬ 5・1・2・1 の語の札・列の幅 90u）: 札の合計が列にちょうど収まる', () => {
    const cards = [card(5, true), card(1, true), card(2, true), card(1, true)];
    const e = env();
    const s = solveS(cards, 'row', e);
    // 幅: (5s+5.4) + 14 + (2s+3.6) + 14 + すき間 7.2 = 7s + 44.2 = 90 → s = 6.54u
    expect(s / U).toBeCloseTo(6.54, 1);
    expect(fits(cards, 'row', s, e)).toBe(true);
    expect(fits(cards, 'row', s + 1, e)).toBe(false);
    // 絵の札のはみ出し: どの札も、中の絵の列（r × s ＋ すき間）が札の幅に入る
    const widths = cardWidths(cards, s, e);
    cards.forEach((c, i) => {
      const { r } = picLines(c, false);
      expect(widths[i]! - c.padX).toBeGreaterThanOrEqual(
        r * Math.min(s, c.cap * U) + (r - 1) * u(0.6) - 0.01,
      );
    });
  });
  it('上限は 15u、下限は 1u（収まらなくても絵は消さない）', () => {
    expect(solveS([card(1)], 'row', env())).toBeCloseTo(u(PIC_MAX_U));
    expect(solveS([card(5), card(5), card(5), card(5)], 'row', env({ width: u(10) }))).toBeCloseTo(
      u(PIC_MIN_U),
    );
  });
  it('絵を下限にしても収まらないとき（空きが札の最小の高さより小さい）は、札を高くしない最大の s（1u にしない）', () => {
    // 札の最小の高さ 10u・絵の下の分 6.6u（語のラベルの札）: 絵が 3.4u までは札の高さが 10u のまま
    const cards = [card(1, true), card(1, true), card(1, true)];
    const e = env({ height: u(8) });
    const r = solveFit(cards, 'row', e);
    expect(r.ok).toBe(false);
    expect(r.s / U).toBeCloseTo(3.4, 1);
    expect(layoutSize(cards, 'row', r.s, e).h).toBeCloseTo(u(10), 0);
    // 収まる空きなら ok
    expect(solveFit(cards, 'row', env({ height: u(20) })).ok).toBe(true);
  });
  it('高さの上限でも決まる（1 行の札で、空きの高さから札の下の分を引いた分）', () => {
    const cards = [card(1), card(1)];
    // 高さの上限 18u: 絵 s ＋ 下の分 2.2u（最小の高さ 10u より大きくなるのは s > 7.8u）→ s = 15.8 でなく 12u（既定）止まり
    const s = solveS(cards, 'row', env({ height: u(14) }));
    expect(s / U).toBeCloseTo(11.8, 1);
    expect(cardHeight(cards[0]!, false, s, env())).toBeCloseTo(u(14), 0);
  });
  it('数える札は 5 こずつの行: g3.en.numbers-colors/26（7・6・11 こ、高さ 16.25u）は 4u を超える', () => {
    const cards = [card(7), card(6), card(11)];
    const e = env({ width: u(88), height: u(16.25) });
    const s = solveS(cards, 'row', e);
    // 行は 3 行（11 こ）: 3s + 2×0.6 + 2.2 ≦ 16.25 → s = 4.28u
    expect(s / U).toBeCloseTo(4.28, 1);
    expect(s / U).toBeGreaterThanOrEqual(4);
    // 幅は 5 こずつ: 3×(5s + 2.4 + 3) + すき間 4.8 ≦ 88u
    expect(cardWidths(cards, s, e).reduce((a, w) => a + w, 0) + 4.8 * U).toBeLessThanOrEqual(
      u(88) + 1,
    );
  });
});

describe('絵を並べた行の札（g4.en.want/37: 2 しゅるいの かいもの）', () => {
  const fig = (a: number, b: number) => ({ kind: 'row', items: [ill(a), ill(b)] });
  it('数える札の問題では、まとまりを縦に積む: 幅は 5 こぶん・高さは行の数ぶん（1 行に 9 こ並べて 2u にしない）', () => {
    const cards = [card(0, false, fig(3, 6)), card(0, false, fig(6, 3)), card(0, false, fig(4, 5))];
    const e = env({ width: u(88), height: u(16.25) });
    const s = solveS(cards, 'row', e);
    // 縦は 1＋2 行（3 と 6 こ）・まとまりの間 1.2u・絵の下 2.2u: 3s + 0.6 + 1.2 + 2.2 ≦ 16.25 → s = 4.08u（1 行に 9 こ並べると 2.1u）
    expect(s / U).toBeCloseTo(4.08, 1);
    expect(s / U).toBeGreaterThanOrEqual(4);
    expect(fits(cards, 'row', s, e)).toBe(true);
    // 札の幅は 5 こぶん（まとまりの大きいほうの行）で、9 こを 1 行に並べた幅にはならない
    expect(cardWidths(cards, s, e)[0]!).toBeLessThan(9 * Math.min(s, u(8)) + u(2) + u(3));
  });
  it('数える札でない問題（どれも 5 こまで）は、まとまりを 1 行に並べる（行のすき間の分だけ広い）', () => {
    const c = card(0, false, fig(2, 3));
    const w = cardWidth(c, false, u(4), env());
    expect(w).toBeCloseTo(u(2 * 4 + 0.6 + 3 * 4 + 1.2 + 2 + 3));
  });
});

describe('並べ方の比べ方（1 段・2×2、聞く問題は「きく」の札が上・左）', () => {
  /** p5.en.phrases/92: くるま 5・ほし 9・くるま 6・いぬ 5。1280×720（作業領域 26.25u。「きく」の札が上のときの上の分 9u） */
  const phrases = [card(5), card(9), card(6), card(5)];
  const work = 26.25;
  const options = () => {
    const out = [];
    for (const ear of ['top', 'left'] as const)
      for (const shape of ['row', 'grid'] as const) {
        const e = env({
          width: u(ear === 'left' ? 88 - 22 : 88),
          height: u(work - (ear === 'top' ? 9 : 0) - 1),
        });
        out.push({ shape, ear, s: solveS(phrases, shape, e) });
      }
    return out;
  };
  it('2×2・左がいちばん大きく（約 4.3u）、1 段・上は小さい（約 3u）', () => {
    const o = options();
    const s = (shape: string, ear: string) =>
      o.find((x) => x.shape === shape && x.ear === ear)!.s / U;
    expect(s('row', 'top')).toBeGreaterThan(2.8);
    expect(s('row', 'top')).toBeLessThan(3.6);
    expect(s('grid', 'left')).toBeGreaterThan(4.0);
    expect(s('grid', 'left')).toBeLessThan(4.7);
    expect(s('grid', 'left')).toBeGreaterThan(s('row', 'top') * 1.1);
    expect(s('grid', 'left')).toBeGreaterThanOrEqual(Math.max(s('row', 'left'), s('grid', 'top')));
  });
  it('s が最大のものを選ぶ（今の並べ方が 1 段・上でも、はっきり大きければ替える）', () => {
    const best = chooseArrange(options(), { shape: 'row', ear: 'top' }, u(8) * 1);
    expect(best).toMatchObject({ shape: 'grid', ear: 'left' });
  });
  it('収まらない並べ方より、収まる並べ方（ok）を選ぶ。収まる同士は大きいほう', () => {
    const o = [
      { shape: 'row' as const, ear: 'top' as const, s: 90, ok: false },
      { shape: 'grid' as const, ear: 'left' as const, s: 40, ok: true },
      { shape: 'row' as const, ear: 'left' as const, s: 60, ok: true },
    ];
    expect(chooseArrange(o, { shape: 'row', ear: 'top' }, 1000)).toMatchObject({
      ear: 'left',
      shape: 'row',
    });
    // どれも収まらないときは s が最大
    const bad = o.map((x) => ({ ...x, ok: false }));
    expect(chooseArrange(bad, { shape: 'row', ear: 'left' }, 1000)).toMatchObject({ s: 90 });
  });
  it('わずかな差では今の並べ方のまま（行き来しない）', () => {
    const o = [
      { shape: 'row' as const, ear: 'top' as const, s: 100 },
      { shape: 'grid' as const, ear: 'left' as const, s: 105 },
    ];
    expect(chooseArrange(o, { shape: 'row', ear: 'top' }, 1000).shape).toBe('row');
    expect(chooseArrange(o, { shape: 'grid', ear: 'left' }, 1000).shape).toBe('grid');
    // 1.1 倍を超えれば替える
    expect(
      chooseArrange([o[0]!, { ...o[1]!, s: 112 }], { shape: 'row', ear: 'top' }, 1000).shape,
    ).toBe('grid');
  });
  it('絵の既定の大きさ以上は同じとみなす（大きさが同じなら今のまま）。今の並べ方が候補に無ければ先頭', () => {
    const o = [
      { shape: 'row' as const, ear: 'top' as const, s: 150 },
      { shape: 'grid' as const, ear: 'left' as const, s: 400 },
    ];
    expect(chooseArrange(o, { shape: 'row', ear: 'top' }, 120).shape).toBe('row');
    expect(chooseArrange(o, { shape: 'grid', ear: undefined }, 120).shape).toBe('row');
  });
  it('4 つ以外（札が 3 つ）の 2×2 は 1 段より小さくならない（右の列に 3 つ目が 1 枚）', () => {
    const three = [card(1), card(1), card(1)];
    const e = env({ width: u(40), height: u(40) });
    expect(solveS(three, 'row', e)).toBeGreaterThan(0);
    expect(fits(three, 'grid', solveS(three, 'grid', e), e)).toBe(true);
  });
});

describe('p23.math.shop/12 の安全網に頼らない幅（絵が 1 つの札は札の幅を絵に合わせる）', () => {
  it('1 つの札に絵 3 こ（既定 12u）: 札の中の幅 ＝ 絵 3 つ ＋ すき間 2 つ', () => {
    const c = card(3);
    expect(cardWidth(c, false, u(15), env())).toBeCloseTo(u(3 * 12 + 2 * 0.6 + 3));
  });
});
