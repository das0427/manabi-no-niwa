import { INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const rotate: IllustDef = {
  id: 'rotate',
  label: 'まわす',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M24 80 C8 62 14 34 44 30 L60 31"
        fill="none"
        stroke={INK}
        strokeWidth="17"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24 80 C8 62 14 34 44 30 L60 31"
        fill="none"
        stroke={P.orange}
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M88 32 L60 12 L60 52 Z" fill={P.orange} {...line} />
    </g>
  ),
};
