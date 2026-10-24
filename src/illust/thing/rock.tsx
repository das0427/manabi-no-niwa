import { HIGHLIGHT, line, type IllustDef } from '../types';
import { P } from '../palette';

export const rock: IllustDef = {
  id: 'rock',
  label: 'いわ',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M10 86 C6 84 6 74 8 62 L18 36 L34 18 L58 12 L78 22 L90 46 L94 74 C94 82 92 86 88 86 Z"
        fill={P.gray}
        {...line}
      />
      {/* ひび */}
      <path d="M58 14 L52 34 L62 46" fill="none" {...line} strokeWidth="2.5" />
      <path d="M22 58 L34 66 L30 80" fill="none" {...line} strokeWidth="2.5" />
      <path d="M20 40 L34 24 L46 22 L32 40 Z" fill={HIGHLIGHT} opacity="0.5" />
    </g>
  ),
};
