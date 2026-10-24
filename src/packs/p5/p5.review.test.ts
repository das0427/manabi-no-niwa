/**
 * p5 の教材レビュー（2026-10-24）で見つけた誤りの再発防止。
 * 生成器は seed を回して実際に作った問題で、手作りの単元は全問で確かめる。
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/util/rng';
import type { ChoiceOption, Item, UnitSpec } from '../../curriculum/types';
import { hon } from './compose';
import pack from './index';
import { SAME_SOUND } from './kana-read-all';

const unit = (id: string): UnitSpec => pack.units.find((u) => u.id === id)!;
const itemsOf = (u: UnitSpec): Item[] => {
  if (u.source.kind === 'items') return u.source.items;
  if (u.source.kind !== 'generator') return [];
  const gen = u.source.generate;
  const out: Item[] = [];
  for (let level = 0; level < u.levels.length; level++)
    for (let seed = 0; seed < 150; seed++)
      out.push(gen({ level, rng: createRng(seed * 31 + level), index: seed % 4 }));
  return out;
};
const optionsOf = (it: Item): ChoiceOption[] =>
  it.engine === 'choice' || it.engine === 'listen' ? it.options : [];
const anyItem = (it: Item) => it as unknown as Record<string, unknown>;

describe('p5 レビュー: どの選択問題も 正解は ちょうど1つ・選択肢が かさならない', () => {
  for (const u of pack.units)
    it(u.id, () => {
      for (const it of itemsOf(u)) {
        const os = optionsOf(it);
        if (os.length === 0) continue;
        expect(os.filter((o) => o.correct).length, it.id).toBe(1);
        const labels = os.map((o) => o.label ?? JSON.stringify(o.figure));
        expect(new Set(labels).size, `${it.id}: ${labels.join(' | ')}`).toBe(labels.length);
      }
    });
});

describe('p5 レビュー: ひらがなを よむ', () => {
  const items = itemsOf(unit('p5.ja.kana-read-all'));

  it('おとを きいて えらぶ もんだいに、おなじ おとの 字（ず・づ など）を 誤答に 入れない', () => {
    for (const it of items) {
      if (it.engine !== 'listen') continue;
      const right = it.options.find((o) => o.correct)!.label!;
      if ([...right].length !== 1) continue;
      for (const o of it.options) {
        if (o.correct) continue;
        const same = SAME_SOUND.some((g) => g.includes(right) && g.includes(o.label!));
        expect(same, `${it.id}: ${right} と ${o.label}`).toBe(false);
      }
    }
  });

  it('ヒントの「はじめの じ」が 正解だけに ある ときは いわない（ヒントが こたえに ならない）', () => {
    for (const it of items) {
      if (!it.id.startsWith('read:') || it.engine !== 'choice') continue;
      const m = /はじめの じは「(.)」/.exec(it.hints[it.hints.length - 1]!);
      if (!m) continue;
      const wrongs = it.options.filter((o) => !o.correct).map((o) => o.label!);
      expect(
        wrongs.some((w) => [...w][0] === m[1]),
        `${it.id}: ${wrongs.join(',')}`,
      ).toBe(true);
    }
  });
});

describe('p5 レビュー: ことばづくり', () => {
  it('点の有無だけの ちがい（かめ → がめ）は「かたちの にた じ」でなく 濁音の 誤り', () => {
    const plain = (c: string) => c.normalize('NFD')[0]!;
    for (const it of itemsOf(unit('p5.ja.word-build'))) {
      const a = anyItem(it);
      const right = (a.answer as { values: string[] }).values[0]!;
      for (const w of (a.wrongAnswers as { value: string; misconception: string }[]) ?? []) {
        const r = [...right];
        const x = [...w.value];
        const i = r.findIndex((c, k) => c !== x[k]);
        const onlyDakuten = plain(r[i]!) === plain(x[i]!);
        expect(w.misconception, `${it.id}: ${w.value}`).toBe(
          onlyDakuten ? 'dakuten' : 'similar-shape',
        );
      }
    }
  });
});

describe('p5 レビュー: かたち', () => {
  const items = itemsOf(unit('p5.math.shapes'));
  it('5歳に むずかしい 図形の ことば（ちょっかく・だいけい・ろっかくけい）を つかわない', () => {
    expect(JSON.stringify(items)).not.toMatch(/ちょっかく|だいけい|ろっかくけい/);
  });
  it('「つみあげやすい」の 誤答に つつ（たてに すれば つめる）を 入れない', () => {
    for (const it of items) {
      if (!it.prompt.includes('つみあげ')) continue;
      expect(
        optionsOf(it).some((o) => !o.correct && o.label === 'つつ'),
        it.id,
      ).toBe(false);
    }
  });
});

describe('p5 レビュー: おはなし', () => {
  const items = itemsOf(unit('p5.ja.story-listen'));
  const storyText = new Map<string, string>();
  for (const it of items) {
    const a = anyItem(it);
    if (it.engine === 'listen' && Array.isArray(a.audio))
      storyText.set(
        it.id.split(':')[1]!,
        (a.audio as { text: string }[]).map((x) => x.text).join(''),
      );
  }
  it('「おはなしに ない」誤答は、ほんとうに おはなしに でて こない', () => {
    for (const it of items) {
      const text = storyText.get(it.id.split(':')[1]!)!;
      expect(text, it.id).toBeTruthy();
      for (const o of optionsOf(it)) {
        if (o.misconception === 'not-in-story')
          expect(text.includes(o.label!.replace(/から$/, '')), `${it.id}: ${o.label}`).toBe(false);
        if (o.misconception === 'other-role')
          expect(text.includes(o.label!), `${it.id}: ${o.label}`).toBe(true);
      }
    }
  });
});

describe('p5 レビュー: カタカナを よむ', () => {
  it('誤答の 作り語に 民族名など 実在の 固有の 語を つかわない', () => {
    const s = JSON.stringify(itemsOf(unit('p5.ja.katakana-read')));
    expect(s).not.toMatch(/アイヌ|ガメラ/);
  });
});

describe('p5 レビュー: さんすう', () => {
  it('きまり: かずの ならびは 10まで（こたえも 選択肢も）・音の きまりに ない 音は not-in-pattern', () => {
    for (const it of itemsOf(unit('p5.think.pattern'))) {
      if (it.objective === 'number')
        for (const o of optionsOf(it)) expect(Number(o.label), it.id).toBeLessThanOrEqual(10);
      if (it.engine === 'listen') {
        const heard = new Set((anyItem(it).audio as { text: string }[]).map((x) => x.text));
        for (const o of it.options)
          if (!o.correct)
            expect(o.misconception === 'not-in-pattern', `${it.id}: ${o.label}`).toBe(
              !heard.has(o.label!),
            );
      }
    }
  });

  it('いくつと いくつ: 10の わくを つかわない（あいた ますを「かくれた かず」と とりちがえる）・ゆびの かぞえかた', () => {
    for (const it of itemsOf(unit('p5.math.compose'))) {
      if (it.objective !== 'to10') expect(JSON.stringify(it.figure), it.id).not.toMatch(/"frame"/);
      for (const h of it.hints)
        for (const m of h.matchAll(/(\d+)(ぽん|ほん|ぼん)/g))
          expect(m[0], `${it.id}: ${h}`).toBe(hon(Number(m[1])));
    }
    expect([1, 2, 3, 4, 6, 8, 10].map(hon).join(',')).toBe(
      '1ぽん,2ほん,3ぼん,4ほん,6ぽん,8ぽん,10ぽん',
    );
  });

  it('10までの かず: 「なんばんめ／なんこ」の 選択肢の なまえに もんだいの かずを 書かない', () => {
    const WORDS = ['', 'ひとつ', 'ふたつ', 'みっつ', 'よっつ', 'いつつ'];
    for (const it of itemsOf(unit('p5.math.numbers-10'))) {
      if (!it.id.startsWith('ord-vs:')) continue;
      const pos = Number(it.id.split(':')[1]);
      for (const o of optionsOf(it)) {
        expect(o.label, it.id).not.toContain(WORDS[pos]!);
        expect(o.label, it.id).not.toContain(String(pos));
      }
    }
  });

  it('ながさくらべ: かぞえ わすれ（skip-unit）は すくない かず、すきまを かぞえた（gap-count）は おおい かず', () => {
    for (const it of itemsOf(unit('p5.math.measure-compare'))) {
      if (!it.id.startsWith('units:')) continue;
      const n = Number(it.id.split(':')[1]);
      for (const o of optionsOf(it)) {
        if (o.misconception === 'skip-unit') expect(Number(o.label), it.id).toBeLessThan(n);
        if (o.misconception === 'gap-count') expect(Number(o.label), it.id).toBeGreaterThan(n);
      }
    }
  });

  it('とけい: さいごの ヒントに こたえの 時刻（すうじ）を 書かない', () => {
    for (const it of itemsOf(unit('p5.math.clock'))) {
      const last = it.hints[it.hints.length - 1]!;
      expect(last.replace('12', ''), `${it.id}: ${last}`).not.toMatch(/\d/);
    }
  });

  it('たす・ひく: ヒントは 文だけなので「えを みよう」とは いわない', () => {
    for (const it of itemsOf(unit('p5.math.add-sub'))) {
      expect(it.prompt, it.id).not.toMatch(/ヒントで えを/);
      for (const h of it.hints) expect(h, it.id).not.toMatch(/えで みると/);
    }
  });
});
