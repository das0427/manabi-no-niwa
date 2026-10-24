/**
 * g6-ja 教材レビュー（g6 担当）で直した誤りの再発を防ぐ検査。
 * ふりがな《…》と太字 ** を除いた「見える字」でくらべる。
 */
import { describe, expect, it } from 'vitest';
import { sampleItems, textsOf } from '../../curriculum/qa';
import type { Item, UnitSpec } from '../../curriculum/types';
import pack from './index';

const plain = (s: string): string => s.replace(/《[^》]*》/g, '').replace(/\*\*/g, '');

function unit(id: string): UnitSpec {
  const u = pack.units.find((x) => x.id === id);
  if (!u) throw new Error(`単元がない: ${id}`);
  return u;
}

function itemsOf(id: string): Item[] {
  return sampleItems(unit(id), 50);
}

function item(unitId: string, itemId: string): Item {
  const it = itemsOf(unitId).find((x) => x.id === itemId);
  if (!it) throw new Error(`問題がない: ${itemId}`);
  return it;
}

type Opt = { label: string; correct?: boolean; misconception?: string };
function optionsOf(it: Item): Opt[] {
  return 'options' in it && Array.isArray(it.options) ? (it.options as Opt[]) : [];
}
function hintsOf(it: Item): string[] {
  return 'hints' in it && Array.isArray(it.hints) ? (it.hints as string[]) : [];
}
function allText(it: Item): string {
  return plain(textsOf(it).join('\n'));
}

describe('g6-ja レビュー（g6）: 古典', () => {
  const U = 'g6.ja.classics-read';
  it('原文の書き出しが正しい', () => {
    const all = itemsOf(U).map(allText).join('\n');
    for (const s of [
      '今は昔、竹取の翁といふものありけり。',
      '春はあけぼの。やうやう白くなりゆく山ぎは、少しあかりて、むらさきだちたる雲の細くたなびきたる。',
      'ぎおん精舎の鐘の声、諸行無常の響きあり。',
      'ゆく河の流れは絶えずして、しかも、もとの水にあらず。',
      'つれづれなるままに、日ぐらし、すずりにむかひて、心にうつりゆくよしなし事を、そこはかとなく書きつくれば',
      '故きを温ねて新しきを知る',
      '過ぎたるはなお及ばざるがごとし',
      '春眠暁を覚えず',
    ])
      expect(all).toContain(s);
  });
  it('作品の時代の取りちがえがない', () => {
    const all = itemsOf(U).map(allText).join('\n');
    expect(all).not.toMatch(/枕草子[^。]{0,10}かまくら時代/);
    expect(all).not.toMatch(/方丈記[^。]{0,10}平安時代/);
    expect(all).not.toMatch(/徒然草[^。]{0,30}平安時代/);
  });
  it('学習指導要領の例示にない作者名を出さない', () => {
    const all = itemsOf(U).map(allText).join('\n');
    for (const n of ['鴨長明', '長明', '兼好', '孟浩然', '孔子', '紀貫之', '世阿弥'])
      expect(all, n).not.toContain(n);
  });
  it('ヒント③が正答を言わない（今は昔）', () => {
    const it = item(U, 'g6c-taketori:imahamukashi');
    expect(plain(hintsOf(it)[2] ?? '')).not.toContain('今では');
  });
});

describe('g6-ja レビュー（g6）: 同音異義語・同訓異字', () => {
  const U = 'g6.ja.kanji-usage';
  it('穴うめの文とヒントに、正答だけの字（選択肢と共通でない字）を出さない', () => {
    const errs: string[] = [];
    for (const it of itemsOf(U)) {
      if (it.engine !== 'fill') continue;
      const opts = it.options.map(plain);
      const ans = plain(it.blanks[0]?.answers[0] ?? '');
      const others = opts.filter((o) => o !== ans).join('');
      // 意（「意味」）・間（「二週間」）は、ふつうの言葉として出るので除く
      const own = [...ans].filter(
        (c) => /\p{Script=Han}/u.test(c) && !others.includes(c) && !'意間'.includes(c),
      );
      for (const t of [it.text, ...hintsOf(it)])
        for (const c of own)
          if (plain(t).includes(c)) errs.push(`[${it.id}] 「${c}」: ${plain(t)}`);
    }
    expect(errs).toEqual([]);
  });
  it('会う のヒントに 合 の字を出さない（まぎらわしい）', () => {
    const it = item(U, 'dokun:au-meet');
    for (const h of hintsOf(it)) expect(plain(h)).not.toContain('合');
  });
  it('厚い を「はば」で説明しない', () => {
    for (const it of itemsOf(U)) expect(allText(it), it.id).not.toContain('はばがある');
  });
});

