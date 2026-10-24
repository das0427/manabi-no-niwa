/**
 * 内容レビュー（g3-math）の指摘の再発防止。全段階 × 多数の seed で生成して確かめる。
 */
import { describe, expect, it } from 'vitest';
import { createRng, hashSeed } from '../../core/util/rng';
import type { Item, UnitSpec } from '../../curriculum/types';
import pack from './index';

const SEEDS = 400;

function unitOf(id: string): UnitSpec {
  const u = pack.units.find((x) => x.id === id);
  if (!u) throw new Error(`単元が無い: ${id}`);
  return u;
}

/** 全段階 × SEEDS 個の問題 */
function many(unit: UnitSpec): Item[] {
  const src = unit.source;
  if (src.kind !== 'generator') return [...(src.items ?? [])];
  const out: Item[] = [];
  for (let level = 0; level < unit.levels.length; level++)
    for (let s = 0; s < SEEDS; s++)
      out.push(
        src.generate({
          level,
          rng: createRng(hashSeed('review-g3', unit.id, level, s)),
          index: s % 8,
        }),
      );
  return out;
}

type Pt = [number, number];
const d2 = (p: Pt, q: Pt) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
function isIsosceles(ps: Pt[]): boolean {
  const [a, b, c] = [d2(ps[0]!, ps[1]!), d2(ps[1]!, ps[2]!), d2(ps[2]!, ps[0]!)];
  return a === b || b === c || c === a;
}

/** 文の中に 数 v が（前後が数字・小数点でない形で）出るか */
function hasNumber(text: string, v: number): boolean {
  return new RegExp(`(?<![0-9.])${String(v).replace('.', '\\.')}(?![0-9.])`).test(text);
}

/**
 * ヒントに答えがそのまま出ていないか。
 * number: 各欄の答えの数（問題文・図にすでに出ている数は除く）。choice: 正解の選択肢の文字列。
 */
function hintLeaks(it: Item): string[] {
  const hints = it.hints.join('\n');
  const errs: string[] = [];
  if (it.engine === 'number') {
    // 問題文と図（表の図は 行ごとに セルを つないだ 数も）
    const fig = it.figure as { kind?: string; rows?: string[][] } | undefined;
    const rows = fig?.kind === 'table' ? (fig.rows ?? []).map((r) => r.join('')).join('\n') : '';
    const given = `${it.prompt}\n${JSON.stringify(it.figure ?? '')}\n${rows}`;
    for (const f of it.fields) {
      const a = f.answer as { kind: string; value?: number };
      if (a.kind !== 'int' && a.kind !== 'decimal') continue;
      const v = a.value!;
      if (hasNumber(hints, v) && !hasNumber(given, v)) errs.push(`[${it.id}] ヒントに答え ${v}`);
    }
  }
  if (it.engine === 'choice') {
    for (const o of it.options)
      if (o.correct && o.label && hints.includes(o.label))
        errs.push(`[${it.id}] ヒントに正解「${o.label}」`);
  }
  return errs;
}

