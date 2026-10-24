import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems, textsOf } from '../../curriculum/qa';
import type { Item, UnitSpec } from '../../curriculum/types';
import { ILLUST } from '../../illust/registry';
import { kanjiGrade } from '../../text/kanji-grades';
import { parseRich, type Token } from '../../text/rich';
import pack from './index';

/** 小3〜小6 の選択肢の上限（ux-by-age: 4。複数選択は除く） */
const MAX_CHOICES = 4;

/**
 * 単元の学年より上でも使ってよい字（理科の用語で必要なもの。curriculum-matrix 2.1）。
 * 足すときは理由をコメントに書く。
 */
const ALLOWED_OVER: ReadonlySet<string> = new Set([]);

const gradeOf = (unit: UnitSpec): number => Number(unit.stage.slice(1));

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
    for (const k of overGrade(t, grade))
      if (!ALLOWED_OVER.has(k)) errs.push(`${grade}年より上の漢字「${k}」: ${t.slice(0, 30)}`);
  for (const it of items) {
    const opts =
      it.engine === 'choice' && !it.multi
        ? it.options
        : it.engine === 'experiment' && it.task.kind === 'consider' && !it.task.multi
          ? it.task.options
          : [];
    if (opts.length > MAX_CHOICES) errs.push(`[${it.id}] 選択肢は${MAX_CHOICES}つまで`);
    for (const id of illustIds(it)) if (!(id in ILLUST)) errs.push(`[${it.id}] 絵 ${id} が無い`);
  }
  for (const s of unit.intro)
    if (s.figure)
      for (const id of illustIds(s.figure))
        if (!(id in ILLUST)) errs.push(`おてほん 絵 ${id} が無い`);
  return [...new Set(errs)];
}

describe('sci-g56 の教材検査（curriculum-matrix 1.8）', () => {
  it('パックの形', () => {
    expect(pack.packId).toBe('sci-g56');
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
      if (unit.source.kind !== 'items' || unit.status === 'planned') continue;
      for (let level = 0; level < unit.levels.length; level++) {
        const n = unit.source.items.filter((it: Item) => it.level === level).length;
        expect(n, `${unit.id} 段階${level}`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('おてほんで、ほんものの かんさつ・じっけんを すすめている', () => {
    for (const unit of pack.units) {
      if (unit.status === 'planned') continue;
      const intro = unit.intro.map((s) => s.text).join(' ');
      expect(intro, unit.id).toMatch(/たしかめて|かんさつして|しらべて/);
    }
  });

  it('ヒント③が 正解の 選択肢の 文を そのまま 言わない（6字以上の 正解）', () => {
    const plain = (s: unknown) =>
      String(s)
        .replace(/《[^》]*》/g, '')
        .replace(/\s+/g, '');
    for (const unit of pack.units) {
      if (unit.source.kind !== 'items') continue;
      for (const it of unit.source.items) {
        const opts =
          it.engine === 'choice'
            ? it.options
            : it.engine === 'experiment' && it.task.kind === 'consider'
              ? it.task.options
              : [];
        const h3 = plain(it.hints[2]);
        for (const o of opts)
          if (o.correct && plain(o.label).length >= 6)
            expect(h3, `${unit.id} ${it.id}`).not.toContain(plain(o.label));
      }
    }
  });

  it('レビューで 直した 誤概念の 付け方・ヒント（再発防止）', () => {
    const item = (unitId: string, id: string): Item => {
      const unit = pack.units.find((u) => u.id === unitId)!;
      if (unit.source.kind !== 'items') throw new Error(unitId);
      const it = unit.source.items.find((x) => x.id === id);
      if (!it) throw new Error(`${unitId} ${id}`);
      return it;
    };
    const misOf = (unitId: string, id: string, label: string) => {
      const it = item(unitId, id);
      if (it.engine !== 'choice') throw new Error(id);
      return it.options.find((o) => String(o.label).includes(label))?.misconception;
    };
    // 「酸素は火を消す」に 二酸化炭素の 説明を 付けない
    expect(misOf('g6.sci.combustion', 'gs-o2-itself', '火《ひ》を 消《け》す')).toBe(
      'cb-oxygen-role',
    );
    expect(misOf('g6.sci.combustion', 'fl-why-out', '暗《くら》く')).toBe('cb-flow-none');
    expect(misOf('g5.sci.dissolve', 'am-left', 'もっと 入《い》れる')).toBe('dis-no-limit');
    expect(misOf('g5.sci.dissolve', 'am-salt-temp', '少《すく》ない')).toBe('dis-temp-reverse');
    expect(misOf('g5.sci.germination', 'cd-sun', 'どちらも 発芽《はつが》しない')).toBe(
      'ger-cond-three',
    );
    expect(misOf('g5.sci.germination', 'sd-why-cotton', '土《つち》では')).toBe('ger-cond-three');
    // 仕分け: 酸素を「ない」に 入れたら 酸素の はたらきの 説明、ちっ素・二酸化炭素は 両方を 説明する 誤概念
    const gs = item('g6.sci.combustion', 'gs-alt-sort');
    if (gs.engine !== 'sort') throw new Error('gs-alt-sort');
    expect(gs.cards[0]!.wrongBoxes?.[0]?.misconception).toBe('cb-oxygen-role');
    const comb = pack.units.find((u) => u.id === 'g6.sci.combustion')!;
    expect(comb.misconceptions.find((m) => m.id === 'cb-co2-burns')!.explain).toMatch(/ちっ素/);
    const cd = item('g5.sci.germination', 'cd-alt-sort');
    if (cd.engine !== 'sort') throw new Error('cd-alt-sort');
    for (const c of cd.cards)
      for (const w of c.wrongBoxes ?? []) expect(w.misconception).toBe('ger-cond-three');
    // ヒント③で 答えの 道具を 名指ししない
    expect(String(item('g6.sci.combustion', 'gs-checker').hints[2])).not.toMatch(/管/);
    expect(String(item('g6.sci.electricity-use', 'cv-heat').hints[2])).not.toMatch(/アイロン|しわ/);
  });

  it('火・薬品・コンセントを家で使う手順を書いていない', () => {
    for (const unit of pack.units) {
      for (const t of textsOf([unit.intro, sampleItems(unit, 5)]))
        expect(t, unit.id).not.toMatch(/コンセントに|マッチを|ライターで|火を つけて/);
    }
  });
});
