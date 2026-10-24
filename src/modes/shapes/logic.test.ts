import { describe, expect, it } from 'vitest';
import { VOICE_CATALOG } from '../../voice/catalog/index';
import {
  K1_CARDS,
  K2_PICTURES,
  K3_PICTURES,
  K4_PICTURES,
  K5_PICTURES,
  PICTURES_BY_LEVEL,
  type Picture,
} from './content';
import { assign, matches, SHAPES } from './geometry';
import {
  answerBoard,
  generateRound,
  hasOwnSlot,
  hintTarget,
  initBoard,
  isComplete,
  LEVEL_COUNT,
  needsTurn,
  place,
  resolvePlacement,
  restoreBoard,
  rotateSelected,
  selectPiece,
  solution,
  type Puzzle,
} from './logic';
import { trayLayout } from './trayLayout';

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

const ALL_PICTURES: [string, readonly Picture[]][] = [
  ['K2', K2_PICTURES],
  ['K3', K3_PICTURES],
  ['K4', K4_PICTURES],
  ['K5', K5_PICTURES],
];

// ---------------------------------------------------------------- 生成
function check(ctx: string, puzzles: Puzzle[], level: number, size: number) {
  expect(puzzles, ctx).toHaveLength(size);
  expect(new Set(puzzles.map((p) => p.key)).size, `${ctx} 重複`).toBe(size);
  for (const p of puzzles) {
    const c = `${ctx} key=${p.key}`;
    expect(p.level, c).toBe(level);
    expect(
      p.pieces.map((x) => x.id),
      c,
    ).toEqual(p.pieces.map((_, i) => i));
    expect(solution(p), `${c} 解がある`).not.toBeNull();
    expect(p.turnable, c).toBe(level === 3);
    expect(p.sample, c).toBe(level === 4);
    expect(p.layout, c).toBe(level === 0 ? 'hole' : level === 4 ? 'silhouette' : 'lines');
    if (level === 0) {
      expect(p.slots, c).toHaveLength(1);
      expect(p.pieces, c).toHaveLength(3);
      expect(new Set(p.pieces.map((x) => x.shape)).size, `${c} 候補は形が違う`).toBe(3);
      const hole = p.slots[0]!;
      const ok = p.pieces.filter((x) => matches(x, hole));
      expect(ok, `${c} 正解がちょうど1つ`).toHaveLength(1);
      // 候補は全部同じ大きさ・同じ向き（木の色は表示側で固定）
      expect(new Set(p.pieces.map((x) => `${x.size}/${x.rot}`)).size, c).toBe(1);
    } else {
      const spare = level === 1 || level === 2 ? 1 : 0;
      expect(p.pieces, c).toHaveLength(p.slots.length + spare);
      const strict = assign(p.pieces, p.slots, true);
      if (level === 3) {
        expect(
          p.pieces.some((x) => !p.slots.some((s) => matches(x, s))),
          `${c} 回転が必要なピースがある`,
        ).toBe(true);
      } else {
        expect(strict, `${c} 回転なしで解ける`).not.toBeNull();
      }
    }
  }
}

