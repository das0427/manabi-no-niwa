/**
 * 教材レビュー（g6g: inverse・letters・prism-volume・proportion）で直した点の再発防止。
 * 全段階 × seed 0..299 × index 0..3 で生成して確かめる。
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/util/rng';
import type { Item, UnitSpec } from '../../curriculum/types';
import { inverse } from './inverse';
import { letters } from './letters';
import { prismVolume } from './prism-volume';
import { proportion } from './proportion';

function* allItems(unit: UnitSpec): Generator<Item> {
  const src = unit.source;
  if (src.kind !== 'generator') return;
  for (let level = 0; level < unit.levels.length; level++)
    for (let seed = 0; seed < 300; seed++)
      for (let index = 0; index < 4; index++)
        yield src.generate({ level, rng: createRng(seed), index });
}

const strip = (s: string | undefined) => String(s ?? '').replace(/《[^》]*》/g, '');
const ansOf = (a: { kind: string; value?: number; num?: number; den?: number }) =>
  a.kind === 'fraction' ? a.num! / a.den! : a.value!;

/** 表の図（x の行・y の行）を数の組に。？は null */
function tableOf(it: Item): { xs: number[]; ys: (number | null)[] } | null {
  const f = 'figure' in it ? it.figure : undefined;
  if (!f || f.kind !== 'table') return null;
  const xs = f.header.slice(1).map((s) => Number(strip(String(s))));
  const ys = (f.rows[0] ?? [])
    .slice(1)
    .map((s) => (strip(String(s)) === '？' ? null : Number(strip(String(s)))));
  return { xs, ys };
}

describe('g6g レビュー: 反比例（g6.math.inverse）', () => {
  it('比例・反比例を見分ける問題の誤概念が、正しい関係と選んだ関係に合う', () => {
    const errs: string[] = [];
    for (const it of allItems(inverse)) {
      if (it.engine !== 'choice' || it.objective !== 'judge') continue;
      const correct = strip(it.options.find((o) => o.correct)?.label);
      for (const o of it.options) {
        if (o.correct) continue;
        const chosen = strip(o.label);
        const m = o.misconception;
        const ok =
          correct === '比例'
            ? m === (chosen === '反比例' ? 'as-inverse' : 'missed-relation')
            : correct === '反比例'
              ? m === (chosen === '比例' ? 'as-proportion' : 'missed-relation')
              : chosen === '比例'
                ? m === 'not-relation'
                : m === 'sum-const' || m === 'not-relation';
        if (!ok) errs.push(`${it.id}: 正 ${correct} / 選 ${chosen} → ${m}`);
      }
    }
    expect([...new Set(errs)].slice(0, 10)).toEqual([]);
  });

  it('表の問題: x × y が一定で、？の値が正答', () => {
    const errs: string[] = [];
    for (const it of allItems(inverse)) {
      if (it.engine !== 'number') continue;
      const t = tableOf(it);
      const f = it.fields[0];
      if (!t || !f || it.objective === 'use') continue;
      const a = ansOf(f.answer);
      if (it.objective === 'formula') {
        if (!t.xs.every((x, i) => x * (t.ys[i] ?? NaN) === a)) errs.push(it.id);
        continue;
      }
      const ks = t.xs.map((x, i) => x * (t.ys[i] ?? a));
      if (!ks.every((k) => k === ks[0])) errs.push(it.id);
    }
    expect(errs.slice(0, 10)).toEqual([]);
  });
});

describe('g6g レビュー: 比例（g6.math.proportion）', () => {
  it('表の問題: x が小さい順に並び、y ÷ x が一定で、？の値が正答', () => {
    const errs: string[] = [];
    for (const it of allItems(proportion)) {
      if (it.engine !== 'number' || it.objective !== 'table') continue;
      const t = tableOf(it);
      const f = it.fields[0];
      if (!t || !f) continue;
      const a = ansOf(f.answer);
      for (let i = 1; i < t.xs.length; i++)
        if (t.xs[i]! <= t.xs[i - 1]!) errs.push(`${it.id}: 並び ${t.xs.join(',')}`);
      const ks = t.xs.map((x, i) => (t.ys[i] ?? a) / x);
      if (!ks.every((k) => k === ks[0])) errs.push(`${it.id}: 一定でない`);
      if (t.ys.filter((y) => y === null).length !== 1) errs.push(`${it.id}: ？の数`);
    }
    expect([...new Set(errs)].slice(0, 10)).toEqual([]);
  });
});

