/** order・sort・match・fill・build のテスト用の道具（画面の ctx と、見本の問題の共通項目の検査） */
import { audienceUx } from '../../audience/audience';
import type { ItemBase } from '../../curriculum/types';
import type { RenderCtx } from '../types';
import { kanjiErrors } from './shared';

export function ctxFor(kind: 'g1' | 'toddler2' | 'toddler3' | 'p4'): RenderCtx {
  const ux =
    kind === 'toddler2'
      ? audienceUx('toddler', 2)
      : kind === 'toddler3'
        ? audienceUx('toddler', 3)
        : audienceUx(kind);
  return {
    packId: 'test',
    readAloud: 'off',
    furigana: 'unlearned',
    learnerGrade: kind === 'g1' ? 1 : 0,
    preschool: kind !== 'g1',
    textScale: 1,
    ux,
  };
}

/** 見本の問題の共通項目（qa.ts の checkUnit の問題ごとの検査のうち、単元に依らないもの） */
export function baseItemErrors(it: ItemBase, preschool: boolean): string[] {
  const errs: string[] = [];
  const need = preschool ? 2 : 3;
  if (it.hints.length !== need) errs.push(`ヒントは${need}段階（今 ${it.hints.length}）`);
  if (!it.explain.trim()) errs.push('解説が無い');
  errs.push(...kanjiErrors([it.prompt, it.explain, ...it.hints]));
  return errs;
}
