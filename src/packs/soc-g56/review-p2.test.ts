/**
 * soc-g56 の P2 単元（g5.soc.information・g5.soc.environment）の内容検査
 * （設計書 docs/expansion/p2-design/soc-g56.md 3.2）。
 * - 小3以上なので分かち書きを使わない
 * - 実在の放送局・新聞社・企業・アプリ・公害の原因企業の名前を出さない
 * - 常用漢字表にない字（俣）や、言いかえた字を使わない
 * - 誤りの選択肢・札のすべてに、単元で定義した誤概念IDを付ける
 * - 事実（公害病と県、森林の割合、林業・ニュースの仕事の順）を固定する
 */
import { describe, expect, it } from 'vitest';
import { checkUnit, textsOf } from '../../curriculum/qa';
import type { Item, ReadingItem, UnitSpec } from '../../curriculum/types';
import { plainText } from '../../text/rich';
import pack from './index';

const MINE = ['g5.soc.information', 'g5.soc.environment'];

function unitOf(id: string): UnitSpec {
  const u = pack.units.find((x) => x.id === id);
  if (!u) throw new Error(`単元がない: ${id}`);
  return u;
}
const itemsOf = (u: UnitSpec): Item[] => u.source.items ?? [];
function itemOf(u: UnitSpec, id: string): Item {
  const it = itemsOf(u).find((x) => x.id === id);
  if (!it) throw new Error(`問題がない: ${u.id} ${id}`);
  return it;
}
function allTexts(u: UnitSpec): string[] {
  return [
    u.title,
    ...u.intro.map((s) => s.text),
    ...u.misconceptions.map((m) => m.explain),
    ...u.objectives.map((o) => o.title),
    ...itemsOf(u).flatMap((it) => textsOf(it)),
  ];
}
/** 選択肢（choice・reading・graph の choice）の [文, 正解か, 誤概念ID] */
function optionsOf(it: Item): { label: string; correct: boolean; mis?: string }[] {
  const os =
    it.engine === 'choice' || it.engine === 'reading'
      ? it.options
      : it.engine === 'graph' && it.task.kind === 'choice'
        ? it.task.options
        : [];
  return os.map((o) => ({
    label: plainText(o.label ?? ''),
    correct: !!o.correct,
    mis: o.misconception,
  }));
}
const rightOf = (u: UnitSpec, id: string): string =>
  optionsOf(itemOf(u, id))
    .filter((o) => o.correct)
    .map((o) => o.label)
    .join('');

/** 日本語の字（かな・漢字・ふりがなの閉じ・句読点）どうしのあいだの空白 */
const WAKACHI = /[ぁ-ゖァ-ヺー一-鿿々》、。」）][ \t]+[ぁ-ゖァ-ヺ一-鿿々「（]/;

const BANNED = [
  'NHK',
  '朝日',
  '読売',
  '毎日新聞',
  '日経',
  'チッソ',
  '昭和電工',
  '三井',
  'ヤマト',
  '佐川',
  '日本郵便',
  'LINE',
  'YouTube',
  'Google',
  'アマゾン',
  'Amazon',
  'ツイッター',
  'Twitter',
];
/** 常用漢字表にない字（俣）と、設計書で言いかえた字 */
const NOT_USED = ['俣', '駐', '稿', '療', '販', '孫', '若', '忘'];

