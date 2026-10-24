/**
 * 教材レビュー（g6f）で直した点・確かめた点の再発防止。
 * 円の面積・並べ方と組み合わせ・分数のわり算・分数のかけ算・度数分布表 の生成器を、
 * 全段階 × seed 0..299 × index 0..3 で生成し、正答を問題の数値から独立に計算し直して照らし合わせる。
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/util/rng';
import type { Item, UnitSpec } from '../../curriculum/types';
import { circleArea } from './circle-area';
import { combinations } from './combinations';
import { fractionDiv } from './fraction-div';
import { fractionMult } from './fraction-mult';
import { frequency } from './frequency';
import { ansVal, q, qdiv, qeq, qmul, type Q } from './util';

const SEEDS = 300;

function all(unit: UnitSpec): Item[] {
  const src = unit.source;
  if (src.kind !== 'generator') throw new Error('generator only');
  const out: Item[] = [];
  for (let level = 0; level < unit.levels.length; level++)
    for (let seed = 0; seed < SEEDS; seed++)
      for (let index = 0; index < 4; index++)
        out.push(src.generate({ level, rng: createRng(seed), index }));
  return out;
}

const plain = (s: string) => s.replace(/《[^》]*》/g, '');

/** 数の答えの欄（number エンジン・graph の数の問い） */
function answerOf(it: Item): Q {
  if (it.engine === 'number') return ansVal(it.fields[0]!.answer);
  if (it.engine === 'graph' && it.task.kind === 'number') return ansVal(it.task.fields[0]!.answer);
  throw new Error(`no number answer: ${it.id}`);
}
function wrongsOf(it: Item): Q[] {
  const ws =
    it.engine === 'number'
      ? it.wrongAnswers
      : it.engine === 'graph' && it.task.kind === 'number'
        ? it.task.wrongAnswers
        : [];
  return (ws ?? []).map((w) => {
    const v = w.value.split('と');
    if (v.length === 2) {
      const [n, d] = v[1]!.split('/').map(Number);
      return q(Number(v[0]) * d! + n!, d!);
    }
    if (w.value.includes('/')) {
      const [n, d] = w.value.split('/').map(Number);
      return q(n!, d!);
    }
    const t = w.value.split('.');
    return t.length === 2 ? q(Number(t.join('')), 10 ** t[1]!.length) : q(Number(w.value));
  });
}
function expectWrongsDiffer(it: Item) {
  const a = answerOf(it);
  for (const w of wrongsOf(it)) expect(qeq(w, a), `${it.id} wrong equals answer`).toBe(false);
}

// ---- 円の面積 ----
describe('review-g6f g6.math.circle-area', () => {
  const items = all(circleArea);
  /** 半径 r の円の面積（100分の1 cm²） */
  const A = (r: number) => r * r * 314;
  const expected = (id: string): number | null => {
    const [head, ...k] = id.split(':');
    const n = k.map(Number);
    const obj = head!.replace('-alt', '');
    if (obj === 'radius') return A(n[0]!);
    if (obj === 'diam') return A(n[0]! / 2);
    if (obj === 'part') return A(n[1]!) / (k[0] === 'half' ? 2 : 4);
    if (obj === 'combo') {
      if (k[0] === 'ring') return A(n[1]!) - A(n[2]!);
      if (k[0] === 'sqcircle') return 4 * n[1]! * n[1]! * 100 - A(n[1]!);
      if (k[0] === 'sqquarter') return n[1]! * n[1]! * 100 - A(n[1]!) / 4;
      if (k[0] === 'leaf') return 2 * (A(n[1]!) / 4 - (n[1]! * n[1]! * 100) / 2);
    }
    if (obj === 'formula' && !head!.endsWith('-alt')) return n[0]! * 314;
    return null;
  };

  it('答えが 問題の 長さから 計算し直した 値と 一致する（全段階）', () => {
    for (const it of items) {
      const e = expected(it.id);
      if (e === null) continue;
      expect(qeq(answerOf(it), q(e, 100)), it.id).toBe(true);
      expectWrongsDiffer(it);
    }
  });

  it('文の 長さと 図の 長さが 一致する', () => {
    for (const it of items) {
      if (it.engine !== 'number') continue;
      const [head, ...k] = it.id.split(':');
      const p = plain(it.prompt);
      const label = it.figure?.kind === 'svg' ? plain(it.figure.label) : '';
      if (head === 'radius') expect(p, it.id).toContain(`半径 ${k[0]}cm`);
      if (head === 'radius-alt') expect(label, it.id).toContain(`半径が ${k[0]}cm`);
      if (head === 'diam') expect(p, it.id).toContain(`直径 ${k[0]}cm`);
      if (head === 'diam-alt') expect(label, it.id).toContain(`直径が ${k[0]}cm`);
      if (head === 'part') expect(p, it.id).toContain(`半径 ${k[1]}cm`);
      if (head === 'part-alt') expect(label, it.id).toContain(`半径が ${k[1]}cm`);
    }
  });

  it('並べかえた 図は 上向き・下向きの おうぎ形を たがいちがいに 並べた 平行四辺形に 近い 形（上の 辺も ある）', () => {
    let n = 0;
    for (const it of items) {
      if (it.objective !== 'formula') continue;
      expect(it.figure?.kind, it.id).toBe('svg');
      if (it.figure?.kind !== 'svg') continue;
      const m = it.figure.markup;
      // 外形: 下の 辺 20→200（円周の 半分）と 上の 辺
      expect(m, it.id).toMatch(/<path d="M20 130 L200 130 L[\d.]+ 50 L[\d.]+ 50 Z"/);
      // 太い 線（横の 長さ）は 下の 辺と 同じ 長さ
      expect(m, it.id).toContain('<line x1="20" y1="130" x2="200" y2="130"');
      n++;
    }
    expect(n).toBeGreaterThan(100);
  });

  it('縦・横が 円の 何に あたるかの 誤りは 並べかえの 誤概念（half-circ）に つなぐ', () => {
    for (const it of items) {
      if (it.engine !== 'choice' || !/^formula-alt:(tate|yoko):/.test(it.id)) continue;
      for (const o of it.options) if (!o.correct) expect(o.misconception, it.id).toBe('half-circ');
    }
  });
});

