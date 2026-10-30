import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems, textsOf } from '../../curriculum/qa';
import type { Item, UnitSpec } from '../../curriculum/types';
import { checkReading } from '../../engines/reading/reading';
import { kanjiGrade } from '../../text/kanji-grades';
import { parseRich, type Token } from '../../text/rich';
import pack from './index';

const GRADE = 1;
/** g1/g2 の選択肢の上限（ux-by-age: 4。多いと先頭から切られ、正解が消えることがある） */
const MAX_CHOICES = 4;

/** 文の中の、よみ付きの漢字のうち配当学年が GRADE より上の字 */
function overGrade(src: string): string[] {
  const bad: string[] = [];
  const walk = (ts: Token[]) => {
    for (const t of ts) {
      if (t.t === 'ruby') for (const c of t.base) if (kanjiGrade(c) > GRADE) bad.push(c);
      if (t.t === 'strong') walk(t.children);
    }
  };
  walk(parseRich(src));
  return bad;
}

function extraChecks(unit: UnitSpec): string[] {
  const errs: string[] = [];
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
    for (const k of overGrade(t)) errs.push(`${GRADE}年より上の漢字「${k}」: ${t.slice(0, 30)}`);
  for (const it of items) {
    if (
      (it.engine === 'choice' || it.engine === 'listen' || it.engine === 'reading') &&
      !it.multi &&
      it.options.length > MAX_CHOICES
    )
      errs.push(`[${it.id}] 選択肢は${MAX_CHOICES}つまで`);
  }
  return [...new Set(errs)];
}

const unitOf = (id: string) => pack.units.find((u) => u.id === id)!;
const itemsOf = (id: string) => sampleItems(unitOf(id), 5);

describe('内容レビューの修正（g1-ja）', () => {
  it('punctuation: かぎの中の文末にも「。」を打つ形にそろっている（「おはよう。」と いいました。）', () => {
    const texts: string[] = [];
    for (const it of itemsOf('g1.ja.punctuation')) {
      if (it.engine === 'fill') {
        let t = it.text;
        for (const b of it.blanks) t = t.replace('{{}}', b.answers[0]!);
        texts.push(t);
      } else if (it.engine === 'choice') {
        texts.push(it.options.find((o) => o.correct)!.label!);
      }
    }
    const quoted = texts.filter((t) => /「[^」]*」と/.test(t));
    expect(quoted.length).toBeGreaterThanOrEqual(8);
    // 「と」に続くかぎの中は、必ず「。」か「、」などでなく、文末の「。」で終わる
    for (const t of quoted) expect(t, t).toMatch(/「[^」]*。」と/);
  });

  it('write-order: 3まいの えにっきは、ヒント②③で 順が ぜんぶは きまらない', () => {
    const items = itemsOf('g1.ja.write-order').filter(
      (it) => it.engine === 'order' && it.id.startsWith('pics'),
    );
    expect(items.length).toBeGreaterThan(8);
    for (const it of items) {
      if (it.engine !== 'order') continue;
      const labels = it.cards.map((c) => c.label ?? c.name ?? '').filter(Boolean);
      // ヒント②③に出てくる カードの名前は 1つまで（はじめの 1まいだけ）
      const text = `${it.hints[1]} ${it.hints[2]}`;
      const hit = labels.filter((l) => text.includes(l));
      expect(hit.length, it.id).toBeLessThanOrEqual(1);
    }
  });

  it('write-order: てがみの 手順は 切手を先に貼る順も 正しい', () => {
    const it = itemsOf('g1.ja.write-order').find((i) => i.id === 'cards:alt-tegami')!;
    expect(it.engine).toBe('order');
    if (it.engine === 'order') expect(it.alsoAccept).toEqual([[0, 2, 1, 3]]);
  });

  it('vocab-groups: 絵の無い「のり」を 文房具に つかわない', () => {
    for (const it of itemsOf('g1.ja.vocab-groups')) {
      const labels = JSON.stringify(it);
      expect(labels.includes('"のり"'), it.id).toBe(false);
    }
  });

  it('read-story: おむすびころりんは使わない・問題文とヒントと選択肢と解説に よみ付きの漢字が無い', () => {
    const unit = unitOf('g1.ja.read-story');
    for (const it of itemsOf('g1.ja.read-story')) {
      expect(it.id).not.toContain('omusubi');
      if (it.engine === 'reading') {
        for (const s of [
          it.prompt,
          ...it.hints,
          it.explain,
          ...it.options.map((o) => o.label ?? ''),
        ])
          expect(s, it.id).not.toContain('《');
      }
    }
    for (const s of unit.intro) expect(s.text).not.toContain('《');
    for (const m of unit.misconceptions) expect(m.explain).not.toContain('《');
  });

  it('read-info: 問題文とヒントと選択肢と解説に よみ付きの漢字が無い・実が赤くなる日は7月下旬', () => {
    const unit = unitOf('g1.ja.read-info');
    for (const it of itemsOf('g1.ja.read-info')) {
      if (it.engine === 'reading') {
        for (const s of [
          it.prompt,
          ...it.hints,
          it.explain,
          ...it.options.map((o) => o.label ?? ''),
        ])
          expect(s, it.id).not.toContain('《');
        expect(JSON.stringify(it.passage)).not.toContain('七月《しちがつ》五日');
      } else if (it.engine === 'order') {
        for (const s of [it.prompt, ...it.hints, it.explain, ...it.cards.map((c) => c.label ?? '')])
          expect(s, it.id).not.toContain('《');
      }
    }
    for (const s of unit.intro) expect(s.text).not.toContain('《');
  });

  it('sentence-build: 家事の 役わりに 性別の かたよりが ない（おとうさん＝ごはん、おかあさん＝くるま）', () => {
    const ids = itemsOf('g1.ja.sentence-build')
      .map((i) => JSON.stringify(i))
      .join('');
    expect(ids).not.toContain('おかあさんが ごはんを つくる');
    expect(ids).not.toContain('おとうさんが くるまを あらう');
  });

  it('listen: かずを こたえる 問題の せんたくしは 1つ・2つ・3つ の じゅん', () => {
    for (const id of ['two-count-bring', 'two-count-do']) {
      const it = itemsOf('g1.ja.listen').find((i) => i.id === id)!;
      if (it.engine === 'listen')
        expect(it.options.map((o) => o.label)).toEqual(['1つ', '2つ', '3つ']);
    }
  });
});

