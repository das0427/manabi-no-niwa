/**
 * 教材レビュー g5a（angle-sum・area-formulas・average・congruence）で直した点の再発防止。
 * 全段階 × seed 0..299 × index 0..3 で生成し、問題文・id の数値から 正答を 独立に 計算し直して 確かめる。
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/util/rng';
import type { Item, UnitSpec } from '../../curriculum/types';
import { angleSum } from './angle-sum';
import { areaFormulas } from './area-formulas';
import { average } from './average';
import { congruence } from './congruence';

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

const numAns = (it: Item): number => {
  if (it.engine !== 'number') throw new Error(`number ではない: ${it.id}`);
  const a = it.fields[0]!.answer;
  if (a.kind !== 'int' && a.kind !== 'decimal') throw new Error(`整数・小数ではない: ${it.id}`);
  return a.value;
};

const wrongs = (it: Item) => (it.engine === 'number' ? (it.wrongAnswers ?? []) : []);

const markupOf = (it: Item): string =>
  it.figure && it.figure.kind === 'svg' ? it.figure.markup : '';

/** 最初の polygon の 頂点（画面の 座標） */
function polygonPts(markup: string): [number, number][] {
  const m = /<polygon points="([^"]+)"/.exec(markup);
  if (!m) return [];
  return m[1]!.split(' ').map((p) => p.split(',').map(Number) as [number, number]);
}

/** 凸多角形の 内角（度） */
function interiorAngles(ps: [number, number][]): number[] {
  const n = ps.length;
  return ps.map((p, i) => {
    const a = ps[(i + n - 1) % n]!;
    const b = ps[(i + 1) % n]!;
    const v1 = [a[0] - p[0], a[1] - p[1]];
    const v2 = [b[0] - p[0], b[1] - p[1]];
    const cos =
      (v1[0]! * v2[0]! + v1[1]! * v2[1]!) /
      (Math.hypot(v1[0]!, v1[1]!) * Math.hypot(v2[0]!, v2[1]!));
    return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  });
}

describe('review g5a: g5.math.angle-sum', () => {
  const items = allItems(angleSum);

  it('三角形・四角形: 正答 ＝ 角の和 − 分かっている角。図の角は 数値どおり', () => {
    const errs: string[] = [];
    for (const it of items) {
      const m = /^(tri|quad)(-alt)?:([\d-]+)$/.exec(it.id);
      if (!m) continue;
      const known = m[3]!.split('-').map(Number);
      const total = m[1] === 'tri' ? 180 : 360;
      const ans = total - known.reduce((s, x) => s + x, 0);
      if (numAns(it) !== ans) errs.push(`${it.id}: 正答 ${numAns(it)} ≠ ${ans}`);
      const angles = [...known, ans];
      for (const fig of [it.figure, it.explainFigure]) {
        if (!fig || fig.kind !== 'svg') continue;
        const got = interiorAngles(polygonPts(fig.markup));
        if (got.length !== angles.length || got.some((g, i) => Math.abs(g - angles[i]!) > 1.5))
          errs.push(
            `${it.id}: 図の角 ${got.map((g) => g.toFixed(0)).join(',')} ≠ ${angles.join(',')}`,
          );
      }
    }
    expect(errs.slice(0, 10)).toEqual([]);
  });

  it('外の角: 正答 ＝ a ＋ b、図の 三角形の 角は a・のこりの角・b', () => {
    const errs: string[] = [];
    for (const it of items) {
      const m = /^ext:(\d+)-(\d+)$/.exec(it.id);
      if (!m) continue;
      const [a, b] = [Number(m[1]), Number(m[2])];
      if (numAns(it) !== a + b) errs.push(`${it.id}: 正答`);
      const got = interiorAngles(polygonPts(markupOf(it)));
      const want = [a, 180 - a - b, b];
      if (got.length !== 3 || got.some((g, i) => Math.abs(g - want[i]!) > 1.5))
        errs.push(`${it.id}: 図の角`);
    }
    expect(errs.slice(0, 10)).toEqual([]);
  });

  it('二等辺三角形（底角から）: 180 − y は one-angle、(180 − y) ÷ 2 は isos-pair', () => {
    const errs: string[] = [];
    let n = 0;
    for (const it of items) {
      const m = /^special:base:(\d+)$/.exec(it.id);
      if (!m) continue;
      n++;
      const y = Number(m[1]);
      if (numAns(it) !== 180 - 2 * y) errs.push(`${it.id}: 正答`);
      for (const w of wrongs(it)) {
        const v = Number(w.value);
        if (v === 180 - y && w.misconception !== 'one-angle')
          errs.push(`${it.id}: ${v} は one-angle`);
        if (v === (180 - y) / 2 && w.misconception !== 'isos-pair')
          errs.push(`${it.id}: ${v} は isos-pair`);
        if (w.misconception === 'isos-half')
          errs.push(`${it.id}: isos-half（2で わる）は 底角の 問題に 合わない`);
      }
    }
    expect(n).toBeGreaterThan(0);
    expect(errs.slice(0, 10)).toEqual([]);
  });

  it('正多角形の1つの角: 角の和（わり忘れ）は sum-no-divide', () => {
    const errs: string[] = [];
    let n = 0;
    for (const it of items) {
      const m = /^poly:regular:(\d+)$/.exec(it.id);
      if (!m) continue;
      n++;
      const k = Number(m[1]);
      if (numAns(it) !== ((k - 2) * 180) / k) errs.push(`${it.id}: 正答`);
      for (const w of wrongs(it))
        if (Number(w.value) === (k - 2) * 180 && w.misconception !== 'sum-no-divide')
          errs.push(`${it.id}: ${w.value} は sum-no-divide`);
    }
    expect(n).toBeGreaterThan(0);
    expect(errs.slice(0, 10)).toEqual([]);
    expect(angleSum.misconceptions.some((m) => m.id === 'sum-no-divide')).toBe(true);
  });
});

