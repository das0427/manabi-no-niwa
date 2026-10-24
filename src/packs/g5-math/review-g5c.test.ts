/**
 * 教材レビュー g5c（fraction-equiv・multiples-divisors・per-unit・percent）で直した点の再発防止。
 * 全段階 × seed 0..299 × index 0..3 で生成し、id・問題文の数値から 正答を 独立に 計算し直して 確かめる。
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/util/rng';
import type { Item, UnitSpec } from '../../curriculum/types';
import { fractionEquiv } from './fraction-equiv';
import { multiplesDivisors } from './multiples-divisors';
import { perUnit } from './per-unit';
import { percent } from './percent';

const SEEDS = 300;

function allItems(unit: UnitSpec): Item[] {
  const src = unit.source;
  if (src.kind !== 'generator') throw new Error('generator ではない');
  const out: Item[] = [];
  for (let level = 0; level < unit.levels.length; level++)
    for (let seed = 0; seed < SEEDS; seed++)
      for (let index = 0; index < 4; index++)
        out.push(src.generate({ level, rng: createRng(seed), index }));
  return out;
}

/** 《よみ》を はずす */
const plain = (s: string) => s.replace(/《[^》]*》/g, '');

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

/** 1つめの 欄の 答え（整数・小数） */
const numAns = (it: Item): number => {
  if (it.engine !== 'number') throw new Error(`number ではない: ${it.id}`);
  const a = it.fields[0]!.answer;
  if (a.kind !== 'int' && a.kind !== 'decimal') throw new Error(`整数・小数ではない: ${it.id}`);
  return a.value;
};

const intAt = (parts: string[], i: number) => Number(parts[i]);
const frac = (s: string): [number, number] => {
  const [n, d] = s.split('/').map(Number);
  return [n!, d!];
};
/** 選択肢の 分数 [[a/b]] */
const labelFrac = (label: string): [number, number] | null => {
  const m = /^\[\[(\d+)\/(\d+)\]\]$/.exec(label);
  return m ? [Number(m[1]), Number(m[2])] : null;
};

describe('review g5c: g5.math.fraction-equiv', () => {
  const items = allItems(fractionEquiv);

  it('3つの 分数の 大きさくらべは 分母の 最小公倍数が 60まで、正解は いちばん 大きい 分数', () => {
    const alts = items.filter((it) => it.id.startsWith('compare-alt:'));
    expect(alts.length).toBeGreaterThan(20);
    for (const it of alts) {
      if (it.engine !== 'choice') throw new Error(it.id);
      const fr = it.id.split(':')[1]!.split(',').map(frac);
      expect(fr.length).toBe(3);
      expect(
        fr.reduce((s, [, d]) => lcm(s, d), 1),
        it.id,
      ).toBeLessThanOrEqual(60);
      const correct = it.options.filter((o) => o.correct);
      expect(correct.length).toBe(1);
      const [cn, cd] = labelFrac(correct[0]!.label!)!;
      for (const o of it.options) {
        const [n, d] = labelFrac(o.label!)!;
        if (!o.correct) expect(n * cd < cn * d, it.id).toBe(true);
      }
    }
  });

  it('約分を 選ぶ問題は「いちばん かんたんな 分数」と 問い、正解は 既約分数・とちゅうの 約分は 誤り', () => {
    const alts = items.filter((it) => it.id.startsWith('reduce-alt:'));
    expect(alts.length).toBeGreaterThan(20);
    for (const it of alts) {
      if (it.engine !== 'choice') throw new Error(it.id);
      expect(plain(it.prompt)).toContain('いちばん かんたんな 分数');
      const [A, B] = frac(it.id.split(':')[1]!);
      const g = gcd(A, B);
      for (const o of it.options) {
        const f = labelFrac(o.label!);
        expect(f, it.id).not.toBeNull();
        const [n, d] = f!;
        const isLowestEqual = n * B === d * A && gcd(n, d) === 1;
        expect(!!o.correct, `${it.id} ${o.label}`).toBe(isLowestEqual);
        if (o.correct) expect([n, d]).toEqual([A / g, B / g]);
      }
    }
  });

  it('等しい 分数・通分・2つの 大きさくらべの 正答を 計算し直す', () => {
    for (const it of items) {
      const p = it.id.split(':');
      if (p[0] === 'equal') {
        const [a, b] = frac(p[3]!);
        const m = intAt(p, 4);
        const exp = p[1] === 'down' ? (p[2] === 'n' ? a : b) : p[2] === 'n' ? a * m : b * m;
        expect(numAns(it), it.id).toBe(exp);
      }
      if (p[0] === 'common') {
        if (it.engine !== 'number') throw new Error(it.id);
        const [a, b] = frac(p[2]!);
        const other = p[1]!.split(',').find((s) => s !== p[2])!;
        const [c, d] = frac(other);
        const L = lcm(b, d);
        expect(
          it.fields.map((f) => (f.answer.kind === 'int' ? f.answer.value : NaN)),
          it.id,
        ).toEqual([L, (a * L) / b, (c * L) / d]);
      }
      if (p[0] === 'compare') {
        if (it.engine !== 'choice') throw new Error(it.id);
        const [a, b] = frac(p[1]!);
        const [c, d] = frac(p[2]!);
        const exp = a * d > c * b ? `[[${a}/${b}]]` : a * d < c * b ? `[[${c}/${d}]]` : '同じ';
        expect(it.options.find((o) => o.correct)?.label, it.id).toBe(exp);
      }
    }
  });
});

