/**
 * さんすう の盤面の配置（純粋関数。単位は u。舞台の描画領域は 100u × 48.25u）。
 * 絵のまとまり（皿）と、その真下の数字を同じ列に置いて、まとまりと数字を位置で対応させる。
 * 式の部品の順は logic.ts の formulaTokens と同じ（表示と式が食い違わない）。
 */
import {
  formulaTokens,
  hasFormula,
  picturesOf,
  type FormulaToken,
  type MathProblem,
  type MathStage,
} from './logic';

export const AREA_W = 100;
export const AREA_H = 48.25;

const GAP = 1; // 絵どうしのすきま
const PAD = 1.2; // 皿のふち
const OP_W = 6;
const EQ_W = 7;
const ANS_W = 8;
const NUM_W = 7;
const COL_GAP = 1.2;
const PIC_TOP = 1.2;
const A_PIC_TOP = 10;
const NUM_FONT = 8;
const NUM_FONT_BIG = 10;

export interface LPlate {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 皿に絵が1つもない（0 のとき）: 点線の皿 */
  empty: boolean;
  /** （予備）絵の置き場の点線の皿 */
  area: boolean;
}

export interface LPic {
  /** 通し番号（0 から。数える順の基準） */
  i: number;
  x: number;
  y: number;
  /** 「たべた」絵の移動先（皿の中で右へずれた位置） */
  ex?: number;
  ey?: number;
  eaten: boolean;
  /** 0: 1つ目のまとまり、1: 2つ目 */
  group: number;
}

export interface LSym {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  small?: boolean;
}

export interface LCell {
  x: number;
  w: number;
  token: FormulaToken;
}

export interface Layout {
  size: number;
  plates: LPlate[];
  pics: LPic[];
  syms: LSym[];
  cells: LCell[];
  /** 数字の行の上端。式を出さない段階は null */
  numY: number | null;
  numH: number;
  numFont: number;
  /** 内容の下端（吹き出しを置く位置の目安） */
  bottom: number;
  /** C: 皿の中で、たべた絵の範囲を囲む細い破線（たべた絵が動いたあとの位置） */
  eatBox?: { x: number; y: number; w: number; h: number };
}

/** 品物の絵の大きさ（段階ごとに一定。同じ場面の中ではすべて同じ） */
export function itemSize(stage: MathStage): number {
  if (stage === 'D1') return 8;
  if (stage === 'B3' || stage === 'E1' || stage === 'C2' || stage === 'C3' || stage === 'E2')
    return 9;
  return 10;
}

const slotsW = (n: number, s: number, gap = GAP, pad = PAD) =>
  Math.max(n, 1) * s + (Math.max(n, 1) - 1) * gap + 2 * pad;

export const plateW = (n: number, s: number) => slotsW(n, s);
export const plateH = (s: number) => s + 2 * PAD;

/** C: たべた絵が皿の中で右へずれる距離（皿には、そのぶんの余白がある） */
export const EAT_SHIFT = 2;

/**
 * C（と E の「えで みる」）: 最初の数 a の絵をすべて1枚の皿に置く。右はしの b 個が「たべた」絵で、
 * 皿の中で少し右へずれ、半透明＋斜線になる。式の「a」は皿全体の下、「b」はたべた絵の範囲の下。
 */
