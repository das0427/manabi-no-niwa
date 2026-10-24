/**
 * かたち・パズルの教材（手で作る）。段階: docs/learning-design.md 4章。
 *
 * - K1 ShapeCard: 穴（影）1つ＋候補3つ。候補は形が違うもの。ピースは全部同じ木の色（M4-06）
 * - K2〜K5 Picture: 絵 = スロットの並び。各スロットが完成時の色を持つ。
 *     K2（2〜3ピース＋余り1）, K3（4ピース＋余り1）, K4（回転が必要。余りなし）, K5（外形だけ。余りなし）
 * - 座標は盤面 100 × 100。絵は pic() が外接四角形の中心を盤面の中心にそろえる。
 * - K1〜K3・K5 のピースは最初から正しい向き（スロットの rot で手元に並ぶ）。
 *   K4 は from（手元での最初の向き）がスロットの向きと違う。時計回りに 90° ずつ、1〜2回で合う。
 */
import { P } from '../../illust/palette';
import { BOARD, dims, type Piece, type ShapeId, type Slot } from './geometry';

export interface SlotDef extends Slot {
  /** 完成したときの色（パレット P） */
  color: string;
  /** K4: 手元に並べるときの最初の向き（省略 = rot と同じ） */
  from?: number;
}

export interface Picture {
  id: string;
  /** 子供に見える名前（ひらがな） */
  name: string;
  slots: SlotDef[];
  /** K2・K3 の余りのピース（どのスロットにも入らない形か大きさ） */
  spare?: Piece;
}

export interface ShapeCard {
  shape: ShapeId;
  color: string;
  /** 候補にしてよい別の形（まぎらわしい形は入れない）。ここから 2 つ選ぶ */
  distractors: readonly ShapeId[];
}

type Def = readonly [ShapeId, number, number, number, number, string, number?];

/** 手で並べた相対座標を、外接四角形の中心が盤面の中心になるようにそろえる */
function pic(id: string, name: string, defs: readonly Def[], spare?: Piece): Picture {
  const boxes = defs.map(([shape, size, rot, x, y]) => {
    const d = dims(shape, size, rot);
    return { x0: x - d.w / 2, x1: x + d.w / 2, y0: y - d.h / 2, y1: y + d.h / 2 };
  });
  const cx = (Math.min(...boxes.map((b) => b.x0)) + Math.max(...boxes.map((b) => b.x1))) / 2;
  const cy = (Math.min(...boxes.map((b) => b.y0)) + Math.max(...boxes.map((b) => b.y1))) / 2;
  const r = (n: number) => Math.round(n * 100) / 100;
  const slots = defs.map(([shape, size, rot, x, y, color, from]): SlotDef => {
    const s: SlotDef = {
      shape,
      size,
      rot,
      x: r(x - cx + BOARD / 2),
      y: r(y - cy + BOARD / 2),
      color,
    };
    if (from !== undefined) s.from = from;
    return s;
  });
  return spare ? { id, name, slots, spare } : { id, name, slots };
}

const sp = (shape: ShapeId, size: number, rot = 0): Piece => ({ shape, size, rot });

// ---------------------------------------------------------------- K1

/** 穴の大きさと位置（候補も同じ大きさ） */
export const HOLE_SIZE = 40;
export const HOLE_AT = { x: BOARD / 2, y: BOARD / 2 } as const;

export const K1_CARDS: readonly ShapeCard[] = [
  { shape: 'circle', color: P.red, distractors: ['square', 'triangle', 'rtriangle', 'star'] },
  { shape: 'square', color: P.blue, distractors: ['circle', 'triangle', 'semicircle', 'heart'] },
  { shape: 'rect', color: P.green, distractors: ['circle', 'triangle', 'semicircle', 'heart'] },
  { shape: 'triangle', color: P.yellow, distractors: ['circle', 'square', 'rect', 'heart'] },
  { shape: 'rtriangle', color: P.orange, distractors: ['circle', 'square', 'rect', 'semicircle'] },
  { shape: 'semicircle', color: P.pink, distractors: ['square', 'rect', 'triangle', 'star'] },
  { shape: 'star', color: P.purple, distractors: ['circle', 'square', 'triangle', 'heart'] },
  { shape: 'heart', color: P.redDark, distractors: ['circle', 'square', 'triangle', 'star'] },
];

