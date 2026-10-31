/**
 * soc-g34 の内容レビュー（2026-10-24）で直した誤りの再発を防ぐ検査。
 * - 小3以上は分かち書きしない（文節の空白を残さない）
 * - ヒントに正答の文字列を出さない（元号・県庁所在地など、短い語も含む）
 * - 県庁所在地・地図記号の名前・元号の始まりの年の事実
 * - 実在の企業名・店名を出さない、消防(119)・警察(110)の番号を取り違えない、性別役割の決めつけをしない
 */
import { describe, expect, it } from 'vitest';
import { sampleItems, textsOf } from '../../curriculum/qa';
import type { Item, UnitSpec } from '../../curriculum/types';
import { plainText } from '../../text/rich';
import pack from './index';

const units = pack.units.filter((u) => u.status !== 'planned');

function allTexts(u: UnitSpec): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [
    { where: 'title', text: u.title },
    ...u.intro.map((s, i) => ({ where: `intro${i}`, text: s.text })),
    ...u.misconceptions.map((m) => ({ where: `mis:${m.id}`, text: m.explain })),
    ...u.objectives.map((o) => ({ where: `obj:${o.id}`, text: o.title })),
    ...u.levels.map((l, i) => ({ where: `level${i}`, text: l.label })),
  ];
  for (const it of sampleItems(u, 50))
    for (const t of textsOf(it)) out.push({ where: it.id, text: t });
  return out.map((x) => ({ ...x, text: plainText(x.text) }));
}

const JP = 'ぁ-んァ-ヶー一-龯々';
/** 日本語どうしの間の空白（「→」の前後の空白は図の書き方なので対象外） */
const WAKACHI = new RegExp(`[${JP}」）、。][ \\u3000]+[${JP}「（]`);

/** 正解の文字列（choice・reading・graph の choice・fill の答え） */
function answersOf(it: Item): string[] {
  if (it.engine === 'choice' || it.engine === 'reading')
    return it.options.filter((o) => o.correct && o.label).map((o) => plainText(o.label!));
  if (it.engine === 'graph' && it.task.kind === 'choice')
    return it.task.options.filter((o) => o.correct && o.label).map((o) => plainText(o.label!));
  if (it.engine === 'fill') return it.blanks.flatMap((b) => b.answers.map((a) => plainText(a)));
  return [];
}