describe('g6-ja レビュー（g6）: 読解・意見文の再発防止', () => {
  it('誤概念IDの付け違いを直したまま', () => {
    const cases: [string, string, string, string][] = [
      ['g6.ja.read-literature', 'g6l-sofu:monooki', '物置', 'lit-not-written'],
      ['g6.ja.read-literature', 'g6l-tsuchi:kenka', '言いあらそって', 'lit-literal'],
      ['g6.ja.read-argument', 'g6a-kiku:futatsume', '話は最後まで聞こう', 'a-claim-as-ground'],
    ];
    for (const [u, id, label, mis] of cases) {
      const it = item(u, id);
      const o = optionsOf(it).find((x) => plain(x.label).includes(label));
      expect(o?.misconception, id).toBe(mis);
    }
  });
  it('正答が2つ成り立つ選択肢を戻さない', () => {
    const cases: [string, string, string][] = [
      ['g6.ja.read-argument', 'g6a-touron:yamamoto', '理由を発表し合ってから'],
      ['g6.ja.read-argument', 'g6a-matsu:tane', '喜び'],
      ['g6.ja.read-argument', 'g6a-tegami:erabu', '手間だから'],
    ];
    for (const [u, id, s] of cases) {
      const bad = optionsOf(item(u, id)).filter((o) => !o.correct && plain(o.label).includes(s));
      expect(bad, id).toEqual([]);
    }
  });
  it('自動車だけのカードは電動アシスト自転車と区別できる', () => {
    const txt = itemsOf('g6.ja.info-relations')
      .filter((x) => x.id.endsWith(':kuruma'))
      .map(allText)
      .join('\n');
    expect(txt).toContain('ペダルをこがずに');
  });
  it('ヒント③が答えを言わない（再発の多かった型）', () => {
    for (const it of itemsOf('g6.ja.read-literature').filter((x) => x.id === 'g6l-fuyunoki:te'))
      expect(plain(hintsOf(it)[2] ?? '')).not.toContain('人のように書く');
    for (const it of itemsOf('g6.ja.info-relations').filter((x) =>
      x.id.startsWith('iiarawasu-alt:'),
    ))
      expect(plain(hintsOf(it)[2] ?? '')).not.toContain('なら「だから」');
    for (const it of itemsOf('g6.ja.write-opinion').filter((x) => x.id.startsWith('konkyo-alt:')))
      for (const w of ['きっと', 'はずだ', '決まっている'])
        expect(plain(hintsOf(it)[1] ?? ''), it.id).not.toContain(w);
  });
  it('パック全体: 政治・時事の語、教科書の定番教材の題名・人物名、実在の企業名を出さない', () => {
    const banned = [
      '政党',
      '選挙',
      '首相',
      '大臣',
      '国会',
      '時計の時間と心の時間',
      '鳥獣戯画',
      'メディアと人間社会',
      '大切な人と深くつながる',
      '海の命',
      'やまなし',
      'きつねの窓',
      'カレーライス',
      '大造じいさん',
      '太一',
      '与吉',
      '周也',
      'ゆみ子',
      'クラムボン',
      'トヨタ',
      'ソニー',
      '任天堂',
      'ユニクロ',
      'マクドナルド',
      'セブン',
    ];
    const errs: string[] = [];
    for (const u of pack.units)
      for (const it of sampleItems(u, 50)) {
        const t = allText(it);
        for (const w of banned) if (t.includes(w)) errs.push(`[${it.id}] ${w}`);
      }
    expect([...new Set(errs)]).toEqual([]);
  });
});
