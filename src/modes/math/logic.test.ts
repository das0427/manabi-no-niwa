import { render } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { vocab } from '../../content/vocab';
import { VOICE_CATALOG } from '../../voice/catalog/index';
import { voiceText } from '../../voice/types';
import { Board } from './Board';
import {
  AREA_H,
  AREA_W,
  buildLayout,
  buildSplitLayout,
  countable,
  demoOrder,
  EAT_SHIFT,
  splitPicPos,
} from './layout';
import {
  allowsZero,
  answerOf,
  answerVoice,
  choiceRange,
  choicesFor,
  formulasOf,
  formulaText,
  formulaTokens,
  formulaVoice,
  generateRound,
  hintVoice,
  isValidSplit,
  itemKeyOf,
  MATH_ITEMS,
  picturesOf,
  problemKey,
  promptOf,
  sceneVoice,
  splitFormula,
  splitsOf,
  spokenNumbers,
  STAGES,
  stageOf,
  type MathProblem,
  type MathSkill,
  type MathStage,
} from './logic';
import { voice } from './voice';
import { createRng } from '../../core/util/rng';

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
const SKILLS = Object.keys(STAGES) as MathSkill[];
const ALL_STAGES = Object.values(STAGES).flat() as MathStage[];

/** 段階 × 式 × 品物 の全問題 */
function everyProblem(stage: MathStage): MathProblem[] {
  return formulasOf(stage).flatMap((f) => MATH_ITEMS.map((item) => ({ ...f, item })));
}

const digits = (s: string): number[] => (s.match(/\d/g) ?? []).map(Number);

describe('段階ごとの式の数（learning-design.md 9章）', () => {
  const expected: Record<MathStage, number> = {
    A: 3,
    B1: 3,
    B2: 10,
    B3: 20, // 合計1〜5、0＋0 を除く（表の「15」は n＋0 だけを数えた値。ここでは 0＋n も含む）
    C1: 3,
    C2: 10,
    C3: 15,
    D1: 3,
    D2: 10,
    E1: 20,
    E2: 15,
  };
  for (const stage of ALL_STAGES) {
    it(`${stage}: 式 ${expected[stage]} 通り`, () => {
      expect(formulasOf(stage)).toHaveLength(expected[stage]);
      const keys = new Set(formulasOf(stage).map((f) => `${f.op}:${f.a}:${f.b}`));
      expect(keys.size).toBe(expected[stage]);
    });
  }
  it('E1 は B3、E2 は C3 と同じ範囲', () => {
    expect(formulasOf('E1')).toEqual(formulasOf('B3'));
    expect(formulasOf('E2')).toEqual(formulasOf('C3'));
  });
  it('registry の段階の並びと一致する', () => {
    expect(STAGES.add).toHaveLength(4);
    expect(STAGES.sub).toHaveLength(3);
    expect(STAGES.split).toHaveLength(2);
    expect(stageOf('add', 99)).toBe('B3');
    expect(stageOf('sub', -1)).toBe('C1');
  });
});