describe('soc-g34 レビューの再発防止', () => {
  for (const u of units) {
    it(`${u.id}: 小3以上は分かち書きしない`, () => {
      const bad = allTexts(u)
        .filter((x) => WAKACHI.test(x.text))
        .map((x) => `${x.where}: ${x.text.slice(0, 40)}`);
      expect([...new Set(bad)]).toEqual([]);
    });

    it(`${u.id}: ヒントに正答の文字列を出さない`, () => {
      const bad: string[] = [];
      for (const it of sampleItems(u, 50)) {
        const hints = it.hints.map((h) => plainText(h));
        for (const a of answersOf(it))
          if (a.length >= 2 && hints.some((h) => h.includes(a))) bad.push(`${it.id}: ${a}`);
      }
      expect([...new Set(bad)]).toEqual([]);
    });

    it(`${u.id}: 実在の店・企業の名前、119/110 の取り違え、性別役割の決めつけがない`, () => {
      const SHOPS =
        /イオン|イトーヨーカドー|セブン|ローソン|ファミリーマート|ファミマ|ミニストップ|西友|ライフ|マルエツ|ユニクロ|ダイソー|コストコ|アマゾン|楽天/;
      const bad: string[] = [];
      for (const { where, text } of allTexts(u)) {
        if (SHOPS.test(text)) bad.push(`店名 ${where}: ${text.slice(0, 30)}`);
        if (/119/.test(text) && /警察|けいさつ|交番|こうばん/.test(text) && !/110/.test(text))
          bad.push(`119と警察 ${where}`);
        if (/110/.test(text) && /消防|しょうぼう|救急|きゅうきゅう/.test(text) && !/119/.test(text))
          bad.push(`110と消防 ${where}`);
        if (
          /(母|お母さん|女の子|妹|姉)[^。]{0,8}(りょうり|料理|せんたく|そうじ|おさいほう)/.test(
            text,
          )
        )
          bad.push(`性別役割 ${where}: ${text.slice(0, 30)}`);
      }
      expect(bad).toEqual([]);
    });
  }

  it('元号の始まりの年が正しい（明治1868・大正1912・昭和1926・平成1989・令和2019）', () => {
    const YEAR: Record<string, number> = {
      明治: 1868,
      大正: 1912,
      昭和: 1926,
      平成: 1989,
      令和: 2019,
    };
    const bad: string[] = [];
    for (const u of units)
      for (const { where, text } of allTexts(u))
        for (const m of text.matchAll(/(明治|大正|昭和|平成|令和)(?:は|（)(\d{4})年から/g))
          if (YEAR[m[1]!] !== Number(m[2])) bad.push(`${where}: ${m[0]}`);
    expect(bad).toEqual([]);
    // 年表の行の元号と年が合っている
    const city = units.find((u) => u.id === 'g3.soc.city-changes')!;
    for (const { text } of allTexts(city))
      for (const m of text.matchAll(/(\d{4})年ごろ（(明治|大正|昭和|平成|令和)）/g)) {
        const y = Number(m[1]);
        const era = Object.entries(YEAR)
          .filter(([, s]) => s <= y)
          .sort((a, b) => b[1] - a[1])[0]![0];
        expect(`${y}:${m[2]}`).toBe(`${y}:${era}`);
      }
  });

  it('県庁所在地（県名と名前がちがう18道県）が正しい', () => {
    const CAP: Record<number, string> = {
      1: 'さっぽろ市',
      3: '盛岡市',
      4: '仙台市',
      8: '水戸市',
      9: '宇都宮市',
      10: '前橋市',
      11: 'さいたま市',
      14: '横浜市',
      17: '金沢市',
      19: '甲府市',
      23: '名古屋市',
      24: '津市',
      25: '大津市',
      28: '神戸市',
      32: '松江市',
      37: '高松市',
      38: '松山市',
      47: '那覇市',
    };
    const u = units.find((x) => x.id === 'g4.soc.prefectures')!;
    const caps = (u.source.items ?? []).filter((it) => /^capital-\d+$/.test(it.id));
    expect(caps.map((it) => Number(it.id.slice(8))).sort((a, b) => a - b)).toEqual(
      Object.keys(CAP)
        .map(Number)
        .sort((a, b) => a - b),
    );
    for (const it of caps) expect(answersOf(it)).toEqual([CAP[Number(it.id.slice(8))]]);
    // 埼玉県（さいたま市）に「県名と名前がちがう」とは言わない
    const saitama = caps.find((it) => it.id === 'capital-11')!;
    expect(saitama.hints.map((h) => plainText(h)).join('')).not.toMatch(/名前はちがう/);
  });

  it('地図記号の名前（記号ID → 名前）が正しい', () => {
    const NAME: Record<string, string> = {
      'city-office': '市役所',
      'town-office': '町村役場',
      school: '学校',
      'high-school': '高等学校',
      police: '警察署',
      koban: '交番',
      fire: '消防署',
      post: '郵便局',
      hospital: '病院',
      shrine: '神社',
      temple: '寺',
      library: '図書館',
      museum: '博物館',
      factory: '工場',
      power: '発電所',
      rice: '田',
      field: '畑',
      orchard: '果樹園',
      tea: '茶畑',
      broadleaf: '広葉樹林',
      conifer: '針葉樹林',
      elderly: '老人ホーム',
      onsen: '温泉',
      castle: '城跡',
      lighthouse: '灯台',
      port: '港',
      station: '駅',
    };
    const u = units.find((x) => x.id === 'g3.soc.map-symbols')!;
    for (const it of u.source.items ?? []) {
      if (it.engine !== 'map' || it.task.kind !== 'symbol' || it.task.ask !== 'name') continue;
      expect(plainText(it.explain).startsWith(`${NAME[it.task.symbol]}の記号`)).toBe(true);
    }
  });

  it('浄水場の問題のヒントが、ほかの選択肢にも当てはまる言い方（「じょう」がつく）をしない', () => {
    const u = units.find((x) => x.id === 'g4.soc.water-waste')!;
    for (const it of u.source.items ?? [])
      for (const h of it.hints) expect(plainText(h)).not.toMatch(/「じょう」がつく/);
  });
});

