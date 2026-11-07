// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems, textsOf } from '../../curriculum/qa';
import type { UnitSpec } from '../../curriculum/types';
import { enG34Illust } from '../../illust/content/en-g34';
import { getIllust } from '../../illust/registry';
import { kanjiGrade } from '../../text/kanji-grades';
import { parseRich, type Token } from '../../text/rich';
import { isMirror } from './alphabet-lower';
import {
  GOAL_ROWS,
  GOAL_TURN_CODES,
  goalPos,
  routeSvg,
  townLetters,
  walk,
  type GoalDir,
  type PlaceCode,
  type Step,
} from './directions';
import { LIKE_WORDS } from './likes';
import { NAMES } from './names';
import { SAME_START } from './numbers-colors';
import { NUMBER_WORDS } from './want';
import { soundMates } from './alphabet-upper';
import pack from './index';
import { englishScript } from './voice';

/**
 * 絵が あるか（registry の content の自動読み込みは テストの変換キャッシュで 新しい ファイルが 入らない ことが
 * あるので、このパックの絵は モジュールから 直接 たしかめる）
 */
const known = (id: string) => !!getIllust(id) || id in enG34Illust;

/** ux-by-age: 小3・小4 の選択肢は 4 まで */
const MAX_CHOICES = 4;

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

