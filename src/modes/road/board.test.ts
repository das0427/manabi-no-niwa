import { describe, expect, it } from 'vitest';
import {
  applyPlacements,
  applyTool,
  findPath,
  isBoard,
  isLinked,
  nextRot,
  openSidesNotConnected,
  placedCount,
  stopPoint,
  tileOpenings,
  type Board,
  type Tool,
} from './board';
import { parseBoard } from './content';

/** 文字で盤面を作る（content.ts と同じ書き方。うすい線は固定の道） */
function mk(layout: string[], start: string, goal: string): Board {
  return parseBoard({
    id: 't',
    level: 0,
    cols: layout[0]!.length,
    rows: layout.length,
    layout,
    start,
    goal,
  }).board;
}

const route = (b: Board) =>
  findPath(b)
    ?.map((p) => `${p.r},${p.c}`)
    .join(' ') ?? null;

describe('タイルの開口と回転', () => {
  it('まっすぐは初期がよこ、1回転でたて', () => {
    expect(tileOpenings('straight', 0)).toEqual([1, 3]);
    expect(tileOpenings('straight', 1)).toEqual([0, 2]);
    expect(nextRot('straight', 0)).toBe(1);
    expect(nextRot('straight', 1)).toBe(0);
  });
  it('まがりかどは初期が右と下で、時計回りに90度ずつ', () => {
    expect(tileOpenings('corner', 0)).toEqual([1, 2]);
    expect(tileOpenings('corner', 1)).toEqual([2, 3]);
    expect(tileOpenings('corner', 2)).toEqual([0, 3]);
    expect(tileOpenings('corner', 3)).toEqual([0, 1]);
    expect(nextRot('corner', 3)).toBe(0);
  });
  it('分かれ道は3方向に開き、4通りの向きがある', () => {
    expect(tileOpenings('tee', 0)).toEqual([1, 2, 3]);
    expect(tileOpenings('tee', 1)).toEqual([0, 2, 3]);
    expect(tileOpenings('tee', 2)).toEqual([0, 1, 3]);
    expect(tileOpenings('tee', 3)).toEqual([0, 1, 2]);
    expect(new Set([0, 1, 2, 3].map((r) => tileOpenings('tee', r).join(''))).size).toBe(4);
  });
});

describe('接続（相互開口のときだけ）', () => {
  it('つながった道をたどってゴールに着く', () => {
    const b = mk(['S─┐', '..G'], 'r', 'u');
    expect(route(b)).toBe('0,0 0,1 0,2 1,2');
  });
  it('片側だけ開いていてもつながらない', () => {
    // (0,1) の曲がり角（┌）は右と下に開き、左（スタート側）には開いていない
    const b = mk(['S┌.', '..G'], 'r', 'u');
    expect(isLinked(b, { r: 0, c: 0 }, 1)).toBe(false);
    expect(findPath(b)).toBeNull();
  });
  it('向かい合う開口が両方あれば接続', () => {
    const b = mk(['S─.'], 'r', 'l');
    expect(isLinked(b, { r: 0, c: 0 }, 1)).toBe(true);
    expect(isLinked(b, { r: 0, c: 1 }, 1)).toBe(false); // 右は空きマス
  });
  it('盤面の端に向いた開口は行き止まり', () => {
    const b = mk(['─S'], 'r', 'l');
    expect(isLinked(b, { r: 0, c: 1 }, 1)).toBe(false);
    expect(findPath(b)).toBeNull();
  });
  it('いわ・空きマスはつながらない', () => {
    expect(findPath(mk(['S#G'], 'r', 'l'))).toBeNull();
    expect(findPath(mk(['S.G'], 'r', 'l'))).toBeNull();
  });
  it('スタートの向きが道に向いていなければ出発できない', () => {
    expect(findPath(mk(['S─G'], 'd', 'l'))).toBeNull();
  });
  it('ゴールの開口の向きに合わないと着かない', () => {
    expect(findPath(mk(['S─G'], 'r', 'l'))).not.toBeNull();
    expect(findPath(mk(['S─G'], 'r', 'u'))).toBeNull();
  });
});

