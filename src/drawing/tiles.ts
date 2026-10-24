/**
 * 画素の差分（タイル単位）。線・消しゴム・塗り・焼き付けの undo に使う（architecture.md 7.3）。
 * 描く前に、これから変わるタイルだけを読み取って持ち、描き終えたら同じタイルの「後」を読む。
 * 全画面の写しを持たないので、差分の大きさ＝実際に触ったタイルの大きさになる。
 */

export const TILE = 128;

/** getImageData / putImageData だけを使う（テストでは偽物を渡す） */
export interface PixelCtx {
  getImageData(x: number, y: number, w: number, h: number): ImageData;
  putImageData(d: ImageData, x: number, y: number): void;
}

export interface TileDiff {
  layer: string;
  x: number;
  y: number;
  before: ImageData;
  after: ImageData | null;
}

export class TileRecorder {
  private tiles = new Map<string, TileDiff>();

  constructor(
    private readonly getCtx: (layer: string) => PixelCtx | null,
    private readonly width: number,
    private readonly height: number,
  ) {}

  /** (x0,y0)-(x1,y1) の矩形を変える前に呼ぶ */
  touch(layer: string, x0: number, y0: number, x1: number, y1: number): void {
    const ctx = this.getCtx(layer);
    if (!ctx) return;
    const tx0 = Math.max(0, Math.floor(Math.min(x0, x1) / TILE));
    const ty0 = Math.max(0, Math.floor(Math.min(y0, y1) / TILE));
    const tx1 = Math.min(Math.ceil(this.width / TILE) - 1, Math.floor(Math.max(x0, x1) / TILE));
    const ty1 = Math.min(Math.ceil(this.height / TILE) - 1, Math.floor(Math.max(y0, y1) / TILE));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const key = `${layer}|${tx}|${ty}`;
        if (this.tiles.has(key)) continue;
        const x = tx * TILE;
        const y = ty * TILE;
        const w = Math.min(TILE, this.width - x);
        const h = Math.min(TILE, this.height - y);
        this.tiles.set(key, { layer, x, y, before: ctx.getImageData(x, y, w, h), after: null });
      }
    }
  }

  get size(): number {
    return this.tiles.size;
  }

  /** 描き終えたら呼ぶ。各タイルの「後」を読んで返す */
  finish(): TileDiff[] {
    const out: TileDiff[] = [];
    for (const t of this.tiles.values()) {
      const ctx = this.getCtx(t.layer);
      if (!ctx) continue;
      t.after = ctx.getImageData(t.x, t.y, t.before.width, t.before.height);
      out.push(t);
    }
    this.tiles.clear();
    return out;
  }
}

export function tilesBytes(tiles: readonly TileDiff[]): number {
  let n = 0;
  for (const t of tiles) n += t.before.data.length + (t.after?.data.length ?? 0);
  return n;
}

export function applyTiles(
  tiles: readonly TileDiff[],
  which: 'before' | 'after',
  getCtx: (layer: string) => PixelCtx | null,
): Set<string> {
  const changed = new Set<string>();
  for (const t of tiles) {
    const d = which === 'before' ? t.before : t.after;
    const ctx = getCtx(t.layer);
    if (!d || !ctx) continue;
    ctx.putImageData(d, t.x, t.y);
    changed.add(t.layer);
  }
  return changed;
}
