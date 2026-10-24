/**
 * g2-math 内容レビュー（担当A: add-column・add-sub-3digit・add-sub-relations・box・fraction-simple・
 * length・mult-beyond・mult-meaning）の再発防止テスト。
 */
import { describe, expect, it } from 'vitest';
import { sampleItems } from '../../curriculum/qa';
import type { ChoiceItem, Item, NumberItem, UnitSpec } from '../../curriculum/types';
import pack from './index';

const unitOf = (id: string): UnitSpec => {
  const u = pack.units.find((x) => x.id === `g2.math.${id}`);
  if (!u) throw new Error(`unit ${id} が ない`);
  return u;
};
const itemsOf = (id: string, seeds = 300): Item[] => sampleItems(unitOf(id), seeds);
const numAnswer = (it: NumberItem): number[] =>
  it.fields.map((f) => (f.answer.kind === 'int' ? f.answer.value : NaN));
const lastHint = (it: Item): string => it.hints[it.hints.length - 1] ?? '';

/** 図の文字や筆算の表から、問題の式を読みとって 答えを独立に計算する */
function recompute(it: NumberItem): number | null {
  const fig = it.figure as { kind?: string; text?: string; rows?: string[][] } | undefined;
  if (fig?.kind === 'text' && fig.text) {
    const m = /^(\d+) ([＋−×]) (\d+) ＝ \{\{\}\}$/.exec(fig.text);
    if (!m) return null;
    const a = Number(m[1]);
    const b = Number(m[3]);
    return m[2] === '＋' ? a + b : m[2] === '−' ? a - b : a * b;
  }
  if (fig?.kind === 'table' && fig.rows && fig.rows.length === 3) {
    const a = Number(fig.rows[0]!.slice(1).join(''));
    const b = Number(fig.rows[1]!.slice(1).join(''));
    return fig.rows[1]![0] === '＋' ? a + b : a - b;
  }
  return null;
}

describe('g2-math レビューA: 答えの独立な再計算', () => {
  for (const id of ['add-column', 'add-sub-3digit', 'add-sub-relations', 'mult-beyond']) {
    it(`${id}: 式の図から計算した答えと 正答が一致する`, () => {
      let checked = 0;
      for (const it of itemsOf(id)) {
        if (it.engine !== 'number') continue;
        const r = recompute(it);
        if (r === null) continue;
        checked++;
        const ans = numAnswer(it);
        const v = ans.length === 1 ? ans[0] : Number(ans.join(''));
        expect(v, it.id).toBe(r);
      }
      expect(checked).toBeGreaterThan(50);
    });
  }
});

describe('g2-math レビューA: 正答が1つに決まる', () => {
  it('add-sub-relations kakko-alt: a ＋ b も 何十に なる組は出さない（どちらも らく に なる）', () => {
    for (const it of itemsOf('add-sub-relations')) {
      const m = /^kakko(?:-alt)?:(\d+)\+(\d+)\+(\d+)$/.exec(it.id);
      if (!m) continue;
      const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
      expect((b + c) % 10, it.id).toBe(0);
      expect((a + b) % 10, it.id).not.toBe(0);
    }
  });

  it('fraction-simple: 帯・正方形の図で、正解は ちょうど 1/k、等しくない分け方は 1/k に ならない', () => {
    const area = (markup: string) => {
      let colored = 0;
      let total = 0;
      for (const m of markup.matchAll(
        /<rect x="[\d.]+" y="[\d.]+" width="([\d.]+)" height="([\d.]+)" fill="([^"]+)"/g,
      )) {
        const s = Number(m[1]) * Number(m[2]);
        total += s;
        if (m[3]!.startsWith('url(')) colored += s;
      }
      return total ? colored / total : null;
    };
    let checked = 0;
    for (const it of itemsOf('fraction-simple')) {
      const m = /^pick:(\d):/.exec(it.id);
      if (!m || it.engine !== 'choice') continue;
      const k = Number(m[1]);
      for (const o of it.options) {
        const f = o.figure as { kind?: string; markup?: string } | undefined;
        if (f?.kind !== 'svg' || !f.markup) continue;
        const r = area(f.markup);
        if (r === null) continue;
        checked++;
        if (o.correct) expect(r, it.id).toBeCloseTo(1 / k, 6);
        else expect(Math.abs(r - 1 / k), `${it.id} ${o.misconception}`).toBeGreaterThan(1e-6);
      }
    }
    expect(checked).toBeGreaterThan(30);
  });

  it('mult-beyond split-alt: 「1ふくろに □こずつ」と 1つぶんが わかる文', () => {
    for (const it of itemsOf('mult-beyond'))
      if (it.id.startsWith('split-alt:')) expect(it.prompt, it.id).toContain('ずつ');
  });
});

