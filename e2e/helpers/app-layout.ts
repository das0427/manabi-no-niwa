/**
 * アプリの全画面の配置の検査（npm run check:app-layout。docs/test-plan.md 3.3）。
 * 単元の画面は check:text-layout が全問題を見ている。ここは、それ以外の画面（起動・プロフィール選択・ホーム・
 * ほかの がくねん・選ぶ画面・単元の地図・ノート・さくひん・おえかき・保護者画面）を、同じ考え
 * （重なり・切れ・舞台の外・押せない・小さすぎる字・変な改行）で見る。
 *
 * - 文字の重なり・切れ・改行は textLayoutProbe（helpers/text-layout.ts）を root・adultSel・pageScroll つきで再利用する。
 * - この中の appLayoutProbe は、アプリの画面に特有のもの（押せない札・押す大きさ・並びの間隔・
 *   スクロールの印・札の中に入りきらない題・舞台の外へのはみ出し）を見る。
 * - このファイルの後半に、画面の一覧と行き方（screenDefs）・落ち着くのを待つ処理（settleApp）を置く。
 *
 * 見るもの（kind。違反は失敗にせず一覧にして返す）:
 *   - screen-overflow  … 画面の中身（ボタン・字・図）が舞台の外へ出る。1画面1件で、超えた u と押せない札の名前を書く
 *   - unreachable      … 押せない札（見えている部分が半分未満・中心が舞台の外・中心などが別の要素に隠れる）
 *   - tap-size         … 押す大きさ（子供は補助 5.5u・主操作 6u 未満。大人は高さ 44px 未満）
 *   - tap-gap          … 主操作どうしの間が 1.6u 未満
 *   - scroll-no-cue    … 縦にスクロールする枠に data-scroll-region と見える印（data-scroll-cue）が無い（1枠1件）
 *   - scroll-no-button … 幼児が見る画面のスクロールの枠に ▲▼ の札（data-scroll-btn）が無い
 *   - fit-overflow     … 札の中に、字を下限まで縮めても入らない（data-fit-overflow）
 *   - edge-margin（参考）… 主操作の札の下端・左右が舞台の端から 2u 未満
 *   - missing-illust（参考）… 絵が無くて開発用の点線の枠になっている
 */
import type { Page } from '@playwright/test';
import type { Grade } from '../../src/audience/audience';
import { defaultSettings } from '../../src/core/types';
import { PRESCHOOL_EN_CARDS, showsEnglishCard } from '../../src/curriculum/preschoolEnglish';
import { PRESCHOOL_HOMES } from '../../src/curriculum/preschoolHome';
import type { HomeCard } from '../../src/curriculum/preschoolHome';
import { SUBJECTS, subjectsForGrade } from '../../src/curriculum/subjects';
import type { SubjectDef } from '../../src/curriculum/subjects';
import { UNITS } from './app-layout-fixtures';
import type { ProfileSpec } from './app-layout-fixtures';

export const APP_ISSUE_KINDS = [
  'screen-overflow',
  'unreachable',
  'tap-size',
  'tap-gap',
  'scroll-no-cue',
  'scroll-no-button',
  'fit-overflow',
  'edge-margin',
  'missing-illust',
] as const;
export type AppIssueKind = (typeof APP_ISSUE_KINDS)[number];

/** 種類の日本語の名前（要約に使う） */
export const APP_ISSUE_LABEL: Record<AppIssueKind, string> = {
  'screen-overflow': '画面の中身が舞台の外へ出る',
  unreachable: '押せない札',
  'tap-size': '押す大きさが足りない',
  'tap-gap': '主操作の間が狭い',
  'scroll-no-cue': 'スクロールの印が無い',
  'scroll-no-button': '幼児の画面に ▲▼ の札が無い',
  'fit-overflow': '縮めても札に入らない題',
  'edge-margin': '舞台の端に近い（参考）',
  'missing-illust': '絵が無い（参考）',
};

/** 参考の種類（違反の件数に数えるが、直す対象とは限らない） */
export const APP_REFERENCE_KINDS: readonly AppIssueKind[] = ['edge-margin', 'missing-illust'];

export interface AppIssue {
  kind: AppIssueKind;
  text: string;
  where: string;
  /** 目印を付ける位置（viewport の px。x, y, w, h） */
  rect: [number, number, number, number];
  detail?: string;
}

export interface AppProbeOptions {
  /** 見ている子供の区分（p23 / p4 / p5 / g1〜g6）。p23・p4・p5 のスクロールの枠には ▲▼ の札が要る */
  viewer: string;
  /** 調べる範囲の CSS セレクタ（省略時は .stage）。板が出ているときは板を渡して中だけを見る */
  root?: string;
  /** 大人の範囲（保護者画面・ゲートの板・起動画面の保護者向けの表示）。押す大きさは高さ 44px で見る */
  adultSel?: string;
  /** 画面全体のスクロールの枠（保護者画面）。縦のはみ出しは見ない */
  pageScroll?: string;
  /** 1画面で1種類あたり返す件数の上限 */
  maxPerKind?: number;
}

export interface AppProbeResult {
  u: number;
  viewport: [number, number];
  /** 調べたボタンの数 */
  buttons: number;
  issues: AppIssue[];
}

/** ページの中で検査する */
export function inspectApp(page: Page, opt: AppProbeOptions): Promise<AppProbeResult> {
  return page.evaluate(appLayoutProbe, opt);
}

