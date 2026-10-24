import { HIGHLIGHT, line, type IllustDef } from '../types';
import { P } from '../palette';

export const eggplant: IllustDef = {
  id: 'eggplant',
  label: 'なす',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M62 32 C44 36 22 54 16 74 C13 86 22 94 34 90 C58 82 78 58 80 40 C81 32 72 30 62 32 Z"
        fill={P.purple}
        {...line}
      />
      {/* へた */}
      <path d="M68 32 L74 14" fill="none" {...line} strokeWidth="6" />
      <path d="M52 36 C54 24 72 20 84 32 C80 44 62 48 52 36 Z" fill={P.green} {...line} />
      <ellipse
        cx="34"
        cy="72"
        rx="3"
        ry="9"
        transform="rotate(48 34 72)"
        fill={HIGHLIGHT}
        opacity="0.5"
      />
    </g>
  ),
};