describe('g3-math 内容レビューの再発防止', () => {
  it('triangles classify-alt:pick: 正解だけが二等辺三角形（誤答の形は二等辺でない）', () => {
    let n = 0;
    for (const it of many(unitOf('g3.math.triangles'))) {
      if (!it.id.startsWith('classify-alt:pick') || it.engine !== 'geometry') continue;
      const task = it.task as unknown as {
        options: { shape: { points: Pt[] }; correct?: boolean }[];
      };
      for (const o of task.options)
        expect(isIsosceles(o.shape.points), `${it.id}`).toBe(!!o.correct);
      n++;
    }
    expect(n).toBeGreaterThan(20);
  });

  it('fractions figure-alt: 正解の図だけが ● の長さ ＝ k/n（等分でない図も k/n にならない）', () => {
    let n = 0;
    for (const it of many(unitOf('g3.math.fractions'))) {
      if (!it.id.startsWith('figure-alt:') || it.engine !== 'choice') continue;
      const [k, den] = it.id.split(':')[1]!.split('/').map(Number) as [number, number];
      for (const o of it.options) {
        const fig = o.figure as { kind: string; parts: { length: number; label?: string }[] };
        expect(fig.kind).toBe('tape');
        const total = fig.parts.reduce((s, p) => s + p.length, 0);
        const marked = fig.parts.filter((p) => p.label === '●').reduce((s, p) => s + p.length, 0);
        const lengths = new Set(fig.parts.map((p) => p.length));
        const isKn = marked * den === k * total;
        // 正解は 等分で k/n。誤答は k/n でない
        if (o.correct) expect(isKn && lengths.size === 1, it.id).toBe(true);
        else expect(isKn, `${it.id} ${JSON.stringify(fig.parts)}`).toBe(false);
      }
      n++;
    }
    expect(n).toBeGreaterThan(20);
  });

  it('fractions compare-alt: ＜ と ＞ の どちらも 正解に なる（向きを 混ぜる）', () => {
    const rel = new Map<string, number>();
    for (const it of many(unitOf('g3.math.fractions'))) {
      if (!it.id.startsWith('compare-alt') || it.engine !== 'choice') continue;
      const c = it.options.find((o) => o.correct)!.label!;
      rel.set(c, (rel.get(c) ?? 0) + 1);
    }
    const total = [...rel.values()].reduce((a, b) => a + b, 0);
    expect((rel.get('＜') ?? 0) / total).toBeLessThan(0.65);
    expect((rel.get('＞') ?? 0) / total).toBeGreaterThan(0.2);
  });

  const LEAK_TARGETS: [string, string[]][] = [
    ['g3.math.division-basic', ['zero-one']],
    ['g3.math.box-expression', ['make:', 'make-alt:']],
    ['g3.math.circle-sphere', ['sphere-alt:biggest']],
    ['g3.math.mult-2digit', ['partial:', 'partial-alt:']],
    ['g3.math.length-km', ['unit-alt:']],
    ['g3.math.weight', ['unit-alt:', 'convert-alt:']],
    ['g3.math.mult-rules', ['ten:', 'ten-alt:']],
  ];
  for (const [uid, prefixes] of LEAK_TARGETS)
    it(`${uid}: ヒントに 答えが そのまま 出ない（${prefixes.join('・')}）`, () => {
      let n = 0;
      const errs: string[] = [];
      for (const it of many(unitOf(uid))) {
        if (!prefixes.some((p) => it.id.startsWith(p))) continue;
        n++;
        errs.push(...hintLeaks(it));
      }
      expect(n).toBeGreaterThan(0);
      expect([...new Set(errs)].slice(0, 20)).toEqual([]);
    });

  it('mult-1digit・mult-2digit の文章題: 場面に あわない 大きな 数を 出さない', () => {
    // 3けたを 出してよい 場面だけ（それ以外は 1つ分の数の 上限）
    const LIMIT: Record<string, [number, number]> = {
      seats: [0, 60],
      pages: [0, 60],
      weight: [100, 999],
      bus: [0, 60],
      chairs: [0, 40],
      eggs: [0, 30],
      paper: [0, 30],
    };
    for (const uid of ['g3.math.mult-1digit', 'g3.math.mult-2digit'])
      for (const it of many(unitOf(uid))) {
        const m = /^bunshou(?:-alt)?:([a-z]+):(\d+)x(\d+)$/.exec(it.id);
        if (!m) continue;
        const lim = LIMIT[m[1]!];
        if (!lim) continue;
        const a = Number(m[2]);
        expect(a >= lim[0] && a <= lim[1], it.id).toBe(true);
      }
  });

  it('mult-rules ten: 10 × a の ヒント・解説は 交換した形（a × 9）を 使わない', () => {
    for (const it of many(unitOf('g3.math.mult-rules'))) {
      if (!/^ten(-alt)?:/.test(it.id)) continue;
      const first = it.id.startsWith('ten-alt') || /^ten:10x\d+$/.test(it.id);
      if (!first || it.id === 'ten:10x10') continue;
      expect(`${it.hints.join('')}${it.explain}`, it.id).not.toMatch(/(?<![0-9])[1-9] × 9/);
    }
  });
});
