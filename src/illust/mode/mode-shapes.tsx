import { line, type IllustDef } from '../types';
import { P } from '../palette';

export const modeShapes: IllustDef = {
  id: 'mode-shapes',
  label: 'かたち',
  status: 'final',
  draw: () => (
    <g>
      <circle cx="28" cy="30" r="20" fill={P.wood} {...line} />
      <circle cx="28" cy="30" r="10" fill={P.red} />
      <path d="M72 12 L94 50 L50 50 Z" fill={P.wood} {...line} />
      <path d="M72 28 L83 44 L61 44 Z" fill={P.yellow} />
      <rect x="30" y="58" width="40" height="32" rx="5" fill={P.wood} {...line} />
      <rect x="38" y="65" width="24" height="18" rx="3" fill={P.blue} />
    </g>
  ),
};
