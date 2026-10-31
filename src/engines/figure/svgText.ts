/**
 * SVG の文字の最小（docs/expansion/text-layout-fixes.md S6、DESINGN.md 17章）。
 * SVG の文字の大きさは viewBox の単位で決まるので、図が小さく描かれると画面では最小を割る。
 * ここでは「画面の px ÷ viewBox の単位」を測り、補助の文字の最小（--text-min）を viewBox の単位に直す。
 * 各描画は fontSize = max(既定, floor) にする（CSS では font-size: max(20px, var(--svg-floor, 0px))）。
 */
import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

/**
 * 最小に足す余裕（2%）。拡大率の丸めや、あとからの fit の変化で、最小ちょうどの字が 0.97〜0.99 倍に
 * 割り込むのを防ぐ（text-layout-fixes.md 第4回 V7）
 */
export const TEXT_MIN_MARGIN = 1.02;

/** --text-min が無い（S1 より前の）ときの既定: 1.8u */
const FALLBACK_MIN = 'calc(var(--u) * 1.8)';

/** --text-min を px にして返す（要素の位置で解決。--u の変数を使う式でも解ける） */
export function textMinPx(from: Element): number {
  const host = from.parentElement ?? document.body;
  const probe = document.createElement('span');
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;font-size:var(--text-min, ${FALLBACK_MIN})`;
  host.appendChild(probe);
  const px = parseFloat(getComputedStyle(probe).fontSize);
  probe.remove();
  return Number.isFinite(px) ? px : 0;
}

/**
 * SVG が画面で1 viewBox 単位あたり何 px か（0 なら測れない）。
 * 表示の枠（CSS の幅・高さ）から求める。出てくる動き（拡大の動き）の途中の transform には左右されない。
 * 高さに上限がある図（preserveAspectRatio で幅より小さく描かれる）も、幅と高さの小さいほうで測る。
 */
export function pxPerUnit(svg: Element, viewBoxWidth: number): number {
  const cs = getComputedStyle(svg);
  // 描く領域は内容の箱（枠・余白の内側）。box-sizing: border-box の余白・枠の分だけ、width・height より小さい
  const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const w =
    (svg as SVGSVGElement).clientWidth > 0
      ? (svg as SVGSVGElement).clientWidth - padX
      : parseFloat(cs.width);
  const h =
    (svg as SVGSVGElement).clientHeight > 0
      ? (svg as SVGSVGElement).clientHeight - padY
      : parseFloat(cs.height);
  const vb = (svg as SVGSVGElement).viewBox?.baseVal;
  // viewBox が広げられている（useWidenToText・liftSvgText）ときは、いまの幅で測る
  const vbw = vb && vb.width > 0 ? vb.width : viewBoxWidth;
  if (!(vbw > 0) || !(w > 0)) return 0;
  const byW = w / vbw;
  if (vb && vb.width > 0 && vb.height > 0 && h > 0) return Math.min(byW, h / vb.height);
  return byW;
}

/**
 * 大きさの変化を見て fn を呼ぶ。寸法を書き換える処理は観測の通知の中で行うと
 * 「ResizeObserver loop」になるので、次のフレームにまとめて行う。戻り値は止める関数
 */
export function observeResize(targets: Element[], fn: () => void): () => void {
  if (typeof ResizeObserver === 'undefined') return () => undefined;
  let raf = 0;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(fn);
  });
  for (const t of targets) ro.observe(t);
  return () => {
    ro.disconnect();
    cancelAnimationFrame(raf);
  };
}

/** 補助の文字の最小を viewBox の単位で返す（測れる前は 0）。ref は <svg>、viewBoxWidth はその viewBox の幅 */
export function useSvgTextFloor(
  ref: RefObject<Element | null>,
  viewBoxWidth: number,
  minUnits?: number,
): number {
  const [floor, setFloor] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const ppu = pxPerUnit(el, viewBoxWidth);
      const min = minUnits === undefined ? textMinPx(el) : 0;
      const next = ppu > 0 ? (minUnits ?? (min * TEXT_MIN_MARGIN) / ppu) : 0;
      // 0.1 単位に切り上げて（四捨五入だと最小をわずかに割る: 1.998u）、わずかな揺れで描き直さない
      setFloor((prev) => (prev >= next && prev - next < 0.1 ? prev : Math.ceil(next * 10) / 10));
    };
    measure();
    // viewBox を広げた（useWidenToText）ら、1 単位あたりの px が変わるので測り直す
    const mo =
      typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => measure());
    mo?.observe(el, { attributes: true, attributeFilter: ['viewBox'] });
    const stop = observeResize([el], measure);
    return () => {
      mo?.disconnect();
      stop();
    };
  }, [ref, viewBoxWidth, minUnits]);
  return floor;
}

/** CSS から使う変数（font-size: max(20px, var(--svg-floor, 0px))）。単位は viewBox の単位 = SVG 内の px */
export function floorStyle(floor: number): CSSProperties {
  return { ['--svg-floor' as string]: `${floor}px` };
}

/**
 * パックが用意した SVG（dangerouslySetInnerHTML）の <text> を最小まで引き上げ、
 * 文字が viewBox の外に出るときは viewBox を文字の外接まで広げる（clipped: text ⊂ svg）。
 * 文字の大きさが viewBox の単位で直に書かれているので、描画のあとに測って直す。
 */
export function liftSvgText(root: Element, opts?: { fitWidth?: boolean }): void {
  const min = textMinPx(root);
  for (const svg of Array.from(root.querySelectorAll('svg'))) {
    const d = svg.dataset;
    // 直前の直しを戻してからやり直す（大きさが変わったときに縮められるように）
    if (d.vb0) svg.setAttribute('viewBox', d.vb0);
    if (d.w0) svg.setAttribute('width', d.w0);
    if (d.h0) svg.setAttribute('height', d.h0);
    const texts = Array.from(svg.querySelectorAll('text'));
    for (const t of texts) {
      t.style.fontSize = '';
      delete t.dataset.fs0;
    }
    if (opts?.fitWidth) fitWidthToText(svg, texts, min);
    // 引き上げると外接が広がり、viewBox を広げると拡大率が下がる。収まるまで数回くり返し、
    // 最後は広げずに引き上げだけやり直す（広げた直後の拡大率で最小を満たす）
    let widened = false;
    for (let pass = 0; pass < 8; pass++) {
      if (!lift(svg, texts, min)) break;
      widened = widenToText(svg, texts);
      if (!widened) break;
    }
    if (widened) {
      lift(svg, texts, min);
      // 最後の引き上げで外接がまた viewBox を超えたら、字は切らずに広げる（拡大率の下がりはわずか）
      widenToText(svg, texts);
    }
  }
}

/**
 * width を書いていない図の幅: 一番小さい字が最小（--text-min）の 1.05 倍になる幅 = vbW × 1.05 ÷ f × --text-min。
 * 画面の大きさ（--u）が変わっても JS で測り直さずに済むよう、倍率 K = vbW × 1.05 ÷ f だけを --fig-k に書く
 * （幅は CSS の calc(var(--text-min) * var(--fig-k))）。下限の 23u と親の幅（上限）も CSS 側（figure.css の .fig-svg）。
 * <g transform> の中の字は字ごとの拡大率で換算する。測れないとき・width を書いた図は何もしない（--fig-k を消す）。
 * あわせて縦横比を --fig-ar に書く（number.css が図の段で縮める下限に使う）
 */
function fitWidthToText(svg: SVGSVGElement, texts: SVGTextElement[], min: number): void {
  svg.style.removeProperty('--fig-k');
  svg.style.removeProperty('--fig-ar');
  if (svg.hasAttribute('width') || !(min > 0)) return;
  const vb = svg.viewBox.baseVal;
  const ctm = svg.getScreenCTM?.();
  if (!vb || !(vb.width > 0) || !ctm) return;
  const inv = ctm.inverse();
  let f = Infinity;
  for (const t of texts) {
    if (!t.textContent?.trim()) continue;
    const fs = parseFloat(getComputedStyle(t).fontSize);
    const tc = (t as SVGGraphicsElement).getScreenCTM?.();
    if (!Number.isFinite(fs) || fs <= 0 || !tc) continue;
    const m = inv.multiply(tc);
    const k = Math.min(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d));
    if (Number.isFinite(k) && k > 0) f = Math.min(f, fs * k);
  }
  if (!Number.isFinite(f)) return;
  svg.style.setProperty('--fig-k', ((vb.width * 1.05) / f).toFixed(3));
  // 縦横比（高さ ÷ 幅）。高さで縮める所（数の入力の図の段）が、字を引き上げで補える高さの下限を CSS で出すのに使う
  svg.style.setProperty('--fig-ar', (vb.height / vb.width).toFixed(4));
}

/** 字ごとの拡大率で、最小に足りない字を引き上げる。測れなければ false */
function lift(svg: SVGSVGElement, texts: SVGTextElement[], min: number): boolean {
  const vb = svg.viewBox.baseVal;
  if (!vb || !(vb.width > 0)) return false;
  const ppu = pxPerUnit(svg, vb.width);
  if (ppu <= 0) return false;
  if (!(min > 0)) return true;
  const svgCtm = svg.getScreenCTM?.();
  const inv = svgCtm ? svgCtm.inverse() : null;
  for (const t of texts) {
    const fs = parseFloat(getComputedStyle(t).fontSize);
    if (!Number.isFinite(fs) || fs <= 0) continue;
    // 字ごとの拡大率: <g transform> の中の字は svg 全体の拡大率と違う。
    // svg の画面上の行列との比（群の拡大）に、svg の表示の枠から求めた px/単位を掛ける
    // （拡大の動きの途中の CSS transform には左右されない）
    let k = 1;
    const tc = (t as SVGGraphicsElement).getScreenCTM?.();
    if (inv && tc) {
      const m = inv.multiply(tc);
      const s2 = Math.min(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d));
      if (Number.isFinite(s2) && s2 > 0) k = s2;
    }
    const need = min / (ppu * k);
    const floor = need * TEXT_MIN_MARGIN;
    // 2倍までの引き上げだけ行う。それ以上小さく描かれた図は、文字を大きくすると他の文字や線に重なるので、
    // 図の描き方（viewBox の大きさ）を直す（content の側）。検査には small-text として残る
    // 比べるのは元の大きさ（くり返しで引き上げた分を足して 2倍を超えないように。幅を広げた図で字が viewBox を超えて切れる）
    const orig = t.dataset.fs0 ? parseFloat(t.dataset.fs0) : fs;
    if (!t.dataset.fs0 && !t.style.fontSize) t.dataset.fs0 = String(fs);
    const target = Math.ceil(floor * 100) / 100;
    if (fs < floor - 0.005 && need / orig <= 2) t.style.fontSize = `${target}px`;
  }
  return true;
}

/** 文字の外接が viewBox をはみ出すとき、viewBox を広げる（描く大きさは変えない）。広げたら true */
function widenToText(svg: SVGSVGElement, texts: SVGTextElement[]): boolean {
  const vb = svg.viewBox.baseVal;
  const ctm = svg.getScreenCTM?.();
  if (!ctm || texts.length === 0) return false;
  const inv = ctm.inverse();
  let x0 = vb.x;
  let y0 = vb.y;
  let x1 = vb.x + vb.width;
  let y1 = vb.y + vb.height;
  const pad = 2;
  for (const t of texts) {
    const tc = (t as SVGGraphicsElement).getScreenCTM?.();
    if (!tc || !t.textContent?.trim()) continue;
    const bb = t.getBBox();
    const m = inv.multiply(tc);
    for (const [px, py] of [
      [bb.x, bb.y],
      [bb.x + bb.width, bb.y],
      [bb.x, bb.y + bb.height],
      [bb.x + bb.width, bb.y + bb.height],
    ] as const) {
      const q = new DOMPoint(px, py).matrixTransform(m);
      x0 = Math.min(x0, q.x - pad);
      y0 = Math.min(y0, q.y - pad);
      x1 = Math.max(x1, q.x + pad);
      y1 = Math.max(y1, q.y + pad);
    }
  }
  if (
    x0 >= vb.x - 0.5 &&
    y0 >= vb.y - 0.5 &&
    x1 <= vb.x + vb.width + 0.5 &&
    y1 <= vb.y + vb.height + 0.5
  )
    return false;
  const d = svg.dataset;
  if (!d.vb0) {
    d.vb0 = `${vb.x} ${vb.y} ${vb.width} ${vb.height}`;
    if (svg.hasAttribute('width')) d.w0 = svg.getAttribute('width') ?? '';
    if (svg.hasAttribute('height')) d.h0 = svg.getAttribute('height') ?? '';
  }
  const kx = (x1 - x0) / vb.width;
  const ky = (y1 - y0) / vb.height;
  // width / height が書いてある図は、広げたぶんだけ枠も広げて、絵の大きさを変えない
  const w = parseFloat(svg.getAttribute('width') ?? '');
  const h = parseFloat(svg.getAttribute('height') ?? '');
  if (Number.isFinite(w)) svg.setAttribute('width', String(w * kx));
  if (Number.isFinite(h)) svg.setAttribute('height', String(h * ky));
  const next = `${x0} ${y0} ${x1 - x0} ${y1 - y0}`;
  svg.setAttribute('viewBox', next);
  d.vbw = next;
  return true;
}

/**
 * エンジンが自分で描く SVG 用: 文字（最小まで大きくした分を含む）が viewBox の外に出るとき、
 * viewBox を文字の外接まで広げる（clipped: text ⊂ svg）。deps（floor など、文字の大きさが変わるもの）が
 * 変わるたびと大きさの変化のたびにやり直す。広げた viewBox は元に戻してから測る
 */
export function useWidenToText(ref: RefObject<SVGSVGElement | null>, ...deps: unknown[]): void {
  const key = deps.join('|');
  useLayoutEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const run = () => {
      const d = svg.dataset;
      if (d.vbw && svg.getAttribute('viewBox') !== d.vbw) {
        // React が viewBox を書き換えた（問題が変わった）: 覚えていた元の値は古い
        delete d.vb0;
        delete d.w0;
        delete d.h0;
      }
      if (d.vb0) svg.setAttribute('viewBox', d.vb0);
      if (d.w0) svg.setAttribute('width', d.w0);
      if (d.h0) svg.setAttribute('height', d.h0);
      delete d.vb0;
      delete d.w0;
      delete d.h0;
      delete d.vbw;
      const texts = Array.from(svg.querySelectorAll('text'));
      for (let pass = 0; pass < 2; pass++) if (!widenToText(svg, texts)) break;
    };
    run();
    void document.fonts?.ready.then(run);
    return observeResize([svg], run);
  }, [ref, key]);
}

/** liftSvgText を、描画と大きさの変化のたびに実行する */
export function useLiftedSvgText(
  ref: RefObject<Element | null>,
  key: unknown,
  opts?: { fitWidth?: boolean },
): void {
  const fitWidth = opts?.fitWidth;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const run = () => liftSvgText(el, { fitWidth });
    run();
    // 中の svg の表示の大きさが変わった（fit で枠が縮んだ・広がった）ときも、引き上げを測り直す
    const svgs = Array.from(el.querySelectorAll('svg'));
    return observeResize([el, ...svgs], run);
  }, [ref, key, fitWidth]);
}

/**
 * 文字を置く枠に合わせて縮める（英単語・表など、途中で折らない文字用）。
 * - 'self'（既定）: 語が自分の枠より長くてはみ出す（scrollWidth > clientWidth）とき、枠に入る大きさへ。
 * - 'parent': 表など自分では縮まないもの。親の幅（余白を除く）より広いとき、親に入る大きさへ。
 * 縮めるのは --text-min まで。それでも入らないときは入らないまま（最小は守る）。
 */
export function useFitWidth(
  ref: RefObject<HTMLElement | null>,
  key: unknown,
  mode: 'self' | 'parent' = 'self',
): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = '';
      const base = parseFloat(getComputedStyle(el).fontSize);
      let w = el.scrollWidth;
      let avail = el.clientWidth;
      const parent = el.parentElement;
      if (mode === 'parent' && parent) {
        const cs = getComputedStyle(parent);
        w = el.getBoundingClientRect().width;
        avail =
          parent.clientWidth -
          parseFloat(cs.paddingLeft || '0') -
          parseFloat(cs.paddingRight || '0');
      }
      if (!(base > 0) || !(w > 0) || !(avail > 0) || w <= avail + 1) return;
      const min = textMinPx(el);
      el.style.fontSize = `${Math.max(min, Math.floor(base * (avail / w) * 100) / 100)}px`;
    };
    fit();
    return observeResize(el.parentElement ? [el.parentElement] : [], fit);
  }, [ref, key, mode]);
}

/**
 * 横軸の札の列（子が同じ幅の枠）: 札が枠に入らなければ --text-min まで縮め、なお入らなければ
 * 1つおきに下の段へずらす（data-stagger。札は2つぶんの幅まで使える）。graph.tsx の横軸と同じ考え（S6）。
 */
export function useStaggerLabels(ref: RefObject<HTMLElement | null>, key: unknown): void {
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const fit = () => {
      const items = Array.from(box.children) as HTMLElement[];
      box.removeAttribute('data-stagger');
      box.style.removeProperty('--fig-stagger');
      box.style.removeProperty('--fig-slot-pad');
      box.style.fontSize = '';
      if (items.length === 0) return;
      const ratio = () =>
        Math.max(
          ...items.map((it) => {
            // 中央寄せではみ出す分は左右に出るので、中身の幅で比べる（scrollWidth は右側しか数えない）
            const c = it.firstElementChild;
            return c && it.clientWidth > 0 ? c.getBoundingClientRect().width / it.clientWidth : 0;
          }),
        );
      const r = ratio();
      if (r <= 1.01) return;
      const base = parseFloat(getComputedStyle(box).fontSize);
      const min = textMinPx(box);
      const shrunk = Math.floor((base / r) * 100) / 100;
      if (shrunk >= min) {
        box.style.fontSize = `${shrunk}px`;
        return;
      }
      box.style.fontSize = `${min}px`;
      const slotW = items[0]!.clientWidth;
      box.style.setProperty('--fig-slot-pad', `${-Math.round(slotW * 0.48)}px`);
      box.style.setProperty('--fig-stagger', `${Math.ceil(items[0]!.offsetHeight) + 2}px`);
      box.setAttribute('data-stagger', '');
    };
    fit();
    void document.fonts?.ready.then(fit);
    return observeResize([box], fit);
  }, [ref, key]);
}
