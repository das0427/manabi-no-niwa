import { INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const lock: IllustDef = {
  id: 'lock',
  label: 'おとなの ひと',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M31 48 V32 A19 19 0 0 1 69 32 V48"
        fill="none"
        stroke={INK}
        strokeWidth="15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M31 48 V32 A19 19 0 0 1 69 32 V48"
        fill="none"
        stroke={P.gray}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="14" y="44" width="72" height="46" rx="9" fill={P.sun} {...line} />
      <circle cx="50" cy="62" r="6" fill={INK} />
      <path d="M50 64 V76" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />
    </g>
  ),
};
