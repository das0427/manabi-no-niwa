import { line, type IllustDef } from '../types';
import { P } from '../palette';

export const eraser: IllustDef = {
  id: 'eraser',
  label: 'けす',
  status: 'final',
  draw: () => (
    <g>
      <g transform="rotate(-30 50 50)">
        <rect x="12" y="32" width="76" height="36" rx="7" fill={P.white} {...line} />
        <path d="M19 32 H52 V68 H19 Q12 68 12 61 V39 Q12 32 19 32 Z" fill={P.pink} {...line} />
      </g>
      <path d="M16 88 H84" fill="none" {...line} />
    </g>
  ),
};
