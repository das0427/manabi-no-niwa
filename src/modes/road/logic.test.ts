import { describe, expect, it } from 'vitest';
import { hasVoice } from '../../voice/catalog/index';
import {
  applyPlacements,
  applyTool,
  findPath,
  findCell,
  openingsOf,
  posKey,
  stopPoint,
  type Board,
  type Cell,
  type Dir,
  type Placement,
} from './board';
import { ALL_BOARDS, LEVEL_BOARDS, parseBoard, parsed, type RoadBoardDef } from './content';
import { bestSolution, generateRound, hintCell, initialBoard, praiseKey } from './logic';

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
const LEVEL_NAME = ['R1', 'R2', 'R3', 'R4'];

const pathKeys = (b: Board) => findPath(b)?.map(posKey) ?? [];

/** 1つの参考解がちょうど空きマスだけを使っているか（原因のわかるメッセージつき） */
function emptyOnly(def: RoadBoardDef, sol: Placement[]): string[] {
  const board = initialBoard(def);
  const bad: string[] = [];
  const seen = new Set<string>();
  for (const pl of sol) {
    const cell = board.cells[pl.r]?.[pl.c];
    if (cell?.t !== 'empty')
      bad.push(`${def.id} (${pl.r},${pl.c}) は空きマスではない（${cell?.t}）`);
    if (seen.has(posKey(pl))) bad.push(`${def.id} (${pl.r},${pl.c}) を2回置いている`);
    seen.add(posKey(pl));
  }
  return bad;
}

describe('教材の数', () => {
  it('段階ごとに8面、全部で32面。idが重複しない', () => {
    expect(LEVEL_BOARDS.map((l) => l.length)).toEqual([8, 8, 8, 8]);
    expect(ALL_BOARDS).toHaveLength(32);
    expect(new Set(ALL_BOARDS.map((d) => d.id)).size).toBe(32);
  });
  it('段階ごとの盤面の大きさ（R1・R2 は 4×3、R3・R4 は 5×4）', () => {
    for (const d of ALL_BOARDS) {
      const [cols, rows] = d.level <= 1 ? [4, 3] : [5, 4];
      expect([d.cols, d.rows], d.id).toEqual([cols, rows]);
      expect(d.layout, d.id).toHaveLength(rows);
      for (const row of d.layout) expect([...row], `${d.id} ${row}`).toHaveLength(cols);
      for (const row of d.alt ?? []) expect([...row], `${d.id} alt ${row}`).toHaveLength(cols);
      expect(d.alt === undefined, `${d.id} alt`).toBe(d.level !== 3);
    }
  });
});

