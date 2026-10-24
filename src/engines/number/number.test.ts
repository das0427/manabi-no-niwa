import { describe, expect, it } from 'vitest';
import type { NumberItem } from '../../curriculum/types';
import { cellsToValue, columnLayout, columnSize, divisionSteps, valueToCells } from './column';
import { answerTextOf, checkNumberItem, judgeNumberItem } from './number';
import { numberSamples } from './number.samples';

const base = {
  engine: 'number' as const,
  id: 't',
  objective: 'o',
  level: 0,
  prompt: 'p',
  hints: ['a', 'b', 'c'],
  explain: 'e',
  identity: 'k',
};
const item = (over: Partial<NumberItem>): NumberItem => ({
  ...base,
  fields: [{ answer: { kind: 'int', value: 1 } }],
  ...over,
});

describe('単位（unit）・字数（maxLength）', () => {
  it('単位は判定に関係しない。正答の文に単位を付ける', () => {
    const it1 = item({ fields: [{ answer: { kind: 'int', value: 100 }, unit: 'cm' }] });
    expect(judgeNumberItem(it1, ['100']).result).toBe('correct');
    expect(answerTextOf(it1)).toBe('100 cm');
    expect(checkNumberItem(it1)).toEqual([]);
  });
  it('quantity と unit を重ねない', () => {
    const it1 = item({
      fields: [{ label: 'ながさ', answer: { kind: 'quantity', value: 5, unit: 'cm' }, unit: 'cm' }],
    });
    expect(answerTextOf(it1)).toBe('ながさ 5 cm');
  });
  it('兆の数を判定できる。maxLength の検査', () => {
    const it1 = item({ fields: [{ answer: { kind: 'int', value: 3000000000000 } }] });
    expect(judgeNumberItem(it1, ['3000000000000']).result).toBe('correct');
    expect(judgeNumberItem(it1, ['300000000000']).result).toBe('wrong');
    expect(checkNumberItem(it1)).toEqual([]);
    expect(
      checkNumberItem(item({ fields: [{ answer: { kind: 'int', value: 12345 }, maxLength: 4 }] })).join(),
    ).toMatch('maxLength');
    expect(
      checkNumberItem(item({ fields: [{ answer: { kind: 'int', value: 1 }, maxLength: 20 }] })).join(),
    ).toMatch('1〜16');
  });
});

describe('筆算のレイアウト', () => {
  it('たし算: 答えのますは 1けた多い。メモは 一の位より上', () => {
    const l = columnLayout({ op: 'add', operands: [487, 356], memo: true })!;
    expect(l.width).toBe(5);
    expect(l.expected).toEqual([843]);
    const memo = l.rows[0]!;
    expect(memo.kind).toBe('memo');
    expect(memo.kind === 'memo' && memo.cols).toEqual([1, 2, 3]);
    const ans = l.rows[l.rows.length - 1]!;
    expect(ans.kind === 'field' && ans.cols).toEqual([1, 2, 3, 4]);
  });
  it('ひき算・かけ算（部分積）・わり算の正しい値', () => {
    expect(columnLayout({ op: 'sub', operands: [403, 178] })!.expected).toEqual([225]);
    expect(columnLayout({ op: 'sub', operands: [3, 8] })).toBeNull();
    const m = columnLayout({ op: 'mul', operands: [23, 45] })!;
    expect(m.expected).toEqual([115, 92, 1035]);
    // 2だんめ（23×4）は 十の位から: 一の位の列にますが無い
    const p2 = m.rows.find((r) => r.kind === 'field' && r.field === 1)!;
    expect(p2.kind === 'field' && p2.cols).toEqual([1, 2, 3]);
    expect(columnLayout({ op: 'mul', operands: [23, 45], partials: false })!.expected).toEqual([
      1035,
    ]);
    expect(columnLayout({ op: 'div', operands: [75, 8] })!.expected).toEqual([9, 72, 3]);
    expect(columnLayout({ op: 'div', operands: [72, 3] })!.expected).toEqual([24, 6, 12, 12, 0]);
  });
  it('わり算の段（0 の商の段は書かない）', () => {
    expect(divisionSteps(612, 3).rows.map((r) => r.value)).toEqual([6, 12, 12, 0]);
    expect(divisionSteps(612, 3).quotient).toBe(204);
    expect(divisionSteps(84, 21).rows.map((r) => [r.value, r.right])).toEqual([
      [84, 1],
      [0, 1],
    ]);
  });
  it('大きさ: 2けた×2けたの部分積は入る。商が2けたのわり算は入らない', () => {
    expect(columnSize(columnLayout({ op: 'mul', operands: [23, 45] })!).h).toBeLessThanOrEqual(26.2);
    expect(columnSize(columnLayout({ op: 'div', operands: [72, 3] })!).h).toBeGreaterThan(26.2);
  });
  it('ますの数字を欄の値に（空きは ?）', () => {
    expect(cellsToValue(['', '8', '4', '3'])).toBe('843');
    expect(cellsToValue(['', '8', '', '3'])).toBe('8?3');
    expect(cellsToValue(['', '8', '4', ''])).toBe('84?');
    expect(cellsToValue(['', ''])).toBe('');
    expect(valueToCells(92, 3)).toEqual(['', '9', '2']);
  });
});