describe('generateRound（seed 1..200 × 全段階 × 1回の問題数）', () => {
  for (let level = 0; level < LEVEL_COUNT; level++) {
    for (const size of [3, 4, 5]) {
      it(`K${level + 1} size=${size}`, () => {
        for (const seed of SEEDS) {
          check(
            `level=${level} size=${size} seed=${seed}`,
            generateRound(level, seed, size),
            level,
            size,
          );
        }
      });
    }
  }

  it('同じ seed なら同じ問題', () => {
    for (let level = 0; level < LEVEL_COUNT; level++) {
      expect(generateRound(level, 7, 4)).toEqual(generateRound(level, 7, 4));
    }
  });

  it('段階の範囲外は両端に丸める', () => {
    expect(generateRound(-3, 5, 3)[0]!.level).toBe(0);
    expect(generateRound(99, 5, 3)[0]!.level).toBe(LEVEL_COUNT - 1);
  });

  it('K1: 正解の位置が偏らない（各位置の差が 1 以下、同じ位置が 3 回続かない）', () => {
    for (const size of [3, 4, 5]) {
      for (const seed of SEEDS) {
        const ps = generateRound(0, seed, size);
        const pos = ps.map((p) => p.pieces.findIndex((x) => matches(x, p.slots[0]!)));
        const ctx = `size=${size} seed=${seed} pos=${pos.join(',')}`;
        const counts = [0, 0, 0].map((_, i) => pos.filter((x) => x === i).length);
        expect(Math.max(...counts) - Math.min(...counts), ctx).toBeLessThanOrEqual(1);
        for (let i = 2; i < pos.length; i++) {
          expect(pos[i] === pos[i - 1] && pos[i] === pos[i - 2], ctx).toBe(false);
        }
      }
    }
  });

  it('K1: 全体では正解位置が 3 か所に均等に出る', () => {
    const counts = [0, 0, 0];
    for (const seed of SEEDS) {
      for (const p of generateRound(0, seed, 4)) {
        counts[p.pieces.findIndex((x) => matches(x, p.slots[0]!))]! += 1;
      }
    }
    for (const c of counts) expect(c).toBeGreaterThan(200);
  });

  it('全部の絵（形）が出る', () => {
    for (let level = 0; level < LEVEL_COUNT; level++) {
      const seen = new Set<string>();
      for (const seed of SEEDS) for (const p of generateRound(level, seed, 3)) seen.add(p.key);
      expect(seen.size, `level=${level}`).toBe(level === 0 ? 8 : PICTURES_BY_LEVEL[level]!.length);
    }
  });

  it('手元のピースが領域に収まり、重ならない（全 seed）', () => {
    for (let level = 0; level < LEVEL_COUNT; level++) {
      for (const seed of SEEDS) {
        for (const p of generateRound(level, seed, 5)) {
          const { cells, fits } = trayLayout(p);
          const ctx = `level=${level} seed=${seed} key=${p.key}`;
          expect(fits, ctx).toBe(true);
          for (let i = 0; i < cells.length; i++) {
            for (let j = i + 1; j < cells.length; j++) {
              const a = cells[i]!;
              const b = cells[j]!;
              const apart =
                a.x + a.w <= b.x + 1e-6 ||
                b.x + b.w <= a.x + 1e-6 ||
                a.y + a.h <= b.y + 1e-6 ||
                b.y + b.h <= a.y + 1e-6;
              expect(apart, `${ctx} ${i}-${j}`).toBe(true);
            }
          }
        }
      }
    }
  });
});

// ---------------------------------------------------------------- 置く判定

/** 正解の手順どおりに、スロットの中心をタップして絵を完成させる */
function solveByTaps(p: Puzzle) {
  let board = initBoard(p);
  const sol = solution(p)!;
  for (const step of sol) {
    board = selectPiece(board, step.piece);
    for (let t = 0; t < step.turns; t++) board = rotateSelected(board);
    const slot = p.slots[step.slot]!;
    const r = resolvePlacement(p, board, step.piece, { x: slot.x, y: slot.y });
    expect(r, `${p.key} slot ${step.slot}`).toEqual({ kind: 'place', slot: step.slot });
    if (r.kind === 'place') board = place(board, step.piece, r.slot);
  }
  return board;
}

