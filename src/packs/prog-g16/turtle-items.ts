/**
 * 「命令でかいた図形」の問題を作る部品（g4 draw-shapes・g5 polygon で使う）。このパックの中だけ。
 * 答えと図は命令から計算する（手で答えを書かない）。
 */
import type { ChoiceItem, ChoiceOption, MatchItem, NumberItem } from '../../curriculum/types';
import { choiceItem } from './kit';
import { stepsText, trace, turtleFigure, type TStep } from './turtle';

/** 2つの命令が同じ線をかくか */
export const same = (a: readonly TStep[], b: readonly TStep[]) => {
  const p = trace(a).pts;
  const q = trace(b).pts;
  return (
    p.length === q.length &&
    p.every((v, i) => Math.abs(v[0] - q[i]![0]) + Math.abs(v[1] - q[i]![1]) < 1e-6)
  );
};

export interface NumSpec {
  id: string;
  obj: string;
  level: number;
  prompt: string;
  figure?: ReturnType<typeof turtleFigure>;
  answer: number;
  label?: string;
  wrongs: [number, string][];
  hints: [string, string, string];
  explain: string;
  alt?: boolean;
}
export function num(s: NumSpec): NumberItem {
  return {
    engine: 'number',
    id: s.id,
    objective: s.obj,
    level: s.level,
    prompt: s.prompt,
    ...(s.figure ? { figure: s.figure } : {}),
    fields: [{ ...(s.label ? { label: s.label } : {}), answer: { kind: 'int', value: s.answer } }],
    wrongAnswers: s.wrongs
      .filter(([v]) => v !== s.answer)
      .map(([v, m]) => ({ value: String(v), misconception: m })),
    hints: s.hints,
    explain: s.explain,
    identity: s.id,
    ...(s.alt ? { alt: true } : {}),
  };
}

/** 命令の列を選ぶ（図に合うもの）。正解は図をかく列、誤りは図と合わない列 */
export function cmdChoice(opt: {
  id: string;
  obj: string;
  level: number;
  target: TStep[];
  right: TStep[];
  wrongs: [TStep[], string][];
  prompt?: string;
  hints: [string, string, string];
  explain: string;
  grid?: boolean;
  texts?: (ss: TStep[]) => string;
  alt?: boolean;
}): ChoiceItem {
  const t = opt.texts ?? ((ss: TStep[]) => stepsText(ss));
  if (!same(opt.target, opt.right)) throw new Error(`${opt.id}: 正解の命令が図《ず》とちがう`);
  for (const [w] of opt.wrongs)
    if (same(opt.target, w)) throw new Error(`${opt.id}: 誤りの命令が図《ず》と同じ`);
  return choiceItem({
    id: opt.id,
    obj: opt.obj,
    level: opt.level,
    prompt:
      opt.prompt ??
      'この 図形《ずけい》を かく 命令《めいれい》は どれ？',
    figure: turtleFigure(opt.target, 'みどりの てんから 線《せん》を かいた 図形《ずけい》', {
      grid: opt.grid ?? true,
      hU: 4.8,
    }),
    right: t(opt.right),
    // 作業領域に入る数: 命令の文は ながいので 2つ（よこに ならべる）
    wrongs: opt.wrongs.slice(0, 1).map(([w, m]) => [t(w), m] as [string, string]),
    layout: 'row',
    hints: opt.hints,
    explain: opt.explain,
    alt: opt.alt,
  });
}

/** 命令に合う図を選ぶ（図の選択肢は ア・イ・ウ） */
export function figChoice(opt: {
  id: string;
  obj: string;
  level: number;
  prompt: string;
  right: TStep[];
  wrongs: [TStep[], string][];
  hints: [string, string, string];
  explain: string;
  rot: number;
  grid?: boolean;
  alt?: boolean;
}): ChoiceItem {
  const names = ['ア', 'イ', 'ウ'];
  const all = [...opt.wrongs.map(([w, m]) => ({ s: w, m })), { s: opt.right, m: '' }];
  for (const a of all.slice(0, -1))
    if (same(a.s, opt.right)) throw new Error(`${opt.id}: 誤りの図《ず》が正解と同じ`);
  const placed: ({ s: TStep[]; m: string } | undefined)[] = [undefined, undefined, undefined];
  placed[opt.rot % 3] = all[all.length - 1];
  let k = 0;
  for (let i = 0; i < 3; i++) if (!placed[i]) placed[i] = all[k++];
  const options: ChoiceOption[] = placed.map((p, i) => ({
    label: names[i]!,
    figure: turtleFigure(p!.s, `${names[i]}の 図形《ずけい》`, { grid: false, box: 110, hU: 6.5 }),
    ...(i === opt.rot % 3 ? { correct: true } : { misconception: p!.m }),
  }));
  return {
    engine: 'choice',
    id: opt.id,
    objective: opt.obj,
    level: opt.level,
    prompt: opt.prompt,
    options,
    layout: 'row',
    hints: opt.hints,
    explain: opt.explain,
    identity: opt.id,
    ...(opt.alt ? { alt: true } : {}),
  };
}

/** 図形と命令を線でむすぶ */
export function matchItem(opt: {
  id: string;
  obj: string;
  level: number;
  pairs: { steps: TStep[]; text: string }[];
  extra?: string[];
  hints: [string, string, string];
  explain: string;
  grid?: boolean;
  wrongMis?: string;
}): MatchItem {
  // 下の段は よこ一列で 折り返すので、ラベルを みじかくし（「…」を n かい くりかえす → n かい：…）、
  // 組が 3つ なら 組にならない カードは 出さない（高さが たりなくなるため）
  const compact = (s: string) => s.replace(/^「(.*)」を (\d+)かい くりかえす$/, '$2かい：$1');
  const right = [
    ...opt.pairs.map((p) => ({ label: compact(p.text) })),
    ...(opt.pairs.length >= 3 ? [] : (opt.extra ?? []).slice(0, 1).map((label) => ({ label: compact(label) }))),
  ];
  const mis = opt.wrongMis ?? 'side-wrong';
  return {
    engine: 'match',
    id: opt.id,
    objective: opt.obj,
    level: opt.level,
    alt: true,
    prompt: '図形《ずけい》と 命令《めいれい》を 線《せん》で むすぼう。',
    left: opt.pairs.map((p, i) => ({
      figure: turtleFigure(p.steps, `図形《ずけい》 ${i + 1}`, { grid: false, box: 100, hU: 4.6 }),
      name: `図形《ずけい》 ${i + 1}`,
    })),
    right,
    pairs: opt.pairs.map((_, i) => [i, i] as [number, number]),
    wrongPairs:
      opt.pairs.length >= 2
        ? [
            { pair: [0, 1], misconception: mis },
            { pair: [1, 0], misconception: mis },
          ]
        : [],
    hints: opt.hints,
    explain: opt.explain,
    identity: opt.id,
  };
}


