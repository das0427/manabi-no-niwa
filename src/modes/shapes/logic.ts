/**
 * かたち・パズルの問題生成・置く判定・ヒント（純粋関数）。仕様: docs/learning-design.md 4章、architecture.md 6.4。
 * 段階: K1 穴に同じ形 / K2 絵2〜3ピース / K3 4ピース / K4 回転 / K5 外形だけ。
 * 1問 = 1つの絵（K1 は1つの穴）。
 */
import { balancedPositions, createRng, hashSeed, placeAt } from '../../core/util/rng';
import {
  HOLE_AT,
  HOLE_SIZE,
  K1_CARDS,
  PICTURES_BY_LEVEL,
  startRot,
  type Picture,
  type SlotDef,
} from './content';
import {
  assign,
  matches,
  nearSlot,
  normRot,
  SHAPE_LABEL,
  sameKind,
  slotAt,
  snapTarget,
  turnsToMatch,
  type Piece,
  type Point,
  type ShapeId,
} from './geometry';

export const LEVEL_COUNT = 5;
/** K1: 候補の数 */
export const CANDIDATES = 3;

export type Layout = 'hole' | 'lines' | 'silhouette';

export interface PieceDef extends Piece {
  /** 手元の並びの中の番号（0 始まり）。rot は手元での最初の向き */
  id: number;
}

export interface Puzzle {
  /** 絵（K1 は形）の ID。同じ回に同じ key は出ない */
  key: string;
  /** 子供に見える名前 */
  name: string;
  level: number;
  layout: Layout;
  slots: SlotDef[];
  /** 手元のピース（並び順）。余りを含む */
  pieces: PieceDef[];
  /** 「まわす」を出す（K4） */
  turnable: boolean;
  /** 見本の小さな完成図を出す（K5） */
  sample: boolean;
}

export function layoutOf(level: number): Layout {
  return level <= 0 ? 'hole' : level >= 4 ? 'silhouette' : 'lines';
}

const clampLevel = (level: number) => Math.max(0, Math.min(LEVEL_COUNT - 1, Math.trunc(level)));

function fromPicture(
  pic: Picture,
  level: number,
  order: (items: PieceDef[]) => PieceDef[],
): Puzzle {
  const base: Piece[] = pic.slots.map((s) => ({ shape: s.shape, size: s.size, rot: startRot(s) }));
  if (pic.spare) base.push(pic.spare);
  const pieces = order(base.map((p, id) => ({ ...p, id })));
  return {
    key: pic.id,
    name: pic.name,
    level,
    layout: layoutOf(level),
    slots: pic.slots,
    pieces: pieces.map((p, id) => ({ ...p, id })),
    turnable: level === 3,
    sample: level === 4,
  };
}

/**
 * 1回分の問題を作る。1回の中で同じ絵（形）は出さない。
 * K1 の正解の位置は balancedPositions で偏らせない。
 */
export function generateRound(level: number, seed: number, size: number): Puzzle[] {
  const lv = clampLevel(level);
  const rng = createRng(hashSeed('shapes', lv, seed));
  if (lv === 0) {
    const cards = rng.sample(K1_CARDS, Math.min(size, K1_CARDS.length));
    const positions = balancedPositions(cards.length, CANDIDATES, rng);
    return cards.map((card, i) => {
      const others = rng.sample(card.distractors, CANDIDATES - 1);
      const shapes: ShapeId[] = placeAt<ShapeId>(card.shape, others, positions[i] ?? 0, rng);
      return {
        key: card.shape,
        name: SHAPE_LABEL[card.shape],
        level: 0,
        layout: 'hole',
        slots: [
          {
            shape: card.shape,
            size: HOLE_SIZE,
            rot: 0,
            x: HOLE_AT.x,
            y: HOLE_AT.y,
            color: card.color,
          },
        ],
        pieces: shapes.map((shape, id) => ({ id, shape, size: HOLE_SIZE, rot: 0 })),
        turnable: false,
        sample: false,
      };
    });
  }
  const pool = PICTURES_BY_LEVEL[lv] ?? [];
  const pics = rng.sample(pool, Math.min(size, pool.length));
  return pics.map((pic) => fromPicture(pic, lv, (items) => rng.shuffle(items)));
}

// ---------------------------------------------------------------- 盤面の状態

