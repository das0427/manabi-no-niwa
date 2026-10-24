import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems, textsOf } from '../../curriculum/qa';
import type { Item, UnitSpec } from '../../curriculum/types';
import { kanjiGrade } from '../../text/kanji-grades';
import { parseRich, plainText, type Token } from '../../text/rich';
import pack, { ALLOW } from './index';

/** 小3〜小6 の選択肢の上限（ux-by-age: 4。多いと先頭から切られ、正解が消えることがある） */
const MAX_CHOICES = 4;

/** よみ付きの漢字のうち、配当学年が grade より上の字 */
function overGrade(src: string, grade: number): string[] {
  const bad: string[] = [];
  const walk = (ts: Token[]) => {
    for (const t of ts) {
      if (t.t === 'ruby')
        for (const c of t.base) if (c !== '々' && kanjiGrade(c) > grade) bad.push(c);
      if (t.t === 'strong') walk(t.children);
    }
  };
  walk(parseRich(src));
  return bad;
}

const gradeOf = (u: UnitSpec) => Number(u.stage.slice(1));

/** 選択肢の数（1つ選ぶ問題だけ） */
function choiceCount(it: Item): number {
  if ((it.engine === 'choice' || it.engine === 'reading' || it.engine === 'listen') && !it.multi)
    return it.options.length;
  if (it.engine === 'graph' && it.task.kind === 'choice' && !it.task.multi)
    return it.task.options.length;
  if (it.engine === 'map' && (it.task.kind === 'name' || it.task.kind === 'symbol'))
    return it.task.options.length;
  return 0;
}

/** 正解の選択肢の文（ヒントに答えが出ていないかを見る） */
function rightLabels(it: Item): string[] {
  const os =
    it.engine === 'choice' || it.engine === 'reading'
      ? it.options
      : it.engine === 'graph' && it.task.kind === 'choice'
        ? it.task.options
        : [];
  return os.filter((o) => o.correct && o.label).map((o) => plainText(o.label!));
}

function extraChecks(unit: UnitSpec): string[] {
  const errs: string[] = [];
  const grade = gradeOf(unit);
  const allow = ALLOW[unit.id] ?? {};
  const items = sampleItems(unit, 50);
  const ids = new Set<string>();
  for (const it of unit.source.items ?? []) {
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
      if (!(k in allow)) errs.push(`${grade}年より上の漢字「${k}」: ${t.slice(0, 40)}`);
  for (const it of items) {
    const n = choiceCount(it);
    if (n > MAX_CHOICES) errs.push(`[${it.id}] 選択肢は${MAX_CHOICES}つまで（今 ${n}）`);
    for (const r of rightLabels(it))
      if (r.length >= 3 && it.hints.some((h) => plainText(h).includes(r)))
        errs.push(`[${it.id}] ヒントに答え「${r}」が出ている`);
  }
  return [...new Set(errs)];
}

describe('soc-g34 の教材検査（curriculum-matrix 1.8）', () => {
  it('パックの形', () => {
    expect(pack.packId).toBe('soc-g34');
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
        `${unit.id}: ${unit.status} Q ${r.q.toFixed(2)} (${r.distinct}) / C ${r.c[0]}/${r.c[1]} / 汎用誤答 ${(r.genericWrongShare * 100).toFixed(0)}% / 誤概念 ${unit.misconceptions.length} / ${r.objectives.map((o) => `${o.id}:${o.distinct}+${o.alt}`).join(' ')}`,
      );
    });
  }
});