describe('範囲（負数なし・0 は B3/C3/E にだけ）', () => {
  for (const stage of ALL_STAGES) {
    it(`${stage}`, () => {
      for (const f of formulasOf(stage)) {
        const ctx = `${stage} ${JSON.stringify(f)}`;
        const p: MathProblem = { ...f, item: 'apple' };
        const ans = answerOf(p);
        if (f.op === 'split') {
          expect(ans, ctx).toBeNull();
          expect(f.a, ctx).toBeGreaterThanOrEqual(3);
          expect(f.a, ctx).toBeLessThanOrEqual(5);
          continue;
        }
        expect(ans, ctx).not.toBeNull();
        expect(f.a, ctx).toBeGreaterThanOrEqual(0);
        expect(f.b, ctx).toBeGreaterThanOrEqual(0);
        expect(ans!, ctx).toBeGreaterThanOrEqual(0);
        expect(Math.max(f.a, f.b, ans!), ctx).toBeLessThanOrEqual(5);
        if (!allowsZero(stage)) {
          expect(Math.min(f.a, f.b, ans!), ctx).toBeGreaterThanOrEqual(1);
          expect(digits(formulaText(p, true)).includes(0), ctx).toBe(false);
        }
        if (f.op === '+') expect(f.a + f.b, ctx).toBeGreaterThanOrEqual(1);
        if (f.op === '-') expect(f.b, ctx).toBeLessThanOrEqual(f.a);
        if (f.op === 'part') expect(ans!, ctx).toBeGreaterThanOrEqual(1);
      }
    });
  }
  it('上限: A・B1 は合計3まで、B2 は5まで、C1 は3以内、答え1以上', () => {
    for (const f of formulasOf('A')) expect(f.a + f.b).toBeLessThanOrEqual(3);
    for (const f of formulasOf('B1')) expect(f.a + f.b).toBeLessThanOrEqual(3);
    for (const f of formulasOf('B2')) {
      expect(f.a + f.b).toBeLessThanOrEqual(5);
      expect(f.a).toBeGreaterThanOrEqual(1);
      expect(f.b).toBeGreaterThanOrEqual(1);
    }
    for (const f of formulasOf('C1')) {
      expect(f.a).toBeLessThanOrEqual(3);
      expect(f.a - f.b).toBeGreaterThanOrEqual(1);
    }
    for (const f of formulasOf('C2')) expect(f.a - f.b).toBeGreaterThanOrEqual(1);
  });
  it('B3 に 0＋0 はない。0 を含む式がある。C3 は答え 0 を含む', () => {
    const b3 = formulasOf('B3');
    expect(b3.some((f) => f.a === 0 && f.b === 0)).toBe(false);
    expect(b3.some((f) => f.b === 0)).toBe(true);
    expect(formulasOf('C3').some((f) => f.a - f.b === 0)).toBe(true);
  });
});