export interface BoardState {
  /** スロットごとに置いたピースの番号（空きは null） */
  placed: (number | null)[];
  /** ピースごとの今の向き */
  rots: number[];
  /** 選んでいるピースの番号 */
  selected: number | null;
  /** ピースごとに、子供が「まわす」を押した回数 */
  turns: number[];
}

export function initBoard(puzzle: Puzzle): BoardState {
  return {
    placed: puzzle.slots.map(() => null),
    rots: puzzle.pieces.map((p) => normRot(p.rot)),
    selected: null,
    turns: puzzle.pieces.map(() => 0),
  };
}

export function filledSet(board: BoardState): Set<number> {
  const s = new Set<number>();
  board.placed.forEach((p, i) => {
    if (p !== null) s.add(i);
  });
  return s;
}

export const isPlaced = (board: BoardState, pieceId: number) => board.placed.includes(pieceId);
export const isComplete = (board: BoardState) => board.placed.every((p) => p !== null);

/** ピースの今の姿（向きは盤面の状態から） */
export function currentPiece(puzzle: Puzzle, board: BoardState, id: number): Piece {
  const p = puzzle.pieces[id]!;
  return { shape: p.shape, size: p.size, rot: board.rots[id] ?? p.rot };
}

/** 選ぶ。選んでいるピースをもう一度押すと選択を外す。置いたピースは選べない */
export function selectPiece(board: BoardState, id: number): BoardState {
  if (isPlaced(board, id)) return board;
  return { ...board, selected: board.selected === id ? null : id };
}

/** 選んでいるピースを時計回りに 90° まわす */
export function rotateSelected(board: BoardState): BoardState {
  const id = board.selected;
  if (id === null) return board;
  const rots = [...board.rots];
  rots[id] = normRot((rots[id] ?? 0) + 90);
  const turns = [...board.turns];
  turns[id] = (turns[id] ?? 0) + 1;
  return { ...board, rots, turns };
}

export type Placement =
  | { kind: 'place'; slot: number }
  | { kind: 'wrong'; slot: number; reason: 'shape' | 'rotation' }
  | { kind: 'ignore' };

function wrongReason(piece: Piece, slot: SlotDef): 'shape' | 'rotation' {
  return sameKind(piece, slot) ? 'rotation' : 'shape';
}

/**
 * 盤面のタップ位置で、選んだピースをどう扱うか。
 * 1. 空きスロットの輪郭の中をタップ → そのスロットに入るか（入らなければ置き間違い）
 * 2. 盤面幅の 20% 以内に一致する空きスロットがあれば吸着
 * 3. 一致しなくても 20% 以内に空きスロットがあれば置き間違い
 * 4. それ以外（余白）は何もしない
 */
export function resolvePlacement(
  puzzle: Puzzle,
  board: BoardState,
  pieceId: number,
  tap: Point,
): Placement {
  const piece = currentPiece(puzzle, board, pieceId);
  const filled = filledSet(board);
  const inside = slotAt(tap, puzzle.slots, filled);
  if (inside !== null) {
    const slot = puzzle.slots[inside]!;
    return matches(piece, slot)
      ? { kind: 'place', slot: inside }
      : { kind: 'wrong', slot: inside, reason: wrongReason(piece, slot) };
  }
  const snap = snapTarget(tap, piece, puzzle.slots, filled);
  if (snap !== null) return { kind: 'place', slot: snap };
  const near = nearSlot(tap, puzzle.slots, filled);
  if (near !== null) {
    return { kind: 'wrong', slot: near, reason: wrongReason(piece, puzzle.slots[near]!) };
  }
  return { kind: 'ignore' };
}

export function place(board: BoardState, pieceId: number, slot: number): BoardState {
  const placed = [...board.placed];
  placed[slot] = pieceId;
  return { ...board, placed, selected: null };
}

/** 「つぎへ」: 残りのピースを正しい場所に置いた盤面（向きも合わせる） */
export function answerBoard(puzzle: Puzzle, board: BoardState): BoardState {
  const freeSlots = puzzle.slots
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => board.placed[i] === null);
  const freePieces = puzzle.pieces.filter((p) => !isPlaced(board, p.id));
  const found = assign(
    freePieces.map((p) => currentPiece(puzzle, board, p.id)),
    freeSlots.map(({ s }) => s),
    false,
  );
  if (found === null) return board;
  const placed = [...board.placed];
  const rots = [...board.rots];
  freeSlots.forEach(({ s, i }, k) => {
    const piece = freePieces[found[k]!]!;
    placed[i] = piece.id;
    rots[piece.id] = normRot(s.rot);
  });
  return { ...board, placed, rots, selected: null };
}

