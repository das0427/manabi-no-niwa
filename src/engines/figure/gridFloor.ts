/**
 * パックが用意した SVG（盤・札の列）の大きさの下限（text-layout-fixes.md 第6回 W8）。
 * - 盤（同じ大きさの正方形が 4 つ以上ある図）の 1 ますは 2.4u 以上。パックは高さ hU（--u の何個分）を書くが、
 *   幅の既定（23u）と高さの小さいほうで描かれるので、ます目の多い盤は 1 ますが 1.3u ほどになっていた
 *   （g3.prog.decompose/30 の盤は 9u）。足りないときだけ、幅と高さを「1 ますが 2.4u になる大きさ」にまで広げる。
 * - 縦横比が 4:1 を超える図で字（<text>）を含むものは、選択肢の札に入れると札の幅に縮められて字が読めなくなる
 *   （g6.prog.efficient/11 の字は 0.54u）。印の class（fig-svg--wide）を付け、figure.css が選択肢を 1 列にする。
 *   字の無い横長の図（分数の帯 g2.math.fraction-simple・幼児の比べる絵 p23.math.compare など）は印を付けない。
 *   1 列にすると図の高さが 4.6u に抑えられ、横に並べたときより小さくなるため（レビューで見つけた退行）。
 * - 札の列（同じ大きさの札が 3 つ以上、すき間が辺の半分以下で横に並ぶ図。prog-g16 の手順の札）は、幅を
 *   「高さ × 縦横比」にする（第7回 X4）。width の無い svg は既定の 23u の箱に描かれ、g6.prog.efficient/11 の問題の
 *   12 枚の札は 1 枚 1.49u だった（パックの高さ 5u なら 3.5u）。svg に aspect-ratio（viewBox の縦横比）を書き、
 *   幅は auto（高さ × 縦横比。親の幅まで）にする。選択肢の中の札の列は、選択肢の箱が 14u（choice の min-width）で
 *   svg の幅が約 11u に抑えられ、札が 2.4u を下回る（g6.prog.efficient/9・g5.prog.debug-plan/8 の 1.67u）ので、
 *   1 列にしたほうが大きく描けるなら wide にする（figure.css が選択肢を 1 列にし、図の高さを 4.6u にする）。
 */

/** 盤の 1 ますの下限（u） */
export const GRID_CELL_MIN_U = 2.4;
/** 横長とみなす縦横比（幅 ÷ 高さ） */
export const WIDE_RATIO = 4;
/** 幅の既定（figure.css の .fig-svg svg:not([width])）の下限 */
const DEFAULT_WIDTH_U = 23;
/** 余裕（丸めで下限を割らないように） */
const MARGIN = 1.02;
/** 選択肢の中の svg の幅（u）。choice の選択肢は min-width 14u・余白 1.2u×2・枠で、中の幅は約 11u（container の札は中身で広がらない） */
export const OPTION_SVG_WIDTH_U = 11;
/** 1 列にした選択肢の図の高さ（u。figure.css の .fig-svg--wide の svg の高さ） */
export const WIDE_COLUMN_HEIGHT_U = 4.6;
/** 札の列とみなす札の数（以上）と、辺の比（短い辺 ÷ 長い辺）の下限 */
const CARD_ROW_MIN = 3;
const CARD_ASPECT_MIN = 0.5;

export interface PackSvgSizing {
  markup: string;
  /** 縦横比が WIDE_RATIO を超え、字（<text>）を含む */
  wide: boolean;
}