// ---------------------------------------------------------------- K2（2〜3ピース＋余り1）

export const K2_PICTURES: readonly Picture[] = [
  pic(
    'house',
    'いえ',
    [
      ['triangle', 52, 0, 0, -43.4, P.red],
      ['square', 40, 0, 0, 0, P.tan],
    ],
    sp('rect', 36),
  ),
  pic(
    'icecream',
    'アイス',
    [
      ['triangle', 44, 180, 0, 0, P.tan],
      ['semicircle', 44, 0, 0, -30.8, P.pink],
      ['circle', 18, 0, 0, -50.8, P.red],
    ],
    sp('square', 24),
  ),
  pic(
    'mushroom',
    'きのこ',
    [
      ['semicircle', 64, 0, 0, -36, P.red],
      ['rect', 40, 90, 0, 0, P.cream],
    ],
    sp('triangle', 30),
  ),
  pic(
    'fish',
    'さかな',
    [
      ['circle', 44, 0, 0, 0, P.orange],
      ['triangle', 34, 270, 37.3, 0, P.yellow],
      ['triangle', 20, 0, -2, -29.5, P.yellow],
    ],
    sp('square', 20),
  ),
  pic(
    'car',
    'くるま',
    [
      ['rect', 64, 0, 0, 0, P.red],
      ['circle', 24, 0, -20, 28, P.gray],
      ['circle', 24, 0, 20, 28, P.gray],
    ],
    sp('triangle', 28),
  ),
  pic(
    'rocket',
    'ロケット',
    [
      ['triangle', 26, 0, 0, -34.7, P.red],
      ['rect', 46, 90, 0, 0, P.cream],
      ['triangle', 20, 180, 0, 32, P.orange],
    ],
    sp('circle', 24),
  ),
  pic(
    'tree',
    'き',
    [
      ['circle', 52, 0, 0, 0, P.green],
      ['rect', 34, 90, 0, 41.6, P.brown],
    ],
    sp('semicircle', 34),
  ),
  pic(
    'ship',
    'ふね',
    [
      ['semicircle', 60, 180, 0, 0, P.brown],
      ['rect', 36, 0, 0, -24, P.white],
      ['square', 16, 0, 6, -41, P.red],
    ],
    sp('triangle', 26),
  ),
];

// ---------------------------------------------------------------- K3（4ピース＋余り1）

export const K3_PICTURES: readonly Picture[] = [
  pic(
    'airplane',
    'ひこうき',
    [
      ['rect', 52, 0, 0, 0, P.blue],
      ['triangle', 26, 90, 37.7, 0, P.red],
      ['rtriangle', 22, 0, -15, -24, P.red],
      ['rtriangle', 26, 90, -1, 26, P.orange],
    ],
    sp('circle', 24),
  ),
  pic(
    'snowman',
    'ゆきだるま',
    [
      ['circle', 34, 0, 0, 0, P.white],
      ['circle', 24, 0, 0, -29, P.white],
      ['rect', 32, 0, 0, -49, P.ink],
      ['square', 18, 0, 0, -66, P.ink],
    ],
    sp('triangle', 24),
  ),
  pic(
    'robot',
    'ロボット',
    [
      ['square', 26, 0, 0, -31, P.gray],
      ['square', 36, 0, 0, 0, P.blue],
      ['rect', 32, 90, -9, 34, P.orange],
      ['rect', 32, 90, 9, 34, P.orange],
    ],
    sp('semicircle', 34),
  ),
  pic(
    'flower',
    'はな',
    [
      ['circle', 36, 0, 0, 0, P.pink],
      ['rect', 34, 90, 0, 35, P.greenDark],
      ['rtriangle', 20, 270, -18.5, 42, P.green],
      ['rtriangle', 20, 0, 18.5, 42, P.green],
    ],
    sp('rect', 32),
  ),
  pic(
    'castle',
    'おしろ',
    [
      ['square', 36, 0, 0, 0, P.tan],
      ['triangle', 36, 0, 0, -34.2, P.red],
      ['rect', 48, 90, -30, -6, P.gray],
      ['rect', 48, 90, 30, -6, P.gray],
    ],
    sp('circle', 26),
  ),
  pic(
    'cat',
    'ねこ',
    [
      ['square', 40, 0, 0, 0, P.orange],
      ['triangle', 18, 0, -11, -28.1, P.orange],
      ['triangle', 18, 0, 11, -28.1, P.orange],
      ['rect', 40, 0, 0, 30, P.tan],
    ],
    sp('circle', 22),
  ),
];