describe('絵の個数・式の文字・読み上げ・答えが一致する（M9-08。全範囲）', () => {
  for (const stage of ALL_STAGES) {
    it(`${stage}: 全式 × 全品物`, () => {
      for (const p of everyProblem(stage)) {
        const ctx = `${stage} ${problemKey(p)}`;
        const ans = answerOf(p);
        const showPics = true;
        const lay = buildLayout(p, stage, showPics);
        const pics = picturesOf(p);

        if (p.op === '+') {
          // 式の文字
          expect(digits(formulaText(p)), ctx).toEqual([p.a, p.b]);
          expect(digits(formulaText(p, true)), ctx).toEqual([p.a, p.b, p.a + p.b]);
          expect(formulaText(p), ctx).toContain('＋');
          // 絵の個数
          expect(pics.groups, ctx).toEqual([p.a, p.b]);
          expect(
            lay.pics.filter((x) => x.group === 0),
            ctx,
          ).toHaveLength(p.a);
          expect(
            lay.pics.filter((x) => x.group === 1),
            ctx,
          ).toHaveLength(p.b);
          expect(
            lay.pics.some((x) => x.eaten),
            ctx,
          ).toBe(false);
          // 読み上げ
          expect(spokenNumbers(sceneVoice(p)), ctx).toEqual([p.a, p.b]);
          expect(spokenNumbers(formulaVoice(p)), ctx).toEqual([p.a, p.b]);
          expect(spokenNumbers(answerVoice(p)), ctx).toEqual([p.a, p.b, p.a + p.b]);
          expect(ans, ctx).toBe(p.a + p.b);
        } else if (p.op === '-') {
          expect(digits(formulaText(p)), ctx).toEqual([p.a, p.b]);
          expect(digits(formulaText(p, true)), ctx).toEqual([p.a, p.b, p.a - p.b]);
          expect(formulaText(p), ctx).toContain('－');
          expect(pics.groups, ctx).toEqual([p.a]);
          expect(pics.eaten, ctx).toBe(p.b);
          expect(lay.pics, ctx).toHaveLength(p.a);
          expect(
            lay.pics.filter((x) => x.eaten),
            ctx,
          ).toHaveLength(p.b);
          expect(
            lay.pics.filter((x) => !x.eaten),
            ctx,
          ).toHaveLength(p.a - p.b);
          expect(countable(lay), ctx).toHaveLength(p.a - p.b);
          expect(spokenNumbers(sceneVoice(p)), ctx).toEqual([p.a, p.b]);
          expect(spokenNumbers(formulaVoice(p)), ctx).toEqual([p.a, p.b]);
          expect(spokenNumbers(answerVoice(p)), ctx).toEqual([p.a, p.b, p.a - p.b]);
          expect(ans, ctx).toBe(p.a - p.b);
        } else if (p.op === 'part') {
          // n ＝ b ＋ ？
          expect(digits(formulaText(p)), ctx).toEqual([p.a, p.b]);
          expect(digits(formulaText(p, true)), ctx).toEqual([p.a, p.b, p.a - p.b]);
          expect(pics.groups, ctx).toEqual([p.b, p.a - p.b]);
          expect(
            lay.pics.filter((x) => x.group === 0),
            ctx,
          ).toHaveLength(p.b);
          expect(
            lay.pics.filter((x) => x.group === 1),
            ctx,
          ).toHaveLength(p.a - p.b);
          expect(lay.pics, ctx).toHaveLength(p.a);
          expect(demoOrder(p, lay), ctx).toHaveLength(p.a - p.b);
          expect(spokenNumbers(sceneVoice(p)), ctx).toEqual([p.a, p.b]);
          expect(spokenNumbers(formulaVoice(p)), ctx).toEqual([p.a, p.b]);
          expect(spokenNumbers(answerVoice(p)), ctx).toEqual([p.a, p.b, p.a - p.b]);
          expect(spokenNumbers(hintVoice(p, stage, 1)), ctx).toEqual([p.a, p.b]);
        } else {
          expect(pics.groups, ctx).toEqual([p.a]);
          // D1 の実際の配置は buildSplitLayout（下の describe で検査）。ここでは絵の個数だけ見る
          expect(buildSplitLayout(p.a).home, ctx).toHaveLength(p.a);
          expect(spokenNumbers(sceneVoice(p)), ctx).toEqual([p.a]);
          expect(ans, ctx).toBeNull();
          continue;
        }

        // 数字の行（式の文字）は、式の部品の順・文字と同じ
        const cellTexts = lay.cells.map((c) => c.token.text);
        const tokens = formulaTokens(p).map((t) => t.text);
        if (stage === 'A') {
          expect(cellTexts, ctx).toEqual(tokens.slice(0, 3));
          expect(lay.numY, ctx).toBeNull();
        } else {
          expect(cellTexts, ctx).toEqual(tokens);
          expect(lay.numY, ctx).not.toBeNull();
        }

        // 問題文に必要な音声キーがすべて台本にある
        for (const seq of [
          sceneVoice(p),
          formulaVoice(p),
          answerVoice(p),
          hintVoice(p, stage, 1),
          hintVoice(p, stage, 2),
          promptOf(p, stage, true).seq,
          promptOf(p, stage, true).display,
        ]) {
          for (const k of seq) {
            if (typeof k === 'string') expect(VOICE_CATALOG[k], `${ctx} ${k}`).toBeDefined();
          }
        }
        expect(itemKeyOf(p), ctx).toMatch(/^\d[+\-=]\d/);
      }
    });
  }

  it('0 のときの読み上げ（B3）: 「ひとつも ない」「ひとつも こなかった」', () => {
    const none = { op: '+', a: 0, b: 2, item: 'apple' } as const;
    expect(sceneVoice(none)).toContain('math.none');
    expect(spokenNumbers(sceneVoice(none))).toEqual([0, 2]);
    const noMore = { op: '+', a: 3, b: 0, item: 'egg' } as const;
    expect(sceneVoice(noMore)).toContain('math.add-none');
    expect(spokenNumbers(sceneVoice(noMore))).toEqual([3, 0]);
    expect(spokenNumbers(formulaVoice(noMore))).toEqual([3, 0]);
  });

  it('場面の読み上げの例: りんごが いっこ。もう にこ きたよ。ぜんぶで なんこ？', () => {
    expect(sceneVoice({ op: '+', a: 1, b: 2, item: 'apple' })).toEqual([
      'math.item-ga.apple',
      'count.ko.1',
      300,
      'math.add-more',
      'count.ko.2',
      'math.add-came',
      300,
      'math.q-all',
    ]);
    expect(formulaVoice({ op: '+', a: 1, b: 2, item: 'apple' })).toEqual([
      'num.1',
      'math.plus',
      'num.2',
      'math.wa-q',
    ]);
  });
});

