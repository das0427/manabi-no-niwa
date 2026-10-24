/**
 * g2-math 内容レビュー（後半8単元）の再発防止テスト。
 * numbers-1000 / numbers-10000 / sub-column / tables-graphs / time / times-tables / triangles-quads / volume
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/util/rng';
import type { Item, UnitSpec } from '../../curriculum/types';
import pack from './index';

const UNITS = [
  'numbers-1000',
  'numbers-10000',
  'sub-column',
  'tables-graphs',
  'time',
  'times-tables',
  'triangles-quads',
  'volume',
];

function unitOf(name: string): UnitSpec {
  const u = pack.units.find((x) => x.id === `g2.math.${name}`);
  if (!u) throw new Error(name);
  return u;
}

/** 全段階 × seed × 回の番号で 生成する */
function generate(u: UnitSpec, seeds = 200): Item[] {
  if (u.source.kind !== 'generator') return u.source.kind === 'items' ? u.source.items : [];
  const out: Item[] = [];
  for (let level = 0; level < u.levels.length; level++)
    for (let seed = 0; seed < seeds; seed++)
      for (let index = 0; index < 4; index++)
        out.push(
          u.source.generate({ level, rng: createRng(seed * 131 + level * 7 + index), index }),
        );
  return out;
}

/** 1つの数で答える問題の答え（それ以外は null） */
function singleAnswer(it: Item): number | null {
  if (it.engine === 'number' && it.fields.length === 1) {
    const a = it.fields[0]!.answer;
    return a.kind === 'int' ? a.value : null;
  }
  if (it.engine === 'numberline') {
    // このパックの数直線は整数だけ（Num が数でない形のときは対象外）
    const v: unknown =
      it.task.kind === 'read' ? it.task.at : it.task.kind === 'place' ? it.task.target : null;
    return typeof v === 'number' ? v : null;
  }
  if (it.engine === 'graph' && it.task.kind === 'number' && it.task.fields.length === 1) {
    const a = it.task.fields[0]!.answer;
    return a.kind === 'int' ? a.value : null;
  }
  return null;
}

const hasNum = (text: string, n: number) => new RegExp(`(^|[^0-9])${n}([^0-9]|$)`).test(text);

/** 角の大きさ（度） */
function angles(ps: [number, number][]): number[] {
  return ps.map((p, i) => {
    const a = ps[(i - 1 + ps.length) % ps.length]!;
    const b = ps[(i + 1) % ps.length]!;
    const v1 = [a[0] - p[0], a[1] - p[1]] as const;
    const v2 = [b[0] - p[0], b[1] - p[1]] as const;
    const c = (v1[0] * v2[0] + v1[1] * v2[1]) / Math.hypot(...v1) / Math.hypot(...v2);
    return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
  });
}