function buildSubLayout(p: MathProblem, stage: MathStage): Layout {
  const s = itemSize(stage);
  const h = plateH(s);
  const top = PIC_TOP;
  // 絵が1つ（1 － 1）のときも、数字の「1」と「1」が皿の下に収まる幅にする
  const w = Math.max(slotsW(p.a, s) + EAT_SHIFT, 20);
  const slotX = (i: number) => PAD + i * (s + GAP);
  const first = p.a - p.b;
  const boxL = slotX(first) + EAT_SHIFT - 0.5;
  const boxR = slotX(p.a - 1) + s + EAT_SHIFT + 0.5;

  // 数字の中心（a は皿の中心、b はたべた絵の範囲の中心）。近すぎるときは左右に少し離す
  const MIN = 15;
  let ca = w / 2;
  let cb = (boxL + boxR) / 2;
  if (cb - ca < MIN) {
    const d = (MIN - (cb - ca)) / 2;
    ca -= d;
    cb += d;
  }
  const centers = [ca, (ca + cb) / 2, cb, cb + 9, cb + 18];
  const widths = [8, OP_W, 8, EQ_W, 8];
  const left = Math.min(0, ca - 4);
  const right = Math.max(w, cb + 18 + 4);
  const shift = (AREA_W - (right - left)) / 2 - left;

  const tokens = formulaTokens(p);
  const cells: LCell[] = tokens.map((token, k) => ({
    x: shift + centers[k]! - widths[k]! / 2,
    w: widths[k]!,
    token,
  }));
  const pics: LPic[] = Array.from({ length: p.a }, (_, i) => {
    const eaten = i >= first;
    const x = shift + slotX(i);
    return {
      i,
      x,
      y: top + PAD,
      eaten,
      group: 0,
      ...(eaten ? { ex: x + EAT_SHIFT, ey: top + PAD } : {}),
    };
  });
  const numFont = NUM_FONT;
  const numH = numFont * 1.15;
  const numY = top + h + 1;
  return {
    size: s,
    plates: [{ id: 'a', x: shift, y: top, w, h, empty: false, area: false }],
    pics,
    syms: [],
    cells,
    numY,
    numH,
    numFont,
    bottom: numY + numH,
    eatBox: { x: shift + boxL, y: top + PAD - 0.5, w: boxR - boxL, h: s + 1 },
  };
}

export function buildLayout(p: MathProblem, stage: MathStage, showPics: boolean): Layout {
  const s = itemSize(stage);
  const pics = picturesOf(p);
  const showFormula = hasFormula(stage);
  const sub = p.op === '-';
  const part = p.op === 'part';

  // 式の部品のうち、盤面に出すもの（A は「絵 ＋ 絵」だけ）
  const tokens = formulaTokens(p).filter(
    (t) => showFormula || t.role === 'a' || t.role === 'b' || t.role === 'op',
  );

  if (sub && showPics) return buildSubLayout(p, stage);
  const rowH = plateH(s);

  // 列の幅
  const widthOf = (t: FormulaToken): number => {
    // 絵がないとき（E）は、式を大きく。字の幅に合わせて同じ幅の列にする
    if (!showPics) return NUM_FONT_BIG * 1.1;
    if (t.role === 'op') return OP_W;
    if (t.role === 'eq') return EQ_W;
    if (part) {
      if (t.role === 'a') return NUM_W;
      if (t.role === 'b') return plateW(pics.groups[0]!, s);
      return plateW(pics.groups[1]!, s);
    }
    // 足し算
    if (t.role === 'a') return plateW(pics.groups[0]!, s);
    if (t.role === 'b') return plateW(pics.groups[1]!, s);
    return ANS_W;
  };

  const widths = tokens.map(widthOf);
  const colGap = showPics ? COL_GAP : 2;
  const total = widths.reduce((x, w) => x + w, 0) + colGap * (tokens.length - 1);
  let cursor = (AREA_W - total) / 2;
  const cells: LCell[] = tokens.map((token, k) => {
    const cell = { x: cursor, w: widths[k]!, token };
    cursor += widths[k]! + colGap;
    return cell;
  });

  const picsTop = stage === 'A' ? A_PIC_TOP : PIC_TOP;
  const numFont = !showPics && isFormulaStage(stage) ? NUM_FONT_BIG : NUM_FONT;
  const numH = numFont * 1.15;
  const numY = !showFormula ? null : showPics ? picsTop + rowH + 1 : 8;

  const plates: LPlate[] = [];
  const picList: LPic[] = [];
  const syms: LSym[] = [];

  if (showPics) {
    const addPlate = (id: string, cell: LCell, n: number, group: number, firstIndex: number) => {
      plates.push({
        id,
        x: cell.x,
        y: picsTop,
        w: cell.w,
        h: plateH(s),
        empty: n === 0,
        area: false,
      });
      for (let j = 0; j < n; j++) {
        picList.push({
          i: firstIndex + j,
          x: cell.x + PAD + j * (s + GAP),
          y: picsTop + PAD,
          eaten: false,
          group,
        });
      }
    };
    const byRole = (role: FormulaToken['role']) => cells.find((c) => c.token.role === role);
    const ca = byRole('a');
    const cb = byRole('b');
    const cans = byRole('ans');

    if (part) {
      if (cb) addPlate('b', cb, pics.groups[0]!, 0, 0);
      if (cans) addPlate('c', cans, pics.groups[1]!, 1, pics.groups[0]!);
      if (ca) {
        syms.push({
          x: ca.x,
          y: picsTop + plateH(s) / 2 - 1.5,
          w: ca.w,
          h: 3,
          text: 'ぜんぶ',
          small: true,
        });
      }
    } else {
      if (ca) addPlate('a', ca, pics.groups[0]!, 0, 0);
      if (cb) addPlate('b', cb, pics.groups[1]!, 1, pics.groups[0]!);
    }
    const symH = 6;
    for (const c of cells) {
      if (c.token.role === 'op') {
        syms.push({
          x: c.x,
          y: picsTop + plateH(s) / 2 - symH / 2,
          w: c.w,
          h: symH,
          text: c.token.text,
        });
      }
    }
  }

  const bottom = numY !== null ? numY + numH : picsTop + rowH;
  return { size: s, plates, pics: picList, syms, cells, numY, numH, numFont, bottom };
}