describe('選択肢', () => {
  for (const stage of ALL_STAGES.filter((s) => s !== 'D1')) {
    it(`${stage}: 3枚・重複なし・答えを含む・範囲内（0 を出さない段階は 1〜5）`, () => {
      const rng = createRng(7);
      const [lo, hi] = choiceRange(stage);
      for (const p of everyProblem(stage)) {
        for (const position of [0, 1, 2]) {
          const ctx = `${stage} ${problemKey(p)} pos=${position}`;
          const { choices, answerIndex } = choicesFor(p, stage, position, rng);
          expect(choices, ctx).toHaveLength(3);
          expect(new Set(choices).size, ctx).toBe(3);
          expect(choices, ctx).toContain(answerOf(p));
          expect(answerIndex, ctx).toBe(position);
          expect(choices[answerIndex], ctx).toBe(answerOf(p));
          for (const c of choices) {
            expect(c, ctx).toBeGreaterThanOrEqual(lo);
            expect(c, ctx).toBeLessThanOrEqual(hi);
            expect(Math.abs(c - answerOf(p)!), ctx).toBeLessThanOrEqual(2);
            if (!allowsZero(stage)) expect(c, ctx).toBeGreaterThanOrEqual(1);
          }
        }
      }
    });
  }
});

describe('generateRound（seed 1..200 × 全段階）', () => {
  for (const skill of SKILLS) {
    for (let level = 0; level < STAGES[skill].length; level++) {
      const stage = STAGES[skill][level]!;
      for (const size of [3, 4, 5]) {
        it(`${skill} ${stage} size=${size}`, () => {
          const pool = new Set(formulasOf(stage).map((f) => `${f.op}:${f.a}:${f.b}`));
          const pos = [0, 0, 0];
          for (const seed of SEEDS) {
            const ctx = `${skill} ${stage} size=${size} seed=${seed}`;
            const qs = generateRound(skill, level, seed, size);
            expect(qs, ctx).toHaveLength(size);
            // 1回の中で同じ問題（式と品物）を出さない
            expect(new Set(qs.map((x) => problemKey(x.problem))).size, ctx).toBe(size);
            expect(new Set(qs.map((x) => x.problem.item)).size, ctx).toBe(size);
            if (pool.size >= size) {
              expect(new Set(qs.map((x) => `${x.problem.a}:${x.problem.b}`)).size, ctx).toBe(size);
            }
            const seq: number[] = [];
            for (const x of qs) {
              const p = x.problem;
              expect(pool.has(`${p.op}:${p.a}:${p.b}`), ctx).toBe(true);
              expect(MATH_ITEMS).toContain(p.item);
              expect(vocab(p.item).group, ctx).toBe('food');
              if (stage === 'D1') {
                expect(x.choices, ctx).toEqual([]);
                continue;
              }
              expect(x.choices, ctx).toHaveLength(3);
              expect(new Set(x.choices).size, ctx).toBe(3);
              expect(x.choices[x.answerIndex], ctx).toBe(answerOf(p));
              for (const c of x.choices) {
                expect(c, ctx).toBeGreaterThanOrEqual(0);
                if (!allowsZero(stage)) expect(c, ctx).toBeGreaterThanOrEqual(1);
                expect(c, ctx).toBeLessThanOrEqual(5);
              }
              seq.push(x.answerIndex);
              pos[x.answerIndex]! += 1;
            }
            if (stage === 'D1') continue;
            // 正解位置の偏りなし: 回の中で出現回数の差は1以下、同じ位置が3回続かない
            const counts = [0, 1, 2].map((i) => seq.filter((s) => s === i).length);
            expect(Math.max(...counts) - Math.min(...counts), ctx).toBeLessThanOrEqual(1);
            for (let i = 2; i < seq.length; i++) {
              expect(seq[i] === seq[i - 1] && seq[i] === seq[i - 2], ctx).toBe(false);
            }
          }
          if (stage !== 'D1') {
            const sum = pos.reduce((a, b) => a + b, 0);
            for (const c of pos) {
              expect(c / sum, `${skill} ${stage} 位置 ${pos}`).toBeGreaterThan(0.28);
              expect(c / sum, `${skill} ${stage} 位置 ${pos}`).toBeLessThan(0.38);
            }
          }
        });
      }
    }
  }

  it('同じ seed なら同じ問題', () => {
    expect(generateRound('add', 2, 42, 4)).toEqual(generateRound('add', 2, 42, 4));
    expect(generateRound('add', 2, 42, 4)).not.toEqual(generateRound('add', 2, 43, 4));
  });

  it('範囲の式がすべて出る（seed 1..200）', () => {
    for (const skill of SKILLS) {
      for (let level = 0; level < STAGES[skill].length; level++) {
        const stage = STAGES[skill][level]!;
        const seen = new Set<string>();
        for (const seed of SEEDS) {
          for (const x of generateRound(skill, level, seed, 5)) {
            seen.add(`${x.problem.op}:${x.problem.a}:${x.problem.b}`);
          }
        }
        expect(seen.size, `${skill} ${stage}`).toBe(formulasOf(stage).length);
      }
    }
  });

  it('品物は りんご・いちご・みかん・たまご・バナナ の5種がすべて出る', () => {
    const seen = new Set<string>();
    for (const seed of SEEDS)
      for (const x of generateRound('add', 0, seed, 5)) seen.add(x.problem.item);
    expect([...seen].sort()).toEqual([...MATH_ITEMS].sort());
  });
});

