import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems, textsOf } from '../../curriculum/qa';
import type { UnitSpec } from '../../curriculum/types';
import { kanjiGrade } from '../../text/kanji-grades';
import { parseRich, type Token } from '../../text/rich';
import pack from './index';

const GRADE = 4;
/** g3/g4 の選択肢の上限（ux-by-age: 4。多いと先頭から切られ、正解が消えることがある） */
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

/**
 * 学年より上でも使ってよい字（教科の用語で必要なもの。curriculum-matrix 2.1）。
 * 足すときは理由をコメントに書く。
 */
const ALLOWED_OVER: ReadonlySet<string> = new Set([]);

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
    for (const k of overGrade(t))
      if (!ALLOWED_OVER.has(k)) errs.push(`${GRADE}年より上の漢字「${k}」: ${t.slice(0, 30)}`);
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

/**
 * 小3以上は通常の文（curriculum-matrix 2.1）。分かち書きの残りを探す。
 * 本文（詩の行・日記の見出し）・選択肢は見ない。「」『』の中（引用・詩の引用）と、
 * 作者名の姓と名の間（「森 ゆうき」）は空白を残してよい。
 */
function wakachiLeft(units: readonly UnitSpec[]): string[] {
  const ja = /[ぁ-ヿ一-鿿々]\p{Zs}+[ぁ-ヿ一-鿿々]/u;
  const errs = new Set<string>();
  for (const unit of units) {
    if (unit.status === 'planned') continue;
    const texts = [
      unit.title,
      ...unit.intro.map((s) => s.text),
      ...unit.misconceptions.map((m) => m.explain),
      ...unit.objectives.map((o) => o.title),
    ];
    for (const it of sampleItems(unit, 50)) {
      const x = it as { prompt?: string; hints?: string[]; explain?: string };
      texts.push(x.prompt ?? '', ...(x.hints ?? []), x.explain ?? '');
    }
    for (const t of texts) {
      const p = t
        .replace(/《[^》]*》/g, '')
        .replace(/「[^「」]*」|『[^『』]*』/g, '「」')
        .replace(/[一-鿿]{1,3} [ぁ-ん]{2,4}(?=[、，）』」]|が|$)/g, '名');
      if (ja.test(p)) errs.add(`${unit.id}: ${p.slice(0, 50)}`);
    }
  }
  return [...errs];
}

describe('位置で解けない・小3以上は通常の文（content-review-g34 重大8・中-C）', () => {
  it('fixedOrder の選択肢で正解の位置がかたよらない', () => {
    const errs: string[] = [];
    for (const unit of pack.units) {
      if (unit.status === 'planned') continue;
      const pos: number[] = [];
      for (const it of sampleItems(unit, 50))
        if (
          (it.engine === 'choice' || it.engine === 'reading') &&
          'fixedOrder' in it &&
          it.fixedOrder
        )
          pos.push(it.options.findIndex((o) => o.correct));
      if (pos.length >= 3 && new Set(pos).size < 2)
        errs.push(`${unit.id}: fixedOrder の ${pos.length} 問で正解がいつも ${pos[0]! + 1} 番目`);
    }
    expect(errs).toEqual([]);
  });

  it('plain-polite-style shiki: 選択肢の並びがどの問題でも同じ（ラベル順で固定）', () => {
    const u = pack.units.find((x) => x.id === 'g4.ja.plain-polite-style');
    if (!u || u.source.kind !== 'items') throw new Error('plain-polite-style がない');
    const orders = new Set<string>();
    const pos = new Set<number>();
    for (const it of u.source.items)
      if (it.engine === 'choice' && it.id.startsWith('shiki:')) {
        orders.add(it.options.map((o) => o.label).join('|'));
        pos.add(it.options.findIndex((o) => o.correct));
      }
    expect(orders.size).toBe(1);
    expect(pos.size).toBe(2);
  });

  it('題・説明・問題文・ヒント・解説に文節分かち書き（日本語どうしの間の空白）がない', () => {
    expect(wakachiLeft(pack.units)).toEqual([]);
  });
});

describe('g4-ja の教材検査（curriculum-matrix 1.8）', () => {
  it('パックの形', () => {
    expect(pack.packId).toBe('g4-ja');
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
