import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, textsOf } from '../../curriculum/qa';
import type { ChoiceItem, ExperimentItem, Item, UnitSpec } from '../../curriculum/types';
import { resultOf } from '../../engines/experiment/model';
import pack from './index';

/** 小5 P2 の3単元（electromagnet・birth・flowing-water）だけの追加の検査 */
const IDS = ['g5.sci.electromagnet', 'g5.sci.birth', 'g5.sci.flowing-water'] as const;

const unitOf = (id: string): UnitSpec => {
  const u = pack.units.find((x) => x.id === id);
  if (!u) throw new Error(`単元が無い: ${id}`);
  return u;
};
const itemsOf = (u: UnitSpec): Item[] => {
  if (u.source.kind !== 'items') throw new Error('手作りの単元のはず');
  return u.source.items;
};
const find = (u: UnitSpec, id: string): Item => {
  const it = itemsOf(u).find((x) => x.id === id);
  if (!it) throw new Error(`問題が無い: ${id}`);
  return it;
};
const choiceOf = (u: UnitSpec, id: string): ChoiceItem => {
  const it = find(u, id);
  if (it.engine !== 'choice') throw new Error(`${id} は choice ではない`);
  return it;
};
const expOf = (u: UnitSpec, id: string): ExperimentItem => {
  const it = find(u, id);
  if (it.engine !== 'experiment') throw new Error(`${id} は experiment ではない`);
  return it;
};
/** 誤りの選択肢のうち、文に needle を含むものの誤概念 */
const misOf = (it: ChoiceItem, needle: string): string | undefined => {
  const o = it.options.find((x) => JSON.stringify(x.label).includes(needle));
  return o?.misconception;
};

