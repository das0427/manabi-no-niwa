/** よみの短いハッシュ（FNV-1a 32bit を36進）。音声ファイル名に使う */
export function yomiHash(yomi: string): string {
  let h = 0x811c9dc5;
  for (const ch of yomi) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
