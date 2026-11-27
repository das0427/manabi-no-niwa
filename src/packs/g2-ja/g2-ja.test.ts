import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems, textsOf } from '../../curriculum/qa';
import type { UnitSpec } from '../../curriculum/types';
import { kanjiGrade } from '../../text/kanji-grades';
import { getIllust } from '../../illust/registry';
import { parseRich, plainText, type Token } from '../../text/rich';
import { KARUTA_YOMI } from './culture';
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
    const s = JSON.stringify(
      itemsOf('g2.ja.read-story').filter((i) => i.id.startsWith('g2s-nikki')),
    );
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

describe('P2 単元（listen-notes・culture）', () => {
  const ids = ['g2.ja.listen-notes', 'g2.ja.culture'];
  const allItems = (id: string) => {
    const u = unitOf(id);
    return u.source.kind === 'items' ? u.source.items : [];
  };
  const optItems = (id: string) =>
    allItems(id).filter((it) => it.engine === 'choice' || it.engine === 'listen');
  const toHira = (s: string) =>
    s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
  /** 《よみ》を読みに直した文 */
  const yomiOnly = (s: string) => s.replace(/[^\s《》]*《([^》]*)》/g, '$1');

  for (const id of ids) {
    it(`${id}: 量と網羅（distinct 33 以上・各項目 8 と別例 3・汎用誤答 0）`, () => {
      const r = checkUnit(unitOf(id));
      expect(r.distinct).toBeGreaterThanOrEqual(33);
      expect(r.genericWrongShare).toBe(0);
      for (const o of r.objectives) {
        expect(o.distinct, `${id}/${o.id}`).toBeGreaterThanOrEqual(8);
        expect(o.alt, `${id}/${o.id}`).toBeGreaterThanOrEqual(3);
      }
    });

    it(`${id}: 誤りの選択肢に誤概念・正解の数・長さ・絵・音声`, () => {
      for (const it of optItems(id)) {
        if (it.engine !== 'choice' && it.engine !== 'listen') continue;
        const correct = it.options.filter((o) => o.correct);
        expect(correct.length, it.id).toBe(it.multi ? 2 : 1);
        if (it.multi) expect(it.id).toBe('pt-bring2');
        for (const o of it.options) {
          if (!o.correct) expect(o.misconception, `${it.id}/${o.label}`).toBeTruthy();
          if (o.label)
            expect(plainText(o.label).length, `${it.id}/${o.label}`).toBeLessThanOrEqual(16);
          if (o.figure?.kind === 'illust') expect(getIllust(o.figure.id), o.figure.id).toBeTruthy();
        }
        expect(plainText(it.prompt).length, it.id).toBeLessThanOrEqual(32);
        if (it.figure?.kind === 'illust')
          expect(getIllust(it.figure.id), it.figure.id).toBeTruthy();
        if (it.engine === 'listen') {
          const sounds = Array.isArray(it.audio) ? it.audio : [it.audio];
          for (const sd of sounds) {
            expect(sd.key, it.id).toBeUndefined();
            expect(sd.text, it.id).not.toMatch(/[A-Za-z]/);
          }
        }
      }
    });
  }

  it('culture: かるたの練習は、正解の札が よみふだの はじめの字・誤りは ちがう字', () => {
    const dakuten: Record<string, string> = { か: 'が', が: 'か', ふ: 'ぶ', ぶ: 'ふ', と: 'ど' };
    for (const it of optItems('g2.ja.culture')) {
      if (it.engine !== 'listen' || !it.id.startsWith('karuta-')) continue;
      const sound = Array.isArray(it.audio) ? it.audio[0] : it.audio;
      const text = yomiOnly(sound?.text ?? '');
      const head = toHira(text[0] ?? '');
      const sentenceWords = text.split(' ').map((x) => x[0]);
      for (const o of it.options) {
        const l = plainText(o.label ?? '');
        if (o.correct) expect(l, it.id).toBe(head);
        else expect(l, it.id).not.toBe(head);
        if (o.misconception === 'dakuten') expect(dakuten[l], it.id).toBe(head);
        if (o.misconception === 'middle-word')
          expect(sentenceWords.slice(1), `${it.id}/${l}`).toContain(l);
      }
    }
  });

  it('culture: かるたの別例の正解は よみふだの はじめの語', () => {
    const alts = optItems('g2.ja.culture').filter((it) => it.id.startsWith('karuta-alt-'));
    expect(alts.length).toBe(3);
    for (const it of alts) {
      if (it.engine !== 'choice') throw new Error(it.id);
      const ok = it.options.find((o) => o.correct)!;
      const yomi = Object.values(KARUTA_YOMI).find((y) => y.split(' ')[0] === ok.label);
      expect(yomi, it.id).toBeTruthy();
    }
  });

  it('listen-notes: ask の練習は、問いが「か。」で終わる/感想文は終わらない', () => {
    for (const it of optItems('g2.ja.listen-notes')) {
      if (it.engine !== 'listen' || !it.id.startsWith('ask-')) continue;
      for (const o of it.options) {
        const l = plainText(o.label ?? '');
        if (o.misconception === 'not-question') expect(l.endsWith('か。'), it.id).toBe(false);
        else expect(l.endsWith('か。'), `${it.id}/${l}`).toBe(true);
      }
    }
  });

  it('culture: 「ねずみの よめいり」を使わない（g1 read-story と重複させない）', () => {
    expect(JSON.stringify(allItems('g2.ja.culture'))).not.toContain('よめいり');
  });
});
