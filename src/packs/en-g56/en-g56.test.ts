// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems, textsOf } from '../../curriculum/qa';
import type { UnitSpec } from '../../curriculum/types';
import { normalizeStrokes } from '../../engines/trace/strokes';
import { judge as traceJudge, polylineLength } from '../../modes/trace/judge';
import { enG56Illust } from '../../illust/content/en-g56';
import { lifeG12Illust } from '../../illust/content/life-g12';
import { getIllust } from '../../illust/registry';
import { kanjiGrade } from '../../text/kanji-grades';
import { parseRich, type Token } from '../../text/rich';
import pack from './index';
import { englishScript } from './voice';

/**
 * 絵が あるか（registry の content の自動読み込みは テストの変換キャッシュで 新しい ファイルが 入らない ことが
 * あるので、ほかの パックの 絵（life-g12 の しせつ）は モジュールから 直接 たしかめる）
 */
const known = (id: string) => !!getIllust(id) || id in lifeG12Illust || id in enG56Illust;

/** ux-by-age: 小5・小6 の選択肢は 4 まで */
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
        if (!s.key || !s.key.startsWith('en/en-g56.')) errs.push(`[${it.id}] 英語の音声キーが無い`);
    }
    // 書く問題は タイル（build・fill）か なぞり・お手本比較（trace）だけ。自由記述の採点はしない（2.3）
    if (it.engine === 'explain') errs.push(`[${it.id}] 自由記述の問題`);
  }
  return [...new Set(errs)];
}

