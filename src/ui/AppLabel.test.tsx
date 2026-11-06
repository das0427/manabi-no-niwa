import { readFileSync } from 'node:fs';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StageId } from '../curriculum/types';
import { AppLabel, labelWrap, searchFit } from './AppLabel';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ctx = { furigana: 'all', learnerGrade: 3 } as const;
const STAGES: StageId[] = ['p23', 'p4', 'p5', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6'];

describe('AppLabel の折り方（中身の段階）', () => {
  it('p23〜g2 は data-wakachi（空白があってもなくても）', () => {
    for (const stage of ['p23', 'p4', 'p5', 'g1', 'g2'] as const) {
      expect(labelWrap(stage, 'さんすう')).toBe('wakachi');
      expect(labelWrap(stage, 'ひき算 の ひっ算')).toBe('wakachi');
    }
  });

  it('g3 以上は、空白で区切って書いた名前なら data-spaced、そうでなければ data-phrase', () => {
    for (const stage of ['g3', 'g4', 'g5', 'g6'] as const) {
      expect(labelWrap(stage, '南東より 南に よった 所')).toBe('spaced');
      expect(labelWrap(stage, '長さの単位とはかり方')).toBe('phrase');
    }
  });

  it('属性は 1 つだけ付く', () => {
    const cases: [StageId, string, string][] = [
      ['p4', 'おすすめ', 'data-wakachi'],
      ['g2', 'たしざん の ひっさん', 'data-wakachi'],
      ['g3', '南東より 南に よった 所', 'data-spaced'],
      ['g6', '同じ読みの言葉', 'data-phrase'],
    ];
    for (const [stage, text, attr] of cases) {
      const { unmount } = render(<AppLabel text={text} stage={stage} ctx={ctx} testId="l" />);
      const el = screen.getByTestId('l');
      for (const a of ['data-wakachi', 'data-spaced', 'data-phrase'])
        expect(el.hasAttribute(a), `${stage} ${text} ${a}`).toBe(a === attr);
      expect(el.className).toContain('app-label');
      unmount();
    }
  });

  it('中身は Rt（ふりがな・分数）で描く', () => {
    render(<AppLabel text="漢字《かんじ》と[[1/2]]" stage="g3" ctx={ctx} testId="l" />);
    const el = screen.getByTestId('l');
    expect(el.querySelector('.rt')).not.toBeNull();
    expect(el.querySelector('ruby')?.textContent).toContain('かんじ');
    expect(el.querySelector('.rt-frac')).not.toBeNull();
  });

  it('fit が無ければ字の大きさに触らない', () => {
    render(<AppLabel text="おすすめ" stage="p4" ctx={ctx} testId="l" />);
    const el = screen.getByTestId('l');
    expect(el.hasAttribute('data-fit')).toBe(false);
    expect(el.style.getPropertyValue('--fit-fs')).toBe('');
    expect(el.className).not.toContain('app-label--fit');
  });

  it('全部の段階で、属性は wakachi・spaced・phrase のどれか 1 つ', () => {
    for (const stage of STAGES) {
      const w = labelWrap(stage, 'あ い う');
      expect(['wakachi', 'spaced', 'phrase']).toContain(w);
    }
  });
});

describe('searchFit（0.1u ずつ下げる）', () => {
  it('最初から入れば fromU のまま', () => {
    expect(searchFit(2.6, 1.8, () => true)).toEqual({ u: 2.6, overflow: false });
  });

  it('入る大きさまで 0.1u ずつ下げる', () => {
    const tried: number[] = [];
    const r = searchFit(2.6, 1.8, (u) => {
      tried.push(u);
      return u <= 2.2;
    });
    expect(r).toEqual({ u: 2.2, overflow: false });
    expect(tried).toEqual([2.6, 2.5, 2.4, 2.3, 2.2]);
  });

  it('下限でも入らなければ下限で overflow', () => {
    const tried: number[] = [];
    const r = searchFit(2.6, 1.8, (u) => {
      tried.push(u);
      return false;
    });
    expect(r).toEqual({ u: 1.8, overflow: true });
    expect(tried[0]).toBe(2.6);
    expect(tried[tried.length - 1]).toBe(1.8);
    expect(tried.length).toBe(9);
  });

  it('文字の大きさの設定（× --ts）で fromU が増えても下限は割らない。端数は 0.1u ずつ', () => {
    const tried: number[] = [];
    const r = searchFit(2.99, 1.7, (u) => {
      tried.push(u);
      return false;
    });
    expect(r).toEqual({ u: 1.7, overflow: true });
    expect(tried[0]).toBe(2.99);
    expect(tried[1]).toBe(2.89);
    expect(Math.min(...tried)).toBe(1.7);
  });

  it('fromU が下限以下なら、下限だけを調べる', () => {
    const tried: number[] = [];
    expect(
      searchFit(1.5, 1.8, (u) => {
        tried.push(u);
        return true;
      }),
    ).toEqual({ u: 1.8, overflow: false });
    expect(tried).toEqual([1.8]);
  });
});

/**
 * jsdom には配置が無い。字の幅 = 字数 × 10px × (--fit-fs の u)、札（親）の内側の幅を決めて、
 * 字の外接（Range.getClientRects）・枠（getBoundingClientRect）・computed style を作る
 */
describe('AppLabel の fit（札の内側に入るまで縮める）', () => {
  let cardW = 60;
  let rangeCalls = 0;
  const fitU = (el: Element): number => {
    const m = /\* ([\d.]+)\)/.exec((el as HTMLElement).style.getPropertyValue('--fit-fs'));
    return m ? Number(m[1]) : 2.6;
  };
  const rect = (l: number, t: number, w: number, h: number) =>
    ({ left: l, top: t, right: l + w, bottom: t + h, width: w, height: h, x: l, y: t }) as DOMRect;
  const rafQueue: FrameRequestCallback[] = [];
  const flushRaf = () => {
    const q = rafQueue.splice(0);
    for (const cb of q) cb(0);
  };
  let roCallbacks: (() => void)[] = [];
  let ts = '1';
  let floor = '1.8';

  beforeEach(() => {
    cardW = 60;
    rangeCalls = 0;
    ts = '1';
    floor = '1.8';
    rafQueue.length = 0;
    roCallbacks = [];
    // 字: 1 字 10px × u。ふりがなは無い（ふりがなの外接は Range が同じように返す）
    Range.prototype.getClientRects = function (this: Range) {
      rangeCalls++;
      const t = this.startContainer as Text;
      const label = t.parentElement!.closest('.app-label')!;
      const k = fitU(label);
      const w = (t.data.length * 10 * k) | 0;
      return [rect(0, 0, w, 10 * k)] as unknown as DOMRectList;
    };
    Element.prototype.getClientRects = function () {
      return [rect(0, 0, 1, 1)] as unknown as DOMRectList;
    };
    Element.prototype.getBoundingClientRect = function (this: Element) {
      // 札（親）だけ幅を決める。名前の箱は札と同じ幅
      return this.classList.contains('card')
        ? rect(0, 0, cardW, 40)
        : this.classList.contains('app-label')
          ? rect(0, 0, cardW, 40)
          : rect(0, 0, 0, 0);
    };
    vi.stubGlobal('getComputedStyle', (el: Element) => {
      const label = el.closest('.app-label');
      const k = label ? fitU(label) : 2.6;
      return {
        fontSize: `${10 * k}px`,
        borderLeftWidth: '0px',
        borderTopWidth: '0px',
        borderRightWidth: '0px',
        borderBottomWidth: '0px',
        paddingLeft: '0px',
        paddingTop: '0px',
        paddingRight: '0px',
        paddingBottom: '0px',
        getPropertyValue: (n: string) => (n === '--ts' ? ts : n === '--text-min-u' ? floor : ''),
      } as unknown as CSSStyleDeclaration;
    });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          roCallbacks.push(cb);
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
  });

  const mount = (text: string, fromU = 2.6) =>
    render(
      <div className="card">
        <AppLabel text={text} stage="p4" ctx={ctx} fit={{ fromU }} testId="l" />
      </div>,
    );

  it('入るまで 0.1u ずつ下げ、--fit-fs と data-fit に書く', () => {
    // 3 字: 幅 30 × u。札の内側 60（+ 余裕 1）→ u ≦ 2.03 → 2.0
    mount('おすす');
    const el = screen.getByTestId('l');
    expect(el.getAttribute('data-fit')).toBe('2');
    expect(el.style.getPropertyValue('--fit-fs')).toBe('calc(var(--u) * 2)');
    expect(el.hasAttribute('data-fit-overflow')).toBe(false);
    expect(el.className).toContain('app-label--fit');
  });

  it('最初から入れば fromU のまま', () => {
    mount('あい');
    expect(screen.getByTestId('l').getAttribute('data-fit')).toBe('2.6');
  });

  it('下限でも入らなければ下限の字で data-fit-overflow', () => {
    // 5 字: 幅 50 × u。下限 1.8 でも 90 > 61
    mount('おすすめだよ');
    const el = screen.getByTestId('l');
    expect(el.getAttribute('data-fit')).toBe('1.8');
    expect(el.hasAttribute('data-fit-overflow')).toBe(true);
  });

  it('--ts（文字の大きさの設定）をかけた大きさから始める。下限は --text-min-u', () => {
    ts = '1.3';
    floor = '2.2';
    mount('おすすめだよ');
    const el = screen.getByTestId('l');
    expect(el.getAttribute('data-fit')).toBe('2.2');
    expect(el.hasAttribute('data-fit-overflow')).toBe(true);
    cleanup();
    ts = '1.3';
    floor = '2.2';
    mount('あ');
    // 2.6 × 1.3 = 3.38
    expect(screen.getByTestId('l').getAttribute('data-fit')).toBe('3.38');
  });

  it('親の札を [data-fit-box] で指定できる（無ければ親要素）', () => {
    render(
      <div className="card" data-fit-box>
        <div className="inner">
          <AppLabel text="おすす" stage="p4" ctx={ctx} fit={{ fromU: 2.6 }} testId="l" />
        </div>
      </div>,
    );
    // inner の幅は 0（stub）。[data-fit-box] の札（60）で見るので 2.0 で入る
    expect(screen.getByTestId('l').getAttribute('data-fit')).toBe('2');
  });

  it('大きさが変わらなければ測り直さない。札の幅が変わったら測り直す', () => {
    mount('おすす');
    const el = screen.getByTestId('l');
    expect(el.getAttribute('data-fit')).toBe('2');
    const before = rangeCalls;
    // 自分で書いた字の大きさで ResizeObserver が鳴っても（同じ大きさ）止まる
    act(() => {
      for (const cb of roCallbacks) cb();
      flushRaf();
    });
    expect(rangeCalls).toBe(before);
    expect(el.getAttribute('data-fit')).toBe('2');
    // 札が狭くなった（40）→ 3 字 × 10 × u ≦ 41 → u ≦ 1.36 → 下限 1.8 で overflow
    cardW = 40;
    act(() => {
      for (const cb of roCallbacks) cb();
      flushRaf();
    });
    expect(rangeCalls).toBeGreaterThan(before);
    expect(el.getAttribute('data-fit')).toBe('1.8');
    expect(el.hasAttribute('data-fit-overflow')).toBe(true);
    // 札が広がったら大きさが戻る
    cardW = 100;
    act(() => {
      for (const cb of roCallbacks) cb();
      flushRaf();
    });
    expect(el.getAttribute('data-fit')).toBe('2.6');
    expect(el.hasAttribute('data-fit-overflow')).toBe(false);
  });

  it('文が変わると測り直す。fit を外すと書いたものを消す', () => {
    const { rerender } = mount('あい');
    expect(screen.getByTestId('l').getAttribute('data-fit')).toBe('2.6');
    rerender(
      <div className="card">
        <AppLabel text="おすすめ" stage="p4" ctx={ctx} fit={{ fromU: 2.6 }} testId="l" />
      </div>,
    );
    // 4 字: 40 × u ≦ 61 → u ≦ 1.52 → 下限 1.8 で overflow
    expect(screen.getByTestId('l').getAttribute('data-fit')).toBe('1.8');
    rerender(
      <div className="card">
        <AppLabel text="おすすめ" stage="p4" ctx={ctx} testId="l" />
      </div>,
    );
    const el = screen.getByTestId('l');
    expect(el.hasAttribute('data-fit')).toBe(false);
    expect(el.hasAttribute('data-fit-overflow')).toBe(false);
    expect(el.style.getPropertyValue('--fit-fs')).toBe('');
  });

  it('大きさが落ち着かなくても測り続けない（揺れの打ち止め）', () => {
    mount('おすす');
    const el = screen.getByTestId('l');
    const before = rangeCalls;
    // 測るたびに札の幅が変わる画面（字の大きさで札が伸び縮みする）
    for (let i = 0; i < 40; i++) {
      cardW = cardW === 60 ? 61 : 60;
      act(() => {
        for (const cb of roCallbacks) cb();
        flushRaf();
      });
    }
    // 1 回の測りで Range を呼ぶ回数は高々 20 回ほど（2.6 → 1.8 の 9 段）。40 回分は測っていない
    expect(rangeCalls - before).toBeLessThan(40 * 9);
    expect(el.getAttribute('data-fit')).not.toBeNull();
  });
});

