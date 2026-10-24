import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems, textsOf, type UnitReport } from '../../curriculum/qa';
import type { Item, UnitSpec } from '../../curriculum/types';
import { engineOf } from '../../engines/registry';
import { KANJI_BY_GRADE, kanjiGrade } from '../../text/kanji-grades';
import { findBareKanji, parseRich, plainText } from '../../text/rich';
import pack from './index';
import { HOMOPHONE_OF, SIMILAR_OF, readingsOf } from './shared';
import { STROKES_OF } from './data/strokes';
import { PARTS_G34 } from './data/parts-g34';
import { ENTRIES_G2, ENTRIES_G3, ENTRIES_G4, ENTRY_OF } from './table';
import { isPrefWord } from './read-gen';

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

/** 文の中の、よみ付きの漢字（親文字）で、grade より上の学年のもの */
function kanjiAbove(texts: string[], grade: number): string[] {
  const out: string[] = [];
  for (const t of texts) {
    for (const tk of parseRich(t)) {
      if (tk.t !== 'ruby') continue;
      for (const c of tk.base) if (kanjiGrade(c) > grade) out.push(`${c}（${t.slice(0, 20)}）`);
    }
  }
  return out;
}

/** 単元の中の文（題・到達項目・誤概念・導入・問題）を全部 */
function allTexts(unit: UnitSpec, items: Item[]): string[] {
  const own = [
    unit.title,
    ...unit.objectives.map((o) => o.title),
    ...unit.misconceptions.map((m) => m.explain),
    ...unit.intro.map((s) => s.text),
  ];
  return [...own, ...items.flatMap((it) => textsOf(it.engine === 'trace' ? { ...it, char: '' } : it))];
}

const GRADE_OF_UNIT: Record<string, number> = {
  'g3.ja.kanji-read-g3': 3,
  'g3.ja.kanji-write-g3': 3,
  'g4.ja.kanji-read-g4': 4,
  'g4.ja.kanji-write-g4': 4,
};

