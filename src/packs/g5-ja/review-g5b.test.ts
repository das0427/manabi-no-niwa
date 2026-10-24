/**
 * 内容レビュー（g5b: sentence-relations・text-figure・word-structure・write-fact-opinion）で
 * 見つけた誤りの再発を防ぐ検査。
 */
import { describe, expect, it } from 'vitest';
import { sampleItems, textsOf } from '../../curriculum/qa';
import type { Item, UnitSpec } from '../../curriculum/types';
import pack from './index';

const MINE = [
  'g5.ja.sentence-relations',
  'g5.ja.text-figure',
  'g5.ja.word-structure',
  'g5.ja.write-fact-opinion',
];

function unit(id: string): UnitSpec {
  const u = pack.units.find((x) => x.id === id);
  if (!u) throw new Error(`単元がない: ${id}`);
  return u;
}

const items = (id: string): Item[] => sampleItems(unit(id), 1);

/** よみ《》と強調 ** を外した文 */
const plain = (s: string) => s.replace(/《[^》]*》/g, '').replace(/\*\*/g, '');

function allTexts(u: UnitSpec): string[] {
  return [
    u.title,
    ...u.intro.map((s) => s.text),
    ...textsOf(u.intro),
    ...u.misconceptions.map((m) => m.explain),
    ...u.objectives.map((o) => o.title),
    ...items(u.id).flatMap((it) => textsOf(it)),
  ].map(plain);
}

/** 実在の企業名・商品名・キャラクター名（pack-brief: 実在の団体・商品名を出さない） */
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

