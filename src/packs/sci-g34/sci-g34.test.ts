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
const ALLOWED_OVER: ReadonlySet<string> = new Set([
  // g4.sci.current: 「並列《へいれつ》」は4年の理科の用語（6年の字）。実験の札（エンジン）と同じ書き方にそろえる
  '並',
]);

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

describe('sci-g34 の教材検査（curriculum-matrix 1.8）', () => {
  it('パックの形', () => {
    expect(pack.packId).toBe('sci-g34');
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

  /** ふりがな・空白・記号を除いた文 */
  const plain = (t: unknown): string =>
    typeof t === 'string' ? t.replace(/《[^》]*》/g, '').replace(/[\s「」、。（）]/g, '') : '';
  const allItems = (): Item[] =>
    pack.units.flatMap((u) => (u.source.kind === 'items' ? u.source.items : []));

  it('さいごの ヒントが 正解の 選択肢を そのまま 言わない（pack-brief: どの段も答えを書かない）', () => {
    const bad: string[] = [];
    for (const it of allItems()) {
      if (it.engine !== 'choice' || it.multi) continue;
      const right = plain(it.options.find((o) => o.correct)?.label);
      if (right.length < 3) continue;
      const last = plain(it.hints[it.hints.length - 1]);
      if (last.includes(right)) bad.push(`${it.id}: ${right}`);
    }
    expect(bad).toEqual([]);
  });

  it('ヒント③で 答えを 言って いた 問題が もどって いない（内容レビュー sci-g34）', () => {
    const lastHint = (id: string) => {
      const it = allItems().find((x) => x.id === id);
      expect(it, id).toBeDefined();
      return plain(it!.hints[2]);
    };
    const leaks: [string, RegExp][] = [
      ['in-parts', /その間/],
      ['in-legs', /3本が2つ分/],
      ['gr-dragonfly', /すぐせい虫/],
      ['gr-sort-pupa', /すぐせい虫/],
      ['at-scissors', /鉄でできた/],
      ['at-sort', /鉄でできたもの/],
      ['po-reach-pull', /1つのきょくをかえ/],
      ['po-reach-push', /同じきょくにしよう/],
      ['sh-east', /東と西/],
      ['sh-north', /南と北は反対/],
      ['mv-compass', /文字ばんの北/],
      ['wm-touch', /かわく/],
      ['lp-term', /回る道と書く/],
      ['ft-sort', /はずれる・切れる・ゆるい/],
      ['st-magnitude', /小さいほど明るい/],
    ];
    for (const [id, re] of leaks) expect(lastHint(id), id).not.toMatch(re);
  });

  it('誤答の 誤概念が 選択肢の 中身と 合って いる（内容レビュー sci-g34）', () => {
    const misOf = (id: string, wrong: string) => {
      const it = allItems().find((x) => x.id === id);
      if (!it || it.engine !== 'choice') throw new Error(id);
      const o = it.options.find((x) => plain(x.label).includes(wrong));
      expect(o, `${id} ${wrong}`).toBeDefined();
      return o!.misconception;
    };
    expect(misOf('con-which-series', '＋極どうしだけ')).toBe('cur-shape');
    expect(misOf('con-which-parallel', '1こだけ')).toBe('cur-shape');
    expect(misOf('rs-short', 'なにもおきない')).toBe('cur-short');
    expect(misOf('mv-table', '南のほう')).not.toBe('sg-same-side');
    expect(misOf('me-same-place', '1かいだけ')).not.toBe('w-change-place');
    expect(misOf('gr-table', '11時')).not.toBe('w-noon-peak');
    expect(misOf('re-why-rainy', 'こわれる')).not.toBe('w-anywhere');
    // 気温の はかり方の 分類: 「地面の すぐ 上」「手で にぎる」に 日光の 説明（w-sun-direct）を 返さない
    const sortItem = allItems().find((x) => x.id === 'me-sort');
    if (!sortItem || sortItem.engine !== 'sort') throw new Error('me-sort');
    for (const c of sortItem.cards)
      if (/地面|手/.test(plain(c.label)))
        for (const w of c.wrongBoxes ?? [])
          expect(w.misconception, plain(c.label)).not.toBe('w-sun-direct');
  });

  it('正解が 2つ 成り立つ 問い方を しない: じしゃくに つく ものの きまり（金ぞく も 当てはまって しまう）', () => {
    const it = allItems().find((x) => x.id === 'at-which-kind');
    expect(plain(it?.prompt)).toMatch(/分ける/);
  });

  it('並べ替えない 選択肢（fixedOrder・あ/い の 記号だけ）で 正解が いつも 先頭に ならない', () => {
    const SYMBOL = /^[あいうえおかきくけこ①-⑳]$/;
    for (const it of allItems()) {
      if (it.engine !== 'choice') continue;
      const labels = it.options.map((o) => (typeof o.label === 'string' ? o.label : ''));
      if (labels.every((l) => SYMBOL.test(l)))
        expect(labels, it.id).toEqual([...labels].sort((a, b) => a.localeCompare(b, 'ja')));
      if (it.fixedOrder)
        expect(it.options[0]?.correct, `${it.id} は fixedOrder で 正解が 先頭`).toBeFalsy();
    }
  });

  it('火・薬品・コンセントを家で使う手順を書いていない', () => {
    for (const unit of pack.units) {
      for (const t of textsOf([unit.intro, sampleItems(unit, 5)]))
        expect(t, unit.id).not.toMatch(/コンセントに|マッチを|ライターで|火を つけて/);
    }
  });
});
