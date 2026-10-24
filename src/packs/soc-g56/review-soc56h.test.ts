/**
 * 内容レビュー（soc56h: history-1・history-2・history-3・politics）の再発を防ぐ検査。
 * - 歴史の人物は学習指導要領（小6社会）の例示42人だけ（42人の外の主な人物名が出ないこと）
 * - ヒントが正答の選択肢・空欄の答えを（ほかの選択肢を出さずに）名指ししないこと
 * - 政治: 選挙権 18さい・憲法の公布/施行日・天皇の地位（象徴）・三つの原則の記述
 * - 特定の指摘（ヒント③の答え漏れ・前方後円墳の分布の書き方）が戻らないこと
 */
import { describe, expect, it } from 'vitest';
import { textsOf } from '../../curriculum/qa';
import type { Item, UnitSpec } from '../../curriculum/types';
import { plainText } from '../../text/rich';
import { history1 } from './history-1';
import { history2 } from './history-2';
import { history3 } from './history-3';
import { politics } from './politics';

const UNITS: UnitSpec[] = [history1, history2, history3, politics];

const itemsOf = (u: UnitSpec): Item[] => u.source.items ?? [];

/** 単元のすべての文（題・導入・誤概念・到達項目・問題） */
function allTexts(u: UnitSpec): string[] {
  return [
    u.title,
    ...u.intro.map((s) => s.text),
    ...u.misconceptions.map((m) => m.explain),
    ...u.objectives.map((o) => o.title),
    ...itemsOf(u).flatMap((it) => textsOf(it)),
  ].map((t) => plainText(t));
}

/** 例示42人の外で、教材に出やすい人物（ふりがなを外した表記で探す） */
const OUTSIDE_42 = [
  '推古天皇',
  '菅原道真',
  '北条政子',
  '松尾芭蕉',
  '坂本龍馬',
  '坂本竜馬',
  '津田梅子',
  '与謝野晶子',
  '北里柴三郎',
  '田中正造',
  '平塚らいてう',
  '足利尊氏',
  '後醍醐天皇',
  '千利休',
  '葛飾北斎',
  '井原西鶴',
  '徳川吉宗',
  '徳川綱吉',
  '徳川慶喜',
  '吉田松陰',
  '岩倉具視',
  '空海',
  '最澄',
  '蘇我',
  '天智天皇',
  '天武天皇',
  '樋口一葉',
  '夏目漱石',
  '世阿弥',
  'マッカーサー',
];

/** 正答の選択肢の文と、誤りの選択肢の文 */
function choiceLabels(it: Item): { right: string[]; wrong: string[] } | null {
  const os =
    it.engine === 'choice' || it.engine === 'reading'
      ? it.options
      : it.engine === 'graph' && it.task.kind === 'choice'
        ? it.task.options
        : null;
  if (!os) return null;
  const right: string[] = [];
  const wrong: string[] = [];
  for (const o of os) {
    if (!o.label) continue;
    (o.correct ? right : wrong).push(plainText(o.label));
  }
  return { right, wrong };
}

