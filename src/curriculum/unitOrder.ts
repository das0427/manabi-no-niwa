/**
 * 単元の並び（FX07・E-01）: 単元の地図の列が「習う順」に並ぶようにする。
 *
 * 索引（unit-index.json）は、小学生の段階（g1〜g6）の単元を、段階・教科ごとに次の順で並べる。
 *   1. 単元対応表（docs/expansion/curriculum-matrix.md）の表の行の順（学習体系の担当が決めた順）。
 *      表にない単元は、その後ろに ID の順。
 *   2. ただし、前提（prereq。前提の前提も含む）の単元は、かならず先に置く（トポロジカル順）。
 *      表の順が前提とぶつかるときだけ、前提のほうを先に出す（そのほかの単元の順は変えない）。
 * 段階・教科の並びそのもの（g1.ja → g1.life → g1.math → …）と、幼児の段階（p23・p4・p5）の単元は、
 * これまでの ID の順のまま（幼児のホームの札は preschoolHome.ts の定義で並べる。FX07 は単元の地図の話）。
 *
 * 純粋関数だけを置く（ファイルは読まない）。表の読み込みは build:unit-index とテストが行う。
 */
import type { UnitMeta } from './types';

/** 並べ替える段階（単元の地図がある小学生）。幼児は ID の順のまま */
const SCHOOL_STAGE = /^g[1-6]$/;

/** 表の行の最初の欄（単元 ID。バッククォートで囲んでいてもよい）。例: | g1.math.numbers-10 | 10までの数 | … */
const MATRIX_ROW = /^\|\s*\x60?((?:p23|p4|p5|g[1-6])\.[a-z]+\.[a-z0-9-]+)\x60?\s*\|/;

/** 単元対応表（Markdown）から、表の行にある単元 ID を、出てくる順に取り出す（重なりは最初だけ） */
export function parseMatrixOrder(md: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of md.split(/\r?\n/)) {
    const id = MATRIX_ROW.exec(line)?.[1];
    if (id !== undefined && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * 索引の並び。段階・教科ごとに、表の順で、前提を先にする。
 * 同じ入力には同じ並びを返す（units の元の並びに依らない）。
 */
export function orderUnits(units: readonly UnitMeta[], matrixOrder: readonly string[]): UnitMeta[] {
  const rank = new Map<string, number>();
  matrixOrder.forEach((id, i) => {
    if (!rank.has(id)) rank.set(id, i);
  });
  const byRank = (a: UnitMeta, b: UnitMeta): number => {
    const ra = rank.get(a.id);
    const rb = rank.get(b.id);
    if (ra !== undefined && rb !== undefined && ra !== rb) return ra - rb;
    if (ra !== undefined && rb === undefined) return -1;
    if (ra === undefined && rb !== undefined) return 1;
    return a.id.localeCompare(b.id);
  };

  // 前提の前提まで（索引にある単元だけ）。段階・教科をまたぐ前提を通ってつながる場合も数える
  const byId = new Map(units.map((u) => [u.id, u]));
  const memo = new Map<string, ReadonlySet<string>>();
  const ancestors = (id: string): ReadonlySet<string> => {
    const hit = memo.get(id);
    if (hit) return hit;
    const out = new Set<string>();
    // 前提が輪になっていても止まる（輪は単体テストで禁じる）
    memo.set(id, out);
    for (const p of byId.get(id)?.prereq ?? []) {
      if (!byId.has(p)) continue;
      out.add(p);
      for (const q of ancestors(p)) out.add(q);
    }
    return out;
  };

  // 段階・教科の並びは ID の順のまま
  const groups = new Map<string, UnitMeta[]>();
  for (const u of [...units].sort((a, b) => a.id.localeCompare(b.id))) {
    const key = `${u.stage}.${u.subject}`;
    const list = groups.get(key);
    if (list) list.push(u);
    else groups.set(key, [u]);
  }

  const out: UnitMeta[] = [];
  for (const list of groups.values()) {
    if (!SCHOOL_STAGE.test(list[0]?.stage ?? '')) {
      out.push(...list);
      continue;
    }
    // 表の順に並べ、前提が先に出ていないものは後ろへ回す（先に出せる最初の1つを取り出すことをくり返す）
    const rest = [...list].sort(byRank);
    const left = new Set(rest.map((u) => u.id));
    while (rest.length > 0) {
      const i = rest.findIndex((u) =>
        [...ancestors(u.id)].every((a) => a === u.id || !left.has(a)),
      );
      // 先に出せるものが無いのは前提が輪のとき。表の順で最初のものを出して先へ進む
      const [u] = rest.splice(i < 0 ? 0 : i, 1);
      if (!u) break;
      left.delete(u.id);
      out.push(u);
    }
  }
  return out;
}