/**
 * 検査の本体（page.evaluate で文字列にして送るため、外の名前を使わない）。
 * e2e/app-layout-probe.al.ts で、壊した見本を検出すること・普通の画面で誤検出しないことを確かめる。
 *
 * 除くもの（理由。docs/test-plan.md 3.3 にも書く）:
 *   - 鍵（.gate-key）4.5u: DESINGN.md 2章で、子供が間違えて押さないよう意図して小さい。
 *   - おえかきの「くわしく」の色の札（.draw-screen--detailed の color-*・図形の選択板の shape-color-*）4.5u:
 *     19章で意図して小さい（くわしくは小学生向け）。かんたん の色の札は道具欄も図形の選択板も 6u で、数える。
 *   - tap-gap は、選んでいる札（.is-selected）の 8章の持ち上がり（translateY(-1u)）を戻した位置で測る（(4) の注）。
 *   - 板（aria-modal・.draw-panel・.draw-confirm）の後ろ: 板が出ているときは呼び出し側が root を板にして、
 *     後ろの画面は見ない（板で隠すのが設計）。
 *   - 印のある list スクロール（data-scroll-region="list"）: スクロールで見るのが設計なので、中の札を舞台の外・
 *     押せないとは数えない（枠で切られた部分は見えている部分だけで見る）。印が無いときだけ scroll-no-cue で出す。
 */
