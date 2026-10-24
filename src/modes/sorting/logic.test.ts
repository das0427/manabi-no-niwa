import { describe, expect, it } from 'vitest';
import { vocab } from '../../content/vocab';
import {
  attrOf,
  boardKey,
  correctBox,
  generateRound,
  repOf,
  stageVoice,
  type Board,
} from './logic';

const LEVELS = [0, 1, 2, 3];
const SIZES = [2, 3];

function each(fn: (b: Board, level: number, seed: number, ctx: string) => void) {
  for (const level of LEVELS) {
    for (let seed = 1; seed <= 200; seed++) {
      for (const size of SIZES) {
        const round = generateRound(level, seed, size);
        round.forEach((b, i) =>
          fn(b, level, seed, `level=${level} seed=${seed} size=${size} #${i}`),
        );
      }
    }
  }
}

describe('sorting generateRound', () => {
  it('回の盤面数を満たし、同じ盤面を繰り返さない', () => {
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 200; seed++) {
        for (const size of SIZES) {
          const round = generateRound(level, seed, size);
          const ctx = `level=${level} seed=${seed} size=${size}`;
          expect(round.length, ctx).toBe(size);
          expect(new Set(round.map(boardKey)).size, ctx).toBe(size);
        }
      }
    }
  });

  it('同じ seed なら同じ盤面', () => {
    expect(generateRound(2, 7, 3)).toEqual(generateRound(2, 7, 3));
  });

  it('箱数と絵の数: N1/N2 は 2箱4枚、N3 は 3箱6枚、N4 は 2箱4枚を2回', () => {
    each((b, level, _s, ctx) => {
      const boxes = level === 2 ? 3 : 2;
      expect(b.stages.length, ctx).toBe(level === 3 ? 2 : 1);
      for (const st of b.stages) expect(st.boxes.length, ctx).toBe(boxes);
      expect(b.pics.length, ctx).toBe(boxes * 2);
      expect(new Set(b.pics).size, ctx).toBe(b.pics.length);
    });
  });

  it('基準: N1 いろ / N2・N3 しゅるい / N4 しゅるい→いろ', () => {
    each((b, level, _s, ctx) => {
      const want = [['color'], ['kind'], ['kind'], ['kind', 'color']][level]!;
      expect(
        b.stages.map((s) => s.criterion),
        ctx,
      ).toEqual(want);
    });
  });

  it('各絵が今の基準でちょうど1つの箱に属し、各箱に2枚入る（N4 は両基準）', () => {
    each((b, _l, _s, ctx) => {
      for (const st of b.stages) {
        const count = new Map<string, number>();
        for (const p of b.pics) {
          const a = attrOf(p, st.criterion);
          expect(a, `${ctx} ${p}`).toBeDefined();
          const hits = st.boxes.filter((v) => v === a);
          expect(hits.length, `${ctx} ${p}`).toBe(1);
          expect(correctBox(st, p), `${ctx} ${p}`).toBe(a);
          count.set(a!, (count.get(a!) ?? 0) + 1);
        }
        for (const v of st.boxes) expect(count.get(v), `${ctx} ${v}`).toBe(2);
      }
    });
  });

  it('N4 は2つの基準で分け方が変わる（同じ箱の組にならない）', () => {
    each((b, level, _s, ctx) => {
      if (level !== 3) return;
      const [k, c] = b.stages as [Board['stages'][0], Board['stages'][0]];
      const groups = (st: typeof k) =>
        st.boxes
          .map((v) =>
            b.pics
              .filter((p) => correctBox(st, p) === v)
              .sort()
              .join(','),
          )
          .sort()
          .join('|');
      expect(groups(k), ctx).not.toBe(groups(c));
    });
  });

  it('色の箱の組に あか と みどり が一緒に出ない', () => {
    each((b, _l, _s, ctx) => {
      for (const st of b.stages) {
        if (st.criterion !== 'color') continue;
        const has = (c: string) => st.boxes.includes(c as never);
        expect(has('red') && has('green'), ctx).toBe(false);
      }
    });
  });

  it('素材は vocab にあり、属性を持つ絵だけ。曖昧な絵は使わない', () => {
    const noColor = ['watermelon', 'mikan'];
    const never = ['egg', 'octopus', 'ant'];
    each((b, _l, _s, ctx) => {
      for (const p of b.pics) {
        const v = vocab(p);
        expect(v.id, ctx).toBe(p);
        expect(v.category ?? v.color, ctx + ' ' + p).toBeDefined();
        expect(never.includes(p), ctx + ' ' + p).toBe(false);
        if (b.stages.some((st) => st.criterion === 'color'))
          expect(noColor.includes(p), ctx + ' ' + p).toBe(false);
      }
    });
  });
  it('箱の代表の絵は属性が一致し、盤面の絵と重ならない', () => {
    each((b, _l, _s, ctx) => {
      for (const st of b.stages) {
        for (const v of st.boxes) {
          const rep = repOf(v, b.pics);
          expect(b.pics.includes(rep), `${ctx} ${v}`).toBe(false);
          expect(attrOf(rep, st.criterion), `${ctx} ${v}`).toBe(v);
        }
      }
    });
  });

  it('箱の左右の並びと絵の順に偏りがある程度ばらける', () => {
    const firstBoxes = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      firstBoxes.add(generateRound(0, seed, 1)[0]!.stages[0]!.boxes.join());
    }
    expect(firstBoxes.size).toBe(4);
  });

  it('音声列: 基準と箱の値', () => {
    const b = generateRound(0, 1, 1)[0]!;
    const seq = stageVoice(b.stages[0]!, false);
    expect(seq[0]).toBe('sort.by-color');
    expect(seq).toContain('sort.and');
    expect(stageVoice(generateRound(3, 1, 1)[0]!.stages[1]!, true)[0]).toBe('sort.then-color');
  });
});
