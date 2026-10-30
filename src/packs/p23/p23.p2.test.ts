/** p23 の P2 単元5つの検査（設計書 docs/expansion/p2-design/p23.md 7章） */
import { describe, expect, it } from 'vitest';
import { checkUnit, isReady } from '../../curriculum/qa';
import type { Item, UnitSpec } from '../../curriculum/types';
import { ILLUST } from '../../illust/registry';
import pack from './index';
import { BOARDS, dirsAt, tileAt, tileAtXY, type Tile } from './road';

const unit = (id: string): UnitSpec => pack.units.find((u) => u.id === id)!;
const itemsOf = (id: string): Item[] => {
  const u = unit(id);
  return u.source.kind === 'items' ? u.source.items : [];
};
const options = (it: Item) => (it.engine === 'choice' || it.engine === 'listen' ? it.options : []);
const fig = (o: { figure?: unknown }) => (o.figure ?? {}) as { id?: string; markup?: string };
const strAll = (it: Item): string => JSON.stringify(it);

const EXPECT: Record<string, number> = {
  'p23.ja.first-sound': 48,
  'p23.think.peekaboo': 24,
  'p23.math.puzzle2': 24,
  'p23.think.road': 22,
  'p23.ja.picture-book': 24,
};

describe('p23 P2 単元: 共通', () => {
  for (const [id, n] of Object.entries(EXPECT)) {
    it(`${id}: 検査の誤りなし・${n}問`, () => {
      const u = unit(id);
      const r = checkUnit(u);
      expect(r.errors).toEqual([]);
      if (u.status === 'ready') expect(isReady(r)).toBe(true);
      expect(r.distinct).toBe(n);
      console.info(
        `${id}: Q ${r.q.toFixed(2)} (${r.distinct}) / C ${r.c[0]}/${r.c[1]} / 汎用誤答 ${(r.genericWrongShare * 100).toFixed(0)}% / 問題 ${itemsOf(id).length}`,
      );
    });
  }
});

describe('p23.ja.first-sound', () => {
  const items = itemsOf('p23.ja.first-sound');
  const rowOf = (n: string) => {
    const g = (
      {
        い: 'あ',
        う: 'あ',
        か: 'か',
        く: 'か',
        た: 'た',
        と: 'た',
        は: 'は',
        ひ: 'は',
        す: 'さ',
        ば: 'ば',
      } as Record<string, string>
    )[n];
    return g!;
  };
  const HEAD: Record<string, string> = {
    いぬ: 'い',
    いちご: 'い',
    うさぎ: 'う',
    うし: 'う',
    かめ: 'か',
    かさ: 'か',
    くま: 'く',
    くるま: 'く',
    たこ: 'た',
    たまご: 'た',
    とり: 'と',
    とけい: 'と',
    はさみ: 'は',
    はぶらし: 'は',
    ひよこ: 'ひ',
    ひこうき: 'ひ',
    すいか: 'す',
    スプーン: 'す',
    バナナ: 'ば',
    バス: 'ば',
  };

  it('全問2択・誤りの語は行が違う・は行×ば行の組が無い', () => {
    for (const it of items) {
      const os = options(it);
      expect(os.length, it.id).toBe(2);
      const key = it.id.split(':')[1]!;
      const asked = it.id.startsWith('sound:') || it.id.startsWith('chant:') ? key : key;
      const wrong = os.find((o) => !o.correct)!.label as string;
      const r1 = rowOf(HEAD[asked]!);
      const r2 = rowOf(HEAD[wrong]!);
      expect(r1, it.id).not.toBe(r2);
      expect([r1, r2].sort().join(''), it.id).not.toBe(['は', 'ば'].sort().join(''));
    }
  });

  it('音1つの問題は hideTranscript・問題文とヒントに語頭の1字を書かない', () => {
    for (const it of items) {
      if (/^(sound|chant):/.test(it.id))
        expect((it as { hideTranscript?: boolean }).hideTranscript, it.id).toBe(true);
      expect(it.prompt, it.id).not.toMatch(/「[ぁ-ゖー]」/);
      for (const h of it.hints) expect(h, it.id).not.toMatch(/「[ぁ-ゖー]」/);
    }
  });
});

describe('p23.think.peekaboo', () => {
  const items = itemsOf('p23.think.peekaboo');
  it('絵が登録済み・find は空の隠れ場所が誤り・whose は同じ隠れ場所', () => {
    for (const it of items) {
      const os = options(it);
      expect(os.length, it.id).toBe(2);
      for (const o of os) expect(ILLUST[fig(o).id!], `${it.id}: ${fig(o).id}`).toBeDefined();
      const ids = os.map((o) => fig(o).id!);
      if (it.id.startsWith('find')) {
        const wrong = os.find((o) => !o.correct)!;
        expect(fig(wrong).id, it.id).toMatch(/^p23-hide-(cup|box)$/);
        const place = fig(wrong).id!.slice(-3).replace('-', '');
        expect(fig(os.find((o) => o.correct)!).id, it.id).toMatch(
          new RegExp(`^p23-peek-[a-z]+-${place}$`),
        );
      }
      if (it.id.startsWith('whose:')) {
        expect(ids[0]!.split('-').pop(), it.id).toBe(ids[1]!.split('-').pop());
      }
    }
    for (const a of ['rabbit', 'bear', 'elephant', 'fox', 'turtle', 'duck', 'pig', 'cat'])
      for (const p of ['cup', 'box']) expect(ILLUST[`p23-peek-${a}-${p}`]).toBeDefined();
  });
});

