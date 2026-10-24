import { INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const traceLines: IllustDef = {
  id: 'trace-lines',
  label: 'せん',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M10 56 C20 20 36 20 46 52 C54 80 70 80 80 44 L90 30"
        fill="none"
        stroke={INK}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeDasharray="0 10"
      />
      <circle cx="10" cy="56" r="8" fill={P.green} {...line} />
    </g>
  ),
};