describe('小5 P2 の3単元（sci-g56）', () => {
  it('パックに入っていて、P2・ready・検査に通る', () => {
    for (const id of IDS) {
      const u = unitOf(id);
      expect(u.priority).toBe('P2');
      expect(u.status).toBe('ready');
      const r = checkUnit(u);
      expect(r.errors).toEqual([]);
      expect(isReady(r)).toBe(true);
    }
  });

  it('到達項目ごとに 練習7・別例3（合計30問）', () => {
    for (const id of IDS) {
      const u = unitOf(id);
      const items = itemsOf(u);
      expect(items).toHaveLength(30);
      for (const ob of u.objectives) {
        const mine = items.filter((it) => it.objective === ob.id);
        expect(mine.filter((it) => !it.alt)).toHaveLength(7);
        expect(mine.filter((it) => it.alt)).toHaveLength(3);
      }
    }
  });

  it('誤概念の割り当て（見直しで直しやすい所の再発防止）', () => {
    const em = unitOf('g5.sci.electromagnet');
    expect(misOf(choiceOf(em, 'pl-compass'), 'N極')).toBe('em-pole-attract');
    expect(misOf(choiceOf(em, 'st-parallel'), '2倍')).toBe('em-parallel-strong');
    expect(misOf(choiceOf(em, 'st-alt-pair'), 'イと ウ')).toBe('em-changed-many');
    const bi = unitOf('g5.sci.birth');
    expect(misOf(choiceOf(bi, 'hu-where'), 'いぶくろ')).toBe('bi-human-parts');
    expect(misOf(choiceOf(bi, 'eg-size'), '0.1mm')).toBe('bi-size-days');
    const fw = unitOf('g5.sci.flowing-water');
    expect(misOf(choiceOf(fw, 'rv-bend-in'), '外側')).toBe('fw-bend-reverse');
    const safe = choiceOf(fw, 'fl-safe').options.find((o) => o.correct);
    expect(JSON.stringify(safe?.label)).toContain('近《ちか》づかない');
  });

  it('電磁石の実験の表が意図どおり', () => {
    const u = unitOf('g5.sci.electromagnet');
    const s = expOf(u, 'st-reach').setup;
    const key = (c: Record<string, string>) => resultOf(s, c)?.key;
    const n = (c: Record<string, string>) => Number(String(key(c)).slice(1));
    expect(key({ cells: '2', turns: '100', core: 'yes' })).toBe('k18');
    for (const cells of ['1', '2'])
      for (const turns of ['50', '100']) {
        expect(n({ cells, turns, core: 'no' })).toBeLessThan(n({ cells, turns, core: 'yes' }));
      }
    for (const cells of ['1', '2'])
      for (const core of ['yes', 'no']) {
        expect(n({ cells, turns: '100', core })).toBeGreaterThan(n({ cells, turns: '50', core }));
      }
    const p = expOf(u, 'pl-reach').setup;
    for (const dir of ['first', 'reverse'])
      expect(resultOf(p, { dir, cells: '1' })?.key).toBe(resultOf(p, { dir, cells: '2' })?.key);
    for (const cells of ['1', '2'])
      expect(resultOf(p, { dir: 'first', cells })?.key).not.toBe(
        resultOf(p, { dir: 'reverse', cells })?.key,
      );
  });

  it('流れる水の実験の表が意図どおり', () => {
    const u = unitOf('g5.sci.flowing-water');
    const it = expOf(u, 'fl-reach');
    expect(it.task.kind).toBe('reach');
    const target = it.task.kind === 'reach' ? it.task.target : '';
    expect(resultOf(it.setup, { water: 'large', place: 'outside' })?.key).toBe(target);
    expect(resultOf(it.setup, it.initial ?? {})?.key).toBe('small-inside');
    expect(resultOf(it.setup, it.initial ?? {})?.key).not.toBe(target);
  });

  it('reach の実験: 正解でない条件の組には すべて誤概念が付く', () => {
    for (const id of IDS) {
      for (const it of itemsOf(unitOf(id))) {
        if (it.engine !== 'experiment' || it.task.kind !== 'reach') continue;
        const { setup, task } = it;
        if (setup.kind !== 'table') throw new Error(`${it.id} は table のはず`);
        let combos: Record<string, string>[] = [{}];
        for (const f of setup.factors)
          combos = combos.flatMap((c) => f.values.map((v) => ({ ...c, [f.id]: String(v.id) })));
        for (const c of combos) {
          if (resultOf(setup, c)?.key === task.target) continue;
          const hit = (it.wrongConditions ?? []).find((w) =>
            Object.entries(w.when).every(([k, v]) => c[k] === String(v)),
          );
          expect(hit, `${it.id} ${JSON.stringify(c)}`).toBeDefined();
        }
      }
    }
  });

  it('電磁石: 銅は ふりがな付きの漢字で書く（「どうの」と読みちがえない）', () => {
    const u = unitOf('g5.sci.electromagnet');
    const texts = itemsOf(u).flatMap((it) => textsOf(it));
    expect(texts.some((t) => t.includes('銅《どう》'))).toBe(true);
    for (const t of texts) expect(t).not.toMatch(/(^|[ 、。・'])どう(の|も|で) /);
  });

  it('動物の誕生に 人の受精に至る過程の語が無い', () => {
    const u = unitOf('g5.sci.birth');
    const all = [
      u.title,
      ...u.intro.map((s) => s.text),
      ...u.misconceptions.map((m) => m.explain),
      ...itemsOf(u).flatMap((it) => textsOf(it)),
    ];
    for (const t of all) expect(t).not.toMatch(/交尾|性交/);
  });

  it('svg の図: メダカのめす・おすが ちがい、川の印に 丸と三角がある', () => {
    const bi = unitOf('g5.sci.birth');
    const male = choiceOf(bi, 'mf-fig-male').figure;
    const female = choiceOf(bi, 'mf-fig-female').figure;
    expect(male?.kind).toBe('svg');
    expect(female?.kind).toBe('svg');
    if (male?.kind === 'svg' && female?.kind === 'svg') {
      expect(male.markup).not.toBe(female.markup);
      const paths = (m: string) => m.match(/<path d="[^"]+"/g) ?? [];
      expect(paths(male.markup)).not.toEqual(paths(female.markup));
    }
    const fw = unitOf('g5.sci.flowing-water');
    const marks = choiceOf(fw, 'rv-alt-marks').figure;
    expect(marks?.kind).toBe('svg');
    if (marks?.kind === 'svg') {
      expect(marks.markup).toContain('<circle');
      expect(marks.markup).toMatch(/<path d="M\d+ \d+ L\d+ \d+ L\d+ \d+ Z"/);
    }
  });
});
