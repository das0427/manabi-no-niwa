import { describe, expect, it } from 'vitest';
import { sampleItems, unsafeSvgsOf } from '../../curriculum/qa';
import type { ChoiceItem, Item, NumberItem } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import { plainText } from '../../text/rich';
import {
  abacusFig,
  beadsOf,
  digitOf,
  directAdd,
  directSub,
  G4_READ,
  G4_SET,
  G4_SMALL,
  rodDigits,
  spanOf,
} from './abacus-svg';
import { abacus, HOSU_LIST, SET4_LIST } from './abacus';

const items = sampleItems(abacus, 250);
const byObj = (o: string) => items.filter((it) => it.objective === o);
const numbers = (o: string) => byObj(o).filter((it) => it.engine === 'number') as NumberItem[];
const markupOf = (f: Figure | undefined): string | undefined => {
  if (!f) return undefined;
  if (f.kind === 'svg') return f.markup;
  if (f.kind === 'column') return f.items.map(markupOf).find((m) => m !== undefined);
  return undefined;
};
const smallM = (n: number) => markupOf(abacusFig(G4_SMALL, rodDigits(G4_SMALL, n)));
const readM = (units: number) => markupOf(abacusFig(G4_READ, rodDigits(G4_READ, units)));
const answerOf = (it: NumberItem) => (it.fields[0]!.answer as { value: number }).value;
const calc = (a: number, op: string, b: number) => (op === '＋' ? a + b : a - b);

describe('g4.math.abacus: 珠と数字', () => {
  it('d=0〜9 で 珠 ⇔ 数字 が往復する', () => {
    for (let d = 0; d <= 9; d++) expect(digitOf(beadsOf(d))).toBe(d);
    expect(() => beadsOf(-1)).toThrow();
  });
  it('図の形: 珠は rods×5＋▲、文字なし、危険な要素なし', () => {
    for (const lay of [G4_READ, G4_SET, G4_SMALL]) {
      const f = abacusFig(lay, Array(lay.rods).fill(0));
      expect(f.kind).toBe('svg');
      if (f.kind !== 'svg') continue;
      expect(f.markup.match(/<polygon/g)!.length).toBe(lay.rods * 5 + 1);
      expect(f.markup).not.toContain('<text');
      expect(unsafeSvgsOf(f)).toEqual([]);
      expect(f.markup).toContain(`viewBox="0 0 ${44 + lay.rods * 44} 240"`);
    }
  });
  it('入りきらない数は throw', () => {
    expect(() => rodDigits(G4_SET, 1_000_000)).toThrow();
  });
});

describe('g4.math.abacus: 定義域の大きさ', () => {
  it('HOSU=160（80＋80）。各組は「直接できない」', () => {
    const list = HOSU_LIST();
    expect(list).toHaveLength(160);
    expect(list.filter((x) => x.op === '＋')).toHaveLength(80);
    expect(list.filter((x) => x.op === '−')).toHaveLength(80);
    for (const { A, op, b } of list) {
      const a1 = A % 10;
      if (op === '＋') {
        expect(directSub(a1, 10 - b)).toBe(false);
        expect(directAdd(Math.floor(A / 10), 1)).toBe(true);
      } else {
        expect(directAdd(a1, 10 - b)).toBe(false);
        expect(directSub(Math.floor(A / 10), 1)).toBe(true);
      }
    }
    console.info(`g4.math.abacus: SET4=${SET4_LIST().length}`);
  });
});

