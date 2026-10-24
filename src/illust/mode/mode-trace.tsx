import { INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const modeTrace: IllustDef = {
  id: 'mode-trace',
  label: 'なぞって あそぼう',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M55 50 C60 80 75 85 90 30"
        fill="none"
        stroke={INK}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeDasharray="0 10"
      />
      <path
        d="M12 70 C30 20 50 20 55 50"
        fill="none"
        stroke={INK}
        strokeWidth="15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 70 C30 20 50 20 55 50"
        fill="none"
        stroke={P.sun}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="70" r="8" fill={P.green} {...line} />
    </g>
  ),
};