// ---- 並べ方と 組み合わせ ----
describe('review-g6f g6.math.combinations', () => {
  const items = all(combinations);
  const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
  /** 数字カードの 並べ方を 全部 書き出して 数える */
  function countCards(digits: number[], k: number): number {
    const seen = new Set<string>();
    const rec = (used: number[], s: string) => {
      if (s.length === k) {
        if (s[0] !== '0') seen.add(s);
        return;
      }
      digits.forEach((d, i) => {
        if (!used.includes(i)) rec([...used, i], s + String(d));
      });
    };
    rec([], '');
    return seen.size;
  }
  /** n こから k こを 選ぶ 組み合わせを 書き出して 数える */
  function countComb(n: number, k: number): number {
    let c = 0;
    for (let m = 0; m < 1 << n; m++) {
      let b = 0;
      for (let i = 0; i < n; i++) if (m & (1 << i)) b++;
      if (b === k) c++;
    }
    return c;
  }

  it('答えが 書き出して 数えた 数と 一致する（全段階）', () => {
    for (const it of items) {
      if (it.engine !== 'number') continue;
      const [head, ...k] = it.id.split(':');
      const a = answerOf(it);
      let e: number | null = null;
      if (head === 'perm-alt') e = countCards(k[1]!.split('').map(Number), Number(k[2]));
      else if (head === 'perm') {
        const n = Number(k[1]);
        e = ['leader', 'medal', 'relay'].includes(k[0]!) ? n * (n - 1) : fact(n);
      } else if (head === 'comb-alt') e = countComb(Number(k[1]), 2);
      else if (head === 'comb') e = countComb(Number(k[2]), k[0] === 'pick3' ? 3 : 2);
      else if (head === 'product-alt')
        e = k[0] === 'coin' ? 2 ** Number(k[1]) : k[0] === 'janken' ? 3 ** Number(k[1]) : 36;
      else if (head === 'product') e = Number(k[1]) * Number(k[2]) * Number(k[3]);
      expect(e, it.id).not.toBeNull();
      expect(qeq(a, q(e!)), it.id).toBe(true);
      expectWrongsDiffer(it);
    }
  });

  it('旗の 並べ方は 使う n色を 全部 示す（5色から 選ぶ 問題に 読めない）', () => {
    let n = 0;
    for (const it of items) {
      if (!it.id.startsWith('perm:flags:')) continue;
      const k = Number(it.id.split(':')[2]);
      const p = plain(it.prompt);
      const m = /^(.+?)の (\d)色の 旗を 全部 使って/.exec(p);
      expect(m, p).not.toBeNull();
      expect(m![1]!.split('・').length, p).toBe(k);
      expect(Number(m![2]), p).toBe(k);
      expect(p, p).not.toContain('の うち');
      n++;
    }
    expect(n).toBeGreaterThan(10);
  });

  it('落ちを さがす 問題: 正解は 書かれて いない ただ1つ、誤りの 選択肢は 書かれて いる（または その 入れかえ）', () => {
    for (const it of items) {
      if (it.engine !== 'choice' || it.objective !== 'list') continue;
      const shown = it.figure?.kind === 'text' ? plain(it.figure.text).split('、 ') : [];
      const norm = (s: string) => s.split('と').sort().join('と');
      for (const o of it.options) {
        const l = plain(o.label ?? '');
        const inList = it.id.startsWith('list-alt')
          ? shown.includes(l)
          : shown.map(norm).includes(norm(l));
        if (o.correct) expect(inList, it.id).toBe(false);
        else if (o.misconception === 'list-dup' || o.misconception === 'double-count')
          expect(inList, it.id).toBe(true);
      }
    }
  });
});

