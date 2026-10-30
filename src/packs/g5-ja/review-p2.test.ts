/**
 * P2 の2単元（g5.ja.spoken-written・g5.ja.classics）の再発防止の検査。
 */
import { describe, expect, it } from 'vitest';
import { sampleItems, textsOf } from '../../curriculum/qa';
import type { Item, ListenItem, UnitSpec } from '../../curriculum/types';
import pack from './index';

const SW = 'g5.ja.spoken-written';
const CL = 'g5.ja.classics';

function unit(id: string): UnitSpec {
  const u = pack.units.find((x) => x.id === id);
  if (!u) throw new Error(`単元がない: ${id}`);
  return u;
}
const items = (id: string): Item[] => sampleItems(unit(id), 1);
/** listen の音声の文（複数なら連結） */
const audioText = (a: ListenItem['audio']): string =>
  (Array.isArray(a) ? a : [a]).map((x) => x.text).join(' ');
const plain = (s: string | undefined) => (s ?? '').replace(/《[^》]*》/g, '').replace(/\*\*/g, '');
/** 画面に読む文字の数（よみ・強調を除く） */
const len = (s: string | undefined) => [...plain(s)].length;

function allTexts(u: UnitSpec): string[] {
  return [
    u.title,
    ...u.intro.map((s) => s.text),
    ...u.misconceptions.map((m) => m.explain),
    ...u.objectives.map((o) => o.title),
    ...items(u.id).flatMap((it) => textsOf(it)),
  ].map(plain);
}

const FORBIDDEN = [
  'トヨタ',
  'ソニー',
  'パナソニック',
  '任天堂',
  'ユニクロ',
  'セブン',
  'ローソン',
  'ファミリーマート',
  'マクドナルド',
  'スターバックス',
  'コカ・コーラ',
  'ヤクルト',
  'カルピス',
  'ポケモン',
  'ドラえもん',
  'アンパンマン',
  'アマゾン',
  'グーグル',
  'ヤフー',
  'ディズニー',
  'レゴ',
  'iPhone',
  'LINE',
  'YouTube',
  'JR',
];

/** 誤りの選択肢・組・箱・fill の誤りの誤概念ID（無いものは '' ） */
function wrongMisconceptions(it: Item): string[] {
  if (it.engine === 'choice' || it.engine === 'listen')
    return it.options.filter((o) => !o.correct).map((o) => o.misconception ?? '');
  if (it.engine === 'match') return (it.wrongPairs ?? []).map((w) => w.misconception ?? '');
  if (it.engine === 'sort')
    return it.cards.flatMap((c) => (c.wrongBoxes ?? []).map((w) => w.misconception ?? ''));
  if (it.engine === 'fill')
    return it.blanks.flatMap((b) => (b.wrong ?? []).map((w) => w.misconception ?? ''));
  return [];
}

