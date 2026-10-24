import { HIGHLIGHT, line, type IllustDef } from '../types';
import { P } from '../palette';

export const tomato: IllustDef = {
  id: 'tomato',
  label: 'トマト',
  status: 'final',
  draw: () => (
    <g>
      <ellipse cx="50" cy="58" rx="39" ry="32" fill={P.red} {...line} />
      {/* へた（星形） */}
      <path d="M50 38 L50 22" fill="none" {...line} strokeWidth="5" />
      <path
        d="M50 28 L54.7 36 L70.9 36.3 L57.6 41.5 L62.9 49.7 L50 45 L37.1 49.7 L42.4 41.5 L29.1 36.3 L45.3 36 Z"
        fill={P.green}
        {...line}
      />
      <ellipse
        cx="25"
        cy="60"
        rx="3.5"
        ry="7"
        transform="rotate(12 25 60)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
    </g>
  ),
};
