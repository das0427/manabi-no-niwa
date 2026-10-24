/** 教材レビュー（2026-10-24）で直した点の再発防止 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/util/rng';
import type { Item } from '../../curriculum/types';
import pack from './index';

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
    for (const id of ['p4.ja.first-sound', 'p4.ja.kana-read', 'p4.ja.word-play'])
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
