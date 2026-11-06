/**
 * パックが用意した SVG（盤・札の列）の大きさの下限（text-layout-fixes.md 第6回 W8）。
 * - 盤（同じ大きさの正方形が 4 つ以上ある図）の 1 ますは 2.4u 以上。パックは高さ hU（--u の何個分）を書くが、
 *   幅の既定（23u）と高さの小さいほうで描かれるので、ます目の多い盤は 1 ますが 1.3u ほどになっていた
 *   （g3.prog.decompose/30 の盤は 9u）。足りないときだけ、幅と高さを「1 ますが 2.4u になる大きさ」にまで広げる。
 * - 縦横比が 4:1 を超える図で字（<text>）を含むものは、選択肢の札に入れると札の幅に縮められて字が読めなくなる
 *   （g6.prog.efficient/11 の字は 0.54u）。印の class（fig-svg--wide）を付け、figure.css が選択肢を 1 列にする。
 *   字の無い横長の図（分数の帯 g2.math.fraction-simple・幼児の比べる絵 p23.math.compare など）は印を付けない。
 *   1 列にすると図の高さが 4.6u に抑えられ、横に並べたときより小さくなるため（レビューで見つけた退行）。
 */

/** 盤の 1 ますの下限（u） */
export const GRID_CELL_MIN_U = 2.4;
/** 横長とみなす縦横比（幅 ÷ 高さ） */
export const WIDE_RATIO = 4;
/** 幅の既定（figure.css の .fig-svg svg:not([width])）の下限 */
const DEFAULT_WIDTH_U = 23;
/** 余裕（丸めで下限を割らないように） */
const MARGIN = 1.02;

export interface PackSvgSizing {
  markup: string;
  /** 縦横比が WIDE_RATIO を超え、字（<text>）を含む */
  wide: boolean;
}

function attr(tag: string, name: string): number {
  const m = new RegExp(String.raw`\s${name}="([0-9.]+)"`).exec(tag);
  return m ? parseFloat(m[1]!) : NaN;
}

/** 同じ大きさの正方形（4 つ以上）の一辺。盤が無ければ 0 */
function gridCell(markup: string): number {
  const counts = new Map<number, number>();
  for (const m of markup.matchAll(/<rect\b[^>]*>/g)) {
    const w = attr(m[0], 'width');
    const h = attr(m[0], 'height');
    if (Number.isFinite(w) && w > 0 && w === h) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  let best = 0;
  let bestN = 3; // 3 つ以下は盤とみなさない
  for (const [size, n] of counts) {
    if (n > bestN || (n === bestN && best > 0 && size > best)) {
      best = size;
      bestN = n;
    }
  }
  return best;
}

/** 盤の 1 ますを 2.4u 以上にし、横長かどうかを返す。盤でも横長でもなければそのまま */
export function sizePackSvg(markup: string): PackSvgSizing {
  const open = /<svg\b[^>]*>/.exec(markup);
  if (!open) return { markup, wide: false };
  const tag = open[0];
  const vb = /viewBox="\s*([-0-9.]+)[\s,]+([-0-9.]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)\s*"/.exec(tag);
  if (!vb) return { markup, wide: false };
  const vbW = parseFloat(vb[3]!);
  const vbH = parseFloat(vb[4]!);
  if (!(vbW > 0 && vbH > 0)) return { markup, wide: false };
  const wide = vbW / vbH > WIDE_RATIO && /<text[\s>]/.test(markup);
  const cell = gridCell(markup);
  const heightRe = /height:\s*calc\(var\(--u\)\s*\*\s*([0-9.]+)\)/;
  const hm = heightRe.exec(tag);
  if (!(cell > 0) || !hm || tag.includes(' width="')) return { markup, wide };
  const heightU = parseFloat(hm[1]!);
  const cellU = Math.min(DEFAULT_WIDTH_U / vbW, heightU / vbH) * cell;
  if (cellU >= GRID_CELL_MIN_U * MARGIN) return { markup, wide };
  const perVb = (GRID_CELL_MIN_U * MARGIN) / cell;
  const wU = (vbW * perVb).toFixed(1);
  const hU = (vbH * perVb).toFixed(1);
  let next = tag.replace(heightRe, `height:max(calc(var(--u) * ${hm[1]}), calc(var(--u) * ${hU}))`);
  next = next.replace(
    /style="/,
    `style="width:max(calc(var(--u) * ${DEFAULT_WIDTH_U}), calc(var(--text-min, calc(var(--u) * 1.8)) * var(--fig-k, 0)), calc(var(--u) * ${wU}));`,
  );
  return { markup: markup.replace(tag, next), wide };
}
