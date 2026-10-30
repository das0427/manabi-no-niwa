import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems, textsOf } from '../../curriculum/qa';
import type { UnitSpec } from '../../curriculum/types';
import { kanjiGrade } from '../../text/kanji-grades';
import { parseRich, plainText, type Token } from '../../text/rich';
import pack from './index';
import { TANKA } from './tanka';

const GRADE = 4;
/** g3/g4 の選択肢の上限（ux-by-age: 4。多いと先頭から切られ、正解が消えることがある） */
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

/**
 * 学年より上でも使ってよい字（教科の用語で必要なもの。curriculum-matrix 2.1）。
 * 足すときは理由をコメントに書く。
 */
const ALLOWED_OVER: ReadonlySet<string> = new Set([
  // 句（5年）: 短歌の用語「上の句・下の句」に必要（g4.ja.tanka。curriculum-matrix 2.1 教科の用語）
  '句',
]);

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
    for (const k of overGrade(t))
      if (!ALLOWED_OVER.has(k)) errs.push(`${GRADE}年より上の漢字「${k}」: ${t.slice(0, 30)}`);
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

/**
 * 小3以上は通常の文（curriculum-matrix 2.1）。分かち書きの残りを探す。
 * 本文（詩の行・日記の見出し）・選択肢は見ない。「」『』の中（引用・詩の引用）と、
 * 作者名の姓と名の間（「森 ゆうき」）は空白を残してよい。
 */
function wakachiLeft(units: readonly UnitSpec[]): string[] {
  const ja = /[ぁ-ヿ一-鿿々]\p{Zs}+[ぁ-ヿ一-鿿々]/u;
  const errs = new Set<string>();
  for (const unit of units) {
    if (unit.status === 'planned') continue;
    const texts = [
      unit.title,
      ...unit.intro.map((s) => s.text),
      ...unit.misconceptions.map((m) => m.explain),
      ...unit.objectives.map((o) => o.title),
    ];
    for (const it of sampleItems(unit, 50)) {
      const x = it as { prompt?: string; hints?: string[]; explain?: string };
      texts.push(x.prompt ?? '', ...(x.hints ?? []), x.explain ?? '');
    }
    for (const t of texts) {
      const p = t
        .replace(/《[^》]*》/g, '')
        .replace(/「[^「」]*」|『[^『』]*』/g, '「」')
        .replace(/[一-鿿]{1,3} [ぁ-ん]{2,4}(?=[、，）』」]|が|$)/g, '名');
      if (ja.test(p)) errs.add(`${unit.id}: ${p.slice(0, 50)}`);
    }
  }
  return [...errs];
}

describe('位置で解けない・小3以上は通常の文（content-review-g34 重大8・中-C）', () => {
  it('fixedOrder の選択肢で正解の位置がかたよらない', () => {
    const errs: string[] = [];
    for (const unit of pack.units) {
      if (unit.status === 'planned') continue;
      const pos: number[] = [];
      for (const it of sampleItems(unit, 50))
        if (
          (it.engine === 'choice' || it.engine === 'reading') &&
          'fixedOrder' in it &&
          it.fixedOrder
        )
          pos.push(it.options.findIndex((o) => o.correct));
      if (pos.length >= 3 && new Set(pos).size < 2)
        errs.push(`${unit.id}: fixedOrder の ${pos.length} 問で正解がいつも ${pos[0]! + 1} 番目`);
    }
    expect(errs).toEqual([]);
  });

  it('plain-polite-style shiki: 選択肢の並びがどの問題でも同じ（ラベル順で固定）', () => {
    const u = pack.units.find((x) => x.id === 'g4.ja.plain-polite-style');
    if (!u || u.source.kind !== 'items') throw new Error('plain-polite-style がない');
    const orders = new Set<string>();
    const pos = new Set<number>();
    for (const it of u.source.items)
      if (it.engine === 'choice' && it.id.startsWith('shiki:')) {
        orders.add(it.options.map((o) => o.label).join('|'));
        pos.add(it.options.findIndex((o) => o.correct));
      }
    expect(orders.size).toBe(1);
    expect(pos.size).toBe(2);
  });

  it('題・説明・問題文・ヒント・解説に文節分かち書き（日本語どうしの間の空白）がない', () => {
    expect(wakachiLeft(pack.units)).toEqual([]);
  });
});

