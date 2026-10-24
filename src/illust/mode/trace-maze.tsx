import { line, type IllustDef } from '../types';
import { P } from '../palette';

export const traceMaze: IllustDef = {
  id: 'trace-maze',
  label: 'めいろ',
  status: 'final',
  draw: () => (
    <g>
      <rect x="10" y="10" width="80" height="80" rx="6" fill={P.cream} {...line} />
      <path d="M10 36 H66 M90 64 H34" fill="none" {...line} />
      <circle cx="22" cy="23" r="6" fill={P.green} {...line} />
      <circle cx="78" cy="77" r="6" fill={P.red} {...line} />
    </g>
  ),
};
