// @vitest-environment node
/// <reference types="node" />
/**
 * 教材レビュー（2026-10-24）で見つけた誤りの再発防止。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sampleItems, textsOf } from '../../curriculum/qa';
import { KANJI_BY_GRADE, kanjiGrade } from '../../text/kanji-grades';
import { plainText } from '../../text/rich';
import pack from './index';
import { HOMOPHONE_OF, readingsOf } from './shared';
import { FIRST_STROKE_OF, STROKES_OF } from './data/strokes';
import { ENTRIES_ALL, ENTRY_OF } from './table';

/** 学年別漢字配当表（平成29年告示）第1学年・第2学年 */
const OFFICIAL_G1 =
  '一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森人水正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六';
const OFFICIAL_G2 =
  '引羽雲園遠何科夏家歌画回会海絵外角楽活間丸岩顔汽記帰弓牛魚京強教近兄形計元言原戸古午後語工公広交光考行高黄合谷国黒今才細作算止市矢姉思紙寺自時室社弱首秋週春書少場色食心新親図数西声星晴切雪船線前組走多太体台地池知茶昼長鳥朝直通弟店点電刀冬当東答頭同道読内南肉馬売買麦半番父風分聞米歩母方北毎妹万明鳴毛門夜野友用曜来里理話';

describe('配当表と画数（レビュー）', () => {
  it('配当表は1年80字・2年160字で、告示の表と同じ・重なりなし', () => {
    expect([...OFFICIAL_G1].length).toBe(80);
    expect([...OFFICIAL_G2].length).toBe(160);
    expect([...KANJI_BY_GRADE[1]].sort()).toEqual([...OFFICIAL_G1].sort());
    expect([...KANJI_BY_GRADE[2]].sort()).toEqual([...OFFICIAL_G2].sort());
    expect([...OFFICIAL_G1].filter((c) => OFFICIAL_G2.includes(c))).toEqual([]);
  });

  it('画数の表は、なぞりに使う書き順データ（KanjiVG）の画の数と全字で一致する', () => {
    const dir = fileURLToPath(new URL('../_data/strokes/', import.meta.url));
    for (const g of [1, 2]) {
      const data = JSON.parse(readFileSync(join(dir, `kanji-g${g}.json`), 'utf-8')) as {
        chars: Record<string, { strokes: unknown[] }>;
      };
      for (const ch of KANJI_BY_GRADE[g as 1 | 2]) {
        expect(STROKES_OF.get(ch), ch).toBe(data.chars[ch]!.strokes.length);
      }
    }
  });

  it('はじめの画の問いに、筆順が教科書で分かれる字（北）を使わない', () => {
    expect(FIRST_STROKE_OF.has('北')).toBe(false);
  });
});

describe('読み問題: 誤りの選択肢でも読めてしまう語を使わない（レビュー）', () => {
  // [字, 語] … ほかの読みの選択肢（同じ字の音訓）でも正しく読める語
  const AMBIGUOUS: [string, string][] = [
    ['入', '入る'], // はいる／いる
    ['入', '入れる'], // いれる／はいれる
    ['止', '止める'], // とめる／やめる
    ['場', '工場'], // こうじょう／こうば
    ['音', '音'], // おと／ね（1字だけでは決まらない）
  ];
  it.each(AMBIGUOUS)('「%s」の語例に「%s」が無い', (ch, plain) => {
    const e = ENTRY_OF.get(ch)!;
    expect(e.words.map((w) => w.plain)).not.toContain(plain);
  });

  it('語例・文の太字の字の読みは、その字の音訓のうち1つだけ（表の検査の再確認）', () => {
    for (const e of ENTRIES_ALL)
      for (const o of [...e.words, e.sentence])
        expect(readingsOf(e).filter((r) => r === o.part).length, `${e.ch} ${o.plain}`).toBe(1);
  });
});

describe('生成した問題（レビュー）', () => {
  it('問題文・ヒント・選択肢・解説の漢字は、その単元の学年までの字だけ', () => {
    for (const unit of pack.units) {
      const grade = unit.stage === 'g1' ? 1 : 2;
      for (const it of sampleItems(unit, 150)) {
        const texts = [
          ...textsOf(it),
          JSON.stringify(it.figure ?? ''),
          JSON.stringify(it.explainFigure ?? ''),
        ];
        for (const t of texts)
          for (const c of t.match(/[一-鿿]/gu) ?? [])
            expect(kanjiGrade(c), `${unit.id} ${it.id} 「${c}」 ${t}`).toBeLessThanOrEqual(grade);
      }
    }
  });

  it('書きの「えらぶ」: 誤りの字は太字の読みを持たない（同音の表で人が選んだ字を除く）', () => {
    for (const unit of pack.units.filter((u) => u.kind === 'writing')) {
      for (const it of sampleItems(unit, 300)) {
        if (it.engine !== 'choice' || !/^c[sw]:/.test(it.id)) continue;
        const ch = it.id.split(':')[1]!;
        const part = /\*\*([^*]+)\*\*/.exec(it.prompt)?.[1] ?? '';
        expect(part, it.id).not.toBe('');
        expect(it.options.filter((o) => o.correct).length, it.id).toBe(1);
        for (const o of it.options) {
          if (o.correct) continue;
          const c = [...plainText(o.label ?? '')][0]!;
          const x = ENTRY_OF.get(c)!;
          if (!readingsOf(x).includes(part)) continue;
          expect(o.misconception, `${it.id} ${c}`).toBe('same-sound');
          expect(HOMOPHONE_OF.get(ch) ?? [], `${it.id} ${c}`).toContain(c);
        }
      }
    }
  });
});
