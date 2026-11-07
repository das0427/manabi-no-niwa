import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems, textsOf } from '../../curriculum/qa';
import type { Item, UnitSpec } from '../../curriculum/types';
import { lifeG12Illust } from '../../illust/content/life-g12';
import { ILLUST } from '../../illust/registry';

const hasIllust = (id: string) => id in ILLUST || id in lifeG12Illust;
import { kanjiGrade } from '../../text/kanji-grades';
import { parseRich, plainText, type Token } from '../../text/rich';
import pack from './index';
import { sortCardsPerBox, sortItem, type SortSpec } from './util';

/** 選択肢の上限（ux-by-age: 小1・小2 は 4。複数選択は除く） */
const MAX_CHOICES = 4;

const gradeOf = (unit: UnitSpec): number => Number(unit.stage.slice(1));

/** 文の中の、よみ付きの漢字のうち配当学年が grade より上の字 */
function overGrade(src: string, grade: number): string[] {
  const bad: string[] = [];
  const walk = (ts: Token[]) => {
    for (const t of ts) {
      if (t.t === 'ruby') for (const c of t.base) if (kanjiGrade(c) > grade) bad.push(c);
      if (t.t === 'strong') walk(t.children);
    }
  };
  walk(parseRich(src));
  return bad;
}

/** 問題の中の絵の id */
function illustIds(x: unknown, out: string[] = []): string[] {
  if (Array.isArray(x)) for (const v of x) illustIds(v, out);
  else if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    if (o.kind === 'illust' && typeof o.id === 'string') out.push(o.id);
    for (const v of Object.values(o)) if (typeof v !== 'function') illustIds(v, out);
  }
  return out;
}

function extraChecks(unit: UnitSpec): string[] {
  const errs: string[] = [];
  const grade = gradeOf(unit);
  const items = sampleItems(unit, 50);
  const ids = new Set<string>();
  if (unit.source.kind === 'items')
    for (const it of unit.source.items) {
      if (ids.has(it.id)) errs.push(`id が重複: ${it.id}`);
      ids.add(it.id);
    }
  const texts = [
    unit.title,
    ...unit.intro.map((s) => s.text),
    ...unit.misconceptions.map((m) => m.explain),
    ...unit.objectives.map((o) => o.title),
    ...items.flatMap((it) => textsOf(it)),
  ];
  for (const t of texts)
    for (const k of overGrade(t, grade))
      errs.push(`${grade}年より上の漢字「${k}」: ${t.slice(0, 30)}`);
  for (const it of items) {
    if (
      (it.engine === 'choice' || it.engine === 'listen' || it.engine === 'reading') &&
      !it.multi &&
      it.options.length > MAX_CHOICES
    )
      errs.push(`[${it.id}] 選択肢は${MAX_CHOICES}つまで`);
    for (const id of illustIds(it)) if (!hasIllust(id)) errs.push(`[${it.id}] 絵 ${id} が無い`);
    // 1〜2年は分かち書き: かなが 13 字以上つづく文は疑う
    for (const t of textsOf(it)) {
      const plain = t.replace(/《[^》]*》/g, '');
      if (/[ぁ-んァ-ヶー]{13,}/.test(plain))
        errs.push(`[${it.id}] 分かち書きが長い: ${t.slice(0, 40)}`);
    }
  }
  for (const s of unit.intro)
    if (s.figure)
      for (const id of illustIds(s.figure))
        if (!hasIllust(id)) errs.push(`おてほん 絵 ${id} が無い`);
  return [...new Set(errs)];
}

