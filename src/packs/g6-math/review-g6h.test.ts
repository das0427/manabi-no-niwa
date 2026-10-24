/**
 * レビュー g6h（比・代表値・拡大図と縮図・線対称と点対称）で直した点の再発防止。
 * 全段階 × seed 0..299 × index 0..3 で生成して確かめる。
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/util/rng';
import type { Item, UnitSpec } from '../../curriculum/types';
import { ratio } from './ratio';
import { representative } from './representative';
import { scale } from './scale';
import { SYM_SHAPES, symmetry } from './symmetry';

const SEEDS = 300;

function all(unit: UnitSpec): Item[] {
  const src = unit.source;
  if (src.kind !== 'generator') return [];
  const out: Item[] = [];
  for (let level = 0; level < unit.levels.length; level++)
    for (let seed = 0; seed < SEEDS; seed++)
      for (let index = 0; index < 4; index++)
        out.push(src.generate({ level, rng: createRng(seed), index }));
  return out;
}

/** 《よみ》を 外す */
const strip = (s: string) => s.replace(/《[^》]*》/g, '');
const hintsOf = (it: Item) => (it.hints ?? []).map(strip);

describe('g6h レビュー: g6.math.ratio', () => {
  const items = all(ratio);

  it('比の 値（整数・小数の 比）: ヒントに 答えの 分数を 書かない', () => {
    const bad: string[] = [];
    for (const it of items) {
      if (it.objective !== 'value' || it.engine !== 'number' || it.id.includes('/')) continue;
      const a = it.fields[0]!.answer;
      if (a.kind !== 'fraction') continue;
      const t = `[[${a.num}/${a.den}]]`;
      if (hintsOf(it).some((h) => h.includes(t))) bad.push(it.id);
    }
    expect([...new Set(bad)].slice(0, 5)).toEqual([]);
  });

  it('比を 簡単に する: ヒントに 答えの 比（□ : □、×L ＝ □、…＝ □）を 書かない', () => {
    const bad: string[] = [];
    let n = 0;
    for (const it of items) {
      if (it.objective !== 'simplify' || it.engine !== 'number') continue;
      n++;
      const [f0, f1] = it.fields;
      const x = f0!.answer.kind === 'int' ? f0!.answer.value : NaN;
      const y = f1!.answer.kind === 'int' ? f1!.answer.value : NaN;
      for (const h of hintsOf(it)) {
        if (h.includes(`${x} : ${y}`)) bad.push(`${it.id} ${h}`);
        if (new RegExp(`＝ ${x}、.*＝ ${y}$`).test(h)) bad.push(`${it.id} ${h}`);
      }
    }
    expect(n).toBeGreaterThan(100);
    expect([...new Set(bad)].slice(0, 5)).toEqual([]);
  });
});

describe('g6h レビュー: g6.math.representative', () => {
  const items = all(representative);
  const valuesOf = (it: Item): number[] => {
    if (it.engine === 'graph' && it.data.kind === 'picture') {
      const d = it.data;
      return d.labels.flatMap((l, i) => Array.from({ length: d.values[i] ?? 0 }, () => Number(l)));
    }
    if (it.engine === 'number' && it.figure?.kind === 'text')
      return it.figure.text.split(' （')[0]!.split('、 ').map(Number);
    return [];
  };

  it('平均値・中央値・最頻値の 正答が データから 計算した 値と 合う', () => {
    const bad: string[] = [];
    for (const it of items) {
      if (!['mean', 'median', 'mode'].includes(it.objective)) continue;
      const fields =
        it.engine === 'number'
          ? it.fields
          : it.engine === 'graph' && it.task.kind === 'number'
            ? it.task.fields
            : [];
      const a = fields[0]!.answer;
      const got = a.kind === 'fraction' ? a.num / a.den : a.value;
      const xs = valuesOf(it).sort((p, q) => p - q);
      const n = xs.length;
      let want: number;
      if (it.objective === 'mean') want = xs.reduce((s, v) => s + v, 0) / n;
      else if (it.objective === 'median')
        want = n % 2 ? xs[(n - 1) / 2]! : (xs[n / 2 - 1]! + xs[n / 2]!) / 2;
      else {
        const c = new Map<number, number>();
        for (const v of xs) c.set(v, (c.get(v) ?? 0) + 1);
        const e = [...c.entries()].sort((p, q) => q[1] - p[1]);
        if (e.length > 1 && e[0]![1] === e[1]![1]) bad.push(`${it.id} 最頻値が 1つに 決まらない`);
        want = e[0]![0];
      }
      if (Math.abs(want - got) > 1e-9) bad.push(`${it.id} ${want} ≠ ${got}`);
    }
    expect([...new Set(bad)].slice(0, 5)).toEqual([]);
  });

  it('ドットプロットを 読む: 値を 答えた 誤りは dot-read（mode-freq ではない）', () => {
    let n = 0;
    for (const it of items) {
      if (it.objective !== 'dot' || !it.alt || it.engine !== 'graph' || it.task.kind !== 'number')
        continue;
      for (const w of it.task.wrongAnswers ?? []) {
        n++;
        expect(w.misconception).toBe('dot-read');
      }
    }
    expect(n).toBeGreaterThan(10);
  });

  it('代表値を 選ぶ（場面）: 誤概念が 選んだ 誤りと 合う', () => {
    const MM = new Set(['平均値', '中央値']);
    const bad: string[] = [];
    for (const it of items) {
      if (it.objective !== 'choose' || !it.alt || it.engine !== 'choice') continue;
      const correct = strip(it.options.find((o) => o.correct)!.label ?? '');
      for (const o of it.options) {
        if (o.correct) continue;
        const l = strip(o.label ?? '');
        const m = o.misconception;
        if (m === 'mode-freq') bad.push(`${it.id} ${l} mode-freq`);
        if (m === 'mean-median' && !(MM.has(l) && MM.has(correct)))
          bad.push(`${it.id} ${l} mean-median`);
        if (m === 'mode-max' && !l.includes('大きい')) bad.push(`${it.id} ${l} mode-max`);
      }
    }
    expect([...new Set(bad)].slice(0, 5)).toEqual([]);
  });
});