describe('soc-g56 P2 レビュー: information・environment', () => {
  for (const id of MINE) {
    const u = unitOf(id);
    it(`${id}: 分かち書きが残っていない`, () => {
      const bad = allTexts(u).filter((t) => WAKACHI.test(t));
      expect(bad.map((t) => t.slice(0, 50))).toEqual([]);
    });
    it(`${id}: 実在の名前を出さない`, () => {
      const hits = allTexts(u).flatMap((t) =>
        BANNED.filter((w) => plainText(t).includes(w)).map((w) => `${w}: ${t.slice(0, 40)}`),
      );
      expect(hits).toEqual([]);
    });
    it(`${id}: 常用外の字・言いかえた字を使わない`, () => {
      const hits = allTexts(u).flatMap((t) =>
        NOT_USED.filter((w) => t.includes(w)).map((w) => `${w}: ${t.slice(0, 40)}`),
      );
      expect(hits).toEqual([]);
    });
    it(`${id}: 誤りの選択肢すべてに、定義のある誤概念IDが付く`, () => {
      const ids = new Set(u.misconceptions.map((m) => m.id));
      const bad = itemsOf(u).flatMap((it) =>
        optionsOf(it)
          .filter((o) => !o.correct && (!o.mis || !ids.has(o.mis)))
          .map((o) => `${it.id}: ${o.label} (${o.mis ?? 'なし'})`),
      );
      expect(bad).toEqual([]);
      const g = checkUnit(u);
      expect(g.genericWrongShare).toBe(0);
    });
    it(`${id}: ヒントに正解の文がそのまま出ない`, () => {
      const bad = itemsOf(u).flatMap((it) =>
        optionsOf(it)
          .filter((o) => o.correct && o.label.length >= 2)
          .filter((o) => it.hints.some((h) => plainText(h).includes(o.label)))
          .map((o) => `${it.id}: ${o.label}`),
      );
      expect(bad).toEqual([]);
    });
    it(`${id}: 到達項目ごとに練習6以上・別例3以上`, () => {
      const r = checkUnit(u);
      for (const o of r.objectives) {
        expect(o.distinct, `${o.id} の練習`).toBeGreaterThanOrEqual(6);
        expect(o.alt, `${o.id} の別例`).toBeGreaterThanOrEqual(3);
      }
    });
    it(`${id}: 例示データのグラフの題に「れいのデータ」`, () => {
      const graphs = itemsOf(u).filter((it) => it.engine === 'graph');
      for (const g of graphs)
        if (g.engine === 'graph')
          expect(plainText(String(g.data.title ?? '')), g.id).toContain('れいのデータ');
    });
    it(`${id}: 選択肢の文は34字以下、札は28字以下`, () => {
      const long: string[] = [];
      for (const it of itemsOf(u)) {
        if (it.engine === 'choice' || it.engine === 'reading' || it.engine === 'graph')
          for (const o of optionsOf(it)) if (o.label.length > 34) long.push(`${it.id}: ${o.label}`);
        if (it.engine === 'order')
          for (const c of it.cards)
            if (plainText(c.label ?? '').length > 28) long.push(`${it.id}: ${c.label}`);
        if (it.engine === 'sort')
          for (const c of it.cards)
            if (plainText(c.label ?? '').length > 28) long.push(`${it.id}: ${c.label}`);
        if (it.engine === 'match')
          for (const c of [...it.left, ...it.right])
            if (plainText(c.label ?? '').length > 28) long.push(`${it.id}: ${c.label}`);
      }
      expect(long).toEqual([]);
    });
  }

  it('本文の数と id', () => {
    const passIds = (id: string) =>
      [
        ...new Set(
          itemsOf(unitOf(id))
            .filter((it): it is ReadingItem => it.engine === 'reading')
            .map((it) => it.passage.id),
        ),
      ].sort();
    expect(passIds('g5.soc.information')).toEqual(
      ['inf-news', 'inf-paper', 'inf-sender', 'inf-sns', 'inf-shop', 'inf-move', 'inf-care'].sort(),
    );
    expect(passIds('g5.soc.environment')).toEqual(
      [
        'env-quake',
        'env-weather',
        'env-protect',
        'env-forest',
        'env-forestry',
        'env-pollution',
      ].sort(),
    );
  });

  describe('事実の固定', () => {
    const env = unitOf('g5.soc.environment');
    const info = unitOf('g5.soc.information');
    const passageText = (u: UnitSpec, pid: string): string => {
      const it = itemsOf(u).find(
        (x): x is ReadingItem => x.engine === 'reading' && x.passage.id === pid,
      );
      if (!it) throw new Error(`本文がない: ${pid}`);
      return it.passage.paragraphs.flat().map(plainText).join('');
    };
    it('公害病と県の組', () => {
      const m = itemOf(env, 'env-pol-alt-match');
      if (m.engine !== 'match') throw new Error('match ではない');
      const pairs = m.pairs.map(([l, r]) => [
        plainText(m.left[l]!.label!),
        plainText(m.right[r]!.label!),
      ]);
      expect(pairs).toEqual([
        ['みなまた病', '熊本県・鹿児島県'],
        ['新潟みなまた病', '新潟県'],
        ['イタイイタイ病', '富山県'],
        ['四日市ぜんそく', '三重県'],
      ]);
    });
    it('正解の固定', () => {
      expect(rightOf(env, 'env-pol-5')).toBe('富山県');
      expect(rightOf(env, 'env-for-1')).toBe('およそ3分の2');
      expect(rightOf(env, 'env-dis-2')).toBe('津波');
    });
    it('林業の仕事の順', () => {
      const o = itemOf(env, 'env-for-alt-order');
      if (o.engine !== 'order') throw new Error('order ではない');
      expect(o.cards.map((c) => plainText(c.label ?? ''))).toEqual([
        'なえ木を植える',
        '下草をかる',
        '枝打ちをする',
        '間伐をする',
      ]);
    });
    it('本文の数値', () => {
      expect(passageText(env, 'env-forest')).toContain('3分の2');
      expect(passageText(env, 'env-forestry')).toContain('50年以上');
    });
    it('ニュースができるまでの順', () => {
      const o = itemOf(info, 'inf-media-alt-order');
      if (o.engine !== 'order') throw new Error('order ではない');
      const heads = o.cards.map((c) => plainText(c.label ?? ''));
      expect(heads[0]).toMatch(/^取材/);
      expect(heads[1]).toContain('確かめる');
      expect(heads[2]).toContain('まとめる');
      expect(heads[3]).toContain('放送');
    });
  });
});