describe('g4.math.abacus: 図と答えが同じデータ', () => {
  it('read: 小数・億兆とも、図は答えの数から作った図', () => {
    const rs = numbers('read').filter((it) => it.identity.startsWith('read:'));
    expect(rs.length).toBeGreaterThan(50);
    for (const it of rs) {
      const parts = it.identity.split(':');
      if (parts.length === 3) {
        const v = Number(parts[2]);
        expect(markupOf(it.figure)).toBe(readM(v * 100));
        expect(answerOf(it)).toBe(v);
      } else {
        const v = Number(parts[1]);
        expect(markupOf(it.figure)).toBe(readM(Math.round(v * 100)));
        expect(answerOf(it)).toBeCloseTo(v, 6);
      }
    }
  });
  it('read-table: 表と答えが合う', () => {
    const rs = numbers('read').filter((it) => it.identity.startsWith('read-table:'));
    expect(rs.length).toBeGreaterThan(5);
    for (const it of rs) {
      const v = Number(it.identity.slice(11));
      expect(answerOf(it)).toBeCloseTo(v, 6);
      const f = it.figure as Extract<Figure, { kind: 'table' }>;
      const ds = rodDigits(G4_READ, Math.round(v * 100));
      // 表の列は 数のけた（右の端は 小数の最後のけた）。数字の列の右端から数が合う
      const digs = f.rows[1]!.slice(1).map((c) => Number(plainText(c).replace('こ', '')));
      const [lo, hi] = spanOf(G4_READ, ds);
      expect(digs).toEqual(ds.slice(lo, hi + 1).map((d) => d % 5));
    }
  });
  it('multi: 図は元の数、答えは計算の結果', () => {
    const ms = numbers('multi');
    expect(ms.length).toBeGreaterThan(20);
    for (const it of ms) {
      const m = /^multi:(\d+)([＋−])(\d+)$/.exec(it.identity)!;
      expect(markupOf(it.figure)).toBe(smallM(Number(m[1])));
      expect(answerOf(it)).toBe(calc(Number(m[1]), m[2]!, Number(m[3])));
      for (const w of it.wrongAnswers!) expect(Number(w.value)).not.toBe(answerOf(it));
    }
  });
  it('hosu: 図は元の数。答えは 5−(10−b)、誤答例は答えと違う', () => {
    const hs = numbers('hosu');
    expect(hs.length).toBeGreaterThan(20);
    for (const it of hs) {
      const m = /^hosu:(\d+)([＋−])(\d)$/.exec(it.identity)!;
      expect(markupOf(it.figure)).toBe(smallM(Number(m[1])));
      expect(answerOf(it)).toBe(5 - (10 - Number(m[3])));
      for (const w of it.wrongAnswers!) expect(Number(w.value)).not.toBe(answerOf(it));
    }
  });
  it('okucho: 図は元の数、答えは計算の結果（数字だけの形は 0 をつけた数）', () => {
    const os = numbers('okucho');
    expect(os.length).toBeGreaterThan(20);
    for (const it of os) {
      const m = /^okucho(-num)?:(万|億|兆):(\d+)([＋−])(\d+)$/.exec(it.identity)!;
      const r = calc(Number(m[3]), m[4]!, Number(m[5]));
      const k = m[2] === '万' ? 4 : m[2] === '億' ? 8 : 12;
      expect(markupOf(it.figure)).toBe(smallM(Number(m[3])));
      expect(answerOf(it)).toBe(m[1] ? r * 10 ** k : r);
      for (const w of it.wrongAnswers!) expect(Number(w.value)).not.toBe(answerOf(it));
    }
  });
  it('dec: 図は元の数、答えは計算の結果', () => {
    const ds = numbers('dec');
    expect(ds.length).toBeGreaterThan(20);
    for (const it of ds) {
      const m = /^dec:([\d.]+)([＋−])([\d.]+)$/.exec(it.identity)!;
      const [A, B] = [Number(m[1]), Number(m[3])];
      expect(markupOf(it.figure)).toBe(readM(Math.round(A * 100)));
      expect(answerOf(it)).toBeCloseTo(calc(A, m[2]!, B), 6);
    }
  });
});

