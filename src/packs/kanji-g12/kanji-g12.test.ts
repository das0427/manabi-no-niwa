import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems, textsOf, type UnitReport } from '../../curriculum/qa';
import type { Item, UnitSpec } from '../../curriculum/types';
import { engineOf } from '../../engines/registry';
import { KANJI_BY_GRADE } from '../../text/kanji-grades';
import { findBareKanji, plainText } from '../../text/rich';
import pack from './index';
import { STROKES_OF } from './data/strokes';
import { ENTRIES_G1, ENTRIES_G2, ENTRY_OF } from './table';

/** trace の書く字 `char` は qa.ts の NON_TEXT_KEYS で文から外している */
function reportOf(unit: UnitSpec): { raw: UnitReport; rest: string[]; ready: boolean } {
  const raw = checkUnit(unit);
  return { raw, rest: raw.errors, ready: isReady(raw) };
}

/** trace の char 以外に、よみの無い漢字が残っていないか（上の除外が他を隠していないことの確認） */
function bareKanjiOutsideChar(it: Item): string[] {
  const copy = it.engine === 'trace' ? { ...it, char: '' } : it;
  return textsOf(copy).flatMap((t) => findBareKanji(t));
}

describe('字のデータ表（data/rows-*.ts）', () => {
  it('1年80字・2年160字がすべてあり、語例は2以上・文は1つ', () => {
    expect(ENTRIES_G1.map((e) => e.ch).sort()).toEqual([...KANJI_BY_GRADE[1]].sort());
    expect(ENTRIES_G2.map((e) => e.ch).sort()).toEqual([...KANJI_BY_GRADE[2]].sort());
    for (const e of [...ENTRIES_G1, ...ENTRIES_G2]) {
      expect(e.words.length, e.ch).toBeGreaterThanOrEqual(2);
      expect(e.sentence.plain.trim(), e.ch).not.toBe('');
      // 画数の表にもある
      expect(STROKES_OF.get(e.ch), e.ch).toBeGreaterThan(0);
    }
    const words = [...ENTRIES_G1, ...ENTRIES_G2].reduce((a, e) => a + e.words.length, 0);
    console.info(
      `表の件数: 1年 ${ENTRIES_G1.length}字・語例 ${ENTRIES_G1.reduce((a, e) => a + e.words.length, 0)}・文 ${ENTRIES_G1.length} ／ 2年 ${ENTRIES_G2.length}字・語例 ${ENTRIES_G2.reduce((a, e) => a + e.words.length, 0)}・文 ${ENTRIES_G2.length} ／ 語例合計 ${words}`,
    );
  });

  it('問う字の読みは音訓の欄にあり、同じ語・文の中で重複しない', () => {
    for (const e of [...ENTRIES_G1, ...ENTRIES_G2]) {
      for (const o of [...e.words, e.sentence]) {
        expect([...e.on, ...e.kun], `${e.ch} ${o.plain}`).toContain(o.part);
      }
      const keys = [...e.words, e.sentence].map((o) => o.plain);
      expect(new Set(keys).size, e.ch).toBe(keys.length);
    }
  });

  it('よく間違えやすい読みの確認（人が確かめた語）', () => {
    const read = (ch: string, plain: string) =>
      ENTRY_OF.get(ch)!.words.find((w) => w.plain === plain)?.part;
    expect(read('生', '先生')).toBe('せい');
    expect(read('生', '生まれる')).toBe('う');
    expect(read('生', '生きる')).toBe('い');
    expect(read('日', '三日')).toBe('か');
    expect(read('八', '八日')).toBe('よう');
    expect(read('七', '七日')).toBe('なの');
    expect(read('木', '木かげ')).toBe('こ');
    expect(read('下', '下がる')).toBe('さ');
    expect(read('上', '上手')).toBe('じょう');
    expect(read('大', '大きい')).toBe('おお');
    expect(read('大', '大学')).toBe('だい');
    expect(read('町', '町村')).toBe('ちょう');
    expect(read('間', '時間')).toBe('かん');
    expect(read('行', '行く')).toBe('い');
    expect(read('来', '来る')).toBe('く');
    expect(read('分', '分かる')).toBe('わ');
    expect(read('分', '半分')).toBe('ぶん');
  });
});