describe('D1（わける）の判定', () => {
  it('n=3〜5 のすべての有効な分け方を受け入れる（1と4・4と1 は別）', () => {
    for (const n of [3, 4, 5]) {
      const all = splitsOf(n);
      expect(all).toHaveLength(n - 1);
      for (let k = 1; k <= n - 1; k++) {
        expect(isValidSplit(n, k, n - k), `n=${n} k=${k}`).toBe(true);
        expect(all.some(([x, y]) => x === k && y === n - k)).toBe(true);
      }
    }
    expect(splitsOf(5)).toContainEqual([1, 4]);
    expect(splitsOf(5)).toContainEqual([4, 1]);
    expect(splitsOf(3)).toEqual([
      [1, 2],
      [2, 1],
    ]);
  });
  it('片方が0・合計が違う・小数 は受け入れない', () => {
    for (const n of [3, 4, 5]) {
      expect(isValidSplit(n, 0, n)).toBe(false);
      expect(isValidSplit(n, n, 0)).toBe(false);
      expect(isValidSplit(n, 0, 0)).toBe(false);
      expect(isValidSplit(n, 1, n)).toBe(false);
      expect(isValidSplit(n, 1, n - 2)).toBe(false);
      expect(isValidSplit(n, -1, n + 1)).toBe(false);
      expect(isValidSplit(n, 0.5, n - 0.5)).toBe(false);
    }
  });
  it('分けたあとの式と声が一致する', () => {
    expect(splitFormula(5, 3, 2)).toBe('5 ＝ 3 ＋ 2');
    expect(digits(splitFormula(4, 1, 3))).toEqual([4, 1, 3]);
    expect(itemKeyOf({ op: 'split', a: 5, b: 5, item: 'apple' }, [3, 2])).toBe('5=3+2');
  });
  it('D2 は答え1以上・片方が1以上', () => {
    for (const f of formulasOf('D2')) {
      expect(f.a).toBeGreaterThanOrEqual(2);
      expect(f.a).toBeLessThanOrEqual(5);
      expect(f.b).toBeGreaterThanOrEqual(1);
      expect(f.a - f.b).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('盤面の配置（舞台に収まり、重ならない）', () => {
  const overlaps = (
    a: { x: number; y: number; s: number },
    b: { x: number; y: number; s: number },
  ) =>
    a.x < b.x + b.s - 0.01 &&
    b.x < a.x + a.s - 0.01 &&
    a.y < b.y + b.s - 0.01 &&
    b.y < a.y + a.s - 0.01;

  for (const stage of ALL_STAGES.filter((s) => s !== 'D1')) {
    for (const showPics of [true, false]) {
      it(`${stage} 絵${showPics ? 'あり' : 'なし'}`, () => {
        for (const p of everyProblem(stage).filter((x) => x.item === 'apple')) {
          const ctx = `${stage} ${problemKey(p)}`;
          const lay = buildLayout(p, stage, showPics);
          for (const c of lay.cells) {
            expect(c.x, ctx).toBeGreaterThanOrEqual(0);
            expect(c.x + c.w, ctx).toBeLessThanOrEqual(AREA_W);
          }
          for (let i = 1; i < lay.cells.length; i++) {
            expect(lay.cells[i]!.x, ctx).toBeGreaterThanOrEqual(
              lay.cells[i - 1]!.x + lay.cells[i - 1]!.w,
            );
          }
          if (lay.numY !== null) expect(lay.numY + lay.numH, ctx).toBeLessThan(28);
          expect(lay.bottom, ctx).toBeLessThan(28);
          if (!showPics) {
            expect(lay.pics, ctx).toHaveLength(0);
            continue;
          }
          for (const pl of lay.plates) {
            expect(pl.x, ctx).toBeGreaterThanOrEqual(0);
            expect(pl.x + pl.w, ctx).toBeLessThanOrEqual(AREA_W);
            expect(pl.y + pl.h, ctx).toBeLessThanOrEqual(AREA_H);
          }
          const rects = lay.pics.map((x) => ({ x: x.x, y: x.y, s: lay.size }));
          const moved = lay.pics
            .filter((x) => x.eaten)
            .map((x) => ({ x: x.ex!, y: x.ey!, s: lay.size }));
          const remain = lay.pics
            .filter((x) => !x.eaten)
            .map((x) => ({ x: x.x, y: x.y, s: lay.size }));
          for (const r of [...rects, ...moved]) {
            expect(r.x, ctx).toBeGreaterThanOrEqual(0);
            expect(r.x + r.s, ctx).toBeLessThanOrEqual(AREA_W);
            expect(r.s, ctx).toBeGreaterThanOrEqual(6); // 主操作は 6u 以上
          }
          const check = (list: typeof rects) => {
            for (let i = 0; i < list.length; i++)
              for (let j = i + 1; j < list.length; j++)
                expect(overlaps(list[i]!, list[j]!), ctx).toBe(false);
          };
          check(rects);
          check([...remain, ...moved]);
          // 絵は皿の中にある
          for (const pic of lay.pics) {
            const pl = lay.plates.find(
              (x) => pic.x >= x.x && pic.x + lay.size <= x.x + x.w && !x.area,
            );
            expect(pl, `${ctx} pic ${pic.i}`).toBeDefined();
          }
          // 皿どうしは重ならない
          for (let i = 0; i < lay.plates.length; i++)
            for (let j = i + 1; j < lay.plates.length; j++) {
              const a = lay.plates[i]!;
              const b = lay.plates[j]!;
              expect(a.x + a.w <= b.x + 0.01 || b.x + b.w <= a.x + 0.01, ctx).toBe(true);
            }
        }
      });
    }
  }

  it('D1: n 個が元の場所とおさらに収まり、重ならない', () => {
    for (const n of [3, 4, 5]) {
      const lay = buildSplitLayout(n);
      expect(lay.plateA.x + lay.plateA.w).toBeLessThan(lay.plateB.x);
      expect(lay.plateB.x + lay.plateB.w).toBeLessThanOrEqual(AREA_W);
      // 全部を おさらA、全部を おさらB、半々 でも収まる
      for (const place of [
        Array.from({ length: n }, () => 1),
        Array.from({ length: n }, () => 2),
        Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 1 : 2)),
        Array.from({ length: n }, () => 0),
      ]) {
        const rects = place.map((_, i) => ({ ...splitPicPos(lay, place, i), s: lay.size }));
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            expect(overlaps(rects[i]!, rects[j]!), `n=${n} ${place}`).toBe(false);
          }
          const r = rects[i]!;
          const where = place[i]!;
          if (where !== 0) {
            const pl = where === 1 ? lay.plateA : lay.plateB;
            expect(r.x, `n=${n} ${place}`).toBeGreaterThanOrEqual(pl.x);
            expect(r.x + r.s, `n=${n} ${place}`).toBeLessThanOrEqual(pl.x + pl.w);
          }
        }
      }
    }
  });
});

describe('C の盤面: 皿は1枚で、皿の中の絵の数＝a、斜線の絵の数＝b', () => {
  for (const stage of ['C1', 'C2', 'C3', 'E2'] as const) {
    it(`${stage}: 全式`, () => {
      for (const p of everyProblem(stage).filter((x) => x.item === 'banana')) {
        const ctx = `${stage} ${problemKey(p)}`;
        const lay = buildLayout(p, stage, true);
        // 皿は1枚。別の皿・別の枠はない
        expect(lay.plates, ctx).toHaveLength(1);
        const pl = lay.plates[0]!;
        const inside = (x: number) => x >= pl.x && x + lay.size <= pl.x + pl.w;
        // 皿の中の絵の数 = a（動く前も、動いたあとも皿の中）
        expect(lay.pics, ctx).toHaveLength(p.a);
        for (const pic of lay.pics) {
          expect(inside(pic.x), ctx).toBe(true);
          if (pic.eaten) expect(inside(pic.ex!), ctx).toBe(true);
        }
        // 斜線の絵の数 = b。たべた絵は右はし
        const eaten = lay.pics.filter((x) => x.eaten);
        const rest = lay.pics.filter((x) => !x.eaten);
        expect(eaten, ctx).toHaveLength(p.b);
        expect(rest, ctx).toHaveLength(p.a - p.b);
        for (const e of eaten) expect(e.ex, ctx).toBe(e.x + EAT_SHIFT);
        if (rest.length > 0 && eaten.length > 0) {
          expect(Math.min(...eaten.map((x) => x.x)), ctx).toBeGreaterThan(
            Math.max(...rest.map((x) => x.x)),
          );
        }
        // たべた絵の範囲を囲む破線: たべた絵だけを含む
        const box = lay.eatBox!;
        for (const e of eaten) {
          expect(e.ex!, ctx).toBeGreaterThanOrEqual(box.x);
          expect(e.ex! + lay.size, ctx).toBeLessThanOrEqual(box.x + box.w);
        }
        for (const r of rest) expect(r.x + lay.size, ctx).toBeLessThanOrEqual(box.x);
        // 数字: a は皿全体の下（皿の幅の中）、b はたべた絵の範囲の近く。順は a, －, b, ＝, ？
        const cell = (role: string) => lay.cells.find((c) => c.token.role === role)!;
        const mid = (c: { x: number; w: number }) => c.x + c.w / 2;
        expect(mid(cell('a')), ctx).toBeGreaterThanOrEqual(pl.x);
        expect(mid(cell('a')), ctx).toBeLessThanOrEqual(pl.x + pl.w);
        expect(Math.abs(mid(cell('b')) - (box.x + box.w / 2)), ctx).toBeLessThanOrEqual(9);
        expect(mid(cell('b')), ctx).toBeGreaterThanOrEqual(pl.x);
        expect(mid(cell('b')), ctx).toBeLessThanOrEqual(pl.x + pl.w);
        expect(
          lay.cells.map((c) => c.token.text),
          ctx,
        ).toEqual(formulaTokens(p).map((t) => t.text));
        for (let i = 1; i < lay.cells.length; i++) {
          expect(lay.cells[i]!.x, ctx).toBeGreaterThanOrEqual(
            lay.cells[i - 1]!.x + lay.cells[i - 1]!.w,
          );
        }
        expect(Math.min(...lay.cells.map((c) => c.x), pl.x), ctx).toBeGreaterThanOrEqual(0);
        expect(Math.max(...lay.cells.map((c) => c.x + c.w), pl.x + pl.w), ctx).toBeLessThanOrEqual(
          AREA_W,
        );
      }
    });

    it(`${stage}: 実際に描いた画面の絵の数と斜線の数`, () => {
      for (const p of everyProblem(stage).filter((x) => x.item === 'apple')) {
        const ctx = `${stage} ${problemKey(p)}`;
        const lay = buildLayout(p, stage, true);
        const { container, unmount } = render(
          createElement(Board, {
            layout: lay,
            item: p.item,
            eaten: true,
            moveEaten: true,
            numbers: [],
            locked: false,
            hintPlates: [],
            answer: null,
            onPic: () => {},
          }),
        );
        expect(container.querySelectorAll('[data-testid="plate-a"]'), ctx).toHaveLength(1);
        expect(container.querySelectorAll('button.math-pic'), ctx).toHaveLength(p.a);
        expect(container.querySelectorAll('button.math-pic--eaten'), ctx).toHaveLength(p.b);
        expect(container.querySelectorAll('[data-testid="eat-box"]'), ctx).toHaveLength(1);
        unmount();
      }
    });
  }
});

describe('音声台本', () => {
  it('このモードの台本は math. で始まり、共通台本と重ならない', () => {
    for (const k of Object.keys(voice)) {
      expect(k.startsWith('math.'), k).toBe(true);
      expect(k.startsWith('math.variant.'), k).toBe(false);
    }
  });
  it('子供に見える・聞こえる文は ひらがな（品物名のカタカナは可）で、数字や漢字を含まない', () => {
    for (const [k, e] of Object.entries(voice)) {
      const t = voiceText(e);
      expect(t, k).toMatch(/^[ぁ-んァ-ヶー、。？！ ]+$/);
    }
  });
  it('品物ごとの台本がある', () => {
    for (const i of MATH_ITEMS) {
      expect(VOICE_CATALOG[`math.item-ga.${i}`]).toBeDefined();
      expect(VOICE_CATALOG[`math.item-wa.${i}`]).toBeDefined();
    }
    for (let n = 1; n <= 4; n++) expect(VOICE_CATALOG[`math.ko-to.${n}`]).toBeDefined();
  });
  it('数＋助数詞はひらがな（「さんこ」）', () => {
    expect(voiceText(VOICE_CATALOG['count.ko.3']!)).toBe('さんこ');
    expect(voiceText(VOICE_CATALOG['math.ko-to.3']!)).toBe('さんこと');
  });
});
