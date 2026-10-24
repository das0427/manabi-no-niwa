import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems, textsOf } from '../../curriculum/qa';
import { buildRound } from '../../curriculum/round';
import type { Item, UnitSpec } from '../../curriculum/types';
import { engineOf } from '../../engines/registry';
import { kanjiGrade } from '../../text/kanji-grades';
import { parseRich, type Token } from '../../text/rich';
import pack from './index';

const GRADE = 6;
/** 小5・小6 の選択肢の上限（ux-by-age: 4） */
const MAX_CHOICES = 4;
/**
 * 小学校の配当にない字でも、算数の用語として《よみ》付きで使う字（curriculum-matrix 2.1 の「教科の用語」）。
 * 対称（称）・対称の軸（軸）・最頻値（頻）・偶数／奇数（偶・奇。5年の用語）。
 */
const TERM_OK = new Set(['称', '軸', '頻', '偶', '奇']);

function overGrade(src: string): string[] {
  const bad: string[] = [];
  const walk = (ts: Token[]) => {
    for (const t of ts) {
      if (t.t === 'ruby')
        for (const c of t.base) if (kanjiGrade(c) > GRADE && !TERM_OK.has(c)) bad.push(c);
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
  if (it.engine === 'fill') return it.options.length > 6 ? it.options.length : null;
  return null;
}

function extraChecks(unit: UnitSpec): string[] {
  const errs: string[] = [];
  const items = sampleItems(unit, 100);
  const ids = new Map<string, string>();
  for (const it of items) {
    // 同じ id は同じ問題（同じ同一性キー）であること
    const prev = ids.get(it.id);
    if (prev !== undefined && prev !== it.identity) errs.push(`id が別の問題と重複: ${it.id}`);
    ids.set(it.id, it.identity);
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
    if (n !== null && n < 2) errs.push(`[${it.id}] 選択肢が2つ未満`);
    // 図の SVG に漢字・かなを書かない（読み上げ・ふりがなが付かないため）
    for (const m of JSON.stringify(it).matchAll(/<text[^>]*>([^<]*)<\/text>/g))
      if (/[ぁ-ゖァ-ヺ一-鿿]/.test(m[1]!)) errs.push(`[${it.id}] SVG の文字にかな・漢字: ${m[1]}`);
  }
  return [...new Set(errs)].slice(0, 30);
}

const ansText = (a: { kind: string; value?: number; num?: number; den?: number }) =>
  a.kind === 'fraction' ? `${a.num}/${a.den}` : String(a.value);

/** number・graph(number) の問題: 正答で正解、誤答の例で誤り（誤概念つき） */
function judgeNumberItems(items: Item[]): string[] {
  const errs: string[] = [];
  for (const it of items) {
    if (it.engine === 'number') {
      const eng = engineOf(it);
      const ans = it.fields.map((f) => ansText(f.answer));
      if (eng.judge(it, ans).result !== 'correct') errs.push(`[${it.id}] 正答が正解にならない`);
      for (const w of it.wrongAnswers ?? []) {
        const j = eng.judge(it, w.value.split('|'));
        if (j.result !== 'wrong' || j.misconception !== w.misconception)
          errs.push(`[${it.id}] 誤答 ${w.value} の判定が ${JSON.stringify(j)}`);
      }
    }
    if (it.engine === 'graph' && it.task.kind === 'number') {
      const eng = engineOf(it);
      const ans = it.task.fields.map((f) => ansText(f.answer));
      if (eng.judge(it, { fields: ans }).result !== 'correct')
        errs.push(`[${it.id}] 正答が正解にならない`);
      for (const w of it.task.wrongAnswers ?? []) {
        const j = eng.judge(it, { fields: w.value.split('|') });
        if (j.result !== 'wrong' || j.misconception !== w.misconception)
          errs.push(`[${it.id}] 誤答 ${w.value} の判定が ${JSON.stringify(j)}`);
      }
    }
  }
  return [...new Set(errs)].slice(0, 20);
}

describe('g6-math の教材検査（curriculum-matrix 1.8）', () => {
  it('パックの形', () => {
    expect(pack.packId).toBe('g6-math');
    const ids = pack.units.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const u of pack.units) expect(u.stage).toBe('g6');
  });
  for (const unit of pack.units) {
    it(`${unit.id}: 検査の誤りなし・量と網羅`, () => {
      const r = checkUnit(unit);
      expect(r.errors).toEqual([]);
      expect(extraChecks(unit)).toEqual([]);
      expect(judgeNumberItems(sampleItems(unit, 80))).toEqual([]);
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
});