describe('g5b レビュー: 再発防止', () => {
  it('実在の企業名・商品名を使わない', () => {
    const bad: string[] = [];
    for (const id of MINE)
      for (const t of allTexts(unit(id)))
        for (const w of FORBIDDEN) if (t.includes(w)) bad.push(`${id}: 「${w}」 ${t.slice(0, 30)}`);
    expect(bad).toEqual([]);
  });

  it('word-structure: 「ごはん（ご飯）」をふくむ語を使わない（ご飯は漢語。「昼ごはん」を和語の正解にした誤りの再発防止）', () => {
    const bad = allTexts(unit('g5.ja.word-structure')).filter((t) => /ごはん|ご飯/.test(t));
    expect(bad).toEqual([]);
  });

  it('word-structure: 和語を答える問題の正解に、音読みの字（漢語の部分）をふくむ語を置かない', () => {
    // 和語の正解は、ひらがな・訓読みの漢字だけ（ruby のよみがひらがなの訓読み）であることを、
    // 既知の正解で確かめる（新しい問題を足したらここにも足す）
    const KNOWN_WAGO = new Set(['旅', '速さ', 'きまり']);
    const bad: string[] = [];
    for (const it of items('g5.ja.word-structure')) {
      if (it.engine !== 'choice' || !it.id.startsWith('iikae:')) continue;
      if (!plain(it.prompt).includes('和語の言葉')) continue;
      const ok = it.options.find((o) => o.correct)?.label ?? '';
      if (!KNOWN_WAGO.has(plain(ok))) bad.push(`${it.id}: ${plain(ok)}`);
    }
    expect(bad).toEqual([]);
  });

  it('sentence-relations: 係り方の問題（正解1つ）に、二通りに読める「形容詞＋名詞の＋…名詞」の文を使わない', () => {
    const bad: string[] = [];
    for (const it of items('g5.ja.sentence-relations')) {
      if (it.engine !== 'choice' || !it.id.startsWith('kakari:')) continue;
      const fig = it.figure && it.figure.kind === 'text' ? plain(it.figure.text) : '';
      if (fig.includes('赤い花のさいた木')) bad.push(it.id);
      // 太字の形容詞のすぐ後が「〜の」（白い犬の小屋 型）なら二通りに読める
      const m = it.figure && it.figure.kind === 'text' ? it.figure.text : '';
      if (/\*\*[^*]*い\*\*[^、。*]*?《[^》]*》の/.test(m) || /\*\*[^*]*い\*\*[^、。*《]*の/.test(m))
        bad.push(`${it.id}: ${plain(m)}`);
    }
    expect(bad).toEqual([]);
  });

  it('sentence-relations: 「かぜをひいた{{}}、休んだ」の誤りに、理由にも読める「し」を置かない', () => {
    const it = items('g5.ja.sentence-relations').find((x) => x.id === 'setsuzoku:kaze');
    expect(it?.engine).toBe('fill');
    if (it?.engine !== 'fill') return;
    expect(it.options).not.toContain('し');
    expect(it.options).not.toContain('から');
  });

  it('ヒント③に正答の文をそのまま書かない（3字以上の正答）', () => {
    const bad: string[] = [];
    for (const id of MINE)
      for (const it of items(id)) {
        if (it.engine !== 'choice' && it.engine !== 'reading') continue;
        // 和語・漢語・外来語を選ぶ問題は、選択肢が種類の名前なので、ヒントで名前の説明をするのはよい
        if (it.id.startsWith('goshu:')) continue;
        const h3 = plain(it.hints[2] ?? '');
        for (const o of it.options) {
          if (!o.correct || !o.label) continue;
          const ok = plain(o.label);
          if (ok.length >= 3 && h3.includes(ok)) bad.push(`${it.id}: ${ok}`);
        }
      }
    expect(bad).toEqual([]);
  });

  it('write-fact-opinion: 事実の文に意見の言い方がなく、意見の文には考え・感じ方の言い方がある', () => {
    const OPINION =
      /思います|考えます|感じます|べき|とよい|ほうがよい|よいもの|気持ちがよい|あぶない/;
    const bad: string[] = [];
    for (const it of items('g5.ja.write-fact-opinion')) {
      if (it.engine !== 'sort' || !it.id.startsWith('bunrui:')) continue;
      for (const c of it.cards) {
        // 「」の中（人が答えた・話したこと）は事実の文の中身なので除く
        const t = plain(c.label ?? '').replace(/「[^」]*」/g, '「」');
        const isOpinion = OPINION.test(t);
        if (c.box === 0 && isOpinion) bad.push(`${it.id} 事実に意見の言い方: ${t}`);
        if (c.box === 1 && !isOpinion) bad.push(`${it.id} 意見に考えの言い方がない: ${t}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('text-figure: 本文に書いた数が図表の数と合う', () => {
    const passages = new Map<string, Item>();
    for (const it of items('g5.ja.text-figure'))
      if (it.engine === 'reading') passages.set(it.passage.id, it);
    const vals = (pid: string): number[] => {
      const it = passages.get(pid);
      if (it?.engine !== 'reading') throw new Error(pid);
      const f = it.passage.figure;
      if (!f || (f.kind !== 'bar' && f.kind !== 'line')) throw new Error(`${pid}: 図がない`);
      return f.values;
    };
    const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
    // 雨水: 6月がいちばん多く5月の2倍をこえる・8月がいちばん少ない
    const am = vals('g5t-amamizu');
    expect(Math.max(...am)).toBe(am[2]);
    expect(am[2]!).toBeGreaterThan(am[1]! * 2);
    expect(Math.min(...am)).toBe(am[4]);
    // あいさつ: 1〜3週目ふえる・4週目へる・5週目が最多の80
    const ai = vals('g5t-aisatsu');
    expect(ai[0]! < ai[1]! && ai[1]! < ai[2]! && ai[3]! < ai[2]!).toBe(true);
    expect(Math.max(...ai)).toBe(80);
    expect(ai[4]).toBe(80);
    // 落とし物: 全体90こ、えんぴつ・消しゴムがちょうど3分の1
    const ot = vals('g5t-otoshimono');
    expect(sum(ot)).toBe(90);
    expect(ot[0]! * 3).toBe(sum(ot));
    // けが: 運動場18、2番目が体育館11、ろうか+階だん=15 > 11
    const kg = vals('g5t-kega');
    expect(kg).toEqual([...kg].sort((a, b) => b - a));
    expect(kg[0]).toBe(18);
    expect(kg[1]).toBe(11);
    expect(kg[2]! + kg[3]!).toBe(15);
    // 運動場アンケート: 合計100人、賛成64・反対22・どちらでもない14
    expect(vals('g5t-undoujou')).toEqual([64, 22, 14]);
    // プール: 気温の幅12度、水温の幅5度、雨の日は水温が高い
    const pool = passages.get('g5t-pool');
    if (pool?.engine !== 'reading' || pool.passage.figure?.kind !== 'table')
      throw new Error('pool');
    const rows = pool.passage.figure.rows.map((r) => r.map(plain));
    const air = rows.map((r) => parseInt(r[2]!, 10));
    const water = rows.map((r) => parseInt(r[3]!, 10));
    expect(Math.max(...air) - Math.min(...air)).toBe(12);
    expect(Math.max(...water) - Math.min(...water)).toBe(5);
    for (const [i, r] of rows.entries())
      if (r[1] === '雨') expect(water[i]!).toBeGreaterThan(air[i]!);
  });
});
