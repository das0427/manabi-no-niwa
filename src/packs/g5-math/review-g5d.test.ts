/**
 * 教材レビュー（g5d: pie-band・polygon-circle・prism-cylinder）で直した点の再発防止。
 * 正答を 問題の 数（id・問題文・図の データ）から 計算し直して 一致を 確かめる（全段階 × seed 0..299 × index 0..3）。
 */
import { describe, expect, it } from 'vitest';
import type { NumberAnswer } from '../../core/answer/number';
import { createRng } from '../../core/util/rng';
import type { ChoiceItem, Item, UnitSpec } from '../../curriculum/types';
import { pieBand } from './pie-band';
import { polygonCircle } from './polygon-circle';
import { prismCylinder } from './prism-cylinder';

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

/** 答えを 0.01 の いくつ分で */
const hund = (a: NumberAnswer | undefined): number =>
  a && (a.kind === 'int' || a.kind === 'decimal') ? Math.round(a.value * 100) : NaN;
/** '12.34' → 1234 */
const hundS = (s: string) => Math.round(Number(s) * 100);

/** 数を 答える 問題の 最初の 欄の 答えと 誤答の例 */
function numPart(it: Item): { ans: number; wrongs: string[] } | null {
  if (it.engine === 'number')
    return { ans: hund(it.fields[0]?.answer), wrongs: (it.wrongAnswers ?? []).map((w) => w.value) };
  if (it.engine === 'graph' && it.task.kind === 'number')
    return {
      ans: hund(it.task.fields[0]?.answer),
      wrongs: (it.task.wrongAnswers ?? []).map((w) => w.value),
    };
  return null;
}

function commonChecks(unit: UnitSpec, items: Item[]) {
  const ids = new Set((unit.misconceptions ?? []).map((m) => m.id));
  for (const it of items) {
    const p = numPart(it);
    if (p)
      for (const w of p.wrongs)
        expect(hundS(w), `${it.id} 誤答 ${w} が 正答と 同じ`).not.toBe(p.ans);
    if (it.engine === 'choice')
      for (const o of it.options)
        if (o.misconception)
          expect(ids.has(o.misconception), `${it.id} ${o.misconception}`).toBe(true);
    if (it.engine === 'number')
      for (const w of it.wrongAnswers ?? [])
        expect(ids.has(w.misconception), `${it.id} ${w.misconception}`).toBe(true);
    const raw = [it.prompt, ...it.hints, it.explain].join(' ');
    expect(raw, `${it.id} 「10つ」など`).not.toMatch(/(^|[^\d])1\dつ/);
    expect(raw, `${it.id} ひし形・何角形 の よみ`).not.toMatch(
      /し形《かたち》|角《かく》形《かたち》/,
    );
  }
}

describe('review g5d: g5.math.pie-band', () => {
  const items = all(pieBand);
  it('共通（誤答 ≠ 正答・誤概念ID・表現）', () => commonChecks(pieBand, items));

  it('グラフの 割合は 合計 100、正答は グラフ・問題文の 数から 計算し直した 値', () => {
    for (const it of items) {
      const q = strip(it.prompt);
      if (it.engine === 'graph') {
        const d = it.data;
        expect(
          d.values.reduce((s, v) => s + v, 0),
          it.id,
        ).toBe(100);
        const labels = d.labels.map(strip);
        const p = numPart(it)!;
        if (it.objective === 'read') {
          const m = /「(.+?)」は 全体の/.exec(q)!;
          const v = d.values[labels.indexOf(m[1]!)]!;
          expect(p.ans, it.id).toBe(v * 100);
        } else if (it.objective === 'times') {
          const m = /「(.+?)」の 割合は、「(.+?)」の/.exec(q)!;
          const a = d.values[labels.indexOf(m[1]!)]!;
          const b = d.values[labels.indexOf(m[2]!)]!;
          expect(p.ans, it.id).toBe((a / b) * 100);
        } else if (it.objective === 'amount') {
          const m = /全体が (\d+)(?:人|さつ|kg)の ときの 割合です。「(.+?)」は/.exec(q)!;
          const v = d.values[labels.indexOf(m[2]!)]!;
          expect(p.ans, it.id).toBe(Number(m[1]) * v);
        }
      } else if (it.objective === 'missing' && it.engine === 'number') {
        const others = it.alt
          ? [...q.replace(/。.*$/, '').matchAll(/(\d+)%/g)].map((m) => Number(m[1]))
          : it.figure && it.figure.kind === 'table'
            ? it.figure.rows
                .slice(0, -1)
                .map((r) => strip(r[1]))
                .filter((x) => x !== '？')
                .map(Number)
            : [];
        expect(others.length, it.id).toBeGreaterThanOrEqual(2);
        expect(numPart(it)!.ans, it.id).toBe((100 - others.reduce((s, v) => s + v, 0)) * 100);
        if (it.alt) expect(q, it.id).not.toContain('（れいの データ）を');
      } else if (it.objective === 'two' && it.engine === 'choice') {
        const m = /:(\d+)\/(\d+)\|(\d+)\/(\d+)$/.exec(it.id)!;
        const c1 = (Number(m[1]) * Number(m[2])) / 100;
        const c2 = (Number(m[3]) * Number(m[4])) / 100;
        const correct = it.options.filter((o) => o.correct).map((o) => strip(o.label));
        expect(correct, it.id).toEqual([c1 > c2 ? '2020年' : '2025年']);
      }
    }
  });
});

