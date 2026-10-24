/**
 * 塗りつぶし（review-1 #2）。純粋な関数（RGBA の配列だけを扱う）。
 * - 境界は「背景＋base＋全アイテムの合成結果」で判定する（呼び出し側が合成画像を渡す）
 * - 色の差の許容つき（線のふちのアンチエイリアスを越えない）
 * - 塗った範囲を1画素広げてすき間を防ぐ
 * 走査線（スパン）方式。再帰しない。
 */

export interface FillMask {
  mask: Uint8Array;
  w: number;
  h: number;
  x0: number;
  y0: number;
  /** 含む（x1, y1 も範囲内） */
  x1: number;
  y1: number;
  count: number;
}

/** 許容値の既定（RGBA 各成分の差の最大値） */
export const FILL_TOLERANCE = 40;

/**
 * (sx, sy) と同じ色が続く範囲の印（1 = 塗る）。
 * 色の差は各成分（RGBA）の差の最大値で比べ、tolerance 以下を同じ色とみなす。
 */
export function floodMask(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  sx: number,
  sy: number,
  tolerance = FILL_TOLERANCE,
): FillMask | null {
  sx = Math.floor(sx);
  sy = Math.floor(sy);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return null;
  const s = (sy * w + sx) * 4;
  const r0 = data[s]!;
  const g0 = data[s + 1]!;
  const b0 = data[s + 2]!;
  const a0 = data[s + 3]!;
  const mask = new Uint8Array(w * h);
  const same = (i: number): boolean => {
    const o = i * 4;
    return (
      Math.abs(data[o]! - r0) <= tolerance &&
      Math.abs(data[o + 1]! - g0) <= tolerance &&
      Math.abs(data[o + 2]! - b0) <= tolerance &&
      Math.abs(data[o + 3]! - a0) <= tolerance
    );
  };
  let x0 = sx;
  let x1 = sx;
  let y0 = sy;
  let y1 = sy;
  let count = 0;
  const stack: number[] = [sx, sy];
  while (stack.length) {
    const y = stack.pop()!;
    let x = stack.pop()!;
    let i = y * w + x;
    if (mask[i] || !same(i)) continue;
    // 左端へ
    while (x > 0 && !mask[i - 1] && same(i - 1)) {
      x--;
      i--;
    }
    let upOpen = false;
    let downOpen = false;
    for (; x < w && !mask[i] && same(i); x++, i++) {
      mask[i] = 1;
      count++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y > 0) {
        const up = i - w;
        const ok = !mask[up] && same(up);
        if (ok && !upOpen) stack.push(x, y - 1);
        upOpen = ok;
      }
      if (y < h - 1) {
        const dn = i + w;
        const ok = !mask[dn] && same(dn);
        if (ok && !downOpen) stack.push(x, y + 1);
        downOpen = ok;
      }
    }
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { mask, w, h, x0, y0, x1, y1, count };
}

/** 印を上下左右（と斜め）に1画素広げる（すき間を防ぐ） */
export function dilate(m: FillMask, radius = 1): FillMask {
  const { w, h } = m;
  const out = new Uint8Array(w * h);
  const x0 = Math.max(0, m.x0 - radius);
  const y0 = Math.max(0, m.y0 - radius);
  const x1 = Math.min(w - 1, m.x1 + radius);
  const y1 = Math.min(h - 1, m.y1 + radius);
  let count = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let on = 0;
      for (let dy = -radius; dy <= radius && !on; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < w && m.mask[yy * w + xx]) {
            on = 1;
            break;
          }
        }
      }
      if (on) {
        out[y * w + x] = 1;
        count++;
      }
    }
  }
  return { mask: out, w, h, x0, y0, x1, y1, count };
}

/** 色の文字列（#RRGGBB）→ [r, g, b] */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * 印の範囲（x0..x1, y0..y1）の画素（その範囲を切り出した RGBA）に色を書く。
 * region は (x1-x0+1)×(y1-y0+1) の RGBA。
 */
export function paintMask(region: Uint8ClampedArray, m: FillMask, color: string): void {
  const [r, g, b] = hexToRgb(color);
  const rw = m.x1 - m.x0 + 1;
  for (let y = m.y0; y <= m.y1; y++) {
    for (let x = m.x0; x <= m.x1; x++) {
      if (!m.mask[y * m.w + x]) continue;
      const o = ((y - m.y0) * rw + (x - m.x0)) * 4;
      region[o] = r;
      region[o + 1] = g;
      region[o + 2] = b;
      region[o + 3] = 255;
    }
  }
}