describe('g6g レビュー: 文字を使った式（g6.math.letters）', () => {
  it('x を求める問題: 正答は式を満たし、誤答の例は整数で式を満たさない', () => {
    const errs: string[] = [];
    for (const it of allItems(letters)) {
      if (it.engine !== 'number' || it.objective !== 'solve') continue;
      const eq = strip(it.id.split(':').slice(1).join(':'));
      const m = /^x (＋|−|×|÷) (\d+)(?: ＋ (\d+))? ＝ (\d+)$/.exec(eq);
      if (!m) {
        errs.push(`${it.id}: 式が読めない`);
        continue;
      }
      const [, op, a, c, b] = m;
      const lhs = (x: number) => {
        const v =
          op === '＋'
            ? x + Number(a)
            : op === '−'
              ? x - Number(a)
              : op === '×'
                ? x * Number(a)
                : x / Number(a);
        return v + (c ? Number(c) : 0);
      };
      const f = it.fields[0];
      if (!f || lhs(ansOf(f.answer)) !== Number(b)) errs.push(`${it.id}: 正答が式を満たさない`);
      for (const w of it.wrongAnswers ?? []) {
        if (!/^\d+$/.test(w.value)) errs.push(`${it.id}: 誤答が整数でない ${w.value}`);
        if (lhs(Number(w.value)) === Number(b)) errs.push(`${it.id}: 誤答が式を満たす`);
      }
    }
    expect([...new Set(errs)].slice(0, 10)).toEqual([]);
  });

  it('言葉の式から文字の式を選ぶ問題: ( )の有無がちがう誤りは paren、ひき算かどうかがちがう誤りは op-swap', () => {
    const errs: string[] = [];
    const paren = (s: string) => s.startsWith('(');
    const minus = (s: string) => s.includes('−');
    for (const it of allItems(letters)) {
      if (it.engine !== 'choice' || it.objective !== 'read' || !it.alt) continue;
      const c = strip(it.options.find((o) => o.correct)?.label);
      for (const o of it.options) {
        if (o.correct) continue;
        const l = strip(o.label);
        const want =
          paren(l) !== paren(c) ? 'paren' : minus(l) !== minus(c) ? 'op-swap' : 'term-swap';
        if (o.misconception !== want) errs.push(`${it.id}: ${l} → ${o.misconception}（${want}）`);
      }
    }
    expect([...new Set(errs)].slice(0, 10)).toEqual([]);
  });
});

describe('g6g レビュー: 角柱と円柱の体積（g6.math.prism-volume）', () => {
  it('正答が id の数から計算し直した体積と一致し、add-instead の誤答はたし算の値', () => {
    const errs: string[] = [];
    for (const it of allItems(prismVolume)) {
      if (it.engine !== 'number') continue;
      const p = it.id.split(':');
      const n = p.filter((s) => /^\d+$/.test(s)).map(Number);
      const [n0 = 0, n1 = 0, n2 = 0, n3 = 0] = n;
      let V = NaN;
      let S = NaN;
      let h = NaN;
      if (it.objective === 'base') [V, S, h] = [n0 * n1, n0, n1];
      if (it.objective === 'tri') [V, S, h] = [((n0 * n1) / 2) * n2, (n0 * n1) / 2, n2];
      if (it.objective === 'quad') {
        S = p[1] === 'trap' ? ((n0 + n1) * n2) / 2 : p[1] === 'para' ? n0 * n1 : (n0 * n1) / 2;
        h = p[1] === 'trap' ? n3 : n2;
        V = S * h;
      }
      if (it.objective === 'cyl') V = Math.round(n0 * n0 * 314 * n1) / 100;
      const f = it.fields[0];
      if (!f || Math.abs(ansOf(f.answer) - V) > 1e-9)
        errs.push(`${it.id}: 体積 ${f ? ansOf(f.answer) : '?'} ≠ ${V}`);
      if (it.objective === 'quad' || it.objective === 'base')
        for (const w of it.wrongAnswers ?? [])
          if (w.misconception === 'add-instead' && Number(w.value) !== S + h)
            errs.push(`${it.id}: add-instead ${w.value}`);
    }
    expect([...new Set(errs)].slice(0, 10)).toEqual([]);
  });
});
