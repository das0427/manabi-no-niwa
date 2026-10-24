/**
 * 教材レビュー（g5e: proportion-simple・speed・volume）で直した点の再発防止。
 * 正答を 問題の 数（id）から 計算し直して 一致を 確かめる（全段階 × seed 0..299 × index 0..3）。
 */
import { describe, expect, it } from 'vitest';
import type { NumberAnswer } from '../../core/answer/number';
import { createRng } from '../../core/util/rng';
import type { Figure } from '../../engines/figure/types';
import type { Item, UnitSpec } from '../../curriculum/types';
import { proportionSimple } from './proportion-simple';
import { speed } from './speed';
import { volume } from './volume';

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
const strip = (s: unknown) => String(s ?? '').replace(/《[^》]*》/g, '');
const val = (a: NumberAnswer): number => (a.kind === 'int' || a.kind === 'decimal' ? a.value : NaN);
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const firstAns = (it: Item): number => {
  if (it.engine !== 'number') throw new Error('number only');
  const f = it.fields[0];
  if (!f) throw new Error('no field');
  return val(f.answer);
};
const texts = (it: Item): string[] =>
  [it.prompt, ...(it.hints ?? []), it.explain ?? ''].map(String);
const ids = (unit: UnitSpec) => new Set(unit.misconceptions.map((m) => m.id));

/** 「数＋分《よみ》」の 読みが 数に 合うか（1・3・4・6・8・0 で 終わる ときは ぷん） */
function minuteReadingsOk(s: string): boolean {
  for (const m of s.matchAll(/(\d+)分《(ふん|ぷん)》/g)) {
    const want = '134680'.includes(m[1]!.slice(-1)) ? 'ぷん' : 'ふん';
    if (m[2] !== want) return false;
  }
  return true;
}

describe('g5e review: g5.math.proportion-simple', () => {
  const items = all(proportionSimple);
  const mis = ids(proportionSimple);
  it('正答が 問題の 数から 計算した 値と 一致する', () => {
    let n = 0;
    for (const it of items) {
      if (it.engine !== 'number') continue;
      const p = it.id.split(':').map(Number);
      const kind = it.id.split(':')[0];
      const ans = firstAns(it);
      if (kind === 'times') expect(ans, it.id).toBe(p[4]! / p[3]!);
      else if (kind === 'fill-alt') expect(ans, it.id).toBe(p[2]! * p[4]!);
      else if (kind === 'fill' || kind === 'formula-alt') expect(ans, it.id).toBe(p[2]! * p[3]!);
      else if (kind === 'formula') expect(ans, it.id).toBe(p[2]!);
      else if (kind === 'inverse' || kind === 'inverse-alt') expect(ans, it.id).toBe(p[3]!);
      else continue;
      n++;
    }
    expect(n).toBeGreaterThan(1000);
  });
  it('表なしの 空らん: 分かって いる ○を そのまま かけた 誤答は skip-per-one（k-swap では ない）', () => {
    expect(mis.has('skip-per-one')).toBe(true);
    let n = 0;
    for (const it of items) {
      if (it.engine !== 'number' || !it.id.startsWith('fill-alt:')) continue;
      const p = it.id.split(':').map(Number);
      const w = it.wrongAnswers?.find((x) => x.value === String(p[2]! * p[3]! * p[4]!));
      if (w) {
        expect(w.misconception, it.id).toBe('skip-per-one');
        n++;
      }
      for (const x of it.wrongAnswers ?? []) expect(mis.has(x.misconception), it.id).toBe(true);
    }
    expect(n).toBeGreaterThan(20);
  });
  it('「分」の 読みが 数に 合い、さっ数・まい数を「かず」と 読ませない', () => {
    for (const it of items) {
      for (const s of [...texts(it), JSON.stringify(it)]) {
        expect(minuteReadingsOk(s), `${it.id}: ${s}`).toBe(true);
        expect(s, it.id).not.toMatch(/(さっ|まい)数《かず》/);
      }
    }
  });
});

