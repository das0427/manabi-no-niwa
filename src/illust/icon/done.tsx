import { INK, type IllustDef } from '../types';
import { P } from '../palette';

export const done: IllustDef = {
  id: 'done',
  label: 'できた',
  status: 'final',
  draw: () => (
    <g>
      <path
        d="M50 50 m-34 0 a34 34 0 1 0 68 0 a34 34 0 1 0 -68 0"
        fill="none"
        stroke={INK}
        strokeWidth="21"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M50 50 m-34 0 a34 34 0 1 0 68 0 a34 34 0 1 0 -68 0"
        fill="none"
        stroke={P.leaf}
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  ),
};
