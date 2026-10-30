// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems, textsOf } from '../../curriculum/qa';
import type { ChoiceOption, Item, ListenItem, UnitSpec } from '../../curriculum/types';
import { enG34Illust } from '../../illust/content/en-g34';
import { enPreIllust } from '../../illust/content/en-pre';
import { getIllust } from '../../illust/registry';
import { soundsOf } from '../../engines/listen/listen';
import pack from './index';
import { PRONOUNCE } from './pronounce';
import { ALL_WORDS, BODY, COLORS, COUNTABLES } from './vocab';
import { BOOKS } from './picture-book';
import { englishScript } from './voice';

/** 絵が あるか（registry の content の自動読み込みは変換キャッシュで新しいファイルが入らないことがあるので、直接も見る） */
const known = (id: string) => !!getIllust(id) || id in enPreIllust || id in enG34Illust;

const listens = (u: UnitSpec): ListenItem[] =>
  sampleItems(u, 1).map((it: Item) => {
    expect(it.engine, `${u.id} ${it.id}`).toBe('listen');
    return it as ListenItem;
  });

/** 子供に見える文字（設計書 2.2・11.1-3） */
function childTexts(u: UnitSpec): string[] {
  const out: string[] = [
    u.title,
    ...u.objectives.map((o) => o.title),
    ...u.intro.map((s) => s.text),
    ...u.misconceptions.map((m) => m.explain),
  ];
  for (const it of listens(u)) {
    out.push(it.prompt, ...it.hints, it.explain);
    for (const o of it.options) if (o.label !== undefined) out.push(o.label);
    // 答えの後の音声の日本語の文（key 無し）
    for (const s of it.revealAudio ?? []) if (!s.key) out.push(s.text);
  }
  return out;
}

/** カタカナで書いてよい語（物の名前。設計書 6章）。語彙の日本語の名前だけ */
const KATAKANA_OK = [
  ...ALL_WORDS.map((w) => w.ja),
  ...COLORS.flatMap((c) => [c.ja, c.jaBall]),
  ...COUNTABLES.map((c) => c.ja),
  ...BOOKS.flatMap((b) => b.pages.map((p) => p.ja)),
  'ジャンプ',
  // 絵本の「ページ」（設計書 2.2 の問題文）
  'ページ',
  // 単元名「えいごで タッチ」（設計書 2章）
  'タッチ',
].join('/');