describe('置く判定（resolvePlacement）', () => {
  it('全教材: 正解の手順でスロットの中心をタップすると完成する', () => {
    for (let level = 0; level < LEVEL_COUNT; level++) {
      const pool = level === 0 ? K1_CARDS.length : PICTURES_BY_LEVEL[level]!.length;
      const seen = new Set<string>();
      for (const seed of SEEDS) {
        for (const p of generateRound(level, seed, Math.min(5, pool))) {
          if (seen.has(p.key)) continue;
          seen.add(p.key);
          const board = solveByTaps(p);
          expect(isComplete(board), p.key).toBe(true);
        }
        if (seen.size === pool) break;
      }
      expect(seen.size, `level=${level}`).toBe(pool);
    }
  });

  it('K1: 候補の違う形を穴に入れようとすると置き間違い', () => {
    const p = generateRound(0, 3, 3)[0]!;
    const hole = p.slots[0]!;
    const wrong = p.pieces.find((x) => !matches(x, hole))!;
    const board = selectPiece(initBoard(p), wrong.id);
    expect(resolvePlacement(p, board, wrong.id, { x: 50, y: 50 })).toEqual({
      kind: 'wrong',
      slot: 0,
      reason: 'shape',
    });
  });

  it('K1: 穴から遠い余白は何もしない、近い（20 以内）の輪郭の外は置き間違い', () => {
    const p = generateRound(0, 3, 3)[0]!;
    const wrong = p.pieces.find((x) => !matches(x, p.slots[0]!))!;
    const board = selectPiece(initBoard(p), wrong.id);
    expect(resolvePlacement(p, board, wrong.id, { x: 5, y: 5 }).kind).toBe('ignore');
    expect(resolvePlacement(p, board, wrong.id, { x: 50, y: 5 }).kind).toBe('ignore');
    expect(resolvePlacement(p, board, wrong.id, { x: 50, y: 65 }).kind).toBe('wrong');
  });

  it('K4: 形は合っているが向きが違うと「向き」の置き間違い。まわすと入る', () => {
    const p = generateRound(3, 1, 6).find((x) => x.key === 'carrot')!;
    const body = p.pieces.find((x) => x.shape === 'triangle' && x.size === 52)!;
    const slotIndex = p.slots.findIndex((s) => s.size === 52);
    const slot = p.slots[slotIndex]!;
    let board = selectPiece(initBoard(p), body.id);
    expect(resolvePlacement(p, board, body.id, slot)).toEqual({
      kind: 'wrong',
      slot: slotIndex,
      reason: 'rotation',
    });
    board = rotateSelected(board);
    expect(board.turns[body.id]).toBe(1);
    expect(resolvePlacement(p, board, body.id, slot).kind).toBe('wrong');
    board = rotateSelected(board);
    expect(board.rots[body.id]).toBe(180);
    expect(resolvePlacement(p, board, body.id, slot)).toEqual({ kind: 'place', slot: slotIndex });
  });

  it('余りのピースはどこにも入らない', () => {
    const p = generateRound(1, 2, 3)[0]!;
    const sp = p.pieces.find((x) => !p.slots.some((s) => matches(x, s)))!;
    const board = selectPiece(initBoard(p), sp.id);
    for (const s of p.slots) {
      expect(resolvePlacement(p, board, sp.id, { x: s.x, y: s.y }).kind, p.key).toBe('wrong');
    }
  });

  it('同形同大のピースは、どちらのスロットにも入れてよい（ぐるま）', () => {
    const p = generateRound(1, 1, 8).find((x) => x.key === 'car')!;
    const wheels = p.pieces.filter((x) => x.shape === 'circle');
    expect(wheels).toHaveLength(2);
    const wheelSlots = p.slots.map((s, i) => ({ s, i })).filter(({ s }) => s.shape === 'circle');
    for (const wheel of wheels) {
      for (const { s, i } of wheelSlots) {
        const board = selectPiece(initBoard(p), wheel.id);
        expect(resolvePlacement(p, board, wheel.id, s)).toEqual({ kind: 'place', slot: i });
      }
    }
  });

  it('埋まったスロットは「置き場所」にならない（余白扱い）', () => {
    const p = generateRound(1, 1, 8).find((x) => x.key === 'house')!;
    const sol = solution(p)!;
    let board = initBoard(p);
    board = place(selectPiece(board, sol[0]!.piece), sol[0]!.piece, sol[0]!.slot);
    const other = sol[1]!;
    board = selectPiece(board, other.piece);
    const filledSlot = p.slots[sol[0]!.slot]!;
    // 埋まった場所をタップしても、別の空きスロットが遠ければ何もしない
    const r = resolvePlacement(p, board, other.piece, { x: filledSlot.x, y: filledSlot.y });
    expect(r.kind).toBe('ignore');
  });
});

describe('盤面の状態', () => {
  it('選ぶ・もう一度押すと外す・置いたピースは選べない', () => {
    const p = generateRound(1, 4, 3)[0]!;
    let b = initBoard(p);
    b = selectPiece(b, 1);
    expect(b.selected).toBe(1);
    b = selectPiece(b, 1);
    expect(b.selected).toBeNull();
    const sol = solution(p)!;
    b = place(selectPiece(b, sol[0]!.piece), sol[0]!.piece, sol[0]!.slot);
    expect(b.selected).toBeNull();
    expect(selectPiece(b, sol[0]!.piece)).toBe(b);
  });

  it('answerBoard は残りを正しく置き、向きも合わせる', () => {
    for (let level = 0; level < LEVEL_COUNT; level++) {
      for (const seed of [1, 2, 3, 4, 5]) {
        for (const p of generateRound(level, seed, 3)) {
          const b = answerBoard(p, initBoard(p));
          expect(isComplete(b), `${p.key}`).toBe(true);
          // 置いたピースは全部、そのスロットに入る向き
          b.placed.forEach((id, slot) => {
            const piece = p.pieces[id!]!;
            expect(matches({ ...piece, rot: b.rots[id!]! }, p.slots[slot]!), p.key).toBe(true);
          });
        }
      }
    }
  });

  it('途中まで置いた状態からも answerBoard で完成する', () => {
    const p = generateRound(2, 3, 3)[0]!;
    const sol = solution(p)!;
    const b = place(initBoard(p), sol[0]!.piece, sol[0]!.slot);
    expect(isComplete(answerBoard(p, b))).toBe(true);
  });

  it('restoreBoard: 合う状態は戻り、合わない状態は null', () => {
    const p = generateRound(1, 4, 3)[0]!;
    const sol = solution(p)!;
    const b = place(initBoard(p), sol[0]!.piece, sol[0]!.slot);
    expect(restoreBoard(p, JSON.parse(JSON.stringify(b)))).toEqual(b);
    expect(restoreBoard(p, null)).toBeNull();
    expect(restoreBoard(p, { ...b, placed: [] })).toBeNull();
    // 形の違うピースを置いたことにした状態
    const wrongPiece = p.pieces.findIndex((x) => !matches(x, p.slots[0]!));
    expect(
      restoreBoard(p, { ...b, placed: [wrongPiece, null, null].slice(0, b.placed.length) }),
    ).toBeNull();
    // 同じピースを2か所に置いたことにした状態
    expect(restoreBoard(p, { ...b, placed: b.placed.map(() => 0) })).toBeNull();
  });
});

