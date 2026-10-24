/**
 * 内容レビュー（g3/g4 算数）の指摘の再発を防ぐ検査（g4-math: order-ops・area・angle・cuboid・
 * decimal-int・ratio-intro・change-relations・line-graph）。全段階 × 多数 seed で生成して確かめる。
 */
import { describe, expect, it } from 'vitest';
import { createRng, hashSeed } from '../../core/util/rng';
import type { Item, UnitSpec } from '../../curriculum/types';
import pack from './index';

const SEEDS = 400;

function unitOf(id: string): UnitSpec {
  const u = pack.units.find((x) => x.id === id);
  if (!u) throw new Error(`no unit ${id}`);
  return u;
}

/** 全段階 × seed（index 0..7）で生成 */
function gen(unit: UnitSpec, seeds = SEEDS): Item[] {
  const src = unit.source;
  if (src.kind !== 'generator') return [...(src.items ?? [])];
  const out: Item[] = [];
  for (let level = 0; level < unit.levels.length; level++)
    for (let s = 0; s < seeds; s++)
      out.push(
        src.generate({
          level,
          rng: createRng(hashSeed('review-g4', unit.id, level, s)),
          index: s % 8,
        }),
      );
  return out;
}

/** よみ（《…》）を 取りのぞく */
const plain = (s: string) => s.replace(/《[^》]*》/g, '');

/** 文の中に 数 n が（前後が 数字・小数点で ない形で）あるか */
const hasNum = (s: string, n: number | string) =>
  new RegExp(`(^|[^0-9.])${String(n).replace('.', '\\.')}(?![0-9]|\\.[0-9])`).test(plain(s));

/** 表示の式（＋ − × ÷ （ ））を 計算 */
function evalShown(s: string): number {
  const js = plain(s)
    .replace(/＋/g, '+')
    .replace(/−/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/（/g, '(')
    .replace(/）/g, ')');
  if (!/^[0-9+\-*/() ]+$/.test(js)) throw new Error(`式でない: ${s}`);
  return Function(`return (${js});`)() as number;
}