describe('review g5a: g5.math.area-formulas', () => {
  const items = allItems(areaFormulas);

  it('正答は 公式どおり（id の 数値から 計算し直す）', () => {
    const errs: string[] = [];
    for (const it of items) {
      if (it.engine !== 'number') continue;
      let m: RegExpExecArray | null;
      let S: number | null = null;
      if ((m = /^para(?:-out)?:(\d+):(\d+):(\d+)$/.exec(it.id))) S = Number(m[1]) * Number(m[3]);
      else if ((m = /^tri(?:-out)?:(\d+):(\d+):(\d+)$/.exec(it.id)))
        S = (Number(m[1]) * Number(m[3])) / 2;
      else if (
        (m = /^trap:(\d+):(\d+):\d+:(\d+)$/.exec(it.id)) ||
        (m = /^trap-word:(\d+):(\d+):(\d+)$/.exec(it.id))
      )
        S = ((Number(m[1]) + Number(m[2])) * Number(m[3])) / 2;
      else if ((m = /^rhombus(?:-word)?:(\d+):(\d+)$/.exec(it.id)))
        S = (Number(m[1]) * Number(m[2])) / 2;
      if (S !== null && numAns(it) !== S) errs.push(`${it.id}: 正答 ${numAns(it)} ≠ ${S}`);
      if ((m = /^inverse(?:-alt)?:(tri|para):([hb]):(\d+):(\d+)$/.exec(it.id))) {
        const area = Number(m[3]);
        const known = Number(m[4]);
        const prod = m[1] === 'tri' ? area * 2 : area;
        if (numAns(it) * known !== prod)
          errs.push(`${it.id}: 正答 ${numAns(it)} × ${known} ≠ ${prod}`);
      }
    }
    expect(errs.slice(0, 10)).toEqual([]);
  });

  it('図: 底辺・高さの 長さが 図の 比と 合い、ななめの 辺は ピタゴラス数', () => {
    const errs: string[] = [];
    for (const it of items) {
      const m = /^(para|tri)(?:-out|-shiki)?:(\d+):(\d+):(\d+)$/.exec(it.id);
      if (!m) continue;
      const [b, x, h] = [Number(m[2]), Number(m[3]), Number(m[4])];
      const ps = polygonPts(markupOf(it));
      const k = (ps[1]![0] - ps[0]![0]) / b;
      const H = (ps[0]![1] - ps[2]![1]) / k;
      if (Math.abs(H - h) > 1e-6) errs.push(`${it.id}: 図の高さ ${H}`);
      const cms = [...markupOf(it).matchAll(/>(\d+)cm</g)].map((t) => Number(t[1]));
      if (!cms.includes(b) || !cms.includes(h)) errs.push(`${it.id}: 図の 長さの 文字`);
      const slant = [...cms];
      for (const v of [b, h]) {
        const i = slant.indexOf(v);
        if (i >= 0) slant.splice(i, 1);
      }
      const dx = m[1] === 'tri' && x > b ? x - b : x;
      if (slant.length !== 1 || slant[0]! ** 2 !== dx ** 2 + h ** 2)
        errs.push(`${it.id}: ななめの 辺 ${slant.join(',')}`);
    }
    expect(errs.slice(0, 10)).toEqual([]);
  });

  it('台形: add-sides（長さを たした）の 誤答は 上底 ＋ 下底 ＋ 高さ（かけ算の 値では ない）', () => {
    const errs: string[] = [];
    for (const it of items) {
      const m = /^trap(?:-word)?:(\d+):(\d+):(?:\d+:)?(\d+)$/.exec(it.id);
      if (!m) continue;
      const [a, b, h] = [Number(m[1]), Number(m[2]), Number(m[3])];
      for (const w of wrongs(it))
        if (w.misconception === 'add-sides' && Number(w.value) !== a + b + h)
          errs.push(`${it.id}: add-sides ${w.value}`);
    }
    expect(errs.slice(0, 10)).toEqual([]);
  });
});

