/**
 * g6.ja.language-change の設計どおりかを確かめる検査（docs/expansion/p2-design/g6-ja.md 8章）。
 */
import { describe, expect, it } from 'vitest';
import { sampleItems, textsOf } from '../../curriculum/qa';
import type { ChoiceOption, Item } from '../../curriculum/types';
import { kanjiGrade } from '../../text/kanji-grades';
import { languageChange as U } from './language-change';

const plain = (s: string): string => s.replace(/《[^》]*》/g, '').replace(/\*\*/g, '');
const items = (): Item[] => sampleItems(U, 50);
const byId = (id: string): Item => {
  const it = items().find((x) => x.id === id);
  if (!it) throw new Error(`問題がない: ${id}`);
  return it;
};
const optionsOf = (it: Item): ChoiceOption[] =>
  'options' in it && Array.isArray(it.options) ? (it.options as ChoiceOption[]) : [];

/** 字源の対応（設計書 4.4）: [match の id, [left の漢字, right の仮名][]] */
const GENGO: [string, [string, string][]][] = [
  [
    'kn-match:h-a',
    [
      ['安', 'あ'],
      ['以', 'い'],
      ['加', 'か'],
    ],
  ],
  [
    'kn-match:h-b',
    [
      ['知', 'ち'],
      ['止', 'と'],
      ['波', 'は'],
    ],
  ],
  [
    'kn-match:h-c',
    [
      ['末', 'ま'],
      ['美', 'み'],
      ['女', 'め'],
    ],
  ],
  [
    'kn-match:h-d',
    [
      ['留', 'る'],
      ['礼', 'れ'],
      ['和', 'わ'],
    ],
  ],
  [
    'kn-match:h-e',
    [
      ['計', 'け'],
      ['太', 'た'],
      ['奈', 'な'],
    ],
  ],
  [
    'kn-match:k-a',
    [
      ['加', 'カ'],
      ['多', 'タ'],
      ['千', 'チ'],
    ],
  ],
  [
    'kn-match:k-b',
    [
      ['宇', 'ウ'],
      ['己', 'コ'],
      ['八', 'ハ'],
    ],
  ],
  [
    'kn-match:k-c',
    [
      ['保', 'ホ'],
      ['比', 'ヒ'],
      ['流', 'ル'],
    ],
  ],
];

describe('g6.ja.language-change', () => {
  it('問題は65問で、id が重ならない', () => {
    if (U.source.kind !== 'items') throw new Error('items のはず');
    const ids = U.source.items.map((i) => i.id);
    expect(ids.length).toBe(65);
    expect(new Set(ids).size).toBe(65);
    const keys = U.source.items.map((i) => i.identity);
    expect(new Set(keys).size).toBe(65);
  });

  it('誤概念は21個で重ならず、選択肢・組の誤概念はすべて定義されている', () => {
    const ids = U.misconceptions.map((m) => m.id);
    expect(ids.length).toBe(21);
    expect(new Set(ids).size).toBe(21);
    const used: string[] = [];
    for (const it of items()) {
      for (const o of optionsOf(it)) if (o.misconception) used.push(o.misconception);
      if (it.engine === 'match') for (const w of it.wrongPairs ?? []) used.push(w.misconception);
    }
    for (const m of used) expect(ids).toContain(m);
  });

  it('match: right は left 以上・6 以下、kana の left は読みを出さない（《!）', () => {
    for (const it of items()) {
      if (it.engine !== 'match') continue;
      expect(it.right.length).toBeGreaterThanOrEqual(it.left.length);
      expect(it.right.length).toBeLessThanOrEqual(6);
      if (it.objective === 'kana') for (const c of it.left) expect(c.label).toContain('《!');
    }
    for (const id of ['kn-alt-an', 'kn-alt-ho', 'kn-alt-manyo']) {
      const it = byId(id);
      expect(it.engine === 'choice' && it.figure?.kind === 'text' && it.figure.text).toContain(
        '《!',
      );
    }
  });

  it('字源の対応が設計どおり', () => {
    for (const [id, table] of GENGO) {
      const it = byId(id);
      if (it.engine !== 'match') throw new Error('match のはず');
      const got = it.pairs.map(([l, r]) => [
        plain(it.left[l]?.label ?? ''),
        plain(it.right[r]?.label ?? ''),
      ]);
      expect(got).toEqual(table);
    }
  });

  it('見える字に配当外の字（6年より上）が無い', () => {
    const bad = '於之奴祢阿伊江瓜枕随択氵々';
    for (const it of items()) {
      for (const c of plain(textsOf(it).join('')))
        if (/\p{Script=Han}|々/u.test(c)) {
          expect(bad.includes(c)).toBe(false);
          expect(kanjiGrade(c)).toBeLessThanOrEqual(6);
        }
    }
  });

  it('どの地方の言葉かを答えさせる問題が無い', () => {
    for (const it of items()) {
      const p = plain(it.prompt);
      expect(p).not.toMatch(/どこの|どの地方/);
    }
  });

  it('方言・昔の言葉を「まちがい」「くずれた」と低く言う解説が無い', () => {
    for (const it of items()) {
      if (it.engine !== 'match' || !['dialect', 'change'].includes(it.objective)) continue;
      expect(plain(it.explain)).not.toMatch(/まちがい|くずれた/);
    }
  });

  it('ヒントが正答を言わない（短い札は個別に確かめる）', () => {
    for (const it of items()) {
      const correct = optionsOf(it).filter((o) => o.correct);
      if (correct.length !== 1) continue;
      const ans = plain(correct[0]?.label ?? '');
      if (ans.length <= 2) continue;
      for (const h of it.hints) expect(plain(h)).not.toContain(ans);
    }
    const manyo = byId('kn-alt-manyo');
    for (const h of manyo.hints) expect(plain(h)).not.toContain('はる');
    const iroha = byId('ch-alt-iroha');
    for (const h of iroha.hints) expect(plain(h)).not.toContain('きょう');
  });

  it('match のまぎらわしい札は、解説で名前を出して区別している', () => {
    for (const id of ['or-match:moto', 'ch-match:kogo-a', 'dl-match:c']) {
      const it = byId(id);
      if (it.engine !== 'match') throw new Error('match のはず');
      const extra = it.right[it.right.length - 1]?.label ?? '';
      expect(plain(it.explain)).toContain(plain(extra).replace(/[「」]/g, ''));
    }
  });

  it('古語の match のまぎらわしい札は、千年前にも通じた意味ではない（おどろく＝びっくりする を使わない）', () => {
    const it = byId('ch-match:kogo-a');
    if (it.engine !== 'match') throw new Error('match のはず');
    expect(it.right.map((c) => plain(c.label ?? ''))).not.toContain('びっくりする');
  });

  it('字源のヒントは「音読みのはじめの音」に頼らせない（止→と・女→め・千→チ・流→ル は合わない）', () => {
    for (const it of items()) {
      if (it.objective !== 'kana') continue;
      for (const h of it.hints)
        expect(plain(h)).not.toMatch(/音読みのはじめの音と合うか|りゅう」のはじめ/);
    }
  });

  it('reading は別例（alt）で、選択肢は3つ', () => {
    const rs = items().filter((i) => i.engine === 'reading');
    expect(rs.length).toBe(12);
    for (const r of rs) {
      expect(r.alt).toBe(true);
      expect(optionsOf(r).length).toBe(3);
    }
  });
});
