import { INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const hint: IllustDef = {
  id: 'hint',
  label: 'ヒント',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M20 12 H80 Q92 12 92 24 V58 Q92 70 80 70 H52 L32 90 L34 70 H20 Q8 70 8 58 V24 Q8 12 20 12 Z"
        fill={P.sun}
        {...line}
      />
      <path
        d="M37 34 C37 22 63 22 63 34 C63 43 50 44 50 54"
        fill="none"
        stroke={INK}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="62" r="4.5" fill={INK} />
    </g>
  ),
};