describe('review g5c: g5.math.multiples-divisors', () => {
  const items = allItems(multiplesDivisors);
  const divisorsOf = (n: number) =>
    Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);

  it('約数の こ数: 正答を 計算し直す。平方数の ヒントは 同じ数の 組を 1こと 数えると 言う', () => {
    const alts = items.filter((it) => it.id.startsWith('divisor-alt:'));
    expect(alts.length).toBeGreaterThan(20);
    let squares = 0;
    for (const it of alts) {
      const n = Number(it.id.split(':')[1]);
      expect(numAns(it), it.id).toBe(divisorsOf(n).length);
      const r = Math.round(Math.sqrt(n));
      if (r * r === n) {
        squares++;
        expect(plain(it.hints[2]!), it.id).toContain(`${r} × ${r}の ${r}は 1こと 数える`);
      } else expect(plain(it.hints[2]!), it.id).not.toContain('1こと 数える');
    }
    expect(squares).toBeGreaterThan(0);
  });

  it('最小公倍数・最大公約数の 正答を 計算し直す', () => {
    for (const it of items) {
      const p = it.id.split(':');
      const pair = (s: string) => s.split(',').map(Number) as [number, number];
      if (p[0] === 'lcm') expect(numAns(it), it.id).toBe(lcm(...pair(p[1]!)));
      if (p[0] === 'lcm-alt') expect(numAns(it), it.id).toBe(lcm(...pair(p[2]!)));
      if (p[0] === 'lcm2') expect(numAns(it), it.id).toBe(2 * lcm(...pair(p[1]!)));
      if (p[0] === 'gcd') expect(numAns(it), it.id).toBe(gcd(...pair(p[1]!)));
      if (p[0] === 'gcd-alt') expect(numAns(it), it.id).toBe(gcd(...pair(p[2]!)));
    }
  });
});