describe('g2-math 内容レビュー（後半8単元）', () => {
  for (const name of UNITS) {
    it(`${name}: ヒントの最後の段が 答えの数（10以上）を そのまま言わない`, () => {
      const errs = new Set<string>();
      for (const it of generate(unitOf(name), 150)) {
        const a = singleAnswer(it);
        if (a === null || a < 10) continue;
        const hints = it.hints;
        const last = hints[hints.length - 1] ?? '';
        // 1段目で 単位の きまり（1L＝1000mL など）として 言っている ものは 除く
        if (hasNum(last, a) && !hasNum(hints[0] ?? '', a)) errs.add(`${it.id}: ${last}`);
      }
      expect([...errs].slice(0, 10)).toEqual([]);
    });
  }

  it('times-tables: きまり（入れかえ）の選択肢で 答えが同じ式は 正解の1つだけ', () => {
    const errs: string[] = [];
    for (const it of generate(unitOf('times-tables'))) {
      if (it.engine !== 'choice') continue;
      const [a, b] = (it.prompt.match(/\d+/g) ?? []).map(Number);
      const value = (s: string) => {
        const m = /(\d+) ([×＋]) (\d+)/.exec(s);
        if (!m) return NaN;
        return m[2] === '×' ? Number(m[1]) * Number(m[3]) : Number(m[1]) + Number(m[3]);
      };
      const same = it.options.filter((o) => value(o.label ?? '') === a! * b!);
      if (same.length !== 1 || !same[0]!.correct)
        errs.push(`${it.id}: ${it.options.map((o) => o.label).join(' / ')}`);
    }
    expect(errs.slice(0, 5)).toEqual([]);
  });

  it('triangles-quads: 選択肢の形に 直角に まぎらわしい かど（90°±10°、直角は除く）が ない', () => {
    const errs = new Set<string>();
    for (const it of generate(unitOf('triangles-quads'), 100)) {
      if (it.engine !== 'geometry' || it.task.kind !== 'pick') continue;
      for (const o of it.task.options) {
        if (!o.shape) continue;
        const near = angles(o.shape.points as [number, number][]).filter(
          (x) => Math.abs(x - 90) > 0.01 && Math.abs(x - 90) < 10,
        );
        if (near.length) errs.add(JSON.stringify(o.shape.points));
      }
    }
    expect([...errs]).toEqual([]);
  });

  it('triangles-quads: 直角の問題のヒントは「たてと よこ」に かぎらない（傾いた直角がある）、へん・ちょうてんの問題で × を使わない', () => {
    for (const it of generate(unitOf('triangles-quads'), 100)) {
      if (it.objective === 'right') expect(it.hints.join(' ')).not.toContain('たてと よこ');
      if (it.objective === 'parts')
        expect(`${it.hints.join(' ')} ${it.explain}`).not.toContain('×');
    }
  });

  it('time: 「ふん／ぷん」の よみが 数に あう・「0ぷん もどる」と 言わない', () => {
    const errs = new Set<string>();
    for (const it of generate(unitOf('time'))) {
      const texts = [it.prompt, ...it.hints, it.explain];
      for (const t of texts) {
        for (const m of t.matchAll(/(\d+)(ぷん|ふん)/g)) {
          const n = Number(m[1]);
          const want = [0, 1, 3, 4, 6, 8].includes(n % 10) ? 'ぷん' : 'ふん';
          if (m[2] !== want) errs.add(`${it.id}: ${m[0]}`);
        }
        if (/(^|[^0-9])0ぷん もどる/.test(t)) errs.add(`${it.id}: ${t}`);
      }
    }
    expect([...errs].slice(0, 10)).toEqual([]);
  });

  it('time: ちょうどの 時刻で「すこし すすんで」と 言わない・ちょうど なんじ に なる 問題で ヒントに 答えを 書かない', () => {
    const errs = new Set<string>();
    for (const it of generate(unitOf('time'))) {
      if (it.engine !== 'clock') continue;
      const h = it.hints.join(' ');
      if (it.task.kind === 'read' && it.task.time.m % 5 === 0 && h.includes('すこし すすんで'))
        errs.add(it.id);
      if (it.task.kind === 'elapsed' && it.task.end.m === 0) {
        if (it.task.ask === 'end' && h.includes(`${it.task.end.h}じ ちょうど`)) errs.add(it.id);
        const d = it.task.end.h * 60 + it.task.end.m - (it.task.start.h * 60 + it.task.start.m);
        if (it.task.ask === 'duration' && new RegExp(`(^|[^0-9])${d}[ふぷ]ん(?!ずつ)`).test(h))
          errs.add(it.id);
      }
      if (/(^|[^0-9])0[ふぷ]ん/.test(h)) errs.add(`${it.id}: ${h}`);
    }
    expect([...errs].slice(0, 10)).toEqual([]);
  });

  it('numbers-1000・triangles-quads・time: まだ 習わない かけ算の しるし（×）を 使わない', () => {
    for (const name of ['numbers-1000', 'triangles-quads', 'time']) {
      for (const it of generate(unitOf(name), 80)) {
        const fig = it.engine === 'number' && it.figure?.kind === 'text' ? it.figure.text : '';
        const texts = [it.prompt, ...it.hints, it.explain, fig].join(' ');
        expect(texts, it.id).not.toMatch(/×|かけて/);
      }
    }
  });

  it('time: ごぜん・ごごの 場面と 時刻が あう', () => {
    const range: [RegExp, number, number][] = [
      [/おやつ/, 14, 16],
      [/こうえん/, 13, 17],
      [/ゆうごはん/, 18, 20],
      [/おふろ/, 18, 21],
      [/おきた/, 5, 8],
      [/がっこうに ついた/, 7, 8],
      [/あさごはん/, 6, 8],
      [/じゅぎょう/, 8, 11],
    ];
    for (const it of generate(unitOf('time'))) {
      if (!it.id.startsWith('ampm-alt:')) continue;
      const H = Number(it.id.split(':')[1]);
      const r = range.find(([re]) => re.test(it.prompt));
      expect(r, it.prompt).toBeDefined();
      expect(H >= r![1] && H <= r![2], `${H}じ ${it.prompt}`).toBe(true);
    }
  });

  it('volume: いちばん おおい かさ（L・dL・mL）の 正解が 1つ・L の つく 選択肢に 片よらない', () => {
    const toDl = (l: string) => {
      if (/^\d+mL$/.test(l)) return Number.parseInt(l) / 100;
      const m = /^(?:(\d+)L)?(?:(\d+)dL)?$/.exec(l)!;
      return Number(m[1] ?? 0) * 10 + Number(m[2] ?? 0);
    };
    let total = 0;
    let lCorrect = 0;
    for (const it of generate(unitOf('volume'))) {
      if (it.engine !== 'choice' || !it.id.startsWith('unit-alt')) continue;
      const vs = it.options.map((o) => toDl(o.label!));
      const mx = Math.max(...vs);
      const top = it.options.filter((_, i) => vs[i] === mx);
      expect(top.length).toBe(1);
      expect(top[0]!.correct).toBe(true);
      total++;
      if (
        top[0]!.label!.includes('L') &&
        !top[0]!.label!.endsWith('mL') &&
        /\dL/.test(top[0]!.label!)
      )
        lCorrect++;
    }
    expect(total).toBeGreaterThan(20);
    expect(lCorrect / total).toBeLessThan(0.8);
  });

  it('numbers-10000: すうちょくせんの 図が 10000を こえない', () => {
    for (const it of generate(unitOf('numbers-10000'))) {
      const f = it.engine === 'number' ? it.figure : undefined;
      if (f && f.kind === 'numberline') expect(f.max).toBeLessThanOrEqual(10000);
    }
  });
});
