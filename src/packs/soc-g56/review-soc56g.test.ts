/**
 * soc-g56 の内容レビュー（担当 soc56g: land・food・industry・world）で見つけた誤りの再発を防ぐ検査。
 * - 小3以上なので分かち書き（日本語の字と字のあいだの空白）を使わない（pack-brief: 分かち書きは小1・小2だけ）
 * - 実在の企業名・商品名（品種のブランド名をふくむ）を出さない
 * - 領土の扱い（学習指導要領の内容の取扱い）: 北方領土・竹島・尖閣諸島は固有の領土。
 *   北方領土はロシア、竹島は韓国に占拠。尖閣諸島は有効に支配し、解決すべき領有の問題はない（占拠とは書かない）
 * - 日本の東西南北のはしの島
 * - 誤答の誤概念ID は、その誤りに合う説明のものを付ける（付け違いの再発）
 */
import { describe, expect, it } from 'vitest';
import { textsOf } from '../../curriculum/qa';
import type { Item, UnitSpec } from '../../curriculum/types';
import { plainText } from '../../text/rich';
import pack from './index';

const MINE = ['g5.soc.land', 'g5.soc.food', 'g5.soc.industry', 'g6.soc.world'];

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

/** 日本語の字（かな・漢字・ふりがなの閉じ・句読点）どうしのあいだの空白 */
const WAKACHI = /[ぁ-ゖァ-ヺー一-鿿々》、。」）][ \t]+[ぁ-ゖァ-ヺ一-鿿々「（]/;

const BANNED = [
  'トヨタ',
  'ホンダ',
  '日産',
  'スバル',
  'マツダ',
  'スズキ',
  'ソニー',
  'パナソニック',
  '日立',
  '東芝',
  '三菱',
  'シャープ',
  '日本製鉄',
  'コシヒカリ',
  'あきたこまち',
  'ひとめぼれ',
  'ゆめぴりか',
  'つや姫',
  'プリウス',
  'セブン',
  'イオン',
];