describe('字のデータ表（data/rows-*.ts）', () => {
  it('3年200字・4年202字がすべてあり、語例は2以上・文は1つ', () => {
    expect(ENTRIES_G3.map((e) => e.ch).sort()).toEqual([...KANJI_BY_GRADE[3]].sort());
    expect(ENTRIES_G4.map((e) => e.ch).sort()).toEqual([...KANJI_BY_GRADE[4]].sort());
    for (const e of [...ENTRIES_G3, ...ENTRIES_G4]) {
      expect(e.words.length, e.ch).toBeGreaterThanOrEqual(2);
      expect(e.sentence.plain.trim(), e.ch).not.toBe('');
      // 画数の表にもある
      expect(STROKES_OF.get(e.ch), e.ch).toBeGreaterThan(0);
    }
    const n3 = ENTRIES_G3.reduce((a, e) => a + e.words.length, 0);
    const n4 = ENTRIES_G4.reduce((a, e) => a + e.words.length, 0);
    console.info(
      `表の件数: 3年 ${ENTRIES_G3.length}字・語例 ${n3}・文 ${ENTRIES_G3.length} ／ 4年 ${ENTRIES_G4.length}字・語例 ${n4}・文 ${ENTRIES_G4.length}`,
    );
  });

  it('問う字の読みは音訓の欄にあり、同じ語・文の中で重複しない', () => {
    for (const e of [...ENTRIES_G3, ...ENTRIES_G4]) {
      for (const o of [...e.words, e.sentence]) {
        expect([...e.on, ...e.kun], `${e.ch} ${o.plain}`).toContain(o.part);
      }
      const keys = [...e.words, e.sentence].map((o) => o.plain);
      expect(new Set(keys).size, e.ch).toBe(keys.length);
    }
  });

  it('音訓の欄の読みは、語例か文のどれかで使われている（使わない読みを書かない）', () => {
    const unused: string[] = [];
    for (const e of [...ENTRIES_G3, ...ENTRIES_G4]) {
      const used = new Set([...e.words, e.sentence].map((o) => o.part));
      for (const r of readingsOf(e)) if (!used.has(r)) unused.push(`${e.ch}:${r}`);
    }
    expect(unused).toEqual([]);
  });

  it('よく間違えやすい読みの確認（人が確かめた語）', () => {
    const read = (ch: string, plain: string) =>
      ENTRY_OF.get(ch)!.words.find((w) => w.plain === plain)?.part;
    expect(read('重', '重い')).toBe('おも');
    expect(read('重', '体重')).toBe('じゅう');
    expect(read('都', '京都')).toBe('と');
    expect(read('都', '都合')).toBe('つ');
    expect(read('神', '神話')).toBe('しん');
    expect(read('神', '神社')).toBe('じん');
    expect(read('物', '動物')).toBe('ぶつ');
    expect(read('物', '荷物')).toBe('もつ');
    expect(read('物', '食べ物')).toBe('もの');
    expect(read('宮', '王宮')).toBe('きゅう');
    expect(read('宮', '神宮')).toBe('ぐう');
    expect(read('坂', '坂道')).toBe('さか');
    expect(read('由', '理由')).toBe('ゆう');
    expect(read('由', '由来')).toBe('ゆ');
    expect(read('世', '世界')).toBe('せ');
    expect(read('熱', '熱い')).toBe('あつ');
    expect(read('熱', '熱量')).toBe('ねつ');
    expect(read('夫', '農夫')).toBe('ふ');
    expect(read('夫', '工夫')).toBe('ふう');
    expect(read('便', '便利')).toBe('べん');
    expect(read('便', '船便')).toBe('びん');
    expect(read('無', '無理')).toBe('む');
    expect(read('無', '無事')).toBe('ぶ');
    expect(read('兵', '兵隊')).toBe('へい');
    expect(read('兵', '兵庫県')).toBe('ひょう');
    expect(read('鹿', '鹿児島県')).toBe('か');
    expect(read('茨', '茨城県')).toBe('いばら');
    expect(read('潟', '新潟県')).toBe('がた');
    expect(read('媛', '愛媛県')).toBe('ひめ');
    expect(read('阜', '岐阜県')).toBe('ふ');
    expect(read('縄', '沖縄県')).toBe('なわ');
    expect(read('沖', '沖縄県')).toBe('おき');
  });

  it('4年の都道府県名の字（g4.soc.prefectures と共有）が、県名の語例を持つ', () => {
    const chars = '茨岐阜埼栃梨奈媛潟熊沖縄香佐鹿賀岡阪崎徳富井滋';
    const missing = [...chars].filter(
      (c) => !ENTRY_OF.get(c)!.words.some((w) => isPrefWord(w)),
    );
    expect(missing).toEqual([]);
    const pref = ENTRIES_G4.flatMap((e) => e.words).filter((w) => isPrefWord(w));
    console.info(`県名の語例: ${pref.length}`);
  });

  it('ほかの漢字のふりがなが、その字の音訓と食い違っていない（先頭の音で確かめる）', () => {
    // 濁音・半濁音・促音・連濁を許して、ふりがなの先頭の音が、その字のどれかの読みの先頭の音と同じか
    const seion = (s: string) =>
      s.replace(/[がぎぐげござじずぜぞだぢづでどばびぶべぼ]/g, (c) =>
        String.fromCharCode(c.charCodeAt(0) - 1),
      ).replace(/[ぱぴぷぺぽ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 2));
    // 音訓の欄にない（表に載せていない）、ふりがなの付け方で、人が確かめたもの
    const okSpecial = new Set([
      '間:ま', // 谷間・仲間（間の訓 ま）
      '父:とう', // お父さん
      '母:かあ', // お母さん
      '負:ぶ', // 勝負（連濁）
      '落:らく', // 落葉
      '城:き', // 茨城
      '愛:え', // 愛媛
      '新:にい', // 新潟
      '係:けい', // 関係
      '馬:ま', // 群馬
      '手:ず', // 上手
      '児:ご', // 鹿児島
      '者:もの', // 働き者
      '良:ら', // 奈良
      '働:どう', // 労働
    ]);
    const bad: string[] = [];
    for (const e of [...ENTRIES_G2, ...ENTRIES_G3, ...ENTRIES_G4]) {
      for (const o of [...e.words, e.sentence]) {
        for (const tk of parseRich(o.rich)) {
          if (tk.t !== 'ruby' || tk.hide || [...tk.base].length !== 1) continue;
          const x = ENTRY_OF.get(tk.base);
          if (!x) continue;
          const first = seion(tk.reading)[0];
          const ok =
            readingsOf(x).some((r) => seion(r)[0] === first) ||
            okSpecial.has(`${tk.base}:${tk.reading}`);
          if (!ok) bad.push(`${tk.base}《${tk.reading}》 in ${o.plain}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('同音の字の表: 字も同音の字も表にあり、文の読みと同じ読みを持つ', () => {
    const bad: string[] = [];
    for (const e of [...ENTRIES_G3, ...ENTRIES_G4]) {
      const hs = HOMOPHONE_OF.get(e.ch) ?? [];
      for (const c of hs) {
        const x = ENTRY_OF.get(c);
        if (!x) bad.push(`${e.ch}→${c}: 表に無い`);
        else if (!readingsOf(x).includes(e.sentence.part))
          bad.push(`${e.ch}→${c}: ${e.sentence.part} と読めない`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('形の似た字の表: 3・4年の字はすべて、自分以外の似た字を持つ', () => {
    for (const e of [...ENTRIES_G3, ...ENTRIES_G4]) {
      const ss = SIMILAR_OF.get(e.ch) ?? [];
      expect(ss.length, e.ch).toBeGreaterThanOrEqual(4);
      expect(ss, e.ch).not.toContain(e.ch);
    }
  });

  it('部品の表: 部品の字はすべて1〜4年の字で、画数の合計が字の画数以下', () => {
    for (const l of PARTS_G34.split('\n').filter(Boolean)) {
      const [c, rest] = l.split(':') as [string, string];
      expect(ENTRY_OF.has(c), c).toBe(true);
      for (const p of rest) expect(ENTRY_OF.has(p), `${c}:${p}`).toBe(true);
    }
  });
});

describe('kanji-g34 の教材検査（curriculum-matrix 1.8）', () => {
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

    it(`${unit.id}: 文の漢字は単元の学年まで（上の学年の字は使わない）`, () => {
      const items = sampleItems(unit, 150);
      const above = kanjiAbove(allTexts(unit, items), GRADE_OF_UNIT[unit.id]!);
      expect([...new Set(above)].slice(0, 20)).toEqual([]);
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
          expect(it.options?.length ?? 0, it.id).toBeLessThanOrEqual(4);
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
          // 比べる問題（pc・pf）は問題文・ヒントに読みを示すので対象外
          if (it.id.startsWith('pc:') || it.id.startsWith('pf:')) continue;
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
      const all = sampleItems(unit, 12000);
      for (const it of all) {
        const set = forms.get(it.identity) ?? new Set<string>();
        set.add(it.id.split(':')[0]!);
        forms.set(it.identity, set);
      }
      const entries = unit.stage === 'g3' ? ENTRIES_G3 : ENTRIES_G4;
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
      const entries = unit.stage === 'g3' ? [...ENTRIES_G3, ...ENTRIES_G2] : [...ENTRIES_G4, ...ENTRIES_G3];
      const missing: string[] = [];
      for (const e of entries) {
        const got = seen.get(e.ch);
        // 単元の学年の字は段階1・2、前の学年の字は段階3で出る
        for (const f of ['cn', 'cs']) if (!got?.has(f)) missing.push(`${e.ch}:${f}`);
        if (!got?.has('tr') && !got?.has('fr')) missing.push(`${e.ch}:書く`);
      }
      expect(missing, unit.id).toEqual([]);
    }
  });
});
