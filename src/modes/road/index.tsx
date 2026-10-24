/**
 * みちを つくろう（M7）。「もんだい」（R1〜R4）と「じゆうに つくる」。
 * 盤面規則は board.ts、教材は content.ts、出題とヒントは logic.ts。
 */
import type { ModePlayProps } from '../../core/session/types';
import Free from './Free';
import Puzzle from './Puzzle';

export default function Road(props: ModePlayProps) {
  return props.session.variantId === 'free' ? <Free {...props} /> : <Puzzle {...props} />;
}