describe('soc56g レビュー: land・food・industry・world', () => {
  for (const id of MINE) {
    const u = unitOf(id);
    it(`${id}: 分かち書きが残っていない`, () => {
      const bad = allTexts(u).filter((t) => WAKACHI.test(t));
      expect(bad.map((t) => t.slice(0, 50))).toEqual([]);
    });
    it(`${id}: 実在の企業名・商品名を出さない`, () => {
      const hits = allTexts(u).flatMap((t) =>
        BANNED.filter((w) => plainText(t).includes(w)).map((w) => `${w}: ${t.slice(0, 40)}`),
      );
      expect(hits).toEqual([]);
    });
    it(`${id}: 誤答の誤概念ID は単元に定義がある`, () => {
      const ids = new Set(u.misconceptions.map((m) => m.id));
      const missing = itemsOf(u).flatMap((it) =>
        optionsOf(it)
          .filter((o) => o.mis && !ids.has(o.mis))
          .map((o) => `${it.id}: ${o.mis}`),
      );
      expect(missing).toEqual([]);
    });
    it(`${id}: ヒント③に正解の文がそのまま出ない`, () => {
      const bad = itemsOf(u).flatMap((it) =>
        optionsOf(it)
          .filter((o) => o.correct && o.label.length >= 2)
          .filter((o) => plainText(it.hints[2] ?? '').includes(o.label))
          .map((o) => `${it.id}: ${o.label}`),
      );
      expect(bad).toEqual([]);
    });
  }

  describe('領土（学習指導要領の内容の取扱い）', () => {
    const land = unitOf('g5.soc.land');
    it('intro で3つとも固有の領土と書く', () => {
      const t = land.intro.map((s) => plainText(s.text)).join('');
      for (const w of ['北方領土', '竹島', '尖閣諸島', '固有の領土']) expect(t).toContain(w);
    });
    it('尖閣諸島を「占拠」と結びつけない（同じ文に書かない）', () => {
      const bad = allTexts(land)
        .flatMap((t) => plainText(t).split('。'))
        .filter((s) => s.includes('尖閣') && s.includes('占拠'));
      expect(bad).toEqual([]);
    });
    it('正解の組み合わせ（北方領土=ロシア、竹島=韓国、尖閣=問題はない）', () => {
      const right = (id: string) =>
        optionsOf(itemOf(land, id))
          .filter((o) => o.correct)
          .map((o) => o.label)
          .join('');
      expect(right('ter-hoppo-now')).toContain('ロシア');
      expect(right('ter-takeshima-now')).toContain('韓国');
      expect(right('ter-senkaku-now')).toContain('有効に支配');
      expect(right('ter-senkaku-now')).toContain('問題はない');
      expect(right('ter-takeshima-pref')).toBe('島根県');
      expect(right('ter-senkaku-pref')).toBe('沖縄県');
    });
    it('東西南北のはしの島', () => {
      const m = itemOf(land, 'pos-alt-match-edges');
      if (m.engine !== 'match') throw new Error('match ではない');
      const pairs = m.pairs.map(([l, r]) => [
        plainText(m.left[l]!.label!),
        plainText(m.right[r]!.label!),
      ]);
      expect(pairs).toEqual([
        ['北のはし', '択捉島'],
        ['南のはし', '沖ノ鳥島'],
        ['東のはし', '南鳥島'],
        ['西のはし', '与那国島'],
      ]);
      const north = optionsOf(itemOf(land, 'pos-north-edge')).find((o) => o.correct);
      expect(north?.label).toBe('択捉島');
      const south = optionsOf(itemOf(land, 'pos-south-edge')).find((o) => o.correct);
      expect(south?.label).toBe('沖ノ鳥島');
    });
  });

  describe('直した誤りの再発', () => {
    it('food rice-alt-fill: 「水が豊か」の誤答に、正答にも読める「雪」を使わない', () => {
      const it0 = itemOf(unitOf('g5.soc.food'), 'rice-alt-fill');
      if (it0.engine !== 'fill') throw new Error('fill ではない');
      expect(it0.options.map((o) => plainText(o))).not.toContain('雪');
    });
    it('land: 地形の「いちばん」の誤答は地形の場所の誤概念（川の特色・地形の名前ではない）', () => {
      const land = unitOf('g5.soc.land');
      for (const id of ['ter-longest', 'ter-alps', 'ter-plain-largest', 'ter-island-main'])
        for (const o of optionsOf(itemOf(land, id)).filter((x) => !x.correct))
          expect(o.mis, id).toBe('terrain-place');
      for (const id of ['ter-meaning', 'ter-okinotori'])
        for (const o of optionsOf(itemOf(land, id)).filter((x) => !x.correct))
          expect(o.mis, id).toBe('territory-meaning');
    });
    it('land ter-alt-map-takeshima: 「日本海がわの2つの県」と言わない（山口県も日本海に面する）', () => {
      const it0 = itemOf(unitOf('g5.soc.land'), 'ter-alt-map-takeshima');
      expect(it0.hints.map((h) => plainText(h)).join('')).not.toContain('日本海がわの2つ');
    });
    it('industry trade-small: 中小工場の誤答に輸出入の誤概念を付けない', () => {
      for (const o of optionsOf(itemOf(unitOf('g5.soc.industry'), 'trade-small')).filter(
        (x) => !x.correct,
      ))
        expect(o.mis).toBe('small-factory');
    });
    it('food: 自給率の誤概念（self-rate）を、自給率と関係のない問題に付けない', () => {
      const food = unitOf('g5.soc.food');
      for (const id of ['fut-trace', 'fut-young', 'fut-brand', 'rice-issue', 'fish-enyo-decline'])
        for (const o of optionsOf(itemOf(food, id)).filter((x) => !x.correct))
          expect(o.mis, id).not.toBe('self-rate');
    });
  });
});