describe('life-g12 の教材検査（curriculum-matrix 1.8）', () => {
  it('パックの形', () => {
    expect(pack.packId).toBe('life-g12');
    const ids = pack.units.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  for (const unit of pack.units) {
    if (unit.status === 'planned') continue;
    it(`${unit.id}: 検査の誤りなし・量と網羅`, () => {
      const r = checkUnit(unit);
      expect(r.errors).toEqual([]);
      expect(extraChecks(unit)).toEqual([]);
      if (unit.status === 'ready') expect(isReady(r)).toBe(true);
      console.info(
        `${unit.id}: Q ${r.q.toFixed(2)} (${r.distinct}) / C ${r.c[0]}/${r.c[1]} / 汎用誤答 ${(r.genericWrongShare * 100).toFixed(0)}% / 誤概念 ${unit.misconceptions.length} / ${r.objectives.map((o) => `${o.id}:${o.distinct}+${o.alt}`).join(' ')}`,
      );
    });
  }

  it('各段階に 5 問以上ある（1回分が組める）', () => {
    for (const unit of pack.units) {
      if (unit.source.kind !== 'items') continue;
      for (let level = 0; level < unit.levels.length; level++) {
        const n = unit.source.items.filter((it: Item) => it.level === level).length;
        expect(n, `${unit.id} 段階${level}`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('ヒント③が 正解の選択肢の文を そのまま いわない', () => {
    const norm = (s: string) => s.replace(/《[^》]*》/g, '').replace(/[\s、。「」！？]/g, '');
    const bad: string[] = [];
    for (const unit of pack.units) {
      if (unit.source.kind !== 'items') continue;
      for (const it of unit.source.items) {
        if (it.engine !== 'choice') continue;
        const ok = it.options.find((o) => o.correct);
        if (!ok?.label) continue;
        // 番号つきの一覧（「1：…」）なら、問題文から 正解の文を とりだす
        const listed = it.prompt.split('\n').find((l) => l.startsWith(`${ok.label}：`));
        const text = norm(listed ? listed.slice(ok.label.length + 1) : ok.label);
        if (text.length < 4) continue;
        if (norm(it.hints[2] ?? '').includes(text)) bad.push(`${unit.id} ${it.id}: ${it.hints[2]}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('内容の再発防止（レビューで直した点）', () => {
    const unitOf = (id: string) => pack.units.find((u) => u.id === id)!;
    const itemOf = (uid: string, iid: string) => {
      const u = unitOf(uid);
      if (u.source.kind !== 'items') throw new Error(uid);
      return u.source.items.find((x) => x.id === iid)!;
    };
    const optionTexts = (it: Item) => {
      if (it.engine !== 'choice') return [];
      return it.options.map((o) => {
        const l = it.prompt.split('\n').find((x) => x.startsWith(`${o.label}：`));
        return {
          text: l ? l.slice((o.label ?? '').length + 1) : (o.label ?? ''),
          correct: !!o.correct,
        };
      });
    };
    // 止まっている車のかげからは「車の はしで 止まって 見る」。前に出てから見るのは あぶない
    const kage = optionTexts(itemOf('g1.life.school-safety', 'cross-kage'));
    expect(kage.find((o) => o.correct)?.text).toContain('はしで とまって');
    const safety = unitOf('g1.life.school-safety');
    if (safety.source.kind === 'items')
      for (const it of safety.source.items) {
        for (const o of optionTexts(it))
          if (o.correct) expect(o.text, it.id).not.toContain('まえに でて');
        for (const h of it.hints) expect(h, it.id).not.toContain('まえに でて');
      }
    // 帰り道に ひとりで 遠くへ 行くことを 正解に しない
    expect(
      optionTexts(itemOf('g1.life.school-safety', 'danger-hitori')).find((o) => o.correct)?.text,
    ).toContain('まっすぐ かえって');
    // トマトの花のあとには み（と その中の たね）ができる。「たね」を誤りにしない
    const a3 = itemOf('g1.life.plant-diary', 'growth-alt-a3');
    expect(
      optionTexts(a3)
        .filter((o) => !o.correct)
        .map((o) => o.text),
    ).not.toContain('たね');
    // しおれている問題に、葉がぴんとした うえきばちの絵を つけない
    const c5 = itemOf('g1.life.plant-diary', 'care-c5');
    expect(illustIds(c5.figure)).not.toContain('life-pot');
    // こうばんの人の説明が しょうぼうしょの人にも あてはまらない
    const town = unitOf('g2.life.town');
    if (town.source.kind === 'items')
      for (const it of town.source.items) {
        if (it.engine !== 'match') continue;
        const anzen = it.right.filter((r) => r.label?.includes('あんぜん'));
        expect(anzen.length, it.id).toBeLessThanOrEqual(1);
      }
    // 「つれて かえる」だけを よくない ことに しない（しらべて から かう のは よい こと）
    const s3 = itemOf('g2.life.animals', 'need-alt-s3');
    if (s3.engine === 'sort') expect(s3.cards.map((c) => c.label)).not.toContain('つれて かえる');
  });

  it('sort は 画面に入らない枚数の札を 黙って減らさず 例外にする（第8回）', () => {
    const base = {
      id: 't',
      obj: 'x',
      level: 0,
      prompt: 'p',
      mis: 'm',
      hints: ['a', 'b', 'c'],
      explain: 'e',
    } satisfies Partial<SortSpec>;
    expect(sortCardsPerBox(2)).toBe(2);
    expect(sortCardsPerBox(3)).toBe(1);
    expect(sortCardsPerBox(4)).toBe(1);
    // 2つの箱: 2枚ずつは入る。3枚は入らない
    const ok2: SortSpec = {
      ...base,
      boxes: ['あ', 'い'],
      cards: [
        ['あ1', 0],
        ['あ2', 0],
        ['い1', 1],
        ['い2', 1],
      ],
    };
    expect(sortItem(ok2).cards.map((c) => c.label)).toEqual(['あ1', 'あ2', 'い1', 'い2']);
    expect(() => sortItem({ ...ok2, cards: [...ok2.cards, ['い3', 1]] })).toThrow(/い.*3 枚/);
    // 4つの箱: 1枚ずつだけ入る。2枚は入らない
    const ok4: SortSpec = {
      ...base,
      boxes: ['a', 'b', 'c', 'd'],
      cards: [
        ['a1', 0],
        ['b1', 1],
        ['c1', 2],
        ['d1', 3],
      ],
    };
    expect(sortItem(ok4).cards.length).toBe(4);
    expect(() => sortItem({ ...ok4, cards: [...ok4.cards, ['a2', 0]] })).toThrow(/a.*2 枚/);
  });

  it('sort の解説は 画面に出す札だけで言う（第8回）', () => {
    // 札を黙って減らしていたころ、解説が 画面に出ていない札の名前を言っていた。
    // 外した札の名前（キーは「単元ID/問題ID」）を、解説に出さない。
    const DROPPED: Record<string, string[]> = {
      'g1.life.school-safety/rule-alt-s1': ['てを あげる', 'わりこむ'],
      'g1.life.school-safety/rule-alt-s2': ['かたづけ', 'かって に つかう'],
      'g1.life.school-safety/rule-alt-s3': ['ひろい ところで なげる', 'とびおりる'],
      'g1.life.school-safety/danger-alt-s1': ['いっしょに かえる', 'ボールあそび'],
      'g1.life.school-safety/danger-alt-s2': ['おうちの ひとに', 'とおくへ いく'],
      'g1.life.school-safety/danger-alt-s3': ['ひろった ものを', 'ほそみち'],
      'g1.life.seasons/compare-alt-s1': ['おはなみ', 'すいか', 'きのこ', 'ゆきだるま'],
      'g1.life.seasons/compare-alt-s2': ['たんぽぽ', 'ゆきだるま'],
      'g1.life.seasons/compare-alt-s3': ['プール', 'おつきみ'],
      'g1.life.plant-diary/care-alt-s1': ['ひかり', 'おおきな おと'],
      'g1.life.plant-diary/care-alt-s2': ['かわいたら', 'いちどに'],
      'g1.life.plant-diary/care-alt-s3': ['てを あらって', 'ちぎって'],
      'g2.life.town/rule-alt-s1': ['たいせつに あつかう', 'らくがき'],
      'g2.life.town/rule-alt-s2': ['ぶつからない', 'ブランコを ひとりじめ'],
      'g2.life.town/rule-alt-s3': ['てすり', 'ドアの ところ'],
      'g2.life.animals/need-alt-s1': ['きれいな みず', 'ぼうし'],
      'g2.life.animals/need-alt-s2': ['てを あらう', 'わすれて'],
      'g2.life.animals/need-alt-s3': ['こまった ときは', 'むりやり あげる'],
    };
    const MARK = '〔札〕';
    const seen = new Set<string>();
    for (const unit of pack.units) {
      if (unit.source.kind !== 'items') continue;
      for (const it of unit.source.items) {
        if (it.engine !== 'sort') continue;
        const key = `${unit.id}/${it.id}`;
        seen.add(key);
        // 札は 箱ごとに 入る枚数まで。どの箱にも 1枚はある
        for (let b = 0; b < it.boxes.length; b++) {
          const n = it.cards.filter((c) => c.box === b).length;
          expect(n, `${key} 箱${b}の札`).toBeLessThanOrEqual(sortCardsPerBox(it.boxes.length));
          expect(n, `${key} 箱${b}の札`).toBeGreaterThanOrEqual(1);
        }
        const explain = plainText(it.explain);
        const labels = it.cards.map((c) => plainText(c.label ?? ''));
        // 画面の札の名前を、そのまま 言う
        for (const l of labels) expect(explain, `${key} 札「${l}」`).toContain(l);
        // 札の名前の並び（「・」でつなぐ）に、札でない名前が まじらない
        let rest = explain;
        for (const l of [...labels].sort((a, z) => z.length - a.length))
          rest = rest.split(l).join(MARK);
        rest = rest.replace(new RegExp(`${MARK}(・${MARK})+`, 'g'), MARK);
        expect(rest, `${key}: 画面にない名前が「・」でつながっている`).not.toContain('・');
        // 外した札の名前は 出さない
        for (const d of DROPPED[key] ?? [])
          expect(explain, `${key} 外した札「${d}」`).not.toContain(d);
      }
    }
    // 18 問ぜんぶ見ている
    expect([...seen].sort()).toEqual(Object.keys(DROPPED).sort());
  });

  it('採点しない記録（explain）には正誤の言い方が無い', () => {
    for (const unit of pack.units) {
      if (unit.source.kind !== 'items') continue;
      for (const it of unit.source.items) {
        if (it.engine !== 'explain') continue;
        expect(it.explain, `${unit.id} ${it.id}`).not.toMatch(/せいかい|まちがい|ただしい/);
      }
    }
  });

  it('P2 の3単元（public・home・tell）の量・優先・内容', () => {
    const unitOf = (id: string) => pack.units.find((u) => u.id === id)!;
    const itemsOf = (id: string): Item[] => {
      const u = unitOf(id);
      if (u.source.kind !== 'items') throw new Error(id);
      return u.source.items;
    };
    const expected: Record<string, [number, number, number]> = {
      'g1.life.public': [30, 1.25, 3],
      'g1.life.home': [18, 3, 2],
      'g2.life.tell': [30, 1.25, 3],
    };
    for (const [id, [distinct, q, c]] of Object.entries(expected)) {
      const u = unitOf(id);
      expect(u.priority, id).toBe('P2');
      expect(u.status, id).toBe('ready');
      const r = checkUnit(u);
      expect(isReady(r), id).toBe(true);
      expect(r.distinct, id).toBe(distinct);
      expect(r.q, id).toBeCloseTo(q, 2);
      expect(r.c, id).toEqual([c, c]);
      // 誤りの選択肢はすべて誤概念つき（汎用誤答 0%）
      for (const it of itemsOf(id))
        if (it.engine === 'choice')
          for (const o of it.options)
            if (!o.correct) expect(o.misconception, `${id} ${it.id}`).toBeTruthy();
    }
    const optionTexts = (it: Item) => {
      if (it.engine !== 'choice') return [];
      return it.options.map((o) => {
        const l = it.prompt.split('\n').find((x) => x.startsWith(`${o.label}：`));
        return {
          text: l ? l.slice((o.label ?? '').length + 1) : (o.label ?? ''),
          correct: !!o.correct,
        };
      });
    };
    const pick = (uid: string, iid: string) => itemsOf(uid).find((x) => x.id === iid)!;
    // こわれた遊具は、子供が直す・乗るを正解にしない
    expect(
      optionTexts(pick('g1.life.public', 'use-broken')).find((o) => o.correct)?.text,
    ).toContain('おとな');
    expect(optionTexts(pick('g1.life.public', 'sup-fix')).find((o) => o.correct)?.text).not.toBe(
      'こどもが じぶんで なおす',
    );
    // home: 家族の形を決めつけない・火やはものを勧めない
    const home = unitOf('g1.life.home');
    const homeTexts = [
      home.title,
      ...home.intro.map((x) => x.text),
      ...home.objectives.map((o) => o.title),
      ...home.misconceptions.map((m) => m.explain),
      ...itemsOf('g1.life.home').flatMap((it) => textsOf(it)),
    ];
    for (const t of homeTexts) {
      expect(t).not.toMatch(/おかあさん|おとうさん|ママ|パパ/);
      expect(t).not.toMatch(/ほうちょう|ひを つかう/);
    }
    // home: explain の理由は 3つ以下（4つ目以降は切られる）
    for (const it of itemsOf('g1.life.home'))
      if (it.engine === 'explain' && it.reasons)
        expect(it.reasons.length, it.id).toBeLessThanOrEqual(3);
    // tell: 手紙の問題は 図に「おばあちゃんへ」・3つのボタン・正解は「かいた ひと」
    const letter = pick('g2.life.tell', 'man-alt-letter');
    expect(JSON.stringify(letter.figure)).toContain('おばあちゃんへ');
    if (letter.engine !== 'choice') throw new Error('man-alt-letter');
    expect(letter.options.length).toBe(3);
    expect(letter.options.find((o) => o.correct)?.label).toBe('かいた ひと');
    // レビューで直した文: 「子と」を かなで「こと」と書かない・問題の順に よる「こんどは」を使わない
    const publicTexts = itemsOf('g1.life.public').flatMap((it) => textsOf(it));
    for (const t of publicTexts) expect(t).not.toMatch(/くる こと ぶつか|きまりの ひ|こんどは/);
    // tell（小2）は 手紙・電話 を 漢字《よみ》で そろえる
    const tellTexts = itemsOf('g2.life.tell').flatMap((it) => [
      ...textsOf(it),
      ...(it.engine === 'choice' ? it.options.map((o) => o.label ?? '') : []),
    ]);
    for (const t of tellTexts) expect(t.replace(/《[^》]*》/g, '')).not.toMatch(/てがみ|でんわ/);
  });
});
