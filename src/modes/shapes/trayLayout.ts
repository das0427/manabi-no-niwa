/** 手元のピースの並べ方（純粋関数）。盤面と同じ縮尺で、行に並べる */
import { dims } from './geometry';
import type { PieceDef, Puzzle } from './logic';

export const BOARD_U = 36;
export const SCALE = BOARD_U / 100;
export const TRAY_H_U = 36;
export const trayWidthU = (sample: boolean) => (sample ? 37 : 52);
export const GAP_U = 1.6;
/** ピースの周りの余白（盤面の単位） */
export const CELL_PAD = 2;

export interface TrayCell {
  id: number;
  /** 手元の領域の中での左上。盤面の単位（× SCALE が u） */
  x: number;
  y: number;
  w: number;
  h: number;
}

function cellSize(puzzle: Puzzle, piece: PieceDef): { w: number; h: number } {
  const d = dims(piece.shape, piece.size, piece.rot);
  // 「まわす」で縦横が変わっても場所が動かないよう、K4 は正方形の枠にする
  const m = Math.max(d.w, d.h);
  return puzzle.turnable
    ? { w: m + CELL_PAD * 2, h: m + CELL_PAD * 2 }
    : { w: d.w + CELL_PAD * 2, h: d.h + CELL_PAD * 2 };
}

/** 手元のピースを行に並べる（左から右、はみ出したら次の行。各行は中央ぞろえ） */
export function trayLayout(puzzle: Puzzle): { cells: TrayCell[]; fits: boolean } {
  const W = trayWidthU(puzzle.sample) / SCALE;
  const H = TRAY_H_U / SCALE;
  const gap = GAP_U / SCALE;
  const sizes = puzzle.pieces.map((p) => ({ id: p.id, ...cellSize(puzzle, p) }));

  const flow = (items: typeof sizes) => {
    const rows: { items: typeof sizes; w: number; h: number }[] = [];
    for (const it of items) {
      let row = rows[rows.length - 1];
      if (!row || row.w + gap + it.w > W + 1e-6) {
        row = { items: [], w: -gap, h: 0 };
        rows.push(row);
      }
      row.items.push(it);
      row.w += gap + it.w;
      row.h = Math.max(row.h, it.h);
    }
    const height = rows.reduce((s, r) => s + r.h, 0) + gap * Math.max(0, rows.length - 1);
    return { rows, height };
  };

  let laid = flow(sizes);
  if (laid.height > H) {
    const sorted = [...sizes].sort((a, b) => b.h - a.h || a.id - b.id);
    const alt = flow(sorted);
    if (alt.height < laid.height) laid = alt;
  }
  const cells: TrayCell[] = [];
  let y = Math.max(0, (H - laid.height) / 2);
  for (const row of laid.rows) {
    let x = Math.max(0, (W - row.w) / 2);
    for (const it of row.items) {
      cells.push({ id: it.id, x, y: y + (row.h - it.h) / 2, w: it.w, h: it.h });
      x += it.w + gap;
    }
    y += row.h + gap;
  }
  const widest = Math.max(...laid.rows.map((r) => r.w));
  return {
    cells: cells.sort((a, b) => a.id - b.id),
    fits: laid.height <= H + 1e-6 && widest <= W + 1e-6,
  };
}
