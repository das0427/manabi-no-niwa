import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StageId } from '../curriculum/types';
import { SCROLL_PAGE, ScrollList } from './ScrollList';

/** jsdom には配置が無い。枠の見える高さ・中身の高さ・位置を決める */
const m = { clientHeight: 400, scrollHeight: 1000, scrollTop: 0 };
let roCallbacks: (() => void)[] = [];
const scrollBy = vi.fn();

const own = Object.getOwnPropertyDescriptor;
const saved = {
  clientHeight: own(Element.prototype, 'clientHeight'),
  scrollHeight: own(Element.prototype, 'scrollHeight'),
  scrollTop: own(Element.prototype, 'scrollTop'),
};

beforeEach(() => {
  m.clientHeight = 400;
  m.scrollHeight = 1000;
  m.scrollTop = 0;
  roCallbacks = [];
  scrollBy.mockReset();
  Object.defineProperty(Element.prototype, 'clientHeight', {
    configurable: true,
    get: () => m.clientHeight,
  });
  Object.defineProperty(Element.prototype, 'scrollHeight', {
    configurable: true,
    get: () => m.scrollHeight,
  });
  Object.defineProperty(Element.prototype, 'scrollTop', {
    configurable: true,
    get: () => m.scrollTop,
    set: (v: number) => {
      m.scrollTop = v;
    },
  });
  Element.prototype.scrollBy = scrollBy as unknown as typeof Element.prototype.scrollBy;
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.classList.remove('reduce-motion');
  for (const k of ['clientHeight', 'scrollHeight', 'scrollTop'] as const) {
    const d = saved[k];
    if (d) Object.defineProperty(Element.prototype, k, d);
    else delete (Element.prototype as unknown as Record<string, unknown>)[k];
  }
});

const mount = (viewer: StageId) =>
  render(
    <ScrollList
      viewer={viewer}
      className="outer"
      bodyClassName="inner"
      label="日のいちらん"
      testId="list"
    >
      <p data-testid="item">1</p>
    </ScrollList>,
  );

const region = () => screen.getByTestId('list');
const scrollTo = (top: number) => {
  m.scrollTop = top;
  fireEvent.scroll(region());
};
const btn = (dir: 'up' | 'down') =>
  document.querySelector<HTMLElement>(`[data-scroll-btn="${dir}"]`);
const hidden = (el: HTMLElement | null) => el?.style.visibility === 'hidden';

describe('ScrollList の枠', () => {
  it('data-scroll-region="list" の枠に、className・bodyClassName・label・中身が付く', () => {
    const { container } = mount('g3');
    const r = region();
    expect(r.getAttribute('data-scroll-region')).toBe('list');
    expect(r.getAttribute('aria-label')).toBe('日のいちらん');
    expect(r.getAttribute('role')).toBe('region');
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.classList.contains('scroll-list')).toBe(true);
    expect(outer.classList.contains('outer')).toBe(true);
    expect(outer.contains(r)).toBe(true);
    const body = r.firstElementChild as HTMLElement;
    expect(body.classList.contains('scroll-list__body')).toBe(true);
    expect(body.classList.contains('inner')).toBe(true);
    expect(body.contains(screen.getByTestId('item'))).toBe(true);
  });

  it('小学生: 下まで見ていないあいだ data-scroll-cue と ▼ の印。札は無い', () => {
    const { container } = mount('g3');
    expect(region().hasAttribute('data-scroll-cue')).toBe(true);
    expect(container.querySelector('.scroll-list__cue')?.textContent).toBe('▼');
    expect(document.querySelector('[data-scroll-btn]')).toBeNull();
    expect(container.firstElementChild?.hasAttribute('data-buttons')).toBe(false);
  });

  it('小学生: 下まで行くと印が消える。戻ると出る', () => {
    const { container } = mount('g6');
    scrollTo(600); // 600 + 400 = 1000（下まで）
    expect(region().hasAttribute('data-scroll-cue')).toBe(false);
    expect(container.querySelector('.scroll-list__cue')).toBeNull();
    scrollTo(100);
    expect(region().hasAttribute('data-scroll-cue')).toBe(true);
    expect(container.querySelector('.scroll-list__cue')).not.toBeNull();
  });

  it('スクロールするほどの長さが無ければ印を出さない', () => {
    m.scrollHeight = 400;
    const { container } = mount('g1');
    expect(region().hasAttribute('data-scroll-cue')).toBe(false);
    expect(container.querySelector('.scroll-list__cue')).toBeNull();
  });

  it('枠の大きさが変わったら、印を測り直す（ResizeObserver）', () => {
    m.scrollHeight = 400;
    mount('g4');
    expect(region().hasAttribute('data-scroll-cue')).toBe(false);
    m.scrollHeight = 900;
    act(() => {
      for (const cb of roCallbacks) cb();
    });
    expect(region().hasAttribute('data-scroll-cue')).toBe(true);
  });

  it('下まで 2px 以内なら下まで行ったとみなす', () => {
    mount('g2');
    scrollTo(599);
    expect(region().hasAttribute('data-scroll-cue')).toBe(false);
  });
});