describe('review g5c: g5.math.per-unit', () => {
  const items = allItems(perUnit);

  it('3つの 町の 人口密度: 正解は 最大、total-compare は 人口 最大、dir-swap は 人口密度 最小の 町', () => {
    const alts = items.filter((it) => it.id.startsWith('density-alt:'));
    expect(alts.length).toBeGreaterThan(20);
    for (const it of alts) {
      if (it.engine !== 'choice') throw new Error(it.id);
      const [, areaS, denS] = it.id.split(':');
      const areas = areaS!.split('-').map(Number);
      const dens = denS!.split('-').map(Number);
      const pops = areas.map((a, i) => a * dens[i]!);
      it.options.forEach((o, i) => {
        if (i === dens.indexOf(Math.max(...dens))) expect(o.correct, it.id).toBe(true);
        else if (i === pops.indexOf(Math.max(...pops)))
          expect(o.misconception, it.id).toBe('total-compare');
        else {
          expect(o.misconception, it.id).toBe('dir-swap');
          expect(dens[i], it.id).toBe(Math.min(...dens));
        }
      });
    }
  });

  it('1あたり量から 全体・いくつ分: 正答を 計算し直す（ねだんが 小数の 円に ならない）', () => {
    const st = items.filter((it) => it.id.startsWith('story'));
    expect(st.length).toBeGreaterThan(50);
    for (const it of st) {
      if (it.engine !== 'number') throw new Error(it.id);
      const p = it.id.split(':');
      const rv = Math.round(Number(p[2]) * 10);
      const given = intAt(p, 3);
      const ans = numAns(it);
      if (it.id.startsWith('story-alt')) expect(ans * rv, it.id).toBe(given * 10);
      else expect(ans * 10, it.id).toBe(rv * given);
      expect(plain(it.prompt), it.id).not.toMatch(/\d\.\d+円/);
    }
  });

  it('1あたり量: 正答 × いくつ分 ＝ 全体', () => {
    for (const it of items.filter((x) => x.id.startsWith('per1'))) {
      const p = it.id.split(':');
      expect(Math.round(numAns(it) * 10) * intAt(p, 2), it.id).toBe(intAt(p, 3) * 10);
    }
  });
});

describe('review g5c: g5.math.percent', () => {
  const items = allItems(percent);

  it('もとに する 量: 100%（答えが そのまま）を 使わず、正答 × 割合 ＝ 比べる量', () => {
    const bs = items.filter((it) => it.id.startsWith('base'));
    expect(bs.length).toBeGreaterThan(50);
    for (const it of bs) {
      const p = it.id.split(':');
      const C = intAt(p, 2);
      const pct = intAt(p, 3);
      expect(pct, it.id).not.toBe(100);
      expect(numAns(it) * pct, it.id).toBe(C * 100);
    }
  });

  it('場面に 合う 大きさ（バスの 定員は 80人まで、問題数は 100問まで）と 比べる量・割合の 正答', () => {
    for (const it of items) {
      const p = it.id.split(':');
      const head = p[0]!.replace('-alt', '');
      if (head === 'ratio') {
        const B = intAt(p, 2);
        const C = intAt(p, 3);
        if (p[1] === 'bus') expect(B, it.id).toBeLessThanOrEqual(80);
        const v = numAns(it);
        if (p[0] === 'ratio-alt') expect(v * B, it.id).toBe(C * 100);
        else expect(Math.round(v * 100) * B, it.id).toBe(C * 100);
      }
      if (head === 'compare') {
        const B = intAt(p, 2);
        const pct = intAt(p, 3);
        if (p[1] === 'bus') expect(B, it.id).toBeLessThanOrEqual(80);
        if (p[1] === 'test') expect(B, it.id).toBeLessThanOrEqual(100);
        expect(numAns(it) * 100, it.id).toBe(B * pct);
      }
    }
  });

  it('増量: mL の ものは おかしに しない、正答 ＝ もとの 量 ×（100 ＋ p）%', () => {
    const ups = items.filter((it) => it.id.startsWith('sale-alt:'));
    expect(ups.length).toBeGreaterThan(20);
    for (const it of ups) {
      const p = it.id.split(':');
      const X = parseInt(p[1]!, 10);
      const pct = intAt(p, 2);
      expect(numAns(it) * 100, it.id).toBe(X * (100 + pct));
      if (p[1]!.endsWith('mL')) expect(plain(it.prompt), it.id).not.toContain('おかし');
    }
  });
});
