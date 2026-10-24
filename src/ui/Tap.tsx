import type { CSSProperties, ReactNode } from 'react';
import { Illust } from '../illust/Illust';

export type TapVariant = 'wood' | 'main' | 'sky' | 'white';
export type TapState = 'selected' | 'correct' | 'wrong' | 'hint' | null;

interface Props {
  /** 読み上げ用の名前（文字を出さないアイコンだけの札でも必須） */
  label: string;
  /** 札に表示する文字（省略時は文字なし） */
  text?: ReactNode;
  icon?: string;
  variant?: TapVariant;
  size?: 'main' | 'aux' | 'big';
  state?: TapState;
  disabled?: boolean;
  onPress?: () => void;
  className?: string;
  style?: CSSProperties;
  testId?: string;
}

/** 木の札（押せるもの）。DESINGN.md 7章 */
export function Tap({
  label,
  text,
  icon,
  variant = 'wood',
  size = 'main',
  state = null,
  disabled,
  onPress,
  className,
  style,
  testId,
}: Props) {
  const cls = [
    'tap',
    `tap--${variant}`,
    size !== 'main' ? `tap--${size}` : '',
    state ? `is-${state}` : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={cls}
      aria-label={label}
      disabled={disabled}
      onClick={onPress}
      style={style}
      data-testid={testId}
      data-state={state ?? undefined}
    >
      {icon ? <Illust id={icon} className="tap__icon" decorative /> : null}
      {text}
      <StateMark state={state} />
    </button>
  );
}

/** 正解の○、誤答の？ の印（色だけで伝えない） */
export function StateMark({ state }: { state: TapState }) {
  if (state === 'correct') return <span className="mark mark--correct" aria-hidden />;
  if (state === 'wrong')
    return (
      <span className="mark mark--wrong" aria-hidden>
        ？
      </span>
    );
  return null;
}
