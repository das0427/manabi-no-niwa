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

  it('listen の誤りの選択肢には すべて誤概念IDが付く', () => {
    for (const unit of pack.units)
      for (const it of sampleItems(unit, 1))
        if (it.engine === 'listen' || it.engine === 'choice')
          for (const o of it.options) if (!o.correct) expect(o.misconception, it.id).toBeTruthy();
  });
});