describe('g2-math レビューA: 誤答の例と誤概念', () => {
  it('add-sub-relations koukan: □に 左の数を写した誤りは copy-number', () => {
    for (const it of itemsOf('add-sub-relations')) {
      const m = /^koukan:(\d+)\+(\d+)$/.exec(it.id);
      if (!m || it.engine !== 'number') continue;
      const w = it.wrongAnswers?.find((x) => x.value === m[1]);
      expect(w?.misconception, it.id).toBe('copy-number');
    }
  });

  it('box edges: めんの誤概念（pair-faces）を へんの問題に使わない', () => {
    for (const it of itemsOf('box'))
      if (it.engine === 'number' && it.objective === 'edges')
        for (const w of it.wrongAnswers ?? [])
          expect(w.misconception, it.id).not.toBe('pair-faces');
  });

  it('fraction-simple moto: n−1（colored-count）を誤答にせず、かけ算の誤りは times-instead', () => {
    for (const it of itemsOf('fraction-simple')) {
      if (it.engine !== 'number') continue;
      for (const w of it.wrongAnswers ?? [])
        expect(w.misconception, it.id).not.toBe('colored-count');
      const m = /^moto(?:-tape)?:(\d):(\d+)$/.exec(it.id);
      if (m) {
        const prod = String(Number(m[1]) * Number(m[2]));
        expect(it.wrongAnswers?.find((w) => w.value === prod)?.misconception, it.id).toBe(
          'times-instead',
        );
      }
    }
  });
});

describe('g2-math レビューA: ヒントの最後の段が答えを言わない', () => {
  it('add-sub-relations tashikame・koukan-alt: 正解の式を ヒントに書かない', () => {
    for (const it of itemsOf('add-sub-relations')) {
      if (it.engine !== 'choice') continue;
      const c = (it as ChoiceItem).options.find((o) => o.correct)!;
      for (const h of it.hints.slice(1)) expect(h, it.id).not.toContain(c.label!);
    }
  });

  it('box net: 「〜しゅるい」の数が ヒントの中で そろう', () => {
    for (const it of itemsOf('box')) {
      if (!it.id.startsWith('net:')) continue;
      const n = /(\d)しゅるい。/.exec(it.hints[1]!)?.[1];
      expect(lastHint(it), it.id).toContain(`${n}しゅるい`);
    }
  });

  it('fraction-simple moto-tape: ヒントに 答えの ながさを 書かない', () => {
    for (const it of itemsOf('fraction-simple')) {
      if (it.engine !== 'number' || !it.id.startsWith('moto-tape:')) continue;
      const ans = numAnswer(it)[0]!;
      for (const h of it.hints) expect(h, it.id).not.toContain(`${ans}cmが`);
    }
  });

  it('mult-beyond split: 最後の段に 10 × b・o × b の答えを 並べない', () => {
    for (const it of itemsOf('mult-beyond')) {
      if (it.engine !== 'number' || !it.id.startsWith('split:')) continue;
      const [t, o] = numAnswer(it);
      expect(lastHint(it), it.id).not.toMatch(new RegExp(`(^|[^0-9])(${t}|${o})と `));
    }
  });
});