describe('g4-ja の教材検査（curriculum-matrix 1.8）', () => {
  it('パックの形', () => {
    expect(pack.packId).toBe('g4-ja');
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

describe('g4.ja.tanka', () => {
  const unit = pack.units.find((u) => u.id === 'g4.ja.tanka');
  if (!unit || unit.source.kind !== 'items') throw new Error('tanka がない');
  const items = unit.source.items;

  /** RichText をかなにする（カタカナはひらがなに。「ー」は残す） */
  function kana(src: string): string {
    const walk = (ts: Token[]): string =>
      ts
        .map((t) =>
          t.t === 'ruby'
            ? t.reading
            : t.t === 'text'
              ? t.s
              : t.t === 'strong'
                ? walk(t.children)
                : '',
        )
        .join('');
    return walk(parseRich(src))
      .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
      .replace(/[^ぁ-ゖー]/g, '');
  }
  /** 音の数: 小さい「ゃゅょぁぃぅぇぉゎ」は数えず、ほかの字（「っ」「ん」「ー」を含む）を1つと数える */
  const mora = (src: string): number =>
    [...kana(src)].filter((c) => !'ゃゅょぁぃぅぇぉゎ'.includes(c)).length;
  const visible = (src: string): string => src.replace(/《[^》]*》/g, '').replace(/\s+/g, '');

  it('音を数える関数（例）', () => {
    expect(mora('しゅわしゅわと')).toBe(5);
    expect(mora('おばあちゃん')).toBe(5);
    expect(mora('ソーダのあわが')).toBe(7);
    expect(mora('ゆっくりとゆく')).toBe(7);
    expect(mora('校庭《こうてい》のすみ')).toBe(7);
  });

  it('全10首の句の音の数が 5・7・5・7・7', () => {
    expect(TANKA.length).toBe(10);
    for (const t of TANKA) expect(t.ku.map(mora), t.id).toEqual([5, 7, 5, 7, 7]);
  });

  it('oto: 正解の音の数が audio の音の数と同じ・誤りの値が重ならない', () => {
    const oto = items.filter((it) => it.id.startsWith('oto:'));
    expect(oto.length).toBe(12);
    for (const it of oto) {
      if (it.engine !== 'listen') throw new Error(it.id);
      const nums = it.options.map((o) => parseInt(o.label ?? '', 10));
      expect(new Set(nums).size, it.id).toBe(nums.length);
      const right = it.options.find((o) => o.correct);
      const a = Array.isArray(it.audio) ? it.audio[0]! : it.audio;
      expect(parseInt(right?.label ?? '', 10), it.id).toBe(mora(a.text));
      expect(nums, it.id).toEqual([...nums].sort((x, y) => x - y));
    }
  });

  it('build: 正解の区切りの音の数・誤答の区切りとの違い・タイルは8字以内', () => {
    for (const it of items) {
      if (it.engine !== 'build') continue;
      if (it.answer.kind !== 'text') throw new Error(it.id);
      const parts = it.answer.values[0]!.split(' ');
      if (it.id.startsWith('kiru:')) {
        expect(parts.map(mora), it.id).toEqual(parts.length === 3 ? [5, 7, 5] : [7, 7]);
      } else expect(parts.map(mora), it.id).toEqual([7, 7]);
      for (const w of it.wrongAnswers ?? []) {
        expect(w.value, it.id).not.toBe(it.answer.values[0]);
        if (w.misconception !== 'tk-order')
          expect(w.value.split(' ').map(mora), `${it.id}: ${w.value}`).not.toEqual(parts.map(mora));
      }
      for (const t of it.tiles) expect(visible(t).length, `${it.id}: ${t}`).toBeLessThanOrEqual(8);
    }
  });

  it('listen: 選択肢4つ・正解1つ・誤りすべてに誤概念・audio に英字なし', () => {
    for (const it of items) {
      if (it.engine !== 'listen') continue;
      expect(it.options.length, it.id).toBe(4);
      expect(it.options.filter((o) => o.correct).length, it.id).toBe(1);
      for (const o of it.options) if (!o.correct) expect(o.misconception, it.id).toBeTruthy();
      const sounds = Array.isArray(it.audio) ? it.audio : [it.audio];
      for (const s of sounds) expect(/[A-Za-z]/.test(s.text), it.id).toBe(false);
    }
  });

  it('audio は歌の句と同じ（O2 別例は続けて1つ・O3/O4 は5つの音）', () => {
    for (const it of items) {
      if (it.engine !== 'listen') continue;
      const sounds = Array.isArray(it.audio) ? it.audio : [it.audio];
      if (it.id.startsWith('oto:')) continue;
      if (it.id.startsWith('kiru-kiku:')) {
        const t = TANKA.find((x) => x.id === it.id.slice('kiru-kiku:'.length))!;
        expect(sounds.length, it.id).toBe(1);
        expect(sounds[0]!.text, it.id).toBe(t.ku.join(''));
      } else {
        const t = TANKA.find((x) => it.identity.split(':').includes(x.id) || it.id.endsWith(x.id));
        expect(sounds.length, it.id).toBe(5);
        if (t && !it.identity.includes(':fact:'))
          expect(
            sounds.map((s) => s.text),
            it.id,
          ).toEqual(t.ku);
      }
    }
  });

  it('kisetsu: 正解の季節が歌の season と一致する（朝顔は使わない）', () => {
    const ks = items.filter((it) => it.id.startsWith('kisetsu:'));
    expect(ks.length).toBe(5);
    for (const it of ks) {
      if (it.engine !== 'listen') throw new Error(it.id);
      const t = TANKA.find((x) => x.id === it.id.slice('kisetsu:'.length))!;
      expect(t.id).not.toBe('asagao');
      const right = it.options.find((o) => o.correct)!;
      expect(plainText(right.label ?? '')).toBe(t.season);
    }
  });
});
