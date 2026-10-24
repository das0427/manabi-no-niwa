import { INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const mathFormulaSub: IllustDef = {
  id: 'math-formula-sub',
  label: 'しき（ひく）',
  status: 'final',
  draw: () => (
    <g>
      <rect x="6" y="20" width="88" height="60" rx="8" fill={P.wood} {...line} />
      <rect x="13" y="27" width="74" height="46" rx="4" fill={P.cream} />
      <path
        d="M20 42 C20 30 42 30 42 42 C42 50 22 60 20 66 H44"
        fill="none"
        stroke={INK}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M52 51 H68"
        fill="none"
        stroke={INK}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M75 44 L83 36 V66"
        fill="none"
        stroke={INK}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  ),
};
