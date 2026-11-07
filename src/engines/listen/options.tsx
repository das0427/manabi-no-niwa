/**
 * 選択肢の部品（listen・reading で使う）。見た目と操作は choice エンジンと同じ。
 * 判定・検査は choice の judgeChoice・checkChoice をそのまま使う（選択肢の約束を1つにする）。
 */
import { useRef, useState, type CSSProperties } from 'react';
import type { ChoiceItem, ChoiceOption } from '../../curriculum/types';
import { plainText } from '../../text/rich';
import { Choice } from '../../ui/Choice';
import type { TapState } from '../../ui/Tap';
import {
  autoLayout,
  checkChoice,
  judgeChoice,
  OptionLabel,
  optionTraits,
  picCapStyle,
  picsAttrs,
  picsFitOf,
  picsProps,
  usePicsGeometry,
  wordCardProps,
  wordTrait,
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
  /** 問題の図（並びの自動決定に使う） */
  figure?: unknown;
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
  /**
   * 押したときの動き（listen の nameBack だけが渡す）。渡すと submit は呼ばずに onPress へ任せる
   * （名前を鳴らしてから send で答える）。reading は渡さない
   */
  onPress?: (i: number, send: (r: ChoiceResponse) => void) => void;
  /** onPress の間、選択中の見た目にする選択肢の番号 */
  pressed?: number | null;
  className?: string;
  /**
   * 並びを中身で決める（autoLayout）。reading は false（右の細い列なので、指定の縦一列のまま。
   * 2列にすると1行6〜7字で語の途中で折れる）
   */
  autoArrange?: boolean;
  /** 選択肢の横に並ぶものの幅（u）。絵の縮み（picsProps）の見積りに使う */
  picsSide?: number;
  /**
   * 聞く問題で、「きく」の札の場所を絵の大きさから選ばせる（第7回 X2。usePicsGeometry）。at: 今の場所／side: 左に置くとき
   * 取る幅（u）／onChange: 選んだ場所を伝える（呼び出し側が札の場所を替える）。解説（revealed）では場所を替えない
   */
  ear?: { at: 'top' | 'left'; side: number; onChange(at: 'top' | 'left'): void };
}

export function ChoiceOptions({
  part,
  ctx,
  revealed,
  wrongMark,
  locked,
  submit,
  onPress,
  pressed,
  className,
  autoArrange = true,
  picsSide = 0,
  ear,
}: Props) {
  const [picked, setPicked] = useState<number[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const wrong = new Set(Array.isArray(wrongMark) ? (wrongMark as number[]) : []);
  const shown = visibleOptionIndices(
    part.options,
    part.multi ? part.options.length : ctx.ux.maxChoices,
  );
  const stateOf = (i: number): TapState => {
    const o = part.options[i]!;
    if (revealed && o.correct) return 'correct';
    if (pressed === i) return 'selected';
    if (wrong.has(i)) return 'wrong';
    if (part.multi && picked.includes(i)) return 'selected';
    return null;
  };
  const press = (i: number) => {
    if (locked || revealed) return;
    if (!part.multi) {
      if (onPress) onPress(i, submit);
      else submit([i]);
      return;
    }
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  };
  const layout = !autoArrange
    ? (part.layout ?? 'row')
    : autoLayout(
        shown.map((i) => ({
          label: typeof part.options[i]!.label === 'string' ? part.options[i]!.label : undefined,
          figure: part.options[i]!.figure,
        })),
        part.layout,
        part.figure !== undefined,
      );
  const pics = picsProps(
    shown.map((i) => ({
      label: typeof part.options[i]!.label === 'string' ? part.options[i]!.label : undefined,
      figure: part.options[i]!.figure,
    })),
    layout,
    picsSide,
  );
  const traits = optionTraits(
    shown.map((i) => ({
      label: typeof part.options[i]!.label === 'string' ? part.options[i]!.label : undefined,
      figure: part.options[i]!.figure,
    })),
    layout,
    pics.className !== '',
  );
  const fit = picsFitOf(
    shown.map((i) => ({ figure: part.options[i]!.figure })),
    pics.className !== '',
    ear ? { ...ear, free: !revealed } : undefined,
  );
  const shape = usePicsGeometry(listRef, pics.className !== '' || traits.caption, fit);
  const hasLabel = shown.some((i) => part.options[i]!.label !== undefined);
  return (
    <div className={['eng-opts', className ?? ''].join(' ')}>
      <div
        ref={listRef}
        className={`eng-opts__list eng-opts__list--${layout}${pics.className}${traits.caption ? ' is-caption' : ''}`}
        style={
          pics.className
            ? ({ ...pics.style, '--pics-label': hasLabel ? 1 : 0 } as CSSProperties)
            : pics.style
        }
        data-long={traits.long ? '' : undefined}
        data-row4={traits.row4 ? '' : undefined}
        {...picsAttrs(fit, shape)}
      >
        {shown
          .map((i) => ({ o: part.options[i]!, i }))
          .map(({ o, i }, pos) => {
            const word = traits.long
              ? null
              : wordTrait(typeof o.label === 'string' ? o.label : undefined, traits.row4 ? 9 : 8);
            const wc = wordCardProps(word);
            return (
              <Choice
                key={i}
                label={o.label !== undefined ? plainText(o.label) : `${i + 1}ばん`}
                state={stateOf(i)}
                disabled={locked || revealed}
                onPress={() => press(i)}
                testId={`opt-${i}`}
                className={`eng-opts__opt${o.figure ? '' : ' eng-opts__opt--text'}${wc.cls}`}
                style={picCapStyle(fit, pos, wc.style)}
              >
                {o.figure && o.label !== undefined ? (
                  <span className="eng-opts__pic">
                    {stateOf(i) === 'correct' ? (
                      <span className="mark mark--correct" aria-hidden />
                    ) : null}
                    <Figure fig={o.figure} ctx={ctx} />
                  </span>
                ) : o.figure ? (
                  <Figure fig={o.figure} ctx={ctx} />
                ) : null}
                {o.label !== undefined ? (
                  <OptionLabel label={o.label} ctx={ctx} className="eng-opts__label" word={word} />
                ) : null}
              </Choice>
            );
          })}
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