describe('ヒント', () => {
  it('ヒントの置き場所: 選んだピースと同じ形の空きスロット、なければ最初の空きスロット', () => {
    const p = generateRound(1, 1, 8).find((x) => x.key === 'house')!;
    const board = initBoard(p);
    const roofSlot = p.slots.findIndex((s) => s.shape === 'triangle');
    const roofPiece = p.pieces.find((x) => x.shape === 'triangle')!;
    expect(hintTarget(p, board, roofPiece.id)).toBe(roofSlot);
    expect(hintTarget(p, board, null)).toBe(0);
    const spare = p.pieces.find((x) => !p.slots.some((s) => matches(x, s)))!;
    expect(hintTarget(p, board, spare.id)).toBe(0);
    // 余りのピースで置こうとしたスロットがあれば、その特徴を言う
    expect(hintTarget(p, board, spare.id, 1)).toBe(1);
    expect(hasOwnSlot(p, board, spare.id)).toBe(false);
    expect(hasOwnSlot(p, board, roofPiece.id)).toBe(true);
    expect(hasOwnSlot(p, board, null)).toBe(false);
    // 正しいピースを選んでいるなら、置こうとした場所より、そのピースの置き場所を示す
    expect(hintTarget(p, board, roofPiece.id, 1 - roofSlot)).toBe(roofSlot);
    const all = answerBoard(p, board);
    expect(hintTarget(p, all, null)).toBeNull();
  });

  it('K4: まわす必要があるときだけ「まわす」を囲む', () => {
    const p = generateRound(3, 1, 6).find((x) => x.key === 'umbrella')!;
    const canopy = p.pieces.find((x) => x.shape === 'semicircle')!;
    const canopySlot = p.slots.findIndex((s) => s.shape === 'semicircle');
    let board = initBoard(p);
    expect(needsTurn(p, board, canopy.id, canopySlot)).toBe(true);
    // ピースを選んでいなくても、入るはずの手元のピースの向きで判断する
    expect(needsTurn(p, board, null, canopySlot)).toBe(true);
    board = selectPiece(board, canopy.id);
    board = rotateSelected(rotateSelected(board));
    expect(needsTurn(p, board, canopy.id, canopySlot)).toBe(false);
    // K4 以外は「まわす」がない
    const k2 = generateRound(1, 1, 8)[0]!;
    expect(needsTurn(k2, initBoard(k2), null, 0)).toBe(false);
  });
});

describe('音声と表示の一致', () => {
  it('このモードの音声キーが台本にある', () => {
    const keys = [
      'shape.q-same',
      'shape.q-make',
      'shape.q-sample',
      'shape.how',
      'shape.how-turn',
      'shape.how-sample',
      'shape.pick-first',
      'shape.try-turn',
      'shape.here',
      'shape.here-find',
      'shape.rotated',
      'shape.fit',
      'shape.answer',
      'praise.self-fixed',
    ];
    for (const k of keys) expect(VOICE_CATALOG[k], k).toBeDefined();
    for (const s of SHAPES) {
      expect(VOICE_CATALOG[`shape.name.${s}`], s).toBeDefined();
      expect(VOICE_CATALOG[`shape.feat.${s}`], s).toBeDefined();
    }
    for (const [, list] of ALL_PICTURES) {
      for (const pic of list) expect(VOICE_CATALOG[`shape.made.${pic.id}`], pic.id).toBeDefined();
    }
  });

  it('ヒント1の特徴の文が、形の数え方と合っている', () => {
    const text = (s: string) => {
      const v = VOICE_CATALOG[`shape.feat.${s}`]!;
      return typeof v === 'string' ? v : v.text;
    };
    expect(text('triangle')).toContain('みっつ');
    expect(text('square')).toContain('よっつ');
    expect(text('rect')).toContain('よっつ');
    expect(text('rtriangle')).toContain('みっつ');
    expect(text('star')).toContain('いつつ');
  });
});
