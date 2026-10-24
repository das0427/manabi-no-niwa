import { INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const traceLetters: IllustDef = {
  id: 'trace-letters',
  label: 'もじ',
  status: 'final',
  draw: () => (
    <g>
      <rect x="10" y="8" width="80" height="84" rx="6" fill={P.white} {...line} />
      <path
        d="M31.6 16.2L32.4 21.6L31.7 27.1L31 32.6L30.3 38.1L29.8 43.6L29.5 49.1L29.3 54.6L29.2 60.2L29.4 65.7L30.3 71.1L32.4 76.3L36 80.5L40.8 83.1L46.3 84L51.8 83.8L57.2 82.7L62.5 81L67.6 78.9L70.9 77.3"
        fill="none"
        stroke={INK}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeDasharray="0 10"
      />
      <circle cx="31.6" cy="16.2" r="6" fill={P.green} {...line} />
    </g>
  ),
};