describe('g6h レビュー: g6.math.scale', () => {
  const items = all(scale);
  it('対応する 辺: 誤答の 例は 整数か 小数第1位まで（割り切れない 小数を 入れない）', () => {
    const bad: string[] = [];
    for (const it of items) {
      if (it.objective !== 'side' || it.engine !== 'number') continue;
      for (const w of it.wrongAnswers ?? [])
        if (/\.\d{2,}/.test(w.value)) bad.push(`${it.id} ${w.value}`);
    }
    expect([...new Set(bad)].slice(0, 5)).toEqual([]);
  });

  it('対応する 辺の 長さ: 正答 ＝ 対応する 辺 × 倍率', () => {
    for (const it of items) {
      if (it.objective !== 'side' || it.alt || it.engine !== 'number') continue;
      const m = /^side:(\d+),(\d+),(\d+):([\d.]+):(ef|fd)$/.exec(it.id)!;
      const known = Number(m[5] === 'ef' ? m[1] : m[2]);
      const a = it.fields[0]!.answer;
      expect(a.kind === 'int' ? a.value : NaN).toBe(known * Number(m[4]));
    }
  });
});

describe('g6h レビュー: g6.math.symmetry', () => {
  const items = all(symmetry);
  const L = 'ABCDEFGH';
  type Pt = [number, number];
  const ptsOf = (kind: string, key: string): Pt[] =>
    kind === 'line'
      ? key.split(' ').map((s) => s.split(',').map(Number) as Pt)
      : (SYM_SHAPES.POINT_SHAPES.find((s) => s.key === key)!.pts as Pt[]);

  it('対応する 点・辺: 正答が 図の 対称で 対応し、頂点が 一直線に 並ばず、選択肢が 3つ以上', () => {
    const bad: string[] = [];
    let n = 0;
    for (const it of items) {
      if (it.objective !== 'corr' || it.engine !== 'choice') continue;
      n++;
      const m = /^corr(?:-alt)?:(line|point):(.*):(点|辺)([A-H]+)$/.exec(it.id)!;
      const kind = m[1]!;
      const pts = ptsOf(kind, m[2]!);
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const img = (p: Pt): Pt =>
        kind === 'line'
          ? [8 - p[0], p[1]]
          : [Math.min(...xs) + Math.max(...xs) - p[0], Math.min(...ys) + Math.max(...ys) - p[1]];
      const at = (p: Pt) => pts.findIndex((q) => q[0] === p[0] && q[1] === p[1]);
      const want = m[4]!
        .split('')
        .map((c) => L[at(img(pts[L.indexOf(c)]!))]!)
        .join('');
      const corr = strip(it.options.find((o) => o.correct)!.label ?? '').slice(1);
      if (corr !== want) bad.push(`${it.id} 正答 ${corr} ≠ ${want}`);
      if (it.options.length < 3) bad.push(`${it.id} 選択肢 ${it.options.length}`);
      const k = pts.length;
      for (let i = 0; i < k; i++) {
        const a = pts[i]!;
        const b = pts[(i + 1) % k]!;
        const c = pts[(i + 2) % k]!;
        if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) === 0)
          bad.push(`${it.id} 一直線`);
      }
      // 辺の 選択肢は 文字の 向きが そろう（正解だけ 逆向きで 見分けが つかない）
      if (m[3] === '辺') {
        const dir = (s: string) => (L.indexOf(s[1]!) === (L.indexOf(s[0]!) + 1) % k ? 'f' : 'r');
        const ds = new Set(it.options.map((o) => dir(strip(o.label ?? '').slice(1))));
        if (ds.size !== 1) bad.push(`${it.id} 向きが ばらばら`);
      }
    }
    expect(n).toBeGreaterThan(100);
    expect([...new Set(bad)].slice(0, 5)).toEqual([]);
  });

  it('多角形の 対称（円）: ヒントに 頂点・辺・対角線を 持ち出さない', () => {
    let n = 0;
    for (const it of items) {
      if (it.objective !== 'poly' || !it.id.includes(':circle:')) continue;
      n++;
      for (const h of hintsOf(it)) expect(h).not.toMatch(/頂点|辺|対角線/);
    }
    expect(n).toBeGreaterThan(5);
  });
});