// ---- 分数の かけ算・わり算（式を 読み直して 計算） ----
/** 式の 1つの 数（[[a/b]]・[[w a/b]]・小数・整数） */
function term(s: string): Q {
  let m = /^\[\[(\d+) (\d+)\/(\d+)\]\]$/.exec(s);
  if (m) return q(Number(m[1]) * Number(m[3]) + Number(m[2]), Number(m[3]));
  m = /^\[\[(\d+)\/(\d+)\]\]$/.exec(s);
  if (m) return q(Number(m[1]), Number(m[2]));
  m = /^(\d+)\.(\d+)$/.exec(s);
  if (m) return q(Number(`${m[1]}${m[2]}`), 10 ** (m[2] ?? '').length);
  if (/^\d+$/.test(s)) return q(Number(s));
  throw new Error(`bad term ${s}`);
}
/** 左から 順に 計算（× ÷ だけ） */
function evalExpr(s: string): Q {
  const t = s.split(/ (×|÷) /);
  let v = term(t[0]!);
  for (let i = 1; i < t.length; i += 2) {
    const x = term(t[i + 1]!);
    v = t[i] === '×' ? qmul(v, x) : qdiv(v, x);
  }
  return v;
}

describe('review-g6f g6.math.fraction-mult / fraction-div', () => {
  for (const unit of [fractionMult, fractionDiv]) {
    it(`${unit.id}: 答えが 式から 計算し直した 値と 一致する（全段階）`, () => {
      for (const it of all(unit)) {
        const body = it.id.slice(it.id.indexOf(':') + 1);
        const head = it.id.split(':')[0]!;
        let e: Q;
        if (head.startsWith('recip')) e = qdiv(q(1), term(body));
        else if (head.startsWith('story')) e = evalExpr(body.slice(body.indexOf(':') + 1));
        else e = evalExpr(body);
        expect(qeq(answerOf(it), e), it.id).toBe(true);
        expectWrongsDiffer(it);
        // 計算の 問題は 図の 式が 答えの 式と 同じ
        if (
          it.engine === 'number' &&
          it.figure?.kind === 'text' &&
          !head.startsWith('recip') &&
          !head.startsWith('fdf-alt')
        )
          expect(it.figure.text, it.id).toContain(body);
        if (head.startsWith('story') && it.engine === 'number') {
          const [x, , y] = body.slice(body.indexOf(':') + 1).split(/ (×|÷) /);
          expect(it.prompt, it.id).toContain(x!);
          expect(it.prompt, it.id).toContain(y!);
        }
      }
    });
  }
  it('□ × c/d ＝ a/b の □ は a/b ÷ c/d', () => {
    for (const it of all(fractionDiv)) {
      if (!it.id.startsWith('fdf-alt') || it.figure?.kind !== 'text') continue;
      const m = /^\{\{\}\} × (\S+) ＝ (\S+)$/.exec(it.figure.text);
      expect(m, it.figure.text).not.toBeNull();
      expect(qeq(qmul(answerOf(it), term(m![1]!)), term(m![2]!)), it.id).toBe(true);
    }
  });
});

