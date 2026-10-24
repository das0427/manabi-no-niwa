import { INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const again: IllustDef = {
  id: 'again',
  label: 'もういっかい',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M38 24 A30 30 0 1 1 20 52"
        fill="none"
        stroke={INK}
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M38 24 A30 30 0 1 1 20 52"
        fill="none"
        stroke={P.leaf}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M20 28 L5 52 L35 52 Z" fill={P.leaf} {...line} />
    </g>
  ),
};