describe.each(ALL_BOARDS.map((d) => [d.id, d] as const))('盤面 %s', (_id, def) => {
  const p = parsed(def);
  const start = findCell(p.board, 'start');
  const goal = findCell(p.board, 'goal');

  it('スタートとゴールが1つずつ。スタートの開口は1方向、ゴールは1〜4方向', () => {
    const count = (t: Cell['t']) => p.board.cells.flat().filter((c) => c.t === t).length;
    expect(count('start')).toBe(1);
    expect(count('goal')).toBe(1);
    expect(openingsOf(p.board.cells[start!.r]![start!.c]!)).toHaveLength(1);
    const g = openingsOf(p.board.cells[goal!.r]![goal!.c]!).length;
    expect(g).toBeGreaterThanOrEqual(1);
    expect(g).toBeLessThanOrEqual(4);
  });

  it('① 初期状態ではつながっていない', () => {
    expect(findPath(p.board), `${def.id} 初期でつながっている`).toBeNull();
  });

  it('② 参考解でつながる', () => {
    const solved = applyPlacements(p.board, p.solutions[0]!);
    expect(findPath(solved), `${def.id} 参考解でつながらない`).not.toBeNull();
  });

  it('③ 参考解は空きマスだけを使う ④ いわの上に置かない', () => {
    expect(emptyOnly(def, p.solutions[0]!)).toEqual([]);
    for (const pl of p.solutions[0]!) {
      expect(p.board.cells[pl.r]![pl.c]!.t, `${def.id} (${pl.r},${pl.c})`).not.toBe('rock');
    }
  });

  it('参考解にはタイルが過不足なく要る（1つ外すとつながらない）', () => {
    for (const sol of p.solutions) {
      sol.forEach((_, i) => {
        const fewer = sol.filter((__, j) => j !== i);
        expect(findPath(applyPlacements(p.board, fewer)), `${def.id} ${i}番目が不要`).toBeNull();
      });
    }
  });

  it('参考解に分かれ道は使わない（分かれ道は固定の道としてだけ出る）', () => {
    for (const sol of p.solutions) for (const pl of sol) expect(pl.kind).not.toBe('tee');
  });

  it('段階ごとの空きマスの数・いわ・分かれ道', () => {
    const n = p.solutions[0]!.length;
    const rocks = p.board.cells.flat().filter((c) => c.t === 'rock').length;
    const tees = p.board.cells.flat().filter((c) => c.t === 'fixed' && c.kind === 'tee').length;
    const label = `${def.id} (${LEVEL_NAME[def.level]}) 空き=${n}`;
    if (def.level === 0) expect(n, label).toBe(1);
    if (def.level === 1) {
      expect(n, label).toBeGreaterThanOrEqual(2);
      expect(n, label).toBeLessThanOrEqual(3);
    }
    if (def.level === 2) {
      expect(n, label).toBeGreaterThanOrEqual(3);
      expect(n, label).toBeLessThanOrEqual(4);
    }
    if (def.level === 3) {
      expect(n, label).toBeGreaterThanOrEqual(3);
      expect(n, label).toBeLessThanOrEqual(5);
    }
    if (def.level <= 1) expect(rocks, `${def.id} いわ`).toBe(0);
    if (def.level === 2) expect(rocks, `${def.id} いわ`).toBeGreaterThanOrEqual(1);
    if (def.level <= 2) expect(tees, `${def.id} 分かれ道`).toBe(0);
    if (def.level === 3) expect(tees, `${def.id} 分かれ道`).toBeGreaterThanOrEqual(1);
  });

  if (def.level === 3) {
    it('⑤ R4 は2通り以上の正解経路: 参考解とは別の配置でもつながり、経路が違う', () => {
      expect(p.solutions).toHaveLength(2);
      const [main, alt] = p.solutions as [Placement[], Placement[]];
      expect(emptyOnly(def, alt)).toEqual([]);
      expect(alt.length, `${def.id} alt`).toBeGreaterThanOrEqual(2);
      // 固定の道は同じ（alt は固定の道を書き換えていない）
      def.alt!.forEach((row, r) =>
        [...row].forEach((ch, c) => {
          if ('.━┃┏┓┛┗┳┫┻┣'.includes(ch)) return;
          expect(ch, `${def.id} alt (${r},${c})`).toBe(def.layout[r]![c]);
        }),
      );
      const a = applyPlacements(p.board, main);
      const b = applyPlacements(p.board, alt);
      const pa = pathKeys(a);
      const pb = pathKeys(b);
      expect(pa.length, `${def.id} 参考解`).toBeGreaterThan(0);
      expect(pb.length, `${def.id} alt`).toBeGreaterThan(0);
      expect(pb, `${def.id} 2つの道が同じ`).not.toEqual(pa);
      // 2つの道は、分かれ道（固定のT字）を通る
      const isTee = (k: string) => {
        const [r, c] = k.split(',').map(Number) as [number, number];
        const cell = p.board.cells[r]![c]!;
        return cell.t === 'fixed' && cell.kind === 'tee';
      };
      expect(pa.some(isTee), `${def.id} 参考解の道に分かれ道が無い`).toBe(true);
      expect(pb.some(isTee), `${def.id} altの道に分かれ道が無い`).toBe(true);
      // 2つの解を両方置いても（両方の道が開いても）正解のまま
      expect(findPath(applyPlacements(p.board, [...main, ...alt]))).not.toBeNull();
    });
  }
});

