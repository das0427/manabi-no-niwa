/**
 * 選択中の操作札の置き場所（review-1 #11、DESINGN.md 19章）。純粋な関数。
 * 枠の下に出す。画面に入らなければ枠の上、それも入らなければ道具欄（dock）。
 */
export interface CardPlacement {
  where: 'below' | 'above' | 'dock';
  /** 札の列の左上（画面の CSS px）。dock のときは使わない */
  x: number;
  y: number;
}

export function placeCards(opt: {
  /** 選択枠の外接矩形（画面の CSS px） */
  box: { x0: number; y0: number; x1: number; y1: number };
  /** 札の列の大きさ */
  rowW: number;
  rowH: number;
  gap: number;
  /** 札を置いてよい範囲（画面の端の余白・上の帯を除いた範囲） */
  area: { x0: number; y0: number; x1: number; y1: number };
}): CardPlacement {
  const { box, rowW, rowH, gap, area } = opt;
  const cx = (box.x0 + box.x1) / 2;
  const x = Math.min(Math.max(area.x0, cx - rowW / 2), Math.max(area.x0, area.x1 - rowW));
  if (rowW > area.x1 - area.x0) return { where: 'dock', x: 0, y: 0 };
  const below = box.y1 + gap;
  if (below + rowH <= area.y1) return { where: 'below', x, y: below };
  const above = box.y0 - gap - rowH;
  if (above >= area.y0) return { where: 'above', x, y: above };
  return { where: 'dock', x: 0, y: 0 };
}