describe('soc-g34 P2 単元（safety・tradition）', () => {
  const safety = units.find((u) => u.id === 'g3.soc.safety')!;
  const tradition = units.find((u) => u.id === 'g4.soc.tradition')!;
  const byId = (u: UnitSpec, id: string) => (u.source.items ?? []).find((it) => it.id === id)!;

  it('両単元が P2・ready', () => {
    for (const u of [safety, tradition]) {
      expect(u.priority).toBe('P2');
      expect(u.status).toBe('ready');
    }
  });

  it('safety: 119・110 と通信指令室の問題の答え', () => {
    expect(answersOf(byId(safety, 'call-c1'))).toEqual(['119番']);
    expect(answersOf(byId(safety, 'call-c2'))).toEqual(['110番']);
    expect(answersOf(byId(safety, 'call-c3'))).toEqual(['通信指令室']);
    expect(answersOf(byId(safety, 'call-a4'))).toEqual(['通信指令室']);
    expect(answersOf(byId(safety, 'call-a2'))).toEqual(['119', '110']);
  });

  it('safety: 順序の問題に「聞く前に出動をつたえる」誤りの並びがある', () => {
    for (const id of ['call-o1', 'call-o2']) {
      const it = byId(safety, id);
      expect(it.engine).toBe('order');
      if (it.engine === 'order')
        expect(it.wrongOrders?.map((w) => w.misconception)).toEqual(['skip-ask']);
    }
  });

  it('safety: 通信指令室が答えの問題のヒントに「指令」を出さない', () => {
    for (const id of ['call-c3', 'call-a4'])
      for (const h of byId(safety, id).hints) expect(plainText(h), id).not.toMatch(/指令/);
  });

  it('safety・tradition: 誤りの選択肢の誤概念が場面に合う（今年から → 読みちがえ）', () => {
    const r7 = byId(tradition, 'bun-r7');
    if (r7.engine !== 'reading') throw new Error('形が違う');
    const o = r7.options.find((x) => x.label && plainText(x.label) === '今年から');
    expect(o?.misconception).toBe('misread');
  });

  it('tradition: 本文は6種類、文種は2種類以上', () => {
    const ps = new Map<string, string>();
    for (const it of tradition.source.items ?? [])
      if (it.engine === 'reading') ps.set(it.passage.id, it.passage.genre);
    expect([...ps.keys()].sort()).toEqual(
      [
        'tr-hashi',
        'tr-matsubayashi',
        'tr-matsuri',
        'tr-shishi',
        'tr-yousui',
        'tr-yousui-now',
      ].sort(),
    );
    expect(new Set(ps.values()).size).toBeGreaterThanOrEqual(2);
  });

  it('tradition: reading はすべて hintFocus 付き、sen-r9 以外は evidence 付き', () => {
    for (const it of tradition.source.items ?? []) {
      if (it.engine !== 'reading') continue;
      if (it.id !== 'sen-r9') {
        expect(it.hintFocus, it.id).toBeTruthy();
        expect(it.evidence, it.id).toBeTruthy();
      }
    }
  });

  it('tradition: sen-r9 の答えは年表の（完成する年 − 始める年）', () => {
    const it = byId(tradition, 'sen-r9');
    if (it.engine !== 'reading' || it.passage.figure?.kind !== 'table') throw new Error('形が違う');
    const rows = it.passage.figure.rows.map((r) => r.map((c) => plainText(c)));
    const year = (kw: string) =>
      Number(rows.find((r) => r[1]!.includes(kw))![0]!.match(/\d{4}/)![0]);
    expect(answersOf(it)).toEqual([`${year('完成する') - year('始める')}年`]);
  });

  it('tradition: 架空の人名（新助・平六）以外の人名らしい語を出さない', () => {
    const bad = allTexts(tradition).filter((x) => /衛門|兵衛|太郎|次郎|三郎/.test(x.text));
    expect(bad).toEqual([]);
  });
});