describe('review g5d: g5.math.polygon-circle', () => {
  const items = all(polygonCircle);
  it('共通（誤答 ≠ 正答・誤概念ID・表現）', () => commonChecks(polygonCircle, items));

  it('円周・直径・中心の 角の 正答を 問題の 数から 計算し直す', () => {
    for (const it of items) {
      const p = numPart(it);
      const q = strip(it.prompt);
      let m: RegExpExecArray | null;
      if ((m = /^circum(?:-fig|-story)?:(r|d)(\d+)$/.exec(it.id))) {
        const d = m[1] === 'r' ? 2 * Number(m[2]) : Number(m[2]);
        expect(p!.ans, it.id).toBe(d * 314);
      } else if ((m = /^diam(-alt)?:(\d+)$/.exec(it.id))) {
        const C = /円周の 長さが ([\d.]+)cmの/.exec(q)!;
        const d = (hundS(C[1]!) / 314) | 0;
        expect(d * 314, it.id).toBe(hundS(C[1]!));
        expect(p!.ans, it.id).toBe(m[1] ? d * 50 : d * 100);
        // 半径を 問う ときの ヒントの □ は 図の 式（□ × 2 × 3.14）と 同じ 半径
        if (m[1]) expect(strip(it.hints[1]), it.id).toContain('□ × 2 × 3.14');
      } else if ((m = /^regular:(\d+)$/.exec(it.id))) {
        expect(p!.ans, it.id).toBe((360 / Number(m[1])) * 100);
      } else if (/^regular:count:(\d+)$/.test(it.id)) {
        const a = /角を (\d+)°ずつ/.exec(q)!;
        expect(p!.ans, it.id).toBe((360 / Number(a[1])) * 100);
      }
    }
  });

  it('正方形と くらべる 問いの 誤りは pi-four（4倍より 短い）', () => {
    const sq = items.filter(
      (it): it is ChoiceItem => it.id === 'pi-alt:square' && it.engine === 'choice',
    );
    expect(sq.length).toBeGreaterThan(0);
    for (const it of sq)
      for (const o of it.options) if (!o.correct) expect(o.misconception).toBe('pi-four');
  });
});

describe('review g5d: g5.math.prism-cylinder', () => {
  const items = all(prismCylinder);
  it('共通（誤答 ≠ 正答・誤概念ID・表現）', () => commonChecks(prismCylinder, items));

  it('面・辺・頂点の 数、展開図の 横の 長さを 計算し直す', () => {
    for (const it of items) {
      const p = numPart(it);
      let m: RegExpExecArray | null;
      if ((m = /^count(?:-alt)?:(\d+):(side|face|edge|vertex)/.exec(it.id))) {
        const n = Number(m[1]);
        const w = m[2];
        const ans = w === 'side' ? n : w === 'face' ? n + 2 : w === 'edge' ? 3 * n : 2 * n;
        expect(p!.ans, it.id).toBe(ans * 100);
        // 最後の ヒントが 答えの 数を 言わない（側面）
        if (w === 'side') expect(strip(it.hints[2]), it.id).not.toMatch(/\d/);
      } else if ((m = /^net:(\d+):(\d+)$/.exec(it.id))) {
        expect(p!.ans, it.id).toBe(Number(m[1]) * 314);
      }
    }
  });

  it('四角柱の 底面の 問いで「長方形」を 誤りに しない・色の 面の 問いに 四角柱を 出さない', () => {
    for (const it of items) {
      if (it.engine !== 'choice') continue;
      if (it.id === 'parts:base:4')
        for (const o of it.options)
          if (!o.correct) expect(strip(o.label), it.id).not.toBe('長方形');
      expect(it.id).not.toMatch(/^parts-alt:4:/);
    }
  });

  it('名前の 正解は 底面の 形から', () => {
    const KAKU = ['', '', '', '三角', '四角', '五角', '六角', '七角', '八角'];
    for (const it of items) {
      const m = /^name(?:-alt)?:(\d+)/.exec(it.id);
      if (!m || it.engine !== 'choice') continue;
      const n = Number(m[1]);
      const correct = it.options.filter((o) => o.correct).map((o) => strip(o.label));
      expect(correct, it.id).toEqual([n === 0 ? '円柱' : `${KAKU[n]}柱`]);
    }
  });
});
