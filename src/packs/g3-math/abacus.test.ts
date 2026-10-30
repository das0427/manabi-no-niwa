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
  G3_READ,
  G3_SET,
  G3_SMALL,
  rodDigits,
} from './abacus-svg';
import {
  abacus,
  BIG_PAIRS,
  DEC_PAIRS,
  DIRECT_ALT_LIST,
  DIRECT_LIST,
  FIVE_LIST,
  SET3_LIST,
  TEN_LIST,
} from './abacus';

const items = sampleItems(abacus, 250);
const byObj = (o: string) => items.filter((it) => it.objective === o);
const markupOf = (f: Figure | undefined): string | undefined => {
  if (!f) return undefined;
  if (f.kind === 'svg') return f.markup;
  if (f.kind === 'column') return f.items.map(markupOf).find((m) => m !== undefined);
  return undefined;
};
const smallM = (n: number) => markupOf(abacusFig(G3_SMALL, rodDigits(G3_SMALL, n)));
const answerOf = (it: NumberItem) => (it.fields[0]!.answer as { value: number }).value;

describe('g3.math.abacus: 珠と数字', () => {
  it('d=0〜9 で 珠 ⇔ 数字 が往復する', () => {
    for (let d = 0; d <= 9; d++) expect(digitOf(beadsOf(d))).toBe(d);
    expect(() => beadsOf(10)).toThrow();
  });
  it('図の形: 珠は rods×5＋▲、文字なし、危険な要素なし、定位点は3けたごと', () => {
    for (const lay of [G3_READ, G3_SET, G3_SMALL]) {
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
    expect(() => rodDigits(G3_SMALL, 10000)).toThrow();
  });
});

describe('g3.math.abacus: 定義域の大きさ', () => {
  it('FIVE=20, TEN=35+35, DIRECT=900', () => {
    expect(FIVE_LIST()).toHaveLength(20);
    expect(TEN_LIST().filter((x) => x[1] === '＋')).toHaveLength(35);
    expect(TEN_LIST().filter((x) => x[1] === '−')).toHaveLength(35);
    expect(TEN_LIST()).toHaveLength(70);
    expect(DIRECT_LIST()).toHaveLength(900);
    expect(BIG_PAIRS()).toHaveLength(117);
    console.info(
      `g3.math.abacus: DIRECT_ALT=${DIRECT_ALT_LIST().length} SET3=${SET3_LIST().length} DEC_PAIRS=${DEC_PAIRS().length}`,
    );
  });
  it('TEN の各組は「直接できる」、FIVE の各組は「直接できない」', () => {
    for (const [A, op, b] of TEN_LIST()) {
      if (op === '＋') expect(directSub(A, 10 - b)).toBe(true);
      else expect(directAdd(A % 10, 10 - b)).toBe(true);
      // 5の補数だけでは足りない（一の位に b をそのまま足せない／ひけない）
      expect(op === '＋' ? A + b >= 10 : (A % 10) - b < 0).toBe(true);
    }
    for (const [a, op, b] of FIVE_LIST()) {
      if (op === '＋') expect(directAdd(a, b)).toBe(false);
      else expect(directSub(a, b)).toBe(false);
    }
  });
});

describe('g3.math.abacus: 図と答えが同じデータ', () => {
  it('read: 図は答えの数から作った図と一致する', () => {
    const rs = byObj('read').filter((it) => it.identity.startsWith('read:')) as NumberItem[];
    expect(rs.length).toBeGreaterThan(50);
    for (const it of rs) {
      const v = it.identity.slice(5);
      const units = Math.round(Number(v) * 10);
      expect(markupOf(it.figure)).toBe(markupOf(abacusFig(G3_READ, rodDigits(G3_READ, units))));
      expect(answerOf(it)).toBe(Number(v));
    }
  });
  it('read-table: 表と答えが合う', () => {
    const rs = items.filter((it) => it.identity.startsWith('read-table:')) as NumberItem[];
    expect(rs.length).toBeGreaterThan(5);
    for (const it of rs) {
      const n = Number(it.identity.slice(11));
      expect(answerOf(it)).toBe(n);
      const f = it.figure as Extract<Figure, { kind: 'table' }>;
      const digs = String(n).split('').map(Number);
      expect(f.rows[0]!.slice(1)).toEqual(digs.map((d) => (d >= 5 ? '入《はい》る' : '－')));
      expect(f.rows[1]!.slice(1)).toEqual(digs.map((d) => `${d % 5}こ`));
    }
  });
  it('direct: 図は元の数、答えは動かした結果', () => {
    const ds = byObj('direct').filter((it) => it.engine === 'number') as NumberItem[];
    expect(ds.length).toBeGreaterThan(10);
    for (const it of ds) {
      const [, a, r, mv] = it.identity.split(':');
      expect(markupOf(it.figure)).toBe(smallM(Number(a)));
      const unit = 10 ** Number(r);
      const num = Number(/\d+/.exec(mv!)?.[0] ?? 5);
      const sign = mv!.startsWith('in') || mv === 'f-in' ? 1 : -1;
      expect(answerOf(it)).toBe(Number(a) + sign * num * unit);
    }
  });
  it('five / ten: 図は元の数。答えは 5−b・10−b で、誤答例は答えと違う', () => {
    for (const it of byObj('five').filter((x) => x.engine === 'number') as NumberItem[]) {
      const m = /^five:(\d)([＋−])(\d)$/.exec(it.identity)!;
      expect(markupOf(it.figure)).toBe(smallM(Number(m[1])));
      expect(answerOf(it)).toBe(5 - Number(m[3]));
      for (const w of it.wrongAnswers!) expect(Number(w.value)).not.toBe(answerOf(it));
    }
    for (const it of byObj('ten').filter((x) => x.engine === 'number') as NumberItem[]) {
      const m = /^ten:(\d+)([＋−])(\d)$/.exec(it.identity)!;
      expect(markupOf(it.figure)).toBe(smallM(Number(m[1])));
      expect(answerOf(it)).toBe(10 - Number(m[3]));
      for (const w of it.wrongAnswers!) expect(Number(w.value)).not.toBe(answerOf(it));
    }
  });
  it('bigdec: 図は元の数、答えは計算の結果', () => {
    for (const it of byObj('bigdec').filter((x) => x.engine === 'number') as NumberItem[]) {
      const m = /^(big|dec):([\d.]+)([＋−])([\d.]+)$/.exec(it.identity)!;
      const [A, B] = [Number(m[2]), Number(m[4])];
      const units = m[1] === 'big' ? A * 10 : Math.round(A * 10);
      expect(markupOf(it.figure)).toBe(markupOf(abacusFig(G3_READ, rodDigits(G3_READ, units))));
      const want = m[3] === '＋' ? A + B : A - B;
      expect(answerOf(it)).toBeCloseTo(want, 6);
    }
  });
});

describe('g3.math.abacus: 選択肢の図', () => {
  const choices = items.filter((it) => it.engine === 'choice') as ChoiceItem[];
  it('選択肢は3〜4つ、正解はちょうど1つ、図は互いに違う', () => {
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
      const n = Number(it.identity.split(':')[1]);
      const want = markupOf(abacusFig(G3_SET, rodDigits(G3_SET, n * 10)));
      const hit = it.options.filter((o) => markupOf(o.figure) === want);
      expect(hit).toHaveLength(1);
      expect(hit[0]!.correct).toBe(true);
    }
  });
  it('direct-alt / five-alt / ten-alt: 正解の図は 計算の結果', () => {
    const alts = choices.filter((it) => /^(direct|five|ten)-alt:/.test(it.identity));
    expect(alts.length).toBeGreaterThan(15);
    for (const it of alts) {
      const m = /-alt:(\d+)([＋−])(\d+)$/.exec(it.identity)!;
      const res = m[2] === '＋' ? Number(m[1]) + Number(m[3]) : Number(m[1]) - Number(m[3]);
      const hit = it.options.filter((o) => markupOf(o.figure) === smallM(res));
      expect(hit).toHaveLength(1);
      expect(hit[0]!.correct).toBe(true);
      expect(markupOf(it.figure)).toBe(smallM(Number(m[1])));
    }
  });
  it('bigdec-rod: 札は「▲から」の位置で、正解は ▲からの数え方と合う', () => {
    const rods = choices.filter((it) => it.objective === 'bigdec');
    expect(rods.length).toBeGreaterThan(5);
    for (const it of rods) {
      const key = it.identity.split(':')[1]!;
      const want =
        key === 'dec' ? '▲の 1つ 右《みぎ》' : `▲から ${String(key).length - 1}つ 左《ひだり》`;
      expect(it.options.find((o) => o.correct)!.label).toBe(want);
    }
  });
});

describe('g3.math.abacus: 文の長さ（画面の収まり）', () => {
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

describe('g3.math.abacus: 文の中身（レビューで足した検査）', () => {
  const many = sampleItems(abacus, 1500);
  it('number の問題には 誤答例が 1つ以上ある（ten の b=5 も）', () => {
    for (const it of many)
      if (it.engine === 'number') expect(it.wrongAnswers?.length ?? 0, it.id).toBeGreaterThan(0);
  });
  it('ヒントに「0こしか」が出ない。ちょうど 10 の たし算で「10を こえる」と言わない', () => {
    for (const it of many) {
      const hs = it.hints.map(plainText).join(' / ');
      expect(hs, it.id).not.toMatch(/ 0こしか/);
      const m = /^ten(?:-alt)?:(\d+)＋(\d+)$/.exec(it.identity);
      if (m && Number(m[1]) + Number(m[2]) === 10) expect(hs, it.id).not.toContain('こえる');
    }
  });
});