function attr(tag: string, name: string): number {
  const m = new RegExp(String.raw`\s${name}="(-?[0-9.]+)"`).exec(tag);
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

/**
 * 札の列の札の短い辺（viewBox の単位）。無ければ 0。
 * 同じ大きさ（幅・高さ）の rect が 3 つ以上あり、x の順に並べて、となりとのすき間が短い辺の半分以下
 * （わずかに重なるのも可）、縦のずれが高さの半分以下で続くものを数える（くり返しの枠の中の札は y が数 u ずれる）。
 * 辺の比は 1:2 以内（細長い帯・枠は札でない）。間をあけて置いた図形（p5.think.pattern の「ちいさい しかく」）と、
 * 盤（同じ正方形が 4 つ以上。gridCell が先に見る）の 2 段目以降は数えない
 */
export function cardRowSide(markup: string): number {
  const groups = new Map<string, { x: number; y: number; w: number; h: number }[]>();
  for (const m of markup.matchAll(/<rect\b[^>]*>/g)) {
    const x = attr(m[0], 'x');
    const y = attr(m[0], 'y');
    const w = attr(m[0], 'width');
    const h = attr(m[0], 'height');
    if (![x, y, w, h].every(Number.isFinite) || !(w > 0 && h > 0)) continue;
    if (Math.min(w, h) / Math.max(w, h) < CARD_ASPECT_MIN) continue;
    const key = `${w}x${h}`;
    const list = groups.get(key) ?? [];
    list.push({ x, y, w, h });
    groups.set(key, list);
  }
  let best = 0;
  for (const list of groups.values()) {
    if (list.length < CARD_ROW_MIN) continue;
    list.sort((a, b) => a.x - b.x || a.y - b.y);
    const { w, h } = list[0]!;
    const side = Math.min(w, h);
    let run = 1;
    let longest = 1;
    for (let i = 1; i < list.length; i++) {
      const gap = list[i]!.x - (list[i - 1]!.x + w);
      const dy = Math.abs(list[i]!.y - list[i - 1]!.y);
      run = gap >= -0.5 && gap <= side / 2 && dy <= h / 2 ? run + 1 : 1;
      longest = Math.max(longest, run);
    }
    if (longest >= CARD_ROW_MIN) best = Math.max(best, side);
  }
  return best;
}

/** 盤の 1 ますを 2.4u 以上にし、札の列の幅を決め、横長かどうかを返す。どれでもなければそのまま */
export function sizePackSvg(markup: string): PackSvgSizing {
  const open = /<svg\b[^>]*>/.exec(markup);
  if (!open) return { markup, wide: false };
  const tag = open[0];
  const vb = /viewBox="\s*([-0-9.]+)[\s,]+([-0-9.]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)\s*"/.exec(tag);
  if (!vb) return { markup, wide: false };
  const vbW = parseFloat(vb[3]!);
  const vbH = parseFloat(vb[4]!);
  if (!(vbW > 0 && vbH > 0)) return { markup, wide: false };
  let wide = vbW / vbH > WIDE_RATIO && /<text[\s>]/.test(markup);
  const cell = gridCell(markup);
  const heightRe = /height:\s*calc\(var\(--u\)\s*\*\s*([0-9.]+)\)/;
  const hm = heightRe.exec(tag);
  if (!hm || tag.includes(' width="')) return { markup, wide };
  if (!(cell > 0)) {
    // 盤でなければ、札の列か（盤は上の下限で幅を決める）
    const side = cardRowSide(markup);
    if (!(side > 0)) return { markup, wide };
    const heightU = parseFloat(hm[1]!);
    // 選択肢の中（幅 11u）で札が 2.4u を下回り、1 列（高さ 4.6u）にしたほうが札が大きくなるなら 1 列にする
    const inOption = side * Math.min(OPTION_SVG_WIDTH_U / vbW, heightU / vbH);
    const inColumn = (side * WIDE_COLUMN_HEIGHT_U) / vbH;
    if (inOption < GRID_CELL_MIN_U * MARGIN && inColumn > inOption) wide = true;
    // 幅は auto（高さ × 縦横比。親の幅まで）。パックの高さ（height）はそのまま
    const next = tag.replace(/style="/, `style="width:auto;aspect-ratio:${vbW} / ${vbH};`);
    return { markup: markup.replace(tag, next), wide };
  }
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
