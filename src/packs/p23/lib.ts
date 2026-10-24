/**
 * p23 の単元で使う小さな部品（パックの中だけで使う）。
 * - 選択肢は画面で並べ替えないため、ここで問題 id から決まる順に混ぜる（正解の位置の癖を作らない）。
 * - 選択肢の数は段階の上限（L2 は2つ、L3 は3つまで）に収める（画面は先頭から上限までを出すため）。
 */
import { createRng, hashSeed } from '../../core/util/rng';
import type { ChoiceItem, ChoiceOption } from '../../curriculum/types';
import type { Figure } from '../../engines/figure/types';
import type { ListenItem, ListenSound } from '../../engines/listen/listen';

export const ill = (id: string, count?: number): Figure =>
  count === undefined ? { kind: 'illust', id } : { kind: 'illust', id, count };

/** id から決まる順に混ぜる */
export function mix<T>(key: string, xs: readonly T[]): T[] {
  return createRng(hashSeed('p23', key)).shuffle(xs);
}

/** 正解を1つ含む選択肢（先頭が正解）を混ぜる */
export function opts(key: string, correct: ChoiceOption, wrong: ChoiceOption[]): ChoiceOption[] {
  return mix(key, [{ ...correct, correct: true }, ...wrong]);
}

interface Base {
  id: string;
  objective: string;
  level: number;
  prompt: string;
  hints: [string, string];
  explain: string;
  identity: string;
  alt?: boolean;
  figure?: Figure;
  explainFigure?: Figure;
}

export function choiceItem(
  b: Base & { correct: ChoiceOption; wrong: ChoiceOption[]; layout?: ChoiceItem['layout'] },
): ChoiceItem {
  const { correct, wrong, ...rest } = b;
  return { engine: 'choice', ...rest, options: opts(b.id, correct, wrong) };
}

export function listenItem(
  b: Base & {
    audio: ListenSound | ListenSound[];
    correct: ChoiceOption;
    wrong: ChoiceOption[];
    gapMs?: number;
  },
): ListenItem {
  const { correct, wrong, ...rest } = b;
  return { engine: 'listen', ...rest, options: opts(b.id, correct, wrong) };
}

/** 決まった順に、自分以外から n 個 */
export function others<T>(
  key: string,
  all: readonly T[],
  self: T,
  n: number,
  ok?: (x: T) => boolean,
): T[] {
  return mix(
    key,
    all.filter((x) => x !== self && (!ok || ok(x))),
  ).slice(0, n);
}