describe('g4.math.abacus: 選択肢の図', () => {
  const choices = items.filter((it) => it.engine === 'choice') as ChoiceItem[];
  it('選択肢は3〜4つ、正解はちょうど1つ、図・札は互いに違う', () => {
    expect(choices.length).toBeGreaterThan(30);
    for (const it of choices) {
      expect(it.options.length).toBeGreaterThanOrEqual(3);
      expect(it.options.length).toBeLessThanOrEqual(4);
      expect(it.options.filter((o) => o.correct)).toHaveLength(1);
      const keys = it.options.map((o) => markupOf(o.figure) ?? o.label);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
  it('set: 正解の図は答えの数で作った図', () => {
    const ss = choices.filter((it) => it.objective === 'set');
    expect(ss.length).toBeGreaterThan(10);
    for (const it of ss) {
      const [kind, key] = it.identity.split(':');
      const h = kind === 'set-units' ? Number(key) : Math.round(Number(key) * 100);
      const want = markupOf(abacusFig(G4_SET, rodDigits(G4_SET, h)));
      const hit = it.options.filter((o) => markupOf(o.figure) === want);
      expect(hit).toHaveLength(1);
      expect(hit[0]!.correct).toBe(true);
    }
  });
  it('hosu-alt: 正解の図は 計算の結果', () => {
    const hs = choices.filter((it) => it.identity.startsWith('hosu-alt:'));
    expect(hs.length).toBeGreaterThan(10);
    for (const it of hs) {
      const m = /^hosu-alt:(\d+)([＋−])(\d)$/.exec(it.identity)!;
      const hit = it.options.filter(
        (o) => markupOf(o.figure) === smallM(calc(Number(m[1]), m[2]!, Number(m[3]))),
      );
      expect(hit).toHaveLength(1);
      expect(hit[0]!.correct).toBe(true);
      expect(markupOf(it.figure)).toBe(smallM(Number(m[1])));
    }
  });
  it('multi-step: 正解の図は 最上位の数字だけ動かした結果', () => {
    const ms = choices.filter((it) => it.identity.startsWith('multi-step:'));
    expect(ms.length).toBeGreaterThan(5);
    for (const it of ms) {
      const m = /^multi-step:(\d+)([＋−])(\d+)$/.exec(it.identity)!;
      const b = m[3]!;
      const top = Number(b[0]) * 10 ** (b.length - 1);
      const hit = it.options.filter(
        (o) => markupOf(o.figure) === smallM(calc(Number(m[1]), m[2]!, top)),
      );
      expect(hit).toHaveLength(1);
      expect(hit[0]!.correct).toBe(true);
      expect(b.replace(/0/g, '').length).toBeGreaterThanOrEqual(2);
    }
  });
  it('dec-rod: 札は4つで、正解は B の小数のけた数と合う', () => {
    const rods = choices.filter((it) => it.identity.startsWith('dec-rod:'));
    expect(rods.length).toBeGreaterThan(5);
    for (const it of rods) {
      const B = it.identity.slice(8);
      const places = B.includes('.') ? B.length - B.indexOf('.') - 1 : 0;
      expect(it.options.map((o) => plainText(o.label ?? ''))).toEqual([
        '▲から 1つ 左',
        '▲の けた',
        '▲から 1つ 右',
        '▲から 2つ 右',
      ]);
      expect(plainText(it.options.find((o) => o.correct)!.label ?? '')).toBe(
        places === 0 ? '▲の けた' : places === 1 ? '▲から 1つ 右' : '▲から 2つ 右',
      );
    }
  });
});

describe('g4.math.abacus: 文の長さ（画面の収まり）', () => {
  it('問題文は40字以内、選択肢の文は10字以内、図の文は30字以内', () => {
    const bad: string[] = [];
    const figTexts = (f: Figure | undefined): string[] =>
      !f
        ? []
        : f.kind === 'text'
          ? [f.text]
          : f.kind === 'row' || f.kind === 'column'
            ? f.items.flatMap(figTexts)
            : [];
    for (const it of items as Item[]) {
      if (plainText(it.prompt).length > 40) bad.push(`prompt: ${it.prompt}`);
      if (it.engine === 'choice')
        for (const o of it.options)
          if (o.label !== undefined && plainText(o.label).length > 10)
            bad.push(`option: ${o.label}`);
      for (const t of figTexts(it.figure)) if (plainText(t).length > 30) bad.push(`fig: ${t}`);
    }
    expect([...new Set(bad)]).toEqual([]);
  });
});

describe('g4.math.abacus: 文の中身（レビューで足した検査）', () => {
  const many = sampleItems(abacus, 1500);
  it('ヒントに「0こしか」が出ない', () => {
    for (const it of many) {
      const hs = it.hints.map(plainText).join(' / ');
      expect(hs, it.id).not.toMatch(/ 0こしか/);
    }
  });
  it('multi-step: 誤りの step-order は「下の位を先に した」か「最後まで した」', () => {
    const ms = many.filter((it) => it.identity.startsWith('multi-step:')) as ChoiceItem[];
    expect(ms.length).toBeGreaterThan(5);
    for (const it of ms) {
      const m = /^multi-step:(\d+)([＋−])(\d+)$/.exec(it.identity)!;
      const [a, op, b] = [Number(m[1]), m[2]!, Number(m[3])];
      const lowP = String(b)
        .split('')
        .reverse()
        .findIndex((c) => c !== '0');
      const low = Number(String(b).split('').reverse()[lowP]) * 10 ** lowP;
      const ok = [calc(a, op, low), calc(a, op, b)].map((v) => smallM(v));
      for (const o of it.options)
        if (o.misconception === 'step-order') expect(ok).toContain(markupOf(o.figure));
    }
  });
});