describe('g5e review: g5.math.speed', () => {
  const items = all(speed);
  it('正答が 速さ・道のり・時間の 関係から 計算した 値と 一致する', () => {
    let n = 0;
    for (const it of items) {
      const p = it.id.split(':');
      const kind = p[0]!.replace(/-alt$/, '');
      if (it.engine === 'number') {
        const ans = firstAns(it);
        const x = Number(p[2]);
        const y = Number(p[3]);
        if (kind === 'speed') expect(ans, it.id).toBe(x / y);
        else if (kind === 'dist') expect(ans, it.id).toBe(x * y);
        else if (kind === 'time') expect(ans, it.id).toBe(y / x);
        else if (kind === 'convert') {
          const v = Number(p[2]);
          const want =
            p[1] === 'h2m'
              ? (v * 1000) / 60
              : p[1] === 'm2s'
                ? v / 60
                : p[1] === 's2m'
                  ? v * 60
                  : (v * 60) / 1000;
          expect(ans, it.id).toBe(want);
        }
        expect(Number.isInteger(ans), it.id).toBe(true);
        n++;
      } else if (it.engine === 'choice' && kind === 'compare') {
        const correct = it.options.find((o) => o.correct);
        expect(correct, it.id).toBeDefined();
        if (p[0] === 'compare-alt') {
          const aFast = (Number(p[1]) * 1000) / 60 > Number(p[2]);
          expect(strip(correct!.label).startsWith(aFast ? 'A' : 'B'), it.id).toBe(true);
        } else {
          const [a, b] = p[2]!.split('|').map((s) => s.split('/').map(Number));
          const aFast = a![0]! / a![1]! > b![0]! / b![1]!;
          expect(strip(correct!.label).startsWith(aFast ? 'A' : 'B'), it.id).toBe(true);
        }
        n++;
      }
    }
    expect(n).toBeGreaterThan(1000);
  });
  it('数直線の 1 の 位置が 時間に 比例する（1/t、t が 大きい ときだけ 0.15）', () => {
    let n = 0;
    const check = (fig: Figure | undefined, t: number, id: string) => {
      if (!fig || fig.kind !== 'svg') return;
      // 下の 数直線の 文字（y=114）: 0・1・t
      const xs = [...fig.markup.matchAll(/<text x="([\d.]+)" y="114"[^>]*>([^<]*)<\/text>/g)].map(
        (m) => ({ x: Number(m[1]), s: m[2] }),
      );
      const one = xs.find((m) => m.s === '1');
      const end = xs.find((m) => m.s === String(t));
      expect(one && end, id).toBeTruthy();
      const at = (one!.x - 40) / (end!.x - 40);
      expect(Math.abs(at - Math.max(1 / t, 0.15)) < 1e-6, `${id} at=${at}`).toBe(true);
      n++;
    };
    for (const it of items) {
      if (it.engine !== 'number') continue;
      const p = it.id.split(':');
      const kind = p[0]!.replace(/-alt$/, '');
      const t =
        kind === 'time' ? Number(p[3]) / Number(p[2]) : kind === 'convert' ? NaN : Number(p[3]);
      if (Number.isNaN(t)) continue;
      check(it.explainFigure, t, it.id);
      if (kind !== 'time') check(it.figure, t, it.id);
    }
    expect(n).toBeGreaterThan(500);
  });
  it('「分」の 読みが 数に 合う（10分《ぷん》・5分《ふん》、何分は なんぷん）', () => {
    for (const it of items) {
      for (const s of texts(it)) {
        expect(minuteReadingsOk(s), `${it.id}: ${s}`).toBe(true);
        expect(s, it.id).not.toContain('何分《ふん》');
      }
    }
    for (const m of speed.misconceptions) expect(minuteReadingsOk(m.explain), m.id).toBe(true);
  });
});