describe('同じ盤面の繰り返しと、左右反転だけの盤面', () => {
  const keyOf = (cell: Cell, f: (d: Dir) => Dir): string => {
    switch (cell.t) {
      case 'empty':
        return '.';
      case 'rock':
        return '#';
      case 'start':
        return `S${f(cell.dir)}`;
      case 'goal':
        return `G${cell.dirs.map(f).sort().join('')}`;
      case 'fixed':
        return `F${openingsOf(cell).map(f).sort().join('')}`;
      default:
        return 'T';
    }
  };
  /** 元・左右反転・上下反転・180度回転 の4つの見え方 */
  const forms = (b: Board): string[] => {
    const render = (flipH: boolean, flipV: boolean) => {
      // 左右反転は 右⇄左、上下反転は 上⇄下 に開口の向きを入れ替える
      const f = (d: Dir): Dir => {
        let x: number = d;
        if (flipH && x % 2 === 1) x = 4 - x;
        if (flipV && x % 2 === 0) x = 2 - x;
        return x as Dir;
      };
      return b.cells
        .map((_, r) => {
          const row = b.cells[flipV ? b.rows - 1 - r : r]!;
          return row.map((__, c) => keyOf(row[flipH ? b.cols - 1 - c : c]!, f)).join(' ');
        })
        .join('/');
    };
    return [render(false, false), render(true, false), render(false, true), render(true, true)];
  };

  it('左右・上下に反転しただけの盤面を別の面として数えていない（同じ大きさの盤面どうし）', () => {
    const groups = [ALL_BOARDS.filter((d) => d.level <= 1), ALL_BOARDS.filter((d) => d.level >= 2)];
    for (const group of groups) {
      const all = group.map((d) => forms(initialBoard(d)));
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          expect(all[j]!, `${group[i]!.id} と ${group[j]!.id} が反転しただけ`).not.toContain(
            all[i]![0],
          );
        }
      }
    }
  });
  it('鏡像の判定そのものが働く（左右反転した盤面を同じ盤面と見抜く）', () => {
    const a = parseBoard({
      id: 'a',
      level: 0,
      cols: 4,
      rows: 3,
      layout: ['S─┐.', '..│.', '..└G'],
      start: 'r',
      goal: 'l',
    });
    const b = parseBoard({
      id: 'b',
      level: 0,
      cols: 4,
      rows: 3,
      layout: ['.┌─S', '.│..', 'G┘..'],
      start: 'l',
      goal: 'r',
    });
    const c = parseBoard({
      id: 'c',
      level: 0,
      cols: 4,
      rows: 3,
      layout: ['S─┐.', '..│.', '..┘G'],
      start: 'r',
      goal: 'l',
    });
    expect(forms(a.board)).toContain(forms(b.board)[0]);
    expect(forms(a.board)).not.toContain(forms(c.board)[0]);
  });
});

describe('出題（generateRound）', () => {
  for (const level of [0, 1, 2, 3]) {
    for (const size of [2, 3]) {
      it(`${LEVEL_NAME[level]} size=${size}: 重複せず、その段階の盤面だけ（seed 1..200）`, () => {
        for (const seed of SEEDS) {
          const ctx = `level=${level} size=${size} seed=${seed}`;
          const defs = generateRound(level, seed, size);
          expect(defs, ctx).toHaveLength(size);
          expect(new Set(defs.map((d) => d.id)).size, ctx).toBe(size);
          for (const d of defs) expect(d.level, ctx).toBe(level);
          expect(
            generateRound(level, seed, size).map((d) => d.id),
            ctx,
          ).toEqual(defs.map((d) => d.id));
        }
      });
    }
    it(`${LEVEL_NAME[level]}: 8面すべてが出題される。出る回数が極端に偏らない`, () => {
      const count = new Map<string, number>();
      for (const seed of SEEDS)
        for (const d of generateRound(level, seed, 3)) count.set(d.id, (count.get(d.id) ?? 0) + 1);
      expect(count.size).toBe(8);
      for (const [id, n] of count) {
        expect(n, id).toBeGreaterThan(40);
        expect(n, id).toBeLessThan(110);
      }
    });
  }
  it('段階の範囲外は端に丸める', () => {
    expect(generateRound(-3, 1, 2).every((d) => d.level === 0)).toBe(true);
    expect(generateRound(9, 1, 2).every((d) => d.level === 3)).toBe(true);
  });
});