function isFormulaStage(stage: MathStage): boolean {
  return stage === 'E1' || stage === 'E2';
}

/** 数えるとき、見せる順（ヒント2の実演）に使う絵の通し番号 */
export function demoOrder(p: MathProblem, layout: Layout): number[] {
  const all = layout.pics;
  if (p.op === '-') return all.filter((x) => !x.eaten).map((x) => x.i);
  if (p.op === 'part') return all.filter((x) => x.group === 1).map((x) => x.i);
  return all.map((x) => x.i);
}

/** 子供がタップして数えられる絵（「たべた」絵は数えない） */
export function countable(layout: Layout): number[] {
  return layout.pics.filter((x) => !x.eaten).map((x) => x.i);
}

// ---------- D1（わける） ----------

export const SPLIT_SIZE = 8;
const SPLIT_PLATE_W = 46;
const SPLIT_GAP = 3;

export interface SplitLayout {
  size: number;
  /** 上の置き場に並ぶ n 個の元の場所（左上の x, y） */
  home: { x: number; y: number }[];
  plateA: { x: number; y: number; w: number; h: number };
  plateB: { x: number; y: number; w: number; h: number };
  trayY: number;
}

export function buildSplitLayout(n: number): SplitLayout {
  const s = SPLIT_SIZE;
  const rowW = n * s + (n - 1) * 2;
  const x0 = (AREA_W - rowW) / 2;
  const home = Array.from({ length: n }, (_, k) => ({ x: x0 + k * (s + 2), y: 0.8 }));
  const plateH = s + 2 * PAD + 0.8;
  const px = (AREA_W - (2 * SPLIT_PLATE_W + SPLIT_GAP)) / 2;
  const py = 12.5;
  return {
    size: s,
    home,
    plateA: { x: px, y: py, w: SPLIT_PLATE_W, h: plateH },
    plateB: { x: px + SPLIT_PLATE_W + SPLIT_GAP, y: py, w: SPLIT_PLATE_W, h: plateH },
    trayY: 0.8 + s + 0.4,
  };
}

/** D1: 絵 i の今の位置（place: 0 = 元の場所、1 = おさらA、2 = おさらB）。同じ皿の中では置いた順に左から並ぶ */
export function splitPicPos(
  lay: SplitLayout,
  place: readonly number[],
  i: number,
): { x: number; y: number } {
  const where = place[i] ?? 0;
  if (where === 0) return lay.home[i]!;
  const plate = where === 1 ? lay.plateA : lay.plateB;
  const order = place.slice(0, i).filter((w) => w === where).length;
  // 皿の中でまん中に寄せる
  const k = place.filter((w) => w === where).length;
  const rowW = k * lay.size + (k - 1) * 0.8;
  return { x: plate.x + (plate.w - rowW) / 2 + order * (lay.size + 0.8), y: plate.y + PAD + 0.4 };
}