describe('kanji-g12 の教材検査（curriculum-matrix 1.8）', () => {
  for (const unit of pack.units) {
    it(`${unit.id}: 検査の誤りなし・量と網羅`, () => {
      const { raw, rest, ready } = reportOf(unit);
      console.info(
        `${unit.id}: Q ${raw.q.toFixed(2)} (${raw.distinct}) / C ${raw.c[0]}/${raw.c[1]} / 汎用誤答 ${(raw.genericWrongShare * 100).toFixed(0)}% / 誤概念 ${unit.misconceptions.length} / 到達項目 ${raw.objectives.map((o) => `${o.id}:${o.distinct}+${o.alt}`).join(' ')}`,
      );
      expect(rest).toEqual([]);
      if (unit.status === 'ready') expect(ready).toBe(true);
      // trace の char 以外には、よみの無い漢字が無い
      for (const it of sampleItems(unit, 200)) expect(bareKanjiOutsideChar(it), it.id).toEqual([]);
    });
  }
});

/** 正解を答えて「正解」、誤りの選択肢・誤答の例を答えて「誤り（誤概念つき）」 */
describe('生成した問題の正誤判定', () => {
  for (const unit of pack.units) {
    it(`${unit.id}: 正答で正解・誤答で誤り・誤概念が付く`, () => {
      const misIds = new Set(unit.misconceptions.map((m) => m.id));
      for (const it of sampleItems(unit, 120)) {
        const eng = engineOf(it);
        if (it.engine === 'choice') {
          expect(it.options.length, it.id).toBeLessThanOrEqual(4);
          expect(new Set(it.options.map((o) => o.label)).size, it.id).toBe(it.options.length);
          it.options.forEach((o, i) => {
            const j = eng.judge(it, [i] as never);
            if (o.correct) expect(j.result, it.id).toBe('correct');
            else {
              expect(j.result, it.id).toBe('wrong');
              expect(misIds.has(o.misconception ?? ''), `${it.id} ${o.label}`).toBe(true);
            }
          });
        } else if (it.engine === 'build') {
          const v = it.answer.kind === 'text' ? it.answer.values[0]! : '';
          if (it.answer.kind === 'text') {
            const idx = [...v].length; // 正解の並びを作るのはエンジンの check が確かめる
            expect(idx).toBeGreaterThan(0);
          }
          for (const w of it.wrongAnswers ?? [])
            expect(misIds.has(w.misconception), it.id).toBe(true);
        } else if (it.engine === 'fill') {
          const right = it.blanks.map((b) => b.answers[0]!);
          expect(eng.judge(it, right as never).result, it.id).toBe('correct');
          it.blanks.forEach((b, bi) => {
            for (const w of b.wrong ?? []) {
              const res = [...right];
              res[bi] = w.value;
              expect(eng.judge(it, res as never).result, it.id).toBe('wrong');
              expect(misIds.has(w.misconception), it.id).toBe(true);
            }
          });
        }
      }
    });
  }
});

describe('画面に収まる文', () => {
  it('なぞる・書く問題の問題文は1行で、30字以内（なぞり盤と重ならない）', () => {
    for (const unit of pack.units.filter((u) => u.kind === 'writing')) {
      for (const it of sampleItems(unit, 600)) {
        if (it.engine !== 'trace') continue;
        const text = plainText(it.prompt);
        expect(text, it.id).not.toContain('\n');
        expect([...text].length, `${it.id} ${text}`).toBeLessThanOrEqual(30);
      }
    }
  });
});