describe('ヒント（止まった所に一番近い参考解のマス）', () => {
  it('何も置いていなければ、スタートのとなりの参考解のマス', () => {
    const def = ALL_BOARDS.find((d) => d.id === 'r1-1')!;
    expect(hintCell(def, initialBoard(def))).toEqual({ r: 1, c: 1 });
  });
  it('つながっていれば出さない', () => {
    const def = ALL_BOARDS[0]!;
    const solved = applyPlacements(initialBoard(def), parsed(def).solutions[0]!);
    expect(hintCell(def, solved)).toBeNull();
  });
  it('止まった所に一番近い順に出る（R2-4: 3か所の曲がり角）', () => {
    const def = ALL_BOARDS.find((d) => d.id === 'r2-4')!;
    let b = initialBoard(def);
    expect(hintCell(def, b)).toEqual({ r: 0, c: 1 });
    // (0,1) に ┐ を置く（rot1）→ 次は (1,1)
    b = applyTool(b, { r: 0, c: 1 }, 'corner').board; // ┌
    b = applyTool(b, { r: 0, c: 1 }, 'corner').board; // ┐
    expect(hintCell(def, b)).toEqual({ r: 1, c: 1 });
  });
  it('置いてあるが向きの違うマスを指す（止まった所そのもの）', () => {
    const def = ALL_BOARDS.find((d) => d.id === 'r1-3')!;
    let b = initialBoard(def);
    b = applyTool(b, { r: 0, c: 2 }, 'corner').board; // 向きが違う（┌）
    // うさぎは (0,1) で止まる。(0,2) はとなりの空きではなく置いたマス → 指す
    expect(hintCell(def, b)).toEqual({ r: 0, c: 2 });
  });
  it('全32面で、ヒントの指すマスに参考解を置いていくと、置いた数以内で必ずつながる', () => {
    for (const def of ALL_BOARDS) {
      const p = parsed(def);
      let b = initialBoard(def);
      const limit = Math.max(...p.solutions.map((s) => s.length)) + 1;
      let steps = 0;
      while (!findPath(b)) {
        const cell = hintCell(def, b);
        expect(cell, `${def.id} ステップ${steps} でヒントが出ない`).not.toBeNull();
        const sol = bestSolution(p, b);
        const target = sol.find((pl) => pl.r === cell!.r && pl.c === cell!.c);
        expect(target, `${def.id} ヒント (${cell!.r},${cell!.c}) が参考解の外`).toBeDefined();
        // そのマスが空きなら置く。置いてあれば参考解の向きに直す
        b = applyPlacements(b, [target!]);
        steps += 1;
        expect(steps, `${def.id} が終わらない`).toBeLessThanOrEqual(limit);
      }
    }
  });
  it('R4 では、すでに別の道を作りかけていればその道のマスを指す', () => {
    const def = ALL_BOARDS.find((d) => d.id === 'r4-2')!;
    const p = parsed(def);
    // 左の道（alt）の1つ目を置いた
    let b = applyPlacements(initialBoard(def), [p.solutions[1]![0]!]);
    expect(bestSolution(p, b)).toBe(p.solutions[1]);
    expect(hintCell(def, b)).toEqual({ r: p.solutions[1]![1]!.r, c: p.solutions[1]![1]!.c });
    // 右の道（主）を作りかけていれば主の道
    b = applyPlacements(initialBoard(def), [p.solutions[0]![0]!, p.solutions[0]![1]!]);
    expect(bestSolution(p, b)).toBe(p.solutions[0]);
  });
});

describe('止まる場所は教材でも決定的', () => {
  it('全32面の初期盤面は、スタートのとなりまでで止まる（どの面も同じ答え）', () => {
    for (const def of ALL_BOARDS) {
      const b = initialBoard(def);
      const s1 = stopPoint(b);
      const s2 = stopPoint(b);
      expect(s1, def.id).toEqual(s2);
      expect(s1, def.id).not.toBeNull();
    }
  });
});

describe('回の終わりの声かけ', () => {
  it('向きを変えてつながった盤面があれば praise.rotated', () => {
    expect(
      praiseKey([
        { rotated: false, selfFixed: false },
        { rotated: true, selfFixed: true },
      ]),
    ).toBe('praise.rotated');
  });
  it('やり直して着いた盤面だけなら praise.self-fixed', () => {
    expect(praiseKey([{ rotated: false, selfFixed: true }])).toBe('praise.self-fixed');
  });
  it('どちらでもなければ省略（＝さいごまで できたね）', () => {
    expect(praiseKey([{ rotated: false, selfFixed: false }])).toBeUndefined();
  });
  it('全部つぎへ の回は praise.watched', () => {
    expect(praiseKey([{ rotated: false, selfFixed: false, skipped: true }])).toBe('praise.watched');
    expect(
      praiseKey([
        { rotated: false, selfFixed: false, skipped: true },
        { rotated: false, selfFixed: false },
      ]),
    ).toBeUndefined();
    expect(hasVoice('praise.watched')).toBe(true);
  });
  it('使う声かけキーは台本にある', () => {
    expect(hasVoice('praise.rotated')).toBe(true);
    expect(hasVoice('praise.self-fixed')).toBe(true);
    expect(hasVoice('praise.finished')).toBe(true);
  });
});