describe('ScrollList の ▲▼ の札（幼児）', () => {
  it.each(['p23', 'p4', 'p5'] as const)(
    '%s: 「うえへ」「したへ」の札が付き、余白 7u の目印が付く',
    (v) => {
      const { container } = mount(v);
      expect(btn('up')?.getAttribute('aria-label')).toBe('うえへ');
      expect(btn('down')?.getAttribute('aria-label')).toBe('したへ');
      expect(btn('up')?.textContent).toBe('▲');
      expect(btn('down')?.textContent).toBe('▼');
      expect(container.firstElementChild?.hasAttribute('data-buttons')).toBe(true);
      expect(container.querySelector('.scroll-list__cue')).toBeNull();
      expect(screen.getByTestId('list-up')).toBe(btn('up'));
      expect(screen.getByTestId('list-down')).toBe(btn('down'));
    },
  );

  it.each(['g1', 'g2', 'g3', 'g4', 'g5', 'g6'] as const)('%s: 札は無い', (v) => {
    mount(v);
    expect(document.querySelector('[data-scroll-btn]')).toBeNull();
  });

  it('いちばん上では ▲ を隠し、▼ を出す。data-scroll-cue も付く', () => {
    mount('p4');
    expect(hidden(btn('up'))).toBe(true);
    expect(hidden(btn('down'))).toBe(false);
    expect(region().hasAttribute('data-scroll-cue')).toBe(true);
  });

  it('途中では両方出る。いちばん下では ▼ を隠す', () => {
    mount('p5');
    scrollTo(300);
    expect(hidden(btn('up'))).toBe(false);
    expect(hidden(btn('down'))).toBe(false);
    scrollTo(600);
    expect(hidden(btn('up'))).toBe(false);
    expect(hidden(btn('down'))).toBe(true);
    expect(region().hasAttribute('data-scroll-cue')).toBe(false);
  });

  it('スクロールするほどの長さが無ければ、両方隠す', () => {
    m.scrollHeight = 400;
    mount('p23');
    expect(hidden(btn('up'))).toBe(true);
    expect(hidden(btn('down'))).toBe(true);
  });

  it(`押すと見える高さの ${SCROLL_PAGE} だけ動く（下へ・上へ）`, () => {
    mount('p4');
    fireEvent.click(btn('down')!);
    expect(scrollBy).toHaveBeenLastCalledWith({ top: 400 * SCROLL_PAGE, behavior: 'smooth' });
    scrollTo(320);
    fireEvent.click(btn('up')!);
    expect(scrollBy).toHaveBeenLastCalledWith({ top: -400 * SCROLL_PAGE, behavior: 'smooth' });
    expect(SCROLL_PAGE).toBe(0.8);
  });

  it('動きを減らす設定（アプリの設定）では滑らかにしない', () => {
    document.documentElement.classList.add('reduce-motion');
    mount('p4');
    fireEvent.click(btn('down')!);
    expect(scrollBy).toHaveBeenLastCalledWith({ top: 400 * SCROLL_PAGE, behavior: 'auto' });
  });

  it('動きを減らす設定（端末の設定）でも滑らかにしない', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('prefers-reduced-motion'),
      media: q,
      addEventListener() {},
      removeEventListener() {},
    }));
    mount('p5');
    fireEvent.click(btn('down')!);
    expect(scrollBy).toHaveBeenLastCalledWith({ top: 400 * SCROLL_PAGE, behavior: 'auto' });
  });
});

describe('scroll-list.css', () => {
  const css = readFileSync('src/ui/scroll-list.css', 'utf8');
  const rule = (sel: string): string => {
    const i = css.indexOf(sel);
    expect(i, sel).toBeGreaterThanOrEqual(0);
    return css.slice(i, css.indexOf('}', i));
  };

  it('右の余白は小学生 3.6u・幼児 7u', () => {
    expect(rule('.scroll-list {')).toContain('--scroll-gutter: calc(var(--u) * 3.6)');
    expect(rule('.scroll-list[data-buttons]')).toContain('--scroll-gutter: calc(var(--u) * 7)');
    expect(rule('.scroll-list__region {')).toContain('width: calc(100% - var(--scroll-gutter))');
  });

  it('▼ の印は --text-min の大きさで、paper の地に ink', () => {
    const cue = rule('.scroll-list__cue');
    expect(cue).toContain('font-size: var(--text-min');
    expect(cue).toContain('color: var(--ink)');
    expect(cue).toContain('background: var(--paper)');
  });

  it('▲▼ の札は補助の 5.5u（--tap-aux）で、余白の中央', () => {
    const b = rule('.scroll-list .scroll-list__btn {');
    expect(b).toContain('width: var(--tap-aux)');
    expect(b).toContain('height: var(--tap-aux)');
    expect(b).toContain('(var(--scroll-gutter) - var(--tap-aux)) / 2');
  });
});
