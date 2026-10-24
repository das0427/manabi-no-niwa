/**
 * choice エンジン: 選択肢から選ぶ（1つ、またはすべて選ぶ）。
 * 1つ選ぶ問題はタップでそのまま答える（v1 と同じ）。すべて選ぶ問題は「こたえあわせ」で答える。
 */
import { useState } from 'react';
import { createRng, hashSeed } from '../../core/util/rng';
import type { ChoiceItem } from '../../curriculum/types';
import { Rt } from '../../text/Rt';
import { plainText } from '../../text/rich';
import { Choice } from '../../ui/Choice';
import type { TapState } from '../../ui/Tap';
import { Figure } from '../figure/Figure';
import type { EngineDef, EngineProps, Judgement } from '../types';
import './choice.css';

/** 答え: 選んだ選択肢の番号（multi は複数） */
export type ChoiceResponse = number[];

/**
 * 区分の上限（ux.maxChoices）で選択肢を減らすときに出す選択肢の番号（元の番号・元の順）。
 * 正解は必ず残し、誤りの選択肢を前から上限まで残す（位置で切ると正解が消えることがある: コードレビュー #3）。
 */
export function visibleOptionIndices(
  options: readonly { correct?: boolean }[],
  max: number,
): number[] {
  const limit = Math.max(2, max);
  if (options.length <= limit) return options.map((_, i) => i);
  const correct = options.flatMap((o, i) => (o.correct ? [i] : []));
  const wrong = options.flatMap((o, i) => (o.correct ? [] : [i]));
  const keep = new Set([...correct, ...wrong.slice(0, Math.max(0, limit - correct.length))]);
  return options.flatMap((_, i) => (keep.has(i) ? [i] : []));
}

/**
 * 選択肢を並べる順（元の番号）。fixedOrder でなければ問題の id で決まる順に並べ替える。
 * 教材の書き方で正解が先頭に偏っても、位置で当てられないようにする（漢字担当の要望）。
 * 同じ問題は何度描いても・再開しても同じ順。
 */
export function displayOrder(
  item: Pick<ChoiceItem, 'id' | 'fixedOrder' | 'options'>,
  shown: number[],
): number[] {
  if (item.fixedOrder || shown.length < 2) return shown;
  // 絵だけの選択肢は「1ばん」…と番号で呼ぶ（解説・ヒントが番号で指す）ので並べ替えない
  if (item.options.some((o) => o.label === undefined)) return shown;
  // 図の「あ」「い」…を指す選択肢は記号の順のまま
  if (item.options.every((o) => typeof o.label === 'string' && /^[あいうえおかき]$/.test(o.label)))
    return shown;
  const rng = createRng(hashSeed('choice-order', item.id));
  const out = [...shown];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function judgeChoice(item: ChoiceItem, picked: ChoiceResponse): Judgement {
  const correct = item.options.flatMap((o, i) => (o.correct ? [i] : []));
  if (item.multi) {
    const a = [...new Set(picked)].sort((x, y) => x - y);
    if (a.length === correct.length && a.every((v, i) => v === correct[i]))
      return { result: 'correct' };
    // 最初に見つかった誤りの選択肢の誤概念
    const wrongPick = a.find((i) => !item.options[i]?.correct);
    return {
      result: 'wrong',
      misconception: wrongPick !== undefined ? item.options[wrongPick]?.misconception : undefined,
      mark: wrongPick !== undefined ? [wrongPick] : [],
    };
  }
  const i = picked[0];
  if (i === undefined || !item.options[i]) return { result: 'wrong', mark: [] };
  if (item.options[i]!.correct) return { result: 'correct' };
  return { result: 'wrong', misconception: item.options[i]!.misconception, mark: [i] };
}

export function checkChoice(item: ChoiceItem): string[] {
  const errs: string[] = [];
  const nCorrect = item.options.filter((o) => o.correct).length;
  if (item.options.length < 2) errs.push('選択肢が2つ未満');
  if (nCorrect === 0) errs.push('正解の選択肢が無い');
  if (!item.multi && nCorrect !== 1) errs.push('1つ選ぶ問題なのに正解が1つではない');
  const labels = item.options.map((o) =>
    o.label !== undefined ? plainText(o.label) : JSON.stringify(o.figure),
  );
  if (new Set(labels).size !== labels.length) errs.push('同じ選択肢が重複している');
  for (const o of item.options) {
    if (o.label === undefined && o.figure === undefined) errs.push('選択肢に文も図も無い');
    if (o.correct && o.misconception) errs.push('正解の選択肢に誤概念IDが付いている');
  }
  return errs;
}

function ChoiceView({
  item,
  ctx,
  revealed,
  wrongMark,
  disabled,
  submit,
}: EngineProps<ChoiceItem, ChoiceResponse>) {
  const [picked, setPicked] = useState<number[]>([]);
  const wrong = new Set(Array.isArray(wrongMark) ? (wrongMark as number[]) : []);
  const shown = displayOrder(
    item,
    visibleOptionIndices(item.options, item.multi ? item.options.length : ctx.ux.maxChoices),
  );
  const stateOf = (i: number): TapState => {
    const o = item.options[i]!;
    if (revealed && o.correct) return 'correct';
    if (wrong.has(i)) return 'wrong';
    if (item.multi && picked.includes(i)) return 'selected';
    return null;
  };
  const press = (i: number) => {
    if (disabled || revealed) return;
    if (!item.multi) {
      submit([i]);
      return;
    }
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  };
  return (
    <div className="eng-choice">
      <div className={`eng-choice__options eng-choice__options--${item.layout ?? 'row'}`}>
        {shown
          .map((i) => ({ o: item.options[i]!, i }))
          .map(({ o, i }) => (
            <Choice
              key={i}
              label={o.label !== undefined ? plainText(o.label) : `${i + 1}ばん`}
              state={stateOf(i)}
              disabled={disabled || revealed}
              onPress={() => press(i)}
              testId={`opt-${i}`}
              className="eng-choice__opt"
            >
              {o.figure ? <Figure fig={o.figure} ctx={ctx} /> : null}
              {o.label !== undefined ? (
                <span className="eng-choice__label">
                  <Rt text={o.label} ctx={ctx} />
                </span>
              ) : null}
            </Choice>
          ))}
      </div>
      {item.multi && !revealed ? (
        <button
          type="button"
          className="tap tap--main eng-check"
          disabled={disabled || picked.length === 0}
          onClick={() => submit(picked)}
          data-testid="check"
        >
          こたえあわせ
        </button>
      ) : null}
    </div>
  );
}

export const choiceEngine: EngineDef<ChoiceItem, ChoiceResponse> = {
  id: 'choice',
  Component: ChoiceView,
  judge: judgeChoice,
  check: checkChoice,
  answerText: (item) =>
    item.options
      .filter((o) => o.correct)
      .map((o) => o.label ?? '')
      .join('、'),
};
