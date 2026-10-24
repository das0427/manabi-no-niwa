/**
 * g6-ja の単元で共有する小さな部品（パックの中だけで使う。他のパックは import しない）。
 */
import type { ChoiceOption, UnitSpec } from '../../curriculum/types';

export const REVISED = '2026-10-24';

/** 誤りの選択肢: [文, 誤概念ID] */
export type Wrong = readonly [label: string, misconception?: string];

/** 正解1つと誤りから選択肢を作る（正解を先頭に書く。画面では並べ替える）。小6は4つまで */
export function opts(correct: string, wrongs: readonly Wrong[]): ChoiceOption[] {
  return [
    { label: correct, correct: true },
    ...wrongs.map(([label, m]) => (m ? { label, misconception: m } : { label })),
  ];
}

/** 作成中の単元（子供画面に出さない。テストは planned を検査しない） */
export function stubUnit(id: string, title: string, icon = 'subj-kokugo'): UnitSpec {
  return {
    id,
    title,
    stage: 'g6',
    subject: 'ja',
    domain: 'kotoba',
    kind: 'knowledge',
    priority: 'P1',
    status: 'planned',
    icon,
    prereq: [],
    objectives: [{ id: 'o', title }],
    misconceptions: [],
    levels: [{ label: 'きほん', chance: 0.05 }],
    intro: [],
    source: { kind: 'items', items: [] },
    review: 'objective',
    basis: '',
    revised: REVISED,
  };
}
