import { INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const mathFormulaAdd: IllustDef = {
  id: 'math-formula-add',
  label: 'しき（たす）',
  status: 'final',
  draw: () => (
    <g>
      <rect x="6" y="20" width="88" height="60" rx="8" fill={P.wood} {...line} />
      <rect x="13" y="27" width="74" height="46" rx="4" fill={P.cream} />
      <path
        d="M26 44 L35 36 V66"
        fill="none"
        stroke={INK}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M51 42V60M42 51H60"
        fill="none"
        stroke={INK}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M66 44 L75 36 V66"
        fill="none"
        stroke={INK}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  ),
};