describe('review g5a: g5.math.average', () => {
  const items = allItems(average);

  it('平均・合計・のこりの1つ: 正答を 計算し直す', () => {
    const errs: string[] = [];
    for (const it of items) {
      let m: RegExpExecArray | null;
      const ans =
        it.engine === 'graph' && it.task.kind === 'number' ? it.task.fields[0]!.answer : null;
      if (
        (m = /^(?:mean|mean-bar|zero|zero-bar|story|story-alt):(?:[a-z]+:)?([\d,]+)$/.exec(it.id))
      ) {
        const v = m[1]!.split(',').map(Number);
        const mean = v.reduce((s, x) => s + x, 0) / v.length;
        const got = it.engine === 'number' ? numAns(it) : ans && 'value' in ans ? ans.value : NaN;
        if (Math.abs(got - mean) > 1e-9) errs.push(`${it.id}: 正答 ${got} ≠ ${mean}`);
        const h2 = plain(it.hints[1] ?? '');
        if (h2.includes('0も') !== v.includes(0))
          errs.push(`${it.id}: ヒントの「0も 数に 入れる」`);
      } else if ((m = /^total:[a-z]+:([\d.]+):(\d+)$/.exec(it.id))) {
        if (Math.abs(numAns(it) - Number(m[1]) * Number(m[2])) > 1e-9) errs.push(`${it.id}: 合計`);
      } else if ((m = /^missing(?:-alt)?:(\d+):(\d+):([\d,]+)$/.exec(it.id))) {
        const prev = m[3]!.split(',').map(Number);
        const last = Number(m[1]) * Number(m[2]) - prev.reduce((s, x) => s + x, 0);
        if (numAns(it) !== last || last < 0 || last > 10)
          errs.push(`${it.id}: のこり ${numAns(it)} ≠ ${last}`);
      }
    }
    expect(errs.slice(0, 10)).toEqual([]);
  });

  it('根拠は 第5学年 D(2)（データの活用）', () => {
    expect(average.basis).toContain('D(2)');
  });
});

describe('review g5a: g5.math.congruence', () => {
  const items = allItems(congruence);

  it('対応する辺の 選択肢: どれも 右の 頂点の 順で 名前を つける（正答だけ 並びが ちがう 手がかりを 作らない）', () => {
    const errs: string[] = [];
    let n = 0;
    for (const it of items) {
      if (!/^corr:.*:side\d$/.test(it.id) || it.engine !== 'choice') continue;
      n++;
      const labs = it.options.map((o) => /([DEF])([DEF])$/.exec(plain(o.label ?? '')));
      if (labs.some((l) => !l)) {
        errs.push(`${it.id}: 選択肢の 形`);
        continue;
      }
      const firsts = labs
        .map((l) => l![1])
        .sort()
        .join('');
      const seconds = labs
        .map((l) => l![2])
        .sort()
        .join('');
      if (firsts !== 'DEF' || seconds !== 'DEF')
        errs.push(`${it.id}: ${labs.map((l) => l![0]).join(' ')}`);
    }
    expect(n).toBeGreaterThan(0);
    expect(errs.slice(0, 10)).toEqual([]);
  });

  it('2つの 三角形の 図には 方がん（1ます 1cm）が ある。合同でない 解説は「1つ ちがう」と 言わない', () => {
    const errs: string[] = [];
    for (const it of items) {
      if (!/^(corr|corr-alt|measure|measure-alt):/.test(it.id)) continue;
      if (!markupOf(it).includes('stroke-opacity="0.2"')) errs.push(`${it.id}: 方がん なし`);
      if (it.id.endsWith(':n') && plain(it.explain).includes('1つ ちがう'))
        errs.push(`${it.id}: 解説`);
    }
    expect(errs.slice(0, 10)).toEqual([]);
  });

  it('三角形が決まる条件: 辺と 角は 1つの 三角形の 値（余弦定理で ±1°）。辺AB・辺BC・角C は 2通り かける', () => {
    const errs: string[] = [];
    let n = 0;
    const deg = (opp: number, p: number, q: number) =>
      (Math.acos((p * p + q * q - opp * opp) / (2 * p * q)) * 180) / Math.PI;
    for (const it of items) {
      const m = /^cond(?:-alt)?:[a-z]+:(\d+)-(\d+)-(\d+):(\d+)-(\d+)$/.exec(it.id);
      if (!m) continue;
      n++;
      const [a, b, c, B, C] = m.slice(1).map(Number) as [number, number, number, number, number];
      const A = 180 - B - C;
      if (
        Math.abs(deg(b, c, a) - B) > 1.01 ||
        Math.abs(deg(c, a, b) - C) > 1.01 ||
        Math.abs(deg(a, b, c) - A) > 1.01
      )
        errs.push(`${it.id}: 辺と 角が 合わない`);
      if (Math.min(A, B, C) < 20) errs.push(`${it.id}: 角が 小さすぎる`);
      if (!(a * Math.sin((C * Math.PI) / 180) < c && c < a))
        errs.push(`${it.id}: 辺AB・辺BC・角C で 1つに 決まって しまう`);
    }
    expect(n).toBeGreaterThan(0);
    expect(errs.slice(0, 10)).toEqual([]);
  });
});