describe('g5e review: g5.math.volume', () => {
  const items = all(volume);
  it('正答が 長さから 計算した 体積と 一致する', () => {
    let n = 0;
    const F: Record<string, number> = {
      'm³-cm³': 1000000,
      'L-cm³': 1000,
      'm³-L': 1000,
      'L-mL': 1000,
      'dL-cm³': 100,
    };
    for (const it of items) {
      if (it.engine !== 'number') continue;
      const id = it.id;
      const ans = firstAns(it);
      const kind = id.split(':')[0]!;
      const nums = (s: string) => s.split('x').map(Number);
      let want: number | undefined;
      if (kind.startsWith('cuboid')) want = nums(id.split(':')[2]!).reduce((a, b) => a * b, 1);
      else if (kind.startsWith('cube')) want = Number(id.split(':')[1]!.replace(/\D+$/, '')) ** 3;
      else if (kind === 'compound-alt') {
        const [big, small] = id.split(':')[1]!.split('-');
        want = nums(big!).reduce((a, b) => a * b, 1) - nums(small!).reduce((a, b) => a * b, 1);
      } else if (kind === 'compound') {
        const [, shape, d] = id.split(':');
        const [big, small] = shape!.split('-');
        const [W, H] = nums(big!);
        const [w, h] = nums(small!);
        want = (W! * H! - w! * h!) * Number(d);
      } else if (kind === 'capacity-alt') {
        const [a, b, c] = nums(id.split(':')[1]!);
        want = (a! - 2) * (b! - 2) * (c! - 1);
      } else if (kind === 'capacity') {
        const [a, b, c] = nums(id.split(':')[1]!);
        want = (a! * b! * c!) / 1000;
      } else if (kind === 'units-mix') {
        const [a, b, c] = nums(id.split(':')[1]!);
        want = (a! * b! * c!) / 100;
      } else if (kind === 'units') {
        const [, pair, nn, dir] = id.split(':');
        want = dir === 'd' ? Number(nn) * F[pair!]! : Number(nn);
      }
      expect(want, id).toBeDefined();
      expect(near(ans, want!), `${id}: ${ans} ≠ ${want}`).toBe(true);
      for (const w of it.wrongAnswers ?? []) expect(near(Number(w.value), ans), id).toBe(false);
      n++;
    }
    expect(n).toBeGreaterThan(2000);
  });
  it('1dL → cm³ の ヒントは わり算（かけ算と 言わない）', () => {
    let n = 0;
    for (const it of items) {
      if (it.id !== 'units-pick:dL-cm³') continue;
      const h = (it.hints ?? []).map(strip).join(' ');
      expect(h, it.id).not.toContain('かけ算');
      expect(h, it.id).toContain('1000 ÷ 10');
      n++;
    }
    expect(n).toBeGreaterThan(0);
  });
  it('容積（L）の 誤答に 同じ 値が 重ならず、小数の 誤差が ない', () => {
    for (const it of items) {
      if (it.engine !== 'number' || !it.id.startsWith('capacity:')) continue;
      const vs = (it.wrongAnswers ?? []).map((w) => w.value);
      expect(new Set(vs.map(Number)).size, it.id).toBe(vs.length);
      for (const v of vs) expect(v, it.id).toMatch(/^\d+(\.\d{1,3})?$/);
    }
  });
  it('見取図の 長さの 文字が 図の 左に はみ出さない', () => {
    let n = 0;
    for (const it of items) {
      const f = it.figure;
      if (!f || f.kind !== 'svg') continue;
      for (const m of f.markup.matchAll(
        /<text x="([-\d.]+)"[^>]*text-anchor="(\w+)"[^>]*>([^<]*)<\/text>/g,
      )) {
        const x = Number(m[1]);
        const w = m[3]!.length * 8; // 13px の 数字・英字の おおよその 幅
        const left = m[2] === 'end' ? x - w : m[2] === 'middle' ? x - w / 2 : x;
        expect(left >= 0, `${it.id}: ${m[3]} left=${left}`).toBe(true);
        n++;
      }
      if (it.id.startsWith('cube-alt')) expect(strip(f.label)).toBe('立方体の 見取図');
    }
    expect(n).toBeGreaterThan(100);
  });
});