describe('経路探索（最短・分岐・循環）', () => {
  it('行き止まりの枝があっても、ゴールへの枝を進む', () => {
    // (0,1) は分かれ道（右・下・左）。右は行き止まり、下がゴールへ
    const b = mk(['S┬─.', '.└─G'], 'r', 'l');
    expect(route(b)).toBe('0,0 0,1 1,1 1,2 1,3');
  });
  it('2通りの道があるとき、短い方を進む', () => {
    // 下の道は6マス、右まわりの道は8マス
    const b = mk(['S┬──┐', '.│..│', '.└─G┘'], 'r', 'lr');
    expect(route(b)).toBe('0,0 0,1 1,1 2,1 2,2 2,3');
  });
  it('同じ長さの2通りは毎回同じ道（上→右→下→左の順に探す）', () => {
    const b = mk(['.┌─┐.', 'S┤#├G', '.└─┘.'], 'r', 'l');
    const a = route(b);
    for (let i = 0; i < 5; i++) expect(route(b)).toBe(a);
    expect(a).toBe('1,0 1,1 0,1 0,2 0,3 1,3 1,4');
  });
  it('輪になった道を通ってゴールに着く（循環しても止まる）', () => {
    const ring = mk(['.┌─┐.', 'S┤#├G', '.└─┘.'], 'r', 'l');
    expect(findPath(ring)).not.toBeNull();
  });
  it('輪になった道があってゴールに着かなくても、探索は終わり止まる場所が決まる', () => {
    const ring = mk(['.┌─┐.', 'S┤#├.', '.└─┘G'], 'r', 'l');
    expect(findPath(ring)).toBeNull();
    // 到達できるマスのうちゴール(2,4)に一番近いのは (2,3)
    expect(stopPoint(ring)!.pos).toEqual({ r: 2, c: 3 });
  });
  it('スタートかゴールが無ければ null / 止まる場所もなし', () => {
    const noStart = mk(['─.G'], 'r', 'l');
    expect(findPath(noStart)).toBeNull();
    expect(stopPoint(noStart)).toBeNull();
  });
});

describe('止まる場所（経路が無いとき）', () => {
  it('何も置いていなければスタートで止まる', () => {
    const s = stopPoint(mk(['S..G'], 'r', 'l'))!;
    expect(s.pos).toEqual({ r: 0, c: 0 });
    expect(s.path).toEqual([{ r: 0, c: 0 }]);
  });
  it('つながっている所までは進み、ゴールに最も近いマスで止まる', () => {
    const s = stopPoint(mk(['S──..G'], 'r', 'l'))!;
    expect(s.pos).toEqual({ r: 0, c: 2 });
    expect(s.path.map((p) => p.c)).toEqual([0, 1, 2]);
  });
  it('同点は スタートからの経路が長い方', () => {
    // 上の道（短い）と下の道（長い）の先端が、ゴール(1,4)から同じ距離（2）
    const s = stopPoint(mk(['S┬──.', '.│..G', '.└──.'], 'r', 'l'))!;
    expect(s.pos).toEqual({ r: 2, c: 3 });
  });
  it('それも同じなら 行が小さい方', () => {
    const s = stopPoint(mk(['..┌─.', 'S─┤.G', '..└─.'], 'r', 'l'))!;
    expect(s.pos).toEqual({ r: 0, c: 3 });
  });
  it('それも同じなら 列が小さい方', () => {
    // (0,1) と (0,3) は、行も経路の長さもゴール(0,2)からの距離も同じ
    const s = stopPoint(mk(['.│G│.', '.│.│.', '.└┬┘.', '..S..'], 'u', 'd'))!;
    expect(s.pos).toEqual({ r: 0, c: 1 });
  });
  it('同じ盤面なら何度やっても同じ場所（決定的）', () => {
    const b = mk(['..┌─.', 'S─┤.G', '..└─.'], 'r', 'l');
    const first = stopPoint(b)!;
    for (let i = 0; i < 5; i++) expect(stopPoint(b)).toEqual(first);
  });
  it('止まった所の、つながっていない開口の向き', () => {
    const b = mk(['S──..G'], 'r', 'l');
    // (0,2) の右は空きマス → つながっていない。左はつながっている
    expect(openSidesNotConnected(b, { r: 0, c: 2 })).toEqual([1]);
    expect(openSidesNotConnected(b, { r: 0, c: 0 })).toEqual([]);
  });
  it('盤面の端に向いた開口も「つながっていない向き」', () => {
    const b = mk(['.│G│.', '.│.│.', '.└┬┘.', '..S..'], 'u', 'd');
    expect(openSidesNotConnected(b, { r: 0, c: 1 })).toEqual([0]);
  });
  it('向かい合わせの片側だけ開いている向きも数える', () => {
    // (0,1) の曲がり角（┐）は下に開くが、下のマスは上に開いていない（─）
    const b = mk(['S┐.', '.─G'], 'r', 'l');
    expect(openSidesNotConnected(b, { r: 0, c: 1 })).toEqual([2]);
  });
});

