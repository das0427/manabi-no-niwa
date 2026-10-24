import { INK, line, type IllustDef } from '../types';
import { P } from '../palette';

export const undo: IllustDef = {
  id: 'undo',
  label: 'ひとつ もどす',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M76 80 C92 62 86 34 56 30 L40 31"
        fill="none"
        stroke={INK}
        strokeWidth="17"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M76 80 C92 62 86 34 56 30 L40 31"
        fill="none"
        stroke={P.sky}
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 32 L40 12 L40 52 Z" fill={P.sky} {...line} />
    </g>
  ),
};