describe('soc56h レビューの再発防止（history-1〜3・politics）', () => {
  it('例示42人の外の人物が出ない', () => {
    const bad: string[] = [];
    for (const u of UNITS)
      for (const t of allTexts(u))
        for (const name of OUTSIDE_42) if (t.includes(name)) bad.push(`${u.id}: ${name}`);
    expect(bad).toEqual([]);
  });

  it('ヒントが正答だけを名指ししない（選択肢）', () => {
    const bad: string[] = [];
    for (const u of UNITS)
      for (const it of itemsOf(u)) {
        const ls = choiceLabels(it);
        if (!ls) continue;
        const hints = it.hints.map((h) => plainText(h));
        for (const r of ls.right) {
          if (r.length < 2) continue;
          for (const h of hints)
            if (h.includes(r) && !ls.wrong.some((w) => w.length >= 2 && h.includes(w)))
              bad.push(`${u.id} [${it.id}] 「${r}」: ${h}`);
        }
      }
    expect(bad).toEqual([]);
  });

  it('ヒントが空欄の答えを名指ししない（fill）', () => {
    const bad: string[] = [];
    for (const u of UNITS)
      for (const it of itemsOf(u)) {
        if (it.engine !== 'fill') continue;
        const hints = it.hints.map((h) => plainText(h));
        for (const b of it.blanks)
          for (const a of b.answers) {
            const ans = plainText(a);
            const wrongs = (b.wrong ?? []).map((w) => plainText(w.value));
            for (const h of hints)
              if (h.includes(ans) && !wrongs.some((w) => h.includes(w)))
                bad.push(`${u.id} [${it.id}] 「${ans}」: ${h}`);
          }
      }
    expect(bad).toEqual([]);
  });

  it('ヒント③の答え漏れ（直した文）が戻らない', () => {
    const banned = [
      '20さいより二つ下',
      '「衆」と「参」で始まる',
      '「市」で始まる名前',
      '「裁判」を行うところ',
      '憲法を記念する祝日',
      '「国民」に力がある、ということば',
      '「平城」は奈良の都',
      '（消費する）ときにかかる税金',
    ];
    const bad: string[] = [];
    for (const u of UNITS)
      for (const it of itemsOf(u))
        for (const h of it.hints.map((x) => plainText(x)))
          for (const s of banned) if (h.includes(s)) bad.push(`${u.id} [${it.id}] ${s}`);
    expect(bad).toEqual([]);
  });

  it('前方後円墳の分布を「東北地方の南部まで」と限定しない', () => {
    const bad = allTexts(history1).filter((t) => t.includes('東北地方の南部'));
    expect(bad).toEqual([]);
  });

  it('政治: 選挙権は18さい以上が正答', () => {
    const it = itemsOf(politics).find((x) => x.id === 'el-age');
    expect(it).toBeDefined();
    const ls = choiceLabels(it!);
    expect(ls?.right).toEqual(['18さい以上']);
    // 「選挙権」の説明に、今の年齢として20さいを書かない
    for (const m of politics.misconceptions)
      if (m.explain.includes('投票')) expect(plainText(m.explain)).toContain('18さい');
  });

  it('政治: 憲法の公布・施行の日と憲法記念日', () => {
    const it = itemsOf(politics).find((x) => x.id === 'con-day');
    expect(it).toBeDefined();
    const ls = choiceLabels(it!);
    expect(ls?.right[0]).toContain('5月3日');
    const ex = plainText(it!.explain);
    expect(ex).toContain('1946年11月3日に公布');
    expect(ex).toContain('1947年5月3日に施行');
  });

  it('政治: 天皇の地位は「象徴」、政治の力をもたない', () => {
    const it = itemsOf(politics).find((x) => x.id === 'con-emperor');
    expect(it).toBeDefined();
    const ls = choiceLabels(it!);
    expect(ls?.right[0]).toContain('象徴');
    expect(plainText(it!.explain)).toContain('政治についての力はもたず');
    // 元首・主権者として扱う文がない
    for (const u of [politics, history3])
      for (const t of allTexts(u)) {
        expect(t).not.toContain('元首');
        expect(t).not.toMatch(/日本国憲法[^。]*主権は天皇/);
      }
  });

  it('三つの原則（国民主権・基本的人権の尊重・平和主義）を正しく並べる', () => {
    const three = /国民主権・基本的人権の尊重・平和主義/;
    expect(allTexts(politics).some((t) => three.test(t))).toBe(true);
    // 三権分立・三審制・二院制を三つの原則の正答にしない
    for (const it of itemsOf(politics)) {
      const ls = choiceLabels(it);
      if (!ls || !plainText(it.prompt ?? '').includes('原則')) continue;
      for (const r of ls.right) expect(r).not.toMatch(/三権分立|三審制|二院制/);
    }
  });

  it('政治: 特定の政党・現職の政治家・時事を扱わない（政党名などが出ない）', () => {
    const banned = [
      '自民党',
      '自由民主党',
      '立憲民主',
      '公明党',
      '共産党',
      '維新の会',
      '国民民主',
      'れいわ',
      '社民党',
      '参政党',
    ];
    const bad: string[] = [];
    for (const u of UNITS)
      for (const t of allTexts(u))
        for (const b of banned) if (t.includes(b)) bad.push(`${u.id}: ${b}`);
    expect(bad).toEqual([]);
  });

  it('歴史の年号（主なもの）が説明と合う', () => {
    const facts: [UnitSpec, string, string][] = [
      [history1, 'h1-tl-3', '607年 → 645年 → 710年 → 752年'],
      [history2, 'h2-tl-3', '1543年 → 1549年 → 1600年 → 1603年'],
      [history3, 'h3-tl-5', '1868年'],
      [history3, 'h3-tl-5', '1885年'],
      [history3, 'h3-tl-5', '1894年'],
      [history3, 'h3-tl-5', '1911年'],
      [history3, 'h3-tl-7', '1956年国際連合加盟'],
    ];
    for (const [u, id, s] of facts) {
      const it = itemsOf(u).find((x) => x.id === id);
      expect(it, id).toBeDefined();
      expect(plainText(it!.explain).replace(/\s+/g, ' '), id).toContain(s);
    }
  });
});