describe('app-label.css', () => {
  const css = readFileSync('src/ui/app-label.css', 'utf8');

  it('アプリの画面の --text-min（p 2.2u・g1 g2 2.0u・g3 g4 1.8u・g5 g6 1.7u）', () => {
    expect(css).toContain('.stage .screen[data-stage]:not(.unit)');
    const block = (sel: string): string => {
      const i = css.indexOf(sel);
      expect(i, sel).toBeGreaterThanOrEqual(0);
      return css.slice(i, css.indexOf('}', i));
    };
    expect(block('.stage .screen[data-stage]:not(.unit) {')).toContain('--text-min-u: 1.7');
    expect(block(".stage .screen[data-stage='p5']:not(.unit)")).toContain('--text-min-u: 2.2');
    expect(block(".stage .screen[data-stage='g2']:not(.unit)")).toContain('--text-min-u: 2');
    expect(block(".stage .screen[data-stage='g4']:not(.unit)")).toContain('--text-min-u: 1.8');
    expect(block(".stage .screen[data-stage='g6']:not(.unit)")).toContain('--text-min-u: 1.7');
    expect(css).toContain('--text-min: calc(var(--u) * var(--text-min-u))');
  });

  it('折り方は base.css の単元の画面と同じ組み合わせ', () => {
    const rule = (sel: string): string => {
      const i = css.indexOf(sel);
      expect(i, sel).toBeGreaterThanOrEqual(0);
      return css.slice(i, css.indexOf('}', i));
    };
    const spaced = rule('.app-label[data-spaced]');
    expect(spaced).toContain('word-break: keep-all');
    expect(spaced).toContain('overflow-wrap: anywhere');
    expect(spaced).toContain('text-wrap: pretty');
    const phrase = rule('.app-label[data-phrase]');
    expect(phrase).toContain('word-break: auto-phrase');
    expect(phrase).toContain('overflow-wrap: break-word');
    expect(phrase).toContain('min-width: 0');
    expect(phrase).toContain('max-width: 100%');
    expect(phrase).toContain('text-wrap: wrap');
  });
});
