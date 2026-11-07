/**
 * 単元の地図の並び（FX07・E-01）。
 * 列の中は「習う順」: 前提の単元が、前提を要する単元より上にある（逆転 0）。
 * 前は索引が ID のアルファベット順で、前提の組 68 組のうち 32 組が逆転し、18 本の列が逆になっていた。
 */
import { describe, expect, it } from 'vitest';
import { SUBJECTS } from './subjects';
import type { StageId, SubjectId, UnitMeta } from './types';
import { UNIT_INDEX, visibleUnits } from './unitIndex';
import { orderUnits, parseMatrixOrder } from './unitOrder';
import matrixMd from '../../docs/expansion/curriculum-matrix.md?raw';

function unit(id: string, prereq: string[] = [], domain = 'd'): UnitMeta {
  const [stage, subject] = id.split('.') as [StageId, SubjectId];
  return {
    id,
    pack: 'test',
    title: id,
    stage,
    subject,
    domain,
    icon: 'subj-kokugo',
    prereq,
    priority: 'P1',
    status: 'ready',
    engine: 'choice',
  };
}
const ids = (l: readonly UnitMeta[]) => l.map((u) => u.id);

describe('単元対応表の読み込み（parseMatrixOrder）', () => {
  it('表の行の最初の欄の単元 ID を、出てくる順に取り出す（表以外の行・重なりは除く）', () => {
    const md = [
      '# 表',
      '| 単元・目標 | 前提 |',
      '|---|---|',
      '| g1.math.numbers-10 | 10までの数 | p5.math.numbers-10 |',
      '| `g1.math.compose-10` | いくつといくつ | ← |',
      '本文の中の g1.math.add-basic は行ではない',
      '| g1.math.add-basic | たし算 | g1.math.compose-10 |',
      '| g1.math.numbers-10 | 同じ ID の行（2回目は無視） | − |',
      '| p5.math.numbers-10 | 幼児の行 | − |',
    ].join('\r\n');
    expect(parseMatrixOrder(md)).toEqual([
      'g1.math.numbers-10',
      'g1.math.compose-10',
      'g1.math.add-basic',
      'p5.math.numbers-10',
    ]);
  });

  it('実際の単元対応表から、小学生の単元が 1 件以上読める', () => {
    const order = parseMatrixOrder(matrixMd);
    expect(order.length).toBeGreaterThan(300);
    expect(order).toContain('g1.math.add-basic');
    expect(new Set(order).size).toBe(order.length);
  });
});

describe('並べ方（orderUnits）', () => {
  it('表の順に並べる。表にない単元は、表にある単元の後ろに ID の順', () => {
    const units = [unit('g1.ja.z'), unit('g1.ja.b'), unit('g1.ja.a'), unit('g1.ja.m')];
    const out = orderUnits(units, ['g1.ja.m', 'g1.ja.z']);
    expect(ids(out)).toEqual(['g1.ja.m', 'g1.ja.z', 'g1.ja.a', 'g1.ja.b']);
  });

  it('前提の単元は先。表の順がぶつかるときだけ、前提のほうを前に出す', () => {
    // 表の順: advanced → x → basic。advanced は basic を前提にする
    const units = [
      unit('g3.math.advanced', ['g3.math.basic']),
      unit('g3.math.x'),
      unit('g3.math.basic'),
    ];
    const out = orderUnits(units, ['g3.math.advanced', 'g3.math.x', 'g3.math.basic']);
    // basic が先に出るまで advanced は出せない。x は表の順のまま basic の前
    expect(ids(out)).toEqual(['g3.math.x', 'g3.math.basic', 'g3.math.advanced']);
  });

  it('前提の前提（間に別の列の単元をはさむ）も先にする', () => {
    const units = [
      unit('g4.math.c', ['g4.math.b'], 'A'),
      unit('g4.math.b', ['g4.math.a'], 'B'),
      unit('g4.math.a', [], 'A'),
    ];
    const out = orderUnits(units, ['g4.math.c', 'g4.math.b', 'g4.math.a']);
    expect(ids(out)).toEqual(['g4.math.a', 'g4.math.b', 'g4.math.c']);
  });

  it('索引にない前提は無いものとして扱う', () => {
    const units = [unit('g2.ja.b', ['g2.ja.ghost']), unit('g2.ja.a')];
    expect(ids(orderUnits(units, ['g2.ja.b', 'g2.ja.a']))).toEqual(['g2.ja.b', 'g2.ja.a']);
  });

  it('段階・教科の並びは ID の順のまま。入力の並びに依らない', () => {
    const a = [unit('g2.math.q'), unit('g1.ja.q'), unit('g1.math.q'), unit('g1.ja.p')];
    const out = orderUnits(a, []);
    expect(ids(out)).toEqual(['g1.ja.p', 'g1.ja.q', 'g1.math.q', 'g2.math.q']);
    expect(ids(orderUnits([...a].reverse(), []))).toEqual(ids(out));
  });

  it('幼児の段階（p23・p4・p5）は表の順にしない（ID の順のまま）', () => {
    const units = [unit('p4.ja.b'), unit('p4.ja.a')];
    expect(ids(orderUnits(units, ['p4.ja.b', 'p4.ja.a']))).toEqual(['p4.ja.a', 'p4.ja.b']);
  });

  it('前提が輪になっていても止まる（輪の中は表の順）', () => {
    const units = [unit('g1.ja.a', ['g1.ja.b']), unit('g1.ja.b', ['g1.ja.a']), unit('g1.ja.c')];
    expect(ids(orderUnits(units, ['g1.ja.a', 'g1.ja.b', 'g1.ja.c']))).toEqual([
      'g1.ja.c',
      'g1.ja.a',
      'g1.ja.b',
    ]);
  });
});