describe('p23.math.puzzle2', () => {
  const items = itemsOf('p23.math.puzzle2');
  it('練習は 図と同じ絵で 側が反対・same-side は左右が違う絵だけ', () => {
    for (const it of items) {
      const os = options(it);
      expect(os.length, it.id).toBe(2);
      const [, side, p] = it.id.split(':') as [string, string, string];
      if (it.id.startsWith('half:')) {
        const f = (it.figure as { id: string }).id;
        expect(f, it.id).toBe(`p23-puz-${p}-${side === 'right' ? 'lslot' : 'rslot'}`);
        expect(fig(os.find((o) => o.correct)!).id, it.id).toBe(
          `p23-puz-${p}-${side === 'right' ? 'r' : 'l'}`,
        );
      }
      for (const o of os)
        if (o.misconception === 'same-side')
          expect(['apple', 'umbrella', 'tomato']).not.toContain(p);
    }
  });
});

describe('p23.think.road', () => {
  const items = itemsOf('p23.think.road');
  it('各盤の経路は 隣接・重複なし・盤内', () => {
    for (const [b, path] of Object.entries(BOARDS)) {
      const seen = new Set<string>();
      path.forEach(([x, y], i) => {
        expect(x >= 0 && x < 4 && y >= 0 && y < 3, b).toBe(true);
        expect(seen.has(`${x},${y}`), b).toBe(false);
        seen.add(`${x},${y}`);
        if (i > 0) {
          const [px, py] = path[i - 1]!;
          expect(Math.abs(px - x) + Math.abs(py - y), b).toBe(1);
        }
      });
    }
  });

  it('検算: 設計書 4.2 の途中のマスの形', () => {
    const exp: Record<string, string[]> = {
      B1: ['EW', 'EW'],
      B2: ['EW', 'SW', 'NS', 'NE'],
      B3: ['NW', 'NS', 'ES', 'EW'],
      B4: ['NS', 'NE', 'EW', 'EW'],
      B5: ['NW', 'ES', 'SW', 'NS', 'NE'],
      B6: ['EW', 'ES', 'NS', 'NW'],
      B7: ['EW', 'NW', 'ES', 'NW'],
      B8: ['SW', 'EW', 'EW', 'NE'],
    };
    for (const [b, path] of Object.entries(BOARDS))
      expect(
        path.slice(1, -1).map((_, i) => tileAt(path, i + 1)),
        b,
      ).toEqual(exp[b]);
  });

  it('練習: 正しい形は経路どおり・誤りの形は前後の両方とはつながらない', () => {
    const gaps = items.filter((it) => it.id.startsWith('gap:'));
    expect(gaps.length).toBe(16);
    for (const it of gaps) {
      const [, b, xy] = it.id.split(':') as [string, string, string];
      const [x, y] = xy.split('-').map(Number) as [number, number];
      const path = BOARDS[b]!;
      const right = tileAtXY(path, [x, y]);
      const os = options(it);
      expect(os.length, it.id).toBe(2);
      // 図の svg 文字列から形を直接は読めないので、正誤の図が異なることと、誤りの形の向きが違うことを確かめる
      expect(fig(os[0]!).markup, it.id).not.toBe(fig(os[1]!).markup);
      expect(right.length, it.id).toBe(2);
    }
  });

  it('別例: 正しい盤と1マスだけ違う', () => {
    const wholes = items.filter((it) => it.id.startsWith('whole:'));
    expect(wholes.length).toBe(6);
    for (const it of wholes) {
      const [r, w] = [options(it).find((o) => o.correct)!, options(it).find((o) => !o.correct)!];
      const a = fig(r).markup!;
      const b = fig(w).markup!;
      expect(a, it.id).not.toBe(b);
      const rects = (s: string): string[] => s.match(/<rect [^>]*\/>/g) ?? [];
      const ra = rects(a);
      const rb = rects(b);
      const onlyA = ra.filter((x) => !rb.includes(x)).length;
      const onlyB = rb.filter((x) => !ra.includes(x)).length;
      expect(onlyA + onlyB, it.id).toBeGreaterThan(0);
      expect(onlyA + onlyB, it.id).toBeLessThanOrEqual(8);
    }
  });

  it('SVG に 16進の色・<text・スクリプトが無い', () => {
    for (const it of items) {
      const s = strAll(it);
      expect(s, it.id).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
      expect(s, it.id).not.toContain('<text');
    }
  });

  it('向きの検算: 始点・終点は向きが1つ', () => {
    for (const path of Object.values(BOARDS)) {
      expect(dirsAt(path, 0).length).toBe(1);
      expect(dirsAt(path, path.length - 1).length).toBe(1);
    }
    const t: Tile = tileAt(BOARDS.B2!, 2);
    expect(t).toBe('SW');
  });
});

describe('p23.ja.picture-book', () => {
  const items = itemsOf('p23.ja.picture-book');
  const textOf = (it: Item): string =>
    it.engine === 'listen'
      ? (Array.isArray(it.audio) ? it.audio : [it.audio]).map((a) => String(a.text)).join('')
      : '';

  it('段階0 は 2択・段階1 は 3択', () => {
    for (const it of items) expect(options(it).length, it.id).toBe(it.level === 0 ? 2 : 3);
    expect(items.filter((i) => i.level === 0).length).toBe(8);
    expect(items.filter((i) => i.level === 1).length).toBe(16);
  });

  it('not-in-story の名前は本文に無い・other-role の名前は本文にある・別例の正解の名前は本文に無い', () => {
    for (const it of items) {
      const text = textOf(it);
      for (const o of options(it)) {
        const name = o.label as string;
        if (o.misconception === 'not-in-story') expect(text, it.id).not.toContain(name);
        if (o.misconception === 'other-role') expect(text, it.id).toContain(name);
        if (o.correct && it.alt) expect(text, it.id).not.toContain(name);
      }
    }
  });
});
