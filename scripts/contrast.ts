/**
 * 色のコントラスト比と「大きな文字」の判定（DESINGN.md 3.1、review-1 #18）。check-design.ts と単体テストが使う。
 * WCAG 2.x の相対輝度で計算する。
 */

/** 子供画面の想定の最小 u（1920px 幅・150% 表示）。DESINGN.md 3.1 */
export const MIN_U_PX = 12.8;

export function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** 大きな文字か。太さ 700 以上なら 18.67px 以上、500 以下なら 24px 以上（501〜699 は小さい側に倒す） */
export function isLargeText(px: number, weight: number): boolean {
  if (weight >= 700) return px >= 18.67;
  return px >= 24;
}

/** u 単位の文字の大きさを、想定の最小 u で px に直す */
export function uToPx(u: number): number {
  return u * MIN_U_PX;
}

/** 文字に求めるコントラスト比。ふりがな・補助の文字は大きさにかかわらず常に 4.5 */
export function requiredRatio(opts: {
  px: number;
  weight: number;
  alwaysNormal?: boolean;
}): number {
  if (opts.alwaysNormal) return 4.5;
  return isLargeText(opts.px, opts.weight) ? 3 : 4.5;
}