describe('P2 g5-ja レビュー: 再発防止', () => {
  it('実在の企業名・商品名を使わない', () => {
    const bad: string[] = [];
    for (const id of [SW, CL])
      for (const t of allTexts(unit(id)))
        for (const w of FORBIDDEN) if (t.includes(w)) bad.push(`${id}: 「${w}」`);
    expect(bad).toEqual([]);
  });

  for (const id of [SW, CL]) {
    it(`${id}: 誤りにすべて誤概念IDがあり、単元の misconceptions に含まれる`, () => {
      const known = new Set(unit(id).misconceptions.map((m) => m.id));
      const bad = items(id).flatMap((it) =>
        wrongMisconceptions(it)
          .filter((m) => !known.has(m))
          .map((m) => `${it.id}: ${m || '(なし)'}`),
      );
      expect(bad).toEqual([]);
    });

    it(`${id}: ヒント③に正答の文がそのまま出ない`, () => {
      const bad: string[] = [];
      for (const it of items(id)) {
        if (it.engine !== 'choice' && it.engine !== 'listen') continue;
        const ok = it.options.find((o) => o.correct);
        const h3 = it.hints?.[2];
        if (!ok || !h3) continue;
        const a = plain(ok.label);
        if (a.length >= 4 && plain(h3).includes(a)) bad.push(it.id);
      }
      expect(bad).toEqual([]);
    });

    it(`${id}: 選択肢の文は26字以内・match の札は10字以内・sort のカードは8字以内`, () => {
      const bad: string[] = [];
      for (const it of items(id)) {
        if (it.engine === 'choice' || it.engine === 'listen')
          for (const o of it.options) if (len(o.label) > 26) bad.push(`${it.id}: ${o.label}`);
        if (it.engine === 'match')
          for (const c of [...it.left, ...it.right])
            if (len(c.label) > 10) bad.push(`${it.id}: ${c.label}`);
        if (it.engine === 'sort')
          for (const c of it.cards) if (len(c.label) > 8) bad.push(`${it.id}: ${c.label}`);
      }
      expect(bad).toEqual([]);
    });
  }

  it('spoken-written: naosu の choice（練習）の正答は、です・ますで終わらず、話し言葉の印を含まない', () => {
    const MARKS = [
      'じゃん',
      'ちゃ',
      'けど',
      'すごく',
      'やっぱ',
      'てる',
      'とか',
      'なきゃ',
      'って',
      'こっち',
      'ちょっと',
      'えっと',
      'なんか',
      'いっぱい',
    ];
    const bad: string[] = [];
    for (const it of items(SW)) {
      if (it.engine !== 'choice' || !it.id.startsWith('naosu:')) continue;
      const ok = plain(it.options.find((o) => o.correct)!.label);
      if (/(です|ます)。?$/.test(ok)) bad.push(`${it.id}: です・ます`);
      for (const m of MARKS) if (ok.includes(m)) bad.push(`${it.id}: ${m}`);
    }
    expect(bad).toEqual([]);
  });

  it('classics: listen は hideTranscript で、音声に漢字・英字・歴史的かなづかいの字が無い', () => {
    const bad: string[] = [];
    for (const it of items(CL)) {
      if (it.engine !== 'listen') continue;
      const t = audioText(it.audio);
      if (!it.hideTranscript) bad.push(`${it.id}: hideTranscript`);
      if (/[一-龥A-Za-z]/.test(t)) bad.push(`${it.id}: 漢字・英字`);
      if (/[ゐゑ]|いふ|けふ|やう/.test(t)) bad.push(`${it.id}: 歴史的かなづかい`);
    }
    expect(bad).toEqual([]);
  });

  it('classics: kana のヒントに正答のかなが出ない', () => {
    const bad: string[] = [];
    for (const it of items(CL)) {
      if (it.engine !== 'choice' || !it.id.startsWith('kana:')) continue;
      const ok = plain(it.options.find((o) => o.correct)!.label);
      for (const h of it.hints ?? []) if (plain(h).includes(ok)) bad.push(`${it.id}: ${ok}`);
    }
    expect(bad).toEqual([]);
  });

  it('classics: g6.ja.classics-read の音読と同じ音声が無い', () => {
    const G6 = [
      'いまは むかし',
      'はるは あけぼの',
      'ぎおんしょうじゃ',
      'ゆく かわの',
      'つれづれなるままに',
      'ふるきを たずねて',
      'しゅんみん',
    ];
    const bad: string[] = [];
    for (const it of items(CL))
      if (it.engine === 'listen')
        for (const g of G6) if (audioText(it.audio).startsWith(g)) bad.push(`${it.id}: ${g}`);
    expect(bad).toEqual([]);
  });

  it('classics: 作者名を出さない', () => {
    const bad: string[] = [];
    for (const t of allTexts(unit(CL)))
      for (const w of ['紀', '李白', '杜甫', '孔子', '兼好', '清少納言'])
        if (t.includes(w)) bad.push(`${w}: ${t.slice(0, 30)}`);
    expect(bad).toEqual([]);
  });
});