// ---------------------------------------------------------------- K4（回転が必要。余りなし）

export const K4_PICTURES: readonly Picture[] = [
  pic('yacht', 'ヨット', [
    ['semicircle', 60, 180, 0, 0, P.brown, 0],
    ['rtriangle', 30, 270, -15, -30, P.white, 180],
    ['rtriangle', 20, 0, 10, -25, P.yellow, 270],
  ]),
  pic('mountain', 'やま', [
    ['triangle', 56, 0, 0, 0, P.green, 180],
    ['triangle', 36, 0, 46, 9, P.greenDark, 270],
    ['circle', 20, 0, 46, -22, P.yellow],
  ]),
  pic('umbrella', 'かさ', [
    ['semicircle', 70, 0, 0, -17.5, P.red, 180],
    ['rect', 36, 90, 0, 18, P.brown, 0],
  ]),
  pic('carrot', 'にんじん', [
    ['triangle', 52, 180, 0, 0, P.orange, 0],
    ['triangle', 24, 0, -13, -34.2, P.green, 270],
    ['triangle', 24, 0, 13, -34.2, P.green, 180],
  ]),
  pic('balloon', 'ふうせん', [
    ['circle', 42, 0, 0, 0, P.red],
    ['triangle', 18, 0, 0, 29.1, P.red, 180],
    ['rect', 32, 90, 0, 53.2, P.gray, 0],
  ]),
  pic('butterfly', 'ちょうちょ', [
    ['rect', 36, 90, 0, 0, P.brown, 90],
    ['rtriangle', 36, 180, -27, 0, P.orange, 90],
    ['rtriangle', 36, 90, 27, 0, P.yellow, 0],
  ]),
];

// ---------------------------------------------------------------- K5（外形だけ。余りなし）

export const K5_PICTURES: readonly Picture[] = [
  pic('cake', 'ケーキ', [
    ['rect', 60, 0, 0, 0, P.pink],
    ['rect', 40, 0, 0, -25, P.cream],
    ['square', 16, 0, 0, -43, P.yellow],
    ['triangle', 18, 0, 0, -59.1, P.orange],
  ]),
  pic('truck', 'トラック', [
    ['rect', 52, 0, -16, 0, P.blue],
    ['square', 26, 0, 23, 0, P.red],
    ['circle', 20, 0, -24, 23, P.gray],
    ['circle', 20, 0, 24, 23, P.gray],
  ]),
  pic('chick', 'ひよこ', [
    ['circle', 48, 0, 0, 0, P.yellow],
    ['circle', 30, 0, -14, -36.4, P.yellow],
    ['triangle', 18, 270, -37.1, -36.4, P.orange],
  ]),
  pic('snail', 'かたつむり', [
    ['rect', 56, 0, 0, 0, P.tan],
    ['circle', 44, 0, -8, -36, P.brown],
    ['circle', 24, 0, 40, 2, P.tan],
  ]),
  pic('desk', 'つくえ', [
    ['rect', 70, 0, 0, 0, P.brown],
    ['rect', 44, 90, -24, 39.5, P.tan],
    ['rect', 44, 90, 24, 39.5, P.tan],
  ]),
  pic('ghost', 'おばけ', [
    ['semicircle', 44, 0, 0, -22, P.white],
    ['rect', 44, 0, 0, 0, P.white],
    ['triangle', 22, 180, -11, 20.9, P.white],
    ['triangle', 22, 180, 11, 20.9, P.white],
  ]),
];

/** 段階（0 始まり）ごとの絵。K1 は ShapeCard なので含まない */
export const PICTURES_BY_LEVEL: Record<number, readonly Picture[]> = {
  1: K2_PICTURES,
  2: K3_PICTURES,
  3: K4_PICTURES,
  4: K5_PICTURES,
};

/** 手元に並べるときの最初の向き */
export const startRot = (s: SlotDef): number => s.from ?? s.rot;
