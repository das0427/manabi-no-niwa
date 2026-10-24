/**
 * 教材レビュー（g5b: decimal-div・decimal-mult・decimal-shift・fraction-add-diff・fraction-decimal）で直した点の再発防止。
 * 正答を 問題の 数から 分数で 計算し直して 一致を 確かめる（全段階 × seed 0..299 × index 0..3）。
 */
import { describe, expect, it } from 'vitest';
import type { NumberAnswer } from '../../core/answer/number';
import { createRng } from '../../core/util/rng';
import type { Item, UnitSpec } from '../../curriculum/types';
import { decimalDiv } from './decimal-div';
import { decimalMult } from './decimal-mult';
import { decimalShift } from './decimal-shift';
import { fractionAddDiff } from './fraction-add-diff';
import { fractionDecimal } from './fraction-decimal';

type R = [number, number];
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const red = ([n, d]: R): R => {
  const k = gcd(n, d) || 1;
  return [n / k, d / k];
};
const mul = (a: R, b: R): R => red([a[0] * b[0], a[1] * b[1]]);
const div = (a: R, b: R): R => red([a[0] * b[1], a[1] * b[0]]);
const add = (a: R, b: R): R => red([a[0] * b[1] + b[0] * a[1], a[1] * b[1]]);
const sub = (a: R, b: R): R => red([a[0] * b[1] - b[0] * a[1], a[1] * b[1]]);
const same = (a: R, b: R) => a[0] * b[1] === b[0] * a[1];
/** '12.34' → 1234/100 */
function pd(s: string): R {
  const i = s.indexOf('.');
  if (i < 0) return [Number(s), 1];
  return red([Number(s.replace('.', '')), 10 ** (s.length - i - 1)]);
}
const ansR = (a: NumberAnswer): R =>
  a.kind === 'fraction'
    ? red([a.num, a.den])
    : a.kind === 'int' || a.kind === 'decimal'
      ? pd(String(a.value))
      : [NaN, 1];
const strip = (s: unknown) => String(s ?? '').replace(/《[^》]*》/g, '');

function all(unit: UnitSpec): Item[] {
  const src = unit.source;
  if (src.kind !== 'generator') throw new Error('generator only');
  const out: Item[] = [];
  for (let level = 0; level < unit.levels.length; level++)
    for (let seed = 0; seed < 300; seed++)
      for (let index = 0; index < 4; index++)
        out.push(src.generate({ level, rng: createRng(seed), index }));
  return out;
}
const numAns = (it: Item): R[] =>
  it.engine === 'number' ? it.fields.map((f) => ansR(f.answer)) : [];

describe('g5b review: g5.math.decimal-div', () => {
  const items = all(decimalDiv);
  it('正答が わられる数 ÷ わる数（あまり・がい数を含む）と一致する', () => {
    for (const it of items) {
      const m = strip(it.id).match(/:([\d.]+)÷([\d.]+)$/);
      if (!m || it.engine !== 'number') continue;
      const a = pd(m[1]!);
      const b = pd(m[2]!);
      const q = div(a, b);
      const A = numAns(it);
      const tm = it.id.split(':')[0];
      if (tm === 'rem') {
        const qi = Math.floor(q[0] / q[1]);
        expect(same(A[0]!, [qi, 1]), it.id).toBe(true);
        expect(same(A[1]!, sub(a, mul(b, [qi, 1]))), it.id).toBe(true);
      } else if (tm === 'rem-alt') {
        const x = Math.floor((q[0] * 100) / q[1]);
        expect(same(A[0]!, [Math.floor((x + 5) / 10), 10]), it.id).toBe(true);
      } else expect(same(A[0]!, q), it.id).toBe(true);
    }
  });
  it('いくつ分の 文章題の 表: 上の行は 量（1つ分と 全体）、下の行は いくつ分（1 と ？）', () => {
    let n = 0;
    for (const it of items) {
      if (!it.id.startsWith('story-alt:') || it.figure?.kind !== 'table') continue;
      const sc = it.id.split(':')[1];
      if (sc !== 'juice' && sc !== 'ribbon' && sc !== 'times') continue;
      n++;
      expect(strip(it.figure.header[0]), it.id).toMatch(/^量（(L|m)）$/);
      expect(strip(it.figure.rows[0]?.[0]), it.id).not.toBe('1つ分');
    }
    expect(n).toBeGreaterThan(0);
  });
  it('「何倍に あたる」から もとの 量を 求める 文章題の ヒントは くらべる 量 ÷ 何倍', () => {
    let n = 0;
    for (const it of items) {
      if (!/^story(-alt)?:base:/.test(it.id)) continue;
      n++;
      expect(strip(it.hints[0]), it.id).toContain('くらべる 量 ÷ 何倍');
    }
    expect(n).toBeGreaterThan(0);
  });
  it('あまりの 誤答（rem-point）は 小数点を うつした あとの あまりだけ', () => {
    for (const it of items) {
      if (!it.id.startsWith('rem:') || it.engine !== 'number') continue;
      const A = numAns(it);
      for (const w of it.wrongAnswers ?? []) {
        if (w.misconception !== 'rem-point') continue;
        const r = pd(w.value.split('|')[1]!);
        expect(same(r, mul(A[1]!, [10, 1])), `${it.id} ${w.value}`).toBe(true);
      }
    }
  });
});

describe('g5b review: g5.math.decimal-mult', () => {
  const items = all(decimalMult);
  it('正答が かけられる数 × かける数 と一致し、代金（円）は 整数', () => {
    for (const it of items) {
      const m = strip(it.id).match(/:([\d.]+)x([\d.]+)$/);
      if (!m || it.engine !== 'number') continue;
      const p = mul(pd(m[1]!), pd(m[2]!));
      expect(same(numAns(it)[0]!, p), it.id).toBe(true);
      if (strip(it.fields[0]?.label) === '円') expect(p[1], it.id).toBe(1);
    }
  });
});

