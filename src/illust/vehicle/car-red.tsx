import { HIGHLIGHT, INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const carRed: IllustDef = {
  id: 'car-red',
  label: 'くるま',
  status: 'final',
  draw: () => (
    <g transform="translate(0 -7)">
      {/* 車体 */}
      <path
        d="M10 70 L10 56 C10 52 13 50 17 50 L28 50 L38 36 C40 34 42 33 45 33 L64 33 C67 33 69 34 71 36 L78 50 L86 51 C91 52 93 55 93 60 L93 70 Z"
        fill={P.red}
        {...line}
      />
      {/* 窓 */}
      <path d="M33 48 L40.5 38.5 L47 38.5 L47 48 Z" fill={P.blue} {...line} />
      <path d="M55 48 L55 38.5 L63 38.5 L69.5 48 Z" fill={P.blue} {...line} />
      <ellipse cx="20" cy="58" rx="4" ry="2" fill={HIGHLIGHT} opacity="0.5" />
      {/* タイヤ */}
      <circle cx="28" cy="72" r="11" fill={INK} stroke={INK} strokeWidth="3.5" />
      <circle cx="28" cy="72" r="4.5" fill={P.gray} />
      <circle cx="76" cy="72" r="11" fill={INK} stroke={INK} strokeWidth="3.5" />
      <circle cx="76" cy="72" r="4.5" fill={P.gray} />
    </g>
  ),
};