describe('道具（置く・回す・けす）', () => {
  const base = mk(['S.G'], 'r', 'l');
  const at = { r: 0, c: 1 };

  it('空きマスに置く: まっすぐ=よこ、まがりかど=右と下', () => {
    const s = applyTool(base, at, 'straight');
    expect(s.action).toBe('place');
    expect(s.board.cells[0]![1]).toEqual({ t: 'tile', kind: 'straight', rot: 0 });
    const c = applyTool(base, at, 'corner');
    expect(c.board.cells[0]![1]).toEqual({ t: 'tile', kind: 'corner', rot: 0 });
    expect(placedCount(c.board)).toBe(1);
  });
  it('分かれ道も置ける（じゆう）', () => {
    const t = applyTool(base, at, 'tee');
    expect(t.board.cells[0]![1]).toEqual({ t: 'tile', kind: 'tee', rot: 0 });
  });
  it('元の盤面は書き換えない', () => {
    const before = JSON.stringify(base);
    applyTool(base, at, 'straight');
    expect(JSON.stringify(base)).toBe(before);
  });
  it('置いた道をタップすると、選んでいる道具に関係なく90度回る', () => {
    const placed = applyTool(base, at, 'straight').board;
    for (const tool of ['straight', 'corner', 'tee'] as Tool[]) {
      const r = applyTool(placed, at, tool);
      expect(r.action).toBe('rotate');
      expect(r.board.cells[0]![1]).toEqual({ t: 'tile', kind: 'straight', rot: 1 });
    }
    let cur = applyTool(base, at, 'corner').board;
    const rots: number[] = [];
    for (let i = 0; i < 4; i++) {
      cur = applyTool(cur, at, 'straight').board;
      rots.push((cur.cells[0]![1] as { rot: number }).rot);
    }
    expect(rots).toEqual([1, 2, 3, 0]);
  });
  it('けす を選んでいるときだけ消える', () => {
    const placed = applyTool(base, at, 'corner').board;
    const r = applyTool(placed, at, 'erase');
    expect(r.action).toBe('remove');
    expect(r.board.cells[0]![1]).toEqual({ t: 'empty' });
  });
  it('空きマスを けす でタップしても何も起きない', () => {
    const r = applyTool(base, at, 'erase');
    expect(r.action).toBe('none');
    expect(r.board).toBe(base);
  });
  it('固定の道・いわ・スタート・ゴールは触っても変わらない', () => {
    const b = mk(['S─#G'], 'r', 'l');
    for (const c of [0, 1, 2, 3]) {
      for (const tool of ['straight', 'corner', 'tee', 'erase'] as Tool[]) {
        const r = applyTool(b, { r: 0, c }, tool);
        expect(r.action).toBe('none');
        expect(r.board).toBe(b);
      }
    }
  });
  it('盤面の外は何も起きない', () => {
    expect(applyTool(base, { r: 5, c: 5 }, 'straight').action).toBe('none');
  });
  it('置く → 回してつなぐ → 着く / 回し直すと切れる', () => {
    let b = mk(['S..G'], 'r', 'l');
    b = applyTool(b, { r: 0, c: 1 }, 'straight').board;
    b = applyTool(b, { r: 0, c: 2 }, 'straight').board;
    expect(findPath(b)).not.toBeNull();
    b = applyTool(b, { r: 0, c: 2 }, 'straight').board; // たてになる
    expect(findPath(b)).toBeNull();
    b = applyTool(b, { r: 0, c: 2 }, 'corner').board; // 道具に関係なく回って、よこに戻る
    expect(findPath(b)).not.toBeNull();
  });
});

describe('参考解の適用と保存データの検査', () => {
  it('空きマスにだけ置く（固定の道・いわは上書きしない）', () => {
    const b = mk(['S─#G'], 'r', 'l');
    const r = applyPlacements(b, [
      { r: 0, c: 1, kind: 'corner', rot: 0 },
      { r: 0, c: 2, kind: 'straight', rot: 0 },
    ]);
    expect(r.cells[0]![1]).toEqual(b.cells[0]![1]);
    expect(r.cells[0]![2]).toEqual({ t: 'rock' });
  });
  it('盤面として読めるデータだけ受け付ける', () => {
    const b = mk(['S.G'], 'r', 'l');
    expect(isBoard(JSON.parse(JSON.stringify(b)))).toBe(true);
    expect(isBoard(null)).toBe(false);
    expect(isBoard({ cols: 3, rows: 1, cells: [[{ t: 'empty' }]] })).toBe(false);
    expect(isBoard({ cols: 1, rows: 1, cells: [[{ t: 'wall' }]] })).toBe(false);
  });
});