/** 単元の地図の列（SubjectMap.tsx と同じ作り: 領域の順＋「そのほか」。札のない列は出さない） */
function mapColumns(subject: SubjectId, grade: number, opened: readonly string[]) {
  const def = SUBJECTS.find((s) => s.id === subject)!;
  const units = visibleUnits({ subject, stage: `g${grade}` as StageId }, opened);
  const known = new Set(def.domains.map((d) => d.id));
  return [
    ...def.domains.map((d) => ({ id: d.id, units: units.filter((u) => u.domain === d.id) })),
    { id: 'other', units: units.filter((u) => !known.has(u.domain)) },
  ].filter((c) => c.units.length > 0);
}

/** 前提の前提まで（索引にある単元。段階・教科をまたいでもよい） */
function ancestorsOf(id: string): Set<string> {
  const byId = new Map(UNIT_INDEX.map((u) => [u.id, u]));
  const out = new Set<string>();
  const stack = [...(byId.get(id)?.prereq ?? [])];
  while (stack.length > 0) {
    const p = stack.pop()!;
    if (out.has(p) || !byId.has(p)) continue;
    out.add(p);
    stack.push(...byId.get(p)!.prereq);
  }
  return out;
}

describe('単元の地図の列（実際の索引）', () => {
  // 保護者が開いた単元（hiddenByDefault）も出した地図でも確かめる
  const allHidden = UNIT_INDEX.filter((u) => u.hiddenByDefault).map((u) => u.id);
  const cases = SUBJECTS.flatMap((s) =>
    s.grades.flatMap((g) => [[], allHidden].map((opened) => ({ subject: s.id, grade: g, opened }))),
  );

  it('前提の単元は、前提を要する単元より上にある（前提の組の逆転 0。前提の前提も含む）', () => {
    const inversions: string[] = [];
    let columns = 0;
    let pairs = 0;
    for (const c of cases) {
      for (const col of mapColumns(c.subject, c.grade, c.opened)) {
        columns++;
        const pos = new Map(col.units.map((u, i) => [u.id, i]));
        for (const u of col.units) {
          for (const p of ancestorsOf(u.id)) {
            if (!pos.has(p)) continue;
            pairs++;
            if (pos.get(p)! > pos.get(u.id)!)
              inversions.push(`${c.subject}/g${c.grade}/${col.id}: ${p} → ${u.id}`);
          }
        }
      }
    }
    expect(columns).toBeGreaterThan(70);
    expect(pairs).toBeGreaterThan(60);
    expect(inversions).toEqual([]);
  });

  it('列の先頭の札は、同じ列の中の単元を前提にしない', () => {
    const bad: string[] = [];
    for (const c of cases) {
      for (const col of mapColumns(c.subject, c.grade, c.opened)) {
        const first = col.units[0]!;
        const inCol = new Set(col.units.map((u) => u.id));
        for (const p of ancestorsOf(first.id))
          if (inCol.has(p)) bad.push(`${c.subject}/g${c.grade}/${col.id}: ${first.id} ← ${p}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('前提が輪になっていない', () => {
    const loops = UNIT_INDEX.filter((u) => ancestorsOf(u.id).has(u.id)).map((u) => u.id);
    expect(loops).toEqual([]);
  });

  it('索引は、段階・教科ごとにまとまり、段階・教科の並びは ID の順のまま（並べ替えるのは段階・教科の中だけ）', () => {
    const keys = UNIT_INDEX.map((u) => `${u.stage}.${u.subject}`);
    const firstSeen = [...new Set(keys)];
    // 同じ段階・教科が離れて出てこない
    expect(keys.filter((k, i) => i > 0 && k !== keys[i - 1]).length).toBe(firstSeen.length - 1);
    expect(firstSeen).toEqual([...firstSeen].sort((a, b) => a.localeCompare(b)));
  });

  it('幼児の段階の単元は ID の順のまま', () => {
    const pre = UNIT_INDEX.filter((u) => !/^g[1-6]$/.test(u.stage)).map((u) => u.id);
    expect(pre).toEqual([...pre].sort((a, b) => a.localeCompare(b)));
  });

  it('表にある単元は、同じ段階・教科の表にない単元より前にある', () => {
    const rank = new Set(parseMatrixOrder(matrixMd));
    const groups = new Map<string, UnitMeta[]>();
    for (const u of UNIT_INDEX.filter((x) => /^g[1-6]$/.test(x.stage)))
      groups.set(`${u.stage}.${u.subject}`, [...(groups.get(`${u.stage}.${u.subject}`) ?? []), u]);
    const bad: string[] = [];
    for (const [key, list] of groups) {
      const firstOut = list.findIndex((u) => !rank.has(u.id));
      if (firstOut >= 0 && list.slice(firstOut).some((u) => rank.has(u.id))) bad.push(key);
    }
    expect(bad).toEqual([]);
  });
});