describe('g5b review: g5.math.decimal-shift', () => {
  it('10倍・[[1/10]] などの 正答が 計算し直した 値と一致する', () => {
    for (const it of all(decimalShift)) {
      if (it.engine !== 'number') continue;
      const parts = strip(it.id).split(':');
      const e = Number(parts[parts.length - 1]);
      const tm = parts[0]!;
      const A = numAns(it)[0]!;
      if (tm.startsWith('up'))
        expect(same(A, mul(pd(parts[parts.length - 2]!), [10 ** e, 1])), it.id).toBe(true);
      else if (tm.startsWith('down'))
        expect(same(A, div(pd(parts[parts.length - 2]!), [10 ** e, 1])), it.id).toBe(true);
      else expect(same(A, [10 ** e, 1]), it.id).toBe(true);
    }
  });
});

describe('g5b review: g5.math.fraction-add-diff', () => {
  const items = all(fractionAddDiff);
  const frac = (t: string): R => {
    const m = t.match(/^\[\[(?:(\d+) )?(\d+)\/(\d+)\]\]$/);
    if (!m) throw new Error(t);
    return add([Number(m[1] ?? 0), 1], [Number(m[2]), Number(m[3])]);
  };
  it('正答が 式（または 文章）から 計算し直した 値と一致する', () => {
    for (const it of items) {
      if (it.engine !== 'number') continue;
      const fx = it.figure?.kind === 'text' ? strip(it.figure.text) : '';
      let v: R;
      if (fx) {
        const toks = fx.replace(' ＝ {{}}', '').match(/\[\[[^\]]*\]\]|[＋−+]/g)!;
        v = frac(toks[0]!);
        for (let i = 1; i < toks.length; i += 2)
          v = toks[i] === '−' ? sub(v, frac(toks[i + 1]!)) : add(v, frac(toks[i + 1]!));
      } else {
        const m = strip(it.prompt).match(/\[\[(\d+)\/(\d+)\]\].*?\[\[(\d+)\/(\d+)\]\]/)!;
        const x: R = [Number(m[1]), Number(m[2])];
        const y: R = [Number(m[3]), Number(m[4])];
        v = it.id.includes('+') ? add(x, y) : sub(x, y);
      }
      expect(v[0], it.id).toBeGreaterThan(0);
      expect(same(numAns(it)[0]!, v), it.id).toBe(true);
    }
  });
  it('num-only（分子を 直さなかった）の 誤答は 分母が 2つの 分母の 最小公倍数', () => {
    for (const it of items) {
      if (it.engine !== 'number' || !/^(addP|subP|story)/.test(it.id)) continue;
      const m = strip(it.id).match(/(\d+)\/(\d+)[+−](\d+)\/(\d+)$/)!;
      const b = Number(m[2]);
      const d = Number(m[4]);
      const L = (b / gcd(b, d)) * d;
      for (const w of it.wrongAnswers ?? [])
        if (w.misconception === 'num-only')
          expect(Number(w.value.split('/')[1]), `${it.id} ${w.value}`).toBe(L);
    }
  });
});

describe('g5b review: g5.math.fraction-decimal', () => {
  const items = all(fractionDecimal);
  it('数直線を 読む 問題の ヒントが 目もりの 数（答え）を 言わない', () => {
    let n = 0;
    for (const it of items) {
      if (!it.id.startsWith('toFraction-line:')) continue;
      n++;
      const k = it.id.split(':')[1]!.split('/')[0]!;
      for (const h of it.hints) expect(strip(h), it.id).not.toContain(`0から ${k}目もり`);
    }
    expect(n).toBeGreaterThan(0);
  });
  it('分数と 小数の 正答が 計算し直した 値と一致する', () => {
    for (const it of items) {
      if (it.engine === 'number') {
        const fx = it.figure?.kind === 'text' ? strip(it.figure.text) : '';
        let m: RegExpMatchArray | null;
        let exp: R | null = null;
        if ((m = fx.match(/^(\d+) ÷ (\d+)/)) || (m = fx.match(/^\[\[(\d+)\/(\d+)\]\]/)))
          exp = [Number(m[1]), Number(m[2])];
        else if ((m = fx.match(/^([\d.]+) ＝/))) exp = pd(m[1]!);
        else if ((m = it.id.match(/:(\d+)÷(\d+)$/))) exp = [Number(m[1]), Number(m[2])];
        expect(exp, it.id).not.toBeNull();
        expect(same(numAns(it)[0]!, red(exp!)), it.id).toBe(true);
      } else if (it.engine === 'choice' && it.id.startsWith('compare')) {
        const vs = it.options.map((o): R | null => {
          const l = strip(o.label);
          if (l === '同じ') return null;
          const f = l.match(/^\[\[(\d+)\/(\d+)\]\]$/);
          return f ? [Number(f[1]), Number(f[2])] : pd(l);
        });
        const nums = vs.filter((v): v is R => v !== null);
        const mx = nums.reduce((a, b) => (a[0] * b[1] >= b[0] * a[1] ? a : b));
        const allEq = nums.length === 2 && same(nums[0]!, nums[1]!);
        it.options.forEach((o, i) => {
          const v = vs[i];
          const ok = allEq ? v === null : v !== null && v !== undefined && same(v, mx);
          expect(!!o.correct, `${it.id} ${o.label}`).toBe(ok);
        });
      }
    }
  });
});