describe('en-pre の教材検査（設計書 11.1）', () => {
  it('1. パックの形', () => {
    expect(pack.packId).toBe('en-pre');
    const ids = pack.units.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^(p23|p4|p5)\.en\.[a-z0-9-]+$/);
    for (const u of pack.units) {
      expect(u.subject).toBe('en');
      expect(u.gentleJudgement).toBe(true);
      expect(u.parentNote, u.id).toBeTruthy();
      expect(u.stage, u.id).toBe(u.id.split('.')[0]);
    }
  });

  for (const unit of pack.units) {
    describe(unit.id, () => {
      it('2. checkUnit の誤りなし・ready なら isReady', () => {
        const r = checkUnit(unit);
        expect(r.errors).toEqual([]);
        if (unit.status === 'ready') expect(isReady(r)).toBe(true);
        console.info(
          `${unit.id}: Q ${r.q.toFixed(2)} (${r.distinct}) / C ${r.c[0]}/${r.c[1]} / 誤概念 ${unit.misconceptions.length} / ${r.objectives.map((o) => `${o.id}:${o.distinct}+${o.alt}`).join(' ')}`,
        );
      });

      it('3. 子供に見える文字に英字・漢字・絵文字が無い。カタカナは物の名前だけ', () => {
        const bad: string[] = [];
        for (const t of childTexts(unit)) {
          if (/[A-Za-z]/.test(t)) bad.push(`英字: ${t}`);
          if (/[一-鿿々〆]/.test(t)) bad.push(`漢字: ${t}`);
          if (/\p{Extended_Pictographic}/u.test(t)) bad.push(`絵文字: ${t}`);
          if (/[0-9０-９]/.test(t)) bad.push(`数字: ${t}`);
          for (const k of t.match(/[ァ-ヺー]+/g) ?? [])
            if (!KATAKANA_OK.includes(k)) bad.push(`カタカナ「${k}」: ${t}`);
        }
        expect([...new Set(bad)]).toEqual([]);
      });

      it('4. すべて listen で nameBack・replay・hideTranscript', () => {
        for (const it of listens(unit)) {
          expect(it.hideTranscript, it.id).toBe(true);
          expect(it.nameBack, it.id).toBe(true);
          expect(it.replay, it.id).toEqual({ afterWrong: true, onHint: true });
          expect(it.multi, it.id).toBeFalsy();
        }
      });

      it('5. 英語の音声の key は en/en-pre. で始まる。英字を含む音声に key がある', () => {
        for (const it of listens(unit)) {
          const all = [
            ...soundsOf(it),
            ...(it.revealAudio ?? []),
            ...it.options.flatMap((o) => (o.sound ? [o.sound] : [])),
          ];
          for (const s of all) {
            if (/[A-Za-z]/.test(s.text))
              expect(s.key, `${it.id} ${s.text}`).toMatch(/^en\/en-pre\./);
            else expect(s.key ?? '', it.id).toBe('');
          }
          expect(
            it.options.every((o) => o.sound),
            it.id,
          ).toBe(true);
        }
      });

      it('7. 選択肢の数（p23: 段階0は2・段階1は3以下／p4: 3〜4（絵本の段階0は2）／p5: 4）', () => {
        for (const it of listens(unit)) {
          const n = it.options.length;
          if (unit.stage === 'p23') {
            if (it.level === 0) expect(n, it.id).toBe(2);
            else expect(n, it.id).toBeLessThanOrEqual(3);
          } else if (unit.stage === 'p4') {
            if (unit.id === 'p4.en.picture-book' && it.level === 0) expect(n, it.id).toBe(2);
            else {
              expect(n, it.id).toBeGreaterThanOrEqual(3);
              expect(n, it.id).toBeLessThanOrEqual(4);
            }
          } else expect(n, it.id).toBe(4);
        }
      });

      it('8. 赤いボールと緑のボールが同じ問題に無い', () => {
        const colorsIn = (o: ChoiceOption): string[] => {
          const found: string[] = [];
          const walk = (x: unknown) => {
            if (Array.isArray(x)) x.forEach(walk);
            else if (x && typeof x === 'object') {
              const r = x as Record<string, unknown>;
              if (r.kind === 'illust' && typeof r.id === 'string') {
                const m = /^enpre-ball-(\w+)$/.exec(r.id);
                if (m) found.push(m[1]!);
              }
              Object.values(r).forEach(walk);
            }
          };
          walk(o.figure);
          return found;
        };
        for (const it of listens(unit)) {
          const cs = new Set(it.options.flatMap(colorsIn));
          expect(cs.has('red') && cs.has('green'), it.id).toBe(false);
        }
      });

      it('8. トマトとかえる（赤と緑）が同じ問題に無い', () => {
        for (const it of listens(unit)) {
          const ids = it.options.map((o) => (o.figure?.kind === 'illust' ? o.figure.id : ''));
          expect(ids.includes('tomato') && ids.includes('frog'), it.id).toBe(false);
        }
      });

      it('10. 誤りの選択肢すべてに誤概念ID（汎用の誤答 0%）。正解に付けない', () => {
        for (const it of listens(unit))
          for (const o of it.options)
            if (o.correct) expect(o.misconception, it.id).toBeUndefined();
            else expect(o.misconception, it.id).toBeTruthy();
      });

      it('11. ヒントが答えの日本語の名前を含まない', () => {
        for (const it of listens(unit)) {
          const right = it.options.find((o) => o.correct)?.label;
          // 1字の名前（て）は ヒントの ふつうの 文に 入ってしまうので 見ない
          if (!right || [...right].length < 2) continue;
          for (const h of it.hints) expect(h.includes(right), `${it.id}: ${h}`).toBe(false);
        }
      });

      it('12. 量: 各到達項目に別例が3つ以上・異なる問題が12以上', () => {
        const r = checkUnit(unit);
        expect(r.distinct).toBeGreaterThanOrEqual(12);
        for (const o of r.objectives) expect(o.alt, `${unit.id} ${o.id}`).toBeGreaterThanOrEqual(3);
      });

      it('14. 使っている絵がすべてある', () => {
        const missing: string[] = [];
        const walk = (x: unknown): void => {
          if (Array.isArray(x)) for (const v of x) walk(v);
          else if (x && typeof x === 'object') {
            const o = x as Record<string, unknown>;
            if (o.kind === 'illust' && typeof o.id === 'string' && !known(o.id)) missing.push(o.id);
            for (const v of Object.values(o)) walk(v);
          }
        };
        if (!known(unit.icon)) missing.push(unit.icon);
        walk(unit.intro);
        walk(sampleItems(unit, 1));
        expect([...new Set(missing)]).toEqual([]);
      });
    });
  }

  it('12. p23.en.words: 段階0の異なる同一性キー ≥8、各段階 ≥12', () => {
    const u = pack.units.find((x) => x.id === 'p23.en.words')!;
    const keys = (level: number) =>
      new Set(
        listens(u)
          .filter((i) => i.level === level)
          .map((i) => i.identity),
      );
    expect(keys(0).size).toBeGreaterThanOrEqual(8);
    expect(keys(1).size).toBeGreaterThanOrEqual(12);
  });

  it('6. 語の選択肢の sound は、その絵の語の key', () => {
    const wordOfIllust = new Map(ALL_WORDS.map((w) => [w.illust, w]));
    const checked = ['p23.en.words', 'p4.en.words'];
    for (const u of pack.units.filter((x) => checked.includes(x.id)))
      for (const it of listens(u))
        for (const o of it.options) {
          const fig = o.figure;
          expect(fig?.kind, it.id).toBe('illust');
          const w = wordOfIllust.get((fig as { id: string }).id)!;
          expect(w, `${it.id} ${(fig as { id: string }).id}`).toBeTruthy();
          expect(o.sound?.key, it.id).toBe(`en/en-pre.word.${w.id}`);
        }
  });

  it('9. same-start の組は、はじめの音が同じ語どうしだけ', () => {
    // 語・色・あいさつの台本 → はじめの音の仲間
    const group = new Map<string, string>();
    for (const w of ALL_WORDS) if (w.start) group.set(w.text, w.start);
    for (const c of COLORS) if (c.start) group.set(c.text, c.start);
    group.set('Good morning!', 'g');
    group.set('Good night!', 'g');
    let n = 0;
    for (const u of pack.units)
      for (const it of listens(u)) {
        const right = it.options.find((o) => o.correct)!;
        for (const o of it.options)
          if (o.misconception === 'same-start') {
            n++;
            const a = group.get(right.sound!.text);
            const b = group.get(o.sound!.text);
            expect(a, `${it.id} ${right.sound!.text}`).toBeTruthy();
            expect(b, `${it.id} ${o.sound!.text}`).toBe(a);
          }
      }
    expect(n).toBeGreaterThan(0);
  });

  it('からだの語の日本語の名前が、ほかの語とまぎれない（はな）', () => {
    const nose = BODY.find((w) => w.id === 'nose')!;
    expect(nose.ja).toBe('はな（かお）');
    // 同じ問題に「はな（かお）」と「はな（くさばな）」を並べない
    for (const u of pack.units)
      for (const it of listens(u)) {
        const labels = it.options.map((o) => o.label ?? '');
        expect(labels.filter((l) => l.startsWith('はな')).length, it.id).toBeLessThanOrEqual(1);
      }
  });

  it('15. 絵本: 同じ本のページが同じ絵を2回使わない。段階2の問題に図が無い', () => {
    for (const b of BOOKS) {
      const figs = b.pages.map((p) => JSON.stringify(p.figure));
      expect(new Set(figs).size, b.id).toBe(4);
      for (const p of b.pages) expect(p.text).toMatch(/^[A-Z].*[.!?]$/);
    }
    const u = pack.units.find((x) => x.id === 'p4.en.picture-book')!;
    for (const it of listens(u)) if (it.level === 2) expect(it.figure, it.id).toBeUndefined();
    // 段階0・1 は4ページの絵の帯つき
    for (const it of listens(u)) if (it.level === 0) expect(it.figure?.kind, it.id).toBe('row');
  });

  it('13. 英語の台本: 同じ key に違う文が無い・script-en.json と一致・文の書き方', () => {
    const { entries, clash } = englishScript(pack);
    expect(clash).toEqual([]);
    for (const e of entries) {
      expect(e.key).toMatch(/^en-pre\.[a-z0-9._-]+$/);
      // 数字は単語で書く。単語・文は大文字で始まり、句点などで終わる
      expect(e.text, e.key).not.toMatch(/[0-9]/);
      expect(e.text, e.key).toMatch(/^[A-Z].*[.!?]$/);
    }
    const file = fileURLToPath(new URL('./script-en.json', import.meta.url));
    const json = JSON.parse(readFileSync(file, 'utf8')) as {
      defaults: { speed: number; voice: string; lang: string };
      entries: unknown[];
    };
    expect(json.defaults).toEqual({ speed: 0.85, voice: 'af_heart', lang: 'en-us' });
    expect(json.entries).toEqual(entries);
    // 発音の上書きは台本にある key だけ。話速の倍率は 0.7 以上（実効 0.6 未満にしない）
    const keys = new Set(entries.map((e) => e.key));
    for (const [k, v] of Object.entries(PRONOUNCE)) {
      expect(keys.has(k), k).toBe(true);
      if (v.speed !== undefined) expect(v.speed).toBeGreaterThanOrEqual(0.7);
    }
    console.info(`en-pre 英語の台本: ${entries.length} 本`);
  });

  it('textsOf が拾う日本語の文に、英字を含むものが無い（問題文・解説の取りこぼし防止）', () => {
    for (const u of pack.units)
      for (const it of listens(u))
        for (const t of textsOf({
          prompt: it.prompt,
          hints: it.hints,
          explain: it.explain,
          labels: it.options.map((o) => o.label),
        }))
          expect(/[A-Za-z]/.test(t), `${it.id}: ${t}`).toBe(false);
  });

  it('「ひとつ ちがい」（near-number）の選択肢は、正解と数が ちょうど1 ちがう', () => {
    const countOf = (o: ChoiceOption): number | undefined =>
      o.figure && o.figure.kind === 'illust' ? o.figure.count : undefined;
    let seen = 0;
    for (const u of pack.units)
      for (const it of listens(u)) {
        const right = it.options.find((o) => o.correct)!;
        for (const o of it.options) {
          if (o.misconception !== 'near-number') continue;
          const a = countOf(right);
          const b = countOf(o);
          expect(a, `${it.id}`).toBeDefined();
          expect(Math.abs(b! - a!), `${it.id}`).toBe(1);
          seen++;
        }
      }
    expect(seen).toBeGreaterThan(0);
  });
});
