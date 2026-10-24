import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems, textsOf } from '../../curriculum/qa';
import type { Item, UnitSpec } from '../../curriculum/types';
import { createRng } from '../../core/util/rng';
import { run as engineRun } from '../../engines/program/world';
import { ILLUST } from '../../illust/registry';
import { kanjiGrade } from '../../text/kanji-grades';
import { parseRich, type Token } from '../../text/rich';
import pack from './index';
import { F, L, R, layout, run, shortest, type Cmd, type Dir } from './kit';

/** 選択肢の上限（ux-by-age: 小1〜小6 は 4。複数選択は除く） */
const MAX_CHOICES = 4;

function gradeOf(unit: UnitSpec): number {
  return Number(unit.stage.slice(1));
}

/** 文の中の、よみ付きの漢字のうち配当学年が grade より上の字 */
function overGrade(src: string, grade: number): string[] {
  const bad: string[] = [];
  const walk = (ts: Token[]) => {
    for (const t of ts) {
      if (t.t === 'ruby') for (const c of t.base) if (kanjiGrade(c) > grade) bad.push(c);
      if (t.t === 'strong') walk(t.children);
    }
  };
  walk(parseRich(src));
  return bad;
}

/** 問題の中の絵の id（figure の illust と program の character など） */
function illustIds(x: unknown, out: string[] = []): string[] {
  if (Array.isArray(x)) for (const v of x) illustIds(v, out);
  else if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    if (o.kind === 'illust' && typeof o.id === 'string') out.push(o.id);
    for (const k of ['character', 'goalIllust', 'wallIllust'])
      if (typeof o[k] === 'string') out.push(o[k] as string);
    for (const v of Object.values(o)) if (typeof v !== 'function') illustIds(v, out);
  }
  return out;
}

function extraChecks(unit: UnitSpec): string[] {
  const errs: string[] = [];
  const grade = gradeOf(unit);
  const items = sampleItems(unit, 50);
  const ids = new Set<string>();
  if (unit.source.kind === 'items')
    for (const it of unit.source.items) {
      if (ids.has(it.id)) errs.push(`id が重複: ${it.id}`);
      ids.add(it.id);
    }
  const texts = [
    unit.title,
    ...unit.intro.map((s) => s.text),
    ...unit.misconceptions.map((m) => m.explain),
    ...unit.objectives.map((o) => o.title),
    ...items.flatMap((it) => textsOf(it)),
  ];
  for (const t of texts)
    for (const k of overGrade(t, grade))
      errs.push(`${grade}年より上の漢字「${k}」: ${t.slice(0, 30)}`);
  for (const it of items) {
    if (
      (it.engine === 'choice' || it.engine === 'listen' || it.engine === 'reading') &&
      !it.multi &&
      it.options.length > MAX_CHOICES
    )
      errs.push(`[${it.id}] 選択肢は${MAX_CHOICES}つまで`);
    for (const id of illustIds(it)) if (!ILLUST[id]) errs.push(`[${it.id}] 絵 ${id} が無い`);
    // 1〜2年は分かち書き: 長い文に空白が無いのは疑う（かな 12 字以上の連続）
    if (grade <= 2)
      for (const t of textsOf(it)) {
        const plain = t.replace(/《[^》]*》/g, '');
        if (/[ぁ-んァ-ヶー]{13,}/.test(plain))
          errs.push(`[${it.id}] 分かち書きが長い: ${t.slice(0, 40)}`);
      }
  }
  return [...new Set(errs)];
}

describe('prog-g16 の教材検査（curriculum-matrix 1.8）', () => {
  it('パックの形', () => {
    expect(pack.packId).toBe('prog-g16');
    const ids = pack.units.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  for (const unit of pack.units) {
    if (unit.status === 'planned') continue;
    it(`${unit.id}: 検査の誤りなし・量と網羅`, () => {
      const r = checkUnit(unit);
      expect(r.errors).toEqual([]);
      expect(extraChecks(unit)).toEqual([]);
      if (unit.status === 'ready') expect(isReady(r)).toBe(true);
      console.info(
        `${unit.id}: Q ${r.q.toFixed(2)} (${r.distinct}) / C ${r.c[0]}/${r.c[1]} / 汎用誤答 ${(r.genericWrongShare * 100).toFixed(0)}% / 誤概念 ${unit.misconceptions.length} / ${r.objectives.map((o) => `${o.id}:${o.distinct}+${o.alt}`).join(' ')}`,
      );
    });
  }

  it('各段階に 5 問以上ある（1回分が組める）', () => {
    for (const unit of pack.units) {
      if (unit.source.kind !== 'items') continue;
      for (let level = 0; level < unit.levels.length; level++) {
        const n = unit.source.items.filter((it: Item) => it.level === level).length;
        expect(n, `${unit.id} 段階${level}`).toBeGreaterThanOrEqual(5);
      }
    }
  });
});

describe('kit: 実行はエンジンの run と同じ', () => {
  it('ランダムな手順と地図で結果が一致する', () => {
    const rng = createRng(12345);
    const dirs: Dir[] = ['up', 'right', 'down', 'left'];
    const simple: Cmd[] = [F, F, F, R, L];
    const mk = (depth: number): Cmd => {
      const r = rng.next();
      if (depth < 2 && r < 0.15)
        return {
          op: 'repeat',
          times: rng.pick([2, 3, 'goal'] as const),
          body: Array.from({ length: rng.int(1, 3) }, () => mk(depth + 1)),
        };
      if (depth < 2 && r < 0.3)
        return {
          op: 'if',
          cond: rng.pick(['wall-ahead', 'open-ahead'] as const),
          body: Array.from({ length: rng.int(1, 2) }, () => mk(depth + 1)),
        };
      return rng.pick(simple);
    };
    for (let t = 0; t < 400; t++) {
      const w = rng.int(2, 6);
      const h = rng.int(1, 5);
      const rows: string[] = [];
      for (let y = 0; y < h; y++) {
        let row = '';
        for (let x = 0; x < w; x++) row += rng.next() < 0.2 ? '#' : '.';
        rows.push(row);
      }
      // S と G を置く（別のマス）
      const cell = (n: number) => [n % w, Math.floor(n / w)] as const;
      const a = rng.int(0, w * h - 1);
      let b = rng.int(0, w * h - 1);
      if (b === a) b = (a + 1) % (w * h);
      const put = (n: number, ch: string) => {
        const [x, y] = cell(n);
        rows[y] = rows[y]!.slice(0, x) + ch + rows[y]!.slice(x + 1);
      };
      put(a, 'S');
      put(b, 'G');
      const l = layout(rows, rng.pick(dirs));
      const prog = Array.from({ length: rng.int(1, 8) }, () => mk(0));
      const mine = run(l, prog);
      const eng = engineRun(
        {
          w: l.w,
          h: l.h,
          walls: l.walls,
          start: { at: l.start, dir: l.dir },
          goal: l.goal,
        },
        prog,
      );
      expect(mine.outcome).toBe(eng.outcome);
      expect(mine.at).toEqual(eng.at);
      expect(mine.dir).toBe(eng.dir);
      expect(mine.steps).toBe(eng.steps.length);
    }
  });

  it('最短の手順はゴールに着く', () => {
    const l = layout(['S..#', '.#..', '...G'], 'right');
    const s = shortest(l);
    expect(s).not.toBeNull();
    expect(run(l, s!).outcome).toBe('goal');
  });
});
