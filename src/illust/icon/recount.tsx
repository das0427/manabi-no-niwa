import { line, type IllustDef } from '../types';
import { P } from '../palette';

export const recount: IllustDef = {
  id: 'recount',
  label: 'かぞえなおす',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M40 22 A7 7 0 0 1 54 22 V46 H72 Q84 46 84 58 V72 Q84 90 66 90 H48 Q36 90 30 80 L18 64 Q14 58 20 54 Q26 50 32 56 L40 64 Z"
        fill={P.tan}
        {...line}
      />
      <path d="M60 58 V72 M71 58 V72" fill="none" {...line} />
      <circle cx="66" cy="14" r="3.5" fill={P.sun} {...line} />
      <circle cx="77" cy="14" r="3.5" fill={P.sun} {...line} />
      <circle cx="88" cy="14" r="3.5" fill={P.sun} {...line} />
    </g>
  ),
};
