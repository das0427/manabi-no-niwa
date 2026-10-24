/**
 * 自動のレイアウト検査（test-plan.md 3.1）。違反は失敗にせず一覧にして返す。
 * (a) 横スクロール (b) 子供画面の button の大きさ（補助 5.5u・主操作 6u）
 * (c) テキストのはみ出し (d) ホームの札の間隔 ≥ 1.6u (e) ボタンどうしの重なり
 */
import type { Page } from '@playwright/test';

export interface LayoutIssue {
  kind:
    | 'hscroll'
    | 'clipped'
    | 'small-button'
    | 'primary-under-6u'
    | 'text-overflow'
    | 'home-gap'
    | 'overlap';
  desc: string;
  /** 数値の詳細（px / u） */
  detail: Record<string, number | string>;
}

export interface LayoutResult {
  u: number;
  viewport: [number, number];
  buttons: number;
  issues: LayoutIssue[];
}

/** page 内で実行する検査。child=true で子供画面（ボタンの大きさ・重なり・ホームの間隔を見る） */
export async function inspectLayout(page: Page, child: boolean): Promise<LayoutResult> {
  return page.evaluate((isChild) => {
    const issues: LayoutIssue[] = [];
    const w = window.innerWidth;
    const h = window.innerHeight;
    const u = Math.min(w / 100, (h * 1.7778) / 100);
    const r1 = (n: number) => Math.round(n * 10) / 10;

    const describe = (el: Element): string => {
      const e = el as HTMLElement;
      const id = e.getAttribute('data-testid');
      const cls =
        typeof e.className === 'string'
          ? e.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.')
          : '';
      const label = e.getAttribute('aria-label') ?? (e.textContent ?? '').trim().slice(0, 14);
      return `${e.tagName.toLowerCase()}${id ? `[${id}]` : cls ? `.${cls}` : ''}「${label}」`;
    };
    const visible = (el: Element): DOMRect | null => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0)
        return null;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return null;
      if (r.right <= 0 || r.bottom <= 0 || r.left >= w || r.top >= h) return null;
      return r;
    };

    // (a) 横スクロール
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth || document.body.scrollWidth > document.body.clientWidth) {
      issues.push({
        kind: 'hscroll',
        desc: 'document',
        detail: { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth },
      });
    }

    // (b) ボタンの大きさ
    const rects: { el: Element; r: DOMRect }[] = [];
    if (isChild) {
      const stage = document.querySelector('.stage') ?? document.body;
      for (const el of Array.from(stage.querySelectorAll('button'))) {
        const r = visible(el);
        if (!r) continue;
        rects.push({ el, r });
        const side = Math.min(r.width, r.height);
        const cls = (el as HTMLElement).className as string;
        const primary =
          (/\btap\b/.test(cls) && !/tap--aux/.test(cls)) ||
          /\bchoice\b/.test(cls) ||
          /\bhome-card\b/.test(cls);
        if (side < 5.5 * u - 1) {
          issues.push({
            kind: 'small-button',
            desc: describe(el),
            detail: {
              minSidePx: r1(side),
              minSideU: r1(side / u),
              w: r1(r.width / u),
              h: r1(r.height / u),
            },
          });
        } else if (primary && side < 6 * u - 1) {
          issues.push({
            kind: 'primary-under-6u',
            desc: describe(el),
            detail: { minSidePx: r1(side), minSideU: r1(side / u) },
          });
        }
      }
    }

    // (f) 舞台（.stage、overflow: hidden）や画面の外に はみ出して切れている ボタン・文字
    if (isChild) {
      const stageEl = document.querySelector('.stage');
      const sr = stageEl ? stageEl.getBoundingClientRect() : null;
      const bx0 = Math.max(0, sr ? sr.left : 0);
      const by0 = Math.max(0, sr ? sr.top : 0);
      const bx1 = Math.min(w, sr ? sr.right : w);
      const by1 = Math.min(h, sr ? sr.bottom : h);
      const scope = stageEl ?? document.body;
      for (const el of Array.from(scope.querySelectorAll('button, p, span, h1, h2, div'))) {
        if (el.closest('svg')) continue;
        const isBtn = el.tagName === 'BUTTON';
        const hasText = Array.from(el.childNodes).some(
          (n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0,
        );
        if (!isBtn && !hasText) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0)
          continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        if (r.left < bx0 - 1 || r.top < by0 - 1 || r.right > bx1 + 1 || r.bottom > by1 + 1) {
          issues.push({
            kind: 'clipped',
            desc: describe(el),
            detail: {
              left: r1((r.left - bx0) / u),
              top: r1((r.top - by0) / u),
              right: r1((r.right - bx1) / u),
              bottom: r1((r.bottom - by1) / u),
            },
          });
        }
      }
    }

    // (c) テキストのはみ出し（自分の直下にテキストを持つ要素）
    const root = isChild ? (document.querySelector('.stage') ?? document.body) : document.body;
    for (const el of Array.from(root.querySelectorAll('*'))) {
      if (el.closest('svg')) continue;
      const hasText = Array.from(el.childNodes).some(
        (n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0,
      );
      if (!hasText) continue;
      const e = el as HTMLElement;
      if (e.clientWidth === 0) continue;
      if (e.scrollWidth > e.clientWidth + 1 && visible(el)) {
        issues.push({
          kind: 'text-overflow',
          desc: describe(el),
          detail: { scrollWidth: e.scrollWidth, clientWidth: e.clientWidth },
        });
      }
    }

    // (d) ホームの9札の間隔
    if (isChild) {
      const cards = Array.from(document.querySelectorAll('[data-testid^="home-mode-"]'));
      if (cards.length > 0) {
        const rs = cards.map((c) => ({ c, r: c.getBoundingClientRect() }));
        for (let i = 0; i < rs.length; i++) {
          for (let j = i + 1; j < rs.length; j++) {
            const a = rs[i]!.r;
            const b = rs[j]!.r;
            const vOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            const hOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            let gap: number | null = null;
            if (vOverlap > 0) gap = Math.max(a.left, b.left) - Math.min(a.right, b.right);
            else if (hOverlap > 0) gap = Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom);
            if (gap !== null && gap < 1.6 * u - 1) {
              issues.push({
                kind: 'home-gap',
                desc: `${describe(rs[i]!.c)} と ${describe(rs[j]!.c)}`,
                detail: { gapPx: r1(gap), gapU: r1(gap / u) },
              });
            }
          }
        }
      }
    }

    // (e) ボタンの重なり（親子・箱の当たり判定を除く）
    if (isChild) {
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const A = rects[i]!;
          const B = rects[j]!;
          if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
          if (
            /sort-box__hit/.test(A.el.className as string) ||
            /sort-box__hit/.test(B.el.className as string)
          )
            continue;
          const ow = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left);
          const oh = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
          if (ow > 2 && oh > 2) {
            issues.push({
              kind: 'overlap',
              desc: `${describe(A.el)} と ${describe(B.el)}`,
              detail: { overlapU: `${r1(ow / u)}×${r1(oh / u)}` },
            });
          }
        }
      }
    }

    return { u: r1(u), viewport: [w, h] as [number, number], buttons: rects.length, issues };
  }, child) as Promise<LayoutResult>;
}
