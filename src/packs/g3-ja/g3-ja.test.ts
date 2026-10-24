import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems, textsOf } from '../../curriculum/qa';
import type { UnitSpec } from '../../curriculum/types';
import { kanjiGrade } from '../../text/kanji-grades';
import { parseRich, type Token } from '../../text/rich';
import pack from './index';

const GRADE = 3;
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
const ALLOWED_OVER: ReadonlySet<string> = new Set([
  // g3.ja.kanji-parts: 部首の形（配当表に無い字）。部品のタイル・図としてだけ使い、名前のよみを付ける
  '氵', // さんずい（海・洋）
  '亻', // にんべん（休・体・住）
  '艹', // くさかんむり（花）
  '彳', // ぎょうにんべん（にんべんと取り違える誤りの部品）
  '禾', // のぎへん（秋）
  // g3.ja.kanji-parts: 6年の字だが、村（木＋寸）の部品として要る（matrix 451 の問題例）
  '寸',
]);

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

/** 単元の items（items 形式の単元だけ） */
function itemsOf(unitId: string) {
  const u = pack.units.find((x) => x.id === unitId);
  if (!u || u.source.kind !== 'items') throw new Error(`items の単元がない: ${unitId}`);
  return u.source.items;
}

/** ふりがな《》を除いた地の文 */
const plain = (s: string) => s.replace(/《[^》]*》/g, '').replace(/\s+/g, '');

/**
 * 正解の位置が並べ替えられない選択肢（fixedOrder）で、正解が一つの位置にかたよらないこと
 * （位置で解けてしまう問題を防ぐ。content-review-g34 重大8・中-A）
 */
function fixedOrderBias(units: typeof pack.units): string[] {
  const errs: string[] = [];
  for (const unit of units) {
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
      errs.push(`${unit.id}: fixedOrder の ${pos.length} 問で正解がいつも ${pos[0] + 1} 番目`);
  }
  return errs;
}

/**
 * 小3以上は通常の文（curriculum-matrix 2.1）。分かち書きの残りを探す。
 * 本文（詩の行・日記の見出し）・選択肢は見ない（ローマ字の2語の句は語の区切りに合わせて空白を残す）。
 * 「」『』の中（引用）は空白を残してよい。
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
      const p = t.replace(/《[^》]*》/g, '').replace(/「[^「」]*」|『[^『』]*』/g, '「」');
      if (ja.test(p)) errs.add(`${unit.id}: ${p.slice(0, 50)}`);
    }
  }
  return [...errs];
}

describe('誤概念の説明と誤答の位置関係（content-review-g34 重大5・6）', () => {
  it('fixedOrder の選択肢で正解の位置がかたよらない', () => {
    expect(fixedOrderBias(pack.units)).toEqual([]);
  });

  it('modifiers: m-before は前の語、m-near はすぐ後ろの語、m-far は正解より後ろの語', () => {
    const errs: string[] = [];
    let n = 0;
    const check = (
      id: string,
      text: string,
      mod: string,
      ans: string,
      wrong: string,
      m?: string,
    ) => {
      const t = plain(text);
      const [im, ia, iw] = [plain(mod), plain(ans), plain(wrong)].map((s) => t.indexOf(s));
      if (im < 0 || ia < 0 || iw < 0) return errs.push(`[${id}] 文の中に語がない: ${wrong}`);
      if (m === 'm-before' && !(iw < im)) errs.push(`[${id}] m-before なのに後ろの語: ${wrong}`);
      if (m === 'm-near' && iw !== im + plain(mod).length)
        errs.push(`[${id}] m-near なのにすぐ後ろでない: ${wrong}`);
      if (m === 'm-far' && !(iw > ia))
        errs.push(`[${id}] m-far なのに正解より後ろでない: ${wrong}`);
      if (m === 'm-near' || m === 'm-before' || m === 'm-far') n++;
    };
    for (const it of itemsOf('g3.ja.modifiers')) {
      if (it.engine === 'choice' && it.id.startsWith('target:') && it.figure?.kind === 'text') {
        const mod = /「(.+?)」が/.exec(plain(it.prompt))?.[1] ?? '';
        const ans = it.options.find((o) => o.correct)?.label ?? '';
        for (const o of it.options)
          if (!o.correct) check(it.id, it.figure.text, mod, ans, o.label ?? '', o.misconception);
      }
      if (it.engine === 'match' && it.figure?.kind === 'text')
        for (const w of it.wrongPairs ?? []) {
          const [l, r] = w.pair;
          const right = it.pairs.find(([pl]) => pl === l)?.[1] ?? -1;
          check(
            it.id,
            it.figure.text,
            it.left[l].label ?? '',
            it.right[right]?.label ?? '',
            it.right[r].label ?? '',
            w.misconception,
          );
        }
    }
    expect(errs).toEqual([]);
    expect(n).toBeGreaterThan(5);
  });

  it('reference-connectives: ペア取り違えの誤概念は、正解と誤答がそのペアのときだけ', () => {
    const PAIRS: Record<string, string[]> = {
      'rc-jun-gyaku': ['だから', 'しかし'],
      'rc-tenka-sentaku': ['そのうえ', 'それとも'],
      'rc-matome-rei': ['つまり', 'たとえば'],
    };
    const WORDS = new Set(Object.values(PAIRS).flat().concat(['すると', 'そして']));
    const errs: string[] = [];
    const check = (id: string, ans: string, wrong: string, m?: string) => {
      const pair = m ? PAIRS[m] : undefined;
      if (!pair || !WORDS.has(wrong)) return;
      if (!pair.includes(ans) || !pair.includes(wrong))
        errs.push(`[${id}] ${m} だが正解「${ans}」誤答「${wrong}」`);
    };
    for (const it of itemsOf('g3.ja.reference-connectives')) {
      if (it.engine === 'fill')
        for (const b of it.blanks)
          for (const w of b.wrong ?? []) check(it.id, b.answers[0], w.value, w.misconception);
      if (it.engine === 'choice' || it.engine === 'reading') {
        const ans = it.options.find((o) => o.correct)?.label ?? '';
        for (const o of it.options)
          if (!o.correct) check(it.id, ans, o.label ?? '', o.misconception);
      }
    }
    expect(errs).toEqual([]);
  });

  it('小3以上は通常の文: 日本語どうしの間の空白（文節分かち書き）がほとんどない', () => {
    expect(wakachiLeft(pack.units)).toEqual([]);
  });

  it('write-reasons riyuu-match:anzen: 誤答の理由が「速い」でない（正解が2つにならない）', () => {
    const it = itemsOf('g3.ja.write-reasons').find((x) => x.id === 'riyuu-match:anzen');
    expect(it).toBeDefined();
    expect(JSON.stringify(it)).not.toContain('速《はや》い');
  });
});

describe('g3-ja の教材検査（curriculum-matrix 1.8）', () => {
  it('パックの形', () => {
    expect(pack.packId).toBe('g3-ja');
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