export function appLayoutProbe(opt: AppProbeOptions): AppProbeResult {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const u = Math.min(W / 100, (H * 1.7778) / 100);
  const maxPerKind = opt.maxPerKind ?? 20;
  const r1 = (n: number) => Math.round(n * 10) / 10;

  const stageEl = document.querySelector('.stage');
  const rootEl = opt.root ? document.querySelector(opt.root) : null;
  const root: Element = rootEl ?? stageEl ?? document.body;
  const inStage = !!stageEl && stageEl.contains(root);
  const sr = inStage && stageEl ? stageEl.getBoundingClientRect() : new DOMRect(0, 0, W, H);
  const S = {
    l: Math.max(0, sr.left),
    t: Math.max(0, sr.top),
    r: Math.min(W, sr.right),
    b: Math.min(H, sr.bottom),
  };
  const pageScrollEl = opt.pageScroll ? document.querySelector(opt.pageScroll) : null;
  const inPageScroll = (el: Element) => !!pageScrollEl && pageScrollEl.contains(el);
  const preViewer = /^(p23|p4|p5)$/.test(opt.viewer);

  const issues: AppIssue[] = [];
  const perKind = new Map<string, number>();
  const seen = new Set<string>();
  const add = (
    kind: AppIssueKind,
    text: string,
    where: string,
    rect: { left: number; top: number; right: number; bottom: number },
    detail?: string,
  ) => {
    const key = `${kind}|${text}|${where}`;
    if (seen.has(key)) return;
    seen.add(key);
    const n = perKind.get(kind) ?? 0;
    if (n >= maxPerKind) return;
    perKind.set(kind, n + 1);
    issues.push({
      kind,
      text: text.replace(/\s+/g, ' ').trim().slice(0, 80),
      where,
      rect: [
        Math.round(rect.left),
        Math.round(rect.top),
        Math.round(rect.right - rect.left),
        Math.round(rect.bottom - rect.top),
      ],
      ...(detail ? { detail } : {}),
    });
  };

  // ---- 補助
  const csCache = new Map<Element, CSSStyleDeclaration>();
  const cs = (el: Element) => {
    let s = csCache.get(el);
    if (!s) {
      s = getComputedStyle(el);
      csCache.set(el, s);
    }
    return s;
  };
  const describe = (el: Element): string => {
    const id = el.getAttribute('data-testid');
    const cls =
      typeof (el as HTMLElement).className === 'string'
        ? (el as HTMLElement).className
            .split(/\s+/)
            .filter((c) => c && c !== 'mnw-tl-mark')
            .slice(0, 2)
            .join('.')
        : '';
    return `${el.tagName.toLowerCase()}${id ? `[${id}]` : ''}${cls ? `.${cls}` : ''}`;
  };
  const textOf = (el: Element) => {
    // ふりがな（rt）は除いた文字（親字だけ）
    let s = '';
    const walk = (n: Node) => {
      if (n.nodeType === 3) s += n.textContent ?? '';
      else if (
        n.nodeType === 1 &&
        (n as Element).tagName !== 'RT' &&
        (n as Element).tagName !== 'RP'
      )
        n.childNodes.forEach(walk);
    };
    walk(el);
    return s.replace(/\s+/g, ' ').trim().slice(0, 60);
  };
  const labelOf = (el: Element) => el.getAttribute('aria-label') ?? textOf(el);
  const shown = (el: Element): boolean => {
    const e = el as Element & { checkVisibility?: (o: Record<string, boolean>) => boolean };
    if (e.checkVisibility)
      return e.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    const s = cs(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0;
  };
  /** 大人の範囲か（opt.adultSel の中、または「（保護者の方へ）」で始まる文） */
  const ADULT_MARK = '（保護者の方へ）';
  const adultCache = new Map<Element, boolean>();
  const isAdult = (el: Element): boolean => {
    const hit = adultCache.get(el);
    if (hit !== undefined) return hit;
    let v = !!opt.adultSel && !!el.closest(opt.adultSel);
    if (!v) {
      const blk = el.closest('p, li, h1, h2, h3');
      v = !!blk && (blk.textContent ?? '').trimStart().startsWith(ADULT_MARK);
    }
    adultCache.set(el, v);
    return v;
  };
  type Box = { l: number; t: number; r: number; b: number };
  const clientBox = (a: Element): Box => {
    const ar = a.getBoundingClientRect();
    const he = a as HTMLElement;
    const l = ar.left + (he.clientLeft || 0);
    const t = ar.top + (he.clientTop || 0);
    return { l, t, r: l + (he.clientWidth || ar.width), b: t + (he.clientHeight || ar.height) };
  };
  /** 要素の外接を、root より内側の祖先の overflow の枠（スクロールの枠など）で切った箱。舞台では切らない */
  const clippedBox = (
    el: Element,
    r: { left: number; top: number; right: number; bottom: number },
  ): Box => {
    const v: Box = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    for (let a = el.parentElement; a && a !== root && a !== document.body; a = a.parentElement) {
      if (a === stageEl) break;
      const s = cs(a);
      const oy = a === pageScrollEl ? 'visible' : s.overflowY;
      if (s.overflowX === 'visible' && oy === 'visible') continue;
      const c = clientBox(a);
      if (s.overflowX !== 'visible') {
        v.l = Math.max(v.l, c.l);
        v.r = Math.min(v.r, c.r);
      }
      if (oy !== 'visible') {
        v.t = Math.max(v.t, c.t);
        v.b = Math.min(v.b, c.b);
      }
    }
    return v;
  };
  const area = (b: Box) => Math.max(0, b.r - b.l) * Math.max(0, b.b - b.t);

  // ---- 集める
  const BTN_SEL =
    'button, [role="button"], [role="tab"], [role="option"], [role="radio"], [role="checkbox"]';
  /** 主操作（DESINGN.md 2章の表。6u）。学年のタブ（.explore-tab・.smap-tab）などは補助の 5.5u で見る */
  const PRIMARY_SEL =
    '.tap:not(.tap--aux), .choice, .home-card, .home-rec, .school-subject, .smap-unit, .gallery-thumb, .draw-tool';
  const ADULT_CTRL_SEL =
    'button, select, textarea, summary, [role="button"], [role="tab"], input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="hidden"])';

  interface Btn {
    el: Element;
    r: DOMRect;
    adult: boolean;
    primary: boolean;
  }
  const buttons: Btn[] = [];
  for (const el of Array.from(root.querySelectorAll(`${BTN_SEL}, ${ADULT_CTRL_SEL}`))) {
    if (!shown(el)) continue;
    if (el.closest('.mnw-tl-mark')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const adult = isAdult(el);
    buttons.push({ el, r, adult, primary: !adult && el.matches(PRIMARY_SEL) });
  }
  // 画面の外（縦）にある、画面全体のスクロールの枠の中のものは、その位置では見ない
  const offscreen = (el: Element, r: { top: number; bottom: number }) =>
    inPageScroll(el) && (r.bottom <= S.t + 1 || r.top >= S.b - 1);
  // 画面の端で半分切れている札も、その位置では見ない（呼び出し側が scrollTop をずらすので、別の位置で全部見える）
  const partlyOffscreen = (el: Element, r: { top: number; bottom: number }) =>
    inPageScroll(el) && (r.top < S.t - 1 || r.bottom > S.b + 1);
  /**
   * 札が入っている、スクロールさせる設計の枠（data-scroll-region で overflow-y が auto・scroll）。無ければ null。
   * 枠の外にはみ出した部分はスクロールで届くので、押せない札に数えない（枠の印と ▲▼ の札は別に見る）
   */
  const scrollRegionOf = (el: Element): Element | null => {
    for (let a = el.parentElement; a && a !== root && a !== document.body; a = a.parentElement) {
      if (!a.hasAttribute('data-scroll-region')) continue;
      const oy = cs(a).overflowY;
      if (oy === 'auto' || oy === 'scroll') return a;
    }
    return null;
  };

  // ---- (1) unreachable: 押せない札
  const unreachableNames: string[] = [];
  for (const { el, r, adult } of buttons) {
    if (adult && !el.matches(BTN_SEL)) continue; // 入力欄・選ぶ欄は押す大きさだけ見る
    if (offscreen(el, r) || partlyOffscreen(el, r)) continue;
    // スクロールの枠の中で、枠の見えている範囲に全部は入っていない札は、スクロールで届く
    const reg = scrollRegionOf(el);
    if (reg) {
      const rc = clientBox(reg);
      if (r.left < rc.l - 1 || r.right > rc.r + 1 || r.top < rc.t - 1 || r.bottom > rc.b + 1)
        continue;
    }
    // 見えている部分: 祖先の枠（スクロールの枠）と舞台で切る
    const c = clippedBox(el, r);
    const v: Box = {
      l: Math.max(c.l, S.l),
      t: pageScrollEl && inPageScroll(el) ? c.t : Math.max(c.t, S.t),
      r: Math.min(c.r, S.r),
      b: pageScrollEl && inPageScroll(el) ? c.b : Math.min(c.b, S.b),
    };
    const full = r.width * r.height;
    const label = labelOf(el);
    let why: string | null = null;
    if (area(v) < full * 0.5) {
      why = `見えている部分が札の半分未満（${Math.round((area(v) / full) * 100)}%）`;
    } else {
      // 中心と四隅の内側（1/4）の点を、見えている部分の中で当たり判定にかける（pointer-events も効く）
      const w = v.r - v.l;
      const h = v.b - v.t;
      const pts: [number, number][] = [
        [(v.l + v.r) / 2, (v.t + v.b) / 2],
        [v.l + w / 4, v.t + h / 4],
        [v.r - w / 4, v.t + h / 4],
        [v.l + w / 4, v.b - h / 4],
        [v.r - w / 4, v.b - h / 4],
      ];
      let blocked = 0;
      let centerBlocker: Element | null = null;
      let firstBlocker: Element | null = null;
      pts.forEach(([x, y], i) => {
        if (x < 0 || y < 0 || x >= W || y >= H) {
          blocked++;
          return;
        }
        const top = document.elementsFromPoint(x, y)[0];
        if (!top || top === el || el.contains(top) || top.contains(el)) return;
        blocked++;
        firstBlocker ??= top;
        if (i === 0) centerBlocker = top;
      });
      if (centerBlocker) why = `中心が別の要素に隠れている（${describe(centerBlocker)}）`;
      else if (blocked >= 3)
        why = `5 点中 ${blocked} 点が別の要素に隠れている（${firstBlocker ? describe(firstBlocker) : '画面の外'}）`;
    }
    if (why) {
      unreachableNames.push(label);
      add('unreachable', label, describe(el), r, why);
    }
  }

  // ---- (2) screen-overflow: 画面の中身が舞台の外へ出る（1画面1件）
  {
    let left = 0;
    let right = 0;
    let top = 0;
    let bottom = 0;
    let count = 0;
    /** はみ出しがいちばん大きい要素（直す手がかり） */
    const worst: { el: Element | null; amount: number } = { el: null, amount: 0 };
    const hit: Box = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
    const consider = (
      el: Element,
      rr: { left: number; top: number; right: number; bottom: number },
    ) => {
      if (rr.right - rr.left < 1 || rr.bottom - rr.top < 1) return;
      const c = clippedBox(el, rr);
      if (c.r - c.l < 1 || c.b - c.t < 1) return; // 枠で全部切れている（スクロールで見る）
      const ps = inPageScroll(el);
      const dl = S.l - c.l;
      const dr = c.r - S.r;
      const dt = ps ? 0 : S.t - c.t;
      const db = ps ? 0 : c.b - S.b;
      const m = Math.max(dl, dr, dt, db);
      if (m <= 1) return;
      count++;
      if (m > worst.amount) {
        worst.el = el;
        worst.amount = m;
      }
      left = Math.max(left, dl);
      right = Math.max(right, dr);
      top = Math.max(top, dt);
      bottom = Math.max(bottom, db);
      hit.l = Math.min(hit.l, c.l);
      hit.t = Math.min(hit.t, c.t);
      hit.r = Math.max(hit.r, c.r);
      hit.b = Math.max(hit.b, c.b);
    };
    for (const { el, r } of buttons) {
      if (offscreen(el, r)) continue;
      consider(el, r);
    }
    for (const el of Array.from(root.querySelectorAll('svg, img, canvas'))) {
      if (el.parentElement?.closest('svg') || el.closest(BTN_SEL)) continue;
      if (!shown(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || offscreen(el, r)) continue;
      consider(el, r);
    }
    const range = document.createRange();
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const p = (n as Text).parentElement;
      if (!p || !(n.textContent ?? '').trim()) continue;
      if (p.closest('script, style, noscript, .visually-hidden, .mnw-tl-mark, svg')) continue;
      if (!shown(p)) continue;
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || offscreen(p, r)) continue;
      consider(p, r);
    }
    if (count > 0) {
      const sides: string[] = [];
      if (bottom > 1) sides.push(`下に ${r1(bottom / u)}u`);
      if (right > 1) sides.push(`右に ${r1(right / u)}u`);
      if (left > 1) sides.push(`左に ${r1(left / u)}u`);
      if (top > 1) sides.push(`上に ${r1(top / u)}u`);
      const names = Array.from(new Set(unreachableNames)).slice(0, 6);
      const scr = root === stageEl ? (root.firstElementChild ?? root) : root;
      add(
        'screen-overflow',
        sides.map((s) => s.replace(/ .*/, '')).join('・'),
        describe(scr),
        {
          left: Math.max(0, hit.l),
          top: Math.max(0, hit.t),
          right: Math.min(W, hit.r),
          bottom: Math.min(H, hit.b),
        },
        `${sides.join('・')} はみ出し（${count} か所）${worst.el ? `。いちばん大きいのは ${describe(worst.el)}` : ''}${names.length ? `。押せない札: ${names.join('、')}` : ''}`,
      );
    }
  }

  // ---- (3) tap-size: 押す大きさ
  for (const { el, r, adult, primary } of buttons) {
    if (offscreen(el, r)) continue;
    if (adult) {
      // 大人は高さ 44px 以上（DESINGN.md 2章の保護者画面）
      if (r.height < 44 - 1)
        add(
          'tap-size',
          labelOf(el) || el.tagName.toLowerCase(),
          describe(el),
          r,
          `高さ ${r1(r.height)}px（大人は 44px 以上）`,
        );
      continue;
    }
    if (!el.matches(BTN_SEL)) continue;
    // 意図して小さい札（理由は関数の注）
    if (el.matches('.gate-key')) continue;
    if (
      el.matches(
        '.draw-screen--detailed :is([data-testid^="color-"], [data-testid^="shape-color-"])',
      )
    )
      continue;
    const side = Math.min(r.width, r.height);
    const need = primary ? 6 : 5.5;
    if (side < need * u - 1)
      add(
        'tap-size',
        labelOf(el),
        describe(el),
        r,
        `${r1(side / u)}u（${primary ? '主操作 6u' : '補助 5.5u'} 以上。${r1(r.width / u)}u × ${r1(r.height / u)}u）`,
      );
  }

  // ---- (4) tap-gap: 主操作どうしの間
  // 間は置いた位置で測る。選んでいる札（.is-selected）は DESINGN.md 8章の「選択中は 1u 持ち上がる」で
  // translateY(-1u) が付き、上の札との間が 1.6u − 1u = 0.6u に見える（おえかきの道具・図形の板）。持ち上がりは
  // 選んだことを示す状態の表示で、並びの間（2章の 1.6u）は持ち上がる前の位置で決まるので、その移動を戻して測る
  // （戻さないと、選んでいる札の上の間がどの並びでも必ず出る誤検出になる）
  {
    const layoutRect = (el: Element, r: DOMRect) => {
      if (!el.matches('.is-selected')) return r;
      const t = cs(el).transform;
      if (!t || t === 'none') return r;
      const m = new DOMMatrixReadOnly(t);
      return new DOMRect(r.left - m.m41, r.top - m.m42, r.width, r.height);
    };
    const prim = buttons
      .filter((b) => b.primary && !offscreen(b.el, b.r))
      .map((b) => ({ ...b, r: layoutRect(b.el, b.r) }));
    for (let i = 0; i < prim.length; i++) {
      for (let j = i + 1; j < prim.length; j++) {
        const A = prim[i]!;
        const Bt = prim[j]!;
        if (A.el.contains(Bt.el) || Bt.el.contains(A.el)) continue;
        const vOverlap = Math.min(A.r.bottom, Bt.r.bottom) - Math.max(A.r.top, Bt.r.top);
        const hOverlap = Math.min(A.r.right, Bt.r.right) - Math.max(A.r.left, Bt.r.left);
        let gap: number | null = null;
        if (vOverlap > 1 && hOverlap <= 0)
          gap = Math.max(A.r.left, Bt.r.left) - Math.min(A.r.right, Bt.r.right);
        else if (hOverlap > 1 && vOverlap <= 0)
          gap = Math.max(A.r.top, Bt.r.top) - Math.min(A.r.bottom, Bt.r.bottom);
        if (gap !== null && gap < 1.6 * u - 1)
          add(
            'tap-gap',
            `${labelOf(A.el)}｜${labelOf(Bt.el)}`,
            `${describe(A.el)} と ${describe(Bt.el)}`,
            {
              left: Math.min(A.r.left, Bt.r.left),
              top: Math.min(A.r.top, Bt.r.top),
              right: Math.max(A.r.right, Bt.r.right),
              bottom: Math.max(A.r.bottom, Bt.r.bottom),
            },
            `間 ${r1(gap / u)}u（1.6u 以上）`,
          );
      }
    }
  }

  // ---- (5) スクロールの枠: 印（scroll-no-cue）と ▲▼ の札（scroll-no-button）
  for (const el of Array.from(root.querySelectorAll('*'))) {
    const he = el as HTMLElement;
    if (he.scrollHeight <= he.clientHeight + 2 || he.clientHeight < 1) continue;
    if (el === pageScrollEl || /^(TEXTAREA|SELECT|INPUT|HTML|BODY)$/.test(el.tagName)) continue;
    if (el.closest('svg')) continue;
    const s = cs(el);
    if (s.overflowY !== 'auto' && s.overflowY !== 'scroll') continue;
    if (!shown(el) || isAdult(el)) continue;
    const rr = el.getBoundingClientRect();
    const scope = el.parentElement ?? el;
    const visibleIn = (sel: string) =>
      Array.from(scope.querySelectorAll(sel)).some((q) => {
        if (!shown(q)) return false;
        const qr = q.getBoundingClientRect();
        return qr.width >= 1 && qr.height >= 1;
      });
    const nums = `scrollHeight ${he.scrollHeight} / clientHeight ${he.clientHeight}`;
    const hasRegion = el.hasAttribute('data-scroll-region');
    if (!hasRegion) {
      add('scroll-no-cue', textOf(el), describe(el), rr, `data-scroll-region が無い（${nums}）`);
    } else if (!el.hasAttribute('data-scroll-cue') && !visibleIn('[data-scroll-cue]')) {
      add(
        'scroll-no-cue',
        textOf(el),
        describe(el),
        rr,
        `スクロールできる印（data-scroll-cue）が無い（${nums}）`,
      );
    }
    if (preViewer && !visibleIn('[data-scroll-btn]'))
      add(
        'scroll-no-button',
        textOf(el),
        describe(el),
        rr,
        `▲▼ の札（data-scroll-btn）が無い（${nums}。幼児はドラッグに頼らない）`,
      );
  }

  // ---- (6) fit-overflow: 縮めても札に入らない題（教材の題を短くする手がかり）
  for (const el of Array.from(root.querySelectorAll('[data-fit-overflow]'))) {
    if (!shown(el)) continue;
    add(
      'fit-overflow',
      textOf(el),
      describe(el),
      el.getBoundingClientRect(),
      `字を下限（data-fit=${el.getAttribute('data-fit') ?? '?'}）まで縮めても入らない`,
    );
  }

  // ---- (7) edge-margin（参考）: 主操作の札が舞台の端に近い
  for (const { el, r, primary } of buttons) {
    if (!primary || offscreen(el, r)) continue;
    const c = clippedBox(el, r);
    // 枠で切れているもの（スクロールの中）は screen-overflow・unreachable で見る
    if (c.l > r.left + 1 || c.r < r.right - 1 || c.t > r.top + 1 || c.b < r.bottom - 1) continue;
    const parts: string[] = [];
    if (S.b - r.bottom < 2 * u - 1 && S.b - r.bottom >= -1)
      parts.push(`下 ${r1((S.b - r.bottom) / u)}u`);
    if (r.left - S.l < 2 * u - 1 && r.left - S.l >= -1) parts.push(`左 ${r1((r.left - S.l) / u)}u`);
    if (S.r - r.right < 2 * u - 1 && S.r - r.right >= -1)
      parts.push(`右 ${r1((S.r - r.right) / u)}u`);
    if (parts.length)
      add(
        'edge-margin',
        labelOf(el),
        describe(el),
        r,
        `舞台の端から ${parts.join('・')}（2u 以上）`,
      );
  }

  // ---- (8) missing-illust（参考）: 絵が無くて開発用の点線の枠になっている
  for (const svg of Array.from(root.querySelectorAll('svg[data-illust]'))) {
    if (!shown(svg)) continue;
    const only = svg.firstElementChild;
    if (svg.childElementCount !== 1 || !only || only.tagName.toLowerCase() !== 'rect') continue;
    if (only.getAttribute('stroke') !== '#c00' || !only.getAttribute('stroke-dasharray')) continue;
    const r = svg.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    add(
      'missing-illust',
      svg.getAttribute('data-illust') ?? '',
      describe(svg.parentElement ?? svg),
      r,
      '絵が登録されておらず、開発用の点線の枠が出ている',
    );
  }

  return { u: r1(u), viewport: [W, H], buttons: buttons.length, issues };
}

// ====================================================================================================
// 画面の一覧（AC-4）と、画面への行き方・落ち着くのを待つ処理。ここから下はページの外（Node）で動く。
// ====================================================================================================

/** 画面サイズ（幅 × 高さ）。1280×620 はブラウザの UI で高さが減った場合。文字の配置の検査（text-layout）と同じ */
export const APP_SIZES: [number, number][] = [
  [1280, 720],
  [1920, 1080],
  [1280, 620],
  [1536, 864],
];

export type AppState = 'fresh' | 'full';

/** 画面を開くときに使う、そのプロフィール・状態で決まる情報 */
export interface ScreenEnv {
  spec: ProfileSpec;
  state: AppState;
  /** v1 のモードを使う単元ごとの、遊び方の選ぶ画面に出る遊び方の id（開発サーバーのモードの一覧から） */
  legacy: Record<string, string[]>;
}

export interface ScreenDef {
  /** 画面の ID（AC-4。MNW_APP_SCREENS で絞るときの名前） */
  id: string;
  state: AppState;
  /** 検査の段階（その画面の中身の段階。分かち書きと最小の字を決める） */
  stage: string;
  /** 開く hash（`/?dev-open` のあとに付ける） */
  hash: string | ((env: ScreenEnv) => string);
  /** 読み込み直して開く（起動画面・保護者画面。hash の変更だけでは開けない画面） */
  reload?: boolean;
  /** 読み込み直すときの URL（既定は `/?dev-open&seed=1` ＋ hash） */
  url?: string;
  /** 開けたとわかる目印（CSS セレクタ） */
  wait: string;
  /** 目印のあとの操作（板を開く・長押し など） */
  steps?: (page: Page, env: ScreenEnv) => Promise<void>;
  /** steps のあとの目印 */
  after?: string;
  /** 検査の範囲（板が出ているときは板）。省略時は .stage */
  root?: string;
  adultSel?: string;
  pageScroll?: string;
  /** false を返すとこのプロフィールには無い画面（遊び方が1つしかない単元の選ぶ画面 など） */
  applicable?: (env: ScreenEnv) => boolean;
  /** 開発用の指定が使えるときだけ出る画面（?dev-setup）。目印が無いときは検査せず「未対応」として残す */
  needs?: string;
}

const UNIT_BY_ID = new Map(UNITS.map((u) => [u.id, u]));

/** 札の単元のうち、子供画面に出すもの（src/app/PreschoolHome.tsx の cardUnits と同じ規則） */
function cardUnitsOf(card: HomeCard, opened: readonly string[]): string[] {
  return card.units.filter((id) => {
    const m = UNIT_BY_ID.get(id);
    return !!m && m.status !== 'planned' && (!m.hiddenByDefault || opened.includes(id));
  });
}

/** 幼児ホームに出る札のうち、単元が 2 つ以上ある札（選ぶ画面が出るもの。えいごを含む） */
function chooserCards(spec: ProfileSpec): HomeCard[] {
  const stage = spec.stage as 'p23' | 'p4' | 'p5';
  const def = PRESCHOOL_HOMES[stage];
  if (!def) return [];
  const settings = (spec.settings ?? ((s) => s))(defaultSettings('x', spec.audience));
  const stage2 = stage === 'p23' && spec.toddlerStage === 2;
  const cards = stage2
    ? def.cards.filter((c) => def.stage2Cards?.includes(c.id))
    : def.cards.slice(0, 9);
  if (showsEnglishCard({ stage2, showPreschoolEnglish: settings.showPreschoolEnglish }))
    cards.push(PRESCHOOL_EN_CARDS[stage]);
  return cards.filter((c) => cardUnitsOf(c, settings.unitsOpened).length >= 2);
}

const EXPLORE_STAGES = ['p23', 'p4', 'p5', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6'] as const;

const HOME = '[data-testid="home"], [data-testid="school-home"]';

/** 保護者ゲートの鍵を 2 秒長押しして、ゲートの板を出す（途中で取り消されたら押し直す） */
async function holdGate(page: Page): Promise<void> {
  const key = page.getByTestId('parent-key');
  for (let i = 0; i < 3; i++) {
    const box = await key.boundingBox();
    if (!box) throw new Error('鍵（parent-key）が見えない');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    try {
      await page.getByTestId('parent-gate').waitFor({ state: 'visible', timeout: 4000 });
      await page.mouse.up();
      return;
    } catch {
      await page.mouse.up();
    }
  }
  throw new Error('保護者ゲートが開かない（長押しが 3 回とも取り消された）');
}

/** 画面を 1 回押す（板を開く操作） */
const press = (testId: string) => async (page: Page) => {
  await page.getByTestId(testId).first().click({ timeout: 15_000 });
};

/** プロフィール 1 人分の画面の一覧（AC-4） */
export function screenDefs(spec: ProfileSpec): ScreenDef[] {
  const out: ScreenDef[] = [];
  const stage = spec.stage;
  const pre = stage === 'p23' || stage === 'p4' || stage === 'p5';
  const school = !pre;
  const both: AppState[] = ['fresh', 'full'];
  const add = (d: Omit<ScreenDef, 'stage'> & { stage?: string }) =>
    out.push({ stage, ...d } as ScreenDef);

  // 起動画面（保護者向けの表示 .start-notes は大人の島）
  add({
    id: 'start',
    state: 'fresh',
    hash: '',
    reload: true,
    url: '/?seed=1',
    wait: '[data-testid="start-button"]:not([disabled])',
    adultSel: '.start-notes',
  });
  if (spec.key === 'p4' || spec.key === 'g3') {
    for (const v of ['preparing', 'renewing', 'failed', 'offline']) {
      add({
        id: `start-setup-${v}`,
        state: 'fresh',
        hash: '',
        reload: true,
        url: `/?seed=1&dev-setup=${v}&dev-notes=2`,
        wait: '[data-testid="start-button"]:not([disabled])',
        needs: '.stage [data-setup], .stage[data-setup]',
        adultSel: '.start-notes',
      });
    }
  }
  if (spec.key === 'p4') {
    add({
      id: 'profile-picker',
      state: 'full',
      hash: '',
      reload: true,
      url: '/?seed=1',
      wait: '[data-testid="start-button"]:not([disabled])',
      steps: async (page) => {
        await page.getByTestId('start-button').click({ timeout: 15_000 });
      },
      after: '[data-testid="profile-picker"]',
    });
  }

  // ホーム
  for (const state of both) add({ id: 'home', state, hash: '#/home', wait: HOME });

  // ほかの がくねん（自分の区分と、9 つの区分のタブ）
  add({ id: 'explore-own', state: 'fresh', hash: '#/explore', wait: '[data-testid="explore"]' });
  for (const st of EXPLORE_STAGES)
    add({
      id: `explore-${st}`,
      state: 'fresh',
      stage: st,
      hash: `#/explore/${st}`,
      wait: `[data-testid="explore"][data-stage="${st}"]`,
    });

  // 幼児の札の選ぶ画面
  if (pre)
    for (const c of chooserCards(spec))
      add({
        id: `card-${c.id}`,
        state: 'fresh',
        hash: `#/card/${stage}/${c.id}`,
        wait: `[data-testid="card-chooser-${c.id}"]`,
      });

  // v1 のモードを使う単元: 遊び方を選ぶ画面と、つづきから？
  if (spec.key === 'p23-3' || spec.key === 'p4') {
    for (const u of UNITS.filter((x) => x.stage === stage && x.legacy && x.status !== 'planned')) {
      add({
        id: `variant-${u.id}`,
        state: 'fresh',
        hash: `#/legacy/${u.id}`,
        wait: '[data-testid="variant-picker"]',
        applicable: (env) => (env.legacy[u.id]?.length ?? 0) >= 2,
      });
      if (spec.key === 'p4')
        add({
          id: `resume-${u.id}`,
          state: 'full',
          hash: (env) => {
            const v = env.legacy[u.id] ?? [];
            return v.length >= 2 ? `#/legacy/${u.id}/${v[0]}` : `#/legacy/${u.id}`;
          },
          wait: '[data-testid="resume-prompt"]',
          applicable: (env) => (env.legacy[u.id]?.length ?? 0) >= 1,
        });
    }
  }

  // 単元の地図（教科 × 学年）。小学生は自分の学年の全教科（fresh・full）。p4 と g3 は全部の教科 × 学年（fresh）
  const pairs: { subject: SubjectDef; grade: Grade; own: boolean }[] = [];
  if (school) {
    const g = spec.grade!;
    for (const s of subjectsForGrade(g)) pairs.push({ subject: s, grade: g, own: true });
  }
  if (spec.key === 'p4' || spec.key === 'g3')
    for (const s of SUBJECTS)
      for (const g of s.grades)
        if (!pairs.some((p) => p.subject.id === s.id && p.grade === g))
          pairs.push({ subject: s, grade: g, own: false });
  for (const p of pairs)
    for (const state of p.own ? both : (['fresh'] as AppState[]))
      add({
        id: `subject-${p.subject.id}-g${p.grade}`,
        state,
        stage: `g${p.grade}`,
        hash: `#/subject/${p.subject.id}/g${p.grade}`,
        wait: `[data-testid="subject-map-${p.subject.id}"]`,
        after: `[data-testid="grade-tab-${p.grade}"][aria-selected="true"]`,
      });

  // がんばりノート
  for (const state of both)
    add({ id: 'notebook', state, hash: '#/notebook', wait: '[data-testid="notebook"]' });

  // さくひん（作品の一覧）: 作品 18 枚＋なぞり・みち 5 枚の full
  if (spec.key === 'p23-3' || spec.key === 'p4' || spec.key === 'g4') {
    const gallery = '[data-testid="gallery-grid"]:not([data-count="-1"])';
    add({
      id: 'gallery',
      state: 'full',
      hash: '#/gallery',
      wait: `${gallery} [data-testid="gallery-open"]`,
    });
    add({
      id: 'gallery-old-view',
      state: 'full',
      hash: '#/gallery',
      wait: `${gallery} [data-testid="gallery-old-open"]`,
      steps: press('gallery-old-open'),
      after: '[data-testid="gallery-old-view"]',
      root: '[data-testid="gallery-old-view"]',
    });
    add({
      id: 'gallery-confirm',
      state: 'full',
      hash: '#/gallery',
      wait: `${gallery} [data-testid="gallery-delete"]`,
      steps: press('gallery-delete'),
      after: '[data-testid="confirm"]',
      root: '[data-testid="confirm"]',
    });
    if (pre)
      add({
        id: 'gallery-confirm-2',
        state: 'full',
        hash: '#/gallery',
        wait: `${gallery} [data-testid="gallery-delete"]`,
        steps: async (page) => {
          await press('gallery-delete')(page);
          await page.getByTestId('confirm-yes').click({ timeout: 15_000 });
        },
        after: '[data-testid="confirm"]:has-text("ほんとうに")',
        root: '[data-testid="confirm"]',
      });
  }

  // おえかき（かんたん・くわしく。板は板の中だけ）
  if (/^(p23-3|p4|g4|g4-left)$/.test(spec.key)) {
    const draw = '[data-testid="draw-screen"] [data-testid="draw-canvas"]';
    add({ id: 'draw', state: 'fresh', hash: '#/draw/new', wait: draw });
    for (const [id, tool, panel] of [
      ['draw-stamp', 'tool-stamp', 'stamp-panel'],
      ['draw-shape', 'tool-shape', 'shape-panel'],
      ['draw-paper', 'tool-new', 'paper-panel'],
    ] as const)
      add({
        id,
        state: 'fresh',
        hash: '#/draw/new',
        wait: draw,
        steps: press(tool),
        after: `[data-testid="${panel}"]`,
        root: `[data-testid="${panel}"]`,
      });
    add({
      id: 'draw-select',
      state: 'fresh',
      hash: '#/draw/new',
      wait: draw,
      steps: async (page) => {
        await press('tool-stamp')(page);
        await page.getByTestId('stamp-panel').waitFor({ state: 'visible', timeout: 15_000 });
        await press('panel-ok')(page);
        await page.getByTestId('stamp-panel').waitFor({ state: 'hidden', timeout: 15_000 });
        const b = (await page.getByTestId('draw-canvas').boundingBox())!;
        const at = { x: b.x + b.width * 0.5, y: b.y + b.height * 0.5 };
        await page.mouse.click(at.x, at.y);
        await press('tool-select')(page);
        await page.mouse.click(at.x, at.y);
      },
      after: '[data-testid="draw-selection"]',
    });
  }

  // 保護者の入り口（ゲート）: 鍵の長押し。板の中だけ・大人
  if (spec.key === 'p4' || spec.key === 'g3')
    add({
      id: 'parent-gate',
      state: 'fresh',
      hash: '#/home',
      wait: '[data-testid="parent-key"]',
      steps: holdGate,
      after: '[data-testid="parent-gate"]',
      root: '[data-testid="parent-gate"]',
      adultSel: '.gate-panel',
    });

  // 保護者画面の各タブ（full）。画面全体がスクロールする大人の画面
  if (/^(p23-2|p4|g3|g6)$/.test(spec.key)) {
    for (const tab of [
      'records',
      'settings',
      'works',
      'memos',
      'profiles',
      'data',
      'packs',
      'about',
    ])
      add({
        id: `parent-${tab}`,
        state: 'full',
        hash: `#/parent/${tab}`,
        reload: true,
        wait: `[data-testid="tab-${tab}"]`,
        root: '.parent-root',
        adultSel: '.parent-root',
        pageScroll: '.parent-root',
      });
    if (spec.key === 'p4')
      add({
        id: 'parent-profiles-confirm',
        state: 'full',
        hash: '#/parent/profiles',
        reload: true,
        wait: '[data-testid="tab-profiles"]',
        steps: async (page) => {
          await page
            .locator('[data-testid^="profile-delete-"]:not([disabled])')
            .first()
            .click({ timeout: 15_000 });
        },
        after: '[data-testid="confirm-dialog"]',
        root: '[aria-modal="true"]',
        adultSel: '.parent-root',
      });
  }

  return spec.only ? out.filter((d) => spec.only!.test(d.id)) : out;
}

/** 画面を開く。戻り値は 'unsupported'（needs の目印が出ない）／'skipped'（applicable が false）／'ok' */
export async function openScreen(
  page: Page,
  def: ScreenDef,
  env: ScreenEnv,
  dirty: { value: boolean },
): Promise<'ok' | 'unsupported' | 'skipped'> {
  if (def.applicable && !def.applicable(env)) return 'skipped';
  const hash = typeof def.hash === 'function' ? def.hash(env) : def.hash;
  const here = await page.evaluate(() => ({
    dev: location.search.includes('dev-open'),
    hash: location.hash,
  }));
  const reload = def.reload || dirty.value || !here.dev || here.hash === hash;
  if (reload) {
    await page.goto('about:blank');
    await page.goto(def.url ?? `/?dev-open&seed=1${hash}`, { waitUntil: 'domcontentloaded' });
  } else {
    await page.evaluate((h) => {
      location.hash = h;
    }, hash);
  }
  dirty.value = false;
  await page.waitForSelector(def.wait, { state: 'visible', timeout: 60_000 });
  if (def.needs) {
    const ok = await page
      .waitForSelector(def.needs, { state: 'attached', timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (!ok) return 'unsupported';
  }
  if (def.steps) {
    dirty.value = true;
    await def.steps(page, env);
  }
  if (def.after) await page.waitForSelector(def.after, { state: 'visible', timeout: 20_000 });
  return 'ok';
}

/**
 * v1 のモードを使う単元ごとの、遊び方の選ぶ画面に出る遊び方の id（ModeEntry の available と同じ規則）を、
 * 開発サーバーのモードの一覧から読む
 */
export async function readLegacyVariants(
  page: Page,
  units: { id: string; modeId: string; variants?: string[] }[],
): Promise<Record<string, string[]>> {
  return page.evaluate(async (list) => {
    const path = '/src/modes/registry.ts';
    const m = await import(path);
    const out: Record<string, string[]> = {};
    for (const u of list) {
      const mode = m.MODE_BY_ID[u.modeId];
      if (!mode) continue;
      out[u.id] = mode.variants
        .filter(
          (v: { id: string; available?: unknown }) =>
            (!v.available || u.variants !== undefined) &&
            (!u.variants || u.variants.includes(v.id)),
        )
        .map((v: { id: string }) => v.id);
    }
    return out;
  }, units);
}

/**
 * 描き直しが終わるのを待つ（settle）。次の印が 4 フレーム続けて同じになるまで（最大 1 秒）。
 * 印: フォントの読み込み・img の complete の数・ボタンの数と外接・[data-fit] の値・スクロールの枠の scrollHeight。
 * 理由: reducedMotion: 'reduce' ではアニメーションを待てないので、画面サイズを変えた直後の
 * 「ResizeObserver → React の状態 → 描き直し」の途中を測ってしまう。
 * 終わらない画面は false を返し、呼び出し側が違反の detail の先頭に「unstable:」を付けて残す。
 */
export async function settleApp(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 5000))]);
    const mark = (): string => {
      const parts: string[] = [document.fonts.status];
      const imgs = Array.from(document.images);
      parts.push(`img:${imgs.filter((i) => i.complete).length}/${imgs.length}`);
      const btns = Array.from(document.querySelectorAll('button, [role="button"], [role="tab"]'));
      parts.push(
        `btn:${btns.length}:${btns
          .slice(0, 300)
          .map((b) => {
            const r = b.getBoundingClientRect();
            return `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`;
          })
          .join(';')}`,
      );
      parts.push(
        `fit:${Array.from(document.querySelectorAll('[data-fit]'))
          .map((e) => e.getAttribute('data-fit'))
          .join(',')}`,
      );
      parts.push(
        `scroll:${Array.from(document.querySelectorAll('[data-scroll-region]'))
          .map((e) => (e as HTMLElement).scrollHeight)
          .join(',')}`,
      );
      return parts.join('|');
    };
    // 有限のアニメーション（reduce でも残るもの）は終わるまで待つ（最大 1 秒）。印だけでは transform・opacity の動きが見えない
    const anims = document
      .getAnimations()
      .filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity);
    if (anims.length)
      await Promise.race([
        Promise.all(anims.map((a) => a.finished.catch(() => null))),
        new Promise((r) => setTimeout(r, 1000)),
      ]);
    const t0 = performance.now();
    let prev = mark();
    let same = 0;
    while (same < 4 && performance.now() - t0 < 1000) {
      await frame();
      const now = mark();
      same = now === prev ? same + 1 : 0;
      prev = now;
    }
    return same >= 4;
  });
}
