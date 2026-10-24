import type { CSSProperties, ReactNode } from 'react';
import { Illust } from '../illust/Illust';
import { StateMark, type TapState } from './Tap';

interface Props {
  label: string;
  /** 絵の選択肢 */
  illust?: string;
  /** 数字・記号の選択肢 */
  text?: string;
  /** 学ぶ対象の文字（Klee One で表示） */
  letter?: string;
  children?: ReactNode;
  state?: TapState;
  disabled?: boolean;
  onPress?: () => void;
  className?: string;
  style?: CSSProperties;
  testId?: string;
}

/** 選択肢のカード（白い面＋輪郭＋段差）。DESINGN.md 7〜8章 */
export function Choice({
  label,
  illust,
  text,
  letter,
  children,
  state = null,
  disabled,
  onPress,
  className,
  style,
  testId,
}: Props) {
  return (
    <button
      type="button"
      className={['choice', state ? `is-${state}` : '', className ?? ''].filter(Boolean).join(' ')}
      aria-label={label}
      disabled={disabled}
      onClick={onPress}
      style={style}
      data-testid={testId}
      data-state={state ?? undefined}
    >
      {illust ? <Illust id={illust} className="choice__illust" decorative /> : null}
      {text !== undefined ? <span className="choice__text">{text}</span> : null}
      {letter !== undefined ? <span className="choice__letter">{letter}</span> : null}
      {children}
      <StateMark state={state} />
    </button>
  );
}