/** 手元の最初の状態で絵が完成する割り当て（スロット → ピース、回す回数） */
export function solution(puzzle: Puzzle): { slot: number; piece: number; turns: number }[] | null {
  const found = assign(puzzle.pieces, puzzle.slots, false);
  if (found === null) return null;
  return found.map((pieceId, slot) => ({
    slot,
    piece: pieceId,
    turns: turnsToMatch(puzzle.pieces[pieceId]!, puzzle.slots[slot]!) ?? 0,
  }));
}

// ---------------------------------------------------------------- ヒント

/**
 * ヒントで示すスロット: 選んでいるピースと形・大きさが同じ空きスロット（そのピースの正しい置き場所）。
 * なければ、置こうとしたスロット（fallback）、それもなければ最初の空きスロット。
 */
export function hintTarget(
  puzzle: Puzzle,
  board: BoardState,
  pieceId: number | null,
  fallback: number | null = null,
): number | null {
  const free = puzzle.slots.map((_, i) => i).filter((i) => board.placed[i] === null);
  if (free.length === 0) return null;
  if (pieceId !== null) {
    const piece = currentPiece(puzzle, board, pieceId);
    const same = free.find((i) => sameKind(piece, puzzle.slots[i]!));
    if (same !== undefined) return same;
  }
  if (fallback !== null && free.includes(fallback)) return fallback;
  return free[0]!;
}

/** 選んでいるピースに、入る置き場所（形と大きさが同じ空きスロット）があるか */
export function hasOwnSlot(puzzle: Puzzle, board: BoardState, pieceId: number | null): boolean {
  if (pieceId === null) return false;
  const piece = currentPiece(puzzle, board, pieceId);
  return puzzle.slots.some((s, i) => board.placed[i] === null && sameKind(piece, s));
}
/** そのスロットに入れるために、ピースをまわす必要があるか（K4。選んでいなければ入るはずの手元のピースで見る） */
export function needsTurn(
  puzzle: Puzzle,
  board: BoardState,
  pieceId: number | null,
  slotIndex: number,
): boolean {
  if (!puzzle.turnable) return false;
  const slot = puzzle.slots[slotIndex]!;
  let id = pieceId;
  if (id === null || !sameKind(currentPiece(puzzle, board, id), slot)) {
    id =
      puzzle.pieces.find(
        (p) => !isPlaced(board, p.id) && sameKind(currentPiece(puzzle, board, p.id), slot),
      )?.id ?? null;
  }
  if (id === null) return false;
  return !matches(currentPiece(puzzle, board, id), slot);
}

/** ヒント1: その形の特徴を言う声のキー */
export const featureKey = (shape: ShapeId) => `shape.feat.${shape}`;

// ---------------------------------------------------------------- 中断データ

/** 保存した盤面が今の問題に合っているか確かめて返す（合わなければ null） */
export function restoreBoard(puzzle: Puzzle, raw: unknown): BoardState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const b = raw as Partial<BoardState>;
  const n = puzzle.pieces.length;
  const m = puzzle.slots.length;
  if (!Array.isArray(b.placed) || b.placed.length !== m) return null;
  if (!Array.isArray(b.rots) || b.rots.length !== n) return null;
  if (!Array.isArray(b.turns) || b.turns.length !== n) return null;
  const seen = new Set<number>();
  for (let i = 0; i < m; i++) {
    const v = b.placed[i];
    if (v === null) continue;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= n || seen.has(v))
      return null;
    seen.add(v);
    if (!sameKind(puzzle.pieces[v]!, puzzle.slots[i]!)) return null;
  }
  if (!b.rots.every((r) => typeof r === 'number' && Number.isFinite(r))) return null;
  if (!b.turns.every((t) => typeof t === 'number' && Number.isFinite(t))) return null;
  const sel = b.selected;
  const selected = typeof sel === 'number' && sel >= 0 && sel < n && !seen.has(sel) ? sel : null;
  return {
    placed: b.placed as (number | null)[],
    rots: (b.rots as number[]).map(normRot),
    turns: b.turns as number[],
    selected,
  };
}
