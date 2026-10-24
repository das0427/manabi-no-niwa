import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems, textsOf } from '../../curriculum/qa';
import type { UnitSpec } from '../../curriculum/types';
import { kanjiGrade } from '../../text/kanji-grades';
import { parseRich, type Token } from '../../text/rich';
import pack from './index';

const GRADE = 1;
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

describe('内容レビューの修正（g1-ja）', () => {
  it('punctuation: かぎの中の文末にも「。」を打つ形にそろっている（「おはよう。」と いいました。）', () => {
    const texts: string[] = [];
    for (const it of itemsOf('g1.ja.punctuation')) {
      if (it.engine === 'fill') {
        let t = it.text;
        for (const b of it.blanks) t = t.replace('{{}}', b.answers[0]!);
        texts.push(t);
      } else if (it.engine === 'choice') {
        texts.push(it.options.find((o) => o.correct)!.label!);
      }
    }
    const quoted = texts.filter((t) => /「[^」]*」と/.test(t));
    expect(quoted.length).toBeGreaterThanOrEqual(8);
    // 「と」に続くかぎの中は、必ず「。」か「、」などでなく、文末の「。」で終わる
    for (const t of quoted) expect(t, t).toMatch(/「[^」]*。」と/);
  });

  it('write-order: 3まいの えにっきは、ヒント②③で 順が ぜんぶは きまらない', () => {
    const items = itemsOf('g1.ja.write-order').filter(
      (it) => it.engine === 'order' && it.id.startsWith('pics'),
    );
    expect(items.length).toBeGreaterThan(8);
    for (const it of items) {
      if (it.engine !== 'order') continue;
      const labels = it.cards.map((c) => c.label ?? c.name ?? '').filter(Boolean);
      // ヒント②③に出てくる カードの名前は 1つまで（はじめの 1まいだけ）
      const text = `${it.hints[1]} ${it.hints[2]}`;
      const hit = labels.filter((l) => text.includes(l));
      expect(hit.length, it.id).toBeLessThanOrEqual(1);
    }
  });

  it('write-order: てがみの 手順は 切手を先に貼る順も 正しい', () => {
    const it = itemsOf('g1.ja.write-order').find((i) => i.id === 'cards:alt-tegami')!;
    expect(it.engine).toBe('order');
    if (it.engine === 'order') expect(it.alsoAccept).toEqual([[0, 2, 1, 3]]);
  });

  it('vocab-groups: 絵の無い「のり」を 文房具に つかわない', () => {
    for (const it of itemsOf('g1.ja.vocab-groups')) {
      const labels = JSON.stringify(it);
      expect(labels.includes('"のり"'), it.id).toBe(false);
    }
  });

  it('read-story: おむすびころりんは使わない・問題文とヒントと選択肢と解説に よみ付きの漢字が無い', () => {
    const unit = unitOf('g1.ja.read-story');
    for (const it of itemsOf('g1.ja.read-story')) {
      expect(it.id).not.toContain('omusubi');
      if (it.engine === 'reading') {
        for (const s of [it.prompt, ...it.hints, it.explain, ...it.options.map((o) => o.label ?? '')])
          expect(s, it.id).not.toContain('《');
      }
    }
    for (const s of unit.intro) expect(s.text).not.toContain('《');
    for (const m of unit.misconceptions) expect(m.explain).not.toContain('《');
  });

  it('read-info: 問題文とヒントと選択肢と解説に よみ付きの漢字が無い・実が赤くなる日は7月下旬', () => {
    const unit = unitOf('g1.ja.read-info');
    for (const it of itemsOf('g1.ja.read-info')) {
      if (it.engine === 'reading') {
        for (const s of [it.prompt, ...it.hints, it.explain, ...it.options.map((o) => o.label ?? '')])
          expect(s, it.id).not.toContain('《');
        expect(JSON.stringify(it.passage)).not.toContain('七月《しちがつ》五日');
      } else if (it.engine === 'order') {
        for (const s of [it.prompt, ...it.hints, it.explain, ...it.cards.map((c) => c.label ?? '')])
          expect(s, it.id).not.toContain('《');
      }
    }
    for (const s of unit.intro) expect(s.text).not.toContain('《');
  });

  it('sentence-build: 家事の 役わりに 性別の かたよりが ない（おとうさん＝ごはん、おかあさん＝くるま）', () => {
    const ids = itemsOf('g1.ja.sentence-build').map((i) => JSON.stringify(i)).join('');
    expect(ids).not.toContain('おかあさんが ごはんを つくる');
    expect(ids).not.toContain('おとうさんが くるまを あらう');
  });

  it('listen: かずを こたえる 問題の せんたくしは 1つ・2つ・3つ の じゅん', () => {
    for (const id of ['two-count-bring', 'two-count-do']) {
      const it = itemsOf('g1.ja.listen').find((i) => i.id === id)!;
      if (it.engine === 'listen') expect(it.options.map((o) => o.label)).toEqual(['1つ', '2つ', '3つ']);
    }
  });
});

describe('g1-ja の教材検査（curriculum-matrix 1.8）', () => {
  it('パックの形', () => {
    expect(pack.packId).toBe('g1-ja');
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
