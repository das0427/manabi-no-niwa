/**
 * 選択肢の部品（listen・reading で使う）。見た目と操作は choice エンジンと同じ。
 * 判定・検査は choice の judgeChoice・checkChoice をそのまま使う（選択肢の約束を1つにする）。
 */
import { useState } from 'react';
import type { ChoiceItem, ChoiceOption } from '../../curriculum/types';
import { Rt } from '../../text/Rt';
import { plainText } from '../../text/rich';
import { Choice } from '../../ui/Choice';
import type { TapState } from '../../ui/Tap';
import {
  checkChoice,
  judgeChoice,
  visibleOptionIndices,
  type ChoiceResponse,
} from '../choice/choice';
import { Figure } from '../figure/Figure';
import type { Judgement, RenderCtx } from '../types';
import './options.css';

export interface OptionsPart {
  options: ChoiceOption[];
  multi?: boolean;
  layout?: 'row' | 'grid' | 'column';
}

/** judgeChoice・checkChoice が読むのは options と multi だけ */
const asChoice = (p: OptionsPart): ChoiceItem =>
  ({ options: p.options, multi: p.multi }) as ChoiceItem;

export const judgeOptions = (p: OptionsPart, picked: ChoiceResponse): Judgement =>
  judgeChoice(asChoice(p), picked);

export const checkOptions = (p: OptionsPart): string[] => checkChoice(asChoice(p));

export const correctLabels = (p: OptionsPart): string =>
  p.options
    .filter((o) => o.correct)
    .map((o) => o.label ?? '')
    .join('、');

interface Props {
  part: OptionsPart;
  ctx: RenderCtx;
  revealed: boolean;
  wrongMark: unknown;
  /** 押せない（判定中・最初の再生中など） */
  locked: boolean;
  submit(r: ChoiceResponse): void;
  className?: string;
}

export function ChoiceOptions({
  part,
  ctx,
  revealed,
  wrongMark,
  locked,
  submit,
  className,
}: Props) {
  const [picked, setPicked] = useState<number[]>([]);
  const wrong = new Set(Array.isArray(wrongMark) ? (wrongMark as number[]) : []);
  const shown = visibleOptionIndices(
    part.options,
    part.multi ? part.options.length : ctx.ux.maxChoices,
  );
  const stateOf = (i: number): TapState => {
    const o = part.options[i]!;
    if (revealed && o.correct) return 'correct';
    if (wrong.has(i)) return 'wrong';
    if (part.multi && picked.includes(i)) return 'selected';
    return null;
  };
  const press = (i: number) => {
    if (locked || revealed) return;
    if (!part.multi) {
      submit([i]);
      return;
    }
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  };
  return (
    <div className={['eng-opts', className ?? ''].join(' ')}>
      <div className={`eng-opts__list eng-opts__list--${part.layout ?? 'row'}`}>
        {shown
          .map((i) => ({ o: part.options[i]!, i }))
          .map(({ o, i }) => (
            <Choice
              key={i}
              label={o.label !== undefined ? plainText(o.label) : `${i + 1}ばん`}
              state={stateOf(i)}
              disabled={locked || revealed}
              onPress={() => press(i)}
              testId={`opt-${i}`}
              className="eng-opts__opt"
            >
              {o.figure ? <Figure fig={o.figure} ctx={ctx} /> : null}
              {o.label !== undefined ? (
                <span className="eng-opts__label">
                  <Rt text={o.label} ctx={ctx} />
                </span>
              ) : null}
            </Choice>
          ))}
      </div>
      {part.multi && !revealed ? (
        <button
          type="button"
          className="tap tap--main eng-opts__check"
          disabled={locked || picked.length === 0}
          onClick={() => submit(picked)}
          data-testid="check"
        >
          こたえあわせ
        </button>
      ) : null}
    </div>
  );
}
