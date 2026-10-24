import { line, type IllustDef } from '../types';
import { P } from '../palette';

export const notebook: IllustDef = {
  id: 'notebook',
  label: 'がんばりノート',
  status: 'final',
  draw: () => (
    <g>
      <rect x="22" y="14" width="64" height="78" rx="6" fill={P.white} {...line} />
      <rect x="12" y="8" width="64" height="80" rx="7" fill={P.wood} {...line} />
      <path d="M12 15 Q12 8 19 8 H28 V88 H19 Q12 88 12 81 Z" fill={P.brown} {...line} />
      <path d="M40 66 C38 46 52 33 68 35 C70 50 58 66 40 66 Z" fill={P.green} {...line} />
      <path
        d="M42 64 L58 44"
        fill="none"
        stroke={P.greenDark}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
  ),
};
