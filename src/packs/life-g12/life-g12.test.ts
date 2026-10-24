import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems, textsOf } from '../../curriculum/qa';
import type { Item, UnitSpec } from '../../curriculum/types';
import { lifeG12Illust } from '../../illust/content/life-g12';
import { ILLUST } from '../../illust/registry';

const hasIllust = (id: string) => id in ILLUST || id in lifeG12Illust;
import { kanjiGrade } from '../../text/kanji-grades';
import { parseRich, type Token } from '../../text/rich';
import pack from './index';

/** 選択肢の上限（ux-by-age: 小1・小2 は 4。複数選択は除く） */
const MAX_CHOICES = 4;

const gradeOf = (unit: UnitSpec): number => Number(unit.stage.slice(1));

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

/** 問題の中の絵の id */
function illustIds(x: unknown, out: string[] = []): string[] {
  if (Array.isArray(x)) for (const v of x) illustIds(v, out);
  else if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    if (o.kind === 'illust' && typeof o.id === 'string') out.push(o.id);
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
    for (const k of overGrade(t, grade)) errs.push(`${grade}年より上の漢字「${k}」: ${t.slice(0, 30)}`);
  for (const it of items) {
    if (
      (it.engine === 'choice' || it.engine === 'listen' || it.engine === 'reading') &&
      !it.multi &&
      it.options.length > MAX_CHOICES
    )
      errs.push(`[${it.id}] 選択肢は${MAX_CHOICES}つまで`);
    for (const id of illustIds(it)) if (!hasIllust(id)) errs.push(`[${it.id}] 絵 ${id} が無い`);
    // 1〜2年は分かち書き: かなが 13 字以上つづく文は疑う
    for (const t of textsOf(it)) {
      const plain = t.replace(/《[^》]*》/g, '');
      if (/[ぁ-んァ-ヶー]{13,}/.test(plain)) errs.push(`[${it.id}] 分かち書きが長い: ${t.slice(0, 40)}`);
    }
  }
  for (const s of unit.intro)
    if (s.figure) for (const id of illustIds(s.figure)) if (!hasIllust(id)) errs.push(`おてほん 絵 ${id} が無い`);
  return [...new Set(errs)];
}

describe('life-g12 の教材検査（curriculum-matrix 1.8）', () => {
  it('パックの形', () => {
    expect(pack.packId).toBe('life-g12');
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

  it('採点しない記録（explain）には正誤の言い方が無い', () => {
    for (const unit of pack.units) {
      if (unit.source.kind !== 'items') continue;
      for (const it of unit.source.items) {
        if (it.engine !== 'explain') continue;
        expect(it.explain, `${unit.id} ${it.id}`).not.toMatch(/せいかい|まちがい|ただしい/);
      }
    }
  });
});
