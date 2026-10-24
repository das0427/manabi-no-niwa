/** g3.ja.romaji の内容の検査: 読み方・書き方の正答が告示のつづりの判定（judgeRomaji）と一致すること */
import { describe, expect, it } from 'vitest';
import { judgeRomaji } from '../../core/answer/romaji';
import type { ChoiceItem } from '../../curriculum/types';
import { answerTiling, judgeBuild } from '../../engines/build/build';
import { plainText } from '../../text/rich';
import { romaji } from './romaji';

const items = romaji.source.kind === 'items' ? romaji.source.items : [];
const flat = (s: string) => plainText(s).replace(/\s+/g, '');

describe('g3.ja.romaji の内容', () => {
  it('書く問題: 正答の並びが正解・誤答の例は正解でない', () => {
    for (const it of items) {
      if (it.engine !== 'build') continue;
      const t = answerTiling(it);
      expect(t, it.id).not.toBeNull();
      expect(judgeBuild(it, t!).result, it.id).toBe('correct');
      for (const w of it.wrongAnswers ?? []) {
        if (it.answer.kind !== 'romaji') continue;
        expect(judgeRomaji(it.answer.kana, w.value).result, `${it.id} ${w.value}`).not.toBe(
          'correct',
        );
      }
    }
  });

  it('読む問題: 図のローマ字は正解のかなの読み、誤りのかなの読みではない', () => {
    const reads = items.filter(
      (it): it is ChoiceItem => it.engine === 'choice' && it.figure?.kind === 'text',
    );
    expect(reads.length).toBeGreaterThan(100);
    for (const it of reads) {
      const ro = it.figure!.kind === 'text' ? it.figure!.text : '';
      for (const o of it.options) {
        const r = judgeRomaji(flat(o.label!), ro).result;
        if (o.correct) expect(r, `${it.id} ${o.label}`).toBe('correct');
        else expect(r, `${it.id} ${o.label}`).not.toBe('correct');
      }
    }
  });

  it('名前の書き方を選ぶ問題: 正解だけが告示のつづり（大文字）', () => {
    for (const it of items) {
      if (it.engine !== 'choice' || !it.id.startsWith('cap:choose:')) continue;
      const kana = it.id.slice('cap:choose:'.length);
      for (const o of it.options) {
        const ok = judgeRomaji(kana, o.label!).result === 'correct' && /^[A-ZĀĪŪĒŌ]/.test(o.label!);
        expect(ok, `${it.id} ${o.label}`).toBe(!!o.correct);
      }
    }
  });

  it('音の表（清音・濁音・半濁音・拗音・ん）が全件 読む問題にある（ぢ・づ・を を除く）', () => {
    const all =
      'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわん' +
      'がぎぐげござじずぜぞだでどばびぶべぼぱぴぷぺぽ';
    const ids = new Set(items.map((i) => i.id));
    for (const k of all) expect(ids.has(`table:read:${k}`), k).toBe(true);
    for (const h of 'きしちにひみりぎじびぴ')
      for (const s of 'ゃゅょ') expect(ids.has(`table:read:${h}${s}`), h + s).toBe(true);
  });

  it('語は80以上', () => {
    const words = new Set(
      items
        .filter((i) => /^(word|cap):/.test(i.id))
        .map((i) => i.id.replace(/^(word|cap):[a-z]+:/, '')),
    );
    expect(words.size).toBeGreaterThanOrEqual(80);
  });
});
