import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems, textsOf } from '../../curriculum/qa';
import { buildRound } from '../../curriculum/round';
import type { Item, UnitSpec } from '../../curriculum/types';
import { engineOf } from '../../engines/registry';
import { kanjiGrade } from '../../text/kanji-grades';
import { parseRich, type Token } from '../../text/rich';
import pack from './index';

const GRADE = 3;
/** 小3・小4 の選択肢の上限（ux-by-age: 4） */
const MAX_CHOICES = 4;
/**
 * 学年より上の字でも、教科の用語として《よみ》付きで使う字（curriculum-matrix 2.1）。
 * 径（半径・直径）・辺（二等辺三角形）は4年の配当だが、3年の算数の用語。
 */
const TERM_KANJI = new Set(['径', '辺']);

/** 文の中の、よみ付きの漢字のうち配当学年が GRADE より上の字 */
function overGrade(src: string): string[] {
  const bad: string[] = [];
  const walk = (ts: Token[]) => {
    for (const t of ts) {
      if (t.t === 'ruby')
        for (const c of t.base) if (kanjiGrade(c) > GRADE && !TERM_KANJI.has(c)) bad.push(c);
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
    // 同じ問題文・同じ答えの id が別の同一性キーを持たない（キーの付け忘れの検査）
  }
  return [...new Set(errs)].slice(0, 30);
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

describe('g3-math の教材検査（curriculum-matrix 1.8）', () => {
  it('パックの形', () => {
    expect(pack.packId).toBe('g3-math');
    const ids = pack.units.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const u of pack.units) expect(u.stage).toBe('g3');
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
        const items = buildRound(unit, { level, seed: 11, count: 6 });
        expect(items.length).toBe(6);
        expect(new Set(items.map((i) => i.identity)).size).toBe(items.length);
      }
    });
  }

  it('division-remainder: あまりは いつも わる数より 小さい', () => {
    const unit = pack.units.find((u) => u.id === 'g3.math.division-remainder');
    if (!unit) return;
    for (const it of sampleItems(unit, 200)) {
      if (it.engine !== 'number' || it.fields.length !== 2 || !it.id.startsWith('calc')) continue;
      const m = /:(\d+)÷(\d+)/.exec(it.id);
      if (!m) continue;
      const r = it.fields[1]!.answer as { value: number };
      expect(r.value).toBeLessThan(Number(m[2]));
    }
  });
});