describe('P2: word-play・folktales', () => {
  const isPal = (s: string) => {
    const t = [...s.replace(/\s/g, '')];
    return t.join('') === [...t].reverse().join('');
  };
  const all = (id: string): Item[] => {
    const src = unitOf(id).source;
    return src.kind === 'items' ? src.items : [];
  };
  const correctLabel = (it: Item) =>
    (it.engine === 'choice' || it.engine === 'listen' || it.engine === 'reading') &&
    it.options.find((o) => o.correct)?.label;
  const small: Record<string, string> = { ゃ: 'や', ゅ: 'ゆ', ょ: 'よ' };
  const hira = (c: string) =>
    String.fromCharCode(
      ...[...c].map((x) => (x >= 'ァ' && x <= 'ヶ' ? x.charCodeAt(0) - 0x60 : x.charCodeAt(0))),
    );

  it('word-play: 回文の問題は 正解だけが 回文', () => {
    const items = all('g1.ja.word-play');
    let n = 0;
    for (const it of items) {
      if (it.engine === 'choice' && it.objective === 'kaibun' && !it.alt) {
        n++;
        for (const o of it.options)
          expect(isPal(o.label as string), `${it.id} ${o.label}`).toBe(!!o.correct);
      }
      if (it.engine === 'choice' && it.id.startsWith('kaibun-alt:fill-')) {
        const fig = it.figure as { text: string };
        for (const o of it.options)
          expect(isPal(fig.text.replace('□', o.label as string)), `${it.id} ${o.label}`).toBe(
            !!o.correct,
          );
      }
      if (it.engine === 'listen' && it.id.startsWith('kaibun-alt:listen-')) {
        const sounds = Array.isArray(it.audio) ? it.audio : [it.audio];
        const words = sounds.map((s) =>
          (s.text as string).replace(/^(いちばん|にばん)、/, '').replace('。', ''),
        );
        const ans = it.options.findIndex((o) => o.correct);
        words.forEach((w, i) => expect(isPal(w), `${it.id} ${w}`).toBe(i === ans));
      }
    }
    expect(n).toBe(12);
  });

  it('word-play: しりとりの 正解・誤りが つながりの きまりどおり', () => {
    for (const it of all('g1.ja.word-play')) {
      if (it.engine !== 'choice' || it.objective !== 'shiri' || it.alt) continue;
      const prev = it.id.slice('shiri:'.length);
      const lastCh = [...prev].at(-1)!;
      const L = small[lastCh] ?? hira(lastCh);
      for (const o of it.options) {
        const w = o.label as string;
        if (o.correct) {
          expect(w.startsWith(L), it.id).toBe(true);
          expect(w.endsWith('ん'), it.id).toBe(false);
        } else if (o.misconception === 'wp-shiri-n') {
          expect(w.startsWith(L) && w.endsWith('ん'), `${it.id} ${w}`).toBe(true);
        } else if (o.misconception === 'wp-shiri-head') {
          expect(w.startsWith(prev[0]!), `${it.id} ${w}`).toBe(true);
        }
      }
    }
  });

  it('word-play: 数え歌の 正解は 数の語と 同じ字で はじまり、誤りは ちがう', () => {
    for (const it of all('g1.ja.word-play')) {
      if (it.engine !== 'choice' || it.objective !== 'kazoe' || it.alt) continue;
      const num = it.id.slice('kazoe:'.length);
      for (const o of it.options)
        expect((o.label as string)[0] === num[0], `${it.id} ${o.label}`).toBe(!!o.correct);
    }
  });

  it('word-play: 数字の別例で「となりの かず」の誤りは、となりの 数の うたの ことば', () => {
    const items = all('g1.ja.word-play');
    const song = items
      .filter((i) => i.engine === 'choice' && i.objective === 'kazoe' && !i.alt)
      .map((i) => correctLabel(i));
    const digits = items.filter((i) => i.id.startsWith('kazoe-alt:digit-'));
    expect(digits.length).toBe(3);
    for (const it of digits) {
      if (it.engine !== 'choice') continue;
      const n = Number(it.id.slice('kazoe-alt:digit-'.length));
      const order = it.options.find((o) => o.misconception === 'wp-kz-order')!;
      const idx = song.indexOf(order.label as string);
      expect(Math.abs(idx + 1 - n), `${it.id} ${order.label}`).toBe(1);
    }
  });

  it('folktales: わらしべ: わらを あげて みかんを もらう（とりかえの じゅんの 根拠が 本文に ある）', () => {
    const r = all('g1.ja.folktales').find((i) => i.id === 'g1-folk-warashibe:trade-order')!;
    if (r.engine === 'reading') expect(r.passage.paragraphs[2]![1]).toContain('わらを あげると');
  });

  it('word-play: 文字の画面には 漢字のよみ《》が 無い・誤りの選択肢は ぜんぶ誤概念IDつき', () => {
    const unit = unitOf('g1.ja.word-play');
    for (const it of all('g1.ja.word-play')) {
      expect(JSON.stringify(textsOf(it)), it.id).not.toContain('《');
      if (it.engine === 'choice' || it.engine === 'listen')
        for (const o of it.options)
          if (!o.correct) expect(o.misconception, `${it.id} ${o.label}`).toBeTruthy();
    }
    for (const s of unit.intro) expect(s.text).not.toContain('《');
    for (const m of unit.misconceptions) expect(m.explain).not.toContain('《');
    expect(unit.misconceptions.length).toBe(14);
  });

  it('folktales: 問題文・ヒント・解説・選択肢に よみ付きの漢字が無い', () => {
    const unit = unitOf('g1.ja.folktales');
    for (const it of all('g1.ja.folktales')) {
      if (it.engine !== 'listen' && it.engine !== 'reading') continue;
      for (const s of [it.prompt, ...it.hints, it.explain, ...it.options.map((o) => o.label ?? '')])
        expect(s, it.id).not.toContain('《');
    }
    for (const s of unit.intro) expect(s.text).not.toContain('《');
    for (const m of unit.misconceptions) expect(m.explain).not.toContain('《');
  });

  it('folktales: 本文6本・どの本文も 設問6（listen 4・reading 2）', () => {
    const per = new Map<string, { l: number; r: number }>();
    for (const it of all('g1.ja.folktales')) {
      const pid = it.id.split(':')[0]!;
      const e = per.get(pid) ?? { l: 0, r: 0 };
      if (it.engine === 'listen') e.l++;
      if (it.engine === 'reading') e.r++;
      per.set(pid, e);
    }
    expect(per.size).toBe(6);
    for (const e of per.values()) expect(e).toEqual({ l: 4, r: 2 });
  });

  it('folktales: listen は 題＋段落の音で、答え画面に 本文を出さない', () => {
    const reading = all('g1.ja.folktales').filter((i) => i.engine === 'reading');
    const byId = new Map(reading.map((i) => [i.id.split(':')[0]!, i]));
    for (const it of all('g1.ja.folktales')) {
      if (it.engine !== 'listen') continue;
      expect(it.hideTranscript, it.id).toBe(true);
      const sounds = Array.isArray(it.audio) ? it.audio : [it.audio];
      const r = byId.get(it.id.split(':')[0]!)!;
      if (r.engine === 'reading')
        expect(sounds.length, it.id).toBe(r.passage.paragraphs.length + 1);
    }
  });

  it('folktales: reading の根拠が 空でなく 本文を指す', () => {
    for (const it of all('g1.ja.folktales')) {
      if (it.engine !== 'reading') continue;
      expect(it.evidence?.length, it.id).toBeGreaterThan(0);
      expect(checkReading(it), it.id).toEqual([]);
    }
  });

  it('id に 定番教材・read-story の語が 入らない', () => {
    for (const id of ['g1.ja.word-play', 'g1.ja.folktales'])
      for (const it of all(id))
        for (const bad of ['omusubi', 'kasa', 'kabu', 'nezumi']) expect(it.id).not.toContain(bad);
    expect(correctLabel(all('g1.ja.word-play')[0]!)).toBeTruthy();
  });
});

describe('g1-ja の教材検査（curriculum-matrix 1.8）', () => {
  it('パックの形', () => {
    expect(pack.packId).toBe('g1-ja');
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
});
