/** 教材レビュー（2026-10-24）で直した点の再発防止 */
import { describe, expect, it } from 'vitest';
import type { Item } from '../../curriculum/types';
import { clash } from './daily-life';
import pack from './index';

const unitItems = (id: string): Item[] => {
  const u = pack.units.find((x) => x.id === id)!;
  return u.source.kind === 'items' ? u.source.items : [];
};
const lastHint = (it: Item): string => String(it.hints.at(-1) ?? '');

describe('p23 教材レビューの再発防止', () => {
  it('聞いて選ぶ問題: ヒントの最後の段に 正解の名前を書かない', () => {
    for (const u of pack.units)
      for (const it of unitItems(u.id)) {
        if (it.engine !== 'listen') continue;
        for (const o of it.options)
          if (o.correct && o.label) expect(lastHint(it), it.id).not.toContain(o.label);
      }
  });

  it('くらしの どうぐ: 同じ場面で使う物を 誤りの選択肢に入れない（正解が2つに ならない）', () => {
    const illustOf = (o: { figure?: unknown }) =>
      (o.figure as { id?: string } | undefined)?.id ?? '';
    for (const it of unitItems('p23.env.daily-life')) {
      if (it.engine !== 'choice' || !/^(scene|use):/.test(it.id)) continue;
      const right = it.options.find((o) => o.correct)!;
      for (const o of it.options)
        if (!o.correct) expect(clash(illustOf(right), illustOf(o)), it.id).toBe(false);
    }
    // 名指しで: そとへ いく ↔ ぼうし、おやすみ ↔ はぶらし・えほん
    expect(clash('p23-shoe', 'p23-hat')).toBe(true);
    expect(clash('p23-pillow', 'p23-toothbrush')).toBe(true);
    expect(clash('p23-pillow', 'p23-book')).toBe(true);
  });

  it('くらしの どうぐ: 「〜の まえに」の誤りは 順番の逆ではなく 別の物（other-tool）', () => {
    for (const it of unitItems('p23.env.daily-life')) {
      if (it.engine !== 'choice' || !it.id.startsWith('before:')) continue;
      for (const o of it.options) if (!o.correct) expect(o.misconception, it.id).toBe('other-tool');
    }
  });

  it('かたちあわせ: ひしがたの絵は 正方形（45度まわした しかく）にしない', () => {
    let seen = 0;
    for (const it of unitItems('p23.math.shape-match')) {
      if (it.engine !== 'choice') continue;
      for (const o of it.options) {
        if (o.label !== 'ひしがた') continue;
        const f = o.figure as { points?: [number, number][] };
        const p = f.points!;
        const d = (a: [number, number], b: [number, number]) =>
          Math.hypot(a[0] - b[0], a[1] - b[1]);
        const d1 = d(p[0]!, p[2]!);
        const d2 = d(p[1]!, p[3]!);
        expect(Math.abs(d1 - d2), it.id).toBeGreaterThan(20);
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('おおきい・ちいさい: ヒントに 難しい語（こぢんまり）を使わない', () => {
    for (const it of unitItems('p23.math.compare'))
      for (const h of it.hints) expect(h, it.id).not.toContain('こぢんまり');
  });
});
