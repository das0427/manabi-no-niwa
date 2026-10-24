import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems, textsOf } from '../../curriculum/qa';
import type { UnitSpec } from '../../curriculum/types';
import { kanjiGrade } from '../../text/kanji-grades';
import { parseRich, type Token } from '../../text/rich';
import pack from './index';

const GRADE = 2;
/** g1/g2 の選択肢の上限（ux-by-age: 4。多いと先頭から切られ、正解が消えることがある） */
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

function extraChecks(unit: UnitSpec): string[] {
  const errs: string[] = [];
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
    for (const k of overGrade(t)) errs.push(`${GRADE}年より上の漢字「${k}」: ${t.slice(0, 30)}`);
  for (const it of items) {
    if (
      (it.engine === 'choice' || it.engine === 'listen' || it.engine === 'reading') &&
      !it.multi &&
      it.options.length > MAX_CHOICES
    )
      errs.push(`[${it.id}] 選択肢は${MAX_CHOICES}つまで`);
  }
  return [...new Set(errs)];
}

const unitOf = (id: string) => pack.units.find((u) => u.id === id)!;
const itemsOf = (id: string) => sampleItems(unitOf(id), 5);

describe('内容レビューの修正（g2-ja）', () => {
  it('write-structure: 順序のつなぎことばを問う文は、2手順でなく 3つの手順にする（「まず…さいごに」が自然になる形を避ける）', () => {
    const fills = itemsOf('g2.ja.write-structure').filter(
      (it) => it.engine === 'fill' && it.id.startsWith('tsunagi:'),
    );
    // あさの手順と たねの手順は 3つの手順に した
    const texts = fills.map((it) => (it.engine === 'fill' ? it.text : ''));
    expect(texts.filter((t) => t.includes('さいごに、はを みがきました')).length).toBe(1);
    expect(texts.filter((t) => t.includes('さいごに、ひなたに おきます')).length).toBe(1);
  });

  it('read-info: おたまじゃくしの本文は g1 側だけ（学年をまたぐ重複をなくした）', () => {
    for (const it of itemsOf('g2.ja.read-info')) {
      expect(JSON.stringify(it), it.id).not.toContain('おたまじゃくし');
    }
    const kabuto = itemsOf('g2.ja.read-info').filter((it) => it.id.startsWith('g2i-kabuto:'));
    expect(kabuto.length).toBe(4);
  });

  it('subject-predicate: 「つよく」を述語と まちがえたら 修飾語の誤概念', () => {
    const it = itemsOf('g2.ja.subject-predicate').find((i) => i.id === 'pred:かぜがつよくふく');
    expect(it?.engine).toBe('choice');
    if (it?.engine === 'choice') {
      const strong = it.options.find((o) => o.label === 'つよく')!;
      expect(strong.misconception).toBe('modifier-as-pred');
    }
  });

  it('orthography: 同音の連呼（ちぢむ・つづく）の解説は「にごった」の言い方がちがう', () => {
    for (const w of ['ちぢむ', 'つづく', 'ちぢれる']) {
      const it = itemsOf('g2.ja.orthography').find((i) => i.id === `didu:${w}`)!;
      expect(it.explain, w).toContain('つづいて');
      expect(it.explain, w).not.toContain('もとの ことばの');
    }
    const hanaji = itemsOf('g2.ja.orthography').find((i) => i.id === 'didu:はなぢ')!;
    expect(hanaji.explain).toContain('もとの ことばの');
  });

  it('katakana-words: ひらがなの文に「ー」をまぜた形を見せない', () => {
    for (const it of itemsOf('g2.ja.katakana-words')) {
      if (it.id.startsWith('erabu-alt:') && it.engine === 'choice') {
        expect(it.prompt, it.id).not.toContain('ー');
      }
    }
  });

  it('read-story: 日記は お母さんと つり（家族の役わりに性別の決めつけがない）', () => {
    const s = JSON.stringify(itemsOf('g2.ja.read-story').filter((i) => i.id.startsWith('g2s-nikki')));
    expect(s).not.toContain('お父《とう》さんと 川');
  });
});

describe('g2-ja の教材検査（curriculum-matrix 1.8）', () => {
  it('パックの形', () => {
    expect(pack.packId).toBe('g2-ja');
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
});