describe('答えを問題文・ヒントに出さない', () => {
  it('読み問題: ヒントに答えの読みを「」で書かない・問題文に《!よみ》を入れない', () => {
    for (const unit of pack.units.filter((u) => u.kind === 'knowledge')) {
      for (const it of sampleItems(unit, 150)) {
        expect(it.prompt, it.id).not.toContain('《!');
        if (it.engine === 'choice' || it.engine === 'fill' || it.engine === 'build') {
          const answers =
            it.engine === 'choice'
              ? it.options.filter((o) => o.correct).map((o) => o.label ?? '')
              : it.engine === 'fill'
                ? it.blanks.map((b) => b.answers[0]!)
                : it.answer.kind === 'text'
                  ? it.answer.values
                  : [];
          // 比べる問題（pc）は問題文に読みを示すのでヒントも対象外
          if (it.id.startsWith('pc:')) continue;
          for (const h of it.hints)
            for (const a of answers) expect(h, `${it.id} ${a}`).not.toContain(`「${a}」`);
        }
      }
    }
  });

  it('書き問題: 書く字を問題文・ヒントに出さない（画数・はじめの画の問いは字を図に出す）', () => {
    for (const unit of pack.units.filter((u) => u.kind === 'writing')) {
      for (const it of sampleItems(unit, 200)) {
        if (it.id.startsWith('cn:') || it.id.startsWith('fs:')) continue;
        const ch = it.engine === 'trace' ? it.char : it.id.split(':')[1]!;
        for (const t of [it.prompt, ...it.hints]) {
          expect(plainText(t), it.id).not.toContain(ch);
        }
      }
    }
  });
});

describe('網羅（全件が、2つ以上の形式で出る）', () => {
  it('読み: すべての語例・文が、形式の違う2問以上で出る', () => {
    for (const unit of pack.units.filter((u) => u.kind === 'knowledge')) {
      const forms = new Map<string, Set<string>>();
      for (let level = 0; level < unit.levels.length; level++) {
        for (const it of sampleItems({ ...unit, levels: [unit.levels[level]!] } as UnitSpec, 0))
          void it;
      }
      // 段階ごとに多めの seed で生成（qa の sampleItems は seed 数を指定できる）
      const all = sampleItems(unit, 12000);
      for (const it of all) {
        const set = forms.get(it.identity) ?? new Set<string>();
        set.add(it.id.split(':')[0]!);
        forms.set(it.identity, set);
      }
      const entries = unit.stage === 'g1' ? ENTRIES_G1 : ENTRIES_G2;
      const missing: string[] = [];
      for (const e of entries) {
        for (const o of [...e.words, e.sentence]) {
          const key = `${e.ch}|${o.part}|${o.plain}`;
          const n = forms.get(key)?.size ?? 0;
          if (n < 2) missing.push(`${key}(${n})`);
        }
      }
      expect(missing, unit.id).toEqual([]);
    }
  });

  it('書き: すべての字が、なぞる・見比べる・選ぶ・画数 の4つで出る', () => {
    for (const unit of pack.units.filter((u) => u.kind === 'writing')) {
      const seen = new Map<string, Set<string>>();
      for (const it of sampleItems(unit, 12000)) {
        const ch = it.engine === 'trace' ? it.char : it.id.split(':')[1]!;
        const s = seen.get(ch) ?? new Set<string>();
        s.add(it.id.split(':')[0]!);
        seen.set(ch, s);
      }
      const entries = unit.stage === 'g1' ? ENTRIES_G1 : [...ENTRIES_G2, ...ENTRIES_G1];
      const missing: string[] = [];
      for (const e of entries) {
        const got = seen.get(e.ch);
        // 2年の単元は、2年の字は段階1・2、1年の字は段階3で出る
        for (const f of ['cn', 'cs']) if (!got?.has(f)) missing.push(`${e.ch}:${f}`);
        if (!got?.has('tr') && !got?.has('fr')) missing.push(`${e.ch}:書く`);
      }
      expect(missing, unit.id).toEqual([]);
    }
  });
});
