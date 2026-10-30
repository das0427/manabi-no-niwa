/** 教材レビュー（2026-10-24）で直した点の再発防止 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/util/rng';
import type { Item } from '../../curriculum/types';
import { ALTS, SCENES } from './daily-order';
import pack from './index';
import { FINDS, SEASONS, THINGS, seasonMisconception, thing } from './seasons';

const unitItems = (id: string): Item[] => {
  const u = pack.units.find((x) => x.id === id)!;
  return u.source.kind === 'items' ? u.source.items : [];
};
const lastHint = (it: Item): string => String(it.hints.at(-1) ?? '');
const optionsOf = (it: Item) =>
  it.engine === 'choice' || it.engine === 'listen' ? it.options : [];
const base = (c: string) => c.normalize('NFD')[0]!;

describe('p4 教材レビューの再発防止', () => {
  it('かずと え: 「ひとつ ずれ」(off-by-one) の誤りは 正解と ちょうど 1 ちがう', () => {
    const u = pack.units.find((x) => x.id === 'p4.math.count-pictures')!;
    if (u.source.kind !== 'generator') throw new Error('generator のはず');
    for (let level = 0; level < u.levels.length; level++)
      for (let seed = 0; seed < 300; seed++) {
        const it = u.source.generate({ level, rng: createRng(seed * 31 + level), index: 0 });
        const os = optionsOf(it);
        const ans = Number(os.find((o) => o.correct)!.label);
        expect(os.length, it.id).toBeGreaterThanOrEqual(2);
        for (const o of os)
          if (o.misconception === 'off-by-one')
            expect(Math.abs(Number(o.label) - ans), `${it.id} ${o.label}`).toBe(1);
      }
  });

  it('ヒントの最後の段に「正解」を そのまま書かない', () => {
    for (const id of [
      'p4.ja.first-sound',
      'p4.ja.kana-read',
      'p4.ja.word-play',
      'p4.ja.story-listen',
    ])
      for (const it of unitItems(id))
        for (const o of optionsOf(it))
          if (o.correct && o.label) expect(lastHint(it), it.id).not.toContain(`「${o.label}」`);
  });

  it('字を選ぶ問題（はじめの おと・もじよみ）: ヒントの最後の段の「」の中に 正解の字を書かない', () => {
    for (const id of ['p4.ja.first-sound', 'p4.ja.kana-read'])
      for (const it of unitItems(id)) {
        const right = optionsOf(it).find((o) => o.correct);
        if (!right?.label || right.figure || [...right.label].length !== 1) continue;
        const quoted = lastHint(it).match(/「[^」]*」/g) ?? [];
        for (const q of quoted) expect(q, it.id).not.toContain(right.label);
      }
  });

  it('もじよみ: 「を」と「お」（音が おなじ）を 同じ問題に出さない', () => {
    for (const it of unitItems('p4.ja.kana-read')) {
      const labels = optionsOf(it).map((o) => o.label);
      expect(labels.includes('を') && labels.includes('お'), it.id).toBe(false);
    }
  });

  it('はじめの おと: 点・まるの有無だけ違う字の誤りは dakuten・選択肢は重複しない', () => {
    for (const it of unitItems('p4.ja.first-sound')) {
      const os = optionsOf(it);
      const labels = os.map((o) => o.label);
      expect(new Set(labels).size, it.id).toBe(labels.length);
      const right = os.find((o) => o.correct)!;
      if (right.figure || !right.label) continue;
      for (const o of os)
        if (!o.correct && o.label && base(o.label) === base(right.label))
          expect(o.misconception, `${it.id} ${o.label}`).toBe('dakuten');
    }
  });

  it('ことばあそび: しりとりの答えは「ん」で おわらない・さかさの ヒントに 答えの はじめの音を書かない', () => {
    for (const it of unitItems('p4.ja.word-play')) {
      if (it.id.startsWith('shiri'))
        for (const o of optionsOf(it))
          if (o.correct && !it.id.startsWith('shiri-back'))
            expect(o.label, it.id).not.toMatch(/ん$/);
      if (it.id.startsWith('sakasa-pick:'))
        expect(lastHint(it), it.id).not.toContain('はじめの おとは');
    }
  });
});

const strip = (t: unknown) => String(t).replace(/\s/g, '');
const storyText = (it: Item): string =>
  it.engine === 'listen'
    ? (Array.isArray(it.audio) ? it.audio : [it.audio]).map((a) => String(a.text)).join('')
    : '';

describe('p4.ja.story-listen: 本文と設問の食い違い', () => {
  const items = unitItems('p4.ja.story-listen');
  it('だれ・なに: 正解の名は本文にある／other-role は本文にある／not-in-story は本文にない', () => {
    for (const it of items) {
      if (!/^(who|what|who-all|scene):/.test(it.id) || it.engine !== 'listen') continue;
      const text = storyText(it);
      for (const o of it.options) {
        const label = String(o.label);
        if (it.id.startsWith('scene:')) {
          // 「ねこと たまご」: 両方の名が本文にあるのは正解と other-role（だれかを取り違えた絵ではなく役の取り違え）だけ
          const parts = label.split('と ');
          const inText = parts.map((x) => text.includes(x.trim()));
          if (o.misconception === 'not-in-story') expect(inText.includes(false), it.id).toBe(true);
          else expect(inText.every(Boolean), `${it.id} ${label}`).toBe(true);
        } else if (o.correct || o.misconception === 'other-role')
          expect(text, `${it.id} ${label}`).toContain(label);
        else {
          expect(o.misconception, it.id).toBe('not-in-story');
          expect(text, `${it.id} ${label}`).not.toContain(label);
        }
      }
    }
  });
  it('複数えらび: 正解は2つ', () => {
    const multi = items.filter((i) => i.id.startsWith('who-all:'));
    expect(multi.length).toBeGreaterThanOrEqual(3);
    for (const it of multi)
      if (it.engine === 'listen') {
        expect(it.multi).toBe(true);
        expect(it.options.filter((o) => o.correct).length).toBe(2);
      }
  });
  it('字数: 問題文 26字・選択肢 10字・本文の1文 32字', () => {
    for (const it of items) {
      expect([...strip(it.prompt)].length, it.id).toBeLessThanOrEqual(26);
      for (const o of optionsOf(it))
        expect([...strip(o.label)].length, it.id).toBeLessThanOrEqual(10);
      for (const sentence of storyText(it).split('。'))
        expect([...strip(sentence)].length, it.id).toBeLessThanOrEqual(32);
    }
  });
});

describe('p4.env.seasons: 季節の表と問題', () => {
  const items = unitItems('p4.env.seasons');
  const byLabel = (l: string) => SEASONS.findIndex((s) => s.label === l);
  it('pick: 正解は表の季節、誤りの誤概念は表から計算したものと一致する', () => {
    for (const t of THINGS) {
      const it = items.find((i) => i.id === `pick:${t.id}`)!;
      const os = optionsOf(it);
      expect(os.length).toBe(2);
      expect(byLabel(String(os.find((o) => o.correct)!.label)), it.id).toBe(t.season);
      const w = os.find((o) => !o.correct)!;
      expect(w.misconception, it.id).toBe(seasonMisconception(t.season, byLabel(String(w.label))));
      expect(t.wrongSeason).not.toBe(t.season);
    }
  });
  it('find: 正解の物の季節は問われた季節・誤りの物は別の季節で誤概念が一致する', () => {
    for (const f of FINDS) {
      const it = items.find((i) => i.id === `find:${SEASONS[f.season]!.key}:${f.right}`)!;
      expect(it, f.right).toBeDefined();
      expect(thing(f.right).season, it.id).toBe(f.season);
      const w = typeof f.wrong === 'string' ? thing(f.wrong) : f.wrong;
      expect(w.season).not.toBe(f.season);
      const wo = optionsOf(it).find((o) => !o.correct)!;
      expect(wo.misconception, it.id).toBe(seasonMisconception(f.season, w.season));
    }
  });
  it('sort: 各カードの箱は表の季節・wrongBoxes は ほかの3つの箱', () => {
    const sorts = items.filter((i) => i.engine === 'sort');
    expect(sorts.length).toBe(6);
    for (const it of sorts) {
      if (it.engine !== 'sort') continue;
      expect(it.boxes.length).toBe(4);
      for (const c of it.cards) {
        const t = THINGS.find((x) => x.name === c.label)!;
        expect(c.box, `${it.id} ${t.id}`).toBe(t.season);
        expect(c.wrongBoxes!.map((w) => w.box).sort(), it.id).toEqual(
          [0, 1, 2, 3].filter((b) => b !== t.season),
        );
        for (const w of c.wrongBoxes!)
          expect(w.misconception).toBe(seasonMisconception(t.season, w.box));
      }
    }
  });
});

describe('p4.env.daily-order: 手順表と問題', () => {
  const items = unitItems('p4.env.daily-order');
  it('order: カードの文は手順表と同じ順', () => {
    for (const sc of SCENES) {
      const it = items.find((i) => i.id === `order:${sc.id}`)!;
      if (it.engine !== 'order') throw new Error(sc.id);
      expect(it.cards.map((c) => c.label)).toEqual(sc.steps.map((s) => s.text));
      expect(it.objective).toBe(sc.steps.length === 3 ? 'three' : 'four');
    }
  });
  it('別例: 正解は手順表で決まる位置の手順', () => {
    for (const a of ALTS) {
      const sc = SCENES.find((s) => s.id === a.scene)!;
      const it = items.find((i) => i.id === `${a.kind}:${a.scene}`)!;
      const right = String(optionsOf(it).find((o) => o.correct)!.label);
      const texts = sc.steps.map((s) => s.text);
      if (a.kind === 'first') expect(right).toBe(texts[0]);
      else if (a.kind === 'last') expect(right).toBe(texts.at(-1));
      else {
        const k = sc.steps.findIndex((s) => s.illust === a.figure);
        expect(right).toBe(texts[k + 1]);
      }
    }
  });
});

describe('p4 の P2 単元: 画面での収まり・ヒント', () => {
  const cardsOf = (it: Item) =>
    it.engine === 'order' || it.engine === 'sort' ? it.cards : optionsOf(it);
  it('問題文 26字・選択肢とカード 10字（空白を除く）', () => {
    for (const id of ['p4.env.seasons', 'p4.env.daily-order'])
      for (const it of unitItems(id)) {
        expect([...strip(it.prompt)].length, it.id).toBeLessThanOrEqual(26);
        for (const c of cardsOf(it))
          expect([...strip(c.label)].length, `${it.id} ${String(c.label)}`).toBeLessThanOrEqual(10);
      }
  });
  it('daily-order 別例: ヒントに正解の手順の語（はじめの語）を書かない', () => {
    for (const it of unitItems('p4.env.daily-order')) {
      if (it.engine !== 'choice') continue;
      const right = String(it.options.find((o) => o.correct)!.label);
      const head = right.split(' ')[0]!;
      for (const h of it.hints ?? []) expect(String(h), it.id).not.toContain(right);
      expect(String(lastHint(it)), it.id).not.toContain(head);
    }
  });
});
