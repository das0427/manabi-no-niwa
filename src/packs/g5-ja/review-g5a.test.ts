/**
 * 内容レビュー（g5a: figurative・honorifics・read-gist・read-relations）で直した誤りの再発を防ぐ検査。
 */
import { describe, expect, it } from 'vitest';
import type { Item, UnitSpec } from '../../curriculum/types';
import { figurative } from './figurative';
import { honorifics } from './honorifics';
import { readGist } from './read-gist';
import { readRelations } from './read-relations';

const UNITS: UnitSpec[] = [figurative, honorifics, readGist, readRelations];

function itemsOf(u: UnitSpec): Item[] {
  return u.source.kind === 'items' ? u.source.items : [];
}

/** ルビと太字の印を外した、読む文字だけの形 */
function plain(s: string): string {
  return s.replace(/《[^》]*》/g, '').replace(/\*\*/g, '');
}

interface Opt {
  label: string;
  correct?: boolean;
  misconception?: string;
}

function optionsOf(it: Item): Opt[] {
  return 'options' in it && Array.isArray(it.options) && typeof it.options[0] === 'object'
    ? (it.options as Opt[])
    : [];
}

function correctLabels(it: Item): string[] {
  return optionsOf(it)
    .filter((o) => o.correct)
    .map((o) => plain(o.label));
}

describe('g5a レビュー: 再発防止', () => {
  it('ヒント③に正答の文がそのまま出ない', () => {
    const bad: string[] = [];
    for (const u of UNITS)
      for (const it of itemsOf(u)) {
        const h3 = plain(it.hints?.[2] ?? '');
        for (const c of correctLabels(it))
          if (c.length >= 4 && h3.includes(c)) bad.push(`${u.id} ${it.id}: ${c}`);
      }
    expect(bad).toEqual([]);
  });

  it('誤りの選択肢には誤概念IDが付き、その単元の誤概念に含まれる', () => {
    const bad: string[] = [];
    for (const u of UNITS) {
      const known = new Set(u.misconceptions.map((m) => m.id));
      for (const it of itemsOf(u))
        for (const o of optionsOf(it))
          if (!o.correct && (!o.misconception || !known.has(o.misconception)))
            bad.push(`${u.id} ${it.id}: ${plain(o.label)}`);
    }
    expect(bad).toEqual([]);
  });

  it('敬語: 二重敬語を正解にしていない', () => {
    const DOUBLE =
      /おっしゃられ|いらっしゃられ|ごらんになられ|お.{1,4}になられ|なさられ|めし上がられ|おめし上がり/;
    const bad: string[] = [];
    for (const it of itemsOf(honorifics)) {
      for (const c of correctLabels(it)) if (DOUBLE.test(c)) bad.push(`${it.id}: ${c}`);
      if (it.engine === 'fill')
        for (const b of it.blanks)
          for (const a of b.answers) if (DOUBLE.test(plain(a))) bad.push(`${it.id}: ${a}`);
      if (it.engine === 'sort')
        for (const c of it.cards)
          if (
            c.box === 0 &&
            (it.boxes[0]?.label ?? '').startsWith('正') &&
            DOUBLE.test(plain(c.label ?? ''))
          )
            bad.push(`${it.id}: ${c.label}`);
    }
    expect(bad).toEqual([]);
  });

  it('敬語: 「敬語の指針」で許容とされる「おめし上がりになる」を誤りとして出さない', () => {
    const bad = itemsOf(honorifics)
      .filter((it) =>
        JSON.stringify(it)
          .replace(/《[^》]*》/g, '')
          .includes('おめし上がりに'),
      )
      .map((it) => it.id);
    expect(bad).toEqual([]);
  });

  it('敬語: 「直さなくてよい」は正解にしない（直す問題はすべて誤りの敬語）', () => {
    const bad = itemsOf(honorifics)
      .filter((it) => it.id.startsWith('fix:'))
      .filter((it) => correctLabels(it).some((c) => c.includes('直さなくてよい')))
      .map((it) => it.id);
    expect(bad).toEqual([]);
  });

  it('比喩: 擬人法が正解の問題に「比喩」の誤りの選択肢を置かない（擬人法も比喩の一つ）', () => {
    const bad: string[] = [];
    for (const it of itemsOf(figurative)) {
      const opts = optionsOf(it);
      if (!opts.some((o) => o.correct && plain(o.label).startsWith('擬人法'))) continue;
      for (const o of opts)
        if (!o.correct && plain(o.label).startsWith('比喩'))
          bad.push(`${it.id}: ${plain(o.label)}`);
    }
    expect(bad).toEqual([]);
  });

  it('比喩: 詩「朝の川」の問いに「反復」「倒置」の誤りの選択肢を置かない（詩に両方ある）', () => {
    const bad: string[] = [];
    for (const it of itemsOf(figurative))
      if (it.engine === 'reading' && it.passage.id === 'g5fig-asanokawa')
        for (const o of optionsOf(it))
          if (!o.correct && /^(倒置|反復)/.test(plain(o.label)))
            bad.push(`${it.id}: ${plain(o.label)}`);
    expect(bad).toEqual([]);
  });

  it('読解: 教科書の定番教材と題材・構成が近い本文（ふろしき）を使わない', () => {
    const bad: string[] = [];
    for (const u of [readGist, readRelations])
      for (const it of itemsOf(u))
        if (it.engine === 'reading') {
          const all = plain([it.passage.title, ...it.passage.paragraphs.flat()].join(''));
          if (/ふろしき/.test(all)) bad.push(`${u.id} ${it.passage.id}`);
        }
    expect([...new Set(bad)]).toEqual([]);
  });
});