// ---- 度数分布表 ----
describe('review-g6f g6.math.frequency', () => {
  const items = all(frequency);
  /** 度数分布表の 図から [下限, 上限, 人数] の 並び */
  function rowsOf(it: Item): [number, number, number][] {
    const fig = it.engine === 'graph' ? null : it.figure;
    if (fig?.kind === 'table')
      return fig.rows
        .filter((r) => plain(r[0] ?? '') !== '合計')
        .map((r) => {
          const [lo, hi] = r[0]!.split('〜').map(Number);
          return [lo!, hi!, Number(r[1])];
        });
    if (it.engine === 'graph' && it.data.kind === 'bar') {
      const d = it.data;
      return d.labels.map((l, i) => {
        const [lo, hi] = l.split('〜').map(Number);
        return [lo!, hi!, d.values[i]!];
      });
    }
    return [];
  }

  it('答えが データ・表・グラフから 数え直した 値と 一致する（全段階）', () => {
    let n = 0;
    for (const it of items) {
      const p = plain(it.prompt);
      const rows = rowsOf(it);
      if (it.id.startsWith('table:') && it.engine === 'number' && it.figure?.kind === 'text') {
        const data = plain(it.figure.text).split('、 ').map(Number);
        const m = /(\d+)\D+以上 (\d+)\D+未満/.exec(p)!;
        const e = data.filter((x) => x >= Number(m[1]) && x < Number(m[2])).length;
        expect(qeq(answerOf(it), q(e)), it.id).toBe(true);
        // 境目の 値（以上・未満の 両方）が データに ある
        expect(data, it.id).toContain(Number(m[1]));
        expect(data, it.id).toContain(Number(m[2]));
        n++;
      } else if ((it.id.startsWith('table-alt') || it.id.startsWith('ratio')) && rows.length) {
        const m = /(\d+)\D+(以上|未満)の 人は/.exec(p)!;
        const edge = Number(m[1]);
        const part = rows
          .filter(([lo, hi]) => (m[2] === '以上' ? lo >= edge : hi <= edge))
          .reduce((s, r) => s + r[2], 0);
        const total = Number(/(\d+)人の/.exec(p)![1]);
        expect(
          rows.reduce((s, r) => s + r[2], 0),
          it.id,
        ).toBe(total);
        const e = it.id.startsWith('ratio') ? q(part * 100, total) : q(part);
        expect(qeq(answerOf(it), e), it.id).toBe(true);
        n++;
      } else if (it.id.startsWith('hist:') && rows.length) {
        const m = /(\d+)\D+以上/.exec(p)!;
        const row = rows.find(([lo]) => lo === Number(m[1]))!;
        expect(qeq(answerOf(it), q(row[2])), it.id).toBe(true);
        n++;
      } else if (it.id.startsWith('class:') && it.engine === 'choice') {
        const r = Number(/から (\d+)番目/.exec(p)![1]);
        const up = !p.includes('短い');
        const order = up ? [...rows].reverse() : rows;
        let acc = 0;
        let ans = '';
        for (const [lo, hi, c] of order) {
          acc += c;
          if (acc >= r) {
            ans = `${lo}〜${hi}`;
            break;
          }
        }
        expect(
          it.options.filter((o) => o.correct).map((o) => plain(o.label ?? '')),
          it.id,
        ).toEqual([ans]);
        n++;
      } else if (it.id.startsWith('class-alt') && it.engine === 'choice') {
        const v = Number(/が (\d+)\D+の 人は/.exec(p)![1]);
        const lab = plain(it.options.find((o) => o.correct)!.label ?? '');
        const [lo, hi] = lab.split('〜').map(Number);
        expect(lo! <= v && v < hi!, it.id).toBe(true);
        n++;
      } else continue;
      if (it.engine === 'number' || (it.engine === 'graph' && it.task.kind === 'number'))
        expectWrongsDiffer(it);
    }
    expect(n).toBeGreaterThan(1000);
  });

  it('順位を 数える 向きの 言い方が 場面に 合う（読書時間を「記録が よい」と 言わない）', () => {
    for (const it of items) {
      if (!it.id.startsWith('class:')) continue;
      const p = plain(it.prompt);
      if (it.id.includes(':reading:')) expect(p, it.id).toContain('時間が 長い ほうから');
      if (it.id.includes(':jump:')) expect(p, it.id).toContain('回数が 多い ほうから');
      if (it.id.includes(':commute:')) expect(p, it.id).toContain('時間が 短い ほうから');
    }
  });

  it('生の データに 記録 0（通学時間 0分など）を 入れない', () => {
    for (const it of items) {
      if (!it.id.startsWith('table:') || it.figure?.kind !== 'text') continue;
      expect(plain(it.figure.text).split('、 ').map(Number), it.id).not.toContain(0);
    }
  });
});
