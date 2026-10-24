import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems, textsOf } from '../../curriculum/qa';
import { buildRound } from '../../curriculum/round';
import type { Item, UnitSpec } from '../../curriculum/types';
import { engineOf } from '../../engines/registry';
import { kanjiGrade } from '../../text/kanji-grades';
import { parseRich, type Token } from '../../text/rich';
import pack from './index';

const GRADE = 2;
/** 小1・小2 の選択肢の上限（ux-by-age: 4。多いと先頭から切られ、正解が消えることがある） */
const MAX_CHOICES = 4;

/** 文の中の、よみ付きの漢字のうち配当学年が GRADE より上の字 */
function overGrade(src: string): string[] {
  const bad: string[] = [];
  const walk = (ts: Token[]) => {
    for (const t of ts) {
      if (t.t === 'ruby') for (const c of t.base) if (kanjiGrade(c) > GRADE) bad.push(c);
      if (t.t === 'strong') walk(t.children);
    }
  };
  walk(parseRich(src));
  return bad;
}

function choiceCount(it: Item): number | null {
  if ((it.engine === 'choice' || it.engine === 'listen' || it.engine === 'reading') && !it.multi)
    return it.options.length;
  if (it.engine === 'graph' && it.task.kind === 'choice' && !it.task.multi)
    return it.task.options.length;
  if (it.engine === 'geometry' && it.task.kind === 'pick' && !it.task.multi)
    return it.task.options.length;
  if (it.engine === 'clock' && 'options' in it.task) return it.task.options.length;
  return null;
}

function extraChecks(unit: UnitSpec): string[] {
  const errs: string[] = [];
  const items = sampleItems(unit, 100);
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
    for (const k of overGrade(t)) errs.push(`${GRADE}年より上の漢字「${k}」: ${t.slice(0, 30)}`);
  for (const it of items) {
    const n = choiceCount(it);
    if (n !== null && n > MAX_CHOICES) errs.push(`[${it.id}] 選択肢は${MAX_CHOICES}つまで`);
  }
  return [...new Set(errs)];
}

/** number の問題: 正答で正解、誤答の例で誤り（誤概念つき） */
function judgeNumberItems(items: Item[]): string[] {
  const errs: string[] = [];
  for (const it of items) {
    if (it.engine !== 'number') continue;
    const eng = engineOf(it);
    const ans = it.fields.map((f) => {
      const a = f.answer;
      return a.kind === 'fraction' ? `${a.num}/${a.den}` : String(a.value);
    });
    if (eng.judge(it, ans).result !== 'correct') errs.push(`[${it.id}] 正答が正解にならない`);
    for (const w of it.wrongAnswers ?? []) {
      const j = eng.judge(it, w.value.split('|'));
      if (j.result !== 'wrong' || j.misconception !== w.misconception)
        errs.push(`[${it.id}] 誤答 ${w.value} の判定が ${JSON.stringify(j)}`);
    }
  }
  return [...new Set(errs)].slice(0, 20);
}

describe('g2-math の教材検査（curriculum-matrix 1.8）', () => {
  it('パックの形', () => {
    expect(pack.packId).toBe('g2-math');
    const ids = pack.units.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  for (const unit of pack.units) {
    it(`${unit.id}: 検査の誤りなし・量と網羅`, () => {
      const r = checkUnit(unit);
      expect(r.errors).toEqual([]);
      expect(extraChecks(unit)).toEqual([]);
      expect(judgeNumberItems(sampleItems(unit, 60))).toEqual([]);
      if (unit.status === 'ready') expect(isReady(r)).toBe(true);
      console.info(
        `${unit.id}: Q ${r.q.toFixed(2)} (${r.distinct}) / C ${r.c[0]}/${r.c[1]} / 汎用誤答 ${(r.genericWrongShare * 100).toFixed(0)}% / 誤概念 ${unit.misconceptions.length} / ${r.objectives.map((o) => `${o.id}:${o.distinct}+${o.alt}`).join(' ')}`,
      );
    });
    it(`${unit.id}: 1回の問題が作れる（同一性キーが重ならない）`, () => {
      for (let level = 0; level < unit.levels.length; level++) {
        const items = buildRound(unit, { level, seed: 11, count: 5 });
        expect(items.length).toBe(5);
        expect(new Set(items.map((i) => i.identity)).size).toBe(items.length);
      }
    });
  }

  it('times-tables: 九九の81式がすべて出る（答えだけを判定）', () => {
    const unit = pack.units.find((u) => u.id === 'g2.math.times-tables');
    if (!unit) return;
    const keys = new Set(sampleItems(unit).map((i) => i.identity));
    for (let a = 1; a <= 9; a++)
      for (let b = 1; b <= 9; b++) expect(keys.has(`${a}x${b}`)).toBe(true);
  });
});
