/**
 * 教材レビュー（担当 A: sequence・condition・repeat・debug・condition-combo・debug-plan）で見つけた点の再発防止。
 * - program の問題は、正答の例がエンジンの判定で正答になり、最初から並ぶ列（initial）は正答にならない
 * - 回数の まちがいを直す問題で、選べる数の回数では直せず「つくまで」でしか直せないときは、ヒントが「つくまで」に導く
 * - choice の正解は1つだけ
 * - かいだんの札の数を答える問題のヒントが、ちがう数の札の並びを言わない
 */
import { describe, expect, it } from 'vitest';
import type { Item } from '../../curriculum/types';
import {
  checkProgram,
  DEFAULT_REPEAT_TIMES,
  judgeProgram,
  worldOf,
  type Command,
  type ProgramItem,
} from '../../engines/program/program';
import { run } from '../../engines/program/world';
import { sequence } from './sequence';
import { condition } from './condition';
import { repeat } from './repeat';
import { debug } from './debug';
import { conditionCombo } from './condition-combo';
import { debugPlan } from './debug-plan';

const UNITS = [sequence, condition, repeat, debug, conditionCombo, debugPlan];
const itemsOf = (u: (typeof UNITS)[number]): Item[] =>
  u.source.kind === 'items' ? u.source.items : [];
const programs = UNITS.flatMap((u) =>
  itemsOf(u).filter((it): it is ProgramItem => it.engine === 'program'),
);

/** くりかえす の回数を 1 か所だけ t に変えた列の一覧 */
function retimed(p: readonly Command[], t: number | 'goal'): Command[][] {
  const out: Command[][] = [];
  const walk = (cmds: readonly Command[], rebuild: (next: Command[]) => Command[]) => {
    cmds.forEach((c, i) => {
      const replace = (nc: Command) => rebuild(cmds.map((x, j) => (j === i ? nc : x)));
      if (c.op === 'repeat') {
        if (c.times !== t) out.push(replace({ ...c, times: t }));
        walk(c.body, (nb) => replace({ ...c, body: nb }));
      } else if (c.op === 'if') walk(c.body, (nb) => replace({ ...c, body: nb }));
    });
  };
  walk(p, (x) => x);
  return out;
}

describe('prog-g16 レビューA: program の問題', () => {
  it('対象の program の問題がある', () => {
    expect(programs.length).toBeGreaterThan(50);
  });
  for (const p of programs) {
    it(`${p.id}: 正答の例が実行でゴールに着き、正答と判定される`, () => {
      expect(checkProgram(p)).toEqual([]);
      expect(run(worldOf(p), p.solution).outcome).toBe('goal');
      expect(judgeProgram(p, p.solution).result).toBe('correct');
      if (p.initial) expect(judgeProgram(p, p.initial).result).not.toBe('correct');
    });
  }
  it('回数を「つくまで」にしないと直らない問題は、ヒントが「つくまで」に導く', () => {
    const bad: string[] = [];
    for (const p of programs) {
      if (!p.initial || !p.palette.includes('repeat')) continue;
      const w = worldOf(p);
      const nums = (p.repeatTimes ?? DEFAULT_REPEAT_TIMES).filter(
        (t): t is number => typeof t === 'number',
      );
      const byNumber = nums.some((t) =>
        retimed(p.initial!, t).some((q) => run(w, q).outcome === 'goal'),
      );
      const byGoal =
        (p.repeatTimes ?? []).includes('goal') &&
        retimed(p.initial, 'goal').some((q) => run(w, q).outcome === 'goal');
      if (!byNumber && byGoal && !p.hints.some((h) => String(h).includes('つくまで')))
        bad.push(p.id);
    }
    expect(bad).toEqual([]);
  });
});

describe('prog-g16 レビューA: 選ぶ・数える問題', () => {
  const all = UNITS.flatMap(itemsOf);
  it('choice の正解は 1 つ', () => {
    for (const it of all)
      if (it.engine === 'choice') expect(it.options.filter((o) => o.correct).length, it.id).toBe(1);
  });
  it('かいだんの札の数の問題: ヒントが「すすむ・まがる…」の決まった並び（ちがう数）を言わない', () => {
    for (const it of all)
      if (it.id.startsWith('pattern-alt-'))
        for (const h of it.hints) expect(String(h), it.id).not.toMatch(/すすむ・まがる・すすむ/);
  });
});