describe('review: g4.math.order-ops（重大3・中-C の型の欠落・誤概念）', () => {
  const unit = unitOf('g4.math.order-ops');
  const items = gen(unit);
  const calcs = items.filter(
    (it): it is Extract<Item, { engine: 'number' }> =>
      it.engine === 'number' && /^(muldiv|paren|mixed)(-alt)?:/.test(it.id),
  );

  it('計算の問題が 十分に 出る', () => {
    expect(calcs.filter((c) => c.id.startsWith('mixed')).length).toBeGreaterThan(200);
  });

  it('ヒント③が「左から」の誤った手順を 言わず、2つめの 計算は 正しい 順序の 2手目', () => {
    for (const it of calcs) {
      const e = it.id.replace(/^[a-z-]+:/, '');
      const ans = (it.fields[0]!.answer as { value: number }).value;
      expect(evalShown(e), it.id).toBe(ans);
      const h3 = plain(it.hints[2]!);
      expect(h3, it.id).not.toMatch(/左から/);
      // 解説の 手順（① 式 ＝ 値、② …）を 取り出す
      const steps = [...plain(it.explain).matchAll(/[①②③④] ([^、。]+?) ＝ (\d+)/g)].map((m) => ({
        part: m[1]!,
        v: Number(m[2]),
      }));
      const nOps = (e.match(/[＋−×÷]/g) ?? []).length;
      expect(steps.length, `${it.id}: 解説は ぜんぶの 手順`).toBe(nOps);
      for (const s of steps) expect(evalShown(s.part), `${it.id} ${s.part}`).toBe(s.v);
      expect(steps[steps.length - 1]!.v, it.id).toBe(ans);
      // ③は 2手目を 示す（答えは 言わない）
      if (steps.length >= 2) expect(h3, it.id).toContain(steps[1]!.part);
      for (const h of it.hints)
        expect(hasNum(h, ans) && !hasNum(e, ans), `${it.id}: ${h}`).toBe(false);
    }
  });

  it('2手目を 正しく たどると 答えに なる（手順を 1つずつ 式に 当てはめる）', () => {
    for (const it of calcs) {
      let e = plain(it.id.replace(/^[a-z-]+:/, ''));
      const steps = [...plain(it.explain).matchAll(/[①②③④] ([^、。]+?) ＝ (\d+)/g)];
      for (const m of steps) {
        const part = m[1]!;
        const esc = part.replace(/[()*+?.\\[\]^$|{}]/g, '\\$&');
        const withParen = `（${part}）`;
        if (e.includes(withParen)) e = e.replace(withParen, m[2]!);
        else {
          const re = new RegExp(`(^|[^0-9])${esc}(?![0-9])`);
          expect(re.test(e), `${it.id}: 「${part}」が 式に ない（${e}）`).toBe(true);
          e = e.replace(re, `$1${m[2]!}`);
        }
      }
      expect(e.trim(), it.id).toBe(String((it.fields[0]!.answer as { value: number }).value));
    }
  });

  it('左から 計算しても 同じに なる 型（a × b ＋ c など）も 出る', () => {
    const muldivFirst = calcs.filter((c) => /^muldiv(-alt)?:\d+ [×÷]/.test(c.id));
    expect(muldivFirst.length).toBeGreaterThan(20);
    const mixedTpl = (re: RegExp) =>
      calcs.filter((c) => c.id.startsWith('mixed') && re.test(c.id)).length;
    expect(mixedTpl(/^mixed(-alt)?:（\d+ ＋ \d+）\s?× \d+ − \d+$/)).toBeGreaterThan(0);
    expect(mixedTpl(/^mixed(-alt)?:\d+ × （\d+ − \d+）\s?＋ \d+$/)).toBeGreaterThan(0);
    expect(mixedTpl(/^mixed(-alt)?:\d+ × \d+ − \d+ ÷ \d+$/)).toBeGreaterThan(0);
  });

  it('rules-alt の □に 積を 書く 誤答は assoc-add でない', () => {
    for (const it of items)
      if (it.engine === 'number' && it.id.startsWith('rules-alt:') && /× （\d+ × □）/.test(it.id))
        for (const w of it.wrongAnswers ?? []) expect(w.misconception).not.toBe('assoc-add');
  });

  it('rules: ヒント②と③が 同じ 文でない', () => {
    for (const it of items)
      if (it.id.startsWith('rules:')) expect(it.hints[1], it.id).not.toBe(it.hints[2]);
  });
});

describe('review: g4.math.area（重大4・中-B units-alt）', () => {
  const items = gen(unitOf('g4.math.area'));

  it('compound-alt: 文の 長方形（外わく）から 計算した 道の 面積が 正答', () => {
    let n = 0;
    for (const it of items) {
      if (it.engine !== 'number' || !it.id.startsWith('compound-alt:')) continue;
      n++;
      const p = plain(it.prompt);
      expect(p, it.id).not.toMatch(/花だんの まわり/);
      expect(p, it.id).toMatch(/土地/);
      const m = /たて (\d+)m、横 (\d+)mの 長方形の 土地の 内がわに そって、はば (\d+)mの 道/.exec(
        p,
      );
      expect(m, p).not.toBeNull();
      const [H, W, r] = [Number(m![1]), Number(m![2]), Number(m![3])];
      expect(W - 2 * r).toBeGreaterThan(0);
      expect(H - 2 * r).toBeGreaterThan(0);
      expect((it.fields[0]!.answer as { value: number }).value, it.id).toBe(
        W * H - (W - 2 * r) * (H - 2 * r),
      );
    }
    expect(n).toBeGreaterThan(20);
  });

  it('units-alt: ヒントは 答えの 単位に よらず 同じ（どれか 1つだけを 説明しない）', () => {
    const hs = new Set(
      items.filter((it) => it.id.startsWith('units-alt:')).map((it) => JSON.stringify(it.hints)),
    );
    expect(hs.size).toBe(1);
  });
});

describe('review: g4.math.angle（中-C 360°まで・ヒント）', () => {
  const items = gen(unitOf('g4.math.angle'));
  it('rotate: 答えは 360°以下、ヒントに 答えの 数が 出ない', () => {
    let n = 0;
    for (const it of items) {
      if (it.engine !== 'number' || it.objective !== 'rotate') continue;
      n++;
      const ans = (it.fields[0]!.answer as { value: number }).value;
      expect(ans, it.id).toBeLessThanOrEqual(360);
      // 答えの 角度（「90°」「＝ 90」）が ヒントに 出ない（「60分で 1回転」の 60分は 角度で ないので よい）
      const re = new RegExp(`(^|[^0-9])${ans}°|＝ ${ans}(?![0-9])`);
      for (const h of it.hints) expect(re.test(plain(h)), `${it.id}: ${h}`).toBe(false);
    }
    expect(n).toBeGreaterThan(100);
  });
});