describe('筆算の判定と検査', () => {
  const add = item({
    fields: [{ answer: { kind: 'int', value: 843 } }],
    wrongAnswers: [{ value: '733', misconception: 'mis-no-carry' }],
    column: { op: 'add', operands: [487, 356], memo: true },
  });
  it('各欄の値で判定。誤答の例で誤概念。ますの空きは もう一度', () => {
    expect(judgeNumberItem(add, ['843']).result).toBe('correct');
    expect(judgeNumberItem(add, ['0843']).result).toBe('correct');
    expect(judgeNumberItem(add, ['733'])).toMatchObject({ result: 'wrong', misconception: 'mis-no-carry' });
    expect(judgeNumberItem(add, ['8?3']).result).toBe('retry');
    expect(checkNumberItem(add)).toEqual([]);
  });
  it('部分積の誤り（位をずらさない）を誤答の例で見つける', () => {
    const mul = numberSamples.find((s) => s.id === 'number-sample:col-mul2')!;
    expect(judgeNumberItem(mul, ['115', '92', '1035']).result).toBe('correct');
    expect(judgeNumberItem(mul, ['115', '92', '207'])).toMatchObject({
      misconception: 'mis-partial-shift',
    });
  });
  it('検査: 欄の数・値・記号キー・大きさ・問題文', () => {
    expect(checkNumberItem({ ...add, fields: [{ answer: { kind: 'int', value: 842 } }] }).join()).toMatch(
      '式と合わない',
    );
    expect(
      checkNumberItem({
        ...add,
        fields: [{ answer: { kind: 'int', value: 843 } }, { answer: { kind: 'int', value: 1 } }],
        wrongAnswers: [],
      }).join(),
    ).toMatch('欄の数');
    expect(checkNumberItem({ ...add, keys: ['decimal'] }).join()).toMatch('記号のキー');
    expect(
      checkNumberItem(
        item({
          fields: [{ answer: { kind: 'int', value: 24 } }, ...[6, 12, 12, 0].map((v) => ({ answer: { kind: 'int' as const, value: v } }))],
          column: { op: 'div', operands: [72, 3] },
        }),
      ).join(),
    ).toMatch('高さ');
    expect(
      checkNumberItem(
        item({
          fields: [115, 92, 1035].map((v) => ({ answer: { kind: 'int' as const, value: v } })),
          column: { op: 'mul', operands: [23, 45], memo: true },
        }),
      ).join(),
    ).toMatch('高さ');
    expect(
      checkNumberItem({ ...add, prompt: 'ひっさんで けいさんしよう。くりあがりに きを つけて かこう' }).join(),
    ).toMatch('1行');
    expect(
      checkNumberItem(
        item({
          fields: [{ answer: { kind: 'int', value: 920 } }],
          column: { op: 'mul', operands: [23, 40] },
        }),
      ).join(),
    ).toMatch('partials');
  });
  it('見本の問題に誤りが無い', () => {
    for (const s of numberSamples) expect(checkNumberItem(s), s.id).toEqual([]);
  });
});