describe('en-g56 の教材検査（curriculum-matrix 1.8）', () => {
  it('パックの形', () => {
    expect(pack.packId).toBe('en-g56');
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
    console.info(`en-g56 英語の台本: ${entries.length} 本`);
  });

  it('英字の書き順データ: お手本どおりに なぞると 完成・逆向きでは 完成しない', () => {
    const unit = pack.units.find((u) => u.id === 'g5.en.letters-write')!;
    let n = 0;
    for (const it of sampleItems(unit, 1)) {
      if (it.engine !== 'trace' || !it.strokes) continue;
      n++;
      const guide = normalizeStrokes(it.strokes);
      const r = it.tolerance ?? 80;
      expect(traceJudge(guide, guide, r).complete, it.id).toBe(true);
      const reversed = guide.map((s) => [...s].reverse());
      if (guide.some((s) => polylineLength(s) > 200))
        expect(traceJudge(reversed, guide, r).complete, `${it.id} 逆向き`).toBe(false);
    }
    expect(n).toBe(26 + 26 + 3);
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

  it('listen の誤りの選択肢には すべて誤概念IDが付く', () => {
    for (const unit of pack.units)
      for (const it of sampleItems(unit, 1))
        if (it.engine === 'listen' || it.engine === 'choice')
          for (const o of it.options) if (!o.correct) expect(o.misconception, it.id).toBeTruthy();
  });

  // ---- 内容レビューの 再発防止 ----
  const itemsOf = (id: string) =>
    sampleItems(
      pack.units.find((u) => u.id === id)!,
      1,
    );
  const soundsOf = (it: { audio: { text: string } | { text: string }[] }) =>
    (Array.isArray(it.audio) ? it.audio : [it.audio]).map((s) => s.text);

  it('いま・すぎた の聞き分け: -ed の つぎの 語は 母音で はじまる（watched TV のように -ed が 聞こえない 組を さける）', () => {
    for (const it of itemsOf('g6.en.past')) {
      if (it.engine !== 'listen' || !it.id.startsWith('tense')) continue;
      for (const s of soundsOf(it)) {
        const w = s.replace(/[.?!]/g, '').split(' ');
        if (w[1]?.endsWith('ed')) expect(w[2]?.[0] ?? 'a', `${it.id}: ${s}`).toMatch(/[aeiou]/i);
      }
    }
  });

  it('月の聞きとり: ヒント③の「〜がつから 〜がつ」で 選択肢が 正答 1つに しぼれない', () => {
    for (const it of itemsOf('g5.en.listen-self')) {
      if (it.engine !== 'listen') continue;
      const m = /(\d+)がつから (\d+)がつ/.exec(String(it.hints[2]));
      if (!m) continue;
      const [lo, hi] = [Number(m[1]), Number(m[2])];
      const inRange = it.options.filter((o) => {
        const n = Number(/^(\d+)がつ$/.exec(o.label ?? '')?.[1]);
        return n >= lo && n <= hi;
      });
      expect(inRange.length, it.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('2人の しょうかい: ヒント③で 何人めかを 言わない（答えの 人が 決まる）', () => {
    for (const it of itemsOf('g5.en.listen-self'))
      if (it.id.startsWith('intro:'))
        expect(String(it.hints[2]), it.id).not.toMatch(/[12]人《(ひとり|ふたり)》め/);
  });

  it('誤概念IDの 付け違い: 話の「いつ」に tense-mix、wh 語が 先頭に ある 誤答に wh-place を 付けない', () => {
    for (const it of itemsOf('g6.en.past'))
      if (it.engine === 'listen' && it.id.startsWith('story:'))
        for (const o of it.options) expect(o.misconception, it.id).not.toBe('tense-mix');
    for (const it of itemsOf('g5.en.word-order'))
      if (it.engine === 'build')
        for (const w of it.wrongAnswers ?? [])
          if (w.misconception === 'wh-place')
            expect(w.value, it.id).not.toMatch(/^(What|When|Where|Who|How)\b/);
    const mean = itemsOf('g6.en.places').find((x) => x.id === 'mean:3')!;
    if (mean.engine === 'choice')
      expect(mean.options.find((o) => o.label === 'りんごが すきな まち')?.misconception).toBe(
        'adj-mix',
      );
  });

  it('しょうかいの 性役割: 女子名だけが りょうり・ピアノ・おどり、男子名だけが はやく はしる・でんしゃ に ならない', () => {
    const girls = ['Emi', 'Lily', 'Mai', 'Nina', 'Yuki'];
    const said = new Map<string, Set<string>>();
    for (const it of itemsOf('g5.en.listen-self')) {
      if (it.engine !== 'listen' || !it.id.startsWith('intro:')) continue;
      for (const s of soundsOf(it)) {
        const m = /^I'm (\w+)\. I (?:can|like) (.+)\.$/.exec(s);
        if (!m) continue;
        const k = m[2]!;
        if (!said.has(k)) said.set(k, new Set());
        said.get(k)!.add(girls.includes(m[1]!) ? 'g' : 'b');
      }
    }
    expect([...(said.get('cook') ?? [])]).toEqual(['b']);
    expect([...(said.get('dance') ?? [])]).toEqual(['b']);
    expect([...(said.get('play the piano') ?? [])]).toEqual(['b']);
    expect([...(said.get('run fast') ?? [])]).toEqual(['g']);
    expect([...(said.get('trains') ?? [])]).toEqual(['g']);
  });

  // ---- P2: g5.en.where / g6.en.future ----
  const illustIdOf = (o: { figure?: { kind: string; id?: string } }) =>
    o.figure?.kind === 'illust' ? o.figure.id : undefined;

  it('g5.en.where: 正答の絵が 音声の文と 一致・絵は すべて 異なる・ふつうでない 組を 問わない', () => {
    let n = 0;
    for (const it of itemsOf('g5.en.where')) {
      if (it.engine !== 'listen') continue;
      const ids = it.options.map(illustIdOf).filter((x): x is string => !!x);
      expect(new Set(ids).size, it.id).toBe(ids.length);
      const ss = soundsOf(it);
      const last = ss[ss.length - 1]!;
      // 不自然な文を問わない
      expect(ss.join(' '), it.id).not.toMatch(/(ball|cap|book) is in the bed|cat is in the desk/);
      let want: string | undefined;
      const m1 = /The (ball|cat|cap|book) is (in|on|under) the (desk|bed)\.$/.exec(last);
      const m2 = /It's (in|on|under) the (desk|bed)\.$/.exec(last);
      if (m1) want = `en56-${m1[1]}-${m1[2]}-${m1[3]}`;
      else if (m2) {
        const o = /Where is (?:my|the) (ball|cat|cap|book)\?/.exec(ss[0]!)?.[1];
        want = `en56-${o}-${m2[1]}-${m2[2]}`;
        // 「ある」ばしょが 不自然な 組に ならない
        expect(
          (o !== 'cat' && m2[1] === 'in' && m2[2] === 'bed') ||
            (o === 'cat' && m2[1] === 'in' && m2[2] === 'desk'),
          it.id,
        ).toBe(false);
      }
      const ok = it.options.find((o) => o.correct);
      if (illustIdOf(ok!)) {
        n++;
        expect(want, it.id).toBeTruthy();
        expect(illustIdOf(ok!), it.id).toBe(want);
        // 選択肢は 正答と ちょうど1点だけ 違う
        for (const o of it.options) {
          if (o === ok) continue;
          const a = illustIdOf(o)!.split('-');
          const b = illustIdOf(ok!)!.split('-');
          expect(a.filter((x, i) => x !== b[i]).length, `${it.id} ${illustIdOf(o)}`).toBe(1);
        }
      }
    }
    expect(n).toBe(12 + 8 + 8 + 4);
  });

  it('台本の種類: where は where、future は future か dream', () => {
    for (const [uid, re] of [
      ['g5.en.where', /^en\/en-g56\.where\./],
      ['g6.en.future', /^en\/en-g56\.(future|dream)\./],
    ] as const)
      for (const it of itemsOf(uid)) {
        if (it.engine !== 'listen') continue;
        const sounds = Array.isArray(it.audio) ? it.audio : [it.audio];
        for (const s of sounds) expect(s.key, it.id).toMatch(re);
        if (uid === 'g6.en.future' && (it.id.startsWith('dream:') || it.id.startsWith('gist:')))
          for (const s of sounds) expect(s.key, it.id).toMatch(/^en\/en-g56\.dream\./);
      }
  });

  it('g6.en.future: 発表のヒントの「Nつめ」は 1〜3 で、発表は 3文', () => {
    let n = 0;
    for (const it of itemsOf('g6.en.future')) {
      if (it.engine !== 'listen' || !it.id.startsWith('dream:')) continue;
      n++;
      const sounds = Array.isArray(it.audio) ? it.audio : [it.audio];
      expect(sounds.length, it.id).toBe(3);
      const at = Number(/(\d)つめの/.exec(String(it.hints[1]))?.[1]);
      expect(at, it.id).toBeGreaterThanOrEqual(1);
      expect(at, it.id).toBeLessThanOrEqual(3);
      expect(String(it.hints[2]), it.id).toContain(`${at}つめの`);
    }
    expect(n).toBe(8);
  });
});