describe('review: g4.math.cuboid（中-C intro の定義）', () => {
  it('直方体の 定義に 正方形の 面を ふくむ', () => {
    const t = plain(
      unitOf('g4.math.cuboid')
        .intro.map((s) => s.text)
        .join(''),
    );
    expect(t).not.toMatch(/長方形だけで かこまれた 形を 直方体/);
    expect(t).toMatch(/長方形と 正方形で かこまれた/);
  });
});

describe('review: g4.math.decimal-int（中-C rem-alt）', () => {
  const items = gen(unitOf('g4.math.decimal-int'));
  it('rem-alt: 解説の 答えは 1/10の位まで 表示し、わりきれるときは「…」を 付けない', () => {
    let n = 0;
    for (const it of items) {
      if (it.engine !== 'number' || !it.id.startsWith('rem-alt:')) continue;
      n++;
      const ex = plain(it.explain);
      expect(ex, it.id).toMatch(/四捨五入して \d+\.\dです/);
      const m = /rem-alt:([\d.]+)÷(\d+)/.exec(it.id)!;
      const av = Math.round(Number(m[1]) * 10);
      const d = Number(m[2]);
      if ((av * 10) % d === 0) expect(ex, it.id).not.toContain('…');
      const ans = (it.fields[0]!.answer as { value: number }).value;
      for (const w of it.wrongAnswers ?? [])
        // [[1/10]]の位までの 誤答で 正答より 大きい ＝ 切り上げすぎ（round-cut「四捨五入を わすれた」は 合わない）
        if (w.misconception === 'round-cut' && /^\d+\.\d$/.test(w.value) && Number(w.value) > ans)
          throw new Error(`${it.id}: 切り上げに round-cut`);
    }
    expect(n).toBeGreaterThan(20);
  });
});

describe('review: g4.math.ratio-intro（中-C compare の偏り）', () => {
  it('compare: 正解の ア・イが かたよらない', () => {
    const items = gen(unitOf('g4.math.ratio-intro'), 800);
    let a = 0;
    let all = 0;
    for (const it of items) {
      if (it.engine !== 'choice' || !it.id.startsWith('compare:')) continue;
      all++;
      if (it.options.find((o) => o.correct)!.label === 'ア') a++;
    }
    expect(all).toBeGreaterThan(100);
    expect(a / all).toBeGreaterThan(0.35);
    expect(a / all).toBeLessThan(0.65);
  });
});

describe('review: 誤概念IDの付け違い（change-relations・line-graph）', () => {
  it('change-relations formula-alt: half-perimeter は rope の 場面だけ', () => {
    for (const it of gen(unitOf('g4.math.change-relations')))
      if (
        it.engine === 'number' &&
        it.id.startsWith('formula-alt:') &&
        !it.id.startsWith('formula-alt:rope:')
      )
        for (const w of it.wrongAnswers ?? [])
          expect(w.misconception, it.id).not.toBe('half-perimeter');
  });

  it('line-graph change: down-vs-up は 右下がりの 区間だけ', () => {
    let n = 0;
    for (const it of gen(unitOf('g4.math.line-graph'))) {
      if (it.engine !== 'graph' || it.task.kind !== 'choice' || !it.id.startsWith('change:'))
        continue;
      const data = it.data as { labels: string[]; values: number[] };
      for (const o of it.task.options) {
        if (o.misconception !== 'down-vs-up') continue;
        n++;
        const j = data.labels.findIndex(
          (_, i) =>
            i + 1 < data.labels.length &&
            plain(`${data.labels[i]}から ${data.labels[i + 1]}`) === plain(o.label!),
        );
        expect(j, `${it.id}: ${o.label}`).toBeGreaterThanOrEqual(0);
        expect(data.values[j + 1]! - data.values[j]!, `${it.id}: ${o.label}`).toBeLessThan(0);
      }
    }
    expect(n).toBeGreaterThan(0);
  });
});