function extraChecks(unit: UnitSpec): string[] {
  const errs: string[] = [];
  const grade = Number(unit.stage.slice(1));
  const items = sampleItems(unit, 1);
  const ids = new Set<string>();
  for (const it of items) {
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
  // 問題文・導入は日本語の音声で読み上げるので、英字を入れない（英語は音声・選択肢・図に置く）
  for (const t of [...unit.intro.map((s) => s.text), ...items.map((it) => it.prompt)])
    if (/[A-Za-z]/.test(t)) errs.push(`問題文・導入に英字: ${t.slice(0, 30)}`);
  for (const it of items) {
    if (
      (it.engine === 'choice' || it.engine === 'listen') &&
      !it.multi &&
      it.options.length > MAX_CHOICES
    )
      errs.push(`[${it.id}] 選択肢は${MAX_CHOICES}つまで`);
    if (it.engine === 'listen') {
      const sounds = Array.isArray(it.audio) ? it.audio : [it.audio];
      for (const s of sounds)
        if (!s.key || !s.key.startsWith('en/en-g34.')) errs.push(`[${it.id}] 英語の音声キーが無い`);
    }
    // 3・4年は 文字を書かせない（2.3）
    if (it.engine === 'trace' || it.engine === 'build') errs.push(`[${it.id}] 3・4年で書く問題`);
  }
  return [...new Set(errs)];
}

describe('en-g34 の教材検査（curriculum-matrix 1.8）', () => {
  it('パックの形', () => {
    expect(pack.packId).toBe('en-g34');
    const ids = pack.units.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const unit of pack.units) {
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

  it('英語の台本: 同じ key に違う文が無い・script-en.json と一致', () => {
    const { entries, clash } = englishScript(pack);
    expect(clash).toEqual([]);
    for (const e of entries) expect(e.key).toMatch(/^[a-z0-9._-]+$/);
    const file = fileURLToPath(new URL('./script-en.json', import.meta.url));
    const json = JSON.parse(readFileSync(file, 'utf8')) as {
      entries: { key: string; text: string }[];
    };
    expect(json.entries).toEqual(entries);
    console.info(`en-g34 英語の台本: ${entries.length} 本`);
  });

  it('つかって いる 絵は すべて ある', () => {
    const missing: string[] = [];
    const walk = (x: unknown): void => {
      if (Array.isArray(x)) for (const v of x) walk(v);
      else if (x && typeof x === 'object') {
        const o = x as Record<string, unknown>;
        if (o.kind === 'illust' && typeof o.id === 'string' && !known(o.id)) missing.push(o.id);
        for (const v of Object.values(o)) walk(v);
      }
    };
    for (const unit of pack.units) {
      if (!known(unit.icon)) missing.push(unit.icon);
      walk(unit.intro);
      walk(sampleItems(unit, 1));
    }
    expect([...new Set(missing)]).toEqual([]);
  });

  // ---- 内容レビュー（2026-10-24）の 再発防止 ----
  const allItems = () => pack.units.flatMap((u) => sampleItems(u, 1));
  const hint3 = (it: { hints?: unknown[] }) => String(it.hints?.[2] ?? '');
  type Opt = { label?: string; correct?: boolean; misconception?: string };
  const optsOf = (it: unknown): Opt[] => ((it as { options?: Opt[] }).options ?? []) as Opt[];

  it('ヒント③が 正答の 選択肢を そのまま いわない', () => {
    const bad: string[] = [];
    for (const it of allItems()) {
      const h = hint3(it);
      for (const o of optsOf(it))
        if (
          o.correct &&
          o.label &&
          o.label.length >= 2 &&
          !/^\d/.test(o.label) &&
          h.includes(o.label)
        )
          bad.push(`${it.id}: ${h}`);
    }
    expect(bad).toEqual([]);
  });

  it('ヒント③の 範囲（AからMの はんぶん・1から6 など）で 選択肢が 1つに きまらない', () => {
    const bad: string[] = [];
    for (const it of allItems()) {
      const h = hint3(it);
      let opts = optsOf(it).filter((o) => o.label);
      if (!opts.length) continue;
      // half: ②で「ちょうど」（:00）は きえる
      if (it.id.startsWith('half:')) opts = opts.filter((o) => !o.label!.endsWith(':00'));
      const num = (o: Opt) => parseInt(o.label!, 10);
      let inRange: ((o: Opt) => boolean) | null = null;
      const m = /(\d+)から ?(\d+)の どれか/.exec(h);
      if (m) inRange = (o) => num(o) >= Number(m[1]) && num(o) <= Number(m[2]);
      else if (h.includes('10より 大《おお》きく 20までの'))
        inRange = (o) => num(o) > 10 && num(o) <= 20;
      else if (h.includes('まえの はんぶん')) inRange = (o) => o.label!.toUpperCase() <= 'M';
      else if (h.includes('うしろの はんぶん')) inRange = (o) => o.label!.toUpperCase() > 'M';
      if (inRange && opts.filter(inRange).length < 2) bad.push(`${it.id}: ${h}`);
    }
    expect(bad).toEqual([]);
  });

  it('誤概念 mirror（むきが はんたい）は かがみ・さかさの 組だけに つく', () => {
    const bad: string[] = [];
    for (const it of allItems()) {
      const right = optsOf(it).find((o) => o.correct)?.label;
      for (const o of optsOf(it))
        if (o.misconception === 'mirror' && !(right && isMirror(right, o.label!)))
          bad.push(`${it.id}: ${right} / ${o.label}`);
    }
    expect(bad).toEqual([]);
  });

  it('かんばん さがし: sound-alike は 音の にている 字が 入った かんばんだけ', () => {
    const bad: string[] = [];
    for (const it of allItems())
      if (it.id.startsWith('find:')) {
        const c = it.id.slice(5);
        for (const o of optsOf(it))
          if (o.misconception === 'sound-alike' && !soundMates(c).some((x) => o.label!.includes(x)))
            bad.push(`${it.id}: ${o.label}`);
      }
    expect(bad).toEqual([]);
  });

  it('あいさつの ばめん（when）の 誤りに「はじめだけ 聞いた」を つけない', () => {
    for (const it of allItems())
      if (it.id.startsWith('when:'))
        for (const o of optsOf(it)) expect(o.misconception, it.id).not.toBe('whole-phrase');
  });

  it('きもちの ばめん（feel-scene）: その ばめんでも いえる きもちを 誤りに しない', () => {
    const NG: Record<string, string[]> = {
      'feel-scene:im-thirsty': ['たくさん はしった', 'なつの ひに そとに いる'],
      'feel-scene:im-tired': [
        'みずを のみたい',
        'あさごはんを たべて いない',
        'よる おそくまで おきて いた',
      ],
      'feel-scene:im-hungry': ['たくさん はしった'],
      'feel-scene:im-sleepy': ['たくさん はしった'],
      'feel-scene:im-hot': ['みずを のみたい'],
    };
    for (const it of allItems())
      for (const o of optsOf(it))
        if (!o.correct) expect(NG[it.id] ?? [], it.id).not.toContain(o.label);
  });

  it('listen の誤りの選択肢には すべて誤概念IDが付く', () => {
    for (const unit of pack.units)
      for (const it of sampleItems(unit, 1))
        if (it.engine === 'listen' || it.engine === 'choice')
          for (const o of it.options) if (!o.correct) expect(o.misconception, it.id).toBeTruthy();
  });
});

// ---- P2 単元（likes・want・directions。設計書 docs/expansion/p2-design/en-g34.md 1.7・2.7・3.10）----
interface AnyOpt {
  label?: string;
  correct?: boolean;
  misconception?: string;
  figure?: {
    kind: string;
    id?: string;
    count?: number;
    tens?: number;
    ones?: number;
    markup?: string;
    items?: AnyOpt['figure'][];
  };
}
interface AnyItem {
  id: string;
  audio?: { text: string } | { text: string }[];
  options?: AnyOpt[];
}
const itemsOf = (unitId: string): AnyItem[] =>
  sampleItems(
    pack.units.find((u) => u.id === unitId)!,
    1,
  ) as unknown as AnyItem[];
const unitOf = (unitId: string) => pack.units.find((u) => u.id === unitId)!;
const textsOfAudio = (it: AnyItem): string[] =>
  (Array.isArray(it.audio) ? it.audio : it.audio ? [it.audio] : []).map((a) => a.text);
const correctOf = (it: AnyItem) => it.options!.find((o) => o.correct)!;

describe('g3.en.likes', () => {
  const items = itemsOf('g3.en.likes');
  it('isReady', () => {
    expect(isReady(checkUnit(unitOf('g3.en.likes')))).toBe(true);
  });
  it("「すきではない」「×」は 音声に don't が あるときだけ", () => {
    const bad: string[] = [];
    for (const it of items) {
      if (!/^(not|ask|not-mark):/.test(it.id)) continue;
      const neg = textsOfAudio(it).some((t) => t.includes("don't"));
      const l = correctOf(it).label!;
      const isNeg = l.endsWith('すきではない') || l.endsWith('×');
      if (neg !== isNeg) bad.push(`${it.id}: ${l}`);
    }
    expect(bad).toEqual([]);
  });
  it('dont-mix・yes-no・ask-tell の誤りは 正答と 同じ 物の 名前で 始まる', () => {
    const head = (l: string) => l.split(/ (?=[○×])|が /)[0];
    const bad: string[] = [];
    for (const it of items.filter((x) => !x.id.startsWith('not-two:')))
      for (const o of it.options!)
        if (['dont-mix', 'yes-no', 'ask-tell'].includes(o.misconception ?? ''))
          if (head(o.label!) !== head(correctOf(it).label!)) bad.push(`${it.id}: ${o.label}`);
    expect(bad).toEqual([]);
  });
  it('like: の 正答の 絵は 英文の 語と 一致', () => {
    for (const it of items.filter((x) => x.id.startsWith('like:'))) {
      const word = /I like (\w+)\./.exec(textsOfAudio(it)[0]!)![1]!;
      const o = correctOf(it);
      expect(o.figure!.id, it.id).toBe(LIKE_WORDS[word]);
      expect(o.label, it.id).toBe(NAMES[LIKE_WORDS[word]!]);
    }
  });
});

describe('g4.en.want', () => {
  const items = itemsOf('g4.en.want');
  it('isReady', () => {
    expect(isReady(checkUnit(unitOf('g4.en.want')))).toBe(true);
  });
  const numsIn = (it: AnyItem): number[] =>
    textsOfAudio(it)
      .flatMap((t) => t.toLowerCase().match(/\b[a-z]+\b/g) ?? [])
      .map((w) => NUMBER_WORDS.indexOf(w))
      .filter((n) => n > 0);
  const figCounts = (o: AnyOpt): [string, number][] => {
    const f = o.figure!;
    const list = f.kind === 'row' ? f.items! : [f];
    return list.map((x) => [x!.id!, x!.count!]);
  };
  it('count・shop: 英文の 数と 正答の 絵の 数が 一致', () => {
    for (const it of items.filter((x) => /^(count|shop|shop-two):/.test(x.id))) {
      const counts = figCounts(correctOf(it)).map((c) => c[1]);
      expect(counts, it.id).toEqual(numsIn(it));
    }
    for (const it of items.filter((x) => x.id.startsWith('count-word:'))) {
      const n = numsIn(it)[0];
      expect(correctOf(it).label, it.id).toMatch(new RegExp(` ${n}こ$`));
    }
  });
  it('num-sound・item-mix・swap-count の 作り', () => {
    for (const it of items) {
      const c = correctOf(it);
      for (const o of it.options!) {
        if (o.correct || !o.figure) continue;
        const a = figCounts(c);
        const b = figCounts(o);
        if (o.misconception === 'num-sound') {
          expect(b[0]![0], it.id).toBe(a[0]![0]);
          expect(SAME_START[a[0]![1]]).toContain(b[0]![1]);
        } else if (o.misconception === 'item-mix') {
          expect(
            b.map((x) => x[1]),
            it.id,
          ).toEqual(a.map((x) => x[1]));
          expect(
            b.map((x) => x[0]),
            it.id,
          ).not.toEqual(a.map((x) => x[0]));
        } else if (o.misconception === 'swap-count') {
          expect(
            b.map((x) => x[1]),
            it.id,
          ).toEqual(a.map((x) => x[1]).reverse());
        }
      }
    }
  });
  it('赤い物と 緑の 物が 同じ 問題の 選択肢に 並ばない', () => {
    const RED = ['apple', 'strawberry', 'tomato', 'car-red'];
    const GREEN = ['cucumber', 'green-pepper', 'frog', 'turtle'];
    const bad: string[] = [];
    for (const it of itemsOf('g3.en.likes').concat(items)) {
      const ids = (it.options ?? []).flatMap((o) =>
        o.figure?.kind === 'row'
          ? o.figure.items!.map((x) => x!.id!)
          : o.figure?.id
            ? [o.figure.id]
            : [],
      );
      if (ids.some((i) => RED.includes(i)) && ids.some((i) => GREEN.includes(i))) bad.push(it.id);
    }
    expect(bad).toEqual([]);
  });
  it('want・count・shop-two: 正答の 絵は 英文の 語と 一致（絵の 取りちがえ 防止）', () => {
    const single = (w: string) =>
      w.endsWith('ies')
        ? `${w.slice(0, -3)}y`
        : /(ches|toes)$/.test(w)
          ? w.slice(0, -2)
          : w.endsWith('s')
            ? w.slice(0, -1)
            : w;
    for (const it of items.filter((x) => /^(want|count|shop-two):/.test(x.id))) {
      const t = textsOfAudio(it)[0]!;
      const words = [
        ...t.matchAll(/(?:\ban?|one|two|three|four|five|six|seven|eight|nine|ten) (\w+)/g),
      ].map((m) => single(m[1]!));
      expect(
        figCounts(correctOf(it)).map((c) => c[0]),
        it.id,
      ).toEqual(words);
    }
    // want-word・count-word の ことばの 選択肢も 英文の 語の 名前で 始まる
    for (const it of items.filter((x) => /^(want-word|count-word):/.test(x.id))) {
      const w = /(\w+)\.$/.exec(textsOfAudio(it)[0]!)![1]!;
      expect(correctOf(it).label!.startsWith(NAMES[single(w)]!), it.id).toBe(true);
    }
  });
});

describe('g3.en.numbers-colors', () => {
  const items = itemsOf('g3.en.numbers-colors');
  const picCount = (o: AnyOpt): number => {
    const f = o.figure!;
    return f.kind === 'blocks' ? f.tens! * 10 + f.ones! : f.count!;
  };
  it('絵を えらぶ 問題（num-pic。答えが 10 以下）の まちがいは 1〜10 の 絵で、札が 3 行に ならない', () => {
    // 11 こ（5・5・1 の 3 行）の 札が あると、解説で 数える 絵が 4u を 切る（文字の配置の検査 C29）
    for (const it of items.filter((x) => /^num-pic:\d+$/.test(x.id))) {
      const n = Number(it.id.slice('num-pic:'.length));
      if (n > 10) continue;
      const c = correctOf(it);
      expect(c.figure!.kind, it.id).toBe('illust');
      expect(picCount(c), it.id).toBe(n);
      const wrong = it.options!.filter((o) => !o.correct);
      expect(wrong, it.id).toHaveLength(2);
      const counts = wrong.map(picCount);
      expect(new Set([...counts, n]).size, it.id).toBe(3);
      for (const m of counts) {
        expect(m, it.id).toBeGreaterThanOrEqual(1);
        expect(m, it.id).toBeLessThanOrEqual(10);
      }
      for (const o of wrong) {
        // 聞きまちがえる 数（はじめの 音が にている）か、絵を かぞえまちがえる となりの 数
        if (o.misconception === 'same-start') expect(SAME_START[n], it.id).toContain(picCount(o));
        else {
          expect(o.misconception, it.id).toBe('near-count');
          expect(Math.abs(picCount(o) - n), it.id).toBe(1);
        }
      }
    }
  });
  it('num-pic:7 の まちがいは 6（same-start）と 8（near-count）。数の 札の num:7 は 11 の まま', () => {
    const pic = items.find((x) => x.id === 'num-pic:7')!;
    expect(
      pic.options!.filter((o) => !o.correct).map((o) => [picCount(o), o.misconception]),
    ).toEqual([
      [6, 'same-start'],
      [8, 'near-count'],
    ]);
    const word = items.find((x) => x.id === 'num:7')!;
    expect(word.options!.map((o) => o.label)).toContain('11');
  });
  it('誤概念 teen-near は ブロックの 絵、near-count は 絵（illust）の 問題だけ', () => {
    for (const it of items)
      for (const o of it.options ?? []) {
        if (o.misconception === 'teen-near') expect(o.figure?.kind, it.id).toBe('blocks');
        if (o.misconception === 'near-count') expect(o.figure?.kind, it.id).toBe('illust');
      }
  });
});

describe('g4.en.directions', () => {
  const items = itemsOf('g4.en.directions');
  it('isReady', () => {
    expect(isReady(checkUnit(unitOf('g4.en.directions')))).toBe(true);
  });
  it('place・place-go: 正答は 英文の 場所の 語と 一致', () => {
    const PLACE: Record<string, string> = {
      station: 'life-station',
      'fire station': 'life-firestation',
      hospital: 'life-hospital',
      library: 'life-library',
      'police box': 'life-police',
      bakery: 'life-bakery',
      'flower shop': 'life-flowershop',
    };
    const list = items.filter((x) => /^place(-go)?:/.test(x.id));
    expect(list.length).toBe(11);
    for (const it of list) {
      const w = /the ([a-z ]+)[?.]$/.exec(textsOfAudio(it)[0]!)![1]!;
      const id = PLACE[w]!;
      expect(id, it.id).toBeTruthy();
      const o = correctOf(it);
      expect(o.label, it.id).toBe(NAMES[id]);
      if (o.figure) expect(o.figure.id, it.id).toBe(id);
    }
  });
  const stepOf = (t: string): Step | null =>
    t === 'Go straight.' ? 'S' : t === 'Turn right.' ? 'R' : t === 'Turn left.' ? 'L' : null;
  it('walk: 交点の 範囲・route の 選択肢の 道じゅんは たがいに ちがう', () => {
    for (const it of items.filter((x) => x.id.startsWith('route:'))) {
      const steps = textsOfAudio(it).map((t) => stepOf(t)!);
      expect(steps.join(''), it.id).toBe(it.id.slice(6));
      const marks = it.options!.map((o) => o.figure!.markup as string);
      expect(new Set(marks).size, it.id).toBe(3);
      expect(marks[0], it.id).toBe((routeSvg(steps) as { markup: string }).markup);
      for (const [i, j] of walk(steps)) {
        expect(i >= 0 && i <= 4 && j >= 0 && j <= 3, it.id).toBe(true);
      }
    }
    for (const row of ['SR', 'SL', 'RL', 'LR', 'RS', 'LS', 'SRL', 'SLR', 'R', 'L'])
      for (const [i, j] of walk(row.split('') as Step[]))
        expect(i >= 0 && i <= 4 && j >= 0 && j <= 3, row).toBe(true);
  });
  const roadOf = (p: PlaceCode) => p[0];
  const sideOf = (p: PlaceCode) => (['SE', 'ES', 'WN'].includes(p) ? 'R' : 'L');
  it('goal・goal-turn: 位置・文字・誤概念', () => {
    const LET: Record<string, string> = {
      's-right': 'D',
      's-left': 'C',
      'sr-right': 'C',
      'sr-left': 'A',
      'sl-right': 'A',
      'sl-left': 'C',
    };
    const LET_TURN: Record<string, string> = {
      'sr-right': 'B',
      'sr-left': 'D',
      'sl-right': 'D',
      'sl-left': 'B',
    };
    for (const turned of [false, true]) {
      const list = items.filter((x) => x.id.startsWith(turned ? 'goal-turn:' : 'goal:'));
      expect(list.length).toBe(turned ? 4 : 6);
      for (const it of list) {
        const code = it.id.split(':')[1]!;
        const row = GOAL_ROWS.find((r) => r.code === code)!;
        const dirs = textsOfAudio(it).map((t) =>
          t === "It's on your right."
            ? 'on-right'
            : t === "It's on your left."
              ? 'on-left'
              : stepOf(t)!,
        );
        expect(dirs, it.id).toEqual(row.dirs);
        const pos = goalPos(dirs as GoalDir[]);
        const codes = [pos, ...row.wrong.map((w) => w[0])];
        expect(new Set(codes).size, it.id).toBe(4);
        const letters = townLetters(codes, turned);
        expect(correctOf(it).label, it.id).toBe(letters[pos]);
        expect(correctOf(it).label, it.id).toBe((turned ? LET_TURN : LET)[code]);
        expect(it.options!.map((o) => o.label)).toEqual(['A', 'B', 'C', 'D']);
        for (const [wp] of row.wrong) {
          const o = it.options!.find((x) => x.label === letters[wp])!;
          const want =
            roadOf(wp) === roadOf(pos)
              ? 'side-lr'
              : roadOf(wp) === 'S' || roadOf(pos) === 'S'
                ? 'turn-missed'
                : turned
                  ? 'screen-view'
                  : 'lr-swap';
          expect(o.misconception, `${it.id} ${wp}`).toBe(want);
          if (want === 'side-lr') expect(sideOf(wp)).not.toBe(sideOf(pos));
        }
      }
    }
    expect(GOAL_TURN_CODES.length).toBe(4);
  });
  it('svg: 赤・緑を 使わない', () => {
    const all = JSON.stringify([unitOf('g4.en.directions').intro, items]);
    expect(all).not.toContain('var(--berry)');
    expect(all).not.toContain('var(--leaf)');
  });
});
